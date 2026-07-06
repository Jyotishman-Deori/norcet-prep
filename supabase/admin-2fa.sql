-- =====================================================================
-- NURSEHOLIC — Admin-panel 2FA (TOTP / Google Authenticator)
-- Run ONCE in the Supabase SQL editor (after admin-roles.sql).
--
-- One column on profile_secrets (already service-role-only): the staff
-- member's TOTP secret, base32. While unconfirmed it carries a "pending:"
-- prefix (set at enrolment, stripped by the first valid 6-digit code).
-- Only the admin-manage Edge Function reads/writes it; it never reaches
-- any client bundle.
-- =====================================================================

ALTER TABLE profile_secrets
  ADD COLUMN IF NOT EXISTS totp_secret text;

-- Verify:
--   SELECT id, totp_secret IS NOT NULL AS enrolled FROM profile_secrets;
