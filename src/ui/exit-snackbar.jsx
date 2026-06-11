// =====================================================================
// src/ui/exit-snackbar.jsx  (#30 — Home back-press exit confirmation)
// The "Press back again to exit" pill. Slides up from the bottom edge when
// the user presses the hardware back button on Home; a thin progress line
// depletes over the 2.5s confirmation window, after which App hides it.
// No buttons — the gesture itself (a second back press) is the confirmation,
// same pattern as WhatsApp / YouTube. Purely presentational; App owns the
// timing + the actual exit.
// =====================================================================
import React from 'react';

export default function ExitSnackbar({ visible }) {
  if (!visible) return null;
  return (
    <div className="exit-snack-in fixed left-1/2 z-[95] flex flex-col overflow-hidden"
         style={{
           bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
           transform: 'translateX(-50%)',
           background: 'rgba(15, 5, 25, 0.88)',
           borderRadius: 24,
           height: 48,
           minWidth: 220,
           boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
           pointerEvents: 'none',
         }}
         role="status" aria-live="polite">
      <div className="flex-1 flex items-center px-5">
        <span style={{ color: '#FFF', fontSize: 13, fontWeight: 500 }}>Press back again to exit</span>
      </div>
      <div className="px-3 pb-1">
        <div className="exit-snack-bar" style={{ height: 2, background: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
      </div>
    </div>
  );
}
