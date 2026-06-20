// =====================================================================
// src/lib/share-nudge.js — when to surface the (non-intrusive) "share this
// with a friend" nudge at the bottom of a results screen, and what milestone
// (if any) the just-finished session crossed.
//
// Gating (from the spec): show AT MOST once per app session, and never on
// consecutive sessions. We keep a per-session in-memory flag plus a persisted
// last-shown timestamp (a ~1-day cooldown stands in for "not consecutive
// sessions") and the last-celebrated streak value, so a streak card is offered
// once per milestone rather than on every same-day session. A freshly reached
// streak milestone is allowed to bypass the cooldown — it is rare and worth it.
//
// This is purely local (IndexedDB, shared=false). It never blocks the UI: all
// reads/writes are best-effort and fail to "don't show".
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEY_PREFIXES } from './keys.js';

const QUESTION_MILESTONES = [100, 250, 500, 1000, 2500, 5000];
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
const GOOD_SCORE_PCT = 80;
const COOLDOWN_MS = 20 * 60 * 60 * 1000; // ≈ not back-to-back sessions

let _shownThisSession = false;

async function readState() {
  try {
    const r = await safeStorage.get(KEY_PREFIXES.SHARE_NUDGE, false);
    return (r && r.value) ? JSON.parse(r.value) : {};
  } catch (e) { return {}; }
}
async function writeState(s) {
  try { await safeStorage.set(KEY_PREFIXES.SHARE_NUDGE, JSON.stringify(s), false); } catch (e) {}
}

// What milestone did THIS session cross? Pure — derives from lifetime totals
// (AFTER the session) plus this session's own counts. Priority: a freshly
// crossed question-count milestone, then a streak milestone, then a good score.
export function sessionMilestone({ totalAttempted = 0, sessionAttempted = 0, streak = 0, pct = 0 } = {}) {
  const before = Math.max(0, (Number(totalAttempted) || 0) - (Number(sessionAttempted) || 0));
  const after = Number(totalAttempted) || 0;
  const q = QUESTION_MILESTONES.find(m => before < m && after >= m);
  if (q) return { kind: 'questions', value: q };
  if (STREAK_MILESTONES.includes(Number(streak) || 0)) return { kind: 'streak', value: Number(streak) };
  if ((Number(pct) || 0) >= GOOD_SCORE_PCT) return { kind: 'score', value: Math.round(Number(pct) || 0) };
  return null;
}

// Decide whether to show the nudge now. Respects once-per-session, the
// cooldown, and one-card-per-streak-milestone. When an exam is near
// (opts.examSoon), the cooldown is relaxed so the prompt surfaces more readily.
export async function shouldShowNudge(milestone, opts = {}) {
  if (!milestone) return false;
  if (_shownThisSession) return false;
  const st = await readState();
  if (milestone.kind === 'streak' && st.lastStreak === milestone.value) return false;
  const freshStreak = milestone.kind === 'streak' && st.lastStreak !== milestone.value;
  const bypassCooldown = freshStreak || !!opts.examSoon;
  if (st.lastShownAt && (Date.now() - st.lastShownAt) < COOLDOWN_MS && !bypassCooldown) return false;
  return true;
}

export async function markNudgeShown(milestone) {
  _shownThisSession = true;
  const st = await readState();
  st.lastShownAt = Date.now();
  if (milestone && milestone.kind === 'streak') st.lastStreak = milestone.value;
  await writeState(st);
}
