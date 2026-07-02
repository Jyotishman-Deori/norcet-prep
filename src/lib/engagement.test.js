// Contract test for src/lib/engagement.js — runnable under Node:
//   node src/lib/engagement.test.js
import assert from 'node:assert/strict';
import {
  computeEngagement, normalizeMetas, weekStartUtc, weekLabel, agoLabel,
} from './engagement.js';

const DAY = 86400000;
// Fixed "now": Thursday 2026-07-02 12:00 UTC.
const NOW = Date.UTC(2026, 6, 2, 12, 0, 0);

// ---- weekStartUtc: UTC-Monday convention ----
{
  const mon = weekStartUtc(NOW); // week of Mon 2026-06-29
  assert.equal(new Date(mon).getUTCDay(), 1, 'week starts Monday');
  assert.equal(new Date(mon).getUTCDate(), 29);
  // a Sunday belongs to the week of the PREVIOUS Monday
  const sun = Date.UTC(2026, 6, 5, 23, 0, 0);
  assert.equal(weekStartUtc(sun), mon);
  // Monday 00:00 is its own week start
  assert.equal(weekStartUtc(mon), mon);
  assert.equal(weekLabel(mon), '29/06');
}

// ---- normalizeMetas: garbage tolerated ----
{
  const n = normalizeMetas([
    { id: 'a', displayName: 'A', createdAt: 5, lastActive: 9 },
    { id: 'b' },                                    // no timestamps -> nulls
    { id: '', displayName: 'ghost' },               // no id -> dropped
    null, 'junk', { displayName: 'no-id' },         // dropped
    { id: 'c', createdAt: 'NaNish', lastActive: -1 }, // bad numbers -> nulls
  ]);
  assert.equal(n.length, 3);
  assert.deepEqual(n[1], { id: 'b', displayName: 'b', createdAt: null, lastActive: null });
  assert.equal(n[2].createdAt, null);
  assert.equal(n[2].lastActive, null);
}

// ---- computeEngagement over a crafted directory ----
{
  const metas = [
    { id: 'u1', displayName: 'U1', createdAt: NOW - 2 * DAY,   lastActive: NOW - 3600e3 },   // today, new this week
    { id: 'u2', displayName: 'U2', createdAt: NOW - 40 * DAY,  lastActive: NOW - 3 * DAY },  // 2-7d
    { id: 'u3', displayName: 'U3', createdAt: NOW - 60 * DAY,  lastActive: NOW - 20 * DAY }, // 8-30d (dormant list @14d)
    { id: 'u4', displayName: 'U4', createdAt: NOW - 90 * DAY,  lastActive: NOW - 45 * DAY }, // 30+
    { id: 'u5', displayName: 'U5', createdAt: NOW - 90 * DAY,  lastActive: null },           // never
  ];
  const e = computeEngagement(metas, NOW);
  assert.equal(e.total, 5);
  assert.equal(e.activeToday, 1);
  assert.equal(e.active7, 2);
  assert.equal(e.active30, 3);
  assert.equal(e.newThisWeek, 1);
  assert.equal(e.stickiness, 40); // 2/5
  assert.deepEqual(e.recency, { today: 1, week: 1, month: 1, dormant: 1, never: 1 });

  // signups: 8 zero-filled weeks, newest last. In-window: u1 (2d → current week,
  // index 7) and u2 (40d → Mon 18 May, index 1). u3/u4/u5 (60/90/90d) fall
  // OUTSIDE the 56-day window and must not be counted anywhere.
  assert.equal(e.signupsByWeek.length, 8);
  assert.equal(e.signupsByWeek[7].count, 1);
  assert.equal(e.signupsByWeek[1].count, 1);
  const sum = e.signupsByWeek.reduce((a, w) => a + w.count, 0);
  assert.equal(sum, 2, 'only in-window signups counted');
  for (let i = 1; i < 8; i++) assert.ok(e.signupsByWeek[i].start > e.signupsByWeek[i - 1].start, 'weeks ascend');

  // dormant (>=14d or never): u3, u4, u5 — most-recently-lost first, never last
  assert.deepEqual(e.dormant.map(m => m.id), ['u3', 'u4', 'u5']);
}

// empty directory → all zeros, no division by zero
{
  const e = computeEngagement([], NOW);
  assert.equal(e.total, 0);
  assert.equal(e.stickiness, 0);
  assert.equal(e.dormant.length, 0);
  assert.equal(e.signupsByWeek.length, 8);
}

// dormantMax caps the list
{
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `d${i}`, createdAt: NOW - 99 * DAY, lastActive: NOW - (20 + i) * DAY }));
  const e = computeEngagement(many, NOW, { dormantMax: 5 });
  assert.equal(e.dormant.length, 5);
  assert.equal(e.dormant[0].id, 'd0', 'most recently lost first');
}

// ---- agoLabel ----
assert.equal(agoLabel(null, NOW), 'never');
assert.equal(agoLabel(NOW - 3600e3, NOW), 'today');
assert.equal(agoLabel(NOW - 1 * DAY - 1, NOW), 'yesterday');
assert.equal(agoLabel(NOW - 5 * DAY, NOW), '5d ago');
assert.equal(agoLabel(NOW - 65 * DAY, NOW), '2mo ago');
assert.equal(agoLabel(NOW - 400 * DAY, NOW), '1y ago');

console.log('engagement.test.js: all passed');
