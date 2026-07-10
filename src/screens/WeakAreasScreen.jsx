// =====================================================================
// WEAK AREAS SCREEN  (extracted verbatim from App.jsx)
// Ranks attempted topics by accuracy so the user can drill weak spots;
// each row can launch a focused 5-question quiz. [A7] theme via useTheme();
// app data + question pool via useData(). onBack/onStartWeakQuiz stay props.
// =====================================================================
import React, { useMemo } from 'react';
import { AlertCircle, Check, Shuffle } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { attemptStats } from '../lib/compact.js';
import { TOPICS } from '../data/seed.js';
import { Card, TopBar } from '../ui/primitives.jsx';

function WeakAreasScreen({ onBack, onStartWeakQuiz }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const rows = useMemo(() => {
    // Re-derive from history rather than reusing getWeakTopics — we want all
    // topics she's attempted, not pre-filtered. We'll filter for display below.
    const byTopic = {};
    Object.entries(data.history || {}).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      // P15 — attemptStats normalizes Tier 2 / Tier 3 shapes.
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0, wrongIds: new Set() };
      byTopic[q.topic].total += s.total;
      byTopic[q.topic].correct += s.correct;
      // Track questions where the user has EVER gotten an answer wrong.
      // For compacted records we lose the per-attempt detail but
      // anyWrong is still accurate.
      if (s.anyWrong) byTopic[q.topic].wrongIds.add(qId);
    });

    return Object.entries(byTopic)
      .map(([topic, { correct, total, wrongIds }]) => {
        const t = TOPICS.find(x => x.id === topic);
        return {
          topic,
          name: t?.name || topic,
          color: t?.color || T.primary,
          icon: t?.icon || '📘',
          correct,
          total,
          accuracy: total > 0 ? correct / total : 0,
          wrongCount: wrongIds.size
        };
      })
      // Only show topics with enough data to mean something AND not strong.
      // 3+ attempts is the minimum signal; 80% is the "still has room to fix" cap.
      .filter(x => x.total >= 3 && x.accuracy < 0.8)
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [data.history, allQuestions]);

  // Empty states — two flavours so the message is honest about which case
  // the user is in. "Nothing practised yet" vs "Nothing weak, keep going".
  const totalAttempted = data.stats.totalAttempted || 0;

  if (totalAttempted === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Weak areas" onBack={onBack} feedback={{ screen: "Weak areas" }} />
        <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-12 pb-24 text-center">
          <AlertCircle size={48} className="mx-auto mb-4" style={{ color: T.muted, opacity: 0.4 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>Nothing to fix yet</div>
          <div className="text-sm mb-6" style={{ color: T.muted }}>
            Practise a few questions first. As you take quizzes, the topics you struggle with will land here so you can drill them directly.
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Weak areas" onBack={onBack} feedback={{ screen: "Weak areas" }} />
        <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-12 pb-24 text-center">
          <Check size={48} className="mx-auto mb-4" style={{ color: T.success, opacity: 0.6 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>No weak areas right now</div>
          <div className="text-sm" style={{ color: T.muted }}>
            Every topic you've attempted is at 80% accuracy or better. Keep going: broaden your coverage or revise to lock it in.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fadeup">
      <TopBar title="Weak areas" onBack={onBack} feedback={{ screen: "Weak areas" }} />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-2 pb-24">
        <div className="text-xs mb-4 leading-relaxed px-1" style={{ color: T.muted }}>
          Topics where your accuracy is below 80%, worst first. Tap Start on any row to drill 5 questions. Questions you've previously got wrong are prioritised.
        </div>

        <div className="space-y-2.5">
          {rows.map(r => {
            const pct = Math.round(r.accuracy * 100);
            // Three accuracy tiers — visual cue for severity.
            const tier =
              r.accuracy < 0.4 ? { color: T.error,   bg: T.errorSoft,        label: 'Critical' } :
              r.accuracy < 0.6 ? { color: T.error,   bg: T.error + '12',     label: 'Weak'     } :
                                 { color: T.accent,  bg: T.accent + '12',    label: 'Shaky'    };

            return (
              <Card key={r.topic} className="p-3"
                    style={{ background: tier.bg, border: `1px solid ${tier.color}30` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                       style={{ background: r.color + '20' }}>
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-display text-sm font-semibold truncate" style={{ color: T.ink }}>
                        {r.name}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0"
                            style={{ background: tier.color, color: '#FFF' }}>
                        {tier.label}
                      </span>
                    </div>
                    <div className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: T.muted }}>
                      <span style={{ color: tier.color, fontWeight: 700 }}>{pct}% accuracy</span>
                      <span>·</span>
                      <span>{r.correct}/{r.total} correct</span>
                      {r.wrongCount > 0 && (
                        <>
                          <span>·</span>
                          <span>{r.wrongCount} to revisit</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button onClick={() => onStartWeakQuiz(r.topic)}
                          className="no-tap-highlight inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 flex-shrink-0"
                          style={{ background: tier.color, color: '#FFF' }}>
                    <Shuffle size={11} />
                    Start
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WeakAreasScreen;
