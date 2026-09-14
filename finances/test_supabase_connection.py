#!/usr/bin/env python3
"""Test Supabase connection."""

import os
import sys

print("Testing Supabase connection...\n")

# Check environment variables
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')

print(f"URL: {url}")
print(f"URL length: {len(url) if url else 0}")
print(f"Key length: {len(key) if key else 0}")
print(f"Key starts with 'eyJ': {key.startswith('eyJ') if key else False}")

if not url or not key:
    print("\n❌ Missing credentials")
    sys.exit(1)

# Try importing supabase
try:
    from supabase import create_client, Client
    print("✓ supabase library imported")
except ImportError as e:
    print(f"❌ Cannot import supabase: {e}")
    sys.exit(1)

# Try creating client
try:
    supabase: Client = create_client(url, key)
    print("✓ Client created")
except Exception as e:
    print(f"❌ Cannot create client: {e}")
    sys.exit(1)

# Try a simple query
try:
    response = supabase.table('real_estate_history').select('*').limit(1).execute()
    print(f"✓ Query successful! Got {len(response.data)} row(s)")
    print("\n✅ Connection working!")
except Exception as e:
    print(f"❌ Query failed: {e}")
    sys.exit(1)
