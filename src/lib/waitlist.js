// =====================================================================
// src/lib/waitlist.js — pure logic for the launch waitlist.
//
// The waitlist is the invite-gated launch system (see waitlist-implementation-
// plan.md §2–§8): students join with email + WhatsApp + state, earn priority
// by referring classmates (referrals×100 + days-waiting×10), and the owner
// releases batches from the admin panel. Approved rows get a one-time claim
// token that unlocks account registration while the `waitlist.gate` config
// flag is ON.
//
// PURE MODULE — no React, no storage, no fetch. Everything here is mirrored
// verbatim inside supabase/functions/waitlist/index.ts (the server is
// authoritative; this copy powers instant client-side validation and display).
// Same deliberate-copy policy as content-filter.js ↔ kv-write/moderation.ts.
//
// ⚠ ?ref= gotcha: captureReferralFromUrl() (referral.js) slug-normalizes the
// param — "NURSE-AB12C" arrives as "nurseab12c". parseWaitlistRefCode()
// reconstructs the canonical code from any of those shapes; referral.js
// itself must NOT be changed (profile referrals depend on the slug).
// =====================================================================

// Claim links are always built against the STUDENT app origin — the admin app
// runs on its own domain, so window.location.origin is wrong there.
export const WAITLIST_APP_ORIGIN = 'https://www.nurseholic.in';

export const WAITLIST_STATUSES = ['waiting', 'pending_verification', 'approved', 'onboarded', 'expired', 'rejected'];

export const STATUS_LABELS = {
  waiting: 'In line',
  pending_verification: 'Under review',
  approved: 'Seat unlocked',
  onboarded: 'Joined',
  expired: 'Seat expired',
  rejected: 'Not eligible',
};

// ---- states (join form + admin filter) ------------------------------
// 28 states + 8 UTs. `ne: true` marks the Northeast launch region (spec §5.5).
export const INDIAN_STATES = [
  { id: 'andhra-pradesh', label: 'Andhra Pradesh' },
  { id: 'arunachal-pradesh', label: 'Arunachal Pradesh', ne: true },
  { id: 'assam', label: 'Assam', ne: true },
  { id: 'bihar', label: 'Bihar' },
  { id: 'chhattisgarh', label: 'Chhattisgarh' },
  { id: 'goa', label: 'Goa' },
  { id: 'gujarat', label: 'Gujarat' },
  { id: 'haryana', label: 'Haryana' },
  { id: 'himachal-pradesh', label: 'Himachal Pradesh' },
  { id: 'jharkhand', label: 'Jharkhand' },
  { id: 'karnataka', label: 'Karnataka' },
  { id: 'kerala', label: 'Kerala' },
  { id: 'madhya-pradesh', label: 'Madhya Pradesh' },
  { id: 'maharashtra', label: 'Maharashtra' },
  { id: 'manipur', label: 'Manipur', ne: true },
  { id: 'meghalaya', label: 'Meghalaya', ne: true },
  { id: 'mizoram', label: 'Mizoram', ne: true },
  { id: 'nagaland', label: 'Nagaland', ne: true },
  { id: 'odisha', label: 'Odisha' },
  { id: 'punjab', label: 'Punjab' },
  { id: 'rajasthan', label: 'Rajasthan' },
  { id: 'sikkim', label: 'Sikkim' },
  { id: 'tamil-nadu', label: 'Tamil Nadu' },
  { id: 'telangana', label: 'Telangana' },
  { id: 'tripura', label: 'Tripura', ne: true },
  { id: 'uttar-pradesh', label: 'Uttar Pradesh' },
  { id: 'uttarakhand', label: 'Uttarakhand' },
  { id: 'west-bengal', label: 'West Bengal' },
  { id: 'andaman-nicobar', label: 'Andaman & Nicobar Islands' },
  { id: 'chandigarh', label: 'Chandigarh' },
  { id: 'dadra-daman-diu', label: 'Dadra & Nagar Haveli and Daman & Diu' },
  { id: 'delhi', label: 'Delhi' },
  { id: 'jammu-kashmir', label: 'Jammu & Kashmir' },
  { id: 'ladakh', label: 'Ladakh' },
  { id: 'lakshadweep', label: 'Lakshadweep' },
  { id: 'puducherry', label: 'Puducherry' },
];

const STATE_IDS = new Set(INDIAN_STATES.map(s => s.id));
export function isValidState(id) { return STATE_IDS.has(id); }
export function stateLabel(id) {
  const hit = INDIAN_STATES.find(s => s.id === id);
  return hit ? hit.label : id || '—';
}

// ---- email (spec §7.2: kill +alias / gmail-dot duplicate accounts) ----
export function normalizeWaitlistEmail(raw) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at <= 0) return s;
  let local = s.slice(0, at);
  const domain = s.slice(at + 1);
  local = local.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

const EMAIL_RE = /^[a-z0-9][a-z0-9._%-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;
export function isValidEmail(normalized) { return EMAIL_RE.test(String(normalized || '')); }

// Spec §7.1 blacklist + the usual suspects. Server mirror is authoritative.
export const TEMP_MAIL_DOMAINS = new Set([
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  'sharklasers.com', 'guerrillamail.com', 'guerrillamailblock.com',
  'mailinator.com', 'yopmail.com', 'dispostable.com', 'trashmail.com',
  'getnada.com', 'maildrop.cc', 'fakeinbox.com', 'mintemail.com',
  'throwawaymail.com', 'emailondeck.com', 'mohmal.com', 'tempail.com',
  'mailnesia.com', 'spambog.com', 'mytemp.email', 'tmpmail.org',
]);
export function isTempMail(email) {
  const at = String(email || '').lastIndexOf('@');
  if (at < 0) return false;
  return TEMP_MAIL_DOMAINS.has(String(email).slice(at + 1).toLowerCase().trim());
}

// ---- WhatsApp number (spec §7.3: strict Indian mobile, one row per human) ----
// Accepts "98765 43210", "+91 9876543210", "09876543210" → "9876543210".
// Returns the 10-digit string or null when it isn't a real Indian mobile shape.
export function normalizeWhatsapp(raw) {
  let d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

// ---- referral codes (spec §4.3) --------------------------------------
export const WAITLIST_CODE_RE = /^NURSE-[A-Z0-9]{5}$/;
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateWaitlistCode(rand = Math.random) {
  let tail = '';
  for (let i = 0; i < 5; i++) tail += CODE_CHARS.charAt(Math.floor(rand() * CODE_CHARS.length) % CODE_CHARS.length);
  return `NURSE-${tail}`;
}

// Canonical code from any arrival shape: "NURSE-AB12C" / "nurse-ab12c" /
// "NURSEAB12C" / the referral.js slug "nurseab12c". Anything else → null
// (e.g. a profile-id ref like "priya123" — the caller falls back to raw
// attribution, never an error).
export function parseWaitlistRefCode(raw) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!/^nurse[a-z0-9]{5}$/.test(s)) return null;
  return `NURSE-${s.slice(5).toUpperCase()}`;
}

// ---- intent screening (spec §3) --------------------------------------
export const INTENT_MAX = 500;
export const INTENT_HIGH_CHARS = 50; // longer answer = high-intent signal

export function intentScore(answer) {
  return String(answer == null ? '' : answer).trim().length > INTENT_HIGH_CHARS ? 5 : 1;
}

// Free-text hygiene for college / intent answer: never render user markup,
// hard cap length (same policy as sanitizeIkigai in demographics.js).
export function sanitizeFreeText(s, max) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').trim().slice(0, max);
}

// ---- priority score (spec: referrals×100 + daysWaiting×10) ------------
const DAY_MS = 86400000;

export function priorityScore({ referrals, createdAt } = {}, now = Date.now()) {
  const refs = (typeof referrals === 'number' && Number.isFinite(referrals) && referrals > 0) ? Math.floor(referrals) : 0;
  const created = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt;
  const days = (typeof created === 'number' && Number.isFinite(created) && created < now)
    ? Math.floor((now - created) / DAY_MS) : 0;
  const referralPts = refs * 100;
  const waitPts = days * 10;
  return { referralPts, waitPts, total: referralPts + waitPts };
}

// ---- batch drop schedule (spec §5: Tue 10:00 + Fri 15:00 IST) ----------
// dow: 0=Sun … 6=Sat, in IST. Owner-tunable via game_config waitlist.schedule.
export const DEFAULT_DROP_SCHEDULE = [
  { dow: 2, h: 10, m: 0 },
  { dow: 5, h: 15, m: 0 },
];

const IST_OFFSET_MS = 330 * 60000; // UTC+5:30

function validSchedule(schedule) {
  if (!Array.isArray(schedule)) return null;
  const ok = schedule.filter(e => e && typeof e === 'object'
    && Number.isInteger(e.dow) && e.dow >= 0 && e.dow <= 6
    && Number.isInteger(e.h) && e.h >= 0 && e.h <= 23
    && Number.isInteger(e.m || 0) && (e.m || 0) >= 0 && (e.m || 0) <= 59);
  return ok.length ? ok : null;
}

// Next upcoming drop (epoch ms) strictly AFTER `now`. Pure IST arithmetic —
// no Intl/timezone dependency, correct regardless of device timezone.
export function nextBatchDrop(now = Date.now(), schedule = DEFAULT_DROP_SCHEDULE) {
  const entries = validSchedule(schedule) || DEFAULT_DROP_SCHEDULE;
  // Shift into "fake UTC that reads as IST", do calendar math there, shift back.
  const ist = new Date(now + IST_OFFSET_MS);
  const base = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const today = ist.getUTCDay();
  let best = null;
  for (const e of entries) {
    for (let off = 0; off <= 7; off++) {
      if ((today + off) % 7 !== e.dow) continue;
      const candidate = base + off * DAY_MS + (e.h * 60 + (e.m || 0)) * 60000 - IST_OFFSET_MS;
      if (candidate > now && (best === null || candidate < best)) best = candidate;
      if (candidate > now) break; // earliest occurrence of this entry found
    }
  }
  return best; // never null: every entry occurs within 7 days
}

// Countdown display parts for a remaining span (clamped at zero).
export function countdownParts(msRemaining) {
  const ms = Math.max(0, Number(msRemaining) || 0);
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

// "Sat 5 Jul, 7:30 PM IST" — for claim-expiry copy. Pure IST math.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function formatIstTime(epochMs) {
  const t = typeof epochMs === 'string' ? Date.parse(epochMs) : epochMs;
  if (typeof t !== 'number' || !Number.isFinite(t)) return '';
  const d = new Date(t + IST_OFFSET_MS);
  const h24 = d.getUTCHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${h12}:${mm} ${ampm} IST`;
}

// ---- claim links (?claim=<uuid> on the student origin) -----------------
export const CLAIM_PARAM = 'claim';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseClaimParam(search) {
  if (typeof search !== 'string' || !search) return null;
  try {
    const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const raw = (qs.get(CLAIM_PARAM) || '').trim();
    return UUID_RE.test(raw) ? raw.toLowerCase() : null;
  } catch (e) { return null; }
}

export function buildClaimUrl(origin, token) {
  const base = typeof origin === 'string' && origin ? origin.replace(/\/+$/, '') : WAITLIST_APP_ORIGIN;
  return `${base}/?${CLAIM_PARAM}=${encodeURIComponent(String(token || ''))}`;
}

// ---- share / nudge messages (spec §4.5, honest numbers only) ------------
// Rides the existing ?ref= capture; via= is the referral.js channel tag.
export function buildWaitlistShareUrl(code, via = 'whatsapp') {
  return `${WAITLIST_APP_ORIGIN}/?ref=${encodeURIComponent(String(code || ''))}&via=${encodeURIComponent(via)}`;
}

export function buildWaitlistShareMessage({ code, url } = {}) {
  const link = url || buildWaitlistShareUrl(code);
  return `I found a NORCET prep app that's invite-only right now 🩺 ` +
    `When 3 of us join the waitlist with my code, our whole group moves up the line for the next batch. ` +
    `My code: ${code}. Join here: ${link}`;
}

// Owner → approved student (manual WhatsApp nudge from the admin panel).
export function buildApprovalNudgeMessage({ claimUrl, expiresAt } = {}) {
  const when = formatIstTime(expiresAt);
  return `Your NurseHolic seat is ready 🎉 Claim it here: ${claimUrl}` +
    (when ? `: your seat is held until ${when}, after that it goes to the next student in line.` : '');
}

// wa.me deep link. With a 10-digit number → direct chat; without → share picker.
export function buildWaUrl(phone10, message) {
  const text = encodeURIComponent(String(message || ''));
  const digits = normalizeWhatsapp(phone10);
  return digits ? `https://wa.me/91${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
