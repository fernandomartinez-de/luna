-- Category Mapping Table
-- Central place to manage all category patterns and aliases

-- ============================================================================
-- CREATE CATEGORY MAPPING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_mapping (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    pattern TEXT NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('exact', 'contains', 'starts_with', 'regex')),
    priority INT DEFAULT 100,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pattern, pattern_type)
);

-- ============================================================================
-- CREATE VIEW TO SEE PATTERNS GROUPED BY CATEGORY
-- ============================================================================

CREATE OR REPLACE VIEW vw_category_mapping AS
SELECT
    category,
    STRING_AGG(pattern, ', ' ORDER BY priority, pattern) as aliases,
    COUNT(*) as pattern_count,
    MIN(priority) as min_priority
FROM category_mapping
GROUP BY category
ORDER BY MIN(priority), category;

-- ============================================================================
-- POPULATE WITH CURRENT PATTERNS
-- ============================================================================

INSERT INTO category_mapping (pattern, category, pattern_type, priority, notes) VALUES
-- Exclude (Highest Priority)
('AUTOPAY', 'Credit Card Payment', 'contains', 1, 'Exclude from calculations'),
('AUTOMATIC PAYMENT', 'Credit Card Payment', 'contains', 1, 'Exclude from calculations'),
('PAYMENT TO CHASE', 'Credit Card Payment', 'contains', 1, 'Exclude from calculations'),
('PAYMENT THANK YOU', 'Credit Card Payment', 'contains', 1, 'Exclude from calculations'),
('CRD AUTOPAY', 'Credit Card Payment', 'contains', 1, 'Exclude from calculations'),

-- Payroll
('SS&C Technologie', 'Payroll', 'starts_with', 10, 'Current employer'),
('PRESTIGE', 'Payroll', 'starts_with', 10, 'Former employer'),
('NEW YORK DISASTE', 'Payroll', 'starts_with', 10, 'Former employer'),

-- Subscriptions
('ANTHROPIC', 'Subscriptions', 'contains', 20, 'Claude AI subscription'),
('CLAUDE', 'Subscriptions', 'contains', 20, 'Claude AI subscription'),
('PLAYSTATION', 'Subscriptions', 'contains', 20, 'PlayStation subscription'),
('TRADE COFFEE', 'Subscriptions', 'contains', 20, 'Coffee subscription'),
('SP TRADE', 'Subscriptions', 'contains', 20, 'Coffee subscription'),
('UBER ONE', 'Subscriptions', 'contains', 20, 'Uber One membership'),
('UBER*ONE', 'Subscriptions', 'contains', 20, 'Uber One membership'),
('MEMBERSHIP', 'Subscriptions', 'contains', 20, 'Various memberships'),
('AMAZON PRIME', 'Subscriptions', 'contains', 20, 'Amazon Prime'),
('HULU', 'Subscriptions', 'contains', 20, 'Hulu streaming'),
('NETFLIX', 'Subscriptions', 'contains', 20, 'Netflix streaming'),
('SPOTIFY', 'Subscriptions', 'contains', 20, 'Spotify music'),

-- Fixed Costs - Mortgage & Utilities
('HMG 7436', 'Mortgage Payment', 'contains', 30, 'Mortgage payment'),
('BRIDGEVIEW 66 CO', 'HOA', 'contains', 30, 'HOA payment'),
('CON ED OF NY', 'Electricity', 'contains', 30, 'Electricity'),
('VERIZON WIRELESS', 'Verizon', 'contains', 30, 'Verizon phone'),
('VZ WIRELESS', 'Verizon', 'contains', 30, 'Verizon phone'),

-- Fitness
('GRINDHOUSE', 'Grindhouse', 'contains', 40, 'Gym membership'),
('CPP GRINDHOUSE', 'Grindhouse', 'contains', 40, 'Gym membership ($135/month)'),

-- Golf
('GOLF', 'Golf', 'starts_with', 50, 'Golf courses'),
('GLF', 'Golf', 'starts_with', 50, 'Golf courses'),

-- Convenience Stores (to Miscellaneous)
('CONVENIENT', 'Miscellaneous', 'contains', 60, 'Convenience store'),
('CONVENI', 'Miscellaneous', 'contains', 60, 'Convenience store'),
('GRAB N GO', 'Miscellaneous', 'contains', 60, 'Williams Grab N Go'),
('GRAB-N-GO', 'Miscellaneous', 'contains', 60, 'Williams Grab N Go'),
('400 ORGANIC', 'Miscellaneous', 'contains', 60, '400 Organic and Natural'),

-- Shopping Overrides
('NWTN HOME', 'Shopping', 'contains', 70, 'Newton Home'),
('NEWTON HOME', 'Shopping', 'contains', 70, 'Newton Home'),

-- Transportation
('UBER EATS', 'Uber Eats', 'contains', 80, 'Food delivery'),
('UBER *TRIP', 'Uber Trip', 'contains', 80, 'Ride sharing'),
('LYFT', 'Uber Trip', 'contains', 80, 'Ride sharing'),
('MTA', 'MTA', 'contains', 80, 'Public transit'),
('OMNY', 'MTA', 'contains', 80, 'Public transit'),

-- Groceries
('COSTCO', 'Groceries', 'contains', 90, 'Warehouse store'),
('JUBILEE', 'Groceries', 'contains', 90, 'Supermarket'),
('WHOLE FOODS', 'Groceries', 'contains', 90, 'Supermarket'),
('TRADER JOE', 'Groceries', 'contains', 90, 'Supermarket'),
('FAIRWAY', 'Groceries', 'contains', 90, 'Supermarket'),

-- Dining
('MCDONALD', 'Dining', 'contains', 100, 'Fast food'),
('CHIPOTLE', 'Dining', 'contains', 100, 'Fast casual'),
('STARBUCKS', 'Dining', 'contains', 100, 'Coffee shop')

ON CONFLICT (pattern, pattern_type) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTION TO APPLY MAPPING
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_category_mapping(transaction_desc TEXT)
RETURNS TEXT AS $$
DECLARE
    matched_category TEXT;
    rule RECORD;
BEGIN
    FOR rule IN
        SELECT pattern, category, pattern_type
        FROM category_mapping
        ORDER BY priority ASC, id ASC
    LOOP
        CASE rule.pattern_type
            WHEN 'exact' THEN
                IF UPPER(transaction_desc) = UPPER(rule.pattern) THEN
                    matched_category := rule.category;
                    EXIT;
                END IF;
            WHEN 'contains' THEN
                IF UPPER(transaction_desc) LIKE '%' || UPPER(rule.pattern) || '%' THEN
                    matched_category := rule.category;
                    EXIT;
                END IF;
            WHEN 'starts_with' THEN
                IF UPPER(transaction_desc) LIKE UPPER(rule.pattern) || '%' THEN
                    matched_category := rule.category;
                    EXIT;
                END IF;
        END CASE;
    END LOOP;

    RETURN matched_category;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- USAGE
-- ============================================================================

-- View all categories and their aliases:
-- SELECT * FROM vw_category_mapping;

-- Add a new pattern:
-- INSERT INTO category_mapping (pattern, category, pattern_type, priority, notes)
-- VALUES ('NEW PATTERN', 'Category', 'contains', 50, 'Description');

-- Test categorization:
-- SELECT apply_category_mapping('ANTHROPIC* CLAUDE SUB');
