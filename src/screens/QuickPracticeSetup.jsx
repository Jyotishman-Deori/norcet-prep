// =====================================================================
// QUICK PRACTICE SETUP SCREEN  (extracted verbatim from App.jsx)
// Chooses count + topic for a quick practice round; persisted prefs come
// from data.preferences. [A7] theme via useTheme(); app data + question
// pool via useData(). onStart/onBack stay props.
// =====================================================================
import React, { useState, useMemo } from 'react';
import { Shuffle } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { TOPICS } from '../data/seed.js';
import { Card, Button, TopBar } from '../ui/primitives.jsx';

function QuickPracticeSetup({ onStart, onBack }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const prefs = data.preferences || { quickCount: 5, quickTopic: 'all' };
  const [count, setCount] = useState(prefs.quickCount);
  const [topic, setTopic] = useState(prefs.quickTopic);

  const topicsWithCounts = useMemo(() => {
    const map = {};
    allQuestions.forEach(q => { map[q.topic] = (map[q.topic] || 0) + 1; });
    return TOPICS.map(t => ({ ...t, count: map[t.id] || 0 })).filter(t => t.count > 0);
  }, [allQuestions]);

  const availablePool = topic === 'all'
    ? allQuestions.length
    : (topicsWithCounts.find(t => t.id === topic)?.count || 0);

  const canStart = availablePool >= count;

  return (
    <div className="anim-fadeup">
      <TopBar title="Quick test" onBack={onBack} feedback={{ screen: "Quick practice setup" }} favId="quick-setup" />
      <div className="max-w-md mx-auto px-4 pt-2 pb-32">
        <Card className="p-4 mb-5" style={{ background: T.sec.quick, border: 'none' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Shuffle size={18} color="#FFF" />
            </div>
            <div style={{ color: '#FFF' }}>
              <div className="font-display text-lg font-semibold">Fast practice with hints</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Instant feedback after each answer</div>
            </div>
          </div>
        </Card>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many?</div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[5, 10, 15, 20].map(c => (
            <button key={c} onClick={() => setCount(c)}
                    className="no-tap-highlight py-3 rounded-xl text-base font-semibold transition-all"
                    style={{ background: count === c ? T.primary : T.surface,
                             color: count === c ? '#FFF' : T.ink,
                             border: `1.5px solid ${count === c ? T.primary : T.border}` }}>
              {c}
            </button>
          ))}
        </div>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Topic</div>
        <div className="space-y-2 mb-5">
          <button onClick={() => setTopic('all')}
                  className="no-tap-highlight w-full p-3 rounded-xl text-left transition-all"
                  style={{ background: topic === 'all' ? T.primary + '18' : T.surface,
                           color: T.ink,
                           border: `1.5px solid ${topic === 'all' ? T.primary : T.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                   style={{ background: topic === 'all' ? T.primary + '25' : T.surfaceWarm }}>
                🎲
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: T.ink }}>All topics mixed</div>
                <div className="text-xs" style={{ color: T.muted }}>{allQuestions.length} questions in pool</div>
              </div>
            </div>
          </button>
          {topicsWithCounts.map(t => {
            const active = topic === t.id;
            return (
              <button key={t.id} onClick={() => setTopic(t.id)}
                      className="no-tap-highlight w-full p-3 rounded-xl text-left transition-all"
                      style={{ background: active ? t.color + '18' : T.surface,
                               border: `1.5px solid ${active ? t.color : T.border}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                       style={{ background: active ? t.color + '25' : T.surfaceWarm }}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: T.ink }}>{t.name}</div>
                    <div className="text-xs" style={{ color: T.muted }}>{t.count} question{t.count === 1 ? '' : 's'}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!canStart && (
          <Card className="p-3 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <div className="text-xs" style={{ color: T.error }}>
              Only {availablePool} question{availablePool === 1 ? '' : 's'} available in this topic — reduce the count or pick another topic.
            </div>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          <Button onClick={() => onStart({ count, topic })} disabled={!canStart} size="lg" className="w-full" icon={<Shuffle size={16} />}>
            Start {count} question{count === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default QuickPracticeSetup;
