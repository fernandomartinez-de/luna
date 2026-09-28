# Personal Dashboard & Automation

Automated personal finance, fitness, and health tracking system. All data flows through one Supabase database and deploys to GitHub Pages.

**Live Site:** https://fernandomartinez-de.github.io/personal/

---

## 🌐 Dashboards

### v1 (Static HTML)
- **Landing:** [index.html](https://fernandomartinez-de.github.io/personal/)
- **Finances:** [finances.html](https://fernandomartinez-de.github.io/personal/finances/finances.html) - Expenses, investments, property
- **Fitness:** [overload.html](https://fernandomartinez-de.github.io/personal/health/fitness/overload.html) - WHOOP data, training, nutrition
- **Medical:** [medical.html](https://fernandomartinez-de.github.io/personal/health/medical/medical.html) - Lab results for providers

### v2 (React App - Mobile-Friendly)
- **Lyftr:** [lyftr/](https://fernandomartinez-de.github.io/personal/lyftr/) - Full-featured app with exercises, workouts, finances, medical

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Data Sources"
        CHASE[Chase]
        FIDELITY[Fidelity]
        WHOOP[WHOOP]
        RENPHO[Renpho]
        GDRIVE[Google Drive]
        PRICES[Finnhub/CoinGecko/Zillow]
    end

    subgraph "GitHub Actions (Automated)"
        PLAID_C[plaid_sync.py<br/>Daily 13:00 UTC]
        PLAID_I[plaid_investments_sync.py<br/>Weekdays 22:00 UTC]
        WHOOP_S[whoop/sync.py<br/>Daily 08:00 UTC]
        BODY_S[renpho_pull.py<br/>Daily 14:00 UTC]
        LABS[ingest_labs_gdrive.py<br/>Weekly Mon 09:00 UTC]
        BUILD_F[build_overload.py<br/>Daily 12:00 UTC]
        BUILD_M[build_dashboards.py<br/>Weekly Mon 10:00 UTC]
        BUILD_L[build_lyftr_v2.yml<br/>On push]
    end

    SUPA[(Supabase<br/>uuvsvtpfcexhqojlrsxy<br/>Single unified database)]

    subgraph "GitHub Pages"
        V1[v1 Dashboards<br/>index.html (landing)<br/>finances.html<br/>overload.html<br/>medical.html]
        V2[v2 React App<br/>lyftr/]
    end

    CHASE --> PLAID_C
    FIDELITY --> PLAID_I
    WHOOP --> WHOOP_S
    RENPHO --> BODY_S
    GDRIVE --> LABS

    PLAID_C --> SUPA
    PLAID_I --> SUPA
    WHOOP_S --> SUPA
    BODY_S --> SUPA
    LABS --> SUPA

    SUPA --> BUILD_F
    SUPA --> BUILD_M
    SUPA --> BUILD_L
    SUPA --> V1
    SUPA --> V2

    BUILD_F --> V1
    BUILD_M --> V1
    BUILD_L --> V2

    PRICES -->|Refresh Prices| SUPA

    style SUPA fill:#f59e0b,color:#000
    style V1 fill:#3b82f6,color:#fff
    style V2 fill:#8b5cf6,color:#fff
```

---

## 📊 Data Pipeline

**Single Supabase Database:** `uuvsvtpfcexhqojlrsxy`

**Finance Tables:**
- `expense_transactions` - Chase transactions (auto-synced daily)
- `stocks_crypto_history` - Investment holdings (auto-synced weekdays)
- `real_estate_history` - Property values (on-demand via Zillow API using Refresh Prices button)

**Health Tables:**
- `whoop_*` - Recovery, sleep, workouts (auto-synced daily)
- `body_composition` - Renpho scale data (auto-synced daily)
- `labs` - Medical lab results (auto-synced weekly from Google Drive)
- `nutrition_log`, `strength_*`, `exercises`, `workouts`, `completed_workouts`

---

## 🤖 Automated Workflows

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `pull-finances.yml` | Daily 13:00 UTC | Chase transactions via Plaid |
| `pull-investments.yml` | Weekdays 22:00 UTC | Fidelity holdings via Plaid |
| `whoop-daily-sync.yml` | Daily 08:00 UTC | WHOOP fitness data |
| `pull-body.yml` | Daily 14:00 UTC | Renpho body composition |
| `build-fitness.yml` | Daily 12:00 UTC | Rebuild Overload dashboard |
| `build-lyftr-v2.yml` | On push to exercise-app | Build & deploy React app |
| `medical-ingest-labs.yml` | Weekly Mon 09:00 UTC | Ingest lab PDFs from Drive |
| `medical-rebuild-dashboards.yml` | Weekly Mon 10:00 UTC | Rebuild medical dashboards |
| `medical-clean-drive.yml` | Monthly 1st 00:00 UTC | Clean Google Drive files |

---

## 🚀 Quick Start

### Local Development (v2 React App)
```powershell
cd health\fitness\exercise-app
npm install
npm run dev        # http://localhost:5173
```

### One-Time Setup (Finance Automation)
```powershell
# Connect Chase
cd finances\scripts
python plaid_link.py

# Connect Fidelity
python plaid_investments_link.py
```

### Manual Sync
```powershell
# Sync Chase transactions
python finances\scripts\plaid_sync.py

# Fetch property value
python finances\scripts\fetch_zillow_property_value.py
```

---

## 🔑 GitHub Secrets

Required secrets in **Settings → Secrets and variables → Actions:**

**Supabase:** `SUPABASE_URL`, `SUPABASE_KEY`  
**Plaid:** `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ACCESS_TOKEN`, `PLAID_FIDELITY_ACCESS_TOKEN`  
**WHOOP:** `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REFRESH_TOKEN`  
**Renpho:** `RENPHO_EMAIL`, `RENPHO_PASSWORD`  
**APIs:** `FINNHUB_KEY`, `ZILLOW_API_KEY`  
**Google:** `GOOGLE_CREDENTIALS`, `ANTHROPIC_API_KEY`  
**GitHub:** `GH_PAT`

---

## 📱 Mobile Access

The v2 Lyftr app is mobile-friendly and can be added to your home screen:

**iPhone:** Safari → Share → "Add to Home Screen"  
**Android:** Chrome → Menu → "Add to Home Screen"

---

## 📁 Repository Structure

```
personal/
├── index.html              # v1 landing page
├── finances/               # v1 finances dashboard + Plaid scripts
├── health/
│   ├── fitness/
│   │   ├── overload.html   # v1 fitness dashboard
│   │   └── exercise-app/   # v2 Lyftr React app
│   ├── medical/            # Medical dashboards + lab ingestion
│   ├── whoop/              # WHOOP sync scripts
│   └── body/               # Renpho sync scripts
├── lyftr/                  # v2 built React app (auto-generated)
└── vault/                  # Personal notes (gitignored)
```

---

## 🔗 Links

- **Live Site:** https://fernandomartinez-de.github.io/personal/
- **Supabase:** https://supabase.com/dashboard/project/uuvsvtpfcexhqojlrsxy
- **GitHub Actions:** https://github.com/fernandomartinez-de/personal/actions
- **GitHub Secrets:** https://github.com/fernandomartinez-de/personal/settings/secrets/actions
- **Plaid Dashboard:** https://dashboard.plaid.com/

---

## 📝 Notes

- **Security:** This repo is public. All secrets are in GitHub Secrets or gitignored `.env` files.
- **v2 Auto-Deploy:** Changes to `health/fitness/exercise-app/` automatically rebuild and deploy to `/lyftr/`.
- **WHOOP Token:** Auto-refreshes daily via `whoop-daily-sync.yml` workflow.
- **Real Estate Tracking:**
  - All values (home value, mortgage balance, net equity) read from Supabase `real_estate_history` table
  - **Zillow data:** Automated via "Refresh Prices" button (fetches via RapidAPI, writes to Supabase)
  - **Redfin data:** Manual entry into Supabase table
