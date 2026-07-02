// =====================================================================
// src/lib/titration-engine.js — pure engine for "Drip Zone", a closed-loop
// IV titration simulator. The player sets an infusion DOSE for a vasoactive /
// anticoagulant drug; the engine turns that dose into a pump RATE (mL/hr), a
// therapeutic ZONE, per-track physiologic TARGETS (e.g. MAP, HR), and drives
// the win / crisis / scoring logic. No React, no I/O, no Date.now, no
// Math.random — the rng and all time deltas are injected so every rule is
// unit-testable in isolation.
//
// House style mirrors ward-boss-engine.js / survival-engine.js: a validateX()
// that returns null-or-string over the FROZEN drug schema (the data file is
// authored in parallel and linted by this file's test), plus small pure
// functions the screen composes each frame.
// =====================================================================

// The FROZEN set of dose unit kinds. Each maps a dose to a pump rate below.
export const UNIT_KINDS = ['mcgkgmin', 'mcgmin', 'mghr', 'unitshr', 'unitskghr', 'mcgkghr'];

// Which unit kinds involve patient weight (used only for documentation / the
// screen; pumpRate encodes the math directly).
const WEIGHT_BASED = new Set(['mcgkgmin', 'mcgkghr', 'unitskghr']);

// Vitals-drift constant: fraction of the remaining gap closed per tick. Matches
// the ward-boss DRIFT feel so the two games read the same.
export const DRIFT = 0.15;

// =====================================================================
// validateDrug — returns null when the drug is valid, else a human string
// naming the drug id (when present) + the first problem. The data-file lint
// test runs this over every authored drug.
// =====================================================================
export function validateDrug(d) {
  const tag = d && d.id != null ? `[${d.id}] ` : '';
  const bad = (msg) => `${tag}${msg}`;
  if (!d || typeof d !== 'object') return 'drug is not an object';
  if (typeof d.id !== 'string' || !d.id) return bad('missing drug id');
  if (typeof d.name !== 'string' || !d.name.trim()) return bad('name must be a non-empty string');
  if (typeof d.mix !== 'string' || !d.mix.trim()) return bad('mix must be a non-empty string');

  if (!UNIT_KINDS.includes(d.unitKind))
    return bad(`unitKind must be one of ${UNIT_KINDS.join('|')} (got ${JSON.stringify(d.unitKind)})`);
  if (typeof d.unitLabel !== 'string' || !d.unitLabel.trim())
    return bad('unitLabel must be a non-empty string');

  // Dose band + step + concentration.
  if (!Number.isFinite(d.doseMin) || !Number.isFinite(d.doseMax) || !(d.doseMin < d.doseMax))
    return bad('doseMin/doseMax must be finite with doseMin < doseMax');
  if (!Number.isFinite(d.doseStep) || !(d.doseStep > 0)) return bad('doseStep must be > 0');
  if (!Number.isFinite(d.concPerMl) || !(d.concPerMl > 0)) return bad('concPerMl must be > 0');

  // Weight range + default.
  if (!Array.isArray(d.weightRange) || d.weightRange.length !== 2)
    return bad('weightRange must be a [min, max] pair');
  const [wLo, wHi] = d.weightRange;
  if (!Number.isFinite(wLo) || !Number.isFinite(wHi) || !(wLo < wHi))
    return bad('weightRange must be finite with min < max');
  if (!Number.isFinite(d.weightDefault) || d.weightDefault < wLo || d.weightDefault > wHi)
    return bad('weightDefault must be finite and within weightRange');

  // Safe window inside the dose band.
  if (!Array.isArray(d.safeWindow) || d.safeWindow.length !== 2)
    return bad('safeWindow must be a [lo, hi] pair');
  const [sLo, sHi] = d.safeWindow;
  if (!Number.isFinite(sLo) || !Number.isFinite(sHi) || !(sLo < sHi))
    return bad('safeWindow must be finite with lo < hi');
  if (sLo < d.doseMin || sHi > d.doseMax)
    return bad('safeWindow must lie within [doseMin, doseMax]');

  if (!Number.isFinite(d.holdSec) || d.holdSec < 1) return bad('holdSec must be >= 1');

  // Tracks: non-empty, each a well-formed physiologic readout.
  if (!Array.isArray(d.tracks) || d.tracks.length < 1) return bad('tracks must be a non-empty array');
  const trackKeys = new Set();
  for (const t of d.tracks) {
    if (!t || typeof t !== 'object') return bad('a track is not an object');
    if (typeof t.key !== 'string' || !t.key) return bad('a track is missing key');
    if (trackKeys.has(t.key)) return bad(`duplicate track key "${t.key}"`);
    trackKeys.add(t.key);
    if (typeof t.label !== 'string' || !t.label.trim()) return bad(`track ${t.key} missing label`);
    if (typeof t.unit !== 'string') return bad(`track ${t.key} missing unit`);
    if (!Number.isFinite(t.base)) return bad(`track ${t.key} base must be finite`);
    if (!Number.isFinite(t.target)) return bad(`track ${t.key} target must be finite`);
    if (!Number.isFinite(t.overSlope)) return bad(`track ${t.key} overSlope must be finite`);
    if (!Number.isFinite(t.alarmLow) || !Number.isFinite(t.alarmHigh) || !(t.alarmLow < t.alarmHigh))
      return bad(`track ${t.key} alarmLow must be < alarmHigh (both finite)`);
  }

  // Zone labels: exactly the three keys, all non-empty strings.
  const z = d.zoneLabels;
  if (!z || typeof z !== 'object') return bad('missing zoneLabels');
  for (const k of ['under', 'therapeutic', 'over']) {
    if (typeof z[k] !== 'string' || !z[k].trim()) return bad(`zoneLabels.${k} must be a non-empty string`);
  }

  for (const f of ['goal', 'rationale', 'examTip']) {
    if (typeof d[f] !== 'string' || !d[f].trim()) return bad(`${f} must be a non-empty string`);
  }
  return null;
}

// =====================================================================
// pumpRate — dose → pump rate in mL/hr, rounded to 1 decimal, never negative.
// The math is fixed per unitKind (see the frozen contract). Guards against a
// negative dose / weight so a hostile input can never mint a negative rate.
// =====================================================================
export function pumpRate(dose, weightKg, drug) {
  const conc = drug && Number.isFinite(drug.concPerMl) && drug.concPerMl > 0 ? drug.concPerMl : NaN;
  const dz = Number.isFinite(dose) ? Math.max(0, dose) : 0;
  const wt = Number.isFinite(weightKg) ? Math.max(0, weightKg) : 0;
  if (!Number.isFinite(conc)) return 0;

  let mlhr;
  switch (drug.unitKind) {
    case 'mcgkgmin': mlhr = (dz * wt * 60) / conc; break;
    case 'mcgmin':   mlhr = (dz * 60) / conc; break;
    case 'mcgkghr':  mlhr = (dz * wt) / conc; break;
    case 'mghr':     mlhr = dz / conc; break;
    case 'unitshr':  mlhr = dz / conc; break;
    case 'unitskghr':mlhr = (dz * wt) / conc; break;
    default:         mlhr = 0;
  }
  if (!Number.isFinite(mlhr) || mlhr < 0) mlhr = 0;
  return Math.round(mlhr * 10) / 10;
}

// =====================================================================
// zoneFor — classify a dose against the therapeutic band. Both endpoints of
// safeWindow are INCLUSIVE → therapeutic (a dose sitting exactly on lo/hi is a
// good, held titration, not a miss).
// =====================================================================
export function zoneFor(dose, drug) {
  const [lo, hi] = drug.safeWindow;
  const d = Number.isFinite(dose) ? dose : 0;
  if (d < lo) return 'under';
  if (d > hi) return 'over';
  return 'therapeutic';
}

// =====================================================================
// trackTargets — the steady-state physiologic value each track SHOULD settle
// to for a given dose. Piecewise, per track:
//
//   WINDOW-INTERIOR CHOICE (documented, per contract):
//   We model the drug's dose–response as a rising ramp that PLATEAUS across the
//   whole therapeutic window and only turns pathological on overshoot:
//
//     dose <= windowLo : linear ramp from `base` (at dose 0) to `target`
//                        (reached exactly at windowLo). This is the partial
//                        response as you climb into the band.
//                        Special case windowLo == 0: response is already at
//                        `target` for any dose in [0, windowHi] (there is no
//                        sub-therapeutic ramp room), i.e. base is only the
//                        theoretical dose-0 value.
//     windowLo..windowHi (the safe band): FLAT PLATEAU at `target`. The whole
//                        therapeutic window is "good enough" — adding dose
//                        inside the band does not keep pushing the vital, which
//                        is why the band, not a single point, is the win zone.
//                        (Chosen over a gentle in-band slope so the model is
//                        monotonic AND the plateau matches the game goal: hold
//                        anywhere in the band, not chase a knife-edge value.)
//     dose > windowHi  : crisis spike — target + (dose-windowHi)*overSlope.
//                        overSlope is signed by the track (a pressor's MAP rises,
//                        a rate that should fall carries a negative overSlope).
//
// Values are clamped to a sane per-track band — floor max(0, alarmLow/2),
// ceiling alarmHigh*1.5 — and rounded: integers unless the unit implies
// decimals (a unit string containing '.' or one of a small decimal allow-list).
// =====================================================================
function trackDecimals(track) {
  // Heuristic: most physiologic readouts are integers (HR, MAP, SBP, SpO2).
  // Temperature / lactate / pH style units carry one decimal. Kept explicit so
  // the data agent can force decimals via the unit string.
  const u = (track.unit || '').toLowerCase();
  return /°c|celsius|mmol|meq\/l|\bph\b|lactate|inr|mg\/dl/.test(u);
}

function targetForTrack(dose, track, lo, hi) {
  const d = Number.isFinite(dose) ? dose : 0;
  let v;
  if (lo <= 0) {
    // No sub-therapeutic ramp room: at/above 0 the response is already at target
    // until overshoot.
    v = d > hi ? track.target + (d - hi) * track.overSlope : track.target;
  } else if (d <= lo) {
    const frac = Math.max(0, d) / lo;                 // 0 → base, lo → target
    v = track.base + (track.target - track.base) * frac;
  } else if (d <= hi) {
    v = track.target;                                 // flat plateau across the band
  } else {
    v = track.target + (d - hi) * track.overSlope;    // crisis spike
  }
  // Per-track sanity band: never below 0 / half the low alarm, and never above
  // 1.5x the high alarm — an over-titration must read as a convincing crisis
  // number, not an impossible one (no MAP 456 or RR 1414 on a student's screen).
  const floor = Math.max(0, track.alarmLow / 2);
  const ceil = track.alarmHigh * 1.5;
  if (v < floor) v = floor;
  if (v > ceil) v = ceil;
  if (trackDecimals(track)) return Math.round(v * 10) / 10;
  return Math.round(v);
}

export function trackTargets(dose, drug) {
  const [lo, hi] = drug.safeWindow;
  const out = {};
  for (const t of drug.tracks) out[t.key] = targetForTrack(dose, t, lo, hi);
  return out;
}

// =====================================================================
// stepVitals — drift the displayed track values one tick toward `targets`,
// with a little symmetric jitter. Pure: rng injected (rng() ∈ [0,1)).
//   next[k] = cur[k] + (targets[k] - cur[k]) * DRIFT + (rng() - 0.5) * jitterAmp
// Rounds sensibly: integers unless the current value already carries a decimal.
// Iterating with rng = () => 0.5 zeroes the jitter and converges toward target
// (subject to the same integer-rounding fixed-point caveat as ward-boss:
// a sub-0.5 residual step rounds away, so allow a small tolerance in tests).
// =====================================================================
export function stepVitals(current, targets, rng, jitterAmp) {
  const amp = Number.isFinite(jitterAmp) ? jitterAmp : 0;
  const roll = typeof rng === 'function' ? rng : () => 0.5;
  const out = {};
  for (const k of Object.keys(targets)) {
    const cur = Number.isFinite(current && current[k]) ? current[k] : (Number.isFinite(targets[k]) ? targets[k] : 0);
    const tgt = Number.isFinite(targets[k]) ? targets[k] : cur;
    const next = cur + (tgt - cur) * DRIFT + (roll() - 0.5) * amp;
    // Round to match the granularity of the target: if the target is an integer
    // we keep integers, else one decimal. Never negative.
    const v = Math.max(0, next);
    out[k] = Number.isInteger(tgt) ? Math.round(v) : Math.round(v * 10) / 10;
  }
  return out;
}

// =====================================================================
// tickHold — accumulate time-in-zone toward the win. holdMs grows only while
// zone === 'therapeutic'; ANY departure from the band RESETS it to 0 (you must
// HOLD the drip in the band, not just touch it). won flips once the required
// hold is met. Pure: dtMs is the injected frame delta.
//
// state: { holdMs } (missing/garbage treated as 0). Guards dtMs >= 0 so a
// hostile negative delta can't rewind the hold or, worse, be looped to farm.
// =====================================================================
export function tickHold(state, zone, dtMs, holdSecRequired) {
  const prev = Number.isFinite(state && state.holdMs) ? Math.max(0, state.holdMs) : 0;
  const dt = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
  const needMs = (Number.isFinite(holdSecRequired) ? Math.max(1, holdSecRequired) : 1) * 1000;
  const holdMs = zone === 'therapeutic' ? prev + dt : 0;
  return { holdMs, won: holdMs >= needMs };
}

// =====================================================================
// crisisState — how dangerous a sustained overshoot has become. overMs is the
// CONTINUOUS time spent in the 'over' zone (the screen resets it to 0 whenever
// the dose leaves 'over', exactly like tickHold resets holdMs). Escalates:
//   overMs < alarmMs        → 'ok'
//   alarmMs <= overMs < fail→ 'alarm'  (klaxon; recoverable)
//   overMs >= failMs        → 'fail'   (patient crashes; round lost)
// alarmMs is clamped below failMs so the ordering can't be inverted by bad args.
// =====================================================================
export function crisisState(overMs, alarmMs, failMs) {
  const t = Number.isFinite(overMs) && overMs > 0 ? overMs : 0;
  const fail = Number.isFinite(failMs) && failMs > 0 ? failMs : Infinity;
  let alarm = Number.isFinite(alarmMs) && alarmMs > 0 ? alarmMs : 0;
  if (alarm >= fail) alarm = fail;      // never alarm at/after fail
  if (t >= fail) return 'fail';
  if (t >= alarm) return 'alarm';
  return 'ok';
}

// =====================================================================
// roundScore — coins for a completed round. Deterministic, floored, never
// negative. A loss is worth ZERO (no participation coins → can't be farmed by
// starting-and-bailing). Anti-exploit: the caller keys the grant to a single
// round-completion operation so the backend applies it idempotently — this
// returns the AMOUNT for that operation, it does not itself add coins anywhere.
//   base            25  (won only)
//   + clean bonus   10  (won AND !enteredCrisis — never touched the alarm/over)
//   × 2             if flashpoint (event day)
// =====================================================================
export const WIN_COINS = 25;
export const CLEAN_BONUS = 10;

export function roundScore({ won, enteredCrisis, flashpoint } = {}) {
  if (!won) return 0;
  let coins = WIN_COINS + (enteredCrisis ? 0 : CLEAN_BONUS);
  if (flashpoint) coins *= 2;
  return Math.max(0, Math.floor(coins));
}
