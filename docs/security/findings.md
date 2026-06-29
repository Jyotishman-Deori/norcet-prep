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
