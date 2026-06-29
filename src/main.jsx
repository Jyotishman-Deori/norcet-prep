import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { ErrorBoundary } from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { installGlobalErrorCapture } from './lib/errorlog.js';
import { captureReferralFromUrl } from './lib/referral.js';
import { initUmami } from './lib/umami.js';
// #29 — capture uncaught errors + unhandled promise rejections from the very
// start, grouped for the admin crash dashboard. Fail-safe (never throws).
installGlobalErrorCapture();
// Umami Cloud (free) pageview analytics — a no-op unless VITE_UMAMI_WEBSITE_ID
// is configured, so it costs nothing for local/dev or an unconfigured deploy.
initUmami();
// Phase-1 referrals — if this load arrived via a referral link (?ref=&via=),
// capture the attribution LOCALLY now (before any render) and clean the params
// out of the address bar. createProfile() reads this back at signup. Purely
// local + best-effort; costs nothing for visitors who never sign up.
captureReferralFromUrl();
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
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
