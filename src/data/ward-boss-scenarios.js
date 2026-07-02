// =====================================================================
// src/data/ward-boss-scenarios.js — seed content for "Ward Boss", a
// 4-phase patient-deterioration simulation game (NORCET clinical judgement
// drill). All medical content is OWNER-REVIEWED (nurse educator) before ship;
// see the "clinical judgment calls" note in the PR/task summary for anything
// that needs a second look.
//
// SCHEMA (the game engine validates this exactly — do not deviate):
//   {
//     id, title, category, difficulty (1-3),
//     patient: { name, age, sex: 'M'|'F', history },
//     intro,                                   // 2-3 sentence, 2nd person
//     vitalsStart: { hr, sbp, dbp, spo2, rr, temp },
//     phases: [                                // EXACTLY 4, ids fixed:
//       { id:'simmer',       label, turns, alarm:'none', brief, ecgId?, vitals, actions:[...] },
//       { id:'complication', label, turns, alarm:'soft', brief, ecgId?, vitals, actions:[...] },
//       { id:'chaos',        label, turns, alarm:'loud', decisionSec, brief, ecgId?, vitals, actions:[...] },
//       { id:'boss',         label, alarm:'boss', strict:true, countdownSec, brief, ecgId?, vitals,
//         sequence:[ {id,label,why}, ... ],     // ORDERED, 2-4 steps
//         decoys:[ {id,label,why}, ... ] },     // 2-3 plausible-but-wrong picks
//     ],
//     debriefWin, debriefLoss, examTip,
//   }
//
// Action object shape (non-boss phases):
//   { id, cat:'assess'|'intervene'|'communicate', kind:'key'|'harm'|'neutral',
//     label, log /*required for kind:'key'*/, why /*required for harm/neutral*/,
//     stability /*optional harm-severity override, 20-25 = truly dangerous*/,
//     effects /*optional { vitals:{...partial nudge} } for dramatic key actions*/ }
//
// Validator rules: every action/sequence/decoy id is unique WITHIN a scenario;
// every non-boss phase has >=1 'key' action AND >=1 'harm' or 'neutral' action;
// 'key' actions require `log`; 'harm'/'neutral'/sequence-steps/decoys require `why`.
//
// ecgId, when present, MUST be one of the ids exported from ecg-rhythms.js
// (nsr, stach, sbrad, afib, aflutter, vtach, vfib, asystole, avb1, stemi,
// ischaemia, hyperk, junctional, wpw, svt, pea, chb, mobitz1, mobitz2, pvc,
// bigeminy, torsades, paced, idioventricular). Omit ecgId when no rhythm fits
// the case — it is optional, never invented.
//
// To add a scenario: copy the shape above, keep phases in the fixed 4-id
// order, keep vitals arcs internally consistent with the pathophysiology,
// and make every 'why' teach (the wrong options are where the learning is).
// =====================================================================

export const WARD_BOSS_SCENARIOS = [
  // ---------------------------------------------------------------------
  // 1. SEPSIS
  // ---------------------------------------------------------------------
  {
    id: 'sepsis',
    title: 'The Quiet Fever',
    category: 'Shock, Tox & Transfusion',
    difficulty: 2,
    patient: { name: 'Ramesh Yadav', age: 67, sex: 'M', history: 'Post-op day 2, hemicolectomy; type 2 diabetes; indwelling urinary catheter' },
    intro: 'Night shift, surgical ward. Ramesh is drowsy but rousable, and the aide mentions he "just doesn\'t look right" tonight. His chart shows a low-grade fever since the afternoon that nobody has chased yet.',
    vitalsStart: { hr: 104, sbp: 112, dbp: 70, spo2: 96, rr: 20, temp: 38.3 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Temp is up, heart rate is climbing, and he is a little more confused than his baseline. This smells like early sepsis from that catheter.',
        vitals: { hr: 110, sbp: 108, dbp: 68, spo2: 95, rr: 22, temp: 38.6 },
        actions: [
          { id: 'sep-s-cultures', cat: 'intervene', kind: 'key', label: 'Draw two sets of blood cultures before any antibiotic', log: 'Cultures drawn from two separate sites and sent to the lab, labelled and timed.' },
          { id: 'sep-s-lactate', cat: 'assess', kind: 'key', label: 'Send a stat serum lactate', log: 'Lab callback: lactate 2.8 mmol/L. Above normal — hypoperfusion is already underway.' },
          { id: 'sep-s-tylenol-first', cat: 'intervene', kind: 'harm', label: 'Give paracetamol for the fever right away', why: 'Treating the fever first feels caring, but if it is given before cultures are drawn, antibiotic-naive organisms in the blood may be masked and the true source harder to identify. Cultures come first, then the antipyretic.' },
          { id: 'sep-s-wait-round', cat: 'communicate', kind: 'neutral', label: 'Note it in the chart for the morning round', why: 'Sepsis is a race against hours, not shifts. The Surviving Sepsis Campaign bundle expects cultures, lactate, and antibiotics within the first hour of recognition — waiting for the morning round can cost the golden hour.' },
          { id: 'sep-s-recheck', cat: 'assess', kind: 'neutral', label: 'Recheck vitals in 30 minutes and reassess', why: 'Reasonable vigilance, but recognised early sepsis with a rising lactate needs the 1-hour bundle started now, not passive rechecking while the picture worsens.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'His pressure is sliding and he is breathing faster. This is moving past "watch and wait" — he needs volume and antibiotics, now.',
        vitals: { hr: 118, sbp: 88, dbp: 52, spo2: 94, rr: 26, temp: 38.9 },
        actions: [
          { id: 'sep-c-antibiotics', cat: 'intervene', kind: 'key', label: 'Give broad-spectrum IV antibiotics stat', log: 'Piperacillin-tazobactam infusing within the hour of recognition, as ordered.', effects: { vitals: { temp: -0.2 } } },
          { id: 'sep-c-bolus', cat: 'intervene', kind: 'key', label: 'Start a 30 mL/kg crystalloid fluid bolus', log: 'Normal saline running wide-open through a large-bore line. BP nudges up as the bolus runs in.', effects: { vitals: { sbp: 6, hr: -4 } } },
          { id: 'sep-c-vasopressor-now', cat: 'intervene', kind: 'harm', label: 'Start a norepinephrine infusion immediately', why: 'Vasopressors are for fluid-refractory shock, not the first move. Jumping to pressors before an adequate fluid challenge can mask ongoing hypovolemia and cause needless peripheral vasoconstriction. Fluids first.', stability: 20 },
          { id: 'sep-c-slow-fluids', cat: 'intervene', kind: 'harm', label: 'Run the fluids slowly to "be cautious" with his heart', why: 'Cardiac caution matters in known heart failure, but in a hemodynamically unstable septic patient a slow trickle will not restore perfusion in time. The bundle calls for a bolus, with reassessment for overload after — not before.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'The bolus barely moved the needle. His skin is mottled, urine output has dropped to nothing, and the monitor is screaming. This is refractory shock.',
        vitals: { hr: 128, sbp: 76, dbp: 44, spo2: 91, rr: 30, temp: 39.2 },
        actions: [
          { id: 'sep-ch-foley', cat: 'assess', kind: 'key', label: 'Insert a Foley catheter to monitor hourly urine output', log: 'Catheter placed. Output so far: 8 mL in the last hour — the kidneys are shutting down under the hypoperfusion.' },
          { id: 'sep-ch-icu', cat: 'communicate', kind: 'key', label: 'Call the ICU team stat for escalation of care', log: 'ICU registrar is on the way. "Sounds like refractory shock — get a central line tray ready."' },
          { id: 'sep-ch-second-bolus-only', cat: 'intervene', kind: 'harm', label: 'Just keep pushing more crystalloid boluses and nothing else', why: 'A patient who stays hypotensive after appropriate initial fluid resuscitation has fluid-refractory shock — the next step is a vasopressor, not endless fluid, which risks pulmonary edema without fixing the pressure.' },
          { id: 'sep-ch-discharge-plan', cat: 'communicate', kind: 'neutral', label: 'Update the discharge paperwork so it is ready', why: 'This patient is actively decompensating into septic shock; discharge planning has no place here. All attention belongs at the bedside and on escalation.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Vasoplegic Shock',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Fluids alone will not hold this pressure up. His vessels have lost their tone. You need central access and a pressor running — in the right order.',
        vitals: { hr: 134, sbp: 68, dbp: 38, spo2: 90, rr: 32, temp: 39.4 },
        sequence: [
          { id: 'boss-sep-central-line', label: 'Assist with central venous line placement', why: 'Norepinephrine is a vesicant-risk vasopressor best delivered through central access to avoid tissue necrosis from peripheral extravasation — get the line in first.' },
          { id: 'boss-sep-norepi', label: 'Start norepinephrine infusion, titrate to MAP >= 65 mmHg', why: 'With fluid-refractory septic shock, norepinephrine is the first-line vasopressor, titrated to a mean arterial pressure target of 65 mmHg or above.' },
        ],
        decoys: [
          { id: 'decoy-sep-dopamine', label: 'Start dopamine instead of norepinephrine', why: 'Dopamine causes more arrhythmias and is no longer first-line for septic shock; norepinephrine has better outcomes and is the guideline-preferred agent.' },
          { id: 'decoy-sep-peripheral-norepi', label: 'Run the norepinephrine through the existing peripheral IV to save time', why: 'Prolonged peripheral vasopressor infusion risks extravasation and tissue necrosis. A short peripheral run under close watch is sometimes bridged, but the safe answer while central access is being placed is not to treat it as the final plan.' },
          { id: 'decoy-sep-steroids-first', label: 'Give hydrocortisone before starting any vasopressor', why: 'Stress-dose steroids are considered for shock refractory to fluids AND vasopressors — they are an adjunct, not a substitute for starting norepinephrine.' },
        ],
      },
    ],
    debriefWin: 'You held the sepsis ladder in order: cultures before antibiotics, an early fluid bolus, and — when shock persisted — central access before norepinephrine, titrated to a MAP goal. That sequencing is exactly what keeps a treatable infection from becoming a fatal shock.',
    debriefLoss: 'Sepsis kills through delay — every hour without antibiotics and adequate fluid raises mortality. Losing him here does not mean you are not ready for a real patient; it means you now know the ladder cold: cultures, antibiotics within the hour, fluids, and pressors only when fluids alone are not enough.',
    examTip: 'NORCET loves the order of the sepsis bundle: cultures BEFORE antibiotics, antibiotics within 1 hour of recognition, a 30 mL/kg crystalloid bolus, and norepinephrine as the first-line vasopressor for fluid-refractory shock, titrated to MAP >= 65 mmHg.',
  },

  // ---------------------------------------------------------------------
  // 2. POSTPARTUM HEMORRHAGE
  // ---------------------------------------------------------------------
  {
    id: 'postpartum-hemorrhage',
    title: 'The Boggy Uterus',
    category: 'OB & Neonatal',
    difficulty: 2,
    patient: { name: 'Priya Sharma', age: 28, sex: 'F', history: 'G2P2, vaginal delivery 40 minutes ago, prolonged second stage of labour' },
    intro: 'Postnatal ward. Priya delivered a healthy baby boy less than an hour ago and looks pale and tired. The pad under her feels heavier than it should, and her fundus does not feel firm under your hand.',
    vitalsStart: { hr: 98, sbp: 110, dbp: 68, spo2: 98, rr: 18, temp: 36.9 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'The fundus is soft and boggy above the umbilicus, and there is a slow, steady trickle of blood. This is uterine atony until proven otherwise.',
        vitals: { hr: 104, sbp: 106, dbp: 66, spo2: 97, rr: 19, temp: 36.9 },
        actions: [
          { id: 'pph-s-massage', cat: 'intervene', kind: 'key', label: 'Perform firm fundal massage', log: 'The fundus firms under your hand and rises to the level of the umbilicus. Bleeding visibly slows.', effects: { vitals: { hr: -4 } } },
          { id: 'pph-s-empty-bladder', cat: 'assess', kind: 'key', label: 'Check for and empty a full bladder', log: 'Bladder was distended and pushing the uterus off-centre. After catheterising 400 mL, the uterus tones up further.' },
          { id: 'pph-s-wait-ob', cat: 'communicate', kind: 'harm', label: 'Just wait for the obstetrician\'s scheduled round', why: 'A boggy uterus with active bleeding needs fundal massage immediately — atony is the single most common cause of postpartum hemorrhage, and every minute of delay lets blood loss accumulate.' },
          { id: 'pph-s-elevate-legs', cat: 'intervene', kind: 'neutral', label: 'Elevate her legs "just in case" before assessing the fundus', why: 'Leg elevation can support venous return later in shock, but it does nothing about an atonic uterus, which is the actual bleeding source here — assess and massage the fundus first.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'The pad is soaked through in 15 minutes. Massage alone is not holding it — she needs a uterotonic and oxygen while you keep working the fundus.',
        vitals: { hr: 116, sbp: 96, dbp: 58, spo2: 96, rr: 22, temp: 36.8 },
        actions: [
          { id: 'pph-c-pitocin', cat: 'intervene', kind: 'key', label: 'Start IV Oxytocin (Pitocin) infusion', log: 'Oxytocin running per protocol. The uterus firms noticeably within a few minutes and bleeding slows.', effects: { vitals: { sbp: 4, hr: -3 } } },
          { id: 'pph-c-o2', cat: 'intervene', kind: 'key', label: 'Apply oxygen and get a second large-bore IV line', log: 'Oxygen on at 10 L/min via face mask. A second 16-gauge IV is secured for rapid access.' },
          { id: 'pph-c-methergine-early', cat: 'intervene', kind: 'harm', label: 'Give Methergine right away instead of oxytocin', why: 'Oxytocin is first-line for atony. Methergine is an important second-line uterotonic, but it is contraindicated in hypertension or pre-eclampsia and is reserved for when oxytocin alone is not enough — check the blood pressure and try oxytocin first.', stability: 20 },
          { id: 'pph-c-single-iv', cat: 'assess', kind: 'neutral', label: 'Rely on the single existing IV line for now', why: 'A postpartum hemorrhage can escalate fast to needing blood products; a second large-bore line secured early saves precious minutes if a transfusion becomes necessary.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Heart rate is racing, pressure is falling, and she is looking anxious and pale. Oxytocin alone is not enough anymore — escalate the drug and the team.',
        vitals: { hr: 138, sbp: 76, dbp: 42, spo2: 94, rr: 26, temp: 36.6 },
        actions: [
          { id: 'pph-ch-methergine', cat: 'intervene', kind: 'key', label: 'Give IM Methergine (after confirming BP is not elevated)', log: 'Blood pressure confirmed non-hypertensive. Methergine given IM; the uterus clamps down further.' },
          { id: 'pph-ch-page-ob', cat: 'communicate', kind: 'key', label: 'Page the obstetrician STAT for bedside assessment', log: 'Obstetrician is en route. "Get type and cross sent and keep massaging that fundus."' },
          { id: 'pph-ch-more-massage-only', cat: 'intervene', kind: 'harm', label: 'Keep doing fundal massage alone and hold off calling anyone', why: 'HR 138 and SBP 76 with ongoing bleeding despite oxytocin is a hemorrhage escalating toward shock — this needs the obstetric team involved now, not massage in isolation.' },
          { id: 'pph-ch-reassure-only', cat: 'communicate', kind: 'neutral', label: 'Focus on reassuring her verbally before acting', why: 'Kindness matters, but at this vital trend, physical intervention and escalation cannot wait on conversation alone — act first, reassure while you work.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Hemorrhagic Shock',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'She is tachycardic, hypotensive, and the bleeding has not stopped. This is massive transfusion territory — get blood moving, in the right order.',
        ecgId: 'stach',
        vitals: { hr: 148, sbp: 68, dbp: 38, spo2: 92, rr: 28, temp: 36.4 },
        sequence: [
          { id: 'boss-pph-typecross', label: 'Send a stat type and crossmatch sample', why: 'Type and crossmatch identifies fully compatible blood — it should be sent the moment hemorrhage is recognised as severe, so matched units are ready as fast as possible.' },
          { id: 'boss-pph-onegative', label: 'While crossmatch is pending, transfuse O-negative blood', why: 'O-negative is the universal donor type used to start transfusion immediately when a patient cannot safely wait for full crossmatch — bridging the gap until matched blood arrives.' },
        ],
        decoys: [
          { id: 'decoy-pph-wait-crossmatch', label: 'Wait for the full crossmatch before giving any blood', why: 'In massive hemorrhage, waiting for a complete crossmatch (which can take 45+ minutes) risks the patient decompensating further. O-negative bridges that gap safely.' },
          { id: 'decoy-pph-plasma-only', label: 'Give only IV crystalloid fluid and skip blood products', why: 'Large-volume crystalloid alone dilutes clotting factors and does not restore oxygen-carrying capacity. Ongoing severe hemorrhage needs blood products, following a massive transfusion protocol.' },
          { id: 'decoy-pph-hysterectomy-first', label: 'Prepare her for an emergency hysterectomy immediately', why: 'Hysterectomy is a last resort after uterotonics, bimanual compression, and transfusion fail to control bleeding — it is not the first escalation step from the bedside.' },
        ],
      },
    ],
    debriefWin: 'You followed the atony ladder correctly: fundal massage and bladder care first, oxytocin as the first-line uterotonic, Methergine when oxytocin was not enough, and — when she moved into hemorrhagic shock — type and cross immediately followed by O-negative blood while matched units were prepared. That sequencing is what keeps postpartum hemorrhage from becoming a maternal death.',
    debriefLoss: 'Postpartum hemorrhage kills through underestimated blood loss and delayed uterotonics — a "boggy" uterus is always an emergency, not a routine finding. Losing her here does not mean you were careless; it means you now know exactly how fast atony can spiral, and the ladder that stops it: massage, oxytocin, Methergine, transfusion.',
    examTip: 'NORCET tests the PPH uterotonic ladder in strict order — oxytocin first-line, Methergine second-line (contraindicated in hypertension), and the massive transfusion sequence: type and cross sent immediately, with O-negative blood used to bridge until matched units are ready.',
  },

  // ---------------------------------------------------------------------
  // 3. ISCHEMIC STROKE
  // ---------------------------------------------------------------------
  {
    id: 'ischemic-stroke',
    title: 'The Golden Hour',
    category: 'Neuro',
    difficulty: 3,
    patient: { name: 'Suresh Iyer', age: 61, sex: 'M', history: 'Hypertension, atrial fibrillation, not on anticoagulation' },
    intro: 'Emergency department. Suresh\'s wife brought him in because "his words came out wrong" over breakfast. He was last seen completely normal 40 minutes ago. Time is the only thing on your side right now.',
    vitalsStart: { hr: 88, sbp: 152, dbp: 94, spo2: 97, rr: 18, temp: 37.0 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'His speech is slurred and his smile droops on the left. This needs a fast, structured stroke assessment right now — every minute is brain tissue.',
        vitals: { hr: 90, sbp: 156, dbp: 96, spo2: 97, rr: 18, temp: 37.0 },
        actions: [
          { id: 'stroke-s-fast', cat: 'assess', kind: 'key', label: 'Perform a rapid FAST assessment (Face, Arms, Speech, Time)', log: 'Left facial droop, left arm drift, slurred speech. Time last known well: 40 minutes ago. FAST positive.' },
          { id: 'stroke-s-glucose', cat: 'assess', kind: 'key', label: 'Check point-of-care blood glucose', log: 'Glucose 104 mg/dL — hypoglycemia ruled out as a stroke mimic.' },
          { id: 'stroke-s-wait-and-see', cat: 'assess', kind: 'harm', label: 'Wait an hour to see if the symptoms resolve on their own', why: 'Every minute of untreated ischemic stroke costs roughly 1.9 million neurons. "Time is brain" — the thrombolysis window is measured in a very few hours, so any delay narrows or closes the treatment door.' },
          { id: 'stroke-s-oral-food', cat: 'intervene', kind: 'neutral', label: 'Offer him a sip of water since he seems thirsty', why: 'A patient with a suspected stroke and possible facial or swallowing involvement should be kept nil by mouth until a formal swallow assessment, to avoid aspiration.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'The left arm weakness is more obvious now. He needs to move to imaging immediately — a non-contrast CT decides everything from here.',
        vitals: { hr: 92, sbp: 160, dbp: 98, spo2: 96, rr: 19, temp: 37.0 },
        actions: [
          { id: 'stroke-c-ct', cat: 'communicate', kind: 'key', label: 'Rush the patient to non-contrast CT head, stat', log: 'CT completed. Radiologist reports: no hemorrhage seen — consistent with acute ischemic stroke.', effects: {} },
          { id: 'stroke-c-nihss', cat: 'assess', kind: 'key', label: 'Complete the NIH Stroke Scale (NIHSS)', log: 'NIHSS scored at 9 — moderate deficit, consistent with a large-vessel territory involved.' },
          { id: 'stroke-c-contrast-ct', cat: 'assess', kind: 'harm', label: 'Order a contrast CT to "get more detail" first', why: 'A non-contrast CT is the correct first study — its only job is to rule OUT hemorrhage before thrombolysis. Adding contrast delays the scan and the treatment decision without changing that immediate question.' },
          { id: 'stroke-c-mri-first', cat: 'assess', kind: 'neutral', label: 'Request an MRI instead, since it shows more detail', why: 'MRI takes far longer to arrange and perform than CT, and in the hyperacute window a non-contrast CT is fast enough to safely clear hemorrhage and start the tPA decision — do not trade speed for detail here.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'His blood pressure has spiked to 220/110 — too high to safely give thrombolysis. You need to bring it down carefully, not crash it.',
        vitals: { hr: 96, sbp: 220, dbp: 110, spo2: 96, rr: 20, temp: 37.1 },
        actions: [
          { id: 'stroke-ch-labetalol', cat: 'intervene', kind: 'key', label: 'Titrate IV Labetalol to bring BP under the tPA threshold', log: 'Labetalol given in small titrated doses. BP eases down to 178/98 — under the 185/110 cutoff for thrombolysis.', effects: { vitals: { sbp: -42, dbp: -12 } } },
          { id: 'stroke-ch-recheck-bp', cat: 'assess', kind: 'key', label: 'Recheck BP every 5-10 minutes during titration', log: 'Serial BP checks confirm a steady, controlled decline — no overshoot into hypotension.' },
          { id: 'stroke-ch-drop-fast', cat: 'intervene', kind: 'harm', label: 'Give a large one-time antihypertensive bolus to drop the pressure fast', why: 'A rapid, uncontrolled BP drop can worsen cerebral perfusion in the ischemic penumbra. The goal is a controlled, titrated reduction to just under the thrombolysis threshold, not a crash.', stability: 22 },
          { id: 'stroke-ch-ignore-bp', cat: 'communicate', kind: 'neutral', label: 'Proceed straight to tPA and address the BP after', why: 'BP above 185/110 systolic/diastolic is an absolute contraindication to thrombolysis due to hemorrhage risk — it must be controlled before, not after, tPA is given.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: The Golden Hour',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Hemorrhage is ruled out, blood pressure is controlled, and the clock is still running. You must calculate the correct weight-based tPA dose and push it inside the window.',
        vitals: { hr: 94, sbp: 176, dbp: 96, spo2: 97, rr: 19, temp: 37.1 },
        sequence: [
          { id: 'boss-stroke-consent-checklist', label: 'Confirm the tPA eligibility checklist and time window with the physician', why: 'Before any dose is drawn up, the contraindication checklist (time window, BP, no active bleeding, no recent surgery) must be verbally confirmed as a final safety check.' },
          { id: 'boss-stroke-calc-dose', label: 'Calculate the weight-based Alteplase dose: 0.9 mg/kg (max 90 mg), 10% as a bolus, the rest infused over 60 minutes', why: 'tPA dosing is strictly weight-based and capped at 90 mg regardless of weight, with a small bolus followed by the majority infused over an hour — getting this math wrong risks a fatal bleed or a subtherapeutic dose.' },
          { id: 'boss-stroke-push-tpa', label: 'Administer the Alteplase bolus, then start the infusion, inside the window', why: 'Once eligibility and dose are confirmed, the treatment must be given without further delay — the benefit of thrombolysis shrinks with every additional minute inside the window.' },
        ],
        decoys: [
          { id: 'decoy-stroke-flat-dose', label: 'Give a standard flat dose of 90 mg regardless of his weight', why: 'tPA is never a flat dose — it is calculated at 0.9 mg/kg with a 90 mg ceiling. A flat dose in a lighter patient risks catastrophic intracranial hemorrhage.' },
          { id: 'decoy-stroke-full-bolus', label: 'Push the entire calculated dose as one bolus', why: 'Only 10% of the total dose is given as a bolus; the remaining 90% must be infused over 60 minutes to reduce bleeding risk while still delivering the full therapeutic dose.' },
          { id: 'decoy-stroke-aspirin-instead', label: 'Give aspirin 325 mg instead of tPA since it is simpler and safer', why: 'Aspirin has a role in ischemic stroke but is NOT a substitute for tPA within the eligible window — aspirin is typically held for 24 hours after thrombolysis to avoid combined bleeding risk.' },
        ],
      },
    ],
    debriefWin: 'You ran the stroke ladder exactly as it is meant to run: FAST assessment first, non-contrast CT to rule out hemorrhage, careful titrated BP control under the tPA threshold, and a correctly calculated weight-based Alteplase dose pushed inside the window. That is the sequence that turns "time is brain" into a save.',
    debriefLoss: 'Ischemic stroke kills brain tissue by the minute — the single biggest cause of a missed window is delay, at any step: recognition, imaging, BP control, or dosing. Losing him here does not mean you failed; it means you now feel, in your bones, why every one of those minutes matters. That is how you never lose the real Golden Hour.',
    examTip: 'NORCET frequently tests: FAST as the rapid stroke screen, non-contrast CT before any thrombolysis decision, the BP cutoff of 185/110 mmHg for eligibility, and the tPA dose formula (0.9 mg/kg, max 90 mg, 10% bolus + 90% infused over 60 minutes).',
  },

  // ---------------------------------------------------------------------
  // 4. ANAPHYLAXIS
  // ---------------------------------------------------------------------
  {
    id: 'anaphylaxis',
    title: 'The New Antibiotic',
    category: 'Shock, Tox & Transfusion',
    difficulty: 2,
    patient: { name: 'Ayesha Khan', age: 24, sex: 'F', history: 'Admitted for a UTI, first dose of IV ceftriaxone just started, no known drug allergies on file' },
    intro: 'Medical ward. Minutes after you start Ayesha\'s first dose of IV antibiotic, she calls out that her skin is "burning" and you notice hives spreading up her arms and neck.',
    vitalsStart: { hr: 108, sbp: 108, dbp: 68, spo2: 96, rr: 20, temp: 37.0 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Hives are spreading and she says her skin feels itchy and hot. This is an allergic reaction to the new antibiotic — stop the trigger first.',
        vitals: { hr: 114, sbp: 104, dbp: 66, spo2: 95, rr: 22, temp: 37.0 },
        actions: [
          { id: 'anaphy-s-stop-infusion', cat: 'intervene', kind: 'key', label: 'Stop the ceftriaxone infusion immediately', log: 'Infusion clamped off and disconnected. The line is kept patent with plain saline for later access.' },
          { id: 'anaphy-s-assess-airway', cat: 'assess', kind: 'key', label: 'Assess airway, breathing, and voice quality', log: 'Voice still clear, no stridor yet, but she reports her throat "feels tight."' },
          { id: 'anaphy-s-slow-infusion', cat: 'intervene', kind: 'harm', label: 'Just slow the infusion rate down instead of stopping it', why: 'Any ongoing exposure to the trigger allergen keeps feeding the reaction. The infusion must be stopped completely, not just slowed, the moment a reaction is suspected.', stability: 20 },
          { id: 'anaphy-s-antihistamine-only', cat: 'intervene', kind: 'neutral', label: 'Give oral antihistamine and monitor for now', why: 'An antihistamine helps hives and itching, but it does nothing for the airway or cardiovascular threat of anaphylaxis, and it is far too slow — this needs continuous reassessment for progression, not a single oral dose and wait.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'She is wheezing now and her oxygen saturation is slipping. The airway is narrowing — support her breathing while you prepare for what may come next.',
        vitals: { hr: 124, sbp: 96, dbp: 58, spo2: 90, rr: 26, temp: 37.0 },
        actions: [
          { id: 'anaphy-c-o2', cat: 'intervene', kind: 'key', label: 'Apply high-flow oxygen', log: 'Oxygen on at 15 L/min via non-rebreather mask. SpO2 climbs slightly to 93%.', effects: { vitals: { spo2: 3 } } },
          { id: 'anaphy-c-albuterol', cat: 'intervene', kind: 'key', label: 'Give nebulised Salbutamol (albuterol) for the wheeze', log: 'Nebuliser running. Audible wheeze eases slightly but breathing is still laboured.' },
          { id: 'anaphy-c-lay-flat', cat: 'intervene', kind: 'harm', label: 'Lay her completely flat to "help her relax"', why: 'A patient with airway compromise and wheezing needs to sit upright to maximise chest expansion and ease breathing — lying flat can worsen the sense of airway obstruction and breathing effort.' },
          { id: 'anaphy-c-oral-steroid', cat: 'intervene', kind: 'neutral', label: 'Give an oral steroid tablet now', why: 'Steroids have a role in preventing a biphasic reaction later, but oral dosing is too slow to matter in an evolving airway emergency, and it is not the priority action right now — oxygen and preparing for definitive treatment come first.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'You hear a harsh, high-pitched stridor. Her throat is closing. This airway may need more than you can manage at the bedside alone.',
        vitals: { hr: 134, sbp: 84, dbp: 50, spo2: 86, rr: 30, temp: 37.0 },
        actions: [
          { id: 'anaphy-ch-page-anesthesia', cat: 'communicate', kind: 'key', label: 'Page anesthesia/airway team STAT for a difficult airway', log: 'Anesthesia paged STAT. "On our way — keep epinephrine ready, do not wait for us to give it."' },
          { id: 'anaphy-ch-prep-crash-cart', cat: 'assess', kind: 'key', label: 'Pull the crash cart to the bedside and prep for a possible surgical airway', log: 'Crash cart at bedside, difficult-airway kit opened and ready.' },
          { id: 'anaphy-ch-wait-anesthesia', cat: 'intervene', kind: 'harm', label: 'Hold all treatment until the anesthesia team physically arrives', why: 'Stridor with falling saturation and pressure is anaphylactic shock in progress — IM epinephrine must be given the moment it is recognised, by the nurse at the bedside, not delayed for another team to arrive.', stability: 25 },
          { id: 'anaphy-ch-reassure-only', cat: 'communicate', kind: 'neutral', label: 'Focus on calming her down verbally first', why: 'Reassurance is important, but a closing airway with stridor and hypoxia is a true emergency — action (epinephrine, calling for help) must happen in parallel with, not instead of, communication.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Anaphylactic Shock',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Stridor, falling pressure, falling saturation. There is exactly one drug, one dose, one route, one site that saves her now.',
        vitals: { hr: 142, sbp: 72, dbp: 42, spo2: 84, rr: 32, temp: 37.0 },
        sequence: [
          { id: 'boss-anaphy-epi-im', label: 'Give IM Adrenaline (Epinephrine) 0.5 mg (0.5 mL of 1:1000) into the vastus lateralis', why: 'IM epinephrine into the anterolateral thigh (vastus lateralis) is the single most important treatment in anaphylaxis, given without delay — it reverses bronchospasm, laryngeal edema, and hypotension all at once. Repeat every 5 minutes if there is no response.' },
          { id: 'boss-anaphy-fluid-bolus', label: 'Run a rapid IV normal saline bolus wide open and elevate her legs', why: 'Anaphylactic shock is massive vasodilation and capillary leak — after epinephrine, the empty circulation needs volume fast. Crystalloid bolus plus leg elevation restores venous return while the adrenaline takes hold.' },
          { id: 'boss-anaphy-adjuncts', label: 'Now give the second-line adjuncts: IV hydrocortisone + chlorphenamine', why: 'Steroids and antihistamines come AFTER epinephrine and fluids — they blunt the late-phase reaction and the itching, but they are too slow to save the airway or the blood pressure. Right drugs, strictly third in line.' },
        ],
        decoys: [
          { id: 'decoy-anaphy-iv-epi', label: 'Give the arrest dose of IV Adrenaline 1 mg instead', why: 'IV adrenaline at the 1:10,000 arrest concentration is reserved for peri-arrest or trained critical-care use with continuous monitoring — giving the IV arrest dose here risks a fatal arrhythmia. The correct route and dose is IM 0.5 mg (1:1000).' },
          { id: 'decoy-anaphy-antihistamine-first', label: 'Give IV antihistamine (chlorphenamine) before epinephrine', why: 'Antihistamines and steroids are second-line adjuncts for anaphylaxis. They act too slowly to reverse airway closure or shock — epinephrine must be given first and immediately.' },
          { id: 'decoy-anaphy-deltoid', label: 'Give the epinephrine into the deltoid muscle instead', why: 'The vastus lateralis (anterolateral thigh) has better blood flow for IM absorption than the deltoid and is the recommended injection site for anaphylaxis epinephrine.' },
        ],
      },
    ],
    debriefWin: 'You followed the anaphylaxis ladder in order: stop the trigger, support oxygenation and the airway, escalate the team early, and — the moment shock and stridor appeared — gave IM epinephrine into the vastus lateralis without waiting for anyone else\'s permission. That instant reflex is exactly what the real emergency demands.',
    debriefLoss: 'Anaphylaxis kills through hesitation — waiting for someone else to arrive, or reaching for the "gentler" drug first, costs the minutes that epinephrine needs to work. Losing her here does not mean you hesitated for no reason; it means the reflex is now burned in: stop the trigger, and IM epinephrine first, always.',
    examTip: 'NORCET tests the anaphylaxis drug and route precisely: IM Adrenaline 0.5 mg of 1:1000 into the vastus lateralis is first-line and immediate; antihistamines and steroids are second-line; IV adrenaline (1:10,000) is only for trained peri-arrest use.',
  },

  // ---------------------------------------------------------------------
  // 5. DKA
  // ---------------------------------------------------------------------
  {
    id: 'dka',
    title: 'The Sweet Smell',
    category: 'Endocrine & Metabolic',
    difficulty: 3,
    patient: { name: 'Arjun Verma', age: 19, sex: 'M', history: 'Newly diagnosed Type 1 diabetes, vomiting for two days, ran out of insulin' },
    intro: 'Emergency department. Arjun is breathing fast and deep, and there is a faint fruity smell on his breath. His mother says he has been vomiting and desperately thirsty since yesterday.',
    vitalsStart: { hr: 118, sbp: 100, dbp: 62, spo2: 97, rr: 26, temp: 37.2 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'He is passing huge volumes of urine and is desperately thirsty. This is classic new-onset diabetic ketoacidosis — confirm it before you treat it.',
        vitals: { hr: 120, sbp: 98, dbp: 60, spo2: 97, rr: 27, temp: 37.2 },
        actions: [
          { id: 'dka-s-glucose', cat: 'assess', kind: 'key', label: 'Check point-of-care blood glucose', log: 'Glucometer reads "HIGH" — off the top of the scale. Lab confirms 486 mg/dL.' },
          { id: 'dka-s-ketones', cat: 'assess', kind: 'key', label: 'Check urine or blood ketones', log: 'Urine dipstick: large ketones. Serum ketones markedly elevated — this confirms DKA, not just hyperglycemia.' },
          { id: 'dka-s-insulin-immediately', cat: 'intervene', kind: 'harm', label: 'Start the insulin infusion right away, before any fluids', why: 'Insulin given before adequate fluid resuscitation and a known potassium level is dangerous — insulin drives potassium into cells and, in a dehydrated, potentially hypokalemic patient, can precipitate a life-threatening arrhythmia. Fluids come first.', stability: 22 },
          { id: 'dka-s-oral-fluids', cat: 'intervene', kind: 'neutral', label: 'Just encourage him to drink oral fluids for now', why: 'He is vomiting and significantly dehydrated from osmotic diuresis — oral intake cannot keep pace with his fluid deficit or be relied upon if he vomits again. He needs IV rehydration.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'His breathing has become deep and labored — Kussmaul respirations, the body trying to blow off acid. He needs aggressive IV fluids now.',
        vitals: { hr: 126, sbp: 92, dbp: 56, spo2: 96, rr: 32, temp: 37.1 },
        actions: [
          { id: 'dka-c-ns-bolus', cat: 'intervene', kind: 'key', label: 'Start a normal saline bolus for rehydration', log: 'Normal saline running wide open. BP responds with a modest rise as circulating volume improves.', effects: { vitals: { sbp: 5, hr: -4 } } },
          { id: 'dka-c-potassium-level', cat: 'assess', kind: 'key', label: 'Send a stat electrolyte panel to check potassium', log: 'Lab callback: potassium 3.3 mEq/L — low, despite the high glucose. Total body potassium is depleted even though it may look falsely normal or high before treatment.' },
          { id: 'dka-c-bicarb', cat: 'intervene', kind: 'harm', label: 'Give IV sodium bicarbonate to correct the acidosis directly', why: 'Bicarbonate is rarely used in DKA and is reserved for extreme, life-threatening acidosis. Fluids and insulin correct the underlying ketoacidosis on their own; routine bicarbonate can worsen cerebral edema risk, especially in young patients.', stability: 20 },
          { id: 'dka-c-half-ns', cat: 'intervene', kind: 'neutral', label: 'Start half-strength (0.45%) saline as the first fluid instead', why: 'Isotonic normal saline (0.9%) is the standard first fluid in DKA to restore intravascular volume quickly; half-normal saline is sometimes used later once sodium correction is assessed, not as the initial bolus.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'His potassium is dropping further as fluids dilute and shift it. If you start insulin now without correcting this, you could stop his heart.',
        vitals: { hr: 128, sbp: 94, dbp: 58, spo2: 96, rr: 30, temp: 37.0 },
        actions: [
          { id: 'dka-ch-replace-k', cat: 'intervene', kind: 'key', label: 'Add potassium replacement to the IV fluids before starting insulin', log: 'Potassium chloride added to the running fluids per protocol. Repeat level is trending toward a safer range.' },
          { id: 'dka-ch-cardiac-monitor', cat: 'assess', kind: 'key', label: 'Place him on continuous cardiac monitoring', log: 'Monitor attached — rhythm is sinus tachycardia for now, no ectopy, but you will see any potassium-related changes immediately.' },
          { id: 'dka-ch-start-insulin-now', cat: 'intervene', kind: 'harm', label: 'Start the insulin infusion now regardless of the potassium level', why: 'This is the classic DKA trap: insulin shifts potassium into cells and will worsen an already low level, risking a fatal arrhythmia. Potassium must be at a safe level (generally above 3.3 mEq/L) before insulin begins.', stability: 25 },
          { id: 'dka-ch-give-usual-supplement', cat: 'intervene', kind: 'neutral', label: 'Just give his usual home oral potassium supplement', why: 'This is a severe, acute deficit needing IV replacement titrated against frequent lab checks — a routine oral home dose is nowhere near enough and far too slow for this situation.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: The Insulin Trap',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Fluids are running, potassium is being replaced and trending safely. Now, and only now, can you start the insulin — in the correct sequence.',
        ecgId: 'sbrad',
        vitals: { hr: 116, sbp: 100, dbp: 62, spo2: 97, rr: 26, temp: 36.9 },
        sequence: [
          { id: 'boss-dka-confirm-k', label: 'Confirm the repeat potassium is above 3.3 mEq/L before proceeding', why: 'This is the safety gate of the entire sequence — insulin must never be started while potassium is below 3.3 mEq/L, because it will drive potassium even lower into a dangerous range.' },
          { id: 'boss-dka-start-insulin', label: 'Start a continuous IV regular insulin infusion at a low weight-based rate', why: 'Only after fluids have begun and potassium is confirmed safe does insulin start — as a steady low-dose infusion (typically around 0.1 unit/kg/hour), not a bolus, to bring down glucose and stop ketone production smoothly.' },
          { id: 'boss-dka-add-dextrose', label: 'Add dextrose to the IV fluids once glucose falls to around 200-250 mg/dL', why: 'Insulin must keep running to clear the ketones even after glucose normalises, so dextrose is added to the fluids to prevent hypoglycemia while the insulin infusion continues its job.' },
        ],
        decoys: [
          { id: 'decoy-dka-insulin-bolus', label: 'Give an IV insulin bolus to bring the glucose down faster', why: 'An insulin bolus is not part of the standard adult DKA protocol — a steady low-dose infusion controls glucose and ketosis more safely and predictably, avoiding a sharp drop that a bolus can cause.' },
          { id: 'decoy-dka-stop-insulin-normal-glucose', label: 'Stop the insulin infusion completely once the glucose looks normal', why: 'Stopping insulin the moment glucose normalises leaves the underlying ketoacidosis untreated — insulin must continue (with dextrose added to prevent hypoglycemia) until the ketosis and acidosis have actually resolved.' },
          { id: 'decoy-dka-skip-k-check', label: 'Skip rechecking potassium and start insulin on the original low reading', why: 'Potassium must be reconfirmed as safe immediately before insulin starts, since levels shift quickly with ongoing fluid resuscitation — never rely on a stale value for this safety-critical step.' },
        ],
      },
    ],
    debriefWin: 'You avoided the classic insulin trap: fluids first, potassium checked and replaced before insulin ever started, and a steady low-dose infusion with dextrose added once glucose came down — never a bolus, never stopped early. That sequencing is exactly what keeps DKA correction from causing the very arrhythmia it is meant to prevent.',
    debriefLoss: 'DKA does not usually kill through the high glucose itself — it kills through the potassium crash that comes when insulin is given too early or too fast. Losing him here does not mean you missed the diagnosis; it means the trap is now visible to you for good: fluids, then potassium, then insulin, never out of order.',
    examTip: 'NORCET tests the DKA management order relentlessly: IV fluids first, insulin only after potassium is confirmed above 3.3 mEq/L, insulin as a continuous low-dose infusion (never a bolus), and dextrose added once glucose falls to 200-250 mg/dL while insulin continues.',
  },

  // ---------------------------------------------------------------------
  // 6. HYPERKALEMIA (worked example from the doc, followed closely)
  // ---------------------------------------------------------------------
  {
    id: 'hyperkalemia',
    title: 'The Missed Dialysis',
    category: 'Renal & Electrolytes',
    difficulty: 2,
    patient: { name: 'Mohan Das', age: 54, sex: 'M', history: 'End-stage renal disease on hemodialysis, missed his last two scheduled sessions' },
    intro: 'Evening shift, renal ward. Mohan missed his last two dialysis sessions and now complains of generalised muscle weakness. He looks tired but is alert and talking to you normally.',
    vitalsStart: { hr: 70, sbp: 126, dbp: 80, spo2: 97, rr: 18, temp: 36.8 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Muscle weakness in a dialysis patient who has missed sessions is a red flag for a dangerous potassium build-up. Check the numbers and the heart\'s electrical picture before anything else.',
        vitals: { hr: 68, sbp: 124, dbp: 80, spo2: 97, rr: 18, temp: 36.8 },
        actions: [
          { id: 'hyperk-s-chem-panel', cat: 'assess', kind: 'key', label: 'Draw a stat chemistry panel', log: 'Lab calls: potassium 7.2 mEq/L. Critically high.' },
          { id: 'hyperk-s-12lead', cat: 'assess', kind: 'key', label: 'Attach a 12-lead ECG', log: 'Tall, tented T-waves march across the strip. Early sign that the heart is already feeling this potassium.' },
          { id: 'hyperk-s-usual-supplement', cat: 'intervene', kind: 'harm', label: 'Give him his usual home potassium supplement since he "missed his dose"', why: 'He is a missed-dialysis patient with weakness — this should raise suspicion for hyperkalemia, not prompt more potassium. Giving a supplement here could push an already dangerous level into cardiac arrest territory.', stability: 22 },
          { id: 'hyperk-s-wait-round', cat: 'communicate', kind: 'neutral', label: 'Wait for the doctor\'s scheduled round to mention the weakness', why: 'Muscle weakness after missed dialysis is a potential emergency, not a routine finding to save for rounds — labs and an ECG need to happen now, not hours from now.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'The lab has confirmed dangerous hyperkalemia and the ECG is already showing changes. Stop anything feeding more potassium in, and get nephrology involved.',
        ecgId: 'hyperk',
        vitals: { hr: 66, sbp: 122, dbp: 78, spo2: 97, rr: 18, temp: 36.8 },
        actions: [
          { id: 'hyperk-c-stop-k-sources', cat: 'intervene', kind: 'key', label: 'Stop all potassium-containing IV fluids and oral potassium sources', log: 'All potassium-containing fluids and diet orders discontinued. No further exogenous potassium is going in.' },
          { id: 'hyperk-c-notify-nephro', cat: 'communicate', kind: 'key', label: 'Notify the nephrology team urgently', why: undefined, log: 'Nephrology notified. "We will arrange urgent dialysis — treat the ECG changes at the bedside now, do not wait for us."' },
          { id: 'hyperk-c-lower-hob', cat: 'intervene', kind: 'harm', label: 'Lower the head of the bed to "help him rest"', why: 'Positioning does nothing for the actual threat here, which is the myocardium destabilising from potassium — this is a distraction from the urgent lab and ECG-driven interventions needed.' },
          { id: 'hyperk-c-recheck-later', cat: 'assess', kind: 'neutral', label: 'Plan to recheck the potassium level in a few hours', why: 'With ECG changes already present at 7.2 mEq/L, this is an active emergency — potassium and rhythm need continuous reassessment now, not a delayed recheck.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'His heart rate is dropping and the QRS is widening on the monitor. This is the danger zone — get emergency equipment to the bedside now.',
        ecgId: 'sbrad',
        vitals: { hr: 45, sbp: 108, dbp: 68, spo2: 95, rr: 20, temp: 36.7 },
        actions: [
          { id: 'hyperk-ch-crash-cart', cat: 'assess', kind: 'key', label: 'Bring the crash cart to the bedside', log: 'Crash cart at the bedside, emergency drugs and equipment ready for immediate use.' },
          { id: 'hyperk-ch-pacing-pads', cat: 'intervene', kind: 'key', label: 'Attach transcutaneous pacing pads as a precaution', log: 'Pacing pads applied and the pacer is on standby, ready to fire if the bradycardia worsens.' },
          { id: 'hyperk-ch-wait-doctor', cat: 'communicate', kind: 'harm', label: 'Wait for the doctor to physically arrive before doing anything further', why: 'A widening QRS with bradycardia in known severe hyperkalemia can progress to cardiac arrest within minutes. Emergency preparation must happen now — this is a nurse-initiated emergency response, not a wait-for-permission moment.', stability: 20 },
          { id: 'hyperk-ch-single-vital-check', cat: 'assess', kind: 'neutral', label: 'Just take a single manual pulse check and move on', why: 'This moment calls for continuous monitoring and full emergency preparedness, not a one-off check — the rhythm is actively deteriorating.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Cardiac Membrane Stabilization',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Tall T-waves, a widening QRS, a dropping heart rate. His heart\'s electrical system is failing under the potassium load. You must stabilise it in the exact right order.',
        ecgId: 'hyperk',
        vitals: { hr: 40, sbp: 96, dbp: 60, spo2: 94, rr: 22, temp: 36.6 },
        sequence: [
          { id: 'boss-hyperk-calcium', label: 'Push IV Calcium gluconate 10 mL of 10%', why: 'Calcium gluconate stabilises the cardiac cell membrane within minutes, directly protecting the heart from the potassium\'s electrical effects — but it does NOT lower the potassium level itself. This buys time and must go first.' },
          { id: 'boss-hyperk-insulin-d50', label: 'Give IV Regular insulin plus D50 (dextrose)', why: 'Insulin drives potassium from the blood back into the cells, and dextrose is given alongside it to prevent hypoglycemia — this is the fastest way to actually lower the serum potassium level.' },
          { id: 'boss-hyperk-salbutamol', label: 'Administer nebulised Salbutamol (albuterol)', why: 'Nebulised salbutamol adds a second, complementary route to shift potassium into the cells, working alongside insulin and dextrose to further drop the serum level while dialysis is arranged.' },
        ],
        decoys: [
          { id: 'decoy-hyperk-insulin-first', label: 'Give insulin and dextrose before the calcium', why: 'Calcium must go first — it protects the myocardium immediately, while insulin+dextrose takes longer to actually shift the potassium. Skipping calcium leaves the heart unprotected during that gap.' },
          { id: 'decoy-hyperk-calcium-lowers-k', label: 'Give calcium gluconate and consider the potassium problem solved', why: 'Calcium gluconate protects the heart membrane but does not lower the potassium level at all — insulin/dextrose and salbutamol (the potassium-shifting agents) and ultimately dialysis (the potassium-removing treatment) are still needed.' },
          { id: 'decoy-hyperk-bicarb-first', label: 'Give IV sodium bicarbonate as the first step instead', why: 'Bicarbonate can help shift potassium in some cases of severe acidosis but is not the first-line stabilising step here — calcium gluconate for membrane protection comes first, per protocol.' },
        ],
      },
    ],
    debriefWin: 'You worked the hyperkalemia ladder exactly as it is taught: labs and ECG to confirm and characterise the threat, stopping potassium sources, escalating to nephrology, and then the cardiac membrane sequence in strict order — calcium gluconate to protect the heart, insulin and dextrose to shift potassium into the cells, and salbutamol to reinforce that shift, all while dialysis was arranged to actually remove the potassium.',
    debriefLoss: 'Hyperkalemia kills silently through the heart\'s electrical system, often with muscle weakness as the only early warning. Losing him here does not mean you missed something obvious; it means you now carry the sequence for life: calcium protects, insulin and dextrose (plus salbutamol) shift, and dialysis removes — protect first, always.',
    examTip: 'NORCET tests this exact sequence and the key teaching point: calcium gluconate stabilises the myocardium but does NOT lower potassium; insulin+dextrose and nebulised salbutamol shift potassium intracellularly; dialysis is the only way to truly remove excess potassium from the body.',
  },
];

export default WARD_BOSS_SCENARIOS;
