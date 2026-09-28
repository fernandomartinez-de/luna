# Personal Dashboard & Automation

Everything I track about my money, my body, and my health, in one place, updated automatically every day.

**Live site:** https://fernandomartinez-de.github.io/personal/

---

## What this is

I used to check ten different apps to see how I was doing: Chase for spending, Fidelity for retirement, WHOOP for sleep and workouts, Renpho for weight, a folder of PDFs for lab results, Zillow for the condo. Each one had its own login, its own chart, its own way of showing me numbers.

This repo replaces all of that with two things:

1. **One database** that pulls in the data every day, automatically.
2. **One app on my phone** (plus a couple of printer-friendly web pages) that reads from it.

I don't have to click anything. Small robots grab the latest data from each service on a schedule. When I open the app on my phone, the numbers are already there.

---

## The two versions

**Lyftr (v2)** — a phone app you install to your home screen. Modern, mobile-first, everything in one place.
[Open Lyftr →](https://fernandomartinez-de.github.io/personal/lyftr/)

**v1 dashboards (archived)** — plain web pages, one per topic. Print-friendly, good for handing to a doctor.
[Open v1 →](https://fernandomartinez-de.github.io/personal/V1/)

`fernandomartinez-de.github.io/personal/` auto-redirects to Lyftr. Both versions read from the same database, so the numbers agree.

---

## How it fits together

[![Architecture diagram](docs/assets/architecture.png)](docs/assets/architecture.html)

*Click the image for the interactive version — pan, zoom, dark/light, guided views.*

In plain words:

- **Left:** outside services I already use — bank, gym, scale, cloud storage, price APIs
- **Middle:** scheduled jobs on GitHub grab the data and put it in one Supabase database
- **Right:** the phone app and the static dashboards read from that database. I look at them

Two exceptions to the "automated" story:
- **Live prices** for stocks, crypto, and the condo refresh when I press a button in the app
- **Redfin** is the one thing without an API — I run a script by hand once a month

---

## Everyday use

- **Morning:** open Lyftr. Recovery + sleep from last night, latest lab, portfolio value (behind a PIN), suggested workout.
- **Doctor appointment:** open the v1 medical page — labs formatted the way an oncologist expects.
- **Monthly finance review:** Lyftr → Finances → discretionary trend + category heatmap.
- **New lab result:** dropped in Google Drive → auto-ingested on Monday morning → visible in Lyftr Monday afternoon.

## Add to iPhone home screen

Open the [Lyftr link](https://fernandomartinez-de.github.io/personal/lyftr/) in Safari → Share → **Add to Home Screen**. The app will show up alongside your other apps with a custom icon.

Same on Android via Chrome menu → **Add to Home Screen**.

---

## Is this safe?

The repo is public — anyone can read the code — but:
- No passwords or API keys are in the code. They're stored as encrypted GitHub Secrets.
- The Supabase database uses row-level security. Even someone with the app's read-only key can only see what I explicitly exposed.
- No client or company data. This is my personal setup.

---

## Repo layout

```
personal/
├── index.html              # Redirects / to /lyftr/
├── 404.html                # SPA fallback for the Lyftr React app
├── V1/                     # Archived v1 static dashboards
├── exercise-app/           # Lyftr React source (v2)
├── lyftr/                  # Built React app (auto-generated)
├── finances/               # Plaid sync scripts + finance docs
├── health/
│   ├── whoop/              # WHOOP sync
│   ├── body/               # Renpho sync
│   └── medical/            # Lab ingest + Drive housekeeping
├── docs/                   # Documentation (see docs/README.md)
├── tools/document-scanner/ # Local Windows utility (not deployed)
└── vault/                  # Personal Obsidian notes (gitignored)
```

## For maintainers

- **Docs:** [docs/README.md](docs/README.md)
- **Every Supabase table:** [docs/tables.md](docs/tables.md)
- **Dev setup, workflows, secrets, RLS notes:** [docs/maintainers.md](docs/maintainers.md)
