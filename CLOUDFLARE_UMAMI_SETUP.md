# Umami Analytics + Cloudflare Turnstile — setup & launch guide

This app already has the **code** for both features. They stay **inert until you set the
env vars / secret** below, so nothing changes for users until you switch each one on.

- **Stack note:** this is a **React + Vite** PWA (not Next.js), so the env vars are
  `VITE_*` (client) and the Turnstile secret is a **Supabase secret** (server). There is no
  `next.config.js`.
- **One repo, two apps:** the **student** app (`dist`, prod = `nurseholic.in` /
  `norcet-prep.vercel.app`) and the **admin** app (`dist-admin`, `norcet-admin.vercel.app`).
  Both share `AuthScreen`, so Turnstile guards **both** logins.

---

## 1. Umami Cloud (free, cookieless analytics) — student app only

1. Create a free account at **https://cloud.umami.is** → **+ Add website** → enter the
   domain (`nurseholic.in`). Copy the **Website ID** (a UUID).
2. In the **Vercel student project** → Settings → Environment Variables, add:
   - `VITE_UMAMI_WEBSITE_ID` = the UUID from step 1
   - `VITE_UMAMI_SCRIPT_URL` = `https://cloud.umami.is/script.js` (only change if self-hosting)
3. **Redeploy** the student project (env vars are baked in at build time for Vite).
4. Verify: open the app → DevTools → Network → confirm `script.js` loads from
   `cloud.umami.is`, and a pageview appears in the Umami dashboard within a minute.

> The admin app intentionally does **not** load Umami (it's an internal, owner-only
> surface). Leaving `VITE_UMAMI_WEBSITE_ID` empty disables analytics entirely — the loader
> ([src/lib/umami.js](src/lib/umami.js)) injects nothing.

---

## 2. Cloudflare Turnstile (free CAPTCHA) — guards Create profile / Log in / Reset

### 2a. Create the widget
1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. **Hostnames — add ALL of these** (a missing one silently fails the challenge there):
   - `nurseholic.in`
   - `nurseholic.com`
   - `norcet-prep.vercel.app`
   - `norcet-admin.vercel.app`  ← the admin app login
   - `localhost`  ← local dev
3. Widget mode: **Managed** (recommended — usually invisible, challenges only when needed).
4. Copy the **Site Key** (public) and the **Secret Key** (private).

### 2b. Wire the keys
- **Site key (public)** → Vercel env `VITE_TURNSTILE_SITE_KEY` on **both** the student and
  admin projects, then redeploy each. The widget now renders on the auth forms.
- **Secret key (private)** → **Supabase secret** (this is what turns enforcement ON):
  ```bash
  supabase secrets set TURNSTILE_SECRET_KEY="<your secret key>"
  supabase functions deploy auth-secure --no-verify-jwt
  ```
  Verification happens inside the `auth-secure` Edge Function, atomically with each
  register/verify/reset — so it can't be bypassed by calling the function directly.

> ⚠ **Never commit the secret key.** It is not in `.env.example` or the repo by design.
> Because it was shared in chat, consider **rotating it** in the Turnstile dashboard before
> launch.

### 2c. Safe rollout order (don't lock out current testers)
The server **fail-opens while `TURNSTILE_SECRET_KEY` is unset**, so:
1. Deploy the frontend + set `VITE_TURNSTILE_SITE_KEY` → widget shows, tokens flow, but the
   server still lets everyone through.
2. Deploy `auth-secure` (safe any time while the secret is unset).
3. **Last:** `supabase secrets set TURNSTILE_SECRET_KEY=…` → enforcement turns ON. Do this
   at a low-traffic moment. The PWA auto-reloads on a new build, so clients already have the
   widget; a not-yet-reloaded device would see one rejected attempt (a reload fixes it).

### 2d. Verify
- Widget renders on Create / Log in / Forgot-password reset (student **and** admin).
- A normal submit succeeds.
- With the secret set, a request carrying no/forged token returns
  `{ ok:false, reason:"captcha" }` and the UI shows
  *"Please complete the 'I'm human' check and try again."*

---

## 3. Cloudflare Free WAF — geoblock everything except India (optional)

Only works once the custom domain is **proxied through Cloudflare** (see §4). Then:

- Cloudflare → your domain → **Security → WAF → Custom rules → Create**:
  - **Expression:** `(ip.geoip.country ne "IN")`
  - **Action:** `Block`

**Read these caveats before enabling:**
- It only protects **Cloudflare-proxied custom domains** — the raw `*.vercel.app` URLs
  (`norcet-prep.vercel.app`, `norcet-admin.vercel.app`) bypass Cloudflare entirely, so the
  block does **not** apply there. Treat those as the back door if you rely on the geoblock.
- It will also **block you** when you're outside India. Add an exception rule for your own
  IP, or skip the geoblock if you travel.
- **It can break the daily-reminder cron.** The Vercel cron hits `/api/send-reminders`; if
  that runs via the Cloudflare-proxied domain from a non-India edge, the WAF blocks it and
  reminders stop. After enabling, **confirm reminders still fire** — and if not, add a WAF
  exception (e.g. skip the block when `http.request.uri.path starts_with "/api/"`).
- Turnstile is unaffected — `auth-secure` calls Cloudflare's siteverify server-side from
  Supabase, which the geoblock doesn't touch.

---

## 4. Production Launch Checklist — mapping `nurseholic.in` / `.com` to Cloudflare

Do these in order when you cut the custom domains over to Cloudflare (required for the WAF
and Turnstile geo-context to apply):

1. **Move nameservers:** at the registrar for `nurseholic.in` (and `.com`), point the
   nameservers to the **Cloudflare nameservers** shown when you add the site to Cloudflare.
   *(Today `nurseholic.in` uses third-party/Namecheap nameservers — this is the step that
   hands DNS to Cloudflare.)*
2. **Proxy the DNS (orange cloud ON):** in Cloudflare DNS, the CNAME/A record pointing to
   Vercel must have **Proxy status = Proxied (orange cloud)**. Grey-cloud (DNS-only) means
   the WAF never runs.
3. **SSL/TLS = Full (strict):** Cloudflare → SSL/TLS → Overview → set the encryption mode to
   **Full (strict)** to match Vercel's automatic certificates. **Flexible causes infinite
   redirect loops** with Vercel.

### Domain canonicalization (SEO)
There is **no `next.config.js`** here, so do the `.com → .in` redirect in the platform, not
in code. Pick one:
- **Vercel** → student project → Settings → **Domains** → add `nurseholic.com` and set it to
  **Redirect** to `nurseholic.in` (308). *(Recommended — closest to the app.)*
- or a **Cloudflare Redirect Rule** (`.com` host → `https://nurseholic.in/$1`).

This avoids duplicate-content penalties from serving identical pages on both domains.
