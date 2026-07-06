// =====================================================================
// src/ui/google-signin.jsx — "Continue with Google" (Google Identity
// Services button). Native script embed, no npm dependency — mirrors
// src/ui/turnstile.jsx's load-once / env-gated / render-nothing pattern.
//
// Behaviour:
//   • Reads VITE_GOOGLE_CLIENT_ID. If unset, renders NOTHING (the server
//     mirrors this: auth-secure's google-auth/register paths fail closed
//     without a matching GOOGLE_CLIENT_ID secret) — safe to ship before
//     the owner finishes Google Cloud setup.
//   • Calls onCredential(idToken) with the signed Google ID token; the
//     caller POSTs it to auth-secure for server-side verification. This
//     component never verifies or decodes the token itself.
// =====================================================================
import React, { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export function getGoogleClientId() {
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  return (env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

export function isGoogleSignInEnabled() {
  return !!getGoogleClientId();
}

// Load the GIS script exactly once (module-level promise), mirroring
// loadTurnstileScript(). Resolves with window.google when ready.
let _loadPromise = null;
function loadGoogleScript() {
  if (_loadPromise) return _loadPromise;
  _loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('no-dom'));
      return;
    }
    if (window.google && window.google.accounts && window.google.accounts.id) {
      resolve(window.google);
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('google-script-failed'));
    document.head.appendChild(s);
  });
  return _loadPromise;
}

function GoogleSignInButton({ onCredential, disabled }) {
  const clientId = getGoogleClientId();
  const containerRef = useRef(null);
  const renderedRef = useRef(false);
  // Keep the latest onCredential without re-initializing the button when its
  // identity changes between parent renders (same pattern as turnstile.jsx).
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (!clientId) return; // not configured → nothing to render
    let cancelled = false;
    loadGoogleScript()
      .then((g) => {
        if (cancelled || !g || !containerRef.current || renderedRef.current) return;
        try {
          g.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => {
              if (resp && resp.credential && onCredentialRef.current) onCredentialRef.current(resp.credential);
            },
          });
          g.accounts.id.renderButton(containerRef.current, {
            theme: 'outline', size: 'large', width: 300, text: 'continue_with', shape: 'pill',
          });
          renderedRef.current = true;
        } catch (_) { /* render failure just leaves the manual form as the only path */ }
      })
      .catch(() => { /* script blocked/offline — manual form still works */ });
    return () => { cancelled = true; };
    // Re-run only if the client id changes (effectively never within a session).
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="flex justify-center mb-1"
         style={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div ref={containerRef} />
    </div>
  );
}

export default GoogleSignInButton;
