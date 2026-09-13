# Bronze Layer

Raw Excel files downloaded from Chase accounts.

## Structure
- chase-checking-6813-*.xlsx - Checking account statements
- Chase-creditcard-5113-*.xlsx - Credit card 5113 statements  
- Chase-creditcard-4433-*.xlsx - Credit card 4433 statements

## Source
Downloaded from chase.com or backfilled from Supabase.

## Usage
Place downloaded Chase Excel files here. The load_bronze.py script will automatically process all Excel files in this folder.
