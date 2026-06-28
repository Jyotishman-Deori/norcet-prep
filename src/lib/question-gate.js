// =====================================================================
// src/lib/question-gate.js — CONTENT QUALITY GATE
//   (NURSING_PWA_UPGRADE_STRATEGY · Blueprint UPGRADE 2 · Layer 3)
//
// "When ≥N different users flag the same question, stop serving it until an
//  admin clears it." A wrong answer-key is the single worst trust-killer for a
//  medical exam app, so this is the highest-value pre-launch safety net.
//
// HOW IT FITS THIS CODEBASE (no parallel architecture):
//   • The admin inbox ALREADY aggregates every report (feedback:{id}); each
//     carries `questionId` + `profileId`. So distinct-reporter counts are a
//     pure derivation over data the admin already loads — no new write path on
//     the student side (which the kv-write broker would reject anyway: shared
//     writes are authorized by key ownership, so a student can't bump a global
//     counter — the secure design).
//   • The DECISION (pull / restore) is one admin tap that writes a tiny PUBLIC
//     list of hidden ids to `qgate:hidden`. Every client reads that one small
//     key at boot and filters those ids out of the question universe — exactly
//     the established pattern used for disabled banks and game_config.
//
// LAYERS 1 & 2 (deliberately NOT here): Layer 1 (schema validation) is already
// covered by question-import.js on import; a `reviewed:true` hard gate (Layer 2)
// would hide the entire existing curated bank unless backfilled, so it's left
// as a noted follow-up rather than a breaking change.
// =====================================================================
import { get as kvGet, setSharedStrict } from '../storage.js';
import { KEYS } from './keys.js';

// Distinct reporters before a question is treated as an auto-flag candidate.
export const FLAG_THRESHOLD = 3;

// Module-level hidden set — the single source of truth the filter reads. Kept
// in sync by loadQuestionGate() (boot) and saveHiddenIds() (admin action).
let HIDDEN = new Set();

export function getHiddenIds() { return Array.from(HIDDEN); }
export function isHidden(id) { return HIDDEN.has(id); }

// Drop pulled questions from any pool. Returns the SAME array ref when nothing
// is hidden, so callers' useMemo stays stable in the common case.
export function filterHidden(arr) {
  if (!HIDDEN.size || !Array.isArray(arr)) return arr;
  return arr.filter(q => q && !HIDDEN.has(q.id));
}

function parseIds(value) {
  try {
    const raw = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(raw)) return raw.filter(x => typeof x === 'string');
  } catch (e) { /* fall through */ }
  return [];
}

// Boot read of the public hidden-id list (anon read, tiny, no PII). Never
// throws; if absent/unreachable the set stays empty (app serves everything).
// Returns the id array so the caller can drop it into React state to re-render.
export async function loadQuestionGate() {
  try {
    const r = await kvGet(KEYS.QUESTION_GATE, true);
    if (r && r.value != null) HIDDEN = new Set(parseIds(r.value));
  } catch (e) { /* keep current set */ }
  return getHiddenIds();
}

// Admin-only persist. Requires the kv-write broker to allow `qgate:` (added to
// the admin-only branch alongside announcement:/faq:). THROWS on failure so the
// admin UI can surface a clear "deploy the updated kv-write function" message
// rather than silently no-op.
export async function saveHiddenIds(ids) {
  const clean = Array.from(new Set((ids || []).filter(x => typeof x === 'string')));
  await setSharedStrict(KEYS.QUESTION_GATE, JSON.stringify(clean));
  HIDDEN = new Set(clean);
  return clean;
}

// Pure aggregation over the admin feedback inbox. Counts DISTINCT reporters per
// questionId (by profileId; anonymous reports fall back to their feedback id so
// each still counts once). Returns rows sorted by reporter count, newest-first
// on ties. `samples` carries a few report texts for the admin to read in place.
export function aggregateFlaggedQuestions(feedbackItems, { threshold = FLAG_THRESHOLD } = {}) {
  const map = new Map();
  for (const it of (feedbackItems || [])) {
    const qid = it && it.questionId;
    if (!qid) continue;                       // only question-tagged reports
    let g = map.get(qid);
    if (!g) { g = { questionId: qid, reporters: new Set(), lastTs: 0, samples: [] }; map.set(qid, g); }
    g.reporters.add(it.profileId || `fb:${it.id}`);
    g.lastTs = Math.max(g.lastTs, it.ts || 0);
    if (g.samples.length < 5 && it.report) {
      g.samples.push({ report: it.report, fix: it.fix || null, ts: it.ts || 0, by: it.profileName || null });
    }
  }
  return Array.from(map.values())
    .map(g => ({
      questionId: g.questionId,
      count: g.reporters.size,
      autoFlag: g.reporters.size >= threshold,
      lastTs: g.lastTs,
      samples: g.samples,
    }))
    .sort((a, b) => b.count - a.count || b.lastTs - a.lastTs);
}
