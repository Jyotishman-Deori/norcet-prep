// =====================================================================
// src/lib/caliper-engine.js — pure engine for "Wave Hunter", the ECG caliper
// measurement lab. A calibrated ECG strip is rendered in SVG; the student drags
// two vertical calipers to measure PR / QRS / R-R / QT intervals, checked against
// a per-task tolerance. No React, no I/O, no Date.now — every rule that decides
// where a wave sits, what the truth interval is, and whether a measurement passes
// lives here so it's unit-testable in isolation.
//
// This is the TIME-CALIBRATED sibling of src/data/ecg-rhythms.js: it reuses that
// file's simple 'M.. L.. Q..' path-drawing vocabulary, but every X position is
// pinned to real seconds via a fixed paper calibration. The golden rule of this
// module: TRUTH IS DERIVED FROM THE SAME NUMBERS USED TO DRAW — onsets/offsets
// are computed, never hand-typed, so the strip a student sees and the answer the
// engine checks can never drift apart.
//
// See ward-boss-engine.js for the house pure-engine style (constants exported so
// the screen can mirror thresholds; a validate*() that returns null|string for
// the data-file lint).
// =====================================================================

// ── Calibration convention (FROZEN) ─────────────────────────────────
// Standard ECG paper at 25 mm/s: 1 small box = 0.04 s. In SVG user units we set
// 1 small box = 8 units → 1 second = 200 units. Vertical: baseline at y=100 in a
// 160-unit-tall strip; waves are drawn as offsets ABOVE the baseline (smaller y).
export const PX_PER_BOX = 8;      // SVG user units per one small ECG box
export const SEC_PER_BOX = 0.04;  // seconds per one small ECG box
export const HEIGHT_UNITS = 160;  // strip height in user units
export const BASELINE_Y = 100;    // y of the isoelectric baseline

const UNITS_PER_SEC = PX_PER_BOX / SEC_PER_BOX; // 8 / 0.04 = 200

// Wave amplitudes above baseline, in user units (see the spec brief).
const R_AMP = 55;   // R peak height above baseline
const P_AMP = 10;   // P wave bump height
const T_AMP = 14;   // T wave bump height
const Q_DIP = 8;    // small Q dip below baseline
const S_DIP = 14;   // small S dip below baseline

const P_DUR_SEC = 0.08;   // P wave lasts ~0.08 s from its onset
const DEFAULT_T_GAP_SEC = 0.30; // default T end = qrsOffset + 0.30 s when no QT given
const START_SEC = 0.6;    // first QRS onset ~0.6 s in from the strip's left edge

// The valid measurement targets. 'rr' is always measurable from rrSec.
const ASKS = ['pr', 'qrs', 'rr', 'qt'];

// =====================================================================
// Calibration helpers — the whole module speaks these two conversions.
// =====================================================================
export function unitsToSec(u) { return u / UNITS_PER_SEC; }
export function secToUnits(s) { return s * UNITS_PER_SEC; }

// Heart rate (bpm) from an R-R interval in seconds. Rounded, the way a monitor
// displays it. rateFromRR(0.8) === 75; rateFromRR(0.32) === 188.
export function rateFromRR(rrSec) { return Math.round(60 / rrSec); }

// ── internal: number → fixed-1-dp string for compact path 'd' output ─
const f1 = (n) => Number(n).toFixed(1);

// =====================================================================
// buildCalibratedStrip(spec, windowSec) -> { pathD, widthUnits, features }
//
// Places beats at EXACT times: the first QRS onset ~0.6 s in, and each beat b at
//   qrsOnset_b = START_SEC + b*rrSec   (b is 0-based).
// For every beat we emit features[b] = {
//   pOnset, pEnd, qrsOnset, rPeak, qrsOffset, tEnd  // x positions in UNITS
// } derived purely from the beat's own seconds. A DROPPED beat (prSeq null) draws
// the P wave but no QRS → its qrsOnset/rPeak/qrsOffset/tEnd are null.
//
// PR resolution per beat:
//   • spec.prSeq present → prSeq[b] (null = dropped beat, draw P, no QRS).
//   • else spec.prSec present → same PR every beat.
//   • else (both undefined) → NO P waves at all (fast regular / SVT-ish strip).
// The path is one continuous 'M.. L.. Q..' string on the baseline; visual polish
// matters less than X-position exactness of the onsets/offsets.
// =====================================================================
export function buildCalibratedStrip(spec, windowSec) {
  const s = spec || {};
  const rrSec = s.rrSec;
  const widthUnits = windowSec * UNITS_PER_SEC;

  // Enough beats to fill the window plus one, unless the spec pins a count.
  const derivedBeats = Math.max(2, Math.ceil((windowSec - START_SEC) / rrSec) + 1);
  const nBeats = Number.isFinite(s.beats) && s.beats > 0 ? Math.floor(s.beats) : derivedBeats;

  const hasSeq = Array.isArray(s.prSeq);
  const hasPr = Number.isFinite(s.prSec);
  const qrsSec = Number.isFinite(s.qrsSec) ? s.qrsSec : 0.08; // draw width if unspecified
  const hasQt = Number.isFinite(s.qtSec);

  // PR for beat b, or null when this beat's QRS is dropped, or undefined = no P.
  const prForBeat = (b) => {
    if (hasSeq) return b < s.prSeq.length ? s.prSeq[b] : s.prSeq[s.prSeq.length - 1];
    if (hasPr) return s.prSec;
    return undefined; // no P wave
  };

  const features = [];
  const seg = [`M 0 ${f1(BASELINE_Y)}`];

  // up(a): y position for an offset `a` units ABOVE baseline (a>0 → smaller y).
  const up = (a) => f1(BASELINE_Y - a);
  const dn = (a) => f1(BASELINE_Y + a); // below baseline

  let cursor = 0; // last x we drew to, in units — keeps the path continuous.
  const lineTo = (xUnits, yStr) => { seg.push(`L ${f1(xUnits)} ${yStr}`); cursor = xUnits; };
  const quadTo = (cxU, cyStr, xU, yStr) => { seg.push(`Q ${f1(cxU)} ${cyStr} ${f1(xU)} ${yStr}`); cursor = xU; };

  for (let b = 0; b < nBeats; b++) {
    const qrsOnsetSec = START_SEC + b * rrSec;
    const qrsOnset = secToUnits(qrsOnsetSec);
    const pr = prForBeat(b);
    const dropped = hasSeq && pr === null; // Wenckebach dropped QRS
    const drawP = pr !== undefined && pr !== null ? true : (dropped ? true : false);
    // A dropped beat (prSeq null) still had a P wave that failed to conduct — we
    // know WHERE that P was because the sequence up to the null tells us the PR
    // that would have applied. Use the last non-null PR as the dropped P's lead.
    let pr_draw = pr;
    if (dropped) {
      let lead = null;
      for (let k = b - 1; k >= 0; k--) { const pk = prForBeat(k); if (Number.isFinite(pk)) { lead = pk; break; } }
      if (lead == null) for (let k = b + 1; k < nBeats; k++) { const pk = prForBeat(k); if (Number.isFinite(pk)) { lead = pk; break; } }
      pr_draw = Number.isFinite(lead) ? lead : P_DUR_SEC * 2;
    }

    // ── P wave (if any) ──────────────────────────────────────────────
    let pOnset = null, pEnd = null;
    if (drawP) {
      pOnset = qrsOnset - secToUnits(pr_draw);
      pEnd = pOnset + secToUnits(P_DUR_SEC);
      const pMid = (pOnset + pEnd) / 2;
      if (pOnset > cursor) lineTo(pOnset, f1(BASELINE_Y)); // baseline up to the P onset
      // smooth P bump: control point at the crest, midway across the P.
      quadTo(pMid, up(P_AMP), pEnd, f1(BASELINE_Y));
    }

    // ── Dropped beat: no QRS, no T. Record the P-only feature and move on. ──
    if (dropped) {
      features.push({ pOnset, pEnd, qrsOnset: null, rPeak: null, qrsOffset: null, tEnd: null });
      continue;
    }

    // ── QRS complex: exactly qrsSec wide, Q dip → R spike → S dip inside. ──
    const qrsWidth = secToUnits(qrsSec);
    const qrsOffset = qrsOnset + qrsWidth;
    // proportion the sub-waves inside [qrsOnset, qrsOffset]: Q at 20%, R at 45%,
    // S at 75%, back to baseline at 100%. These are drawing choices only; the
    // exported onset/offset are the calibrated truth the screen measures against.
    const rPeak = qrsOnset + qrsWidth * 0.45;
    if (qrsOnset > cursor) lineTo(qrsOnset, f1(BASELINE_Y)); // PR segment to QRS onset
    lineTo(qrsOnset + qrsWidth * 0.20, dn(Q_DIP)); // Q dip below baseline
    lineTo(rPeak, up(R_AMP));                        // R spike
    lineTo(qrsOnset + qrsWidth * 0.75, dn(S_DIP));   // S dip
    lineTo(qrsOffset, f1(BASELINE_Y));               // back to baseline at offset

    // ── T wave: broad bump ending at tEnd. When qtSec is given the QT interval
    // runs from the QRS ONSET to the T END (tEnd = qrsOnset + secToUnits(qtSec)),
    // otherwise a default T ~0.30 s after the QRS offset. ──
    const tEnd = hasQt ? qrsOnset + secToUnits(s.qtSec) : qrsOffset + secToUnits(DEFAULT_T_GAP_SEC);
    // T starts partway between the QRS offset and tEnd so the crest sits inside.
    const tStart = qrsOffset + (tEnd - qrsOffset) * 0.35;
    const tMid = (tStart + tEnd) / 2;
    if (tStart > cursor) lineTo(tStart, f1(BASELINE_Y)); // ST segment to T start
    quadTo(tMid, up(T_AMP), tEnd, f1(BASELINE_Y));       // broad T bump

    features.push({ pOnset, pEnd, qrsOnset, rPeak, qrsOffset, tEnd });
  }

  // Draw the trailing baseline to the strip edge so the trace fills the window.
  if (cursor < widthUnits) lineTo(widthUnits, f1(BASELINE_Y));

  return { pathD: seg.join(' '), widthUnits, features };
}

// =====================================================================
// measureTruth(task) -> the true interval in SECONDS for the task's ask.
//   pr  -> strip.prSec, or the MAX non-null value in prSeq (Wenckebach: the
//          longest PR before the drop is what a student would time)
//   qrs -> strip.qrsSec
//   rr  -> strip.rrSec
//   qt  -> strip.qtSec
// =====================================================================
export function measureTruth(task) {
  const strip = (task && task.strip) || {};
  switch (task && task.ask) {
    case 'pr': {
      if (Array.isArray(strip.prSeq)) {
        const nums = strip.prSeq.filter((v) => Number.isFinite(v));
        return nums.length ? Math.max(...nums) : NaN;
      }
      return strip.prSec;
    }
    case 'qrs': return strip.qrsSec;
    case 'rr':  return strip.rrSec;
    case 'qt':  return strip.qtSec;
    default:    return NaN;
  }
}

// ── internal: index of the beat carrying the longest non-null PR in a prSeq.
function longestPrBeatIndex(prSeq) {
  let best = -1, bestVal = -Infinity;
  for (let i = 0; i < prSeq.length; i++) {
    const v = prSeq[i];
    if (Number.isFinite(v) && v > bestVal) { bestVal = v; best = i; }
  }
  return best;
}

// =====================================================================
// truthSpan(task, features) -> { x1, x2 } — the unit X positions of the true
// interval, anchored on beat task.beatIndex (default 1). For a Wenckebach 'pr'
// task (strip.prSeq present) we instead anchor on the beat carrying the LONGEST
// non-null PR, so the ghost/truth overlay lines up with what measureTruth returns.
//   pr:  pOnset  -> qrsOnset
//   qrs: qrsOnset -> qrsOffset
//   qt:  qrsOnset -> tEnd
//   rr:  rPeak(b) -> rPeak(b+1)
// =====================================================================
export function truthSpan(task, features) {
  const ask = task && task.ask;
  const strip = (task && task.strip) || {};
  let b = Number.isInteger(task && task.beatIndex) ? task.beatIndex : 1;
  if (ask === 'pr' && Array.isArray(strip.prSeq)) {
    const li = longestPrBeatIndex(strip.prSeq);
    if (li >= 0) b = li;
  }
  const fb = features[b] || {};
  switch (ask) {
    case 'pr':  return { x1: fb.pOnset, x2: fb.qrsOnset };
    case 'qrs': return { x1: fb.qrsOnset, x2: fb.qrsOffset };
    case 'qt':  return { x1: fb.qrsOnset, x2: fb.tEnd };
    case 'rr': {
      const fnext = features[b + 1] || {};
      return { x1: fb.rPeak, x2: fnext.rPeak };
    }
    default: return { x1: null, x2: null };
  }
}

// =====================================================================
// validateMeasurement(measuredSec, targetSec, tolSec)
//   -> { ok, errorSec, direction }
// ok when |measured - target| <= tol (edge INCLUSIVE). errorSec is the signed
// (measured - target) difference, rounded to 3 dp. direction describes the error:
// 'long' (measured too big), 'short' (too small), or 'exact' (zero error).
// =====================================================================
export function validateMeasurement(measuredSec, targetSec, tolSec) {
  const raw = measuredSec - targetSec;
  const errorSec = Math.round(raw * 1000) / 1000;
  const ok = Math.abs(raw) <= tolSec + 1e-9; // tiny epsilon so the ± edge is inclusive
  let direction = 'exact';
  if (errorSec > 0) direction = 'long';
  else if (errorSec < 0) direction = 'short';
  return { ok, errorSec, direction };
}

// =====================================================================
// clampCaliper(x, otherX, minX, maxX, side)
// Keep a dragged caliper inside [minX, maxX] AND at least a 4-unit gap from the
// other caliper on the correct side. side 'left' → x must stay <= otherX-4;
// side 'right' → x must stay >= otherX+4. Prevents the two calipers crossing or
// stacking into a zero-width (farm-able) measurement.
// =====================================================================
const MIN_GAP = 4;
export function clampCaliper(x, otherX, minX, maxX, side) {
  let v = x;
  if (v < minX) v = minX;
  if (v > maxX) v = maxX;
  if (side === 'left') {
    const cap = otherX - MIN_GAP;
    if (v > cap) v = cap;
    if (v < minX) v = minX; // gap constraint can't push us out of bounds
  } else { // 'right'
    const floor = otherX + MIN_GAP;
    if (v < floor) v = floor;
    if (v > maxX) v = maxX;
  }
  return v;
}

// =====================================================================
// validateTask(task) -> null when the task is well-formed, else a human string
// naming the first problem (prefixed with the task id when present). The data
// file lint test runs this over every authored task. Fail-closed: an ask whose
// required interval isn't present in the strip is a hard error, because the
// engine would otherwise measure `undefined` and the screen would show a task
// with no correct answer.
// =====================================================================
export function validateTask(task) {
  const tag = task && task.id != null ? `[${task.id}] ` : '';
  const bad = (msg) => `${tag}${msg}`;
  if (!task || typeof task !== 'object') return 'task is not an object';
  if (typeof task.id !== 'string' || !task.id) return bad('missing task id');
  if (!ASKS.includes(task.ask)) return bad(`ask must be one of ${ASKS.join('|')}`);

  const strip = task.strip;
  if (!strip || typeof strip !== 'object') return bad('missing strip');
  if (!Number.isFinite(strip.rrSec) || strip.rrSec <= 0) return bad('strip.rrSec must be a finite number > 0');

  // prSeq shape (when present): an array of (number|null) with >= 1 real number.
  if (strip.prSeq !== undefined) {
    if (!Array.isArray(strip.prSeq) || strip.prSeq.length === 0)
      return bad('strip.prSeq must be a non-empty array when present');
    let nNums = 0;
    for (const v of strip.prSeq) {
      if (v === null) continue;
      if (!Number.isFinite(v) || v <= 0) return bad('strip.prSeq entries must be a positive number or null');
      nNums++;
    }
    if (nNums < 1) return bad('strip.prSeq must contain at least one numeric PR value');
  }

  // The ask's needed field must be present.
  if (task.ask === 'pr') {
    const hasPr = Number.isFinite(strip.prSec);
    const hasSeq = Array.isArray(strip.prSeq);
    if (!hasPr && !hasSeq) return bad("ask 'pr' needs strip.prSec or strip.prSeq");
  } else if (task.ask === 'qrs') {
    if (!Number.isFinite(strip.qrsSec) || strip.qrsSec <= 0) return bad("ask 'qrs' needs a finite strip.qrsSec > 0");
  } else if (task.ask === 'qt') {
    if (!Number.isFinite(strip.qtSec) || strip.qtSec <= 0) return bad("ask 'qt' needs a finite strip.qtSec > 0");
  } // 'rr' is always satisfiable from rrSec above.

  if (!Number.isFinite(task.tolSec) || task.tolSec <= 0) return bad('tolSec must be a finite number > 0');
  if (!Number.isFinite(task.windowSec) || task.windowSec < 1.5) return bad('windowSec must be a finite number >= 1.5');

  if (task.beatIndex !== undefined && (!Number.isInteger(task.beatIndex) || task.beatIndex < 0))
    return bad('beatIndex must be a non-negative integer when present');

  const v = task.verdict;
  if (!v || typeof v !== 'object') return bad('missing verdict');
  if (!Array.isArray(v.normal) || v.normal.length !== 2 ||
      !Number.isFinite(v.normal[0]) || !Number.isFinite(v.normal[1]) || v.normal[0] >= v.normal[1])
    return bad('verdict.normal must be [lo, hi] with lo < hi');
  if (typeof v.label !== 'string' || !v.label.trim()) return bad('verdict.label must be a non-empty string');

  for (const field of ['title', 'question', 'rationale', 'examTip']) {
    if (typeof task[field] !== 'string' || !task[field].trim()) return bad(`${field} must be a non-empty string`);
  }
  return null;
}
