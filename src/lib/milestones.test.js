// Contract test for src/lib/milestones.js — runnable under Node:
//   node src/lib/milestones.test.js
import assert from 'node:assert/strict';
import {
  recordMilestone, crossedStreakMilestones, buildActivityFeed,
  levelUpMilestone, masteryMilestone, streakMilestone,
  MILESTONE_CAP, STREAK_MILESTONES,
} from './milestones.js';

const NOW = 1783100000000;
const DAY = 86400000;

// ---- recordMilestone: append, immutable, dedupe by id, malformed no-op ----
{
  const a = recordMilestone([], levelUpMilestone(3), NOW);
  assert.equal(a.length, 1);
  assert.equal(a[0].id, 'level-up:3');
  assert.equal(a[0].ts, NOW);
  assert.equal(a[0].label, 'Reached Level 3');

  const b = recordMilestone(a, levelUpMilestone(3), NOW + 1000);
  assert.equal(b, a, 'duplicate id is a no-op (same reference)');

  const c = recordMilestone(a, masteryMilestone('pharm', 'mastered', 'Pharmacology'), NOW + 1);
  assert.equal(c.length, 2);
  assert.equal(a.length, 1, 'input list untouched (immutable)');

  assert.equal(recordMilestone(a, null, NOW), a);
  assert.equal(recordMilestone(a, { type: 'x' }, NOW), a, 'missing id is a no-op');
  assert.equal(recordMilestone(null, levelUpMilestone(1), NOW).length, 1, 'null list tolerated');
}

// ---- cap: oldest dropped ----
{
  let list = [];
  for (let i = 0; i < MILESTONE_CAP + 10; i++) {
    list = recordMilestone(list, levelUpMilestone(i), NOW + i);
  }
  assert.equal(list.length, MILESTONE_CAP);
  assert.equal(list[0].id, 'level-up:10', 'oldest 10 dropped');
}

// ---- streak milestone ids recur per date, dedupe within a date ----
{
  let list = recordMilestone([], streakMilestone(7, '2026-07-03'), NOW);
  list = recordMilestone(list, streakMilestone(7, '2026-07-03'), NOW + 5);
  assert.equal(list.length, 1, 'same day dedupes');
  list = recordMilestone(list, streakMilestone(7, '2026-09-01'), NOW + DAY);
  assert.equal(list.length, 2, 'a later re-achievement logs again');
}

// ---- crossedStreakMilestones ----
assert.deepEqual(crossedStreakMilestones(6, 7), [7]);
assert.deepEqual(crossedStreakMilestones(2, 3), [3]);
assert.deepEqual(crossedStreakMilestones(7, 8), []);
assert.deepEqual(crossedStreakMilestones(2, 14), [3, 7, 14], 'skips are all reported');
assert.deepEqual(crossedStreakMilestones(5, 5), []);
assert.deepEqual(crossedStreakMilestones(9, 3), [], 'reset crosses nothing');
assert.ok(STREAK_MILESTONES.includes(30));

// ---- buildActivityFeed: merges all sources newest-first ----
{
  const milestones = [
    { id: 'level-up:2', type: 'level-up', ts: NOW - 3 * DAY, label: 'Reached Level 2', meta: {} },
    { id: 'streak:7:2026-07-01', type: 'streak', ts: NOW - DAY, label: '7-day streak', meta: {} },
  ];
  const advancedTestHistory = [{ ts: NOW - 2 * DAY, count: 50, correct: 40, netScore: 35 }];
  const previousPapers = { p1: { attempts: [{ ts: NOW - 4 * DAY, count: 100, correct: 70, netScore: 62.5 }] } };
  const revisionLog = [{ date: '2026-07-02', ts: NOW - 12 * 3600000, ids: ['a', 'b', 'c'] }];

  const feed = buildActivityFeed({ milestones, advancedTestHistory, previousPapers, revisionLog });
  assert.equal(feed.length, 5);
  assert.deepEqual(feed.map(f => f.kind),
    ['revision', 'streak', 'advanced-test', 'level-up', 'paper'], 'strictly newest-first');
  assert.match(feed.find(f => f.kind === 'advanced-test').sub, /40\/50/);
  assert.match(feed.find(f => f.kind === 'paper').sub, /net 62\.5/);
  assert.match(feed.find(f => f.kind === 'revision').sub, /3 questions/);

  const limited = buildActivityFeed({ milestones, advancedTestHistory, previousPapers, revisionLog }, { limit: 2 });
  assert.equal(limited.length, 2);
}

// ---- degenerate inputs ----
assert.deepEqual(buildActivityFeed({}), []);
assert.deepEqual(buildActivityFeed(), []);
assert.deepEqual(buildActivityFeed({ milestones: null, previousPapers: [] }), []);

console.log('milestones.test.js: all passed');
