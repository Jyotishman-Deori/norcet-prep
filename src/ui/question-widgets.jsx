// =====================================================================
// SHARED QUESTION WIDGETS  (Pipeline step 38 / A1 session 4 — batch 1b
// slice 2 — extracted from App.jsx)
// The two presentational leaves rendered on every question-bearing surface
// (Quiz, AdvancedTestResults, DosageResults, Reference): the lazy question
// figure and the text-to-speech button.
//
// [A7] Both read the active theme via useTheme() (was the module-level T
// bridge). No data / profile / storage coupling — pure presentation.
// =====================================================================
import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Lightbulb, Square, Volume2 } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { topicName } from '../lib/topics.js';
import { loadHelpfulState, toggleHelpful } from '../lib/helpful-votes.js';


function QuestionImage({ q }) {
  const { theme: T } = useTheme();
  const [failed, setFailed] = useState(false);
  // Reset the error state if the question (and thus the image) changes.
  useEffect(() => { setFailed(false); }, [q && q.id]);
  if (!q || !q.image) return null;
  const alt = `Figure for question${q.sub ? ` on ${q.sub}` : (q.topic ? ` on ${topicName(q.topic)}` : '')}`;
  if (failed) {
    return (
      <div className="mb-4 rounded-xl flex items-center justify-center gap-2 text-xs"
           style={{ background: T.surfaceWarm, border: `1px dashed ${T.border}`, color: T.muted, minHeight: 80 }}>
        <AlertCircle size={14} />
        <span>Image unavailable</span>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <img src={q.image} alt={alt} loading="lazy" onError={() => setFailed(true)}
           className="w-full rounded-xl"
           style={{ maxHeight: 340, objectFit: 'contain', border: `1px solid ${T.border}`, background: T.surface }} />
    </div>
  );
}


function TTSButton({ text, size = 14, label, className = '', tone = 'soft' }) {
  const { theme: T } = useTheme();
  const [speaking, setSpeaking] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // The "stay mounted across question changes" lifecycle is the tricky part
  // here. The Quiz screen reuses the SAME TTSButton instance while cycling
  // through questions — only its `text` prop changes — so a plain unmount
  // cleanup never fires when the user moves to the next question.
  //
  // We therefore cancel any in-flight speech whenever:
  //   (a) the text being spoken changes (next question / explanation toggle), or
  //   (b) the component finally unmounts.
  // This keeps the speech aligned with what's on screen.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      // Only reset state if we're still mounted (text changed); after a real
      // unmount the state is discarded anyway, so skip the no-op update.
      if (mountedRef.current) setSpeaking(false);
    };
  }, [text]);

  const supported = typeof window !== 'undefined' && !!window.speechSynthesis && !!window.SpeechSynthesisUtterance;
  if (!supported) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    if (speaking) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
      setSpeaking(false);
      return;
    }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    const u = new window.SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    u.lang = 'en-IN';
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    try { window.speechSynthesis.speak(u); } catch (e) { setSpeaking(false); }
  };

  const baseStyle = tone === 'soft'
    ? { background: T.surfaceWarm, color: T.inkSoft, border: `1px solid ${T.border}` }
    : { background: 'transparent', color: T.muted, border: 'none' };
  const activeStyle = speaking
    ? { background: T.primary, color: '#FFF', border: `1px solid ${T.primary}` }
    : baseStyle;

  return (
    <button onClick={handleClick} type="button" aria-label={label || (speaking ? 'Stop' : 'Read aloud')}
            className={`no-tap-highlight inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors active:scale-95 ${className}`}
            style={activeStyle}>
      {speaking ? <Square size={size - 2} /> : <Volume2 size={size} />}
      {label && <span>{speaking ? 'Stop' : label}</span>}
    </button>
  );
}



// First-tap-per-session flag for the "thanks" confirmation (resets on reload).
let helpfulThanksShownThisSession = false;

function HelpfulToggle({ questionId, explanation, profileId }) {
  const { theme: T } = useTheme();
  const [state, setState] = useState('silent'); // 'silent' | 'helpful' | 'notHelpful'
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Load this user's current state for this question.
  useEffect(() => {
    if (!questionId || !profileId) return;
    let alive = true;
    loadHelpfulState(questionId, profileId).then(s => { if (alive && mounted.current) setState(s); }).catch(() => {});
    return () => { alive = false; };
  }, [questionId, profileId]);

  // Edge cases: no profile, or nothing to evaluate -> render nothing.
  if (!profileId || !questionId) return null;
  if (!explanation || !String(explanation).trim()) return null;

  const lit = state === 'helpful';
  const accent = T.accent;

  const onTap = async () => {
    if (busy) return;
    const prev = state;
    const next = prev === 'helpful' ? 'notHelpful' : 'helpful';
    setState(next);           // optimistic
    setBusy(true);
    try {
      await toggleHelpful(questionId, profileId, prev);
      if (!helpfulThanksShownThisSession) {
        helpfulThanksShownThisSession = true;
        if (mounted.current) {
          setThanks(true);
          setTimeout(() => { if (mounted.current) setThanks(false); }, 2600);
        }
      }
    } catch (e) {
      // Offline / write failed — revert quietly, no error toast (edge case).
      if (mounted.current) setState(prev);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="text-xs" style={{ color: T.muted }}>Was this helpful?</span>
      <button onClick={onTap} disabled={busy}
              className="no-tap-highlight p-1 rounded-full active:scale-95"
              style={{ transition: 'transform 120ms ease-out' }}
              aria-pressed={lit}
              aria-label={lit ? 'Marked helpful — tap to mark not helpful' : 'Mark explanation helpful'}>
        <Lightbulb size={18}
                   style={{
                     color: lit ? accent : T.muted,
                     fill: lit ? accent : 'transparent',
                     filter: lit ? `drop-shadow(0 0 5px ${accent}AA)` : 'none',
                     transition: 'color 200ms ease-out, fill 200ms ease-out, filter 200ms ease-out'
                   }} />
      </button>
      {thanks && (
        <span className="text-xs anim-fadeup" role="status" aria-live="polite" style={{ color: T.success }}>
          Thanks — your feedback helps us improve.
        </span>
      )}
    </div>
  );
}

export { HelpfulToggle, QuestionImage, TTSButton };
