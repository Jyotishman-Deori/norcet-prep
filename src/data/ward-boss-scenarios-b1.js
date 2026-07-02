// =====================================================================
// src/data/ward-boss-scenarios-b1.js — wave B1 seed content for "Ward Boss",
// a 4-phase patient-deterioration simulation game (NORCET clinical judgement
// drill). All medical content is OWNER-REVIEWED (nurse educator) before ship;
// see the "clinical judgment calls" note in the PR/task summary for anything
// that needs a second look.
//
// SCHEMA — identical contract to src/data/ward-boss-scenarios.js (see that
// file's header for the full annotated shape). This file only ADDS scenarios;
// it does not alter the engine or the base scenario set.
//
// ecgId, when present, MUST be one of the ids exported from ecg-rhythms.js
// (nsr, stach, sbrad, afib, aflutter, vtach, vfib, asystole, avb1, stemi,
// ischaemia, hyperk, junctional, wpw, svt, pea, chb, mobitz1, mobitz2, pvc,
// bigeminy, torsades, paced, idioventricular). Omit ecgId when no rhythm fits
// the case — it is optional, never invented.
// =====================================================================

export const SCENARIOS_B1 = [
  // ---------------------------------------------------------------------
  // 1. STATUS ASTHMATICUS
  // ---------------------------------------------------------------------
  {
    id: 'status-asthmaticus',
    title: 'The Tight Chest',
    category: 'Respiratory',
    difficulty: 2,
    patient: { name: 'Farhan Sheikh', age: 22, sex: 'M', history: 'Known asthmatic since childhood, ran out of his salbutamol inhaler three days ago, admitted for a viral upper respiratory infection' },
    intro: 'Medical ward, late evening. Farhan sits bolt upright, gripping the bed rail, and you can hear him wheeze from the doorway before you even reach him. He says he "just can\'t get a full breath in."',
    vitalsStart: { hr: 112, sbp: 128, dbp: 80, spo2: 93, rr: 26, temp: 37.4 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Widespread expiratory wheeze on auscultation and mild tachypnea. This is an asthma exacerbation — support his oxygen and get a bronchodilator working while you assess.',
        vitals: { hr: 116, sbp: 130, dbp: 82, spo2: 92, rr: 27, temp: 37.4 },
        actions: [
          { id: 'asth-s-lung-sounds', cat: 'assess', kind: 'key', label: 'Auscultate lung sounds in all fields', log: 'Loud, musical expiratory wheeze heard throughout both lung fields, worse at the bases. Air entry is still present everywhere.' },
          { id: 'asth-s-o2', cat: 'intervene', kind: 'key', label: 'Apply nasal cannula oxygen and recheck SpO2', log: 'Oxygen on at 2 L/min via nasal cannula. SpO2 nudges up to 95%.', effects: { vitals: { spo2: 95 } } },
          { id: 'asth-s-lie-flat', cat: 'intervene', kind: 'harm', label: 'Have him lie flat to "rest" between wheezes', why: 'A wheezing asthmatic breathes easier sitting upright, which lets the diaphragm and accessory muscles work with gravity — lying a distressed asthma patient flat can worsen the sense of breathlessness and chest tightness.' },
          { id: 'asth-s-wait-inhaler-refill', cat: 'communicate', kind: 'neutral', label: 'Wait for pharmacy to send up his usual home inhaler', why: 'An active exacerbation with audible wheeze needs a nebulised bronchodilator started now under nursing/respiratory therapy protocol — waiting on a routine pharmacy refill of his personal inhaler wastes the minutes that matter most.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'You can see him using his neck and shoulder muscles to breathe now, and his oxygen has slipped further. He needs his bronchodilator and a steroid on board.',
        vitals: { hr: 124, sbp: 134, dbp: 84, spo2: 89, rr: 30, temp: 37.5 },
        actions: [
          { id: 'asth-c-albuterol', cat: 'intervene', kind: 'key', label: 'Give nebulised Salbutamol (albuterol), repeat dose', log: 'Nebuliser running continuously. Wheeze is still loud but he reports slightly easier air movement.', effects: { vitals: { spo2: 91, hr: 128 } } },
          { id: 'asth-c-steroid', cat: 'intervene', kind: 'key', label: 'Start IV corticosteroid (Solu-Medrol) per protocol', log: 'IV methylprednisolone given. It will not act for hours, but starting it now is what shortens this attack.' },
          { id: 'asth-c-sedate', cat: 'intervene', kind: 'harm', label: 'Give a sedative to help him "settle down and stop panicking"', why: 'Accessory muscle use and visible distress in asthma is genuine air hunger, not anxiety to be sedated away — sedatives suppress the respiratory drive he desperately needs and can precipitate arrest.', stability: 22 },
          { id: 'asth-c-single-puff', cat: 'intervene', kind: 'neutral', label: 'Give just one puff from his personal metered-dose inhaler and reassess in an hour', why: 'A single puff of a rescue inhaler is nowhere near enough for accessory-muscle-use, dropping-saturation asthma — this needs a full continuous nebulised dose and reassessment on a much shorter interval, not an hour.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'The wheeze is gone. So is most of his air movement. This is the silent chest — the trap that looks like improvement but means he is failing, moving toward CO2 retention and exhaustion.',
        vitals: { hr: 136, sbp: 100, dbp: 62, spo2: 84, rr: 12, temp: 37.5 },
        actions: [
          { id: 'asth-ch-nrb', cat: 'intervene', kind: 'key', label: 'Switch to a non-rebreather mask at high-flow oxygen', log: 'Non-rebreather mask on at 15 L/min. SpO2 climbs only slightly — the real problem is air movement, not just oxygen delivery.', effects: { vitals: { spo2: 86 } } },
          { id: 'asth-ch-rt', cat: 'communicate', kind: 'key', label: 'Call Respiratory Therapy and prep for BiPAP', log: 'Respiratory therapy paged STAT. "Silent chest — get the BiPAP circuit and the crash cart ready, we may need to intubate."' },
          { id: 'asth-ch-mistake-improvement', cat: 'assess', kind: 'harm', label: 'Chart that the wheeze has resolved and he is improving', why: 'This is the classic status asthmaticus trap: a silent chest means air movement has dropped so low that a wheeze can no longer be generated — it is a sign of imminent respiratory failure, not recovery.', stability: 25 },
          { id: 'asth-ch-family-update', cat: 'communicate', kind: 'neutral', label: 'Step out to update the family on the situation first', why: 'With a falling respiratory rate, dropping saturation, and a silent chest, every second belongs at the bedside preparing for possible ventilatory support — the family update can wait for a colleague to relay or for you once he is stabilised.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Respiratory Arrest',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'He has stopped breathing. The silent chest has become no chest at all. You must ventilate, then reverse the bronchospasm, then secure the airway — in order.',
        vitals: { hr: 144, sbp: 88, dbp: 52, spo2: 78, rr: 2, temp: 37.5 },
        sequence: [
          { id: 'boss-asth-bvm', label: 'Begin Bag-Valve-Mask (BVM) ventilation immediately', why: 'The instant breathing stops, manual ventilation with a BVM is the first move to deliver oxygen and buy time — nothing else matters if he is not being ventilated right now.' },
          { id: 'boss-asth-im-epi', label: 'Administer IM Adrenaline (Epinephrine)', why: 'In status asthmaticus progressing to arrest, IM epinephrine is given as a potent bronchodilator and vasopressor when inhaled therapy has failed to reverse severe bronchospasm — it acts fast and buys the airway team time.' },
          { id: 'boss-asth-intubate', label: 'Assist with endotracheal intubation', why: 'Once ventilation is supported and epinephrine has been given, definitive airway control by intubation secures oxygenation and ventilation while the underlying bronchospasm is treated further in ICU.' },
        ],
        decoys: [
          { id: 'decoy-asth-intubate-first', label: 'Call for intubation before starting any ventilation', why: 'A patient who has stopped breathing needs oxygen delivered this second — BVM ventilation starts immediately while the intubation team and equipment are being mobilised, not instead of it.' },
          { id: 'decoy-asth-more-neb-only', label: 'Keep giving nebulised albuterol alone and skip epinephrine', why: 'A patient in respiratory arrest cannot generate the inspiratory effort to move a nebulised drug into the lungs effectively — a systemic route (IM epinephrine) is needed to reverse the bronchospasm at this stage.' },
          { id: 'decoy-asth-wait-abg', label: 'Wait for an arterial blood gas result before ventilating', why: 'Respiratory arrest is a "treat first, confirm after" emergency — waiting for a lab result while he is not breathing costs the minutes that ventilation and epinephrine are meant to save.' },
        ],
      },
    ],
    debriefWin: 'You caught the silent chest for what it truly is — worsening failure, not relief — and ran the arrest sequence in order: BVM ventilation first, IM epinephrine to break the bronchospasm, then assisted intubation to secure the airway. That recognition is what turns a respiratory arrest into a save.',
    debriefLoss: 'Status asthmaticus kills through a trap: a quiet chest is mistaken for improvement while the patient is actually exhausting and retaining CO2. Losing him here does not mean you missed something obvious; it means the silent chest is now burned into memory as a red flag, not a relief.',
    examTip: 'NORCET tests the silent chest as a classic trap question (absence of wheeze in severe asthma = danger, not improvement), and the arrest sequence: BVM ventilation first, IM epinephrine for severe bronchospasm unresponsive to inhaled therapy, then assisted intubation.',
  },

  // ---------------------------------------------------------------------
  // 2. STEMI
  // ---------------------------------------------------------------------
  {
    id: 'stemi',
    title: 'The Bad Indigestion',
    category: 'Cardiac',
    difficulty: 2,
    patient: { name: 'Vijay Kulkarni', age: 58, sex: 'M', history: 'Hypertension, type 2 diabetes, 20-pack-year smoking history, father died of a heart attack at 60' },
    intro: 'Medical ward, mid-morning. Vijay called you over saying he has "some indigestion" and a dull ache along his jaw that started after breakfast. He waves it off as "just gas" and asks for an antacid.',
    vitalsStart: { hr: 92, sbp: 138, dbp: 86, spo2: 97, rr: 18, temp: 36.9 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'A 6/10 "indigestion" with jaw ache in a man with three cardiac risk factors is a heart attack until proven otherwise. Do not reach for the antacid.',
        vitals: { hr: 96, sbp: 140, dbp: 88, spo2: 97, rr: 19, temp: 36.9 },
        actions: [
          { id: 'stemi-s-vitals', cat: 'assess', kind: 'key', label: 'Recheck full vital signs and ask him to rate the pain 0-10', log: 'Pain rated 6/10, dull, radiating to the jaw. Vitals otherwise stable for now, but this history alone is a red flag.' },
          { id: 'stemi-s-aspirin', cat: 'intervene', kind: 'key', label: 'Give chewable Aspirin 324 mg', log: 'Aspirin 324 mg given chewed, not swallowed whole, for faster absorption. He grimaces but takes it.' },
          { id: 'stemi-s-antacid', cat: 'intervene', kind: 'harm', label: 'Give him an antacid for the "indigestion" and reassess later', why: 'Jaw ache and chest discomfort in a high-risk man is a classic atypical presentation of myocardial infarction — treating it as simple indigestion delays the ECG and aspirin that actually matter, and can cost salvageable heart muscle.' },
          { id: 'stemi-s-wait-worse', cat: 'assess', kind: 'neutral', label: 'Tell him to call you again only if the pain gets worse', why: 'Any new chest or jaw discomfort with cardiac risk factors needs an ECG and assessment now, not a "wait and see" plan — early recognition is what saves myocardium in a heart attack.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'The pain has turned crushing and he is drenched in sweat. This is no longer subtle — get the ECG and treat the pain while you wait for it.',
        vitals: { hr: 104, sbp: 132, dbp: 82, spo2: 96, rr: 22, temp: 36.9 },
        actions: [
          { id: 'stemi-c-ecg', cat: 'assess', kind: 'key', label: 'Order a stat 12-lead ECG', log: 'ECG done within minutes. Machine and tech both flag it: significant ST changes across the anterior leads.' },
          { id: 'stemi-c-ntg', cat: 'intervene', kind: 'key', label: 'Give sublingual Nitroglycerin (after confirming BP is adequate)', log: 'BP confirmed adequate at 132/82. Sublingual nitroglycerin given; he reports the crushing pain easing slightly.', effects: { vitals: { sbp: 122, hr: 100 } } },
          { id: 'stemi-c-morphine-first', cat: 'intervene', kind: 'harm', label: 'Push IV morphine before getting the ECG', why: 'The 12-lead ECG must come first — it is the single test that decides whether this becomes a cath lab activation. Reaching for an opioid before that diagnostic delays the clock that "time is muscle" runs on.' },
          { id: 'stemi-c-diaphoresis-ignore', cat: 'assess', kind: 'neutral', label: 'Note the sweating in the chart and continue routine care', why: 'Diaphoresis with crushing chest pain is a hallmark of significant cardiac ischemia, not a detail to log passively — it should sharpen urgency toward the ECG and cath lab pathway, not routine documentation.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        ecgId: 'stemi',
        brief: 'ST elevation confirmed, and now his pressure is falling. This is the trap: nitroglycerin drops preload, and a hypotensive STEMI cannot afford more of it.',
        vitals: { hr: 112, sbp: 92, dbp: 58, spo2: 95, rr: 24, temp: 36.8 },
        actions: [
          { id: 'stemi-ch-cathlab', cat: 'communicate', kind: 'key', label: 'Activate the Cath Lab STAT', log: 'Cath lab activated. "Team is mobilising — get a heparin bolus ready and stop anything dropping his pressure further."' },
          { id: 'stemi-ch-stop-ntg', cat: 'intervene', kind: 'key', label: 'Stop the nitroglycerin because his blood pressure has fallen', log: 'Nitroglycerin infusion/dosing held. This is the trap most people miss — nitrates are contraindicated once hypotension develops.' },
          { id: 'stemi-ch-more-ntg', cat: 'intervene', kind: 'harm', label: 'Give another dose of nitroglycerin since the pain is still there', why: 'Nitroglycerin further drops preload and blood pressure — in a STEMI patient who has become hypotensive, more nitrates can tip him into cardiogenic shock. Pain control at this point should not come from a preload-dropping drug.', stability: 25 },
          { id: 'stemi-ch-heparin-only', cat: 'intervene', kind: 'neutral', label: 'Give the heparin bolus but skip calling the cath lab', why: 'Heparin supports the reperfusion plan, but it is not a substitute for activating the cath lab team — a confirmed STEMI needs the team mobilising toward the cath lab in parallel with pharmacologic therapy, not instead of it.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: V-Tach Arrest',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        ecgId: 'vtach',
        brief: 'The monitor shows Ventricular Tachycardia and he has just lost consciousness. Confirm the arrest, defibrillate, and start compressions — in order.',
        vitals: { hr: 210, sbp: 40, dbp: 20, spo2: 80, rr: 4, temp: 36.8 },
        sequence: [
          { id: 'boss-stemi-pulse-check', label: 'Check for a carotid pulse', why: 'Before shocking, you must confirm this is pulseless V-Tach — a rapid pulse check is the mandatory first step so the response matches what is actually happening to the patient.' },
          { id: 'boss-stemi-defib', label: 'Defibrillate (unsynchronized shock) immediately', why: 'Pulseless V-Tach is a shockable arrest rhythm — immediate unsynchronised defibrillation is the priority intervention, exactly as for ventricular fibrillation.' },
          { id: 'boss-stemi-cpr', label: 'Begin high-quality CPR immediately after the shock', why: 'Compressions resume immediately after the shock is delivered, without pausing to recheck the rhythm first — CPR keeps blood moving to the brain and heart while the rhythm is reassessed at the next cycle.' },
        ],
        decoys: [
          { id: 'decoy-stemi-cpr-first', label: 'Start CPR before checking for a pulse', why: 'A pulse check comes first to confirm this is truly a pulseless, shockable arrest — skipping it risks compressing a patient who still has a perfusing rhythm, or missing the window to shock promptly.' },
          { id: 'decoy-stemi-check-rhythm-after-shock', label: 'Pause after the shock to recheck the rhythm before resuming compressions', why: 'Current resuscitation practice resumes CPR immediately after a shock without a rhythm or pulse check — that check happens at the next scheduled cycle, not right after defibrillation.' },
          { id: 'decoy-stemi-amiodarone-first', label: 'Give IV amiodarone before defibrillating', why: 'Antiarrhythmics like amiodarone are adjuncts given after the first shocks fail in a refractory arrest — the very first move for pulseless V-Tach is defibrillation, not medication.' },
        ],
      },
    ],
    debriefWin: 'You did not let "indigestion" fool you: aspirin and an ECG came first, nitroglycerin was stopped the moment his pressure fell instead of pushing another dose, and when he arrested into V-Tach you confirmed pulselessness, defibrillated, then started CPR without delay. That is the STEMI ladder held under real pressure.',
    debriefLoss: 'STEMI kills through two traps — atypical "indigestion" symptoms delaying the ECG, and nitroglycerin pushed on even after the blood pressure has fallen. Losing him here does not mean you were careless; it means both traps are now visible for good: treat atypical chest pain seriously, and stop nitrates the moment hypotension appears.',
    examTip: 'NORCET tests atypical MI presentation (jaw pain, "indigestion" in high-risk patients), the aspirin-then-ECG order, the nitroglycerin contraindication in hypotension, and the pulseless V-Tach algorithm: confirm pulselessness, defibrillate, then immediate CPR without a rhythm check pause.',
  },

  // ---------------------------------------------------------------------
  // 3. HYPOGLYCEMIC COMA
  // ---------------------------------------------------------------------
  {
    id: 'hypoglycemic-coma',
    title: 'The Shaky Hands',
    category: 'Endocrine & Metabolic',
    difficulty: 1,
    patient: { name: 'Meena Patil', age: 45, sex: 'F', history: 'Type 2 diabetes on insulin, skipped lunch today after her morning insulin dose' },
    intro: 'Medical ward, early afternoon. Meena rings her call bell saying she feels "shaky and sweaty" and asks for something to eat. Her hands are visibly trembling as she talks to you.',
    vitalsStart: { hr: 108, sbp: 116, dbp: 74, spo2: 98, rr: 18, temp: 36.6 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Jittery, sweaty, and hungry after a skipped meal on insulin — classic early hypoglycemia. Confirm the number, then treat it fast while she can still swallow safely.',
        vitals: { hr: 110, sbp: 114, dbp: 72, spo2: 98, rr: 18, temp: 36.6 },
        actions: [
          { id: 'hypo-s-glucose-check', cat: 'assess', kind: 'key', label: 'Check point-of-care blood glucose immediately', log: 'Glucometer reads 55 mg/dL — confirmed hypoglycemia, exactly as the symptoms suggested.' },
          { id: 'hypo-s-oral-juice', cat: 'intervene', kind: 'key', label: 'Give 15-20g of fast-acting oral glucose (juice or glucose tablets)', log: 'She drinks a full glass of juice without difficulty. She is alert and swallowing safely — the oral route is appropriate right now.' },
          { id: 'hypo-s-give-insulin', cat: 'intervene', kind: 'harm', label: 'Give her the next scheduled dose of insulin since it is close to due', why: 'Giving insulin to a patient who is already hypoglycemic will drive the glucose even lower — the scheduled dose must be held and the low sugar corrected first, with the physician notified.', stability: 25 },
          { id: 'hypo-s-recheck-hour', cat: 'assess', kind: 'neutral', label: 'Plan to recheck her glucose in an hour', why: 'After treating hypoglycemia, glucose should be rechecked in about 15 minutes, not an hour — an hour is far too long to confirm the treatment actually worked before she could deteriorate further.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'She is more confused now and pushed the second cup of juice away. Her brain is not getting enough glucose to cooperate with oral treatment anymore — get IV access and recheck the number.',
        vitals: { hr: 118, sbp: 108, dbp: 66, spo2: 97, rr: 20, temp: 36.6 },
        actions: [
          { id: 'hypo-c-iv-access', cat: 'intervene', kind: 'key', label: 'Ensure a patent IV access is in place', log: 'IV cannula confirmed patent and flushed. Ready for IV dextrose if the oral route continues to fail.' },
          { id: 'hypo-c-recheck-glucose', cat: 'assess', kind: 'key', label: 'Recheck point-of-care blood glucose now', log: 'Glucometer reads 40 mg/dL — she is dropping further despite the earlier juice, and she is now too confused to safely take anything by mouth.' },
          { id: 'hypo-c-force-oral', cat: 'intervene', kind: 'harm', label: 'Try to coax her into drinking more juice despite her refusing and being confused', why: 'A confused patient who is refusing oral intake is at real risk of aspiration if fluid is forced or persuaded past a compromised swallow — once she cannot reliably cooperate, the safe route becomes IV, not more coaxed oral juice.', stability: 20 },
          { id: 'hypo-c-wait-physician-order', cat: 'communicate', kind: 'neutral', label: 'Wait for a physician to physically write a new order before touching the IV', why: 'Confirmed worsening hypoglycemia with a compromised ability to safely take oral glucose is a nursing-recognised emergency — securing IV access and preparing for IV dextrose should happen now under the existing hypoglycemia protocol, not pause for a fresh written order.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'She has stopped responding to your voice, and now her arms and legs are jerking — a hypoglycemic seizure. Protect her from injury and get ready to treat the actual cause.',
        vitals: { hr: 128, sbp: 100, dbp: 60, spo2: 93, rr: 24, temp: 36.7 },
        actions: [
          { id: 'hypo-ch-protect-airway', cat: 'intervene', kind: 'key', label: 'Protect the airway and turn her onto her side', log: 'She is repositioned onto her side, away from hard surfaces and IV poles, airway kept clear during the jerking movements.' },
          { id: 'hypo-ch-prep-d50', cat: 'assess', kind: 'key', label: 'Pull IV Dextrose 50% (D50) and prepare it for administration', log: 'D50 ampoule drawn up and ready at the bedside — the seizure will not stop until the glucose deficit driving it is corrected.' },
          { id: 'hypo-ch-restrain', cat: 'intervene', kind: 'harm', label: 'Firmly hold her limbs down to stop the seizure movements', why: 'Restraining a seizing patient\'s limbs does not stop the seizure and risks a fracture or dislocation from the resistance — the correct response is to protect her from injury (clear the space, cushion her head, turn her to the side) while the actual cause is treated.', stability: 20 },
          { id: 'hypo-ch-oral-glucose-again', cat: 'intervene', kind: 'neutral', label: 'Try to place glucose gel in her mouth during the seizure', why: 'Putting anything in the mouth of an actively seizing, unresponsive patient risks airway obstruction or aspiration — this glucose deficit must now be corrected intravenously, not orally.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Severe Hypoglycemia',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'She is unresponsive and seizing from a glucose level that has bottomed out. You need to reverse it now, confirm it worked, and prevent it from happening again.',
        vitals: { hr: 132, sbp: 96, dbp: 58, spo2: 92, rr: 22, temp: 36.7 },
        sequence: [
          { id: 'boss-hypo-d50-push', label: 'Push IV Dextrose 50% (D50)', why: 'IV D50 is the definitive treatment for severe symptomatic hypoglycemia with altered consciousness or seizure — it corrects the glucose deficit directly and rapidly, faster than any oral or subcutaneous option.' },
          { id: 'boss-hypo-recheck-5min', label: 'Reassess blood glucose in 5 minutes', why: 'A rapid recheck after the D50 push confirms the treatment actually worked and tells you whether a repeat dose is needed — never assume correction without re-measuring.' },
          { id: 'boss-hypo-d5w-maintenance', label: 'Hang a D5W maintenance IV fluid', why: 'After the acute low is corrected, a dextrose-containing maintenance fluid prevents a rebound drop in glucose, especially since her long-acting insulin is likely still active in her system.' },
        ],
        decoys: [
          { id: 'decoy-hypo-glucagon-only', label: 'Give IM glucagon instead, since she has IV access already', why: 'IM glucagon is the go-to when there is NO IV access — with a patent IV already in place, IV D50 works faster and more reliably, so it is the preferred route here.' },
          { id: 'decoy-hypo-skip-recheck', label: 'Skip the recheck and assume the D50 fixed it', why: 'Glucose must be reconfirmed after treatment — an unconfirmed assumption risks missing a patient who needs a second D50 dose or closer monitoring.' },
          { id: 'decoy-hypo-normal-saline-maintenance', label: 'Hang plain normal saline as the maintenance fluid instead', why: 'Plain saline carries no glucose and will not protect against a rebound drop — a dextrose-containing fluid (D5W) is what maintains the corrected glucose level going forward.' },
        ],
      },
    ],
    debriefWin: 'You followed the hypoglycemia ladder exactly: confirmed the low with a fingerstick, treated orally while she could still safely swallow, moved to IV access and dextrose the moment she could not, protected her during the seizure without restraining her, and closed the loop with a recheck and a maintenance dextrose fluid. That sequence is what reverses a hypoglycemic emergency cleanly.',
    debriefLoss: 'Hypoglycemia can go from "shaky and hungry" to seizing in minutes once a confused patient can no longer safely take anything by mouth. Losing her here does not mean you missed the diagnosis; it means the escalation ladder — oral, then IV, then D50, then recheck, then maintenance — is now automatic.',
    examTip: 'NORCET tests the hypoglycemia escalation ladder: 15-20g fast oral glucose if the patient can safely swallow, IV D50 (or IM glucagon if no IV access) once consciousness is impaired, a glucose recheck at 15 minutes (5 minutes post-D50 in an acute push), and a dextrose-containing maintenance fluid to prevent rebound.',
  },

  // ---------------------------------------------------------------------
  // 4. AF WITH RVR
  // ---------------------------------------------------------------------
  {
    id: 'af-rvr',
    title: 'The Fluttering Feeling',
    category: 'Cardiac',
    difficulty: 2,
    patient: { name: 'Deepak Rao', age: 63, sex: 'M', history: 'Hypertension, no prior arrhythmia history, admitted for elective hernia repair two days ago' },
    intro: 'Surgical ward. Deepak presses his call bell saying his heart is "fluttering strangely" in his chest. He looks mildly anxious but is talking to you in full sentences.',
    vitalsStart: { hr: 115, sbp: 132, dbp: 84, spo2: 97, rr: 18, temp: 37.0 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'HR 115 and irregular, with a fluttering sensation — new-onset atrial fibrillation until proven otherwise. Get him on continuous monitoring and confirm his pressure is holding.',
        vitals: { hr: 115, sbp: 130, dbp: 82, spo2: 97, rr: 18, temp: 37.0 },
        actions: [
          { id: 'afrvr-s-telemetry', cat: 'assess', kind: 'key', label: 'Apply continuous telemetry monitoring', log: 'Telemetry attached. Rhythm strip shows an irregularly irregular pattern with no clear P-waves — consistent with atrial fibrillation.' },
          { id: 'afrvr-s-bp-check', cat: 'assess', kind: 'key', label: 'Check blood pressure and confirm he is currently stable', log: 'BP 130/82 — stable for now. He is talking normally with no chest pain or breathlessness at this moment.' },
          { id: 'afrvr-s-benzo', cat: 'intervene', kind: 'harm', label: 'Give a sedative to calm his anxiety about the fluttering', why: 'The fluttering sensation is the arrhythmia itself, not primary anxiety — sedating him does nothing for the underlying rhythm problem and can mask early warning signs of instability. The rhythm needs monitoring and treatment, not sedation.' },
          { id: 'afrvr-s-ignore-irregular', cat: 'communicate', kind: 'neutral', label: 'Reassure him it is probably nothing and check again at the next routine round', why: 'A new irregular rhythm with a rate of 115 needs continuous monitoring and physician notification now — treating it as routine risks missing rapid progression to a faster, less stable rate.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'His heart rate has spiked to 160 and he says he feels dizzy. Rate control medication and cardiac enzymes both need to happen now.',
        vitals: { hr: 160, sbp: 118, dbp: 76, spo2: 96, rr: 22, temp: 37.0 },
        actions: [
          { id: 'afrvr-c-enzymes', cat: 'assess', kind: 'key', label: 'Draw cardiac enzymes (troponin)', log: 'Troponin sent. This rate alone can strain the heart enough to cause a secondary rise, so a baseline is important before any ischemic changes are assumed.' },
          { id: 'afrvr-c-rate-control', cat: 'intervene', kind: 'key', label: 'Administer IV Diltiazem (or Metoprolol) for rate control', log: 'IV Diltiazem given per order. Rate begins to trend down over the next several minutes.', effects: { vitals: { hr: 138 } } },
          { id: 'afrvr-c-fluid-bolus', cat: 'intervene', kind: 'harm', label: 'Give a large IV fluid bolus to "help with the dizziness"', why: 'Dizziness here is coming from an inefficient, rapid heart rhythm reducing cardiac output, not from volume depletion — a fluid bolus does not address the rate problem and can worsen things if he later needs cardioversion or has any cardiac strain.' },
          { id: 'afrvr-c-skip-enzymes', cat: 'assess', kind: 'neutral', label: 'Skip the cardiac enzymes since he has no chest pain', why: 'A sustained rapid ventricular rate can cause demand-related cardiac strain even without classic chest pain — baseline enzymes are still worth sending as part of a full rapid-rate workup.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        ecgId: 'afib',
        brief: 'The rate control medication has not worked. His pressure has crashed and he is now confused — this has become unstable tachycardia and cardioversion is coming.',
        vitals: { hr: 168, sbp: 70, dbp: 40, spo2: 92, rr: 26, temp: 37.0 },
        actions: [
          { id: 'afrvr-ch-defib-pads', cat: 'intervene', kind: 'key', label: 'Apply defibrillator/cardioversion pads', log: 'Pads applied to the chest and connected to the defibrillator, ready for synchronized cardioversion.' },
          { id: 'afrvr-ch-call-sedation', cat: 'communicate', kind: 'key', label: 'Call for procedural sedation before cardioversion', log: 'Physician and anesthesia support notified. "We will sedate him briefly, then cardiovert — get everything staged."' },
          { id: 'afrvr-ch-more-diltiazem', cat: 'intervene', kind: 'harm', label: 'Push another dose of IV Diltiazem since the first one did not fully work', why: 'A patient who has become hypotensive and altered on top of a rapid rate is unstable — repeating a rate-control drug that can further drop the blood pressure is dangerous. Unstable tachycardia is treated with cardioversion, not another medication dose.', stability: 20 },
          { id: 'afrvr-ch-wait-cardiology', cat: 'communicate', kind: 'neutral', label: 'Wait for the cardiology consult note before doing anything further', why: 'Unstable tachycardia with hypotension and altered mental status is a bedside emergency requiring the rapid response/code team now — waiting on a written consult note delays the pads and sedation that need to happen in the next few minutes.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Unstable Tachycardia',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        ecgId: 'afib',
        brief: 'He is hypotensive and altered with a rate that will not slow with medication alone. You need to sedate him, then deliver a SYNCHRONIZED shock — never an unsynchronized one.',
        vitals: { hr: 172, sbp: 66, dbp: 38, spo2: 90, rr: 28, temp: 37.0 },
        sequence: [
          { id: 'boss-afrvr-sedation', label: 'Administer IV sedation before the shock', why: 'Cardioversion is painful and distressing while conscious — brief procedural sedation is given first whenever the patient\'s condition allows the seconds it takes, before the shock is delivered.' },
          { id: 'boss-afrvr-sync-button', label: 'Press the "SYNC" button on the defibrillator', why: 'Pressing SYNC arms the machine to time the shock to the QRS complex, avoiding the vulnerable T-wave — this is the step that makes the next shock a safe, synchronized cardioversion instead of a dangerous unsynchronized one.' },
          { id: 'boss-afrvr-cardiovert', label: 'Deliver the synchronized cardioversion shock', why: 'With sync engaged and sedation on board, delivering the shock now is the definitive treatment for unstable tachycardia — it aims to convert the rhythm back to normal sinus rhythm.' },
        ],
        decoys: [
          { id: 'decoy-afrvr-unsynced-shock', label: 'Deliver an unsynchronized shock (defibrillation) instead', why: 'This is the classic decoy: an unsynchronized shock can land on the T-wave and induce ventricular fibrillation in a patient who still has a pulse and organized rhythm. Unstable AF with RVR needs SYNCHRONIZED cardioversion, not defibrillation.' },
          { id: 'decoy-afrvr-shock-before-sync', label: 'Shock immediately without pressing SYNC first, to save time', why: 'Skipping the SYNC step turns this into an unsynchronized shock by default — the machine must be armed in sync mode before the shock is delivered, even under time pressure.' },
          { id: 'decoy-afrvr-anticoagulate-first', label: 'Start IV anticoagulation before attempting cardioversion', why: 'Anticoagulation is a longer-term stroke-prevention consideration for atrial fibrillation, not an emergency priority when the patient is unstable right now — hemodynamic instability is treated with immediate synchronized cardioversion first.' },
        ],
      },
    ],
    debriefWin: 'You worked the unstable tachycardia ladder correctly: telemetry and vitals to confirm new-onset AF, rate control and enzymes while he was stable, escalating to pads and sedation the moment he became hypotensive and altered, and — critically — pressing SYNC before delivering the shock. Avoiding the unsynchronized-shock trap is exactly what keeps a cardioversion safe.',
    debriefLoss: 'AF with RVR turns dangerous when the rate will not slow and the patient becomes hemodynamically unstable — and the single most dangerous mistake at that point is shocking without syncing. Losing him here does not mean you were careless; it means the SYNC button is now unforgettable.',
    examTip: 'NORCET tests unstable tachycardia management precisely: rate control (diltiazem/metoprolol) for a stable patient, escalation to synchronized cardioversion (never unsynchronized/defibrillation) the moment hypotension or altered mental status appears, and sedation before the shock when time allows.',
  },

  // ---------------------------------------------------------------------
  // 5. TENSION PNEUMOTHORAX
  // ---------------------------------------------------------------------
  {
    id: 'tension-pneumothorax',
    title: 'The Silent Side',
    category: 'Respiratory',
    difficulty: 3,
    patient: { name: 'Rohit Bansal', age: 34, sex: 'M', history: 'Brought in after a motor vehicle accident, seatbelt bruising across the right chest, no prior medical history' },
    intro: 'Emergency department, trauma bay. Rohit was brought in after a motor vehicle accident. He is clutching his right side, breathing in short, shallow breaths, and wincing with every movement.',
    vitalsStart: { hr: 108, sbp: 122, dbp: 78, spo2: 94, rr: 24, temp: 37.0 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Right-sided chest pain and shallow breathing after blunt trauma — this needs oxygen and a careful listen to both sides of his chest right now.',
        vitals: { hr: 110, sbp: 120, dbp: 76, spo2: 93, rr: 25, temp: 37.0 },
        actions: [
          { id: 'tension-s-o2', cat: 'intervene', kind: 'key', label: 'Apply supplemental oxygen', log: 'Oxygen on at 6 L/min via face mask. SpO2 comes up slightly to 95%.', effects: { vitals: { spo2: 95 } } },
          { id: 'tension-s-lung-sounds', cat: 'assess', kind: 'key', label: 'Assess bilateral lung sounds', log: 'Breath sounds are noticeably decreased on the right side compared to the left. Chest wall movement on that side looks reduced too.' },
          { id: 'tension-s-analgesia-only', cat: 'intervene', kind: 'harm', label: 'Focus on giving strong pain medication before assessing his breathing further', why: 'Post-trauma chest pain with shallow breathing and decreased breath sounds could be an evolving pneumothorax — the respiratory assessment and oxygen come first; pain control matters but must not delay recognizing an airway/breathing threat.' },
          { id: 'tension-s-skip-both-sides', cat: 'assess', kind: 'neutral', label: 'Listen only to the painful side and assume it is a simple rib bruise', why: 'Comparing BOTH sides is essential in chest trauma — a unilateral finding like decreased breath sounds on only one side is a key early clue toward pneumothorax that gets missed if you never listen to the other side for comparison.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'His oxygen has dropped further and his heart rate is climbing. Escalate his oxygen support and get imaging moving — but do not let imaging become the bottleneck.',
        vitals: { hr: 128, sbp: 114, dbp: 72, spo2: 88, rr: 28, temp: 37.0 },
        actions: [
          { id: 'tension-c-cxr', cat: 'communicate', kind: 'key', label: 'Request a stat portable chest X-ray', log: 'Portable chest X-ray ordered STAT. Radiology is on the way to the bedside — results are still pending.' },
          { id: 'tension-c-high-flow', cat: 'intervene', kind: 'key', label: 'Increase him to high-flow oxygen', log: 'Switched to a non-rebreather mask at 15 L/min. SpO2 improves only modestly — oxygen alone cannot fix a mechanical problem.', effects: { vitals: { spo2: 90 } } },
          { id: 'tension-c-lay-supine-flat', cat: 'intervene', kind: 'harm', label: 'Lay him completely flat to keep him still for the X-ray', why: 'A trauma patient with worsening oxygenation and shallow breathing should stay positioned to maximise chest expansion where possible (per trauma/C-spine protocol) — forcing full flat positioning purely for imaging convenience can worsen his breathing effort.' },
          { id: 'tension-c-wait-for-films', cat: 'assess', kind: 'neutral', label: 'Wait for the chest X-ray result before reassessing him again', why: 'A deteriorating trauma patient needs continuous reassessment on your own clinical exam — waiting passively for imaging to return risks missing rapid decompensation that a repeat physical exam would catch sooner.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Tracheal deviation to the left, distended neck veins, and now absent breath sounds on the right. This is textbook tension pneumothorax — the heart itself is being crushed. Escalate now.',
        vitals: { hr: 144, sbp: 84, dbp: 50, spo2: 82, rr: 32, temp: 37.0 },
        actions: [
          { id: 'tension-ch-page-surgeon', cat: 'communicate', kind: 'key', label: 'Page the trauma surgeon STAT', log: 'Trauma surgeon paged STAT. "Sounds like tension pneumo — do not wait on me, get the needle decompression kit ready now."' },
          { id: 'tension-ch-prep-chest-tube', cat: 'assess', kind: 'key', label: 'Prepare the chest tube insertion kit and needle decompression equipment', log: 'Chest tube tray opened and a large-bore needle/catheter set is at the bedside, ready for immediate use.' },
          { id: 'tension-ch-wait-xray', cat: 'intervene', kind: 'harm', label: 'Wait for the chest X-ray to officially confirm the diagnosis before doing anything', why: 'This is the classic decoy in tension pneumothorax: it is a CLINICAL diagnosis (tracheal deviation, absent breath sounds, JVD, hypotension) treated immediately at the bedside — waiting for radiology confirmation while the mediastinum shifts further can be fatal within minutes.', stability: 25 },
          { id: 'tension-ch-reposition-only', cat: 'intervene', kind: 'neutral', label: 'Just reposition him for comfort and reassess in a few minutes', why: 'These signs (tracheal deviation, JVD, absent breath sounds, falling pressure) describe a rapidly progressing obstructive emergency — repositioning for comfort does nothing for the underlying pressure building in his chest and wastes critical time.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Obstructive Shock',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'His blood pressure is barely palpable — his heart is being crushed by trapped air under pressure. You must decompress the chest now, then secure it, in the right order.',
        vitals: { hr: 152, sbp: 60, dbp: 30, spo2: 78, rr: 34, temp: 37.0 },
        sequence: [
          { id: 'boss-tension-hand-needle', label: 'Hand the provider a 14-gauge needle', why: 'The provider needs the correct large-bore (14-gauge) needle immediately to hand to perform emergency decompression — having it ready and handed over without delay is the first concrete step in the room.' },
          { id: 'boss-tension-decompress', label: 'Assist needle decompression at the 2nd intercostal space, midclavicular line', why: 'Needle decompression at the 2nd intercostal space, midclavicular line, releases the trapped air under pressure immediately — this is the emergency, temporary, life-saving step that relieves the crushing pressure on the heart and great vessels before a formal chest tube can be placed.' },
          { id: 'boss-tension-chest-tube', label: 'Assist with formal chest tube insertion', why: 'Needle decompression is only a temporary bridge — a formal chest tube must follow promptly to definitively drain the pleural space and prevent the tension from reaccumulating.' },
        ],
        decoys: [
          { id: 'decoy-tension-wait-cxr-confirm', label: 'Wait for chest X-ray confirmation before decompressing', why: 'This is the single most dangerous decoy in this case: tension pneumothorax is a clinical diagnosis treated immediately at the bedside. Waiting for imaging confirmation while obstructive shock progresses can be fatal.' },
          { id: 'decoy-tension-chest-tube-first', label: 'Go straight to formal chest tube insertion, skipping needle decompression', why: 'A formal chest tube takes longer to set up and place sterilely — needle decompression is the fast, emergency first step to relieve life-threatening pressure immediately, with the chest tube following as the definitive fix.' },
          { id: 'decoy-tension-wrong-site', label: 'Decompress at the 5th intercostal space, anterior axillary line instead', why: 'That anatomic site is used for a different procedure (finger thoracostomy/chest tube placement) — classic emergency needle decompression is performed at the 2nd intercostal space, midclavicular line.' },
        ],
      },
    ],
    debriefWin: 'You trusted the clinical exam over waiting for imaging: recognised decreased breath sounds early, escalated oxygen and surgical notification as he worsened, and when the classic triad appeared you did not wait for an X-ray — you decompressed at the 2nd intercostal space, midclavicular line, then followed with a formal chest tube. That refusal to wait for confirmation is exactly what saves a tension pneumothorax patient.',
    debriefLoss: 'Tension pneumothorax kills fast because it is a clinical diagnosis that some hesitate to act on without imaging — and by the time the film comes back, the mediastinum may have already shifted too far. Losing him here does not mean you missed the signs; it means "treat the exam, not the X-ray" is now instinct.',
    examTip: 'NORCET tests tension pneumothorax as a bedside clinical diagnosis (tracheal deviation, absent unilateral breath sounds, JVD, hypotension) requiring IMMEDIATE needle decompression at the 2nd intercostal space, midclavicular line — never delayed for chest X-ray confirmation — followed by definitive chest tube placement.',
  },

  // ---------------------------------------------------------------------
  // 6. FLASH PULMONARY EDEMA
  // ---------------------------------------------------------------------
  {
    id: 'flash-pulmonary-edema',
    title: 'The Dry Cough',
    category: 'Cardiac',
    difficulty: 3,
    patient: { name: 'Sunita Agarwal', age: 71, sex: 'F', history: 'Chronic heart failure with reduced ejection fraction, admitted for medication non-adherence, missed her last two doses of furosemide at home' },
    intro: 'Cardiology ward, night shift. Sunita has had a dry, nagging cough for the past hour and says she "just can\'t get comfortable" lying down. You notice she has propped herself up on three pillows without being asked.',
    vitalsStart: { hr: 102, sbp: 152, dbp: 92, spo2: 94, rr: 22, temp: 36.8 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'A dry cough and needing to sit upright in a heart failure patient who missed her diuretic doses is an early warning sign of fluid backing up into the lungs. Listen closely and hold the fluids.',
        vitals: { hr: 104, sbp: 156, dbp: 94, spo2: 93, rr: 23, temp: 36.8 },
        actions: [
          { id: 'flash-s-auscultate', cat: 'assess', kind: 'key', label: 'Auscultate lung sounds at the bases', log: 'Fine crackles heard at both lung bases — an early sign of fluid accumulating in the alveoli, consistent with worsening heart failure.' },
          { id: 'flash-s-restrict-fluids', cat: 'intervene', kind: 'key', label: 'Restrict oral fluid intake per her heart failure orders', log: 'Fluid restriction reinforced and explained to her. Intake and output chart started to track her balance closely tonight.' },
          { id: 'flash-s-encourage-fluids', cat: 'intervene', kind: 'harm', label: 'Encourage her to drink more water since she seems a little dry-mouthed', why: 'In decompensating heart failure the problem is fluid overload backing up into the lungs, not dehydration — encouraging more oral fluids directly worsens the process already beginning here.', stability: 20 },
          { id: 'flash-s-ignore-cough', cat: 'assess', kind: 'neutral', label: 'Treat the cough as a minor nuisance and offer a cough lozenge', why: 'A new dry cough with orthopnea in a decompensating heart failure patient is an early respiratory warning sign, not a simple throat irritation — it deserves a lung assessment, not a lozenge.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'She is now short of breath with exertion and coughing up pink, frothy sputum — a hallmark of fluid flooding the alveoli. Sit her up and get high-flow oxygen on now.',
        vitals: { hr: 116, sbp: 168, dbp: 98, spo2: 89, rr: 28, temp: 36.8 },
        actions: [
          { id: 'flash-c-position-upright', cat: 'intervene', kind: 'key', label: 'Sit her fully upright with legs dangling if tolerated', log: 'Positioned upright with legs dependent. This reduces venous return to an already overloaded heart and eases her work of breathing.', effects: { vitals: { spo2: 91, hr: 112 } } },
          { id: 'flash-c-high-flow-o2', cat: 'intervene', kind: 'key', label: 'Administer high-flow oxygen', log: 'High-flow oxygen applied via face mask. Her saturation responds, but the pink frothy sputum is a sign this is progressing.' },
          { id: 'flash-c-lay-flat-comfort', cat: 'intervene', kind: 'harm', label: 'Lay her flat since she says the upright position is tiring her', why: 'Lying flat increases venous return to an already fluid-overloaded heart and worsens pulmonary congestion — upright positioning with legs dependent is specifically therapeutic here, even if it feels tiring to hold.' },
          { id: 'flash-c-cough-suppressant', cat: 'intervene', kind: 'neutral', label: 'Give a cough suppressant to control the pink sputum symptom', why: 'The cough and pink frothy sputum are symptoms of pulmonary edema, not a primary cough problem — suppressing the cough does not address the fluid flooding her lungs and delays the interventions that actually help.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Severe air hunger, oxygen crashing, and her blood pressure has spiked from the sympathetic surge of fluid overload. She needs non-invasive ventilatory support and close urine output tracking right now.',
        vitals: { hr: 128, sbp: 190, dbp: 100, spo2: 82, rr: 34, temp: 36.8 },
        actions: [
          { id: 'flash-ch-bipap', cat: 'intervene', kind: 'key', label: 'Apply BiPAP (non-invasive positive pressure ventilation)', log: 'BiPAP mask fitted and pressures set per protocol. The positive pressure begins pushing fluid back out of the alveoli, and her breathing eases slightly.', effects: { vitals: { spo2: 87, rr: 28 } } },
          { id: 'flash-ch-foley', cat: 'assess', kind: 'key', label: 'Insert a Foley catheter to closely track urine output', log: 'Foley placed. Hourly urine output monitoring now running — critical to judge how well the diuretic, once given, is working.' },
          { id: 'flash-ch-fluid-bolus-trap', cat: 'intervene', kind: 'harm', label: 'Give an IV fluid bolus, reasoning that her pressure is high so her heart "must need more support"', why: 'This is the classic decoy: her problem is fluid OVERLOAD, not underfilling. A fluid bolus in flash pulmonary edema pours more volume into an already flooded circulation and can be catastrophic.', stability: 25 },
          { id: 'flash-ch-low-flow-o2', cat: 'intervene', kind: 'neutral', label: 'Switch down to low-flow nasal cannula oxygen to "let her rest from the mask"', why: 'With SpO2 crashing into the low 80s and severe air hunger, she needs escalating respiratory support such as BiPAP, not a step down to a lower level of oxygen delivery.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Fluid Unloading',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Her lungs are flooding and her pressure is dangerously high. You must vasodilate to unload the heart, then diurese aggressively, then confirm it is working — in order.',
        vitals: { hr: 132, sbp: 194, dbp: 104, spo2: 80, rr: 36, temp: 36.8 },
        sequence: [
          { id: 'boss-flash-ntg-drip', label: 'Start an IV Nitroglycerin drip', why: 'IV nitroglycerin is first-line in flash pulmonary edema with high blood pressure — it rapidly reduces preload and afterload, easing the burden on the failing heart and directly relieving pulmonary congestion.' },
          { id: 'boss-flash-furosemide', label: 'Push IV Furosemide (Lasix)', why: 'IV furosemide drives the aggressive diuresis needed to actually remove the excess fluid load, working alongside the vasodilation from nitroglycerin to unload the congested lungs.' },
          { id: 'boss-flash-monitor-output', label: 'Monitor urine output aggressively via the Foley', why: 'Close hourly tracking of urine output is how you confirm the furosemide is actually working and guides whether further diuretic dosing is needed — this closes the loop on the treatment.' },
        ],
        decoys: [
          { id: 'decoy-flash-fluid-bolus-boss', label: 'Give an IV fluid bolus since her blood pressure is so high', why: 'This is the same fatal trap as before: high blood pressure here comes from fluid overload and sympathetic surge, not hypovolemia — a fluid bolus adds to the flooding instead of relieving it.' },
          { id: 'decoy-flash-furosemide-first', label: 'Push furosemide before starting the nitroglycerin drip', why: 'Nitroglycerin acts fastest to reduce the preload/afterload burden and ease congestion within minutes, while furosemide\'s diuretic effect takes longer to remove volume — vasodilation leads, diuresis follows.' },
          { id: 'decoy-flash-skip-monitoring', label: 'Skip the urine output monitoring since the drugs are already given', why: 'Giving the drugs is not the end of the sequence — aggressive urine output monitoring is what confirms the furosemide is working and tells the team whether to escalate the dose.' },
        ],
      },
    ],
    debriefWin: 'You read the early warning correctly and held the ladder: fluid restriction and crackles at the bases first, upright positioning and oxygen as she worsened, BiPAP and a Foley when air hunger became severe, and — critically — you refused the fluid bolus trap and instead vasodilated with nitroglycerin before diuresing with furosemide and tracking the output. That is exactly how flash pulmonary edema gets unloaded.',
    debriefLoss: 'Flash pulmonary edema kills through a tempting trap: a very high blood pressure can look like it needs "more fluid support," when the real problem is fluid already flooding the lungs. Losing her here does not mean you were careless; it means the fix — vasodilate first, then diurese, never bolus — is now unforgettable.',
    examTip: 'NORCET tests flash pulmonary edema management: upright positioning with legs dependent, high-flow oxygen escalating to BiPAP, IV nitroglycerin as first-line vasodilator therapy in hypertensive pulmonary edema, IV furosemide for diuresis, and the classic trap — a fluid bolus is contraindicated because the underlying problem is overload, not depletion.',
  },
];

export default SCENARIOS_B1;
