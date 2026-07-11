// =====================================================================
// src/lib/cribs.js  (#5 — Crib Sheets saved into Revision)
// After any test, the Crib Sheet can be SAVED — it then lives inside the
// Revision section as a dated, printable record of that attempt. Per
// profile, local. Question snapshots are slimmed (stem/options/correct/
// exp/topic/sub only) and the shelf is capped at the 12 most recent so
// the KV blob stays sane even with 200-question papers.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEY_PREFIXES } from './keys.js';
import { markDeleted, liveItems, deletedItems, restoreIn, dropExpired, dropItem } from './trash.js';

const CAP = 12;

const slimItem = (it) => {
  const sq = (it && it.q) || {};
  const q = {
    id: sq.id,
    q: String(sq.q || ''),
    options: (sq.options || []).map(String),
    correct: Array.isArray(sq.correct) ? sq.correct : [],
    exp: sq.exp ? String(sq.exp) : '',
    topic: sq.topic || null,
    sub: sq.sub || null,
  };
  // #25 — preserve PYQ provenance so a saved Crib Sheet can tag PYQs too.
  if (sq.isPYQ) q.isPYQ = true;
  if (typeof sq.source === 'string' && sq.source) q.source = sq.source;
  if (typeof sq.pyqYear === 'number' && sq.pyqYear > 0) q.pyqYear = sq.pyqYear;
  if (typeof sq.pyqExam === 'string' && sq.pyqExam.trim()) q.pyqExam = sq.pyqExam;
  // NUMERIC (Nursing Calc) questions: no options/correct, the answer lives in
  // `answer` + `unit`, and the user's answer is a SCALAR they typed, not an
  // index array. Both used to be discarded here, so a saved Nursing Calc sheet
  // re-opened as "Correct: undefined" with the user's answer gone. Keep them.
  const numeric = !Array.isArray(sq.options) || sq.options.length === 0;
  if (numeric && sq.answer != null) {
    q.answer = sq.answer;
    if (sq.unit) q.unit = String(sq.unit);
  }
  return {
    q,
    selected: Array.isArray(it.selected)
      ? it.selected
      : (numeric && it.selected != null ? it.selected : []),
    status: it.status === 'correct' || it.status === 'wrong' ? it.status : 'na',
  };
};

// The raw shelf: live cribs AND soft-deleted ones still inside their undo
// window (trash.js). Expired deletions are hard-dropped (and persisted) here,
// so "gone for real" happens lazily on the next load.
async function loadAllCribs(profileId) {
  try {
    const r = await safeStorage.get(`${KEY_PREFIXES.CRIBS}${profileId || 'guest'}`, false);
    const v = r && r.value ? JSON.parse(r.value) : [];
    const all = Array.isArray(v) ? v.filter(c => c && c.id && Array.isArray(c.items)) : [];
    const kept = dropExpired(all);
    if (kept.length !== all.length) await persist(profileId, kept);
    return kept;
  } catch (e) { return []; }
}

// The visible shelf (what Revision renders): live cribs only.
export async function loadCribs(profileId) {
  return liveItems(await loadAllCribs(profileId));
}

// The undo shelf (Recently deleted screen): soft-deleted, window still open.
export async function loadDeletedCribs(profileId) {
  return deletedItems(await loadAllCribs(profileId));
}

async function persist(profileId, cribs) {
  try { await safeStorage.set(`${KEY_PREFIXES.CRIBS}${profileId || 'guest'}`, JSON.stringify(cribs), false); } catch (e) {}
}

// Stable content signature for one test session: title + every question's
// id/outcome/selection. Two saves of the SAME session produce the same sig,
// so addCrib can refuse duplicates and the Crib Sheet screen can show
// "Added ✓" when the user returns to an already-saved sheet.
export const cribSignature = (title, items) => {
  const parts = (items || []).map(it =>
    `${(it.q && it.q.id) || '?'}:${it.status || 'na'}:${(Array.isArray(it.selected) ? it.selected : []).join('.')}`
  );
  return `${String(title || '')}|${parts.join('|')}`;
};

export async function findCribBySig(profileId, sig) {
  if (!sig) return null;
  const cribs = await loadCribs(profileId);
  return cribs.find(c => c.sig === sig) || null;
}

// Returns the fresh list; newest first; capped. DEDUPED: if a crib with the
// same content signature already exists, it is returned as-is (duplicate:
// true) and nothing new is written — the same test session is never
// persisted twice no matter how the user navigates back and forth.
export async function addCrib(profileId, { title, subtitle, items }) {
  const all = await loadAllCribs(profileId);
  const cribs = liveItems(all);
  const sig = cribSignature(title, items);
  const existing = cribs.find(c => c.sig === sig);
  if (existing) return { entry: existing, cribs, duplicate: true };
  // #4 — smart de-duplicated display name. Two different sessions from the same
  // source (e.g. two Quick Tests) have different content signatures, so both
  // are kept — but they'd otherwise share an identical title. Append an
  // incrementing "#N" (delete-safe: always max-existing + 1) so the list never
  // shows two identically-named sheets.
  const baseTitle = (String(title || 'Test review').trim()) || 'Test review';
  const prefix = baseTitle + ' #';
  let maxN = 1, baseSeen = false;
  for (const c of cribs) {
    const t = String(c.title || '');
    if (t === baseTitle) baseSeen = true;
    else if (t.startsWith(prefix)) {
      const n = parseInt(t.slice(prefix.length), 10);
      if (!isNaN(n)) { maxN = Math.max(maxN, n); baseSeen = true; }
    }
  }
  const displayTitle = baseSeen ? `${baseTitle} #${maxN + 1}` : baseTitle;
  const entry = {
    id: `crib-${Date.now()}`,
    sig,
    title: displayTitle,
    subtitle: String(subtitle || ''),
    createdAt: Date.now(),
    items: (items || []).map(slimItem),
  };
  // The CAP applies to LIVE cribs; overflow beyond it is SOFT-deleted (an
  // undo window instead of the old silent drop). Soft-deleted cribs ride
  // along in the store until their window closes (purged on load).
  const liveNext = [entry, ...cribs];
  let next = [entry, ...all];
  const nowTs = Date.now();
  for (const c of liveNext.slice(CAP)) next = markDeleted(next, c.id, nowTs);
  await persist(profileId, next);
  return { entry, cribs: liveItems(next), duplicate: false };
}

// Soft delete: the crib disappears from Revision but stays restorable from
// the Recently deleted screen for the trash.js retention window.
export async function removeCrib(profileId, id) {
  const next = markDeleted(await loadAllCribs(profileId), id);
  await persist(profileId, next);
  return liveItems(next);
}

// Undo a deletion (no-op for unknown ids). Returns both shelves.
export async function restoreCrib(profileId, id) {
  const next = restoreIn(await loadAllCribs(profileId), id);
  await persist(profileId, next);
  return { live: liveItems(next), deleted: deletedItems(next) };
}

// "Delete forever" from the Recently deleted screen.
export async function purgeCrib(profileId, id) {
  const next = dropItem(await loadAllCribs(profileId), id);
  await persist(profileId, next);
  return deletedItems(next);
}

export const daysAgo = (ts) => {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};
