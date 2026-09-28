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

## 🗄️ Supabase Tables

Everything lives in a single Supabase project (**`uuvsvtpfcexhqojlrsxy`** – "Personal"). Grouped by domain below; every row is either fed by one of the workflows above or written on demand by the v2 Lyftr app or a manual script.

### Finance

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `expense_transactions` | Categorized Chase transactions (checking + 2 credit cards) | `pull-finances.yml` (`plaid_sync.py`); manual backfills | v1 `finances.html`, v2 Lyftr Expenses, `vw_dashboard_summary` |
| `plaid_accounts` | Map of Plaid account IDs → masked account + source label | One-time `finances/scripts/plaid_link.py` | `plaid_sync.py` |
| `plaid_sync_state` | Plaid `/transactions/sync` cursor per item | `plaid_sync.py` (updated every run) | `plaid_sync.py` |
| `category_mapping` | Merchant pattern → category rules | Manual SQL inserts | `plaid_sync.py`, `vw_category_mapping` |
| `stocks_crypto_history` | Daily snapshot of stocks, crypto, retirement, brokerage holdings | `pull-investments.yml` (`plaid_investments_sync.py`, Fidelity Retirement/Brokerage rows); v2 Lyftr **Refresh Prices** button (Finnhub stocks + CoinGecko crypto) | v1 `finances.html`, v2 Lyftr Investments |
| `real_estate_history` | Property value + mortgage balance snapshots (Zillow + Redfin) | Manual `fetch_zillow_property_value.py`; v2 Lyftr **Refresh Prices** button (Zillow via RapidAPI) | v1 `finances.html`, v2 Lyftr Investments |

### Health – WHOOP + Body

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `whoop_recovery` | Daily recovery score, HRV, RHR | `whoop-daily-sync.yml` (`health/whoop/sync.py`) | v1 Overload, v2 Lyftr (hub, oncologist), medical dashboards |
| `whoop_cycles` | Daily physiological cycle (strain, calories, sleep coefficient) | `whoop-daily-sync.yml` | v1 Overload, v2 Lyftr, medical dashboards |
| `whoop_sleep` | Sleep sessions (duration, efficiency, stages) | `whoop-daily-sync.yml` | v1 Overload, medical dashboards |
| `whoop_workouts` | WHOOP-tagged workouts (sport, strain, calories) | `whoop-daily-sync.yml` | v1 Overload, v2 Lyftr Workouts, medical dashboards |
| `whoop_body` | Height, weight, max HR, VO2 max snapshot | `whoop-daily-sync.yml` | v2 Lyftr, medical dashboards |
| `body_composition` | Renpho scale readings (weight, body fat %, muscle, water, bone) | `pull-body.yml` (`health/body/renpho_pull.py`) | v2 Lyftr (Hub, Weight page, Nutritionist Renpho card) |

### Medical

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `lab_results` | Categorized lab values from PDFs (marcador, valor, unidad, ref_min/max, flag, panel) — panel normalized to 11 canonical categories on ingest | `medical-ingest-labs.yml` (`ingest_labs_gdrive.py`, LLM extraction) | v2 Lyftr Oncologist/Nutritionist, `martinez_*_dashboard.html` via `medical-rebuild-dashboards.yml` |
| `inbody_results` | InBody bioimpedance scan snapshots (peso, mme, masa_grasa, pgc, agua, tmb, angulo_fase, score, grasa_visceral) | `medical-ingest-labs.yml` (parses InBody images in the same Drive folder) | v2 Lyftr Nutritionist (composition ring, scan comparison), medical dashboards |

### Nutrition

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `nutrition_log` | Logged food entries (meal, item, kcal, macros) | v2 Lyftr Food page (manual) | v2 Lyftr Food + Nutritionist (macro trend, meal distribution) |
| `meal_templates` | Reusable meal blueprints for one-tap logging | Manual seed | v2 Lyftr Food picker |
| `meal_plan` | Weekly meal-plan structure | Manual | v2 Lyftr (planned use) |

### Training

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `exercises` | Master exercise catalog (name, muscle_group, level, equipment) | Manual seed / one-off imports | v2 Lyftr Exercises + Workouts pages |
| `workouts` | Saved workout templates | v2 Lyftr Workouts (Save Workout) | v2 Lyftr Workouts, Home last-workout tile |
| `workout_exercises` | Ordered exercises inside each saved workout (sets/reps/order_index) | v2 Lyftr Workouts | v2 Lyftr Workout Detail |
| `completed_workouts` | Logged workout sessions (linked to `workouts` + a WHOOP session when available) | v2 Lyftr Workouts (Assign to WHOOP session) | v2 Lyftr Home (Muscle Balance, Consistency Heatmap) |
| `completed_workout_exercises` | Per-exercise records inside a completed workout | v2 Lyftr | v2 Lyftr |
| `strength_sessions` | Legacy strength-training session log | External import (out of repo) | `build_overload.py` (last-lift lookups in Overload dashboard) |
| `strength_exercises` | Legacy strength-training exercise metadata | External import | `build_overload.py` |
| `strength_sets` | Legacy strength-training per-set records | External import | `build_overload.py` |
| `strength_ingest_log` | Audit log of strength imports (row counts, timestamps) | External import runs | Diagnostics only |
| `training_plan` | Weekly training-day plan (`dow` → `training_type` + load) | Manual seed | v2 Lyftr Workouts (Weekly Suggestions), `build_overload.py` |
| `running_log` | Manual/imported run log (date + distance_km) | Manual | v2 Lyftr Workouts (Weekly Suggestions vs actual), `build_overload.py` |

### Config

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `app_config` | Generic key/value app config | Manual | Any script/app that needs runtime config |

### Views (read-only, defined in Supabase)

| View | Aggregates | Consumed by |
|------|------------|-------------|
| `vw_category_groups` | Category grouping hierarchy | v1/v2 finance dashboards |
| `vw_category_mapping` | Read-only projection of `category_mapping` | Dashboards, `plaid_sync.py` |
| `vw_dashboard_summary` | Monthly totals per category (all categories) | v1 `finances.html` breakdown, v2 Lyftr Expenses (Net Remaining Trend + Category Distribution heatmap) |
| `vw_discretionary_summary` | Monthly discretionary spend by category (excludes fixed costs) | v1 `finances.html`, v2 Lyftr Expenses (Monthly Discretionary Trend, Top Categories) |
| `vw_fixed_costs_summary` | Monthly fixed-cost baseline with 12-month averages | v1 `finances.html`, v2 Lyftr Expenses (Income & Expenses list) |

### At a glance – table → workflow map

- **`pull-finances.yml`** writes → `expense_transactions`, `plaid_sync_state`; reads → `plaid_accounts`, `category_mapping`
- **`pull-investments.yml`** writes → `stocks_crypto_history` (Retirement / Brokerage rows only)
- **`whoop-daily-sync.yml`** writes → `whoop_recovery`, `whoop_cycles`, `whoop_sleep`, `whoop_workouts`, `whoop_body`
- **`pull-body.yml`** writes → `body_composition`
- **`medical-ingest-labs.yml`** writes → `lab_results`, `inbody_results`
- **`medical-rebuild-dashboards.yml`** reads → `lab_results`, `inbody_results`, `whoop_*`
- **`medical-clean-drive.yml`** does not touch Supabase (Drive housekeeping only)
- **`build-fitness.yml`** reads → `whoop_*`, `body_composition`, `strength_*`, `training_plan`, `running_log`, `completed_workouts`, `nutrition_log`
- **`build-lyftr-v2.yml`** does not touch Supabase (compiles the React app; the app then reads/writes at runtime via the anon key)

Manual writes (no workflow): `plaid_accounts` (one-time link), `category_mapping` (SQL), `exercises` / `meal_templates` / `training_plan` / `running_log` / `app_config` (seed data), `real_estate_history` (Redfin manual script + Zillow via v2 Refresh Prices).

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
