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
// NOTE: safe-storage.js is imported LAZILY inside the two async IO functions
// (not at the top), exactly like game-config.js does. It statically pulls in
// src/storage.js via a Vite-only extensionless specifier, which plain Node cannot
// resolve — a top-level import here made this whole module un-importable under
// Node, which is why the pure algorithm below shipped with no test. Deferring it
// keeps the pure functions Node-testable; the dynamic import only ever runs in
// the browser, where Vite resolves it.
import { KEY_PREFIXES } from './keys.js';

export const MAX_POOL = 500; // safety cap so the list can't grow unbounded
const keyFor = (profileId) => `${KEY_PREFIXES.REPEAT_UNATTEMPTED}${profileId || 'guest'}`;

// Load the stored pool as an array of qIds (most-recent last).
export async function loadRepeatPool(profileId) {
  try {
    const { safeStorage } = await import('./safe-storage.js');
    const r = await safeStorage.get(keyFor(profileId), false);
    const v = r && r.value ? JSON.parse(r.value) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' || typeof x === 'number') : [];
  } catch (e) { return []; }
}

export async function saveRepeatPool(profileId, ids) {
  try {
    const { safeStorage } = await import('./safe-storage.js');
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

// ---------------------------------------------------------------------
// ABANDONED runs (a test the user started and left without finishing).
//
// `nextPool` above is the whole algorithm and is UNCHANGED. It was only ever
// triggered on completion, so a run the user walked away from folded nothing and
// its questions were lost. These two helpers add the missing trigger.
//
// The catch: a FINISHED run displayed every question, so completeQuiz can pass
// the entire question set as `presentedIds`. An ABANDONED run did not. Folding
// its whole set would dump the ~42 questions of a bailed 50-question Mock that
// the user never even saw into a pool whose meaning is "you saw it and did not
// engage" — flooding it and crowding out the real ones.
//
// So an abandoned run folds only what the user actually REACHED.
// ---------------------------------------------------------------------

// The ids the user actually reached in an unfinished run: everything up to their
// position in the play order, PLUS anything they answered/revealed or skipped.
// (Position alone would miss a skipped question, because skipping re-queues it to
// the end of the schedule.) Questions never reached are left out on purpose: they
// are still simply unseen, and the normal unseen-first selector serves those.
export function reachedIds({ orderedIds = [], index = 0, resultIds = [], skippedIds = [] } = {}) {
  const reached = new Set();
  const ids = Array.isArray(orderedIds) ? orderedIds : [];
  const upto = Math.min(ids.length, Math.max(0, (index | 0) + 1));
  for (let i = 0; i < upto; i++) if (ids[i]) reached.add(ids[i]);
  for (const id of (Array.isArray(resultIds) ? resultIds : [])) if (id) reached.add(id);
  for (const id of (Array.isArray(skippedIds) ? skippedIds : [])) if (id) reached.add(id);
  return Array.from(reached);
}

// Turn an unfinished-run snapshot (lib/test-session.js) into the exact inputs
// `nextPool` already takes, so retiring an abandoned run is a one-liner:
//   nextPool(pool, abandonedRunInputs(snap))
export function abandonedRunInputs(snap) {
  if (!snap || typeof snap !== 'object') return { presentedIds: [], resultIds: [], skippedIds: [] };
  const orderedIds = Array.isArray(snap.questionIds) ? snap.questionIds : [];
  const resultIds = (Array.isArray(snap.results) ? snap.results : [])
    .map((r) => r && r.qId).filter(Boolean);
  const skippedIds = Array.isArray(snap.skipped) ? snap.skipped.filter(Boolean) : [];
  const index = Math.max(0, snap.index | 0);
  return {
    presentedIds: reachedIds({ orderedIds, index, resultIds, skippedIds }),
    resultIds,
    skippedIds,
  };
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
