# Overload

Personal hypertrophy training app. Opens in the gym, tells you what to do,
logs every set, and shows a WHOOP recovery readiness card up top so you know
whether to push or pull back today.

Lives at `health/fitness/` inside `fernandomartinez-de/personal` and is served
by GitHub Pages at:

    https://fernandomartinez-de.github.io/personal/health/fitness/

## What it does

- **Readiness** from WHOOP: recovery score, HRV, resting HR, sleep, and a
  14 day recovery trend, with a training note that shifts by recovery band.
- **Train**: pick the day, see last session's numbers per exercise, log each
  set with a weight/reps stepper, and an auto rest timer between sets.
- **History**: session volume trend, personal records, past sessions.
- **Routine**: edit days, exercises, and set/rep targets in the app.

Workout logs and routine edits are saved in the browser (localStorage) on the
device you use. They never leave your phone and are not stored in this repo.

## How the data gets in

WHOOP readiness is **baked in at build time**, not fetched in the browser, so
no database key is ever exposed on the page.

    template.html  ->  build_overload.py (reads Supabase)  ->  index.html

`build_overload.py` pulls the latest recovery snapshot with `SUPABASE_DB_URL`
(the same secret the old dashboards used), fills the `__WHOOP_DATA__` token in
`template.html`, and writes `index.html`. The `Build Overload` GitHub Action
runs it every morning and commits the refreshed page.

## Files

    health/fitness/template.html      App with the __WHOOP_DATA__ token
    health/fitness/build_overload.py  Pulls readiness from Supabase, renders index.html
    health/fitness/index.html         The built, served page (do not hand edit)
    health/fitness/requirements.txt   psycopg2-binary
    .github/workflows/build-fitness.yml   Daily rebuild + commit

## Setup

1. Confirm the repo secret `SUPABASE_DB_URL` exists (Settings > Secrets and
   variables > Actions).
2. Make sure GitHub Pages serves from branch `main`, path `/ (root)`, so the
   `health/fitness/` path resolves.
3. Push. The Action refreshes `index.html` daily and on manual dispatch
   (Actions tab > Build Overload > Run workflow).
4. On your phone, open the Pages URL and Add to Home Screen for an app icon.

## Run locally

    export SUPABASE_DB_URL="postgresql://...pooler.supabase.com:6543/postgres"
    pip install -r health/fitness/requirements.txt
    python health/fitness/build_overload.py

## Notes

- **Privacy**: this repo is public, so `index.html` and the WHOOP numbers baked
  into it are readable by anyone with the URL. Your workout logs stay on your
  phone.
- **Schema**: the query targets the live `whoop_*` columns (`recovery_date`,
  `recovery_score`, `resting_heart_rate`, `hrv_rmssd_milli`,
  `whoop_sleep.performance_percentage`, `duration_minutes`).
- **Routine**: the app ships with a sample push/pull/legs split. Edit it in the
  Routine tab, or set your own as the built in default.
