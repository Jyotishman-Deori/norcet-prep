// =====================================================================
// src/ui/offline-indicator.jsx — subtle, non-blocking connectivity pill.
//
// Offline: a small amber pill slides in under the status bar ("You're
// offline. Progress saves on this device.") with a gentle breathing dot.
// Back online: the pill flips green ("Back online. Your progress is
// syncing.") and auto-fades after a short affirmation. It is NEVER a
// roadblock: pointer-events none, no buttons, no backdrop, small height,
// and it only appears on a real connectivity change (nothing on a normal
// online boot). The actual sync is already handled elsewhere (App's
// 'online' listener runs flushPendingSync); this component is purely the
// visual courtesy layer on top.
//
// prefers-reduced-motion: animations are gated in font-styles.js (the
// pill just appears/disappears with no slide or pulse).
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

const BACK_ONLINE_MS = 2600; // how long the green affirmation lingers

export default function OfflineIndicator() {
  // Fixed amber/green: readable on light and dark themes alike, so this
  // stays theme-independent (no context needed).
  // 'hidden' | 'offline' | 'online' (online = the brief affirmation state)
  const [phase, setPhase] = useState(() => (
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'hidden'
  ));
  const hideTimer = useRef(null);

  useEffect(() => {
    const goOffline = () => {
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
      setPhase('offline');
    };
    const goOnline = () => {
      // Affirm only if the user actually saw the offline state this session.
      setPhase(prev => (prev === 'hidden' ? 'hidden' : 'online'));
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setPhase('hidden'), BACK_ONLINE_MS);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (phase === 'hidden') return null;
  const offline = phase === 'offline';
  const bg = offline ? '#B45309' : '#15803D';

  return (
    <div aria-live="polite" role="status"
         className={`fixed left-0 right-0 flex justify-center z-[70] pointer-events-none ${offline ? 'conn-pill-in' : 'conn-pill-affirm'}`}
         style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-lg"
           style={{ background: bg, color: '#FFFFFF' }}>
        {offline
          ? <WifiOff size={13} strokeWidth={2.5} className="conn-pill-breathe" />
          : <Wifi size={13} strokeWidth={2.5} />}
        <span className="text-[12px] font-semibold leading-none">
          {offline
            ? "You're offline. Progress saves on this device."
            : 'Back online. Your progress is syncing.'}
        </span>
      </div>
    </div>
  );
}
