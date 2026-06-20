-- ============================================================
-- NORCET PREP — auth_rate table + rate_hit() RPC   (PROMPT 21 / rate limiting)
--
-- Backs the fixed-window rate limiter used INSIDE the Deno Edge Functions
-- (auth-secure and kv-write). The Vercel-KV limiter in api/_ratelimit.js is
-- Node-only and cannot run inside Deno, so the Edge Functions need their own
-- store. Postgres (reached with the service-role key, same as profile_secrets)
-- is that store.
--
-- WHY AN RPC INSTEAD OF READ-THEN-WRITE: a plain "SELECT count, then UPDATE"
-- from the function would race under concurrent hits and undercount. rate_hit()
-- does the whole window check + increment in ONE atomic INSERT ... ON CONFLICT
-- statement and returns whether the caller is allowed plus how long to wait.
--
-- This table, like profile_secrets, is LOCKED: RLS on with zero policies, all
-- grants revoked from anon/authenticated, and only the service-role key (used
-- exclusively inside the Edge Functions) can touch it via the RPC below.
--
-- IDEMPOTENT: safe to run more than once. If you already created auth_rate via
-- a separate Stage-4 runbook, the CREATE ... IF NOT EXISTS is a no-op — but do
-- confirm the existing columns match the shape below (bucket, identifier,
-- window_start, count) or the RPC will not match.
--
-- DEPLOY:
--   1. Run this file in the Supabase SQL editor.
--   2. Re-deploy both Edge Functions so they pick up the limiter:
--        supabase functions deploy auth-secure --no-verify-jwt
--        supabase functions deploy kv-write    --no-verify-jwt
--   (No frontend migration and no change to existing data.)
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_rate (
  bucket        TEXT        NOT NULL,           -- namespace, e.g. 'login', 'change-password'
  identifier    TEXT        NOT NULL,           -- client IP (unauth) or profile id (auth)
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  count         INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, identifier)
);

-- Same lock-down model as profile_secrets: deny-by-default to everyone except
-- the service role (which bypasses RLS but still needs table-level grants).
ALTER TABLE auth_rate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_rate FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_rate TO service_role;

-- ------------------------------------------------------------
-- rate_hit(bucket, identifier, limit, window_seconds)
--   -> TABLE(allowed BOOLEAN, retry_after INT)
--
-- Records one hit and reports whether it is allowed under a fixed window.
--   * If no row exists, or the stored window has fully elapsed, a fresh window
--     starts at now() with count = 1.
--   * Otherwise the existing window's count is incremented.
-- allowed = (resulting count <= limit). retry_after is seconds until the
-- current window resets (>=1) when blocked, else 0. The whole thing is one
-- atomic statement, so concurrent hits cannot undercount.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rate_hit(
  p_bucket         TEXT,
  p_identifier     TEXT,
  p_limit          INT,
  p_window_seconds INT
) RETURNS TABLE (allowed BOOLEAN, retry_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now          TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ;
  v_count        INT;
  v_reset        TIMESTAMPTZ;
BEGIN
  INSERT INTO auth_rate AS ar (bucket, identifier, window_start, count)
       VALUES (p_bucket, p_identifier, v_now, 1)
  ON CONFLICT (bucket, identifier) DO UPDATE
       SET window_start = CASE
             WHEN ar.window_start < v_now - make_interval(secs => p_window_seconds)
               THEN v_now
             ELSE ar.window_start
           END,
           count = CASE
             WHEN ar.window_start < v_now - make_interval(secs => p_window_seconds)
               THEN 1
             ELSE ar.count + 1
           END
  RETURNING ar.window_start, ar.count INTO v_window_start, v_count;

  v_reset := v_window_start + make_interval(secs => p_window_seconds);

  IF v_count > p_limit THEN
    allowed     := FALSE;
    retry_after := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset - v_now)))::INT);
  ELSE
    allowed     := TRUE;
    retry_after := 0;
  END IF;
  RETURN NEXT;
END;
$$;

-- The RPC is SECURITY DEFINER and owned by the table owner (service role path),
-- so callers do not need direct table grants. Allow only the service role to
-- invoke it; revoke from anon/authenticated so it is never reachable with the
-- public anon key.
REVOKE ALL ON FUNCTION rate_hit(TEXT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rate_hit(TEXT, TEXT, INT, INT) TO service_role;

-- OPTIONAL HOUSEKEEPING: stale rows self-heal (any new hit resets an expired
-- window in place), so a sweep is not required. If you ever want to reclaim
-- space from one-off identifiers, this is safe to run any time:
--   DELETE FROM auth_rate WHERE window_start < now() - interval '1 day';
