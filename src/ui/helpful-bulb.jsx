// =====================================================================
// src/ui/helpful-bulb.jsx  (Feature F-F, reworked in the issues round)
// The "Was this helpful?" glowing bulb — now the SINGLE helpfulness
// interaction used app-wide (regular quizzes and crib sheets render it via
// HelpfulToggle in ui/question-widgets.jsx, which delegates here).
//
// Issues-round changes:
//   • The "0 helpful / 0 not" tally is HIDDEN for everyone (it was
//     meaningless to users and cluttered the row). Admins read the numbers
//     in the Admin Panel → Helpfulness view instead.
//   • Un-tapping is now acknowledged: "Changed your mind? No worries!"
//     appears in the same slot where "Glad it helped" lives.
//   • Easter egg: toggling more than twice in a row earns a light tease
//     ("Still deciding? Take your time 😄" / "You're really keeping me on
//     my toes!") — warm, never disruptive, resets after a quiet moment.
// State reuses lib/helpful-votes.js (same shared keys), so tallies stay
// consistent app-wide. Guests see a static (non-writing) bulb.
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/app-context.jsx';
import { loadHelpfulState, toggleHelpful } from '../lib/helpful-votes.js';
import { GUEST_ID } from '../lib/profiles.js';

const AMBER = '#F5A623';
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * 45) * Math.PI / 180;
  const cx = 24, cy = 19;
  return { x1: cx + Math.cos(a) * 13, y1: cy + Math.sin(a) * 13, x2: cx + Math.cos(a) * 19, y2: cy + Math.sin(a) * 19 };
});

const TEASES = [
  'Still deciding? Take your time \uD83D\uDE04',
  "You're really keeping me on my toes!",
];

// `onVote(next)` — optional observer ('helpful' | 'notHelpful') fired after an
// optimistic toggle; the Ask-companion chat uses it to react to a thumbs-down.
export default function HelpfulBulb({ voteId, profileId, isAdmin = false, compact = false, onVote = null }) {
  const { theme: T } = useTheme();
  const [state, setState] = useState('silent'); // 'silent' | 'helpful' | 'notHelpful'
  // 'none' | 'unhelped' | 'tease' — drives the secondary copy under the title
  const [moment, setMoment] = useState('none');
  const [teaseIdx, setTeaseIdx] = useState(0);
  const togglesRef = useRef(0);           // rapid back-and-forth counter
  const calmTimer = useRef(null);         // resets the counter after a pause
  const isGuest = !profileId || profileId === GUEST_ID || profileId === '__guest__';
  const on = state === 'helpful';

  useEffect(() => {
    let alive = true;
    if (!isGuest) loadHelpfulState(voteId, profileId).then(s => { if (alive) setState(s); }).catch(() => {});
    return () => { alive = false; if (calmTimer.current) clearTimeout(calmTimer.current); };
  }, [voteId, profileId, isGuest]);

  const tap = async () => {
    if (isGuest) return;
    const prev = state;
    const next = prev === 'helpful' ? 'notHelpful' : 'helpful';
    setState(next); // optimistic
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); } catch (e) {}

    // moment + easter-egg bookkeeping
    togglesRef.current += 1;
    if (calmTimer.current) clearTimeout(calmTimer.current);
    calmTimer.current = setTimeout(() => { togglesRef.current = 0; setMoment('none'); }, 6000);
    if (togglesRef.current > 2) {
      setTeaseIdx(togglesRef.current % 2 === 1 ? 0 : 1);
      setMoment('tease');
    } else if (next === 'notHelpful') {
      setMoment('unhelped');           // un-tapped — acknowledge it kindly
    } else {
      setMoment('none');
    }
    try { if (onVote) onVote(next); } catch (e) {}

    try { await toggleHelpful(voteId, profileId, prev); }
    catch (e) { setState(prev); return; } // revert on write failure
  };

  const color = on ? AMBER : T.muted;

  // line 1 (title) + line 2 (hint / acknowledgement / tease)
  let title, hint, hintColor = T.muted;
  if (isGuest) { title = 'Was this helpful?'; hint = 'Sign in to vote'; }
  else if (moment === 'tease') { title = on ? 'Glad it helped' : 'Was this helpful?'; hint = TEASES[teaseIdx]; hintColor = T.primary; }
  else if (on) { title = 'Glad it helped'; hint = 'Tap the bulb to undo'; }
  else if (moment === 'unhelped') { title = 'Changed your mind? No worries!'; hint = 'Tap the bulb if it clicks later'; }
  else { title = 'Was this helpful?'; hint = 'Tap the bulb'; }

  return (
    <div className="flex items-center gap-2.5">
      <button onClick={tap} disabled={isGuest}
              aria-pressed={on} aria-label={on ? 'Marked helpful' : 'Mark helpful'}
              className="no-tap-highlight flex-shrink-0 active:scale-90 transition"
              style={{ cursor: isGuest ? 'default' : 'pointer', lineHeight: 0 }}>
        <svg width={compact ? 30 : 36} height={compact ? 30 : 36} viewBox="0 0 48 48"
             style={{ filter: on ? `drop-shadow(0 0 5px ${AMBER}AA)` : 'none', transition: 'filter .25s' }}>
          {on && <circle cx="24" cy="19" r="17" fill={AMBER} opacity="0.18" className="animate-pulse" />}
          <g stroke={AMBER} strokeWidth="2" strokeLinecap="round" style={{ opacity: on ? 1 : 0, transition: 'opacity .25s' }}>
            {RAYS.map((r, i) => <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />)}
          </g>
          {/* bulb glass */}
          <circle cx="24" cy="19" r="9" fill={on ? AMBER : 'none'} stroke={color} strokeWidth="2.2" style={{ transition: 'all .2s' }} />
          {/* filament hint when on */}
          {on && <path d="M21 19 L24 16 L27 19" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />}
          {/* base */}
          <rect x="20.5" y="27" width="7" height="5" rx="1.6" fill={color} style={{ transition: 'fill .2s' }} />
          <line x1="21.5" y1="34" x2="26.5" y2="34" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ transition: 'stroke .2s' }} />
        </svg>
      </button>

      <div className="min-w-0">
        <div className="text-[12px] font-semibold leading-tight" style={{ color: on ? AMBER : T.inkSoft }} aria-live="polite">
          {title}
        </div>
        <div className="text-[10px] leading-tight mt-0.5" style={{ color: hintColor }}>
          {hint}
        </div>
      </div>
    </div>
  );
}
