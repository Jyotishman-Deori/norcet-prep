// =====================================================================
// src/ui/what-if-card.jsx — NEW-07.1 Negative-marking "What-If" simulator.
// On the Advanced / PYQ results (the only modes with 1/3 negative marking),
// let the learner *feel* the cost of risky guessing: drag the slider to "skip"
// the answers they got wrong and watch the net score + qualifying band climb.
// Honest framing — it models YOUR actual wrong answers as the avoidable
// guesses ("if you'd had the discipline to leave these blank").
//
// Distinct from the existing CalibrationCard (confidence×accuracy) and
// WhereYouStandCard (percentile) — this is the restraint lesson, interactive.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Scale, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';

const NEG = 1 / 3;

function bandFor(pct) {
  if (pct >= 65) return { label: 'SAFE', color: '#16A34A' };
  if (pct >= 45) return { label: 'BORDERLINE', color: '#F59E0B' };
  return { label: 'RISKY', color: '#DC2626' };
}

export default function WhatIfCard({ correct = 0, wrong = 0, blank = 0, count = 0, netScore = 0, className = '' }) {
  const { theme: T } = useTheme();
  const [skip, setSkip] = useState(0);
  // Reset when a different result mounts.
  useEffect(() => { setSkip(0); }, [correct, wrong, count]);

  if (count <= 0) return null;

  // Disciplined run — nothing to simulate, celebrate the restraint.
  if (wrong <= 0) {
    return (
      <Card className={'p-4 ' + className} style={{ border: `1px solid #16A34A40`, background: 'linear-gradient(180deg, #16A34A10, transparent)' }}>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={17} style={{ color: '#16A34A' }} />
          <div className="font-display text-sm font-semibold" style={{ color: '#16A34A' }}>No marks lost to negatives</div>
        </div>
        <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
          You didn't give a single wrong answer. Zero negative penalty. That discipline is exactly what protects rank in NORCET.
        </div>
      </Card>
    );
  }

  const adjustedNet = netScore + skip * NEG;          // each skipped wrong removes a −1/3
  const penaltyLeft = (wrong - skip) * NEG;           // marks still bled to negatives
  const marksSaved = skip * NEG;
  const pct = Math.max(0, Math.min(100, (adjustedNet / count) * 100));
  const band = bandFor(pct);

  const fmt = (n) => n.toFixed(2);

  return (
    <Card className={'p-4 ' + className} style={{ border: `1px solid ${band.color}40`, background: `linear-gradient(180deg, ${band.color}0E, transparent)` }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: band.color + '1A', border: `1px solid ${band.color}40` }}>
            <Scale size={16} style={{ color: band.color }} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] font-bold" style={{ color: band.color }}>What-if · negative marking</div>
            <div className="text-[11px]" style={{ color: T.muted }}>Restraint changes everything</div>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 tracking-wide"
              style={{ background: band.color, color: '#FFF' }}>{band.label}</span>
      </div>

      {/* live readout */}
      <div className="flex items-end gap-4 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: T.muted }}>Net score</div>
          <div className="font-display text-3xl font-semibold tabular-nums leading-none" style={{ color: band.color }}>
            {fmt(adjustedNet)}
            <span className="text-sm font-medium" style={{ color: T.muted }}> / {count}</span>
          </div>
        </div>
        {skip > 0 && (
          <div className="flex items-center gap-1 text-[12px] font-semibold pb-1" style={{ color: '#16A34A' }}>
            <TrendingUp size={13} /> +{fmt(marksSaved)}
          </div>
        )}
      </div>

      {/* the slider — skip your riskiest guesses */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[12px] mb-1.5">
          <span style={{ color: T.inkSoft }}>Skip your riskiest guesses</span>
          <span className="font-semibold tabular-nums" style={{ color: T.ink }}>{skip} of {wrong}</span>
        </div>
        <input type="range" min={0} max={wrong} step={1} value={skip}
               onChange={(e) => setSkip(Number(e.target.value))}
               className="w-full"
               style={{ accentColor: band.color }} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl px-3 py-2" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
          <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Marks saved</div>
          <div className="font-display text-base font-semibold tabular-nums" style={{ color: '#16A34A' }}>+{fmt(marksSaved)}</div>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
          <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Still lost to penalty</div>
          <div className="font-display text-base font-semibold tabular-nums" style={{ color: penaltyLeft > 0 ? T.error : T.muted }}>−{fmt(penaltyLeft)}</div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: '#B8791A12', border: '1px solid #B8791A33' }}>
        <Sparkles size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#B8791A' }} />
        <div className="text-[11.5px] leading-relaxed" style={{ color: T.inkSoft }}>
          <b style={{ color: T.ink }}>Topper insight:</b> every mark lost to a blind guess can cost <b>350+ rank spots</b> in the general pool.
          When you can't eliminate to two, leaving it blank often beats guessing.
        </div>
      </div>
    </Card>
  );
}
