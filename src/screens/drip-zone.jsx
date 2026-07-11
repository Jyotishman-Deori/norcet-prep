// =====================================================================
// src/screens/drip-zone.jsx — DRIP ZONE, a closed-loop IV titration
// simulator. The player sets patient WEIGHT and drags a DOSE slider; the app
// derives the live IV pump RATE (mL/hr), drives simulated vitals that drift
// toward dose-dependent targets, and asks you to reach and HOLD the therapeutic
// window. Over-titration escalates a crisis alarm that can fail the round.
//
// ALL clinical / rate / zone / target / hold / crisis / score math lives in
// ../lib/titration-engine.js — this file NEVER computes a pump rate, a zone, a
// target vital, a hold, a crisis state or a coin. It only renders engine state,
// drives the pure step functions on a 500ms loop, and forwards the sliders.
// Drug data comes frozen from ../data/titration-drugs.js.
//
// Views (single file): intro → round → done.
//   intro  — pitch + run length (5 / All) + PaceSelector + flashpoint note.
//   round  — dark bedside monitor (zone-colored), pump chamber, dose/weight
//            sliders with the safe window marked, and the hold-to-win ring.
//   done   — rounds won / total, total coins, the played drugs' exam tips.
//
// Premium micro-interactions (spring entrances, zone-colour transitions, rate
// number tick, crisis pulse, win bloom, hold-ring fill) are all .dz-* keyframe
// classes in lib/font-styles.js, opted out under prefers-reduced-motion; every
// JS-driven motion / haptic / chime is gated by prefersReducedMotion() +
// isSoundEnabled() from lib/juice.js / lib/sound.js. onComplete(totalCoins)
// fires EXACTLY ONCE from the done view's Finish (guarded), mirroring
// ward-boss.jsx.
// =====================================================================
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Droplet, Play, ArrowRight, RotateCcw, Coins, Trophy, Check,
  AlertTriangle, HeartPulse, Lightbulb, Gauge, Zap, ShieldAlert, Scale,
} from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import ComboBurst, { useCombo } from '../ui/combo-burst.jsx';
import { normalizePace, paceFlags } from '../lib/pace.js';
import { prefersReducedMotion, haptic, HAPTIC } from '../lib/juice.js';
import { isSoundEnabled, playClearChime } from '../lib/sound.js';
import { TITRATION_DRUGS } from '../data/titration-drugs.js';
import BodyPortal from '../ui/body-portal.jsx';
import {
  pumpRate, zoneFor, trackTargets, stepVitals, tickHold, crisisState, roundScore,
} from '../lib/titration-engine.js';

// ── Fixed dark bedside-monitor palette (same family as ward-boss / icu-monitor,
// deliberately diverging from the app theme so the monitor reads like real ICU
// hardware regardless of light/dark mode). ──
const M = {
  bg: '#06100E', panel: '#0A1A16', border: '#0F2A24', borderSoft: '#12332B',
  ink: '#E6FFF6', muted: '#7C8B88', dim: '#5C6E6A',
  green: '#46F08A', cyan: '#67E8F9', amber: '#F59E0B', red: '#EF4444', redDeep: '#7F1D1D',
};

// ── Loop + crisis timing (presentation constants; NOT clinical rules). The
// 500ms tick is the sim heartbeat; crisisState thresholds below are in ms of
// CONTINUOUS time in the 'over' zone. Flashpoint drifts faster (tighter). ──
const TICK_MS = 500;
const ALARM_MS = 2500;   // 'over' this long → klaxon (recoverable)
const FAIL_MS = 6000;    // 'over' this long → round lost
const JITTER = 1.2;      // symmetric vitals jitter amplitude for stepVitals

// ── Zone → colour + kind, the one place the UI maps engine zones to the
// monitor palette. 'over' pulses red (static red border under reduced motion). ──
const ZONE = {
  under:       { color: M.amber, label: 'UNDER' },
  therapeutic: { color: M.green, label: 'THERAPEUTIC' },
  over:        { color: M.red,   label: 'OVER' },
};

// Format a track value with its unit (integers stay integer; decimals from the
// engine already carry one place). Never null — the loop always populates it.
function fmtVal(v) {
  if (!Number.isFinite(v)) return '--';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// A percentage position of `x` within [lo, hi], clamped to [0, 100].
function pct(x, lo, hi) {
  if (!(hi > lo)) return 0;
  return Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
}

// =====================================================================
// DripZone — the screen. Props: { onBack, onComplete, onSetPace }.
// onComplete(totalCoins) fires exactly once from the done view's Finish.
// =====================================================================
export default function DripZone({ onBack, onComplete, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const pace = normalizePace(data && data.preferences);
  const { flashpoint } = paceFlags(pace);

  const [view, setView] = useState('intro');       // intro | round | done
  const [soundOn, setSoundOn] = useState(true);
  const [runKey, setRunKey] = useState(0);          // bump to re-init the run

  // The shuffled run of drugs (fixed once a run starts; re-shuffled per run).
  const [run, setRun] = useState([]);
  const [results, setResults] = useState([]);       // per-round { won, enteredCrisis, coins, drug }

  // Kick off a run of `count` drugs (5 or all). Shuffle then slice.
  const startRun = useCallback((count) => {
    const shuffled = [...TITRATION_DRUGS].sort(() => Math.random() - 0.5);
    setRun(shuffled.slice(0, Math.min(count, shuffled.length)));
    setResults([]);
    setRunKey((k) => k + 1);
    setView('round');
  }, []);

  // Re-init in place from the done view ("Play again").
  const playAgain = useCallback(() => {
    startRun(run.length || 5);
  }, [run.length, startRun]);

  // ── INTRO ──
  if (view === 'intro') {
    return (
      <IntroView T={T} pace={pace} onSetPace={onSetPace} flashpoint={flashpoint}
                 onBack={onBack} onStart={startRun} />
    );
  }

  // ── DONE ──
  if (view === 'done') {
    return (
      <DoneView T={T} results={results} flashpoint={flashpoint}
                onPlayAgain={playAgain} onComplete={onComplete} onBack={onBack} />
    );
  }

  // ── ROUND (keyed so a fresh run fully remounts the loop) ──
  return (
    <RoundRunner key={runKey} T={T} run={run} flashpoint={flashpoint}
                 soundOn={soundOn} setSoundOn={setSoundOn}
                 onExit={onBack}
                 onFinishRun={(rs) => { setResults(rs); setView('done'); }} />
  );
}

// =====================================================================
// VIEW 1 — INTRO: the pitch, run length, pace + flashpoint note, Start.
// =====================================================================
const POOL = TITRATION_DRUGS.length;
const COUNT_OPTIONS = [5, POOL].filter((c, i, a) => c <= POOL && a.indexOf(c) === i);

function IntroView({ T, pace, onSetPace, flashpoint, onBack, onStart }) {
  const [count, setCount] = useState(Math.min(5, POOL));

  return (
    <div className="anim-fadeup">
      <TopBar title="Drip Zone" onBack={onBack} feedback={{ screen: 'Drip Zone intro' }} solid />
      <div className="max-w-md mx-auto px-4 pt-2 pb-40">

        {/* hero — infusion pump dossier */}
        <Card className="dz-round-in p-0 mb-5 overflow-hidden relative"
              style={{ background: M.bg, border: `1px solid ${M.border}` }}>
          <div className="px-4 py-4 relative" style={{ color: M.ink }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex w-11 h-11 rounded-2xl items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(103,232,249,0.12)', border: `1px solid ${M.border}` }}>
                <Droplet size={22} color={M.cyan} className="timer-beat" />
              </span>
              <div>
                <div className="font-display text-lg font-bold leading-tight">Drip Zone</div>
                <div className="text-[12px] mt-0.5" style={{ color: M.muted }}>
                  Titrate the drip. Hit the window. Hold it steady.
                </div>
              </div>
            </div>
            {/* under → therapeutic → over teaser */}
            <div className="flex items-center gap-1.5 mt-4">
              {[['UNDER', M.amber], ['THERAPEUTIC', M.green], ['OVER', M.red]].map(([lbl, c], i) => (
                <span key={lbl} className="dz-chip-in text-[9.5px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full"
                      style={{ background: c + '22', color: c, animationDelay: `${120 + i * 80}ms` }}>
                  {lbl}
                </span>
              ))}
            </div>
            <div className="text-[12px] mt-3 leading-relaxed" style={{ color: M.muted }}>
              Set the patient weight, drag the dose, and watch the pump rate and vitals respond.
              Over-titrate and the crisis alarm sounds. Hold the drip in the green to win the round.
            </div>
          </div>
        </Card>

        {/* how many drips */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many drips?</div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {COUNT_OPTIONS.map((c, i) => {
            const on = count === c;
            return (
              <button key={c} onClick={() => setCount(c)}
                      className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 dz-round-in"
                      style={{ background: on ? T.primary : T.surface, color: on ? '#FFF' : T.ink,
                               border: `1.5px solid ${on ? T.primary : T.border}`,
                               boxShadow: on ? `0 8px 20px ${T.primary}44` : 'none', animationDelay: `${i * 60}ms` }}>
                <div className="text-base leading-none">{c === POOL ? `All ${POOL}` : c}</div>
                <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>
                  {c === POOL ? 'the full set' : 'drips'}
                </div>
              </button>
            );
          })}
        </div>

        {/* pace + flashpoint note */}
        <PaceSelector value={pace} onChange={onSetPace} T={T} />
        <div className="flex items-start gap-1.5 text-[11px] leading-relaxed px-1 mt-1" style={{ color: T.muted }}>
          <Zap size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} />
          <span><b style={{ color: '#B45309' }}>Flashpoint:</b> faster vitals drift, double coins.</span>
        </div>
      </div>

      {/* Start */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          <Button onClick={() => onStart(count)} size="lg" className="w-full"
                  icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
            Start · {count === POOL ? `All ${POOL}` : count} {count === 1 ? 'drip' : 'drips'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// RoundRunner — owns the run cursor + accumulated per-round results, and
// mounts one RoundView per drug. Kept separate so RoundView can be keyed by
// drug id and fully reset its sim loop between drugs.
// =====================================================================
function RoundRunner({ T, run, flashpoint, soundOn, setSoundOn, onExit, onFinishRun }) {
  const [idx, setIdx] = useState(0);
  const resultsRef = useRef([]);

  const drug = run[idx];

  // Advance to the next drug, or finish the run once the last is scored.
  const onRoundDone = useCallback((res) => {
    resultsRef.current = [...resultsRef.current, res];
    if (idx + 1 >= run.length) {
      onFinishRun(resultsRef.current);
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, run.length, onFinishRun]);

  if (!drug) return null;

  return (
    <RoundView key={drug.id} T={T} drug={drug} roundNo={idx + 1} total={run.length}
               flashpoint={flashpoint} soundOn={soundOn} setSoundOn={setSoundOn}
               onExit={onExit} onNext={onRoundDone} />
  );
}

// =====================================================================
// VIEW 2 — ROUND: the core titration loop for a single drug.
// =====================================================================
function RoundView({ T, drug, roundNo, total, flashpoint, soundOn, setSoundOn, onExit, onNext }) {
  const reduced = prefersReducedMotion();

  // ── Player controls ──
  const [dose, setDose] = useState(drug.doseMin);
  const [weight, setWeight] = useState(drug.weightDefault);

  // ── Sim state (values drift; hold + over accumulate in ms) ──
  const [vitals, setVitals] = useState(() => {
    // Seed at the dose-0 baseline so the numbers start believable.
    const seed = {};
    for (const t of drug.tracks) seed[t.key] = t.base;
    return seed;
  });
  const [holdMs, setHoldMs] = useState(0);
  const [overMs, setOverMs] = useState(0);

  // ── Outcome + transient beats (pure presentation) ──
  const [outcome, setOutcome] = useState(null);   // null | 'won' | 'fail'
  const [enteredCrisis, setEnteredCrisis] = useState(false);
  const [winBloomKey, setWinBloomKey] = useState(0);
  const [failShakeKey, setFailShakeKey] = useState(0);
  const [rateTickKey, setRateTickKey] = useState(0);

  const { flash: comboFlash, hit: comboHit, reset: comboReset } = useCombo();

  // ── Derived, all from the engine (no clinical math here) ──
  const rate = pumpRate(dose, weight, drug);
  const zone = zoneFor(dose, drug);
  const zoneMeta = ZONE[zone] || ZONE.therapeutic;

  // Refs the interval reads (so the loop effect doesn't re-arm every tick).
  const doseRef = useRef(dose); doseRef.current = dose;
  const weightRef = useRef(weight); weightRef.current = weight;
  const outcomeRef = useRef(outcome); outcomeRef.current = outcome;
  const enteredCrisisRef = useRef(enteredCrisis); enteredCrisisRef.current = enteredCrisis;
  const prevRateRef = useRef(rate);

  // Crisis level from continuous over-time (engine).
  const crisis = crisisState(overMs, ALARM_MS, FAIL_MS);

  // ── Rate number tick: spring-bump the mL/hr readout whenever the rate moves. ──
  useEffect(() => {
    if (rate !== prevRateRef.current) {
      prevRateRef.current = rate;
      if (!reduced) setRateTickKey((k) => k + 1);
    }
  }, [rate, reduced]);

  // ── THE SIM LOOP — one 500ms heartbeat drives targets → vitals, hold, and
  // over-time. It stays FUNCTIONAL under reduced motion: instead of drifting we
  // snap the vitals to target each tick, so the numbers always update. All state
  // math is engine-owned; the loop just injects the frame delta + rng. ──
  const flashMul = flashpoint ? 1.7 : 1;   // faster drift + over-accrual on flashpoint
  useEffect(() => {
    if (outcome) return undefined;   // freeze the loop once the round resolves
    const id = setInterval(() => {
      if (outcomeRef.current) return;
      const d = doseRef.current;
      const z = zoneFor(d, drug);
      const targets = trackTargets(d, drug);

      // Vitals: drift (or snap under reduced motion) toward the dose targets.
      setVitals((cur) => reduced ? { ...targets } : stepVitals(cur, targets, Math.random, JITTER));

      // Hold-to-win: grows only in the therapeutic band; leaving resets it.
      setHoldMs((prev) => {
        const res = tickHold({ holdMs: prev }, z, TICK_MS, drug.holdSec);
        if (res.won && !outcomeRef.current) {
          // WIN — resolve exactly once from inside the loop.
          setOutcome('won');
          setWinBloomKey((k) => k + 1);
          comboHit();
          haptic(HAPTIC.COMBO);
          if (soundOn && !reduced && isSoundEnabled()) { try { playClearChime(3, 2); } catch (e) {} }
        }
        return res.holdMs;
      });

      // Over-time: continuous ms in the 'over' zone (resets on leaving 'over').
      setOverMs((prev) => {
        const nextOver = z === 'over' ? prev + TICK_MS * flashMul : 0;
        const cs = crisisState(nextOver, ALARM_MS, FAIL_MS);
        if (cs !== 'ok' && !enteredCrisisRef.current) {
          setEnteredCrisis(true);
          enteredCrisisRef.current = true;
          haptic(HAPTIC.INVALID);
        }
        if (cs === 'fail' && !outcomeRef.current) {
          setOutcome('fail');
          setFailShakeKey((k) => k + 1);
          haptic(HAPTIC.INVALID);
        }
        return nextOver;
      });
    }, TICK_MS);
    return () => clearInterval(id);
    // Re-arm only when the round resolves / core identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, drug, reduced, soundOn, flashMul]);

  // ── Score this round via the engine, then hand back to the runner. ──
  // One-shot: a rapid double-tap on "Next drip" must not log (and pay) the
  // same round twice. The component remounts per drug, so the ref resets.
  const advancedRef = useRef(false);
  const advance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    const won = outcomeRef.current === 'won';
    const coins = roundScore({ won, enteredCrisis: enteredCrisisRef.current, flashpoint });
    onNext({ won, enteredCrisis: enteredCrisisRef.current, coins, drug });
  }, [drug, flashpoint, onNext]);

  // Hold progress (0..1) for the ring/bar.
  const holdFrac = Math.max(0, Math.min(1, holdMs / (drug.holdSec * 1000)));
  const holdSecShown = Math.min(drug.holdSec, holdMs / 1000);

  // Monitor frame: zone colour; 'over' pulses (static red under reduced motion).
  const framePulse = !reduced && (zone === 'over' || crisis !== 'ok') ? 'dz-alarm-pulse' : '';
  const failShaking = !reduced && outcome === 'fail' ? 'dz-fail-shake' : '';

  return (
    <div className="dz-round-in" style={{ minHeight: '100vh', background: T.bg }}>
      <ComboBurst flash={comboFlash} />

      <TopBar title="Drip Zone" onBack={onExit}
              right={
                <button onClick={() => setSoundOn((s) => !s)}
                        aria-label={soundOn ? 'Mute alarms' : 'Unmute alarms'}
                        className="no-tap-highlight text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ color: soundOn ? M.green : T.muted, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                  {soundOn ? 'Sound on' : 'Muted'}
                </button>
              } />

      <div className="max-w-md mx-auto px-4 pb-44 pt-2">

        {/* round counter + goal */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-1 rounded"
                style={{ background: T.primary + '1F', color: T.primary }}>
            Drip {roundNo} of {total}
          </span>
          <span className="font-display text-[15px] font-bold" style={{ color: T.ink }}>{drug.name}</span>
        </div>

        {/* ── MONITOR CARD (dark palette; zone-colored border + status) ── */}
        <div className={`relative rounded-2xl overflow-hidden mb-4 ${framePulse} ${failShaking}`}
             style={{
               border: `1.5px solid ${zoneMeta.color}`,
               transition: 'border-color 0.5s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.4s ease',
               // Static red glow when over/in-crisis under reduced motion (colour is not the only signal — status text below also says OVER).
               boxShadow: reduced && (zone === 'over' || crisis !== 'ok') ? `0 0 0 2px ${M.red}, inset 0 0 24px ${M.red}55` : 'none',
             }}>
          {/* Win bloom overlay (green radial, one-shot) */}
          {!reduced && outcome === 'won' && (
            <div key={winBloomKey} className="dz-win-bloom absolute inset-0 z-10 pointer-events-none" aria-hidden="true"
                 style={{ background: `radial-gradient(circle at 50% 45%, ${M.green}AA 0%, transparent 60%)` }} />
          )}

          {/* status line */}
          <div className="px-4 pt-3 pb-2" style={{ background: M.bg }}>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: zoneMeta.color }}>
                <span className={`w-1.5 h-1.5 rounded-full ${!reduced && zone === 'over' ? 'timer-beat-fast' : ''}`}
                      style={{ background: zoneMeta.color }} />
                {zoneMeta.label}
              </span>
              {crisis === 'alarm' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: '#FCA5A5' }}>
                  <AlertTriangle size={12} className={reduced ? '' : 'timer-beat-fast'} /> Alarm
                </span>
              )}
            </div>
            <div className="text-[12.5px] font-semibold mt-1 leading-snug" style={{ color: M.ink }}>
              {drug.zoneLabels[zone]}
            </div>
          </div>

          {/* live drifting tracks (big + tabular) */}
          <div className="px-4 py-3 grid gap-3" style={{ background: M.bg, gridTemplateColumns: `repeat(${Math.min(drug.tracks.length, 2)}, minmax(0, 1fr))` }}>
            {drug.tracks.map((t) => {
              const v = vitals[t.key];
              const alarmHit = Number.isFinite(v) && (v <= t.alarmLow || v >= t.alarmHigh);
              const color = alarmHit ? M.red : (zone === 'therapeutic' ? M.green : M.ink);
              return (
                <div key={t.key} className="flex flex-col leading-none">
                  <span className="text-[9px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: M.muted }}>
                    {t.label}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span key={reduced ? undefined : `${t.key}-${Math.round(Number(v) || 0)}`}
                          className={`font-display text-3xl font-bold tabular-nums ${reduced ? '' : 'dz-vital-tick'}`}
                          style={{ color, transition: 'color 0.4s ease' }}>
                      {fmtVal(v)}
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: M.muted }}>{t.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PUMP CARD (rate + mix + drip chamber) ── */}
        <div className="rounded-2xl p-4 mb-4 flex items-center gap-4"
             style={{ background: M.panel, border: `1px solid ${M.border}` }}>
          <DripChamber rate={rate} reduced={reduced} color={zoneMeta.color} />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: M.muted }}>Pump rate</div>
            <div className="flex items-baseline gap-1.5">
              <span key={reduced ? undefined : rateTickKey}
                    className={`font-display text-3xl font-bold tabular-nums ${reduced ? '' : 'dz-rate-tick'}`}
                    style={{ color: M.cyan }}>
                {fmtVal(rate)}
              </span>
              <span className="text-xs font-semibold" style={{ color: M.muted }}>mL/hr</span>
            </div>
            <div className="text-[11px] mt-1.5 leading-snug" style={{ color: M.muted }}>{drug.mix}</div>
          </div>
        </div>

        {/* ── HOLD-TO-WIN ── */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: M.panel, border: `1px solid ${M.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: zone === 'therapeutic' ? M.green : M.muted }}>
              <Gauge size={12} /> Hold the window
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: zone === 'therapeutic' ? M.green : M.muted }}>
              {holdSecShown.toFixed(1)} / {drug.holdSec}s
            </span>
          </div>
          <div className={`h-2.5 w-full rounded-full overflow-hidden ${zone === 'therapeutic' && !reduced ? 'dz-hold-pulse' : ''}`}
               style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div style={{
              width: `${holdFrac * 100}%`, height: '100%',
              background: zone === 'therapeutic' ? M.green : M.amber,
              transition: 'width 0.5s linear, background 0.4s ease',
            }} />
          </div>
          {zone !== 'therapeutic' && holdMs === 0 && (
            <div className="text-[11px] mt-2 leading-snug" style={{ color: M.muted }}>
              {zone === 'under' ? 'Raise the dose into the green band, then hold it steady.'
                                : 'Ease the dose back down into the green band.'}
            </div>
          )}
          {crisis === 'alarm' && (
            <div className="flex items-start gap-1.5 text-[11.5px] mt-2 leading-snug" style={{ color: '#FCA5A5' }}>
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              <span>Over-titrated: back off now or the patient will crash.</span>
            </div>
          )}
        </div>

        {/* ── CONTROLS (goal + dose + weight sliders) ── */}
        <div className="rounded-2xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-start gap-2 mb-4">
            <ShieldAlert size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
            <div className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>{drug.goal}</div>
          </div>

          {/* DOSE — with the safe window marked as a green band segment */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="dz-dose" className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>Dose</label>
              <span className="text-sm font-bold tabular-nums" style={{ color: zoneMeta.color }}>
                {dose} {drug.unitLabel}
              </span>
            </div>
            {/* safe-window band under the slider (pure CSS, positioned by %) */}
            <div className="relative h-2 rounded-full mb-1.5" style={{ background: 'rgba(0,0,0,0.06)' }}>
              <div className="absolute top-0 bottom-0 rounded-full" style={{
                left: `${pct(drug.safeWindow[0], drug.doseMin, drug.doseMax)}%`,
                right: `${100 - pct(drug.safeWindow[1], drug.doseMin, drug.doseMax)}%`,
                background: M.green + '99',
              }} aria-hidden="true" />
            </div>
            <input id="dz-dose" type="range"
                   min={drug.doseMin} max={drug.doseMax} step={drug.doseStep} value={dose}
                   onChange={(e) => setDose(Number(e.target.value))}
                   disabled={!!outcome}
                   className="w-full"
                   aria-label={`Dose, ${dose} ${drug.unitLabel}, currently ${zoneMeta.label.toLowerCase()} the therapeutic window`}
                   style={{ accentColor: zoneMeta.color }} />
            <div className="flex items-center justify-between text-[9.5px] mt-0.5" style={{ color: T.muted }}>
              <span>{drug.doseMin}</span>
              <span style={{ color: M.green }}>safe {drug.safeWindow[0]}–{drug.safeWindow[1]}</span>
              <span>{drug.doseMax}</span>
            </div>
          </div>

          {/* WEIGHT */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="dz-weight" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>
                <Scale size={11} /> Patient weight
              </label>
              <span className="text-sm font-bold tabular-nums" style={{ color: T.ink }}>{weight} kg</span>
            </div>
            <input id="dz-weight" type="range"
                   min={drug.weightRange[0]} max={drug.weightRange[1]} step={1} value={weight}
                   onChange={(e) => setWeight(Number(e.target.value))}
                   disabled={!!outcome}
                   className="w-full"
                   aria-label={`Patient weight, ${weight} kilograms`}
                   style={{ accentColor: T.primary }} />
            <div className="flex items-center justify-between text-[9.5px] mt-0.5" style={{ color: T.muted }}>
              <span>{drug.weightRange[0]} kg</span>
              <span>{drug.weightRange[1]} kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── OUTCOME SHEET (win card / fail card) ── */}
      {outcome && (
        <OutcomeSheet T={T} drug={drug} outcome={outcome} reduced={reduced}
                      roundNo={roundNo} total={total} onNext={advance} />
      )}
    </div>
  );
}

// =====================================================================
// DripChamber — a small CSS drip animation whose drop interval tracks the pump
// rate (faster rate → shorter interval). Steady/hidden under reduced motion.
// =====================================================================
function DripChamber({ rate, reduced, color }) {
  // Map rate (mL/hr) to a drop interval in seconds: faster infusion drips
  // faster. Clamped to a readable 0.4s–2.2s window. Pure presentation.
  const dripSec = useMemo(() => {
    const r = Number.isFinite(rate) ? rate : 0;
    if (r <= 0) return 0;                       // no flow → no drip
    return Math.max(0.4, Math.min(2.2, 60 / Math.max(4, r)));
  }, [rate]);

  return (
    <div className="relative flex-shrink-0 rounded-xl overflow-hidden"
         style={{ width: 42, height: 62, background: M.bg, border: `1px solid ${M.border}` }}>
      {/* chamber inlet */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1 w-2 h-2 rounded-b-full" style={{ background: color, opacity: 0.5 }} />
      {/* the falling drop (steady when reduced or no flow → show a static dot) */}
      {dripSec > 0 && !reduced ? (
        <div className="dz-drip absolute left-1/2 -translate-x-1/2 top-3 w-1.5 h-2 rounded-full"
             style={{ background: color, animationDuration: `${dripSec}s` }} aria-hidden="true" />
      ) : (
        <div className="absolute left-1/2 -translate-x-1/2 top-3 w-1.5 h-2 rounded-full"
             style={{ background: color, opacity: dripSec > 0 ? 1 : 0.25 }} aria-hidden="true" />
      )}
      {/* reservoir + ripple */}
      <div className="absolute bottom-0 left-0 right-0 h-4" style={{ background: color + '22', borderTop: `1px solid ${color}55` }} />
      {dripSec > 0 && !reduced && (
        <div className="dz-ripple absolute bottom-1 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full"
             style={{ background: color + '55', animationDuration: `${dripSec}s` }} aria-hidden="true" />
      )}
    </div>
  );
}

// =====================================================================
// OutcomeSheet — the per-round result: green win card (examTip) or a red
// crisis-fail card (rationale). Both offer a single "Next" that scores + moves
// on via the runner. Docked at the bottom so it reads like a monitor overlay.
// =====================================================================
function OutcomeSheet({ T, drug, outcome, reduced, roundNo, total, onNext }) {
  const won = outcome === 'won';
  const last = roundNo >= total;
  const tint = won ? M.green : M.red;
  return (
    <BodyPortal>
    <div className="fixed inset-0 z-40 flex flex-col justify-end"
         style={{ background: 'rgba(4,10,9,0.55)', backdropFilter: 'blur(2px)' }}>
      <div className={`${reduced ? '' : 'sheet-up'} max-w-md mx-auto w-full px-4 pb-4`}>
        <Card className="p-5 overflow-hidden" style={{ background: M.bg, border: `1.5px solid ${tint}66` }}>
          {/* headline */}
          <div className="flex items-center gap-3 mb-3">
            <span className={`inline-flex w-12 h-12 rounded-2xl items-center justify-center flex-shrink-0 ${reduced ? '' : (won ? 'dz-result-bloom' : 'dz-fail-shake')}`}
                  style={{ background: won ? M.green + '1F' : M.redDeep, border: `1px solid ${tint}66` }}>
              {won ? <Trophy size={24} style={{ color: M.green }} />
                   : <HeartPulse size={24} color={M.red} className={reduced ? '' : 'timer-beat'} />}
            </span>
            <div>
              <div className="font-display text-lg font-bold leading-tight" style={{ color: M.ink }}>
                {won ? 'Held the window' : 'The patient crashed'}
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: M.muted }}>
                {won ? `${drug.zoneLabels.therapeutic}` : `${drug.zoneLabels.over}`}
              </div>
            </div>
          </div>

          {/* teaching text: examTip on a win, rationale on a fail */}
          <div className="rounded-xl p-3.5 mb-4"
               style={{ background: won ? '#F59E0B14' : M.panel, border: `1px solid ${won ? '#F59E0B44' : M.border}` }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              {won ? <Lightbulb size={14} style={{ color: '#F59E0B' }} />
                   : <AlertTriangle size={14} style={{ color: M.red }} />}
              <span className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: won ? '#F59E0B' : '#FCA5A5' }}>
                {won ? 'Exam tip' : 'What went wrong'}
              </span>
            </div>
            <div className="text-[12.5px] leading-relaxed" style={{ color: M.ink }}>
              {won ? drug.examTip : drug.rationale}
            </div>
          </div>

          <Button onClick={onNext} size="lg" className="w-full"
                  icon={last ? <Check size={16} /> : <ArrowRight size={16} />}>
            {last ? 'See results' : 'Next drip'}
          </Button>
        </Card>
      </div>
    </div>
    </BodyPortal>
  );
}

// =====================================================================
// VIEW 3 — DONE: rounds won/total, total coins, played drugs' exam tips.
// "Play again" re-inits in place; "Finish" fires onComplete(totalCoins) once.
// =====================================================================
function DoneView({ T, results, flashpoint, onPlayAgain, onComplete, onBack }) {
  const reduced = prefersReducedMotion();
  const [finished, setFinished] = useState(false);

  const wonCount = results.filter((r) => r.won).length;
  const totalCoins = useMemo(() => results.reduce((s, r) => s + (Number.isFinite(r.coins) ? r.coins : 0), 0), [results]);
  const allWon = results.length > 0 && wonCount === results.length;

  // Finish: fire onComplete exactly once, then lock.
  const finish = useCallback(() => {
    if (finished) return;
    setFinished(true);
    try { if (onComplete) onComplete(totalCoins); } catch (e) {}
  }, [finished, onComplete, totalCoins]);

  return (
    <div className="anim-fadeup" style={{ minHeight: '100vh', background: T.bg }}>
      <TopBar title="Drip Zone" onBack={onBack} />
      <div className="max-w-md mx-auto px-4 pt-6 pb-32">

        {/* headline */}
        <div className="text-center mb-6">
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${reduced ? '' : 'dz-result-bloom'}`}
               style={{ background: allWon ? '#22C55E1F' : T.successSoft, border: `1px solid ${allWon ? '#22C55E66' : T.border}` }}>
            <Trophy size={30} style={{ color: allWon ? '#22C55E' : T.primary }} />
          </div>
          <div className="font-display text-2xl font-bold mb-1.5" style={{ color: T.ink }}>
            {allWon ? 'Every drip, held steady' : wonCount > 0 ? 'Rounds cleared' : 'Rough shift'}
          </div>
          <div className="text-[13.5px] leading-relaxed max-w-sm mx-auto" style={{ color: T.inkSoft }}>
            You held the therapeutic window on {wonCount} of {results.length} {results.length === 1 ? 'drip' : 'drips'}.
          </div>
        </div>

        {/* coins */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3.5 py-1.5 rounded-full"
               style={{ background: '#F59E0B22', color: '#B45309' }}>
            <Coins size={15} /> +{totalCoins} Coins{flashpoint ? ' · 2×' : ''}
          </div>
        </div>

        {/* per-drip roll + exam tips */}
        <div className="space-y-2.5">
          {results.map((r, i) => (
            <div key={r.drug.id} className="rounded-2xl p-4"
                 style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex w-5 h-5 rounded-full items-center justify-center flex-shrink-0"
                      style={{ background: r.won ? '#22C55E22' : M.red + '22' }}>
                  {r.won ? <Check size={12} style={{ color: '#22C55E' }} />
                         : <AlertTriangle size={12} style={{ color: M.red }} />}
                </span>
                <span className="font-display text-sm font-semibold flex-1 min-w-0" style={{ color: T.ink }}>{r.drug.name}</span>
                {r.coins > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: '#F59E0B1F', color: '#B45309' }}>
                    <Coins size={10} /> {r.coins}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-1.5 text-[12px] leading-relaxed pl-0.5" style={{ color: T.muted }}>
                <Lightbulb size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} />
                <span>{r.drug.examTip}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* footer — Play again + Finish */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={onPlayAgain} disabled={finished}
                  className="no-tap-highlight flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold active:scale-[0.98] transition disabled:opacity-40"
                  style={{ background: T.surface, color: T.ink, border: `1.5px solid ${T.border}` }}>
            <RotateCcw size={15} /> Play again
          </button>
          <Button onClick={finish} size="lg" className="flex-1" disabled={finished}>
            Finish
          </Button>
        </div>
      </div>
    </div>
  );
}
