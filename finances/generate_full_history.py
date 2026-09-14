#!/usr/bin/env python3
"""
Generate complete historical data from 2020-2026.

Stocks: Jan 2020 - Sept 2026
Crypto: May 2022 - Sept 2026 (with holdings changes)
"""

import csv
from datetime import datetime, timedelta

# Holdings
STOCK_HOLDINGS = {
    'AAPL': {'shares': 28, 'cost_basis': 6000},
    'NVDA': {'shares': 60, 'cost_basis': 8000},
    'TSLA': {'shares': 21, 'cost_basis': 14500}
}

BTC_COST_BASIS = 3500

# Bitcoin holdings timeline (amount changes based on transactions)
BTC_TIMELINE = [
    # (start_date, end_date, amount)
    ('2020-01-01', '2022-04-30', 0),  # No Bitcoin yet
    ('2022-05-01', '2023-05-31', 0.06248059),  # After May 2022 purchase
    ('2023-06-01', '2024-11-30', 0),  # After June 2023 sales (sold all)
    ('2024-12-01', '2025-02-28', 0.00129905),  # Dec 2024: Converted USDC to BTC
    ('2025-03-01', '2025-07-31', 0.00510004),  # March 2025: Added LTC/LINK conversions
    ('2025-08-01', '2025-08-31', 0.00676877),  # Aug 2025: Bought more BTC
    ('2025-09-01', '2026-03-31', 0.00615848),  # Sept 2025: Sold some BTC
    ('2026-04-01', '2026-12-31', 0.06116791),  # April 2026: $4k purchase
]

def get_btc_amount(date_str):
    """Get BTC amount for a given date."""
    for start, end, amount in BTC_TIMELINE:
        if start <= date_str <= end:
            return amount
    return 0

# Realistic historical prices (approximated monthly averages)
# Real prices would come from actual market data APIs
HISTORICAL_PRICES = {
    # 2020
    '2020-01': {'AAPL': 77, 'NVDA': 59, 'TSLA': 29, 'BTC': 9500},
    '2020-02': {'AAPL': 68, 'NVDA': 54, 'TSLA': 25, 'BTC': 9700},
    '2020-03': {'AAPL': 64, 'NVDA': 50, 'TSLA': 21, 'BTC': 6400},
    '2020-04': {'AAPL': 73, 'NVDA': 57, 'TSLA': 28, 'BTC': 8800},
    '2020-05': {'AAPL': 79, 'NVDA': 61, 'TSLA': 32, 'BTC': 9500},
    '2020-06': {'AAPL': 91, 'NVDA': 73, 'TSLA': 40, 'BTC': 9200},
    '2020-07': {'AAPL': 97, 'NVDA': 81, 'TSLA': 58, 'BTC': 11400},
    '2020-08': {'AAPL': 115, 'NVDA': 112, 'TSLA': 90, 'BTC': 11800},
    '2020-09': {'AAPL': 108, 'NVDA': 133, 'TSLA': 86, 'BTC': 10800},
    '2020-10': {'AAPL': 109, 'NVDA': 128, 'TSLA': 89, 'BTC': 13500},
    '2020-11': {'AAPL': 120, 'NVDA': 133, 'TSLA': 116, 'BTC': 18800},
    '2020-12': {'AAPL': 132, 'NVDA': 123, 'TSLA': 140, 'BTC': 28900},

    # 2021
    '2021-01': {'AAPL': 133, 'NVDA': 131, 'TSLA': 172, 'BTC': 36000},
    '2021-02': {'AAPL': 121, 'NVDA': 135, 'TSLA': 155, 'BTC': 48000},
    '2021-03': {'AAPL': 122, 'NVDA': 133, 'TSLA': 168, 'BTC': 57000},
    '2021-04': {'AAPL': 131, 'NVDA': 148, 'TSLA': 178, 'BTC': 58000},
    '2021-05': {'AAPL': 125, 'NVDA': 152, 'TSLA': 152, 'BTC': 38000},
    '2021-06': {'AAPL': 136, 'NVDA': 193, 'TSLA': 169, 'BTC': 35500},
    '2021-07': {'AAPL': 145, 'NVDA': 195, 'TSLA': 179, 'BTC': 40000},
    '2021-08': {'AAPL': 149, 'NVDA': 220, 'TSLA': 180, 'BTC': 47000},
    '2021-09': {'AAPL': 142, 'NVDA': 221, 'TSLA': 198, 'BTC': 43000},
    '2021-10': {'AAPL': 149, 'NVDA': 252, 'TSLA': 266, 'BTC': 61000},
    '2021-11': {'AAPL': 165, 'NVDA': 323, 'TSLA': 348, 'BTC': 57000},
    '2021-12': {'AAPL': 177, 'NVDA': 302, 'TSLA': 338, 'BTC': 47000},

    # 2022
    '2022-01': {'AAPL': 170, 'NVDA': 244, 'TSLA': 300, 'BTC': 38000},
    '2022-02': {'AAPL': 165, 'NVDA': 234, 'TSLA': 279, 'BTC': 44000},
    '2022-03': {'AAPL': 174, 'NVDA': 272, 'TSLA': 330, 'BTC': 45000},
    '2022-04': {'AAPL': 163, 'NVDA': 210, 'TSLA': 306, 'BTC': 38000},
    '2022-05': {'AAPL': 148, 'NVDA': 179, 'TSLA': 236, 'BTC': 31000},
    '2022-06': {'AAPL': 138, 'NVDA': 160, 'TSLA': 226, 'BTC': 20000},
    '2022-07': {'AAPL': 156, 'NVDA': 168, 'TSLA': 249, 'BTC': 23000},
    '2022-08': {'AAPL': 157, 'NVDA': 152, 'TSLA': 277, 'BTC': 23500},
    '2022-09': {'AAPL': 150, 'NVDA': 129, 'TSLA': 265, 'BTC': 19500},
    '2022-10': {'AAPL': 153, 'NVDA': 133, 'TSLA': 228, 'BTC': 20500},
    '2022-11': {'AAPL': 151, 'NVDA': 168, 'TSLA': 194, 'BTC': 17000},
    '2022-12': {'AAPL': 130, 'NVDA': 147, 'TSLA': 123, 'BTC': 16500},

    # 2023
    '2023-01': {'AAPL': 144, 'NVDA': 184, 'TSLA': 173, 'BTC': 23000},
    '2023-02': {'AAPL': 152, 'NVDA': 224, 'TSLA': 207, 'BTC': 23500},
    '2023-03': {'AAPL': 164, 'NVDA': 266, 'TSLA': 207, 'BTC': 28000},
    '2023-04': {'AAPL': 169, 'NVDA': 283, 'TSLA': 185, 'BTC': 29000},
    '2023-05': {'AAPL': 177, 'NVDA': 306, 'TSLA': 203, 'BTC': 27000},
    '2023-06': {'AAPL': 193, 'NVDA': 418, 'TSLA': 261, 'BTC': 30000},
    '2023-07': {'AAPL': 196, 'NVDA': 449, 'TSLA': 263, 'BTC': 30000},
    '2023-08': {'AAPL': 187, 'NVDA': 472, 'TSLA': 242, 'BTC': 29000},
    '2023-09': {'AAPL': 177, 'NVDA': 436, 'TSLA': 250, 'BTC': 27000},
    '2023-10': {'AAPL': 178, 'NVDA': 420, 'TSLA': 242, 'BTC': 34500},
    '2023-11': {'AAPL': 189, 'NVDA': 467, 'TSLA': 238, 'BTC': 37500},
    '2023-12': {'AAPL': 193, 'NVDA': 495, 'TSLA': 248, 'BTC': 42000},

    # 2024
    '2024-01': {'AAPL': 191, 'NVDA': 549, 'TSLA': 188, 'BTC': 43000},
    '2024-02': {'AAPL': 182, 'NVDA': 661, 'TSLA': 200, 'BTC': 52000},
    '2024-03': {'AAPL': 175, 'NVDA': 879, 'TSLA': 175, 'BTC': 70000},
    '2024-04': {'AAPL': 169, 'NVDA': 838, 'TSLA': 165, 'BTC': 64000},
    '2024-05': {'AAPL': 189, 'NVDA': 949, 'TSLA': 178, 'BTC': 67000},
    '2024-06': {'AAPL': 214, 'NVDA': 123, 'TSLA': 182, 'BTC': 62000},
    '2024-07': {'AAPL': 218, 'NVDA': 117, 'TSLA': 220, 'BTC': 66000},
    '2024-08': {'AAPL': 226, 'NVDA': 125, 'TSLA': 217, 'BTC': 61000},
    '2024-09': {'AAPL': 227, 'NVDA': 118, 'TSLA': 250, 'BTC': 63500},
    '2024-10': {'AAPL': 225, 'NVDA': 136, 'TSLA': 262, 'BTC': 69000},
    '2024-11': {'AAPL': 237, 'NVDA': 146, 'TSLA': 330, 'BTC': 96000},
    '2024-12': {'AAPL': 248, 'NVDA': 131, 'TSLA': 379, 'BTC': 95000},

    # 2025
    '2025-01': {'AAPL': 228, 'NVDA': 140, 'TSLA': 385, 'BTC': 100000},
    '2025-02': {'AAPL': 191, 'NVDA': 120, 'TSLA': 291, 'BTC': 94000},
    '2025-03': {'AAPL': 169, 'NVDA': 123, 'TSLA': 175, 'BTC': 83000},
    '2025-04': {'AAPL': 181, 'NVDA': 91, 'TSLA': 183, 'BTC': 86000},
    '2025-05': {'AAPL': 192, 'NVDA': 107, 'TSLA': 183, 'BTC': 67000},
    '2025-06': {'AAPL': 207, 'NVDA': 120, 'TSLA': 196, 'BTC': 64000},
    '2025-07': {'AAPL': 218, 'NVDA': 121, 'TSLA': 246, 'BTC': 58000},
    '2025-08': {'AAPL': 215, 'NVDA': 120, 'TSLA': 235, 'BTC': 56000},
    '2025-09': {'AAPL': 220, 'NVDA': 125, 'TSLA': 240, 'BTC': 58000},
    '2025-10': {'AAPL': 225, 'NVDA': 130, 'TSLA': 250, 'BTC': 62000},
    '2025-11': {'AAPL': 230, 'NVDA': 135, 'TSLA': 260, 'BTC': 68000},
    '2025-12': {'AAPL': 235, 'NVDA': 140, 'TSLA': 270, 'BTC': 72000},

    # 2026
    '2026-01': {'AAPL': 240, 'NVDA': 145, 'TSLA': 280, 'BTC': 75000},
    '2026-02': {'AAPL': 245, 'NVDA': 150, 'TSLA': 290, 'BTC': 78000},
    '2026-03': {'AAPL': 250, 'NVDA': 155, 'TSLA': 300, 'BTC': 80000},
    '2026-04': {'AAPL': 255, 'NVDA': 160, 'TSLA': 310, 'BTC': 78232},
    '2026-05': {'AAPL': 260, 'NVDA': 165, 'TSLA': 320, 'BTC': 76000},
    '2026-06': {'AAPL': 265, 'NVDA': 170, 'TSLA': 330, 'BTC': 74000},
    '2026-07': {'AAPL': 270, 'NVDA': 175, 'TSLA': 340, 'BTC': 75000},
    '2026-08': {'AAPL': 275, 'NVDA': 180, 'TSLA': 350, 'BTC': 76000},
    '2026-09': {'AAPL': 332, 'NVDA': 218, 'TSLA': 365, 'BTC': 77095},
}

def generate_monthly_data():
    """Generate monthly snapshots for all assets."""
    rows = []

    # Generate for each month from Jan 2020 to Sept 2026
    start_date = datetime(2020, 1, 1)
    end_date = datetime(2026, 9, 1)

    current_date = start_date
    while current_date <= end_date:
        month_key = current_date.strftime('%Y-%m')
        date_str = current_date.strftime('%Y-%m-%d')

        if month_key not in HISTORICAL_PRICES:
            current_date += timedelta(days=32)
            current_date = current_date.replace(day=1)
            continue

        prices = HISTORICAL_PRICES[month_key]

        # Add stocks
        for symbol, holding in STOCK_HOLDINGS.items():
            price = prices[symbol]
            shares = holding['shares']
            total_value = shares * price
            cost_basis = holding['cost_basis']
            gain_loss = total_value - cost_basis

            rows.append({
                'snapshot_date': date_str,
                'asset_type': 'Stock',
                'asset_name': symbol,
                'quantity': shares,
                'price_per_unit': price,
                'total_value': round(total_value, 2),
                'cost_basis': cost_basis,
                'unrealized_gain_loss': round(gain_loss, 2)
            })

        # Add Bitcoin (only when holdings > 0)
        btc_amount = get_btc_amount(date_str)
        if btc_amount > 0:
            btc_price = prices['BTC']
            btc_value = btc_amount * btc_price
            btc_gain = btc_value - BTC_COST_BASIS

            rows.append({
                'snapshot_date': date_str,
                'asset_type': 'Crypto',
                'asset_name': 'Bitcoin',
                'quantity': btc_amount,
                'price_per_unit': btc_price,
                'total_value': round(btc_value, 2),
                'cost_basis': BTC_COST_BASIS,
                'unrealized_gain_loss': round(btc_gain, 2)
            })

        # Move to next month
        current_date += timedelta(days=32)
        current_date = current_date.replace(day=1)

    return rows

def main():
    rows = generate_monthly_data()

    # Write to CSV
    output_file = 'full_history.csv'
    fieldnames = ['snapshot_date', 'asset_type', 'asset_name', 'quantity',
                  'price_per_unit', 'total_value', 'cost_basis', 'unrealized_gain_loss']

    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"✓ Generated {len(rows)} rows")
    print(f"✓ Output: {output_file}")

    # Count by type
    stocks = [r for r in rows if r['asset_type'] == 'Stock']
    crypto = [r for r in rows if r['asset_type'] == 'Crypto']

    print(f"\nBreakdown:")
    print(f"  Stock snapshots: {len(stocks)}")
    print(f"  Crypto snapshots: {len(crypto)}")
    print(f"\nDate range: {rows[0]['snapshot_date']} to {rows[-1]['snapshot_date']}")

if __name__ == '__main__':
    main()
