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
  return {
    q,
    selected: Array.isArray(it.selected) ? it.selected : [],
    status: it.status === 'correct' || it.status === 'wrong' ? it.status : 'na',
  };
};

export async function loadCribs(profileId) {
  try {
    const r = await safeStorage.get(`${KEY_PREFIXES.CRIBS}${profileId || 'guest'}`, false);
    const v = r && r.value ? JSON.parse(r.value) : [];
    return Array.isArray(v) ? v.filter(c => c && c.id && Array.isArray(c.items)) : [];
  } catch (e) { return []; }
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
  const cribs = await loadCribs(profileId);
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
  const next = [entry, ...cribs].slice(0, CAP);
  await persist(profileId, next);
  return { entry, cribs: next, duplicate: false };
}

export async function removeCrib(profileId, id) {
  const cribs = await loadCribs(profileId);
  const next = cribs.filter(c => c.id !== id);
  await persist(profileId, next);
  return next;
}

export const daysAgo = (ts) => {
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};
