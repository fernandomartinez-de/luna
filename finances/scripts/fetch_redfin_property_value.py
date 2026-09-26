#!/usr/bin/env python3
"""
Fetch property value from Redfin and update Supabase real_estate_history table.

Usage:
    python fetch_redfin_property_value.py

Environment Variables:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_KEY - Your Supabase anon/service key

Author: Fernando Martinez
Created: 2026-09-14
"""

import os
import sys
from datetime import date
from decimal import Decimal
import re

# Try importing required libraries
try:
    import requests
    from bs4 import BeautifulSoup
    from supabase import create_client, Client
except ImportError as e:
    print(f"ERROR: Required libraries not installed: {e}")
    print("Install with: pip install requests beautifulsoup4 supabase")
    sys.exit(1)

# Configuration
# Using public listing page (no authentication required)
REDFIN_URL = "https://www.redfin.com/NY/Brooklyn/66-S-6th-St-11249/unit-4A/home/196193525"
# For owner dashboard (requires cookie): https://www.redfin.com/myredfin/owner-dashboard/36948925
PROPERTY_NAME = "66 S 6th St, Unit 4A, Brooklyn, NY"
ASSET_TYPE = "Condo"
COST_BASIS = Decimal("895000.00")  # Original purchase price (April 2025)

# Mortgage details for equity calculation
# You can update this manually or fetch from Chase mortgage statements
INITIAL_MORTGAGE = Decimal("475000.00")  # Initial loan amount
MONTHLY_PAYMENT_TO_PRINCIPAL = Decimal("798.00")  # Approximate principal per month (6.49% rate)
MORTGAGE_START_DATE = date(2025, 4, 1)  # April 2025 closing


def get_current_mortgage_balance():
    """
    Calculate current mortgage balance.

    Simple calculation: Initial - (months elapsed * monthly principal)
    For more accuracy, integrate with amortization schedule or parse Chase statements.
    """
    today = date.today()
    months_elapsed = (today.year - MORTGAGE_START_DATE.year) * 12 + (today.month - MORTGAGE_START_DATE.month)

    principal_paid = MONTHLY_PAYMENT_TO_PRINCIPAL * months_elapsed
    current_balance = INITIAL_MORTGAGE - principal_paid

    return max(current_balance, Decimal("0.00"))  # Don't go negative


def fetch_redfin_home_value(url):
    """
    Scrape Redfin page for estimated home value.

    NOTE: The owner dashboard requires authentication. This script uses session cookies
    to access the dashboard. You need to:
    1. Log in to Redfin in your browser
    2. Copy the session cookie
    3. Set REDFIN_COOKIE environment variable

    Returns:
        Decimal: Estimated home value, or None if not found
    """
    try:
        # Check for session cookie (required for owner dashboard)
        redfin_cookie = os.getenv('REDFIN_COOKIE')

        # Use headers to mimic a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }

        cookies = {}
        if redfin_cookie:
            # Parse cookie string if provided
            cookies = {'RF_AUTH': redfin_cookie}
            print("  Using authentication cookie")
        else:
            print("  [!] No REDFIN_COOKIE set - may not work for owner dashboard")

        print(f"Fetching: {url}")
        response = requests.get(url, headers=headers, cookies=cookies, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Try multiple selectors - Redfin's HTML structure
        # Look for "Redfin Estimate" or similar pricing elements

        # Method 1: Look for meta tags (often has property value)
        og_price = soup.find('meta', property='og:price:amount')
        if og_price and og_price.get('content'):
            value = Decimal(og_price['content'])
            print(f"  [OK] Found value in meta tag: ${value:,.2f}")
            return value

        # Method 2: Look for price in specific divs or spans
        # Owner dashboard specific selectors + fallback to public page selectors
        price_selectors = [
            {'class': 'estimate-value'},  # Owner dashboard estimate
            {'data-rf-test-id': 'owner-estimate-value'},  # Owner dashboard
            {'class': 'home-estimate'},  # Owner dashboard
            {'class': 'statsValue'},  # Common Redfin class (public page)
            {'data-rf-test-id': 'abp-price'},  # Public page
            {'class': 'home-main-stats-price'},  # Public page
            {'class': 'price'}  # Generic fallback
        ]

        for selector in price_selectors:
            price_elem = soup.find('div', selector) or soup.find('span', selector)
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                # Extract numbers from text like "$1,242,410" or "$1.24M"
                price_match = re.search(r'[\$]?([\d,]+)', price_text)
                if price_match:
                    value_str = price_match.group(1).replace(',', '')
                    value = Decimal(value_str)
                    print(f"  [OK] Found value with selector {selector}: ${value:,.2f}")
                    return value

        # Method 3: Search for any text containing "$" and numbers
        all_text = soup.get_text()
        estimate_match = re.search(r'Redfin Estimate[:\s]+\$?([\d,]+)', all_text, re.IGNORECASE)
        if estimate_match:
            value_str = estimate_match.group(1).replace(',', '')
            value = Decimal(value_str)
            print(f"  [OK] Found Redfin Estimate in text: ${value:,.2f}")
            return value

        print("  [X] Could not find home value on page")
        print("  -> You may need to inspect the HTML and update the selectors")
        return None

    except requests.RequestException as e:
        print(f"  [X] Network error fetching Redfin page: {e}")
        return None
    except Exception as e:
        print(f"  [X] Error parsing Redfin page: {e}")
        return None


def update_supabase(snapshot_date, home_value, mortgage_balance):
    """
    Insert new snapshot into Supabase real_estate_history table.

    Returns:
        bool: True if successful, False otherwise
    """
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')

    if not supabase_url or not supabase_key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY environment variables not set")
        print("\nSet them with:")
        print('  [System.Environment]::SetEnvironmentVariable(\'SUPABASE_URL\', \'https://uuvsvtpfcexhqojlrsxy.supabase.co\', \'User\')')
        print('  [System.Environment]::SetEnvironmentVariable(\'SUPABASE_KEY\', \'your_key_here\', \'User\')')
        return False

    try:
        print(f"\nConnecting to Supabase...")
        supabase: Client = create_client(supabase_url, supabase_key)

        # Check if snapshot for this date and source already exists
        existing = supabase.table('real_estate_history').select('*').eq('snapshot_date', str(snapshot_date)).eq('asset_name', PROPERTY_NAME).eq('data_source', 'Redfin').execute()

        # Calculate equity and gain/loss
        net_equity = float(home_value) - float(mortgage_balance)
        unrealized_gain_loss = float(home_value) - float(COST_BASIS)

        if existing.data and len(existing.data) > 0:
            record = existing.data[0]
            print(f"  [!] Snapshot for {snapshot_date} already exists:")
            print(f"    Previous value: ${float(record['home_value']):,.2f}, equity: ${float(record['net_equity']):,.2f}")
            print(f"    New value: ${home_value:,.2f}, new equity: ${net_equity:,.2f}")

            response = input("  Update existing record? (y/n): ").strip().lower()
            if response != 'y':
                print("  Skipping update.")
                return False

            # Update existing record with calculated values
            update_data = {
                'home_value': float(home_value),
                'mortgage_balance': float(mortgage_balance),
                'net_equity': net_equity,
                'unrealized_gain_loss': unrealized_gain_loss
            }
            supabase.table('real_estate_history').update(update_data).eq('id', record['id']).execute()
            print(f"  [OK] Updated snapshot for {snapshot_date}")
        else:
            # Insert new record with calculated values
            insert_data = {
                'snapshot_date': str(snapshot_date),
                'asset_name': PROPERTY_NAME,
                'asset_type': ASSET_TYPE,
                'home_value': float(home_value),
                'mortgage_balance': float(mortgage_balance),
                'net_equity': net_equity,
                'cost_basis': float(COST_BASIS),
                'unrealized_gain_loss': unrealized_gain_loss,
                'data_source': 'Redfin'
            }
            result = supabase.table('real_estate_history').insert(insert_data).execute()
            print(f"  [OK] Inserted new snapshot for {snapshot_date}")

        # Display summary (use already calculated values)
        gain_loss_pct = (unrealized_gain_loss / float(COST_BASIS) * 100) if COST_BASIS else 0

        print(f"\n Property Snapshot Summary:")
        print(f"  Date:               {snapshot_date}")
        print(f"  Home Value:         ${home_value:,.2f}")
        print(f"  Mortgage Balance:   ${mortgage_balance:,.2f}")
        print(f"  Net Equity:         ${net_equity:,.2f}")
        print(f"  Cost Basis:         ${COST_BASIS:,.2f}")
        print(f"  Unrealized G/L:     ${unrealized_gain_loss:,.2f} ({gain_loss_pct:+.2f}%)")

        return True

    except Exception as e:
        print(f"  [X] Unexpected error: {e}")
        return False


def main():
    """Main execution function."""
    print("=" * 70)
    print("Redfin Property Value Fetcher")
    print("=" * 70)

    today = date.today()

    # Step 1: Fetch home value from Redfin
    print("\n[1/3] Fetching property value from Redfin...")
    home_value = fetch_redfin_home_value(REDFIN_URL)

    if not home_value:
        print("\n[FAILED] Failed to fetch home value from Redfin.")
        print("\nTroubleshooting:")
        print("  1. Check if Redfin URL is still valid")
        print("  2. Verify network connection")
        print("  3. Inspect Redfin page HTML and update selectors in script")
        sys.exit(1)

    # Step 2: Calculate current mortgage balance
    print("\n[2/3] Calculating mortgage balance...")
    mortgage_balance = get_current_mortgage_balance()
    print(f"  Estimated balance: ${mortgage_balance:,.2f}")
    print(f"  (Based on {MONTHLY_PAYMENT_TO_PRINCIPAL}/month since {MORTGAGE_START_DATE})")

    # Step 3: Update Supabase
    print("\n[3/3] Updating Supabase...")
    success = update_supabase(today, home_value, mortgage_balance)

    if success:
        print("\n[SUCCESS] SUCCESS: Property value updated in Supabase!")
        print(f"\nView in dashboard: finances.html -> Investments tab -> Real Estate card")
    else:
        print("\n[FAILED] FAILED: Could not update Supabase")
        sys.exit(1)


if __name__ == "__main__":
    main()
