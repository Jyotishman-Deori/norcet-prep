// =====================================================================
// src/lib/calc-scores.js — Nursing Calculator Suite: scoring tools.
//
// PURE, hardcoded scales. No AI, ever. Items 16 to 19 of the suite:
//   16. Glasgow Coma Scale   (Eye 1-4 + Verbal 1-5 + Motor 1-6, total 3 to 15)
//   17. APGAR score          (5 items x 0-2, total 0 to 10)
//   18. Braden Scale         (5 subscales 1-4 + friction 1-3, total 6 to 23)
//   19. Morse Fall Scale     (6 weighted items, total 0 to 125)
//
// Each scale exports its option lists so the UI builds its selects from the SAME
// source the maths validates against. A selection that is not on the scale is an
// error, never a silently-dropped zero.
//
// [FLAG] Every risk/severity BAND below is a reference range pending source
// confirmation. The totals are simple addition and are not in doubt; only the
// interpretation is flagged, and the UI shows a "verify" tag on it.
// =====================================================================
import { ok, err, num, bandsFor } from './calc-units.js';

// ---- shared: add up a set of scale components ----------------------------
function sumScore(raw, parts) {
  const src = raw || {};
  let total = 0;
  const chosen = [];
  for (const p of parts) {
    const r = num(src[p.key], { label: p.label, integer: true });
    if (!r.ok) return { ok: false, error: r.error };
    const opt = p.options.find((o) => o.value === r.v);
    if (!opt) return { ok: false, error: `${p.label} is not a valid option on this scale.` };
    total += r.v;
    chosen.push(`${p.label}: ${opt.label} (${r.v})`);
  }
  return { ok: true, total, chosen };
}

// =====================================================================
// 16. GLASGOW COMA SCALE. Total = Eye + Verbal + Motor, from 3 to 15.
// =====================================================================
export const GCS_EYE = [
  { value: 4, label: 'Spontaneous' },
  { value: 3, label: 'To sound' },
  { value: 2, label: 'To pressure' },
  { value: 1, label: 'None' },
];
export const GCS_VERBAL = [
  { value: 5, label: 'Oriented' },
  { value: 4, label: 'Confused' },
  { value: 3, label: 'Words, not conversational' },
  { value: 2, label: 'Sounds only' },
  { value: 1, label: 'None' },
];
export const GCS_MOTOR = [
  { value: 6, label: 'Obeys commands' },
  { value: 5, label: 'Localising to pain' },
  { value: 4, label: 'Normal flexion, withdraws' },
  { value: 3, label: 'Abnormal flexion' },
  { value: 2, label: 'Extension' },
  { value: 1, label: 'None' },
];

const GCS_PARTS = [
  { key: 'eye', label: 'Eye opening', options: GCS_EYE },
  { key: 'verbal', label: 'Verbal response', options: GCS_VERBAL },
  { key: 'motor', label: 'Motor response', options: GCS_MOTOR },
];

const GCS_BANDS = [
  { label: 'Severe, 8 or less', below: 9 },
  { label: 'Moderate, 9 to 12', below: 13 },
  { label: 'Mild, 13 to 15' },
];

export function gcs(raw) {
  const s = sumScore(raw, GCS_PARTS);
  if (!s.ok) return err(s.error);
  return ok(s.total, {
    unit: s.total === 1 ? 'point' : 'points',
    decimals: 0,
    formula: 'GCS = eye opening + verbal response + motor response',
    standard: 'Glasgow Coma Scale, range 3 to 15',
    steps: [...s.chosen, `Total = ${s.total} out of 15`],
    bands: bandsFor(s.total, GCS_BANDS, 'Common severity bands', true),
    extras: [{ label: 'Score', value: `${s.total} / 15` }],
  });
}

// =====================================================================
// 17. APGAR SCORE. Five items, each 0, 1 or 2. Total 0 to 10.
// =====================================================================
export const APGAR_APPEARANCE = [
  { value: 2, label: 'Completely pink' },
  { value: 1, label: 'Body pink, extremities blue' },
  { value: 0, label: 'Blue or pale all over' },
];
export const APGAR_PULSE = [
  { value: 2, label: '100 bpm or above' },
  { value: 1, label: 'Below 100 bpm' },
  { value: 0, label: 'Absent' },
];
export const APGAR_GRIMACE = [
  { value: 2, label: 'Cry, cough or sneeze' },
  { value: 1, label: 'Grimace or feeble cry' },
  { value: 0, label: 'No response' },
];
export const APGAR_ACTIVITY = [
  { value: 2, label: 'Active motion' },
  { value: 1, label: 'Some flexion' },
  { value: 0, label: 'Limp' },
];
export const APGAR_RESPIRATION = [
  { value: 2, label: 'Good, strong cry' },
  { value: 1, label: 'Slow or irregular, weak cry' },
  { value: 0, label: 'Absent' },
];

const APGAR_PARTS = [
  { key: 'appearance', label: 'Appearance, skin colour', options: APGAR_APPEARANCE },
  { key: 'pulse', label: 'Pulse, heart rate', options: APGAR_PULSE },
  { key: 'grimace', label: 'Grimace, reflex irritability', options: APGAR_GRIMACE },
  { key: 'activity', label: 'Activity, muscle tone', options: APGAR_ACTIVITY },
  { key: 'respiration', label: 'Respiration', options: APGAR_RESPIRATION },
];

const APGAR_BANDS = [
  { label: 'Low, 0 to 3', below: 4 },
  { label: 'Moderately abnormal, 4 to 6', below: 7 },
  { label: 'Reassuring, 7 to 10' },
];

export function apgar(raw) {
  const s = sumScore(raw, APGAR_PARTS);
  if (!s.ok) return err(s.error);
  return ok(s.total, {
    unit: s.total === 1 ? 'point' : 'points',
    decimals: 0,
    formula: 'APGAR = appearance + pulse + grimace + activity + respiration',
    standard: 'APGAR score, range 0 to 10',
    steps: [...s.chosen, `Total = ${s.total} out of 10`],
    bands: bandsFor(s.total, APGAR_BANDS, 'Common APGAR bands', true),
    extras: [{ label: 'Score', value: `${s.total} / 10` }],
  });
}

// =====================================================================
// 18. BRADEN SCALE, pressure ulcer risk.
// Five subscales score 1 to 4, friction and shear scores 1 to 3.
// Total 6 to 23. A LOWER score means a HIGHER risk.
// =====================================================================
const b4 = (a, b, c, d) => [
  { value: 4, label: a }, { value: 3, label: b }, { value: 2, label: c }, { value: 1, label: d },
];

export const BRADEN_SENSORY = b4('No impairment', 'Slightly limited', 'Very limited', 'Completely limited');
export const BRADEN_MOISTURE = b4('Rarely moist', 'Occasionally moist', 'Often moist', 'Constantly moist');
export const BRADEN_ACTIVITY = b4('Walks frequently', 'Walks occasionally', 'Chairfast', 'Bedfast');
export const BRADEN_MOBILITY = b4('No limitation', 'Slightly limited', 'Very limited', 'Completely immobile');
export const BRADEN_NUTRITION = b4('Excellent', 'Adequate', 'Probably inadequate', 'Very poor');
export const BRADEN_FRICTION = [
  { value: 3, label: 'No apparent problem' },
  { value: 2, label: 'Potential problem' },
  { value: 1, label: 'Problem' },
];

const BRADEN_PARTS = [
  { key: 'sensory', label: 'Sensory perception', options: BRADEN_SENSORY },
  { key: 'moisture', label: 'Moisture', options: BRADEN_MOISTURE },
  { key: 'activity', label: 'Activity', options: BRADEN_ACTIVITY },
  { key: 'mobility', label: 'Mobility', options: BRADEN_MOBILITY },
  { key: 'nutrition', label: 'Nutrition', options: BRADEN_NUTRITION },
  { key: 'friction', label: 'Friction and shear', options: BRADEN_FRICTION },
];

const BRADEN_BANDS = [
  { label: 'Very high risk, 9 or less', below: 10 },
  { label: 'High risk, 10 to 12', below: 13 },
  { label: 'Moderate risk, 13 to 14', below: 15 },
  { label: 'Mild risk, 15 to 18', below: 19 },
  { label: 'Not at risk, 19 and above' },
];

export function braden(raw) {
  const s = sumScore(raw, BRADEN_PARTS);
  if (!s.ok) return err(s.error);
  return ok(s.total, {
    unit: s.total === 1 ? 'point' : 'points',
    decimals: 0,
    formula: 'Braden = sensory + moisture + activity + mobility + nutrition + friction and shear',
    standard: 'Braden Scale, range 6 to 23. A lower score means a higher risk',
    steps: [...s.chosen, `Total = ${s.total} out of 23`],
    bands: bandsFor(s.total, BRADEN_BANDS, 'Common Braden risk bands', true),
    extras: [{ label: 'Score', value: `${s.total} / 23` }],
    warnings: ['On the Braden Scale a LOWER total means a HIGHER pressure ulcer risk.'],
  });
}

// =====================================================================
// 19. MORSE FALL SCALE. Six weighted items, total 0 to 125.
//
// [FLAG] Two band variants are in common use (0-24 / 25-44 / 45+, and
// 0-24 / 25-50 / 51+). The one below must be confirmed against the institution's
// protocol before it is relied on. The TOTAL is unaffected either way.
// =====================================================================
export const MORSE_HISTORY = [
  { value: 0, label: 'No fall in the last 3 months' },
  { value: 25, label: 'Has fallen in the last 3 months' },
];
export const MORSE_SECONDARY = [
  { value: 0, label: 'One medical diagnosis' },
  { value: 15, label: 'More than one medical diagnosis' },
];
export const MORSE_AID = [
  { value: 0, label: 'None, bed rest, or nurse assisted' },
  { value: 15, label: 'Crutches, cane or walker' },
  { value: 30, label: 'Holds on to the furniture' },
];
export const MORSE_IV = [
  { value: 0, label: 'No IV or heparin lock' },
  { value: 20, label: 'Has an IV or heparin lock' },
];
export const MORSE_GAIT = [
  { value: 0, label: 'Normal, bed rest or wheelchair' },
  { value: 10, label: 'Weak' },
  { value: 20, label: 'Impaired' },
];
export const MORSE_MENTAL = [
  { value: 0, label: 'Oriented to own ability' },
  { value: 15, label: 'Overestimates or forgets limits' },
];

const MORSE_PARTS = [
  { key: 'history', label: 'History of falling', options: MORSE_HISTORY },
  { key: 'secondary', label: 'Secondary diagnosis', options: MORSE_SECONDARY },
  { key: 'aid', label: 'Ambulatory aid', options: MORSE_AID },
  { key: 'iv', label: 'IV or heparin lock', options: MORSE_IV },
  { key: 'gait', label: 'Gait', options: MORSE_GAIT },
  { key: 'mental', label: 'Mental status', options: MORSE_MENTAL },
];

const MORSE_BANDS = [
  { label: 'Low risk, 0 to 24', below: 25 },
  { label: 'Moderate risk, 25 to 44', below: 45 },
  { label: 'High risk, 45 and above' },
];

export function morse(raw) {
  const s = sumScore(raw, MORSE_PARTS);
  if (!s.ok) return err(s.error);
  return ok(s.total, {
    unit: s.total === 1 ? 'point' : 'points',
    decimals: 0,
    formula: 'Morse = history + secondary diagnosis + ambulatory aid + IV + gait + mental status',
    standard: 'Morse Fall Scale, range 0 to 125',
    steps: [...s.chosen, `Total = ${s.total} out of 125`],
    bands: bandsFor(s.total, MORSE_BANDS, 'Common Morse risk bands, other cutoffs exist', true),
    extras: [{ label: 'Score', value: `${s.total} / 125` }],
    warnings: [
      'Institutions use different Morse cutoffs. Some treat 25 to 50 as moderate and 51 and above as high. Confirm the bands your institution uses.',
    ],
  });
}
