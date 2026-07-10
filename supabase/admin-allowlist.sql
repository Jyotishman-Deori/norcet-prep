-- =====================================================================
-- NURSEHOLIC — Create the admin allow-list table  (admin_profile_ids)
-- supabase/admin-allowlist.sql
--
-- DRIFT-HEAL (2026-07-10): production has always had this table, but no SQL
-- file in the repo ever CREATED it (only ALTER/GRANT/policy files reference
-- it). A fresh environment (the nurseholic-dev project) could not be stood
-- up from source. This file is the missing CREATE, safe to re-run anywhere:
-- IF NOT EXISTS everywhere, no data touched.
--
-- Shape matches production: one row per staff identity. Both the display-name
-- slug id AND the durable uid of a person may be listed (brokers check either).
-- admin-roles.sql (run AFTER this) adds the role column + hierarchy.
-- lock-admin-list.sql (run after the brokers are live) closes anon access.
-- =====================================================================

CREATE TABLE IF NOT EXISTS admin_profile_ids (
  profile_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on. No anon policies here: on a NEW project the brokers (service-role)
-- are the only readers, matching the post-lock-admin-list production state.
ALTER TABLE admin_profile_ids ENABLE ROW LEVEL SECURITY;
