// =====================================================================
// api/subscribe.js — Session 5
// Stores a Web Push subscription (+ the user's reminder time) in Vercel KV
// when they enable reminders. Keyed by a hash of the push endpoint so the
// same device updates the same row. Serverless (Vercel) — not bundled by Vite.
// Requires env: KV_REST_API_URL, KV_REST_API_TOKEN (auto-added by Vercel KV).
// =====================================================================
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { subscription, reminderTime } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    const id = Buffer.from(subscription.endpoint).toString('base64').slice(-32);
    await kv.set(`sub:${id}`, JSON.stringify({
      subscription,
      reminderTime: reminderTime || '08:00',
      lastActive: null,
      createdAt: Date.now()
    }));
    res.status(200).json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
