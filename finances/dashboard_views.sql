-- Dashboard Views and Stored Procedures
-- Controls what data appears in the finances dashboard

-- ============================================================================
-- 1. Category Grouping View
-- ============================================================================

CREATE OR REPLACE VIEW vw_category_groups AS
SELECT
    category,
    CASE
        -- Fixed Costs
        WHEN category IN ('Mortgage Payment', 'HOA', 'Electricity', 'Verizon', 'Insurance')
            THEN 'Fixed Costs'

        -- Excluded (Internal Transfers & Reference Data)
        WHEN category IN (
            'ATM', 'Zelle', 'Venmo', 'Credit Card Payment', 'Payment', 'Checks',
            'Fees & Adjustments', 'Payroll', 'WHOOP (Excluded)',
            'Rent (67 Wall street)', 'Utilities (67 Wall street)', 'Spectrum'
        )
            THEN 'Excluded'

        -- Everything else is Discretionary
        ELSE 'Discretionary'
    END as category_group
FROM expense_transactions
GROUP BY category;


-- ============================================================================
-- 2. Dashboard Summary View (Excludes internal transfers & reference data)
-- ============================================================================

CREATE OR REPLACE VIEW vw_dashboard_summary AS
SELECT
    t.month,
    t.category,
    SUM(ABS(t.amount)) as total,
    COUNT(*) as transaction_count,
    MAX(t.created_at) as last_updated
FROM expense_transactions t
LEFT JOIN vw_category_groups g ON t.category = g.category
WHERE g.category_group IN ('Fixed Costs', 'Discretionary')  -- Exclude internal transfers
  AND NOT (t.category = 'Miscellaneous' AND ABS(t.amount) > 100000)  -- Exclude condo purchase
GROUP BY t.month, t.category;


-- ============================================================================
-- 3. Fixed Costs Summary
-- ============================================================================

CREATE OR REPLACE VIEW vw_fixed_costs_summary AS
WITH latest_per_category AS (
    SELECT DISTINCT ON (category)
        category,
        ABS(amount) as latest_amount,
        transaction_date
    FROM expense_transactions
    WHERE category IN ('Mortgage Payment', 'HOA', 'Electricity', 'Verizon', 'Insurance')
      AND description NOT LIKE '%OVERDRAFT%'  -- Exclude overdraft fees
    ORDER BY category, transaction_date DESC
)
SELECT
    category,
    latest_amount as avg_per_month,
    latest_amount as total_all_months,
    1 as months_with_data
FROM latest_per_category;


-- ============================================================================
-- 4. Discretionary Spending Summary
-- ============================================================================

CREATE OR REPLACE VIEW vw_discretionary_summary AS
SELECT
    t.month,
    t.category,
    SUM(ABS(t.amount)) as total,
    COUNT(*) as transaction_count
FROM expense_transactions t
LEFT JOIN vw_category_groups g ON t.category = g.category
WHERE g.category_group = 'Discretionary'
  AND NOT (t.category = 'Miscellaneous' AND ABS(t.amount) > 100000)  -- Exclude condo purchase
GROUP BY t.month, t.category;


-- ============================================================================
-- 5. Net Remaining Calculation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_net_remaining()
RETURNS TABLE(
    avg_payroll DECIMAL(10,2),
    avg_fixed_costs DECIMAL(10,2),
    avg_net_remaining DECIMAL(10,2),
    months_tracked INT
) AS $$
BEGIN
    RETURN QUERY
    WITH last_two_payrolls AS (
        SELECT ABS(amount) as amount
        FROM expense_transactions
        WHERE category = 'Payroll'
        ORDER BY transaction_date DESC
        LIMIT 2
    ),
    payroll_sum AS (
        SELECT
            SUM(amount) as monthly_income,
            2 as months
        FROM last_two_payrolls
    ),
    electricity_12mo_avg AS (
        SELECT COALESCE(AVG(ABS(amount)), 0) as elec_avg
        FROM expense_transactions
        WHERE category = 'Electricity'
          AND transaction_date >= (NOW() - INTERVAL '1 year')::DATE
    ),
    fixed_avg AS (
        SELECT
            SUM(CASE
                WHEN category = 'Electricity' THEN (SELECT elec_avg FROM electricity_12mo_avg)
                ELSE avg_per_month
            END) as avg_fixed
        FROM vw_fixed_costs_summary
    ),
    last_complete_month AS (
        SELECT TO_CHAR((NOW() - INTERVAL '1 month')::DATE, 'YYYY-MM') as month
    ),
    mta_amount AS (
        SELECT COALESCE(SUM(ABS(amount)), 0) as mta_total
        FROM expense_transactions, last_complete_month
        WHERE category = 'MTA'
          AND expense_transactions.month = last_complete_month.month
    ),
    subscriptions_amount AS (
        SELECT COALESCE(SUM(ABS(amount)), 0) as subs_total
        FROM expense_transactions, last_complete_month
        WHERE category = 'Subscriptions'
          AND expense_transactions.month = last_complete_month.month
    ),
    total_expenses AS (
        SELECT
            f.avg_fixed + m.mta_total + s.subs_total as total_exp
        FROM fixed_avg f, mta_amount m, subscriptions_amount s
    )
    SELECT
        p.monthly_income::DECIMAL(10,2),
        e.total_exp::DECIMAL(10,2),
        (p.monthly_income - e.total_exp)::DECIMAL(10,2) as net,
        p.months::INT
    FROM payroll_sum p, total_expenses e;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 6. Dashboard Stats Function (for summary cards)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(
    net_remaining DECIMAL(10,2),
    discretionary_avg DECIMAL(10,2),
    months_tracked INT
) AS $$
BEGIN
    RETURN QUERY
    WITH net_calc AS (
        SELECT * FROM get_net_remaining()
    ),
    disc_avg AS (
        SELECT
            SUM(total) / COUNT(DISTINCT month) as avg_disc
        FROM vw_discretionary_summary
    ),
    total_months AS (
        SELECT COUNT(DISTINCT month) as months
        FROM expense_transactions
    )
    SELECT
        n.avg_net_remaining,
        d.avg_disc::DECIMAL(10,2),
        m.months::INT
    FROM net_calc n, disc_avg d, total_months m;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 7. Refresh Dashboard Summary (replaces refresh_monthly_summary)
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_dashboard_summary()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Clear existing summary
    TRUNCATE expense_monthly_summary;

    -- Repopulate with dashboard data only (excludes internal transfers)
    INSERT INTO expense_monthly_summary (month, category, total, transaction_count, last_updated)
    SELECT
        month,
        category,
        total,
        transaction_count,
        NOW() as last_updated
    FROM vw_dashboard_summary;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Get summary stats for dashboard cards:
-- SELECT * FROM get_dashboard_stats();

-- Get monthly discretionary spending:
-- SELECT * FROM vw_discretionary_summary ORDER BY month, category;

-- Get monthly fixed costs:
-- SELECT * FROM vw_fixed_costs_summary ORDER BY month, category;

-- Refresh the dashboard summary:
-- SELECT refresh_dashboard_summary();
