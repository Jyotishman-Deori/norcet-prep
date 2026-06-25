// =====================================================================
// src/ui/pulse-toggle.jsx — NEW-03 "The Pulse" opt-in switch.
// A premium toggle row shown on the test setup screens (Quick, Mock) just
// before Start. Flips data.preferences.pulseTimer; the choice is remembered
// and inherited by topic-wise tests too. Purely a pacing-pressure visual.
// =====================================================================
import React from 'react';
import { Heart } from 'lucide-react';
import { Card } from './primitives.jsx';

export default function PulseToggle({ value, onChange, T }) {
  const on = !!value;
  return (
    <Card className="p-3.5 mb-3" style={on ? { background: '#16A34A0E', border: '1px solid #16A34A40' } : { background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
      <button onClick={() => onChange(!on)}
              className="no-tap-highlight w-full flex items-center gap-3 text-left active:scale-[0.99] transition">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: on ? '#16A34A1A' : T.surface, border: `1px solid ${on ? '#16A34A55' : T.border}` }}>
          <Heart size={16} fill={on ? '#16A34A' : 'none'} style={{ color: on ? '#16A34A' : T.muted }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: T.ink }}>The Pulse — race the clock</div>
          <div className="text-[11px] leading-snug mt-0.5" style={{ color: T.muted }}>
            A live countdown bar on every question that drains green → red as your time runs out. Trains exam tempo — never penalises you.
          </div>
        </div>
        {/* switch */}
        <div className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors"
             style={{ background: on ? '#16A34A' : T.border }}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                style={{ left: on ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </div>
      </button>
    </Card>
  );
}
