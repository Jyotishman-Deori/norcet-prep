// Contract test for src/lib/test-session.js — runnable under Node:
//   node src/lib/test-session.test.js
import assert from 'node:assert/strict';
import {
  SNAPSHOT_VERSION, RESUMABLE_MODES, STALE_MS,
  isResumable, buildSnapshot, isStale, isValidSnapshot, modeLabel, summarize,
  nextUnansweredIndex,
} from './test-session.js';

// ---- isResumable: untimed practice only; timed + exam modes excluded ----
assert.equal(isResumable('quick', false), true);
assert.equal(isResumable('topic', false), true);
assert.equal(isResumable('weak-topic', false), true);
assert.equal(isResumable('bookmarks', false), true);
assert.equal(isResumable('review-due', false), true);
assert.equal(isResumable('wrong', false), true);
// timed always wins, even for an otherwise-resumable mode
assert.equal(isResumable('quick', true), false, 'timed practice is never resumable');
// the timed Mock and the exam simulation are never resumable
assert.equal(isResumable('mock', false), false, 'Mock is timed / not resumable');
assert.equal(isResumable('mock', true), false);
assert.equal(isResumable('advanced', false), false);
assert.equal(isResumable(undefined, false), false);
// the set matches the exported constant (no drift)
assert.deepEqual([...RESUMABLE_MODES].sort(),
  ['bookmarks', 'quick', 'review-due', 'topic', 'weak-topic', 'wrong']);

// ---- buildSnapshot shapes a versioned record ----
{
  const now = Date.UTC(2026, 6, 12, 10, 0, 0);
  const snap = buildSnapshot({
    mode: 'topic',
    questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
    results: [{ qId: 'q1', correct: true }, { qId: 'q2', correct: false }],
    index: 2, elapsed: 84, startedAt: now - 60000, now,
  });
  assert.equal(snap.v, SNAPSHOT_VERSION);
  assert.equal(snap.kind, 'quiz');
  assert.equal(snap.mode, 'topic');
  assert.deepEqual(snap.questionIds, ['q1', 'q2', 'q3', 'q4', 'q5']);
  assert.equal(snap.results.length, 2);
  assert.equal(snap.index, 2);
  assert.equal(snap.elapsed, 84);
  assert.equal(snap.startedAt, now - 60000);
  assert.equal(snap.ts, now);
  // questionIds is copied, not aliased (mutating the source can't corrupt the snap)
  const src = ['a', 'b'];
  const s2 = buildSnapshot({ mode: 'quick', questionIds: src, results: [], index: 0 });
  src.push('c');
  assert.deepEqual(s2.questionIds, ['a', 'b'], 'questionIds snapshot is a copy');
  // defensive defaults
  const s3 = buildSnapshot({});
  assert.deepEqual(s3.questionIds, []);
  assert.equal(s3.index, 0);
  assert.equal(s3.mode, 'quick');
  assert.equal(typeof s3.ts, 'number');
}

// ---- isStale / isValidSnapshot: age + shape gating ----
{
  const now = 1_000_000_000_000;
  const fresh = buildSnapshot({ mode: 'quick', questionIds: ['a'], results: [], index: 0, now });
  assert.equal(isStale(fresh, now), false);
  assert.equal(isStale(fresh, now + STALE_MS - 1), false, 'just inside the window');
  assert.equal(isStale(fresh, now + STALE_MS + 1), true, 'just past the window');
  assert.equal(isStale(null, now), true);
  assert.equal(isStale({}, now), true, 'malformed = stale');
  assert.equal(isStale({ questionIds: [], ts: now }, now), false, 'shape ok even if empty');

  assert.equal(isValidSnapshot(fresh, now), true);
  // empty run is not worth surfacing
  const empty = buildSnapshot({ mode: 'quick', questionIds: [], results: [], index: 0, now });
  assert.equal(isValidSnapshot(empty, now), false, 'empty run not offered');
  // stale run is not offered
  assert.equal(isValidSnapshot(fresh, now + STALE_MS + 1), false);
  // a snapshot carrying a non-resumable mode is refused (defence in depth)
  const bad = { ...fresh, mode: 'mock' };
  assert.equal(isValidSnapshot(bad, now), false, 'a mock snapshot is never surfaced');
}

// ---- modeLabel / summarize ----
{
  assert.equal(modeLabel('topic'), 'Topic practice');
  assert.equal(modeLabel('review-due'), 'Revision due');
  assert.equal(modeLabel('nonsense'), 'Practice session', 'unknown mode falls back');

  const now = 2_000_000;
  const snap = buildSnapshot({
    mode: 'topic', questionIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    results: [{ qId: 'a', correct: true }, { qId: 'b' }, { qId: 'c' }, { qId: 'd' }, { qId: 'e' }, { qId: 'f' }],
    index: 6, elapsed: 0, now,
  });
  const sum = summarize(snap, now + 5000);
  assert.equal(sum.label, 'Topic practice');
  assert.equal(sum.answered, 6);
  assert.equal(sum.total, 10);
  assert.equal(sum.index, 6);
  assert.equal(sum.ageMs, 5000);
  assert.equal(summarize(null), null);
}

// ---- nextUnansweredIndex: where a resumed run lands ----
{
  const ids = ['a', 'b', 'c', 'd', 'e'];
  // three answered in order -> land on the 4th (index 3)
  assert.equal(nextUnansweredIndex(ids, [{ qId: 'a' }, { qId: 'b' }, { qId: 'c' }]), 3);
  // nothing answered -> the first question
  assert.equal(nextUnansweredIndex(ids, []), 0);
  // THE key case: closed while viewing an answered question's explanation. The
  // saved index pointed at 'c' (answered), but we must skip to the first
  // unanswered ('d' = index 3), never re-serving 'c'.
  assert.equal(nextUnansweredIndex(ids, [{ qId: 'a' }, { qId: 'b' }, { qId: 'c' }]), 3);
  // answered out of order (skips) -> first id with no answer wins
  assert.equal(nextUnansweredIndex(ids, [{ qId: 'a' }, { qId: 'c' }]), 1, "'b' is the first gap");
  // all answered -> clamps to the last position (completion normally clears the snap)
  assert.equal(nextUnansweredIndex(ids, ids.map((qId) => ({ qId }))), ids.length - 1);
  // defensive: empty / malformed
  assert.equal(nextUnansweredIndex([], []), 0);
  assert.equal(nextUnansweredIndex(ids, null), 0);
  assert.equal(nextUnansweredIndex(null, null), 0);
}

console.log('test-session.test.js: all passed');
