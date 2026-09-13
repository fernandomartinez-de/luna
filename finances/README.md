# Finances

Personal finance tracking system with automated categorization, Supabase storage, and live dashboard visualization.

## Architecture

```
Chase Bank Statements (3 accounts)
    ↓
Python Categorization Script (adds Category, Confidence, Needs Review columns)
    ↓
Manual Review (filter Needs Review = Yes, assign correct categories)
    ↓
Python Upload Script
    ↓
Supabase (expense_transactions + expense_monthly_summary tables)
    ↓
Live HTML Dashboard (queries Supabase on load, displays charts and breakdowns)
```

## Features

- **Automated Categorization**: Python script categorizes 1,700+ transactions with confidence scoring
- **Manual Review Workflow**: Flag uncertain transactions for manual review
- **Live Dashboard**: Real-time HTML report with charts and category breakdowns
- **Supabase Backend**: PostgreSQL database with RLS policies for secure access
- **Monthly Insights**: Track discretionary spending vs fixed costs (mortgage & utilities)

## Setup

### 1. Supabase Database

Run `schema.sql` in your Supabase SQL editor to create:
- `expense_transactions` table (stores all transactions)
- `expense_monthly_summary` table (aggregated monthly totals by category)
- `refresh_monthly_summary()` function (rebuilds summary)
- RLS policies for authenticated, service_role, and anon access

### 2. Environment Variables

Create `.env` in repo root:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

### 3. Install Dependencies

```bash
pip install supabase python-dotenv pandas openpyxl
```

## Monthly Workflow

### Step 1: Download Bank Statements

Download Excel statements from Chase:
1. Checking account (chase-checking-6813.xlsx)
2. Credit card #4433 (Chase-creditcard-4433.xlsx)
3. Credit card #5113 (Chase-creditcard-5113.xlsx)

Save to `C:\Users\fmartine\Downloads\Chase\`

### Step 2: Auto-Categorize Transactions

Run the categorization script to add Category, Confidence, and Needs Review columns:

```bash
python scripts/categorize_excel.py
```

This creates 3 new files:
- `chase-checking-6813_categorized.xlsx`
- `Chase-creditcard-4433_categorized.xlsx`
- `Chase-creditcard-5113_categorized.xlsx`

### Step 3: Manual Review

1. Open each `_categorized.xlsx` file
2. Filter by "Needs Review = Yes"
3. Manually assign correct category for flagged transactions
4. Save the files

### Step 4: Upload to Supabase

```bash
python upload_expenses.py \
  --checking "C:\Users\fmartine\Downloads\Chase\chase-checking-6813_categorized.xlsx" \
  --cc1 "C:\Users\fmartine\Downloads\Chase\Chase-creditcard-4433_categorized.xlsx" \
  --cc2 "C:\Users\fmartine\Downloads\Chase\Chase-creditcard-5113_categorized.xlsx"
```

This will:
- Read all 3 files
- Use the reviewed Category column
- Upsert to Supabase (duplicates are skipped)
- Refresh the monthly summary

### Step 5: View Dashboard

Open `finances.html` in a browser. The dashboard will:
- Query Supabase for latest data
- Display summary cards (Net Remaining, Discretionary Avg, Months Tracked)
- Show Mortgage & Utilities breakdown with donut chart
- Show Discretionary Spending trends with line and bar charts
- Display all category tables with monthly totals

## Categories

### Fixed Costs (Mortgage & Utilities)
1. Mortgage
2. HOA
3. Electricity
4. Verizon

### Discretionary Spending
5. Grindhouse (Gym)
6. Subscriptions (Claude AI, Amazon Prime, Uber One, Hulu)
7. Gotham (Dispensary)
8. Uber (Eats + Rides)
9. Groceries
10. Dining
11. Shopping (Amazon purchases)
12. MTA
13. Miscellaneous

### Excluded from Stats
14. Payroll (income, not expense)
15. Pet (infrequent, reimbursed)

## Dashboard Visualizations

**Summary Cards:**
- Net Remaining: Payroll minus Mortgage & Utilities (monthly average)
- Discretionary Avg: Average discretionary spending per month
- Months Tracked: Total months of data

**Mortgage & Utilities Section:**
- Donut chart: Distribution of fixed costs by category
- Expense breakdown: Payroll at top, then each fixed cost, net remaining at bottom

**Discretionary Spending Section:**
- Line chart: Monthly spending trend
- Bar chart: Total spending by category

**Category Tables:**
- 16 category cards with monthly totals from Sept 2024 to Sept 2026

## Files

- `schema.sql` - Supabase database schema
- `categorize.py` - Transaction categorization rules
- `upload_expenses.py` - Uploads transactions to Supabase
- `finances.html` - Live dashboard
- `.env` - Supabase credentials (not committed)

## Future Automation

**Option 1: Browser Automation (Recommended, Free)**
- Python script with Selenium/Playwright
- Logs into Chase monthly, downloads statements automatically
- Runs via Windows Task Scheduler
- 100% free

**Option 2: Plaid Integration ($2-5/month)**
- Direct API connection to Chase
- Real-time transaction sync
- No manual downloads
- Requires paid plan for production use

## Troubleshooting

**Issue**: Subscriptions category is blank
**Solution**: Re-run `upload_expenses.py` to re-categorize all transactions with updated rules

**Issue**: Charts not loading
**Solution**: Check browser console for errors, verify Supabase anon key is correct in HTML

**Issue**: Duplicate transactions
**Solution**: Upload script uses unique constraint on (transaction_date, description, amount, source) - duplicates are automatically skipped
