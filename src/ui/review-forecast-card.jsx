// =====================================================================
// REVIEW FORECAST CARD  —  upcoming spaced-review load at a glance
// =====================================================================
// Turns the SRS schedule into a "due today + next 7 days" view so revision
// feels like a plan, not a surprise pile. Read-only; uses the plum "revision"
// accent to match the rest of the review surface.
// =====================================================================
import React from 'react';
import { CalendarClock, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';
import { reviewForecast, bucketLabel } from '../lib/review-forecast.js';

function Eyebrow({ accent }) {
  return (
    <div className="flex items-center gap-1.5">
      <CalendarClock size={13} style={{ color: accent }} />
      <span className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: accent }}>Review load</span>
    </div>
  );
}

export default function ReviewForecastCard({ history, onStartReview, className = 'mb-5' }) {
  const { theme: T } = useTheme();
  const f = reviewForecast(history, { days: 7 });
  const accent = (T.sec && T.sec.revision) || T.primary;
  const cardStyle = { background: accent + '0E', border: `1px solid ${accent}33` };

  // Brand-new user with no schedule yet — a gentle nudge, not an empty box.
  if (f.scheduled === 0) {
    return (
      <Card className={`p-4 ${className}`} style={cardStyle}>
        <Eyebrow accent={accent} />
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
          Your spaced-review schedule builds as you practise. Finish a round and questions will start
          appearing here on the days they’re best revised.
        </p>
      </Card>
    );
  }

  const maxH = 44;

  return (
    <Card className={`p-4 ${className}`} style={cardStyle}>
      <Eyebrow accent={accent} />

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-semibold leading-none" style={{ fontSize: '2.2rem', color: T.ink }}>{f.dueNow}</span>
            <span className="text-[13px]" style={{ color: T.muted }}>{f.dueNow === 0 ? 'due: all caught up' : 'due today'}</span>
          </div>
          {f.overdue > 0 && <div className="text-[11px] mt-0.5 font-medium" style={{ color: T.accent }}>{f.overdue} overdue</div>}
        </div>
        {f.dueNow > 0 && onStartReview && (
          <button onClick={onStartReview}
                  className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-3.5 py-2 active:scale-95 transition"
                  style={{ background: accent, color: '#fff' }}>
            Review now <ArrowUpRight size={15} />
          </button>
        )}
      </div>

      {/* 7-day forecast bars */}
      <div className="mt-4 flex items-end gap-1.5" style={{ height: maxH + 20 }}>
        {f.buckets.map((b, i) => {
          const h = f.peak > 0 ? Math.max(b.count > 0 ? 6 : 2, (b.count / f.peak) * maxH) : 2;
          const isToday = b.offset === 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
              <span className="text-[9px] font-semibold" style={{ color: isToday ? accent : T.muted, opacity: b.count > 0 ? 1 : 0 }}>{b.count || 0}</span>
              <div style={{ width: '100%', height: h, borderRadius: 4, background: isToday ? accent : accent + '45', transition: 'height 0.5s ease-out' }} />
              <span className="text-[9px]" style={{ color: isToday ? T.ink : T.muted, fontWeight: isToday ? 600 : 400 }}>{bucketLabel(b)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-[11px]" style={{ color: T.muted }}>
        {f.weekTotal} due in the next 7 days{f.laterTotal > 0 ? ` · ${f.laterTotal} scheduled later` : ''}
      </div>
    </Card>
  );
}
