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

// ---- single concurrent session ("last one wins") — mirror of kv-write ----
// Flag-gated (game_config security.singleSession, cached 60s per isolate),
// NULL DB sid always passes, every failure fails OPEN. See kv-write for the
// full policy rationale.
let _ssFlag: { v: boolean; ts: number } | null = null;
async function singleSessionEnabled(): Promise<boolean> {
  if (_ssFlag && Date.now() - _ssFlag.ts < 60_000) return _ssFlag.v;
  let v = false;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/kv_shared?key=eq.game_config&select=value`,
      { headers: dbHeaders({ Accept: "application/json" }) },
    );
    if (r.ok) {
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) {
        const cfg = JSON.parse(String(rows[0].value));
        v = !!(cfg && cfg.security && cfg.security.singleSession === true);
      }
    }
  } catch { /* fail-open */ }
  _ssFlag = { v, ts: Date.now() };
  return v;
}
async function sessionSidOk(s: Session): Promise<boolean> {
  if (!(await singleSessionEnabled())) return true;
  try {
    const q = s.uid
      ? `uid=eq.${encodeURIComponent(s.uid)}`
      : `id=eq.${encodeURIComponent(s.id)}`;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profile_secrets?${q}&select=active_session_id&limit=1`,
      { headers: dbHeaders({ Accept: "application/json" }) },
    );
    if (!r.ok) return true;
    const rows = await r.json();
    const dbSid = Array.isArray(rows) && rows.length ? rows[0].active_session_id : null;
    if (dbSid == null || dbSid === "") return true;
    return !!s.sid && safeEqual(String(s.sid), String(dbSid));
  } catch {
    return true;
  }
}
function sessionExpired(): Response {
  return json({ error: "SESSION_EXPIRED", message: "Logged in from another device" }, 401);
}
// STAFF ROLES (Admin > Co-Admin > Moderator; supabase/admin-roles.sql).
// Role is read from the DB PER ACTION (never from the token) so a demotion
// bites on the target's next call. LEGACY FALLBACK: before the migration the
// role column doesn't exist — membership then counts as 'coadmin', so
// deploying this ahead of the SQL changes nothing.
type StaffRole = "admin" | "coadmin" | "moderator";
const ROLE_RANK: Record<StaffRole, number> = { admin: 3, coadmin: 2, moderator: 1 };
async function roleOf(s: Session): Promise<StaffRole | null> {
  const ids = [s.id, s.uid].filter(Boolean).map((v) => encodeURIComponent(String(v)));
  if (!ids.length) return null;
  const base = `${SUPABASE_URL}/rest/v1/admin_profile_ids?profile_id=in.(${ids.join(",")})`;
  let r = await fetch(`${base}&select=profile_id,role`, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) r = await fetch(`${base}&select=profile_id`, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  let best = 0;
  for (const row of rows) {
    const rank = row && row.role ? (ROLE_RANK[row.role as StaffRole] ?? 2) : 2;
    if (rank > best) best = rank;
  }
  return best >= 3 ? "admin" : best === 2 ? "coadmin" : "moderator";
}
const atLeast = (role: StaffRole | null, min: StaffRole): boolean =>
  !!role && ROLE_RANK[role] >= ROLE_RANK[min];

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
  // Single concurrent session (flag-gated; see sessionSidOk above).
  if (!(await sessionSidOk(session))) return sessionExpired();

  try {
    const role = await roleOf(session);
    // "admin" = Co-Admin or above; moderator carve-outs are per-prefix:
    //   myfeedback:/feedback: — community control IS the moderator job.
    //   errlog: — "basic logs" per the role spec.
    //   profile:/analytics:/adminlog: — stay Co-Admin+ (private data / audit).
    const admin = atLeast(role, "coadmin");
    const crossFor = (p: string): boolean =>
      (p === "myfeedback:" || p === "feedback:" || p === "errlog:")
        ? atLeast(role, "moderator") : admin;

    // ---- GET one key ----
    if (body.op === "get") {
      const key = String(body.key ?? "");
      // owner-scoped: suffix match or staff cross-read (tier per prefix)
      const os = prefixFrom(OWNER_SCOPED, key);
      if (os) {
        if (!crossFor(os) && suffix(key, os) !== session.id) return json({ error: "Forbidden: not your row" }, 403);
        return await getValueResponse(key);
      }
      // owned-content: staff (tier per prefix), or the row's author
      const oc = prefixFrom(OWNED_CONTENT, key);
      if (oc) {
        if (!crossFor(oc) && !rowOwnedBy(await getRowParsed(key), session)) return json({ error: "Forbidden: not your content" }, 403);
        return await getValueResponse(key);
      }
      // staff-only (tier per prefix)
      const ao = prefixFrom(ADMIN_ONLY, key);
      if (ao) {
        if (!crossFor(ao)) return json({ error: "Forbidden: staff only" }, 403);
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
      // owned-content: staff sees all (tier per prefix); students their own.
      const oc = prefixFrom(OWNED_CONTENT, prefix);
      if (oc) {
        if (crossFor(oc)) return json({ keys: (await listRows(oc, false)).map((x) => x.key) });
        const mine = (await listRows(oc, true)).filter((r) => {
          try { return rowOwnedBy(JSON.parse(String(r.value ?? "{}")), session); } catch { return false; }
        });
        return json({ keys: mine.map((x) => x.key) });
      }
      // staff-only: everything for the right tier, nothing for anyone else.
      const ao = prefixFrom(ADMIN_ONLY, prefix);
      if (ao) {
        if (!crossFor(ao)) return json({ keys: [] });
        return json({ keys: (await listRows(ao, false)).map((x) => x.key) });
      }
      return json({ error: "Forbidden: not a broker-served prefix" }, 403);
    }

    return json({ error: "Unknown op" }, 400);
  } catch (e) {
    return json({ error: `server error: ${(e as Error).message ?? e}` }, 500);
  }
});
