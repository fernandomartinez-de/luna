#!/usr/bin/env python3
"""
Fetch property value from Zillow Zestimate and update Supabase real_estate_history table.

Usage:
    python fetch_zillow_property_value.py

Environment Variables:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_KEY - Your Supabase anon/service key
    ZILLOW_API_KEY - (Optional) RapidAPI key for Zillow API access

Author: Fernando Martinez
Created: 2026-09-17
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
PROPERTY_ADDRESS = "66-S-6th-St-Brooklyn-NY-11249"  # Zillow URL format
ZILLOW_URL = f"https://www.zillow.com/homedetails/66-S-6th-St-4A-Brooklyn-NY-11249/444738887_zpid/"
PROPERTY_ZPID = "444738887"  # Zillow Property ID (from URL)
PROPERTY_NAME = "66 S 6th St, Unit 4A, Brooklyn, NY"
ASSET_TYPE = "Condo"
COST_BASIS = Decimal("895000.00")  # Original purchase price (April 2025)

# Mortgage details for equity calculation
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


def fetch_zillow_via_api(zpid):
    """
    Fetch Zillow Zestimate via RapidAPI.

    Requires ZILLOW_API_KEY environment variable set to your RapidAPI key.
    Sign up at: https://rapidapi.com/apimaker/api/zillow-com1

    Args:
        zpid: Zillow Property ID

    Returns:
        Decimal: Estimated home value, or None if not found
    """
    api_key = os.getenv('ZILLOW_API_KEY')

    if not api_key:
        print("  [INFO] No ZILLOW_API_KEY found - will try web scraping instead")
        return None

    try:
        url = "https://zillow-scraper-1000-free-calls.p.rapidapi.com/properties/detail"

        querystring = {"property_id": zpid}

        headers = {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": "zillow-scraper-1000-free-calls.p.rapidapi.com"
        }

        print(f"  Calling Zillow API for ZPID {zpid}...")
        response = requests.get(url, headers=headers, params=querystring, timeout=30)
        response.raise_for_status()

        data = response.json()

        # Extract Zestimate from API response
        # API returns: { "zpid": "...", "zestimate": 1234567, "price": 1234567, ... }
        zestimate = data.get('zestimate')

        # Fallback to price if zestimate not available
        if not zestimate:
            zestimate = data.get('price')

        if zestimate:
            value = Decimal(str(zestimate))
            print(f"  [OK] Found Zestimate via API: ${value:,.2f}")
            return value

        print("  [X] No Zestimate found in API response")
        print(f"  [X] Response keys: {list(data.keys())}")
        return None

    except requests.RequestException as e:
        print(f"  [X] API request failed: {e}")
        return None
    except Exception as e:
        print(f"  [X] Error parsing API response: {e}")
        return None


def fetch_zillow_via_scraping(url):
    """
    Scrape Zillow property page for Zestimate.

    Fallback method when API is not available.

    Args:
        url: Zillow property page URL

    Returns:
        Decimal: Estimated home value, or None if not found
    """
    try:
        # Use headers to mimic a real browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }

        print(f"  Fetching: {url}")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Method 1: Look for structured data (JSON-LD)
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_ld_scripts:
            try:
                import json
                data = json.loads(script.string)

                # Look for price in structured data
                if isinstance(data, dict):
                    price = data.get('price') or data.get('offers', {}).get('price')
                    if price:
                        value = Decimal(str(price))
                        print(f"  [OK] Found price in JSON-LD: ${value:,.2f}")
                        return value
            except:
                continue

        # Method 2: Look for Zestimate in specific elements
        # Zillow uses data-testid attributes
        price_selectors = [
            {'data-testid': 'zestimate-value'},
            {'data-testid': 'zestimate-text'},
            {'data-testid': 'price'},
            {'class': 'summary-price'},
            {'class': 'zestimate-value'}
        ]

        for selector in price_selectors:
            price_elem = soup.find('span', selector) or soup.find('div', selector)
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                # Extract numbers from text like "$1,019,300" or "$1.02M"
                price_match = re.search(r'[\$]?([\d,]+)', price_text)
                if price_match:
                    value_str = price_match.group(1).replace(',', '')
                    value = Decimal(value_str)
                    print(f"  [OK] Found Zestimate with selector {selector}: ${value:,.2f}")
                    return value

        # Method 3: Search page text for "Zestimate"
        all_text = soup.get_text()
        zestimate_match = re.search(r'Zestimate[®]?[:\s]+\$?([\d,]+)', all_text, re.IGNORECASE)
        if zestimate_match:
            value_str = zestimate_match.group(1).replace(',', '')
            value = Decimal(value_str)
            print(f"  [OK] Found Zestimate in page text: ${value:,.2f}")
            return value

        print("  [X] Could not find Zestimate on page")
        print("  -> You may need to inspect the HTML and update the selectors")
        return None

    except requests.RequestException as e:
        print(f"  [X] Network error fetching Zillow page: {e}")
        return None
    except Exception as e:
        print(f"  [X] Error parsing Zillow page: {e}")
        return None


def fetch_zillow_zestimate():
    """
    Fetch Zillow Zestimate using API first, falling back to scraping.

    Returns:
        Decimal: Estimated home value, or None if not found
    """
    print("\n[1/3] Fetching property value from Zillow...")

    # Try API first (faster, more reliable)
    value = fetch_zillow_via_api(PROPERTY_ZPID)

    # Fall back to web scraping if API fails
    if not value:
        print("  Trying web scraping method...")
        value = fetch_zillow_via_scraping(ZILLOW_URL)

    return value


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
        existing = supabase.table('real_estate_history').select('*').eq('snapshot_date', str(snapshot_date)).eq('asset_name', PROPERTY_NAME).eq('data_source', 'Zillow').execute()

        # Calculate equity and gain/loss
        net_equity = float(home_value) - float(mortgage_balance)
        unrealized_gain_loss = float(home_value) - float(COST_BASIS)

        if existing.data and len(existing.data) > 0:
            record = existing.data[0]
            print(f"  [!] Zillow snapshot for {snapshot_date} already exists:")
            print(f"    Previous value: ${float(record['home_value']):,.2f}, equity: ${float(record['net_equity']):,.2f}")
            print(f"    New value: ${home_value:,.2f}, new equity: ${net_equity:,.2f}")

            response = input("  Update existing record? (y/n): ").strip().lower()
            if response != 'y':
                print("  Skipping update.")
                return False

            # Update existing record
            update_data = {
                'home_value': float(home_value),
                'mortgage_balance': float(mortgage_balance),
                'net_equity': net_equity,
                'unrealized_gain_loss': unrealized_gain_loss
            }
            supabase.table('real_estate_history').update(update_data).eq('id', record['id']).execute()
            print(f"  [OK] Updated Zillow snapshot for {snapshot_date}")
        else:
            # Insert new record
            insert_data = {
                'snapshot_date': str(snapshot_date),
                'asset_name': PROPERTY_NAME,
                'asset_type': ASSET_TYPE,
                'home_value': float(home_value),
                'mortgage_balance': float(mortgage_balance),
                'net_equity': net_equity,
                'cost_basis': float(COST_BASIS),
                'unrealized_gain_loss': unrealized_gain_loss,
                'data_source': 'Zillow'
            }
            result = supabase.table('real_estate_history').insert(insert_data).execute()
            print(f"  [OK] Inserted new Zillow snapshot for {snapshot_date}")

        # Display summary
        gain_loss_pct = (unrealized_gain_loss / float(COST_BASIS) * 100) if COST_BASIS else 0

        print(f"\n Property Snapshot Summary (Zillow):")
        print(f"  Date:               {snapshot_date}")
        print(f"  Home Value:         ${home_value:,.2f}")
        print(f"  Mortgage Balance:   ${mortgage_balance:,.2f}")
        print(f"  Net Equity:         ${net_equity:,.2f}")
        print(f"  Cost Basis:         ${COST_BASIS:,.2f}")
        print(f"  Unrealized G/L:     ${unrealized_gain_loss:,.2f} ({gain_loss_pct:+.2f}%)")

        return True

    except Exception as e:
        print(f"  [X] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main execution function."""
    print("=" * 70)
    print("Zillow Zestimate Property Value Fetcher")
    print("=" * 70)

    today = date.today()

    # Step 1: Fetch home value from Zillow
    home_value = fetch_zillow_zestimate()

    if not home_value:
        print("\n[FAILED] Failed to fetch Zestimate from Zillow.")
        print("\nTroubleshooting:")
        print("  1. Get a free RapidAPI key: https://rapidapi.com/apimaker/api/zillow-com1")
        print("  2. Set ZILLOW_API_KEY environment variable")
        print("  3. Or verify Zillow URL is correct and update selectors")
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
        print("\n[SUCCESS] SUCCESS: Zillow Zestimate updated in Supabase!")
        print(f"\nView in dashboard: finances.html -> Investments tab -> Real Estate card")
    else:
        print("\n[FAILED] FAILED: Could not update Supabase")
        sys.exit(1)


if __name__ == "__main__":
    main()
