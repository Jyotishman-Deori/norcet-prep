import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
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
        manualChunks: {
          'recharts-vendor': ['recharts'],
          'icons-vendor':   ['lucide-react'],
        }
      }
    }
  }
});
