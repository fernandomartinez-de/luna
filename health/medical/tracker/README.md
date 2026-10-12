# Medical inbox and inventory

## How it works

1. Upload new medical documents (PDFs or photos) to **Google Drive › Medical › IN**.
   If you already know the category, you can drop them into a subfolder such as
   `IN/labs` or `IN/radiologia`; that's used as a hint when the document itself
   is hard to read.
2. Run **Actions › Medical - Process Inbox** (it also runs daily on its own).
   Tick "Preview only" to see the plan without changing anything.
3. Each file is read (PDF text, or Claude vision for scans and photos) and:
   - **Filed**: renamed `YYYY-MM-DD_{category}_{provider}_{type}.ext` and moved to
     `Medical/{year}/{category}/` when the date and category are clear.
   - **_REVISAR**: moved to `Medical/_REVISAR` with a `REVISAR_` prefix when it
     can't be placed confidently (ambiguous day/month, unknown category,
     unreadable, unsupported type). The reason is in the file's Drive
     description (Drive › file › Details). Exact copies of a file already in the
     archive go there too, prefixed `DUP_`.
4. Filed lab PDFs and InBody images are loaded into Supabase
   (`lab_results`, `inbody_results`). If the same results are already stored for
   that date (a rescan or re-download), they're not loaded twice.
5. `Medical/master_tracker.xlsx` is rebuilt as a full inventory of every file in
   the Medical tree: a summary, one sheet with everything, one sheet per year,
   and sheets for `_REVISAR` and anything still in `IN`.

To fix something in `_REVISAR`, rename or move it yourself, or move it back into
`IN` (remove the `REVISAR_` prefix) and run the workflow again.

## Rules

- Nothing is ever deleted.
- Only files that start in `IN` are renamed or moved. The organized archive is
  only read (to check for duplicates and build the inventory).
- Supabase loading only happens for files this pipeline filed, tracked on the
  Drive file itself (`appProperties.luna_filed` / `luna_ingested`), never by
  file name, so renaming archived files can't reload old results. A failed load
  is retried on the next run and makes the workflow show as failed.
- Ambiguous day/month dates (both numbers 12 or under) are never guessed unless
  a second date on the same document or the uploaded file name settles it.

## Code

- `medical_inbox.py`: the pipeline above.
- `clean_medical_drive.py`: shared classification and date rules (can also be
  run by hand as a whole-archive audit; no workflow schedules it).
- `ingest_labs_gdrive.py`: Supabase loaders used by the pipeline. Its old
  "scan Drive and load by file name" entry point is retired.

The inventory lives only in Drive (it isn't committed here).
