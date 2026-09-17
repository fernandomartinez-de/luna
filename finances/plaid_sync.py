#!/usr/bin/env python3
"""
Sync Chase transactions from Plaid to Supabase

Pulls up to 24 months of transactions from all linked Chase accounts
and loads them into the expense_transactions table with smart duplicate handling.
"""

import os
import json
from pathlib import Path
from datetime import datetime, timedelta
from plaid.api import plaid_api
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
import plaid
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID')
PLAID_SECRET = os.getenv('PLAID_SECRET')
PLAID_ENV = os.getenv('PLAID_ENV', 'development')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

env_hosts = {
    'development': 'https://development.plaid.com',
    'sandbox': 'https://sandbox.plaid.com',
    'production': 'https://production.plaid.com'
}

configuration = plaid.Configuration(
    host=env_hosts.get(PLAID_ENV, 'https://development.plaid.com'),
    api_key={'clientId': PLAID_CLIENT_ID, 'secret': PLAID_SECRET}
)

api_client = plaid.ApiClient(configuration)
plaid_client = plaid_api.PlaidApi(api_client)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TOKENS_FILE = Path(__file__).parent / "access_tokens.json"

def load_tokens():
    if not TOKENS_FILE.exists():
        print(" No access tokens found!")
        print("   Run plaid_link.py first to connect your Chase accounts.")
        return {}
    with open(TOKENS_FILE, 'r') as f:
        return json.load(f)

def fetch_transactions(access_token, account_name, months=24):
    start_date = (datetime.now() - timedelta(days=months*30)).date()
    end_date = datetime.now().date()
    print(f"\nFetching transactions for {account_name}...")
    print(f"  Date range: {start_date} to {end_date} ({months} months)")
    request = TransactionsGetRequest(
        access_token=access_token,
        start_date=start_date,
        end_date=end_date,
        options=TransactionsGetRequestOptions(count=500, offset=0)
    )
    response = plaid_client.transactions_get(request)
    transactions = response['transactions']
    while len(transactions) < response['total_transactions']:
        request = TransactionsGetRequest(
            access_token=access_token,
            start_date=start_date,
            end_date=end_date,
            options=TransactionsGetRequestOptions(count=500, offset=len(transactions))
        )
        response = plaid_client.transactions_get(request)
        transactions.extend(response['transactions'])
    print(f"   Found {len(transactions)} transactions")
    return transactions

def map_account_name(account_name):
    mapping = {
        'chase-checking-6813': 'Checking-6813',
        'chase-sapphire-preferred': 'Sapphire',
        'chase-freedom-unlimited': 'Freedom'
    }
    return mapping.get(account_name, account_name)

def load_to_supabase(transactions, account_name):
    if not transactions:
        print("  No transactions to load")
        return 0
    display_account = map_account_name(account_name)
    loaded = 0
    updated = 0
    skipped = 0
    for txn in transactions:
        transaction_date = str(txn['date'])
        month = transaction_date[:7]
        data = {
            'plaid_transaction_id': txn['transaction_id'],
            'transaction_date': transaction_date,
            'post_date': str(txn.get('authorized_date') or txn['date']),
            'description': txn['name'],
            'amount': -txn['amount'],
            'source': display_account,
            'month': month,
            'category': None
        }
        try:
            existing = supabase.table('expense_transactions').select('id').eq('plaid_transaction_id', txn['transaction_id']).execute()
            if existing.data:
                skipped += 1
            else:
                manual_match = supabase.table('expense_transactions').select('id').match({
                    'transaction_date': transaction_date,
                    'description': txn['name'],
                    'amount': -txn['amount'],
                    'source': display_account
                }).is_('plaid_transaction_id', 'null').execute()
                if manual_match.data:
                    supabase.table('expense_transactions').update({
                        'plaid_transaction_id': txn['transaction_id']
                    }).eq('id', manual_match.data[0]['id']).execute()
                    updated += 1
                else:
                    supabase.table('expense_transactions').insert(data).execute()
                    loaded += 1
        except Exception as e:
            print(f"    Error loading transaction: {txn['name']} - {e}")
    print(f"   Loaded {loaded} new transactions")
    if updated > 0:
        print(f"   Linked {updated} existing manual entries")
    if skipped > 0:
        print(f"    Skipped {skipped} duplicates")
    return loaded

def main():
    print("="*80)
    print("PLAID SYNC - Chase Transactions → Supabase")
    print("="*80)
    tokens = load_tokens()
    if not tokens:
        return
    print(f"\nLinked accounts: {len(tokens)}")
    for name in tokens.keys():
        print(f"  - {name}")
    total_loaded = 0
    for account_name, token_data in tokens.items():
        try:
            transactions = fetch_transactions(token_data['access_token'], account_name, months=24)
            loaded = load_to_supabase(transactions, account_name)
            total_loaded += loaded
        except Exception as e:
            print(f"   Error syncing {account_name}: {e}")
    print("\n" + "="*80)
    print(f"SYNC COMPLETE - {total_loaded} new transactions loaded")
    print("="*80)
    print("\nNext steps:")
    print("  1. Run categorization: SELECT refresh_dashboard_summary(); in Supabase SQL")
    print("  2. Open finances.html dashboard to view transactions")
    print("  3. Add category mapping rules in Supabase for any uncategorized merchants")

if __name__ == "__main__":
    main()