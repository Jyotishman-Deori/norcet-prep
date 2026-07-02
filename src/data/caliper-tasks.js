// =====================================================================
// src/data/caliper-tasks.js — seed content for "Wave Hunter", a calibrated
// ECG caliper measurement lab (NORCET/AIIMS drill). A calibrated strip
// (25 mm/s paper speed, 1 small box = 0.04 s) renders as SVG; the student
// drags two calipers onto the strip to measure the asked interval, and the
// engine validates the drag distance (converted to seconds) against the
// derived ground truth within a tolerance. All medical content is
// OWNER-REVIEWED (nurse educator) before ship — see the "judgment calls"
// note in the PR/task summary for anything that needs a second look.
//
// SCHEMA (a parallel engine, src/lib/caliper-engine.js `validateTask`, will
// validate this exactly — do not deviate):
//   {
//     id,                          // kebab, unique
//     ask,                         // 'pr' | 'qrs' | 'rr' | 'qt'
//     title,                       // short evocative task name
//     question,                    // student-facing instruction: exactly
//                                  //   WHERE to place the calipers
//     strip: { rrSec, prSec?, qrsSec?, qtSec?, beats?, prSeq? },
//       // rrSec is required (drives beat spacing / heart rate). The ask's
//       // own field must exist: ask 'pr' needs prSec (or prSeq for
//       // Wenckebach — an array of progressively lengthening PR values,
//       // where a `null` entry marks a dropped QRS after that P wave);
//       // ask 'qrs' needs qrsSec; ask 'qt' needs qtSec. `beats` is an
//       // optional explicit beat count (engine can otherwise derive it
//       // from windowSec / rrSec).
//     tolSec,                      // +/- tolerance in seconds the caliper
//                                  //   placement is allowed to be off by
//                                  //   (0.04 = one small box is the default
//                                  //   bar; widened for slower/noisier asks)
//     windowSec,                   // visible strip length in seconds
//                                  //   (2.0-3.0 typical; longer for slow
//                                  //   rhythms so at least 2 full beats show)
//     beatIndex,                   // optional anchor beat the question
//                                  //   refers to (default 1 = the first
//                                  //   complex on the strip)
//     verdict: { normal: [lo, hi], label },
//       // the textbook-normal range for this interval (seconds) plus a
//       // short display line shown on reveal, regardless of whether THIS
//       // strip's true value falls inside that range (some tasks are
//       // deliberately abnormal — that is the teaching point)
//     rationale,                   // teaches the WHY + the box-counting
//                                  //   habit (interval seconds / 0.04 =
//                                  //   small boxes)
//     examTip,                     // NORCET-specific recall hook (1500
//                                  //   rule, normal ranges, drug/electrolyte
//                                  //   causes, etc.)
//   }
//
// Caliper mechanics (for context, owned by the engine, not this file): the
// strip is drawn at the fixed calibration of 25 mm/s, so 1 small box = 0.04 s
// and 5 small boxes (1 large box) = 0.2 s. The student's drag distance in
// pixels is converted back to seconds using that same calibration, then
// compared to the task's derived ground truth (`prSec`/`qrsSec`/`rrSec`/
// `qtSec`, or the relevant `prSeq` entry) within `tolSec`. Getting the
// box-counting habit right (count small boxes, multiply by 0.04) is the
// entire point of the drill, so rationale/examTip text should reinforce it
// every time, not just state the answer.
//
// To add a task: copy the shape above, pick the `ask` that matches the
// clinical teaching point, derive `strip` values that are internally
// consistent (rrSec implies the heart rate; a PR/QRS/QT far outside its
// physiologic range should be a deliberate abnormal-finding task, not a
// slip), keep `tolSec` at 0.04 (one small box) unless the ask is inherently
// noisier to place a caliper on (rate/QT), and make sure `question` states
// the exact anatomical landmarks for the calipers — not just the interval
// name. Task ids are unique across CALIPER_TASKS (enforced by
// caliper-engine.js's validator once it exists).
//
// Split into reviewable content waves: the 10 core tasks below plus b1
// (expansion), merged into the one CALIPER_TASKS export at the bottom.
// =====================================================================
import { CALIPER_TASKS_B1 } from './caliper-tasks-b1.js';

const CORE_CALIPER_TASKS = [
  // ---------------------------------------------------------------------
  // 1. PR INTERVAL — normal
  // ---------------------------------------------------------------------
  {
    id: 'pr-normal',
    ask: 'pr',
    title: 'The Textbook Beat',
    question: 'Place the first caliper where the P wave first leaves the baseline, and the second caliper where the QRS complex first leaves the baseline (the very start of the Q). That gap is the PR interval.',
    strip: { rrSec: 0.8, prSec: 0.16, qrsSec: 0.08 },
    tolSec: 0.04,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.12, 0.20], label: 'Normal PR: 0.12-0.20 s (3-5 small boxes)' },
    rationale: 'The PR interval is the time from the start of atrial depolarisation (P wave) to the start of ventricular depolarisation (QRS) — it represents conduction through the atria, the AV node, and the His-Purkinje system. Count the small boxes between your two calipers and multiply by 0.04 s per box; here that lands at 4 small boxes, 0.16 s, comfortably inside the normal 3-5 box window.',
    examTip: 'NORCET box math: 1 small box = 0.04 s at standard 25 mm/s paper speed. Normal PR interval is 0.12-0.20 s (3-5 small boxes). A PR under 0.12 s suggests pre-excitation (e.g. WPW); a PR over 0.20 s is first-degree AV block.',
  },

  // ---------------------------------------------------------------------
  // 2. PR INTERVAL — first-degree AV block
  // ---------------------------------------------------------------------
  {
    id: 'pr-first-degree',
    ask: 'pr',
    title: 'The Lazy Handoff',
    question: 'Place the first caliper at the very start of the P wave and the second caliper at the very start of the QRS complex, on the same beat. Measure the PR interval.',
    strip: { rrSec: 0.8, prSec: 0.28, qrsSec: 0.08 },
    tolSec: 0.04,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.12, 0.20], label: 'Normal PR: 0.12-0.20 s (3-5 small boxes); this strip measures 0.28 s' },
    rationale: 'This PR interval is fixed and prolonged at 0.28 s (7 small boxes) — every P wave still conducts to a QRS, just slower than normal through the AV node. That combination (long but constant PR, 1:1 conduction, no dropped beats) is the definition of first-degree AV block. It is usually benign and often needs no treatment, but it is worth documenting and watching, especially if AV-nodal-blocking drugs are on board.',
    examTip: 'NORCET distinguishes first-degree block (PR > 0.20 s, fixed, every beat conducts) from Wenckebach/Mobitz I (PR progressively lengthens until a beat is dropped) and Mobitz II (PR is constant but some beats are dropped without warning) — first-degree is the "always conducts, just slow" pattern.',
  },

  // ---------------------------------------------------------------------
  // 3. QRS DURATION — normal (narrow)
  // ---------------------------------------------------------------------
  {
    id: 'qrs-normal',
    ask: 'qrs',
    title: 'The Clean Spike',
    question: 'Place the first caliper where the QRS complex first leaves the baseline (the start of the Q) and the second caliper where it returns to the baseline (the end of the S). That gap is the QRS duration.',
    strip: { rrSec: 0.8, prSec: 0.16, qrsSec: 0.08 },
    tolSec: 0.04,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.06, 0.10], label: 'Normal QRS: 0.06-0.10 s (up to 2.5 small boxes)' },
    rationale: 'The QRS duration reflects how long it takes an impulse to spread through the ventricles. A narrow QRS (here, 2 small boxes, 0.08 s) means the impulse travelled down the normal His-Purkinje pathway rather than spreading slowly cell-to-cell through ventricular muscle. Narrow-complex rhythms point you toward a supraventricular origin (SA node, atria, or AV node) for the beat.',
    examTip: 'NORCET box math: normal QRS is 0.06-0.10 s (up to about 2.5 small boxes). QRS 0.10-0.12 s is borderline/incomplete bundle branch block; QRS > 0.12 s (3+ small boxes) is a wide complex — think bundle branch block, ventricular origin, or a metabolic cause like hyperkalemia.',
  },

  // ---------------------------------------------------------------------
  // 4. QRS DURATION — wide, fast, no P waves (VT)
  // ---------------------------------------------------------------------
  {
    id: 'qrs-wide-vt',
    ask: 'qrs',
    title: 'No P, No Problem? Think Again',
    question: 'Place the first caliper at the start of the QRS complex and the second caliper at the end of the QRS complex, on the same wide beat. Measure the QRS duration.',
    strip: { rrSec: 0.4, qrsSec: 0.16 },
    tolSec: 0.04,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.06, 0.10], label: 'Normal QRS: 0.06-0.10 s; this strip measures 0.16 s (4 small boxes) — wide' },
    rationale: 'This strip has three red flags stacked together: the QRS is wide (0.16 s, 4 small boxes), the rate is fast (R-R of 0.4 s = 150 bpm), and there are no visible P waves. A wide-complex tachycardia with no discernible P waves must be treated as ventricular tachycardia (VT) until proven otherwise — it is never safe to assume "probably just SVT with a bundle branch block" at the bedside without expert confirmation.',
    examTip: 'NORCET\'s wide-complex tachycardia rule: assume VT until proven otherwise, especially with hemodynamic instability. Look for AV dissociation, fusion/capture beats, and a QRS wider than 0.16 s as clues favouring VT over aberrantly-conducted SVT — but the safe default answer on the exam and at the bedside is the same: treat it as VT.',
  },

  // ---------------------------------------------------------------------
  // 5. R-R / RATE — normal sinus rate
  // ---------------------------------------------------------------------
  {
    id: 'rr-rate-75',
    ask: 'rr',
    title: 'Counting the Boxes',
    question: 'Place the first caliper on the peak of one R wave and the second caliper on the peak of the very next R wave. Measure the R-to-R interval, then read off the heart rate.',
    strip: { rrSec: 0.8, prSec: 0.16, qrsSec: 0.08 },
    tolSec: 0.06,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.6, 1.0], label: '60-100 bpm = normal sinus rate (R-R 0.6-1.0 s)' },
    rationale: 'The R-R interval is the gold-standard way to find the heart rate directly off the strip: measure the distance between two consecutive R-wave peaks, convert it to seconds using the 0.04 s-per-small-box calibration, then divide it into 60 to get beats per minute. Here the R-R is 0.8 s (20 small boxes), giving 60/0.8 = 75 bpm — squarely in the normal sinus range.',
    examTip: 'NORCET\'s fastest rate trick: rate = 1500 divided by the number of small boxes between two consecutive R waves. It works because 1500 small boxes pass in exactly one minute at 25 mm/s. Sanity-check it against 60/R-R(seconds) — both should agree.',
  },

  // ---------------------------------------------------------------------
  // 6. R-R / RATE — sinus bradycardia
  // ---------------------------------------------------------------------
  {
    id: 'rr-brady-45',
    ask: 'rr',
    title: 'The Slow Drift',
    question: 'Place the first caliper on the peak of one R wave and the second caliper on the peak of the next R wave. Measure the R-to-R interval across this slower rhythm.',
    strip: { rrSec: 1.33, prSec: 0.18, qrsSec: 0.09 },
    tolSec: 0.1,
    windowSec: 3.5,
    beatIndex: 1,
    verdict: { normal: [0.6, 1.0], label: '60-100 bpm = normal sinus rate; this strip runs about 45 bpm (R-R 1.33 s)' },
    rationale: 'A wider caliper span here is expected and correct — the R-R interval is 1.33 s, about 33 small boxes, which by the 1500 rule (1500 / 33 ≈ 45) gives a rate around 45 bpm. That is sinus bradycardia. On a slow strip like this, the 1500-box method gets fiddly with large box counts; many nurses cross-check it by counting R waves across a longer strip and multiplying, or simply confirm with 60/R-R.',
    examTip: 'NORCET: sinus bradycardia is a rate under 60 bpm with a normal P-QRS-T pattern in the correct order. It can be normal in athletes and during sleep, or pathological (sick sinus syndrome, beta-blocker/digoxin effect, hypothyroidism, raised ICP) — always correlate the number with the patient\'s symptoms, not the monitor alone.',
  },

  // ---------------------------------------------------------------------
  // 7. R-R / RATE — SVT
  // ---------------------------------------------------------------------
  {
    id: 'rr-svt-190',
    ask: 'rr',
    title: 'Too Fast to Find the P',
    question: 'Place the first caliper on the peak of one R wave and the second caliper on the peak of the very next R wave. Measure the R-to-R interval on this rapid, narrow, regular rhythm.',
    strip: { rrSec: 0.32, qrsSec: 0.07 },
    tolSec: 0.04,
    windowSec: 2.0,
    beatIndex: 1,
    verdict: { normal: [0.6, 1.0], label: '60-100 bpm = normal sinus rate; this strip runs about 188 bpm (R-R 0.32 s)' },
    rationale: 'The R-R interval measures out to 0.32 s, just 8 small boxes, which by the 1500 rule (1500 / 8 ≈ 188) gives a rate near 190 bpm. The complexes are narrow and the rhythm is perfectly regular, but there is no visible P wave to march out separately — it is buried in the preceding T wave. Narrow-complex, regular, very fast, with no discernible P wave is the classic signature of supraventricular tachycardia (SVT), most often AV nodal re-entrant tachycardia.',
    examTip: 'NORCET\'s SVT bedside ladder: vagal manoeuvres first (Valsalva, carotid sinus massage), then IV adenosine as a rapid push followed immediately by a saline flush (it has a half-life of seconds) if vagal manoeuvres fail, reserving synchronised cardioversion for hemodynamic instability.',
  },

  // ---------------------------------------------------------------------
  // 8. QT INTERVAL — prolonged
  // ---------------------------------------------------------------------
  {
    id: 'qt-long',
    ask: 'qt',
    title: 'The Stretched Recovery',
    question: 'Place the first caliper at the very start of the QRS complex and the second caliper at the point where the T wave finishes and returns to the baseline. That full span is the QT interval.',
    strip: { rrSec: 0.9, prSec: 0.16, qrsSec: 0.09, qtSec: 0.52 },
    tolSec: 0.05,
    windowSec: 2.7,
    beatIndex: 1,
    verdict: { normal: [0.35, 0.44], label: 'Normal QT: roughly 0.35-0.44 s (rate-dependent); this strip measures 0.52 s — prolonged' },
    rationale: 'The QT interval spans the start of ventricular depolarisation to the end of ventricular repolarisation — essentially, how long the ventricles take to "reset" before they can safely fire again. A fast bedside gut-check is whether the QT looks longer than half the R-R interval: here R-R is 0.9 s, so half of that is 0.45 s, and the measured QT of 0.52 s already exceeds it — a red flag for a prolonged QT even before formal rate-correction (QTc) is calculated.',
    examTip: 'NORCET causes of long QT to know cold: drugs (certain antiarrhythmics, some antipsychotics/antiemetics, some antibiotics), electrolyte derangements (hypokalemia, hypomagnesemia, hypocalcemia), and congenital long QT syndrome. The danger is torsades de pointes, a polymorphic VT that can degenerate into cardiac arrest — IV magnesium sulfate is the go-to emergency treatment.',
  },

  // ---------------------------------------------------------------------
  // 9. PR INTERVAL — Wenckebach (Mobitz I)
  // ---------------------------------------------------------------------
  {
    id: 'pr-wenckebach',
    ask: 'pr',
    title: 'The Vanishing Beat',
    question: 'Measure the LONGEST PR interval on this strip — the beat just before the dropped QRS. Place the first caliper at the start of that P wave and the second caliper at the start of its QRS.',
    strip: { prSeq: [0.20, 0.28, 0.36, null], rrSec: 0.8, qrsSec: 0.08 },
    tolSec: 0.04,
    windowSec: 3.5,
    beatIndex: 3,
    verdict: { normal: [0.12, 0.20], label: 'Normal PR: 0.12-0.20 s; this beat\'s PR has stretched to 0.36 s just before the drop' },
    rationale: 'Walk the PR interval beat by beat across this strip and it grows: 0.20 s, then 0.28 s, then 0.36 s — each beat\'s AV node handoff gets a little slower than the last, until the fourth P wave fails to conduct at all and no QRS follows it. That progressive lengthening followed by a dropped beat is Wenckebach (Mobitz type I) second-degree AV block. The pattern then typically resets and repeats ("group beating").',
    examTip: 'NORCET\'s clean way to tell the second-degree blocks apart: Mobitz I (Wenckebach) has a PR interval that lengthens progressively before a beat drops, and it usually has a good prognosis at the AV-node level. Mobitz II has a constant PR interval with an unpredictable dropped beat, is infra-nodal (His-Purkinje) disease, and is the one more likely to need a pacemaker.',
  },

  // ---------------------------------------------------------------------
  // 10. QRS DURATION — widening, hyperkalemia
  // ---------------------------------------------------------------------
  {
    id: 'qrs-hyperkalemia',
    ask: 'qrs',
    title: 'The Widening Warning',
    question: 'Place the first caliper at the start of the QRS complex and the second caliper at the end of the QRS complex. Measure how wide this complex has become.',
    strip: { rrSec: 1.0, prSec: 0.20, qrsSec: 0.14 },
    tolSec: 0.04,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.06, 0.10], label: 'Normal QRS: 0.06-0.10 s; this strip measures 0.14 s (3.5 small boxes) — widening' },
    rationale: 'A QRS of 0.14 s is well past the normal 0.06-0.10 s window. In a patient with kidney disease, this widening QRS pattern (alongside tall, tented T waves and a lengthening PR interval seen at earlier, milder stages) is the ECG telling you potassium is dangerously high before the labs even come back — the complex widens as rising extracellular potassium slows conduction through the ventricular muscle itself, heading toward a sine-wave pattern and cardiac arrest if untreated.',
    examTip: 'NORCET\'s hyperkalemia ECG ladder in order of severity: peaked/tented T waves, then a flattened P wave and prolonged PR, then a widening QRS, then a sine-wave pattern preceding arrest. The nurse\'s first drug at the bedside is IV calcium gluconate — it stabilises the cardiac membrane immediately but does NOT lower the potassium itself; insulin+dextrose and salbutamol shift potassium into cells, and dialysis is what actually removes it (same ladder as the Ward Boss "Missed Dialysis" case).',
  },
];

// 10 core + 10 expansion = 20 tasks. The run shuffles/slices; order is cosmetic.
export const CALIPER_TASKS = [...CORE_CALIPER_TASKS, ...CALIPER_TASKS_B1];

export default CALIPER_TASKS;
