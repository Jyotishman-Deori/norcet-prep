// =====================================================================
// api/subscribe.js — Session 5  (HARDENED: C-5)
// Stores a Web Push subscription (+ reminder time) in Vercel KV when a user
// enables reminders. Keyed by a hash of the push endpoint so the same device
// updates the same row. Serverless (Vercel) — not bundled by Vite.
//
// C-5 FIX (and its honest limits):
//   This endpoint is called by ANONYMOUS devices BEFORE login (reminders can
//   be enabled as a guest), so it CANNOT require a session token without
//   breaking the feature. Instead we harden against junk/poisoning:
//     1. Validate the subscription shape AND that endpoint is a real push
//        service URL (https + known host), so attackers can't stuff arbitrary
//        data into KV.
//     2. IP rate-limit, so one source can't create thousands of sub: rows
//        (which would bloat KV and slow the cron scan).
//     3. Store endpoint-derived id ONLY (unchanged) — a sub is keyed by its
//        own endpoint hash, so a caller can only ever address their own row.
//   Residual risk: someone could register their OWN valid push subscription
//   repeatedly (rate-limited) — low impact. Full abuse-proofing needs a
//   CAPTCHA/Turnstile at enable-time (noted follow-up).
//
// Requires env: KV_REST_API_URL, KV_REST_API_TOKEN.
// =====================================================================
import { kv } from '@vercel/kv';
import { rateLimit } from './_ratelimit.js';

// Known Web Push service hosts. We accept the major ones; anything else is
// rejected so the endpoint can't be used to store arbitrary URLs/data.
const ALLOWED_PUSH_HOST = /(\.googleapis\.com|\.mozilla\.com|\.windows\.com|\.microsoft\.com|push\.apple\.com)$/i;

function validSubscription(sub) {
  if (!sub || typeof sub !== 'object') return false;
  if (typeof sub.endpoint !== 'string') return false;
  let u;
  try { u = new URL(sub.endpoint); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  if (!ALLOWED_PUSH_HOST.test(u.hostname)) return false;
  // keys block is required for an encrypted push; reject malformed.
  if (sub.keys && typeof sub.keys !== 'object') return false;
  return true;
}

function validReminderTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // C-5: throttle by IP — 30 enable/refresh calls per hour per source.
  const rl = await rateLimit(req, { bucket: 'subscribe', limit: 30, windowSec: 3600 });
  if (!rl.ok) { res.setHeader('Retry-After', String(rl.retryAfter || 3600)); return res.status(429).json({ error: 'Too many requests' }); }

  try {
    const { subscription, reminderTime } = req.body || {};
    if (!validSubscription(subscription)) return res.status(400).json({ error: 'Invalid subscription' });
    const time = validReminderTime(reminderTime) ? reminderTime : '08:00';
    const id = Buffer.from(subscription.endpoint).toString('base64').slice(-32);
    // Store the OBJECT directly. @vercel/kv (Upstash) serialises on set and
    // deserialises on get, so JSON.stringify-ing here + JSON.parse-ing on read
    // double-encodes and breaks the readers (active.js / send-reminders.js).
    await kv.set(`sub:${id}`, {
      subscription,
      reminderTime: time,
      lastActive: null,
      createdAt: Date.now()
    });
    res.status(200).json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: 'subscribe failed' });
  }
}
