-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    muscle_group VARCHAR(50) NOT NULL,
    secondary_muscles TEXT[],
    equipment VARCHAR(100),
    category VARCHAR(50),
    force VARCHAR(50),
    level VARCHAR(50),
    mechanic VARCHAR(50),
    instructions TEXT[],
    images TEXT[],
    source_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
