// =====================================================================
// src/screens/distractor-assassin.jsx — NEW-05 "Distractor Assassin".
// A metacognition drill built ON TOP of the EXISTING question bank — zero new
// content/tagging. Instead of picking the right answer, the learner ELIMINATES
// the wrong options one at a time. Each clean kill reveals that option's
// existing `wrong{}` rationale and scores; accidentally striking the correct
// answer ends the round (you "shot the right patient"). Clear every distractor
// for a perfect round. Trains elimination — the core NORCET MCQ skill.
// Honours the global Pace (per-question countdown that locks on timeout) and
// pays Accuracy Coins per distractor eliminated.
// =====================================================================
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Crosshair, Target, Check, X, Play, ChevronRight, Coins, Trophy, TimerOff, Skull, ShieldX } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { useExitGuard } from '../ui/use-exit-guard.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import PulseTimer from '../ui/pulse-timer.jsx';
import { paceFlags, normalizePace } from '../lib/pace.js';
import { shuffle } from '../lib/utils.js';

const CRIMSON = '#BE123C';
const COIN_PER_KILL = 4;
const SEC_BUDGET = 20;
const SEC_BUDGET_FLASH = 11;

// A question is eligible if it's a single-best-answer MCQ with ≥3 options.
function eligible(q) {
  if (!q || !Array.isArray(q.options) || q.options.length < 3) return false;
  const type = q.type || 'mcq';
  if (type !== 'mcq') return false;
  return Array.isArray(q.correct) && q.correct.length === 1;
}

function DistractorAssassin({ allQuestions, onBack, onComplete, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { pulse: paceOn, flashpoint } = paceFlags(normalizePace(data && data.preferences));
  const pace = normalizePace(data && data.preferences);
  const coinPerKill = flashpoint ? COIN_PER_KILL * 2 : COIN_PER_KILL;

  const pool = useMemo(() => (allQuestions || []).filter(eligible), [allQuestions]);
  const POOL = pool.length;
  // Always offer at least one real choice. Filtering [5,10,15] by `c <= POOL`
  // alone rendered an EMPTY chip grid on a small bank (1 to 4 eligible
  // questions): every sibling game appends POOL as the fallback, so do that.
  const COUNT_OPTIONS = useMemo(
    () => Array.from(new Set([5, 10, 15, POOL])).filter((c) => c > 0 && c <= POOL).sort((a, b) => a - b),
    [POOL]
  );

  const [phase, setPhase] = useState('intro');
  const [count, setCount] = useState(Math.min(10, POOL) || 1);
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [eliminated, setEliminated] = useState([]);   // option indices struck out
  const [hitCorrect, setHitCorrect] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [killTotal, setKillTotal] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = qs[idx];
  const correctIdx = q ? q.correct[0] : -1;
  const distractorCount = q ? q.options.length - 1 : 0;
  const budgetSec = flashpoint ? SEC_BUDGET_FLASH : SEC_BUDGET;
  const cleared = q ? eliminated.length : 0;
  const perfect = q && !hitCorrect && cleared === distractorCount && distractorCount > 0;
  const locked = hitCorrect || perfect || timedOut;

  useEffect(() => { setEliminated([]); setHitCorrect(false); setTimedOut(false); }, [q && q.id]);

  const coins = killTotal * coinPerKill;

  // Pay out exactly once. onComplete is the ONLY thing that banks the coins, so
  // the results back arrow routes here too: it used to go straight home and
  // silently bin the whole run's earnings.
  const finish = useCallback(() => {
    if (finished) { if (onBack) onBack(); return; }
    setFinished(true);
    try { if (onComplete) onComplete(coins); else if (onBack) onBack(); } catch (e) { if (onBack) onBack(); }
  }, [finished, onComplete, onBack, coins]);

  // Leaving mid-run discards it. Ask first, but only once there is something to lose.
  const { requestExit, dialog: exitDialog } = useExitGuard({
    started: phase === 'drill', finished, earned: coins, progress: idx, onLeave: phase === 'done' ? finish : onBack,
  });

  const begin = () => {
    setQs(shuffle(pool).slice(0, Math.max(1, count)));
    setIdx(0); setEliminated([]); setHitCorrect(false); setTimedOut(false); setKillTotal(0); setPerfects(0);
    setPhase('drill');
  };

  const shoot = (i) => {
    if (locked || eliminated.includes(i)) return;
    if (i === correctIdx) {
      setHitCorrect(true);
      try { if (navigator.vibrate) navigator.vibrate(28); } catch (e) {}
    } else {
      setEliminated((e) => [...e, i]);
      setKillTotal((k) => k + 1);
      try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    }
  };
  const onTimeout = () => { if (!locked) setTimedOut(true); };

  // award the perfect-clear bonus exactly once per round
  useEffect(() => { if (perfect) setPerfects((p) => p + 1); }, [perfect]);

  const next = () => {
    if (idx + 1 < qs.length) { setIdx((i) => i + 1); }
    else setPhase('done');
  };

  // ── INTRO ──
  if (phase === 'intro') {
    if (POOL === 0) {
      return (
        <div className="anim-fadeup">
          <TopBar title="Distractor Assassin" onBack={onBack} solid />
          <div className="max-w-md mx-auto px-4 pt-16 text-center">
            <ShieldX size={34} style={{ color: T.muted }} className="mx-auto mb-3" />
            <div className="text-sm" style={{ color: T.inkSoft }}>No eligible single-answer questions are loaded yet. Add more to the bank and this mode lights up.</div>
          </div>
        </div>
      );
    }
    return (
      <div className="anim-fadeup">
        <TopBar title="Distractor Assassin" onBack={onBack} feedback={{ screen: 'Distractor Assassin setup' }} solid />
        <div className="max-w-md mx-auto px-4 pt-2 pb-32">
          <Card className="p-5 mb-5 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${CRIMSON}, #6B0F2A)`, border: 'none' }}>
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <div className="relative flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
                <Crosshair size={26} color="#FFF" className="timer-beat" />
              </div>
              <div style={{ color: '#FFF' }}>
                <div className="font-display text-xl font-bold leading-tight">Hunt the wrong answers</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>Take out every distractor. But never strike the correct one. Learn why each is wrong.</div>
              </div>
            </div>
          </Card>

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many questions?</div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {COUNT_OPTIONS.map((c, i) => {
              const on = count === c;
              return (
                <button key={c} onClick={() => setCount(c)}
                        className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 anim-fadeup"
                        style={{ background: on ? CRIMSON : T.surface, color: on ? '#FFF' : T.ink,
                                 border: `1.5px solid ${on ? CRIMSON : T.border}`, boxShadow: on ? `0 8px 20px ${CRIMSON}44` : 'none',
                                 animationDelay: `${i * 60}ms` }}>
                  <div className="text-base leading-none">{c}</div>
                  <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>questions</div>
                </button>
              );
            })}
          </div>

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How it works</div>
          <div className="rounded-2xl p-3.5 mb-5 space-y-2" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
            {['Tap the options you are SURE are wrong', 'Each clean kill reveals why it is wrong', 'Never strike the correct answer'].map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ background: CRIMSON + '18', color: CRIMSON }}>{i + 1}</span>
                <span className="text-[12.5px] leading-snug" style={{ color: T.inkSoft }}>{s}</span>
              </div>
            ))}
          </div>

          <PaceSelector value={pace} onChange={onSetPace} T={T} />
          <div className="text-[11px] leading-relaxed px-1" style={{ color: T.muted }}>
            With <b style={{ color: '#16A34A' }}>The Pulse</b> on, each question gets a countdown. Run out and it locks.
            <b style={{ color: '#B45309' }}> Flashpoint</b> halves the clock and <b>doubles</b> the coins.
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
             style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={begin} size="lg" className="w-full" icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
              Start the hunt
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ──
  if (phase === 'done') {
    return (
      <div className="anim-fadeup">
        <TopBar title="Distractor Assassin" onBack={finish} />
        <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 q-pulse"
               style={{ background: T.success + '18', border: `1px solid ${T.success}44` }}>
            <Trophy size={28} style={{ color: T.success }} />
          </div>
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Hunt over</div>
          <div className="text-[14px] mb-2" style={{ color: T.inkSoft }}>
            <b style={{ color: T.ink }}>{killTotal}</b> distractors eliminated · <b style={{ color: T.ink }}>{perfects}</b> perfect rounds.
          </div>
          {coins > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full my-4 q-pulse"
                 style={{ background: '#F59E0B22', color: '#B45309' }}>
              <Coins size={15} /> +{coins} Coins{flashpoint ? ' · 2×' : ''}
            </div>
          )}
          <Button onClick={finish} size="lg" className="w-full mt-2" disabled={finished}>
            Finish
          </Button>
        </div>
      </div>
    );
  }

  // ── DRILL ──
  if (!q) return null;   // unreachable: the empty-bank state above already caught it
  const wrongMap = q.wrong || {};

  return (
    <div className="test-enter">
      {exitDialog}
      <TopBar title="Distractor Assassin" onBack={requestExit}
              right={<div className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full"
                          style={{ color: T.inkSoft, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                       {idx + 1} / {qs.length}
                     </div>} />
      <div className="max-w-md mx-auto px-4 pb-40 pt-3">

        {paceOn && (
          <PulseTimer budgetSec={budgetSec} resetKey={q.id} flashpoint={flashpoint}
                      onExpire={onTimeout} paused={locked} T={T} />
        )}

        {/* progress: distractors down */}
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} style={{ color: CRIMSON }} />
          <div className="flex items-center gap-1">
            {Array.from({ length: distractorCount }).map((_, i) => (
              <span key={i} className="w-5 h-1.5 rounded-full transition-all"
                    style={{ background: i < cleared ? CRIMSON : T.borderSoft }} />
            ))}
          </div>
          <span className="text-[11px] font-semibold ml-auto" style={{ color: T.muted }}>
            {cleared}/{distractorCount} down
          </span>
        </div>

        <div className="font-display text-[16px] leading-snug mb-4" style={{ color: T.ink }}>{q.q}</div>

        {/* options — tap to eliminate */}
        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            const isElim = eliminated.includes(i);
            const isCorrect = i === correctIdx;
            const revealCorrect = locked && isCorrect;
            const shotCorrect = hitCorrect && isCorrect;

            let bg = T.surface, border = T.border, color = T.ink, textDeco = 'none', opacity = 1;
            if (isElim) { bg = T.errorSoft; border = T.error; color = T.muted; textDeco = 'line-through'; opacity = 0.7; }
            else if (shotCorrect) { bg = T.errorSoft; border = T.error; }
            else if (revealCorrect) { bg = T.successSoft; border = T.success; }

            return (
              <div key={i} className="anim-fadeup" style={{ animationDelay: `${i * 40}ms` }}>
                <button onClick={() => shoot(i)} disabled={locked || isElim}
                        className="no-tap-highlight w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:scale-[0.99] transition"
                        style={{ background: bg, border: `1.5px solid ${border}`, opacity }}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: isElim ? T.error : revealCorrect ? T.success : shotCorrect ? T.error : T.surfaceWarm,
                                 color: (isElim || revealCorrect || shotCorrect) ? '#FFF' : T.muted }}>
                    {isElim ? <X size={14} /> : revealCorrect ? <Check size={14} /> : shotCorrect ? <Skull size={14} /> : String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-[14px] flex-1" style={{ color, textDecoration: textDeco }}>{opt}</span>
                  {!locked && !isElim && <Crosshair size={15} style={{ color: T.muted }} />}
                </button>
                {/* reveal the distractor's rationale right after the kill */}
                {isElim && wrongMap[i] && (
                  <div className="text-[12px] leading-relaxed px-3 py-2 mt-1 rounded-lg flex items-start gap-1.5"
                       style={{ background: T.surfaceWarm, color: T.inkSoft }}>
                    <X size={12} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
                    <span>{wrongMap[i]}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* round verdict */}
        {locked && (
          <Card className="p-4 mt-4 anim-fadeup"
                style={{ background: perfect ? T.successSoft : T.surfaceWarm,
                         border: `1px solid ${(perfect ? T.success : hitCorrect ? T.error : T.accent)}44` }}>
            <div className="flex items-center gap-2 mb-2">
              {perfect ? <Trophy size={16} style={{ color: T.success }} />
                : hitCorrect ? <Skull size={16} style={{ color: T.error }} />
                : <TimerOff size={16} style={{ color: T.accent }} />}
              <div className="font-display text-sm font-semibold" style={{ color: perfect ? T.success : hitCorrect ? T.error : T.accent }}>
                {perfect ? 'Perfect kill: every distractor down!' : hitCorrect ? 'You struck the correct answer' : 'Time’s up'}
              </div>
            </div>
            <div className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>
              <b style={{ color: T.success }}>Correct: </b>{q.options[correctIdx]}{q.exp ? `: ${q.exp}` : ''}
            </div>
          </Card>
        )}
      </div>

      {/* footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {locked ? (
            <Button onClick={next} size="lg" className="w-full" icon={<ChevronRight size={16} />}>
              {idx + 1 < qs.length ? 'Next target' : 'Finish'}
            </Button>
          ) : (
            <div className="text-center text-[12px] py-1.5" style={{ color: T.muted }}>Tap the options you’re sure are wrong</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DistractorAssassin;
