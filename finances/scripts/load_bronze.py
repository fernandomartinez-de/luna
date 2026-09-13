#!/usr/bin/env python3
r"""
Load bank statements from Bronze (Excel files) → Silver (expense_transactions)

Bronze Layer: C:\Users\fmartine\Downloads\chase-bronce\*.xlsx
Silver Layer: expense_transactions table in Supabase
Gold Layer: Dashboard views

This script:
1. Reads raw Excel files from chase-bronce folder
2. Applies categorization and standardization rules
3. Loads into expense_transactions table (deduplicates automatically)
"""

import argparse
import os
import sys
from datetime import datetime
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Bronze folder in repo
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRONZE_FOLDER = os.path.join(REPO_ROOT, 'data', 'bronze')


def parse_checking_account(file_path):
    """Parse Chase checking account statement"""
    print(f"Reading checking account: {file_path}")
    df = pd.read_excel(file_path)

    # Rename columns
    df = df.rename(columns={
        'Posting Date': 'transaction_date',
        'Description': 'description',
        'Amount': 'amount'
    })

    # Parse dates
    df['transaction_date'] = pd.to_datetime(df['transaction_date'])
    df['post_date'] = df['transaction_date']
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce')

    # Add source and empty chase_category (checking doesn't have categories)
    df['source'] = 'checking'
    df['chase_category'] = None

    # Filter to only transactions with amounts
    df = df[df['amount'].notna()]

    cols = ['transaction_date', 'post_date', 'description', 'chase_category', 'amount', 'source']
    return df[cols]


def parse_credit_card(file_path, card_name):
    """Parse Chase credit card statement"""
    print(f"Reading credit card {card_name}: {file_path}")
    df = pd.read_excel(file_path)

    # Rename columns
    df = df.rename(columns={
        'Transaction Date': 'transaction_date',
        'Post Date': 'post_date',
        'Description': 'description',
        'Category': 'chase_category',
        'Amount': 'amount'
    })

    # Parse dates
    df['transaction_date'] = pd.to_datetime(df['transaction_date'])
    df['post_date'] = pd.to_datetime(df['post_date'])
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce')

    # Only keep "Sale" transactions (not payments)
    if 'Type' in df.columns:
        df = df[df['Type'] == 'Sale']

    # Add source
    df['source'] = card_name

    # Filter to only transactions with amounts
    df = df[df['amount'].notna()]

    cols = ['transaction_date', 'post_date', 'description', 'chase_category', 'amount', 'source']
    return df[cols]


# Chase Category → Our Category mapping
CHASE_CATEGORY_MAP = {
    'Food & Drink': 'Dining',
    'Shopping': 'Shopping',
    'Travel': 'Travel',
    'Groceries': 'Groceries',
    'Fees & Adjustments': 'Fees & Adjustments',
    'Health & Wellness': 'Miscellaneous',
    'Entertainment': 'Entertainment',
    'Bills & Utilities': 'Bills & Utilities',
    'Home': 'Shopping',
    'Personal': 'Miscellaneous',
    'Gifts & Donations': 'Gifts & Donations',
    'Professional Services': 'Professional Services',
}


def apply_rules_to_dataframe(df):
    """Apply categorization and standardization rules to DataFrame"""
    print("\nApplying categorization and standardization rules...")

    # Add category column by calling Supabase function
    categories = []
    standardized_descriptions = []

    for _, row in df.iterrows():
        # Step 1: Try database pattern mapping first (highest priority patterns)
        try:
            cat_result = supabase.rpc('apply_category_mapping', {'transaction_desc': row['description']}).execute()
            category = cat_result.data if cat_result.data else None
        except:
            category = None

        # Step 2: If no database match, try Chase's own category
        if not category and pd.notna(row.get('chase_category')) and row['chase_category'] in CHASE_CATEGORY_MAP:
            category = CHASE_CATEGORY_MAP[row['chase_category']]

        # Step 3: Fall back to old pattern matching (legacy)
        if not category:
            try:
                cat_result = supabase.rpc('apply_categorization_rules', {'transaction_desc': row['description']}).execute()
                category = cat_result.data if cat_result.data else 'Miscellaneous'
            except:
                category = 'Miscellaneous'

        categories.append(category)

        # Apply standardization
        try:
            std_result = supabase.rpc('standardize_description', {'transaction_desc': row['description']}).execute()
            std_desc = std_result.data if std_result.data else row['description']
        except:
            std_desc = row['description']

        standardized_descriptions.append(std_desc)

    df['category'] = categories
    df['description'] = standardized_descriptions

    return df


def add_month_column(df):
    """Add month column (YYYY-MM format)"""
    df['month'] = df['transaction_date'].dt.to_period('M').astype(str)
    return df


def upload_to_silver(df):
    """Upload transactions to expense_transactions table (Silver layer)"""
    print(f"\nUploading {len(df)} transactions to Silver layer...")

    # Filter out rows with NaN amounts or dates
    original_count = len(df)
    df = df[df['amount'].notna() & df['transaction_date'].notna()].copy()
    print(f"Filtered to {len(df)} valid transactions (removed {original_count - len(df)} with missing data)")

    # Remove duplicates based on unique constraint
    df = df.drop_duplicates(subset=['transaction_date', 'description', 'amount', 'source'], keep='first')
    print(f"Removed duplicates, {len(df)} unique transactions remaining")

    # Drop chase_category column (not in expense_transactions table)
    if 'chase_category' in df.columns:
        df = df.drop(columns=['chase_category'])

    # Convert to dict records
    records = df.to_dict('records')

    # Convert dates to strings for JSON serialization
    for record in records:
        record['transaction_date'] = record['transaction_date'].strftime('%Y-%m-%d')
        record['post_date'] = record['post_date'].strftime('%Y-%m-%d') if pd.notna(record['post_date']) else None
        record['amount'] = float(record['amount'])
        record['category'] = record['category'] if pd.notna(record['category']) else None
        record['description'] = str(record['description']) if pd.notna(record['description']) else ""

    # Upload in batches
    batch_size = 100
    uploaded = 0
    skipped = 0

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            response = supabase.table('expense_transactions').upsert(
                batch,
                on_conflict='transaction_date,description,amount,source'
            ).execute()
            uploaded += len(batch)
            print(f"  Uploaded batch {i // batch_size + 1}: {len(batch)} records")
        except Exception as e:
            print(f"  Error uploading batch {i // batch_size + 1}: {e}")
            skipped += len(batch)

    print(f"\n✓ Upload complete: {uploaded} uploaded, {skipped} skipped")
    return uploaded, skipped


def main():
    parser = argparse.ArgumentParser(description='Load bank statements from Bronze → Silver')
    parser.add_argument('--bronze-folder', default=BRONZE_FOLDER, help=f'Bronze folder with Excel files (default: {BRONZE_FOLDER})')
    parser.add_argument('--checking', help='Checking account Excel file (overrides auto-detection)')
    parser.add_argument('--cc1', help='Credit card 1 Excel file (4433) (overrides auto-detection)')
    parser.add_argument('--cc2', help='Credit card 2 Excel file (5113) (overrides auto-detection)')

    args = parser.parse_args()

    # Auto-detect files in bronze folder if not specified
    if not args.checking or not args.cc1 or not args.cc2:
        if not os.path.exists(args.bronze_folder):
            print(f"ERROR: Bronze folder not found: {args.bronze_folder}")
            sys.exit(1)

        excel_files = [f for f in os.listdir(args.bronze_folder) if f.endswith('.xlsx')]
        print(f"\nFound {len(excel_files)} Excel files in {args.bronze_folder}:")
        for f in excel_files:
            print(f"  - {f}")

        # Try to auto-detect files
        checking_file = args.checking or next((f for f in excel_files if 'checking' in f.lower()), None)
        cc1_file = args.cc1 or next((f for f in excel_files if '4433' in f), None)
        cc2_file = args.cc2 or next((f for f in excel_files if '5113' in f), None)

        if not all([checking_file, cc1_file, cc2_file]):
            print("\nERROR: Could not auto-detect all files. Please specify:")
            print("  --checking <file>")
            print("  --cc1 <file>")
            print("  --cc2 <file>")
            sys.exit(1)

        args.checking = os.path.join(args.bronze_folder, checking_file)
        args.cc1 = os.path.join(args.bronze_folder, cc1_file)
        args.cc2 = os.path.join(args.bronze_folder, cc2_file)

    # Validate files exist
    for file_path in [args.checking, args.cc1, args.cc2]:
        if not os.path.exists(file_path):
            print(f"ERROR: File not found: {file_path}")
            sys.exit(1)

    print("\n" + "="*80)
    print("BRONZE → SILVER TRANSFORMATION")
    print("="*80)
    print(f"Bronze: {args.bronze_folder}")
    print(f"Silver: expense_transactions table")
    print("="*80)

    # Parse all files
    df_checking = parse_checking_account(args.checking)
    df_cc1 = parse_credit_card(args.cc1, 'cc_4433')
    df_cc2 = parse_credit_card(args.cc2, 'cc_5113')

    # Combine all transactions
    df_all = pd.concat([df_checking, df_cc1, df_cc2], ignore_index=True)

    print(f"\nTotal transactions parsed: {len(df_all)}")
    print(f"  Checking: {len(df_checking)}")
    print(f"  Credit card 4433: {len(df_cc1)}")
    print(f"  Credit card 5113: {len(df_cc2)}")

    # Apply rules
    df_all = apply_rules_to_dataframe(df_all)
    df_all = add_month_column(df_all)

    # Show category breakdown
    print("\nCategory breakdown:")
    category_counts = df_all['category'].value_counts()
    for category, count in category_counts.items():
        print(f"  {category}: {count} transactions")

    # Show date range
    print(f"\nDate range: {df_all['transaction_date'].min()} to {df_all['transaction_date'].max()}")

    # Upload to Silver
    uploaded, skipped = upload_to_silver(df_all)

    print("\n" + "="*80)
    print("COMPLETE")
    print("="*80)
    print(f"✓ {uploaded} transactions loaded into Silver layer")
    print(f"✓ Dashboard will auto-refresh on next load")
    print("\nNext steps:")
    print("  1. Review dashboard: http://localhost:8000/finances.html")
    print("  2. Check Miscellaneous: SELECT * FROM expense_transactions WHERE category = 'Miscellaneous'")
    print("  3. Add rules: INSERT INTO categorization_rules (...)")


if __name__ == '__main__':
    main()
