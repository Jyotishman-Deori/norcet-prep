-- ============================================================
-- NORCET PREP — Premium subscriptions, family plans, single-session
-- supabase/subscriptions.sql
--
-- Creates the paid-tier data model (blueprint 2026-07-03):
--   • subscriptions   — one row per paid plan (SUPER/MAX, INDIVIDUAL/FAMILY)
--   • family_members  — separate accounts linked to a FAMILY subscription
--   • family_invites  — single-use, expiring invite tokens (stored HASHED)
--   • profile_secrets.active_session_id — the "last one wins" concurrent-
--     session column (rotated by auth-secure at every login)
--
-- PLACEHOLDER-PAYMENTS ERA: no gateway is wired. Rows are created only by
-- an ADMIN through the `subscription` Edge Function (action admin-grant),
-- mirroring the profile.premium placeholder the client already reads.
-- When a real gateway lands, its webhook writes the same rows.
--
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL Editor).
-- Safe to re-run — everything is IF NOT EXISTS / additive.
--
-- SECURITY MODEL (same as questions_staging / profile_secrets):
--   • RLS ENABLED with ZERO anon/authenticated policies → invisible to
--     every PostgREST client using the public anon key.
--   • REVOKE ALL strips even implicit privileges from the public roles.
--   • Only the service-role key (held by Edge Functions) touches these
--     tables. ALL access goes through the `subscription` Edge Function,
--     which authorizes by the signed session token (owner/member/admin).
-- ============================================================

-- ---- subscriptions -------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid   text        NOT NULL,             -- profile.uid (rename-safe handle)
  owner_id    text,                             -- profile id slug at grant time (display only)
  tier        text        NOT NULL CHECK (tier IN ('SUPER','MAX')),
  billing     text        NOT NULL CHECK (billing IN ('INDIVIDUAL','FAMILY')),
  status      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','expired')),
  seats       int         NOT NULL DEFAULT 1,   -- 1 individual · 6 family (owner + 5)
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,                      -- NULL = no expiry (manual test grant)
  source      text        NOT NULL DEFAULT 'admin-grant',  -- 'admin-grant' now; 'gateway' later
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_owner_uid_idx ON subscriptions (owner_uid);

-- ---- family plan membership ---------------------------------------
-- COMPLETELY ISOLATED ACCOUNTS: this table links independent accounts to a
-- shared paid subscription. It carries NO progress, NO credentials — each
-- member keeps their own profile blob, streaks, and logs untouched.
CREATE TABLE IF NOT EXISTS family_members (
  subscription_id uuid        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  member_uid      text        NOT NULL,          -- the member's profile.uid
  member_id       text,                          -- id slug at join time (display only)
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, member_uid)
);

-- One family per account: an account can be a member of at most ONE plan.
CREATE UNIQUE INDEX IF NOT EXISTS family_members_one_family_idx ON family_members (member_uid);

-- ---- family invites -------------------------------------------------
-- The RAW token never touches the database — only its SHA-256 hex lands
-- here, so a DB leak cannot be replayed as an invite link. Single-use,
-- 7-day expiry (enforced by the Edge Function).
CREATE TABLE IF NOT EXISTS family_invites (
  token_hash      text        PRIMARY KEY,       -- sha256(raw token), hex
  subscription_id uuid        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  used_by         text,                          -- member_uid once redeemed
  used_at         timestamptz
);

CREATE INDEX IF NOT EXISTS family_invites_sub_idx ON family_invites (subscription_id);

-- ---- lockdown (pattern: questions_staging / profile_secrets) --------
ALTER TABLE subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON subscriptions  FROM anon, authenticated;
REVOKE ALL ON family_members FROM anon, authenticated;
REVOKE ALL ON family_invites FROM anon, authenticated;

-- service_role bypasses RLS but still needs table-level DML (this project's
-- default privileges don't grant it on new tables — observed on deploy).
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON family_invites TO service_role;

-- ---- single concurrent session ("last one wins") --------------------
-- auth-secure rotates this on EVERY successful login/register/reset and
-- embeds the same value (`sid`) in the signed session token. The kv-write /
-- kv-read / content-staging / subscription brokers compare token.sid to this
-- column when the game_config flag security.singleSession is ON; a mismatch
-- means a newer device logged in → 401 SESSION_EXPIRED. NULL (no login since
-- this feature shipped) always passes, so rollout kicks nobody out.
ALTER TABLE profile_secrets ADD COLUMN IF NOT EXISTS active_session_id text;

-- NOTE: we intentionally create NO policies for anon/authenticated on any of
-- these tables. Do not add any. All access goes through Edge Functions only.
