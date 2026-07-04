-- =====================================================================
-- supabase/waitlist.sql — the LAUNCH WAITLIST table.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run (everything is
-- IF NOT EXISTS / idempotent).
--
-- SECURITY MODEL (same as subscriptions.sql):
--   • RLS is ON and there are ZERO anon/authenticated policies.
--   • Only service_role can touch the table — every read/write goes
--     through the `waitlist` Edge Function broker (public actions are
--     Turnstile + rate-limited; admin actions require a signed session
--     token whose profile is on admin_profile_ids).
--   • This is DELIBERATELY stricter than the usual "public INSERT with
--     RLS" waitlist recipe: even signups are broker-mediated so email
--     normalization, temp-mail blocking and phone validation can never
--     be bypassed by posting straight to PostgREST.
--
-- NOTE: this project's default privileges do NOT auto-grant service_role
-- on new tables — the explicit GRANT below is required, not boilerplate.
--
-- Row lifecycle: waiting → (referral milestone) pending_verification →
-- (admin approve) approved [claim_token + 48h expiry] → (register)
-- onboarded | (window passes) expired; admin can set rejected anywhere.
-- ip_hash / fp_hash are one-way HMACs (signup_events convention) — the
-- raw IP / fingerprint is never stored.
-- =====================================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL UNIQUE,      -- NORMALIZED (lowercase, +alias/gmail-dots stripped)
  whatsapp_num        text NOT NULL UNIQUE,      -- 10-digit Indian mobile, normalized
  state               text NOT NULL,             -- slug from src/lib/waitlist.js INDIAN_STATES
  college             text,
  intent_answer       text,                      -- "how are you preparing" (≤500 chars, broker-capped)
  intent_score        int  NOT NULL DEFAULT 1,   -- 5 = detailed answer (high intent), else 1
  status              text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','pending_verification','approved','onboarded','expired','rejected')),
  own_referral_code   text NOT NULL UNIQUE,      -- NURSE-XXXXX (the code THIS user shares)
  referred_by_code    text,                      -- canonical code of the referrer (validated)
  arrival_ref         text,                      -- raw ?ref value when it matched no waitlist code
  claim_token         uuid UNIQUE,               -- set on approval; NULLed when claimed/expired (single-use)
  approval_expires_at timestamptz,               -- approval + 48h claim window
  claimed_profile_id  text,                      -- profile_secrets.id stamped when the seat is claimed
  ip_hash             text,                      -- HMAC(ip) — never raw
  fp_hash             text,                      -- HMAC(device fingerprint) — never raw
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Hot public queries: rank among waiting rows, referral-use counts.
CREATE INDEX IF NOT EXISTS waitlist_waiting_created_idx
  ON waitlist (created_at) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS waitlist_referred_by_idx
  ON waitlist (referred_by_code) WHERE referred_by_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS waitlist_status_idx
  ON waitlist (status);

-- ---- lockdown (subscriptions.sql template) --------------------------
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON waitlist FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON waitlist TO service_role;
-- ZERO policies on purpose: with RLS on and no policies, anon/authenticated
-- get nothing even if a grant slips through elsewhere. service_role bypasses
-- RLS, so the Edge Function broker keeps working.
