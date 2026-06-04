// [A1 slice 49 / tidy-up] Quick-practice selection — orders a question pool so a
// quick session feels fresh and useful: UNSEEN questions first (shuffled), then
// SEEN questions by descending "need" (overdue / wrong-last-time / stale rank
// high; recently-and-consistently-correct rank low). Extracted VERBATIM from
// App.jsx; pure scheduling logic (no React, no storage, no theme).
import { attemptStats, hasBeenSeen } from './compact.js';
import { shuffle } from './utils.js';

export function lastSeenTs(h) {
  // P15 — compacted records carry lastAttemptedTs directly; attemptStats
  // normalizes both shapes.
  return attemptStats(h).lastTs;
}

// Higher score → should be served sooner (only for already-seen questions).
export function quickNeedScore(h, now) {
  if (!h) return 0;
  const daysSince = (now - lastSeenTs(h)) / 86400000;
  let score = daysSince; // base: staleness, in days (older = more need)

  // Overdue for spaced review
  if (h.nextDue && new Date(h.nextDue).getTime() <= now) score += 30;
  // Missed it last time — needs another look
  if (h.lastResult === 'wrong') score += 50;

  // Consistently correct on recent attempts — lower the need...
  const recent = (h.attempts || []).slice(-3);
  const allRecentCorrect = recent.length > 0 && recent.every(a => a.correct);
  if (allRecentCorrect) {
    score -= 20;
    if (daysSince < 1) score -= 40; // ...and don't re-serve if just answered right
  }
  // Well-rehearsed items (long correct streak) drift further down
  score -= Math.min((h.reviewCount || 0) * 3, 18);

  return score;
}

export function selectQuickPracticeQuestions(pool, count, history) {
  const now = Date.now();
  const h = history || {};
  const unseen = [];
  const seen = [];
  pool.forEach(q => {
    const rec = h[q.id];
    // P15 — hasBeenSeen returns true for both Tier 2 (has attempts) and
    // Tier 3 (compacted) records.
    if (!hasBeenSeen(rec)) unseen.push(q);
    else seen.push(q);
  });
  // Fresh material first, in a varied order
  const orderedUnseen = shuffle(unseen);
  // Seen material by descending need; ties → least-recently-seen first
  const orderedSeen = seen.sort((a, b) => {
    const diff = quickNeedScore(h[b.id], now) - quickNeedScore(h[a.id], now);
    if (diff !== 0) return diff;
    return lastSeenTs(h[a.id]) - lastSeenTs(h[b.id]);
  });
  return [...orderedUnseen, ...orderedSeen].slice(0, count);
}
