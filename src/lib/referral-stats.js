// =====================================================================
// src/lib/referral-stats.js — client wrapper for the referral-intel Edge
// Function (Phase 2). Two calls:
//   loadMyReferralStats()  -> { total, confirmed, pending } | null
//     for the personal referral card on the Share page (any logged-in user).
//   loadSignupAnomalies()  -> [ flags ] | null   (admin only, server-enforced)
//     for the admin Growth panel.
//
// Everything degrades gracefully: if the function isn't deployed yet, the
// caller is a guest (no token), or anything errors, these return null and the
// UI simply omits the feature. No throws.
// =====================================================================
import { getAuthToken } from '../storage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/referral-intel` : null;

async function call(op, extra) {
  if (!FN_URL || !SUPABASE_KEY) return null;
  const token = getAuthToken();
  if (!token) return null;                       // guests have no token
  try {
    const r = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ op, token, ...(extra || {}) }),
    });
    if (!r.ok) return null;                       // 401/403/404 (not deployed) → silent
    return await r.json();
  } catch (e) { return null; }
}

export async function loadMyReferralStats() {
  const j = await call('my-referrals');
  if (!j || typeof j.total !== 'number') return null;
  return { total: j.total, confirmed: j.confirmed || 0, pending: j.pending || 0 };
}

export async function loadSignupAnomalies() {
  const j = await call('signup-anomalies');
  if (!j || !Array.isArray(j.flags)) return null;
  return j.flags;
}
