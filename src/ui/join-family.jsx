// =====================================================================
// src/ui/join-family.jsx — the ?join=TOKEN redemption sheet.
//
// App.jsx parses the invite token from the URL at boot (and strips it from
// the address bar), then mounts this sheet once a profile is resolved:
//   • guest        → explain + route to sign-in (the token is kept until
//                    they're back with a real account)
//   • logged in    → one-tap Accept → subscription broker links THIS
//                    account (by its verified session token) to the plan
// The server re-validates everything (token hash, expiry, single-use,
// seats) — this sheet only renders the outcome.
// =====================================================================
import React, { useState } from 'react';
import { Users, Loader2, CheckCircle2, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { acceptFamilyInvite } from '../lib/subscription.js';

const REASON_TEXT = {
  'invalid-invite': 'This invite link is invalid, already used, or expired. Ask for a fresh one.',
  'family-full': 'That family plan is full. All seats are taken.',
  'already-member': 'You are already on this family plan.',
  'already-in-family': 'This account is already on another family plan. Leave it first (Premium → Family plan).',
  'own-plan': 'You own this plan. Invites are for the other five seats.',
  'rate-limited': 'Too many attempts: wait a little and tap Accept again.',
};

export default function JoinFamilySheet({ token, isGuest, onSignIn, onJoined, onClose }) {
  const { theme: T } = useTheme();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const accept = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await acceptFamilyInvite(token);
      if (r.ok) { setDone(true); if (onJoined) onJoined(r.premium); }
      else setErr(REASON_TEXT[r.reason] || 'That didn’t work, check your connection and try again.');
    } catch (e) { setErr('Couldn’t reach the server, check your connection and try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center"
         style={{ background: 'rgba(15,20,17,0.55)', backdropFilter: 'blur(3px)' }}
         onClick={done ? onClose : undefined}>
      <div className="sheet-up relative w-full md:max-w-sm rounded-t-3xl md:rounded-3xl p-6 text-center"
           role="dialog" aria-modal="true" aria-label="Family plan invite"
           style={{ background: T.bg, border: `1px solid ${T.border}` }}
           onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close"
                className="no-tap-highlight absolute right-3 top-3 p-2 rounded-full"
                style={{ color: T.muted }}>
          <X size={16} />
        </button>
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center"
             style={{ background: done ? (T.success + '1A') : (T.primary + '14') }}>
          {done
            ? <CheckCircle2 size={26} style={{ color: T.success }} />
            : <Users size={26} style={{ color: T.primary }} />}
        </div>

        {done ? (
          <>
            <div className="font-display text-lg font-bold" style={{ color: T.ink }}>You're in! 🎉</div>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: T.inkSoft }}>
              Premium is now active on this account. Your progress, streaks and mistakes stay
              completely your own: only the bill is shared.
            </p>
            <button onClick={onClose}
                    className="no-tap-highlight w-full mt-5 py-3 rounded-xl text-sm font-bold"
                    style={{ background: T.primary, color: '#FFF' }}>
              Start studying
            </button>
          </>
        ) : (
          <>
            <div className="font-display text-lg font-bold" style={{ color: T.ink }}>
              You've been invited to a family plan
            </div>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: T.inkSoft }}>
              Accepting links <b>this account</b> to the inviter's premium subscription.
              Nothing else is shared, no passwords, no progress, no logs.
            </p>
            {isGuest ? (
              <>
                <p className="text-[13px] mt-3 leading-relaxed" style={{ color: T.muted }}>
                  You'll need an account first. The invite stays saved while you sign in.
                </p>
                <button onClick={onSignIn}
                        className="no-tap-highlight w-full mt-4 py-3 rounded-xl text-sm font-bold"
                        style={{ background: T.primary, color: '#FFF' }}>
                  Sign in / create account
                </button>
              </>
            ) : (
              <button onClick={accept} disabled={busy}
                      className="no-tap-highlight w-full mt-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: T.primary, color: '#FFF', opacity: busy ? 0.7 : 1 }}>
                {busy && <Loader2 size={15} className="animate-spin" />}
                {busy ? 'Joining…' : 'Accept invite'}
              </button>
            )}
            {err && <div className="text-[12px] mt-3 leading-snug" style={{ color: T.error || '#DC2626' }}>{err}</div>}
            <button onClick={onClose}
                    className="no-tap-highlight w-full mt-2 py-2.5 text-xs font-medium"
                    style={{ color: T.muted }}>
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
