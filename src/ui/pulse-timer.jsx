// =====================================================================
// src/ui/pulse-timer.jsx — NEW-03 "The Pulse" / Flashpoint
// A LIVE per-question countdown bar. The colour grades CONTINUOUSLY (smooth
// hue interpolation, green → amber → red — never a hard step), the fill carries
// a moving sheen, the glow + heartbeat intensify as time bleeds away, and the
// seconds pop on every tick in the final stretch. When the clock hits zero the
// question locks with a shake + an unmistakable "TIME'S UP". Teasing one-liners
// rotate per question to keep it playful. The clock ENFORCES (Quiz auto-locks
// via onExpire). Reduced-motion safe.
//
// Props: budgetSec · resetKey (q.id) · paused · T · flashpoint · onExpire
// =====================================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HeartPulse, Activity, Zap, TimerOff, Check } from 'lucide-react';

// Discrete zones drive only the TAG + the teasing copy. Colour is continuous.
const ZONES = [
  { min: 0.60, tag: 'STABLE', lines: [
    'Plenty of clock — read it like a topper.',
    'Cool head. The answer is in there.',
    'No rush… yet. 😏',
    'Breathe. You own this one.',
  ] },
  { min: 0.34, tag: 'WATCH', lines: [
    'Half gone — start cutting options.',
    'Tick… tick… commit soon.',
    'The clock is watching you. 👀',
    "Don't fall in love with one option.",
  ] },
  { min: 0.12, tag: 'CRITICAL', lines: [
    'Crunch time — trust your gut!',
    'Now or never. Pick one!',
    'Heart-rate rising… decide!',
    'Instinct over second-guessing. Go!',
  ] },
  { min: 0.00, tag: 'CODE', lines: [
    'Lock it in — anything beats a blank!',
    'Final seconds! 🚨',
    'Slam an answer — NOW!',
    'Do not freeze. Choose!',
  ] },
];

const prefersReducedMotion = () => {
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
};

const hashStr = (s) => { let h = 0; const str = String(s); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); };

// Continuous colour from the fraction of time remaining. Hue sweeps 145°(green)
// → 0°(red) on a gentle curve (stays green a touch longer, then rushes to red),
// gaining saturation and losing lightness as it gets critical.
function gradeColor(frac) {
  const f = Math.max(0, Math.min(1, frac));
  const hue = 146 * Math.pow(f, 0.78);
  const sat = Math.round(74 + (1 - f) * 18);
  const light = Math.round(47 - (1 - f) * 7);
  const hsl = (a) => `hsla(${hue.toFixed(0)}, ${sat}%, ${light}%, ${a})`;
  return { solid: hsl(1), soft: hsl(0.10), border: hsl(0.34), glow: hsl(0.6), edge: hsl(0.78) };
}

export default function PulseTimer({ budgetSec = 54, resetKey, paused = false, T, flashpoint = false, onExpire }) {
  const [remaining, setRemaining] = useState(budgetSec);
  const [shake, setShake] = useState(false);
  const startRef = useRef(Date.now());
  const reduced = useRef(prefersReducedMotion());
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Reset on every new question (before the ticking effect reads startRef).
  useEffect(() => {
    startRef.current = Date.now();
    expiredRef.current = false;
    setRemaining(budgetSec);
    setShake(false);
  }, [resetKey, budgetSec]);

  // Tick while running. ~16ms-smooth via 100ms sampling + CSS width transition.
  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const rem = Math.max(0, budgetSec - elapsed);
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(id);
        if (!expiredRef.current && onExpireRef.current) { expiredRef.current = true; onExpireRef.current(); }
      }
    }, 100);
    return () => clearInterval(id);
  }, [paused, resetKey, budgetSec]);

  const frac = Math.max(0, Math.min(1, remaining / budgetSec));
  const flat = remaining <= 0;
  const secs = Math.ceil(remaining);
  const zone = ZONES.find(z => frac >= z.min) || ZONES[ZONES.length - 1];

  // States: timed-out (locked at 0) · cleared-in-time · running.
  const timedOut = paused && flat;
  const cleared = paused && !flat;

  // One-shot shake the instant the clock runs out.
  useEffect(() => {
    if (timedOut && !reduced.current) { setShake(true); const t = setTimeout(() => setShake(false), 520); return () => clearTimeout(t); }
    return undefined;
  }, [timedOut]);

  // Teasing line — stable per (question, zone) so it doesn't flicker each tick.
  const teaseLine = useMemo(
    () => zone.lines[hashStr(`${resetKey}|${zone.tag}`) % zone.lines.length],
    [resetKey, zone.tag, zone.lines]
  );

  // Colour: continuous while running; calm green when cleared; hard red on timeout.
  const C = timedOut ? gradeColor(0) : cleared ? gradeColor(0.85) : gradeColor(frac);

  let tag = zone.tag, footLine = teaseLine, footColor = C.solid, FootIcon = null;
  if (timedOut) { tag = "TIME'S UP"; footLine = 'The clock won this one — locked.'; footColor = C.solid; FootIcon = TimerOff; }
  else if (cleared) { tag = 'CLEARED'; footLine = `Locked in with ${secs}s to spare — topper tempo.`; footColor = '#16A34A'; FootIcon = Check; }

  // Heartbeat speeds up as it drains; glow intensifies; sheen sweeps the fill.
  const beat = paused || reduced.current ? '' : (frac <= 0.12 ? ' timer-beat-fast' : frac <= 0.30 ? ' timer-beat' : '');
  const glowPx = paused ? (timedOut ? 16 : 0) : Math.round(4 + (1 - frac) * 18);
  const numberPops = !reduced.current && !paused && remaining <= 10;

  const HeadIcon = flashpoint ? Zap : (timedOut ? TimerOff : (cleared ? Check : (flat ? Activity : HeartPulse)));

  return (
    <div className={'rounded-2xl px-3.5 py-2.5 mb-4 anim-fadeup' + (shake ? ' q-shake' : '')}
         style={{ background: C.soft, border: `1px solid ${C.border}`, transition: reduced.current ? 'none' : 'background 0.5s ease, border-color 0.5s ease' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={'inline-flex flex-shrink-0' + beat} style={{ color: C.solid }}>
            <HeadIcon size={14} strokeWidth={2.2} fill={flashpoint && !paused ? C.solid : 'none'} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] truncate" style={{ color: C.solid }}>
            {flashpoint ? 'Flashpoint' : 'The Pulse'} · {tag}
          </span>
          {flashpoint && !paused && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0"
                  style={{ background: '#F59E0B22', color: '#B45309' }}>2×</span>
          )}
        </div>
        <span key={numberPops ? secs : 'static'}
              className={'text-sm font-bold tabular-nums flex-shrink-0' + (numberPops ? ' q-pulse' : '')}
              style={{ color: C.solid }}>
          {flat ? '0' : secs}s
        </span>
      </div>

      {/* draining bar — continuous colour, moving sheen, intensifying glow */}
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
        <div className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
             style={{
               width: `${frac * 100}%`,
               background: `linear-gradient(90deg, ${C.solid}, ${C.edge})`,
               boxShadow: glowPx ? `0 0 ${glowPx}px ${C.glow}` : 'none',
               transition: reduced.current ? 'none' : 'width 0.1s linear, box-shadow 0.3s ease',
             }}>
          {!paused && !reduced.current && (
            <div className="absolute inset-0"
                 style={{
                   background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                   backgroundSize: '200% 100%',
                   animation: `shimmer ${frac <= 0.3 ? 1 : 1.8}s linear infinite`,
                 }} />
          )}
        </div>
      </div>

      <div key={tag} className="text-[11px] mt-1.5 leading-snug anim-fadeup flex items-center gap-1.5" style={{ color: footColor }}>
        {FootIcon && <FootIcon size={12} className="flex-shrink-0" />}
        <span>{footLine}</span>
      </div>
    </div>
  );
}
