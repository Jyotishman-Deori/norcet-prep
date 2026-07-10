import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { ErrorBoundary } from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { installGlobalErrorCapture } from './lib/errorlog.js';
import { installRageClickCapture } from './lib/rage-click.js';
import { captureReferralFromUrl } from './lib/referral.js';
import { initUmami } from './lib/umami.js';
import { captureInstallPrompt, requestPersistentStorage } from './lib/install-prompt.js';
import { loadI18n } from './lib/i18n.js';
import { initDevBadge } from './lib/dev-env.js';
// #29 — capture uncaught errors + unhandled promise rejections from the very
// start, grouped for the admin crash dashboard. Fail-safe (never throws).
installGlobalErrorCapture();
// Dev-environment indicator — inert in production builds. On a dev serve it
// shows which Supabase project this session touches: 'DEV DATA' (the
// nurseholic-dev project via .env.development) or a red 'LIVE DATA' warning
// when that file is missing and Vite fell back to the production .env.
initDevBadge(import.meta.env);
// Rage-click detection — rapid clustered taps get flagged as UX failures in
// the same admin triage list (severity 'ux'). Fail-safe, game screens excluded.
installRageClickCapture();
// Umami Cloud (free) pageview analytics — a no-op unless VITE_UMAMI_WEBSITE_ID
// is configured, so it costs nothing for local/dev or an unconfigured deploy.
initUmami();
// Phase-1 referrals — if this load arrived via a referral link (?ref=&via=),
// capture the attribution LOCALLY now (before any render) and clean the params
// out of the address bar. createProfile() reads this back at signup. Purely
// local + best-effort; costs nothing for visitors who never sign up.
captureReferralFromUrl();
// PWA install — stash the one-shot beforeinstallprompt event NOW (it fires
// early and is lost unless preventDefault'd), so the Home install card and
// the Settings row can replay the REAL install sheet on a user tap later.
captureInstallPrompt();
// Budget-Android storage protection: ask the OS not to auto-evict this
// origin's IndexedDB (progress cache) when the phone's disk fills up.
requestPersistentStorage();
// Register the service worker. autoUpdate (configured in vite.config.js)
// silently fetches a new SW in the background; this callback gets called
// when a fresh build is fully installed and waiting. We auto-reload so the
// user is always on the latest version next time they open the app.
registerSW({
  onNeedRefresh() {
    // A new version is ready. Reload to activate it. Doing this on
    // visibilitychange instead of immediately would be gentler if the user
    // is mid-quiz, but the App debounces saves to IDB on every state
    // change and flushes on unmount, so a reload is safe.
    if (document.visibilityState === 'hidden') {
      window.location.reload();
    } else {
      const onHide = () => {
        if (document.visibilityState === 'hidden') {
          document.removeEventListener('visibilitychange', onHide);
          window.location.reload();
        }
      };
      document.addEventListener('visibilitychange', onHide);
    }
  },
  onOfflineReady() {
    // First install is complete; the app now works offline.
    // No UI — the install/offline experience is intentionally invisible.
  }
});
// I18N — restore the saved UI language BEFORE first render so returning
// non-English users don't flash English. The localStorage hint + IndexedDB
// dict cache resolve in a few ms; the 1500ms race is a hard ceiling so a
// wedged IndexedDB can never blank the app (worst case: English first,
// the App's onLangChange subscription swaps strings when the dict lands).
// loadI18n() itself never throws.
Promise.race([loadI18n(), new Promise((r) => setTimeout(r, 1500))]).then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
