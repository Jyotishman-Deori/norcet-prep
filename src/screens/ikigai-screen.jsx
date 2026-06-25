// =====================================================================
// src/screens/ikigai-screen.jsx — PHIL-01 Clinical Ikigai Compass dashboard.
// A living readiness diagram, not a scoreboard. Four behavioural dimensions
// drift together as you practise; balance them all to reach "Ikigai Master".
// An Alignment nudge points you at your weakest circle with a real action.
// =====================================================================
import React, { useMemo } from 'react';
import { Sparkles, ArrowRight, Compass } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import IkigaiCompass from '../ui/ikigai-compass.jsx';
import { computeIkigai, IKIGAI_DIMENSIONS } from '../lib/ikigai.js';

// Per-dimension one-liner for the Alignment nudge (what to actually do).
const ALIGN_COPY = {
  passion:    'Show up today — a short session keeps your streak and widens your reach.',
  profession: 'Sharpen accuracy — a focused Quick Test will lift this fastest.',
  mission:    'Drill the must-knows — foundational survival questions are what NORCET rewards.',
  vocation:   'Train your pace — turn on The Pulse and practise answering under the clock.',
};

function Dim({ d, score, sub, T }) {
  const pct = Math.round(score * 100);
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: T.ink }}>{d.short}</div>
          <div className="text-[11px]" style={{ color: T.muted }}>{d.label}</div>
        </div>
        <div className="font-display text-lg font-semibold tabular-nums" style={{ color: d.color }}>{pct}%</div>
      </div>
      <div className="h-1.5 rounded-full mb-1.5" style={{ background: T.borderSoft }}>
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: d.color }} />
      </div>
      <div className="text-[11px] leading-snug" style={{ color: T.muted }}>{sub || d.hint}</div>
    </Card>
  );
}

function IkigaiScreen({ onBack, onStartQuick }) {
  const { theme: T, isDark } = useTheme();
  const { data, allQuestions } = useData();
  const ik = useMemo(() => computeIkigai(data, allQuestions), [data, allQuestions]);
  const { scores, overall, master, weakest, detail, hasData } = ik;

  const overallPct = Math.round(overall * 100);
  const verdict = master ? 'Ikigai Master — every circle aligned.'
    : overallPct >= 70 ? 'Beautifully balanced — keep it converging.'
    : overallPct >= 40 ? 'Taking shape — close the gaps below.'
    : hasData ? 'Early days — each session pulls the circles closer.'
    : 'Begin practising to bring your Ikigai to life.';

  const subFor = (key) => {
    if (key === 'passion') return `${detail.streak}-day streak · ${detail.breadthPct}% of subjects touched`;
    if (key === 'profession') return detail.attempted > 0 ? `${detail.accuracy}% accuracy over ${detail.attempted} answers` : 'Answer questions to build this';
    if (key === 'mission') return detail.foundAtt > 0 ? `${detail.foundAcc}% on ${detail.foundAtt} must-know questions` : 'Meet foundational questions to build this';
    if (key === 'vocation') return detail.avgSec ? `~${detail.avgSec}s per question vs ${54}s exam pace` : 'Timed practice builds this';
    return null;
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Ikigai Compass" onBack={onBack} feedback={{ screen: 'Ikigai Compass' }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="text-[12px] leading-relaxed mb-2 px-1 text-center" style={{ color: T.muted }}>
          <span style={{ color: T.ink, fontWeight: 600 }}>Ikigai</span> — your reason for being. Four sides of readiness,
          drifting together as you practise.
        </div>

        {/* the living compass */}
        <div className="relative my-2">
          <IkigaiCompass scores={scores} master={master} isDark={isDark} size={262} />
        </div>

        {/* overall readiness */}
        <div className="text-center mb-5">
          <div className="font-display text-3xl font-semibold tabular-nums"
               style={{ color: master ? '#F59E0B' : T.ink }}>{overallPct}%</div>
          <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: T.muted }}>Overall alignment</div>
          <div className="text-[13px] leading-relaxed max-w-xs mx-auto" style={{ color: T.inkSoft }}>{verdict}</div>
        </div>

        {/* Alignment nudge — point at the weakest circle with a real action */}
        {weakest && !master && (
          <Card className="p-4 mb-5" style={{ background: `linear-gradient(180deg, ${weakest.color}12, transparent)`, border: `1px solid ${weakest.color}40` }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={15} style={{ color: weakest.color }} />
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold" style={{ color: weakest.color }}>Alignment quest</div>
            </div>
            <div className="text-[13px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>
              Your <b style={{ color: T.ink }}>{weakest.short}</b> circle is furthest out. {ALIGN_COPY[weakest.key]}
            </div>
            {onStartQuick && (
              <Button onClick={onStartQuick} size="md" className="w-full" icon={<ArrowRight size={15} />}>
                Pull it back to centre
              </Button>
            )}
          </Card>
        )}

        {/* the four dimensions */}
        <div className="space-y-2.5">
          {IKIGAI_DIMENSIONS.map((d) => (
            <Dim key={d.key} d={d} score={scores[d.key]} sub={subFor(d.key)} T={T} />
          ))}
        </div>

        {!hasData && (
          <div className="text-center mt-6">
            <Button onClick={onStartQuick} size="lg" className="w-full" icon={<Compass size={16} />}>
              Start your first session
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default IkigaiScreen;
