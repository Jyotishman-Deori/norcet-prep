// =====================================================================
// TOPIC SELECT SCREEN  (extracted verbatim from App.jsx)
// Lets the user pick a topic (with PYQ-only toggle) to start a 10-question
// topic quiz. [A7] theme via useTheme(); question pool + history via
// useData() (history === data.history, was a prop). onPick/onBack stay props.
// =====================================================================
import React, { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { attemptStats } from '../lib/compact.js';
import { TOPICS } from '../data/seed.js';
import { Card, TopBar } from '../ui/primitives.jsx';

const COUNT_OPTIONS = [5, 10, 15, 20];

function TopicSelect({ onPick, onBack }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const history = data.history;
  const [count, setCount] = useState(10);
  const countsByTopic = useMemo(() => {
    const c = {};
    allQuestions.forEach(q => { c[q.topic] = (c[q.topic] || 0) + 1; });
    return c;
  }, [allQuestions]);

  const accuracyByTopic = useMemo(() => {
    const a = {};
    Object.entries(history).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      // P15 — accurate totals across Tier 2 and Tier 3 records.
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!a[q.topic]) a[q.topic] = { c: 0, t: 0 };
      a[q.topic].t += s.total;
      a[q.topic].c += s.correct;
    });
    return a;
  }, [history, allQuestions]);

  return (
    <div className="anim-fadeup">
      <TopBar title="Pick a topic" onBack={onBack} feedback={{ screen: "Topic select" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many questions?</div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {COUNT_OPTIONS.map(c => (
            <button key={c} onClick={() => setCount(c)}
                    className="no-tap-highlight py-2.5 rounded-xl text-base font-semibold transition-all"
                    style={{ background: count === c ? T.primary : T.surface,
                             color: count === c ? '#FFF' : T.ink,
                             border: `1.5px solid ${count === c ? T.primary : T.border}` }}>
              {c}
            </button>
          ))}
        </div>
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Choose a subject</div>
        <div className="space-y-2.5">
          {TOPICS.filter(t => countsByTopic[t.id] > 0).map(topic => {
            const acc = accuracyByTopic[topic.id];
            const accPct = acc && acc.t > 0 ? Math.round((acc.c / acc.t) * 100) : null;
            return (
              <Card key={topic.id} className="p-4" onClick={() => onPick(topic.id, count)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                         style={{ background: topic.color + '15' }}>
                      {topic.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base font-semibold truncate" style={{ color: T.ink }}>
                        {topic.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                        {countsByTopic[topic.id]} question{countsByTopic[topic.id] === 1 ? '' : 's'}
                        {accPct !== null && ` · ${accPct}% accuracy`}
                      </div>
                    </div>
                  </div>
                  {/* Premium per-row Start button — removes any doubt about how
                      to begin a test. Colour matches the subject; the whole card
                      stays tappable too (stopPropagation avoids a double-fire). */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onPick(topic.id, count); }}
                    aria-label={`Start ${topic.name} test`}
                    className="no-tap-highlight flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-xl text-sm font-semibold flex-shrink-0 active:scale-95 transition"
                    style={{ background: topic.color, color: '#FFF', boxShadow: `0 4px 12px ${topic.color}55` }}>
                    <Play size={14} fill="#FFF" strokeWidth={0} />
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

export default TopicSelect;
