// =====================================================================
// supabase/functions/referral-intel/index.ts  (Phase 2 — referral intelligence)
//
// Two read-only ops the owner-scoped kv-read broker can't serve:
//
//   op:"my-referrals"   (any authenticated user)
//     How many accounts list ME as their referrer, split confirmed/pending.
//     Returns COUNTS ONLY — never the referees' identities — so the personal
//     dashboard ("3 joined · 2 confirmed · 1 pending") leaks nothing. The
//     server scans profile:* blobs (service-role) since `referredBy` lives in
//     each user's private blob, which a non-admin caller cannot read directly.
//
//   op:"signup-anomalies"   (admin only)
//     Clusters of signups sharing a device (fp_hash) or IP (ip_hash), and
//     referral links with unusually high recent volume, from signup_events.
//     For manual review only — nothing is auto-blocked.
//
// Same token/admin model as kv-read (HMAC session token; admin = membership in
// admin_profile_ids). Service-role; never reaches the browser.
//
// DEPLOY:
//   (run supabase/referral-intel.sql first to create signup_events)
//   supabase secrets set SESSION_SIGNING_SECRET="<same value as the others>"
//   supabase functions deploy referral-intel --no-verify-jwt
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SESSION_SECRET = Deno.env.get("SESSION_SIGNING_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function dbHeaders(extra?: Record<string, string>): Record<string, string> {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, ...(extra ?? {}) };
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- token verification: byte-identical to kv-read / kv-write ----
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmacB64(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}
type Session = { id: string; uid: string | null };
async function verifyToken(token: unknown): Promise<Session | null> {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;
  const expected = await hmacB64(payloadB64);
  if (!safeEqual(expected, sigB64)) return null;
  let payload: { id?: string; uid?: string | null; exp?: number };
  try { payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))); }
  catch { return null; }
  if (!payload.id || typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  return { id: String(payload.id), uid: payload.uid == null ? null : String(payload.uid) };
}
async function isAdmin(s: Session): Promise<boolean> {
  const ids = [s.id, s.uid].filter(Boolean).map((v) => encodeURIComponent(String(v)));
  if (!ids.length) return false;
  const url = `${SUPABASE_URL}/rest/v1/admin_profile_ids?profile_id=in.(${ids.join(",")})&select=profile_id`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const VELOCITY_HOURS = 1;
const VELOCITY_THRESHOLD = 20; // > this many signups from one link within an hour → flag
const CLUSTER_MIN = 2;         // ≥ this many accounts from one device/IP → flag
const ANOMALY_WINDOW_DAYS = 30;

// activation heuristic mirrored from the admin client view: a referee counts as
// "confirmed" once they've attempted at least one question. (The richer tiered
// rule — 3 opens / 5 min — needs activity instrumentation not recorded yet.)
function attempted(blob: Record<string, unknown>): boolean {
  const data = (blob && (blob as { data?: { stats?: { totalAttempted?: number } } }).data) || {};
  const stats = (data as { stats?: { totalAttempted?: number } }).stats || {};
  return (Number(stats.totalAttempted) || 0) >= 1;
}

async function myReferrals(session: Session): Promise<Response> {
  // Scan profile blobs (value is TEXT/JSON). Fine at this scale.
  const url = `${SUPABASE_URL}/rest/v1/kv_shared?key=like.profile:*&select=value`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return json({ error: `scan ${r.status}` }, 502);
  const rows = await r.json() as Array<{ value: string }>;
  let total = 0, confirmed = 0;
  for (const row of (Array.isArray(rows) ? rows : [])) {
    let blob: Record<string, unknown>;
    try { blob = JSON.parse(row.value); } catch { continue; }
    if (String((blob as { referredBy?: unknown }).referredBy ?? "") !== session.id) continue;
    total++;
    if (attempted(blob)) confirmed++;
  }
  return json({ total, confirmed, pending: total - confirmed });
}

async function signupAnomalies(): Promise<Response> {
  const sinceIso = new Date(Date.now() - ANOMALY_WINDOW_DAYS * DAY_MS).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/signup_events?created_at=gte.${encodeURIComponent(sinceIso)}&select=profile_id,ip_hash,fp_hash,ref,created_at&order=created_at.desc&limit=5000`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return json({ error: `events ${r.status}` }, 502);
  const events = await r.json() as Array<{ profile_id: string; ip_hash: string | null; fp_hash: string | null; ref: string | null; created_at: string }>;
  const list = Array.isArray(events) ? events : [];

  const flags: Array<{ kind: string; key: string; count: number; profiles: string[]; lastAt: number }> = [];

  const clusterBy = (field: "fp_hash" | "ip_hash", kind: string) => {
    const groups = new Map<string, { profiles: Set<string>; last: number }>();
    for (const e of list) {
      const v = e[field];
      if (!v) continue;
      if (!groups.has(v)) groups.set(v, { profiles: new Set(), last: 0 });
      const g = groups.get(v)!;
      g.profiles.add(e.profile_id);
      g.last = Math.max(g.last, Date.parse(e.created_at) || 0);
    }
    for (const [key, g] of groups) {
      if (g.profiles.size >= CLUSTER_MIN) {
        flags.push({ kind, key: key.slice(0, 12), count: g.profiles.size, profiles: Array.from(g.profiles), lastAt: g.last });
      }
    }
  };
  clusterBy("fp_hash", "device");
  clusterBy("ip_hash", "ip");

  // ref velocity: > VELOCITY_THRESHOLD signups from one ref within any rolling
  // VELOCITY_HOURS window in range.
  const byRef = new Map<string, number[]>(); // ref -> sorted timestamps
  for (const e of list) {
    if (!e.ref) continue;
    if (!byRef.has(e.ref)) byRef.set(e.ref, []);
    byRef.get(e.ref)!.push(Date.parse(e.created_at) || 0);
  }
  const winMs = VELOCITY_HOURS * 60 * 60 * 1000;
  for (const [ref, tsList] of byRef) {
    const ts = tsList.filter(Boolean).sort((a, b) => a - b);
    let maxInWin = 0, j = 0;
    for (let i = 0; i < ts.length; i++) {
      while (ts[i] - ts[j] > winMs) j++;
      maxInWin = Math.max(maxInWin, i - j + 1);
    }
    if (maxInWin > VELOCITY_THRESHOLD) {
      flags.push({ kind: "velocity", key: ref, count: maxInWin, profiles: [], lastAt: ts[ts.length - 1] || 0 });
    }
  }

  flags.sort((a, b) => b.lastAt - a.lastAt);
  return json({ flags, windowDays: ANOMALY_WINDOW_DAYS, totalEvents: list.length });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET) return json({ error: "SESSION_SIGNING_SECRET is not set on referral-intel" }, 500);

  let body: { op?: string; token?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const session = await verifyToken(body.token);
  if (!session) return json({ error: "Not authenticated" }, 401);

  try {
    if (body.op === "my-referrals") {
      return await myReferrals(session);
    }
    if (body.op === "signup-anomalies") {
      if (!(await isAdmin(session))) return json({ error: "Forbidden: admin only" }, 403);
      return await signupAnomalies();
    }
    return json({ error: "Unknown op" }, 400);
  } catch (e) {
    return json({ error: `server error: ${(e as Error).message ?? e}` }, 500);
  }
});
