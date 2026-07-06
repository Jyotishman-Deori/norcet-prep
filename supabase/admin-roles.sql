-- =====================================================================
-- NURSEHOLIC — Staff role hierarchy  (Admin > Co-Admin > Moderator)
-- Run ONCE in the Supabase SQL editor. Owner journal: "Role hierarchy" spec.
--
-- Model: admin_profile_ids grows a `role` column.
--   'admin'     — the OWNER. Exactly one person (their id + uid rows).
--                 Only role that can remove/demote Co-Admins and transfer
--                 ownership. Cannot be removed/demoted except via transfer.
--   'coadmin'   — almost everything (announcements, live config, push,
--                 users, engagement, waitlist, banks). Can add/remove
--                 MODERATORS only. Default for pre-existing rows.
--   'moderator' — community control only: feedback replies, FAQ manager,
--                 content DRAFTS (review queue), read reports/users/basic
--                 logs. No destructive powers, no config, no push.
--
-- Enforcement is SERVER-SIDE: every Edge Function broker looks the caller's
-- CURRENT role up per action (role is never baked into the session token),
-- so a demotion takes effect on the target's very next action.
-- =====================================================================

ALTER TABLE admin_profile_ids
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'coadmin'
  CHECK (role IN ('admin','coadmin','moderator'));

-- ---- OWNER BACKFILL — ⚠ EDIT IF YOUR IDS DIFFER ----------------------
-- Marks the owner's slug row AND uid row as 'admin'. Every other existing
-- row keeps the 'coadmin' default (full power minus staff governance).
UPDATE admin_profile_ids SET role = 'admin'
 WHERE profile_id IN ('iyro', '9cfd9a71-47c4-43e2-995f-e95430c321ce');

-- ---- Ownership transfer: ATOMIC (single transaction inside the fn) ----
-- Demotes ALL current 'admin' rows to 'coadmin' and promotes the target row
-- to 'admin' — both or neither. Called ONLY by the admin-manage Edge
-- Function (service-role); no client role may execute it.
CREATE OR REPLACE FUNCTION admin_transfer_ownership(p_to text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_profile_ids WHERE profile_id = p_to) THEN
    RETURN false;
  END IF;
  UPDATE admin_profile_ids SET role = 'coadmin' WHERE role = 'admin';
  UPDATE admin_profile_ids SET role = 'admin' WHERE profile_id = p_to;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION admin_transfer_ownership(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_transfer_ownership(text) FROM anon;
REVOKE ALL ON FUNCTION admin_transfer_ownership(text) FROM authenticated;

-- Verify:
--   SELECT profile_id, role, note FROM admin_profile_ids ORDER BY role;
-- Expect: your two rows = 'admin', everyone else 'coadmin'.
