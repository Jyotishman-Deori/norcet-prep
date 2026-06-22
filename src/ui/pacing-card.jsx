// =====================================================================
// PACING CARD  —  shared report for Results (this round) + Stats (lifetime)
// =====================================================================
// Takes already-topic-resolved entries ({ topic, timeMs, correct?, revealed? })
// and shows overall pace vs exam pace plus the slowest topics. Renders nothing
// without enough timed data — safe for any screen.
// =====================================================================
import React from 'react';
import { Timer } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';
import { topicName, topicColor } from '../lib/topics.js';
import { overallPace, pacingByTopic, paceVerdict, EXAM_PACE_SEC } from '../lib/pacing.js';

const fmt = (s) => (s >= 90 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

export default function PacingCard({ entries, title = 'Pacing', subtitle, maxTopics = 5, className = 'mb-5' }) {
  const { theme: T } = useTheme();
  const overall = overallPace(entries);
  if (!overall || overall.n < 4) return null; // not enough timed answers to be useful

  const rows = pacingByTopic(entries).slice(0, maxTopics);
  const verdict = paceVerdict(overall.avgSec);
  const accent = (T.sec && T.sec.stats) || T.primary;
  const scaleMax = Math.max(EXAM_PACE_SEC * 1.6, ...rows.map((r) => r.avgSec), 1);

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Timer size={14} style={{ color: accent }} />
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: accent }}>{title}</span>
        </div>
        <div className="text-[11px]" style={{ color: T.muted }}>exam pace ~{EXAM_PACE_SEC}s/Q</div>
      </div>
      {subtitle && <div className="text-[12px] mt-0.5" style={{ color: T.muted }}>{subtitle}</div>}

      {/* overall */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display font-semibold leading-none" style={{ fontSize: '1.9rem', color: T.ink }}>
          {fmt(overall.avgSec)}
        </span>
        <span className="text-[12px]" style={{ color: T.muted }}>avg / question</span>
      </div>
      {verdict && <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>{verdict.text}</p>}

      {/* slowest topics */}
      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Slowest topics</div>
          {rows.map((r) => {
            const over = r.overSec > 0;
            const tc = topicColor(r.topic);
            const barW = Math.max(4, Math.min(100, (r.avgSec / scaleMax) * 100));
            const paceColor = over ? '#B8791A' : T.success;
            return (
              <div key={r.topic} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-[12px] font-medium truncate" style={{ color: T.ink }}>{topicName(r.topic)}</div>
                <div className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: T.surfaceWarm }}>
                  <div style={{ width: `${barW}%`, height: '100%', background: tc, borderRadius: 999, transition: 'width 0.6s ease-out' }} />
                  {/* exam-pace marker */}
                  <div style={{ position: 'absolute', top: -1, bottom: -1, left: `${Math.min(100, (EXAM_PACE_SEC / scaleMax) * 100)}%`, width: 1.5, background: T.muted, opacity: 0.5 }} />
                </div>
                <div className="w-20 shrink-0 text-right text-[12px]" style={{ color: T.ink }}>
                  {fmt(r.avgSec)} <span style={{ color: paceColor, fontWeight: 600 }}>{over ? `+${r.overSec}` : r.overSec}s</span>
                </div>
              </div>
            );
          })}
          <div className="text-[10px] leading-snug pt-0.5" style={{ color: T.muted }}>
            Faint line marks exam pace. Green = faster than pace, amber = over.
          </div>
        </div>
      )}
    </Card>
  );
}
