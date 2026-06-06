// =====================================================================
// api/active.js — Session 5
// Called every time the app opens. Stamps today's date on the device's KV
// record so the cron job can skip users who already studied/opened today.
// Serverless (Vercel) — not bundled by Vite.
// =====================================================================
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: 'Missing id' });
    const key = `sub:${subscriptionId}`;
    const existing = await kv.get(key);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...JSON.parse(existing), lastActive: new Date().toISOString().slice(0, 10) };
    await kv.set(key, JSON.stringify(updated));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
