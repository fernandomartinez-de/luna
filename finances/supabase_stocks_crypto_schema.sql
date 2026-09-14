-- Stocks and Crypto Historical Data Table
-- Stores monthly snapshots of stock and cryptocurrency holdings

CREATE TABLE IF NOT EXISTS stocks_crypto_history (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('Stock', 'Crypto')),
    asset_name VARCHAR(50) NOT NULL,
    quantity DECIMAL(18, 8) NOT NULL,
    price_per_unit DECIMAL(12, 2) NOT NULL,
    total_value DECIMAL(12, 2) NOT NULL,
    cost_basis DECIMAL(12, 2) NOT NULL,
    unrealized_gain_loss DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(snapshot_date, asset_name)
);

-- Disable Row Level Security for now (enable later with proper policies)
ALTER TABLE stocks_crypto_history DISABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stocks_crypto_date ON stocks_crypto_history(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_stocks_crypto_asset ON stocks_crypto_history(asset_name);
CREATE INDEX IF NOT EXISTS idx_stocks_crypto_type ON stocks_crypto_history(asset_type);
