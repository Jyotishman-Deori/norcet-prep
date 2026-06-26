// =====================================================================
// src/screens/tie-breaker.jsx — NEW-06 "Tie-Breaker".
// Both options are reasonable — pick the one that comes FIRST. Each round
// teaches an explicit prioritisation framework (ABC, Maslow, Safety-first,
// Acute-over-chronic, Assess-before-act). Honours the global Pace (per-round
// countdown that locks on timeout) and pays Accuracy Coins for correct calls.
//   intro → drill (scenario + A/B → which is priority) → done (coins)
// =====================================================================
import React, { useState, useMemo } from 'react';
import { Scale, Check, X, Play, ChevronRight, Coins, Trophy, TimerOff, Lightbulb } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import PulseTimer from '../ui/pulse-timer.jsx';
import { TIE_BREAKERS } from '../data/tie-breaker.js';
import { paceFlags, normalizePace } from '../lib/pace.js';
import { mergePackItems } from '../lib/drill-packs.js';
import { shuffle } from '../lib/utils.js';
import ComboBurst, { useCombo } from '../ui/combo-burst.jsx';

const INDIGO = '#4338CA';
const COIN_BASE = 15;
const SEC_BUDGET = 14;
const SEC_BUDGET_FLASH = 8;

function TieBreaker({ onBack, onComplete, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { pulse: paceOn, flashpoint } = paceFlags(normalizePace(data && data.preferences));
  const pace = normalizePace(data && data.preferences);
  const coinPer = flashpoint ? COIN_BASE * 2 : COIN_BASE;

  // seed rounds + any installed Tie-Breaker packs
  const pool = useMemo(() => mergePackItems('tie-breaker', TIE_BREAKERS, data), [data]);
  const POOL = pool.length;
  const COUNT_OPTIONS = useMemo(() => Array.from(new Set([5, 10, POOL])).filter((c) => c <= POOL), [POOL]);

  const [phase, setPhase] = useState('intro');
  const [count, setCount] = useState(Math.min(10, POOL));
  const [rounds, setRounds] = useState([]);   // each: { ...tb, flip } (flip swaps A/B display so 'a' isn't always left)
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);  // 'a' | 'b'
  const [checked, setChecked] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const r = rounds[idx];
  const budgetSec = flashpoint ? SEC_BUDGET_FLASH : SEC_BUDGET;
  const isCorrect = checked && picked === (r && r.answer);
  const { flash: comboFlash, hit: comboHit, miss: comboMiss, reset: comboReset } = useCombo();

  const begin = () => {
    const picks = shuffle(pool).slice(0, Math.max(1, count)).map((tb) => ({ ...tb, flip: Math.random() < 0.5 }));
    setRounds(picks);
    setIdx(0); setPicked(null); setChecked(false); setTimedOut(false); setCorrectCount(0);
    comboReset();
    setPhase('drill');
  };

  const finalize = (choice, viaTimeout) => {
    if (checked) return;
    setChecked(true); setPicked(choice);
    if (choice && choice === r.answer) { setCorrectCount((c) => c + 1); comboHit(); } else { comboMiss(); }
    if (viaTimeout) setTimedOut(true);
    try { if (navigator.vibrate) navigator.vibrate(choice === r.answer ? 12 : 22); } catch (e) {}
  };
  const choose = (choice) => { if (!checked) finalize(choice, false); };
  const onTimeout = () => finalize(null, true);

  const next = () => {
    if (idx + 1 < rounds.length) { setIdx((i) => i + 1); setPicked(null); setChecked(false); setTimedOut(false); }
    else setPhase('done');
  };

  // ── INTRO ──
  if (phase === 'intro') {
    return (
      <div className="anim-fadeup">
        <TopBar title="Tie-Breaker" onBack={onBack} feedback={{ screen: 'Tie-Breaker setup' }} solid />
        <div className="max-w-md mx-auto px-4 pt-2 pb-32">
          <Card className="p-5 mb-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${INDIGO}, #312E81)`, border: 'none' }}>
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="relative flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <Scale size={26} color="#FFF" />
              </div>
              <div style={{ color: '#FFF' }}>
                <div className="font-display text-xl font-bold leading-tight">Which comes first?</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>Both answers are right — pick the priority. Master ABC, Maslow & safety-first.</div>
              </div>
            </div>
          </Card>

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many?</div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {COUNT_OPTIONS.map((c, i) => {
              const on = count === c;
              return (
                <button key={c} onClick={() => setCount(c)}
                        className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 anim-fadeup"
                        style={{ background: on ? INDIGO : T.surface, color: on ? '#FFF' : T.ink,
                                 border: `1.5px solid ${on ? INDIGO : T.border}`, boxShadow: on ? `0 8px 20px ${INDIGO}44` : 'none',
                                 animationDelay: `${i * 60}ms` }}>
                  <div className="text-base leading-none">{c === POOL ? 'All' : c}</div>
                  <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>rounds</div>
                </button>
              );
            })}
          </div>

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How it works</div>
          <div className="rounded-2xl p-3.5 mb-5 space-y-2" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
            {['Read the clinical scenario', 'Both options are reasonable', 'Pick the one you would do FIRST'].map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ background: INDIGO + '18', color: INDIGO }}>{i + 1}</span>
                <span className="text-[12.5px] leading-snug" style={{ color: T.inkSoft }}>{s}</span>
              </div>
            ))}
          </div>

          <PaceSelector value={pace} onChange={onSetPace} T={T} />
          <div className="text-[11px] leading-relaxed px-1" style={{ color: T.muted }}>
            With <b style={{ color: '#16A34A' }}>The Pulse</b> on, each round gets a countdown — run out and it locks.
            <b style={{ color: '#B45309' }}> Flashpoint</b> halves the clock and <b>doubles</b> the coins.
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
             style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={begin} size="lg" className="w-full" icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
              Start
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
        <TopBar title="Tie-Breaker" onBack={onBack} />
        <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 q-pulse"
               style={{ background: T.success + '18', border: `1px solid ${T.success}44` }}>
            <Trophy size={28} style={{ color: T.success }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Calls made</div>
          <div className="text-[14px] mb-5" style={{ color: T.inkSoft }}>
            You prioritised correctly on <b style={{ color: T.ink }}>{correctCount} of {rounds.length}</b> rounds.
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
  if (!r) return null;
  // display order: optionally flip so the correct side isn't predictable
  const left  = r.flip ? { key: 'b', text: r.b } : { key: 'a', text: r.a };
  const right = r.flip ? { key: 'a', text: r.a } : { key: 'b', text: r.b };

  const OptionCard = ({ opt }) => {
    const isAns = checked && opt.key === r.answer;
    const isSel = checked && opt.key === picked;
    let bg = T.surface, border = T.border, color = T.ink;
    if (checked) {
      if (isAns) { bg = T.successSoft; border = T.success; }
      else if (isSel) { bg = T.errorSoft; border = T.error; }
      else { color = T.muted; }
    }
    return (
      <button onClick={() => choose(opt.key)} disabled={checked}
              className="no-tap-highlight flex-1 flex flex-col items-start gap-2 p-4 rounded-2xl text-left active:scale-[0.98] transition"
              style={{ background: bg, border: `1.5px solid ${border}`, minHeight: 132 }}>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ background: checked && isAns ? T.success : checked && isSel ? T.error : INDIGO + '15',
                       color: checked && (isAns || isSel) ? '#FFF' : INDIGO }}>
          {checked ? (isAns ? <Check size={16} /> : isSel ? <X size={16} /> : opt.key.toUpperCase()) : opt.key.toUpperCase()}
        </span>
        <span className="font-display text-[14px] leading-snug" style={{ color }}>{opt.text}</span>
      </button>
    );
  };

  return (
    <div className="test-enter">
      <ComboBurst flash={comboFlash} />
      <TopBar title="Tie-Breaker" onBack={onBack}
              right={<div className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full"
                          style={{ color: T.inkSoft, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                       {idx + 1} / {rounds.length}
                     </div>} />
      <div className="max-w-md mx-auto px-4 pb-40 pt-3">

        {paceOn && (
          <PulseTimer budgetSec={budgetSec} resetKey={r.id} flashpoint={flashpoint}
                      onExpire={onTimeout} paused={checked} T={T} />
        )}

        <Card className="p-4 mb-4" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
          <div className="font-display text-[15.5px] leading-snug" style={{ color: T.ink }}>{r.scenario}</div>
        </Card>

        <div className="text-center text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: INDIGO }}>
          Which comes first?
        </div>

        <div className="flex gap-3 items-stretch">
          <OptionCard opt={left} />
          <div className="flex items-center justify-center flex-shrink-0">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.borderSoft}` }}>vs</span>
          </div>
          <OptionCard opt={right} />
        </div>

        {/* verdict */}
        {checked && (
          <Card className="p-4 mt-4 anim-fadeup"
                style={{ background: isCorrect ? T.successSoft : T.surfaceWarm,
                         border: `1px solid ${(isCorrect ? T.success : timedOut ? T.error : T.accent)}44` }}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? <Check size={16} style={{ color: T.success }} />
                : timedOut ? <TimerOff size={16} style={{ color: T.error }} />
                : <X size={16} style={{ color: T.error }} />}
              <div className="font-display text-sm font-semibold" style={{ color: isCorrect ? T.success : timedOut ? T.error : T.accent }}>
                {isCorrect ? 'Right priority!' : timedOut ? 'Time’s up' : 'Other one comes first'}
              </div>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: INDIGO + '18', color: INDIGO }}>{r.principle}</span>
            </div>
            <div className="flex items-start gap-1.5" style={{ color: T.inkSoft }}>
              <Lightbulb size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
              <div className="text-[12.5px] leading-relaxed">{r.why}</div>
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
              {idx + 1 < rounds.length ? 'Next round' : 'Finish'}
            </Button>
          ) : (
            <div className="text-center text-[12px] py-1.5" style={{ color: T.muted }}>Tap the action you’d do first</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TieBreaker;
