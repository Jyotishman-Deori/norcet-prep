-- ============================================================
-- NurseHolic — add Google Sign-In + email-based login
--
-- Adds a nullable `google_sub` (Google's stable per-account id) and makes
-- password_hash/salt nullable (a Google-only account has no password —
-- Google IS the recovery factor). Adds a case-insensitive unique index on
-- email so "log in by email" always resolves to exactly one account, and
-- two accounts can never silently share an email.
--
-- RUN ONCE in the Supabase SQL editor, then deploy the updated auth-secure
-- function (adds the google-auth + lookup-by-email actions, and the
-- googleIdToken path on register).
-- ============================================================

ALTER TABLE profile_secrets ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE profile_secrets ALTER COLUMN salt DROP NOT NULL;

ALTER TABLE profile_secrets ADD COLUMN IF NOT EXISTS google_sub TEXT;

-- One Google account can only ever be linked to one profile.
CREATE UNIQUE INDEX IF NOT EXISTS profile_secrets_google_sub_key
  ON profile_secrets (google_sub) WHERE google_sub IS NOT NULL;

-- Case-insensitive email uniqueness (functional index) — "Test@x.com" and
-- "test@x.com" collide regardless of stored casing, so lookup-by-email stays
-- unambiguous even for the handful of pre-existing rows that predate this
-- feature (stored with whatever casing the user originally typed).
CREATE UNIQUE INDEX IF NOT EXISTS profile_secrets_email_lower_key
  ON profile_secrets (lower(email)) WHERE email IS NOT NULL;
