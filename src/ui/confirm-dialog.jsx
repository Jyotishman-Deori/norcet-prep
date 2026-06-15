// =====================================================================
// src/ui/confirm-dialog.jsx  (issues round — confirmation modals)
// ONE reusable, truly-CENTRED confirmation dialog. Renders as a fixed
// overlay at the exact centre of the visible viewport (fixed inset-0 +
// flex centering — equivalent to the top:50%/left:50%/translate(-50%,-50%)
// pattern) with a dimmed backdrop, regardless of how far the page is
// scrolled. NEVER a bottom sheet, never anchored to the trigger.
//
// Used by: Settings (Log out / Switch profile), the Admin Panel leave
// guard, the Welcome-tour leave guard, and the Home hardware-back exit
// confirmation.
//
// Button hierarchy follows platform convention:
//   tone="danger"  → confirm is a RED filled button (destructive action),
//                    cancel is the quiet secondary/ghost button.
//   tone="primary" → confirm is the theme primary filled button.
// =====================================================================
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';

export default function ConfirmDialog({
  open,
  icon = null,                 // optional React node shown in a tinted circle
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',             // 'danger' | 'primary'
  onConfirm,
  onCancel,
}) {
  const { theme: T } = useTheme();
  const dialogRef = useFocusTrap(onCancel);
  if (!open) return null;

  const confirmBg = tone === 'danger' ? T.error : T.primary;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-5"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onCancel}>
      <div className="anim-scalein w-full max-w-sm rounded-3xl p-5"
           style={{ background: T.surface, boxShadow: '0 18px 48px rgba(0,0,0,0.32)' }}
           onClick={(e) => e.stopPropagation()}>
        <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-label={title}>
          {icon && (
            <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
                 style={{ background: (tone === 'danger' ? T.errorSoft : T.primary + '15') }}>
              {icon}
            </div>
          )}
          <div className="font-display text-lg font-semibold mb-1.5" style={{ color: T.ink }}>{title}</div>
          <div className="text-sm leading-relaxed mb-5" style={{ color: T.inkSoft }}>{body}</div>
          <div className="flex gap-2">
            {/* Safe action = quiet secondary */}
            <button onClick={onCancel}
                    className="no-tap-highlight flex-1 py-3 rounded-xl text-sm font-medium active:scale-95 transition"
                    style={{ background: 'transparent', color: T.ink, border: `1.5px solid ${T.border}` }}>
              {cancelLabel}
            </button>
            {/* Destructive / committed action = filled, clearly signalled */}
            <button onClick={onConfirm}
                    className="no-tap-highlight flex-1 py-3 rounded-xl text-sm font-semibold active:scale-95 transition"
                    style={{ background: confirmBg, color: '#FFF', boxShadow: `0 4px 14px ${confirmBg}50` }}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
