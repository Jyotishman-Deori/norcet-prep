// =====================================================================
// WHERE YOU STAND  —  premium Stats hero card
// =====================================================================
// Places the user's recent full-length marks-% on the OFFICIAL AIIMS Mains
// qualifying ladder. The signature element is a self-locating scale: every
// category line is drawn at once and the user reads their own — we never ask,
// store, or infer category. Honest by construction: the number is a practice
// marks-% (negative marking applied), explicitly not a predicted rank.
//
// The ladder collapses the qualifying lines to their DISTINCT thresholds
// (50/45/40/35) so shared floors don't overlap; categories sharing a floor are
// grouped in the legend. A collapsible section surfaces the prelims percentile
// cut-offs as reference (a different unit — never compared to the user's %).
//
// Data in: data.advancedTestHistory (via useData upstream → `history`).
// Math lives in lib/projection.js; official numbers in data/norcet-benchmarks.js.
// =====================================================================
import React, { useMemo, useState, useEffect } from 'react';
import { Target, ArrowUpRight, Trophy, ChevronDown } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';
import { recentFullLength, qualifyingThresholds, thresholdStatus } from '../lib/projection.js';
import { MAINS_QUALIFYING, PRELIMS_PERCENTILE_TREND, HAS_PRELIMS_DATA } from '../data/norcet-benchmarks.js';

// Display window for the scale: zoom into the band where the action is so the
// 35 / 40 / 45 / 50 lines are legible instead of crushed against the left.
const LO = 30;
const HI = 70;

function prefersReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
}

export default function WhereYouStandCard({ history, onStartAdvanced }) {
  const { theme: T } = useTheme();
  const proj = useMemo(() => recentFullLength(history), [history]);
  const groups = useMemo(() => qualifyingThresholds(MAINS_QUALIFYING), []);
  const accent = (T.sec && T.sec.stats) || T.primary; // dusty blue — the Stats voice

  // Subtle fill grow-in on mount (respects reduced motion).
  const [grown, setGrown] = useState(prefersReducedMotion());
  useEffect(() => {
    if (grown) return;
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, [grown]);

  // ---- Empty state: an invitation, not an error. ----
  if (!proj || proj.n === 0) {
    return (
      <Card className="p-4 mb-5" style={{ background: accent + '0E', border: `1px solid ${accent}33` }}>
        <Eyebrow accent={accent} />
        <div className="mt-2 text-[15px] font-semibold" style={{ color: T.ink }}>
          See where you stand against the real cut-offs
        </div>
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
          Finish one timed Advanced Test and we’ll place your score on the official AIIMS Mains
          qualifying ladder — so you know exactly how far you are from clearing the bar.
        </p>
        {onStartAdvanced && (
          <button
            onClick={onStartAdvanced}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-3.5 py-2"
            style={{ background: accent, color: '#fff' }}
          >
            Start an Advanced Test <ArrowUpRight size={15} />
          </button>
        )}
      </Card>
    );
  }

  const status = thresholdStatus(proj.pct, groups);
  const hasBand = proj.usedN > 1 && proj.high > proj.low;

  return (
    <Card className="p-4 mb-5" style={{ background: accent + '0E', border: `1px solid ${accent}33` }}>
      <Eyebrow accent={accent} />

      {/* Headline number — the user's recent marks % */}
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-semibold leading-none" style={{ fontSize: '2.6rem', color: T.ink }}>
              {Math.round(proj.pct)}<span style={{ fontSize: '1.3rem', color: T.muted }}>%</span>
            </span>
          </div>
          <div className="mt-1 text-[12px]" style={{ color: T.muted }}>
            recent full-length marks{hasBand ? ` · ${Math.round(proj.low)}–${Math.round(proj.high)}% over last ${proj.usedN}` : ''}
          </div>
        </div>
        {proj.n >= 2 && (
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: T.success }}>
              <Trophy size={12} /> best {Math.round(proj.best)}%
            </div>
          </div>
        )}
      </div>

      {/* The self-locating ladder (distinct thresholds) */}
      <Ladder T={T} accent={accent} pct={proj.pct} low={proj.low} high={proj.high} hasBand={hasBand} grown={grown} groups={groups} />

      {/* Legend: each distinct threshold + the categories that share it */}
      <div className="mt-2.5 space-y-1">
        {groups.map((g) => {
          const cleared = proj.pct >= g.pct;
          return (
            <div key={g.pct} className="flex items-center gap-2 text-[11px]">
              <span className="inline-block rounded-full shrink-0"
                    style={{ width: 7, height: 7, background: cleared ? T.success : 'transparent', border: cleared ? 'none' : `1.5px solid ${T.muted}` }} />
              <span style={{ fontWeight: 600, color: cleared ? T.ink : T.muted, width: 30 }}>{g.pct}%</span>
              <span style={{ color: cleared ? T.inkSoft : T.muted }}>{g.cats.join(' · ')}</span>
            </div>
          );
        })}
      </div>

      {/* Honest, motivating readout */}
      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
        <Readout T={T} status={status} />
      </p>

      {/* Footnote — keep the claim honest */}
      <p className="mt-2 text-[10.5px] leading-snug" style={{ color: T.muted }}>
        From your timed Advanced Tests, negative marking applied. Lines are official AIIMS Mains
        qualifying minimums (PwBD lines included) — your category is yours to read off; this isn’t a
        predicted rank.
      </p>

      {/* Prelims percentile cut-offs — reference only, progressive disclosure */}
      {HAS_PRELIMS_DATA && <PrelimsSection T={T} />}
    </Card>
  );
}

function Eyebrow({ accent }) {
  return (
    <div className="flex items-center gap-1.5">
      <Target size={13} style={{ color: accent }} />
      <span className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: accent }}>
        Where you stand
      </span>
    </div>
  );
}

function Readout({ T, status }) {
  if (status.clearsAll) {
    return <>You’re above <b style={{ color: T.success }}>every qualifying line</b>, UR/EWS included. Now it’s about widening the margin.</>;
  }
  if (status.clearsNone) {
    const n = status.nextUp;
    return <>You’re just under the bar. Nearest is <b style={{ color: T.ink }}>{n?.pct}%</b> — <b>{status.gapToNext}%</b> to go.</>;
  }
  const hc = status.highestCleared;
  const nu = status.nextUp;
  const std = nu ? (nu.cats.find((c) => !/pwbd/i.test(c)) || nu.cats[0]) : null;
  return (
    <>
      You’re clearing the <b style={{ color: T.success }}>{hc.pct}% line</b>. <b>{status.gapToNext}%</b> short of <b style={{ color: T.ink }}>{nu.pct}%</b>{std ? <> ({std})</> : null}.
    </>
  );
}

// --- The scale ------------------------------------------------------------
function Ladder({ T, accent, pct, low, high, hasBand, grown, groups }) {
  const W = 320, x0 = 14, x1 = 306, inner = x1 - x0;
  const trackY = 64, trackH = 18, r = trackH / 2;
  const xOf = (p) => x0 + Math.max(0, Math.min(1, (p - LO) / (HI - LO))) * inner;

  const xPct = xOf(pct);
  const fillW = grown ? xPct - x0 : 0;

  return (
    <svg viewBox={`0 0 ${W} 112`} width="100%" role="img"
         aria-label={`Your marks are about ${Math.round(pct)} percent, shown against the qualifying lines.`}
         style={{ display: 'block', marginTop: 10, overflow: 'visible' }}>
      {/* track */}
      <rect x={x0} y={trackY} width={inner} height={trackH} rx={r} fill={T.surfaceWarm} stroke={T.border} strokeWidth="1" />

      {/* spread band (low–high) behind the fill */}
      {hasBand && (
        <rect x={xOf(low)} y={trackY - 4} width={Math.max(2, xOf(high) - xOf(low))} height={trackH + 8} rx="6"
              fill={accent} opacity="0.16" />
      )}

      {/* fill up to the score */}
      <rect x={x0} y={trackY} width={fillW} height={trackH} rx={r} fill={accent}
            style={{ transition: 'width 0.75s cubic-bezier(0.22,1,0.36,1)' }} />

      {/* one dashed line per DISTINCT threshold (no overlaps) */}
      {groups.map((g) => {
        const x = xOf(g.pct);
        return (
          <g key={g.pct}>
            <line x1={x} y1={trackY - 9} x2={x} y2={trackY + trackH + 9}
                  stroke={T.ink} strokeWidth="1" strokeDasharray="3 2.5" opacity="0.45" />
            <text x={x} y={trackY - 13} textAnchor="middle" fontSize="10" fontWeight="600" fill={T.muted}>{g.pct}</text>
          </g>
        );
      })}

      {/* "You" pill + stem */}
      <line x1={xPct} y1={36} x2={xPct} y2={trackY - 1} stroke={accent} strokeWidth="1.5" opacity="0.5" />
      <g transform={`translate(${xPct}, 24)`}>
        <rect x="-26" y="-13" width="52" height="22" rx="11" fill={accent} />
        <text x="0" y="2" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">You {Math.round(pct)}%</text>
      </g>

      {/* axis ends */}
      <text x={x0} y={trackY + trackH + 22} textAnchor="start" fontSize="9.5" fill={T.muted}>{LO}%</text>
      <text x={x1} y={trackY + trackH + 22} textAnchor="end" fontSize="9.5" fill={T.muted}>{HI}%</text>
    </svg>
  );
}

// --- Prelims percentile reference (collapsible) ---------------------------
const PRELIMS_CATS = [['UR', 'UR'], ['EWS', 'EWS'], ['OBC', 'OBC'], ['SC', 'SC'], ['ST', 'ST']];

function PrelimsRow({ cycle, T }) {
  return (
    <div className="mt-2">
      <div className="text-[11px] font-medium mb-1" style={{ color: T.inkSoft }}>{cycle.cycle}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {PRELIMS_CATS.map(([key, label]) => (cycle[key] != null) && (
          <span key={key} className="text-[11px]" style={{ color: T.muted }}>
            {label} <b style={{ color: T.ink }}>{cycle[key].toFixed(2)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function PrelimsSection({ T }) {
  const [open, setOpen] = useState(false);
  const accent = (T.sec && T.sec.stats) || T.primary;
  const latest = PRELIMS_PERCENTILE_TREND[0];
  const earlier = PRELIMS_PERCENTILE_TREND.slice(1);

  return (
    <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
      <button onClick={() => setOpen((o) => !o)} className="no-tap-highlight w-full flex items-center justify-between active:opacity-70">
        <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: accent }}>Prelims cut-offs · percentile</span>
        <ChevronDown size={14} style={{ color: T.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      <PrelimsRow cycle={latest} T={T} />
      {open && earlier.map((c) => <PrelimsRow key={c.cycle} cycle={c} T={T} />)}
      {!open && earlier.length > 0 && (
        <button onClick={() => setOpen(true)} className="no-tap-highlight mt-1.5 text-[11px] font-medium" style={{ color: accent }}>
          + {earlier.length} earlier {earlier.length === 1 ? 'cycle' : 'cycles'}
        </button>
      )}

      <p className="text-[10.5px] leading-snug mt-2" style={{ color: T.muted }}>
        Percentile (relative, cycle-specific) — not your marks %, shown for context only.
      </p>
    </div>
  );
}
