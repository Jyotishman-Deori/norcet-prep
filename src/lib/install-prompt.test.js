// Contract test for src/lib/install-prompt.js — runnable under Node:
//   node src/lib/install-prompt.test.js
import assert from 'node:assert/strict';

const {
  installDecision, installGuide, isInstalledDevice, captureInstallPrompt, hasDeferredPrompt,
  promptInstall, INSTALL_MIN_ATTEMPTS,
} = await import('./install-prompt.js');
const { recordNudgeDismiss, NUDGE_SNOOZE_DAYS, NUDGE_MAX_DISMISSALS } = await import('./push-opt-in.js');

// ---- impure half is Node-safe (no window/localStorage → graceful no-ops) ----
{
  assert.doesNotThrow(() => captureInstallPrompt(), 'capture no-ops without window');
  assert.equal(hasDeferredPrompt(), false);
  assert.equal(await promptInstall(), null, 'no captured prompt → null');
  assert.equal(isInstalledDevice(false), false, 'no localStorage → not installed');
  assert.equal(isInstalledDevice(true), true, 'standalone always counts as installed');
}

// ---- installDecision rules matrix ----
{
  const now = 10 * NUDGE_SNOOZE_DAYS * 86400000;
  const base = {
    installed: false, isIOS: false, hasPrompt: true,
    attempted: INSTALL_MIN_ATTEMPTS, notifShowing: false, install: null, now,
  };
  assert.deepEqual(installDecision(base), { show: true, variant: 'native' }, 'android/desktop chrome → native prompt');
  assert.deepEqual(
    installDecision({ ...base, hasPrompt: false, isIOS: true }),
    { show: true, variant: 'ios' },
    'iOS (no beforeinstallprompt exists there) → walkthrough',
  );
  assert.equal(installDecision({ ...base, installed: true }).show, false, 'installed device → quiet forever');
  assert.equal(installDecision({ ...base, notifShowing: true }).show, false, 'one card at a time — notifications ask first');
  assert.equal(installDecision({ ...base, attempted: INSTALL_MIN_ATTEMPTS - 1 }).show, false, 'needs real engagement');
  assert.equal(installDecision({ ...base, hasPrompt: false, isIOS: false }).show, false, 'no install path (desktop Firefox) → no fake instructions');

  // Snooze + permanent-quiet share the notification nudge's tested state shape.
  const dismissed = recordNudgeDismiss(null, now - 1);
  assert.equal(installDecision({ ...base, install: dismissed }).show, false, 'inside 30-day snooze');
  const oldDismiss = { dismissedAt: now - (NUDGE_SNOOZE_DAYS * 86400000 + 1), dismissCount: 1 };
  assert.equal(installDecision({ ...base, install: oldDismiss }).show, true, 'snooze expired → one more ask');
  const twoStrikes = { dismissedAt: 1, dismissCount: NUDGE_MAX_DISMISSALS };
  assert.equal(installDecision({ ...base, install: twoStrikes }).show, false, 'two dismissals → never again');

  assert.equal(installDecision(null).show, false, 'nullish-safe');
}

// ---- installGuide (Settings card: always offers an honest path) ----
{
  assert.equal(installGuide({ installed: true }).kind, 'installed', 'installed → nothing');
  assert.equal(installGuide({ installed: true, hasPrompt: true, isIOS: true }).kind, 'installed', 'installed wins over everything');
  assert.equal(installGuide({ hasPrompt: true }).kind, 'native', 'captured prompt → one-tap');
  assert.equal(installGuide({ hasPrompt: true, isIOS: true }).kind, 'native', 'native wins over platform');
  assert.equal(installGuide({ isIOS: true }).kind, 'ios', 'iPhone/iPad → Share walkthrough');
  assert.equal(installGuide({ isAndroid: true }).kind, 'android', 'Android → menu steps');
  assert.equal(installGuide({}).kind, 'desktop', 'desktop / no prompt → honest steps (never blank)');
  assert.equal(installGuide(null).kind, 'desktop', 'nullish-safe');
}

console.log('install-prompt.test.js: all passed');
