// =====================================================================
// src/data/calculators.js — Nursing Calculator Suite: the registry.
//
// The single source of truth the nursing-calc screen renders from. Each entry
// describes ONE calculator: its inputs (so the screen builds the form
// generically, there are no 21 bespoke forms) and the PURE compute function
// from src/lib/calc-*.js that produces the result envelope.
//
// ZERO AI: every compute reference below is a hardcoded formula with its own
// unit tests. All text here is user-facing copy, so calc-registry.test.js
// sweeps this whole file for em dashes and double hyphens, checks every id,
// category, keyword list and input shape, and calls every compute once.
//
// Input types the screen knows how to render:
//   number  { key, label, unit?, placeholder?, optional?, hint? }
//   segment { key, label, options: [{ value, label }] }   small inline choice
//   select  { key, label, options: [{ value, label }] }   scored dropdown rows
//   date    { key, label, optional?, hint? }
//   time    { key, label }                                 24h HH:MM text
// =====================================================================
import {
  weightConvert, heightConvert, tempConvert, timeConvert,
} from '../lib/calc-units.js';
import { bsa, bmi, exactAge } from '../lib/calc-body.js';
import {
  doseByWeight, doseOnHand, infusionRate, dripRate,
  pediatricDose, idealBodyWeight, cockcroftGault,
} from '../lib/calc-dosage.js';
import { fluidMaintenance, urineOutput, map } from '../lib/calc-fluids.js';
import {
  GCS_EYE, GCS_VERBAL, GCS_MOTOR, gcs,
  APGAR_APPEARANCE, APGAR_PULSE, APGAR_GRIMACE, APGAR_ACTIVITY, APGAR_RESPIRATION, apgar,
  BRADEN_SENSORY, BRADEN_MOISTURE, BRADEN_ACTIVITY, BRADEN_MOBILITY, BRADEN_NUTRITION, BRADEN_FRICTION, braden,
  MORSE_HISTORY, MORSE_SECONDARY, MORSE_AID, MORSE_IV, MORSE_GAIT, MORSE_MENTAL, morse,
} from '../lib/calc-scores.js';
import { naegele, gestationalAge } from '../lib/calc-obstetric.js';

// The six category groups, in display order.
export const CALC_CATEGORIES = [
  { id: 'dosage', label: 'Dosage & Medication', blurb: 'Doses, drips and renal dosing' },
  { id: 'body', label: 'Body Measurements', blurb: 'BSA, BMI and exact age' },
  { id: 'fluids', label: 'Fluids & Vitals', blurb: 'Maintenance fluids, urine output, MAP' },
  { id: 'conversion', label: 'Conversions', blurb: 'Weight, height, temperature and time' },
  { id: 'scores', label: 'Scoring Tools', blurb: 'GCS, APGAR, Braden and Morse' },
  { id: 'obstetric', label: 'Obstetric', blurb: 'Due date and gestational age' },
];

// The verbatim per-calculator disclaimer (owner's spec, shown on every card).
export const CALC_DISCLAIMER =
  "For reference and educational use. Always verify against your institution's protocol before clinical use.";

const scoreOptions = (list) => list.map((o) => ({ value: String(o.value), label: `${o.label} (${o.value})` }));

// Scored selects submit strings; the engines expect the numeric scale value.
const numify = (fn) => (v) => {
  const out = {};
  for (const k of Object.keys(v || {})) out[k] = v[k] === '' || v[k] === undefined ? v[k] : Number(v[k]);
  return fn(out);
};

export const CALCULATORS = [
  // ================= DOSAGE & MEDICATION =================
  {
    id: 'dose-weight', cat: 'dosage',
    name: 'Drug dose by weight',
    subtitle: 'mg per kg, with optional divided doses',
    keywords: ['dose', 'mg/kg', 'weight based', 'daily dose', 'divided'],
    inputs: [
      { type: 'number', key: 'dosePerKg', label: 'Prescribed dose', unit: 'mg/kg', placeholder: 'e.g. 15' },
      { type: 'number', key: 'weightKg', label: 'Patient weight', unit: 'kg', placeholder: 'e.g. 20' },
      { type: 'number', key: 'dosesPerDay', label: 'Doses per day', optional: true, placeholder: 'e.g. 3', hint: 'Leave blank for a single dose.' },
    ],
    compute: doseByWeight,
    formulaLabel: 'Dose = dose per kg x body weight',
  },
  {
    id: 'dose-on-hand', cat: 'dosage',
    name: 'Dose on hand',
    subtitle: 'Desired over have, times quantity',
    keywords: ['tablets', 'liquid', 'syrup', 'have', 'desired', 'volume to give'],
    inputs: [
      { type: 'number', key: 'desired', label: 'Dose desired', unit: 'mg', placeholder: 'e.g. 750' },
      { type: 'number', key: 'onHand', label: 'Dose on hand', unit: 'mg', placeholder: 'e.g. 250', hint: 'The strength written on the stock.' },
      { type: 'number', key: 'quantity', label: 'Quantity on hand', unit: 'mL or tablets', placeholder: 'e.g. 5', hint: 'Use 1 for tablets.' },
    ],
    compute: doseOnHand,
    formulaLabel: 'Give = (desired / on hand) x quantity',
  },
  {
    id: 'infusion-rate', cat: 'dosage',
    name: 'Infusion rate, mcg/kg/min',
    subtitle: 'Weight based drip to a pump rate in mL/hr',
    keywords: ['infusion', 'mcg/kg/min', 'pump', 'titration', 'inotrope', 'ml/hr'],
    inputs: [
      { type: 'number', key: 'doseMcgKgMin', label: 'Ordered dose', unit: 'mcg/kg/min', placeholder: 'e.g. 5' },
      { type: 'number', key: 'weightKg', label: 'Patient weight', unit: 'kg', placeholder: 'e.g. 70' },
      { type: 'number', key: 'drugMg', label: 'Drug in the bag', unit: 'mg', placeholder: 'e.g. 400' },
      { type: 'number', key: 'volumeMl', label: 'Bag volume', unit: 'mL', placeholder: 'e.g. 250' },
    ],
    compute: infusionRate,
    formulaLabel: 'Rate = (dose x kg x 60) / concentration',
  },
  {
    id: 'drip-rate', cat: 'dosage',
    name: 'IV flow and drip rate',
    subtitle: 'mL/hr and gtt/min from volume, time and drop factor',
    keywords: ['drip', 'gtt', 'drops', 'iv flow', 'drop factor', 'infusion time', 'macro', 'micro'],
    inputs: [
      { type: 'number', key: 'volumeMl', label: 'Volume to infuse', unit: 'mL', placeholder: 'e.g. 1000' },
      { type: 'number', key: 'timeHours', label: 'Over', unit: 'hours', placeholder: 'e.g. 8' },
      { type: 'segment', key: 'dropFactor', label: 'Drop factor (gtt/mL)', options: [
        { value: '10', label: '10' }, { value: '15', label: '15' }, { value: '20', label: '20' }, { value: '60', label: '60 micro' },
      ] },
    ],
    compute: dripRate,
    formulaLabel: 'gtt/min = (volume x drop factor) / minutes',
  },
  {
    id: 'pediatric-dose', cat: 'dosage',
    name: 'Pediatric dose',
    subtitle: "Clark's rule, Young's rule or the BSA method",
    keywords: ['pediatric', 'child dose', 'clark', 'young', 'bsa method', 'paediatric'],
    inputs: [
      { type: 'segment', key: 'method', label: 'Method', options: [
        { value: 'clark', label: "Clark's (weight)" }, { value: 'young', label: "Young's (age)" }, { value: 'bsa', label: 'BSA' },
      ] },
      { type: 'number', key: 'adultDose', label: 'Adult dose', unit: 'mg', placeholder: 'e.g. 500' },
      { type: 'number', key: 'weightKg', label: 'Child weight', unit: 'kg', placeholder: 'e.g. 15', showIf: { method: ['clark', 'bsa'] } },
      { type: 'number', key: 'ageYears', label: 'Child age', unit: 'years', placeholder: 'e.g. 6', showIf: { method: ['young'] } },
      { type: 'number', key: 'heightCm', label: 'Child height', unit: 'cm', placeholder: 'e.g. 110', showIf: { method: ['bsa'] } },
    ],
    compute: pediatricDose,
    formulaLabel: 'Three labelled methods, pick one',
  },
  {
    id: 'ibw', cat: 'dosage',
    name: 'Ideal Body Weight',
    subtitle: 'Devine formula from height and sex',
    keywords: ['ibw', 'ideal weight', 'devine', 'dosing weight'],
    inputs: [
      { type: 'segment', key: 'sex', label: 'Sex', options: [
        { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
      ] },
      { type: 'number', key: 'heightCm', label: 'Height', unit: 'cm', placeholder: 'e.g. 170' },
    ],
    compute: idealBodyWeight,
    formulaLabel: 'IBW = 50 (M) or 45.5 (F) + 2.3 per inch over 60',
  },
  {
    id: 'creatinine-clearance', cat: 'dosage',
    name: 'Creatinine Clearance',
    subtitle: 'Cockcroft-Gault estimate of renal function',
    keywords: ['crcl', 'creatinine', 'cockcroft', 'gault', 'renal', 'kidney', 'clearance'],
    inputs: [
      { type: 'segment', key: 'sex', label: 'Sex', options: [
        { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
      ] },
      { type: 'number', key: 'ageYears', label: 'Age', unit: 'years', placeholder: 'e.g. 60' },
      { type: 'number', key: 'weightKg', label: 'Weight', unit: 'kg', placeholder: 'e.g. 70' },
      { type: 'segment', key: 'creatinineUnit', label: 'Creatinine unit', options: [
        { value: 'mgdl', label: 'mg/dL' }, { value: 'umol', label: 'micromol/L' },
      ] },
      { type: 'number', key: 'creatinine', label: 'Serum creatinine', placeholder: 'e.g. 1.0' },
    ],
    compute: cockcroftGault,
    formulaLabel: 'CrCl = ((140 - age) x kg) / (72 x SCr), x 0.85 if female',
  },

  // ================= BODY MEASUREMENTS =================
  {
    id: 'bsa', cat: 'body',
    name: 'Body Surface Area',
    subtitle: 'Mosteller and DuBois, both shown',
    keywords: ['bsa', 'surface area', 'mosteller', 'dubois', 'm2'],
    inputs: [
      { type: 'segment', key: 'method', label: 'Headline formula', options: [
        { value: 'mosteller', label: 'Mosteller' }, { value: 'dubois', label: 'DuBois' },
      ] },
      { type: 'number', key: 'heightCm', label: 'Height', unit: 'cm', placeholder: 'e.g. 170' },
      { type: 'number', key: 'weightKg', label: 'Weight', unit: 'kg', placeholder: 'e.g. 70' },
    ],
    compute: bsa,
    formulaLabel: 'Mosteller: square root of (cm x kg / 3600)',
  },
  {
    id: 'bmi', cat: 'body',
    name: 'Body Mass Index',
    subtitle: 'One number, both WHO classification standards',
    keywords: ['bmi', 'body mass', 'obesity', 'underweight', 'asian cutoff'],
    inputs: [
      { type: 'number', key: 'weightKg', label: 'Weight', unit: 'kg', placeholder: 'e.g. 70' },
      { type: 'number', key: 'heightCm', label: 'Height', unit: 'cm', placeholder: 'e.g. 170' },
    ],
    compute: bmi,
    formulaLabel: 'BMI = kg / m^2',
  },
  {
    id: 'age', cat: 'body',
    name: 'Exact age',
    subtitle: 'Years, months and days from a date of birth',
    keywords: ['age', 'dob', 'birth date', 'how old', 'months'],
    inputs: [
      { type: 'date', key: 'dob', label: 'Date of birth' },
      { type: 'date', key: 'asOf', label: 'As of', optional: true, hint: 'Leave blank for today.' },
    ],
    compute: exactAge,
    formulaLabel: 'Calendar difference, leap years included',
  },

  // ================= FLUIDS & VITALS =================
  {
    id: 'fluid-maintenance', cat: 'fluids',
    name: 'Maintenance fluids',
    subtitle: 'Holliday-Segar daily total and the 4-2-1 hourly rate',
    keywords: ['fluids', 'maintenance', 'holliday', 'segar', '4-2-1', 'pediatric fluids'],
    inputs: [
      { type: 'number', key: 'weightKg', label: 'Weight', unit: 'kg', placeholder: 'e.g. 25' },
    ],
    compute: fluidMaintenance,
    formulaLabel: '100 / 50 / 20 mL per kg per day, by weight band',
  },
  {
    id: 'urine-output', cat: 'fluids',
    name: 'Urine output rate',
    subtitle: 'mL per kg per hour from a timed collection',
    keywords: ['urine', 'output', 'oliguria', 'ml/kg/hr', 'catheter'],
    inputs: [
      { type: 'number', key: 'volumeMl', label: 'Urine volume', unit: 'mL', placeholder: 'e.g. 500' },
      { type: 'number', key: 'weightKg', label: 'Weight', unit: 'kg', placeholder: 'e.g. 70' },
      { type: 'number', key: 'hours', label: 'Collected over', unit: 'hours', placeholder: 'e.g. 24' },
    ],
    compute: urineOutput,
    formulaLabel: 'Output = mL / (kg x hours)',
  },
  {
    id: 'map', cat: 'fluids',
    name: 'Mean Arterial Pressure',
    subtitle: 'MAP from systolic and diastolic',
    keywords: ['map', 'mean arterial', 'perfusion', 'blood pressure', 'bp'],
    inputs: [
      { type: 'number', key: 'systolic', label: 'Systolic', unit: 'mmHg', placeholder: 'e.g. 120' },
      { type: 'number', key: 'diastolic', label: 'Diastolic', unit: 'mmHg', placeholder: 'e.g. 80' },
    ],
    compute: map,
    formulaLabel: 'MAP = (SBP + 2 x DBP) / 3',
  },

  // ================= CONVERSIONS =================
  {
    id: 'convert-weight', cat: 'conversion',
    name: 'Weight: kg and lb',
    subtitle: 'Exact conversion both ways',
    keywords: ['kg', 'lb', 'pounds', 'kilograms', 'weight conversion'],
    inputs: [
      { type: 'segment', key: 'from', label: 'Convert from', options: [
        { value: 'kg', label: 'kg to lb' }, { value: 'lb', label: 'lb to kg' },
      ] },
      { type: 'number', key: 'value', label: 'Weight', placeholder: 'e.g. 70' },
    ],
    compute: weightConvert,
    formulaLabel: '1 lb = 0.45359237 kg exactly',
  },
  {
    id: 'convert-height', cat: 'conversion',
    name: 'Height: cm, inches, feet',
    subtitle: 'With a feet and inches breakdown',
    keywords: ['cm', 'inches', 'feet', 'height conversion', 'ft'],
    inputs: [
      { type: 'segment', key: 'from', label: 'Convert from', options: [
        { value: 'cm', label: 'cm to in' }, { value: 'in', label: 'in to cm' },
      ] },
      { type: 'number', key: 'value', label: 'Height', placeholder: 'e.g. 170' },
    ],
    compute: heightConvert,
    formulaLabel: '1 inch = 2.54 cm exactly',
  },
  {
    id: 'convert-temp', cat: 'conversion',
    name: 'Temperature: C and F',
    subtitle: 'Celsius is the primary scale',
    keywords: ['temperature', 'celsius', 'fahrenheit', 'fever', 'degrees'],
    inputs: [
      { type: 'segment', key: 'from', label: 'Convert from', options: [
        { value: 'c', label: 'C to F' }, { value: 'f', label: 'F to C' },
      ] },
      { type: 'number', key: 'value', label: 'Temperature', placeholder: 'e.g. 37' },
    ],
    compute: tempConvert,
    formulaLabel: 'F = (C x 9 / 5) + 32',
  },
  {
    id: 'convert-time', cat: 'conversion',
    name: 'Time: 24 hour and 12 hour',
    subtitle: '24 hour is the charting standard',
    keywords: ['time', '24 hour', 'military time', 'am pm', 'clock'],
    inputs: [
      { type: 'segment', key: 'from', label: 'Convert from', options: [
        { value: '24', label: '24h to 12h' }, { value: '12', label: '12h to 24h' },
      ] },
      { type: 'time', key: 'time', label: 'Time (HH:MM)', showIf: { from: ['24'] } },
      { type: 'number', key: 'hour', label: 'Hour (1 to 12)', placeholder: 'e.g. 1', showIf: { from: ['12'] } },
      { type: 'number', key: 'minute', label: 'Minutes', placeholder: 'e.g. 45', showIf: { from: ['12'] } },
      { type: 'segment', key: 'meridiem', label: 'AM or PM', options: [
        { value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' },
      ], showIf: { from: ['12'] } },
    ],
    compute: timeConvert,
    formulaLabel: '00:xx is 12 AM, 12:xx is 12 PM',
  },

  // ================= SCORING TOOLS =================
  {
    id: 'gcs', cat: 'scores',
    name: 'Glasgow Coma Scale',
    subtitle: 'Eye, verbal and motor, total 3 to 15',
    keywords: ['gcs', 'glasgow', 'coma', 'consciousness', 'neuro'],
    inputs: [
      { type: 'select', key: 'eye', label: 'Eye opening', options: scoreOptions(GCS_EYE) },
      { type: 'select', key: 'verbal', label: 'Verbal response', options: scoreOptions(GCS_VERBAL) },
      { type: 'select', key: 'motor', label: 'Motor response', options: scoreOptions(GCS_MOTOR) },
    ],
    compute: numify(gcs),
    formulaLabel: 'GCS = E + V + M',
  },
  {
    id: 'apgar', cat: 'scores',
    name: 'APGAR score',
    subtitle: 'Newborn assessment, total 0 to 10',
    keywords: ['apgar', 'newborn', 'neonate', 'delivery', 'birth score'],
    inputs: [
      { type: 'select', key: 'appearance', label: 'Appearance, colour', options: scoreOptions(APGAR_APPEARANCE) },
      { type: 'select', key: 'pulse', label: 'Pulse, heart rate', options: scoreOptions(APGAR_PULSE) },
      { type: 'select', key: 'grimace', label: 'Grimace, reflexes', options: scoreOptions(APGAR_GRIMACE) },
      { type: 'select', key: 'activity', label: 'Activity, tone', options: scoreOptions(APGAR_ACTIVITY) },
      { type: 'select', key: 'respiration', label: 'Respiration', options: scoreOptions(APGAR_RESPIRATION) },
    ],
    compute: numify(apgar),
    formulaLabel: 'Five items, each scored 0 to 2',
  },
  {
    id: 'braden', cat: 'scores',
    name: 'Braden Scale',
    subtitle: 'Pressure ulcer risk, total 6 to 23',
    keywords: ['braden', 'pressure ulcer', 'bed sore', 'skin risk', 'decubitus'],
    inputs: [
      { type: 'select', key: 'sensory', label: 'Sensory perception', options: scoreOptions(BRADEN_SENSORY) },
      { type: 'select', key: 'moisture', label: 'Moisture', options: scoreOptions(BRADEN_MOISTURE) },
      { type: 'select', key: 'activity', label: 'Activity', options: scoreOptions(BRADEN_ACTIVITY) },
      { type: 'select', key: 'mobility', label: 'Mobility', options: scoreOptions(BRADEN_MOBILITY) },
      { type: 'select', key: 'nutrition', label: 'Nutrition', options: scoreOptions(BRADEN_NUTRITION) },
      { type: 'select', key: 'friction', label: 'Friction and shear', options: scoreOptions(BRADEN_FRICTION) },
    ],
    compute: numify(braden),
    formulaLabel: 'Six subscales, lower total = higher risk',
  },
  {
    id: 'morse', cat: 'scores',
    name: 'Morse Fall Scale',
    subtitle: 'Fall risk, total 0 to 125',
    keywords: ['morse', 'fall risk', 'falls', 'mobility risk'],
    inputs: [
      { type: 'select', key: 'history', label: 'History of falling', options: scoreOptions(MORSE_HISTORY) },
      { type: 'select', key: 'secondary', label: 'Secondary diagnosis', options: scoreOptions(MORSE_SECONDARY) },
      { type: 'select', key: 'aid', label: 'Ambulatory aid', options: scoreOptions(MORSE_AID) },
      { type: 'select', key: 'iv', label: 'IV or heparin lock', options: scoreOptions(MORSE_IV) },
      { type: 'select', key: 'gait', label: 'Gait', options: scoreOptions(MORSE_GAIT) },
      { type: 'select', key: 'mental', label: 'Mental status', options: scoreOptions(MORSE_MENTAL) },
    ],
    compute: numify(morse),
    formulaLabel: 'Six weighted items',
  },

  // ================= OBSTETRIC =================
  {
    id: 'naegele', cat: 'obstetric',
    name: 'Due date',
    subtitle: "Naegele's rule from the last menstrual period",
    keywords: ['edd', 'due date', 'naegele', 'lmp', 'pregnancy', 'delivery date'],
    inputs: [
      { type: 'date', key: 'lmp', label: 'First day of the last menstrual period' },
      { type: 'number', key: 'cycleLength', label: 'Cycle length', unit: 'days', optional: true, placeholder: 'e.g. 28', hint: 'Leave blank for a standard 28 day cycle.' },
    ],
    compute: naegele,
    formulaLabel: 'EDD = LMP + 1 year - 3 months + 7 days',
  },
  {
    id: 'gestational-age', cat: 'obstetric',
    name: 'Gestational age',
    subtitle: 'Weeks and days from the LMP',
    keywords: ['gestational age', 'weeks pregnant', 'ga', 'trimester', 'lmp'],
    inputs: [
      { type: 'date', key: 'lmp', label: 'First day of the last menstrual period' },
      { type: 'date', key: 'asOf', label: 'As of', optional: true, hint: 'Leave blank for today.' },
    ],
    compute: gestationalAge,
    formulaLabel: 'Days since the LMP, as weeks + days',
  },
];

const byId = {};
CALCULATORS.forEach((c) => { byId[c.id] = c; });
export const calculatorById = (id) => byId[id] || null;

// Local search over the registry: name, subtitle and keywords, ranked by where
// the match lands. Tiny by design (23 entries), so no index is needed.
export function searchCalculators(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const c of CALCULATORS) {
    let score = 0;
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2.5;
    else if (c.keywords.some((k) => k.startsWith(q))) score = 2;
    else if (c.keywords.some((k) => k.includes(q))) score = 1.5;
    else if (c.subtitle.toLowerCase().includes(q)) score = 1;
    if (score > 0) scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.map((s) => s.c);
}
