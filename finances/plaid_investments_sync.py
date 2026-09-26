#!/usr/bin/env python3
"""
Daily Plaid investments -> Supabase.

Pulls current holdings for the linked Fidelity item via Plaid
/investments/holdings/get and writes a dated snapshot into the existing
`stocks_crypto_history` table, labeled asset_type 'Retirement' (or 'Brokerage'
for a non-retirement investment account). Runs headless in GitHub Actions.

It reuses your manual investments table on purpose. To stay idempotent and
never touch your hand-tracked Stock/Crypto rows, each run deletes today's
'Retirement'/'Brokerage' rows and reinserts the fresh set.

No secrets are printed. Account numbers are never stored beyond the last 4.
"""

import os
import sys
import time
import json
from datetime import datetime, timezone

import plaid
from plaid.api import plaid_api
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
from plaid.exceptions import ApiException
from supabase import create_client, Client


def _req(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"[plaid-inv] missing required env var: {name}")
    return v.strip()

PLAID_CLIENT_ID = _req("PLAID_CLIENT_ID")
PLAID_SECRET    = _req("PLAID_SECRET")
PLAID_ENV       = os.environ.get("PLAID_ENV", "production").strip().lower()
ACCESS_TOKEN    = _req("PLAID_FIDELITY_ACCESS_TOKEN")

SUPABASE_URL = _req("SUPABASE_URL")
SUPABASE_KEY = _req("SUPABASE_KEY")

_ENV_HOST = {
    "production": plaid.Environment.Production,
    "sandbox": plaid.Environment.Sandbox,
}

# Account subtypes counted as retirement. Anything else investment -> Brokerage.
RETIREMENT_SUBTYPES = {
    "401k", "401a", "403b", "403B", "457b", "457", "ira", "roth", "roth ira",
    "roth 401k", "sep ira", "simple ira", "sarsep", "pension", "retirement",
    "tsp", "thrift savings plan", "keogh", "rollover ira", "traditional ira",
}

MANAGED_TYPES = ["Retirement", "Brokerage"]  # asset_types this pipeline owns


def plaid_client() -> plaid_api.PlaidApi:
    cfg = plaid.Configuration(
        host=_ENV_HOST.get(PLAID_ENV, plaid.Environment.Production),
        api_key={"clientId": PLAID_CLIENT_ID, "secret": PLAID_SECRET},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(cfg))


def today_et() -> str:
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/New_York")).date().isoformat()
    except Exception:
        return datetime.now(timezone.utc).date().isoformat()


def fetch_holdings(client):
    """/investments/holdings/get with retry while the product warms up."""
    req = InvestmentsHoldingsGetRequest(access_token=ACCESS_TOKEN)
    for attempt in range(8):
        try:
            return client.investments_holdings_get(req).to_dict()
        except ApiException as e:
            try:
                code = json.loads(e.body).get("error_code")
            except Exception:
                code = None
            if code in ("PRODUCT_NOT_READY", "PRODUCTS_NOT_READY") and attempt < 7:
                print(f"[plaid-inv] {code}, retrying in 15s...")
                time.sleep(15)
                continue
            raise
    raise RuntimeError("investments_holdings_get never became ready")


def classify(subtype) -> str:
    s = (subtype or "").strip().lower()
    return "Retirement" if s in RETIREMENT_SUBTYPES else "Brokerage"


def run():
    client = plaid_client()
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    snap = today_et()

    data = fetch_holdings(client)
    accounts = {a["account_id"]: a for a in data.get("accounts", [])}
    securities = {s["security_id"]: s for s in data.get("securities", [])}
    holdings = data.get("holdings", [])

    rows = []
    for h in holdings:
        acct = accounts.get(h.get("account_id"), {})
        sec = securities.get(h.get("security_id"), {})
        asset_type = classify(acct.get("subtype"))
        name = sec.get("ticker_symbol") or sec.get("name") or h.get("security_id")
        value = float(h.get("institution_value") or 0)
        price = float(h.get("institution_price") or 0)
        qty = float(h.get("quantity") or 0)
        cb = h.get("cost_basis")
        cost_basis = float(cb) if cb is not None else value  # neutral if unknown
        rows.append({
            "snapshot_date": snap,
            "asset_type": asset_type,
            "asset_name": str(name),
            "quantity": round(qty, 6),
            "price_per_unit": round(price, 6),
            "total_value": round(value, 2),
            "cost_basis": round(cost_basis, 2),
            "unrealized_gain_loss": round(value - cost_basis, 2),
        })

    # Balance fallback: an employer 401k via NetBenefits may return the account
    # balance with no per-fund holdings. Record that balance so the retirement
    # value is still captured.
    accts_with_holdings = {h.get("account_id") for h in holdings}
    for aid, acct in accounts.items():
        if aid in accts_with_holdings:
            continue
        cur = (acct.get("balances") or {}).get("current")
        if cur is None:
            continue
        value = float(cur)
        rows.append({
            "snapshot_date": snap,
            "asset_type": classify(acct.get("subtype")),
            "asset_name": (acct.get("name") or acct.get("official_name")
                           or "Account") + " (balance)",
            "quantity": 1,
            "price_per_unit": round(value, 2),
            "total_value": round(value, 2),
            "cost_basis": round(value, 2),
            "unrealized_gain_loss": 0,
        })

    if not rows:
        print(f"[plaid-inv] {snap}: no holdings or balance returned, leaving "
              f"existing data untouched")
        return

    # Idempotent daily refresh of only this pipeline's asset_types.
    sb.table("stocks_crypto_history").delete()\
        .eq("snapshot_date", snap)\
        .in_("asset_type", MANAGED_TYPES).execute()
    sb.table("stocks_crypto_history").insert(rows).execute()

    by_type = {}
    total = 0.0
    for r in rows:
        by_type[r["asset_type"]] = by_type.get(r["asset_type"], 0) + 1
        total += r["total_value"]
    print(f"[plaid-inv] {snap} wrote {len(rows)} holdings "
          f"({', '.join(f'{k}={v}' for k, v in by_type.items())}), "
          f"total_value={round(total, 2)}")


if __name__ == "__main__":
    run()
