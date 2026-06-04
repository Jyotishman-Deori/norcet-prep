// =====================================================================
// src/screens/coverage-map.jsx — syllabus-coverage accordion (A1 slice 36)
// Extracted from App.jsx. Body byte-identical except the 1 A7 hook line +
// signature: data/allQuestions -> useData. Pure SVG bars (no recharts).
// No IS_DARK/fgOnDark.
// =====================================================================
import React, { useState, useMemo } from 'react';
import { Activity, ChevronRight, Shuffle } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { attemptStats } from '../lib/compact.js';
import { TOPICS, countsInNursingStats } from '../data/seed.js';
import { Card, Button, TopBar } from '../ui/primitives.jsx';

function CoverageMap({ onBack, onDrill }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  // Accordion state: which topic id is currently expanded. Only one at a
  // time so the page doesn't turn into an unscrollable mess.
  const [expandedTopic, setExpandedTopic] = useState(null);

  const rows = useMemo(() => {
    // P18 — GK / Aptitude are not part of the nursing syllabus; keep them out
    // of the coverage map unless the user opted them into stats.
    const includeGk = data.preferences && data.preferences.includeGkInStats === true;
    // Count attempts + corrects per topic from history
    const byTopic = {};
    Object.entries(data.history || {}).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      // P15 — attemptStats covers Tier 2 + Tier 3.
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!byTopic[q.topic]) byTopic[q.topic] = { attempted: 0, correct: 0, uniqueAnswered: new Set() };
      byTopic[q.topic].uniqueAnswered.add(qId);
      byTopic[q.topic].attempted += s.total;
      byTopic[q.topic].correct += s.correct;
    });
    // Total available per topic
    const totalPerTopic = {};
    allQuestions.forEach(q => { totalPerTopic[q.topic] = (totalPerTopic[q.topic] || 0) + 1; });

    return TOPICS
      .filter(t => totalPerTopic[t.id] > 0 && countsInNursingStats(t.id, includeGk))
      .map(t => {
        const s = byTopic[t.id] || { attempted: 0, correct: 0, uniqueAnswered: new Set() };
        const total = totalPerTopic[t.id] || 0;
        const coverage = total > 0 ? (s.uniqueAnswered.size / total) : 0;
        const accuracy = s.attempted > 0 ? (s.correct / s.attempted) : null;
        return {
          ...t,
          attempted: s.attempted,
          correct: s.correct,
          uniqueAnswered: s.uniqueAnswered.size,
          total,
          coverage,
          accuracy
        };
      })
      .sort((a, b) => a.coverage - b.coverage);
  }, [data.history, allQuestions, data.preferences]);

  // Build sub-topic breakdown ONLY for the expanded topic. Memoised against
  // `expandedTopic` so collapsed topics don't pay the cost.
  const subRowsForExpanded = useMemo(() => {
    if (!expandedTopic) return [];

    // All questions in this topic.
    const tQs = allQuestions.filter(q => q.topic === expandedTopic);
    // Bucket by `sub` field. Missing/blank → "General".
    const buckets = new Map();
    tQs.forEach(q => {
      const sub = (q.sub && String(q.sub).trim()) || 'General';
      if (!buckets.has(sub)) buckets.set(sub, []);
      buckets.get(sub).push(q);
    });

    // Score each sub-topic against history.
    const history = data.history || {};
    const result = [];
    buckets.forEach((qs, subName) => {
      let attempted = 0, correct = 0;
      const uniqueAnswered = new Set();
      qs.forEach(q => {
        const h = history[q.id];
        if (!h) return;
        // P15 — attemptStats normalizes Tier 2 / Tier 3.
        const s = attemptStats(h);
        if (s.total === 0) return;
        uniqueAnswered.add(q.id);
        attempted += s.total;
        correct += s.correct;
      });
      const total = qs.length;
      const coverage = total > 0 ? uniqueAnswered.size / total : 0;
      const accuracy = attempted > 0 ? correct / attempted : null;
      result.push({
        sub: subName,
        total,
        attempted,
        uniqueAnswered: uniqueAnswered.size,
        coverage,
        accuracy
      });
    });

    // Weakest / least-covered first — same ordering rule as the topic list.
    return result.sort((a, b) => a.coverage - b.coverage);
  }, [expandedTopic, allQuestions, data.history]);

  const totalAttempted = data.stats.totalAttempted || 0;

  if (totalAttempted === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Syllabus Coverage" onBack={onBack} feedback={{ screen: "Coverage map" }} />
        <div className="max-w-md mx-auto px-4 pt-12 pb-24 text-center">
          <Activity size={48} className="mx-auto mb-4" style={{ color: T.muted, opacity: 0.4 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>No coverage yet</div>
          <div className="text-sm mb-6" style={{ color: T.muted }}>
            Practise some questions and your topic-by-topic coverage will show up here.
          </div>
          <Button onClick={() => onDrill('quick-setup')} className="inline-flex">
            Start Quick test
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fadeup">
      <TopBar title="Syllabus Coverage" onBack={onBack} feedback={{ screen: "Coverage map" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="text-xs mb-4 leading-relaxed px-1" style={{ color: T.muted }}>
          Tap a topic to see its sub-topics. Use the start button to practise just that area.
        </div>

        <div className="space-y-3">
          {rows.map(r => {
            const isWeak = r.coverage < 0.2;
            const labelTone = r.attempted === 0
              ? { text: 'Not touched', color: T.error, bg: T.errorSoft }
              : isWeak
                ? { text: 'Barely touched', color: T.accent, bg: T.accent + '15' }
                : r.coverage < 0.5
                  ? { text: 'Light coverage', color: T.muted, bg: T.surfaceWarm }
                  : r.coverage < 0.8
                    ? { text: 'Building', color: T.primary, bg: T.primary + '15' }
                    : { text: 'Well covered', color: T.success, bg: T.successSoft };
            const accColor = r.accuracy == null
              ? T.muted
              : r.accuracy >= 0.75 ? T.success : r.accuracy >= 0.5 ? T.primary : T.error;

            const isOpen = expandedTopic === r.id;

            return (
              <Card key={r.id} className="overflow-hidden">
                {/* TOPIC ROW — tap to expand sub-topics. The Start button is a
                    sibling element so its tap doesn't bubble up to the row. */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => setExpandedTopic(isOpen ? null : r.id)}
                            className="no-tap-highlight flex items-start gap-3 flex-1 min-w-0 text-left">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                           style={{ background: r.color + '18' }}>
                        {r.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="font-display text-sm font-semibold truncate" style={{ color: T.ink }}>{r.name}</div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                                style={{ background: labelTone.bg, color: labelTone.color }}>
                            {labelTone.text}
                          </span>
                        </div>
                        <div className="text-xs mb-2 flex items-center gap-1.5 flex-wrap" style={{ color: T.muted }}>
                          <span>{r.uniqueAnswered}/{r.total} unique</span>
                          <span>·</span>
                          <span>{r.attempted} attempt{r.attempted === 1 ? '' : 's'}</span>
                          {r.accuracy != null && (
                            <>
                              <span>·</span>
                              <span style={{ color: accColor, fontWeight: 600 }}>{Math.round(r.accuracy * 100)}% acc</span>
                            </>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
                          <div className="h-1.5 rounded-full transition-all duration-500"
                               style={{ width: `${Math.round(r.coverage * 100)}%`,
                                        background: r.color }} />
                        </div>
                      </div>
                    </button>

                    {/* Right column: Start button + expand chevron, stacked. */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <button onClick={() => onDrill('topic', r.id)}
                              className="no-tap-highlight inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition"
                              style={{ background: r.color, color: '#FFF' }}>
                        <Shuffle size={11} />
                        Start
                      </button>
                      <button onClick={() => setExpandedTopic(isOpen ? null : r.id)}
                              className="no-tap-highlight p-1"
                              aria-label={isOpen ? 'Collapse' : 'Expand sub-topics'}>
                        <ChevronRight size={16}
                                      className="transition-transform"
                                      style={{
                                        color: T.muted,
                                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                                      }} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* SUB-TOPIC PANEL — only rendered when this topic is open. */}
                {isOpen && (
                  <div className="px-4 pb-4 anim-fadeup">
                    <div className="border-t pt-3" style={{ borderColor: T.borderSoft }}>
                      <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                        Sub-topics ({subRowsForExpanded.length})
                      </div>
                      {subRowsForExpanded.length === 0 ? (
                        <div className="text-xs py-2" style={{ color: T.muted }}>
                          No sub-topics in this topic.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {subRowsForExpanded.map(s => {
                            const subAccColor = s.accuracy == null
                              ? T.muted
                              : s.accuracy >= 0.75 ? T.success : s.accuracy >= 0.5 ? T.primary : T.error;
                            const subStatus = s.attempted === 0
                              ? 'Not touched'
                              : s.coverage < 0.2
                                ? 'Barely touched'
                                : s.coverage < 0.5
                                  ? 'Light'
                                  : s.coverage < 0.8
                                    ? 'Building'
                                    : 'Well covered';
                            return (
                              <div key={s.sub}
                                   className="flex items-center gap-3 p-2.5 rounded-lg"
                                   style={{ background: T.surfaceWarm }}>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate mb-0.5" style={{ color: T.ink }}>{s.sub}</div>
                                  <div className="text-[10px] flex items-center gap-1 flex-wrap" style={{ color: T.muted }}>
                                    <span>{s.uniqueAnswered}/{s.total}</span>
                                    <span>·</span>
                                    <span>{subStatus}</span>
                                    {s.accuracy != null && (
                                      <>
                                        <span>·</span>
                                        <span style={{ color: subAccColor, fontWeight: 600 }}>{Math.round(s.accuracy * 100)}%</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="h-1 rounded-full overflow-hidden mt-1.5"
                                       style={{ background: T.border }}>
                                    <div className="h-1 rounded-full transition-all duration-500"
                                         style={{ width: `${Math.round(s.coverage * 100)}%`, background: r.color }} />
                                  </div>
                                </div>
                                <button onClick={() => onDrill('sub', r.id, s.sub)}
                                        className="no-tap-highlight inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 flex-shrink-0"
                                        style={{ background: r.color, color: '#FFF' }}>
                                  <Shuffle size={11} />
                                  Start
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CoverageMap;
