-- Create workout_logs table to track weight progression
CREATE TABLE workout_logs (
  id SERIAL PRIMARY KEY,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  weight DECIMAL(10,2) NOT NULL,
  reps INTEGER NOT NULL,
  sets INTEGER DEFAULT 1,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- Allow public access (change this later for user-specific access)
CREATE POLICY "Allow public access to workout logs"
ON workout_logs
FOR ALL
USING (true);

-- Indexes for faster queries
CREATE INDEX idx_workout_logs_exercise_id ON workout_logs(exercise_id);
CREATE INDEX idx_workout_logs_logged_at ON workout_logs(logged_at);

-- Create view for personal records (best lifts per exercise)
CREATE OR REPLACE VIEW exercise_personal_records AS
SELECT
  exercise_id,
  MAX(weight) as max_weight,
  weight,
  reps,
  logged_at,
  -- Epley formula for estimated 1RM: weight * (1 + reps/30)
  ROUND(weight * (1 + reps::decimal / 30), 1) as estimated_1rm
FROM workout_logs
WHERE (exercise_id, weight * (1 + reps::decimal / 30)) IN (
  SELECT exercise_id, MAX(weight * (1 + reps::decimal / 30))
  FROM workout_logs
  GROUP BY exercise_id
)
GROUP BY exercise_id, weight, reps, logged_at;
