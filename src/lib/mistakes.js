// =====================================================================
// src/lib/mistakes.js — the MISTAKE ENGINE (pure, Node-testable).
// Derives a persistent "UserMistakes" view from the per-profile history
// blob instead of a separate table: history[qId].attempts[] already
// records every submission (now including `pick`, the chosen option
// indices), survives guest↔account merge, and is IDOR-safe server-side
// (the blob lives under the broker-owner-scoped profile: key). No new
// storage, no new sync surface, nothing to drift.
//
// Vocabulary:
//   failCount  — non-revealed wrong attempts (post-compaction:
//                attemptsTotal - attemptsCorrect via attemptStats).
//   lastPick   — the option indices of the most recent WRONG attempt
//                (what the user actually answered; [] when unknown —
//                timeouts, reveals, or pre-`pick` history).
//   resolved   — the Duolingo "fixed it" rule: the LAST result was right
//                AND reviewCount (the correct-streak counter completeQuiz
//                already maintains) reached RESOLVE_STREAK. A later wrong
//                answer resets reviewCount, automatically un-resolving.
//   weight     — queue priority: fail count, boosted by recency.
// =====================================================================
import { attemptStats } from './compact.js';

export const RESOLVE_STREAK = 2;       // rights-in-a-row to count as fixed
const RECENT_7D = 7 * 86400000;
const RECENT_30D = 30 * 86400000;

// One mistake record per ever-wrong question the user has seen.
// Returns [] for empty/missing inputs.
export function buildMistakes(history, allQuestions, now = Date.now()) {
  if (!history || !Array.isArray(allQuestions)) return [];
  const out = [];
  for (const q of allQuestions) {
    if (!q || !q.id) continue;
    const h = history[q.id];
    if (!h) continue;
    const stats = attemptStats(h);
    if (!stats.anyWrong) continue;

    const failCount = Math.max(1, stats.total - stats.correct);

    // Newest-first scan of the attempt tail for the last wrong answer's pick
    // and timestamp. Compacted records keep a 5-attempt tail (incl. pick).
    let lastPick = [];
    let lastWrongTs = 0;
    const arr = Array.isArray(h.attempts) ? h.attempts : [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const a = arr[i];
      if (!a || a.revealed || a.correct) continue;
      lastPick = Array.isArray(a.pick) ? a.pick : [];
      lastWrongTs = a.ts || 0;
      break;
    }
    // Compacted past the tail: fall back to the record's last-seen stamp.
    if (!lastWrongTs && h.compacted) lastWrongTs = h.lastAttemptedTs || 0;

    const resolved = h.lastResult === 'right' && (h.reviewCount || 0) >= RESOLVE_STREAK;

    let weight = failCount;
    if (lastWrongTs && now - lastWrongTs <= RECENT_7D) weight += 2;
    else if (lastWrongTs && now - lastWrongTs <= RECENT_30D) weight += 1;

    out.push({
      qId: q.id,
      question: q,
      failCount,
      lastPick,
      lastWrongTs,
      nextDue: h.nextDue || null,
      resolved,
      weight,
    });
  }
  return out;
}

export function unresolvedCount(mistakes) {
  if (!Array.isArray(mistakes)) return 0;
  return mistakes.reduce((n, m) => n + (m && !m.resolved ? 1 : 0), 0);
}

// The premium review queue: unresolved only, DUE-now first (rides the
// existing spaced-repetition nextDue), then weight, then most recent wrong.
// Resolved items are the caller's "fixed" shelf, not part of the queue.
export function orderMistakeQueue(mistakes, now = Date.now()) {
  if (!Array.isArray(mistakes)) return [];
  const dueScore = (m) => {
    if (!m.nextDue) return 0;
    const t = Date.parse(m.nextDue);
    return Number.isFinite(t) && t <= now ? 1 : 0;
  };
  return mistakes
    .filter(m => m && !m.resolved)
    .slice()
    .sort((a, b) =>
      dueScore(b) - dueScore(a) ||
      b.weight - a.weight ||
      (b.lastWrongTs || 0) - (a.lastWrongTs || 0));
}
