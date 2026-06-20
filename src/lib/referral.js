// =====================================================================
// src/lib/referral.js — per-user referral links + ?ref capture (Phase 1).
//
// A user's referral CODE is just their profile id (normalizeProfileId of the
// display name) — already a unique, URL-safe slug, so no new identity is
// minted. Their referral LINK is `${origin}/?ref=<code>&via=<channel>`. The
// same code/link feed every sharing surface (share message, copy, WhatsApp,
// QR, score card) so all attribution rolls up to one identity, while `via`
// records WHICH surface drove the install (for the future channel breakdown).
//
// CAPTURE (arrival side): when someone opens a referral link,
// captureReferralFromUrl() — called once at boot, before first render —
// parses ?ref / ?via, normalises them, stores them LOCALLY (IndexedDB,
// shared=false) so the attribution survives the gap between landing and
// signing up, then cleans the params out of the address bar. createProfile()
// later stamps referredBy / referralChannel onto the new profile and clears
// the pending capture. No network and no shared writes happen here — capture
// is purely local until signup, so it costs nothing for visitors who bounce.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { KEY_PREFIXES } from './keys.js';
import { normalizeProfileId } from './profile-crypto.js';

// Known sharing surfaces. Capture allowlists these; anything else (or a
// missing via) is recorded as 'link' so the channel data stays clean instead
// of accumulating junk values.
export const VIA = {
  SHARE:     'share',     // the composed multi-step share message
  LINK:      'link',      // a plain copied link
  WHATSAPP:  'whatsapp',  // the direct-to-WhatsApp button
  QR:        'qr',        // the Share-page QR / branded card
  SCORE:     'score',     // the QR / link on the score share card
  MILESTONE: 'milestone', // a shared milestone card
  POSTER:    'poster',    // printable poster (later phase)
  BATCH:     'batch',     // batch invite (later phase)
};
const KNOWN_VIA = new Set(Object.values(VIA));

const PROD_ORIGIN = 'https://norcet-prep.vercel.app';

export function appOrigin() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return PROD_ORIGIN;
}

// Display form of the bare app URL (no scheme), for pills / labels.
export function displayAppUrl() {
  return appOrigin().replace(/^https?:\/\//, '');
}

// A batch invite link uses a SEPARATE `batch` param (not `ref`) so the batch id
// survives untouched — `ref` is normalised to a slug, which would mangle it.
export function buildBatchUrl(batchId) {
  return `${appOrigin()}/?batch=${encodeURIComponent(batchId)}&via=${VIA.BATCH}`;
}

// The current user's own referral code = their profile id (a clean slug).
// Guests have no stable identity, so they get no code (channel-only links).
export function referralCodeFor(profile) {
  if (!profile || profile.isGuest) return null;
  return profile.id || normalizeProfileId(profile.displayName || '') || null;
}

// Build a sharing URL. `code` may be null (guest / no referrer) — then only
// the channel is attached, so the install still counts toward a surface even
// without a referrer.
export function buildReferralUrl(code, via) {
  const v = KNOWN_VIA.has(via) ? via : VIA.LINK;
  const params = [];
  if (code) params.push(`ref=${encodeURIComponent(code)}`);
  params.push(`via=${v}`);
  return `${appOrigin()}/?${params.join('&')}`;
}

// ---- capture (arrival side) -----------------------------------------
let _pendingCache; // undefined = not loaded; null = none; object = captured
let _pendingBatchCache; // undefined = not loaded; null = none; string = batchId

function readParams() {
  try {
    const sp = new URLSearchParams((window.location && window.location.search) || '');
    return { ref: sp.get('ref'), via: sp.get('via'), batch: sp.get('batch') };
  } catch (e) { return { ref: null, via: null, batch: null }; }
}

function stripParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('ref') && !url.searchParams.has('via') && !url.searchParams.has('batch')) return;
    url.searchParams.delete('ref');
    url.searchParams.delete('via');
    url.searchParams.delete('batch');
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
  } catch (e) { /* non-fatal */ }
}

// Call ONCE at boot, before first render. Captures synchronously into memory
// (so signup in the same session is covered even if IndexedDB is slow) and
// persists to IDB best-effort. Cleans the address bar so a shared link doesn't
// linger in the URL after arrival.
export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return null;
  const { ref, via, batch } = readParams();
  if (!ref && !via && !batch) return null;
  const code = ref ? normalizeProfileId(ref) : null;   // empty/garbage → null
  const channel = KNOWN_VIA.has(via) ? via : VIA.LINK;
  const rec = { ref: code || null, via: channel, ts: Date.now() };
  _pendingCache = rec;
  try { safeStorage.set(KEY_PREFIXES.PENDING_REFERRAL, JSON.stringify(rec), false); } catch (e) {}
  // Batch invites travel on their own param. Keep the raw id (URL-safe by
  // construction) so it isn't slug-normalised. Persisted until the user joins
  // or dismisses the join prompt.
  if (batch) {
    const bid = String(batch).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    if (bid) {
      _pendingBatchCache = bid;
      try { safeStorage.set(KEY_PREFIXES.PENDING_BATCH, bid, false); } catch (e) {}
    }
  }
  stripParamsFromUrl();
  return rec;
}

export async function getPendingReferral() {
  if (_pendingCache !== undefined) return _pendingCache;
  try {
    const r = await safeStorage.get(KEY_PREFIXES.PENDING_REFERRAL, false);
    _pendingCache = (r && r.value) ? JSON.parse(r.value) : null;
  } catch (e) { _pendingCache = null; }
  return _pendingCache;
}

export async function clearPendingReferral() {
  _pendingCache = null;
  try { await safeStorage.delete(KEY_PREFIXES.PENDING_REFERRAL, false); } catch (e) {}
}

// ---- pending batch invite (arrival side) ----
export async function getPendingBatch() {
  if (_pendingBatchCache !== undefined) return _pendingBatchCache;
  try {
    const r = await safeStorage.get(KEY_PREFIXES.PENDING_BATCH, false);
    _pendingBatchCache = (r && r.value) ? String(r.value) : null;
  } catch (e) { _pendingBatchCache = null; }
  return _pendingBatchCache;
}

export async function clearPendingBatch() {
  _pendingBatchCache = null;
  try { await safeStorage.delete(KEY_PREFIXES.PENDING_BATCH, false); } catch (e) {}
}
