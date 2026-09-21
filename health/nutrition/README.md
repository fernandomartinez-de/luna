# Nutrition · View-only day + trends

Cronometer-style daily view of what I ate versus what WHOOP says I burned, plus
a trends tab that shows the deficit playing out against body composition over
time. Read only. Food is logged elsewhere (by chat, straight into Supabase);
this page just displays.

Lives at `health/nutrition/` inside `fernandomartinez-de/personal` and is served
by GitHub Pages at:

    https://fernandomartinez-de.github.io/personal/health/nutrition/

## What it does

- **Today** (default) — Cronometer-style day view for the latest logged date.
  - Big headline: **Calories in (food) vs Calories out (WHOOP)** with a green
    "In a deficit, -X kcal" badge when out > in, red "Surplus, +X kcal" badge
    when in > out.
  - Macro tiles: protein, carbs, fat, fiber in grams and % of calories.
    Protein tile shows target = round(2.0 * latest weight_kg) g and flags when
    under.
  - Food diary: nutrition_log rows grouped by meal, with quantity, calories,
    and macros per row, plus a day-total row at the bottom.
- **Trends** — history over time.
  - Daily calories in vs out as paired bars with net-kcal overlay.
  - Daily protein bars with the target line drawn on.
  - Body composition overlay (weight kg + body fat %) so the deficit connects
    to the result.

Metric units throughout. No input controls anywhere on the page.

## How the data gets in

Data is **baked in at build time**, not fetched in the browser, so no database
credential ever ships to the page.

    template.html  ->  build_nutrition.py (reads Supabase REST with SUPABASE_URL + SUPABASE_KEY)  ->  index.html

`build_nutrition.py` injects three JSON payloads into `template.html`:

    __TODAY_DATA__   - day view for the latest logged date + meal groupings
    __TRENDS_DATA__  - N days of {caloriesIn, caloriesOut, protein_g} + body series
    __META_DATA__    - build timestamp

The `Build Nutrition` GitHub Action runs every morning and commits the
refreshed `index.html`; `workflow_dispatch` refreshes on demand after logging.

## Schema

Reads three tables from Supabase (project ref `uuvsvtpfcexhqojlrsxy`):

    public.nutrition_log(logged_date, meal, item, quantity,
                         calories_kcal, protein_g, carbs_g, fat_g, fiber_g)
    public.whoop_cycles(start_time, calories_kcal, kilojoules)
    public.body_composition(measured_at, weight_kg, body_fat_pct)

Rules baked into the build:

- WHOOP calories out per day = `whoop_cycles.calories_kcal`, or
  `kilojoules / 4.184` when calories_kcal is null. Grouped by `start_time::date`.
- Net = calories in - calories out. Negative = deficit (good on a cut).
- Protein target = `round(2.0 * latest body_composition.weight_kg)` grams.
- A day is "on target" only if protein for that day >= the current target.

## Files

    health/nutrition/template.html          App with the three __*_DATA__ tokens
    health/nutrition/build_nutrition.py     Pulls log + cycles + body, renders index.html
    health/nutrition/app.js                 Client-side rendering, Chart.js trends
    health/nutrition/index.html             The built, served page (do not hand edit)
    health/nutrition/requirements.txt       supabase python client
    .github/workflows/build-nutrition.yml   Daily rebuild + commit

## Setup

1. Repo secrets `SUPABASE_URL` and `SUPABASE_KEY` must already exist (Settings
   > Secrets and variables > Actions). Same secrets as `build-fitness.yml` and
   `health/whoop/sync.py` — no new key needed.
2. GitHub Pages serves from branch `main`, path `/ (root)`, so the
   `health/nutrition/` path resolves.
3. Push. The Action refreshes `index.html` daily at 12:15 UTC (~08:15 EDT) and
   on manual dispatch (Actions tab > Build Nutrition > Run workflow).

## Run locally

    export SUPABASE_URL="https://<ref>.supabase.co"
    export SUPABASE_KEY="<anon-or-service-role-key>"
    pip install -r health/nutrition/requirements.txt
    python health/nutrition/build_nutrition.py
    python health/nutrition/build_nutrition.py --days 90

## Notes

- **Privacy**: this repo is public, so `index.html` and the food + WHOOP burn
  numbers baked into it are readable by anyone with the URL. Do not treat the
  Pages URL as private.
- **View only**: this page never accepts input. Food is logged upstream, the
  `nutrition_log` table is updated for me, and the next scheduled build (or
  manual dispatch) picks the new rows up.
- **Not medical or nutrition advice.** Just a display of what the log says.
