# Finance Database Migrations

## Available Migrations

### 1. Add Data Source Column (2026-09-17)
**File:** `add_data_source_column.sql`  
**Status:** ✅ Complete  
**Purpose:** Add `data_source` column to `real_estate_history` to track Zillow vs Redfin estimates

---

### 2. Merge Categorization Tables (2026-09-17)
**File:** `merge_categorization_tables.sql`  
**Status:** ⏳ Ready to run  
**Purpose:** Consolidate duplicate categorization tables

**📖 READ FIRST:** `MIGRATION_GUIDE.md`

**Quick Steps:**
1. Open Supabase SQL Editor
2. Run `merge_categorization_tables.sql`
3. Verify with test queries
4. Test `load_bronze.py` script

**What it does:**
- Merges `categorization_rules` → `category_mapping`
- Drops 3 unused tables
- Updates code references
- Simplifies expense categorization logic

**Tables affected:**
- ❌ DROP: `categorization_rules`
- ❌ DROP: `description_standardization_rules`
- ❌ DROP: `expense_monthly_summary`
- ✅ KEEP: `category_mapping` (with merged data)

---

## Migration History

| Date | Migration | Status | Files Changed |
|------|-----------|--------|---------------|
| 2026-09-17 | Add data_source column | ✅ Complete | `real_estate_history`, fetch scripts |
| 2026-09-17 | Merge categorization tables | ⏳ Pending | `category_mapping`, `load_bronze.py` |

---

## How to Run a Migration

1. **Backup first** (optional but recommended):
   - Export affected tables from Supabase
   
2. **Read the migration guide**:
   - Check `MIGRATION_GUIDE.md` for detailed steps
   
3. **Run in Supabase SQL Editor**:
   - Copy migration SQL file contents
   - Paste in SQL Editor
   - Click "Run"
   
4. **Verify**:
   - Run verification queries
   - Test affected scripts
   
5. **Commit code changes**:
   - Commit any updated Python scripts
   - Commit migration files

---

## Rollback

All migrations in Supabase can be rolled back via:
- **Dashboard → Database → Backups** → Restore to timestamp before migration

---

## Questions?

See vault documentation:
- `vault\workflows\finances\supabase-tables.md`
