// =====================================================================
// src/screens/wave-hunter.jsx — WAVE HUNTER, the third clinical-simulation
// game (sibling to Ward Boss + Drip Zone): a calibrated-ECG caliper lab. The
// student sees a real graticule (25 mm/s, 1 small box = 0.04 s), drags TWO
// vertical calipers across the strip to measure the asked interval (PR / QRS /
// R-R / QT), and Check validates the measured span against the derived truth.
//
// ALL geometry / calibration / validation lives in ../lib/caliper-engine.js —
// this file NEVER computes an interval, a rate, a tolerance, a ghost span or a
// clamp. It builds the strip via buildCalibratedStrip, formats seconds via
// unitsToSec / rateFromRR, and scores via measureTruth + validateMeasurement +
// truthSpan. Task data comes frozen from ../data/caliper-tasks.js.
//
// Views (single file): intro → task → done.
//   intro — pitch + calibration primer + count (5 / All) + Pace + Start.
//   task  — question card, the calibrated SVG strip with two draggable calipers,
//           a live readout chip, a11y nudge controls, a zoom toggle, Check
//           (one attempt) → correct (bloom + reveal) or wrong (ghost calipers +
//           box-counting hint + reveal). Flashpoint adds a per-task countdown.
//   done  — score X/N, total coins, per-task ✓/✗ recap (measured vs true).
//
// Premium micro-interactions (caliper handle pop, readout tick, ghost fade-in,
// success bloom, recap stagger, timer glow) are all .whx-* keyframe classes in
// lib/font-styles.js and are opted out under prefers-reduced-motion; every
// JS-driven motion / haptic / chime is gated by prefersReducedMotion() +
// isSoundEnabled(). onComplete(totalCoins) fires EXACTLY ONCE from the done
// view's Finish (guarded), mirroring ward-boss.jsx / drip-zone.jsx.
// =====================================================================
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Ruler, Play, ArrowRight, RotateCcw, Coins, Trophy, Check, X,
  Activity, Lightbulb, Zap, TimerOff, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Search, TimerReset,
} from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import ComboBurst, { useCombo } from '../ui/combo-burst.jsx';
import { normalizePace, paceFlags } from '../lib/pace.js';
import { prefersReducedMotion, haptic, HAPTIC } from '../lib/juice.js';
import { isSoundEnabled, playClearChime } from '../lib/sound.js';
import { CALIPER_TASKS } from '../data/caliper-tasks.js';
import {
  PX_PER_BOX, SEC_PER_BOX, HEIGHT_UNITS, BASELINE_Y,
  unitsToSec, secToUnits, rateFromRR,
  buildCalibratedStrip, measureTruth, truthSpan,
  validateMeasurement, clampCaliper, validateTask,
} from '../lib/caliper-engine.js';

// ── Fixed dark bedside-monitor palette (same family as ward-boss / drip-zone /
// icu-monitor, deliberately diverging from the app theme so the monitor reads
// like real ECG-paper hardware regardless of light/dark mode). ──
const M = {
  bg: '#06100E', panel: '#0A1A16', border: '#0F2A24', borderSoft: '#12332B',
  ink: '#E6FFF6', muted: '#7C8B88', dim: '#5C6E6A',
  green: '#46F08A', cyan: '#67E8F9', amber: '#F59E0B', red: '#EF4444', redDeep: '#7F1D1D',
};

// ── Presentation constants (NOT clinical rules — all interval math is engine). ──
const COINS_PER_TASK = 15;               // base payout for a correct read
const FLASHPOINT_SEC = 14;               // per-task countdown when Flashpoint is on
const NUDGE_FINE = 1;                    // ‹ / › — one SVG unit
const NUDGE_BOX = PX_PER_BOX;            // ‹‹ / ›› — one small box (8 units)

// Ask-type display metadata (label + one-word noun for the readout / recap).
const ASK_META = {
  pr:  { label: 'PR interval',  short: 'PR' },
  qrs: { label: 'QRS duration', short: 'QRS' },
  rr:  { label: 'R–R interval', short: 'R–R' },
  qt:  { label: 'QT interval',  short: 'QT' },
};
const askMeta = (ask) => ASK_META[ask] || { label: 'Interval', short: 'Interval' };

// Format a span of SVG units as "0.18 s · 4.5 small boxes" (all via the engine).
// One decimal on seconds; boxes to one place (a box = SEC_PER_BOX seconds).
function fmtSpan(units) {
  const sec = unitsToSec(Math.max(0, units));
  const boxes = sec / SEC_PER_BOX;
  return { sec, boxes, secStr: `${sec.toFixed(2)} s`, boxStr: `${boxes.toFixed(1)} small boxes` };
}

// =====================================================================
// WaveHunter — the screen. Props: { onBack, onComplete, onSetPace }.
// onComplete(totalCoins) fires exactly once from the done view's Finish.
// =====================================================================
export default function WaveHunter({ onBack, onComplete, onSetPace }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const pace = normalizePace(data && data.preferences);
  const { flashpoint } = paceFlags(pace);

  const [view, setView] = useState('intro');       // intro | task | done
  const [soundOn, setSoundOn] = useState(true);
  const [runKey, setRunKey] = useState(0);          // bump to re-init the run

  const [run, setRun] = useState([]);               // the ordered task list for this run
  const [results, setResults] = useState([]);       // per-task { task, ok, measuredSec, truthSec, direction, coins }

  // Kick off a run of `count` tasks. Shuffle then slice (like Drip Zone) so a
  // partial run samples the WHOLE pool — otherwise a "5" run would always be
  // the same first five and the rest of the library would never appear.
  const startRun = useCallback((count) => {
    const shuffled = [...CALIPER_TASKS].sort(() => Math.random() - 0.5);
    setRun(shuffled.slice(0, Math.min(count, shuffled.length)));
    setResults([]);
    setRunKey((k) => k + 1);
    setView('task');
  }, []);

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

  // ── TASK (keyed so a fresh run fully remounts the runner) ──
  return (
    <TaskRunner key={runKey} T={T} run={run} flashpoint={flashpoint}
                soundOn={soundOn} setSoundOn={setSoundOn}
                onExit={onBack}
                onFinishRun={(rs) => { setResults(rs); setView('done'); }} />
  );
}

// =====================================================================
// VIEW 1 — INTRO: the pitch, calibration primer, count, Pace + flashpoint, Start.
// =====================================================================
const POOL = CALIPER_TASKS.length;
const COUNT_OPTIONS = [5, POOL].filter((c, i, a) => c <= POOL && a.indexOf(c) === i);

function IntroView({ T, pace, onSetPace, flashpoint, onBack, onStart }) {
  const [count, setCount] = useState(Math.min(5, POOL));

  return (
    <div className="anim-fadeup">
      <TopBar title="Wave Hunter" onBack={onBack} feedback={{ screen: 'Wave Hunter intro' }} solid />
      <div className="max-w-md mx-auto px-4 pt-2 pb-40">

        {/* hero — caliper lab dossier */}
        <Card className="whx-task-in p-0 mb-5 overflow-hidden relative"
              style={{ background: M.bg, border: `1px solid ${M.border}` }}>
          <div className="px-4 py-4 relative" style={{ color: M.ink }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex w-11 h-11 rounded-2xl items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(103,232,249,0.12)', border: `1px solid ${M.border}` }}>
                <Ruler size={22} color={M.cyan} className="timer-beat" />
              </span>
              <div>
                <div className="font-display text-lg font-bold leading-tight">Wave Hunter</div>
                <div className="text-[12px] mt-0.5" style={{ color: M.muted }}>
                  Real nurses measure, they don&apos;t guess. Grab the calipers.
                </div>
              </div>
            </div>
            {/* interval-type teaser */}
            <div className="flex items-center gap-1.5 mt-4">
              {[['PR', M.cyan], ['QRS', M.green], ['R–R', M.amber], ['QT', '#A78BFA']].map(([lbl, c], i) => (
                <span key={lbl} className="whx-chip-in text-[9.5px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full"
                      style={{ background: c + '22', color: c, animationDelay: `${120 + i * 80}ms` }}>
                  {lbl}
                </span>
              ))}
            </div>
            {/* calibration primer */}
            <div className="flex items-start gap-2 mt-4 rounded-xl px-3 py-2.5"
                 style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${M.borderSoft}` }}>
              <Activity size={14} className="flex-shrink-0 mt-0.5" style={{ color: M.green }} />
              <div className="text-[11.5px] leading-relaxed" style={{ color: M.ink }}>
                1 small box = <b style={{ color: M.green }}>0.04 s</b> · rate = <b style={{ color: M.amber }}>1500 ÷ small boxes</b> between beats.
              </div>
            </div>
            <div className="text-[12px] mt-3 leading-relaxed" style={{ color: M.muted }}>
              Drag the two calipers to bracket the interval you&apos;re asked for, then Check. Count the
              boxes — the paper never lies.
            </div>
          </div>
        </Card>

        {/* how many strips */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many strips?</div>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {COUNT_OPTIONS.map((c, i) => {
            const on = count === c;
            return (
              <button key={c} onClick={() => setCount(c)}
                      className="no-tap-highlight py-3 rounded-xl font-semibold transition-all active:scale-95 whx-task-in"
                      style={{ background: on ? T.primary : T.surface, color: on ? '#FFF' : T.ink,
                               border: `1.5px solid ${on ? T.primary : T.border}`,
                               boxShadow: on ? `0 8px 20px ${T.primary}44` : 'none', animationDelay: `${i * 60}ms` }}>
                <div className="text-base leading-none">{c === POOL ? `All ${POOL}` : c}</div>
                <div className="text-[10px] mt-1 font-medium" style={{ color: on ? 'rgba(255,255,255,0.8)' : T.muted }}>
                  {c === POOL ? 'the full set' : 'strips'}
                </div>
              </button>
            );
          })}
        </div>

        {/* pace + flashpoint note */}
        <PaceSelector value={pace} onChange={onSetPace} T={T} />
        <div className="flex items-start gap-1.5 text-[11px] leading-relaxed px-1 mt-1" style={{ color: T.muted }}>
          <Zap size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} />
          <span><b style={{ color: '#B45309' }}>Flashpoint:</b> beat the clock, double coins.</span>
        </div>
      </div>

      {/* Start */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          <Button onClick={() => onStart(count)} size="lg" className="w-full"
                  icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
            Start · {count === POOL ? `All ${POOL}` : count} {count === 1 ? 'strip' : 'strips'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// TaskRunner — owns the run cursor + accumulated per-task results, and mounts
// one TaskView per task (keyed by task id so its caliper state fully resets).
// =====================================================================
function TaskRunner({ T, run, flashpoint, soundOn, setSoundOn, onExit, onFinishRun }) {
  const [idx, setIdx] = useState(0);
  const resultsRef = useRef([]);

  const task = run[idx];

  const onTaskDone = useCallback((res) => {
    resultsRef.current = [...resultsRef.current, res];
    if (idx + 1 >= run.length) {
      onFinishRun(resultsRef.current);
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, run.length, onFinishRun]);

  if (!task) return null;

  return (
    <TaskView key={task.id} T={T} task={task} taskNo={idx + 1} total={run.length}
              flashpoint={flashpoint} soundOn={soundOn} setSoundOn={setSoundOn}
              onExit={onExit} onNext={onTaskDone} />
  );
}

// =====================================================================
// VIEW 2 — TASK: the core caliper-measurement loop for a single task.
// =====================================================================
function TaskView({ T, task, taskNo, total, flashpoint, soundOn, setSoundOn, onExit, onNext }) {
  const reduced = prefersReducedMotion();
  const meta = askMeta(task.ask);

  // ── Strip geometry (ALL from the engine — never computed here). ──
  const strip = useMemo(() => buildCalibratedStrip(task.strip, task.windowSec), [task]);
  const widthUnits = strip.widthUnits;

  // ── Truth (derived once from the engine) ──
  const truthSec = useMemo(() => measureTruth(task), [task]);
  const ghost = useMemo(() => truthSpan(task, strip.features), [task, strip.features]);

  // ── Caliper positions (SVG units, x1 < x2). Seeded to a readable third/two-
  // thirds of the window so both handles are on-screen and clearly apart. ──
  const [x1, setX1] = useState(() => Math.round(widthUnits * 0.34));
  const [x2, setX2] = useState(() => Math.round(widthUnits * 0.62));
  const [selected, setSelected] = useState(null);   // null | 'a' | 'b' — which caliper the nudges drive
  const [zoom, setZoom] = useState(1);               // 1× | 2× viewbox scale (presentation only)

  // ── Attempt state (ONE Check per task, like icu-monitor) ──
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState(null);        // { ok, errorSec, direction } from validateMeasurement
  const [timedOut, setTimedOut] = useState(false);

  // ── Transient presentation beats ──
  const [bloomKey, setBloomKey] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [readoutKey, setReadoutKey] = useState(0);
  const [handlePop, setHandlePop] = useState(null);  // 'a' | 'b' | null — which handle to pop
  const [flashLeft, setFlashLeft] = useState(flashpoint ? FLASHPOINT_SEC : 0);

  const { flash: comboFlash, hit: comboHit, miss: comboMiss } = useCombo();

  // Live measured span (units → seconds via engine).
  const spanUnits = Math.abs(x2 - x1);
  const span = fmtSpan(spanUnits);
  const bpm = task.ask === 'rr' ? rateFromRR(span.sec) : null;

  // Refs so the flashpoint timer / pointer handlers read fresh values.
  const checkedRef = useRef(checked); checkedRef.current = checked;

  // ── Readout tick + handle pop when the span changes (decorative only). ──
  const prevSpanRef = useRef(spanUnits);
  useEffect(() => {
    if (spanUnits !== prevSpanRef.current) {
      prevSpanRef.current = spanUnits;
      if (!reduced) setReadoutKey((k) => k + 1);
    }
  }, [spanUnits, reduced]);

  // ── FLASHPOINT COUNTDOWN — only under flashpoint (no timer in normal pace).
  // A timeout resolves the task as WRONG with a 'time' note. Stays functional
  // under reduced motion (the numeric seconds carry it; only the bar glow is
  // gated). ──
  useEffect(() => {
    if (!flashpoint || checked) return undefined;
    const tick = setInterval(() => setFlashLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    const expire = setTimeout(() => {
      if (checkedRef.current) return;
      // Resolve as a timeout: score against truth so the reveal still teaches.
      resolve(true);
    }, FLASHPOINT_SEC * 1000);
    return () => { clearInterval(tick); clearTimeout(expire); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashpoint, checked]);

  // ── Drag one caliper via native pointer events. `side` is 'a' (left) or 'b'
  // (right); clampCaliper (engine) keeps x1 < x2 and inside [0, widthUnits]. ──
  const svgRef = useRef(null);
  const dragRef = useRef(null);   // { side, capId } while dragging

  // Convert a client pointer X into SVG user units (accounts for the current
  // rendered width; zoom only changes the on-screen scale, not the unit space).
  const clientToUnits = useCallback((clientX) => {
    const el = svgRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0)) return 0;
    const frac = (clientX - rect.left) / rect.width;
    return frac * widthUnits;
  }, [widthUnits]);

  const beginDrag = useCallback((side, e) => {
    if (checkedRef.current) return;
    e.preventDefault();
    const capId = e.pointerId;
    try { e.currentTarget.setPointerCapture(capId); } catch (err) {}
    dragRef.current = { side, capId };
    setSelected(side);
    setHandlePop(side);
    if (!reduced) setTimeout(() => setHandlePop(null), 300);
    haptic(HAPTIC.PLACE);
  }, [reduced]);

  const moveDrag = useCallback((e) => {
    const d = dragRef.current;
    if (!d || checkedRef.current) return;
    const u = clientToUnits(e.clientX);
    // clampCaliper's `side` is which side THIS caliper must stay on: the left
    // caliper ('a') stays left of its partner, the right ('b') stays right.
    if (d.side === 'a') {
      setX1(clampCaliper(u, x2, 0, widthUnits, 'left'));
    } else {
      setX2(clampCaliper(u, x1, 0, widthUnits, 'right'));
    }
  }, [clientToUnits, x1, x2, widthUnits]);

  const endDrag = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    try { e.currentTarget.releasePointerCapture(d.capId); } catch (err) {}
    dragRef.current = null;
  }, []);

  // ── A11y / precision nudge: move the SELECTED caliper by ±delta units. ──
  const nudge = useCallback((delta) => {
    if (checkedRef.current) return;
    const side = selected || 'a';
    setSelected(side);
    setHandlePop(side);
    if (!reduced) setTimeout(() => setHandlePop(null), 300);
    haptic(HAPTIC.PLACE);
    if (side === 'a') {
      setX1(clampCaliper(x1 + delta, x2, 0, widthUnits, 'left'));
    } else {
      setX2(clampCaliper(x2 + delta, x1, 0, widthUnits, 'right'));
    }
  }, [selected, x1, x2, widthUnits, reduced]);

  // ── Resolve the attempt (Check tap OR flashpoint timeout). One-shot. ──
  const resolve = useCallback((viaTimeout) => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    const measuredSec = unitsToSec(Math.abs(x2 - x1));
    const res = validateMeasurement(measuredSec, truthSec, task.tolSec);
    // A timeout is always scored as a miss even if the span happened to land.
    const ok = !viaTimeout && !!res.ok;
    setChecked(true);
    setResult(res);
    setTimedOut(!!viaTimeout);

    if (ok) {
      setBloomKey((k) => k + 1);
      comboHit();
      haptic(HAPTIC.COMBO);
      if (soundOn && !reduced && isSoundEnabled()) { try { playClearChime(3, 2); } catch (e) {} }
    } else {
      setShakeKey((k) => k + 1);
      comboMiss();
      haptic(HAPTIC.INVALID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x1, x2, truthSec, task.tolSec, soundOn, reduced, comboHit, comboMiss]);

  // ── Advance: score coins (engine result), then hand back to the runner.
  // One-shot guard so a double-tap on Next can't log/pay twice. ──
  const advancedRef = useRef(false);
  const advance = useCallback(() => {
    if (advancedRef.current || !checked) return;
    advancedRef.current = true;
    const ok = !timedOut && result && result.ok;
    const coins = ok ? COINS_PER_TASK * (flashpoint ? 2 : 1) : 0;
    onNext({
      task,
      ok: !!ok,
      measuredSec: unitsToSec(Math.abs(x2 - x1)),
      truthSec,
      direction: result ? result.direction : 'exact',
      errorSec: result ? result.errorSec : 0,
      timedOut,
      coins,
    });
  }, [checked, timedOut, result, flashpoint, task, x1, x2, truthSec, onNext]);

  const ok = checked && !timedOut && result && result.ok;
  const last = taskNo >= total;

  return (
    <div className="whx-task-in" style={{ minHeight: '100vh', background: T.bg }}>
      <ComboBurst flash={comboFlash} />

      <TopBar title="Wave Hunter" onBack={onExit}
              right={
                <button onClick={() => setSoundOn((s) => !s)}
                        aria-label={soundOn ? 'Mute chimes' : 'Unmute chimes'}
                        className="no-tap-highlight text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ color: soundOn ? M.green : T.muted, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                  {soundOn ? 'Sound on' : 'Muted'}
                </button>
              } />

      <div className="max-w-md mx-auto px-4 pb-44 pt-2">

        {/* task counter + title */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-1 rounded"
                style={{ background: T.primary + '1F', color: T.primary }}>
            Strip {taskNo} of {total}
          </span>
          <span className="font-display text-[15px] font-bold" style={{ color: T.ink }}>{task.title}</span>
        </div>

        {/* ── QUESTION CARD ── */}
        <div className="rounded-2xl px-4 py-3.5 mb-4"
             style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
          <div className="flex items-start gap-2">
            <Search size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
            <div className="text-[13.5px] leading-relaxed" style={{ color: T.inkSoft }}>{task.question}</div>
          </div>
        </div>

        {/* ── FLASHPOINT TIMER (only under flashpoint) ── */}
        {flashpoint && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: M.amber }}>
                <Zap size={12} /> Beat the clock
              </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: flashLeft <= 4 ? M.red : M.amber }}>
                {checked ? '—' : `${flashLeft}s`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              {reduced || checked ? (
                <div style={{ width: `${(flashLeft / FLASHPOINT_SEC) * 100}%`, height: '100%', background: flashLeft <= 4 ? M.red : M.amber }} />
              ) : (
                <div key={`ft-${task.id}`} className="whx-timer-glow"
                     style={{ height: '100%', background: M.amber, animation: `wbShrink ${FLASHPOINT_SEC}s linear forwards` }} />
              )}
            </div>
          </div>
        )}

        {/* ── THE STRIP ── */}
        <CaliperStrip
          strip={strip} task={task} T={T} reduced={reduced}
          x1={x1} x2={x2} widthUnits={widthUnits} zoom={zoom}
          selected={selected} setSelected={setSelected} handlePop={handlePop}
          checked={checked} ok={ok} bloomKey={bloomKey} shakeKey={shakeKey}
          ghost={ghost}
          svgRef={svgRef}
          onHandleDown={beginDrag} onHandleMove={moveDrag} onHandleUp={endDrag}
        />

        {/* ── LIVE READOUT CHIP + ZOOM ── */}
        <div className="flex items-center gap-2 mt-3 mb-4">
          <div key={reduced ? undefined : readoutKey}
               className={`flex-1 inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 ${reduced ? '' : 'whx-readout-tick'}`}
               style={{ background: M.panel, border: `1px solid ${M.border}` }}
               aria-live="polite">
            <Ruler size={15} style={{ color: M.cyan }} className="flex-shrink-0" />
            <span className="font-display text-base font-bold tabular-nums" style={{ color: M.ink }}>{span.secStr}</span>
            <span className="text-[11px]" style={{ color: M.muted }}>· {span.boxStr}</span>
            {bpm != null && Number.isFinite(bpm) && (
              <span className="ml-auto text-[12px] font-bold tabular-nums" style={{ color: M.amber }}>
                → {Math.round(bpm)} bpm
              </span>
            )}
          </div>
          {/* zoom toggle (presentation only — same unit space) */}
          <button onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                  aria-label={zoom === 1 ? 'Zoom in to 2×' : 'Zoom out to 1×'} aria-pressed={zoom === 2}
                  className="no-tap-highlight flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-bold tabular-nums active:scale-95 transition"
                  style={{ background: zoom === 2 ? M.cyan + '22' : M.panel, color: zoom === 2 ? M.cyan : M.muted, border: `1px solid ${zoom === 2 ? M.cyan + '66' : M.border}` }}>
            {zoom}×
          </button>
        </div>

        {/* ── A11y / PRECISION NUDGE CONTROLS ── */}
        {!checked && (
          <div className="rounded-2xl p-3.5 mb-2" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>Nudge caliper</span>
              {/* which caliper the nudges drive — tap a handle on the strip or here */}
              <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                {[['a', 'Left'], ['b', 'Right']].map(([side, lbl]) => {
                  const on = (selected || 'a') === side;
                  return (
                    <button key={side} onClick={() => setSelected(side)} aria-pressed={on}
                            className="no-tap-highlight px-3 py-1 text-[11px] font-bold transition"
                            style={{ background: on ? T.primary : 'transparent', color: on ? '#FFF' : T.muted }}>
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { d: -NUDGE_BOX,  Icon: ChevronsLeft,  aria: 'Move caliper left one box' },
                { d: -NUDGE_FINE, Icon: ChevronLeft,   aria: 'Move caliper left one unit' },
                { d: NUDGE_FINE,  Icon: ChevronRight,  aria: 'Move caliper right one unit' },
                { d: NUDGE_BOX,   Icon: ChevronsRight, aria: 'Move caliper right one box' },
              ].map(({ d, Icon, aria }) => (
                <button key={aria} onClick={() => nudge(d)} aria-label={aria}
                        className="no-tap-highlight flex items-center justify-center py-2.5 rounded-xl active:scale-90 transition"
                        style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.ink }}>
                  <Icon size={18} />
                </button>
              ))}
            </div>
            <div className="text-[10.5px] text-center mt-2" style={{ color: T.muted }}>
              ‹ ›  fine (one unit) · ‹‹ ››  one box (0.04&nbsp;s)
            </div>
          </div>
        )}

        {/* ── REVEAL CARD (after Check / timeout) ── */}
        {checked && (
          <RevealCard T={T} task={task} reduced={reduced}
                      ok={ok} timedOut={timedOut} result={result}
                      measuredSec={unitsToSec(Math.abs(x2 - x1))} truthSec={truthSec}
                      bpm={task.ask === 'rr' ? rateFromRR(unitsToSec(Math.abs(x2 - x1))) : null} />
        )}
      </div>

      {/* ── FOOTER: Check (one attempt) → Next ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {!checked ? (
            <Button onClick={() => resolve(false)} size="lg" className="w-full"
                    icon={<Check size={16} />}>
              Check measurement
            </Button>
          ) : (
            <Button onClick={advance} size="lg" className="w-full"
                    icon={last ? <Trophy size={16} /> : <ArrowRight size={16} />}>
              {last ? 'See results' : 'Next strip'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// CaliperStrip — the calibrated ECG SVG: graticule + trace + two draggable
// calipers (+ shaded band) + optional ghost calipers on a wrong answer.
// viewBox is `0 0 widthUnits HEIGHT_UNITS`; zoom only scales the RENDERED width
// (the unit space and every engine value are unchanged). All geometry is passed
// in — this renders it, it never measures.
// =====================================================================
function CaliperStrip({
  strip, task, T, reduced, x1, x2, widthUnits, zoom,
  selected, setSelected, handlePop, checked, ok, bloomKey, shakeKey, ghost,
  svgRef, onHandleDown, onHandleMove, onHandleUp,
}) {
  // Small-box grid every PX_PER_BOX units; heavier line every 5th box (a big
  // box = 0.2 s = 1 large square on real ECG paper). Built once per width.
  const grid = useMemo(() => {
    const vlines = [];
    for (let x = 0; x <= widthUnits + 0.5; x += PX_PER_BOX) {
      const big = Math.round(x / PX_PER_BOX) % 5 === 0;
      vlines.push({ x, big });
    }
    const hlines = [];
    for (let y = 0; y <= HEIGHT_UNITS + 0.5; y += PX_PER_BOX) {
      const big = Math.round(y / PX_PER_BOX) % 5 === 0;
      hlines.push({ y, big });
    }
    return { vlines, hlines };
  }, [widthUnits]);

  // 44px-equivalent invisible pointer target, expressed in SVG units so it
  // scales with the strip. (44 real px ≈ this many units at the rendered width.)
  const HIT = Math.max(PX_PER_BOX * 2, widthUnits * 0.045);

  // Amber accent for line grids/trace; caliper accents from the palette.
  const trace = M.green;
  const bandTint = ok ? M.green : M.cyan;   // neutral cyan normally; green ONLY after a correct check (never leaks truth mid-drag)

  const handleR = 7;

  // A single draggable caliper (vertical line + top handle + invisible hit rect).
  const Caliper = ({ side, x, color }) => {
    const isSel = (selected || 'a') === side;
    const popped = handlePop === side;
    return (
      <g>
        {/* the vertical line, top → bottom */}
        <line x1={x} y1={0} x2={x} y2={HEIGHT_UNITS} stroke={color}
              strokeWidth={isSel ? 2.4 : 1.8} vectorEffect="non-scaling-stroke"
              strokeDasharray={isSel ? 'none' : 'none'} opacity={0.95} />
        {/* round grab handle at the top */}
        <g className={!reduced && popped ? 'whx-handle-pop' : ''} style={{ transformOrigin: `${x}px 10px`, transformBox: 'fill-box' }}>
          <circle cx={x} cy={10} r={handleR} fill={color} stroke={M.bg} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {isSel && <circle cx={x} cy={10} r={handleR + 3} fill="none" stroke={color} strokeWidth={1.4} opacity={0.5} vectorEffect="non-scaling-stroke" />}
        </g>
        {/* INVISIBLE 44px-ish pointer target over the whole line */}
        {!checked && (
          <rect x={x - HIT / 2} y={0} width={HIT} height={HEIGHT_UNITS} fill="transparent"
                style={{ cursor: 'ew-resize' }}
                onPointerDown={(e) => onHandleDown(side, e)}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp} />
        )}
      </g>
    );
  };

  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);

  return (
    <div className="relative rounded-2xl overflow-hidden"
         style={{ background: M.bg, border: `1.5px solid ${ok ? M.green : M.border}`, boxShadow: 'inset 0 0 44px rgba(0,0,0,0.6)', transition: 'border-color 0.4s ease' }}>
      {/* success bloom (one-shot, correct only) */}
      {!reduced && ok && (
        <div key={bloomKey} className="whx-bloom absolute inset-0 z-10 pointer-events-none" aria-hidden="true"
             style={{ background: `radial-gradient(circle at 50% 45%, ${M.green}88 0%, transparent 60%)` }} />
      )}

      {/* horizontally scrollable when zoomed so 2× stays usable on a phone */}
      <div style={{ overflowX: zoom > 1 ? 'auto' : 'hidden', WebkitOverflowScrolling: 'touch' }}
           className={!reduced && checked && !ok ? 'whx-shake' : ''} key={checked && !ok ? shakeKey : undefined}>
        <svg ref={svgRef} viewBox={`0 0 ${widthUnits} ${HEIGHT_UNITS}`}
             preserveAspectRatio="none"
             style={{ display: 'block', width: `${zoom * 100}%`, height: 210, touchAction: 'none' }}>

          {/* ── GRATICULE — light small boxes, heavier big-box lines ── */}
          <g>
            {grid.vlines.map((v, i) => (
              <line key={`v${i}`} x1={v.x} y1={0} x2={v.x} y2={HEIGHT_UNITS}
                    stroke={trace} strokeWidth={v.big ? 0.9 : 0.4}
                    opacity={v.big ? 0.22 : 0.1} vectorEffect="non-scaling-stroke" />
            ))}
            {grid.hlines.map((h, i) => (
              <line key={`h${i}`} x1={0} y1={h.y} x2={widthUnits} y2={h.y}
                    stroke={trace} strokeWidth={h.big ? 0.9 : 0.4}
                    opacity={h.big ? 0.22 : 0.1} vectorEffect="non-scaling-stroke" />
            ))}
          </g>

          {/* ── MEASURED BAND (neutral cyan; green ONLY after a correct check) ── */}
          <rect x={lo} y={0} width={Math.max(0, hi - lo)} height={HEIGHT_UNITS}
                fill={bandTint} opacity={ok ? 0.14 : 0.08} pointerEvents="none" />

          {/* ── THE CALIBRATED TRACE (monitor green) ── */}
          <path d={strip.pathD} fill="none" stroke={trace} strokeWidth={2.2}
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0 0 3px ${trace}aa)` }} />

          {/* ── GHOST CALIPERS (wrong answer only) — dashed amber true span ── */}
          {checked && !ok && ghost && (
            <g className={reduced ? '' : 'whx-ghost-in'} aria-hidden="true">
              <rect x={Math.min(ghost.x1, ghost.x2)} y={0}
                    width={Math.abs(ghost.x2 - ghost.x1)} height={HEIGHT_UNITS}
                    fill={M.amber} opacity={0.12} />
              {[ghost.x1, ghost.x2].map((gx, i) => (
                <g key={i}>
                  <line x1={gx} y1={0} x2={gx} y2={HEIGHT_UNITS} stroke={M.amber}
                        strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                  <circle cx={gx} cy={10} r={5.5} fill={M.amber} stroke={M.bg} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </g>
          )}

          {/* ── THE TWO PLAYER CALIPERS (drawn last so handles sit on top) ── */}
          <Caliper side="a" x={x1} color={M.cyan} />
          <Caliper side="b" x={x2} color={M.cyan} />
        </svg>
      </div>

      {/* calibration footnote on the strip face */}
      <div className="absolute bottom-1.5 left-2.5 text-[8.5px] font-semibold tracking-wide pointer-events-none"
           style={{ color: M.dim }}>
        25 mm/s · 1 small box = 0.04 s
      </div>
      {ghost && checked && !ok && (
        <div className="absolute bottom-1.5 right-2.5 inline-flex items-center gap-1 text-[8.5px] font-bold pointer-events-none"
             style={{ color: M.amber }}>
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: M.amber }} /> true span
        </div>
      )}
    </div>
  );
}

// =====================================================================
// RevealCard — the per-task result after a Check (or a flashpoint timeout).
//   correct : green card + verdict.label + rationale + examTip.
//   wrong   : amber card + "you measured … / true is …" delta line + box-
//             counting hint + verdict.label + rationale + examTip.
// All numbers come from the engine result (errorSec / direction); this only
// formats them. No interval math here.
// =====================================================================
function RevealCard({ T, task, reduced, ok, timedOut, result, measuredSec, truthSec, bpm }) {
  const meta = askMeta(task.ask);
  const tint = ok ? M.green : M.amber;

  // Delta line from the engine's errorSec + direction (never recomputed).
  const errSec = result && Number.isFinite(result.errorSec) ? Math.abs(result.errorSec) : Math.abs(measuredSec - truthSec);
  const errBoxes = errSec / SEC_PER_BOX;
  const dir = result ? result.direction : 'exact';
  const dirWord = dir === 'long' ? 'too long' : dir === 'short' ? 'too short' : 'off';

  const verdict = task.verdict || {};
  const truthBpm = task.ask === 'rr' ? rateFromRR(truthSec) : null;

  return (
    <Card className={`p-4 overflow-hidden ${reduced ? '' : 'whx-task-in'}`}
          style={{ background: M.bg, border: `1.5px solid ${tint}66` }}>
      {/* headline */}
      <div className="flex items-center gap-3 mb-3">
        <span className={`inline-flex w-11 h-11 rounded-2xl items-center justify-center flex-shrink-0 ${reduced ? '' : (ok ? 'whx-result-bloom' : 'whx-shake')}`}
              style={{ background: ok ? M.green + '1F' : M.amber + '1F', border: `1px solid ${tint}66` }}>
          {ok ? <Check size={22} style={{ color: M.green }} />
              : timedOut ? <TimerOff size={22} style={{ color: M.amber }} />
              : <X size={22} style={{ color: M.amber }} />}
        </span>
        <div className="min-w-0">
          <div className="font-display text-lg font-bold leading-tight" style={{ color: M.ink }}>
            {ok ? 'Measured it' : timedOut ? 'Time ran out' : 'Off the mark'}
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: M.muted }}>
            {ok ? `Right on the ${meta.short}.` : `Line up the ${meta.short} and count the boxes.`}
          </div>
        </div>
      </div>

      {/* measured vs true — the delta line (from engine errorSec/direction) */}
      <div className="rounded-xl px-3.5 py-3 mb-3"
           style={{ background: M.panel, border: `1px solid ${M.border}` }}>
        <div className="flex items-center justify-between text-[12.5px]">
          <span style={{ color: M.muted }}>You measured</span>
          <span className="font-display font-bold tabular-nums" style={{ color: ok ? M.green : M.amber }}>
            {measuredSec.toFixed(2)} s
          </span>
        </div>
        <div className="flex items-center justify-between text-[12.5px] mt-1.5">
          <span style={{ color: M.muted }}>True {meta.short}</span>
          <span className="font-display font-bold tabular-nums" style={{ color: M.green }}>
            {truthSec.toFixed(2)} s{truthBpm != null && Number.isFinite(truthBpm) ? ` · ${Math.round(truthBpm)} bpm` : ''}
          </span>
        </div>
        {!ok && (
          <div className="text-[12px] leading-relaxed mt-2.5 pt-2.5" style={{ color: M.ink, borderTop: `1px solid ${M.border}` }}>
            You measured {measuredSec.toFixed(2)} s — the true interval is {truthSec.toFixed(2)} s
            {dir !== 'exact' ? ` (${dirWord} by ${errBoxes.toFixed(1)} ${errBoxes === 1 ? 'box' : 'boxes'})` : ''}.
            <span className="block mt-1" style={{ color: M.muted }}>
              Count the small boxes across the interval, then ×0.04 s.
            </span>
          </div>
        )}
      </div>

      {/* clinical verdict (normal range + label) */}
      {(verdict.label || (Array.isArray(verdict.normal) && verdict.normal.length === 2)) && (
        <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 mb-3"
             style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${M.borderSoft}` }}>
          <Activity size={14} className="flex-shrink-0" style={{ color: M.cyan }} />
          <div className="text-[12.5px] leading-snug" style={{ color: M.ink }}>
            {verdict.label}
            {Array.isArray(verdict.normal) && verdict.normal.length === 2 && (
              <span style={{ color: M.muted }}> · normal {verdict.normal[0]}–{verdict.normal[1]} s</span>
            )}
          </div>
        </div>
      )}

      {/* rationale */}
      {task.rationale && (
        <div className="text-[12.5px] leading-relaxed mb-3" style={{ color: M.ink }}>{task.rationale}</div>
      )}

      {/* exam tip */}
      {task.examTip && (
        <div className="rounded-xl px-3.5 py-3" style={{ background: '#F59E0B14', border: '1px solid #F59E0B44' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb size={13} style={{ color: '#F59E0B' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#F59E0B' }}>Exam tip</span>
          </div>
          <div className="text-[12.5px] leading-relaxed" style={{ color: M.ink }}>{task.examTip}</div>
        </div>
      )}
    </Card>
  );
}

// =====================================================================
// VIEW 3 — DONE: score X/N, total coins, per-task ✓/✗ recap (measured vs true).
// "Play again" re-inits in place; "Finish" fires onComplete(totalCoins) once.
// =====================================================================
function DoneView({ T, results, flashpoint, onPlayAgain, onComplete, onBack }) {
  const reduced = prefersReducedMotion();
  const [finished, setFinished] = useState(false);

  const rightCount = results.filter((r) => r.ok).length;
  const totalCoins = useMemo(() => results.reduce((s, r) => s + (Number.isFinite(r.coins) ? r.coins : 0), 0), [results]);
  const allRight = results.length > 0 && rightCount === results.length;

  const finish = useCallback(() => {
    if (finished) return;
    setFinished(true);
    try { if (onComplete) onComplete(totalCoins); } catch (e) {}
  }, [finished, onComplete, totalCoins]);

  return (
    <div className="anim-fadeup" style={{ minHeight: '100vh', background: T.bg }}>
      <TopBar title="Wave Hunter" onBack={onBack} />
      <div className="max-w-md mx-auto px-4 pt-6 pb-32">

        {/* headline */}
        <div className="text-center mb-6">
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${reduced ? '' : 'whx-result-bloom'}`}
               style={{ background: allRight ? '#22C55E1F' : T.successSoft, border: `1px solid ${allRight ? '#22C55E66' : T.border}` }}>
            <Trophy size={30} style={{ color: allRight ? '#22C55E' : T.primary }} />
          </div>
          <div className="font-display text-2xl font-bold mb-1.5" style={{ color: T.ink }}>
            {allRight ? 'Every wave, measured' : rightCount > 0 ? 'Calipers down' : 'Keep counting boxes'}
          </div>
          <div className="text-[13.5px] leading-relaxed max-w-sm mx-auto" style={{ color: T.inkSoft }}>
            You nailed {rightCount} of {results.length} {results.length === 1 ? 'measurement' : 'measurements'}.
          </div>
        </div>

        {/* coins */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3.5 py-1.5 rounded-full"
               style={{ background: '#F59E0B22', color: '#B45309' }}>
            <Coins size={15} /> +{totalCoins} Coins{flashpoint ? ' · 2×' : ''}
          </div>
        </div>

        {/* per-task recap: measured vs true */}
        <div className="space-y-2.5">
          {results.map((r, i) => {
            const meta = askMeta(r.task.ask);
            return (
              <div key={r.task.id} className={`rounded-2xl p-4 ${reduced ? '' : 'whx-recap-in'}`}
                   style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}`, animationDelay: `${Math.min(i, 10) * 55}ms` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex w-5 h-5 rounded-full items-center justify-center flex-shrink-0"
                        style={{ background: r.ok ? '#22C55E22' : M.amber + '22' }}>
                    {r.ok ? <Check size={12} style={{ color: '#22C55E' }} />
                          : r.timedOut ? <TimerOff size={12} style={{ color: M.amber }} />
                          : <X size={12} style={{ color: M.amber }} />}
                  </span>
                  <span className="font-display text-sm font-semibold flex-1 min-w-0" style={{ color: T.ink }}>{r.task.title}</span>
                  {r.coins > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: '#F59E0B1F', color: '#B45309' }}>
                      <Coins size={10} /> {r.coins}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[12px] pl-7" style={{ color: T.muted }}>
                  <span>Yours <b className="tabular-nums" style={{ color: r.ok ? '#16A34A' : T.inkSoft }}>{r.measuredSec.toFixed(2)} s</b></span>
                  <span>·</span>
                  <span>True <b className="tabular-nums" style={{ color: '#16A34A' }}>{r.truthSec.toFixed(2)} s</b></span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide font-semibold" style={{ color: T.dim || T.muted }}>{meta.short}</span>
                </div>
              </div>
            );
          })}
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
