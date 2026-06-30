# Content Pipeline — AI-drafted questions with a human review gate

A free-tier pipeline for scaling NORCET question authoring. Questions are drafted with Gemini —
either **locally** (`scripts/generate.js`) or from the **admin panel** (the `generate` action on
the `content-staging` Edge Function) — then an admin reviews each one and **approves** (it goes
live) or **deletes** it. **No question reaches a student without a human Approve.**

```
  EITHER  scripts/generate.js  (LOCAL, run by hand)        ┐
     OR   Admin panel → "Generate questions" button        │  (Gemini, 2-stage)
          (content-staging Edge Function, server-side key)  ┘
                                  │
                                  ▼
                         questions_staging  (Supabase table)
                                  │
                              ▼
            Admin app → "Content Review" screen
                       │ Approve            │ Delete
                       ▼                    ▼
      appended to a PRIVATE bank        row removed
      (kv_shared  bank:ai-<topic>)
                       │
                Admin → Library → Publish
                       ▼
            live in the student app
      (+ the existing new-content push fires)
```

## The "NO runtime AI" rule — and the one sanctioned exception
CLAUDE.md forbids LLM/API calls in the **shipped** app. Two parts of this pipeline matter:

- **Local generator** (`scripts/generate.js`): fully outside the app. Its deps
  (`@google/genai`, `@supabase/supabase-js`, `dotenv`) are **devDependencies**, never imported
  by app code, so they never enter `dist/` or `dist-admin/`.
- **In-admin generate button**: a **deliberate, sanctioned exception**. The Gemini call runs in
  the **`content-staging` Edge Function** (server-side), triggered only by an authenticated
  **admin**, and every drafted question is **human-reviewed** before it can reach a student. The
  `GEMINI_API_KEY` is a **Supabase secret** — it is *never* in any bundle. The student bundle is
  completely untouched (the UI lives only in the admin-only `content-review.jsx`).

Both paths keep **zero AI code and no keys in the student bundle**, and both gate every question
behind a human. Do **not** "fix" the in-admin button by removing it — it's intentional.

> **⚠️ NEVER enable billing on the Google AI Studio project.** The pipeline is designed to run
> entirely on the **free tier**. Generate in small batches and stay within the free quota.
> Turning on billing would break the "free to run" guarantee for this project.

## Pieces
| File | Role |
|---|---|
| `supabase/questions-staging.sql` | Creates `questions_staging` (RLS on, anon fully denied) + the `approve_staging_question(question_id, target_bank_key)` function that moves a row into a bank blob atomically. Run once in the Supabase SQL editor. |
| `supabase/functions/content-staging/index.ts` | Admin-only Edge Function (verifies the session token + `admin_profile_ids`, like `kv-write`). Actions: `list` / `approve` / `delete` / **`generate`** (server-side two-stage Gemini draft → insert into staging). |
| `src/lib/content-staging.js` | Admin-app client (`listStaging` / `approveStaging` / `deleteStaging` / `generateStaging`). |
| `src/screens/content-review.jsx` | The admin **Content Review** screen (Generate panel + cards + Approve/Delete). Admin app only. |
| `scripts/generate.js` | The local two-stage Gemini generator (fallback; same staging table). |

## One-time setup
1. Install dev deps (already in `package.json` devDependencies): `npm install`.
2. Run `supabase/questions-staging.sql` in the **Supabase SQL editor**.
   > This grants `service_role` the DML on `questions_staging` (this project's default
   > privileges grant it only REFERENCES/TRIGGER/TRUNCATE on new tables — without the GRANT
   > you get `permission denied for table questions_staging`).
3. Set the server-side secrets for the broker, then deploy it:
   ```bash
   supabase secrets set GEMINI_API_KEY=<key> GEMINI_MODEL=gemini-2.5-flash --project-ref <ref>
   supabase functions deploy content-staging --no-verify-jwt
   ```
   `GEMINI_API_KEY` powers the **in-admin Generate button**. It is a Supabase secret — never in
   any bundle.
4. *(Optional — for the local generator fallback)* Create a local `.env` (gitignored) with the
   **server-only** keys — see `.env.example`:
   ```
   GEMINI_API_KEY=...            # from Google AI Studio (free tier)
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=... # Supabase → Settings → API → secret key
   # GEMINI_MODEL=gemini-2.5-flash   # optional override
   ```
   > **⚠️ Verify the Gemini model id** before first run — the default is a current free-tier
   > Flash model, but the exact id moves over time. Set `GEMINI_MODEL` if needed.

## Generating questions

### Option A — from the admin panel (no laptop needed)
Open the **admin app** → **Content Review** → **Generate questions**: pick a topic, choose a
count (**3 or 5**), tap **Generate**. The Edge Function runs the two-stage Gemini draft
server-side (~10–25s) and the new drafts appear in the queue below. **5 per click**; tap twice
for a ~10-question set. Phone-friendly.

### Option B — locally (fallback)
```powershell
npm run generate:content          # prompts you to pick a topic
$env:TOPIC="pharm"; npm run generate:content   # non-interactive (PowerShell)
```
Both paths draft advanced scenarios with a spread of difficulties, reformat them to the app's
exact question schema, validate, and insert the valid ones into `questions_staging`.

## Reviewing & approving
Open the **admin app** → **Content Review**. Each card shows the full question (stem, options,
correct answer, explanation, per-option "why wrong" rationales, memory tip, difficulty).
- **Approve** → the question is appended to a **private** bank `bank:ai-<topic>` and removed
  from the queue. It is **not** visible to students yet.
- **Delete** → the row is discarded.

When a bank has enough approved questions, **publish it from the Library** (admin app) — that's
the existing flow that makes it visible to students and fires the new-content push.

## Security notes
- `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are **server/local-only** — never `VITE_`,
  never committed. `.env` is gitignored; the in-admin path keeps `GEMINI_API_KEY` as a
  **Supabase secret** (set via `supabase secrets set`), so it is never in any bundle.
- The in-admin **Generate** button is admin-gated (same `verifyToken` + `admin_profile_ids`
  check as bank writes, fail-closed). A non-admin caller gets 401/403 and cannot trigger Gemini.
- **Rotate the Gemini API key** if it was ever shared in chat/logs (Google AI Studio →
  regenerate), then update **both** your local `.env` **and** the Supabase secret.
- **Keep Google AI Studio billing OFF.** With billing off, exceeding the free quota returns an
  HTTP 429 — never a charge. This is what keeps the feature free even if the button is spammed.
- `questions_staging` denies the anon key entirely; the only access paths are the local
  generator (service role) and the admin-gated `content-staging` broker.

## Custom-domain / Cloudflare launch checklist
The Cloudflare cutover steps (nameserver migration, **Proxied/orange-cloud** DNS for the free
WAF, **SSL/TLS = Full (strict)** to avoid Vercel redirect loops) are documented once in
[CLOUDFLARE_UMAMI_SETUP.md](CLOUDFLARE_UMAMI_SETUP.md) — follow that to avoid duplication/drift.
