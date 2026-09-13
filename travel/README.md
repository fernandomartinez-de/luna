# trips

Static HTML trip planning sites for the Martinez family, one per trip, hosted on GitHub Pages with real-time collaboration via Supabase.

## Trips

- **Japan · November 2026** - [/japan](./japan/) · [live site](https://fernandomartinez-de.github.io/trips/japan/)

## How to add a new trip

1. Duplicate an existing trip folder (e.g. `japan/`) and rename it after the new destination (e.g. `italy/`, `hawaii/`).
2. Edit `index.html` in the new folder: update the `ITINERARY` array with dates, cities, coordinates, and activities. Update the hero copy and page title.
3. If the new trip needs its own database, either add `italy_*`-prefixed tables to the same Supabase project (following the pattern in `japan/schema.sql`), or spin up a separate Supabase project and update the URL + publishable key at the top of the new trip's `index.html`.
4. Add a bullet to the "Trips" list in this README, and add a card for it in the root `index.html`.
5. `git add .`, `git commit -m "Add [trip name] trip"`, `git push`. GitHub Pages redeploys automatically in about a minute.

## How it works

Each trip lives in its own subfolder with a single self-contained `index.html`. The site is a plain static page that pulls in Tailwind (CDN), the Supabase JS SDK (CDN), and Google Maps JS (CDN, keyed). Images live as regular files under each trip's `assets/img/` folder rather than being embedded, so they cache well and the HTML stays small.

Collaboration works through Supabase:

- Every family member opens the same URL. No login. Each person picks their own name once via the "Poner nombre" button.
- Activity edits, votes, day headers, trip glance, and inspiration photos all save to Supabase.
- Supabase Realtime pushes those changes back to everyone else's browser within about a second, so the site feels live.
- Row Level Security policies (all in `japan/schema.sql`) enforce that the anonymous publishable key can read and write only these specific tables.
- localStorage caches state locally so the UI is instant and works offline for reads.

## Repo layout

```
trips/
├── README.md              this file
├── SETUP.md               one-time setup: git, GitHub Pages, Supabase
├── .gitignore
├── index.html             root landing page listing all trips
└── japan/
    ├── index.html         the trip site
    ├── schema.sql         Supabase DDL + RLS policies + Realtime + seed data
    └── assets/
        └── img/           inspiration photos + hero portrait, one file each
```

## Local development

Open `japan/index.html` directly in a browser. There is no build step.

Two caveats when running locally by double-clicking the file (`file:///...`):

- Google Places autocomplete will not work: the API key is HTTP-referrer restricted and does not match `file://`. To test autocomplete, either serve the folder from a local HTTP server (e.g. `python -m http.server` from the trip folder, then visit `http://localhost:8000`) or just test against the deployed URL.
- Supabase and Realtime work fine from `file://` (no referrer restriction).

## GitHub Pages

Already configured. Settings → Pages → Deploy from a branch, `main`, `/ (root)`. Live at:

- `https://fernandomartinez-de.github.io/trips/` (landing page listing all trips)
- `https://fernandomartinez-de.github.io/trips/japan/` (Japan trip direct)

## Supabase

Project: `trips`. Anonymous publishable key + project URL are embedded in each trip's `index.html`. Row Level Security is what actually gates access. Uploaded photos go to the `japan-images` Storage bucket.

To load or refresh the schema, paste `japan/schema.sql` into Supabase's SQL Editor and Run. The script is idempotent and safe to re-run.

See `SETUP.md` for the full one-time setup walkthrough.
