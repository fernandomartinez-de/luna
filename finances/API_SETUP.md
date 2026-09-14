# Live Market Data Setup

To enable live stock price updates in your investment dashboard, you need a free API key.

## Step 1: Get Free Finnhub API Key

1. Go to https://finnhub.io/register
2. Sign up with your email (free tier includes 60 API calls/minute)
3. Verify your email
4. Copy your API key from the dashboard

## Step 2: Add API Key to finances.html

1. Open `finances.html` in a text editor
2. Search for: `finnhubKey: 'YOUR_FINNHUB_API_KEY_HERE'`
3. Replace with: `finnhubKey: 'your-actual-api-key-here'`
4. Save the file

## Step 3: Test

1. Open `finances.html` in your browser
2. Click "Refresh Prices" button in the Investment tab
3. Stock and crypto prices will update in real-time!

## What Gets Updated

- **AAPL (Apple)** - Live price from NASDAQ
- **NVDA (Nvidia)** - Live price from NASDAQ
- **TSLA (Tesla)** - Live price from NASDAQ
- **Bitcoin** - Live price (no API key needed - uses CoinGecko)
- **Real Estate** - Static (manual updates only)

## Features

- **Refresh Button** - Click to get latest prices
- **Auto-Calculate** - Gains/losses update automatically
- **All Visuals Update** - Charts, tables, stats all refresh
- **Timestamp** - Shows when data was last updated

## Rate Limits

**Free Tier:**
- 60 API calls per minute
- Unlimited calls per day
- Real-time US stock prices

**Each refresh = 3 API calls** (one per stock), so you can refresh 20 times per minute.

## Troubleshooting

**"API key not configured" error:**
- Make sure you replaced `YOUR_FINNHUB_API_KEY_HERE` with your actual key
- Check for typos in the key

**"Failed to fetch price" error:**
- Check internet connection
- Verify API key is valid at https://finnhub.io/dashboard
- Make sure you haven't exceeded rate limits

**Crypto prices work but stocks don't:**
- Bitcoin uses CoinGecko (no key needed)
- Stocks use Finnhub (requires key)
- Only set up the Finnhub key for stocks

## Alternative: Manual Updates

If you don't want to set up the API:
- Dashboard still works with hardcoded prices
- Manually update prices in the code when needed
- All calculations still work

## Security Note

- API keys are stored in the HTML file (client-side only)
- Finnhub free tier keys are safe to use in public code
- Do NOT share paid API keys in public repositories
