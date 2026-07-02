-- ============================================================
-- NORCET PREP — Lock down feedback / crash / analytics reads (follow-up)
--
-- Extends the read-privacy model beyond profile:/myfeedback: so that
-- bug/question REPORTS, crash logs, and engagement rows are no longer
-- world-readable with the public anon key. After this runs, anon can read
-- every PUBLIC prefix but NOT these five:
--     profile:  myfeedback:  feedback:  errlog:  analytics:
--
-- This is a DENYLIST (not an allowlist) on purpose: any NEW public prefix
-- added later stays readable automatically, so we don't repeat the
-- allowlist-drift bug that hid faq:/trend:/etc. (see fix-anon-read-policy.sql).
--
-- ⚠ ORDER: run this ONLY AFTER the matching code is deployed —
--     1. kv-read Edge Function redeployed (serves feedback:/errlog:/analytics:
--        to the owner/admin), AND
--     2. the student + admin apps redeployed (storage.js now routes those
--        reads through the broker).
--   Until both are live, applying this would blank the admin Feedback/Crash
--   views and students' "My reports". With them live, the broker path serves
--   everything and anon simply loses direct access. Fully reversible.
-- ============================================================

DROP POLICY IF EXISTS "anon_select" ON kv_shared;
CREATE POLICY "anon_select" ON kv_shared FOR SELECT TO anon
USING (
  key NOT LIKE 'profile:%'
  AND key NOT LIKE 'myfeedback:%'
  AND key NOT LIKE 'feedback:%'
  AND key NOT LIKE 'errlog:%'
  AND key NOT LIKE 'analytics:%'
);

-- Verify after running (each should return 0 rows for the ANON key, but still
-- resolve for the admin through the app):
--   SELECT key FROM kv_shared WHERE key LIKE 'feedback:%';  -- via anon → 0
--
-- ROLLBACK (revert to the previous profile:/myfeedback:-only denylist):
--   DROP POLICY IF EXISTS "anon_select" ON kv_shared;
--   CREATE POLICY "anon_select" ON kv_shared FOR SELECT TO anon
--     USING ( key NOT LIKE 'profile:%' AND key NOT LIKE 'myfeedback:%' );
-- ============================================================
