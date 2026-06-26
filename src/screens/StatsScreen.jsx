// =====================================================================
// STATS SCREEN  (extracted verbatim from App.jsx)
// The full progress dashboard: accuracy/streak summary, monthly trend
// chart, per-topic strength breakdown, and quick re-practice entry points.
// [A7] theme via useTheme(); app data + question pool via useData().
// onBack/onQuick/onPracticeTopic stay props.
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, ChevronDown, ChevronRight, ChevronUp, Flame, Layers, RotateCcw, Shuffle, Target, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme, useData } from '../lib/app-context.jsx';
import { attemptStats, hasBeenSeen } from '../lib/compact.js';
import { topicName, topicColor, topicIcon } from '../lib/topics.js';
import { Card, Button, TopBar, requestConfirm } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import WhereYouStandCard from '../ui/where-you-stand-card.jsx';
import CalibrationCard from '../ui/calibration-card.jsx';
import { calibrationFromItems } from '../lib/calibration.js';
import PacingCard from '../ui/pacing-card.jsx';
import EmptyState from '../ui/empty-state.jsx';

// FEAT-03 — Topic-trend ranges. Short ranges bucket by day/week, longer ones by
// calendar month, with thresholds scaled to how much data a window can hold
// (a 1-week window can't expect 5 attempts per bucket the way 6 months can).
//   unit    — day | week | month bucket granularity
//   count   — number of buckets
//   minCell — attempts a bucket needs before its accuracy point is plotted
//   minTotal— attempts a topic needs across the window to appear at all
const TREND_RANGES = [
  { id: '1w',  label: '1W',  unit: 'day',   count: 7,  minCell: 1, minTotal: 3,  note: 'Daily accuracy by topic.' },
  { id: '2w',  label: '2W',  unit: 'day',   count: 14, minCell: 1, minTotal: 4,  note: 'Daily accuracy by topic.' },
  { id: '3w',  label: '3W',  unit: 'week',  count: 3,  minCell: 2, minTotal: 5,  note: 'Weekly accuracy by topic.' },
  { id: '1m',  label: '1M',  unit: 'week',  count: 4,  minCell: 2, minTotal: 6,  note: 'Weekly accuracy by topic.' },
  { id: '2m',  label: '2M',  unit: 'week',  count: 8,  minCell: 2, minTotal: 8,  note: 'Weekly accuracy by topic.' },
  { id: '3M',  label: '3M',  unit: 'month', count: 3,  minCell: 5, minTotal: 10, note: 'Monthly accuracy by topic.' },
  { id: '6M',  label: '6M',  unit: 'month', count: 6,  minCell: 5, minTotal: 10, note: 'Monthly accuracy by topic.' },
  { id: '12M', label: '12M', unit: 'month', count: 12, minCell: 5, minTotal: 10, note: 'Monthly accuracy by topic.' },
];
const TREND_RANGE_BY_ID = Object.fromEntries(TREND_RANGES.map(r => [r.id, r]));
const DAY_MS = 86400000;
function startOfDayMs(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }

// Build the ordered buckets [{ key, label, start, end }] for a range, oldest
// first, the last bucket ending at end-of-today.
function buildTrendBuckets(range, nowMs) {
  const buckets = [];
  if (range.unit === 'month') {
    const now = new Date(nowMs);
    for (let i = range.count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
      buckets.push({ key: `m${i}`, label: d.toLocaleDateString('en-US', { month: 'short' }), start: d.getTime(), end });
    }
  } else if (range.unit === 'week') {
    const end0 = startOfDayMs(nowMs) + DAY_MS; // end of today (exclusive)
    for (let i = range.count - 1; i >= 0; i--) {
      const end = end0 - i * 7 * DAY_MS;
      const start = end - 7 * DAY_MS;
      buckets.push({ key: `w${i}`, label: new Date(start).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), start, end });
    }
  } else { // day
    const todayStart = startOfDayMs(nowMs);
    for (let i = range.count - 1; i >= 0; i--) {
      const start = todayStart - i * DAY_MS;
      const d = new Date(start);
      const label = range.count <= 7
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : d.toLocaleDateString('en-US', { day: 'numeric' });
      buckets.push({ key: `d${i}`, label, start, end: start + DAY_MS });
    }
  }
  return { buckets, windowStart: buckets.length ? buckets[0].start : nowMs };
}

function StatsScreen({ onBack, onQuick, onResetData, onPracticeTopic, onStartAdvanced }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const [topicSort, setTopicSort] = useState('weak'); // 'weak' | 'strong'
  const [chartReady, setChartReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setChartReady(true), 280); return () => clearTimeout(t); }, []);
  const [trendRangeId, setTrendRangeId] = useState('6M');     // FEAT-03: 1w…12M
  const [showAllTrends, setShowAllTrends] = useState(false);  // P13: top-6 vs all topics

  const byTopic = useMemo(() => {
    const acc = {};
    Object.entries(data.history).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      // P15 — attemptStats returns accurate pre-compaction totals.
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!acc[q.topic]) acc[q.topic] = { id: q.topic, correct: 0, total: 0, name: topicName(q.topic), color: topicColor(q.topic) };
      acc[q.topic].total += s.total;
      acc[q.topic].correct += s.correct;
    });
    return Object.values(acc).map(x => ({
      ...x, accuracy: x.total > 0 ? Math.round((x.correct / x.total) * 100) : 0
    }));
  }, [data.history, allQuestions]);

  const dailyData = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = data.stats.dailyHistory.find(x => x.date === key);
      days.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
        label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        attempted: entry ? entry.attempted : 0
      });
    }
    return days;
  }, [data.stats.dailyHistory]);

  // How much of the pool has been touched at least once.
  const coverage = useMemo(() => {    // P15 — hasBeenSeen counts both Tier 2 (attempts present) and Tier 3.
    const seen = Object.values(data.history).filter(h => hasBeenSeen(h)).length;
    const total = allQuestions.length || 1;
    return { seen, total, pct: Math.round((seen / total) * 100) };
  }, [data.history, allQuestions]);

  // #4 — lifetime calibration across every confidence-tagged attempt.
  const calibration = useMemo(() => {
    const items = [];
    Object.values(data.history).forEach(h => {
      (h && Array.isArray(h.attempts) ? h.attempts : []).forEach(a => {
        if (a && a.conf) items.push(a);
      });
    });
    return calibrationFromItems(items);
  }, [data.history]);

  // #5 — lifetime pacing entries: every timed attempt joined with its topic.
  const pacingEntries = useMemo(() => {
    const topicById = {};
    allQuestions.forEach(q => { if (q && q.id != null) topicById[q.id] = q.topic; });
    const out = [];
    Object.entries(data.history).forEach(([qId, h]) => {
      const topic = topicById[qId];
      if (!topic) return;
      (h && Array.isArray(h.attempts) ? h.attempts : []).forEach(a => {
        if (a) out.push({ topic, timeMs: a.timeMs, correct: a.correct, revealed: a.revealed });
      });
    });
    return out;
  }, [data.history, allQuestions]);

  // Accuracy over the last 7 days vs the 7 days before — needs a little data
  // in each window to be meaningful.
  const trend = useMemo(() => {
    const now = Date.now(), day = 86400000;
    const cutA = now - 7 * day, cutB = now - 14 * day;
    let a = { c: 0, t: 0 }, b = { c: 0, t: 0 };
    Object.values(data.history).forEach(h => {
      (h.attempts || []).forEach(at => {
        if (typeof at.ts !== 'number') return;
        if (at.revealed) return; // neutral reveal — excluded from accuracy
        if (at.ts >= cutA) { a.t++; if (at.correct) a.c++; }
        else if (at.ts >= cutB) { b.t++; if (at.correct) b.c++; }
      });
    });
    if (a.t < 3 || b.t < 3) return null;
    return { delta: Math.round((a.c / a.t) * 100 - (b.c / b.t) * 100) };
  }, [data.history]);

  // The single most useful next action.
  const recommendation = useMemo(() => {
    const practiced = byTopic.filter(t => t.total >= 2);
    const weak = [...practiced].sort((x, y) => x.accuracy - y.accuracy)[0];
    if (weak && weak.accuracy < 70) return { kind: 'weak', topicId: weak.id, name: weak.name, accuracy: weak.accuracy };
    const practicedIds = new Set(byTopic.map(t => t.id));
    const poolTopicIds = Array.from(new Set(allQuestions.map(q => q.topic)));
    const untouched = poolTopicIds.find(id => !practicedIds.has(id));
    if (untouched) return { kind: 'new', topicId: untouched, name: topicName(untouched) };
    return { kind: 'sharp' };
  }, [byTopic, allQuestions]);

  const mastery = useMemo(() => {
    let strong = 0, building = 0, weak = 0;
    byTopic.forEach(t => { if (t.accuracy >= 75) strong++; else if (t.accuracy >= 50) building++; else weak++; });
    return { strong, building, weak };
  }, [byTopic]);

  // P13 — per-topic accuracy OVER TIME (monthly). Derived entirely from
  // data.history[qId].attempts[].ts (spec point 6): additive, migration-free,
  // does not touch data.stats.dailyHistory. Safe vs P15 compaction — any
  // trend window here is ≤12 months, well inside the 730-day per-attempt
  // retention, so attempts[] is always complete within the window.
  const topicTrends = useMemo(() => {
    const range = TREND_RANGE_BY_ID[trendRangeId] || TREND_RANGE_BY_ID['6M'];
    const { buckets, windowStart } = buildTrendBuckets(range, Date.now());
    // ts -> bucket key (linear scan; ≤14 buckets, modest attempt counts).
    const bucketKeyOf = (ts) => {
      for (let i = 0; i < buckets.length; i++) if (ts >= buckets[i].start && ts < buckets[i].end) return buckets[i].key;
      return null;
    };

    const acc = {};    // topicId -> bucketKey -> { c, t }
    const totals = {}; // topicId -> attempts within the window
    Object.entries(data.history).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      (h.attempts || []).forEach(at => {
        if (typeof at.ts !== 'number' || at.ts < windowStart) return;
        if (at.revealed) return; // neutral reveal — excluded from accuracy
        const bk = bucketKeyOf(at.ts);
        if (!bk) return;
        acc[q.topic] = acc[q.topic] || {};
        acc[q.topic][bk] = acc[q.topic][bk] || { c: 0, t: 0 };
        acc[q.topic][bk].t++; if (at.correct) acc[q.topic][bk].c++;
        totals[q.topic] = (totals[q.topic] || 0) + 1;
      });
    });

    const topics = Object.keys(acc)
      .filter(tid => (totals[tid] || 0) >= range.minTotal)
      .map(tid => {
        const series = buckets.map(m => {
          const cell = acc[tid][m.key];
          const ok = cell && cell.t >= range.minCell;      // skip buckets with too few attempts
          return {
            key: m.key, label: m.label, n: cell ? cell.t : 0,
            accuracy: ok ? Math.round((cell.c / cell.t) * 100) : null
          };
        });
        return { id: tid, name: topicName(tid), color: topicColor(tid), total: totals[tid], series };
      })
      .filter(t => t.series.filter(p => p.accuracy !== null).length >= 2) // a line needs ≥2 points
      .sort((a, b) => b.total - a.total);

    // Auto-derived insights: compare first vs last plotted bucket per topic.
    const cand = [];
    topics.forEach(t => {
      const pts = t.series.filter(p => p.accuracy !== null);
      if (pts.length < 2) return;
      const delta = pts[pts.length - 1].accuracy - pts[0].accuracy;
      if (delta >= 10) cand.push({ type: 'up', name: t.name, delta });
      else if (delta <= -10) cand.push({ type: 'down', name: t.name, delta });
      else if (pts.every(p => p.accuracy >= 75)) cand.push({ type: 'strong', name: t.name, delta: 0 });
    });
    const movers = cand.filter(c => c.type !== 'strong').sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const insights = [...movers, ...cand.filter(c => c.type === 'strong')].slice(0, 3);

    return { buckets, topics, insights, note: range.note };
  }, [data.history, allQuestions, trendRangeId]);

  if (data.stats.totalAttempted === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Your stats" onBack={onBack} feedback={{ screen: "Stats" }} />
        <div className="max-w-md mx-auto px-4 pt-6">
          <EmptyState
            icon={BarChart3}
            title="Your story starts with the first question"
            text="Attempt a quiz and your accuracy, streak and topic progress will appear here."
            actionLabel={onQuick ? 'Start a Quick Test' : undefined}
            onAction={onQuick}
            note="Every question lights up your Knowledge Map too." />
        </div>
      </div>
    );
  }

  const overallAcc = Math.round((data.stats.totalCorrect / data.stats.totalAttempted) * 100);
  const fortnightTotal = dailyData.reduce((s, d) => s + d.attempted, 0);
  const sortedTopics = [...byTopic].sort((a, b) => topicSort === 'weak' ? a.accuracy - b.accuracy : b.accuracy - a.accuracy);
  const streak = data.stats.streakCurrent || 0;
  const bestStreak = data.stats.streakBest || 0;

  const recColor = recommendation.kind === 'weak' ? T.error : recommendation.kind === 'new' ? T.primary : T.success;

  return (
    <div className="anim-fadeup">
      <TopBar title="Your stats" onBack={onBack} feedback={{ screen: "Stats" }} />
      <PageContainer size="content" className="pb-24 pt-2">

        {/* #1 — Where you stand: real marks (Advanced Test) OR an estimate from
            everyday practice, on the official ladder. Estimate = accuracy with
            1/3 negative marking applied — a low-barrier preview before a full
            Advanced Test. Needs ≥10 attempts to be meaningful. */}
        {(() => {
          const t = (data.stats && data.stats.totalAttempted) || 0;
          const c = (data.stats && data.stats.totalCorrect) || 0;
          let estimate = null;
          if (t >= 10) {
            const acc = c / t;
            estimate = { pct: Math.max(0, Math.round((acc - (1 - acc) / 3) * 100)), n: t };
          }
          return (
            <WhereYouStandCard history={data.advancedTestHistory} estimate={estimate}
                               onStartAdvanced={onStartAdvanced} onQuick={onQuick} />
          );
        })()}

        {/* Headline */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Questions answered</div>
            <div className="font-display text-3xl font-semibold" style={{ color: T.ink }}>{data.stats.totalAttempted}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Overall accuracy</div>
            <div className="flex items-baseline gap-2">
              <div className="font-display text-3xl font-semibold" style={{ color: T.primary }}>{overallAcc}%</div>
              {trend && trend.delta !== 0 && (
                <span className="inline-flex items-center text-[11px] font-semibold"
                      style={{ color: trend.delta > 0 ? T.success : T.error }}>
                  {trend.delta > 0 ? <ChevronUp size={13} /> : <ChevronDown size={13} />}{Math.abs(trend.delta)}
                </span>
              )}
            </div>
            {trend && trend.delta !== 0 && (
              <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>vs last week</div>
            )}
          </Card>
        </div>

        {/* Streak + coverage strip */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card className="p-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={14} style={{ color: streak > 0 ? T.accent : T.muted }} />
              <div className="text-[11px] uppercase tracking-wider" style={{ color: T.muted }}>Streak</div>
            </div>
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>
              {streak} <span className="text-sm font-normal" style={{ color: T.muted }}>day{streak === 1 ? '' : 's'}</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>best {bestStreak}</div>
          </Card>
          <Card className="p-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers size={14} style={{ color: T.sec.library }} />
              <div className="text-[11px] uppercase tracking-wider" style={{ color: T.muted }}>Coverage</div>
            </div>
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>
              {coverage.pct}% <span className="text-sm font-normal" style={{ color: T.muted }}>of pool</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>{coverage.seen} of {coverage.total} seen</div>
          </Card>
        </div>

        {/* #4/#5 — lifetime confidence calibration + pacing. Two analysis cards
            of similar weight; on desktop they sit side-by-side (mobile stacks
            them exactly as before). */}
        <div className="md:grid md:grid-cols-2 md:gap-4 md:items-start md:mb-5">
          <CalibrationCard cal={calibration} title="Calibration" subtitle="How often you're right at each confidence level" />
          <PacingCard entries={pacingEntries} title="Pacing" subtitle="Average time per question, by topic" />
        </div>

        {/* Focus next — the actionable recommendation */}
        <Card className="p-4 mb-5" style={{ background: recColor + '0E', border: `1px solid ${recColor}33` }}>
          <div className="flex items-center gap-2 mb-2">
            <Target size={15} style={{ color: recColor }} />
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: recColor }}>Focus next</div>
          </div>
          <div className="text-sm leading-relaxed mb-3" style={{ color: T.ink }}>
            {recommendation.kind === 'weak' && (
              <>Your weakest area is <span style={{ fontWeight: 600 }}>{recommendation.name}</span> at {recommendation.accuracy}%. A focused round here will raise your overall score fastest.</>
            )}
            {recommendation.kind === 'new' && (
              <>You haven't tried <span style={{ fontWeight: 600 }}>{recommendation.name}</span> yet. Covering new ground rounds out your preparation.</>
            )}
            {recommendation.kind === 'sharp' && (
              <>You're strong across every topic you've practised. Keep the edge with a quick mixed round.</>
            )}
          </div>
          <Button
            onClick={() => {
              if (recommendation.kind === 'sharp') { onQuick && onQuick(); }
              else { onPracticeTopic ? onPracticeTopic(recommendation.topicId) : (onQuick && onQuick()); }
            }}
            size="sm" className="w-full"
            icon={recommendation.kind === 'sharp' ? <Shuffle size={14} /> : <Target size={14} />}>
            {recommendation.kind === 'sharp' ? 'Start a quick round' : `Practise ${recommendation.name}`}
          </Button>
        </Card>

        {/* Last 14 days */}
        <Card className="p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Last 14 days</div>
            <div className="text-xs" style={{ color: T.muted }}>{fortnightTotal} answered</div>
          </div>
          <div className="h-32">
            {!chartReady ? (
              <div className="h-full flex items-end gap-1.5 pb-1">
                {[40,65,30,80,55,45,90,35,70,60,50,75,45,85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm skeleton-pulse"
                       style={{ height: `${h}%`, background: T.borderSoft, animationDelay: `${i * 50}ms` }} />
                ))}
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.muted }} />
                <Tooltip cursor={{ fill: T.borderSoft, opacity: 0.5 }}
                         content={({ active, payload }) => {
                           if (!active || !payload || !payload.length) return null;
                           const v = payload[0].payload;
                           return (
                             <div className="text-xs px-2.5 py-1.5 rounded-lg"
                                  style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }}>
                               <span style={{ color: T.muted }}>{v.label}: </span>
                               <span style={{ fontWeight: 600 }}>{v.attempted}</span>
                             </div>
                           );
                         }} />
                <Bar dataKey="attempted" radius={[4, 4, 0, 0]}>
                  {dailyData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.attempted > 0 ? T.primary : T.borderSoft} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* By topic — tappable rows + sort toggle + mastery legend */}
        {byTopic.length > 0 && (
          <Card className="p-4 mb-5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>By topic</div>
              <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                {[{ id: 'weak', label: 'Weakest' }, { id: 'strong', label: 'Strongest' }].map(s => {
                  const active = topicSort === s.id;
                  return (
                    <button key={s.id} onClick={() => setTopicSort(s.id)}
                            className="no-tap-highlight text-[11px] font-medium px-2.5 py-1 transition-colors"
                            style={{ background: active ? T.primary : 'transparent', color: active ? '#FFF' : T.muted }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mastery legend */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[11px]" style={{ color: T.muted }}>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: T.success }} />{mastery.strong} strong</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: T.primary }} />{mastery.building} building</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: T.error }} />{mastery.weak} to work on</span>
            </div>

            <div className="space-y-1 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-1">
              {sortedTopics.map(t => (
                <button key={t.id}
                        onClick={() => onPracticeTopic && onPracticeTopic(t.id)}
                        className="no-tap-highlight w-full text-left rounded-xl px-2 py-2 -mx-2 active:bg-black/5 transition-colors">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="flex-shrink-0">{topicIcon(t.id)}</span>
                      <span className="font-medium truncate" style={{ color: T.ink }}>{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" style={{ color: T.muted }}>
                      <span>{t.accuracy}% <span className="text-xs">({t.correct}/{t.total})</span></span>
                      <ChevronRight size={14} style={{ color: T.muted, opacity: 0.7 }} />
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: T.borderSoft }}>
                    <div className="h-1.5 rounded-full transition-all"
                         style={{ width: `${t.accuracy}%`,
                                  background: t.accuracy >= 75 ? T.success : t.accuracy >= 50 ? T.primary : T.error }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="text-[10px] mt-2.5 px-0.5" style={{ color: T.muted }}>Tap any topic to practise it.</div>
          </Card>
        )}

        {/* Topic trends — P13: per-topic accuracy over time */}
        <Card className="p-4 mb-5">
          <div className="text-xs uppercase tracking-wider mb-2.5" style={{ color: T.muted }}>Topic trends</div>
          {/* FEAT-03 — premium range selector: short (1–3W, 1–2M) + long (3–12M)
              windows in one horizontally-scrollable pill rail. */}
          <div className="-mx-1 px-1 mb-2.5 flex gap-1.5 overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {TREND_RANGES.map(r => {
              const active = trendRangeId === r.id;
              return (
                <button key={r.id} onClick={() => setTrendRangeId(r.id)}
                        className="no-tap-highlight flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95"
                        style={{ background: active ? T.primary : T.surface,
                                 color: active ? '#FFF' : T.inkSoft,
                                 border: `1.5px solid ${active ? T.primary : T.border}`,
                                 boxShadow: active ? `0 2px 8px ${T.primary}33` : 'none' }}>
                  {r.label}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] mb-3" style={{ color: T.muted }}>{topicTrends.note}</div>

          {topicTrends.topics.length === 0 ? (
            <div className="text-sm text-center py-6" style={{ color: T.muted }}>
              Not enough data in this window yet. Practise a topic across at least two periods of the selected range to see its trend — or pick a longer range.
            </div>
          ) : (() => {
            const visible = showAllTrends ? topicTrends.topics : topicTrends.topics.slice(0, 6);
            const rows = topicTrends.buckets.map(m => {
              const row = { label: m.label };
              visible.forEach(t => {
                const pt = t.series.find(p => p.key === m.key);
                row[t.id] = pt ? pt.accuracy : null;
              });
              return row;
            });
            return (
              <>
                <div className="h-48">
                  {!chartReady ? (
                    <div className="h-full w-full skeleton-pulse rounded-xl" style={{ background: T.borderSoft }} />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rows} margin={{ top: 5, right: 6, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.muted }} />
                        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} axisLine={false} tickLine={false}
                               tick={{ fontSize: 10, fill: T.muted }} width={34} unit="%" />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const pts = payload.filter(p => p.value !== null && p.value !== undefined);
                          if (!pts.length) return null;
                          return (
                            <div className="text-xs px-2.5 py-1.5 rounded-lg"
                                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, maxWidth: 200 }}>
                              <div style={{ color: T.muted, marginBottom: 2 }}>{label}</div>
                              {pts.map(p => {
                                const t = visible.find(x => x.id === p.dataKey);
                                const s = t && t.series.find(x => x.label === label);
                                return (
                                  <div key={p.dataKey} className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                                    <span style={{ fontWeight: 600 }}>{t ? t.name : p.dataKey}</span>
                                    <span style={{ color: T.muted }}>{p.value}%{s ? ` · n=${s.n}` : ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }} />
                        {visible.map(t => (
                          <Line key={t.id} type="monotone" dataKey={t.id} stroke={t.color}
                                strokeWidth={2} dot={{ r: 2.5, fill: t.color }} activeDot={{ r: 4 }}
                                connectNulls isAnimationActive={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px]" style={{ color: T.muted }}>
                  {visible.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />{t.name}
                    </span>
                  ))}
                </div>

                {topicTrends.topics.length > 6 && (
                  <button onClick={() => setShowAllTrends(v => !v)}
                          className="no-tap-highlight text-[11px] font-medium mt-2" style={{ color: T.primary }}>
                    {showAllTrends ? 'Show top 6' : `Show all ${topicTrends.topics.length}`}
                  </button>
                )}

                {topicTrends.insights.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {topicTrends.insights.map((ins, i) => {
                      const c = ins.type === 'up' ? T.success : ins.type === 'down' ? T.error : T.primary;
                      const txt = ins.type === 'up' ? `${ins.name} +${ins.delta}%`
                                : ins.type === 'down' ? `${ins.name} ${ins.delta}%`
                                : `${ins.name} ✓`;
                      return (
                        <span key={i} className="text-[11px] rounded-full px-2.5 py-1"
                              style={{ background: c + '15', color: c, fontWeight: 600 }}>
                          {txt}
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </Card>

        {/* Speed */}
        {(() => {
          const speedByTopic = {};
          let allTimes = [];
          Object.entries(data.history || {}).forEach(([qId, h]) => {
            const q = allQuestions.find(x => x.id === qId);
            if (!q || !h.attempts) return;
            h.attempts.forEach(a => {
              if (typeof a.timeMs !== 'number' || a.timeMs <= 0) return;
              if (a.revealed) return; // neutral reveal — not a timed attempt
              const tt = speedByTopic[q.topic] || { times: [], correctTimes: [], name: topicName(q.topic) };
              tt.times.push(a.timeMs);
              if (a.correct) tt.correctTimes.push(a.timeMs);
              speedByTopic[q.topic] = tt;
              allTimes.push(a.timeMs);
            });
          });
          if (allTimes.length === 0) return null;
          const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
          const fmt = (ms) => ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
          const overallAvgMs = avg(allTimes);

          const slowAccurate = Object.entries(speedByTopic).map(([tid, tt]) => {
            const totals = byTopic.find(b => b.name === tt.name);
            const acc = totals ? totals.accuracy : 0;
            const corrAvg = tt.correctTimes.length > 0 ? avg(tt.correctTimes) : avg(tt.times);
            return { tid, name: tt.name, acc, corrAvg, isSlowAccurate: acc >= 70 && corrAvg > overallAvgMs * 1.3 };
          });

          return (
            <Card className="p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Speed</div>
                <div className="text-xs" style={{ color: T.muted }}>avg per question</div>
              </div>
              <div className="font-display text-2xl font-semibold mb-3" style={{ color: T.ink }}>{fmt(overallAvgMs)}</div>

              <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-2.5">
                {Object.entries(speedByTopic)
                  .map(([tid, tt]) => ({ tid, name: tt.name, avgMs: avg(tt.times), n: tt.times.length }))
                  .sort((a, b) => b.avgMs - a.avgMs)
                  .map(row => {
                    const sa = slowAccurate.find(x => x.tid === row.tid);
                    return (
                      <div key={row.tid} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>{topicIcon(row.tid)}</span>
                          <span className="text-sm truncate" style={{ color: T.ink }}>{row.name}</span>
                          {sa && sa.isSlowAccurate && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ml-1 whitespace-nowrap"
                                  style={{ background: T.accent + '20', color: T.accent }}>
                              Accurate but slow
                            </span>
                          )}
                        </div>
                        <div className="text-xs tabular-nums flex-shrink-0" style={{ color: T.muted }}>
                          {fmt(row.avgMs)} <span style={{ opacity: 0.6 }}>· {row.n}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          );
        })()}

        {/* B1 — "Begin fresh": a clean-slate reset right where it's most
            tempting (looking at your stats). It runs the SAME profile-data
            reset as Settings → Profile → Reset, gated by a clear caution. */}
        {onResetData && (
          <div className="mt-8 pt-5" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
            <button
              onClick={() => requestConfirm({
                icon: <Trash2 size={20} style={{ color: '#E5484D' }} />,
                title: "Reset this profile's data?",
                body: "This permanently deletes progress, bookmarks, stats, and custom questions for this profile only. Other profiles are untouched. This cannot be undone — consider downloading a backup first (Settings → Backup).",
                confirmLabel: 'Reset data',
                cancelLabel: 'Cancel',
                tone: 'danger',
                confirmWord: 'RESET',
                onConfirm: () => onResetData(),
              })}
              className="no-tap-highlight w-full flex items-center gap-3 p-3.5 rounded-2xl text-left active:scale-[0.99] transition"
              style={{ background: T.errorSoft, border: `1px solid ${T.error}30` }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.error + '22' }}>
                <RotateCcw size={17} style={{ color: T.error }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm" style={{ color: T.error }}>Begin fresh</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.error, opacity: 0.7 }}>
                  Reset everything and start over with a clean slate
                </div>
              </div>
            </button>
          </div>
        )}
      </PageContainer>
    </div>
  );
}

export default StatsScreen;
