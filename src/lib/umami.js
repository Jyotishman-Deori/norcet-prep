// =====================================================================
// src/lib/umami.js — Umami Cloud (free tier) pageview analytics loader.
//
// Umami is a lightweight, cookieless, privacy-friendly analytics script. We
// load it from env so the app ships ZERO third-party tracking unless a website
// id is configured. This is the Vite/PWA equivalent of Next.js'
// <Script strategy="afterInteractive">: a single `defer` tag pointing at an
// external host = no main-thread cost and no impact on first paint. Because the
// script is fetched at runtime from an external origin, Workbox never precaches
// it, so it has no effect on the offline bundle.
//
// This module injects the external Umami pageview script and exposes
// trackUmami() for custom events (game completions, section favourites) — it
// replaced the retired in-app engagement-analytics module.
//
// Config (public, client-side — set in the Vercel STUDENT project):
//   VITE_UMAMI_WEBSITE_ID  — the website token from the Umami dashboard.
//   VITE_UMAMI_SCRIPT_URL  — script src; defaults to Umami Cloud.
//
// initUmami() is a no-op when no website id is set (local dev, or before the
// env var is configured in production), so it is always safe to call on boot.
// Student app only — admin-main.jsx intentionally does NOT call this (the admin
// app is an internal, owner-only surface).
// =====================================================================

const DEFAULT_SCRIPT_URL = 'https://cloud.umami.is/script.js';

// Guard so a double-invocation (StrictMode, hot reload) can't inject twice.
let _injected = false;

export function initUmami() {
  if (_injected) return;
  if (typeof document === 'undefined') return; // SSR / non-browser safety

  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  const websiteId = (env.VITE_UMAMI_WEBSITE_ID || '').trim();
  if (!websiteId) return; // not configured → ship nothing

  const scriptUrl = (env.VITE_UMAMI_SCRIPT_URL || '').trim() || DEFAULT_SCRIPT_URL;

  // Belt-and-braces: if a tag for this website is already present (e.g. injected
  // by a prior call before the module flag was set), don't add another.
  const existing = document.querySelector(`script[data-website-id="${websiteId}"]`);
  if (existing) { _injected = true; return; }

  const s = document.createElement('script');
  s.defer = true;
  s.src = scriptUrl;
  s.setAttribute('data-website-id', websiteId);
  (document.head || document.documentElement).appendChild(s);
  _injected = true;
}

// Fire a Umami custom event. No-op unless the Umami script has loaded and
// exposed window.umami.track — so it's silent in the admin app (which never
// calls initUmami) and in any deploy where VITE_UMAMI_WEBSITE_ID is unset.
// Used to replace the retired in-app engagement analytics: game completions and
// section favourites now land in the Umami dashboard as events.
export function trackUmami(name, data) {
  try {
    if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
      if (data && typeof data === 'object') window.umami.track(name, data);
      else window.umami.track(name);
    }
  } catch (_) { /* analytics must never break the app */ }
}
