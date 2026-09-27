"""
Seed exercises table in Supabase from free-exercise-db

One-time script to create exercises table and populate with 876 exercises.

Usage:
    export SUPABASE_URL='https://xxx.supabase.co'
    export SUPABASE_KEY='your-service-role-key'
    python seed_exercises.py
"""

import json
import os
import sys
import requests

def load_exercises():
    """Load exercises from free-exercise-db JSON"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, '../../free-exercise-db-main/dist/exercises.json')

    if not os.path.exists(json_path):
        print(f"ERROR: Could not find exercises.json at {json_path}")
        print("Download free-exercise-db and place in personal repo root")
        sys.exit(1)

    with open(json_path, 'r') as f:
        exercises = json.load(f)

    print(f"Loaded {len(exercises)} exercises from free-exercise-db")
    return exercises

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

def seed_exercises(supabase_url, supabase_key, exercises):
    """Insert exercises into Supabase via REST API"""

    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }

    rows = []

    for ex in exercises:
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

        rows.append({
            'name': name,
            'slug': slug,
            'muscle_group': muscle_group,
            'secondary_muscles': secondary_muscles,
            'equipment': equipment,
            'category': category,
            'force': force,
            'level': level,
            'mechanic': mechanic,
            'instructions': instructions,
            'images': images,
            'source_id': slug
        })

    # Insert in batches of 100 to avoid payload limits
    batch_size = 100
    total_inserted = 0

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]

        response = requests.post(
            f'{supabase_url}/rest/v1/exercises',
            headers=headers,
            json=batch
        )

        if response.status_code in [200, 201]:
            total_inserted += len(batch)
            print(f"✓ Inserted batch {i//batch_size + 1}/{(len(rows)-1)//batch_size + 1} ({len(batch)} exercises)")
        else:
            print(f"ERROR inserting batch: {response.status_code}")
            print(response.text)

            # If table doesn't exist, create it
            if 'does not exist' in response.text.lower() or response.status_code == 404:
                print("\nTable doesn't exist. Creating via Supabase dashboard SQL editor:")
                print("""
Run this SQL in your Supabase dashboard (SQL Editor):

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

CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);

Then re-run this script.
                """)
                sys.exit(1)

    print(f"\n✓ Total inserted: {total_inserted} exercises")
    return total_inserted

def verify_seed(supabase_url, supabase_key):
    """Verify exercises were seeded correctly"""
    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}'
    }

    # Get total count
    response = requests.get(
        f'{supabase_url}/rest/v1/exercises?select=count',
        headers={**headers, 'Prefer': 'count=exact'}
    )

    if response.status_code == 200:
        total = response.headers.get('Content-Range', '0').split('/')[-1]
        print(f"\n✓ Total exercises in database: {total}")

    # Get breakdown by muscle group
    response = requests.get(
        f'{supabase_url}/rest/v1/exercises?select=muscle_group&order=muscle_group',
        headers=headers
    )

    if response.status_code == 200:
        exercises = response.json()
        breakdown = {}
        for ex in exercises:
            mg = ex.get('muscle_group', 'unknown')
            breakdown[mg] = breakdown.get(mg, 0) + 1

        print("\nBreakdown by muscle group:")
        for muscle in sorted(breakdown.keys()):
            print(f"  {muscle}: {breakdown[muscle]}")

def main():
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY')

    if not supabase_url or not supabase_key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        print("\nUsage:")
        print("  export SUPABASE_URL='https://xxx.supabase.co'")
        print("  export SUPABASE_KEY='your-service-role-key'")
        print("  python seed_exercises.py")
        sys.exit(1)

    print("Loading exercises from free-exercise-db...")
    exercises = load_exercises()

    print(f"\nSeeding {len(exercises)} exercises to Supabase...")
    seed_exercises(supabase_url, supabase_key, exercises)

    print("\nVerifying seed...")
    verify_seed(supabase_url, supabase_key)

    print("\n✅ DONE! Exercises table seeded successfully")

if __name__ == '__main__':
    main()
