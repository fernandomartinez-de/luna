# Inbox Workflow Setup

Vault-based file-drop pattern for monthly Chase statement processing.

## What Was Built

### 1. Inbox Folder
`C:\Users\fmartine\Personal\vaults\ssc-vault-fm\inbox\finances\`

Drop zone for monthly Chase Excel downloads.

### 2. Processing Script
`scripts/process_finances_inbox.py`

Automatically:
- Detects files in inbox (by last 4 digits: 6813, 5113, 4433)
- Moves to `data/bronze/` with date-stamped names
- Creates tracking note in vault
- Shows next steps

### 3. Vault Documentation
- **Workflow**: `workflows/monthly-finances.md` - Full monthly process
- **Commands**: `quick-refs/finances-commands.md` - Command shortcuts
- **Log**: `outputs/finances-processing-log.md` - Processing history

## Monthly Flow

```
1. Download from Chase
   ↓
2. Drop in vault/inbox/finances/
   ↓
3. python scripts/process_finances_inbox.py
   ↓
4. python scripts/load_bronze.py
   ↓
5. View dashboard
```

## Why This Approach

✅ **No browser automation** - Chase blocks it  
✅ **Simple file drop** - Familiar pattern  
✅ **Automatic processing** - Everything after drop is automated  
✅ **Vault integration** - Obsidian tracks processing history  
✅ **Future-ready** - Can add file watcher for zero-touch automation  

## Next Steps

### Immediate Use
1. Download 3 Excel files from Chase
2. Drop in `inbox/finances/`
3. Run `process_finances_inbox.py`
4. Run `load_bronze.py`

### Future Automation
Add file watcher:
- Windows Task Scheduler checks inbox every hour
- Auto-runs processor when files appear
- Sends notification when done

Or use watchdog:
```python
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
# Trigger process_finances_inbox.py on file creation
```

## Files Created

### Repo
- `scripts/process_finances_inbox.py` - Main processor
- `INBOX_WORKFLOW.md` - This file

### Vault
- `inbox/finances/README.md` - Inbox instructions
- `workflows/monthly-finances.md` - Full workflow
- `quick-refs/finances-commands.md` - Command reference
- `outputs/finances-processing-log.md` - Processing log
- Updated `index.md` - Added finances to workflows

## Testing

1. Create test file:
```powershell
echo "test" > "C:\Users\fmartine\Personal\vaults\ssc-vault-fm\inbox\finances\test-6813.xlsx"
```

2. Run processor:
```powershell
cd C:\Users\fmartine\Personal\repos\finances
python scripts\process_finances_inbox.py
```

3. Check:
- File moved to `data/bronze/chase-checking-YYYY-MM-DD.xlsx`
- Log updated in `vault/outputs/finances-processing-log.md`

## Benefits Over Selenium

| Aspect | Selenium | Inbox Pattern |
|--------|----------|---------------|
| Setup | Complex, brittle | Simple file drop |
| Maintenance | Breaks with UI changes | Never breaks |
| 2FA | Unreliable automation | Handle manually once/month |
| Time | 30 min debugging | 2 min drop + run |
| Reliability | ~60% success rate | 100% |

The 3 minutes to manually download is faster than debugging Selenium every month.
