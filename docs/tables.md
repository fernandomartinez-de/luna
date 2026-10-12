# Database reference

Everything lives in one Supabase project (`uuvsvtpfcexhqojlrsxy`). The full definition of every table, view and function is in [`supabase/schema.sql`](../supabase/schema.sql); this page explains what each one is for.

**Who writes:** either a scheduled workflow (using the service key) or me through the Luna app.
**Who reads:** Luna, after I sign in.

---

## Finance

| Table | What's in it | Written by |
|-------|--------------|------------|
| `expense_transactions` | Every Chase transaction with its category | Pull Finances (daily); category edits from the app |
| `category_mapping` | Rules: "description contains X → category Y" | By hand, or "Remember this" in the app |
| `finance_alerts` | Money alerts: double charges, new subscriptions, fees, price increases | Pull Finances (after each sync) |
| `finance_alert_mutes` | Alert types I've muted for a merchant | The app (dismiss and mute) |
| `plaid_accounts` | Plaid account ids and their masked names | Pull Finances |
| `plaid_sync_state` | Where the last Plaid sync stopped | Pull Finances |
| `stocks_crypto_history` | Daily holdings snapshots: retirement, brokerage, stocks, crypto | Pull Investments (weekdays) |
| `real_estate_history` | Home value and mortgage balance snapshots | By hand, monthly (see [finances/README.md](../finances/README.md#home-value)) |

New transactions are categorized automatically by a database trigger that applies the rules in `category_mapping`. A category set by hand is protected from being overwritten.

### Spending views

These summarize `expense_transactions` for the Expenses tab. They follow the same sign in rule as the tables.

| View | Shows |
|------|-------|
| `vw_category_groups` | Each category labeled Fixed Costs, Discretionary or Excluded (transfers, payroll, card payments) |
| `vw_dashboard_summary` | Monthly total per category (fixed + discretionary) |
| `vw_discretionary_summary` | Monthly total per discretionary category |
| `vw_fixed_costs_summary` | Latest amount for each fixed cost (mortgage, HOA, utilities, insurance) |
| `vw_category_mapping` | The rules grouped by category |

---

## Health

| Table | What's in it | Written by |
|-------|--------------|------------|
| `whoop_recovery` | Daily recovery score, HRV, resting heart rate | Whoop Sync |
| `whoop_cycles` | Daily strain, calories, heart rate | Whoop Sync |
| `whoop_sleep` | Sleep sessions: duration, efficiency, stages | Whoop Sync |
| `whoop_workouts` | Workouts WHOOP detected | Whoop Sync |
| `whoop_body` | Height, weight, max heart rate | Whoop Sync |
| `body_composition` | Scale readings: weight, body fat, muscle, water | Pull Body Composition (daily) |

## Medical

Column names are in Spanish to match the lab reports (`fecha` = date, `marcador` = marker, `valor` = value).

| Table | What's in it | Written by |
|-------|--------------|------------|
| `lab_results` | One row per lab marker per report, with reference range and flag | Medical - Process Inbox |
| `inbody_results` | InBody body scan results | Medical - Process Inbox |

## Nutrition

| Table | What's in it | Written by |
|-------|--------------|------------|
| `nutrition_log` | Food I've logged | The app (Food page) |
| `meal_templates` | Reusable meals to log quickly | By hand |
| `meal_plan` | Planned meals by date | By hand |

## Training

| Table | What's in it | Written by |
|-------|--------------|------------|
| `exercises` | Exercise library (about 870, with muscles, equipment, instructions, images) | Imported once |
| `workouts` | Saved workout templates | The app |
| `workout_exercises` | The exercises inside each template | The app |
| `completed_workouts` | Workouts I've done, optionally linked to a WHOOP workout | The app |
| `completed_workout_exercises` | Sets and reps for each completed workout | The app |
| `training_plan` | What to train each day of the week | By hand |
| `running_log` | Runs: date and distance | By hand |
| `strength_sessions`, `strength_exercises`, `strength_sets`, `strength_ingest_log` | Old strength log, kept for history | Nothing (legacy) |

## Config

| Table | What's in it |
|-------|--------------|
| `app_config` | Key and value settings |

---

## Functions the app calls

| Function | What it does |
|----------|--------------|
| `recategorize_transaction` | Changes a transaction's category and optionally saves a rule |
| `dismiss_finance_alert` | Dismisses an alert, optionally muting that alert type for the merchant |
| `get_dashboard_stats` | Average monthly money left after fixed costs, and average discretionary spending |

---

## Security

Every table has one rule, `owner_only`: only a signed in session with my email can read or write it.

| Who | Can do |
|-----|--------|
| My signed in Luna session | Read and write everything |
| The public key in the app, on its own | Nothing |
| The sync workflows (service key) | Everything; the service key skips the rules, which is why it stays in GitHub Secrets |

A new table must get the same rule or Luna will see it as empty. The exact SQL is in [operations.md](operations.md#add-a-new-table).
