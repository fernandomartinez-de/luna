# Supabase tables

Everything lives in one Supabase project (**`uuvsvtpfcexhqojlrsxy`**, "Personal"). Grouped by domain. Every row is written either by one of the workflows in [maintainers.md](maintainers.md#workflows) or by the Lyftr app itself.

## Finance

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `expense_transactions` | Categorized Chase transactions (checking + 2 credit cards) | `pull-finances.yml` (`plaid_sync.py`); manual backfills | v1 finances, v2 Lyftr Expenses, `vw_dashboard_summary` |
| `plaid_accounts` | Map of Plaid account IDs to masked account + source label | One-time `finances/scripts/plaid_link.py` | `plaid_sync.py` |
| `plaid_sync_state` | Plaid `/transactions/sync` cursor per item | `plaid_sync.py` (every run) | `plaid_sync.py` |
| `category_mapping` | Merchant pattern → category rules | Manual SQL | `plaid_sync.py`, `vw_category_mapping` |
| `stocks_crypto_history` | Daily snapshot of stocks, crypto, retirement, brokerage holdings | `pull-investments.yml`; v2 Lyftr Refresh Prices (Finnhub + CoinGecko) | v1 finances, v2 Lyftr Investments |
| `real_estate_history` | Property value + mortgage balance snapshots (Zillow + Redfin) | Manual `fetch_zillow_property_value.py`; v2 Lyftr Refresh Prices (Zillow) | v1 finances, v2 Lyftr Investments |

## Health — WHOOP + Body

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `whoop_recovery` | Daily recovery score, HRV, RHR | `whoop-daily-sync.yml` | v2 Lyftr, medical dashboards |
| `whoop_cycles` | Daily physiological cycle (strain, calories, sleep coefficient) | `whoop-daily-sync.yml` | v2 Lyftr, medical dashboards |
| `whoop_sleep` | Sleep sessions (duration, efficiency, stages) | `whoop-daily-sync.yml` | medical dashboards |
| `whoop_workouts` | WHOOP-tagged workouts | `whoop-daily-sync.yml` | v2 Lyftr Workouts, medical dashboards |
| `whoop_body` | Height, weight, max HR, VO2 max snapshot | `whoop-daily-sync.yml` | v2 Lyftr, medical dashboards |
| `body_composition` | Renpho scale readings | `pull-body.yml` (`renpho_pull.py`) | v2 Lyftr (Hub, Weight, Nutritionist) |

## Medical

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `lab_results` | Lab values from PDFs, 11 canonical panels | `medical-ingest-labs.yml` (LLM extraction) | v2 Lyftr Oncologist/Nutritionist |
| `inbody_results` | InBody bioimpedance scan snapshots | `medical-ingest-labs.yml` | v2 Lyftr Nutritionist |

## Nutrition

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `nutrition_log` | Logged food entries | v2 Lyftr Food page (manual) | v2 Lyftr Food + Nutritionist |
| `meal_templates` | Reusable meal blueprints | Manual seed | v2 Lyftr Food picker |
| `meal_plan` | Weekly meal plan | Manual | v2 Lyftr |

## Training

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `exercises` | Master exercise catalog | Manual seed / imports | v2 Lyftr Exercises + Workouts |
| `workouts` | Saved workout templates | v2 Lyftr Workouts (Save Workout) | v2 Lyftr |
| `workout_exercises` | Ordered exercises inside a saved workout | v2 Lyftr | v2 Lyftr |
| `completed_workouts` | Logged workout sessions | v2 Lyftr (Assign to WHOOP session) | v2 Lyftr Home |
| `completed_workout_exercises` | Per-exercise records | v2 Lyftr | v2 Lyftr |
| `strength_sessions` / `strength_exercises` / `strength_sets` / `strength_ingest_log` | Legacy strength-training log | External import | Legacy build_overload.py (v1 archive) |
| `training_plan` | Weekly training-day plan | Manual seed | v2 Lyftr Workouts |
| `running_log` | Manual run log (date + distance_km) | Manual | v2 Lyftr Workouts |

## Config

| Table | Purpose | Written by | Read by |
|-------|---------|------------|---------|
| `app_config` | Generic key/value app config | Manual | Any script/app that needs runtime config |

## Views (read-only)

| View | Aggregates | Consumed by |
|------|------------|-------------|
| `vw_category_groups` | Category grouping hierarchy | Finance dashboards |
| `vw_category_mapping` | Read-only projection of `category_mapping` | Dashboards, `plaid_sync.py` |
| `vw_dashboard_summary` | Monthly totals per category | v1 finances breakdown, v2 Lyftr Expenses |
| `vw_discretionary_summary` | Monthly discretionary spend by category | v1 finances, v2 Lyftr Expenses |
| `vw_fixed_costs_summary` | Monthly fixed-cost baseline (12-month averages) | v1 finances, v2 Lyftr Expenses |

## Row-level security

Every table has RLS on. Two roles matter:

- **`anon`** — used by the Lyftr frontend. Read-most, write only where an "anon write" policy exists (`completed_workouts`, `completed_workout_exercises`, `workouts`, `workout_exercises`, `nutrition_log`, `real_estate_history`, `stocks_crypto_history`).
- **`service_role`** — used by every backend workflow. Bypasses RLS entirely. Never sent to the browser. Stored as GitHub secret `SUPABASE_SERVICE_ROLE_KEY`.

If a new backend script gets "new row violates row-level security policy" it's missing the service_role key. See [maintainers.md](maintainers.md#secrets).
