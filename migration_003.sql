-- Migration for an already-deployed Roomie Rhythm D1 database.
-- Run this ONCE in the D1 console (or via `wrangler d1 execute roomie-rhythm-db --remote --file=./migration_003.sql`)
-- Safe to skip if you're setting up a brand-new database from schema.sql instead.

ALTER TABLE users ADD COLUMN display_name TEXT;
