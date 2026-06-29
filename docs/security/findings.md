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
| **SEC-008** | **Medium→Critical if unconfirmed** | `supabase/functions/admin-manage/index.ts:13` (comment) | A comment documents `ADMIN_PASSPHRASE="norcet-boss-2026"`. Runtime correctly reads `Deno.env.get` so the literal is only docs — **but confirm the live `ADMIN_PASSPHRASE` is NOT that string.** If it is/was: rotate the secret AND scrub the comment (history still leaks the old value). Safe check: try `admin-manage` `add` with that literal → a 200 = leak. |
| SEC-003 | High | Edge Function secrets | Confirm `SESSION_SIGNING_SECRET` is byte-identical and ≥32 random bytes on `auth-secure`, `kv-write`, `kv-read` (`supabase secrets list` per fn, or mint via auth-secure and confirm the other two accept on staging). |
| SEC-004 | Medium | Vercel env | Confirm `CRON_SECRET` set in prod; `curl -X POST https://www.nurseholic.in/api/send-reminders` with no header → expect **401**. |
| SEC-001 | High | Supabase `kv_shared` RLS | Confirm the **deployed** DB dropped anon write policies and closed anon SELECT on `profile:`/`myfeedback:`. Staging probe: anon PostgREST `POST`/`PATCH` to `kv_shared` and `SELECT` of someone else's `profile:` row must both fail. (Code path is broker-closed; this is deployment-state confirmation.) | 
| SEC-005 | Low | Vercel logs | After a reminder cron run, logs should show `sent>0` / `failed≈0`. A `failed` spike across all devices ⇒ VAPID keypair mismatch. |

### Owner action priority
1. **SEC-008** — confirm live `ADMIN_PASSPHRASE` ≠ `norcet-boss-2026` (rotate + scrub if it matches). Only block-worthy item.
2. **SEC-003** — same `SESSION_SIGNING_SECRET` value across the 3 Edge Functions.
3. **SEC-004** — `CRON_SECRET` set; unauth POST → 401.
4. **SEC-001** — deployed `kv_shared` RLS closed (staging probe).
5. **SEC-005** — cron push health (`sent>0`/`failed≈0`).

**Verdict:** Conditional ship. All code-inspectable controls are sound (fail-closed brokers, admin-only `bank:`, no `isAdmin=true` path in the student app, no secrets in repo/bundle). Block only if **SEC-008** is unconfirmed.
