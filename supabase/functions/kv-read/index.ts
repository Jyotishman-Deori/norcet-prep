// =====================================================================
// supabase/functions/kv-read/index.ts
// The READ BROKER for NORCET Prep  (Stage 3 / C-1 confidentiality half).
//
// WHY: even after Stage 1/2 moved hashes out and locked WRITES, the anon
// key could still SELECT every row of kv_shared — so any visitor could read
// every user's `profile:<id>` blob (full study history, exam dates, etc.).
// Stage 3 closes the anon SELECT on PRIVATE prefixes and serves them ONLY
// to their owner through this function, which holds the service-role key
// and authorizes by the same signed session token kv-write uses.
//
// READS SERVED HERE (not anon-SELECTable — served by this broker only):
//   profile:      -> owner (token.id === <id> suffix) or admin           [owner-scoped]
//   myfeedback:   -> owner or admin                                       [owner-scoped]
//   feedback:     -> the row's AUTHOR (value.profileId === caller) or admin.
//                    LIST: admin = all; a student = only their own rows.   [owned-content]
//   errlog:       -> ADMIN only (crash stacks — internal)                  [admin-only]
//   analytics:    -> ADMIN only (engagement summaries)                     [admin-only]
//   adminlog:     -> ADMIN only (privileged-action audit log)              [admin-only]
// READS THAT STAY ON THE DIRECT ANON PATH (still anon-SELECTable, by design):
//   announcement:, bank:, faq:, faqq:, qgate:, trend:, favsec:, favorder:,
//   helpful:, notHelpful:, leaderboard:, profilemeta:  (public content +
//   display-name/timestamps the profile switcher needs — no secrets)
//
// Supports op:"get" (one key) and op:"list" (prefix -> keys). Owner-scoped
// prefixes list only the caller's own key; owned-content lists the caller's
// own rows (or all, for an admin); admin-only lists everything (admin) or [].
//
// DEPLOY:
//   supabase secrets set SESSION_SIGNING_SECRET="<same value as the others>"
//   supabase functions deploy kv-read --no-verify-jwt
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

// ---- token verification: byte-identical to kv-write ----
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

// Prefix categories (see header). Order of checks: owner-scoped → owned-content
// → admin-only → deny.
const OWNER_SCOPED = ["profile:", "myfeedback:"];   // 1 row per user, keyed by id
const OWNED_CONTENT = ["feedback:"];                // author-owned, admin-moderated
const ADMIN_ONLY = ["errlog:", "analytics:", "adminlog:"]; // internal, admin eyes only
function prefixFrom(list: string[], s: string): string | null {
  return list.find((p) => s.startsWith(p)) ?? null;
}
function suffix(key: string, prefix: string): string { return key.slice(prefix.length); }

// Which author fields mark ownership of an owned-content row (mirror of kv-write).
const OWNER_FIELDS = ["profileId", "ownerId", "ownerUid", "authorId", "authorUid", "uid"];
function rowOwnedBy(row: Record<string, unknown> | null, s: Session): boolean {
  if (!row) return false;
  for (const f of OWNER_FIELDS) {
    const v = row[f];
    if (v != null && (String(v) === s.id || (s.uid && String(v) === s.uid))) return true;
  }
  return false;
}

// ---- service-role fetch helpers ----
async function getValueResponse(key: string): Promise<Response> {
  const url = `${SUPABASE_URL}/rest/v1/kv_shared?key=eq.${encodeURIComponent(key)}&select=value`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return json({ error: `read ${r.status}` }, 502);
  const rows = await r.json();
  return json({ value: Array.isArray(rows) && rows.length ? rows[0].value : null });
}
async function getRowParsed(key: string): Promise<Record<string, unknown> | null> {
  const url = `${SUPABASE_URL}/rest/v1/kv_shared?key=eq.${encodeURIComponent(key)}&select=value`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  try { return JSON.parse(String(rows[0].value)); } catch { return {}; }
}
async function listRows(prefix: string, withValue: boolean): Promise<{ key: string; value?: string }[]> {
  const sel = withValue ? "key,value" : "key";
  const url = `${SUPABASE_URL}/rest/v1/kv_shared?key=like.${encodeURIComponent(prefix + "*")}&select=${sel}`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET) return json({ error: "SESSION_SIGNING_SECRET is not set on kv-read" }, 500);

  let body: { op?: string; key?: string; prefix?: string; token?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const session = await verifyToken(body.token);
  if (!session) return json({ error: "Not authenticated" }, 401);

  try {
    const admin = await isAdmin(session);

    // ---- GET one key ----
    if (body.op === "get") {
      const key = String(body.key ?? "");
      // owner-scoped: suffix match or admin
      const os = prefixFrom(OWNER_SCOPED, key);
      if (os) {
        if (!admin && suffix(key, os) !== session.id) return json({ error: "Forbidden: not your row" }, 403);
        return await getValueResponse(key);
      }
      // owned-content: admin, or the row's author
      const oc = prefixFrom(OWNED_CONTENT, key);
      if (oc) {
        if (!admin && !rowOwnedBy(await getRowParsed(key), session)) return json({ error: "Forbidden: not your content" }, 403);
        return await getValueResponse(key);
      }
      // admin-only
      const ao = prefixFrom(ADMIN_ONLY, key);
      if (ao) {
        if (!admin) return json({ error: "Forbidden: admin only" }, 403);
        return await getValueResponse(key);
      }
      return json({ error: "Forbidden: not a broker-served key" }, 403);
    }

    // ---- LIST keys under a prefix ----
    if (body.op === "list") {
      const raw = String(body.prefix ?? "");
      const prefix = raw.endsWith(":") ? raw : raw + ":";
      // owner-scoped: only THIS user's key exists for them (1 row per user).
      const os = prefixFrom(OWNER_SCOPED, prefix);
      if (os) {
        const rows = await listRows(`${os}${session.id}`, false);
        return json({ keys: rows.map((x) => x.key) });
      }
      // owned-content: admin sees all; a student sees only their own rows.
      const oc = prefixFrom(OWNED_CONTENT, prefix);
      if (oc) {
        if (admin) return json({ keys: (await listRows(oc, false)).map((x) => x.key) });
        const mine = (await listRows(oc, true)).filter((r) => {
          try { return rowOwnedBy(JSON.parse(String(r.value ?? "{}")), session); } catch { return false; }
        });
        return json({ keys: mine.map((x) => x.key) });
      }
      // admin-only: everything for an admin, nothing for anyone else.
      const ao = prefixFrom(ADMIN_ONLY, prefix);
      if (ao) {
        if (!admin) return json({ keys: [] });
        return json({ keys: (await listRows(ao, false)).map((x) => x.key) });
      }
      return json({ error: "Forbidden: not a broker-served prefix" }, 403);
    }

    return json({ error: "Unknown op" }, 400);
  } catch (e) {
    return json({ error: `server error: ${(e as Error).message ?? e}` }, 500);
  }
});
