// =====================================================================
// src/ui/exit-snackbar.jsx  (issues round — upgraded from a snackbar to a
// real EXIT CONFIRMATION DIALOG)
// When the device back button is pressed on the Home screen, the app no
// longer closes abruptly: this centred modal asks "Exit app?" with an
// explicit Cancel / Exit choice. The app only exits when the user confirms
// (tapping Exit, or pressing the device back button a second time while
// the dialog is open — the power-user shortcut still works).
// Purely presentational; App owns the history sentinel + the actual exit.
// =====================================================================
import React from 'react';
import { LogOut } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';

export default function ExitConfirmDialog({ visible, onCancel, onExit }) {
  const { theme: T } = useTheme();
  const dialogRef = useFocusTrap(onCancel);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-5"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onCancel}>
      <div className="anim-scalein w-full max-w-sm rounded-3xl p-5"
           style={{ background: T.surface, boxShadow: '0 18px 48px rgba(0,0,0,0.32)' }}
           onClick={(e) => e.stopPropagation()}>
        <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-label="Exit app?">
          <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
               style={{ background: T.primary + '15' }}>
            <LogOut size={18} style={{ color: T.primary }} />
          </div>
          <div className="font-display text-lg font-semibold mb-1.5" style={{ color: T.ink }}>Exit app?</div>
          <div className="text-sm leading-relaxed mb-5" style={{ color: T.inkSoft }}>
            Your progress is saved. You can pick up right where you left off.
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel}
                    className="no-tap-highlight flex-1 py-3 rounded-xl text-sm font-semibold active:scale-95 transition"
                    style={{ background: T.primary, color: '#FFF' }}>
              Cancel
            </button>
            <button onClick={onExit}
                    className="no-tap-highlight flex-1 py-3 rounded-xl text-sm font-medium active:scale-95 transition"
                    style={{ background: 'transparent', color: T.ink, border: `1.5px solid ${T.border}` }}>
              Exit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
