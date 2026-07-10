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

export default function WhereYouStandCard({ history, estimate, onStartAdvanced, onQuick }) {
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

  // Three phases, never an empty gate:
  //   real        — a timed Advanced Test result → exact marks-% marker.
  //   estimate    — no Advanced Test yet, but ≥10 practice attempts → an
  //                 ESTIMATED marker (accuracy with 1/3 negative marking), clearly
  //                 labelled. Low-barrier preview from Quick Tests.
  //   placeholder — brand-new → a pulsing "You appear here" on the real ladder.
  // The ladder, legend and Prelims percentiles are ALWAYS shown as reference.
  const hasData = !!(proj && proj.n > 0);
  const est = (!hasData && estimate && Number.isFinite(estimate.pct)) ? estimate : null;
  const mode = hasData ? 'real' : (est ? 'estimate' : 'placeholder');
  const markPct = hasData ? proj.pct : (est ? est.pct : null);
  const status = (markPct != null) ? thresholdStatus(markPct, groups) : null;
  const hasBand = hasData && proj.usedN > 1 && proj.high > proj.low;

  const primaryBtn = (label, onClick) => (
    <button onClick={onClick}
            className="no-tap-highlight w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-xl px-3.5 py-3 active:scale-[0.99] transition"
            style={{ background: accent, color: '#fff', boxShadow: `0 6px 16px ${accent}45` }}>
      {label} <ArrowUpRight size={15} />
    </button>
  );
  const quietBtn = (label, onClick) => (
    <button onClick={onClick}
            className="no-tap-highlight inline-flex items-center justify-center gap-1 text-[12px] font-semibold active:opacity-70"
            style={{ color: accent }}>
      {label} <ArrowUpRight size={13} />
    </button>
  );

  return (
    <Card className="p-4 mb-5" style={{ background: accent + '0E', border: `1px solid ${accent}33` }}>
      <Eyebrow accent={accent} />

      {mode === 'real' && (
        /* Headline number — the user's recent marks % */
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
      )}
      {mode === 'estimate' && (
        /* Estimated headline — clearly approximate, from everyday practice */
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-semibold leading-none" style={{ fontSize: '2.4rem', color: T.ink }}>
                ~{Math.round(est.pct)}<span style={{ fontSize: '1.2rem', color: T.muted }}>%</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: accent + '20', color: accent }}>est</span>
            </div>
            <div className="mt-1 text-[12px]" style={{ color: T.muted }}>estimated from your practice so far · {est.n} answered</div>
          </div>
        </div>
      )}
      {mode === 'placeholder' && (
        /* Reference headline — the bar everyone is aiming at */
        <div className="mt-2">
          <div className="text-[15px] font-semibold" style={{ color: T.ink }}>The official AIIMS qualifying bar</div>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
            The real NORCET Mains cut-offs and recent Prelims percentiles, the exact targets you’re studying toward. A short Quick Test gives a first estimate of where <b style={{ color: T.ink }}>you</b> land.
          </p>
        </div>
      )}

      {/* The self-locating ladder — reference scale always; marker per phase.
          Width-capped so the zoomed 30-70 window doesn't stretch on desktop. */}
      <div className="max-w-xl mx-auto">
        <Ladder T={T} accent={accent} mode={mode} pct={markPct}
                low={hasData ? proj.low : null} high={hasData ? proj.high : null}
                hasBand={hasBand} grown={grown} groups={groups} />
        {markPct != null && markPct < LO && (
          <div className="text-[10.5px] text-center mt-1" style={{ color: T.muted }}>
            The scale zooms into the 30 to 70% band. Your mark sits left of it for now.
          </div>
        )}
      </div>

      {/* Legend: each distinct threshold + the categories that share it */}
      <div className="mt-2.5 space-y-1">
        {groups.map((g) => {
          const cleared = markPct != null && markPct >= g.pct;
          return (
            <div key={g.pct} className="flex items-center gap-2 text-[11px]">
              <span className="inline-block rounded-full shrink-0"
                    style={{ width: 7, height: 7, background: cleared ? T.success : 'transparent', border: cleared ? 'none' : `1.5px solid ${T.muted}` }} />
              <span style={{ fontWeight: 600, color: cleared ? T.ink : (markPct != null ? T.muted : T.inkSoft), width: 30 }}>{g.pct}%</span>
              <span style={{ color: cleared ? T.inkSoft : T.muted }}>{g.cats.join(' · ')}</span>
            </div>
          );
        })}
      </div>

      {/* Readout — precise for real, clearly hedged for an estimate */}
      {mode === 'real' && (
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
          <Readout T={T} status={status} />
        </p>
      )}
      {mode === 'estimate' && status && (
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
          On current accuracy you’d be {status.clearsNone ? <>just under the <b style={{ color: T.ink }}>{(status.nextUp && status.nextUp.pct) || groups[0].pct}%</b> line</> : <>around the <b style={{ color: T.success }}>{status.highestCleared ? status.highestCleared.pct : ''}% line</b></>}. A timed Advanced Test confirms it for real.
        </p>
      )}

      {/* Footnote — keep the claim honest */}
      <p className="mt-2 text-[10.5px] leading-snug" style={{ color: T.muted }}>
        {mode === 'real'
          ? 'From your timed Advanced Tests, negative marking applied. Lines are official AIIMS Mains qualifying minimums (PwBD lines included). Your category is yours to read off; this isn’t a predicted rank.'
          : mode === 'estimate'
            ? 'Estimate = your overall accuracy with 1/3 negative marking applied. A rough preview, not real marks. Take a timed Advanced Test for the true figure. Lines are official AIIMS Mains minimums (PwBD included).'
            : 'Lines are official AIIMS Mains qualifying minimums (PwBD lines included). Your category is yours to read off. These are real cut-offs, not a predicted rank.'}
      </p>

      {/* Prelims percentile cut-offs — ALWAYS visible reference (both phases) */}
      {HAS_PRELIMS_DATA && <PrelimsSection T={T} />}

      {/* Phase-appropriate CTAs — never a dead end. */}
      <div className="mt-4 flex flex-col items-center gap-2.5">
        {mode === 'real' && (<>
          {onQuick && primaryBtn('Improve your score, practise now', onQuick)}
          {onStartAdvanced && quietBtn('Take another Advanced Test to refresh', onStartAdvanced)}
        </>)}
        {mode === 'estimate' && (<>
          {onStartAdvanced && primaryBtn('Get your exact score, take an Advanced Test', onStartAdvanced)}
          {onQuick && quietBtn('Keep practising to sharpen the estimate', onQuick)}
        </>)}
        {mode === 'placeholder' && (<>
          {onQuick && primaryBtn('Take a Quick Test to see your estimated position', onQuick)}
          {onStartAdvanced && quietBtn('or take a full Advanced Test for exact marks', onStartAdvanced)}
        </>)}
      </div>
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
    return <>You’re just under the bar. Nearest is <b style={{ color: T.ink }}>{n?.pct}%</b>: <b>{status.gapToNext}%</b> to go.</>;
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
// mode='real'        → solid "You X%" marker + fill (+ spread band).
// mode='estimate'    → a dashed, gently PULSING "~X% est" marker (no band) — an
//                      approximate position from everyday practice.
// mode='placeholder' → a dashed, pulsing "You appear here" centred on the track,
//                      so a brand-new user still sees a live, inviting ladder.
function Ladder({ T, accent, mode = 'placeholder', pct, low, high, hasBand, grown, groups }) {
  const W = 320, x0 = 14, x1 = 306, inner = x1 - x0;
  const trackY = 64, trackH = 18, r = trackH / 2;
  const xOf = (p) => x0 + Math.max(0, Math.min(1, (p - LO) / (HI - LO))) * inner;

  const isReal = mode === 'real';
  const isEst = mode === 'estimate';
  const hasMark = isReal || isEst;
  const xPct = hasMark ? xOf(pct) : 0;
  const fillW = (isReal && grown) ? xPct - x0 : 0;
  // The pill is a callout: its stem stays at the true (clamped) mark x, but
  // the pill body itself never leaves the plot. Without this, a mark at or
  // below the 30% window start drew the pill half outside the SVG (the
  // "You 0%" overflow bug). Half-widths match the rect widths below.
  const clampPill = (x, half) => Math.max(x0 + half, Math.min(x1 - half, x));
  const pillX = clampPill(xPct, 27);
  const estPillX = clampPill(xPct, 31);
  // Marks under the window start get an explicit "off scale to the left" cue.
  const belowWindow = hasMark && pct < LO;

  return (
    <svg viewBox={`0 0 ${W} 112`} width="100%" role="img"
         aria-label={hasMark
           ? `Your marks are about ${Math.round(pct)} percent${isEst ? ' (estimated)' : ''}, shown against the qualifying lines.`
           : 'The AIIMS Mains qualifying lines.'}
         style={{ display: 'block', marginTop: 10, overflow: 'visible' }}>
      {/* track */}
      <rect x={x0} y={trackY} width={inner} height={trackH} rx={r} fill={T.surfaceWarm} stroke={T.border} strokeWidth="1" />

      {/* spread band (low–high) behind the fill — real only */}
      {isReal && hasBand && (
        <rect x={xOf(low)} y={trackY - 4} width={Math.max(2, xOf(high) - xOf(low))} height={trackH + 8} rx="6"
              fill={accent} opacity="0.16" />
      )}

      {/* fill up to the score — real only */}
      {isReal && (
        <rect x={x0} y={trackY} width={fillW} height={trackH} rx={r} fill={accent}
              style={{ transition: 'width 0.75s cubic-bezier(0.22,1,0.36,1)' }} />
      )}
      {/* estimate: a faint fill so the bar still feels alive */}
      {isEst && (
        <rect x={x0} y={trackY} width={Math.max(0, xPct - x0)} height={trackH} rx={r} fill={accent} opacity="0.22" />
      )}

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

      {/* off-scale cue: a small chevron at the window start pointing left */}
      {belowWindow && (
        <path d={`M ${x0 + 11} ${trackY + r - 4.5} L ${x0 + 4.5} ${trackY + r} L ${x0 + 11} ${trackY + r + 4.5} Z`}
              fill={accent} opacity="0.75" />
      )}

      {isReal && (
        <>
          {/* solid "You" pill (kept inside the plot) + stem at the true mark */}
          <line x1={xPct} y1={36} x2={xPct} y2={trackY - 1} stroke={accent} strokeWidth="1.5" opacity="0.5" />
          <g transform={`translate(${pillX}, 24)`}>
            <rect x="-26" y="-13" width="52" height="22" rx="11" fill={accent} />
            <text x="0" y="2" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">You {Math.round(pct)}%</text>
          </g>
        </>
      )}
      {isEst && (
        <>
          {/* dashed, pulsing estimate marker (pill kept inside the plot) */}
          <line x1={xPct} y1={36} x2={xPct} y2={trackY - 1} stroke={accent} strokeWidth="1.5" opacity="0.45" strokeDasharray="3 2.5" />
          <g transform={`translate(${estPillX}, 24)`}>
            <rect x="-30" y="-13" width="60" height="22" rx="11" fill="none" stroke={accent} strokeWidth="1.4" strokeDasharray="3 2.5">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="2.2s" repeatCount="indefinite" />
            </rect>
            <text x="0" y="2" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={accent}>~{Math.round(pct)}% est</text>
          </g>
        </>
      )}
      {mode === 'placeholder' && (
        /* pulsing "your score appears here" placeholder pill */
        <g transform={`translate(${(x0 + x1) / 2}, 24)`}>
          <rect x="-52" y="-13" width="104" height="22" rx="11" fill="none" stroke={accent} strokeWidth="1.2" strokeDasharray="3 2.5">
            <animate attributeName="opacity" values="0.45;0.95;0.45" dur="2.2s" repeatCount="indefinite" />
          </rect>
          <text x="0" y="2" textAnchor="middle" fontSize="10" fontWeight="600" fill={accent} opacity="0.85">You appear here</text>
        </g>
      )}

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
        Percentile (relative, cycle-specific). Not your marks %, shown for context only.
      </p>
    </div>
  );
}
