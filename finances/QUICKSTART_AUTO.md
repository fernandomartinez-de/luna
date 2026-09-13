# Quick Start - Auto-Processing

Drop Excel files, double-click START, everything happens automatically.

## One-Time Setup

```powershell
cd C:\Users\fmartine\Personal\repos\finances
pip install flask flask-cors
```

## Monthly Use (2 steps)

### 1. Download & Drop (3 min)

Go to chase.com and download 3 Excel files:
- Total Checking (...6813)
- Freedom Unlimited (...5113)
- Sapphire Preferred (...4433)

Drop all 3 files in:
```
C:\Users\fmartine\Personal\vaults\ssc-vault-fm\inbox\finances\
```

### 2. Double-Click START.bat

**That's it!**

Double-click:
```
C:\Users\fmartine\Personal\repos\finances\START.bat
```

Dashboard opens automatically in your browser.

## What Happens Automatically

1. **Server starts** (command window opens)
2. **Browser opens** to http://localhost:8000
3. **Dashboard detects** files in inbox
4. **Shows progress modal**: "Processing 3 files..."
5. **Processes everything**:
   - Moves to bronze
   - Categorizes transactions
   - Loads to database
6. **Dashboard reloads** with new data

You just watch the progress bar. Takes 30-60 seconds.

## Files & Locations

| What | Where |
|------|-------|
| **Start here** | `START.bat` ← Double-click this |
| Drop files here | `vault/inbox/finances/` |
| Processing log | `vault/outputs/finances-processing-log.md` |
| Dashboard | Opens automatically |
| Bronze files | `data/bronze/` |

## Stopping the Server

When done viewing the dashboard:
1. Close the browser tab
2. Go to the command window
3. Press Ctrl+C
4. Close the window

## Troubleshooting

**"Processing Modal" doesn't appear:**
- Check files are actually in inbox folder
- Close everything and double-click START.bat again

**Browser doesn't open:**
- Manually go to http://localhost:8000

**Server won't start:**
```powershell
pip install flask flask-cors
```

**Dashboard shows old data:**
- Hard refresh: Ctrl+Shift+R
- Check Supabase .env credentials

**Processing fails:**
- Check command window for error details
- Verify file names contain last 4 digits (6813, 5113, or 4433)

## What START.bat Does

```
1. Starts Flask server
2. Opens browser to dashboard
3. Dashboard auto-detects and processes files
4. You watch progress
5. Dashboard reloads with new data
```

No commands to remember. Just double-click START.bat.
