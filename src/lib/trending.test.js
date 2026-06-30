// Contract test for src/lib/trending.js — runnable under Node:
//   node src/lib/trending.test.js
// Pure module (no I/O), so no DOM/build stubs are needed.
import assert from 'node:assert/strict';
import { surgeScore, rankTrending, TRENDING_DEFAULTS } from './trending.js';

// Below the minimum total → never trends (kills 0→1 noise).
assert.equal(surgeScore([1, 0, 0, 0, 0, 0, 0]), 0);          // total 1 < minTotal 3
assert.equal(surgeScore([]), 0);
assert.equal(surgeScore([0, 0, 0, 0, 0, 0, 0]), 0);
assert.equal(surgeScore(null), 0);

// Clear surge: a spike today over a varied baseline → strong positive score.
{
  const s = surgeScore([5, 1, 2, 1, 3, 1, 2]);
  assert.ok(s > 1, `expected strong surge, got ${s}`);
}

// Safe division: flat (zero-variance) baseline but today beats it → flatBonus,
// no NaN/Infinity. Peak is today so decay = 1.
{
  const s = surgeScore([5, 0, 0, 0, 0, 0, 0]);
  assert.equal(s, TRENDING_DEFAULTS.flatBonus);
  assert.ok(Number.isFinite(s));
}

// Cooling item: peak was yesterday, today is low → decayed, below cutoff.
{
  const s = surgeScore([2, 5, 1, 1, 1, 1, 1]);
  assert.ok(s < TRENDING_DEFAULTS.zCutoff, `expected cooled score < cutoff, got ${s}`);
}

// Today below baseline → not trending.
assert.equal(surgeScore([0, 4, 4, 4, 4, 4, 4]), 0);

// rankTrending: flags only top-N over the cutoff, preserves input order, and
// annotates every item with a flag.
{
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const counts = {
    a: [5, 1, 2, 1, 3, 1, 2],   // strong surge
    b: [1, 0, 0, 0, 0, 0, 0],   // below minTotal
    c: [0, 0, 0, 0, 0, 0, 0],   // dead
  };
  const ranked = rankTrending(items, counts, { topN: 1 });
  assert.deepEqual(ranked.map(x => x.id), ['a', 'b', 'c']); // original order
  assert.equal(ranked.find(x => x.id === 'a').isTrending, true);
  assert.equal(ranked.find(x => x.id === 'b').isTrending, false);
  assert.equal(ranked.find(x => x.id === 'c').isTrending, false);
  assert.ok(ranked.every(x => typeof x.trendScore === 'number'));
}

// topN cap is respected even when several items qualify.
{
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const surge = [6, 1, 1, 1, 1, 1, 1];
  const ranked = rankTrending(items, { a: surge, b: surge, c: surge }, { topN: 2 });
  assert.equal(ranked.filter(x => x.isTrending).length, 2);
}

console.log('trending.test.js: all assertions passed');
