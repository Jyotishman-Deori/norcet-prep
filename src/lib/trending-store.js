// =====================================================================
// src/lib/trending-store.js — shared interaction counters for the free-tier
// "trending" engine (no Redis, no extra cron). ONE rolling blob per item keeps
// every read/write to a single key (no list scans, bounded size):
//
//   trend:<kind>:<id>  ->  { d: { 'YYYY-MM-DD': [uid, ...] } }
//
//   <kind> ∈ 'game' | 'faq'. The per-day arrays hold UNIQUE uids, so a single
//   user can only ever add +1 per item/day (the spec's "unique-user filtering",
//   enforced by the data shape — not a server query). Days outside the retention
//   window are pruned on write. Writes are FIRE-AND-FORGET: they never block the
//   UI and never throw (last-write-wins, consistent with the app's sync model).
//
// Pairs with lib/trending.js (pure scoring). Day strings are UTC YYYY-MM-DD,
// matching utils.todayStr().
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

function parseBlob(value) {
  try {
    const b = JSON.parse(value);
    if (b && typeof b === 'object' && b.d && typeof b.d === 'object') return b;
  } catch (_) { /* fall through */ }
  return { d: {} };
}

// Record that `uid` interacted with item (kind,id) today. Resolves true on
// success, false on any failure — never throws (safe to call un-awaited).
export async function recordInteraction(kind, id, uid) {
  if (!kind || !id || !uid) return false;
  const key = KEYS.trend(kind, id);
  try {
    let blob = { d: {} };
    try { const r = await safeStorage.get(key, true); if (r && r.value) blob = parseBlob(r.value); } catch (_) {}
    const d = blob.d || (blob.d = {});
    const today = dayStr(Date.now());
    const arr = Array.isArray(d[today]) ? d[today] : [];
    if (!arr.includes(uid)) arr.push(uid);
    if (arr.length > MAX_UIDS_PER_DAY) arr.splice(0, arr.length - MAX_UIDS_PER_DAY);
    d[today] = arr;
    // Prune anything outside the retention window so the blob stays small.
    const keep = new Set(windowDays(RETAIN_DAYS));
    for (const k of Object.keys(d)) if (!keep.has(k)) delete d[k];
    await safeStorage.set(key, JSON.stringify(blob), true);
    return true;
  } catch (_) { return false; }
}

// Load per-day UNIQUE interaction counts for each id:
//   { [id]: [countToday, countYesterday, … (length `days`)] }
// Missing/unreadable items become an all-zero array (safe for scoring).
export async function loadDailyCounts(kind, ids, days = 7) {
  const win = windowDays(days);
  const out = {};
  await Promise.all((ids || []).map(async (id) => {
    let blob = { d: {} };
    try { const r = await safeStorage.get(KEYS.trend(kind, id), true); if (r && r.value) blob = parseBlob(r.value); } catch (_) {}
    const d = (blob && blob.d) || {};
    out[id] = win.map(day => (Array.isArray(d[day]) ? d[day].length : 0));
  }));
  return out;
}
