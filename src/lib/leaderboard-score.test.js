// Contract test for src/lib/leaderboard-score.js — runnable under Node:
//   node src/lib/leaderboard-score.test.js
// Pure module (only utils.weekStartStr), so no storage/DOM stubs are needed.
import assert from 'node:assert/strict';
import { weeklyGrowth, GROWTH_DEFAULTS } from './leaderboard-score.js';
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

console.log('leaderboard-score.test.js: all assertions passed');
