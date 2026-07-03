// =====================================================================
// src/lib/push-opt-in.js — pure logic for the notification opt-in flow.
//
// Why this exists: push reach was 1 device out of 11 users because the only
// opt-in lived behind the Daily-reminder toggle in Settings. This module
// powers the two fixes:
//   • ONE master "Notifications" switch in Settings (support-aware: iPhones
//     in a Safari tab can't subscribe at all — they get an "install first"
//     walkthrough instead of a dead toggle), and
//   • a one-tap nudge card on Home (src/ui/notification-nudge.jsx) whose
//     show/snooze rules live here so they're Node-testable.
//
// Pure: no globals, no storage. The UI hands in an env snapshot
// (getPushEnv() below is the one thin impure helper, guarded for Node).
// =====================================================================

// ---- capability detection -------------------------------------------------
// isIOSDevice(ua, platform, maxTouchPoints) — iPhone/iPod/iPad, including
// modern iPadOS which masquerades as "MacIntel" but exposes touch points.
export function isIOSDevice(ua, platform, maxTouchPoints) {
  const u = String(ua || '');
  if (/iPhone|iPad|iPod/i.test(u)) return true;
  return /Mac/i.test(String(platform || '')) && (Number(maxTouchPoints) || 0) > 1;
}

// detectPushSupport(env) → { level }
//   'ok'          — this browser can subscribe right now
//   'ios-install' — iOS Safari TAB: push only works once the PWA is installed
//                   to the home screen (iOS 16.4+); show the install steps
//   'unsupported' — genuinely no web-push here
// env: { hasNotification, hasPushManager, hasServiceWorker, isIOS, standalone }
export function detectPushSupport(env) {
  const e = env || {};
  if (e.hasNotification && e.hasPushManager && e.hasServiceWorker) return { level: 'ok' };
  if (e.isIOS && !e.standalone) return { level: 'ios-install' };
  return { level: 'unsupported' };
}

// getPushEnv() — snapshot the real browser globals (guarded so importing this
// module under Node for tests never throws).
export function getPushEnv() {
  const hasWindow = typeof window !== 'undefined';
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const standalone = hasWindow && (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    nav.standalone === true // legacy iOS Safari flag
  );
  return {
    hasNotification: typeof Notification !== 'undefined',
    hasPushManager: hasWindow && 'PushManager' in window,
    hasServiceWorker: 'serviceWorker' in nav,
    isIOS: isIOSDevice(nav.userAgent, nav.platform, nav.maxTouchPoints),
    standalone: !!standalone,
  };
}

// ---- nudge show/snooze rules ----------------------------------------------
export const NUDGE_MIN_ATTEMPTS = 5;   // earn trust first: ≥5 answered questions
export const NUDGE_SNOOZE_DAYS = 30;   // a dismissal silences it for a month
export const NUDGE_MAX_DISMISSALS = 2; // two dismissals = never ask again

const DAY_MS = 86400000;

// The locally-persisted nudge record (KEYS.notifNudge, shared:false).
export function normalizeNudgeState(raw) {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) v = {};
  const at = Number(v.dismissedAt);
  const n = Number(v.dismissCount);
  return {
    dismissedAt: Number.isFinite(at) && at > 0 ? at : null,
    dismissCount: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0,
  };
}

export function recordNudgeDismiss(state, now = Date.now()) {
  const s = normalizeNudgeState(state);
  return { dismissedAt: now, dismissCount: s.dismissCount + 1 };
}

// nudgeDecision(input) → { show:false } | { show:true, variant }
//   variant: 'enable' (one-tap turn-on) | 'ios-install' (walkthrough)
// input: { support, permission, notificationsOn, attempted, nudge, now }
// Deliberately quiet-first: it never shows to brand-new users, never fights a
// denied permission, respects snooze, and gives up for good after two "Not now"s.
export function nudgeDecision(input) {
  const i = input || {};
  const support = i.support || { level: 'unsupported' };
  if (i.notificationsOn) return { show: false };
  if (i.permission === 'denied') return { show: false };
  if (support.level === 'unsupported') return { show: false };
  if ((Number(i.attempted) || 0) < NUDGE_MIN_ATTEMPTS) return { show: false };
  const nudge = normalizeNudgeState(i.nudge);
  if (nudge.dismissCount >= NUDGE_MAX_DISMISSALS) return { show: false };
  const now = typeof i.now === 'number' ? i.now : Date.now();
  if (nudge.dismissedAt != null && now - nudge.dismissedAt < NUDGE_SNOOZE_DAYS * DAY_MS) {
    return { show: false };
  }
  return { show: true, variant: support.level === 'ios-install' ? 'ios-install' : 'enable' };
}
