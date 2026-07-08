// =====================================================================
// src/data/caliper-tasks-b1.js — EXPANSION WAVE "B1" for "Wave Hunter", the
// calibrated ECG caliper measurement lab (NORCET/AIIMS drill). The original
// 10 tasks ship in src/data/caliper-tasks.js; this file adds 10 MORE tasks
// using the exact same schema, tone, and quality bar. All medical content
// is OWNER-REVIEWED (nurse educator) before ship — see the judgment-calls
// note in the task summary for anything that needs a second look.
//
// SCHEMA: identical to src/data/caliper-tasks.js — see that file's header
// comment for the full field-by-field spec, and src/lib/caliper-engine.js
// `validateTask` for the exact validation this file must pass. Recap:
//   { id, ask ('pr'|'qrs'|'rr'|'qt'), title, question,
//     strip: { rrSec, prSec?, qrsSec?, qtSec?, beats?, prSeq? },
//     tolSec, windowSec (>=1.5), beatIndex?,
//     verdict: { normal: [lo, hi], label }, rationale, examTip }
//
// KEY ENGINE CONSTRAINT (read src/lib/caliper-engine.js buildCalibratedStrip
// before adding more tasks here): every strip renders a REGULAR rhythm from
// a single strip.rrSec — all R-R intervals on a strip are equal — EXCEPT
// strip.prSeq, which allows per-beat PR values with `null` marking a dropped
// QRS (used for AV blocks such as Wenckebach/Mobitz II). There is no way to
// author a truly irregularly-irregular R-R (e.g. real atrial fibrillation)
// with this engine; every strip you add must be rhythmically regular.
//
// Task ids in this file are unique across BOTH files (checked against the
// shipped 10: pr-normal, pr-first-degree, qrs-normal, qrs-wide-vt,
// rr-rate-75, rr-brady-45, rr-svt-190, qt-long, pr-wenckebach,
// qrs-hyperkalemia — none reused below).
// =====================================================================

export const CALIPER_TASKS_B1 = [
  // ---------------------------------------------------------------------
  // 1. PR INTERVAL — short PR, pre-excitation (WPW)
  // ---------------------------------------------------------------------
  {
    id: 'pr-short-wpw',
    ask: 'pr',
    title: 'The Head Start',
    question: 'Place the first caliper at the very start of the P wave and the second caliper at the very start of the QRS complex, on the same beat. Measure this unusually short PR interval.',
    strip: { rrSec: 0.8, prSec: 0.10, qrsSec: 0.11 },
    tolSec: 0.02,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.12, 0.20], label: 'Normal PR: 0.12-0.20 s (3-5 small boxes); this strip measures 0.10 s, short' },
    rationale: 'This PR interval is only 0.10 s, 2.5 small boxes, under the normal 3-box floor. An impulse that skips the AV node\'s usual delay arrives at the ventricles early, which is exactly what happens when an accessory pathway (a "shortcut" bundle of muscle bridging atria to ventricles) bypasses the AV node. Count the boxes and multiply by 0.04 s the same way every time: it is the habit, not the diagnosis, that the exam is really testing.',
    examTip: 'NORCET\'s WPW (Wolff-Parkinson-White) triad: short PR (< 0.12 s), a slurred upstroke on the QRS called a delta wave (the QRS here reads slightly wide at 0.11 s because of it), and a widened QRS. WPW matters because the accessory pathway can conduct atrial fibrillation dangerously fast to the ventricles. AV-nodal-blocking drugs like adenosine or verapamil can be harmful in that specific scenario.',
  },

  // ---------------------------------------------------------------------
  // 2. PR INTERVAL — Mobitz II (constant PR, sudden dropped beat)
  // ---------------------------------------------------------------------
  {
    id: 'pr-mobitz2',
    ask: 'pr',
    title: 'The Sudden Drop',
    question: 'Measure the PR interval of a conducted beat on this strip. Place the first caliper at the start of its P wave and the second caliper at the start of its QRS. Notice the PR stays the same size beat to beat, right up until one P wave simply fails to conduct.',
    strip: { prSeq: [0.18, 0.18, null, 0.18], rrSec: 0.8, qrsSec: 0.10 },
    tolSec: 0.04,
    windowSec: 3.4,
    beatIndex: 0,
    verdict: { normal: [0.12, 0.20], label: 'Normal PR: 0.12-0.20 s; every conducted beat here holds a fixed 0.18 s, with no warning before the drop' },
    rationale: 'Walk the PR interval beat by beat: 0.18 s, 0.18 s, then a P wave with no QRS after it at all, then 0.18 s again, no gradual stretching like the "vanishing beat" strip, just a flat, constant PR that occasionally, unpredictably, fails to conduct. That fixed-PR-then-sudden-drop pattern is Mobitz type II second-degree AV block. Because it strikes without the Wenckebach-style warning of a lengthening PR, it is the more dangerous of the two second-degree blocks.',
    examTip: 'NORCET\'s clean way to tell the second-degree blocks apart: Mobitz I (Wenckebach) has a PR that progressively lengthens before a beat drops and is usually AV-nodal and benign; Mobitz II has a CONSTANT PR with an unpredictable dropped beat, is infra-nodal (His-Purkinje) disease, and is far more likely to progress to complete heart block. It is the one that usually needs a pacemaker, not just observation.',
  },

  // ---------------------------------------------------------------------
  // 3. QRS DURATION — wide, bundle branch block (RBBB)
  // ---------------------------------------------------------------------
  {
    id: 'qrs-rbbb',
    ask: 'qrs',
    title: 'The Split-Second Delay',
    question: 'Place the first caliper where the QRS complex first leaves the baseline and the second caliper where it returns to the baseline. Measure the full width of this complex.',
    strip: { rrSec: 0.8, prSec: 0.16, qrsSec: 0.13 },
    tolSec: 0.04,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.06, 0.10], label: 'Normal QRS: 0.06-0.10 s; this strip measures 0.13 s (3+ small boxes), wide' },
    rationale: 'This QRS spans 0.13 s, just over 3 small boxes, clearly past the normal 2.5-box ceiling. The PR interval and rate are both normal here, so the story is not AV-node timing, it is how long ventricular depolarisation itself takes: one bundle branch is blocked, so that side of the heart is activated late, cell-to-cell, instead of down the fast His-Purkinje fibres. That is the electrical signature of a bundle branch block (BBB), not a ventricular ectopic beat.',
    examTip: 'NORCET: QRS >= 0.12 s (3+ small boxes) is "wide" by definition. A wide QRS with a NORMAL PR and P-before-every-QRS pattern, like this strip, points to a bundle branch block; a wide QRS with NO visible P waves and a fast rate points to ventricular tachycardia. Same width threshold, very different bedside urgency. Always read the width alongside the P waves and the rate, never the width alone.',
  },

  // ---------------------------------------------------------------------
  // 4. QRS DURATION — paced rhythm
  // ---------------------------------------------------------------------
  {
    id: 'qrs-paced',
    ask: 'qrs',
    title: 'The Artificial Beat',
    question: 'Place the first caliper at the start of the QRS complex and the second caliper at the end of the QRS complex, on the same paced beat. Measure the QRS duration.',
    strip: { rrSec: 0.85, prSec: 0.16, qrsSec: 0.16 },
    tolSec: 0.04,
    windowSec: 2.6,
    beatIndex: 1,
    verdict: { normal: [0.06, 0.10], label: 'Normal QRS: 0.06-0.10 s; this strip measures 0.16 s (4 small boxes), wide, paced' },
    rationale: 'This QRS measures 0.16 s, 4 small boxes, wide the same way a bundle branch block or a ventricular beat would read. A sharp, narrow pacing spike sits right before the QRS onset on this strip; that spike is a clue this width is EXPECTED, not pathological, because an artificial pacemaker lead stimulates the ventricular muscle directly from one point, so the impulse spreads slowly cell-to-cell just like a native ventricular beat would, producing the same wide, bizarre-looking complex on purpose.',
    examTip: 'NORCET: a paced QRS is wide (often >= 0.12-0.16 s) because ventricular pacing bypasses the normal His-Purkinje conduction system, the same reason a native ventricular ectopic beat is wide. Look for the tiny vertical pacing spike immediately before the QRS to tell "paced and working as intended" apart from a spontaneous wide-complex rhythm, a spike that ISN\'T followed by a QRS (failure to capture) is the actual emergency to flag.',
  },

  // ---------------------------------------------------------------------
  // 5. R-R / RATE — sinus tachycardia
  // ---------------------------------------------------------------------
  {
    id: 'rr-sinus-tach-136',
    ask: 'rr',
    title: 'The Racing Baseline',
    question: 'Place the first caliper on the peak of one R wave and the second caliper on the peak of the very next R wave. Measure the R-to-R interval, then read off the heart rate.',
    strip: { rrSec: 0.44, prSec: 0.14, qrsSec: 0.08 },
    tolSec: 0.04,
    windowSec: 2.2,
    beatIndex: 1,
    verdict: { normal: [0.6, 1.0], label: '60-100 bpm = normal sinus rate; this strip runs about 136 bpm (R-R 0.44 s)' },
    rationale: 'The R-R interval here is 0.44 s, 11 small boxes. By the 1500 rule, 1500 / 11 ≈ 136 bpm, a fast but perfectly ordinary-looking rhythm otherwise: a normal, upright P wave precedes every QRS with a normal PR interval, and the QRS itself is narrow. Fast plus normal-shaped and normal-timed is the key combination that makes this sinus tachycardia rather than something more sinister.',
    examTip: 'NORCET\'s box-counting habit for rate: rate = 1500 / (number of small boxes between two consecutive R waves), cross-checked against 60 / R-R(seconds). Both should agree. Sinus tachycardia has a clear P wave before every QRS at a normal PR; SVT at a similar or faster rate typically has NO discernible P wave because it is buried in the preceding complex. That P-wave visibility is the fastest way to tell the two apart on a real strip.',
  },

  // ---------------------------------------------------------------------
  // 6. R-R / RATE — junctional escape rhythm
  // ---------------------------------------------------------------------
  {
    id: 'rr-junctional-46',
    ask: 'rr',
    title: 'The Backup Pacemaker',
    question: 'Place the first caliper on the peak of one R wave and the second caliper on the peak of the next R wave. Measure the R-to-R interval on this slow, narrow, regular rhythm. Notice there is no upright P wave to march out in front of the QRS.',
    strip: { rrSec: 1.30, qrsSec: 0.08 },
    tolSec: 0.1,
    windowSec: 3.4,
    beatIndex: 1,
    verdict: { normal: [0.6, 1.0], label: '60-100 bpm = normal sinus rate; this strip runs about 46 bpm (R-R 1.30 s)' },
    rationale: 'The R-R interval measures out to about 1.30 s, roughly 32-33 small boxes, which by the 1500 rule (1500 / 32.5 ≈ 46) gives a rate near 46 bpm. As with any slow strip, the box count gets large and fiddly to eyeball precisely, so cross-check with 60/R-R when in doubt. The QRS stays narrow, but there is no normal upright P wave riding in front of it. The SA node has stopped driving the rhythm, and the AV junction has stepped in as a backup pacemaker, firing on its own at its own slower intrinsic rate.',
    examTip: 'NORCET: a junctional escape rhythm is narrow-QRS (the impulse still uses the normal His-Purkinje pathway from the AV junction downward), slow (typically 40-60 bpm, the AV junction\'s own intrinsic rate), and shows an absent, inverted, or retrograde P wave rather than the normal upright sinus P. It is a protective "backup generator" rhythm. The priority is finding and fixing WHY the SA node failed, not suppressing the junctional rhythm itself.',
  },

  // ---------------------------------------------------------------------
  // 7. R-R / RATE — ventricular tachycardia
  // ---------------------------------------------------------------------
  {
    id: 'rr-vt-176',
    ask: 'rr',
    title: 'The Wide, Relentless Sprint',
    question: 'Place the first caliper on the peak of one beat and the second caliper on the peak of the very next beat. Measure the R-to-R interval on this fast, wide, regular rhythm.',
    strip: { rrSec: 0.34, qrsSec: 0.15 },
    tolSec: 0.04,
    windowSec: 2.0,
    beatIndex: 1,
    verdict: { normal: [0.6, 1.0], label: '60-100 bpm = normal sinus rate; this strip runs about 176 bpm (R-R 0.34 s)' },
    rationale: 'The R-to-R interval measures 0.34 s, 8.5 small boxes, giving 1500 / 8.5 ≈ 176 bpm by the box-counting rule. Unlike the SVT strip, where the complexes stayed narrow, every complex here is wide (0.15 s) and the beats march out perfectly regularly with no visible P waves. Wide, fast, and regular with a uniform (monomorphic) shape beat to beat is the classic look of monomorphic ventricular tachycardia (VT).',
    examTip: 'NORCET\'s wide-complex tachycardia rule: treat it as VT until proven otherwise, especially if the patient is unstable. Regular and monomorphic (every complex looks the same, like this strip) still needs urgent management, pulseless or unstable VT goes straight to defibrillation/synchronised cardioversion per ACLS, while stable monomorphic VT may buy time for antiarrhythmics, but the default assumption at the bedside and on the exam stays the same: wide + fast + no clear P waves = VT first.',
  },

  // ---------------------------------------------------------------------
  // 8. QT INTERVAL — short QT (hypercalcemia)
  // ---------------------------------------------------------------------
  {
    id: 'qt-short-hypercalcemia',
    ask: 'qt',
    title: 'The Rushed Recovery',
    question: 'Place the first caliper at the very start of the QRS complex and the second caliper at the point where the T wave finishes and returns to the baseline. That full span is the QT interval.',
    strip: { rrSec: 0.8, prSec: 0.16, qrsSec: 0.08, qtSec: 0.30 },
    tolSec: 0.04,
    windowSec: 2.4,
    beatIndex: 1,
    verdict: { normal: [0.35, 0.44], label: 'Normal QT: roughly 0.35-0.44 s (rate-dependent); this strip measures 0.30 s, short' },
    rationale: 'This QT interval measures only 0.30 s, 7.5 small boxes, under the normal lower boundary. The bedside gut-check (QT should run close to or under half the R-R) still applies: half of this 0.8 s R-R is 0.40 s, and the measured QT of 0.30 s is well under even that, confirming the interval reads as genuinely short rather than borderline. Ventricular repolarisation is finishing unusually fast, which shortens the vulnerable window between beats.',
    examTip: 'NORCET causes of a short QT to know: hypercalcemia (raised extracellular calcium speeds repolarisation) is the classic electrolyte cause worth pairing with this strip, digoxin effect can also shorten the QT (alongside its classic "scooped" ST segment), and there is a rarer congenital short QT syndrome. Just as with long QT, a short QT carries its own arrhythmia risk. Do not assume "shorter is safer."',
  },

  // ---------------------------------------------------------------------
  // 9. QT INTERVAL — normal (reference strip)
  // ---------------------------------------------------------------------
  {
    id: 'qt-normal-ref',
    ask: 'qt',
    title: 'The Textbook Recovery',
    question: 'Place the first caliper at the very start of the QRS complex and the second caliper at the point where the T wave finishes and returns to the baseline. Measure the QT interval on this normal beat.',
    strip: { rrSec: 0.85, prSec: 0.16, qrsSec: 0.09, qtSec: 0.40 },
    tolSec: 0.04,
    windowSec: 2.6,
    beatIndex: 1,
    verdict: { normal: [0.35, 0.44], label: 'Normal QT: roughly 0.35-0.44 s (rate-dependent)' },
    rationale: 'This QT interval measures 0.40 s, 10 small boxes, sitting comfortably inside the normal 0.35-0.44 s window. The quick bedside rule of thumb. QT should be less than half the R-R interval. Holds up cleanly here too: half of the 0.85 s R-R is 0.425 s, just above the measured 0.40 s QT. Use this strip as the reference feel for what a normal, unhurried, uncompressed QT looks like before comparing it against the prolonged and shortened strips elsewhere in the lab.',
    examTip: 'NORCET\'s fast QT sanity check without a nomogram: QT should be roughly less than half the preceding R-R interval at a normal heart rate. It is a rough screen, not a substitute for a proper rate-corrected QTc (Bazett\'s formula: QTc = QT / sqrt(R-R)) when the rate is fast or slow, but it catches most clinically important prolongation or shortening at a glance.',
  },

  // ---------------------------------------------------------------------
  // 10. PR INTERVAL — borderline first-degree block
  // ---------------------------------------------------------------------
  {
    id: 'pr-borderline',
    ask: 'pr',
    title: 'The Fine Line',
    question: 'Place the first caliper at the very start of the P wave and the second caliper at the very start of the QRS complex, on the same beat. Measure this PR interval precisely. It sits right at the edge of normal.',
    strip: { rrSec: 0.9, prSec: 0.22, qrsSec: 0.09 },
    tolSec: 0.02,
    windowSec: 2.7,
    beatIndex: 1,
    verdict: { normal: [0.12, 0.20], label: 'Normal PR: 0.12-0.20 s (3-5 small boxes); this strip measures 0.22 s, just over the line' },
    rationale: 'This PR interval measures 0.22 s, 5.5 small boxes, only slightly past the 5-box (0.20 s) upper limit of normal. That small margin is exactly why the tolerance on this task is tighter than usual: half a small box separates "borderline first-degree block" from "normal," so the habit of counting boxes carefully (rather than eyeballing "looks about right") is what actually matters here. Every P wave still conducts 1:1, just a fraction slower than the cutoff allows, which is enough to call it a mild first-degree AV block.',
    examTip: 'NORCET\'s cutoff is exact: PR > 0.20 s (more than 5 small boxes) is first-degree AV block, full stop, regardless of how close to the line it sits. Borderline measurements like this one are a good reminder to always place your calipers at the true onset of the P wave and the true onset of the QRS, not their peaks. A half-box placement error is the difference between "normal" and "abnormal" on a strip like this.',
  },
];

export default CALIPER_TASKS_B1;
