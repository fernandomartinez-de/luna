#!/usr/bin/env python3
import os
import json
from pathlib import Path
from plaid.api import plaid_api
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
import plaid
from dotenv import load_dotenv
import webbrowser

load_dotenv()

PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID')
PLAID_SECRET = os.getenv('PLAID_SECRET')
PLAID_ENV = os.getenv('PLAID_ENV', 'production')

env_hosts = {
    'development': 'https://development.plaid.com',
    'sandbox': 'https://sandbox.plaid.com',
    'production': 'https://production.plaid.com'
}

configuration = plaid.Configuration(
    host=env_hosts.get(PLAID_ENV, 'https://production.plaid.com'),
    api_key={'clientId': PLAID_CLIENT_ID, 'secret': PLAID_SECRET}
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)
TOKENS_FILE = Path(__file__).parent / "access_tokens.json"

def load_tokens():
    if TOKENS_FILE.exists():
        with open(TOKENS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_tokens(tokens):
    with open(TOKENS_FILE, 'w') as f:
        json.dump(tokens, f, indent=2)

def create_link_token():
    request = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Personal Finance Tracker",
        country_codes=[CountryCode('US')],
        language='en',
        user=LinkTokenCreateRequestUser(client_user_id='user-fernando-martinez')
    )
    response = client.link_token_create(request)
    return response['link_token']

def exchange_public_token(public_token, account_name):
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    access_token = response['access_token']
    item_id = response['item_id']
    tokens = load_tokens()
    tokens[account_name] = {'access_token': access_token, 'item_id': item_id}
    save_tokens(tokens)
    print(f"✅ Successfully linked {account_name}!")

def main():
    print("="*80)
    print("PLAID LINK - Connect Chase Accounts")
    print("="*80)
    tokens = load_tokens()
    if tokens:
        print(f"\nCurrently linked accounts: {len(tokens)}")
        for name in tokens.keys():
            print(f"  - {name}")
    print("\nWhich Chase account do you want to link?")
    print("  1. Chase Checking (6813)")
    print("  2. Chase Sapphire Preferred")
    print("  3. Chase Freedom Unlimited")
    print("  5. Exit")
    choice = input("\nEnter choice (1-5): ").strip()
    if choice == '5':
        return
    account_names = {'1': 'chase-checking-6813', '2': 'chase-sapphire-preferred', '3': 'chase-freedom-unlimited'}
    if choice not in account_names:
        print("Invalid choice")
        return
    print("\nCreating Plaid Link token...")
    link_token = create_link_token()
    link_url = f"https://cdn.plaid.com/link/v2/stable/link.html?isWebview=true&token={link_token}"
    account_name = account_names[choice]
    print(f"\n🔗 Opening browser to link {account_name}...")
    webbrowser.open(link_url)
    print("\n" + "="*80)
    public_token = input("Paste the public_token here: ").strip()
    if not public_token:
        print("No token provided.")
        return
    print(f"\nExchanging token for {account_name}...")
    exchange_public_token(public_token, account_name)
    print("\n✅ SUCCESS! Account linked.")
    print(f"Currently linked: {len(load_tokens())} of 3 accounts")

if __name__ == "__main__":
    main()