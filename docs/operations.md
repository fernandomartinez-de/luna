# Operations

How Luna runs day to day, how to do common tasks, and what to do when something breaks. For first time setup, see [setup.md](setup.md).

---

## Where everything lives

| What | Where |
|------|-------|
| The app | https://fernandomartinez-de.github.io/luna/ |
| Workflow runs and logs | https://github.com/fernandomartinez-de/luna/actions |
| Database, sign in settings, logs | https://supabase.com/dashboard/project/uuvsvtpfcexhqojlrsxy |
| Plaid | https://dashboard.plaid.com/ |
| Secrets | GitHub repo → Settings → Secrets and variables → Actions |

---

## Schedule

All workflows can also be started by hand: **Actions** tab → pick the workflow → **Run workflow**. Every sync is safe to rerun; it updates existing rows instead of duplicating them.

| Workflow | Runs (New York time) | Pulls | Writes to |
|----------|----------------------|-------|-----------|
| Pull Finances (Plaid) | Daily ~9:00 AM | Chase transactions, then checks for money alerts | `expense_transactions`, `finance_alerts` |
| Pull Investments (Plaid) | Weekdays ~6:00 PM | Fidelity holdings | `stocks_crypto_history` |
| Pull Body Composition (Renpho) | Daily ~10:00 AM | Scale readings | `body_composition` |
| Whoop Sync | ~9 AM, 12 PM, 3 PM, 6 PM, 10 PM | Recovery, sleep, strain, workouts | `whoop_*` tables |
| Medical - Process Inbox | Daily ~8:15 AM | New files in Drive `Medical/IN` | `lab_results`, `inbody_results` |
| Deploy Luna | Every push that changes `app/` | Builds the app and publishes it to GitHub Pages | nothing in the repo |

Times shift by an hour in winter because the schedules are set in UTC.

---

## Secrets

| Secret | Used by |
|--------|---------|
| `SUPABASE_URL` | Every workflow |
| `SUPABASE_SERVICE_ROLE_KEY` | Every sync. Bypasses the database rules. **Never put it in the app.** |
| `SUPABASE_KEY` | The app build (the public anon key; it can't read anything without a signed in session) |
| `FINNHUB_KEY`, `ZILLOW_API_KEY` | The app build, for live prices on the Investments tab. Visible in the app's code, so keep them on free plans with limits. |
| `PLAID_CLIENT_ID`, `PLAID_SECRET` | Both Plaid workflows |
| `PLAID_ACCESS_TOKEN`, `PLAID_ITEM_ID` | Pull Finances (Chase) |
| `PLAID_FIDELITY_ACCESS_TOKEN` | Pull Investments (Fidelity) |
| `NTFY_TOPIC`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ALERT_EMAIL_TO` | Money alerts (each channel is optional) |
| `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REFRESH_TOKEN` | Whoop Sync |
| `GH_PAT` | Whoop Sync, to save WHOOP's new refresh token after each run |
| `RENPHO_EMAIL`, `RENPHO_PASSWORD` | Pull Body Composition |
| `GOOGLE_CREDENTIALS`, `ANTHROPIC_API_KEY` | Medical - Process Inbox |

---

## Common tasks

### Change the app

Edit files in `app/` and push to `main`. The Deploy Luna workflow publishes the new version in about 2 minutes.

To work locally:

```
cd app
npm install
npm run dev      # opens http://localhost:5173
```

You'll need `app/.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`), and you'll sign in with the same email code as on the phone.

### Add a new table

Every table needs the owner rule, or the app gets empty results:

```sql
alter table public.<table> enable row level security;
create policy owner_only on public.<table> for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'fernandopv2655@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'fernandopv2655@gmail.com');
```

Then add the table to `supabase/schema.sql` and [tables.md](tables.md) so a fresh setup stays complete. Scripts that write to it should use `SUPABASE_SERVICE_ROLE_KEY`.

### Fix a transaction's category

In the app: Finances → Expenses → open a month's transactions → tap a transaction → **Change category**. Tick **Remember this** to save a rule, so future transactions with the same text get that category too. A category you set by hand is never overwritten by a later sync.

### Save this month's home value

The Investments tab shows live Zillow values but doesn't store them. To store a monthly snapshot, see [finances/README.md](../finances/README.md#home-value).

### Reconnect a bank, Fidelity or WHOOP

If a Plaid connection expires or WHOOP's token is lost, the setup scripts can be restored from history. Steps are in [setup.md](setup.md#part-2-connect-data-sources).

### Sign in on a new device

Open the app, enter the quick code, then sign in with the emailed code. Each device signs in once.

---

## Troubleshooting

| What you see | Likely cause | Fix |
|--------------|--------------|-----|
| A page in the app is empty | Not signed in, or the session expired | Close and reopen the app; sign in again if asked |
| One table is empty but others work | The table is missing the `owner_only` rule | Add it (see "Add a new table") |
| Sign in email never arrives | Email rate limit, or Gmail SMTP password wrong | Wait a few minutes; check Supabase → Authentication → Emails → SMTP Settings and Rate Limits |
| "Email rate limit exceeded" | Too many code requests in an hour | Wait, or raise the limit in Supabase → Authentication → Rate Limits |
| Code box won't accept the code | Code length setting changed | Supabase → Sign In / Providers → Email → Email OTP length 6 |
| A sync fails with "violates row level security policy" | The workflow isn't passing the service key | Add `SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}` to its `env:` |
| Pull Finances fails with an Item or login error | The bank connection expired in Plaid | Reconnect the bank (see above) |
| Whoop Sync fails with 401 | The refresh token was lost or not saved | Check `GH_PAT` is valid; if needed, rerun the WHOOP bootstrap |
| Scheduled workflows stopped running | GitHub pauses schedules after 60 days with no commits | Actions tab → each workflow → Enable, or push any commit |
| App shows an old version | The phone cached it | Fully close and reopen the app; on desktop press Ctrl + Shift + R |

---

## Rules for this repo

- **Never commit secrets.** Keys go in GitHub Secrets or a local `.env`, both kept out of git.
- **Never commit personal notes or numbers.** Personal notes belong in the private `vault` repo, not here (`vault/` is gitignored).
- **Never commit medical reports or data exports.** Generated medical HTML, CSVs, PDFs and spreadsheets are blocked by `.gitignore`.
- **Build output is never committed.** The deploy workflow builds `app/` and publishes it directly.
