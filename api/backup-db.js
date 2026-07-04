// =====================================================================
// api/backup-db.js — nightly OWNER-side disaster-recovery backup.
//
// WHY: every user's data lives in ONE Supabase table (kv_shared). Supabase's
// free tier has no automatic backups / point-in-time recovery, so a deleted,
// corrupted, or paused project would lose everything with no way back. This
// dumps the whole table to a PRIVATE GitHub repo once a day, so the worst case
// becomes "we lose at most a day", not "we lose everything".
//
// This is OWNER disaster recovery, distinct from the user-facing cloud sync
// (that's the automatic Supabase sync the app already does).
//
// HOW IT RUNS: Vercel Hobby caps crons at 2 and both are already used by
// send-reminders (AM + PM). So instead of a 3rd cron, send-reminders calls
// backupDatabase() once a day (on its AM run). This file is ALSO a protected
// HTTP route (GET/POST /api/backup-db with the CRON_SECRET bearer) so you can
// trigger a backup on demand to test.
//
// SHIPS DARK: with any required env var missing, backupDatabase() no-ops and
// returns { ok:false, reason:'not-configured' } — safe to deploy before setup.
//
// REQUIRED ENV (set in Vercel → Project → Settings → Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  — Supabase dashboard → Settings → API → service_role
//   BACKUP_GITHUB_TOKEN        — a fine-grained PAT with Contents:Read+Write on
//                                ONLY the backup repo
//   BACKUP_GITHUB_REPO         — "owner/repo", e.g. "Jyotishman-Deori/norcet-backups"
//   (SUPABASE_URL or VITE_SUPABASE_URL and CRON_SECRET already exist.)
//
// NOTE: this backs up kv_shared (all user progress + content + config — the
// irreplaceable data). It deliberately does NOT include profile_secrets
// (password hashes), to avoid keeping credentials off-platform. If the whole
// project were ever lost, users recover their progress by re-registering with
// the same display name (their restored profile:<id> blob then loads).
// =====================================================================

const PAGE = 1000; // PostgREST default page size; we paginate via Range headers.

function envUrl() { return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''; }

function missingEnv() {
  const miss = [];
  if (!envUrl()) miss.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) miss.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.BACKUP_GITHUB_TOKEN) miss.push('BACKUP_GITHUB_TOKEN');
  if (!process.env.BACKUP_GITHUB_REPO) miss.push('BACKUP_GITHUB_REPO');
  return miss;
}

// Read every kv_shared row with the service-role key (bypasses RLS). Paginated
// via the Range header so it's correct even past PostgREST's 1000-row page cap.
async function readAllRows(url, serviceKey) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1;
    const r = await fetch(`${url}/rest/v1/kv_shared?select=key,value&order=key.asc`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
        'Range-Unit': 'items',
        Range: `${from}-${to}`,
      },
    });
    if (!r.ok) throw new Error(`supabase read ${r.status} ${await r.text().catch(() => '')}`.trim());
    const batch = await r.json();
    if (!Array.isArray(batch)) throw new Error('supabase read: unexpected body');
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

// ---- GitHub Contents API (commit a single file) ----
const GH = 'https://api.github.com';
function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'norcet-backup',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}
// Existing file's blob sha (needed to UPDATE it on a same-day re-run). null if new.
async function ghGetSha(repo, path, token) {
  const r = await fetch(`${GH}/repos/${repo}/contents/${path}`, { headers: ghHeaders(token) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`github get ${r.status} ${await r.text().catch(() => '')}`.trim());
  const j = await r.json();
  return j && j.sha ? j.sha : null;
}
async function ghPutFile(repo, path, contentB64, message, sha, token) {
  const body = { message, content: contentB64 };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`github put ${r.status} ${await r.text().catch(() => '')}`.trim());
  const j = await r.json();
  return (j && j.commit && j.commit.sha) || null;
}

// The core routine. Env-gated (no-ops when unconfigured), never throws to the
// caller in a way that could break the piggybacking reminder run — callers wrap
// it, and it returns a plain result object.
export async function backupDatabase() {
  const miss = missingEnv();
  if (miss.length) return { ok: false, reason: 'not-configured', missing: miss };

  const url = envUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.BACKUP_GITHUB_TOKEN;
  const repo = process.env.BACKUP_GITHUB_REPO;

  const rows = await readAllRows(url, serviceKey);
  const takenAt = new Date().toISOString();
  const snapshot = { app: 'norcet-prep', table: 'kv_shared', takenAt, rowCount: rows.length, rows };
  const json = JSON.stringify(snapshot, null, 2);
  const contentB64 = Buffer.from(json, 'utf8').toString('base64');

  const date = takenAt.slice(0, 10); // YYYY-MM-DD → one openable file per day
  const path = `snapshots/kv_shared-${date}.json`;
  const sha = await ghGetSha(repo, path, token); // update if this day already ran
  const commit = await ghPutFile(
    repo, path, contentB64,
    `backup: kv_shared ${date} (${rows.length} rows)`,
    sha, token,
  );

  return { ok: true, path, rowCount: rows.length, bytes: json.length, commit };
}

// ---- HTTP route (on-demand manual trigger; CRON_SECRET-protected) ----
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed
  return safeEqual(req.headers['authorization'] || '', `Bearer ${secret}`);
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await backupDatabase();
    const status = result.ok ? 200 : (result.reason === 'not-configured' ? 503 : 500);
    return res.status(status).json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
}
