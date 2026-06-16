-- ============================================================
-- NORCET PREP — profile_secrets table  (Stage 1 / C-1 + C-2 fix)
--
-- This table holds the ONLY copy of every account's credentials
-- (password hash, salt, DOB hash, DOB salt) plus the optional
-- email. Unlike kv_shared, the anon (public) key has NO access to
-- this table at all — not even SELECT. Only the service-role key
-- (used exclusively inside the `auth-secure` Edge Function) can
-- read or write it, and the service-role key never reaches the
-- browser.
--
-- This is what makes the bulk password-hash scrape impossible:
-- after migration, the hashes simply are not in any anon-readable
-- row anywhere.
--
-- RUN ORDER (see the two migrate-credentials-*.sql files):
--   1. Run THIS file (creates the empty table).
--   2. Run migrate-credentials-step1-backfill.sql (copies existing
--      hashes in from kv_shared).
--   3. Deploy the auth-secure function + the new frontend, confirm
--      every real account can log in.
--   4. ONLY THEN run migrate-credentials-step2-strip.sql (removes
--      the now-duplicated hashes from the public kv_shared blobs).
-- ============================================================

CREATE TABLE IF NOT EXISTS profile_secrets (
  id            TEXT PRIMARY KEY,         -- normalized profile id (slug)
  uid           TEXT,                     -- permanent rename-safe handle
  display_name  TEXT,                     -- convenience copy (not authoritative)
  password_hash TEXT NOT NULL,            -- PBKDF2-SHA256 100k, hex
  salt          TEXT NOT NULL,            -- 16 random bytes, hex
  dob_hash      TEXT,                     -- PBKDF2 over normalized DOB (nullable)
  dob_salt      TEXT,                     -- separate salt for the DOB
  email         TEXT,                     -- OPTIONAL, unverified, PII — lives ONLY here
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS ON + zero policies = deny-by-default for anon and authenticated.
-- The service-role key bypasses RLS entirely, so the Edge Function still
-- has full access; nobody else does.
ALTER TABLE profile_secrets ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: also strip table-level grants from the public roles,
-- so even a future accidental "FOR ... USING (true)" policy can't expose it
-- without someone also re-granting here.
REVOKE ALL ON profile_secrets FROM anon, authenticated;

-- IMPORTANT: service_role is NOT a superuser — it bypasses RLS but still needs
-- table-level privileges. A freshly-created table does not always inherit DML
-- for service_role from Supabase's default privileges (observed during deploy:
-- the table came up with only TRUNCATE/REFERENCES/TRIGGER). Grant it explicitly
-- so the auth-secure Edge Function (which connects as service_role) can read and
-- write this table, and so a from-scratch recreate is fully self-contained.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profile_secrets TO service_role;

-- NOTE: we intentionally create NO policies for anon/authenticated. Do not
-- add any. All access goes through the auth-secure Edge Function only.
