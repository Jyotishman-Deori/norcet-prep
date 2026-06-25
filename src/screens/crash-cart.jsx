// =====================================================================
// src/screens/crash-cart.jsx — NEW-10 (Module C) "Crash Cart".
// An emergency-drug drill under code pressure. A patient is crashing; read the
// vignette + vitals and grab the right drug (name + dose) off the trolley.
// Honours the global Pace (The Pulse / Flashpoint per-case countdown that locks
// on timeout) and pays Accuracy Coins for correct picks. Distinct from the
// existing "Code Blue Mode" (which re-drills your own past mistakes).
//   intro → drill (vignette + drug cards → rationale) → done (coins)
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Syringe, Check, X, Play, ChevronRight, Coins, Trophy, TimerOff, AlertTriangle, Activity, Lightbulb } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import PulseTimer from '../ui/pulse-timer.jsx';
import { CRASH_CASES } from '../data/crash-cart.js';
import { paceFlags, normalizePace } from '../lib/pace.js';
import { shuffle } from '../lib/utils.js';

const RED = '#DC2626';
const COIN_BASE = 15;
const SEC_BUDGET = 16;
const SEC_BUDGET_FLASH = 9;
const POOL = CRASH_CASES.length;
const COUNT_OPTIONS = [3, 5, POOL].filter((c, i, a) => c <= POOL && a.indexOf(c) === i);

const SEV = {
  warning:  { label: 'URGENT',   color: '#F59E0B' },
  critical: { label: 'CRITICAL', color: '#EF4444' },
};

function CrashCart({ onBack, onComplete, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { pulse: paceOn, flashpoint } = paceFlags(normalizePace(data && data.preferences));
  const pace = normalizePace(data && data.preferences);
  const coinPer = flashpoint ? COIN_BASE * 2 : COIN_BASE;

  const [phase, setPhase] = useState('intro');
  const [count, setCount] = useState(Math.min(5, POOL));
  const [cases, setCases] = useState([]);
  const [order, setOrder] = useState([]);   // shuffled option order per case (so the answer isn't always #1)
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const kase = cases[idx];
  const budgetSec = flashpoint ? SEC_BUDGET_FLASH : SEC_BUDGET;

  // shuffle the option order for the current case (indices into kase.options)
  useEffect(() => {
    if (kase) setOrder(shuffle(kase.options.map((_, i) => i)));
  }, [kase && kase.id]);

  const begin = () => {
    setCases(shuffle(CRASH_CASES).slice(0, Math.max(1, count)));
    setIdx(0); setSelected(null); setChecked(false); setTimedOut(false); setCorrectCount(0);
    setPhase('drill');
  };

  const finalize = (optIdx, viaTimeout) => {
    if (checked) return;
    setChecked(true); setSelected(optIdx);
    const correct = optIdx != null && optIdx === kase.answer;
    if (correct) setCorrectCount((c) => c + 1);
    if (viaTimeout) setTimedOut(true);
    try { if (navigator.vibrate) navigator.vibrate(correct ? 12 : 22); } catch (e) {}
  };
  const pick = (optIdx) => { if (!checked) finalize(optIdx, false); };
  const onTimeout = () => finalize(null, true);

  const next = () => {
    if (idx + 1 < cases.length) { setIdx((i) => i + 1); setSelected(null); setChecked(false); setTimedOut(false); }
    else { setPhase('done'); }
  };

  // ── INTRO ──
  if (phase === 'intro') {
    return (
      <div className="anim-fadeup">
        <TopBar title="Crash Cart" onBack={onBack} feedback={{ screen: 'Crash Cart setup' }} solid />
        <div className="max-w-md mx-auto px-4 pt-2 pb-32">
          <Card className="p-5 mb-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${RED}, #7F1D1D)`, border: 'none' }}>
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="relative flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <Syringe size={26} color="#FFF" className="timer-beat" />
              </div>
              <div style={{ color: '#FFF' }}>
                <div className="font-display text-xl font-bold leading-tight">Grab the right drug</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>The patient is crashing. Read fast, pick the correct drug & dose, learn the why.</div>
              </div>
            </div>
          </Card>

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many codes?</div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {COUNT_OPTIONS.map((c, i) => {
              const on = count === c;
              return (
                <button key={c} onClick={() => setCount(c)}
                        className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 anim-fadeup"
                        style={{ background: on ? RED : T.surface, color: on ? '#FFF' : T.ink,
                                 border: `1.5px solid ${on ? RED : T.border}`, boxShadow: on ? `0 8px 20px ${RED}44` : 'none',
                                 animationDelay: `${i * 60}ms` }}>
                  <div className="text-base leading-none">{c === POOL ? 'All' : c}</div>
                  <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>
                    {c === 1 ? 'code' : 'codes'}
                  </div>
                </button>
              );
            })}
          </div>

          <PaceSelector value={pace} onChange={onSetPace} T={T} />
          <div className="text-[11px] leading-relaxed px-1" style={{ color: T.muted }}>
            With <b style={{ color: '#16A34A' }}>The Pulse</b> on, every code gets a countdown — run out and it locks.
            <b style={{ color: '#B45309' }}> Flashpoint</b> halves the clock and <b>doubles</b> the coins.
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
             style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={begin} size="lg" className="w-full" icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
              Start · {count === POOL ? 'All' : count} {count === 1 ? 'code' : 'codes'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ──
  if (phase === 'done') {
    const coins = correctCount * coinPer;
    return (
      <div className="anim-fadeup">
        <TopBar title="Crash Cart" onBack={onBack} />
        <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 q-pulse"
               style={{ background: T.success + '18', border: `1px solid ${T.success}44` }}>
            <Trophy size={28} style={{ color: T.success }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Codes run</div>
          <div className="text-[14px] mb-5" style={{ color: T.inkSoft }}>
            You picked correctly on <b style={{ color: T.ink }}>{correctCount} of {cases.length}</b> codes.
          </div>
          {coins > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full mb-7 q-pulse"
                 style={{ background: '#F59E0B22', color: '#B45309' }}>
              <Coins size={15} /> +{coins} Coins{flashpoint ? ' · 2×' : ''}
            </div>
          )}
          <Button onClick={() => { try { if (onComplete) onComplete(coins); } catch (e) {} }} size="lg" className="w-full">
            Finish
          </Button>
        </div>
      </div>
    );
  }

  // ── DRILL ──
  if (!kase) return null;
  const sev = SEV[kase.severity] || SEV.critical;
  const isCorrect = checked && selected === kase.answer;

  return (
    <div className="test-enter">
      <TopBar title="Crash Cart" onBack={onBack}
              right={<div className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full"
                          style={{ color: T.inkSoft, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                       {idx + 1} / {cases.length}
                     </div>} />
      <div className="max-w-md mx-auto px-4 pb-40 pt-3">

        {paceOn && (
          <PulseTimer budgetSec={budgetSec} resetKey={kase.id} flashpoint={flashpoint}
                      onExpire={onTimeout} paused={checked} T={T} />
        )}

        {/* code vignette */}
        <Card className="p-4 mb-2" style={{ background: T.surface, border: `1px solid ${sev.color}33` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: sev.color + '18', color: sev.color }}>
              <AlertTriangle size={11} /> {kase.tag}
            </span>
            <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-md" style={{ background: T.surfaceWarm, color: T.inkSoft }}>
              {kase.vitals}
            </span>
          </div>
          <div className="font-display text-[15px] leading-snug mb-2.5" style={{ color: T.ink }}>{kase.scenario}</div>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: sev.color }}>
            <Activity size={14} /> {kase.prompt}
          </div>
        </Card>

        <div className="text-[10px] uppercase tracking-widest font-semibold mt-4 mb-2" style={{ color: T.muted }}>The trolley</div>
        {/* drug cards (shuffled order) */}
        <div className="grid grid-cols-1 gap-2.5">
          {order.map((optIdx, pos) => {
            const opt = kase.options[optIdx];
            const isAns = optIdx === kase.answer;
            const isSel = optIdx === selected;
            let bg = T.surface, border = T.border, nameColor = T.ink, badge = null;
            if (checked) {
              if (isAns) { bg = T.successSoft; border = T.success; badge = <Check size={16} style={{ color: T.success }} />; }
              else if (isSel) { bg = T.errorSoft; border = T.error; badge = <X size={16} style={{ color: T.error }} />; }
              else { nameColor = T.muted; }
            }
            return (
              <button key={optIdx} onClick={() => pick(optIdx)} disabled={checked}
                      className="no-tap-highlight w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left active:scale-[0.99] transition anim-fadeup"
                      style={{ background: bg, border: `1.5px solid ${border}`, animationDelay: `${pos * 45}ms` }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: checked && isAns ? T.success : checked && isSel ? T.error : T.surfaceWarm,
                               color: checked && (isAns || isSel) ? '#FFF' : T.muted }}>
                  <Syringe size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[15px] font-semibold leading-tight" style={{ color: nameColor }}>{opt.name}</div>
                  <div className="text-[11.5px] tabular-nums" style={{ color: T.muted }}>{opt.dose}</div>
                </div>
                {badge}
              </button>
            );
          })}
        </div>

        {/* feedback */}
        {checked && (
          <Card className="p-4 mt-4 anim-fadeup"
                style={{ background: isCorrect ? T.successSoft : T.surfaceWarm,
                         border: `1px solid ${(isCorrect ? T.success : timedOut ? T.error : T.accent)}44` }}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? <Check size={16} style={{ color: T.success }} />
                : timedOut ? <TimerOff size={16} style={{ color: T.error }} />
                : <X size={16} style={{ color: T.error }} />}
              <div className="font-display text-sm font-semibold" style={{ color: isCorrect ? T.success : timedOut ? T.error : T.accent }}>
                {isCorrect ? 'Right call!' : timedOut ? 'Time’s up' : 'Wrong drug'}
              </div>
              <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-md"
                    style={{ background: T.success + '18', color: T.success }}>
                <Check size={12} /> {kase.options[kase.answer].name} · {kase.options[kase.answer].dose}
              </span>
            </div>
            <div className="flex items-start gap-1.5" style={{ color: T.inkSoft }}>
              <Lightbulb size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
              <div className="text-[12.5px] leading-relaxed">{kase.rationale}</div>
            </div>
          </Card>
        )}
      </div>

      {/* footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {checked ? (
            <Button onClick={next} size="lg" className="w-full" icon={<ChevronRight size={16} />}>
              {idx + 1 < cases.length ? 'Next code' : 'Finish'}
            </Button>
          ) : (
            <div className="text-center text-[12px] py-1.5" style={{ color: T.muted }}>Tap the drug you’d give</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CrashCart;
