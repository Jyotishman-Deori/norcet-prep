// =====================================================================
// src/data/sorter-cases.js — NEW-10 (Module A) "The Sorter".
// Tap-to-sort drills: drop each item into the correct bin. Two high-yield
// NORCET sets to launch — Bio-Medical Waste segregation (BMW Rules 2016
// colour coding) and Isolation Precautions (transmission-based). Items are
// text + emoji (zero asset). Each item carries the rationale shown on review.
// Content is seed; easily extended as the question bank grows.
// =====================================================================
export const SORTER_CASES = [
  {
    id: 'bmw',
    title: 'Bio-Medical Waste',
    instruction: 'Segregate each item into the correct colour bin (BMW Rules 2016).',
    bins: [
      { id: 'yellow', label: 'Yellow', color: '#E0A500', hint: 'Anatomical / soiled / expired meds' },
      { id: 'red',    label: 'Red',    color: '#DC2626', hint: 'Contaminated recyclable plastic' },
      { id: 'white',  label: 'White',  color: '#64748B', hint: 'Sharps (puncture-proof)' },
      { id: 'blue',   label: 'Blue',   color: '#2563EB', hint: 'Glassware & metallic implants' },
    ],
    items: [
      { id: 'i1', text: 'Used needle (sharp)', emoji: '💉', bin: 'white', why: 'Sharps — needles, blades, scalpels — go in the WHITE translucent puncture-proof container.' },
      { id: 'i2', text: 'Blood-soaked dressing', emoji: '🩹', bin: 'yellow', why: 'Soiled/infectious solid waste goes in YELLOW (incineration).' },
      { id: 'i3', text: 'Empty IV set & tubing', emoji: '🧪', bin: 'red', why: 'Contaminated recyclable plastics — IV sets, tubing, catheters, gloves — go in RED.' },
      { id: 'i4', text: 'Broken glass ampoule', emoji: '🍶', bin: 'blue', why: 'Broken/discarded glass, vials and metallic implants go in BLUE.' },
      { id: 'i5', text: 'Placenta / anatomical waste', emoji: '🫀', bin: 'yellow', why: 'Human anatomical waste goes in YELLOW for incineration.' },
      { id: 'i6', text: 'Used examination gloves', emoji: '🧤', bin: 'red', why: 'Contaminated gloves are RED-bin recyclable plastic — a classic trap (not yellow).' },
      { id: 'i7', text: 'Expired tablets', emoji: '💊', bin: 'yellow', why: 'Discarded/expired medicines go in YELLOW.' },
      { id: 'i8', text: 'Scalpel blade', emoji: '🔪', bin: 'white', why: 'Blades are sharps → WHITE puncture-proof container.' },
    ],
  },
  {
    id: 'isolation',
    title: 'Isolation Precautions',
    instruction: 'Place each condition under its transmission-based precaution.',
    bins: [
      { id: 'airborne', label: 'Airborne', color: '#7C3AED', hint: 'N95 + negative-pressure room' },
      { id: 'droplet',  label: 'Droplet',  color: '#0891B2', hint: 'Surgical mask within 1 m' },
      { id: 'contact',  label: 'Contact',  color: '#16A34A', hint: 'Gown + gloves' },
    ],
    items: [
      { id: 'j1', text: 'Pulmonary Tuberculosis', emoji: '🫁', bin: 'airborne', why: 'TB spreads by tiny droplet nuclei → AIRBORNE: N95 + negative-pressure room.' },
      { id: 'j2', text: 'Measles', emoji: '🔴', bin: 'airborne', why: 'Measles (and varicella) are AIRBORNE — among the few that need N95.' },
      { id: 'j3', text: 'Influenza', emoji: '🤧', bin: 'droplet', why: 'Flu spreads by large respiratory droplets → DROPLET: surgical mask within ~1 m.' },
      { id: 'j4', text: 'Meningococcal meningitis', emoji: '🧠', bin: 'droplet', why: 'Neisseria meningitidis is DROPLET precaution (first 24 h of therapy).' },
      { id: 'j5', text: 'C. difficile diarrhoea', emoji: '🦠', bin: 'contact', why: 'C. difficile → CONTACT precautions + soap-and-water hand wash (alcohol gel won’t kill spores).' },
      { id: 'j6', text: 'MRSA wound', emoji: '🩹', bin: 'contact', why: 'MRSA spreads by direct/indirect contact → gown + gloves.' },
      { id: 'j7', text: 'Chickenpox (varicella)', emoji: '💧', bin: 'airborne', why: 'Varicella is AIRBORNE + contact — needs a negative-pressure room.' },
      { id: 'j8', text: 'Scabies', emoji: '🐛', bin: 'contact', why: 'Scabies spreads by skin contact → CONTACT precautions.' },
    ],
  },

  {
    id: 'triage', title: 'START Triage', instruction: 'Tag each casualty by triage priority (mass-casualty START).',
    bins: [
      { id: 'red', label: 'Red', color: '#DC2626', hint: 'Immediate — life threat' },
      { id: 'yellow', label: 'Yellow', color: '#D97706', hint: 'Delayed — can wait' },
      { id: 'green', label: 'Green', color: '#16A34A', hint: 'Minor — walking' },
      { id: 'black', label: 'Black', color: '#475569', hint: 'Expectant / deceased' },
    ],
    items: [
      { id: 'tr1', text: 'RR 40, no radial pulse', emoji: '🫁', bin: 'red', why: 'Deranged airway/breathing/circulation = immediate (Red).' },
      { id: 'tr2', text: 'Controlled bleed, confused', emoji: '🩸', bin: 'red', why: 'Altered mental status + major injury → immediate (Red).' },
      { id: 'tr3', text: 'Closed femur fracture, stable obs', emoji: '🦴', bin: 'yellow', why: 'Serious but stable, can wait briefly → delayed (Yellow).' },
      { id: 'tr4', text: 'Deep forearm laceration, normal obs', emoji: '🩹', bin: 'yellow', why: 'Needs care but not immediately life-threatening → Yellow.' },
      { id: 'tr5', text: 'Walking with minor cuts', emoji: '🚶', bin: 'green', why: 'Ambulant, minor injury → Green (walking wounded).' },
      { id: 'tr6', text: 'Sprained ankle, ambulant', emoji: '🦶', bin: 'green', why: 'Minor, can wait a long time → Green.' },
      { id: 'tr7', text: 'Not breathing after airway opened', emoji: '⚫', bin: 'black', why: 'Apnoeic despite airway opening in START → Expectant (Black).' },
    ],
  },

  {
    id: 'hypersensitivity', title: 'Hypersensitivity Types', instruction: 'Sort each reaction into its Gell & Coombs type.',
    bins: [
      { id: 'type1', label: 'Type I', color: '#DC2626', hint: 'IgE / immediate' },
      { id: 'type2', label: 'Type II', color: '#D97706', hint: 'Antibody-mediated cytotoxic' },
      { id: 'type3', label: 'Type III', color: '#7C3AED', hint: 'Immune-complex' },
      { id: 'type4', label: 'Type IV', color: '#0891B2', hint: 'Delayed / cell-mediated' },
    ],
    items: [
      { id: 'hs1', text: 'Anaphylaxis', emoji: '🐝', bin: 'type1', why: 'IgE-mediated immediate hypersensitivity = Type I.' },
      { id: 'hs2', text: 'Allergic asthma', emoji: '🌬️', bin: 'type1', why: 'IgE-driven mast-cell release = Type I.' },
      { id: 'hs3', text: 'Haemolytic transfusion reaction', emoji: '🩸', bin: 'type2', why: 'Antibodies against red-cell antigens = Type II cytotoxic.' },
      { id: 'hs4', text: 'Rh incompatibility', emoji: '🤰', bin: 'type2', why: 'Maternal antibodies destroy fetal RBCs = Type II.' },
      { id: 'hs5', text: 'SLE', emoji: '🦋', bin: 'type3', why: 'Immune-complex deposition = Type III.' },
      { id: 'hs6', text: 'Post-strep glomerulonephritis', emoji: '🫘', bin: 'type3', why: 'Immune complexes in the glomerulus = Type III.' },
      { id: 'hs7', text: 'Mantoux (TB) test', emoji: '💉', bin: 'type4', why: 'Delayed T-cell response at 48–72 h = Type IV.' },
      { id: 'hs8', text: 'Contact dermatitis', emoji: '🧴', bin: 'type4', why: 'Cell-mediated delayed reaction = Type IV.' },
    ],
  },

  {
    id: 'vitamins', title: 'Vitamin Deficiencies', instruction: 'Match each deficiency disease to the missing vitamin.',
    bins: [
      { id: 'a', label: 'Vitamin A', color: '#D97706', hint: 'Retinol' },
      { id: 'b', label: 'B-complex', color: '#16A34A', hint: 'Thiamine / niacin / B12' },
      { id: 'c', label: 'Vitamin C', color: '#DC2626', hint: 'Ascorbic acid' },
      { id: 'd', label: 'Vitamin D', color: '#2563EB', hint: 'Calciferol' },
    ],
    items: [
      { id: 'v1', text: 'Night blindness', emoji: '🌙', bin: 'a', why: 'Earliest sign of vitamin A deficiency.' },
      { id: 'v2', text: "Bitot's spots", emoji: '👁️', bin: 'a', why: 'Conjunctival sign of vitamin A deficiency.' },
      { id: 'v3', text: 'Beri-beri', emoji: '🦵', bin: 'b', why: 'Thiamine (B1) deficiency.' },
      { id: 'v4', text: 'Pellagra (3 Ds)', emoji: '🌽', bin: 'b', why: 'Niacin (B3) deficiency — dermatitis, diarrhoea, dementia.' },
      { id: 'v5', text: 'Scurvy', emoji: '🍋', bin: 'c', why: 'Vitamin C deficiency — bleeding gums, poor healing.' },
      { id: 'v6', text: 'Rickets', emoji: '🦴', bin: 'd', why: 'Vitamin D deficiency in children.' },
      { id: 'v7', text: 'Osteomalacia', emoji: '🦴', bin: 'd', why: 'Vitamin D deficiency in adults.' },
      { id: 'v8', text: 'Pernicious anaemia', emoji: '🩸', bin: 'b', why: 'Vitamin B12 deficiency.' },
    ],
  },

  {
    id: 'immunity', title: 'Types of Immunity', instruction: 'Classify each as active/passive and natural/artificial.',
    bins: [
      { id: 'an', label: 'Active natural', color: '#16A34A', hint: 'Infection → own antibodies' },
      { id: 'aa', label: 'Active artificial', color: '#2563EB', hint: 'Vaccine → own antibodies' },
      { id: 'pn', label: 'Passive natural', color: '#D97706', hint: 'Mother → baby' },
      { id: 'pa', label: 'Passive artificial', color: '#7C3AED', hint: 'Ready-made antibodies given' },
    ],
    items: [
      { id: 'im1', text: 'Recovering from measles', emoji: '🦠', bin: 'an', why: 'Infection makes your own antibodies = active natural.' },
      { id: 'im2', text: 'Measles vaccine', emoji: '💉', bin: 'aa', why: 'Vaccine triggers your own antibodies = active artificial.' },
      { id: 'im3', text: 'Antibodies across the placenta', emoji: '🤰', bin: 'pn', why: 'Mother → fetus ready-made antibodies = passive natural.' },
      { id: 'im4', text: 'Breast-milk antibodies', emoji: '🍼', bin: 'pn', why: 'Maternal IgA via milk = passive natural.' },
      { id: 'im5', text: 'Anti-rabies immunoglobulin', emoji: '🐕', bin: 'pa', why: 'Ready-made antibodies injected = passive artificial.' },
      { id: 'im6', text: 'Anti-snake-venom serum', emoji: '🐍', bin: 'pa', why: 'Pre-formed antibodies given = passive artificial.' },
      { id: 'im7', text: 'Tetanus toxoid', emoji: '🩹', bin: 'aa', why: 'Toxoid vaccine → own antibodies = active artificial.' },
    ],
  },

  {
    id: 'insulin', title: 'Insulin Types', instruction: 'Sort each insulin by its action onset.',
    bins: [
      { id: 'rapid', label: 'Rapid-acting', color: '#DC2626', hint: 'Onset 5–15 min' },
      { id: 'short', label: 'Short-acting', color: '#D97706', hint: 'Onset ~30 min' },
      { id: 'inter', label: 'Intermediate', color: '#16A34A', hint: 'Onset 1–2 h' },
      { id: 'long', label: 'Long-acting', color: '#2563EB', hint: '~24 h, no peak' },
    ],
    items: [
      { id: 'in1', text: 'Lispro', emoji: '⚡', bin: 'rapid', why: 'Rapid-acting analogue — give with meals.' },
      { id: 'in2', text: 'Aspart', emoji: '⚡', bin: 'rapid', why: 'Rapid-acting analogue.' },
      { id: 'in3', text: 'Regular (Actrapid)', emoji: '🕐', bin: 'short', why: 'Short-acting — give ~30 min before meals.' },
      { id: 'in4', text: 'NPH (Insulatard)', emoji: '🕑', bin: 'inter', why: 'Intermediate-acting, peaks 4–10 h.' },
      { id: 'in5', text: 'Glargine', emoji: '🌙', bin: 'long', why: 'Long-acting basal, ~24 h, peakless.' },
      { id: 'in6', text: 'Detemir', emoji: '🌙', bin: 'long', why: 'Long-acting basal insulin.' },
    ],
  },

  {
    id: 'prevention', title: 'Levels of Prevention', instruction: 'Sort each activity into its level of prevention.',
    bins: [
      { id: 'primordial', label: 'Primordial', color: '#7C3AED', hint: 'Prevent the risk factor' },
      { id: 'primary', label: 'Primary', color: '#16A34A', hint: 'Prevent disease' },
      { id: 'secondary', label: 'Secondary', color: '#D97706', hint: 'Early detection' },
      { id: 'tertiary', label: 'Tertiary', color: '#DC2626', hint: 'Limit disability' },
    ],
    items: [
      { id: 'pv1', text: 'Promoting healthy lifestyle in a whole population', emoji: '🌍', bin: 'primordial', why: 'Stops risk factors arising = primordial.' },
      { id: 'pv2', text: 'BCG immunisation', emoji: '💉', bin: 'primary', why: 'Prevents disease before it occurs = primary.' },
      { id: 'pv3', text: 'Pap smear screening', emoji: '🔬', bin: 'secondary', why: 'Early detection in the asymptomatic stage = secondary.' },
      { id: 'pv4', text: 'Mammography', emoji: '🩻', bin: 'secondary', why: 'Screening for early cancer = secondary.' },
      { id: 'pv5', text: 'Stroke rehabilitation', emoji: '♿', bin: 'tertiary', why: 'Limiting disability in established disease = tertiary.' },
      { id: 'pv6', text: 'Diabetic foot care to prevent amputation', emoji: '🦶', bin: 'tertiary', why: 'Preventing complications/disability = tertiary.' },
      { id: 'pv7', text: 'Anti-tobacco health education', emoji: '🚭', bin: 'primary', why: 'Reduces exposure to prevent disease = primary.' },
    ],
  },

  {
    id: 'shock', title: 'Types of Shock', instruction: 'Sort each cause into its type of shock.',
    bins: [
      { id: 'hypo', label: 'Hypovolaemic', color: '#DC2626', hint: 'Volume loss' },
      { id: 'cardio', label: 'Cardiogenic', color: '#7C3AED', hint: 'Pump failure' },
      { id: 'distrib', label: 'Distributive', color: '#D97706', hint: 'Vasodilation' },
      { id: 'obstruct', label: 'Obstructive', color: '#2563EB', hint: 'Mechanical block' },
    ],
    items: [
      { id: 'sh1', text: 'Major haemorrhage', emoji: '🩸', bin: 'hypo', why: 'Blood-volume loss = hypovolaemic.' },
      { id: 'sh2', text: 'Extensive burns', emoji: '🔥', bin: 'hypo', why: 'Plasma/fluid loss = hypovolaemic.' },
      { id: 'sh3', text: 'Acute myocardial infarction', emoji: '❤️', bin: 'cardio', why: 'Pump failure = cardiogenic.' },
      { id: 'sh4', text: 'Anaphylaxis', emoji: '🐝', bin: 'distrib', why: 'Massive vasodilation = distributive.' },
      { id: 'sh5', text: 'Septicaemia', emoji: '🦠', bin: 'distrib', why: 'Vasodilation from sepsis = distributive.' },
      { id: 'sh6', text: 'Tension pneumothorax', emoji: '🫁', bin: 'obstruct', why: 'Mechanical obstruction to filling = obstructive.' },
      { id: 'sh7', text: 'Massive pulmonary embolism', emoji: '🫀', bin: 'obstruct', why: 'Outflow obstruction = obstructive.' },
      { id: 'sh8', text: 'High spinal cord injury', emoji: '🦴', bin: 'distrib', why: 'Neurogenic vasodilation = distributive.' },
    ],
  },

  {
    id: 'cranial', title: 'Cranial Nerves', instruction: 'Sort each cranial nerve by its function.',
    bins: [
      { id: 'sensory', label: 'Sensory', color: '#2563EB', hint: 'Pure sensory' },
      { id: 'motor', label: 'Motor', color: '#DC2626', hint: 'Pure motor' },
      { id: 'mixed', label: 'Mixed', color: '#7C3AED', hint: 'Both' },
    ],
    items: [
      { id: 'cn1', text: 'I — Olfactory', emoji: '👃', bin: 'sensory', why: 'Pure sensory (smell).' },
      { id: 'cn2', text: 'II — Optic', emoji: '👁️', bin: 'sensory', why: 'Pure sensory (vision).' },
      { id: 'cn3', text: 'III — Oculomotor', emoji: '👀', bin: 'motor', why: 'Pure motor (eye movement, pupil).' },
      { id: 'cn4', text: 'V — Trigeminal', emoji: '😬', bin: 'mixed', why: 'Mixed (facial sensation + mastication).' },
      { id: 'cn5', text: 'VII — Facial', emoji: '🙂', bin: 'mixed', why: 'Mixed (facial movement + taste).' },
      { id: 'cn6', text: 'VIII — Vestibulocochlear', emoji: '👂', bin: 'sensory', why: 'Pure sensory (hearing, balance).' },
      { id: 'cn7', text: 'X — Vagus', emoji: '🫀', bin: 'mixed', why: 'Mixed and widely distributed.' },
      { id: 'cn8', text: 'XII — Hypoglossal', emoji: '👅', bin: 'motor', why: 'Pure motor (tongue).' },
    ],
  },

  {
    id: 'acidbase', title: 'Acid-Base Disorders', instruction: 'Sort each cause into its acid-base disturbance.',
    bins: [
      { id: 'racid', label: 'Resp acidosis', color: '#DC2626', hint: '↑CO₂' },
      { id: 'ralk', label: 'Resp alkalosis', color: '#2563EB', hint: '↓CO₂' },
      { id: 'macid', label: 'Metabolic acidosis', color: '#D97706', hint: '↓HCO₃' },
      { id: 'malk', label: 'Metabolic alkalosis', color: '#16A34A', hint: '↑HCO₃' },
    ],
    items: [
      { id: 'ab1', text: 'COPD with CO₂ retention', emoji: '🫁', bin: 'racid', why: 'Hypoventilation retains CO₂ = respiratory acidosis.' },
      { id: 'ab2', text: 'Opioid overdose (low RR)', emoji: '💊', bin: 'racid', why: 'Hypoventilation = respiratory acidosis.' },
      { id: 'ab3', text: 'Anxiety hyperventilation', emoji: '😮‍💨', bin: 'ralk', why: 'Blowing off CO₂ = respiratory alkalosis.' },
      { id: 'ab4', text: 'Diabetic ketoacidosis', emoji: '🍬', bin: 'macid', why: 'Ketoacids = metabolic acidosis.' },
      { id: 'ab5', text: 'Severe diarrhoea', emoji: '🚽', bin: 'macid', why: 'Bicarbonate loss = metabolic acidosis.' },
      { id: 'ab6', text: 'Persistent vomiting', emoji: '🤮', bin: 'malk', why: 'Loss of gastric acid = metabolic alkalosis.' },
      { id: 'ab7', text: 'Excess antacid intake', emoji: '💊', bin: 'malk', why: 'Base load = metabolic alkalosis.' },
      { id: 'ab8', text: 'High-altitude breathing', emoji: '⛰️', bin: 'ralk', why: 'Hyperventilation = respiratory alkalosis.' },
    ],
  },

  {
    id: 'contraception', title: 'Contraceptive Methods', instruction: 'Sort each method into its category.',
    bins: [
      { id: 'barrier', label: 'Barrier', color: '#2563EB', hint: 'Physical block' },
      { id: 'hormonal', label: 'Hormonal', color: '#DB2777', hint: 'Hormone-based' },
      { id: 'iucd', label: 'IUCD', color: '#D97706', hint: 'Intra-uterine device' },
      { id: 'permanent', label: 'Permanent', color: '#475569', hint: 'Sterilisation' },
    ],
    items: [
      { id: 'co1', text: 'Condom', emoji: '🛡️', bin: 'barrier', why: 'Physical barrier method.' },
      { id: 'co2', text: 'Diaphragm', emoji: '🛡️', bin: 'barrier', why: 'Barrier over the cervix.' },
      { id: 'co3', text: 'Combined oral pill', emoji: '💊', bin: 'hormonal', why: 'Oestrogen + progestogen = hormonal.' },
      { id: 'co4', text: 'Contraceptive implant', emoji: '💉', bin: 'hormonal', why: 'Progestogen implant = hormonal.' },
      { id: 'co5', text: 'Copper-T', emoji: '🔵', bin: 'iucd', why: 'Non-hormonal intra-uterine device.' },
      { id: 'co6', text: 'LNG-IUS (Mirena)', emoji: '🔵', bin: 'iucd', why: 'Hormone-releasing intra-uterine device.' },
      { id: 'co7', text: 'Tubectomy', emoji: '✂️', bin: 'permanent', why: 'Female sterilisation = permanent.' },
      { id: 'co8', text: 'Vasectomy', emoji: '✂️', bin: 'permanent', why: 'Male sterilisation = permanent.' },
    ],
  },

  {
    id: 'psych', title: 'Psychiatric Disorders', instruction: 'Sort each disorder into its category.',
    bins: [
      { id: 'psychotic', label: 'Psychotic', color: '#7C3AED', hint: 'Loss of reality' },
      { id: 'mood', label: 'Mood', color: '#2563EB', hint: 'Affective' },
      { id: 'anxiety', label: 'Anxiety', color: '#D97706', hint: 'Fear/worry' },
      { id: 'personality', label: 'Personality', color: '#DC2626', hint: 'Enduring traits' },
    ],
    items: [
      { id: 'ps1', text: 'Schizophrenia', emoji: '🧠', bin: 'psychotic', why: 'Hallucinations/delusions = psychotic disorder.' },
      { id: 'ps2', text: 'Delusional disorder', emoji: '🧠', bin: 'psychotic', why: 'Fixed false beliefs = psychotic.' },
      { id: 'ps3', text: 'Bipolar disorder', emoji: '🎭', bin: 'mood', why: 'Mood swings = mood (affective) disorder.' },
      { id: 'ps4', text: 'Major depression', emoji: '😔', bin: 'mood', why: 'Persistent low mood = mood disorder.' },
      { id: 'ps5', text: 'OCD', emoji: '🔁', bin: 'anxiety', why: 'Obsessions/compulsions = anxiety-spectrum.' },
      { id: 'ps6', text: 'Panic disorder', emoji: '😰', bin: 'anxiety', why: 'Recurrent panic attacks = anxiety disorder.' },
      { id: 'ps7', text: 'Borderline personality', emoji: '🪞', bin: 'personality', why: 'Enduring maladaptive traits = personality disorder.' },
      { id: 'ps8', text: 'Antisocial personality', emoji: '🪞', bin: 'personality', why: 'Pervasive trait pattern = personality disorder.' },
    ],
  },

  {
    id: 'positions', title: 'Patient Positioning', instruction: 'Sort each situation to its best position.',
    bins: [
      { id: 'fowlers', label: "Fowler's", color: '#16A34A', hint: 'Upright, head raised' },
      { id: 'trend', label: 'Trendelenburg', color: '#DC2626', hint: 'Head down' },
      { id: 'leftlat', label: 'Left lateral', color: '#2563EB', hint: 'On left side' },
      { id: 'flat', label: 'Supine / flat', color: '#D97706', hint: 'Lying flat' },
    ],
    items: [
      { id: 'po1', text: 'Severe breathlessness', emoji: '😮‍💨', bin: 'fowlers', why: "High Fowler's eases the work of breathing." },
      { id: 'po2', text: 'Acute pulmonary oedema', emoji: '🫁', bin: 'fowlers', why: 'Upright reduces venous return and eases breathing.' },
      { id: 'po3', text: 'Hypotension / shock', emoji: '🩸', bin: 'trend', why: '(Modified) Trendelenburg aids venous return.' },
      { id: 'po4', text: 'Late-pregnancy hypotension', emoji: '🤰', bin: 'leftlat', why: 'Left lateral relieves IVC compression by the uterus.' },
      { id: 'po5', text: 'Unconscious, protecting airway', emoji: '😴', bin: 'leftlat', why: 'Recovery (left lateral) keeps the airway clear.' },
      { id: 'po6', text: 'After lumbar puncture', emoji: '💉', bin: 'flat', why: 'Lying flat reduces post-LP headache.' },
    ],
  },

  {
    id: 'defence', title: 'Defence Mechanisms', instruction: 'Sort each behaviour into its defence mechanism.',
    bins: [
      { id: 'denial', label: 'Denial', color: '#DC2626', hint: 'Refusing reality' },
      { id: 'projection', label: 'Projection', color: '#7C3AED', hint: 'Blaming others' },
      { id: 'displacement', label: 'Displacement', color: '#D97706', hint: 'Redirecting feeling' },
      { id: 'sublimation', label: 'Sublimation', color: '#16A34A', hint: 'Channelling positively' },
    ],
    items: [
      { id: 'df1', text: '“I’m not sick, the tests are wrong.”', emoji: '🙅', bin: 'denial', why: 'Refusing a painful reality = denial.' },
      { id: 'df2', text: 'Terminally ill patient planning a big holiday', emoji: '✈️', bin: 'denial', why: 'Avoiding the reality of illness = denial.' },
      { id: 'df3', text: 'Accusing your spouse of the affair you are having', emoji: '👉', bin: 'projection', why: 'Attributing your own impulse to another = projection.' },
      { id: 'df4', text: 'Blaming colleagues for your own mistake', emoji: '👉', bin: 'projection', why: 'Externalising unacceptable feelings = projection.' },
      { id: 'df5', text: 'Yelling at family after a bad day at work', emoji: '🗯️', bin: 'displacement', why: 'Redirecting emotion to a safer target = displacement.' },
      { id: 'df6', text: 'Channelling anger into competitive sport', emoji: '🥊', bin: 'sublimation', why: 'Redirecting drives into acceptable activity = sublimation.' },
    ],
  },

  {
    id: 'programmes', title: 'National Health Programmes', instruction: 'Match each disease to its Indian programme.',
    bins: [
      { id: 'ntep', label: 'NTEP', color: '#DC2626', hint: 'Tuberculosis' },
      { id: 'nacp', label: 'NACP', color: '#7C3AED', hint: 'HIV/AIDS' },
      { id: 'nlep', label: 'NLEP', color: '#16A34A', hint: 'Leprosy' },
      { id: 'nvbdcp', label: 'NVBDCP', color: '#D97706', hint: 'Vector-borne' },
    ],
    items: [
      { id: 'np1', text: 'Pulmonary tuberculosis', emoji: '🫁', bin: 'ntep', why: 'TB Elimination Programme (NTEP).' },
      { id: 'np2', text: 'MDR-TB', emoji: '🦠', bin: 'ntep', why: 'Drug-resistant TB under NTEP.' },
      { id: 'np3', text: 'HIV/AIDS', emoji: '🎗️', bin: 'nacp', why: 'National AIDS Control Programme (NACP).' },
      { id: 'np4', text: 'Leprosy', emoji: '🖐️', bin: 'nlep', why: 'National Leprosy Eradication Programme (NLEP).' },
      { id: 'np5', text: 'Malaria', emoji: '🦟', bin: 'nvbdcp', why: 'Vector-borne disease — NVBDCP.' },
      { id: 'np6', text: 'Dengue', emoji: '🦟', bin: 'nvbdcp', why: 'Vector-borne disease — NVBDCP.' },
      { id: 'np7', text: 'Kala-azar', emoji: '🦟', bin: 'nvbdcp', why: 'Vector-borne (sandfly) — NVBDCP.' },
    ],
  },

  {
    id: 'milestones', title: 'Developmental Milestones', instruction: 'Sort each milestone by the age it is reached.',
    bins: [
      { id: 'm3', label: '3 months', color: '#16A34A', hint: '~3 mo' },
      { id: 'm6', label: '6 months', color: '#2563EB', hint: '~6 mo' },
      { id: 'm9', label: '9 months', color: '#D97706', hint: '~9 mo' },
      { id: 'm12', label: '12 months', color: '#7C3AED', hint: '~1 year' },
    ],
    items: [
      { id: 'ms1', text: 'Social smile', emoji: '😊', bin: 'm3', why: 'Social smile appears by ~6–8 weeks to 3 months.' },
      { id: 'ms2', text: 'Head holding (neck control)', emoji: '🧒', bin: 'm3', why: 'Steady head control by ~3 months.' },
      { id: 'ms3', text: 'Sits with support', emoji: '🪑', bin: 'm6', why: 'Sits with support by ~6 months.' },
      { id: 'ms4', text: 'Transfers objects hand to hand', emoji: '🤲', bin: 'm6', why: 'Transfers objects by ~6 months.' },
      { id: 'ms5', text: 'Crawls', emoji: '👶', bin: 'm9', why: 'Crawling by ~9 months.' },
      { id: 'ms6', text: 'Stranger anxiety', emoji: '🙈', bin: 'm9', why: 'Stranger anxiety around ~8–9 months.' },
      { id: 'ms7', text: 'Walks with support', emoji: '🚶', bin: 'm12', why: 'Cruising/walking with support by ~12 months.' },
      { id: 'ms8', text: 'Says 1–2 words', emoji: '🗣️', bin: 'm12', why: 'First words by ~12 months.' },
    ],
  },

  {
    id: 'drugclass', title: 'Drug Classes', instruction: 'Sort each drug into its class.',
    bins: [
      { id: 'bb', label: 'β-blocker', color: '#DC2626', hint: '“-olol”' },
      { id: 'acei', label: 'ACE inhibitor', color: '#2563EB', hint: '“-pril”' },
      { id: 'diuretic', label: 'Diuretic', color: '#16A34A', hint: 'Increases urine' },
      { id: 'statin', label: 'Statin', color: '#D97706', hint: 'Lowers lipids' },
    ],
    items: [
      { id: 'dc1', text: 'Atenolol', emoji: '💊', bin: 'bb', why: '“-olol” = beta-blocker.' },
      { id: 'dc2', text: 'Metoprolol', emoji: '💊', bin: 'bb', why: 'Beta-blocker.' },
      { id: 'dc3', text: 'Enalapril', emoji: '💊', bin: 'acei', why: '“-pril” = ACE inhibitor.' },
      { id: 'dc4', text: 'Ramipril', emoji: '💊', bin: 'acei', why: 'ACE inhibitor.' },
      { id: 'dc5', text: 'Furosemide', emoji: '💧', bin: 'diuretic', why: 'Loop diuretic.' },
      { id: 'dc6', text: 'Spironolactone', emoji: '💧', bin: 'diuretic', why: 'Potassium-sparing diuretic.' },
      { id: 'dc7', text: 'Atorvastatin', emoji: '🧈', bin: 'statin', why: '“-statin” = lipid-lowering statin.' },
      { id: 'dc8', text: 'Simvastatin', emoji: '🧈', bin: 'statin', why: 'Statin.' },
    ],
  },

  {
    id: 'bloodproducts', title: 'Blood Components', instruction: 'Match each clinical need to the right blood product.',
    bins: [
      { id: 'prbc', label: 'Packed cells', color: '#DC2626', hint: 'O₂ carriage' },
      { id: 'ffp', label: 'FFP', color: '#D97706', hint: 'Clotting factors' },
      { id: 'platelets', label: 'Platelets', color: '#16A34A', hint: 'Thrombocytopenia' },
      { id: 'cryo', label: 'Cryoprecipitate', color: '#7C3AED', hint: 'Fibrinogen / factors' },
    ],
    items: [
      { id: 'bp1', text: 'Symptomatic anaemia', emoji: '🩸', bin: 'prbc', why: 'Packed red cells restore oxygen-carrying capacity.' },
      { id: 'bp2', text: 'Acute major blood loss', emoji: '🩸', bin: 'prbc', why: 'Packed cells (with other products) replace lost RBCs.' },
      { id: 'bp3', text: 'Warfarin reversal (no PCC)', emoji: '🧪', bin: 'ffp', why: 'FFP replaces clotting factors.' },
      { id: 'bp4', text: 'DIC with factor depletion', emoji: '🧪', bin: 'ffp', why: 'FFP replaces consumed clotting factors.' },
      { id: 'bp5', text: 'Bleeding with very low platelets', emoji: '🟡', bin: 'platelets', why: 'Platelet transfusion for thrombocytopenic bleeding.' },
      { id: 'bp6', text: 'Low fibrinogen', emoji: '🟣', bin: 'cryo', why: 'Cryoprecipitate is rich in fibrinogen and factor VIII.' },
    ],
  },

  {
    id: 'endocrine', title: 'Hormones & Glands', instruction: 'Sort each hormone to the gland that secretes it.',
    bins: [
      { id: 'antpit', label: 'Ant. pituitary', color: '#2563EB', hint: 'GH, ACTH, TSH…' },
      { id: 'postpit', label: 'Post. pituitary', color: '#7C3AED', hint: 'ADH, oxytocin' },
      { id: 'thyroid', label: 'Thyroid', color: '#16A34A', hint: 'T3/T4, calcitonin' },
      { id: 'adrenal', label: 'Adrenal', color: '#D97706', hint: 'Cortisol, aldosterone' },
    ],
    items: [
      { id: 'en1', text: 'Growth hormone', emoji: '📈', bin: 'antpit', why: 'Anterior pituitary hormone.' },
      { id: 'en2', text: 'ACTH', emoji: '🔗', bin: 'antpit', why: 'Anterior pituitary (drives the adrenal cortex).' },
      { id: 'en3', text: 'ADH (vasopressin)', emoji: '💧', bin: 'postpit', why: 'Stored/released by the posterior pituitary.' },
      { id: 'en4', text: 'Oxytocin', emoji: '🤱', bin: 'postpit', why: 'Released by the posterior pituitary.' },
      { id: 'en5', text: 'Thyroxine (T4)', emoji: '🦋', bin: 'thyroid', why: 'Thyroid hormone.' },
      { id: 'en6', text: 'Calcitonin', emoji: '🦴', bin: 'thyroid', why: 'Secreted by thyroid C-cells.' },
      { id: 'en7', text: 'Cortisol', emoji: '⚡', bin: 'adrenal', why: 'Adrenal cortex (zona fasciculata).' },
      { id: 'en8', text: 'Aldosterone', emoji: '🧂', bin: 'adrenal', why: 'Adrenal cortex (zona glomerulosa).' },
    ],
  },
];
