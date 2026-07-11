// Contract test for src/data/calculators.js — runnable under Node:
//   node src/lib/calc-registry.test.js
// The registry is user-facing copy AND the wiring between the screen and the
// pure math, so this sweeps its integrity the same way assistant.test.js
// sweeps the KB: ids, categories, keywords, input shapes, dash hygiene, and a
// live smoke-call of every compute function.
import assert from 'node:assert/strict';
import {
  CALCULATORS, CALC_CATEGORIES, CALC_DISCLAIMER, calculatorById, searchCalculators,
} from '../data/calculators.js';

const INPUT_TYPES = new Set(['number', 'segment', 'select', 'date', 'time']);
const catIds = new Set(CALC_CATEGORIES.map((c) => c.id));

// ---- the disclaimer is the owner's verbatim sentence -----------------------
assert.equal(CALC_DISCLAIMER,
  "For reference and educational use. Always verify against your institution's protocol before clinical use.");

// ---- categories ------------------------------------------------------------
assert.equal(CALC_CATEGORIES.length, 6, 'the six category groups');
assert.deepEqual(CALC_CATEGORIES.map((c) => c.id),
  ['dosage', 'body', 'fluids', 'conversion', 'scores', 'obstetric']);
for (const c of CALC_CATEGORIES) {
  assert.ok(c.label && c.blurb, `category ${c.id} has a label and blurb`);
}

// ---- registry integrity -----------------------------------------------------
assert.ok(CALCULATORS.length >= 21, 'covers all 21 spec items (drug dosage is split into three tools)');
{
  const seen = new Set();
  for (const c of CALCULATORS) {
    assert.ok(c.id && !seen.has(c.id), `duplicate or missing id: ${c.id}`);
    seen.add(c.id);
    assert.ok(catIds.has(c.cat), `${c.id}: unknown category ${c.cat}`);
    assert.ok(typeof c.name === 'string' && c.name.length > 2, `${c.id}: name`);
    assert.ok(typeof c.subtitle === 'string' && c.subtitle.length > 4, `${c.id}: subtitle`);
    assert.ok(Array.isArray(c.keywords) && c.keywords.length >= 2, `${c.id}: needs at least 2 keywords`);
    assert.ok(typeof c.compute === 'function', `${c.id}: compute must be a function`);
    assert.ok(typeof c.formulaLabel === 'string' && c.formulaLabel.length > 4, `${c.id}: formulaLabel`);
    assert.ok(Array.isArray(c.inputs) && c.inputs.length >= 1, `${c.id}: inputs`);

    const inputKeys = new Set();
    for (const inp of c.inputs) {
      assert.ok(INPUT_TYPES.has(inp.type), `${c.id}.${inp.key}: unknown input type ${inp.type}`);
      assert.ok(inp.key && !inputKeys.has(inp.key), `${c.id}: duplicate input key ${inp.key}`);
      inputKeys.add(inp.key);
      assert.ok(typeof inp.label === 'string' && inp.label.length > 0, `${c.id}.${inp.key}: label`);
      if (inp.type === 'segment' || inp.type === 'select') {
        assert.ok(Array.isArray(inp.options) && inp.options.length >= 2, `${c.id}.${inp.key}: options`);
        for (const o of inp.options) {
          assert.ok(typeof o.value === 'string', `${c.id}.${inp.key}: option values are strings`);
          assert.ok(typeof o.label === 'string' && o.label.length > 0, `${c.id}.${inp.key}: option label`);
        }
      }
      // showIf, when present, must reference a sibling segment key and its values
      if (inp.showIf) {
        for (const [k, vals] of Object.entries(inp.showIf)) {
          const ref = c.inputs.find((i) => i.key === k);
          assert.ok(ref && ref.type === 'segment', `${c.id}.${inp.key}: showIf must reference a segment`);
          for (const v of vals) {
            assert.ok(ref.options.some((o) => o.value === v), `${c.id}.${inp.key}: showIf value ${v} not in ${k}`);
          }
        }
      }
    }
  }
}

// ---- every category has at least one calculator ----------------------------
for (const cat of CALC_CATEGORIES) {
  assert.ok(CALCULATORS.some((c) => c.cat === cat.id), `${cat.id} has calculators`);
}

// ---- dash hygiene sweep over ALL user-facing registry copy ------------------
{
  const offenders = [];
  const sweep = (id, field, s) => {
    if (typeof s !== 'string') return;
    if (s.includes('—') || s.includes('--')) offenders.push(`${id}: ${field}`);
  };
  sweep('disclaimer', 'text', CALC_DISCLAIMER);
  for (const cat of CALC_CATEGORIES) { sweep(cat.id, 'label', cat.label); sweep(cat.id, 'blurb', cat.blurb); }
  for (const c of CALCULATORS) {
    sweep(c.id, 'name', c.name);
    sweep(c.id, 'subtitle', c.subtitle);
    sweep(c.id, 'formulaLabel', c.formulaLabel);
    for (const inp of c.inputs) {
      sweep(c.id, `input ${inp.key} label`, inp.label);
      sweep(c.id, `input ${inp.key} hint`, inp.hint);
      sweep(c.id, `input ${inp.key} placeholder`, inp.placeholder);
      sweep(c.id, `input ${inp.key} unit`, inp.unit);
      for (const o of inp.options || []) sweep(c.id, `input ${inp.key} option`, o.label);
    }
  }
  assert.deepEqual(offenders, [], 'no em dashes or double hyphens in registry copy');
}

// ---- live smoke: every compute rejects an empty form with a sentence, and a
// filled happy-path form returns the full envelope ---------------------------
{
  const HAPPY = {
    'dose-weight': { dosePerKg: 15, weightKg: 20 },
    'dose-on-hand': { desired: 750, onHand: 250, quantity: 5 },
    'infusion-rate': { doseMcgKgMin: 5, weightKg: 70, drugMg: 400, volumeMl: 250 },
    'drip-rate': { volumeMl: 1000, timeHours: 8, dropFactor: '15' },
    'pediatric-dose': { method: 'young', adultDose: 500, ageYears: 6 },
    'ibw': { sex: 'male', heightCm: 170 },
    'creatinine-clearance': { sex: 'male', ageYears: 60, weightKg: 70, creatinineUnit: 'mgdl', creatinine: 1 },
    'bsa': { method: 'mosteller', heightCm: 170, weightKg: 70 },
    'bmi': { weightKg: 70, heightCm: 170 },
    'age': { dob: '2000-01-15', asOf: '2024-07-11' },
    'fluid-maintenance': { weightKg: 25 },
    'urine-output': { volumeMl: 500, weightKg: 70, hours: 24 },
    'map': { systolic: 120, diastolic: 80 },
    'convert-weight': { from: 'kg', value: 70 },
    'convert-height': { from: 'cm', value: 170 },
    'convert-temp': { from: 'c', value: 37 },
    'convert-time': { from: '24', time: '13:45' },
    'gcs': { eye: '4', verbal: '5', motor: '6' },
    'apgar': { appearance: '2', pulse: '2', grimace: '2', activity: '2', respiration: '2' },
    'braden': { sensory: '4', moisture: '4', activity: '4', mobility: '4', nutrition: '4', friction: '3' },
    'morse': { history: '25', secondary: '15', aid: '30', iv: '20', gait: '20', mental: '15' },
    'naegele': { lmp: '2025-01-10' },
    'gestational-age': { lmp: '2025-01-01', asOf: '2025-03-12' },
  };

  for (const c of CALCULATORS) {
    assert.ok(HAPPY[c.id], `happy-path fixture missing for ${c.id}, add it when adding a calculator`);

    // an empty form NEVER yields a number
    const empty = c.compute({});
    assert.equal(empty.ok, false, `${c.id}: empty input must fail`);
    assert.ok(typeof empty.error === 'string' && empty.error.length > 8 && /\.$/.test(empty.error),
      `${c.id}: the error is a plain sentence`);

    // the happy path yields the complete envelope
    const r = c.compute(HAPPY[c.id]);
    assert.equal(r.ok, true, `${c.id}: happy path computes (${r.error || ''})`);
    assert.ok(typeof r.display === 'string' && r.display.length > 0, `${c.id}: display`);
    assert.ok(typeof r.rounding === 'string' && r.rounding.length > 0, `${c.id}: the rounding rule is stated`);
    assert.ok(typeof r.formula === 'string' && r.formula.length > 0, `${c.id}: the formula is shown`);
    assert.ok(typeof r.standard === 'string' && r.standard.length > 0, `${c.id}: the standard is named`);
    assert.ok(Array.isArray(r.bands), `${c.id}: bands array`);
    for (const b of r.bands) {
      assert.ok(typeof b.source === 'string' && b.source.length > 0, `${c.id}: every band carries a source`);
    }
    // envelope copy is also dash-clean
    for (const s of [r.display, r.rounding, r.formula, r.standard, ...(r.steps || []), ...(r.warnings || [])]) {
      assert.ok(!String(s).includes('—') && !String(s).includes('--'), `${c.id}: envelope copy has no dashes`);
    }
  }
}

// ---- calculatorById + searchCalculators ------------------------------------
assert.equal(calculatorById('map').name, 'Mean Arterial Pressure');
assert.equal(calculatorById('nope'), null);
{
  assert.equal(searchCalculators('drip')[0].id, 'drip-rate');
  assert.equal(searchCalculators('glasgow')[0].id, 'gcs');
  assert.equal(searchCalculators('due')[0].id, 'naegele');
  assert.ok(searchCalculators('bmi').some((c) => c.id === 'bmi'));
  assert.ok(searchCalculators('fall').some((c) => c.id === 'morse'));
  assert.ok(searchCalculators('kg').length >= 2, 'unit queries surface conversions and doses');
  assert.deepEqual(searchCalculators(''), [], 'blank query returns nothing');
  assert.deepEqual(searchCalculators('zzzz'), [], 'no fuzzy: nonsense returns nothing');
}

console.log('calc-registry.test.js: all passed');
