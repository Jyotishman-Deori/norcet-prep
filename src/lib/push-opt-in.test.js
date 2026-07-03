// Contract test for src/lib/push-opt-in.js — runnable under Node:
//   node src/lib/push-opt-in.test.js
import assert from 'node:assert/strict';

const {
  isIOSDevice, detectPushSupport, getPushEnv,
  normalizeNudgeState, recordNudgeDismiss, nudgeDecision,
  NUDGE_MIN_ATTEMPTS, NUDGE_SNOOZE_DAYS, NUDGE_MAX_DISMISSALS,
} = await import('./push-opt-in.js');

// ---- isIOSDevice ----
{
  assert.equal(isIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5), true);
  assert.equal(isIOSDevice('Mozilla/5.0 (iPad; CPU OS 16_4)', 'iPad', 5), true);
  // iPadOS masquerading as a Mac — detected via touch points.
  assert.equal(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5), true);
  // Real Macs have 0 touch points.
  assert.equal(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0), false);
  assert.equal(isIOSDevice('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l', 5), false);
  assert.equal(isIOSDevice(undefined, undefined, undefined), false, 'nullish-safe');
}

// ---- detectPushSupport ----
{
  const full = { hasNotification: true, hasPushManager: true, hasServiceWorker: true, isIOS: false, standalone: false };
  assert.deepEqual(detectPushSupport(full), { level: 'ok' }, 'android/desktop chrome');
  // Installed iOS PWA exposes the full API → ok even though isIOS.
  assert.deepEqual(detectPushSupport({ ...full, isIOS: true, standalone: true }), { level: 'ok' });
  // iOS Safari TAB: no PushManager/Notification → the install walkthrough.
  assert.deepEqual(
    detectPushSupport({ hasNotification: false, hasPushManager: false, hasServiceWorker: true, isIOS: true, standalone: false }),
    { level: 'ios-install' },
  );
  // Old desktop browser with nothing → unsupported (no install lie).
  assert.deepEqual(
    detectPushSupport({ hasNotification: false, hasPushManager: false, hasServiceWorker: false, isIOS: false, standalone: false }),
    { level: 'unsupported' },
  );
  assert.deepEqual(detectPushSupport(null), { level: 'unsupported' }, 'nullish-safe');
  // Node (no browser globals): getPushEnv must not throw and must resolve unsupported.
  assert.equal(detectPushSupport(getPushEnv()).level, 'unsupported');
}

// ---- normalizeNudgeState / recordNudgeDismiss ----
{
  assert.deepEqual(normalizeNudgeState(null), { dismissedAt: null, dismissCount: 0 });
  assert.deepEqual(normalizeNudgeState('garbage{'), { dismissedAt: null, dismissCount: 0 });
  assert.deepEqual(normalizeNudgeState('{"dismissedAt":123,"dismissCount":1}'), { dismissedAt: 123, dismissCount: 1 }, 'accepts JSON strings');
  assert.deepEqual(normalizeNudgeState({ dismissedAt: -5, dismissCount: 'x' }), { dismissedAt: null, dismissCount: 0 }, 'junk fields coerced');
  const t = 1_000_000;
  const once = recordNudgeDismiss(null, t);
  assert.deepEqual(once, { dismissedAt: t, dismissCount: 1 });
  const twice = recordNudgeDismiss(once, t + 5);
  assert.deepEqual(twice, { dismissedAt: t + 5, dismissCount: 2 });
}

// ---- nudgeDecision rules matrix ----
{
  const now = 10 * NUDGE_SNOOZE_DAYS * 86400000;
  const base = {
    support: { level: 'ok' }, permission: 'default', notificationsOn: false,
    attempted: NUDGE_MIN_ATTEMPTS, nudge: null, now,
  };
  assert.deepEqual(nudgeDecision(base), { show: true, variant: 'enable' }, 'happy path shows');
  assert.equal(nudgeDecision({ ...base, notificationsOn: true }).show, false, 'already on → quiet');
  assert.equal(nudgeDecision({ ...base, permission: 'denied' }).show, false, 'denied → never fight the browser');
  assert.equal(nudgeDecision({ ...base, support: { level: 'unsupported' } }).show, false);
  assert.equal(nudgeDecision({ ...base, attempted: NUDGE_MIN_ATTEMPTS - 1 }).show, false, 'brand-new users are left alone');
  assert.deepEqual(
    nudgeDecision({ ...base, support: { level: 'ios-install' } }),
    { show: true, variant: 'ios-install' },
    'iOS tab gets the install walkthrough variant',
  );
  // Snooze: a fresh dismissal silences it, an old one (>30d) lets it return.
  const dismissed = recordNudgeDismiss(null, now - 1);
  assert.equal(nudgeDecision({ ...base, nudge: dismissed }).show, false, 'inside snooze window');
  const oldDismiss = { dismissedAt: now - (NUDGE_SNOOZE_DAYS * 86400000 + 1), dismissCount: 1 };
  assert.equal(nudgeDecision({ ...base, nudge: oldDismiss }).show, true, 'snooze expired → one more ask');
  // Two dismissals = never again, regardless of age.
  const twoStrikes = { dismissedAt: 1, dismissCount: NUDGE_MAX_DISMISSALS };
  assert.equal(nudgeDecision({ ...base, nudge: twoStrikes }).show, false, 'max dismissals → permanent quiet');
  // Nullish input never throws.
  assert.equal(nudgeDecision(null).show, false);
}

console.log('push-opt-in.test.js: all passed');
