// =====================================================================
// src/lib/premium.js — pure logic for the Premium (freemium) placeholder.
//
// Owner-approved 2026-07. Payments are NOT wired (no Razorpay, no gating):
// the Premium screen is a PREVIEW. This module only reads the live-tunable
// `premium` block from game-config (see DEFAULTS.premium) and hands the UI a
// normalized, always-safe shape. It NEVER throws on a mangled remote config
// row or a null profile — worst case it returns the hardcoded fallbacks.
//
// The screen (src/screens/premium.jsx) owns all copy/framing (test-phase
// banner, CTA); this module owns the numbers, flags, and normalization.
// =====================================================================
import { getConfig } from './game-config.js';

function isPlainObject(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

// Safe fallbacks used whenever the remote config row mangled the block.
const FALLBACK = {
  enabled: true,
  testPhase: true,
  adSlot: false,
  gates: { cribVault: false },
  plans: [
    { id: 'monthly', label: 'Monthly', priceInr: 149, per: 'month' },
    { id: 'yearly',  label: 'Yearly',  priceInr: 999, per: 'year', save: 'Save 44%' },
  ],
};

// Normalize a single plan to { id, label, priceInr, per, save? } or null if
// it's missing an id/label or has a non-finite price (dropped by the caller).
function normalizePlan(p) {
  if (!isPlainObject(p)) return null;
  const id = p.id;
  const label = p.label;
  const priceInr = p.priceInr;
  if (typeof id !== 'string' || !id) return null;
  if (typeof label !== 'string' || !label) return null;
  if (typeof priceInr !== 'number' || !Number.isFinite(priceInr)) return null;
  const out = { id, label, priceInr, per: typeof p.per === 'string' ? p.per : '' };
  if (typeof p.save === 'string' && p.save) out.save = p.save;
  return out;
}

// getPremiumConfig() → the `premium` block, always an object with enabled,
// testPhase, adSlot, plans. Falls back field-by-field so a partially mangled
// remote block still yields a usable object. Never throws.
export function getPremiumConfig() {
  let block;
  try { block = getConfig().premium; } catch (_e) { block = null; }
  if (!isPlainObject(block)) return { ...FALLBACK, plans: [...FALLBACK.plans], gates: { ...FALLBACK.gates } };
  return {
    enabled: block.enabled,
    testPhase: block.testPhase,
    adSlot: block.adSlot,
    gates: isPlainObject(block.gates) ? block.gates : { ...FALLBACK.gates },
    plans: Array.isArray(block.plans) ? block.plans : FALLBACK.plans,
  };
}

// getPremiumPlans() → normalized plan array; malformed entries dropped; [] if
// none valid.
export function getPremiumPlans() {
  const raw = getPremiumConfig().plans;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const p of raw) {
    const norm = normalizePlan(p);
    if (norm) out.push(norm);
  }
  return out;
}

// getPremiumFeatures() → static free-vs-premium comparison rows. Honest: today
// nothing is actually gated — the screen adds the "free during testing"
// framing. free/premium are short display strings.
export function getPremiumFeatures() {
  return [
    { id: 'full-mocks',  label: 'Full mock tests',              free: 'Limited / week',        premium: 'Unlimited' },
    { id: 'analytics',   label: 'Advanced analytics & insights', free: 'Core stats',            premium: 'Deep breakdowns' },
    { id: 'adfree',      label: 'Ad-free experience',            free: 'Occasional ads (future)', premium: 'Always ad-free' },
    { id: 'early-banks', label: 'New question banks',            free: 'Standard release',      premium: 'Early access' },
    { id: 'frames',      label: 'Exclusive profile frames',      free: '—',                     premium: 'Premium collection' },
    { id: 'support',     label: 'Priority support',              free: 'Community',             premium: 'Direct line' },
  ];
}

// Flag helpers — default-on for enabled/testPhase, default-off for adSlot.
export function isPremiumEnabled() { return getPremiumConfig().enabled !== false; }
export function isTestPhase() { return getPremiumConfig().testPhase !== false; }
export function isAdSlotEnabled() { return getPremiumConfig().adSlot === true; }

// getPremiumState(profile) → membership state from profile.premium, which the
// subscription broker now writes (entitlementToPremium in subscription.js —
// admin-granted during the placeholder-payments era). Tier-aware: SUPER is the
// base paid tier, MAX includes it. An expired cached entitlement lapses even
// offline (expiresAt is re-checked here); the server stays authoritative on
// the next refresh. Never throws on null/undefined profile.
export function getPremiumState(profile, now = Date.now()) {
  const p = profile && profile.premium;
  if (p && p.active === true) {
    if (typeof p.expiresAt === 'number' && Number.isFinite(p.expiresAt) && p.expiresAt <= now) {
      return { active: false, plan: null, tier: null };
    }
    return {
      active: true,
      plan: p.plan || p.billing || null,
      tier: p.tier === 'MAX' ? 'MAX' : 'SUPER',
    };
  }
  return { active: false, plan: null, tier: null };
}

// isPremiumUser(profile) — the single entitlement check every gate reads.
// True for ANY active paid tier (SUPER or MAX).
export function isPremiumUser(profile) { return getPremiumState(profile).active === true; }

// isMaxUser(profile) — the top-tier check for future MAX-only surfaces.
export function isMaxUser(profile) { return getPremiumState(profile).tier === 'MAX'; }

// cribVaultLocked(profile) — is the crib-history / Mistake Vault wall UP for
// this user? True only when the remote gate is ON (default OFF during the
// test phase) AND the user isn't premium. The post-quiz session crib sheet is
// NEVER gated — that immediate review is the free tier's marketing hook.
export function cribVaultLocked(profile) {
  return getPremiumConfig().gates.cribVault === true && !isPremiumUser(profile);
}

// formatInr(n) → '₹' + n with Indian-style digit grouping (lakh system):
// 999 → '₹999', 1499 → '₹1,499', 100000 → '₹1,00,000'. Non-finite → '₹—'.
export function formatInr(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '₹—';
  const neg = n < 0;
  const abs = Math.abs(Math.trunc(n));
  const s = String(abs);
  let grouped;
  if (s.length <= 3) {
    grouped = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    // Group the remaining digits in pairs from the right (Indian system).
    const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = restGrouped + ',' + last3;
  }
  return '₹' + (neg ? '-' : '') + grouped;
}
