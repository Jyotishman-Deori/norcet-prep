// Contract test for src/lib/ward-boss-engine.js — runnable under Node:
//   node src/lib/ward-boss-engine.test.js
// PART 1 uses an INLINE minimal 4-phase scenario (self-contained, always runs).
// PART 2 lints the real data file IF it exists yet (authored in parallel).
import assert from 'node:assert/strict';
import {
  validateScenario, initRun, currentPhase, isBossPhase,
  visibleActions, bossOptions, applyAction, applyTimeout,
  stepVitals, scoreRun,
  START_STABILITY, KEY_POINTS, HARM_PENALTY, MISS_PENALTY,
  BOSS_STEP_POINTS, BOSS_WIN_BONUS, HESITATE_PENALTY, VITAL_KEYS,
} from './ward-boss-engine.js';

// ── an INLINE minimal valid 4-phase scenario ────────────────────────
const V = { hr: 90, sbp: 120, dbp: 78, spo2: 97, rr: 16, temp: 37.0 };
function makeScenario() {
  return {
    id: 'test-scn', title: 'Test', category: 'test', difficulty: 2,
    patient: { name: 'Test Patient', age: 60, sex: 'M', history: 'none' },
    intro: 'intro',
    vitalsStart: { ...V },
    phases: [
      { id: 'p1', label: 'Simmer', turns: 3, alarm: 'none', brief: 'b1',
        vitals: { ...V, hr: 110 },
        actions: [
          { id: 'p1k1', cat: 'assess', kind: 'key', label: 'K1', log: 'did k1' },
          { id: 'p1k2', cat: 'intervene', kind: 'key', label: 'K2', log: 'did k2',
            effects: { stability: 5, flags: { line: true }, vitals: { spo2: 99 } } },
          { id: 'p1h1', cat: 'communicate', kind: 'harm', label: 'H1', why: 'bad idea' },
          { id: 'p1n1', cat: 'assess', kind: 'neutral', label: 'N1', why: 'wasted time' },
        ] },
      { id: 'p2', label: 'Complication', turns: 2, alarm: 'soft', brief: 'b2',
        vitals: { ...V, hr: 130, spo2: 90 },
        actions: [
          { id: 'p2k1', cat: 'intervene', kind: 'key', label: 'K1', log: 'did p2k1' },
          { id: 'p2h1', cat: 'communicate', kind: 'harm', label: 'H1', why: 'bad p2' },
        ] },
      { id: 'p3', label: 'Chaos', turns: 2, alarm: 'loud', brief: 'b3', decisionSec: 8,
        vitals: { ...V, hr: 150, spo2: 84, sbp: 80 },
        actions: [
          { id: 'p3k1', cat: 'intervene', kind: 'key', label: 'K1', log: 'did p3k1' },
          { id: 'p3n1', cat: 'assess', kind: 'neutral', label: 'N1', why: 'too slow' },
        ] },
      { id: 'boss', label: 'Final Boss', alarm: 'boss', strict: true, countdownSec: 20, brief: 'bboss',
        vitals: { ...V, hr: 40, spo2: 70, sbp: 60 },
        sequence: [
          { id: 's1', label: 'Step 1', why: 'first correct step' },
          { id: 's2', label: 'Step 2', why: 'second correct step' },
        ],
        decoys: [
          { id: 'd1', label: 'Decoy 1', why: 'wrong — kills patient' },
          { id: 'd2', label: 'Decoy 2', why: 'also wrong' },
        ] },
    ],
    debriefWin: 'you won', debriefLoss: 'you lost', examTip: 'a tip',
  };
}

// =====================================================================
// PART 1 — engine behaviour against the inline scenario
// =====================================================================

// ---- validateScenario accepts a good scenario ----
assert.equal(validateScenario(makeScenario()), null);

// ---- initRun shape ----
{
  const sc = makeScenario();
  const s = initRun(sc);
  assert.equal(s.status, 'running');
  assert.equal(s.stability, START_STABILITY);
  assert.equal(s.phaseIndex, 0);
  assert.equal(s.turn, 1);
  assert.deepEqual(s.vitals, sc.vitalsStart);
  assert.deepEqual(s.doneActionIds, []);
  assert.equal(isBossPhase(sc, s), false);
  assert.equal(currentPhase(sc, s).id, 'p1');
}

// ---- scripted FULL WIN: all keys correct + boss in order ----
{
  const sc = makeScenario();
  let s = initRun(sc);
  let f;

  // Phase 1: do both keys (all keys done → advance). K2 applies effects.
  ({ state: s, feedback: f } = applyAction(sc, s, 'p1k1'));
  assert.equal(f.ok, true); assert.equal(f.points, KEY_POINTS);
  assert.equal(f.phaseAdvanced, false);
  ({ state: s, feedback: f } = applyAction(sc, s, 'p1k2'));
  assert.equal(f.phaseAdvanced, true);
  assert.equal(f.newPhaseIndex, 1);
  assert.equal(s.flags.line, true, 'K2 effects merged flags');
  assert.equal(s.vitals.spo2, 99, 'K2 effects nudged vitals immediately');
  assert.equal(s.stability, START_STABILITY + 5, 'K2 effects added stability');

  // Phase 2: single key → advance.
  ({ state: s, feedback: f } = applyAction(sc, s, 'p2k1'));
  assert.equal(f.phaseAdvanced, true);
  assert.equal(f.newPhaseIndex, 2);
  assert.equal(currentPhase(sc, s).id, 'p3');

  // Phase 3: single key → advance into boss.
  ({ state: s, feedback: f } = applyAction(sc, s, 'p3k1'));
  assert.equal(f.phaseAdvanced, true);
  assert.equal(f.newPhaseIndex, 3);
  assert.equal(isBossPhase(sc, s), true);

  // Boss: step 1 then step 2 → win + bonus.
  ({ state: s, feedback: f } = applyAction(sc, s, 's1'));
  assert.equal(f.ok, true); assert.equal(f.points, BOSS_STEP_POINTS);
  assert.equal(s.status, 'running'); assert.equal(s.bossStep, 1);
  ({ state: s, feedback: f } = applyAction(sc, s, 's2'));
  assert.equal(f.points, BOSS_STEP_POINTS + BOSS_WIN_BONUS);
  assert.equal(s.status, 'won');
  assert.equal(s.lossReason, null);

  // Score math: 4 keys × 15 + 2 boss steps × 25 + 50 bonus = 60 + 50 + 50 = 160.
  const expected = 4 * KEY_POINTS + 2 * BOSS_STEP_POINTS + BOSS_WIN_BONUS;
  assert.equal(s.score, expected, `score should be ${expected}, got ${s.score}`);

  // scoreRun: coins = score; flashpoint doubles; bossCleared true.
  const plain = scoreRun(s, {});
  assert.equal(plain.coins, expected);
  assert.equal(plain.bossCleared, true);
  assert.equal(plain.correctActions, 6, '4 keys + 2 boss steps scored > 0');
  assert.equal(plain.totalActions, s.log.length);
  assert.equal(scoreRun(s, { flashpoint: true }).coins, expected * 2);
}

// ---- LOSS by stability: spam harm actions ----
{
  const sc = makeScenario();
  let s = initRun(sc);
  // Keep tapping the CURRENT phase's harm/neutral action. Phases force-advance
  // when their turn budget is spent (with -10 per missed key), so the damage
  // compounds: p1 3×harm (-45) + 2 missed keys (-20) → 35; p2 2×harm (-30) +
  // 1 missed key (-10) → below zero → lost by stability.
  let taps = 0;
  while (s.status === 'running' && taps < 30) {
    const ph = currentPhase(sc, s);
    const bad = (ph.actions || []).find((a) => a.kind === 'harm' || a.kind === 'neutral');
    assert.ok(bad, 'loss-by-stability walk should never reach the boss phase');
    ({ state: s } = applyAction(sc, s, bad.id));
    taps++;
  }
  assert.equal(s.status, 'lost');
  assert.equal(s.lossReason, 'stability');
  assert.ok(s.stability <= 0);
  assert.equal(taps, 5, '3 harms in p1 + 2 in p2 end the run');
}

// ---- LOSS by boss-wrong: tap a decoy ----
{
  const sc = makeScenario();
  let s = initRun(sc);
  // fast-forward to boss via keys
  ({ state: s } = applyAction(sc, s, 'p1k1'));
  ({ state: s } = applyAction(sc, s, 'p1k2'));
  ({ state: s } = applyAction(sc, s, 'p2k1'));
  ({ state: s } = applyAction(sc, s, 'p3k1'));
  assert.equal(isBossPhase(sc, s), true);
  const { state: s2, feedback: f } = applyAction(sc, s, 'd1');
  assert.equal(s2.status, 'lost');
  assert.equal(s2.lossReason, 'boss-wrong');
  assert.equal(f.note, 'wrong — kills patient', 'feedback carries the decoy why');
}

// ---- LOSS by boss-wrong: out-of-order sequence step ----
{
  const sc = makeScenario();
  let s = initRun(sc);
  ({ state: s } = applyAction(sc, s, 'p1k1'));
  ({ state: s } = applyAction(sc, s, 'p1k2'));
  ({ state: s } = applyAction(sc, s, 'p2k1'));
  ({ state: s } = applyAction(sc, s, 'p3k1'));
  // s2 tapped first (expected is s1) → out of order → loss.
  const { state: s2 } = applyAction(sc, s, 's2');
  assert.equal(s2.status, 'lost');
  assert.equal(s2.lossReason, 'boss-wrong');
}

// ---- LOSS by boss-timeout: applyTimeout in boss ----
{
  const sc = makeScenario();
  let s = initRun(sc);
  ({ state: s } = applyAction(sc, s, 'p1k1'));
  ({ state: s } = applyAction(sc, s, 'p1k2'));
  ({ state: s } = applyAction(sc, s, 'p2k1'));
  ({ state: s } = applyAction(sc, s, 'p3k1'));
  assert.equal(isBossPhase(sc, s), true);
  const { state: s2, feedback: f } = applyTimeout(sc, s);
  assert.equal(s2.status, 'lost');
  assert.equal(s2.lossReason, 'boss-timeout');
  assert.equal(f.ok, false);
}

// ---- force-advance: exhaust the turn budget with keys undone ----
{
  const sc = makeScenario();
  let s = initRun(sc);
  let f;
  // p1 budget is 3 turns. Tap the neutral (-5) three times — no key done.
  // On the 3rd action _phaseTurns hits the budget → force-advance.
  // Undone keys = p1k1, p1k2 → -10 each = -20 stability, both in missedKeyIds.
  ({ state: s, feedback: f } = applyAction(sc, s, 'p1n1'));
  assert.equal(f.phaseAdvanced, false);
  ({ state: s, feedback: f } = applyAction(sc, s, 'p1n1'));
  assert.equal(f.phaseAdvanced, false);
  ({ state: s, feedback: f } = applyAction(sc, s, 'p1n1'));
  assert.equal(f.phaseAdvanced, true, 'budget spent → force-advance');
  assert.equal(f.newPhaseIndex, 1);
  assert.deepEqual(s.missedKeyIds.sort(), ['p1k1', 'p1k2']);
  // stability: 100 - 3*5 (neutrals) - 2*10 (missed keys) = 65.
  assert.equal(s.stability, START_STABILITY - 3 * 5 - 2 * MISS_PENALTY);
}

// ---- visibleActions: deterministic + done-key removal ----
{
  const sc = makeScenario();
  const s = initRun(sc);
  const a1 = visibleActions(sc, s);
  const a2 = visibleActions(sc, s);
  assert.deepEqual(a1, a2, 'two calls must be identical (seeded shuffle)');
  // All 4 p1 actions present, grouped by cat.
  const allIds = [...a1.assess, ...a1.intervene, ...a1.communicate].map((x) => x.id).sort();
  assert.deepEqual(allIds, ['p1h1', 'p1k1', 'p1k2', 'p1n1']);
  // After doing p1k1, it disappears from the visible set.
  const { state: s2 } = applyAction(sc, s, 'p1k1');
  const a3 = visibleActions(sc, s2);
  const flat3 = [...a3.assess, ...a3.intervene, ...a3.communicate].map((x) => x.id);
  assert.ok(!flat3.includes('p1k1'), 'done key removed');
  assert.ok(flat3.includes('p1k2'), 'undone key still shown');
}

// ---- bossOptions: remaining steps + all decoys, deterministic ----
{
  const sc = makeScenario();
  let s = initRun(sc);
  ({ state: s } = applyAction(sc, s, 'p1k1'));
  ({ state: s } = applyAction(sc, s, 'p1k2'));
  ({ state: s } = applyAction(sc, s, 'p2k1'));
  ({ state: s } = applyAction(sc, s, 'p3k1'));
  const o1 = bossOptions(sc, s);
  const o2 = bossOptions(sc, s);
  assert.deepEqual(o1, o2, 'stable across renders');
  const ids = o1.map((x) => x.id).sort();
  assert.deepEqual(ids, ['d1', 'd2', 's1', 's2'], 'all remaining steps + all decoys');
  // After clearing step 1, s1 drops out; s2 + both decoys remain.
  const { state: s3 } = applyAction(sc, s, 's1');
  const o3 = bossOptions(sc, s3).map((x) => x.id).sort();
  assert.deepEqual(o3, ['d1', 'd2', 's2']);
}

// ---- applyTimeout hesitation (chaos) ----
{
  const sc = makeScenario();
  let s = initRun(sc);
  // Get to chaos (p3) via keys.
  ({ state: s } = applyAction(sc, s, 'p1k1'));
  ({ state: s } = applyAction(sc, s, 'p1k2'));
  ({ state: s } = applyAction(sc, s, 'p2k1'));
  assert.equal(currentPhase(sc, s).id, 'p3');
  const st0 = s.stability;
  const { state: s2, feedback: f } = applyTimeout(sc, s);
  assert.equal(s2.stability, st0 - HESITATE_PENALTY);
  assert.equal(f.ok, false);
  assert.equal(s2.log[s2.log.length - 1].ok, false);
  assert.equal(s2.turn, s.turn + 1);
}

// ---- stepVitals: converges toward target + clamps + rounding ----
{
  const half = () => 0.5;   // rng that zeroes the jitter term
  // Converge: repeatedly stepping toward a target moves cur closer each tick.
  let cur = { hr: 90, sbp: 120, dbp: 78, spo2: 97, rr: 16, temp: 37.0 };
  const target = { hr: 150, sbp: 80, dbp: 50, spo2: 84, rr: 30, temp: 39.5 };
  const first = stepVitals(cur, target, half);
  assert.ok(first.hr > cur.hr && first.hr < target.hr, 'hr drifts up toward target');
  assert.ok(first.sbp < cur.sbp && first.sbp > target.sbp, 'sbp drifts down toward target');
  // Integer rounding for hr/sbp/dbp/spo2/rr, 1-decimal for temp.
  assert.equal(first.hr, Math.round(first.hr));
  assert.equal(Math.round(first.temp * 10) / 10, first.temp);
  // Run many ticks — vitals close in on target. With the jitter term zeroed,
  // integer rounding creates a fixed point up to 3 units short of the target
  // (a 0.45 step rounds away); live play always has jitter to unstick it.
  for (let i = 0; i < 60; i++) cur = stepVitals(cur, target, half);
  for (const k of VITAL_KEYS) {
    assert.ok(Math.abs(cur[k] - target[k]) < 4, `${k} converged (${cur[k]} vs ${target[k]})`);
  }
  // Clamp floors: driving spo2 toward an absurd low never goes below 40.
  let low = { hr: 30, sbp: 45, dbp: 25, spo2: 50, rr: 6, temp: 35 };
  const crush = { hr: 0, sbp: 0, dbp: 0, spo2: 0, rr: 0, temp: 0 };
  for (let i = 0; i < 200; i++) low = stepVitals(low, crush, half);
  assert.ok(low.hr >= 20, 'hr clamped >= 20');
  assert.ok(low.spo2 >= 40, 'spo2 clamped >= 40');
  // Ceiling: spo2 cannot exceed 100.
  let high = { hr: 90, sbp: 120, dbp: 78, spo2: 99, rr: 16, temp: 37 };
  const up = { hr: 90, sbp: 120, dbp: 78, spo2: 200, rr: 16, temp: 37 };
  for (let i = 0; i < 100; i++) high = stepVitals(high, up, half);
  assert.ok(high.spo2 <= 100, 'spo2 clamped <= 100');
}

// ---- validateScenario catches the classic authoring mistakes ----
{
  // missing boss decoys
  const a = makeScenario(); a.phases[3].decoys = [a.phases[3].decoys[0]];
  assert.ok(typeof validateScenario(a) === 'string' && /decoy/i.test(validateScenario(a)));

  // duplicate ids across the scenario
  const b = makeScenario(); b.phases[1].actions[0].id = 'p1k1';
  assert.ok(/duplicate/i.test(validateScenario(b)));

  // a key action with no log line
  const c = makeScenario(); delete c.phases[0].actions[0].log;
  assert.ok(/log/i.test(validateScenario(c)));

  // wrong phase count (3 phases)
  const d = makeScenario(); d.phases = d.phases.slice(0, 3);
  assert.ok(/EXACTLY 4/i.test(validateScenario(d)));

  // difficulty out of range
  const e = makeScenario(); e.difficulty = 9;
  assert.ok(/difficulty/i.test(validateScenario(e)));

  // harm action with no why
  const g = makeScenario(); delete g.phases[0].actions[2].why;
  assert.ok(/why/i.test(validateScenario(g)));

  // boss missing strict
  const h = makeScenario(); delete h.phases[3].strict;
  assert.ok(/strict/i.test(validateScenario(h)));

  // countdownSec too small
  const j = makeScenario(); j.phases[3].countdownSec = 5;
  assert.ok(/countdownSec/i.test(validateScenario(j)));

  // the id is included in the message when present
  const k = makeScenario(); k.phases[0].actions = [k.phases[0].actions[0]]; // <2 actions
  assert.ok(validateScenario(k).startsWith('[test-scn]'), 'error names the scenario id');
}

console.log('ward-boss-engine.test.js PART 1: all assertions passed');

// =====================================================================
// PART 2 — data-file lint (authored in parallel; deferred if absent)
// =====================================================================
async function part2() {
  let mod;
  try {
    mod = await import('../data/ward-boss-scenarios.js');
  } catch {
    console.log('ward-boss-scenarios.js not present yet — data lint deferred to orchestrator gate');
    return;
  }

  // Collect every exported scenario (support a default array, a named array,
  // or individually-exported scenario objects).
  const scenarios = [];
  const seen = new Set(); // the named + default exports are the SAME array — dedupe by identity
  const pushIfScenario = (v) => {
    if (v && typeof v === 'object' && Array.isArray(v.phases) && !seen.has(v)) { seen.add(v); scenarios.push(v); }
  };
  for (const val of Object.values(mod)) {
    if (Array.isArray(val)) val.forEach(pushIfScenario);
    else pushIfScenario(val);
  }
  assert.ok(scenarios.length > 0, 'ward-boss-scenarios.js exports at least one scenario');

  // Every scenario validates.
  for (const sc of scenarios) {
    const err = validateScenario(sc);
    assert.equal(err, null, `scenario failed validation: ${err}`);
  }

  // Cross-check every ecgId against the real ECG_RHYTHMS ids.
  const ecg = await import('../data/ecg-rhythms.js');
  const rhythms = ecg.ECG_RHYTHMS || ecg.default;
  assert.ok(Array.isArray(rhythms), 'ECG_RHYTHMS export not found');
  const rhythmIds = new Set(rhythms.map((r) => r.id));
  for (const sc of scenarios) {
    for (const ph of sc.phases) {
      if (ph.ecgId != null) {
        assert.ok(rhythmIds.has(ph.ecgId), `[${sc.id}] phase ${ph.id} references unknown ecgId "${ph.ecgId}"`);
      }
    }
  }
  console.log(`ward-boss-engine.test.js PART 2: linted ${scenarios.length} scenario(s), all valid`);
}

await part2();
console.log('ward-boss-engine.test.js: all assertions passed');
