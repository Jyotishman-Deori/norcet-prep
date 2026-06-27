// =====================================================================
// src/ui/crate-reveal.jsx  (Level Up P3 — Supply Crate reveal)
// A premium 3-tap reward reveal: tap to rattle, tap to shake, tap to burst the
// crate open into the reward card. Zero-asset (lucide + CSS). TRANSPARENT — the
// possible drops + odds are shown up front. Coins (and a rare XP jackpot) only;
// no real-money items. Portaled to <body>; honours prefers-reduced-motion.
//
// Props:
//   onOpen  — () => reward | null  (consumes one crate, applies it, returns the
//             rolled reward { id, label, coins, xp, tone })
//   onClose — () => void
// =====================================================================
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins, Gift, Sparkles } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { crateOdds } from '../lib/levelup.js';
import { frameDef } from '../lib/cosmetics.js';
import FramedAvatar from './framed-avatar.jsx';

const CSS = `
@keyframes crateFade { from { opacity:0 } to { opacity:1 } }
@keyframes crateCard { 0% { opacity:0; transform: translateY(16px) scale(.86) } 60% { opacity:1; transform: translateY(0) scale(1.03) } 100% { transform: translateY(0) scale(1) } }
@keyframes crateBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes crateShake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-8deg)} 40%{transform:rotate(7deg)} 60%{transform:rotate(-6deg)} 80%{transform:rotate(5deg)} }
@keyframes crateBurst { 0%{transform:scale(.3);opacity:0} 60%{transform:scale(1.14);opacity:1} 100%{transform:scale(1)} }
@keyframes cratePiece { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(.3);opacity:0} }
.crate-backdrop { animation: crateFade .25s ease both }
.crate-card { animation: crateCard .5s cubic-bezier(.34,1.56,.64,1) both }
.crate-bob { animation: crateBob 2.2s ease-in-out infinite }
.crate-shake { animation: crateShake .5s ease-in-out }
.crate-burst { animation: crateBurst .55s cubic-bezier(.34,1.56,.64,1) both }
.crate-piece { animation: cratePiece .9s ease-out forwards }
@media (prefers-reduced-motion: reduce) {
  .crate-bob, .crate-shake, .crate-piece { animation: none }
  .crate-card, .crate-burst { animation-duration: .01s }
}
`;

export default function CrateReveal({ onOpen, onClose }) {
  const { theme: T } = useTheme();
  const [taps, setTaps] = useState(0);
  const [reward, setReward] = useState(null);
  const [shakeKey, setShakeKey] = useState(0);
  const opened = reward !== null;

  const tap = () => {
    if (opened) return;
    const n = taps + 1;
    setTaps(n);
    setShakeKey(k => k + 1);
    try { if (navigator.vibrate) navigator.vibrate(n >= 3 ? [10, 30, 14] : 8); } catch (e) {}
    if (n >= 3) {
      const r = (onOpen && onOpen()) || null;
      setReward(r || { id: 'common', label: 'Reward', coins: 0, xp: 0, tone: T.primary });
    }
  };

  const tone = reward ? reward.tone : T.primary;
  const pieces = Array.from({ length: 16 }, (_, i) => {
    const ang = (i / 16) * Math.PI * 2;
    const dist = 70 + (i % 3) * 24;
    return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist, color: ['#FFD27A', '#9CC4FF', '#FFFFFF', tone][i % 4], delay: (i % 5) * 30 };
  });

  const body = (
    <div className="crate-backdrop fixed inset-0 z-[120] flex items-center justify-center px-6"
         style={{ background: 'rgba(8,6,14,0.8)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
         onClick={onClose} role="dialog" aria-modal="true" aria-label="Supply crate">
      <style>{CSS}</style>
      <div className="crate-card relative w-full max-w-sm rounded-3xl p-7 text-center overflow-hidden"
           onClick={(e) => e.stopPropagation()}
           style={{ background: `linear-gradient(150deg, ${tone} 0%, ${tone}CC 45%, rgba(0,0,0,0.62) 130%)`, boxShadow: `0 24px 60px ${tone}66` }}>
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%)' }} aria-hidden="true" />

        {/* crate / reward stage */}
        <div className="relative flex items-center justify-center mb-4" style={{ height: 132 }}>
          {opened && (
            <div className="absolute" style={{ left: '50%', top: '50%' }} aria-hidden="true">
              {pieces.map((p, i) => (
                <span key={i} className="crate-piece absolute rounded-full"
                      style={{ width: 8, height: 8, background: p.color, left: -4, top: -4, '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, animationDelay: `${p.delay}ms` }} />
              ))}
            </div>
          )}
          {!opened ? (
            <button onClick={tap} aria-label="Tap to open the crate" className="no-tap-highlight active:scale-95 transition">
              <div key={shakeKey} className={taps > 0 ? 'crate-shake' : 'crate-bob'}>
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center"
                     style={{ background: 'rgba(255,255,255,0.16)', border: '2px solid rgba(255,255,255,0.4)' }}>
                  <Gift size={48} color="#FFF" />
                </div>
              </div>
            </button>
          ) : (
            <div className="crate-burst w-28 h-28 rounded-full flex items-center justify-center"
                 style={{ background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.45)' }}>
              {reward.xp > 0 ? <Sparkles size={44} color="#FFF" /> : <Coins size={44} color="#FFF" />}
            </div>
          )}
        </div>

        {!opened ? (
          <>
            <div className="font-display text-xl font-semibold mb-1" style={{ color: '#FFF' }}>Supply Crate</div>
            <div className="text-[12.5px] mb-3" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {taps === 0 ? 'Tap to open it' : taps === 1 ? 'Keep tapping…' : 'One more!'}
            </div>
            {/* tap progress */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-2 h-2 rounded-full" style={{ background: i < taps ? '#FFF' : 'rgba(255,255,255,0.35)' }} />
              ))}
            </div>
            {/* transparent odds */}
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Possible drops</div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {crateOdds().map(o => {
                const pct = Math.round((o.weight / crateOdds().reduce((s, x) => s + x.weight, 0)) * 100);
                return (
                  <span key={o.id} className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.16)', color: '#FFF' }}>
                    {o.label} · {pct}%
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="text-[12px] uppercase tracking-[0.2em] font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.92)' }}>You got</div>
            <div className="font-display text-2xl font-semibold mb-1" style={{ color: '#FFF' }}>{reward.label}</div>
            {reward.frame && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <FramedAvatar initial="★" frame={reward.frame} size={26} bg="rgba(255,255,255,0.28)" fg="#FFF" />
                <span className="text-xs font-bold" style={{ color: '#FFF' }}>New frame: {frameDef(reward.frame).name}!</span>
              </div>
            )}
            <div className="text-[12.5px] mb-5" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {reward.frame ? 'Equip it in the Profile frame section.' : 'Added to your balance.'}
            </div>
            <button onClick={onClose}
                    className="no-tap-highlight w-full py-3 rounded-2xl font-semibold active:scale-[0.98] transition"
                    style={{ background: '#FFF', color: tone }}>
              Collect
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (typeof document !== 'undefined') ? createPortal(body, document.body) : body;
}
