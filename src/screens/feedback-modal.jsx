// =====================================================================
// src/screens/feedback-modal.jsx — "Report or suggest" dialog, hosted once at
// the app root (FeedbackHost) and opened via requestFeedback() (A1 slice 38).
// Same root-mount reasoning as SupportHost/HelpHost (avoid transformed
// ancestors breaking position:fixed). FeedbackModal gains a useTheme() hook
// (was a bare-T reader). Render site (<FeedbackHost/>) unchanged.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Check, X, RefreshCw, Send } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { registerFeedbackOpener, Button } from '../ui/primitives.jsx';
import { newFeedbackId, saveFeedback, addToMyFeedbackIndex } from '../lib/feedback.js';

function FeedbackHost() {
  const [ctx, setCtx] = useState(null); // null = closed
  useEffect(() => {
    registerFeedbackOpener((c) => setCtx(c || {}));
    return () => { registerFeedbackOpener(null); };
  }, []);
  if (!ctx) return null;
  return (
    <FeedbackModal screen={ctx.screen} questionId={ctx.questionId}
                   profileId={ctx.profileId} profileName={ctx.profileName}
                   onClose={() => setCtx(null)} />
  );
}

function FeedbackModal({ screen, questionId, profileId, profileName, onClose }) {
  const { theme: T } = useTheme();
  const [report, setReport] = useState('');
  const [fix, setFix] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!report.trim()) { setErr('Please describe the issue or suggestion'); return; }
    setSubmitting(true);
    try {
      const id = newFeedbackId();
      await saveFeedback({
        id,
        ts: Date.now(),
        screen: screen || 'unknown',
        questionId: questionId || null,
        report: report.trim(),
        fix: fix.trim() || null,
        profileId: profileId || null,
        profileName: profileName || null
      });
      // Point the author's own index at this report so their device can find it
      // without ever fetching anyone else's feedback.
      if (profileId) await addToMyFeedbackIndex(profileId, id);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr('Could not send. Try again.');
      setSubmitting(false);
    }
  };

  // This modal is rendered at the APP ROOT (see <FeedbackHost/> in App), not
  // inside a screen. Screen wrappers carry an `anim-fadeup` animation whose
  // `both` fill-mode leaves a lingering `transform`, and a transformed ancestor
  // makes `position: fixed` anchor to THAT element instead of the viewport —
  // which dropped this modal into the middle of the (tall) page and cropped it.
  // Rendering at the root (no transformed ancestor) restores true
  // viewport-relative centering, the same trick the nav drawer uses.
  const dialogRef = useFocusTrap(onClose);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           ref={dialogRef} role="dialog" aria-modal="true" aria-label="Report or suggest"
           className="w-full max-w-md anim-scalein flex flex-col rounded-2xl overflow-hidden"
           style={{
             background: T.surface,
             border: `1px solid ${T.border}`,
             maxHeight: 'min(88dvh, 660px)',
             boxShadow: '0 12px 40px rgba(0,0,0,0.25)'
           }}>
        {done ? (
          <div className="text-center px-6 py-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                 style={{ background: T.successSoft }}>
              <Check size={24} style={{ color: T.success }} />
            </div>
            <div className="font-display text-lg font-semibold mb-1" style={{ color: T.ink }}>Sent</div>
            <div className="text-sm" style={{ color: T.muted }}>Thanks — the admin will see it.</div>
          </div>
        ) : (
          <>
            {/* Pinned header — always visible */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Report or suggest</div>
              <button onClick={onClose} className="no-tap-highlight p-1.5 -m-1.5 rounded-lg active:bg-black/5" aria-label="Close">
                <X size={18} style={{ color: T.muted }} />
              </button>
            </div>

            {/* Scrollable body — the form scrolls here if it's taller than the sheet */}
            <div className="px-5 overflow-y-auto overscroll-contain flex-1 min-h-0"
                 style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="mb-4 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 text-xs"
                   style={{ background: T.surfaceWarm, color: T.muted }}>
                <span>From:</span>
                <span className="font-medium" style={{ color: T.inkSoft }}>{screen || 'unknown'}</span>
                {questionId && (<><span>·</span><span className="font-mono">{questionId}</span></>)}
              </div>

              <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                Report a bug or suggest a feature <span style={{ color: T.error }}>*</span>
              </div>
              <textarea value={report} onChange={e => setReport(e.target.value)}
                        aria-label="Report a bug or suggest a feature (required)"
                        placeholder="What's wrong, or what would you like?" rows={4}
                        className="w-full rounded-xl px-3 py-3 mb-4 text-sm resize-none"
                        style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }} />

              <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                Your suggested fix <span className="font-normal normal-case">(optional)</span>
              </div>
              <textarea value={fix} onChange={e => setFix(e.target.value)}
                        aria-label="Your suggested fix (optional)"
                        placeholder="How should it work instead?" rows={3}
                        className="w-full rounded-xl px-3 py-3 mb-2 text-sm resize-none"
                        style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }} />

              {err && (
                <div className="text-xs mb-2 px-1" style={{ color: T.error }}>{err}</div>
              )}
            </div>

            {/* Pinned footer — actions always reachable */}
            <div className="flex gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={submit} disabled={submitting || !report.trim()} className="flex-1"
                      icon={submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}>
                {submitting ? 'Sending' : 'Send'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { FeedbackHost, FeedbackModal };
export default FeedbackHost;
