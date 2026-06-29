// =====================================================================
// src/ui/turnstile.jsx — Cloudflare Turnstile (free, privacy-friendly CAPTCHA).
//
// A self-contained widget that guards the auth forms (Create profile / Log in /
// Forgot-password reset). Native script embed — NO npm dependency. Explicit
// render so it only mounts where we place it.
//
// Behaviour:
//   • Reads VITE_TURNSTILE_SITE_KEY. If it's not set, the component renders
//     NOTHING and reports no token — so local/dev and an un-configured deploy
//     keep working (the server fail-opens to match; see auth-secure).
//   • Calls onToken(token) on success, onToken(null) on expiry/error (Turnstile
//     tokens are single-use and expire ~5 min).
//   • Exposes reset() via ref so the caller can re-challenge after a failed
//     submit (the token is consumed on use).
//
// isTurnstileEnabled() lets a caller decide whether to REQUIRE a token before
// allowing submit (only when a site key is configured).
// =====================================================================
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export function getTurnstileSiteKey() {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  return (env.VITE_TURNSTILE_SITE_KEY || '').trim();
}

export function isTurnstileEnabled() {
  return !!getTurnstileSiteKey();
}

// Load the Turnstile script exactly once (module-level promise). Resolves with
// window.turnstile when the API is ready. Rejects if the script fails to load.
let _loadPromise = null;
function loadTurnstileScript() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('no-dom'));
      return;
    }
    if (window.turnstile) { resolve(window.turnstile); return; }
    // Turnstile calls this global once the API object is ready (render=explicit).
    const cbName = '__cfTurnstileOnLoad';
    window[cbName] = () => resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = `${SCRIPT_SRC}&onload=${cbName}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error('turnstile-script-failed'));
    document.head.appendChild(s);
  });
  return _loadPromise;
}

const TurnstileWidget = forwardRef(function TurnstileWidget({ onToken, action }, ref) {
  const siteKey = getTurnstileSiteKey();
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  // Keep the latest onToken without re-rendering the widget when its identity
  // changes between parent renders.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      try {
        if (window.turnstile && widgetIdRef.current != null) {
          window.turnstile.reset(widgetIdRef.current);
        }
      } catch (_) { /* a reset failure is non-fatal */ }
    },
  }), []);

  useEffect(() => {
    if (!siteKey) return; // not configured → nothing to render
    let cancelled = false;
    loadTurnstileScript()
      .then((ts) => {
        if (cancelled || !ts || !containerRef.current) return;
        if (widgetIdRef.current != null) return; // already rendered (StrictMode guard)
        try {
          widgetIdRef.current = ts.render(containerRef.current, {
            sitekey: siteKey,
            action: action || undefined,
            theme: 'auto',
            callback: (token) => { if (onTokenRef.current) onTokenRef.current(token); },
            'expired-callback': () => { if (onTokenRef.current) onTokenRef.current(null); },
            'error-callback': () => { if (onTokenRef.current) onTokenRef.current(null); },
          });
        } catch (_) { /* render failure leaves the form usable (server gate still applies) */ }
      })
      .catch(() => { /* script blocked/offline — server fail-open or 'captcha' reason covers it */ });
    return () => {
      cancelled = true;
      try {
        if (window.turnstile && widgetIdRef.current != null) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch (_) {}
      widgetIdRef.current = null;
    };
    // Re-run only if the site key changes (effectively never within a session).
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center my-4" />;
});

export default TurnstileWidget;
