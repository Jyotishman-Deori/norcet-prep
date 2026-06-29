// =====================================================================
// api/notify-all.js — on-demand Web Push BROADCAST to every subscriber.
// Serverless (Vercel) — not bundled by Vite. Sends ONE notification payload to
// all `sub:*` devices in Vercel KV (auto-pruning dead subs on 404/410).
//
// USE: fired server-to-server by the kv-write Edge Function the moment an admin
// publishes a NEW public question bank ("New content" notification). It is NOT a
// client endpoint — the only caller is a trusted server holding NOTIFY_SECRET.
//
// AUTH: a single shared secret, `Authorization: Bearer ${NOTIFY_SECRET}`. The
// SAME value is set on this Vercel project AND on the kv-write Edge Function.
// The secret never ships in any client bundle, so a browser can't trigger a
// blast. Fail-closed: no secret configured ⇒ 500 (and never 200).
//
// Requires env: NOTIFY_SECRET, VAPID_SUBJECT, VAPID_PUBLIC_KEY,
//   VAPID_PRIVATE_KEY, KV_REST_API_URL, KV_REST_API_TOKEN (the last four are
//   already present for api/send-reminders.js).
// =====================================================================
import { kv } from '@vercel/kv';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Constant-time-ish compare (length check + char xor).
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const CONCURRENCY = 20;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: server-to-server shared secret (fail closed).
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) return res.status(500).json({ error: 'NOTIFY_SECRET not configured' });
  const auth = req.headers['authorization'] || '';
  if (!safeEqual(auth, `Bearer ${secret}`)) return res.status(401).json({ error: 'Unauthorized' });

  // Body: { title, body, url? }. Tolerate a raw-string body.
  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = {}; } }
  payload = payload && typeof payload === 'object' ? payload : {};
  const title = String(payload.title || 'NORCET Prep').slice(0, 80);
  const bodyText = String(payload.body || 'New content is available.').slice(0, 200);
  const url = String(payload.url || '/').slice(0, 200);

  // `tag: norcet-content` (distinct from the reminder's `norcet-daily`) so a
  // content push never collapses a pending daily reminder, and vice-versa.
  const msg = JSON.stringify({
    title, body: bodyText,
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: 'norcet-content', renotify: true, data: { url }
  });

  let keys = [];
  try { keys = await kv.keys('sub:*'); } catch (e) { return res.status(500).json({ error: 'kv scan failed' }); }

  let sent = 0, failed = 0;
  async function processOne(key) {
    try {
      const record = await kv.get(key); // @vercel/kv returns the deserialised object
      if (!record || !record.subscription) return;
      await webpush.sendNotification(record.subscription, msg);
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { try { await kv.del(key); } catch (_) {} }
      failed++;
    }
  }
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    await Promise.all(keys.slice(i, i + CONCURRENCY).map(processOne));
  }

  return res.status(200).json({ sent, failed, total: keys.length });
}
