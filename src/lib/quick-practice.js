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

// ── #20 — topic-BALANCED selection (the smart Quick Test "black box") ──────
// Allocates `count` slots across topics in proportion to `weights` (the exam
// weightage distribution), then fills each topic from the SAME unseen-first /
// by-need ordering used above — so a Quick Test mirrors the real exam's topic
// mix while still surfacing fresh, high-value questions and never repeating
// across sessions until the bank is exhausted (#21). Topics that run short
// spill their unmet slots into a global unseen-first fill, and the final list
// is shuffled so it never reads as topic-grouped. Falls back to plain
// unseen-first when no usable weightage signal is supplied.

// Largest-remainder allocation of `count` slots across weighted topics.
function allocateByWeight(topicWeights, count) {
  const entries = Object.entries(topicWeights).filter(([, w]) => w > 0);
  const totalW = entries.reduce((a, [, w]) => a + w, 0);
  if (totalW <= 0 || entries.length === 0 || count <= 0) return {};
  const raw = entries.map(([t, w]) => ({ t, exact: (w / totalW) * count }));
  const alloc = {};
  let assigned = 0;
  raw.forEach(r => { alloc[r.t] = Math.floor(r.exact); assigned += alloc[r.t]; });
  raw.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
  let i = 0;
  while (assigned < count && raw.length > 0) { alloc[raw[i % raw.length].t] += 1; assigned += 1; i += 1; }
  return alloc;
}

export function selectBalancedQuestions(pool, count, weights, history) {
  const h = history || {};
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const n = Math.min(count, pool.length);

  // Restrict the weight map to topics actually present in the pool.
  const byTopic = {};
  pool.forEach(q => { (byTopic[q.topic] = byTopic[q.topic] || []).push(q); });
  const usable = {};
  Object.keys(byTopic).forEach(t => { if (weights && weights[t] > 0) usable[t] = weights[t]; });
  // No weightage signal → plain unseen-first across the whole pool.
  if (Object.keys(usable).length === 0) return selectQuickPracticeQuestions(pool, n, h);

  // Pre-order each topic's pool once (unseen-first, then by need).
  const orderedByTopic = {};
  Object.keys(byTopic).forEach(t => { orderedByTopic[t] = selectQuickPracticeQuestions(byTopic[t], byTopic[t].length, h); });

  const alloc = allocateByWeight(usable, n);
  const picked = [];
  const used = new Set();
  const perTopicTaken = {};
  Object.keys(alloc).forEach(t => {
    const want = alloc[t];
    const list = orderedByTopic[t] || [];
    perTopicTaken[t] = 0;
    for (let i = 0; i < list.length && perTopicTaken[t] < want; i++) {
      if (!used.has(list[i].id)) { picked.push(list[i]); used.add(list[i].id); perTopicTaken[t] += 1; }
    }
  });
  // Fill any shortfall (a topic ran out, or rounding left slots) from a global
  // unseen-first ordering of whatever's left.
  if (picked.length < n) {
    const rest = selectQuickPracticeQuestions(pool.filter(q => !used.has(q.id)), n - picked.length, h);
    rest.forEach(q => { if (!used.has(q.id)) { picked.push(q); used.add(q.id); } });
  }
  return shuffle(picked).slice(0, n);
}
