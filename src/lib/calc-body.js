// =====================================================================
// src/lib/calc-body.js — Nursing Calculator Suite: body measurements.
//
// PURE, hardcoded formulas. No AI, ever. Items 6 to 8 of the suite:
//   6. Body Surface Area  (Mosteller AND DuBois, both shown, user picks)
//   7. Body Mass Index    (one number, TWO labelled classification standards)
//   8. Exact age          (years / months / days; reused by other calculators)
//
// Dates are handled entirely in UTC integers (never `new Date(str)` in local
// time), because an ISO date string parsed in a negative UTC offset silently
// shifts to the previous day and would quietly change an age or a due date.
// =====================================================================
import { ok, err, nums, pick, roundTo, bandsFor } from './calc-units.js';

// ---- date helpers (UTC only) ---------------------------------------------
// Last day of month m (1 to 12) in year y. Date.UTC month is 0-indexed, so
// month index `m` is the NEXT month and day 0 walks back to this month's end.
export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// parseDate('YYYY-MM-DD') -> { ok, y, m, d, utc } | { ok:false, error }
// Rejects malformed strings AND impossible calendar dates (31 February).
export function parseDate(raw, label) {
  const s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!s) return { ok: false, error: `${label} is required.` };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return { ok: false, error: `${label} must be a valid date.` };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return { ok: false, error: `${label} has an invalid month.` };
  if (d < 1 || d > daysInMonth(y, mo)) return { ok: false, error: `${label} is not a real calendar date.` };
  return { ok: true, y, m: mo, d, utc: Date.UTC(y, mo - 1, d) };
}

const DAY_MS = 86400000;
export const fmtDate = (utc) => {
  const dt = new Date(utc);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
};

// =====================================================================
// 8. EXACT AGE — years, months and days between two dates.
// Anchor method (not naive borrowing): walk whole years, then whole months
// (clamping the day to the month's length), then count the leftover days. A
// naive "borrow from the previous month" can still leave a negative day count
// when the birth day is later than the previous month's length (31 Jan to
// 1 Mar), so it is not used here.
//
// Exported as ageParts() for reuse: pediatric dosing (Young's rule) and the
// obstetric calculators call it rather than re-implementing date maths.
// =====================================================================
export function ageParts(dob, ref) {
  let years = ref.y - dob.y;
  if (ref.m < dob.m || (ref.m === dob.m && ref.d < dob.d)) years -= 1;

  const ay = dob.y + years;          // anniversary year
  const am = dob.m;
  const ad = dob.d;

  let months = (ref.y - ay) * 12 + (ref.m - am);
  if (ref.d < ad) months -= 1;

  let tm = am + months;              // month of the "years + months" anchor
  let ty = ay;
  while (tm > 12) { tm -= 12; ty += 1; }

  const clampedDay = Math.min(ad, daysInMonth(ty, tm));
  const anchorUtc = Date.UTC(ty, tm - 1, clampedDay);
  const days = Math.round((ref.utc - anchorUtc) / DAY_MS);
  const totalDays = Math.round((ref.utc - dob.utc) / DAY_MS);

  return { years, months, days, totalDays };
}

// The user-facing calculator wrapper around ageParts().
export function exactAge({ dob, asOf }) {
  const b = parseDate(dob, 'Date of birth');
  if (!b.ok) return err(b.error);

  // `asOf` is optional; blank means today (taken as a UTC calendar date).
  let r;
  if (asOf === undefined || asOf === null || String(asOf).trim() === '') {
    const now = new Date();
    r = { ok: true, y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() };
    r.utc = Date.UTC(r.y, r.m - 1, r.d);
  } else {
    r = parseDate(asOf, 'Reference date');
    if (!r.ok) return err(r.error);
  }

  if (b.utc > r.utc) return err('Date of birth cannot be after the reference date.');

  const a = ageParts(b, r);
  return ok(a.years, {
    unit: a.years === 1 ? 'year' : 'years',
    decimals: 0,
    rounding: 'Exact value, no rounding applied.',
    formula: 'Whole years, then whole months, then the remaining days',
    standard: 'Calendar age, month lengths and leap years accounted for',
    steps: [`${fmtDate(b.utc)} to ${fmtDate(r.utc)} is ${a.totalDays} days in total`],
    extras: [
      { label: 'Exact age', value: `${a.years} y, ${a.months} m, ${a.days} d` },
      { label: 'Total days', value: `${a.totalDays} days` },
      { label: 'Age in months', value: `${a.years * 12 + a.months} months` },
    ],
  });
}

// =====================================================================
// 6. BODY SURFACE AREA — Mosteller and DuBois.
//   Mosteller: BSA (m2) = sqrt( (height_cm x weight_kg) / 3600 )
//   DuBois:    BSA (m2) = 0.007184 x height_cm^0.725 x weight_kg^0.425
// Both are computed every time; the chosen one is the headline and the other is
// shown as a labelled secondary, so the choice of method is never hidden.
// =====================================================================
export const bsaMosteller = (heightCm, weightKg) => Math.sqrt((heightCm * weightKg) / 3600);
export const bsaDuBois = (heightCm, weightKg) =>
  0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);

export function bsa({ heightCm, weightKg, method }) {
  const m = pick(method, ['mosteller', 'dubois'], 'Formula');
  if (!m.ok) return err(m.error);
  const f = nums({ heightCm, weightKg }, {
    heightCm: { label: 'Height', unit: 'cm', gt0: true, max: 300 },
    weightKg: { label: 'Weight', unit: 'kg', gt0: true, max: 500 },
  });
  if (!f.ok) return err(f.error);

  const mos = bsaMosteller(f.v.heightCm, f.v.weightKg);
  const dub = bsaDuBois(f.v.heightCm, f.v.weightKg);
  const useMos = m.v === 'mosteller';

  return ok(useMos ? mos : dub, {
    unit: 'm2',
    decimals: 2,
    formula: useMos
      ? 'BSA = square root of ((height in cm x weight in kg) / 3600)'
      : 'BSA = 0.007184 x height in cm^0.725 x weight in kg^0.425',
    standard: useMos ? 'Mosteller formula' : 'DuBois and DuBois formula',
    steps: useMos
      ? [`(${f.v.heightCm} x ${f.v.weightKg}) / 3600 = ${roundTo((f.v.heightCm * f.v.weightKg) / 3600, 4)}`,
         `square root = ${roundTo(mos, 4)} m2`]
      : [`0.007184 x ${f.v.heightCm}^0.725 x ${f.v.weightKg}^0.425 = ${roundTo(dub, 4)} m2`],
    extras: [
      { label: 'Mosteller', value: `${roundTo(mos, 2)} m2` },
      { label: 'DuBois', value: `${roundTo(dub, 2)} m2` },
      { label: 'Difference between the two', value: `${roundTo(Math.abs(mos - dub), 2)} m2` },
    ],
  });
}

// =====================================================================
// 7. BODY MASS INDEX
//   BMI = weight_kg / (height_m)^2      (universal, no regional variant)
//
// The NUMBER is universal; only the CLASSIFICATION differs by standard, so the
// same BMI is reported against BOTH cutoff sets, each labelled. That is the
// whole point: an Indian patient at BMI 24 is "normal" internationally but
// "overweight" on the Asian cutoffs, and hiding one of those would mislead.
//
// [FLAG] Both cutoff sets are reference ranges pending source confirmation.
// =====================================================================
const BMI_ASIAN = [
  { label: 'Underweight, below 18.5', below: 18.5 },
  { label: 'Normal, 18.5 to 22.9', below: 23 },
  { label: 'Overweight or at risk, 23.0 to 24.9', below: 25 },
  { label: 'Obese I, 25.0 to 29.9', below: 30 },
  { label: 'Obese II, 30.0 and above' },
];
const BMI_INTL = [
  { label: 'Underweight, below 18.5', below: 18.5 },
  { label: 'Normal, 18.5 to 24.9', below: 25 },
  { label: 'Overweight, 25.0 to 29.9', below: 30 },
  { label: 'Obese I, 30.0 to 34.9', below: 35 },
  { label: 'Obese II, 35.0 to 39.9', below: 40 },
  { label: 'Obese III, 40.0 and above' },
];

export function bmi({ weightKg, heightCm }) {
  const f = nums({ weightKg, heightCm }, {
    weightKg: { label: 'Weight', unit: 'kg', gt0: true, max: 500 },
    heightCm: { label: 'Height', unit: 'cm', gt0: true, max: 300 },
  });
  if (!f.ok) return err(f.error);

  const hM = f.v.heightCm / 100;
  const value = f.v.weightKg / (hM * hM);

  return ok(value, {
    unit: 'kg/m2',
    decimals: 1,
    formula: 'BMI = weight in kg / (height in metres)^2',
    standard: 'Standard BMI formula, the same worldwide',
    steps: [
      `${f.v.heightCm} cm is ${roundTo(hM, 2)} m`,
      `${f.v.weightKg} / (${roundTo(hM, 2)} x ${roundTo(hM, 2)}) = ${roundTo(value, 2)} kg/m2`,
    ],
    bands: [
      ...bandsFor(value, BMI_ASIAN, 'WHO Asia Pacific cutoffs, used in Indian practice', true,
        'WHO Asian cutoffs (Indian practice)'),
      ...bandsFor(value, BMI_INTL, 'WHO international cutoffs', true,
        'WHO international cutoffs'),
    ],
    warnings: [
      'The BMI number is the same under both standards. Only the classification differs, which is why both are shown.',
    ],
  });
}
