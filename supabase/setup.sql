-- ============================================================
-- NORCET PREP — Supabase schema setup
--
-- Run this once in the Supabase SQL Editor for a fresh project.
-- Creates the single shared key-value table and the RLS policies
-- that let the anon (publishable) key read/write it.
--
-- Security model:
--   The app handles its own user accounts and passwords (PBKDF2
--   hashed, stored in the same kv_shared table). Postgres just
--   provides durable storage. RLS grants the anon role full CRUD
--   on this table — same level of access the original Claude
--   artifact's window.storage had.
-- ============================================================

CREATE TABLE IF NOT EXISTS kv_shared (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE kv_shared ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select" ON kv_shared FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON kv_shared FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON kv_shared FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete" ON kv_shared FOR DELETE TO anon USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON kv_shared TO anon;
