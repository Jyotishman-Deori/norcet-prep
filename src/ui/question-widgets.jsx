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
import { AlertCircle, Square, Volume2 } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { topicName } from '../lib/topics.js';
import HelpfulBulb from './helpful-bulb.jsx';


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



// P8 reworked (issues round): the lightbulb-link toggle is replaced by the
// tactile Dosage-style HelpfulBulb everywhere — same shared vote keys, so
// existing tallies carry over untouched. This wrapper keeps the old
// signature so quiz.jsx / crib-sheet.jsx call sites stay one-liners.
function HelpfulToggle({ questionId, explanation, profileId }) {
  if (!profileId || !questionId) return null;
  if (!explanation || !String(explanation).trim()) return null;
  return (
    <div className="mt-3">
      <HelpfulBulb voteId={questionId} profileId={profileId} compact />
    </div>
  );
}

export { HelpfulToggle, QuestionImage, TTSButton };
