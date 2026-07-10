// Contract test for src/lib/benchmark.js — runnable under Node:
//   node src/lib/benchmark.test.js
import assert from 'node:assert/strict';

const { TOPPER_TARGETS, userBenchmarks } = await import('./benchmark.js');

const CARDIO_Q = { id: 'c1', topic: 'msn', sub: 'Cardiac' };
const GK_Q = { id: 'g1', topic: 'gk', sub: 'Important Health Days' };
const OTHER_Q = { id: 'o1', topic: 'fund', sub: 'Positioning' };

// ---- brand-new user: every metric null, no crash, honest details ----
{
  const b = userBenchmarks([], {}, []);
  assert.equal(b.hasMock, false);
  for (const k of ['attemptsPer100', 'guesses', 'clinicalSpeedSec', 'mainsAccuracy']) {
    assert.equal(b[k].value, null, k);
    assert.equal(b[k].meets, null, k);
    assert.ok(b[k].detail.length > 5, k + ' has a detail line');
  }
  const bNull = userBenchmarks(null, null, null);
  assert.equal(bNull.hasMock, false);
}

// ---- attempts per 100 from the LATEST mock; meets only in 78-85 ----
{
  const mocks = [
    { ts: 1, count: 100, correct: 40, wrong: 40 },          // older: 80
    { ts: 2, count: 100, correct: 50, wrong: 45, blank: 5 } // latest: 95
  ];
  const b = userBenchmarks(mocks, {}, []);
  assert.equal(b.hasMock, true);
  assert.equal(b.attemptsPer100.value, 95);
  assert.equal(b.attemptsPer100.meets, false, '95 attempted is over-attempting');

  const good = userBenchmarks([{ count: 100, correct: 60, wrong: 20 }], {}, []);
  assert.equal(good.attemptsPer100.value, 80);
  assert.equal(good.attemptsPer100.meets, true);

  const zeroCount = userBenchmarks([{ count: 0, correct: 0, wrong: 0 }], {}, []);
  assert.equal(zeroCount.attemptsPer100.value, null, 'count=0 mock cannot divide');
}

// ---- guesses: null without ANY conf tags (never a flattering zero) ----
{
  const noTags = userBenchmarks([], { c1: { attempts: [{ correct: true }] } }, [CARDIO_Q]);
  assert.equal(noTags.guesses.value, null);

  const tagged = userBenchmarks([], {
    c1: { attempts: [{ correct: true, conf: 'sure' }, { correct: false, conf: 'guess' }, { correct: true, conf: 'guess' }] },
  }, [CARDIO_Q]);
  assert.equal(tagged.guesses.value, 2);
  assert.equal(tagged.guesses.meets, false);
  assert.match(tagged.guesses.detail, /2 of 3/);

  const zero = userBenchmarks([], { c1: { attempts: [{ correct: true, conf: 'sure' }] } }, [CARDIO_Q]);
  assert.equal(zero.guesses.value, 0);
  assert.equal(zero.guesses.meets, true);
}

// ---- clinical speed: clinical-system questions only, min 5 timed attempts ----
{
  const mk = (n, ms) => Array.from({ length: n }, () => ({ correct: true, timeMs: ms }));
  // 4 timed clinical attempts: below the minimum -> null.
  const few = userBenchmarks([], { c1: { attempts: mk(4, 40000) } }, [CARDIO_Q]);
  assert.equal(few.clinicalSpeedSec.value, null);

  // 6 timed clinical at 40s -> value 40, meets (<50).
  const fast = userBenchmarks([], { c1: { attempts: mk(6, 40000) } }, [CARDIO_Q]);
  assert.equal(fast.clinicalSpeedSec.value, 40);
  assert.equal(fast.clinicalSpeedSec.meets, true);

  // GK and unmapped 'other' questions never count toward clinical speed.
  const mixed = userBenchmarks([], {
    c1: { attempts: mk(6, 60000) },
    g1: { attempts: mk(20, 1000) },
    o1: { attempts: mk(20, 1000) },
  }, [CARDIO_Q, GK_Q, OTHER_Q]);
  assert.equal(mixed.clinicalSpeedSec.value, 60, 'gk/other 1s answers must not dilute the average');
  assert.equal(mixed.clinicalSpeedSec.meets, false);

  // Untimed attempts (timeMs null/0) are skipped.
  const untimed = userBenchmarks([], { c1: { attempts: Array.from({ length: 10 }, () => ({ correct: true, timeMs: null })) } }, [CARDIO_Q]);
  assert.equal(untimed.clinicalSpeedSec.value, null);
}

// ---- accuracy proxy: min 10 attempts; revealed skipped; >82 meets ----
{
  const mk = (n, correct) => Array.from({ length: n }, () => ({ correct }));
  const few = userBenchmarks([], { c1: { attempts: mk(9, true) } }, [CARDIO_Q]);
  assert.equal(few.mainsAccuracy.value, null);

  const strong = userBenchmarks([], { c1: { attempts: [...mk(17, true), ...mk(3, false)] } }, [CARDIO_Q]);
  assert.equal(strong.mainsAccuracy.value, 85);
  assert.equal(strong.mainsAccuracy.meets, true);

  const revealedOnly = userBenchmarks([], { c1: { attempts: Array.from({ length: 30 }, () => ({ correct: true, revealed: true })) } }, [CARDIO_Q]);
  assert.equal(revealedOnly.mainsAccuracy.value, null, 'revealed answers are not attempts');
}

// ---- targets table sanity ----
{
  assert.equal(TOPPER_TARGETS.length, 4);
  const ids = TOPPER_TARGETS.map(t => t.id);
  assert.deepEqual(ids, ['attempts', 'guesses', 'clinical', 'mains']);
  for (const t of TOPPER_TARGETS) {
    assert.ok(!/—|--/.test(t.label + t.target + t.why), 'no em dashes in user copy');
  }
}

console.log('benchmark.test.js: all passed');
