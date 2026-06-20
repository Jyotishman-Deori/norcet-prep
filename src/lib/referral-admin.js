// =====================================================================
// src/lib/referral-admin.js — referral graph + rollups for the admin
// "Growth & Referrals" section (Phase 2).
//
// Reads every user's full profile blob via the EXISTING admin-scoped path in
// the kv-read broker (an admin's session token bypasses the owner check on a
// `profile:<id>` GET). The user ids come from the public profilemeta list the
// admin already loads, so this needs NO new Edge Function and NO schema change.
// Aggregation is done client-side: who-referred-whom, top referrers, channel
// breakdown, and an overview summary. Loaded on demand (not live-polled).
//
// Activation note: the spec's full tiered "confirmed" rule (≥3 opens / ≥5 min
// in app / profile complete / ≥1 attempt, within 7 days) needs activity
// instrumentation that isn't recorded yet. Here "confirmed" is approximated
// from what the blob already carries — the referee attempted ≥1 question, or
// returned to the app after signup. Coarser but honest; tighten when an
// activation tracker lands (that part will need a small backend addition).
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEYS } from './keys.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const ACTIVE_GAP_MS = 60 * 1000; // "came back" = active >1 min after signup

export const CHANNEL_LABEL = {
  share:     'Share message',
  link:      'Copied link',
  whatsapp:  'WhatsApp',
  qr:        'QR code',
  score:     'Score card',
  milestone: 'Milestone card',
  poster:    'Poster',
  batch:     'Batch invite',
  direct:    'Direct (no link)',
};

function isConfirmed(blob, metaLastActive) {
  const stats = (blob && blob.data && blob.data.stats) || {};
  if ((stats.totalAttempted || 0) >= 1) return true;
  const created = blob && blob.createdAt;
  const last = metaLastActive || (blob && blob.lastActive);
  if (created && last && (last - created) > ACTIVE_GAP_MS) return true;
  return false;
}

// users = profile metas [{ id, displayName, createdAt, lastActive }].
// Returns a structured rollup, or null inputs handled gracefully.
export async function loadReferralGraph(users) {
  const metas = Array.isArray(users) ? users.filter(u => u && u.id) : [];
  const metaById = new Map(metas.map(u => [u.id, u]));

  // Fetch each blob (admin-scoped). Parallel is fine at this scale.
  const entries = await Promise.all(metas.map(async (u) => {
    try {
      const r = await safeStorage.get(KEYS.profile(u.id), true);
      return [u.id, (r && r.value) ? JSON.parse(r.value) : null];
    } catch (e) { return [u.id, null]; }
  }));
  const blobById = new Map(entries);

  const now = Date.now();
  const totalUsers = metas.length;

  // One record per user; referrerId null = arrived directly.
  const referees = metas.map((u) => {
    const blob = blobById.get(u.id);
    const referrerId = (blob && blob.referredBy) ? String(blob.referredBy) : null;
    const channel = (blob && blob.referralChannel) ? String(blob.referralChannel) : (referrerId ? 'link' : 'direct');
    const referredAt = (blob && blob.referredAt) || u.createdAt || null;
    return {
      id: u.id,
      displayName: u.displayName || u.id,
      referrerId,
      channel,
      referredAt,
      confirmed: referrerId ? isConfirmed(blob, u.lastActive) : false,
      lastActive: u.lastActive || (blob && blob.lastActive) || null,
    };
  });

  const referred = referees.filter(r => r.referrerId);

  // ---- top referrers ----
  const byReferrer = new Map();
  for (const r of referred) {
    if (!byReferrer.has(r.referrerId)) {
      const meta = metaById.get(r.referrerId);
      byReferrer.set(r.referrerId, {
        id: r.referrerId,
        displayName: (meta && meta.displayName) || r.referrerId,
        exists: !!meta,
        referees: [],
        confirmed: 0,
        pending: 0,
        lastActive: (meta && meta.lastActive) || null,
      });
    }
    const row = byReferrer.get(r.referrerId);
    row.referees.push(r);
    if (r.confirmed) row.confirmed++; else row.pending++;
  }
  const topReferrers = Array.from(byReferrer.values()).map(row => ({
    ...row,
    total: row.referees.length,
    retention: row.referees.length ? Math.round((100 * row.confirmed) / row.referees.length) : 0,
  })).sort((a, b) => (b.total - a.total) || (b.retention - a.retention) || (b.confirmed - a.confirmed));

  // ---- by channel (includes a 'direct' bucket) ----
  const channelMap = new Map();
  for (const r of referees) {
    const key = r.referrerId ? r.channel : 'direct';
    if (!channelMap.has(key)) channelMap.set(key, { channel: key, total: 0, confirmed: 0 });
    const c = channelMap.get(key);
    c.total++;
    if (r.confirmed) c.confirmed++;
  }
  const channels = Array.from(channelMap.values()).map(c => ({
    ...c,
    label: CHANNEL_LABEL[c.channel] || c.channel,
    retention: c.total ? Math.round((100 * c.confirmed) / c.total) : 0,
  })).sort((a, b) => b.total - a.total);

  // ---- overview ----
  const viaReferral = referred.length;
  const pct = totalUsers ? Math.round((100 * viaReferral) / totalUsers) : 0;
  const inWindow = (r, loMs, hiMs) => r.referredAt && (now - r.referredAt) > loMs && (now - r.referredAt) <= hiMs;
  const thisWeek = referred.filter(r => r.referredAt && (now - r.referredAt) <= WEEK_MS).length;
  const lastWeek = referred.filter(r => inWindow(r, WEEK_MS, 2 * WEEK_MS)).length;
  const thisMonth = referred.filter(r => r.referredAt && (now - r.referredAt) <= MONTH_MS).length;
  const topChannel = channels.find(c => c.channel !== 'direct') || null;

  return {
    totalUsers,
    viaReferral,
    pct,
    thisWeek,
    lastWeek,
    thisMonth,
    trend: thisWeek - lastWeek,
    confirmedTotal: referred.filter(r => r.confirmed).length,
    pendingTotal: referred.filter(r => !r.confirmed).length,
    topChannel,
    channels,
    topReferrers,
    generatedAt: now,
  };
}
