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
];
