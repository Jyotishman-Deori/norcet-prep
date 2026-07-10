# Media hosting on Cloudflare R2 (owner runbook)

The stack's role map: **Supabase = brain** (auth, state, config), **R2 = heavy
lifter** (static question figures, diagrams, future PDFs/clips, zero egress fees),
**Cloudinary = future dynamic generator only** (avatar transforms, share cards; not
wired yet). Question `image`/`video` fields hold plain https URLs, so any host
works, but uploads from the admin app go to R2 via the `media-sign` broker.

## One-time setup (about 15 minutes)

1. **Create the bucket** — Cloudflare dashboard -> R2 -> Create bucket, name e.g.
   `nurseholic-media`. Location: automatic.
2. **Enable public read** — bucket -> Settings -> Public access:
   either enable the managed `r2.dev` subdomain (fastest) or connect a custom
   domain like `media.nurseholic.in` (nicer URLs, cacheable). Note the base URL,
   e.g. `https://pub-xxxxxxxx.r2.dev`.
3. **CORS rule** (bucket -> Settings -> CORS policy) so the ADMIN app can PUT and
   both apps can GET:

   ```json
   [
     {
       "AllowedOrigins": ["https://admin.nurseholic.in", "http://localhost:5174"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     },
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```

4. **API token** — R2 -> Manage R2 API tokens -> Create: permission
   **Object Read & Write**, scoped to ONLY this bucket. Copy the Access Key ID +
   Secret Access Key (shown once).
5. **Set the broker secrets** (production Supabase project):

   ```bash
   supabase secrets set R2_ACCOUNT_ID="<your cloudflare account id>"
   supabase secrets set R2_ACCESS_KEY_ID="<access key id>"
   supabase secrets set R2_SECRET_ACCESS_KEY="<secret access key>"
   supabase secrets set R2_BUCKET="nurseholic-media"
   supabase secrets set R2_PUBLIC_BASE="https://pub-xxxxxxxx.r2.dev"
   ```

6. **Deploy the broker** (already done by the dev flow, repeat after secret
   changes): `supabase functions deploy media-sign --no-verify-jwt`
7. **Tell the app the public base** (cosmetic help text): admin -> Live config ->
   Media hosting -> R2 public base URL.

## How uploads flow

Admin question editors (Add question, Bank editor) -> "Upload" button ->
`media-sign` verifies the session token + co-admin role, mints a 10-minute
presigned PUT URL (image/video only, 20MB cap, key `q/<yyyymm>/<name>-<rand>.<ext>`)
-> the browser PUTs the file straight to R2 -> the public URL lands in the
question's `image` field. Students only ever GET public URLs.

## Rules

- NEVER put R2 keys in the repo, `.env` VITE_ vars, or game_config. Broker secrets
  only.
- The student bundle may contain the media-sign URL string (the editors are shared
  code); that is fine because the broker is server-gated coadmin+, same model as
  `bank:` writes.
- Big video: prefer YouTube links (`video` field) over hosted files.
- Dev project: repeat steps 4-6 against nurseholic-dev with a SEPARATE bucket or
  prefix if you want isolated test uploads.
