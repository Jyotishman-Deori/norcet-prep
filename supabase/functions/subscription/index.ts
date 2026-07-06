// =====================================================================
// supabase/functions/subscription/index.ts
// The SUBSCRIPTION BROKER for NORCET Prep (premium tiers + family plans).
//
// Owns every read/write against the service-role-only tables created by
// supabase/subscriptions.sql (subscriptions, family_members,
// family_invites). The public anon key has ZERO access to those tables —
// this function is the only path, and it authorizes by the same signed
// session token kv-write uses. IDOR-safe by construction: the caller's
// identity comes from the VERIFIED token, never from the request body;
// the only body-supplied identity is the admin actions' target, and those
// require the caller to be on admin_profile_ids (checked server-side).
//
// PLACEHOLDER-PAYMENTS ERA: subscriptions are created only by admin-grant
// (the admin app's Users → member panel). When a real gateway lands, its
// webhook creates the same rows and every read path here works unchanged.
//
// ACTIONS (token-verified):
//   status         → caller's entitlement { active, tier, billing, role,
//                    expiresAt, seats, seatsUsed } (family membership counts)
//   invite-create  → FAMILY owner mints a single-use invite token (7-day
//                    expiry; only the SHA-256 of the token is stored)
//   invite-accept  → logged-in caller redeems a token; their independent
//                    account is linked to the paid subscription (progress,
//                    streaks and logs stay completely separate)
//   family-list    → owner: members + seat usage; member: plan summary
//   family-remove  → owner removes a member (frees the seat)
//   leave          → a member leaves the family plan
// ADMIN ACTIONS (token-verified + admin_profile_ids):
//   admin-grant    → create/update a subscription for a target account
//   admin-revoke   → cancel a target's active subscriptions
//   admin-status   → a target's entitlement + family members (Users panel)
//
// DEPLOY:
//   supabase secrets set SESSION_SIGNING_SECRET="<same value as the others>"
//   supabase functions deploy subscription --no-verify-jwt
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SESSION_SECRET = Deno.env.get("SESSION_SIGNING_SECRET") ?? "";

const FAMILY_SEATS = 6;                          // 1 owner + up to 5 members
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // invites live 7 days
const MAX_OPEN_INVITES = 10;                     // unused+unexpired per plan
const TIERS = ["SUPER", "MAX"];

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

// ---- single concurrent session ("last one wins") — mirror of kv-write ----
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

// ---- rate limiting (auth_rate table + rate_hit RPC; fails OPEN) ----
async function rateHit(bucket: string, identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_hit`, {
      method: "POST",
      headers: dbHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify({ p_bucket: bucket, p_identifier: identifier || "unknown", p_limit: limit, p_window_seconds: windowSeconds }),
    });
    if (!r.ok) return true;
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row ? !!row.allowed : true;
  } catch { return true; }
}

// ---- REST helpers over the locked tables (service-role) ----
// deno-lint-ignore no-explicit-any
async function select(table: string, query: string): Promise<any[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: dbHeaders({ Accept: "application/json" }),
  });
  if (!r.ok) throw new Error(`${table} read failed: ${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}
async function insert(table: string, body: unknown): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
}
async function patch(table: string, query: string, body: unknown): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
}
async function del(table: string, query: string): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE", headers: dbHeaders({ Prefer: "return=minimal" }),
  });
}

// The stored handle for an account: uid when it exists (rename-safe),
// else the id slug (legacy accounts without a uid).
function handleOf(uid: string | null, id: string): string { return uid || id; }
// All handles this session could be stored under (uid preferred, id legacy).
function handlesOf(s: Session): string[] {
  return [s.uid, s.id].filter(Boolean).map(String);
}
// PostgREST in.(...) filter — same encoding as kv-write's isAdmin.
function inList(vals: string[]): string {
  return `in.(${vals.map((v) => encodeURIComponent(v)).join(",")})`;
}

// deno-lint-ignore no-explicit-any
function subActive(sub: any): boolean {
  if (!sub || sub.status !== "active") return false;
  if (sub.expires_at && Date.parse(sub.expires_at) <= Date.now()) return false;
  return true;
}
// deno-lint-ignore no-explicit-any
function expMs(sub: any): number | null {
  return sub.expires_at ? Date.parse(sub.expires_at) : null;
}

// deno-lint-ignore no-explicit-any
async function membersOf(subId: string): Promise<any[]> {
  return await select("family_members", `subscription_id=eq.${encodeURIComponent(subId)}&select=member_uid,member_id,joined_at&order=joined_at.asc`);
}

// Resolve the entitlement for a set of account handles.
// Own subscription (owner role) beats family membership; MAX beats SUPER.
// deno-lint-ignore no-explicit-any
async function resolveEntitlement(handles: string[]): Promise<any> {
  if (!handles.length) return { active: false };

  const owned = (await select("subscriptions",
    `owner_uid=${inList(handles)}&select=*`)).filter(subActive);
  if (owned.length) {
    owned.sort((a, b) => (b.tier === "MAX" ? 1 : 0) - (a.tier === "MAX" ? 1 : 0));
    const sub = owned[0];
    const fam = sub.billing === "FAMILY" ? await membersOf(sub.id) : [];
    return {
      active: true, tier: sub.tier, billing: sub.billing, role: "owner",
      expiresAt: expMs(sub), seats: sub.seats,
      seatsUsed: 1 + fam.length, subscriptionId: sub.id,
    };
  }

  const memberships = await select("family_members", `member_uid=${inList(handles)}&select=subscription_id,joined_at`);
  for (const m of memberships) {
    const subs = await select("subscriptions", `id=eq.${encodeURIComponent(m.subscription_id)}&select=*`);
    const sub = subs[0];
    if (sub && subActive(sub) && sub.billing === "FAMILY") {
      return {
        active: true, tier: sub.tier, billing: "FAMILY", role: "member",
        expiresAt: expMs(sub), seats: sub.seats, ownerId: sub.owner_id || null,
        subscriptionId: sub.id,
      };
    }
  }
  return { active: false };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET) return json({ error: "SESSION_SIGNING_SECRET is not set on subscription" }, 500);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");

  // Authenticate — caller identity comes from the token ONLY.
  const session = await verifyToken(body.token);
  if (!session) return json({ error: "Not authenticated" }, 401);
  if (!(await sessionSidOk(session))) {
    return json({ error: "SESSION_EXPIRED", message: "Logged in from another device" }, 401);
  }
  const handles = handlesOf(session);
  const myHandle = handleOf(session.uid, session.id);

  try {
    // ================= status =================
    if (action === "status") {
      return json({ ok: true, premium: await resolveEntitlement(handles) });
    }

    // ================= invite-create (family owner) =================
    if (action === "invite-create") {
      const ent = await resolveEntitlement(handles);
      if (!ent.active || ent.role !== "owner" || ent.billing !== "FAMILY") {
        return json({ error: "Forbidden: no family plan to invite to" }, 403);
      }
      if (ent.seatsUsed >= ent.seats) return json({ ok: false, reason: "family-full" });
      const open = (await select("family_invites",
        `subscription_id=eq.${encodeURIComponent(ent.subscriptionId)}&used_by=is.null&select=expires_at`))
        .filter((i) => Date.parse(i.expires_at) > Date.now());
      if (open.length >= MAX_OPEN_INVITES) return json({ ok: false, reason: "too-many-invites" });
      if (!(await rateHit("family-invite", session.id, 10, 60 * 60))) {
        return json({ ok: false, reason: "rate-limited" });
      }
      // Cryptographically-random single-use token; only its hash is stored.
      const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
      const r = await insert("family_invites", {
        token_hash: await sha256Hex(raw),
        subscription_id: ent.subscriptionId,
        expires_at: expiresAt,
      });
      if (!r.ok) return json({ error: `invite failed: ${r.status}` }, 502);
      return json({ ok: true, invite: { token: raw, expiresAt: Date.parse(expiresAt) } });
    }

    // ================= invite-accept =================
    if (action === "invite-accept") {
      const raw = String(body.inviteToken ?? "").trim();
      if (!raw) return json({ ok: false, reason: "missing-token" });
      if (!(await rateHit("family-join", session.id, 10, 60 * 60))) {
        return json({ ok: false, reason: "rate-limited" });
      }
      const rows = await select("family_invites",
        `token_hash=eq.${encodeURIComponent(await sha256Hex(raw))}&select=*`);
      const inv = rows[0];
      // One generic failure for missing/used/expired — an invite token is a
      // bearer secret; we don't confirm which part failed.
      if (!inv || inv.used_by || Date.parse(inv.expires_at) <= Date.now()) {
        return json({ ok: false, reason: "invalid-invite" });
      }
      const subs = await select("subscriptions", `id=eq.${encodeURIComponent(inv.subscription_id)}&select=*`);
      const sub = subs[0];
      if (!sub || !subActive(sub) || sub.billing !== "FAMILY") return json({ ok: false, reason: "invalid-invite" });
      if (handles.includes(String(sub.owner_uid))) return json({ ok: false, reason: "own-plan" });
      const fam = await membersOf(sub.id);
      if (fam.some((m) => handles.includes(String(m.member_uid)))) return json({ ok: false, reason: "already-member" });
      if (1 + fam.length >= sub.seats) return json({ ok: false, reason: "family-full" });

      const ins = await insert("family_members", {
        subscription_id: sub.id, member_uid: myHandle, member_id: session.id,
      });
      // 409 = the unique member_uid index: this account already belongs to a
      // (different) family plan. COMPLETELY ISOLATED ACCOUNTS, one plan each.
      if (ins.status === 409) return json({ ok: false, reason: "already-in-family" });
      if (!ins.ok) return json({ error: `join failed: ${ins.status}` }, 502);
      await patch("family_invites", `token_hash=eq.${encodeURIComponent(String(inv.token_hash))}`,
        { used_by: myHandle, used_at: new Date().toISOString() });
      return json({ ok: true, premium: await resolveEntitlement(handles) });
    }

    // ================= family-list =================
    if (action === "family-list") {
      const ent = await resolveEntitlement(handles);
      if (!ent.active || ent.billing !== "FAMILY") return json({ ok: false, reason: "no-family" });
      if (ent.role === "owner") {
        const fam = await membersOf(ent.subscriptionId);
        return json({
          ok: true, role: "owner", seats: ent.seats, seatsUsed: 1 + fam.length,
          members: fam.map((m) => ({ id: m.member_id || m.member_uid, joinedAt: Date.parse(m.joined_at) })),
        });
      }
      return json({ ok: true, role: "member", ownerId: ent.ownerId, seats: ent.seats });
    }

    // ================= family-remove (owner) =================
    if (action === "family-remove") {
      const target = String(body.memberId ?? "").trim();
      if (!target) return json({ error: "Missing memberId" }, 400);
      const ent = await resolveEntitlement(handles);
      if (!ent.active || ent.role !== "owner" || ent.billing !== "FAMILY") {
        return json({ error: "Forbidden: not your family plan" }, 403);
      }
      // Accept either the stored handle or the display slug.
      const fam = await membersOf(ent.subscriptionId);
      const hit = fam.find((m) => m.member_uid === target || m.member_id === target);
      if (!hit) return json({ ok: false, reason: "not-a-member" });
      const r = await del("family_members",
        `subscription_id=eq.${encodeURIComponent(ent.subscriptionId)}&member_uid=eq.${encodeURIComponent(String(hit.member_uid))}`);
      if (!r.ok) return json({ error: `remove failed: ${r.status}` }, 502);
      return json({ ok: true });
    }

    // ================= leave (member) =================
    if (action === "leave") {
      const r = await del("family_members", `member_uid=${inList(handles)}`);
      if (!r.ok) return json({ error: `leave failed: ${r.status}` }, 502);
      return json({ ok: true });
    }

    // ================= admin actions =================
    if (action === "admin-grant" || action === "admin-revoke" || action === "admin-status") {
      if (!(await isAdmin(session))) return json({ error: "Forbidden: admin only" }, 403);
      const targetId = String(body.targetId ?? "").trim();
      let targetUid = String(body.targetUid ?? "").trim();
      if (!targetId && !targetUid) return json({ error: "Missing target" }, 400);
      // Resolve the rename-safe handle from credentials when not supplied.
      if (!targetUid && targetId) {
        const rows = await select("profile_secrets", `id=eq.${encodeURIComponent(targetId)}&select=uid`);
        targetUid = rows.length && rows[0].uid ? String(rows[0].uid) : "";
      }
      const handle = targetUid || targetId;
      const targetHandles = [targetUid, targetId].filter(Boolean).map(String);

      if (action === "admin-status") {
        const ent = await resolveEntitlement(targetHandles);
        return json({ ok: true, premium: ent });
      }

      if (action === "admin-revoke") {
        const r = await patch("subscriptions",
          `owner_uid=${inList(targetHandles)}&status=eq.active`,
          { status: "canceled", updated_at: new Date().toISOString() });
        if (!r.ok) return json({ error: `revoke failed: ${r.status}` }, 502);
        return json({ ok: true, premium: await resolveEntitlement(targetHandles) });
      }

      // admin-grant
      const tier = String(body.tier ?? "").toUpperCase();
      const billing = String(body.billing ?? "").toUpperCase();
      if (!TIERS.includes(tier)) return json({ error: "Bad tier" }, 400);
      if (billing !== "INDIVIDUAL" && billing !== "FAMILY") return json({ error: "Bad billing" }, 400);
      const months = body.months == null ? null : Number(body.months);
      if (months != null && (!Number.isFinite(months) || months <= 0 || months > 60)) {
        return json({ error: "Bad months" }, 400);
      }
      const expires_at = months == null ? null : new Date(Date.now() + months * 30 * 86400000).toISOString();
      const seats = billing === "FAMILY" ? FAMILY_SEATS : 1;
      const note = body.note == null ? null : String(body.note).slice(0, 200);

      const existing = (await select("subscriptions",
        `owner_uid=${inList(targetHandles)}&status=eq.active&select=id`));
      if (existing.length) {
        const r = await patch("subscriptions", `id=eq.${encodeURIComponent(String(existing[0].id))}`,
          { tier, billing, seats, expires_at, note, status: "active", updated_at: new Date().toISOString() });
        if (!r.ok) return json({ error: `grant failed: ${r.status}` }, 502);
        // Downgrading a family plan to individual sheds its members.
        if (billing === "INDIVIDUAL") {
          await del("family_members", `subscription_id=eq.${encodeURIComponent(String(existing[0].id))}`);
        }
      } else {
        const r = await insert("subscriptions", {
          owner_uid: handle, owner_id: targetId || null, tier, billing, seats,
          expires_at, note, source: "admin-grant",
        });
        if (!r.ok) return json({ error: `grant failed: ${r.status}` }, 502);
      }
      return json({ ok: true, premium: await resolveEntitlement(targetHandles) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: `server error: ${(e as Error).message ?? e}` }, 500);
  }
});
