// Contract test for src/lib/titration-engine.js — runnable under Node:
//   node src/lib/titration-engine.test.js
// PART 1 uses INLINE drug fixtures (self-contained, always runs).
// PART 2 lints the real data file IF it exists yet (authored in parallel).
import assert from 'node:assert/strict';
import {
  validateDrug, pumpRate, zoneFor, trackTargets,
  stepVitals, tickHold, crisisState, roundScore,
  UNIT_KINDS, WIN_COINS, CLEAN_BONUS,
} from './titration-engine.js';

// =====================================================================
// INLINE drug fixtures
// =====================================================================
// Norepinephrine: 4 mg in 250 mL = 16 mcg/mL, weight-based mcg/kg/min.
function makeNorepi() {
  return {
    id: 'norepi', name: 'Norepinephrine', mix: '4 mg in 250 mL (16 mcg/mL)',
    unitKind: 'mcgkgmin', unitLabel: 'mcg/kg/min',
    doseMin: 0, doseMax: 1, doseStep: 0.02, concPerMl: 16,
    weightRange: [40, 120], weightDefault: 70,
    safeWindow: [0.1, 0.3], holdSec: 8,
    goal: 'Titrate to a MAP of 65 mmHg.',
    tracks: [
      { key: 'map', label: 'MAP', unit: 'mmHg', base: 50, target: 68, overSlope: 90, alarmLow: 55, alarmHigh: 110 },
      { key: 'hr', label: 'HR', unit: 'bpm', base: 96, target: 88, overSlope: 120, alarmLow: 45, alarmHigh: 140 },
    ],
    zoneLabels: { under: 'Hypotensive', therapeutic: 'Perfusing', over: 'Vasoconstricted' },
    rationale: 'First-line pressor in septic shock.',
    examTip: 'Central line preferred; extravasation causes necrosis.',
  };
}

// A mg/hr drug (e.g. a nitrate infusion), no weight in the math.
function makeNitro() {
  return {
    id: 'nitro', name: 'Nitroglycerin', mix: '50 mg in 250 mL (200 mcg/mL)',
    unitKind: 'mghr', unitLabel: 'mg/hr',
    doseMin: 0, doseMax: 12, doseStep: 0.5, concPerMl: 0.2,
    weightRange: [40, 120], weightDefault: 70,
    safeWindow: [2, 6], holdSec: 6,
    goal: 'Relieve chest pain without dropping SBP below 90.',
    tracks: [
      { key: 'sbp', label: 'SBP', unit: 'mmHg', base: 168, target: 130, overSlope: -18, alarmLow: 85, alarmHigh: 180 },
    ],
    zoneLabels: { under: 'Hypertensive', therapeutic: 'Controlled', over: 'Hypotensive' },
    rationale: 'Venodilator; reduces preload.',
    examTip: 'Contraindicated with recent PDE5 inhibitors.',
  };
}

// A units/kg/hr drug (heparin), weight-based.
function makeHeparin() {
  return {
    id: 'heparin', name: 'Heparin', mix: '25000 units in 250 mL (100 units/mL)',
    unitKind: 'unitskghr', unitLabel: 'units/kg/hr',
    doseMin: 0, doseMax: 30, doseStep: 1, concPerMl: 100,
    weightRange: [40, 120], weightDefault: 80,
    safeWindow: [12, 18], holdSec: 6,
    goal: 'Reach a therapeutic aPTT.',
    tracks: [
      { key: 'aptt', label: 'aPTT', unit: 'sec', base: 30, target: 70, overSlope: 6, alarmLow: 40, alarmHigh: 120 },
    ],
    zoneLabels: { under: 'Sub-therapeutic', therapeutic: 'Anticoagulated', over: 'Bleeding risk' },
    rationale: 'Weight-based nomogram dosing.',
    examTip: 'Monitor aPTT q6h; protamine reverses.',
  };
}

// =====================================================================
// PART 1 — engine behaviour against inline fixtures
// =====================================================================

// ---- pumpRate: hand-computed per unitKind, rounding, non-negative ----
{
  const norepi = makeNorepi();
  // (0.1 * 70 * 60) / 16 = 420 / 16 = 26.25 → 26.3 (1 dp)
  assert.equal(pumpRate(0.1, 70, norepi), 26.3);
  // dose 0 → 0
  assert.equal(pumpRate(0, 70, norepi), 0);
  // exactly 1 decimal place of rounding
  const r = pumpRate(0.13, 83, norepi); // (0.13*83*60)/16 = 647.4/16 = 40.4625 → 40.5
  assert.equal(r, 40.5);
  assert.equal(Math.round(r * 10) / 10, r, 'rounded to 1 dp');

  // mghr: nitro dose 4 mg/hr, conc 0.2 mg/mL → 4/0.2 = 20 mL/hr (weight irrelevant)
  const nitro = makeNitro();
  assert.equal(pumpRate(4, 70, nitro), 20);
  assert.equal(pumpRate(4, 999, nitro), 20, 'mghr ignores weight');
  assert.equal(pumpRate(0, 70, nitro), 0);

  // unitskghr: heparin 15 units/kg/hr × 80 kg / 100 units/mL = 1200/100 = 12 mL/hr
  const hep = makeHeparin();
  assert.equal(pumpRate(15, 80, hep), 12);
  assert.equal(pumpRate(15, 40, hep), 6, 'heparin scales with weight');

  // hostile inputs: negative dose / weight never mint a negative rate
  assert.equal(pumpRate(-5, 70, norepi), 0);
  assert.equal(pumpRate(0.1, -70, norepi), 0);
  assert.ok(pumpRate(0.5, 70, norepi) >= 0);
}

// ---- pumpRate: the two remaining unitKinds (mcgmin, mcgkghr) ----
{
  // mcgmin: (dose*60)/conc — model a nicardipine-style fixed-rate drug.
  const d = { ...makeNitro(), unitKind: 'mcgmin', concPerMl: 100 };
  assert.equal(pumpRate(50, 70, d), 30); // (50*60)/100 = 30
  // mcgkghr: (dose*weight)/conc
  const e = { ...makeHeparin(), unitKind: 'mcgkghr', concPerMl: 50 };
  assert.equal(pumpRate(10, 50, e), 10); // (10*50)/50 = 10
}

// ---- zoneFor: under / therapeutic (endpoints inclusive) / over ----
{
  const norepi = makeNorepi(); // safeWindow [0.1, 0.3]
  assert.equal(zoneFor(0.05, norepi), 'under');
  assert.equal(zoneFor(0.1, norepi), 'therapeutic', 'low endpoint inclusive');
  assert.equal(zoneFor(0.2, norepi), 'therapeutic');
  assert.equal(zoneFor(0.3, norepi), 'therapeutic', 'high endpoint inclusive');
  assert.equal(zoneFor(0.31, norepi), 'over');
  assert.equal(zoneFor(0, norepi), 'under');
}

// ---- trackTargets: monotonic sweep, base at 0, plateau in band, spike above ----
{
  const norepi = makeNorepi(); // window [0.1, 0.3], map base 50 target 68 overSlope 90
  // At dose 0, map equals base (within rounding).
  assert.equal(trackTargets(0, norepi).map, 50, 'dose 0 → base');
  // Documented WINDOW-INTERIOR choice: FLAT PLATEAU at target across the band.
  assert.equal(trackTargets(0.1, norepi).map, 68, 'target reached at windowLo');
  assert.equal(trackTargets(0.2, norepi).map, 68, 'flat plateau mid-band');
  assert.equal(trackTargets(0.3, norepi).map, 68, 'still target at windowHi');
  // Above the window: crisis spike via overSlope. 0.4 → 68 + (0.1*90) = 77.
  assert.equal(trackTargets(0.4, norepi).map, 77, 'overshoot spikes MAP');
  assert.ok(trackTargets(0.5, norepi).map > trackTargets(0.4, norepi).map, 'spike keeps rising');
  // Ceiling clamp: however hard the overdose, the displayed value never exceeds
  // alarmHigh*1.5 — a crisis must read as a convincing number, not an impossible
  // one (no MAP 456 / RR 1414). Huge dose: 68 + (9.7*90) = 941 → clamp 110*1.5 = 165.
  assert.equal(trackTargets(10, norepi).map, Math.round(norepi.tracks[0].alarmHigh * 1.5), 'ceiling clamped at alarmHigh*1.5');

  // Monotonic (non-decreasing for a positive-slope track) across a fine sweep.
  let prev = -Infinity;
  for (let dose = 0; dose <= 1.0001; dose += 0.02) {
    const v = trackTargets(dose, norepi).map;
    assert.ok(v >= prev - 1e-9, `map non-decreasing at dose ${dose.toFixed(2)} (${v} vs ${prev})`);
    prev = v;
  }

  // A NEGATIVE-slope track (nitro SBP) is monotonically NON-INCREASING and its
  // "over" region keeps falling (hypotension), still sensible/monotonic.
  const nitro = makeNitro(); // window [2,6], sbp base 168 target 130 overSlope -18
  assert.equal(trackTargets(0, nitro).sbp, 168, 'dose 0 → base');
  assert.equal(trackTargets(2, nitro).sbp, 130, 'target at windowLo');
  assert.equal(trackTargets(6, nitro).sbp, 130, 'plateau across band');
  assert.equal(trackTargets(8, nitro).sbp, 94, 'over: 130 + (2*-18) = 94');
  let prevN = Infinity;
  for (let dose = 0; dose <= 12.0001; dose += 0.5) {
    const v = trackTargets(dose, nitro).sbp;
    assert.ok(v <= prevN + 1e-9, `sbp non-increasing at dose ${dose} (${v} vs ${prevN})`);
    prevN = v;
  }

  // windowLo == 0 special case: response is already at target from dose 0.
  const zeroLo = makeNorepi();
  zeroLo.safeWindow = [0, 0.3];
  assert.equal(trackTargets(0, zeroLo).map, 68, 'windowLo==0 → target at 0');
  assert.equal(trackTargets(0.15, zeroLo).map, 68, 'still target inside band');
  assert.equal(trackTargets(0.4, zeroLo).map, 77, 'over spike still applies');
}

// ---- stepVitals: converges toward targets (jitter zeroed), rounding ----
{
  const half = () => 0.5;                      // zeroes the (rng-0.5) jitter term
  const targets = { map: 68, hr: 88 };
  let cur = { map: 50, hr: 110 };
  const first = stepVitals(cur, targets, half, 0);
  assert.ok(first.map > cur.map && first.map < targets.map, 'map drifts up toward target');
  assert.ok(first.hr < cur.hr && first.hr > targets.hr, 'hr drifts down toward target');
  assert.equal(first.map, Math.round(first.map), 'integer target → integer rounding');

  // Many ticks converge. Same integer-rounding fixed-point caveat as ward-boss:
  // a sub-0.5 residual step rounds away, so allow a small tolerance.
  for (let i = 0; i < 80; i++) cur = stepVitals(cur, targets, half, 0);
  assert.ok(Math.abs(cur.map - 68) < 4, `map converged (${cur.map} vs 68)`);
  assert.ok(Math.abs(cur.hr - 88) < 4, `hr converged (${cur.hr} vs 88)`);

  // Decimal target → one-decimal rounding.
  const dec = stepVitals({ lactate: 4.0 }, { lactate: 2.5 }, half, 0);
  assert.equal(Math.round(dec.lactate * 10) / 10, dec.lactate, 'one-decimal rounding for decimal target');
  assert.ok(dec.lactate < 4.0 && dec.lactate > 2.5);

  // Never negative even when jitter would push below zero.
  const neg = stepVitals({ x: 0 }, { x: 0 }, () => 0, 100); // (0-0.5)*100 = -50
  assert.ok(neg.x >= 0, 'clamped non-negative');

  // Jitter is applied symmetrically and deterministically for a given rng.
  const j1 = stepVitals({ map: 50 }, { map: 68 }, () => 0.9, 10);
  const j2 = stepVitals({ map: 50 }, { map: 68 }, () => 0.9, 10);
  assert.deepEqual(j1, j2, 'deterministic for a fixed rng');
}

// ---- tickHold: accumulate in therapeutic, RESET on leaving, won at threshold ----
{
  // holdSec 2 → 2000 ms needed.
  let st = { holdMs: 0 };
  let r = tickHold(st, 'therapeutic', 500, 2);
  assert.equal(r.holdMs, 500); assert.equal(r.won, false);
  r = tickHold(r, 'therapeutic', 500, 2);
  assert.equal(r.holdMs, 1000); assert.equal(r.won, false);
  // Leaving the band RESETS the hold to 0.
  const reset = tickHold(r, 'under', 500, 2);
  assert.equal(reset.holdMs, 0, 'leaving therapeutic resets hold');
  const resetOver = tickHold(r, 'over', 500, 2);
  assert.equal(resetOver.holdMs, 0, 'over zone also resets hold');
  // won flips exactly at the threshold.
  let s2 = { holdMs: 1500 };
  const notYet = tickHold(s2, 'therapeutic', 499, 2);
  assert.equal(notYet.won, false, '1999 ms < 2000 → not won');
  const exactly = tickHold(s2, 'therapeutic', 500, 2);
  assert.equal(exactly.holdMs, 2000);
  assert.equal(exactly.won, true, '2000 ms >= 2000 → won');
  // Hostile negative dt can't rewind or farm the hold.
  const neg = tickHold({ holdMs: 800 }, 'therapeutic', -1000, 2);
  assert.equal(neg.holdMs, 800, 'negative dt is ignored');
  // Garbage prior state treated as 0.
  const g = tickHold({}, 'therapeutic', 500, 2);
  assert.equal(g.holdMs, 500);
}

// ---- crisisState: ok → alarm → fail across increasing overMs ----
{
  const alarmMs = 3000, failMs = 8000;
  assert.equal(crisisState(0, alarmMs, failMs), 'ok');
  assert.equal(crisisState(2999, alarmMs, failMs), 'ok');
  assert.equal(crisisState(3000, alarmMs, failMs), 'alarm', 'alarm at threshold');
  assert.equal(crisisState(7999, alarmMs, failMs), 'alarm');
  assert.equal(crisisState(8000, alarmMs, failMs), 'fail', 'fail at threshold');
  assert.equal(crisisState(99999, alarmMs, failMs), 'fail');
  // Inverted args (alarm >= fail) can't produce an alarm window that outlives fail.
  assert.equal(crisisState(5000, 9000, 4000), 'fail', 'clamped: alarm never after fail');
  // Negative / garbage overMs treated as 0 → ok.
  assert.equal(crisisState(-100, alarmMs, failMs), 'ok');
}

// ---- roundScore: win=25, clean win=35, flashpoint doubles, loss=0 ----
{
  assert.equal(roundScore({ won: true, enteredCrisis: true, flashpoint: false }), WIN_COINS); // 25
  assert.equal(roundScore({ won: true, enteredCrisis: false, flashpoint: false }), WIN_COINS + CLEAN_BONUS); // 35
  assert.equal(roundScore({ won: true, enteredCrisis: false, flashpoint: true }), (WIN_COINS + CLEAN_BONUS) * 2); // 70
  assert.equal(roundScore({ won: true, enteredCrisis: true, flashpoint: true }), WIN_COINS * 2); // 50
  assert.equal(roundScore({ won: false, enteredCrisis: false, flashpoint: true }), 0, 'loss earns nothing even on flashpoint');
  assert.equal(roundScore({}), 0, 'undefined win → 0');
  assert.ok(roundScore({ won: true, enteredCrisis: false, flashpoint: true }) >= 0);
}

// ---- validateDrug: accepts good drugs; catches the classic mistakes ----
{
  assert.equal(validateDrug(makeNorepi()), null, 'good norepi valid');
  assert.equal(validateDrug(makeNitro()), null, 'good nitro valid');
  assert.equal(validateDrug(makeHeparin()), null, 'good heparin valid');

  // bad unitKind
  const a = makeNorepi(); a.unitKind = 'mgmin';
  assert.ok(typeof validateDrug(a) === 'string' && /unitKind/i.test(validateDrug(a)));

  // safeWindow outside the dose range (hi > doseMax)
  const b = makeNorepi(); b.safeWindow = [0.1, 2];
  assert.ok(/safeWindow/i.test(validateDrug(b)));

  // safeWindow lo below doseMin
  const b2 = makeNorepi(); b2.doseMin = 0.2; b2.safeWindow = [0.1, 0.3];
  assert.ok(/safeWindow/i.test(validateDrug(b2)));

  // empty tracks
  const c = makeNorepi(); c.tracks = [];
  assert.ok(/tracks/i.test(validateDrug(c)));

  // alarmLow >= alarmHigh
  const d = makeNorepi(); d.tracks[0].alarmLow = 120; d.tracks[0].alarmHigh = 110;
  assert.ok(/alarm/i.test(validateDrug(d)));

  // doseMin >= doseMax
  const e = makeNorepi(); e.doseMin = 1; e.doseMax = 1;
  assert.ok(/doseMin/i.test(validateDrug(e)));

  // doseStep <= 0
  const f = makeNorepi(); f.doseStep = 0;
  assert.ok(/doseStep/i.test(validateDrug(f)));

  // concPerMl <= 0
  const g = makeNorepi(); g.concPerMl = 0;
  assert.ok(/concPerMl/i.test(validateDrug(g)));

  // weightDefault outside range
  const h = makeNorepi(); h.weightDefault = 200;
  assert.ok(/weightDefault/i.test(validateDrug(h)));

  // holdSec < 1
  const j = makeNorepi(); j.holdSec = 0;
  assert.ok(/holdSec/i.test(validateDrug(j)));

  // empty zoneLabels
  const k = makeNorepi(); k.zoneLabels = { under: '', therapeutic: 'x', over: 'y' };
  assert.ok(/zoneLabels/i.test(validateDrug(k)));

  // empty goal
  const l = makeNorepi(); l.goal = '   ';
  assert.ok(/goal/i.test(validateDrug(l)));

  // the id is included in the error message when present
  const m = makeNorepi(); m.tracks = [];
  assert.ok(validateDrug(m).startsWith('[norepi]'), 'error names the drug id');

  // UNIT_KINDS export matches the accepted set (no drift with the contract).
  assert.deepEqual([...UNIT_KINDS].sort(),
    ['mcgkghr', 'mcgkgmin', 'mcgmin', 'mghr', 'unitshr', 'unitskghr']);
}

console.log('titration-engine.test.js PART 1: all assertions passed');

// =====================================================================
// PART 2 — data-file lint (authored in parallel; deferred if absent)
// =====================================================================
async function part2() {
  let mod;
  try {
    mod = await import('../data/titration-drugs.js');
  } catch {
    console.log('titration-drugs.js not present yet — data lint deferred');
    return;
  }

  // Collect every exported drug (default array, named array, or individual
  // drug objects). Dedupe by identity so a re-export of the same array counts once.
  const drugs = [];
  const seen = new Set();
  const pushIfDrug = (v) => {
    if (v && typeof v === 'object' && typeof v.unitKind === 'string' && Array.isArray(v.tracks) && !seen.has(v)) {
      seen.add(v); drugs.push(v);
    }
  };
  for (const val of Object.values(mod)) {
    if (Array.isArray(val)) val.forEach(pushIfDrug);
    else pushIfDrug(val);
  }
  assert.ok(drugs.length > 0, 'titration-drugs.js exports at least one drug');

  for (const drug of drugs) {
    const err = validateDrug(drug);
    assert.equal(err, null, `drug failed validation: ${err}`);
  }

  // Drug ids must be unique (they key the picker + personal bests + trending).
  const ids = drugs.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length,
    `duplicate drug ids: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`);

  console.log(`titration-engine.test.js PART 2: linted ${drugs.length} drug(s), all valid`);
}

await part2();
console.log('titration-engine.test.js: all assertions passed');
