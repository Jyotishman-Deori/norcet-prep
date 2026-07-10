// =====================================================================
// supabase/functions/media-sign/index.ts — presigned-upload broker for the
// Cloudflare R2 media bucket ("the heavy lifter": question figures, clips).
//
// The app never proxies file bytes and never ships R2 credentials: a
// coadmin+ admin asks this function to SIGN one upload, gets back a
// presigned PUT URL (10 min), and the browser PUTs the file straight to
// R2. Students only ever read the public URLs stored on questions.
//
//   action:"sign"  { token, filename, contentType, size, folder? }
//     -> { uploadUrl, publicUrl, key }
//
// Auth = the same HMAC session token as every broker; role read from
// admin_profile_ids PER CALL (fail-closed: no row / no role -> 403).
// Limits: image/* or video/* only, 20MB, sanitized key
// q/<yyyymm>/<slug>-<rand>.<ext>.
//
// SECRETS (supabase secrets set ...):
//   SESSION_SIGNING_SECRET  - same value as the other brokers
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   R2_PUBLIC_BASE          - the bucket's public URL (https://pub-x.r2.dev
//                             or a custom domain), no trailing slash
//
// DEPLOY: supabase functions deploy media-sign --no-verify-jwt
// Owner setup runbook: docs/media-r2.md (bucket, public access, CORS).
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SESSION_SECRET = Deno.env.get("SESSION_SIGNING_SECRET") ?? "";
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
const R2_BUCKET = Deno.env.get("R2_BUCKET") ?? "";
const R2_PUBLIC_BASE = (Deno.env.get("R2_PUBLIC_BASE") ?? "").replace(/\/+$/, "");

const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const EXPIRES_SEC = 600;            // presigned URL lifetime

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

// ---- session-token verification: byte-identical to the other brokers ----
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

// STAFF ROLES — coadmin+ may sign uploads (content authoring is Co-Admin+,
// same bar as bank: writes). Legacy fallback: membership without role = coadmin.
type StaffRole = "admin" | "coadmin" | "moderator";
const ROLE_RANK: Record<StaffRole, number> = { admin: 3, coadmin: 2, moderator: 1 };
async function isCoadminPlus(s: Session): Promise<boolean> {
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
  return best >= 2;
}

// ---- AWS SigV4 presigned PUT (query auth) against the R2 S3 endpoint ----
const enc = new TextEncoder();
function hex(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
async function hmacRaw(key: Uint8Array | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key instanceof Uint8Array ? key.buffer as ArrayBuffer : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
async function presignPut(key: string): Promise<string> {
  const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // YYYYMMDDTHHMMSSZ
  const date = amzDate.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const path = `/${R2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const q: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${R2_ACCESS_KEY_ID}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(EXPIRES_SEC)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQuery = q
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join("&");
  const canonicalRequest = ["PUT", path, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
  let k: ArrayBuffer = await hmacRaw(enc.encode("AWS4" + R2_SECRET_ACCESS_KEY), date);
  k = await hmacRaw(k, "auto");
  k = await hmacRaw(k, "s3");
  k = await hmacRaw(k, "aws4_request");
  const signature = hex(await hmacRaw(k, stringToSign));
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// ---- key building: q/<yyyymm>/<slug>-<rand>.<ext> ----
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
function buildKey(folder: string, filename: string, contentType: string): string | null {
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) return null;
  const dir = /^[a-z0-9-]{1,24}$/.test(folder) ? folder : "q";
  const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
  const slug = String(filename)
    .replace(/\.[^.]*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "file";
  const rand = crypto.randomUUID().slice(0, 8);
  return `${dir}/${yyyymm}/${slug}-${rand}.${ext}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET) return json({ error: "SESSION_SIGNING_SECRET is not set on media-sign" }, 500);

  let body: { action?: string; token?: unknown; filename?: string; contentType?: string; size?: number; folder?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (body.action !== "sign") return json({ error: "Unknown action" }, 400);

  const session = await verifyToken(body.token);
  if (!session) return json({ error: "Not authenticated" }, 401);
  if (!(await isCoadminPlus(session))) return json({ error: "Forbidden: co-admin or above" }, 403);

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_BASE) {
    return json({ error: "R2 is not configured yet. Set the R2_* secrets per docs/media-r2.md." }, 500);
  }

  const contentType = String(body.contentType || "");
  if (!/^(image|video)\//.test(contentType)) return json({ error: "Only image or video files are allowed." }, 400);
  const size = Number(body.size || 0);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return json({ error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB).` }, 400);
  }
  const key = buildKey(String(body.folder || "q"), String(body.filename || "file"), contentType);
  if (!key) return json({ error: `Unsupported file type: ${contentType}` }, 400);

  try {
    const uploadUrl = await presignPut(key);
    return json({ uploadUrl, publicUrl: `${R2_PUBLIC_BASE}/${key}`, key, expiresIn: EXPIRES_SEC });
  } catch (e) {
    return json({ error: `sign failed: ${(e as Error).message ?? e}` }, 500);
  }
});
