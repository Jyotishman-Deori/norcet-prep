import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { ErrorBoundary } from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
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
