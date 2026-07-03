// =====================================================================
// src/ui/session-expired-toast.jsx — the "logged in from another device"
// notice (single-session enforcement, blueprint Part 3 client half).
//
// Shown by App.jsx after a broker answered 401 SESSION_EXPIRED and the app
// force-signed the user out (they're now in guest mode; their data is safe
// on the server). Non-blocking toast, not a wall: one tap to re-login,
// dismissible, sits above everything including the bottom nav.
// =====================================================================
import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

export default function SessionExpiredToast({ open, onSignIn, onClose }) {
  const { theme: T } = useTheme();
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 z-[120] flex justify-center px-4 pointer-events-none"
         style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}
         role="alert" aria-live="assertive">
      <div className="anim-fadeup pointer-events-auto w-full max-w-md rounded-2xl px-4 py-3.5 flex items-start gap-3"
           style={{ background: T.surface, border: `1px solid ${T.border}`,
                    boxShadow: '0 12px 36px rgba(0,0,0,0.28)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: (T.error || '#DC2626') + '1A' }}>
          <ShieldAlert size={17} style={{ color: T.error || '#DC2626' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold leading-snug" style={{ color: T.ink }}>
            Signed out — this account was opened on another device
          </div>
          <div className="text-[12px] mt-0.5 leading-snug" style={{ color: T.inkSoft }}>
            Your progress is safe. Sign in again to continue on this device.
          </div>
          <button onClick={onSignIn}
                  className="no-tap-highlight mt-2 px-3.5 py-1.5 rounded-lg text-[12px] font-bold active:scale-95 transition-transform"
                  style={{ background: T.primary, color: '#FFF' }}>
            Sign in
          </button>
        </div>
        <button onClick={onClose} aria-label="Dismiss"
                className="no-tap-highlight p-1.5 -mr-1 -mt-1 rounded-full flex-shrink-0"
                style={{ color: T.muted }}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
