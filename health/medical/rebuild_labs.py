"""
One-off: re-extract every lab PDF in the Medical Drive tree into the staging
table lab_results_rebuild, so lab_results can be rebuilt cleanly.

Why: the old ingest cut each document at 15,000 characters and ran with
different prompts over time, so the same report ended up loaded more than
once, each copy holding a different partial set of results under different
marker names. This reads every page of every lab PDF (text layer, or Claude
vision for scanned pages), one chunk at a time, and stores one consistent
set of rows per file.

It never touches lab_results. Swapping staging into lab_results is a
separate, reviewed SQL step (see lab_results_backup_20261012 for the
pre-rebuild copy). Per-file results go to lab_rebuild_log.

Usage:  python rebuild_labs.py [--only NAME_SUBSTRING]
"""
import argparse
import base64
import io
import json
import os
import re
import sys

import anthropic
import pdfplumber
from pdf2image import convert_from_bytes

import clean_medical_drive as cmd
import ingest_labs_gdrive as ingest
import medical_inbox as mi

MODEL = os.environ.get("MEDICAL_MODEL", "claude-sonnet-5-5")
CHUNK_CHARS = 9000
MAX_IMAGE_PAGES = 12
STIM_RE = re.compile(r"thyrogen|thryrogen|tirotropina alfa|rh-?tsh|estimulad", re.I)


def call(client, content):
    msg = client.messages.create(model=MODEL, max_tokens=8000, messages=[{"role": "user", "content": content}])
    raw = cmd._extract_text(msg).strip()
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end == -1:
        return []
    return json.loads(raw[start:end + 1])


def extract(client, pdf_bytes):
    """Returns (rows, stats, full_text)."""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_texts = [(p.extract_text() or "").strip() for p in pdf.pages]
    stats = {"pages": len(page_texts), "text_pages": 0, "image_pages": 0, "chunks": 0}
    rows, chunk, full = [], "", []

    def flush():
        nonlocal chunk
        if chunk.strip():
            rows.extend(call(client, ingest.LAB_EXTRACT_PROMPT + chunk))
            stats["chunks"] += 1
        chunk = ""

    for i, t in enumerate(page_texts):
        if len(t) >= cmd.MIN_TEXT_LEN_FOR_TEXT_LAYER:
            stats["text_pages"] += 1
            full.append(t)
            if len(chunk) + len(t) > CHUNK_CHARS:
                flush()
            chunk += f"\n--- page {i + 1} ---\n{t}"
        else:
            flush()
            if stats["image_pages"] >= MAX_IMAGE_PAGES:
                continue
            img = convert_from_bytes(pdf_bytes, dpi=150, first_page=i + 1, last_page=i + 1)[0]
            data = base64.standard_b64encode(cmd._encode_jpeg_under_limit(img)).decode()
            rows.extend(call(client, [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}},
                {"type": "text", "text": ingest.LAB_EXTRACT_PROMPT + "(the lab report page is the image above)"},
            ]))
            stats["image_pages"] += 1
            stats["chunks"] += 1
    flush()
    return rows, stats, "\n".join(full)


def dedupe(rows):
    seen, out = set(), []
    for r in rows:
        try:
            key = (str(r.get("marcador", "")).strip().lower(), round(float(r.get("valor")), 4))
        except (TypeError, ValueError):
            continue
        if key in seen or not key[0]:
            continue
        seen.add(key)
        out.append(r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="only files whose name contains this text")
    args = ap.parse_args()

    service = cmd.get_drive_service()
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    sb = mi.supabase_client()

    files = [(f, p) for f, p, _ in mi.walk(service, mi.MEDICAL_ID, [])
             if "_labs_" in f["name"] and f["mimeType"] == "application/pdf"
             and p[:1] not in ([mi.IN_NAME], [mi.REVISAR_NAME])
             and (not args.only or args.only in f["name"])]
    print(f"{len(files)} lab PDFs")
    failures = 0
    for f, path in sorted(files, key=lambda x: x[0]["name"]):
        name = f["name"]
        fecha, año, proveedor, _ = ingest.parse_filename(name)
        try:
            pdf_bytes = cmd.download_file(service, f["id"])
            rows, stats, text = extract(client, pdf_bytes)
            rows = dedupe(rows)
            estimulada = bool(STIM_RE.search(text)) or bool(STIM_RE.search(name))
            sb.table("lab_results_rebuild").delete().eq("drive_file_id", f["id"]).execute()
            payload = []
            for r in rows:
                payload.append({
                    "fecha": fecha.isoformat(), "año": año, "archivo": name, "proveedor": proveedor,
                    "panel": ingest.normalize_panel(str(r.get("marcador", ""))[:100], r.get("panel")),
                    "marcador": str(r.get("marcador", ""))[:100], "valor": float(r.get("valor")),
                    "unidad": r.get("unidad"), "ref_min": r.get("ref_min"), "ref_max": r.get("ref_max"),
                    "flag": r.get("flag", ""), "estimulada": estimulada, "conversion_aplicada": None,
                    "revision_requerida": False, "drive_file_id": f["id"],
                })
            for i in range(0, len(payload), 200):
                sb.table("lab_results_rebuild").insert(payload[i:i + 200]).execute()
            status, detail = "ok", f"estimulada={estimulada}"
            print(f"{name}: {len(payload)} markers {stats}")
        except Exception as e:
            failures += 1
            payload, stats, status, detail = [], {}, "error", str(e)[:500]
            print(f"{name}: ERROR {e}", file=sys.stderr)
        sb.table("lab_rebuild_log").insert({
            "drive_file_id": f["id"], "archivo": name, "markers": len(payload), "status": status, "detail": detail,
            **{k: stats.get(k) for k in ("pages", "text_pages", "image_pages", "chunks")},
        }).execute()
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
