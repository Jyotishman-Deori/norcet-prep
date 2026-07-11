// =====================================================================
// CONTENT LOADING LAYER  (Pipeline step 38 / A1 session 4 — batch 1b
// slice 5 — extracted from App.jsx)
// Lazy loader + React hook for the external JSON content blobs
// (reference / dosage / help / concept-cards): memory -> IndexedDB ->
// network, with a version-busted cache. Theme-free data layer.
// =====================================================================
import { useState, useCallback, useEffect } from 'react';
import { safeStorage } from './safe-storage.js';
import { cpackKey, normalizePack, mergeDosage, mergeReference, mergeConceptCards } from './content-packs.js';

// Bump this whenever any /public/data/*.json content file changes. It is the
// cache-buster for BOTH the IndexedDB cache key (content:NAME:vN) and the
// network ?v=N query — without a bump, returning users keep seeing the old
// cached copy of help/reference/dosage/concept-cards forever.
// v2: upgraded explanations rollout — refreshed help.json (examples + Knowledge
//     Map / Previous Year Papers / Exam weightage) and concept-cards.json.
// v3: added the "Study methods" help section (Feature F-A).
// v4: updated the "Learn — topics" help for Quick Revision (Feature F-D).
// v5: added the "Doubts" help section (Feature F-E).
// v6: added the "FAQ" help section (Feature F-F).
// v12 (FEAT-02): renamed the "Exam date" help section to "Study plan" and
//     expanded it (date + daily goal + the day-by-day plan now live together).
// v13: rebrand — "NORCET Prep" → "NurseHolic" in help.json Share-app copy.
// v14: removed all em dashes from content JSON (reference/dosage/concept-cards/
//      help) — user-facing copy must not read as AI-generated.
const CONTENT_VERSION = 15;
const CONTENT_SOURCES = {
  reference:    'reference.json',
  dosage:       'dosage.json',
  help:         'help.json',
  conceptCards: 'concept-cards.json',
};
const contentCacheKey = (name) => `content:${name}:v${CONTENT_VERSION}`;
// In-memory cache so repeat mounts within a session skip IndexedDB entirely.
const _contentMem = {};

// Resolve a content blob: memory -> local IndexedDB -> network (then cache
// back to IndexedDB). Returns the parsed value or throws on total failure.
async function ensureContent(name) {
  if (_contentMem[name]) return _contentMem[name];
  const file = CONTENT_SOURCES[name];
  if (!file) throw new Error('unknown content: ' + name);
  // 1) local IndexedDB cache (per-device; survives offline)
  try {
    const r = await safeStorage.get(contentCacheKey(name), false);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      _contentMem[name] = parsed;
      return parsed;
    }
  } catch (e) { /* miss / parse error -> fall through to network */ }
  // 2) network. Leading-slash path = /public served at the site root; the
  //    ?v= buster pairs with CONTENT_VERSION so an edit + bump fetches fresh.
  const res = await fetch(`/data/${file}?v=${CONTENT_VERSION}`);
  if (!res || !res.ok) throw new Error('content fetch failed: ' + file + ' ' + (res && res.status));
  const text = await res.text();
  const parsed = JSON.parse(text);
  _contentMem[name] = parsed;
  // 3) write-through to local IndexedDB (best-effort; never blocks the UI)
  try { await safeStorage.set(contentCacheKey(name), text, false); } catch (e) {}
  return parsed;
}

// ---- CONTENT PACKS: admin-authored extra content, merged OVER the base ----
// Each mergeable content name maps to a cpack type + a pure merger. The pack
// lives in kv_shared (public anon read) with a local IndexedDB mirror so it
// survives offline. Content grows without a code deploy; a client that can't
// read the pack (offline, first run) just shows the bundled base.
const PACK_MERGE = {
  dosage:       { type: 'dosage',       merge: mergeDosage },
  reference:    { type: 'reference',    merge: mergeReference },
  conceptCards: { type: 'conceptCards', merge: mergeConceptCards },
};
const _mergedMem = {};                          // name -> merged value (session cache)
const packMirrorKey = (type) => `cpackcache:${type}`;

// Read a pack: shared kv_shared read (fresh when online), falling back to the
// local mirror when offline; refresh the mirror on a successful read.
export async function readPack(type) {
  try {
    const r = await safeStorage.get(cpackKey(type), true);   // shared table
    if (r && r.value) {
      try { await safeStorage.set(packMirrorKey(type), r.value, false); } catch (e) {}
      return normalizePack(JSON.parse(r.value));
    }
  } catch (e) { /* offline / not present -> mirror */ }
  try {
    const m = await safeStorage.get(packMirrorKey(type), false);
    if (m && m.value) return normalizePack(JSON.parse(m.value));
  } catch (e) {}
  return null;
}

// Base content merged with its pack. Base failures still throw (real error);
// pack failures degrade to base only.
async function ensureMergedContent(name) {
  const cfg = PACK_MERGE[name];
  if (!cfg) return ensureContent(name);
  if (_mergedMem[name]) return _mergedMem[name];
  const base = await ensureContent(name);
  let out = base;
  try {
    const pack = await readPack(cfg.type);
    if (pack && Array.isArray(pack.items) && pack.items.length) out = cfg.merge(base, pack.items);
  } catch (e) { /* base only */ }
  _mergedMem[name] = out;
  return out;
}

// React hook for external content. Returns { data, loading, error, reload };
// `data` is null until the blob resolves. Safe to call unconditionally.
// When a content pack exists for `name`, the resolved data is base + pack.
function useContent(name) {
  const has = _mergedMem[name] || (!PACK_MERGE[name] && _contentMem[name]);
  const [state, setState] = useState(() =>
    has
      ? { data: has, loading: false, error: false }
      : { data: null, loading: true, error: false });
  const load = useCallback(() => {
    let alive = true;
    setState(s => ({ data: s.data, loading: true, error: false }));
    ensureMergedContent(name)
      .then(d => { if (alive) setState({ data: d, loading: false, error: false }); })
      .catch(() => { if (alive) setState(s => ({ data: s.data, loading: false, error: true })); });
    return () => { alive = false; };
  }, [name]);
  useEffect(() => {
    const cached = _mergedMem[name] || (!PACK_MERGE[name] && _contentMem[name]);
    if (cached) { setState({ data: cached, loading: false, error: false }); return; }
    return load();
  }, [name, load]);
  return { data: state.data, loading: state.loading, error: state.error, reload: load };
}

// Fire-and-forget warm prefetch of every content file into the local cache.
// Skips files already cached and stays silent on failure (e.g. offline).
function prefetchAllContent() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  Object.keys(CONTENT_SOURCES).forEach(name => {
    if (_contentMem[name]) return;
    ensureContent(name).catch(() => {});
  });
}

export { useContent, prefetchAllContent };
