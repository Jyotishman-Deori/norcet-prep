// =====================================================================
// src/data/seed-explanations.js
// Upgraded, structured explanations + wrong-option rationales for the
// built-in SEED_QUESTIONS, keyed by question id. Merged into SEED_QUESTIONS
// at load time (see seed.js). This file NEVER touches a question's options
// or correct answer — only `exp` and `wrong` text.
//
// Rendering is plain text with line breaks (no markdown), so structure uses
// CAPS labels + blank lines: ANSWER → WHY → (detail) → EXAM TIP.
//
// Uploaded question banks carry their own exp/wrong; to match this depth in a
// bank, author its `exp`/`wrong` fields in the same ANSWER/WHY/EXAM TIP shape.
// =====================================================================

export const SEED_EXPLANATIONS = {

  // ---- FUNDAMENTALS ----
  f1: {
    exp: `ANSWER: 60–100 bpm: the normal resting heart rate for a healthy adult.

WHY: at rest the SA (sinoatrial) node. The heart's natural pacemaker. Fires 60–100 times a minute. This range delivers enough cardiac output (CO = stroke volume × heart rate) without making the heart work harder than it needs to.

OUT OF RANGE: below 60 = bradycardia (normal in trained athletes because their larger stroke volume does more per beat; otherwise think β-blockers, heart block, hypothyroidism, or raised intracranial pressure). Above 100 = tachycardia (fever, pain, anxiety, dehydration, hypoxia, blood loss, arrhythmia).

EXAM TIP: NORCET loves the athlete exception, a resting pulse of 50 in a marathon runner is physiological, not pathological.`,
    wrong: {
      0: `40–60 is tempting because very fit athletes sit here, but as a general "normal resting" figure it is bradycardia, which in most adults signals β-blockers, heart block, hypothyroidism or raised ICP.`,
      2: `100–120 is mild tachycardia. Common with fever, pain, anxiety or dehydration, a reason to look for a cause, not a normal baseline.`,
      3: `120–140 is marked tachycardia. Never a normal resting range in an adult; needs evaluation for arrhythmia, sepsis, hypovolaemia, etc.`
    }
  },
  f2: {
    exp: `ANSWER: every option except "right colour of tablet", the Rights of Medication Administration.

WHY: the Rights are a verification checklist that prevents medication error. The classic 5 are Patient, Drug, Dose, Route, Time. Modern frameworks extend to 10: add Documentation, Reason, Response, Refuse, and Education.

KEY DISTINCTION: appearance (colour, shape) is NEVER a verification criterion, the same drug looks different across generics and brands, so relying on colour is exactly how errors slip through.

EXAM TIP: if an option describes checking the drug by how it looks rather than by its label/order, it is the wrong one.`,
    wrong: {
      1: `Tablet colour varies by manufacturer and between generic and brand. Using appearance to verify a drug is unsafe. Always check the label against the order, never the colour.`
    }
  },
  f3: {
    exp: `ANSWER: "before entering the hospital building" is NOT one of the WHO 5 Moments.

WHY: the 5 Moments are defined around the PATIENT and the care task, to interrupt the chain of cross-transmission at the riskiest points.

THE 5 MOMENTS: (1) before touching a patient, (2) before a clean/aseptic procedure, (3) after body-fluid exposure risk, (4) after touching a patient, (5) after touching the patient's surroundings.

EXAM TIP: hand hygiene on entering the building is good general practice but is not one of the formal 5 Moments. The moments are tied to patient contact, not to the doorway.`,
    wrong: {
      0: `"Before touching a patient" is Moment 1, a genuine WHO moment, so it cannot be the answer to a "does NOT include" question.`,
      1: `"After body-fluid exposure risk" is Moment 3, a genuine moment.`,
      3: `"After touching patient surroundings" is Moment 5, a genuine moment.`
    }
  },
  f4: {
    exp: `ANSWER: High Fowler's: the best position for severe dyspnoea.

WHY: sitting upright at 60°–90° lets gravity pull the abdominal organs down, so the diaphragm can descend fully and the lungs expand maximally. That increases tidal volume and reduces the work of breathing.

ADD-ON: pairing it with a pillow on an over-bed table to lean forward gives the orthopneic position, which recruits the accessory muscles, useful in COPD/asthma distress.

EXAM TIP: "breathless = sit them up." Lying flat is almost always the wrong answer for a dyspnoeic patient.`,
    wrong: {
      0: `Supine worsens dyspnoea: lying flat lets the abdominal contents push the diaphragm up and reduces lung expansion.`,
      1: `Trendelenburg (head-down tilt) is used for hypotension/shock to boost venous return. It would make breathlessness worse.`,
      3: `Left lateral improves cardiac output in late pregnancy (relieves aortocaval compression) but does not specifically relieve dyspnoea.`
    }
  },
  f5: {
    exp: `ANSWER: sterilisation kills ALL microbes including spores; disinfection kills most pathogens but may spare spores.

WHY: it is a difference in completeness. Sterilisation (autoclave, ethylene oxide) destroys every microbial form, including tough bacterial spores. Disinfection (chemical agents, boiling) removes most pathogens but cannot be relied on to kill spores.

CLINICAL LINK (Spaulding): critical items entering sterile tissue (surgical instruments) need sterilisation; semi-critical items touching mucosa (endoscopes) need high-level disinfection; non-critical items (BP cuffs) need low-level disinfection.

EXAM TIP: "kills spores" is the single phrase that separates sterilisation from disinfection.`,
    wrong: {
      1: `They differ in how COMPLETE the kill is, not merely in temperature. The defining issue is whether spores survive.`,
      2: `This is backwards: sterilisation is the more thorough process, not disinfection.`,
      3: `The difference is highly significant clinically: it decides which reprocessing method an instrument needs (Spaulding classification).`
    }
  },
  f6: {
    exp: `ANSWER: the patient's self-report is the most reliable indicator of pain.

WHY: pain is subjective and private. McCaffery's classic definition: "pain is whatever the experiencing person says it is, existing whenever they say it does." No observer can measure it more accurately than the person feeling it.

WHEN SELF-REPORT IS IMPOSSIBLE: use validated behavioural scales. FLACC (infants), PAINAD (advanced dementia), or observe an unconscious patient, but only as a fallback.

EXAM TIP: if "patient's self-report" is an option in any pain-assessment question, it is almost always the answer.`,
    wrong: {
      0: `Vital-sign changes are unreliable. They often stay normal in chronic pain and can rise for unrelated reasons (anxiety, fever).`,
      1: `Facial expression varies by culture and personality; a stoic patient may hide severe pain.`,
      3: `Activity level misleads: patients may push through activity despite pain, and inactivity has many causes.`
    }
  },

  // ---- ANATOMY & PHYSIOLOGY ----
  a1: {
    exp: `ANSWER: 4–8 L/min, normal resting cardiac output.

WHY: cardiac output = stroke volume × heart rate ≈ 70 mL × 70 bpm ≈ 4.9 L/min. The normal resting band is 4–8 L/min, and it can climb above 20 L/min in heavy exercise.

CLINICAL MEANING: a low CO causes hypoperfusion (cool, mottled skin, falling urine output, confusion); an abnormally high CO points to a hyperdynamic state such as sepsis, thyrotoxicosis or severe anaemia.

EXAM TIP: anchor it to "≈5 L/min at rest", the rough volume of the whole blood pool circulating each minute.`,
    wrong: {
      0: `2–3 L/min is too low. It would indicate severe cardiac dysfunction / cardiogenic shock.`,
      2: `10–12 L/min is a high output, seen in exercise, sepsis or hyperthyroidism, not at rest.`,
      3: `15–20 L/min is only reached at peak athletic exertion, never at rest.`
    }
  },
  a2: {
    exp: `ANSWER: the nephron: the functional unit of the kidney.

WHY: each kidney holds about 1 million nephrons, and the nephron is the smallest structure that performs the kidney's whole job, filtration, reabsorption and secretion, start to finish.

ITS PARTS: renal corpuscle (glomerulus + Bowman's capsule) → proximal tubule → Loop of Henle → distal tubule → collecting duct. Each segment handles a specific step of urine formation.

EXAM TIP: the other options are all PARTS of the nephron, "functional unit" means the complete working unit, not a component.`,
    wrong: {
      0: `The glomerulus is only the filtering tuft, one part of the nephron, not the whole working unit.`,
      2: `Bowman's capsule is the cup that surrounds the glomerulus, again just one component.`,
      3: `The Loop of Henle concentrates urine but is a single segment of the nephron.`
    }
  },
  a3: {
    exp: `ANSWER: I (Olfactory), II (Optic) and VIII (Vestibulocochlear) are the purely sensory cranial nerves.

WHY: cranial nerves are sensory, motor or mixed. Only three carry sensation alone, smell, sight, and hearing/balance.

THE MAP: purely motor = III, IV, VI, XI, XII; mixed = V, VII, IX, X. Mnemonic for the type of each (I–XII): "Some Say Marry Money But My Brother Says Big Brains Matter More". S = sensory, M = motor, B = both.

EXAM TIP: the three sensory nerves are the "special senses" trio, easy to remember as smell, sight, sound.`,
    wrong: {
      2: `CN III (oculomotor) is purely MOTOR, eye movement and pupil constriction.`,
      3: `CN V (trigeminal) is MIXED, facial sensation plus the muscles of mastication.`,
      5: `CN X (vagus) is MIXED and very widely distributed (parasympathetic to thorax/abdomen plus sensory).`
    }
  },
  a4: {
    exp: `ANSWER: ADH (antidiuretic hormone / vasopressin) is NOT from the anterior pituitary.

WHY: ADH and oxytocin are made in the hypothalamus and merely stored and released by the POSTERIOR pituitary. The anterior pituitary makes its own hormones.

ANTERIOR PITUITARY (mnemonic "GAT FLaP"): GH, ACTH, TSH, FSH, LH, Prolactin. POSTERIOR pituitary releases only ADH and Oxytocin.

EXAM TIP: if the question asks what the posterior pituitary "secretes," remember it manufactures nothing, it only stores and releases the two hypothalamic hormones.`,
    wrong: {
      0: `Growth hormone is an anterior pituitary hormone.`,
      1: `TSH (thyroid-stimulating hormone) is an anterior pituitary hormone.`,
      3: `Prolactin is an anterior pituitary hormone.`
    }
  },
  a5: {
    exp: `ANSWER: stratum basale: the deepest layer of the epidermis.

WHY: the basale sits on the basement membrane and is where keratinocytes divide (mitosis). New cells are pushed upward, maturing and dying as they rise, until they shed from the surface.

THE LAYERS (deep → superficial): Basale → Spinosum → Granulosum → Lucidum (thick skin only) → Corneum. Mnemonic: "Be Sure Get Lots of Coffee."

EXAM TIP: "deepest + dividing" = basale; "most superficial + dead" = corneum.`,
    wrong: {
      0: `Stratum corneum is the most SUPERFICIAL layer, flat, dead, keratinised cells.`,
      1: `Stratum lucidum lies just beneath the corneum and exists only in thick (palms/soles) skin.`,
      3: `Stratum granulosum is a middle layer where keratohyalin granules form, not the deepest.`
    }
  },
  a6: {
    exp: `ANSWER: 12–15 g/dL, normal haemoglobin for an adult female.

WHY: women run lower than men because menstrual loss and hormonal factors give them a smaller red-cell mass. Adult males: roughly 13.5–17.5 g/dL.

ANAEMIA CUT-OFFS (WHO): <12 g/dL in non-pregnant women, <11 g/dL in pregnancy, <13 g/dL in men. Anaemia in reproductive-age women is extremely common in India.

EXAM TIP: know the female "normal" (12–15) and the female anaemia threshold (<12, or <11 in pregnancy). They are favourite values.`,
    wrong: {
      0: `8–10 g/dL is severe anaemia, usually symptomatic (breathlessness, fatigue, tachycardia).`,
      1: `10–12 g/dL falls into mild anaemia by most cut-offs, not the normal range.`,
      3: `15–17 g/dL is the MALE range; in a female it would suggest polycythaemia or haemoconcentration.`
    }
  },

  // ---- MEDICAL–SURGICAL NURSING ----
  m1: {
    exp: `ANSWER: obtain a 12-lead ECG first.

WHY: in suspected acute MI the ECG (target: within 10 minutes of arrival) is what classifies the patient. STEMI (needs immediate reperfusion) vs NSTEMI / unstable angina, and that decision drives the entire pathway.

THE REST FOLLOW FAST: aspirin, IV access, and oxygen (only if SpO₂ <94%) all happen almost together, but the diagnostic ECG comes first because it directs everything else.

EXAM TIP: "diagnose before you treat", when the question lists ECG among the actions for chest pain, it is usually the first step.`,
    wrong: {
      0: `Aspirin 325 mg is given very early, but the ECG comes first to confirm the cardiac picture and guide reperfusion.`,
      2: `IV access is set up in parallel, yet it is preparatory. The ECG is the diagnostic priority.`,
      3: `Oxygen is given only if SpO₂ <94%; routine oxygen is no longer recommended, and the ECG still precedes it.`
    }
  },
  m2: {
    exp: `ANSWER: diabetic ketoacidosis (DKA).

WHY: the picture: drowsiness, deep sighing (Kussmaul) breathing, and fruity breath. Is the classic DKA triad of hyperglycaemia + ketosis + metabolic acidosis. Kussmaul breathing blows off CO₂ to compensate for the acidosis; the fruity smell is exhaled acetone.

USUAL SETTING: Type 1 diabetes. Management order: fluids → insulin → potassium replacement → treat the precipitant (often infection).

EXAM TIP: "fruity breath + deep breathing in a diabetic" = DKA until proven otherwise.`,
    wrong: {
      0: `Hypoglycaemia gives tremor, sweating and confusion, not Kussmaul breathing or a fruity odour.`,
      2: `HHS shows very high glucose with minimal ketosis and no significant acidosis, so there is no Kussmaul breathing; it is more typical of Type 2.`,
      3: `Lactic acidosis can cause deep breathing but lacks the fruity (ketone) breath and arises in a different context (sepsis, metformin).`
    }
  },
  m3: {
    exp: `ANSWER: asthma is reversible airway obstruction; COPD is largely irreversible.

WHY: in asthma the bronchoconstriction responds to bronchodilators and spirometry normalises afterward. In COPD the airflow limitation is chronic and progressive, driven by emphysema and chronic bronchitis. And only partly reverses.

SHARED BUT DIFFERENT: both involve inflammation, but asthma tends to be eosinophilic and episodic, COPD neutrophilic and persistent.

EXAM TIP: the single discriminator the examiner wants is "reversibility". Asthma reverses, COPD largely does not.`,
    wrong: {
      1: `COPD is mostly smoking-related but also follows biomass-fuel exposure, occupational dust, and alpha-1 antitrypsin deficiency. So "only smokers" is false.`,
      2: `Acute severe asthma absolutely causes hyperinflation (air trapping), so "never" is wrong.`,
      3: `COPD has a definite inflammatory component (neutrophilic). It is not non-inflammatory.`
    }
  },
  m4: {
    exp: `ANSWER: atelectasis: the commonest cause of fever in the first 24 hours after surgery.

WHY: anaesthesia and shallow, painful breathing leave small airways collapsed; this day-1 atelectasis is the classic early post-op fever.

THE "5 Ws" BY TIMING: Wind (atelectasis, day 1) → Water (UTI, day 3) → Wound (infection, day 5) → Walking (DVT, day 5–7) → Wonder drugs (drug reaction, anytime).

PREVENTION/FIX: incentive spirometry, deep breathing, early ambulation.

EXAM TIP: match the fever to the post-op DAY. "day 1 fever" almost always means atelectasis.`,
    wrong: {
      0: `Wound infection ("Wound") typically appears around day 5, not day 1.`,
      2: `UTI ("Water") usually shows around day 3, often catheter-related.`,
      3: `DVT ("Walking") tends to present day 5–7 when mobilisation is delayed.`
    }
  },
  m5: {
    exp: `ANSWER: stop the transfusion immediately.

WHY: fever, chills, low-back pain and dark urine during a transfusion signal an acute haemolytic reaction (usually ABO incompatibility), a life-threatening emergency. Every additional millilitre of incompatible blood worsens haemolysis, so the line must stop at once.

THEN: keep the vein open with normal saline using NEW tubing (not the contaminated set), notify the doctor and blood bank, and send the unit plus a post-transfusion sample for recheck.

EXAM TIP: for any suspected transfusion reaction the universal first action is STOP. Never slow.`,
    wrong: {
      0: `Even a KVO ("keep vein open") rate keeps delivering incompatible blood. You must STOP, not slow.`,
      2: `Paracetamol treats a mild febrile NON-haemolytic reaction, and only after stopping; these features point to dangerous haemolysis.`,
      3: `Continuing in any form is contraindicated once a haemolytic reaction is suspected.`
    }
  },
  m6: {
    exp: `ANSWER: hyperkalaemia: the most immediately life-threatening electrolyte problem in CKD.

WHY: damaged kidneys cannot excrete potassium, and a rising K⁺ destabilises cardiac conduction: peaked T waves → widened QRS → sine-wave pattern → cardiac arrest.

EMERGENCY TREATMENT ORDER: calcium gluconate (stabilises the myocardium) → insulin + dextrose / salbutamol / bicarbonate (shift K⁺ into cells) → dialysis or potassium-binding resin (actually removes it).

EXAM TIP: hyperkalaemia kills by arrhythmia in minutes, it outranks the slower CKD electrolyte problems.`,
    wrong: {
      0: `Hyponatraemia occurs in CKD but develops slowly and is rarely instantly fatal.`,
      2: `Hypocalcaemia drives secondary hyperparathyroidism, a chronic bone problem, not an acute killer.`,
      3: `Hypermagnesaemia matters mainly when magnesium-containing antacids are used in CKD, far less common.`
    }
  },
  m7: {
    exp: `ANSWER: GCS 8 = severe head injury.

WHY: the Glasgow Coma Scale grades consciousness from 3 (deepest coma) to 15 (fully alert). The bands are 13–15 mild, 9–12 moderate, 3–8 severe.

AIRWAY RULE: "GCS 8: intubate." At 8 or below the patient cannot reliably protect their airway, so definitive airway control is anticipated.

EXAM TIP: the minimum score is 3, NEVER 0 (you always score at least 1 in each of Eye, Verbal, Motor).`,
    wrong: {
      0: `Mild head injury is GCS 13–15.`,
      1: `Moderate head injury is GCS 9–12.`,
      3: `Normal consciousness is GCS 15 (E4 V5 M6).`
    }
  },
  m8: {
    exp: `ANSWER: protective isolation / neutropenic precautions.

WHY: an absolute neutrophil count of 400/µL is severe neutropenia (ANC <500). With almost no neutrophils, the patient cannot mount a normal response to infection, which becomes the dominant, life-threatening risk.

PRECAUTIONS: private room, strict hand hygiene, no fresh flowers or raw fruit/vegetables, visitor screening, daily mouth care, and temperature monitoring. Fever ≥38°C is neutropenic fever, an emergency needing blood cultures and broad-spectrum antibiotics within 1 hour.

EXAM TIP: in severe neutropenia, infection prevention beats every other need on a "priority" question.`,
    wrong: {
      0: `Hydration matters but does not address the immediate threat of overwhelming infection.`,
      2: `Pain assessment is important yet secondary to protecting an immunocompromised patient.`,
      3: `Nutrition supports recovery but ranks below infection control here.`
    }
  },

  // ---- PHARMACOLOGY ----
  p1: {
    exp: `ANSWER: Lispro / Aspart: the fastest-onset insulins.

WHY: rapid-acting analogues (lispro, aspart, glulisine) start working in 5–15 minutes, so they are given right at the start of a meal to match the post-meal glucose spike.

THE PROFILES: rapid: onset 5–15 min, peak ~1 h, duration 3–4 h; regular. Onset 30–60 min (give 30 min before food); NPH, intermediate, onset 1–2 h; glargine/detemir, long-acting, essentially peakless, ~24 h.

EXAM TIP: order of speed = rapid → regular → NPH → long-acting. "Analogue = fast" is the shortcut.`,
    wrong: {
      0: `Regular (Actrapid) is short-acting with a 30–60 min onset, slower than the analogues.`,
      1: `NPH is intermediate-acting (1–2 h onset), clearly slower.`,
      3: `Glargine is a long-acting basal insulin with no real peak, the slowest onset here.`
    }
  },
  p2: {
    exp: `ANSWER: "hypokalaemia symptoms" is NOT an early sign of digoxin toxicity.

WHY: digoxin toxicity shows up as GI upset (anorexia, nausea, often first), visual disturbance (yellow-green halos, "xanthopsia"), and arrhythmias (bradycardia, heart block, ectopy).

THE TRAP: low potassium PREDISPOSES to digoxin toxicity (it lets digoxin bind more); it is a cause/risk factor, not a feature of toxicity. Therapeutic level: 0.5–2.0 ng/mL.

EXAM TIP: remember "digoxin + low K⁺ = danger". Hypokalaemia worsens toxicity rather than being a symptom of it.`,
    wrong: {
      0: `Anorexia and nausea are classic EARLY toxic symptoms, genuine, so not the exception.`,
      1: `Yellow-green halos (xanthopsia) are a classic visual sign of toxicity.`,
      2: `Bradycardia / AV block are common toxic arrhythmias.`
    }
  },
  p3: {
    exp: `ANSWER: Vitamin K: the antidote for warfarin.

WHY: warfarin blocks the vitamin K-dependent clotting factors (II, VII, IX, X). Giving vitamin K (phytomenadione) lets the liver remake them, reversing the effect.

URGENT BLEEDING: vitamin K takes hours, so for life-threatening haemorrhage give FFP or prothrombin complex concentrate (PCC) for immediate factor replacement.

KNOW THE PAIRS: heparin → protamine; opioids → naloxone; benzodiazepines → flumazenil.

EXAM TIP: warfarin ↔ vitamin K, heparin ↔ protamine, examiners love to swap these.`,
    wrong: {
      0: `Protamine sulphate reverses HEPARIN, not warfarin.`,
      2: `Naloxone reverses opioid overdose.`,
      3: `Flumazenil reverses benzodiazepine overdose.`
    }
  },
  p4: {
    exp: `ANSWER: nephrotoxicity, ototoxicity and neuromuscular blockade, the aminoglycoside trio to monitor.

WHY: gentamicin/amikacin damage the proximal renal tubule (watch creatinine), the inner ear (vestibular + cochlear. Deafness can be permanent), and can potentiate neuromuscular blockers (caution in myasthenia gravis).

NOT THEM: they are excreted unchanged in urine, so they are not hepatotoxic, and QT prolongation belongs to macrolides/fluoroquinolones.

EXAM TIP: aminoglycosides have a narrow therapeutic index, therapeutic drug monitoring (peak + trough) reduces toxicity.`,
    wrong: {
      3: `Aminoglycosides are NOT hepatotoxic. They are cleared unchanged by the kidney, which is why renal monitoring matters.`,
      4: `QT prolongation is linked to macrolides and fluoroquinolones, not aminoglycosides.`
    }
  },
  p5: {
    exp: `ANSWER: gingival hyperplasia: a hallmark phenytoin adverse effect.

WHY: phenytoin causes overgrowth of gum tissue in 40–50% of users, so meticulous oral hygiene is the key teaching point.

OTHER EFFECTS: hirsutism, coarse facial features, ataxia and nystagmus (dose-related), megaloblastic anaemia (folate antagonism) and Stevens-Johnson syndrome. Narrow therapeutic index: 10–20 µg/mL.

EXAM TIP: "phenytoin = swollen gums + hairy + folate problems" captures the classic cluster.`,
    wrong: {
      0: `Phenytoin causes hair GROWTH (hirsutism), not hair loss.`,
      2: `Weight change is not a defining feature; gum overgrowth is the classic teaching point.`,
      3: `Hyperpigmentation is not typical; phenytoin's pregnancy concern is fetal hydantoin syndrome.`
    }
  },
  p6: {
    exp: `ANSWER: beta-2 adrenergic agonism, how salbutamol works.

WHY: salbutamol selectively stimulates β2 receptors on bronchial smooth muscle, relaxing it (bronchodilation) to relieve wheeze and breathlessness.

SIDE EFFECTS: come from β2 spillover elsewhere (fine tremor, hypokalaemia) and, at high doses, some β1 effect (tachycardia, palpitations).

EXAM TIP: β2 = bronchi (and uterus); β1 = heart. "Salbutamol opens airways via β2". Contrast with ipratropium, which is a muscarinic antagonist.`,
    wrong: {
      0: `β1 agonism speeds the heart (e.g. dobutamine): not salbutamol's main action.`,
      2: `α1 antagonism lowers blood pressure (e.g. prazosin).`,
      3: `Muscarinic antagonism describes ipratropium, a different class of bronchodilator.`
    }
  },

  // ---- PAEDIATRICS ----
  pe1: {
    exp: `ANSWER: at birth: when BCG is given under India's UIP.

WHY: BCG is given as early as possible to protect newborns against severe childhood TB (miliary TB, TB meningitis), which is most dangerous in the first months of life.

THE BIRTH DOSES: BCG, OPV-0, and Hepatitis B-0. At 6/10/14 weeks: pentavalent (DPT+HepB+Hib) + OPV + rotavirus + fIPV + PCV. At 9 months: MR-1 (+ JE-1 in endemic areas) + Vitamin A.

EXAM TIP: the "birth trio" is BCG + OPV-0 + Hep B-0.`,
    wrong: {
      1: `6 weeks is the first dose of pentavalent/OPV/rotavirus, not BCG.`,
      2: `9 months is MR-1 (measles-rubella), not BCG.`,
      3: `16 months is the DPT booster and MR-2.`
    }
  },
  pe2: {
    exp: `ANSWER: at 1 and 5 minutes after birth.

WHY: the 1-minute score reflects how the baby tolerated birth; the 5-minute score reflects the response to any resuscitation. If the 5-minute score is <7, it is repeated every 5 minutes up to 20 minutes.

THE COMPONENTS: Appearance (colour), Pulse, Grimace (reflex), Activity (tone), Respiration, each 0–2, max 10. 7–10 normal, 4–6 moderate depression, 0–3 severe.

EXAM TIP: "1 and 5 minutes" is the routine; extra readings only if the baby is doing poorly.`,
    wrong: {
      1: `Assessing only "immediately at birth" is too early to judge the response to interventions.`,
      2: `The 10-minute reading is added only when the 5-minute score was abnormal, not routine.`,
      3: `Scoring every minute is not the standard schedule.`
    }
  },
  pe3: {
    exp: `ANSWER: by 5 months: when an infant doubles birth weight.

WHY: growth is fastest in early infancy. The weight rule of thumb: double by ~5 months, triple by 1 year, quadruple by 2 years.

OTHER FIRST-YEAR GAINS: length increases ~25 cm; head circumference ~12 cm. Average newborn weight 2.5–3.5 kg; <2.5 kg = low birth weight.

EXAM TIP: memorise "double-5, triple-12 (months)" for weight milestones.`,
    wrong: {
      0: `By 3 months an infant has gained only about half its birth weight, not doubled.`,
      2: `By 9 months weight is roughly 2.5× birth weight, past doubling but before tripling.`,
      3: `By 12 months weight has TRIPLED, not merely doubled.`
    }
  },
  pe4: {
    exp: `ANSWER: chest indrawing classifies pneumonia as SEVERE in IMNCI.

WHY: IMNCI grades cough/breathing by simple signs. NO PNEUMONIA = no fast breathing, no indrawing. PNEUMONIA = fast breathing alone (≥50/min at 2–12 months; ≥40/min at 1–5 years). SEVERE PNEUMONIA = lower chest indrawing OR any general danger sign.

ACTION: severe pneumonia needs urgent referral after the first dose of an appropriate antibiotic.

EXAM TIP: fast breathing = pneumonia; chest indrawing = SEVERE pneumonia.`,
    wrong: {
      0: `Fast breathing ALONE is "pneumonia," not the severe category.`,
      2: `A runny nose without fast breathing is "no pneumonia" (a common cold).`,
      3: `A mild cough alone is "no pneumonia."`
    }
  },
  pe5: {
    exp: `ANSWER: 1600 mL/day for a 25 kg child (Holliday-Segar).

WHY: the formula adds tiers, 100 mL/kg for the first 10 kg, 50 mL/kg for the next 10 kg, 20 mL/kg for each kg beyond 20.

THE MATH: (10 × 100) + (10 × 50) + (5 × 20) = 1000 + 500 + 100 = 1600 mL/day. The hourly "4-2-1" version gives 4+2+1 = 65 mL/hr for the same child.

EXAM TIP: remember the tiers as 100-50-20 (daily) or 4-2-1 (hourly).`,
    wrong: {
      0: `1000 mL covers only the first 10 kg tier.`,
      1: `1500 mL omits the third tier (20 mL/kg for the weight above 20 kg).`,
      3: `2500 mL is far too much and risks fluid overload.`
    }
  },
  pe6: {
    exp: `ANSWER: low-osmolarity ORS (245 mOsm/L).

WHY: since 2002 WHO/UNICEF recommend low-osmolarity ORS (Na⁺ 75, glucose 75, K⁺ 20, citrate 10, Cl⁻ 65; total 245 mOsm/L). It reduces stool output, vomiting and the need for IV fluids compared with the old high-osmolarity formula.

PLUS ZINC: zinc supplementation for 10–14 days shortens the illness and reduces recurrence.

EXAM TIP: "low-osmolarity ORS + zinc" is the modern standard for childhood diarrhoea.`,
    wrong: {
      0: `The high-osmolarity (311 mOsm/L) formula is the OLD standard, replaced because it drew water into the gut.`,
      2: `Plain rice water is a useful home fluid but is not a balanced electrolyte solution.`,
      3: `Coconut water alone has inadequate sodium for rehydration.`
    }
  },

  // ---- OBSTETRICS & GYNAECOLOGY ----
  o1: {
    exp: `ANSWER: the onset of regular uterine contractions begins the first stage of labour.

WHY: the first stage runs from regular painful contractions to full (10 cm) cervical dilatation. It splits into a latent phase (0–6 cm, slow) and an active phase (6–10 cm, ~1 cm/hr in a primigravida).

THE WHOLE MAP: Stage 1 ends at full dilatation; Stage 2 = full dilatation → birth; Stage 3 = birth → placenta; Stage 4 = 1–2 h observation.

EXAM TIP: full dilatation is the END of Stage 1, not its start.`,
    wrong: {
      1: `Full dilatation (10 cm) marks the END of the first stage, and the start of the second.`,
      2: `Delivery of the baby is the END of the second stage.`,
      3: `Delivery of the placenta is the end of the third stage.`
    }
  },
  o2: {
    exp: `ANSWER: BP ≥160/110, platelets <100,000/µL and persistent epigastric pain are SEVERE features.

WHY: pre-eclampsia is BP ≥140/90 plus proteinuria or end-organ involvement after 20 weeks. The "severe" label is reserved for danger features showing end-organ damage.

SEVERE FEATURES: BP ≥160/110, platelets <100k, transaminases ≥2× normal, creatinine >1.1 (or doubled), pulmonary oedema, persistent headache/visual changes, epigastric/RUQ pain. Seizures = eclampsia; HELLP = Haemolysis + Elevated Liver enzymes + Low Platelets.

EXAM TIP: ordinary thresholds (140/90, proteinuria) define pre-eclampsia; the higher/organ-damage criteria define SEVERE.`,
    wrong: {
      1: `Proteinuria >300 mg/24 h helps DIAGNOSE pre-eclampsia but is not by itself a "severe" feature.`,
      4: `BP ≥140/90 defines pre-eclampsia in general. The severe cut-off is ≥160/110.`
    }
  },
  o3: {
    exp: `ANSWER: uterine atony: the commonest cause of primary PPH.

WHY: after delivery the uterus must clamp down on the placental bed; if it stays soft ("boggy"), the open vessels keep bleeding. Atony causes about 70% of cases.

THE "4 Ts": Tone (atony, ~70%) → Trauma (lacerations, ~20%) → Tissue (retained placenta, ~10%) → Thrombin (coagulopathy, ~1%). Primary PPH = >500 mL within 24 h (>1000 mL after caesarean).

MANAGEMENT: fundal massage + uterotonics (oxytocin → ergometrine → carboprost/misoprostol) → bimanual compression → surgery.

EXAM TIP: soft, boggy uterus + bleeding = atony, treat with massage and oxytocin first.`,
    wrong: {
      1: `Retained placenta ("Tissue") causes ~10% of PPH, far less than atony.`,
      2: `Genital-tract trauma ("Trauma") is ~20%; suspect it when the uterus is firm but bleeding continues.`,
      3: `Coagulopathy ("Thrombin") is rare (~1%) though dangerous.`
    }
  },
  o4: {
    exp: `ANSWER: 4: the minimum ANC visits recommended in India.

WHY: India's RCH/PMSMA guidance sets a minimum of 4 antenatal visits: 1st in the first trimester, 2nd at 14–26 weeks, 3rd at 28–34 weeks, 4th at 36 weeks to term.

THE NUANCE: WHO (2016) recommends 8 contacts for better outcomes, which India is gradually adopting, but for NORCET the standard Indian minimum answer is 4.

EXAM TIP: Indian minimum = 4; WHO 2016 ideal = 8. Read which guideline the question wants.`,
    wrong: {
      0: `2 visits is below the recommended Indian minimum.`,
      1: `3 visits is still below the minimum of 4.`,
      3: `8 is the WHO 2016 recommended number of contacts, not yet India's official minimum.`
    }
  },
  o5: {
    exp: `ANSWER: the calendar (rhythm) method has the highest typical-use failure rate.

WHY: "typical use" includes real-world mistakes. The rhythm method depends on regular cycles and disciplined abstinence during the fertile window, so human error makes it the least reliable (~24% failure).

TYPICAL-USE FAILURE RATES: implant <0.1%, IUCD 0.2–0.8%, sterilisation <0.5%, OCPs ~9%, condom ~13%, withdrawal ~20%, calendar ~24%.

EXAM TIP: the more a method depends on user behaviour, the higher its typical-use failure, natural methods sit at the top.`,
    wrong: {
      0: `The copper-T IUCD is highly effective (0.2–0.8% failure).`,
      1: `OCPs fail ~9% with typical use (mostly from missed pills), far better than the rhythm method.`,
      2: `Condoms fail ~13% typically, still more reliable than the calendar method.`
    }
  },
  o6: {
    exp: `ANSWER: 110–160 bpm: the normal fetal heart rate at term.

WHY: this range reflects a healthy balance of fetal sympathetic and parasympathetic tone. Variability and accelerations indicate fetal well-being.

OUT OF RANGE: <110 = bradycardia (cord compression, maternal hypotension, fetal hypoxia); >160 = tachycardia (maternal fever, chorioamnionitis, dehydration, fetal hypoxia, drugs). LATE decelerations are ominous, they signal uteroplacental insufficiency.

EXAM TIP: normal FHR 110–160; late decelerations are the worrying pattern.`,
    wrong: {
      0: `80–100 bpm is fetal bradycardia, concerning for hypoxia.`,
      2: `170–200 bpm is tachycardia.`,
      3: `200–220 bpm is severe tachycardia.`
    }
  },

  // ---- COMMUNITY HEALTH ----
  c1: {
    exp: `ANSWER: 1,000 live births, the denominator for IMR.

WHY: Infant Mortality Rate = (deaths under 1 year ÷ live births in the same year) × 1000. Live births (not total population) are the at-risk group, which is why they form the denominator.

RELATED RATES: Neonatal MR = deaths <28 days per 1000 live births; Under-5 MR per 1000 live births; Maternal Mortality Ratio per 100,000 live births. India's IMR is ~28 (SRS 2020) and falling.

EXAM TIP: most "mortality rates" use 1000 live births, only the Maternal ratio uses 100,000.`,
    wrong: {
      0: `Per 1,000 population is the wrong base. IMR uses live births.`,
      2: `Per 10,000 population is not the standard scale for IMR.`,
      3: `Per 100,000 live births is the denominator for the Maternal Mortality Ratio.`
    }
  },
  c2: {
    exp: `ANSWER: National Tuberculosis Elimination Programme (NTEP).

WHY: in 2020 RNTCP was renamed NTEP, signalling India's goal to ELIMINATE TB by 2025, five years ahead of the global SDG target of 2030.

THE STRATEGY: the National Strategic Plan's four pillars. Detect, Treat, Prevent, Build. Tools include CB-NAAT (GeneXpert) for rapid diagnosis with drug-resistance detection.

EXAM TIP: RNTCP → NTEP (2020); target year for elimination = 2025.`,
    wrong: {
      0: `NTP was the pre-RNTCP programme name, not the 2020 rename.`,
      2: `"TB Elimination Mission" is not the official name.`,
      3: `"India TB Free Initiative" is not the official name.`
    }
  },
  c3: {
    exp: `ANSWER: primary prevention: what BCG at birth represents.

WHY: primary prevention stops disease BEFORE it occurs. Immunisation does exactly that, it protects a healthy newborn from ever developing TB.

THE LEVELS: primordial = stop risk factors arising (population-wide healthy lifestyle); primary = prevent disease (immunisation, sanitation, health education); secondary = early detection in the asymptomatic stage (screening); tertiary = limit disability and rehabilitate in established disease.

EXAM TIP: "vaccine in a healthy person = primary prevention."`,
    wrong: {
      0: `Primordial prevention targets the underlying RISK FACTOR before it appears, not the disease directly.`,
      2: `Secondary prevention is screening for early, asymptomatic disease (e.g. Pap smear).`,
      3: `Tertiary prevention is rehabilitation after established disease (e.g. post-stroke).`
    }
  },
  c4: {
    exp: `ANSWER: the basic reproduction number (R₀).

WHY: herd-immunity threshold ≈ 1 − (1/R₀). The more transmissible a disease (higher R₀), the larger the immune fraction needed to break transmission chains.

WORKED EXAMPLES: measles (R₀ ~12–18) needs ~95% coverage; polio (R₀ ~5–7) needs ~80–86%. Waning immunity and new variants complicate real-world figures.

EXAM TIP: threshold rises with R₀. That is why measles demands such high coverage.`,
    wrong: {
      0: `Vaccine cost affects programme delivery, not the biological threshold.`,
      2: `Population size doesn't change the threshold PROPORTION needed.`,
      3: `Workforce numbers affect implementation, not the required immune fraction.`
    }
  },
  c5: {
    exp: `ANSWER: about 50 litres/person/day, the WHO basic-access standard.

WHY: WHO frames water needs in tiers. ~20 L/person/day is the bare survival minimum (drinking, basic cooking and hygiene); ~50 L/person/day is the basic ACCESS standard (adds laundry and fuller hygiene); 100+ L meets full needs.

EMERGENCIES: the SPHERE minimum in disasters is ~15 L/person/day.

EXAM TIP: 20 = survival, 50 = basic access, 100+ = comfortable, the question's "for all purposes" points to 50.`,
    wrong: {
      0: `20 L is the survival MINIMUM, not the basic-access standard.`,
      2: `100 L is the optimal/comfortable level, above the basic standard.`,
      3: `200 L exceeds even the optimal need.`
    }
  },
  c6: {
    exp: `ANSWER: all five are National Health Programmes in India.

WHY: each is a major centrally-sponsored programme: NTEP (TB elimination), NACP (AIDS control), NLEP (leprosy eradication), NMHP (mental health, since 1982), NIDDCP (iodine-deficiency control).

OTHERS WORTH KNOWING: NVBDCP (vector-borne diseases), RCH, NPCDCS (non-communicable diseases), and Pulse Polio.

EXAM TIP: learn the acronyms with their target disease, the "N…P" pattern (National … Programme) is a giveaway.`,
    wrong: {}
  },

  // ---- MENTAL HEALTH NURSING ----
  mh1: {
    exp: `ANSWER: delusions, hallucinations and disorganised speech, the POSITIVE symptoms of schizophrenia.

WHY: positive symptoms are ADDITIONS to normal experience. Things that shouldn't be there. Negative symptoms are SUBTRACTIONS. Normal functions that are lost.

NEGATIVE = the 5 A's: flat Affect, Alogia, Anhedonia, Avolition, Asociality. Antipsychotics control positive symptoms better than negative ones.

EXAM TIP: "positive = added (voices, false beliefs); negative = taken away (motivation, emotion)."`,
    wrong: {
      2: `Flat affect is a NEGATIVE symptom (loss of emotional expression).`,
      4: `Avolition (loss of drive/motivation) is a NEGATIVE symptom.`,
      5: `Anhedonia (inability to feel pleasure) is a NEGATIVE symptom.`
    }
  },
  mh2: {
    exp: `ANSWER: denial.

WHY: refusing to accept a painful reality. Here insisting the terminal diagnosis is wrong and planning the future. Is denial, the first of Kübler-Ross's grief stages.

CONTRAST THE OTHERS: projection = blaming your own unacceptable feelings on someone else; rationalisation = inventing logical-sounding excuses; reaction formation = acting the opposite of your true feeling (excess kindness toward someone you resent).

EXAM TIP: denial = "this isn't happening / the test is wrong."`,
    wrong: {
      1: `Projection attributes one's own feelings outward onto others.`,
      2: `Rationalisation creates plausible-sounding excuses for behaviour.`,
      3: `Reaction formation is behaving opposite to one's real feelings.`
    }
  },
  mh3: {
    exp: `ANSWER: severe depression with suicidal risk or catatonia, the leading ECT indication.

WHY: ECT works fastest where the danger is highest, severe major depression (especially with suicidal intent, psychotic features, or catatonia), treatment-resistant depression, and severe mania.

HOW IT'S DONE: under general anaesthesia with a muscle relaxant, safe and effective. Main side effect: temporary memory impairment around the treatment period.

EXAM TIP: ECT is for the severe, urgent, treatment-resistant mood/catatonic states, not for anxiety, personality disorders, or addiction.`,
    wrong: {
      0: `Mild anxiety is not an ECT indication. It is managed with therapy and anxiolytics.`,
      2: `Personality disorders need long-term psychotherapy, not ECT.`,
      3: `Substance abuse needs detoxification and behavioural therapy.`
    }
  },
  mh4: {
    exp: `ANSWER: "Are you thinking about hurting yourself?": ask directly.

WHY: when suicidal ideation is suspected, a calm, direct question is the priority. Research is clear that asking does NOT plant the idea, it opens the door to help and lets you assess safety.

AVOID: false reassurance ("everyone feels that way"), advice/minimising ("focus on the positives"), and "why" questions (they feel interrogative and are usually unanswerable).

EXAM TIP: any hint of suicidal thinking → assess safety directly and first.`,
    wrong: {
      0: `"Everyone feels that way" is false reassurance, it dismisses the patient's pain.`,
      2: `"Focus on the positives" gives advice and minimises the feelings.`,
      3: `"Why do you feel this way?" sounds judgemental and is rarely answerable.`
    }
  },

  // ---- MICROBIOLOGY ----
  mi1: {
    exp: `ANSWER: purple/violet: Gram-POSITIVE bacteria after staining.

WHY: the thick peptidoglycan wall of gram-positive bacteria traps the crystal-violet–iodine complex, so it resists decolourisation and stays purple. Gram-negatives have a thin wall, lose the violet, and pick up the pink safranin counterstain.

THE STEPS: crystal violet → iodine (mordant) → alcohol/acetone (decolouriser) → safranin (counterstain).

EXAM TIP: "P for Positive = Purple."`,
    wrong: {
      0: `Pink/red is the colour of gram-NEGATIVE bacteria (safranin counterstain).`,
      2: `Blue is not a Gram-stain result colour.`,
      3: `Yellow is not a Gram-stain result colour.`
    }
  },
  mi2: {
    exp: `ANSWER: 121 °C, 15 psi, 15 minutes, standard autoclave parameters.

WHY: moist heat under pressure kills all microbes including bacterial spores. At 121 °C/15 psi, 15–20 minutes ensures complete sterilisation; high-vacuum autoclaves can use 134 °C for 3 minutes.

DRY HEAT ALTERNATIVE: a hot-air oven needs higher temperature/longer time (160 °C for 2 h, or 180 °C for 30 min) for glassware, oils and powders.

EXAM TIP: lock in "121 °C / 15 psi / 15 min", the most-asked sterilisation numbers.`,
    wrong: {
      0: `100 °C, 5 psi, 5 min is far too mild. It will not kill spores.`,
      2: `160 °C is a DRY-heat (hot-air oven) setting and needs about 2 hours.`,
      3: `80 °C / 30 psi / 30 min is not a recognised standard combination.`
    }
  },
  mi3: {
    exp: `ANSWER: Ziehl-Neelsen acid-fast stain, for M. tuberculosis.

WHY: TB's waxy, mycolic-acid-rich wall resists ordinary Gram staining. The acid-fast method (carbol fuchsin with heat → acid-alcohol decoloriser → methylene blue counterstain) makes acid-fast bacilli stand out red.

MODERN TOOLS: NTEP also uses fluorescent auramine staining and CB-NAAT (GeneXpert) for rapid diagnosis plus rifampicin-resistance detection.

EXAM TIP: "TB = acid-fast (Ziehl-Neelsen), stains red."`,
    wrong: {
      0: `TB does not stain reliably with the Gram method because of its waxy wall.`,
      2: `India ink is used for Cryptococcus (capsule).`,
      3: `Giemsa stain is for malaria and leishmania.`
    }
  },
  mi4: {
    exp: `ANSWER: urinary tract infection: the commonest hospital-acquired infection.

WHY: most are catheter-associated (CAUTI). An indwelling catheter gives bacteria a direct route into the bladder, and catheters are extremely common, so UTIs top the list.

PREVENTION: avoid unnecessary catheters, insert aseptically, keep a closed drainage system, and remove the catheter as early as possible. Other major HAIs: VAP, surgical-site infection, CLABSI.

EXAM TIP: "most common HAI = UTI (usually catheter-related)."`,
    wrong: {
      0: `Surgical-site infection is significant but not the most common overall.`,
      2: `Ventilator-associated pneumonia is common in ICUs but UTI leads overall.`,
      3: `Bloodstream infections are fewer in number though high in mortality.`
    }
  },

  // ---- NUTRITION ----
  n1: {
    exp: `ANSWER: overweight: a BMI of 24 by Asian-Indian criteria.

WHY: Indians develop cardiometabolic risk at a lower BMI, so the cut-offs are stricter than WHO's: <18.5 underweight, 18.5–22.9 normal, 23.0–24.9 OVERWEIGHT, ≥25 obese.

THE CONTRAST: by standard WHO cut-offs (normal 18.5–24.9) a BMI of 24 would be "normal", but modern Indian exams use the Asian-Indian thresholds.

EXAM TIP: watch which standard the question uses; BMI 23–24.9 is the Indian "overweight" band.`,
    wrong: {
      0: `Underweight is BMI <18.5.`,
      1: `The Indian "normal" band is 18.5–22.9, so 24 is above it.`,
      3: `Indian "obese" begins at ≥25.`
    }
  },
  n2: {
    exp: `ANSWER: Vitamin A: the cause of night blindness in children.

WHY: vitamin A (retinol) is essential for the retinal pigment used in dim-light vision. Deficiency hits night vision first, then progresses: Bitot's spots → conjunctival/corneal xerosis → keratomalacia (irreversible blindness).

INDIA'S RESPONSE: the Vitamin A prophylaxis programme gives 100,000 IU at 9 months, then 200,000 IU every 6 months up to age 5.

EXAM TIP: "A = vision": night blindness and Bitot's spots scream vitamin A.`,
    wrong: {
      1: `B12 deficiency causes pernicious anaemia and neuropathy, not night blindness.`,
      2: `Vitamin C deficiency causes scurvy.`,
      3: `Vitamin D deficiency causes rickets in children.`
    }
  },
  n3: {
    exp: `ANSWER: restrict potassium, phosphate, sodium and fluids, the haemodialysis diet.

WHY: failing kidneys cannot clear these. High potassium risks fatal arrhythmia (limit bananas, oranges, tomatoes, coconut water); phosphate drives bone disease (limit dairy, nuts, processed food); sodium and fluid must be controlled between sessions to avoid overload.

THE TWIST: protein is actually INCREASED (1.2–1.4 g/kg/day) because dialysis removes protein. Calcium is often supplemented; iron and EPO treat the anaemia.

EXAM TIP: dialysis diet = low K⁺/PO₄/Na⁺/fluid but HIGH protein.`,
    wrong: {
      0: `Protein is INCREASED on dialysis, not restricted. This option is wrong on protein.`,
      2: `Carbohydrate is not specifically restricted in dialysis.`,
      3: `Calcium and iron are usually SUPPLEMENTED, not restricted.`
    }
  },
  n4: {
    exp: `ANSWER: 60 mg iron + 500 µg folic acid. India's antenatal IFA dose.

WHY: under the National Anaemia Prophylaxis programme, every pregnant woman gets one IFA tablet (60 mg elemental iron + 500 µg folic acid) daily for at least 180 days in pregnancy AND 180 days postpartum. If Hb <11 g/dL, the dose is doubled (therapeutic).

PRECONCEPTION FOLATE: 400 µg/day, ideally from a month before conception through the first trimester, prevents neural-tube defects.

EXAM TIP: prophylactic IFA = 60 mg iron + 500 µg folic acid; doubled if anaemic.`,
    wrong: {
      0: `30 mg iron + 100 µg folic acid is below the national prophylactic dose.`,
      2: `100 mg iron + 1000 µg is a therapeutic-level dose, not routine prophylaxis.`,
      3: `20 mg iron + 50 µg is far below the recommendation.`
    }
  },

  // ---- EXTENDED: FUNDAMENTALS ----
  xf1: {
    exp: `ANSWER: infiltration.

WHY: a cool, pale, swollen IV site with no blood return and a slowing drip means a NON-vesicant fluid is leaking out of the vein into the surrounding tissue. The fluid is at room temperature and disperses, so the area feels cool and puffy.

CONTRAST: phlebitis is the opposite picture (warm, red, tender along the vein). Extravasation is the same leak but with a tissue-damaging VESICANT drug.

ACTION: stop the infusion, remove the cannula, elevate the limb, apply the appropriate compress.

EXAM TIP: cool + pale + swollen = infiltration; warm + red + tender = phlebitis.`,
    wrong: {
      0: `Phlebitis presents warm, red and tender along the vein, not cool and pale.`,
      2: `Extravasation is specifically the leakage of a tissue-damaging VESICANT drug.`,
      3: `Air embolism causes sudden dyspnoea and chest pain, not a localised cool swelling.`
    }
  },
  xf2: {
    exp: `ANSWER: urine specific gravity 1.030, the best sign of fluid volume DEFICIT.

WHY: when the body is dry, healthy kidneys conserve water, producing concentrated urine (specific gravity >1.025–1.030).

DEFICIT vs OVERLOAD: deficit = tachycardia, weak thready pulse, dry mucosa, low urine output, postural hypotension, raised specific gravity. The other three options are all OVERLOAD signs.

EXAM TIP: concentrated (high specific-gravity) urine = the body is holding onto water = deficit.`,
    wrong: {
      0: `A bounding pulse points to fluid OVERLOAD, not deficit.`,
      1: `Distended neck veins indicate volume overload / right heart strain.`,
      3: `Basal crackles suggest pulmonary congestion from overload.`
    }
  },
  xf3: {
    exp: `ANSWER: Stage 1 pressure injury.

WHY: intact skin with localised non-blanchable redness over a bony prominence is the defining picture of Stage 1. The skin is not yet broken.

THE STAGES: 1 = intact skin, non-blanchable redness; 2 = partial-thickness loss, exposed dermis (shallow ulcer/blister); 3 = full-thickness loss with visible fat; 4 = exposed bone/tendon/muscle.

EXAM TIP: "intact skin + redness that doesn't blanch" = Stage 1; any skin break moves it to Stage 2+.`,
    wrong: {
      1: `Stage 2 involves partial-thickness skin LOSS (blister/abrasion), not intact skin.`,
      2: `Stage 3 shows full-thickness loss with visible subcutaneous fat.`,
      3: `Deep-tissue injury is a persistent maroon/purple discolouration or a blood-filled blister.`
    }
  },

  // ---- EXTENDED: ANATOMY ----
  xa1: {
    exp: `ANSWER: metabolic acidosis with respiratory compensation.

WHY: pH 7.30 = acidosis. Look at the primary driver: HCO₃⁻ is low (15) → a metabolic cause. The low PaCO₂ (30) shows the lungs blowing off CO₂ to compensate (think Kussmaul breathing).

THE TRICK: ROME: Respiratory Opposite, Metabolic Equal. Here pH and HCO₃⁻ move the SAME way (both down) → metabolic problem.

EXAM TIP: decide acidosis/alkalosis from pH, then see whether HCO₃⁻ (metabolic) or CO₂ (respiratory) matches its direction.`,
    wrong: {
      0: `Respiratory acidosis would show a HIGH PaCO₂, not a low one.`,
      2: `Respiratory alkalosis would have a HIGH pH.`,
      3: `Metabolic alkalosis would have a high pH and high HCO₃⁻.`
    }
  },
  xa2: {
    exp: `ANSWER: by generating angiotensin II, which vasoconstricts and stimulates aldosterone.

WHY: renin is an enzyme. It converts angiotensinogen → angiotensin I; then ACE (mostly in the lungs) converts angiotensin I → angiotensin II. Angiotensin II is the active player, a potent vasoconstrictor that also triggers aldosterone (Na⁺/water retention) and ADH, all raising BP.

EXAM TIP: renin starts the cascade but does NOT raise BP directly. Angiotensin II does the work (RAAS).`,
    wrong: {
      0: `Renin is an enzyme. It does not directly constrict vessels.`,
      1: `Renin first makes angiotensin I; ACE then converts it to angiotensin II. It is not a single step.`,
      3: `Angiotensin II actually STIMULATES ADH to retain water, rather than inhibiting it.`
    }
  },
  xa3: {
    exp: `ANSWER: increased CO₂, decreased pH (acidosis) and increased temperature, all cause a RIGHT shift.

WHY: a right shift (Bohr effect) means haemoglobin releases O₂ more readily. Exactly what active, metabolising tissue needs. The triggers are the markers of busy tissue: ↑CO₂, ↑H⁺ (↓pH), ↑temperature, and ↑2,3-DPG.

LEFT SHIFT (Hb holds O₂): the opposites: ↓CO₂, alkalosis, hypothermia, ↓2,3-DPG, and fetal haemoglobin.

EXAM TIP: "hot, acidic, CO₂-rich exercising muscle = right shift = give up O₂."`,
    wrong: {
      3: `DECREASED 2,3-DPG causes a LEFT shift (Hb holds onto O₂), the opposite of the question's intent.`
    }
  },

  // ---- EXTENDED: MEDICAL–SURGICAL ----
  xm1: {
    exp: `ANSWER: the right coronary artery (RCA).

WHY: ST elevation in leads II, III and aVF localises to the INFERIOR wall, which the RCA supplies in most people. The RCA also feeds the SA/AV nodes, so inferior MIs can cause bradycardia or heart block.

THE TERRITORY MAP: LAD = anterior (V1–V4); circumflex = lateral (I, aVL, V5–V6); RCA = inferior (II, III, aVF).

EXAM TIP: "inferior leads (II, III, aVF) = RCA. Watch the heart rate."`,
    wrong: {
      0: `LAD occlusion causes an ANTERIOR MI (V1–V4), not inferior changes.`,
      2: `The circumflex supplies the LATERAL wall (I, aVL, V5–V6).`,
      3: `Left-main occlusion is catastrophic, affecting a large anterolateral territory rather than the isolated inferior leads.`
    }
  },
  xm2: {
    exp: `ANSWER: rule out haemorrhage with a non-contrast CT head.

WHY: thrombolytics (rtPA) dissolve clots, giving them in a HAEMORRHAGIC stroke is fatal. A non-contrast CT must first confirm the stroke is ischaemic. rtPA is only for ischaemic stroke within the window (≤4.5 h).

AROUND tPA: aspirin is withheld for 24 h after thrombolysis; heparin is not routine acutely; BP is treated only if very high (>185/110) before giving tPA.

EXAM TIP: "no clot-buster before CT", exclude bleeding first, every time.`,
    wrong: {
      0: `Aspirin is delayed for 24 h after thrombolysis to limit bleeding.`,
      2: `Heparin is not standard acute therapy and adds bleeding risk.`,
      3: `Aggressively normalising BP can worsen cerebral perfusion; only extreme hypertension is treated before tPA.`
    }
  },
  xm3: {
    exp: `ANSWER: chronic CO₂ retainers rely on hypoxic drive; high O₂ can blunt that drive and worsen CO₂ retention.

WHY: in long-standing CO₂-retaining COPD, the brain's CO₂ sensors are desensitised, so breathing is partly driven by LOW oxygen. Flooding the patient with O₂ removes that stimulus and also worsens V/Q matching, pushing CO₂ up toward narcosis.

TARGET: controlled low-flow O₂ to SpO₂ ~88–92% (e.g. Venturi mask).

EXAM TIP: in known CO₂-retaining COPD, aim 88–92%. Don't over-oxygenate.`,
    wrong: {
      0: `Oxygen toxicity needs prolonged HIGH concentrations, not minutes. It is not the reason here.`,
      2: `Airway drying is managed by humidification and is not the core danger.`,
      3: `Fire risk exists with oxygen but is not the physiological reason for caution.`
    }
  },

  // ---- EXTENDED: PHARMACOLOGY ----
  xp1: {
    exp: `ANSWER: monitor aPTT; reverse with protamine sulphate.

WHY: unfractionated heparin works fast and is tracked by the aPTT; its specific antidote is protamine sulphate. (Also watch the platelet count for HIT, heparin-induced thrombocytopenia.)

DON'T CONFUSE WITH WARFARIN: warfarin is monitored by INR/PT and reversed by vitamin K (± FFP/PCC if urgent).

EXAM TIP: heparin → aPTT → protamine; warfarin → INR → vitamin K. Examiners love to swap the pairs.`,
    wrong: {
      0: `INR + vitamin K belong to WARFARIN, not heparin.`,
      2: `FFP is not the specific heparin antidote. Protamine is.`,
      3: `Vitamin K reverses warfarin; the aPTT is right but the antidote is wrong.`
    }
  },
  xp2: {
    exp: `ANSWER: around 1030: about 2–3 hours after the 0800 dose.

WHY: regular (short-acting) insulin has onset ~30 min, PEAK ~2–3 h, duration ~6–8 h. Hypoglycaemia is most likely at the PEAK, so 0800 + ~2.5 h ≈ 1030.

KNOW THE PEAKS: rapid (lispro/aspart) ~1 h; regular ~2–3 h; NPH ~4–12 h; glargine essentially peakless.

EXAM TIP: match "when is hypoglycaemia likely" to the insulin's PEAK time, not its onset.`,
    wrong: {
      0: `0815 is only 15 minutes in. Before regular insulin has meaningfully started.`,
      2: `1700 is past regular insulin's main action window.`,
      3: `Midnight is well beyond its duration.`
    }
  },
  xp3: {
    exp: `ANSWER: hypotension is NOT expected with long-term corticosteroids.

WHY: glucocorticoids have a mineralocorticoid effect, they retain sodium and water, which tends to RAISE blood pressure, not lower it.

WHAT TO MONITOR: hyperglycaemia, osteoporosis, hypokalaemia (Na⁺ retention drives K⁺ loss), weight gain, infection risk, peptic ulcer, mood change, Cushingoid features. Never stop steroids abruptly, risk of adrenal crisis.

EXAM TIP: steroids cause HYPERtension; if "hypotension" appears in a steroid side-effect list, it's the odd one out.`,
    wrong: {
      0: `Steroids raise blood glucose. Hyperglycaemia is a genuine effect to monitor.`,
      1: `Long-term steroids cause bone loss (osteoporosis), genuine.`,
      2: `Sodium retention drives potassium loss → hypokalaemia, genuine.`
    }
  },

  // ---- EXTENDED: PAEDIATRICS ----
  xpe1: {
    exp: `ANSWER: BCG, OPV-0 and the Hepatitis B birth dose are given AT BIRTH.

WHY: birth doses target threats that strike earliest, severe childhood TB, polio, and vertical (mother-to-baby) hepatitis B transmission. The Hep B birth dose ideally goes in within 24 hours.

LATER: DPT (inside the pentavalent) starts at 6 weeks; measles/MR is given at 9–12 months.

EXAM TIP: the "birth trio" is BCG + OPV-0 + Hep B-0. DPT and measles are NOT birth doses.`,
    wrong: {
      3: `DPT (within pentavalent) begins at 6 weeks, not at birth.`,
      4: `Measles / MR is given at 9–12 months.`
    }
  },
  xpe2: {
    exp: `ANSWER: 6–8 months: when an infant sits without support.

WHY: motor control develops head-to-toe. By 6–8 months trunk control is mature enough for independent sitting.

THE MILESTONE LADDER: head control ~3–4 mo, rolls over ~5 mo, sits unsupported ~6–8 mo, crawls ~9 mo, stands with support ~9–10 mo, walks ~12–15 mo.

EXAM TIP: "sits at six" is the memory hook; marked delay warrants developmental assessment.`,
    wrong: {
      0: `At 2 months the infant only briefly lifts the head when prone.`,
      1: `At 4 months head control is developing but independent sitting is not yet expected.`,
      3: `By 12 months most infants are pulling to stand and beginning to walk.`
    }
  },
  xpe3: {
    exp: `ANSWER: Respiration: the fifth APGAR component.

WHY: APGAR = Appearance (colour), Pulse (heart rate), Grimace (reflex irritability), Activity (muscle tone), Respiration (respiratory effort). Each is scored 0–2 at 1 and 5 minutes.

SCORING: 7–10 normal, 4–6 moderately depressed, 0–3 severely depressed (needs resuscitation).

EXAM TIP: the mnemonic APGAR itself gives the five words. Respiration completes it.`,
    wrong: {
      0: `"Reflex" is already captured under Grimace, so it is not the separate fifth term.`,
      2: `"Reaction" is not an APGAR component.`,
      3: `Heart rate is captured under Pulse; "Rate" alone is not the APGAR term.`
    }
  },

  // ---- EXTENDED: OBSTETRICS ----
  xo1: {
    exp: `ANSWER: respiratory rate 10/min with absent knee reflexes. Magnesium toxicity; stop the infusion.

WHY: magnesium toxicity follows a predictable ladder: loss of deep-tendon reflexes → respiratory depression (<12/min) → cardiac arrest. Absent reflexes plus RR 10 means it has reached a dangerous level.

MONITOR & ANTIDOTE: check reflexes, keep RR ≥12/min and urine output ≥30 mL/hr (Mg is renally cleared). Antidote: IV calcium gluconate.

EXAM TIP: first sign of Mg toxicity = lost reflexes; act before respiration fails.`,
    wrong: {
      0: `Brisk reflexes suggest the magnesium level is NOT yet toxic. Reassuring, not a stop signal.`,
      2: `Urine output 60 mL/hr is adequate (≥30 mL/hr), reassuring.`,
      3: `BP 150/95 reflects the pre-eclampsia being treated, not magnesium toxicity.`
    }
  },
  xo2: {
    exp: `ANSWER: full cervical dilatation to delivery of the baby, the second stage of labour.

WHY: once the cervix is fully (10 cm) dilated, the mother pushes the baby out; that interval is the second stage.

THE FULL SEQUENCE: Stage 1 = true contractions → full dilatation; Stage 2 = full dilatation → birth; Stage 3 = birth → placenta; Stage 4 = ~1 h recovery after the placenta (watch for PPH).

EXAM TIP: anchor each stage by its END point. Stage 2 ends with the baby's birth.`,
    wrong: {
      0: `Onset of contractions to full dilatation is the FIRST stage.`,
      2: `Birth of the baby to delivery of the placenta is the THIRD stage.`,
      3: `The first hour after delivery is the FOURTH stage.`
    }
  },
  xo3: {
    exp: `ANSWER: uterine atony: the commonest cause of primary PPH.

WHY: a uterus that fails to contract ("boggy") leaves the placental-bed vessels open and bleeding. Atony causes ~70–80% of primary PPH.

THE "4 Ts": Tone (atony) → Tissue (retained products) → Trauma (lacerations) → Thrombin (coagulopathy). First action for atony: firm fundal massage plus uterotonics (oxytocin).

EXAM TIP: soft, boggy uterus + heavy bleeding = atony, massage and oxytocin first.`,
    wrong: {
      0: `Retained tissue is a real cause but far less common than atony.`,
      2: `Trauma matters when the uterus is firm yet still bleeding.`,
      3: `Coagulopathy (Thrombin) is the least common of the 4 Ts.`
    }
  },

  // ---- EXTENDED: COMMUNITY HEALTH ----
  xc1: {
    exp: `ANSWER: herd immunity.

WHY: when a high enough share of a population is immune, transmission chains break, indirectly protecting those who cannot be vaccinated (newborns, the immunocompromised).

THE THRESHOLD: depends on R₀ ≈ 1 − (1/R₀); highly transmissible diseases like measles need ~95% coverage.

DON'T CONFUSE: passive immunity = ready-made antibodies (maternal/immunoglobulin), short-lived and individual, not community-level.

EXAM TIP: "protecting the unvaccinated by vaccinating the many" = herd immunity.`,
    wrong: {
      1: `Passive immunity is the transfer of pre-formed antibodies and is short-lived, it protects an individual, not the herd.`,
      2: `Cold chain is the temperature-controlled vaccine supply system.`,
      3: `Cross immunity is protection against a related organism, a different concept.`
    }
  },
  xc2: {
    exp: `ANSWER: kill pathogenic micro-organisms, the aim of chlorination.

WHY: chlorine disinfects water by killing pathogens. A minimum free residual chlorine of 0.5 mg/L after 1 hour of contact confirms adequate dosing (checked by the orthotolidine test).

ORDER MATTERS: turbidity must be removed FIRST by sedimentation and filtration, because chlorine works poorly in cloudy water.

EXAM TIP: chlorine = disinfection (kills germs); it does NOT clarify, soften, or de-iron water.`,
    wrong: {
      0: `Turbidity is removed earlier by sedimentation and filtration, not by chlorine.`,
      1: `Hardness is reduced by water-softening methods, not chlorination.`,
      3: `Iron is removed by aeration/oxidation, not by chlorination.`
    }
  },
  xc3: {
    exp: `ANSWER: 1,000 live births in the same year.

WHY: IMR = (infant deaths under 1 year ÷ live births in the same year) × 1,000. Live births are the population truly at risk, so they form the denominator. IMR is a sensitive index of a population's overall health and socio-economic status.

DON'T CONFUSE: U5MR (per 1000 live births), Neonatal MR (<28 days), and Maternal Mortality Ratio (per 100,000 live births).

EXAM TIP: "infant deaths per 1000 LIVE BIRTHS", not per population.`,
    wrong: {
      0: `Mid-year population is the base for the crude death rate, not IMR.`,
      2: `Per 100,000 women relates to maternal mortality.`,
      3: `Under-5 deaths per 1000 live births is the U5MR, a different indicator.`
    }
  },

  // ---- EXTENDED: MENTAL HEALTH ----
  xmh1: {
    exp: `ANSWER: displacement.

WHY: the man transfers his feelings from a threatening target (his boss) onto a safer one (his children). Redirecting an emotion to a less dangerous object is displacement.

CONTRAST: projection = attributing your own feelings to someone else; sublimation (mature) = channelling the impulse into something constructive (aggression → sport); reaction formation = acting the opposite of the true feeling.

EXAM TIP: displacement = "kick the dog", the anger lands on a substitute target.`,
    wrong: {
      0: `Projection attributes one's OWN feelings/impulses to another person.`,
      2: `Sublimation channels the impulse into a constructive outlet (a mature defence).`,
      3: `Reaction formation is acting opposite to one's true feelings.`
    }
  },
  xmh2: {
    exp: `ANSWER: withhold the next dose and check the serum lithium level.

WHY: coarse tremor, vomiting, slurred speech and ataxia are lithium toxicity (therapeutic 0.6–1.2 mEq/L; toxic >1.5). Stop giving the drug and confirm with a level.

THE SODIUM LINK: the kidney handles lithium like sodium, so low salt or dehydration RAISES lithium toward toxicity. Maintain normal salt and fluids, never restrict.

EXAM TIP: lithium toxicity → hold the dose, check a level, keep salt/fluids normal.`,
    wrong: {
      0: `A low-sodium diet RAISES lithium levels and worsens toxicity.`,
      2: `Fluid restriction / dehydration increases lithium reabsorption, dangerous.`,
      3: `Giving more lithium during toxicity is harmful.`
    }
  },
  xmh3: {
    exp: `ANSWER: "You seem upset: tell me more about what you're feeling."

WHY: pairing an observation with an open-ended invitation encourages the patient to express feelings, the heart of therapeutic communication. It shows attention without judging or directing.

THE BLOCKS TO AVOID: "why" questions (sound accusatory), false reassurance (dismisses feelings), and changing the subject (shuts communication down). Helpful tools: active listening, silence, reflection, clarification.

EXAM TIP: the therapeutic choice is usually the open-ended, feeling-focused one.`,
    wrong: {
      0: `"Why did you do that?" can feel interrogating and put the patient on the defensive.`,
      1: `"Everything will be fine" is false reassurance, it dismisses real concerns.`,
      3: `Changing the subject is a communication block.`
    }
  },

  // ---- EXTENDED: MICROBIOLOGY ----
  xmi1: {
    exp: `ANSWER: a biological indicator using Geobacillus stearothermophilus spores.

WHY: these heat-resistant spores are the GOLD STANDARD test. If even they are killed, the cycle truly sterilised. Chemical/tape indicators only prove the item was EXPOSED to heat, not that organisms died.

CONTEXT: standard autoclave parameters are 121 °C / 15 psi / 15 min (or 134 °C for 3 min).

EXAM TIP: "confirm sterilisation = biological (spore) indicator," not tape or a timer.`,
    wrong: {
      0: `Tape only confirms the item was exposed to the process, not that microbes were actually killed.`,
      2: `A timer shows duration, not biological kill.`,
      3: `Visual cleanliness says nothing about microbial sterility.`
    }
  },
  xmi2: {
    exp: `ANSWER: pulmonary TB, measles and chickenpox (varicella) need AIRBORNE precautions.

WHY: these spread in tiny droplet nuclei (<5 µm) that stay suspended in air and travel on currents, so they need a negative-pressure room and an N95 respirator.

MEMORY HOOK: "My-T-V" → Measles, TB, Varicella (plus disseminated zoster).

EXAM TIP: influenza is DROPLET (>5 µm), surgical mask, not airborne.`,
    wrong: {
      3: `Influenza spreads by larger DROPLETS, so it needs droplet precautions (surgical mask), not airborne.`
    }
  },
  xmi3: {
    exp: `ANSWER: Hepatitis B immunoglobulin (HBIG) plus start the vaccine series.

WHY: a non-immune person exposed to an HBsAg-positive source needs BOTH passive protection now (HBIG = ready-made antibodies) AND active long-term immunity (the vaccine series), ideally within 24 hours.

FIRST STEPS: wash the site with soap and water, then report and document. Antibiotics do nothing against a virus.

EXAM TIP: known Hep-B-positive source + unvaccinated nurse = HBIG + vaccine, fast.`,
    wrong: {
      0: `Vaccine alone is too slow against a known positive source, add HBIG for immediate cover.`,
      2: `Antibiotics are useless against a virus.`,
      3: `Doing nothing risks seroconversion; prophylaxis is time-critical.`
    }
  },

  // ---- EXTENDED: NUTRITION ----
  xn1: {
    exp: `ANSWER: Vitamin A deficiency.

WHY: night blindness, conjunctival xerosis and Bitot's spots are the classic ocular signs of vitamin A deficiency, which progresses to keratomalacia and irreversible blindness if untreated.

INDIA'S RESPONSE: the Vitamin A prophylaxis programme gives 1 lakh IU at 9 months, then 2 lakh IU 6-monthly up to age 5.

EXAM TIP: "Bitot's spots + night blindness = vitamin A", a favourite NORCET pairing.`,
    wrong: {
      1: `Vitamin C deficiency causes scurvy (bleeding gums, poor wound healing).`,
      2: `Vitamin D deficiency causes rickets / osteomalacia.`,
      3: `Vitamin K deficiency causes bleeding from impaired clotting factors.`
    }
  },
  xn2: {
    exp: `ANSWER: Kwashiorkor.

WHY: protein deficiency with relatively adequate calories produces the picture described, generalised pitting OEDEMA, "flaky-paint" dermatosis, a puffy "moon" face, fatty liver and apathy.

CONTRAST: marasmus is an energy (calorie) deficiency → severe wasting and an "old-man" face, but NO oedema. Oedema is the feature that points to kwashiorkor.

EXAM TIP: oedema + skin/hair changes = kwashiorkor; severe wasting without oedema = marasmus.`,
    wrong: {
      0: `Marasmus shows severe wasting WITHOUT oedema.`,
      2: `Marasmic-kwashiorkor has both wasting AND oedema; the puffy, non-wasted picture here fits pure kwashiorkor.`,
      3: `Nutritional dwarfism is stunting from chronic undernutrition, without the acute oedema.`
    }
  },
  xn3: {
    exp: `ANSWER: low protein with restricted potassium and phosphorus, the pre-dialysis CKD diet.

WHY: before dialysis, restricting protein lowers urea/nitrogenous waste; restricting potassium prevents hyperkalaemic arrhythmia; restricting phosphorus limits renal bone disease; sodium and fluid are controlled for oedema and BP. Calories are kept adequate to prevent catabolism.

THE SWITCH ON DIALYSIS: protein needs INCREASE once dialysis begins, because dialysis removes amino acids.

EXAM TIP: pre-dialysis = LOW protein; on dialysis = HIGH protein.`,
    wrong: {
      0: `High potassium is dangerous in CKD, and protein is restricted pre-dialysis. This option is wrong on both counts.`,
      2: `Sodium and fluid are RESTRICTED to control oedema and BP, not increased.`,
      3: `Phosphorus is restricted; calcium balance is managed with binders, not phosphorus loading.`
    }
  },

};
