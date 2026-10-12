# Maintainer notes

For working on the repo, not for reading the site.

## Local dev

```powershell
cd luna\app
npm install
npm run dev        # http://localhost:5173
```

## Re-linking a bank or account (rare)

The one-time setup scripts were removed from the repo once everything was connected. If Chase or Fidelity ever needs to be re-linked through Plaid, or WHOOP needs a brand new refresh token, restore the script from history:

```powershell
git show 493d315:finances/scripts/plaid_chase_link.py > finances\scripts\plaid_chase_link.py
git show 493d315:finances/scripts/plaid_investments_link.py > finances\scripts\plaid_investments_link.py
git show 493d315:health/whoop/bootstrap.py > health\whoop\bootstrap.py
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
| `whoop-daily-sync.yml` | 5x/day (02, 13, 16, 19, 22 UTC ≈ 9am/12pm/3pm/6pm/10pm ET) | WHOOP recovery, sleep, workouts |
| `pull-body.yml` | Daily 14:00 | Renpho body composition |
| `medical-process-inbox.yml` | Daily 12:17 | Process new lab PDFs in Drive `Medical/IN`: file them, load `lab_results`, update the tracker |
| `build-luna-v2.yml` | On push to `luna/app/` | Build & deploy the React app |

## Secrets

Set in **Settings → Secrets and variables → Actions**:

| Secret | Who uses it |
|--------|------------|
| `SUPABASE_URL` | All backend scripts + build |
| `SUPABASE_KEY` | Frontend build (public anon key baked into JS bundle; useless without my signed in session, see Row-level security) |
| `SUPABASE_SERVICE_ROLE_KEY` | All backend scripts (bypasses RLS). **Never expose to frontend.** |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ACCESS_TOKEN`, `PLAID_FIDELITY_ACCESS_TOKEN` | Plaid syncs |
| `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REFRESH_TOKEN` | WHOOP sync |
| `RENPHO_EMAIL`, `RENPHO_PASSWORD` | Renpho sync |
| `FINNHUB_KEY`, `ZILLOW_API_KEY` | v2 Luna Refresh Prices (baked into JS bundle) |
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
- **v2 auto-deploy.** Any change to `luna/app/` triggers `build-luna-v2.yml`, which rebuilds the React bundle, copies it to `luna/`, and commits the build.
- **WHOOP token** auto-refreshes daily via `whoop-daily-sync.yml`.
- **Real estate:** Zillow refreshes via the app's Refresh Prices button; Redfin is manual (CORS blocks in-browser fetch), run `finances/scripts/fetch_redfin_property_value.py` monthly.
- **SPA fallback.** GitHub Pages serves `/404.html` from repo root for any missing URL under `/personal/`. It redirects Luna paths back into the app shell; other 404s (v1 typos) show a small "Back to hub" page.
- **v1 is removed.** `V1/` was deleted in Oct 2026 (the code is still in git history, except the medical report pages, which were purged).
- **Sign in.** Luna uses Supabase Auth (email one time code). Settings live in Supabase → Authentication: Site URL and redirect `https://fernandomartinez-de.github.io/personal/luna/**`, custom SMTP through Gmail, sign ups turned off. Only `fernandopv2655@gmail.com` is allowed (`luna/app/src/components/AuthGate.jsx` and the database policy both check it).
- **Database lockdown.** Every table has one `owner_only` policy (applied Oct 2026). **A new table needs the same policy**, or Luna can't see it:
  `create policy owner_only on public.<table> for all to authenticated using ((select auth.jwt() ->> 'email') = 'fernandopv2655@gmail.com') with check ((select auth.jwt() ->> 'email') = 'fernandopv2655@gmail.com');`
- **Vault redaction.** Never commit full ID, account, policy or member numbers, family phones or emails. Mask to the last 4 characters; the full values belong only in the private Drive vault.
- **Build hygiene.** `build-luna-v2.yml` deletes `luna/assets/` before copying the new build, so old bundles never linger on the site.
