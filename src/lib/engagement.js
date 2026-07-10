// =====================================================================
// src/lib/engagement.js — pure aggregation for the admin Engagement view.
//
// INPUT: the profile-meta directory the admin app already loads
// ({ id, displayName, createdAt, lastActive } per user — no study data).
// OUTPUT: aggregate numbers only. This module follows the "top-company"
// telemetry split discussed 2026-07-02: the client never reads other users'
// analytics; the admin view draws AGGREGATES from directory data it already
// has. Deliberately does NOT fake cohort retention — a single lastActive
// snapshot can't support it honestly; recency buckets can.
//
// Pure (no React/IO/Date.now — `now` is injected), unit-tested.
// =====================================================================

const DAY = 86400000;

// UTC-Monday week start (same convention as the leaderboard's weekStartStr).
export function weekStartUtc(ts) {
  const d = new Date(ts);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff);
  return monday;
}

export function weekLabel(ts) {
  const d = new Date(ts);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${dd}/${mm}`;
}

// Keep only rows that look like real metas; coerce timestamps to numbers|null.
export function normalizeMetas(raw) {
  const out = [];
  for (const m of Array.isArray(raw) ? raw : []) {
    if (!m || typeof m !== 'object' || !m.id) continue;
    const created = Number(m.createdAt);
    const active = Number(m.lastActive);
    out.push({
      id: String(m.id),
      displayName: String(m.displayName || m.id),
      createdAt: Number.isFinite(created) && created > 0 ? created : null,
      lastActive: Number.isFinite(active) && active > 0 ? active : null,
    });
  }
  return out;
}

export const RECENCY_BUCKETS = [
  { id: 'today',   label: 'Today',      maxDays: 1 },
  { id: 'week',    label: '2–7 days',   maxDays: 7 },
  { id: 'month',   label: '8–30 days',  maxDays: 30 },
  { id: 'dormant', label: '30+ days',   maxDays: Infinity },
  { id: 'never',   label: 'Never seen', maxDays: NaN }, // no lastActive at all
];

// computeEngagement(metas, now, opts?) -> aggregates for the admin view.
// opts.excludeIds: internal (test/staff) account ids left out of every
// aggregate, so the owner's own testing never inflates the numbers.
export function computeEngagement(rawMetas, now, { weeks = 8, dormantDays = 14, dormantMax = 15, excludeIds = [] } = {}) {
  let metas = normalizeMetas(rawMetas);
  if (Array.isArray(excludeIds) && excludeIds.length) {
    const skip = new Set(excludeIds.map(x => String(x).toLowerCase()));
    metas = metas.filter(m => !skip.has(m.id.toLowerCase()));
  }
  const total = metas.length;

  const within = (ts, days) => ts != null && (now - ts) < days * DAY;
  const activeToday = metas.filter(m => within(m.lastActive, 1)).length;
  const active7 = metas.filter(m => within(m.lastActive, 7)).length;
  const active30 = metas.filter(m => within(m.lastActive, 30)).length;
  const newThisWeek = metas.filter(m => within(m.createdAt, 7)).length;
  const stickiness = total > 0 ? Math.round((active7 / total) * 100) : 0;

  // Recency buckets (each user lands in exactly one).
  const recency = { today: 0, week: 0, month: 0, dormant: 0, never: 0 };
  for (const m of metas) {
    if (m.lastActive == null) { recency.never++; continue; }
    const days = (now - m.lastActive) / DAY;
    if (days < 1) recency.today++;
    else if (days < 7) recency.week++;
    else if (days < 30) recency.month++;
    else recency.dormant++;
  }

  // Signups per UTC week, oldest → newest, zero-filled so the chart is stable.
  const thisWeek = weekStartUtc(now);
  const signupsByWeek = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisWeek - i * 7 * DAY;
    signupsByWeek.push({ start, label: weekLabel(start), count: 0 });
  }
  for (const m of metas) {
    if (m.createdAt == null) continue;
    const start = weekStartUtc(m.createdAt);
    const slot = signupsByWeek.find(w => w.start === start);
    if (slot) slot.count++;
  }

  // Dormant list — quiet for `dormantDays`+ (or never seen), most-recently-lost
  // first so the top of the list is the most winnable-back.
  const dormant = metas
    .filter(m => m.lastActive == null || (now - m.lastActive) >= dormantDays * DAY)
    .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))
    .slice(0, dormantMax);

  return { total, activeToday, active7, active30, newThisWeek, stickiness, recency, signupsByWeek, dormant };
}

// Compact "3d ago" / "today" / "never" for list rows.
export function agoLabel(ts, now) {
  if (ts == null) return 'never';
  const days = Math.floor((now - ts) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
