"""
Medical inbox pipeline.

    You drop new medical documents into  Medical/IN  (Google Drive), then run
    the "Medical - Process Inbox" workflow (it also runs daily on its own).

    For every file in IN:
      1. Read it (PDF text layer, or Claude vision for scans/photos) and work out
         the collection date, category, provider and document type.
      2. If date AND category are confident, rename it to
             YYYY-MM-DD_{category}_{provider}_{type}.ext
         and move it to  Medical/{year}/{category}/  (folders created as needed).
      3. Otherwise move it to  Medical/_REVISAR  (prefixed REVISAR_), with the
         reason written into the file's Drive description. Exact duplicates of a
         file already in the archive go there too, prefixed DUP_.
      4. Lab PDFs and InBody images that were filed get loaded into Supabase
         (lab_results / inbody_results).
    Then the inventory workbook  Medical/master_tracker.xlsx  is rebuilt from
    every file in the Medical tree.

Safety
  - Nothing is ever deleted.
  - Only files that start in IN are ever renamed or moved; the organized
    archive is read-only to this script (apart from the inventory file).
  - Supabase loading only ever touches files this pipeline filed, tracked on
    the Drive file itself (appProperties luna_filed / luna_ingested). Older
    archive files are never re-read, so renaming them can't cause duplicates.
  - Ambiguous day/month dates are never guessed (see resolve_date in
    clean_medical_drive.py); those files go to _REVISAR.

Usage
  python medical_inbox.py              # process IN, load data, rebuild inventory
  python medical_inbox.py --dry-run    # show the plan, change nothing (inventory is still rebuilt locally)
"""
import argparse
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timezone

from googleapiclient.http import MediaFileUpload

import clean_medical_drive as cmd   # classification + date rules
import ingest_labs_gdrive as ingest  # Supabase loaders

MODEL = os.environ.get("MEDICAL_MODEL", "claude-sonnet-5-5")
cmd.MODEL = MODEL
ingest.MODEL = MODEL

MEDICAL_ID = cmd.GDRIVE_FOLDER_ID
IN_NAME = "IN"
REVISAR_NAME = cmd.REVISAR_FOLDER_NAME
TRACKER_NAME = cmd.TRACKER_DRIVE_NAME
FOLDER_MIME = "application/vnd.google-apps.folder"
SUPPORTED = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
NAME_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})_([a-z]+)_([a-z0-9-]+)_([a-z0-9-]+)\.[a-z0-9]+$", re.I)
LIST_FIELDS = "nextPageToken, files(id,name,mimeType,parents,createdTime,modifiedTime,size,md5Checksum,description,appProperties)"


# ── Drive helpers ────────────────────────────────────────────────────────────
def children(service, folder_id):
    out, token = [], None
    while True:
        r = service.files().list(q=f"'{folder_id}' in parents and trashed=false",
                                 fields=LIST_FIELDS, pageToken=token, pageSize=1000).execute()
        out += r.get("files", [])
        token = r.get("nextPageToken")
        if not token:
            return out


def walk(service, folder_id, path):
    """Yield (file, path_parts, parent_id) for every non-folder file below folder_id."""
    for f in children(service, folder_id):
        if f["mimeType"] == FOLDER_MIME:
            yield from walk(service, f["id"], path + [f["name"]])
        else:
            yield f, path, folder_id


class Folders:
    """Finds or creates folders under Medical, caching ids. In dry-run mode
    missing folders get placeholder ids instead of being created."""

    def __init__(self, service, dry_run):
        self.service, self.dry_run, self.cache = service, dry_run, {}

    def get(self, parent_id, name):
        key = (parent_id, name)
        if key in self.cache:
            return self.cache[key]
        found = None
        if not parent_id.startswith("PLANNED:"):
            found = next((f for f in children(self.service, parent_id)
                          if f["mimeType"] == FOLDER_MIME and f["name"] == name), None)
        if found:
            fid = found["id"]
        elif self.dry_run:
            fid = f"PLANNED:{parent_id}/{name}"
        else:
            fid = self.service.files().create(
                body={"name": name, "mimeType": FOLDER_MIME, "parents": [parent_id]}, fields="id").execute()["id"]
        self.cache[key] = fid
        return fid

    def path(self, *names):
        fid = MEDICAL_ID
        for n in names:
            fid = self.get(fid, n)
        return fid


def unique_name(service, folder_id, name, taken):
    """Avoid overwriting-looking collisions: name.pdf -> name-2.pdf if taken."""
    existing = set(taken)
    if not folder_id.startswith("PLANNED:"):
        existing |= {f["name"] for f in children(service, folder_id)}
    if name not in existing:
        return name
    stem, ext = os.path.splitext(name)
    i = 2
    while f"{stem}-{i}{ext}" in existing:
        i += 1
    return f"{stem}-{i}{ext}"


# ── Deciding where a file goes ───────────────────────────────────────────────
def date_order_hint(c, doc_text=""):
    """How this document orders day and month, from evidence on the document
    itself: a second date, the printed birth date, or any other slash date in
    its text. Returns (hint or None, where it came from)."""
    for source, text in (("second date", c.get("fecha_secundaria_texto")),
                         ("birth date", c.get("fecha_nacimiento_texto"))):
        h = cmd.numeric_order_hint(text)
        if h:
            return h, f"{source} {text!r}"
    h = cmd.document_order_hint(doc_text)
    return (h, "other dates in the document") if h else (None, None)


def decide(classification, filename, hint_category=None, doc_text=""):
    """Port of clean_medical_drive's per-file rules. Returns dict with either
    {ok: True, fecha, categoria, proveedor, tipo, note} or {ok: False, reason}."""
    c = classification or {}
    order_hint, hint_source = date_order_hint(c, doc_text)
    fecha, date_reason, via_hint = cmd.resolve_date(c.get("fecha_texto"), order_hint)
    categoria = c.get("categoria")
    confianza = c.get("categoria_confianza", "baja")
    notes = []

    if (not categoria or categoria not in cmd.CATEGORIES or confianza != "alta") and hint_category in cmd.CATEGORIES:
        categoria, confianza = hint_category, "alta"
        notes.append(f"category taken from IN/{hint_category} subfolder")

    if fecha is None and date_reason == "ambiguous_day_month":
        existing = cmd.existing_filename_date(filename)
        as_dm, as_md = cmd.both_date_interpretations(c.get("fecha_texto"))
        if existing and as_dm != as_md and existing.isoformat() in (as_dm, as_md):
            fecha = existing
            notes.append(f"ambiguous date {c.get('fecha_texto')!r} confirmed by the uploaded filename")

    if fecha is None and date_reason == "no_date_found" and c.get("fecha_secundaria_texto"):
        sec, _, _ = cmd.resolve_date(c.get("fecha_secundaria_texto"))
        if sec:
            fecha = sec
            notes.append(f"no collection date on document; used {c.get('fecha_secundaria_label') or 'report date'} "
                         f"{c.get('fecha_secundaria_texto')!r}")
    if via_hint:
        notes.append(f"day/month order of {c.get('fecha_texto')!r} taken from {hint_source}")

    problems = []
    if fecha is None:
        msg = f"date: {date_reason}"
        if date_reason == "ambiguous_day_month":
            as_dm, as_md = cmd.both_date_interpretations(c.get("fecha_texto"))
            if as_dm and as_md:
                msg += f" ({c.get('fecha_texto')!r} could be {as_dm} or {as_md})"
        problems.append(msg)
    if not categoria or categoria not in cmd.CATEGORIES or confianza != "alta":
        problems.append(f"category not confident ({c.get('categoria')!r}, {confianza})")
    if fecha and fecha > date.today():
        problems.append(f"date {fecha} is in the future")
    if problems:
        return {"ok": False, "reason": "; ".join(problems)}
    return {"ok": True, "fecha": fecha, "categoria": categoria,
            "proveedor": c.get("proveedor") or "otro", "tipo": c.get("tipo") or "otro",
            "note": " | ".join(notes)}


# ── Supabase loading ─────────────────────────────────────────────────────────
def supabase_client():
    from supabase import create_client
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"]
    return create_client(os.environ["SUPABASE_URL"], key)


def load_into_supabase(service, sb, client, f, file_bytes):
    """Load one filed lab PDF / InBody image. Returns (ok, message)."""
    name, mime = f["name"], f["mimeType"]
    fecha, año, proveedor, estimulada = ingest.parse_filename(name)
    if "_labs_" in name and mime == "application/pdf":
        if fecha is None:
            return False, "filename date unparseable"
        text = ingest.extract_text_from_pdf(io.BytesIO(file_bytes))
        if not text:
            return False, "no text layer in lab PDF (scanned?) — values not loaded"
        rows = ingest.parse_labs_with_claude(text, client)
        dup = already_loaded(sb, fecha, rows)
        if dup:
            return True, dup
        n = ingest.insert_labs(sb, fecha, año, proveedor, name, rows, estimulada)
        if rows and n == 0:
            return False, f"{len(rows)} markers parsed but none inserted"
        return True, f"{n} lab markers loaded"
    if "_inbody_" in name and mime in ("image/jpeg", "image/png", "image/jpg"):
        data = ingest.parse_inbody_with_claude(io.BytesIO(file_bytes), "image/png" if mime == "image/png" else "image/jpeg", client)
        n = ingest.insert_inbody(sb, data, name, proveedor)
        return (n > 0), ("InBody scan loaded" if n else "InBody scan not inserted (date missing?)")
    return True, None  # not a loadable type (radiology, pathology, ...)


def already_loaded(sb, fecha, rows, threshold=0.8):
    """Guard against the same results arriving twice under a different file
    (a rescan, a photo of the PDF, a re-download). If most of this document's
    (marker, value) pairs are already stored for the same date, skip it and
    say which file they came from. Returns a message, or None if it's new."""
    if not rows:
        return None
    existing = sb.table("lab_results").select("archivo, marcador, valor").eq("fecha", fecha.isoformat()).execute().data or []
    if not existing:
        return None

    def key(m, v):
        try:
            return (str(m).strip().lower(), round(float(v), 3))
        except (TypeError, ValueError):
            return None

    stored = defaultdict(set)
    for r in existing:
        k = key(r["marcador"], r["valor"])
        if k:
            stored[r["archivo"]].add(k)
    incoming = {k for r in rows if (k := key(r.get("marcador"), r.get("valor")))}
    if not incoming:
        return None
    best = max(stored, key=lambda a: len(incoming & stored[a]), default=None)
    overlap = len(incoming & stored[best]) if best else 0
    if overlap / len(incoming) >= threshold:
        return f"already in Supabase: {overlap} of {len(incoming)} results match {best}; not loaded again"
    return None


def mark(service, file_id, **props):
    service.files().update(fileId=file_id, body={"appProperties": props}).execute()


# ── Inventory workbook ───────────────────────────────────────────────────────
# Files that are another copy of a report already loaded (same results, so
# loading them again would double count). Keyed by Drive file id.
SAME_REPORT = {
    "1q6YfszsnBRSFzts8znV0Pk7NgcllqlyB": "2026-03-05_labs_hospital-angeles-lomas_general.pdf",  # scanned copy, annotated "Estudios con Thyrogen"
}


def loaded_label(f, in_db):
    if not needs_load(f):
        return ""
    if in_db.get(f["name"]):
        return f"{in_db[f['name']]} results"
    twin = SAME_REPORT.get(f["id"])
    if twin and in_db.get(twin):
        return f"same report as {twin}"
    return "MISSING"


def supabase_counts(sb):
    """{archivo: rows} for lab_results and inbody_results, or None if unavailable."""
    if sb is None:
        return None
    counts = Counter()
    for table in ("lab_results", "inbody_results"):
        start = 0
        while True:
            data = sb.table(table).select("archivo").range(start, start + 999).execute().data or []
            counts.update(r["archivo"] for r in data if r.get("archivo"))
            if len(data) < 1000:
                break
            start += 1000
    return counts


def build_inventory(service, run_log, out_path, sb=None):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    try:
        in_db = supabase_counts(sb)
    except Exception as e:
        print(f"Supabase check skipped: {e}")
        in_db = None
    rows, revisar, inbox = [], [], []
    for f, path, _ in walk(service, MEDICAL_ID, []):
        if not path and f["name"] == TRACKER_NAME:
            continue
        m = NAME_RE.match(f["name"])
        props = f.get("appProperties") or {}
        rec = {
            "name": f["name"], "folder": "/".join(path) or "(Medical)",
            "date": m.group(1) if m else "", "category": m.group(2) if m else "",
            "provider": m.group(3) if m else "", "type": m.group(4) if m else "",
            "size_kb": round(int(f.get("size") or 0) / 1024, 1),
            "added": (f.get("createdTime") or "")[:10],
            "loaded": (loaded_label(f, in_db) if in_db is not None
                       else ("yes" if props.get("luna_ingested") or f["id"] in SAME_REPORT else "")),
            "notes": f.get("description") or "",
            "link": f"https://drive.google.com/file/d/{f['id']}/view",
        }
        if path[:1] == [REVISAR_NAME]:
            revisar.append(rec)
        elif path[:1] == [IN_NAME]:
            inbox.append(rec)
        else:
            rows.append(rec)

    cols = [("File", "name"), ("Date", "date"), ("Category", "category"), ("Provider", "provider"),
            ("Type", "type"), ("Folder", "folder"), ("Size KB", "size_kb"), ("Added", "added"),
            ("In Supabase", "loaded"), ("Notes", "notes"), ("Link", "link")]
    head_fill, head_font = PatternFill("solid", start_color="1F2937"), Font(color="FFFFFF", bold=True)

    def sheet(wb, title, recs):
        ws = wb.create_sheet(title[:31])
        ws.append([c for c, _ in cols])
        for cell in ws[1]:
            cell.fill, cell.font = head_fill, head_font
        for r in sorted(recs, key=lambda r: (r["date"] or "0000", r["name"]), reverse=True):
            ws.append([r[k] for _, k in cols])
            link = ws.cell(row=ws.max_row, column=len(cols))
            link.hyperlink, link.style = r["link"], "Hyperlink"
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        for i, (c, k) in enumerate(cols, 1):
            width = max([len(c)] + [len(str(r[k])) for r in recs]) + 2
            ws.column_dimensions[get_column_letter(i)].width = min(max(width, 8), 55)

    wb = Workbook()
    s = wb.active
    s.title = "Resumen"
    s.append(["Medical inventory"]); s["A1"].font = Font(bold=True, size=14)
    s.append(["Updated (UTC)", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")])
    s.append(["Files in archive", len(rows)])
    s.append(["Waiting in _REVISAR", len(revisar)])
    s.append(["Still in IN", len(inbox)])
    if in_db is not None:
        missing = [r["name"] for r in rows if r["loaded"] == "MISSING"]
        s.append(["Lab/InBody files missing from Supabase", len(missing)])
        for n in missing:
            s.append(["", n])
    s.append([])
    by_year_cat = defaultdict(Counter)
    for r in rows:
        by_year_cat[r["date"][:4] or "sin fecha"][r["category"] or "otro"] += 1
    cats = list(cmd.CATEGORIES_ORDERED) + sorted({c for y in by_year_cat.values() for c in y} - set(cmd.CATEGORIES_ORDERED))
    s.append(["Year"] + cats + ["Total"])
    for cell in s[s.max_row]:
        cell.font = Font(bold=True)
    for y in sorted(by_year_cat, reverse=True):
        s.append([y] + [by_year_cat[y].get(c, 0) for c in cats] + [sum(by_year_cat[y].values())])
    if run_log:
        s.append([])
        s.append(["Last run"]); s.cell(row=s.max_row, column=1).font = Font(bold=True)
        for line in run_log:
            s.append([line["file"], line["result"], line.get("detail", "")])
    s.column_dimensions["A"].width = 48
    s.column_dimensions["B"].width = 40
    s.column_dimensions["C"].width = 60

    sheet(wb, "Inventario", rows)
    for y in sorted({r["date"][:4] for r in rows if r["date"]}, reverse=True):
        sheet(wb, y, [r for r in rows if r["date"].startswith(y)])
    sheet(wb, REVISAR_NAME, revisar)
    if inbox:
        sheet(wb, IN_NAME, inbox)
    wb.save(out_path)
    return len(rows), len(revisar), len(inbox)


def needs_load(f):
    n = f["name"]
    return ("_labs_" in n and f["mimeType"] == "application/pdf") or \
           ("_inbody_" in n and f["mimeType"].startswith("image/"))


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="plan only; nothing in Drive or Supabase changes")
    ap.add_argument("--inventory", default=os.path.join("tracker", "master_tracker.xlsx"))
    args = ap.parse_args()
    dry = args.dry_run

    import anthropic
    service = cmd.get_drive_service()
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    folders = Folders(service, dry)
    in_id = folders.path(IN_NAME)
    revisar_id = folders.path(REVISAR_NAME)
    print(f"{'DRY RUN — ' if dry else ''}model {MODEL}")

    # Everything already in the archive, for duplicate detection and resuming loads.
    archive = [(f, p, pid) for f, p, pid in walk(service, MEDICAL_ID, [])
               if p[:1] not in ([IN_NAME], [REVISAR_NAME]) and not (not p and f["name"] == TRACKER_NAME)]
    known_md5 = {f.get("md5Checksum"): "/".join(p + [f["name"]]) for f, p, _ in archive if f.get("md5Checksum")}

    inbox = [] if in_id.startswith("PLANNED:") else list(walk(service, in_id, []))
    print(f"{len(inbox)} file(s) in IN, {len(archive)} in the archive")

    run_log, failures, to_load = [], [], []
    taken = defaultdict(list)   # names claimed this run per folder, so two uploads can't collide
    consecutive_errors = 0

    for f, sub, parent in inbox:
        label = "/".join([IN_NAME] + sub + [f["name"]])
        print(f"\n{label}")

        def quarantine(prefix, reason):
            new = unique_name(service, revisar_id, prefix + f["name"], taken[revisar_id])
            taken[revisar_id].append(new)
            print(f"  -> {REVISAR_NAME}/{new}  ({reason})")
            if not dry:
                service.files().update(fileId=f["id"], addParents=revisar_id, removeParents=parent,
                                       body={"name": new, "description": f"Luna inbox {date.today()}: {reason}"}).execute()
            run_log.append({"file": f["name"], "result": f"{REVISAR_NAME}/{new}", "detail": reason})

        if f["mimeType"] not in SUPPORTED:
            quarantine("REVISAR_", f"unsupported file type {f['mimeType']}")
            continue
        if f.get("md5Checksum") in known_md5:
            quarantine("DUP_", f"identical to {known_md5[f['md5Checksum']]}")
            continue

        file_bytes = cmd.download_file(service, f["id"])
        classification, method, err = cmd.classify_document(file_bytes, f["mimeType"], client)
        if err or not classification:
            if cmd.looks_systemic(err):
                failures.append(f"API problem, stopped before touching more files: {err}")
                break
            consecutive_errors += 1
            if consecutive_errors >= cmd.CONSECUTIVE_FAILURE_ABORT_THRESHOLD:
                failures.append(f"{consecutive_errors} reads failed in a row, stopping. Last: {err}")
                break
            quarantine("REVISAR_", f"could not read document ({method}): {err}")
            continue
        consecutive_errors = 0

        hint = sub[0] if sub and sub[0] in cmd.CATEGORIES else None
        doc_text = cmd.extract_pdf_text(file_bytes) if f["mimeType"] == "application/pdf" else ""
        d = decide(classification, f["name"], hint, doc_text)
        if not d["ok"]:
            quarantine("REVISAR_", d["reason"])
            continue

        ext = os.path.splitext(f["name"])[1].lower() or (".pdf" if f["mimeType"] == "application/pdf" else ".jpg")
        target_folder = folders.path(str(d["fecha"].year), d["categoria"])
        new = unique_name(service, target_folder,
                          cmd.build_target_name(d["fecha"], d["categoria"], d["proveedor"], d["tipo"], ext),
                          taken[target_folder])
        taken[target_folder].append(new)
        dest = f"{d['fecha'].year}/{d['categoria']}/{new}"
        print(f"  -> {dest}" + (f"  ({d['note']})" if d["note"] else ""))
        if not dry:
            service.files().update(fileId=f["id"], addParents=target_folder, removeParents=parent,
                                   body={"name": new, "appProperties": {"luna_filed": date.today().isoformat()},
                                         **({"description": f"Luna inbox: {d['note']}"} if d["note"] else {})}).execute()
        known_md5[f.get("md5Checksum")] = dest
        filed = dict(f, name=new, appProperties={"luna_filed": "1"})
        run_log.append({"file": f["name"], "result": dest, "detail": d["note"]})
        if needs_load(filed):
            to_load.append((filed, file_bytes))

    # Earlier filed files whose Supabase load failed get retried.
    for f, p, _ in archive:
        props = f.get("appProperties") or {}
        if (props.get("luna_filed") and not props.get("luna_ingested") and needs_load(f)
                and f["id"] not in SAME_REPORT):
            to_load.append((f, None))

    if to_load:
        sb = None if dry else supabase_client()
        for f, file_bytes in to_load:
            if dry:
                print(f"\nwould load into Supabase: {f['name']}")
                continue
            try:
                file_bytes = file_bytes or cmd.download_file(service, f["id"])
                ok, msg = load_into_supabase(service, sb, client, f, file_bytes)
            except Exception as e:
                ok, msg = False, f"load error: {e}"
            print(f"\nSupabase: {f['name']}: {msg}")
            if ok:
                mark(service, f["id"], luna_ingested=date.today().isoformat())
            else:
                failures.append(f"{f['name']}: {msg} (will retry next run)")
            if msg:
                run_log.append({"file": f["name"], "result": "Supabase" if ok else "Supabase FAILED", "detail": msg})

    os.makedirs(os.path.dirname(args.inventory) or ".", exist_ok=True)
    sb_inv = None
    try:
        sb_inv = supabase_client()
    except Exception as e:
        print(f"No Supabase for inventory check: {e}")
    n_archive, n_revisar, n_in = build_inventory(service, run_log, args.inventory, sb_inv)
    print(f"\nInventory: {n_archive} archived, {n_revisar} in {REVISAR_NAME}, {n_in} left in {IN_NAME}")
    if not dry:
        cmd.upload_tracker_to_drive(service, args.inventory, MEDICAL_ID)
        print(f"Updated Medical/{TRACKER_NAME}")

    filed = sum(1 for r in run_log if not r["result"].startswith((REVISAR_NAME, "Supabase")))
    sent = sum(1 for r in run_log if r["result"].startswith(REVISAR_NAME))
    print(f"\nDONE: {filed} filed, {sent} sent to {REVISAR_NAME}" + (" (dry run, nothing changed)" if dry else ""))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as fh:
            fh.write(f"### Medical inbox{' (dry run)' if dry else ''}\n\n{filed} filed, {sent} to {REVISAR_NAME}, "
                     f"{n_archive} files in archive\n\n")
            for r in run_log:
                fh.write(f"- **{r['file']}** → {r['result']}" + (f" — {r['detail']}" if r.get("detail") else "") + "\n")
            for msg in failures:
                fh.write(f"- ⚠️ {msg}\n")
    if failures:
        print("\nPROBLEMS:\n  " + "\n  ".join(failures), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
