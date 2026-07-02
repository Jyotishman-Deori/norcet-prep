// =====================================================================
// src/lib/ward-boss-engine.js — pure FSM for "Ward Boss" (patient-deterioration
// game). Four phases: Simmer → Complication → Chaos → Final Boss. No React,
// no I/O, no Date.now — the rng is injected. The screen drives rendering,
// timers, and vitals ticking; every rule that decides points / stability /
// win-loss lives here so it's unit-testable in isolation.
//
// See survival-engine.js / chart-engine.js for the house pure-engine style.
// The seeded shuffle copies the mulberry32 + hashSeed pattern from
// src/data/ecg-rhythms.js so option order is stable across re-renders.
// =====================================================================

// ── Deterministic PRNG (same pattern as src/data/ecg-rhythms.js) ─────
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(s) {
  let h = 2166136261; const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Fisher–Yates driven by a seeded rng → stable order for a given seed string.
function seededShuffle(arr, seedStr) {
  const rng = mulberry32(hashSeed(seedStr));
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ── Constants (tuned, exported so the screen can mirror copy/thresholds) ──
export const START_STABILITY = 100;
export const KEY_POINTS = 15;          // correct non-boss key action
export const HARM_PENALTY = 15;        // default stability hit for 'harm'
export const NEUTRAL_PENALTY = 5;      // default stability hit for 'neutral'
export const MISS_PENALTY = 10;        // per undone key on force-advance
export const HESITATE_PENALTY = 10;    // chaos decision-timer expiry
export const BOSS_STEP_POINTS = 25;    // each correct boss step
export const BOSS_WIN_BONUS = 50;      // clearing the whole boss sequence
export const DRIFT = 0.15;             // vitals drift toward target per tick
export const VITAL_KEYS = ['hr', 'sbp', 'dbp', 'spo2', 'rr', 'temp'];

const CATS = ['assess', 'intervene', 'communicate'];
const KINDS = ['key', 'harm', 'neutral'];
const ALARMS = ['none', 'soft', 'loud'];

// =====================================================================
// validateScenario — returns null when valid, else a human string naming
// the first problem (prefixed with the scenario id when present). The data
// file lint test runs this over every authored scenario.
// =====================================================================
export function validateScenario(sc) {
  const tag = sc && sc.id != null ? `[${sc.id}] ` : '';
  const bad = (msg) => `${tag}${msg}`;
  if (!sc || typeof sc !== 'object') return 'scenario is not an object';
  if (typeof sc.id !== 'string' || !sc.id) return bad('missing scenario id');
  if (!Number.isInteger(sc.difficulty) || sc.difficulty < 1 || sc.difficulty > 3)
    return bad('difficulty must be an integer 1..3');

  for (const f of ['debriefWin', 'debriefLoss', 'examTip']) {
    if (typeof sc[f] !== 'string' || !sc[f].trim()) return bad(`${f} must be a non-empty string`);
  }

  // vitalsStart: all 6 numeric.
  if (!sc.vitalsStart || typeof sc.vitalsStart !== 'object') return bad('missing vitalsStart');
  for (const k of VITAL_KEYS) {
    if (!Number.isFinite(sc.vitalsStart[k])) return bad(`vitalsStart.${k} must be numeric`);
  }

  if (!Array.isArray(sc.phases) || sc.phases.length !== 4)
    return bad('scenario must have EXACTLY 4 phases');

  const ids = new Set();          // all action/step/decoy ids must be unique per scenario
  const dupCheck = (id, where) => {
    if (typeof id !== 'string' || !id) return bad(`${where} has a missing/blank id`);
    if (ids.has(id)) return bad(`duplicate id "${id}" (${where})`);
    ids.add(id);
    return null;
  };

  for (let i = 0; i < sc.phases.length; i++) {
    const ph = sc.phases[i];
    const isLast = i === sc.phases.length - 1;
    if (!ph || typeof ph !== 'object') return bad(`phase ${i} is not an object`);
    if (typeof ph.id !== 'string' || !ph.id) return bad(`phase ${i} missing id`);
    if (typeof ph.label !== 'string' || !ph.label) return bad(`phase ${i} missing label`);

    // phase vitals (drift target) — all 6 numeric on every phase.
    if (!ph.vitals || typeof ph.vitals !== 'object') return bad(`phase ${ph.id} missing vitals`);
    for (const k of VITAL_KEYS) {
      if (!Number.isFinite(ph.vitals[k])) return bad(`phase ${ph.id} vitals.${k} must be numeric`);
    }

    if (isLast) {
      // ── boss phase ──
      if (ph.strict !== true) return bad(`boss phase ${ph.id} must have strict:true`);
      if (ph.alarm !== 'boss') return bad(`boss phase ${ph.id} alarm must be 'boss'`);
      if (!Number.isFinite(ph.countdownSec) || ph.countdownSec < 10)
        return bad(`boss phase ${ph.id} countdownSec must be >= 10`);
      if (!Array.isArray(ph.sequence) || ph.sequence.length < 2 || ph.sequence.length > 4)
        return bad(`boss phase ${ph.id} sequence must have 2..4 steps`);
      if (!Array.isArray(ph.decoys) || ph.decoys.length < 2)
        return bad(`boss phase ${ph.id} must have >= 2 decoys`);
      for (const step of ph.sequence) {
        const e = dupCheck(step && step.id, `boss step`);
        if (e) return e;
        if (typeof step.label !== 'string' || !step.label) return bad(`boss step ${step.id} missing label`);
        if (typeof step.why !== 'string' || !step.why.trim()) return bad(`boss step ${step.id} missing why`);
      }
      for (const dc of ph.decoys) {
        const e = dupCheck(dc && dc.id, `boss decoy`);
        if (e) return e;
        if (typeof dc.label !== 'string' || !dc.label) return bad(`boss decoy ${dc.id} missing label`);
        if (typeof dc.why !== 'string' || !dc.why.trim()) return bad(`boss decoy ${dc.id} missing why`);
      }
    } else {
      // ── non-boss phase ──
      if (!Number.isInteger(ph.turns) || ph.turns < 1) return bad(`phase ${ph.id} turns must be >= 1`);
      if (!ALARMS.includes(ph.alarm)) return bad(`phase ${ph.id} alarm must be one of ${ALARMS.join('|')}`);
      if (ph.decisionSec != null && (!Number.isFinite(ph.decisionSec) || ph.decisionSec < 5))
        return bad(`phase ${ph.id} decisionSec must be >= 5 when present`);
      if (!Array.isArray(ph.actions) || ph.actions.length < 2)
        return bad(`phase ${ph.id} must have >= 2 actions`);
      let nKey = 0, nHarmNeutral = 0;
      for (const a of ph.actions) {
        if (!a || typeof a !== 'object') return bad(`phase ${ph.id} has a non-object action`);
        const e = dupCheck(a.id, `action in phase ${ph.id}`);
        if (e) return e;
        if (!CATS.includes(a.cat)) return bad(`action ${a.id} cat must be one of ${CATS.join('|')}`);
        if (!KINDS.includes(a.kind)) return bad(`action ${a.id} kind must be one of ${KINDS.join('|')}`);
        if (typeof a.label !== 'string' || !a.label) return bad(`action ${a.id} missing label`);
        if (a.kind === 'key') {
          nKey++;
          if (typeof a.log !== 'string' || !a.log.trim()) return bad(`key action ${a.id} must have a log line`);
        } else {
          nHarmNeutral++;
          if (typeof a.why !== 'string' || !a.why.trim()) return bad(`${a.kind} action ${a.id} must have a why`);
        }
      }
      if (nKey < 1) return bad(`phase ${ph.id} must have >= 1 key action`);
      if (nHarmNeutral < 1) return bad(`phase ${ph.id} must have >= 1 harm|neutral action`);
    }
  }
  return null;
}

// =====================================================================
// initRun — fresh state for a scenario. Displayed vitals start at vitalsStart.
// =====================================================================
export function initRun(scenario) {
  return {
    scenarioId: scenario.id,
    phaseIndex: 0,
    turn: 1,
    stability: START_STABILITY,
    vitals: { ...scenario.vitalsStart },
    flags: {},
    doneActionIds: [],
    missedKeyIds: [],
    bossStep: 0,
    log: [],
    score: 0,
    status: 'running',
    lossReason: null,
    _phaseTurns: 0,          // turns spent in the CURRENT phase (internal)
  };
}

export function currentPhase(scenario, state) {
  return scenario.phases[state.phaseIndex];
}
export function isBossPhase(scenario, state) {
  const ph = currentPhase(scenario, state);
  return !!(ph && ph.strict);
}

// Key actions of a phase, in author order.
function keyActions(phase) {
  return (phase.actions || []).filter((a) => a.kind === 'key');
}
// All key ids of a phase that are NOT yet in doneActionIds.
function undoneKeyIds(phase, state) {
  return keyActions(phase).map((a) => a.id).filter((id) => !state.doneActionIds.includes(id));
}

// =====================================================================
// visibleActions — non-boss only. Actions of the current phase grouped by cat,
// with already-done key ids removed, each group in a stable seeded order.
// =====================================================================
export function visibleActions(scenario, state) {
  const phase = currentPhase(scenario, state);
  const out = { assess: [], intervene: [], communicate: [] };
  if (!phase || phase.strict) return out;
  const remaining = (phase.actions || []).filter((a) => !state.doneActionIds.includes(a.id));
  for (const cat of CATS) {
    const group = remaining.filter((a) => a.cat === cat);
    out[cat] = seededShuffle(group, `${scenario.id}:${phase.id}:${cat}`);
  }
  return out;
}

// =====================================================================
// bossOptions — boss only. Flat, seeded-shuffled array of {id,label} =
// not-yet-done sequence steps + ALL decoys. Stable across renders (the seed
// includes bossStep so the layout re-shuffles as steps are consumed, but is
// deterministic for a given step).
// =====================================================================
export function bossOptions(scenario, state) {
  const phase = currentPhase(scenario, state);
  if (!phase || !phase.strict) return [];
  const remainingSteps = phase.sequence.slice(state.bossStep);
  const pool = [...remainingSteps, ...phase.decoys].map((o) => ({ id: o.id, label: o.label }));
  return seededShuffle(pool, `${scenario.id}:${phase.id}:boss:${state.bossStep}`);
}

// ── internal: push a log row ─────────────────────────────────────────
function logRow(state, phase, { actionId, label, cat, kind, ok, points, note }) {
  return { turn: state.turn, phaseId: phase.id, actionId, label, cat, kind, ok, points, note };
}

// ── internal: advance the phase counter after an action/timeout resolves.
// Advances when all keys done OR the phase turn budget is spent. On a
// force-advance with keys still undone, applies the miss penalty and records
// them. Returns { state, phaseAdvanced, newPhaseIndex }. Also folds in the
// stability<=0 loss check so every mutation path funnels through here.
function resolveProgression(scenario, state) {
  let s = state;
  const phase = scenario.phases[s.phaseIndex];

  // stability floor kills the run immediately, regardless of phase progress.
  if (s.stability <= 0 && s.status === 'running') {
    return { state: { ...s, stability: 0, status: 'lost', lossReason: 'stability' }, phaseAdvanced: false, newPhaseIndex: s.phaseIndex };
  }
  if (s.status !== 'running') return { state: s, phaseAdvanced: false, newPhaseIndex: s.phaseIndex };
  if (phase.strict) return { state: s, phaseAdvanced: false, newPhaseIndex: s.phaseIndex };

  const undone = undoneKeyIds(phase, s);
  const budgetUsed = s._phaseTurns >= phase.turns;
  const allKeysDone = undone.length === 0;
  if (!allKeysDone && !budgetUsed) {
    return { state: s, phaseAdvanced: false, newPhaseIndex: s.phaseIndex };
  }

  // Force-advance penalty for keys left undone when the budget ran out.
  if (!allKeysDone) {
    s = {
      ...s,
      stability: s.stability - MISS_PENALTY * undone.length,
      missedKeyIds: [...s.missedKeyIds, ...undone],
    };
    // A big miss can itself drop stability to zero → stability loss wins.
    if (s.stability <= 0) {
      return { state: { ...s, stability: 0, status: 'lost', lossReason: 'stability' }, phaseAdvanced: false, newPhaseIndex: s.phaseIndex };
    }
  }

  const newIndex = s.phaseIndex + 1;
  s = { ...s, phaseIndex: newIndex, _phaseTurns: 0 };
  return { state: s, phaseAdvanced: true, newPhaseIndex: newIndex };
}

// =====================================================================
// applyAction — resolve a tap. Returns { state, feedback }.
// feedback = { ok, kind, points, note, phaseAdvanced, newPhaseIndex }.
// =====================================================================
export function applyAction(scenario, state, actionId) {
  const phase = currentPhase(scenario, state);
  if (state.status !== 'running') {
    return { state, feedback: { ok: false, kind: null, points: 0, note: 'run already ended', phaseAdvanced: false, newPhaseIndex: state.phaseIndex } };
  }

  // ── Boss phase: strict ordered sequence ──
  if (phase.strict) {
    const expected = phase.sequence[state.bossStep];
    if (expected && actionId === expected.id) {
      const nextStep = state.bossStep + 1;
      const cleared = nextStep >= phase.sequence.length;
      const stepPts = BOSS_STEP_POINTS + (cleared ? BOSS_WIN_BONUS : 0);
      let s = {
        ...state,
        bossStep: nextStep,
        score: state.score + stepPts,
        log: [...state.log, logRow(state, phase, {
          actionId, label: expected.label, cat: 'intervene', kind: 'key',
          ok: true, points: stepPts, note: expected.why,
        })],
      };
      if (cleared) s = { ...s, status: 'won' };
      return { state: s, feedback: { ok: true, kind: 'key', points: stepPts, note: expected.why, phaseAdvanced: false, newPhaseIndex: state.phaseIndex } };
    }
    // Any decoy OR an out-of-order step → instant loss.
    const chosen = [...phase.sequence, ...phase.decoys].find((o) => o.id === actionId);
    const note = chosen ? chosen.why : 'not a valid step';
    const s = {
      ...state,
      status: 'lost',
      lossReason: 'boss-wrong',
      log: [...state.log, logRow(state, phase, {
        actionId, label: chosen ? chosen.label : actionId, cat: 'intervene', kind: 'harm',
        ok: false, points: 0, note,
      })],
    };
    return { state: s, feedback: { ok: false, kind: 'harm', points: 0, note, phaseAdvanced: false, newPhaseIndex: state.phaseIndex } };
  }

  // ── Non-boss phase ──
  const action = (phase.actions || []).find((a) => a.id === actionId);
  if (!action) {
    return { state, feedback: { ok: false, kind: null, points: 0, note: 'unknown action', phaseAdvanced: false, newPhaseIndex: state.phaseIndex } };
  }
  // A key already done is a no-op — cannot be farmed for points.
  if (action.kind === 'key' && state.doneActionIds.includes(actionId)) {
    return { state, feedback: { ok: false, kind: 'key', points: 0, note: 'already done', phaseAdvanced: false, newPhaseIndex: state.phaseIndex } };
  }

  let s = state;
  let ok, points, note;
  if (action.kind === 'key') {
    ok = true; points = KEY_POINTS; note = action.log;
    const eff = action.effects || {};
    const nextVitals = { ...s.vitals };
    if (eff.vitals) for (const k of VITAL_KEYS) if (Number.isFinite(eff.vitals[k])) nextVitals[k] = eff.vitals[k];
    s = {
      ...s,
      score: s.score + points,
      doneActionIds: [...s.doneActionIds, actionId],
      flags: { ...s.flags, ...(eff.flags || {}) },
      stability: s.stability + (Number.isFinite(eff.stability) ? eff.stability : 0),
      vitals: nextVitals,
      log: [...s.log, logRow(s, phase, { actionId, label: action.label, cat: action.cat, kind: 'key', ok: true, points, note })],
    };
  } else {
    // harm / neutral: stability hit, 0 points. Uses action.stability override
    // when present, else the kind default.
    const pen = Number.isFinite(action.stability) ? action.stability : (action.kind === 'harm' ? HARM_PENALTY : NEUTRAL_PENALTY);
    ok = false; points = 0; note = action.why;
    s = {
      ...s,
      stability: s.stability - pen,
      log: [...s.log, logRow(s, phase, { actionId, label: action.label, cat: action.cat, kind: action.kind, ok: false, points: 0, note })],
    };
  }

  // turn advances after every action.
  s = { ...s, turn: s.turn + 1, _phaseTurns: s._phaseTurns + 1 };
  const prog = resolveProgression(scenario, s);
  return { state: prog.state, feedback: { ok, kind: action.kind, points, note, phaseAdvanced: prog.phaseAdvanced, newPhaseIndex: prog.newPhaseIndex } };
}

// =====================================================================
// applyTimeout — a timer expired. Boss countdown → boss-timeout loss.
// Chaos decision timer → hesitation: stability -10, log an ok:false row,
// turn +1, run the phase-advance check.
// =====================================================================
export function applyTimeout(scenario, state) {
  const phase = currentPhase(scenario, state);
  if (state.status !== 'running') {
    return { state, feedback: { ok: false, kind: null, points: 0, note: 'run already ended', phaseAdvanced: false, newPhaseIndex: state.phaseIndex } };
  }
  if (phase.strict) {
    const s = {
      ...state,
      status: 'lost',
      lossReason: 'boss-timeout',
      log: [...state.log, logRow(state, phase, {
        actionId: null, label: 'Countdown expired', cat: 'intervene', kind: 'harm',
        ok: false, points: 0, note: 'The boss window closed before the sequence was completed.',
      })],
    };
    return { state: s, feedback: { ok: false, kind: 'harm', points: 0, note: s.log[s.log.length - 1].note, phaseAdvanced: false, newPhaseIndex: state.phaseIndex } };
  }

  // Chaos decision-timer hesitation.
  let s = {
    ...state,
    stability: state.stability - HESITATE_PENALTY,
    log: [...state.log, logRow(state, phase, {
      actionId: null, label: 'Hesitation', cat: 'assess', kind: 'neutral',
      ok: false, points: 0, note: 'You froze — precious seconds lost while the patient deteriorated.',
    })],
  };
  s = { ...s, turn: s.turn + 1, _phaseTurns: s._phaseTurns + 1 };
  const prog = resolveProgression(scenario, s);
  return { state: prog.state, feedback: { ok: false, kind: 'neutral', points: 0, note: s.log[s.log.length - 1].note, phaseAdvanced: prog.phaseAdvanced, newPhaseIndex: prog.newPhaseIndex } };
}

// =====================================================================
// stepVitals — drift the displayed vitals one tick toward the phase target,
// with a little jitter. Pure: rng injected. Clamps to sane floors and rounds.
//   next = cur + (target-cur)*DRIFT + (rng()-0.5)*jitter
// =====================================================================
const JITTER = { hr: 1.5, sbp: 1.5, dbp: 1.5, spo2: 0.6, rr: 0.6, temp: 0.05 };
const FLOORS = { hr: 20, sbp: 40, dbp: 20, spo2: 40, rr: 4, temp: 30 };
const CEILS = { spo2: 100, temp: 43 };

export function stepVitals(current, target, rng) {
  const out = {};
  for (const k of VITAL_KEYS) {
    const cur = Number.isFinite(current[k]) ? current[k] : 0;
    const tgt = Number.isFinite(target[k]) ? target[k] : cur;
    let v = cur + (tgt - cur) * DRIFT + (rng() - 0.5) * JITTER[k];
    if (FLOORS[k] != null) v = Math.max(FLOORS[k], v);
    if (CEILS[k] != null) v = Math.min(CEILS[k], v);
    out[k] = k === 'temp' ? Math.round(v * 10) / 10 : Math.round(v);
  }
  return out;
}

// =====================================================================
// scoreRun — final tally. coins = score (already folds boss points + bonus),
// doubled on a flashpoint day, floored and never negative.
// =====================================================================
export function scoreRun(state, opts = {}) {
  const base = Number.isFinite(state.score) ? state.score : 0;
  let coins = opts.flashpoint ? base * 2 : base;
  coins = Math.max(0, Math.floor(coins));
  const correctActions = state.log.filter((l) => l.ok && l.points > 0).length;
  return {
    coins,
    correctActions,
    totalActions: state.log.length,
    bossCleared: state.status === 'won',
  };
}
