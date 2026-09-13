#!/usr/bin/env python3
"""
Process Chase statements dropped in Obsidian vault inbox

Watches: C:\Users\fmartine\Personal\vaults\ssc-vault-fm\inbox\finances\
Processes: Moves to bronze, categorizes, loads to Supabase, creates tracking note
"""
import os
import shutil
from datetime import datetime
from pathlib import Path

# Paths
VAULT_ROOT = Path(r"C:\Users\fmartine\Personal\vaults\ssc-vault-fm")
INBOX_FOLDER = VAULT_ROOT / "inbox" / "finances"
REPO_ROOT = Path(__file__).parent.parent
BRONZE_FOLDER = REPO_ROOT / "data" / "bronze"
GDRIVE_CHASE = Path(r"G:\My Drive\Finances\Chase")
TRACKING_NOTE = VAULT_ROOT / "outputs" / "finances-processing-log.md"

print("="*80)
print("FINANCES INBOX PROCESSOR")
print("="*80)
print(f"Watching: {INBOX_FOLDER}")
print(f"Bronze: {BRONZE_FOLDER}")
print("="*80)

# Check for files
files = list(INBOX_FOLDER.glob("*.xlsx")) + list(INBOX_FOLDER.glob("*.csv"))
files = [f for f in files if f.name != "README.md"]

if not files:
    print("\n✓ Inbox is empty - no files to process")
    exit(0)

print(f"\nFound {len(files)} file(s) in inbox:")
for f in files:
    print(f"  - {f.name}")

# Determine which accounts
account_map = {
    "6813": "checking",
    "5113": "cc_5113",
    "4433": "cc_4433"
}

processed = []

for file in files:
    # Detect account by last 4 digits in filename or content
    account_type = None
    for last4, acc_type in account_map.items():
        if last4 in file.name:
            account_type = acc_type
            break

    if not account_type:
        print(f"\n⚠️  Could not detect account type for: {file.name}")
        print("   Skipping...")
        continue

    # Generate target filename with date
    today = datetime.now().strftime("%Y-%m-%d")
    ext = file.suffix
    target_name = f"chase-{account_type}-{today}{ext}"

    # Copy to BOTH locations
    bronze_path = BRONZE_FOLDER / target_name
    gdrive_path = GDRIVE_CHASE / target_name

    print(f"\n✓ Processing {file.name}...")
    print(f"  Account: {account_type}")
    print(f"  Copying to bronze: {target_name}")
    print(f"  Backing up to Google Drive: {target_name}")

    # Ensure folders exist
    BRONZE_FOLDER.mkdir(parents=True, exist_ok=True)
    GDRIVE_CHASE.mkdir(parents=True, exist_ok=True)

    # Copy to bronze (for processing)
    shutil.copy(str(file), str(bronze_path))

    # Copy to Google Drive (for backup)
    shutil.copy(str(file), str(gdrive_path))

    # Remove from inbox
    file.unlink()

    processed.append({
        "original": file.name,
        "account": account_type,
        "bronze_file": target_name,
        "gdrive_file": target_name,
        "timestamp": datetime.now()
    })

# Create tracking note
print(f"\n✓ Creating tracking note...")

if TRACKING_NOTE.exists():
    # Append to existing
    with open(TRACKING_NOTE, 'r') as f:
        content = f.read()
else:
    # Create new
    content = "# Finances Processing Log\n\nAutomatic tracking of inbox → bronze processing.\n\n"

# Add new entry
entry = f"\n## {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
for item in processed:
    entry += f"- **{item['account']}**: `{item['original']}`\n"
    entry += f"  - Bronze (processing): `data/bronze/{item['bronze_file']}`\n"
    entry += f"  - Google Drive (backup): `G:/Finances/Chase/{item['gdrive_file']}`\n"

entry += f"\n**Next steps:**\n"
entry += f"Files ready in bronze - run load_bronze.py to process to database.\n"

content += entry

with open(TRACKING_NOTE, 'w') as f:
    f.write(content)

print(f"  Created: {TRACKING_NOTE.relative_to(VAULT_ROOT)}")

print("\n" + "="*80)
print("PROCESSING COMPLETE")
print("="*80)
print(f"✓ Copied {len(processed)} file(s) to:")
print(f"  - Bronze (processing): {BRONZE_FOLDER}")
print(f"  - Google Drive (backup): {GDRIVE_CHASE}")
print(f"✓ Tracking note updated")
print("\nNext steps:")
print("  1. Run: python scripts/load_bronze.py")
print("  2. Double-click: START.bat")
print("\nFiles are now:")
print("  - Backed up in Google Drive")
print("  - Ready for processing in bronze folder")
