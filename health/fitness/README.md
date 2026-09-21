# Overload · Cut to Abs (Training + Nutrition)

Personal training + nutrition advisor for a 19-week cut ending in early
February. Opens on the phone, top-level segmented control switches between
two domains:

- **Training** — mesocycle week, the four lifting categories with primaries
  and accessories, "copy-into-WHOOP" block, body-fat trend from the scale.
  WHOOP logs the workout; this only advises.
- **Nutrition** — view-only Cronometer-style Today (calories in from food vs
  out from WHOOP, deficit / surplus badge, macros vs target, meal-grouped
  diary) and Trends (rolling deficit, protein-on-target, body-comp overlay).
  Food is logged elsewhere (by chat) into `nutrition_log`; this page only
  displays.

Lives at `health/fitness/` inside `fernandomartinez-de/personal` and is served
by GitHub Pages at:

    https://fernandomartinez-de.github.io/personal/health/fitness/

## What it does

- **Plan** — the cut goal, timeline to Early February, and body-fat / weight
  trend from `public.body_composition`.
- **Session** — pick a category (Chest & Tricep, Back & Bicep, Legs,
  Olympic & Shoulder, or the Mornings block) and get this week's sets, reps,
  RPE, and a "Copy to WHOOP" block.
- **Block** — the whole 19-week mesocycle table with block/phase/primary/
  accessory targets, current week highlighted.
- **Method** — the evidence base: mechanical tension, cut retention leans on
  intensity not volume, 10-20 hard sets per muscle per week at 0-3 RIR,
  full-ROM with a loaded stretch, primaries for stimulus-to-fatigue. Real
  citations to Schoenfeld, Refalo, Kassiano, Wolf, Maeo, Helms, Longland,
  and Suchomel.

No recovery, HRV, sleep, or strain UI. Weights in kg.

## Mesocycle structure

Four blocks across 19 weeks, deloads at weeks 5, 10, 15, sharpen at week 19.

| Block | Weeks | Name             | What it does                                               |
|-------|-------|------------------|------------------------------------------------------------|
| 1     | 1-5   | Accumulation     | Baseline primaries at moderate RPE; highest accessory volume |
| 2     | 6-10  | Intensification  | Push primary RPE to 8-9; accessory volume held             |
| 3     | 11-15 | Peak Intensity   | Primaries at RPE 9 on top sets; accessories taper          |
| 4     | 16-19 | Retention        | Keep primary intensity, cut accessory volume, sharpen wk 19 |

The programming principle: keep primaries heavy across the cut so intensity
signals muscle retention (Refalo 2023, Grgic 2022); pull back accessory volume
as the deficit deepens because recovery falls. Nutrition is out of scope.

## How the data gets in

Data is **baked in at build time**, not fetched in the browser, so no database
credential ever ships to the page.

    template.html  ->  build_overload.py (reads Supabase REST with SUPABASE_URL + SUPABASE_KEY)  ->  index.html

`build_overload.py` injects five JSON payloads into `template.html`:

    __PLAN_DATA__       - mesocycle timeline + current week (computed from date)
    __BODY_DATA__       - public.body_composition history (weight_kg, body_fat_pct, ...)
    __WORKOUTS_DATA__   - whoop_workouts cadence counts (no strain surfaced)
    __STRENGTH_DATA__   - last kg/reps per primary lift (strength_sessions/sets/exercises)
    __NUTRITION_DATA__  - nutrition_log grouped by day + meal, whoop_cycles calories out,
                          protein target from body_composition weight

The `Build Overload` GitHub Action runs it every morning and commits the
refreshed `index.html`.

## Files

    health/fitness/template.html        App with the four __*_DATA__ tokens
    health/fitness/build_overload.py    Pulls body/workouts/strength, renders index.html
    health/fitness/app.js               Client-side rendering, mesocycle table, categories, method
    health/fitness/index.html           The built, served page (do not hand edit)
    health/fitness/requirements.txt     psycopg2-binary
    .github/workflows/build-fitness.yml Daily rebuild + commit

## Setup

1. Confirm the repo secrets `SUPABASE_URL` and `SUPABASE_KEY` exist (Settings
   > Secrets and variables > Actions). Direct-Postgres `SUPABASE_DB_URL` is
   no longer used because that host is IPv6-only and GitHub Actions is IPv4.
2. GitHub Pages serves from branch `main`, path `/ (root)`, so the
   `health/fitness/` path resolves.
3. Push. The Action refreshes `index.html` daily and on manual dispatch
   (Actions tab > Build Overload > Run workflow).
4. On phone, open the Pages URL and Add to Home Screen for an app icon.

## Run locally

    export SUPABASE_URL="https://<ref>.supabase.co"
    export SUPABASE_KEY="<anon-or-service-role-key>"
    pip install -r health/fitness/requirements.txt
    python health/fitness/build_overload.py

## Notes

- **Privacy**: this repo is public, so `index.html` and the body-composition
  numbers baked into it are readable by anyone with the URL. Do not treat the
  Pages URL as private.
- **Schema**: reads `public.body_composition(measured_at, weight_kg, body_fat_pct, muscle_mass_kg, bmi)`
  populated by the Renpho pull; `whoop_workouts(start_time, sport_name)` for
  cadence only; `strength_sessions / strength_sets / strength_exercises` for
  primary-lift history if populated.
- **Mesocycle dates**: `MESO_START` (2026-09-21) and `MESO_END` (2027-02-01)
  are constants in `build_overload.py`. Change them there to reset the cycle.
- **Fitness plan, not medical advice**. See Method tab for the evidence base
  and citations.
