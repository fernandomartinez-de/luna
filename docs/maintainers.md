# Maintainer notes

For working on the repo, not for reading the site.

## Local dev

```powershell
cd health\fitness\exercise-app
npm install
npm run dev        # http://localhost:5173
```

## One-time setup

Chase + Fidelity Plaid links (run once each):

```powershell
cd finances\scripts
python plaid_chase_link.py          # Chase
python plaid_investments_link.py    # Fidelity
```

## Manual re-sync (rarely needed — GitHub Actions handles this daily)

```powershell
python finances\scripts\plaid_chase_sync.py              # Chase transactions
python finances\scripts\fetch_zillow_property_value.py   # Condo Zillow value
```

## Workflows

All schedules in UTC.

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `pull-finances.yml` | Daily 13:00 | Chase transactions via Plaid |
| `pull-investments.yml` | Weekdays 22:00 | Fidelity holdings via Plaid |
| `whoop-daily-sync.yml` | Daily 08:00 | WHOOP recovery, sleep, workouts |
| `pull-body.yml` | Daily 14:00 | Renpho body composition |
| `medical-ingest-labs.yml` | Weekly Mon 09:00 | Ingest lab PDFs from Drive |
| `medical-clean-drive.yml` | Monthly 1st | Clean processed Drive files |
| `build-lyftr-v2.yml` | On push to `exercise-app/` | Build & deploy the React app |

## Secrets

Set in **Settings → Secrets and variables → Actions**:

| Secret | Who uses it |
|--------|------------|
| `SUPABASE_URL` | All backend scripts + build |
| `SUPABASE_KEY` | Frontend build (anon key baked into JS bundle) |
| `SUPABASE_SERVICE_ROLE_KEY` | All backend scripts (bypasses RLS). **Never expose to frontend.** |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ACCESS_TOKEN`, `PLAID_FIDELITY_ACCESS_TOKEN` | Plaid syncs |
| `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REFRESH_TOKEN` | WHOOP sync |
| `RENPHO_EMAIL`, `RENPHO_PASSWORD` | Renpho sync |
| `FINNHUB_KEY`, `ZILLOW_API_KEY` | v2 Lyftr Refresh Prices (baked into JS bundle) |
| `GOOGLE_CREDENTIALS`, `ANTHROPIC_API_KEY` | Lab PDF ingest |
| `GH_PAT` | WHOOP token auto-rotation |

## Row-level security

Every public table has RLS on. Two-role pattern:

- **Frontend (`SUPABASE_KEY`, anon)** — read most tables, write only where an "anon write" policy exists.
- **Backend syncs (`SUPABASE_SERVICE_ROLE_KEY`)** — bypasses RLS.

Every backend script reads `os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"]`, so it prefers service_role when the workflow provides it and falls back to anon for local runs.

If a new sync errors with `postgrest.exceptions.APIError: new row violates row-level security policy`, its workflow YAML is missing the service_role env var — add:

```yaml
env:
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## Links

- **Live site:** https://fernandomartinez-de.github.io/personal/
- **Supabase:** https://supabase.com/dashboard/project/uuvsvtpfcexhqojlrsxy
- **GitHub Actions:** https://github.com/fernandomartinez-de/personal/actions
- **Plaid dashboard:** https://dashboard.plaid.com/

## Notes

- **Public repo.** All secrets in GitHub secrets or gitignored `.env` files. Never commit real client data.
- **v2 auto-deploy.** Any change to `health/fitness/exercise-app/` triggers `build-lyftr-v2.yml`, which rebuilds the React bundle, copies it to `lyftr/`, and commits the build.
- **WHOOP token** auto-refreshes daily via `whoop-daily-sync.yml`.
- **Real estate:** Zillow refreshes via the app's Refresh Prices button; Redfin is manual (CORS blocks in-browser fetch), run `finances/scripts/fetch_redfin_property_value.py` monthly.
- **SPA fallback.** GitHub Pages serves `/404.html` from repo root for any missing URL under `/personal/`. It redirects Lyftr paths back into the app shell; other 404s (v1 typos) show a small "Back to hub" page.
- **v1 is archived.** Everything under `V1/` is frozen. If you need to revive the Overload dashboard rebuild, `build-fitness.yml` and `medical-rebuild-dashboards.yml` are recoverable from git history.
