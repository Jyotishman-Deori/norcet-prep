// Contract test for src/lib/calc-dosage.js — runnable under Node:
//   node src/lib/calc-dosage.test.js
// The highest-stakes module in the app: every assertion below is a known-correct
// input/output pair, and every invalid input must return an ERROR, never a number.
import assert from 'node:assert/strict';
import {
  doseByWeight, doseOnHand, infusionRate, dripRate,
  pediatricDose, idealBodyWeight, cockcroftGault,
  DEVINE_MIN_CM, UMOL_PER_MGDL,
} from './calc-dosage.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const extra = (r, label) => r.extras.find((e) => e.label === label).value;

// =====================================================================
// 1a. WEIGHT BASED DOSE
// =====================================================================
{
  const r = doseByWeight({ dosePerKg: 5, weightKg: 20 });
  assert.equal(r.ok, true);
  assert.equal(r.value, 100, '5 mg/kg x 20 kg = 100 mg');
  assert.equal(r.display, '100.00');
  assert.equal(r.unit, 'mg');

  // divided doses
  const d = doseByWeight({ dosePerKg: 5, weightKg: 20, dosesPerDay: 4 });
  assert.equal(d.value, 100, 'the headline stays the TOTAL daily dose');
  assert.equal(extra(d, 'Each dose (4 per day)'), '25 mg');
  assert.equal(extra(d, 'Total per day'), '100 mg');

  // a blank divided-dose field is allowed (single dose)
  assert.equal(doseByWeight({ dosePerKg: 5, weightKg: 20, dosesPerDay: '' }).ok, true);

  // validation
  assert.equal(doseByWeight({ dosePerKg: 5, weightKg: 0 }).error, 'Weight must be greater than 0 kg.');
  assert.equal(doseByWeight({ dosePerKg: -5, weightKg: 20 }).ok, false);
  assert.equal(doseByWeight({ dosePerKg: 5, weightKg: 'abc' }).ok, false);
  assert.equal(doseByWeight({ dosePerKg: 5, weightKg: 20, dosesPerDay: 0 }).ok, false, 'zero doses per day is rejected');
  assert.equal(doseByWeight({ dosePerKg: 5, weightKg: 20, dosesPerDay: 2.5 }).ok, false, 'half a dose per day is rejected');
}

// =====================================================================
// 1b. DOSE ON HAND (desired over have, times quantity)
// =====================================================================
{
  // half a tablet
  const t = doseOnHand({ desired: 250, onHand: 500, quantity: 1 });
  assert.equal(t.value, 0.5, '250 / 500 x 1 tablet = 0.5 tablet');

  // liquid: 750 mg wanted, stock is 250 mg in 5 mL
  const l = doseOnHand({ desired: 750, onHand: 250, quantity: 5 });
  assert.equal(l.value, 15, '750 / 250 x 5 mL = 15 mL');
  assert.equal(l.display, '15.00');

  assert.equal(doseOnHand({ desired: 250, onHand: 0, quantity: 1 }).ok, false, 'never divide by a zero stock dose');
  assert.equal(doseOnHand({ desired: 0, onHand: 500, quantity: 1 }).ok, false);
  assert.equal(doseOnHand({ desired: 250, onHand: 500, quantity: -1 }).ok, false);
  // the unit-mismatch trap is called out in writing
  assert.ok(l.warnings.some((w) => w.includes('SAME unit')));
}

// =====================================================================
// 1c. WEIGHT BASED INFUSION — mcg/kg/min to mL/hr
// =====================================================================
{
  // 400 mg in 250 mL = 1600 mcg/mL. 5 mcg/kg/min for 70 kg.
  // (5 x 70 x 60) / 1600 = 21000 / 1600 = 13.125 mL/hr
  const r = infusionRate({ doseMcgKgMin: 5, weightKg: 70, drugMg: 400, volumeMl: 250 });
  assert.equal(r.ok, true);
  assert.ok(near(r.value, 13.125));
  assert.equal(r.display, '13.1');
  assert.equal(r.unit, 'mL/hr');
  assert.equal(extra(r, 'Concentration'), '1600 mcg/mL');
  assert.equal(extra(r, 'Dose delivered'), '350 mcg/min');

  assert.equal(infusionRate({ doseMcgKgMin: 5, weightKg: 70, drugMg: 400, volumeMl: 0 }).ok, false,
    'a zero bag volume must not become an infinite concentration');
  assert.equal(infusionRate({ doseMcgKgMin: 0, weightKg: 70, drugMg: 400, volumeMl: 250 }).ok, false);
  assert.equal(infusionRate({ doseMcgKgMin: 5, weightKg: -70, drugMg: 400, volumeMl: 250 }).ok, false);
}

// =====================================================================
// 2. IV FLOW AND DRIP RATE — the whole-drop rounding rule
// =====================================================================
{
  // 1000 mL over 8 hours with a 15 gtt/mL set:
  //   mL/hr   = 1000 / 8 = 125
  //   gtt/min = (1000 x 15) / 480 = 31.25  ->  31 whole drops
  const r = dripRate({ volumeMl: 1000, timeHours: 8, dropFactor: 15 });
  assert.equal(r.ok, true);
  assert.equal(r.value, 31.25, 'the RAW value keeps full precision');
  assert.equal(r.display, '31', 'the drip is set in whole drops');
  assert.equal(r.unit, 'gtt/min');
  assert.equal(extra(r, 'Pump rate'), '125 mL/hr');
  assert.equal(extra(r, 'Exact drip rate'), '31.25 gtt/min');
  // the rounding is stated in words, never silent
  assert.ok(r.rounding.includes('nearest whole drop'));
  assert.ok(r.rounding.includes('31.25'));

  // microdrip shortcut: at 60 gtt/mL the drip rate EQUALS the mL/hr rate
  const micro = dripRate({ volumeMl: 1000, timeHours: 8, dropFactor: 60 });
  assert.equal(micro.value, 125);
  assert.equal(micro.display, '125');
  assert.equal(extra(micro, 'Pump rate'), '125 mL/hr');

  // a common macrodrip case: 1000 mL over 6 h at 20 gtt/mL = 55.55 -> 56
  const m20 = dripRate({ volumeMl: 1000, timeHours: 6, dropFactor: 20 });
  assert.ok(near(m20.value, 55.5555, 1e-4));
  assert.equal(m20.display, '56');

  assert.equal(dripRate({ volumeMl: 1000, timeHours: 8, dropFactor: 0 }).error,
    'Drop factor must be greater than 0 gtt/mL.', 'a zero drop factor is rejected, never a zero rate');
  assert.equal(dripRate({ volumeMl: 1000, timeHours: 0, dropFactor: 15 }).ok, false, 'never divide by zero time');
  assert.equal(dripRate({ volumeMl: -1000, timeHours: 8, dropFactor: 15 }).ok, false);
  assert.equal(dripRate({ volumeMl: 1000, timeHours: 8, dropFactor: 'abc' }).ok, false);
}

// =====================================================================
// 3. PEDIATRIC DOSING — three labelled methods
// =====================================================================
{
  // Clark's rule: 15 kg is 33.069 lb; 500 x (33.069 / 150) = 110.23 mg
  const c = pediatricDose({ method: 'clark', adultDose: 500, weightKg: 15 });
  assert.equal(c.ok, true);
  assert.ok(near(c.value, 500 * ((15 / 0.45359237) / 150), 1e-9));
  assert.equal(c.display, '110.23');
  assert.equal(c.standard, "Clark's rule, pound based, 150 lb average adult");
  // the pound-vs-kg variant is disclosed, because it changes the number
  assert.ok(c.warnings.some((w) => w.includes('metric variant')));

  // Young's rule: 500 x (6 / 18) = 166.67 mg
  const y = pediatricDose({ method: 'young', adultDose: 500, ageYears: 6 });
  assert.ok(near(y.value, 500 / 3));
  assert.equal(y.display, '166.67');
  assert.equal(y.warnings.length, 0, 'age 6 is inside the taught range, so no warning');

  // outside the taught 1 to 12 band we WARN rather than staying silent
  const yOld = pediatricDose({ method: 'young', adultDose: 500, ageYears: 15 });
  assert.equal(yOld.ok, true, 'it still computes');
  assert.ok(yOld.warnings.some((w) => w.includes('1 to 12')), 'but it says the age is out of range');
  assert.ok(pediatricDose({ method: 'young', adultDose: 500, ageYears: 0.5 }).warnings.length > 0);

  // BSA method: BSA(100 cm, 20 kg) = sqrt(2000/3600) = 0.74536; 500 x (0.74536/1.73)
  const b = pediatricDose({ method: 'bsa', adultDose: 500, heightCm: 100, weightKg: 20 });
  assert.ok(near(b.value, 500 * (Math.sqrt(2000 / 3600) / 1.73), 1e-9));
  assert.equal(b.display, '215.42');
  assert.equal(extra(b, 'Child BSA (Mosteller)'), '0.75 m2');

  assert.equal(pediatricDose({ method: 'clark', adultDose: 500, weightKg: 0 }).ok, false);
  assert.equal(pediatricDose({ method: 'young', adultDose: 0, ageYears: 6 }).ok, false);
  assert.equal(pediatricDose({ method: 'fried', adultDose: 500, weightKg: 15 }).ok, false, 'unknown method is rejected');
}

// =====================================================================
// 4. IDEAL BODY WEIGHT — Devine
// =====================================================================
{
  // exactly 60 inches (152.4 cm) is the anchor: the bracket is zero
  const m60 = idealBodyWeight({ heightCm: DEVINE_MIN_CM, sex: 'male' });
  assert.equal(m60.value, 50, 'male at exactly 60 in is 50.0 kg');
  assert.equal(m60.display, '50.0');
  assert.equal(m60.warnings.length, 0, '152.4 cm is the boundary, not below it');

  const f60 = idealBodyWeight({ heightCm: DEVINE_MIN_CM, sex: 'female' });
  assert.equal(f60.value, 45.5, 'female at exactly 60 in is 45.5 kg');

  // 175 cm male: 68.898 in -> 50 + 2.3 x 8.898 = 70.46 kg
  const m175 = idealBodyWeight({ heightCm: 175, sex: 'male' });
  assert.ok(near(m175.value, 50 + 2.3 * (175 / 2.54 - 60), 1e-9));
  assert.equal(m175.display, '70.5');

  // below the validated range it still computes but WARNS
  const short = idealBodyWeight({ heightCm: 145, sex: 'female' });
  assert.equal(short.ok, true);
  assert.ok(short.warnings.some((w) => w.includes('152.4 cm')), 'an extrapolation is never silent');

  assert.equal(idealBodyWeight({ heightCm: 0, sex: 'male' }).ok, false);
  assert.equal(idealBodyWeight({ heightCm: 170, sex: 'other' }).ok, false);
  // absurdly short: the formula would go negative, so it must refuse
  assert.equal(idealBodyWeight({ heightCm: 40, sex: 'female' }).ok, false, 'never return a negative body weight');
}

// =====================================================================
// 5. CREATININE CLEARANCE — Cockcroft-Gault
// =====================================================================
{
  // Male, 60 y, 70 kg, SCr 1.0 mg/dL: ((140-60) x 70) / (72 x 1.0) = 77.78 mL/min
  const m = cockcroftGault({ ageYears: 60, weightKg: 70, creatinine: 1.0, creatinineUnit: 'mgdl', sex: 'male' });
  assert.equal(m.ok, true);
  assert.ok(near(m.value, 5600 / 72));
  assert.equal(m.display, '77.8');
  assert.equal(m.unit, 'mL/min');

  // the same patient, female: x 0.85
  const f = cockcroftGault({ ageYears: 60, weightKg: 70, creatinine: 1.0, creatinineUnit: 'mgdl', sex: 'female' });
  assert.ok(near(f.value, (5600 / 72) * 0.85));
  assert.equal(f.display, '66.1');
  assert.ok(f.steps.some((s) => s.includes('0.85')), 'the female factor is shown in the working');

  // SI units: 88.4 micromol/L is exactly 1.0 mg/dL, so the answer must match
  const si = cockcroftGault({ ageYears: 60, weightKg: 70, creatinine: UMOL_PER_MGDL, creatinineUnit: 'umol', sex: 'male' });
  assert.ok(near(si.value, m.value, 1e-9), 'micromol/L converts to the identical result');
  assert.equal(extra(si, 'Serum creatinine used'), '1 mg/dL');

  // which weight was used is disclosed, because it changes the number
  assert.equal(extra(m, 'Weight used'), '70 kg');
  assert.ok(m.warnings.some((w) => w.includes('actual, ideal or adjusted')));

  assert.equal(cockcroftGault({ ageYears: 60, weightKg: 70, creatinine: 0, creatinineUnit: 'mgdl', sex: 'male' }).ok, false,
    'a zero creatinine must not become an infinite clearance');
  assert.equal(cockcroftGault({ ageYears: 0, weightKg: 70, creatinine: 1, creatinineUnit: 'mgdl', sex: 'male' }).ok, false);
  assert.equal(cockcroftGault({ ageYears: 130, weightKg: 70, creatinine: 1, creatinineUnit: 'mgdl', sex: 'male' }).ok, false,
    'an age past the validated range is rejected, never a negative clearance');
  assert.equal(cockcroftGault({ ageYears: 60, weightKg: 70, creatinine: 1, creatinineUnit: 'mg/dl', sex: 'male' }).ok, false);
}

console.log('calc-dosage.test.js: all passed');
