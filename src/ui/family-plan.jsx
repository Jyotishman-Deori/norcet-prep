// =====================================================================
// src/ui/family-plan.jsx — the FAMILY PLAN card on the Premium screen.
//
// Three states, all driven by the server-confirmed profile.premium blob:
//   • family OWNER  → seat usage, member list (remove), invite-link minting
//   • family MEMBER → whose plan covers you + Leave
//   • everyone else → an honest pitch ("arrives with payments")
// Every mutation goes through lib/subscription.js → the subscription Edge
// Function, which re-authorizes by the caller's session token server-side.
// Members are COMPLETELY ISOLATED accounts — the card says so explicitly,
// because that's the selling point (no shared passwords, no mixed progress).
// =====================================================================
import React, { useEffect, useState } from 'react';
import { Users, Link2, Copy, Check, Loader2, X, LogOut, Share2 } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from './primitives.jsx';
import {
  listFamily, createFamilyInvite, removeFamilyMember, leaveFamily, FAMILY_SEATS,
} from '../lib/subscription.js';

const GOLD = '#D97706';

export default function FamilyPlanCard({ profile, onChanged }) {
  const { theme: T } = useTheme();
  const premium = (profile && profile.premium) || {};
  const isFamily = premium.active === true && premium.billing === 'FAMILY';
  const isOwner = isFamily && premium.role !== 'member';

  const [fam, setFam] = useState(null);        // family-list payload | null
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(null);  // { link, expiresAt } | null
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState(null);        // { ok, text } | null

  useEffect(() => {
    if (!isFamily) { setFam(null); return; }
    let cancelled = false;
    listFamily().then(j => { if (!cancelled && j && j.ok) setFam(j); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isFamily, premium.role]);

  const reasonText = (reason) => ({
    'family-full': 'All seats are taken, remove a member first.',
    'too-many-invites': 'Too many open invites, wait for one to expire.',
    'rate-limited': 'Too many invites right now, try again in a bit.',
  }[reason] || 'That didn’t work. Are you online?');

  const mintInvite = async () => {
    if (busy) return;
    setBusy(true); setMsg(null); setCopied(false);
    try {
      const r = await createFamilyInvite();
      if (r && r.link) setInvite(r);
      else setMsg({ ok: false, text: reasonText(r && r.reason) });
    } catch (e) { setMsg({ ok: false, text: 'Couldn’t create the invite. Are you online?' }); }
    finally { setBusy(false); }
  };

  const copyInvite = async () => {
    if (!invite) return;
    try {
      if (navigator.share) { await navigator.share({ title: 'Join my NurseHolic family plan', url: invite.link }); return; }
    } catch (e) { /* fall through to clipboard */ }
    try { await navigator.clipboard.writeText(invite.link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (e) { setMsg({ ok: false, text: 'Copy failed: long-press the link to copy it.' }); }
  };

  const removeMember = async (id) => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await removeFamilyMember(id);
      if (r.ok) {
        setFam(f => f ? { ...f, members: (f.members || []).filter(m => m.id !== id), seatsUsed: Math.max(1, (f.seatsUsed || 1) - 1) } : f);
        setMsg({ ok: true, text: 'Member removed: their seat is free again. Their own progress is untouched.' });
      } else setMsg({ ok: false, text: reasonText(r.reason) });
    } catch (e) { setMsg({ ok: false, text: 'Remove failed: are you online?' }); }
    finally { setBusy(false); }
  };

  const [leaveArmed, setLeaveArmed] = useState(false);
  const doLeave = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await leaveFamily();
      if (r.ok) { setLeaveArmed(false); if (onChanged) onChanged(); }
      else setMsg({ ok: false, text: reasonText(r.reason) });
    } catch (e) { setMsg({ ok: false, text: 'Leave failed: are you online?' }); }
    finally { setBusy(false); }
  };

  // ---- no family plan → the pitch (honest about the placeholder era) ----
  if (!isFamily) {
    return (
      <Card className="p-4 mb-6" style={{ border: `1px dashed ${T.border}` }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: `${GOLD}1A` }}>
            <Users size={17} style={{ color: GOLD }} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[15px] font-semibold" style={{ color: T.ink }}>Family plan</div>
            <div className="text-[13px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>
              One subscription, up to <b>{FAMILY_SEATS} separate accounts</b>, each nurse keeps their own
              progress, streaks and mistakes. No shared passwords, ever. Available when payments open.
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ---- member view ----
  if (!isOwner) {
    return (
      <Card className="p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: `${GOLD}1A` }}>
            <Users size={17} style={{ color: GOLD }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-semibold" style={{ color: T.ink }}>
              You're on a family plan
            </div>
            <div className="text-[13px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>
              {premium.tier === 'MAX' ? 'Max' : 'Super'} is covered
              {fam && fam.ownerId ? <> by <b>{fam.ownerId}</b></> : null}. Your account, progress and
              streaks stay completely your own.
            </div>
            {!leaveArmed ? (
              <button onClick={() => setLeaveArmed(true)}
                      className="no-tap-highlight mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold"
                      style={{ color: T.muted }}>
                <LogOut size={13} /> Leave this plan
              </button>
            ) : (
              <div className="mt-2.5 flex items-center gap-2">
                <button onClick={doLeave} disabled={busy}
                        className="no-tap-highlight px-3 py-1.5 rounded-lg text-[12px] font-bold"
                        style={{ background: T.error || '#DC2626', color: '#FFF', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Leaving…' : 'Yes, leave (lose premium)'}
                </button>
                <button onClick={() => setLeaveArmed(false)}
                        className="no-tap-highlight px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                        style={{ color: T.muted }}>
                  Keep it
                </button>
              </div>
            )}
            {msg && <div className="text-[12px] mt-2" style={{ color: msg.ok ? T.success : (T.error || '#DC2626') }}>{msg.text}</div>}
          </div>
        </div>
      </Card>
    );
  }

  // ---- owner view ----
  const members = (fam && fam.members) || [];
  const seats = (fam && fam.seats) || premium.seats || FAMILY_SEATS;
  const seatsUsed = (fam && fam.seatsUsed) || 1 + members.length;

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `${GOLD}1A` }}>
          <Users size={17} style={{ color: GOLD }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-semibold" style={{ color: T.ink }}>Your family plan</div>
          <div className="text-[12px]" style={{ color: T.muted }}>
            {seatsUsed} of {seats} seats used · every account stays separate
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between rounded-xl px-3 py-2"
             style={{ background: T.surfaceWarm }}>
          <span className="text-[13px] font-medium" style={{ color: T.ink }}>
            {(profile && (profile.displayName || profile.id)) || 'You'} <span style={{ color: T.muted }}>(plan owner)</span>
          </span>
        </div>
        {members.map(m => (
          <div key={m.id} className="flex items-center justify-between rounded-xl px-3 py-2"
               style={{ background: T.surfaceWarm }}>
            <span className="text-[13px] font-medium truncate" style={{ color: T.ink }}>{m.id}</span>
            <button onClick={() => removeMember(m.id)} disabled={busy} aria-label={`Remove ${m.id}`}
                    className="no-tap-highlight p-1.5 rounded-full flex-shrink-0"
                    style={{ color: T.muted, opacity: busy ? 0.5 : 1 }}>
              <X size={14} />
            </button>
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-[12px] px-1" style={{ color: T.muted }}>
            No members yet: send an invite link below.
          </div>
        )}
      </div>

      {/* Invite */}
      {seatsUsed < seats && (
        !invite ? (
          <button onClick={mintInvite} disabled={busy}
                  className="no-tap-highlight w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold active:scale-[0.98] transition-transform"
                  style={{ background: T.primary, color: '#FFF', opacity: busy ? 0.7 : 1 }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            Create invite link
          </button>
        ) : (
          <div className="rounded-xl p-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: T.muted }}>
              Invite link · single use · valid 7 days
            </div>
            <div className="text-[12px] break-all leading-snug mb-2" style={{ color: T.inkSoft }}>{invite.link}</div>
            <div className="flex gap-2">
              <button onClick={copyInvite}
                      className="no-tap-highlight flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-bold"
                      style={{ background: T.primary, color: '#FFF' }}>
                {copied ? <Check size={13} /> : (navigator.share ? <Share2 size={13} /> : <Copy size={13} />)}
                {copied ? 'Copied' : (navigator.share ? 'Share' : 'Copy')}
              </button>
              <button onClick={() => { setInvite(null); setCopied(false); }}
                      className="no-tap-highlight px-3 rounded-lg text-[12px] font-semibold"
                      style={{ color: T.muted }}>
                Done
              </button>
            </div>
          </div>
        )
      )}
      {msg && <div className="text-[12px] mt-2" style={{ color: msg.ok ? T.success : (T.error || '#DC2626') }}>{msg.text}</div>}
    </Card>
  );
}
