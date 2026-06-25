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

// One PQRST complex from (x, BL) to (x+w, BL). Options (all default to a normal
// sinus beat, so the original rhythms are unchanged):
//   hasP  — show the P wave (false = junctional/SVT)
//   invP  — inverted P (junctional)
//   pr    — extra PR delay (fraction of w) → 1st-degree block / Wenckebach
//   st    — ST-segment shift in amplitude units (+ elevation, − depression)
//   tAmp  — T-wave height (tall/tented = hyperkalaemia)
//   delta — slurred QRS upstroke (WPW)
function drawSinusBeat(seg, x, w, BL, o = {}) {
  const hasP = o.hasP !== false;
  const pr = o.pr || 0;
  const st = o.st || 0;
  const tAmp = o.tAmp != null ? o.tAmp : A.t;
  const up = (a) => (BL - a).toFixed(1);
  const at = (f) => (x + f * w).toFixed(1);
  if (hasP) {
    seg.push(`L ${at(0.08)} ${BL}`);
    seg.push(`Q ${at(0.13)} ${up(o.invP ? -A.p * 0.7 : A.p)} ${at(0.18)} ${BL}`);   // P
  } else {
    seg.push(`L ${at(0.2)} ${BL}`);
  }
  seg.push(`L ${at(0.24 + pr)} ${BL}`);            // PR baseline (+ optional delay)
  if (o.delta) {
    seg.push(`L ${at(0.27 + pr)} ${up(A.r * 0.3)}`);   // delta slur
    seg.push(`L ${at(0.30 + pr)} ${up(A.r)}`);         // R
  } else {
    seg.push(`L ${at(0.26 + pr)} ${up(-A.q)}`);        // Q
    seg.push(`L ${at(0.285 + pr)} ${up(A.r)}`);        // R
  }
  seg.push(`L ${at(0.31 + pr)} ${up(-A.s)}`);      // S
  seg.push(`L ${at(0.35 + pr)} ${up(st)}`);        // J point (at ST level)
  seg.push(`L ${at(0.46 + pr)} ${up(st)}`);        // ST segment
  seg.push(`Q ${at(0.55 + pr)} ${up(st + tAmp)} ${at(0.66 + pr)} ${BL}`);  // T
  seg.push(`L ${at(1)} ${BL}`);                    // TP baseline
}

function sinusStrip(W, BL, nBeats, opt) {
  const w = W / nBeats; const seg = [`M 0 ${BL}`];
  for (let i = 0; i < nBeats; i++) drawSinusBeat(seg, i * w, w, BL, opt);
  return seg.join(' ');
}

// P-wave only (a dropped/non-conducted beat) — for the AV blocks.
function drawPOnly(seg, x, w, BL) {
  const up = (a) => (BL - a).toFixed(1); const at = (f) => (x + f * w).toFixed(1);
  seg.push(`L ${at(0.08)} ${BL}`);
  seg.push(`Q ${at(0.13)} ${up(A.p)} ${at(0.18)} ${BL}`);
  seg.push(`L ${at(1)} ${BL}`);
}

// A wide, bizarre ventricular ectopic (no P, discordant T) — PVC / bigeminy.
function drawPVC(seg, x, w, BL) {
  const up = (a) => (BL - a).toFixed(1); const at = (f) => (x + f * w).toFixed(1);
  seg.push(`L ${at(0.15)} ${BL}`);
  seg.push(`Q ${at(0.27)} ${up(A.r * 1.05)} ${at(0.40)} ${BL}`);      // broad R
  seg.push(`Q ${at(0.52)} ${up(-A.s * 1.5)} ${at(0.66)} ${BL}`);      // broad discordant S
  seg.push(`L ${at(1)} ${BL}`);
}

// Mobitz I (Wenckebach): PR lengthens each beat, then a dropped QRS, repeating.
function wenckebachStrip(W, BL) {
  const cycles = 2, per = 4, total = cycles * per, w = W / total; const seg = [`M 0 ${BL}`];
  for (let c = 0; c < cycles; c++) for (let b = 0; b < per; b++) {
    const x = (c * per + b) * w;
    if (b === per - 1) drawPOnly(seg, x, w, BL);            // dropped beat
    else drawSinusBeat(seg, x, w, BL, { pr: 0.03 + b * 0.05 });
  }
  return seg.join(' ');
}

// Mobitz II: constant PR, a QRS suddenly dropped every 3rd beat.
function mobitz2Strip(W, BL) {
  const total = 6, w = W / total; const seg = [`M 0 ${BL}`];
  for (let b = 0; b < total; b++) {
    const x = b * w;
    if ((b + 1) % 3 === 0) drawPOnly(seg, x, w, BL);
    else drawSinusBeat(seg, x, w, BL, { pr: 0.03 });
  }
  return seg.join(' ');
}

// Sinus rhythm with a single ventricular ectopic (PVC).
function pvcStrip(W, BL) {
  const total = 6, w = W / total; const seg = [`M 0 ${BL}`];
  for (let b = 0; b < total; b++) (b === 3 ? drawPVC : (s, x, ww, bl) => drawSinusBeat(s, x, ww, bl, {}))(seg, b * w, w, BL);
  return seg.join(' ');
}

// Ventricular bigeminy: every sinus beat paired with a PVC.
function bigeminyStrip(W, BL) {
  const total = 6, w = W / total; const seg = [`M 0 ${BL}`];
  for (let b = 0; b < total; b++) (b % 2 === 1 ? drawPVC : (s, x, ww, bl) => drawSinusBeat(s, x, ww, bl, {}))(seg, b * w, w, BL);
  return seg.join(' ');
}

// Paced rhythm: a sharp pacing spike before each wide, captured QRS.
function pacedStrip(W, BL) {
  const total = 5, w = W / total; const seg = [`M 0 ${BL}`];
  for (let b = 0; b < total; b++) {
    const x = b * w; const up = (a) => (BL - a).toFixed(1); const at = (f) => (x + f * w).toFixed(1);
    seg.push(`L ${at(0.18)} ${BL}`);
    seg.push(`L ${at(0.20)} ${up(A.r * 1.2)}`);          // pacing spike
    seg.push(`L ${at(0.205)} ${BL}`);
    seg.push(`L ${at(0.26)} ${up(-A.q)}`);
    seg.push(`Q ${at(0.34)} ${up(A.r * 0.8)} ${at(0.44)} ${up(-A.s * 1.1)}`);  // wide QRS
    seg.push(`L ${at(0.52)} ${BL}`);
    seg.push(`Q ${at(0.62)} ${up(A.t)} ${at(0.72)} ${BL}`);
    seg.push(`L ${at(1)} ${BL}`);
  }
  return seg.join(' ');
}

// --- sampled (additive) builders for overlapping / polymorphic rhythms ---
function sampleStrip(W, BL, fn, N = 380) {
  const seg = [`M 0 ${BL.toFixed(1)}`];
  for (let i = 1; i <= N; i++) { const x = (W * i) / N; seg.push(`L ${x.toFixed(1)} ${(BL - fn(x)).toFixed(1)}`); }
  return seg.join(' ');
}
const bump = (x, c, wd, amp) => { const d = (x - c) / wd; return amp * Math.exp(-d * d); };
const spike = (x, c, hw, amp) => { const d = Math.abs(x - c); return d < hw ? amp * (1 - d / hw) : 0; };

// Complete (3rd-degree) heart block: P waves and QRS fully dissociated.
function chbStrip(W, BL) {
  const pP = W / 8.5, qP = W / 2.6;
  return sampleStrip(W, BL, (x) => {
    let y = bump(x, Math.round(x / pP) * pP, W * 0.011, A.p * 0.9);
    const qc = Math.round(x / qP) * qP;
    y += spike(x, qc, W * 0.014, A.r) - spike(x, qc + W * 0.02, W * 0.01, A.s) + bump(x, qc + W * 0.06, W * 0.028, A.t);
    return y;
  }, 420);
}

// Torsades de pointes: polymorphic VT, amplitude waxing & waning around baseline.
function torsadesStrip(W, BL) {
  return sampleStrip(W, BL, (x) => {
    const env = Math.abs(Math.sin((Math.PI * x) / (W * 0.5)));
    return Math.sin((2 * Math.PI * x) / (W * 0.06)) * (8 + env * 38);
  }, 440);
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
    case 'sinus':      return sinusStrip(W, BL, rhythm.nBeats, {
      hasP: rhythm.hasP !== false, invP: rhythm.invP, pr: rhythm.pr, st: rhythm.st, tAmp: rhythm.tAmp, delta: rhythm.delta,
    });
    case 'afib':       return afibStrip(W, BL, rhythm.id);
    case 'flutter':    return flutterStrip(W, BL, rhythm.nUnits || 4);
    case 'vt':         return vtStrip(W, BL, rhythm.nBeats || 7);
    case 'vf':         return vfStrip(W, BL, rhythm.id);
    case 'asystole':   return asystoleStrip(W, BL, rhythm.id);
    case 'wenckebach': return wenckebachStrip(W, BL);
    case 'mobitz2':    return mobitz2Strip(W, BL);
    case 'pvc':        return pvcStrip(W, BL);
    case 'bigeminy':   return bigeminyStrip(W, BL);
    case 'paced':      return pacedStrip(W, BL);
    case 'chb':        return chbStrip(W, BL);
    case 'torsades':   return torsadesStrip(W, BL);
    default:           return sinusStrip(W, BL, 5, { hasP: true });
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
  {
    id: 'avb1', kind: 'sinus', nBeats: 5, hasP: true, pr: 0.12, name: 'First-degree AV Block',
    hr: 66, spo2: 98, bp: '124/80', severity: 'stable', audio: 'pulse', trace: '#46F08A',
    options: ['First-degree AV Block', 'Normal Sinus Rhythm', 'Mobitz I (Wenckebach)', 'Sinus Bradycardia'], answer: 0,
    rationale: 'Every P conducts, but the PR interval is long (>0.20 s / one big square) and CONSTANT. Usually benign — “married, but the message is just slow”.',
    action: 'Usually none — review rate-slowing drugs; treat only if symptomatic.',
  },
  {
    id: 'stemi', kind: 'sinus', nBeats: 5, hasP: true, st: 15, name: 'ST-Elevation MI (STEMI)',
    hr: 92, spo2: 95, bp: '138/86', severity: 'critical', audio: 'pulse', trace: '#FB7185',
    options: ['ST-Elevation MI (STEMI)', 'Normal Sinus Rhythm', 'Pericarditis', 'Early repolarisation'], answer: 0,
    rationale: 'Convex ST-segment ELEVATION with chest pain = STEMI until proven otherwise — a fully occluded coronary artery.',
    action: 'Time is muscle: aspirin + activate the cath lab for primary PCI (or thrombolysis if PCI unavailable).',
  },
  {
    id: 'ischaemia', kind: 'sinus', nBeats: 6, hasP: true, st: -11, name: 'Myocardial Ischaemia (ST depression)',
    hr: 104, spo2: 96, bp: '128/82', severity: 'warning', audio: 'pulse', trace: '#FBBF24',
    options: ['ST depression (ischaemia)', 'STEMI', 'Normal Sinus Rhythm', 'Digoxin effect'], answer: 0,
    rationale: 'Horizontal/down-sloping ST DEPRESSION suggests subendocardial ischaemia (NSTEMI / unstable angina) — the artery is narrowed, not fully blocked.',
    action: 'Anti-anginals + antiplatelets, serial troponin, and risk-stratify for angiography.',
  },
  {
    id: 'hyperk', kind: 'sinus', nBeats: 5, hasP: true, tAmp: 34, name: 'Hyperkalaemia (peaked T)',
    hr: 70, spo2: 97, bp: '126/80', severity: 'critical', audio: 'pulse', trace: '#FB7185',
    options: ['Hyperkalaemia', 'Normal Sinus Rhythm', 'STEMI', 'Hypokalaemia'], answer: 0,
    rationale: 'Tall, tented, narrow-based T waves are the EARLIEST ECG sign of hyperkalaemia; later the P flattens and the QRS widens toward a sine wave.',
    action: 'IV calcium gluconate to protect the myocardium, then insulin-dextrose / salbutamol to shift K⁺; treat the cause.',
  },
  {
    id: 'junctional', kind: 'sinus', nBeats: 3, hasP: false, name: 'Junctional Rhythm',
    hr: 48, spo2: 97, bp: '110/70', severity: 'warning', audio: 'pulse', trace: '#67E8F9',
    options: ['Junctional Rhythm', 'Sinus Bradycardia', 'Complete Heart Block', 'Atrial Fibrillation'], answer: 0,
    rationale: 'NO upright P waves with a narrow QRS at ~40–60/min — the AV junction is pacing the heart (sinus-node failure or drug effect).',
    action: 'Treat only if symptomatic — atropine/pacing; review AV-nodal-blocking drugs.',
  },
  {
    id: 'wpw', kind: 'sinus', nBeats: 6, hasP: true, delta: true, name: 'Wolff-Parkinson-White (delta wave)',
    hr: 84, spo2: 98, bp: '122/78', severity: 'warning', audio: 'pulse', trace: '#9BE15D',
    options: ['Wolff-Parkinson-White', 'Normal Sinus Rhythm', 'Bundle branch block', 'STEMI'], answer: 0,
    rationale: 'A SHORT PR with a slurred QRS upstroke (delta wave) from an accessory pathway (bundle of Kent) — pre-excitation, risking tachyarrhythmias.',
    action: 'Avoid AV-nodal blockers in pre-excited AF; definitive treatment is catheter ablation.',
  },
  {
    id: 'svt', kind: 'sinus', nBeats: 11, hasP: false, name: 'Supraventricular Tachycardia',
    hr: 192, spo2: 95, bp: '104/68', severity: 'warning', audio: 'pulse', trace: '#FBBF24',
    options: ['Supraventricular Tachycardia', 'Sinus Tachycardia', 'Ventricular Tachycardia', 'Atrial Flutter'], answer: 0,
    rationale: 'A REGULAR NARROW-complex tachycardia ~150–220/min with no visible P waves (buried in the prior T) — AV-node re-entry.',
    action: 'Vagal manoeuvres, then adenosine if stable; synchronised cardioversion if unstable.',
  },
  {
    id: 'pea', kind: 'sinus', nBeats: 5, hasP: true, name: 'Pulseless Electrical Activity (PEA)',
    hr: 68, spo2: null, bp: '--', severity: 'critical', audio: 'flat', trace: '#F43F5E',
    options: ['Pulseless Electrical Activity', 'Normal Sinus Rhythm', 'Asystole', 'Ventricular Fibrillation'], answer: 0,
    rationale: 'An ORGANISED rhythm on the monitor but NO pulse or blood pressure — the clue is the patient, not the trace. A non-shockable arrest. (Treat the patient, not the monitor.)',
    action: 'CPR + adrenaline every 3–5 min; urgently find and reverse the cause (the H’s and T’s).',
  },
  {
    id: 'chb', kind: 'chb', name: 'Complete (3rd-degree) AV Block',
    hr: 38, spo2: 94, bp: '92/56', severity: 'critical', audio: 'pulse', trace: '#FB7185',
    options: ['Complete heart block', 'First-degree AV block', 'Sinus bradycardia', 'Junctional rhythm'], answer: 0,
    rationale: 'P waves and QRS complexes are COMPLETELY dissociated — atria and ventricles beat independently, with a slow ventricular escape keeping the patient alive.',
    action: 'Atropine is often ineffective — transcutaneous pacing now, then a permanent pacemaker.',
  },
  {
    id: 'mobitz1', kind: 'wenckebach', name: 'Mobitz I (Wenckebach)',
    hr: 56, spo2: 97, bp: '112/72', severity: 'warning', audio: 'pulse', trace: '#FBBF24',
    options: ['Second-degree block, Mobitz I', 'Second-degree block, Mobitz II', 'First-degree AV block', 'Complete heart block'], answer: 0,
    rationale: 'The PR interval LENGTHENS progressively until a QRS is dropped, then the cycle repeats. Usually benign (AV-nodal).',
    action: 'Observe if asymptomatic; review AV-nodal-blocking drugs.',
  },
  {
    id: 'mobitz2', kind: 'mobitz2', name: 'Mobitz II',
    hr: 50, spo2: 96, bp: '106/66', severity: 'critical', audio: 'pulse', trace: '#FB7185',
    options: ['Second-degree block, Mobitz II', 'Second-degree block, Mobitz I', 'First-degree AV block', 'Sinus bradycardia'], answer: 0,
    rationale: 'The PR interval stays CONSTANT and a QRS is suddenly dropped without warning. It can deteriorate abruptly to complete heart block.',
    action: 'Higher risk — pacing (usually a permanent pacemaker) is indicated.',
  },
  {
    id: 'pvc', kind: 'pvc', name: 'Premature Ventricular Complexes',
    hr: 76, spo2: 97, bp: '122/78', severity: 'warning', audio: 'pulse', trace: '#9BE15D',
    options: ['Premature ventricular complexes', 'Premature atrial complexes', 'Ventricular tachycardia', 'Atrial fibrillation'], answer: 0,
    rationale: 'A wide, bizarre, EARLY beat with no preceding P wave and a compensatory pause, on a sinus background. Common and often benign.',
    action: 'Usually none; investigate if frequent, symptomatic, or with structural heart disease / electrolyte disturbance.',
  },
  {
    id: 'bigeminy', kind: 'bigeminy', name: 'Ventricular Bigeminy',
    hr: 72, spo2: 97, bp: '118/76', severity: 'warning', audio: 'pulse', trace: '#FBBF24',
    options: ['Ventricular bigeminy', 'Atrial bigeminy', 'Ventricular tachycardia', 'Normal sinus rhythm'], answer: 0,
    rationale: 'Every sinus beat is followed by a ventricular ectopic (PVC) in a repeating PAIR. Classically linked to digoxin toxicity or electrolyte imbalance.',
    action: 'Check electrolytes and the digoxin level; treat the underlying cause.',
  },
  {
    id: 'torsades', kind: 'torsades', name: 'Torsades de Pointes',
    hr: 220, spo2: 84, bp: '70/40', severity: 'critical', audio: 'vf', trace: '#F43F5E',
    options: ['Torsades de pointes', 'Ventricular fibrillation', 'Monomorphic VT', 'Atrial flutter'], answer: 0,
    rationale: 'Polymorphic VT whose QRS complexes “twist” around the baseline, waxing and waning in amplitude — associated with a long QT interval.',
    action: 'IV magnesium sulphate; stop QT-prolonging drugs; defibrillate if pulseless.',
  },
  {
    id: 'paced', kind: 'paced', name: 'Paced Rhythm',
    hr: 72, spo2: 98, bp: '120/78', severity: 'stable', audio: 'pulse', trace: '#67E8F9',
    options: ['Paced rhythm', 'Wolff-Parkinson-White', 'Bundle branch block', 'Complete heart block'], answer: 0,
    rationale: 'A sharp, narrow PACING SPIKE precedes each wide QRS — a pacemaker is capturing the ventricle. Confirm every spike is followed by capture.',
    action: 'No acute treatment if capturing well; troubleshoot failure to capture / sense.',
  },
  {
    id: 'idioventricular', kind: 'vt', nBeats: 3, name: 'Idioventricular Rhythm',
    hr: 34, spo2: 88, bp: '78/44', severity: 'critical', audio: 'pulse', trace: '#FB7185',
    options: ['Idioventricular rhythm', 'Ventricular tachycardia', 'Complete heart block', 'Asystole'], answer: 0,
    rationale: 'SLOW (~20–40/min), wide, regular complexes with no P waves — a ventricular escape pacemaker, often a pre-terminal or post-arrest rhythm.',
    action: 'Support perfusion and treat the cause; pace if symptomatic. (Accelerated IVR after reperfusion is usually benign and transient.)',
  },
];
