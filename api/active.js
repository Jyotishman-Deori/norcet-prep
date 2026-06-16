// =====================================================================
// api/active.js — Session 5  (HARDENED: C-5)
// Called every time the app opens. Stamps today's date on the device's KV
// record so the cron job can skip users who already opened today.
// Serverless (Vercel) — not bundled by Vite.
//
// C-5 FIX (and its honest limits):
//   Also called by anonymous devices, so no session token. Hardening:
//     1. Validate the id shape (must look like our base64 endpoint-hash) so
//        the endpoint can't be used to probe arbitrary KV keys.
//     2. IP rate-limit.
//     3. It only ever PATCHES lastActive on an EXISTING sub: row — it cannot
//        create rows or write attacker data. Worst case an attacker who knows
//        a victim's id could stamp it "active" to SUPPRESS that victim's
//        reminder for the day. The id is a 32-char slice of the push endpoint
//        (not enumerable/guessable in practice), and the impact is one missed
//        nudge — low. Eliminating it entirely needs the id to be a per-device
//        secret, which is a larger change (noted follow-up).
//
// Requires env: KV_REST_API_URL, KV_REST_API_TOKEN.
// =====================================================================
import { kv } from '@vercel/kv';
import { rateLimit } from './_ratelimit.js';

// Our ids are a 32-char base64url-ish slice of the endpoint hash.
function validId(id) {
  return typeof id === 'string' && id.length >= 16 && id.length <= 64 && /^[A-Za-z0-9_\-+/=]+$/.test(id);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rl = await rateLimit(req, { bucket: 'active', limit: 120, windowSec: 3600 });
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfter || 3600)); return res.status(429).json({ error: 'Too many requests' }); }

  try {
    const { subscriptionId } = req.body || {};
    if (!validId(subscriptionId)) return res.status(400).json({ error: 'Missing id' });
    const key = `sub:${subscriptionId}`;
    const existing = await kv.get(key);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...JSON.parse(existing), lastActive: new Date().toISOString().slice(0, 10) };
    await kv.set(key, JSON.stringify(updated));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'active failed' });
  }
}
