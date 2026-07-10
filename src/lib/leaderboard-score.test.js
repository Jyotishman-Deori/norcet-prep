// Contract test for src/lib/leaderboard-score.js — runnable under Node:
//   node src/lib/leaderboard-score.test.js
// Pure module (only utils.weekStartStr), so no storage/DOM stubs are needed.
import assert from 'node:assert/strict';
import { weeklyGrowth, firstAttemptTotals, GROWTH_DEFAULTS } from './leaderboard-score.js';
import { weekStartStr } from './utils.js';

// Fixed "now" inside a known week so date math is deterministic.
const NOW = new Date('2026-06-30T12:00:00Z'); // a Tuesday
const WK = weekStartStr(NOW);                  // this week's Monday
const dayInWeek = (offset) =>                  // YYYY-MM-DD `offset` days from WK
  new Date(Date.parse(`${WK}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const weeksAgo = (n, off = 0) =>
  new Date(Date.parse(`${WK}T00:00:00Z`) - n * 7 * 86400000 + off * 86400000).toISOString().slice(0, 10);

// Empty history → all zero, safe.
{
  const g = weeklyGrowth([], {}, NOW);
  assert.deepEqual(g, { weeklyAnswered: 0, weeklyCorrect: 0, weeklyAccuracy: 0, growthScore: 0 });
  assert.equal(weeklyGrowth(null, {}, NOW).growthScore, 0);
}

// Only prior-week activity (nothing this week) → no current effort → 0 score.
{
  const hist = [{ date: weeksAgo(1, 1), attempted: 40, correct: 20 }];
  assert.equal(weeklyGrowth(hist, {}, NOW).growthScore, 0);
}

// THE KEY PROPERTY: a struggling-but-improving student out-scores a coasting
// expert who isn't improving this week.
{
  const improver = [
    { date: weeksAgo(2, 1), attempted: 30, correct: 9 },   // baseline ~30%
    { date: dayInWeek(0),   attempted: 40, correct: 20 },  // this week 50%
  ];
  const expert = [
    { date: weeksAgo(2, 1), attempted: 30, correct: 29 },  // baseline ~97%
    { date: dayInWeek(0),   attempted: 20, correct: 19 },  // this week ~95%, no gain
  ];
  const gi = weeklyGrowth(improver, {}, NOW);
  const ge = weeklyGrowth(expert, {}, NOW);
  assert.ok(gi.weeklyAccuracy < ge.weeklyAccuracy, 'improver has lower absolute accuracy');
  assert.ok(gi.growthScore > ge.growthScore, `improver (${gi.growthScore}) should beat coasting expert (${ge.growthScore})`);
}

// Effort is capped so raw grinding can't run away.
{
  const grind = [{ date: dayInWeek(0), attempted: 500, correct: 250 }];
  const g = weeklyGrowth(grind, {}, NOW);
  assert.ok(g.weeklyAnswered === 500, 'raw weekly count is reported faithfully');
  // growthScore effort term is capped at effortCap (no baseline → no improvement term).
  const maxEffortTerm = GROWTH_DEFAULTS.effortCap * (0.5 + 0.5 * 0.5);
  assert.ok(g.growthScore <= Math.round(maxEffortTerm) + 1, `grind score ${g.growthScore} is effort-capped`);
}

// LEADERBOARD INTEGRITY (2026-07-10): accuracy counts FIRST attempts only
// when the fresh counters are present. Re-answering questions whose answers
// were already shown boosts attempted/correct but not board accuracy.
{
  const gamer = [{
    date: dayInWeek(0),
    attempted: 100, correct: 95,          // 90 repeats of known answers
    freshAttempted: 10, freshCorrect: 5,  // real first tries: 50%
  }];
  const g = weeklyGrowth(gamer, {}, NOW);
  assert.equal(g.weeklyAnswered, 100, 'effort still counts every attempt');
  assert.ok(Math.abs(g.weeklyAccuracy - 0.5) < 1e-9, 'accuracy uses first attempts only');
}

// Legacy rows without fresh fields fall back to all-attempts accuracy.
{
  const legacy = [{ date: dayInWeek(0), attempted: 20, correct: 15 }];
  const g = weeklyGrowth(legacy, {}, NOW);
  assert.ok(Math.abs(g.weeklyAccuracy - 0.75) < 1e-9, 'pre-migration rows keep working');
}

// Mixed window (legacy + fresh rows): fresh data wins once any exists.
{
  const mixed = [
    { date: dayInWeek(0), attempted: 20, correct: 20 },                                  // legacy row
    { date: dayInWeek(1), attempted: 10, correct: 2, freshAttempted: 10, freshCorrect: 2 }, // fresh row
  ];
  const g = weeklyGrowth(mixed, {}, NOW);
  assert.ok(Math.abs(g.weeklyAccuracy - 0.2) < 1e-9, 'fresh counters dominate the transition week');
}

// Baseline uses the same rule, so improvement stays like-for-like.
{
  const hist = [
    { date: weeksAgo(2, 1), attempted: 50, correct: 45, freshAttempted: 20, freshCorrect: 8 },  // baseline fresh 40%
    { date: dayInWeek(0),   attempted: 30, correct: 12, freshAttempted: 30, freshCorrect: 18 }, // this week fresh 60%
  ];
  const g = weeklyGrowth(hist, {}, NOW);
  assert.ok(Math.abs(g.weeklyAccuracy - 0.6) < 1e-9);
  // improvement = 0.6 - 0.4 = 0.2 → visible in the score vs a no-improvement twin
  const flat = weeklyGrowth([
    { date: weeksAgo(2, 1), attempted: 50, correct: 45, freshAttempted: 20, freshCorrect: 12 }, // baseline 60%
    { date: dayInWeek(0),   attempted: 30, correct: 12, freshAttempted: 30, freshCorrect: 18 }, // week 60%
  ], {}, NOW);
  assert.ok(g.growthScore > flat.growthScore, 'first-attempt improvement is rewarded');
}

// firstAttemptTotals — the all-time Accuracy board's un-gameable base.
{
  const att = (correct, extra = {}) => ({ ts: 1, correct, ...extra });
  const history = {
    q1: { attempts: [att(true), att(false), att(false)] },      // first try right (repeats ignored)
    q2: { attempts: [att(false), att(true), att(true)] },       // first try wrong (later wins ignored)
    q3: { attempts: [att(true, { revealed: true }), att(true)] }, // revealed first -> tainted, excluded
    q4: { compacted: true, attempts: [att(true)], attemptsTotal: 40, attemptsCorrect: 39 }, // compacted -> skipped
    q5: { attempts: [] },                                        // never tried -> skipped
  };
  const t = firstAttemptTotals(history);
  assert.equal(t.attempted, 2);
  assert.equal(t.correct, 1);
  assert.ok(Math.abs(t.accuracy - 0.5) < 1e-9);
  assert.deepEqual(firstAttemptTotals(null), { attempted: 0, correct: 0, accuracy: 0 });
}

console.log('leaderboard-score.test.js: all assertions passed');
