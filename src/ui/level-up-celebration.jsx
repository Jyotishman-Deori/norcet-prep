// =====================================================================
// src/ui/level-up-celebration.jsx  (Level Up P2 — the rank-up moment)
// A full-screen, premium celebration that fires when a game pushes the user
// over a level. Zero-asset: SVG/CSS only (particle burst + ring pulse + a
// spring-popped level number). When the new level crosses into a new prestige
// TIER, the card leans into that ("New tier · <title>"). Honours
// prefers-reduced-motion. Portaled to <body> so no transformed ancestor can
// break its fixed positioning.
// =====================================================================
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Badge, ClipboardList, Crown, Flame, Stethoscope } from 'lucide-react';
import { haptic } from '../lib/juice.js';
import { tierFor } from '../lib/levelup.js';

const TIER_ICONS = {
  badge: Badge, clipboard: ClipboardList, stethoscope: Stethoscope,
  activity: Activity, flame: Flame, crown: Crown,
};

const CSS = `
@keyframes luCelebFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes luCelebCard { 0% { opacity:0; transform: translateY(18px) scale(.84) } 60% { opacity:1; transform: translateY(0) scale(1.04) } 100% { transform: translateY(0) scale(1) } }
@keyframes luCelebRing { 0% { transform: scale(.5); opacity:.65 } 100% { transform: scale(2.5); opacity:0 } }
@keyframes luCelebNum { 0% { transform: scale(.3); opacity:0 } 55% { transform: scale(1.18); opacity:1 } 100% { transform: scale(1) } }
@keyframes luCelebPiece { 0% { transform: translate(0,0) scale(1); opacity:1 } 100% { transform: translate(var(--dx), var(--dy)) scale(.3); opacity:0 } }
.lu-celeb-backdrop { animation: luCelebFade .25s ease both; }
.lu-celeb-card { animation: luCelebCard .55s cubic-bezier(.34,1.56,.64,1) both; }
.lu-celeb-ring { animation: luCelebRing 1.15s ease-out forwards; }
.lu-celeb-num { animation: luCelebNum .6s cubic-bezier(.34,1.56,.64,1) .1s both; }
.lu-celeb-piece { animation: luCelebPiece .95s ease-out forwards; }
@media (prefers-reduced-motion: reduce) {
  .lu-celeb-ring, .lu-celeb-piece { animation: none; opacity: 0; }
  .lu-celeb-card, .lu-celeb-num { animation-duration: .01s; animation-delay: 0s; }
}
`;

export default function LevelUpCelebration({ fromLevel, toLevel, onClose }) {
  const tier = tierFor(toLevel);
  const prevTier = tierFor(fromLevel);
  const newTier = tier.id !== prevTier.id;
  const TierIcon = TIER_ICONS[tier.icon] || Badge;

  // Via haptic(), NOT navigator.vibrate directly: the raw call buzzed the phone
  // even under prefers-reduced-motion, which the accessibility rule forbids.
  useEffect(() => {
    haptic(newTier ? [14, 50, 22] : 16);
  }, [newTier]);

  // Radial confetti burst — directions evenly around the circle, a few colours.
  const palette = ['#FFD27A', '#9CC4FF', '#FFFFFF', tier.accent];
  const pieces = Array.from({ length: 16 }, (_, i) => {
    const ang = (i / 16) * Math.PI * 2;
    const dist = 64 + (i % 3) * 26;
    return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist, color: palette[i % palette.length], delay: (i % 5) * 35 };
  });

  const body = (
    <div className="lu-celeb-backdrop fixed inset-0 z-[120] flex items-center justify-center px-6"
         style={{ background: 'rgba(8,6,14,0.78)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
         onClick={onClose} role="dialog" aria-modal="true" aria-label={`Level ${toLevel} reached`}>
      <style>{CSS}</style>
      <div className="lu-celeb-card relative w-full max-w-sm rounded-3xl p-7 text-center overflow-hidden"
           onClick={(e) => e.stopPropagation()}
           style={{ background: `linear-gradient(150deg, ${tier.accent} 0%, ${tier.accent}D0 45%, rgba(0,0,0,0.6) 130%)`, boxShadow: `0 24px 60px ${tier.accent}66` }}>
        {/* soft corner glow */}
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)' }} aria-hidden="true" />

        {/* ring pulse + spring-popped level number, with the burst behind it */}
        <div className="relative flex items-center justify-center mb-4" style={{ height: 124 }}>
          <div className="absolute" style={{ left: '50%', top: '50%' }} aria-hidden="true">
            {pieces.map((p, i) => (
              <span key={i} className="lu-celeb-piece absolute rounded-full"
                    style={{ width: 8, height: 8, background: p.color, left: -4, top: -4,
                             '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${p.delay}ms` }} />
            ))}
          </div>
          <span className="lu-celeb-ring absolute rounded-full" style={{ width: 116, height: 116, border: '3px solid rgba(255,255,255,0.6)' }} aria-hidden="true" />
          <div className="lu-celeb-num w-28 h-28 rounded-full flex flex-col items-center justify-center"
               style={{ background: 'rgba(255,255,255,0.16)', border: '2px solid rgba(255,255,255,0.42)' }}>
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: 'rgba(255,255,255,0.9)' }}>Level</span>
            <span className="font-display font-semibold leading-none" style={{ color: '#FFF', fontSize: 46 }}>{toLevel}</span>
          </div>
        </div>

        <div className="text-[12px] uppercase tracking-[0.22em] font-bold mb-2" style={{ color: 'rgba(255,255,255,0.92)' }}>Level Up!</div>

        {newTier ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <TierIcon size={14} color="#FFF" />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#FFF' }}>New tier · {tier.title}</span>
            </div>
            <div className="font-display text-lg font-semibold mb-1" style={{ color: '#FFF' }}>{tier.blurb}</div>
          </>
        ) : (
          <div className="font-display text-xl font-semibold mb-1" style={{ color: '#FFF' }}>{tier.title}</div>
        )}

        <div className="text-[12.5px] mb-5" style={{ color: 'rgba(255,255,255,0.85)' }}>
          You reached Level {toLevel}. Keep the momentum going.
        </div>

        <button onClick={onClose}
                className="no-tap-highlight w-full py-3 rounded-2xl font-semibold active:scale-[0.98] transition"
                style={{ background: '#FFF', color: tier.accent }}>
          Continue
        </button>
      </div>
    </div>
  );

  return (typeof document !== 'undefined') ? createPortal(body, document.body) : body;
}
