-- ============================================================
-- NORCET PREP — Stage 1 migration, STEP 2 of 2: STRIP
--
-- ⚠️  DO NOT RUN THIS UNTIL:
--      1. profile-secrets.sql has been run,
--      2. migrate-credentials-step1-backfill.sql has been run,
--      3. the auth-secure Edge Function is deployed,
--      4. the new frontend is deployed, AND
--      5. you have personally confirmed that EVERY real account can
--         still log in (you have <10, so log into each one).
--
-- This removes the password/DOB hash fields from the PUBLIC kv_shared
-- profile blobs. After this runs, the hashes exist ONLY in the
-- protected profile_secrets table and can no longer be scraped with
-- the anon key. This is the step that actually closes C-2.
--
-- It is irreversible in the sense that the public blobs lose those
-- fields — but the authoritative copy already lives in profile_secrets
-- (step 1), and you took a fresh backup before starting. Take ONE MORE
-- `supabase db dump --data-only` immediately before running this.
-- ============================================================

UPDATE kv_shared
SET value = (
  (value::jsonb)
    - 'passwordHash'
    - 'salt'
    - 'dobHash'
    - 'dobSalt'
)::text
WHERE key LIKE 'profile:%'
  AND (
        value::jsonb ? 'passwordHash'
     OR value::jsonb ? 'salt'
     OR value::jsonb ? 'dobHash'
     OR value::jsonb ? 'dobSalt'
  );

-- Verify (optional): this should return 0 after the update.
-- SELECT count(*) AS still_have_hashes
-- FROM kv_shared
-- WHERE key LIKE 'profile:%' AND value::jsonb ? 'passwordHash';
