// =====================================================================
// src/ui/admin-engagement.jsx  (admin → Engagement)
// Aggregate activity view over the profile directory the admin app already
// loads: actives, signup trend, recency mix, and a "quiet lately" win-back
// list. AGGREGATES ONLY — no per-user study data exists here (that lives in
// broker-gated profile blobs). All math in lib/engagement.js (unit-tested);
// this file is presentation: hand-rolled SVG bars (no chart lib), spring
// micro-animations (.eng-*), reduced-motion safe.
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { Activity, RefreshCw, Users, Flame, UserPlus, MoonStar, TrendingUp } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from './primitives.jsx';
import { loadProfileIndex } from '../lib/profiles.js';
import { computeEngagement, agoLabel, RECENCY_BUCKETS } from '../lib/engagement.js';
import { loadGameConfig, getConfig } from '../lib/game-config.js';
import { normalizeInternalIds } from '../lib/internal-accounts.js';

export default function AdminEngagement({ onBack }) {
  const { theme: T } = useTheme();
  const [metas, setMetas] = useState(null); // null = loading
  const [internalIds, setInternalIds] = useState([]);
  const [spin, setSpin] = useState(false);

  const load = async () => {
    setSpin(true);
    try {
      // Internal (test/staff) accounts are excluded from every aggregate; the
      // list lives in the same game_config row the Live config editor edits.
      try { await loadGameConfig(); setInternalIds(normalizeInternalIds(getConfig().internalIds)); } catch (e) {}
      setMetas(await loadProfileIndex());
    }
    catch (e) { setMetas([]); }
    finally { setSpin(false); }
  };
  useEffect(() => { load(); }, []);

  const now = Date.now();
  const eng = useMemo(() => (metas ? computeEngagement(metas, now, { excludeIds: internalIds }) : null), [metas, internalIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const bucketTones = {
    today: T.success, week: T.primary, month: T.accent, dormant: T.error, never: T.muted,
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Engagement" onBack={onBack}
              right={
                <button onClick={load} disabled={spin} aria-label="Refresh"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
                  <RefreshCw size={18} style={{ color: T.muted }} className={spin ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 pb-24 pt-2 space-y-3">
        {!eng ? (
          <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : (
          <>
            {/* KPI band */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Users', value: eng.total, Icon: Users, tone: T.ink },
                { label: 'Today', value: eng.activeToday, Icon: Flame, tone: T.success },
                { label: '7 days', value: eng.active7, Icon: Activity, tone: T.primary },
                { label: 'New/wk', value: eng.newThisWeek, Icon: UserPlus, tone: T.accent },
              ].map((k, i) => (
                <Card key={k.label} className="p-2.5 text-center eng-kpi" style={{ animationDelay: `${i * 60}ms` }}>
                  <k.Icon size={14} className="mx-auto mb-1" style={{ color: k.tone }} />
                  <div className="font-display text-lg font-bold tabular-nums leading-none" style={{ color: k.tone }}>{k.value}</div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold mt-1" style={{ color: T.muted }}>{k.label}</div>
                </Card>
              ))}
            </div>

            {/* Weekly stickiness */}
            <Card className="p-4 eng-kpi" style={{ animationDelay: '240ms' }}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <TrendingUp size={16} style={{ color: T.primary }} />
                <span className="font-display text-[15px] font-bold" style={{ color: T.ink }}>Weekly stickiness</span>
                <span className="ml-auto font-display text-lg font-bold tabular-nums" style={{ color: T.primary }}>{eng.stickiness}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: T.surfaceWarm }}>
                <div className="h-full rounded-full eng-seg" style={{ width: `${eng.stickiness}%`, background: T.primary, animationDelay: '350ms' }} />
              </div>
              <div className="text-[11px] mt-1.5" style={{ color: T.muted }}>Share of all users who opened the app in the last 7 days.</div>
            </Card>

            {/* Signups per week — SVG bars */}
            <Card className="p-4">
              <div className="font-display text-[15px] font-bold mb-3" style={{ color: T.ink }}>New users per week</div>
              <SignupBars weeks={eng.signupsByWeek} T={T} />
            </Card>

            {/* Recency mix — stacked bar + legend */}
            <Card className="p-4">
              <div className="font-display text-[15px] font-bold mb-3" style={{ color: T.ink }}>Last seen</div>
              <div className="flex h-3 rounded-full overflow-hidden mb-3" style={{ background: T.surfaceWarm }}>
                {RECENCY_BUCKETS.map((b, i) => {
                  const n = eng.recency[b.id] || 0;
                  if (!n || !eng.total) return null;
                  return (
                    <div key={b.id} className="eng-seg" title={`${b.label}: ${n}`}
                         style={{ width: `${(n / eng.total) * 100}%`, background: bucketTones[b.id], animationDelay: `${120 + i * 90}ms` }} />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {RECENCY_BUCKETS.map(b => (
                  <span key={b.id} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: T.inkSoft }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: bucketTones[b.id] }} />
                    {b.label} · <b className="tabular-nums" style={{ color: T.ink }}>{eng.recency[b.id] || 0}</b>
                  </span>
                ))}
              </div>
            </Card>

            {/* Win-back list */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MoonStar size={16} style={{ color: T.accent }} />
                <span className="font-display text-[15px] font-bold" style={{ color: T.ink }}>Quiet lately</span>
              </div>
              <div className="text-[11px] mb-3" style={{ color: T.muted }}>
                Not seen for 14+ days, the most winnable-back first. A friendly announcement or new content push reaches them on their next open.
              </div>
              {eng.dormant.length === 0 ? (
                <div className="text-sm py-2" style={{ color: T.success }}>Nobody is dormant. The whole roster is active. 🎉</div>
              ) : (
                <div className="space-y-1.5">
                  {eng.dormant.map((m, i) => (
                    <div key={m.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 eng-kpi"
                         style={{ background: T.surfaceWarm, animationDelay: `${i * 40}ms` }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                           style={{ background: T.accent + '22', color: T.accent }}>
                        {(m.displayName || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: T.ink }}>{m.displayName}</div>
                        <div className="text-[10px]" style={{ color: T.muted }}>joined {agoLabel(m.createdAt, now)}</div>
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums flex-shrink-0" style={{ color: T.accent }}>
                        {agoLabel(m.lastActive, now)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="text-center text-[10.5px] px-4" style={{ color: T.muted }}>
              Aggregates from the profile directory (name + join/last-open times). Study data never leaves the broker-gated profile blobs.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Hand-rolled weekly signup bars — no chart library. Bars spring up staggered
// (.eng-bar); value labels sit above each bar; week labels below.
function SignupBars({ weeks, T }) {
  const max = Math.max(1, ...weeks.map(w => w.count));
  const W = 320, H = 120, PAD = 4, GAP = 8;
  const bw = (W - PAD * 2 - GAP * (weeks.length - 1)) / weeks.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 26}`} className="w-full" role="img"
         aria-label={`New users per week: ${weeks.map(w => `${w.label} ${w.count}`).join(', ')}`}>
      {weeks.map((w, i) => {
        const h = Math.max(w.count > 0 ? 6 : 2, (w.count / max) * (H - 18));
        const x = PAD + i * (bw + GAP);
        const y = H - h;
        const isLast = i === weeks.length - 1;
        return (
          <g key={w.start}>
            <rect className="eng-bar" x={x} y={y} width={bw} height={h} rx={4}
                  style={{ animationDelay: `${i * 55}ms` }}
                  fill={w.count > 0 ? (isLast ? T.primary : T.primary + '99') : T.border} />
            {w.count > 0 && (
              <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="700"
                    fill={isLast ? T.primary : T.muted} className="tabular-nums">{w.count}</text>
            )}
            <text x={x + bw / 2} y={H + 16} textAnchor="middle" fontSize="9" fill={T.muted}>{w.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
