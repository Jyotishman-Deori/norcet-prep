// =====================================================================
// supabase/functions/referral-compare/index.ts  (Phase 3 — batches + the
// consented mutual weekly accuracy comparison).
//
// This is the ONLY place cross-user accuracy is ever computed, and it enforces
// every privacy rule server-side. The anon path is never used for it.
//
// OPS (all require a valid session token):
//   create-batch   {name, expiryDays}  -> {batchId}
//       Writes a batch:<id> record (service-role — the kv-write broker fails
//       closed on a `batch:` prefix). The client then adds the id to its own
//       data.batches and shares ?batch=<id>. expiryDays ∈ {7,30,0(never)}.
//   peer-comparison                     -> {optedIn, you?, peers?}
//       1:1 weekly accuracy vs the people the caller is referral-connected to
//       (their referrer + anyone they referred). A peer appears ONLY if BOTH
//       sides have comparison turned on. Returns COUNTS + percentages, warmly.
//   batch-comparison {batchId}          -> {optedIn, member, yourPct?, batchAvg?, rank?, activeCount, threshold}
//       The caller's rank + the batch average among members who (a) opted in
//       and (b) were active this week. Rank is withheld below `threshold` (5)
//       active members so a small group can't be reverse-engineered. Never
//       returns individual names or scores.
//
// CONSENT MODEL: a user participates only when data.preferences.compareOptIn
// is true (set + persisted client-side in their own blob). Turning it off makes
// them vanish from everyone's comparison immediately — it's read fresh here on
// every call, so there is no stale exposure. Batch membership lives in each
// member's own private blob (data.batches), never in an anon-readable key, so
// the social graph isn't exposed; this function discovers members by scanning
// blobs with the service-role key.
//
// DEPLOY:
//   supabase secrets set SESSION_SIGNING_SECRET="<same value as the others>"
//   supabase functions deploy referral-compare --no-verify-jwt
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

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ACTIVE = 5;          // batch comparison needs ≥5 opted-in active members for rank
const MAX_NAME = 60;

// ---- kv_shared service-role helpers ----
async function kvSet(key: string, value: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_shared?on_conflict=key`, {
    method: "POST",
    headers: dbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ key, value }),
  });
  return r.ok;
}
async function kvGet(key: string): Promise<string | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_shared?key=eq.${encodeURIComponent(key)}&select=value`, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return null;
  const rows = await r.json();
  return (Array.isArray(rows) && rows.length) ? rows[0].value : null;
}
type Blob = Record<string, unknown>;
async function allProfiles(): Promise<Array<{ id: string; blob: Blob }>> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_shared?key=like.profile:*&select=key,value`, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return [];
  const rows = await r.json() as Array<{ key: string; value: string }>;
  const out: Array<{ id: string; blob: Blob }> = [];
  for (const row of (Array.isArray(rows) ? rows : [])) {
    try { out.push({ id: row.key.slice("profile:".length), blob: JSON.parse(row.value) }); } catch { /* skip */ }
  }
  return out;
}

// ---- weekly accuracy from a blob's dailyHistory ----
function weekStartStr(): string {
  const d = new Date();
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (dt.getUTCDay() + 6) % 7; // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}
function weeklyAccuracy(blob: Blob): { pct: number; count: number } {
  const data = (blob as { data?: { dailyHistory?: Array<{ date?: string; attempted?: number; correct?: number }> } }).data || {};
  const dh = Array.isArray(data.dailyHistory) ? data.dailyHistory : [];
  const ws = weekStartStr();
  let att = 0, cor = 0;
  for (const e of dh) {
    if (e && typeof e.date === "string" && e.date >= ws) {
      att += Number(e.attempted) || 0;
      cor += Number(e.correct) || 0;
    }
  }
  return { pct: att > 0 ? Math.round((100 * cor) / att) : 0, count: att };
}
function optedIn(blob: Blob): boolean {
  const prefs = ((blob as { data?: { preferences?: { compareOptIn?: unknown } } }).data || {}).preferences || {};
  return prefs.compareOptIn === true;
}
function batchesOf(blob: Blob): string[] {
  const b = ((blob as { data?: { batches?: unknown } }).data || {}).batches;
  return Array.isArray(b) ? b.map(String) : [];
}
function displayNameOf(blob: Blob, id: string): string {
  return String((blob as { displayName?: unknown }).displayName ?? "") || id;
}

async function createBatch(session: Session, name: unknown, expiryDays: unknown): Promise<Response> {
  const nm = String(name ?? "").trim().slice(0, MAX_NAME);
  if (!nm) return json({ error: "Batch needs a name" }, 400);
  const days = (expiryDays === 7 || expiryDays === 30 || expiryDays === 0) ? expiryDays : 30;
  const batchId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  // creator display name (best-effort from their blob)
  let creatorName = session.id;
  const own = await kvGet(`profile:${session.id}`);
  if (own) { try { creatorName = displayNameOf(JSON.parse(own), session.id); } catch { /* keep id */ } }
  const record = {
    id: batchId,
    name: nm,
    creatorId: session.id,
    creatorName,
    createdAt: Date.now(),
    expiresAt: days > 0 ? Date.now() + days * DAY_MS : null,
  };
  const ok = await kvSet(`batch:${batchId}`, JSON.stringify(record));
  if (!ok) return json({ error: "Could not create batch" }, 502);
  return json({ batchId, name: nm, expiresAt: record.expiresAt });
}

async function peerComparison(session: Session): Promise<Response> {
  const profiles = await allProfiles();
  const byId = new Map(profiles.map((p) => [p.id, p.blob]));
  const me = byId.get(session.id);
  if (!me) return json({ optedIn: false });
  if (!optedIn(me)) return json({ optedIn: false });

  // Connected peers: my referrer + everyone I referred.
  const peerIds = new Set<string>();
  const myReferrer = String((me as { referredBy?: unknown }).referredBy ?? "");
  if (myReferrer && byId.has(myReferrer)) peerIds.add(myReferrer);
  for (const p of profiles) {
    if (String((p.blob as { referredBy?: unknown }).referredBy ?? "") === session.id) peerIds.add(p.id);
  }

  const mine = weeklyAccuracy(me);
  const peers: Array<{ name: string; pct: number; count: number }> = [];
  for (const pid of peerIds) {
    const blob = byId.get(pid);
    if (!blob || !optedIn(blob)) continue;          // peer must also opt in
    const wa = weeklyAccuracy(blob);
    peers.push({ name: displayNameOf(blob, pid), pct: wa.pct, count: wa.count });
  }
  // Most active peer first (nicer default for the 1:1 card).
  peers.sort((a, b) => b.count - a.count);
  return json({ optedIn: true, you: mine, peers });
}

async function batchComparison(session: Session, batchId: unknown): Promise<Response> {
  const id = String(batchId ?? "");
  if (!id) return json({ error: "Missing batchId" }, 400);
  const profiles = await allProfiles();
  const me = profiles.find((p) => p.id === session.id);
  if (!me) return json({ error: "Unknown caller" }, 404);
  const iAmMember = batchesOf(me.blob).includes(id);
  if (!iAmMember) return json({ error: "Not a member of this batch" }, 403);
  if (!optedIn(me.blob)) return json({ optedIn: false, member: true });

  // Opted-in members who were active this week (attempted > 0).
  const members = profiles.filter((p) => batchesOf(p.blob).includes(id));
  const active: Array<{ id: string; pct: number }> = [];
  for (const m of members) {
    if (!optedIn(m.blob)) continue;
    const wa = weeklyAccuracy(m.blob);
    if (wa.count > 0) active.push({ id: m.id, pct: wa.pct });
  }
  const activeCount = active.length;
  const batchAvg = activeCount ? Math.round(active.reduce((s, a) => s + a.pct, 0) / activeCount) : 0;
  const myWa = weeklyAccuracy(me.blob);
  const yourPct = myWa.count > 0 ? myWa.pct : null;

  // Rank only when there are enough active members to keep it non-identifying.
  let rank: number | null = null;
  if (activeCount >= MIN_ACTIVE && yourPct !== null) {
    const sorted = [...active].sort((a, b) => b.pct - a.pct);
    rank = sorted.findIndex((a) => a.id === session.id) + 1; // 1-based
    if (rank === 0) rank = null;
  }
  return json({
    optedIn: true, member: true,
    memberCount: members.length, activeCount,
    batchAvg, yourPct, rank, threshold: MIN_ACTIVE,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET) return json({ error: "SESSION_SIGNING_SECRET is not set on referral-compare" }, 500);

  let body: { op?: string; token?: unknown; name?: unknown; expiryDays?: unknown; batchId?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const session = await verifyToken(body.token);
  if (!session) return json({ error: "Not authenticated" }, 401);

  try {
    if (body.op === "create-batch")    return await createBatch(session, body.name, body.expiryDays);
    if (body.op === "peer-comparison") return await peerComparison(session);
    if (body.op === "batch-comparison")return await batchComparison(session, body.batchId);
    return json({ error: "Unknown op" }, 400);
  } catch (e) {
    return json({ error: `server error: ${(e as Error).message ?? e}` }, 500);
  }
});
