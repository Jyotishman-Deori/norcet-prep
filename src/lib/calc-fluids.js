// =====================================================================
// src/lib/calc-fluids.js — Nursing Calculator Suite: fluids and vitals.
//
// PURE, hardcoded formulas. No AI, ever. Items 9 to 11 of the suite:
//    9. Fluid maintenance   (Holliday-Segar, daily and the 4-2-1 hourly rule)
//   10. Urine output rate   (mL/kg/hr)
//   11. Mean Arterial Pressure
//
// The interpretation bands below (oliguria, MAP perfusion threshold) are marked
// FLAGGED: the arithmetic is certain, the thresholds still need confirmation
// against the institution's protocol, and the UI shows a "verify" tag for them.
// =====================================================================
import { ok, err, nums, roundTo, bandsFor } from './calc-units.js';

// =====================================================================
// 9. FLUID MAINTENANCE — Holliday-Segar.
//   DAILY:  first 10 kg  -> 100 mL/kg/day
//           next 10 kg   ->  50 mL/kg/day
//           each kg > 20 ->  20 mL/kg/day
//   HOURLY (the 4-2-1 rule): 4 / 2 / 1 mL/kg/hr across the same three bands.
//
// Both are reported. They do NOT agree exactly (25 kg gives 1600 mL/day but
// 65 mL/hr, which is 1560 mL/day) because 4-2-1 is the bedside approximation of
// the daily figure. Saying that out loud is the point.
//
// [FLAG] Holliday-Segar is derived in PAEDIATRICS. No adult maintenance range
// is shown here, because that range still needs a source.
// =====================================================================
export function hollidaySegarDaily(weightKg) {
  if (weightKg <= 10) return weightKg * 100;
  if (weightKg <= 20) return 1000 + (weightKg - 10) * 50;
  return 1500 + (weightKg - 20) * 20;
}

export function hollidaySegarHourly(weightKg) {
  if (weightKg <= 10) return weightKg * 4;
  if (weightKg <= 20) return 40 + (weightKg - 10) * 2;
  return 60 + (weightKg - 20) * 1;
}

export function fluidMaintenance({ weightKg }) {
  const f = nums({ weightKg }, {
    weightKg: { label: 'Weight', unit: 'kg', gt0: true, max: 300 },
  });
  if (!f.ok) return err(f.error);
  const w = f.v.weightKg;

  const daily = hollidaySegarDaily(w);
  const hourly = hollidaySegarHourly(w);

  const steps = [];
  if (w <= 10) {
    steps.push(`${w} kg x 100 mL/kg/day = ${roundTo(daily, 1)} mL/day`);
  } else if (w <= 20) {
    steps.push('First 10 kg x 100 = 1000 mL');
    steps.push(`Next ${roundTo(w - 10, 1)} kg x 50 = ${roundTo((w - 10) * 50, 1)} mL`);
    steps.push(`Total = ${roundTo(daily, 1)} mL/day`);
  } else {
    steps.push('First 10 kg x 100 = 1000 mL');
    steps.push('Next 10 kg x 50 = 500 mL');
    steps.push(`Remaining ${roundTo(w - 20, 1)} kg x 20 = ${roundTo((w - 20) * 20, 1)} mL`);
    steps.push(`Total = ${roundTo(daily, 1)} mL/day`);
  }

  return ok(daily, {
    unit: 'mL/day',
    decimals: 0,
    formula: '100 mL/kg for the first 10 kg, 50 mL/kg for the next 10 kg, 20 mL/kg for every kg above 20',
    standard: 'Holliday-Segar method',
    steps,
    extras: [
      { label: 'Maintenance per day', value: `${roundTo(daily, 0)} mL/day` },
      { label: 'Hourly rate (4-2-1 rule)', value: `${roundTo(hourly, 1)} mL/hr` },
      { label: 'Day rate divided by 24', value: `${roundTo(daily / 24, 1)} mL/hr` },
    ],
    warnings: [
      'The 4-2-1 hourly rule is the bedside approximation of the daily figure, so the two do not match exactly. Both are shown above.',
      'Holliday-Segar is a paediatric maintenance method. Adult maintenance targets are not shown here because that reference range still needs to be confirmed against your protocol.',
    ],
  });
}

// =====================================================================
// 10. URINE OUTPUT RATE
//   mL/kg/hr = urine volume in mL / (weight in kg x hours)
//
// [FLAG] Oliguria thresholds differ between adults, children and neonates and
// still need source confirmation, so they are shown as flagged reference bands
// rather than as a verdict.
// =====================================================================
const URINE_BANDS = [
  { label: 'Below 0.5 mL/kg/hr, commonly the adult oliguria threshold', below: 0.5 },
  { label: '0.5 to below 1.0 mL/kg/hr, below the usual paediatric threshold', below: 1.0 },
  { label: '1.0 mL/kg/hr and above' },
];

export function urineOutput({ volumeMl, weightKg, hours }) {
  const f = nums({ volumeMl, weightKg, hours }, {
    volumeMl: { label: 'Urine volume', unit: 'mL', min: 0, max: 100000 },
    weightKg: { label: 'Weight', unit: 'kg', gt0: true, max: 300 },
    hours: { label: 'Time collected over', unit: 'hours', gt0: true, max: 240 },
  });
  if (!f.ok) return err(f.error);

  const value = f.v.volumeMl / (f.v.weightKg * f.v.hours);

  return ok(value, {
    unit: 'mL/kg/hr',
    decimals: 2,
    formula: 'Urine output = volume in mL / (weight in kg x hours)',
    standard: 'Standard urine output rate',
    steps: [
      `${f.v.weightKg} kg x ${f.v.hours} hr = ${roundTo(f.v.weightKg * f.v.hours, 2)}`,
      `${f.v.volumeMl} / ${roundTo(f.v.weightKg * f.v.hours, 2)} = ${roundTo(value, 3)} mL/kg/hr`,
    ],
    bands: bandsFor(value, URINE_BANDS,
      'Oliguria thresholds differ for adults, children and neonates', true),
    extras: [
      { label: 'Total over the period', value: `${f.v.volumeMl} mL in ${f.v.hours} hr` },
      { label: 'Average per hour', value: `${roundTo(f.v.volumeMl / f.v.hours, 1)} mL/hr` },
    ],
  });
}

// =====================================================================
// 11. MEAN ARTERIAL PRESSURE
//   MAP = (systolic + 2 x diastolic) / 3
// which is the same as diastolic + one third of the pulse pressure.
//
// [FLAG] The 65 mmHg perfusion threshold is widely quoted but is shown here as
// a flagged reference band, not a verdict.
// =====================================================================
const MAP_BANDS = [
  { label: 'Below 65 mmHg, commonly quoted as the minimum for organ perfusion', below: 65 },
  { label: '65 to below 70 mmHg', below: 70 },
  { label: '70 to 100 mmHg, commonly quoted as the usual adult range', below: 100.0001 },
  { label: 'Above 100 mmHg' },
];

export function map({ systolic, diastolic }) {
  const f = nums({ systolic, diastolic }, {
    systolic: { label: 'Systolic pressure', unit: 'mmHg', gt0: true, max: 300 },
    diastolic: { label: 'Diastolic pressure', unit: 'mmHg', gt0: true, max: 250 },
  });
  if (!f.ok) return err(f.error);

  if (f.v.diastolic > f.v.systolic) {
    return err('Diastolic pressure cannot be higher than systolic pressure. Check the two numbers.');
  }

  const value = (f.v.systolic + 2 * f.v.diastolic) / 3;
  const pulsePressure = f.v.systolic - f.v.diastolic;

  return ok(value, {
    unit: 'mmHg',
    decimals: 1,
    formula: 'MAP = (systolic + 2 x diastolic) / 3',
    standard: 'Standard mean arterial pressure formula',
    steps: [
      `${f.v.systolic} + (2 x ${f.v.diastolic}) = ${f.v.systolic + 2 * f.v.diastolic}`,
      `${f.v.systolic + 2 * f.v.diastolic} / 3 = ${roundTo(value, 2)} mmHg`,
    ],
    bands: bandsFor(value, MAP_BANDS, 'Commonly quoted perfusion thresholds', true),
    extras: [
      { label: 'Pulse pressure', value: `${roundTo(pulsePressure, 0)} mmHg` },
      { label: 'Blood pressure entered', value: `${f.v.systolic} / ${f.v.diastolic} mmHg` },
    ],
  });
}
