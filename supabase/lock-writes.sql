-- ============================================================
-- NORCET PREP — Stage 2: LOCK WRITES on kv_shared
--
-- ⚠️  RUN THIS LAST. Only after:
--      1. SESSION_SIGNING_SECRET is set on BOTH functions,
--      2. auth-secure (token-issuing) is redeployed,
--      3. kv-write (broker) is deployed,
--      4. the new frontend is deployed, AND
--      5. you've confirmed that with the broker live, normal writes still
--         work: take a quiz (progress saves), favorite a section, vote a
--         question helpful, post an announcement as admin, and rename a
--         throwaway account. All must succeed via the broker BEFORE you run
--         this — because until this runs, writes can still fall back to the
--         open anon path, so a broker bug would be invisible.
--
-- This removes the open anon INSERT/UPDATE/DELETE policies + privileges.
-- After it runs, the anon (public) key can only READ kv_shared; all writes
-- must go through the kv-write broker (service-role). That closes the
-- integrity half of C-1 (no more anonymous overwrite/wipe).
--
-- SELECT stays open on purpose — public content (leaderboard, the profile
-- directory, FAQ, vote counts) must stay readable. (Profile blobs are already
-- hash-free after Stage 1, so open reads no longer expose credentials.)
--
-- Take one more `supabase db dump --data-only` immediately before running.
-- Reversible if needed by re-creating the anon write policies (kept below,
-- commented, for emergency rollback only).
-- ============================================================

DROP POLICY IF EXISTS "anon_insert" ON kv_shared;
DROP POLICY IF EXISTS "anon_update" ON kv_shared;
DROP POLICY IF EXISTS "anon_delete" ON kv_shared;

-- Keep SELECT. Revoke only the write privileges from the public roles, so even
-- a future accidental "USING (true)" write policy can't take effect without a
-- deliberate re-GRANT here.
REVOKE INSERT, UPDATE, DELETE ON kv_shared FROM anon;
REVOKE INSERT, UPDATE, DELETE ON kv_shared FROM authenticated;

-- Sanity check (optional): list remaining policies — expect only "anon_select".
-- SELECT polname, cmd FROM pg_policies WHERE tablename = 'kv_shared';

-- =====================================================================
-- EMERGENCY ROLLBACK ONLY (re-opens anon writes — undoes the security fix):
--   CREATE POLICY "anon_insert" ON kv_shared FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY "anon_update" ON kv_shared FOR UPDATE TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY "anon_delete" ON kv_shared FOR DELETE TO anon USING (true);
--   GRANT INSERT, UPDATE, DELETE ON kv_shared TO anon;
-- =====================================================================
