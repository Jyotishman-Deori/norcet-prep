// =====================================================================
// supabase/functions/admin-manage/index.ts
// Staff-governance endpoint for NurseHolic (roles: Admin > Co-Admin >
// Moderator — see supabase/admin-roles.sql and the journal's "Role
// hierarchy" spec).
//
// WHY: all writes to admin_profile_ids go through here. Two locks stack on
// every write: the ADMIN_PASSPHRASE (verified server-side) AND the caller's
// signed session token (so the ACTOR is known and the promotion ceiling /
// self-protection / owner-lock rules can be enforced + audited).
//
// GOVERNANCE RULES (server-enforced, mirrors the owner's spec):
//   • roleOf(caller) is read from the DB per call — never from the token —
//     so demotions bite on the very next action.
//   • Promotion ceiling: you may grant/set only roles BELOW your own
//     (admin → coadmin|moderator; coadmin → moderator; moderator → nothing).
//   • Self-protection: you cannot remove or change your own rows.
//   • Owner-lock: the 'admin' (owner) rows cannot be removed or demoted by
//     ANYONE — ownership moves only via transfer-ownership (atomic RPC).
//   • Every staff change writes a server-stamped adminlog: audit row with
//     the actor, target, and the supplied reason.
//
// DEPLOY:
//   supabase functions deploy admin-manage --no-verify-jwt
// SECRETS: ADMIN_PASSPHRASE, SESSION_SIGNING_SECRET (already set).
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSPHRASE = Deno.env.get("ADMIN_PASSPHRASE") ?? "";
// Staff key: Co-Admins/Moderators type THIS for staff-management changes,
// never the owner's key (owner decision 2026-07-07). Owner keeps
// ADMIN_PASSPHRASE. Which one applies is decided by the ACTOR's role.
const STAFF_PASSPHRASE = Deno.env.get("STAFF_PASSPHRASE") ?? "";
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

// ---- rate limiting (SEC-035) ----------------------------------------
// Same fixed-window limiter auth-secure uses: the locked auth_rate table +
// rate_hit() RPC (supabase/auth-rate.sql). FAILS OPEN — a limiter/DB blip must
// never lock staff out. Used to cap the 2FA code check (a 6-digit brute-force
// oracle otherwise) and the passphrase compare.
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
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
    if (!r.ok) return { allowed: true, retryAfter: 0 }; // fail OPEN
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { allowed: true, retryAfter: 0 };
    return { allowed: !!row.allowed, retryAfter: Number(row.retry_after) || 0 };
  } catch {
    return { allowed: true, retryAfter: 0 }; // fail OPEN on any limiter error
  }
}
function tooMany(retryAfter: number): Response {
  return json({ ok: false, reason: "rate-limited", retryAfter,
    message: `Too many attempts. Please wait a moment and try again.` }, 429);
}

// ---- session-token verification (byte-identical to kv-write) --------
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

// ---- STAFF ROLES ------------------------------------------------------
type StaffRole = "admin" | "coadmin" | "moderator";
const ROLE_RANK: Record<StaffRole, number> = { admin: 3, coadmin: 2, moderator: 1 };
const rankToRole = (n: number): StaffRole | null =>
  n >= 3 ? "admin" : n === 2 ? "coadmin" : n === 1 ? "moderator" : null;

type StaffRow = { profile_id: string; role: StaffRole | null; note?: string | null; added_at?: string | null };

// All staff rows (tolerates the pre-migration table without a role column —
// rows then read as role:null = legacy 'coadmin').
async function listStaff(): Promise<StaffRow[]> {
  let r = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_profile_ids?select=profile_id,note,added_at,role&order=added_at.asc.nullslast`,
    { headers: dbHeaders({ Accept: "application/json" }) },
  );
  if (!r.ok) {
    r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_profile_ids?select=profile_id,note,added_at&order=added_at.asc.nullslast`,
      { headers: dbHeaders({ Accept: "application/json" }) },
    );
    if (!r.ok) throw new Error(`list failed: ${r.status}`);
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((x: Record<string, unknown>) => ({ ...x, role: null } as StaffRow));
  }
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

// Caller's highest role across their id+uid rows. null = not staff.
async function roleOf(s: Session): Promise<StaffRole | null> {
  const idset = new Set([s.id, s.uid].filter(Boolean).map(String));
  if (!idset.size) return null;
  let best = 0;
  try {
    const rows = await listStaff();
    for (const row of rows) {
      if (!idset.has(row.profile_id)) continue;
      const rank = row.role ? (ROLE_RANK[row.role] ?? 2) : 2; // legacy null = coadmin
      if (rank > best) best = rank;
    }
  } catch { return null; }
  return rankToRole(best);
}
const atLeast = (role: StaffRole | null, min: StaffRole): boolean =>
  !!role && ROLE_RANK[role] >= ROLE_RANK[min];

// ---- TOTP (RFC 6238, SHA-1/30s/6 digits — Google Authenticator) -------
// The secret lives ONLY in profile_secrets.totp_secret (service-role-only
// table; see supabase/admin-2fa.sql). "pending:"-prefixed until the first
// valid code confirms the enrolment.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function b32decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
async function hotp(secretB32: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", b32decode(secretB32), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(counter));
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const off = h[h.length - 1] & 0xf;
  const code = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(code % 1_000_000).padStart(6, "0");
}
// ±1 time-step window (90s of clock drift tolerance).
async function totpCheck(secretB32: string, code: string): Promise<boolean> {
  const c = String(code || "").replace(/\D/g, "");
  if (c.length !== 6) return false;
  const step = Math.floor(Date.now() / 30_000);
  for (const s of [step, step - 1, step + 1]) {
    if (safeEqual(await hotp(secretB32, s), c)) return true;
  }
  return false;
}
// Read/write the caller's totp_secret (profile_secrets is keyed by the slug
// id; fall back to the uid column for safety). Returns null when unset OR
// when the column doesn't exist yet (admin-2fa.sql not run) — callers then
// surface a clear "run the migration" error on enrol.
async function totpRead(s: Session): Promise<string | null> {
  for (const q of [s.id ? `id=eq.${encodeURIComponent(s.id)}` : null, s.uid ? `uid=eq.${encodeURIComponent(s.uid)}` : null]) {
    if (!q) continue;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/profile_secrets?${q}&select=totp_secret&limit=1`,
        { headers: dbHeaders({ Accept: "application/json" }) });
      if (!r.ok) return null; // column missing pre-migration → treat as unset
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) return rows[0].totp_secret || null;
    } catch { return null; }
  }
  return null;
}
async function totpWrite(s: Session, value: string | null): Promise<boolean> {
  for (const q of [s.id ? `id=eq.${encodeURIComponent(s.id)}` : null, s.uid ? `uid=eq.${encodeURIComponent(s.uid)}` : null]) {
    if (!q) continue;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profile_secrets?${q}`, {
      method: "PATCH",
      headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=representation", Accept: "application/json" }),
      body: JSON.stringify({ totp_secret: value }),
    });
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      if (Array.isArray(rows) && rows.length) return true;
    }
  }
  return false;
}

// ---- server-stamped audit row (adminlog: convention) -----------------
async function audit(actor: Session, action: string, target: string, detail: string | null): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const entry = {
      id, action, target, targetName: null,
      detail: detail || null,
      actorName: null, actorId: actor.id, actorUid: actor.uid, ts: Date.now(),
    };
    await fetch(`${SUPABASE_URL}/rest/v1/kv_shared`, {
      method: "POST",
      headers: dbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ key: `adminlog:${id}`, value: JSON.stringify(entry) }),
    });
  } catch { /* audit is best-effort; the action itself already succeeded */ }
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
  const reason = payload.reason == null ? null : String(payload.reason).slice(0, 300);
  const passphrase = typeof payload.passphrase === "string" ? payload.passphrase : "";

  // ---- TOKEN-verified reads -------------------------------------------
  // check-admin: is the LOGGED-IN caller staff, and at what tier? The admin
  // app boots on this. { ok:false } for non-staff (200, so clients branch).
  if (action === "check-admin") {
    if (!SESSION_SECRET) return json({ error: "Server not configured" }, 500);
    const session = await verifyToken(payload.token);
    if (!session) return json({ ok: false });
    const role = await roleOf(session);
    if (!role) return json({ ok: false });
    // 2FA status rides along so the admin app knows whether to show the
    // enrolment screen or the 6-digit gate: 'confirmed' | 'pending' | 'none'.
    const sec = await totpRead(session);
    const totp = !sec ? "none" : sec.startsWith("pending:") ? "pending" : "confirmed";
    return json({ ok: true, role, totp });
  }

  // ---- 2FA (token-verified; staff only) --------------------------------
  // totp-enroll: mint a fresh secret (or replace an unconfirmed one) and
  // return the otpauth:// URI for the authenticator app. Refuses to replace
  // a CONFIRMED secret — the owner clears it first (totp-reset) so a stolen
  // session can't silently re-key someone's 2FA.
  if (action === "totp-enroll") {
    if (!SESSION_SECRET) return json({ error: "Server not configured" }, 500);
    const session = await verifyToken(payload.token);
    if (!session) return json({ error: "Not authenticated" }, 401);
    const role = await roleOf(session);
    if (!role) return json({ error: "Forbidden: staff only" }, 403);
    const existing = await totpRead(session);
    if (existing && !existing.startsWith("pending:")) {
      return json({ error: "2FA is already set up — ask the owner to reset it first" }, 409);
    }
    const raw = new Uint8Array(20);
    crypto.getRandomValues(raw);
    const secret = b32encode(raw);
    if (!(await totpWrite(session, `pending:${secret}`))) {
      return json({ error: "Could not save the 2FA secret (has admin-2fa.sql been run?)" }, 502);
    }
    const label = encodeURIComponent(`NurseHolic Admin:${session.id}`);
    // SHA1 / 6 digits / 30s are the otpauth spec DEFAULTS — every authenticator
    // app assumes them, so we omit them to keep the URI short (a shorter URI =
    // a lower-version, denser-free QR that scans more reliably). totp-verify
    // computes from the stored secret with the same defaults, never this URI.
    return json({
      ok: true, secret,
      otpauth: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("NurseHolic Admin")}`,
    });
  }
  // totp-verify: check a 6-digit code; the first valid code CONFIRMS a
  // pending enrolment. Brute-force capped per staff account (SEC-035): 10
  // wrong codes / 15 min. Without this a stolen session token could grind the
  // 10^6 space (×3 with the ±1 window) at full speed.
  if (action === "totp-verify") {
    if (!SESSION_SECRET) return json({ error: "Server not configured" }, 500);
    const session = await verifyToken(payload.token);
    if (!session) return json({ error: "Not authenticated" }, 401);
    if (!(await roleOf(session))) return json({ error: "Forbidden: staff only" }, 403);
    const rl = await rateHit("admin-totp-verify", session.id || clientIp(req), 10, 15 * 60);
    if (!rl.allowed) return tooMany(rl.retryAfter);
    const stored = await totpRead(session);
    if (!stored) return json({ ok: false, reason: "not-enrolled" });
    const secret = stored.startsWith("pending:") ? stored.slice(8) : stored;
    if (!(await totpCheck(secret, String(payload.code ?? "")))) {
      return json({ ok: false, reason: "bad-code" });
    }
    if (stored.startsWith("pending:")) await totpWrite(session, secret); // confirm
    return json({ ok: true });
  }
  // list-admins: the Manage Admins screen's read — Co-Admin and above
  // (moderators don't see staff governance at all).
  if (action === "list-admins") {
    if (!SESSION_SECRET) return json({ error: "Server not configured" }, 500);
    const session = await verifyToken(payload.token);
    if (!session) return json({ error: "Not authenticated" }, 401);
    const role = await roleOf(session);
    if (!atLeast(role, "coadmin")) return json({ error: "Forbidden: co-admin or above" }, 403);
    try {
      const rows = await listStaff();
      return json({ ok: true, admins: rows, callerRole: role });
    } catch (e) { return json({ error: String((e as Error).message ?? e) }, 502); }
  }
  // resolve-profiles: admin-only name lookup (id/uid → display_name via
  // profile_secrets — the only table mapping BOTH). Never returns secrets.
  if (action === "resolve-profiles") {
    if (!SESSION_SECRET) return json({ error: "Server not configured" }, 500);
    const session = await verifyToken(payload.token);
    if (!session) return json({ error: "Not authenticated" }, 401);
    if (!atLeast(await roleOf(session), "coadmin")) return json({ error: "Forbidden: co-admin or above" }, 403);
    const rawIds = Array.isArray(payload.ids) ? payload.ids : [];
    const ids = rawIds.map((v) => String(v).trim()).filter(Boolean).slice(0, 100);
    if (!ids.length) return json({ ok: true, profiles: [] });
    const quoted = ids.map((v) => `"${encodeURIComponent(v)}"`).join(",");
    const url = `${SUPABASE_URL}/rest/v1/profile_secrets?or=(id.in.(${quoted}),uid.in.(${quoted}))&select=id,uid,display_name`;
    const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
    if (!r.ok) return json({ error: `resolve failed: ${r.status}` }, 502);
    const rows = await r.json();
    return json({ ok: true, profiles: Array.isArray(rows) ? rows : [] });
  }

  // ---- passphrase gate (all writes below) ------------------------------
  if (!ADMIN_PASSPHRASE) return json({ error: "Server not configured" }, 500);

  // "verify" unlocks the admin UI — 200 { ok } either way. No token context
  // here, so either key counts (the real writes below are role-matched).
  // Rate-limited per IP (SEC-035) so the two passphrases can't be ground out.
  if (action === "verify") {
    const rl = await rateHit("admin-verify", clientIp(req), 10, 15 * 60);
    if (!rl.allowed) return tooMany(rl.retryAfter);
    return json({ ok: safeEqual(passphrase, ADMIN_PASSPHRASE) || (!!STAFF_PASSPHRASE && safeEqual(passphrase, STAFF_PASSPHRASE)) });
  }

  // Writes require the actor's token FIRST: governance rules need to know WHO
  // is acting — and WHICH passphrase applies. The OWNER types the owner key
  // (ADMIN_PASSPHRASE); Co-Admins type the STAFF key (STAFF_PASSPHRASE) and
  // the owner key is never shared with them.
  const session = await verifyToken(payload.token);
  if (!session) return json({ error: "Not authenticated (session token required)" }, 401);
  const actorRole = await roleOf(session);
  if (!atLeast(actorRole, "coadmin")) return json({ error: "Forbidden: co-admin or above" }, 403);
  const passOk = actorRole === "admin"
    ? safeEqual(passphrase, ADMIN_PASSPHRASE)
    : (!!STAFF_PASSPHRASE && safeEqual(passphrase, STAFF_PASSPHRASE));
  if (!passOk) {
    return json({ error: actorRole === "admin" ? "Wrong passphrase" : "Wrong staff passphrase" }, 401);
  }
  const actorIds = new Set([session.id, session.uid].filter(Boolean).map(String));

  // totp-reset — OWNER ONLY: clear a locked-out staffer's 2FA so they can
  // re-enrol on next login. Audited.
  if (action === "totp-reset") {
    if (actorRole !== "admin") return json({ error: "Forbidden: only the owner can reset 2FA" }, 403);
    if (!id) return json({ error: "Missing profileId" }, 400);
    await totpWrite({ id, uid: id, sid: null }, null);
    await audit(session, "totp-reset", id, reason);
    return json({ ok: true });
  }

  // Target row (for remove/set-role) + its effective role.
  const staff = await listStaff().catch(() => [] as StaffRow[]);
  const targetRow = staff.find((x) => x.profile_id === id) || null;
  const targetRole: StaffRole | null = targetRow ? (targetRow.role ?? "coadmin") : null;

  if (action === "add") {
    if (!id) return json({ error: "Missing profileId" }, 400);
    // Requested role must sit BELOW the actor's own (promotion ceiling).
    const reqRole = (String(payload.role ?? "moderator") as StaffRole);
    if (!["coadmin", "moderator"].includes(reqRole)) return json({ error: "Invalid role" }, 400);
    if (ROLE_RANK[reqRole] >= ROLE_RANK[actorRole as StaffRole]) {
      return json({ error: "Forbidden: you can only grant roles below your own" }, 403);
    }
    if (targetRow) return json({ error: "Already on the staff list — change their role instead" }, 409);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_profile_ids`, {
      method: "POST",
      headers: dbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ profile_id: id, note, role: reqRole }),
    });
    if (!r.ok) {
      // Pre-migration table (no role column): retry without it — legacy add.
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/admin_profile_ids`, {
        method: "POST",
        headers: dbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ profile_id: id, note }),
      });
      if (!r2.ok) return json({ error: `add failed: ${r2.status} ${await r2.text().catch(() => "")}`.trim() }, 502);
    }
    await audit(session, "staff-add", id, reason || `role: ${reqRole}${note ? ` · ${note}` : ""}`);
    return json({ ok: true });
  }

  if (action === "remove") {
    if (!id) return json({ error: "Missing profileId" }, 400);
    if (actorIds.has(id)) return json({ error: "Forbidden: you can't remove your own access" }, 403);
    if (!targetRow) return json({ ok: true }); // already gone
    if (targetRole === "admin") return json({ error: "Forbidden: the owner can't be removed — transfer ownership first" }, 403);
    if (ROLE_RANK[targetRole as StaffRole] >= ROLE_RANK[actorRole as StaffRole]) {
      return json({ error: "Forbidden: you can only remove roles below your own" }, 403);
    }
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_profile_ids?profile_id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers: dbHeaders() },
    );
    if (!r.ok && r.status !== 404) return json({ error: `remove failed: ${r.status}` }, 502);
    await audit(session, "staff-remove", id, reason);
    return json({ ok: true });
  }

  if (action === "set-role") {
    if (!id) return json({ error: "Missing profileId" }, 400);
    const newRole = (String(payload.role ?? "") as StaffRole);
    if (!["coadmin", "moderator"].includes(newRole)) return json({ error: "Invalid role (ownership moves via transfer)" }, 400);
    if (actorIds.has(id)) return json({ error: "Forbidden: you can't change your own role" }, 403);
    if (!targetRow) return json({ error: "Not on the staff list" }, 404);
    if (targetRole === "admin") return json({ error: "Forbidden: the owner's role only changes via ownership transfer" }, 403);
    // Ceiling on BOTH sides: current role and new role must sit below actor's.
    if (ROLE_RANK[targetRole as StaffRole] >= ROLE_RANK[actorRole as StaffRole] ||
        ROLE_RANK[newRole] >= ROLE_RANK[actorRole as StaffRole]) {
      return json({ error: "Forbidden: you can only manage roles below your own" }, 403);
    }
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_profile_ids?profile_id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({ role: newRole }),
      },
    );
    if (!r.ok) return json({ error: `set-role failed: ${r.status} (has admin-roles.sql been run?)` }, 502);
    await audit(session, "staff-role", id, reason || `→ ${newRole}`);
    return json({ ok: true });
  }

  if (action === "transfer-ownership") {
    if (!id) return json({ error: "Missing profileId" }, 400);
    if (actorRole !== "admin") return json({ error: "Forbidden: only the owner can transfer ownership" }, 403);
    if (actorIds.has(id)) return json({ error: "You already own this app" }, 400);
    if (!targetRow) return json({ error: "Target must already be on the staff list" }, 404);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_transfer_ownership`, {
      method: "POST",
      headers: dbHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify({ p_to: id }),
    });
    if (!r.ok) return json({ error: `transfer failed: ${r.status} (has admin-roles.sql been run?)` }, 502);
    const okRes = await r.json().catch(() => false);
    if (okRes !== true) return json({ error: "Transfer refused — target not on the staff list" }, 409);
    await audit(session, "ownership-transfer", id, reason);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
