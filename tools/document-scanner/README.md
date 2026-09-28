# Personal Documents Automation

Automated filing and expiration tracking for 244+ personal documents.

## What This Does

1. **Auto-file documents** - Drop any PDF/image in inbox → auto-detects type → renames to standard format → files to Google Drive
2. **Track expirations** - Scans passports, visas, licenses, insurance policies for expiration dates
3. **Alert on renewals** - Shows what's expiring within 90 days with urgency levels

## Quick Start

### Install

```powershell
pip install -r requirements.txt
```

### Process New Documents

1. Download document (W2, passport, medical lab, etc.)
2. Save to: `C:\Users\fmartine\Personal\vaults\ssc-vault-fm\inbox\personal-docs\`
3. Double-click `PROCESS_INBOX.bat`
4. Done - document filed to Google Drive

### Check Expirations

1. Double-click `SCAN_EXPIRATIONS.bat`
2. Review `vault/outputs/expiration-report.md`

## Standard Naming

All files renamed to: `YYYY-MM-DD_category_source_description.ext`

**Before processing:**
- `Fernando_Passport_Spain.pdf`
- `2025-W2(Prestige).pdf`
- `Lab Results Quest.pdf`

**After processing:**
- `2026-04-15_passport_spain.pdf`
- `2025-01-31_w2_prestige.pdf`
- `2026-04-17_labs_quest.pdf`

## Supported Document Types

| Type | Auto-detects | Files To |
|------|--------------|----------|
| W2, 1099, 1098 | Tax keywords | `G:\Personal\Tax\` |
| Passports | Passport keywords | `G:\Personal\ID\[Country]\` |
| Visas, I-94 | Visa keywords | `G:\Personal\ID\Visa\` |
| Driver's License | DMV keywords | `G:\Personal\ID\Drivers Liscence\` |
| Medical Labs | Lab, Quest, LabCorp | `G:\Personal\Medical\YYYY\labs\` |
| Medical Imaging | Radiology, PET, CT | `G:\Personal\Medical\YYYY\radiologia\` |
| Ultrasounds | Ultrasound | `G:\Personal\Medical\YYYY\ultrasonidos\` |
| Offer Letters | Employment offer | `G:\Personal\Employment\` |
| Insurance | Policy, coverage | `G:\Personal\Insurance\` |
| Property Docs | Contract, mortgage | `G:\Personal\Property\` |
| Degrees | Diploma, degree | `G:\Personal\Education\` |

Full list: [SETUP.md](SETUP.md)

## How Detection Works

1. **Filename keywords** - Checks filename for type indicators
2. **PDF content** - Reads first 5 pages for keywords
3. **Date extraction** - Finds dates in multiple formats
4. **Source detection** - Identifies issuer (SS&C, Quest, Chase, etc.)

## Expiration Tracking

**Scanned document types:**
- Passports (Spain, Canada, Mexico)
- Visas and work permits
- Driver's licenses
- Insurance policies

**Alert levels:**
- 🔴 **< 30 days** - Urgent renewal
- 🟡 **30-90 days** - Plan renewal
- ✓ **> 90 days** - All good

**Output:**
- CSV: `vault/outputs/expiration-tracker.csv`
- Report: `vault/outputs/expiration-report.md`

## File Structure

```
personal-docs/
├── process_personal_inbox.py    # Main processor
├── scan_expirations.py           # Expiration scanner
├── PROCESS_INBOX.bat             # Easy launcher
├── SCAN_EXPIRATIONS.bat          # Easy launcher
├── requirements.txt              # Dependencies
├── SETUP.md                      # Full documentation
└── README.md                     # This file

vault/
├── inbox/personal-docs/          # Drop zone
├── outputs/
│   ├── personal-docs-processing-log.md
│   ├── expiration-tracker.csv
│   └── expiration-report.md
├── workflows/personal-docs.md    # Workflow guide
└── quick-refs/personal-docs-commands.md

G:\My Drive\Personal/             # Google Drive destination
├── Tax/
├── ID/
├── Employment/
├── Medical/
├── Property/
├── Education/
└── Insurance/
```

## Monthly Workflow

1. **Receive document** (W2, lab result, insurance renewal, etc.)
2. **Download** to computer
3. **Drop** in `vault/inbox/personal-docs/`
4. **Run** `PROCESS_INBOX.bat`
5. **Monthly**: Run `SCAN_EXPIRATIONS.bat` to check renewals

## Vault Integration

**Obsidian links:**
- `[[inbox/personal-docs]]` - Drop zone
- `[[personal-docs-processing-log]]` - File history
- `[[expiration-report]]` - Renewal alerts
- `[[workflows/personal-docs]]` - Full workflow
- `[[quick-refs/personal-docs-commands]]` - Command reference

## Troubleshooting

**"Could not detect document type"**
- Add keyword to filename (e.g., `my-doc.pdf` → `my-passport.pdf`)
- Script will detect and file correctly

**Expiration date not found**
- PDF may be scanned image without text
- Add manually to CSV tracker

**Duplicate filename**
- Script auto-appends `-2`, `-3` to avoid overwriting

## Advanced

**Monthly automation (Windows Task Scheduler):**
```powershell
schtasks /create /tn "Scan Document Expirations" /tr "python C:\Users\fmartine\Personal\repos\personal-docs\scan_expirations.py" /sc monthly /d 1 /st 09:00
```

## ROI

**Time saved:**
- Filing: 5 min/doc → 30 sec (90% reduction)
- Finding docs: 2 min → 10 sec with standard naming
- Tracking renewals: Manual calendar → automated alerts

**Value:**
- Never miss passport/visa renewal
- Always know where documents are
- Standard naming = instant searchability

## Pattern Origin

Based on the finances automation workflow:
- Inbox → Processing → Archive
- Auto-detection by keywords
- Standard naming convention
- Vault tracking
- Google Drive as source of truth

## Related Repos

- `finances` - Expense tracking and categorization
- Similar inbox → process → archive pattern
- Reusable workflow for any document type
