// =====================================================================
// src/lib/question-import.js — shared question parsing + validation (A1 slice 17)
// Extracted VERBATIM from App.jsx. Used by the per-user bulk import AND the
// admin bank uploader (BankEditor), so format/rules stay identical. Dep:
// parseCsvLine (./utils.js). EXPORTS: processQuestionInput, validateQuestionFields.
// parseQuestionInput + normalizeQuestion stay module-internal.
// =====================================================================
import { parseCsvLine } from './utils.js';
import { resolveTopicId } from './topics.js';

export function validateQuestionFields(q, opts = {}) {
  // requireExp=false is the PREVIOUS-PAPER concession: official papers ship
  // answer-only; explanations get authored over time. Everything else keeps
  // demanding an explanation (the app's core promise).
  const requireExp = opts.requireExp !== false;
  const errs = [];
  if (!q.q || typeof q.q !== 'string' || !q.q.trim()) errs.push('Missing question text');
  if (!Array.isArray(q.options) || q.options.length < 2) errs.push('Need ≥2 options');
  else if (q.options.some(o => !o || typeof o !== 'string' || !o.trim())) errs.push('Empty option');
  if (!Array.isArray(q.correct) || q.correct.length === 0) errs.push('Missing correct answer(s)');
  else if (q.correct.some(c => !Number.isInteger(c) || c < 0 || c >= (q.options?.length || 0))) errs.push('Correct index out of range');
  if (requireExp && (!q.exp || typeof q.exp !== 'string' || !q.exp.trim())) errs.push('Missing explanation');
  if (q.type && !['mcq', 'msq'].includes(q.type)) errs.push('type must be mcq or msq');
  if (q.type === 'mcq' && q.correct && q.correct.length !== 1) errs.push('mcq needs exactly 1 correct');
  if (q.difficulty && !['easy', 'medium', 'hard'].includes(q.difficulty)) errs.push('difficulty must be easy/medium/hard');
  return errs;
}

// Normalize a raw parsed question into the canonical shape used app-wide.
function normalizeQuestion(raw, idPrefix) {
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    // Canonicalise drafted topic variants ("aptitude", "Pharmacology", …)
    // onto registry ids at upload time, so phantom topics can't be created.
    topic: resolveTopicId(raw.topic) || 'fund',
    sub: raw.sub || 'General',
    type: raw.type || 'mcq',
    q: raw.q.trim(),
    options: raw.options.map(o => o.trim()),
    correct: raw.correct,
    exp: typeof raw.exp === 'string' ? raw.exp.trim() : '',
    wrong: raw.wrong || {},
    // Session 1 — optional memory tip (intuition anchor). Accept either the
    // CSV column `memory_tip` or a JSON `memoryTip` field; omit when blank.
    ...((raw.memoryTip || raw.memory_tip) && String(raw.memoryTip || raw.memory_tip).trim()
        ? { memoryTip: String(raw.memoryTip || raw.memory_tip).trim() } : {}),
    ...(raw.difficulty ? { difficulty: raw.difficulty } : {}),
    ...(raw.source ? { source: String(raw.source).trim() } : {}),
    // P17 — preserve an optional image URL / data-URI if the bank provides one.
    ...(raw.image ? { image: String(raw.image).trim() } : {}),
    // Media round — optional VIDEO link (YouTube preferred; any https URL).
    // Rendered by QuestionVideo between the stem and the options.
    ...(raw.video ? { video: String(raw.video).trim() } : {}),
    // P16 — preserve optional PYQ provenance fields when an imported bank
    // supplies them (matches the documented bank schema). Purely additive: a
    // question without these stays exactly as before. No stored-schema change
    // is implied — these are optional, like `source`/`difficulty`/`image`.
    ...(raw.isPYQ === true ? { isPYQ: true } : {}),
    ...((typeof raw.pyqYear === 'number' && raw.pyqYear > 0) ? { pyqYear: raw.pyqYear } : {}),
    ...((typeof raw.pyqExam === 'string' && raw.pyqExam.trim()) ? { pyqExam: raw.pyqExam.trim() } : {}),
    // FOUNDATION A1 — optional must-know survival/safety flag. Accept the app's
    // `foundational` or the spec's `is_foundational` (CSV `is_foundational`
    // column → "true"/"1"). Powers PHIL-06 Vitals Check. Purely additive, like
    // source/difficulty/image — a question without it stays exactly as before.
    ...(raw.foundational === true || raw.is_foundational === true
        || /^(true|1|yes)$/i.test(String(raw.foundational ?? raw.is_foundational ?? '').trim())
        ? { foundational: true } : {})
  };
}

// [A1 s3] isPYQ/pyqLabel → lib/pyq.js

// Parse JSON or CSV → { items: [...] } or { parseError: '...' }
function parseQuestionInput(text, format) {
  if (!text || !text.trim()) return { parseError: 'Paste something first.' };
  try {
    if (format === 'json') {
      const parsed = JSON.parse(text);
      return { items: Array.isArray(parsed) ? parsed : [parsed] };
    }
    // CSV
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { parseError: 'Need a header row and at least one data row.' };
    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    const items = lines.slice(1).map(line => {
      const fields = parseCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = fields[i] !== undefined ? fields[i] : ''; });
      if (obj.options) obj.options = String(obj.options).split('|').map(s => s.trim()).filter(Boolean);
      if (obj.correct !== undefined && obj.correct !== '') {
        obj.correct = String(obj.correct).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      }
      if (obj.wrong && typeof obj.wrong === 'string' && obj.wrong.trim()) {
        const wrongObj = {};
        obj.wrong.split(';').forEach(pair => {
          const idx = pair.indexOf(':');
          if (idx > 0) {
            const k = pair.slice(0, idx).trim();
            const v = pair.slice(idx + 1).trim();
            if (k && v) wrongObj[k] = v;
          }
        });
        obj.wrong = wrongObj;
      } else if (!obj.wrong) {
        obj.wrong = {};
      }
      return obj;
    });
    return { items };
  } catch (e) {
    return { parseError: 'Parse error: ' + e.message };
  }
}

// Run parse + validate together. Returns { valid, invalid, parseError }
// opts.requireExp=false relaxes the explanation rule (previous papers only).
export function processQuestionInput(text, format, idPrefix = 'q', opts = {}) {
  const parsed = parseQuestionInput(text, format);
  if (parsed.parseError) return { valid: [], invalid: [], parseError: parsed.parseError };
  const valid = [], invalid = [];
  parsed.items.forEach((q, i) => {
    const errs = validateQuestionFields(q, opts);
    if (errs.length === 0) {
      valid.push(normalizeQuestion(q, idPrefix));
    } else {
      invalid.push({
        index: i + 1,
        errors: errs,
        preview: (q && q.q) ? String(q.q).slice(0, 80) : '(no question text)'
      });
    }
  });
  return { valid, invalid };
}

// Example "paste an example" payloads, shared by the bank editor (BankEditor)
// and the bulk-import screen — both consume them, so they live in this lib.
export const EXAMPLE_QUESTIONS_JSON = JSON.stringify([
  {
    q: "What is the normal adult resting pulse rate?",
    type: "mcq",
    topic: "fund",
    sub: "Vital Signs",
    options: ["40-60 bpm", "60-100 bpm", "100-120 bpm", "120-140 bpm"],
    correct: [1],
    exp: "Normal adult resting pulse is 60-100 bpm.",
    wrong: { "0": "Bradycardia", "2": "Mild tachycardia", "3": "Significant tachycardia" },
    difficulty: "easy",
    source: "NORCET 2023 PYQ"
  },
  {
    q: "Which are signs of digoxin toxicity? (Select all that apply)",
    type: "msq",
    topic: "pharm",
    options: ["Yellow halos", "Bradycardia", "Nausea", "Hypertension"],
    correct: [0, 1, 2],
    exp: "Digoxin toxicity: visual disturbances, bradycardia, GI symptoms.",
    wrong: { "3": "Hypertension is not a digoxin toxicity feature." },
    difficulty: "medium",
    source: "Park textbook"
  },
  {
    // P17 — image-based example. `image` is OPTIONAL: a public URL (host on
    // your Cloudflare R2 bucket via the admin uploader) or, as here, an inline
    // data URI for a quick test. The figure renders between the stem and the
    // options. `video` (also optional) takes a YouTube or https link.
    q: "Identify the figure shown above.",
    type: "mcq",
    topic: "fund",
    sub: "Equipment",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120'%3E%3Crect width='240' height='120' rx='10' fill='%23e9e2d4'/%3E%3Ctext x='120' y='66' font-size='15' text-anchor='middle' fill='%23555' font-family='sans-serif'%3ESample figure%3C/text%3E%3C/svg%3E",
    options: ["Sample figure", "ECG strip", "Chest X-ray", "Suction catheter"],
    correct: [0],
    exp: "This is a placeholder figure, replace `image` with your hosted PYQ image URL.",
    difficulty: "easy",
    source: "Image demo"
  }
], null, 2);

export const EXAMPLE_QUESTIONS_CSV = `q,type,topic,sub,options,correct,exp,wrong,difficulty,source,image,video
"Normal adult pulse rate?",mcq,fund,Vital Signs,"40-60 bpm|60-100 bpm|100-120 bpm|120-140 bpm","1","Normal adult pulse is 60-100 bpm.","0:Bradycardia;2:Mild tachycardia;3:Significant tachycardia",easy,"NORCET 2023 PYQ",,
"Signs of digoxin toxicity?",msq,pharm,Cardiac,"Yellow halos|Bradycardia|Nausea|Hypertension","0,1,2","Visual + brady + GI.","3:HTN is not digoxin toxicity",medium,"Park textbook",,
"Identify the instrument shown above.",mcq,fund,Equipment,"Laryngoscope|Otoscope|Ophthalmoscope|Stethoscope","0","Replace the image URL with your hosted image (R2 public URL).","",easy,"Image demo","https://pub-YOURBUCKET.r2.dev/q/example.png","https://youtu.be/dQw4w9WgXcQ"`;
