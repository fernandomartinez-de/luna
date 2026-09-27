"""
Generate SQL INSERT statements for exercises

Creates insert_exercises.sql file with all 876 exercises
"""

import json
import os

def map_muscle_group(primary_muscles):
    """Map free-exercise-db primary muscles to our muscle groups"""
    if not primary_muscles:
        return 'core'

    muscle = primary_muscles[0].lower()

    mapping = {
        'chest': 'chest',
        'pectorals': 'chest',
        'shoulders': 'shoulders',
        'deltoids': 'shoulders',
        'back': 'back',
        'lats': 'back',
        'middle back': 'back',
        'lower back': 'back',
        'upper back': 'back',
        'traps': 'back',
        'biceps': 'biceps',
        'triceps': 'triceps',
        'forearms': 'biceps',
        'quadriceps': 'quadriceps',
        'hamstrings': 'hamstrings',
        'glutes': 'glutes',
        'calves': 'calves',
        'abdominals': 'core',
        'abs': 'core',
        'abductors': 'glutes',
        'adductors': 'quadriceps',
        'neck': 'shoulders',
    }

    return mapping.get(muscle, 'core')

def escape_sql_string(s):
    """Escape single quotes for SQL"""
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

def array_to_sql(arr):
    """Convert Python array to PostgreSQL array literal"""
    if not arr:
        return 'ARRAY[]::TEXT[]'

    escaped = [escape_sql_string(item) for item in arr]
    return 'ARRAY[' + ', '.join(escaped) + ']::TEXT[]'

# Load exercises
script_dir = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(script_dir, '../../free-exercise-db-main/dist/exercises.json')

with open(json_path, 'r') as f:
    exercises = json.load(f)

print(f"Loaded {len(exercises)} exercises")

# Generate SQL
sql_lines = []
sql_lines.append("-- Insert exercises")
sql_lines.append("-- Generated from free-exercise-db")
sql_lines.append("")

for i, ex in enumerate(exercises):
    name = ex.get('name', '')
    slug = ex.get('id', name.lower().replace(' ', '-'))
    primary_muscles = ex.get('primaryMuscles', [])
    muscle_group = map_muscle_group(primary_muscles)
    secondary_muscles = ex.get('secondaryMuscles', [])
    equipment = ex.get('equipment', 'body only')
    category = ex.get('category', 'strength')
    force = ex.get('force')
    level = ex.get('level')
    mechanic = ex.get('mechanic')
    instructions = ex.get('instructions', [])

    # Convert image paths to GitHub URLs
    images = []
    for img_path in ex.get('images', []):
        github_url = f'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{img_path}'
        images.append(github_url)

    # Build INSERT statement
    sql = f"""INSERT INTO exercises (name, slug, muscle_group, secondary_muscles, equipment, category, force, level, mechanic, instructions, images, source_id)
VALUES (
    {escape_sql_string(name)},
    {escape_sql_string(slug)},
    {escape_sql_string(muscle_group)},
    {array_to_sql(secondary_muscles)},
    {escape_sql_string(equipment)},
    {escape_sql_string(category)},
    {escape_sql_string(force)},
    {escape_sql_string(level)},
    {escape_sql_string(mechanic)},
    {array_to_sql(instructions)},
    {array_to_sql(images)},
    {escape_sql_string(slug)}
)
ON CONFLICT (slug) DO NOTHING;
"""

    sql_lines.append(sql)

    if (i + 1) % 100 == 0:
        print(f"Generated {i + 1}/{len(exercises)} inserts...")

# Write to file
output_path = os.path.join(script_dir, 'insert_exercises.sql')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

print(f"\n✅ Generated {output_path}")
print(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")
print("\nTo use:")
print("1. Open Supabase SQL Editor")
print("2. Run create_exercises_table.sql first (creates table)")
print("3. Then run insert_exercises.sql (inserts 876 exercises)")
