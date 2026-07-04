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
// OWNER disaster-recovery backup. Vercel Hobby caps crons at 2 (both used by
// this route's AM+PM runs), so instead of a 3rd cron we piggyback the daily
// DB snapshot onto the AM run. Best-effort: a backup failure never affects
// reminders. Ships dark until its env vars are set. See api/backup-db.js.
import { backupDatabase } from './backup-db.js';

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

// ── Duty Roster: window-aware delivery on the FREE tier ──────────────────────
// Vercel Hobby caps crons at 2, so we can't fire one run per window. Instead we
// split the day into TWO sends — an AM run and a PM run (see vercel.json) — and
// push each device only on the run matching its stored reminderTime. So a user
// who chose "Morning" gets the AM run; "Afternoon"/"Night" get the PM run. Every
// device still receives at most ONE nudge/day; nobody who got a daily push
// before loses it (the old 20:00 default falls in the PM slot).
const IST_OFFSET_MIN = 330; // audience is IST; reminderTime is a local "HH:MM".
function istHourNow() {
  const d = new Date(); // Vercel runs in UTC.
  const mins = (d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MIN) % 1440;
  return Math.floor(mins / 60);
}
function slotForHour(h) { return (Number.isFinite(h) && h >= 5 && h < 12) ? 'am' : 'pm'; }
function slotForReminder(t) {
  const h = parseInt(String(t || '20:00').split(':')[0], 10);
  return slotForHour(h);
}

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

// Trivial 1-row read against Supabase PostgREST (anon) to keep the free-tier
// project active so it never idles into the 7-day pause. Uses whichever env
// names are present; no-ops (never throws) if Supabase isn't configured.
async function pingSupabase() {
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    await fetch(`${url}/rest/v1/kv_shared?select=key&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
  } catch (e) { /* best-effort keep-alive */ }
}

export default async function handler(req, res) {
  // C-4: reject anything that isn't the authenticated cron.
  if (!isAuthorizedCron(req)) return res.status(401).json({ error: 'Unauthorized' });

  // 7-DAY PAUSE GUARD — Supabase free tier pauses a project after 7 days of
  // zero activity. This daily cron also touches Supabase (a trivial 1-row read)
  // so the project never idles into a pause, even during quiet pre-launch days.
  // Best-effort; a failure here must not block the reminders.
  await pingSupabase();

  const today = new Date().toISOString().slice(0, 10);
  // Which half of the day is this run? AM cron serves "morning" devices; PM cron
  // serves "afternoon"/"night" devices. A device is pushed only on its slot.
  const currentSlot = slotForHour(istHourNow());
  let keys = [];
  try { keys = await kv.keys('sub:*'); } catch (e) { return res.status(500).json({ error: 'kv scan failed' }); }

  let sent = 0, skipped = 0, failed = 0;

  async function processOne(key) {
    try {
      // @vercel/kv returns the deserialised OBJECT — no JSON.parse (which would
      // throw on an object and fail every send).
      const record = await kv.get(key);
      if (!record) return;
      if (record.lastActive === today) { skipped++; return; }
      // Window gate: only nudge devices whose reminderTime falls in this run's
      // half of the day, so the push lands near the user's chosen window.
      if (slotForReminder(record.reminderTime) !== currentSlot) { skipped++; return; }
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

  // Once-daily DB snapshot, piggybacked on the AM run only (so it runs once a
  // day, not twice). Fully guarded — a backup error can never fail reminders.
  let backup = null;
  if (currentSlot === 'am') {
    try { backup = await backupDatabase(); }
    catch (e) { backup = { ok: false, error: String((e && e.message) || e) }; }
  }

  res.status(200).json({ today, sent, skipped, failed, backup });
}
