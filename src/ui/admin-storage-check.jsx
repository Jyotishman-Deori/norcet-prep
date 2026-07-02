// =====================================================================
// src/ui/admin-storage-check.jsx  (admin → Storage self-test)
// One-tap health check for the admin↔user shared-storage round-trip. Writes a
// never-rendered `selftest:` canary via the broker, reads it back through the
// SAME anon path every real reader uses, then deletes it — turning the silent
// "admin writes, nobody can read" class (the 2026-07-02 FAQ bug) into a visible
// pass/fail. All logic lives in lib/storage-selftest.js (unit-tested); this is
// just the button + result card.
// =====================================================================
import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Loader2, Database } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from './primitives.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { runStorageSelfTest, SHARED_WRITE_FEATURES } from '../lib/storage-selftest.js';

const io = {
  write:    (k, v) => safeStorage.setSharedStrict(k, v),
  readAnon: (k)    => safeStorage.get(k, true).then(r => (r && r.value != null) ? r.value : null),
  del:      (k)    => safeStorage.delSharedStrict(k),
};

export default function AdminStorageCheck({ onBack }) {
  const { theme: T } = useTheme();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);

  const run = async () => {
    if (busy) return;
    setBusy(true); setRes(null);
    try { setRes(await runStorageSelfTest(io)); }
    catch (e) { setRes({ ok: false, verdict: 'error', hint: String((e && e.message) || e), write: 'fail', read: 'pending' }); }
    finally { setBusy(false); }
  };

  const ok = res && res.ok;
  const tone = ok ? T.success : T.error;

  return (
    <div className="anim-fadeup">
      <TopBar title="Storage self-test" onBack={onBack} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2 space-y-3">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '18' }}>
              <Database size={18} style={{ color: T.primary }} />
            </div>
            <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
              Checks that admin-authored content can actually be <b>read back</b> by the app.
              It writes a hidden probe, reads it through the same path students use, then deletes it.
              Run this after any Supabase policy or Edge-Function change.
            </div>
          </div>
        </Card>

        <Button onClick={run} size="lg" className="w-full" disabled={busy}
                icon={busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}>
          {busy ? 'Running…' : 'Run storage check'}
        </Button>

        {res && (
          <Card className="p-4" style={{ borderColor: tone + '55' }}>
            <div className="flex items-center gap-2 mb-2">
              {ok ? <CheckCircle2 size={20} style={{ color: T.success }} /> : <XCircle size={20} style={{ color: T.error }} />}
              <span className="font-display text-base font-bold" style={{ color: tone }}>
                {ok ? 'Round-trip healthy' : 'Problem found'}
              </span>
            </div>
            <div className="text-sm leading-relaxed mb-3" style={{ color: T.ink }}>{res.hint}</div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <Step label="Broker write" state={res.write} T={T} />
              <Step label="Anon read-back" state={res.read} T={T} />
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
            Features that depend on this round-trip
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SHARED_WRITE_FEATURES.map(f => (
              <span key={f.prefix} className="text-[11px] px-2 py-1 rounded-full" style={{ background: T.surfaceWarm, color: T.inkSoft }}>
                {f.label}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Step({ label, state, T }) {
  const good = state === 'ok';
  const pending = state === 'pending';
  const color = good ? T.success : pending ? T.muted : T.error;
  const text = good ? 'ok' : pending ? 'not run' : (state === 'blocked' ? 'blocked' : state);
  return (
    <div className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: T.surfaceWarm }}>
      <span style={{ color: T.inkSoft }}>{label}</span>
      <span className="font-semibold" style={{ color }}>{text}</span>
    </div>
  );
}
