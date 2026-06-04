// [A1 slice 46] UpdateToast — the PWA "new version available" prompt. A fixed
// bottom toast that appears when the service worker signals an update; offers
// Reload (with a one-tap mid-quiz confirm) or Later (dismiss for the session).
// Extracted VERBATIM from App.jsx (one inserted A7 hook line). Its single-
// consumer module const PWA_DISMISS_KEY moves in with it. The one render site in
// App ('<UpdateToast quizInProgress=... />') is UNCHANGED.
//
// A7: was a bare-T reader -> useTheme(). No IS_DARK / fgOnDark / fontStyles, no
// data/profile/isAdmin context. quizInProgress stays a prop.
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

// Single-consumer module const (only UpdateToast reads it) — moved here VERBATIM.
const PWA_DISMISS_KEY = 'pwa-update-dismissed';

function UpdateToast({ quizInProgress }) {
  const { theme: T } = useTheme();
  const [show, setShow] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    // If the user already chose "Later" this session, don't subscribe.
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(PWA_DISMISS_KEY) === '1'; } catch (e) {}
    if (dismissed) return;
    const onAvailable = () => setShow(true);
    window.addEventListener('pwa-update-available', onAvailable);
    // The event may have fired during boot before this listener attached.
    // main.jsx leaves window.__pwaUpdateSW set in that case, so check once.
    try { if (window.__pwaUpdateSW) setShow(true); } catch (e) {}
    return () => window.removeEventListener('pwa-update-available', onAvailable);
  }, []);

  if (!show) return null;

  const doReload = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.__pwaUpdateSW === 'function') {
        window.__pwaUpdateSW(true); // activate the waiting SW, then reload
      } else {
        window.location.reload();   // fallback if the activator went missing
      }
    } catch (e) {
      try { window.location.reload(); } catch (_) {}
    }
  };

  const onReloadClick = () => {
    // Mid-quiz: ask once before reloading. Otherwise reload immediately.
    if (quizInProgress && !confirming) { setConfirming(true); return; }
    doReload();
  };

  // Left button: in confirm mode it just backs out (toast stays);
  // otherwise it's "Later" — dismiss for the rest of the session.
  const onLeftClick = () => {
    if (confirming) { setConfirming(false); return; }
    setShow(false);
    try { sessionStorage.setItem(PWA_DISMISS_KEY, '1'); } catch (e) {}
  };

  return (
    <div className="anim-fadeup no-tap-highlight" role="status" aria-live="polite" style={{
      position: 'fixed', left: 12, right: 12, bottom: 84, zIndex: 210,
      maxWidth: 460, margin: '0 auto',
      background: T.surface, color: T.ink,
      border: `1px solid ${T.border}`, borderRadius: 14,
      boxShadow: '0 6px 24px rgba(0,0,0,0.20)',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12
    }}>
      <RefreshCw size={18} style={{ flexShrink: 0, color: T.primary }} />
      <div className="text-sm" style={{ flex: 1, lineHeight: 1.35 }}>
        {confirming ? (
          <span><span style={{ fontWeight: 700 }}>Reload now?</span> Your current progress is saved.</span>
        ) : (
          <span><span style={{ fontWeight: 700 }}>New version available.</span> Reload to update.</span>
        )}
      </div>
      <button onClick={onLeftClick}
              aria-label={confirming ? 'Cancel reload' : 'Dismiss update until next session'}
              className="no-tap-highlight text-xs"
              style={{ flexShrink: 0, background: 'transparent', border: 'none',
                       color: T.muted, cursor: 'pointer', padding: '6px 8px', fontWeight: 600 }}>
        {confirming ? 'Cancel' : 'Later'}
      </button>
      <button onClick={onReloadClick}
              aria-label="Reload to apply the new version"
              className="no-tap-highlight text-xs"
              style={{ flexShrink: 0, background: T.primary, border: 'none',
                       color: '#fff', cursor: 'pointer', padding: '8px 14px',
                       borderRadius: 9, fontWeight: 700 }}>
        Reload
      </button>
    </div>
  );
}

export default UpdateToast;
