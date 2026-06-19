// =====================================================================
// src/lib/repeat-unattempted.js  (B2 — repeat UNATTEMPTED questions)
// Tracks, per profile, the questions the user was shown in a test but never
// engaged with: NOT answered, NOT revealed (didn't check the answer), and
// NOT skipped. Those are re-surfaced first in future Quick/Topic tests so
// nothing the user simply ran out of time for slips through the cracks.
//
// Storage is LOCAL only (safeStorage shared=false → IndexedDB / device cache),
// so it costs zero database storage and works for guests too — consistent
// with cribs/notes.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEY_PREFIXES } from './keys.js';

const MAX_POOL = 500; // safety cap so the list can't grow unbounded
const keyFor = (profileId) => `${KEY_PREFIXES.REPEAT_UNATTEMPTED}${profileId || 'guest'}`;

// Load the stored pool as an array of qIds (most-recent last).
export async function loadRepeatPool(profileId) {
  try {
    const r = await safeStorage.get(keyFor(profileId), false);
    const v = r && r.value ? JSON.parse(r.value) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' || typeof x === 'number') : [];
  } catch (e) { return []; }
}

export async function saveRepeatPool(profileId, ids) {
  try {
    const trimmed = (ids || []).slice(-MAX_POOL);
    await safeStorage.set(keyFor(profileId), JSON.stringify(trimmed), false);
  } catch (e) { /* local cache best-effort */ }
}

// Fold one finished run into the pool and return the new array.
//   presentedIds — every qId in the run's question set
//   resultIds    — qIds that produced a result (answered OR revealed) → resolved
//   skippedIds   — qIds the user actively skipped (and never resolved)
// For each presented question: resolved or skipped → drop from the pool;
// otherwise (truly unattempted) → add. This means a question that was
// unattempted before and is now answered/revealed/skipped is correctly
// removed, and revealing the answer always disqualifies it.
export function nextPool(currentIds, { presentedIds = [], resultIds = [], skippedIds = [] }) {
  const set = new Set(currentIds || []);
  const resolved = new Set(resultIds);
  const skipped = new Set(skippedIds);
  for (const id of presentedIds) {
    if (resolved.has(id)) set.delete(id);
    else if (skipped.has(id)) set.delete(id);
    else set.add(id);
  }
  return Array.from(set);
}

// Split a candidate pool into [toRepeat, rest] given the stored repeat set,
// preserving the caller's pool order for `rest`.
export function partitionByRepeat(pool, repeatIds) {
  const repeat = new Set(repeatIds || []);
  const toRepeat = [];
  const rest = [];
  for (const q of pool) {
    if (repeat.has(q.id)) toRepeat.push(q);
    else rest.push(q);
  }
  return { toRepeat, rest };
}
