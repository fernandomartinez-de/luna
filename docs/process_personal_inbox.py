#!/usr/bin/env python3
"""
Process personal documents from inbox to Google Drive

Detects document type, renames to standard format, files to correct folder
"""
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from PyPDF2 import PdfReader

# Paths
VAULT_ROOT = Path(r"C:\Users\fmartine\Personal\repos\personal\vault")
INBOX_FOLDER = VAULT_ROOT / "ops" / "incoming"
GDRIVE_ROOT = Path(r"G:\My Drive\Personal")
TRACKING_NOTE = VAULT_ROOT / "ops" / "outgoing" / "docs" / "processing-log.md"

# Document type detection patterns
DETECTION_PATTERNS = {
    "w2": {
        "keywords": ["w-2", "w2", "wage", "tax statement"],
        "target_folder": "Tax/W2",
        "category": "w2"
    },
    "tax-return": {
        "keywords": ["tax return", "1040", "turbotax"],
        "target_folder": "Tax",
        "category": "return"
    },
    "1098": {
        "keywords": ["1098", "mortgage interest"],
        "target_folder": "Tax",
        "category": "mortgage-1098"
    },
    "1099": {
        "keywords": ["1099"],
        "target_folder": "Tax",
        "category": "1099"
    },
    "passport": {
        "keywords": ["passport", "pasaporte"],
        "target_folder": "ID",
        "category": "passport"
    },
    "drivers-license": {
        "keywords": ["driver", "license", "dmv"],
        "target_folder": "ID/Drivers Liscence",
        "category": "drivers-license"
    },
    "visa": {
        "keywords": ["visa", "tn", "i-94"],
        "target_folder": "ID",
        "category": "visa"
    },
    "ssn": {
        "keywords": ["social security", "ssn"],
        "target_folder": "ID/SSN",
        "category": "ssn"
    },
    "offer-letter": {
        "keywords": ["offer letter", "employment offer"],
        "target_folder": "Employment",
        "category": "offer-letter"
    },
    "benefits": {
        "keywords": ["benefits", "insurance", "health plan"],
        "target_folder": "Employment",
        "category": "benefits"
    },
    "medical-labs": {
        "keywords": ["lab", "laboratory", "quest", "labcorp", "biometria"],
        "target_folder": "Medical",
        "category": "labs"
    },
    "medical-radiology": {
        "keywords": ["radiology", "radiologia", "x-ray", "pet scan", "ct scan"],
        "target_folder": "Medical",
        "category": "radiologia"
    },
    "medical-ultrasound": {
        "keywords": ["ultrasound", "ultrasonido", "sonography"],
        "target_folder": "Medical",
        "category": "ultrasonidos"
    },
    "property-insurance": {
        "keywords": ["homeowner", "home insurance", "property insurance"],
        "target_folder": "Insurance",
        "category": "home"
    },
    "property-contract": {
        "keywords": ["purchase agreement", "sales contract", "contract of sale"],
        "target_folder": "Property",
        "category": "contract"
    },
    "property-mortgage": {
        "keywords": ["mortgage", "loan commitment"],
        "target_folder": "Property",
        "category": "mortgage"
    },
    "degree": {
        "keywords": ["degree", "diploma", "bachelor", "master"],
        "target_folder": "Education",
        "category": "degree"
    },
    "transcript": {
        "keywords": ["transcript", "academic record"],
        "target_folder": "Education",
        "category": "transcripts"
    },
    "trust-will": {
        "keywords": ["will", "pour over will", "last will", "testament"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    },
    "trust-living": {
        "keywords": ["revocable living trust", "living trust", "trust agreement"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    },
    "trust-hipaa": {
        "keywords": ["hipaa", "hipaa authorization", "health information"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    },
    "trust-poa": {
        "keywords": ["power of attorney", "attorney-in-fact", "poa"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    },
    "trust-directive": {
        "keywords": ["advance health care directive", "living will", "health care directive"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    },
    "trust-assets": {
        "keywords": ["schedule of assets", "asset schedule", "trust assets"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    },
    "trust-certification": {
        "keywords": ["certification of trust", "trust certification"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    },
    "trust-guide": {
        "keywords": ["trust funding guide", "funding guide"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    },
    "trust-transfer": {
        "keywords": ["bill of transfer", "transfer of property", "deed transfer"],
        "target_folder": "Property/66 S 6th Street/Trust",
        "category": "trust"
    }
}

print("="*80)
print("PERSONAL DOCUMENTS INBOX PROCESSOR")
print("="*80)
print(f"Watching: {INBOX_FOLDER}")
print(f"Target: {GDRIVE_ROOT}")
print("="*80)

# Create inbox if doesn't exist
INBOX_FOLDER.mkdir(parents=True, exist_ok=True)

# Check for files
files = list(INBOX_FOLDER.glob("*.pdf")) + list(INBOX_FOLDER.glob("*.jpg")) + list(INBOX_FOLDER.glob("*.png"))
files = [f for f in files if f.name != "README.md"]

if not files:
    print("\n✓ Inbox is empty - no files to process")
    exit(0)

print(f"\nFound {len(files)} file(s) in inbox:")
for f in files:
    print(f"  - {f.name}")

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF for keyword detection"""
    try:
        reader = PdfReader(str(pdf_path))
        text = ""
        for page in reader.pages[:5]:  # Only first 5 pages
            text += page.extract_text()
        return text.lower()
    except:
        return ""

def detect_document_type(file_path):
    """Detect document type from filename and content"""
    filename = file_path.name.lower()

    # Try filename first
    for doc_type, config in DETECTION_PATTERNS.items():
        for keyword in config["keywords"]:
            if keyword.lower() in filename:
                return doc_type, config

    # Try PDF content
    if file_path.suffix.lower() == '.pdf':
        content = extract_text_from_pdf(file_path)
        for doc_type, config in DETECTION_PATTERNS.items():
            for keyword in config["keywords"]:
                if keyword.lower() in content:
                    return doc_type, config

    return None, None

def extract_date_from_filename(filename):
    """Try to extract date from filename"""
    # Try YYYY-MM-DD format
    match = re.search(r'20\d{2}-\d{2}-\d{2}', filename)
    if match:
        return match.group(0)

    # Try YYYY-MM format
    match = re.search(r'20\d{2}-\d{2}', filename)
    if match:
        return match.group(0) + "-01"

    # Try YYYY format
    match = re.search(r'20\d{2}', filename)
    if match:
        return match.group(0) + "-01-01"

    # Default to today
    return datetime.now().strftime("%Y-%m-%d")

def extract_source(filename, doc_type):
    """Extract source/issuer from filename"""
    filename_lower = filename.lower()

    # Known sources
    sources = {
        "ssc": ["ss&c", "ssc"],
        "prestige": ["prestige"],
        "nydis": ["nydis", "disaster"],
        "kyriba": ["kyriba"],
        "quest": ["quest"],
        "labcorp": ["labcorp"],
        "chase": ["chase"],
        "liberty-mutual": ["liberty"],
        "spain": ["spain", "españa", "espana"],
        "canada": ["canada"],
        "mexico": ["mexico"],
        "ny": ["new york", "nys"],
        "turbotax": ["turbotax"]
    }

    for source, keywords in sources.items():
        for keyword in keywords:
            if keyword in filename_lower:
                return source

    return "unknown"

def generate_standard_filename(file_path, doc_type, config):
    """Generate standardized filename"""
    date = extract_date_from_filename(file_path.name)
    source = extract_source(file_path.name, doc_type)
    category = config["category"]
    ext = file_path.suffix

    # Special handling for medical - add year subfolder
    if "medical" in doc_type:
        year = date.split("-")[0]
        target_folder = f"{config['target_folder']}/{year}/{category}"
    else:
        target_folder = config["target_folder"]

    # Generate filename
    if source != "unknown":
        filename = f"{date}_{category}_{source}{ext}"
    else:
        filename = f"{date}_{category}{ext}"

    return filename, target_folder

processed = []

for file in files:
    print(f"\n✓ Processing {file.name}...")

    # Detect document type
    doc_type, config = detect_document_type(file)

    if not doc_type:
        print(f"  ⚠️  Could not detect document type")
        print(f"  Skipping... (add keywords to filename or move manually)")
        continue

    print(f"  Type detected: {doc_type}")

    # Generate standard filename
    new_filename, target_folder = generate_standard_filename(file, doc_type, config)

    # Ensure target folder exists
    full_target_folder = GDRIVE_ROOT / target_folder
    full_target_folder.mkdir(parents=True, exist_ok=True)

    # Target path
    target_path = full_target_folder / new_filename

    # Handle duplicates
    counter = 1
    while target_path.exists():
        stem = target_path.stem
        ext = target_path.suffix
        target_path = full_target_folder / f"{stem}-{counter}{ext}"
        counter += 1

    print(f"  Filing to: {target_folder}/{target_path.name}")

    # Move file
    shutil.move(str(file), str(target_path))

    processed.append({
        "original": file.name,
        "doc_type": doc_type,
        "new_name": target_path.name,
        "folder": str(target_folder),
        "timestamp": datetime.now()
    })

# Create tracking note
print(f"\n✓ Creating tracking note...")

if TRACKING_NOTE.exists():
    with open(TRACKING_NOTE, 'r', encoding='utf-8') as f:
        content = f.read()
else:
    content = "# Personal Documents Processing Log\n\nAutomatic tracking of inbox → Google Drive processing.\n\n"

# Add new entry
entry = f"\n## {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
for item in processed:
    entry += f"- **{item['doc_type']}**: `{item['original']}`\n"
    entry += f"  - Filed to: `{item['folder']}/{item['new_name']}`\n"

content += entry

with open(TRACKING_NOTE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"  Updated: {TRACKING_NOTE.relative_to(VAULT_ROOT)}")

print("\n" + "="*80)
print("PROCESSING COMPLETE")
print("="*80)
print(f"✓ Filed {len(processed)} document(s) to Google Drive")
print(f"✓ Tracking note updated")
print("\nDocuments organized in:")
print(f"  {GDRIVE_ROOT}")
