// =====================================================================
// src/lib/calc-obstetric.js — Nursing Calculator Suite: obstetric.
//
// PURE, hardcoded formulas. No AI, ever. Items 20 to 21 of the suite:
//   20. Naegele's rule       (estimated due date from the LMP)
//   21. Gestational age      (weeks + days from the LMP)
//
// All date maths runs on UTC integers via calc-body's parseDate, so an ISO date
// can never shift a day because of the device's timezone.
// =====================================================================
import { ok, err, num, roundTo, bandsFor } from './calc-units.js';
import { parseDate, daysInMonth, fmtDate } from './calc-body.js';

const DAY_MS = 86400000;
export const TERM_DAYS = 280;          // 40 weeks
export const DEFAULT_CYCLE = 28;

// A UTC "today", as a calendar date with no time component.
function todayUtc() {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}

// =====================================================================
// 20. NAEGELE'S RULE — estimated due date (EDD).
//   EDD = LMP + 1 year - 3 months + 7 days
// applied as a CALENDAR rule (add the 7 days, then shift the month and year,
// clamping the day if the target month is shorter).
//
// The simple "LMP + 280 days" answer is reported alongside it, because the two
// can differ by a day or so across month lengths, and hiding that would make one
// of them look wrong. Each is labelled.
//
// [FLAG] The cycle-length adjustment, EDD + (cycle length - 28) days, is
// optional and assumes a regular cycle. Confirm against your protocol.
// =====================================================================
export function naegele({ lmp, cycleLength }) {
  const l = parseDate(lmp, 'Last menstrual period');
  if (!l.ok) return err(l.error);

  // Optional cycle length. Blank means the standard 28 day cycle.
  let cycle = DEFAULT_CYCLE;
  const rawCycle = cycleLength;
  const blank = rawCycle === undefined || rawCycle === null || String(rawCycle).trim() === '';
  if (!blank) {
    const c = num(rawCycle, { label: 'Cycle length', unit: 'days', integer: true, min: 20, max: 45 });
    if (!c.ok) return err(c.error);
    cycle = c.v;
  }

  if (l.utc > todayUtc()) {
    return err('The last menstrual period cannot be in the future.');
  }

  // Calendar rule: +7 days, then -3 months, then +1 year.
  const plus7 = new Date(l.utc + 7 * DAY_MS);
  let y = plus7.getUTCFullYear() + 1;
  let m = plus7.getUTCMonth() + 1 - 3;
  const d = plus7.getUTCDate();
  if (m <= 0) { m += 12; y -= 1; }
  const clamped = Math.min(d, daysInMonth(y, m));
  let eddUtc = Date.UTC(y, m - 1, clamped);

  // Cycle adjustment (0 for a standard 28 day cycle).
  const adjust = cycle - DEFAULT_CYCLE;
  if (adjust !== 0) eddUtc += adjust * DAY_MS;

  const edd280 = l.utc + TERM_DAYS * DAY_MS + adjust * DAY_MS;
  const daysToGo = Math.round((eddUtc - todayUtc()) / DAY_MS);

  const steps = [
    `LMP ${fmtDate(l.utc)}, add 7 days, subtract 3 months, add 1 year`,
    `Estimated due date: ${fmtDate(eddUtc)}`,
  ];
  if (adjust !== 0) {
    steps.push(`Cycle length ${cycle} days, so ${adjust > 0 ? 'add' : 'subtract'} ${Math.abs(adjust)} day(s)`);
  }

  const warnings = [
    "Naegele's rule assumes a regular cycle and that ovulation happened on day 14. It is an estimate, not a diagnosis.",
  ];
  if (fmtDate(eddUtc) !== fmtDate(edd280)) {
    warnings.push('The calendar rule and the simple 280 day count can land a day or two apart because months differ in length. Both are shown above.');
  }

  return {
    ok: true,
    value: eddUtc,
    display: fmtDate(eddUtc),
    rounded: eddUtc,
    unit: '',
    rounding: 'Exact date, no rounding applied.',
    formula: "EDD = LMP + 1 year - 3 months + 7 days",
    standard: "Naegele's rule" + (adjust !== 0 ? `, adjusted for a ${cycle} day cycle` : ', standard 28 day cycle'),
    steps,
    bands: [],
    extras: [
      { label: 'Estimated due date', value: fmtDate(eddUtc) },
      { label: 'LMP plus 280 days', value: fmtDate(edd280) },
      { label: 'Days from today', value: daysToGo >= 0 ? `${daysToGo} days to go` : `${Math.abs(daysToGo)} days past` },
    ],
    warnings,
  };
}

// =====================================================================
// 21. GESTATIONAL AGE — weeks and days from the LMP.
//   total days = reference date - LMP
//   weeks = whole weeks, days = the remainder
//
// [FLAG] The trimester boundaries below (first 0w0d to 13w6d, second 14w0d to
// 27w6d, third 28w0d onwards) are a reference range pending confirmation.
// =====================================================================
const TRIMESTER_BANDS = [
  { label: 'First trimester, 0w0d to 13w6d', below: 98 },
  { label: 'Second trimester, 14w0d to 27w6d', below: 196 },
  { label: 'Third trimester, 28w0d and beyond' },
];

export function gestationalAge({ lmp, asOf }) {
  const l = parseDate(lmp, 'Last menstrual period');
  if (!l.ok) return err(l.error);

  let refUtc;
  if (asOf === undefined || asOf === null || String(asOf).trim() === '') {
    refUtc = todayUtc();
  } else {
    const r = parseDate(asOf, 'Reference date');
    if (!r.ok) return err(r.error);
    refUtc = r.utc;
  }

  if (l.utc > refUtc) {
    return err('The last menstrual period cannot be after the reference date.');
  }

  const totalDays = Math.round((refUtc - l.utc) / DAY_MS);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  const eddUtc = l.utc + TERM_DAYS * DAY_MS;
  const daysToGo = Math.round((eddUtc - refUtc) / DAY_MS);

  const warnings = [];
  if (weeks > 42) {
    warnings.push('This is beyond 42 weeks, which is past term. Check the LMP date you entered.');
  }

  return {
    ok: true,
    value: totalDays,
    display: `${weeks}w ${days}d`,
    rounded: totalDays,
    unit: '',
    rounding: 'Exact value, no rounding applied.',
    formula: 'Gestational age = reference date - LMP, expressed as whole weeks plus the remaining days',
    standard: 'Gestational age from the last menstrual period',
    steps: [
      `${fmtDate(l.utc)} to ${fmtDate(refUtc)} is ${totalDays} days`,
      `${totalDays} / 7 = ${weeks} weeks and ${days} day(s)`,
    ],
    bands: bandsFor(totalDays, TRIMESTER_BANDS, 'Common trimester boundaries', true),
    extras: [
      { label: 'Gestational age', value: `${weeks} weeks ${days} days` },
      { label: 'Total days', value: `${totalDays} days` },
      { label: 'Estimated due date (LMP plus 280 days)', value: fmtDate(eddUtc) },
      { label: 'Days to the due date', value: daysToGo >= 0 ? `${daysToGo} days` : `${Math.abs(daysToGo)} days past` },
      { label: 'Percent of a 40 week pregnancy', value: `${roundTo((totalDays / TERM_DAYS) * 100, 1)} percent` },
    ],
    warnings,
  };
}
