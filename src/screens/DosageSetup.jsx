// =====================================================================
// src/screens/DosageSetup.jsx — setup gate for the Dosage Calculation test.
// Mirrors QuickPracticeSetup: pick a question count + the Pace, then start —
// so the dosage drill no longer launches abruptly. Pool size comes from the
// lazily-loaded dosage bank (useContent('dosage')); count is capped to it.
// =====================================================================
import React, { useState } from 'react';
import { Calculator, Sigma, Play } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { useContent } from '../lib/content.js';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import { ContentGate } from '../ui/content-gate.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import { normalizePace } from '../lib/pace.js';

const COUNT_OPTIONS = [5, 10, 15, 20];

function DosageSetup({ onStart, onBack, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { data: dosageData, loading, error, reload } = useContent('dosage');
  const poolSize = Array.isArray(dosageData) ? dosageData.length : 0;
  const [count, setCount] = useState(10);
  const pace = normalizePace(data && data.preferences);

  const effectiveCount = Math.min(count, poolSize || count);
  const canStart = poolSize > 0 && effectiveCount > 0;

  return (
    <div className="anim-fadeup">
      <TopBar title="Dosage calculation" onBack={onBack} feedback={{ screen: 'Dosage setup' }} solid />
      <PageContainer size="content" className="pt-2 pb-32">
        {/* Hero — reads like a drug-math drill brief */}
        <Card className="p-4 mb-5" style={{ background: T.sec.stats, border: 'none' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Calculator size={18} color="#FFF" />
            </div>
            <div style={{ color: '#FFF' }}>
              <div className="font-display text-lg font-semibold">Numeric drug-math</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Type-in answers · step-by-step working after each</div>
            </div>
          </div>
        </Card>

        {!dosageData && (loading || error) ? (
          <ContentGate loading={loading} error={error} onRetry={reload} label="dosage questions" />
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many questions?</div>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {COUNT_OPTIONS.map(c => {
                const disabled = poolSize > 0 && c > poolSize;
                const on = count === c;
                return (
                  <button key={c} onClick={() => !disabled && setCount(c)} disabled={disabled}
                          className="no-tap-highlight py-3 rounded-xl text-base font-semibold transition-all disabled:opacity-35"
                          style={{ background: on ? T.primary : T.surface,
                                   color: on ? '#FFF' : T.ink,
                                   border: `1.5px solid ${on ? T.primary : T.border}` }}>
                    {c}
                  </button>
                );
              })}
            </div>

            <PaceSelector value={pace} onChange={onSetPace} T={T} />

            <Card className="p-3.5 mb-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
              <div className="flex items-start gap-2.5">
                <Sigma size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
                <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                  Each order is a real ward scenario, work it out, type your answer, and the full calculation is shown
                  the moment you check. Answers count as correct within the stated tolerance.
                </div>
              </div>
            </Card>

            {poolSize > 0 && (
              <div className="text-[11px] px-1" style={{ color: T.muted }}>
                {poolSize} dosage question{poolSize === 1 ? '' : 's'} available · you'll get {effectiveCount}.
              </div>
            )}
          </>
        )}
      </PageContainer>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md md:max-w-3xl mx-auto md:px-6 lg:px-8">
          <Button onClick={() => onStart({ count: effectiveCount })} disabled={!canStart} size="lg" className="w-full" icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
            Start {effectiveCount} question{effectiveCount === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DosageSetup;
