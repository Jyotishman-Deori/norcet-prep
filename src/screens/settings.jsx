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
  AlertCircle, AlertTriangle, ArrowUpDown, Check, ChevronRight, Clock, Copy, Download, Edit3,
  Fingerprint, FileText, GraduationCap, Hand, Heart, Lock, LogOut, Palette, RefreshCw, RotateCcw, Share2,
  Shield, Sigma, Trash2, Upload, User, UserPlus, Volume2
} from 'lucide-react';
import { useTheme, useProfile, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar, requestSupport, requestConfirm } from '../ui/primitives.jsx';
import { LegalScreen } from './legal.jsx';
import { Tip } from '../ui/tooltip.jsx';
import { requestRename } from '../ui/rename-channel.js';
import { downloadAsFile } from '../lib/utils.js';
import { loadSoundEnabled, setSoundEnabled } from '../lib/sound.js';
// #21/#29 — sidebar gestures + crib sheet toggles; #27 — share card.
import { getSidebarGestures, setSidebarGesture, isCribSheetEnabled, setCribSheetEnabled, loadUiPrefs } from '../lib/ui-prefs.js';
import { ComparisonToggle } from '../ui/comparison-cards.jsx';
// FAV — Favourites strip toggle (per profile, OFF by default).
import { loadFavs, setFavEnabled } from '../lib/favorites.js';
import AccountSecurityCard from './account-security-card.jsx';
import StudyProfileCard from './study-profile-card.jsx';
import {
  buildNotesExport, loadMindmapNotes, saveMindmapNotes, mergeNotes, parseNotesImport
} from '../lib/notes.js';
import { useBackHandler } from '../lib/back-handler.js';

function Settings({ themeMode, isGuest = false, onGuestSignIn, onClearAll, onImportBackup, onLogout, onSwitchProfile, onToggleTheme, onSetColorTheme, onShowWelcome, onOpenFeedbackInbox, onOpenMyReports, onOpenShare, onOpenThemes, onRenameProfile, onToggleReviewReminders, onToggleIncludeGkInStats, onSetDailyReminder, onSetDemographics, onOpenFavorites, onManageFavorites, unseenReplyCount = 0, onBack }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { profile, isAdmin } = useProfile();
  // #21/#29 — per-device UI prefs (hydrated at App boot; re-read here so a
  // fresh Settings mount always reflects storage truth).
  const [gestures, setGestures] = useState(() => getSidebarGestures());
  const [cribOn, setCribOn] = useState(() => isCribSheetEnabled());
  // #8 — which Settings sub-page is open (null = main list).
  const [subPage, setSubPage] = useState(null);
  // FAV — Favourites strip (per profile; hydrated below with the ui prefs).
  const [favs, setFavs] = useState(null);
  useEffect(() => {
    let alive = true;
    loadUiPrefs().then(({ gestures: g, cribEnabled }) => {
      if (!alive) return;
      setGestures(g); setCribOn(cribEnabled);
    }).catch(() => {});
    loadFavs((profile && profile.id) || 'guest').then(f => { if (alive) setFavs(f); }).catch(() => {});
    return () => { alive = false; };
  }, [profile && profile.id]);
  const flipFavs = async () => {
    if (!favs) return;
    const f = await setFavEnabled((profile && profile.id) || 'guest', !favs.enabled);
    setFavs(f);
  };
  const flipGesture = (which) => {
    const next = !gestures[which];
    setGestures(g => ({ ...g, [which]: next }));
    setSidebarGesture(which, next);
  };
  const flipCrib = () => {
    const next = !cribOn;
    setCribOn(next);
    setCribSheetEnabled(next);
  };
  // [admin-app separation] adminInput, adminShow, adminError, adminBusy,
  // showAdminForm, adminFailCount, adminCooldown state hooks removed — the
  // Settings admin section is gone; admin lives in the standalone admin app.
  const [importMsg, setImportMsg] = useState(null);
  // BUG-06 — copy-to-clipboard feedback for the account ID card.
  const [idCopied, setIdCopied] = useState(false);
  const accountId = profile ? (profile.uid || profile.id) : null; // matches what the admin allow-list checks
  const copyAccountId = async () => {
    if (!accountId) return;
    try {
      await navigator.clipboard.writeText(accountId);
      setIdCopied(true); setTimeout(() => setIdCopied(false), 1600);
    } catch (e) { /* clipboard blocked — the id is still visible to copy manually */ }
  };
  const fileInputRef = useRef(null);
  // P11 Feature C — topic-notes export/import (separate from the data backup;
  // notes live in a local shared:false blob, not in `data`).
  const [notesMsg, setNotesMsg] = useState(null);
  const notesFileRef = useRef(null);
  // F-B — pull-to-refresh sound preference (local pref, not in `data`).
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => { let on = true; loadSoundEnabled().then(v => { if (on) setSoundOn(v); }); return () => { on = false; }; }, []);
  // P3 — daily reminder local UI state. `drPerm` reflects the latest known
  // Notification permission so we can show a "blocked" hint without storing it.
  const reminder = (data.preferences && data.preferences.dailyReminder) || { enabled: false, time: '20:00' };
  const [drPerm, setDrPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  // #16 — Legal pages render as a self-contained sub-view of Settings (no app
  // routing needed). Set to 'privacy' | 'terms' to open; back returns here.
  const [legalView, setLegalView] = useState(null);
  // BUG-01 — device/browser back pops Settings' own sub-views first (the same
  // order the on-screen ← arrow uses): an open Legal doc, then the sub-page,
  // then (nothing left) the app leaves Settings.
  useBackHandler(() => {
    if (legalView) { setLegalView(null); return true; }
    if (subPage) { setSubPage(null); return true; }
    return false;
  });
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

  // ===== #8 — Settings sub-pages =====================================
  // Profile, Sidebar gestures, Backup, Topic notes and Legal each collapse
  // to a single row card on the main list and open into a focused sub-page
  // (same pattern as Themes). Opening tags <html> with .nav-fwd for ~420ms
  // so the sub-page's anim-fadeup becomes the shared-axis forward slide
  // (sharedAxisIn 0.28s ease-in-out — see font-styles), matching the drawer.
  const openSub = (name) => {
    try {
      document.documentElement.classList.add('nav-fwd');
      setTimeout(() => { try { document.documentElement.classList.remove('nav-fwd'); } catch (e) {} }, 420);
    } catch (e) {}
    setSubPage(name);
  };
  const closeSub = () => setSubPage(null);

  const SubPageCard = ({ icon: Icon, iconBg, title, sub, onClick, tip }) => {
    const card = (
      <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onClick}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg || T.primary }}>
            <Icon size={18} color="#FFF" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium" style={{ color: T.ink }}>{title}</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>{sub}</div>
          </div>
          <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0" />
        </div>
      </Card>
    );
    return tip ? <Tip title={title} text={tip}>{card}</Tip> : card;
  };

  // Reset + Share — shown to guests inline, and inside the Profile sub-page
  // for logged-in users (so it's reachable from one place either way).
  const renderReset = () => (
    <>
      <Card className="mb-3 p-0 overflow-hidden">
        <button onClick={() => requestConfirm({
                  icon: <Trash2 size={20} style={{ color: '#E5484D' }} />,
                  title: `Reset ${profile ? `${profile.displayName}'s` : "this profile's"} data?`,
                  body: "This permanently deletes progress, bookmarks, stats, and custom questions for this profile only. Other profiles are untouched. This cannot be undone — consider downloading a backup first (Settings → Backup).",
                  confirmLabel: 'Reset data',
                  cancelLabel: 'Cancel',
                  tone: 'danger',
                  confirmWord: 'RESET',
                  onConfirm: () => onClearAll(),
                })}
                className="no-tap-highlight w-full flex items-center gap-3 p-3.5 text-left active:bg-black/5 transition-colors">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.errorSoft }}>
            <Trash2 size={16} style={{ color: T.error }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm" style={{ color: T.error }}>Reset this profile's data</div>
            <div className="text-[11px] mt-0.5" style={{ color: T.error, opacity: 0.65 }}>
              Permanently deletes progress, bookmarks, stats &amp; custom questions
            </div>
          </div>
        </button>
      </Card>
    </>
  );

  const renderProfileSub = () => (
    <>
      {profile && (
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
              style={{ background: T.primary, border: 'none' }}
              onClick={() => { if (onRenameProfile) { requestRename({ profile, onRename: onRenameProfile }); } }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <User size={20} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="font-display text-lg font-semibold truncate" style={{ color: '#FFF' }}>{profile.displayName}</div>
                {onRenameProfile && <Edit3 size={14} style={{ color: 'rgba(255,255,255,0.7)' }} className="flex-shrink-0" />}
              </div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {onRenameProfile ? 'Tap to rename · syncs across devices' : 'Logged in · syncs across devices'}
              </div>
            </div>
          </div>
        </Card>
      )}
      {/* BUG-06 — Account ID. Shown here so anyone can copy their id and send
          it to the owner to be granted admin access (the owner adds it in
          Admin → Manage admins). The owner sees their own id here too. */}
      {accountId && (
        <Card className="p-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '15' }}>
              <Fingerprint size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Account ID</div>
              <div className="font-mono text-[13px] truncate" style={{ color: T.ink }}>{accountId}</div>
            </div>
            <button onClick={copyAccountId}
                    className="no-tap-highlight flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 active:scale-95 transition"
                    style={{ background: idCopied ? T.success + '18' : T.surfaceWarm, border: `1px solid ${idCopied ? T.success : T.border}`, color: idCopied ? T.success : T.inkSoft }}
                    aria-label="Copy account ID">
              {idCopied ? <Check size={14} /> : <Copy size={14} />}{idCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="text-[11px] leading-relaxed mt-2.5" style={{ color: T.muted }}>
            Share this with the app owner to be made an admin. {isAdmin ? "You're an admin — manage others in Admin → Manage admins." : ''}
          </div>
        </Card>
      )}
      {/* FEAT-05 — cross-device sync reassurance. The app already syncs every
          profile to the account (broker + security-question recovery), so the
          "restore on a new device" story is just: sign in again. Stated plainly
          here instead of adding a weaker redundant 6-digit-key path. */}
      {profile && !profile.isGuest && (
        <Card className="p-3.5 mb-3" style={{ background: T.successSoft, border: `1px solid ${T.success}30` }}>
          <div className="flex items-start gap-2.5">
            <RefreshCw size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
            <div className="text-[12px] leading-relaxed" style={{ color: T.inkSoft }}>
              <span className="font-semibold" style={{ color: T.ink }}>Backed up &amp; synced.</span> Your progress is saved to your account. On a new phone or laptop, just sign in with the same name &amp; password — everything restores automatically.
            </div>
          </div>
        </Card>
      )}
      {profile && !profile.isGuest && (
        <div className="mb-3"><ComparisonToggle /></div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Card className="p-3 cursor-pointer no-tap-highlight pressable"
              onClick={() => requestConfirm({
                icon: <RefreshCw size={18} style={{ color: T.primary }} />,
                title: 'Switch profile?',
                body: 'You will be moved to a different profile. Your current progress is saved.',
                confirmLabel: 'Switch', cancelLabel: 'Cancel', tone: 'primary',
                onConfirm: () => onSwitchProfile(),
              })}>
          <RefreshCw size={16} style={{ color: T.success }} />
          <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Switch</div>
          <div className="text-[10px]" style={{ color: T.muted }}>Use a different profile</div>
        </Card>
        <Card className="p-3 cursor-pointer no-tap-highlight pressable"
              onClick={() => requestConfirm({
                icon: <LogOut size={18} style={{ color: T.error }} />,
                title: 'Log out of this profile?',
                body: 'Your progress is saved and you can log back in anytime. Nothing is deleted.',
                confirmLabel: 'Log out', cancelLabel: 'Cancel', tone: 'danger',
                onConfirm: () => onLogout(),
              })}>
          <LogOut size={16} style={{ color: '#D4900A' }} />
          <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Log out</div>
          <div className="text-[10px]" style={{ color: T.muted }}>End session on this device</div>
        </Card>
      </div>
      {/* NEW-02 — Study profile (optional, editable any time). Anything skipped
          during onboarding can be set here, like the optional recovery email. */}
      {profile && <StudyProfileCard demographics={data.demographics} onSave={onSetDemographics} />}
      {/* Fix 6 — Account Security (logged-in only; the Profile sub-page is only
          reachable when signed in). One-time recovery question + optional email. */}
      {profile && <AccountSecurityCard profile={profile} />}
      {renderReset()}
    </>
  );

  const renderGesturesSub = () => (
    <>
      <div className="text-xs mb-3" style={{ color: T.muted }}>
        Choose how the sidebar opens and closes. Tapping the backdrop to close is always on.
      </div>
      <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={() => flipGesture('close')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
              <Hand size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0">
              <div className="font-medium" style={{ color: T.ink }}>Swipe to close sidebar</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                {gestures.close
                  ? 'Swipe left anywhere while the sidebar is open to close it'
                  : 'Off — you can still close it by tapping the backdrop or the menu icon'}
              </div>
            </div>
          </div>
          <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
               style={{ background: gestures.close ? T.success : T.border }}>
            <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                 style={{ transform: gestures.close ? 'translateX(20px)' : 'translateX(0)' }} />
          </div>
        </div>
      </Card>
      <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={() => flipGesture('open')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.accent + '15' }}>
              <Hand size={18} style={{ color: T.accent, transform: 'scaleX(-1)' }} />
            </div>
            <div className="min-w-0">
              <div className="font-medium" style={{ color: T.ink }}>Swipe to open sidebar</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                Swipe right <b>anywhere on the home screen</b> to open the sidebar — phone, tablet and iOS.
              </div>
            </div>
          </div>
          <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
               style={{ background: gestures.open ? T.success : T.border }}>
            <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                 style={{ transform: gestures.open ? 'translateX(20px)' : 'translateX(0)' }} />
          </div>
        </div>
      </Card>
      <Card className="p-4 mb-3" style={{ opacity: 0.75 }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.surfaceWarm }}>
              <Lock size={16} style={{ color: T.muted }} />
            </div>
            <div className="min-w-0">
              <div className="font-medium" style={{ color: T.ink }}>Tap backdrop to close</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>Always on — cannot be disabled</div>
            </div>
          </div>
          <div className="w-11 h-6 rounded-full p-0.5 flex-shrink-0" style={{ background: T.success, opacity: 0.5 }}>
            <div className="w-5 h-5 rounded-full bg-white shadow" style={{ transform: 'translateX(20px)' }} />
          </div>
        </div>
      </Card>
    </>
  );

  const renderBackupSub = () => (
    <>
      <div className="text-xs mb-3" style={{ color: T.muted }}>
        Your profile already syncs across devices via your account. A local backup file is an extra safety net.
      </div>
      <Card className="p-4 mb-2 cursor-pointer no-tap-highlight pressable" onClick={handleExport}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
            <Download size={18} style={{ color: T.primary }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium" style={{ color: T.ink }}>Download backup</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>This profile's questions, history, stats, bookmarks</div>
          </div>
          <ChevronRight size={18} style={{ color: T.muted }} />
        </div>
      </Card>
      <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={handleImportClick}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.accent + '15' }}>
            <Upload size={18} style={{ color: T.accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium" style={{ color: T.ink }}>Restore from backup</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>Replace this profile's data with a saved file</div>
          </div>
          <ChevronRight size={18} style={{ color: T.muted }} />
        </div>
      </Card>
      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
      {importMsg && (
        <Card className="p-3 mb-3 anim-fadeup"
              style={{ background: importMsg.ok ? T.successSoft : T.errorSoft, border: `1px solid ${importMsg.ok ? T.success : T.error}40` }}>
          <div className="text-sm" style={{ color: importMsg.ok ? T.success : T.error }}>{importMsg.text}</div>
        </Card>
      )}
    </>
  );

  const renderTopicNotesSub = () => (
    <>
      <div className="text-xs mb-3" style={{ color: T.muted }}>
        The notes you pin to topics on the Knowledge Map. Export to back them up or share your mnemonics; import merges into your existing notes.
      </div>
      <Card className="p-4 mb-2 cursor-pointer no-tap-highlight pressable" onClick={handleNotesExport}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
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
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.accent + '15' }}>
            <Upload size={18} style={{ color: T.accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium" style={{ color: T.ink }}>Import notes</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>Merge notes from a file (newest kept per topic)</div>
          </div>
          <ChevronRight size={18} style={{ color: T.muted }} />
        </div>
      </Card>
      <input ref={notesFileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleNotesFile} />
      {notesMsg && (
        <Card className="p-3 mb-3 anim-fadeup"
              style={{ background: notesMsg.ok ? T.successSoft : T.errorSoft, border: `1px solid ${notesMsg.ok ? T.success : T.error}40` }}>
          <div className="text-sm" style={{ color: notesMsg.ok ? T.success : T.error }}>{notesMsg.text}</div>
        </Card>
      )}
    </>
  );

  const renderLegalSub = () => (
    <div className="space-y-2.5">
      <Card className="p-0 overflow-hidden">
        <button onClick={() => setLegalView('privacy')}
                className="no-tap-highlight w-full flex items-center gap-3 px-4 py-4 text-left active:bg-black/5 transition">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
            <Shield size={17} style={{ color: T.primary }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: T.ink }}>Privacy Policy</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>What we store and how it's used</div>
          </div>
          <ChevronRight size={18} style={{ color: T.muted }} />
        </button>
      </Card>
      <Card className="p-0 overflow-hidden">
        <button onClick={() => setLegalView('terms')}
                className="no-tap-highlight w-full flex items-center gap-3 px-4 py-4 text-left active:bg-black/5 transition">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
            <FileText size={17} style={{ color: T.primary }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium" style={{ color: T.ink }}>Terms of Use</div>
            <div className="text-xs mt-0.5" style={{ color: T.muted }}>The rules for using the app</div>
          </div>
          <ChevronRight size={18} style={{ color: T.muted }} />
        </button>
      </Card>
    </div>
  );

  const SUB_PAGES = {
    profile:  { title: 'Profile',          render: renderProfileSub },
    gestures: { title: 'Sidebar gestures', render: renderGesturesSub },
    backup:   { title: 'Backup',           render: renderBackupSub },
    notes:    { title: 'Topic notes',      render: renderTopicNotesSub },
    legal:    { title: 'Legal',            render: renderLegalSub },
  };

  if (legalView) return <LegalScreen doc={legalView} onBack={() => setLegalView(null)} />;

  // #8 — a focused sub-page (slides in with the shared-axis forward transition).
  if (subPage && SUB_PAGES[subPage]) {
    const sp = SUB_PAGES[subPage];
    return (
      <div className="anim-fadeup">
        <TopBar title={sp.title} onBack={closeSub} feedback={{ screen: `Settings · ${sp.title}`, noHelp: subPage === 'legal' }} />
        <div className="max-w-md mx-auto px-4 pt-4 pb-24">
          {sp.render()}
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fadeup">
      <TopBar title="Settings" onBack={onBack} feedback={{ screen: "Settings" }} />
      <div className="max-w-md mx-auto px-4 pt-4 pb-24">

        {/* Profile section */}
        {isGuest && (
          <>
            <div className="mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Account</div>
            <Tip title="Create a profile" text="Right now you’re a guest — your progress lives only on this device. Create a free profile to back it up and sync across phones.">
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
            </Tip>
            {/* Reset lives in the Account section for guests (a profile-level
                action), not under Share. */}
            {renderReset()}
          </>
        )}
        {!isGuest && profile && (
          <>
            <div className="mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Profile</div>
            <SubPageCard icon={User} iconBg={T.primary} title="Profile"
                         sub={`${profile.displayName} · rename, switch, backup, reset`}
                         tip="Rename yourself, switch to another profile on this device, back up your data, or reset this profile — all in one focused page."
                         onClick={() => openSub('profile')} />
          </>
        )}

        {/* "Share NORCET Prep" is now its OWN labelled section, clearly
            separated from the Profile/Account card above (own header + section
            spacing). For guests the Reset action renders below this section. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Share</div>
        <Tip title="Share NORCET Prep" text="Your personal invite — link, QR and a one-tap WhatsApp message. Friends who join through it appear on your leaderboard.">
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onOpenShare}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
              <Share2 size={18} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Share NORCET Prep</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                Your personal invite link, QR code &amp; WhatsApp share
              </div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0" />
          </div>
        </Card>
        </Tip>

        {/* #9 — "My feedback" has moved into the sidebar Feedback hub
            (Send feedback + My feedback live together there now). It is no
            longer duplicated here in Settings. */}

        {/* Custom-questions + Total-practice counters moved into the Library
            screen where they're contextually relevant (issues round). */}

        {/* Reminders — at the moment, just the spaced-revision card on Home.
            Toggling this off removes the green "Review due" card from Home
            entirely. The underlying spaced-repetition logic still runs — it
            just stops nudging her. */}
        {onToggleReviewReminders && (
          <>
            <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Reminders</div>
            <Tip title="Spaced revision" text="Spaced repetition is the biggest lever for long-term memory. This surfaces a ‘Review due’ card on Home exactly when each topic needs another pass.">
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
            </Tip>
          </>
        )}

        {/* P3 — Daily study reminder. Toggle requests Notification permission;
            when granted + on, a time picker appears. A best-effort local
            notification fires on app-open if the user hasn't studied past their
            chosen time (see setDailyReminder + the reminder effect in App). */}
        {onSetDailyReminder && (
          <>
            <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Notifications</div>
            <Tip title="Daily reminders" text="A gentle once-a-day nudge if you haven’t studied by your chosen time — the simplest way to keep a streak alive.">
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
            </Tip>

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
            <Tip title="What counts in stats" text="GK and Aptitude aren’t part of the NORCET nursing core, so they’re left out of your accuracy and weak areas by default. Turn on only if you drill them on purpose.">
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
            </Tip>
          </>
        )}

        {/* F-B — pull-to-refresh sound toggle. Local pref; respects the device
            media volume (a web app can't read the hardware mute switch). */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Sound</div>
        <Tip title="Pull-to-refresh sound" text="A soft confirmation sound when you pull down to refresh. Purely cosmetic — turn it off for silent refreshes.">
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
        </Tip>

        {/* Appearance → renamed "Themes", now a DEDICATED SUB-PAGE (issues
            round). The full mode selector + colour picker moved to
            screens/themes.jsx; Settings keeps this single row. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Themes</div>
        <Tip title="Themes" text="Switch between light and dark, and pick an accent colour palette for the whole app.">
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onOpenThemes}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.accent})` }}>
              <Palette size={18} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Themes</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                {themeMode === 'dark' ? 'Dark mode' : 'Light mode'} {'\u00b7'} pick a mode and colour palette
              </div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0" />
          </div>
        </Card>
        </Tip>

        {/* #8 — Sidebar gestures now open in a focused sub-page. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Sidebar gestures</div>
        <SubPageCard icon={Hand} iconBg={T.primary} title="Sidebar gestures"
                     sub="Swipe to open or close the sidebar"
                     tip="Choose how the sidebar opens and closes — swipe right anywhere on Home to open it, swipe left to close. Tapping the backdrop always closes."
                     onClick={() => openSub('gestures')} />

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

        {/* #8 — Backup opens in a focused sub-page. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Backup</div>
        <SubPageCard icon={Download} iconBg={T.primary} title="Backup"
                     sub="Download a backup file, or restore from one"
                     tip="Download a full backup of everything on this profile, or restore from one. Your safety net before switching phones or clearing the browser."
                     onClick={() => openSub('backup')} />

        {/* #8 — Topic notes export/import opens in a focused sub-page.
            Shown to everyone, incl. guests (they accumulate local notes via the
            Knowledge Map and this is how they back them up / move them). */}
        <div className="mt-6 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Topic notes</div>
        <SubPageCard icon={FileText} iconBg={T.primary} title="Topic notes"
                     sub="Export or import your Knowledge Map notes"
                     tip="Export or import just your Knowledge-Map notes — your mnemonics and reminders — separately from a full backup. Works for guests too."
                     onClick={() => openSub('notes')} />

        {/* [admin-app separation] The Settings admin section (unlock admin +
            Open Admin Panel) was removed. Admin now lives in the standalone
            admin app (admin.html) — the student app has no admin entry. */}

        {/* FAV — Favourites: opt-in home-screen strip of hearted sections.
            OFF by default; hearts always save regardless, so flipping this on
            instantly reveals everything collected so far. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Favourites</div>
        <Card className="p-4 mb-2 cursor-pointer no-tap-highlight pressable" onClick={flipFavs}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#E0245E18' }}>
                <Heart size={18} fill={favs && favs.enabled ? '#E0245E' : 'none'} style={{ color: '#E0245E' }} />
              </div>
              <div className="min-w-0">
                <div className="font-medium" style={{ color: T.ink }}>Favourites</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                  {favs && favs.enabled
                    ? `On — heart icons are visible across the app. ${favs.order.length === 0 ? 'Heart some sections to pin them to your home screen.' : `${favs.order.length} favourite${favs.order.length === 1 ? '' : 's'} at the top of your home screen.`}`
                    : 'Off — heart icons are hidden everywhere. Turn this on to show them and pin your favourite sections to home.'}
                </div>
              </div>
            </div>
            <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                 style={{ background: favs && favs.enabled ? T.success : T.border }}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                   style={{ transform: favs && favs.enabled ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
          </div>
        </Card>
        {/* Fix 3 — Manage favourites + Priority order only appear when the
            Favourites toggle is ON; when it's OFF they're hidden entirely.
            Issue 11 — these two now do DIFFERENT things: Manage favourites opens
            the Add picker (add sections); Priority order opens reorder/remove. */}
        {onOpenFavorites && favs && favs.enabled && (() => {
          const FavRow = ({ icon: Icon, label, sub, onClick }) => (
            <Card className="p-3.5 mb-2 cursor-pointer no-tap-highlight pressable"
                  onClick={onClick}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: '#E0245E18' }}>
                    <Icon size={16} style={{ color: '#E0245E' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium" style={{ color: T.ink }}>{label}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{sub}</div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: T.muted, opacity: 0.7 }} className="flex-shrink-0" />
              </div>
            </Card>
          );
          return (
            <>
              <FavRow icon={Heart} label="Manage favourites" sub="Add sections to your one-stop list"
                      onClick={onManageFavorites || onOpenFavorites} />
              <FavRow icon={ArrowUpDown} label="Priority order" sub="Reorder how they appear on home"
                      onClick={onOpenFavorites} />
            </>
          );
        })()}

        {/* #29 — Tests: the single control for the post-test Crib Sheet. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Tests</div>
        <Card className="p-4 mb-1 cursor-pointer no-tap-highlight pressable" onClick={flipCrib}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
                <FileText size={18} style={{ color: T.primary }} />
              </div>
              <div className="min-w-0">
                <div className="font-medium" style={{ color: T.ink }}>Show Crib Sheet after tests</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                  {cribOn
                    ? 'Review correct, wrong, and missed questions after every test'
                    : 'Crib Sheet is hidden — results screen only after tests'}
                </div>
              </div>
            </div>
            <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                 style={{ background: cribOn ? T.success : T.border }}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                   style={{ transform: cribOn ? 'translateX(20px)' : 'translateX(0)' }} />
            </div>
          </div>
        </Card>
        <div className="text-[11px] leading-relaxed mb-3 px-2" style={{ color: T.muted }}>
          The Crib Sheet shows every question with correct answers and explanations — like a PYQ booklet. You can also share it.
        </div>

        {/* #16 — Legal. Privacy Policy + Terms as sub-pages (rendered by the
            legalView sub-view above). Sits just above Support. */}
        {/* #8 — Legal opens in a focused sub-page listing Privacy + Terms. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Legal</div>
        <SubPageCard icon={Shield} iconBg={T.primary} title="Legal"
                     tip="Read the Privacy Policy and Terms of Use — what's stored, how it's used, and the simple rules of the app."
                     sub="Privacy Policy and Terms of Use"
                     onClick={() => openSub('legal')} />

        {/* P9 / step 33 — "Support the app" section. Quiet, always visible,
            below all functional settings. Opens the shared support modal
            (buy-me-a-chai / UPI). Non-transactional, no "donate" wording. */}
        {/* #27 + #20 — Share & support: the two "help this project" cards.
            The support card is visually ELEVATED (primary-tinted fill, heavier
            border, tinted icon block) so it reads as a warm highlight among
            the utilitarian rows — same logic as the Admin card's green tint. */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Support</div>
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={() => requestSupport()}
              ariaLabel="Support the app"
              style={{ background: T.primary + '0E', border: `1.5px solid ${T.primary}45`, borderRadius: 14 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '20' }}>
              <Heart size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.primary }}>Keep NORCET Prep free {'\u2615'}</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                Free and ad-free {'\u00b7'} buy me a chai to help with server costs
              </div>
            </div>
            <ChevronRight size={18} style={{ color: T.primary, opacity: 0.7 }} />
          </div>
        </Card>

        {/* P19 — build-version string so users (and you) can confirm which
            build is live. __APP_VERSION__ is injected by vite.config.js;
            the typeof guard keeps it from throwing outside a Vite build. */}
        <div className="mt-8 mb-2 text-center" style={{ color: T.muted, fontSize: 11, opacity: 0.75 }}>
          Version: {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
        </div>
      </div>

      {/* Issues round — Log out confirm: a TRUE CENTRED modal (fixed overlay,
          vertical+horizontal centre of the viewport, dimmed backdrop —
          visible no matter how far Settings is scrolled). Button hierarchy
          fixed: Log out = red danger primary, Cancel = quiet secondary. */}
      {/* Log out / Switch / Reset all open via the app-root requestConfirm
          host, so the dialog always centres on the VISIBLE page (e.g. the
          Profile sub-page) and is never anchored to a transformed ancestor. */}
    </div>
  );
}

export default Settings;
