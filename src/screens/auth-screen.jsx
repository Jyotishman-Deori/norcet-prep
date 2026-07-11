// [A1 slice 42] AuthScreen — first-open profile create / log in / password
// recovery.
//
// issues_new #3: DOB-based recovery is REPLACED by a personal security
// question for new accounts (curated list in lib/security-questions.js).
// Sign-up collects a question + answer; recovery is a two-step flow that
// shows the chosen question back and verifies the answer server-side.
// Legacy accounts (the existing 12, DOB-only) still recover via DOB — the
// recovery flow auto-detects which factor an account uses.
// issues_new #2: Privacy Policy + Terms acceptance is surfaced HERE at the
// sign-up step (a calm inline notice with tappable links), not in the tour.
//
// A7: theme via useTheme(); no IS_DARK/fgOnDark.
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, AlertCircle, AlertTriangle, ArrowLeft,
  GraduationCap, User, UserPlus, LogIn, Lock, Eye, EyeOff, RefreshCw,
  CalendarDays, Mail, ShieldQuestion, ChevronDown, X, Link2
} from 'lucide-react';
import { useTheme, useI18n } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import TurnstileWidget, { isTurnstileEnabled } from '../ui/turnstile.jsx';
import GoogleSignInButton, { isGoogleSignInEnabled } from '../ui/google-signin.jsx';
import { fontStyles } from '../lib/font-styles.js';
import { KEYS } from '../lib/keys.js';
import * as kvStorage from '../storage';
import { raceStorage, safeStorage } from '../lib/safe-storage.js';
import { normalizeProfileId } from '../lib/profile-crypto.js';
import {
  createProfile, authenticateProfile, recoverPasswordWithDob,
  getRecoveryQuestion, recoverPasswordWithAnswer, saveSession, googleAuth, googleLink
} from '../lib/profiles.js';
import { SECURITY_QUESTIONS } from '../lib/security-questions.js';
import { USERNAME_MAX, PASSWORD_MAX } from '../lib/auth-limits.js';
import { containsProfanity } from '../lib/content-filter.js';
import { LegalContent } from './legal.jsx';
import { legalDoc } from '../lib/legal.js';

// Single-consumer helper — its only call site is AuthScreen's create flow
// (post-create one-time legacy wipe). Moved here VERBATIM alongside the screen.
async function clearLegacyData() {
  try { await safeStorage.delete(KEYS.USERDATA); } catch (e) {}
}

// `claimToken` (optional) — a one-time waitlist invite token captured from a
// ?claim= link. Threaded into createProfile; REQUIRED by the server while the
// invite-only launch wall (game_config waitlist.gate) is ON, ignored otherwise.
// loginOnly — the ADMIN app passes this: staff are EXISTING accounts added to
// the allow-list, so "Create profile" here is meaningless (a fresh account
// just gets bounced by the Not-Authorized screen). It hides the Create tab,
// locks the screen to Log in, and turns a brand-new Google sign-in into a
// clear "not a staff account" message instead of a sign-up.
function AuthScreen({ legacyData, initialMode = 'create', onAuthed, onBack, claimToken, loginOnly = false }) {
  const { theme: T } = useTheme();
  const { t } = useI18n();
  const [mode, setMode] = useState(loginOnly ? 'login' : initialMode);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  // issues_new #3: security question + answer replace DOB at sign-up.
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState(''); // also reused for recovery (question path)
  const [dob, setDob] = useState('');          // legacy recovery only (YYYY-MM-DD)
  const [email, setEmail] = useState('');      // OPTIONAL, unverified; stored only in profile_secrets
  const [showPassword, setShowPassword] = useState(false);
  const [importExisting, setImportExisting] = useState(!!legacyData);
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);
  // Cloudflare Turnstile (CAPTCHA) — guards register/verify/reset. The token is
  // single-use; we reset the widget whenever we move between auth flows or after
  // a failed attempt. When no site key is configured the widget renders nothing
  // and isTurnstileEnabled() is false, so submit is never gated on it.
  const [captchaToken, setCaptchaToken] = useState(null);
  const turnstileRef = useRef(null);
  // Google Sign-In: a first-time Google user has no linked profile yet, so
  // the server hands back a suggested display name + verified email instead
  // of creating an account; this state drives the "pick a name to finish"
  // sub-step (mode stays 'create', password/security-question fields hide).
  const [googleNewUser, setGoogleNewUser] = useState(null); // { suggestedName, email } | null
  const [googleIdToken, setGoogleIdToken] = useState(null);
  // Google → EXISTING account link step: the tapped Google email is already
  // the recovery email on a password account. One password entry joins them
  // (server: google-link), then Google is one-tap forever. Rendered as a
  // centred modal (mirrors the security-question picker portal).
  const [linkGoogle, setLinkGoogle] = useState(null); // { displayName, email } | null
  const [linkPwd, setLinkPwd] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkErr, setLinkErr] = useState(null);
  // Forgot-password recovery flow lives inline (no separate screen). It is now
  // TWO steps: 'identify' (enter name → look up the recovery factor) then
  // 'verify' (answer the question, or DOB for legacy, + set a new password).
  const [recovering, setRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('identify'); // 'identify' | 'verify'
  const [recoveryMethod, setRecoveryMethod] = useState(null);   // 'question' | 'dob'
  const [recoveryQuestion, setRecoveryQuestion] = useState(''); // the question shown back
  const [newPassword, setNewPassword] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  // #2 — inline legal viewer (null | 'privacy' | 'terms' | 'disclaimer').
  const [legalView, setLegalView] = useState(null);
  // Layer 1 consent — the Create button stays disabled until this box is
  // ticked (Google sign-ups included). The accepted LEGAL_VERSION is recorded
  // into the profile's synced preferences by App.jsx after first load, so the
  // acceptance is versioned and re-promptable on future legal updates.
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentNudge, setConsentNudge] = useState(false);
  // Centred security-question picker (replaces the native <select> dropdown).
  const [securityPickerOpen, setSecurityPickerOpen] = useState(false);
  // Live name-taken check (create mode only). null = unknown; true = taken;
  // false = free. We use raceStorage directly so the check reflects the
  // canonical store; on offline/timeout we stay null and never falsely block.
  const [nameTaken, setNameTaken] = useState(null);
  const [checkingName, setCheckingName] = useState(false);
  const nameCheckTimerRef = useRef(null);
  useEffect(() => {
    if (mode !== 'create' || recovering) {
      setNameTaken(null);
      setCheckingName(false);
      return;
    }
    const name = displayName.trim();
    if (!name) {
      setNameTaken(null);
      setCheckingName(false);
      return;
    }
    if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    setCheckingName(true);
    nameCheckTimerRef.current = setTimeout(async () => {
      const id = normalizeProfileId(name);
      if (!id) { setNameTaken(null); setCheckingName(false); return; }
      try {
        const r = await raceStorage(
          () => kvStorage.get(KEYS.profile(id), true),
          4000
        );
        if (r.ok && r.value) setNameTaken(true);
        else if (r.ok) setNameTaken(false);
        else setNameTaken(null);
      } catch (e) {
        setNameTaken(null);
      } finally {
        setCheckingName(false);
      }
    }, 600);
    return () => {
      if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    };
  }, [displayName, mode, recovering]);

  const legacyStats = legacyData ? {
    attempted: legacyData.stats?.totalAttempted || 0,
    streak: legacyData.stats?.streakCurrent || 0,
    customs: legacyData.customQuestions?.length || 0,
    bookmarks: legacyData.bookmarks?.length || 0
  } : null;

  const todayISO = new Date().toISOString().slice(0, 10);

  // Single-use Turnstile token: reset the widget + clear the token. Called when
  // we move between flows or after a failed attempt so a consumed/expired token
  // is never re-submitted.
  const resetCaptcha = () => {
    try { if (turnstileRef.current) turnstileRef.current.reset(); } catch (e) {}
    setCaptchaToken(null);
  };

  // Enter / leave the recovery flow with a clean slate each time.
  const enterRecovery = () => {
    setRecovering(true);
    setRecoveryStep('identify');
    setRecoveryMethod(null);
    setRecoveryQuestion('');
    setSecurityAnswer('');
    setDob('');
    setNewPassword('');
    setPassword('');
    setError(null);
    setRecoverySuccess(false);
    resetCaptcha();
  };
  const leaveRecovery = () => {
    setRecovering(false);
    setRecoveryStep('identify');
    setRecoveryMethod(null);
    setRecoveryQuestion('');
    setSecurityAnswer('');
    setDob('');
    setNewPassword('');
    setError(null);
    resetCaptcha();
  };

  // Fired by GoogleSignInButton with the signed GIS ID token. Either logs the
  // caller straight in (an account is already linked to this Google account)
  // or drops them into the Create tab's "pick a display name" sub-step.
  const handleGoogleCredential = async (idToken) => {
    if (working) return;
    setError(null);
    setWorking(true);
    try {
      const result = await googleAuth(idToken);
      if (result.linkAvailable) {
        // This Google email already belongs to a password account — offer the
        // one-time link (password proves the profile; Google proved the email).
        setGoogleIdToken(idToken);
        setLinkGoogle({ displayName: result.displayName, email: result.email });
        setLinkPwd(''); setLinkErr(null);
      } else if (result.newGoogleUser) {
        if (loginOnly) {
          // Admin app: a Google account with no linked profile isn't staff.
          setError(t('auth.err.notStaff'));
        } else {
          setGoogleIdToken(idToken);
          setGoogleNewUser({ suggestedName: result.suggestedName, email: result.email });
          setMode('create');
          setDisplayName(result.suggestedName || '');
          setEmail(result.email || '');
        }
      } else {
        await saveSession({ profileId: result.profile.id });
        onAuthed(result.profile);
      }
    } catch (e) {
      setError(e.message || t('auth.err.googleFailed'));
    } finally {
      setWorking(false);
    }
  };

  const cancelGoogleNewUser = () => {
    setGoogleNewUser(null);
    setGoogleIdToken(null);
    setDisplayName('');
    setEmail('');
  };

  // Submit the one-time Google ↔ existing-account link (modal below).
  const handleGoogleLink = async () => {
    if (linkBusy || !linkGoogle) return;
    setLinkErr(null);
    if (!linkPwd) { setLinkErr(t('auth.err.enterLinkPwd')); return; }
    setLinkBusy(true);
    try {
      const profile = await googleLink(googleIdToken, linkPwd);
      await saveSession({ profileId: profile.id });
      setLinkGoogle(null); setLinkPwd(''); setGoogleIdToken(null);
      onAuthed(profile);
    } catch (e) {
      setLinkErr(e.message || t('auth.err.linkFailed'));
    } finally {
      setLinkBusy(false);
    }
  };
  const cancelGoogleLink = () => {
    setLinkGoogle(null);
    setLinkPwd('');
    setLinkErr(null);
    setGoogleIdToken(null);
  };

  const handleSubmit = async () => {
    if (working) return;
    setError(null);

    // ---- Recovery step 1: identify the account's recovery factor ----
    if (recovering && recoveryStep === 'identify') {
      if (!displayName.trim()) { setError(t('auth.err.enterName')); return; }
      setWorking(true);
      try {
        const info = await getRecoveryQuestion(displayName);
        if (!info) {
          setError(t('auth.err.noRecoverable'));
        } else {
          setRecoveryMethod(info.method);
          setRecoveryQuestion(info.method === 'question' ? (info.question || '') : '');
          setRecoveryStep('verify');
        }
      } catch (e) {
        setError(e.message || t('auth.err.recoveryUnreachable'));
      } finally {
        setWorking(false);
      }
      return;
    }

    // ---- Recovery step 2: verify the answer/DOB and set a new password ----
    if (recovering && recoveryStep === 'verify') {
      if (recoveryMethod === 'dob') {
        if (!dob) { setError(t('auth.err.pickDob')); return; }
      } else {
        if (!securityAnswer.trim()) { setError(t('auth.err.typeAnswer')); return; }
      }
      if (!newPassword) { setError(t('auth.err.enterNewPwd')); return; }
      setWorking(true);
      try {
        if (recoveryMethod === 'dob') {
          await recoverPasswordWithDob(displayName, dob, newPassword, captchaToken);
        } else {
          await recoverPasswordWithAnswer(displayName, securityAnswer, newPassword, captchaToken);
        }
        // Don't auto-log them in — make them log in with the new password so
        // they confirm it works and remember it.
        setRecoverySuccess(true);
        setPassword(newPassword);
        leaveRecovery();
        setMode('login');
      } catch (e) {
        setError(e.message || t('auth.err.recoveryFailed'));
        resetCaptcha();
      } finally {
        setWorking(false);
      }
      return;
    }

    // ---- Create / Login ----
    if (!displayName.trim()) { setError(t('auth.err.enterName')); return; }
    if (!googleNewUser && !password) { setError(t('auth.err.enterPwd')); return; }
    // Layer 1 — creating an account (password or Google) requires the ticked
    // consent box; login and recovery never do.
    if (mode === 'create' && !consentChecked) { setConsentNudge(true); return; }
    if (mode === 'create') {
      // Community moderation: names show on the leaderboard and FAQ threads —
      // profanity (en/hi/hinglish/assamese) is blocked at the door.
      if (containsProfanity(displayName.trim()).hit) {
        setError(t('auth.err.profanity'));
        return;
      }
      if (!googleNewUser) {
        if (!securityQuestion) { setError(t('auth.err.pickQuestion')); return; }
        if (!securityAnswer.trim()) { setError(t('auth.err.typeAnswer')); return; }
      }
    }
    setWorking(true);
    try {
      let profile;
      if (mode === 'create') {
        profile = await createProfile({
          displayName,
          password: googleNewUser ? undefined : password,
          securityQuestion: googleNewUser ? undefined : securityQuestion,
          securityAnswer: googleNewUser ? undefined : securityAnswer,
          email: googleNewUser ? googleNewUser.email : email,
          importData: (importExisting && legacyData) ? legacyData : undefined,
          captchaToken,
          claimToken,
          googleIdToken: googleNewUser ? googleIdToken : undefined
        });
        // One-time migration: after first profile creation on this device,
        // wipe legacy data so subsequent profiles on the same device don't see it.
        if (legacyData) await clearLegacyData();
      } else {
        profile = await authenticateProfile(displayName, password, captchaToken);
      }
      await saveSession({ profileId: profile.id });
      setGoogleNewUser(null);
      setGoogleIdToken(null);
      onAuthed(profile);
    } catch (e) {
      setError(e.message || t('auth.err.generic'));
      resetCaptcha();
      setWorking(false);
    }
  };

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };
  const inRecoveryVerify = recovering && recoveryStep === 'verify';
  const inRecoveryIdentify = recovering && recoveryStep === 'identify';

  // Turnstile guards the server-hitting actions (register/verify/reset), i.e.
  // create, login, and the recovery VERIFY step — but NOT the recovery IDENTIFY
  // step (that only asks which recovery factor the account uses). When a site
  // key is configured we require a token before enabling submit.
  const captchaRequired = isTurnstileEnabled() && (!recovering || recoveryStep === 'verify');

  // Submit button label/icon/disabled adapt to mode + recovery step.
  // NOTE: the Layer 1 consent box is deliberately NOT part of submitDisabled.
  // A disabled button swallows the tap silently; keeping it tappable lets
  // handleSubmit point at the unchecked box instead (consentNudge).
  const submitDisabled = working
    || !displayName.trim()
    || (captchaRequired && !captchaToken)
    || (inRecoveryIdentify ? false
        : inRecoveryVerify ? (!newPassword || (recoveryMethod === 'dob' ? !dob : !securityAnswer.trim()))
        : mode === 'create' ? (googleNewUser ? false : (!password || !securityQuestion || !securityAnswer.trim()))
        : !password);
  const submitLabel = working
    ? (inRecoveryIdentify ? t('auth.busy.checking') : inRecoveryVerify ? t('auth.busy.resetting') : mode === 'create' ? t('auth.busy.creating') : t('auth.busy.loggingIn'))
    : (inRecoveryIdentify ? t('common.continue') : inRecoveryVerify ? t('auth.resetPassword') : mode === 'create' ? t('auth.createProfile') : t('auth.logIn'));
  const submitIcon = working
    ? <RefreshCw size={18} className="animate-spin" />
    : (recovering ? <Lock size={18} /> : (mode === 'create' ? <UserPlus size={18} /> : <LogIn size={18} />));

  return (
    <div className="font-body min-h-screen" style={{ background: T.bg, color: T.ink }}>
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto px-4 pt-10 pb-12 anim-fadeup">
        {/* GUEST MODE: when reached from inside the app (not the boot wall),
            let the user back out and keep exploring without an account. */}
        {onBack && (
          <button onClick={onBack}
                  aria-label={t('auth.keepExploring')}
                  className="no-tap-highlight group mb-5 inline-flex items-center gap-2 pl-2 pr-4 py-2 rounded-full active:scale-95 transition-transform"
                  style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.ink }}>
            <span className="flex items-center justify-center w-7 h-7 rounded-full" style={{ background: T.primary + '1A' }}>
              <ArrowLeft size={15} style={{ color: T.primary }} className="transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-active:-translate-x-0.5" />
            </span>
            <span className="text-sm font-medium">{t('auth.keepExploring')}</span>
          </button>
        )}
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
               style={{ background: T.primary }}>
            <GraduationCap size={28} color="#FFF" />
          </div>
          <div className="font-display text-3xl font-semibold" style={{ color: T.ink }}>NurseHolic</div>
          <div className="text-sm mt-1" style={{ color: T.muted }}>
            {loginOnly ? t('auth.staffSignIn') : mode === 'create' ? t('auth.createSub') : t('auth.welcomeBack')}
          </div>
          {/* Waitlist invite chip — reassures the student their ?claim= link is
              attached before they fill the form (the server checks it on submit). */}
          {claimToken && mode === 'create' && !recovering && (
            <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-medium"
                 style={{ background: T.success + '1A', color: T.success, border: `1px solid ${T.success}40` }}>
              <Check size={13} /> {t('auth.inviteActive')}
            </div>
          )}
        </div>

        {/* Tabs — hidden during recovery so the user isn't tempted to swap
            mid-flow, and hidden entirely on the admin app (login-only). */}
        {!recovering && !loginOnly && (
          <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
            <button onClick={() => { setMode('create'); setError(null); setRecoverySuccess(false); }}
                    className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                    style={{ background: mode === 'create' ? T.surface : 'transparent',
                             color: mode === 'create' ? T.ink : T.muted,
                             boxShadow: mode === 'create' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              <UserPlus size={14} />
              {t('auth.createProfile')}
            </button>
            <button onClick={() => { setMode('login'); setError(null); if (googleNewUser) cancelGoogleNewUser(); }}
                    className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                    style={{ background: mode === 'login' ? T.surface : 'transparent',
                             color: mode === 'login' ? T.ink : T.muted,
                             boxShadow: mode === 'login' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              <LogIn size={14} />
              {t('auth.logIn')}
            </button>
          </div>
        )}

        {/* Google Sign-In — works for both tabs; renders nothing when
            VITE_GOOGLE_CLIENT_ID isn't configured (see google-signin.jsx). */}
        {!recovering && !googleNewUser && isGoogleSignInEnabled() && (
          <>
            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={working} />
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: T.border }} />
              <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>{t('auth.or')}</span>
              <div className="flex-1 h-px" style={{ background: T.border }} />
            </div>
          </>
        )}

        {/* Mid-flow: a first-time Google sign-in has no linked profile yet —
            confirm the verified identity and let them pick a display name
            below (password/security-question fields are hidden). */}
        {googleNewUser && (
          <Card className="p-3 mb-5" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-center gap-2.5">
              <Check size={16} className="flex-shrink-0" style={{ color: T.success }} />
              <div className="flex-1 min-w-0 text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                {t('auth.googleSignedPre')} <span className="font-medium" style={{ color: T.ink }}>{googleNewUser.email}</span>{t('auth.googleSignedPost')}
              </div>
              <button type="button" onClick={cancelGoogleNewUser}
                      className="no-tap-highlight text-xs underline flex-shrink-0" style={{ color: T.muted }}>
                {t('common.cancel')}
              </button>
            </div>
          </Card>
        )}

        {/* Recovery header */}
        {recovering && (
          <div className="mb-4 px-1">
            <div className="font-display text-base font-semibold mb-1" style={{ color: T.ink }}>{t('auth.resetPassword')}</div>
            <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
              {recoveryStep === 'identify'
                ? t('auth.recovery.identify')
                : recoveryMethod === 'dob'
                  ? t('auth.recovery.dob')
                  : t('auth.recovery.question')}
            </div>
          </div>
        )}

        {/* Post-recovery success banner */}
        {recoverySuccess && !recovering && (
          <Card className="p-3 mb-4 anim-fadeup" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-start gap-2.5">
              <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                {t('auth.recovery.success')}
              </div>
            </div>
          </Card>
        )}

        {/* Display name (login mode also accepts an email — routed through
            lookup-by-email in authenticateProfile). */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
            {mode === 'create' || recovering ? t('auth.displayName') : t('auth.usernameOrEmail')}
          </div>
          {/* Task 9 — live counter, CREATE mode only (login must not cap/clip an
              existing longer name). */}
          {mode === 'create' && !recovering && (
            <span className="text-[10px]" style={{ color: displayName.length >= USERNAME_MAX ? T.error : T.muted }}>
              {displayName.length}/{USERNAME_MAX}
            </span>
          )}
        </div>
        <div className="relative mb-4">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(mode === 'create' ? e.target.value.slice(0, USERNAME_MAX) : e.target.value)}
            placeholder={mode === 'create' ? t('auth.ph.yourName') : recovering ? t('auth.ph.enterName') : t('auth.usernameOrEmail')}
            autoCapitalize="words"
            autoComplete="off"
            maxLength={mode === 'create' ? USERNAME_MAX : undefined}
            readOnly={inRecoveryVerify}
            onKeyDown={e => { if (e.key === 'Enter' && inRecoveryIdentify) handleSubmit(); }}
            className="w-full rounded-xl pl-10 pr-4 py-3 text-sm"
            style={{ ...inputStyle, opacity: inRecoveryVerify ? 0.7 : 1 }}
          />
          {mode === 'create' && !recovering && nameTaken === true && (
            <div className="mt-2 text-xs flex items-start gap-1.5"
                 style={{ color: T.error || '#9B5050' }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                {t('auth.nameTaken')}{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setPassword(''); setNameTaken(null); if (googleNewUser) cancelGoogleNewUser(); }}
                  className="no-tap-highlight underline font-medium"
                  style={{ color: T.primary }}
                >
                  {t('auth.logInInstead')}
                </button>
              </span>
            </div>
          )}
          {mode === 'create' && !recovering && checkingName && nameTaken === null && displayName.trim() && (
            <div className="mt-2 text-xs" style={{ color: T.muted }}>
              {t('auth.checkingAvailability')}
            </div>
          )}
          {/* Caution (non-blocking): the name becomes your login id and is shown
              verbatim on the leaderboard and in backups, so flag odd characters. */}
          {mode === 'create' && !recovering && displayName.trim() && /[^\p{L}\p{N}\s\-_.'’]/u.test(displayName.trim()) && (
            <div className="mt-2 text-xs flex items-start gap-1.5" style={{ color: T.accent }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>{t('auth.emojiCaution')}</span>
            </div>
          )}
        </div>

        {/* Security question + answer — CREATE mode (replaces DOB). Skipped
            for a Google sign-up: Google itself is the recovery factor. */}
        {mode === 'create' && !recovering && !googleNewUser && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2 flex items-center justify-between" style={{ color: T.muted }}>
              <span>{t('auth.securityQuestion')}</span>
              <span className="font-normal normal-case text-[10px]" style={{ color: T.muted }}>{t('auth.forRecovery')}</span>
            </div>
            <div className="relative mb-2">
              <button type="button" onClick={() => setSecurityPickerOpen(true)}
                      className="no-tap-highlight w-full rounded-xl pl-10 pr-9 py-3 text-sm text-left flex items-center" style={inputStyle}>
                <ShieldQuestion size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
                <span className="truncate" style={{ color: T.ink }}>{securityQuestion}</span>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
              </button>
            </div>
            <div className="relative mb-1">
              <input
                type="text"
                value={securityAnswer}
                onChange={e => setSecurityAnswer(e.target.value)}
                placeholder={t('auth.ph.yourAnswer')}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                className="w-full rounded-xl px-4 py-3 text-sm"
                style={inputStyle}
              />
            </div>
            <div className="text-[10px] mb-4 px-1 leading-relaxed" style={{ color: T.muted }}>
              {t('auth.answerHelp')}
            </div>
          </>
        )}

        {/* Email — OPTIONAL, create mode only. Unverified (unless it came
            from a verified Google sign-up); stored only in the protected
            profile_secrets table (never the public blob). Recommended (not
            required) because it also becomes a second way to log in —
            typing an email into the login box resolves to the right account. */}
        {mode === 'create' && !recovering && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2 flex items-center justify-between" style={{ color: T.muted }}>
              <span>{t('auth.email')}</span>
              <span className="font-normal normal-case text-[10px]" style={{ color: T.muted }}>
                {googleNewUser ? t('auth.fromGoogle') : t('auth.emailOptional')}
              </span>
            </div>
            <div className="relative mb-1">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('auth.ph.email')}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                inputMode="email"
                readOnly={!!googleNewUser}
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                style={{ ...inputStyle, opacity: googleNewUser ? 0.7 : 1 }}
              />
            </div>
            <div className="text-[10px] mb-4 px-1 leading-relaxed" style={{ color: T.muted }}>
              {googleNewUser
                ? t('auth.emailConfirmedGoogle')
                : t('auth.emailHelp')}
            </div>
          </>
        )}

        {/* Password (create + login). Skipped for a Google sign-up — Google
            itself is the credential, there's no separate password to set. */}
        {!recovering && !googleNewUser && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
                {t('auth.password')}
              </div>
              {/* Task 9 — counter on CREATE only; login must accept an existing
                  longer password unchanged. */}
              {mode === 'create' && (
                <span className="text-[10px]" style={{ color: password.length >= PASSWORD_MAX ? T.error : T.muted }}>
                  {password.length}/{PASSWORD_MAX}
                </span>
              )}
            </div>
            <div className="relative mb-2">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(mode === 'create' ? e.target.value.slice(0, PASSWORD_MAX) : e.target.value)}
                placeholder={mode === 'create' ? t('auth.ph.choosePwd') : t('auth.ph.yourPwd')}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                maxLength={mode === 'create' ? PASSWORD_MAX : undefined}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                className="w-full rounded-xl pl-10 pr-12 py-3 text-sm"
                style={inputStyle}
              />
              <button onClick={() => setShowPassword(v => !v)}
                      className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5"
                      type="button">
                {showPassword ? <EyeOff size={16} style={{ color: T.muted }} /> : <Eye size={16} style={{ color: T.muted }} />}
              </button>
            </div>
            {mode === 'login' && (
              <div className="text-right mb-4">
                <button onClick={enterRecovery}
                        className="no-tap-highlight text-xs font-medium underline"
                        style={{ color: T.primary }}
                        type="button">
                  {t('auth.forgotPassword')}
                </button>
              </div>
            )}
            {mode === 'create' && <div className="mb-3" />}
          </>
        )}

        {/* Recovery VERIFY — security question (or DOB for legacy) + new password */}
        {inRecoveryVerify && (
          <>
            {recoveryMethod === 'dob' ? (
              <>
                <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                  {t('auth.dob')}
                </div>
                <div className="relative mb-4">
                  <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
                  <input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    max={todayISO}
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                    style={inputStyle}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                  {t('auth.securityQuestion')}
                </div>
                <Card className="p-3 mb-2" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                  <div className="flex items-start gap-2.5">
                    <ShieldQuestion size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
                    <div className="text-sm" style={{ color: T.ink }}>{recoveryQuestion || t('auth.yourSecurityQuestion')}</div>
                  </div>
                </Card>
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={e => setSecurityAnswer(e.target.value)}
                    placeholder={t('auth.ph.yourAnswer')}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                    className="w-full rounded-xl px-4 py-3 text-sm"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
              {t('auth.newPassword')}
            </div>
            <div className="relative mb-4">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={t('auth.ph.chooseNewPwd')}
                autoComplete="new-password"
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                className="w-full rounded-xl pl-10 pr-12 py-3 text-sm"
                style={inputStyle}
              />
              <button onClick={() => setShowPassword(v => !v)}
                      className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5"
                      type="button">
                {showPassword ? <EyeOff size={16} style={{ color: T.muted }} /> : <Eye size={16} style={{ color: T.muted }} />}
              </button>
            </div>
          </>
        )}

        {/* Security warning — only in create/login, not in recovery */}
        {!recovering && (
          <Card className="p-3 mb-5" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                {mode === 'create'
                  ? (googleNewUser
                      ? t('auth.warn.google')
                      : t('auth.warn.create'))
                  : t('auth.warn.login')}
              </div>
            </div>
          </Card>
        )}

        {/* #2 / Layer 1 — explicit consent at the sign-up step: a required
            checkbox (recorded, versioned) instead of a passive notice. Links
            stay tappable without toggling the box. */}
        {mode === 'create' && !recovering && (
          <div className="mb-4">
            <div role="checkbox" aria-checked={consentChecked} tabIndex={0}
                 onClick={() => { setConsentChecked(v => !v); setConsentNudge(false); }}
                 onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setConsentChecked(v => !v); setConsentNudge(false); } }}
                 className="no-tap-highlight w-full flex items-start gap-3 p-3 rounded-xl cursor-pointer select-none transition-colors"
                 style={{ background: consentChecked ? T.successSoft : T.surface,
                          border: `1px solid ${consentChecked ? T.success + '66' : consentNudge ? T.accent : T.border}` }}>
              <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                    style={{ background: consentChecked ? T.success : 'transparent',
                             border: `1.5px solid ${consentChecked ? T.success : consentNudge ? T.accent : T.border}` }}>
                {consentChecked && <Check size={12} color="#FFF" className="anim-scalein" />}
              </span>
              <span className="text-[11px] leading-relaxed" style={{ color: T.inkSoft }}>
                {t('auth.consent.ack')}{' '}
                <button type="button" onClick={e => { e.stopPropagation(); setLegalView('terms'); }}
                        className="no-tap-highlight underline font-medium" style={{ color: T.primary }}>
                  {t('auth.termsOfUse')}
                </button>
                {', '}
                <button type="button" onClick={e => { e.stopPropagation(); setLegalView('privacy'); }}
                        className="no-tap-highlight underline font-medium" style={{ color: T.primary }}>
                  {t('auth.privacyPolicy')}
                </button>
                {' '}{t('auth.consent.and')}{' '}
                <button type="button" onClick={e => { e.stopPropagation(); setLegalView('disclaimer'); }}
                        className="no-tap-highlight underline font-medium" style={{ color: T.primary }}>
                  {t('auth.contentDisclaimer')}
                </button>.
              </span>
            </div>
            {consentNudge && !consentChecked && (
              <div className="mt-1.5 px-1 text-[11px] anim-fadeup" style={{ color: T.accent }}>
                {t('auth.consent.nudge')}
              </div>
            )}
          </div>
        )}

        {/* Legacy migration */}
        {mode === 'create' && legacyData && (
          <Card className="p-4 mb-5 cursor-pointer no-tap-highlight pressable"
                onClick={() => setImportExisting(v => !v)}
                style={{ background: importExisting ? T.successSoft : T.surface,
                         border: `1px solid ${importExisting ? T.success : T.border}` }}>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                   style={{ background: importExisting ? T.success : T.surface,
                            border: `1.5px solid ${importExisting ? T.success : T.border}` }}>
                {importExisting && <Check size={12} color="#FFF" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: T.ink }}>
                  {t('auth.legacy.title')}
                </div>
                <div className="text-xs mt-1 leading-relaxed" style={{ color: T.muted }}>
                  {t('auth.legacy.practiced', { n: legacyStats.attempted })}
                  {legacyStats.streak > 0 && ` · ${t('auth.legacy.streak', { n: legacyStats.streak })}`}
                  {legacyStats.bookmarks > 0 && ` · ${t('auth.legacy.bookmarks', { n: legacyStats.bookmarks })}`}
                  {legacyStats.customs > 0 && ` · ${t('auth.legacy.customs', { n: legacyStats.customs })}`}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="p-3 mb-4 anim-fadeup" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <div className="flex items-start gap-2 text-sm" style={{ color: T.error }}>
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          </Card>
        )}

        {/* Cloudflare Turnstile — shown for the server-hitting auth actions
            (create / login / recovery-verify). Renders nothing when no site key
            is configured (VITE_TURNSTILE_SITE_KEY). */}
        {captchaRequired && (
          <TurnstileWidget ref={turnstileRef} onToken={setCaptchaToken} action="auth" />
        )}

        <Button onClick={handleSubmit}
                disabled={submitDisabled}
                size="lg" className="w-full"
                icon={submitIcon}>
          {submitLabel}
        </Button>

        <div className="text-center mt-6">
          {recovering ? (
            <button onClick={leaveRecovery}
                    className="no-tap-highlight text-xs underline" style={{ color: T.muted }} type="button">
              {t('auth.backToLogin')}
            </button>
          ) : (
            <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
              {mode === 'create'
                ? (googleNewUser
                    ? t('auth.hint.google')
                    : t('auth.hint.create'))
                : t('auth.hint.login')}
            </div>
          )}
        </div>
      </div>

      {/* #2 — legal viewer (Privacy / Terms): centred, premium, portaled to
          <body>. NOTE: LegalContent takes the KEY and resolves it itself, so we
          pass `legalView` directly (passing legalDoc(legalView) double-resolved
          to undefined before, which rendered an EMPTY, collapsed sheet). */}
      {legalView && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.55)' }}
             onClick={() => setLegalView(null)}>
          <div className="w-full max-w-md rounded-3xl anim-scalein flex flex-col overflow-hidden"
               style={{ background: T.bg, boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                        maxHeight: 'min(660px, calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 32px))' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 flex-shrink-0"
                 style={{ borderBottom: `1px solid ${T.border}`, background: T.primary + '0A' }}>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: T.primary }}>NurseHolic</div>
                <div className="font-display text-lg font-semibold leading-tight" style={{ color: T.ink }}>
                  {legalDoc(legalView)?.title || t('auth.legal')}
                </div>
              </div>
              <button type="button" onClick={() => setLegalView(null)} aria-label={t('common.close')}
                      className="no-tap-highlight w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                <X size={17} style={{ color: T.muted }} />
              </button>
            </div>
            <div className="px-5 pb-6 pt-4 overflow-y-auto">
              <LegalContent doc={legalView} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Google → existing account LINK modal. Shown when the tapped Google
          email is already the recovery email on a password account: one
          password entry proves the profile is theirs, the server joins the
          two, and Google becomes one-tap from then on. */}
      {linkGoogle && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.55)' }}
             onClick={() => { if (!linkBusy) cancelGoogleLink(); }}>
          <div className="w-full max-w-sm rounded-3xl anim-scalein overflow-hidden"
               style={{ background: T.bg, boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}
               onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-6 pb-5">
              <div className="mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center"
                   style={{ background: T.primary + '15' }}>
                <Link2 size={22} style={{ color: T.primary }} />
              </div>
              <div className="font-display text-lg font-semibold text-center mb-1.5" style={{ color: T.ink }}>
                {t('auth.link.title')}
              </div>
              <div className="text-[12.5px] leading-relaxed text-center mb-4" style={{ color: T.inkSoft }}>
                <span className="font-medium" style={{ color: T.ink }}>{linkGoogle.email}</span> {t('auth.link.body1')}{' '}
                <span className="font-semibold" style={{ color: T.primary }}>{linkGoogle.displayName}</span>.
                {' '}{t('auth.link.body2')}
              </div>
              <div className="relative mb-2">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={linkPwd}
                  onChange={e => setLinkPwd(e.target.value)}
                  placeholder={t('auth.link.pwdFor', { name: linkGoogle.displayName })}
                  autoComplete="current-password"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleGoogleLink(); }}
                  className="w-full rounded-xl pl-10 pr-12 py-3 text-sm"
                  style={inputStyle}
                />
                <button onClick={() => setShowPassword(v => !v)}
                        className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5"
                        type="button">
                  {showPassword ? <EyeOff size={16} style={{ color: T.muted }} /> : <Eye size={16} style={{ color: T.muted }} />}
                </button>
              </div>
              {linkErr && (
                <div className="flex items-start gap-2 text-xs mb-2 anim-fadeup" style={{ color: T.error }}>
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>{linkErr}</div>
                </div>
              )}
              <button onClick={handleGoogleLink} disabled={linkBusy || !linkPwd}
                      className="no-tap-highlight w-full py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition inline-flex items-center justify-center gap-2"
                      style={{ background: T.primary, color: '#FFF', opacity: (linkBusy || !linkPwd) ? 0.6 : 1 }}>
                {linkBusy ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
                {linkBusy ? t('auth.link.linking') : t('auth.link.cta')}
              </button>
              <div className="flex items-center justify-between mt-3">
                <button type="button"
                        onClick={() => { const dn = linkGoogle.displayName; cancelGoogleLink(); setMode('login'); setDisplayName(dn); enterRecovery(); }}
                        className="no-tap-highlight text-xs underline" style={{ color: T.muted }}>
                  {t('auth.link.forgot')}
                </button>
                <button type="button" onClick={cancelGoogleLink}
                        className="no-tap-highlight text-xs underline" style={{ color: T.muted }}>
                  {t('common.notNow')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Item 4 — centred security-question picker */}
      {securityPickerOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.5)' }}
             onClick={() => setSecurityPickerOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl anim-scalein flex flex-col overflow-hidden"
               style={{ background: T.bg, boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
                        maxHeight: 'min(560px, calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 32px))' }}
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
                 style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="font-display text-base font-semibold" style={{ color: T.ink }}>{t('auth.securityQuestion')}</div>
              <button type="button" onClick={() => setSecurityPickerOpen(false)} aria-label={t('common.close')}
                      className="no-tap-highlight w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                <X size={16} style={{ color: T.muted }} />
              </button>
            </div>
            <div className="overflow-y-auto py-1">
              {SECURITY_QUESTIONS.map(q => {
                const active = q === securityQuestion;
                return (
                  <button key={q} type="button"
                          onClick={() => { setSecurityQuestion(q); setSecurityPickerOpen(false); }}
                          className="no-tap-highlight w-full flex items-center gap-3 px-5 py-3 text-left active:bg-black/5 transition-colors"
                          style={{ background: active ? T.primary + '0E' : 'transparent' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                         style={{ border: `1.5px solid ${active ? T.primary : T.border}`, background: active ? T.primary : 'transparent' }}>
                      {active && <Check size={12} color="#FFF" />}
                    </div>
                    <span className="text-sm" style={{ color: T.ink, fontWeight: active ? 600 : 400 }}>{q}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default AuthScreen;
