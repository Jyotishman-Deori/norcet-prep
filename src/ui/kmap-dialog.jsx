// =====================================================================
// src/ui/kmap-dialog.jsx — the ONE overlay pattern for every Knowledge-Map
// popup (node HUD, note editor, "how it works" guide).
//
// WHY: the node popup and note editor were bottom sheets sized in `vh`,
// which (a) looked broken at the foot of a tall tablet/desktop screen,
// (b) overflowed the visible viewport when mobile browser chrome retracts
// (`vh` ≠ visible height — the guide dialog hit exactly this and was fixed
// with a `dvh` clamp, knowledge-map.jsx "was a bottom sheet" note), and
// (c) rendered inside the screen subtree where an animating ancestor's
// transform can contain `position:fixed` and shove the overlay off-centre.
//
// This dialog is: PORTALED to <body> (same guard as ConfirmDialog/TopBar),
// ALWAYS viewport-centred on every breakpoint, and FIXED-SIZE — width is
// pure px (`min(maxWidth, 100vw - padding)`), height caps at
// `min(620px, 100dvh - safe areas)`. Nothing about it can vary with map
// zoom, container width, or fullscreen state. Content scrolls internally.
// Dark HUD shell on purpose: these dialogs float over the map's dark
// constellation island, not over the light app theme.
// =====================================================================
import React from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../lib/use-focus-trap.js';

// Mirrors the map's CMAP / node-popup HUD palette.
const SHELL = {
  surface: '#121A2E',
  border: 'rgba(255,255,255,0.14)',
  scrim: 'radial-gradient(ellipse at center, rgba(10,14,28,0.45), rgba(7,10,20,0.85))',
};

function KmapDialog({ label, onClose, children, zIndex = 90, maxWidth = 420 }) {
  const trapRef = useFocusTrap(onClose);
  const overlay = (
    <div className="fixed inset-0 flex items-center justify-center p-4 kmap-scrim-in"
         style={{ zIndex, background: SHELL.scrim }}
         onClick={onClose}>
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label={label}
           className="w-full rounded-3xl anim-scalein"
           style={{ maxWidth,
                    background: SHELL.surface,
                    border: `1px solid ${SHELL.border}`,
                    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
                    maxHeight: 'min(620px, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 40px))',
                    overflowY: 'auto', overscrollBehavior: 'contain' }}
           onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
  return (typeof document !== 'undefined' && document.body) ? createPortal(overlay, document.body) : overlay;
}

export default KmapDialog;
