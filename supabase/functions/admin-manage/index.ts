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
    return json({ ok: !!role, role: role ?? null });
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
  const passOk = safeEqual(passphrase, ADMIN_PASSPHRASE);

  // "verify" unlocks the admin UI — 200 { ok } either way.
  if (action === "verify") return json({ ok: passOk });

  if (!passOk) return json({ error: "Wrong passphrase" }, 401);

  // Writes ALSO require the actor's token: governance rules need to know WHO
  // is acting, and the audit trail must be attributable.
  const session = await verifyToken(payload.token);
  if (!session) return json({ error: "Not authenticated (session token required)" }, 401);
  const actorRole = await roleOf(session);
  if (!atLeast(actorRole, "coadmin")) return json({ error: "Forbidden: co-admin or above" }, 403);
  const actorIds = new Set([session.id, session.uid].filter(Boolean).map(String));

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
