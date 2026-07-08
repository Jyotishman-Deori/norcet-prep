// =====================================================================
// src/screens/companion-rename-modal.jsx — rename the study companion.
//
// Hosted once at the app root (CompanionRenameHost) and opened via
// requestCompanionRename({ profile, currentName, onRenamed }) from the note
// popup's title pencil and the Settings "Your study companion" card.
//
// Gate (spec decision): signed-in ACCOUNTS must re-enter their password
// (verified server-side via authenticateProfile — no backend change); GUESTS
// have no password, so they just type the new name and save (a simple confirm).
// The name is local, per profile, capped at NAME_MAX characters.
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw, Save, X, Lock, Heart, Sparkles, Pencil } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { registerCompanionRenameOpener, requestCompanionRename } from '../ui/companion-rename-channel.js';
import { NAME_MAX, sanitizeName } from '../lib/note-companion.js';
import { saveCompanionName, loadCompanionName } from '../lib/notes-store.js';
import { isGuestProfile, authenticateProfile } from '../lib/profiles.js';
import TurnstileWidget, { isTurnstileEnabled } from '../ui/turnstile.jsx';

function CompanionRenameHost() {
  const [ctx, setCtx] = useState(null); // null = closed; else { profile, currentName, onRenamed }
  React.useEffect(() => registerCompanionRenameOpener((c) => setCtx(c || null)), []);
  if (!ctx) return null;
  return (
    <CompanionRenameModal
      profile={ctx.profile}
      currentName={ctx.currentName || ''}
      onRenamed={ctx.onRenamed}
      onClose={() => setCtx(null)} />
  );
}

function CompanionRenameModal({ profile, currentName, onRenamed, onClose }) {
  const { theme: T } = useTheme();
  const isGuest = isGuestProfile(profile);
  const profileId = (profile && (profile.uid || profile.id)) || 'guest'; // durable, rename-safe

  const [value, setValue] = useState(currentName || '');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const tsRef = useRef(null);

  // Account password verify goes through the sign-in `verify` action, which is
  // CAPTCHA-gated in production (Turnstile is ACTIVE). Require a token when the
  // widget is configured, exactly like the auth screen. Guests skip all of this.
  const needsCaptcha = !isGuest && isTurnstileEnabled();
  const cleaned = sanitizeName(value);
  const unchanged = cleaned && cleaned === sanitizeName(currentName);

  const close = () => { if (!busy) onClose(); };
  const dialogRef = useFocusTrap(close);
  // Same Android backdrop-guard as rename-profile-modal: only dismiss when the
  // gesture BOTH starts and ends on the backdrop.
  const downOnBackdrop = useRef(false);
  const onBackdropPointerDown = (e) => { downOnBackdrop.current = (e.target === e.currentTarget); };
  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget && downOnBackdrop.current) close();
    downOnBackdrop.current = false;
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!cleaned) { setError('Give your companion a name'); return; }
    if (unchanged) { onClose(); return; }
    if (!isGuest && !password) { setError('Enter your password to confirm'); return; }
    if (needsCaptcha && !captchaToken) { setError("Please complete the 'I'm human' check"); return; }
    setBusy(true);
    try {
      // Accounts: prove it's really you (server-side verify, CAPTCHA-gated when
      // Turnstile is enabled — token threaded through as the 3rd arg, exactly
      // like the auth screen). Guests skip this entirely. NOTE: verify shares the
      // sign-in rate bucket and re-issues a session token as a side effect —
      // acceptable for a rare rename; revisit only if it becomes a friction point.
      if (!isGuest) {
        await authenticateProfile(profile.displayName, password, captchaToken || undefined);
      }
      const saved = await saveCompanionName(profileId, cleaned);
      if (onRenamed) onRenamed(saved || cleaned);
      setBusy(false);
      onClose();
    } catch (e) {
      setError((e && e.message) || 'Could not rename');
      setBusy(false);
      // Turnstile tokens are single-use — re-challenge after a failed attempt.
      setCaptchaToken(null);
      if (tsRef.current) tsRef.current.reset();
    }
  };

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.52)' }}
         onPointerDown={onBackdropPointerDown}
         onClick={onBackdropClick}>
      <Card className="w-full max-w-sm anim-scalein overflow-hidden"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}>
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Rename your study companion">
          {/* header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4"
               style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: T.accent + '15', border: `1px solid ${T.accent}28` }}>
                <Heart size={15} style={{ color: T.accent }} aria-hidden="true" />
              </span>
              <div className="font-display text-[1.05rem] font-semibold" style={{ color: T.ink }}>
                Rename your companion
              </div>
            </div>
            <button onClick={close} aria-label="Close"
                    className="no-tap-highlight flex items-center justify-center rounded-xl active:bg-black/5 transition-colors"
                    style={{ width: 40, height: 40 }}
                    disabled={busy}>
              <X size={18} style={{ color: T.muted }} aria-hidden="true" />
            </button>
          </div>

          {/* body */}
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="companion-new-name"
                     className="text-xs uppercase tracking-wider font-semibold"
                     style={{ color: T.muted }}>New name</label>
              <span className="text-[10px] tabular-nums"
                    style={{ color: Array.from(value).length >= NAME_MAX ? T.accent : T.muted }}>
                {Array.from(value).length}/{NAME_MAX}
              </span>
            </div>
            <input id="companion-new-name"
                   value={value}
                   onChange={e => setValue(e.target.value)}
                   data-autofocus
                   autoCapitalize="words" autoComplete="off"
                   maxLength={NAME_MAX}
                   placeholder="e.g. Nova"
                   className="w-full rounded-xl px-3.5 py-3 mb-4 text-sm font-medium"
                   style={{
                     background: T.bg,
                     border: `1.5px solid ${T.border}`,
                     color: T.ink,
                     outline: 'none',
                   }}
                   onFocus={(e) => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primary}1A`; }}
                   onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }} />

            {!isGuest && (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <Lock size={11} style={{ color: T.muted }} aria-hidden="true" />
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
                    Confirm with your password
                  </div>
                </div>
                <input value={password}
                       onChange={e => setPassword(e.target.value)}
                       type="password" autoComplete="current-password"
                       placeholder="Your account password"
                       className="w-full rounded-xl px-3.5 py-3 mb-4 text-sm"
                       style={{
                         background: T.bg,
                         border: `1.5px solid ${T.border}`,
                         color: T.ink,
                         outline: 'none',
                       }}
                       onFocus={(e) => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primary}1A`; }}
                       onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }} />
                {/* CAPTCHA — renders nothing unless a Turnstile site key is set. */}
                <TurnstileWidget ref={tsRef} action="companion-rename" onToken={setCaptchaToken} />
              </>
            )}

            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-4"
                 style={{
                   background: T.primary + '0E',
                   border: `1px solid ${T.primary}28`,
                   borderLeft: `3px solid ${T.primary}60`,
                 }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} aria-hidden="true" />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                Just a friendly name, up to {NAME_MAX} characters. Your saved notes stay exactly as they are.
              </div>
            </div>

            {error && (
              <div className="text-xs mb-4 px-1 flex items-center gap-1.5" style={{ color: T.error }} role="alert">
                <AlertCircle size={12} aria-hidden="true" /> {error}
              </div>
            )}

            <div className="flex gap-2.5">
              <Button variant="ghost" onClick={close} disabled={busy} className="flex-1">Cancel</Button>
              <Button onClick={submit}
                      disabled={busy || !cleaned || unchanged || (!isGuest && !password) || (needsCaptcha && !captchaToken)}
                      className="flex-1"
                      icon={busy ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// =====================================================================
// CompanionRenameCard — a Settings row (Profile section) that shows the study
// companion's name and opens the rename modal. Self-contained: loads its own
// name so Settings doesn't need extra state. Visible to guests and accounts;
// the modal itself applies the password gate for accounts.
// =====================================================================
function CompanionRenameCard({ profile }) {
  const { theme: T } = useTheme();
  const profileId = (profile && (profile.uid || profile.id)) || 'guest'; // durable, rename-safe
  const [name, setNameState] = useState('');

  useEffect(() => {
    let alive = true;
    loadCompanionName(profileId).then((n) => { if (alive) setNameState(n || ''); }).catch(() => {});
    return () => { alive = false; };
  }, [profileId]);

  const open = () => requestCompanionRename({
    profile,
    currentName: name,
    onRenamed: (nn) => setNameState(sanitizeName(nn)),
  });

  return (
    <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={open}
          role="button" aria-label={`Rename your study companion. Current name: ${name || 'Not named yet'}`}>
      <div className="flex items-center gap-3">
        {/* icon with a subtle gradient */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{
               background: `linear-gradient(135deg, ${T.primary}22, ${T.primary}0C)`,
               border: `1px solid ${T.primary}28`,
             }}>
          <Sparkles size={19} style={{ color: T.primary }} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: T.muted }}>
            Your study companion
          </div>
          <div className="font-display text-base font-semibold leading-tight truncate" style={{ color: T.ink }}>
            {name || 'Not named yet'}
          </div>
          {name && (
            <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>Tap to rename</div>
          )}
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}
             aria-hidden="true">
          <Pencil size={14} style={{ color: T.muted }} />
        </div>
      </div>
    </Card>
  );
}

export { CompanionRenameHost, CompanionRenameModal, CompanionRenameCard };
export default CompanionRenameHost;
