"""
Lab PDF + InBody image auto-ingestion pipeline.
Scans Google Drive Medical folder for new PDFs and InBody images,
extracts values, inserts into Supabase.
"""
import os, json, re, io, sys, base64
from datetime import date, datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import anthropic
import pdfplumber
from supabase import create_client, Client

# ── Config ────────────────────────────────────────────────────────────────────
GDRIVE_FOLDER_ID = "1_pB5M_-xqWU-jNYykK83fhZiWc5ldrS2"
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
MODEL = "claude-sonnet-5"  # claude-sonnet-4-20250514 has been retired — every call 404'd

LAB_EXTRACT_PROMPT = """You are a medical lab result parser. Extract ALL numeric lab values from the text below.

Return ONLY a valid JSON array. No markdown, no explanation. Start with [ and end with ].

Each element:
{"marcador":"standardized Spanish name","panel":"Thyroid|Complete Blood Count|Lipids|Glucose & Metabolic|Liver|Kidney|Electrolytes|Vitamins & Iron|Enzymes & Muscle|Inflammation|Other","valor":0.0,"unidad":"unit","ref_min":0.0,"ref_max":0.0,"flag":"H|L|normal"}

Panel categorization guide (pick exactly ONE per marker, using these canonical names):
- Thyroid: TSH, T3/T4 (free/total), thyroglobulin, anti-TG, anti-TPO, calcitonin
- Complete Blood Count: RBC, hemoglobin, hematocrit, WBC, platelets, MCV/MCH/MCHC/RDW/MPV, and all differentials (neutrophils, lymphocytes, monocytes, eosinophils, basophils, reticulocytes)
- Lipids: total cholesterol, LDL, HDL, VLDL, triglycerides, non-HDL
- Glucose & Metabolic: glucose, HbA1c, insulin, C-peptide
- Liver: ALT, AST, GGT, ALP, bilirubin (all fractions), albumin, total protein, transaminases
- Kidney: creatinine, urea/BUN, uric acid, eGFR, cystatin C
- Electrolytes: sodium, potassium, chloride, calcium, phosphorus, magnesium, CO2/bicarbonate
- Vitamins & Iron: vitamin D (25-OH), B12, folate, iron, ferritin, transferrin, TIBC, iodine, zinc, selenium
- Enzymes & Muscle: CPK/CK, LDH, amylase, lipase, myoglobin
- Inflammation: CRP/PCR, ESR/VSG, procalcitonin
- Other: anything that doesn't clearly fit above (hormones, tumor markers, one-offs)

Rules:
- valor must be a number, never a string
- ref_min and ref_max must be numbers or null
- flag must be exactly "H", "L", or "normal"
- panel must be one of the 11 canonical names above, spelled exactly
- Skip qualitative results (NEGATIVO, AMARILLO, AUSENTES, etc.)
- Skip calculated ratios and indices

Lab text:
"""

INBODY_EXTRACT_PROMPT = """You are an InBody bioimpedance analysis parser. Extract all numeric values from this InBody result image.

Return ONLY a valid JSON object. No markdown, no explanation.

Required fields (use null if not found):
{
  "fecha": "YYYY-MM-DD",
  "peso": 0.0,
  "mme": 0.0,
  "masa_grasa": 0.0,
  "pgc": 0.0,
  "mlg": 0.0,
  "agua": 0.0,
  "tmb": 0,
  "score": 0,
  "angulo_fase": 0.0,
  "grasa_visceral": 0,
  "rel_cintura_cadera": 0.0,
  "imc": 0.0,
  "peso_ideal": 0.0,
  "control_peso": 0.0,
  "control_grasa": 0.0,
  "control_musculo": 0.0,
  "dispositivo": "InBody270S"
}

Extract the date from the image (Fecha / Hora de la prueba field).
grasa_visceral should be the level number (e.g. 5), not a range.
control_peso/grasa/musculo are the target adjustment values (negative = reduce, positive = increase).
"""

# ── Google Drive ──────────────────────────────────────────────────────────────
def get_drive_service():
    creds_info = json.loads(os.environ["GDRIVE_CREDENTIALS"])
    creds = service_account.Credentials.from_service_account_info(creds_info, scopes=SCOPES)
    return build("drive", "v3", credentials=creds)

def list_files_recursive(service, folder_id, mime_types=None):
    """List all files in folder and subfolders recursively."""
    files = []
    folders = service.files().list(
        q=f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id,name)"
    ).execute().get("files", [])
    for folder in folders:
        files.extend(list_files_recursive(service, folder["id"], mime_types))

    mime_filter = ""
    if mime_types:
        conditions = " or ".join(f"mimeType='{m}'" for m in mime_types)
        mime_filter = f" and ({conditions})"

    found = service.files().list(
        q=f"'{folder_id}' in parents{mime_filter} and trashed=false",
        fields="files(id,name,mimeType,parents)"
    ).execute().get("files", [])
    files.extend(found)
    return files

def get_folder_path(service, file_id):
    """Get the folder name containing this file."""
    file = service.files().get(fileId=file_id, fields="parents").execute()
    parents = file.get("parents", [])
    if not parents:
        return ""
    parent = service.files().get(fileId=parents[0], fields="name").execute()
    return parent.get("name", "").lower()

def download_file(service, file_id):
    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buf.seek(0)
    return buf

# ── Already processed ─────────────────────────────────────────────────────────
def get_processed_labs(supabase):
    result = supabase.table('lab_results').select('archivo').not_.is_('archivo', 'null').execute()
    return {row['archivo'] for row in result.data}

def get_processed_inbody(supabase):
    result = supabase.table('inbody_results').select('archivo').not_.is_('archivo', 'null').execute()
    return {row['archivo'] for row in result.data}

# ── Filename parsing ──────────────────────────────────────────────────────────
def parse_filename(filename):
    """Returns (fecha, año, proveedor, estimulada). fecha/año are None when the
    filename's date segment doesn't parse — callers must skip inserting rather
    than falling back to today's date, which would silently mis-date the record.
    Run clean_medical_drive.py to fix filenames like this before they get here."""
    base = filename.replace(".pdf", "").replace(".jpg", "").replace(".jpeg", "").replace(".png", "")
    parts = base.split("_")
    try:
        fecha = date.fromisoformat(parts[0])
        año = fecha.year
    except (ValueError, IndexError):
        fecha, año = None, None

    name_lower = filename.lower()
    if "labcorp" in name_lower:
        proveedor = "Labcorp NY"
    elif "quest-usa" in name_lower or "quest_usa" in name_lower:
        proveedor = "Quest USA"
    elif "quest-mx" in name_lower or "quest_mx" in name_lower:
        proveedor = "Quest MX"
    elif "angeles" in name_lower or "hospital" in name_lower:
        proveedor = "Hospital Ángeles Lomas"
    elif "inbody" in name_lower:
        proveedor = "MNC Javier Luna Moran"
    else:
        proveedor = "Desconocido"

    estimulada = "thyrogen" in name_lower or "thryrogen" in name_lower
    return fecha, año, proveedor, estimulada

# ── Claude response parsing ───────────────────────────────────────────────────
def _extract_text(msg):
    """Return the first text block's content, skipping any thinking/reasoning
    blocks the model may return before its actual answer."""
    for block in msg.content:
        block_text = getattr(block, "text", None)
        if block_text:
            return block_text
    raise ValueError("no text content block in model response")

# ── Lab extraction ────────────────────────────────────────────────────────────
def extract_text_from_pdf(pdf_bytes):
    try:
        with pdfplumber.open(pdf_bytes) as pdf:
            text = ""
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
        return text.strip()
    except Exception as e:
        print(f"    pdfplumber error: {e}")
        return ""

def parse_labs_with_claude(text, client):
    if len(text) > 15000:
        text = text[:15000]
    msg = client.messages.create(
        model=MODEL, max_tokens=8000,
        messages=[{"role": "user", "content": LAB_EXTRACT_PROMPT + text}]
    )
    raw = _extract_text(msg).strip()
    if "```" in raw:
        for p in raw.split("```"):
            p = p.strip().lstrip("json").strip()
            if p.startswith("["): raw = p; break
    start, end = raw.find("["), raw.rfind("]")
    if start != -1 and end != -1:
        raw = raw[start:end+1]
    return json.loads(raw.strip())

# ── InBody extraction ─────────────────────────────────────────────────────────
def parse_inbody_with_claude(image_bytes, mime_type, client):
    img_b64 = base64.standard_b64encode(image_bytes.read()).decode("utf-8")
    msg = client.messages.create(
        model=MODEL, max_tokens=1000,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": img_b64}},
            {"type": "text", "text": INBODY_EXTRACT_PROMPT}
        ]}]
    )
    raw = _extract_text(msg).strip()
    if "```" in raw:
        for p in raw.split("```"):
            p = p.strip().lstrip("json").strip()
            if p.startswith("{"): raw = p; break
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end+1]
    return json.loads(raw.strip())

# ── Panel normalization ───────────────────────────────────────────────────────
# Canonical panel categories — must match the React classifier in
# health/fitness/exercise-app/src/pages/medical/OncologistView.jsx so that
# Supabase stores the same category names the app displays.
CANONICAL_PANELS = [
    "Thyroid",
    "Complete Blood Count",
    "Lipids",
    "Glucose & Metabolic",
    "Liver",
    "Kidney",
    "Electrolytes",
    "Vitamins & Iron",
    "Enzymes & Muscle",
    "Inflammation",
    "Other",
]

def _match_thyroid(m, p):
    return ("tiroide" in p or "thyroid" in p or "tsh" in m
            or ("t3" in m and "bt3" not in m) or ("t4" in m and "vit" not in m)
            or "tiroxina" in m or "thyroxine" in m
            or "triyodo" in m or "triiodo" in m
            or "tiroglobulin" in m or "thyroglobulin" in m
            or "atg" in m or "tgab" in m
            or "tpo" in m or "peroxidasa" in m or "calcitonin" in m)

def _match_cbc(m, p):
    return ("hemograma" in p or "biometria" in p or "hematica" in p
            or "formula blanca" in p or "formula tromboc" in p or "cbc" in p
            or "eritrocit" in m or "hemoglobin" in m or "hematocrit" in m
            or "leucocit" in m or "plaqueta" in m
            or m in ("vcm", "hcm", "chcm", "rdw", "mcv", "mch", "mchc", "mpv")
            or "neutrofil" in m or "linfocit" in m or "monocit" in m
            or "eosinofil" in m or "basofil" in m or "reticulocit" in m)

def _match_lipids(m, p):
    return ("lipid" in p or "colesterol" in m or "cholesterol" in m
            or "ldl" in m or "hdl" in m or "vldl" in m
            or "triglic" in m or "triglyc" in m or "non-hdl" in m)

def _match_glucose(m, p):
    return ("glucemi" in p or "metabol" in p
            or "glucos" in m or "glicem" in m or "hba1c" in m
            or "glicosilada" in m or "a1c" in m
            or "insulin" in m or "peptido c" in m)

def _match_liver(m, p):
    return ("hepatic" in p or "liver" in p
            or m in ("alt", "ast", "ggt", "alp")
            or "bilirrub" in m or "bilirubin" in m
            or "albumin" in m or "total protein" in m
            or ("proteina" in m and "total" in m)
            or "transaminas" in m)

def _match_kidney(m, p):
    return ("renal" in p or "kidney" in p
            or "creatinin" in m or "urea" in m or m == "bun"
            or "acido urico" in m or "uric acid" in m or "egfr" in m or "cistatina" in m)

def _match_electrolytes(m, p):
    return ("electrolit" in p or m in (
        "sodio", "sodium", "potasio", "potassium",
        "cloruro", "chloride", "calcio", "calcium",
        "fosforo", "phosphorus", "magnesio", "magnesium",
        "co2", "bicarbonato",
    ))

def _match_vitamins_iron(m, p):
    return ("vitamin" in p or "vitamin" in m
            or "25-oh" in m or "25(oh)" in m or "calcidiol" in m
            or "folat" in m or "folic" in m or "folico" in m
            or "b12" in m or "cobalamin" in m
            or "hierro" in m or m == "iron" or m == "fe"
            or "ferritin" in m or "transferrin" in m or "tibc" in m
            or "yodo" in m or "iodine" in m
            or "zinc" in m or "selenio" in m or "selenium" in m)

def _match_enzymes(m, p):
    return (m in ("cpk", "ck", "ldh")
            or "amilas" in m or "amylas" in m
            or "lipas" in m or "mioglobin" in m)

def _match_inflammation(m, p):
    return ("pcr" in m or "crp" in m or "vsg" in m or "esr" in m
            or "sedimentacion" in m or "procalcitonin" in m)

_MATCHERS = [
    ("Thyroid", _match_thyroid),
    ("Complete Blood Count", _match_cbc),
    ("Lipids", _match_lipids),
    ("Glucose & Metabolic", _match_glucose),
    ("Liver", _match_liver),
    ("Kidney", _match_kidney),
    ("Electrolytes", _match_electrolytes),
    ("Vitamins & Iron", _match_vitamins_iron),
    ("Enzymes & Muscle", _match_enzymes),
    ("Inflammation", _match_inflammation),
]

def normalize_panel(marker, raw_panel):
    """Return one of CANONICAL_PANELS. Trusts the raw panel only if it is
    already a canonical value; otherwise routes by marker name."""
    if raw_panel in CANONICAL_PANELS:
        return raw_panel
    m = (marker or "").lower().strip()
    p = (raw_panel or "").lower().strip()
    for name, fn in _MATCHERS:
        try:
            if fn(m, p):
                return name
        except Exception:
            continue
    return "Other"

# ── Insert ────────────────────────────────────────────────────────────────────
def insert_labs(supabase, fecha, año, proveedor, archivo, rows, estimulada):
    inserted = 0
    for r in rows:
        try:
            marcador_raw = str(r.get("marcador", ""))[:100]
            panel_raw = r.get("panel")
            panel_normalized = normalize_panel(marcador_raw, panel_raw)
            result = supabase.table('lab_results').insert({
                'fecha': fecha.isoformat() if fecha else None,
                'año': año,
                'archivo': archivo,
                'proveedor': proveedor,
                'panel': panel_normalized,
                'marcador': marcador_raw,
                'valor': float(r.get("valor", 0)),
                'unidad': r.get("unidad"),
                'ref_min': r.get("ref_min"),
                'ref_max': r.get("ref_max"),
                'flag': r.get("flag", ""),
                'estimulada': estimulada,
                'conversion_aplicada': None,
                'revision_requerida': False
            }).execute()
            if result.data:
                inserted += 1
        except Exception as e:
            # Duplicate will fail silently
            if 'duplicate' not in str(e).lower():
                print(f"    insert error {r.get('marcador')}: {e}")
    return inserted

def insert_inbody(supabase, data, archivo, proveedor):
    # The date comes from Claude's vision reading of the InBody image itself
    # (not the filename). If it's missing or unparseable, skip the insert
    # rather than silently stamping it with today's date.
    raw_fecha = data.get("fecha")
    try:
        fecha = date.fromisoformat(raw_fecha) if raw_fecha else None
    except (ValueError, TypeError):
        fecha = None
    if fecha is None:
        print(f"    SKIPPED — InBody date unparseable/missing ({raw_fecha!r}), not inserting")
        return 0
    try:
        result = supabase.table('inbody_results').insert({
            'fecha': fecha.isoformat(),
            'archivo': archivo,
            'peso': data.get("peso"),
            'mme': data.get("mme"),
            'masa_grasa': data.get("masa_grasa"),
            'pgc': data.get("pgc"),
            'mlg': data.get("mlg"),
            'agua': data.get("agua"),
            'tmb': data.get("tmb"),
            'score': data.get("score"),
            'angulo_fase': data.get("angulo_fase"),
            'grasa_visceral': data.get("grasa_visceral"),
            'rel_cintura_cadera': data.get("rel_cintura_cadera"),
            'imc': data.get("imc"),
            'peso_ideal': data.get("peso_ideal"),
            'control_peso': data.get("control_peso"),
            'control_grasa': data.get("control_grasa"),
            'control_musculo': data.get("control_musculo"),
            'dispositivo': data.get("dispositivo", "InBody270S"),
            'proveedor': proveedor
        }).execute()
        inserted = len(result.data) if result.data else 0
    except Exception as e:
        if 'duplicate' not in str(e).lower():
            print(f"    InBody insert error: {e}")
        inserted = 0
    return inserted

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Connecting to Supabase...")
    supabase: Client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])

    print("Connecting to Google Drive...")
    service = get_drive_service()

    processed_labs = get_processed_labs(supabase)
    processed_inbody = get_processed_inbody(supabase)
    print(f"  {len(processed_labs)} lab files already processed")
    print(f"  {len(processed_inbody)} InBody files already processed")

    print("Scanning Google Drive Medical folder...")
    all_files = list_files_recursive(service, GDRIVE_FOLDER_ID, [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
    ])
    print(f"  {len(all_files)} files found")

    # Split into labs and InBody
    new_labs = [
        f for f in all_files
        if f["mimeType"] == "application/pdf"
        and "_labs_" in f["name"]
        and f["name"] not in processed_labs
    ]
    new_inbody = [
        f for f in all_files
        if f["mimeType"] in ("image/jpeg", "image/png", "image/jpg")
        and "inbody" in f["name"].lower()
        and f["name"] not in processed_inbody
    ]

    print(f"  {len(new_labs)} new lab PDFs to process")
    print(f"  {len(new_inbody)} new InBody images to process")

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    total_lab_rows = 0
    total_inbody = 0
    skipped_labs = []

    # ── Process labs ──────────────────────────────────────────────────────────
    for pdf in new_labs:
        filename = pdf["name"]
        print(f"\nLab: {filename}")
        fecha, año, proveedor, estimulada = parse_filename(filename)
        if fecha is None:
            print(f"  SKIPPED — filename date unparseable, not inserting "
                  f"(run clean_medical_drive.py to fix the name, then re-run ingest)")
            skipped_labs.append(filename)
            continue
        print(f"  {fecha} | {proveedor} | estimulada={estimulada}")
        try:
            pdf_bytes = download_file(service, pdf["id"])
        except Exception as e:
            print(f"  Download failed: {e}"); continue
        text = extract_text_from_pdf(pdf_bytes)
        if not text:
            print(f"  No text extracted — skipping"); continue
        try:
            rows = parse_labs_with_claude(text, client)
        except Exception as e:
            print(f"  Parse error: {e}"); continue
        inserted = insert_labs(supabase, fecha, año, proveedor, filename, rows, estimulada)
        print(f"  {len(rows)} markers found, {inserted} inserted")
        total_lab_rows += inserted

    # ── Process InBody ────────────────────────────────────────────────────────
    for img in new_inbody:
        filename = img["name"]
        print(f"\nInBody: {filename}")
        _, _, proveedor, _ = parse_filename(filename)
        mime = img["mimeType"]
        if mime == "image/jpg":
            mime = "image/jpeg"
        try:
            img_bytes = download_file(service, img["id"])
        except Exception as e:
            print(f"  Download failed: {e}"); continue
        try:
            data = parse_inbody_with_claude(img_bytes, mime, client)
        except Exception as e:
            print(f"  Parse error: {e}"); continue
        print(f"  Extracted: peso={data.get('peso')} score={data.get('score')}")
        inserted = insert_inbody(supabase, data, filename, proveedor)
        print(f"  {'Inserted' if inserted else 'Already exists or error'}")
        total_inbody += inserted

    print(f"\n{'='*50}")
    print(f"DONE — Lab rows inserted: {total_lab_rows} | InBody records inserted: {total_inbody}")
    if skipped_labs:
        print(f"SKIPPED {len(skipped_labs)} lab file(s) with an unparseable filename date "
              f"(not inserted — run clean_medical_drive.py):")
        for f in skipped_labs:
            print(f"  - {f}")

if __name__ == "__main__":
    main()
