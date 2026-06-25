// =====================================================================
// src/ui/code-blue.jsx — PHIL-02 "Code Blue Mode"
// Philosophical root: Logotherapy — suffering ceases when it finds meaning.
//
// When a learner is crashing (3 wrong answers in a row this session), failure is
// reframed as a clinical emergency, not a verdict. Scores/timers vanish; a dark,
// minimalist recovery drill of their own recent mistakes appears (easiest first).
// Clear all of them to "stabilise the patient" and resume. A small, always-
// present exit means the user can never be trapped (single boolean flag — never
// a half-state). Rendered through a Portal so nothing can bury it.
//
// Props:
//   open       — boolean
//   questions  — pre-loaded recovery set (this session's wrong questions)
//   onResolve  — cleared all recovery questions
//   onExit     — manual bail-out (small corner button)
// =====================================================================
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Activity, X, Check, ShieldCheck, ChevronRight } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { arraysEqualUnordered } from '../lib/utils.js';

const BLUE = '#1D4ED8';
const RED = '#DC2626';
const INK = '#E5E7EB';
const SURFACE = '#111827';
const SURFACE2 = '#1F2937';
const BORDER = 'rgba(255,255,255,0.10)';

const reduced = () => {
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
};

// Module-scope so its identity is stable across renders (an inner component
// would remount the whole subtree every render — flicker + lost scroll/state).
function Shell({ onExit, children }) {
  return (
    <div className="fixed inset-0 flex flex-col"
         style={{ zIndex: 2147483100, background: SURFACE, color: INK }}
         role="dialog" aria-modal="true" aria-label="Code Blue">
      {/* always-present, unobtrusive exit so the user is never trapped */}
      <button onClick={onExit} aria-label="Exit Code Blue"
              className="no-tap-highlight absolute top-3 right-3 z-10 p-2 rounded-full active:scale-90"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}>
        <X size={18} />
      </button>
      {children}
    </div>
  );
}

export default function CodeBlue({ open, questions = [], onResolve, onExit }) {
  useTheme(); // keep hook order stable; Code Blue uses its own fixed dark palette
  const [phase, setPhase] = useState('flash');   // flash | brief | drill | resolved
  const [flashOn, setFlashOn] = useState(true);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState([]);
  const [checked, setChecked] = useState(false);
  const [wasRight, setWasRight] = useState(false);

  // Reset + run the 2s blue/red flash whenever Code Blue opens.
  useEffect(() => {
    if (!open) return undefined;
    setPhase(reduced() ? 'brief' : 'flash');
    setIdx(0); setSelected([]); setChecked(false); setWasRight(false);
    if (reduced()) return undefined;
    const flick = setInterval(() => setFlashOn(f => !f), 280);
    const done = setTimeout(() => { clearInterval(flick); setPhase('brief'); }, 2000);
    return () => { clearInterval(flick); clearTimeout(done); };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const q = questions[idx] || null;
  const total = questions.length;

  const toggle = (i) => {
    if (checked && wasRight) return;
    if (checked && !wasRight) { setChecked(false); } // re-arming after a miss
    if (!q) return;
    if (q.type === 'mcq') setSelected(prev => (prev[0] === i ? [] : [i]));
    else setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const check = () => {
    if (!q || selected.length === 0) return;
    const ok = arraysEqualUnordered(selected, q.correct);
    setWasRight(ok);
    setChecked(true);
    if (ok) {
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
      setTimeout(() => {
        if (idx + 1 >= total) setPhase('resolved');
        else { setIdx(i => i + 1); setSelected([]); setChecked(false); setWasRight(false); }
      }, 850);
    }
  };

  const tryAgain = () => { setChecked(false); setSelected([]); setWasRight(false); };

  // ── Phase: FLASH ──────────────────────────────────────────────
  if (phase === 'flash') {
    return createPortal(
      <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2147483100, background: flashOn ? BLUE : RED, transition: 'background 0.18s linear' }}>
        <div className="text-center px-6">
          <Activity size={56} color="#FFF" className="mx-auto mb-3" />
          <div className="font-display text-3xl font-bold tracking-wide" style={{ color: '#FFF' }}>CODE BLUE</div>
        </div>
      </div>,
      document.body
    );
  }

  // ── Phase: BRIEF (the prompt) ─────────────────────────────────
  if (phase === 'brief') {
    return createPortal(
      <Shell onExit={onExit}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center anim-fadeup max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
               style={{ background: RED + '22', border: `1px solid ${RED}66` }}>
            <Activity size={30} style={{ color: RED }} className="timer-beat" />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: RED }}>Code Blue</div>
          <div className="font-display text-2xl font-semibold mb-3" style={{ color: '#FFF' }}>Let's resuscitate your concepts</div>
          <div className="text-[14px] leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.78)' }}>
            Your accuracy is crashing — and that's okay. Stop worrying about the score. The timer is paused.
            Let's do a calm, focused deep-dive on your {total} priority {total === 1 ? 'mistake' : 'mistakes'}, then get back to it.
          </div>
          <button onClick={() => setPhase('drill')}
                  className="no-tap-highlight w-full max-w-xs py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.99]"
                  style={{ background: BLUE, color: '#FFF', boxShadow: `0 12px 28px ${BLUE}66` }}>
            Begin recovery
          </button>
        </div>
      </Shell>,
      document.body
    );
  }

  // ── Phase: RESOLVED ───────────────────────────────────────────
  if (phase === 'resolved') {
    return createPortal(
      <Shell onExit={onExit}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center anim-fadeup max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
               style={{ background: '#16A34A22', border: '1px solid #16A34A66' }}>
            <ShieldCheck size={30} style={{ color: '#22C55E' }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-2" style={{ color: '#FFF' }}>Code Blue resolved</div>
          <div className="text-[14px] leading-relaxed mb-1.5" style={{ color: 'rgba(255,255,255,0.82)' }}>
            You stabilised the patient. That's what recovery looks like — facing the gap and closing it.
          </div>
          <div className="text-[12px] mb-8" style={{ color: '#22C55E' }}>+1 Heart restored · keep going.</div>
          <button onClick={onResolve}
                  className="no-tap-highlight w-full max-w-xs py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.99]"
                  style={{ background: '#16A34A', color: '#FFF', boxShadow: '0 12px 28px rgba(22,163,74,0.5)' }}>
            Resume practice
          </button>
        </div>
      </Shell>,
      document.body
    );
  }

  // ── Phase: DRILL ──────────────────────────────────────────────
  return createPortal(
    <Shell onExit={onExit}>
      <div className="px-5 pt-14 pb-5 flex-1 flex flex-col max-w-md mx-auto w-full overflow-y-auto">
        {/* progress dots */}
        <div className="flex items-center gap-1.5 mb-4">
          {questions.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full flex-1"
                 style={{ background: i < idx ? '#22C55E' : i === idx ? BLUE : 'rgba(255,255,255,0.12)' }} />
          ))}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: RED }}>
          Recovery · {idx + 1} of {total}
        </div>

        {q && (
          <>
            <div className="text-[16px] leading-snug font-medium mb-4" style={{ color: '#FFF' }}>{q.q}</div>
            <div className="space-y-2.5 mb-4">
              {q.options.map((opt, i) => {
                const isSel = selected.includes(i);
                const isCorrect = q.correct.includes(i);
                let bg = SURFACE2, bd = BORDER, fg = INK;
                if (checked && wasRight && isCorrect) { bg = '#16A34A22'; bd = '#16A34A88'; fg = '#FFF'; }
                else if (checked && !wasRight && isSel) { bg = RED + '22'; bd = RED + '88'; fg = '#FFF'; }
                else if (isSel) { bg = BLUE + '26'; bd = BLUE + '99'; fg = '#FFF'; }
                return (
                  <button key={i} onClick={() => toggle(i)}
                          className="no-tap-highlight w-full text-left px-4 py-3 rounded-xl text-[14px] transition active:scale-[0.99]"
                          style={{ background: bg, border: `1.5px solid ${bd}`, color: fg }}>
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* miss → gentle explanation + try again */}
            {checked && !wasRight && (
              <div className="rounded-xl px-3.5 py-3 mb-4 anim-fadeup" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}` }}>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Not yet — here's why</div>
                <div className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{q.exp || 'Review and try again.'}</div>
              </div>
            )}

            <div className="mt-auto pt-2">
              {checked && wasRight ? (
                <div className="w-full py-3.5 rounded-2xl text-sm font-semibold text-center inline-flex items-center justify-center gap-2"
                     style={{ background: '#16A34A22', color: '#22C55E', border: '1px solid #16A34A66' }}>
                  <Check size={16} /> Stabilised{idx + 1 < total ? <> · next <ChevronRight size={14} /></> : ' ✓'}
                </div>
              ) : checked && !wasRight ? (
                <button onClick={tryAgain}
                        className="no-tap-highlight w-full py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.99]"
                        style={{ background: SURFACE2, color: '#FFF', border: `1.5px solid ${BORDER}` }}>
                  Try again
                </button>
              ) : (
                <button onClick={check} disabled={selected.length === 0}
                        className="no-tap-highlight w-full py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.99] disabled:opacity-40"
                        style={{ background: BLUE, color: '#FFF' }}>
                  Check
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>,
    document.body
  );
}
