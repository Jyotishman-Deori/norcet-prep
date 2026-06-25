// =====================================================================
// src/screens/ibq.jsx — NEW-09 "Image-Based Questions" (hotspot identify).
// Data-driven, zero-asset: diagrams come from JSON (src/data/ibq-diagrams.js)
// so more can be authored & UPLOADED later like question sets. The diagram
// persists while you label it — each correct tap drops a permanent pin, so the
// picture fills in as you go. Honours the global Pace (per-prompt countdown,
// reveals on timeout); pays Accuracy Coins per structure found.
//   intro → drill (diagram + "Tap the …" prompts) → done (coins)
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { ScanSearch, Check, X, Play, ChevronRight, Coins, Trophy, TimerOff, Lightbulb } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import PulseTimer from '../ui/pulse-timer.jsx';
import IbqDiagram from '../ui/ibq-diagram.jsx';
import { IBQ_DIAGRAMS } from '../data/ibq-diagrams.js';
import { paceFlags, normalizePace } from '../lib/pace.js';
import { shuffle } from '../lib/utils.js';

const CYAN = '#0891B2';
const COIN_PER = 4;
const SEC_BUDGET = 9;
const SEC_BUDGET_FLASH = 5;
const POOL = IBQ_DIAGRAMS.length;
const COUNT_OPTIONS = Array.from(new Set([1, 2, POOL])).filter((c) => c <= POOL);

function Ibq({ onBack, onComplete, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { pulse: paceOn, flashpoint } = paceFlags(normalizePace(data && data.preferences));
  const pace = normalizePace(data && data.preferences);
  const coinPer = flashpoint ? COIN_PER * 2 : COIN_PER;

  const [phase, setPhase] = useState('intro');
  const [count, setCount] = useState(POOL);
  const [diagrams, setDiagrams] = useState([]);
  const [dIdx, setDIdx] = useState(0);
  const [pIdx, setPIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [checked, setChecked] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [found, setFound] = useState([]);
  const [correctTotal, setCorrectTotal] = useState(0);

  const diagram = diagrams[dIdx];
  const prompt = diagram ? diagram.prompts[pIdx] : null;
  const answer = prompt ? prompt.answer : null;
  const budgetSec = flashpoint ? SEC_BUDGET_FLASH : SEC_BUDGET;
  const isCorrect = checked && picked === answer;
  const totalPrompts = useMemo(() => diagrams.reduce((s, d) => s + d.prompts.length, 0), [diagrams]);

  const begin = () => {
    setDiagrams(shuffle(IBQ_DIAGRAMS).slice(0, Math.max(1, count)));
    setDIdx(0); setPIdx(0); setPicked(null); setChecked(false); setTimedOut(false); setFound([]); setCorrectTotal(0);
    setPhase('drill');
  };

  const finalize = (id, viaTimeout) => {
    if (checked) return;
    setChecked(true); setPicked(id);
    const correct = id && id === answer;
    if (correct) { setFound((f) => (f.includes(id) ? f : [...f, id])); setCorrectTotal((c) => c + 1); }
    if (viaTimeout) setTimedOut(true);
    try { if (navigator.vibrate) navigator.vibrate(correct ? 12 : 22); } catch (e) {}
  };
  const onPick = (id) => { if (!checked) finalize(id, false); };
  const onTimeout = () => finalize(null, true);

  const next = () => {
    if (pIdx + 1 < diagram.prompts.length) { setPIdx((p) => p + 1); setPicked(null); setChecked(false); setTimedOut(false); }
    else if (dIdx + 1 < diagrams.length) { setDIdx((i) => i + 1); setPIdx(0); setFound([]); setPicked(null); setChecked(false); setTimedOut(false); }
    else setPhase('done');
  };

  // ── INTRO ──
  if (phase === 'intro') {
    return (
      <div className="anim-fadeup">
        <TopBar title="Spot the Structure" onBack={onBack} feedback={{ screen: 'IBQ setup' }} solid />
        <div className="max-w-md mx-auto px-4 pt-2 pb-32">
          <Card className="p-5 mb-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${CYAN}, #0B4F66)`, border: 'none' }}>
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="relative flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <ScanSearch size={26} color="#FFF" />
              </div>
              <div style={{ color: '#FFF' }}>
                <div className="font-display text-xl font-bold leading-tight">Tap what you see</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>Find the structure on the diagram — ECG waves, heart sounds, abdominal regions & more.</div>
              </div>
            </div>
          </Card>

          {COUNT_OPTIONS.length > 1 && (
            <>
              <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many diagrams?</div>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {COUNT_OPTIONS.map((c, i) => {
                  const on = count === c;
                  return (
                    <button key={c} onClick={() => setCount(c)}
                            className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 anim-fadeup"
                            style={{ background: on ? CYAN : T.surface, color: on ? '#FFF' : T.ink,
                                     border: `1.5px solid ${on ? CYAN : T.border}`, boxShadow: on ? `0 8px 20px ${CYAN}44` : 'none',
                                     animationDelay: `${i * 60}ms` }}>
                      <div className="text-base leading-none">{c === POOL ? 'All' : c}</div>
                      <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>
                        {c === 1 ? 'diagram' : 'diagrams'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <PaceSelector value={pace} onChange={onSetPace} T={T} />
          <div className="text-[11px] leading-relaxed px-1" style={{ color: T.muted }}>
            With <b style={{ color: '#16A34A' }}>The Pulse</b> on, each prompt gets a countdown — run out and it reveals.
            <b style={{ color: '#B45309' }}> Flashpoint</b> halves the clock and <b>doubles</b> the coins.
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
             style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={begin} size="lg" className="w-full" icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>Start</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ──
  if (phase === 'done') {
    const coins = correctTotal * coinPer;
    return (
      <div className="anim-fadeup">
        <TopBar title="Spot the Structure" onBack={onBack} />
        <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 q-pulse"
               style={{ background: T.success + '18', border: `1px solid ${T.success}44` }}>
            <Trophy size={28} style={{ color: T.success }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Labelled</div>
          <div className="text-[14px] mb-5" style={{ color: T.inkSoft }}>
            You found <b style={{ color: T.ink }}>{correctTotal} of {totalPrompts}</b> structures.
          </div>
          {coins > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full mb-7 q-pulse"
                 style={{ background: '#F59E0B22', color: '#B45309' }}>
              <Coins size={15} /> +{coins} Coins{flashpoint ? ' · 2×' : ''}
            </div>
          )}
          <Button onClick={() => { try { if (onComplete) onComplete(coins); } catch (e) {} }} size="lg" className="w-full">Finish</Button>
        </div>
      </div>
    );
  }

  // ── DRILL ──
  if (!diagram || !prompt) return null;

  return (
    <div className="test-enter">
      <TopBar title={diagram.title} onBack={onBack}
              right={<div className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full"
                          style={{ color: T.inkSoft, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                       {pIdx + 1} / {diagram.prompts.length}
                     </div>} />
      <div className="max-w-md mx-auto px-4 pb-40 pt-3">

        {paceOn && (
          <PulseTimer budgetSec={budgetSec} resetKey={`${diagram.id}:${prompt.id}`} flashpoint={flashpoint}
                      onExpire={onTimeout} paused={checked} T={T} />
        )}

        {/* the prompt */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: CYAN + '18', color: CYAN }}>
            <ScanSearch size={16} />
          </span>
          <div className="font-display text-[16px] font-semibold" style={{ color: T.ink }}>{prompt.ask}</div>
        </div>

        <IbqDiagram diagram={diagram} found={found} picked={picked} checked={checked} answer={answer} onPick={onPick} T={T} height={300} />

        {/* feedback */}
        {checked && (
          <Card className="p-4 mt-3 anim-fadeup"
                style={{ background: isCorrect ? T.successSoft : T.surfaceWarm,
                         border: `1px solid ${(isCorrect ? T.success : timedOut ? T.error : T.accent)}44` }}>
            <div className="flex items-center gap-2 mb-1.5">
              {isCorrect ? <Check size={16} style={{ color: T.success }} />
                : timedOut ? <TimerOff size={16} style={{ color: T.error }} />
                : <X size={16} style={{ color: T.error }} />}
              <div className="font-display text-sm font-semibold" style={{ color: isCorrect ? T.success : timedOut ? T.error : T.accent }}>
                {isCorrect ? 'Found it!' : timedOut ? 'Time’s up' : 'Not there'}
              </div>
            </div>
            <div className="flex items-start gap-1.5" style={{ color: T.inkSoft }}>
              <Lightbulb size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
              <div className="text-[12.5px] leading-relaxed">{prompt.exp}</div>
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
              {(pIdx + 1 < diagram.prompts.length || dIdx + 1 < diagrams.length) ? 'Next' : 'Finish'}
            </Button>
          ) : (
            <div className="text-center text-[12px] py-1.5" style={{ color: T.muted }}>Tap the structure on the diagram</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Ibq;
