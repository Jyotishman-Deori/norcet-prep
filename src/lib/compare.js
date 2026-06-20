// =====================================================================
// src/lib/compare.js — Phase 3 client layer for batches + the consented weekly
// accuracy comparison. Two parts:
//
//   (1) calls to the referral-compare Edge Function (createBatch,
//       peerComparison, batchComparison) + a direct read of a batch record for
//       the join screen. All degrade to null if the function isn't deployed,
//       the user is a guest, or anything errors — callers then hide the feature.
//
//   (2) PURE data-shape helpers for the opt-in flag + joined-batch list, which
//       live in the user's own blob (data.preferences.compareOptIn / data.batches)
//       and are persisted by the normal autosave (setData). Keeping the shape in
//       one place avoids scattering `data.preferences...` across components.
//
// CONSENT: comparison is OFF by default. Nothing about a user is ever shown to
// anyone else unless that user has compareOptIn === true, enforced server-side.
// =====================================================================
import { getAuthToken } from '../storage';
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/referral-compare` : null;

async function call(op, extra) {
  if (!FN_URL || !SUPABASE_KEY) return null;
  const token = getAuthToken();
  if (!token) return null;
  try {
    const r = await fetch(FN_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, token, ...(extra || {}) }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

// --- Edge Function ops ---------------------------------------------------
export async function createBatch(name, expiryDays) {
  const j = await call('create-batch', { name, expiryDays });
  if (!j || !j.batchId) return null;
  return j; // { batchId, name, expiresAt }
}

export async function peerComparison() {
  const j = await call('peer-comparison');
  if (!j) return null;
  return j; // { optedIn, you?, peers? }
}

export async function batchComparison(batchId) {
  const j = await call('batch-comparison', { batchId });
  if (!j) return null;
  return j; // { optedIn, member, batchAvg?, yourPct?, rank?, activeCount, threshold }
}

// Batch records are semi-public (name + creator + expiry only — never the
// member list), so the join screen reads them straight off the shared store.
export async function getBatchInfo(batchId) {
  if (!batchId) return null;
  try {
    const r = await safeStorage.get(KEYS.batch(batchId), true);
    if (!r || !r.value) return null;
    const rec = JSON.parse(r.value);
    const expired = !!(rec.expiresAt && Date.now() > rec.expiresAt);
    return { ...rec, expired };
  } catch (e) { return null; }
}

// --- pure data-shape helpers (blob lives in the user's own data) ---------
export function getCompareOptIn(data) {
  return !!(data && data.preferences && data.preferences.compareOptIn);
}
export function withCompareOptIn(data, on) {
  const base = data || {};
  return { ...base, preferences: { ...(base.preferences || {}), compareOptIn: !!on } };
}
export function getJoinedBatches(data) {
  const b = data && data.batches;
  return Array.isArray(b) ? b : [];
}
export function withBatchJoined(data, batchId) {
  const base = data || {};
  const cur = Array.isArray(base.batches) ? base.batches : [];
  if (!batchId || cur.includes(batchId)) return base;
  return { ...base, batches: [...cur, batchId] };
}
export function withBatchLeft(data, batchId) {
  const base = data || {};
  const cur = Array.isArray(base.batches) ? base.batches : [];
  return { ...base, batches: cur.filter(b => b !== batchId) };
}
