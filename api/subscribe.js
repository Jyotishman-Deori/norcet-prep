// =====================================================================
// api/subscribe.js — Session 5
// Stores a Web Push subscription (+ the user's reminder time) in Vercel KV
// when they enable reminders. Keyed by a hash of the push endpoint so the
// same device updates the same row. Serverless (Vercel) — not bundled by Vite.
// Requires env: KV_REST_API_URL, KV_REST_API_TOKEN (auto-added by Vercel KV).
// =====================================================================
import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

// C-5: only accept push endpoints from known push services — blocks junk/SSRF
// payloads that would otherwise fill KV (cost) and slow the cron.
const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'wns2-by3p.notify.windows.com',
  'web.push.apple.com',
];
function isValidPushEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'https:') return false;
    return ALLOWED_PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h.split('.').slice(-3).join('.')));
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    // C-5: lightweight per-IP rate limit (KV counter, 1h window) so a script
    // can't flood KV with subscriptions.
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const rlKey = `rl:sub:${ip}`;
    const count = await kv.incr(rlKey);
    if (count === 1) { try { await kv.expire(rlKey, 3600); } catch (_) {} }
    if (count > 20) return res.status(429).json({ error: 'Too many requests' });

    const { subscription, reminderTime } = req.body || {};
    if (!subscription?.endpoint || typeof subscription.endpoint !== 'string') {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    if (!isValidPushEndpoint(subscription.endpoint)) {
      return res.status(400).json({ error: 'Unrecognized push endpoint' });
    }
    // Validate reminderTime is HH:MM, else fall back to a default.
    const rt = (typeof reminderTime === 'string' && /^\d{2}:\d{2}$/.test(reminderTime)) ? reminderTime : '08:00';

    const id = Buffer.from(subscription.endpoint).toString('base64').slice(-32);
    const key = `sub:${id}`;
    // C-5: capability token. Issued here, stored with the record, and required
    // by /api/active — so only the device that subscribed can stamp its own
    // record "active" (no more suppressing someone else's reminders by id).
    // Preserve an existing token if this device re-subscribes.
    let token = randomUUID();
    try {
      const existing = await kv.get(key);
      const rec = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : null;
      if (rec?.token) token = rec.token;
    } catch (_) {}

    await kv.set(key, JSON.stringify({
      subscription,
      reminderTime: rt,
      token,
      lastActive: null,
      createdAt: Date.now()
    }));
    res.status(200).json({ ok: true, id, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
