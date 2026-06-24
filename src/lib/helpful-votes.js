import { safeStorage } from './safe-storage.js';
import { GUEST_ID } from './profiles.js';

// =====================================================================
// "WAS THIS HELPFUL?" FEEDBACK (Pipeline step 18 / P8)  [shared keys only]
// ---------------------------------------------------------------------
// Two SHARED keys per question track three states. "silent" (in neither
// list) is deliberately NOT the same as "notHelpful" (explicitly toggled
// off): silence is most users even when an explanation helped, while an
// explicit "no" is a strong rewrite signal — keep them separate so the
// admin report stays honest.
//     helpful:{qId}     -> JSON array of profile ids who find it helpful
//     notHelpful:{qId}  -> JSON array of profile ids who explicitly toggled off
// These are NEW shared kv keys; the local `data` blob and schema (v9) are
// untouched, and the storage.js API / safeStorage shim are used as-is.
// =====================================================================
const HELPFUL_PREFIX = 'helpful:';
const NOT_HELPFUL_PREFIX = 'notHelpful:';
const helpfulKey = (qId) => HELPFUL_PREFIX + qId;
const notHelpfulKey = (qId) => NOT_HELPFUL_PREFIX + qId;

// Read a shared JSON-array key, tolerating "never written" and parse errors.
async function readIdList(key) {
  try {
    const r = await safeStorage.get(key, true);
    if (r && r.value) { const a = JSON.parse(r.value); if (Array.isArray(a)) return a; }
  } catch (e) { /* none yet */ }
  return [];
}

// Current user's state for one question: 'silent' | 'helpful' | 'notHelpful'.
async function loadHelpfulState(qId, profileId) {
  if (!qId || !profileId) return 'silent';
  const [help, no] = await Promise.all([readIdList(helpfulKey(qId)), readIdList(notHelpfulKey(qId))]);
  if (help.indexOf(profileId) !== -1) return 'helpful';
  if (no.indexOf(profileId) !== -1) return 'notHelpful';
  return 'silent';
}

// Apply one tap. Read both lists, remove the user from both, add to the
// target (silent->helpful, helpful->notHelpful, notHelpful->helpful), and
// write both back. Returns the new state. THROWS on write failure so the
// caller can revert the optimistic UI quietly (offline edge case).
async function toggleHelpful(qId, profileId, current) {
  const next = current === 'helpful' ? 'notHelpful' : 'helpful';
  // GUEST MODE (Phase A): guests never write the shared helpful tallies. The
  // toggle UI is hidden for guests; this is a defensive backstop. Return the
  // toggled state so any optimistic UI stays consistent without a cloud write.
  if (profileId === GUEST_ID || profileId === '__guest__' || !profileId) return next;
  let help = await readIdList(helpfulKey(qId));
  let no   = await readIdList(notHelpfulKey(qId));
  help = help.filter(id => id !== profileId);
  no   = no.filter(id => id !== profileId);
  if (next === 'helpful') help.push(profileId); else no.push(profileId);
  await safeStorage.set(helpfulKey(qId), JSON.stringify(help), true);
  await safeStorage.set(notHelpfulKey(qId), JSON.stringify(no), true);
  return next;
}

// Admin: aggregate the helpfulness signal across the pool. Returns one row
// per question that has >=1 response (silent questions are excluded — they
// aren't actionable). Joins to the live pool for stem + explanation text.
async function loadHelpfulnessReport(allQuestions) {
  let helpKeys = [], noKeys = [];
  try { const r = await safeStorage.list(HELPFUL_PREFIX, true); helpKeys = (r && r.keys) ? r.keys : []; } catch (e) {}
  try { const r = await safeStorage.list(NOT_HELPFUL_PREFIX, true); noKeys = (r && r.keys) ? r.keys : []; } catch (e) {}
  const counts = {};
  await Promise.all(helpKeys.map(async k => {
    const qId = k.slice(HELPFUL_PREFIX.length);
    const a = await readIdList(k);
    if (!counts[qId]) counts[qId] = { helpful: 0, notHelpful: 0 };
    counts[qId].helpful = a.length;
  }));
  await Promise.all(noKeys.map(async k => {
    const qId = k.slice(NOT_HELPFUL_PREFIX.length);
    const a = await readIdList(k);
    if (!counts[qId]) counts[qId] = { helpful: 0, notHelpful: 0 };
    counts[qId].notHelpful = a.length;
  }));
  const byId = {};
  (allQuestions || []).forEach(q => { byId[q.id] = q; });
  return Object.entries(counts).map(([qId, c]) => {
    const total = c.helpful + c.notHelpful;
    const q = byId[qId];
    return {
      id: qId, found: !!q,
      stem: q ? q.q : '(not in the current question pool)',
      exp: q ? q.exp : '', topic: q ? q.topic : null,
      helpful: c.helpful, notHelpful: c.notHelpful, total,
      ratio: total > 0 ? c.helpful / total : 0
    };
  }).filter(r => r.total > 0);
}

// BUG-05 — Admin: "clear" the helpfulness votes for one or more questions.
// The kv-write broker FORBIDS DELETE on helpful:/notHelpful: counters ("not
// deletable"), but ALLOWS SET — so we reset both tallies to an empty array.
// loadHelpfulnessReport filters rows with total === 0, so a cleared question
// drops out of the report. Votes aren't gone forever — a user can vote again
// later; this is a "mark handled / reset the signal" action, not destruction.
// Uses the strict broker path so a rejection surfaces to the admin UI.
async function clearHelpfulnessMany(qIds) {
  const ids = Array.isArray(qIds) ? qIds.filter(Boolean) : [];
  if (ids.length === 0) return { cleared: 0, failed: 0 };
  const results = await Promise.allSettled(
    ids.flatMap(qId => [
      safeStorage.setSharedStrict(helpfulKey(qId), '[]'),
      safeStorage.setSharedStrict(notHelpfulKey(qId), '[]'),
    ])
  );
  const failed = results.filter(r => r.status === 'rejected').length;
  return { cleared: ids.length, failed };
}

// BUG-05 — Admin: clear ALL helpfulness history (every tracked question).
// Best-effort SET-empty across every existing helpful:/notHelpful: key.
async function clearAllHelpfulness() {
  let helpKeys = [], noKeys = [];
  try { const r = await safeStorage.list(HELPFUL_PREFIX, true); helpKeys = (r && r.keys) ? r.keys : []; } catch (e) {}
  try { const r = await safeStorage.list(NOT_HELPFUL_PREFIX, true); noKeys = (r && r.keys) ? r.keys : []; } catch (e) {}
  const all = [...new Set([...helpKeys, ...noKeys])];
  const results = await Promise.allSettled(all.map(k => safeStorage.setSharedStrict(k, '[]')));
  const failed = results.filter(r => r.status === 'rejected').length;
  return { total: all.length, failed };
}

export { loadHelpfulState, toggleHelpful, loadHelpfulnessReport, clearHelpfulnessMany, clearAllHelpfulness };
