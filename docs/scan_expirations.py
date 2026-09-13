#!/usr/bin/env python3
"""
Scan personal documents for expiration dates

Creates expiration tracker with alerts for documents expiring soon
"""
import os
import re
import csv
from datetime import datetime, timedelta
from pathlib import Path
from PyPDF2 import PdfReader

# Paths
GDRIVE_ROOT = Path(r"G:\My Drive\Personal")
VAULT_ROOT = Path(r"C:\Users\fmartine\Personal\vaults\ssc-vault-fm")
TRACKER_FILE = VAULT_ROOT / "outputs" / "expiration-tracker.csv"
REPORT_FILE = VAULT_ROOT / "outputs" / "expiration-report.md"

# Document types that typically have expiration dates
EXPIRING_DOC_TYPES = {
    "passport": r"(expir|valid|venc).*?(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})",
    "visa": r"(expir|valid|until).*?(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})",
    "drivers-license": r"(expir|valid|exp).*?(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})",
    "insurance": r"(expir|valid|effective.*through).*?(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})"
}

print("="*80)
print("EXPIRATION DATE SCANNER")
print("="*80)
print(f"Scanning: {GDRIVE_ROOT}")
print("="*80)

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF"""
    try:
        reader = PdfReader(str(pdf_path))
        text = ""
        for page in reader.pages[:10]:  # First 10 pages
            text += page.extract_text()
        return text
    except Exception as e:
        print(f"  ⚠️  Error reading {pdf_path.name}: {e}")
        return ""

def parse_date(date_str):
    """Parse various date formats to standard YYYY-MM-DD"""
    # Remove extra spaces
    date_str = re.sub(r'\s+', ' ', date_str).strip()

    formats = [
        "%m/%d/%Y", "%m-%d-%Y",
        "%d/%m/%Y", "%d-%m-%Y",
        "%m/%d/%y", "%m-%d-%y",
        "%d/%m/%y", "%d-%m-%y",
        "%Y-%m-%d", "%Y/%m/%d",
        "%B %d, %Y", "%b %d, %Y",
        "%d %B %Y", "%d %b %Y"
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except:
            continue

    return None

def extract_expiration_date(file_path, doc_type):
    """Extract expiration date from document"""
    text = extract_text_from_pdf(file_path)
    if not text:
        return None

    # Get pattern for this doc type
    pattern = EXPIRING_DOC_TYPES.get(doc_type)
    if not pattern:
        return None

    # Search for expiration date
    matches = re.findall(pattern, text, re.IGNORECASE)
    if not matches:
        return None

    # Try to parse first match
    for match in matches[:5]:  # Check first 5 matches
        if isinstance(match, tuple):
            date_str = match[-1]
        else:
            date_str = match

        parsed_date = parse_date(date_str)
        if parsed_date:
            # Only return future dates
            if datetime.strptime(parsed_date, "%Y-%m-%d") > datetime.now():
                return parsed_date

    return None

def scan_folder(folder_path, doc_type):
    """Scan folder for expiring documents"""
    results = []

    if not folder_path.exists():
        return results

    for file in folder_path.glob("**/*.pdf"):
        expiration_date = extract_expiration_date(file, doc_type)
        if expiration_date:
            relative_path = file.relative_to(GDRIVE_ROOT)
            results.append({
                "filename": file.name,
                "path": str(relative_path),
                "type": doc_type,
                "expiration_date": expiration_date,
                "days_until": (datetime.strptime(expiration_date, "%Y-%m-%d") - datetime.now()).days
            })
            print(f"  ✓ Found: {file.name} expires {expiration_date}")

    return results

# Scan each document type
all_expirations = []

print("\nScanning passports...")
all_expirations.extend(scan_folder(GDRIVE_ROOT / "ID" / "Spain", "passport"))
all_expirations.extend(scan_folder(GDRIVE_ROOT / "ID" / "Canada", "passport"))
all_expirations.extend(scan_folder(GDRIVE_ROOT / "ID" / "Mexico", "passport"))

print("\nScanning visas...")
all_expirations.extend(scan_folder(GDRIVE_ROOT / "ID" / "Canada", "visa"))
all_expirations.extend(scan_folder(GDRIVE_ROOT / "ID" / "Visa", "visa"))
all_expirations.extend(scan_folder(GDRIVE_ROOT / "Employment", "visa"))

print("\nScanning driver's licenses...")
all_expirations.extend(scan_folder(GDRIVE_ROOT / "ID" / "Drivers Liscence", "drivers-license"))

print("\nScanning insurance...")
all_expirations.extend(scan_folder(GDRIVE_ROOT / "Insurance", "insurance"))

# Sort by days until expiration
all_expirations.sort(key=lambda x: x["days_until"])

# Write CSV
print(f"\n✓ Writing tracker to: {TRACKER_FILE}")
TRACKER_FILE.parent.mkdir(parents=True, exist_ok=True)

with open(TRACKER_FILE, 'w', newline='', encoding='utf-8') as f:
    if all_expirations:
        writer = csv.DictWriter(f, fieldnames=all_expirations[0].keys())
        writer.writeheader()
        writer.writerows(all_expirations)

# Generate report
print(f"✓ Writing report to: {REPORT_FILE}")

report = f"""# Expiration Tracker Report

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}

Total documents tracked: {len(all_expirations)}

## ⚠️ Expiring Soon (< 90 days)

"""

soon = [doc for doc in all_expirations if doc["days_until"] < 90]
if soon:
    for doc in soon:
        urgency = "🔴" if doc["days_until"] < 30 else "🟡"
        report += f"{urgency} **{doc['filename']}** expires in {doc['days_until']} days ({doc['expiration_date']})\n"
        report += f"   - Type: {doc['type']}\n"
        report += f"   - Path: `{doc['path']}`\n\n"
else:
    report += "✓ No documents expiring in the next 90 days\n\n"

report += "## All Tracked Documents\n\n"
report += "| Document | Type | Expiration | Days Until |\n"
report += "|----------|------|------------|------------|\n"

for doc in all_expirations:
    status = "🔴" if doc["days_until"] < 30 else "🟡" if doc["days_until"] < 90 else "✓"
    report += f"| {status} {doc['filename']} | {doc['type']} | {doc['expiration_date']} | {doc['days_until']} |\n"

report += f"\n---\n\n"
report += f"**Next scan:** Run `python {Path(__file__).name}` monthly or when adding new documents\n"
report += f"**CSV tracker:** [[expiration-tracker]]\n"

with open(REPORT_FILE, 'w', encoding='utf-8') as f:
    f.write(report)

print("\n" + "="*80)
print("SCAN COMPLETE")
print("="*80)
print(f"✓ Found {len(all_expirations)} documents with expiration dates")
print(f"✓ {len(soon)} expiring within 90 days")
print(f"\nView report: {REPORT_FILE.relative_to(VAULT_ROOT)}")
