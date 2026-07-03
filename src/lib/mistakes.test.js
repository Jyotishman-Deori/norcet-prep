// Contract test for src/lib/mistakes.js — runnable under Node:
//   node src/lib/mistakes.test.js
// Pure module (history in → mistake records out); no stubs needed.
import assert from 'node:assert/strict';
import { buildMistakes, unresolvedCount, orderMistakeQueue, RESOLVE_STREAK } from './mistakes.js';

const NOW = 1783100000000;
const DAY = 86400000;

const Q = (id, topic = 'fund') => ({
  id, topic, q: 'stem ' + id,
  options: ['A', 'B', 'C', 'D'], correct: [0],
  exp: 'because A', wrong: { 1: 'B is wrong because…' },
});
const QUESTIONS = [Q('q1'), Q('q2'), Q('q3'), Q('q4'), Q('q5')];

const att = (over) => ({ ts: NOW - DAY, correct: false, timeMs: 4000, pick: [1], ...over });

// ---- basic derivation: only ever-wrong questions become mistakes ----
{
  const history = {
    q1: { attempts: [att({}), att({ ts: NOW - DAY / 2, pick: [2] })], reviewCount: 0, nextDue: null, lastResult: 'wrong' },
    q2: { attempts: [att({ correct: true, pick: [0] })], reviewCount: 1, nextDue: null, lastResult: 'right' }, // never wrong
    // q3 never attempted
  };
  const m = buildMistakes(history, QUESTIONS, NOW);
  assert.equal(m.length, 1);
  assert.equal(m[0].qId, 'q1');
  assert.equal(m[0].failCount, 2);
  assert.deepEqual(m[0].lastPick, [2], 'lastPick = the MOST RECENT wrong attempt’s pick');
  assert.equal(m[0].resolved, false);
  assert.equal(m[0].question.options[0], 'A', 'joined to the full question object');
}

// ---- revealed attempts are neutral: never create a mistake ----
{
  const history = { q1: { attempts: [att({ revealed: true, correct: false, pick: [] })], reviewCount: 0, lastResult: null } };
  assert.equal(buildMistakes(history, QUESTIONS, NOW).length, 0);
}

// ---- resolved rule: lastResult right AND reviewCount >= RESOLVE_STREAK ----
{
  const mk = (reviewCount, lastResult) => ({
    q1: { attempts: [att({}), att({ correct: true, pick: [0] }), att({ correct: true, pick: [0] })], reviewCount, lastResult },
  });
  assert.equal(buildMistakes(mk(RESOLVE_STREAK, 'right'), QUESTIONS, NOW)[0].resolved, true);
  assert.equal(buildMistakes(mk(RESOLVE_STREAK - 1, 'right'), QUESTIONS, NOW)[0].resolved, false, 'one right is not fixed yet');
  assert.equal(buildMistakes(mk(RESOLVE_STREAK, 'wrong'), QUESTIONS, NOW)[0].resolved, false, 'a later wrong un-resolves');
}

// ---- compacted records: counts from attemptStats, pick from the tail ----
{
  const history = {
    q1: {
      compacted: true, attemptsTotal: 10, attemptsCorrect: 6, lastAttemptedTs: NOW - 40 * DAY,
      attempts: [ // 5-attempt tail, pick preserved by compact.js
        { ts: NOW - 42 * DAY, correct: false, revealed: false, timeMs: 3000, pick: [3] },
        { ts: NOW - 41 * DAY, correct: true, revealed: false, timeMs: 3000 },
      ],
      reviewCount: 1, nextDue: null, lastResult: 'right',
    },
  };
  const m = buildMistakes(history, QUESTIONS, NOW);
  assert.equal(m[0].failCount, 4, 'attemptsTotal - attemptsCorrect');
  assert.deepEqual(m[0].lastPick, [3]);
  assert.equal(m[0].resolved, false, 'reviewCount 1 < streak');
}
// compacted with NO wrong attempt left in the tail → lastWrongTs falls back
{
  const history = {
    q1: {
      compacted: true, attemptsTotal: 8, attemptsCorrect: 5, lastAttemptedTs: NOW - 3 * DAY,
      attempts: [{ ts: NOW - 3 * DAY, correct: true, revealed: false, timeMs: 1000 }],
      reviewCount: 1, lastResult: 'right',
    },
  };
  const m = buildMistakes(history, QUESTIONS, NOW)[0];
  assert.equal(m.lastWrongTs, NOW - 3 * DAY, 'falls back to lastAttemptedTs');
  assert.deepEqual(m.lastPick, [], 'unknown pick degrades to empty');
}

// ---- weight: failCount + recency boost (7d: +2, 30d: +1) ----
{
  const history = {
    q1: { attempts: [att({ ts: NOW - 2 * DAY })], reviewCount: 0, lastResult: 'wrong' },          // 1 + 2
    q2: { attempts: [att({ ts: NOW - 20 * DAY })], reviewCount: 0, lastResult: 'wrong' },         // 1 + 1
    q3: { attempts: [att({ ts: NOW - 90 * DAY })], reviewCount: 0, lastResult: 'wrong' },         // 1 + 0
  };
  const by = Object.fromEntries(buildMistakes(history, QUESTIONS, NOW).map(m => [m.qId, m.weight]));
  assert.equal(by.q1, 3); assert.equal(by.q2, 2); assert.equal(by.q3, 1);
}

// ---- unresolvedCount ----
{
  const history = {
    q1: { attempts: [att({})], reviewCount: 0, lastResult: 'wrong' },
    q2: { attempts: [att({}), att({ correct: true }), att({ correct: true })], reviewCount: 2, lastResult: 'right' },
  };
  const m = buildMistakes(history, QUESTIONS, NOW);
  assert.equal(m.length, 2);
  assert.equal(unresolvedCount(m), 1);
  assert.equal(unresolvedCount([]), 0);
  assert.equal(unresolvedCount(null), 0);
}

// ---- queue ordering: due-now first, then weight, then recency; resolved excluded ----
{
  const dueISO = new Date(NOW - DAY).toISOString();     // due
  const laterISO = new Date(NOW + 5 * DAY).toISOString(); // not due
  const history = {
    q1: { attempts: [att({ ts: NOW - 60 * DAY })], reviewCount: 0, lastResult: 'wrong', nextDue: dueISO },      // due, weight 1
    q2: { attempts: [att({ ts: NOW - DAY }), att({ ts: NOW - DAY / 2 })], reviewCount: 0, lastResult: 'wrong', nextDue: laterISO }, // not due, weight 4
    q3: { attempts: [att({ ts: NOW - 2 * DAY })], reviewCount: 0, lastResult: 'wrong', nextDue: laterISO },     // not due, weight 3
    q4: { attempts: [att({}), att({ correct: true }), att({ correct: true })], reviewCount: 2, lastResult: 'right', nextDue: laterISO }, // resolved
  };
  const queue = orderMistakeQueue(buildMistakes(history, QUESTIONS, NOW), NOW);
  assert.deepEqual(queue.map(m => m.qId), ['q1', 'q2', 'q3'], 'due first, then weight; resolved q4 excluded');
}

// ---- degenerate inputs ----
assert.deepEqual(buildMistakes(null, QUESTIONS), []);
assert.deepEqual(buildMistakes({}, null), []);
assert.deepEqual(orderMistakeQueue(null), []);

console.log('mistakes.test.js: all passed');
