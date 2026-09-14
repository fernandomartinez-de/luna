# Date Filters for Historical Portfolio View

## What Changed

Added date filtering capability to view portfolio values at any point in time (currently Real Estate only, stocks/crypto coming later).

## New Features

### 1. Date Filter Dropdown
**Location:** Next to asset type filters

**Options:**
- **Current (Latest)** - Default, shows live/current data
- **September 2026** - Most recent historical snapshot
- **August 2026**
- **July 2026**
- ... (all the way back to)
- **September 2025** - First historical snapshot

**Populated from:** Supabase `real_estate_history` table (13 months available)

### 2. Historical View Mode

**When you select a historical date:**
- ✅ **Real Estate** values update to that month's snapshot
- ✅ **Visualizations** show Condo + Storage at historical prices
- ✅ **Net Worth** reflects real estate value from that date
- ⏳ **Stocks** excluded (no historical data yet)
- ⏳ **Crypto** excluded (no historical data yet)

**Status line shows:** `"Historical snapshot: [Month Year] (Real Estate only)"`

### 3. What You Can Verify

**Use this to verify your 13 months of Redfin data:**

| Date | Expected Condo Value | Expected Total RE |
|------|---------------------|-------------------|
| Sep 2025 | $872,680 | $887,680 |
| Oct 2025 | $848,083 | $863,083 |
| Nov 2025 | $876,142 | $891,142 |
| Dec 2025 | $852,618 | $867,618 |
| Jan 2026 | $1,033,815 | $1,048,815 |
| Feb 2026 | $1,155,876 | $1,170,876 | ← Peak
| Mar 2026 | $1,103,971 | $1,118,971 |
| Apr 2026 | $978,658 | $993,658 |
| May 2026 | $978,156 | $967,156 |
| Jun 2026 | $1,111,700 | $1,126,700 |
| Jul 2026 | $1,163,100 | $1,178,100 |
| Aug 2026 | $1,353,143 | $1,368,143 | ← All-time high
| Sep 2026 | $1,242,410 | $1,257,410 | ← Current

*Total RE = Condo + Storage Unit ($15K)*

## How to Use

### Test Historical Data
1. **Open dashboard** (localhost:8000/finances.html)
2. **Go to Investments tab**
3. **Select "February 2026"** from date dropdown
4. **Verify:**
   - Real Estate card shows **$1,170,876**
   - Net Worth shows **$1,170,876**
   - Visualizations show only Condo + Storage
   - Stocks/Crypto cards show **$0**

5. **Select "August 2026"** (the peak!)
6. **Verify:**
   - Real Estate card shows **$1,368,143**
   - Condo shows **$1,353,143** in visualizations
   - Storage shows **$15,000**

7. **Select "September 2025"** (first month)
8. **Verify:**
   - Real Estate card shows **$887,680**
   - This is actually a loss! (-$22,320 from $910K purchase)

### Return to Current View
1. **Select "Current (Latest)"** from dropdown
2. **Click "Refresh Prices"** to reload live data
3. **All assets reappear** (stocks, crypto, real estate)

## Filter Interactions

**Asset Type + Date filters work together:**

**Example 1: View only Real Estate in February 2026**
1. Select "February 2026"
2. Click "Real Estate" filter
3. See only Condo ($1,155,876) + Storage ($15,000)

**Example 2: See all assets current**
1. Select "Current (Latest)"
2. Click "Refresh Prices"
3. Click "All Assets"
4. See 6 assets (3 stocks, 1 crypto, 2 real estate)

## Technical Details

### New JavaScript Variables
```javascript
currentDateFilter = 'current'  // Tracks selected date
availableDates = []            // Stores all available months from Supabase
```

### New Functions
```javascript
populateDateFilter()           // Populates dropdown on load
filterByDate()                 // Handles date selection
loadHistoricalData(date)       // Fetches and displays historical snapshot
```

### Data Flow (Historical Mode)
```
User selects date
    ↓
loadHistoricalData(date)
    ↓
Query Supabase: WHERE snapshot_date = date
    ↓
Build portfolioData with only real estate
    ↓
updateDashboard(portfolioData)
    ↓
initInvestmentCharts(portfolioData)
    ↓
Visualizations show historical real estate only
```

### Data Flow (Current Mode)
```
User selects "Current"
    ↓
refreshMarketData()
    ↓
Fetch live: Stocks API + Crypto API + Supabase latest
    ↓
calculatePortfolioValues(stocks, crypto, realEstate)
    ↓
updateDashboard(portfolioData)
    ↓
Visualizations show all 6 assets
```

## Known Limitations

### 1. Stocks Historical Data Not Available Yet
**Current behavior:** When viewing historical dates, stocks show as $0

**Fix:** Upload Morgan Stanley historical transactions
- Will create monthly snapshots in Supabase
- Then historical view will include stocks at that month's prices

### 2. Crypto Historical Data Not Available Yet
**Current behavior:** When viewing historical dates, crypto shows as $0

**Fix:** Upload Coinbase historical transactions
- Will create monthly snapshots in Supabase
- Then historical view will include Bitcoin at that month's prices

### 3. No Mixed Mode
You can't currently view "historical real estate + current stocks/crypto"

Either:
- **Current mode:** All assets at current prices
- **Historical mode:** Only real estate at historical prices

**Future enhancement:** Allow mixed mode for comparison

## Next Steps

### Immediate (to complete historical view)
1. ⏳ **Upload Morgan Stanley transaction history**
2. ⏳ **Upload Coinbase transaction history**
3. ⏳ **Backfill stocks monthly snapshots** (Sept 2025 - Sept 2026)
4. ⏳ **Backfill crypto monthly snapshots** (Sept 2025 - Sept 2026)
5. ⏳ **Update loadHistoricalData()** to fetch stocks/crypto for selected date

### Future Enhancements
1. **Date range selector** (vs single date)
2. **Compare two dates** side-by-side
3. **Trend animation** (watch portfolio evolve month by month)
4. **Export historical report** (PDF/Excel)
5. **Forward projection** (predict future values based on trends)

## Testing Checklist

- [ ] Date dropdown populates with 13 months
- [ ] Selecting February 2026 shows Condo at $1,155,876
- [ ] Selecting August 2026 shows Condo at $1,353,143 (peak)
- [ ] Selecting September 2025 shows Condo at $872,680 (loss)
- [ ] Visualizations update to show only real estate
- [ ] Asset type filters still work in historical mode
- [ ] Clicking "Current" + "Refresh Prices" returns to live view
- [ ] All 6 assets appear again in current mode
- [ ] Status line shows correct label for historical vs current

## Troubleshooting

**Issue: Date dropdown is empty**
- Check console for errors
- Verify Supabase connection: `supabaseClient.from('real_estate_history').select('*').limit(1).execute()`
- Ensure data was uploaded successfully

**Issue: Selecting date shows $0 for real estate**
- Check console: "Loading data for: [date]"
- Verify that date exists in Supabase table
- Check data format matches expected structure

**Issue: After selecting historical date, can't get back to current**
- Select "Current (Latest)" from dropdown
- Click "Refresh Prices" button
- Should reload all live data

## Files Modified

- `finances.html` - All changes in this file
  - Added date filter dropdown
  - Added `populateDateFilter()` function
  - Added `filterByDate()` function  
  - Added `loadHistoricalData()` function
  - Updated DOMContentLoaded to populate dropdown on load

## Commit Message

```
feat: Add date filters for historical portfolio view

- Date dropdown shows 13 available months (Sept 2025 - Sept 2026)
- Selecting a date shows real estate values from that month
- Stocks/crypto excluded in historical mode (no data yet)
- Current mode still works with live API data
- Verifies all 13 months of Redfin data uploaded to Supabase
```
