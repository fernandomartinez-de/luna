# health

Scripts that pull health data into the database. Three independent pipelines; each writes only to its own tables.

## What runs

| Pipeline | Script | What it does | When | Writes to |
|----------|--------|--------------|------|-----------|
| **WHOOP** | `whoop/sync.py` | Pulls recovery, sleep, strain and workouts from the WHOOP API. Saves WHOOP's new refresh token back to GitHub Secrets after each run. | 5 times a day, Whoop Sync workflow | `whoop_recovery`, `whoop_cycles`, `whoop_sleep`, `whoop_workouts`, `whoop_body` |
| **Scale** | `body/renpho_pull.py` | Pulls Renpho smart scale readings. | Daily, Pull Body Composition workflow | `body_composition` |
| **Labs** | `medical/medical_inbox.py` | Files new medical documents from Google Drive and loads lab values. | Daily, Medical - Process Inbox workflow | `lab_results`, `inbody_results` |

All of them are safe to rerun from the Actions tab.

## Labs pipeline

Drop PDFs or photos into **Google Drive → Medical → IN**. On the next run, each file is:

1. read (PDF text, or Claude vision for scans and photos),
2. renamed and moved into `Medical/<year>/<category>/`, or into `Medical/_REVISAR` if it can't be placed confidently,
3. loaded into the database if it's a lab report or InBody scan.

Nothing is ever deleted. The full rules, and how to fix files in `_REVISAR`, are in [medical/tracker/README.md](medical/tracker/README.md).

The labs code is split into three files:

| File | Role |
|------|------|
| `medical/medical_inbox.py` | The pipeline the workflow runs |
| `medical/clean_medical_drive.py` | Rules for categories, dates and file names. Also holds the Drive folder id. |
| `medical/ingest_labs_gdrive.py` | Turns lab reports into database rows |

## Secrets

| Pipeline | Needs |
|----------|-------|
| WHOOP | `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REFRESH_TOKEN`, `GH_PAT` |
| Scale | `RENPHO_EMAIL`, `RENPHO_PASSWORD` (Renpho has no other way to connect) |
| Labs | `GOOGLE_CREDENTIALS` (service account JSON), `ANTHROPIC_API_KEY` |

All three also need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## If WHOOP stops syncing

WHOOP refresh tokens are single use: each run gets a new one and saves it with `GH_PAT`. If a run fails partway or `GH_PAT` expires, the saved token goes stale and the next run fails with a 401. Renew `GH_PAT` if needed, then get a fresh token with the bootstrap script (see [docs/setup.md](../docs/setup.md#whoop)).
