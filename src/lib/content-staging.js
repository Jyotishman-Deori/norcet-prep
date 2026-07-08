// =====================================================================
// src/lib/content-staging.js — admin-app client for the AI staging pipeline.
//
// Talks to the `content-staging` Edge Function, which is admin-only and
// requires the signed session token that auth-secure minted at login
// (the same token the kv-write broker uses).  The token is attached via
// the same brokerWrite pattern as src/storage.js — transport uses the
// anon key; authorization is enforced server-side by the session token.
//
// Exported API (all async):
//   listStaging()                         → StagingRow[]
//   approveStaging(id, targetBankKey)     → { ok: true }
//   deleteStaging(id)                     → { ok: true }
//   generateStaging(topic, count)         → { ok: true, inserted: N }
//
// StagingRow shape (mirrors questions_staging columns):
//   { id, topic, sub, type, q, options, correct, exp, wrong,
//     memoryTip, difficulty, image, created_at }
//
// Usage in the admin app:
//   import { listStaging, approveStaging, deleteStaging }
//     from '../lib/content-staging.js';
// =====================================================================

// Vite injects these at build time from .env / Vercel env vars.
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The base URL for the content-staging Edge Function.
const STAGING_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/content-staging`
  : null;

// The session token is set by src/storage.js#setAuthToken() on login and
// boot-restore.  We read it from the same module so there is only one token
// store for the entire admin app.
import { getAuthToken } from '../storage.js';

// ---- internal fetch helper -------------------------------------------
async function callStaging(body) {
  if (!STAGING_URL || !SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error(
      'content-staging: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set.'
    );
  }

  const token = getAuthToken();
  if (!token) {
    throw new Error(
      'content-staging: no session token: log in to the admin app first.'
    );
  }

  const res = await fetch(STAGING_URL, {
    method:  'POST',
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ ...body, token }),
  });

  let payload;
  try { payload = await res.json(); } catch (_) { payload = {}; }

  if (!res.ok) {
    const msg = (payload && payload.error) ? payload.error : `HTTP ${res.status}`;
    throw new Error(`content-staging [${body.action}] failed: ${msg}`);
  }

  return payload;
}

// ---- public API -------------------------------------------------------

/**
 * List every row in questions_staging, ordered oldest-first.
 * @returns {Promise<Array>} Array of staging row objects.
 */
export async function listStaging() {
  const result = await callStaging({ action: 'list' });
  return Array.isArray(result.rows) ? result.rows : [];
}

/**
 * Approve a staging question: atomically moves it into the target bank.
 * @param {string} id            - UUID of the questions_staging row.
 * @param {string} targetBankKey - Must start with 'bank:' (e.g. 'bank:ai-msn').
 * @returns {Promise<{ok: true}>}
 */
export async function approveStaging(id, targetBankKey) {
  if (!id)            throw new Error('approveStaging: id is required');
  if (!targetBankKey) throw new Error('approveStaging: targetBankKey is required');
  return await callStaging({ action: 'approve', id, targetBankKey });
}

/**
 * Delete (reject) a staging question — removes it from the queue permanently.
 * @param {string} id - UUID of the questions_staging row.
 * @returns {Promise<{ok: true}>}
 */
export async function deleteStaging(id) {
  if (!id) throw new Error('deleteStaging: id is required');
  return await callStaging({ action: 'delete', id });
}

/**
 * Generate a batch of AI-drafted questions into the staging queue.
 * Server-side, admin-gated, human-reviewed — the questions land in
 * questions_staging and must be Approved before they reach a student.
 * Runs a two-stage Gemini call; expect ~10–25s. The Gemini key lives only as
 * a server-side Supabase secret — it is never in this bundle.
 * @param {string} topic - One of the exam topic ids (e.g. 'msn', 'pharm').
 * @param {number} [count=5] - How many to draft (server clamps to 1..8).
 * @returns {Promise<{ok: true, inserted: number}>}
 */
export async function generateStaging(topic, count = 5) {
  if (!topic) throw new Error('generateStaging: topic is required');
  return await callStaging({ action: 'generate', topic, count });
}
