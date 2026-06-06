// =====================================================================
// api/send-reminders.js — Session 5
// Invoked by Vercel Cron (see vercel.json). Sends a Web Push to every device
// that has NOT opened the app today, picking a random message. Auto-prunes
// dead subscriptions (404/410). Serverless (Vercel) — not bundled by Vite.
// Requires env: VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// KV_REST_API_URL, KV_REST_API_TOKEN.
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

export default async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const keys = await kv.keys('sub:*');
  let sent = 0, skipped = 0, failed = 0;

  for (const key of keys) {
    try {
      const raw = await kv.get(key);
      if (!raw) continue;
      const record = JSON.parse(raw);
      if (record.lastActive === today) { skipped++; continue; }
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
      if (e.statusCode === 404 || e.statusCode === 410) await kv.del(key);
      failed++;
    }
  }
  res.status(200).json({ today, sent, skipped, failed });
}
