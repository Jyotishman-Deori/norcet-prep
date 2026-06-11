// =====================================================================
// src/lib/qdoubts.js  (#18 — Question Solution Flag)
// "I read the explanation and I'm STILL confused" flags on quiz questions.
// Distinct from bookmarks (save-for-later) and concept doubts (revision-note
// points). Stored locally per profile, mirroring lib/doubts.js exactly —
// same KV store, new prefix (KEY_PREFIXES.QDOUBTS).
//
// Record: { id, qSnapshot, topic, sub, createdAt,
//           resolvedAt|null, autoResolved?: bool }
//   id        = question id (one flag max per question)
//   qSnapshot = stem text snapshot (≤300 chars) so the Doubts list still
//               reads if the question later disappears (bank removed etc.)
// Store: { [id]: record }
//
// Resolution is HYBRID: manual ("Resolved" in the Doubts → Questions tab) or
// automatic — when the user later answers the SAME question correctly, the
// flag auto-resolves. (The spec's same-TOPIC auto-resolve was reconciled to
// same-QUESTION: one lucky answer elsewhere in a broad subject should not
// silently clear an explicit "this explanation confused me" flag.)
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEY_PREFIXES } from './keys.js';

export async function loadQDoubts(profileId) {
  try {
    const r = await safeStorage.get(`${KEY_PREFIXES.QDOUBTS}${profileId}`, false);
    const v = r && r.value ? JSON.parse(r.value) : {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const clean = {};
    for (const k in v) { const d = v[k]; if (d && typeof d === 'object' && d.id) clean[k] = d; }
    return clean;
  } catch (e) { return {}; }
}

export async function saveQDoubts(profileId, map) {
  try { await safeStorage.set(`${KEY_PREFIXES.QDOUBTS}${profileId}`, JSON.stringify(map || {}), false); } catch (e) {}
}

// Toggle a flag on/off for question `q` (full question object). Pure.
export function toggleQDoubt(map, q) {
  const next = { ...(map || {}) };
  if (!q || !q.id) return next;
  if (next[q.id]) { delete next[q.id]; }
  else {
    next[q.id] = {
      id: q.id,
      qSnapshot: String(q.q || '').slice(0, 300),
      topic: q.topic || null,
      sub: q.sub || null,
      createdAt: Date.now(),
      resolvedAt: null,
    };
  }
  return next;
}

export function setQResolved(map, id, resolved) {
  if (!map || !map[id]) return map;
  return { ...map, [id]: { ...map[id], resolvedAt: resolved ? Date.now() : null, autoResolved: false } };
}

// Auto-resolve: given the per-question results of a finished session
// ([{ qId, correct }]), resolve any still-open flag whose question was just
// answered CORRECTLY (manual resolution always wins — already-resolved flags
// are untouched; wrong answers never re-flag). Pure; returns
// { map, resolved: [record…] } so the caller can notify.
export function autoResolveQDoubts(map, results) {
  const src = map || {};
  const out = { ...src };
  const justResolved = [];
  for (const r of (results || [])) {
    if (!r || !r.correct) continue;
    const d = out[r.qId];
    if (d && !d.resolvedAt) {
      out[r.qId] = { ...d, resolvedAt: Date.now(), autoResolved: true };
      justResolved.push(out[r.qId]);
    }
  }
  return { map: out, resolved: justResolved };
}

export const listQDoubts = (map) => Object.values(map || {}).filter(d => d && typeof d === 'object');
export const unresolvedQ = (map) => listQDoubts(map).filter(d => !d.resolvedAt).sort((a, b) => b.createdAt - a.createdAt);
export const resolvedQ = (map) => listQDoubts(map).filter(d => d.resolvedAt).sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0));
export const unresolvedQCount = (map) => unresolvedQ(map).length;
