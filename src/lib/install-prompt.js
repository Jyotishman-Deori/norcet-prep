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

// Ask the OS to protect this origin's storage from automatic eviction.
// Budget Android phones (most of the student base) aggressively clear
// browser storage when the disk fills with WhatsApp media; a granted
// persist() keeps the IndexedDB progress cache safe. Chrome grants or
// denies silently on engagement heuristics (no dialog); Firefox may show
// a small prompt. Safe to call repeatedly; fire-and-forget at boot.
export function requestPersistentStorage() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  } catch (e) { /* never blocks boot */ }
}

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

// installGuide(input) → { kind } — which install affordance the SETTINGS card
// should render. Unlike installDecision (the conservative Home nudge, which
// stays silent when there is no reliable native path), Settings is a deliberate
// destination, so it always offers an honest way to install:
//   'installed' — already installed → render nothing
//   'native'    — captured beforeinstallprompt → one-tap Install button
//   'ios'       — iPhone/iPad Safari → Share then Add to Home Screen steps
//   'android'   — Android browser → menu then Install app / Add to Home screen
//   'desktop'   — everything else (desktop, no captured prompt) → honest steps
// input: { installed, hasPrompt, isIOS, isAndroid }
export function installGuide(input) {
  const i = input || {};
  if (i.installed) return { kind: 'installed' };
  if (i.hasPrompt) return { kind: 'native' };
  if (i.isIOS) return { kind: 'ios' };
  if (i.isAndroid) return { kind: 'android' };
  return { kind: 'desktop' };
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
