// =====================================================================
// src/lib/economy.js  (Phase 3 foundation A2 — light, NON-MONETARY economy)
// Accuracy Coins + Clinical Hearts, purely for motivation/feedback. NO paywall,
// no payment, no server trigger — monetization (BIZ-02/03) stays deferred. The
// balance lives in the synced profile blob (data.economy) so it carries across
// devices like everything else; all mutation is pure + client-side.
//
//   data.economy = {
//     coins:      integer  — earned by deliberate practice (Why Bonus, etc.)
//     hearts:     0..HEART_MAX — spent on wrong guesses (Code Blue, later)
//     heartsTs:   ms timestamp the regen clock started (0 when full)
//     whyClaimed: [questionId]  — Why-Bonus is once-per-question, ever
//   }
// =====================================================================
export const HEART_MAX = 5;
export const HEART_REGEN_MS = 2 * 60 * 60 * 1000; // 1 heart every 2 hours
export const WHY_BONUS_COINS = 50;                // PHIL-03 reward
export const COIN_GLYPH = '\u{1FA99}';            // 🪙
// Keep the dedup list bounded. This is a HARD ceiling, not a rolling window: see
// claimWhyBonus. Sized well past any realistic question bank so a genuine user
// never reaches it (the blob already stores per-question history at this scale).
const WHY_CLAIMED_CAP = 10000;

export function normalizeEconomy(e) {
  const o = { coins: 0, hearts: HEART_MAX, heartsTs: 0, whyClaimed: [] };
  if (e && typeof e === 'object') {
    if (Number.isFinite(e.coins)) o.coins = Math.max(0, Math.floor(e.coins));
    if (Number.isFinite(e.hearts)) o.hearts = Math.max(0, Math.min(HEART_MAX, Math.floor(e.hearts)));
    if (Number.isFinite(e.heartsTs)) o.heartsTs = e.heartsTs;
    if (Array.isArray(e.whyClaimed)) o.whyClaimed = e.whyClaimed.filter(x => typeof x === 'string');
  }
  return o;
}

// Lazily top up hearts based on elapsed time (used once Code Blue can spend
// them; harmless no-op while hearts stay at max). Pure — returns a fresh econ.
export function withRegenHearts(e, now = Date.now()) {
  const o = normalizeEconomy(e);
  if (o.hearts >= HEART_MAX) { o.heartsTs = 0; return o; }
  if (!o.heartsTs) { o.heartsTs = now; return o; }
  const gained = Math.floor((now - o.heartsTs) / HEART_REGEN_MS);
  if (gained > 0) {
    o.hearts = Math.min(HEART_MAX, o.hearts + gained);
    o.heartsTs = o.hearts >= HEART_MAX ? 0 : o.heartsTs + gained * HEART_REGEN_MS;
  }
  return o;
}

// PHIL-03 — claim the Why Bonus for a question. Returns { economy, awarded }.
// Once-per-question forever (dedup on whyClaimed). Never awarded twice.
//
// ⚠ COIN-MINTING BUG, fixed: the list used to be trimmed with `.slice(-CAP)`.
// A bounded, EVICTING list cannot be a "once ever" ledger. Past the cap the
// oldest id was dropped and became claimable AGAIN, so a user with a bank
// bigger than the cap could cycle the oldest questions forever and mint
// unlimited coins at 50 a pop (and coins now buy cosmetic frames). The bank is
// admin-generated and growing, so this was reachable, not theoretical.
//
// The list stays bounded, but at the ceiling we simply STOP AWARDING instead of
// evicting. Memory stays capped and no coin can ever be minted twice. The cap is
// far above any realistic bank, so a genuine user never reaches it.
export function claimWhyBonus(e, questionId) {
  const o = normalizeEconomy(e);
  if (!questionId || o.whyClaimed.includes(questionId)) return { economy: o, awarded: false };
  if (o.whyClaimed.length >= WHY_CLAIMED_CAP) return { economy: o, awarded: false };
  return {
    economy: { ...o, coins: o.coins + WHY_BONUS_COINS, whyClaimed: [...o.whyClaimed, questionId] },
    awarded: true,
  };
}

export function addCoins(e, n) {
  const o = normalizeEconomy(e);
  return { ...o, coins: Math.max(0, o.coins + (Number.isFinite(n) ? Math.floor(n) : 0)) };
}

// PHIL-02 — restore Hearts after a resolved Code Blue. Capped at HEART_MAX;
// resets the regen clock when full. Future-safe: harmless while Hearts stay at
// max (no depletion mechanic yet), correct once the Accuracy Wallet drains them.
export function restoreHearts(e, n = 1) {
  const o = normalizeEconomy(e);
  // Guard the amount. A non-finite `n` made `hearts` NaN, and normalizeEconomy's
  // fallback for a non-finite hearts value is HEART_MAX, so a garbage restore
  // silently handed back a FULL bar. Harmless while hearts are never spent, a
  // free-lives exploit the day they are. Number() first, so a numeric string
  // ('2') still coerces cleanly the way it always did.
  const nNum = Number(n);
  const add = Number.isFinite(nNum) ? Math.max(0, Math.floor(nNum)) : 0;
  const hearts = Math.min(HEART_MAX, o.hearts + add);
  return { ...o, hearts, heartsTs: hearts >= HEART_MAX ? 0 : o.heartsTs };
}
