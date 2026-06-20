-- ============================================================
-- NORCET PREP — signup_events table  (Phase 2 / referral anti-abuse)
--
-- One row per account creation, written best-effort by the auth-secure
-- register action (service-role). Used ONLY by the referral-intel function
-- to flag anomalies for the admin:
--   • multiple accounts from the same device (fp_hash) or IP (ip_hash)
--   • an unusually high number of signups from one referral link (ref)
-- It NEVER blocks a signup and is NEVER shown to end users.
--
-- LOCKED exactly like profile_secrets / auth_rate: RLS on with zero policies,
-- all table grants revoked from the public roles, granted only to service_role
-- (which bypasses RLS but still needs table-level privileges). The anon and
-- authenticated keys have NO access — not even SELECT.
--
-- Privacy: ip_hash and fp_hash are HMAC/SHA-256 hashes, not raw values, so the
-- table holds no directly identifying device or network data — only stable
-- opaque tokens that let equal devices/IPs be grouped.
--
-- IDEMPOTENT: safe to run more than once.
--
-- DEPLOY: run this in the Supabase SQL editor, then deploy the functions
--   (auth-secure + the new referral-intel) per their headers.
-- ============================================================

CREATE TABLE IF NOT EXISTS signup_events (
  id          BIGSERIAL PRIMARY KEY,
  profile_id  TEXT NOT NULL,             -- normalized id of the new account
  ip_hash     TEXT,                      -- HMAC of client IP (one-way; equal IP -> equal hash)
  fp_hash     TEXT,                      -- HMAC of the client device fingerprint
  ref         TEXT,                      -- referrer code at signup (?ref=), if any
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE signup_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON signup_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE signup_events TO service_role;
-- BIGSERIAL needs the sequence granted too, or service-role INSERTs fail.
GRANT USAGE, SELECT ON SEQUENCE signup_events_id_seq TO service_role;

CREATE INDEX IF NOT EXISTS signup_events_created_idx ON signup_events (created_at DESC);
CREATE INDEX IF NOT EXISTS signup_events_ip_idx      ON signup_events (ip_hash);
CREATE INDEX IF NOT EXISTS signup_events_fp_idx      ON signup_events (fp_hash);
CREATE INDEX IF NOT EXISTS signup_events_ref_idx     ON signup_events (ref);
