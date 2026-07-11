// =====================================================================
// src/lib/content-packs.js — remote CONTENT PACKS (evergrowing content).
//
// The four static content sections (dosage drills, concept cards, reference
// values, quotes) ship a BASE in the bundle / public JSON, and grow without
// a code deploy via a "pack" stored in kv_shared under `cpack:<type>`. The
// client reads the pack (public anon read, offline-mirrored) and merges it
// OVER the base at load. Admins author packs in the Content Studio.
//
// Pure module: validators + mergers only. No storage, no network — the
// Studio and content.js wire those. NO em dashes / "--" in authored copy
// (same hard rule as the rest of the app); the validators REJECT them so
// the content bank stays clean at the source.
// =====================================================================

export const CPACK_TYPES = ['dosage', 'conceptCards', 'reference', 'quotes', 'assistant'];
export const cpackKey = (type) => `cpack:${type}`;

function isStr(x) { return typeof x === 'string' && x.trim().length > 0; }
function hasDash(x) { return typeof x === 'string' && (x.includes('—') || x.includes('--')); }
// Walk every string in a value; true if any contains a forbidden dash.
function anyDash(v) {
  if (typeof v === 'string') return hasDash(v);
  if (Array.isArray(v)) return v.some(anyDash);
  if (v && typeof v === 'object') return Object.values(v).some(anyDash);
  return false;
}

// ---- per-type item validators: return [] when clean, else error strings ----
function vDosage(it) {
  const e = [];
  if (!isStr(it.id)) e.push('id required');
  if (!isStr(it.q)) e.push('q (question) required');
  if (typeof it.answer !== 'number' || !Number.isFinite(it.answer)) e.push('answer must be a number');
  if (!isStr(it.unit)) e.push('unit required');
  if (it.tolerance != null && (typeof it.tolerance !== 'number' || it.tolerance < 0)) e.push('tolerance must be >= 0');
  if (it.steps != null && !(Array.isArray(it.steps) && it.steps.every(isStr))) e.push('steps must be an array of strings');
  return e;
}
function vReference(it) {
  const e = [];
  if (!isStr(it.cat)) e.push('cat required');
  if (!isStr(it.label)) e.push('label required');
  if (!isStr(it.value)) e.push('value required');
  return e;
}
function vQuote(it) {
  const e = [];
  if (!isStr(it.text)) e.push('text required');
  if (!isStr(it.source)) e.push('source required');
  return e;
}
// Concept cards nest: { topicId, sub, cards:[{type,title,body,clinicalNote?}] }
const CARD_TYPES = ['concept', 'mnemonic', 'keypoints'];
function vConceptGroup(it) {
  const e = [];
  if (!isStr(it.topicId)) e.push('topicId required');
  if (!isStr(it.sub)) e.push('sub required');
  if (!Array.isArray(it.cards) || it.cards.length === 0) e.push('cards[] required');
  else it.cards.forEach((c, i) => {
    if (!c || typeof c !== 'object') { e.push(`card ${i + 1} invalid`); return; }
    if (c.type && !CARD_TYPES.includes(c.type)) e.push(`card ${i + 1}: type must be concept/mnemonic/keypoints`);
    if (!isStr(c.title)) e.push(`card ${i + 1}: title required`);
    // body is a string OR (keypoints) an array of strings
    const bodyOk = isStr(c.body) || (Array.isArray(c.body) && c.body.every(isStr));
    if (!bodyOk) e.push(`card ${i + 1}: body required (string or bullet array)`);
  });
  return e;
}

// Ask-companion KB entries. `route.screen` is checked against the same safe
// screen list the search router enforces (deep links must stay in-bounds).
const ASSISTANT_CATS = ['basics', 'tests', 'progress', 'levelup', 'learn', 'community', 'account', 'premium', 'fixes'];
const ASSISTANT_ROUTE_SCREENS = [
  'home', 'settings', 'themes', 'notifications', 'share-app', 'premium',
  'quick-setup', 'topic-select', 'mock-setup', 'previous-papers', 'drill-tests',
  'level-up', 'weak-areas', 'stats', 'leaderboard', 'coverage', 'weightage',
  'knowledge-map', 'learn-topics', 'revision-sheet', 'bookmarks-view',
  'favorites', 'library', 'doubts', 'study-plan', 'reference', 'dosage',
  'faq', 'study-methods', 'my-reports', 'mistake-vault', 'about', 'legal',
];
function vAssistant(it) {
  const e = [];
  if (!isStr(it.id)) e.push('id required');
  if (!isStr(it.q)) e.push('q (the question) required');
  if (!isStr(it.a)) e.push('a (the answer) required');
  if (!ASSISTANT_CATS.includes(it.cat)) e.push(`cat must be one of ${ASSISTANT_CATS.join('/')}`);
  if (!(Array.isArray(it.keywords) && it.keywords.length >= 2 && it.keywords.every(isStr))) e.push('keywords: at least 2 strings');
  if (it.related != null && !(Array.isArray(it.related) && it.related.every(isStr))) e.push('related must be an array of ids');
  if (it.route != null) {
    if (!it.route || typeof it.route !== 'object' || !ASSISTANT_ROUTE_SCREENS.includes(it.route.screen)) e.push('route.screen is not an allowed screen');
    if (!isStr(it.routeLabel)) e.push('routeLabel required when route is set');
  }
  return e;
}

const VALIDATORS = { dosage: vDosage, reference: vReference, quotes: vQuote, conceptCards: vConceptGroup, assistant: vAssistant };

// validatePackItems(type, items) -> { valid: [...], invalid: [{index, errors, preview}] }
// Rejects forbidden dashes across all string fields (house rule).
export function validatePackItems(type, items) {
  const check = VALIDATORS[type];
  if (!check) return { valid: [], invalid: [], parseError: `Unknown content type: ${type}` };
  if (!Array.isArray(items)) return { valid: [], invalid: [], parseError: 'Expected a JSON array of items.' };
  const valid = [], invalid = [];
  items.forEach((it, i) => {
    const errs = (it && typeof it === 'object') ? check(it) : ['not an object'];
    if (it && typeof it === 'object' && anyDash(it)) errs.push('remove the long dash (—) or "--"; use a period, comma, or colon');
    if (errs.length === 0) valid.push(it);
    else invalid.push({ index: i + 1, errors: errs, preview: previewOf(type, it) });
  });
  return { valid, invalid };
}
function previewOf(type, it) {
  if (!it || typeof it !== 'object') return '(invalid)';
  if (type === 'quotes') return String(it.text || '').slice(0, 60);
  if (type === 'reference') return `${it.label || ''} = ${it.value || ''}`.slice(0, 60);
  if (type === 'conceptCards') return `${it.topicId || '?'} / ${it.sub || ''}`.slice(0, 60);
  return String(it.q || it.id || '').slice(0, 60);  // dosage + assistant
}

// ---- pack shape + normalization ----
export function makePack(type, items, now = Date.now()) {
  return { v: 1, type, updatedAt: now, items: Array.isArray(items) ? items : [] };
}
export function normalizePack(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null;
  return { v: raw.v || 1, type: raw.type, updatedAt: raw.updatedAt || 0, items: raw.items };
}

// ---- mergers: base (bundled) first, then append pack items ----
// dosage/reference: append; dosage dedupes by id (base wins).
export function mergeDosage(base, packItems) {
  const out = Array.isArray(base) ? [...base] : [];
  const seen = new Set(out.map(x => x && x.id).filter(Boolean));
  for (const it of (packItems || [])) {
    if (it && it.id && seen.has(it.id)) continue;
    if (it && it.id) seen.add(it.id);
    out.push(it);
  }
  return out;
}
export function mergeReference(base, packItems) {
  return [...(Array.isArray(base) ? base : []), ...((packItems || []))];
}
// quotes: append, dedupe by exact text (base wins).
export function mergeQuotes(base, packItems) {
  const out = Array.isArray(base) ? [...base] : [];
  const seen = new Set(out.map(x => x && x.text).filter(Boolean));
  for (const it of (packItems || [])) {
    if (it && it.text && seen.has(it.text)) continue;
    if (it && it.text) seen.add(it.text);
    out.push(it);
  }
  return out;
}
// assistant KB: append, dedupe by id (base wins; admins add NEW entries,
// corrections to bundled ones ship with the app).
export function mergeAssistant(base, packItems) {
  const out = Array.isArray(base) ? [...base] : [];
  const seen = new Set(out.map(x => x && x.id).filter(Boolean));
  for (const it of (packItems || [])) {
    if (!it || !it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}
// concept cards: base is a { topicId: [ {sub, cards} ] } map. Pack items are
// flat { topicId, sub, cards }. Append each into its topic; if the sub already
// exists in the base, APPEND the pack's cards to that sub (base cards first).
export function mergeConceptCards(base, packItems) {
  const out = {};
  for (const k of Object.keys(base || {})) out[k] = (base[k] || []).map(g => ({ ...g, cards: [...(g.cards || [])] }));
  for (const it of (packItems || [])) {
    if (!it || !it.topicId) continue;
    if (!out[it.topicId]) out[it.topicId] = [];
    const existing = out[it.topicId].find(g => g.sub === it.sub);
    if (existing) existing.cards.push(...(it.cards || []));
    else out[it.topicId].push({ sub: it.sub, cards: [...(it.cards || [])] });
  }
  return out;
}
