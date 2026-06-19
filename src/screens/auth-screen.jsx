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
import {
  Check, AlertCircle, AlertTriangle, ArrowLeft,
  GraduationCap, User, UserPlus, LogIn, Lock, Eye, EyeOff, RefreshCw,
  CalendarDays, Mail, ShieldQuestion, ChevronDown, X
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { fontStyles } from '../lib/font-styles.js';
import { KEYS } from '../lib/keys.js';
import * as kvStorage from '../storage';
import { raceStorage, safeStorage } from '../lib/safe-storage.js';
import { normalizeProfileId } from '../lib/profile-crypto.js';
import {
  createProfile, authenticateProfile, recoverPasswordWithDob,
  getRecoveryQuestion, recoverPasswordWithAnswer, saveSession
} from '../lib/profiles.js';
import { SECURITY_QUESTIONS } from '../lib/security-questions.js';
import { LegalContent } from './legal.jsx';
import { legalDoc } from '../lib/legal.js';

// Single-consumer helper — its only call site is AuthScreen's create flow
// (post-create one-time legacy wipe). Moved here VERBATIM alongside the screen.
async function clearLegacyData() {
  try { await safeStorage.delete(KEYS.USERDATA); } catch (e) {}
}

function AuthScreen({ legacyData, initialMode = 'create', onAuthed, onBack }) {
  const { theme: T } = useTheme();
  const [mode, setMode] = useState(initialMode);
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
  // Forgot-password recovery flow lives inline (no separate screen). It is now
  // TWO steps: 'identify' (enter name → look up the recovery factor) then
  // 'verify' (answer the question, or DOB for legacy, + set a new password).
  const [recovering, setRecovering] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('identify'); // 'identify' | 'verify'
  const [recoveryMethod, setRecoveryMethod] = useState(null);   // 'question' | 'dob'
  const [recoveryQuestion, setRecoveryQuestion] = useState(''); // the question shown back
  const [newPassword, setNewPassword] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  // #2 — inline legal viewer (null | 'privacy' | 'terms').
  const [legalView, setLegalView] = useState(null);
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
  };

  const handleSubmit = async () => {
    if (working) return;
    setError(null);

    // ---- Recovery step 1: identify the account's recovery factor ----
    if (recovering && recoveryStep === 'identify') {
      if (!displayName.trim()) { setError('Enter your display name'); return; }
      setWorking(true);
      try {
        const info = await getRecoveryQuestion(displayName);
        if (!info) {
          setError("We couldn't find a recoverable profile with that name. Check the spelling, or create a new profile.");
        } else {
          setRecoveryMethod(info.method);
          setRecoveryQuestion(info.method === 'question' ? (info.question || '') : '');
          setRecoveryStep('verify');
        }
      } catch (e) {
        setError(e.message || 'Could not reach the recovery service');
      } finally {
        setWorking(false);
      }
      return;
    }

    // ---- Recovery step 2: verify the answer/DOB and set a new password ----
    if (recovering && recoveryStep === 'verify') {
      if (recoveryMethod === 'dob') {
        if (!dob) { setError('Pick your date of birth'); return; }
      } else {
        if (!securityAnswer.trim()) { setError('Type the answer to your security question'); return; }
      }
      if (!newPassword) { setError('Enter a new password'); return; }
      setWorking(true);
      try {
        if (recoveryMethod === 'dob') {
          await recoverPasswordWithDob(displayName, dob, newPassword);
        } else {
          await recoverPasswordWithAnswer(displayName, securityAnswer, newPassword);
        }
        // Don't auto-log them in — make them log in with the new password so
        // they confirm it works and remember it.
        setRecoverySuccess(true);
        setPassword(newPassword);
        leaveRecovery();
        setMode('login');
      } catch (e) {
        setError(e.message || 'Recovery failed');
      } finally {
        setWorking(false);
      }
      return;
    }

    // ---- Create / Login ----
    if (!displayName.trim()) { setError('Enter a display name'); return; }
    if (!password) { setError('Enter a password'); return; }
    if (mode === 'create') {
      if (!securityQuestion) { setError('Pick a security question'); return; }
      if (!securityAnswer.trim()) { setError('Type an answer to your security question'); return; }
    }
    setWorking(true);
    try {
      let profile;
      if (mode === 'create') {
        profile = await createProfile({
          displayName,
          password,
          securityQuestion,
          securityAnswer,
          email,
          importData: (importExisting && legacyData) ? legacyData : undefined
        });
        // One-time migration: after first profile creation on this device,
        // wipe legacy data so subsequent profiles on the same device don't see it.
        if (legacyData) await clearLegacyData();
      } else {
        profile = await authenticateProfile(displayName, password);
      }
      await saveSession({ profileId: profile.id });
      onAuthed(profile);
    } catch (e) {
      setError(e.message || 'Something went wrong');
      setWorking(false);
    }
  };

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };
  const inRecoveryVerify = recovering && recoveryStep === 'verify';
  const inRecoveryIdentify = recovering && recoveryStep === 'identify';

  // Submit button label/icon/disabled adapt to mode + recovery step.
  const submitDisabled = working
    || !displayName.trim()
    || (inRecoveryIdentify ? false
        : inRecoveryVerify ? (!newPassword || (recoveryMethod === 'dob' ? !dob : !securityAnswer.trim()))
        : mode === 'create' ? (!password || !securityQuestion || !securityAnswer.trim())
        : !password);
  const submitLabel = working
    ? (inRecoveryIdentify ? 'Checking…' : inRecoveryVerify ? 'Resetting…' : mode === 'create' ? 'Creating…' : 'Logging in…')
    : (inRecoveryIdentify ? 'Continue' : inRecoveryVerify ? 'Reset password' : mode === 'create' ? 'Create profile' : 'Log in');
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
                  aria-label="Back to the app"
                  className="no-tap-highlight mb-4 inline-flex items-center gap-1.5 text-sm"
                  style={{ color: T.muted }}>
            <ArrowLeft size={16} /> Keep exploring as guest
          </button>
        )}
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
               style={{ background: T.primary }}>
            <GraduationCap size={28} color="#FFF" />
          </div>
          <div className="font-display text-3xl font-semibold" style={{ color: T.ink }}>NORCET prep</div>
          <div className="text-sm mt-1" style={{ color: T.muted }}>
            {mode === 'create' ? 'Create a profile to save your progress across devices' : 'Welcome back'}
          </div>
        </div>

        {/* Tabs — hidden during recovery so the user isn't tempted to swap mid-flow */}
        {!recovering && (
          <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
            <button onClick={() => { setMode('create'); setError(null); setRecoverySuccess(false); }}
                    className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                    style={{ background: mode === 'create' ? T.surface : 'transparent',
                             color: mode === 'create' ? T.ink : T.muted,
                             boxShadow: mode === 'create' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              <UserPlus size={14} />
              Create profile
            </button>
            <button onClick={() => { setMode('login'); setError(null); }}
                    className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                    style={{ background: mode === 'login' ? T.surface : 'transparent',
                             color: mode === 'login' ? T.ink : T.muted,
                             boxShadow: mode === 'login' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              <LogIn size={14} />
              Log in
            </button>
          </div>
        )}

        {/* Recovery header */}
        {recovering && (
          <div className="mb-4 px-1">
            <div className="font-display text-base font-semibold mb-1" style={{ color: T.ink }}>Reset password</div>
            <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
              {recoveryStep === 'identify'
                ? "Enter your display name. We'll show your security question so you can prove it's you."
                : recoveryMethod === 'dob'
                  ? "Enter the date of birth you set when you created this profile, then choose a new password."
                  : "Answer your security question, then choose a new password."}
            </div>
          </div>
        )}

        {/* Post-recovery success banner */}
        {recoverySuccess && !recovering && (
          <Card className="p-3 mb-4 anim-fadeup" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-start gap-2.5">
              <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                Password reset. Log in with your new password — we've pre-filled it for you.
              </div>
            </div>
          </Card>
        )}

        {/* Display name */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
          Display name
        </div>
        <div className="relative mb-4">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={mode === 'create' ? 'Your name' : 'Enter your name'}
            autoCapitalize="words"
            autoComplete="off"
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
                This name is already taken.{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setPassword(''); setNameTaken(null); }}
                  className="no-tap-highlight underline font-medium"
                  style={{ color: T.primary }}
                >
                  Log in instead?
                </button>
              </span>
            </div>
          )}
          {mode === 'create' && !recovering && checkingName && nameTaken === null && displayName.trim() && (
            <div className="mt-2 text-xs" style={{ color: T.muted }}>
              Checking availability…
            </div>
          )}
          {/* Caution (non-blocking): the name becomes your login id and is shown
              verbatim on the leaderboard and in backups, so flag odd characters. */}
          {mode === 'create' && !recovering && displayName.trim() && /[^\p{L}\p{N}\s\-_.'’]/u.test(displayName.trim()) && (
            <div className="mt-2 text-xs flex items-start gap-1.5" style={{ color: T.accent }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>Emojis and symbols may not display correctly on the leaderboard or in backups — letters, numbers and spaces are safest.</span>
            </div>
          )}
        </div>

        {/* Security question + answer — CREATE mode (replaces DOB). */}
        {mode === 'create' && !recovering && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2 flex items-center justify-between" style={{ color: T.muted }}>
              <span>Security question</span>
              <span className="font-normal normal-case text-[10px]" style={{ color: T.muted }}>For password recovery</span>
            </div>
            <div className="relative mb-2">
              <ShieldQuestion size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
              <select
                value={securityQuestion}
                onChange={e => setSecurityQuestion(e.target.value)}
                className="w-full rounded-xl pl-10 pr-9 py-3 text-sm appearance-none"
                style={inputStyle}
              >
                {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
            </div>
            <div className="relative mb-1">
              <input
                type="text"
                value={securityAnswer}
                onChange={e => setSecurityAnswer(e.target.value)}
                placeholder="Your answer"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                className="w-full rounded-xl px-4 py-3 text-sm"
                style={inputStyle}
              />
            </div>
            <div className="text-[10px] mb-4 px-1 leading-relaxed" style={{ color: T.muted }}>
              You'll use this to recover your password if you forget it. Not case-sensitive.
            </div>
          </>
        )}

        {/* Email — OPTIONAL, create mode only. Unverified; stored only in the
            protected profile_secrets table (never the public blob). */}
        {mode === 'create' && !recovering && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2 flex items-center justify-between" style={{ color: T.muted }}>
              <span>Email</span>
              <span className="font-normal normal-case text-[10px]" style={{ color: T.muted }}>Optional</span>
            </div>
            <div className="relative mb-4">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com (optional)"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                inputMode="email"
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                style={inputStyle}
              />
            </div>
          </>
        )}

        {/* Password (create + login) */}
        {!recovering && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
              Password
            </div>
            <div className="relative mb-2">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'create' ? 'Choose a password (min 8 chars)' : 'Your password'}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
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
                  Forgot password?
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
                  Date of birth
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
                  Security question
                </div>
                <Card className="p-3 mb-2" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                  <div className="flex items-start gap-2.5">
                    <ShieldQuestion size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
                    <div className="text-sm" style={{ color: T.ink }}>{recoveryQuestion || 'Your security question'}</div>
                  </div>
                </Card>
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={e => setSecurityAnswer(e.target.value)}
                    placeholder="Your answer"
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
              New password
            </div>
            <div className="relative mb-4">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Choose a new password (min 8 chars)"
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
                  ? <>Remember your display name and password — you'll need both to log in. Your security question is the only way to recover access if you forget.</>
                  : <>This is a study app, not a secure account — don't reuse a password you use elsewhere.</>}
              </div>
            </div>
          </Card>
        )}

        {/* #2 — consent at the sign-up step (calm inline notice + tappable links) */}
        {mode === 'create' && !recovering && (
          <div className="text-[11px] leading-relaxed mb-4 px-1" style={{ color: T.muted }}>
            By creating a profile, you agree to our{' '}
            <button type="button" onClick={() => setLegalView('privacy')}
                    className="no-tap-highlight underline font-medium" style={{ color: T.primary }}>
              Privacy Policy
            </button>
            {' '}and{' '}
            <button type="button" onClick={() => setLegalView('terms')}
                    className="no-tap-highlight underline font-medium" style={{ color: T.primary }}>
              Terms of Use
            </button>.
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
                  Move existing on-device progress into this profile
                </div>
                <div className="text-xs mt-1 leading-relaxed" style={{ color: T.muted }}>
                  {legacyStats.attempted} question{legacyStats.attempted === 1 ? '' : 's'} practiced
                  {legacyStats.streak > 0 && ` · ${legacyStats.streak}-day streak`}
                  {legacyStats.bookmarks > 0 && ` · ${legacyStats.bookmarks} bookmark${legacyStats.bookmarks === 1 ? '' : 's'}`}
                  {legacyStats.customs > 0 && ` · ${legacyStats.customs} custom Q${legacyStats.customs === 1 ? '' : 's'}`}
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
              Back to log in
            </button>
          ) : (
            <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
              {mode === 'create'
                ? 'Profiles sync across devices. Remember your display name and password, and your security answer.'
                : 'Forgot your password? Use the link above — you can reset it with your security question.'}
            </div>
          )}
        </div>
      </div>

      {/* #2 — inline legal viewer (Privacy Policy / Terms of Use) */}
      {legalView && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center anim-fadeup"
             style={{ background: 'rgba(0,0,0,0.45)' }}
             onClick={() => setLegalView(null)}>
          <div className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
               style={{ background: T.bg }}
               onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
                 style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
              <div className="font-display text-base font-semibold" style={{ color: T.ink }}>
                {legalDoc(legalView)?.title || 'Legal'}
              </div>
              <button type="button" onClick={() => setLegalView(null)} aria-label="Close"
                      className="no-tap-highlight p-2 rounded-lg active:bg-black/5">
                <X size={18} style={{ color: T.muted }} />
              </button>
            </div>
            <div className="px-4 pb-6 pt-3">
              <LegalContent doc={legalDoc(legalView)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthScreen;
