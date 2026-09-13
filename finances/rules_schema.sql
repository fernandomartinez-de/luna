-- Rules Layer for Bronze → Silver Transformation
-- Bronze = Excel files in C:\Users\fmartine\Downloads\chase-bronce\
-- Silver = expense_transactions table
-- Gold = Analytics views (vw_fixed_costs_summary, etc.)

-- ============================================================================
-- CATEGORIZATION RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS categorization_rules (
    id SERIAL PRIMARY KEY,
    pattern TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('High', 'Medium', 'Low')),
    rule_type TEXT NOT NULL CHECK (rule_type IN ('exact', 'contains', 'starts_with', 'regex')),
    priority INT DEFAULT 100,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- DESCRIPTION STANDARDIZATION RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS description_standardization_rules (
    id SERIAL PRIMARY KEY,
    pattern TEXT NOT NULL,
    standardized_name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('exact', 'contains', 'starts_with', 'regex')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SEED CATEGORIZATION RULES
-- ============================================================================

INSERT INTO categorization_rules (pattern, category, confidence, rule_type, priority, notes) VALUES
-- Payroll (Highest Priority)
('SS&C Technologie', 'Payroll', 'High', 'starts_with', 1, 'Current employer'),
('PRESTIGE', 'Payroll', 'High', 'starts_with', 1, 'Former employer'),
('NEW YORK DISASTE', 'Payroll', 'High', 'starts_with', 1, 'Former employer'),

-- Fixed Costs - Mortgage & Utilities
('HMG 7436', 'Mortgage Payment', 'High', 'contains', 10, 'Mortgage payment'),
('BRIDGEVIEW 66 CO', 'HOA', 'High', 'contains', 10, 'HOA payment'),
('CON ED OF NY', 'Electricity', 'High', 'contains', 10, 'Electricity'),
('VERIZON WIRELESS', 'Verizon', 'High', 'contains', 10, 'Verizon phone'),
('VZ WIRELESS', 'Verizon', 'High', 'contains', 10, 'Verizon phone'),

-- Subscriptions
('ANTHROPIC', 'Subscriptions', 'High', 'contains', 20, 'Claude AI subscription'),
('CLAUDE', 'Subscriptions', 'High', 'contains', 20, 'Claude AI subscription'),
('AMAZON PRIME', 'Subscriptions', 'High', 'contains', 20, 'Amazon Prime membership'),
('UBER ONE', 'Subscriptions', 'High', 'contains', 20, 'Uber One membership'),
('UBER*ONE', 'Subscriptions', 'High', 'contains', 20, 'Uber One membership'),
('HULU', 'Subscriptions', 'High', 'contains', 20, 'Hulu streaming'),
('PLAYSTATION', 'Subscriptions', 'High', 'contains', 20, 'PlayStation Plus'),
('NETFLIX', 'Subscriptions', 'High', 'contains', 20, 'Netflix streaming'),
('SPOTIFY', 'Subscriptions', 'High', 'contains', 20, 'Spotify music'),

-- Fitness & Wellness
('GRINDHOUSE', 'Grindhouse', 'High', 'contains', 30, 'Gym membership'),
('GOTHAM', 'Gotham', 'High', 'contains', 30, 'Dispensary'),

-- Transportation
('UBER EATS', 'Uber Eats', 'High', 'contains', 40, 'Food delivery'),
('UBER *TRIP', 'Uber Trip', 'High', 'contains', 40, 'Ride sharing'),
('LYFT', 'Uber Trip', 'High', 'contains', 40, 'Ride sharing'),
('MTA', 'MTA', 'High', 'contains', 40, 'Public transit'),
('OMNY', 'MTA', 'High', 'contains', 40, 'Public transit'),

-- Groceries
('COSTCO', 'Groceries', 'High', 'contains', 50, 'Warehouse store'),
('JUBILEE', 'Groceries', 'High', 'contains', 50, 'Supermarket'),
('WHOLE FOODS', 'Groceries', 'High', 'contains', 50, 'Supermarket'),
('TRADER JOE', 'Groceries', 'High', 'contains', 50, 'Supermarket'),
('FAIRWAY', 'Groceries', 'High', 'contains', 50, 'Supermarket'),

-- Dining
('MCDONALD', 'Dining', 'High', 'contains', 60, 'Fast food'),
('CHIPOTLE', 'Dining', 'High', 'contains', 60, 'Fast casual'),
('STARBUCKS', 'Dining', 'High', 'contains', 60, 'Coffee shop'),

-- Shopping
('AMAZON.COM', 'Shopping', 'High', 'contains', 70, 'Online shopping'),
('TARGET', 'Shopping', 'High', 'contains', 70, 'Retail'),
('WALMART', 'Shopping', 'High', 'contains', 70, 'Retail'),
('APPLE.COM', 'Shopping', 'High', 'contains', 70, 'Apple Store'),

-- Golf
('GLF*', 'Golf', 'High', 'starts_with', 80, 'Golf courses'),
('GOLF', 'Golf', 'High', 'contains', 80, 'Golf courses'),

-- Pet
('CHEWY.COM', 'Pet', 'High', 'contains', 90, 'Pet supplies'),
('PETCO', 'Pet', 'High', 'contains', 90, 'Pet store'),
('PETSMART', 'Pet', 'High', 'contains', 90, 'Pet store'),

-- Excluded Categories (Internal Transfers)
('ATM', 'ATM', 'High', 'contains', 5, 'Excluded from calculations'),
('ZELLE', 'Zelle', 'High', 'contains', 5, 'Excluded from calculations'),
('VENMO', 'Venmo', 'High', 'contains', 5, 'Excluded from calculations'),
('PAYMENT THANK YOU', 'Credit Card Payment', 'High', 'contains', 5, 'Excluded from calculations'),
('OVERDRAFT FEE', 'Fees & Adjustments', 'High', 'contains', 5, 'Excluded from calculations')

ON CONFLICT (pattern) DO NOTHING;

-- ============================================================================
-- SEED DESCRIPTION STANDARDIZATION RULES
-- ============================================================================

INSERT INTO description_standardization_rules (pattern, standardized_name, rule_type, notes) VALUES
('ANTHROPIC', 'ANTHROPIC* CLAUDE SUB', 'contains', 'Merge all Anthropic variations'),
('CLAUDE', 'ANTHROPIC* CLAUDE SUB', 'contains', 'Merge all Claude variations'),
('UBER ONE', 'UBER *ONE MEMBERSHIP', 'contains', 'Standardize Uber One'),
('UBER*ONE', 'UBER *ONE MEMBERSHIP', 'contains', 'Standardize Uber One'),
('AMAZON PRIME', 'AMAZON PRIME MEMBERSHIP', 'contains', 'Standardize Amazon Prime')

ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Apply categorization rules to a description
CREATE OR REPLACE FUNCTION apply_categorization_rules(transaction_desc TEXT)
RETURNS TEXT AS $$
DECLARE
    matched_category TEXT;
    rule RECORD;
BEGIN
    FOR rule IN
        SELECT pattern, category, rule_type
        FROM categorization_rules
        ORDER BY priority ASC, id ASC
    LOOP
        CASE rule.rule_type
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

    RETURN COALESCE(matched_category, 'Miscellaneous');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Standardize description
CREATE OR REPLACE FUNCTION standardize_description(transaction_desc TEXT)
RETURNS TEXT AS $$
DECLARE
    standardized TEXT := transaction_desc;
    rule RECORD;
BEGIN
    FOR rule IN
        SELECT pattern, standardized_name, rule_type
        FROM description_standardization_rules
        ORDER BY id ASC
    LOOP
        CASE rule.rule_type
            WHEN 'contains' THEN
                IF UPPER(transaction_desc) LIKE '%' || UPPER(rule.pattern) || '%' THEN
                    standardized := rule.standardized_name;
                    EXIT;
                END IF;
        END CASE;
    END LOOP;

    RETURN standardized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- USAGE
-- ============================================================================

-- Add a new categorization rule:
-- INSERT INTO categorization_rules (pattern, category, confidence, rule_type, priority, notes)
-- VALUES ('MERCHANT NAME', 'Category', 'High', 'contains', 50, 'Description');

-- Add a standardization rule:
-- INSERT INTO description_standardization_rules (pattern, standardized_name, rule_type, notes)
-- VALUES ('VARIANT', 'STANDARD NAME', 'contains', 'Merge variants');

-- Test categorization:
-- SELECT apply_categorization_rules('ANTHROPIC PBC');
-- SELECT standardize_description('ANTHROPIC PBC');
