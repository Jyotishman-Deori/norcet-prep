// =====================================================================
// src/ui/streak-fire.jsx  (Level Up P2 — the streak fire)
// A small procedural flame for "hot" streaks (5+ days). Zero-asset: two layered
// lucide flames (orange shell + amber core) with a flicker + a soft glow pulse.
// Honours prefers-reduced-motion. Keyframes are injected once into <head> so a
// list of many fires (leaderboard) doesn't duplicate the <style>.
// =====================================================================
import React, { useEffect } from 'react';
import { Flame } from 'lucide-react';

export const STREAK_FIRE_MIN = 5; // days before the fire lights up

const STREAK_CSS = `
@keyframes streakFlick {
  0%,100% { transform: scale(1) rotate(-1deg) }
  25% { transform: scale(1.08, .93) rotate(1.5deg) }
  50% { transform: scale(.95, 1.07) rotate(-1.5deg) }
  75% { transform: scale(1.05, .97) rotate(1deg) }
}
@keyframes streakGlow { 0%,100% { opacity:.45; transform: scale(1) } 50% { opacity:.85; transform: scale(1.12) } }
.streak-fire { position: relative; display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
.streak-fire__glow { position:absolute; inset:-35%; border-radius:50%; pointer-events:none;
  background: radial-gradient(circle, rgba(255,138,0,0.6), transparent 70%); animation: streakGlow 1.5s ease-in-out infinite; }
.streak-fire__flame { position: relative; transform-origin: 50% 82%; animation: streakFlick .9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .streak-fire__flame, .streak-fire__glow { animation: none; }
}
`;

let injected = false;
function ensureCss() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const s = document.createElement('style');
  s.setAttribute('data-streak-fire', '');
  s.textContent = STREAK_CSS;
  document.head.appendChild(s);
}

// `size` = outer flame px. `shell`/`core` override the two tones if needed.
export default function StreakFire({ size = 18, shell = '#FF6B1A', core = '#FFC53D', className = '' }) {
  useEffect(() => { ensureCss(); }, []);
  const inner = Math.round(size * 0.6);
  return (
    <span className={`streak-fire ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="streak-fire__glow" />
      <span className="streak-fire__flame" style={{ width: size, height: size }}>
        <Flame size={size} fill={shell} color={shell} strokeWidth={0} />
        <Flame size={inner} fill={core} color={core} strokeWidth={0}
               style={{ position: 'absolute', left: (size - inner) / 2, bottom: 0 }} />
      </span>
    </span>
  );
}
