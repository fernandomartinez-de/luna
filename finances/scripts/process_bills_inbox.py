#!/usr/bin/env python3
"""
Process bill PDFs dropped in Obsidian vault inbox

Watches: C:\Users\fmartine\Personal\vaults\ssc-vault-fm\inbox\bills\
Sorts to: G:\My Drive\Personal\Bills\[Verizon|Con Ed]\
"""
import os
import re
import shutil
from datetime import datetime
from pathlib import Path

# Paths
VAULT_ROOT = Path(r"C:\Users\fmartine\Personal\vaults\ssc-vault-fm")
INBOX_FOLDER = VAULT_ROOT / "inbox" / "bills"
GDRIVE_ROOT = Path(r"G:\My Drive\Finances")
VERIZON_FOLDER = GDRIVE_ROOT / "Verizon"
CONED_FOLDER = GDRIVE_ROOT / "ConEd"
TRACKING_NOTE = VAULT_ROOT / "outputs" / "bills-processing-log.md"

# Detection patterns
VERIZON_PATTERNS = [
    r'verizon',
    r'vzw',
    r'wireless',
    r'my\s*verizon'
]

CONED_PATTERNS = [
    r'con\s*ed',
    r'coned',
    r'edison',
    r'consolidated\s*edison'
]

print("="*80)
print("BILLS INBOX PROCESSOR")
print("="*80)
print(f"Watching: {INBOX_FOLDER}")
print(f"Verizon → {VERIZON_FOLDER}")
print(f"Con Ed  → {CONED_FOLDER}")
print("="*80)

# Check for files
pdf_files = list(INBOX_FOLDER.glob("*.pdf")) + list(INBOX_FOLDER.glob("*.PDF"))
pdf_files = [f for f in pdf_files if f.name != "README.md"]

if not pdf_files:
    print("\n✓ Inbox is empty - no bills to process")
    exit(0)

print(f"\nFound {len(pdf_files)} PDF(s) in inbox:")
for f in pdf_files:
    print(f"  - {f.name}")

processed = []

for pdf_file in pdf_files:
    filename_lower = pdf_file.name.lower()

    # Detect provider
    provider = None

    # Check filename first
    for pattern in VERIZON_PATTERNS:
        if re.search(pattern, filename_lower):
            provider = "Verizon"
            break

    if not provider:
        for pattern in CONED_PATTERNS:
            if re.search(pattern, filename_lower):
                provider = "Con Ed"
                break

    if not provider:
        print(f"\n⚠️  Could not detect provider for: {pdf_file.name}")
        print("   Skipping... (Add 'verizon' or 'coned' to filename)")
        continue

    # Determine target folder
    if provider == "Verizon":
        target_folder = VERIZON_FOLDER
        provider_slug = "verizon"
    else:
        target_folder = CONED_FOLDER
        provider_slug = "coned"

    # Create folder if it doesn't exist
    target_folder.mkdir(parents=True, exist_ok=True)

    # Try to extract date from filename
    date_match = re.search(r'20\d{2}[-_]?\d{2}', pdf_file.name)
    if date_match:
        date_str = date_match.group(0).replace('_', '-')
        if len(date_str) == 6:  # YYYYMM format
            date_str = f"{date_str[:4]}-{date_str[4:]}"
    else:
        # Use current month as fallback
        date_str = datetime.now().strftime("%Y-%m")

    # Generate target filename
    target_name = f"{date_str}-{provider_slug}.pdf"
    target_path = target_folder / target_name

    # Handle duplicates
    counter = 1
    while target_path.exists():
        target_name = f"{date_str}-{provider_slug}-{counter}.pdf"
        target_path = target_folder / target_name
        counter += 1

    # Move file
    print(f"\n✓ Processing {pdf_file.name}...")
    print(f"  Provider: {provider}")
    print(f"  Date: {date_str}")
    print(f"  Filing to: {target_name}")

    shutil.move(str(pdf_file), str(target_path))

    processed.append({
        "original": pdf_file.name,
        "provider": provider,
        "date": date_str,
        "target": str(target_path.relative_to(GDRIVE_ROOT)),
        "timestamp": datetime.now()
    })

# Create tracking note
print(f"\n✓ Creating tracking note...")

if TRACKING_NOTE.exists():
    with open(TRACKING_NOTE, 'r') as f:
        content = f.read()
else:
    content = "# Bills Processing Log\n\nAutomatic tracking of bill filing to Google Drive.\n\n"

# Add new entry
entry = f"\n## {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
for item in processed:
    entry += f"- **{item['provider']}** ({item['date']}): `{item['original']}` → `{item['target']}`\n"

content += entry

with open(TRACKING_NOTE, 'w') as f:
    f.write(content)

print(f"  Updated: {TRACKING_NOTE.relative_to(VAULT_ROOT)}")

print("\n" + "="*80)
print("PROCESSING COMPLETE")
print("="*80)
print(f"✓ Filed {len(processed)} bill(s) to Google Drive")
print(f"✓ Tracking note updated")
print("\nBills are now organized in:")
print(f"  - Verizon: {VERIZON_FOLDER}")
print(f"  - Con Ed:  {CONED_FOLDER}")
