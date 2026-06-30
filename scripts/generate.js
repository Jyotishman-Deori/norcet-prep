// =====================================================================
// scripts/generate.js — LOCAL AI question generator (run by hand only).
//
// Two-stage Gemini pipeline that drafts NORCET questions and inserts them into
// the `questions_staging` Supabase table for human review in the admin app.
//
// ⚠️  This NEVER ships with the app. It is a developer tool run via
//     `npm run generate:content`. Its deps (@google/genai, @supabase/supabase-js,
//     dotenv) are devDependencies and are never imported by app code, so they do
//     not enter dist/ or dist-admin/. Honours CLAUDE.md's "no runtime AI" rule:
//     the only AI call is here, offline, and every question is human-reviewed
//     before it can reach a student.
//
// ⚠️  NEVER enable billing on the Google AI Studio project — stay on free tier.
//
// Env (local .env, gitignored — see .env.example):
//   GEMINI_API_KEY              required
//   SUPABASE_URL                required  (https://<ref>.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   required  (bypasses RLS to insert into staging)
//   GEMINI_MODEL                optional  (default below — VERIFY the current id)
//   TOPIC                       optional  (skips the interactive menu if set)
//
// Usage:  npm run generate:content        → prompts you to pick a topic
//         $env:TOPIC="pharm"; npm run generate:content   → non-interactive (PowerShell)
// =====================================================================
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// The exact free-tier Flash model id moves over time — override with GEMINI_MODEL
// if this default 404s. ("gemini-3-flash" was not GA at time of writing.)
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Exam topic ids → full names, for richer prompting (mirrors src/data/seed.js TOPICS).
const TOPIC_NAMES = {
  fund: 'Fundamentals of Nursing', anat: 'Anatomy & Physiology', msn: 'Medical-Surgical Nursing',
  pharm: 'Pharmacology', peds: 'Pediatric Nursing', obg: 'Obstetrics & Gynaecology',
  ch: 'Community Health', mhn: 'Mental Health Nursing', micro: 'Microbiology', nutr: 'Nutrition',
  gk: 'General Knowledge', apt: 'Reasoning & Aptitude',
};

// Resolve the topic: honour $env:TOPIC if set (keeps the script scriptable for
// batch runs), otherwise show a numbered menu and prompt. Accepts an id ('pharm')
// or a list number (1–12); blank input defaults to 'msn'.
async function resolveTopic() {
  if (process.env.TOPIC && process.env.TOPIC.trim()) return process.env.TOPIC.trim();
  const ids = Object.keys(TOPIC_NAMES);
  console.log('\nPick a topic to generate questions for:\n');
  ids.forEach((id, i) => console.log(`  ${String(i + 1).padStart(2)}. ${id.padEnd(6)} ${TOPIC_NAMES[id]}`));
  const rl = createInterface({ input, output });
  const answer = (await rl.question('\nEnter topic id or number [msn]: ')).trim();
  rl.close();
  if (!answer) return 'msn';
  const n = Number(answer);
  if (Number.isInteger(n) && n >= 1 && n <= ids.length) return ids[n - 1];
  const lc = answer.toLowerCase();
  if (TOPIC_NAMES[lc]) return lc;
  console.error(`✗ Unknown topic "${answer}". Use one of: ${ids.join(', ')}`);
  process.exit(1);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`✗ Missing required env var: ${name} (set it in .env — see .env.example)`); process.exit(1); }
  return v;
}

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function gen(prompt) {
  const res = await ai.models.generateContent({ model: MODEL, contents: prompt });
  return (res && typeof res.text === 'string') ? res.text : '';
}

// Pull a JSON array out of a model response (tolerates ```json fences / prose).
function extractJsonArray(text) {
  let s = String(text || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON array found in model output');
  return JSON.parse(s.slice(start, end + 1));
}

// Keep only well-formed questions matching the app's schema.
function validate(q) {
  if (!q || typeof q !== 'object') return false;
  if (typeof q.q !== 'string' || !q.q.trim()) return false;
  if (!Array.isArray(q.options) || q.options.length < 2) return false;
  if (q.type !== 'mcq' && q.type !== 'msq') return false;
  if (!Array.isArray(q.correct) || q.correct.length < 1) return false;
  if (!q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length)) return false;
  return true;
}

async function main() {
  const TOPIC = await resolveTopic();
  const topicName = TOPIC_NAMES[TOPIC] || TOPIC;
  console.log(`▶ Generating for topic "${TOPIC}" (${topicName}) with model ${MODEL}…`);

  // ---- Stage 1: brainstorm advanced scenarios -------------------------------
  const stage1 = await gen(
    `You are a senior NORCET (Indian nursing officer exam) question author.\n` +
    `Brainstorm exactly 10 ADVANCED exam scenarios for the topic "${topicName}".\n` +
    `Difficulty mix: 3 easy, 4 medium, 3 hard. Focus on clinical reasoning, prioritisation, ` +
    `and applied judgement — AVOID basic definitions and rote recall.\n` +
    `For each, give a one-line scenario and the single key concept it tests. Number them 1–10.`
  );
  if (!stage1.trim()) { console.error('✗ Stage 1 returned empty output'); process.exit(1); }

  // ---- Stage 2: format to strict JSON matching the DB schema ----------------
  const stage2 = await gen(
    `Convert these NORCET scenarios into a STRICT JSON ARRAY. Output JSON ONLY — no prose, no code fences.\n\n` +
    `Each element MUST match exactly:\n` +
    `{"topic":"${TOPIC}","sub":"<subtopic>","type":"mcq"|"msq","q":"<question>",` +
    `"options":["..."],"correct":[<0-based index ints>],"exp":"<why the answer is right>",` +
    `"wrong":{"<optIndex>":"<why that option is wrong>"},"memoryTip":"<mnemonic/recall hook>",` +
    `"difficulty":"easy"|"medium"|"hard","image":null}\n\n` +
    `Rules: "type" is "msq" only when there are multiple correct answers (else "mcq"). ` +
    `"correct" indexes into "options". "wrong" has an entry for each INCORRECT option index. ` +
    `Keep "topic" exactly "${TOPIC}". Return all 10.\n\nScenarios:\n${stage1}`
  );

  let parsed;
  try { parsed = extractJsonArray(stage2); }
  catch (e) { console.error(`✗ Could not parse Stage 2 JSON: ${e.message}`); process.exit(1); }
  if (!Array.isArray(parsed)) { console.error('✗ Stage 2 did not return an array'); process.exit(1); }

  const valid = [];
  let skipped = 0;
  for (const q of parsed) {
    if (validate(q)) {
      valid.push({
        topic: TOPIC,
        sub: typeof q.sub === 'string' ? q.sub : null,
        type: q.type,
        q: q.q,
        options: q.options,
        correct: q.correct,
        exp: typeof q.exp === 'string' ? q.exp : null,
        wrong: (q.wrong && typeof q.wrong === 'object') ? q.wrong : {},
        memoryTip: typeof q.memoryTip === 'string' ? q.memoryTip : null,
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : null,
        image: q.image == null ? null : String(q.image),
      });
    } else { skipped++; }
  }

  console.log(`  parsed ${parsed.length} · valid ${valid.length} · skipped ${skipped}`);
  if (valid.length === 0) { console.error('✗ Nothing valid to insert'); process.exit(1); }

  const { error } = await supabase.from('questions_staging').insert(valid);
  if (error) { console.error(`✗ Supabase insert failed: ${error.message}`); process.exit(1); }

  console.log(`✓ Inserted ${valid.length} question(s) into questions_staging. Review them in the admin app → Content Review.`);
}

main().catch(e => { console.error('✗ Generator failed:', e && e.message ? e.message : e); process.exit(1); });
