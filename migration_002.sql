-- Migration for an already-deployed Roomie Rhythm D1 database.
-- Run this ONCE in the D1 console (or via `wrangler d1 execute roomie-rhythm-db --remote --file=./migration_002.sql`)
-- Safe to skip if you're setting up a brand-new database from schema.sql instead.

ALTER TABLE chores ADD COLUMN category TEXT;
ALTER TABLE chores ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_groups_home ON groups(home_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_home ON activity_log(home_id);
