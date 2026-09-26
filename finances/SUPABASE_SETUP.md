# Supabase Setup Instructions

Complete guide to setting up Supabase for your investment dashboard.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                             │
└─────────────────────────────────────────────────────────────┘
           │                │                │
           ▼                ▼                ▼
     ┌──────────┐    ┌──────────┐    ┌──────────────┐
     │ Finnhub  │    │ CoinGecko│    │   Redfin     │
     │   API    │    │   API    │    │  (Manual)    │
     │ (Stocks) │    │ (Crypto) │    │ (Property)   │
     └──────────┘    └──────────┘    └──────────────┘
           │                │                │
           ▼                ▼                ▼
     ┌────────────────────────────────────────────┐
     │         finances.html Dashboard             │
     │                                             │
     │  • Stocks: Live API (refreshable)          │
     │  • Crypto: Live API (refreshable)          │
     │  • Real Estate: Supabase (monthly updates) │
     └────────────────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Supabase PostgreSQL  │
            │                       │
            │  real_estate_history  │
            │  - 13 months condo    │
            │  - 13 months storage  │
            └───────────────────────┘
```

## Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Sign up (free tier is sufficient)
3. Create a new project:
   - **Name:** `fernando-finances` (or whatever you want)
   - **Database Password:** (save this securely)
   - **Region:** Choose closest to you (US East recommended)

## Step 2: Create Table

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the contents of `supabase_schema.sql`
4. Click **Run** (or press Ctrl+Enter)
5. You should see: "Success. No rows returned"

## Step 3: Verify Table Created

1. Go to **Table Editor** in left sidebar
2. You should see `real_estate_history` table
3. Click on it - should show empty table with columns

## Step 4: Get Your Credentials

1. Go to **Project Settings** (gear icon in left sidebar)
2. Click **API** in left menu
3. You'll see two important values:
   - **Project URL:** `https://xxxxxxxx.supabase.co`
   - **anon public key:** `eyJhbGc...` (long string)

**Your dashboard already has these configured!** They're at line 1110-1111 in finances.html.

## Step 5: Upload Historical Data

**Option A: Python Script (Recommended)**

```bash
cd finances

# Install Supabase Python client
pip install supabase --break-system-packages

# Set environment variables
export SUPABASE_URL="https://uuvsvtpfcexhqojlrsxy.supabase.co"
export SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Upload data
python upload_real_estate_history.py
```

Expected output:
```
Connecting to Supabase...
Reading redfin_equity_mortgage.csv...
Prepared 26 rows to insert
Uploading to Supabase...
✓ Successfully uploaded 26 rows

Summary:
  Months: 13
  Assets: 2 (Condo + Storage Unit)
  Total rows: 26

Latest values:
  Condo: $1,242,410
  Net Equity: $779,808
  Mortgage: $462,602
```

**Option B: Manual Upload via Supabase UI**

1. Go to **Table Editor** → `real_estate_history`
2. Click **Insert** → **Insert rows**
3. Manually enter each row from `redfin_equity_mortgage.csv`
   - This is tedious (26 rows) - use Option A if possible

**Option C: CSV Import (if available)**

Some Supabase plans allow direct CSV import:
1. Table Editor → Import from CSV
2. Select `redfin_equity_mortgage.csv`
3. Map columns correctly
4. Import

## Step 6: Test the Dashboard

1. **Save** finances.html (if you haven't already)
2. **Open** in browser (or refresh if already open)
3. Go to **Investments tab**
4. **Click "Refresh Prices"** button
5. **Click on "Real Estate 🔍" card**
6. Modal should open showing:
   - Home Value: $1,242,410
   - Mortgage: -$462,602
   - Net Equity: $779,808
   - 13-month trend chart

## Troubleshooting

### Issue: "Failed to fetch real estate data"

**Check:**
1. Supabase credentials in finances.html are correct
2. Table `real_estate_history` exists
3. Data is uploaded
4. Browser console (F12) for detailed error

**Fix:**
```bash
# Test connection
python -c "
from supabase import create_client
url = 'https://uuvsvtpfcexhqojlrsxy.supabase.co'
key = 'eyJhbGci...'  # Your key
sb = create_client(url, key)
print(sb.table('real_estate_history').select('*').limit(1).execute())
"
```

### Issue: No data showing in modal

**Check browser console (F12):**
- Look for errors related to Supabase query
- Check network tab for failed API calls

**Verify data exists:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM real_estate_history ORDER BY snapshot_date DESC LIMIT 5;
```

### Issue: Upload script fails

**Common causes:**
1. **Missing environment variables**
   ```bash
   echo $SUPABASE_URL  # Should print your URL
   echo $SUPABASE_KEY  # Should print your key
   ```

2. **Wrong CSV file**
   - Make sure `redfin_equity_mortgage.csv` exists in same directory
   - Check file has correct columns

3. **Permission denied**
   - Use service role key instead of anon key for uploads
   - Go to Project Settings → API → Copy `service_role` key (keep secret!)

## Monthly Update Process

**When Redfin estimate changes (monthly):**

1. **Check new estimate** on Redfin
2. **Add new row** to Supabase:

```python
from supabase import create_client
import os
from datetime import date

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_KEY']
sb = create_client(url, key)

# Update these values
new_home_value = 1250000  # New Redfin estimate
new_mortgage = 462100     # Check your mortgage statement
new_equity = new_home_value - new_mortgage
today = date.today().replace(day=1)  # First of month

# Insert new data
sb.table('real_estate_history').insert([
    {
        'snapshot_date': today.isoformat(),
        'asset_name': 'Condo',
        'home_value': new_home_value,
        'mortgage_balance': new_mortgage,
        'net_equity': new_equity,
        'cost_basis': 895000,
        'unrealized_gain_loss': new_home_value - 895000,
        'location': '66 S 6th St, Williamsburg, Brooklyn, NY'
    },
    {
        'snapshot_date': today.isoformat(),
        'asset_name': 'Storage Unit',
        'home_value': 15000,
        'mortgage_balance': 0,
        'net_equity': 15000,
        'cost_basis': 15000,
        'unrealized_gain_loss': 0,
        'location': '66 S 6th St Unit 4A, Brooklyn, NY'
    }
]).execute()

print("✓ Updated real estate values for", today)
```

3. **Refresh dashboard** - new values appear automatically!

## Future: Automated Monthly Updates

**When ready, build a scheduled script:**
- Scrape Redfin estimate (unofficial API or Selenium)
- Auto-insert to Supabase
- Run via cron/Task Scheduler on 1st of month

## Security Notes

- **anon key** is safe to use in browser (public, read-only by default)
- **service_role key** must stay secret (full database access)
- Store service_role key in environment variables only, never commit to Git

## Data Schema

```sql
real_estate_history
├── id (serial, primary key)
├── snapshot_date (date) -- First of month
├── asset_name (varchar) -- "Condo" or "Storage Unit"
├── home_value (decimal) -- Total property value
├── mortgage_balance (decimal) -- Outstanding debt
├── net_equity (decimal) -- home_value - mortgage
├── cost_basis (decimal) -- Original purchase price
├── unrealized_gain_loss (decimal) -- home_value - cost_basis
├── location (varchar) -- Property address
└── created_at (timestamptz) -- Auto-generated
```

## Next Steps

Once real estate is working from Supabase:
1. ✅ Real estate data in Supabase
2. ⏳ Backdate stocks + crypto history
3. ⏳ Move stocks + crypto to Supabase too (optional)
4. ⏳ Build Python scripts for monthly snapshots
5. ⏳ Automate data collection

## Support

If stuck, check:
- Supabase docs: https://supabase.com/docs
- Browser console (F12) for errors
- Supabase logs (Project → Logs)
