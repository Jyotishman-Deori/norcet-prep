// =====================================================================
// src/data/ward-boss-scenarios-b3.js — wave B3 seed content for "Ward Boss"
// (patient-deterioration simulation, NORCET clinical judgement drill).
// SIX brand-new scenarios, additive to WARD_BOSS_SCENARIOS in
// ward-boss-scenarios.js (same schema, same validator, same house style).
// All medical content is OWNER-REVIEWED (nurse educator) before ship; see
// the "clinical judgment calls" note in the PR/task summary for anything
// that needs a second look.
//
// SCHEMA — identical to ward-boss-scenarios.js; see that file's header for
// the full annotated contract. Validated by src/lib/ward-boss-engine.js
// validateScenario().
// =====================================================================

export const SCENARIOS_B3 = [
  // ---------------------------------------------------------------------
  // 1. VARICEAL UPPER GI BLEED
  // ---------------------------------------------------------------------
  {
    id: 'variceal-gi-bleed',
    title: 'The Black Stool',
    category: 'Shock, Tox & Transfusion',
    difficulty: 2,
    patient: { name: 'Balbir Singh', age: 52, sex: 'M', history: 'Known cirrhosis with portal hypertension (alcohol-related), no prior variceal bleed on record' },
    intro: 'Medical ward, night shift. Balbir\'s attender flags that his last two stools were "black and tarry" and he looks unusually pale and sweaty tonight. He is a known cirrhotic — this is not a stomach upset to wait out.',
    vitalsStart: { hr: 106, sbp: 106, dbp: 68, spo2: 96, rr: 20, temp: 36.9 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Melena plus known portal hypertension is a variceal bleed until proven otherwise. Confirm it and get access before he decompensates.',
        vitals: { hr: 112, sbp: 102, dbp: 64, spo2: 95, rr: 21, temp: 36.9 },
        actions: [
          { id: 'gib-s-two-iv', cat: 'intervene', kind: 'key', label: 'Insert two large-bore IV cannulas', log: 'Two 16-gauge IVs secured, one in each arm. Ready for rapid fluid or blood at any moment.' },
          { id: 'gib-s-cbc-crossmatch', cat: 'assess', kind: 'key', label: 'Send stat CBC, coagulation profile, and type and crossmatch', log: 'Samples sent. Lab flags Hb as pending but confirms a group O crossmatch is in progress.' },
          { id: 'gib-s-antacid-only', cat: 'intervene', kind: 'harm', label: 'Just give an antacid and observe, since it "sounds like gastritis"', why: 'Melena in a known cirrhotic with portal hypertension is a variceal bleed until ruled out — treating it as simple gastritis delays IV access and crossmatch, the two things that actually buy time if he decompensates.' },
          { id: 'gib-s-wait-morning', cat: 'communicate', kind: 'neutral', label: 'Document it and plan to discuss at the morning handover', why: 'A cirrhotic patient with melena and early tachycardia can rebleed catastrophically within hours — this needs same-shift escalation, not a note for the morning team.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'He suddenly vomits a large volume of fresh red blood. This has moved from occult to active, brisk bleeding — protect his airway and start resuscitation now.',
        vitals: { hr: 122, sbp: 90, dbp: 56, spo2: 93, rr: 24, temp: 36.8 },
        actions: [
          { id: 'gib-c-position', cat: 'intervene', kind: 'key', label: 'Position him on his left side with head slightly elevated', log: 'Repositioned left-lateral, head of bed at 30 degrees. Airway stays clear of the next episode of hematemesis.' },
          { id: 'gib-c-crystalloid', cat: 'intervene', kind: 'key', label: 'Start a cautious crystalloid bolus while blood is prepared', log: 'Normal saline running to support pressure without over-diluting, while O-negative units are being sent up.', effects: { vitals: { sbp: 4, hr: -3 } } },
          { id: 'gib-c-lavage-force', cat: 'intervene', kind: 'harm', label: 'Pass an NG tube and lavage forcefully to "clear the stomach"', why: 'Vigorous NG lavage in a suspected variceal bleed risks mechanically tearing a fragile varix and worsening the hemorrhage. NG aspiration is sometimes used gently to confirm active bleeding, never as forceful irrigation.', stability: 20 },
          { id: 'gib-c-sit-upright', cat: 'intervene', kind: 'neutral', label: 'Sit him fully upright to "make him more comfortable"', why: 'With active hematemesis, a fully upright position without lateral tilt increases the risk of aspiration if he vomits again — left-lateral positioning protects the airway better here.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'His pressure is sliding fast and he is now cool, clammy, and confused. This is hypovolemic shock from ongoing variceal bleeding — escalate hard.',
        ecgId: 'stach',
        vitals: { hr: 136, sbp: 78, dbp: 46, spo2: 91, rr: 28, temp: 36.6 },
        actions: [
          { id: 'gib-ch-call-gi', cat: 'communicate', kind: 'key', label: 'Call the GI/endoscopy team STAT for urgent endoscopy', log: 'GI registrar notified. "Keep him resuscitated, we will scope as soon as he is stable enough to transport."' },
          { id: 'gib-ch-transfuse', cat: 'intervene', kind: 'key', label: 'Begin transfusing crossmatched blood as it arrives', log: 'First unit of packed red cells running. His colour and pressure begin to steady.', effects: { vitals: { sbp: 6, hr: -6 } } },
          { id: 'gib-ch-only-fluids', cat: 'intervene', kind: 'harm', label: 'Keep pushing crystalloid only and hold off on blood', why: 'Large-volume crystalloid alone in ongoing hemorrhage dilutes clotting factors and does not restore oxygen-carrying capacity — this patient needs blood products, not endless saline, once they are available.' },
          { id: 'gib-ch-npo-forget', cat: 'assess', kind: 'neutral', label: 'Let him sip water to "settle his stomach" while you wait', why: 'He must stay strictly nil by mouth — active variceal bleeding heading to urgent endoscopy cannot risk aspiration or a full stomach at the time of the procedure.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Exsanguinating Varices',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'He is in hypovolemic shock from a variceal bleed that has not stopped. You need to resuscitate, control the bleeding pharmacologically, and prepare definitive care — in the right order.',
        ecgId: 'stach',
        vitals: { hr: 144, sbp: 70, dbp: 40, spo2: 90, rr: 30, temp: 36.4 },
        sequence: [
          { id: 'boss-gib-two-lines-crystalloid', label: 'Confirm two large-bore IV lines are running and push rapid crystalloid while blood is transfusing', why: 'Resuscitation access and volume come first in hemorrhagic shock — two large-bore lines with rapid crystalloid (bridging to blood) restore circulating volume while the bleeding source is being controlled.' },
          { id: 'boss-gib-octreotide', label: 'Start an octreotide infusion and give IV antibiotics', why: 'Octreotide lowers portal pressure and reduces variceal bleeding, and prophylactic antibiotics are standard in cirrhotic variceal bleeds to prevent the bacterial infections that worsen outcomes — both start alongside resuscitation, before endoscopy.' },
          { id: 'boss-gib-prep-endoscopy', label: 'Keep him strictly NPO and prepare him for urgent endoscopy', why: 'Once resuscitation is underway and octreotide plus antibiotics are running, the definitive treatment is endoscopic band ligation or sclerotherapy — he must stay NPO and ready for the endoscopy team.' },
        ],
        decoys: [
          { id: 'decoy-gib-lavage-force', label: 'Pass an NG tube and lavage forcefully to clear the stomach before anything else', why: 'Forceful lavage risks tearing a fragile varix and worsening the bleed — it is not part of the resuscitation sequence and is never done aggressively in suspected variceal hemorrhage.' },
          { id: 'decoy-gib-wait-endoscopist', label: 'Wait for the endoscopist to arrive before starting any resuscitation', why: 'Resuscitation (access, fluids, octreotide, antibiotics) must start immediately and run in parallel with arranging endoscopy — waiting idle for the endoscopist while a patient is in shock costs lives.' },
          { id: 'decoy-gib-betablocker-now', label: 'Start a beta-blocker now to lower portal pressure', why: 'Beta-blockers reduce the RISK of a future variceal bleed and are used for longer-term secondary prophylaxis — they are not given during acute active hemorrhage, where they can blunt the compensatory tachycardia that is helping maintain his pressure.' },
        ],
      },
    ],
    debriefWin: 'You ran the variceal bleed ladder correctly: two large-bore lines and crossmatch sent early, airway-protective positioning with gentle (not forceful) management, blood transfusion once available, and — when shock set in — resuscitation, octreotide plus antibiotics, and NPO preparation for urgent endoscopy, all in the right order. That is exactly what keeps a cirrhotic GI bleed from becoming exsanguination.',
    debriefLoss: 'Variceal bleeds kill through underestimated blood loss and delayed access — melena in a known cirrhotic is never "just gastritis." Losing him here does not mean you missed something obvious; it means you now know the ladder: access and crossmatch first, protect the airway, resuscitate with blood not just crystalloid, and octreotide plus antibiotics while endoscopy is arranged.',
    examTip: 'NORCET tests the variceal bleed sequence: two large-bore IVs and crossmatch sent immediately, resuscitation with blood products (not crystalloid alone), octreotide to lower portal pressure, prophylactic antibiotics in cirrhotics, and NPO status while urgent endoscopy is arranged — never forceful NG lavage.',
  },

  // ---------------------------------------------------------------------
  // 2. MASSIVE HEMOPTYSIS IN PULMONARY TB
  // ---------------------------------------------------------------------
  {
    id: 'tb-hemoptysis',
    title: 'The Rusty Cough',
    category: 'Respiratory',
    difficulty: 2,
    patient: { name: 'Devendra Rathore', age: 38, sex: 'M', history: 'Pulmonary tuberculosis, 2 months into AKT (anti-Koch\'s treatment), previously improving' },
    intro: 'Chest ward. Devendra has been on AKT for two months and was doing well, but tonight his sputum cup shows streaks of fresh blood mixed through the usual thick sputum. He looks anxious but is breathing comfortably for now.',
    vitalsStart: { hr: 96, sbp: 122, dbp: 78, spo2: 97, rr: 18, temp: 37.3 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Blood-streaked sputum in a TB patient can progress fast. Assess how much blood is really coming up and keep him calm and monitored.',
        vitals: { hr: 100, sbp: 120, dbp: 78, spo2: 96, rr: 19, temp: 37.4 },
        actions: [
          { id: 'tb-s-quantify', cat: 'assess', kind: 'key', label: 'Ask him to save and show every episode so you can quantify the blood', log: 'He collects the next expectoration in a clear cup — streaky, roughly a teaspoon so far. You now have a baseline to compare against.' },
          { id: 'tb-s-vitals-spo2', cat: 'assess', kind: 'key', label: 'Recheck vitals and continuous SpO2', log: 'SpO2 steady at 96%, mild tachycardia. No respiratory distress yet, but worth close watching.' },
          { id: 'tb-s-ignore-streaks', cat: 'communicate', kind: 'harm', label: 'Reassure him this is "normal with TB treatment" and do not report it', why: 'Blood-streaked sputum in TB can be an early sign of cavity erosion into a blood vessel and can escalate to massive, airway-flooding hemoptysis within hours — any new blood must be reported and monitored closely, not dismissed as routine.' },
          { id: 'tb-s-physio-vigorous', cat: 'intervene', kind: 'neutral', label: 'Start vigorous chest physiotherapy to "loosen the secretions"', why: 'Vigorous percussion and postural drainage can mechanically provoke more bleeding from an already inflamed or eroding vessel — gentle monitoring is the priority while blood is present, not aggressive physio.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'He coughs up a mouthful of frank blood — roughly 100 mL. This has crossed from streaking into a true bleed. Protect his airway and escalate.',
        vitals: { hr: 112, sbp: 112, dbp: 70, spo2: 94, rr: 24, temp: 37.4 },
        actions: [
          { id: 'tb-c-lateral-side', cat: 'intervene', kind: 'key', label: 'Position him lying on the side of the suspected bleeding lung, head slightly down', log: 'Repositioned with the affected side down. This lets the good lung stay cleared and reduces blood spilling across to it.' },
          { id: 'tb-c-suction-ready', cat: 'intervene', kind: 'key', label: 'Have suction at the bedside and ready for immediate use', log: 'Suction unit at the bedside, tubing primed. Ready the moment he cannot clear his own airway.' },
          { id: 'tb-c-side-up', cat: 'intervene', kind: 'harm', label: 'Position him with the healthy lung down "to protect it"', why: 'This is backwards — positioning the BLEEDING side down (not the healthy side) keeps blood from spilling into and flooding the good lung, protecting overall gas exchange.', stability: 20 },
          { id: 'tb-c-lie-flat-sedate', cat: 'intervene', kind: 'neutral', label: 'Lay him flat and give a sedative to "keep him calm"', why: 'Sedation can blunt his ability to cough and clear blood from his own airway, which is actively protective right now — calm reassurance is fine, but sedating him risks airway flooding going unrecognised.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Blood is pooling faster than he can clear it and his saturation is dropping. This is airway flooding — massive hemoptysis is a drowning risk, not just a bleeding one.',
        vitals: { hr: 128, sbp: 98, dbp: 60, spo2: 88, rr: 30, temp: 37.5 },
        actions: [
          { id: 'tb-ch-o2-high-flow', cat: 'intervene', kind: 'key', label: 'Apply high-flow oxygen and suction the airway continuously', log: 'High-flow oxygen on, suction clearing pooling blood as it comes. SpO2 nudges up slightly.', effects: { vitals: { spo2: 3 } } },
          { id: 'tb-ch-call-pulm-icu', cat: 'communicate', kind: 'key', label: 'Call the pulmonology/ICU team STAT for urgent bronchoscopy and possible airway isolation', log: 'ICU and pulmonology both paged. "Sounds like a bleeding vessel eroding into the airway — get him to us for bronchoscopy, keep the good lung protected until then."' },
          { id: 'tb-ch-wait-observe', cat: 'assess', kind: 'harm', label: 'Wait and observe another 15 minutes before escalating', why: 'Massive hemoptysis with a falling SpO2 is an airway emergency where the primary danger is asphyxiation from flooding, not just blood loss — waiting risks him drowning in his own blood before help arrives.', stability: 22 },
          { id: 'tb-ch-oral-tranexamic', cat: 'intervene', kind: 'neutral', label: 'Give an oral tablet and wait for it to take effect', why: 'An oral medication is far too slow for an actively flooding airway — this moment needs positioning, suction, oxygen, and urgent bronchoscopy escalation, not a tablet and a wait.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Airway Flooding',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Blood is filling his airway faster than he can clear it. You must protect the good lung, support oxygenation, and get him to definitive airway care — in the right order.',
        vitals: { hr: 134, sbp: 92, dbp: 56, spo2: 86, rr: 32, temp: 37.5 },
        sequence: [
          { id: 'boss-tb-position-bleeding-down', label: 'Position him with the bleeding lung side DOWN, in a lateral position', why: 'Bleeding-side-down positioning uses gravity to keep blood from spilling into and flooding the healthy lung — this is the single most important immediate airway-protective step in massive hemoptysis.' },
          { id: 'boss-tb-o2-suction', label: 'Apply high-flow oxygen and maintain continuous suction of the airway', why: 'High-flow oxygen supports the falling saturation while continuous suction keeps pooling blood from occluding the airway — both run together while definitive care is arranged.' },
          { id: 'boss-tb-escalate-bronch', label: 'Escalate urgently for bronchoscopy and ICU-level airway management', why: 'Definitive control of massive hemoptysis (localising and stopping the bleeding vessel, and isolating the airway if needed) requires urgent bronchoscopy and ICU-level care — this must be activated without delay once positioning and support are in place.' },
        ],
        decoys: [
          { id: 'decoy-tb-side-up', label: 'Position the healthy lung side down instead', why: 'This is backwards and dangerous — it lets blood from the bleeding lung spill across into the good lung, flooding the only lung that is still working well.' },
          { id: 'decoy-tb-physio-vigorous', label: 'Perform vigorous chest physiotherapy to help him clear the blood', why: 'Vigorous physiotherapy can mechanically worsen bleeding from an eroding vessel — gentle suction and positioning are used, not forceful percussion, during active massive hemoptysis.' },
          { id: 'decoy-tb-supine-sedate', label: 'Lay him flat on his back and sedate him to keep him still', why: 'Lying flat and sedating him removes his own protective cough reflex and airway-clearing ability at the exact moment he needs it most — this risks silent airway flooding.' },
        ],
      },
    ],
    debriefWin: 'You read the TB hemoptysis ladder correctly: quantified and monitored the early blood streaking instead of dismissing it, positioned the bleeding lung down (not the healthy one), kept suction and oxygen ready, and escalated hard for bronchoscopy the moment the airway began flooding. That sequencing is what keeps a treatable cavity bleed from drowning a patient in his own blood.',
    debriefLoss: 'Massive hemoptysis kills through asphyxiation, not just blood loss — a flooded airway can take a patient down in minutes even with a survivable total blood volume lost. Losing him here does not mean you missed the TB; it means you now know the reflex: bleeding side down, suction and oxygen ready, and urgent bronchoscopy escalation without delay.',
    examTip: 'NORCET tests massive hemoptysis positioning specifically: the BLEEDING lung goes DOWN (lateral decubitus) to protect the healthy lung, never the reverse — plus high-flow oxygen, continuous suction, and urgent bronchoscopy/ICU escalation, avoiding vigorous chest physiotherapy or sedation that blunts the cough reflex.',
  },

  // ---------------------------------------------------------------------
  // 3. MAJOR BURNS + PARKLAND FORMULA
  // ---------------------------------------------------------------------
  {
    id: 'major-burns-parkland',
    title: 'The Kitchen Fire',
    category: 'Shock, Tox & Transfusion',
    difficulty: 3,
    patient: { name: 'Kavita Reddy', age: 34, sex: 'F', history: 'No prior medical history; sustained flame burns from a cooking gas cylinder fire at home' },
    intro: 'Emergency department. Kavita is brought in by her family, her clothes singed, with extensive flame burns across her chest, both arms, and part of her face. The stove fire was extinguished only minutes before arrival.',
    vitalsStart: { hr: 118, sbp: 116, dbp: 74, spo2: 95, rr: 24, temp: 36.8 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Roughly 40% TBSA flame burns. Before anything else, confirm the burning has truly stopped and screen her airway for inhalation injury.',
        vitals: { hr: 122, sbp: 112, dbp: 72, spo2: 94, rr: 25, temp: 36.7 },
        actions: [
          { id: 'burn-s-stop-cool', cat: 'intervene', kind: 'key', label: 'Confirm the burning process is fully stopped and remove any smouldering clothing/jewellery', log: 'All smouldering clothing and constrictive jewellery removed. The burning process is confirmed stopped; swelling has not yet trapped anything against her skin.' },
          { id: 'burn-s-airway-check', cat: 'assess', kind: 'key', label: 'Check for singed nasal hairs, soot in the mouth, and voice change suggesting airway/inhalation injury', log: 'Singed nasal hairs and soot around the lips noted; her voice already sounds slightly hoarse. High suspicion for inhalation injury and early airway compromise.' },
          { id: 'burn-s-ice-water', cat: 'intervene', kind: 'harm', label: 'Pour ice-cold water directly over the burns to "stop the pain"', why: 'Ice-cold water on major burns causes vasoconstriction and can worsen tissue damage and hypothermia in a large-TBSA burn — cool (not ice-cold) running water is used briefly for small burns only; for major burns the priority is airway, stopping the burning process, and covering with a clean dry sheet.', stability: 20 },
          { id: 'burn-s-assess-pain-only', cat: 'assess', kind: 'neutral', label: 'Focus first on scoring her pain and offering analgesia', why: 'Pain control matters and will come, but in a burn this large the immediate priority is airway screening — inhalation injury can close the airway within hours and is far more time-critical than analgesia timing.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'Her voice is more hoarse now and she is starting to sound stridorous. Airway edema from inhalation injury is progressing — this needs urgent escalation before it closes completely.',
        vitals: { hr: 128, sbp: 106, dbp: 68, spo2: 91, rr: 28, temp: 36.6 },
        actions: [
          { id: 'burn-c-o2-high-flow', cat: 'intervene', kind: 'key', label: 'Apply high-flow humidified oxygen', log: 'High-flow humidified oxygen running. SpO2 improves slightly, but the hoarseness is not resolving.', effects: { vitals: { spo2: 2 } } },
          { id: 'burn-c-call-anesthesia-early', cat: 'communicate', kind: 'key', label: 'Call anesthesia/airway team early for probable elective intubation before the airway closes', log: 'Anesthesia team notified early. "Good call — airway swelling like this can close completely; better to secure it now than as a crash intubation later."' },
          { id: 'burn-c-wait-worsens', cat: 'intervene', kind: 'harm', label: 'Wait until she develops obvious respiratory distress before calling anyone', why: 'Progressive airway edema after inhalation injury can close the airway completely within hours — waiting for visible distress converts an elective, controlled intubation into a crash airway emergency with far higher risk.', stability: 22 },
          { id: 'burn-c-cough-syrup', cat: 'intervene', kind: 'neutral', label: 'Give a cough syrup for the hoarseness', why: 'This hoarseness is from thermal/chemical airway injury and progressive edema, not a simple cough — a syrup does nothing for the swelling and only delays the airway team being involved.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Her blood pressure is falling and her urine output has dropped to almost nothing. Burn shock from massive fluid shifts out of the vessels is setting in — fluid resuscitation cannot wait any longer.',
        vitals: { hr: 138, sbp: 88, dbp: 54, spo2: 92, rr: 30, temp: 36.3 },
        actions: [
          { id: 'burn-ch-foley', cat: 'assess', kind: 'key', label: 'Insert a Foley catheter to monitor hourly urine output', log: 'Catheter placed. Output so far: 12 mL in the last hour — well below target, confirming burn shock is underway.' },
          { id: 'burn-ch-start-ringer', cat: 'intervene', kind: 'key', label: 'Start IV Ringer Lactate through a large-bore line while the fluid calculation is finalised', log: 'Ringer Lactate running through a large-bore IV. This buys time while the exact Parkland volume is worked out.', effects: { vitals: { sbp: 4, hr: -3 } } },
          { id: 'burn-ch-dextrose', cat: 'intervene', kind: 'harm', label: 'Run dextrose-containing fluid as the resuscitation fluid', why: 'Dextrose solutions are not used for major burn resuscitation — the large fluid shifts of burn shock are managed with isotonic crystalloid (Ringer Lactate), and unmonitored dextrose risks dangerous hyperglycemia and osmotic complications.', stability: 20 },
          { id: 'burn-ch-oral-fluids', cat: 'intervene', kind: 'neutral', label: 'Encourage oral fluids to "help her rehydrate"', why: 'A patient with this degree of burn shock and falling pressure cannot be rehydrated orally at anywhere near the rate needed — she needs calculated IV crystalloid resuscitation now.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Burn Shock',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Airway is secured, but her circulation is collapsing under massive fluid loss into the burned tissue. You must calculate and deliver her fluid resuscitation correctly — the math and the timing both matter.',
        ecgId: 'stach',
        vitals: { hr: 142, sbp: 82, dbp: 48, spo2: 93, rr: 28, temp: 36.2 },
        sequence: [
          { id: 'boss-burn-calc-parkland', label: 'Calculate the Parkland formula: 4 mL x body weight (kg) x %TBSA burned, using Ringer Lactate', why: 'The Parkland formula (4 mL/kg/%TBSA of Ringer Lactate) is the standard calculation for major burn fluid resuscitation — getting this number right is the foundation of the entire resuscitation plan.' },
          { id: 'boss-burn-half-first-8h', label: 'Give HALF of the calculated total volume in the FIRST 8 HOURS, counted from the time of the burn (not from arrival)', why: 'The timing is counted from the moment of injury, not from hospital arrival — half the total calculated fluid is given in the first 8 hours post-burn and the remaining half over the next 16 hours, because fluid losses are fastest in that early window.' },
          { id: 'boss-burn-titrate-uop', label: 'Titrate the ongoing fluid rate to a target urine output of 0.5 to 1 mL/kg/hour', why: 'Urine output is the most reliable bedside marker of adequate resuscitation in burns — the fluid rate is adjusted up or down to keep output in the 0.5 to 1 mL/kg/hour range, avoiding both under- and over-resuscitation.' },
        ],
        decoys: [
          { id: 'decoy-burn-dextrose-fluid', label: 'Use dextrose-containing fluid for the calculated resuscitation volume', why: 'Isotonic crystalloid (Ringer Lactate), not dextrose, is the standard fluid for the Parkland calculation — dextrose is not part of the standard adult burn resuscitation formula.' },
          { id: 'decoy-burn-colloids-first-24h', label: 'Give colloids (like albumin) as the primary fluid in the first 24 hours', why: 'Colloids are generally avoided in the first 24 hours of burn resuscitation because capillary leak lets them escape into the tissues just like crystalloid, without the proven benefit — crystalloid via the Parkland formula is the first-24-hour standard.' },
          { id: 'decoy-burn-ice-water-boss', label: 'Continue pouring ice-cold water over the burns to "help swelling"', why: 'Ice-cold water risks worsening hypothermia and tissue injury in a large-TBSA burn and has no role in this stage — fluid resuscitation and urine-output titration are the priority now, not topical cold water.' },
        ],
      },
    ],
    debriefWin: 'You ran the major burns ladder correctly: stopped the burning process and screened for inhalation injury early, escalated the airway team BEFORE visible distress, started crystalloid while finalising the numbers, and then delivered the Parkland formula exactly as taught — 4 mL/kg/%TBSA of Ringer Lactate, half in the first 8 hours from the time of the burn, titrated to a urine output of 0.5-1 mL/kg/hr. That is the sequence that turns a devastating burn into a survivable one.',
    debriefLoss: 'Major burns kill in two waves — airway closure from inhalation injury in the first hours, and burn shock from uncalculated or mistimed fluid resuscitation after that. Losing her here does not mean you missed the obvious burn; it means you now carry the exact numbers: Parkland formula, half in 8 hours from the burn (not from arrival), titrated to urine output.',
    examTip: 'NORCET tests the Parkland formula precisely: 4 mL x weight (kg) x %TBSA of Ringer Lactate, HALF given in the first 8 hours counted from the TIME OF BURN, the remaining half over the next 16 hours, titrated to a urine output target of 0.5-1 mL/kg/hr — plus early airway screening (singed nasal hairs, hoarseness) before visible distress sets in.',
  },

  // ---------------------------------------------------------------------
  // 4. ORGANOPHOSPHATE POISONING
  // ---------------------------------------------------------------------
  {
    id: 'organophosphate-poisoning',
    title: 'The Farm Worker',
    category: 'Shock, Tox & Transfusion',
    difficulty: 3,
    patient: { name: 'Ganpat Chavan', age: 45, sex: 'M', history: 'Farm labourer, found unwell near freshly sprayed pesticide fields, no known chronic illness' },
    intro: 'Emergency department. Ganpat was brought in by fellow labourers after he was found sweating heavily, vomiting, and confused near the fields where pesticide had just been sprayed. He smells faintly of something chemical.',
    vitalsStart: { hr: 58, sbp: 100, dbp: 62, spo2: 94, rr: 22, temp: 36.6 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Excess sweating, salivation, nausea, and a chemical smell in a farm worker strongly suggests organophosphate poisoning — decontaminate and protect yourself before anything else.',
        vitals: { hr: 56, sbp: 98, dbp: 60, spo2: 93, rr: 23, temp: 36.6 },
        actions: [
          { id: 'op-s-ppe-decontaminate', cat: 'intervene', kind: 'key', label: 'Put on gloves and gown, then remove and bag his contaminated clothing', log: 'Contaminated clothing removed and sealed in a bag. Staff protected with PPE — secondary exposure risk from skin and clothing is now controlled.' },
          { id: 'op-s-assess-sludge', cat: 'assess', kind: 'key', label: 'Assess for the classic cholinergic toxidrome (salivation, lacrimation, urination, diarrhoea, GI upset, emesis)', log: 'Excess salivation, sweating, watery eyes, and vomiting all present — a classic SLUDGE cholinergic picture, consistent with organophosphate exposure.' },
          { id: 'op-s-handle-bare', cat: 'intervene', kind: 'harm', label: 'Handle his clothing and skin bare-handed to move faster', why: 'Organophosphates absorb readily through intact skin — handling contaminated clothing or skin without gloves risks poisoning the caregiver too. PPE and decontamination come before any hands-on contact.', stability: 20 },
          { id: 'op-s-wait-labs', cat: 'assess', kind: 'neutral', label: 'Wait for a formal toxicology lab result before starting anything', why: 'Organophosphate poisoning is a clinical diagnosis made at the bedside from the toxidrome — waiting for a lab-confirmed result before decontaminating or treating wastes critical time in a rapidly progressive poisoning.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'His pupils have constricted to pinpoints and his heart rate is dropping further, with secretions pooling audibly. This is progressing cholinergic excess — prepare atropine and protect his airway.',
        vitals: { hr: 48, sbp: 92, dbp: 56, spo2: 90, rr: 26, temp: 36.5 },
        actions: [
          { id: 'op-c-suction-secretions', cat: 'intervene', kind: 'key', label: 'Suction his airway to clear pooling oral secretions', log: 'Suction clears a significant volume of secretions from his airway. Breathing sounds slightly less wet immediately after.' },
          { id: 'op-c-prep-atropine', cat: 'assess', kind: 'key', label: 'Prepare IV atropine at the bedside and alert the physician for immediate dosing', log: 'Atropine drawn up and ready. Physician at the bedside, ready to start dosing against the secretions, not the pupils.' },
          { id: 'op-c-fixed-single-dose', cat: 'intervene', kind: 'harm', label: 'Give one standard fixed dose of atropine and consider it "done"', why: 'A single fixed dose is rarely enough in organophosphate poisoning — the correct approach is to give repeated, escalating (doubling) doses of atropine until secretions dry up. Stopping after one fixed dose leaves the cholinergic crisis undertreated.', stability: 20 },
          { id: 'op-c-naloxone', cat: 'intervene', kind: 'neutral', label: 'Give naloxone, thinking this could be an opioid overdose', why: 'The pinpoint pupils here come with sweating, salivation, and bradycardia in a farm worker near pesticide — this toxidrome pattern is cholinergic, not opioid, and naloxone will not touch it. Do not anchor on pinpoint pupils alone.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Secretions are now flooding his airway audibly (bronchorrhea) and his limbs are twitching with fasciculations. This is a full cholinergic crisis — his airway is drowning under his own secretions.',
        vitals: { hr: 42, sbp: 84, dbp: 50, spo2: 85, rr: 30, temp: 36.3 },
        actions: [
          { id: 'op-ch-continuous-suction', cat: 'intervene', kind: 'key', label: 'Maintain continuous suction and high-flow oxygen while atropine is titrated', log: 'Continuous suction keeps the airway clearer as secretions keep forming; high-flow oxygen supports his falling saturation while the atropine is being pushed.' },
          { id: 'op-ch-double-atropine', cat: 'intervene', kind: 'key', label: 'Double the atropine dose and repeat every few minutes until secretions dry up', log: 'Atropine dose doubled and repeated. Secretions visibly begin to thin and dry — the endpoint is close.', effects: { vitals: { hr: 6 } } },
          { id: 'op-ch-induce-vomit', cat: 'intervene', kind: 'harm', label: 'Try to induce vomiting to "get the poison out faster"', why: 'Inducing vomiting in a patient with a compromised, secretion-flooded airway risks aspiration of vomitus on top of an already drowning airway — this is not part of the acute management once the patient is symptomatic and unstable.', stability: 22 },
          { id: 'op-ch-hold-atropine-hr', cat: 'assess', kind: 'neutral', label: 'Hold further atropine because his heart rate is already "concerning"', why: 'A slow heart rate here is part of the cholinergic crisis itself, not a reason to withhold the antidote — atropine is exactly what treats this bradycardia along with the secretions, and withholding it deepens the crisis.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Cholinergic Crisis',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'His airway is flooding with secretions and his heart rate keeps falling. You must reverse this crisis with the right drugs, dosed to the right endpoint, in the right order.',
        vitals: { hr: 38, sbp: 78, dbp: 46, spo2: 82, rr: 32, temp: 36.2 },
        sequence: [
          { id: 'boss-op-atropine-doubling', label: 'Give IV atropine, DOUBLING the dose with each repeat, until secretions dry up (atropinisation)', why: 'Atropinisation is titrated to the drying of secretions (a dry chest), NOT to pupil size or heart rate alone — doses are doubled and repeated until that clinical endpoint is reached, because organophosphate toxicity can require very large cumulative doses.' },
          { id: 'boss-op-pralidoxime', label: 'Give pralidoxime (PAM), once atropinisation is underway', why: 'Pralidoxime reactivates the enzyme acetylcholinesterase that the organophosphate has blocked, treating the underlying poisoning rather than just the symptoms — it is given alongside/after atropine has started controlling the immediate secretions and bradycardia.' },
          { id: 'boss-op-continuous-airway', label: 'Maintain continuous airway suction and monitoring as the antidotes take effect', why: 'Even as atropine and pralidoxime start working, secretions and clinical status must be continuously reassessed — atropine dosing continues to be titrated against the airway picture, not given as a one-time event.' },
        ],
        decoys: [
          { id: 'decoy-op-fixed-single-dose-boss', label: 'Give one more fixed dose of atropine and stop, since "that is the standard dose"', why: 'There is no single fixed ceiling dose in severe organophosphate poisoning — atropine is doubled and repeated until secretions dry (atropinisation), which can require far more than one standard dose.' },
          { id: 'decoy-op-naloxone-boss', label: 'Give naloxone, since the pinpoint pupils suggest opioid toxicity', why: 'This toxidrome (bradycardia, bronchorrhea, fasciculations, sweating, salivation) is cholinergic, from organophosphate exposure, not opioid — naloxone has no role and would waste critical time.' },
          { id: 'decoy-op-induce-vomit-boss', label: 'Induce vomiting now to clear the remaining poison', why: 'With an airway already flooding with secretions, inducing vomiting risks aspiration on top of the existing crisis — decontamination was addressed earlier; the priority now is atropinisation, pralidoxime, and airway support.' },
        ],
      },
    ],
    debriefWin: 'You ran the organophosphate ladder correctly: PPE and decontamination before contact, recognised the cholinergic toxidrome early, suctioned and prepared atropine rather than fixating on the pupils, and — in the crisis — doubled the atropine dose to the true endpoint (dry secretions, not pupil size), added pralidoxime, and kept the airway continuously supported. That is exactly how a cholinergic crisis gets reversed.',
    debriefLoss: 'Organophosphate poisoning kills through drowning in your own secretions and cardiac collapse — undertreating with a single fixed atropine dose is the classic, fatal mistake. Losing him here does not mean you missed the diagnosis; it means the endpoint is now burned in: atropine doubled and repeated until the chest is dry, not until the pupils look normal.',
    examTip: 'NORCET tests the organophosphate antidote sequence and endpoint precisely: PPE and decontamination first, IV atropine DOUBLED with each repeat dose until secretions dry up (atropinisation — judged by a dry chest, NOT pupil size), then pralidoxime (PAM) to reactivate acetylcholinesterase, with continuous airway suction throughout.',
  },

  // ---------------------------------------------------------------------
  // 5. NEONATAL RESUSCITATION (THE GOLDEN MINUTE)
  // ---------------------------------------------------------------------
  {
    id: 'neonatal-resuscitation',
    title: 'The First Minute',
    category: 'OB & Neonatal',
    difficulty: 2,
    patient: { name: 'Baby of Sunita Devi', age: 0, sex: 'M', history: 'Term delivery, uncomplicated pregnancy, spontaneous vaginal birth moments ago' },
    intro: 'Delivery room. Sunita\'s baby boy has just been born at term, but instead of a vigorous cry, he is floppy and quiet on the warmer, with only a weak, irregular whimper. The clock on the wall has already started.',
    vitalsStart: { hr: 92, sbp: 60, dbp: 36, spo2: 78, rr: 24, temp: 36.9 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'The baby is floppy with a poor cry right at delivery. The first steps of newborn care must happen in seconds, not minutes — warm, dry, stimulate, and position the airway.',
        vitals: { hr: 96, sbp: 58, dbp: 34, spo2: 76, rr: 26, temp: 36.7 },
        actions: [
          { id: 'nrp-s-warm-dry-stim', cat: 'intervene', kind: 'key', label: 'Warm, dry, and stimulate the baby (rub the back, flick the soles)', log: 'Baby is dried, placed under the radiant warmer, and stimulated with brisk back rubs. A slightly stronger whimper follows, but breathing is still weak and irregular.' },
          { id: 'nrp-s-position-airway', cat: 'intervene', kind: 'key', label: 'Position the head in a neutral "sniffing" position to open the airway', log: 'Head repositioned into a neutral sniffing position. Airway is now open and unobstructed for the next assessment.' },
          { id: 'nrp-s-deep-suction-routine', cat: 'intervene', kind: 'harm', label: 'Perform routine deep suctioning of the mouth and nose before anything else', why: 'Routine deep suctioning is not recommended as a first step for a floppy newborn — it can trigger a vagal reflex that worsens bradycardia, and it delays the truly time-critical first steps of warm-dry-stimulate and airway positioning.', stability: 20 },
          { id: 'nrp-s-wait-cry', cat: 'assess', kind: 'neutral', label: 'Wait another full minute to see if he cries on his own', why: 'The Golden Minute framework calls for active steps (warm-dry-stimulate, positioning, and reassessment) within the first 60 seconds of life, not passive waiting — every second of delay in a poorly responding newborn matters.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'His heart rate has dropped below 100 and his breathing is now gasping rather than regular. Drying and stimulation alone are not enough — he needs assisted ventilation.',
        vitals: { hr: 88, sbp: 54, dbp: 32, spo2: 72, rr: 18, temp: 36.6 },
        actions: [
          { id: 'nrp-c-ppv-start', cat: 'intervene', kind: 'key', label: 'Start positive-pressure ventilation (PPV) with a bag and mask', log: 'PPV started with a properly sealed mask at an appropriate rate. Chest rise looks adequate with each breath.', effects: { vitals: { hr: 6, spo2: 4 } } },
          { id: 'nrp-c-spo2-monitor', cat: 'assess', kind: 'key', label: 'Attach a pulse oximeter to the right hand/wrist to track pre-ductal SpO2', log: 'Pulse oximeter attached to the right wrist for accurate pre-ductal saturation readings as PPV continues.' },
          { id: 'nrp-c-o2-blowby-wait', cat: 'intervene', kind: 'harm', label: 'Give free-flow oxygen blow-by near the face and just wait', why: 'A heart rate under 100 with gasping breathing needs actual assisted ventilation (PPV), not passive blow-by oxygen — blow-by alone does not move air into the lungs and will not correct this heart rate or breathing pattern.', stability: 22 },
          { id: 'nrp-c-compressions-first', cat: 'intervene', kind: 'neutral', label: 'Start chest compressions immediately, before trying ventilation', why: 'The very first response to a heart rate this low is effective ventilation, not compressions — most newborn bradycardia responds to adequate PPV alone, and compressions are reserved for a heart rate that stays under 60 despite 30 seconds of effective ventilation.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Despite bag-and-mask breaths, his heart rate keeps falling and he remains limp and dusky. This is not responding to ventilation alone — check technique and prepare to escalate.',
        vitals: { hr: 58, sbp: 46, dbp: 26, spo2: 65, rr: 10, temp: 36.4 },
        actions: [
          { id: 'nrp-ch-check-mask-seal', cat: 'assess', kind: 'key', label: 'Reassess mask seal, head position, and chest rise (the MR SOPA-style checks)', log: 'Mask reseated for a tighter seal and head repositioned. Chest rise improves noticeably with the next few breaths — ventilation is now genuinely effective.' },
          { id: 'nrp-ch-call-help', cat: 'communicate', kind: 'key', label: 'Call for a second skilled provider and prepare for possible chest compressions', log: 'A second neonatal-trained provider arrives at the warmer. "Heart rate under 60 after effective PPV means we move to compressions — I will coordinate the ratio with you."' },
          { id: 'nrp-ch-keep-ineffective-ppv', cat: 'intervene', kind: 'harm', label: 'Keep bagging exactly the same way without checking why it is not working', why: 'When a heart rate does not improve with PPV, the correction steps (reseat the mask, reposition the head, suction if needed, open the mouth) must be checked before assuming ventilation has failed outright — continuing ineffective technique wastes the most critical seconds.', stability: 20 },
          { id: 'nrp-ch-abandon-ventilation', cat: 'intervene', kind: 'neutral', label: 'Stop ventilating and go straight to compressions alone', why: 'Compressions without ongoing coordinated ventilation are ineffective in a newborn — oxygen delivery to a failing heart depends on the two working together, not compressions replacing breaths.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: The Golden Minute',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Effective ventilation is confirmed, but his heart rate has stayed under 60. You must now deliver coordinated chest compressions and ventilation in the exact correct ratio and order.',
        vitals: { hr: 48, sbp: 40, dbp: 22, spo2: 60, rr: 8, temp: 36.2 },
        sequence: [
          { id: 'boss-nrp-confirm-effective-ppv', label: 'Confirm 30 seconds of effective PPV (good chest rise) has already been given', why: 'Chest compressions are only started after confirming ventilation is truly effective and the heart rate remains under 60 despite that — skipping this confirmation risks compressing a heart that just needed better ventilation.' },
          { id: 'boss-nrp-start-compressions', label: 'Start chest compressions coordinated with ventilation in a 3:1 ratio (90 compressions : 30 breaths per minute)', why: 'Neonatal resuscitation uses a 3:1 compression-to-ventilation ratio, delivered as a coordinated cycle (not simultaneously) to achieve about 90 compressions and 30 breaths each minute — this is the specific ratio tested and used in newborns.' },
          { id: 'boss-nrp-reassess-hr', label: 'Reassess the heart rate after about 60 seconds of coordinated compressions and ventilation', why: 'The heart rate is reassessed roughly every 60 seconds during compressions to decide whether to continue, stop compressions once the rate rises above 60, or escalate further (such as umbilical venous access and epinephrine) if there is still no improvement.' },
        ],
        decoys: [
          { id: 'decoy-nrp-deep-suction-first', label: 'Perform deep suctioning first, before starting ventilation', why: 'Routine deep suctioning is not a first step and is not needed here once the airway is positioned and clear — it delays the truly time-critical action, which is effective ventilation.' },
          { id: 'decoy-nrp-o2-blowby-wait-boss', label: 'Continue free-flow oxygen blow-by and simply wait for improvement', why: 'Blow-by oxygen does not move air into the lungs and cannot correct a heart rate this low — this baby needs coordinated PPV and, since the rate stayed under 60, chest compressions.' },
          { id: 'decoy-nrp-compressions-before-ppv', label: 'Start chest compressions before ever establishing effective ventilation', why: 'Ventilation must be established and confirmed effective FIRST — compressions are only added when the heart rate stays under 60 despite 30 seconds of effective PPV, never as the very first response.' },
        ],
      },
    ],
    debriefWin: 'You ran the Golden Minute exactly as it is taught: warm-dry-stimulate and airway positioning first, escalated to positive-pressure ventilation the moment the heart rate fell under 100, corrected your mask seal and technique when the heart rate did not respond, and — only once effective ventilation was confirmed and the rate stayed under 60 — started coordinated 3:1 chest compressions and ventilation. That sequencing is what neonatal resuscitation is built on.',
    debriefLoss: 'Newborns decompensate and recover on a timescale of seconds, and the single most common resuscitation failure is ineffective ventilation technique going unrecognised. Losing this baby here does not mean you panicked; it means the sequence is now automatic: warm-dry-stimulate, PPV for a heart rate under 100, fix your technique before you doubt it, and only start compressions — in a 3:1 ratio — after 30 seconds of truly effective ventilation has not raised the rate above 60.',
    examTip: 'NORCET tests the neonatal resuscitation sequence and ratios exactly: warm-dry-stimulate and position the airway first, positive-pressure ventilation for a heart rate under 100 (never routine deep suction first), and chest compressions ONLY after 30 seconds of effective PPV fails to bring the heart rate above 60 — delivered in a 3:1 compression-to-ventilation ratio (90 compressions : 30 breaths per minute).',
  },

  // ---------------------------------------------------------------------
  // 6. ACUTE HEMOLYTIC TRANSFUSION REACTION
  // ---------------------------------------------------------------------
  {
    id: 'hemolytic-transfusion-reaction',
    title: 'The Wrong Bag',
    category: 'Shock, Tox & Transfusion',
    difficulty: 2,
    patient: { name: 'Meena Kumari', age: 41, sex: 'F', history: 'Post-op day 1 following hysterectomy for fibroids; receiving her first unit of packed red cells for surgical blood loss' },
    intro: 'Surgical ward. Meena\'s blood transfusion has been running for about ten minutes when she tells you she suddenly feels warm all over, a little anxious, and her lower back has started to ache. Nothing about her looks dramatic yet — but this is the classic early flag.',
    vitalsStart: { hr: 96, sbp: 116, dbp: 74, spo2: 97, rr: 18, temp: 37.0 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Feeling warm, anxious, and a new backache within minutes of starting a transfusion is the classic early flag for a hemolytic reaction — every transfusion complaint gets stopped and checked, no exceptions.',
        vitals: { hr: 102, sbp: 112, dbp: 72, spo2: 96, rr: 20, temp: 37.2 },
        actions: [
          { id: 'htr-s-stop-transfusion', cat: 'intervene', kind: 'key', label: 'Stop the transfusion immediately', log: 'The blood unit is clamped off and disconnected right away. Any further exposure to the transfusion is now halted.' },
          { id: 'htr-s-vitals-recheck', cat: 'assess', kind: 'key', label: 'Recheck her vitals immediately and compare to the pre-transfusion baseline', log: 'HR and temp both trending up compared to the pre-transfusion baseline. This supports a true reaction, not just anxiety.' },
          { id: 'htr-s-slow-only', cat: 'intervene', kind: 'harm', label: 'Just slow the transfusion rate down instead of stopping it', why: 'Any new symptom during a transfusion means the transfusion is stopped completely, not slowed — continuing to infuse incompatible blood, even slowly, keeps feeding a hemolytic reaction that can rapidly worsen.', stability: 20 },
          { id: 'htr-s-reassure-only', cat: 'communicate', kind: 'neutral', label: 'Reassure her that "some warmth is normal with transfusions" and continue watching', why: 'Backache plus feeling warm and anxious minutes into a transfusion is a well-known early transfusion-reaction pattern, not a benign normal finding — it must be treated as a possible reaction and acted on now, not reassured away.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'Her temperature has spiked and she is now shaking with chills, and her urine looks visibly dark. This is escalating hemolysis — keep the line open safely and get the blood bank moving.',
        vitals: { hr: 114, sbp: 104, dbp: 66, spo2: 95, rr: 24, temp: 38.7 },
        actions: [
          { id: 'htr-c-new-tubing-ns', cat: 'intervene', kind: 'key', label: 'Keep the IV line open by running fresh normal saline through NEW tubing', log: 'A brand-new IV line and tubing are set up, running plain normal saline. Access is preserved without any further exposure to the reacting blood.' },
          { id: 'htr-c-notify-physician', cat: 'communicate', kind: 'key', label: 'Notify the physician and the blood bank immediately', log: 'Physician and blood bank both notified. "Send the bag and fresh samples down right away — we will confirm on our end and support her pressure."' },
          { id: 'htr-c-same-tubing-flush', cat: 'intervene', kind: 'harm', label: 'Flush the SAME tubing that carried the blood with saline to "keep it patent"', why: 'Flushing saline through the same tubing that delivered the reacting blood pushes residual incompatible blood into her circulation — a completely new line and tubing must be used to keep the access open safely.', stability: 20 },
          { id: 'htr-c-paracetamol-continue', cat: 'intervene', kind: 'neutral', label: 'Give paracetamol for the fever and consider restarting the same unit once she is comfortable', why: 'Treating the fever and then resuming the same unit ignores that this is very likely a hemolytic reaction — the unit must never be restarted, and the priority is confirming the diagnosis with the blood bank, not symptom relief followed by continuing the transfusion.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Her blood pressure is dropping and you notice oozing at her IV insertion sites. This is progressing toward shock with early coagulopathy — support her circulation and escalate hard.',
        vitals: { hr: 128, sbp: 84, dbp: 50, spo2: 92, rr: 28, temp: 39.0 },
        actions: [
          { id: 'htr-ch-fluid-support', cat: 'intervene', kind: 'key', label: 'Run a normal saline bolus to support her falling blood pressure', log: 'Normal saline bolus running to support circulating volume and blood pressure while the reaction is being managed.', effects: { vitals: { sbp: 5, hr: -3 } } },
          { id: 'htr-ch-escalate-team', cat: 'communicate', kind: 'key', label: 'Escalate urgently to the rapid response/medical team for hemolytic shock with possible DIC', log: 'Rapid response team at the bedside. "Oozing at IV sites with hypotension after a transfusion reaction — treat this as early DIC until labs say otherwise, we are on it with you."' },
          { id: 'htr-ch-ignore-oozing', cat: 'assess', kind: 'harm', label: 'Dismiss the oozing at the IV sites as "just from the needle" and move on', why: 'New oozing at IV sites in the setting of a hemolytic transfusion reaction is a red flag for disseminated intravascular coagulation (DIC) developing — this must be flagged and escalated immediately, not dismissed as incidental.', stability: 22 },
          { id: 'htr-ch-single-bp-check', cat: 'assess', kind: 'neutral', label: 'Take a single blood pressure reading and wait to see if it recovers on its own', why: 'A patient trending into shock with signs of coagulopathy needs continuous monitoring and active support, not a single check-and-wait approach while she keeps deteriorating.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Acute Hemolytic Reaction',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'She is hypotensive with oozing IV sites and dark urine — a full acute hemolytic transfusion reaction. You must stop the harm, preserve safe access, and trigger the confirmatory workup, in the right order.',
        ecgId: 'stach',
        vitals: { hr: 134, sbp: 78, dbp: 46, spo2: 91, rr: 30, temp: 39.2 },
        sequence: [
          { id: 'boss-htr-stop-immediately', label: 'Stop the transfusion immediately, if it has not already been stopped', why: 'The single most important action in any suspected transfusion reaction is to stop the transfusion the instant it is suspected — every additional millilitre of incompatible blood deepens the hemolysis.' },
          { id: 'boss-htr-new-line-ns', label: 'Keep the IV line open with fresh normal saline through brand NEW tubing', why: 'A new line and tubing (never the tubing that carried the reacting blood) keeps IV access open for fluids and emergency drugs without pushing any more incompatible blood into her circulation.' },
          { id: 'boss-htr-recheck-and-bloodbank', label: 'Recheck patient and blood bag identification against her wristband, then send the bag plus fresh blood/urine samples to the blood bank', why: 'A mismatched patient-to-bag identification is the most common root cause of an acute hemolytic reaction — rechecking identification and sending the implicated bag with fresh samples confirms the diagnosis and protects the next patient from the same error.' },
          { id: 'boss-htr-support-bp', label: 'Support her blood pressure with IV fluids while awaiting the blood bank workup', why: 'While the reaction is being confirmed, her circulation still needs active support — fluids (and escalation for possible DIC/renal support if needed) keep her stable through the workup.' },
        ],
        decoys: [
          { id: 'decoy-htr-slow-instead', label: 'Just slow the transfusion rate instead of stopping it completely', why: 'Slowing, not stopping, still delivers more incompatible blood — the transfusion must be stopped completely and immediately, not merely reduced.' },
          { id: 'decoy-htr-paracetamol-continue-boss', label: 'Give paracetamol for the fever and continue the same unit once she feels better', why: 'The implicated unit must never be resumed once a hemolytic reaction is suspected — symptom relief does not change that the transfusion itself is the ongoing source of harm.' },
          { id: 'decoy-htr-same-tubing-flush-boss', label: 'Flush the same tubing that carried the blood with saline to keep the line open', why: 'Flushing the original tubing pushes residual incompatible blood into her circulation — a completely new line and tubing must be used, never the one that delivered the reacting unit.' },
        ],
      },
    ],
    debriefWin: 'You ran the hemolytic transfusion reaction ladder correctly: stopped the transfusion at the very first symptom, kept access open with fresh saline through new tubing (never the old line), rechecked patient-and-bag identification and sent everything to the blood bank, and supported her circulation while escalating for possible DIC. That is exactly the sequence that turns a transfusion error into a survivable event instead of a fatal one.',
    debriefLoss: 'Acute hemolytic transfusion reactions kill through continued exposure — every extra minute the incompatible blood keeps running deepens the hemolysis and the shock. Losing her here does not mean you missed the warning signs; it means the reflex is now automatic: stop the transfusion, new line and new tubing, recheck identification, and send the bag to the blood bank, every single time.',
    examTip: 'NORCET tests the very first step of a transfusion reaction above all else: STOP the transfusion immediately at the first new symptom, keep the vein open with normal saline through NEW tubing (never the old line), then recheck patient/bag identification and notify the blood bank — slowing the rate or "waiting to see" is always the wrong answer.',
  },
];

export default SCENARIOS_B3;
