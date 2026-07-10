// =====================================================================
// src/lib/storage-selftest.js — admin "Storage self-test".
//
// WHY THIS EXISTS (2026-07-02): an admin published FAQs that saved fine but
// never appeared for anyone. Root cause was a *read-side* RLS drift — the anon
// SELECT policy on kv_shared had quietly become an allowlist and stopped
// covering newer key prefixes (faq:/faqq:/trend:/qgate:/feedback:/analytics:/
// errlog:). Writes succeeded; reads returned empty; nothing errored. It stayed
// invisible for days because there was no check for it.
//
// This module turns that whole silent class into a one-tap check. It writes a
// canary to a dedicated, NEVER-rendered `selftest:` key via the broker, reads it
// back through the SAME anon path every real reader uses, then deletes it:
//   • write fails  -> the kv-write BROKER is rejecting a key it shouldn't
//                     (stale deploy / missing allow-list branch / not admin).
//   • write ok but read blocked -> the anon RLS SELECT policy is hiding new
//                     keys (the allowlist-drift bug). Apply
//                     supabase/fix-anon-read-policy.sql.
//   • both ok      -> admin↔user round-trip is healthy.
//
// Pure + IO-injected so it is unit-testable with no network.
// =====================================================================

export const SELFTEST_PREFIX = 'selftest:';

// Mirrors src/storage.js BROKER_READ_PREFIXES — the ONLY prefixes that must NOT
// be anon-readable (served per-owner by the kv-read broker + hidden by the anon
// SELECT denylist in supabase/secure-admin-read-policy.sql). Everything else is
// public-read by design. If storage.js grows a prefix, add it here too: the
// self-test is the drift alarm for the live policy.
export const PRIVATE_READ_PREFIXES = ['profile:', 'myfeedback:', 'feedback:', 'errlog:', 'analytics:', 'adminlog:'];

// One privacy probe per protected prefix. `writePrefix` is the key family the
// kv-write broker actually accepts (analytics: rows live under analytics:user:).
export const PRIVACY_PROBES = PRIVATE_READ_PREFIXES.map((prefix) => ({
  prefix,
  writePrefix: prefix === 'analytics:' ? 'analytics:user:' : prefix,
}));

// The shared-write features whose admin↔user round-trip the app depends on.
// Shown as a reference checklist in the self-test screen; the live canary is
// what actually proves the broker + RLS are healthy right now.
export const SHARED_WRITE_FEATURES = [
  { prefix: 'faq:',            label: 'FAQ entries' },
  { prefix: 'faqq:',           label: 'FAQ community Q&A' },
  { prefix: 'announcement:',   label: 'Announcements' },
  { prefix: 'qgate:',          label: 'Content quality gate' },
  { prefix: 'trend:',          label: 'Trending' },
  { prefix: 'feedback:',       label: 'Feedback reports' },
  { prefix: 'analytics:user:', label: 'Engagement analytics' },
  { prefix: 'errlog:',         label: 'Crash reports' },
];

// Turn a broker error into a short, admin-readable reason.
export function writeFailHint(e) {
  const m = String((e && e.message) || e || '');
  if (/401/.test(m)) return 'Admin session expired, log out and back in.';
  if (/403/.test(m)) return 'Broker rejected the write (not admin, or the deployed kv-write is missing this key, redeploy it).';
  if (/429|rate/i.test(m)) return 'Rate-limited, wait a moment and retry.';
  return 'Write failed: are you online and using the admin profile?';
}

// runStorageSelfTest(io, now?) — io = {
//   write(key, value): Promise    // strict broker write; THROWS on rejection
//   readAnon(key): Promise<string|null>  // read via the SAME anon path real readers use
//   del(key): Promise             // best-effort cleanup
//   readAnonRaw?(key): Promise<string|null> // RAW anon REST read that BYPASSES
//     the kv-read broker routing — exactly what a curious student could do.
//     When provided, the test also probes every PRIVATE prefix: broker-write a
//     canary there, then prove anon CANNOT read it back. Detects the RLS
//     denylist drifting (the leak direction the 2026-07-02 class missed).
// }
// The selftest: canary doubles as the CONTROL: it must stay anon-READABLE, so
// the test catches over-blocking and under-blocking in one run.
// Probe values carry severity 'ux' so the errlog: probe never consumes the
// owner crash-alert email budget (kv-write skips the alert for ux telemetry).
// Returns a plain result object (no throwing) describing the round-trip.
export async function runStorageSelfTest(io, now = Date.now()) {
  const key = `${SELFTEST_PREFIX}canary-${now}`;
  const token = `ok-${now}`;
  const result = { key, write: 'pending', read: 'pending', cleanup: 'skip', ok: false, verdict: '', hint: '', privacy: null };

  // 1) WRITE via broker (strict — throws on 401/403/429/offline).
  try {
    await io.write(key, JSON.stringify({ probe: true, token }));
    result.write = 'ok';
  } catch (e) {
    result.write = 'fail';
    result.verdict = 'broker-write-failed';
    result.hint = writeFailHint(e);
    return result;
  }

  // 2) READ back via the anon path every real reader uses.
  let val = null;
  try { val = await io.readAnon(key); } catch (e) { val = null; }
  if (val == null) {
    result.read = 'blocked';
    result.verdict = 'rls-read-blocked';
    result.hint = 'Saved, but not anon-readable. The RLS SELECT policy is hiding new keys. Apply supabase/fix-anon-read-policy.sql.';
  } else {
    let matched = false;
    try { matched = JSON.parse(val).token === token; } catch (_) { matched = false; }
    result.read = matched ? 'ok' : 'stale';
    if (!matched) {
      result.verdict = 'read-mismatch';
      result.hint = 'Read back a different value than written, stale cache or a routing bug.';
    }
  }

  // 3) PRIVACY PROBES — for each protected prefix: broker-write a canary,
  // prove the RAW anon path can NOT read it, then delete it. States:
  //   blocked  = pass (row exists, anon sees nothing)
  //   leaked   = the anon SELECT denylist has drifted: private data is public
  //   no-probe = the broker refused the canary write (stale kv-write deploy);
  //              the leak check could not run, surfaced as a failure.
  if (typeof io.readAnonRaw === 'function') {
    result.privacy = [];
    for (const probe of PRIVACY_PROBES) {
      const pKey = `${probe.writePrefix}selftest-canary-${now}`;
      const row = { prefix: probe.prefix, key: pKey, state: 'no-probe' };
      let written = false;
      try { await io.write(pKey, JSON.stringify({ probe: true, severity: 'ux', token })); written = true; }
      catch (_) { /* stays no-probe */ }
      if (written) {
        let leakedVal = null;
        try { leakedVal = await io.readAnonRaw(pKey); } catch (_) { leakedVal = null; }
        row.state = leakedVal == null ? 'blocked' : 'leaked';
        try { await io.del(pKey); } catch (_) { /* leftover canary is inert */ }
      }
      result.privacy.push(row);
    }
  }

  // 4) CLEANUP (best-effort — a leftover canary is harmless; it is never rendered).
  try { await io.del(key); result.cleanup = 'ok'; } catch (_) { result.cleanup = 'skip'; }

  const baseOk = result.write === 'ok' && result.read === 'ok';
  const leaked = (result.privacy || []).filter((p) => p.state === 'leaked');
  const noProbe = (result.privacy || []).filter((p) => p.state === 'no-probe');
  result.ok = baseOk && leaked.length === 0 && noProbe.length === 0;

  if (baseOk && leaked.length > 0) {
    result.verdict = 'rls-leak';
    result.hint = `PRIVATE data is anon-readable (${leaked.map((p) => p.prefix).join(' ')}). The anon SELECT denylist has drifted. Apply supabase/secure-admin-read-policy.sql now.`;
  } else if (baseOk && noProbe.length > 0) {
    result.verdict = 'probe-write-failed';
    result.hint = `Could not plant a canary under ${noProbe.map((p) => p.prefix).join(' ')} so the leak check did not run there. The deployed kv-write is likely stale, redeploy it.`;
  } else if (result.ok) {
    result.verdict = 'pass';
    result.hint = result.privacy
      ? 'Broker accepts admin writes, public keys read back fine, and all six private prefixes are hidden from anonymous reads.'
      : 'Broker accepts admin writes and every reader can read them back.';
  }
  return result;
}
