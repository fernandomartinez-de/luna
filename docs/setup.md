# Build your own copy

This walks through setting up Luna from nothing: your own database, your own app, your own data. Each data source is optional, so you can start with just the app and add sources one at a time.

**Time:** about an hour for the core app, plus 15 to 30 minutes per data source.

---

## What you need

| Required | Why |
|----------|-----|
| A GitHub account | Hosts the code, runs the scheduled syncs, serves the app (all free) |
| A Supabase account | The database and the sign in (free plan is enough) |
| Node.js 18 or newer | Only if you want to run the app on your own computer |

| Optional | Unlocks |
|----------|---------|
| Plaid account with production access | Bank transactions and investment holdings |
| WHOOP developer app | Recovery, sleep, strain, workouts |
| Renpho account | Smart scale readings |
| Google Cloud service account + Anthropic API key | Reading lab result PDFs from Google Drive |
| Finnhub and RapidAPI (Zillow) keys | Live stock prices and home value in the Investments tab |
| Gmail app password and/or an ntfy topic | Money alerts by email or phone push |

---

## Part 1: The core app

### 1. Copy the repo

Fork this repo on GitHub (or create a new repo and push a copy). Remember the repo name; it becomes part of the app's address (`https://<your-github-username>.github.io/<repo-name>/`).

### 2. Create the database

1. In Supabase, create a new project. Save the database password somewhere safe.
2. Open `supabase/schema.sql`, find and replace `you@example.com` with the email you'll sign in with.
3. In Supabase, go to **SQL Editor → New query**, paste the whole file, and click **Run**. It creates every table, view, function and security rule.
4. Go to **Project Settings → API Keys** and note three values:
   * the **Project URL** (looks like `https://abcdefgh.supabase.co`)
   * the **anon / publishable** key (safe to ship in the app)
   * the **service role / secret** key (private, never put it in the app)

### 3. Set up sign in

In Supabase, under **Authentication**:

1. **URL Configuration**
   * Site URL: `https://<your-github-username>.github.io/<repo-name>/`
   * Redirect URLs: add `https://<your-github-username>.github.io/<repo-name>/**`
2. **Sign In / Providers → Email**: make sure Email is enabled and set **Email OTP length** to 6.
3. **Emails → Magic Link** template: add a line with `Your code: {{ .Token }}` so the email includes a code you can type (needed for the home screen app on iPhone).
4. Optional but recommended: **Emails → SMTP Settings**. Supabase's built in email only sends a couple of emails per hour. Sending through Gmail removes that limit: host `smtp.gmail.com`, port `465`, your Gmail address as the username, and a [Gmail app password](https://myaccount.google.com/apppasswords) (16 characters, no spaces) as the password.

Leave **Allow new users to sign up** on for now. You'll turn it off after your first sign in.

### 4. Point the app at your copy

Two small edits:

| File | Change |
|------|--------|
| `app/vite.config.js` | `base: '/luna/'` → `'/<repo-name>/'` |
| `app/src/components/AuthGate.jsx` | the default email in `OWNER_EMAIL` → your email |

If you'll use money alerts, also change the default `LUNA_URL` near the top of `finances/scripts/finance_alerts.py` to your app's address.

### 5. Add the GitHub secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**. For the core app you need three:

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | Project URL from step 2 |
| `SUPABASE_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service role / secret key |

### 6. Turn on GitHub Pages and build the app

1. **Settings → Pages**: Source **GitHub Actions**.
2. **Actions** tab: if GitHub asks, enable workflows for the repo.
3. Open **Deploy Luna** → **Run workflow**. When it turns green (about 2 minutes), the app is live at `https://<your-github-username>.github.io/<repo-name>/`.

### 7. Sign in and install

1. Open the app. Enter the quick unlock code (`AppLock.jsx`; change it there if you like), then sign in with your email code.
2. Back in Supabase, **Authentication → Sign In / Providers**: turn **off** Allow new users to sign up. Now nobody else can create an account.
3. On iPhone: open the app in Safari → Share → **Add to Home Screen**, then sign in once more inside the home screen app (it keeps separate storage from Safari). On Android: Chrome menu → **Add to Home Screen**.

The app works now. Pages will be empty until you connect data sources or log workouts and meals.

---

## Part 2: Connect data sources

Each source is independent. Add its secrets, do its one time step, then run its workflow once from the **Actions** tab to test.

### Bank transactions (Chase or any Plaid supported bank)

* **Secrets:** `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ACCESS_TOKEN`, `PLAID_ITEM_ID`
* **One time step:** link your bank to get the access token and item id. The link script was removed after setup; restore it from history and run it locally with a `finances/.env` (see `finances/.env.example`):
  ```
  git show 493d315:finances/scripts/plaid_chase_link.py > finances/scripts/plaid_chase_link.py
  python finances/scripts/plaid_chase_link.py
  ```
* **Workflow:** Pull Finances (Plaid), daily.
* **Categories:** add rules to the `category_mapping` table (pattern → category), or recategorize transactions in the app and tick "remember". Edit the category groups in the views at the bottom of `supabase/schema.sql` to match your own categories.

### Money alerts (optional, runs with bank transactions)

* **Secrets:** `NTFY_TOPIC` for phone push through [ntfy](https://ntfy.sh), and/or `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ALERT_EMAIL_TO` for email. Leave them out to only show alerts inside the app.

### Investments (Fidelity or any Plaid investments institution)

* **Secrets:** `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_FIDELITY_ACCESS_TOKEN`
* **One time step:** `git show 493d315:finances/scripts/plaid_investments_link.py > finances/scripts/plaid_investments_link.py`, then run it.
* **Workflow:** Pull Investments (Plaid), weekdays.

### Live prices and home value (optional)

* **Secrets:** `FINNHUB_KEY` ([finnhub.io](https://finnhub.io)), `ZILLOW_API_KEY` (a RapidAPI key for the Zillow scraper API). These are built into the app, so use free tier keys with usage limits.
* **Monthly home value:** see [finances/README.md](../finances/README.md).

### WHOOP

* **Secrets:** `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REFRESH_TOKEN`, `GH_PAT`
* **One time step:** create an app at [developer.whoop.com](https://developer.whoop.com) with redirect URI `https://localhost`. Restore and run the bootstrap script to get your first refresh token:
  ```
  git show 493d315:health/whoop/bootstrap.py > health/whoop/bootstrap.py
  python health/whoop/bootstrap.py
  ```
* **`GH_PAT`:** WHOOP issues a new refresh token on every sync, so the workflow saves it back as a secret. Create a fine grained GitHub token for this repo with **Secrets: read and write** permission.
* **Workflow:** Whoop Sync, 5 times a day.

### Renpho scale

* **Secrets:** `RENPHO_EMAIL`, `RENPHO_PASSWORD` (your Renpho app login; Renpho has no other way to connect)
* **Workflow:** Pull Body Composition (Renpho), daily.

### Lab results from Google Drive

* **Secrets:** `GOOGLE_CREDENTIALS` (the full JSON key of a Google Cloud service account with the Drive API enabled), `ANTHROPIC_API_KEY`
* **One time step:**
  1. In Google Drive, create a `Medical` folder with an `IN` folder inside it.
  2. Share the `Medical` folder with the service account's email address as **Editor**.
  3. Copy the `Medical` folder's id (the last part of its URL) into `GDRIVE_FOLDER_ID` in `health/medical/clean_medical_drive.py`.
* **Workflow:** Medical - Process Inbox, daily. Drop PDFs or photos into `Medical/IN` and they get filed and loaded. Details in [health/medical/tracker/README.md](../health/medical/tracker/README.md).

---

## Checklist

- [ ] Database created from `supabase/schema.sql` with your email
- [ ] Sign in URLs set, OTP length 6, code added to the email template
- [ ] `vite.config.js` and `AuthGate.jsx` updated for your repo
- [ ] Three Supabase secrets added
- [ ] GitHub Pages on, Deploy Luna green
- [ ] Signed in, then sign ups turned off
- [ ] Data sources connected and each workflow run once successfully

Something not working? See the troubleshooting section in [operations.md](operations.md#troubleshooting).
