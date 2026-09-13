# Google Drive Structure

Files are backed up to Google Drive and processed locally.

## Your Google Drive Layout

```
G:\My Drive\Finances\
├── Chase\          ← Excel files (3 accounts)
├── Verizon\        ← Verizon PDF bills
└── ConEd\          ← Con Ed PDF bills
```

## How Processing Works

### Chase Excel Files (Monthly)

1. Drop in: `vault/inbox/finances/`
2. Script copies to:
   - `G:\My Drive\Finances\Chase\` (permanent backup)
   - `data/bronze/` (for processing)
3. `load_bronze.py` reads from bronze → loads to Supabase
4. Dashboard shows updated data

**Both locations serve a purpose:**
- Google Drive = permanent cloud backup
- Bronze = local processing folder

### Bills PDFs (Monthly)

1. Drop in: `vault/inbox/bills/`
2. Script moves to:
   - `G:\My Drive\Finances\Verizon\` (Verizon bills)
   - `G:\My Drive\Finances\ConEd\` (Con Ed bills)
3. Bills organized by date: `YYYY-MM-provider.pdf`

## File Naming

### Chase (Excel)
`chase-{account}-YYYY-MM-DD.xlsx`

Examples:
- `chase-checking-2026-09-13.xlsx`
- `chase-cc_5113-2026-09-13.xlsx`
- `chase-cc_4433-2026-09-13.xlsx`

### Bills (PDF)
`YYYY-MM-{provider}.pdf`

Examples:
- `2026-09-verizon.pdf`
- `2026-09-coned.pdf`

## Why This Structure

✅ **Google Drive**: Permanent cloud backup, accessible everywhere  
✅ **Bronze folder**: Fast local processing for Supabase loads  
✅ **Organized**: All files in one `Finances` folder  
✅ **Searchable**: Standard naming makes finding files easy  

## Folder Purposes

| Folder | Purpose | Used By |
|--------|---------|---------|
| `Chase` | Excel backups + transaction history | You (manual review) |
| `Verizon` | Bill payment history | You (tax records) |
| `ConEd` | Utility payment history | You (tax records) |
| `data/bronze` | Processing cache | Scripts only |

## Medallion Architecture

```
Google Drive (backup)
     ↓ copy
Bronze (raw files)
     ↓ categorize
Silver (Supabase - cleaned data)
     ↓ aggregate
Gold (Dashboard - visualizations)
```

Bronze folder is disposable - if deleted, files can be re-copied from Google Drive.

## Storage Locations

| Data | Google Drive | Local |
|------|--------------|-------|
| Raw Excel | `G:\Finances\Chase\` | `data/bronze\` |
| Raw PDFs | `G:\Finances\Verizon|ConEd\` | - |
| Categorized | - | Supabase |
| Dashboard | - | `finances.html` |

## Accessing Files

**From File Explorer:**
- Google Drive files: `G:\My Drive\Finances\`
- Bronze files: `C:\Users\fmartine\Personal\repos\finances\data\bronze\`

**From Scripts:**
- `process_finances_inbox.py` copies to both
- `process_bills_inbox.py` moves to Google Drive only
- `load_bronze.py` reads from local bronze only
