# Setup: Publish the site on GitHub Pages

This is a one-time setup that puts your `trips` repo on GitHub and turns on GitHub Pages so anyone with the URL can view your Japan trip site. Once done, you'll have a public URL like `https://fernandomartinez-de.github.io/trips/japan/` to share with your family.

**Total time:** about 10 minutes if git is already installed, 15 minutes if not.

---

## Step 0 — Check that Git is installed

1. Press the **Windows key**, type `powershell`, hit Enter. A blue-ish terminal window opens.
2. Type this and press Enter:

   ```powershell
   git --version
   ```

3. **If you see** something like `git version 2.42.0.windows.1` → skip to Step 1.
4. **If you see** `git: command not found` or `not recognized`:
   - Go to https://git-scm.com/download/win
   - Download and run the installer. Accept all defaults — the important boxes to leave checked are "Git from the command line" and "Git Credential Manager".
   - **Close and reopen PowerShell** after install (env vars need to reload).
   - Run `git --version` again to confirm.
5. First-time git users only: set your identity (used on commit messages). Replace the values with yours:

   ```powershell
   git config --global user.name "Fernando Martinez"
   git config --global user.email "your-email@example.com"
   ```

   Use the same email your GitHub account has (Settings → Emails on github.com) so commits are attributed to you.

---

## Step 1 — Create the empty repo on GitHub

1. Open https://github.com in your browser and sign in.
2. Click the **+** icon in the top-right corner → **New repository**.
   - Or go directly to https://github.com/new
3. Fill in the form exactly as follows:
   - **Owner:** `fernandomartinez-de` (this should be preselected)
   - **Repository name:** `trips`
   - **Description** (optional): "Family travel notebooks. One page per trip."
   - **Visibility:** **Public** ← this is important. GitHub Pages on free accounts only works with public repos.
   - **Initialize this repository with:** leave EVERYTHING unchecked. No README, no .gitignore, no license. We'll add these ourselves.
4. Click the green **Create repository** button.
5. GitHub now shows you a page titled "Quick setup" with several code snippets. **Leave this tab open** — we'll reference the repo URL from here, and after the push we come back to enable Pages.

At this point your repo exists on GitHub but is empty. That's expected.

---

## Step 2 — Copy the project files to your computer

Back in PowerShell (still open from Step 0), copy-paste this whole block, then press Enter:

```powershell
# Destination folder on your PC. Change if you want it somewhere else.
$dest = "$HOME\Documents\trips"

# Create the destination folder
New-Item -ItemType Directory -Force -Path $dest | Out-Null

# Source: the files Claude prepared for you
$src = "C:\Users\fmartine\AppData\Local\Claude-3p\local-agent-mode-sessions\2466d957\00000000\e6c1d593\outputs\trips-repo"

# Copy everything, recursively, overwriting if anything exists
Copy-Item -Path "$src\*" -Destination $dest -Recurse -Force

# Move into the destination folder
cd $dest

# Show what got copied
Get-ChildItem -Recurse -File | Select-Object FullName
```

You should see 5 files listed:

- `...\Documents\trips\.gitignore`
- `...\Documents\trips\README.md`
- `...\Documents\trips\SETUP.md`  ← this file
- `...\Documents\trips\index.html`  ← landing page
- `...\Documents\trips\japan\index.html`  ← the Japan trip site (~1.7 MB)

If the copy looks off, or you'd rather use a different folder (e.g., `D:\Projects\trips`), just change `$dest` above and run again.

---

## Step 3 — Initialize git and make the first commit

Still in PowerShell, still inside `$HOME\Documents\trips`, run these commands one line at a time (or paste them all — they work as a block too):

```powershell
# Turn this folder into a git repository, with "main" as the default branch
git init -b main

# Stage all files for the first commit
git add .

# Take a snapshot with a descriptive message
git commit -m "Initial commit: trips scaffold with Japan 2026"
```

Expected output for `git commit`: a summary showing 5 files created. If instead you see something like "Please tell me who you are" — you skipped the `git config user.name/email` step in Step 0. Set those and re-run `git commit`.

---

## Step 4 — Connect the local folder to the GitHub repo and push

```powershell
# Link your local folder to the empty repo you created in Step 1
git remote add origin https://github.com/fernandomartinez-de/trips.git

# Push your commit up to GitHub
git push -u origin main
```

**The first time you push**, one of two things happens:

- **A browser window pops up** asking you to authorize "Git Credential Manager" to your GitHub account. Click **Sign in with your browser** → approve the OAuth → close the browser tab → PowerShell continues automatically. This is the smoothest path and stores credentials so future pushes don't ask again.
- **PowerShell prompts for username and password** in the terminal directly. In this case:
   1. **Username:** `fernandomartinez-de`
   2. **Password:** GitHub no longer accepts your account password here. You need a **Personal Access Token (PAT)**. To create one:
      - Go to https://github.com/settings/tokens
      - Click **Generate new token** → **Generate new token (classic)**
      - **Note:** "trips laptop"
      - **Expiration:** 90 days (or "no expiration" if you prefer)
      - **Scopes:** check **repo** (all sub-boxes tick automatically)
      - Scroll down, click **Generate token**
      - Copy the token that appears (you won't see it again after leaving this page)
      - Paste the token as the "Password" in PowerShell and hit Enter

Once auth works, the push completes in a few seconds. You'll see something like:
```
Enumerating objects: 8, done.
...
To https://github.com/fernandomartinez-de/trips.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main' from 'origin'.
```

**Verify** by refreshing your GitHub tab (the one from Step 1). The empty repo should now show your files: `README.md`, `SETUP.md`, `.gitignore`, `index.html`, and a `japan/` folder.

---

## Step 5 — Turn on GitHub Pages

1. On your repo page at https://github.com/fernandomartinez-de/trips, click the **Settings** tab (top-right of the repo, might be behind a **⋯** menu on narrow screens).
2. In the left sidebar of Settings, click **Pages**.
3. Under **Build and deployment**:
   - **Source:** select **Deploy from a branch**
   - **Branch:** select `main`, folder `/ (root)`, then click **Save**
4. Wait **30 to 60 seconds**. Refresh the Pages settings page. A green banner appears at the top:

   > **Your site is live at https://fernandomartinez-de.github.io/trips/**

   The very first deploy sometimes takes a bit longer (up to 2-3 minutes). If it's not ready, hit refresh a few times.

---

## Step 6 — Test it

Open these URLs in a fresh browser tab (or send them to your phone to check on mobile):

- **Landing page:** https://fernandomartinez-de.github.io/trips/
   - Should show a warm cream background, the 旅 kanji watermark, "Nuestros viajes." headline, and a card for the Japan trip.
   - Clicking the card opens the trip site.
- **Japan trip direct URL:** https://fernandomartinez-de.github.io/trips/japan/
   - Should show the "VIAJE JAPÓN" hero, the countdown, the four editable info cards, the 18-day itinerary pills, the map (empty at first), the inspiration gallery with 13 photos, and the budget table.

**Send the landing page URL to your family** — it's the cleanest entry point.

**Important caveat on collaboration:** the site stores per-user data (votes, notes, packing checkmarks, edits) in each browser's `localStorage`. That means each family member sees the same _default_ trip layout you shipped, but their edits stay in their own browser and don't sync back to you or to other family members. This is fine as a viewer / individual planner, but it's not real-time collaboration. To make edits shared across everyone, we'd add a backend (Google Sheets, Firebase, or Supabase are the easy free options). That's the next step whenever you're ready.

---

## Step 7 — Making future changes

Any time you edit `japan\index.html` (or add another trip, or update the README), commit and push from the same PowerShell folder:

```powershell
cd $HOME\Documents\trips

# See what changed
git status

# Stage everything
git add .

# Commit with a message describing the change
git commit -m "Update Nara day activities"

# Push to GitHub
git push
```

GitHub Pages redeploys automatically 1-2 minutes after the push. The URL stays the same, the content updates.

### Adding another trip later

1. Duplicate the `japan\` folder inside `$HOME\Documents\trips`, name the copy after the new destination (e.g. `italy\`).
2. Open `italy\index.html` in a text editor (VS Code, Notepad++) and edit the `ITINERARY` array near the top of the `<script>` block: change dates, cities, coordinates, focus paragraphs.
3. Add a line for the new trip in the top-level `index.html` (the landing page) so it shows up as a card.
4. Also add a bullet under "Trips" in `README.md`.
5. `git add .`, `git commit -m "Add Italy trip"`, `git push`.

---

## Troubleshooting

### "remote: Repository not found"
Double-check the repo URL in `git remote -v`. It should be exactly `https://github.com/fernandomartinez-de/trips.git`. If wrong, fix with:
```powershell
git remote set-url origin https://github.com/fernandomartinez-de/trips.git
```

### "Updates were rejected because the tip of your current branch is behind"
Someone (probably you from another machine or from github.com's web UI) already pushed something. Pull first:
```powershell
git pull --rebase
git push
```

### 404 when opening the Pages URL
- GitHub Pages takes 30-60 seconds on first deploy. Wait and refresh.
- Make sure the repo is Public. Settings → General → Danger zone shows visibility. Private repos need Pro.
- Make sure the branch is `main` and folder is `/ (root)` in Settings → Pages.

### Images don't show up on the deployed site
This shouldn't happen — the photos are embedded as base64 data URLs inside `japan\index.html`. If they don't render, it usually means the HTML got corrupted mid-transfer. Re-run Step 2's copy command and push again.

### The map is stuck loading / no pins ever appear
The map only shows pins when activities have a value in their **Ubicación** field. The clean-slate version ships with empty activities — the map stays empty until someone (usually you) starts filling in ubicaciones inside the itinerary editor. That's by design.

### I want a custom domain (e.g. viajes.martinez.com)
Buy the domain from any registrar (Namecheap, Cloudflare). Then in GitHub → Settings → Pages, set the **Custom domain** field to your domain, and follow GitHub's DNS instructions for setting up a CNAME or A record pointing to `fernandomartinez-de.github.io`. Free HTTPS via Let's Encrypt is automatic once DNS resolves.

### I want the repo to be private
Free GitHub Pages requires public repos. If you upgrade to **GitHub Pro** ($4/mo), Pages works on private repos too. Alternatively, keep the code private on GitHub and deploy the built site to **Netlify** or **Vercel** for free from a private repo. Ping me and we can migrate the hosting whenever.

---

## Supabase (collaboration backend) — one-time schema load

The site uses Supabase to sync edits across family members in real time. The publishable key + project URL are already embedded in `japan/index.html`. You just need to load the schema into the DB once (or any time you want to reset).

1. Go to https://supabase.com/dashboard/project/hmeenrnlbdzqhbdbsxjf (the `trips` project).
2. In the left sidebar, click the **SQL Editor** icon (looks like a database console).
3. Click **+ New query** (top-right).
4. Open `japan/schema.sql` from this repo, select all (Ctrl+A), copy (Ctrl+C), and paste into the SQL editor.
5. Click the green **Run** button (or Ctrl+Enter).

Expected result: "Success. No rows returned." plus the 6 tables now show up in **Table Editor** → `japan_days`, `japan_activities`, `japan_votes`, `japan_inspo`, `japan_trip_glance`, `japan_geocache`.

The script is idempotent: safe to re-run. It uses `create table if not exists` and `on conflict do nothing` for seeds, so you can also re-paste it if you add tables later without wiping existing data.

**If you ever need to reset the trip and start over from scratch**, run these in the SQL Editor (in this order):

```sql
truncate table public.japan_votes, public.japan_activities cascade;
delete from public.japan_geocache;
-- japan_days, japan_trip_glance, japan_inspo keep their seed rows;
-- edits made via the site sit as UPDATEs on the seeded rows.
```

## What's in this repo

- **README.md** — Documentation for anyone opening the repo. Lists all trips, explains structure.
- **SETUP.md** — This file. One-time setup guide.
- **.gitignore** — Ignores editor junk and macOS/Windows metadata.
- **index.html** — Landing page at the repo root. Lists all trips as clickable cards.
- **japan/index.html** — The self-contained Japan trip site. All CSS, JS, images embedded. No build step, no dependencies beyond CDN Tailwind and Leaflet.

Every trip lives in its own subfolder with a single `index.html`. That's it.
