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

const slimItem = (it) => ({
  q: {
    id: it.q.id,
    q: String(it.q.q || ''),
    options: (it.q.options || []).map(String),
    correct: Array.isArray(it.q.correct) ? it.q.correct : [],
    exp: it.q.exp ? String(it.q.exp) : '',
    topic: it.q.topic || null,
    sub: it.q.sub || null,
  },
  selected: Array.isArray(it.selected) ? it.selected : [],
  status: it.status === 'correct' || it.status === 'wrong' ? it.status : 'na',
});

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
  const entry = {
    id: `crib-${Date.now()}`,
    sig,
    title: String(title || 'Test review'),
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
