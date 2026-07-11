// =====================================================================
// src/lib/calc-units.js — Nursing Calculator Suite: shared core + conversions.
//
// PURE. No React, no DOM, no storage, no network, and NEVER any AI: every
// number in this suite comes from a hardcoded formula below, not a model.
//
// Every calculator in the suite returns the SAME envelope, which is how two
// safety rules are enforced structurally instead of being re-remembered on each
// screen:
//   1. NEVER round silently. The raw full-precision `value` is always kept
//      alongside the rounded `display`, and `rounding` is a plain sentence the
//      UI is required to show.
//   2. NEVER emit a wrong number. Bad input returns { ok:false, error } with a
//      plain-English reason. No NaN, no Infinity, no accidental negatives.
//
// This module also owns the unit conversions (exact, defined factors) so that
// no calculator re-derives them. Metric is primary throughout; imperial is a
// clearly labelled secondary.
// =====================================================================

// ---- exact conversion factors (defined, not approximations) ---------------
export const KG_PER_LB = 0.45359237;   // 1 lb === 0.45359237 kg, exactly
export const CM_PER_INCH = 2.54;       // 1 in === 2.54 cm, exactly

export const kgToLb = (kg) => kg / KG_PER_LB;
export const lbToKg = (lb) => lb * KG_PER_LB;
export const cmToIn = (cm) => cm / CM_PER_INCH;
export const inToCm = (inch) => inch * CM_PER_INCH;
export const cToF = (c) => (c * 9) / 5 + 32;
export const fToC = (f) => ((f - 32) * 5) / 9;

// ---- rounding -------------------------------------------------------------
// Round HALF UP at the requested decimals. Math.round alone is wrong for
// negatives and drifts on values like 1.005, so scale via exponent strings.
export function roundTo(value, decimals) {
  if (!Number.isFinite(value)) return value;
  const f = Math.pow(10, decimals);
  // +Number.EPSILON nudges binary-float values that sit a hair below .5
  return Math.round((value + Number.EPSILON) * f) / f;
}

// The rounding rule, as a sentence the result card shows verbatim. If the
// rounded number IS the exact number, we say so rather than implying loss.
function roundingSentence(raw, rounded, decimals) {
  if (raw === rounded) return 'Exact value, no rounding applied.';
  if (decimals === 0) return 'Rounded to the nearest whole number.';
  if (decimals === 1) return 'Rounded to 1 decimal place.';
  return `Rounded to ${decimals} decimal places.`;
}

// ---- the result envelope --------------------------------------------------
// ok(value, opts) -> the success envelope. `decimals` drives `display`, and the
// raw `value` is ALWAYS preserved at full precision.
export function ok(value, opts = {}) {
  const decimals = opts.decimals === undefined ? 2 : opts.decimals;
  const rounded = roundTo(value, decimals);
  return {
    ok: true,
    value,                                   // raw, full precision. Never lost.
    display: rounded.toFixed(decimals),      // what the big number shows
    rounded,
    unit: opts.unit || '',
    rounding: opts.rounding || roundingSentence(value, rounded, decimals),
    formula: opts.formula || '',
    standard: opts.standard || '',
    steps: opts.steps || [],
    bands: opts.bands || [],
    extras: opts.extras || [],               // secondary readouts (e.g. imperial)
    warnings: opts.warnings || [],
  };
}

// err(message) -> the failure envelope. The message is shown to the user, so it
// must be a complete, plain sentence with no jargon and no dashes.
export function err(message) {
  return { ok: false, error: message };
}

// ---- input validation -----------------------------------------------------
// num(raw, opts) -> { ok:true, v } | { ok:false, error }
// opts: { label, unit, gt0, min, max, integer }
export function num(raw, opts = {}) {
  const label = opts.label || 'Value';
  const unit = opts.unit ? ' ' + opts.unit : '';
  if (raw === '' || raw === null || raw === undefined) {
    return { ok: false, error: `${label} is required.` };
  }
  const v = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(v)) return { ok: false, error: `${label} must be a number.` };
  if (opts.integer && !Number.isInteger(v)) {
    return { ok: false, error: `${label} must be a whole number.` };
  }
  if (opts.gt0 && v <= 0) {
    return { ok: false, error: `${label} must be greater than 0${unit}.` };
  }
  if (opts.min !== undefined && v < opts.min) {
    return { ok: false, error: `${label} must be at least ${opts.min}${unit}.` };
  }
  if (opts.max !== undefined && v > opts.max) {
    return { ok: false, error: `${label} must be ${opts.max}${unit} or less.` };
  }
  return { ok: true, v };
}

// nums(raw, specs) -> parse a whole form in one pass, first error wins.
// specs is an object of { key: numOpts }; insertion order is the check order,
// so the user is told about the first field that is wrong, top to bottom.
export function nums(raw, specs) {
  const out = {};
  const src = raw || {};
  for (const key of Object.keys(specs)) {
    const r = num(src[key], specs[key]);
    if (!r.ok) return { ok: false, error: r.error };
    out[key] = r.v;
  }
  return { ok: true, v: out };
}

// pick(raw, allowed, label) -> validate a select/segment choice.
export function pick(raw, allowed, label) {
  const v = String(raw === undefined || raw === null ? '' : raw);
  if (allowed.includes(v)) return { ok: true, v };
  return { ok: false, error: `${label} must be one of: ${allowed.join(', ')}.` };
}

// ---- interpretation bands -------------------------------------------------
// bandsFor(value, defs, source) -> [{ label, match, source, flagged, group }]
// `defs` ascend and use an EXCLUSIVE upper bound (`below`), so float cutoffs
// like BMI 18.5 land in the band that starts at 18.5, not the one before it.
// The final def omits `below` and is the catch-all.
//
// `flagged: true` marks a band whose threshold still needs source confirmation
// against the institution's protocol; the UI renders a visible "verify" tag for
// those. The calculated NUMBER is never flagged, only the interpretation.
//
// `group` lets one calculator show SEVERAL labelled band sets side by side
// (BMI reports the same number against both the WHO Asian and the WHO
// international cutoffs, so the user can see why the classification differs).
export function bandsFor(value, defs, source, flagged = true, group = '') {
  let matched = false;
  return defs.map((d) => {
    const inBand = !matched && (d.below === undefined || value < d.below);
    if (inBand) matched = true;
    return { label: d.label, match: inBand, source, flagged, group };
  });
}

// =====================================================================
// CONVERSIONS (suite items 12 to 15). Each is a calculator in its own right,
// so each returns the standard envelope.
// =====================================================================

// 12. Weight: kg <-> lb. Exact factor, so the result is exact in one direction
// and a clean decimal in the other.
export function weightConvert({ value, from }) {
  const dir = pick(from, ['kg', 'lb'], 'Convert from');
  if (!dir.ok) return err(dir.error);
  const isKg = dir.v === 'kg';
  const f = num(value, {
    label: isKg ? 'Weight' : 'Weight',
    unit: isKg ? 'kg' : 'lb',
    gt0: true, max: 1000,
  });
  if (!f.ok) return err(f.error);
  const out = isKg ? kgToLb(f.v) : lbToKg(f.v);
  return ok(out, {
    unit: isKg ? 'lb' : 'kg',
    decimals: 2,
    formula: isKg ? 'lb = kg / 0.45359237' : 'kg = lb x 0.45359237',
    standard: 'Exact international conversion, 1 lb is defined as 0.45359237 kg',
    steps: [`${f.v} ${isKg ? 'kg' : 'lb'} converts to ${roundTo(out, 2)} ${isKg ? 'lb' : 'kg'}`],
  });
}

// 13. Height: cm <-> inches, with a feet + inches breakdown (imperial is the
// clearly labelled secondary; cm stays primary in the UI).
export function heightConvert({ value, from }) {
  const dir = pick(from, ['cm', 'in'], 'Convert from');
  if (!dir.ok) return err(dir.error);
  const isCm = dir.v === 'cm';
  const f = num(value, {
    label: 'Height', unit: isCm ? 'cm' : 'in', gt0: true, max: 300,
  });
  if (!f.ok) return err(f.error);

  const inches = isCm ? cmToIn(f.v) : f.v;
  const cm = isCm ? f.v : inToCm(f.v);
  const out = isCm ? inches : cm;

  // Feet + inches breakdown, rounded to the nearest whole inch for readability.
  const totalWholeIn = Math.round(inches);
  const ft = Math.floor(totalWholeIn / 12);
  const remIn = totalWholeIn % 12;

  return ok(out, {
    unit: isCm ? 'in' : 'cm',
    decimals: 2,
    formula: isCm ? 'in = cm / 2.54' : 'cm = in x 2.54',
    standard: 'Exact international conversion, 1 inch is defined as 2.54 cm',
    steps: [`${roundTo(cm, 1)} cm is ${roundTo(inches, 2)} in`],
    extras: [
      { label: 'Feet and inches', value: `${ft} ft ${remIn} in`, note: 'Rounded to the nearest whole inch.' },
      { label: 'Centimetres', value: `${roundTo(cm, 1)} cm` },
    ],
  });
}

// 14. Temperature: Celsius <-> Fahrenheit. Celsius is the primary unit.
// NOTE: deliberately NO fever threshold band. That reference range still needs
// source confirmation, and a wrong threshold is worse than none.
export function tempConvert({ value, from }) {
  const dir = pick(from, ['c', 'f'], 'Convert from');
  if (!dir.ok) return err(dir.error);
  const isC = dir.v === 'c';
  // Physiological sanity bounds, generous on purpose: reject typos, not patients.
  const f = num(value, {
    label: 'Temperature',
    unit: isC ? 'C' : 'F',
    min: isC ? -100 : -148,
    max: isC ? 200 : 392,
  });
  if (!f.ok) return err(f.error);
  const out = isC ? cToF(f.v) : fToC(f.v);
  return ok(out, {
    unit: isC ? 'F' : 'C',
    decimals: 1,
    formula: isC ? 'F = (C x 9 / 5) + 32' : 'C = (F - 32) x 5 / 9',
    standard: 'Standard Celsius and Fahrenheit conversion',
    steps: isC
      ? [`(${f.v} x 9 / 5) + 32 = ${roundTo(out, 2)}`]
      : [`(${f.v} - 32) x 5 / 9 = ${roundTo(out, 2)}`],
  });
}

// 15. Time: 24 hour <-> 12 hour. 24 hour is the primary format (it is the
// standard in Indian hospital charting).
// Input for '24' is an "HH:MM" string. Input for '12' is hour + minute + AM/PM.
export function timeConvert({ from, time, hour, minute, meridiem }) {
  const dir = pick(from, ['24', '12'], 'Convert from');
  if (!dir.ok) return err(dir.error);

  if (dir.v === '24') {
    const raw = String(time === undefined || time === null ? '' : time).trim();
    if (!raw) return err('Time is required, in 24 hour HH:MM format.');
    const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
    if (!m) return err('Time must look like 13:45, using 24 hour HH:MM format.');
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 23) return err('Hour must be between 00 and 23 in 24 hour time.');
    if (mi > 59) return err('Minutes must be between 00 and 59.');

    const mer = h < 12 ? 'AM' : 'PM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;                       // 00:xx is 12 AM, 12:xx is 12 PM
    const out = `${h12}:${String(mi).padStart(2, '0')} ${mer}`;
    return {
      ok: true,
      value: h * 60 + mi,                          // minutes past midnight, exact
      display: out,
      rounded: h * 60 + mi,
      unit: '',
      rounding: 'Exact value, no rounding applied.',
      formula: '00:xx is 12 AM, 12:xx is 12 PM, otherwise subtract 12 for PM',
      standard: '24 hour to 12 hour clock conversion',
      steps: [`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} in 24 hour time is ${out}`],
      bands: [],
      extras: [{ label: '24 hour (charting standard)', value: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` }],
      warnings: [],
    };
  }

  // 12 hour -> 24 hour
  const hh = num(hour, { label: 'Hour', integer: true, min: 1, max: 12 });
  if (!hh.ok) return err(hh.error);
  const mm = num(minute, { label: 'Minutes', integer: true, min: 0, max: 59 });
  if (!mm.ok) return err(mm.error);
  const mer = pick(meridiem, ['AM', 'PM'], 'AM or PM');
  if (!mer.ok) return err(mer.error);

  let h24 = hh.v % 12;                             // 12 AM -> 0, 12 PM -> 12
  if (mer.v === 'PM') h24 += 12;
  const out = `${String(h24).padStart(2, '0')}:${String(mm.v).padStart(2, '0')}`;
  return {
    ok: true,
    value: h24 * 60 + mm.v,
    display: out,
    rounded: h24 * 60 + mm.v,
    unit: '',
    rounding: 'Exact value, no rounding applied.',
    formula: '12 AM is 00, 12 PM is 12, otherwise add 12 for PM',
    standard: '12 hour to 24 hour clock conversion',
    steps: [`${hh.v}:${String(mm.v).padStart(2, '0')} ${mer.v} is ${out} in 24 hour time`],
    bands: [],
    extras: [{ label: '12 hour', value: `${hh.v}:${String(mm.v).padStart(2, '0')} ${mer.v}` }],
    warnings: [],
  };
}
