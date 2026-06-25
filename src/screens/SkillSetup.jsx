// =====================================================================
// src/screens/SkillSetup.jsx — setup gate for the Clinical Skill Drill.
// Pick how many "patients" (scenarios) + the Pace (Off / Pulse / Flashpoint),
// then start. Premium, lively, animated — a hospital-shift "clock-in" vibe.
// =====================================================================
import React, { useState } from 'react';
import { Activity, HeartPulse, Play, ShieldAlert, Stethoscope, Syringe, Wind } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import { normalizePace } from '../lib/pace.js';
import { SKILL_SEQUENCES } from '../data/skill-sequences.js';

const TEAL = '#0E7490';
const POOL = SKILL_SEQUENCES.length;
const COUNT_OPTIONS = [3, 5, POOL].filter((c, i, a) => c <= POOL && a.indexOf(c) === i);

// A few procedure-type teasers for the "what you'll face" strip.
const TEASERS = [
  { icon: ShieldAlert, label: 'PPE' },
  { icon: HeartPulse, label: 'BLS' },
  { icon: Wind, label: 'Suction' },
  { icon: Syringe, label: 'IV line' },
  { icon: Stethoscope, label: 'Med admin' },
];

function SkillSetup({ onStart, onBack, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const [count, setCount] = useState(Math.min(5, POOL));
  const pace = normalizePace(data && data.preferences);

  return (
    <div className="anim-fadeup">
      <TopBar title="Clinical Skill Drill" onBack={onBack} feedback={{ screen: 'Skill drill setup' }} solid />
      <div className="max-w-md mx-auto px-4 pt-2 pb-32">

        {/* Hero — clock in for your shift */}
        <Card className="p-5 mb-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${TEAL}, #0A5A6E)`, border: 'none' }}>
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="absolute -right-2 top-8 w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="relative flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.16)' }}>
              <Activity size={26} color="#FFF" className="timer-beat" />
            </div>
            <div style={{ color: '#FFF' }}>
              <div className="font-display text-xl font-bold leading-tight">Clock in for your shift</div>
              <div className="text-[12.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>Order each procedure correctly. Learn the why. Earn coins.</div>
            </div>
          </div>
          {/* procedure teaser strip — staggered reveal */}
          <div className="relative flex flex-wrap gap-1.5 mt-4">
            {TEASERS.map((t, i) => {
              const Icon = t.icon;
              return (
                <span key={t.label} className="seq-item inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.15)', color: '#FFF', animationDelay: `${120 + i * 70}ms` }}>
                  <Icon size={11} /> {t.label}
                </span>
              );
            })}
          </div>
        </Card>

        {/* How many patients */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many patients?</div>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {COUNT_OPTIONS.map((c, i) => {
            const on = count === c;
            return (
              <button key={c} onClick={() => setCount(c)}
                      className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 anim-fadeup"
                      style={{ background: on ? TEAL : T.surface, color: on ? '#FFF' : T.ink,
                               border: `1.5px solid ${on ? TEAL : T.border}`, boxShadow: on ? `0 8px 20px ${TEAL}44` : 'none',
                               animationDelay: `${i * 60}ms` }}>
                <div className="text-base leading-none">{c === POOL ? 'All' : c}</div>
                <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>
                  {c === 1 ? 'patient' : 'patients'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Pace — same Off/Pulse/Flashpoint control as the tests */}
        <PaceSelector value={pace} onChange={onSetPace} T={T} />
        <div className="text-[11px] leading-relaxed px-1 mb-1" style={{ color: T.muted }}>
          With <b style={{ color: '#16A34A' }}>The Pulse</b> on, each patient gets a countdown — run out and the case locks.
          <b style={{ color: '#B45309' }}> Flashpoint</b> halves the clock and <b>doubles</b> the coins.
        </div>
      </div>

      {/* Start */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          <Button onClick={() => onStart({ count })} size="lg" className="w-full"
                  icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
            Start my shift · {count === POOL ? 'All' : count} {count === 1 ? 'patient' : 'patients'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SkillSetup;
