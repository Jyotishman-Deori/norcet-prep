// =====================================================================
// supabase/functions/admin-manage/index.ts
// Secure admin-management endpoint for NORCET Prep.
//
// WHY: the public app can only READ admin_profile_ids (anon select). All
// WRITES go through here. The passphrase is verified SERVER-SIDE, and the
// row is written with the service-role key — which bypasses RLS and never
// reaches the browser. This is what makes the lockdown actually secure.
//
// DEPLOY:
//   supabase functions deploy admin-manage --no-verify-jwt
// SET THE SECRET (this is the passphrase users type in the app):
//   supabase secrets set ADMIN_PASSPHRASE="<your-strong-passphrase>"   # never commit the real value
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// =====================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSPHRASE = Deno.env.get("ADMIN_PASSPHRASE") ?? "";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(payload.action ?? "");
  const id = String(payload.profileId ?? "").trim();
  const note = payload.note == null ? null : String(payload.note);
  const passphrase = typeof payload.passphrase === "string" ? payload.passphrase : "";

  // ---- server-side auth: the passphrase is the gate, checked HERE ----
  if (!ADMIN_PASSPHRASE) return json({ error: "Server not configured" }, 500);
  const passOk = safeEqual(passphrase, ADMIN_PASSPHRASE);

  // "verify" is a yes/no check used to UNLOCK the admin UI. It returns the
  // result with a 200 (never 401) so the frontend can branch on { ok } — and
  // no passphrase or hash needs to live in the frontend at all.
  if (action === "verify") return json({ ok: passOk });

  // add / remove require a correct passphrase.
  if (!passOk) return json({ error: "Wrong passphrase" }, 401);

  if (action === "add") {
    if (!id) return json({ error: "Missing profileId" }, 400);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/admin_profile_ids`, {
      method: "POST",
      headers: dbHeaders({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({ profile_id: id, note }),
    });
    if (!r.ok) return json({ error: `add failed: ${r.status} ${await r.text().catch(() => "")}`.trim() }, 502);
    return json({ ok: true });
  }

  if (action === "remove") {
    if (!id) return json({ error: "Missing profileId" }, 400);
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_profile_ids?profile_id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers: dbHeaders() },
    );
    if (!r.ok && r.status !== 404) return json({ error: `remove failed: ${r.status}` }, 502);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});