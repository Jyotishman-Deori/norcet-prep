// =====================================================================
// src/lib/foundational.js — FOUNDATION A1 (adapted to the client-blob model)
//
// "Foundational" = a must-know survival / safety protocol a working Nursing
// Officer cannot afford to miss on the floor (CPR ratio, hand-hygiene moments,
// ABC priority, insulin storage, biomedical-waste colour coding, anaphylaxis
// first-line, transfusion-reaction first action, …). Missing one is what
// PHIL-06 "Vitals Check" interrupts on, and what PHIL-01 Ikigai's "Mission"
// circle measures mastery of.
//
// The spec's Supabase `is_foundational` column is adapted to an OPTIONAL field
// on the existing question schema (no SQL migration — keeps the 5-stage broker
// security intact). A question is foundational when EITHER:
//   1. it is explicitly tagged  (q.foundational === true, or imported banks'
//      is_foundational === true), OR
//   2. it matches a TIGHT, high-precision survival-protocol pattern below.
//
// The heuristic is deliberately conservative: PHIL-06 forcibly pauses a test on
// a foundational miss, so a false positive is costly. Better to under-flag than
// to interrupt over a non-critical question. Explicit tagging (bank JSON / seed)
// is the precise path; the heuristic only guarantees the feature has fuel before
// every question is hand-tagged.
// =====================================================================

// High-precision patterns. Each must describe an unambiguous survival/safety
// protocol — not merely mention a clinical topic. Matched against the stem
// (+ sub-topic) only, case-insensitive.
const SURVIVAL_PATTERNS = [
  /\bcpr\b/i,
  /chest compression|compression(?:\s*(?:rate|ratio))|\b30\s*:\s*2\b|\b100[\s–-]*120\b/i,
  /hand hygiene|(?:five|5)\s*moments|hand[\s-]*wash/i,
  /\bairway\b.*\b(?:first|priority|patent|secure)/i,
  /\bABC(?:DE)?\b.*\b(?:priorit|approach|first)/i,
  /insulin\b.*\b(?:storage|stored|store|refrigerat|2\s*[-–]\s*8\s*°?c)/i,
  /(?:biomedical|bio-?medical)\s*waste|\bbmw\b.*\b(?:colour|color|segregat|yellow|red bag|blue|black)/i,
  /anaphyla(?:xis|ctic)\b.*\b(?:adrenaline|epinephrine|first|im\b)/i,
  /transfusion\b.*\b(?:reaction|stop the transfusion|first (?:action|step))/i,
  /defibrillat|shockable rhythm|pulseless\s*(?:vt|ventricular)/i,
  /(?:five|5)\s*rights|right (?:patient|drug|dose|route|time)\b/i,
  /\bgcs\b.*\b(?:8|intubat)/i,
];

// Read the explicit flag (supports either the app's `foundational` or an
// imported bank's `is_foundational`). Returns a tri-state: true / false /
// undefined (untagged → fall through to the heuristic).
function explicitFlag(q) {
  if (!q) return undefined;
  if (q.foundational === true || q.is_foundational === true) return true;
  if (q.foundational === false || q.is_foundational === false) return false;
  return undefined;
}

export function isFoundational(q) {
  if (!q) return false;
  const flag = explicitFlag(q);
  if (flag !== undefined) return flag;          // explicit tag always wins
  const hay = `${q.q || ''}   ${q.sub || ''}`;
  return SURVIVAL_PATTERNS.some((re) => re.test(hay));
}

// Count of foundational questions in a pool — used by PHIL-01 Mission circle
// and admin Bank-health later.
export function countFoundational(questions) {
  return (Array.isArray(questions) ? questions : []).reduce((n, q) => n + (isFoundational(q) ? 1 : 0), 0);
}
