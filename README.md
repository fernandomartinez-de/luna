# Personal Dashboard & Automation

Everything I track about my money, my body, and my health, in one place, updated automatically every day.

**Live site:** https://fernandomartinez-de.github.io/personal/

---

## What this is

I used to check ten different apps to see how I was doing: Chase for spending, Fidelity for retirement, WHOOP for sleep and workouts, Renpho for weight, a folder of PDFs for lab results, Zillow for the condo. Each one had its own login, its own chart, its own way of showing me numbers.

This repo replaces all of that with two things:

1. **One database** that pulls in the data every day, automatically.
2. **One app on my phone** (plus a couple of printer-friendly web pages) that reads from it.

I don't have to click anything. Every morning a set of small robots grabs the latest data from each service and updates the database. When I open the app on my phone, the numbers are already there.

---

## What you'll see if you open the site

Go to [fernandomartinez-de.github.io/personal](https://fernandomartinez-de.github.io/personal/) and you get a landing page with links to two versions of the same idea.

**The old version (v1)** — plain web pages, one per topic. Good for printing and sharing with a doctor.

- [Finances](https://fernandomartinez-de.github.io/personal/finances/finances.html) — spending, investments, property value
- [Fitness](https://fernandomartinez-de.github.io/personal/health/fitness/overload.html) — WHOOP data, workouts, running
- [Medical](https://fernandomartinez-de.github.io/personal/health/medical/medical.html) — lab results, ready for oncologist or nutritionist

**The new version (v2), called Lyftr** — a proper app, built to feel good on a phone.

- [Lyftr](https://fernandomartinez-de.github.io/personal/lyftr/) — everything in one place, with cleaner charts and interactive tabs

Both versions read from the same database, so the numbers agree.

---

## How it all fits together

[![Architecture diagram](docs/assets/architecture.png)](docs/assets/architecture.html)

*Click the image for the interactive version (pan, zoom, dark/light, guided views).*

In plain words:

- On the left: **outside services** I already use (bank, gym, scale, cloud storage).
- In the middle: **automated jobs** on GitHub grab data from those services on a schedule, and a single **Supabase database** stores it all.
- On the right: **two dashboards** read from that database. I look at them.

Two things happen outside the daily automation:

- **Live prices** for stocks, crypto, and the condo — I press a button in the app when I want them refreshed.
- **Redfin** — the one thing I still enter by hand once a month, since Redfin blocks in-browser fetching.

---

## How the "no clicks" part works

There's a service called **GitHub Actions** that lets you schedule little programs to run on someone else's computer. This repo has nine of them, each doing one small job:

| Job | How often | What it does |
|----------|----------|---------|
| Chase transactions | Every morning | Pulls yesterday's spending and categorizes it |
| Fidelity holdings | Every weekday evening | Pulls the retirement account balance |
| WHOOP sync | Every morning | Pulls sleep, recovery, and workout data |
| Renpho scale | Every afternoon | Pulls weight and body composition |
| Fitness dashboard rebuild | Every day at noon | Re-generates the v1 fitness page |
| Lyftr app rebuild | When I push code | Rebuilds the phone app |
| Lab ingestion | Every Monday morning | Reads new lab PDFs, extracts the numbers |
| Medical dashboard rebuild | Every Monday morning | Re-generates the printable medical pages |
| Drive cleanup | 1st of each month | Cleans out old temporary files |

All of these run automatically. I don't have to do anything.

---

## Why one database and not many

Every piece of data — a workout, a grocery charge, a cholesterol reading — ends up in the same Postgres database on Supabase.

The advantage is that everything can be joined together. I can ask "did my HRV drop the week I ate out three times?" because both the WHOOP data and the restaurant charges are in the same place.

The full list of tables and what each one is for is in [Appendix: Tables](#appendix-tables) at the bottom, if you're curious.

---

## Everyday use

**Morning:** open Lyftr on my phone. It's pinned to the home screen and looks like a normal app. I see:
- Recovery score and sleep from last night
- Any new lab result that came in
- Portfolio value (if I unlock it with a PIN)
- Today's suggested workout

**When labs come back:** they land in Google Drive as PDFs. Monday morning, the lab-ingestion job reads them, extracts the numbers, and drops them into the database. By the time I look Monday afternoon, the trend chart already includes the new reading.

**Doctor's appointment:** I open the v1 medical page and either print it or share the URL. It's already formatted the way an oncologist expects — panels, reference ranges, trend chart per marker.

**Monthly finance review:** I open Lyftr → Finances. Discretionary spending trend, category heatmap, net remaining chart. If a merchant showed up as "Miscellaneous" I add one line of SQL to the mapping table and it categorizes correctly next time.

---

## Putting the app on your phone

The Lyftr app isn't in the App Store — it's a website designed to work like an app.

**iPhone:** open [the Lyftr link](https://fernandomartinez-de.github.io/personal/lyftr/) in Safari, tap the Share button, then "Add to Home Screen."

**Android:** open the same link in Chrome, tap the menu, then "Add to Home Screen."

That's it. It'll show up alongside your other apps.

---

## Is this safe / private?

The repo is **public**, meaning anyone on the internet can read the code. But:

- No passwords, API keys, or personal secrets are in the code itself. They're stored in a separate encrypted spot on GitHub called "Secrets."
- The Supabase database uses row-level security, so even someone with the anon key can only read the tables I've marked as safe to expose.
- No real client work or company data is here. This is my personal setup.

---

# For maintainers

Everything below is the technical stuff. If you're not planning to change the code, you can stop reading here.

## Live URLs

- **Site:** https://fernandomartinez-de.github.io/personal/
- **Supabase:** https://supabase.com/dashboard/project/uuvsvtpfcexhqojlrsxy
- **GitHub Actions:** https://github.com/fernandomartinez-de/personal/actions
- **GitHub Secrets:** https://github.com/fernandomartinez-de/personal/settings/secrets/actions
- **Plaid Dashboard:** https://dashboard.plaid.com/

## Local development

```powershell
cd health\fitness\exercise-app
npm install
npm run dev        # http://localhost:5173
```

## One-time setup for finance automation

```powershell
cd finances\scripts
python plaid_link.py                # Connect Chase
python plaid_investments_link.py    # Connect Fidelity
```

## Manual re-sync (rarely needed)

```powershell
python finances\scripts\plaid_sync.py                       # Chase transactions
python finances\scripts\fetch_zillow_property_value.py      # Condo value
```

## GitHub secrets required

**Supabase:** `SUPABASE_URL`, `SUPABASE_KEY`
**Plaid:** `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ACCESS_TOKEN`, `PLAID_FIDELITY_ACCESS_TOKEN`
**WHOOP:** `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REFRESH_TOKEN`
**Renpho:** `RENPHO_EMAIL`, `RENPHO_PASSWORD`
**APIs:** `FINNHUB_KEY`, `ZILLOW_API_KEY`
**Google:** `GOOGLE_CREDENTIALS`, `ANTHROPIC_API_KEY`
**GitHub:** `GH_PAT`

## Repository layout

```
personal/
├── index.html              # v1 landing page
├── finances/               # v1 finances dashboard + Plaid scripts
├── health/
│   ├── fitness/
│   │   ├── overload.html   # v1 fitness dashboard
│   │   └── exercise-app/   # v2 Lyftr React app source
│   ├── medical/            # Medical dashboards + lab ingestion
│   ├── whoop/              # WHOOP sync scripts
│   └── body/               # Renpho sync scripts
├── lyftr/                  # v2 built React app (auto-generated)
├── docs/assets/            # Architecture diagram
└── vault/                  # Personal Obsidian notes (gitignored)
```

## GitHub Actions workflows

| Workflow file | Schedule (UTC) | Purpose |
|----------|----------|---------|
| `pull-finances.yml` | Daily 13:00 | Chase transactions via Plaid |
| `pull-investments.yml` | Weekdays 22:00 | Fidelity holdings via Plaid |
| `whoop-daily-sync.yml` | Daily 08:00 | WHOOP fitness data |
| `pull-body.yml` | Daily 14:00 | Renpho body composition |
| `build-fitness.yml` | Daily 12:00 | Rebuild Overload dashboard |
| `build-lyftr-v2.yml` | On push to exercise-app | Build & deploy React app |
| `medical-ingest-labs.yml` | Weekly Mon 09:00 | Ingest lab PDFs from Drive |
| `medical-rebuild-dashboards.yml` | Weekly Mon 10:00 | Rebuild medical dashboards |
| `medical-clean-drive.yml` | Monthly 1st 00:00 | Clean Google Drive files |

---

## Appendix: Tables

Everything lives in a single Supabase project (**`uuvsvtpfcexhqojlrsxy`**, project name "Personal"). Grouped by domain. Every row is fed either by one of the workflows above, or written on demand by the Lyftr app, or seeded by a manual script.

### Finance

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `expense_transactions` | Categorized Chase transactions (checking + 2 credit cards) | `pull-finances.yml` (`plaid_sync.py`); manual backfills | v1 `finances.html`, v2 Lyftr Expenses, `vw_dashboard_summary` |
| `plaid_accounts` | Map of Plaid account IDs to masked account + source label | One-time `finances/scripts/plaid_link.py` | `plaid_sync.py` |
| `plaid_sync_state` | Plaid `/transactions/sync` cursor per item | `plaid_sync.py` (updated every run) | `plaid_sync.py` |
| `category_mapping` | Merchant pattern to category rules | Manual SQL inserts | `plaid_sync.py`, `vw_category_mapping` |
| `stocks_crypto_history` | Daily snapshot of stocks, crypto, retirement, brokerage holdings | `pull-investments.yml` (`plaid_investments_sync.py`, Fidelity Retirement/Brokerage rows); v2 Lyftr **Refresh Prices** button (Finnhub stocks + CoinGecko crypto) | v1 `finances.html`, v2 Lyftr Investments |
| `real_estate_history` | Property value + mortgage balance snapshots (Zillow + Redfin) | Manual `fetch_zillow_property_value.py`; v2 Lyftr **Refresh Prices** button (Zillow via RapidAPI) | v1 `finances.html`, v2 Lyftr Investments |

### Health — WHOOP + Body

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
| `lab_results` | Categorized lab values from PDFs (marcador, valor, unidad, ref_min/max, flag, panel), panel normalized to 11 canonical categories on ingest | `medical-ingest-labs.yml` (`ingest_labs_gdrive.py`, LLM extraction) | v2 Lyftr Oncologist/Nutritionist, `martinez_*_dashboard.html` via `medical-rebuild-dashboards.yml` |
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
| `training_plan` | Weekly training-day plan (`dow` to `training_type` + load) | Manual seed | v2 Lyftr Workouts (Weekly Suggestions), `build_overload.py` |
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

### Table-to-workflow map

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

## Notes

- **v2 auto-deploy:** any change pushed to `health/fitness/exercise-app/` triggers `build-lyftr-v2.yml`, which builds the React bundle, copies it to `lyftr/`, and commits the build.
- **WHOOP token:** auto-refreshes daily via `whoop-daily-sync.yml`.
- **Real estate:** all values (home, mortgage, net equity) live in `real_estate_history`. Zillow auto-refreshes via the app's Refresh Prices button; Redfin is a manual entry (CORS blocks in-browser fetch).
