-- Finances Supabase Schema

-- Main transactions table
CREATE TABLE IF NOT EXISTS expense_transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL,
  post_date DATE,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT,
  source TEXT NOT NULL,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_transaction UNIQUE(transaction_date, description, amount, source)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_expense_month ON expense_transactions(month);
CREATE INDEX IF NOT EXISTS idx_expense_category ON expense_transactions(category);
CREATE INDEX IF NOT EXISTS idx_expense_date ON expense_transactions(transaction_date DESC);

-- Monthly summary table
CREATE TABLE IF NOT EXISTS expense_monthly_summary (
  id BIGSERIAL PRIMARY KEY,
  month TEXT NOT NULL,
  category TEXT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  transaction_count INT NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_month_category UNIQUE(month, category)
);

-- Index for summary queries
CREATE INDEX IF NOT EXISTS idx_summary_month ON expense_monthly_summary(month);

-- Function to refresh monthly summary
CREATE OR REPLACE FUNCTION refresh_monthly_summary()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE expense_monthly_summary;
  
  INSERT INTO expense_monthly_summary (month, category, total, transaction_count, last_updated)
  SELECT 
    month,
    category,
    SUM(amount) as total,
    COUNT(*) as transaction_count,
    NOW() as last_updated
  FROM expense_transactions
  WHERE category IS NOT NULL
  GROUP BY month, category;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_monthly_summary ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all data
CREATE POLICY "Allow authenticated read access" ON expense_transactions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read access" ON expense_monthly_summary
  FOR SELECT TO authenticated
  USING (true);

-- Policy: Allow service role to insert/update/delete
CREATE POLICY "Allow service role full access" ON expense_transactions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access" ON expense_monthly_summary
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
