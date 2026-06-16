// =====================================================================
// supabase/functions/auth-secure/index.ts
// Server-side credential broker for NORCET Prep  (Stage 1 / C-1 + C-2).
//
// WHY: password/DOB hashes used to live in the public kv_shared table,
// where anyone with the (public) anon key could download every account's
// hash in bulk and crack them offline. Now the hashes live ONLY in
// profile_secrets, which the anon key cannot touch. This function is the
// ONLY thing that can read or write that table — it uses the service-role
// key (auto-injected, never shipped to the browser) and does all hashing
// and comparison server-side.
//
// It deliberately reproduces the app's EXISTING hashing scheme byte-for-
// byte (PBKDF2-SHA256, 100k iterations, salt = UTF-8 bytes of the hex salt
// string, 256-bit output as hex). That means the hashes backfilled from
// the old blobs validate unchanged — no user has to reset their password.
//
// These actions are called by ORDINARY users (sign up / log in / reset),
// so unlike admin-manage there is NO passphrase gate. The function is the
// normal login surface: `verify`/`reset` are guessing oracles exactly as a
// login form always is. The win is purely that the hashes are no longer
// downloadable. Rate-limiting per IP is a sensible follow-up (PROMPT 21).
//
// DEPLOY:
//   supabase functions deploy auth-secure --no-verify-jwt
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//  No custom secret is required for this function.)
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// STAGE 2: shared signing secret for session tokens. Set it with:
//   supabase secrets set SESSION_SIGNING_SECRET="<long random string>"
// The kv-write broker MUST use the exact same secret to verify tokens.
const SESSION_SECRET = Deno.env.get("SESSION_SIGNING_SECRET") ?? "";
const TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

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

function dbHeaders(extra?: Record<string, string>): Record<string, string> {
  return { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, ...(extra ?? {}) };
}

// Length-independent compare to avoid leaking via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- crypto: an EXACT reproduction of src/lib/profile-crypto.js ----
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256,
  );
  return toHex(bits);
}

// ---- session token: base64url(payload).base64url(HMAC-SHA256(payload)) ----
function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}
// Mint a signed token carrying { id, uid, iat, exp }. The kv-write broker
// verifies the signature with the same secret and reads id/uid for authz.
async function mintToken(id: string, uid: string | null): Promise<string> {
  if (!SESSION_SECRET) throw new Error("SESSION_SIGNING_SECRET is not set on auth-secure");
  const payload = { id, uid: uid ?? null, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS };
  const enc = new TextEncoder();
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const sigB64 = b64url(await hmac(payloadB64));
  return `${payloadB64}.${sigB64}`;
}

// Normalize DOB the same way the client does (YYYY-MM-DD only).
function normalizeDob(dob: unknown): string | null {
  if (!dob) return null;
  const s = String(dob).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

// Fetch one secret row by id (service-role). Returns the row object or null.
async function getSecret(id: string): Promise<Record<string, unknown> | null> {
  const url = `${SUPABASE_URL}/rest/v1/profile_secrets?id=eq.${encodeURIComponent(id)}&select=*`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) throw new Error(`secret read failed: ${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(payload.action ?? "");
  const id = String(payload.id ?? "").trim();
  if (!id) return json({ error: "Missing id" }, 400);

  try {
    // -------------------------------------------------------------
    // REGISTER — create a new account's credentials. Fails (does NOT
    // overwrite) if the id already has a secret, so an existing
    // account's password can never be clobbered by a re-signup.
    // -------------------------------------------------------------
    if (action === "register") {
      const password = String(payload.password ?? "");
      if (password.length < 8) return json({ ok: false, reason: "weak-password" });
      const normDob = normalizeDob(payload.dob);
      if (!normDob) return json({ ok: false, reason: "bad-dob" });

      const existing = await getSecret(id);
      if (existing) return json({ ok: false, reason: "exists" });

      const salt = genSalt();
      const password_hash = await hashPassword(password, salt);
      const dob_salt = genSalt();
      const dob_hash = await hashPassword(normDob, dob_salt);
      const email = payload.email == null ? null : String(payload.email).trim() || null;
      const uid = payload.uid == null ? null : String(payload.uid);
      const display_name = payload.displayName == null ? null : String(payload.displayName);

      const r = await fetch(`${SUPABASE_URL}/rest/v1/profile_secrets`, {
        method: "POST",
        headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({ id, uid, display_name, password_hash, salt, dob_hash, dob_salt, email }),
      });
      if (!r.ok) {
        // 409 = unique violation (race): treat as "exists" rather than a 500.
        if (r.status === 409) return json({ ok: false, reason: "exists" });
        return json({ error: `register failed: ${r.status} ${await r.text().catch(() => "")}`.trim() }, 502);
      }
      return json({ ok: true, token: await mintToken(id, uid) });
    }

    // -------------------------------------------------------------
    // VERIFY — check a password. Returns { ok } only; a missing
    // account and a wrong password BOTH return ok:false, so the
    // client shows one generic message (no username enumeration).
    // -------------------------------------------------------------
    if (action === "verify") {
      const password = String(payload.password ?? "");
      const row = await getSecret(id);
      if (!row || !row.password_hash || !row.salt) return json({ ok: false });
      const tryHash = await hashPassword(password, String(row.salt));
      if (!safeEqual(tryHash, String(row.password_hash))) return json({ ok: false });
      return json({ ok: true, token: await mintToken(id, row.uid == null ? null : String(row.uid)) });
    }

    // -------------------------------------------------------------
    // RESET — DOB-gated password reset. Verifies the DOB hash, then
    // sets a new password hash. (DOB is a weak factor — that's a known
    // C-2 item to harden later; this only preserves today's behavior
    // while moving the secret server-side.)
    // -------------------------------------------------------------
    if (action === "reset") {
      const newPassword = String(payload.newPassword ?? "");
      const row = await getSecret(id);
      if (!row) return json({ ok: false, reason: "no-account" });
      if (!row.dob_hash || !row.dob_salt) return json({ ok: false, reason: "no-dob" });
      const normDob = normalizeDob(payload.dob);
      if (!normDob) return json({ ok: false, reason: "bad-dob" });
      const tryHash = await hashPassword(normDob, String(row.dob_salt));
      if (!safeEqual(tryHash, String(row.dob_hash))) return json({ ok: false, reason: "dob-mismatch" });
      if (newPassword.length < 8) return json({ ok: false, reason: "weak-password" });

      const salt = genSalt();
      const password_hash = await hashPassword(newPassword, salt);
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/profile_secrets?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify({ salt, password_hash, updated_at: new Date().toISOString() }),
        },
      );
      if (!r.ok) return json({ error: `reset failed: ${r.status}` }, 502);
      return json({ ok: true, token: await mintToken(id, row.uid == null ? null : String(row.uid)) });
    }

    // -------------------------------------------------------------
    // RENAME — re-key a credential row when a profile's id (slug)
    // changes on rename. Copies the SAME hashes to the new id and
    // removes the old row, so the renamed user can still log in.
    // -------------------------------------------------------------
    if (action === "rename") {
      const oldId = String(payload.oldId ?? "").trim();
      if (!oldId) return json({ ok: false, reason: "missing-oldid" });
      if (oldId === id) return json({ ok: true }); // nothing to move
      const src = await getSecret(oldId);
      if (!src) return json({ ok: false, reason: "no-account" });
      const dst = await getSecret(id);
      if (dst) return json({ ok: false, reason: "exists" });
      const display_name = payload.displayName == null ? src.display_name : String(payload.displayName);
      const insert = await fetch(`${SUPABASE_URL}/rest/v1/profile_secrets`, {
        method: "POST",
        headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({
          id,
          uid: src.uid,
          display_name,
          password_hash: src.password_hash,
          salt: src.salt,
          dob_hash: src.dob_hash,
          dob_salt: src.dob_salt,
          email: src.email,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!insert.ok) {
        if (insert.status === 409) return json({ ok: false, reason: "exists" });
        return json({ error: `rename insert failed: ${insert.status}` }, 502);
      }
      // Best-effort remove of the old row (the new one is authoritative now).
      await fetch(
        `${SUPABASE_URL}/rest/v1/profile_secrets?id=eq.${encodeURIComponent(oldId)}`,
        { method: "DELETE", headers: dbHeaders() },
      ).catch(() => {});
      return json({ ok: true });
    }

    // -------------------------------------------------------------
    // DELETE — remove a credential row when an account is deleted, so
    // the display name can be re-registered later.
    // -------------------------------------------------------------
    if (action === "delete") {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/profile_secrets?id=eq.${encodeURIComponent(id)}`,
        { method: "DELETE", headers: dbHeaders() },
      );
      if (!r.ok && r.status !== 404) return json({ error: `delete failed: ${r.status}` }, 502);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: `server error: ${(e as Error).message ?? e}` }, 500);
  }
});
