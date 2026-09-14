#!/usr/bin/env python3
"""
Upload real estate history from CSV to Supabase.

Reads redfin_equity_mortgage.csv and inserts into real_estate_history table.

Usage:
    python upload_real_estate_history.py

Environment variables required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_KEY - Your Supabase service role key (or anon key)
"""

import os
import sys
import csv
from datetime import datetime
from supabase import create_client, Client

def main():
    # Get Supabase credentials
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY')

    if not url or not key:
        print("ERROR: Missing environment variables")
        print("Please set SUPABASE_URL and SUPABASE_KEY")
        sys.exit(1)

    # Connect to Supabase
    print(f"Connecting to Supabase...")
    supabase: Client = create_client(url, key)

    # Read CSV file
    csv_file = 'redfin_equity_mortgage.csv'
    if not os.path.exists(csv_file):
        print(f"ERROR: {csv_file} not found")
        sys.exit(1)

    print(f"Reading {csv_file}...")
    rows_to_insert = []

    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            snapshot_date = row['snapshot_date']
            home_value = float(row['home_value'])
            equity = float(row['home_equity'])
            mortgage = float(row['mortgage_balance'])

            # Condo data
            condo_data = {
                'snapshot_date': snapshot_date,
                'asset_name': 'Condo',
                'asset_type': 'Real Estate',
                'home_value': home_value,
                'mortgage_balance': mortgage,
                'net_equity': equity,
                'cost_basis': 895000,
                'unrealized_gain_loss': home_value - 895000,
                'location': '66 S 6th St, Williamsburg, Brooklyn, NY'
            }
            rows_to_insert.append(condo_data)

            # Storage Unit data (constant value)
            storage_data = {
                'snapshot_date': snapshot_date,
                'asset_name': 'Storage Unit',
                'asset_type': 'Real Estate',
                'home_value': 15000,
                'mortgage_balance': 0,
                'net_equity': 15000,
                'cost_basis': 15000,
                'unrealized_gain_loss': 0,
                'location': '66 S 6th St Unit 4A, Brooklyn, NY'
            }
            rows_to_insert.append(storage_data)

    print(f"Prepared {len(rows_to_insert)} rows to insert")

    # Insert into Supabase
    print("Uploading to Supabase...")
    try:
        response = supabase.table('real_estate_history').upsert(rows_to_insert).execute()
        print(f"✓ Successfully uploaded {len(rows_to_insert)} rows")
        print(f"\nSummary:")
        print(f"  Months: 13")
        print(f"  Assets: 2 (Condo + Storage Unit)")
        print(f"  Total rows: {len(rows_to_insert)}")
        print(f"\nLatest values:")
        print(f"  Condo: ${rows_to_insert[-2]['home_value']:,.0f}")
        print(f"  Net Equity: ${rows_to_insert[-2]['net_equity']:,.0f}")
        print(f"  Mortgage: ${rows_to_insert[-2]['mortgage_balance']:,.0f}")

    except Exception as e:
        print(f"ERROR uploading to Supabase: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
