// =====================================================================
// CONFIRM-EXIT DIALOG  (Pipeline step 38 / A1 session 4 — batch 1b
// slice 4 — extracted from App.jsx)
// The guard shown by the Quiz screen when the user tries to abandon an
// in-progress round, PLUS the warm "welcome back" note shown when they resume
// one (RESUME feature). [A7] theme via useTheme(); focus management via the
// shared useFocusTrap lib hook. Rendered through BodyPortal so position:fixed
// anchors to the viewport, never a transformed ancestor.
//
// Two exit shapes, chosen by the `resumable` prop:
//   • resumable (untimed practice, resume feature on): a friendly-mentor "save
//     and step away" card. Progress IS saved and can be resumed from Home. Shows
//     a rotating tip + the fixed integrity promise + the water/bathroom note.
//   • not resumable (timed Mock, or the feature off): the original "leave, your
//     progress is lost" guard, with a gentle line about timed tests mirroring the
//     real exam when the run is timed.
//
// Responsive by construction: a centred card, w-full up to max-w-md, generous
// outer padding so it never touches a phone edge, a scroll cap for short
// landscape screens, and 48px+ touch targets on both actions (mobile / tablet /
// desktop, iOS + Android).
// =====================================================================
import React from 'react';
import { AlertCircle, PauseCircle, ShieldCheck, Coffee, Sparkles } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { Button, Card } from './primitives.jsx';
import BodyPortal from './body-portal.jsx';

// Shared shell: dim backdrop + centred, scroll-capped card. `onDismiss` fires on
// backdrop tap (defaults to the safe action, e.g. "stay").
function DialogShell({ label, onDismiss, children }) {
  const dialogRef = useFocusTrap(onDismiss);
  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
           style={{ background: 'rgba(0,0,0,0.5)' }}
           onClick={onDismiss}>
        <Card className="w-full max-w-md anim-scalein max-h-[88vh] overflow-y-auto overscroll-contain"
              onClick={e => e.stopPropagation()}>
          <div className="p-5" ref={dialogRef} role="alertdialog" aria-modal="true" aria-label={label}>
            {children}
          </div>
        </Card>
      </div>
    </BodyPortal>
  );
}

// The fixed "one promise to keep" callout — shown EVERY resume-related prompt so
// the integrity reminder never rotates away. A bordered tint keeps it distinct
// from the rotating tip above it.
function IntegrityCallout({ text, T }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl p-3 mb-2.5"
         style={{ background: T.primary + '12', border: `1px solid ${T.primary}30` }}>
      <ShieldCheck size={17} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} aria-hidden="true" />
      <div className="text-[13px] leading-relaxed" style={{ color: T.ink }}>{text}</div>
    </div>
  );
}

function BreakNote({ text, T }) {
  return (
    <div className="flex items-start gap-2 mb-1">
      <Coffee size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.muted }} aria-hidden="true" />
      <div className="text-[12px] leading-relaxed" style={{ color: T.muted }}>{text}</div>
    </div>
  );
}

// ConfirmExitDialog — the leave guard. Backward compatible: the original
// (mode, answered, total, onStay, onLeave) call still works. Resume adds the
// optional (timed, resumable, exitTip, integrity, breakNote, onSaveExit) props.
function ConfirmExitDialog({
  mode, answered, total, onStay, onLeave,
  timed = false, resumable = false, exitTip = '', integrity = '', breakNote = '', onSaveExit,
}) {
  const { theme: T } = useTheme();

  // ---- Resumable: friendly-mentor "save and step away" ----
  if (resumable) {
    return (
      <DialogShell label="Save and step away?" onDismiss={onStay}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: T.primary + '18' }}>
            <PauseCircle size={19} style={{ color: T.primary }} aria-hidden="true" />
          </div>
          <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>
            Save and step away?
          </div>
        </div>

        <div className="text-sm leading-relaxed mb-2.5" style={{ color: T.inkSoft }}>
          Your progress is saved on this device.
          {answered > 0 && (
            <> You have answered <span style={{ color: T.ink, fontWeight: 600 }}>{answered} of {total}</span>.</>
          )}{' '}
          You can pick this set back up from your Home screen.
        </div>

        {exitTip && (
          <div className="text-[13px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>{exitTip}</div>
        )}

        {integrity && <IntegrityCallout text={integrity} T={T} />}
        {breakNote && <BreakNote text={breakNote} T={T} />}

        {/* Exiting is NOT destructive here (progress is saved), so the exit
            action is a calm ghost, not an alarming accent. */}
        <div className="flex gap-2.5 mt-4">
          <Button onClick={onStay} className="flex-1 min-h-[48px]">
            Keep going
          </Button>
          <Button variant="ghost" onClick={onSaveExit} className="flex-1 min-h-[48px]">
            Save and exit
          </Button>
        </div>
      </DialogShell>
    );
  }

  // ---- Not resumable: the original leave-and-lose guard ----
  const label = `Leave this ${mode === 'mock' ? 'mock test' : 'session'}?`;
  return (
    <DialogShell label={label} onDismiss={onStay}>
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle size={18} className="text-accent" aria-hidden="true" />
        <div className="font-display text-lg font-semibold text-ink">
          Leave this {mode === 'mock' ? 'mock test' : 'session'}?
        </div>
      </div>
      <div className="text-sm leading-relaxed mb-4 text-ink-soft">
        {timed && (
          <>This one is timed like the real exam, so leaving ends it. </>
        )}
        Your progress in this {mode === 'mock' ? 'test' : 'round'} won't be saved.
        {answered > 0 && (
          <> You've answered <span style={{ color: T.ink, fontWeight: 600 }}>{answered} of {total}</span> so far. Those answers will be lost.</>
        )}
      </div>
      <div className="flex gap-2.5">
        <Button onClick={onStay} className="flex-1 min-h-[48px]">
          Keep going
        </Button>
        <Button variant="accent" onClick={onLeave} className="flex-1 min-h-[48px]">
          Leave anyway
        </Button>
      </div>
    </DialogShell>
  );
}

// ResumeWelcomeDialog — the warm "welcome back" note shown once when a saved run
// is reopened, before the first question. A rotating resume tip + the same fixed
// integrity promise, then a single "Continue" action.
function ResumeWelcomeDialog({ resumeTip = '', integrity = '', answered = 0, total = 0, onContinue }) {
  const { theme: T } = useTheme();
  return (
    <DialogShell label="Welcome back" onDismiss={onContinue}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
             style={{ background: T.success + '1E' }}>
          <Sparkles size={19} style={{ color: T.success }} aria-hidden="true" />
        </div>
        <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>
          Welcome back
        </div>
      </div>

      <div className="text-sm leading-relaxed mb-2.5" style={{ color: T.inkSoft }}>
        You are picking up where you left off
        {total > 0 && (
          <>, <span style={{ color: T.ink, fontWeight: 600 }}>{answered} of {total}</span> answered</>
        )}.
      </div>

      {resumeTip && (
        <div className="text-[13px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>{resumeTip}</div>
      )}

      {integrity && <IntegrityCallout text={integrity} T={T} />}

      <div className="mt-4">
        <Button onClick={onContinue} className="w-full min-h-[48px]">
          Continue
        </Button>
      </div>
    </DialogShell>
  );
}

export { ConfirmExitDialog, ResumeWelcomeDialog };
