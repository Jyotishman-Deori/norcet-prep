// =====================================================================
// supabase/functions/content-staging/index.ts
// Admin-only broker for the AI question-staging pipeline.
//
// Exposes four actions over a single POST endpoint:
//   list     → return all rows in questions_staging (oldest first)
//   approve  → call approve_staging_question() RPC, which atomically
//              moves the row into the target bank in kv_shared
//   delete   → hard-delete a staging row (admin rejected it)
//   generate → run a two-stage Gemini draft and INSERT the questions
//              into questions_staging for review (admin-triggered)
//
// AUTH: identical to kv-write — verifies the HMAC session token
// (SESSION_SIGNING_SECRET), then checks admin_profile_ids.
// Non-admins receive 403 (fail-closed). Missing / invalid token → 401.
//
// ⚠️  RUNTIME-AI EXCEPTION (sanctioned): CLAUDE.md forbids LLM calls in the
//     shipped app. The `generate` action is a DELIBERATE, admin-only,
//     human-reviewed exception — every drafted question lands in the staging
//     queue and an admin must Approve it before it can reach a student. The
//     GEMINI_API_KEY is a server-side Supabase secret, never in any bundle.
//     Google AI Studio billing MUST stay OFF (over-limit → HTTP 429, never a
//     bill). Do NOT "fix" this by removing it.
//
// DEPLOY:
//   supabase secrets set GEMINI_API_KEY=<key> GEMINI_MODEL=gemini-2.5-flash
//   supabase functions deploy content-staging --no-verify-jwt
// (--no-verify-jwt is required: we handle auth ourselves via the
//  session token, not Supabase JWT. Mirrors every other function in
//  this project. See supabase/config.toml.)
// =====================================================================

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SESSION_SECRET = Deno.env.get("SESSION_SIGNING_SECRET") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL   = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

// Exam topic ids → full names (mirrors scripts/generate.js + src/data/seed.js).
// Doubles as the allow-list: only these topic ids may be generated.
const TOPIC_NAMES: Record<string, string> = {
  fund: "Fundamentals of Nursing", anat: "Anatomy & Physiology", msn: "Medical-Surgical Nursing",
  pharm: "Pharmacology", peds: "Pediatric Nursing", obg: "Obstetrics & Gynaecology",
  ch: "Community Health", mhn: "Mental Health Nursing", micro: "Microbiology", nutr: "Nutrition",
  gk: "General Knowledge", apt: "Reasoning & Aptitude",
};

// ---- CORS + helpers (verbatim from kv-write) -------------------------
const cors = {
  "Access-Control-Allow-Origin":  "*",
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
  return {
    apikey:        SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    ...(extra ?? {}),
  };
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- Token verification (verbatim from kv-write) ----------------------
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmacB64(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
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
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch { return null; }
  if (!payload.id || typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  return { id: String(payload.id), uid: payload.uid == null ? null : String(payload.uid) };
}

// ---- Admin check (verbatim from kv-write) ----------------------------
async function isAdmin(s: Session): Promise<boolean> {
  const ids = [s.id, s.uid].filter(Boolean).map((v) => encodeURIComponent(String(v)));
  if (!ids.length) return false;
  const url = `${SUPABASE_URL}/rest/v1/admin_profile_ids`
    + `?profile_id=in.(${ids.join(",")})&select=profile_id`;
  const r = await fetch(url, { headers: dbHeaders({ Accept: "application/json" }) });
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

// ---- Gemini generation (the sanctioned runtime-AI exception) ---------
// Direct REST call — no SDK import, so the function stays light. Ported from
// scripts/generate.js (kept in sync by hand; different runtimes can't share).
async function gemini(prompt: string): Promise<string> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
    + `?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const r = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Gemini ${r.status}: ${text.slice(0, 200)}`);
  }
  const data = await r.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof out === "string" ? out : "";
}

// Pull a JSON array out of a model response (tolerates ```json fences / prose).
function extractJsonArray(text: string): unknown {
  let s = String(text || "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("[");
  const end   = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON array in model output");
  return JSON.parse(s.slice(start, end + 1));
}

// Keep only well-formed questions matching the app's schema.
// deno-lint-ignore no-explicit-any
function validate(q: any): boolean {
  if (!q || typeof q !== "object") return false;
  if (typeof q.q !== "string" || !q.q.trim()) return false;
  if (!Array.isArray(q.options) || q.options.length < 2) return false;
  if (q.type !== "mcq" && q.type !== "msq") return false;
  if (!Array.isArray(q.correct) || q.correct.length < 1) return false;
  if (!q.correct.every((i: unknown) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < q.options.length)) return false;
  return true;
}

// Two-stage draft → validated rows ready for questions_staging.
// deno-lint-ignore no-explicit-any
async function generateQuestions(topic: string, count: number): Promise<any[]> {
  const topicName = TOPIC_NAMES[topic] || topic;

  // Stage 1: brainstorm scenarios.
  const stage1 = await gemini(
    `You are a senior NORCET (Indian nursing officer exam) question author.\n` +
    `Brainstorm exactly ${count} ADVANCED exam scenarios for the topic "${topicName}".\n` +
    `Use a spread of difficulties (easy, medium, hard). Focus on clinical reasoning, ` +
    `prioritisation, and applied judgement — AVOID basic definitions and rote recall.\n` +
    `For each, give a one-line scenario and the single key concept it tests. Number them 1–${count}.`,
  );
  if (!stage1.trim()) throw new Error("Stage 1 returned empty output");

  // Stage 2: format to strict JSON matching the DB schema.
  const stage2 = await gemini(
    `Convert these NORCET scenarios into a STRICT JSON ARRAY. Output JSON ONLY — no prose, no code fences.\n\n` +
    `Each element MUST match exactly:\n` +
    `{"topic":"${topic}","sub":"<subtopic>","type":"mcq"|"msq","q":"<question>",` +
    `"options":["..."],"correct":[<0-based index ints>],"exp":"<why the answer is right>",` +
    `"wrong":{"<optIndex>":"<why that option is wrong>"},"memoryTip":"<mnemonic/recall hook>",` +
    `"difficulty":"easy"|"medium"|"hard","image":null}\n\n` +
    `Rules: "type" is "msq" only when there are multiple correct answers (else "mcq"). ` +
    `"correct" indexes into "options". "wrong" has an entry for each INCORRECT option index. ` +
    `Keep "topic" exactly "${topic}". Return all ${count}.\n\nScenarios:\n${stage1}`,
  );

  const parsed = extractJsonArray(stage2);
  if (!Array.isArray(parsed)) throw new Error("Stage 2 did not return an array");

  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  for (const q of parsed) {
    if (!validate(q)) continue;
    rows.push({
      topic,
      sub:        typeof q.sub === "string" ? q.sub : null,
      type:       q.type,
      q:          q.q,
      options:    q.options,
      correct:    q.correct,
      exp:        typeof q.exp === "string" ? q.exp : null,
      wrong:      (q.wrong && typeof q.wrong === "object") ? q.wrong : {},
      memoryTip:  typeof q.memoryTip === "string" ? q.memoryTip : null,
      difficulty: ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : null,
      image:      q.image == null ? null : String(q.image),
    });
  }
  return rows;
}

// ---- Main handler ----------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);
  if (!SESSION_SECRET)          return json({ error: "SESSION_SIGNING_SECRET is not set" }, 500);

  let body: { action?: string; id?: string; targetBankKey?: string; topic?: string; count?: number; token?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  // Authenticate.
  const session = await verifyToken(body.token);
  if (!session) return json({ error: "Not authenticated" }, 401);

  // Admin-only — fail closed.
  const admin = await isAdmin(session);
  if (!admin) return json({ error: "Forbidden: admin only" }, 403);

  const action = String(body.action ?? "");

  // ---- list -----------------------------------------------------------
  if (action === "list") {
    const url = `${SUPABASE_URL}/rest/v1/questions_staging`
      + `?select=*&order=created_at.asc`;
    const r = await fetch(url, {
      headers: dbHeaders({ Accept: "application/json" }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return json({ error: `list failed: ${r.status} ${text.slice(0, 200)}` }, 502);
    }
    const rows = await r.json();
    return json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
  }

  // ---- approve --------------------------------------------------------
  if (action === "approve") {
    const id            = String(body.id ?? "").trim();
    const targetBankKey = String(body.targetBankKey ?? "").trim();
    if (!id)            return json({ error: "Missing id" }, 400);
    if (!targetBankKey) return json({ error: "Missing targetBankKey" }, 400);
    // targetBankKey must be a bank: key to prevent writes to arbitrary kv rows.
    if (!targetBankKey.startsWith("bank:")) {
      return json({ error: "targetBankKey must start with 'bank:'" }, 400);
    }

    const url = `${SUPABASE_URL}/rest/v1/rpc/approve_staging_question`;
    const r = await fetch(url, {
      method:  "POST",
      headers: dbHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body:    JSON.stringify({ question_id: id, target_bank_key: targetBankKey }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return json({ error: `approve failed: ${r.status} ${text.slice(0, 200)}` }, 502);
    }
    return json({ ok: true });
  }

  // ---- delete ---------------------------------------------------------
  if (action === "delete") {
    const id = String(body.id ?? "").trim();
    if (!id) return json({ error: "Missing id" }, 400);

    const url = `${SUPABASE_URL}/rest/v1/questions_staging`
      + `?id=eq.${encodeURIComponent(id)}`;
    const r = await fetch(url, {
      method:  "DELETE",
      headers: dbHeaders({ Prefer: "return=minimal" }),
    });
    if (!r.ok && r.status !== 404) {
      const text = await r.text().catch(() => "");
      return json({ error: `delete failed: ${r.status} ${text.slice(0, 200)}` }, 502);
    }
    return json({ ok: true });
  }

  // ---- generate (sanctioned admin-only runtime-AI exception) ----------
  if (action === "generate") {
    if (!GEMINI_API_KEY) {
      return json({ error: "Generation not configured (GEMINI_API_KEY unset)" }, 500);
    }
    // Validate topic against the allow-list; clamp count to a safe range.
    const topic = String(body.topic ?? "msn").trim();
    if (!TOPIC_NAMES[topic]) {
      return json({ error: `Unknown topic '${topic}'` }, 400);
    }
    const rawCount = Number(body.count);
    const count = Number.isFinite(rawCount) ? Math.min(8, Math.max(1, Math.round(rawCount))) : 5;

    // deno-lint-ignore no-explicit-any
    let rows: any[];
    try {
      rows = await generateQuestions(topic, count);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: `generation failed: ${msg}` }, 502);
    }
    if (rows.length === 0) {
      return json({ error: "Model returned no valid questions — try again" }, 502);
    }

    const url = `${SUPABASE_URL}/rest/v1/questions_staging`;
    const r = await fetch(url, {
      method:  "POST",
      headers: dbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body:    JSON.stringify(rows),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return json({ error: `insert failed: ${r.status} ${text.slice(0, 200)}` }, 502);
    }
    return json({ ok: true, inserted: rows.length });
  }

  // ---- unknown action -------------------------------------------------
  return json({ error: `Unknown action: '${action}'` }, 400);
});
