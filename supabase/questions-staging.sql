-- ============================================================
-- NORCET PREP — AI Question-Generation Pipeline
-- supabase/questions-staging.sql
--
-- Creates the staging table that the local `scripts/generate.js`
-- Node script inserts into via the Supabase service-role client.
-- The `content-staging` Edge Function then exposes list/approve/
-- delete to the admin app so a human can review every AI-generated
-- question before it lands in a live bank.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor).
-- Safe to re-run — all statements are IF NOT EXISTS or use
-- CREATE OR REPLACE.
--
-- SECURITY MODEL:
--   • RLS is ENABLED but no anon/authenticated policies exist →
--     the table is effectively invisible to all PostgREST clients.
--   • REVOKE ALL removes even the implicit public role privilege.
--   • Only the service-role key (held by Edge Functions and the
--     local generator script) can read or write this table.
--   • approve_staging_question() is SECURITY DEFINER so it runs
--     as the table owner regardless of caller role — the
--     content-staging function invokes it via RPC with the
--     service-role key and passes the session token for admin
--     verification at the application layer first.
-- ============================================================

-- ---- staging table -----------------------------------------------
CREATE TABLE IF NOT EXISTS questions_staging (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       text,
  sub         text,
  type        text,                 -- 'mcq' | 'msq'
  q           text,
  options     jsonb,                -- string[]
  correct     jsonb,                -- number[]  (0-based indices)
  exp         text,
  wrong       jsonb,                -- { "<optIndex>": "<rationale>", ... }
  "memoryTip" text,
  difficulty  text,                 -- 'easy' | 'medium' | 'hard'
  image       text,                 -- null for AI-generated rows
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable Row-Level Security.  No policies are created, which means
-- even the `authenticated` role gets nothing — only the service role
-- bypasses RLS (Postgres rule: security_definer functions + service
-- role bypass RLS).
ALTER TABLE questions_staging ENABLE ROW LEVEL SECURITY;

-- Strip all privileges from the public PostgREST roles.
REVOKE ALL ON questions_staging FROM anon;
REVOKE ALL ON questions_staging FROM authenticated;

-- Explicitly grant the DML privileges to service_role. This project's default
-- privileges only grant service_role REFERENCES/TRIGGER/TRUNCATE on new tables
-- (not SELECT/INSERT/UPDATE/DELETE), so without this the local generator and the
-- content-staging broker get "permission denied for table questions_staging".
GRANT SELECT, INSERT, UPDATE, DELETE ON questions_staging TO service_role;

-- ---- approval function -------------------------------------------
-- approve_staging_question(question_id, target_bank_key)
--
-- Called by the content-staging Edge Function after the admin clicks
-- "Approve" in the admin app.  Runs atomically:
--   (a) Read the staging row.
--   (b) Build the canonical question object in the app's bank shape.
--   (c) UPSERT it into the kv_shared row at target_bank_key:
--         • If the bank row doesn't exist → create a new private bank blob.
--         • If it exists → parse value TEXT→jsonb, append the question,
--           bump updatedAt, write back as TEXT.
--   (d) DELETE the staging row.
--
-- Returns: the target_bank_key that was written (text).
--
-- The generated question id is 'gen-' + the first 8 chars of the
-- staging uuid, giving a short stable identifier that won't collide
-- with human-authored question ids (those use 'f1', 'msn-42', etc.).
--
-- Bank id is derived from the key: 'bank:ai-msn' → id 'ai-msn'.
-- The name is the capitalised id with hyphens replaced by spaces:
-- 'ai-msn' → 'Ai Msn' (admin can rename via the Bank Editor later).
-- ============================================================
CREATE OR REPLACE FUNCTION approve_staging_question(
  question_id    uuid,
  target_bank_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
-- Pin search_path so this SECURITY DEFINER function can't be hijacked by a
-- caller shadowing kv_shared / questions_staging in an earlier-search schema.
SET search_path = public, pg_temp
AS $$
DECLARE
  _row          questions_staging%ROWTYPE;
  _question_id  text;
  _question_obj jsonb;
  _bank_id      text;
  _bank_name    text;
  _existing_row kv_shared%ROWTYPE;
  _bank_blob    jsonb;
  _questions    jsonb;
  _now_ms       bigint;
BEGIN
  -- (a) Read the staging row; error if missing (already approved or bad id).
  SELECT * INTO STRICT _row
  FROM   questions_staging
  WHERE  id = question_id;

  -- (b) Build the question object in the canonical app shape.
  _question_id  := 'gen-' || substr(question_id::text, 1, 8);
  _now_ms       := (extract(epoch FROM now()) * 1000)::bigint;

  _question_obj := jsonb_build_object(
    'id',         _question_id,
    'topic',      _row.topic,
    'sub',        _row.sub,
    'type',       _row.type,
    'q',          _row.q,
    'options',    _row."options",
    'correct',    _row.correct,
    'exp',        _row.exp,
    'wrong',      _row.wrong,
    'memoryTip',  _row."memoryTip",
    'difficulty', _row.difficulty,
    'image',      _row.image
  );

  -- Derive bank id and a human-readable name from the key.
  -- 'bank:ai-msn' → bank_id = 'ai-msn', name = 'Ai Msn'
  _bank_id   := substr(target_bank_key, length('bank:') + 1);
  _bank_name := initcap(replace(_bank_id, '-', ' '));

  -- (c) UPSERT into kv_shared.
  SELECT * INTO _existing_row
  FROM   kv_shared
  WHERE  key = target_bank_key;

  IF NOT FOUND THEN
    -- Brand-new bank: create a minimal private bank blob.
    _bank_blob := jsonb_build_object(
      'id',         _bank_id,
      'name',       _bank_name,
      'questions',  jsonb_build_array(_question_obj),
      'visibility', 'private',
      'createdAt',  _now_ms,
      'updatedAt',  _now_ms
    );

    INSERT INTO kv_shared (key, value)
    VALUES (target_bank_key, _bank_blob::text)
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value;

  ELSE
    -- Existing bank: parse, append, bump updatedAt, write back.
    BEGIN
      _bank_blob := _existing_row.value::jsonb;
    EXCEPTION WHEN OTHERS THEN
      -- Corrupted value — treat as new bank to avoid a hard failure.
      _bank_blob := jsonb_build_object(
        'id',         _bank_id,
        'name',       _bank_name,
        'questions',  '[]'::jsonb,
        'visibility', 'private',
        'createdAt',  _now_ms,
        'updatedAt',  _now_ms
      );
    END;

    -- Ensure questions array exists.
    IF _bank_blob -> 'questions' IS NULL THEN
      _bank_blob := jsonb_set(_bank_blob, '{questions}', '[]'::jsonb);
    END IF;

    _questions := _bank_blob -> 'questions';
    _bank_blob := jsonb_set(_bank_blob, '{questions}',  _questions  || _question_obj);
    _bank_blob := jsonb_set(_bank_blob, '{updatedAt}',  to_jsonb(_now_ms));

    UPDATE kv_shared
    SET    value = _bank_blob::text
    WHERE  key   = target_bank_key;
  END IF;

  -- (d) Remove the approved staging row.
  DELETE FROM questions_staging WHERE id = question_id;

  RETURN target_bank_key;
END;
$$;

-- ---- lock down who may call the approve function -----------------
-- Postgres grants EXECUTE on new functions to PUBLIC by default, which would let
-- the anon PostgREST role invoke this SECURITY DEFINER function directly and
-- bypass the admin gate in the content-staging Edge Function. Revoke it; only
-- the service role (held by the Edge Function + the local generator) may call it.
REVOKE EXECUTE ON FUNCTION approve_staging_question(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION approve_staging_question(uuid, text) TO service_role;
