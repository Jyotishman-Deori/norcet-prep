// =====================================================================
// PROJECTION  —  pure, dependency-free scoring math for "Where you stand"
// =====================================================================
// No React, no storage, no imports. Every function is pure so it can be unit-
// reasoned and reused (the exam-sim post-mortem and pacing report will call
// recentFullLength / percentileRank too).
//
// INPUT: the app's existing `data.advancedTestHistory` entries, each shaped
//   { ts, count, correct, wrong, blank, netScore, accuracy, ... }
// (netScore already has negative marking applied: correct − wrong/3.)
//
// We deliberately read marks-% as netScore/count×100 — the SAME unit as the
// official Mains qualifying lines — so a score can be placed directly on the
// cut-off ladder. This is "your practice marks %", NOT a predicted rank or a
// predicted exam percentile (those are not derivable from practice and we
// never claim them).
// =====================================================================

export const clampPct = (n) => Math.max(0, Math.min(100, n));
const round1 = (n) => Math.round(n * 10) / 10;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// Marks-% for a single logged attempt (negative marking already in netScore).
export function attemptPct(entry) {
  if (!entry || typeof entry.netScore !== 'number' || !entry.count) return 0;
  return clampPct((entry.netScore / entry.count) * 100);
}

// Summarise recent full-length performance.
//   opts.window  — how many recent attempts to average (default 5)
//   opts.minCount — ignore tiny runs that aren't full-length-ish (default 20)
// Returns { n, usedN, pct, low, high, best, latest } or { n: 0 } when empty.
export function recentFullLength(history, opts = {}) {
  const window = opts.window ?? 5;
  const minCount = opts.minCount ?? 20;

  const valid = (Array.isArray(history) ? history : []).filter(
    (e) => e && typeof e.netScore === 'number' && typeof e.count === 'number' && e.count >= minCount
  );
  if (valid.length === 0) return { n: 0 };

  const sorted = [...valid].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const recent = sorted.slice(0, window);
  const pcts = recent.map(attemptPct);

  return {
    n: valid.length,
    usedN: recent.length,
    pct: round1(mean(pcts)),
    low: round1(Math.min(...pcts)),
    high: round1(Math.max(...pcts)),
    best: round1(Math.max(...valid.map(attemptPct))),
    latest: round1(attemptPct(recent[0])),
  };
}

// Given a marks-% and the qualifying ladder, work out which lines are cleared
// and how far the next line up is. Pure read for the headline sentence.
//   ladder: [{ cat, pct }] in any order.
// Returns { cleared: [...], nextUp: {cat,pct}|null, gapToNext: number }.
export function qualifyingStatus(pct, ladder) {
  const sorted = [...(ladder || [])].sort((a, b) => b.pct - a.pct);
  const cleared = sorted.filter((l) => pct >= l.pct);
  // lowest line strictly above the score (the nearest one still to reach)
  const nextUp = [...sorted].reverse().find((l) => l.pct > pct) || null;
  return {
    cleared,
    nextUp,
    gapToNext: nextUp ? round1(nextUp.pct - pct) : 0,
    clearsAll: cleared.length === sorted.length,
    clearsNone: cleared.length === 0,
  };
}

// Percentile rank of `value` within `peers` (0–100), midpoint method for ties.
// Returns null when there are no peers. (Kept for the cross-user comparison
// once a shared exam-% signal exists — advanced scores are device-local today,
// so the card does not surface this yet.)
export function percentileRank(value, peers) {
  const arr = (Array.isArray(peers) ? peers : []).filter((v) => typeof v === 'number');
  if (arr.length === 0) return null;
  const below = arr.filter((v) => v < value).length;
  const equal = arr.filter((v) => v === value).length;
  return Math.round(((below + 0.5 * equal) / arr.length) * 100);
}
