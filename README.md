# Personal Automation

Consolidated repository for all personal automation workflows.

## What This Is

ONE repo containing all personal data automation:
- **Finances** - Expense tracking and categorization. Chase transactions auto-pull daily via Plaid.
- **Docs** - Personal document filing and expiration tracking
- **Health** - Whoop fitness sync + medical lab dashboards
- **Travel** - Trip tracking and planning

## Structure

```
personal/
├── finances/          Expense tracking with auto-categorization
│   ├── plaid_link.py  → One time: connect Chase via Plaid (Hosted Link)
│   ├── plaid_sync.py  → Daily: pull transactions into Supabase
│   ├── START.bat      → Manual backfill / legacy dashboard launcher
│   ├── finances.html  → Dashboard
│   └── scripts/       → Processing scripts
│
├── docs/              Personal document automation
│   ├── PROCESS_INBOX.bat   → File documents
│   ├── SCAN_EXPIRATIONS.bat → Check renewals
│   └── *.py                 → Auto-filing scripts
│
├── health/
│   ├── whoop/         Whoop fitness data sync
│   ├── fitness/       Overload dashboard: Training + Nutrition (GitHub Pages)
│   ├── body/          Renpho body composition daily pull into Supabase
│   └── medical/       Medical lab dashboards
│
└── travel/            Trip tracking
```

## Quick Start

### Finances (Plaid, current)

Chase pulls automatically each morning via the `pull-finances.yml` Action into
Supabase `expense_transactions`. One time setup:

```powershell
cd finances
python plaid_link.py   # Plaid Hosted Link, connect Chase once
```

After that the daily GitHub Action keeps `expense_transactions` current; no manual
downloads needed. See `finances/README.md`.

### Finances (manual backfill, legacy)
```powershell
cd finances
# Double-click START.bat or:
python serve_dashboard.py
```

Drop Excel statements in vault inbox → auto-processes → dashboard updates. Kept
for one-off backfills; not the routine path.

### Docs (Personal Documents)
```powershell
cd docs
# Double-click PROCESS_INBOX.bat or:
python process_personal_inbox.py
```

Drop any document (W2, passport, medical) in vault inbox → auto-files to Google Drive

### Health (Whoop Sync)
```powershell
cd health/whoop
python sync.py
```

Syncs Whoop data to Google Drive

### Health (Overload dashboard: Training + Nutrition)
```powershell
$env:SUPABASE_URL="https://<ref>.supabase.co"
$env:SUPABASE_KEY="<anon-or-service-role-key>"
pip install -r health/fitness/requirements.txt
python health/fitness/build_overload.py
```

One URL at https://fernandomartinez-de.github.io/personal/health/fitness/ with
a top-level Training | Nutrition segmented control. Training shows Plan /
Session / Block / Method; Nutrition shows Today (Cronometer-style day view
with in vs out and macros vs target) and Trends (rolling deficit + body-comp
overlay). Data baked at build time from Supabase (`body_composition`,
`whoop_workouts`, `whoop_cycles`, `strength_*`, `nutrition_log`). See
`health/fitness/README.md`.

### Health (Medical Labs)
```powershell
cd health/medical
python build_dashboards.py
```

Generates medical lab dashboards from Google Drive PDFs

## Automated (GitHub Actions)

- `pull-finances.yml` - Chase via Plaid -> `expense_transactions`
- `pull-body.yml` - Renpho body composition -> `body_composition`
- `build-fitness.yml` - Rebuild the Overload dashboard from Supabase
- `whoop-daily-sync.yml` - Whoop sync
- `medical-ingest-labs.yml`, `medical-clean-drive.yml`, `medical-rebuild-dashboards.yml`

## Common Pattern

All workflows follow the same pattern:
1. **Inbox** - Drop files in Obsidian vault inbox
2. **Process** - Script detects type, renames, categorizes
3. **Storage** - Files to Google Drive with standard naming
4. **Track** - Logs to vault for history

## Standard Naming

All automated files follow: `YYYY-MM-DD_category_source_description.ext`

**Examples:**
- `2025-01-31_w2_prestige.pdf`
- `2026-04-15_passport_spain.pdf`
- `2026-04-17_labs_quest.pdf`
- `2025-09-13_expense_chase-checking.xlsx`

## Data Flow

```
Obsidian Vault Inbox
      ↓ (detect + rename)
Google Drive
      ↓ (process)
Dashboard / Reports
```

## Vault Integration

The vault is local only and gitignored; it is not committed to this repo.

**Inbox folders:**
- `vault/inbox/finances/` - Bank statements
- `vault/inbox/bills/` - Utility bills  
- `vault/inbox/personal-docs/` - All other documents

**Tracking:**
- `vault/outputs/finances-processing-log.md`
- `vault/outputs/bills-processing-log.md`
- `vault/outputs/personal-docs-processing-log.md`
- `vault/outputs/expiration-report.md`

**Workflows:**
- `vault/workflows/monthly-finances.md`
- `vault/workflows/file-bills.md`
- `vault/workflows/personal-docs.md`

## Google Drive Structure

```
G:\My Drive\
├── Finances\          (from finances/)
│   ├── Chase\
│   ├── Verizon\
│   └── ConEd\
│
└── Personal\          (from docs/)
    ├── Tax\
    ├── ID\
    ├── Employment\
    ├── Medical\
    ├── Property\
    ├── Education\
    └── Insurance\
```

## Installation

Each subfolder has its own `requirements.txt`:

```powershell
# Finances
cd finances
pip install -r requirements.txt

# Docs
cd docs
pip install -r requirements.txt

# Health/Medical
cd health/medical
pip install -r requirements.txt

# Health/Whoop
cd health/whoop
# (uses Node.js, see whoop/README.md)
```

## Why Consolidated

**Before:** 5 separate repos to track
**After:** 1 repo with organized subfolders

**Benefits:**
- Easier to backup (one git repo)
- Shared patterns visible
- Less overhead
- Easier to maintain

## Related Projects

**Kept separate:**
- `bot-crossing/` - Agent visualization tool (different purpose)

## Maintenance

**Monthly tasks:**
- Finances: automatic via the Plaid daily pull (manual Excel only for backfills)
- Process personal docs inbox
- Scan document expirations
- Sync Whoop data
- Update medical dashboards

## Tech Stack

- **Python** - Data processing, automation
- **Flask** - Dashboards and APIs
- **Supabase** - Database (finances)
- **Plaid** - Chase transaction auto-pull (Production)
- **Google Drive** - Permanent storage
- **Obsidian** - Inbox and tracking
- **Chart.js** - Visualizations

## Git Workflow

```powershell
git add .
git commit -m "Update: description"
git push
```

All workflows are independent - changes to one don't affect others.
