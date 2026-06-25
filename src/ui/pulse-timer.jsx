// =====================================================================
// src/ui/pulse-timer.jsx — NEW-03 "The Pulse"
// A dramatic, per-question countdown bar that drains in real time and
// colour-grades green → amber → red → dark-red as the seconds bleed away,
// like a patient's vitals on a monitor. Each question is a "patient"; the
// bar is their pulse. Purely a PACING-PRESSURE visual — it never enforces,
// auto-advances, or penalises. Short zone dialogues add the thrill / relief.
//
// Props:
//   budgetSec  — seconds budgeted for this question (topic-aware; pacing.js)
//   resetKey   — changes per question (q.id); resets the countdown
//   paused     — freeze the bar (true once the answer is submitted/revealed)
//   T          — theme tokens
//
// Self-contained: owns its own ticking so the parent Quiz doesn't re-render
// every frame. Reduced-motion safe (no transition/beat when the user opts out).
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import { Heart, Activity, Zap } from 'lucide-react';

// Zone thresholds on the fraction of time REMAINING. First match wins.
const ZONES = [
  { min: 0.60, color: '#16A34A', tag: 'STABLE',   line: 'Stable — read it fully, then commit.' },
  { min: 0.35, color: '#F59E0B', tag: 'WATCH',    line: "Clock's ticking — start eliminating options." },
  { min: 0.12, color: '#EF4444', tag: 'CRITICAL', line: 'Critical — trust your prep and choose.' },
  { min: 0.00, color: '#B91C1C', tag: 'CODE',     line: 'Lock something in — a blank scores zero too.' },
];

const prefersReducedMotion = () => {
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
};

export default function PulseTimer({ budgetSec = 54, resetKey, paused = false, T, flashpoint = false, onExpire }) {
  const [remaining, setRemaining] = useState(budgetSec);
  const startRef = useRef(Date.now());
  const reduced = useRef(prefersReducedMotion());
  const expiredRef = useRef(false);
  // Keep the latest onExpire in a ref so it never re-triggers the ticking effect
  // (an inline callback changes identity each render and would restart the clock).
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Reset on every new question (declared BEFORE the ticking effect so the
  // fresh start time is in place before the interval reads it).
  useEffect(() => {
    startRef.current = Date.now();
    expiredRef.current = false;
    setRemaining(budgetSec);
  }, [resetKey, budgetSec]);

  // Tick while running. Frozen the moment the answer is locked in.
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const rem = Math.max(0, budgetSec - elapsed);
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(id);
        // Flashpoint — the clock enforces: fire onExpire exactly once so the
        // Quiz can auto-lock the question. (The Pulse, non-flashpoint, ignores
        // this — onExpire is only passed in flashpoint mode.)
        if (!expiredRef.current && onExpireRef.current) { expiredRef.current = true; onExpireRef.current(); }
      }
    }, 200);
    return () => clearInterval(id);
  }, [paused, resetKey, budgetSec]);

  const frac = Math.max(0, Math.min(1, remaining / budgetSec));
  const zone = ZONES.find(z => frac >= z.min) || ZONES[ZONES.length - 1];
  const flat = remaining <= 0;            // flatline
  const secs = Math.ceil(remaining);

  // Heart beats quicker the lower the pulse gets (reuses the app's timer-beat
  // keyframes). Frozen state shows a calm, non-beating heart.
  const beat = paused || reduced.current ? '' : (frac <= 0.12 ? ' timer-beat-fast' : frac <= 0.35 ? ' timer-beat' : '');

  // Post-answer relief / coaching beat.
  let footLine = zone.line;
  let footColor = T.muted;
  let tag = zone.tag;
  if (paused) {
    if (flat) { footLine = 'Over the pace this time — bank a few seconds on the next one.'; footColor = T.muted; tag = 'TIME UP'; }
    else { footLine = `Locked in with ${secs}s in hand — that's topper tempo.`; footColor = '#16A34A'; tag = 'CLEARED'; }
  } else if (flat) {
    footColor = '#B91C1C';
  } else {
    footColor = zone.color;
  }

  const barColor = paused && !flat ? '#16A34A' : zone.color;

  return (
    <div className="rounded-2xl px-3.5 py-2.5 mb-4 anim-fadeup"
         style={{ background: barColor + '0E', border: `1px solid ${barColor}33` }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={'inline-flex' + beat} style={{ color: barColor }}>
            {flashpoint
              ? <Zap size={13} fill={barColor} />
              : (flat && !paused ? <Activity size={14} /> : <Heart size={13} fill={barColor} />)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: barColor }}>
            {flashpoint ? 'Flashpoint' : 'The Pulse'} · {tag}
          </span>
          {flashpoint && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                  style={{ background: '#F59E0B22', color: '#B45309' }}>2×</span>
          )}
        </div>
        <span className="text-sm font-semibold tabular-nums" style={{ color: barColor }}>
          {flat ? '0' : secs}s
        </span>
      </div>

      {/* draining bar — width = fraction remaining, colour = zone */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
        <div className="h-full rounded-full"
             style={{
               width: `${frac * 100}%`,
               background: flat
                 ? `repeating-linear-gradient(90deg, ${barColor}, ${barColor} 6px, ${barColor}99 6px, ${barColor}99 12px)`
                 : `linear-gradient(90deg, ${barColor}CC, ${barColor})`,
               boxShadow: frac <= 0.35 && !paused ? `0 0 10px ${barColor}88` : 'none',
               transition: reduced.current ? 'none' : 'width 0.2s linear, background 0.4s ease',
             }} />
      </div>

      <div className="text-[11px] mt-1.5 leading-snug" style={{ color: footColor }}>{footLine}</div>
    </div>
  );
}
