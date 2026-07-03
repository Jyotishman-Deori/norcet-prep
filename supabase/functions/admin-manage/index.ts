// =====================================================================
// supabase/functions/admin-manage/index.ts
// Secure admin-management endpoint for NORCET Prep.
//
// WHY: the public app can only READ admin_profile_ids (anon select). All
// WRITES go through here. The passphrase is verified SERVER-SIDE, and the
// row is written with the service-role key — which bypasses RLS and never
// reaches the browser. This is what makes the lockdown actually secure.
//
// DEPLOY:
//   supabase functions deploy admin-manage --no-verify-jwt
// SET THE SECRET (this is the passphrase users type in the app):
//   supabase secrets set ADMIN_PASSPHRASE="<your-strong-passphrase>"   # never commit the real value
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSPHRASE = Deno.env.get("ADMIN_PASSPHRASE") ?? "";
// For the token-verified actions (check-admin / list-admins) — the same
// signing secret auth-secure/kv-write use. The passphrase actions below
// work without it, so a missing secret only disables the token actions.
const SESSION_SECRET = Deno.env.get("SESSION_SIGNING_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Length-independent compare to avoid leaking the passphrase via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function dbHeaders(extra?: Record<string, string>): Record<string, string> {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, ...(extra ?? {}) };
}

// ---- session-token verification (byte-identical to kv-write) --------
// Powers check-admin / list-admins: the admin app authenticates with the
// LOGGED-IN ADMIN's signed session token, so the admin_profile_ids table
// itself no longer needs any anon SELECT policy (see lock-admin-list.sql).
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
type Session = { id: string; uid: string | null; sid: string | null };
async function verifyToken(token: unknown): Promise<Session | null> {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;
  const expected = await hmacB64(payloadB64);
  if (!safeEqual(expected, sigB64)) return null;
  let payload: { id?: string; uid?: string | null; sid?: string | null; exp?: number };
  try { payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))); }
  catch { return null; }
  if (!payload.id || typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  return {
    id: String(payload.id),
    uid: payload.uid == null ? null : String(payload.uid),
    sid: payload.sid == null ? null : String(payload.sid),
  };
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(payload.action ?? "");
  const id = String(payload.profileId ?? "").trim();
  const note = payload.note == null ? null : String(payload.note);
  const passphrase = typeof payload.passphrase === "string" ? payload.passphrase : "";

  // ---- TOKEN-verified actions (no passphrase involved) ----------------
  // check-admin: "is the LOGGED-IN caller on the allow-list?" — replaces the
  // admin app's direct anon SELECT of admin_profile_ids, so that table can be
  // fully locked (lock-admin-list.sql). Returns 200 { ok } always, so the
  // client can branch without treating "no" as a transport error.
  if (action === "check-admin") {
    if (!SESSION_SECRET) return json({ error: "Server not configured" }, 500);
    const session = await verifyToken(payload.token);
    if (!session) return json({ ok: false });
    return json({ ok: await isAdmin(session) });
  }
  // list-admins: the Manage Admins screen's read — admins only.
  if (action === "list-admins") {
    if (!SESSION_SECRET) return json({ error: "Server not configured" }, 500);
    const session = await verifyToken(payload.token);
    if (!session) return json({ error: "Not authenticated" }, 401);
    if (!(await isAdmin(session))) return json({ error: "Forbidden: admin only" }, 403);
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_profile_ids?select=profile_id,note,added_at&order=added_at.asc.nullslast`,
      { headers: dbHeaders({ Accept: "application/json" }) },
    );
    if (!r.ok) return json({ error: `list failed: ${r.status}` }, 502);
    const rows = await r.json();
    return json({ ok: true, admins: Array.isArray(rows) ? rows : [] });
  }

  // ---- server-side auth: the passphrase is the gate, checked HERE ----
  if (!ADMIN_PASSPHRASE) return json({ error: "Server not configured" }, 500);
  const passOk = safeEqual(passphrase, ADMIN_PASSPHRASE);

  // "verify" is a yes/no check used to UNLOCK the admin UI. It returns the
  // result with a 200 (never 401) so the frontend can branch on { ok } — and
  // no passphrase or hash needs to live in the frontend at all.
  if (action === "verify") return json({ ok: passOk });

  // add / remove require a correct passphrase.
  if (!passOk) return json({ error: "Wrong passphrase" }, 401);

  if (action === "add") {
    if (!id) return json({ error: "Missing profileId" }, 400);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_profile_ids`, {
      method: "POST",
      headers: dbHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({ profile_id: id, note }),
    });
    if (!r.ok) return json({ error: `add failed: ${r.status} ${await r.text().catch(() => "")}`.trim() }, 502);
    return json({ ok: true });
  }

  if (action === "remove") {
    if (!id) return json({ error: "Missing profileId" }, 400);
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_profile_ids?profile_id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers: dbHeaders() },
    );
    if (!r.ok && r.status !== 404) return json({ error: `remove failed: ${r.status}` }, 502);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});