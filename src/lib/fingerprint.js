// =====================================================================
// src/lib/fingerprint.js — coarse, privacy-respecting device fingerprint for
// fake-account ANOMALY DETECTION only (Phase 2, admin-only signal).
//
// Hashes a handful of non-PII device signals so the same browser/device yields
// the same hash across signups — but the hash is one-way (SHA-256) and can't be
// reversed to anything identifying. It is NEVER used to block a signup; it only
// lets the admin panel flag CLUSTERS (many accounts from one device/IP) for
// manual review. Sent only at register time. Best-effort: returns '' on any
// failure, and the server treats a missing fingerprint as simply "no signal".
// =====================================================================
let _cached = null;

async function sha256Hex(str) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return ''; }
}

export async function getFingerprint() {
  if (_cached !== null) return _cached;
  try {
    const n = (typeof navigator !== 'undefined') ? navigator : {};
    const s = (typeof screen !== 'undefined') ? screen : {};
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    const signals = [
      n.userAgent || '',
      n.language || '',
      Array.isArray(n.languages) ? n.languages.join(',') : '',
      n.platform || '',
      String(n.hardwareConcurrency || ''),
      String(s.width || '') + 'x' + String(s.height || ''),
      String(s.colorDepth || ''),
      tz,
    ].join('|');
    _cached = await sha256Hex(signals);
  } catch (e) { _cached = ''; }
  return _cached;
}
