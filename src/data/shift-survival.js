// =====================================================================
// src/data/shift-survival.js — content for Strategy Task 3.3 "Shift Survival".
//   CONDITIONS — a row tagged with a deteriorating patient clears ONLY when a
//     matching antidote block sits in it (classic antidote pairs; facts, not
//     copyrightable text).
//   MATH_QUESTIONS — the "combo crisis" hard clinical-math MCQs (10s timer).
//     All answers hand-verified; clean numbers; four plausible options each.
// =====================================================================
export const CONDITIONS = [
  { id: 'anaphylaxis', label: 'ANAPHYLAXIS',    antidote: 'Epinephrine',   short: 'EPI' },
  { id: 'opioid',      label: 'OPIOID OD',      antidote: 'Naloxone',      short: 'NAL' },
  { id: 'heparin',     label: 'HEPARIN BLEED',  antidote: 'Protamine',     short: 'PRO' },
  { id: 'warfarin',    label: 'WARFARIN BLEED', antidote: 'Vitamin K',     short: 'VIT K' },
  { id: 'benzo',       label: 'BENZO OD',       antidote: 'Flumazenil',    short: 'FLU' },
  { id: 'paracetamol', label: 'PARACETAMOL OD', antidote: 'N-acetylcyst.', short: 'NAC' },
  { id: 'mag',         label: 'MAG TOXICITY',   antidote: 'Ca gluconate',  short: 'Ca' },
  { id: 'digoxin',     label: 'DIGOXIN TOX',    antidote: 'Digoxin Fab',   short: 'FAB' },
];

export const MATH_QUESTIONS = [
  { q: 'Order: 1000 mL NS over 8 hours. Drop factor 15 gtt/mL. Set the rate.',
    options: ['~31 gtt/min', '~21 gtt/min', '~42 gtt/min', '~15 gtt/min'], correct: 0 },
  { q: 'Order: 500 mL over 4 hours. Drop factor 20 gtt/mL. Set the rate.',
    options: ['~42 gtt/min', '~25 gtt/min', '~31 gtt/min', '~50 gtt/min'], correct: 0 },
  { q: 'Heparin 25,000 units in 250 mL. Infuse 1000 units/hr. Pump rate?',
    options: ['10 mL/hr', '25 mL/hr', '100 mL/hr', '4 mL/hr'], correct: 0 },
  { q: 'Child 20 kg. Drug ordered 5 mg/kg/day in 2 divided doses. Dose each time?',
    options: ['50 mg', '100 mg', '25 mg', '40 mg'], correct: 0 },
  { q: 'Paracetamol 15 mg/kg for a 40 kg child. Single dose?',
    options: ['600 mg', '400 mg', '750 mg', '300 mg'], correct: 0 },
  { q: 'Order: 1 litre over 10 hours via a 20 gtt/mL set. Rate?',
    options: ['~33 gtt/min', '~25 gtt/min', '~50 gtt/min', '~17 gtt/min'], correct: 0 },
  { q: 'Available: 250 mg in 5 mL. Order: 400 mg IV. Volume to draw?',
    options: ['8 mL', '5 mL', '10 mL', '6.25 mL'], correct: 0 },
  { q: 'Order: 0.125 mg digoxin. Stock: 0.25 mg/mL. Volume to give?',
    options: ['0.5 mL', '1 mL', '0.25 mL', '2 mL'], correct: 0 },
  { q: 'Dopamine 200 mg in 250 mL. To run 400 mcg/min, the pump rate is?',
    options: ['30 mL/hr', '20 mL/hr', '50 mL/hr', '15 mL/hr'], correct: 0 },
  { q: 'Insulin drip 50 units in 50 mL. Order 6 units/hr. Pump rate?',
    options: ['6 mL/hr', '3 mL/hr', '12 mL/hr', '1 mL/hr'], correct: 0 },
];
