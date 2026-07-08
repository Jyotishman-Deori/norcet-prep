// =====================================================================
// src/ui/admin-2fa.jsx — TOTP (Google Authenticator) gate for the ADMIN app.
// Rendered by AdminApp between the role check and the panel:
//   • mode="enroll" — first login (or owner reset): mints a secret via
//     admin-manage `totp-enroll`, shows the QR + manual key, and the first
//     valid 6-digit code confirms the enrolment.
//   • mode="verify" — every new browser session: one 6-digit code unlocks.
// The secret lives ONLY in profile_secrets (server-side); this screen only
// ever sees the otpauth URI once, at enrolment. Admin bundle only.
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, KeyRound, Copy, Check } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { encodeQR } from '../lib/qr.js';
import { totpEnroll, totpVerify } from '../lib/admin.js';

// Tiny inline QR (same approach as share-app-card / support-modal).
function QrSvg({ value, px = 168, quiet = 3, fg = '#0B1220' }) {
  let qr = null;
  try { qr = encodeQR(value); } catch (e) { qr = null; }
  if (!qr) {
    // Never a silent blank box: same footprint, tells the user to use the
    // manual key right below (which always works).
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-center px-4"
           style={{ width: px, height: px, color: '#6B7280' }}>
        <AlertTriangle size={22} />
        <div className="text-[11.5px] leading-snug">QR unavailable, enter the manual key below in your authenticator app.</div>
      </div>
    );
  }
  const dim = qr.size + quiet * 2;
  const rects = [];
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.dark[r * qr.size + c]) {
        rects.push(<rect key={r + '_' + c} x={c + quiet} y={r + quiet} width={1.02} height={1.02} fill={fg} />);
      }
    }
  }
  return (
    <svg width={px} height={px} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" role="img" aria-label="Authenticator QR code"
         style={{ maxWidth: '100%', height: 'auto', display: 'block' }}>
      <rect x={0} y={0} width={dim} height={dim} fill="#FFFFFF" />
      {rects}
    </svg>
  );
}

export default function Admin2FA({ mode = 'verify', profileName, onDone, onSignOut }) {
  const { theme: T } = useTheme();
  const [enroll, setEnroll] = useState(null);  // { secret, otpauth } | null
  const [enrollErr, setEnrollErr] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  // Enrolment: mint the secret on mount.
  useEffect(() => {
    if (mode !== 'enroll') return;
    let on = true;
    (async () => {
      try {
        const r = await totpEnroll();
        if (on && r && r.ok) setEnroll({ secret: r.secret, otpauth: r.otpauth });
        else if (on) setEnrollErr((r && r.error) || 'Could not start 2FA setup.');
      } catch (e) {
        if (on) setEnrollErr(e.message || 'Could not start 2FA setup.');
      }
    })();
    return () => { on = false; };
  }, [mode]);

  const submit = async () => {
    if (busy || code.replace(/\D/g, '').length !== 6) return;
    setBusy(true); setErr(null);
    try {
      const r = await totpVerify(code.replace(/\D/g, ''));
      if (r && r.ok) { onDone(); return; }
      setErr(r && r.reason === 'rate-limited'
        ? (r.message || 'Too many attempts, please wait a bit and try again.')
        : r && r.reason === 'not-enrolled'
          ? '2FA isn’t set up yet, reload and scan the QR first.'
          : 'That code didn’t match, check the app and try again.');
      setCode('');
      try { inputRef.current && inputRef.current.focus(); } catch (e) {}
    } catch (e) {
      setErr(e.message || 'Could not verify the code.');
    } finally { setBusy(false); }
  };

  const copySecret = async () => {
    if (!enroll) return;
    try {
      await navigator.clipboard.writeText(enroll.secret);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  };

  const inputStyle = { background: T.surface, border: `1.5px solid ${T.border}`, color: T.ink };

  return (
    <div className="font-body min-h-screen flex items-center justify-center px-4" style={{ background: T.bg }}>
      <div className="w-full max-w-sm text-center anim-fadeup pb-10">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: T.primary }}>
          <ShieldCheck size={26} color="#FFF" />
        </div>
        <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>
          {mode === 'enroll' ? 'Set up two-factor' : 'Two-factor check'}
        </div>
        <div className="text-[13px] leading-relaxed mb-5" style={{ color: T.inkSoft }}>
          {mode === 'enroll'
            ? <>Scan this with <b>Google Authenticator</b> (or any authenticator app), then type the 6-digit code it shows. From then on, opening the admin panel asks for a fresh code.</>
            : <>Enter the 6-digit code from your authenticator app{profileName ? <> for <b>{profileName}</b></> : null}.</>}
        </div>

        {mode === 'enroll' && (
          enrollErr ? (
            <div className="rounded-xl px-3 py-3 mb-4 flex items-start gap-2 text-left"
                 style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
              <div className="text-[12.5px]" style={{ color: T.error }}>{enrollErr}</div>
            </div>
          ) : !enroll ? (
            <div className="flex items-center justify-center gap-2 py-10" style={{ color: T.muted }}>
              <RefreshCw size={16} className="animate-spin" /> Preparing your secret…
            </div>
          ) : (
            <>
              <div className="mx-auto mb-3 rounded-2xl p-3 inline-block" style={{ background: '#FFFFFF', boxShadow: `0 8px 24px ${T.primary}22` }}>
                <QrSvg value={enroll.otpauth} px={176} />
              </div>
              <button onClick={copySecret}
                      className="no-tap-highlight mx-auto mb-4 flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                {copied ? <Check size={12} style={{ color: T.success }} /> : <Copy size={12} />}
                {copied ? 'Copied' : `Can’t scan? ${enroll.secret.slice(0, 8)}… (tap to copy)`}
              </button>
            </>
          )
        )}

        <div className="relative mb-2">
          <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
          <input
            ref={inputRef} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code"
            className="w-full rounded-xl pl-10 pr-3 py-3.5 text-center text-lg font-semibold tracking-[0.4em]"
            style={inputStyle} autoFocus={mode === 'verify'} />
        </div>
        {err && (
          <div className="flex items-start justify-center gap-1.5 text-xs mb-2 anim-fadeup" style={{ color: T.error }}>
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {err}
          </div>
        )}
        <button onClick={submit} disabled={busy || code.length !== 6}
                className="no-tap-highlight w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition inline-flex items-center justify-center gap-2"
                style={{ background: T.primary, color: '#FFF', opacity: (busy || code.length !== 6) ? 0.6 : 1 }}>
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {mode === 'enroll' ? 'Confirm & finish setup' : 'Unlock admin'}
        </button>
        {onSignOut && (
          <button onClick={onSignOut} className="no-tap-highlight mt-4 text-xs underline" style={{ color: T.muted }}>
            Sign out instead
          </button>
        )}
        {mode === 'verify' && (
          <div className="text-[10.5px] mt-4 leading-relaxed" style={{ color: T.muted }}>
            Lost your authenticator? The owner can reset your 2FA from Manage staff.
          </div>
        )}
      </div>
    </div>
  );
}
