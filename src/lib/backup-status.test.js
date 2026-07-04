// Contract test for src/lib/backup-status.js — runnable under Node:
//   node src/lib/backup-status.test.js
import assert from 'node:assert/strict';

const { describeSyncState, relTimeShort } = await import('./backup-status.js');

const NOW = 1_000_000_000;

// ---- guest: always the "not backed up, sign in" state, no Back up now ----
{
  for (const extra of [{}, { online: false }, { pendingCount: 5 }, { online: true, pendingCount: 0 }]) {
    const r = describeSyncState({ isGuest: true, now: NOW, ...extra });
    assert.equal(r.state, 'guest');
    assert.equal(r.tone, 'warn');
    assert.equal(r.showBackupNow, false, 'guests cannot back up (no cloud account)');
    assert.match(r.detail, /[Ss]ign in/);
  }
}

// ---- offline: never claims to be uploading; distinguishes pending vs clean ----
{
  const withPending = describeSyncState({ isGuest: false, online: false, pendingCount: 3, now: NOW });
  assert.equal(withPending.state, 'offline');
  assert.equal(withPending.showBackupNow, false, 'no point offering Back up now while offline');
  assert.match(withPending.title, /Waiting for connection/);

  const clean = describeSyncState({ isGuest: false, online: false, pendingCount: 0, now: NOW });
  assert.equal(clean.state, 'offline');
  assert.match(clean.detail, /backed up/);
}

// ---- pending (account + online + unsynced): progress state, Back up now on ----
{
  const r = describeSyncState({ isGuest: false, online: true, pendingCount: 2, now: NOW });
  assert.equal(r.state, 'pending');
  assert.equal(r.tone, 'progress');
  assert.equal(r.showBackupNow, true);
  assert.match(r.title, /Backing up/);
}

// ---- synced (account + online + nothing pending): the happy state ----
{
  const r = describeSyncState({ isGuest: false, online: true, pendingCount: 0, lastSyncedAt: NOW - 30_000, now: NOW });
  assert.equal(r.state, 'synced');
  assert.equal(r.tone, 'ok');
  assert.equal(r.showBackupNow, true);
  assert.match(r.title, /Backed up/);
  assert.match(r.detail, /just now/, 'recent sync shows a relative time');
  assert.match(r.detail, /another device/, 'always explains cross-device restore');

  // No / bad timestamp → still synced, just omits the "last backed up" clause.
  const noTs = describeSyncState({ isGuest: false, online: true, pendingCount: 0, now: NOW });
  assert.equal(noTs.state, 'synced');
  assert.doesNotMatch(noTs.detail, /Last backed up/);
}

// ---- online default: undefined online is treated as online (not offline) ----
{
  const r = describeSyncState({ isGuest: false, pendingCount: 0, now: NOW });
  assert.equal(r.state, 'synced', 'missing online flag defaults to online');
}

// ---- pendingCount coercion ----
{
  assert.equal(describeSyncState({ isGuest: false, online: true, pendingCount: '0', now: NOW }).state, 'synced');
  assert.equal(describeSyncState({ isGuest: false, online: true, pendingCount: -4, now: NOW }).state, 'synced', 'negative clamps to 0');
  assert.equal(describeSyncState({ isGuest: false, online: true, pendingCount: 'x', now: NOW }).state, 'synced', 'NaN → 0');
}
// null/undefined input must not throw and must yield a valid state.
for (const bad of [null, undefined]) {
  const r = describeSyncState(bad);
  assert.ok(['guest', 'offline', 'pending', 'synced'].includes(r.state), 'nullish input is safe');
  assert.equal(typeof r.title, 'string');
  assert.equal(typeof r.detail, 'string');
}

// ---- relTimeShort ----
{
  assert.equal(relTimeShort(NOW - 10_000, NOW), 'just now');
  assert.equal(relTimeShort(NOW - 5 * 60_000, NOW), '5m ago');
  assert.equal(relTimeShort(NOW - 3 * 3600_000, NOW), '3h ago');
  assert.equal(relTimeShort(NOW - 2 * 86400_000, NOW), '2d ago');
  assert.equal(relTimeShort(0, NOW), null);
  assert.equal(relTimeShort(NOW + 5000, NOW), null, 'future timestamp → null');
  assert.equal(relTimeShort('nope', NOW), null);
  assert.equal(relTimeShort(undefined, NOW), null);
}

console.log('backup-status.test.js: all passed');
