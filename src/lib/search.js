// =====================================================================
// src/lib/search.js — GLOBAL SEARCH engine (pure, Node-testable).
// Powers the Search tab: one keyword box across every study surface —
// practice questions, quick-reference rows, concept cards, dosage drills
// and FAQs. Deliberately dependency-light: no storage, no React; the
// screen feeds it already-loaded data (useData / useContent / listFaqs)
// and renders the grouped, scored results it returns.
//
// Matching model (small corpus, so keep it predictable, not fuzzy):
//   • AND semantics — every query token must appear in an entry's title
//     or body haystack, so extra words NARROW the results.
//   • Field weighting — a title hit outranks a body hit; a word-start
//     (prefix) hit outranks a mid-word hit. No typo tolerance (no
//     Levenshtein): with medical vocabulary, near-miss guesses are more
//     confusing than an honest empty state.
// =====================================================================
import { toPlainText } from './rich-text.js';

// Fixed group identity + display order for the results screen.
export const SEARCH_GROUPS = [
  { type: 'question',  label: 'Practice questions' },
  { type: 'concept',   label: 'Concept cards' },
  { type: 'reference', label: 'Quick reference' },
  { type: 'dosage',    label: 'Dosage practice' },
  { type: 'faq',       label: 'FAQ' },
];

export const MIN_QUERY_LEN = 2;      // below this the screen shows the idle state
export const PRACTICE_CAP = 20;      // max matched questions handed to startQuiz

// Lowercase + strip punctuation to the same alphabet normalizeStem (utils.js)
// uses, then split/dedupe. Kept local so this module stays import-light.
export function tokenize(q) {
  const clean = String(q || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  return [...new Set(clean.split(' ').filter(Boolean))];
}

const clip = (s, n = 120) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
};

// ---------------------------------------------------------------------
// buildEntries — flatten every source into one searchable list.
// All sources are optional; missing/odd shapes contribute nothing rather
// than throwing (content loads async and FAQ may be offline).
// Entry: { type, title, snippet, tHay, bHay, payload }
//   tHay / bHay — precomputed lowercase haystacks (title vs body fields).
// ---------------------------------------------------------------------
export function buildEntries({ questions, reference, dosage, conceptCards, faqs } = {}) {
  const entries = [];
  const push = (type, title, snippet, bodyParts, payload) => {
    const t = String(title || '').trim();
    if (!t) return;
    entries.push({
      type,
      title: t,
      snippet: snippet || '',
      tHay: t.toLowerCase(),
      bHay: bodyParts.filter(Boolean).join(' ').toLowerCase(),
      payload,
    });
  };

  if (Array.isArray(questions)) {
    for (const q of questions) {
      if (!q || !q.q) continue;
      const opts = Array.isArray(q.options) ? q.options : [];
      push('question', q.q, clip(opts.join(' · ')),
           [opts.join(' '), q.exp, q.topic, q.sub], q);
    }
  }

  if (Array.isArray(reference)) {
    for (const r of reference) {
      if (!r || !r.label) continue;
      push('reference', r.label,
           clip(`${r.value || ''}${r.note ? ': ' + r.note : ''}`),
           [r.value, r.note, r.section, r.cat], r);
    }
  }

  if (Array.isArray(dosage)) {
    for (const d of dosage) {
      if (!d || !d.q) continue;
      push('dosage', d.q, clip(`Answer: ${d.answer}${d.unit ? ' ' + d.unit : ''}`),
           [Array.isArray(d.steps) ? d.steps.join(' ') : '', d.intuition, d.type], d);
    }
  }

  // concept-cards.json: object keyed by topicId → [{ sub, cards:[…] }];
  // card.body is a string OR string[] (keypoints).
  if (conceptCards && typeof conceptCards === 'object' && !Array.isArray(conceptCards)) {
    for (const topicId of Object.keys(conceptCards)) {
      const groups = conceptCards[topicId];
      if (!Array.isArray(groups)) continue;
      for (const g of groups) {
        if (!g || !Array.isArray(g.cards)) continue;
        for (const c of g.cards) {
          if (!c || !c.title) continue;
          const body = Array.isArray(c.body) ? c.body.join(' ') : (c.body || '');
          push('concept', c.title, clip(body),
               [body, c.clinicalNote, g.sub],
               { topicId, sub: g.sub, title: c.title });
        }
      }
    }
  }

  if (Array.isArray(faqs)) {
    for (const f of faqs) {
      if (!f || !f.question) continue;
      // FAQ answers may carry the rich-text markdown subset — strip to plain
      // text so haystack + snippet never surface literal ** markers.
      const plain = toPlainText(f.answer || '');
      push('faq', f.question, clip(plain), [plain, f.category], f);
    }
  }

  return entries;
}

// ---------------------------------------------------------------------
// Scoring. A token "word-starts" when it begins the haystack or follows a
// non-alphanumeric character — cheap prefix detection without regex-per-token.
// ---------------------------------------------------------------------
const wordStarts = (hay, tok) => {
  let i = hay.indexOf(tok);
  while (i !== -1) {
    if (i === 0 || !/[a-z0-9]/.test(hay[i - 1])) return true;
    i = hay.indexOf(tok, i + 1);
  }
  return false;
};

function scoreEntry(entry, tokens) {
  let score = 0;
  for (const tok of tokens) {
    const inTitle = entry.tHay.includes(tok);
    const inBody = entry.bHay.includes(tok);
    if (!inTitle && !inBody) return 0;          // AND semantics — hard miss
    if (inTitle) score += wordStarts(entry.tHay, tok) ? 4 : 3;
    else score += wordStarts(entry.bHay, tok) ? 1.5 : 1;
  }
  return score;
}

// ---------------------------------------------------------------------
// searchEntries — the main call. Returns:
//   { groups: [{ type, label, total, items }], total, questionIds }
// `items` are the top `perGroup` per type (score desc, stable); `total`
// per group is the FULL match count (for "+N more" copy); `questionIds`
// is every matching question id in score order (screen caps for quiz).
// ---------------------------------------------------------------------
export function searchEntries(entries, query, { perGroup = 8 } = {}) {
  const tokens = tokenize(query);
  const empty = { groups: [], total: 0, questionIds: [] };
  if (tokens.length === 0 || String(query || '').trim().length < MIN_QUERY_LEN) return empty;
  if (!Array.isArray(entries) || entries.length === 0) return empty;

  const byType = new Map();
  for (const e of entries) {
    const s = scoreEntry(e, tokens);
    if (s <= 0) continue;
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type).push({ ...e, score: s });
  }

  const groups = [];
  let total = 0;
  let questionIds = [];
  for (const g of SEARCH_GROUPS) {
    const hits = byType.get(g.type);
    if (!hits || hits.length === 0) continue;
    // Stable sort: score desc, original order breaks ties (source order is
    // already curated — seed → banks, category order in the JSONs).
    hits.sort((a, b) => b.score - a.score);
    total += hits.length;
    if (g.type === 'question') {
      questionIds = hits.map(h => h.payload && h.payload.id).filter(Boolean);
    }
    groups.push({ type: g.type, label: g.label, total: hits.length, items: hits.slice(0, perGroup) });
  }
  return { groups, total, questionIds };
}

// ---------------------------------------------------------------------
// highlightSegments — split `text` into [{ text, hit }] segments so the UI
// can emphasise every token occurrence. Overlapping token ranges merge.
// ---------------------------------------------------------------------
export function highlightSegments(text, tokens) {
  const t = String(text || '');
  if (!t) return [];
  const toks = (tokens || []).filter(Boolean);
  if (toks.length === 0) return [{ text: t, hit: false }];
  const lower = t.toLowerCase();
  const ranges = [];
  for (const tok of toks) {
    let i = lower.indexOf(tok);
    while (i !== -1) {
      ranges.push([i, i + tok.length]);
      i = lower.indexOf(tok, i + tok.length);
    }
  }
  if (ranges.length === 0) return [{ text: t, hit: false }];
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [ranges[0].slice()];
  for (let k = 1; k < ranges.length; k++) {
    const last = merged[merged.length - 1];
    if (ranges[k][0] <= last[1]) last[1] = Math.max(last[1], ranges[k][1]);
    else merged.push(ranges[k].slice());
  }
  const out = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: t.slice(pos, s), hit: false });
    out.push({ text: t.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < t.length) out.push({ text: t.slice(pos), hit: false });
  return out;
}
