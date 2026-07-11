// Contract test for src/lib/repeat-unattempted.js — runnable under Node:
//   node src/lib/repeat-unattempted.test.js
//
// This module shipped untested because a top-level safe-storage import made it
// un-importable under Node. That import is now lazy, so the pure B2 algorithm is
// finally covered here: the original nextPool/partitionByRepeat contract, plus
// the abandoned-run helpers.
import assert from 'node:assert/strict';
import {
  MAX_POOL, nextPool, partitionByRepeat, reachedIds, abandonedRunInputs,
} from './repeat-unattempted.js';

// ---- nextPool: the existing fold (unchanged behaviour) ----
{
  // presented + no result + not skipped -> ADDED (saw it, never engaged)
  assert.deepEqual(
    nextPool([], { presentedIds: ['a', 'b', 'c'], resultIds: ['a'], skippedIds: ['b'] }),
    ['c'], 'only the untouched one is queued to repeat');

  // answered/revealed -> DROPPED from an existing pool
  assert.deepEqual(
    nextPool(['c', 'd'], { presentedIds: ['c'], resultIds: ['c'], skippedIds: [] }),
    ['d'], 'answering a pooled question removes it');

  // actively skipped -> DROPPED (a deliberate choice, not "ran out of time")
  assert.deepEqual(
    nextPool(['c'], { presentedIds: ['c'], resultIds: [], skippedIds: ['c'] }),
    [], 'skipping a pooled question removes it');

  // a question NOT presented this run is left alone
  assert.deepEqual(
    nextPool(['x'], { presentedIds: ['a'], resultIds: ['a'], skippedIds: [] }),
    ['x'], 'untouched pool entries survive');

  // set semantics: re-adding an already-pooled id does not duplicate it
  assert.deepEqual(
    nextPool(['c'], { presentedIds: ['c'], resultIds: [], skippedIds: [] }),
    ['c'], 'no duplicates');

  // empty run is a no-op; defaults are safe
  assert.deepEqual(nextPool(['a'], {}), ['a']);
  assert.deepEqual(nextPool(null, { presentedIds: ['a'] }), ['a']);
}

// ---- partitionByRepeat: pooled questions come first, order preserved ----
{
  const q = (id) => ({ id });
  const pool = [q('a'), q('b'), q('c'), q('d')];
  const { toRepeat, rest } = partitionByRepeat(pool, ['c', 'a']);
  assert.deepEqual(toRepeat.map(x => x.id), ['a', 'c'], 'repeats keep pool order');
  assert.deepEqual(rest.map(x => x.id), ['b', 'd'], 'rest keeps pool order');
  // no repeat ids -> everything is "rest"
  assert.deepEqual(partitionByRepeat(pool, []).rest.length, 4);
  assert.deepEqual(partitionByRepeat(pool, null).toRepeat.length, 0);
}

assert.equal(MAX_POOL, 500, 'the unbounded-growth cap is still in place');

// ---- reachedIds: an ABANDONED run folds ONLY what the user actually saw ----
{
  const order = ['q1', 'q2', 'q3', 'q4', 'q5'];

  // stopped on q3 (index 2), answered q1+q2 -> reached q1..q3 only
  assert.deepEqual(
    reachedIds({ orderedIds: order, index: 2, resultIds: ['q1', 'q2'], skippedIds: [] }),
    ['q1', 'q2', 'q3'], 'q4/q5 were never displayed, so they are not "reached"');

  // a SKIPPED question is re-queued to the end, so position alone would miss it
  assert.deepEqual(
    reachedIds({ orderedIds: ['q2', 'q3', 'q1'], index: 0, resultIds: [], skippedIds: ['q1'] }).sort(),
    ['q1', 'q2'], 'the skipped id is still counted as reached');

  // first question, nothing done yet
  assert.deepEqual(reachedIds({ orderedIds: order, index: 0 }), ['q1']);

  // index past the end is clamped; defaults never throw
  assert.deepEqual(reachedIds({ orderedIds: ['a'], index: 99 }), ['a']);
  assert.deepEqual(reachedIds({}), []);
  assert.deepEqual(reachedIds(), []);
  // no duplicates even when a result id is also within the reached span
  assert.deepEqual(reachedIds({ orderedIds: ['a', 'b'], index: 1, resultIds: ['a', 'b'] }), ['a', 'b']);
}

// ---- abandonedRunInputs: snapshot -> the exact inputs nextPool already takes ----
{
  const snap = {
    mode: 'topic',
    questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
    results: [{ qId: 'q1', correct: true }, { qId: 'q2', correct: false }],
    skipped: [],
    index: 2,
  };
  const inputs = abandonedRunInputs(snap);
  assert.deepEqual(inputs.presentedIds, ['q1', 'q2', 'q3']);
  assert.deepEqual(inputs.resultIds, ['q1', 'q2']);
  assert.deepEqual(inputs.skippedIds, []);

  // folding it: q1/q2 answered -> not pooled; q3 was seen but never engaged -> pooled
  assert.deepEqual(nextPool([], inputs), ['q3'], 'only the seen-but-unattempted one repeats');

  // malformed / missing snapshot degrades to a no-op
  assert.deepEqual(abandonedRunInputs(null), { presentedIds: [], resultIds: [], skippedIds: [] });
  assert.deepEqual(abandonedRunInputs({}).presentedIds, []);
  // a snapshot without the (newer) `skipped` field reads as []
  assert.deepEqual(abandonedRunInputs({ questionIds: ['a'], results: [], index: 0 }).skippedIds, []);
}

// ---- THE regression this whole change exists to prevent ----
// A bailed 50-question Mock must NOT dump the 42 questions the user never saw
// into the pool. Only the one they reached and left unattempted goes in.
{
  const ids = Array.from({ length: 50 }, (_, i) => `m${i + 1}`);
  const snap = {
    mode: 'mock',
    questionIds: ids,
    results: ids.slice(0, 8).map((qId) => ({ qId })),  // answered the first 8
    skipped: [],
    index: 8,                                          // sitting on m9, unanswered
  };
  const pooled = nextPool([], abandonedRunInputs(snap));
  assert.deepEqual(pooled, ['m9'], 'exactly the one question they saw and left');
  assert.equal(pooled.length, 1, 'NOT the 42 questions that were never displayed');
}

// ---- end-to-end: abandon -> pooled -> resume + finish -> dropped again ----
{
  const order = ['q1', 'q2', 'q3', 'q4'];
  // 1. abandon after answering q1, sitting on q2
  let pool = nextPool([], abandonedRunInputs({
    questionIds: order, results: [{ qId: 'q1' }], skipped: [], index: 1,
  }));
  assert.deepEqual(pool, ['q2'], 'q2 was seen but unattempted -> queued to repeat');

  // 2. the user resumes and FINISHES the run. completeQuiz folds the whole set
  //    (a finished run really did present everything), and every id now has a
  //    result -> the pool self-heals.
  pool = nextPool(pool, {
    presentedIds: order,
    resultIds: order,          // all four answered
    skippedIds: [],
  });
  assert.deepEqual(pool, [], 'finishing the run clears its questions from the pool');
}

console.log('repeat-unattempted.test.js: all passed');
