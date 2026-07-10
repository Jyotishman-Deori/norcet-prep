# Dev environment: the nurseholic-dev Supabase project

Why this exists: until 2026-07-10, `npm run dev` talked to the **production**
Supabase project — every local experiment touched live student data. This
runbook stands up a second, free-tier Supabase project ("nurseholic-dev") that
dev serves use instead, via a local-only `.env.development`.

How the switch works (already wired in code):

- `npm run dev` / `npm run dev:admin` run Vite in mode `development`, which
  loads `.env.development` **over** `.env`. All builds (`vite build`,
  `--mode admin`, the `npm test` compile gate) ignore that file, so production
  builds are untouched.
- The app shows a small **DEV DATA** chip (bottom-left) when running against
  the dev project, and a red **LIVE DATA** warning on any dev serve where
  `.env.development` is missing (the silent fallback-to-production trap).
  `src/lib/dev-env.js`, inert in production builds.

## One-time setup (owner)

### 1. Create the project + env file

1. Supabase dashboard → New project → name `nurseholic-dev` (free tier;
   free projects pause after ~1 week idle — resume from the dashboard, data
   kept). Fine for dev.
2. Copy `.env.development.example` → `.env.development` and fill in the dev
   project's URL + anon key (dashboard → Settings → API). **Never** put
   production values there; never commit it (gitignored).

### 2. SQL, in this order (dev project's SQL editor)

Run each committed file top-to-bottom:

1. `supabase/setup.sql` (kv_shared + the open-era policies)
2. `supabase/profile-secrets.sql`
3. `supabase/admin-allowlist.sql` (the CREATE for admin_profile_ids; new file)
4. `supabase/auth-rate.sql`
5. `supabase/grant-service-role.sql`
6. `supabase/admin-roles.sql` (edit the owner-backfill ids for your dev account, or run it after step 5 below and update then)
7. `supabase/subscriptions.sql`
8. `supabase/waitlist.sql`
9. `supabase/referral-intel.sql`
10. `supabase/questions-staging.sql`
11. Optional: `supabase/add-google-login.sql`, `supabase/admin-2fa.sql`

Skip: `migrate-credentials-step1/2` (legacy-data migration, nothing to
migrate), `fix-anon-read-policy.sql` (superseded by the denylist in step 6
below), `lock-admin-list.sql` until the admin app works against dev.

### 3. Edge Functions + secrets

```
supabase link --project-ref <dev-project-ref>
supabase secrets set SESSION_SIGNING_SECRET=<fresh random 64 hex, NEVER prod's>
supabase secrets set ADMIN_PASSPHRASE=<dev-only passphrase>
supabase secrets set TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

That Turnstile value is Cloudflare's published always-passes TEST secret; it
pairs with the test sitekey in `.env.development.example`. All other secrets
(RESEND_API_KEY, NOTIFY_SECRET/URL, GEMINI_API_KEY, GOOGLE_CLIENT_ID,
LOOPS_API_KEY, STAFF_PASSPHRASE...) are optional — every function fails soft
without them.

Deploy all ten functions, each with `--no-verify-jwt`:

```
for f in auth-secure kv-read kv-write admin-manage push-broadcast subscription waitlist referral-intel referral-compare content-staging; do supabase functions deploy $f --no-verify-jwt; done
```

(Remember to `supabase link` back to the PROD ref before any production
function deploy.)

### 4. First account + staff row

1. `npm run dev` → the badge must say **DEV DATA** → create an account, take
   a quiz, confirm saves work.
2. Make it staff (dev SQL editor):
   `INSERT INTO admin_profile_ids (profile_id) VALUES ('<its slug id>');`
   then re-run/adjust the owner backfill in `admin-roles.sql` if you want the
   full 'admin' rank on dev.

### 5. Lock it down (ONLY after 3-4 verified)

1. `supabase/lock-writes.sql`
2. `supabase/secure-admin-read-policy.sql`
3. `supabase/lock-admin-list.sql`

Their in-file warnings apply: brokers must be live first or you brick the
project for yourself.

### 6. Prove it

Admin app (`npm run dev:admin`) → Storage self-test → expect: broker write ok,
anon read-back ok, and all six private prefixes **hidden**. Negative check
(optional but worth doing once): apply the older 2-prefix policy from
`secure-admin-read-policy.sql`'s rollback comment → re-run the self-test →
`feedback:` / `errlog:` / `analytics:` / `adminlog:` must show **LEAKED** →
re-apply the 6-prefix denylist → all hidden again.
