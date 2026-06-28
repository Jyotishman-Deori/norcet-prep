// =====================================================================
// supabase/functions/kv-write/index.ts
// The WRITE BROKER for NORCET Prep  (Stage 2 / C-1 integrity half).
//
// After Stage 2, the public anon key can no longer write kv_shared at all
// (the open anon INSERT/UPDATE/DELETE policies are dropped — see
// supabase/lock-writes.sql). EVERY shared write goes through this function,
// which holds the service-role key and enforces who-may-write-what.
//
// AUTH: the caller presents a signed session token (minted by auth-secure
// at login). We verify the HMAC with the SAME SESSION_SIGNING_SECRET, check
// expiry, and read { id, uid } from it. The anon key is transport only.
//
// AUTHORIZATION MATRIX (agreed in the design step):
//   profile: / profilemeta: / myfeedback: / leaderboard: / favorder: /
//   analytics:user:
//        -> only if token.id === the key's <id> suffix  (or caller is admin)
//   helpful: / notHelpful: / favsec: / errlog:
//        -> any logged-in user may SET; DELETE denied for the counters,
//           and errlog: DELETE is admin-only (admin clears crash groups)
//   feedback: / faqq:
//        -> any logged-in user may CREATE; EDIT/DELETE only by the row's
//           owner (any of several owner fields) or an admin
//   bank: / announcement: / faq: / qgate:
//        -> admins only  (bank: = question sets — RESTRUCTURED to admin-only
//           uploads so answer keys stay trustworthy; qgate: = the content
//           quality gate's hidden-id list; all world-readable, admin-write-only)
//   anything else -> DENIED (fail closed)
//
// BUG-04 — analytics:user: and errlog: were added here. Both were written as
// `shared` by the client (engagement summaries + crash-report groups) but were
// NOT in this matrix, so post-Stage-2 the broker fail-closed (403) on them and
// the Admin Panel's Engagement + Crash-Report sections never received data.
//
// DEPLOY:
//   supabase secrets set SESSION_SIGNING_SECRET="<same value as auth-secure>"
//   supabase functions deploy kv-write --no-verify-jwt
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

// ---- token verification (mirror of auth-secure's mintToken) ----
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

// ---- helpers against kv_shared / admin list (service-role) ----
async function isAdmin(s: Session): Promise<boolean> {
  const ids = [s.id, s.uid].filter(Boolean).map((v) => encodeURIComponent(String(v)));
  if (!ids.length) return false;
  const url = `${SUPABASE_URL}/rest/v1/admin_profile_ids?profile_id=in.(${ids.join(",")})&select=profile_id`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function getRow(key: string): Promise<Record<string, unknown> | null> {
  const url = `${SUPABASE_URL}/rest/v1/kv_shared?key=eq.${encodeURIComponent(key)}&select=value`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  try { return JSON.parse(String(rows[0].value)); } catch { return {}; }
}

// Candidate owner fields, to stay robust to each content type's shape
// (banks/feedback/faqq stamp the author under different names).
const OWNER_FIELDS = ["ownerId", "ownerUid", "createdBy", "createdByUid", "authorId", "authorUid", "profileId", "uid"];
function rowOwnedBy(row: Record<string, unknown> | null, s: Session): boolean {
  if (!row) return false;
  for (const f of OWNER_FIELDS) {
    const v = row[f];
    if (v != null && (String(v) === s.id || (s.uid && String(v) === s.uid))) return true;
  }
  return false;
}

async function writeRow(key: string, value: string): Promise<Response> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_shared`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ key, value: String(value) }),
  });
  if (!r.ok) return json({ error: `write failed: ${r.status}` }, 502);
  return json({ ok: true });
}
async function deleteRow(key: string): Promise<Response> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_shared?key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE", headers: dbHeaders({ Prefer: "return=minimal" }),
  });
  if (!r.ok && r.status !== 404) return json({ error: `delete failed: ${r.status}` }, 502);
  return json({ ok: true });
}

// suffix after the first prefix, e.g. ownerSuffix("profile:abc","profile:") -> "abc"
function suffix(key: string, prefix: string): string { return key.slice(prefix.length); }

// ---- rate limiting (PROMPT 21) -------------------------------------
// Same fixed-window limiter as auth-secure, backed by the shared auth_rate
// table + rate_hit() RPC (supabase/auth-rate.sql). Used here ONLY to cap admin
// panel data writes (announcement:/faq:) at 20/hour per admin id. Fails OPEN so
// a limiter blip never blocks a legitimate admin.
async function rateHit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_hit`, {
      method: "POST",
      headers: dbHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify({
        p_bucket: bucket,
        p_identifier: identifier || "unknown",
        p_limit: limit,
        p_window_seconds: windowSeconds,
      }),
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
function formatWait(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.ceil(seconds / 3600);
    return h === 1 ? "about an hour" : `about ${h} hours`;
  }
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return m === 1 ? "about a minute" : `about ${m} minutes`;
  }
  return `${Math.max(1, seconds)} second${seconds === 1 ? "" : "s"}`;
}
function tooMany(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      reason: "rate-limited",
      retryAfter,
      message: `Too many admin writes. Please wait ${formatWait(retryAfter)} and try again.`,
    }),
    {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.max(1, retryAfter)) },
    },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET) return json({ error: "SESSION_SIGNING_SECRET is not set on kv-write" }, 500);

  let body: { op?: string; key?: string; value?: string; token?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const op = body.op === "del" ? "del" : "set";
  const key = String(body.key ?? "");
  if (!key) return json({ error: "Missing key" }, 400);

  // 1) Authenticate.
  const session = await verifyToken(body.token);
  if (!session) return json({ error: "Not authenticated" }, 401);

  try {
    const admin = await isAdmin(session);

    // 2) Owner-scoped private keys: id suffix must match (admins may moderate).
    // analytics:user:<id> — each user writes ONLY their own engagement summary.
    const OWNER_PREFIXES = ["profile:", "profilemeta:", "myfeedback:", "leaderboard:", "favorder:", "analytics:user:"];
    for (const p of OWNER_PREFIXES) {
      if (key.startsWith(p)) {
        if (admin || suffix(key, p) === session.id) {
          return op === "del" ? await deleteRow(key) : await writeRow(key, String(body.value ?? ""));
        }
        return json({ error: "Forbidden: not your row" }, 403);
      }
    }

    // 3) Admin-only keys.
    if (key.startsWith("announcement:") || key.startsWith("faq:") || key.startsWith("qgate:")) {
      if (!admin) return json({ error: "Forbidden: admin only" }, 403);
      // Cap admin panel data writes at 20/hour per admin id (PROMPT 21).
      const rl = await rateHit("admin-write", session.id, 20, 60 * 60);
      if (!rl.allowed) return tooMany(rl.retryAfter);
      return op === "del" ? await deleteRow(key) : await writeRow(key, String(body.value ?? ""));
    }

    // 4) Community counters: any logged-in user may SET; never DELETE.
    if (key.startsWith("helpful:") || key.startsWith("notHelpful:") || key.startsWith("favsec:")) {
      if (op === "del") return json({ error: "Forbidden: counters are not deletable" }, 403);
      return await writeRow(key, String(body.value ?? ""));
    }

    // 4b) Crash-report groups (BUG-04): any logged-in user may SET (report a
    // crash signature; the group is keyed by signature, not by user, so users
    // share + increment the same row). DELETE is admin-only — admins clear or
    // resolve groups from the Crash Reports section. (Resolve is itself a SET.)
    if (key.startsWith("errlog:")) {
      if (op === "del") {
        if (!admin) return json({ error: "Forbidden: admin only" }, 403);
        return await deleteRow(key);
      }
      return await writeRow(key, String(body.value ?? ""));
    }

    // 5) Question banks: ADMIN ONLY. Restructured so only admins upload / edit /
    // delete shared question SETS (content authority — keeps every answer key
    // trustworthy). Was "any logged-in user may create". No per-write rate cap
    // here (unlike announcement:/faq:) so an admin can bulk-seed in one session.
    if (key.startsWith("bank:")) {
      if (!admin) return json({ error: "Forbidden: admin only" }, 403);
      return op === "del" ? await deleteRow(key) : await writeRow(key, String(body.value ?? ""));
    }

    // 6) Other user-created content: create = any logged-in; edit/delete = owner
    // or admin. (feedback: = question/bug reports — feeds the quality gate;
    // faqq: = community FAQ questions. Neither is a question-set upload, so both
    // stay open to logged-in users.)
    if (key.startsWith("feedback:") || key.startsWith("faqq:")) {
      const existing = await getRow(key);
      if (existing && !admin && !rowOwnedBy(existing, session)) {
        return json({ error: "Forbidden: not your content" }, 403);
      }
      return op === "del" ? await deleteRow(key) : await writeRow(key, String(body.value ?? ""));
    }

    // 7) Fail closed on anything unclassified.
    return json({ error: `Forbidden: unrecognized key '${key}'` }, 403);
  } catch (e) {
    return json({ error: `server error: ${(e as Error).message ?? e}` }, 500);
  }
});
