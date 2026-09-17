-- Migration: Add data_source column to real_estate_history table
-- Date: 2026-09-17
-- Purpose: Track whether property values came from Zillow, Redfin, or manual entry

-- Step 1: Add data_source column (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'real_estate_history'
        AND column_name = 'data_source'
    ) THEN
        ALTER TABLE real_estate_history
        ADD COLUMN data_source VARCHAR(20) DEFAULT 'Redfin';

        RAISE NOTICE 'Added data_source column to real_estate_history';
    ELSE
        RAISE NOTICE 'data_source column already exists';
    END IF;
END $$;

-- Step 2: Update existing records to mark as 'Redfin' (since that's what we've been using)
UPDATE real_estate_history
SET data_source = 'Redfin'
WHERE data_source IS NULL;

-- Step 3: Drop old unique constraint
ALTER TABLE real_estate_history
DROP CONSTRAINT IF EXISTS real_estate_history_snapshot_date_asset_name_key;

-- Step 4: Add new unique constraint including data_source
-- This allows same property on same date from different sources
ALTER TABLE real_estate_history
ADD CONSTRAINT real_estate_history_unique_snapshot
UNIQUE (snapshot_date, asset_name, data_source);

-- Step 5: Add comment
COMMENT ON COLUMN real_estate_history.data_source IS 'Source of home value estimate (Zillow, Redfin, Manual)';

-- Verification query
SELECT
    snapshot_date,
    asset_name,
    data_source,
    home_value,
    net_equity
FROM real_estate_history
ORDER BY snapshot_date DESC, data_source
LIMIT 10;
