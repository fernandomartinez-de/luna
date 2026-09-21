#!/usr/bin/env python3
"""
One-time Plaid Link (Hosted Link) to connect Chase and obtain a long-lived
access token for the daily sync. Run this LOCALLY, once.

    cd finances
    cp .env.example .env          # fill in PLAID_CLIENT_ID / PLAID_SECRET
    pip install -r requirements.txt
    python plaid_link.py

It prints a Plaid Hosted Link URL. Open it, sign into Chase, and select the
three accounts (Total Checking ...6813, Freedom Unlimited ...5113, Sapphire
Preferred ...4433). The script waits for you to finish, exchanges the token,
records the (masked) account map in Supabase, and writes the access token to
.plaid_secrets.local (gitignored).

Hosted Link is used on purpose: Plaid manages the Chase OAuth redirect, so you
do not have to register a redirect URI of your own.

Then copy PLAID_ACCESS_TOKEN and PLAID_ITEM_ID into your GitHub repo secrets.
Nothing sensitive is committed. Only the last 4 digits of each account are
ever stored.
"""

import os
import sys
import time
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.link_token_create_hosted_link import LinkTokenCreateHostedLink
from plaid.model.link_token_get_request import LinkTokenGetRequest
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode

try:
    from plaid.model.link_token_transactions import LinkTokenTransactions
    _HAS_TXN = True
except Exception:
    _HAS_TXN = False


PLAID_CLIENT_ID = os.environ.get("PLAID_CLIENT_ID", "").strip()
PLAID_SECRET    = os.environ.get("PLAID_SECRET", "").strip()
PLAID_ENV       = os.environ.get("PLAID_ENV", "production").strip().lower()
CLIENT_USER_ID  = os.environ.get("PLAID_CLIENT_USER_ID", "fernando-personal").strip()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "").strip()

MASK_TO_SOURCE = {
    "6813": "checking",   # Chase Total Checking
    "5113": "cc_5113",    # Chase Freedom Unlimited
    "4433": "cc_4433",    # Chase Sapphire Preferred
}
_ENV_HOST = {
    "production": plaid.Environment.Production,
    "sandbox": plaid.Environment.Sandbox,
}


def get_client():
    if not PLAID_CLIENT_ID or not PLAID_SECRET:
        sys.exit("Set PLAID_CLIENT_ID and PLAID_SECRET (in .env or the environment).")
    cfg = plaid.Configuration(
        host=_ENV_HOST.get(PLAID_ENV, plaid.Environment.Production),
        api_key={"clientId": PLAID_CLIENT_ID, "secret": PLAID_SECRET},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(cfg))


def create_hosted_link(c):
    kwargs = dict(
        user=LinkTokenCreateRequestUser(client_user_id=CLIENT_USER_ID),
        client_name="Personal Finance",
        products=[Products("transactions")],
        country_codes=[CountryCode("US")],
        language="en",
        hosted_link=LinkTokenCreateHostedLink(),
    )
    if _HAS_TXN:
        kwargs["transactions"] = LinkTokenTransactions(days_requested=90)
    resp = c.link_token_create(LinkTokenCreateRequest(**kwargs)).to_dict()
    return resp["link_token"], resp["hosted_link_url"]


def poll_public_token(c, link_token, timeout_s=1800):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        time.sleep(5)
        g = c.link_token_get(LinkTokenGetRequest(link_token=link_token)).to_dict()
        for s in (g.get("link_sessions") or []):
            results = s.get("results") or {}
            for iar in (results.get("item_add_results") or []):
                pt = iar.get("public_token")
                if pt:
                    return pt
        sys.stdout.write(".")
        sys.stdout.flush()
    sys.exit("\nTimed out waiting for the Link session to finish.")


def main():
    c = get_client()
    print(f"Plaid env: {PLAID_ENV}")

    link_token, url = create_hosted_link(c)
    print("\n" + "=" * 70)
    print("Open this URL, sign into Chase, finish, then come back here:")
    print("=" * 70)
    print("\n  " + url + "\n")
    print("Waiting for you to finish", end="")

    public_token = poll_public_token(c, link_token)
    print("\n\nLink complete. Exchanging token...")

    ex = c.item_public_token_exchange(
        ItemPublicTokenExchangeRequest(public_token=public_token)
    ).to_dict()
    access_token = ex["access_token"]
    item_id = ex["item_id"]

    accts = c.accounts_get(
        AccountsGetRequest(access_token=access_token)
    ).to_dict()["accounts"]

    print("\nLinked accounts:")
    for a in accts:
        mask = a.get("mask") or "????"
        src = MASK_TO_SOURCE.get(mask, "UNMAPPED")
        print(f"  ...{mask}  {a.get('name')}  ->  source '{src}'")
    unmapped = [a.get("mask") for a in accts
                if MASK_TO_SOURCE.get(a.get("mask") or "") is None]
    if unmapped:
        print(f"\n  NOTE: masks {unmapped} are not in MASK_TO_SOURCE and will be")
        print("  ignored by the sync. Add them in plaid_sync.py to track them.")

    # Best-effort: record masked account map + init cursor state.
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            now = datetime.now(timezone.utc).isoformat()
            rows = [{
                "account_id": a["account_id"],
                "item_id": item_id,
                "name": a.get("name"),
                "official_name": a.get("official_name"),
                "mask": a.get("mask"),
                "type": str(a["type"]) if a.get("type") is not None else None,
                "subtype": str(a["subtype"]) if a.get("subtype") is not None else None,
                "source_code": MASK_TO_SOURCE.get(a.get("mask") or ""),
                "updated_at": now,
            } for a in accts]
            sb.table("plaid_accounts").upsert(rows, on_conflict="account_id").execute()
            sb.table("plaid_sync_state").upsert({
                "item_id": item_id,
                "cursor": None,
                "institution_name": "Chase",
            }, on_conflict="item_id").execute()
            print("\nSaved masked account map + sync state to Supabase.")
        except Exception as e:
            print(f"\n(!) Could not write to Supabase now ({e}).")
            print("    The daily sync self-heals the account map on its first run.")
    else:
        print("\n(SUPABASE_URL/SUPABASE_KEY not set locally; the daily sync will")
        print(" populate the account map on its first run.)")

    with open(".plaid_secrets.local", "w") as f:
        f.write(f"PLAID_ACCESS_TOKEN={access_token}\nPLAID_ITEM_ID={item_id}\n")

    print("\n" + "=" * 70)
    print("ADD THESE TO GITHUB REPO SECRETS (Settings > Secrets and variables >")
    print("Actions). They are also in finances/.plaid_secrets.local (gitignored):")
    print("=" * 70)
    print(f"  PLAID_ACCESS_TOKEN = {access_token}")
    print(f"  PLAID_ITEM_ID      = {item_id}")
    print("=" * 70)
    print("Delete .plaid_secrets.local once the secrets are in GitHub. Never commit it.")


if __name__ == "__main__":
    main()
