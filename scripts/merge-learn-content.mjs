// =====================================================================
// scripts/merge-learn-content.mjs — dev-time authoring tool (NOT shipped).
//
// Merges authored topic files into public/data/concept-cards.json WITHOUT ever
// touching an existing card. That guarantee matters: a student's saved doubts
// are keyed by card TITLE (src/lib/doubts.js pointId), so rewriting or
// reordering an existing card silently orphans their flags. This script only
// APPENDS.
//
// Input: scratchpad/learn-<topic>.json, each shaped
//   { topicId, extend: { "<existing module>": [ ...new cards... ] },
//     newModules: [ { sub, cards: [...] } ] }
//
// Usage: node scripts/merge-learn-content.mjs <file...>
// Then ALWAYS run: node scripts/check-learn-content.mjs
// =====================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = join(root, 'public', 'data', 'concept-cards.json');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/merge-learn-content.mjs <authored.json...>');
  process.exit(1);
}

const base = JSON.parse(readFileSync(TARGET, 'utf8'));

for (const f of files) {
  const doc = JSON.parse(readFileSync(f, 'utf8'));
  const { topicId, extend = {}, newModules = [] } = doc;
  if (!topicId) { console.error(`${f}: no topicId`); process.exit(1); }

  if (!base[topicId]) base[topicId] = [];
  const mods = base[topicId];

  // 1) APPEND to existing modules. Existing cards are never read, reordered or
  //    rewritten, only pushed onto.
  for (const [sub, cards] of Object.entries(extend)) {
    const target = mods.find(m => m.sub === sub);
    if (!target) {
      console.error(`${f}: extend target module "${sub}" does not exist in ${topicId}. `
        + `Existing: ${mods.map(m => m.sub).join(' | ')}`);
      process.exit(1);
    }
    target.cards.push(...cards);
    console.log(`  ${topicId} / "${sub}": +${cards.length} card(s) -> ${target.cards.length}`);
  }

  // 2) Add wholly new modules.
  for (const m of newModules) {
    if (mods.some(x => x.sub === m.sub)) {
      console.error(`${f}: module "${m.sub}" already exists in ${topicId}; put its cards under "extend" instead`);
      process.exit(1);
    }
    mods.push({ sub: m.sub, cards: m.cards });
    console.log(`  ${topicId} / "${m.sub}": NEW module, ${m.cards.length} card(s)`);
  }
}

writeFileSync(TARGET, JSON.stringify(base, null, 2) + '\n', 'utf8');

const totals = Object.entries(base).map(([t, m]) => [t, m.length, m.reduce((s, x) => s + x.cards.length, 0)]);
const mods = totals.reduce((s, r) => s + r[1], 0);
const cards = totals.reduce((s, r) => s + r[2], 0);
console.log(`\nwrote concept-cards.json: ${Object.keys(base).length} topics, ${mods} modules, ${cards} cards`);
