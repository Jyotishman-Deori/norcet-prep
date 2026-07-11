// =====================================================================
// src/ui/clinical-note.jsx — Layer 2b: the ONE-TIME "you are in a practice
// environment" note shown before the first Dosage session and the first
// Level Up game launch. Quiet by design: it appears exactly once per
// profile (a preferences.*Seen flag owned by the host screen), has a single
// affirmative button, and never a delay timer. Centred + portaled to <body>
// (same transform-safe pattern as ConfirmDialog).
//
// Contract:
//   onAcknowledge — the button: mark the flag AND continue the blocked action.
//   onClose       — backdrop/Esc: mark the flag and just close (no action);
//                   the user taps the original button again, now ungated.
// =====================================================================
import React from 'react';
import { createPortal } from 'react-dom';
import { Stethoscope } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';

export default function ClinicalNote({ open, title, body, buttonLabel = 'Understood', onAcknowledge, onClose }) {
  const { theme: T } = useTheme();
  const dialogRef = useFocusTrap(onClose);
  if (!open) return null;

  const overlay = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-5"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onClose}>
      <div className="anim-scalein w-full max-w-sm rounded-3xl p-5"
           style={{ background: T.surface, boxShadow: '0 18px 48px rgba(0,0,0,0.32)' }}
           onClick={(e) => e.stopPropagation()}>
        <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-label={title}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
               style={{ background: T.primary + '15' }}>
            <Stethoscope size={20} style={{ color: T.primary }} />
          </div>
          <div className="font-display text-lg font-semibold mb-1.5" style={{ color: T.ink }}>{title}</div>
          <div className="text-sm leading-relaxed mb-5" style={{ color: T.inkSoft }}>{body}</div>
          <button onClick={onAcknowledge}
                  className="no-tap-highlight w-full py-3 rounded-xl text-sm font-semibold active:scale-95 transition"
                  style={{ background: T.primary, color: '#FFF', boxShadow: `0 4px 14px ${T.primary}50` }}>
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
  return (typeof document !== 'undefined' && document.body) ? createPortal(overlay, document.body) : overlay;
}
