// =====================================================================
// src/data/titration-drugs-b1.js — "Drip Zone" content EXPANSION, wave B1.
// Adds 10 more drugs on top of the 7 shipped in src/data/titration-drugs.js
// (norepinephrine, insulin-dka, heparin, magnesium-sulfate, dopamine,
// labetalol, nitroglycerin) — no id or clinical overlap with that set. All
// medical content is OWNER-REVIEWED (nurse educator) before ship; see the
// "clinical judgment calls" note in the task summary this file shipped with.
//
// SCHEMA / ENGINE CONTRACT: identical to titration-drugs.js — this file adds
// entries to the same shape, validated by the same src/lib/titration-engine.js
// `validateDrug`. See that file's header for the full field-by-field schema,
// the pump-rate formulas per unitKind, and the trackTargets dose-response
// model (ramp to windowLo, flat plateau across the safe band, signed
// `overSlope` crisis spike past windowHi). Do not duplicate that doc here —
// read it before editing this file.
//
// REMINDER on overSlope sign (the rule a real bug was fixed on): overSlope is
// the SIGNED change per dose-unit ABOVE the safe window. NEGATIVE when
// overdose makes the tracked value FALL (bradycardia, hypotension, sedation
// crash); POSITIVE when overdose makes it RISE (tachyarrhythmia, hypertensive
// spike, hyperstimulation). Every track below is picked so the crisis crosses
// the correct alarm (alarmHigh for a rise, alarmLow for a fall).
// =====================================================================

export const TITRATION_DRUGS_B1 = [
  // ---------------------------------------------------------------------
  // 1. ADRENALINE (EPINEPHRINE) INFUSION — cardiogenic / anaphylactic shock
  // ---------------------------------------------------------------------
  {
    id: 'adrenaline-infusion',
    name: 'Adrenaline (Epinephrine) Infusion',
    mix: '4 mg in 250 mL D5W (16 mcg/mL)',
    unitKind: 'mcgkgmin',
    unitLabel: 'mcg/kg/min',
    doseMin: 0,
    doseMax: 0.6,
    doseStep: 0.01,
    concPerMl: 16,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [0.05, 0.3],
    holdSec: 10,
    goal: 'Cardiogenic / anaphylactic shock: support the MAP into a perfusing range without driving the heart into a dangerous tachyarrhythmia.',
    tracks: [
      { key: 'map', label: 'MAP', unit: 'mmHg', base: 50, target: 70, overSlope: 90, alarmLow: 55, alarmHigh: 115 },
      { key: 'hr', label: 'Heart Rate', unit: 'bpm', base: 100, target: 100, overSlope: 90, alarmLow: 50, alarmHigh: 160 },
    ],
    zoneLabels: {
      under: 'REFRACTORY SHOCK: PERFUSION NOT SUPPORTED',
      therapeutic: 'PERFUSING RHYTHM: MAP SUPPORTED',
      over: 'TACHYARRHYTHMIA CRISIS: ALPHA/BETA OVERDRIVE',
    },
    rationale: 'Adrenaline is a potent, dose-dependent alpha/beta agonist reserved for shock that has not responded to first-line agents (cardiogenic shock, or anaphylaxis after IM dosing has failed). At the low end it recruits beta-1 inotropy and chronotropy to lift the MAP; push it past the therapeutic window and the same receptors that were rescuing perfusion tip the heart into a dangerous tachyarrhythmia while myocardial oxygen demand spikes. The nurse titrates to the lowest dose that sustains perfusion, exactly as with any pressor.',
    examTip: 'NORCET distinguishes adrenaline routes by indication: IM adrenaline (1:1000, anterolateral thigh) is first-line for anaphylaxis, while a titrated IV infusion is reserved for refractory shock or peri-arrest states under continuous monitoring. Watch for its classic side-effect triad on the exam: tachyarrhythmia, hyperglycemia, and hypokalemia (beta-2 driven potassium shift into cells).',
  },

  // ---------------------------------------------------------------------
  // 2. DOBUTAMINE — cardiogenic shock / low-output heart failure inotrope
  // ---------------------------------------------------------------------
  {
    id: 'dobutamine',
    name: 'Dobutamine',
    mix: '250 mg in 250 mL D5W (1000 mcg/mL)',
    unitKind: 'mcgkgmin',
    unitLabel: 'mcg/kg/min',
    doseMin: 0,
    doseMax: 20,
    doseStep: 0.5,
    concPerMl: 1000,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [2, 10],
    holdSec: 10,
    goal: 'Low cardiac output failure, titrate the inotrope to improve output and MAP without provoking a tachyarrhythmia.',
    tracks: [
      { key: 'map', label: 'MAP', unit: 'mmHg', base: 58, target: 74, overSlope: 3, alarmLow: 55, alarmHigh: 110 },
      { key: 'hr', label: 'Heart Rate', unit: 'bpm', base: 78, target: 92, overSlope: 6, alarmLow: 50, alarmHigh: 160 },
    ],
    zoneLabels: {
      under: 'LOW OUTPUT: PUMP UNSUPPORTED',
      therapeutic: 'INOTROPIC SUPPORT: OUTPUT IMPROVING',
      over: 'TACHYARRHYTHMIA: DEMAND ISCHEMIA RISK',
    },
    rationale: 'Dobutamine is a beta-1-selective inotrope used when the problem is a failing pump rather than a low resistance, it increases contractility and cardiac output with comparatively little vasoconstriction, making it a mainstay for cardiogenic shock and decompensated heart failure. Titrating past the therapeutic band recruits enough beta-1 drive to push the heart rate into a tachyarrhythmia, which raises myocardial oxygen demand exactly when the heart can least afford it.',
    examTip: 'NORCET pairs dobutamine with dopamine as the classic inotrope comparison: dobutamine improves contractility with less peripheral vasoconstriction and less arrhythmia burden than dopamine, making it the preferred inotrope in cardiogenic shock with an adequate MAP, often combined with a vasopressor if the pressure itself is also low.',
  },

  // ---------------------------------------------------------------------
  // 3. SODIUM NITROPRUSSIDE — hypertensive emergency
  // ---------------------------------------------------------------------
  {
    id: 'sodium-nitroprusside',
    name: 'Sodium Nitroprusside',
    mix: '50 mg in 250 mL D5W (200 mcg/mL)',
    unitKind: 'mcgkgmin',
    unitLabel: 'mcg/kg/min',
    doseMin: 0,
    doseMax: 3,
    doseStep: 0.05,
    concPerMl: 200,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [0.3, 2],
    holdSec: 10,
    goal: 'Hypertensive emergency: bring the MAP down into a controlled range without crashing perfusion pressure.',
    tracks: [
      {
        key: 'map',
        label: 'MAP',
        unit: 'mmHg',
        base: 150,
        target: 110,
        overSlope: -12,   // NEGATIVE: overshoot drives the MAP DOWN into profound hypotension
        alarmLow: 60,
        alarmHigh: 150,
      },
    ],
    zoneLabels: {
      under: 'HYPERTENSIVE EMERGENCY UNCONTROLLED',
      therapeutic: 'MAP CONTROLLED: ARTERIOLAR + VENOUS DILATION BALANCED',
      over: 'PROFOUND HYPOTENSION: CYANIDE RISK ZONE',
    },
    rationale: 'Nitroprusside is a balanced arterial and venous dilator with an almost immediate onset and offset, which is exactly why it is delivered on an infusion pump with continuous arterial-line BP monitoring rather than intermittent cuffs. The effect can run away in minutes if titrated carelessly. Push the dose past the therapeutic band and the MAP falls into hypotension fast enough to threaten cerebral and coronary perfusion.',
    examTip: 'NORCET\'s nitroprusside toxicity trap: prolonged use or high doses generate cyanide (and then thiocyanate) as nitroprusside is metabolised, especially with renal or hepatic impairment. Watch for unexplained metabolic acidosis or altered mental status, protect from light during infusion, and keep the duration and dose as low as the pressure allows.',
  },

  // ---------------------------------------------------------------------
  // 4. AMIODARONE — VT / AF rhythm control
  // ---------------------------------------------------------------------
  {
    id: 'amiodarone',
    name: 'Amiodarone',
    mix: '900 mg in 500 mL D5W (1.8 mg/mL)',
    unitKind: 'mghr',
    unitLabel: 'mg/hr',
    doseMin: 0,
    doseMax: 100,
    doseStep: 2.5,
    concPerMl: 1.8,
    weightRange: [45, 110],
    weightDefault: 70,
    safeWindow: [15, 60],
    holdSec: 10,
    goal: 'Ventricular tachycardia / atrial fibrillation, settle the rhythm into a controlled rate on the maintenance infusion without over-suppressing it.',
    tracks: [
      {
        key: 'hr',
        label: 'Heart Rate',
        unit: 'bpm',
        base: 168,
        target: 84,
        overSlope: -1.1,   // NEGATIVE: over-suppression drives bradycardia/hypotension
        alarmLow: 40,
        alarmHigh: 170,
      },
    ],
    zoneLabels: {
      under: 'VT/AF UNCONTROLLED: RHYTHM UNSTABLE',
      therapeutic: 'RATE CONTROLLED: MAINTENANCE INFUSION STABLE',
      over: 'SYMPTOMATIC BRADYCARDIA: CONDUCTION OVER-SUPPRESSED',
    },
    rationale: 'Amiodarone follows a load-then-maintenance pattern in practice, a rapid IV bolus/load to terminate or control the acute arrhythmia, followed by a slower maintenance infusion (the dose this drip models) to keep the rhythm controlled without re-loading the patient. Running the maintenance rate too high for too long over-suppresses cardiac conduction, tipping a controlled rhythm into symptomatic bradycardia or hypotension instead of holding steady rate control.',
    examTip: 'NORCET tests amiodarone\'s dual identity: it is a class III antiarrhythmic with class I/II/IV properties too (a genuine multi-mechanism drug), it is safe to give in most unstable ventricular arrhythmias including some with reduced ejection fraction, and its long half-life (weeks) means toxicity, pulmonary fibrosis, thyroid dysfunction, corneal deposits, blue-grey skin discoloration. Can surface long after the infusion stops.',
  },

  // ---------------------------------------------------------------------
  // 5. DILTIAZEM — AF with rapid ventricular response, rate control
  // ---------------------------------------------------------------------
  {
    id: 'diltiazem',
    name: 'Diltiazem',
    mix: '125 mg in 100 mL Normal Saline (1.25 mg/mL)',
    unitKind: 'mghr',
    unitLabel: 'mg/hr',
    doseMin: 0,
    doseMax: 25,
    doseStep: 0.5,
    concPerMl: 1.25,
    weightRange: [45, 110],
    weightDefault: 70,
    safeWindow: [5, 15],
    holdSec: 10,
    goal: 'Atrial fibrillation with rapid ventricular response, bring the ventricular rate under control without dropping the pressure or the rate too far.',
    tracks: [
      {
        key: 'hr',
        label: 'Heart Rate',
        unit: 'bpm',
        base: 152,
        target: 96,
        overSlope: -3.2,   // NEGATIVE: too much calcium-channel blockade drives bradycardia + hypotension
        alarmLow: 45,
        alarmHigh: 155,
      },
    ],
    zoneLabels: {
      under: 'RVR UNCONTROLLED: VENTRICULAR RATE TOO FAST',
      therapeutic: 'RATE CONTROLLED: HEMODYNAMICALLY STABLE',
      over: 'BRADYCARDIA + HYPOTENSION: AV BLOCKADE EXCESS',
    },
    rationale: 'Diltiazem is a non-dihydropyridine calcium-channel blocker that slows AV nodal conduction, making it a first-line rate-control agent for atrial fibrillation with rapid ventricular response in a hemodynamically stable patient. The same AV-nodal blockade that brings a racing ventricular rate under control becomes dangerous in excess, producing bradycardia and hypotension together rather than a further useful slowing of the rate.',
    examTip: 'NORCET\'s diltiazem caution: avoid it (and other non-dihydropyridine calcium-channel blockers) in atrial fibrillation with a coexisting accessory pathway (WPW) or in decompensated heart failure with reduced ejection fraction, where AV-nodal blockade or negative inotropy can precipitate deterioration. Beta-blockers or amiodarone are used instead in those settings.',
  },

  // ---------------------------------------------------------------------
  // 6. ESMOLOL — short-acting beta-blocker for SVT / hypertensive urgency
  // ---------------------------------------------------------------------
  {
    id: 'esmolol',
    name: 'Esmolol',
    mix: '2500 mg in 250 mL D5W (10,000 mcg/mL)',
    unitKind: 'mcgkgmin',
    unitLabel: 'mcg/kg/min',
    doseMin: 0,
    doseMax: 300,
    doseStep: 5,
    concPerMl: 10000,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [50, 200],
    holdSec: 10,
    goal: 'SVT / perioperative hypertension: bring the heart rate down into a controlled range using a beta-blocker that wears off within minutes if stopped.',
    tracks: [
      {
        key: 'hr',
        label: 'Heart Rate',
        unit: 'bpm',
        base: 158,
        target: 88,
        overSlope: -0.35,   // NEGATIVE: over-titration drives bradycardia/hypotension
        alarmLow: 45,
        alarmHigh: 160,
      },
    ],
    zoneLabels: {
      under: 'SVT / TACHYCARDIA UNCONTROLLED',
      therapeutic: 'RATE CONTROLLED: BETA-BLOCKADE TITRATED',
      over: 'BRADYCARDIA + HYPOTENSION: EXCESS BETA-BLOCKADE',
    },
    rationale: 'Esmolol is a cardioselective, ultra-short-acting beta-blocker with a half-life measured in minutes, which makes it the go-to agent whenever a nurse needs tight, second-to-second control of heart rate, perioperative tachycardia, SVT, or hypertensive urgency in a patient where a long-acting beta-blocker would be too hard to reverse. Titrating past the window still over-blocks the heart just like any beta-blocker, producing bradycardia and hypotension, but because the drug clears so fast, stopping the infusion resolves it quickly.',
    examTip: 'NORCET tests esmolol\'s defining feature, its very short half-life (~9 minutes). As the reason it is favoured for rapid, titratable, and easily reversible rate control, especially in patients where the response to beta-blockade is uncertain (e.g. before committing to a longer-acting agent).',
  },

  // ---------------------------------------------------------------------
  // 7. PROPOFOL — ICU continuous sedation
  // ---------------------------------------------------------------------
  {
    id: 'propofol',
    name: 'Propofol',
    mix: '1000 mg in 100 mL (10,000 mcg/mL, 1% emulsion)',
    unitKind: 'mcgkgmin',
    unitLabel: 'mcg/kg/min',
    doseMin: 0,
    doseMax: 80,
    doseStep: 2,
    concPerMl: 10000,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [10, 50],
    holdSec: 10,
    goal: 'ICU sedation: settle the patient into the target sedation depth without dropping the blood pressure.',
    tracks: [
      {
        key: 'map',
        label: 'MAP',
        unit: 'mmHg',
        base: 88,
        target: 78,
        overSlope: -0.8,   // NEGATIVE: sedative vasodilation drops BP on over-titration
        alarmLow: 55,
        alarmHigh: 100,
      },
      { key: 'sedation', label: 'Sedation Depth', unit: 'score', base: 1, target: 4, overSlope: 0.09, alarmLow: 0, alarmHigh: 6 },
    ],
    zoneLabels: {
      under: 'UNDER-SEDATED: AGITATION / VENTILATOR DYSSYNCHRONY',
      therapeutic: 'TARGET SEDATION: CALM AND HEMODYNAMICALLY STABLE',
      over: 'DEEP OVER-SEDATION: HYPOTENSION RISK',
    },
    rationale: 'Propofol is titrated to a target sedation score (RASS), not to a fixed dose, precisely because the same rate can be too light for one patient and too deep for another. The infusion is walked up in small steps until the goal score is reached, then held. Pushing past the therapeutic band drives sedation too deep and, through peripheral vasodilation and negative inotropy, drops the blood pressure, which is why every propofol infusion is paired with continuous hemodynamic monitoring.',
    examTip: 'NORCET\'s propofol pairing: sedation is titrated against a validated scale (RASS or similar) with daily "sedation vacations" / spontaneous awakening trials to avoid over-sedation, and the exam loves propofol infusion syndrome, a rare but serious complication of prolonged high-dose use, marked by metabolic acidosis, rhabdomyolysis, hyperkalemia, and cardiac failure.',
  },

  // ---------------------------------------------------------------------
  // 8. DEXMEDETOMIDINE — sedation without significant respiratory depression
  // ---------------------------------------------------------------------
  {
    id: 'dexmedetomidine',
    name: 'Dexmedetomidine',
    mix: '200 mcg in 50 mL Normal Saline (4 mcg/mL)',
    unitKind: 'mcgkghr',
    unitLabel: 'mcg/kg/hr',
    doseMin: 0,
    doseMax: 1.5,
    doseStep: 0.05,
    concPerMl: 4,
    weightRange: [40, 120],
    weightDefault: 70,
    safeWindow: [0.2, 0.7],
    holdSec: 10,
    goal: 'Light, cooperative sedation without depressing the drive to breathe, settle the heart rate and MAP without tipping into bradycardia.',
    tracks: [
      {
        key: 'hr',
        label: 'Heart Rate',
        unit: 'bpm',
        base: 92,
        target: 74,
        overSlope: -9,   // NEGATIVE: alpha-2 excess drives bradycardia
        alarmLow: 40,
        alarmHigh: 130,
      },
      { key: 'map', label: 'MAP', unit: 'mmHg', base: 90, target: 80, overSlope: -6, alarmLow: 55, alarmHigh: 105 },
    ],
    zoneLabels: {
      under: 'UNDER-SEDATED: GOAL COMFORT NOT MET',
      therapeutic: 'COOPERATIVE SEDATION: BREATHING UNAFFECTED',
      over: 'BRADYCARDIA + HYPOTENSION: ALPHA-2 EXCESS',
    },
    rationale: 'Dexmedetomidine is a selective alpha-2 agonist prized in the ICU for producing a calm, arousable sedation without meaningfully depressing respiratory drive, unlike propofol or benzodiazepines. A real advantage for patients being weaned off a ventilator. Its trade-off is cardiovascular: alpha-2 stimulation also lowers heart rate and blood pressure, and titrating past the therapeutic band pushes that same mechanism into symptomatic bradycardia and hypotension.',
    examTip: 'NORCET\'s dexmedetomidine differentiator: it allows a patient to be sedated yet easily rousable and cooperative with minimal respiratory depression, making it attractive for ventilator weaning trials, but it commonly causes bradycardia and hypotension, so avoid loading doses in patients with high-grade heart block or hemodynamic instability.',
  },

  // ---------------------------------------------------------------------
  // 9. OXYTOCIN — postpartum hemorrhage / labor augmentation
  // ---------------------------------------------------------------------
  {
    id: 'oxytocin',
    name: 'Oxytocin',
    mix: '10 units in 500 mL Normal Saline (0.02 units/mL)',
    unitKind: 'unitshr',
    unitLabel: 'units/hr',
    doseMin: 0,
    doseMax: 6,
    doseStep: 0.25,
    concPerMl: 0.02,
    weightRange: [45, 100],
    weightDefault: 65,
    safeWindow: [1, 3],
    holdSec: 10,
    goal: 'Postpartum hemorrhage / labor augmentation, bring uterine tone up to a firm, well-contracted state without driving into hyperstimulation.',
    tracks: [
      {
        key: 'tone',
        label: 'Uterine Tone',
        unit: 'score',
        base: 1,
        target: 7,
        overSlope: 1.4,   // POSITIVE: overshoot drives tone into tetanic hyperstimulation
        alarmLow: 2,
        alarmHigh: 9,
      },
    ],
    zoneLabels: {
      under: 'UTERUS BOGGY: ATONY / INADEQUATE CONTRACTION',
      therapeutic: 'FIRM, WELL-CONTRACTED UTERUS',
      over: 'TETANIC HYPERSTIMULATION: FETAL/UTERINE DISTRESS RISK',
    },
    rationale: 'Oxytocin is titrated against a clinical endpoint, a firm, well-contracted uterus with controlled bleeding, or an adequate labor pattern, rather than a fixed dose, because the same drug that corrects atony can, in excess, drive the uterus into sustained tetanic contraction. Hyperstimulation reduces placental blood flow (fetal distress if the patient is still undelivered) and, paradoxically, can exhaust the uterine muscle into worse atony afterward, so the infusion is walked up in small increments and reassessed, never pushed hard for a faster effect.',
    examTip: 'NORCET tests oxytocin as first-line for both active management of the third stage of labor (preventing PPH) and as the first-line uterotonic for atony once PPH has occurred (fundal massage + oxytocin, per the Ward Boss PPH scenario). Always given via a controlled infusion pump, never a rapid IV push, because a bolus can cause hypotension and water intoxication (it is structurally related to ADH).',
  },

  // ---------------------------------------------------------------------
  // 10. AMINOPHYLLINE — severe bronchospasm, narrow therapeutic index
  // ---------------------------------------------------------------------
  {
    id: 'aminophylline',
    name: 'Aminophylline',
    mix: '250 mg in 250 mL D5W (1 mg/mL)',
    unitKind: 'mghr',
    unitLabel: 'mg/hr',
    doseMin: 0,
    doseMax: 60,
    doseStep: 1,
    concPerMl: 1,
    weightRange: [40, 100],
    weightDefault: 65,
    safeWindow: [10, 40],
    holdSec: 10,
    goal: 'Severe bronchospasm unresponsive to first-line therapy, maintain the infusion inside its narrow therapeutic index without tipping into toxicity.',
    tracks: [
      {
        key: 'hr',
        label: 'Heart Rate',
        unit: 'bpm',
        base: 96,
        target: 104,
        overSlope: 2.6,   // POSITIVE: toxicity drives tachyarrhythmia / seizure risk
        alarmLow: 55,
        alarmHigh: 160,
      },
    ],
    zoneLabels: {
      under: 'BRONCHOSPASM PERSISTING: SUBTHERAPEUTIC LEVEL',
      therapeutic: 'THERAPEUTIC LEVEL: AIRWAY RELIEF WITHOUT TOXICITY',
      over: 'TOXICITY: TACHYARRHYTHMIA / SEIZURE RISK',
    },
    rationale: 'Aminophylline sits on one of the narrowest therapeutic indices in the formulary, the gap between a therapeutic serum level and a toxic one is small, so it is reserved for severe bronchospasm that has not responded to beta-agonists and steroids, and it demands serum level monitoring rather than dose alone. Titrating past the safe window does not buy extra bronchodilation; it drives toxicity, which shows up as tachyarrhythmia first and can progress to seizures, exactly the kind of "more is worse, not better" trap this drug is famous for.',
    examTip: 'NORCET\'s aminophylline/theophylline toxicity ladder: nausea and tremor first, then tachyarrhythmia, then seizures at high levels, and the exam loves its drug interactions, since cimetidine, ciprofloxacin, and erythromycin all raise theophylline/aminophylline levels by inhibiting its metabolism, while smoking lowers them by inducing it.',
  },
];

export default TITRATION_DRUGS_B1;
