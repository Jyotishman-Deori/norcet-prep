// =====================================================================
// api/send-reminders.js — Session 5  (HARDENED: C-4)
// Invoked by Vercel Cron (see vercel.json). Sends a Web Push to every device
// that has NOT opened the app today, picking a random message. Auto-prunes
// dead subscriptions (404/410). Serverless (Vercel) — not bundled by Vite.
//
// C-4 FIX:
//   1. AUTH — the endpoint now REQUIRES the Vercel Cron secret. Vercel sends
//      `Authorization: Bearer $CRON_SECRET` automatically on scheduled runs
//      once CRON_SECRET is set in the project env. Any request without it
//      (i.e. a random POST from the internet) is rejected 401, so nobody can
//      trigger a push blast on demand.
//   2. SCALE — sends are batched with a concurrency cap instead of a fully
//      serial await-in-loop, so the function doesn't time out as subscriber
//      count grows. (The kv.keys('sub:*') scan is still O(subs); fine for the
//      current scale — a maintained index is the next step if this grows.)
//
// Requires env: CRON_SECRET, VAPID_SUBJECT, VAPID_PUBLIC_KEY,
//   VAPID_PRIVATE_KEY, KV_REST_API_URL, KV_REST_API_TOKEN.
//
// SETUP: `vercel env add CRON_SECRET` (a long random string). Vercel injects
// it into the Authorization header of cron invocations automatically.
// =====================================================================
import { kv } from '@vercel/kv';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const MESSAGES = [
  { title: 'Time to study', body: "You haven't opened NORCET prep today. Every day counts." },
  { title: 'Your exam won\'t wait', body: 'Open the app. Even 15 minutes of focused practice moves the needle.' },
  { title: 'Study session waiting', body: "Don't let today's session slip. Open NORCET prep." },
  { title: 'One more day closer', body: 'Your competitors are studying right now. Are you?' },
  { title: 'NORCET prep', body: "Remember, it's never where you started, it's always where you finished." },
];

// Constant-time-ish compare for the secret (length check + char xor).
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorizedCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed: no secret configured = no runs
  const auth = req.headers['authorization'] || '';
  const expected = `Bearer ${secret}`;
  return safeEqual(auth, expected);
}

const CONCURRENCY = 20;

export default async function handler(req, res) {
  // C-4: reject anything that isn't the authenticated cron.
  if (!isAuthorizedCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  const today = new Date().toISOString().slice(0, 10);
  let keys = [];
  try { keys = await kv.keys('sub:*'); } catch (e) { return res.status(500).json({ error: 'kv scan failed' }); }

  let sent = 0, skipped = 0, failed = 0;

  async function processOne(key) {
    try {
      const raw = await kv.get(key);
      if (!raw) return;
      const record = JSON.parse(raw);
      if (record.lastActive === today) { skipped++; return; }
      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      await webpush.sendNotification(
        record.subscription,
        JSON.stringify({
          title: msg.title, body: msg.body,
          icon: '/icon-192.png', badge: '/icon-192.png',
          tag: 'norcet-daily', renotify: true, data: { url: '/' }
        })
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { try { await kv.del(key); } catch (_) {} }
      failed++;
    }
  }

  // Batched concurrency: process the keyspace in chunks of CONCURRENCY so a
  // few thousand subs don't serialise into a timeout.
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    await Promise.all(keys.slice(i, i + CONCURRENCY).map(processOne));
  }

  res.status(200).json({ today, sent, skipped, failed });
}
