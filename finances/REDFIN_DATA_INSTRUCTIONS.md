# Redfin Historical Data - Upload Instructions

## Files Created

**redfin_condo_history.csv** - 13 months of condo + storage unit value history (Sep 2025 - Sep 2026)

## Data Summary

**26 total rows** (13 months × 2 assets)

### Condo Value Over Time
- Sep 2025: $872,680 (DOWN $22,320 from purchase)
- Oct 2025: $848,083 (DOWN $46,917)
- Nov 2025: $876,142 (DOWN $18,858)
- Dec 2025: $852,618 (DOWN $42,382)
- Jan 2026: $1,033,815 (UP $138,815) ← First gain
- Feb 2026: $1,155,876 (UP $260,876) ← Peak
- Mar 2026: $1,103,971 (UP $208,971)
- Apr 2026: $978,658 (UP $83,658)
- May 2026: $952,156 (UP $57,156)
- Jun 2026: $1,111,700 (UP $216,700)
- Jul 2026: $1,163,100 (UP $268,100)
- Aug 2026: $1,353,143 (UP $458,143) ← All-time high
- Sep 2026: $1,242,410 (UP $347,410) ← Current

**Purchase price:** $895,000  
**Current value:** $1,242,410  
**Current gain:** +$347,410 (+38.8%)

### Storage Unit
Static at $15,000 for all months (no appreciation tracked)

## When to Upload

Upload this CSV to Supabase when you're ready to:
1. Set up the `investments` table in Supabase
2. Build the Python upload script (`upload_investment_snapshot.py`)
3. Connect finances.html to Supabase for historical trend data

## Upload Command (Future)

```bash
cd finances
python upload_investment_snapshot.py --csv redfin_condo_history.csv
```

## Current State

**finances.html** already updated with current values:
- Condo: $1,242,410 (shows current Redfin estimate)
- Storage Unit: $15,000
- Total Real Estate: $1,257,410

**Interactive drill-down added:**
- Click on "Real Estate" card to see full breakdown
- Modal shows:
  - Home Value: $1,242,410
  - Mortgage Balance: -$462,602
  - Net Equity: $779,808
  - 13-month trend chart (home value, equity, mortgage)

## Next Steps

1. ✅ CSV created with 13 months of history
2. ✅ finances.html updated with current values
3. ⏳ Set up Supabase table (when ready)
4. ⏳ Build Python upload script (when ready)
5. ⏳ Connect dashboard to pull from Supabase (when ready)

## Updating Monthly

**Manual method (current):**
1. Check Redfin estimate
2. Update `HOLDINGS.realEstate.Condo.value` in finances.html
3. Refresh dashboard

**Automated method (future):**
1. Run `python add_investment_snapshot.py --month YYYY-MM`
2. Script prompts for Redfin value
3. Inserts into Supabase
4. Dashboard pulls latest value automatically

## Notes

- All snapshot dates use first of month (YYYY-MM-01)
- Condo cost basis: $895,000 (never changes)
- Storage unit cost basis: $15,000 (never changes)
- Unrealized gain/loss calculated automatically
