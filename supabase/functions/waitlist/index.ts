// =====================================================================
// supabase/functions/waitlist/index.ts
// The LAUNCH-WAITLIST BROKER for NORCET Prep.
//
// Owns every read/write against the service-role-only `waitlist` table
// (supabase/waitlist.sql). The public anon key has ZERO access to that
// table — this function is the only path.
//
// PUBLIC ACTIONS (no session token — visitors have no account yet; guarded
// by Cloudflare Turnstile on join + per-IP rate limits on everything, and
// only served while game_config waitlist.collect OR waitlist.gate is true):
//   join    → validate + normalize (email §7.2, temp-mail §7.1, Indian
//             phone §7.3), intent-score the golden question (§3.2), mint a
//             NURSE-XXXXX code, resolve the referral code; when a code hits
//             3 uses the whole cluster flips to pending_verification for
//             admin review — NEVER auto-approved (§7.2 hardening).
//   status  → position among waiting rows (priority score = referrals×100
//             + daysWaiting×10), score breakdown, next drop time. Reveals
//             the one-time claim token ONLY for an approved row AND only
//             when the caller also presents the row's own referral code
//             (proof of ownership — email alone never leaks a claim).
//   stats   → aggregate counts (total + by state) for the public board.
// ADMIN ACTIONS (signed session token + admin_profile_ids):
//   admin-list          → all rows + computed scores + abuse cluster flags
//   admin-approve       → ids[] → approved + claim_token + 48h expiry
//   admin-reject        → ids[] → rejected
//   admin-expire-sweep  → stale approvals → expired (claim also expires
//                         lazily at claim/status time; the sweep is hygiene)
//
// Validation helpers are DELIBERATE COPIES of src/lib/waitlist.js (kept in
// sync by hand — Deno and the Vite client can't share a module here; same
// policy as kv-write/moderation.ts ↔ content-filter.js and the verifyToken
// copies).
//
// DEPLOY:
//   (SESSION_SIGNING_SECRET + TURNSTILE_SECRET_KEY are already set project-wide)
//   supabase functions deploy waitlist --no-verify-jwt
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SESSION_SECRET = Deno.env.get("SESSION_SIGNING_SECRET") ?? "";
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";

const CLAIM_TTL_MS = 48 * 60 * 60 * 1000;   // spec §6.3 — 48h claim window
const MILESTONE = 3;                        // spec §4 — 3 referrals = fast-track review
const MAX_APPROVE_IDS = 200;
const APP_ORIGIN = "https://www.nurseholic.in"; // claim links always target the student app

// ---- APPROVAL INVITE EMAIL — Resend (owner picked it 2026-07-05) -------
// INERT until:  supabase secrets set RESEND_API_KEY="re_…"
// FROM uses Resend's shared onboarding address until nurseholic.in is
// verified in the Resend dashboard (then set EMAIL_FROM, e.g.
// "NurseHolic <noreply@nurseholic.in>"). NOTE Resend's rule: with no
// verified domain, delivery works ONLY to the Resend account owner's own
// address — so student invites stay effectively off until the DNS step,
// while owner alerts (kv-write) work immediately. Best-effort by contract:
// a send failure never blocks the approval; the admin panel's MANUAL
// WhatsApp nudge stays the primary delivery channel (India-first reach).
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "NurseHolic <onboarding@resend.dev>";
const SUPPORT_REPLY_TO = Deno.env.get("SUPPORT_EMAIL") || "support@nurseholic.in";

// ---- LOOPS CONTACT SYNC — growth/campaign audience (owner picked 2026-07-06) ---
// INERT until:  supabase secrets set LOOPS_API_KEY="..."
// Resend stays the transactional sender (claim links, owner alerts). Loops
// instead builds a segmentable AUDIENCE the owner can later run broadcast
// campaigns against (hype emails, batch-drop announcements) — no campaign
// exists yet, this just grows the list from day one. Best-effort: a sync
// failure never blocks join/approve; WhatsApp/Resend remain the real
// delivery path for anything time-sensitive.
const LOOPS_API_KEY = Deno.env.get("LOOPS_API_KEY") ?? "";
async function syncLoopsContact(email: string, userGroup: string): Promise<void> {
  if (!LOOPS_API_KEY) return;
  try {
    await fetch("https://app.loops.so/api/v1/contacts/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOOPS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "waitlist", userGroup }),
    });
  } catch { /* best-effort */ }
}
async function sendApprovalInvite(
  email: string, claimUrl: string, _expiresAtIso: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!RESEND_API_KEY) return { sent: false, reason: "email-not-configured" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        reply_to: SUPPORT_REPLY_TO,
        subject: "Your NurseHolic seat is ready 🎉",
        text: `Your seat on the NurseHolic waitlist just opened!\n\n` +
          `Claim it here (one-time link):\n${claimUrl}\n\n` +
          `Your seat is held for 48 hours — after that it goes to the next student in line.\n\n` +
          `See you inside,\nNurseHolic · www.nurseholic.in`,
      }),
    });
    if (!r.ok) return { sent: false, reason: `http-${r.status}` };
    return { sent: true };
  } catch {
    return { sent: false, reason: "network" };
  }
}

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

// ---- token verification: byte-identical to subscription/kv-write ----
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

// ---- one-way hashes for abuse columns (copy of auth-secure) ----------
async function hmac(data: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- client IP + rate limiting (copies of auth-secure; fail OPEN) -----
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
async function rateHit(
  bucket: string, identifier: string, limit: number, windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
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
  } catch { return { allowed: true, retryAfter: 0 }; }
}
function formatWait(seconds: number): string {
  if (seconds >= 3600) { const h = Math.ceil(seconds / 3600); return h === 1 ? "about an hour" : `about ${h} hours`; }
  if (seconds >= 60) { const m = Math.ceil(seconds / 60); return m === 1 ? "about a minute" : `about ${m} minutes`; }
  return `${Math.max(1, seconds)} second${seconds === 1 ? "" : "s"}`;
}
function tooMany(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ ok: false, reason: "rate-limited", retryAfter,
      message: `Too many attempts. Please wait ${formatWait(retryAfter)} and try again.` }),
    { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.max(1, retryAfter)) } },
  );
}

// ---- Turnstile (copy of auth-secure; fail-open when secret unset) ------
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!TURNSTILE_SECRET) return true;
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.set("secret", TURNSTILE_SECRET);
    form.set("response", token);
    if (ip && ip !== "unknown") form.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(),
    });
    if (!r.ok) return true;
    const data = await r.json();
    return !!(data && data.success);
  } catch { return true; }
}

// ---- game_config flags (kv-write cached-read pattern; fail-open OFF) ---
type WlFlags = { collect: boolean; gate: boolean; batchSize: number; schedule: unknown };
let _flags: { v: WlFlags; ts: number } | null = null;
async function waitlistFlags(): Promise<WlFlags> {
  if (_flags && Date.now() - _flags.ts < 60_000) return _flags.v;
  const v: WlFlags = { collect: false, gate: false, batchSize: 25, schedule: null };
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/kv_shared?key=eq.game_config&select=value`,
      { headers: dbHeaders({ Accept: "application/json" }) },
    );
    if (r.ok) {
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) {
        const cfg = JSON.parse(String(rows[0].value));
        const wl = cfg && cfg.waitlist;
        if (wl && typeof wl === "object") {
          v.collect = wl.collect === true;
          v.gate = wl.gate === true;
          if (Number.isFinite(wl.batchSize) && wl.batchSize > 0) v.batchSize = Math.floor(wl.batchSize);
          v.schedule = wl.schedule ?? null;
        }
      }
    }
  } catch { /* fail-open: flags read as OFF */ }
  _flags = { v, ts: Date.now() };
  return v;
}

// =====================================================================
// Validation / scoring — DELIBERATE COPIES of src/lib/waitlist.js.
// Keep in sync by hand; the client copy powers instant form feedback,
// THIS copy is authoritative.
// =====================================================================
const STATE_IDS = new Set([
  "andhra-pradesh", "arunachal-pradesh", "assam", "bihar", "chhattisgarh",
  "goa", "gujarat", "haryana", "himachal-pradesh", "jharkhand", "karnataka",
  "kerala", "madhya-pradesh", "maharashtra", "manipur", "meghalaya",
  "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim",
  "tamil-nadu", "telangana", "tripura", "uttar-pradesh", "uttarakhand",
  "west-bengal", "andaman-nicobar", "chandigarh", "dadra-daman-diu",
  "delhi", "jammu-kashmir", "ladakh", "lakshadweep", "puducherry",
]);
function normalizeWaitlistEmail(raw: unknown): string {
  const s = String(raw == null ? "" : raw).trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at <= 0) return s;
  let local = s.slice(0, at);
  const domain = s.slice(at + 1);
  local = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}
const EMAIL_RE = /^[a-z0-9][a-z0-9._%-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;
function isValidEmail(normalized: string): boolean { return EMAIL_RE.test(String(normalized || "")); }
const TEMP_MAIL_DOMAINS = new Set([
  "10minutemail.com", "tempmail.com", "temp-mail.org", "temp-mail.io",
  "sharklasers.com", "guerrillamail.com", "guerrillamailblock.com",
  "mailinator.com", "yopmail.com", "dispostable.com", "trashmail.com",
  "getnada.com", "maildrop.cc", "fakeinbox.com", "mintemail.com",
  "throwawaymail.com", "emailondeck.com", "mohmal.com", "tempail.com",
  "mailnesia.com", "spambog.com", "mytemp.email", "tmpmail.org",
]);
function isTempMail(email: string): boolean {
  const at = String(email || "").lastIndexOf("@");
  if (at < 0) return false;
  return TEMP_MAIL_DOMAINS.has(String(email).slice(at + 1).toLowerCase().trim());
}
function normalizeWhatsapp(raw: unknown): string | null {
  let d = String(raw == null ? "" : raw).replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function generateWaitlistCode(): string {
  const arr = new Uint8Array(5);
  crypto.getRandomValues(arr);
  let tail = "";
  for (let i = 0; i < 5; i++) tail += CODE_CHARS[arr[i] % CODE_CHARS.length];
  return `NURSE-${tail}`;
}
function parseWaitlistRefCode(raw: unknown): string | null {
  const s = String(raw == null ? "" : raw).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!/^nurse[a-z0-9]{5}$/.test(s)) return null;
  return `NURSE-${s.slice(5).toUpperCase()}`;
}
const INTENT_MAX = 500;
const INTENT_HIGH_CHARS = 50;
function intentScore(answer: unknown): number {
  return String(answer == null ? "" : answer).trim().length > INTENT_HIGH_CHARS ? 5 : 1;
}
function sanitizeFreeText(s: unknown, max: number): string {
  return String(s == null ? "" : s).replace(/<[^>]*>/g, "").trim().slice(0, max);
}
const DAY_MS = 86400000;
function priorityScore(referrals: number, createdAt: string, now: number) {
  const refs = Number.isFinite(referrals) && referrals > 0 ? Math.floor(referrals) : 0;
  const created = Date.parse(createdAt);
  const days = Number.isFinite(created) && created < now ? Math.floor((now - created) / DAY_MS) : 0;
  const referralPts = refs * 100;
  const waitPts = days * 10;
  return { referralPts, waitPts, total: referralPts + waitPts };
}
type DropEntry = { dow: number; h: number; m?: number };
const DEFAULT_DROP_SCHEDULE: DropEntry[] = [{ dow: 2, h: 10, m: 0 }, { dow: 5, h: 15, m: 0 }];
const IST_OFFSET_MS = 330 * 60000;
function validSchedule(schedule: unknown): DropEntry[] | null {
  if (!Array.isArray(schedule)) return null;
  const ok = schedule.filter((e) => e && typeof e === "object"
    && Number.isInteger(e.dow) && e.dow >= 0 && e.dow <= 6
    && Number.isInteger(e.h) && e.h >= 0 && e.h <= 23
    && Number.isInteger(e.m || 0) && (e.m || 0) >= 0 && (e.m || 0) <= 59);
  return ok.length ? ok as DropEntry[] : null;
}
function nextBatchDrop(now: number, schedule: unknown): number | null {
  const entries = validSchedule(schedule) || DEFAULT_DROP_SCHEDULE;
  const ist = new Date(now + IST_OFFSET_MS);
  const base = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const today = ist.getUTCDay();
  let best: number | null = null;
  for (const e of entries) {
    for (let off = 0; off <= 7; off++) {
      if ((today + off) % 7 !== e.dow) continue;
      const candidate = base + off * DAY_MS + (e.h * 60 + (e.m || 0)) * 60000 - IST_OFFSET_MS;
      if (candidate > now && (best === null || candidate < best)) best = candidate;
      if (candidate > now) break;
    }
  }
  return best;
}

// =====================================================================
// Snapshot — one cached read of the slim columns powers rank / referral
// counts / state aggregates. 60s TTL; invalidated after every write so
// positions stay fresh at this scale (<20k rows ≈ ~1MB once a minute).
// =====================================================================
// deno-lint-ignore no-explicit-any
type Row = any;
let _snap: { rows: Row[]; ts: number } | null = null;
function invalidateSnapshot() { _snap = null; }
// Supabase PostgREST caps ANY single response at the project's "Max rows"
// setting (default 1000) — a bare `limit=` silently truncates past that.
// Page with Range headers instead (same fix as api/backup-db.js).
async function selectAllRows(query: string, cap = 20000): Promise<Row[]> {
  const PAGE = 1000;
  const out: Row[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?${query}`, {
      headers: dbHeaders({
        Accept: "application/json",
        "Range-Unit": "items",
        Range: `${from}-${from + PAGE - 1}`,
      }),
    });
    if (!r.ok) throw new Error(`waitlist read failed: ${r.status}`);
    const batch = await r.json();
    if (!Array.isArray(batch)) throw new Error("waitlist read: unexpected body");
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}
async function snapshot(): Promise<Row[]> {
  if (_snap && Date.now() - _snap.ts < 60_000) return _snap.rows;
  const rows = await selectAllRows(
    "select=id,status,state,created_at,own_referral_code,referred_by_code&order=created_at.asc",
  );
  _snap = { rows, ts: Date.now() };
  return _snap.rows;
}
// Referral use-count per code. Rejected rows don't count (fakes); everything
// else does — an expired row is still a real classmate who joined.
function refCounts(rows: Row[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of rows) {
    if (!row.referred_by_code || row.status === "rejected") continue;
    m.set(row.referred_by_code, (m.get(row.referred_by_code) || 0) + 1);
  }
  return m;
}
// 1-based rank among 'waiting' rows: priority score DESC, then oldest first.
function rankAmongWaiting(rows: Row[], now: number): Map<string, number> {
  const counts = refCounts(rows);
  const waiting = rows.filter((r) => r.status === "waiting")
    .map((r) => ({ id: r.id, created: r.created_at, total: priorityScore(counts.get(r.own_referral_code) || 0, r.created_at, now).total }))
    .sort((a, b) => (b.total - a.total) || (Date.parse(a.created) - Date.parse(b.created)));
  const m = new Map<string, number>();
  waiting.forEach((w, i) => m.set(w.id, i + 1));
  return m;
}
function stateCounts(rows: Row[]): { state: string; count: number }[] {
  const m = new Map<string, number>();
  for (const row of rows) {
    if (row.status !== "waiting") continue;
    m.set(row.state, (m.get(row.state) || 0) + 1);
  }
  return [...m.entries()].map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count).slice(0, 8);
}

// ---- REST helpers over the locked table (service-role) ---------------
async function selectRows(query: string): Promise<Row[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?${query}`, {
    headers: dbHeaders({ Accept: "application/json" }),
  });
  if (!r.ok) throw new Error(`waitlist read failed: ${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}
async function insertRow(body: unknown): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
}
// PATCH returning the matched rows (so callers can count what changed).
async function patchRows(query: string, body: unknown): Promise<Row[] | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?${query}`, {
    method: "PATCH",
    headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=representation", Accept: "application/json" }),
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => null);
  return Array.isArray(rows) ? rows : [];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET) return json({ error: "SESSION_SIGNING_SECRET is not set on waitlist" }, 500);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body.action ?? "");
  const ip = clientIp(req);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  try {
    // ================= PUBLIC: join =================
    if (action === "join") {
      const rl = await rateHit("wl-join", ip, 3, 60 * 60);
      if (!rl.allowed) return tooMany(rl.retryAfter);
      const flags = await waitlistFlags();
      if (!flags.collect && !flags.gate) return json({ ok: false, reason: "disabled" });
      if (!(await verifyTurnstile(String(body.captchaToken ?? ""), ip))) {
        return json({ ok: false, reason: "captcha" });
      }

      const email = normalizeWaitlistEmail(body.email).slice(0, 254);
      if (!isValidEmail(email)) return json({ ok: false, reason: "invalid-email" });
      if (isTempMail(email)) return json({ ok: false, reason: "temp-mail" });
      const phone = normalizeWhatsapp(body.whatsapp);
      if (!phone) return json({ ok: false, reason: "invalid-phone" });
      const state = String(body.state ?? "");
      if (!STATE_IDS.has(state)) return json({ ok: false, reason: "invalid-state" });
      const college = sanitizeFreeText(body.college, 120) || null;
      const intentAnswer = sanitizeFreeText(body.intentAnswer, INTENT_MAX) || null;

      // Uniqueness pre-checks (the DB UNIQUEs are the real guard; these give
      // precise reasons). NEVER echo the existing row's data — enumeration guard.
      const dupEmail = await selectRows(`email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
      if (dupEmail.length) return json({ ok: false, reason: "exists" });
      const dupPhone = await selectRows(`whatsapp_num=eq.${encodeURIComponent(phone)}&select=id&limit=1`);
      if (dupPhone.length) return json({ ok: false, reason: "phone-exists" });

      // Referral resolution: a parseable NURSE- code that exists (and isn't a
      // rejected fake) counts; anything else is kept raw for attribution only.
      let referredBy: string | null = null;
      let arrivalRef: string | null = null;
      const rawRef = body.ref == null ? "" : String(body.ref).slice(0, 40);
      const parsed = parseWaitlistRefCode(rawRef);
      if (parsed) {
        const refRow = await selectRows(`own_referral_code=eq.${encodeURIComponent(parsed)}&select=id,status&limit=1`);
        if (refRow.length && refRow[0].status !== "rejected") referredBy = parsed;
        else if (rawRef) arrivalRef = rawRef;
      } else if (rawRef) {
        arrivalRef = rawRef;
      }

      // Abuse signals — one-way HMACs only (signup_events convention).
      const ipHash = ip && ip !== "unknown" ? toHex((await hmac(ip)).buffer) : null;
      const fpRaw = body.fp == null ? "" : String(body.fp).slice(0, 256);
      const fpHash = fpRaw ? toHex((await hmac(fpRaw)).buffer) : null;

      // Insert with a fresh code; 409 = code collision or a signup race →
      // retry the code, then fall back to the generic "exists".
      let code = "";
      let inserted = false;
      for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
        code = generateWaitlistCode();
        const r = await insertRow({
          email, whatsapp_num: phone, state, college,
          intent_answer: intentAnswer, intent_score: intentScore(intentAnswer),
          own_referral_code: code, referred_by_code: referredBy, arrival_ref: arrivalRef,
          ip_hash: ipHash, fp_hash: fpHash,
        });
        if (r.ok) { inserted = true; break; }
        if (r.status !== 409) {
          return json({ error: `join failed: ${r.status} ${await r.text().catch(() => "")}`.trim() }, 502);
        }
      }
      if (!inserted) return json({ ok: false, reason: "exists" });
      invalidateSnapshot();
      await syncLoopsContact(email, "waitlist-joined");

      // Referral milestone (§7.2-hardened): 3 uses → the referrer + all their
      // still-waiting referees move to pending_verification for admin review.
      if (referredBy) {
        try {
          const uses = await selectRows(`referred_by_code=eq.${encodeURIComponent(referredBy)}&status=not.eq.rejected&select=id`);
          if (uses.length >= MILESTONE) {
            await patchRows(`own_referral_code=eq.${encodeURIComponent(referredBy)}&status=eq.waiting`,
              { status: "pending_verification", updated_at: nowIso });
            await patchRows(`referred_by_code=eq.${encodeURIComponent(referredBy)}&status=eq.waiting`,
              { status: "pending_verification", updated_at: nowIso });
            invalidateSnapshot();
          }
        } catch { /* milestone is best-effort; the row is already in line */ }
      }

      const rows = await snapshot();
      const myRow = rows.find((r) => r.own_referral_code === code);
      const position = myRow ? (rankAmongWaiting(rows, now).get(myRow.id) ?? null) : null;
      return json({
        ok: true, code, position,
        totalWaiting: rows.filter((r) => r.status === "waiting").length,
        nextDropAt: nextBatchDrop(now, flags.schedule),
      });
    }

    // ================= PUBLIC: status =================
    if (action === "status") {
      const rl = await rateHit("wl-status", ip, 10, 15 * 60);
      if (!rl.allowed) return tooMany(rl.retryAfter);
      const flags = await waitlistFlags();
      if (!flags.collect && !flags.gate) return json({ ok: false, reason: "disabled" });

      const email = normalizeWaitlistEmail(body.email);
      if (!isValidEmail(email)) return json({ ok: false, reason: "not-found" });
      const found = await selectRows(`email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
      if (!found.length) return json({ ok: false, reason: "not-found" });
      let row = found[0];

      // Lazy expiry: a stale approval reads (and flips) to expired here, so
      // correctness never depends on the admin sweep.
      if (row.status === "approved" && row.approval_expires_at && Date.parse(row.approval_expires_at) < now) {
        await patchRows(`id=eq.${encodeURIComponent(row.id)}&status=eq.approved`,
          { status: "expired", claim_token: null, updated_at: nowIso });
        invalidateSnapshot();
        row = { ...row, status: "expired", claim_token: null };
      }

      const rows = await snapshot();
      const counts = refCounts(rows);
      const referrals = counts.get(row.own_referral_code) || 0;
      const score = priorityScore(referrals, row.created_at, now);
      const position = row.status === "waiting" ? (rankAmongWaiting(rows, now).get(row.id) ?? null) : null;

      // Claim token is revealed ONLY with proof of ownership: the caller must
      // also present the row's own NURSE- code (handed out at join, persisted
      // on their device). Email alone never unlocks a seat.
      const provedCode = parseWaitlistRefCode(body.code);
      const proved = !!provedCode && safeEqual(provedCode, String(row.own_referral_code));
      const isClaimable = row.status === "approved" && !!row.claim_token;

      return json({
        ok: true,
        status: row.status,
        state: row.state,
        position,
        totalWaiting: rows.filter((r) => r.status === "waiting").length,
        referrals, score,
        joinedAt: Date.parse(row.created_at) || null,
        nextDropAt: nextBatchDrop(now, flags.schedule),
        ...(isClaimable && proved
          ? { claimToken: row.claim_token, claimExpiresAt: Date.parse(row.approval_expires_at) || null }
          : {}),
      });
    }

    // ================= PUBLIC: stats =================
    if (action === "stats") {
      const rl = await rateHit("wl-stats", ip, 30, 15 * 60);
      if (!rl.allowed) return tooMany(rl.retryAfter);
      const flags = await waitlistFlags();
      if (!flags.collect && !flags.gate) return json({ ok: false, reason: "disabled" });
      const rows = await snapshot();
      return json({
        ok: true,
        totalWaiting: rows.filter((r) => r.status === "waiting").length,
        byState: stateCounts(rows),
        nextDropAt: nextBatchDrop(now, flags.schedule),
      });
    }

    // ================= ADMIN =================
    const session = await verifyToken(body.token);
    if (!session) return json({ error: "Not authenticated" }, 401);
    if (!(await isAdmin(session))) return json({ error: "Forbidden" }, 403);

    if (action === "admin-list") {
      const rows = await selectAllRows("select=*&order=created_at.desc", 5000);
      const counts = refCounts(rows);
      const rank = rankAmongWaiting(rows, now);
      const out = rows.map((r) => {
        const referrals = counts.get(r.own_referral_code) || 0;
        const expired = r.status === "approved" && r.approval_expires_at && Date.parse(r.approval_expires_at) < now;
        return {
          ...r,
          referrals,
          score: priorityScore(referrals, r.created_at, now),
          position: rank.get(r.id) ?? null,
          effectiveStatus: expired ? "expired" : r.status,
        };
      });
      const statusCounts: Record<string, number> = {};
      for (const r of out) statusCounts[r.effectiveStatus] = (statusCounts[r.effectiveStatus] || 0) + 1;

      // Abuse cluster flags per referral code (referral-intel pattern):
      // shared IP/device inside a cluster, or ≥3 joins within 10 minutes.
      const flags: { kind: string; code: string; count: number }[] = [];
      const byCode = new Map<string, Row[]>();
      for (const r of rows) {
        if (!r.referred_by_code) continue;
        const list = byCode.get(r.referred_by_code) || [];
        list.push(r);
        byCode.set(r.referred_by_code, list);
      }
      for (const [code, group] of byCode) {
        const referrer = rows.find((r) => r.own_referral_code === code);
        const withRef = referrer ? [...group, referrer] : group;
        for (const field of ["ip_hash", "fp_hash"] as const) {
          const seen = new Map<string, number>();
          for (const g of withRef) {
            if (!g[field]) continue;
            seen.set(g[field], (seen.get(g[field]) || 0) + 1);
          }
          const max = Math.max(0, ...seen.values());
          if (max >= 2) flags.push({ kind: field === "ip_hash" ? "same-ip" : "same-device", code, count: max });
        }
        const times = group.map((g) => Date.parse(g.created_at)).sort((a, b) => a - b);
        for (let i = 0; i + 2 < times.length; i++) {
          if (times[i + 2] - times[i] <= 10 * 60 * 1000) { flags.push({ kind: "velocity", code, count: group.length }); break; }
        }
      }

      const cfg = await waitlistFlags();
      return json({ ok: true, rows: out, counts: statusCounts, flags, suggestedBatch: cfg.batchSize });
    }

    if (action === "admin-approve") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter((s: string) => UUID_RE.test(s)).slice(0, MAX_APPROVE_IDS);
      if (!ids.length) return json({ error: "No valid ids" }, 400);
      const expiresAt = new Date(now + CLAIM_TTL_MS).toISOString();
      const approved: { id: string; email: string; whatsapp: string; claimToken: string; expiresAt: string; emailed: boolean }[] = [];
      for (const id of ids) {
        const claimToken = crypto.randomUUID();
        const changed = await patchRows(
          `id=eq.${encodeURIComponent(id)}&status=in.(waiting,pending_verification,expired)`,
          { status: "approved", claim_token: claimToken, approval_expires_at: expiresAt, updated_at: nowIso },
        );
        if (changed && changed.length) {
          // Email invite — placeholder no-op until a provider is wired (see
          // sendApprovalInvite). Best-effort: a send failure never blocks approval.
          let emailed = false;
          try {
            emailed = (await sendApprovalInvite(
              changed[0].email, `${APP_ORIGIN}/?claim=${claimToken}`, expiresAt,
            )).sent;
          } catch { /* best-effort */ }
          await syncLoopsContact(changed[0].email, "waitlist-approved");
          approved.push({ id, email: changed[0].email, whatsapp: changed[0].whatsapp_num, claimToken, expiresAt, emailed });
        }
      }
      invalidateSnapshot();
      return json({ ok: true, approved });
    }

    if (action === "admin-reject") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter((s: string) => UUID_RE.test(s)).slice(0, MAX_APPROVE_IDS);
      if (!ids.length) return json({ error: "No valid ids" }, 400);
      const changed = await patchRows(
        `id=in.(${ids.map((s: string) => encodeURIComponent(s)).join(",")})&status=not.eq.onboarded`,
        { status: "rejected", claim_token: null, updated_at: nowIso },
      );
      invalidateSnapshot();
      return json({ ok: true, rejected: changed ? changed.length : 0 });
    }

    if (action === "admin-expire-sweep") {
      const changed = await patchRows(
        `status=eq.approved&approval_expires_at=lt.${encodeURIComponent(nowIso)}`,
        { status: "expired", claim_token: null, updated_at: nowIso },
      );
      invalidateSnapshot();
      return json({ ok: true, expired: changed ? changed.length : 0 });
    }

    // ADMIN-TEST-INVITE — send a SAMPLE approval email to a chosen address
    // through the EXACT real path (sendApprovalInvite → Resend, same EMAIL_FROM
    // + RESEND_API_KEY the live approvals use). Writes nothing to the table.
    // Surfaces the provider result so the owner can confirm end-to-end:
    //   { sent:true }                       → delivered from the verified domain
    //   { sent:false, reason:'email-not-configured' } → RESEND_API_KEY unset
    //   { sent:false, reason:'http-403' }   → the from-domain isn't verified yet
    if (action === "admin-test-invite") {
      const email = normalizeWaitlistEmail(body.email).slice(0, 254);
      if (!isValidEmail(email)) return json({ ok: false, reason: "invalid-email" });
      const sampleExpiry = new Date(now + CLAIM_TTL_MS).toISOString();
      const result = await sendApprovalInvite(email, `${APP_ORIGIN}/?claim=test-${crypto.randomUUID()}`, sampleExpiry);
      // Echo the from-address in play so the UI can show what it sent AS.
      return json({ ok: true, sent: result.sent, reason: result.reason ?? null, from: EMAIL_FROM, to: email });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
