// Contract test for src/lib/admin-user-ops.js — runnable under Node:
//   node src/lib/admin-user-ops.test.js
import assert from 'node:assert/strict';
import { summarizeUser, applyCoinAdjust, applyResetProgress, COIN_PRESETS } from './admin-user-ops.js';

const blob = {
  id: 'suraj', uid: 'uid-1', displayName: 'Suraj', referredBy: 'iyro', createdAt: 111,
  data: {
    economy: { coins: 2500, hearts: 4, heartsTs: 9, whyClaimed: ['q1'] },
    levelup: { xp: 4200, dailyXp: 100 },
    stats: { totalAttempted: 300, totalCorrect: 240, streakCurrent: 6, streakBest: 11, examDate: '2026-10-01' },
    history: { q1: { attempts: [1, 2] } },
    customQuestions: [{ id: 'c1' }],
    futureUnknownKey: { keep: true },
  },
};
const snapshot = JSON.stringify(blob);

// ---- summarizeUser: display fields only, null-safe ----
{
  const s = summarizeUser(blob);
  assert.equal(s.displayName, 'Suraj');
  assert.equal(s.coins, 2500);
  assert.equal(s.xp, 4200);
  assert.equal(s.attempted, 300);
  assert.equal(s.accuracy, 80);
  assert.equal(s.streakCurrent, 6);
  assert.equal(s.streakBest, 11);
  assert.equal(s.referredBy, 'iyro');
  assert.equal(s.hasData, true);
  // never leaks raw history/answers
  assert.equal(s.history, undefined);
}
{
  const s = summarizeUser(null);
  assert.equal(s.coins, 0);
  assert.equal(s.accuracy, null);
  assert.equal(s.hasData, false);
}
{
  // zero attempts -> accuracy null (not NaN / 0%)
  const s = summarizeUser({ id: 'x', data: { stats: { totalAttempted: 0, totalCorrect: 0 } } });
  assert.equal(s.accuracy, null);
}

// ---- applyCoinAdjust: grant, deduct, floor at zero, preserve everything ----
{
  const { blob: b2, before, after } = applyCoinAdjust(blob, 1000);
  assert.equal(before, 2500);
  assert.equal(after, 3500);
  assert.equal(b2.data.economy.coins, 3500);
  // identity + unrelated data preserved exactly
  assert.equal(b2.id, 'suraj');
  assert.equal(b2.uid, 'uid-1');
  assert.deepEqual(b2.data.history, blob.data.history);
  assert.deepEqual(b2.data.futureUnknownKey, { keep: true });
  assert.deepEqual(b2.data.economy.whyClaimed, ['q1'], 'whyClaimed dedup list survives');
  assert.equal(b2.data.economy.hearts, 4);
  // original untouched (pure)
  assert.equal(JSON.stringify(blob), snapshot);
}
{
  const { after } = applyCoinAdjust(blob, -600);
  assert.equal(after, 1900);
}
{
  // deduction floors at 0 — a student can never go negative
  const { after } = applyCoinAdjust(blob, -99999);
  assert.equal(after, 0);
}
{
  // user with NO data slice at all -> economy created from defaults
  const { blob: b2, before, after } = applyCoinAdjust({ id: 'new' }, 500);
  assert.equal(before, 0);
  assert.equal(after, 500);
  assert.equal(b2.data.economy.coins, 500);
}
{
  // garbage amount -> no change
  const { after } = applyCoinAdjust(blob, NaN);
  assert.equal(after, 2500);
}

// ---- applyResetProgress: data replaced, identity untouched ----
{
  const fresh = { stats: { totalAttempted: 0 }, economy: { coins: 0 } };
  const b2 = applyResetProgress(blob, fresh);
  assert.equal(b2.id, 'suraj');
  assert.equal(b2.uid, 'uid-1');
  assert.equal(b2.displayName, 'Suraj');
  assert.equal(b2.referredBy, 'iyro');
  assert.equal(b2.createdAt, 111);
  assert.equal(b2.data, fresh);
  assert.equal(b2.data.economy.coins, 0);
  assert.equal(JSON.stringify(blob), snapshot, 'original untouched');
}
assert.throws(() => applyResetProgress(blob, null), /freshData required/);

// presets sane
assert.ok(COIN_PRESETS.includes(500) && COIN_PRESETS.some(n => n < 0));

console.log('admin-user-ops.test.js: all passed');
