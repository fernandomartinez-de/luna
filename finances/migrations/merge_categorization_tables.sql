-- ============================================================================
-- MIGRATION: Merge categorization_rules → category_mapping
-- Date: 2026-09-17
-- Purpose: Consolidate duplicate categorization tables into one
-- ============================================================================

-- Step 1: Backup existing data (just in case)
-- You can export before running this:
-- SELECT * FROM categorization_rules;
-- SELECT * FROM category_mapping;

-- Step 2: Insert missing patterns from categorization_rules into category_mapping
-- Only insert patterns that DON'T exist in category_mapping
INSERT INTO category_mapping (pattern, category, pattern_type, priority, notes)
SELECT
    cr.pattern,
    cr.category,
    cr.rule_type as pattern_type,
    cr.priority,
    COALESCE(cr.notes, 'Migrated from categorization_rules') as notes
FROM categorization_rules cr
WHERE NOT EXISTS (
    SELECT 1
    FROM category_mapping cm
    WHERE UPPER(cm.pattern) = UPPER(cr.pattern)
)
AND cr.pattern IS NOT NULL;

-- Step 3: Handle conflicts - Update category_mapping with categorization_rules data
-- For patterns that exist in both, prefer categorization_rules (it was the fallback, so likely more accurate)
UPDATE category_mapping cm
SET
    category = cr.category,
    priority = cr.priority,
    notes = COALESCE(cm.notes, '') || ' [Updated from categorization_rules on 2026-09-17]'
FROM categorization_rules cr
WHERE UPPER(cm.pattern) = UPPER(cr.pattern)
AND cm.category != cr.category;  -- Only update if categories differ

-- Step 4: Drop the old function that uses categorization_rules
DROP FUNCTION IF EXISTS apply_categorization_rules(TEXT) CASCADE;

-- Step 5: Drop the description standardization function (not used)
DROP FUNCTION IF EXISTS standardize_description(TEXT) CASCADE;

-- Step 6: Drop the old tables
DROP TABLE IF EXISTS categorization_rules CASCADE;
DROP TABLE IF EXISTS description_standardization_rules CASCADE;

-- Step 7: Drop expense_monthly_summary if it exists (replaced by views)
DROP TABLE IF EXISTS expense_monthly_summary CASCADE;

-- Step 8: Verify the migration
-- Check row count
SELECT 'category_mapping' as table_name, COUNT(*) as pattern_count FROM category_mapping;

-- Show recently migrated patterns
SELECT pattern, category, priority, notes
FROM category_mapping
WHERE notes LIKE '%categorization_rules%'
ORDER BY priority DESC, category, pattern
LIMIT 20;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test the apply_category_mapping function still works
SELECT apply_category_mapping('AMAZON.COM') as amazon_category;
SELECT apply_category_mapping('GOTHAM') as gotham_category;
SELECT apply_category_mapping('UBER *TRIP') as uber_category;

-- Show all categories
SELECT category, COUNT(*) as pattern_count
FROM category_mapping
GROUP BY category
ORDER BY pattern_count DESC;

-- Migration complete message
DO $$
BEGIN
    RAISE NOTICE 'Migration complete! Merged categorization_rules → category_mapping';
    RAISE NOTICE 'Dropped tables: categorization_rules, description_standardization_rules, expense_monthly_summary';
    RAISE NOTICE 'Dropped functions: apply_categorization_rules(), standardize_description()';
END $$;
