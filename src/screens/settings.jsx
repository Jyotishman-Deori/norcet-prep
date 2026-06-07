// =====================================================================
// src/screens/settings.jsx — Settings screen (A1 slice 13)
// Extracted from App.jsx. Body byte-identical to the original; the only
// changes are the A7 hook lines and the signature dropping data/profile/
// isAdmin (now from useData/useProfile). All other props (themeMode, the
// on* callbacks, isGuest, unseenReplyCount, onBack) stay props. setData is
// NOT used by Settings (0 refs). IS_DARK not used (0 refs).
// =====================================================================
import React, { useState, useRef, useEffect } from 'react';
import {
  AlertCircle, Check, ChevronRight, Clock, Download, Edit3, Eye, EyeOff,
  GraduationCap, Heart, Lock, LogOut, RefreshCw, RotateCcw, Sigma, Trash2,
  Upload, User, UserPlus, Volume2
} from 'lucide-react';
import { useTheme, useProfile, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar, requestSupport } from '../ui/primitives.jsx';
import { requestRename } from '../ui/rename-channel.js';
import { LIGHT_THEMES } from '../lib/light-themes.js';
import { downloadAsFile } from '../lib/utils.js';
import { loadSoundEnabled, setSoundEnabled } from '../lib/sound.js';
import {
  buildNotesExport, loadMindmapNotes, saveMindmapNotes, mergeNotes, parseNotesImport
} from '../lib/notes.js';

function Settings({ themeMode, isGuest = false, onGuestSignIn, onClearAll, onImportBackup, onLogout, onSwitchProfile, onUnlockAdmin, onLockAdmin, onToggleTheme, onSetColorTheme, onShowWelcome, onOpenFeedbackInbox, onOpenAdminPanel, onOpenMyReports, onRenameProfile, onToggleReviewReminders, onToggleIncludeGkInStats, onSetDailyReminder, unseenReplyCount = 0, onBack }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { profile, isAdmin } = useProfile();
  const [confirming, setConfirming] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = useRef(null);
  // P11 Feature C — topic-notes export/import (separate from the data backup;
  // notes live in a local shared:false blob, not in `data`).
  const [notesMsg, setNotesMsg] = useState(null);
  const notesFileRef = useRef(null);
  // F-B — pull-to-refresh sound preference (local pref, not in `data`).
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => { let on = true; loadSoundEnabled().then(v => { if (on) setSoundOn(v); }); return () => { on = false; }; }, []);
  const [adminInput, setAdminInput] = useState('');
  const [adminShow, setAdminShow] = useState(false);
  const [adminError, setAdminError] = useState(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  // Session 4, Item 3 — brute-force throttle on the unlock passphrase.
  const [adminFailCount, setAdminFailCount] = useState(0);
  const [adminCooldown, setAdminCooldown] = useState(0); // seconds remaining
  useEffect(() => {
    if (adminCooldown <= 0) return;
    const t = setInterval(() => {
      setAdminCooldown(c => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [adminCooldown]);
  // Record a wrong-passphrase attempt; lock out for 30s after 3 misses.
  // ('not-authorized' = correct passphrase but wrong profile/offline — that
  // is NOT a brute-force signal, so it does not count toward the cooldown.)
  const registerAdminFail = () => {
    const fails = adminFailCount + 1;
    setAdminFailCount(fails);
    if (fails >= 3) {
      setAdminError('Too many attempts — wait 30 seconds');
      setAdminCooldown(30);
      setAdminFailCount(0);
    } else {
      setAdminError(`Incorrect passphrase (${3 - fails} attempt${3 - fails === 1 ? '' : 's'} left)`);
    }
    setAdminBusy(false);
  };

  // P3 — daily reminder local UI state. `drPerm` reflects the latest known
  // Notification permission so we can show a "blocked" hint without storing it.
  const reminder = (data.preferences && data.preferences.dailyReminder) || { enabled: false, time: '20:00' };
  const [drPerm, setDrPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [drBusy, setDrBusy] = useState(false);
  const reminderOn = !!reminder.enabled;
  const onToggleReminder = async () => {
    if (drBusy || !onSetDailyReminder) return;
    setDrBusy(true);
    try { const perm = await onSetDailyReminder({ enabled: !reminderOn }); if (perm) setDrPerm(perm); }
    finally { setDrBusy(false); }
  };

  const handleExport = () => {
    const blob = {
      exportedAt: new Date().toISOString(),
      appVersion: 'norcet-prep-1',
      profileDisplayName: profile?.displayName,
      data
    };
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = profile?.id || 'profile';
    downloadAsFile(JSON.stringify(blob, null, 2), `norcet-backup-${safeName}-${stamp}.json`);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const payload = parsed.data || parsed; // accept raw or wrapped
        if (!payload || typeof payload !== 'object') throw new Error('Invalid file');
        if (!('customQuestions' in payload) && !('history' in payload) && !('stats' in payload)) {
          throw new Error('This does not look like a NORCET backup');
        }
        onImportBackup(payload);
        setImportMsg({ ok: true, text: 'Backup restored into this profile.' });
      } catch (err) {
        setImportMsg({ ok: false, text: 'Could not import: ' + err.message });
      }
      e.target.value = '';
    };
    reader.onerror = () => setImportMsg({ ok: false, text: 'Could not read file' });
    reader.readAsText(file);
  };

  // P11 Feature C — export/import the user's topic notes (a separate JSON file
  // from the full data backup; notes live in a local shared:false blob).
  const handleNotesExport = async () => {
    const pid = profile && profile.id;
    const notes = await loadMindmapNotes(pid);
    const count = notes ? Object.keys(notes).length : 0;
    if (count === 0) { setNotesMsg({ ok: false, text: 'No topic notes yet — long-press a node on the Knowledge Map to add one.' }); return; }
    const blob = buildNotesExport(pid, notes);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadAsFile(JSON.stringify(blob, null, 2), `norcet-notes-${pid || 'guest'}-${stamp}.json`);
    setNotesMsg({ ok: true, text: `Exported ${count} note${count === 1 ? '' : 's'}.` });
  };
  const handleNotesImportClick = () => notesFileRef.current && notesFileRef.current.click();
  const handleNotesFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const incoming = parseNotesImport(ev.target.result);
        const pid = profile && profile.id;
        const existing = await loadMindmapNotes(pid);
        const merged = mergeNotes(existing, incoming);
        await saveMindmapNotes(pid, merged);
        const added = Object.keys(incoming).length;
        setNotesMsg({ ok: true, text: `Imported ${added} note${added === 1 ? '' : 's'} (merged; newest kept). Reopen the Knowledge Map to see them.` });
      } catch (err) {
        setNotesMsg({ ok: false, text: 'Could not import notes: ' + err.message });
      }
      e.target.value = '';
    };
    reader.onerror = () => setNotesMsg({ ok: false, text: 'Could not read file' });
    reader.readAsText(file);
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Settings" onBack={onBack} feedback={{ screen: "Settings" }} />
      <div className="max-w-md mx-auto px-4 pt-4 pb-24">

        {/* Profile section */}
        {isGuest && (
          <>
            <div className="mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Account</div>
            <Card className="p-4 mb-6 cursor-pointer no-tap-highlight pressable"
                  style={{ background: T.primary, border: 'none' }}
                  onClick={onGuestSignIn}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <UserPlus size={20} color="#FFF" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-semibold" style={{ color: '#FFF' }}>Sign in / Create account</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    You're a guest — save your progress &amp; sync across devices
                  </div>
                </div>
                <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.8)' }} className="flex-shrink-0" />
              </div>
            </Card>
          </>
        )}
        {!isGuest && profile && (
          <>
            <div className="mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Profile</div>
            <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
                  style={{ background: T.primary, border: 'none' }}
                  onClick={() => {
                    if (onRenameProfile) {
                      requestRename({ profile, onRename: onRenameProfile });
                    }
                  }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <User size={20} color="#FFF" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-lg font-semibold truncate" style={{ color: '#FFF' }}>
                      {profile.displayName}
                    </div>
                    {onRenameProfile && (
                      <Edit3 size={14} style={{ color: 'rgba(255,255,255,0.7)' }} className="flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {onRenameProfile ? 'Tap to rename · syncs across devices' : 'Logged in · syncs across devices'}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-2 mb-6">
              <Card className="p-3 cursor-pointer no-tap-highlight pressable" onClick={onSwitchProfile}>
                <RefreshCw size={16} style={{ color: T.ink }} />
                <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Switch</div>
                <div className="text-[10px]" style={{ color: T.muted }}>Use a different profile</div>
              </Card>
              <Card className="p-3 cursor-pointer no-tap-highlight pressable" onClick={onLogout}>
                <LogOut size={16} style={{ color: T.error }} />
                <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Log out</div>
                <div className="text-[10px]" style={{ color: T.muted }}>End session on this device</div>
              </Card>
            </div>
          </>
        )}

        {/* My feedback */}
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onOpenMyReports}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent + '15' }}>
              <AlertCircle size={18} style={{ color: T.accent }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>My feedback</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>Reports you've sent and admin replies</div>
            </div>
            {unseenReplyCount > 0 && (
              <span className="px-2 py-1 rounded-full text-xs font-bold flex-shrink-0"
                    style={{ background: T.primary, color: '#FFF' }}>{unseenReplyCount} new</span>
            )}
            <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0" />
          </div>
        </Card>

        <Card className="p-4 mb-3">
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Custom questions</div>
          <div className="font-display text-xl" style={{ color: T.ink }}>{data.customQuestions.length} added</div>
        </Card>
        <Card className="p-4 mb-3">
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Total practice</div>
          <div className="font-display text-xl" style={{ color: T.ink }}>{data.stats.totalAttempted} questions</div>
        </Card>

        {/* Reminders — at the moment, just the spaced-revision card on Home.
            Toggling this off removes the green "Review due" card from Home
            entirely. The underlying spaced-repetition logic still runs — it
            just stops nudging her. */}
        {onToggleReviewReminders && (
          <>
            <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Reminders</div>
            <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
                  onClick={() => onToggleReviewReminders(!(data.preferences && data.preferences.reviewRemindersEnabled !== false))}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: T.success + '20' }}>
                    <RotateCcw size={18} style={{ color: T.success }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: T.ink }}>Spaced revision reminders</div>
                    <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                      {data.preferences && data.preferences.reviewRemindersEnabled !== false
                        ? "Show the green 'Review due' card on Home when questions are ready for review"
                        : "Hidden — the spaced-repetition engine still tracks dates, just doesn't nudge you"}
                    </div>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                     style={{ background: (data.preferences && data.preferences.reviewRemindersEnabled !== false) ? T.success : T.border }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                       style={{ transform: (data.preferences && data.preferences.reviewRemindersEnabled !== false) ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
              </div>
            </Card>
          </>
        )}

        {/* P3 — Daily study reminder. Toggle requests Notification permission;
            when granted + on, a time picker appears. A best-effort local
            notification fires on app-open if the user hasn't studied past their
            chosen time (see setDailyReminder + the reminder effect in App). */}
        {onSetDailyReminder && (
          <>
            <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Notifications</div>
            <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onToggleReminder}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.accent + '20' }}>
                    <Clock size={18} style={{ color: T.accent }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: T.ink }}>Daily reminders</div>
                    <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                      {reminderOn ? `A nudge if you haven't studied by ${reminder.time || '20:00'}` : 'Off — get a gentle daily study nudge'}
                    </div>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0" style={{ background: reminderOn ? T.success : T.border, opacity: drBusy ? 0.6 : 1 }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: reminderOn ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
              </div>
            </Card>

            {/* Time picker — only when reminders are on */}
            {reminderOn && (
              <Card className="p-4 mb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium" style={{ color: T.ink }}>Reminder time</div>
                  <input type="time" value={reminder.time || '20:00'}
                         onChange={(e) => onSetDailyReminder({ time: e.target.value })}
                         onFocus={() => document.body.classList.remove('app-blurred')}
                         className="rounded-lg px-3 py-1.5 text-sm"
                         style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
                </div>
              </Card>
            )}

            {/* Blocked-permission hint */}
            {!reminderOn && drPerm === 'denied' && (
              <Card className="p-3 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}30` }}>
                <div className="text-xs" style={{ color: T.error }}>
                  Notifications are blocked for this app. To turn reminders on, allow notifications for this site in your browser settings, then try again.
                </div>
              </Card>
            )}
            {!reminderOn && drPerm === 'unsupported' && (
              <Card className="p-3 mb-3" style={{ background: T.surfaceWarm }}>
                <div className="text-xs" style={{ color: T.muted }}>
                  This browser doesn't support notifications. Try installing the app to your home screen.
                </div>
              </Card>
            )}
          </>
        )}

        {/* P18 — GK & Aptitude (non-nursing PYQ sections) are excluded from
            nursing accuracy, coverage and weak areas by default. This lets a
            user who practises them on purpose fold them back into the numbers. */}
        {onToggleIncludeGkInStats && (
          <>
            <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Analytics</div>
            <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
                  onClick={() => onToggleIncludeGkInStats(!(data.preferences && data.preferences.includeGkInStats === true))}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: T.primary + '20' }}>
                    <Sigma size={18} style={{ color: T.primary }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: T.ink }}>Count GK &amp; Aptitude in stats</div>
                    <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                      {(data.preferences && data.preferences.includeGkInStats === true)
                        ? 'General Knowledge and Reasoning & Aptitude are included in your accuracy, coverage and weak areas'
                        : 'Off — only nursing topics count toward accuracy, coverage and weak areas (recommended)'}
                    </div>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                     style={{ background: (data.preferences && data.preferences.includeGkInStats === true) ? T.success : T.border }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                       style={{ transform: (data.preferences && data.preferences.includeGkInStats === true) ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
              </div>
            </Card>
          </>
        )}

        {/* F-B — pull-to-refresh sound toggle. Local pref; respects the device
            media volume (a web app can't read the hardware mute switch). */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Sound</div>
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
              onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next); }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: T.primary + '20' }}>
                <Volume2 size={18} style={{ color: T.primary }} />
              </div>
              <div className="min-w-0">
                <div className="font-medium" style={{ color: T.ink }}>Pull-to-refresh sound</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                  {soundOn
                    ? 'A soft sound plays when you pull down to refresh'
                    : 'Off — refreshing is silent'}
                </div>
              </div>
            </div>
            <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                 style={{ background: soundOn ? T.success : T.border }}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                   style={{ transform: soundOn ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Appearance</div>

        {/* Mode selector — Light / Dark */}
        <Card className="p-4 mb-3">
          <div className="text-xs font-medium mb-3" style={{ color: T.muted }}>Mode</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'light', label: 'Light', icon: '☀️', desc: 'Default'      },
              { id: 'dark',  label: 'Dark',  icon: '🌙', desc: 'Easy on eyes' },
            ].map(opt => {
              const active = opt.id === 'dark' ? themeMode === 'dark' : themeMode !== 'dark';
              const isDarkOpt = opt.id === 'dark';
              return (
                <button key={opt.id}
                        onClick={() => onSetColorTheme && onSetColorTheme(opt.id)}
                        className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl no-tap-highlight pressable"
                        style={{
                          background: active ? (isDarkOpt ? '#1A1A1A' : T.primary + '12') : T.surfaceWarm,
                          border: `1.5px solid ${active ? (isDarkOpt ? '#444' : T.primary) : T.border}`,
                        }}>
                  <span className="text-xl leading-none">{opt.icon}</span>
                  <span className="text-xs font-semibold"
                        style={{ color: active ? (isDarkOpt ? '#FFF' : T.primary) : T.ink }}>
                    {opt.label}
                  </span>
                  <span className="text-[9px]"
                        style={{ color: active ? (isDarkOpt ? '#999' : T.primarySoft) : T.muted }}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Colour theme picker — hidden in dark mode */}
        {themeMode !== 'dark' && (
          <Card className="p-4 mb-3">

            {/* Row 1 — Soft */}
            <div className="text-xs font-medium mb-2" style={{ color: T.muted }}>Soft</div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {LIGHT_THEMES.slice(0, 4).map(opt => {
                const active = themeMode === opt.id;
                return (
                  <button key={opt.id} onClick={() => onSetColorTheme && onSetColorTheme(opt.id)}
                          className="flex flex-col items-center gap-1.5 no-tap-highlight"
                          style={{ background:'none', border:'none', padding:0, cursor:'pointer' }}>
                    <div className="relative w-12 h-12 rounded-full flex items-center justify-center"
                         style={{ background: opt.bg,
                                  border: active ? `2.5px solid ${opt.swatch}` : `2px solid ${T.border}`,
                                  boxShadow: active ? `0 0 0 3px ${opt.swatch}28` : 'none' }}>
                      <div className="w-6 h-6 rounded-full" style={{ background: opt.swatch, opacity: 0.85 }} />
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full"
                             style={{ background: opt.swatch + '18' }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3.5 8.5l3 3 6-6" stroke={opt.swatch} strokeWidth="2.2"
                                  strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-tight"
                          style={{ color: active ? opt.swatch : T.muted }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 2 — Vivid */}
            <div className="text-xs font-medium mb-2" style={{ color: T.muted }}>Vivid</div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {LIGHT_THEMES.slice(4).map(opt => {
                const active = themeMode === opt.id;
                return (
                  <button key={opt.id} onClick={() => onSetColorTheme && onSetColorTheme(opt.id)}
                          className="flex flex-col items-center gap-1.5 no-tap-highlight"
                          style={{ background:'none', border:'none', padding:0, cursor:'pointer' }}>
                    <div className="relative w-12 h-12 rounded-full flex items-center justify-center"
                         style={{ background: opt.bg,
                                  border: active ? `2.5px solid ${opt.swatch}` : `2px solid ${T.border}`,
                                  boxShadow: active ? `0 0 0 3px ${opt.swatch}38` : 'none' }}>
                      <div className="w-6 h-6 rounded-full" style={{ background: opt.swatch }} />
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full"
                             style={{ background: opt.swatch + '20' }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3.5 8.5l3 3 6-6" stroke={opt.swatch} strokeWidth="2.2"
                                  strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-tight"
                          style={{ color: active ? opt.swatch : T.muted }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 3 — Minimal */}
            <div className="text-xs font-medium mb-2" style={{ color: T.muted }}>Minimal</div>
            <div className="flex gap-2">
              {[{ id: 'midnight', label: 'Midnight', swatch: '#000000', bg: '#FFFFFF' }].map(opt => {
                const active = themeMode === opt.id;
                return (
                  <button key={opt.id} onClick={() => onSetColorTheme && onSetColorTheme(opt.id)}
                          className="flex flex-col items-center gap-1.5 no-tap-highlight"
                          style={{ background:'none', border:'none', padding:0, cursor:'pointer' }}>
                    <div className="relative w-12 h-12 rounded-full flex items-center justify-center"
                         style={{ background: opt.bg,
                                  border: active ? `2.5px solid ${opt.swatch}` : `2px solid ${T.border}`,
                                  boxShadow: active ? `0 0 0 3px ${opt.swatch}22` : 'none' }}>
                      <div className="w-6 h-6 rounded-full" style={{ background: opt.swatch }} />
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full"
                             style={{ background: opt.swatch + '10' }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3.5 8.5l3 3 6-6" stroke={opt.swatch} strokeWidth="2.2"
                                  strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-tight"
                          style={{ color: active ? opt.swatch : T.muted }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>

          </Card>
        )}

        {/* Help */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Help</div>
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onShowWelcome}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '15' }}>
              <GraduationCap size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Show welcome tour</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>Quick recap of what each mode does</div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>

        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Backup</div>
        <div className="text-xs mb-3" style={{ color: T.muted }}>
          Your profile already syncs across devices via your account. A local backup file is an extra safety net.
        </div>

        <Card className="p-4 mb-2 cursor-pointer no-tap-highlight pressable" onClick={handleExport}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '15' }}>
              <Download size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Download backup</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                This profile's questions, history, stats, bookmarks
              </div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>

        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={handleImportClick}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent + '15' }}>
              <Upload size={18} style={{ color: T.accent }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Restore from backup</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                Replace this profile's data with a saved file
              </div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>
        <input ref={fileInputRef} type="file" accept="application/json,.json"
               className="hidden" onChange={handleFile} />

        {importMsg && (
          <Card className="p-3 mb-3 anim-fadeup"
                style={{ background: importMsg.ok ? T.successSoft : T.errorSoft,
                         border: `1px solid ${importMsg.ok ? T.success : T.error}40` }}>
            <div className="text-sm" style={{ color: importMsg.ok ? T.success : T.error }}>
              {importMsg.text}
            </div>
          </Card>
        )}

        {/* P11 Feature C — topic notes export/import (separate file from the
            data backup). Useful for backup + sharing "my best mnemonics". */}
        <div className="mt-6 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Topic notes</div>
        <div className="text-xs mb-3" style={{ color: T.muted }}>
          The notes you pin to topics on the Knowledge Map. Export to back them up or share your mnemonics; import merges into your existing notes.
        </div>
        <Card className="p-4 mb-2 cursor-pointer no-tap-highlight pressable" onClick={handleNotesExport}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '15' }}>
              <Download size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Export notes</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>Save all your topic notes as a JSON file</div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={handleNotesImportClick}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent + '15' }}>
              <Upload size={18} style={{ color: T.accent }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Import notes</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>Merge notes from a file (newest kept per topic)</div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>
        <input ref={notesFileRef} type="file" accept="application/json,.json"
               className="hidden" onChange={handleNotesFile} />
        {notesMsg && (
          <Card className="p-3 mb-3 anim-fadeup"
                style={{ background: notesMsg.ok ? T.successSoft : T.errorSoft,
                         border: `1px solid ${notesMsg.ok ? T.success : T.error}40` }}>
            <div className="text-sm" style={{ color: notesMsg.ok ? T.success : T.error }}>
              {notesMsg.text}
            </div>
          </Card>
        )}

        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Admin</div>
        {isAdmin ? (
          <>
          <Card className="p-4 mb-3" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: T.success }}>
                  <Check size={16} color="#FFF" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm" style={{ color: T.ink }}>Admin mode is on</div>
                  <div className="text-xs" style={{ color: T.muted }}>Banks · users · feedback · announcements</div>
                </div>
              </div>
            </div>
            {/* P15 — Storage info, debug line. Only visible when admin is
                unlocked. "Last compacted" only shows once a real
                compaction has run (lastCompactedTs is null on a fresh
                v8-migrated blob). */}
            {(() => {
              let kb = '?';
              try { kb = (JSON.stringify(data).length / 1024).toFixed(0); } catch (e) {}
              const lc = data && data.stats && data.stats.lastCompactedTs;
              let lastStr = 'never';
              if (typeof lc === 'number' && lc > 0) {
                const days = Math.floor((Date.now() - lc) / (24 * 60 * 60 * 1000));
                if (days === 0) lastStr = 'today';
                else if (days === 1) lastStr = '1 day ago';
                else if (days < 30) lastStr = days + ' days ago';
                else if (days < 365) lastStr = Math.floor(days / 30) + ' months ago';
                else lastStr = Math.floor(days / 365) + ' years ago';
              }
              return (
                <div className="text-[11px] mb-2 px-1" style={{ color: T.muted }}>
                  Your data: {kb} KB · last compacted {lastStr}
                </div>
              );
            })()}
            <Button onClick={onOpenAdminPanel} className="w-full mb-2" icon={<ChevronRight size={14} />}>
              Open Admin Panel
            </Button>
            <Button variant="ghost" onClick={onLockAdmin} className="w-full" icon={<Lock size={14} />}>
              Lock admin
            </Button>
          </Card>
          </>
        ) : !showAdminForm ? (
          <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={() => { setShowAdminForm(true); setAdminError(null); }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: T.surfaceWarm }}>
                <Lock size={16} style={{ color: T.muted }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium" style={{ color: T.ink }}>Unlock admin mode</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>Enter the admin passphrase</div>
              </div>
              <ChevronRight size={18} style={{ color: T.muted }} />
            </div>
          </Card>
        ) : (
          <Card className="p-4 mb-3 anim-fadeup">
            <div className="text-xs leading-relaxed mb-3" style={{ color: T.muted }}>
              Admin access is for the app owner only. This is soft security — don't reuse a real password.
            </div>
            <div className="relative mb-3">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input type={adminShow ? 'text' : 'password'} value={adminInput}
                     onChange={e => setAdminInput(e.target.value)}
                     placeholder="Admin passphrase"
                     autoComplete="off"
                     onKeyDown={async e => {
                       if (e.key === 'Enter' && adminInput && !adminBusy && adminCooldown <= 0) {
                         setAdminBusy(true);
                         // A4: tri-state result. true → granted; 'not-authorized'
                         // → passphrase ok but server didn't confirm this profile
                         // (or we're offline); anything else → wrong passphrase.
                         const res = await onUnlockAdmin(adminInput);
                         if (res === true) { setAdminInput(''); setShowAdminForm(false); setAdminBusy(false); setAdminFailCount(0); setAdminCooldown(0); }
                         else if (res === 'not-authorized') { setAdminError('This profile is not an admin, or you are offline. Connect and use the owner profile.'); setAdminBusy(false); }
                         else { registerAdminFail(); }
                       }
                     }}
                     disabled={adminBusy || adminCooldown > 0}
                     className="w-full rounded-xl pl-10 pr-12 py-3 text-sm"
                     style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, opacity: adminCooldown > 0 ? 0.5 : 1 }} />
              <button onClick={() => setAdminShow(v => !v)}
                      className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5"
                      type="button">
                {adminShow ? <EyeOff size={16} style={{ color: T.muted }} /> : <Eye size={16} style={{ color: T.muted }} />}
              </button>
            </div>
            {adminError && (
              <div className="text-xs mb-3 px-1 flex items-center gap-2" style={{ color: T.error }}>
                <span>{adminError}</span>
                {adminCooldown > 0 && (
                  <span className="font-mono font-bold ml-auto">{adminCooldown}s</span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setShowAdminForm(false); setAdminInput(''); setAdminError(null); setAdminFailCount(0); setAdminCooldown(0); }} className="flex-1">
                Cancel
              </Button>
              <Button disabled={!adminInput || adminBusy || adminCooldown > 0}
                      onClick={async () => {
                        setAdminBusy(true);
                        const res = await onUnlockAdmin(adminInput);
                        if (res === true) { setAdminInput(''); setShowAdminForm(false); setAdminBusy(false); setAdminFailCount(0); setAdminCooldown(0); }
                        else if (res === 'not-authorized') { setAdminError('This profile is not an admin, or you are offline. Connect and use the owner profile.'); setAdminBusy(false); }
                        else { registerAdminFail(); }
                      }}
                      className="flex-1"
                      icon={adminBusy ? <RefreshCw size={14} className="animate-spin" /> : null}>
                {adminCooldown > 0 ? `Wait ${adminCooldown}s` : adminBusy ? 'Checking' : 'Unlock'}
              </Button>
            </div>
          </Card>
        )}

        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Danger zone</div>
        {!confirming ? (
          <Card className="p-4 cursor-pointer" onClick={() => setConfirming(true)}>
            <div className="flex items-center gap-3">
              <Trash2 size={18} style={{ color: T.error }} />
              <div>
                <div className="font-medium" style={{ color: T.ink }}>Reset this profile's data</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>Progress, bookmarks, custom questions, stats</div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4" style={{ background: T.errorSoft, border: `1px solid ${T.error}` }}>
            <div className="font-medium mb-2" style={{ color: T.error }}>This cannot be undone.</div>
            <div className="text-xs mb-3" style={{ color: T.inkSoft }}>
              Affects {profile ? profile.displayName + "'s" : 'this'} progress only. Other profiles are not touched. Consider downloading a backup first.
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="ghost" onClick={() => setConfirming(false)} className="flex-1">Cancel</Button>
              <Button variant="accent" onClick={() => { onClearAll(); setConfirming(false); }} className="flex-1">Reset</Button>
            </div>
          </Card>
        )}

        {/* P9 / step 33 — "Support the app" section. Quiet, always visible,
            below all functional settings. Opens the shared support modal
            (buy-me-a-chai / UPI). Non-transactional, no "donate" wording. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Support</div>
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={() => requestSupport()}
              ariaLabel="Support the app">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '15' }}>
              <Heart size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Keep NORCET Prep free {'\u2615'}</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                Free and ad-free {'\u00b7'} buy me a chai to help with server costs
              </div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>

        {/* P19 — build-version string so users (and you) can confirm which
            build is live. __APP_VERSION__ is injected by vite.config.js;
            the typeof guard keeps it from throwing outside a Vite build. */}
        <div className="mt-8 mb-2 text-center" style={{ color: T.muted, fontSize: 11, opacity: 0.75 }}>
          Version: {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
        </div>
      </div>
    </div>
  );
}

export default Settings;
