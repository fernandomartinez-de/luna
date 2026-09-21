# Finances: Plaid auto-pull

Replaces the manual "download three Chase files" step. Plaid pulls new Chase
transactions daily into Supabase (`expense_transactions`), categorized the same
way the manual pipeline categorizes them, so the finance report just keeps
working.

## Status

- Chase OAuth registration submitted to Plaid 2026-09-21, in review (est. 24h).
  Go-live once Chase shows Enabled at
  https://dashboard.plaid.com/activity/status/oauth-institutions
- Phase 2 (planned): Fidelity retirement holdings via Plaid Investments product
  into stocks_crypto_history.

## Pieces

    finances/plaid_link.py   One-time. Connects Chase, gets the access token.
    finances/plaid_sync.py   Daily. Pulls new/changed transactions -> Supabase.
    finances/requirements.txt
    .github/workflows/pull-finances.yml   Runs plaid_sync.py every morning.

Supabase tables (already created):
- `plaid_sync_state` — the `/transactions/sync` cursor, per Item.
- `plaid_accounts`   — account_id -> source map + masked metadata (last 4 only).
- `expense_transactions` — now has a unique index on `plaid_transaction_id`.

## One-time setup

1. In the Plaid Dashboard, copy your **Production** `client_id` and `secret`.
2. Locally:

       cd finances
       cp .env.example .env        # paste PLAID_CLIENT_ID / PLAID_SECRET
       pip install -r requirements.txt
       python plaid_link.py

   Open the printed URL, sign into Chase, select the three accounts
   (...6813, ...5113, ...4433). The script prints `PLAID_ACCESS_TOKEN` and
   `PLAID_ITEM_ID` and also writes them to `.plaid_secrets.local` (gitignored).

3. Add these GitHub repo secrets (Settings > Secrets and variables > Actions):
   `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ACCESS_TOKEN`, `PLAID_ITEM_ID`.
   (`SUPABASE_URL` / `SUPABASE_KEY` already exist for the other pipelines.)

4. Delete `.plaid_secrets.local`. Run the workflow once by hand
   (Actions > Pull Finances (Plaid) > Run workflow) to backfill and confirm.

## How it stays clean

- **No duplicates, no gaps.** For each account the sync only inserts
  transactions dated *after* that account's last **manual** row
  (`plaid_transaction_id IS NULL`). That watermark is stable, so Plaid picks up
  exactly where the manual import stopped:
  checking after 2026-08-31, cc_5113 after 2026-08-26, cc_4433 after 2026-09-09.
- **Sign.** `expense_transactions` stores money-out negative / money-in
  positive; Plaid is the opposite, so the sync flips the sign.
- **Categories.** Applied from `category_mapping` (lowest `priority` wins),
  identical to the manual pipeline. Unmatched -> NULL category.
- **Idempotent.** Upsert on `plaid_transaction_id`; re-runs are safe. The ~2,700
  existing manual rows have a NULL id and are never touched.
- **Cursor.** Stored in Supabase, so the daily runner resumes incrementally.

## Privacy

Full account/card numbers are never stored — only the last 4 (`mask`). Secrets
live in `.env` (local) and GitHub Actions secrets; never commit them.

## Adding an account later

Add its mask -> source line to `MASK_TO_SOURCE` in **both** scripts, re-run
`plaid_link.py` if it is a new login, and set the new source's watermark by
importing its history once (or let `PLAID_SYNC_FLOOR` govern a fresh account).
