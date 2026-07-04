// =====================================================================
// src/lib/waitlist-api.js — client wrapper for the PUBLIC actions of the
// waitlist Edge Function (join / status / stats). TOKENLESS by design:
// waitlist visitors don't have an account yet, so unlike referral-stats.js
// there is no session token — the server guards these with Turnstile
// (join) + per-IP rate limits instead.
//
// Every call resolves to the broker's JSON (`{ok:true,...}` or
// `{ok:false, reason}`), and degrades to `{ok:false, reason:'network'}`
// on transport failure — callers never need try/catch. A 429 becomes
// `{ok:false, reason:'rate-limited', retryAfter}` so the UI can show a
// friendly wait message.
//
// Admin actions live in waitlist-admin.js (admin bundle only).
// =====================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/waitlist` : null;

async function call(action, extra) {
  if (!FN_URL || !SUPABASE_KEY) return { ok: false, reason: 'network' };
  try {
    const r = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...(extra || {}) }),
    });
    if (r.status === 429) {
      let retryAfter = 0;
      try { retryAfter = parseInt(r.headers.get('Retry-After') || '0', 10) || 0; } catch (e) {}
      return { ok: false, reason: 'rate-limited', retryAfter };
    }
    const j = await r.json().catch(() => null);
    if (j && typeof j === 'object') return j;
    return { ok: false, reason: 'network' };
  } catch (e) {
    return { ok: false, reason: 'network' };
  }
}

// join({ email, whatsapp, state, college?, intentAnswer?, ref?, captchaToken?, fp? })
// → { ok, code, position, totalWaiting, nextDropAt } | { ok:false, reason }
export function waitlistJoin(fields) { return call('join', fields); }

// status({ email, code? }) → { ok, status, position, totalWaiting, referrals,
//   score:{referralPts,waitPts,total}, joinedAt, nextDropAt,
//   claimToken?, claimExpiresAt? } | { ok:false, reason }
// The claim token appears ONLY when status==='approved' AND `code` matches the
// row's own referral code (proof of ownership — see waitlist Edge Fn).
export function waitlistStatus(email, code) { return call('status', { email, code }); }

// stats() → { ok, totalWaiting, byState:[{state,count}], nextDropAt }
export function waitlistStats() { return call('stats', {}); }
