-- ============================================================
-- NORCET PREP — service_role table grants (Stage 2 support)
--
-- WHY: the kv-write broker and auth-secure Edge Functions connect as
-- `service_role`. service_role bypasses RLS but STILL needs ordinary
-- table-level privileges, and Supabase does not always grant DML to
-- service_role on freshly-created tables (we hit this on profile_secrets
-- during deploy — it had only TRUNCATE/REFERENCES/TRIGGER).
--
-- `kv_shared` has never been written by service_role before Stage 2 (it was
-- always written with the anon key), so it may be missing the same grants.
-- The broker's first write happens in Step 6 of the Stage 2 rollout — run
-- THIS file before that step so a missing grant doesn't masquerade as an
-- auth bug.
--
-- Safe + idempotent: GRANT is a no-op if the privilege already exists.
-- Run it in the SQL Editor anytime.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE kv_shared       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profile_secrets TO service_role;

-- admin_profile_ids is read by the broker (isAdmin) and managed by
-- admin-manage; it has worked via service_role already, but grant it too so
-- the whole service-role surface is explicit and recreate-proof.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admin_profile_ids TO service_role;

-- Verify (optional): should list the DML privileges for service_role.
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name IN ('kv_shared','profile_secrets','admin_profile_ids')
--   AND grantee = 'service_role'
-- ORDER BY table_name, privilege_type;
