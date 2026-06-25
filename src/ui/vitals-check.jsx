// =====================================================================
// src/ui/vitals-check.jsx — PHIL-06 "Vitals Check"
// Philosophical root: Jidoka — stop the line the moment a fatal error occurs.
//
// When a FOUNDATIONAL (must-know survival protocol) question is answered wrong,
// the session is forcibly paused and this full-screen overlay enforces a short
// rationale read before resuming. Rendered through a React Portal so no z-index
// conflict can bury it. The tone is protective, never punitive — this is the
// one a Nursing Officer can't miss on the floor, so we slow down on purpose.
//
// Props:
//   open       — boolean
//   question   — the missed question (reads q.q + q.exp)
//   minSeconds — enforced minimum read (default 20)
//   onResume   — called when the user confirms after the countdown
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HeartPulse, ShieldCheck } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

const ACCENT = '#DC2626'; // clinical red

export default function VitalsCheck({ open, question, minSeconds, onResume }) {
  const { theme: T } = useTheme();
  // Smart, brisk enforced read: scale with the rationale length so a short "why"
  // isn't a long wait. ~0.28s/word, clamped to [5, 10]s (was a flat 20s).
  const dwell = useMemo(() => {
    if (typeof minSeconds === 'number') return minSeconds;
    const words = question && question.exp ? String(question.exp).trim().split(/\s+/).filter(Boolean).length : 0;
    return Math.max(5, Math.min(10, Math.round(words * 0.28)));
  }, [minSeconds, question]);
  const [left, setLeft] = useState(dwell);

  // Restart the countdown each time the overlay opens for a new question.
  useEffect(() => {
    if (!open) return undefined;
    setLeft(dwell);
    const started = Date.now();
    const id = setInterval(() => {
      const rem = Math.max(0, dwell - Math.floor((Date.now() - started) / 1000));
      setLeft(rem);
      if (rem <= 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [open, question && question.id, dwell]);

  if (!open || !question || typeof document === 'undefined') return null;

  const ready = left <= 0;
  const pct = Math.max(0, Math.min(100, ((dwell - left) / dwell) * 100));

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center px-4"
         style={{ zIndex: 2147483000, background: 'rgba(8,10,14,0.78)', backdropFilter: 'blur(4px)' }}
         role="alertdialog" aria-modal="true" aria-label="Vitals Check">
      <div className="anim-fadeup w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
           style={{ background: T.bg, border: `1px solid ${ACCENT}55`, boxShadow: '0 24px 70px rgba(0,0,0,0.5)', maxHeight: '88vh' }}>
        {/* header */}
        <div className="px-5 pt-5 pb-4" style={{ background: `linear-gradient(180deg, ${ACCENT}1A, transparent)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: ACCENT + '1F', border: `1px solid ${ACCENT}55` }}>
              <HeartPulse size={20} style={{ color: ACCENT }} className="timer-beat" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>Vitals Check</div>
              <div className="font-display text-lg font-semibold leading-tight" style={{ color: T.ink }}>A must-know one slipped</div>
            </div>
          </div>
          <div className="text-[13px] leading-relaxed mt-3" style={{ color: T.inkSoft }}>
            We've paused here on purpose. This is a foundational survival protocol — the kind a Nursing Officer can't
            afford to miss on the floor. Take a moment to lock in the <i>why</i>, then carry on.
          </div>
        </div>

        {/* rationale (scrollable) */}
        <div className="px-5 py-4 overflow-y-auto" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.muted }}>The question</div>
          <div className="text-[13px] leading-snug mb-3" style={{ color: T.ink }}>{question.q}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: T.muted }}>Why it matters</div>
          <div className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: T.inkSoft }}>
            {question.exp || 'Review this protocol carefully before moving on.'}
          </div>
        </div>

        {/* footer — enforced read countdown, then resume */}
        <div className="px-5 pt-3 pb-5" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          {!ready && (
            <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: T.borderSoft }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT, transition: 'width 0.25s linear' }} />
            </div>
          )}
          <button onClick={ready ? onResume : undefined} disabled={!ready}
                  className="no-tap-highlight w-full py-3.5 rounded-2xl text-sm font-semibold transition active:scale-[0.99]"
                  style={ready
                    ? { background: ACCENT, color: '#FFF', boxShadow: `0 10px 24px ${ACCENT}55` }
                    : { background: T.surfaceWarm, color: T.muted, cursor: 'default' }}>
            {ready
              ? (<span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> I understand — resume</span>)
              : `Read the rationale · resume in ${left}s`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
