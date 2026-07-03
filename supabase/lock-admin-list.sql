-- ============================================================
-- NORCET PREP — Lock the admin allow-list (admin_profile_ids)
-- supabase/lock-admin-list.sql
--
-- Closes the last direct anon access to admin_profile_ids. Until now the
-- table had an open anon SELECT policy ("admin_select" USING true), so
-- anyone with the public anon key could enumerate the admin profile ids.
-- No privilege came with that (every admin ACTION re-checks server-side),
-- but it's needless information disclosure.
--
-- ⚠ ORDER — run this ONLY AFTER both are live, or you lock YOURSELF out
--   of the admin panel:
--     1. admin-manage Edge Function redeployed (adds the token-verified
--        `check-admin` and `list-admins` actions), AND
--     2. the admin app rebuilt/redeployed (admin-ops.js checkServerAdmin
--        and admin.js listAdmins now call admin-manage instead of reading
--        the table directly).
--   The STUDENT app never reads this table — students are unaffected.
--
-- Also revokes the leftover table-level grants the public roles held
-- (the dump showed anon with TRUNCATE/MAINTAIN — TRUNCATE is NOT gated
-- by RLS, so an anon client could have emptied the allow-list, which
-- would have fail-closed every admin. Defense-in-depth: strip it all).
-- ============================================================

-- 1) Drop the open anon read policy. RLS stays ENABLED with zero
--    anon/authenticated policies → deny-by-default (profile_secrets pattern).
DROP POLICY IF EXISTS "admin_select" ON admin_profile_ids;

-- 2) Strip ALL table-level privileges from the public PostgREST roles.
REVOKE ALL ON admin_profile_ids FROM anon, authenticated;

-- 3) Explicit service-role DML (Edge Functions: kv-write isAdmin, kv-read,
--    content-staging, admin-manage add/remove/check/list, subscription).
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_profile_ids TO service_role;

-- VERIFY after running:
--   • Anon REST read returns zero rows / permission denied:
--       GET {SUPABASE_URL}/rest/v1/admin_profile_ids?select=profile_id
--       (with the ANON key) → [] or 401/403, never the id list.
--   • Admin app still unlocks (its check now goes through admin-manage).
--
-- ROLLBACK (restores the old world exactly):
--   CREATE POLICY "admin_select" ON admin_profile_ids FOR SELECT TO anon USING (true);
--   GRANT SELECT ON admin_profile_ids TO anon;
-- ============================================================
