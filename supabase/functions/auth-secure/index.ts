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
// LAUNCH WAITLIST: while game_config `waitlist.gate` is ON, `register`
// additionally requires a one-time claim token minted by an admin approval
// in the waitlist table (see supabase/functions/waitlist). Burn-first and
// fail-closed; a no-op while the flag is off.
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
// Cloudflare Turnstile secret. CAPTCHA is enforced on register/verify/reset
// ONLY when this is set; until then the check fail-opens (so deploying this
// code never locks anyone out — enforcement is switched on by setting the
// secret). Set it with:
//   supabase secrets set TURNSTILE_SECRET_KEY="<secret from the Turnstile dashboard>"
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
// Google Sign-In. Client ID is NOT a secret (it's public by design — Google's
// own docs say so) but is kept as a Supabase secret alongside the others for
// deploy-story consistency. Unset → verifyGoogleIdToken always fails closed,
// so shipping this code before the owner finishes Google Cloud setup is safe.
//   supabase secrets set GOOGLE_CLIENT_ID="<client id>.apps.googleusercontent.com"
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";

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
// Mint a signed token carrying { id, uid, sid, iat, exp }. The kv-write broker
// verifies the signature with the same secret and reads id/uid for authz.
// `sid` is the concurrent-session id ("last one wins"): rotated in
// profile_secrets at every mint, compared by the brokers when the
// game_config flag security.singleSession is ON.
async function mintToken(id: string, uid: string | null, sid: string | null): Promise<string> {
  if (!SESSION_SECRET) throw new Error("SESSION_SIGNING_SECRET is not set on auth-secure");
  const payload = { id, uid: uid ?? null, sid: sid ?? null, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS };
  const enc = new TextEncoder();
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const sigB64 = b64url(await hmac(payloadB64));
  return `${payloadB64}.${sigB64}`;
}

// Rotate the account's active_session_id to a fresh cryptographically-random
// UUID and return it. This is the "last one wins" write: the NEWEST login owns
// the account; every older token's sid stops matching. BEST-EFFORT by design —
// if the column doesn't exist yet (subscriptions.sql not applied) or the PATCH
// fails, we return null and the minted token simply carries sid:null, which the
// brokers treat as a legacy token. A DB blip must never break login itself.
async function rotateSessionId(id: string): Promise<string | null> {
  try {
    const sid = crypto.randomUUID();
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profile_secrets?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({ active_session_id: sid }),
      },
    );
    return r.ok ? sid : null;
  } catch {
    return null;
  }
}

// Normalize DOB the same way the client does (YYYY-MM-DD only).
function normalizeDob(dob: unknown): string | null {
  if (!dob) return null;
  const s = String(dob).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

// Normalize a security-question answer. MUST stay byte-identical to
// normalizeAnswer() in src/lib/security-questions.js: lowercase + trim +
// collapse internal whitespace, so the answer compares case-insensitively
// and "Rex ", "rex", "REX" all match. Returns '' for nullish input.
function normalizeAnswer(answer: unknown): string {
  if (answer == null) return "";
  return String(answer).trim().replace(/\s+/g, " ").toLowerCase();
}

// Fetch one secret row by id (service-role). Returns the row object or null.
async function getSecret(id: string): Promise<Record<string, unknown> | null> {
  const url = `${SUPABASE_URL}/rest/v1/profile_secrets?id=eq.${encodeURIComponent(id)}&select=*`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) throw new Error(`secret read failed: ${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// ---- rate limiting (PROMPT 21) -------------------------------------
// Fixed-window limiter backed by the locked auth_rate table + rate_hit() RPC
// (see supabase/auth-rate.sql). Mirrors the policy of api/_ratelimit.js:
// cheap abuse damper, NOT cryptographic, and it FAILS OPEN — a limiter/DB
// blip must never take down login. Unauthenticated actions are keyed by client
// IP (no trusted id yet); authenticated actions by profile id (fairer + per
// account). Limits are generous so a normal user never trips them.

// Best-effort client IP from the proxy headers Supabase forwards.
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Records one hit; returns whether it is allowed and seconds to wait if not.
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

// Human-friendly "wait X" string for the 429 message.
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

// 429 response carrying a clear, user-facing wait message + Retry-After header.
function tooMany(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      reason: "rate-limited",
      retryAfter,
      message: `Too many attempts. Please wait ${formatWait(retryAfter)} and try again.`,
    }),
    {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.max(1, retryAfter)) },
    },
  );
}

// ---- CAPTCHA: Cloudflare Turnstile server-side verification ----------
// Returns true when the challenge is satisfied. Policy:
//   • secret unset            → true  (CAPTCHA not enforced yet — fail-open)
//   • token missing/empty     → false (the whole point: a bot that sends no
//                                      token must be rejected)
//   • Cloudflare says success → true
//   • Cloudflare says !success → false
//   • transport/HTTP error    → true  (fail-open, like rateHit: a Cloudflare
//                                      outage must not lock out real users)
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true;       // enforcement off
  if (!token) return false;                 // no token → reject
  try {
    const form = new URLSearchParams();
    form.set("secret", TURNSTILE_SECRET);
    form.set("response", token);
    if (ip && ip !== "unknown") form.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!r.ok) return true;                  // transport problem → fail-open
    const data = await r.json();
    return !!(data && data.success);
  } catch {
    return true;                            // network error → fail-open
  }
}

// ---- GOOGLE SIGN-IN: verify a GIS ID token server-side ----------------
// Simple HTTP verification via Google's tokeninfo endpoint (no JWT/JWKS
// library needed at this scale — see CONTENT_PIPELINE-style scale notes
// elsewhere in this repo). Checks the token was issued FOR this app (aud)
// and that Google itself has verified the email. Returns null on ANY
// failure (missing secret, bad token, aud mismatch, network error) — every
// caller treats null as "Google sign-in unavailable/failed", fail-closed.
async function verifyGoogleIdToken(idToken: string): Promise<{ sub: string; email: string; name: string } | null> {
  if (!GOOGLE_CLIENT_ID || !idToken) return null;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!r.ok) return null;
    const data = await r.json();
    if (!data || data.aud !== GOOGLE_CLIENT_ID) return null;
    if (data.email_verified !== true && data.email_verified !== "true") return null;
    if (!data.sub || !data.email) return null;
    return { sub: String(data.sub), email: String(data.email).toLowerCase(), name: data.name ? String(data.name) : "" };
  } catch {
    return null;
  }
}

// Look up an existing profile_secrets row by Google sub. Returns { id, uid }
// or null.
async function getSecretByGoogleSub(sub: string): Promise<{ id: string; uid: string | null } | null> {
  const url = `${SUPABASE_URL}/rest/v1/profile_secrets?google_sub=eq.${encodeURIComponent(sub)}&select=id,uid&limit=1`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) throw new Error(`google-sub lookup failed: ${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? { id: String(rows[0].id), uid: rows[0].uid == null ? null : String(rows[0].uid) } : null;
}

// ---- LAUNCH WAITLIST gate flag — cached read of game_config (same 60s
// pattern as kv-write's singleSessionEnabled; fail-open = gate OFF, but once
// the flag reads ON the claim check itself is fail-closed). ----
let _wlGate: { v: boolean; ts: number } | null = null;
async function waitlistGateOn(): Promise<boolean> {
  if (_wlGate && Date.now() - _wlGate.ts < 60_000) return _wlGate.v;
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
        v = !!(cfg && cfg.waitlist && cfg.waitlist.gate === true);
      }
    }
  } catch { /* fail-open */ }
  _wlGate = { v, ts: Date.now() };
  return v;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(payload.action ?? "");
  // google-auth and lookup-by-email are the two actions that RESOLVE an id
  // (from a Google sub / an email) rather than being called with one already
  // known — every other action still requires it.
  const idNotYetKnown = action === "google-auth" || action === "lookup-by-email";
  const id = String(payload.id ?? "").trim();
  if (!id && !idNotYetKnown) return json({ error: "Missing id" }, 400);

  // -------------------------------------------------------------
  // RATE LIMIT — applied before any work. Unauth actions keyed by IP,
  // auth actions by profile id. register/rename/delete are intentionally
  // NOT limited here. Fails open (see rateHit) so a limiter blip can't
  // lock anyone out.
  // -------------------------------------------------------------
  {
    const ip = clientIp(req);
    let rl: { allowed: boolean; retryAfter: number } | null = null;
    if (action === "verify") {
      rl = await rateHit("login", ip, 5, 15 * 60);            // 5 / 15 min per IP
    } else if (action === "reset") {
      rl = await rateHit("reset", ip, 3, 60 * 60);            // 3 / hour per IP
    } else if (action === "recovery-question") {
      rl = await rateHit("recovery-question", ip, 3, 60 * 60); // 3 / hour per IP
    } else if (action === "change-password") {
      rl = await rateHit("change-password", id, 5, 60 * 60);  // 5 / hour per id
    } else if (action === "set-security-question") {
      rl = await rateHit("set-security-question", id, 3, 60 * 60); // 3 / hour per id
    } else if (action === "update-email") {
      rl = await rateHit("update-email", id, 5, 60 * 60);     // 5 / hour per id
    } else if (action === "google-auth") {
      rl = await rateHit("google-auth", ip, 20, 15 * 60);     // 20 / 15 min per IP
    } else if (action === "lookup-by-email") {
      rl = await rateHit("lookup-by-email", ip, 10, 15 * 60); // 10 / 15 min per IP
    }
    if (rl && !rl.allowed) return tooMany(rl.retryAfter);
  }

  // -------------------------------------------------------------
  // CAPTCHA — Cloudflare Turnstile guards the PUBLIC auth surfaces
  // (register / verify / reset). Enforced only when TURNSTILE_SECRET_KEY is
  // set; otherwise verifyTurnstile() fail-opens, so this code is safe to
  // deploy before enforcement is switched on. Logged-in-only actions
  // (change-password / set-security-question / update-email / rename /
  // delete / recovery-question) are NOT gated — they already require a
  // session/password, so a CAPTCHA there adds friction with no anti-bot win.
  // -------------------------------------------------------------
  if (action === "register" || action === "verify" || action === "reset") {
    const ok = await verifyTurnstile(String(payload.captchaToken ?? ""), clientIp(req));
    if (!ok) return json({ ok: false, reason: "captcha" });
  }

  try {
    // -------------------------------------------------------------
    // REGISTER — create a new account's credentials. Fails (does NOT
    // overwrite) if the id already has a secret, so an existing
    // account's password can never be clobbered by a re-signup.
    // -------------------------------------------------------------
    if (action === "register") {
      // GOOGLE SIGN-UP: the ID token is RE-VERIFIED here (never trust a
      // client-supplied sub/email) — this is what makes a Google-linked
      // account's "password" unnecessary: Google itself is the recovery
      // factor. A Google account has no password_hash/salt at all.
      const googleIdTokenIn = payload.googleIdToken == null ? "" : String(payload.googleIdToken);
      let google: { sub: string; email: string; name: string } | null = null;
      if (googleIdTokenIn) {
        google = await verifyGoogleIdToken(googleIdTokenIn);
        if (!google) return json({ ok: false, reason: "google-failed" });
      }

      const password = String(payload.password ?? "");
      let securityQuestion: string | null = null;
      let normAnswer = "";
      let normDob: string | null = null;

      if (!google) {
        if (password.length < 8) return json({ ok: false, reason: "weak-password" });

        // issues_new #3: a personal security question replaces DOB as the
        // recovery factor for NEW accounts. DOB is now OPTIONAL (kept only for
        // backward-compat / legacy clients). Require a question + a non-empty
        // answer unless a legacy client is still sending a DOB instead.
        securityQuestion = payload.securityQuestion == null
          ? null : String(payload.securityQuestion).trim() || null;
        normAnswer = normalizeAnswer(payload.securityAnswer);
        normDob = normalizeDob(payload.dob); // optional now

        if (securityQuestion) {
          if (!normAnswer) return json({ ok: false, reason: "bad-answer" });
        } else if (!normDob) {
          // Neither a security question nor a DOB was supplied → can't set up
          // any recovery factor.
          return json({ ok: false, reason: "no-recovery" });
        }
      }

      const existing = await getSecret(id);
      if (existing) return json({ ok: false, reason: "exists" });

      // LAUNCH WAITLIST GATE — while waitlist.gate is ON a new account needs
      // a one-time claim token (minted by admin approval in the waitlist
      // table). BURN-FIRST: the row is atomically consumed here, BEFORE the
      // credentials insert — the PATCH filter (approved + unexpired + this
      // exact token) makes reuse/expiry a 0-row match → fail-closed reject.
      // If the later insert fails, the claim is best-effort restored below.
      let claimedRow: { rowId: string; claimToken: string } | null = null;
      if (await waitlistGateOn()) {
        const claimToken = String(payload.claimToken ?? "").trim().toLowerCase();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(claimToken)) {
          return json({ ok: false, reason: "waitlist" });
        }
        const nowIso = new Date().toISOString();
        const burn = await fetch(
          `${SUPABASE_URL}/rest/v1/waitlist?claim_token=eq.${encodeURIComponent(claimToken)}&status=eq.approved&approval_expires_at=gt.${encodeURIComponent(nowIso)}`,
          {
            method: "PATCH",
            headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=representation", Accept: "application/json" }),
            body: JSON.stringify({ status: "onboarded", claimed_profile_id: id, claim_token: null, updated_at: nowIso }),
          },
        );
        const burned = burn.ok ? await burn.json().catch(() => null) : null;
        if (!Array.isArray(burned) || !burned.length) return json({ ok: false, reason: "waitlist" });
        claimedRow = { rowId: String(burned[0].id), claimToken };
      }

      // A Google-linked account has NO password — Google itself is the
      // recovery factor. salt/password_hash are nullable for exactly this case.
      const salt = google ? null : genSalt();
      const password_hash = google ? null : await hashPassword(password, salt!);
      // DOB hash only when a DOB was actually provided (legacy path).
      let dob_hash: string | null = null;
      let dob_salt: string | null = null;
      if (normDob) {
        dob_salt = genSalt();
        dob_hash = await hashPassword(normDob, dob_salt);
      }
      // Security-answer hash when a question was chosen (the new path).
      let security_answer_hash: string | null = null;
      let security_answer_salt: string | null = null;
      if (securityQuestion) {
        security_answer_salt = genSalt();
        security_answer_hash = await hashPassword(normAnswer, security_answer_salt);
      }
      // A Google sign-up's email is the VERIFIED claim from the re-checked ID
      // token above (never the client-supplied field). Everyone else's email
      // is optional/unverified as before — just lowercased so it matches the
      // case-insensitive unique index and future lookup-by-email calls.
      const email = google ? google.email : ((payload.email == null ? null : String(payload.email).trim().toLowerCase() || null));
      const google_sub = google ? google.sub : null;
      const uid = payload.uid == null ? null : String(payload.uid);
      const display_name = payload.displayName == null ? null : String(payload.displayName);

      const r = await fetch(`${SUPABASE_URL}/rest/v1/profile_secrets`, {
        method: "POST",
        headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({
          id, uid, display_name, password_hash, salt, dob_hash, dob_salt, email,
          security_question: securityQuestion,
          security_answer_hash, security_answer_salt,
          google_sub,
        }),
      });
      if (!r.ok) {
        // The claim was burned but the account wasn't created — restore the
        // seat (best-effort) so the student's invite still works on retry.
        if (claimedRow) {
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/waitlist?id=eq.${encodeURIComponent(claimedRow.rowId)}&status=eq.onboarded`, {
              method: "PATCH",
              headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
              body: JSON.stringify({ status: "approved", claim_token: claimedRow.claimToken, claimed_profile_id: null }),
            });
          } catch (_) { /* best-effort */ }
        }
        // 409 = unique violation (race). The pkey (id) conflict keeps the
        // original "exists" reason; the two NEW indexes (email, google_sub)
        // get their own precise reasons so the client can say something useful.
        if (r.status === 409) {
          const bodyText = await r.text().catch(() => "");
          if (/email/i.test(bodyText)) return json({ ok: false, reason: "email-exists" });
          if (/google_sub/i.test(bodyText)) return json({ ok: false, reason: "google-exists" });
          return json({ ok: false, reason: "exists" });
        }
        return json({ error: `register failed: ${r.status} ${await r.text().catch(() => "")}`.trim() }, 502);
      }

      // Phase-2 — best-effort signup event for fake-account anomaly detection
      // (device/IP clustering + per-link velocity). NEVER blocks signup: any
      // failure is swallowed. IP + fingerprint are stored ONLY as one-way
      // HMACs, never raw. `ref` is the referral code the new user arrived with.
      try {
        const ipHash = toHex((await hmac(clientIp(req))).buffer);
        const fpRaw = payload.fingerprint == null ? "" : String(payload.fingerprint).slice(0, 256);
        const fpHash = fpRaw ? toHex((await hmac(fpRaw)).buffer) : null;
        const ref = payload.ref == null ? null : (String(payload.ref).slice(0, 64) || null);
        await fetch(`${SUPABASE_URL}/rest/v1/signup_events`, {
          method: "POST",
          headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify({ profile_id: id, ip_hash: ipHash, fp_hash: fpHash, ref }),
        });
      } catch (_) { /* anomaly logging is best-effort; never affects the account */ }

      return json({ ok: true, token: await mintToken(id, uid, await rotateSessionId(id)) });
    }

    // -------------------------------------------------------------
    // GOOGLE-AUTH — verify a Google ID token and either log the caller
    // straight in (an account is already linked to this Google sub) or hand
    // back enough info for the client to run its normal "pick a display
    // name" register step. Creates NOTHING itself — a brand-new Google user
    // only gets an account once they submit `register` with this same token.
    // -------------------------------------------------------------
    if (action === "google-auth") {
      const idToken = String(payload.idToken ?? "");
      const google = await verifyGoogleIdToken(idToken);
      if (!google) return json({ ok: false, reason: "google-failed" });
      const row = await getSecretByGoogleSub(google.sub);
      if (row) {
        return json({ ok: true, id: row.id, token: await mintToken(row.id, row.uid, await rotateSessionId(row.id)) });
      }
      const suggestedName = (google.name || google.email.split("@")[0] || "Student").slice(0, 40);
      return json({ ok: true, newGoogleUser: true, suggestedName, email: google.email });
    }

    // -------------------------------------------------------------
    // LOOKUP-BY-EMAIL — resolve an email typed into the sign-in box to the
    // profile id it belongs to, so the client can then call `verify` exactly
    // as it does for a username. Generic ok:false on any miss (same no-
    // enumeration posture as verify) — this never reveals whether an email
    // is or isn't registered beyond what a failed login already implies.
    // -------------------------------------------------------------
    if (action === "lookup-by-email") {
      const email = String(payload.email ?? "").trim();
      if (!email) return json({ ok: false });
      // ilike (no wildcards) = case-insensitive exact match, so this also
      // resolves the handful of pre-existing rows stored with mixed casing
      // from before the case-insensitive unique index existed.
      const url = `${SUPABASE_URL}/rest/v1/profile_secrets?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`;
      const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
      if (!r.ok) return json({ ok: false });
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) return json({ ok: true, id: String(rows[0].id) });
      return json({ ok: false });
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
      return json({ ok: true, token: await mintToken(id, row.uid == null ? null : String(row.uid), await rotateSessionId(id)) });
    }

    // -------------------------------------------------------------
    // RESET — DOB-gated password reset. Verifies the DOB hash, then
    // sets a new password hash. (DOB is a weak factor — that's a known
    // C-2 item to harden later; this only preserves today's behavior
    // while moving the secret server-side.)
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // RECOVERY-QUESTION — given an id, tell the client which recovery
    // factor this account uses so the right prompt can be shown:
    //   { ok:true, method:'question', question } — security question set
    //   { ok:true, method:'dob' }               — legacy DOB-only account
    //   { ok:false, reason:'no-recovery' }       — no factor / no account
    // (A non-existent account returns the same 'no-recovery' as an account
    //  with no factor, so this doesn't add an enumeration signal beyond
    //  what reset already exposes.)
    // -------------------------------------------------------------
    if (action === "recovery-question") {
      const row = await getSecret(id);
      if (row && row.security_question) {
        return json({ ok: true, method: "question", question: String(row.security_question) });
      }
      if (row && row.dob_hash) {
        return json({ ok: true, method: "dob" });
      }
      return json({ ok: false, reason: "no-recovery" });
    }

    // -------------------------------------------------------------
    // RESET — recovery-gated password reset. Accepts EITHER a security-
    // question answer (the new factor) OR a DOB (legacy accounts). Verifies
    // the matching hash, then sets a new password hash. Generic failures so
    // we don't confirm what's on file.
    // -------------------------------------------------------------
    if (action === "reset") {
      const newPassword = String(payload.newPassword ?? "");
      const row = await getSecret(id);
      if (!row) return json({ ok: false, reason: "no-account" });

      const hasAnswerInput = payload.securityAnswer != null && normalizeAnswer(payload.securityAnswer) !== "";
      const hasDobInput = normalizeDob(payload.dob) != null;

      // Prefer the security-question path when the account has one set.
      if (row.security_answer_hash && row.security_answer_salt) {
        if (!hasAnswerInput) return json({ ok: false, reason: "answer-required" });
        const tryHash = await hashPassword(normalizeAnswer(payload.securityAnswer), String(row.security_answer_salt));
        if (!safeEqual(tryHash, String(row.security_answer_hash))) return json({ ok: false, reason: "answer-mismatch" });
      } else if (row.dob_hash && row.dob_salt) {
        // Legacy DOB-only account.
        if (!hasDobInput) return json({ ok: false, reason: "dob-required" });
        const tryHash = await hashPassword(normalizeDob(payload.dob)!, String(row.dob_salt));
        if (!safeEqual(tryHash, String(row.dob_hash))) return json({ ok: false, reason: "dob-mismatch" });
      } else {
        return json({ ok: false, reason: "no-recovery" });
      }

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
      return json({ ok: true, token: await mintToken(id, row.uid == null ? null : String(row.uid), await rotateSessionId(id)) });
    }

    // -------------------------------------------------------------
    // SET-SECURITY-QUESTION — a logged-in user sets their recovery
    // question ONE TIME. Verifies the current password, refuses if a
    // question is already on file (one-time, can't be changed), then
    // stores the question + a hashed answer. Mirrors register's hashing.
    // -------------------------------------------------------------
    if (action === "set-security-question") {
      const password = String(payload.password ?? "");
      const securityQuestion = payload.securityQuestion == null ? "" : String(payload.securityQuestion).trim();
      const normAnswer = normalizeAnswer(payload.securityAnswer);
      const row = await getSecret(id);
      if (!row || !row.password_hash || !row.salt) return json({ ok: false, reason: "no-account" });
      const tryHash = await hashPassword(password, String(row.salt));
      if (!safeEqual(tryHash, String(row.password_hash))) return json({ ok: false, reason: "bad-password" });
      if (row.security_question) return json({ ok: false, reason: "already-set" });
      if (!securityQuestion) return json({ ok: false, reason: "question-required" });
      if (!normAnswer) return json({ ok: false, reason: "answer-required" });
      const security_answer_salt = genSalt();
      const security_answer_hash = await hashPassword(normAnswer, security_answer_salt);
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/profile_secrets?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify({
            security_question: securityQuestion,
            security_answer_hash, security_answer_salt,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!r.ok) return json({ error: `set-security-question failed: ${r.status}` }, 502);
      return json({ ok: true });
    }

    // -------------------------------------------------------------
    // UPDATE-EMAIL — a logged-in user adds/updates their optional
    // recovery email. Verifies the current password first. An empty
    // string clears it; a non-empty value must look like an email.
    // -------------------------------------------------------------
    if (action === "update-email") {
      const password = String(payload.password ?? "");
      const email = payload.email == null ? "" : String(payload.email).trim().toLowerCase();
      const row = await getSecret(id);
      if (!row || !row.password_hash || !row.salt) return json({ ok: false, reason: "no-account" });
      const tryHash = await hashPassword(password, String(row.salt));
      if (!safeEqual(tryHash, String(row.password_hash))) return json({ ok: false, reason: "bad-password" });
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, reason: "bad-email" });
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/profile_secrets?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify({ email: email || null, updated_at: new Date().toISOString() }),
        },
      );
      if (!r.ok) {
        if (r.status === 409) return json({ ok: false, reason: "email-exists" });
        return json({ error: `update-email failed: ${r.status}` }, 502);
      }
      return json({ ok: true });
    }

    // -------------------------------------------------------------
    // CHANGE-PASSWORD — a logged-in user changes their password. Verifies
    // the CURRENT password first (same pattern as update-email / set-
    // security-question), enforces the same 8-char minimum as reset, then
    // writes a fresh salt + hash. Does NOT mint a new token: the caller's
    // existing session stays valid, so nobody gets logged out. Refuses a
    // no-op change so the user gets clear feedback rather than a silent OK.
    // -------------------------------------------------------------
    if (action === "change-password") {
      const password = String(payload.password ?? "");        // current
      const newPassword = String(payload.newPassword ?? "");  // new
      const row = await getSecret(id);
      if (!row || !row.password_hash || !row.salt) return json({ ok: false, reason: "no-account" });
      const tryHash = await hashPassword(password, String(row.salt));
      if (!safeEqual(tryHash, String(row.password_hash))) return json({ ok: false, reason: "bad-password" });
      if (newPassword.length < 8) return json({ ok: false, reason: "weak-password" });
      // Reject new === current (compared against the stored hash with its salt).
      if (safeEqual(await hashPassword(newPassword, String(row.salt)), String(row.password_hash))) {
        return json({ ok: false, reason: "same-password" });
      }
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
      if (!r.ok) return json({ error: `change-password failed: ${r.status}` }, 502);
      return json({ ok: true });
    }
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
          security_question: src.security_question ?? null,
          security_answer_hash: src.security_answer_hash ?? null,
          security_answer_salt: src.security_answer_salt ?? null,
          // Carry the live session id across the rename so the user's current
          // device stays logged in. Only when the column exists on the source
          // row (pre-migration deploys must not break rename).
          ...("active_session_id" in src ? { active_session_id: src.active_session_id ?? null } : {}),
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
