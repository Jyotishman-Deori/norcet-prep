// Contract test for src/lib/trending.js — runnable under Node:
//   node src/lib/trending.test.js
// Pure module (no I/O), so no DOM/build stubs are needed.
import assert from 'node:assert/strict';
import { surgeScore, qualityMultiplier, rankTrending, TRENDING_DEFAULTS } from './trending.js';

// ---- surgeScore (velocity) ----
assert.equal(surgeScore([1, 0, 0, 0, 0, 0, 0]), 0);          // total 1 < minTotal 3
assert.equal(surgeScore([]), 0);
assert.equal(surgeScore([0, 0, 0, 0, 0, 0, 0]), 0);
assert.equal(surgeScore(null), 0);
{
  const s = surgeScore([5, 1, 2, 1, 3, 1, 2]);
  assert.ok(s > 1, `expected strong surge, got ${s}`);
}
{
  // Safe division: flat baseline, today beats it → flatBonus, no NaN/Infinity.
  const s = surgeScore([5, 0, 0, 0, 0, 0, 0]);
  assert.equal(s, TRENDING_DEFAULTS.flatBonus);
  assert.ok(Number.isFinite(s));
}
{
  const s = surgeScore([2, 5, 1, 1, 1, 1, 1]); // peak yesterday → decayed
  assert.ok(s < TRENDING_DEFAULTS.zCutoff, `expected cooled score < cutoff, got ${s}`);
}
assert.equal(surgeScore([0, 4, 4, 4, 4, 4, 4]), 0);          // below baseline

// ---- qualityMultiplier (completion depth / bounce guardrail) ----
{
  // Too few opens to judge → neutral (don't punish a brand-new item).
  assert.equal(qualityMultiplier([2, 0, 0], [0, 0, 0]), 1);
  // Perfect completion → neutral (full weight).
  assert.equal(qualityMultiplier([10, 0], [10, 0]), 1);
  // High bounce (≤20% completion) → aggressive penalty (Spec 1 guardrail).
  assert.equal(qualityMultiplier([10, 0], [1, 0]), TRENDING_DEFAULTS.bouncePenalty);
  // Mid completion → between floor and 1.
  const mid = qualityMultiplier([10, 0], [5, 0]);            // 50% completion
  assert.ok(mid > TRENDING_DEFAULTS.bouncePenalty && mid < 1, `mid quality ${mid}`);
  // Safe divide: zero opens never throws / NaNs.
  assert.equal(qualityMultiplier([0], [0]), 1);
}

// ---- rankTrending (surge × quality, completable gate) ----
{
  // A spike of empty opens (high bounce) must NOT out-rank a smaller, fully
  // completed surge — the guardrail demotes the influencer-style spike.
  const items = [
    { id: 'spike', completable: true },   // big opens, almost no completes
    { id: 'solid', completable: true },   // smaller opens, all completed
    { id: 'map', completable: false },    // not completable → quality neutral
  ];
  const stats = {
    spike: { opens: [12, 1, 1, 1, 1, 1, 1], completes: [0, 0, 0, 0, 0, 0, 0] },
    solid: { opens: [6, 1, 1, 1, 1, 1, 1], completes: [6, 1, 1, 1, 1, 1, 1] },
    map:   { opens: [6, 1, 1, 1, 1, 1, 1], completes: [0, 0, 0, 0, 0, 0, 0] },
  };
  const ranked = rankTrending(items, stats, { topN: 3 });
  assert.deepEqual(ranked.map(x => x.id), ['spike', 'solid', 'map']); // original order
  const score = (id) => ranked.find(x => x.id === id).trendScore;
  assert.ok(score('solid') > score('spike'), 'high-bounce spike must be demoted below the completed surge');
  // The non-completable map keeps full surge weight (no penalty).
  assert.ok(score('map') > score('spike'), 'non-completable item is not bounce-penalized');
}

// topN cap respected even when several qualify.
{
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const surge = { opens: [6, 1, 1, 1, 1, 1, 1], completes: [] };
  const ranked = rankTrending(items, { a: surge, b: surge, c: surge }, { topN: 2 });
  assert.equal(ranked.filter(x => x.isTrending).length, 2);
}

console.log('trending.test.js: all assertions passed');
