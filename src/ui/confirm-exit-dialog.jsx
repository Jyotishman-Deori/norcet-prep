// =====================================================================
// CONFIRM-EXIT DIALOG  (Pipeline step 38 / A1 session 4 — batch 1b
// slice 4 — extracted from App.jsx)
// The "Leave this session/mock test?" guard shown by the Quiz screen when
// the user tries to abandon an in-progress round. [A7] theme via useTheme();
// focus management via the shared useFocusTrap lib hook.
// =====================================================================
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { Button, Card } from './primitives.jsx';
import BodyPortal from './body-portal.jsx';

function ConfirmExitDialog({ mode, answered, total, onStay, onLeave }) {
  const { theme: T } = useTheme();
  const dialogRef = useFocusTrap(onStay);
  return (
    <BodyPortal>
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onStay}>
      <Card className="w-full max-w-md anim-scalein"
            onClick={e => e.stopPropagation()}>
        <div className="p-5" ref={dialogRef} role="alertdialog" aria-modal="true"
             aria-label={`Leave this ${mode === 'mock' ? 'mock test' : 'session'}?`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} className="text-accent" />
            <div className="font-display text-lg font-semibold text-ink">
              Leave this {mode === 'mock' ? 'mock test' : 'session'}?
            </div>
          </div>
          <div className="text-sm leading-relaxed mb-4 text-ink-soft">
            Your progress in this {mode === 'mock' ? 'test' : 'round'} won't be saved.
            {answered > 0 && (
              <> You've answered <span style={{ color: T.ink, fontWeight: 600 }}>{answered} of {total}</span> so far. Those answers will be lost.</>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={onStay} className="flex-1">
              Keep going
            </Button>
            <Button variant="accent" onClick={onLeave} className="flex-1">
              Leave anyway
            </Button>
          </div>
        </div>
      </Card>
    </div>
    </BodyPortal>
  );
}

export { ConfirmExitDialog };
