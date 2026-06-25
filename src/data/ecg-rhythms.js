// =====================================================================
// src/data/ecg-rhythms.js — NEW-10 (Module D) "Read the Monitor".
// Zero-asset ECG: every rhythm is a procedurally-generated SVG path (no
// images, no GIFs, no video — drawn in code so it's crisp at any size and
// costs nothing to ship). Each rhythm carries the vitals a real bedside
// monitor would show, the answer options, the teaching rationale, and the
// first clinical action. Paired with a Web-Audio synthesized monitor beep
// (src/lib/ecg-audio.js) whose pitch tracks the SpO₂, like the real thing.
// =====================================================================

// Deterministic PRNG so the "chaotic" rhythms (AF / VF / asystole) render the
// SAME trace every time (stable, not flickering on every re-render).
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(s) {
  let h = 2166136261; const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Default PQRST amplitudes (in SVG user units, tuned for BL≈88, H≈150).
const A = { p: 10, q: 7, r: 50, s: 16, t: 18 };

// One normal PQRST complex from (x, BL) to (x+w, BL). hasP toggles the P wave.
function drawSinusBeat(seg, x, w, BL, hasP) {
  const up = (a) => (BL - a).toFixed(1);
  const at = (f) => (x + f * w).toFixed(1);
  if (hasP) {
    seg.push(`L ${at(0.08)} ${BL}`);
    seg.push(`Q ${at(0.13)} ${up(A.p)} ${at(0.18)} ${BL}`);   // P
  } else {
    seg.push(`L ${at(0.2)} ${BL}`);
  }
  seg.push(`L ${at(0.24)} ${BL}`);            // PR baseline
  seg.push(`L ${at(0.26)} ${up(-A.q)}`);      // Q
  seg.push(`L ${at(0.285)} ${up(A.r)}`);      // R
  seg.push(`L ${at(0.31)} ${up(-A.s)}`);      // S
  seg.push(`L ${at(0.35)} ${BL}`);            // J point
  seg.push(`L ${at(0.46)} ${BL}`);            // ST
  seg.push(`Q ${at(0.55)} ${up(A.t)} ${at(0.66)} ${BL}`);  // T
  seg.push(`L ${at(1)} ${BL}`);               // TP baseline
}

function sinusStrip(W, BL, nBeats, hasP) {
  const w = W / nBeats; const seg = [`M 0 ${BL}`];
  for (let i = 0; i < nBeats; i++) drawSinusBeat(seg, i * w, w, BL, hasP);
  return seg.join(' ');
}

// Atrial fibrillation — irregularly-irregular R-R, NO P waves, fibrillatory
// (wavy) baseline.
function afibStrip(W, BL, seed) {
  const rnd = mulberry32(hashSeed(seed));
  const widths = []; let total = 0;
  while (total < W) { const ww = 95 + rnd() * 130; widths.push(ww); total += ww; }
  const scale = W / total;
  const seg = [`M 0 ${BL}`]; let x = 0;
  const up = (a) => (BL - a).toFixed(1);
  for (const w0 of widths) {
    const w = w0 * scale; const at = (f) => (x + f * w).toFixed(1);
    for (let f = 0.03; f < 0.22; f += 0.045) seg.push(`L ${at(f)} ${up((rnd() * 2 - 1) * 4)}`);
    seg.push(`L ${at(0.24)} ${BL}`);
    seg.push(`L ${at(0.26)} ${up(-A.q)}`);
    seg.push(`L ${at(0.285)} ${up(A.r)}`);
    seg.push(`L ${at(0.31)} ${up(-A.s)}`);
    seg.push(`L ${at(0.36)} ${BL}`);
    for (let f = 0.46; f < 0.97; f += 0.055) seg.push(`L ${at(f)} ${up((rnd() * 2 - 1) * 4)}`);
    seg.push(`L ${at(1)} ${BL}`);
    x += w;
  }
  seg.push(`L ${W} ${BL}`);
  return seg.join(' ');
}

// Atrial flutter — regular "sawtooth" F-waves with a QRS every few teeth.
function flutterStrip(W, BL, nUnits) {
  const uw = W / nUnits; const seg = [`M 0 ${BL}`];
  for (let i = 0; i < nUnits; i++) {
    const x = i * uw; const at = (f) => (x + f * uw).toFixed(1); const up = (a) => (BL - a).toFixed(1);
    seg.push(`L ${at(0.15)} ${up(15)}`); seg.push(`L ${at(0.18)} ${BL}`);
    seg.push(`L ${at(0.33)} ${up(15)}`); seg.push(`L ${at(0.36)} ${BL}`);
    seg.push(`L ${at(0.51)} ${up(15)}`); seg.push(`L ${at(0.54)} ${BL}`);
    seg.push(`L ${at(0.58)} ${up(-A.q)}`);  // QRS
    seg.push(`L ${at(0.61)} ${up(A.r)}`);
    seg.push(`L ${at(0.64)} ${up(-A.s)}`);
    seg.push(`L ${at(0.68)} ${BL}`);
    seg.push(`L ${at(0.85)} ${up(15)}`); seg.push(`L ${at(0.88)} ${BL}`);
    seg.push(`L ${at(1)} ${BL}`);
  }
  return seg.join(' ');
}

// Monomorphic VT — broad, regular sine-like complexes, no P waves.
function vtStrip(W, BL, nBeats) {
  const w = W / nBeats; const seg = [`M 0 ${BL}`];
  for (let i = 0; i < nBeats; i++) {
    const x = i * w; const up = (a) => (BL - a).toFixed(1);
    seg.push(`Q ${(x + 0.25 * w).toFixed(1)} ${up(44)} ${(x + 0.5 * w).toFixed(1)} ${BL}`);
    seg.push(`Q ${(x + 0.75 * w).toFixed(1)} ${up(-40)} ${(x + w).toFixed(1)} ${BL}`);
  }
  return seg.join(' ');
}

// Ventricular fibrillation — chaotic, no organised complexes.
function vfStrip(W, BL, seed) {
  const rnd = mulberry32(hashSeed(seed)); const seg = [`M 0 ${BL}`]; let x = 0;
  while (x < W) { x += 8 + rnd() * 13; const amp = 14 + rnd() * 26; seg.push(`L ${x.toFixed(1)} ${(BL - (rnd() * 2 - 1) * amp).toFixed(1)}`); }
  seg.push(`L ${W} ${BL}`);
  return seg.join(' ');
}

// Asystole — flat line with a whisker of baseline wander.
function asystoleStrip(W, BL, seed) {
  const rnd = mulberry32(hashSeed(seed)); const seg = [`M 0 ${BL}`]; let x = 0;
  while (x < W) { x += 22 + rnd() * 28; seg.push(`L ${x.toFixed(1)} ${(BL - (rnd() * 2 - 1) * 2.2).toFixed(1)}`); }
  seg.push(`L ${W} ${BL}`);
  return seg.join(' ');
}

// Public: build the SVG path 'd' for a rhythm across a strip of width W.
export function buildEcgPath(rhythm, W = 1000, BL = 88) {
  switch (rhythm.kind) {
    case 'sinus':    return sinusStrip(W, BL, rhythm.nBeats, rhythm.hasP !== false);
    case 'afib':     return afibStrip(W, BL, rhythm.id);
    case 'flutter':  return flutterStrip(W, BL, rhythm.nUnits || 4);
    case 'vt':       return vtStrip(W, BL, rhythm.nBeats || 7);
    case 'vf':       return vfStrip(W, BL, rhythm.id);
    case 'asystole': return asystoleStrip(W, BL, rhythm.id);
    default:         return sinusStrip(W, BL, 5, true);
  }
}

// ── The rhythms ──────────────────────────────────────────────────────
// severity drives the vitals colour + alarm intensity. audio: 'pulse' beeps
// at HR (pitch follows SpO₂), 'vf' = rapid urgent alarm, 'flat' = asystole tone.
export const ECG_RHYTHMS = [
  {
    id: 'nsr', kind: 'sinus', nBeats: 5, hasP: true, name: 'Normal Sinus Rhythm',
    hr: 78, spo2: 98, bp: '122/78', severity: 'stable', audio: 'pulse', trace: '#46F08A',
    options: ['Normal Sinus Rhythm', 'Sinus Tachycardia', 'Atrial Fibrillation', 'Sinus Bradycardia'], answer: 0,
    rationale: 'Upright P before every QRS, regular R-R, rate 60–100, normal narrow QRS. Everything in step — the baseline you compare every other strip against.',
    action: 'No action needed — document and continue routine monitoring.',
  },
  {
    id: 'stach', kind: 'sinus', nBeats: 8, hasP: true, name: 'Sinus Tachycardia',
    hr: 134, spo2: 96, bp: '108/70', severity: 'warning', audio: 'pulse', trace: '#9BE15D',
    options: ['Sinus Tachycardia', 'Atrial Flutter', 'Ventricular Tachycardia', 'Normal Sinus Rhythm'], answer: 0,
    rationale: 'Still a P before every QRS and a regular rhythm, but rate >100. It is a RESPONSE, not a primary problem — hunt the cause: fever, pain, hypovolaemia, anxiety, hypoxia.',
    action: 'Treat the cause (fluids, analgesia, antipyretic, reassurance) — do not just slow the heart.',
  },
  {
    id: 'sbrad', kind: 'sinus', nBeats: 3, hasP: true, name: 'Sinus Bradycardia',
    hr: 44, spo2: 97, bp: '104/64', severity: 'warning', audio: 'pulse', trace: '#67E8F9',
    options: ['Sinus Bradycardia', 'Complete Heart Block', 'Normal Sinus Rhythm', 'Asystole'], answer: 0,
    rationale: 'Normal P-QRS-T morphology, regular, but rate <60. Often benign (athletes, sleep). Treat only if symptomatic — dizziness, hypotension, chest pain.',
    action: 'If symptomatic: atropine 0.5 mg IV, then transcutaneous pacing per ACLS. If well-perfused, observe.',
  },
  {
    id: 'afib', kind: 'afib', name: 'Atrial Fibrillation',
    hr: 128, spo2: 95, bp: '102/66', severity: 'warning', audio: 'pulse', trace: '#FBBF24',
    options: ['Atrial Fibrillation', 'Sinus Tachycardia', 'Atrial Flutter', 'Multifocal Atrial Tachycardia'], answer: 0,
    rationale: 'Irregularly-irregular R-R with NO discernible P waves and a fibrillatory baseline. The loss of atrial kick + stasis is why these patients are anticoagulated (stroke risk).',
    action: 'Rate control (beta-blocker / diltiazem), assess CHA₂DS₂-VASc for anticoagulation; cardiovert if unstable.',
  },
  {
    id: 'aflutter', kind: 'flutter', nUnits: 4, name: 'Atrial Flutter',
    hr: 150, spo2: 96, bp: '110/72', severity: 'warning', audio: 'pulse', trace: '#FBBF24',
    options: ['Atrial Flutter', 'Atrial Fibrillation', 'Sinus Tachycardia', 'Ventricular Tachycardia'], answer: 0,
    rationale: 'Classic "sawtooth" flutter (F) waves at ~300/min with regular conduction (often 2:1 → ventricular rate ~150). Unlike AF, the baseline is REGULAR and organised.',
    action: 'Rate control or synchronised cardioversion; consider anticoagulation as for AF.',
  },
  {
    id: 'vtach', kind: 'vt', nBeats: 7, name: 'Ventricular Tachycardia',
    hr: 188, spo2: 86, bp: '76/40', severity: 'critical', audio: 'pulse', trace: '#FB7185',
    options: ['Ventricular Tachycardia', 'Sinus Tachycardia', 'Supraventricular Tachycardia', 'Atrial Flutter'], answer: 0,
    rationale: 'Wide, bizarre, regular complexes with no P waves at a fast rate. A peri-arrest rhythm — the low BP + SpO₂ here mark it as UNSTABLE.',
    action: 'Pulse + unstable → synchronised cardioversion. Pulseless → defibrillate + CPR (ACLS). Stable → amiodarone.',
  },
  {
    id: 'vfib', kind: 'vf', name: 'Ventricular Fibrillation',
    hr: null, spo2: null, bp: '--', severity: 'critical', audio: 'vf', trace: '#F43F5E',
    options: ['Ventricular Fibrillation', 'Ventricular Tachycardia', 'Asystole', 'Artefact'], answer: 0,
    rationale: 'Chaotic, totally disorganised waveform with no identifiable complexes — the heart is quivering, not pumping. The patient is in cardiac arrest.',
    action: 'SHOCKABLE. Start CPR immediately, defibrillate without delay, adrenaline every 3–5 min per ACLS.',
  },
  {
    id: 'asystole', kind: 'asystole', name: 'Asystole',
    hr: 0, spo2: null, bp: '--', severity: 'critical', audio: 'flat', trace: '#F43F5E',
    options: ['Asystole', 'Ventricular Fibrillation', 'Fine VF', 'Pulseless Electrical Activity'], answer: 0,
    rationale: 'A flat line — no electrical activity at all. Confirm it is real: check leads, gain, and a second lead (fine VF can masquerade as asystole).',
    action: 'NOT shockable. High-quality CPR + adrenaline every 3–5 min; treat reversible causes (the H’s and T’s).',
  },
];
