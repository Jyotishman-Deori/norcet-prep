// =====================================================================
// scripts/check-learn-content.mjs — the Learn content gate.
//
// public/data/concept-cards.json feeds THREE surfaces at once (Modules, the
// derived Guidebook, and Quick Revision), and several of its invariants are
// enforced nowhere in code: break one and the app degrades SILENTLY, with no
// error, for every user. This script is the gate. Run by `npm test`.
//
// What it enforces and why (each rule below is a bug that was actually live):
//
//  1. UNIQUE CARD TITLES PER TOPIC. Doubt ids are pointId(topic, cardTitle) =
//     `${topic}::${title}` with NO module in the key (src/lib/doubts.js). All 8
//     aptitude modules shipped the SAME 4 titles, so flagging "Worked example"
//     in one module flagged it in all eight. Quick Revision's findCardByTitle
//     also returns the FIRST match, so it served the wrong card.
//
//  2. NO EXISTING TITLE MAY DISAPPEAR (the anti-orphan guard). A user's flags
//     are keyed by title, so renaming or deleting a card silently ORPHANS every
//     doubt they saved on it. Growing the corpus must be additive. The baseline
//     lives in scripts/learn-title-baseline.json; it is append-only.
//
//  3. EVERY MODULE NEEDS >= 1 keypoints AND >= 1 mnemonic. The Guidebook is not
//     a file: compileGuidebook() (src/lib/learn-path.js) DERIVES it by
//     harvesting exactly those two card types. A module with neither contributes
//     nothing, and a topic with neither has NO guidebook at all (which is why
//     Reasoning's guidebook read "No summary content for this unit yet").
//     Those two types are also 2 of the 3 ESSENTIAL_TYPES Quick Revision keeps
//     inside 30 days of the exam.
//
//  4. EVERY MODULE NEEDS >= MIN_CARDS. cardBudget() (src/lib/quick-revision.js)
//     asks for perTopic: 5. Seven of the ten nursing topics could not fill that,
//     so Quick Revision quietly under-delivered on almost every topic it picked.
//
//  5. Valid card types (must match learn-cards.jsx's typeMeta, or the card
//     silently renders as a plain "Concept"), valid topic ids (must exist in
//     TOPICS, or the topic is invisible), and NO EM DASHES (house rule).
// =====================================================================
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_PATH = join(root, 'public', 'data', 'concept-cards.json');
const BASELINE_PATH = join(root, 'scripts', 'learn-title-baseline.json');

// Must match typeMeta in src/screens/learn-cards.jsx. An unknown type does not
// throw, it silently falls back to "concept", which is worse than an error.
const CARD_TYPES = ['concept', 'mnemonic', 'keypoints', 'quiz', 'whatTests', 'method', 'worked', 'mistake'];
// Must match TOPICS in src/data/seed.js.
const TOPIC_IDS = ['fund', 'anat', 'msn', 'pharm', 'peds', 'obg', 'ch', 'mhn', 'micro', 'nutr', 'gk', 'apt'];

const MIN_CARDS_PER_MODULE = 5;   // = cardBudget()'s perTopic ceiling

const problems = [];
const warn = (m) => problems.push(m);

let raw;
try {
  raw = readFileSync(CARDS_PATH, 'utf8');
} catch (e) {
  console.error('check-learn-content: cannot read public/data/concept-cards.json');
  process.exit(1);
}

// Em dashes are banned in user-facing copy. En dashes (–) in numeric ranges
// ("60–100 bpm") are correct typography and are deliberately NOT flagged.
const emDashes = (raw.match(/—/g) || []).length;
if (emDashes) warn(`${emDashes} em dash(es) in concept-cards.json: use a period, comma or colon`);
const dblHyphen = (raw.match(/(^|[^-])--([^->]|$)/g) || []).length;
if (dblHyphen) warn(`${dblHyphen} double hyphen(s) in concept-cards.json: use a period, comma or colon`);

let cards;
try {
  cards = JSON.parse(raw);
} catch (e) {
  console.error('check-learn-content: concept-cards.json is not valid JSON:', e.message);
  process.exit(1);
}

const seenTitles = new Set();   // `${topic}::${title}` across the whole file
let totalModules = 0;
let totalCards = 0;
const perTopic = {};

for (const [topicId, modules] of Object.entries(cards)) {
  if (!TOPIC_IDS.includes(topicId)) {
    warn(`unknown topic id "${topicId}": it will be invisible in Learn (not in TOPICS)`);
    continue;
  }
  if (!Array.isArray(modules) || modules.length === 0) {
    warn(`topic "${topicId}" has no modules`);
    continue;
  }

  const titlesInTopic = new Map();   // title -> [module subs that used it]
  let topicCards = 0;

  const subs = new Set();
  for (const mod of modules) {
    totalModules++;
    if (!mod || typeof mod !== 'object') { warn(`${topicId}: a module is not an object`); continue; }
    if (typeof mod.sub !== 'string' || !mod.sub.trim()) { warn(`${topicId}: a module has no "sub" name`); continue; }
    if (subs.has(mod.sub)) warn(`${topicId}: duplicate module name "${mod.sub}"`);
    subs.add(mod.sub);

    const list = Array.isArray(mod.cards) ? mod.cards : [];
    if (list.length < MIN_CARDS_PER_MODULE) {
      warn(`${topicId} / "${mod.sub}": ${list.length} card(s), needs >= ${MIN_CARDS_PER_MODULE} (Quick Revision asks for 5)`);
    }

    let hasKeypoints = false;
    let hasMnemonic = false;

    list.forEach((c, i) => {
      totalCards++;
      topicCards++;
      const where = `${topicId} / "${mod.sub}" / card ${i + 1}`;
      if (!c || typeof c !== 'object') { warn(`${where}: not an object`); return; }

      if (!c.type || !CARD_TYPES.includes(c.type)) {
        warn(`${where}: type "${c.type}" is not one of ${CARD_TYPES.join('/')} (it would silently render as a plain Concept)`);
      }
      if (c.type === 'keypoints') hasKeypoints = true;
      if (c.type === 'mnemonic') hasMnemonic = true;

      if (typeof c.title !== 'string' || !c.title.trim()) { warn(`${where}: missing title`); return; }

      // body: a string, or (keypoints/method) an array of strings
      const bodyOk = (typeof c.body === 'string' && c.body.trim())
        || (Array.isArray(c.body) && c.body.length > 0 && c.body.every(b => typeof b === 'string' && b.trim()));
      if (!bodyOk) warn(`${where} ("${c.title}"): body must be a non-empty string, or an array of strings`);

      if (c.clinicalNote != null && typeof c.clinicalNote !== 'string') {
        warn(`${where} ("${c.title}"): clinicalNote must be a string`);
      }

      // ⚠ RULE 1 — unique titles within a topic (doubt ids collide otherwise).
      if (titlesInTopic.has(c.title)) {
        titlesInTopic.get(c.title).push(mod.sub);
      } else {
        titlesInTopic.set(c.title, [mod.sub]);
      }
      seenTitles.add(`${topicId}::${c.title}`);
    });

    // ⚠ RULE 3 — the Guidebook is DERIVED from these two types only.
    if (!hasKeypoints) warn(`${topicId} / "${mod.sub}": no "keypoints" card, so it contributes nothing to the Guidebook`);
    if (!hasMnemonic) warn(`${topicId} / "${mod.sub}": no "mnemonic" card, so it contributes nothing to the Guidebook`);
  }

  for (const [title, mods] of titlesInTopic) {
    if (mods.length > 1) {
      warn(`${topicId}: card title "${title}" is reused by ${mods.length} modules (${mods.join(', ')}). `
        + 'Doubt ids are topic+title, so flagging it in one flags it in ALL of them.');
    }
  }

  perTopic[topicId] = { modules: modules.length, cards: topicCards };
}

// Topics with no content at all are invisible in Learn (learn-topics.jsx filters
// on topicsWithCards), yet search still deep-links into them.
for (const id of TOPIC_IDS) {
  if (!cards[id]) warn(`topic "${id}" has NO entry: it is dropped from Path/Modules/Quick, but search still links to it`);
}

// ⚠ RULE 2 — the anti-orphan guard. Titles are append-only.
if (existsSync(BASELINE_PATH)) {
  let baseline = [];
  try { baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); } catch (e) { baseline = []; }
  const missing = baseline.filter(k => !seenTitles.has(k));
  if (missing.length) {
    warn(`${missing.length} card title(s) from the baseline no longer exist. A user's saved doubts are keyed by `
      + 'title, so renaming or deleting a card ORPHANS their flags. Keep the old title, or add it back:\n    '
      + missing.slice(0, 12).join('\n    ') + (missing.length > 12 ? `\n    ...and ${missing.length - 12} more` : ''));
  }
}

if (problems.length) {
  console.error(`check-learn-content: ${problems.length} problem(s):`);
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

const nursing = TOPIC_IDS.filter(t => t !== 'gk' && t !== 'apt');
const nursingCards = nursing.reduce((s, t) => s + ((perTopic[t] && perTopic[t].cards) || 0), 0);
console.log(`check-learn-content: OK — ${Object.keys(cards).length} topics, ${totalModules} modules, ${totalCards} cards `
  + `(${nursingCards} across the ${nursing.length} nursing subjects).`);
