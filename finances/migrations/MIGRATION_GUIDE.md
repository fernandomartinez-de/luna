# Categorization Tables Merge Migration

**Date:** September 17, 2026  
**Purpose:** Consolidate duplicate categorization tables into one clean structure

---

## What This Migration Does

### Tables Being Merged:
- ✅ **Keeps:** `category_mapping` (standardized, documented in vault)
- ❌ **Drops:** `categorization_rules` (old duplicate)
- ❌ **Drops:** `description_standardization_rules` (unused)
- ❌ **Drops:** `expense_monthly_summary` (replaced by views)

### Functions Being Removed:
- ❌ `apply_categorization_rules()` - replaced by `apply_category_mapping()`
- ❌ `standardize_description()` - not used

### Code Updates:
- ✅ `load_bronze.py` - removed fallback to old function

---

## Migration Steps

### Step 1: Backup Your Data (Optional but Recommended)

```sql
-- In Supabase SQL Editor, export these tables first:
SELECT * FROM categorization_rules;
SELECT * FROM description_standardization_rules;
SELECT * FROM category_mapping;
```

Save the results as CSV (just in case).

---

### Step 2: Run the Migration SQL

**In Supabase SQL Editor:**

1. Open the SQL Editor
2. Paste the contents of `merge_categorization_tables.sql`
3. Click **"Run"**

**What it does:**
1. Copies all unique patterns from `categorization_rules` → `category_mapping`
2. For conflicts (same pattern, different category), uses the `categorization_rules` version
3. Drops old functions and tables
4. Verifies the migration worked

**Expected output:**
```
Migrated X patterns from categorization_rules
Updated Y conflicting patterns
Dropped tables and functions successfully
```

---

### Step 3: Verify Migration

**Check pattern count:**

```sql
SELECT COUNT(*) FROM category_mapping;
```

Should be higher than before (merged data).

**Test categorization:**

```sql
-- Test some key patterns
SELECT apply_category_mapping('AMAZON.COM');  -- Should return 'Shopping'
SELECT apply_category_mapping('GOTHAM');       -- Should return 'Gotham'
SELECT apply_category_mapping('UBER *TRIP');   -- Should return 'Uber Trip' or 'Travel'
SELECT apply_category_mapping('GLF*');         -- Should return 'Golf'
```

All should return valid categories (not NULL).

---

### Step 4: Update Git

The code changes are already made:
- ✅ `load_bronze.py` - updated to remove old function calls
- ✅ `merge_categorization_tables.sql` - migration script created

**Commit the changes:**

```bash
cd C:\Users\fmartine\Personal\repos\personal\finances
git add migrations/merge_categorization_tables.sql
git add scripts/load_bronze.py
git commit -m "Merge categorization tables - consolidate to category_mapping only"
```

---

### Step 5: Test Load Bronze Script

**Process a recent Chase statement:**

```bash
cd C:\Users\fmartine\Personal\repos\personal\finances\scripts
python load_bronze.py
```

**Watch for:**
- ✅ Transactions categorized correctly
- ✅ No errors about missing `apply_categorization_rules()` function
- ✅ Merchants like AMAZON, GOTHAM, GLF* categorized properly (not Miscellaneous)

---

## What Changed

### Before Migration:

```
load_bronze.py categorization flow:
1. Try apply_category_mapping() [category_mapping table]
2. Try Chase's own categories
3. Fall back to apply_categorization_rules() [categorization_rules table]
4. Default to Miscellaneous

Two tables with duplicate/conflicting data
```

### After Migration:

```
load_bronze.py categorization flow:
1. Try apply_category_mapping() [category_mapping table]
2. Try Chase's own categories
3. Default to Miscellaneous

One unified table with all patterns merged
```

---

## Rollback Plan (If Something Breaks)

**If the migration causes issues:**

### Option 1: Restore from Supabase Backups
1. Go to Supabase Dashboard → Database → Backups
2. Restore to before migration timestamp

### Option 2: Re-create Tables from SQL Files
```bash
# Re-run the old schema files
cd C:\Users\fmartine\Personal\repos\personal\finances
# Run rules_schema.sql in Supabase SQL Editor
```

---

## After Migration Checklist

- [ ] Migration SQL ran without errors
- [ ] Pattern count in `category_mapping` increased
- [ ] Test queries return valid categories
- [ ] `load_bronze.py` runs without errors
- [ ] Transactions categorize correctly (no increase in "Miscellaneous")
- [ ] Git changes committed
- [ ] Old tables confirmed dropped in Supabase

---

## Benefits of This Migration

✅ **Single source of truth** - One table for all categorization rules  
✅ **No duplicate maintenance** - Add rules to one place only  
✅ **Cleaner codebase** - Simplified logic in load_bronze.py  
✅ **Better documented** - `category_mapping` is documented in vault  
✅ **Fewer functions** - Removed unused functions  
✅ **Easier to maintain** - Clear data flow

---

## Questions?

See vault documentation:
- `C:\Users\fmartine\Personal\repos\personal\vault\workflows\finances\supabase-tables.md`
- Section: "category_mapping"

The `category_mapping` table is now the **only** table for transaction categorization rules.
