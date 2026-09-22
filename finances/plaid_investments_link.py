#!/usr/bin/env python3
"""
One-time Plaid Link (Hosted Link) to connect Fidelity and obtain a long-lived
access token for the daily investments pull. Run this LOCALLY, once, AFTER
Fidelity shows Enabled at dashboard.plaid.com/activity/status/oauth-institutions.

    cd finances
    python plaid_investments_link.py

It prints a Plaid Hosted Link URL. Open it, choose Continue as guest, search
Fidelity, sign in, and select your retirement account(s). The script exchanges
the token and writes it to .plaid_investments_secrets.local (gitignored).

This is a SEPARATE Plaid item from Chase, with its own access token, requested
with the Investments product so holdings come through.
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

PLAID_CLIENT_ID = os.environ.get("PLAID_CLIENT_ID", "").strip()
PLAID_SECRET    = os.environ.get("PLAID_SECRET", "").strip()
PLAID_ENV       = os.environ.get("PLAID_ENV", "production").strip().lower()
CLIENT_USER_ID  = os.environ.get("PLAID_CLIENT_USER_ID", "fernando-personal").strip()

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
    req = LinkTokenCreateRequest(
        user=LinkTokenCreateRequestUser(client_user_id=CLIENT_USER_ID),
        client_name="Personal Finance",
        products=[Products("investments")],
        country_codes=[CountryCode("US")],
        language="en",
        hosted_link=LinkTokenCreateHostedLink(),
    )
    resp = c.link_token_create(req).to_dict()
    return resp["link_token"], resp["hosted_link_url"]


def poll_public_token(c, link_token, timeout_s=1800):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        time.sleep(5)
        g = c.link_token_get(LinkTokenGetRequest(link_token=link_token)).to_dict()
        for s in (g.get("link_sessions") or []):
            results = s.get("results") or {}
            for iar in (results.get("item_add_results") or []):
                if iar.get("public_token"):
                    return iar["public_token"]
        sys.stdout.write(".")
        sys.stdout.flush()
    sys.exit("\nTimed out waiting for the Link session to finish.")


def main():
    c = get_client()
    print(f"Plaid env: {PLAID_ENV}")

    link_token, url = create_hosted_link(c)
    print("\n" + "=" * 70)
    print("Open this URL, choose Continue as guest, connect Fidelity, finish:")
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
    print("\nLinked investment accounts:")
    for a in accts:
        print(f"  ...{a.get('mask') or '????'}  {a.get('name')}  "
              f"[{a.get('type')}/{a.get('subtype')}]")

    with open(".plaid_investments_secrets.local", "w") as f:
        f.write(f"PLAID_FIDELITY_ACCESS_TOKEN={access_token}\n"
                f"PLAID_FIDELITY_ITEM_ID={item_id}\n")

    print("\n" + "=" * 70)
    print("ADD THESE TO GITHUB REPO SECRETS (Settings > Secrets and variables >")
    print("Actions). Also saved to finances/.plaid_investments_secrets.local:")
    print("=" * 70)
    print(f"  PLAID_FIDELITY_ACCESS_TOKEN = {access_token}")
    print(f"  PLAID_FIDELITY_ITEM_ID      = {item_id}")
    print("=" * 70)
    print("Delete the local file once the secrets are in GitHub. Never commit it.")


if __name__ == "__main__":
    main()
