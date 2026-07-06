// =====================================================================
// src/screens/account-security-card.jsx  (Fix 6 — Account Security)
// A quiet card shown inside Settings → Profile for LOGGED-IN users only.
//  • Recovery question — set ONE TIME. The server refuses changes once set,
//    so afterwards we just show "Recovery question set ✓" (read-only).
//  • Email — optional; doubles as a LOGIN identifier (auth-screen's
//    "Username or email" box) and as the Google-link anchor.
//  • Change password.
// State is loaded once from the token-authed `security-status` action, so
// the cards show what's ACTUALLY on file (linked email, Google link, has a
// password at all) instead of guessing. Google-only accounts (no password)
// get read-only variants — every editor here is password-gated server-side.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, Lock, Mail, ChevronDown, ChevronRight, KeyRound, AlertCircle, Pencil } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from '../ui/primitives.jsx';
import { SECURITY_QUESTIONS } from '../lib/security-questions.js';
import { getRecoveryQuestion, setSecurityQuestion, updateRecoveryEmail, changePassword, getSecurityStatus } from '../lib/profiles.js';
import { PASSWORD_MAX } from '../lib/auth-limits.js';

// Success/error feedback box — one consistent, unmissable style for every
// action in this section (replaces the old tiny one-line text that was easy
// to overlook). anim-scalein gives it a soft "confirmation pop".
function Msg({ T, m }) {
  if (!m) return null;
  return (
    <div className="rounded-xl px-3 py-2.5 mt-2 flex items-start gap-2 anim-scalein"
         style={m.ok
           ? { background: T.successSoft, border: `1px solid ${T.success}40` }
           : { background: T.errorSoft, border: `1px solid ${T.error}40` }}>
      {m.ok
        ? <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
        : <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />}
      <div className="text-[12px] leading-relaxed font-medium" style={{ color: m.ok ? T.success : T.error }}>{m.text}</div>
    </div>
  );
}

// Small header status pill (right side of each collapsed card) so the state
// is visible WITHOUT expanding — "is my email linked?" answered at a glance.
function StatusPill({ T, ok, label }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1 flex-shrink-0"
          style={ok
            ? { background: T.successSoft, color: T.success }
            : { background: T.surfaceWarm, color: T.muted }}>
      {label}
    </span>
  );
}

// Read-only info row used for the Google-only variants.
function InfoBox({ T, children }) {
  return (
    <div className="rounded-xl px-3 py-3 flex items-start gap-2" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
      <ShieldCheck size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.muted }} />
      <div className="text-[12px] leading-relaxed" style={{ color: T.inkSoft }}>{children}</div>
    </div>
  );
}

// Password strength scorer for the Change Password card. Special characters
// COUNT TOWARD strength (they're encouraged, never penalised). Length is also
// rewarded so a long passphrase rates well even with a single character class.
// Returns { level: 'none'|'weak'|'medium'|'strong', label, ok } where ok=true
// means it clears the minimum (medium or better) the Save button requires.
function scorePassword(pw) {
  const len = pw ? pw.length : 0;
  if (len === 0) return { level: 'none', label: '', ok: false };
  if (len < 8) return { level: 'weak', label: 'Too short — use at least 8 characters', ok: false };
  let s = 0;
  if (/[a-z]/.test(pw)) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;   // special chars boost strength
  if (len >= 12) s++;
  if (len >= 16) s++;
  let level;
  if (s <= 2) level = 'weak';
  else if (s <= 3) level = 'medium';
  else level = 'strong';
  const label = level === 'weak' ? 'Weak' : level === 'medium' ? 'Medium' : 'Strong';
  return { level, label, ok: level !== 'weak' }; // medium or strong passes
}

// A tappable card header + grid-rows collapse body (matches the sidebar section
// folders). Defined at MODULE level (not inside the component) so its identity
// is stable across renders — otherwise its input children would remount and
// lose focus on every keystroke. The chevron rotates on open.
function CollapseCard({ T, icon: Icon, iconBg, iconColor, title, titleExtra, sub, badge, open, onToggle, children }) {
  return (
    <Card className="mb-3 p-0 overflow-hidden">
      <button onClick={onToggle} aria-expanded={open}
              className="no-tap-highlight w-full flex items-center gap-3 p-4 text-left active:bg-black/5 transition-colors">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <Icon size={17} style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm" style={{ color: T.ink }}>{title}{titleExtra}</div>
          <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{sub}</div>
        </div>
        {badge}
        <ChevronRight size={16} className="flex-shrink-0"
                      style={{ color: T.muted,
                               transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                               transform: open ? 'rotate(90deg)' : 'none' }} />
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export default function AccountSecurityCard({ profile }) {
  const { theme: T } = useTheme();
  const displayName = profile && profile.displayName;

  const [loading, setLoading] = useState(true);
  const [existingQuestion, setExistingQuestion] = useState(null); // string if set
  // What's actually on file (from the token-authed security-status read).
  // emailKnown=false means the status call failed (offline / legacy fn) —
  // the email card then falls back to the old "type it blind" editor.
  const [emailOnFile, setEmailOnFile] = useState(null);
  const [emailKnown, setEmailKnown] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);

  // Security-question form
  const [sq, setSq] = useState(SECURITY_QUESTIONS[0]);
  const [sa, setSa] = useState('');
  const [sqPwd, setSqPwd] = useState('');
  const [sqBusy, setSqBusy] = useState(false);
  const [sqMsg, setSqMsg] = useState(null);

  // Email form. `emailEditing` gates the editor: with an email on file the
  // card rests in a read-only "linked" panel and the editor only opens on
  // an explicit "Change" — so a saved email can never look like a draft.
  const [email, setEmail] = useState('');
  const [emailEditing, setEmailEditing] = useState(false);
  const [emPwd, setEmPwd] = useState('');
  const [emBusy, setEmBusy] = useState(false);
  const [emMsg, setEmMsg] = useState(null);

  // Change-password form
  const [pwCur, setPwCur] = useState('');     // current password (no length cap)
  const [pwNew, setPwNew] = useState('');     // new password (capped at PASSWORD_MAX)
  const [pwConf, setPwConf] = useState('');   // confirm new password
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  // Collapsible cards (collapsed by default — keeps the profile page tidy).
  const [qOpen, setQOpen] = useState(false);
  const [eOpen, setEOpen] = useState(false);
  const [pOpen, setPOpen] = useState(false);

  // Soft email-format check (server enforces it too; this warns earlier).
  const emailLooksOff = !!email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        // Preferred: one token-authed read of everything on file.
        const s = await getSecurityStatus(displayName);
        if (on) {
          setExistingQuestion(s.question);
          setEmailOnFile(s.email);
          setEmailKnown(true);
          setHasGoogle(s.hasGoogle);
          setHasPassword(s.hasPassword);
        }
      } catch (e) {
        // Fallback (offline / stale function): at least learn the question
        // state the old way; the email card degrades to the blind editor.
        try {
          const r = await getRecoveryQuestion(displayName);
          if (on) setExistingQuestion(r && r.method === 'question' ? r.question : null);
        } catch (e2) { /* leave forms available */ }
      }
      finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [displayName]);

  const inputStyle = {
    background: T.surfaceWarm, color: T.ink,
    border: `1.5px solid ${T.border}`,
  };

  const submitSq = async () => {
    setSqMsg(null);
    if (!sa.trim()) { setSqMsg({ ok: false, text: 'Type an answer to your question.' }); return; }
    if (!sqPwd) { setSqMsg({ ok: false, text: 'Enter your current password.' }); return; }
    setSqBusy(true);
    try {
      await setSecurityQuestion(displayName, sqPwd, sq, sa);
      setExistingQuestion(sq);
      setSa(''); setSqPwd('');
      setSqMsg({ ok: true, text: 'Recovery question set ✓' });
    } catch (e) {
      setSqMsg({ ok: false, text: (e && e.message) || 'Could not save. Try again.' });
    } finally { setSqBusy(false); }
  };

  const startEmailEdit = () => {
    setEmail(emailOnFile || '');
    setEmPwd('');
    setEmMsg(null);
    setEmailEditing(true);
  };
  const cancelEmailEdit = () => {
    setEmailEditing(false);
    setEmail('');
    setEmPwd('');
    setEmMsg(null);
  };

  const submitEmail = async () => {
    setEmMsg(null);
    if (!emPwd) { setEmMsg({ ok: false, text: 'Enter your current password.' }); return; }
    setEmBusy(true);
    try {
      const next = email.trim().toLowerCase();
      await updateRecoveryEmail(displayName, emPwd, next);
      setEmPwd('');
      setEmailOnFile(next || null);
      setEmailKnown(true);
      setEmailEditing(false);
      setEmMsg(next
        ? { ok: true, text: 'Email saved — you can now log in with it too.' }
        : { ok: true, text: 'Email removed from this profile.' });
    } catch (e) {
      setEmMsg({ ok: false, text: (e && e.message) || 'Could not save. Try again.' });
    } finally { setEmBusy(false); }
  };

  // Change-password derived state.
  const pwStrength = scorePassword(pwNew);
  const pwMatches = pwNew.length > 0 && pwNew === pwConf;
  const pwConfMismatch = pwConf.length > 0 && pwNew !== pwConf;
  const canChangePw = !!pwCur && pwStrength.ok && pwMatches && !pwBusy;

  const submitPw = async () => {
    setPwMsg(null);
    if (!pwCur) { setPwMsg({ ok: false, text: 'Enter your current password.' }); return; }
    if (!pwStrength.ok) { setPwMsg({ ok: false, text: 'Choose a stronger new password.' }); return; }
    if (!pwMatches) { setPwMsg({ ok: false, text: 'New passwords do not match.' }); return; }
    setPwBusy(true);
    try {
      await changePassword(displayName, pwCur, pwNew);
      setPwCur(''); setPwNew(''); setPwConf('');
      setPwMsg({ ok: true, text: 'Password changed ✓ Your other devices stay signed in.' });
    } catch (e) {
      setPwMsg({ ok: false, text: (e && e.message) || 'Could not change password. Try again.' });
    } finally { setPwBusy(false); }
  };

  // The email editor (shared by "no email yet" and "change email"). The
  // linked-state panel is the resting view whenever an email is on file.
  const emailEditor = (
    <>
      <input value={email} onChange={e => setEmail(e.target.value)} type="email"
             placeholder="you@example.com" autoComplete="email" inputMode="email"
             className="w-full rounded-xl px-3 py-2.5 text-sm mb-2" style={inputStyle} />
      {emailLooksOff && (
        <div className="text-[11px] mb-2" style={{ color: T.error }}>
          This doesn't look like a valid email — double-check before saving.
        </div>
      )}
      <div className="relative mb-2">
        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
        <input value={emPwd} onChange={e => setEmPwd(e.target.value)} type="password"
               placeholder="Current password" autoComplete="current-password"
               className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
      </div>
      <div className="flex gap-2">
        <button onClick={submitEmail} disabled={emBusy || emailLooksOff}
                className="no-tap-highlight flex-1 py-2.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                style={{ background: T.accent, color: '#FFF', opacity: (emBusy || emailLooksOff) ? 0.7 : 1 }}>
          {emBusy ? 'Saving…' : 'Save email'}
        </button>
        {emailOnFile && (
          <button onClick={cancelEmailEdit} disabled={emBusy}
                  className="no-tap-highlight px-4 py-2.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                  style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}>
            Cancel
          </button>
        )}
      </div>
      {emailOnFile && (
        <div className="text-[10px] mt-2" style={{ color: T.muted }}>
          Tip: clear the field and save to remove the email from this profile.
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="mt-7 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Account security</div>

      {/* Recovery question (collapsible) */}
      <CollapseCard
        T={T}
        icon={ShieldCheck} iconBg={T.primary + '15'} iconColor={T.primary}
        title="Recovery question" sub="Used to reset your password if you forget it"
        open={qOpen} onToggle={() => setQOpen(o => !o)}
        badge={!loading && (
          <StatusPill T={T} ok={!!existingQuestion}
                      label={existingQuestion ? 'Set ✓' : (!hasPassword ? 'Not needed' : 'Not set')} />
        )}>
        {loading ? (
          <div className="text-[11px]" style={{ color: T.muted }}>Checking…</div>
        ) : existingQuestion ? (
          <div className="rounded-xl px-3 py-3 flex items-start gap-2" style={{ background: T.successSoft, border: `1px solid ${T.success}33` }}>
            <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium" style={{ color: T.success }}>Recovery question set ✓</div>
              <div className="text-[11px] mt-0.5" style={{ color: T.inkSoft }}>{existingQuestion}</div>
              <div className="text-[10px] mt-1" style={{ color: T.muted }}>For your security this can't be changed once set.</div>
            </div>
          </div>
        ) : !hasPassword ? (
          <InfoBox T={T}>
            You sign in with Google, so there's no password to recover — your Google account keeps this profile safe. No question needed.
          </InfoBox>
        ) : (
          <>
            <div className="relative mb-2">
              <select value={sq} onChange={e => setSq(e.target.value)}
                      className="w-full appearance-none rounded-xl px-3 py-2.5 text-sm pr-9"
                      style={inputStyle}>
                {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
            </div>
            <input value={sa} onChange={e => setSa(e.target.value)} placeholder="Your answer"
                   autoComplete="off"
                   className="w-full rounded-xl px-3 py-2.5 text-sm mb-2" style={inputStyle} />
            <div className="relative mb-2">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
              <input value={sqPwd} onChange={e => setSqPwd(e.target.value)} type="password"
                     placeholder="Current password" autoComplete="current-password"
                     className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
            </div>
            <button onClick={submitSq} disabled={sqBusy}
                    className="no-tap-highlight w-full py-2.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                    style={{ background: T.primary, color: '#FFF', opacity: sqBusy ? 0.7 : 1 }}>
              {sqBusy ? 'Saving…' : 'Set recovery question'}
            </button>
            <div className="text-[10px] mt-2" style={{ color: T.muted }}>
              You can only set this once. The answer is checked case-insensitively and ignores extra
              spaces — avoid emojis or unusual symbols you might not retype the same way later.
            </div>
          </>
        )}
        <Msg T={T} m={sqMsg} />
      </CollapseCard>

      {/* Email (collapsible). Resting view = the LINKED panel (what's on
          file, at a glance); the editor opens only on explicit Change. */}
      <CollapseCard
        T={T}
        icon={Mail} iconBg={T.accent + '15'} iconColor={T.accent}
        title="Email" titleExtra={<span style={{ color: T.muted, fontWeight: 400 }}> · optional</span>}
        sub="Log in with it, recover your account, link Google"
        open={eOpen} onToggle={() => setEOpen(o => !o)}
        badge={!loading && emailKnown && (
          <StatusPill T={T} ok={!!emailOnFile} label={emailOnFile ? 'Linked ✓' : 'Not set'} />
        )}>
        {loading ? (
          <div className="text-[11px]" style={{ color: T.muted }}>Checking…</div>
        ) : emailOnFile && !emailEditing ? (
          <>
            <div className="rounded-xl px-3 py-3" style={{ background: T.successSoft, border: `1px solid ${T.success}33` }}>
              <div className="flex items-start gap-2">
                <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium break-all" style={{ color: T.success }}>{emailOnFile}</div>
                  <div className="text-[11px] mt-1 leading-relaxed" style={{ color: T.inkSoft }}>
                    Linked to this profile — you can use it to log in{hasPassword ? ' instead of your username' : ''}.
                  </div>
                  {hasGoogle && (
                    <div className="text-[11px] mt-1.5 inline-flex items-center gap-1 font-medium" style={{ color: T.success }}>
                      <ShieldCheck size={12} /> Google sign-in connected — one tap logs you in
                    </div>
                  )}
                </div>
              </div>
            </div>
            {hasPassword ? (
              <button onClick={startEmailEdit}
                      className="no-tap-highlight w-full mt-2 py-2.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition inline-flex items-center justify-center gap-1.5"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                <Pencil size={14} /> Change email
              </button>
            ) : (
              <div className="text-[10px] mt-2" style={{ color: T.muted }}>
                This email comes from your Google account, so it can't be edited here.
              </div>
            )}
          </>
        ) : !hasPassword ? (
          <InfoBox T={T}>
            You sign in with Google — your Google email identifies this profile automatically.
          </InfoBox>
        ) : (
          emailEditor
        )}
        <Msg T={T} m={emMsg} />
      </CollapseCard>

      {/* Change password (collapsible) */}
      <CollapseCard
        T={T}
        icon={KeyRound} iconBg={T.primary + '15'} iconColor={T.primary}
        title="Change password" sub={hasPassword ? 'Update the password you use to sign in' : 'This profile signs in with Google'}
        open={pOpen} onToggle={() => setPOpen(o => !o)}>
        {!hasPassword ? (
          <InfoBox T={T}>
            You sign in with Google — this profile has no password. Nothing to change here.
          </InfoBox>
        ) : (
        <>
        {/* Current password (no length cap — existing passwords may be longer) */}
        <div className="relative mb-2">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
          <input value={pwCur} onChange={e => setPwCur(e.target.value)} type="password"
                 placeholder="Current password" autoComplete="current-password"
                 className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
        </div>

        {/* New password (capped + counter + strength meter) */}
        <div className="relative">
          <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
          <input value={pwNew} onChange={e => setPwNew(e.target.value.slice(0, PASSWORD_MAX))}
                 type="password" maxLength={PASSWORD_MAX}
                 placeholder="New password" autoComplete="new-password"
                 className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
        </div>
        <div className="flex items-center justify-between mt-1 mb-2">
          {/* Strength meter (3 segments: weak / medium / strong) */}
          {pwNew ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => {
                  const filled =
                    (pwStrength.level === 'weak' && i === 0) ||
                    (pwStrength.level === 'medium' && i <= 1) ||
                    (pwStrength.level === 'strong');
                  const color = pwStrength.level === 'weak' ? T.error
                    : pwStrength.level === 'medium' ? T.accent : T.success;
                  return (
                    <span key={i} className="rounded-full"
                          style={{ width: 22, height: 4, background: filled ? color : T.border,
                                   transition: 'background 0.2s' }} />
                  );
                })}
              </div>
              <span className="text-[10px] font-semibold"
                    style={{ color: pwStrength.level === 'weak' ? T.error
                      : pwStrength.level === 'medium' ? T.accent : T.success }}>
                {pwStrength.label}
              </span>
            </div>
          ) : <span />}
          <span className="text-[10px]" style={{ color: pwNew.length >= PASSWORD_MAX ? T.error : T.muted }}>
            {pwNew.length}/{PASSWORD_MAX}
          </span>
        </div>

        {/* Confirm new password */}
        <div className="relative mb-1">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
          <input value={pwConf} onChange={e => setPwConf(e.target.value.slice(0, PASSWORD_MAX))}
                 type="password" maxLength={PASSWORD_MAX}
                 placeholder="Confirm new password" autoComplete="new-password"
                 className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
        </div>
        {pwConfMismatch ? (
          <div className="text-[11px] mb-2" style={{ color: T.error }}>Passwords don't match yet.</div>
        ) : pwMatches ? (
          <div className="text-[11px] mb-2 flex items-center gap-1" style={{ color: T.success }}>
            <Check size={12} /> Passwords match
          </div>
        ) : <div className="mb-2" />}

        {/* Positive hint: special characters are ENCOURAGED */}
        <div className="text-[10px] mb-2" style={{ color: T.muted }}>
          Tip: special characters like !@#$ make your password stronger.
        </div>

        <button onClick={submitPw} disabled={!canChangePw}
                className="no-tap-highlight w-full py-2.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                style={{ background: T.primary, color: '#FFF', opacity: canChangePw ? 1 : 0.5 }}>
          {pwBusy ? 'Saving…' : 'Change password'}
        </button>
        </>
        )}
        <Msg T={T} m={pwMsg} />
      </CollapseCard>
    </>
  );
}
