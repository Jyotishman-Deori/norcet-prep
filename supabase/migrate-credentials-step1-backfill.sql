-- ============================================================
-- NORCET PREP — Stage 1 migration, STEP 1 of 2: BACKFILL
--
-- Copies the credential fields out of every existing public
-- profile blob (kv_shared, key like 'profile:<id>') into the new
-- protected profile_secrets table.
--
-- SAFE: this only READS kv_shared and writes the new table. It does
-- NOT modify or remove anything from kv_shared. Your existing login
-- path keeps working unchanged until you deploy the new code.
--
-- Run this AFTER profile-secrets.sql and BEFORE deploying the new
-- frontend. Idempotent: ON CONFLICT DO NOTHING means re-running is
-- harmless.
--
-- ('profile:' is 8 characters, so substring(key from 9) is the id.
--  The LIKE 'profile:%' pattern does NOT match 'profilemeta:%' because
--  that has no colon in the 8th position.)
-- ============================================================

INSERT INTO profile_secrets
  (id, uid, display_name, password_hash, salt, dob_hash, dob_salt)
SELECT
  substring(key FROM 9)               AS id,
  value::jsonb ->> 'uid'              AS uid,
  value::jsonb ->> 'displayName'      AS display_name,
  value::jsonb ->> 'passwordHash'     AS password_hash,
  value::jsonb ->> 'salt'             AS salt,
  value::jsonb ->> 'dobHash'          AS dob_hash,
  value::jsonb ->> 'dobSalt'          AS dob_salt
FROM kv_shared
WHERE key LIKE 'profile:%'
  AND value::jsonb ->> 'passwordHash' IS NOT NULL
  AND value::jsonb ->> 'salt'         IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Verify (optional): how many credential rows got copied in?
-- SELECT count(*) AS secrets_count FROM profile_secrets;
-- SELECT count(*) AS profile_blobs FROM kv_shared WHERE key LIKE 'profile:%';
-- These two should match (every real account has a passwordHash).
