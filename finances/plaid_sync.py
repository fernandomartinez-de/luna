#!/usr/bin/env python3
"""
Daily Plaid -> Supabase finance sync.

Pulls new/changed Chase transactions via Plaid /transactions/sync, categorizes
them with the `category_mapping` table, and upserts them into
`expense_transactions` so they blend seamlessly with the manually-imported
history. Runs headless in GitHub Actions.

State (the sync cursor) lives in Supabase because the runner is stateless, so
each run resumes exactly where the last one stopped.

Key conventions (verified against the live table):
  * expense_transactions stores money-OUT as negative, money-IN as positive.
    Plaid uses the opposite (out = positive), so we flip the sign.
  * `source` is the account code already in use: checking / cc_5113 / cc_4433,
    mapped from the Plaid account mask (last 4).
  * Idempotency is on plaid_transaction_id (unique index). The ~2,700 existing
    manual rows have a NULL id and are never touched.

No secrets are printed. Account numbers are never stored beyond the last 4.
"""

import os
import sys
import time
import json
from datetime import datetime, timezone

import plaid
from plaid.api import plaid_api
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.exceptions import ApiException
from supabase import create_client, Client


# --- Config -----------------------------------------------------------------

def _req(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"[plaid-sync] missing required env var: {name}")
    return v.strip()

PLAID_CLIENT_ID = _req("PLAID_CLIENT_ID")
PLAID_SECRET    = _req("PLAID_SECRET")
PLAID_ENV       = os.environ.get("PLAID_ENV", "production").strip().lower()
ACCESS_TOKEN    = _req("PLAID_ACCESS_TOKEN")
ITEM_ID         = os.environ.get("PLAID_ITEM_ID", "").strip()

SUPABASE_URL = _req("SUPABASE_URL")
SUPABASE_KEY = _req("SUPABASE_KEY")

# Used only for an account that has NO prior rows at all (a brand-new link).
SYNC_FLOOR = os.environ.get("PLAID_SYNC_FLOOR", "2000-01-01").strip()

# Chase account mask (last 4) -> the source code already used in
# expense_transactions. Add a line here if you ever link another account.
MASK_TO_SOURCE = {
    "6813": "checking",   # Chase Total Checking
    "5113": "cc_5113",    # Chase Freedom Unlimited
    "4433": "cc_4433",    # Chase Sapphire Preferred
}

_ENV_HOST = {
    "production": plaid.Environment.Production,
    "sandbox": plaid.Environment.Sandbox,
}


# --- Clients ----------------------------------------------------------------

def plaid_client() -> plaid_api.PlaidApi:
    cfg = plaid.Configuration(
        host=_ENV_HOST.get(PLAID_ENV, plaid.Environment.Production),
        api_key={"clientId": PLAID_CLIENT_ID, "secret": PLAID_SECRET},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(cfg))


def supa() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# --- Helpers ----------------------------------------------------------------

def iso(d):
    """Plaid dates come back as datetime.date via to_dict(); normalize to ISO."""
    if d is None:
        return None
    return d.isoformat() if hasattr(d, "isoformat") else str(d)


def load_rules(sb: Client):
    r = (sb.table("category_mapping")
           .select("category, pattern, pattern_type, priority")
           .order("priority")            # lower priority number wins
           .execute())
    return r.data or []


def categorize(description, rules):
    d = (description or "").upper()
    for rule in rules:
        pat = (rule.get("pattern") or "").upper()
        pt = rule.get("pattern_type")
        if not pat:
            continue
        if pt == "contains" and pat in d:
            return rule["category"]
        if pt == "starts_with" and d.startswith(pat):
            return rule["category"]
    return None


def account_source_map(sb: Client, client: plaid_api.PlaidApi, item_id: str):
    """
    Return {account_id -> source_code}, self-healing the plaid_accounts table
    from Plaid /accounts/get on every run. Unmapped masks are reported and
    skipped (never guessed).
    """
    accts = client.accounts_get(
        AccountsGetRequest(access_token=ACCESS_TOKEN)
    ).to_dict()["accounts"]

    mapping, rows, unmapped = {}, [], []
    now = datetime.now(timezone.utc).isoformat()
    for a in accts:
        mask = a.get("mask") or ""
        src = MASK_TO_SOURCE.get(mask)
        mapping[a["account_id"]] = src
        if src is None:
            unmapped.append(mask or "????")
        rows.append({
            "account_id": a["account_id"],
            "item_id": item_id or None,
            "name": a.get("name"),
            "official_name": a.get("official_name"),
            "mask": mask or None,                       # last 4 only
            "type": str(a["type"]) if a.get("type") is not None else None,
            "subtype": str(a["subtype"]) if a.get("subtype") is not None else None,
            "source_code": src,
            "updated_at": now,
        })
    if rows:
        sb.table("plaid_accounts").upsert(rows, on_conflict="account_id").execute()
    if unmapped:
        print(f"[plaid-sync] WARNING: unmapped account masks {unmapped} "
              f"(add to MASK_TO_SOURCE to track them)")
    return mapping


def manual_watermark(sb: Client, source_code: str) -> str:
    """
    Latest transaction_date among the MANUAL rows (plaid_transaction_id IS NULL)
    for this source. This is a STABLE cutover: it never moves as Plaid inserts
    rows, so recent transactions and their later modifications always pass.
    """
    r = (sb.table("expense_transactions")
           .select("transaction_date")
           .eq("source", source_code)
           .is_("plaid_transaction_id", "null")
           .order("transaction_date", desc=True)
           .limit(1)
           .execute())
    if r.data:
        return r.data[0]["transaction_date"]            # 'YYYY-MM-DD'
    return SYNC_FLOOR


def load_cursor(sb: Client, item_id: str):
    r = (sb.table("plaid_sync_state")
           .select("cursor")
           .eq("item_id", item_id)
           .limit(1)
           .execute())
    if r.data and r.data[0].get("cursor"):
        return r.data[0]["cursor"]
    return None


def save_cursor(sb: Client, item_id: str, cursor: str):
    sb.table("plaid_sync_state").upsert({
        "item_id": item_id,
        "cursor": cursor,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="item_id").execute()


def fetch_sync(client: plaid_api.PlaidApi, cursor):
    """One /transactions/sync page, retrying while the product is still warming."""
    kwargs = {"access_token": ACCESS_TOKEN, "count": 500}
    if cursor:
        kwargs["cursor"] = cursor
    req = TransactionsSyncRequest(**kwargs)
    for attempt in range(6):
        try:
            return client.transactions_sync(req).to_dict()
        except ApiException as e:
            try:
                code = json.loads(e.body).get("error_code")
            except Exception:
                code = None
            if code in ("PRODUCT_NOT_READY", "TRANSACTIONS_NOT_READY") and attempt < 5:
                print(f"[plaid-sync] {code}, retrying in 10s...")
                time.sleep(10)
                continue
            raise
    raise RuntimeError("transactions_sync never became ready")


# --- Main -------------------------------------------------------------------

def run():
    sb = supa()
    client = plaid_client()

    item_id = ITEM_ID
    if not item_id:
        st = sb.table("plaid_sync_state").select("item_id").limit(1).execute()
        item_id = st.data[0]["item_id"] if st.data else "default"

    rules = load_rules(sb)
    acct_source = account_source_map(sb, client, item_id)

    wm_cache = {}
    def watermark(src):
        if src not in wm_cache:
            wm_cache[src] = manual_watermark(sb, src)
        return wm_cache[src]

    # Pull every page (cursor advances until has_more is False).
    cursor = load_cursor(sb, item_id)
    added, modified, removed = [], [], []
    while True:
        page = fetch_sync(client, cursor)
        added    += page["added"]
        modified += page["modified"]
        removed  += page["removed"]
        cursor    = page["next_cursor"]
        if not page["has_more"]:
            break

    # Build rows for added + modified, gated by the per-source manual watermark
    # so we never double-count the history the manual import already owns.
    rows, skipped_old, skipped_unknown = [], 0, 0
    for txn in added + modified:
        src = acct_source.get(txn.get("account_id"))
        if not src:
            skipped_unknown += 1
            continue
        tdate = iso(txn.get("authorized_date") or txn.get("date"))
        if tdate is None:
            continue
        if tdate <= watermark(src):
            skipped_old += 1
            continue
        desc = txn.get("name") or txn.get("merchant_name") or "(no description)"
        rows.append({
            "transaction_date": tdate,
            "post_date": iso(txn.get("date")),
            "description": desc,
            "amount": round(-float(txn["amount"]), 2),   # flip Plaid sign
            "category": categorize(desc, rules),
            "source": src,
            "month": tdate[:7],                           # 'YYYY-MM'
            "plaid_transaction_id": txn["transaction_id"],
        })

    upserted = 0
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        sb.table("expense_transactions").upsert(
            chunk, on_conflict="plaid_transaction_id"
        ).execute()
        upserted += len(chunk)

    # Removed transactions only ever match Plaid rows (manual rows have NULL id).
    rem_ids = [r["transaction_id"] for r in removed if r.get("transaction_id")]
    removed_n = 0
    for i in range(0, len(rem_ids), 200):
        chunk = rem_ids[i:i + 200]
        sb.table("expense_transactions").delete().in_(
            "plaid_transaction_id", chunk
        ).execute()
        removed_n += len(chunk)

    save_cursor(sb, item_id, cursor)

    print(f"[plaid-sync] item={item_id} "
          f"pulled(added+modified)={len(added) + len(modified)} "
          f"upserted={upserted} removed={removed_n} "
          f"skipped_prior_history={skipped_old} "
          f"skipped_unknown_account={skipped_unknown}")


if __name__ == "__main__":
    run()
