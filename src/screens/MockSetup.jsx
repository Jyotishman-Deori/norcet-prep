// =====================================================================
// MOCK TEST SETUP SCREEN  (extracted verbatim from App.jsx)
// Configures a timed mock exam (question count + duration) before starting.
// [A7] theme via useTheme(). onStart/onBack/totalQuestions stay props
// (totalQuestions is allQuestions.length, passed by App).
// =====================================================================
import React, { useState, useMemo } from 'react';
import { Timer } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import { normalizePace } from '../lib/pace.js';

function MockSetup({ onStart, onBack, totalQuestions, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const [count, setCount] = useState(Math.min(20, totalQuestions));
  const pace = normalizePace(data && data.preferences);
  const presets = [10, 25, 50, 100].filter(p => p <= totalQuestions);
  if (presets.length === 0) presets.push(totalQuestions);

  // Duration picker. NORCET pacing is roughly 1 min/question, so we default to
  // that. Presets cover sprint / normal / relaxed pace and re-anchor whenever
  // the question count changes. `customMinutes` lets the user override if
  // they want a non-standard time.
  const defaultDuration = count;                       // 1 min/question
  const [customMinutes, setCustomMinutes] = useState(null);
  const durationMinutes = customMinutes ?? defaultDuration;
  const pacePerQ = count > 0 ? Math.round((durationMinutes * 60) / count) : 0;

  // Build pace presets relative to the question count so they always make sense.
  const durationPresets = useMemo(() => {
    if (count <= 0) return [];
    const tight   = Math.max(1, Math.round(count * 0.5));   // 30s/q
    const normal  = count;                                   // 60s/q (NORCET)
    const relaxed = Math.round(count * 1.5);                 // 90s/q (real NORCET pace)
    return [
      { mins: tight,   label: 'Sprint',  pace: '30s/Q' },
      { mins: normal,  label: 'Normal',  pace: '1 min/Q' },
      { mins: relaxed, label: 'Relaxed', pace: '90s/Q' }
    ];
  }, [count]);

  return (
    <div className="anim-fadeup">
      {/* BUG-02 — solid bar (no backdrop-filter) so launching from the colourful
          Favourites honeycomb can't flash a re-sampled backdrop on entry. */}
      <TopBar title="Mock test setup" onBack={onBack} feedback={{ screen: "Mock setup" }} solid />
      <PageContainer size="content" className="pt-4 pb-24">
        <div className="text-sm mb-6" style={{ color: T.muted }}>
          Timed practice across all topics. The timer counts down, if it hits zero, the test ends with whatever you've answered.
        </div>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many questions?</div>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {presets.map(p => (
            <button key={p} onClick={() => { setCount(p); setCustomMinutes(null); }}
                    className="no-tap-highlight py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: count === p ? T.primary : T.surface,
                             color: count === p ? '#FFF' : T.ink,
                             border: `1.5px solid ${count === p ? T.primary : T.border}` }}>
              {p}
            </button>
          ))}
        </div>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Time limit</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {durationPresets.map(p => {
            const active = customMinutes === null
              ? p.mins === defaultDuration
              : p.mins === customMinutes;
            return (
              <button key={p.label} onClick={() => setCustomMinutes(p.mins === defaultDuration ? null : p.mins)}
                      className="no-tap-highlight py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: active ? T.primary : T.surface,
                               color: active ? '#FFF' : T.ink,
                               border: `1.5px solid ${active ? T.primary : T.border}` }}>
                <div>{p.label}</div>
                <div className="text-[10px] mt-0.5 font-medium" style={{ opacity: active ? 0.85 : 0.6 }}>
                  {p.mins} min · {p.pace}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom minutes — free-form fallback. */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs" style={{ color: T.muted }}>Custom:</span>
          <input type="number" min={1} max={300}
                 value={customMinutes ?? ''}
                 onChange={e => {
                   const n = parseInt(e.target.value, 10);
                   setCustomMinutes(Number.isFinite(n) && n > 0 ? n : null);
                 }}
                 placeholder={String(defaultDuration)}
                 className="w-20 rounded-lg px-2.5 py-1.5 text-sm"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
          <span className="text-xs" style={{ color: T.muted }}>minutes</span>
        </div>

        <Card className="p-4 mb-6" style={{ background: T.surfaceWarm }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: T.muted }}>Test pace</div>
          <div className="font-display text-2xl font-semibold" style={{ color: T.ink }}>{durationMinutes} min</div>
          <div className="text-xs mt-1" style={{ color: T.muted }}>
            {count} question{count === 1 ? '' : 's'} · ~{pacePerQ}s per question
          </div>
        </Card>

        <PaceSelector value={pace} onChange={onSetPace} T={T} />

        <Button onClick={() => onStart(count, durationMinutes)} size="lg" className="w-full mt-3" icon={<Timer size={18} />}>
          Start mock test
        </Button>
      </PageContainer>
    </div>
  );
}

export default MockSetup;
