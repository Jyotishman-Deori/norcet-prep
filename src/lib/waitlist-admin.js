// =====================================================================
// src/lib/waitlist-admin.js — client wrapper for the ADMIN actions of the
// waitlist Edge Function. Imported ONLY by the admin app's Waitlist panel
// (src/ui/admin-waitlist.jsx) — it must never enter the student bundle
// (same policy as admin.js / referral-stats' admin call).
//
// Authorization = the logged-in admin's signed session token; the function
// verifies it AND checks admin_profile_ids server-side. Wrong/expired token
// → 401/403 → these return { ok:false, error }.
// =====================================================================
import { getAuthToken } from '../storage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FN_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/waitlist` : null;

async function call(action, extra) {
  if (!FN_URL || !SUPABASE_KEY) return { ok: false, error: 'Supabase not configured' };
  const token = getAuthToken();
  if (!token) return { ok: false, error: 'Not signed in' };
  try {
    const r = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, token, ...(extra || {}) }),
    });
    const j = await r.json().catch(() => null);
    if (j && typeof j === 'object') {
      if (!r.ok && !j.error && !j.reason) return { ok: false, error: `HTTP ${r.status}` };
      return j;
    }
    return { ok: false, error: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: 'Network error' };
  }
}

// → { ok, rows:[...+referrals+score+position+effectiveStatus], counts, flags, suggestedBatch }
export function waitlistAdminList() { return call('admin-list', {}); }

// ids: uuid[] → { ok, approved:[{id, email, whatsapp, claimToken, expiresAt}] }
export function waitlistAdminApprove(ids) { return call('admin-approve', { ids }); }

// ids: uuid[] → { ok, rejected:n }
export function waitlistAdminReject(ids) { return call('admin-reject', { ids }); }

// → { ok, expired:n }
export function waitlistAdminExpireSweep() { return call('admin-expire-sweep', {}); }

// Send a SAMPLE invite email through the real Resend path (nothing is written
// to the table). email: string → { ok, sent, reason, from, to }.
export function waitlistAdminTestInvite(email) { return call('admin-test-invite', { email }); }
