// =====================================================================
// src/data/crash-cart.js — NEW-10 (Module C) "Crash Cart".
// Emergency pharmacology under code pressure: a patient is crashing, pick the
// RIGHT drug + dose + route from the trolley. Drug "cards" are labelled (name +
// dose) — no photos needed, zero asset. NOT the existing "Code Blue Mode"
// (that re-drills your own wrong answers); this is an ACLS/emergency-drug drill.
// Distractors are deliberate near-misses (right drug/wrong dose, right idea/
// wrong order) so the teaching lands. Self-contained seed content.
// =====================================================================
export const CRASH_CASES = [
  {
    id: 'vf-adr',
    tag: 'ACLS · Cardiac arrest',
    vitals: 'Pulseless · VF on monitor',
    scenario: 'Adult in cardiac arrest. CPR is ongoing, the airway is secured. Two shocks have been delivered and the rhythm is STILL ventricular fibrillation.',
    prompt: 'Which drug goes in NOW?',
    options: [
      { name: 'Adrenaline', dose: '1 mg IV/IO' },
      { name: 'Amiodarone', dose: '300 mg IV' },
      { name: 'Atropine', dose: '0.6 mg IV' },
      { name: 'Calcium gluconate', dose: '10 mL 10% IV' },
    ],
    answer: 0,
    severity: 'critical',
    rationale: 'In shockable arrest, adrenaline 1 mg is given after the 2nd shock, then every 3–5 minutes. Amiodarone 300 mg is the next add-on but only after the 3rd shock. Adrenaline first.',
  },
  {
    id: 'vf-amio',
    tag: 'ACLS · Refractory VF',
    vitals: 'Pulseless · VF persists',
    scenario: 'Same arrest moments later. A third shock is delivered, adrenaline has already been given, and the patient remains in refractory VF.',
    prompt: 'Which antiarrhythmic now?',
    options: [
      { name: 'Amiodarone', dose: '300 mg IV bolus' },
      { name: 'Adrenaline', dose: 'extra 1 mg now' },
      { name: 'Lignocaine', dose: '100 mg, first line' },
      { name: 'Adenosine', dose: '6 mg IV' },
    ],
    answer: 0,
    severity: 'critical',
    rationale: 'Amiodarone 300 mg IV is the first-line antiarrhythmic for shock-refractory VF/pVT (after the 3rd shock); a 150 mg dose may follow. Adrenaline stays on its 3–5 min cycle — you do not double it. Adenosine is for SVT, never arrest.',
  },
  {
    id: 'asystole',
    tag: 'ACLS · Non-shockable',
    vitals: 'Flat line · no pulse',
    scenario: 'A patient arrests. The monitor shows asystole, confirmed in a second lead with the gain turned up. CPR is in progress.',
    prompt: 'First drug / action?',
    options: [
      { name: 'Adrenaline', dose: '1 mg IV, repeat q3–5 min' },
      { name: 'Defibrillate', dose: '200 J biphasic' },
      { name: 'Atropine', dose: '3 mg IV' },
      { name: 'Amiodarone', dose: '300 mg IV' },
    ],
    answer: 0,
    severity: 'critical',
    rationale: 'Asystole is NON-shockable — defibrillation is useless and harmful. Give adrenaline 1 mg early and repeat every 3–5 min while hunting reversible causes (the H’s and T’s). Atropine was dropped from the asystole algorithm years ago.',
  },
  {
    id: 'brady',
    tag: 'ACLS · Bradycardia',
    vitals: 'HR 38 · BP 78/44 · clammy',
    scenario: 'A patient is symptomatically bradycardic — heart rate 38, hypotensive, cool and confused. There is a pulse.',
    prompt: 'First-line drug?',
    options: [
      { name: 'Atropine', dose: '0.6 mg IV (up to 3 mg)' },
      { name: 'Adrenaline', dose: '1 mg IV push' },
      { name: 'Adenosine', dose: '6 mg IV' },
      { name: 'Amiodarone', dose: '300 mg IV' },
    ],
    answer: 0,
    severity: 'warning',
    rationale: 'Unstable bradycardia → atropine 0.6 mg IV first (repeat to a max ~3 mg). If it fails, move to a transcutaneous pacing or an adrenaline/dopamine INFUSION — not a 1 mg push, which is an arrest dose. Adenosine would slow the heart further — dangerous here.',
  },
  {
    id: 'anaphylaxis',
    tag: 'Emergency · Anaphylaxis',
    vitals: 'Stridor · BP 80/50 · urticaria',
    scenario: 'Minutes after an IV antibiotic, a patient develops stridor, a swollen face, widespread hives and a falling blood pressure.',
    prompt: 'The single most important drug?',
    options: [
      { name: 'Adrenaline', dose: '0.5 mg IM (1:1000)' },
      { name: 'Hydrocortisone', dose: '200 mg IV' },
      { name: 'Chlorphenamine', dose: '10 mg IV' },
      { name: 'Adrenaline', dose: '1 mg IV (1:10000)' },
    ],
    answer: 0,
    severity: 'critical',
    rationale: 'Anaphylaxis is killed by IM adrenaline 0.5 mg (0.5 mL of 1:1000) into the anterolateral thigh, repeated every 5 min as needed. Steroids and antihistamines are SECOND-line and slow. IV adrenaline is only for trained peri-arrest use — giving the arrest dose here can cause fatal arrhythmia.',
  },
  {
    id: 'hyperk',
    tag: 'Emergency · Hyperkalaemia',
    vitals: 'K⁺ 7.2 · peaked T, wide QRS',
    scenario: 'A dialysis patient has a potassium of 7.2 mmol/L with peaked T waves and a widening QRS on the monitor.',
    prompt: 'What protects the heart FIRST?',
    options: [
      { name: 'Calcium gluconate', dose: '10 mL 10% IV' },
      { name: 'Insulin + dextrose', dose: '10 U + 25 g IV' },
      { name: 'Salbutamol', dose: '10 mg nebulised' },
      { name: 'Sodium bicarbonate', dose: '50 mL 8.4% IV' },
    ],
    answer: 0,
    severity: 'critical',
    rationale: 'IV calcium stabilises the myocardium within minutes — it buys time but does NOT lower potassium. Insulin+dextrose and salbutamol then SHIFT potassium into cells; dialysis or resins truly REMOVE it. With ECG changes, calcium goes first.',
  },
  {
    id: 'opioid',
    tag: 'Emergency · Toxicology',
    vitals: 'RR 6 · pinpoint pupils · GCS 6',
    scenario: 'A patient is found drowsy with a respiratory rate of 6, pinpoint pupils and shallow breathing.',
    prompt: 'The antidote is:',
    options: [
      { name: 'Naloxone', dose: '0.4–2 mg IV, titrate' },
      { name: 'Flumazenil', dose: '0.2 mg IV' },
      { name: 'Atropine', dose: '0.6 mg IV' },
      { name: 'N-acetylcysteine', dose: 'IV infusion' },
    ],
    answer: 0,
    severity: 'critical',
    rationale: 'Pinpoint pupils + respiratory depression = opioid toxicity → naloxone, titrated to breathing (not full wakefulness, to avoid acute withdrawal). Flumazenil reverses benzodiazepines, NAC is for paracetamol — wrong toxidromes.',
  },
  {
    id: 'eclampsia',
    tag: 'OBG · Eclampsia',
    vitals: 'BP 168/112 · tonic-clonic fit',
    scenario: 'A 34-week pregnant woman has a generalised tonic-clonic seizure. Her blood pressure is 168/112 mmHg.',
    prompt: 'Drug of choice to stop & prevent fits?',
    options: [
      { name: 'Magnesium sulphate', dose: '4 g IV loading' },
      { name: 'Diazepam', dose: '10 mg IV' },
      { name: 'Phenytoin', dose: '1 g IV' },
      { name: 'Labetalol', dose: '20 mg IV' },
    ],
    answer: 0,
    severity: 'critical',
    rationale: 'Magnesium sulphate is the proven drug of choice for eclamptic seizures (and prophylaxis in severe pre-eclampsia) — superior to diazepam and phenytoin. Labetalol controls the blood pressure but does NOT treat the seizure. Watch for Mg toxicity: lost reflexes, low RR — antidote is calcium gluconate.',
  },
];
