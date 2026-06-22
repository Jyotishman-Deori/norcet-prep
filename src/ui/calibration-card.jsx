// =====================================================================
// CALIBRATION CARD  —  shared report for Results (this round) + Stats (lifetime)
// =====================================================================
// Renders accuracy within each declared-confidence bucket plus one honest
// insight. Takes a `cal` object from lib/calibration.js (calibrationFromItems),
// so the same component serves both the per-round and lifetime views.
// Renders nothing when there's no confidence data — safe for legacy users.
// =====================================================================
import React from 'react';
import { Gauge } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';
import { CONF_LEVELS, CONF_META, calibrationInsight } from '../lib/calibration.js';

const CONF_COLOR = {
  sure:   (T) => T.success,
  unsure: (T) => (T.sec && T.sec.stats) || T.primary,
  guess:  () => '#B8791A',
};

export default function CalibrationCard({ cal, title = 'Calibration', subtitle, className = 'mb-5' }) {
  const { theme: T } = useTheme();
  if (!cal || cal.total === 0) return null;
  const insight = calibrationInsight(cal);
  const accent = (T.sec && T.sec.stats) || T.primary;

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center gap-1.5">
        <Gauge size={14} style={{ color: accent }} />
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: accent }}>{title}</span>
      </div>
      {subtitle && <div className="text-[12px] mt-0.5" style={{ color: T.muted }}>{subtitle}</div>}

      <div className="space-y-2.5 mt-3">
        {CONF_LEVELS.map((l) => {
          const b = cal.buckets[l];
          const has = b.n > 0;
          const c = CONF_COLOR[l](T);
          return (
            <div key={l} className="flex items-center gap-3">
              <div className="w-14 shrink-0 text-[12px] font-semibold" style={{ color: has ? T.ink : T.muted }}>
                {CONF_META[l].label}
              </div>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: T.surfaceWarm }}>
                {has && <div style={{ width: `${b.acc}%`, height: '100%', background: c, borderRadius: 999, transition: 'width 0.6s ease-out' }} />}
              </div>
              <div className="w-16 shrink-0 text-right text-[12px]" style={{ color: has ? T.ink : T.muted }}>
                {has ? <><b>{b.acc}%</b> <span style={{ color: T.muted }}>· {b.n}</span></> : <span style={{ color: T.muted }}>—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {insight ? (
        <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>{insight.text}</p>
      ) : (
        <p className="mt-3 text-[11px] leading-snug" style={{ color: T.muted }}>
          Bar = how often you were right at each confidence level. The goal is for “Sure” to sit highest.
        </p>
      )}
    </Card>
  );
}
