// =====================================================================
// supabase/functions/push-broadcast/index.ts
// Admin-triggered Web Push BROADCAST (admin panel → "Push broadcast").
//
// The Vercel endpoint api/notify-all.js does the actual sending, but it is
// server-to-server only (Bearer NOTIFY_SECRET — never in a client bundle).
// This function is the ADMIN-AUTHENTICATED bridge: it verifies the caller's
// signed session token (same HMAC scheme as kv-write), checks the
// admin_profile_ids allow-list, rate-caps blasts, and only then relays the
// message to notify-all with the secret. The composer gets the send stats
// back ({ sent, failed, skipped, total }) to show a real confirmation.
//
// AUTH CHAIN (all fail-closed):
//   signed token (SESSION_SIGNING_SECRET) → admin_profile_ids row → rate cap.
//
// RATE CAP: 4 broadcasts/hour per admin (same bucket family as kv-write's
// content-notify) — a fat-finger can't spam every device on the roster.
//
// DEPLOY (secrets are project-wide; both already set for kv-write):
//   supabase functions deploy push-broadcast --no-verify-jwt
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SESSION_SECRET = Deno.env.get("SESSION_SIGNING_SECRET") ?? "";
const NOTIFY_URL = Deno.env.get("NOTIFY_URL") ?? "https://www.nurseholic.in/api/notify-all";
const NOTIFY_SECRET = Deno.env.get("NOTIFY_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
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

// ---- token verification (mirror of auth-secure's mintToken / kv-write) ----
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
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
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

// STAFF ROLES (Admin > Co-Admin > Moderator; supabase/admin-roles.sql).
// This broker's actions are Co-Admin+; moderators (community control only)
// get nothing here. Legacy fallback: pre-migration membership = 'coadmin'.
type StaffRole = "admin" | "coadmin" | "moderator";
const ROLE_RANK: Record<StaffRole, number> = { admin: 3, coadmin: 2, moderator: 1 };
async function isAdmin(s: Session): Promise<boolean> {
  const ids = [s.id, s.uid].filter(Boolean).map((v) => encodeURIComponent(String(v)));
  if (!ids.length) return false;
  const base = `${SUPABASE_URL}/rest/v1/admin_profile_ids?profile_id=in.(${ids.join(",")})`;
  let r = await fetch(`${base}&select=profile_id,role`, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) r = await fetch(`${base}&select=profile_id`, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return false;
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return false;
  let best = 0;
  for (const row of rows) {
    const rank = row && row.role ? (ROLE_RANK[row.role as StaffRole] ?? 2) : 2;
    if (rank > best) best = rank;
  }
  return best >= 2; // Co-Admin or above
}

// Fixed-window limiter via the shared rate_hit() RPC (fails OPEN, like kv-write).
async function rateHit(bucket: string, identifier: string, limit: number, windowSeconds: number):
  Promise<{ allowed: boolean; retryAfter: number }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_hit`, {
      method: "POST",
      headers: dbHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify({ p_bucket: bucket, p_identifier: identifier || "unknown", p_limit: limit, p_window_seconds: windowSeconds }),
    });
    if (!r.ok) return { allowed: true, retryAfter: 0 };
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { allowed: true, retryAfter: 0 };
    return { allowed: !!row.allowed, retryAfter: Number(row.retry_after) || 0 };
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET) return json({ error: "SESSION_SIGNING_SECRET is not set" }, 500);
  if (!NOTIFY_SECRET) return json({ error: "NOTIFY_SECRET is not set" }, 500);

  let body: { token?: unknown; title?: string; body?: string; url?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  // 1) Authenticate + authorize (fail closed).
  const session = await verifyToken(body.token);
  if (!session) return json({ error: "Not authenticated" }, 401);
  if (!(await isAdmin(session))) return json({ error: "Forbidden: admin only" }, 403);

  // 2) Validate the message.
  const title = String(body.title ?? "").trim().slice(0, 80);
  const text = String(body.body ?? "").trim().slice(0, 200);
  if (!title || !text) return json({ error: "Title and message are required" }, 400);
  // Relative in-app URLs only — a broadcast must never deep-link off-site.
  let url = String(body.url ?? "/").trim().slice(0, 200);
  if (!/^\/(?!\/)/.test(url)) url = "/";

  // 3) Rate cap: 4 broadcasts/hour per admin.
  const rl = await rateHit("push-broadcast", session.id, 4, 60 * 60);
  if (!rl.allowed) {
    return json({ error: `Too many broadcasts — try again in about ${Math.max(1, Math.ceil(rl.retryAfter / 60))} minute(s).`, retryAfter: rl.retryAfter }, 429);
  }

  // 4) Relay to notify-all (the only holder-of-secret call).
  try {
    const r = await fetch(NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NOTIFY_SECRET}` },
      body: JSON.stringify({ title, body: text, url }),
    });
    const stats = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: `notify-all failed: ${r.status}` }, 502);
    return json({ ok: true, ...stats });
  } catch (e) {
    return json({ error: `relay error: ${(e as Error).message ?? e}` }, 502);
  }
});
