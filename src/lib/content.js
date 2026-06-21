// =====================================================================
// CONTENT LOADING LAYER  (Pipeline step 38 / A1 session 4 — batch 1b
// slice 5 — extracted from App.jsx)
// Lazy loader + React hook for the external JSON content blobs
// (reference / dosage / help / concept-cards): memory -> IndexedDB ->
// network, with a version-busted cache. Theme-free data layer.
// =====================================================================
import { useState, useCallback, useEffect } from 'react';
import { safeStorage } from './safe-storage.js';

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
const CONTENT_VERSION = 10;
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

// React hook for external content. Returns { data, loading, error, reload };
// `data` is null until the blob resolves. Safe to call unconditionally.
function useContent(name) {
  const [state, setState] = useState(() =>
    _contentMem[name]
      ? { data: _contentMem[name], loading: false, error: false }
      : { data: null, loading: true, error: false });
  const load = useCallback(() => {
    let alive = true;
    setState(s => ({ data: s.data, loading: true, error: false }));
    ensureContent(name)
      .then(d => { if (alive) setState({ data: d, loading: false, error: false }); })
      .catch(() => { if (alive) setState(s => ({ data: s.data, loading: false, error: true })); });
    return () => { alive = false; };
  }, [name]);
  useEffect(() => {
    if (_contentMem[name]) { setState({ data: _contentMem[name], loading: false, error: false }); return; }
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
