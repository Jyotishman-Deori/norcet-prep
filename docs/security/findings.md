# Security Findings — NORCET app

Maintained by the `security-auditor` agent. On each run it reconciles existing rows
(re-checking OPEN items against current code) **before** logging new ones.

**Severity:** Critical · High · Medium · Low
**Status:** open · fixed · accepted · regressed · needs-owner-action

## Code-inspectable controls (verified)

| ID | Severity | Location | Finding | Status |
|----|----------|----------|---------|--------|
| SEC-002 | Low | client bundle `VITE_SUPABASE_ANON_KEY` | Anon key ships in the bundle **by design** — public client identifier, not a secret. The real boundary is the `kv-write`/`kv-read` brokers + RLS. Re-verified: only the anon key (an `eyJ…`) appears in shipped JS. | accepted |
| SEC-003 | High | `auth-secure/index.ts:35,91-108` · `kv-write/index.ts:42,76-96` · `kv-read/index.ts:31,63-81` | All three Edge Functions read the same `SESSION_SIGNING_SECRET` env var and use one HMAC-SHA256 token scheme (`payloadB64.sigB64`), length-checked constant-time `safeEqual`, reject bad-sig/missing-id/expired. `kv-write`/`kv-read` fail-closed (500) if unset. | verified-in-code (value needs owner check) |
| SEC-004 | Medium | `api/send-reminders.js:69-75,95` | `isAuthorizedCron()` fail-closed when `CRON_SECRET` unset; constant-time `Bearer` compare; handler returns **401** before any work on failure. | verified-in-code (env presence needs owner check) |
| SEC-006 | High | repo-wide (`git grep`/`git ls-files`) | No JWTs, no `service_role` key, no VAPID private key, no passphrase in tracked files; all secrets via `Deno.env`/`process.env`/`import.meta.env`. Only `.env.example` tracked. | verified |
| SEC-007 | High | `dist/`, `dist-admin/` | Grep of shipped JS for `service_role`/`ADMIN_PASSPHRASE`/`VAPID_PRIVATE_KEY`/`SESSION_SIGNING_SECRET` → zero matches. | verified |
| SEC-009 | Low | `dist-admin/.env.local` | Gitignored + untracked; the `VERCEL_OIDC_TOKEN` there is a short-lived local CLI artifact, never bundled. Logged so it isn't re-flagged. | accepted |
| SEC-010 | High | `kv-write/index.ts:269-272` (+ `isAdmin()` `:99-107`) | `bank:` create/edit/delete require server-side admin (token id/uid matched against `admin_profile_ids` with service-role); unclassified keys hit fail-closed 403. | verified |
| SEC-011 | High | `src/App.jsx` · `src/AdminApp.jsx` · `src/lib/admin-ops.js` | Student app has **no** `isAdmin=true` path (`useState(false)`; only `setIsAdmin(false)` on logout). Admin surface lives only in the admin app. **Residual dead `checkServerAdmin` in App.jsx is now REMOVED** by the admin-source cleanup. | verified / fixed |

## AI Learning Note-Taking feature audit — 2026-07-01 (uncommitted changes)

Scope: new student-bundle feature — `src/screens/note-taking-modal.jsx`, `src/lib/notes-store.js`,
`src/lib/note-prompt.js`, `src/ui/note-fab.jsx`, plus additive wiring in `src/App.jsx`,
`src/ui/primitives.jsx`, `src/lib/keys.js`, `src/lib/font-styles.js`. Automated passes this run:
`npm audit --omit=dev` → **0 vulnerabilities**; secret scan of the 4 feature files → **0 matches**;
`grep` of shipped `dist/assets/` for `service_role`/passphrase/session secret/`AIza…`/`sk-…`/
Gemini/OpenAI/Anthropic endpoints → **0 matches**; `npm test` (4 contract tests + Vite compile gate)
→ **pass**.

| ID | Severity | Location | Finding | Status |
|----|----------|----------|---------|--------|
| SEC-012 | Info (verified-clean) | `src/lib/note-prompt.js` (whole) · `note-taking-modal.jsx:181-200` | **No-runtime-AI constraint upheld.** The "master prompt" is a pure, deterministic string assembler (`assembleMasterPrompt`) over static template constants; no `fetch`/`XMLHttpRequest`/`eval`/`new Function`, no LLM SDK/endpoint, no API key, no new env var. The assembled text is copied to the user's clipboard to paste into an *external* AI by hand. Verified: no AI/network sink in any of the 4 files; template constants (e.g. "Anti-Sycophancy") ship as inert strings only. | verified-clean |
| SEC-013 | Info (verified-clean) | `note-taking-modal.jsx:52-75` (clipboard) · `note-prompt.js:229-253` (normalize) | **No injection / no unsafe render.** Note text flows: `<textarea value>` (React-escaped) → `normalizeBullets` (string ops only, Unicode-preserving) → `assembleMasterPrompt` (string concat) → `navigator.clipboard.writeText` / hidden-`<textarea>` `execCommand('copy')`. No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`. Clipboard payload is the user's own data going out as plain text — no cross-user exposure, no executable sink. Fallback box is a `readOnly` textarea (value-bound, escaped). | verified-clean |
| SEC-014 | Info (verified-clean) | `notes-store.js:22-55` · `note-fab.jsx:75-88` | **Local persistence is safe.** Notes blob (`notes:v1:<profileId>`, IndexedDB, `shared:false`) is `JSON.parse`d inside try/catch, coerced through `normalizeBullets`, and hard-capped at 10 bullets → bounded growth, junk-safe, no prototype-pollution vector (only `Array.isArray`/`.bullets` read; no key-spread of parsed object). FAB position (`localStorage norcet:notefab-pos:v1`) is `JSON.parse`d then validated `typeof x/y === 'number'` and clamped to viewport bounds — a poisoned value can at worst misplace a button, and only `x`/`y` are trusted. Never written to shared storage. | verified-clean |
| SEC-015 | Info (verified-clean) | `note-taking-modal.jsx:96-97,219-231` · `feedback.js:14-16` · `kv-write/index.ts:345-351` | **Shared write reuses the already-authorized `feedback:` path — no broker change needed, no `bank:` touch.** The `notes-ai-interest` vote calls `saveFeedback({source:'notes-ai-interest', …})` → `safeStorage.set(feedback:<id>, …, true)` → `kv-write`, which requires a valid signed session token (401 without one) and classifies `feedback:` under "create = any logged-in user" (broker §6). Payload carries `profileId` + `displayName` + a fixed interest string — **identical PII shape to the existing Report button**, no new data class, no `bank:`/admin path. Fire-and-forget with `.catch(()=>{})`; never blocks UI. | verified-clean |
| SEC-016 | Low | `note-taking-modal.jsx:279-305` (`castVote`) · `kv-write/index.ts:345-351` (feedback: §6, no rate cap) | **Uncapped feedback-row creation via vote toggling (minor economic/spam surface).** `castVote` early-returns on an unchanged vote, but a logged-in user can toggle up→down→up repeatedly; each *distinct* change fires a new `saveFeedback` with a fresh `newFeedbackId()`, appending a new `feedback:<id>` row. The `feedback:` prefix has **no per-user rate cap** in the broker (unlike `trend:` 120/hr and admin writes 20/hr), so a scripted client could inflate the shared feedback inbox. Bounded by: auth required (not anonymous), ~10-user scale, and admin-only visibility of the inbox — so impact is inbox clutter, not data loss or cross-user access. **Why it exists:** the feature deliberately reused the zero-backend `feedback:` channel for a low-cost interest signal; the pre-existing Report flow shares the same uncapped property, so this is inherited, not newly introduced. **Verify safely (staging only):** with a test profile, POST N `set` ops for `feedback:` keys via the kv-write broker with a valid token and confirm each returns 200 (no 429) — proves the absence of a cap; do NOT run against prod or with real user data. **Mitigation (owner's call, non-blocking):** add a `feedback:`/`faqq:` `rateHit` bucket (e.g. 30/hr per id) in `kv-write` §6, mirroring `trend:`. **Re-checked 2026-07-01 (companion enhancement run):** the `castVote` mechanism is unchanged by the companion diff (moved to lines 279-305, seed-guard `sentVoteRef` intact); still OPEN, still Low, still inherited from the Report flow. | open |

## Study-companion enhancement audit — 2026-07-01 (uncommitted changes, second pass)

Scope: the "study companion" identity + rename layer added on top of the AI Learning Note feature —
new `src/screens/companion-rename-modal.jsx`, `src/lib/note-companion.js`, `src/ui/companion-rename-channel.js`;
extended `src/lib/notes-store.js` (companion name + auto-save prefs); additive wiring in `src/App.jsx`,
`src/screens/settings.jsx`, `src/ui/primitives.jsx`, `src/lib/keys.js`, `src/lib/font-styles.js`, plus
`src/ui/note-fab.jsx` and `src/screens/note-taking-modal.jsx`. Automated passes this run:
`npm audit --omit=dev` → **0 vulnerabilities**; secret scan of the 7 enhancement files (`git grep` for
`AIza…`/`sk-…`/`eyJ…`/`service_role`/passphrase/session secret/`api[_-]?key`/`secret[:=]`) → **0 matches**;
`node scripts/run-tests.mjs` (5 test files incl. `note-companion.test.js` + Vite production compile gate) → **pass**;
secret + AI-endpoint scan of the freshly built `dist/assets/` (`AIza…`/`sk-…`/`service_role`/passphrase/
`generativelanguage`/`api.openai`/`api.anthropic`) → **0 matches**; `git status` confirms `src/lib/feedback.js`
is **untouched** by this diff.

| ID | Severity | Location | Finding | Status |
|----|----------|----------|---------|--------|
| SEC-017 | Info (verified-clean) | `companion-rename-modal.jsx:42,60-80,147-159` · `profiles.js:572-593` (`authenticateProfile`) | **Password re-verify for account rename reuses the already-authorized server path — no new backend, no secret, no persistence.** The typed password lives ONLY in local `useState` (`password`), is passed straight to `authenticateProfile(profile.displayName, password)` → `callAuthFn('verify', …)` (POST to the `auth-secure` Edge Function, service-role, over TLS), and is **never** written to storage, logged, or included in any blob (`git grep password` across the file shows no `safeStorage`/`log`/`JSON.stringify` sink; the field state is dropped on modal close). No new Edge Function, no new env var, no `kv_shared` write. Auth returns the generic `'Display name or password is incorrect'` for both wrong-password AND no-such-account (`profiles.js:583`), so no account-enumeration leak beyond the existing login. `authenticateProfile` also carries the same server-side rate-limit surfacing (429 → friendly "wait" via `callAuthFn`) and an optional `captchaToken` third arg (Turnstile — inert until owner sets `VITE_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY`; the rename call omits it, matching current inert state). **Verify safely (local/staging):** open the rename modal as a signed-in test account, watch the Network tab — exactly one POST to `auth-secure` action `verify` fires with the password in the TLS body (never a query string, never a stored key); DevTools → Application → IndexedDB shows NO key containing the password after save. Do not use a real user's credentials. | verified-clean |
| SEC-018 | Info (verified-clean) | `companion-rename-modal.jsx:38,60-72,203-218` · `note-companion.js:24-34` (`sanitizeName`) | **Guest cannot escalate; the rename is a local, per-profile write only.** `isGuest = isGuestProfile(profile)` (checks `isGuest` flag / `GUEST_ID`); guests skip the `authenticateProfile` call by design and just `saveCompanionName(profileId, cleaned)` → `safeStorage.set(notesname:v1:<id>, …, false)` (IndexedDB, **shared:false**). There is no privilege attached to the companion name — it is only the popup title/greeting and a Settings label; no admin/`bank:` path, no `kv_shared` write, no auth state change. A guest editing their own local name grants no capability. **Verify safely:** as a guest, rename the companion, confirm (DevTools → IndexedDB) only the local `notesname:v1:__guest__` key changes and no network request fires. | verified-clean |
| SEC-019 | Info (verified-clean) | `note-companion.js:24-34` (`sanitizeName`) · `notes-store.js:83-98` (load/save name) · `note-taking-modal.jsx:676-691` · `companion-rename-modal.jsx:236` | **Companion name is bounded, sanitised on BOTH load and save, and cannot inject HTML/script.** `sanitizeName` drops control chars (codepoint `<0x20` and `0x7f`), collapses whitespace, trims, and caps at `NAME_MAX=10` code points (emoji-safe via `Array.from`); returns `''` for non-strings — no prototype-pollution vector (it only reads a string, never spreads parsed-object keys). `loadCompanionName` re-sanitises on read, so a value poisoned directly in IndexedDB is re-bounded before use. The name renders exclusively as React text children (`{name}`, `{greeting}`, `personalize(sec.body, name)`) and in `aria-label`/`title` string interpolation — **no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`/`new Function`** in any of the 7 files (verified by `git grep`). React auto-escapes, so `<script>` as a name is inert text. The auto-save pref (`notesautosave:v1:<id>`) stores only the strings `'true'`/`'false'` with a tolerant parse (`notes-store.js:105-117`). **Verify safely:** set the name to `<img src=x onerror=alert(1)>` — it is truncated to 10 chars and shown as literal text; no script runs. | verified-clean |
| SEC-020 | Info (verified-clean) | `note-companion.js` (whole) · `companion-rename-channel.js` (whole) · `notes-store.js` (whole) | **No new runtime AI, no new shared write, no new secret/env.** `note-companion.js` is pure static data + string helpers (name rules, suggestions, greetings, authored GUIDE text) — no `fetch`/`XMLHttpRequest`/LLM SDK/endpoint/API key (`git grep` for `fetch`/AI endpoints → 0). The companion name + prefs persist via `safeStorage.set(…, false)` (IndexedDB only); no `shared:true`/`kv_shared` write is introduced by this diff (`git grep` for `, true)` in the new store fns → 0). `keys.js` adds only local-key builders (`notesname`/`notesautosave`/`notes`/`notesaivote`, all `shared:false`). The no-runtime-AI constraint (CLAUDE.md) holds: the GUIDE copy merely *instructs* the user to paste notes into an external AI by hand. **Verify safely:** confirmed by build + secret scan of `dist/assets/` (0 AI-endpoint / key matches) and `git grep` of the enhancement files. | verified-clean |

## Premium tiers / family plans / single-session build — 2026-07-03

Scope: subscription ecosystem (subscriptions/family_members/family_invites tables + `subscription`
Edge Fn), single-concurrent-session layer (auth-secure `sid` + broker checks behind
`game_config security.singleSession`, default OFF), and the admin-list lockdown (Part B).

| ID | Severity | Location | Finding | Status |
|----|----------|----------|---------|--------|
| SEC-021 | Medium | `admin_profile_ids` anon SELECT policy (`norcet-schema:84`) + anon `TRUNCATE`/`MAINTAIN` grants (`:281`) | **Admin-list enumeration + latent anon TRUNCATE.** Anyone with the anon key could list admin profile ids (info disclosure only — every admin action re-verifies server-side). Worse latent issue found while fixing: the dump shows `TRUNCATE` granted to `anon`, and TRUNCATE is **not** subject to RLS — an anon client could have emptied the allow-list (fail-closed lockout of all admins; DoS, not escalation). **Fix shipped:** `admin-manage` gained token-verified `check-admin`/`list-admins`; `admin-ops.js`/`admin.js` now use them (no direct REST read remains). `supabase/lock-admin-list.sql` drops the policy and revokes ALL from anon/authenticated. | needs-owner-action (run lock-admin-list.sql AFTER deploying admin-manage + rebuilding the admin app) |
| SEC-022 | Info (verified-by-design) | `supabase/subscriptions.sql` · `supabase/functions/subscription/index.ts` | New tables follow the `questions_staging` lockdown verbatim (RLS on, zero policies, REVOKE ALL, explicit service-role DML). The broker derives caller identity ONLY from the signed session token (`handlesOf(session)`) — the body can never name another user except in `admin-*` actions, which re-check `admin_profile_ids` server-side. Invite tokens are stored **hashed** (SHA-256), single-use, 7-day expiry, generic `invalid-invite` failure (no oracle for used vs expired), seat + one-family-per-account enforced by a unique index. | verified-in-code |
| SEC-023 | Info | single-session layer (`auth-secure` `rotateSessionId` · brokers `sessionSidOk`) | "Last one wins" is deliberately **fail-open**: flag OFF by default, NULL db-sid passes (rollout kicks nobody), any config/lookup error passes. It is a REVENUE guard, not a safety lock — the trade-off is availability over strictness. Old 60-day tokens (no `sid`) stay valid until the account's next login writes a sid. | accepted (by design) |

## Needs owner action (not verifiable from code)

| ID | Severity | Location | Owner action |
|----|----------|----------|--------------|
| ~~SEC-008~~ | Low (RESOLVED 2026-06-29) | `supabase/functions/admin-manage/index.ts:13` | Owner confirmed the LIVE `ADMIN_PASSPHRASE` is NOT the old example literal. The example value was scrubbed from the comment (now a placeholder). Runtime always read it from `Deno.env.get` — the literal was docs-only, never functional. Old value in git history is a dead string (no longer the live passphrase). **Status: fixed.** |
| ~~SEC-003~~ | RESOLVED 2026-06-29 | Edge Function secrets | **VERIFIED LIVE:** `supabase secrets list` shows `SESSION_SIGNING_SECRET` set (updated 2026-06-16). Supabase secrets are **project-wide** → `auth-secure`/`kv-write`/`kv-read` all read the SAME value (identical-across-functions is guaranteed by the platform). Residual (owner-only): that the value itself is ≥32 random bytes — owner set it; treat as done unless a weak value was used. |
| ~~SEC-004~~ | RESOLVED 2026-06-29 | Vercel env | **VERIFIED LIVE:** `curl -X POST https://www.nurseholic.in/api/send-reminders` with no auth → **HTTP 401**. CRON_SECRET is set and enforced (fail-closed before any work). |
| ~~SEC-001~~ | RESOLVED 2026-06-29 | Supabase `kv_shared` RLS | **VERIFIED LIVE (anon-key probes):** anon direct `POST` to `kv_shared` → **401** (writes locked, must use the kv-write broker); anon `SELECT key=like.profile:*` → **`[]`** (private rows closed to anon despite existing); anon `SELECT key=eq.game_config` → **200** (public keys still readable). The deployed RLS lock is live. |
| SEC-005 | Low | Vercel logs | After a reminder cron run, logs should show `sent>0` / `failed≈0`. A `failed` spike across all devices ⇒ VAPID keypair mismatch. **(Only remaining owner check — needs live logs.)** |

### Owner action priority
1. ~~SEC-008~~ ✅ resolved (passphrase confirmed different; comment scrubbed).
2. ~~SEC-003~~ ✅ verified live (secret set + project-shared).
3. ~~SEC-004~~ ✅ verified live (unauth POST → 401).
4. ~~SEC-001~~ ✅ verified live (anon write 401; private read `[]`; public read 200).
5. **SEC-005** — the only item left: glance at cron logs after a fire for `sent>0`/`failed≈0`.

**Verdict:** SHIP. All code-inspectable controls are sound AND the five owner-confirmation items are now verified live (SEC-001/003/004/008), except SEC-005 (push delivery health) which only needs an eyeball on the cron logs and is non-blocking.

**AI Learning Note-Taking feature (2026-07-01):** SHIP. The feature is client-side only — a static prompt
assembler + local IndexedDB persistence + one reuse of the already-authorized `feedback:` shared write.
No-runtime-AI upheld, no secrets/env added, no injection/unsafe-render sink, no `bank:`/admin path touched,
local storage bounded and validated (SEC-012–015 verified-clean). One inherited **Low** (SEC-016): the
`feedback:` broker path has no per-user rate cap, so the new interest-vote signal — like the existing Report
button — can be toggled to append inbox rows. Non-blocking at ~10-user scale; optional mitigation is a
`rateHit` bucket in kv-write §6. Not verified (out of scope / needs live check): actual runtime broker 429
behavior for `feedback:` (SEC-016 verify step) and live RLS on `notes:v1:` keys (moot — they are `shared:false`
IndexedDB, never sent to Supabase).

**Study-companion enhancement (2026-07-01, second pass):** SHIP. Scope-limited to the companion identity +
rename layer. **No new Critical/High/Medium.** Four new verified-clean items (SEC-017–020): (1) the account
password re-verify reuses `authenticateProfile` → the existing `auth-secure` Edge Function with **no new
backend, env var, or secret**, and the password is never stored/logged/persisted (local `useState` only,
dropped on close) with no enumeration leak beyond the existing generic login error; (2) guests skip the
password gate by design and can only write their own **local** `notesname:v1:__guest__` key — no escalation,
no capability attached to the name; (3) the companion name is sanitised on both load and save, capped at 10
code points, prototype-pollution-safe, and rendered exclusively as React-escaped text (no
`dangerouslySetInnerHTML`/`innerHTML`/`eval` in any of the 7 files); (4) no new runtime-AI call, no new
`kv_shared`/`shared:true` write, no new secret/env — the companion name + auto-save pref are device-local
(`shared:false`) and the GUIDE is static authored copy. Automated passes: `npm audit` 0 vulns; secret scan of
the 7 files 0 matches; 5 tests + Vite compile gate pass; `dist/assets/` secret+AI-endpoint scan 0 matches;
`feedback.js` untouched. SEC-016 re-checked and remains an OPEN inherited **Low** (unchanged by this diff).
Nothing new to verify live — all four items are code-inspectable and confirmed clean; the only outstanding
live check remains SEC-005 (push-delivery health, pre-existing, non-blocking). **Not asserting "secure" —**
stating that the enumerated attack surface for this enhancement (password handling, guest escalation, name
injection/render, new shared writes/secrets/AI) was checked and is clean; the broker/RLS/auth-secure server
controls themselves were already verified live in prior runs (SEC-001/003/010) and are unchanged here.
