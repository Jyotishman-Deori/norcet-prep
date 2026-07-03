// =====================================================================
// src/lib/install-prompt.js — PWA install: capture + pure decision rules.
//
// The second half of the reach work (after lib/push-opt-in.js): installs
// are what make the app feel native AND what unlock notifications on
// iPhones. Two halves:
//   • IMPURE capture (tiny, documented): captureInstallPrompt() is called
//     once from main.jsx, as early as the other boot hooks, to stash the
//     browser's `beforeinstallprompt` event (Chrome/Edge/Android — the
//     event only fires once and is useless unless preventDefault'd and
//     kept). promptInstall() replays it on user tap. `appinstalled` and
//     display-mode:standalone both mark the device installed (sticky via
//     localStorage, so opening the SITE in a tab later doesn't re-nag).
//   • PURE rules (Node-tested): installDecision() — when the Home card may
//     show and which variant ('native' one-tap / 'ios' walkthrough).
//
// Politeness contract (mirrors the notification nudge, shared state shape):
// waits for real engagement, never stacks with the notification card,
// 30-day snooze on dismiss, two dismissals = permanently quiet.
// =====================================================================
import { normalizeNudgeState, NUDGE_SNOOZE_DAYS, NUDGE_MAX_DISMISSALS } from './push-opt-in.js';

export const INSTALL_MIN_ATTEMPTS = 10; // install is a bigger ask than notifications
const DAY_MS = 86400000;
const INSTALLED_FLAG = 'norcet:installed:v1'; // device-level, deliberately not per-profile

// ---- impure capture half ---------------------------------------------------
let _deferredPrompt = null;

// Call ONCE from main.jsx (before render, like the other boot hooks).
// Safe everywhere: no-ops under Node / browsers without the event.
export function captureInstallPrompt() {
  if (typeof window === 'undefined' || !window.addEventListener) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();        // suppress Chrome's mini-infobar; we own the moment
    _deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    try { localStorage.setItem(INSTALLED_FLAG, '1'); } catch (err) {}
  });
}

export function hasDeferredPrompt() { return _deferredPrompt != null; }

// promptInstall() → 'accepted' | 'dismissed' | null (no prompt to show).
// The event is single-use: it's cleared regardless of outcome.
export async function promptInstall() {
  const p = _deferredPrompt;
  if (!p) return null;
  _deferredPrompt = null;
  try {
    p.prompt();
    const choice = await p.userChoice;
    const outcome = choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
    if (outcome === 'accepted') {
      try { localStorage.setItem(INSTALLED_FLAG, '1'); } catch (err) {}
    }
    return outcome;
  } catch (e) {
    return null;
  }
}

// isInstalledDevice(standalone) — running standalone right now, OR this device
// accepted an install before (sticky flag survives opening the site in a tab).
export function isInstalledDevice(standalone) {
  if (standalone) return true;
  try { return localStorage.getItem(INSTALLED_FLAG) === '1'; } catch (e) { return false; }
}

// ---- pure decision half ----------------------------------------------------
// installDecision(input) → { show:false } | { show:true, variant }
//   variant: 'native' (replay beforeinstallprompt) | 'ios' (walkthrough)
// input: { installed, isIOS, hasPrompt, attempted, notifShowing, install, now }
//   notifShowing — is the NOTIFICATION nudge on screen? One card at a time,
//   and notifications ask first (smaller commitment, and its iOS variant
//   already teaches the install steps).
export function installDecision(input) {
  const i = input || {};
  if (i.installed) return { show: false };
  if (i.notifShowing) return { show: false };
  if ((Number(i.attempted) || 0) < INSTALL_MIN_ATTEMPTS) return { show: false };
  const st = normalizeNudgeState(i.install);
  if (st.dismissCount >= NUDGE_MAX_DISMISSALS) return { show: false };
  const now = typeof i.now === 'number' ? i.now : Date.now();
  if (st.dismissedAt != null && now - st.dismissedAt < NUDGE_SNOOZE_DAYS * DAY_MS) {
    return { show: false };
  }
  if (i.hasPrompt) return { show: true, variant: 'native' };
  if (i.isIOS) return { show: true, variant: 'ios' };
  // No reliable install path here (e.g. desktop Firefox) → stay quiet
  // rather than showing instructions that may not exist on this browser.
  return { show: false };
}
