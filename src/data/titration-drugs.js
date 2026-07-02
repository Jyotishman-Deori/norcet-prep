// =====================================================================
// src/data/titration-drugs.js — seed content for "Drip Zone", a closed-loop
// IV titration simulator (NORCET/AIIMS clinical-pharmacology drill). The
// player sets patient weight and drags a dose slider; the app derives the
// live IV pump rate (mL/hr) from the dose and drives simulated vitals that
// drift toward dose-dependent targets. Hold the therapeutic window for
// `holdSec` to win; drift into the "over" zone for too long triggers a
// crisis ending. All medical content is OWNER-REVIEWED (nurse educator)
// before ship — see the "clinical judgment calls" note in the PR/task
// summary, especially the insulin/glucose inversion below.
//
// SCHEMA (the game engine, src/lib/titration-engine.js `validateDrug`,
// validates this exactly — do not deviate):
//   {
//     id,                       // kebab, unique
//     name,                     // e.g. 'Norepinephrine (Noradrenaline)'
//     mix,                      // display string, e.g. '4 mg in 250 mL (16 mcg/mL)'
//     unitKind,                 // one of: 'mcgkgmin' | 'mcgmin' | 'mghr' | 'unitshr' | 'unitskghr' | 'mcgkghr'
//     unitLabel,                // display, e.g. 'mcg/kg/min'
//     doseMin, doseMax, doseStep,   // slider bounds + step (finite, doseMin<doseMax, step>0)
//     concPerMl,                // drug amount per mL of the prepared bag, in the drug's BASE
//                               //   unit consistent with unitKind (mcg-based unitKinds → mcg/mL;
//                               //   mg-based → mg/mL; units-based → units/mL)
//     weightRange: [min, max], weightDefault,   // default within range
//     safeWindow: [lo, hi],     // therapeutic dose band; MUST sit inside [doseMin, doseMax]
//     holdSec,                  // seconds to hold in-window to win (>=1; 8-12 typical)
//     goal,                     // short instruction, teaches the clinical target
//     tracks: [                 // 1-2 monitored parameters
//       { key, label, unit, base /*value at dose 0*/, target /*value at mid-window*/,
//         overSlope /*SIGNED change per dose-unit above the window — negative
//                     when the overdose danger is a FALL (insulin -> glucose
//                     crash, MgSO4 -> respiratory depression)*/,
//         alarmLow, alarmHigh } // alarmLow<alarmHigh; engine clamps displayed
//                               // values to [max(0, alarmLow/2), alarmHigh*1.5]
//     ],
//     zoneLabels: { under, therapeutic, over },  // 3 non-empty status strings (SHOUTY monitor style ok)
//     rationale, examTip,       // teaching text, plain text, non-empty, escaped apostrophes
//   }
//
// PUMP RATE FORMULAS (engine-owned, mirrored here only for the sanity check
// script — do not duplicate this logic anywhere else):
//   mcgkgmin:  (dose * weight * 60) / concPerMl
//   mcgmin:    (dose * 60) / concPerMl
//   mcgkghr:   (dose * weight) / concPerMl
//   mghr:      dose / concPerMl
//   unitshr:   dose / concPerMl
//   unitskghr: (dose * weight) / concPerMl
//
// To add a drug: copy the shape above, keep the mix concentration in the
// SAME base unit family as unitKind (mcg-based unitKinds need concPerMl in
// mcg/mL, etc.), keep safeWindow strictly inside [doseMin, doseMax], and
// verify the mid-window pump rate is a believable bedside mL/hr (roughly
// 1-150 mL/hr) with the sanity script noted in the task summary before
// shipping. Every 'rationale' should teach the titration principle, not just
// restate the dose.
//
// The roster is split into reviewable content waves: the 7 core drugs below
// plus b1 (expansion), merged into the one TITRATION_DRUGS export at the
// bottom. Drug ids are unique across the merged list (titration-engine.test.js).
// =====================================================================
import { TITRATION_DRUGS_B1 } from './titration-drugs-b1.js';

const CORE_TITRATION_DRUGS = [
  // ---------------------------------------------------------------------
  // 1. NOREPINEPHRINE — septic shock, first-line vasopressor
  // ---------------------------------------------------------------------
  {
    id: 'norepinephrine',
    name: 'Norepinephrine (Noradrenaline)',
    mix: '4 mg in 250 mL D5W (16 mcg/mL)',
    unitKind: 'mcgkgmin',
    unitLabel: 'mcg/kg/min',
    doseMin: 0,
    doseMax: 0.5,
    doseStep: 0.01,
    concPerMl: 16,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [0.05, 0.15],
    holdSec: 10,
    goal: 'Septic shock — raise the MAP to >= 65 mmHg and hold it there.',
    tracks: [
      { key: 'map', label: 'MAP', unit: 'mmHg', base: 55, target: 72, overSlope: 250, alarmLow: 60, alarmHigh: 110 },
      { key: 'hr', label: 'Heart Rate', unit: 'bpm', base: 118, target: 96, overSlope: 60, alarmLow: 50, alarmHigh: 150 },
    ],
    zoneLabels: {
      under: 'PERSISTENT HYPOTENSIVE SHOCK',
      therapeutic: 'STABLE — MAP >= 65',
      over: 'HYPERTENSIVE CRISIS',
    },
    rationale: 'Norepinephrine is a potent alpha-1 vasoconstrictor with modest beta-1 inotropy. In fluid-refractory septic shock it is titrated in small mcg/kg/min steps against MAP, not against a fixed rate — too little leaves tissue hypoperfused, too much drives dangerous vasoconstriction, reflex bradycardia territory, and a hypertensive spike that itself risks end-organ injury. The nurse\'s job is to find the lowest dose that sustains the MAP goal, then hold there.',
    examTip: 'NORCET favourite: norepinephrine is the first-line vasopressor for septic shock (over dopamine), titrated to MAP >= 65 mmHg. Give it through a central line to avoid extravasation necrosis, and when weaning, taper the dose gradually — never stop a vasopressor abruptly, or the pressure can crash.',
  },

  // ---------------------------------------------------------------------
  // 2. INSULIN INFUSION — DKA, blood-glucose-lowering drip
  // ---------------------------------------------------------------------
  {
    id: 'insulin-dka',
    name: 'Regular Insulin Infusion (DKA)',
    mix: '50 units Regular Insulin in 50 mL Normal Saline (1 unit/mL)',
    unitKind: 'unitshr',
    unitLabel: 'units/hr',
    doseMin: 0,
    doseMax: 10,
    doseStep: 0.5,
    concPerMl: 1,
    weightRange: [40, 100],
    weightDefault: 70,
    safeWindow: [3, 6],
    holdSec: 10,
    goal: 'Diabetic ketoacidosis — steadily lower the blood glucose without crashing it into hypoglycemia.',
    tracks: [
      {
        key: 'glucose',
        label: 'Blood Glucose',
        unit: 'mg/dL',
        base: 450,
        target: 250,
        overSlope: -60,   // NEGATIVE: past the window, glucose keeps FALLING toward the crash
        alarmLow: 70,
        alarmHigh: 450,
      },
    ],
    zoneLabels: {
      under: 'KETOACIDOSIS UNCORRECTED — GLUCOSE STILL SOARING',
      therapeutic: 'GLUCOSE FALLING SAFELY — HOLD THE RATE',
      over: 'HYPOGLYCEMIC CRASH',
    },
    rationale: 'Insulin is the one drip in this set where the danger direction is LOW, not high. In DKA the goal is a steady, controlled fall in glucose — roughly 50-75 mg/dL per hour on a low-dose continuous infusion — because the real treatment target is clearing the ketoacidosis, not crashing the number. Push the rate past the window and glucose keeps plunging toward hypoglycemia, which in an already-sick DKA patient can mean seizures and death faster than the ketosis ever would. Titrate down gently, and remember the potassium: insulin drives K+ into the cells with the glucose.',
    examTip: 'NORCET tests the DKA insulin trap hard: never start insulin before confirming potassium is above 3.3 mEq/L (insulin drives K+ into cells and can trigger a fatal arrhythmia), infuse as a steady low-dose continuous drip around 0.1 unit/kg/hr — never a bolus — and add dextrose to the fluids once glucose falls to 200-250 mg/dL so the infusion can keep running to clear ketones without causing hypoglycemia.',
  },

  // ---------------------------------------------------------------------
  // 3. HEPARIN INFUSION — therapeutic anticoagulation
  // ---------------------------------------------------------------------
  {
    id: 'heparin',
    name: 'Unfractionated Heparin Infusion',
    mix: '25,000 units in 250 mL Normal Saline (100 units/mL)',
    unitKind: 'unitskghr',
    unitLabel: 'units/kg/hr',
    doseMin: 0,
    doseMax: 30,
    doseStep: 1,
    concPerMl: 100,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [15, 20],
    holdSec: 10,
    goal: 'Acute PE / ACS — anticoagulate into the therapeutic aPTT band and hold it there without tipping into bleeding risk.',
    tracks: [
      {
        key: 'aptt',
        label: 'aPTT Trend',
        unit: 'x control',
        base: 1.0,
        target: 2.2,
        overSlope: 0.55,
        alarmLow: 1.3,
        alarmHigh: 3.5,
      },
    ],
    zoneLabels: {
      under: 'SUBTHERAPEUTIC — CLOT RISK PERSISTS',
      therapeutic: 'aPTT IN THERAPEUTIC RANGE',
      over: 'BLEEDING RISK — aPTT CRITICALLY HIGH',
    },
    rationale: 'Heparin has a narrow, weight-based therapeutic window and a famously unpredictable dose-response curve, which is exactly why it is titrated by protocol (usually via a weight-based nomogram) against serial aPTT rather than a fixed rate. This track stylises that as an "aPTT trend" climbing from a subtherapeutic baseline (1x control) toward a therapeutic band (roughly 1.5-2.5x control) — push the rate too high for too long and the trend climbs into bleeding-risk territory instead of plateauing.',
    examTip: 'NORCET tests the heparin monitoring pair: aPTT (or anti-Xa) for unfractionated heparin dose-response, and platelet counts trended for heparin-induced thrombocytopenia (HIT). Protamine sulfate is the reversal agent for heparin overdose/bleeding, given at roughly 1 mg per 100 units of heparin recently infused.',
  },

  // ---------------------------------------------------------------------
  // 4. MAGNESIUM SULFATE — eclampsia / severe pre-eclampsia
  // ---------------------------------------------------------------------
  {
    id: 'magnesium-sulfate',
    name: 'Magnesium Sulfate (Eclampsia Prophylaxis)',
    mix: '20 g in 500 mL Normal Saline (40 mg/mL)',
    unitKind: 'mghr',
    unitLabel: 'mg/hr',
    doseMin: 0,
    doseMax: 3000,
    doseStep: 50,
    concPerMl: 40,
    weightRange: [45, 100],
    weightDefault: 65,
    safeWindow: [1000, 2000],
    holdSec: 10,
    goal: 'Severe pre-eclampsia / eclampsia — maintain the seizure-prophylaxis infusion without tipping into magnesium toxicity.',
    tracks: [
      {
        key: 'rr',
        label: 'Respiratory Rate',
        unit: 'breaths/min',
        base: 18,
        target: 14,
        overSlope: -0.012,   // NEGATIVE: magnesium toxicity DEPRESSES breathing (per mg/hr above the window)
        alarmLow: 8,
        alarmHigh: 24,
      },
    ],
    zoneLabels: {
      under: 'INADEQUATE SEIZURE PROPHYLAXIS',
      therapeutic: 'MAINTENANCE RANGE — REFLEXES INTACT',
      over: 'RESPIRATORY DEPRESSION — MgSO4 TOXICITY',
    },
    rationale: 'Magnesium sulfate\'s margin between the therapeutic anticonvulsant level and toxicity is narrow, and the classic bedside monitoring is clinical, not just numeric: deep tendon (patellar) reflexes, respiratory rate, and urine output. This track uses respiratory rate as the visible proxy — a mild, expected slowing at maintenance dose, sliding toward dangerous respiratory depression if the rate is pushed too high. In real practice the patellar reflex disappears before respiratory depression sets in, so a nurse who checks reflexes hourly should never actually reach this track\'s "over" zone.',
    examTip: 'NORCET loves the MgSO4 toxicity ladder in order of onset: loss of deep tendon (patellar) reflexes first, then respiratory depression (RR < 12/min), then cardiac arrest at very high levels. Always keep calcium gluconate 10% at the bedside as the antidote, and hold/stop the infusion if reflexes are absent, urine output is < 30 mL/hr, or RR < 12/min.',
  },

  // ---------------------------------------------------------------------
  // 5. DOPAMINE — dose-dependent receptor effects teaching case
  // ---------------------------------------------------------------------
  {
    id: 'dopamine',
    name: 'Dopamine',
    mix: '400 mg in 250 mL D5W (1600 mcg/mL)',
    unitKind: 'mcgkgmin',
    unitLabel: 'mcg/kg/min',
    doseMin: 0,
    doseMax: 20,
    doseStep: 0.5,
    concPerMl: 1600,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [5, 10],
    holdSec: 10,
    goal: 'Cardiogenic shock — dial into the inotropic dose band to support the MAP and heart rate without tipping into tachyarrhythmia.',
    tracks: [
      { key: 'hr', label: 'Heart Rate', unit: 'bpm', base: 62, target: 92, overSlope: 7, alarmLow: 50, alarmHigh: 160 },
      { key: 'map', label: 'MAP', unit: 'mmHg', base: 52, target: 70, overSlope: 4, alarmLow: 55, alarmHigh: 120 },
    ],
    zoneLabels: {
      under: 'INOTROPIC SUPPORT INADEQUATE',
      therapeutic: 'INOTROPIC RANGE — PERFUSION SUPPORTED',
      over: 'TACHYARRHYTHMIA — ALPHA-DOMINANT OVERDRIVE',
    },
    rationale: 'Dopamine is the classic dose-dependent-receptor teaching drug: low "renal" doses (~1-3 mcg/kg/min) mainly hit dopaminergic receptors, the mid inotropic band (~5-10 mcg/kg/min) recruits beta-1 effects that raise heart rate and contractility, and high doses (>10 mcg/kg/min) become increasingly alpha-1 vasoconstrictive and pro-arrhythmic. This round\'s safe window sits in the inotropic band on purpose — under-dosing leaves the pump unsupported, over-dosing drives the heart into a dangerous tachyarrhythmia instead of more useful output.',
    examTip: 'NORCET tests the three dopamine dose bands by name — low/renal, intermediate/inotropic (beta-1), high/vasopressor (alpha-1) — and that dopamine causes more tachyarrhythmias than norepinephrine, which is why current sepsis guidelines prefer norepinephrine as first-line.',
  },

  // ---------------------------------------------------------------------
  // 6. LABETALOL — hypertensive emergency / stroke BP control
  // ---------------------------------------------------------------------
  {
    id: 'labetalol',
    name: 'Labetalol',
    mix: '200 mg in 200 mL Normal Saline (1 mg/mL)',
    unitKind: 'mghr',
    unitLabel: 'mg/hr',
    doseMin: 0,
    doseMax: 100,
    doseStep: 2,
    concPerMl: 1,
    weightRange: [45, 110],
    weightDefault: 70,
    safeWindow: [20, 40],
    holdSec: 10,
    goal: 'Hypertensive emergency — lower the MAP in a CONTROLLED step (no more than ~15% in the first hour), not a crash.',
    tracks: [
      {
        key: 'map',
        label: 'MAP',
        unit: 'mmHg',
        base: 148,
        target: 126,
        overSlope: -1.0,   // NEGATIVE: overshoot drives the MAP DOWN into hypoperfusion
        alarmLow: 90,
        alarmHigh: 150,
      },
    ],
    zoneLabels: {
      under: 'HYPERTENSIVE EMERGENCY UNCONTROLLED',
      therapeutic: 'CONTROLLED REDUCTION — ON TARGET',
      over: 'OVERSHOOT HYPOTENSION — PERFUSION RISK',
    },
    rationale: 'The trap in hypertensive-emergency titration is not reaching a lower pressure — it is reaching it too fast. Combined alpha/beta-blockade with labetalol is titrated to bring the MAP down gradually; overshooting drops perfusion pressure to organs that have auto-regulated to the higher baseline (brain especially, in stroke), which can convert a controlled emergency into a hypoperfusion injury. The window here rewards a measured step down, not the fastest possible drop.',
    examTip: 'NORCET\'s hypertensive-emergency rule: lower MAP by no more than ~10-15% in the first hour (then more gradually thereafter) — a "controlled descent," never a crash. In ischemic stroke specifically, BP is treated only if it exceeds ~185/110 mmHg (the tPA eligibility threshold) and is titrated with a short-acting agent like labetalol or nicardipine.',
  },

  // ---------------------------------------------------------------------
  // 7. NITROGLYCERIN — flash pulmonary edema / ACS preload reduction
  // ---------------------------------------------------------------------
  {
    id: 'nitroglycerin',
    name: 'Nitroglycerin (Glyceryl Trinitrate)',
    mix: '50 mg in 250 mL D5W (200 mcg/mL)',
    unitKind: 'mcgmin',
    unitLabel: 'mcg/min',
    doseMin: 5,
    doseMax: 200,
    doseStep: 5,
    concPerMl: 200,
    weightRange: [45, 110],
    weightDefault: 70,
    safeWindow: [20, 60],
    holdSec: 10,
    goal: 'Flash pulmonary edema / ACS — reduce preload and afterload to ease the heart\'s workload without crashing the pressure.',
    tracks: [
      { key: 'map', label: 'MAP', unit: 'mmHg', base: 118, target: 92, overSlope: -0.5, alarmLow: 60, alarmHigh: 120 },
      { key: 'hr', label: 'Heart Rate', unit: 'bpm', base: 108, target: 88, overSlope: 0.3, alarmLow: 50, alarmHigh: 150 },
    ],
    zoneLabels: {
      under: 'PULMONARY CONGESTION UNRELIEVED',
      therapeutic: 'PRELOAD REDUCED — WORK OF BREATHING EASING',
      over: 'HYPOTENSION — REFLEX TACHYCARDIA',
    },
    rationale: 'Nitroglycerin is primarily a venodilator at lower doses (reducing preload, which is exactly what a congested, fluid-backed-up heart in flash pulmonary edema needs) and increasingly an arterial dilator at higher doses. Titrating past the therapeutic window drops the MAP too far, and the body\'s reflex response to that sudden drop is a compensatory tachycardia — counterproductive in a heart that is already working too hard. The safe window models the "just enough preload reduction, without stealing perfusion pressure" target.',
    examTip: 'NORCET pairs nitroglycerin with two classic cautions: hold/avoid it in right-ventricular infarction (preload-dependent, so venodilation can cause profound hypotension) and in patients who have taken a PDE-5 inhibitor (e.g. sildenafil) within 24-48 hours, due to the risk of severe, refractory hypotension.',
  },
];

// 7 core + 10 expansion = 17 drugs. The run shuffles/slices; order here is cosmetic.
export const TITRATION_DRUGS = [...CORE_TITRATION_DRUGS, ...TITRATION_DRUGS_B1];

export default TITRATION_DRUGS;
