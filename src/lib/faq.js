// =====================================================================
// src/lib/faq.js  (Feature F-F — FAQ Section)
// FAQ storage on the SAME shared key-value store as feedback/votes — NO new
// Supabase tables. Mirrors lib/feedback.js exactly.
//
//   faq:{id}              -> { id, question, answer, category, order,
//                              createdAt, updatedAt }   (admin-authored)
//   faqq:{faqId}:{qid}    -> { id, faqId, text, authorId, authorName,
//                              createdAt, reply, repliedAt }  (community Q + 1 admin reply)
//
// The "Was this helpful?" bulb reuses lib/helpful-votes.js with scoped ids:
//   answer  -> voteId `faq:{faqId}`        reply -> voteId `faqr:{questionId}`
// (both resolve to the existing helpful:/notHelpful: shared keys.)
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS, KEY_PREFIXES } from './keys.js';

export const newFaqId = () => `faq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const newFaqQId = () => `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Predefined categories the admin picks from (plus a free-text "Other…" in the
// manager). Keeps category labels consistent across FAQs so the user-side
// category chips stay tidy. 'General' is the default.
export const FAQ_CATEGORIES = [
  'General',
  'Account & sign-in',
  'Practice & tests',
  'Mock tests & scoring',
  'Content & banks',
  'Streaks & gamification',
  'Notifications',
  'Technical / bugs',
];

// Vote-id helpers (so the screen and admin counts agree).
export const faqAnswerVoteId = (faqId) => `faq:${faqId}`;
export const faqReplyVoteId = (questionId) => `faqr:${questionId}`;

// ---------- FAQ entries (admin-authored) ----------
// BUG-04 — admin FAQ writes go through the STRICT broker path (throws on
// failure) exactly like the announcement path. The old non-strict set()
// swallowed broker rejections (stale token / rate-limit / offline), so the
// editor closed as if it had saved while nothing reached Supabase. Throwing
// lets admin-faq-manager surface the real reason instead of failing silently.
export async function saveFaq(entry) {
  await safeStorage.setSharedStrict(KEYS.faq(entry.id), JSON.stringify(entry));
}

export async function listFaqs() {
  let keys = [];
  try {
    const r = await safeStorage.list(KEY_PREFIXES.FAQ, true);
    keys = (r && r.keys) ? r.keys : [];
  } catch (e) { return []; }
  const items = await Promise.all(keys.map(async k => {
    try { const r = await safeStorage.get(k, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {}
    return null;
  }));
  // Stack order: newest FAQ first (most visible). An explicit numeric `order`
  // still pins a FAQ above the stack (legacy/optional) — but it's no longer
  // authored in the manager, so normal FAQs fall back to createdAt-desc.
  return items.filter(Boolean).sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : null;
    const bo = typeof b.order === 'number' ? b.order : null;
    if (ao !== null && bo !== null && ao !== bo) return ao - bo;
    if (ao !== null && bo === null) return -1;
    if (ao === null && bo !== null) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0); // newest first
  });
}

export async function createFaq({ question, answer, category, order }) {
  const entry = {
    id: newFaqId(),
    question: (question || '').trim(),
    answer: (answer || '').trim(),
    category: (category || 'General').trim() || 'General',
    // No default order — FAQs stack newest-first (see listFaqs). `order` is only
    // stored when an explicit numeric pin is passed (legacy/optional).
    ...(typeof order === 'number' ? { order } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveFaq(entry);
  return entry;
}

export async function updateFaq(entry, patch) {
  const updated = { ...entry, ...patch, updatedAt: Date.now() };
  await saveFaq(updated);
  return updated;
}

export async function deleteFaq(id) {
  // BUG-04 — strict delete so a failed removal surfaces (was a swallowed catch).
  await safeStorage.delSharedStrict(KEYS.faq(id));
  // Best-effort: remove its community questions too (don't leave orphans).
  try {
    const r = await safeStorage.list(`${KEY_PREFIXES.FAQ_Q}${id}:`, true);
    const keys = (r && r.keys) ? r.keys : [];
    await Promise.all(keys.map(k => safeStorage.delete(k, true).catch(() => {})));
  } catch (e) {}
}

export function faqCategories(faqs) {
  const set = [];
  for (const f of (faqs || [])) { if (f.category && !set.includes(f.category)) set.push(f.category); }
  return set;
}

// ---------- Community Q&A under a FAQ ----------
export async function listCommunityQuestions(faqId) {
  let keys = [];
  try {
    const r = await safeStorage.list(`${KEY_PREFIXES.FAQ_Q}${faqId}:`, true);
    keys = (r && r.keys) ? r.keys : [];
  } catch (e) { return []; }
  const items = await Promise.all(keys.map(async k => {
    try { const r = await safeStorage.get(k, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {}
    return null;
  }));
  // Chat order: oldest first.
  return items.filter(Boolean).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function addCommunityQuestion(faqId, { text, authorId, authorName }) {
  const entry = {
    id: newFaqQId(),
    faqId,
    text: (text || '').trim(),
    authorId: authorId || null,
    authorName: authorName || 'Student',
    createdAt: Date.now(),
    reply: null,
    repliedAt: null,
  };
  await safeStorage.set(KEYS.faqQuestion(faqId, entry.id), JSON.stringify(entry), true);
  return entry;
}

export async function replyToCommunityQuestion(entry, replyText) {
  const updated = { ...entry, reply: (replyText || '').trim(), repliedAt: Date.now() };
  await safeStorage.set(KEYS.faqQuestion(entry.faqId, entry.id), JSON.stringify(updated), true);
  return updated;
}

export async function deleteCommunityQuestion(faqId, qid) {
  try { await safeStorage.delete(KEYS.faqQuestion(faqId, qid), true); } catch (e) {}
}

// ---------- Helpful counts for an arbitrary vote-id (admin view) ----------
// Reads the SAME shared keys helpful-votes.js writes, so counts stay in sync.
export async function loadHelpfulCounts(voteId) {
  const read = async (key) => {
    try { const r = await safeStorage.get(key, true); if (r && r.value) { const a = JSON.parse(r.value); if (Array.isArray(a)) return a.length; } } catch (e) {}
    return 0;
  };
  const [yes, no] = await Promise.all([read(`helpful:${voteId}`), read(`notHelpful:${voteId}`)]);
  return { yes, no };
}
