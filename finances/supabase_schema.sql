-- Real Estate Tracking Table
-- Stores monthly snapshots of property values, equity, and mortgage

CREATE TABLE IF NOT EXISTS real_estate_history (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    asset_name VARCHAR(100) NOT NULL,
    asset_type VARCHAR(50) NOT NULL DEFAULT 'Real Estate',
    home_value DECIMAL(12, 2) NOT NULL,
    mortgage_balance DECIMAL(12, 2) DEFAULT 0,
    net_equity DECIMAL(12, 2) NOT NULL,
    cost_basis DECIMAL(12, 2) NOT NULL,
    unrealized_gain_loss DECIMAL(12, 2),
    data_source VARCHAR(20) DEFAULT 'Redfin',
    location VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate entries for same asset on same date from same source
    UNIQUE(snapshot_date, asset_name, data_source)
);

-- Index for fast date-based queries
CREATE INDEX idx_real_estate_snapshot_date ON real_estate_history(snapshot_date DESC);
CREATE INDEX idx_real_estate_asset_name ON real_estate_history(asset_name);

-- Comments
COMMENT ON TABLE real_estate_history IS 'Monthly snapshots of real estate property values, equity, and mortgage tracking';
COMMENT ON COLUMN real_estate_history.snapshot_date IS 'First day of month (YYYY-MM-01)';
COMMENT ON COLUMN real_estate_history.home_value IS 'Total property value estimate';
COMMENT ON COLUMN real_estate_history.mortgage_balance IS 'Outstanding mortgage debt';
COMMENT ON COLUMN real_estate_history.net_equity IS 'Home value minus mortgage balance';
COMMENT ON COLUMN real_estate_history.cost_basis IS 'Original purchase price (never changes)';
COMMENT ON COLUMN real_estate_history.unrealized_gain_loss IS 'Current home value minus cost basis';
COMMENT ON COLUMN real_estate_history.data_source IS 'Source of home value estimate (Zillow, Redfin, Manual)';

-- Example query: Get latest values for all properties
-- SELECT asset_name, home_value, net_equity, mortgage_balance
-- FROM real_estate_history
-- WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM real_estate_history)
-- ORDER BY asset_name;

-- Example query: Get 13-month trend for condo
-- SELECT snapshot_date, home_value, net_equity, mortgage_balance
-- FROM real_estate_history
-- WHERE asset_name = 'Condo'
-- ORDER BY snapshot_date DESC
-- LIMIT 13;
