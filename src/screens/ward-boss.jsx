// =====================================================================
// src/screens/ward-boss.jsx — WARD BOSS, the flagship clinical-simulation
// game: a 4-phase deteriorating-patient FSM (The Simmer → The Complication →
// Chaos → Final Boss). The screen renders a live bedside monitor (scrolling
// ECG + drifting vitals + a stability bar), an ASSESS / INTERVENE / COMMUNICATE
// action palette, a chaos decision timer, and a strict boss-sequence gauntlet,
// then a warm/compassionate debrief.
//
// ALL game rules live in ../lib/ward-boss-engine.js — this file NEVER computes
// XP, stability, phase advance, win/loss, boss order, or vitals drift. It only
// renders engine state and forwards taps/timeouts to the engine. Scenario data
// comes frozen from ../data/ward-boss-scenarios.js.
//
// Views: pick → brief → run → debrief.
//   pick    — "case file" scenario picker (mystery titles + best-coins badges)
//   brief   — patient handoff card (name/age/history/intro/vitals preview)
//   run     — monitor header + action palette / chaos timer / boss gauntlet
//   debrief — win celebration OR compassionate loss, full log, exam tip, coins
//
// Premium micro-interactions (spring entrances, point chips, phase sweeps,
// alarm escalation, boss flash) are all defined as .wb-* keyframe classes in
// lib/font-styles.js and are opted out under prefers-reduced-motion; JS-driven
// motion is gated by prefersReducedMotion() from lib/juice.js.
// =====================================================================
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Activity, HeartPulse, Droplet, Gauge, Wind, Thermometer, ShieldAlert,
  Play, ArrowLeft, ChevronRight, Coins, Trophy, Check, X, Stethoscope,
  MessageSquare, Search, Syringe, AlertTriangle, Skull, TimerOff, Lightbulb,
  Zap, RotateCcw, Lock,
} from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import PaceSelector from '../ui/pace-selector.jsx';
import EcgMonitor from '../ui/ecg-monitor.jsx';
import ComboBurst, { useCombo } from '../ui/combo-burst.jsx';
import { useExitGuard } from '../ui/use-exit-guard.jsx';
import { ECG_RHYTHMS } from '../data/ecg-rhythms.js';
import { createMonitorAudio } from '../lib/ecg-audio.js';
import { normalizePace, paceFlags } from '../lib/pace.js';
import { prefersReducedMotion, haptic, HAPTIC } from '../lib/juice.js';
import { isSoundEnabled, playClearChime } from '../lib/sound.js';
import { WARD_BOSS_SCENARIOS } from '../data/ward-boss-scenarios.js';
import {
  initRun, currentPhase, isBossPhase, visibleActions, bossOptions,
  applyAction, applyTimeout, stepVitals, scoreRun,
} from '../lib/ward-boss-engine.js';

// ── Fixed dark bedside-monitor palette (same family as icu-monitor, allowed to
// diverge from the app theme so the monitor reads like real ICU hardware). ──
const M = {
  bg: '#06100E', panel: '#0A1A16', border: '#0F2A24', borderSoft: '#12332B',
  ink: '#E6FFF6', muted: '#7C8B88', dim: '#5C6E6A',
  green: '#46F08A', cyan: '#67E8F9', amber: '#F59E0B', red: '#EF4444', redDeep: '#7F1D1D',
};
const FLASH_RED = '#DC2626';

// Category accent colours for the case-file picker (cosmetic grouping only).
const CAT_TINT = {
  'Cardiac': '#EF4444',
  'Respiratory': '#38BDF8',
  'Neuro': '#A78BFA',
  'Endocrine & Metabolic': '#F59E0B',
  'OB & Neonatal': '#EC4899',
  'Shock, Tox & Transfusion': '#F97316',
  'Renal & Electrolytes': '#14B8A6',
};
const catTint = (c) => CAT_TINT[c] || M.green;

// Vitals readout metadata — icon + colour + display suffix. Order matches the
// engine's VITAL_KEYS-ish reading order the monitor should show.
const VITAL_META = [
  { key: 'hr', label: 'HR', icon: HeartPulse, unit: 'bpm', color: M.green },
  { key: 'sbp', label: 'SBP', icon: Gauge, unit: '', color: M.ink, pair: 'dbp' },
  { key: 'spo2', label: 'SpO₂', icon: Droplet, unit: '%', color: M.cyan },
  { key: 'rr', label: 'RR', icon: Wind, unit: '/min', color: M.ink },
  { key: 'temp', label: 'Temp', icon: Thermometer, unit: '°C', color: M.amber },
];

// Category icon for the ASSESS / INTERVENE / COMMUNICATE groups.
const CAT_ICON = { assess: Search, intervene: Syringe, communicate: MessageSquare };
const CAT_LABEL = { assess: 'Assess', intervene: 'Intervene', communicate: 'Communicate' };

// Look up the ECG rhythm object (for EcgMonitor) by a phase's ecgId. Returns
// null when the phase has no ecgId — the strip then hides gracefully.
function rhythmFor(ecgId) {
  if (!ecgId) return null;
  return ECG_RHYTHMS.find((r) => r.id === ecgId) || null;
}

// Difficulty dots (1..3).
function DifficultyDots({ level, color }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Difficulty ${level} of 3`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className="w-1.5 h-1.5 rounded-full"
              style={{ background: n <= level ? color : 'currentColor', opacity: n <= level ? 1 : 0.25 }} />
      ))}
    </span>
  );
}

// =====================================================================
// WardBoss — the screen. See the header comment for the props contract.
// =====================================================================
export default function WardBoss({ onBack, onComplete, onSetPace, onRecordBest, bests }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const pace = normalizePace(data && data.preferences);
  const { flashpoint } = paceFlags(pace);

  const [view, setView] = useState('pick');           // pick | brief | run | debrief
  const [scenario, setScenario] = useState(null);
  const [soundOn, setSoundOn] = useState(true);

  const start = useCallback((sc) => { setScenario(sc); setView('brief'); }, []);
  const backToPick = useCallback(() => { setScenario(null); setView('pick'); }, []);

  // ── PICK ──
  if (view === 'pick') {
    return <PickView T={T} pace={pace} onSetPace={onSetPace} flashpoint={flashpoint}
                     bests={bests} onBack={onBack} onPick={start} />;
  }
  // ── BRIEF ──
  if (view === 'brief' && scenario) {
    return <BriefView T={T} scenario={scenario} flashpoint={flashpoint}
                      onBack={backToPick} onStart={() => setView('run')} />;
  }
  // ── RUN + DEBRIEF (same component so the run state survives Try again) ──
  if (scenario) {
    return <RunView key={scenario.id} T={T} scenario={scenario} flashpoint={flashpoint}
                    soundOn={soundOn} setSoundOn={setSoundOn}
                    onExit={backToPick}
                    onComplete={onComplete} onRecordBest={onRecordBest} />;
  }
  return null;
}

// =====================================================================
// VIEW 1 — PICK: the "case file" scenario picker.
// =====================================================================
function PickView({ T, pace, onSetPace, flashpoint, bests, onBack, onPick }) {
  // Group scenarios by category, preserving authored order within each.
  const groups = useMemo(() => {
    const map = new Map();
    for (const sc of WARD_BOSS_SCENARIOS) {
      if (!map.has(sc.category)) map.set(sc.category, []);
      map.get(sc.category).push(sc);
    }
    return Array.from(map.entries());
  }, []);

  let cardIdx = 0; // running index for the staggered entrance across all cards

  return (
    <div className="anim-fadeup">
      <TopBar title="Ward Boss" onBack={onBack} feedback={{ screen: 'Ward Boss picker' }} solid />
      <div className="max-w-md mx-auto px-4 pt-2 pb-40">

        {/* hero — case-file dossier */}
        <Card className="p-0 mb-5 overflow-hidden relative" style={{ background: M.bg, border: `1px solid ${M.border}` }}>
          <div className="px-4 py-4 relative" style={{ color: M.ink }}>
            <div className="flex items-center gap-3">
              <span className="inline-flex w-11 h-11 rounded-2xl items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(70,240,138,0.12)', border: `1px solid ${M.border}` }}>
                <ShieldAlert size={22} color={M.green} className="timer-beat" />
              </span>
              <div>
                <div className="font-display text-lg font-bold leading-tight">You are the Ward Boss</div>
                <div className="text-[12px] mt-0.5" style={{ color: M.muted }}>
                  A patient is deteriorating. Read the room, act in order, survive the crash.
                </div>
              </div>
            </div>
            {/* four-phase teaser */}
            <div className="flex items-center gap-1.5 mt-4">
              {['Simmer', 'Complication', 'Chaos', 'Final Boss'].map((p, i) => (
                <React.Fragment key={p}>
                  <span className="text-[9.5px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full"
                        style={{ background: i === 3 ? M.red + '22' : 'rgba(255,255,255,0.05)', color: i === 3 ? '#FCA5A5' : M.muted }}>
                    {p}
                  </span>
                  {i < 3 && <ChevronRight size={11} color={M.dim} className="flex-shrink-0" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </Card>

        {/* case files by category */}
        {groups.map(([cat, list]) => {
          const tint = catTint(cat);
          return (
            <div key={cat} className="mb-5">
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <span className="w-2 h-2 rounded-full" style={{ background: tint }} />
                <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: T.muted }}>{cat}</span>
              </div>
              <div className="space-y-2.5">
                {list.map((sc) => {
                  const best = bests && bests[sc.id];
                  const done = !!(best && best.done);
                  const bestCoins = best && Number.isFinite(best.best) ? best.best : null;
                  const p = sc.patient || {};
                  const oneLiner = [
                    p.age != null ? `${p.age}` : null,
                    p.sex || null,
                    p.history || null,
                  ].filter(Boolean).join(' · ');
                  const delay = `${Math.min(cardIdx++, 12) * 55}ms`;
                  return (
                    <button key={sc.id} onClick={() => onPick(sc)}
                            className="wb-card-in no-tap-highlight w-full text-left rounded-2xl p-4 active:scale-[0.985] transition relative overflow-hidden"
                            style={{ background: M.panel, border: `1px solid ${done ? tint + '66' : M.border}`, animationDelay: delay }}>
                      {/* left accent spine */}
                      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: tint }} />
                      <div className="flex items-start justify-between gap-3 pl-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-[16px] font-bold leading-tight" style={{ color: M.ink }}>
                            {sc.title}
                          </div>
                          {oneLiner && (
                            <div className="text-[12px] mt-1 leading-snug" style={{ color: M.muted }}>{oneLiner}</div>
                          )}
                          <div className="flex items-center gap-2.5 mt-2.5">
                            <span style={{ color: M.dim }}><DifficultyDots level={sc.difficulty} color={tint} /></span>
                            {done && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                    style={{ background: tint + '1F', color: tint }}>
                                <Check size={10} /> Cleared
                              </span>
                            )}
                            {bestCoins != null && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: M.amber + '1F', color: M.amber }}>
                                <Coins size={10} /> {bestCoins}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={18} color={M.dim} className="mt-0.5 flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Pace */}
        <div className="mt-6">
          <PaceSelector value={pace} onChange={onSetPace} T={T} />
          <div className="flex items-start gap-1.5 text-[11px] leading-relaxed px-1 mt-1" style={{ color: T.muted }}>
            <Zap size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} />
            <span><b style={{ color: '#B45309' }}>Flashpoint:</b> tighter countdowns, double coins.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// VIEW 2 — BRIEF: the patient handoff card.
// =====================================================================
function BriefView({ T, scenario, flashpoint, onBack, onStart }) {
  const tint = catTint(scenario.category);
  const p = scenario.patient || {};
  const vs = scenario.vitalsStart || {};
  return (
    <div className="anim-fadeup">
      <TopBar title="Handoff" onBack={onBack} solid />
      <div className="max-w-md mx-auto px-4 pt-2 pb-40">
        <Card className="wb-brief-in p-0 overflow-hidden" style={{ background: M.bg, border: `1px solid ${M.border}` }}>
          {/* patient banner */}
          <div className="px-5 pt-5 pb-4" style={{ color: M.ink, background: `linear-gradient(160deg, ${tint}22, transparent)` }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: tint }}>
              {scenario.category} · Handoff
            </div>
            <div className="font-display text-2xl font-bold leading-tight">{p.name || 'Your patient'}</div>
            <div className="text-[13px] mt-1" style={{ color: M.muted }}>
              {[p.age != null ? `${p.age} yr` : null, p.sex || null].filter(Boolean).join(' · ')}
            </div>
            {p.history && (
              <div className="flex items-start gap-2 mt-3">
                <Stethoscope size={14} className="flex-shrink-0 mt-0.5" style={{ color: tint }} />
                <div className="text-[13px] leading-relaxed" style={{ color: M.ink }}>{p.history}</div>
              </div>
            )}
          </div>

          {/* intro / SBAR-style story */}
          {scenario.intro && (
            <div className="px-5 py-4" style={{ borderTop: `1px solid ${M.borderSoft}` }}>
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: M.ink }}>
                {scenario.intro}
              </div>
            </div>
          )}

          {/* vitals preview */}
          <div className="px-5 py-4" style={{ borderTop: `1px solid ${M.borderSoft}` }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: M.muted }}>Baseline vitals</div>
            <div className="grid grid-cols-3 gap-3">
              {VITAL_META.map((v) => {
                const val = v.pair
                  ? `${Math.round(vs[v.key])}/${Math.round(vs[v.pair])}`
                  : (v.key === 'temp' ? vs[v.key] : Math.round(vs[v.key]));
                const Icon = v.icon;
                return (
                  <div key={v.key} className="flex flex-col leading-none">
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: M.dim }}>
                      <Icon size={10} /> {v.label}
                    </span>
                    <span className="font-display text-xl font-bold tabular-nums" style={{ color: v.color === M.ink ? M.ink : v.color }}>
                      {val == null ? '--' : val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {flashpoint && (
          <div className="flex items-center gap-2 text-[11.5px] mt-3 px-1" style={{ color: '#B45309' }}>
            <Zap size={13} /> Flashpoint shift, the crash comes faster and pays double.
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          <Button onClick={onStart} size="lg" className="w-full" icon={<Play size={16} fill="#FFF" strokeWidth={0} />}>
            Start shift
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Small presentational helpers for the RUN view.
// =====================================================================

// A single monitor vital readout (drifting number, colour-coded label).
function VitalReadout({ meta, vitals }) {
  const Icon = meta.icon;
  const val = meta.pair
    ? `${vitals[meta.key]}/${vitals[meta.pair]}`
    : vitals[meta.key];
  return (
    <div className="flex flex-col items-end leading-none">
      <div className="flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-wider mb-1" style={{ color: M.muted }}>
        <Icon size={9} /> {meta.label}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="font-display text-xl font-bold tabular-nums" style={{ color: meta.color }}>
          {val == null ? '--' : val}
        </span>
        {meta.unit && <span className="text-[8px] font-semibold" style={{ color: M.muted }}>{meta.unit}</span>}
      </div>
    </div>
  );
}

// The 0-100 stability bar. Colour shifts green → amber → red; `damageKey`
// remounts a flash overlay when the value drops.
function StabilityBar({ value, damageKey, reduced }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v > 60 ? '#22C55E' : v > 30 ? M.amber : M.red;
  const label = v > 60 ? 'Stable' : v > 30 ? 'Guarded' : 'Critical';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: M.muted }}>Patient stability</span>
        <span className="text-[10px] font-bold tabular-nums flex items-center gap-1" style={{ color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          {label} · {Math.round(v)}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div key={reduced ? undefined : damageKey}
             className={reduced ? '' : 'wb-damage'}
             style={{ width: `${v}%`, height: '100%', background: color, transition: 'width 0.5s cubic-bezier(0.34,1.56,0.64,1), background 0.5s ease' }} />
      </div>
    </div>
  );
}

// A linear shrink countdown bar (chaos decision / boss). Remount via `runKey`.
function CountdownBar({ runKey, seconds, color, reduced }) {
  if (reduced) {
    // Static filled bar — the numeric seconds carry the information instead.
    return (
      <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: '100%', height: '100%', background: color }} />
      </div>
    );
  }
  return (
    <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div key={runKey} style={{ height: '100%', background: color, animation: `wbShrink ${seconds}s linear forwards` }} />
    </div>
  );
}

// =====================================================================
// VIEW 3 + 4 — RUN (the core loop) + DEBRIEF. One component so state is
// preserved through the run and "Try again" can re-init in place.
// =====================================================================
function RunView({ T, scenario, flashpoint, soundOn, setSoundOn, onExit, onComplete, onRecordBest }) {
  const reduced = prefersReducedMotion();

  // ── Engine state (source of truth for ALL rules) ──
  const [state, setState] = useState(() => initRun(scenario));
  const [vitals, setVitals] = useState(() => ({ ...scenario.vitalsStart }));
  const phase = currentPhase(scenario, state);
  const boss = isBossPhase(scenario, state);

  // ── Transient UI beats (pure presentation) ──
  const [feedback, setFeedback] = useState(null);      // { ok, kind, note, points, actionId, key }
  const [pointChip, setPointChip] = useState(null);    // { points, key }
  const [damageKey, setDamageKey] = useState(0);       // remounts the stability damage flash
  const [bannerKey, setBannerKey] = useState(0);       // remounts the phase-transition sweep
  const [bossFlash, setBossFlash] = useState(false);   // one-shot boss-entry vignette flash
  const [chaosKey, setChaosKey] = useState(0);         // remounts the chaos decision countdown
  const [chaosLeft, setChaosLeft] = useState(0);       // numeric chaos seconds shown
  const [bossLeft, setBossLeft] = useState(0);         // numeric boss countdown seconds
  const [finished, setFinished] = useState(false);     // onComplete/onRecordBest fired exactly once

  const { flash: comboFlash, hit: comboHit, miss: comboMiss, reset: comboReset } = useCombo();

  const ended = state.status !== 'running';

  // ── Refs used by timers/audio so effects don't churn ──
  const stateRef = useRef(state); stateRef.current = state;
  const audioRef = useRef(null);
  const fbTimer = useRef(null);
  const chipTimer = useRef(null);

  // ── Monitor audio: created once; started per phase while running + sound on;
  // pitch/urgency follows the phase's rhythm (via ecg-audio, same as icu). ──
  useEffect(() => {
    audioRef.current = createMonitorAudio();
    return () => { try { audioRef.current && audioRef.current.close(); } catch (e) {} };
  }, []);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const rhythm = rhythmFor(phase && phase.ecgId);
    if (!ended && soundOn && isSoundEnabled() && rhythm) {
      // Escalate the beep urgency with the alarm level by tagging severity.
      const sev = phase.alarm === 'boss' || phase.alarm === 'loud' ? 'critical' : rhythm.severity;
      a.start({ ...rhythm, severity: sev });
    } else {
      a.stop();
    }
    return () => { try { a.stop(); } catch (e) {} };
  }, [phase && phase.id, ended, soundOn]);

  // ── Vitals drift: 1s tick toward the current phase target. Under reduced
  // motion, snap once per phase change (no continuous animation). ──
  useEffect(() => {
    if (ended || !phase) return undefined;
    const target = phase.vitals;
    if (reduced) {
      setVitals({ ...target }); // snap straight to the phase target
      return undefined;
    }
    const id = setInterval(() => {
      setVitals((cur) => stepVitals(cur, target, Math.random));
    }, 1000);
    return () => clearInterval(id);
  }, [phase && phase.id, ended, reduced]);

  // ── Cleanup transient timers on unmount ──
  useEffect(() => () => {
    [fbTimer, chipTimer].forEach((t) => t.current && clearTimeout(t.current));
  }, []);

  // ── Detect boss entry → one-shot flash + haptic ──
  const prevPhaseId = useRef(phase && phase.id);
  useEffect(() => {
    const pid = phase && phase.id;
    if (pid !== prevPhaseId.current) {
      prevPhaseId.current = pid;
      setBannerKey((k) => k + 1);
      if (boss) {
        if (!reduced) { setBossFlash(true); setTimeout(() => setBossFlash(false), 1100); }
        haptic(HAPTIC.INVALID);
      }
    }
  }, [phase && phase.id, boss, reduced]);

  // ── Chaos decision countdown (non-boss phase with decisionSec) ──
  const chaosSec = useMemo(() => {
    if (boss || !phase || !phase.decisionSec) return 0;
    return Math.max(3, Math.round(phase.decisionSec * (flashpoint ? 0.6 : 1)));
  }, [boss, phase && phase.id, flashpoint]);

  useEffect(() => {
    if (ended || boss || !chaosSec) return undefined;
    // restart the visual bar + numeric clock on each (re)arm
    setChaosLeft(chaosSec);
    setChaosKey((k) => k + 1);
    const tick = setInterval(() => setChaosLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    const expire = setTimeout(() => {
      const res = applyTimeout(scenario, stateRef.current);
      commit(res);
    }, chaosSec * 1000);
    return () => { clearInterval(tick); clearTimeout(expire); };
    // Re-arm on each turn (a resolved decision resets the clock) and phase change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaosSec, state.turn, phase && phase.id, ended, boss]);

  // ── Boss hard countdown ──
  const bossSec = useMemo(() => {
    if (!boss || !phase) return 0;
    return Math.max(6, Math.round((phase.countdownSec || 20) * (flashpoint ? 0.6 : 1)));
  }, [boss, phase && phase.id, flashpoint]);

  useEffect(() => {
    if (ended || !boss || !bossSec) return undefined;
    setBossLeft(bossSec);
    const tick = setInterval(() => setBossLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    const expire = setTimeout(() => {
      const res = applyTimeout(scenario, stateRef.current);
      commit(res);
    }, bossSec * 1000);
    return () => { clearInterval(tick); clearTimeout(expire); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossSec, phase && phase.id, ended, boss]);

  // ── Commit an engine result: update state + fire the feedback beat ──
  const commit = useCallback((res) => {
    if (!res) return;
    const fb = res.feedback || {};
    setState(res.state);

    // Feedback card (rationale for harm/neutral, chart line for key).
    const key = Date.now() + Math.random();
    setFeedback({ ok: fb.ok, kind: fb.kind, note: fb.note, points: fb.points, actionId: null, key });

    if (fb.ok && fb.kind === 'key') {
      // Key action / boss step: green flash + floating point chip + combo hit.
      if (Number.isFinite(fb.points) && fb.points > 0) {
        setPointChip({ points: fb.points, key });
        if (chipTimer.current) clearTimeout(chipTimer.current);
        chipTimer.current = setTimeout(() => setPointChip(null), 1150);
      }
      comboHit();
      haptic(res.state.status === 'won' || (res.state.bossStep && res.state.bossStep > 0) ? HAPTIC.COMBO : HAPTIC.PLACE);
      if (!reduced && soundOn && isSoundEnabled()) {
        try { playClearChime(Math.min((res.state.bossStep || res.state.doneActionIds.length) - 1, 6), res.state.status === 'won' ? 2 : 1); } catch (e) {}
      }
    } else if (fb.kind === 'harm' || fb.kind === 'neutral') {
      // Harm / neutral: the feedback card (remounted per feedback.key) carries
      // the shake; here just the damage flash + combo miss.
      setDamageKey((k) => k + 1);
      comboMiss();
      haptic(HAPTIC.INVALID);
    }

    // Auto-collapse the feedback card after a readable pause (except boss/loss,
    // which stay until dismissed / the run ends).
    if (fbTimer.current) clearTimeout(fbTimer.current);
    if (res.state.status === 'running' && !fb.phaseAdvanced) {
      fbTimer.current = setTimeout(() => setFeedback((f) => (f && f.key === key ? null : f)), 2600);
    }
  }, [comboHit, comboMiss, reduced, soundOn]);

  // ── Handle a palette / boss tap ──
  const onAct = useCallback((actionId) => {
    if (stateRef.current.status !== 'running') return;
    const res = applyAction(scenario, stateRef.current, actionId);
    commit(res);
  }, [scenario, commit]);

  const dismissFeedback = useCallback(() => setFeedback(null), []);

  // ── Try again: re-init the run in place (no navigation) ──
  const tryAgain = useCallback(() => {
    if (fbTimer.current) clearTimeout(fbTimer.current);
    if (chipTimer.current) clearTimeout(chipTimer.current);
    setState(initRun(scenario));
    setVitals({ ...scenario.vitalsStart });
    setFeedback(null); setPointChip(null); setBossFlash(false); setFinished(false);
    prevPhaseId.current = scenario.phases[0].id;
    comboReset();
  }, [scenario, comboReset]);

  // ── Final tally (engine) ──
  const tally = useMemo(() => scoreRun(state, { flashpoint }), [state, flashpoint]);

  // ── Finish: fire onRecordBest + onComplete exactly once ──
  const finish = useCallback(() => {
    if (finished) return;
    setFinished(true);
    try { if (onRecordBest) onRecordBest('ward-boss', scenario.id, { score: tally.coins, outcome: state.status }); } catch (e) {}
    try { if (onComplete) onComplete(tally.coins); } catch (e) {}
  }, [finished, onRecordBest, onComplete, scenario.id, tally.coins, state.status]);

  // Backing out of a LIVE shift used to silently destroy it and drop the user on
  // the scenario picker with no warning (and a second back was then needed to
  // actually leave). Ask first: a shift in progress is several minutes of work.
  const { requestExit, dialog: exitDialog } = useExitGuard({
    started: !ended, finished, earned: tally.coins, progress: state.turn || 1,
    // Once the shift has ENDED, leaving must still go through `finish`: that is
    // the only thing that banks the coins and records the personal best.
    onLeave: ended ? finish : onExit,
  });

  // ── DEBRIEF ──
  if (ended) {
    return <DebriefView T={T} scenario={scenario} state={state} tally={tally} flashpoint={flashpoint}
                        onTryAgain={tryAgain} onFinish={finish} finished={finished} />;
  }

  // ── RUN ──
  const rhythm = rhythmFor(phase.ecgId);
  const groups = boss ? null : visibleActions(scenario, state);
  const bossOpts = boss ? bossOptions(scenario, state) : [];
  const phaseNo = state.phaseIndex + 1;

  // Alarm-driven monitor frame class + colour.
  const alarm = phase.alarm || 'none';
  const frameClass = reduced ? '' :
    alarm === 'boss' ? 'wb-pulse-loud' :
    alarm === 'loud' ? 'wb-pulse-loud' :
    alarm === 'soft' ? 'wb-pulse-soft' : '';
  const frameBorder = alarm === 'boss' || alarm === 'loud' ? M.red
    : alarm === 'soft' ? M.amber : M.border;

  return (
    <div className="test-enter" style={{ minHeight: '100vh', background: T.bg }}>
      <ComboBurst flash={comboFlash} />

      {/* Boss-entry full-screen vignette flash (one-shot) */}
      {bossFlash && (
        <div className="fixed inset-0 z-[70] pointer-events-none wb-boss-flash"
             style={{ background: `radial-gradient(circle at 50% 45%, transparent 30%, ${FLASH_RED} 130%)` }} aria-hidden="true" />
      )}
      {/* Sustained boss vignette frame */}
      {boss && (
        <div className={`fixed inset-0 z-[5] pointer-events-none ${reduced ? '' : 'wb-boss-breathe'}`}
             style={{ boxShadow: `inset 0 0 120px 24px ${M.red}88`, opacity: reduced ? 0.6 : undefined }} aria-hidden="true" />
      )}

      {exitDialog}
      <TopBar title="Ward Boss" onBack={requestExit}
              right={
                <button onClick={() => setSoundOn((s) => !s)} aria-label={soundOn ? 'Mute monitor' : 'Unmute monitor'}
                        className="no-tap-highlight text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ color: soundOn ? M.green : T.muted, background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                  {soundOn ? 'Sound on' : 'Muted'}
                </button>
              } />

      <div className="max-w-md mx-auto px-4 pb-44 pt-2 relative z-10">

        {/* ── PHASE BANNER ── */}
        <div key={bannerKey} className={`${reduced ? '' : 'wb-banner-sweep'} flex items-center gap-2 mb-3`}>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-1 rounded"
                style={{ background: frameBorder + '22', color: frameBorder === M.border ? M.green : frameBorder }}>
            Phase {phaseNo} of 4
          </span>
          <span className="font-display text-[15px] font-bold" style={{ color: T.ink }}>{phase.label}</span>
          {(alarm === 'loud' || alarm === 'boss') && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: '#FCA5A5' }}>
              <span className={`w-1.5 h-1.5 rounded-full ${reduced ? '' : 'timer-beat-fast'}`} style={{ background: M.red }} /> Alarm
            </span>
          )}
        </div>

        {/* ── MONITOR HEADER ── */}
        <div className={`rounded-2xl overflow-hidden mb-4 ${frameClass}`}
             style={{ border: `1.5px solid ${frameBorder}` }}>
          <div className="flex items-stretch" style={{ background: M.bg }}>
            {/* ECG strip (hidden gracefully when no ecgId) */}
            {rhythm ? (
              <div className="flex-1 min-w-0">
                <EcgMonitor rhythm={rhythm} running height={132}
                            speedSec={rhythm.hr ? Math.max(2.4, 360 / rhythm.hr) : 3.4} />
              </div>
            ) : (
              <div className="flex-1 min-w-0 flex items-center justify-center px-4"
                   style={{ background: M.bg, minHeight: 132 }}>
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold" style={{ color: M.muted }}>
                  <Activity size={13} /> Continuous monitoring
                </span>
              </div>
            )}
            {/* vitals rail */}
            <div className="flex flex-col justify-between py-2.5 px-3 gap-2 flex-shrink-0"
                 style={{ width: 92, borderLeft: `1px solid ${M.border}` }}>
              {VITAL_META.map((m) => <VitalReadout key={m.key} meta={m} vitals={vitals} />)}
            </div>
          </div>
          {/* stability bar */}
          <div className="px-3.5 py-2.5" style={{ background: M.panel, borderTop: `1px solid ${M.border}` }}>
            <StabilityBar value={state.stability} damageKey={damageKey} reduced={reduced} />
          </div>
        </div>

        {/* ── PHASE BRIEF ── */}
        {phase.brief && (
          <div className="rounded-xl px-3.5 py-3 mb-4 text-[13px] leading-relaxed"
               style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}`, color: T.inkSoft }}>
            {phase.brief}
          </div>
        )}

        {/* ── FEEDBACK BEAT ── */}
        {feedback && (
          <FeedbackCard key={feedback.key} T={T} feedback={feedback} onDismiss={dismissFeedback} boss={boss} reduced={reduced} />
        )}

        {/* ── CHAOS DECISION TIMER ── */}
        {!boss && chaosSec > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: M.amber }}>
                <AlertTriangle size={12} /> Decide now
              </span>
              <span className="text-xs font-bold tabular-nums" style={{ color: chaosLeft <= 3 ? M.red : M.amber }}>{chaosLeft}s</span>
            </div>
            <CountdownBar runKey={chaosKey} seconds={chaosSec} color={M.amber} reduced={reduced} />
          </div>
        )}

        {/* ── ACTION PALETTE (non-boss) ── */}
        {!boss && groups && (
          <div className="space-y-4">
            {(['assess', 'intervene', 'communicate']).map((cat) => {
              const rows = groups[cat] || [];
              if (!rows.length) return null;
              const CatIcon = CAT_ICON[cat];
              return (
                <div key={cat}>
                  <div className="flex items-center gap-1.5 mb-2 px-0.5">
                    <CatIcon size={13} style={{ color: T.muted }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>{CAT_LABEL[cat]}</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((a) => (
                      <button key={a.id} onClick={() => onAct(a.id)}
                              className="no-tap-highlight w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left active:scale-[0.98] transition"
                              style={{ background: T.surface, border: `1.5px solid ${T.border}` }}>
                        <span className="font-display text-[14px] font-semibold flex-1" style={{ color: T.ink }}>{a.label}</span>
                        <ChevronRight size={15} style={{ color: T.muted }} />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── BOSS GAUNTLET ── */}
        {boss && (
          <BossPanel T={T} scenario={scenario} phase={phase} state={state} options={bossOpts}
                     bossLeft={bossLeft} bossSec={bossSec} onAct={onAct} reduced={reduced} />
        )}
      </div>

      {/* floating point chip */}
      {pointChip && (
        <div key={pointChip.key} className={`fixed left-1/2 z-[65] pointer-events-none ${reduced ? '' : 'wb-point-float'}`}
             style={{ top: 'calc(160px + env(safe-area-inset-top, 0px))', opacity: reduced ? 1 : undefined }} aria-hidden="true">
          <span className="inline-flex items-center gap-1 font-display text-lg font-bold px-3 py-1 rounded-full"
                style={{ background: '#16A34A', color: '#FFF', boxShadow: '0 8px 22px rgba(22,163,74,0.5)' }}>
            +{pointChip.points}
          </span>
        </div>
      )}
    </div>
  );
}

// The rationale / chart-entry card shown after a tap.
function FeedbackCard({ T, feedback, onDismiss, boss, reduced }) {
  const isKey = feedback.ok && feedback.kind === 'key';
  const tone = isKey ? '#16A34A' : feedback.kind === 'harm' ? M.red : M.amber;
  const Icon = isKey ? Check : feedback.kind === 'harm' ? AlertTriangle : TimerOff;
  return (
    <Card className={`p-3.5 mb-4 ${reduced ? '' : (isKey ? 'wb-chart-in' : 'wb-shake')}`}
          style={{ background: isKey ? '#16A34A14' : tone + '12', border: `1px solid ${tone}55` }}>
      <div className="flex items-start gap-2.5">
        <span className="inline-flex w-6 h-6 rounded-lg items-center justify-center flex-shrink-0"
              style={{ background: tone + '22' }}>
          <Icon size={14} style={{ color: tone }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: tone }}>
            {isKey ? 'Charted' : feedback.kind === 'harm' ? 'That set the patient back' : 'Careful'}
          </div>
          <div className="text-[13px] leading-relaxed" style={{ color: T.ink }}>{feedback.note}</div>
        </div>
        {/* Harm/neutral: require a tap to dismiss so the rationale is readable. */}
        {!isKey && (
          <button onClick={onDismiss} aria-label="Dismiss" className="no-tap-highlight p-1 -m-1 rounded-full flex-shrink-0" style={{ color: T.muted }}>
            <X size={15} />
          </button>
        )}
      </div>
    </Card>
  );
}

// The Final Boss ordered-sequence gauntlet.
function BossPanel({ T, scenario, phase, state, options, bossLeft, bossSec, onAct, reduced }) {
  const total = phase.sequence.length;
  const step = state.bossStep;
  return (
    <div>
      {/* boss header */}
      <Card className="p-4 mb-4" style={{ background: M.bg, border: `1.5px solid ${M.red}` }}>
        <div className="flex items-center gap-2 mb-2">
          <Skull size={17} color={M.red} className={reduced ? '' : 'timer-beat-fast'} />
          <div className="font-display text-[15px] font-bold" style={{ color: M.ink }}>{phase.label}</div>
          <span key={step} className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${reduced ? '' : 'wb-step-pop'}`}
                style={{ background: M.red + '22', color: '#FCA5A5' }}>
            Step {Math.min(step + 1, total)} of {total}
          </span>
        </div>
        {phase.brief && <div className="text-[12.5px] leading-relaxed" style={{ color: M.muted }}>{phase.brief}</div>}
        {/* hard countdown */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: M.red }}>Countdown</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: bossLeft <= 5 ? M.red : M.amber }}>{bossLeft}s</span>
          </div>
          {/* ONE hard deadline for the whole sequence — the bar must not refill
              on a correct step (the engine's timeout is armed once at boss
              entry, so a refilling bar would lie about the time left). */}
          <CountdownBar runKey={`boss-${phase.id}`} seconds={bossSec} color={M.red} reduced={reduced} />
        </div>
        {/* progress pips */}
        <div className="flex items-center gap-1.5 mt-3">
          {phase.sequence.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full flex-1"
                 style={{ background: i < step ? '#22C55E' : i === step ? M.amber : 'rgba(255,255,255,0.12)' }} />
          ))}
        </div>
      </Card>

      {/* the single urgent option list */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-2 px-0.5" style={{ color: T.muted }}>
          What is your next move?
        </div>
        <div className="space-y-2">
          {options.map((o) => (
            <button key={o.id} onClick={() => onAct(o.id)}
                    className="no-tap-highlight w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:scale-[0.98] transition"
                    style={{ background: T.surface, border: `1.5px solid ${M.red}44` }}>
              <span className="inline-flex w-6 h-6 rounded-lg items-center justify-center flex-shrink-0" style={{ background: M.red + '18' }}>
                <Syringe size={13} color={M.red} />
              </span>
              <span className="font-display text-[14px] font-semibold flex-1" style={{ color: T.ink }}>{o.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[11px] text-center mt-3" style={{ color: T.muted }}>
          Right action, right order. One wrong move ends the shift.
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// VIEW 4 — DEBRIEF: win celebration OR compassionate loss, log, exam tip.
// =====================================================================
const LOSS_LINE = {
  stability: 'The patient decompensated: too many setbacks stacked up before you could stabilise them.',
  'boss-wrong': 'One step out of order in the crash. In a real code, sequence is everything.',
  'boss-timeout': 'The window closed before the sequence was complete. Hesitation costs seconds you did not have.',
};

function DebriefView({ T, scenario, state, tally, flashpoint, onTryAgain, onFinish, finished }) {
  const won = state.status === 'won';
  const reduced = prefersReducedMotion();
  const tint = catTint(scenario.category);

  // Missed key labels (from the scenario, looked up by the engine's ids).
  const missedLabels = useMemo(() => {
    const ids = state.missedKeyIds || [];
    if (!ids.length) return [];
    const byId = {};
    for (const ph of scenario.phases) for (const a of (ph.actions || [])) byId[a.id] = a.label;
    return ids.map((id) => byId[id] || id);
  }, [state.missedKeyIds, scenario]);

  return (
    <div className="anim-fadeup" style={{ minHeight: '100vh', background: won ? T.bg : M.bg }}>
      <TopBar title={won ? 'Shift cleared' : 'Debrief'} onBack={onFinish} />
      <div className="max-w-md mx-auto px-4 pt-6 pb-32">

        {/* headline */}
        <div className="text-center mb-6">
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${reduced ? '' : 'wb-win-bloom'}`}
               style={won
                 ? { background: '#22C55E1F', border: '1px solid #22C55E66' }
                 : { background: M.redDeep, border: `1px solid ${M.red}` }}>
            {won ? <Trophy size={30} style={{ color: '#22C55E' }} /> : <HeartPulse size={30} color={M.red} className={reduced ? '' : 'timer-beat'} />}
          </div>
          <div className="font-display text-2xl font-bold mb-1.5" style={{ color: won ? T.ink : M.ink }}>
            {won ? 'You held the line' : 'The shift got away from you'}
          </div>
          <div className="text-[13.5px] leading-relaxed max-w-sm mx-auto" style={{ color: won ? T.inkSoft : M.muted }}>
            {won ? scenario.debriefWin : (LOSS_LINE[state.lossReason] || scenario.debriefLoss)}
          </div>
          {!won && scenario.debriefLoss && LOSS_LINE[state.lossReason] && (
            <div className="text-[12.5px] leading-relaxed max-w-sm mx-auto mt-2" style={{ color: M.muted }}>
              {scenario.debriefLoss}
            </div>
          )}
        </div>

        {/* coins */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-1.5 text-sm font-bold px-3.5 py-1.5 rounded-full"
               style={{ background: M.amber + '22', color: '#B45309' }}>
            <Coins size={15} /> +{tally.coins} Coins{flashpoint ? ' · 2×' : ''}
          </div>
        </div>

        {/* missed keys callout */}
        {missedLabels.length > 0 && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: won ? T.surfaceWarm : M.panel, border: `1px solid ${won ? T.borderSoft : M.border}` }}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={15} style={{ color: M.amber }} />
              <div className="font-display text-sm font-semibold" style={{ color: won ? T.ink : M.ink }}>Priorities you skipped</div>
            </div>
            <div className="space-y-1.5">
              {missedLabels.map((l, i) => (
                <div key={i} className="flex items-start gap-2 text-[12.5px] leading-snug" style={{ color: won ? T.inkSoft : M.muted }}>
                  <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: M.amber }} />
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* full action log */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: won ? T.surfaceWarm : M.panel, border: `1px solid ${won ? T.borderSoft : M.border}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={15} style={{ color: tint }} />
            <div className="font-display text-sm font-semibold" style={{ color: won ? T.ink : M.ink }}>Shift record</div>
            <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: won ? T.muted : M.muted }}>
              {tally.correctActions}/{tally.totalActions} right
            </span>
          </div>
          {state.log.length === 0 ? (
            <div className="text-[12.5px]" style={{ color: won ? T.muted : M.muted }}>No actions logged.</div>
          ) : (
            <div className="space-y-2.5">
              {state.log.map((row, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="inline-flex w-4 h-4 rounded-full items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: row.ok ? '#22C55E22' : M.red + '22' }}>
                    {row.ok ? <Check size={11} style={{ color: '#22C55E' }} /> : <X size={11} style={{ color: M.red }} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-snug" style={{ color: won ? T.ink : M.ink }}>
                      {row.label}
                      {row.points > 0 && <span className="ml-1.5 text-[11px] font-bold" style={{ color: '#16A34A' }}>+{row.points}</span>}
                    </div>
                    {row.note && <div className="text-[11.5px] leading-snug mt-0.5" style={{ color: won ? T.muted : M.muted }}>{row.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* exam tip */}
        {scenario.examTip && (
          <div className="rounded-2xl p-4 mb-2" style={{ background: '#F59E0B14', border: '1px solid #F59E0B55' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Lightbulb size={15} style={{ color: '#B45309' }} />
              <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#B45309' }}>Exam tip</div>
            </div>
            <div className="text-[13px] leading-relaxed" style={{ color: won ? T.ink : M.ink }}>{scenario.examTip}</div>
          </div>
        )}
      </div>

      {/* footer — Try again + Finish */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: (won ? T.bg : M.bg) + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${won ? T.borderSoft : M.border}` }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button onClick={onTryAgain} disabled={finished}
                  className="no-tap-highlight flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold active:scale-[0.98] transition disabled:opacity-40"
                  style={{ background: won ? T.surface : M.panel, color: won ? T.ink : M.ink, border: `1.5px solid ${won ? T.border : M.border}` }}>
            <RotateCcw size={15} /> Try again
          </button>
          <Button onClick={onFinish} size="lg" className="flex-1" disabled={finished}>
            Finish
          </Button>
        </div>
      </div>
    </div>
  );
}
