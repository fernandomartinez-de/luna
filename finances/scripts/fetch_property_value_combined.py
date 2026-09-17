#!/usr/bin/env python3
"""
Fetch property value from BOTH Zillow and Redfin, compare estimates, and store both.

This script runs both fetch_zillow_property_value.py and fetch_redfin_property_value.py
and provides a comparison analysis.

Usage:
    python fetch_property_value_combined.py

Environment Variables:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_KEY - Your Supabase anon/service key
    ZILLOW_API_KEY - (Optional) RapidAPI key for Zillow API
    REDFIN_COOKIE - (Optional) Redfin session cookie for owner dashboard

Author: Fernando Martinez
Created: 2026-09-17
"""

import os
import sys
from datetime import date
from decimal import Decimal
import subprocess

# Try importing required libraries
try:
    from supabase import create_client, Client
except ImportError as e:
    print(f"ERROR: Required libraries not installed: {e}")
    print("Install with: pip install supabase")
    sys.exit(1)

# Configuration
PROPERTY_NAME = "66 S 6th St, Unit 4A, Brooklyn, NY"
COST_BASIS = Decimal("895000.00")  # Original purchase price


def run_script(script_name):
    """
    Run a Python script and capture its output.

    Args:
        script_name: Name of the script to run (e.g., 'fetch_zillow_property_value.py')

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        script_path = os.path.join(os.path.dirname(__file__), script_name)
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            check=False
        )

        # Print the output
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)

        return result.returncode == 0

    except Exception as e:
        print(f"  [X] Error running {script_name}: {e}")
        return False


def fetch_latest_estimates():
    """
    Fetch the latest Zillow and Redfin estimates from Supabase.

    Returns:
        tuple: (zillow_value, redfin_value) or (None, None) if not found
    """
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')

    if not supabase_url or not supabase_key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY environment variables not set")
        return None, None

    try:
        supabase: Client = create_client(supabase_url, supabase_key)

        today = date.today()

        # Fetch Zillow estimate
        zillow = supabase.table('real_estate_history')\
            .select('home_value')\
            .eq('snapshot_date', str(today))\
            .eq('asset_name', PROPERTY_NAME)\
            .eq('data_source', 'Zillow')\
            .execute()

        # Fetch Redfin estimate
        redfin = supabase.table('real_estate_history')\
            .select('home_value')\
            .eq('snapshot_date', str(today))\
            .eq('asset_name', PROPERTY_NAME)\
            .eq('data_source', 'Redfin')\
            .execute()

        zillow_value = Decimal(str(zillow.data[0]['home_value'])) if zillow.data else None
        redfin_value = Decimal(str(redfin.data[0]['home_value'])) if redfin.data else None

        return zillow_value, redfin_value

    except Exception as e:
        print(f"  [X] Error fetching estimates: {e}")
        return None, None


def compare_estimates(zillow_value, redfin_value):
    """
    Compare Zillow and Redfin estimates and display analysis.

    Args:
        zillow_value: Zillow Zestimate (Decimal)
        redfin_value: Redfin Estimate (Decimal)
    """
    print("\n" + "=" * 70)
    print("PROPERTY VALUE COMPARISON")
    print("=" * 70)

    if not zillow_value and not redfin_value:
        print("[FAILED] No estimates available for comparison")
        return

    if zillow_value:
        gain_zillow = zillow_value - COST_BASIS
        gain_pct_zillow = (gain_zillow / COST_BASIS * 100) if COST_BASIS else 0
        print(f"\n[PROPERTY] Zillow Zestimate:    ${zillow_value:,.2f}")
        print(f"   Gain since purchase: ${gain_zillow:,.2f} ({gain_pct_zillow:+.2f}%)")

    if redfin_value:
        gain_redfin = redfin_value - COST_BASIS
        gain_pct_redfin = (gain_redfin / COST_BASIS * 100) if COST_BASIS else 0
        print(f"\n[PROPERTY] Redfin Estimate:     ${redfin_value:,.2f}")
        print(f"   Gain since purchase: ${gain_redfin:,.2f} ({gain_pct_redfin:+.2f}%)")

    if zillow_value and redfin_value:
        # Calculate difference and average
        difference = abs(zillow_value - redfin_value)
        difference_pct = (difference / ((zillow_value + redfin_value) / 2)) * 100
        average = (zillow_value + redfin_value) / 2

        print(f"\n[ANALYSIS] Analysis:")
        print(f"   Difference:          ${difference:,.2f} ({difference_pct:.2f}%)")
        print(f"   Average estimate:    ${average:,.2f}")

        if zillow_value > redfin_value:
            print(f"   -> Zillow is ${difference:,.2f} higher than Redfin")
        else:
            print(f"   -> Redfin is ${difference:,.2f} higher than Zillow")

        # Recommendation
        print(f"\n[RECOMMENDATION] Recommendation:")
        if difference_pct < 5:
            print(f"   [OK] Estimates are close (within {difference_pct:.1f}%) - both are reliable")
            print(f"   -> Use average: ${average:,.2f}")
        elif difference_pct < 10:
            print(f"   [!] Moderate difference ({difference_pct:.1f}%) - consider market conditions")
            print(f"   -> Conservative estimate: ${min(zillow_value, redfin_value):,.2f}")
            print(f"   -> Optimistic estimate: ${max(zillow_value, redfin_value):,.2f}")
        else:
            print(f"   [!] Large difference ({difference_pct:.1f}%) - investigate further")
            print(f"   -> One estimate may be outdated or inaccurate")
            print(f"   -> Consider getting a professional appraisal")

    print("\n" + "=" * 70)


def main():
    """Main execution function."""
    print("=" * 70)
    print("COMBINED PROPERTY VALUE TRACKER")
    print("Fetching from Zillow AND Redfin")
    print("=" * 70)

    success_zillow = False
    success_redfin = False

    # Step 1: Fetch from Zillow
    print("\n" + "=" * 70)
    print("STEP 1: Fetching Zillow Zestimate")
    print("=" * 70)
    success_zillow = run_script('fetch_zillow_property_value.py')

    # Step 2: Fetch from Redfin
    print("\n" + "=" * 70)
    print("STEP 2: Fetching Redfin Estimate")
    print("=" * 70)
    success_redfin = run_script('fetch_redfin_property_value.py')

    # Step 3: Compare results
    if success_zillow or success_redfin:
        zillow_value, redfin_value = fetch_latest_estimates()
        compare_estimates(zillow_value, redfin_value)

        print("\n[SUCCESS] Property value tracking complete!")
        print(f"\nView in dashboard: finances.html -> Investments tab -> Real Estate card")
    else:
        print("\n[FAILED] Failed to fetch property values from both sources")
        print("\nTroubleshooting:")
        print("  1. Check your internet connection")
        print("  2. Verify SUPABASE_URL and SUPABASE_KEY are set")
        print("  3. For Zillow: Get RapidAPI key or check selectors")
        print("  4. For Redfin: Set REDFIN_COOKIE or check selectors")
        sys.exit(1)


if __name__ == "__main__":
    main()
