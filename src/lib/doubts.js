// =====================================================================
// src/lib/doubts.js  (Feature F-E — Doubt Flag)
// Point-level "I don't get this" flags on concept-card content.
//
// Stable IDs WITHOUT touching concept-cards.json: an id is derived from
// topic + card title (+ bullet index for key-point bullets). The flagged
// text is SNAPSHOTTED into the record, so the Doubts list still reads
// correctly even if the underlying content later changes. Stored locally per
// profile (no schema migration). Aggregate "most-flagged" analytics (a
// content-quality signal) is intentionally left as a future Supabase add-on.
//
// Record: { id, topic, sub, cardTitle, text, createdAt, resolvedAt|null }
// Store : { [id]: record }
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';

export function pointId(topic, cardTitle, bulletIndex) {
  const base = `${topic}::${cardTitle || ''}`;
  return (bulletIndex == null) ? base : `${base}::b${bulletIndex}`;
}

export async function loadDoubts(profileId) {
  try {
    const r = await safeStorage.get(`${KEYS.DOUBTS}${profileId}`, false);
    const v = r && r.value ? JSON.parse(r.value) : {};
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch (e) { return {}; }
}
export async function saveDoubts(profileId, map) {
  try { await safeStorage.set(`${KEYS.DOUBTS}${profileId}`, JSON.stringify(map || {}), false); } catch (e) {}
}

// Add (if absent) or remove (if present). `record` supplies topic/sub/cardTitle/text.
export function toggleDoubt(map, id, record) {
  const next = { ...(map || {}) };
  if (next[id]) { delete next[id]; }
  else {
    next[id] = {
      id,
      topic: record.topic,
      sub: record.sub || null,
      cardTitle: record.cardTitle || '',
      text: (record.text || '').slice(0, 400),
      createdAt: Date.now(),
      resolvedAt: null,
    };
  }
  return next;
}

export function setResolved(map, id, resolved) {
  if (!map || !map[id]) return map;
  return { ...map, [id]: { ...map[id], resolvedAt: resolved ? Date.now() : null } };
}

export const listDoubts = (map) => Object.values(map || {});
export const unresolved = (map) => listDoubts(map).filter(d => !d.resolvedAt).sort((a, b) => b.createdAt - a.createdAt);
export const resolved = (map) => listDoubts(map).filter(d => d.resolvedAt).sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));

export function groupByTopic(arr) {
  const g = {};
  for (const d of (arr || [])) { (g[d.topic] = g[d.topic] || []).push(d); }
  return g;
}

export const unresolvedCount = (map) => unresolved(map).length;
export function staleUnresolvedCount(map, days = 7) {
  const cutoff = Date.now() - days * 86400000;
  return unresolved(map).filter(d => d.createdAt <= cutoff).length;
}

// Unique flagged CARDS (deduped by topic::cardTitle) — used to surface the
// underlying card once at the top of Quick Revision even if several of its
// bullets are flagged.
export function unresolvedCards(map) {
  const seen = new Set();
  const out = [];
  for (const d of unresolved(map)) {
    const key = `${d.topic}::${d.cardTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

// "3d ago" style relative age.
export function relativeAge(ts) {
  const ms = Date.now() - ts;
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
