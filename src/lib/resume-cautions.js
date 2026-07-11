// =====================================================================
// src/lib/resume-cautions.js — friendly-mentor caution copy for Resume.
//
// When a student leaves a practice run part-way (and again when they come back
// to it), we speak to them like a kind mentor, not a scold. Two moving parts:
//
//   1. A ROTATING tip — a different gentle nudge each time, so the message stays
//      fresh instead of nagging. Drawn from EXIT_TIPS on the way out and
//      RESUME_TIPS on the way back, advanced by a small per-profile cursor.
//   2. A FIXED integrity line — shown EVERY time, unchanging: answer honestly,
//      do not look up answers mid-run. A borrowed mark is a mark missed on exam
//      day. Plus a warm note that a real water / bathroom break is completely
//      fine (this is not about guilt).
//
// Copy is English-only (matching the hardcoded-English ConfirmExitDialog) and
// follows the house rule: NO em dashes, NO double hyphens in user-facing text.
// Pure + Node-testable; the screen supplies the cursor and renders the strings.
// =====================================================================

// Shown every single time, on exit AND on return. Never rotates: the one promise
// we ask a learner to keep with themselves.
export const INTEGRITY_REMINDER =
  'A gentle promise to keep with yourself: answer from what you know, not from notes or a search. A mark you borrow today is a mark you will miss on the real exam day.';

// Shown every time too: pauses for a genuine human need are welcome.
export const BREAK_NOTE =
  'Stepping away for water or a quick bathroom break is completely okay. Looking after yourself is part of good preparation.';

// Rotating nudges shown when the learner is LEAVING a run part-way. Each frames
// the trade-off of pausing from a slightly different, encouraging angle.
export const EXIT_TIPS = [
  'A real exam never pauses. The more often you practise a set start to finish, the calmer that hall will feel.',
  'Stopping midway breaks your rhythm. When you can, try to carry a set through to the end in one sitting.',
  'Sitting through a full set builds exam stamina. Frequent breaks feel easier now, but they teach your mind to expect a rest.',
  'Come back soon and finish strong. A set left half done rarely gets the honest review it deserves.',
  'The exam clock keeps moving whether you feel ready or not. Practising without pausing is how you train for that.',
  'One pause is fine. Just try not to make pausing a habit, because staying focused for the full length is part of what you are building.',
];

// Rotating welcomes shown when the learner RETURNS to resume. Warm, steadying,
// and a quiet reminder to answer honestly and aim to finish this time.
export const RESUME_TIPS = [
  'Welcome back. Take a breath, read the next question fresh, and finish at your own pace.',
  'Good to see you again. You are right where you left off, so pick up calmly.',
  'You are back in your seat. Try to carry this set to the end this time, it is good practice for the real thing.',
  'Let us finish what you started. Answer from memory and trust the work you have already put in.',
  'Back again. The real exam gives no chance to pause, so make this run count.',
];

// pickTip — deterministic rotation through a pool by an integer cursor. Safe for
// negative or out-of-range cursors. Returns '' only for an empty/invalid pool.
export function pickTip(pool, cursor) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  const n = Number.isFinite(cursor) ? Math.trunc(cursor) : 0;
  const i = ((n % pool.length) + pool.length) % pool.length;
  return pool[i];
}

// buildCaution — the full bundle the exit / return dialog renders. `kind` is
// 'exit' or 'resume'; `cursor` selects which rotating tip shows this time.
export function buildCaution({ kind, cursor } = {}) {
  const pool = kind === 'resume' ? RESUME_TIPS : EXIT_TIPS;
  return {
    tip: pickTip(pool, cursor),
    integrity: INTEGRITY_REMINDER,
    breakNote: BREAK_NOTE,
  };
}
