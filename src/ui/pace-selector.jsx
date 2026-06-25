// =====================================================================
// src/ui/pace-selector.jsx — NEW-03 / Flashpoint
// A premium 3-way segmented control for the per-question timer, shown on the
// test setup screens (Quick, Mock) and the Learn-topic-wise header. Writes the
// global data.preferences.pace via onChange; every test mode inherits it.
// =====================================================================
import React from 'react';
import { TimerOff, HeartPulse, Zap } from 'lucide-react';

const OPTS = [
  { id: 'off',        label: 'Off',        sub: 'No timer',            icon: TimerOff,   tint: '#6B7280' },
  { id: 'pulse',      label: 'The Pulse',  sub: 'Beat the clock',      icon: HeartPulse, tint: '#16A34A' },
  { id: 'flashpoint', label: 'Flashpoint', sub: '½ time · 2× points',  icon: Zap,        tint: '#F59E0B' },
];

export default function PaceSelector({ value = 'off', onChange, T, compact = false }) {
  return (
    <div className={compact ? '' : 'mb-3'}>
      {!compact && (
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Pace</div>
      )}
      <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
        {OPTS.map(o => {
          const on = value === o.id;
          const Icon = o.icon;
          return (
            <button key={o.id} onClick={() => onChange && onChange(o.id)}
                    aria-pressed={on}
                    className="no-tap-highlight rounded-xl py-2.5 px-1 flex flex-col items-center gap-1 transition-all active:scale-[0.97]"
                    style={on
                      ? { background: o.tint, color: '#FFF', boxShadow: `0 8px 20px ${o.tint}44` }
                      : { background: 'transparent', color: T.inkSoft }}>
              <Icon size={compact ? 15 : 17} strokeWidth={2} fill={on && o.id === 'flashpoint' ? '#FFF' : 'none'} />
              <span className="text-[12px] font-semibold leading-none">{o.label}</span>
              {!compact && (
                <span className="text-[9.5px] leading-tight text-center" style={{ color: on ? 'rgba(255,255,255,0.88)' : T.muted }}>{o.sub}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
