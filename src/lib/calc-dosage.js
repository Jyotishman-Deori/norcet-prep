// =====================================================================
// src/lib/calc-dosage.js — Nursing Calculator Suite: dosage and medication.
//
// PURE, hardcoded formulas. No AI, ever, in any of these numbers. This is the
// highest-stakes module in the app, so every function:
//   • validates first and returns a plain-English error rather than a number,
//   • states the formula and the standard it used,
//   • keeps the raw value and states the rounding rule (drip rates round to a
//     WHOLE drop, because you cannot deliver part of a drop).
//
// Items 1 to 5 of the suite:
//   1. Drug dosage        (mg/kg, mcg/kg/min to pump rate, dose on hand D/H x Q)
//   2. IV flow / drip rate (mL/hr and gtt/min with a drop factor)
//   3. Pediatric dosing   (Clark's rule, Young's rule, BSA method)
//   4. Ideal Body Weight  (Devine formula)
//   5. Creatinine Clearance (Cockcroft-Gault)
// =====================================================================
import { ok, err, num, nums, pick, roundTo, cmToIn, kgToLb } from './calc-units.js';
import { bsaMosteller } from './calc-body.js';

// =====================================================================
// 1a. WEIGHT BASED DOSE — dose = dose per kg x weight.
// Optionally split into divided doses across the day.
// =====================================================================
export function doseByWeight({ dosePerKg, weightKg, dosesPerDay }) {
  const f = nums({ dosePerKg, weightKg }, {
    dosePerKg: { label: 'Dose per kg', unit: 'mg/kg', gt0: true, max: 10000 },
    weightKg: { label: 'Weight', unit: 'kg', gt0: true, max: 500 },
  });
  if (!f.ok) return err(f.error);

  const total = f.v.dosePerKg * f.v.weightKg;

  // Divided doses are optional. Blank means "give it as a single dose".
  const raw = dosesPerDay;
  const blank = raw === undefined || raw === null || String(raw).trim() === '';
  let extras = [{ label: 'Total dose', value: `${roundTo(total, 2)} mg` }];
  let steps = [`${f.v.dosePerKg} mg/kg x ${f.v.weightKg} kg = ${roundTo(total, 2)} mg`];

  if (!blank) {
    const dpd = num(raw, { label: 'Doses per day', integer: true, min: 1, max: 24 });
    if (!dpd.ok) return err(dpd.error);
    const per = total / dpd.v;
    extras = [
      { label: 'Total per day', value: `${roundTo(total, 2)} mg` },
      { label: `Each dose (${dpd.v} per day)`, value: `${roundTo(per, 2)} mg` },
    ];
    steps.push(`${roundTo(total, 2)} mg / ${dpd.v} doses = ${roundTo(per, 2)} mg per dose`);
  }

  return ok(total, {
    unit: 'mg',
    decimals: 2,
    formula: 'Dose = dose per kg x body weight in kg',
    standard: 'Standard weight based dosing',
    steps,
    extras,
  });
}

// =====================================================================
// 1b. DOSE ON HAND (the classic "desired over have times quantity").
//   volume to give = (desired dose / dose on hand) x quantity
// For tablets the quantity is 1 tablet, so the answer is a tablet count.
// =====================================================================
export function doseOnHand({ desired, onHand, quantity }) {
  const f = nums({ desired, onHand, quantity }, {
    desired: { label: 'Dose desired', gt0: true, max: 1000000 },
    onHand: { label: 'Dose on hand', gt0: true, max: 1000000 },
    quantity: { label: 'Quantity on hand', gt0: true, max: 100000 },
  });
  if (!f.ok) return err(f.error);

  const value = (f.v.desired / f.v.onHand) * f.v.quantity;
  return ok(value, {
    unit: '',
    decimals: 2,
    formula: 'Amount to give = (dose desired / dose on hand) x quantity on hand',
    standard: 'Desired over have, times quantity',
    steps: [
      `${f.v.desired} / ${f.v.onHand} = ${roundTo(f.v.desired / f.v.onHand, 4)}`,
      `${roundTo(f.v.desired / f.v.onHand, 4)} x ${f.v.quantity} = ${roundTo(value, 2)}`,
    ],
    extras: [
      { label: 'Amount to give', value: `${roundTo(value, 2)} (in the same unit as the quantity on hand)` },
    ],
    warnings: [
      'The dose desired and the dose on hand must already be in the SAME unit. Convert first if one is in mg and the other in mcg.',
    ],
  });
}

// =====================================================================
// 1c. WEIGHT BASED INFUSION — mcg/kg/min to a pump rate in mL/hr.
//   concentration (mcg/mL) = (drug in mg x 1000) / volume in mL
//   rate (mL/hr) = (dose in mcg/kg/min x weight in kg x 60) / concentration
// =====================================================================
export function infusionRate({ doseMcgKgMin, weightKg, drugMg, volumeMl }) {
  const f = nums({ doseMcgKgMin, weightKg, drugMg, volumeMl }, {
    doseMcgKgMin: { label: 'Dose', unit: 'mcg/kg/min', gt0: true, max: 1000 },
    weightKg: { label: 'Weight', unit: 'kg', gt0: true, max: 500 },
    drugMg: { label: 'Drug amount in the bag', unit: 'mg', gt0: true, max: 100000 },
    volumeMl: { label: 'Bag volume', unit: 'mL', gt0: true, max: 10000 },
  });
  if (!f.ok) return err(f.error);

  const concMcgPerMl = (f.v.drugMg * 1000) / f.v.volumeMl;
  const value = (f.v.doseMcgKgMin * f.v.weightKg * 60) / concMcgPerMl;

  return ok(value, {
    unit: 'mL/hr',
    decimals: 1,
    formula: 'Rate = (dose in mcg/kg/min x weight in kg x 60) / concentration in mcg/mL',
    standard: 'Standard weight based infusion calculation',
    steps: [
      `Concentration = (${f.v.drugMg} mg x 1000) / ${f.v.volumeMl} mL = ${roundTo(concMcgPerMl, 2)} mcg/mL`,
      `(${f.v.doseMcgKgMin} x ${f.v.weightKg} x 60) / ${roundTo(concMcgPerMl, 2)} = ${roundTo(value, 2)} mL/hr`,
    ],
    extras: [
      { label: 'Concentration', value: `${roundTo(concMcgPerMl, 2)} mcg/mL` },
      { label: 'Dose delivered', value: `${roundTo(f.v.doseMcgKgMin * f.v.weightKg, 2)} mcg/min` },
    ],
  });
}

// =====================================================================
// 2. IV FLOW AND DRIP RATE
//   mL/hr   = total volume in mL / time in hours
//   gtt/min = (total volume in mL x drop factor) / time in minutes
//
// ROUNDING: gtt/min is rounded to the NEAREST WHOLE DROP, because a drip
// chamber cannot deliver a fraction of a drop. The raw value is kept and the
// rule is stated, so nothing is rounded silently.
// Drop factors: macrodrip 10, 15 or 20 gtt/mL; microdrip 60 gtt/mL.
// =====================================================================
export function dripRate({ volumeMl, timeHours, dropFactor }) {
  const f = nums({ volumeMl, timeHours, dropFactor }, {
    volumeMl: { label: 'Volume to infuse', unit: 'mL', gt0: true, max: 100000 },
    timeHours: { label: 'Time', unit: 'hours', gt0: true, max: 240 },
    dropFactor: { label: 'Drop factor', unit: 'gtt/mL', gt0: true, max: 100 },
  });
  if (!f.ok) return err(f.error);

  const timeMin = f.v.timeHours * 60;
  const mlPerHr = f.v.volumeMl / f.v.timeHours;
  const gttPerMin = (f.v.volumeMl * f.v.dropFactor) / timeMin;
  const wholeDrops = Math.round(gttPerMin);

  return ok(gttPerMin, {
    unit: 'gtt/min',
    decimals: 0,
    rounding: `Rounded to the nearest whole drop. The exact value is ${roundTo(gttPerMin, 2)} gtt/min, because a drip chamber cannot deliver part of a drop.`,
    formula: 'gtt/min = (volume in mL x drop factor in gtt/mL) / time in minutes',
    standard: 'Standard gravity drip rate calculation',
    steps: [
      `${f.v.timeHours} hours = ${roundTo(timeMin, 0)} minutes`,
      `(${f.v.volumeMl} mL x ${f.v.dropFactor} gtt/mL) / ${roundTo(timeMin, 0)} min = ${roundTo(gttPerMin, 2)} gtt/min`,
      `Set the drip at ${wholeDrops} drops per minute`,
    ],
    extras: [
      { label: 'Pump rate', value: `${roundTo(mlPerHr, 1)} mL/hr` },
      { label: 'Exact drip rate', value: `${roundTo(gttPerMin, 2)} gtt/min` },
      { label: 'Set the drip at', value: `${wholeDrops} gtt/min` },
    ],
  });
}

// =====================================================================
// 3. PEDIATRIC DOSING — three accepted methods, each labelled.
//
//   Clark's rule:  child dose = adult dose x (weight in lb / 150)
//                  [FLAG] the classic rule uses POUNDS and a 150 lb average
//                  adult. A metric variant divides kg by 68. This implements the
//                  classic pound based rule and says so on the card.
//   Young's rule:  child dose = adult dose x (age / (age + 12))
//                  [FLAG] commonly taught for ages 1 to 12; outside that range
//                  we WARN rather than quietly returning a number.
//   BSA method:    child dose = adult dose x (child BSA / 1.73)
//                  1.73 m2 is the accepted average adult BSA.
// =====================================================================
export const YOUNG_MIN_AGE = 1;
export const YOUNG_MAX_AGE = 12;

export function pediatricDose({ method, adultDose, weightKg, ageYears, heightCm }) {
  const m = pick(method, ['clark', 'young', 'bsa'], 'Method');
  if (!m.ok) return err(m.error);

  const ad = num(adultDose, { label: 'Adult dose', unit: 'mg', gt0: true, max: 1000000 });
  if (!ad.ok) return err(ad.error);

  if (m.v === 'clark') {
    const w = num(weightKg, { label: 'Child weight', unit: 'kg', gt0: true, max: 150 });
    if (!w.ok) return err(w.error);
    const lb = kgToLb(w.v);
    const value = ad.v * (lb / 150);
    return ok(value, {
      unit: 'mg',
      decimals: 2,
      formula: "Child dose = adult dose x (weight in lb / 150)",
      standard: "Clark's rule, pound based, 150 lb average adult",
      steps: [
        `${w.v} kg = ${roundTo(lb, 2)} lb`,
        `${ad.v} mg x (${roundTo(lb, 2)} / 150) = ${roundTo(value, 2)} mg`,
      ],
      extras: [{ label: 'Child weight in pounds', value: `${roundTo(lb, 2)} lb` }],
      warnings: [
        "This uses the classic pound based Clark's rule. A metric variant divides weight in kg by 68 and gives a slightly different number, so check which one your course or protocol expects.",
      ],
    });
  }

  if (m.v === 'young') {
    const a = num(ageYears, { label: 'Child age', unit: 'years', gt0: true, max: 18 });
    if (!a.ok) return err(a.error);
    const value = ad.v * (a.v / (a.v + 12));
    const warnings = [];
    if (a.v < YOUNG_MIN_AGE || a.v > YOUNG_MAX_AGE) {
      warnings.push(`Young's rule is normally taught for ages ${YOUNG_MIN_AGE} to ${YOUNG_MAX_AGE} years. This age is outside that range, so treat the result with care and check your protocol.`);
    }
    return ok(value, {
      unit: 'mg',
      decimals: 2,
      formula: 'Child dose = adult dose x (age in years / (age in years + 12))',
      standard: "Young's rule",
      steps: [
        `${a.v} / (${a.v} + 12) = ${roundTo(a.v / (a.v + 12), 4)}`,
        `${ad.v} mg x ${roundTo(a.v / (a.v + 12), 4)} = ${roundTo(value, 2)} mg`,
      ],
      warnings,
    });
  }

  // BSA method
  const f = nums({ heightCm, weightKg }, {
    heightCm: { label: 'Child height', unit: 'cm', gt0: true, max: 250 },
    weightKg: { label: 'Child weight', unit: 'kg', gt0: true, max: 150 },
  });
  if (!f.ok) return err(f.error);
  const childBsa = bsaMosteller(f.v.heightCm, f.v.weightKg);
  const value = ad.v * (childBsa / 1.73);
  return ok(value, {
    unit: 'mg',
    decimals: 2,
    formula: 'Child dose = adult dose x (child BSA / 1.73)',
    standard: 'Body surface area method, Mosteller BSA, 1.73 m2 average adult',
    steps: [
      `Child BSA (Mosteller) = ${roundTo(childBsa, 2)} m2`,
      `${ad.v} mg x (${roundTo(childBsa, 2)} / 1.73) = ${roundTo(value, 2)} mg`,
    ],
    extras: [{ label: 'Child BSA (Mosteller)', value: `${roundTo(childBsa, 2)} m2` }],
  });
}

// =====================================================================
// 4. IDEAL BODY WEIGHT — Devine formula.
//   Male:   IBW kg = 50   + 2.3 x (height in inches - 60)
//   Female: IBW kg = 45.5 + 2.3 x (height in inches - 60)
//
// [FLAG] Below 152.4 cm (60 inches) the formula extrapolates below its original
// range. We still compute it, but we WARN rather than returning a bare number.
// =====================================================================
export const DEVINE_MIN_CM = 152.4;

export function idealBodyWeight({ heightCm, sex }) {
  const s = pick(sex, ['male', 'female'], 'Sex');
  if (!s.ok) return err(s.error);
  const h = num(heightCm, { label: 'Height', unit: 'cm', gt0: true, max: 250 });
  if (!h.ok) return err(h.error);

  const inches = cmToIn(h.v);
  const base = s.v === 'male' ? 50 : 45.5;
  const value = base + 2.3 * (inches - 60);

  const warnings = [];
  if (h.v < DEVINE_MIN_CM) {
    warnings.push('This height is below 152.4 cm (5 feet), which is under the range the Devine formula was built for. The number below is an extrapolation, so confirm it against your protocol.');
  }
  if (value <= 0) {
    return err('That height is too short for the Devine formula to give a meaningful ideal body weight.');
  }

  return ok(value, {
    unit: 'kg',
    decimals: 1,
    formula: s.v === 'male'
      ? 'IBW = 50 + 2.3 x (height in inches - 60)'
      : 'IBW = 45.5 + 2.3 x (height in inches - 60)',
    standard: 'Devine formula',
    steps: [
      `${h.v} cm = ${roundTo(inches, 2)} in`,
      `${base} + 2.3 x (${roundTo(inches, 2)} - 60) = ${roundTo(value, 2)} kg`,
    ],
    extras: [{ label: 'Height in inches', value: `${roundTo(inches, 2)} in` }],
    warnings,
  });
}

// =====================================================================
// 5. CREATININE CLEARANCE — Cockcroft-Gault.
//   CrCl (mL/min) = ((140 - age) x weight in kg) / (72 x serum creatinine mg/dL)
//   multiplied by 0.85 if female.
//   SI input: creatinine in micromol/L is converted with / 88.4 to mg/dL.
//
// [FLAG] WHICH WEIGHT: actual vs ideal vs adjusted body weight is a clinical
// judgement and it CHANGES the number. The weight used is whatever the user
// enters, and the card says so plainly.
// =====================================================================
export const UMOL_PER_MGDL = 88.4;

export function cockcroftGault({ ageYears, weightKg, creatinine, creatinineUnit, sex }) {
  const s = pick(sex, ['male', 'female'], 'Sex');
  if (!s.ok) return err(s.error);
  const u = pick(creatinineUnit, ['mgdl', 'umol'], 'Creatinine unit');
  if (!u.ok) return err(u.error);

  const f = nums({ ageYears, weightKg, creatinine }, {
    ageYears: { label: 'Age', unit: 'years', gt0: true, max: 120 },
    weightKg: { label: 'Weight', unit: 'kg', gt0: true, max: 500 },
    creatinine: {
      label: 'Serum creatinine',
      unit: u.v === 'mgdl' ? 'mg/dL' : 'micromol/L',
      gt0: true,
      max: u.v === 'mgdl' ? 50 : 4420,
    },
  });
  if (!f.ok) return err(f.error);

  if (f.v.ageYears >= 140) {
    return err('Age must be under 140 years for the Cockcroft-Gault formula.');
  }

  const scrMgDl = u.v === 'mgdl' ? f.v.creatinine : f.v.creatinine / UMOL_PER_MGDL;
  const male = ((140 - f.v.ageYears) * f.v.weightKg) / (72 * scrMgDl);
  const value = s.v === 'female' ? male * 0.85 : male;

  const steps = [];
  if (u.v === 'umol') {
    steps.push(`${f.v.creatinine} micromol/L / 88.4 = ${roundTo(scrMgDl, 3)} mg/dL`);
  }
  steps.push(`((140 - ${f.v.ageYears}) x ${f.v.weightKg}) / (72 x ${roundTo(scrMgDl, 2)}) = ${roundTo(male, 2)} mL/min`);
  if (s.v === 'female') {
    steps.push(`Female, so x 0.85: ${roundTo(male, 2)} x 0.85 = ${roundTo(value, 2)} mL/min`);
  }

  return ok(value, {
    unit: 'mL/min',
    decimals: 1,
    formula: 'CrCl = ((140 - age) x weight in kg) / (72 x serum creatinine in mg/dL), x 0.85 if female',
    standard: 'Cockcroft-Gault formula',
    steps,
    extras: [
      { label: 'Serum creatinine used', value: `${roundTo(scrMgDl, 2)} mg/dL` },
      { label: 'Weight used', value: `${f.v.weightKg} kg` },
    ],
    warnings: [
      'This used the weight you entered. Whether to use actual, ideal or adjusted body weight is a clinical decision that changes the result, so follow your protocol.',
    ],
  });
}
