-- Migration: Add profile_picture, first_name, last_name columns to users table
-- Run this with: docker exec -i socialnet-postgres psql -U socialnet -d socialnet < migrate_user_columns.sql

BEGIN;

-- Add profile_picture column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'profile_picture'
    ) THEN
        ALTER TABLE users ADD COLUMN profile_picture TEXT;
        RAISE NOTICE 'Added column: profile_picture';
    ELSE
        RAISE NOTICE 'Column profile_picture already exists';
    END IF;
END $$;

-- Add first_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'first_name'
    ) THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
        RAISE NOTICE 'Added column: first_name';
    ELSE
        RAISE NOTICE 'Column first_name already exists';
    END IF;
END $$;

-- Add last_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'last_name'
    ) THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
        RAISE NOTICE 'Added column: last_name';
    ELSE
        RAISE NOTICE 'Column last_name already exists';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('profile_picture', 'first_name', 'last_name')
ORDER BY column_name;

COMMIT;

\echo 'Migration completed successfully!'
