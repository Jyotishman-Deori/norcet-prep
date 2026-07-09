// =====================================================================
// src/ui/comparison-cards.jsx — Phase 3 UI: the consented weekly comparison +
// batches. Every piece is opt-in and degrades to nothing if the user is a guest
// or the referral-compare function isn't deployed.
//
//   ComparisonToggle      on/off switch (Share page + Profile; both read the
//                         same data, so they're always in sync)
//   PeerComparisonCard    warm 1:1 "you vs a friend" weekly card (results)
//   ComparisonReengage    one gentle nudge to opt back in after a strong week
//   BatchCreateCard       make a batch invite link (name + expiry) and share it
//   BatchList             your batches + each batch's rank/average
//   BatchJoinModal        confirmation before joining a batch you were invited to
// =====================================================================
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, Trophy, BarChart3, Copy, Check, MessageCircle, Plus, LogOut, X, Sparkles } from 'lucide-react';
import { useTheme, useData, useProfile } from '../lib/app-context.jsx';
import { Card } from '../ui/primitives.jsx';
import {
  createBatch, peerComparison, batchComparison, getBatchInfo,
  getCompareOptIn, withCompareOptIn, getJoinedBatches, withBatchJoined, withBatchLeft,
} from '../lib/compare.js';
import { buildBatchUrl } from '../lib/referral.js';
import { safeStorage } from '../lib/safe-storage.js';

function isGuest(profile) { return !profile || profile.isGuest; }

// ---------------------------------------------------------------------
// ComparisonToggle — the single source of truth for opt-in (in data).
// ---------------------------------------------------------------------
export function ComparisonToggle() {
  const { theme: T } = useTheme();
  const { data, setData } = useData();
  const on = getCompareOptIn(data);
  const toggle = () => setData(d => withCompareOptIn(d, !getCompareOptIn(d)));
  return (
    <div className="rounded-2xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '1A', color: T.primary }}>
          <BarChart3 size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium" style={{ color: T.ink }}>Compare weekly progress</div>
          <div className="text-xs mt-0.5" style={{ color: T.muted }}>
            Friends you invited (and your batches) can see your weekly accuracy, and you see theirs. On by default; switch off anytime.
          </div>
        </div>
        <button onClick={toggle} role="switch" aria-checked={on}
                className="no-tap-highlight relative flex-shrink-0 w-11 h-6 rounded-full transition-colors"
                style={{ background: on ? T.success : T.border }}>
          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: on ? 'translateX(20px)' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </button>
      </div>
      {on && (
        <div className="text-[11px] mt-2.5 pt-2.5" style={{ color: T.muted, borderTop: `1px solid ${T.borderSoft}` }}>
          Only people connected to you see it, and only a weekly accuracy %, never your answers or activity. Turn this off and you vanish from every comparison instantly.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// PeerComparisonCard — 1:1 weekly accuracy vs a referral-connected friend.
// Calls the function only when the user is opted in (avoids needless calls).
// ---------------------------------------------------------------------
export function PeerComparisonCard() {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { profile } = useProfile();
  const [res, setRes] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; ran.current = true;
    if (isGuest(profile) || !getCompareOptIn(data)) return;
    peerComparison().then(r => { if (r && r.optedIn) setRes(r); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!res || !Array.isArray(res.peers) || res.peers.length === 0) return null;
  const you = res.you || { pct: 0, count: 0 };
  const peer = res.peers[0];
  const lead = you.pct - peer.pct;
  const msg = lead > 0 ? `You're ahead by ${lead} point${lead === 1 ? '' : 's'} this week: keep it up!`
    : lead < 0 ? `${peer.name} is ${Math.abs(lead)} ahead this week, you've got this.`
      : `Neck and neck with ${peer.name} this week!`;

  const Bar = ({ label, pct, accent }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium truncate" style={{ color: T.ink }}>{label}</span>
        <span className="text-sm font-semibold tabular-nums" style={{ color: accent }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: T.borderSoft }}>
        <div className="h-2 rounded-full transition-all duration-700" style={{ background: accent, width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );

  return (
    <div className="anim-fadeup mt-3 rounded-2xl p-4" style={{ background: `linear-gradient(140deg, ${T.primary}10 0%, ${T.surface} 60%, ${T.primary}0A 100%)`, border: `1px solid ${T.primary}28` }}>
      <div className="flex items-center gap-2 mb-3">
        <Users size={15} style={{ color: T.primary }} />
        <span className="text-sm font-medium" style={{ color: T.ink }}>This week with {peer.name}</span>
      </div>
      <div className="space-y-2.5">
        <Bar label="You" pct={you.pct} accent={T.primary} />
        <Bar label={peer.name} pct={peer.pct} accent={T.muted} />
      </div>
      <div className="text-[11px] mt-3" style={{ color: T.muted }}>{msg}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// ComparisonReengage — ONE gentle invite to opt back in after a strong week.
// Shows only when comparison is OFF and the session was strong; rate-limited
// to once every ~2 weeks via a local marker.
// ---------------------------------------------------------------------
const REENGAGE_KEY = 'norcet:compare-reengage:v1';
const REENGAGE_GAP_MS = 14 * 24 * 60 * 60 * 1000;

export function ComparisonReengage({ pct = 0 }) {
  const { theme: T } = useTheme();
  const { data, setData } = useData();
  const { profile } = useProfile();
  const [show, setShow] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; ran.current = true;
    if (isGuest(profile) || getCompareOptIn(data) || pct < 80) return;
    (async () => {
      try {
        const r = await safeStorage.get(REENGAGE_KEY, false);
        const last = r && r.value ? Number(r.value) : 0;
        if (Date.now() - last < REENGAGE_GAP_MS) return;
        await safeStorage.set(REENGAGE_KEY, String(Date.now()), false);
        setShow(true);
      } catch (e) {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;
  return (
    <div className="anim-fadeup mt-3 rounded-2xl p-4" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.success + '1A', color: T.success }}>
          <Sparkles size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium" style={{ color: T.ink }}>Strong week!</div>
          <div className="text-xs mt-0.5" style={{ color: T.muted }}>Want to compare weekly progress with friends you invited?</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={() => { setData(d => withCompareOptIn(d, true)); setShow(false); }}
                className="no-tap-highlight py-2.5 rounded-xl text-xs font-semibold active:scale-95" style={{ background: T.primary, color: '#FFF' }}>
          Turn on
        </button>
        <button onClick={() => setShow(false)}
                className="no-tap-highlight py-2.5 rounded-xl text-xs font-semibold active:scale-95" style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>
          Not now
        </button>
      </div>
    </div>
  );
}

// small inline link-share row (copy + WhatsApp) reused by batch create.
function LinkShareRow({ url, waText }) {
  const { theme: T } = useTheme();
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) {} };
  const wa = () => { const u = `https://wa.me/?text=${encodeURIComponent(waText || url)}`; try { window.open(u, '_blank', 'noopener,noreferrer'); } catch (e) { window.location.href = u; } };
  return (
    <div className="mt-3">
      <div className="px-3 py-2.5 rounded-xl mb-2 text-center text-xs font-medium break-all" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}>{url}</div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={copy} className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95"
                style={{ background: copied ? T.success + '18' : T.primary + '14', color: copied ? T.success : T.primary, border: `1px solid ${copied ? T.success + '50' : T.primary + '40'}` }}>
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy link'}
        </button>
        <button onClick={wa} className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95"
                style={{ background: '#25D366', color: '#FFF' }}>
          <MessageCircle size={13} /> WhatsApp
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// BatchCreateCard — make a named batch invite link.
// ---------------------------------------------------------------------
export function BatchCreateCard() {
  const { theme: T } = useTheme();
  const { setData } = useData();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null); // { batchId, name }
  const [err, setErr] = useState('');

  if (isGuest(profile)) return null;

  const create = async () => {
    const nm = name.trim();
    if (!nm || busy) return;
    setBusy(true); setErr('');
    const r = await createBatch(nm, days);
    setBusy(false);
    if (!r || !r.batchId) { setErr('Couldn\u2019t create the batch link. Please try again.'); return; }
    setData(d => withBatchJoined(d, r.batchId)); // creator auto-joins
    setMade({ batchId: r.batchId, name: nm });
  };

  if (made) {
    const url = buildBatchUrl(made.batchId);
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Check size={15} style={{ color: T.success }} />
          <span className="text-sm font-semibold" style={{ color: T.ink }}>"{made.name}" is ready</span>
        </div>
        <div className="text-xs" style={{ color: T.muted }}>Share this link with your batch. Everyone who joins can compare weekly progress.</div>
        <LinkShareRow url={url} waText={`Join my NORCET study batch "${made.name}" and let\u2019s compare weekly progress: ${url}`} />
        <button onClick={() => { setMade(null); setName(''); }} className="no-tap-highlight w-full mt-2 py-2 text-xs font-medium" style={{ color: T.muted }}>Create another</button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {!open ? (
        <button onClick={() => setOpen(true)} className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 py-1 text-sm font-medium active:scale-95" style={{ color: T.primary }}>
          <Plus size={16} /> Create a batch invite link
        </button>
      ) : (
        <div>
          <div className="text-sm font-medium mb-2" style={{ color: T.ink }}>New batch</div>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Batch name (e.g. 2026 Crash Course)"
                 className="w-full px-3 py-2.5 rounded-xl text-sm mb-3 outline-none"
                 style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.ink }} />
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Link expires</div>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[[7, '7 days'], [30, '30 days'], [0, 'Never']].map(([d, label]) => {
              const on = days === d;
              return (
                <button key={d} onClick={() => setDays(d)} className="no-tap-highlight py-2 rounded-xl text-[12px] font-semibold active:scale-95"
                        style={{ background: on ? T.primary : T.surfaceWarm, color: on ? '#FFF' : T.inkSoft, border: `1px solid ${on ? T.primary : T.border}` }}>
                  {label}
                </button>
              );
            })}
          </div>
          {err && <div className="text-[11px] mb-2" style={{ color: T.error }}>{err}</div>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setOpen(false); setErr(''); }} className="no-tap-highlight py-2.5 rounded-xl text-xs font-semibold active:scale-95" style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>Cancel</button>
            <button onClick={create} disabled={busy || !name.trim()} className="no-tap-highlight py-2.5 rounded-xl text-xs font-semibold active:scale-95" style={{ background: T.primary, color: '#FFF', opacity: (busy || !name.trim()) ? 0.6 : 1 }}>
              {busy ? 'Creating\u2026' : 'Create link'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
// BatchRow — one joined batch + its (consented) comparison.
// ---------------------------------------------------------------------
function BatchRow({ batchId, onLeave }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const [info, setInfo] = useState(undefined); // undefined=loading, null=gone
  const [cmp, setCmp] = useState(null);
  const optedIn = getCompareOptIn(data);

  useEffect(() => {
    let on = true;
    getBatchInfo(batchId).then(i => { if (on) setInfo(i); }).catch(() => { if (on) setInfo(null); });
    if (optedIn) batchComparison(batchId).then(c => { if (on && c) setCmp(c); }).catch(() => {});
    return () => { on = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, optedIn]);

  const name = info && info.name ? info.name : 'Batch';
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15', color: T.primary }}>
          <Users size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate" style={{ color: T.ink }}>{name}</div>
          {info && info.creatorName && <div className="text-[11px]" style={{ color: T.muted }}>by {info.creatorName}</div>}
        </div>
        <button onClick={() => onLeave(batchId)} className="no-tap-highlight p-1.5 rounded-lg active:scale-90" style={{ color: T.muted }} aria-label="Leave batch">
          <LogOut size={15} />
        </button>
      </div>

      {!optedIn ? (
        <div className="text-[11px] mt-3 pt-3" style={{ color: T.muted, borderTop: `1px solid ${T.borderSoft}` }}>
          Turn on weekly comparison to see how the batch is doing.
        </div>
      ) : cmp && cmp.optedIn ? (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: T.muted }}>Your week</div>
              <div className="font-display text-xl font-semibold tabular-nums" style={{ color: T.primary }}>{cmp.yourPct == null ? '—' : cmp.yourPct + '%'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: T.muted }}>Batch average</div>
              <div className="font-display text-xl font-semibold tabular-nums" style={{ color: T.ink }}>{cmp.activeCount ? cmp.batchAvg + '%' : '—'}</div>
            </div>
          </div>
          {cmp.rank ? (
            <div className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: T.primary + '14', color: T.primary }}>
              <Trophy size={12} /> Rank #{cmp.rank} of {cmp.activeCount} active
            </div>
          ) : (
            <div className="text-[11px] mt-2.5" style={{ color: T.muted }}>
              {cmp.activeCount < cmp.threshold
                ? `Ranks show once ${cmp.threshold}+ members are active in a week (currently ${cmp.activeCount}).`
                : 'Practise this week to appear in the ranking.'}
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------
// BatchList — all batches the user has joined.
// ---------------------------------------------------------------------
export function BatchList() {
  const { data, setData } = useData();
  const { profile } = useProfile();
  const batches = getJoinedBatches(data);
  if (isGuest(profile) || batches.length === 0) return null;
  const leave = (id) => setData(d => withBatchLeft(d, id));
  return (
    <div className="space-y-2.5">
      {batches.map(id => <BatchRow key={id} batchId={id} onLeave={leave} />)}
    </div>
  );
}

// ---------------------------------------------------------------------
// BatchJoinModal — confirmation before joining a batch you were invited to.
// Joining also turns on comparison (that's the point of a batch); the copy
// says so, and it can be switched off anytime.
// ---------------------------------------------------------------------
export function BatchJoinModal({ batchId, onDone }) {
  const { theme: T } = useTheme();
  const { data, setData } = useData();
  const { profile } = useProfile();
  const [info, setInfo] = useState(undefined); // undefined=loading, null=gone, obj=record

  const guest = isGuest(profile);
  const alreadyIn = getJoinedBatches(data).includes(batchId);

  useEffect(() => {
    if (guest) return;
    let on = true;
    getBatchInfo(batchId).then(i => { if (on) setInfo(i); }).catch(() => { if (on) setInfo(null); });
    return () => { on = false; };
  }, [batchId, guest]);

  // Auto-dismiss (and clear the pending invite) for EVERY terminal state — a
  // guest, an already-joined batch, or an invalid/expired record — so a stale
  // or undeliverable invite can never sit on the home screen. Only a genuine,
  // joinable invite ever renders a dialog.
  const terminal = guest || alreadyIn || (info !== undefined && (!info || info.expired));
  useEffect(() => {
    if (terminal) onDone && onDone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminal]);

  if (terminal || info === undefined) return null; // nothing to show, or still loading

  const close = () => onDone && onDone();
  const join = () => {
    setData(d => withBatchJoined(withCompareOptIn(d, true), batchId));
    onDone && onDone();
  };

  // Portaled to <body> so its position:fixed can't be re-anchored by a
  // transformed/animated ancestor (the app's screen roots animate in).
  const node = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={close}>
      <div className="w-full max-w-sm rounded-3xl p-5 anim-fadeup" style={{ background: T.surface }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: T.primary + '18', color: T.primary }}>
            <Users size={20} />
          </div>
          <button onClick={close} className="no-tap-highlight p-1.5 -mr-1 -mt-1 rounded-lg active:scale-90" style={{ color: T.muted }} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="text-base font-semibold mb-1" style={{ color: T.ink }}>Join {'\u201C'}{info.name}{'\u201D'}?</div>
        <div className="text-sm" style={{ color: T.muted }}>
          {info.creatorName ? `${info.creatorName} invited you. ` : ''}Members compare their weekly accuracy to stay motivated together.
        </div>
        <div className="text-[11px] mt-2 mb-4" style={{ color: T.muted }}>
          Comparison is on by default: only your weekly accuracy %, never your answers. You can switch it off anytime in Settings.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={close} className="no-tap-highlight py-3 rounded-xl text-sm font-semibold active:scale-95" style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>Not now</button>
          <button onClick={join} className="no-tap-highlight py-3 rounded-xl text-sm font-semibold active:scale-95" style={{ background: T.primary, color: '#FFF' }}>Join batch</button>
        </div>
      </div>
    </div>
  );
  return (typeof document !== 'undefined') ? createPortal(node, document.body) : node;
}
