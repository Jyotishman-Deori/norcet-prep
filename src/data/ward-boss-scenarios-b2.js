// =====================================================================
// src/data/ward-boss-scenarios-b2.js — WAVE B2 seed content for "Ward Boss",
// a 4-phase patient-deterioration simulation game (NORCET clinical judgement
// drill). All medical content is OWNER-REVIEWED (nurse educator) before ship;
// see the "clinical judgment calls for owner review" note in the task summary
// for anything that needs a second look.
//
// Same schema as src/data/ward-boss-scenarios.js — see that file's header
// comment for the full shape reference. This wave adds 5 harder (difficulty
// 2-3) scenarios: Raised ICP, Eclampsia, Malignant Hyperthermia, Pericardial
// Tamponade, Thyroid Storm.
//
// ecgId, when present, MUST be one of the ids exported from ecg-rhythms.js.
// This wave uses 'sbrad' (Cushing's-triad bradycardia) and 'stach' (thyroid
// storm tachycardia) where the rhythm genuinely fits; omitted elsewhere.
// =====================================================================

export const SCENARIOS_B2 = [
  // ---------------------------------------------------------------------
  // 1. RAISED ICP / CUSHING'S TRIAD
  // ---------------------------------------------------------------------
  {
    id: 'raised-icp',
    title: 'The Widening Pupil',
    category: 'Neuro',
    difficulty: 3,
    patient: { name: 'Vikram Singh', age: 34, sex: 'M', history: 'Fall from a two-storey scaffold six hours ago, head trauma, no loss of consciousness on arrival' },
    intro: 'Neuro ICU, night shift. Vikram was talking to you an hour ago. Now he says his headache is "the worst of his life" and his eyes look glassy. Something is building pressure behind that skull, and it is not slowing down.',
    vitalsStart: { hr: 88, sbp: 138, dbp: 84, spo2: 97, rr: 16, temp: 37.0 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Severe headache, glassy eyes, and he is slower to answer than he was an hour ago. This is a fresh head injury — a full neuro check comes before anything else.',
        vitals: { hr: 86, sbp: 142, dbp: 86, spo2: 97, rr: 16, temp: 37.0 },
        actions: [
          { id: 'icp-s-gcs', cat: 'assess', kind: 'key', label: 'Perform a full Glasgow Coma Scale and pupil check', log: 'GCS 14 (down from 15 on admission) — he is slow to open his eyes to voice. Pupils equal and reactive for now, but you note the baseline for comparison.' },
          { id: 'icp-s-hob30', cat: 'intervene', kind: 'key', label: 'Elevate the head of the bed to 30 degrees, head midline', log: 'Bed raised to 30 degrees with the neck kept neutral. This promotes venous drainage from the head without dropping cerebral perfusion.' },
          { id: 'icp-s-dim-only', cat: 'intervene', kind: 'neutral', label: 'Just dim the room lights and reassess later', why: 'A quiet, dim room is genuinely soothing for a head-injury headache, but it is not a substitute for a structured neuro assessment right now — GCS and pupils must be checked and trended, not assumed stable.' },
          { id: 'icp-s-flat-comfort', cat: 'intervene', kind: 'harm', label: 'Lay him completely flat "for comfort"', why: 'A flat position raises intracranial pressure by impairing venous outflow from the head. Head trauma with a worsening exam needs the head of the bed UP around 30 degrees, not flat.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'He has vomited without warning — no nausea first, just projectile vomiting. His left pupil is now sluggish to light. The pressure inside his skull is climbing.',
        vitals: { hr: 82, sbp: 148, dbp: 90, spo2: 96, rr: 15, temp: 37.1 },
        actions: [
          { id: 'icp-c-pupils', cat: 'assess', kind: 'key', label: 'Recheck pupils and document the sluggish left pupil immediately', log: 'Left pupil 5mm and sluggish versus right pupil 3mm and brisk — a new asymmetry. This is charted with the exact time for the neurosurgical team.' },
          { id: 'icp-c-notify-neurosurgery', cat: 'communicate', kind: 'key', label: 'Notify the neurosurgeon now with the new pupil finding', log: 'Neurosurgeon notified. "A new sluggish pupil after trauma is herniation until proven otherwise — get a stat CT head moving and keep me updated on vitals."' },
          { id: 'icp-c-antiemetic-only', cat: 'intervene', kind: 'neutral', label: 'Give an antiemetic and chart the vomiting as a routine post-trauma symptom', why: 'Projectile vomiting without preceding nausea, paired with a new pupil change, is a red-flag sign of rising ICP — treating it as routine and moving on misses the herniation warning this pairing represents.' },
          { id: 'icp-c-hypotonic-fluids', cat: 'intervene', kind: 'harm', label: 'Hang a hypotonic (0.45%) IV fluid to keep him "gently hydrated"', why: 'Hypotonic fluids shift free water into the brain tissue and worsen cerebral edema — a head-injury patient at risk of raised ICP needs isotonic or hypertonic fluids, never hypotonic ones.', stability: 20 },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'His blood pressure is climbing while his heart rate is dropping, and his breathing has gone irregular. This is Cushing\'s triad — the brain is herniating and fighting to keep itself perfused.',
        vitals: { hr: 52, sbp: 188, dbp: 108, spo2: 94, rr: 10, temp: 37.3 },
        actions: [
          { id: 'icp-ch-recognise-cushing', cat: 'assess', kind: 'key', label: 'Recognise Cushing\'s triad and call it out to the team by name', log: 'Rising BP, falling HR, irregular respirations — Cushing\'s triad called out loud. The team mobilises immediately for herniation, no further discussion needed.' },
          { id: 'icp-ch-prep-airway', cat: 'intervene', kind: 'key', label: 'Prepare emergency airway equipment for probable intubation', log: 'Intubation tray, bag-valve-mask, and suction all at the bedside — the airway team is ready to secure his breathing the moment the order comes.' },
          { id: 'icp-ch-treat-hr-bp-separately', cat: 'intervene', kind: 'harm', label: 'Give an antihypertensive to lower the BP and atropine to raise the HR, treating each vital separately', why: 'Cushing\'s triad is the brain\'s own protective reflex, driving BP up to keep perfusing itself against the rising pressure. Treating the blood pressure or heart rate as isolated numbers ignores the cause and can drop cerebral perfusion pressure at the worst possible moment — the pressure itself must be treated, not the reflex.', stability: 25 },
          { id: 'icp-ch-strict-fluid-restrict', cat: 'communicate', kind: 'neutral', label: 'Focus only on strict fluid restriction and defer other action', why: 'Careful fluid management matters in raised ICP, but with Cushing\'s triad now present this is an active herniation emergency — airway preparation and stat escalation cannot wait on a fluid-chart conversation alone.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Brain Herniation',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Cushing\'s triad is in full swing and his pupil is now fixed. The pressure inside his skull is about to crush his brainstem. You have minutes to buy him time to the OR.',
        ecgId: 'sbrad',
        vitals: { hr: 46, sbp: 196, dbp: 112, spo2: 92, rr: 8, temp: 37.4 },
        sequence: [
          { id: 'boss-icp-mannitol', label: 'Push IV Mannitol (osmotic diuretic)', why: 'Mannitol pulls free water out of the brain tissue and into the vasculature, rapidly shrinking cerebral edema and buying time against herniation — it is the first drug reached for in an acute ICP crisis.' },
          { id: 'boss-icp-hyperventilate', label: 'Hyperventilate via BVM to lower CO2', why: 'Controlled hyperventilation lowers carbon dioxide, which constricts cerebral vessels and reduces intracranial blood volume — a fast, temporary bridge to buy minutes while mannitol takes effect and transport is arranged.' },
          { id: 'boss-icp-transport-or', label: 'Transport immediately to the OR for emergency decompression', why: 'Medical measures like mannitol and hyperventilation only buy time — a fixed, dilated pupil from herniation needs surgical decompression to actually relieve the pressure, and that only happens in the OR.' },
        ],
        decoys: [
          { id: 'decoy-icp-flat-position', label: 'Lay him flat to improve blood flow to the brain', why: 'A flat position raises intracranial pressure by impairing venous drainage from the head — this is the opposite of what a herniating brain needs. Head-up 30 degrees, midline, is correct, never flat.' },
          { id: 'decoy-icp-hypotonic-bolus', label: 'Push a bolus of hypotonic IV fluid to "flush the system"', why: 'Hypotonic fluid draws water into brain tissue and directly worsens cerebral edema — the exact opposite of the osmotic pull mannitol provides. This would accelerate herniation, not treat it.' },
          { id: 'decoy-icp-sedate-only', label: 'Give a heavy sedative and wait to see if the pupil recovers on its own', why: 'A fixed pupil from brain herniation is a true surgical emergency — sedating and waiting wastes the only window that could save brainstem function. Mannitol, hyperventilation, and OR transport cannot be delayed for a "wait and watch."' },
        ],
      },
    ],
    debriefWin: 'You caught the herniation cascade at every stage: a structured GCS and pupil baseline, escalating fast the moment the pupil turned sluggish, naming Cushing\'s triad out loud instead of treating its numbers in isolation, and then the correct rescue order — mannitol to pull water out, hyperventilation to buy minutes, and straight to the OR for the only definitive fix. That is exactly how a herniating brain gets a second chance.',
    debriefLoss: 'Raised ICP kills through a single misread reflex — Cushing\'s triad looks like it needs a blood-pressure pill and a pacemaker, but it is the brain fighting to keep itself alive against crushing pressure. Losing him here does not mean you missed something rare; it means you now recognise that triad instantly, and the ladder that answers it: head up, mannitol, hyperventilate, OR.',
    examTip: 'NORCET tests Cushing\'s triad (rising BP, falling HR, irregular respirations) as a herniation emergency, NOT three vitals to treat separately. Also expect: head of bed 30 degrees midline (never flat) for raised ICP, hypotonic fluids are contraindicated (worsen cerebral edema), and mannitol is the first-line osmotic agent to reduce ICP.',
  },

  // ---------------------------------------------------------------------
  // 2. ECLAMPSIA
  // ---------------------------------------------------------------------
  {
    id: 'eclampsia',
    title: 'The Flashing Lights',
    category: 'OB & Neonatal',
    difficulty: 3,
    patient: { name: 'Sunita Devi', age: 26, sex: 'F', history: '36 weeks gestation, G1P0, no prior history of hypertension' },
    intro: 'Antenatal ward. Sunita mentions a dull headache "that won\'t go away" at her routine check. She is 36 weeks along and this is her first pregnancy. Her blood pressure cuff reading makes you look twice.',
    vitalsStart: { hr: 88, sbp: 150, dbp: 95, spo2: 98, rr: 18, temp: 36.9 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'BP 150/95 with a new headache at 36 weeks is not "just pregnancy tiredness" — this is pre-eclampsia until proven otherwise. Check the urine before you do anything else.',
        vitals: { hr: 90, sbp: 152, dbp: 96, spo2: 98, rr: 18, temp: 36.9 },
        actions: [
          { id: 'ecl-s-urine-protein', cat: 'assess', kind: 'key', label: 'Check a urine dipstick for protein', log: 'Dipstick shows 2+ protein — significant proteinuria alongside the new hypertension. This meets criteria for pre-eclampsia, not simple gestational hypertension.' },
          { id: 'ecl-s-fetal-monitor', cat: 'assess', kind: 'key', label: 'Apply continuous fetal heart rate monitoring', log: 'Fetal heart rate 142, reactive pattern with good variability — reassuring for now, and a baseline you will need as things evolve.' },
          { id: 'ecl-s-bright-room', cat: 'intervene', kind: 'neutral', label: 'Leave the room lighting and noise as normal for now', why: 'A patient trending toward pre-eclampsia benefits from a calm, low-stimulation environment, since noise and bright light can aggravate the irritable nervous system that drives seizure risk — this is a missed early comfort and safety measure, not a harmful one.' },
          { id: 'ecl-s-diazepam-first', cat: 'intervene', kind: 'harm', label: 'Give IV diazepam now "just in case she seizes"', why: 'Benzodiazepines are not the drug of choice for pre-eclampsia/eclampsia seizure prophylaxis or treatment, and giving one pre-emptively with no seizure and no magnesium level established sedates her without addressing the actual disease process. Magnesium sulfate is the specific agent, given when indicated — not diazepam.', stability: 20 },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'She says she is seeing "flashing lights" at the edges of her vision, and her pressure has climbed further. This is severe pre-eclampsia now — the brain is showing you it is under strain.',
        vitals: { hr: 96, sbp: 172, dbp: 111, spo2: 97, rr: 20, temp: 36.9 },
        actions: [
          { id: 'ecl-c-seizure-precautions', cat: 'intervene', kind: 'key', label: 'Implement seizure precautions: padded rails, suction and oxygen at bedside, quiet dim room', log: 'Bed rails padded, suction and oxygen set up within reach, room lights dimmed and door closed. Everything is ready if a seizure comes.' },
          { id: 'ecl-c-notify-ob', cat: 'communicate', kind: 'key', label: 'Notify the obstetric team of severe features (BP 170/110, visual symptoms)', log: 'Obstetrician notified. "That is severe pre-eclampsia with visual symptoms — start preparing magnesium sulfate, I am coming to assess her now."' },
          { id: 'ecl-c-single-agent-labetalol', cat: 'intervene', kind: 'harm', label: 'Start IV labetalol as the only treatment and skip magnesium prophylaxis', why: 'BP control matters, but labetalol alone does nothing to prevent the seizure risk that visual symptoms and severe hypertension signal. Magnesium sulfate is the specific agent for seizure prophylaxis in severe pre-eclampsia and cannot be skipped or substituted by an antihypertensive alone.' },
          { id: 'ecl-c-reassure-only', cat: 'communicate', kind: 'neutral', label: 'Reassure her the flashing lights are "just tiredness"', why: 'Scotomata (visual disturbances) at this blood pressure is a severe feature of pre-eclampsia, not a benign symptom to explain away — it needs to be acted on with escalation and seizure precautions, not minimised.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Her reflexes are markedly brisk and her ankle is showing clonus when you check it. This is the last warning sign before a seizure — get ready and get the team moving.',
        vitals: { hr: 100, sbp: 178, dbp: 114, spo2: 97, rr: 22, temp: 36.9 },
        actions: [
          { id: 'ecl-ch-document-reflexes', cat: 'assess', kind: 'key', label: 'Document 4+ hyperreflexia and sustained clonus, and reassess frequently', log: '4+ deep tendon reflexes with sustained clonus documented and timed. This is charted as an escalating neurological picture, checked again every few minutes.' },
          { id: 'ecl-ch-notify-nicu', cat: 'communicate', kind: 'key', label: 'Notify NICU and prepare for possible emergency delivery', log: 'NICU team notified and on standby. "We will be ready the moment obstetrics calls it — keep us posted on maternal status."' },
          { id: 'ecl-ch-ignore-reflexes', cat: 'assess', kind: 'harm', label: 'Note the reflexes but wait for the next scheduled check to reassess', why: '4+ hyperreflexia with sustained clonus is the immediate precursor to an eclamptic seizure — this needs continuous reassessment and readiness right now, not deferral to a routine schedule.', stability: 20 },
          { id: 'ecl-ch-ambulate', cat: 'intervene', kind: 'neutral', label: 'Encourage her to walk to the bathroom to "move around"', why: 'A patient with hyperreflexia and clonus this advanced is at imminent seizure risk — she should not be mobilising unsupervised right now. Bed rest with continuous monitoring is the priority.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Grand Mal Seizure',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'She has begun seizing. Protect her, stop the seizure at its source, and get her toward delivery — in the right order.',
        vitals: { hr: 110, sbp: 184, dbp: 118, spo2: 90, rr: 26, temp: 37.0 },
        sequence: [
          { id: 'boss-ecl-left-lateral', label: 'Turn her to the left lateral position immediately', why: 'Left lateral positioning during a seizure protects the airway from aspiration and relieves aortocaval compression from the gravid uterus, improving both maternal and fetal blood flow — this comes first, before any drug.' },
          { id: 'boss-ecl-mgso4', label: 'Push IV Magnesium Sulfate per protocol (loading dose)', why: 'Magnesium sulfate is the definitive drug for eclamptic seizures — it both treats the active seizure and prevents further ones, and is the specific agent of choice over any other anticonvulsant in pregnancy.' },
          { id: 'boss-ecl-prep-csection', label: 'Prepare for emergency Cesarean section', why: 'Once the mother is stabilised with magnesium and positioning, delivery is the definitive cure for eclampsia — the placenta is the source of the disease process, so the team moves toward emergency delivery once she is safe to move.' },
        ],
        decoys: [
          { id: 'decoy-ecl-diazepam-first', label: 'Give IV diazepam as the first-line anticonvulsant', why: 'Magnesium sulfate, not diazepam or phenytoin, is the guideline first-line agent for eclamptic seizures — it has proven superior outcomes for both stopping the seizure and preventing recurrence.' },
          { id: 'decoy-ecl-supine', label: 'Keep her supine and restrain her limbs during the seizure', why: 'Supine positioning during a seizure risks aspiration and worsens aortocaval compression, dropping both maternal cardiac output and fetal perfusion — left lateral is correct, and limbs should be protected from injury, not restrained.' },
          { id: 'decoy-ecl-rush-csection-first', label: 'Rush straight to Cesarean section before controlling the seizure', why: 'An actively seizing, hemodynamically unstable mother must be stabilised with magnesium sulfate and positioning first — operating on an unstabilised patient risks losing both mother and baby. Stabilise, then deliver.' },
        ],
      },
    ],
    debriefWin: 'You ran the eclampsia ladder in the order that saves lives: proteinuria and fetal monitoring to confirm severity, seizure precautions and magnesium readiness the moment visual symptoms appeared, hyperreflexia and clonus taken seriously as the final warning — and when the seizure came, left lateral positioning, magnesium sulfate, then preparation for delivery. That sequence protects both mother and baby.',
    debriefLoss: 'Eclampsia moves from headache to seizure faster than it looks, and the warning signs (visual symptoms, hyperreflexia, clonus) are easy to explain away as "just pregnancy." Losing her here does not mean you missed something obvious; it means you now know the specific drug is magnesium sulfate, not diazepam, and the position is left lateral, not supine — cold, for the rest of your career.',
    examTip: 'NORCET tests eclampsia hard: magnesium sulfate is the ONLY first-line anticonvulsant (not diazepam or phenytoin), left lateral positioning during a seizure (never supine), and delivery is the definitive cure once the mother is stabilised — 4+ hyperreflexia with clonus is a severe feature that precedes seizure.',
  },

  // ---------------------------------------------------------------------
  // 3. MALIGNANT HYPERTHERMIA
  // ---------------------------------------------------------------------
  {
    id: 'malignant-hyperthermia',
    title: 'The Locked Jaw',
    category: 'Shock, Tox & Transfusion',
    difficulty: 3,
    patient: { name: 'Anil Kapoor', age: 29, sex: 'M', history: 'Post-op day 0, appendectomy under general anesthesia (volatile agent), no prior surgical history, family history of an "anesthesia problem" in an uncle (per his mother)' },
    intro: 'PACU, recovery bay 3. Anil came out of his appendectomy an hour ago and seemed fine. Now his heart rate is quietly creeping upward on the monitor, and something about him looks wrong in a way you cannot yet name.',
    vitalsStart: { hr: 98, sbp: 128, dbp: 80, spo2: 97, rr: 18, temp: 37.4 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'His heart rate keeps climbing for no obvious reason and he seems restless. Post-op tachycardia has plenty of ordinary causes, but this needs a proper look before you assume pain.',
        vitals: { hr: 110, sbp: 132, dbp: 82, spo2: 97, rr: 20, temp: 37.7 },
        actions: [
          { id: 'mh-s-full-vitals', cat: 'assess', kind: 'key', label: 'Take a full set of vitals including temperature', log: 'Temp 37.7°C, climbing from the baseline. HR 110 and rising, with no obvious source of pain or bleeding on exam.' },
          { id: 'mh-s-pain-check', cat: 'assess', kind: 'key', label: 'Assess his pain level and surgical site directly', log: 'Pain scored 3/10, surgical dressing dry and intact — the tachycardia is not explained by pain or bleeding. Something else is driving this.' },
          { id: 'mh-s-assume-pain', cat: 'intervene', kind: 'harm', label: 'Assume it is post-op pain and give the standard PRN opioid without further assessment', why: 'Treating rising HR as pain without checking the surgical site or temperature risks missing an evolving hypermetabolic crisis. A rising heart rate this early after a volatile-anesthetic case deserves a full assessment, not an automatic pain-protocol response.' },
          { id: 'mh-s-recheck-later', cat: 'assess', kind: 'neutral', label: 'Plan to recheck vitals at the next scheduled interval', why: 'An unexplained, climbing heart rate in early PACU recovery needs closer, more frequent monitoring right now — not a wait for the routine interval, especially given his family history flag.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'His jaw has suddenly locked rigid — masseter muscle spasm, out of nowhere. His end-tidal CO2 is climbing fast on the monitor. This is not ordinary post-op recovery.',
        vitals: { hr: 128, sbp: 138, dbp: 88, spo2: 95, rr: 26, temp: 38.4 },
        actions: [
          { id: 'mh-c-etco2', cat: 'assess', kind: 'key', label: 'Check end-tidal CO2 on the monitor', log: 'ETCO2 rising rapidly, well above expected — the body is producing carbon dioxide far faster than normal metabolism explains. This is a hypermetabolic state.' },
          { id: 'mh-c-notify-anesthesia', cat: 'communicate', kind: 'key', label: 'Notify anesthesia immediately: masseter rigidity plus rising ETCO2', why: undefined, log: 'Anesthesia provider notified and at bedside within moments. "Masseter rigidity and rising ETCO2 after a volatile agent — that is malignant hyperthermia until proven otherwise. Call for the MH cart now."' },
          { id: 'mh-c-force-jaw', cat: 'intervene', kind: 'harm', label: 'Try to manually force the jaw open to check the airway', why: 'Masseter rigidity is a muscular symptom of the underlying hypermetabolic crisis, not a mechanical airway obstruction to force open — forcing the jaw risks injury and does nothing to address the actual cause. Recognise the sign and escalate instead.', stability: 20 },
          { id: 'mh-c-ice-only', cat: 'intervene', kind: 'neutral', label: 'Apply a single ice pack to the forehead and wait to see if it helps', why: 'Cooling has a real role later in the protocol, but one ice pack in isolation does nothing against a hypermetabolic crisis this early — the priority right now is recognising the pattern and getting anesthesia and the MH cart moving.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'His temperature has spiked to 41°C and his blood gas shows severe metabolic acidosis. His muscles are breaking down in front of you. This is a full hypermetabolic crisis.',
        vitals: { hr: 148, sbp: 96, dbp: 56, spo2: 90, rr: 34, temp: 41.0 },
        actions: [
          { id: 'mh-ch-mh-cart', cat: 'communicate', kind: 'key', label: 'Call for the Malignant Hyperthermia cart STAT', log: 'MH cart arrives at bedside — dantrolene, cooling supplies, and the treatment protocol card all present and ready.' },
          { id: 'mh-ch-active-cooling', cat: 'intervene', kind: 'key', label: 'Begin active cooling: ice packs to groin and axillae, cooled IV fluids', log: 'Ice packs placed at the groin and axillae, cooled IV fluids running. Core temperature begins to trend down, though slowly.' },
          { id: 'mh-ch-paracetamol', cat: 'intervene', kind: 'harm', label: 'Give IV paracetamol to bring the fever down', why: 'This fever is not from a pyrogen that antipyretics act on — it is generated by uncontrolled muscle metabolism. Paracetamol does nothing for a malignant hyperthermia crisis; the temperature only comes down by stopping the trigger and active cooling, with dantrolene as the definitive treatment.', stability: 22 },
          { id: 'mh-ch-single-recheck', cat: 'assess', kind: 'neutral', label: 'Take one more temperature reading and step back to reassess the plan', why: 'This is a rapidly escalating hypermetabolic crisis with severe acidosis already present — continuous action is needed now, not a pause to "reassess the plan" while the muscles keep breaking down.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Hypermetabolic Crisis',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'His muscles are cooking from the inside. There is one drug that stops this, but the trigger has to be removed first — in the right order.',
        vitals: { hr: 156, sbp: 88, dbp: 50, spo2: 88, rr: 36, temp: 41.6 },
        sequence: [
          { id: 'boss-mh-stop-anesthetic', label: 'Discontinue all volatile anesthetic agents immediately', why: 'The volatile anesthetic is the ongoing trigger driving the hypermetabolic reaction — nothing else works while the trigger is still being administered, so it must be stopped first, before any drug or cooling measure.' },
          { id: 'boss-mh-dantrolene', label: 'Push IV Dantrolene per weight-based protocol', why: 'Dantrolene is the specific antidote for malignant hyperthermia — it stops the runaway calcium release inside muscle cells that is driving the rigidity, heat, and acidosis. It is given as soon as the trigger is removed, repeated until symptoms resolve.' },
          { id: 'boss-mh-hyperventilate-o2', label: 'Hyperventilate with 100% oxygen', why: 'Hyperventilating on 100% oxygen helps blow off the massive CO2 load being produced by the hypermetabolic muscle activity and maximises oxygen delivery while dantrolene takes effect — supportive but essential alongside the antidote.' },
        ],
        decoys: [
          { id: 'decoy-mh-paracetamol-fever', label: 'Give IV paracetamol as the priority to control the fever', why: 'This temperature spike comes from runaway muscle metabolism, not a pyrogen-mediated fever — paracetamol has no effect on the actual process. Stopping the trigger and giving dantrolene are what bring the temperature down.' },
          { id: 'decoy-mh-continue-anesthetic', label: 'Keep the volatile anesthetic running and just add dantrolene on top', why: 'Dantrolene cannot outpace an ongoing trigger — the volatile agent must be discontinued completely first, or the hypermetabolic reaction keeps being fed faster than dantrolene can shut it down.' },
          { id: 'decoy-mh-succinylcholine', label: 'Give succinylcholine to relax the rigid jaw muscle', why: 'Succinylcholine is itself a malignant hyperthermia trigger agent and can dramatically worsen the crisis — it is the opposite of what this patient needs. Dantrolene, not another triggering drug, relaxes the muscle safely here.' },
        ],
      },
    ],
    debriefWin: 'You caught malignant hyperthermia before it became a fatal cascade: a full vitals check instead of assuming pain, recognising masseter rigidity with rising ETCO2 as a pattern rather than an isolated oddity, calling for the MH cart and active cooling early, and then the exact rescue sequence — stop the volatile trigger, push dantrolene, hyperventilate on 100% oxygen. That is the only combination that reverses a hypermetabolic crisis.',
    debriefLoss: 'Malignant hyperthermia kills through misattribution — a climbing heart rate reads as pain, a locked jaw reads as anxiety, a fever reads as infection, until the muscles have broken down too far to save. Losing him here does not mean you were careless; it means the pattern (masseter rigidity plus rising ETCO2 after a volatile agent) is now unmistakable to you, and so is the fix: stop the trigger, dantrolene, hyperventilate.',
    examTip: 'NORCET tests malignant hyperthermia as a triggered hypermetabolic crisis: masseter rigidity and rising ETCO2 are the earliest red flags after a volatile anesthetic or succinylcholine, dantrolene is the specific antidote, and the anesthetic trigger MUST be stopped first — antipyretics like paracetamol have no role since the fever is not pyrogen-mediated.',
  },

  // ---------------------------------------------------------------------
  // 4. PERICARDIAL TAMPONADE
  // ---------------------------------------------------------------------
  {
    id: 'pericardial-tamponade',
    title: 'The Silence After the Bleeding',
    category: 'Cardiac',
    difficulty: 3,
    patient: { name: 'Harbhajan Sandhu', age: 58, sex: 'M', history: 'Post-op day 1, coronary artery bypass graft (CABG) surgery, chest tubes in place for mediastinal drainage' },
    intro: 'Cardiothoracic ICU. Harbhajan\'s chest tube had been draining a steady, expected amount all night. On this round, you notice the collection chamber has not moved in the last hour. The silence in that tube is the loudest thing in the room.',
    vitalsStart: { hr: 96, sbp: 118, dbp: 74, spo2: 96, rr: 18, temp: 37.1 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'The chest tube drainage that was steady all night has suddenly stopped. A sudden stop after a cardiac surgery is not good news — it can mean the tube is clotted, or it can mean blood is pooling somewhere it should not be.',
        vitals: { hr: 100, sbp: 114, dbp: 72, spo2: 96, rr: 19, temp: 37.1 },
        actions: [
          { id: 'tamp-s-milk-tube', cat: 'intervene', kind: 'key', label: 'Gently milk the chest tube to check for a clot', log: 'Tube milked per protocol. No clot dislodges and drainage does not resume — the tube itself is not simply blocked by a clot.' },
          { id: 'tamp-s-heart-sounds', cat: 'assess', kind: 'key', label: 'Auscultate heart sounds carefully', log: 'Heart sounds are present but noticeably softer than they were on the last shift\'s notes — a subtle but real change worth flagging.' },
          { id: 'tamp-s-assume-resolved', cat: 'communicate', kind: 'harm', label: 'Chart the drainage stop as "resolved" and move to the next patient', why: 'A sudden cessation of chest tube drainage after cardiac surgery, especially paired with softer heart sounds, is a classic early warning for tamponade — blood may be pooling in the pericardial sac instead of draining out. This needs continued vigilance, not a "resolved" note.', stability: 20 },
          { id: 'tamp-s-wait-shift-change', cat: 'assess', kind: 'neutral', label: 'Make a note to reassess at the next shift change', why: 'Post-CABG chest tube drainage stopping suddenly needs reassessment within the hour, not deferred to the next shift — pericardial blood can accumulate and compress the heart in a short window of time.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'Heart sounds are now distinctly muffled and his heart rate keeps climbing. Something is compressing that heart from the outside, and it is getting worse.',
        vitals: { hr: 112, sbp: 104, dbp: 68, spo2: 95, rr: 21, temp: 37.0 },
        actions: [
          { id: 'tamp-c-bp-check', cat: 'assess', kind: 'key', label: 'Recheck blood pressure and compare to trend', log: 'BP trending down from this morning\'s baseline, with a narrowing gap between systolic and diastolic — this trend is more concerning than any single reading.' },
          { id: 'tamp-c-stat-echo', cat: 'communicate', kind: 'key', label: 'Order a stat bedside echocardiogram', log: 'Echo team paged stat. "On our way — muffled heart sounds plus stopped chest tube drainage post-CABG is tamponade until we prove otherwise."' },
          { id: 'tamp-c-diuretics', cat: 'intervene', kind: 'harm', label: 'Give IV furosemide (Lasix) to "offload" the heart', why: 'Diuretics reduce circulating volume and preload — exactly what a tamponade patient cannot afford to lose, since a compressed heart depends on adequate preload to maintain any cardiac output. This can precipitate sudden collapse.', stability: 22 },
          { id: 'tamp-c-defer-echo', cat: 'assess', kind: 'neutral', label: 'Defer the echocardiogram until the morning cardiology round', why: 'Muffled heart sounds with stopped drainage after cardiac surgery is an evolving emergency — the echo needs to happen now to confirm or rule out tamponade, not hours from now.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'Muffled heart sounds, distended neck veins, and a falling blood pressure — Beck\'s triad is complete. His pulse pressure is narrowing with every reading. The heart is being crushed from the outside.',
        vitals: { hr: 130, sbp: 88, dbp: 70, spo2: 92, rr: 26, temp: 36.9 },
        actions: [
          { id: 'tamp-ch-name-becks-triad', cat: 'assess', kind: 'key', label: 'Identify and document Beck\'s triad: muffled heart sounds, JVD, hypotension', log: 'Beck\'s triad confirmed and documented with the exact time — muffled sounds, distended neck veins, falling pressure with a narrowing pulse pressure. This is textbook tamponade and the team is told exactly that.' },
          { id: 'tamp-ch-call-cts', cat: 'communicate', kind: 'key', label: 'Call the cardiothoracic surgeon STAT', log: 'Cardiothoracic surgeon paged STAT and responding. "Get the pericardiocentesis tray ready — I am on my way, do not give diuretics or push fluids out."' },
          { id: 'tamp-ch-aggressive-diuresis', cat: 'intervene', kind: 'harm', label: 'Start aggressive diuresis to reduce the fluid pressing on the heart', why: 'The fluid compressing this heart is in the pericardial sac, not the circulating blood volume — diuresis does not touch the actual problem and instead strips away the preload the compressed heart desperately needs to keep pumping.', stability: 25 },
          { id: 'tamp-ch-observe-only', cat: 'assess', kind: 'neutral', label: 'Continue close observation without escalating further yet', why: 'A complete Beck\'s triad with a narrowing pulse pressure is a surgical emergency in progress — this needs the cardiothoracic team activated now, not more watching while the heart is compressed further.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Obstructive Arrest',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'The pulse pressure has nearly closed and his pressure is crashing. Blood is crushing his heart from the outside and only draining it will save him now.',
        vitals: { hr: 142, sbp: 76, dbp: 66, spo2: 89, rr: 30, temp: 36.8 },
        sequence: [
          { id: 'boss-tamp-prep-pericardiocentesis', label: 'Prepare the pericardiocentesis tray at the bedside', why: 'Everything needed for emergency needle drainage of the pericardial sac must be immediately at hand before the procedure starts — this is the first step that turns "diagnosed" into "treated."' },
          { id: 'boss-tamp-assist-aspiration', label: 'Assist with needle aspiration of the pericardial sac', why: 'Removing even a small volume of blood from the pericardial sac can dramatically relieve the pressure crushing the heart and restore cardiac output almost immediately — this is the definitive emergency treatment for tamponade.' },
          { id: 'boss-tamp-return-or', label: 'Return the patient to the OR for definitive surgical management', why: 'Needle aspiration buys time and can be life-saving at the bedside, but a post-CABG bleed causing tamponade needs the surgical source controlled in the OR — pericardiocentesis is the bridge, not the final answer.' },
        ],
        decoys: [
          { id: 'decoy-tamp-diuretics-again', label: 'Give another dose of IV furosemide to try to relieve the pressure', why: 'Diuretics do nothing to the pericardial fluid causing the compression and instead deplete the preload keeping this heart pumping at all — this is the wrong mechanism entirely for obstructive shock.' },
          { id: 'decoy-tamp-cpr-immediately', label: 'Start chest compressions immediately without draining the pericardium', why: 'Compressions on a heart being externally compressed by pericardial blood are largely ineffective until the tamponade itself is relieved — needle aspiration to remove the obstructing fluid is the priority intervention, not compressions in isolation.' },
          { id: 'decoy-tamp-fluid-only', label: 'Give a large volume fluid bolus and reassess in 30 minutes', why: 'A fluid bolus can offer brief, partial support by boosting preload, but it does not fix the underlying obstruction and 30 minutes is far too long to wait with a nearly-closed pulse pressure — pericardiocentesis cannot be delayed for a fluid trial.' },
        ],
      },
    ],
    debriefWin: 'You read the silence correctly: a chest tube that suddenly stops draining after cardiac surgery is never "good news," and you tracked it through softening heart sounds, a narrowing pulse pressure, and the complete Beck\'s triad without ever reaching for a diuretic. The rescue sequence — pericardiocentesis tray, needle aspiration, back to the OR — is exactly what relieves a heart being crushed from outside.',
    debriefLoss: 'Pericardial tamponade kills through a trap that looks like good news — the bleeding "stopping" is often blood pooling where you cannot see it instead of draining where you can. Losing him here does not mean you were careless; it means you will never again read a silent chest tube as reassuring, and you now carry the fix: pericardiocentesis first, OR after.',
    examTip: 'NORCET tests Beck\'s triad (muffled heart sounds, jugular venous distention, hypotension) plus a narrowing pulse pressure as the signature of cardiac tamponade. Diuretics and aggressive fluid removal are contraindicated — they strip preload from a heart that depends on it. Pericardiocentesis is the emergency bedside treatment; a sudden stop in post-cardiac-surgery chest tube drainage is a critical warning sign, not a reassuring one.',
  },

  // ---------------------------------------------------------------------
  // 5. THYROID STORM
  // ---------------------------------------------------------------------
  {
    id: 'thyroid-storm',
    title: 'The Racing Engine',
    category: 'Endocrine & Metabolic',
    difficulty: 3,
    patient: { name: 'Meena Reddy', age: 41, sex: 'F', history: 'Graves\' disease diagnosed three years ago, admitted for an unrelated gallbladder infection, medication-noncompliant for several weeks' },
    intro: 'Medical ward. Meena has Graves\' disease and has not been taking her thyroid medication regularly. Now, in the middle of treatment for a separate infection, she is restless, sweaty, and cannot sit still in the bed. Her body is running like an engine with no governor.',
    vitalsStart: { hr: 118, sbp: 138, dbp: 82, spo2: 97, rr: 20, temp: 37.8 },
    phases: [
      {
        id: 'simmer',
        label: 'The Simmer',
        turns: 3,
        alarm: 'none',
        brief: 'Restless, sweating, temp 37.8°C in a known Graves\' patient who has not taken her medication in weeks, on top of an active infection — this is the exact setup for a thyroid storm. Confirm it before you treat it.',
        vitals: { hr: 122, sbp: 140, dbp: 84, spo2: 97, rr: 21, temp: 38.0 },
        actions: [
          { id: 'thy-s-thyroid-labs', cat: 'assess', kind: 'key', label: 'Send stat thyroid function labs (free T4, TSH)', log: 'Labs sent stat. You are told to expect a markedly suppressed TSH with a very high free T4, consistent with severe untreated hyperthyroidism.' },
          { id: 'thy-s-cool-environment', cat: 'intervene', kind: 'key', label: 'Provide a cool, calm environment and minimise stimulation', log: 'Room cooled, lights dimmed, unnecessary visitors asked to step out. Her restlessness eases only slightly, but the environment is no longer working against her.' },
          { id: 'thy-s-assume-infection-fever', cat: 'assess', kind: 'neutral', label: 'Attribute the restlessness and fever entirely to her known infection', why: 'An active infection can absolutely be the trigger, but restlessness this pronounced with tachycardia this high in a noncompliant Graves\' patient needs to be worked up as possible thyroid storm in parallel, not explained away by the infection alone.' },
          { id: 'thy-s-warm-blanket', cat: 'intervene', kind: 'harm', label: 'Offer a warm blanket since she looks uncomfortable', why: 'A hypermetabolic, overheating patient needs cooling, not warming — a warm blanket works directly against the goal of reducing her heat production and would worsen her comfort and temperature trend.' },
        ],
      },
      {
        id: 'complication',
        label: 'The Complication',
        turns: 2,
        alarm: 'soft',
        brief: 'Her agitation has become extreme and her temperature and heart rate are both climbing fast. This is escalating quickly — she needs a beta-blocker and active cooling now.',
        vitals: { hr: 140, sbp: 146, dbp: 86, spo2: 96, rr: 24, temp: 39.5 },
        actions: [
          { id: 'thy-c-cooling-blankets', cat: 'intervene', kind: 'key', label: 'Apply active cooling blankets', log: 'Cooling blankets applied. Temperature trend begins to slow its climb, though she remains significantly hyperthermic.' },
          { id: 'thy-c-propranolol', cat: 'intervene', kind: 'key', label: 'Give IV Propranolol (beta-blocker) as ordered', log: 'Propranolol given IV. Heart rate eases somewhat and some of the tremor and agitation settle — beta-blockade is calming the adrenergic surge.', effects: { vitals: { hr: -8 } } },
          { id: 'thy-c-aspirin-fever', cat: 'intervene', kind: 'harm', label: 'Give aspirin for the fever since it usually works well', why: 'Aspirin displaces thyroid hormone from its binding protein, freeing up MORE active hormone into circulation — in thyroid storm this can make the crisis worse, not better. Paracetamol and physical cooling are used instead, never aspirin.', stability: 22 },
          { id: 'thy-c-restrain-only', cat: 'intervene', kind: 'neutral', label: 'Focus on physically restraining her to control the agitation', why: 'Restraint alone does not treat the underlying hypermetabolic crisis driving the agitation, and fighting against restraints can itself raise heart rate and temperature further — beta-blockade and cooling are the actual treatment, with reassurance alongside.' },
        ],
      },
      {
        id: 'chaos',
        label: 'Chaos',
        turns: 2,
        alarm: 'loud',
        decisionSec: 12,
        brief: 'She is now delirious and you hear crackles at both lung bases — her heart is starting to fail under the strain of this hypermetabolic state. This is a full-blown thyroid storm.',
        vitals: { hr: 156, sbp: 128, dbp: 78, spo2: 91, rr: 30, temp: 40.1 },
        actions: [
          { id: 'thy-ch-recognise-storm', cat: 'assess', kind: 'key', label: 'Recognise and call out thyroid storm to the team by name', log: 'Delirium, temp above 40°C, HR 156, and new lung crackles called out as thyroid storm. The team mobilises for the full antithyroid protocol immediately.' },
          { id: 'thy-ch-icu-notify', cat: 'communicate', kind: 'key', label: 'Notify the ICU team and prepare for transfer', log: 'ICU notified and a bed is being prepared. "Get the antithyroid drugs started at the bedside — do not wait for the transfer to begin treatment."' },
          { id: 'thy-ch-fluid-bolus-unrestricted', cat: 'intervene', kind: 'harm', label: 'Give a large unrestricted IV fluid bolus for the tachycardia', why: 'She already has signs of heart failure (crackles at both lung bases) from the strain of the hypermetabolic state — pushing a large fluid bolus on top of a failing heart risks flash pulmonary edema. Careful, cautious fluid management is needed here, not a wide-open bolus.', stability: 22 },
          { id: 'thy-ch-single-vital', cat: 'assess', kind: 'neutral', label: 'Take one more temperature reading and leave the room to chart it', why: 'This is an active, worsening thyroid storm with new heart failure signs — continuous bedside monitoring and rapid treatment are needed now, not a single reading followed by charting elsewhere.' },
        ],
      },
      {
        id: 'boss',
        label: 'Final Boss: Hormone Blockade',
        alarm: 'boss',
        strict: true,
        countdownSec: 25,
        brief: 'Her thyroid gland is flooding her body with hormone and her heart is failing under the load. The order of these drugs is everything — get it wrong, and you feed the storm instead of stopping it.',
        ecgId: 'stach',
        vitals: { hr: 164, sbp: 118, dbp: 72, spo2: 89, rr: 32, temp: 40.6 },
        sequence: [
          { id: 'boss-thy-ptu', label: 'Give PTU (Propylthiouracil) first', why: 'PTU blocks new thyroid hormone synthesis AND blocks peripheral conversion of T4 to the more active T3 — it must be given first, so that the gland is already blocked before iodine arrives, preventing iodine from being used as raw material for a fresh burst of hormone.' },
          { id: 'boss-thy-lugols', label: 'THEN give Lugol\'s iodine solution, only after PTU is on board', why: 'This is the classic ordering trap: iodine given before the antithyroid drug provides the gland with raw material to make a sudden surge of new hormone, worsening the storm. Given only after PTU has blocked synthesis, iodine instead blocks the release of hormone already stored in the gland.' },
          { id: 'boss-thy-hydrocortisone', label: 'Give IV Hydrocortisone', why: 'Stress-dose steroids blunt the adrenal response to this severe physiologic stress and also block peripheral T4-to-T3 conversion, adding another layer of hormone control — given as part of the full antithyroid storm bundle, alongside PTU and iodine.' },
        ],
        decoys: [
          { id: 'decoy-thy-iodine-first', label: 'Give Lugol\'s iodine before PTU to act faster', why: 'Iodine given before the gland is blocked with an antithyroid drug feeds it raw material for a fresh surge of hormone synthesis, worsening the storm instead of controlling it — order matters completely here: PTU first, iodine after.' },
          { id: 'decoy-thy-aspirin-fever', label: 'Give aspirin to control the severe fever', why: 'Aspirin displaces thyroid hormone from its carrier protein, releasing more free active hormone into circulation and worsening thyroid storm — paracetamol and physical cooling measures are used instead, never aspirin.' },
          { id: 'decoy-thy-skip-ptu', label: 'Skip PTU and go straight to a beta-blocker as the definitive treatment', why: 'Beta-blockade controls the adrenergic symptoms (heart rate, tremor, agitation) but does nothing to stop the thyroid gland from making and releasing more hormone — PTU (or an equivalent antithyroid drug) is still required to actually treat the source of the storm.' },
        ],
      },
    ],
    debriefWin: 'You ran the thyroid storm ladder without falling into its signature trap: labs to confirm severe hyperthyroidism, cooling and beta-blockade to control the adrenergic surge, recognising delirium plus heart failure as a storm rather than two separate problems — and in the final sequence, PTU before iodine, exactly in that order, followed by hydrocortisone. Get that order right, and you starve the storm instead of feeding it.',
    debriefLoss: 'Thyroid storm kills through its own deceptive fuel source — iodine looks like a fast fix, but given before the gland is blocked, it becomes gasoline on the fire. Losing her here does not mean you did not know the drugs; it means the order (PTU, THEN iodine, THEN hydrocortisone) is now permanently burned into how you think about this crisis.',
    examTip: 'NORCET loves the sequencing trap in thyroid storm: PTU (or methimazole) MUST be given before Lugol\'s iodine, never after — iodine before the antithyroid drug fuels a hormone surge. Also expect: aspirin is contraindicated (displaces thyroid hormone from binding protein), propranolol controls adrenergic symptoms, and hydrocortisone blocks peripheral T4-to-T3 conversion.',
  },
];

export default SCENARIOS_B2;
