// =====================================================================
// src/lib/subscription.js — client contract for the premium tier ecosystem
// (SUPER/MAX tiers, INDIVIDUAL/FAMILY billing, family invites).
//
// Server counterpart: supabase/functions/subscription (the only thing that
// can touch the subscriptions/family_members/family_invites tables). This
// module is two layers:
//   • PURE data + normalizers (tier catalog, entitlement shaping, join-link
//     parsing) — Node-tested, no IO, no env reads at call time.
//   • fetch wrappers that POST to the subscription Edge Function with the
//     caller's signed session token. storage.js is imported LAZILY inside
//     them (same rule as game-config.js) so pure consumers and the Node test
//     never drag in the Vite-only storage module.
//
// PLACEHOLDER-PAYMENTS ERA: nothing here charges anyone. Entitlements exist
// only when an admin grants them; the client just mirrors the server's
// answer into profile.premium (the placeholder premium.js already reads).
// =====================================================================

// ---- tier catalog (display data; the server only stores the tier id) ----
// MAX's coach features are PLANNED marketing copy, not built features — the
// app ships zero runtime-AI by hard rule, so they render as "Coming later".
export const TIER_ORDER = ['SUPER', 'MAX'];

export const TIERS = {
  SUPER: {
    id: 'SUPER',
    label: 'Super',
    tag: 'Most popular',
    blurb: 'Everything you need to crack NORCET, without limits.',
    features: [
      { label: 'Permanent Mistake Vault + saved crib sheets' },
      { label: 'Unlimited full mock tests' },
      { label: 'Ad-free forever' },
      { label: 'Early access to new question banks' },
      { label: 'Exclusive profile frames' },
      { label: 'Monthly streak repair', soon: true },
    ],
  },
  MAX: {
    id: 'MAX',
    label: 'Max',
    tag: 'Top tier',
    blurb: 'Everything in Super, plus a personal coach experience.',
    features: [
      { label: 'Everything in Super' },
      { label: 'One-on-one coach conversations', soon: true },
      { label: 'Scenario-based clinical roleplays', soon: true },
      { label: 'Granular performance feedback', soon: true },
    ],
  },
};

export const FAMILY_SEATS = 6; // 1 owner + up to 5 members, mirrors the server

function isPlainObject(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

// normalizeEntitlement(raw, now?) → an always-safe entitlement object:
//   { active, tier, billing, role, expiresAt, seats, seatsUsed, ownerId }
// Any malformed/expired/inactive input collapses to { active:false, ... }.
// Expiry is re-checked CLIENT-side too, so a cached entitlement lapses even
// offline (the server remains authoritative on the next refresh).
export function normalizeEntitlement(raw, now = Date.now()) {
  const none = { active: false, tier: null, billing: null, role: null, expiresAt: null, seats: 0, seatsUsed: 0, ownerId: null };
  if (!isPlainObject(raw) || raw.active !== true) return none;
  const tier = raw.tier === 'MAX' ? 'MAX' : raw.tier === 'SUPER' ? 'SUPER' : null;
  if (!tier) return none;
  const billing = raw.billing === 'FAMILY' ? 'FAMILY' : 'INDIVIDUAL';
  const role = raw.role === 'member' ? 'member' : 'owner';
  const expiresAt = (typeof raw.expiresAt === 'number' && Number.isFinite(raw.expiresAt)) ? raw.expiresAt : null;
  if (expiresAt != null && expiresAt <= now) return none;
  const seats = (typeof raw.seats === 'number' && Number.isFinite(raw.seats)) ? raw.seats : (billing === 'FAMILY' ? FAMILY_SEATS : 1);
  const seatsUsed = (typeof raw.seatsUsed === 'number' && Number.isFinite(raw.seatsUsed)) ? raw.seatsUsed : 0;
  const ownerId = typeof raw.ownerId === 'string' && raw.ownerId ? raw.ownerId : null;
  return { active: true, tier, billing, role, expiresAt, seats, seatsUsed, ownerId };
}

// entitlementToPremium(ent, now?) → the profile.premium blob premium.js reads
// (getPremiumState checks .active/.tier/.expiresAt). checkedAt records when
// the server last confirmed it — display-only, never used for gating.
export function entitlementToPremium(ent, now = Date.now()) {
  const e = normalizeEntitlement(ent, now);
  if (!e.active) return { active: false, checkedAt: now };
  return {
    active: true, tier: e.tier, billing: e.billing, role: e.role,
    expiresAt: e.expiresAt, checkedAt: now,
  };
}

// ---- family invite links (?join=TOKEN on the app origin) ----
export const JOIN_PARAM = 'join';
const TOKEN_RE = /^[a-zA-Z0-9]{16,80}$/;

// parseJoinToken('?join=abc…' | full search string) → token | null.
export function parseJoinToken(search) {
  if (typeof search !== 'string' || !search) return null;
  try {
    const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const raw = (qs.get(JOIN_PARAM) || '').trim();
    return TOKEN_RE.test(raw) ? raw : null;
  } catch (e) { return null; }
}

export function buildJoinLink(origin, token) {
  const base = typeof origin === 'string' && origin ? origin.replace(/\/+$/, '') : '';
  return `${base}/?${JOIN_PARAM}=${encodeURIComponent(String(token || ''))}`;
}

// ---- fetch layer (Edge Function broker) ----
const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL : undefined;
const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

// POST { action, token, ...extra } to the subscription broker. The anon key
// is transport only; authorization is the signed session token. Throws on
// transport/HTTP failure so callers can distinguish "offline" from "no".
async function callSubscriptionFn(action, extra) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase not configured');
  const { getAuthToken } = await import('../storage.js'); // lazy: keep this module Node-safe
  const token = getAuthToken();
  if (!token) throw new Error('Not signed in');
  const r = await fetch(`${SUPABASE_URL}/functions/v1/subscription`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, token, ...(extra || {}) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((j && j.error) || `subscription ${action} failed: ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return j || {};
}

// fetchEntitlement() → normalized entitlement (never throws on "not premium",
// only on transport failure — callers keep the cached copy in that case).
export async function fetchEntitlement() {
  const j = await callSubscriptionFn('status');
  return normalizeEntitlement(j && j.premium);
}

// createFamilyInvite() → { token, expiresAt, link } | { reason } on a soft no.
export async function createFamilyInvite() {
  const j = await callSubscriptionFn('invite-create');
  if (j.ok !== true || !j.invite) return { reason: j.reason || 'failed' };
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
  return { token: j.invite.token, expiresAt: j.invite.expiresAt, link: buildJoinLink(origin, j.invite.token) };
}

// acceptFamilyInvite(token) → { ok, premium? , reason? }
export async function acceptFamilyInvite(inviteToken) {
  const j = await callSubscriptionFn('invite-accept', { inviteToken });
  if (j.ok !== true) return { ok: false, reason: j.reason || 'invalid-invite' };
  return { ok: true, premium: normalizeEntitlement(j.premium) };
}

export async function listFamily() {
  const j = await callSubscriptionFn('family-list');
  if (j.ok !== true) return { ok: false, reason: j.reason || 'no-family' };
  return j;
}

export async function removeFamilyMember(memberId) {
  const j = await callSubscriptionFn('family-remove', { memberId });
  return j.ok === true ? { ok: true } : { ok: false, reason: j.reason || 'failed' };
}

export async function leaveFamily() {
  const j = await callSubscriptionFn('leave');
  return j.ok === true ? { ok: true } : { ok: false, reason: j.reason || 'failed' };
}

// ---- admin actions (admin app; server re-verifies admin_profile_ids) ----
export async function adminGrantPremium({ targetId, targetUid, tier, billing, months, note }) {
  const j = await callSubscriptionFn('admin-grant', { targetId, targetUid, tier, billing, months: months ?? null, note: note ?? null });
  return { ok: j.ok === true, premium: normalizeEntitlement(j.premium) };
}
export async function adminRevokePremium({ targetId, targetUid }) {
  const j = await callSubscriptionFn('admin-revoke', { targetId, targetUid });
  return { ok: j.ok === true, premium: normalizeEntitlement(j.premium) };
}
export async function adminPremiumStatus({ targetId, targetUid }) {
  const j = await callSubscriptionFn('admin-status', { targetId, targetUid });
  return { ok: j.ok === true, premium: normalizeEntitlement(j.premium) };
}
