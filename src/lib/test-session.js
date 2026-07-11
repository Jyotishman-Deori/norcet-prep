// =====================================================================
// src/lib/test-session.js — "Resume an in-progress test" snapshot store.
//
// A user who steps away mid-practice (a phone call, a bathroom break, an
// accidental close) can pick the run back up instead of losing it. This module
// is the PURE core: it decides WHICH runs are resumable, shapes the snapshot
// record, summarises it for the Home card, and ages it out. The IO (reading /
// writing safeStorage under KEYS.activeTest(pid), shared:false) lives in the
// screens/App, mirroring data-export.js — so this file stays Node-testable.
//
// Deliberately covers UNTIMED PRACTICE ONLY. The timed Mock and the Advanced
// Test exam simulation are NOT resumable on purpose: pausing a clock is the very
// "unfair means" the mentor caution warns against, and a no-pause run is what
// makes the simulation feel like the real exam.
//
// Snapshot by question ID (not the question objects): content can change between
// versions, so the run is re-resolved against the live pool at resume time and
// any pruned ids are simply dropped.
// =====================================================================

export const SNAPSHOT_VERSION = 1;

// Untimed practice modes the Quiz runner drives. Mock is intentionally absent
// (it is timed); the Advanced Test lives in a different screen entirely.
export const RESUMABLE_MODES = ['quick', 'topic', 'weak-topic', 'bookmarks', 'review-due', 'wrong'];

// A snapshot older than this is treated as gone (never offered, cleared on read).
// A day is plenty: resume is for "I stepped away", not "I abandoned this a week ago".
export const STALE_MS = 24 * 60 * 60 * 1000;

// A run is resumable when it is one of the practice modes AND not timed. The
// `timed` guard is belt-and-braces so a timed variant of any mode can never be
// snapshotted (its clock could not be honoured fairly on resume).
export function isResumable(mode, timed) {
  return !timed && RESUMABLE_MODES.includes(mode);
}

// buildSnapshot — shape the record that gets persisted. `results` is the Quiz's
// per-question result array (each already carries its qId), `questionIds` is the
// play order, `index` is the current position in that order.
export function buildSnapshot({ mode, questionIds, results, index, elapsed, startedAt, now } = {}) {
  const ts = typeof now === 'number' ? now : Date.now();
  return {
    v: SNAPSHOT_VERSION,
    kind: 'quiz',
    mode: mode || 'quick',
    questionIds: Array.isArray(questionIds) ? questionIds.slice() : [],
    results: Array.isArray(results) ? results : [],
    index: Math.max(0, index | 0),
    elapsed: Math.max(0, elapsed | 0),
    startedAt: typeof startedAt === 'number' ? startedAt : ts,
    ts,
  };
}

// isStale — true if the snapshot is missing, malformed, or older than STALE_MS.
export function isStale(snap, now) {
  if (!snap || typeof snap !== 'object' || !Array.isArray(snap.questionIds)) return true;
  const t = typeof now === 'number' ? now : Date.now();
  return (t - (snap.ts || 0)) > STALE_MS;
}

// isValidSnapshot — a fresh, non-empty, resumable snapshot worth surfacing.
export function isValidSnapshot(snap, now) {
  if (isStale(snap, now)) return false;
  if (!snap.questionIds.length) return false;
  if (!isResumable(snap.mode, false)) return false;
  return true;
}

// Friendly, stable labels for the Home card. English-only, matching the
// hardcoded-English ConfirmExitDialog and the neighbouring data rows.
const MODE_LABELS = {
  'quick': 'Quick practice',
  'topic': 'Topic practice',
  'weak-topic': 'Weak-area practice',
  'bookmarks': 'Bookmarked questions',
  'review-due': 'Revision due',
  'wrong': 'Mistake review',
};

export function modeLabel(mode) {
  return MODE_LABELS[mode] || 'Practice session';
}

// nextUnansweredIndex — the play-order position of the first question not yet
// answered. A resumed run lands here (NOT on the raw saved index), so a user who
// closed while viewing an answered question's explanation never gets served that
// question again (which would double-count it). Falls back to the last position
// if everything has somehow been answered.
export function nextUnansweredIndex(questionIds, results) {
  const ids = Array.isArray(questionIds) ? questionIds : [];
  const answered = new Set((Array.isArray(results) ? results : []).map(r => r && r.qId));
  const i = ids.findIndex(id => !answered.has(id));
  return i < 0 ? Math.max(0, ids.length - 1) : i;
}

// summarize — the slim view the Home "Resume" card needs. `answered` counts the
// questions with a recorded result; `total` is the run length.
export function summarize(snap, now) {
  if (!snap || typeof snap !== 'object') return null;
  const total = Array.isArray(snap.questionIds) ? snap.questionIds.length : 0;
  const answered = Array.isArray(snap.results) ? snap.results.length : 0;
  const t = typeof now === 'number' ? now : Date.now();
  return {
    mode: snap.mode,
    label: modeLabel(snap.mode),
    answered,
    total,
    index: Math.max(0, snap.index | 0),
    ageMs: Math.max(0, t - (snap.ts || t)),
  };
}
