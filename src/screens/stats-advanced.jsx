// =====================================================================
// src/screens/stats-advanced.jsx — the "Advanced" tab of the Stats screen
// (master-plan NEW-07 Advanced Post-Test Analytics Engine).
//
// Four premium views, all fed by pure, tested src/lib modules:
//   1. What-If simulator v2 (whatif.js)      — negative-marking strategy
//   2. Doubt Mapping matrix (doubt-matrix.js) — confidence x accuracy 2x2
//   3. Clinical System Leak Radar (clinical-systems.js)
//   4. Strategic Benchmark panel (benchmark.js) — you vs topper targets
//
// Every card renders an honest empty state with zero data, so a brand-new
// or pre-confidence-feature profile sees guidance, never blanks or NaN.
// Strings stay English (stats is not in the i18n surface set yet).
// =====================================================================
import React, { useMemo } from 'react';
import { Crosshair, Radar, Trophy, ChevronRight, Sparkles, Check, Minus } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import WhatIfCard from '../ui/what-if-card.jsx';
import { QUADRANTS, QUADRANT_META, doubtMatrixFromHistory, doubtMatrixInsight } from '../lib/doubt-matrix.js';
import { clinicalLeaks, leakInsight } from '../lib/clinical-systems.js';
import { TOPPER_TARGETS, userBenchmarks } from '../lib/benchmark.js';

const SectionLabel = ({ icon: Icon, children, T }) => (
  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: T.muted }}>
    <Icon size={13} /> {children}
  </div>
);

export default function AdvancedStatsPanel({ onReviewQuestions, onStartAdvanced }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();

  const matrix = useMemo(() => doubtMatrixFromHistory(data.history), [data.history]);
  const matrixNote = useMemo(() => doubtMatrixInsight(matrix), [matrix]);
  const leaks = useMemo(() => clinicalLeaks(data.history, allQuestions), [data.history, allQuestions]);
  const leakNote = useMemo(() => leakInsight(leaks), [leaks]);
  const bench = useMemo(
    () => userBenchmarks(data.advancedTestHistory, data.history, allQuestions),
    [data.advancedTestHistory, data.history, allQuestions]);

  const mocks = data.advancedTestHistory || [];
  const latestMock = mocks.length > 0 ? mocks[mocks.length - 1] : null;

  const toneColor = { success: T.success, error: T.error, warn: T.accent, muted: T.muted };
  const maxSeverity = leaks.hasData ? Math.max(...leaks.systems.map(s => s.severity), 0.0001) : 1;

  const review = (qIds) => { if (onReviewQuestions && qIds && qIds.length > 0) onReviewQuestions(qIds); };

  return (
    <div className="anim-fadeup">

      {/* 1 — What-If simulator v2 */}
      <SectionLabel icon={Crosshair} T={T}>What-if · plan your attempt strategy</SectionLabel>
      {latestMock ? (
        <WhatIfCard variant="v2" className="mb-5"
                    correct={latestMock.correct || 0} wrong={latestMock.wrong || 0}
                    blank={latestMock.blank || 0} count={latestMock.count || 0}
                    netScore={latestMock.netScore || 0} />
      ) : (
        <Card className="p-4 mb-5">
          <div className="text-sm font-medium mb-1" style={{ color: T.ink }}>No full test yet</div>
          <div className="text-xs leading-relaxed mb-3" style={{ color: T.muted }}>
            The simulator replays a real negative-marked attempt: take one full Advanced Test and it unlocks here.
          </div>
          {onStartAdvanced && (
            <Button onClick={onStartAdvanced} size="sm" variant="ghost">Take an Advanced Test</Button>
          )}
        </Card>
      )}

      {/* 2 — Doubt Mapping matrix */}
      <SectionLabel icon={Crosshair} T={T}>Doubt mapping · confidence vs accuracy</SectionLabel>
      {!matrix.hasData ? (
        <Card className="p-4 mb-5">
          <div className="text-sm font-medium mb-1" style={{ color: T.ink }}>Nothing mapped yet</div>
          <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
            Tag your confidence (Sure, Unsure, Guess) while answering quizzes. Each tagged answer lands in one of four zones here, exposing misconceptions before the exam does.
          </div>
        </Card>
      ) : (
        <div className="mb-5">
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            {QUADRANTS.map((qk) => {
              const meta = QUADRANT_META[qk];
              const cell = matrix.cells[qk];
              const color = toneColor[meta.tone];
              const tappable = qk !== 'sweet' && cell.qIds.length > 0;
              const Wrapper = tappable ? 'button' : 'div';
              return (
                <Wrapper key={qk}
                         onClick={tappable ? () => review(cell.qIds) : undefined}
                         className={`no-tap-highlight text-left rounded-2xl p-3.5 ${tappable ? 'pressable cursor-pointer' : ''}`}
                         style={{
                           background: qk === 'fatal' && cell.n > 0 ? color + '12' : T.surface,
                           border: `1.5px solid ${cell.n > 0 ? color + (qk === 'fatal' ? '' : '55') : T.border}`,
                         }}>
                  <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color }}>
                    {meta.label}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-semibold tabular-nums" style={{ color: cell.n > 0 ? color : T.muted }}>
                      {cell.n}
                    </span>
                    <span className="text-[11px]" style={{ color: T.muted }}>{cell.pct}%</span>
                  </div>
                  <div className="text-[10.5px] mt-1 leading-snug" style={{ color: T.muted }}>{meta.action}</div>
                  {tappable && (
                    <div className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold mt-1.5" style={{ color }}>
                      Review {cell.qIds.length} <ChevronRight size={11} />
                    </div>
                  )}
                </Wrapper>
              );
            })}
          </div>
          {matrixNote && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: T.error + '10', border: `1px solid ${T.error}33` }}>
              <Sparkles size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
              <div className="text-[11.5px] leading-relaxed" style={{ color: T.inkSoft }}>{matrixNote.text}</div>
            </div>
          )}
        </div>
      )}

      {/* 3 — Clinical System Leak Radar */}
      <SectionLabel icon={Radar} T={T}>Leak radar · by clinical system</SectionLabel>
      {!leaks.hasData ? (
        <Card className="p-4 mb-5">
          <div className="text-sm font-medium mb-1" style={{ color: T.ink }}>Not enough clinical attempts yet</div>
          <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
            Answer a few more clinical questions and your mistakes get grouped by body system (Cardiovascular, Respiratory, and so on) instead of by textbook chapter, showing exactly where marks are leaking.
          </div>
        </Card>
      ) : (
        <Card className="p-4 mb-5">
          <div className="text-[11px] mb-3 leading-relaxed" style={{ color: T.muted }}>
            Wrong-answer rate by body system, weighted by how much you practise each. Worst leak first.
          </div>
          <div className="space-y-1">
            {leaks.systems.map((s) => {
              const barColor = s.wrongRate >= 50 ? T.error : s.wrongRate >= 30 ? T.accent : T.success;
              return (
                <button key={s.id}
                        onClick={() => review(s.wrongQIds)}
                        disabled={s.wrongQIds.length === 0}
                        className="no-tap-highlight w-full text-left rounded-xl px-2 py-2 -mx-2 active:bg-black/5 transition-colors disabled:cursor-default">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="flex-shrink-0">{s.icon}</span>
                      <span className="font-medium truncate" style={{ color: T.ink }}>{s.label}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" style={{ color: T.muted }}>
                      <span>{s.wrongRate}% wrong <span className="text-xs">({s.wrong}/{s.attempts})</span></span>
                      {s.wrongQIds.length > 0 && <ChevronRight size={14} style={{ color: T.muted, opacity: 0.7 }} />}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: T.borderSoft }}>
                    <div className="h-1.5 rounded-full transition-all"
                         style={{ width: `${Math.max(4, Math.round((s.severity / maxSeverity) * 100))}%`, background: barColor }} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-[10px] mt-2.5 px-0.5" style={{ color: T.muted }}>Tap a system to revise its wrong answers.</div>
          {leakNote && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mt-3" style={{ background: T.accent + '12', border: `1px solid ${T.accent}33` }}>
              <Sparkles size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
              <div className="text-[11.5px] leading-relaxed" style={{ color: T.inkSoft }}>{leakNote.text}</div>
            </div>
          )}
        </Card>
      )}

      {/* 4 — Strategic benchmark panel */}
      <SectionLabel icon={Trophy} T={T}>Benchmarks · you vs topper targets</SectionLabel>
      <Card className="p-4 mb-5">
        <div className="space-y-3">
          {TOPPER_TARGETS.map((t) => {
            const m = { attempts: bench.attemptsPer100, guesses: bench.guesses, clinical: bench.clinicalSpeedSec, mains: bench.mainsAccuracy }[t.id];
            const youLabel = m.value === null ? null
              : t.id === 'clinical' ? `${m.value}s per Q`
              : t.id === 'mains' ? `${m.value}%`
              : `${m.value}`;
            return (
              <div key={t.id} className="pb-3 last:pb-0" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="text-sm font-medium" style={{ color: T.ink }}>{t.label}</div>
                  {m.value === null ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>
                      <Minus size={10} /> No data
                    </span>
                  ) : m.meets ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: T.success + '18', color: T.success }}>
                      <Check size={10} /> On target
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: T.accent + '18', color: T.accent }}>
                      Work on it
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  <span style={{ color: T.muted }}>Topper: <b style={{ color: T.inkSoft }}>{t.target}</b></span>
                  <span style={{ color: T.muted }}>You: <b style={{ color: m.value === null ? T.muted : m.meets ? T.success : T.ink }}>{youLabel || 'not measured yet'}</b></span>
                </div>
                <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: T.muted }}>{m.detail || t.why}</div>
              </div>
            );
          })}
        </div>
        <div className="text-[10px] mt-3 leading-relaxed" style={{ color: T.muted }}>
          Clinical speed is measured over clinical-topic questions and overall accuracy stands in for Mains accuracy: both are honest approximations, not official figures.
        </div>
      </Card>
    </div>
  );
}
