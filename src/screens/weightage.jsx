// =====================================================================
// src/screens/weightage.jsx — exam-weightage analytics screen (A1 slice 35)
// Extracted from App.jsx. Body byte-identical except the 1 A7 hook line + the
// signature change: data/allQuestions -> useData; `papers` STAYS a prop (the
// render site passes a computed `allPapers`, not data.papers). No IS_DARK/fgOnDark.
// =====================================================================
import React, { useState, useMemo } from 'react';
import { Activity, Target, ChevronRight, ChevronUp, ChevronDown, ClipboardList, Play, X } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTheme, useData } from '../lib/app-context.jsx';
import { attemptStats } from '../lib/compact.js';
import { topicName, topicColor, topicIcon } from '../lib/topics.js';
import { countsInNursingStats } from '../data/seed.js';
import { Card, Button, TopBar, Pill } from '../ui/primitives.jsx';

function WeightageScreen({ papers, onDrill, onOpenPapers, onBack }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const [view, setView] = useState('mix'); // 'mix' | 'yoy'
  // Issues round — tapping a subject row NO LONGER launches a quiz directly.
  // It opens this confirmation sheet (subject, weightage, your accuracy,
  // explicit "Start practice" CTA); the quiz only starts on that tap.
  const [confirmRow, setConfirmRow] = useState(null); // { id, name, icon, color, weightage, accuracy, coverage }
  const includeGk = data.preferences && data.preferences.includeGkInStats === true;

  // Only papers that actually carry questions are units of analysis.
  const loaded = useMemo(
    () => (papers || []).filter(p => p && Array.isArray(p.questions) && p.questions.length > 0),
    [papers]
  );

  const model = useMemo(() => {
    // 1) Per-paper topic mix (%) over the NURSING portion of each paper.
    const paperMix = [];
    loaded.forEach(p => {
      const nursing = p.questions.filter(q => q && countsInNursingStats(q.topic, includeGk));
      const tot = nursing.length;
      if (tot === 0) return;
      const counts = {};
      nursing.forEach(q => { counts[q.topic] = (counts[q.topic] || 0) + 1; });
      const pct = {};
      Object.keys(counts).forEach(t => { pct[t] = (counts[t] / tot) * 100; });
      paperMix.push({ year: (typeof p.year === 'number' && p.year > 0) ? p.year : null, pct });
    });

    // 2) Topic universe = every topic that appears in any paper.
    const topicSet = new Set();
    paperMix.forEach(m => Object.keys(m.pct).forEach(t => topicSet.add(t)));

    // 3) Typical weightage = mean across ALL papers (absent topic counts as 0%).
    const typical = {};
    topicSet.forEach(t => {
      const sum = paperMix.reduce((acc, m) => acc + (m.pct[t] || 0), 0);
      typical[t] = paperMix.length ? sum / paperMix.length : 0;
    });

    // 4) User accuracy + coverage per topic, from history and the pool.
    const hist = data.history || {};
    const seenByTopic = {};
    Object.entries(hist).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!seenByTopic[q.topic]) seenByTopic[q.topic] = { correct: 0, total: 0, unique: new Set() };
      seenByTopic[q.topic].correct += s.correct;
      seenByTopic[q.topic].total += s.total;
      seenByTopic[q.topic].unique.add(qId);
    });
    const poolByTopic = {};
    allQuestions.forEach(q => { poolByTopic[q.topic] = (poolByTopic[q.topic] || 0) + 1; });

    // 5) Rows. Topics in papers but NOT in the user's pool are kept (real exam
    //    content) but flagged inBank=false → "not in your bank yet".
    const rows = Array.from(topicSet).map(t => {
      const poolTotal = poolByTopic[t] || 0;
      const inBank = poolTotal > 0;
      const sb = seenByTopic[t];
      const accuracy = (sb && sb.total > 0) ? (sb.correct / sb.total) : null;
      const coverage = inBank ? ((sb ? sb.unique.size : 0) / poolTotal) : null;
      return { id: t, name: topicName(t), icon: topicIcon(t), color: topicColor(t), weightage: typical[t], accuracy, coverage, inBank };
    }).sort((a, b) => b.weightage - a.weightage);

    // 6) High-leverage = weightage × (1 − accuracy). Only in-bank topics, since
    //    the recommendation taps through to practice. Top 5.
    const leverage = rows
      .filter(r => r.inBank)
      .map(r => ({ ...r, score: (r.weightage / 100) * (1 - (r.accuracy == null ? 0 : r.accuracy)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // 7) Year-over-year: average each topic's % within a year (a year can have
    //    more than one paper), then track the first→last shift.
    const years = Array.from(new Set(paperMix.filter(m => m.year != null).map(m => m.year))).sort((a, b) => a - b);
    const yoy = years.map(yr => {
      const ofYear = paperMix.filter(m => m.year === yr);
      const row = { year: yr };
      topicSet.forEach(t => {
        const sum = ofYear.reduce((acc, m) => acc + (m.pct[t] || 0), 0);
        row[t] = ofYear.length ? +(sum / ofYear.length).toFixed(1) : 0;
      });
      return row;
    });
    const movers = [];
    if (years.length >= 2) {
      const first = yoy[0], last = yoy[yoy.length - 1];
      Array.from(topicSet).forEach(t => {
        const delta = (last[t] || 0) - (first[t] || 0);
        if (Math.abs(delta) >= 3) {
          movers.push({ id: t, name: topicName(t), color: topicColor(t), from: first[t] || 0, to: last[t] || 0, fromYear: first.year, toYear: last.year, delta, rising: delta > 0 });
        }
      });
      movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    }

    return { rows, leverage, years, yoy, movers, topics: Array.from(topicSet) };
  }, [loaded, data.history, data.preferences, allQuestions, includeGk]);

  const RISE = '#C2493B';   // rising weightage (red)
  const FALL = '#3B6EA5';   // declining weightage (blue)

  // Empty state — needs at least 2 papers with content to be meaningful.
  if (loaded.length < 2) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Exam weightage" onBack={onBack} feedback={{ screen: "Exam weightage" }} />
        <div className="max-w-md mx-auto px-4 pt-12 pb-24 text-center">
          <Activity size={48} className="mx-auto mb-4" style={{ color: T.muted, opacity: 0.4 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>Not enough papers yet</div>
          <div className="text-sm mb-6" style={{ color: T.muted }}>
            Weightage analysis becomes available once at least 2 previous year papers are loaded. Ask an admin to upload more.
          </div>
          {onOpenPapers && (
            <Button onClick={onOpenPapers} className="inline-flex" icon={<ClipboardList size={16} />}>
              Go to previous papers
            </Button>
          )}
        </div>
      </div>
    );
  }

  const maxW = Math.max(1, ...model.rows.map(r => r.weightage));
  const leverageIds = new Set(model.leverage.map(l => l.id));

  return (
    <div className="anim-fadeup">
      <TopBar title="Exam weightage" onBack={onBack} feedback={{ screen: "Exam weightage" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">

        <div className="text-xs mb-3" style={{ color: T.muted }}>
          Derived from {loaded.length} previous year paper{loaded.length === 1 ? '' : 's'}
          {model.years.length >= 2 ? ` (${model.years[0]}–${model.years[model.years.length - 1]})` : ''}.
        </div>

        {/* Strategic recommendation — shown on both views. */}
        {model.leverage.length > 0 && (
          <Card className="p-4 mb-4" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <Target size={15} style={{ color: T.primary }} />
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.primary }}>High-leverage topics</div>
            </div>
            <div className="text-xs mb-3" style={{ color: T.muted }}>
              Big share of the exam where you're not yet strong — the best return on study time.
            </div>
            <div className="space-y-2">
              {model.leverage.map(l => (
                <button key={l.id} onClick={() => setConfirmRow(l)}
                        className="no-tap-highlight w-full flex items-center gap-3 p-2 rounded-xl pressable text-left"
                        style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: l.color + '18' }}>{l.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: T.ink }}>{l.name}</div>
                    <div className="text-[11px]" style={{ color: T.muted }}>
                      {Math.round(l.weightage)}% of exam · {l.accuracy == null ? 'not practised yet' : `${Math.round(l.accuracy * 100)}% accuracy`}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: T.muted }} className="flex-shrink-0" />
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* View toggle */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[{ id: 'mix', label: 'Topic mix' }, { id: 'yoy', label: 'Year over year' }].map(opt => {
            const active = view === opt.id;
            return (
              <button key={opt.id} onClick={() => setView(opt.id)}
                      className="no-tap-highlight py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: active ? T.primary : T.surface, color: active ? '#FFF' : T.ink, border: `1.5px solid ${active ? T.primary : T.border}` }}>
                {opt.label}
              </button>
            );
          })}
        </div>

        {view === 'mix' && (
          <div className="space-y-2.5">
            {model.rows.map(r => {
              const hot = leverageIds.has(r.id);
              return (
                <Card key={r.id} className="p-3.5" onClick={r.inBank ? () => setConfirmRow(r) : undefined}
                      style={hot ? { border: `1px solid ${T.primary}40` } : {}}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: r.color + '15' }}>{r.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate" style={{ color: T.ink }}>{r.name}</span>
                        {hot && <Pill bg={T.primary + '18'} color={T.primary}>High ROI</Pill>}
                      </div>
                      {!r.inBank && (
                        <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>Not in your bank yet</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-display text-lg leading-none" style={{ color: T.ink }}>{Math.round(r.weightage)}%</div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>of exam</div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: T.border }}>
                    <div className="h-full rounded-full" style={{ width: `${(r.weightage / maxW) * 100}%`, background: r.color }} />
                  </div>
                  {r.inBank && (
                    <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: T.muted }}>
                      <span>Accuracy {r.accuracy == null ? '—' : `${Math.round(r.accuracy * 100)}%`}</span>
                      <span>Coverage {r.coverage == null ? '—' : `${Math.round(r.coverage * 100)}%`}</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {view === 'yoy' && (
          <div>
            {model.years.length < 2 ? (
              <Card className="p-4" style={{ background: T.surfaceWarm }}>
                <div className="text-sm" style={{ color: T.muted }}>
                  Year-over-year needs papers from at least two different years. Loaded papers don't span enough years yet.
                </div>
              </Card>
            ) : (
              <>
                <Card className="p-3 mb-4">
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={model.yoy} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: T.muted }} />
                        <YAxis tick={{ fontSize: 11, fill: T.muted }} unit="%" />
                        <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 12 }} />
                        {model.topics.map(t => {
                          const mover = model.movers.find(m => m.id === t);
                          const stroke = mover ? (mover.rising ? RISE : FALL) : T.border;
                          return (
                            <Line key={t} type="monotone" dataKey={t} name={topicName(t)}
                                  stroke={stroke} strokeWidth={mover ? 2.5 : 1}
                                  dot={mover ? { r: 3 } : false} isAnimationActive={false} />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {model.movers.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>Biggest shifts</div>
                    {model.movers.map(m => (
                      <Card key={m.id} className="p-3" onClick={() => { const r = model.rows.find(x => x.id === m.id); if (r && r.inBank) setConfirmRow(r); }}>
                        <div className="flex items-center gap-2">
                          {m.rising ? <ChevronUp size={16} style={{ color: RISE }} /> : <ChevronDown size={16} style={{ color: FALL }} />}
                          <span className="text-sm" style={{ color: T.ink }}>
                            <span className="font-semibold">{m.name}</span> {m.rising ? 'rose' : 'fell'} from {Math.round(m.from)}% ({m.fromYear}) to {Math.round(m.to)}% ({m.toYear})
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-center" style={{ color: T.muted }}>No topic shifted by 3% or more across these years — the mix has been stable.</div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Start-practice confirmation (issues round) — context first, quiz
          only after an explicit choice. */}
      {confirmRow && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
             style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setConfirmRow(null)}>
          <div className="sheet-up w-full max-w-md sm:mx-4 rounded-t-3xl sm:rounded-3xl p-5 pb-8"
               style={{ background: T.surface }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                     style={{ background: confirmRow.color + '18' }}>{confirmRow.icon}</div>
                <div className="min-w-0">
                  <div className="font-display text-lg font-semibold leading-tight" style={{ color: T.ink }}>{confirmRow.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>10-question topic drill</div>
                </div>
              </div>
              <button onClick={() => setConfirmRow(null)} aria-label="Close"
                      className="no-tap-highlight p-1.5 -m-1 rounded-full active:bg-black/5 flex-shrink-0">
                <X size={18} style={{ color: T.muted }} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden mb-5"
                 style={{ background: T.borderSoft, border: `1px solid ${T.borderSoft}` }}>
              <div className="py-3 text-center" style={{ background: T.surfaceWarm }}>
                <div className="font-display text-lg font-semibold leading-none" style={{ color: confirmRow.color }}>
                  {Math.round(confirmRow.weightage)}%
                </div>
                <div className="text-[9px] uppercase tracking-wider font-semibold mt-1.5" style={{ color: T.muted }}>of exam</div>
              </div>
              <div className="py-3 text-center" style={{ background: T.surfaceWarm }}>
                <div className="font-display text-lg font-semibold leading-none" style={{ color: T.ink }}>
                  {confirmRow.accuracy == null ? '—' : `${Math.round(confirmRow.accuracy * 100)}%`}
                </div>
                <div className="text-[9px] uppercase tracking-wider font-semibold mt-1.5" style={{ color: T.muted }}>your accuracy</div>
              </div>
              <div className="py-3 text-center" style={{ background: T.surfaceWarm }}>
                <div className="font-display text-lg font-semibold leading-none" style={{ color: T.ink }}>
                  {confirmRow.coverage == null ? '—' : `${Math.round(confirmRow.coverage * 100)}%`}
                </div>
                <div className="text-[9px] uppercase tracking-wider font-semibold mt-1.5" style={{ color: T.muted }}>coverage</div>
              </div>
            </div>

            <button onClick={() => { const id = confirmRow.id; setConfirmRow(null); onDrill && onDrill('topic', id); }}
                    className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold active:scale-95 transition"
                    style={{ background: T.primary, color: '#FFF', boxShadow: `0 4px 14px ${T.primary}50` }}>
              <Play size={15} /> Start practice
            </button>
            <button onClick={() => setConfirmRow(null)}
                    className="no-tap-highlight w-full py-3 mt-1.5 text-sm font-medium active:scale-95 transition"
                    style={{ color: T.muted, background: 'transparent' }}>
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeightageScreen;
