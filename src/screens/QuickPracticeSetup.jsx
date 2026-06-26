// =====================================================================
// QUICK PRACTICE SETUP SCREEN
// #20 — Quick Test is now a "black box": the user picks ONLY a question
// count; the questions are a TOPIC-BALANCED random mix that mirrors the real
// exam's weightage (selectBalancedQuestions in App.startQuickPractice). The
// old topic-selection list was removed — Topic Wise Test is the place to drill
// a single subject. [A7] theme via useTheme(); pool via useData().
// =====================================================================
import React, { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import { normalizePace } from '../lib/pace.js';

const COUNT_OPTIONS = [3, 5, 10, 15, 20];

function QuickPracticeSetup({ onStart, onBack, onSetPace }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const prefs = data.preferences || { quickCount: 5 };
  const initial = COUNT_OPTIONS.includes(prefs.quickCount) ? prefs.quickCount : 5;
  const [count, setCount] = useState(initial);
  const pace = normalizePace(prefs);

  const poolSize = allQuestions.length;
  const canStart = poolSize >= count;

  return (
    <div className="anim-fadeup">
      {/* BUG-02 — solid bar (no backdrop-filter) so launching this screen from
          the colourful Favourites honeycomb can't flash a re-sampled backdrop. */}
      <TopBar title="Quick test" onBack={onBack} feedback={{ screen: "Quick practice setup" }} solid />
      <PageContainer size="content" className="pt-2 pb-32">
        <Card className="p-4 mb-5" style={{ background: T.sec.quick, border: 'none' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Shuffle size={18} color="#FFF" />
            </div>
            <div style={{ color: '#FFF' }}>
              <div className="font-display text-lg font-semibold">A balanced random mix</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Weighted like the real exam · instant feedback</div>
            </div>
          </div>
        </Card>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many questions?</div>
        <div className="grid grid-cols-5 gap-2 mb-5">
          {COUNT_OPTIONS.map(c => (
            <button key={c} onClick={() => setCount(c)}
                    className="no-tap-highlight py-3 rounded-xl text-base font-semibold transition-all"
                    style={{ background: count === c ? T.primary : T.surface,
                             color: count === c ? '#FFF' : T.ink,
                             border: `1.5px solid ${count === c ? T.primary : T.border}` }}>
              {c}
            </button>
          ))}
        </div>

        {/* The selection is deliberately a black box — no topic picker. We
            sample across the whole syllabus in proportion to each topic's
            exam weightage, preferring fresh (unseen) questions you haven't
            been served before. */}
        <Card className="p-3.5 mb-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
          <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
            Questions are drawn at random across every subject, weighted the way
            the real exam is — and you won't be served the same question twice
            until you've worked through the whole bank.
          </div>
        </Card>

        <PaceSelector value={pace} onChange={onSetPace} T={T} />

        {!canStart && (
          <Card className="p-3 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <div className="text-xs" style={{ color: T.error }}>
              Only {poolSize} question{poolSize === 1 ? '' : 's'} in your bank — reduce the count.
            </div>
          </Card>
        )}
      </PageContainer>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto lg:px-8">
          <Button onClick={() => onStart({ count })} disabled={!canStart} size="lg" className="w-full" icon={<Shuffle size={16} />}>
            Start {count} question{count === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default QuickPracticeSetup;
