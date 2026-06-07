// =====================================================================
// src/ui/helpful-bulb.jsx  (Feature F-F)
// The "Was this helpful?" glowing bulb. Off = dim outline; On = amber fill
// with a soft halo + radiating rays. One tap toggles (helpful <-> off), with
// a light haptic. State + tallies reuse lib/helpful-votes.js (the same shared
// keys), so counts stay consistent app-wide. Counts are shown to admins only.
// Guests see a static (non-writing) bulb — they can't move the shared tally.
// =====================================================================
import React, { useEffect, useState } from 'react';
import { useTheme } from '../lib/app-context.jsx';
import { loadHelpfulState, toggleHelpful } from '../lib/helpful-votes.js';
import { loadHelpfulCounts } from '../lib/faq.js';
import { GUEST_ID } from '../lib/profiles.js';

const AMBER = '#F5A623';
const RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * 45) * Math.PI / 180;
  const cx = 24, cy = 19;
  return { x1: cx + Math.cos(a) * 13, y1: cy + Math.sin(a) * 13, x2: cx + Math.cos(a) * 19, y2: cy + Math.sin(a) * 19 };
});

export default function HelpfulBulb({ voteId, profileId, isAdmin = false, compact = false }) {
  const { theme: T } = useTheme();
  const [state, setState] = useState('silent'); // 'silent' | 'helpful' | 'notHelpful'
  const [counts, setCounts] = useState(null);
  const isGuest = !profileId || profileId === GUEST_ID || profileId === '__guest__';
  const on = state === 'helpful';

  useEffect(() => {
    let alive = true;
    if (!isGuest) loadHelpfulState(voteId, profileId).then(s => { if (alive) setState(s); }).catch(() => {});
    if (isAdmin) loadHelpfulCounts(voteId).then(c => { if (alive) setCounts(c); }).catch(() => {});
    return () => { alive = false; };
  }, [voteId, profileId, isAdmin, isGuest]);

  const tap = async () => {
    if (isGuest) return;
    const prev = state;
    const next = prev === 'helpful' ? 'notHelpful' : 'helpful';
    setState(next); // optimistic
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    try { await toggleHelpful(voteId, profileId, prev); }
    catch (e) { setState(prev); return; } // revert on write failure
    if (isAdmin) { try { setCounts(await loadHelpfulCounts(voteId)); } catch (e) {} }
  };

  const color = on ? AMBER : T.muted;

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
        <div className="text-[12px] font-semibold leading-tight" style={{ color: on ? AMBER : T.muted }}>
          {isGuest ? 'Was this helpful?' : on ? 'Glad it helped' : 'Was this helpful?'}
        </div>
        <div className="text-[10px] leading-tight" style={{ color: T.muted }}>
          {isGuest ? 'Sign in to vote' : on ? 'Tap the bulb to undo' : 'Tap the bulb'}
          {isAdmin && counts ? `  ·  ${counts.yes} helpful / ${counts.no} not` : ''}
        </div>
      </div>
    </div>
  );
}
