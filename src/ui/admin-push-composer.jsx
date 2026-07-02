// =====================================================================
// src/ui/admin-push-composer.jsx  (admin → Push broadcast)
// Compose + send a Web Push notification to EVERY subscribed device, on
// demand ("New mock is live!"). The send path is the push-broadcast Edge
// Function: it verifies the admin session token, rate-caps (4/hour), and
// relays server-side to api/notify-all — NOTIFY_SECRET never touches a
// client. Premium touches: live OS-style notification preview, colour-shift
// char budgets, two-tap confirm, real send stats on success.
// =====================================================================
import React, { useState } from 'react';
import { BellRing, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from './primitives.jsx';
import { getAuthToken } from '../storage.js';
import { logAdminAction } from '../lib/admin-audit.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const TITLE_MAX = 80, BODY_MAX = 200;

export default function AdminPushComposer({ onBack, actorName }) {
  const { theme: T } = useTheme();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {ok, sent, failed, skipped, total} | {error}

  const canSend = title.trim().length > 0 && text.trim().length > 0;

  const send = async () => {
    if (!canSend || busy) return;
    setBusy(true); setResult(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/push-broadcast`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: getAuthToken(), title: title.trim(), body: text.trim(), url: '/' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setResult({ error: j.error || `Failed (${r.status})` }); return; }
      logAdminAction({ action: 'push.send', detail: { title: title.trim(), sent: j.sent ?? 0, total: j.total ?? 0 }, actorName });
      setResult(j);
      setTitle(''); setText('');
    } catch (e) {
      setResult({ error: 'Network error — are you online?' });
    } finally { setBusy(false); setConfirming(false); }
  };

  const budget = (len, max) => {
    const left = max - len;
    return { text: `${len}/${max}`, color: left < 0 ? T.error : left <= Math.ceil(max * 0.1) ? T.accent : T.muted };
  };
  const tB = budget(title.length, TITLE_MAX);
  const bB = budget(text.length, BODY_MAX);
  const input = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  return (
    <div className="anim-fadeup">
      <TopBar title="Push broadcast" onBack={onBack} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2 space-y-3">
        <Card className="p-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.accent + '18' }}>
              <BellRing size={18} style={{ color: T.accent }} />
            </div>
            <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
              Sends a notification to <b>every subscribed device</b>, even with the app closed.
              Use it sparingly — announcements inside the app are gentler. Capped at 4 per hour.
            </div>
          </div>
        </Card>

        {/* Compose */}
        <Card className="p-4 space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Title</label>
              <span className="text-[10px] tabular-nums" style={{ color: tB.color }}>{tB.text}</span>
            </div>
            <input value={title} maxLength={TITLE_MAX} onChange={e => { setTitle(e.target.value); setResult(null); }}
                   placeholder="e.g. New mock test is live!"
                   className="w-full text-sm rounded-xl px-3 py-2.5 outline-none" style={input} />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Message</label>
              <span className="text-[10px] tabular-nums" style={{ color: bB.color }}>{bB.text}</span>
            </div>
            <textarea value={text} maxLength={BODY_MAX} onChange={e => { setText(e.target.value); setResult(null); }}
                      rows={3} placeholder="One or two short lines — it shows on lock screens."
                      className="w-full text-sm rounded-xl px-3 py-2.5 resize-none outline-none" style={input} />
          </div>
        </Card>

        {/* Live OS-style preview */}
        <div>
          <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5 px-1" style={{ color: T.muted }}>
            Lock-screen preview
          </div>
          <div className="rounded-2xl p-3 flex gap-3 items-start shadow-sm"
               style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-display font-bold text-[13px]"
                 style={{ background: '#0F4C4C', color: '#FFF' }}>N</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold truncate" style={{ color: T.ink }}>{title.trim() || 'NORCET Prep'}</span>
                <span className="text-[10px] flex-shrink-0" style={{ color: T.muted }}>now</span>
              </div>
              <div className="text-[12.5px] leading-snug mt-0.5" style={{ color: T.inkSoft, wordBreak: 'break-word' }}>
                {text.trim() || 'Your message shows here.'}
              </div>
            </div>
          </div>
        </div>

        {/* Result / error */}
        {result && result.error && (
          <div className="text-xs rounded-xl px-3 py-2.5 flex items-start gap-2 anim-fadeup"
               style={{ background: T.errorSoft, border: `1px solid ${T.error}40`, color: T.error }}>
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />{result.error}
          </div>
        )}
        {result && !result.error && (
          <Card className="p-4 anim-fadeup" style={{ borderColor: T.success + '55' }}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={18} style={{ color: T.success }} />
              <span className="font-display text-[15px] font-bold" style={{ color: T.success }}>
                Sent to {result.sent ?? 0} device{(result.sent ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
            <div className="text-[11px]" style={{ color: T.muted }}>
              {result.total ?? 0} subscribed · {result.skipped ?? 0} opted out of content pushes · {result.failed ?? 0} unreachable (stale devices are pruned automatically).
            </div>
          </Card>
        )}

        {/* Send — two-tap confirm */}
        {confirming ? (
          <div className="flex items-center gap-2 anim-fadeup">
            <div className="text-[12px] flex-1" style={{ color: T.ink }}>Notify <b>every device</b> right now?</div>
            <button onClick={send} disabled={busy}
                    className="no-tap-highlight px-4 py-2.5 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 active:scale-95 transition"
                    style={{ background: T.accent, color: '#FFF' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send now
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy}
                    className="no-tap-highlight px-3 py-2.5 rounded-xl text-[13px] font-semibold"
                    style={{ background: T.surfaceWarm, color: T.muted }}>Cancel</button>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)} size="lg" className="w-full" disabled={!canSend || busy}
                  icon={<BellRing size={18} />}>
            Review & send
          </Button>
        )}
      </div>
    </div>
  );
}
