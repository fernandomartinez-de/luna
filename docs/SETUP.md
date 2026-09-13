# Personal Documents Automation - Setup

Automated filing and expiration tracking for personal documents.

## What This Does

1. **Auto-file documents** - Drop any PDF in inbox → auto-detects type → renames → files to Google Drive
2. **Track expirations** - Scans passports, visas, licenses, insurance for expiration dates
3. **Alert on renewals** - Shows what's expiring within 90 days

## Prerequisites

- Python 3.10+
- Google Drive mounted at `G:\My Drive\`
- Obsidian vault at `C:\Users\fmartine\Personal\vaults\ssc-vault-fm\`

## Installation

```powershell
cd C:\Users\fmartine\Personal\repos\personal-docs
pip install -r requirements.txt
```

## Usage

### Process Documents from Inbox

```powershell
python process_personal_inbox.py
```

**Workflow:**
1. Download document (W2, passport scan, medical lab, etc.)
2. Save to: `C:\Users\fmartine\Personal\vaults\ssc-vault-fm\inbox\personal-docs\`
3. Run script
4. Document auto-filed to Google Drive with standard naming

### Scan for Expirations

```powershell
python scan_expirations.py
```

**Output:**
- CSV tracker: `vault/outputs/expiration-tracker.csv`
- Markdown report: `vault/outputs/expiration-report.md`

Run monthly or after adding new documents.

## Standard Naming Format

`YYYY-MM-DD_category_source_description.ext`

**Examples:**
- `2025-01-31_w2_prestige.pdf`
- `2026-04-15_passport_spain.pdf`
- `2026-04-17_labs_quest.pdf`
- `2025-01-01_home_liberty-mutual.pdf`

## Supported Document Types

| Type | Auto-detects | Files to Folder |
|------|--------------|-----------------|
| W2 | "w2", "wage", "tax statement" | `Tax/W2/` |
| Tax Return | "1040", "tax return", "turbotax" | `Tax/` |
| 1098 | "1098", "mortgage interest" | `Tax/` |
| 1099 | "1099" | `Tax/` |
| Passport | "passport", "pasaporte" | `ID/[Country]/` |
| Driver's License | "driver", "license", "dmv" | `ID/Drivers Liscence/` |
| Visa | "visa", "tn", "i-94" | `ID/Visa/` |
| SSN | "social security", "ssn" | `ID/SSN/` |
| Offer Letter | "offer letter" | `Employment/[Company]/` |
| Benefits | "benefits", "health plan" | `Employment/[Company]/` |
| Medical Labs | "lab", "quest", "labcorp" | `Medical/YYYY/labs/` |
| Medical Radiology | "radiology", "x-ray", "pet" | `Medical/YYYY/radiologia/` |
| Medical Ultrasound | "ultrasound", "sonography" | `Medical/YYYY/ultrasonidos/` |
| Home Insurance | "homeowner", "property insurance" | `Insurance/` |
| Property Contract | "purchase agreement" | `Property/` |
| Mortgage | "mortgage", "loan commitment" | `Property/` |
| Degree | "degree", "diploma" | `Education/` |
| Transcript | "transcript" | `Education/` |

## How Detection Works

1. **Filename keywords** - Checks filename for type-specific keywords
2. **PDF content** - Reads first 5 pages and searches for keywords
3. **Date extraction** - Finds dates in YYYY-MM-DD, MM/DD/YYYY, or YYYY format
4. **Source detection** - Identifies issuer (SS&C, Prestige, Quest, Chase, etc.)

## Folder Structure

```
G:\My Drive\Personal\
├── Tax\
│   ├── W2\
│   ├── 2023\
│   ├── 2024\
│   └── 2025\
├── ID\
│   ├── Spain\
│   ├── Canada\
│   ├── Mexico\
│   ├── Drivers Liscence\
│   ├── Visa\
│   └── SSN\
├── Employment\
│   ├── SSC\
│   ├── NYDIS\
│   └── Kyriba\
├── Medical\
│   ├── 2024\
│   │   ├── labs\
│   │   ├── radiologia\
│   │   └── ultrasonidos\
│   ├── 2025\
│   └── 2026\
├── Property\
│   └── 66-s-6th\
├── Education\
└── Insurance\
```

## Troubleshooting

**"Could not detect document type"**
- Add keyword to filename before dropping in inbox
- Example: rename `scan.pdf` to `passport-scan.pdf`

**Expiration date not found**
- PDF may be scanned image without text layer (run OCR first)
- Date format not recognized (manually add to tracker)

**File already exists**
- Script auto-appends `-2`, `-3` to avoid overwriting

## Vault Integration

**Inbox:** `vault/inbox/personal-docs/`
**Tracking log:** `vault/outputs/personal-docs-processing-log.md`
**Expiration report:** `vault/outputs/expiration-report.md`
**Expiration CSV:** `vault/outputs/expiration-tracker.csv`

Link these in your Obsidian daily note or dashboard for quick access.

## Automation (Optional)

**Monthly expiration scan:**
```powershell
# Windows Task Scheduler
schtasks /create /tn "Scan Document Expirations" /tr "python C:\Users\fmartine\Personal\repos\personal-docs\scan_expirations.py" /sc monthly /d 1 /st 09:00
```

**Auto-process on download:**
- Set up folder watcher on inbox
- Trigger script when new file added
- (Advanced - requires additional tools)

## Next Steps

1. Run first scan: `python scan_expirations.py`
2. Review expiration report in vault
3. Drop a test document in inbox and run processor
4. Set up monthly expiration scan reminder
