import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Build stamp injected as __APP_VERSION__ (Settings → Version). Previously this
// global was referenced but never defined, so every build showed "dev" and you
// couldn't tell whether a new deploy had actually gone live. Now it's a UTC
// build time + short git hash (Vercel builds from a git checkout, so the hash
// resolves there too; falls back to time-only if git isn't available).
function buildStamp() {
  let hash = '';
  try { hash = execSync('git rev-parse --short HEAD').toString().trim(); } catch (e) { /* not a git checkout */ }
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z';
  return hash ? `${stamp} · ${hash}` : stamp;
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildStamp()),
  },
  plugins: [
    react(),
    VitePWA({
      // Auto-update strategy: a new SW is fetched in the background, and our
      // main.jsx triggers a reload when the new build is ready and the tab is
      // hidden / next becomes hidden. No update prompt UI to bolt on.
      registerType: 'autoUpdate',
      // Inject the manifest reference. Static icons live under /public.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'NORCET Prep',
        short_name: 'NORCET',
        description: 'NORCET nursing exam practice — quick tests, mocks, topic drills, spaced revision.',
        // App background colour the OS uses while the splash is up. Matches
        // LIGHT_THEME.bg so the boot screen feels continuous.
        background_color: '#FBF7ED',
        // Address-bar / system UI tint when the PWA is open.
        theme_color: '#0F4C4C',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // Reasonable language hint — the app is English-only.
        lang: 'en',
        icons: [
          { src: '/icon-192.png',           sizes: '192x192', type: 'image/png',                  purpose: 'any' },
          { src: '/icon-512.png',           sizes: '512x512', type: 'image/png',                  purpose: 'any' },
          { src: '/icon-maskable-512.png',  sizes: '512x512', type: 'image/png',                  purpose: 'maskable' }
        ]
      },
      workbox: {
        // Session 5 — pull in the Web Push handlers (push + notificationclick).
        // public/push-sw.js is copied to the dist root, so the generated SW can
        // importScripts() it without disturbing the precaching strategy.
        importScripts: ['push-sw.js'],
        // Precache everything Vite emits. globPatterns is the source of truth
        // for what's available offline on first visit.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff,woff2}'],
        // Lift the per-file precache size cap so the App bundle (a single
        // ~640KB jsx becomes a larger emitted JS chunk after JSX → JS) isn't
        // excluded from precaching. 5MB is plenty of headroom; raise further
        // if the bundle grows.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Runtime caching: Google Fonts (the App imports Fraunces + DM Sans
        // via @import in fontStyles). Without this, the very first offline
        // visit would render in the fallback system font.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' }
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ],
        // The default navigation fallback returns index.html for any client
        // route. Our app is a SPA with no client routing today, but the
        // fallback is harmless and future-proofs deep links.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true
      },
      // Dev-mode SW makes testing offline behaviour easier without a full
      // production build. Production behaviour is unaffected.
      devOptions: { enabled: false }
    })
  ],
  build: {
    target: 'es2019',
    sourcemap: false,
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        // Pull the big third-party libs out of the main app chunk. Smaller
        // entry chunk = faster first paint and less invalidation when only
        // app code changes. (React/ReactDOM are small enough that Vite
        // happily inlines them into the main bundle; carving them out
        // produced an empty chunk in practice, so they're omitted here.)
        // #1 — recharts is intentionally NOT a manualChunk. Forcing it into a
        // named vendor chunk made Vite emit a <link rel="modulepreload"> for it
        // in index.html, pulling 152 KB gzip into the initial load even though
        // only the lazy chart screens (StatsScreen, weightage) use it. Left to
        // Rollup, recharts lands in an async chunk shared by those two screens
        // and is fetched on demand. lucide-react stays carved out — it's used
        // by nearly every screen, so it's legitimately part of the initial load.
        manualChunks: {
          'icons-vendor': ['lucide-react'],
        }
      }
    }
  }
});
