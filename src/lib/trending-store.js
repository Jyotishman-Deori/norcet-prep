// =====================================================================
// src/lib/trending-store.js — shared interaction counters for the free-tier
// "trending" engine (no Redis, no extra cron). ONE rolling blob per item keeps
// every read/write to a single key (no list scans, bounded size):
//
//   trend:<kind>:<id>  ->  { d: { 'YYYY-MM-DD': { o: [uid…], c: [uid…] } } }
//
//   <kind> ∈ 'game' | 'faq'. Per day we keep TWO unique-uid sets:
//     o = OPENS      (someone launched / expanded the item)
//     c = COMPLETES  (someone finished it — a real engagement signal)
//   Unique uids per bucket => a user can add at most +1 per item/day to each
//   (the spec's "unique-user filtering", enforced by the data shape). The
//   open-vs-complete gap is the bounce / completion-depth signal that the
//   scoring layer (lib/trending.js) uses as a quality guardrail.
//
//   Days outside the retention window are pruned on write. Writes are
//   FIRE-AND-FORGET: never block the UI, never throw (last-write-wins).
//
// Day strings are UTC YYYY-MM-DD, matching utils.todayStr().
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';

const RETAIN_DAYS = 8;         // today + 7 trailing days
const MAX_UIDS_PER_DAY = 400;  // bound blob size (broker also caps the payload)

const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);

// [today, yesterday, … ] as UTC YYYY-MM-DD strings.
function windowDays(days) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) out.push(dayStr(now - i * 86400000));
  return out;
}

// Normalize one day's entry into { o:[], c:[] }. Tolerates the v1 shape where a
// day was a bare array of open-uids (legacy → opens, no completes).
function dayBuckets(entry) {
  if (Array.isArray(entry)) return { o: entry.slice(), c: [] };
  if (entry && typeof entry === 'object') {
    return { o: Array.isArray(entry.o) ? entry.o : [], c: Array.isArray(entry.c) ? entry.c : [] };
  }
  return { o: [], c: [] };
}

function parseBlob(value) {
  try {
    const b = JSON.parse(value);
    if (b && typeof b === 'object' && b.d && typeof b.d === 'object') return b;
  } catch (_) { /* fall through */ }
  return { d: {} };
}

// Record that `uid` interacted with item (kind,id) today. `event` is 'open'
// (default) or 'complete'. Resolves true on success, false on any failure —
// never throws (safe to call un-awaited).
export async function recordInteraction(kind, id, uid, event = 'open') {
  if (!kind || !id || !uid) return false;
  const bucket = event === 'complete' ? 'c' : 'o';
  const key = KEYS.trend(kind, id);
  try {
    let blob = { d: {} };
    try { const r = await safeStorage.get(key, true); if (r && r.value) blob = parseBlob(r.value); } catch (_) {}
    const d = blob.d || (blob.d = {});
    const today = dayStr(Date.now());
    const day = dayBuckets(d[today]);
    const arr = day[bucket];
    if (!arr.includes(uid)) arr.push(uid);
    if (arr.length > MAX_UIDS_PER_DAY) arr.splice(0, arr.length - MAX_UIDS_PER_DAY);
    d[today] = day;
    // Prune anything outside the retention window so the blob stays small.
    const keep = new Set(windowDays(RETAIN_DAYS));
    for (const k of Object.keys(d)) if (!keep.has(k)) delete d[k];
    await safeStorage.set(key, JSON.stringify(blob), true);
    return true;
  } catch (_) { return false; }
}

// Load per-day UNIQUE open + complete counts for each id:
//   { [id]: { opens: [today, t-1, …], completes: [today, t-1, …] } }
// Missing/unreadable items become all-zero arrays (safe for scoring).
export async function loadTrendStats(kind, ids, days = 7) {
  const win = windowDays(days);
  const out = {};
  await Promise.all((ids || []).map(async (id) => {
    let blob = { d: {} };
    try { const r = await safeStorage.get(KEYS.trend(kind, id), true); if (r && r.value) blob = parseBlob(r.value); } catch (_) {}
    const d = (blob && blob.d) || {};
    out[id] = {
      opens: win.map(day => dayBuckets(d[day]).o.length),
      completes: win.map(day => dayBuckets(d[day]).c.length),
    };
  }));
  return out;
}
