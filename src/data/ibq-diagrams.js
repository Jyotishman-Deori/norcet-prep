// =====================================================================
// src/data/ibq-diagrams.js — NEW-09 "Image-Based Questions" (hotspot).
// FULLY DATA-DRIVEN, zero asset: every diagram is plain JSON — a viewBox, a
// list of `art` primitives to draw the picture, and `hotspots` (tappable
// regions). The renderer (src/ui/ibq-diagram.jsx) draws whatever the data
// says, so NEW diagrams can be authored as JSON and UPLOADED later exactly
// like question sets — no code change. Each diagram runs a series of prompts
// ("Tap the …"); answer = a hotspot id.
//
// Schema (all serialisable — safe to import/export):
//   { id, title, viewBox, art:[ {type, ...attrs} ], hotspots:[ {id,label,shape,...} ],
//     prompts:[ {id, ask, answer:<hotspotId>, exp} ] }
//   art types: path|line|rect|circle|ellipse|polyline|polygon|text
//   hotspot shapes: rect{x,y,w,h} | circle{cx,cy,r} | poly{points}
// =====================================================================

const STROKE = '#0F3D3A';   // ink-ish diagram stroke (theme-neutral, works L/D)

export const IBQ_DIAGRAMS = [
  // ── 1. ECG complex labelling ──────────────────────────────────────
  {
    id: 'ecg-complex',
    title: 'The ECG Complex',
    viewBox: '0 0 360 180',
    art: [
      // faint baseline
      { type: 'line', x1: 16, y1: 120, x2: 344, y2: 120, stroke: '#94A3B8', strokeWidth: 1, dash: '4 5' },
      // one clean PQRST beat (draws itself in)
      { type: 'path', d: 'M 20 120 L 60 120 Q 80 98 100 120 L 130 120 L 138 132 L 150 40 L 162 142 L 175 120 L 215 120 Q 245 90 280 120 L 340 120',
        stroke: '#E0245E', strokeWidth: 3, fill: 'none', draw: true },
    ],
    hotspots: [
      { id: 'p',  label: 'P wave',     shape: 'rect', x: 58,  y: 90,  w: 44, h: 40 },
      { id: 'pr', label: 'PR segment', shape: 'rect', x: 104, y: 108, w: 30, h: 26 },
      { id: 'qrs',label: 'QRS',        shape: 'rect', x: 134, y: 36,  w: 34, h: 110 },
      { id: 'st', label: 'ST segment', shape: 'rect', x: 176, y: 108, w: 40, h: 26 },
      { id: 't',  label: 'T wave',     shape: 'rect', x: 216, y: 84,  w: 72, h: 46 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the P wave',       answer: 'p',   exp: 'The P wave is atrial depolarisation — it should precede every QRS in sinus rhythm.' },
      { id: 'q2', ask: 'Tap the QRS complex',  answer: 'qrs', exp: 'The QRS is ventricular depolarisation. A normal QRS is narrow (<0.12 s / 3 small squares).' },
      { id: 'q3', ask: 'Tap the T wave',       answer: 't',   exp: 'The T wave is ventricular repolarisation. Tall, tented T waves are a classic hyperkalaemia sign.' },
      { id: 'q4', ask: 'Tap the ST segment',   answer: 'st',  exp: 'The ST segment sits on the baseline. Elevation = STEMI; depression = ischaemia.' },
      { id: 'q5', ask: 'Tap the PR segment',   answer: 'pr',  exp: 'The PR segment reflects the AV-node delay. A long PR interval indicates heart block.' },
    ],
  },

  // ── 2. Cardiac auscultation points ────────────────────────────────
  // (Patient faces you, so the patient's RIGHT is on the viewer's LEFT.)
  {
    id: 'auscultation',
    title: 'Heart Sounds — Where to Listen',
    viewBox: '0 0 240 260',
    art: [
      // chest / torso outline
      { type: 'path', d: 'M 64 36 Q 120 14 176 36 L 196 120 Q 202 210 120 244 Q 38 210 44 120 Z',
        fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2, draw: true },
      // clavicle hint + sternum
      { type: 'path', d: 'M 70 50 Q 120 38 170 50', fill: 'none', stroke: STROKE, strokeWidth: 1.4, opacity: 0.5 },
      { type: 'line', x1: 120, y1: 56, x2: 120, y2: 168, stroke: STROKE, strokeWidth: 1.4, opacity: 0.4 },
    ],
    hotspots: [
      { id: 'aortic',    label: 'Aortic',    shape: 'circle', cx: 104, cy: 80,  r: 15 },
      { id: 'pulmonary', label: 'Pulmonary', shape: 'circle', cx: 138, cy: 80,  r: 15 },
      { id: 'erbs',      label: "Erb's",     shape: 'circle', cx: 136, cy: 108, r: 15 },
      { id: 'tricuspid', label: 'Tricuspid', shape: 'circle', cx: 128, cy: 140, r: 15 },
      { id: 'mitral',    label: 'Mitral',    shape: 'circle', cx: 162, cy: 162, r: 15 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the AORTIC area',        answer: 'aortic',    exp: 'Aortic = right 2nd intercostal space, right sternal border. Mnemonic APE To Man — A is first.' },
      { id: 'q2', ask: 'Tap the PULMONARY area',     answer: 'pulmonary', exp: 'Pulmonary = left 2nd intercostal space, left sternal border.' },
      { id: 'q3', ask: "Tap ERB's point",            answer: 'erbs',      exp: "Erb's point = left 3rd intercostal space — best for hearing both heart sounds together." },
      { id: 'q4', ask: 'Tap the MITRAL area (apex)', answer: 'mitral',    exp: 'Mitral/apex = left 5th intercostal space, mid-clavicular line — the apex beat.' },
      { id: 'q5', ask: 'Tap the TRICUSPID area',     answer: 'tricuspid', exp: 'Tricuspid = left lower sternal border, 4th–5th intercostal space.' },
    ],
  },

  // ── 3. Abdominal 9 regions ────────────────────────────────────────
  {
    id: 'abdomen',
    title: 'Nine Regions of the Abdomen',
    viewBox: '0 0 240 280',
    art: [
      { type: 'rect', x: 36, y: 40, width: 168, height: 210, rx: 26, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2, draw: true },
      // vertical (mid-clavicular) planes
      { type: 'line', x1: 92,  y1: 40, x2: 92,  y2: 250, stroke: STROKE, strokeWidth: 1.2, opacity: 0.5 },
      { type: 'line', x1: 148, y1: 40, x2: 148, y2: 250, stroke: STROKE, strokeWidth: 1.2, opacity: 0.5 },
      // horizontal (subcostal + transtubercular) planes
      { type: 'line', x1: 36, y1: 110, x2: 204, y2: 110, stroke: STROKE, strokeWidth: 1.2, opacity: 0.5 },
      { type: 'line', x1: 36, y1: 180, x2: 204, y2: 180, stroke: STROKE, strokeWidth: 1.2, opacity: 0.5 },
    ],
    hotspots: [
      // top row (viewer-left = patient's right)
      { id: 'rhc', label: 'R. hypochondriac', shape: 'rect', x: 36,  y: 40,  w: 56, h: 70 },
      { id: 'epi', label: 'Epigastric',       shape: 'rect', x: 92,  y: 40,  w: 56, h: 70 },
      { id: 'lhc', label: 'L. hypochondriac', shape: 'rect', x: 148, y: 40,  w: 56, h: 70 },
      // mid row
      { id: 'rlu', label: 'R. lumbar',        shape: 'rect', x: 36,  y: 110, w: 56, h: 70 },
      { id: 'umb', label: 'Umbilical',        shape: 'rect', x: 92,  y: 110, w: 56, h: 70 },
      { id: 'llu', label: 'L. lumbar',        shape: 'rect', x: 148, y: 110, w: 56, h: 70 },
      // bottom row
      { id: 'ril', label: 'R. iliac',         shape: 'rect', x: 36,  y: 180, w: 56, h: 70 },
      { id: 'hyp', label: 'Hypogastric',      shape: 'rect', x: 92,  y: 180, w: 56, h: 70 },
      { id: 'lil', label: 'L. iliac',         shape: 'rect', x: 148, y: 180, w: 56, h: 70 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the EPIGASTRIC region',          answer: 'epi', exp: 'Epigastric — central upper region. Overlies the stomach, pancreas, duodenum.' },
      { id: 'q2', ask: 'Tap the UMBILICAL region',           answer: 'umb', exp: 'Umbilical — the central region around the navel; small bowel, transverse colon.' },
      { id: 'q3', ask: "Tap the patient's RIGHT iliac",      answer: 'ril', exp: "Right iliac (inguinal) — site of McBurney's point / appendicitis pain. (Patient's right = your left.)" },
      { id: 'q4', ask: 'Tap the HYPOGASTRIC region',         answer: 'hyp', exp: 'Hypogastric (suprapubic) — overlies the bladder and, in women, the uterus.' },
      { id: 'q5', ask: "Tap the patient's LEFT hypochondriac", answer: 'lhc', exp: "Left hypochondriac — overlies the spleen and stomach fundus. (Patient's left = your right.)" },
    ],
  },

  // ── 4. Layers of the skin ─────────────────────────────────────────
  {
    id: 'skin-layers', title: 'Layers of the Skin', viewBox: '0 0 300 200',
    art: [
      { type: 'rect', x: 20, y: 20, width: 260, height: 40, fill: '#FCE7D2', stroke: STROKE, strokeWidth: 1.5, draw: true },
      { type: 'rect', x: 20, y: 60, width: 260, height: 72, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 1.5 },
      { type: 'rect', x: 20, y: 132, width: 260, height: 50, fill: '#FBE3B8', stroke: STROKE, strokeWidth: 1.5 },
      { type: 'line', x1: 130, y1: 20, x2: 130, y2: 168, stroke: STROKE, strokeWidth: 2 },
      { type: 'circle', cx: 130, cy: 166, r: 9, fill: '#C98A5A', stroke: STROKE, strokeWidth: 1.5 },
    ],
    hotspots: [
      { id: 'epi', label: 'Epidermis', shape: 'rect', x: 20, y: 20, w: 260, h: 40 },
      { id: 'derm', label: 'Dermis', shape: 'rect', x: 20, y: 60, w: 260, h: 72 },
      { id: 'subcut', label: 'Subcutaneous', shape: 'rect', x: 20, y: 132, w: 260, h: 50 },
      { id: 'follicle', label: 'Hair follicle', shape: 'circle', cx: 130, cy: 166, r: 15 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the EPIDERMIS', answer: 'epi', exp: 'The avascular outer layer; its deepest stratum basale makes new keratinocytes.' },
      { id: 'q2', ask: 'Tap the DERMIS', answer: 'derm', exp: 'Vascular layer with collagen, nerves, glands and hair follicles.' },
      { id: 'q3', ask: 'Tap the SUBCUTANEOUS layer', answer: 'subcut', exp: 'The hypodermis — fat and connective tissue; insulation and the SC injection site.' },
      { id: 'q4', ask: 'Tap the HAIR FOLLICLE', answer: 'follicle', exp: 'The follicle and its arrector pili sit in the dermis/subcutis.' },
    ],
  },

  // ── 5. Long bone ──────────────────────────────────────────────────
  {
    id: 'long-bone', title: 'Parts of a Long Bone', viewBox: '0 0 200 240',
    art: [
      { type: 'ellipse', cx: 100, cy: 40, rx: 52, ry: 32, fill: '#F1E9DC', stroke: STROKE, strokeWidth: 2, draw: true },
      { type: 'rect', x: 78, y: 62, width: 44, height: 116, fill: '#F1E9DC', stroke: STROKE, strokeWidth: 2 },
      { type: 'ellipse', cx: 100, cy: 200, rx: 52, ry: 32, fill: '#F1E9DC', stroke: STROKE, strokeWidth: 2 },
      { type: 'rect', x: 92, y: 74, width: 16, height: 92, fill: '#E9D2A8', stroke: STROKE, strokeWidth: 1 },
    ],
    hotspots: [
      { id: 'epiphysis', label: 'Epiphysis', shape: 'ellipse', cx: 100, cy: 40, rx: 44, ry: 26 },
      { id: 'diaphysis', label: 'Diaphysis', shape: 'rect', x: 78, y: 86, w: 44, h: 70 },
      { id: 'metaphysis', label: 'Metaphysis', shape: 'circle', cx: 100, cy: 66, r: 16 },
      { id: 'medullary', label: 'Medullary cavity', shape: 'rect', x: 92, y: 90, w: 16, h: 60 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the EPIPHYSIS', answer: 'epiphysis', exp: 'The bulbous end; contains the growth plate in children.' },
      { id: 'q2', ask: 'Tap the DIAPHYSIS', answer: 'diaphysis', exp: 'The shaft of the bone.' },
      { id: 'q3', ask: 'Tap the METAPHYSIS', answer: 'metaphysis', exp: 'The flared region between epiphysis and diaphysis (the old growth-plate zone).' },
      { id: 'q4', ask: 'Tap the MEDULLARY CAVITY', answer: 'medullary', exp: 'The central canal — holds bone marrow.' },
    ],
  },

  // ── 6. IM injection sites ─────────────────────────────────────────
  {
    id: 'im-sites', title: 'IM Injection Sites', viewBox: '0 0 220 260',
    art: [
      { type: 'circle', cx: 110, cy: 28, r: 18, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2, draw: true },
      { type: 'rect', x: 82, y: 46, width: 56, height: 92, rx: 14, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2 },
      { type: 'rect', x: 58, y: 52, width: 20, height: 64, rx: 10, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2 },
      { type: 'rect', x: 142, y: 52, width: 20, height: 64, rx: 10, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2 },
      { type: 'rect', x: 86, y: 138, width: 24, height: 104, rx: 11, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2 },
      { type: 'rect', x: 112, y: 138, width: 24, height: 104, rx: 11, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2 },
    ],
    hotspots: [
      { id: 'deltoid', label: 'Deltoid', shape: 'circle', cx: 68, cy: 62, r: 12 },
      { id: 'ventrogluteal', label: 'Ventrogluteal', shape: 'circle', cx: 98, cy: 150, r: 12 },
      { id: 'vastus', label: 'Vastus lateralis', shape: 'circle', cx: 96, cy: 196, r: 12 },
      { id: 'rectus', label: 'Rectus femoris', shape: 'circle', cx: 124, cy: 196, r: 12 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the DELTOID site', answer: 'deltoid', exp: 'Upper arm — small volume (≤1 mL); common for vaccines.' },
      { id: 'q2', ask: 'Tap the VENTROGLUTEAL site', answer: 'ventrogluteal', exp: 'The safest IM site — away from major nerves/vessels.' },
      { id: 'q3', ask: 'Tap the VASTUS LATERALIS', answer: 'vastus', exp: 'Outer thigh — the preferred site in infants.' },
      { id: 'q4', ask: 'Tap the RECTUS FEMORIS', answer: 'rectus', exp: 'Anterior thigh — usable for self-injection.' },
    ],
  },

  // ── 7. Heart chambers ─────────────────────────────────────────────
  {
    id: 'heart-chambers', title: 'Chambers of the Heart', viewBox: '0 0 260 240',
    art: [
      { type: 'path', d: 'M 40 70 Q 40 40 80 45 L 180 45 Q 220 40 220 75 L 215 150 Q 200 215 130 225 Q 55 215 45 150 Z', fill: '#F7D2D2', stroke: STROKE, strokeWidth: 2, draw: true },
      { type: 'line', x1: 130, y1: 50, x2: 130, y2: 220, stroke: STROKE, strokeWidth: 1.5, opacity: 0.6 },
      { type: 'line', x1: 45, y1: 128, x2: 130, y2: 128, stroke: STROKE, strokeWidth: 1.5, opacity: 0.6 },
      { type: 'line', x1: 130, y1: 128, x2: 215, y2: 128, stroke: STROKE, strokeWidth: 1.5, opacity: 0.6 },
    ],
    hotspots: [
      { id: 'ra', label: 'Right atrium', shape: 'rect', x: 52, y: 60, w: 70, h: 60 },
      { id: 'la', label: 'Left atrium', shape: 'rect', x: 138, y: 60, w: 70, h: 60 },
      { id: 'rv', label: 'Right ventricle', shape: 'rect', x: 52, y: 134, w: 70, h: 76 },
      { id: 'lv', label: 'Left ventricle', shape: 'rect', x: 138, y: 134, w: 70, h: 76 },
    ],
    prompts: [
      { id: 'q1', ask: "Tap the RIGHT ATRIUM (patient's right = your left)", answer: 'ra', exp: 'Receives deoxygenated blood from the venae cavae.' },
      { id: 'q2', ask: 'Tap the LEFT ATRIUM', answer: 'la', exp: 'Receives oxygenated blood from the pulmonary veins.' },
      { id: 'q3', ask: 'Tap the RIGHT VENTRICLE', answer: 'rv', exp: 'Pumps blood to the lungs (pulmonary artery).' },
      { id: 'q4', ask: 'Tap the LEFT VENTRICLE', answer: 'lv', exp: 'The thickest chamber — pumps to the whole body via the aorta.' },
    ],
  },

  // ── 8. Respiratory tree ───────────────────────────────────────────
  {
    id: 'respiratory-tree', title: 'The Airways', viewBox: '0 0 240 240',
    art: [
      { type: 'rect', x: 110, y: 18, width: 20, height: 64, rx: 6, fill: '#CDE7F0', stroke: STROKE, strokeWidth: 2, draw: true },
      { type: 'line', x1: 120, y1: 82, x2: 78, y2: 120, stroke: STROKE, strokeWidth: 8, opacity: 0.5 },
      { type: 'line', x1: 120, y1: 82, x2: 162, y2: 120, stroke: STROKE, strokeWidth: 6, opacity: 0.5 },
      { type: 'ellipse', cx: 64, cy: 168, rx: 44, ry: 64, fill: '#DCEFF5', stroke: STROKE, strokeWidth: 2 },
      { type: 'ellipse', cx: 176, cy: 168, rx: 42, ry: 64, fill: '#DCEFF5', stroke: STROKE, strokeWidth: 2 },
    ],
    hotspots: [
      { id: 'trachea', label: 'Trachea', shape: 'rect', x: 108, y: 18, w: 24, h: 64 },
      { id: 'rbronchus', label: 'Right main bronchus', shape: 'circle', cx: 92, cy: 108, r: 14 },
      { id: 'lbronchus', label: 'Left main bronchus', shape: 'circle', cx: 148, cy: 108, r: 14 },
      { id: 'lung', label: 'Lung (alveoli)', shape: 'circle', cx: 64, cy: 180, r: 26 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the TRACHEA', answer: 'trachea', exp: 'The windpipe; bifurcates at the carina (~T4/T5).' },
      { id: 'q2', ask: 'Tap the RIGHT MAIN BRONCHUS', answer: 'rbronchus', exp: 'Wider, shorter and more vertical — inhaled objects lodge here.' },
      { id: 'q3', ask: 'Tap the LEFT MAIN BRONCHUS', answer: 'lbronchus', exp: 'Narrower and more horizontal than the right.' },
      { id: 'q4', ask: 'Tap the LUNG (alveoli)', answer: 'lung', exp: 'Gas exchange happens in the alveoli.' },
    ],
  },

  // ── 9. Brain lobes ────────────────────────────────────────────────
  {
    id: 'brain-lobes', title: 'Lobes of the Brain', viewBox: '0 0 260 200',
    art: [
      { type: 'path', d: 'M 40 110 Q 28 55 95 42 Q 175 30 218 78 Q 236 100 206 122 Q 120 138 60 132 Q 40 128 40 110 Z', fill: '#EADCF2', stroke: STROKE, strokeWidth: 2, draw: true },
      { type: 'circle', cx: 206, cy: 140, r: 22, fill: '#DCCBEB', stroke: STROKE, strokeWidth: 2 },
      { type: 'rect', x: 188, y: 152, width: 13, height: 38, rx: 5, fill: '#DCCBEB', stroke: STROKE, strokeWidth: 2 },
      { type: 'line', x1: 120, y1: 48, x2: 110, y2: 128, stroke: STROKE, strokeWidth: 1.4, opacity: 0.5 },
      { type: 'line', x1: 70, y1: 112, x2: 150, y2: 104, stroke: STROKE, strokeWidth: 1.4, opacity: 0.5 },
    ],
    hotspots: [
      { id: 'frontal', label: 'Frontal', shape: 'circle', cx: 78, cy: 84, r: 24 },
      { id: 'parietal', label: 'Parietal', shape: 'circle', cx: 145, cy: 66, r: 22 },
      { id: 'temporal', label: 'Temporal', shape: 'circle', cx: 128, cy: 118, r: 20 },
      { id: 'occipital', label: 'Occipital', shape: 'circle', cx: 196, cy: 92, r: 18 },
      { id: 'cerebellum', label: 'Cerebellum', shape: 'circle', cx: 206, cy: 140, r: 20 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the FRONTAL lobe', answer: 'frontal', exp: 'Personality, planning, voluntary movement, Broca’s speech.' },
      { id: 'q2', ask: 'Tap the PARIETAL lobe', answer: 'parietal', exp: 'Sensation, spatial awareness.' },
      { id: 'q3', ask: 'Tap the TEMPORAL lobe', answer: 'temporal', exp: 'Hearing, memory, Wernicke’s comprehension.' },
      { id: 'q4', ask: 'Tap the OCCIPITAL lobe', answer: 'occipital', exp: 'Vision.' },
      { id: 'q5', ask: 'Tap the CEREBELLUM', answer: 'cerebellum', exp: 'Balance and coordination.' },
    ],
  },

  // ── 10. Nephron ───────────────────────────────────────────────────
  {
    id: 'nephron', title: 'The Nephron', viewBox: '0 0 260 240',
    art: [
      { type: 'circle', cx: 62, cy: 58, r: 22, fill: '#FBE3B8', stroke: STROKE, strokeWidth: 2, draw: true },
      { type: 'circle', cx: 62, cy: 58, r: 11, fill: '#E9C77E', stroke: STROKE, strokeWidth: 1 },
      { type: 'path', d: 'M 84 58 Q 110 50 104 80 Q 98 104 120 96', fill: 'none', stroke: STROKE, strokeWidth: 3 },
      { type: 'path', d: 'M 120 96 L 120 184 Q 130 200 142 184 L 142 96', fill: 'none', stroke: STROKE, strokeWidth: 3 },
      { type: 'path', d: 'M 142 96 Q 166 88 160 64 Q 156 50 180 56', fill: 'none', stroke: STROKE, strokeWidth: 3 },
      { type: 'rect', x: 196, y: 56, width: 16, height: 156, rx: 6, fill: '#FBE3B8', stroke: STROKE, strokeWidth: 2 },
    ],
    hotspots: [
      { id: 'glomerulus', label: 'Glomerulus', shape: 'circle', cx: 62, cy: 58, r: 22 },
      { id: 'pct', label: 'Proximal tubule', shape: 'circle', cx: 104, cy: 72, r: 16 },
      { id: 'loop', label: 'Loop of Henle', shape: 'rect', x: 114, y: 110, w: 34, h: 86 },
      { id: 'collecting', label: 'Collecting duct', shape: 'rect', x: 194, y: 58, w: 22, h: 154 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the GLOMERULUS', answer: 'glomerulus', exp: 'The filtration tuft inside Bowman’s capsule.' },
      { id: 'q2', ask: 'Tap the PROXIMAL TUBULE', answer: 'pct', exp: 'Bulk reabsorption of water, glucose, Na⁺ and amino acids.' },
      { id: 'q3', ask: 'Tap the LOOP OF HENLE', answer: 'loop', exp: 'Concentrates urine by the counter-current mechanism.' },
      { id: 'q4', ask: 'Tap the COLLECTING DUCT', answer: 'collecting', exp: 'Final water reabsorption under ADH control.' },
    ],
  },

  // ── 11. The eye ───────────────────────────────────────────────────
  {
    id: 'eye', title: 'Structures of the Eye', viewBox: '0 0 260 200',
    art: [
      { type: 'circle', cx: 130, cy: 100, r: 78, fill: '#E8F0F5', stroke: STROKE, strokeWidth: 2, draw: true },
      { type: 'path', d: 'M 54 78 Q 36 100 54 122', fill: 'none', stroke: STROKE, strokeWidth: 3 },
      { type: 'ellipse', cx: 74, cy: 100, rx: 9, ry: 22, fill: '#CDE7F0', stroke: STROKE, strokeWidth: 1.5 },
      { type: 'path', d: 'M 196 64 Q 214 100 196 136', fill: 'none', stroke: STROKE, strokeWidth: 3 },
      { type: 'rect', x: 206, y: 92, width: 36, height: 16, rx: 4, fill: '#FBE3B8', stroke: STROKE, strokeWidth: 1.5 },
    ],
    hotspots: [
      { id: 'cornea', label: 'Cornea', shape: 'circle', cx: 50, cy: 100, r: 14 },
      { id: 'lens', label: 'Lens', shape: 'circle', cx: 74, cy: 100, r: 16 },
      { id: 'retina', label: 'Retina', shape: 'circle', cx: 190, cy: 100, r: 18 },
      { id: 'optic', label: 'Optic nerve', shape: 'circle', cx: 224, cy: 100, r: 15 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the CORNEA', answer: 'cornea', exp: 'The clear front window; most of the eye’s refraction.' },
      { id: 'q2', ask: 'Tap the LENS', answer: 'lens', exp: 'Fine-focuses light onto the retina (accommodation).' },
      { id: 'q3', ask: 'Tap the RETINA', answer: 'retina', exp: 'Light-sensitive layer with rods and cones.' },
      { id: 'q4', ask: 'Tap the OPTIC NERVE', answer: 'optic', exp: 'Carries visual signals to the brain (CN II).' },
    ],
  },

  // ── 12. Vertebral column ──────────────────────────────────────────
  {
    id: 'vertebral', title: 'Regions of the Spine', viewBox: '0 0 160 280',
    art: [
      { type: 'rect', x: 66, y: 18, width: 26, height: 46, rx: 9, fill: '#CDE7F0', stroke: STROKE, strokeWidth: 2, draw: true },
      { type: 'rect', x: 66, y: 70, width: 26, height: 86, rx: 9, fill: '#F4C9A8', stroke: STROKE, strokeWidth: 2 },
      { type: 'rect', x: 66, y: 162, width: 26, height: 56, rx: 9, fill: '#EADCF2', stroke: STROKE, strokeWidth: 2 },
      { type: 'path', d: 'M 64 224 L 94 224 L 86 266 L 72 266 Z', fill: '#FBE3B8', stroke: STROKE, strokeWidth: 2 },
    ],
    hotspots: [
      { id: 'cervical', label: 'Cervical (7)', shape: 'rect', x: 60, y: 18, w: 38, h: 46 },
      { id: 'thoracic', label: 'Thoracic (12)', shape: 'rect', x: 60, y: 70, w: 38, h: 86 },
      { id: 'lumbar', label: 'Lumbar (5)', shape: 'rect', x: 60, y: 162, w: 38, h: 56 },
      { id: 'sacral', label: 'Sacrum', shape: 'rect', x: 62, y: 224, w: 34, h: 44 },
    ],
    prompts: [
      { id: 'q1', ask: 'Tap the CERVICAL region', answer: 'cervical', exp: '7 vertebrae (C1–C7); the neck.' },
      { id: 'q2', ask: 'Tap the THORACIC region', answer: 'thoracic', exp: '12 vertebrae (T1–T12); articulate with the ribs.' },
      { id: 'q3', ask: 'Tap the LUMBAR region', answer: 'lumbar', exp: '5 vertebrae (L1–L5); the lower back, site for lumbar puncture (L3/L4).' },
      { id: 'q4', ask: 'Tap the SACRUM', answer: 'sacral', exp: '5 fused vertebrae; a common pressure-injury site.' },
    ],
  },
];
