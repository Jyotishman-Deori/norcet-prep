// =====================================================================
// src/ui/admin-waitlist.jsx  (admin → Waitlist)
// Batch-release control room for the launch waitlist: status tabs, priority-
// score sorting, state filter, bulk approve/reject, abuse-cluster review, and
// a one-tap WhatsApp nudge per approved row (MANUAL by design — spec §10.5:
// never automate WhatsApp sends). Data comes exclusively from the waitlist
// Edge Function's admin actions (src/lib/waitlist-admin.js); the table itself
// is service-role-only.
//
// Owner playbook (shown as hint text): drop ~batchSize seats on the Tue/Fri
// schedule, skim the Review tab's referral clusters first (3-referral groups
// land there automatically, never auto-approved), then nudge each approved
// student on WhatsApp with their claim link. Claims expire after 48h — the
// sweep button (or lazy expiry) frees unclaimed seats.
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, Users, ShieldAlert, Check, X, MessageCircle, Copy,
  Clock, Ticket, ChevronDown, AlertTriangle, Trophy, Send, Mail,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar, requestConfirm } from './primitives.jsx';
import { agoLabel } from '../lib/engagement.js';
import {
  stateLabel, INDIAN_STATES, STATUS_LABELS,
  buildClaimUrl, buildApprovalNudgeMessage, buildWaUrl, formatIstTime,
  WAITLIST_APP_ORIGIN,
} from '../lib/waitlist.js';
import {
  waitlistAdminList, waitlistAdminApprove, waitlistAdminReject, waitlistAdminExpireSweep,
  waitlistAdminTestInvite,
} from '../lib/waitlist-admin.js';

const TABS = [
  { id: 'waiting', label: 'Waiting' },
  { id: 'pending_verification', label: 'Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'onboarded', label: 'Joined' },
  { id: 'past', label: 'Past' }, // expired + rejected
];

function tabMatches(tabId, row) {
  if (tabId === 'past') return row.effectiveStatus === 'expired' || row.effectiveStatus === 'rejected';
  return row.effectiveStatus === tabId;
}

export default function AdminWaitlist({ onBack }) {
  const { theme: T } = useTheme();
  const [data, setData] = useState(null);   // null = loading; {rows, counts, flags, suggestedBatch}
  const [error, setError] = useState(null);
  const [spin, setSpin] = useState(false);
  const [tab, setTab] = useState('waiting');
  const [stateFilter, setStateFilter] = useState('all'); // 'all' | 'ne' | state id
  const [selected, setSelected] = useState(() => new Set());
  const [topN, setTopN] = useState(25);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);     // {ok, text}
  const [copiedId, setCopiedId] = useState(null);
  // Test-invite diagnostic (send a sample approval email through the real
  // Resend path to confirm the from-domain is verified end-to-end).
  const [testEmail, setTestEmail] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState(null); // {ok, text}

  const load = async () => {
    setSpin(true);
    setError(null);
    const r = await waitlistAdminList();
    if (r && r.ok) {
      setData(r);
      if (r.suggestedBatch) setTopN(r.suggestedBatch);
    } else {
      setData({ rows: [], counts: {}, flags: [], suggestedBatch: 25 });
      setError((r && r.error) || 'Could not load the waitlist');
    }
    setSpin(false);
  };
  useEffect(() => { load(); }, []);

  const rows = (data && data.rows) || [];
  const counts = (data && data.counts) || {};
  const flags = (data && data.flags) || [];

  // Flags grouped per referral code for inline row badges.
  const flagsByCode = useMemo(() => {
    const m = new Map();
    for (const f of flags) {
      const list = m.get(f.code) || [];
      list.push(f);
      m.set(f.code, list);
    }
    return m;
  }, [flags]);

  const visible = useMemo(() => {
    let list = rows.filter(r => tabMatches(tab, r));
    if (stateFilter === 'ne') {
      const ne = new Set(INDIAN_STATES.filter(s => s.ne).map(s => s.id));
      list = list.filter(r => ne.has(r.state));
    } else if (stateFilter !== 'all') {
      list = list.filter(r => r.state === stateFilter);
    }
    if (tab === 'waiting') {
      list = list.slice().sort((a, b) =>
        ((b.score && b.score.total) || 0) - ((a.score && a.score.total) || 0)
        || Date.parse(a.created_at) - Date.parse(b.created_at));
    } else {
      list = list.slice().sort((a, b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at));
    }
    return list;
  }, [rows, tab, stateFilter]);

  const statesPresent = useMemo(() => {
    const ids = [...new Set(rows.map(r => r.state))];
    return ids.map(id => ({ id, label: stateLabel(id) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const toggleSel = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectTopN = () => {
    setSelected(new Set(visible.slice(0, Math.max(1, topN)).map(r => r.id)));
  };
  const clearSel = () => setSelected(new Set());

  const runApprove = () => {
    const ids = [...selected];
    if (!ids.length || busy) return;
    requestConfirm({
      title: `Approve ${ids.length} student${ids.length === 1 ? '' : 's'}?`,
      body: 'Each gets a one-time claim link that expires in 48 hours. Nudge them on WhatsApp right after so no seat goes to waste.',
      confirmLabel: 'Approve batch',
      onConfirm: async () => {
        setBusy(true);
        const r = await waitlistAdminApprove(ids);
        setBusy(false);
        if (r && r.ok) {
          setMsg({ ok: true, text: `Approved ${r.approved.length} — open the Approved tab and send each WhatsApp nudge.` });
          clearSel();
          setTab('approved');
          load();
        } else {
          setMsg({ ok: false, text: (r && r.error) || 'Approve failed' });
        }
      },
    });
  };
  const runReject = () => {
    const ids = [...selected];
    if (!ids.length || busy) return;
    requestConfirm({
      title: `Reject ${ids.length} signup${ids.length === 1 ? '' : 's'}?`,
      body: 'Rejected rows stop counting as referrals (use this for fake clusters). This does not notify anyone.',
      confirmLabel: 'Reject',
      tone: 'danger',
      onConfirm: async () => {
        setBusy(true);
        const r = await waitlistAdminReject(ids);
        setBusy(false);
        setMsg(r && r.ok ? { ok: true, text: `Rejected ${r.rejected}.` } : { ok: false, text: (r && r.error) || 'Reject failed' });
        clearSel();
        load();
      },
    });
  };
  const runSweep = async () => {
    if (busy) return;
    setBusy(true);
    const r = await waitlistAdminExpireSweep();
    setBusy(false);
    setMsg(r && r.ok ? { ok: true, text: `Expired ${r.expired} unclaimed seat${r.expired === 1 ? '' : 's'}.` } : { ok: false, text: (r && r.error) || 'Sweep failed' });
    load();
  };

  const copyClaim = async (row) => {
    try {
      await navigator.clipboard.writeText(buildClaimUrl(WAITLIST_APP_ORIGIN, row.claim_token));
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (e) {}
  };

  const runTestInvite = async () => {
    if (testBusy) return;
    const em = testEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setTestResult({ ok: false, text: 'Enter a valid email address.' }); return; }
    setTestBusy(true);
    setTestResult(null);
    const r = await waitlistAdminTestInvite(em);
    setTestBusy(false);
    if (r && r.ok && r.sent) {
      setTestResult({ ok: true, text: `Sent ✓ Check ${r.to} — it should arrive from ${r.from}.` });
    } else if (r && r.ok && !r.sent) {
      const why = r.reason === 'email-not-configured'
        ? 'RESEND_API_KEY isn’t set on the server.'
        : (r.reason && r.reason.startsWith('http-4'))
          ? `Resend rejected it (${r.reason}) — the sending domain isn’t verified yet, or EMAIL_FROM points at an unverified address.`
          : `Not sent (${r.reason || 'unknown'}).`;
      setTestResult({ ok: false, text: why });
    } else {
      setTestResult({ ok: false, text: (r && (r.error || r.reason)) || 'Test failed.' });
    }
  };

  const kpis = [
    { label: 'Waiting', value: counts.waiting || 0, tone: T.primary },
    { label: 'Review', value: counts.pending_verification || 0, tone: T.accent },
    { label: 'Approved', value: counts.approved || 0, tone: T.success },
    { label: 'Joined', value: counts.onboarded || 0, tone: T.ink },
  ];

  const selectable = tab === 'waiting' || tab === 'pending_verification' || tab === 'past';

  return (
    <div className="anim-fadeup">
      <TopBar title="Waitlist" onBack={onBack}
              right={
                <button onClick={load} disabled={spin} aria-label="Refresh"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
                  <RefreshCw size={18} style={{ color: T.muted }} className={spin ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2 space-y-3">
        {!data ? (
          <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : (
          <>
            {error && (
              <Card className="p-3" style={{ background: T.error + '12', border: `1px solid ${T.error}40` }}>
                <div className="text-[13px]" style={{ color: T.ink }}>{error}</div>
              </Card>
            )}

            {/* KPI band */}
            <div className="grid grid-cols-4 gap-2">
              {kpis.map(k => (
                <Card key={k.label} className="p-2.5 text-center">
                  <div className="font-display text-lg font-bold tabular-nums leading-none" style={{ color: k.tone }}>{k.value}</div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold mt-1" style={{ color: T.muted }}>{k.label}</div>
                </Card>
              ))}
            </div>

            {/* Abuse clusters — review before approving (spec §7.2). */}
            {flags.length > 0 && (
              <Card className="p-3.5" style={{ background: T.accent + '10', border: `1px solid ${T.accent}40` }}>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={15} style={{ color: T.accent }} />
                  <span className="text-[13px] font-bold" style={{ color: T.ink }}>Referral clusters worth a look</span>
                </div>
                <div className="space-y-1">
                  {flags.slice(0, 8).map((f, i) => (
                    <div key={`${f.kind}:${f.code}:${i}`} className="text-[12px] flex items-center justify-between" style={{ color: T.inkSoft }}>
                      <span className="font-mono">{f.code}</span>
                      <span>{f.kind === 'same-ip' ? 'same network' : f.kind === 'same-device' ? 'same device' : 'burst joins'} × {f.count}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] mt-2 leading-relaxed" style={{ color: T.muted }}>
                  Same device/network inside a referral group usually means self-invites. Reject the fakes — rejected rows stop counting as referrals.
                </div>
              </Card>
            )}

            {/* Tabs + state filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
              {TABS.map(t => {
                const active = tab === t.id;
                const count = t.id === 'past'
                  ? (counts.expired || 0) + (counts.rejected || 0)
                  : counts[t.id] || 0;
                return (
                  <button key={t.id} onClick={() => { setTab(t.id); clearSel(); }}
                          className="no-tap-highlight px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors"
                          style={active
                            ? { background: T.primary, color: '#FFF' }
                            : { background: T.surfaceWarm, color: T.inkSoft, border: `1px solid ${T.border}` }}>
                    {t.label}{count ? ` · ${count}` : ''}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); clearSel(); }}
                      className="w-full rounded-xl px-3 py-2.5 text-[13px] appearance-none"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }}>
                <option value="all">All states</option>
                <option value="ne">Northeast (launch region)</option>
                {statesPresent.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
            </div>

            {/* Batch controls */}
            {selectable && visible.length > 0 && (
              <Card className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={selectTopN}
                          className="no-tap-highlight px-3 py-2 rounded-lg text-[12px] font-semibold"
                          style={{ background: T.primary + '14', color: T.primary }}>
                    Select top
                  </button>
                  <input type="number" min={1} max={200} value={topN}
                         onChange={e => setTopN(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 1)))}
                         className="w-16 rounded-lg px-2 py-2 text-[13px] text-center tabular-nums"
                         style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
                  <span className="text-[11px]" style={{ color: T.muted }}>by priority score</span>
                  {selected.size > 0 && (
                    <button onClick={clearSel} className="no-tap-highlight ml-auto text-[12px] font-medium" style={{ color: T.muted }}>
                      Clear ({selected.size})
                    </button>
                  )}
                </div>
                {selected.size > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    <Button size="sm" onClick={runApprove} disabled={busy} icon={<Check size={14} />}>
                      Approve {selected.size}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={runReject} disabled={busy} icon={<X size={14} />}>
                      Reject {selected.size}
                    </Button>
                  </div>
                )}
                <div className="text-[11px] mt-2 leading-relaxed" style={{ color: T.muted }}>
                  Owner playbook: ~{(data && data.suggestedBatch) || 25} seats per drop, Tue 10 AM &amp; Fri 3 PM IST. Skim Review-tab clusters first.
                </div>
              </Card>
            )}

            {msg && (
              <Card className="p-3" style={{ background: (msg.ok ? T.success : T.error) + '12', border: `1px solid ${(msg.ok ? T.success : T.error)}40` }}>
                <div className="text-[13px]" role="status" aria-live="polite" style={{ color: T.ink }}>{msg.text}</div>
              </Card>
            )}

            {/* Rows */}
            {visible.length === 0 ? (
              <Card className="p-6 text-center">
                <div className="text-sm" style={{ color: T.muted }}>Nothing here.</div>
              </Card>
            ) : visible.map(row => {
              const rowFlags = flagsByCode.get(row.referred_by_code) || flagsByCode.get(row.own_referral_code) || [];
              const nudgeMsg = row.claim_token
                ? buildApprovalNudgeMessage({
                    claimUrl: buildClaimUrl(WAITLIST_APP_ORIGIN, row.claim_token),
                    expiresAt: row.approval_expires_at,
                  })
                : null;
              return (
                <Card key={row.id} className="p-3">
                  <div className="flex items-start gap-2.5">
                    {selectable && (
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSel(row.id)}
                             className="mt-1 w-4 h-4 rounded" style={{ accentColor: T.primary }}
                             aria-label={`Select ${row.email}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[13px] font-semibold truncate" style={{ color: T.ink }}>{row.email}</span>
                        {row.intent_score >= 5 && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                                style={{ background: T.success + '1A', color: T.success }}>High intent</span>
                        )}
                      </div>
                      <div className="text-[11.5px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: T.muted }}>
                        <span>{stateLabel(row.state)}</span>
                        {row.college && <span className="truncate max-w-[140px]">· {row.college}</span>}
                        <span>· {agoLabel(Date.parse(row.created_at), Date.now())}</span>
                      </div>
                      <div className="text-[11.5px] mt-1 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1" style={{ color: T.inkSoft }}>
                          <Trophy size={11} style={{ color: T.primary }} />
                          <b className="tabular-nums">{(row.score && row.score.total) || 0}</b> pts
                        </span>
                        <span className="inline-flex items-center gap-1" style={{ color: T.inkSoft }}>
                          <Users size={11} style={{ color: T.accent }} />
                          {row.referrals || 0} referral{(row.referrals || 0) === 1 ? '' : 's'}
                        </span>
                        {typeof row.position === 'number' && (
                          <span style={{ color: T.muted }}>#{row.position}</span>
                        )}
                        <span className="font-mono" style={{ color: T.muted }}>{row.own_referral_code}</span>
                      </div>
                      {row.intent_answer && (
                        <div className="text-[11.5px] mt-1 leading-snug line-clamp-2" style={{ color: T.inkSoft }}>
                          “{row.intent_answer}”
                        </div>
                      )}
                      {rowFlags.length > 0 && (
                        <div className="inline-flex items-center gap-1 mt-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                             style={{ background: T.accent + '1A', color: T.accent }}>
                          <AlertTriangle size={10} /> cluster: {rowFlags.map(f => f.kind).join(', ')}
                        </div>
                      )}
                      {row.effectiveStatus === 'approved' && row.claim_token && (
                        <>
                          <div className="text-[11px] mt-1.5 inline-flex items-center gap-1" style={{ color: T.inkSoft }}>
                            <Clock size={11} style={{ color: T.accent }} />
                            Seat held until {formatIstTime(row.approval_expires_at)}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <a href={buildWaUrl(row.whatsapp_num, nudgeMsg)} target="_blank" rel="noopener noreferrer"
                               className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold"
                               style={{ background: '#25D366', color: '#FFF' }}>
                              <MessageCircle size={13} /> WhatsApp nudge
                            </a>
                            <button onClick={() => copyClaim(row)}
                                    className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold"
                                    style={{ background: T.primary + '14', color: copiedId === row.id ? T.success : T.primary }}>
                              {copiedId === row.id ? <Check size={13} /> : <Copy size={13} />}
                              {copiedId === row.id ? 'Copied' : 'Copy claim link'}
                            </button>
                          </div>
                        </>
                      )}
                      {(row.effectiveStatus === 'expired' || row.effectiveStatus === 'rejected' || row.effectiveStatus === 'onboarded') && (
                        <div className="text-[10.5px] mt-1 font-semibold uppercase tracking-wider" style={{ color: T.muted }}>
                          {STATUS_LABELS[row.effectiveStatus] || row.effectiveStatus}
                          {row.effectiveStatus === 'onboarded' && row.claimed_profile_id ? ` · ${row.claimed_profile_id}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Diagnostic: send a sample invite through the REAL Resend path
                to confirm the from-domain is verified end-to-end. Writes
                nothing to the table. */}
            <Card className="p-4 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Mail size={15} style={{ color: T.primary }} />
                <div className="font-medium text-sm" style={{ color: T.ink }}>Test invite email</div>
              </div>
              <div className="text-[11px] mb-2.5" style={{ color: T.muted }}>
                Sends a sample approval email (nothing is saved). Use it to confirm invites deliver from your verified domain.
              </div>
              <div className="flex gap-2">
                <input
                  type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email" inputMode="email"
                  onKeyDown={e => { if (e.key === 'Enter') runTestInvite(); }}
                  className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: T.surfaceWarm, color: T.ink, border: `1.5px solid ${T.border}` }} />
                <button onClick={runTestInvite} disabled={testBusy}
                        className="no-tap-highlight px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition inline-flex items-center gap-1.5 flex-shrink-0"
                        style={{ background: T.primary, color: '#FFF', opacity: testBusy ? 0.7 : 1 }}>
                  <Send size={14} /> {testBusy ? 'Sending…' : 'Send'}
                </button>
              </div>
              {testResult && (
                <div className="rounded-xl px-3 py-2.5 mt-2 flex items-start gap-2"
                     style={testResult.ok
                       ? { background: T.successSoft, border: `1px solid ${T.success}40` }
                       : { background: T.errorSoft, border: `1px solid ${T.error}40` }}>
                  {testResult.ok
                    ? <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
                    : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />}
                  <div className="text-[12px] leading-relaxed font-medium" style={{ color: testResult.ok ? T.success : T.error }}>{testResult.text}</div>
                </div>
              )}
            </Card>

            {/* Hygiene: free unclaimed seats (also happens lazily on access). */}
            {(counts.approved || 0) > 0 && (
              <button onClick={runSweep} disabled={busy}
                      className="no-tap-highlight w-full py-2.5 rounded-xl text-[12.5px] font-medium"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.muted }}>
                <Ticket size={13} className="inline mr-1.5 -mt-0.5" />
                Sweep expired claims (48h window passed)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
