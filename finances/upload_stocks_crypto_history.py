#!/usr/bin/env python3
"""
Upload stocks and crypto historical data to Supabase.

This script reads stocks_crypto_history.csv and uploads it to the
stocks_crypto_history table in Supabase.
"""

import csv
import os
from datetime import datetime
from supabase import create_client, Client

def load_csv_data(filename):
    """Load CSV file and return list of dictionaries."""
    rows = []
    with open(filename, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                'snapshot_date': row['snapshot_date'],
                'asset_type': row['asset_type'],
                'asset_name': row['asset_name'],
                'quantity': float(row['quantity']),
                'price_per_unit': float(row['price_per_unit']),
                'total_value': float(row['total_value']),
                'cost_basis': float(row['cost_basis']),
                'unrealized_gain_loss': float(row['unrealized_gain_loss'])
            })
    return rows

def main():
    # Get Supabase credentials from environment
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY')

    if not url or not key:
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set")
        print("\nSet them with:")
        print('  $env:SUPABASE_URL = "your-url"')
        print('  $env:SUPABASE_KEY = "your-key"')
        return

    # Create Supabase client
    supabase: Client = create_client(url, key)

    # Load CSV data
    csv_file = 'full_history.csv'
    print(f"Loading {csv_file}...")
    rows = load_csv_data(csv_file)
    print(f"✓ Loaded {len(rows)} rows")

    # Upload to Supabase (upsert to handle duplicates)
    print(f"\nUploading to Supabase...")
    try:
        response = supabase.table('stocks_crypto_history').upsert(rows).execute()
        print(f"✓ Successfully uploaded {len(rows)} rows!")

        # Show summary
        stocks = [r for r in rows if r['asset_type'] == 'Stock']
        crypto = [r for r in rows if r['asset_type'] == 'Crypto']

        print(f"\nSummary:")
        print(f"  Stock snapshots: {len(stocks)} ({len(stocks)//13} stocks × 13 months)")
        print(f"  Crypto snapshots: {len(crypto)} (1 crypto × 13 months)")
        print(f"\nDate range: {rows[0]['snapshot_date']} to {rows[-1]['snapshot_date']}")

    except Exception as e:
        print(f"❌ Error uploading: {e}")
        return

if __name__ == '__main__':
    main()
