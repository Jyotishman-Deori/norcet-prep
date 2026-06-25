// =====================================================================
// src/screens/skill-sequence.jsx — NEW-10 (Module B) Clinical Skill Sequence.
// A "shift handoff"-styled drill: tap the clinical steps into the correct
// chronological order, check, learn the rationale. Tap-to-build (no fragile
// drag), so it's touch-robust and premium. Self-contained — content is the
// built-in SKILL_SEQUENCES seed. Correct sequences earn Accuracy Coins.
// =====================================================================
import React, { useState, useMemo } from 'react';
import { Activity, Check, X, GripVertical, Lightbulb, ChevronRight, Coins, RotateCcw, Trophy } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import { shuffle } from '../lib/utils.js';
import { SKILL_SEQUENCES } from '../data/skill-sequences.js';

const COIN_PER_CORRECT = 15;

function SkillSequence({ onBack, onComplete }) {
  const { theme: T } = useTheme();
  const scenarios = useMemo(() => shuffle(SKILL_SEQUENCES), []);
  const [idx, setIdx] = useState(0);
  const [order, setOrder] = useState([]);        // user's built sequence (ids)
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [phase, setPhase] = useState('drill');   // drill | done

  const scenario = scenarios[idx];
  const correctOrder = useMemo(() => scenario.steps.map(s => s.id), [scenario]);
  const shuffledSteps = useMemo(() => shuffle(scenario.steps), [scenario]);
  const byId = useMemo(() => { const m = {}; scenario.steps.forEach(s => { m[s.id] = s; }); return m; }, [scenario]);

  const placed = new Set(order);
  const pool = shuffledSteps.filter(s => !placed.has(s.id));
  const allPlaced = order.length === scenario.steps.length;
  const isExact = checked && order.every((id, i) => id === correctOrder[i]);

  const tapPool = (id) => { if (!checked) setOrder(o => [...o, id]); };
  const tapPlaced = (id) => { if (!checked) setOrder(o => o.filter(x => x !== id)); };
  const reset = () => { if (!checked) setOrder([]); };

  const check = () => {
    if (!allPlaced || checked) return;
    setChecked(true);
    if (order.every((id, i) => id === correctOrder[i])) setCorrectCount(c => c + 1);
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
  };

  const next = () => {
    if (idx + 1 < scenarios.length) {
      setIdx(i => i + 1); setOrder([]); setChecked(false);
    } else {
      setPhase('done');
    }
  };

  // ── DONE — summary + reward ──
  if (phase === 'done') {
    const coins = correctCount * COIN_PER_CORRECT;
    return (
      <div className="anim-fadeup">
        <TopBar title="Clinical Skill Drill" onBack={onBack} />
        <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: T.success + '18', border: `1px solid ${T.success}44` }}>
            <Trophy size={28} style={{ color: T.success }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Shift complete</div>
          <div className="text-[14px] mb-5" style={{ color: T.inkSoft }}>
            You sequenced <b style={{ color: T.ink }}>{correctCount} of {scenarios.length}</b> procedures perfectly.
          </div>
          {coins > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full mb-7"
                 style={{ background: '#F59E0B22', color: '#B45309' }}>
              <Coins size={15} /> +{coins} Coins
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
  return (
    <div className="test-enter">
      <TopBar title="Clinical Skill Drill" onBack={onBack}
              right={<div className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full"
                          style={{ color: T.inkSoft, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                       {idx + 1} / {scenarios.length}
                     </div>} />
      <div className="max-w-md mx-auto px-4 pb-40 pt-3">
        {/* patient handoff tag */}
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full mb-3"
             style={{ background: T.primary + '12', color: T.primary }}>
          <Activity size={12} /> {scenario.patientTag}
        </div>
        <div className="font-display text-[17px] leading-snug mb-5" style={{ color: T.ink }}>{scenario.scenario}</div>

        {/* YOUR SEQUENCE */}
        <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: T.muted }}>Your order</div>
        <div className="space-y-2 mb-4 min-h-[48px]">
          {order.length === 0 && (
            <div className="text-[13px] italic px-1 py-3" style={{ color: T.muted }}>Tap the steps below in the order you'd perform them.</div>
          )}
          {order.map((id, i) => {
            const rightHere = checked && id === correctOrder[i];
            const wrongHere = checked && id !== correctOrder[i];
            const bg = rightHere ? T.successSoft : wrongHere ? T.errorSoft : T.surface;
            const edge = rightHere ? T.success : wrongHere ? T.error : T.primary;
            return (
              <button key={id} onClick={() => tapPlaced(id)} disabled={checked}
                      className="no-tap-highlight w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.99] transition seq-item"
                      style={{ background: bg, border: `1.5px solid ${edge}`, animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={{ background: edge, color: '#FFF' }}>
                  {checked ? (rightHere ? <Check size={13} /> : <X size={13} />) : i + 1}
                </span>
                <span className="text-[14px] flex-1" style={{ color: T.ink }}>{byId[id].text}</span>
                {!checked && <X size={15} style={{ color: T.muted }} />}
              </button>
            );
          })}
        </div>

        {/* STEP POOL */}
        {!checked && pool.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: T.muted }}>Steps</div>
            <div className="space-y-2 mb-4">
              {pool.map(s => (
                <button key={s.id} onClick={() => tapPool(s.id)}
                        className="no-tap-highlight w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:scale-[0.99] transition"
                        style={{ background: T.surfaceWarm, border: `1.5px solid ${T.border}` }}>
                  <GripVertical size={16} style={{ color: T.muted }} className="flex-shrink-0" />
                  <span className="text-[14px] flex-1" style={{ color: T.inkSoft }}>{s.text}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* result + rationale */}
        {checked && (
          <Card className="p-4 mb-4 anim-fadeup" style={{ background: isExact ? T.successSoft : T.surfaceWarm, border: `1px solid ${(isExact ? T.success : T.accent)}44` }}>
            <div className="flex items-center gap-2 mb-2">
              {isExact ? <Check size={16} style={{ color: T.success }} /> : <Activity size={16} style={{ color: T.accent }} />}
              <div className="font-display text-sm font-semibold" style={{ color: isExact ? T.success : T.accent }}>
                {isExact ? 'Perfect sequence!' : 'Not quite — here’s the correct order'}
              </div>
            </div>
            {!isExact && (
              <ol className="mb-2.5 space-y-1">
                {correctOrder.map((id, i) => (
                  <li key={id} className="text-[13px] flex gap-2" style={{ color: T.ink }}>
                    <span className="font-semibold tabular-nums" style={{ color: T.muted }}>{i + 1}.</span>{byId[id].text}
                  </li>
                ))}
              </ol>
            )}
            <div className="flex items-start gap-1.5 pt-2" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <Lightbulb size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
              <div className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>{scenario.rationale}</div>
            </div>
          </Card>
        )}
      </div>

      {/* fixed footer actions */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-2">
          {!checked ? (
            <>
              {order.length > 0 && (
                <Button variant="ghost" onClick={reset} className="flex-shrink-0" icon={<RotateCcw size={15} />}>Reset</Button>
              )}
              <Button onClick={check} disabled={!allPlaced} size="lg" className="flex-1" icon={<Check size={16} />}>
                Check order
              </Button>
            </>
          ) : (
            <Button onClick={next} size="lg" className="flex-1" icon={<ChevronRight size={16} />}>
              {idx + 1 < scenarios.length ? 'Next patient' : 'Finish shift'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SkillSequence;
