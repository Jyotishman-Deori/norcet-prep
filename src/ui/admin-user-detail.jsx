// =====================================================================
// src/ui/admin-user-detail.jsx  (admin → Users → tap a member)
// Per-member panel: stats summary + coin grant/deduct + a guarded progress
// reset. Reads the member's profile blob through the kv-read broker (admin
// cross-read) and writes through kv-write (admin moderation on profile:).
// All read-modify-write math is lib/admin-user-ops.js (unit-tested). The
// write does a FRESH read first to keep the last-write-wins window small.
// =====================================================================
import React, { useState, useEffect } from 'react';
import {
  User, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Flame, Coins,
  Zap, Target, Heart, RotateCcw, ChevronDown, Gift, Crown,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from './primitives.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { summarizeUser, applyCoinAdjust, applyResetProgress, COIN_PRESETS } from '../lib/admin-user-ops.js';
import { logAdminAction } from '../lib/admin-audit.js';
import { agoLabel } from '../lib/engagement.js';
import { DEFAULT_DATA } from '../data/seed.js';
// Premium tier ecosystem (placeholder-payments era): the admin grant IS the
// "payment" until a gateway lands. All calls go through the subscription
// Edge Function, which re-verifies this admin's session token server-side.
import { adminGrantPremium, adminRevokePremium, adminPremiumStatus } from '../lib/subscription.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

async function readBlob(id) {
  const r = await safeStorage.get(KEYS.profile(id), true); // broker admin read
  if (!r || r.value == null) return null;
  try { return JSON.parse(r.value); } catch (e) { return null; }
}

export default function AdminUserDetail({ meta, onBack, selfId, actorName }) {
  const { theme: T } = useTheme();
  const [blob, setBlob] = useState(undefined); // undefined=loading, null=missing
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);        // {ok, text} | null
  const [amount, setAmount] = useState(null);  // pending coin adjustment (number|null)
  const [custom, setCustom] = useState('');
  const [dangerOpen, setDangerOpen] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const now = Date.now();
  const isSelf = selfId && meta.id === selfId;

  const load = async () => {
    setBlob(undefined); setMsg(null);
    try { setBlob(await readBlob(meta.id)); } catch (e) { setBlob(null); }
  };
  useEffect(() => { load(); }, [meta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = blob === undefined ? null : summarizeUser(blob || { id: meta.id, displayName: meta.displayName });

  const failText = (e) => {
    const m = String((e && e.message) || e || '');
    if (/403/.test(m)) return 'Not authorised (admin only).';
    if (/401/.test(m)) return 'Session expired, sign in again.';
    if (/429/.test(m)) return 'Too many admin writes, wait a little.';
    return 'Write failed: are you online?';
  };

  const grant = async () => {
    if (busy || !amount) return;
    setBusy(true); setMsg(null);
    try {
      // Fresh read immediately before writing (smallest possible LWW window).
      const fresh = (await readBlob(meta.id)) || { id: meta.id, displayName: meta.displayName };
      const { blob: next, before, after } = applyCoinAdjust(fresh, amount);
      await safeStorage.setSharedStrict(KEYS.profile(meta.id), JSON.stringify(next));
      logAdminAction({ action: amount > 0 ? 'coins.grant' : 'coins.deduct', target: meta.id, targetName: meta.displayName, detail: { amount, before, after }, actorName });
      setBlob(next);
      setMsg({ ok: true, text: `Coins: ${before.toLocaleString()} → ${after.toLocaleString()} 🪙. They'll see it on their next app open.` });
      setAmount(null); setCustom('');
    } catch (e) { setMsg({ ok: false, text: failText(e) }); }
    finally { setBusy(false); }
  };

  const resetProgress = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const fresh = (await readBlob(meta.id)) || { id: meta.id, displayName: meta.displayName };
      const next = applyResetProgress(fresh, clone(DEFAULT_DATA));
      await safeStorage.setSharedStrict(KEYS.profile(meta.id), JSON.stringify(next));
      logAdminAction({ action: 'user.reset', target: meta.id, targetName: meta.displayName, actorName });
      setBlob(next);
      setResetArmed(false); setDangerOpen(false);
      setMsg({ ok: true, text: 'Progress reset: account, name and sign-in kept. Their device picks it up on next open.' });
    } catch (e) { setMsg({ ok: false, text: failText(e) }); }
    finally { setBusy(false); }
  };

  const customN = Number(custom);
  const customOk = Number.isFinite(customN) && customN !== 0 && Math.abs(customN) <= 1000000;

  // ---- premium grant/revoke (subscription broker; admin-verified) ----
  const [sub, setSub] = useState(undefined);   // undefined=loading, else entitlement
  const [subBusy, setSubBusy] = useState(false);
  const [subMsg, setSubMsg] = useState(null);
  const [grantTier, setGrantTier] = useState('SUPER');
  const [grantBilling, setGrantBilling] = useState('INDIVIDUAL');
  const [grantMonths, setGrantMonths] = useState(null); // 1 | 3 | 12 | null (no expiry)
  const targetRef = () => ({ targetId: meta.id, targetUid: (blob && blob.uid) || null });

  useEffect(() => {
    let cancelled = false;
    setSub(undefined);
    adminPremiumStatus({ targetId: meta.id, targetUid: null })
      .then(r => { if (!cancelled) setSub(r.premium); })
      .catch(() => { if (!cancelled) setSub(null); });
    return () => { cancelled = true; };
  }, [meta.id]);

  const grantPremium = async () => {
    if (subBusy) return;
    setSubBusy(true); setSubMsg(null);
    try {
      const r = await adminGrantPremium({ ...targetRef(), tier: grantTier, billing: grantBilling, months: grantMonths });
      if (r.ok) {
        setSub(r.premium);
        logAdminAction({ action: 'premium.grant', target: meta.id, targetName: meta.displayName,
                         detail: { tier: grantTier, billing: grantBilling, months: grantMonths }, actorName });
        setSubMsg({ ok: true, text: `${grantTier === 'MAX' ? 'Max' : 'Super'} granted. They'll see it on their next app open.` });
      } else setSubMsg({ ok: false, text: 'Grant failed: check the subscription tables exist (subscriptions.sql).' });
    } catch (e) { setSubMsg({ ok: false, text: failText(e) }); }
    finally { setSubBusy(false); }
  };

  const revokePremium = async () => {
    if (subBusy) return;
    setSubBusy(true); setSubMsg(null);
    try {
      const r = await adminRevokePremium(targetRef());
      if (r.ok) {
        setSub(r.premium);
        logAdminAction({ action: 'premium.revoke', target: meta.id, targetName: meta.displayName, actorName });
        setSubMsg({ ok: true, text: 'Premium revoked (family members lose it too).' });
      } else setSubMsg({ ok: false, text: 'Revoke failed.' });
    } catch (e) { setSubMsg({ ok: false, text: failText(e) }); }
    finally { setSubBusy(false); }
  };

  return (
    <div className="anim-fadeup">
      <TopBar title={meta.displayName || meta.id} onBack={onBack}
              right={
                <button onClick={load} aria-label="Refresh" className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
                  <RefreshCw size={18} style={{ color: T.muted }} className={blob === undefined ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 pb-24 pt-2 space-y-3">
        {/* identity */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-display font-bold text-lg flex-shrink-0"
                 style={{ background: T.primary + '18', color: T.primary }}>
              {(meta.displayName || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-base font-bold truncate" style={{ color: T.ink }}>
                {meta.displayName}{isSelf ? ' (you)' : ''}
              </div>
              <div className="text-[11px]" style={{ color: T.muted }}>
                joined {agoLabel(meta.createdAt, now)} · active {agoLabel(meta.lastActive, now)}
                {s && s.referredBy ? <> · referred by <b>{s.referredBy}</b></> : null}
              </div>
            </div>
          </div>
        </Card>

        {blob === undefined ? (
          <Card className="p-6 text-center"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: T.muted }} /></Card>
        ) : (
          <>
            {blob === null && (
              <div className="text-xs rounded-xl px-3 py-2.5 flex items-start gap-2"
                   style={{ background: T.accent + '14', border: `1px solid ${T.accent}40`, color: T.inkSoft }}>
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
                <span>No synced data yet for this account (they may not have finished a session online). Granting coins creates it.</span>
              </div>
            )}

            {/* stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Coins', value: s.coins.toLocaleString(), Icon: Coins, tone: '#D97706' },
                { label: 'XP', value: s.xp.toLocaleString(), Icon: Zap, tone: T.primary },
                { label: 'Hearts', value: s.hearts, Icon: Heart, tone: T.error },
                { label: 'Attempted', value: s.attempted.toLocaleString(), Icon: Target, tone: T.ink },
                { label: 'Accuracy', value: s.accuracy == null ? '—' : `${s.accuracy}%`, Icon: CheckCircle2, tone: T.success },
                { label: 'Streak', value: `${s.streakCurrent} / ${s.streakBest}`, Icon: Flame, tone: T.accent },
              ].map((k, i) => (
                <Card key={k.label} className="p-2.5 text-center eng-kpi" style={{ animationDelay: `${i * 45}ms` }}>
                  <k.Icon size={14} className="mx-auto mb-1" style={{ color: k.tone }} />
                  <div className="font-display text-[15px] font-bold tabular-nums leading-none" style={{ color: T.ink }}>{k.value}</div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold mt-1" style={{ color: T.muted }}>{k.label}</div>
                </Card>
              ))}
            </div>

            {msg && (
              <div className="text-xs rounded-xl px-3 py-2.5 flex items-start gap-2 anim-fadeup"
                   style={{ background: msg.ok ? T.successSoft : T.errorSoft, border: `1px solid ${(msg.ok ? T.success : T.error)}40`, color: msg.ok ? T.inkSoft : T.error }}>
                {msg.ok ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} /> : <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />}
                <span className="flex-1">{msg.text}</span>
              </div>
            )}

            {/* coin tools */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Gift size={16} style={{ color: '#D97706' }} />
                <span className="font-display text-[15px] font-bold" style={{ color: T.ink }}>Adjust coins</span>
              </div>
              <div className="text-[11px] mb-3" style={{ color: T.muted }}>
                Grant a reward or correct a balance. Deductions can never take them below 0.
              </div>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {COIN_PRESETS.map(n => {
                  const active = amount === n;
                  return (
                    <button key={n} onClick={() => { setAmount(active ? null : n); setCustom(''); setMsg(null); }}
                            className="no-tap-highlight px-3 py-2 rounded-xl text-[13px] font-bold tabular-nums transition active:scale-95"
                            style={{ background: active ? (n < 0 ? T.error : T.primary) : T.surfaceWarm,
                                     color: active ? '#FFF' : (n < 0 ? T.error : T.ink),
                                     border: `1px solid ${active ? (n < 0 ? T.error : T.primary) : T.border}` }}>
                      {n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString()} 🪙
                    </button>
                  );
                })}
                <input value={custom} inputMode="numeric"
                       onChange={e => { setCustom(e.target.value); const n = Number(e.target.value); setAmount(Number.isFinite(n) && n !== 0 ? Math.trunc(n) : null); setMsg(null); }}
                       placeholder="Custom ±"
                       className="w-24 px-3 py-2 rounded-xl text-[13px] font-semibold outline-none tabular-nums"
                       style={{ background: T.surface, border: `1px solid ${custom && !customOk ? T.error : T.border}`, color: T.ink }} />
              </div>
              {amount != null && (
                <div className="flex items-center gap-2 anim-fadeup">
                  <div className="text-[12px] flex-1" style={{ color: T.ink }}>
                    {amount > 0 ? 'Give' : 'Take'} <b className="tabular-nums">{Math.abs(amount).toLocaleString()} 🪙</b> {amount > 0 ? 'to' : 'from'} <b>{meta.displayName}</b>?
                  </div>
                  <Button onClick={grant} disabled={busy}
                          icon={busy ? <Loader2 size={15} className="animate-spin" /> : <Coins size={15} />}>
                    Confirm
                  </Button>
                </div>
              )}
            </Card>

            {/* premium grant / revoke (the placeholder-era "payment") */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Crown size={16} style={{ color: '#D97706' }} />
                <span className="font-display text-[15px] font-bold" style={{ color: T.ink }}>Premium</span>
                {sub === undefined ? (
                  <Loader2 size={13} className="animate-spin ml-auto" style={{ color: T.muted }} />
                ) : sub && sub.active ? (
                  <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: '#D9770620', color: '#D97706' }}>
                    {sub.tier}{sub.billing === 'FAMILY' ? ' · family' : ''}
                    {sub.role === 'member' ? ' (member)' : ''}
                  </span>
                ) : (
                  <span className="ml-auto text-[11px] font-semibold" style={{ color: T.muted }}>free</span>
                )}
              </div>
              <div className="text-[11px] mb-3" style={{ color: T.muted }}>
                Manual grant: the placeholder "payment" until a gateway lands.
                {sub && sub.active && typeof sub.expiresAt === 'number'
                  ? ` Current plan runs until ${new Date(sub.expiresAt).toLocaleDateString()}.` : ''}
              </div>
              {sub && sub.active && sub.role === 'member' ? (
                <div className="text-[12px]" style={{ color: T.inkSoft }}>
                  Covered by someone else's family plan, grant/revoke on the plan owner instead.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['SUPER', 'MAX'].map(t => (
                      <button key={t} onClick={() => setGrantTier(t)}
                              className="no-tap-highlight px-3 py-1.5 rounded-xl text-[12px] font-bold transition active:scale-95"
                              style={{ background: grantTier === t ? T.primary : T.surfaceWarm,
                                       color: grantTier === t ? '#FFF' : T.ink,
                                       border: `1px solid ${grantTier === t ? T.primary : T.border}` }}>
                        {t === 'MAX' ? 'Max' : 'Super'}
                      </button>
                    ))}
                    <span className="w-px self-stretch" style={{ background: T.border }} />
                    {['INDIVIDUAL', 'FAMILY'].map(b => (
                      <button key={b} onClick={() => setGrantBilling(b)}
                              className="no-tap-highlight px-3 py-1.5 rounded-xl text-[12px] font-bold transition active:scale-95"
                              style={{ background: grantBilling === b ? T.primary : T.surfaceWarm,
                                       color: grantBilling === b ? '#FFF' : T.ink,
                                       border: `1px solid ${grantBilling === b ? T.primary : T.border}` }}>
                        {b === 'FAMILY' ? 'Family (6 seats)' : 'Individual'}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[{ v: 1, l: '1 month' }, { v: 3, l: '3 months' }, { v: 12, l: '12 months' }, { v: null, l: 'No expiry' }].map(o => (
                      <button key={String(o.v)} onClick={() => setGrantMonths(o.v)}
                              className="no-tap-highlight px-3 py-1.5 rounded-xl text-[12px] font-semibold transition active:scale-95"
                              style={{ background: grantMonths === o.v ? T.ink : T.surfaceWarm,
                                       color: grantMonths === o.v ? T.bg : T.inkSoft,
                                       border: `1px solid ${grantMonths === o.v ? T.ink : T.border}` }}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={grantPremium} disabled={subBusy}
                            icon={subBusy ? <Loader2 size={15} className="animate-spin" /> : <Crown size={15} />}>
                      {sub && sub.active ? 'Update plan' : 'Grant premium'}
                    </Button>
                    {sub && sub.active && (
                      <button onClick={revokePremium} disabled={subBusy}
                              className="no-tap-highlight px-3.5 py-2 rounded-xl text-[12px] font-bold"
                              style={{ background: T.error + '14', color: T.error, border: `1px solid ${T.error}40` }}>
                        Revoke
                      </button>
                    )}
                  </div>
                </>
              )}
              {subMsg && (
                <div className="text-[12px] mt-2.5" style={{ color: subMsg.ok ? T.success : T.error }}>{subMsg.text}</div>
              )}
            </Card>

            {/* danger zone */}
            <Card className="p-4" style={{ borderColor: dangerOpen ? T.error + '55' : undefined }}>
              <button onClick={() => { setDangerOpen(o => !o); setResetArmed(false); }}
                      className="no-tap-highlight w-full flex items-center gap-2">
                <RotateCcw size={16} style={{ color: T.error }} />
                <span className="font-display text-[15px] font-bold flex-1 text-left" style={{ color: T.error }}>Reset progress</span>
                <ChevronDown size={16} style={{ color: T.muted, transform: dangerOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {dangerOpen && (
                <div className="mt-3 anim-fadeup">
                  <div className="text-[12px] leading-relaxed mb-3" style={{ color: T.inkSoft }}>
                    Wipes <b>practice history, stats, streaks, coins, XP, bookmarks and quests</b> back to a
                    brand-new state. Keeps the account, name, and sign-in. This cannot be undone.
                  </div>
                  {resetArmed ? (
                    <div className="flex items-center gap-2">
                      <div className="text-[12px] font-semibold flex-1" style={{ color: T.error }}>Really reset {meta.displayName}?</div>
                      <button onClick={resetProgress} disabled={busy}
                              className="no-tap-highlight px-3.5 py-2 rounded-xl text-[12px] font-bold inline-flex items-center gap-1.5"
                              style={{ background: T.error, color: '#FFF' }}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Reset now
                      </button>
                      <button onClick={() => setResetArmed(false)} className="no-tap-highlight px-3 py-2 rounded-xl text-[12px] font-semibold"
                              style={{ background: T.surfaceWarm, color: T.muted }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setResetArmed(true)}
                            className="no-tap-highlight px-3.5 py-2 rounded-xl text-[12px] font-bold"
                            style={{ background: T.error + '14', color: T.error, border: `1px solid ${T.error}40` }}>
                      I understand: arm the reset
                    </button>
                  )}
                </div>
              )}
            </Card>

            <div className="text-center text-[10.5px] px-4 flex items-start gap-1.5 justify-center" style={{ color: T.muted }}>
              <User size={12} className="flex-shrink-0 mt-0.5" />
              <span>If they're using the app right now, their session may overwrite a change on their next save, refresh here to re-check. Answers and personal notes are never shown.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
