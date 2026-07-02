// =====================================================================
// src/lib/admin-user-ops.js — pure helpers for the admin "member detail"
// panel (admin app → Users → tap a member).
//
// The admin can already READ another user's profile blob (kv-read GET allows
// admin cross-reads) and WRITE it (kv-write owner-prefix branch allows admin
// moderation). These helpers do the pure read-modify-write math in between:
//
//   summarizeUser(blob)            -> display summary (coins/XP/stats only —
//                                     never answers, history detail, or notes)
//   applyCoinAdjust(blob, amount)  -> new blob with data.economy adjusted
//                                     (economy.js addCoins — floors at 0)
//   applyResetProgress(blob, fresh)-> new blob with data replaced by a fresh
//                                     seed; identity fields untouched
//
// CONCURRENCY NOTE (accepted at this scale, CLAUDE.md LWW): if the student is
// actively using the app, their next save can overwrite an admin write (or
// vice versa). The UI does a fresh read immediately before writing to keep
// the window small, and tells the admin to re-check when in doubt.
// =====================================================================
import { addCoins, normalizeEconomy } from './economy.js';

// Pull a null-safe, display-only summary out of a full profile blob.
export function summarizeUser(blob) {
  const p = blob && typeof blob === 'object' ? blob : {};
  const d = p.data && typeof p.data === 'object' ? p.data : {};
  const stats = d.stats && typeof d.stats === 'object' ? d.stats : {};
  const eco = normalizeEconomy(d.economy);
  const lu = d.levelup && typeof d.levelup === 'object' ? d.levelup : {};
  const attempted = Number.isFinite(stats.totalAttempted) ? stats.totalAttempted : 0;
  const correct = Number.isFinite(stats.totalCorrect) ? stats.totalCorrect : 0;
  return {
    id: p.id || null,
    uid: p.uid || null,
    displayName: p.displayName || p.id || '?',
    referredBy: p.referredBy || null,
    coins: eco.coins,
    hearts: eco.hearts,
    xp: Number.isFinite(lu.xp) ? lu.xp : 0,
    attempted,
    correct,
    accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : null,
    streakCurrent: Number.isFinite(stats.streakCurrent) ? stats.streakCurrent : 0,
    streakBest: Number.isFinite(stats.streakBest) ? stats.streakBest : 0,
    examDate: stats.examDate || null,
    hasData: !!p.data,
  };
}

// Adjust coins by `amount` (positive grant / negative deduction). Returns
// { blob, before, after } — addCoins floors the balance at 0, so a deduction
// can never take a student negative. Everything outside data.economy is
// preserved byte-for-byte (including unknown future keys).
export function applyCoinAdjust(blob, amount) {
  const p = blob && typeof blob === 'object' ? blob : {};
  const d = p.data && typeof p.data === 'object' ? p.data : {};
  const before = normalizeEconomy(d.economy).coins;
  const economy = addCoins(d.economy, amount);
  return {
    blob: { ...p, data: { ...d, economy } },
    before,
    after: economy.coins,
  };
}

// Replace the user's ENTIRE data slice with a fresh seed (caller passes a
// deep clone of DEFAULT_DATA). Identity/account fields (id, uid, displayName,
// referral stamps, createdAt…) live OUTSIDE data and are untouched.
export function applyResetProgress(blob, freshData) {
  const p = blob && typeof blob === 'object' ? blob : {};
  if (!freshData || typeof freshData !== 'object') throw new Error('freshData required');
  return { ...p, data: freshData };
}

// Quick-grant presets shown as chips in the panel.
export const COIN_PRESETS = [500, 1000, 5000, -500];
