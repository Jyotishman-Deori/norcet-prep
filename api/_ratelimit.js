// =====================================================================
// api/_ratelimit.js — tiny fixed-window IP rate limiter on Vercel KV.
// Shared by the public serverless endpoints (subscribe, active) and the
// auth-secure proxy path. NOT cryptographic; it's a cheap abuse damper to
// stop mass KV-poisoning / credential-grinding from a single source.
//
// Fixed-window (not sliding) is deliberate: one INCR + one EXPIRE per hit,
// minimal KV ops, good enough to blunt scripted abuse. A determined
// attacker rotating IPs is out of scope here — that needs a WAF/Turnstile,
// noted as a follow-up.
//
// Requires env: KV_REST_API_URL, KV_REST_API_TOKEN (already present for push).
// =====================================================================
import { kv } from '@vercel/kv';

// Best-effort client IP from Vercel's proxy headers.
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

// Returns { ok: true } if under the limit, or { ok: false, retryAfter }.
// bucket = a namespace so different endpoints don't share a counter.
export async function rateLimit(req, { bucket, limit, windowSec }) {
  try {
    const ip = clientIp(req);
    const key = `rl:${bucket}:${ip}`;
    // INCR creates the key at 1 on first hit; set TTL only on that first hit
    // so the window is fixed from the first request, not sliding.
    const n = await kv.incr(key);
    if (n === 1) { try { await kv.expire(key, windowSec); } catch (_) {} }
    if (n > limit) {
      let ttl = windowSec;
      try { const t = await kv.ttl(key); if (typeof t === 'number' && t > 0) ttl = t; } catch (_) {}
      return { ok: false, retryAfter: ttl };
    }
    return { ok: true };
  } catch (e) {
    // Fail OPEN on limiter errors: a KV blip must not take down login/subscribe.
    // (The endpoints still have their own validation; the limiter is a damper.)
    return { ok: true, degraded: true };
  }
}
