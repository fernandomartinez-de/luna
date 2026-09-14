# Asset Filters & Separate Condo/Storage Update

## Changes Made

### 1. Asset Type Filters Added
**Location:** Above visualizations grid in Investments tab

**Filter Options:**
- **All Assets** (default) - Shows everything
- **Stocks** - AAPL, NVDA, TSLA only
- **Crypto** - Bitcoin only
- **Real Estate** - Condo + Storage Unit only

**How it works:**
- Click any filter button
- All 5 visualizations update instantly
- Assets table stays unfiltered (always shows all)

### 2. Condo & Storage Now Separate Everywhere

**Before:** Combined as "Real Estate" ($910,000)
**After:** Two separate items:
- **Condo:** $1,242,410 (purple #8b5cf6)
- **Storage Unit:** $15,000 (indigo #6366f1)

**Shows separately in:**
- ✅ Treemap visualization
- ✅ Polar area chart
- ✅ Horizontal stacked bar
- ✅ Bubble chart (performance vs size)
- ✅ Assets table

### 3. Dynamic Data from Supabase

**All visualizations now use live data from:**
- **Stocks:** API prices × shares
- **Crypto:** API prices × BTC amount
- **Real Estate:** Latest Supabase snapshot

**No more hardcoded values!**

### 4. Gain Percentages in Gauges

Gauges now show actual calculated gains:
- **Stocks Gauge:** Average gain% across all stocks
- **Crypto Gauge:** Bitcoin gain%
- **Real Estate Gauge:** Weighted average of Condo + Storage gain%

## Visual Changes

### Filter Buttons
```
┌──────────────┬───────────┬──────────┬───────────────┐
│  All Assets  │  Stocks   │  Crypto  │  Real Estate  │
│   (active)   │           │          │               │
└──────────────┴───────────┴──────────┴───────────────┘
```

- Active = Blue background (#3b82f6)
- Inactive = White with gray border
- Hover = Blue border

### Treemap Example (All Assets)
```
┌─────────────────────────────────────────┐
│ ┌──────────┐ ┌────┐ ┌───┐ ┌───┐ ┌──┐   │
│ │  Condo   │ │TSLA│ │NVD│ │APL│ │BT│   │
│ │ $1.24M   │ │$15k│ │$9k│ │$6k│ │$5│   │
│ └──────────┘ └────┘ └───┘ └───┘ └──┘   │
│ ┌──────┐                                │
│ │Store │                                │
│ │ $15k │                                │
│ └──────┘                                │
└─────────────────────────────────────────┘
```

### Treemap Example (Stocks Filter)
```
┌─────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────┐ ┌──────────┐  │
│ │   TSLA   │ │  NVDA   │ │   AAPL   │  │
│ │ $14,595  │ │ $9,000  │ │  $6,440  │  │
│ │  +0.66%  │ │ +12.50% │ │  +7.33%  │  │
│ └──────────┘ └─────────┘ └──────────┘  │
└─────────────────────────────────────────┘
```

## Testing Instructions

### Test 1: Default View (All Assets)
1. **Refresh dashboard** (click "Refresh Prices")
2. **Check all visualizations show 6 items:**
   - Condo (purple, ~$1.24M)
   - Storage Unit (indigo, $15K)
   - TSLA (red)
   - NVDA (green)
   - AAPL (blue)
   - Bitcoin (orange)

### Test 2: Stocks Filter
1. **Click "Stocks" filter button**
2. **Verify visualizations show only 3 items:**
   - AAPL
   - NVDA
   - TSLA
3. **Check gauges still show:**
   - Stocks Gauge: Average stock gain%
   - Crypto Gauge: 0 or hidden
   - Real Estate Gauge: 0 or hidden

### Test 3: Real Estate Filter
1. **Click "Real Estate" filter button**
2. **Verify visualizations show only 2 items:**
   - Condo ($1,242,410)
   - Storage Unit ($15,000)
3. **Check bubble chart:** Both on x=2 axis (Real Estate category)

### Test 4: Filter Persistence After Refresh
1. **Select "Crypto" filter**
2. **Click "Refresh Prices"**
3. **Verify filter stays on Crypto** (should only show Bitcoin)
4. **Charts update with new live prices**

### Test 5: Real Estate Drill-Down Modal
1. **Click "Real Estate 🔍" card**
2. **Modal should show:**
   - Home Value: $1,242,410
   - Mortgage: -$462,602
   - Net Equity: $779,808
   - 13-month trend chart (from Supabase)

### Test 6: Assets Table
1. **Table should always show all assets** (no filter applied)
2. **Should show 6 rows:**
   - AAPL (Stock badge)
   - NVDA (Stock badge)
   - TSLA (Stock badge)
   - Bitcoin (Crypto badge)
   - Condo (Real Estate badge)
   - Storage Unit (Real Estate badge)

## Known Limitations

1. **Trend charts (12-month) still use placeholder data**
   - Will be replaced once we backdate stocks/crypto history
   - Currently shows fake trend line

2. **Performance chart (monthly change) still placeholder**
   - Needs historical snapshots in Supabase
   - Future enhancement

3. **Filter doesn't affect stats cards**
   - Stats cards always show totals (not filtered)
   - This is intentional for overview

## Code Changes Summary

**Files modified:**
- `finances.html`

**New CSS classes:**
- `.asset-filter-btn`
- `.asset-filter-active`

**New JavaScript functions:**
- `filterAssets(type)` - Apply filter and re-render

**New global variables:**
- `currentAssetFilter` - Tracks selected filter ('all', 'stocks', 'crypto', 'realestate')
- `currentPortfolioData` - Stores latest data for re-filtering

**Updated functions:**
- `initInvestmentCharts(portfolioData)` - Now accepts data param, builds assets dynamically, respects filter
- `updateDashboard(data)` - Passes data to initInvestmentCharts
- `showFinanceTab(tabName)` - Only inits charts if data exists

## Next Steps

1. ✅ **Real estate in Supabase** (DONE)
2. ⏳ **Backdate stocks history** (send Morgan Stanley export)
3. ⏳ **Backdate crypto history** (send Coinbase export)
4. ⏳ **Replace trend chart placeholders** with real historical data
5. ⏳ **Add monthly snapshot automation**

## Rollback

If anything breaks, revert finances.html to before this commit:
```bash
git checkout HEAD~1 finances.html
```

Then refresh browser and you'll have the old version back.
