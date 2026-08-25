-- Adds a repeat end date for recurring chores in an existing D1 database.
-- Run once after migration_002.sql and migration_003.sql.
ALTER TABLE chores ADD COLUMN repeat_end_date TEXT;
