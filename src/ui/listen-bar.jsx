// =====================================================================
// LISTEN BAR  —  sticky player for hands-free Listen mode
// =====================================================================
// Driven by the useListenMode controller. Renders nothing until a session is
// active. Plum "revision" accent to match the read/revise surface.
// =====================================================================
import React from 'react';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

const RATES = [0.85, 1, 1.25];

export default function ListenBar({ ctl, label = 'Listening', bottomOffset = 0 }) {
  const { theme: T } = useTheme();
  if (!ctl || !ctl.active) return null;
  const accent = (T.sec && T.sec.revision) || T.primary;

  const cycleRate = () => {
    const i = RATES.indexOf(ctl.rate);
    ctl.setRate(RATES[(i + 1) % RATES.length] ?? 1);
  };
  const iconBtn = 'no-tap-highlight w-9 h-9 inline-flex items-center justify-center rounded-full active:scale-90 transition disabled:opacity-35';

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pointer-events-none" style={{ paddingBottom: bottomOffset + 16 }}>
      <div className="max-w-md mx-auto pointer-events-auto rounded-2xl pl-3.5 pr-2 py-2 flex items-center gap-1.5"
           style={{ background: T.surface, border: `1px solid ${accent}45`, boxShadow: `0 14px 34px ${accent}33` }}>
        <div className="flex flex-col min-w-0 flex-1 mr-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: accent }}>{label}</span>
          <span className="text-[12px] truncate" style={{ color: T.muted }}>Card {ctl.index + 1} of {ctl.count}</span>
        </div>

        <button onClick={cycleRate} type="button"
                className="no-tap-highlight text-[12px] font-semibold tabular-nums px-2 h-9 rounded-full active:scale-90 transition"
                style={{ color: accent, background: accent + '14' }}>{ctl.rate}×</button>

        <button onClick={ctl.prev} disabled={ctl.index === 0} type="button" aria-label="Previous"
                className={iconBtn} style={{ color: T.ink }}><SkipBack size={17} /></button>

        <button onClick={ctl.playing ? ctl.pause : ctl.resume} type="button" aria-label={ctl.playing ? 'Pause' : 'Play'}
                className="no-tap-highlight w-10 h-10 inline-flex items-center justify-center rounded-full active:scale-90 transition"
                style={{ background: accent, color: '#fff' }}>
          {ctl.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>

        <button onClick={ctl.next} disabled={ctl.index >= ctl.count - 1} type="button" aria-label="Next"
                className={iconBtn} style={{ color: T.ink }}><SkipForward size={17} /></button>

        <button onClick={ctl.stop} type="button" aria-label="Stop listening"
                className={iconBtn} style={{ color: T.muted }}><X size={17} /></button>
      </div>
    </div>
  );
}
