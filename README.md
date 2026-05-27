# NORCET Prep

A Progressive Web App for NORCET nursing exam practice. Vite + React frontend,
Supabase for shared multi-user data, IndexedDB for per-device personal data.

## Local development

```bash
npm install
# Make sure .env exists with your Supabase keys (see .env.example)
npm run dev          # http://localhost:5173
npm run build        # → dist/
npm run preview      # serves the production build locally
```

## Project layout

```
.
├── index.html              Vite entry; PWA meta, apple-touch-icon
├── package.json            Pinned deps (React 18, idb, vite-plugin-pwa, Tailwind 3)
├── vite.config.js          PWA plugin, Workbox, manual chunks
├── postcss.config.js       Tailwind + Autoprefixer
├── tailwind.config.js      Content globs
├── vercel.json             SPA rewrites + immutable asset cache headers
├── .env                    Supabase URL + publishable key  (LOCAL — gitignored)
├── .env.example            Reference file showing required env vars (committed)
├── supabase/
│   └── setup.sql           One-time DB schema + RLS policies (run in SQL Editor)
├── public/                 Static assets, icons, manifest
└── src/
    ├── main.jsx            React entry + service worker registration
    ├── App.jsx             The full study app (unchanged from Stage 1)
    ├── storage.js          IndexedDB (local) + Supabase (shared) storage layer
    └── index.css           Tailwind directives + global resets
```

## Storage architecture (Stage 2)

The app's `safeStorage` shim in `App.jsx` calls into `src/storage.js`. Every
call carries a `shared` flag that decides where the data lives:

- **`shared: false`** — per-device personal data (session, theme, onboarding,
  admin unlock). Lives in **IndexedDB** on the device. Works offline.
- **`shared: true`** — multi-user data (profiles, banks, feedback,
  announcements). Lives in a single **Supabase Postgres table** called
  `kv_shared`. Visible across all users and devices — same behaviour as the
  original Claude artifact.

`App.jsx` itself doesn't know which is which. The shim handles the routing.

## Supabase setup (one-time, for a fresh project)

1. Create a Supabase project at https://supabase.com (free tier is fine).
2. Pick a region close to your users (Mumbai for India).
3. Open the **SQL Editor** in the Supabase dashboard, paste in
   `supabase/setup.sql`, and click **Run**.
4. Open **Settings → API**. Copy:
   - **Project URL** → goes in `VITE_SUPABASE_URL`
   - **Publishable key** (starts with `sb_publishable_…`) → goes in
     `VITE_SUPABASE_ANON_KEY`
5. Put both values in `.env` for local dev, and in Vercel's
   Environment Variables UI for production deploys.

The publishable key is safe to embed in client code — it appears in
every user's downloaded JS. Real security comes from the Postgres
Row-Level Security policies set up by `setup.sql`.

## Deploying to Vercel

### First-time deploy

1. Push the repo to GitHub.
2. Open https://vercel.com/new, import the repo. Framework auto-detects as Vite.
3. **Before clicking Deploy:** expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_ANON_KEY` = your publishable key
4. Click **Deploy**.

### Subsequent deploys

Just `git push`. Vercel rebuilds automatically. Env vars persist across deploys.

### Adding the env vars later (if you skipped step 3 above)

In the Vercel dashboard:

1. Open the project → **Settings** → **Environment Variables**.
2. Add the two variables. Tick all three environments (Production, Preview,
   Development).
3. Trigger a redeploy: **Deployments** tab → latest deploy → ⋯ → **Redeploy**.

## PWA behaviour

- **Offline-first.** First visit precaches the app shell via Workbox.
  Subsequent visits work without network for everything except shared
  features (which obviously need a network).
- **Google Fonts** runtime-cached. After first online load, fonts work offline.
- **Auto-update.** New builds activate next time the tab is hidden.
- **Installable** on iOS (Safari → Share → Add to Home Screen) and Android
  (Chrome → install prompt).

## Verifying after deploy

In Chrome DevTools on your deployed URL:

1. **Application → Manifest** — name, icons, theme colour show with no errors.
2. **Application → Service Workers** — `sw.js` is activated.
3. **Application → IndexedDB → `norcet-prep`** — local store appears after
   first interaction.
4. **Network tab** — when you create a profile or send feedback, you should
   see PATCH/POST calls to `…supabase.co/rest/v1/kv_shared`.
5. **Supabase dashboard → Table Editor → `kv_shared`** — rows appear as users
   sign up, create banks, etc.

If shared features stay empty and you see `[storage]` warnings in the browser
console about missing env vars, the Vercel env vars aren't set — see the
"Adding the env vars later" section above.
