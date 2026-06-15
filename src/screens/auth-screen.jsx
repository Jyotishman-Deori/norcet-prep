// [A1 slice 42] AuthScreen — first-open profile create / log in / password
// recovery. Extracted VERBATIM from App.jsx (one inserted A7 hook line:
// `const { theme: T } = useTheme();`). The single-consumer helper
// `clearLegacyData` (its only call site was inside this screen) moves in with
// it. The two render sites in App (the boot wall + the in-app `auth` route)
// are unchanged — props {legacyData, initialMode, onAuthed, onBack} identical.
//
// A7: was a bare-T reader -> useTheme(); data/profile/isAdmin: none. No
// IS_DARK / fgOnDark. Imports the profile/auth subsystem (createProfile,
// authenticateProfile, recoverPasswordWithDob, saveSession), the storage
// helpers it calls in the live name-taken check (raceStorage, kvStorage, KEYS,
// normalizeProfileId), the shared primitives (Card, Button), the shared
// stylesheet (fontStyles, slice 42), and 11 lucide icons.
import React, { useState, useEffect, useRef } from 'react';
import {
  Check, AlertCircle, AlertTriangle, ArrowLeft,
  GraduationCap, User, UserPlus, LogIn, Lock, Eye, EyeOff, RefreshCw,
  CalendarDays, Mail
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { fontStyles } from '../lib/font-styles.js';
import { KEYS } from '../lib/keys.js';
import * as kvStorage from '../storage';
import { raceStorage, safeStorage } from '../lib/safe-storage.js';
import { normalizeProfileId } from '../lib/profile-crypto.js';
import {
  createProfile, authenticateProfile, recoverPasswordWithDob, saveSession
} from '../lib/profiles.js';

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
  const [dob, setDob] = useState('');          // YYYY-MM-DD from <input type="date">
  const [email, setEmail] = useState('');      // OPTIONAL, unverified; stored only in profile_secrets
  const [showPassword, setShowPassword] = useState(false);
  const [importExisting, setImportExisting] = useState(!!legacyData);
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);
  // Forgot-password recovery flow lives inline (no separate screen).
  // When `recovering` is true, the form swaps to: name + DOB + new password.
  const [recovering, setRecovering] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  // Live name-taken check (create mode only). null = unknown / not checked yet;
  // true = a profile with this id exists in Supabase; false = name is free.
  // We deliberately use raceStorage directly (not loadProfile, which after P1
  // falls back to local cache) so the check reflects the canonical store.
  // On offline / timeout we stay at `null` so we never falsely block — the
  // final authoritative check still happens in createProfile at submit time.
  const [nameTaken, setNameTaken] = useState(null);
  const [checkingName, setCheckingName] = useState(false);
  const nameCheckTimerRef = useRef(null);
  useEffect(() => {
    // Only run during fresh sign-up. Logging in or recovering doesn't need
    // a "name taken" hint because the user is supplying an EXISTING name on
    // purpose; we'd be reporting expected behaviour as a problem.
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
        else setNameTaken(null); // timeout / error — don't make claims
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

  const handleSubmit = async () => {
    if (working) return;
    setError(null);

    // Recovery flow has its own validation + handler
    if (recovering) {
      if (!displayName.trim()) { setError('Enter your display name'); return; }
      if (!dob) { setError('Pick your date of birth'); return; }
      if (!newPassword) { setError('Enter a new password'); return; }
      setWorking(true);
      try {
        await recoverPasswordWithDob(displayName, dob, newPassword);
        // Don't auto-log them in — make them log in with the new password
        // explicitly so they confirm it works and remember it.
        setRecoverySuccess(true);
        setPassword(newPassword);
        setRecovering(false);
        setMode('login');
        setNewPassword('');
        setDob('');
      } catch (e) {
        setError(e.message || 'Recovery failed');
      } finally {
        setWorking(false);
      }
      return;
    }

    if (!displayName.trim()) { setError('Enter a display name'); return; }
    if (!password) { setError('Enter a password'); return; }
    if (mode === 'create' && !dob) { setError('Pick your date of birth — used to recover your password later'); return; }
    setWorking(true);
    try {
      let profile;
      if (mode === 'create') {
        profile = await createProfile({
          displayName,
          password,
          dob,
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
              Enter your display name and the date of birth you set when creating the profile. You'll then pick a new password.
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
            className="w-full rounded-xl pl-10 pr-4 py-3 text-sm"
            style={inputStyle}
          />
          {/* Live "name taken" hint (create mode only). Renders BELOW the input
              as a subtle inline note plus a quick-action to switch to login.
              Stays out of the way when status is unknown or the field is empty. */}
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
        </div>

        {/* DOB — required in create mode, used as the recovery key in recovery mode.
            Hidden during login. */}
        {(mode === 'create' || recovering) && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2 flex items-center justify-between" style={{ color: T.muted }}>
              <span>Date of birth</span>
              {mode === 'create' && !recovering && (
                <span className="font-normal normal-case text-[10px]" style={{ color: T.muted }}>For password recovery</span>
              )}
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
        )}

        {/* Email — OPTIONAL, create mode only. Unverified for now; stored only
            in the protected profile_secrets table (never the public blob). */}
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

        {/* Password (or NEW password during recovery) */}
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
                placeholder={mode === 'create' ? 'Choose a password (min 4 chars)' : 'Your password'}
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
                <button onClick={() => { setRecovering(true); setError(null); setPassword(''); setRecoverySuccess(false); }}
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

        {recovering && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
              New password
            </div>
            <div className="relative mb-4">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Choose a new password (min 4 chars)"
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
                  ? <>Remember your display name and password — you'll need both to log in. Your date of birth is the only way to recover access if you forget.</>
                  : <>This is a study app, not a secure account — don't reuse a password you use elsewhere.</>}
              </div>
            </div>
          </Card>
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
                disabled={working
                          || !displayName.trim()
                          || (recovering ? (!dob || !newPassword) : !password)
                          || (mode === 'create' && !recovering && !dob)}
                size="lg" className="w-full"
                icon={working
                        ? <RefreshCw size={18} className="animate-spin" />
                        : (recovering ? <Lock size={18} /> : (mode === 'create' ? <UserPlus size={18} /> : <LogIn size={18} />))}>
          {working
            ? (recovering ? 'Resetting…' : (mode === 'create' ? 'Creating…' : 'Logging in…'))
            : (recovering ? 'Reset password' : (mode === 'create' ? 'Create profile' : 'Log in'))}
        </Button>

        <div className="text-center mt-6">
          {recovering ? (
            <button onClick={() => { setRecovering(false); setError(null); setDob(''); setNewPassword(''); }}
                    className="no-tap-highlight text-xs underline" style={{ color: T.muted }} type="button">
              Back to log in
            </button>
          ) : (
            <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
              {mode === 'create'
                ? 'Profiles sync across devices. Remember your display name, password, and date of birth.'
                : 'Forgot your password? Use the link above — you can reset it with your date of birth.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthScreen;
