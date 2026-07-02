// Contract test for src/lib/game-bests.js — runnable under Node:
//   node src/lib/game-bests.test.js
// Pure module (no I/O), so no DOM/build stubs are needed.
import assert from 'node:assert/strict';
import { normalizeBests, recordBest, bestsFor } from './game-bests.js';

// ---- normalizeBests: always an object, garbage dropped ----
assert.deepEqual(normalizeBests(null), {});
assert.deepEqual(normalizeBests(undefined), {});
assert.deepEqual(normalizeBests(42), {});
assert.deepEqual(normalizeBests('nope'), {});
assert.deepEqual(normalizeBests([1, 2, 3]), {});
{
  // Non-object game buckets and non-object entries are dropped; numbers coerced.
  const raw = {
    ward: {
      sepsis: { best: 120.7, done: true, ts: 999 },
      bad: 'not-an-object',
      partial: { best: '50' /* not finite → 0 */ },
      neg: { best: -5, done: 'yes' /* not true → false */, ts: 'x' /* → 0 */ },
    },
    junkGame: 'nope',
    emptyGame: {},                       // no valid entries → dropped
  };
  const n = normalizeBests(raw);
  assert.deepEqual(n.ward.sepsis, { best: 120, done: true, ts: 999 });
  assert.equal(n.ward.bad, undefined);
  assert.deepEqual(n.ward.partial, { best: 0, done: false, ts: 0 });
  assert.deepEqual(n.ward.neg, { best: 0, done: false, ts: 0 });
  assert.equal(n.junkGame, undefined);
  assert.equal(n.emptyGame, undefined);
}

// ---- recordBest: max, done-sticks, ts (injected now), immutability ----
{
  const t0 = 1000, t1 = 2000, t2 = 3000;
  let bests = {};

  // First loss: best captured, done stays false.
  bests = recordBest(bests, 'ward', 'sepsis', { score: 80, outcome: 'lost' }, t0);
  assert.deepEqual(bests.ward.sepsis, { best: 80, done: false, ts: t0 });

  // Higher score → best rises; ts updates.
  const before = bests;
  bests = recordBest(bests, 'ward', 'sepsis', { score: 140, outcome: 'lost' }, t1);
  assert.deepEqual(bests.ward.sepsis, { best: 140, done: false, ts: t1 });
  assert.notEqual(bests, before, 'recordBest must return a NEW object');
  assert.deepEqual(before.ward.sepsis, { best: 80, done: false, ts: t0 }, 'input must not be mutated');

  // A WIN sticks done:true even when the score is LOWER than the best.
  bests = recordBest(bests, 'ward', 'sepsis', { score: 30, outcome: 'won' }, t2);
  assert.deepEqual(bests.ward.sepsis, { best: 140, done: true, ts: t2 });

  // A later loss must NOT un-set done.
  bests = recordBest(bests, 'ward', 'sepsis', { score: 10, outcome: 'lost' }, t2 + 1);
  assert.equal(bests.ward.sepsis.done, true);
  assert.equal(bests.ward.sepsis.best, 140);

  // A different item under the same game coexists.
  bests = recordBest(bests, 'ward', 'stroke', { score: 55, outcome: 'won' }, t2 + 2);
  assert.deepEqual(bests.ward.stroke, { best: 55, done: true, ts: t2 + 2 });
  assert.equal(bests.ward.sepsis.best, 140, 'sibling item untouched');
}

// ---- recordBest guards: bad ids are a no-op (returns normalized input) ----
{
  const base = recordBest({}, 'ward', 'sepsis', { score: 10, outcome: 'won' }, 1);
  assert.deepEqual(recordBest(base, '', 'x', { score: 99 }, 2).ward, base.ward);
  assert.deepEqual(recordBest(base, 'ward', '', { score: 99 }, 2).ward, base.ward);
  // Missing score → treated as 0, still records the play.
  const r = recordBest({}, 'ward', 'x', { outcome: 'won' }, 5);
  assert.deepEqual(r.ward.x, { best: 0, done: true, ts: 5 });
}

// ---- bestsFor: never null ----
{
  assert.deepEqual(bestsFor(null, 'ward'), {});
  assert.deepEqual(bestsFor({}, 'missing'), {});
  const b = recordBest({}, 'ward', 'sepsis', { score: 7, outcome: 'lost' }, 1);
  assert.deepEqual(bestsFor(b, 'ward'), { sepsis: { best: 7, done: false, ts: 1 } });
  assert.deepEqual(bestsFor(b, 'other-game'), {});
}

console.log('game-bests.test.js: all assertions passed');
