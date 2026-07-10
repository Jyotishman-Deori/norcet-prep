# PYQ image-question backlog

The 501 text questions of NORCET 2021-2024 ship bundled in `src/norcet-pyq-data.js`.
The image-dependent questions were deliberately left out (see
`EXCLUDED_IMAGE_QUESTIONS` in that file) until figures are hosted. This doc turns that
backlog into **ready-to-paste paper-bank JSON**: stems + options + the correct index
from the printed answer key + a one-line description of the figure to source.

## How to publish these

1. Generate/crop each figure, upload to R2 (admin -> Bank editor -> Upload images, or
   any host), copy the public URL into that question's `image` field.
2. Admin -> Upload bank -> **Set type: Previous paper**, year + name matching the
   built-in (e.g. "AIIMS NORCET 2021 (image questions)" so it sits beside, not on top
   of, the bundled paper). Paste the JSON. Explanations optional.
3. Save public -> it appears in Previous Papers and runs as a timed paper.

Correct indexes are 0-based (`A=0, B=1, C=2, D=3`), matching the app schema.

## Template (one question)

```json
{
  "q": "Identify the instrument shown.",
  "type": "mcq",
  "topic": "fund",
  "sub": "Equipment",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": [1],
  "image": "https://pub-YOURBUCKET.r2.dev/q/2021-q80.png",
  "exp": "",
  "source": "AIIMS NORCET 2021 PYQ",
  "isPYQ": true,
  "pyqYear": 2021
}
```

---

## NORCET 2021 (16 image questions) - fully transcribed, `image` blank

Answer key from the booklet. `[figure: ...]` = what to source for each.

```json
[
  { "q": "Following pattern of fever is seen in:", "type": "mcq", "topic": "ch", "sub": "Infectious Disease", "options": ["Typhoid", "Malaria", "Dengue", "None of the above"], "correct": [0], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "" },
  { "q": "Match the following vectors with the disease they transmit (Aedes, Rat flea, Anopheles, Sand fly):", "type": "mcq", "topic": "ch", "sub": "Vector-borne Disease", "options": ["A-3, B-4, C-1, D-2", "A-1, B-4, C-5, D-3", "A-3, B-3, C-2, D-1", "A-4, B-5, C-1, D-2"], "correct": [0], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "" },
  { "q": "Identify the following image.", "type": "mcq", "topic": "fund", "sub": "Biomedical Waste", "options": ["Biohazard", "Radiation", "Cytotoxic", "None of these"], "correct": [0], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: biohazard trefoil symbol]" },
  { "q": "Identify the correct method of inserting a catheter in a neonate.", "type": "mcq", "topic": "che", "sub": "Procedures", "options": ["12 Fr is appropriate size for catheterization in neonate", "No requirement of jelly", "Inflate the balloon after insertion of entire catheter", "Inflate the balloon when urine seen no matter of location of catheter"], "correct": [2], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "" },
  { "q": "The following image is used for which purpose?", "type": "mcq", "topic": "fund", "sub": "Equipment", "options": ["To hold the surgical blade", "To cut the skin", "To retract the skin", "None of these"], "correct": [0], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: scalpel handle / BP handle]" },
  { "q": "Which type of bandage is used for the knee joint?", "type": "mcq", "topic": "fund", "sub": "Bandaging", "options": ["Spiral", "Reverse spiral", "Figure of eight", "Circular"], "correct": [2], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: figure-of-eight bandage over a knee]" },
  { "q": "Identify the number of the surgical blade shown.", "type": "mcq", "topic": "fund", "sub": "Equipment", "options": ["10", "11", "15", "20"], "correct": [1], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: pointed No.11 surgical blade]" },
  { "q": "Identify the instrument.", "type": "mcq", "topic": "fund", "sub": "Equipment", "options": ["Doyens' retractor", "Deavers' retractor", "Morris' retractor", "Lagenback retractor"], "correct": [1], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: Deaver retractor]" },
  { "q": "Identify the tube.", "type": "mcq", "topic": "fund", "sub": "Equipment", "options": ["Suction catheter", "Ryles' tube", "Infant feeding tube", "Foley catheter"], "correct": [2], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: infant feeding tube]" },
  { "q": "Identify the drain.", "type": "mcq", "topic": "fund", "sub": "Equipment", "options": ["Penrose drain", "Hemovac drain", "Jackson Pratt drain", "None of these"], "correct": [2], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: Jackson-Pratt bulb drain]" },
  { "q": "Identify the image.", "type": "mcq", "topic": "msn", "sub": "Airway", "options": ["Laryngoscope", "Laryngeal mask airway", "ET tube", "Combitube"], "correct": [1], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: laryngeal mask airway]" },
  { "q": "Interpret the ECG.", "type": "mcq", "topic": "msn", "sub": "Cardiac", "options": ["Atrial flutter", "Atrial fibrillation", "Ventricular fibrillation", "Ventricular tachycardia"], "correct": [2], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: coarse VF rhythm strip]" },
  { "q": "Identify the nebulizing device.", "type": "mcq", "topic": "msn", "sub": "Respiratory", "options": ["Spacer", "MDI", "Nebulizer with bottle and mask", "Turbuhaler"], "correct": [0], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: spacer device]" },
  { "q": "A 37-year-old patient, known case of right pneumothorax, presents with abdominal pain and vomiting; abdominal guarding and rebound tenderness. Chest X-ray reveals the finding shown. Tentative diagnosis?", "type": "mcq", "topic": "msn", "sub": "Respiratory", "options": ["Diaphragmatic Hernia", "Diverticulitis", "Perforated peritonitis", "Right sided heart failure"], "correct": [2], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: chest X-ray]" },
  { "q": "Identify the device.", "type": "mcq", "topic": "fund", "sub": "Equipment", "options": ["Monopolar cautery", "Bipolar cautery", "Harmonic", "Camera"], "correct": [1], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "[figure: electrocautery unit]" },
  { "q": "Characteristic sign of cardiac arrest.", "type": "mcq", "topic": "msn", "sub": "Cardiac", "options": ["Pulseless VT", "Palpitations", "Wheezing", "Shortness of breath"], "correct": [0], "image": "", "source": "AIIMS NORCET 2021 PYQ", "isPYQ": true, "pyqYear": 2021, "exp": "" }
]
```

---

## Remaining papers - answer keys + figure list (transcribe the same way)

The booklet PDFs are the source of stems/options; the numbers below are the excluded
question numbers with the answer-key letter. Build each into the template above.

**NORCET 2022** (14): Q3 image=B (Harmonic Scalpel), Q4=C (Foley catheter photo),
Q5=D (thyroidectomy instrument), Q8=B (blade size 23), Q9=C (fetoscope), Q20=B,
Q27=A (tinea corporis image), Q33=D, Q40=A (Naegele's pelvis), Q57=B (pedigree),
Q58=B (cervix image), Q69=A (correct mask position), Q76=A (18 G cannula), Q97=A
(Venn diagram reasoning).

**NORCET 2023 Prelims** (3): Q46=B (pygopagus twins image), Q49=D (Welson
self-retractor), Q50=A (ileostomy image).

**NORCET 2023 Mains** (7): Q5=C (tracheal dilator), Q6=D (manometer / ET cuff
pressure gauge), Q15=A (VF rhythm), Q18=A (PICC line), Q24=B (recovery position
photo), Q25=C (AV block ECG), Q26=D (ST elevation / MI ECG).

**NORCET 2024 Prelims** (4): Q8=C (sinus tachycardia ECG), Q11=A (Allis forceps),
Q12=B (IM with Z track route diagram), Q48=A (venturi mask 40% FiO2).

**NORCET 2024 Mains** (9): Q11=C (adrenaline dilution vial), Q12=D (50% dextrose
vial), Q44=A (radiant warmer, pre-heating mode), Q52=D (waxy flexibility image),
Q84=B (nasopharyngeal airway), Q94=D, Q95=C, Q96=D, Q97=A.

> Spot-check every answer against the source booklet before publishing (the built-in
> file's own header carries the same warning). These keys are memory-based.
