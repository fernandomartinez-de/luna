"""
Split insert_exercises.sql into smaller files for Supabase SQL Editor
"""

import os

script_dir = os.path.dirname(os.path.abspath(__file__))
input_file = os.path.join(script_dir, 'insert_exercises.sql')

# Read the SQL file
with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find all INSERT statements
inserts = []
current_insert = []

for line in lines:
    if line.strip().startswith('INSERT INTO'):
        if current_insert:
            inserts.append(''.join(current_insert))
        current_insert = [line]
    elif current_insert:
        current_insert.append(line)

# Add last insert
if current_insert:
    inserts.append(''.join(current_insert))

print(f"Found {len(inserts)} INSERT statements")

# Split into files of 100 inserts each
chunk_size = 100
num_files = (len(inserts) + chunk_size - 1) // chunk_size

for i in range(num_files):
    start = i * chunk_size
    end = min((i + 1) * chunk_size, len(inserts))

    chunk = inserts[start:end]

    filename = f'insert_exercises_part_{i+1:02d}.sql'
    filepath = os.path.join(script_dir, filename)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f'-- Part {i+1} of {num_files}\n')
        f.write(f'-- Exercises {start+1} to {end}\n\n')
        f.write('\n'.join(chunk))

    file_size_kb = os.path.getsize(filepath) / 1024
    print(f"✓ Created {filename} ({file_size_kb:.0f} KB, {len(chunk)} exercises)")

print(f"\n✅ Split into {num_files} files")
print("\nRun each file in Supabase SQL Editor in order:")
for i in range(num_files):
    print(f"  {i+1}. insert_exercises_part_{i+1:02d}.sql")
