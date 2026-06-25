import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import {
  BarChart3,
  X,
  Flame,
  Settings as SettingsIcon,
  Layers,
  AlertTriangle,
  Pause, Square,
  FlaskConical, Menu,
  Pill as PillIcon, ArrowRightLeft, HeartPulse, History,
  Network, Plus
} from 'lucide-react';
// #1 — recharts is NOT used in App.jsx (this import was dead). recharts now
// lives only inside the lazily-loaded chart screens (StatsScreen, weightage),
// so the recharts-vendor chunk is fetched on demand, not in the initial load.
import { KEYS, KEY_PREFIXES } from './lib/keys.js';
import { loadRepeatPool, saveRepeatPool, nextPool, partitionByRepeat } from './lib/repeat-unattempted.js';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './lib/migrations.js';
// P7 — 501 pre-extracted official AIIMS NORCET PYQs across 6 papers, in the
// real SEED_QUESTIONS schema. Imported (never inlined) to keep App.jsx lean.
import { PREVIOUS_YEAR_PAPERS } from './norcet-pyq-data.js';
import { compactData, needsCompaction, attemptStats, hasBeenSeen, COMPACTION_SIZE_THRESHOLD } from './lib/compact.js';
import { masteryTally } from './lib/kmap.js';
import { log, setLogContext } from './lib/log.js';
import * as kvStorage from './storage';
import { normalizeUserData, guestBlobHasActivity, mergeGuestIntoAccount } from './lib/merge.js';
import {
  GUEST_ID, makeGuestProfile, isGuestProfile, saveGuestData, loadGuestData,
  loadGuestMeta, saveGuestMeta, clearGuestData, loadProfile,
  loadProfileCached, saveProfile, clearPendingSync, flushPendingSync,
  loadOneProfileMeta, saveProfileMeta, loadProfileIndex,
  touchProfileActivity, createProfile, authenticateProfile,
  recoverPasswordWithDob, loadSession, saveSession, peekLegacyData,
  renameCredentials, deleteCredentials
} from './lib/profiles.js';
import { referralCodeFor, getPendingBatch, clearPendingBatch } from './lib/referral.js';
import { BatchJoinModal } from './ui/comparison-cards.jsx';
// [A1 step 35 / Pipeline] session-2 infra extraction. APPLY IN FULL REPO:
// src/lib/safe-storage.js + src/lib/profile-crypto.js ship alongside this file.
// Build-verified here only via esbuild-bundle with stubs. The rest of session 2
// (the profile/guest/merge subsystem) and the UI primitives (Pill/Button/TopBar
// read the render-mutated T — coupled to A7) are intentionally NOT in this step.
import { STORAGE_OP_TIMEOUT_MS, raceStorage, safeStorage, checkStorageBridge } from './lib/safe-storage.js';
import { normalizeProfileId, genSalt, hashPassword } from './lib/profile-crypto.js';
// [A1 step 34 / Pipeline] Extracted foundational modules. APPLY IN FULL REPO:
// these two files (src/lib/utils.js, src/data/seed.js) ship ALONGSIDE this file;
// the combination is build-verified here only via esbuild-bundle with stubs,
// since lib/*, storage.js, norcet-pyq-data.js & public/data/*.json aren't in
// this single-file bundle. Run a real `npm run build` after applying. Themes
// (T/IS_DARK) intentionally NOT extracted yet — coupled to A7 (next step).
import {
  todayStr, spacedRepetitionNext, arraysEqualUnordered, shuffle, parseCsvLine,
  normalizeStem, stemSimilarity, getISOWeek
} from './lib/utils.js';
// [A1 slice 49 / tidy-up] quick-practice selection logic extracted.
import { selectQuickPracticeQuestions, selectBalancedQuestions } from './lib/quick-practice.js';
import { examTopicWeightage } from './lib/weightage.js';
import { captureError, setErrorContext } from './lib/errorlog.js';
import { initAnalytics, trackScreen } from './lib/analytics.js';
// BUG-01 — unified back-button interception for screens with internal sub-views.
import { runTopBackHandler } from './lib/back-handler.js';
// NEW-02 — onboarding demographics default (UR / Open-Merit percentile).
import { DEFAULT_TARGET_PERCENTILE } from './lib/demographics.js';
// Phase 3 A2 — light non-monetary economy (Accuracy Coins + Clinical Hearts).
import { normalizeEconomy, claimWhyBonus as claimWhyBonusPure } from './lib/economy.js';
import {
  TOPICS, NON_EXAM_TOPICS, isNonExamTopic, countsInNursingStats,
  SEED_QUESTIONS, DEFAULT_DATA
} from './data/seed.js';
// [A7 step 36 / Pipeline] Context layer. APPLY IN FULL REPO: src/lib/app-context.jsx
// ships alongside this file. <AppProviders> wraps every App return branch and
// feeds the live theme/profile/data state through React context; useTheme /
// useProfile are consumed here by the leaf primitives (Pill/Button/TopBar) and
// the former CURRENT_PROFILE consumer. The bulk of in-screen `T` reads still use
// the transitional module-level bridge below and migrate to these hooks as each
// screen is extracted (A1 sessions 3-4, steps 37-38 — A7 is coupled to A1).
import { AppProviders, useTheme, useProfile } from './lib/app-context.jsx';

// [A1 s3 / Pipeline step 37] Extracted leaf primitives, helpers & setup/stats
// screens. App keeps only the symbols its remaining (un-extracted) screens use.
import { isPYQ } from './lib/pyq.js';
// [A1 slice 45] topics.js no longer referenced by App — AdminPanel was App's last consumer of topicName/topicColor/topicIcon/getWeakTopics.
import { useFocusTrap } from './lib/use-focus-trap.js';
// [A1 slice 45] helpful-votes.js no longer referenced by App — loadHelpfulnessReport was used only by AdminPanel (now in admin-panel.jsx).
import { requestHelp } from './ui/primitives.jsx';
import MockSetup from './screens/MockSetup.jsx';
import TopicSelect from './screens/TopicSelect.jsx';
import QuickPracticeSetup from './screens/QuickPracticeSetup.jsx';
import WeakAreasScreen from './screens/WeakAreasScreen.jsx';
const StatsScreen = lazy(() => import('./screens/StatsScreen.jsx'));

// [A1 s4 / Pipeline step 38] batch 1b slice 1 — Results cluster extracted.
// Results is dispatched here.
import Results from './screens/Results.jsx';
// [A1 slice 43] result-cards (GuestSavePrompt/MotivationCard/ShareScoreButton/
// TimeQuadrant) + question-widgets (HelpfulToggle/QuestionImage) imports removed:
// the AdvancedTest trio was App's last renderer of them; they now live entirely
// in ./screens/advanced-test.jsx (and the other extracted screens that use them).
import { ConfirmExitDialog } from './ui/confirm-exit-dialog.jsx';
import { useContent, prefetchAllContent } from './lib/content.js';
import { ContentGate } from './ui/content-gate.jsx';
import { Reference, ReferenceLookupModal } from './screens/reference.jsx';
import Quiz from './screens/quiz.jsx';
import { NavDrawer } from './ui/nav-drawer.jsx';
import Home from './screens/home.jsx';
import { getDueQuestions } from './lib/selectors.js';
// [F-D] weak-topic ranking for Quick Revision.
import { getWeakTopics } from './lib/topics.js';
// [A1 s4 / batch 1b slice 11] bank permission helpers + Library screen extracted.
import { isBankOwner, canSeeBank } from './lib/banks.js';
// [A1 slice 48 / tidy-up] bank shared-storage CRUD extracted.
import { listBanks, loadBank, saveBank, deleteBank, setBankVisibility } from './lib/banks-storage.js';
import Library from './screens/library.jsx';
// [A1 slice 12] mindmap note storage + serialization extracted.
import {
  NOTE_MAX_LEN, sanitizeNoteText, loadMindmapNotes, saveMindmapNotes,
  mindmapNoteMatch
} from './lib/notes.js';
// [A1 slice 13] Settings screen + its config/channel deps extracted.
import Settings from './screens/settings.jsx';
import { LIGHT_THEMES } from './lib/light-themes.js';
// [A1 slice 20] base theme palettes extracted.
import { LIGHT_THEME, DARK_THEME } from './lib/themes.js';
// [A1 slice 42] shared global stylesheet extracted (fonts/anims/token utils).
import { fontStyles } from './lib/font-styles.js';
// [A1 slice 45] format.js no longer referenced by App — fmtWhen was used only by AdminPanel (now in admin-panel.jsx).
// [A1 slice 25] theme-derived colour helpers (pure fns for App bridge wrappers).
// [A1 slice 47] theme-helpers.js import removed — App's last uses (fgOnDarkFor via
// fgOnDark, statusMetaFor via feedbackStatusMeta) were dead bridge wrappers, now
// deleted. The hooks (useFgOnDark/useStatusMeta) live in the screens that use them.
import WelcomeScreen from './screens/welcome.jsx';
// Issues round — new dedicated sub-pages split out of Settings.
import ShareAppScreen from './screens/share-app.jsx';
import ThemesScreen from './screens/themes.jsx';
// [A1 slice 14] PreviousPapers screen extracted.
import PreviousPapers from './screens/previous-papers.jsx';
// #17 — PYQ Read Mode (calm reading interface over the same paper data).
import PyqRead from './screens/pyq-read.jsx';
// #28 — post-test Crib Sheet (PDF-like review of a finished session).
import CribSheet from './screens/crib-sheet.jsx';
// FAV — Favourites manage screen (one-stop list + priority reorder).
import FavoritesScreen from './screens/favorites.jsx';
// [A1 slice 15] DosageResults screen extracted.
import DosageResults from './screens/dosage-results.jsx';
// [A1 slice 29] DosagePractice extracted (T+isDark; useContent; no fgOnDark).
import DosagePractice from './screens/dosage-practice.jsx';
// [A1 slice 30] BookmarksScreen extracted (data+allQuestions->useData; useFgOnDark).
import BookmarksScreen from './screens/bookmarks.jsx';
// [A1 slice 31] RevisionSheet (+PRINT_STYLES) extracted (data+allQuestions->useData).
const RevisionSheet = lazy(() => import('./screens/revision-sheet.jsx'));
const StudyPlan = lazy(() => import('./screens/study-plan.jsx'));
// [A1 slice 33] MindmapNodePopup extracted (T+useFgOnDark; imports lib/kmap).
import MindmapNodePopup from './screens/mindmap-node-popup.jsx';
// [A1 slice 34] KnowledgeMap (+its mindmap subsystem) extracted (data/allQuestions->useData, profileId->useProfile, T/IS_DARK/fgOnDark via hooks; imports lib/kmap + the popup).
// #1 — code-split: heavy, non-initial route screens load on demand (React.lazy
// + Suspense). KnowledgeMap is the single biggest screen; StatsScreen and
// weightage carry the recharts dependency; admin-panel + coverage-map are
// large admin/analysis routes. None are reachable from first paint.
const KnowledgeMap = lazy(() => import('./screens/knowledge-map.jsx'));
// [F-A] Study Methods section.
import StudyMethods from './screens/study-methods.jsx';
// [#11] Drill Tests — consolidated test-mode hub.
import DrillTests from './screens/drill-tests.jsx';
// [F-B] Global pull-to-refresh overlay.
import PullToRefresh from './ui/pull-to-refresh.jsx';
// #30 — Home back-press exit confirmation pill.
import ExitConfirmDialog from './ui/exit-snackbar.jsx';
// TIP — hold/hover tooltip host (one bubble, app root, viewport-fixed).
import { TipHost } from './ui/tooltip.jsx';
// [F-E] Doubts review screen.
import DoubtsScreen from './screens/doubts.jsx';
// [F-F] FAQ section (user side).
const FAQScreen = lazy(() => import('./screens/faq.jsx'));
// [A1 slice 35] WeightageScreen extracted (data/allQuestions->useData; papers stays a prop).
const WeightageScreen = lazy(() => import('./screens/weightage.jsx'));
// [A1 slice 36] CoverageMap extracted (data/allQuestions->useData).
const CoverageMap = lazy(() => import('./screens/coverage-map.jsx'));
// [A1 slice 37] support modal extracted (its QR encoder lives in ./lib/qr.js, used internally there).
import SupportHost from './screens/support-modal.jsx';
// [A1 slice 38] feedback report dialog extracted (host pattern).
import FeedbackHost from './screens/feedback-modal.jsx';
// [A1 slice 39] help guide dialog extracted (host pattern).
import HelpHost from './screens/help-modal.jsx';
// #7 — app-root confirmation dialog host (un-bookmark caution, etc.).
import ConfirmHost from './ui/confirm-host.jsx';
// [A1 slice 40] rename-profile host extracted.
import RenameProfileHost from './screens/rename-profile-host.jsx';
// [A1 slice 45] ReportedQuestionModal no longer referenced by App — rendered only inside the extracted AdminPanel.
// [A1 slice 42] AuthScreen (+ its single-consumer clearLegacyData) extracted.
import AuthScreen from './screens/auth-screen.jsx';
// [A1 slice 43] the timed-test trio (Setup/Test/Results) extracted.
import { AdvancedTestSetup, AdvancedTest, AdvancedTestResults } from './screens/advanced-test.jsx';
// [A1 slice 44] question-bank detail + editor pair extracted (+ the two single-consumer EXAMPLE_QUESTIONS_* payloads).
import { BankDetail, BankEditor } from './screens/bank-screens.jsx';
// [A1 slice 45] AdminPanel (admin hub) extracted; admin user helpers passed as props.
const AdminPanel = lazy(() => import('./screens/admin-panel.jsx'));

// #1 — shown briefly while a lazily-loaded screen's chunk is fetched. After
// the first visit these chunks are precached by the service worker, so this
// is essentially instant on subsequent opens.
function LazyScreenFallback() {
  const { theme: T } = useTheme();
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: T.bg }}>
      <div className="w-9 h-9 rounded-full animate-spin"
           style={{ border: `3px solid ${T.borderSoft || T.border}`, borderTopColor: T.primary }} />
    </div>
  );
}
// [A1 slice 46] UpdateToast (PWA update prompt) extracted — the last inline component.
import UpdateToast from './screens/update-toast.jsx';
// [A1 slice 34] kmap.js is no longer imported by App — its only consumers are now
// the extracted knowledge-map.jsx + mindmap-node-popup.jsx screens.
// [A1 slice 16] leaderboard storage cluster + Leaderboard screen extracted.
import { saveLeaderboardEntry } from './lib/leaderboard.js';
const LeaderboardScreen = lazy(() => import('./screens/leaderboard.jsx'));
// [A1 slice 17] shared question parsing/validation extracted.
import { processQuestionInput, validateQuestionFields } from './lib/question-import.js';
import BulkImport from './screens/bulk-import.jsx';
// [A1 slice 18] SignInGate, GuestMergePrompt, WelcomeScreen extracted.
import SignInGate from './screens/sign-in-gate.jsx';
import GuestMergePrompt from './screens/guest-merge-prompt.jsx';
// [A1 slice 19] DatePicker, RenameProfileModal, AdminTile extracted.
import DatePicker from './screens/date-picker.jsx';
// FEAT-02 — the standalone Exam Date route is gone; Study Plan embeds the
// ExamDateEditor instead. exam-date-screen.jsx is still imported there.
import AddQuestion from './screens/add-question.jsx';
import MindmapNoteEditor from './screens/mindmap-note-editor.jsx';
// [A1 slice 24] feedback inbox storage extracted.
import {
  saveFeedback, listFeedback, deleteFeedback, FEEDBACK_STATUSES,
  loadMyFeedbackIndex, saveMyFeedbackIndex
} from './lib/feedback.js';
import FeedbackInbox from './screens/feedback-inbox.jsx';
// [A1 slice 26] LearnTopics extracted. [A1 slice 45] AdminFeedbackCard no longer referenced by App (now used only inside AdminPanel).
import LearnTopics from './screens/learn-topics.jsx';
import MyReports from './screens/my-reports.jsx';
// [A1 slice 28] LearnCards extracted (pairs with LearnTopics; useFgOnDark).
import LearnCards from './screens/learn-cards.jsx';
// Session 2, Feature 6 — in-app notification inbox + its storage helpers.
import NotificationCenter from './screens/notification-center.jsx';
import { loadNotifications, pushNotification } from './lib/notifications.js';
// #18 — question solution flags: auto-resolve on a later correct answer.
import { loadQDoubts, saveQDoubts, autoResolveQDoubts } from './lib/qdoubts.js';
import { topicName } from './lib/topics.js';
// #21/#29 — sidebar gesture + crib-sheet preferences (per-device).
import { loadUiPrefs, isCribSheetEnabled } from './lib/ui-prefs.js';
// [F-E] stale-doubt nudge.
import { loadDoubts as loadDoubtsForNudge, staleUnresolvedCount } from './lib/doubts.js';
// [A1 slice 45] AdminTile no longer referenced by App (now used only inside AdminPanel).

// =====================================================================
// ERROR BOUNDARY (Pipeline step 1 / A3; "Reset device data" added at P1)
// Catches render-time crashes anywhere below App and shows a friendly
// recovery screen instead of a white page. Self-contained: styles are
// hardcoded (not theme-aware) so the fallback still works even if
// context/state is broken.
//
// Reset device data is now ENABLED because P1 (cloud sync) ships the
// canonical progress copy to Supabase. Wiping the local cache only
// drops the device-side mirror; the next sign-in pulls fresh data
// from Supabase. We keep a strong confirm() because losing unsynced
// offline writes is still a real risk if the user is offline at the
// moment of reset.
// =====================================================================
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, wiping: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // A10: report through the structured logger. log.error never throws
    // and, in prod, ships the breadcrumb ring buffer to Supabase. We
    // also attach the React component stack as the detail tail.
    try {
      const stack = (info && info.componentStack) ? String(info.componentStack).slice(0, 2000) : '';
      log.error('errorBoundary.render', error);
      if (stack) log.warn('errorBoundary.componentStack', stack);
      // #29 — also record into the grouped, admin-visible crash store (a React
      // render crash is the highest-severity kind).
      captureError(error, { source: 'react', severity: 'crash', stack });
    } catch (e) { /* logger is fail-safe; nothing more to do */ }
  }
  handleReload = () => {
    try { window.location.reload(); } catch (e) {}
  };
  handleResetScreen = () => {
    try { window.dispatchEvent(new CustomEvent('norcet:reset-screen')); } catch (e) {}
    this.setState({ hasError: false, error: null });
  };
  handleResetDeviceData = async () => {
    // Strong confirm — last line of defence against an accidental tap.
    // If the user is offline, any local writes that haven't synced yet
    // will be lost; the confirm copy says so explicitly.
    const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
    const msg = offline
      ? "You're currently OFFLINE. This will sign you out and delete all locally cached data on this device. Any progress from this offline session that hasn't synced to the cloud yet will be LOST. Continue?"
      : "This will sign you out and clear all locally cached data on this device. Your progress is backed up to the cloud and will reload when you sign in again. Continue?";
    if (!window.confirm(msg)) return;
    this.setState({ wiping: true });
    try {
      // Drop the session pointer first so a partial wipe still leaves
      // the user logged out on next boot (safer than half-wiping cache
      // but leaving the session intact).
      try { await safeStorage.delete(KEYS.SESSION, false); } catch (e) {}
      // All per-profile local caches (added in P1).
      try {
        const listed = await safeStorage.list(KEY_PREFIXES.USERDATA, false);
        const keys = (listed && listed.keys) || [];
        await Promise.all(keys.map(k => safeStorage.delete(k, false).catch(() => {})));
      } catch (e) {}
      // Pending-sync map + admin lock + storage canary.
      try { await safeStorage.delete(KEYS.PENDING_SYNC, false); } catch (e) {}
      try { await safeStorage.delete(KEYS.ADMIN_STATUS, false); } catch (e) {}
      try { await safeStorage.delete(KEYS.HEALTH, false); } catch (e) {}
      // Intentionally LEFT alone: KEYS.THEME (cosmetic), ONBOARDING
      // prefix (already-seen flags). The user's actual progress lives
      // in Supabase under profile:<id>, untouched.
    } finally {
      // Hard reload so React state is fully reset and boot path
      // re-runs against the cleared cache.
      try { window.location.reload(); } catch (e) {}
    }
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    const err = this.state.error;
    const msg = (err && (err.message || String(err))) || 'Unknown error';
    return (
      <div role="alert" style={{
        minHeight: '100vh', background: '#FBF7ED', color: '#1A2B23',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: 480, width: '100%', background: '#FFFFFF',
          borderRadius: 16, padding: 28,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid #E5DFC9', boxSizing: 'border-box'
        }}>
          <div style={{ fontSize: 40, marginBottom: 8, lineHeight: 1 }}>😕</div>
          <h1 style={{ fontSize: 22, margin: '0 0 8px 0', fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#3A4A40', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            The app hit a render error. Your progress is safe — it&apos;s
            backed up to the cloud. Try one of the options below.
          </p>
          <details style={{
            background: '#F5EFDF', borderRadius: 8, padding: 10,
            marginBottom: 16, fontSize: 12, color: '#7A7263'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Technical details</summary>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: '8px 0 0 0', fontFamily: 'ui-monospace, monospace', fontSize: 11
            }}>{msg}</pre>
          </details>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={this.handleReload} disabled={this.state.wiping} style={{
              padding: '12px 16px', background: '#0F4C4C', color: '#FFFFFF',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: this.state.wiping ? 'wait' : 'pointer', width: '100%',
              opacity: this.state.wiping ? 0.6 : 1
            }}>Reload app</button>
            <button onClick={this.handleResetScreen} disabled={this.state.wiping} style={{
              padding: '12px 16px', background: '#FFFFFF', color: '#0F4C4C',
              border: '1.5px solid #0F4C4C', borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: this.state.wiping ? 'wait' : 'pointer', width: '100%',
              opacity: this.state.wiping ? 0.6 : 1
            }}>Go back to Home</button>
            <button onClick={this.handleResetDeviceData} disabled={this.state.wiping} style={{
              padding: '10px 16px', background: 'transparent', color: '#9B5050',
              border: '1px dashed #C9A0A0', borderRadius: 10, fontSize: 13, fontWeight: 500,
              cursor: this.state.wiping ? 'wait' : 'pointer', width: '100%',
              marginTop: 4, opacity: this.state.wiping ? 0.6 : 1
            }}>{this.state.wiping ? 'Clearing…' : 'Reset device data (last resort)'}</button>
          </div>
          <p style={{ fontSize: 11, color: '#7A7263', marginTop: 14, marginBottom: 0, textAlign: 'center' }}>
            Still stuck? Close and reopen the app.
          </p>
        </div>
      </div>
    );
  }
}

// =====================================================================
// THEME
// =====================================================================
// [A1 slice 20] LIGHT_THEME + DARK_THEME palettes moved to ./lib/themes.js (imported below).

// ── BLOOM — dusty rose / mauve ──────────────────────────────────────────────
const BLOOM_THEME = {
  bg: '#FDF5F7',
  surface: '#FFFFFF',
  surfaceWarm: '#F8EAF0',
  ink: '#261822',
  inkSoft: '#42303C',
  muted: '#8A6A78',
  primary: '#8E3D60',
  primarySoft: '#AA5078',
  accent: '#C07848',
  accentSoft: '#D89060',
  success: '#4A7A5A',
  successSoft: '#E8F3EC',
  error: '#B84040',
  errorSoft: '#FAE8E8',
  border: '#EACDD8',
  borderSoft: '#F2DFEA',
  sec: {
    quick:    '#8E3D60',
    topic:    '#C07848',
    mock:     '#4A7A5A',
    advanced: '#261822',
    learn:    '#7A4A5A',
    revision: '#5A4A8A',
    library:  '#3A6A5A',
    stats:    '#5A6A90',
  }
};

// ── DUSK — soft lavender / violet ────────────────────────────────────────────
const DUSK_THEME = {
  bg: '#F5F3FB',
  surface: '#FFFFFF',
  surfaceWarm: '#EDE8F8',
  ink: '#1C1828',
  inkSoft: '#342E48',
  muted: '#786E90',
  primary: '#5C4A9A',
  primarySoft: '#7060B0',
  accent: '#9A5A78',
  accentSoft: '#B87090',
  success: '#4A7A5A',
  successSoft: '#E8F3EC',
  error: '#A03848',
  errorSoft: '#F5E5E8',
  border: '#D0C8F0',
  borderSoft: '#E5E0F8',
  sec: {
    quick:    '#5C4A9A',
    topic:    '#9A5A78',
    mock:     '#4A7A5A',
    advanced: '#1C1828',
    learn:    '#7A5A3A',
    revision: '#8A6AB0',
    library:  '#3A6A5A',
    stats:    '#4A6A9A',
  }
};

// ── MEADOW — sage / soft forest green ────────────────────────────────────────
const MEADOW_THEME = {
  bg: '#F2F6F2',
  surface: '#FFFFFF',
  surfaceWarm: '#E4EEE4',
  ink: '#182218',
  inkSoft: '#2E3E2E',
  muted: '#6A7A6A',
  primary: '#3E6848',
  primarySoft: '#508A5C',
  accent: '#8A6A3A',
  accentSoft: '#A88050',
  success: '#3A7A4A',
  successSoft: '#E5F3E8',
  error: '#9A3838',
  errorSoft: '#F5E5E5',
  border: '#C5D8C5',
  borderSoft: '#D8E8D8',
  sec: {
    quick:    '#3E6848',
    topic:    '#8A6A3A',
    mock:     '#3A7A6A',
    advanced: '#182218',
    learn:    '#5A4A3A',
    revision: '#5A4A7A',
    library:  '#4A6A3A',
    stats:    '#3A5A7A',
  }
};

// ── AZURE — vivid ocean blue / electric teal ─────────────────────────────────
const AZURE_THEME = {
  bg: '#F4FCFF', surface: '#FFFFFF', surfaceWarm: '#DDEEF8',
  ink: '#001A2E', inkSoft: '#0A2D45', muted: '#4A7A90',
  primary: '#0080FF', primarySoft: '#2E9FFF',
  accent: '#E07000', accentSoft: '#F08A00',
  success: '#1B7A3E', successSoft: '#E5F5EC',
  error: '#C41E3A', errorSoft: '#FDE8EC',
  border: '#9AD8F0', borderSoft: '#CBF0FF',
  sec: { quick:'#0080FF', topic:'#E07000', mock:'#1B7A3E', advanced:'#001A2E', learn:'#0055D4', revision:'#6A2FA0', library:'#007A6A', stats:'#005AC0' }
};

// ── AMETHYST — electric violet / vivid purple ─────────────────────────────────
const AMETHYST_THEME = {
  bg: '#FAF6FF', surface: '#FFFFFF', surfaceWarm: '#EDE0FF',
  ink: '#14002E', inkSoft: '#280050', muted: '#7A5A9A',
  primary: '#8B00FF', primarySoft: '#A830FF',
  accent: '#C8840A', accentSoft: '#E09A10',
  success: '#1A7A40', successSoft: '#E5F5EC',
  error: '#B8001E', errorSoft: '#FFE8EC',
  border: '#D4AAFF', borderSoft: '#EADAFF',
  sec: { quick:'#8B00FF', topic:'#C8840A', mock:'#1A7A40', advanced:'#14002E', learn:'#A020E0', revision:'#6000C0', library:'#007A6A', stats:'#0050A0' }
};

// ── FUCHSIA — vivid hot pink / electric magenta ───────────────────────────────
const FUCHSIA_THEME = {
  bg: '#FFF5FA', surface: '#FFFFFF', surfaceWarm: '#FFE0F0',
  ink: '#2A0015', inkSoft: '#450025', muted: '#9A5070',
  primary: '#E8007A', primarySoft: '#FF2090',
  accent: '#6A00CC', accentSoft: '#8820E0',
  success: '#1A7A3A', successSoft: '#E5F5EC',
  error: '#CC001A', errorSoft: '#FFE5EA',
  border: '#FFB0D8', borderSoft: '#FFD5EC',
  sec: { quick:'#E8007A', topic:'#6A00CC', mock:'#1A7A3A', advanced:'#2A0015', learn:'#FF2090', revision:'#8820E0', library:'#007A6A', stats:'#0050A0' }
};

// ── JADE — vivid emerald / bright forest green ────────────────────────────────
const JADE_THEME = {
  bg: '#F2FDF7', surface: '#FFFFFF', surfaceWarm: '#D4F5E4',
  ink: '#001810', inkSoft: '#042E1A', muted: '#3A7A58',
  primary: '#00A84A', primarySoft: '#00CC5A',
  accent: '#8A00C0', accentSoft: '#A820E0',
  success: '#006830', successSoft: '#D5F2E3',
  error: '#C0001E', errorSoft: '#FFE5EA',
  border: '#7ADCAA', borderSoft: '#BAEECE',
  sec: { quick:'#00A84A', topic:'#8A00C0', mock:'#006830', advanced:'#001810', learn:'#00CC5A', revision:'#00608A', library:'#005A80', stats:'#2A6A9A' }
};

// ── MIDNIGHT — newspaper · pure white, only blacks & greys ───────────────────
// Strictly zero hue. Every token is a shade of grey between #000 and #FFF.
// Correct/wrong feedback uses value contrast: near-black = correct, mid-grey = wrong.
// NOT IS_DARK — it is a light-family theme (themeMode !== 'dark').
const MIDNIGHT_THEME = {
  bg: '#FFFFFF', surface: '#FFFFFF', surfaceWarm: '#F5F5F5',
  ink: '#000000', inkSoft: '#1A1A1A', muted: '#888888',
  primary: '#000000', primarySoft: '#222222',
  accent: '#555555', accentSoft: '#777777',
  success: '#111111', successSoft: '#EEEEEE',
  error: '#AAAAAA', errorSoft: '#F5F5F5',
  border: '#CCCCCC', borderSoft: '#E8E8E8',
  sec: { quick:'#000000', topic:'#333333', mock:'#555555', advanced:'#000000', learn:'#222222', revision:'#444444', library:'#666666', stats:'#333333' }
};

const THEMES = {
  light:   LIGHT_THEME,
  dark:    DARK_THEME,
  midnight: MIDNIGHT_THEME,
  bloom:   BLOOM_THEME,
  dusk:    DUSK_THEME,
  meadow:  MEADOW_THEME,
  azure:    AZURE_THEME,
  amethyst: AMETHYST_THEME,
  fuchsia:  FUCHSIA_THEME,
  jade:     JADE_THEME,
};

// [A1 slice 13] LIGHT_THEMES moved to ./lib/light-themes.js (imported below).

// [A1 slice 47] The module-level `let T` / `let IS_DARK` bridge is GONE. App now
// computes T/IS_DARK locally in its body (all screens use useTheme()).

// --- Dark-mode foreground helper -------------------------------------------
// A handful of brand/topic colours are intentionally deep so that hard-coded
// white text reads on them when they're used as a *fill*. When that SAME deep
// colour is reused as foreground (text/icon) on a dark surface it becomes
// unreadable. This lifts only colours that are genuinely too dark for a dark
// background; already-bright colours — and everything in light mode — pass
// through unchanged.
// [A1 slice 25] _dm* colour helpers + fgOnDark logic moved to
// ./lib/theme-helpers.js (fgOnDarkFor + useFgOnDark).
// [A1 slice 47] App's thin `fgOnDark` bridge wrapper deleted — it had no callers
// left once every screen moved to the useFgOnDark() hook.

// [A1 slice 42] fontStyles moved to ./lib/font-styles.js (imported above);
// shared by the App root mounts + the extracted AuthScreen.

// =====================================================================
// TOPICS
// =====================================================================
// [A1 step 34] TOPICS moved to ./data/seed.js

// P18 — General Knowledge (gk) + Reasoning & Aptitude (apt) are the
// NON-NURSING PYQ sections. They live in the NORMAL question pool, so Topic
// wise test and the PYQ filter pick them up automatically once content is
// added. But by default they must NOT count toward nursing accuracy, syllabus
// coverage, or exam-weightage totals — otherwise a strong GK score would
// flatter the user's apparent nursing readiness. Single source of truth so the
// stats screens and a future P14 weightage screen all exclude the SAME set.
// [A1 step 34] NON_EXAM_TOPICS / isNonExamTopic / countsInNursingStats moved to ./data/seed.js

// [A1 s4 / step 38] MOTIVATION_QUOTES + _lastQuoteText + pickQuoteForScore moved to ./ui/result-cards.jsx
// [A1 s4 / batch 1b slice 5] content loading layer extracted:
//   useContent + prefetchAllContent + loader -> ./lib/content.js
//   ContentGate -> ./ui/content-gate.jsx

// Liveness probe — kept so the boot code can still surface a "your progress
// won't be saved" banner if IndexedDB itself is unreachable (private mode in
// some old browsers, quota exhausted, etc.). In a healthy browser this
// resolves to true almost instantly.
// [A1 step 35] checkStorageBridge moved to ./lib/safe-storage.js

// One shared key PER user for the lightweight directory entry. Using a key per
// user removes the read-modify-write contention the old monolithic list had:
// two users signing in simultaneously can never overwrite each other's metadata.

// Convert a free-form display name into a safe storage id
// [A1 step 35] normalizeProfileId moved to ./lib/profile-crypto.js

// [A1 step 35] genSalt moved to ./lib/profile-crypto.js

// [A1 step 35] hashPassword moved to ./lib/profile-crypto.js

// =====================================================================
// LOAD / SAVE PROFILE — with offline resilience (Pipeline step 4 / P1)
// ---------------------------------------------------------------------
// Strategy: Supabase is the canonical store; IndexedDB is a per-device
// write-through cache. Every saveProfile writes BOTH layers so the user
// can keep working offline; on reconnect, anything that didn't reach
// Supabase is flushed up. Last-write-wins per profile is acceptable at
// this scale (10-50 beta users).
//
// PENDING_SYNC tracks which profileIds have local writes not yet
// confirmed in Supabase. It's keyed off the local IndexedDB only; the
// flush replays the cached blob to Supabase and clears the entry.
//
// We use raceStorage (not safeStorage) for the canonical Supabase write
// so we can distinguish "succeeded" from "timed out / errored", which
// safeStorage flattens to `null`. The cache write keeps using
// safeStorage — IndexedDB is local and never times out in practice.
// =====================================================================

// [A1 step 35] profile / session / guest-IO subsystem (loadProfile/saveProfile/
// createProfile/authenticateProfile/recoverPasswordWithDob/flushPendingSync + the
// PENDING_SYNC trio + profile-meta directory + session + guest local-IO +
// normalizeDob) moved VERBATIM to ./lib/profiles.js. renameProfile stays below
// (cross-subsystem orchestrator). See session-notes.

// =====================================================================
// GUEST MODE — PHASE B: sign-up MERGE of guest progress (step 27)
// ---------------------------------------------------------------------
// When a guest who has built up LOCAL progress signs up / logs in, we offer to
// MERGE that local blob into the (canonical, cloud) account blob. Rules, fixed
// against DEFAULT_DATA's real shape:
//   - The ACCOUNT is canonical and is NEVER regressed. Every field below is
//     folded ADDITIVELY (sum / max / set-union / concat), or the account value
//     simply wins. So an account that was already richer (e.g. used on another
//     device) can only ever gain from the merge, never lose.
//   - stats: SUM totalAttempted/totalCorrect; MAX streakCurrent/streakBest;
//     union dailyHistory by date (summing per-day counts, consistent with the
//     totals); most-recent lastStudiedDate; max lastCompactedTs; all other
//     scalars (examDate, dailyTarget, streakGraceAvailable, graceJustUsed)
//     keep the ACCOUNT value.
//   - history: union by qId; per question, concat+sort+dedupe attempts (by ts)
//     and recompute lastResult from the newest attempt; SR scheduling fields
//     (reviewCount/nextDue) follow whichever side attempted more recently.
//   - bookmarks: set-union. customQuestions: union by id (account wins ties).
//   - revisionLog: union by date (ids merged). advancedTestHistory: concat,
//     dedupe by ts, capped -50 (matches submitAdvancedTest). previousPapers:
//     per-paper concat (cap 20) with recomputed bestNet/lastTs/lastAccuracy.
//   - preferences: ACCOUNT wins entirely. bank*Seen maps: account wins, max on
//     shared numeric keys. disabledBanks / feedbackRepliesSeen: account wins
//     (guests can't import banks or file feedback, so theirs is empty anyway).
//   - dismissedAnnouncementId + any future scalar: account wins (via ...a base).
// Schema-neutral (stays v9); writes the merged blob the normal account way, so
// the existing saveProfile path syncs it to Supabase — correct, it's a real
// account now. No storage.js / package.json / schema change.
// =====================================================================
// [A1 step 35] guest-merge engine (normalizeUserData / guestBlobHasActivity /
// mergeGuestIntoAccount + _g* helpers) moved to ./lib/merge.js

// Rename a profile. Two cases:
//
//   CASE A — Cosmetic rename: the new name normalises to the SAME id as the
//   old one (e.g. "jyo deori" → "Jyo Deori" → both normalise to `jyodeori`).
//   Just update the displayName on the profile blob and metadata entry.
//   No keys change.
//
//   CASE B — Real rename: the new name normalises to a DIFFERENT id. Storage
//   keys (`profile:<id>`, `profilemeta:<id>`, `myfeedback:<id>`) and the
//   `ownerId` on any banks she owns plus the `profileId` on her feedback all
//   need to move.
//
// Strategy for Case B: WRITE the new keys first, VERIFY they're readable,
// then DELETE the old keys. If anything fails mid-way the worst case is
// duplicate data (recoverable by retry) — never silent data loss.
//
// Returns the updated profile.
async function renameProfile(profile, newDisplayName) {
  const trimmed = String(newDisplayName || '').trim();
  if (!trimmed) throw new Error('Enter a display name');
  const newId = normalizeProfileId(trimmed);
  if (!newId) throw new Error('Display name needs at least one letter or number');

  // Case A — same id, cosmetic only.
  if (newId === profile.id) {
    if (trimmed === profile.displayName) return profile; // nothing to do
    const updated = { ...profile, displayName: trimmed };
    await saveProfile(updated);
    const prevMeta = await loadOneProfileMeta(profile.id);
    await saveProfileMeta({
      ...(prevMeta || {}),
      id: profile.id,
      displayName: trimmed,
      createdAt: (prevMeta && prevMeta.createdAt) || profile.createdAt || Date.now(),
      lastActive: Date.now()
    });
    return updated;
  }

  // Case B — new id. Check for collisions.
  const collision = await loadProfile(newId);
  if (collision) {
    throw new Error('That name is already taken by another profile. Pick a different name.');
  }

  // 1) Write the renamed profile blob at the new key.
  const renamed = { ...profile, id: newId, displayName: trimmed };
  await saveProfile(renamed);

  // 2) Verify it landed before touching anything else. If this fails, we
  //    abort cleanly: nothing has been broken on the user's account yet.
  const verify = await loadProfile(newId);
  if (!verify || verify.id !== newId) {
    throw new Error("Couldn't save the new profile name. Try again.");
  }

  // 2.5) STAGE 1 — move the PROTECTED credential row to the new id. Credentials
  //      no longer live in the profile blob, so without this the renamed user
  //      would have no secret under their new id and couldn't log in. If it
  //      fails, roll back the just-written new blob and abort (old id is still
  //      fully intact, so the user can keep logging in with the old name).
  try {
    await renameCredentials(profile.id, newId, trimmed);
  } catch (e) {
    try { await safeStorage.delete(KEYS.profile(newId), true); } catch (_) {}
    try { await safeStorage.delete(KEYS.userdata(newId), false); } catch (_) {}
    throw e;
  }

  // 3) Write new metadata entry.
  const prevMeta = await loadOneProfileMeta(profile.id);
  await saveProfileMeta({
    id: newId,
    displayName: trimmed,
    createdAt: (prevMeta && prevMeta.createdAt) || profile.createdAt || Date.now(),
    lastActive: Date.now()
  });

  // 4) Move the per-user feedback index.
  try {
    const myIds = await loadMyFeedbackIndex(profile.id);
    if (myIds && myIds.length > 0) {
      await safeStorage.set(KEYS.myFeedback(newId), JSON.stringify(myIds), true);
    }
  } catch (e) { /* tolerate */ }

  // 5) Patch ownerId/ownerName on any banks she owns.
  try {
    const allBanks = await listBanks();
    const mine = allBanks.filter(b => b && b.ownerId === profile.id);
    await Promise.all(mine.map(b => saveBank({ ...b, ownerId: newId, ownerName: trimmed })));
  } catch (e) { /* tolerate — banks keep loading even with stale owner */ }

  // 6) Patch profileId/profileName on her feedback entries (shared storage).
  try {
    const all = await listFeedback();
    const hers = all.filter(f => f && f.profileId === profile.id);
    await Promise.all(hers.map(f => saveFeedback({ ...f, profileId: newId, profileName: trimmed })));
  } catch (e) { /* tolerate */ }

  // 7) Now safe to remove the old keys.
  try { await safeStorage.delete(KEYS.profile(profile.id), true); } catch (e) {}
  try { await safeStorage.delete(KEYS.profileMeta(profile.id), true); } catch (e) {}
  try { await safeStorage.delete(KEYS.myFeedback(profile.id), true); } catch (e) {}
  // P1 — clear the local cache + any pending-sync flag for the old id.
  try { await safeStorage.delete(KEYS.userdata(profile.id), false); } catch (e) {}
  try { await clearPendingSync(profile.id); } catch (e) {}

  return renamed;
}

// [A1 slice 42] clearLegacyData moved to ./screens/auth-screen.jsx (its only
// caller was AuthScreen's post-create one-time legacy wipe).

// =====================================================================
// PER-DEVICE PREFERENCES — theme mode + onboarding completion
// =====================================================================

async function loadThemeMode() {
  try {
    const r = await safeStorage.get(KEYS.THEME);
    if (r && r.value && THEMES[r.value]) return r.value;
  } catch (e) {}
  return 'light';
}

async function saveThemeMode(mode) {
  try { await safeStorage.set(KEYS.THEME, mode); } catch (e) {}
}

async function hasSeenOnboarding(profileId) {
  try {
    const r = await safeStorage.get(`${KEYS.ONBOARDING}:${profileId}`);
    return !!(r && r.value === '1');
  } catch (e) { return false; }
}

async function markOnboardingSeen(profileId) {
  try { await safeStorage.set(`${KEYS.ONBOARDING}:${profileId}`, '1'); } catch (e) {}
}

// ===== Session 5 — Web Push (opt-in, piggybacks on the daily reminder) =====
// The client VAPID public key is inlined by Vite at build time. When it's
// absent (push not configured), every helper below no-ops — so the existing
// local-reminder behaviour is byte-for-byte unchanged. The KV subscription id
// is cached per device so app-open pings can find the right record.
const VAPID_PUBLIC_KEY = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_VAPID_PUBLIC_KEY : undefined;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscribeToPush(reminderTime) {
  try {
    if (!VAPID_PUBLIC_KEY) return null;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return null;
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub, reminderTime: reminderTime || '20:00' }),
    });
    if (!res.ok) return null;
    const { id, token } = await res.json();
    if (id) {
      try { await safeStorage.set(KEYS.PUSH_SUB_ID, id); } catch (e) {}
      // C-5: store the capability token so pingActive can prove ownership.
      try { if (token) await safeStorage.set(KEYS.PUSH_SUB_TOKEN, token); } catch (e) {}
    }
    return id || null;
  } catch (e) { return null; }
}

async function pingActive() {
  try {
    if (!VAPID_PUBLIC_KEY) return;
    const r = await safeStorage.get(KEYS.PUSH_SUB_ID);
    const id = r && r.value;
    if (!id) return;
    let token = null;
    try { const t = await safeStorage.get(KEYS.PUSH_SUB_TOKEN); token = t && t.value; } catch (e) {}
    await fetch('/api/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: id, token }),
    });
  } catch (e) {}
}

// F-B — shape a raw stored/cloud data blob into the in-memory `data` object,
// mirroring the boot loader's merge + compaction. Pure (module scope) so
// pull-to-refresh can re-pull and re-commit WITHOUT re-running the fragile
// boot effect. Kept in sync with the boot's `loaded` shape.
function hydrateLoaded(rawData) {
  const migrated = runMigrations(rawData || {});
  const loaded = {
    ...DEFAULT_DATA,
    ...migrated,
    customQuestions: Array.isArray(migrated.customQuestions) ? migrated.customQuestions : DEFAULT_DATA.customQuestions,
    bookmarks: Array.isArray(migrated.bookmarks) ? migrated.bookmarks : DEFAULT_DATA.bookmarks,
    stats: { ...DEFAULT_DATA.stats, ...(migrated.stats || {}) },
    advancedTestHistory: migrated.advancedTestHistory || [],
    economy: { ...DEFAULT_DATA.economy, ...(migrated.economy || {}) },
    bankVersionsSeen: migrated.bankVersionsSeen || {},
    bankPublishedSeen: migrated.bankPublishedSeen || {},
    disabledBanks: migrated.disabledBanks || {},
    revisionLog: Array.isArray(migrated.revisionLog) ? migrated.revisionLog : DEFAULT_DATA.revisionLog,
    preferences: { ...DEFAULT_DATA.preferences, ...(migrated.preferences || {}) }
  };
  let out = loaded;
  try { if (needsCompaction(loaded)) out = compactData(loaded); } catch (e) {}
  return out;
}

// F-B — screens with custom full-screen gestures or timed flows where a
// pull-to-refresh would conflict or be harmful. PTR stays on everywhere else.
const PTR_DISABLED_SCREENS = new Set([
  'quiz', 'advanced-test', 'paper-test', 'dosage', 'knowledge-map', 'results',
  'advanced-results', 'paper-results', 'dosage-results',
  // Fix 1 — the Share screen has its own scrollable shareable text; PTR would
  // intercept the pull and interfere with scrolling it.
  'share-app',
]);

// =====================================================================
// FEEDBACK INBOX — shared storage; one key per report
// =====================================================================
// [A1 slice 24] feedback inbox storage (newFeedbackId, saveFeedback, listFeedback,
// deleteFeedback, FEEDBACK_STATUSES, updateFeedback, load/save/addToMyFeedbackIndex)
// moved to ./lib/feedback.js (imported above). feedbackStatusMeta stays (theme T).




// Admin reply + status live on the same feedback entry (kept lightweight).

// [A1 slice 25] feedbackStatusMeta logic moved to ./lib/theme-helpers.js
// (statusMetaFor + useStatusMeta).
// [A1 slice 47] App's thin `feedbackStatusMeta` bridge wrapper deleted — no
// callers remained once AdminFeedbackCard moved to the useStatusMeta() hook.

// Merge an admin reply/status onto an entry and persist it.

// ---- Per-user feedback index ----
// A small per-user pointer list so a device fetches only its OWN reports, rather
// than pulling the entire shared inbox down and filtering. Other users' feedback
// never reaches the device.



// [A1 s4 / batch 1b hook pass b] "was this helpful?" storage subsystem
// (helpful-vote keys + readIdList + loadHelpfulState/toggleHelpful/
// loadHelpfulnessReport) -> ./lib/helpful-votes.js

// [A1 s4 / batch 1b slice 3] helpfulThanksShownThisSession flag moved with HelpfulToggle -> ./ui/question-widgets.jsx

// =====================================================================
// LEADERBOARD (Pipeline step 20 / P4)  [shared keys]
// ---------------------------------------------------------------------
// One shared key per user: leaderboard:{profileId}. Upserted at the end of
// every study session (from the user's own stats) and read in bulk by the
// board screen. NEW shared kv keys only — the local `data` blob + schema (v9)
// are untouched, and the storage.js API / safeStorage shim are used as-is.
// =====================================================================
// [A1 slice 16] leaderboard storage (LEADERBOARD_PREFIX, leaderboardKey,
// weekStartStr, computeLeaderboardEntry, saveLeaderboardEntry, loadLeaderboard)
// moved to ./lib/leaderboard.js (saveLeaderboardEntry imported below).

// Record a freshly-submitted report against its author.

// A user's own reports. Steady state fetches ONLY this user's entries by id;
// other users' feedback never touches the device. A profile whose index doesn't
// exist yet (e.g. reports sent before this index existed) is backfilled once
// from the shared list, then never lists the full inbox again.
async function listMyFeedback(profileId) {
  if (!profileId) return [];
  let ids = await loadMyFeedbackIndex(profileId);

  if (ids === null) {
    const all = await listFeedback();              // one-time migration only
    ids = all.filter(f => f.profileId === profileId).map(f => f.id);
    await saveMyFeedbackIndex(profileId, ids);
  }

  const entries = await Promise.all(ids.map(async (id) => {
    try {
      const r = await safeStorage.get(KEYS.feedback(id), true);
      if (r && r.value) return JSON.parse(r.value);
    } catch (e) {}
    return null;                                   // deleted by admin → skip
  }));
  const live = entries.filter(Boolean);

  // Keep the index tidy if some reports were deleted.
  if (live.length !== ids.length) {
    await saveMyFeedbackIndex(profileId, live.map(f => f.id));
  }

  return live.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

// Replies the user hasn't acknowledged yet (entry replied/updated after last seen).
function unseenFeedbackReplies(myList, seenMap) {
  const seen = seenMap || {};
  return (myList || []).filter(f =>
    (f.reply || f.status) && f.repliedAt && f.repliedAt > (seen[f.id] || 0)
  );
}

// =====================================================================
// ADMIN — USER OVERVIEW  (privacy-preserving)
//   - Reads ONLY the lightweight shared directory (id/displayName/createdAt/
//     lastActive). It NEVER opens a user's profile blob, so it cannot expose
//     passwords, answers, history, or any private study data — by construction.
// =====================================================================
async function adminListUsers() {
  const list = await loadProfileIndex();
  return list
    .map(p => ({
      id: p.id,
      displayName: p.displayName || p.id,
      createdAt: p.createdAt || null,
      lastActive: p.lastActive || null
    }))
    .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
}

// Remove a profile entirely: deletes the private blob, the directory entry,
// the per-user feedback index, AND any feedback they submitted. Cascading the
// feedback delete avoids leaving "orphaned" reports referring to a name that
// no longer exists in the user list.
async function adminDeleteProfile(id) {
  if (!id) return;
  // 1) Their private blob + lightweight metadata
  try { await safeStorage.delete(KEYS.profile(id), true); } catch (e) {}
  try { await safeStorage.delete(KEYS.profileMeta(id), true); } catch (e) {}
  // 1a) STAGE 1 — their protected credential row, so the name can be reused.
  try { await deleteCredentials(id); } catch (e) {}
  // 1b) P1 — local cache + pending-sync flag (only matters if the admin
  //     is operating on their OWN device's cache; harmless no-op otherwise).
  try { await safeStorage.delete(KEYS.userdata(id), false); } catch (e) {}
  try { await clearPendingSync(id); } catch (e) {}
  // 2) Their per-user feedback index pointer
  try { await safeStorage.delete(KEYS.myFeedback(id), true); } catch (e) {}
  // 3) Every feedback report they authored
  try {
    const all = await listFeedback();
    const theirs = all.filter(f => f && f.profileId === id);
    await Promise.all(theirs.map(f => deleteFeedback(f.id)));
  } catch (e) {}
  // 4) Every bank they uploaded (otherwise it lingers in shared storage with
  //    a dangling ownerId). canSeeBank handles missing owners, but we should
  //    not leave orphaned shared data behind.
  try {
    const allBanks = await listBanks();
    const theirs = allBanks.filter(b => b && b.ownerId === id);
    await Promise.all(theirs.map(b => deleteBank(b.id)));
  } catch (e) {}
}

// =====================================================================
// ANNOUNCEMENTS — a single current notice, shared with every user
//   - One shared key holds the active notice { id, text, ts }.
//   - Posting a new notice replaces the old one (and gets a fresh id so every
//     user sees it again). Clearing removes it.
//   - Each user records the id they dismissed in their OWN data, so dismissal
//     is per-user and private.
// =====================================================================

async function loadAnnouncement() {
  try {
    const r = await safeStorage.get(KEYS.ANNOUNCEMENT, true);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      // #12 — expiry-aware: a notice past its expiresAt simply stops showing
      // for everyone (no admin trip needed; history still keeps the record).
      if (parsed && parsed.text) {
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
        return parsed;
      }
    }
  } catch (e) { /* none */ }
  return null;
}

// #12 — announcement HISTORY (shared, admin-write key 'announcement:history'
// — same announcement:* RLS prefix). Newest first, capped at 30.
const ANN_HISTORY_KEY = 'announcement:history';
async function loadAnnouncementHistory() {
  try {
    const r = await safeStorage.get(ANN_HISTORY_KEY, true);
    const v = r && r.value ? JSON.parse(r.value) : [];
    return Array.isArray(v) ? v.filter(a => a && a.id && a.text) : [];
  } catch (e) { return []; }
}

// A4→Stage 2: announcement WRITES are admin-only and go through the kv-write
// broker (which authorizes them by the admin's session token, server-side).
// `loadAnnouncement` (read) stays on safeStorage — reads are open to everyone.
// The `adminProfileId` argument is retained for call-site compatibility but the
// real check is the token; a DevTools-patched isAdmin buys nothing.
async function saveAnnouncement(text, level, adminProfileId, expiresDays = null) {
  // Two urgency levels:
  //  - 'info'      → calm teal card; default for routine notices.
  //  - 'important' → terracotta with an alert icon; for time-sensitive items
  //                  (schedule changes, exam reminders) so users notice.
  // #12 — optional auto-expiry (1/3/7/30 days, or null = until cleared) so a
  // notice never lingers as a permanent fixture; every post is appended to
  // the shared history for the admin to audit/delete later.
  const lv = level === 'important' ? 'important' : 'info';
  const days = Number(expiresDays);
  const entry = {
    id: `ann-${Date.now()}`, text: String(text || '').trim(), level: lv, ts: Date.now(),
    expiresAt: Number.isFinite(days) && days > 0 ? Date.now() + days * 86400000 : null,
  };
  await adminWriteShared(KEYS.ANNOUNCEMENT, JSON.stringify(entry), adminProfileId);
  try {
    const hist = await loadAnnouncementHistory();
    await adminWriteShared(ANN_HISTORY_KEY, JSON.stringify([entry, ...hist].slice(0, 30)), adminProfileId);
  } catch (e) { /* history is best-effort */ }
  return entry;
}

async function deleteAnnouncementHistoryItem(id, adminProfileId) {
  const hist = await loadAnnouncementHistory();
  await adminWriteShared(ANN_HISTORY_KEY, JSON.stringify(hist.filter(a => a.id !== id)), adminProfileId);
}

async function clearAnnouncementHistory(adminProfileId) {
  await adminWriteShared(ANN_HISTORY_KEY, JSON.stringify([]), adminProfileId);
}

async function clearAnnouncement(adminProfileId) {
  // The shared-DELETE broker is rejected server-side even for admins (only the
  // upsert/write path is authorized), so a real delete always failed ("server
  // rejected the write"). Instead OVERWRITE the key with an inactive tombstone
  // via the SAME write path posting uses: empty text makes loadAnnouncement()
  // return null, so the notice stops showing for everyone immediately — and the
  // record is preserved, not destroyed (the full text also stays in history).
  await adminWriteShared(KEYS.ANNOUNCEMENT, JSON.stringify({
    id: `ann-cleared-${Date.now()}`, text: '', level: 'info',
    ts: Date.now(), expiresAt: null, cleared: true,
  }), adminProfileId);
}

// =====================================================================
// ADMIN UNLOCK  (Pipeline step 6 / A4 — server-side trust boundary)
//   Before A4: passphrase was the entire gate. Hash + salt are baked
//   into the JS bundle and the check happened client-side; any user
//   could patch `isAdmin = true` in DevTools and then write to
//   `announcement:current` directly against PostgREST because the
//   kv_shared write policy was open-anon. Security theatre.
//
//   After A4: passphrase is a UX gate only (so a casual tap doesn't
//   pop the unlock UI). The REAL check is server-side:
//     1) `checkServerAdmin(profileId)` reads the `admin_profile_ids`
//        table on Supabase — anon-readable, service-role-writable.
//     2) Admin-only writes (announcement create/clear) go via
//        `adminWriteShared` / `adminDeleteShared`, which POST/DELETE
//        directly to PostgREST with an `x-profile-id` header. The
//        kv_shared RLS policy reads that header and only permits the
//        write if the profile id is in `admin_profile_ids`.
//   Local `KEYS.ADMIN_STATUS` is now a UX cache so admin stays
//   unlocked between reloads without re-typing — boot re-verifies
//   against the server (see the useEffect in App) and silently
//   downgrades on failure. Offline: stays admin from cache; next
//   online boot re-verifies.
//
//   To CHANGE the admin passphrase: it is NOT in the frontend anymore. Rotate
//   the Supabase secret instead:  supabase secrets set ADMIN_PASSPHRASE="new"
//   (the `admin-manage` Edge Function verifies it server-side). Note: rotating
//   the passphrase does not add or remove anyone's admin power — that's the
//   `admin_profile_ids` allow-list, managed via the in-app panel / Edge Function.
// =====================================================================

// Server-side passphrase check: POSTs the typed passphrase to the admin-manage
// Edge Function (action "verify"), which compares it to the ADMIN_PASSPHRASE
// secret and returns { ok }. No passphrase or hash lives in the frontend.
// Throws on network/config failure so the caller can show an "offline" message
// rather than a false "wrong passphrase".
async function verifyAdminPassphrase(passphrase) {
  if (!passphrase) return false;
  if (!SUPABASE_URL_FOR_ADMIN || !SUPABASE_ANON_KEY_FOR_ADMIN) {
    throw new Error('admin verify unavailable');
  }
  const r = await fetch(`${SUPABASE_URL_FOR_ADMIN}/functions/v1/admin-manage`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY_FOR_ADMIN,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY_FOR_ADMIN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'verify', passphrase }),
  });
  if (!r.ok) throw new Error(`verify failed: ${r.status}`);
  const j = await r.json();
  return !!(j && j.ok === true);
}

// A4: Supabase config. Vite injects these at build time from .env / Vercel
// env vars. If your env-var names differ, change the two strings below — they
// are the ONLY references in App.jsx. Reads return `undefined` if unset.
const SUPABASE_URL_FOR_ADMIN = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL : undefined;
const SUPABASE_ANON_KEY_FOR_ADMIN = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

// A4: Returns true iff `profileId` appears in the Supabase `admin_profile_ids`
// table. Never throws — any network / parse / config failure resolves to false
// (fail-closed: a broken admin check should reject, not grant).
async function checkServerAdmin(profileId, uid) {
  if (!profileId && !uid) return false;
  if (!SUPABASE_URL_FOR_ADMIN || !SUPABASE_ANON_KEY_FOR_ADMIN) return false;
  try {
    // Match EITHER the (name-derived) slug id OR the permanent uid, so existing
    // slug-based allow-list rows keep working while you migrate to uids, and a
    // renamed admin (whose slug changed) stays admin via their uid.
    const ids = [profileId, uid].filter(Boolean).map(encodeURIComponent);
    const url = `${SUPABASE_URL_FOR_ADMIN}/rest/v1/admin_profile_ids`
      + `?profile_id=in.(${ids.join(',')})&select=profile_id`;
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY_FOR_ADMIN,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY_FOR_ADMIN}`,
        'Accept': 'application/json',
      },
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    return false;
  }
}

// A4: Direct PostgREST upsert for admin-only keys (currently: announcement:*).
// Bypasses safeStorage so we can attach the `x-profile-id` header that the new
// RLS policy on kv_shared inspects. Throws on non-2xx so the caller can show
// a real error to the user (the safeStorage helpers swallow failures, which
// would be wrong here — a silent failure would corrupt the admin's mental
// model of what they just did).
// A4→Stage 2: admin-only writes (announcement:*) now go through the SAME
// write broker as everything else (kv-write), which authorizes them by the
// admin's session token against `admin_profile_ids` server-side. The old
// `x-profile-id` header path is gone (it was never actually enforced by any
// RLS policy, and the header was spoofable). The broker throws on failure, so
// these still surface real errors to the admin instead of swallowing them.
// `adminProfileId` is retained in the signature for call-site compatibility
// but is no longer used — identity comes from the token.
async function adminWriteShared(key, valueJson, adminProfileId) {
  await safeStorage.setSharedStrict(key, valueJson);
}

async function adminDeleteShared(key, adminProfileId) {
  await safeStorage.delSharedStrict(key);
}

// A4: ADMIN_STATUS local cache is a UX shortcut so admin stays unlocked
// across reloads. Truthfulness is verified server-side by the boot re-verify
// effect; this read can be stale until that runs.
async function loadAdminStatus() {
  try {
    const result = await safeStorage.get(KEYS.ADMIN_STATUS);
    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      return parsed && parsed.unlocked === true;
    }
  } catch (e) { /* not unlocked */ }
  return false;
}

async function saveAdminStatus(unlocked) {
  if (unlocked) {
    await safeStorage.set(KEYS.ADMIN_STATUS, JSON.stringify({ unlocked: true, ts: Date.now() }));
  } else {
    try { await safeStorage.delete(KEYS.ADMIN_STATUS); } catch (e) {}
  }
}

// =====================================================================
// QUESTION BANK LIBRARY
//   - Each bank is one shared-storage key: bank:<id>
//   - No central index — banks discovered by listing the "bank:" prefix
//   - ANY logged-in user can upload a bank and choose its visibility:
//       • public  → everyone can browse, import, and practise it
//       • private → only the creator (and admin) can see / use it
//   - The creator may toggle their OWN bank's visibility (not content).
//   - ONLY the admin can EDIT or DELETE any bank, and can override the
//     visibility of any bank.
//   - Banks carry: ownerId, ownerName, visibility, version, createdAt, updatedAt.
//   - Legacy banks with no visibility are treated as PUBLIC.
// =====================================================================

// [A1 s4 / slice 11] newBankId, bankVisibility, isBankOwner, canSeeBank moved
// to ./lib/banks.js (imported above). The storage-bound bank ops below
// (listBanks/loadBank/saveBank/deleteBank/setBankVisibility) stay here.

// [A1 slice 48 / tidy-up] listBanks/loadBank/saveBank/deleteBank/setBankVisibility moved to ./lib/banks-storage.js (imported above) — pure shared-storage CRUD, no longer App-local.

// =====================================================================
// HELPERS
// =====================================================================
// [A1 step 34] todayStr moved to ./lib/utils.js

// [A1 step 34] spacedRepetitionNext moved to ./lib/utils.js

// [A1 step 34] arraysEqualUnordered moved to ./lib/utils.js

// [A1 s3] topicName/topicColor/topicIcon/getWeakTopics → lib/topics.js

// [A1 s4 / batch 1b slice 8] getDueQuestions -> ./lib/selectors.js

// [A1 step 34] shuffle moved to ./lib/utils.js

// =====================================================================
// QUICK PRACTICE SELECTION
//   Orders a pool so practice feels fresh and useful:
//   1. UNSEEN questions first (shuffled), so new material leads.
//   2. Then seen questions ordered by "need" — wrong/overdue/stale rank
//      high; recently-and-consistently-correct rank low.
//   Picking distinct items from this single ordered list guarantees no
//   repeats within a session; across sessions the ordering shifts as
//   history updates, so least-recently-seen / weakest items surface first.
// =====================================================================
// [A1 slice 49 / tidy-up] lastSeenTs/quickNeedScore/selectQuickPracticeQuestions moved to ./lib/quick-practice.js (imported above) — pure selection logic, no longer App-local.

// Parses a single CSV line, handling quoted fields with embedded commas and escaped quotes.
// [A1 step 34] parseCsvLine moved to ./lib/utils.js

// Download a string as a file in the browser
// [A1 step 34] downloadAsFile moved to ./lib/utils.js

// =====================================================================
// SHARED QUESTION INPUT — parsing + validation
// Used by both the per-user bulk import and the admin bank uploader,
// so format and rules stay identical across both code paths.
// =====================================================================

// [A1 slice 17] validateQuestionFields, normalizeQuestion, parseQuestionInput,
// processQuestionInput moved to ./lib/question-import.js (processQuestionInput +
// validateQuestionFields imported below; parse/normalize stay internal there).

// [A1 slice 44] EXAMPLE_QUESTIONS_JSON + EXAMPLE_QUESTIONS_CSV moved to ./screens/bank-screens.jsx (single-consumer: only BankEditor used them).

// =====================================================================
// DUPLICATE DETECTION — used by bank upload to flag possible duplicates
// =====================================================================
// Normalize a stem: lowercase, drop punctuation, collapse whitespace,
// strip leading question numbers like "Q.1" or "1)".
// [A1 step 34] normalizeStem moved to ./lib/utils.js

// Word-set Jaccard similarity (1.0 = identical words, 0 = nothing in common).
// Cheap, predictable, good enough for spotting near-duplicate stems.
// [A1 step 34] stemSimilarity moved to ./lib/utils.js

const DUPLICATE_THRESHOLD = 0.75;  // 75% word-overlap → flag

// Returns { match, similarity } if a likely duplicate is found in pool, else null.
function findDuplicateStem(newQ, pool) {
  let bestMatch = null;
  let bestScore = 0;
  for (const ex of pool) {
    const s = stemSimilarity(newQ.q, ex.q);
    if (s > bestScore) { bestScore = s; bestMatch = ex; }
  }
  if (bestMatch && bestScore >= DUPLICATE_THRESHOLD) {
    return { match: bestMatch, similarity: bestScore };
  }
  return null;
}

// =====================================================================
// COMPONENTS
// =====================================================================

// [A1 s4 / batch 1b hook pass] useFocusTrap -> ./lib/use-focus-trap.js

// [A1 s3] Pill → ui/primitives.jsx

// [A1 s3] PyqBadge → ui/primitives.jsx

// P8 — quiet inline "Was this helpful?" toggle shown beneath an explanation.
// Three states (silent / helpful / notHelpful) backed by two shared keys.
// Hidden entirely when there's no profile or no explanation to evaluate.
// [A1 s4 / batch 1b slice 3] HelpfulToggle -> ./ui/question-widgets.jsx

// [A1 s3] Card → ui/primitives.jsx

// [A1 s3] Button → ui/primitives.jsx

// =====================================================================
// QUESTION IMAGE  (Pipeline step 15 / P17)
// ---------------------------------------------------------------------
// Many real NORCET PYQs are image-dependent ("identify the instrument /
// tube / ECG strip / X-ray"). A question may carry an OPTIONAL `image`
// field holding a public URL (or a base64 data URI). Rendered between the
// stem and the options in every quiz/test/review surface.
//
// HOSTING: store images in a PUBLIC Supabase Storage bucket named
// `pyq-images`, then put the public URL in the question's `image` field:
//     1. Supabase dashboard → Storage → New bucket → name `pyq-images`,
//        toggle "Public bucket" ON.
//     2. Upload the image; copy its public URL
//        (https://<project>.supabase.co/storage/v1/object/public/pyq-images/<file>).
//     3. Set  image: "<that URL>"  on the question object (built-in array
//        or an uploaded bank — the importer preserves the field).
// FALLBACK: a base64 data URI also works in `image`, but it bloats the
// bundle/bank-row size — prefer the bucket for anything but a quick test.
//
// Renders nothing when `image` is absent (text-only questions unchanged).
// On load failure it shows a quiet placeholder and still leaves the
// options fully usable, so a dead URL never blocks answering.
// [A1 s4 / batch 1b slice 2] QuestionImage -> ./ui/question-widgets.jsx

// [A1 s3] TopBar → ui/primitives.jsx

// =====================================================================
// NAV DRAWER — slide-in "collapsible sidebar" for secondary destinations.
//   Keeps the home screen calm: study tools & utilities live in here behind
//   the menu button, grouped so they're easy to scan.
// =====================================================================
// [A1 s4 / batch 1b slice 8] NavDrawer -> ./ui/nav-drawer.jsx

// =====================================================================
// SUPPORT THE APP (P9) — UPI "buy me a chai" dialog + QR encoder extracted.
// [A1 slice 37] SupportHost/SupportModal + QRCode + buildUpiLink + DONATE_*
//   -> ./screens/support-modal.jsx ; pure QR encoder -> ./lib/qr.js (imported above).
// [A1 s4 / batch 1b slice 9] DONATE_DISMISSED_KEY/DONATE_HOME_GATE + loadDonateDismissed/
//   saveDonateDismissed + support-opener channel -> ./ui/home-support-nudge.jsx / ./ui/primitives.jsx
// =====================================================================

// Subtle Home card — only after >=100 questions answered, dismissible
// forever (donatedismissed:v1, shared:false). Self-contained: loads its
// own dismissal on mount so Home's props/nav switch stay untouched.
// [A1 s4 / batch 1b slice 9] HomeSupportNudge -> ./ui/home-support-nudge.jsx

// =====================================================================
// HOME
// =====================================================================
// [A1 s4 / batch 1b slice 10] Home -> ./screens/home.jsx

// =====================================================================
// DATE PICKER — custom calendar so the whole field is tappable and the
// calendar UI is fully themeable (the native one can't be styled).
// Works on ISO 'YYYY-MM-DD' strings to stay drop-in compatible.
// =====================================================================
// [A1 slice 19] DatePicker -> ./screens/date-picker.jsx (imported above).

// =====================================================================
// EXAM DATE SETTER
// =====================================================================
// [A1 slice 21] ExamDateScreen moved to ./screens/exam-date-screen.jsx (imported above).

// =====================================================================
// TOPIC SELECT
// =====================================================================
// [A1 s3] TopicSelect → screens/TopicSelect.jsx

// =====================================================================
// QUIZ
// =====================================================================

// A9 — the leave-session confirmation, extracted to its own component so the
// focus-trap hook mounts/unmounts cleanly with the dialog. role="alertdialog"
// (it's a destructive confirmation), focus trapped, Escape = stay.
// [A1 s4 / batch 1b slice 4] ConfirmExitDialog -> ./ui/confirm-exit-dialog.jsx

// GUEST MODE — PHASE B: the "Keep your guest progress?" choice shown when a
// guest with real local activity signs up / logs in. Accessible dialog (A9):
// focus-trapped, role="dialog", aria-modal. Escape maps to KEEP — the
// data-preserving (safe) default — so an accidental dismiss never discards the
// guest's work. Both buttons are explicit; there is no silent close.
// [A1 slice 18] GuestMergePrompt moved to ./screens/guest-merge-prompt.jsx (imported above).

// [A1 s4 / batch 1b slice 7] Quiz -> ./screens/quiz.jsx

// =====================================================================
// RESULTS
// =====================================================================
// Tone-aware celebration banner. The score drives the headline, sub-line,
// icon, gradient and quote — so a 95% gets genuine celebration while a 20%
// gets honest, supportive acknowledgement rather than hollow applause.
//
// Three tiers:
//   ≥75%  victory — bright teal gradient, "Excellent work"
//   40–74 growth  — calm primary gradient, "Solid effort"
//   <40   support — muted earthy tone, "Keep going" (NEVER fakes congratulations)
//
// The caller passes the score directly; an optional `label` (e.g. "Test",
// "Dosage calc") tunes the sub-line wording without changing the tone logic.
// =====================================================================
// GUEST SAVE PROMPT  (Pipeline step 26 / P-GUEST, Phase A)
// ---------------------------------------------------------------------
// Shown on a results screen when the user is a guest: the highest-intent
// moment to invite sign-up (they just earned a result worth keeping). Gentle,
// dismissible, non-blocking — dismiss is local component state so it never
// reappears within this results view but returns for the next result.
// Full-screen friendly gate for features that require an account (library,
// and any other sign-in-only surface). Never a dead-end: always offers sign-in
// and a way back. (Pipeline step 26 / P-GUEST, Phase A)
// [A1 slice 18] SignInGate moved to ./screens/sign-in-gate.jsx (imported above).

// [A1 s4 / step 38] GuestSavePrompt + MotivationCard moved to ./ui/result-cards.jsx
// Friendly label for the card's "quiz type" line, derived from a quiz nav
// `mode`. Unknown/absent modes fall back to a neutral "Practice quiz".
function quizTypeLabel(mode) {
  switch (mode) {
    case 'quick':      return 'Quick Test';
    case 'topic':      return 'Topic Drill';
    case 'weak-topic': return 'Weak-Area Drill';
    case 'mock':       return 'Mock Test';
    case 'bookmarks':  return 'Bookmarks Review';
    case 'review-due': return 'Spaced Review';
    case 'wrong':      return 'Wrong-Answer Redo';
    default:           return 'Practice quiz';
  }
}

// [A1 s4 / step 38] shareMotivation, ShareScoreButton, QUADRANT_META, quadrantOf,
// TimeQuadrant moved to ./ui/result-cards.jsx; Results moved to ./screens/Results.jsx
// [A1 slice 26] LearnTopics -> ./screens/learn-topics.jsx (imported above).

// =====================================================================
// LEARN — Card Reader
// =====================================================================
// [A1 slice 28] LearnCards -> ./screens/learn-cards.jsx (imported above).

// =====================================================================
// STATS
// =====================================================================
// [A1 s3] StatsScreen → screens/StatsScreen.jsx

// =====================================================================
// ADD QUESTION
// =====================================================================
// [A1 slice 22] AddQuestion moved to ./screens/add-question.jsx (imported above).

// =====================================================================
// MOCK SETUP
// =====================================================================
// [A1 s3] MockSetup → screens/MockSetup.jsx

// =====================================================================
// ADVANCED TEST — SETUP
// =====================================================================
// [A1 slice 43] AdvancedTestSetup + AdvancedTest + AdvancedTestResults (the timed-test trio, with Setup's Row/Segmented closures) moved to ./screens/advanced-test.jsx (imported above).

// =====================================================================
// PREVIOUS YEAR NORCET PAPERS  (Pipeline step 14 / P7)
// ---------------------------------------------------------------------
// A list of official AIIMS NORCET papers (built-in PREVIOUS_YEAR_PAPERS +
// any admin bank tagged type:'previous_paper'). Each card shows the year,
// question count, time limit and — if the user has attempted it — their
// best/last net score. Tapping a paper launches the existing AdvancedTest
// engine (negative marking + countdown + palette) with that paper's exact
// questions. Results are stored separately under data.previousPapers, so a
// paper attempt never mixes into the random-pool advancedTestHistory.
// =====================================================================
// [A1 slice 14] PreviousPapers moved to ./screens/previous-papers.jsx (imported above).

// =====================================================================
// BULK IMPORT (used inside AddQuestion)
// =====================================================================
// [A1 slice 17] BulkImport moved to ./screens/bulk-import.jsx (imported above).

// [A1 s4 / slice 11] VisibilityPill + Library (list) moved to ./screens/library.jsx
// (imported above). BankDetail and the bank editor below stay in App for now.

// =====================================================================
// QUESTION BANK — DETAIL (view + import)
// =====================================================================
// [A1 slice 44] BankDetail moved to ./screens/bank-screens.jsx (imported above).

// =====================================================================
// QUESTION BANK — EDITOR (admin only — create or edit)
// =====================================================================
// [A1 slice 44] BankEditor moved to ./screens/bank-screens.jsx (imported above; the two EXAMPLE_QUESTIONS_* payloads moved with it).

// [A1 s4 / batch 1b slice 6] REFERENCE_CATEGORIES -> ./screens/reference.jsx

// QUICK REFERENCE table moved out of bundle (Pipeline step 22 / A2):
// /public/data/reference.json, loaded lazily via useContent('reference').
// (REFERENCE_CATEGORIES — the small chip metadata above — stays in-bundle.)

// =====================================================================
// DOSAGE CALCULATION — practice questions with numeric answers
// =====================================================================
// DOSAGE DRILL questions moved out of bundle (Pipeline step 22 / A2):
// /public/data/dosage.json, loaded lazily via useContent('dosage').

// =====================================================================
// TTS BUTTON — small play/pause button using Web Speech API
// =====================================================================
// [A1 s4 / batch 1b slice 2] TTSButton -> ./ui/question-widgets.jsx

// =====================================================================
// REFERENCE SCREEN
// =====================================================================
// [A1 s4 / batch 1b slice 6] Reference -> ./screens/reference.jsx

// =====================================================================
// REFERENCE LOOKUP MODAL — the same lookup table as the Reference screen,
// but as an overlay so it can be opened from inside a test (Quick / Topic /
// Mock) without leaving the question. Self-contained state; closing it
// returns the user exactly where they were. Rendered as a sibling of the
// quiz's anim-fadeup wrapper so its position:fixed anchors to the viewport.
// =====================================================================
// [A1 s4 / batch 1b slice 6] ReferenceLookupModal -> ./screens/reference.jsx

// =====================================================================
// DOSAGE PRACTICE — numeric answer input
// =====================================================================
// [A1 slice 29] DosagePractice -> ./screens/dosage-practice.jsx (imported above).

// [A1 slice 15] DosageResults moved to ./screens/dosage-results.jsx (imported above).

// =====================================================================
// BOOKMARKS — READ-ONLY VIEWER with table of contents
// =====================================================================
// Opening Bookmarks should not feel like another quiz. It's a quick-reference
// study aid: the user already decided this question was important, so we show
// the stem, the correct answer highlighted, and the explanation directly.
// The TOC at the top is the killer feature — when you have 40 bookmarks
// spread across 10 topics, jumping to one specific item is a single tap
// instead of scrolling forever.
// [A1 slice 30] BookmarksScreen -> ./screens/bookmarks.jsx (imported above).

// =====================================================================
// REVISION SHEET — read-only digest of bookmarks (+ optionally wrong)
// =====================================================================
// [A1 slice 31] PRINT_STYLES + RevisionSheet -> ./screens/revision-sheet.jsx (imported above).

// =====================================================================
// WELCOME / ONBOARDING SCREEN
// =====================================================================
// [A1 slice 20] WelcomeScreen moved to ./screens/welcome.jsx (imported above).

// =====================================================================
// FEEDBACK — small icon button + modal, on every main screen
// =====================================================================
// [A7 step 36] CURRENT_PROFILE module global removed — FeedbackButton now reads
// the active profile from ProfileContext (useProfile), so any TopBar can still
// drop in a FeedbackButton without a render-mutated global.

// The Report modal is rendered once at the app root (FeedbackHost) so it sits
// outside any animated/transformed screen wrapper, keeping its `position: fixed`
// centering relative to the real viewport. Buttons anywhere request it through
// this tiny module-level channel rather than rendering their own copy.
// [A1 s3] _openFeedback/requestFeedback/registerFeedbackOpener + FeedbackButton → ui/primitives.jsx

// Single modal instance, mounted at the app root. Listens for open requests and
// holds the current report context (which screen / question it was opened from).
// [A1 slice 38] FeedbackHost -> ./screens/feedback-modal.jsx (imported above; rendered at app root).

// =====================================================================
// HELP — a context-sensitive "what is this screen?" guide. Mirrors the
// Report button: present on every screen with a TopBar, opens a modal at
// the app root (so fixed-positioning isn't broken by transformed ancestors).
// =====================================================================
// HELP screen content moved out of bundle (Pipeline step 22 / A2):
// /public/data/help.json, loaded lazily via useContent('help').

// [A1 s3] _openHelp/requestHelp/registerHelpOpener + HelpButton → ui/primitives.jsx (requestHelp now imported)

// [A1 slice 39] HelpHost + HelpModal -> ./screens/help-modal.jsx (imported above; HelpHost rendered at app root).

// The rename-profile modal follows the same app-root pattern as FeedbackHost.
// Why: Settings is rendered inside an `anim-fadeup` wrapper whose final
// keyframe leaves a `transform: translateY(0)` on the element. Any
// `position: fixed` child of a transformed ancestor positions relative to
// THAT ancestor, not the viewport — which causes the dim overlay to render
// over the screen while the modal itself sits where the centering math
// doesn't actually centre it. Result: a "frozen" page with a dim layer that
// blocks taps. Hoisting the modal up to the app root (no transformed
// ancestors) restores viewport-relative fixed positioning.
// [A1 slice 13] _openRename + requestRename moved to ./ui/rename-channel.js
// (registerRenameOpener imported below). The host modal stays at the App root.

// [A1 slice 40] RenameProfileHost -> ./screens/rename-profile-host.jsx (imported above; rendered at app root).

// [A1 slice 19] RenameProfileModal -> ./screens/rename-profile-modal.jsx (imported above).

// [A1 slice 38] FeedbackModal -> ./screens/feedback-modal.jsx (imported above).

// =====================================================================
// FEEDBACK INBOX — admin only
// =====================================================================
// [A1 slice 24] FeedbackInbox moved to ./screens/feedback-inbox.jsx (imported above).

// =====================================================================
// ADMIN PANEL — single hub for all shared/structural controls.
//   Visible ONLY when admin mode is unlocked. Gathers: overview counts,
//   bank management, announcements, user overview, and feedback.
//   Privacy: the user overview reads only the lightweight directory — it
//   never exposes any user's answers, progress, or password.
// =====================================================================
// [A1 slice 27] fmtWhen moved to ./lib/format.js (imported above).

// =====================================================================
// MY REPORTS — a user's own submitted feedback + any admin reply/status.
//   Reads only the user's own entries. A "New" marker shows when a reply
//   has arrived since the user last looked.
// =====================================================================
// [A1 slice 27] MyReports moved to ./screens/my-reports.jsx (imported above).

// A large, thumb-friendly dashboard tile. Shows an icon, a label, and a single
// glanceable signal (a count or a badge) — nothing more.
// [A1 slice 19] AdminTile -> ./ui/admin-tile.jsx (imported above).

// One feedback report in the admin inbox, with inline reply + status controls.
// [A1 slice 41] lookupReportedQuestion + ReportedQuestionModal -> ./screens/reported-question-modal.jsx (imported above; rendered inside AdminPanel).

// [A1 slice 26] AdminFeedbackCard -> ./ui/admin-feedback-card.jsx (imported above).

// [A1 slice 45] AdminPanel moved to ./screens/admin-panel.jsx (imported above). The single-consumer App-local helpers adminListUsers/adminDeleteProfile stay in App (adminDeleteProfile cascades into listBanks/deleteBank, which have other consumers) and are passed in as onListUsers/onDeleteProfile.

// =====================================================================
// QUICK PRACTICE SETUP
// =====================================================================
// [A1 s3] QuickPracticeSetup → screens/QuickPracticeSetup.jsx

// =====================================================================
// WEAK AREAS — focused list of topics where accuracy is low
// =====================================================================
// Distinct from Coverage on purpose: Coverage = "what have I seen / am I
// covering the syllabus", Weak Areas = "what am I getting wrong, fix it now".
// One scannable list, sorted worst-first, with a Start button on every row
// that launches a short quiz biased toward her past mistakes in that topic.
// [A1 s3] WeakAreasScreen → screens/WeakAreasScreen.jsx

// =====================================================================
// SYLLABUS COVERAGE MAP
// =====================================================================
// Two-level drill-down: topic → sub-topic. Each level has its own
// coverage / accuracy / "Start" button so the user can practise a whole
// topic OR a single weak sub-topic without leaving this screen.
// [A1 slice 36] CoverageMap -> ./screens/coverage-map.jsx (imported above).

// [A1 slice 34] Knowledge-mindmap design notes + node-state thresholds now live
// with the code in ./screens/knowledge-map.jsx and ./lib/kmap.js.
// [A1 slice 32] KMAP_STATES/mindmapState/mindmapNextProgress -> ./lib/kmap.js (imported at top).

// [A1 slice 34] computeMindmapModel + mindmap subsystem + KnowledgeMap -> ./screens/knowledge-map.jsx (imported above).

// Popup shown when a node is tapped. Subject node -> "Practice [Subject]";
// sub node -> "Practice [Subtopic]" (topic-locked + sub-filtered, exactly
// like the Coverage map's drill). Uses the A9 focus trap + dialog roles.
// [A1 slice 33] MindmapNodePopup -> ./screens/mindmap-node-popup.jsx (imported above; rendered inside KnowledgeMap).

// P11 Feature C — the note editor modal (opened by long-press / right-click on
// a node, or "Add/Edit note" in the tap popup). A focus-trapped dialog (A9
// pattern) with a textarea + Save / Cancel / Delete. Themed via T so it matches
// every colour scheme (Forest / Bloom / Dusk / Meadow + dark variants).
// [A1 slice 23] MindmapNoteEditor moved to ./screens/mindmap-note-editor.jsx (imported above).

// =====================================================================
// EXAM WEIGHTAGE (P14) — syllabus weightage + year-over-year shift, DERIVED
// entirely from loaded PYQ papers (never hard-coded; updates when admin adds
// a paper). Non-nursing sections (gk/apt) are excluded via countsInNursingStats
// unless the user opted them into stats (P18). Reads the P7 paper structures
// only — changes no data and no existing feature.
// =====================================================================
// [A1 slice 35] WeightageScreen -> ./screens/weightage.jsx (imported above).

// =====================================================================
// LEADERBOARD (P4) — ranked board over all leaderboard:* shared keys.
// Three tabs (This Week / Streak / Accuracy). Read-only; the per-user
// upsert lives in the App (saveLeaderboardEntry). Theme-aware, offline-aware.
// =====================================================================
// [A1 slice 16] LeaderboardScreen moved to ./screens/leaderboard.jsx (imported above).

// =====================================================================
// AUTH SCREEN — first-open profile create / log in
// =====================================================================
// [A1 slice 42] AuthScreen (+ single-consumer clearLegacyData) moved to ./screens/auth-screen.jsx (imported above).

// =====================================================================
// SETTINGS
// =====================================================================
// [A1 slice 13] Settings screen (667 ln) moved to ./screens/settings.jsx (imported below).

// =====================================================================
// PWA UPDATE TOAST (Pipeline step 8 / P19)
// ---------------------------------------------------------------------
// With registerType:'prompt' (vite.config.js), main.jsx fires a
// 'pwa-update-available' event when a new build is installed and
// waiting, and stashes the activator on window.__pwaUpdateSW. We show a
// non-blocking bottom toast; the USER chooses when to reload — we never
// auto-reload. "Later" hides it for the rest of this browser session
// (sessionStorage) but it returns next session if the update is still
// pending. If a quiz is in progress, Reload asks for confirmation first
// so a session is never interrupted mid-question (progress is
// debounce-saved regardless, so the reload is safe either way).
// =====================================================================

// [A1 slice 46] UpdateToast (+ its single-consumer PWA_DISMISS_KEY const) moved to ./screens/update-toast.jsx (imported above).

// =====================================================================
// MAIN APP
// =====================================================================

// P-NAV (Bug 2) — hardware/gesture back-button navigation.
// Screens that run their OWN popstate back-guard (the Quiz / Advanced-test
// confirm-exit dialogs push+intercept their own history entry). The global
// handler must NOT also act on these, or back would be handled twice.
const NAV_SELF_GUARDED_SCREENS = new Set(['quiz', 'advanced-test', 'paper-test', 'admin-panel']);
// Screens that are "roots": pressing back here exits the app (default OS
// behaviour) rather than navigating in-app.
const NAV_ROOT_SCREENS = new Set(['home']);

// Pure decision for what the device back button should do, given the current
// app state. Extracted so it's unit-testable in isolation. Returns one of:
//   'self-guarded'  — a screen with its own back-guard owns this; do nothing
//   'close-overlay' — an overlay (merge prompt / welcome / modal) is open; the
//                      caller should close it instead of navigating
//   'go-home'       — navigate back to Home (the in-app back target)
//   'exit'          — at a root screen with nothing open; allow OS to exit
function decideBackAction({ screen, overlayOpen, selfGuarded }) {
  if (selfGuarded) return 'self-guarded';
  if (overlayOpen) return 'close-overlay';
  if (NAV_ROOT_SCREENS.has(screen)) return 'exit';
  return 'go-home';
}

export default function App() {
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [legacyData, setLegacyData] = useState(null);
  // GUEST MODE (Phase A): local-only signal driving the sign-in nudges.
  const [guestMeta, setGuestMeta] = useState(null);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  // GUEST MODE (Phase B): when set, the "Keep your guest progress?" dialog is
  // shown and auth is PAUSED until the user chooses. Shape:
  // { profile, accountData, guestData }. The re-entrancy ref makes a
  // double-tap on the dialog buttons a no-op (can't double-merge); it is
  // re-armed (set false) each time a new merge offer is raised.
  const [pendingMerge, setPendingMerge] = useState(null);
  const mergeResolveBusyRef = useRef(false);
  const [nav, setNav] = useState({ screen: 'home' });
  // Phase 3 — a pending batch invite (?batch=) captured at boot; the join
  // confirmation modal shows once the user is logged in (guests sign up first).
  const [pendingBatchId, setPendingBatchId] = useState(null);
  useEffect(() => {
    if (!profile || isGuestProfile(profile)) return;
    let on = true;
    getPendingBatch().then(bid => { if (on && bid) setPendingBatchId(bid); }).catch(() => {});
    return () => { on = false; };
  }, [profile]);
  // A10: keep the logger's context in sync so every error report carries
  // the current profile + screen without each call site passing them.
  useEffect(() => {
    try { setLogContext({ screen: nav && nav.screen ? nav.screen : null }); } catch (e) {}
  }, [nav]);
  // ErrorBoundary's "Go back to Home" button (Pipeline step 1 / A3) dispatches
  // this event. Listen and reset nav so the user re-enters via Home cleanly,
  // without a full page reload (preserves React state like profile, banks).
  useEffect(() => {
    const handler = () => setNav({ screen: 'home' });
    window.addEventListener('norcet:reset-screen', handler);
    return () => window.removeEventListener('norcet:reset-screen', handler);
  }, []);
  // A2 — warm the lazy content cache (Reference / Dosage / Help / Learn) in the
  // background after first paint, so those screens are instant and available
  // OFFLINE even before the user first opens them. No-op when offline or when
  // each file is already cached locally; failures are swallowed.
  useEffect(() => {
    const t = setTimeout(() => { try { prefetchAllContent(); } catch (e) {} }, 2500);
    return () => clearTimeout(t);
  }, []);
  // #21/#29 — hydrate the per-device UI prefs cache (sidebar gestures + crib
  // sheet toggle) once at boot so synchronous getters are correct everywhere.
  const [, setUiPrefsLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    loadUiPrefs().then(() => { if (alive) setUiPrefsLoaded(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // P1 — offline write queue. When the browser regains connectivity, replay
  // any local saves that didn't reach Supabase. Also fire once on mount
  // (after a short delay so we don't fight boot's own loadProfile) so a user
  // who closed the app while offline gets their last session synced as soon
  // as they next open it online.
  useEffect(() => {
    const onOnline = () => { flushPendingSync(); };
    window.addEventListener('online', onOnline);
    const bootFlushTimer = setTimeout(() => {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        flushPendingSync();
      }
    }, 2000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearTimeout(bootFlushTimer);
    };
  }, []);
  const [loading, setLoading] = useState(true);
  // P-NAV (Bug 1): true until boot positively decides the destination (account
  // or guest). The render gate holds the splash while this is true, so the
  // AuthScreen can NEVER flash for a returning user whose session is still
  // resolving. Distinct from `loading` (kept for the existing watchdog/finally
  // semantics) so the two concerns don't fight.
  const [sessionResolving, setSessionResolving] = useState(true);
  const [authInitialMode, setAuthInitialMode] = useState('create');
  const [isAdmin, setIsAdmin] = useState(false);
  // Feature 4 — weekly summary dismissal (per ISO week, stored locally).
  const [weeklySummaryDismissed, setWeeklySummaryDismissed] = useState(false);
  // Feature 6 — unread notification badge count for the Home bell.
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [themeMode, setThemeMode] = useState('light');
  const [showWelcome, setShowWelcome] = useState(false);
  // NEW-01 — true when the welcome screen is a genuine FIRST RUN (show the App
  // Pitch / Library / demographic onboarding pages); false when replayed from
  // Settings (jump straight to the "what's inside" tour, no re-collecting data).
  const [welcomeFirstRun, setWelcomeFirstRun] = useState(true);
  // When the user launches a section from the welcome tour (e.g. Settings →
  // Show welcome tour → tap "Quick test"), the next "back to home" should
  // return them to the welcome tour rather than dropping them on Home. This
  // ref records that origin so goHome can branch correctly. Cleared on
  // dismiss / explicit Got-it / or after the user returns to welcome once.
  const cameFromWelcomeRef = useRef(false);
  const [whatsNew, setWhatsNew] = useState([]); // [{ id, name, version }]
  const [announcement, setAnnouncement] = useState(null); // shared admin notice
  const [myReports, setMyReports] = useState([]); // this user's own feedback (with admin replies)
  const [myReportsLoading, setMyReportsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false); // nav drawer (lifted out of Home so position:fixed is viewport-relative)
  const [bridgeDead, setBridgeDead] = useState(false); // storage bridge unreachable (e.g. standalone home-screen app)
  const [bridgeWarnDismissed, setBridgeWarnDismissed] = useState(false);

  // Probe storage liveness in the background and only warn if a deliberate
  // round-trip (with a retry) fails. This avoids false alarms from a single slow
  // call — the banner appears only when storage is genuinely unreachable.
  useEffect(() => {
    let cancelled = false;
    checkStorageBridge().then((alive) => {
      if (!cancelled && !alive) setBridgeDead(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // [A1 slice 47] A7 COMPLETE — the transitional module-level T/IS_DARK bridge
  // is deleted. Every screen now reads theme via useTheme(); App is the last
  // reader and computes its own theme locally here. The same T value still flows
  // to <AppProviders> below, so context stays the single source of truth.
  const T = THEMES[themeMode] || LIGHT_THEME;
  const IS_DARK = themeMode === 'dark';

  // A8: also publish the token CSS vars synchronously here (in addition to the
  // post-paint effect below) so the .bg-surface/.text-ink/etc. utility classes
  // are correct on the VERY FIRST paint and on every theme switch with no
  // one-frame flash. Guarded for SSR/non-DOM. Cheap (24 setProperty calls).
  if (typeof document !== 'undefined') {
    const _r = document.documentElement, _t = T;
    _r.style.setProperty('--bg', _t.bg);
    _r.style.setProperty('--surface', _t.surface);
    _r.style.setProperty('--surface-warm', _t.surfaceWarm);
    _r.style.setProperty('--ink', _t.ink);
    _r.style.setProperty('--ink-soft', _t.inkSoft);
    _r.style.setProperty('--muted', _t.muted);
    _r.style.setProperty('--primary', _t.primary);
    _r.style.setProperty('--primary-soft', _t.primarySoft);
    _r.style.setProperty('--accent', _t.accent);
    _r.style.setProperty('--accent-soft', _t.accentSoft);
    _r.style.setProperty('--success', _t.success);
    _r.style.setProperty('--success-soft', _t.successSoft);
    _r.style.setProperty('--error', _t.error);
    _r.style.setProperty('--error-soft', _t.errorSoft);
    _r.style.setProperty('--border', _t.border);
    _r.style.setProperty('--border-soft', _t.borderSoft);
    if (_t.sec) for (const s in _t.sec) _r.style.setProperty('--sec-' + s, _t.sec[s]);
  }

  // Boot: restore session if any, else show auth.
  //
  // Two safety nets ensure the "loading your progress…" screen ALWAYS clears:
  //   1. A watchdog forces loading=false after a few seconds, so even a slow or
  //      dead storage bridge (see safeStorage) can't trap the user on the
  //      splash screen — they fall through to the auth screen with defaults.
  //   2. A `finally` clears loading the instant the boot sequence finishes,
  //      regardless of which branch ran or whether anything threw.
  useEffect(() => {
    let cancelled = false;
    // P-NAV (Bug 1): the watchdog now resolves to the BEST KNOWN state, never
    // the login screen. If a session id is known when it fires, we keep holding
    // for the cached account (sessionResolving stays true a touch longer via
    // the boot path); we only clear `loading` so the splash logic still works.
    const watchdog = setTimeout(() => {
      if (!cancelled) { setLoading(false); }
    }, 7000);
    (async () => {
      try {
        const tm = await loadThemeMode();
        setThemeMode(tm);
        setIsAdmin(await loadAdminStatus());
        loadAnnouncement().then(setAnnouncement).catch(() => {});
        const session = await loadSession();
        if (session && session.profileId) {
          // P-NAV (Bug 1) — LOCAL-FIRST: paint the account from the IndexedDB
          // cache immediately (zero network), so a returning user never sees
          // the auth screen flash. Then reconcile against Supabase in the
          // background below.
          const commitAccount = (p, { showTour }) => {
            setProfile(p);
            touchProfileActivity(p.id);
            try { setLogContext({ profileId: p.id }); } catch (e) {}
            const pd = p.data || {};
            const migrated = runMigrations(pd);
            const loaded = {
              ...DEFAULT_DATA,
              ...migrated,
              customQuestions: Array.isArray(migrated.customQuestions) ? migrated.customQuestions : DEFAULT_DATA.customQuestions,
              bookmarks: Array.isArray(migrated.bookmarks) ? migrated.bookmarks : DEFAULT_DATA.bookmarks,
              stats: { ...DEFAULT_DATA.stats, ...(migrated.stats || {}) },
              advancedTestHistory: migrated.advancedTestHistory || [],
              bankVersionsSeen: migrated.bankVersionsSeen || {},
              bankPublishedSeen: migrated.bankPublishedSeen || {},
              disabledBanks: migrated.disabledBanks || {},
              revisionLog: Array.isArray(migrated.revisionLog) ? migrated.revisionLog : DEFAULT_DATA.revisionLog,
              preferences: { ...DEFAULT_DATA.preferences, ...(migrated.preferences || {}) }
            };
            let bootData = loaded;
            try { if (needsCompaction(loaded)) bootData = compactData(loaded); }
            catch (e) { try { log.error('boot.compaction', e); } catch (_) {} }
            setData(bootData);
            if (showTour) {
              const isBrandNew = loaded.stats.totalAttempted === 0
                && loaded.customQuestions.length === 0
                && loaded.bookmarks.length === 0;
              hasSeenOnboarding(p.id).then(seen => {
                if (!cancelled && !seen && isBrandNew) setShowWelcome(true);
              }).catch(() => {});
            }
          };

          const cached = await loadProfileCached(session.profileId);
          if (cached) {
            // Instant paint from cache; we've positively resolved to the
            // account, so release the session gate now (no flash possible).
            commitAccount(cached, { showTour: true });
            if (!cancelled) setSessionResolving(false);
            // Background reconcile against the canonical Supabase copy. If the
            // cloud has a newer/different blob, refresh profile+data silently.
            (async () => {
              try {
                const fresh = await loadProfile(session.profileId);
                if (!cancelled && fresh) commitAccount(fresh, { showTour: false });
              } catch (e) { log.warn('boot.reconcile', e); }
            })();
            return;
          }
          // No local cache (e.g. first launch on this device after signing in
          // elsewhere): fall back to the canonical network load, still holding
          // the splash (sessionResolving) — NOT the auth screen.
          const p = await loadProfile(session.profileId);
          if (p) {
            commitAccount(p, { showTour: true });
            if (!cancelled) setSessionResolving(false);
            return;
          }
          await saveSession(null);
        }
        // GUEST MODE (Phase A): no restorable account session. Instead of the
        // old login WALL, drop the user straight into the app as a guest.
        // Their previous guest progress (if any) is restored from LOCAL
        // storage; otherwise they start fresh. We still load legacy data and
        // the profile index so the auth screen (now reachable from Settings /
        // nudges) can offer the right default mode when they choose to sign up.
        const legacy = await peekLegacyData();
        setLegacyData(legacy);
        const index = await loadProfileIndex();
        setAuthInitialMode(index.length > 0 ? 'login' : 'create');
        try {
          const guestBlob = await loadGuestData();
          const migratedGuest = runMigrations(guestBlob || {});
          const guestData = {
            ...DEFAULT_DATA,
            ...migratedGuest,
            customQuestions: Array.isArray(migratedGuest.customQuestions) ? migratedGuest.customQuestions : DEFAULT_DATA.customQuestions,
            bookmarks: Array.isArray(migratedGuest.bookmarks) ? migratedGuest.bookmarks : DEFAULT_DATA.bookmarks,
            stats: { ...DEFAULT_DATA.stats, ...(migratedGuest.stats || {}) },
            advancedTestHistory: migratedGuest.advancedTestHistory || [],
            bankVersionsSeen: migratedGuest.bankVersionsSeen || {},
            bankPublishedSeen: migratedGuest.bankPublishedSeen || {},
            disabledBanks: migratedGuest.disabledBanks || {},
            revisionLog: Array.isArray(migratedGuest.revisionLog) ? migratedGuest.revisionLog : DEFAULT_DATA.revisionLog,
            preferences: { ...DEFAULT_DATA.preferences, ...(migratedGuest.preferences || {}) }
          };
          setProfile(makeGuestProfile());
          setData(guestData);
          try { const gm = await loadGuestMeta(); setGuestMeta(gm); } catch (e) {}
          // Welcome tour: a guest hasn't signed up, so keep onboarding them —
          // show the tour on EACH launch until they create an account. We do
          // NOT mark onboarding "seen" for the guest sentinel (see
          // dismissWelcome), so it re-shows next launch. Skipped only once the
          // guest has converted (guestMeta.signedUp) — defensive.
          try {
            const gmSeen = await loadGuestMeta();
            if (!gmSeen.signedUp) setShowWelcome(true);
          } catch (e) { setShowWelcome(true); }
        } catch (e) {
          log.error('boot.guest', e);
          // Even if guest restore fails, start a clean guest session so the
          // user is never stranded behind a wall.
          setProfile(makeGuestProfile());
          setData({ ...DEFAULT_DATA });
        }
        return;
      } catch (e) {
        // Never let a boot error strand the user on the loading screen.
        log.error('boot.fatal', e);
      } finally {
        clearTimeout(watchdog);
        if (!cancelled) { setLoading(false); setSessionResolving(false); }
      }
    })();
    return () => { cancelled = true; clearTimeout(watchdog); };
  }, []);

  // Persist on data change. Profile writes are DEBOUNCED so bursts of setData
  // (rapid streak/grace/preference updates after a quiz, settings edits, etc.)
  // coalesce into a single shared-storage write. This dramatically narrows the
  // window where two devices could clobber each other's blob, and avoids
  // hammering storage with one write per keystroke.
  //
  // On unmount or before a flush is due, we still write — so closing the tab
  // never loses progress.
  const pendingSaveRef = useRef(null);  // latest unsaved { profile, data }
  const saveTimerRef = useRef(null);
  // Effect A — schedule a debounced save whenever data changes. Deliberately
  // has NO cleanup: a rapid burst of state updates across separate render
  // ticks should reset the same 1.5s timer, not force an immediate flush on
  // every change (which defeated the debounce in the old single-effect form).
  useEffect(() => {
    if (!data || !profile || loading) return;
    // GUEST MODE (Phase A): guests persist to LOCAL storage only — never the
    // Supabase write inside saveProfile. Debounce still applies.
    if (isGuestProfile(profile)) {
      pendingSaveRef.current = { guest: true, data };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const p = pendingSaveRef.current;
        if (p && p.guest) { saveGuestData(p.data); pendingSaveRef.current = null; }
        saveTimerRef.current = null;
      }, 1500);
      return;
    }
    pendingSaveRef.current = { profile, data };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const p = pendingSaveRef.current;
      if (p) {
        saveProfile({ ...p.profile, data: p.data });
        pendingSaveRef.current = null;
      }
      saveTimerRef.current = null;
    }, 1500);
  }, [data, profile, loading]);
  // Effect B — flush any pending save on unmount only, so closing the tab or
  // navigating away never loses the latest snapshot.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current && pendingSaveRef.current) {
        clearTimeout(saveTimerRef.current);
        const p = pendingSaveRef.current;
        if (p.guest) { saveGuestData(p.data); }
        else { saveProfile({ ...p.profile, data: p.data }); }
        pendingSaveRef.current = null;
        saveTimerRef.current = null;
      }
    };
  }, []);

  const allQuestions = useMemo(() => {
    if (!data) return SEED_QUESTIONS;
    // Filter out imported questions belonging to banks the user has paused.
    // The questions stay in customQuestions (so history + bookmarks survive
    // a re-enable) — they're just excluded from the active pool.
    const disabled = data.disabledBanks || {};
    const activeCustom = data.customQuestions.filter(q => {
      if (!q.sourceBank) return true;          // user's own additions
      return !disabled[q.sourceBank];          // imported but bank is enabled
    });
    return [...SEED_QUESTIONS, ...activeCustom];
  }, [data]);

  // F-A — Study Methods: real, read-only progress signals for the method
  // rows (never fabricated). Cheap: one pass over history + a due-count.
  const studyProgress = useMemo(() => {
    if (!data) return { totalAttempted: 0, accuracy: 0, streakCurrent: 0, dueCount: 0, topicsCovered: 0, totalTopics: 0 };
    const st = data.stats || {};
    const att = st.totalAttempted || 0;
    const topicOf = new Map(allQuestions.map(q => [q.id, q.topic]));
    const covered = new Set();
    const hist = data.history || {};
    for (const qId in hist) {
      const h = hist[qId];
      if (h && h.attempts && h.attempts.length) {
        const t = topicOf.get(qId);
        if (t) covered.add(t);
      }
    }
    const totalTopics = new Set(allQuestions.map(q => q.topic)).size;
    return {
      totalAttempted: att,
      accuracy: att > 0 ? (st.totalCorrect || 0) / att : 0,
      streakCurrent: st.streakCurrent || 0,
      dueCount: getDueQuestions(hist, allQuestions).length,
      topicsCovered: covered.size,
      totalTopics,
    };
  }, [data, allQuestions]);

  // F-D — ranking signals for Quick Revision (weak topics, due-by-topic, days
  // to exam). Computed here where data + allQuestions live; passed to LearnTopics.
  const learnSignals = useMemo(() => {
    if (!data) return { weakTopics: [], dueTopicIds: [], examDaysLeft: null };
    const includeGk = !!(data.preferences && data.preferences.includeGkInStats === true);
    const weakTopics = getWeakTopics(data.history || {}, allQuestions, includeGk);
    const due = getDueQuestions(data.history || {}, allQuestions);
    const dueTopicIds = [...new Set(due.map(q => q.topic))];
    let examDaysLeft = null;
    const ed = data.stats && data.stats.examDate;
    if (ed) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const target = new Date(ed + 'T00:00:00');
      if (!isNaN(target.getTime())) {
        const d = Math.ceil((target - today) / 86400000);
        examDaysLeft = d >= 0 ? d : null; // ignore past exam dates
      }
    }
    return { weakTopics, dueTopicIds, examDaysLeft };
  }, [data, allQuestions]);

  // ===================================================================
  // #8 — REAL BACK NAVIGATION. The app previously treated every back press
  // as "go home", so Drill Tests → Quick Test → back teleported to Home.
  // Fix: a session nav STACK. `navigate()` pushes the screen it is LEAVING
  // (browse screens only); `goHome` — wired everywhere as onBack and as the
  // hardware-back action — now POPS to the previous screen, falling back to
  // Home when the stack is empty. Transient flows (quiz/test runs, results,
  // auth, crib-sheet which carries its own backNav) are never pushed, so
  // back from a results screen can't re-enter a finished test. `goHomeDirect`
  // (results "Home" buttons, welcome flows) clears the stack and jumps
  // straight home. The Home double-back-to-exit caution (#30) is unchanged
  // and still guards accidental exits.
  // ===================================================================
  const NAV_NO_STACK = ['quiz', 'advanced-test', 'paper-test', 'results',
    'advanced-results', 'paper-results', 'crib-sheet', 'auth', 'home'];
  const navStackRef = useRef([]);
  const navRef = useRef(nav);
  navRef.current = nav;
  // #29 — keep the error logger's context pointed at the current screen so
  // captured crashes record where they happened. #28 — count the screen view.
  useEffect(() => {
    setErrorContext({ screen: nav.screen });
    trackScreen(nav.screen);
  }, [nav.screen]);
  // #28 — begin engagement tracking once the active identity is known. Handles
  // both logged-in profiles and guests (a stable local guest id is used so
  // their repeat visits aggregate). Fire-and-forget; never blocks the app.
  useEffect(() => {
    if (!profile) return;
    initAnalytics(profile.id, isGuestProfile(profile));
  }, [profile && profile.id]);
  // B2 — keep the current profile's "repeat unattempted" pool in a ref so the
  // synchronous selector in startQuiz can read it without awaiting storage.
  const repeatPoolRef = useRef([]);
  useEffect(() => {
    let on = true;
    loadRepeatPool(profile && profile.id)
      .then((ids) => { if (on) repeatPoolRef.current = ids; })
      .catch(() => {});
    return () => { on = false; };
  }, [profile && profile.id]);
  const navigate = useCallback((n) => {
    const cur = navRef.current;
    if (cur && n && n.screen !== cur.screen && !NAV_NO_STACK.includes(cur.screen)) {
      const st = navStackRef.current;
      st.push({ ...cur });
      if (st.length > 12) st.shift();
    }
    setNav(n);
  }, []);

  // F-B — pull-to-refresh action. Signed-in: flush pending local writes, then
  // re-pull the canonical Supabase copy and re-commit (so changes from another
  // device / admin content appear). Guest: re-read the local blob. Re-running
  // the boot is avoided; hydrateLoaded() reuses its exact shaping. Always
  // resolves so the spinner can complete.
  const refreshApp = useCallback(async () => {
    try {
      if (!profile) return;
      if (isGuestProfile(profile)) {
        const g = await loadGuestData();
        if (g) setData(hydrateLoaded(g));
      } else {
        try { await flushPendingSync(); } catch (e) {}
        const fresh = await loadProfile(profile.id);
        if (fresh) {
          setProfile(fresh);
          setData(hydrateLoaded(fresh.data || {}));
        }
      }
    } catch (e) {
      try { log.warn('pullRefresh', e); } catch (_) {}
    }
    // #6 — let live UI react to a completed refresh (Home swaps its quote).
    try { window.dispatchEvent(new CustomEvent('norcet:refreshed')); } catch (e) {}
  }, [profile]);

  // When the screen changes (e.g. completing a test → results), the window can
  // carry over the previous screen's scroll position, so the new page appears
  // to "launch from the middle". Reset scroll to the top on every screen
  // change — and re-assert on the next frame + shortly after, because on
  // mobile the first reset can lose a race against mount animations/layout.
  //
  // #30 — scroll position RESTORATION on back navigation. Every screen's Y
  // offset is remembered (session-only, in a ref) at the moment we leave it;
  // when a BACK navigation returns to a screen (goHome / the hardware back
  // handler set `restoreNextScrollRef`), the saved offset is re-applied
  // instantly instead of jumping to the top. Forward navigations still start
  // at the top. Quiz/test screens preserve their question index, not scroll,
  // so they never restore (they're never a back target here anyway).
  const scrollMemRef = useRef({});            // screen -> last Y offset
  const restoreNextScrollRef = useRef(false); // armed by back navigations only
  const prevScreenRef = useRef(nav.screen);
  useEffect(() => {
    // Save the outgoing screen's offset BEFORE any reset runs.
    try { scrollMemRef.current[prevScreenRef.current] = window.scrollY || 0; } catch (e) {}
    prevScreenRef.current = nav.screen;
    const saved = scrollMemRef.current[nav.screen];
    const target = (restoreNextScrollRef.current && typeof saved === 'number') ? saved : 0;
    restoreNextScrollRef.current = false;
    const reset = () => {
      try {
        window.scrollTo({ top: target, left: 0, behavior: 'instant' });
      } catch (e) {
        try { window.scrollTo(0, target); } catch (_) {}
      }
      try {
        if (document.scrollingElement) document.scrollingElement.scrollTop = target;
        document.documentElement.scrollTop = target;
        document.body.scrollTop = target;
      } catch (e) { /* no-op */ }
    };
    reset();
    const raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(reset) : null;
    const t = setTimeout(reset, 90);
    return () => { if (raf != null) cancelAnimationFrame(raf); clearTimeout(t); };
  }, [nav.screen]);

  // Theme-aware scrollbar colours. Set on :root so they apply to the window
  // scrollbar and every overflow container (sidebar, reference popup, etc.).
  // Warm, translucent neutrals that match the palette instead of the harsh
  // default white bar that looked out of place in dark mode.
  //
  // A8 (pipeline step 23): this same effect now ALSO publishes every theme
  // token as a CSS custom property on :root (--bg, --surface, --ink, …, and
  // --sec-quick … --sec-stats). The className-based utilities in fontStyles
  // (.bg-surface, .text-ink, .border-app, etc.) read these vars, so a growing
  // set of components can drop their per-render `style={{ background:T.x }}`
  // objects in favour of a stable className — no new object identity each
  // render (helps React.memo + GC on the long Quiz screen). T stays the source
  // of truth and is mirrored here on every theme change; existing inline
  // styles keep working untouched, so this is purely additive + incremental.
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.style.setProperty('--sb-thumb', 'rgba(243,238,227,0.18)');
      root.style.setProperty('--sb-thumb-hover', 'rgba(243,238,227,0.32)');
    } else {
      // For light themes, tint the scrollbar with the primary colour at low opacity
      const primary = T.primary;
      root.style.setProperty('--sb-thumb', primary + '38');
      root.style.setProperty('--sb-thumb-hover', primary + '60');
    }
    // Publish the active theme's tokens as CSS variables (A8).
    const t = THEMES[themeMode] || LIGHT_THEME;
    const flat = {
      '--bg': t.bg, '--surface': t.surface, '--surface-warm': t.surfaceWarm,
      '--ink': t.ink, '--ink-soft': t.inkSoft, '--muted': t.muted,
      '--primary': t.primary, '--primary-soft': t.primarySoft,
      '--accent': t.accent, '--accent-soft': t.accentSoft,
      '--success': t.success, '--success-soft': t.successSoft,
      '--error': t.error, '--error-soft': t.errorSoft,
      '--border': t.border, '--border-soft': t.borderSoft,
    };
    for (const k in flat) root.style.setProperty(k, flat[k]);
    if (t.sec) for (const s in t.sec) root.style.setProperty('--sec-' + s, t.sec[s]);
  }, [themeMode]);
  // goHome respects the welcome-tour-origin flag: if she came from welcome,
  // route her back to welcome instead of Home. Flag clears itself in the
  // process, so the next goHome (or her tapping "Got it" on welcome) goes
  // to Home normally.
  const goHome = useCallback(() => {
    if (cameFromWelcomeRef.current) {
      cameFromWelcomeRef.current = false;
      setShowWelcome(true);
      return;
    }
    restoreNextScrollRef.current = true; // #30 — back restores scroll
    // #8 — pop the nav stack: back returns to the PREVIOUS screen, not Home.
    const st = navStackRef.current;
    while (st.length > 0) {
      const prev = st.pop();
      if (prev && prev.screen && prev.screen !== navRef.current.screen) {
        setNav(prev);
        return;
      }
    }
    setNav({ screen: 'home' });
  }, []);

  // #8 — explicit "take me Home" (results screens, completed flows): clears
  // the breadcrumb trail so a later back press from Home just exits-guards.
  const goHomeDirect = useCallback(() => {
    navStackRef.current = [];
    restoreNextScrollRef.current = true;
    setNav({ screen: 'home' });
  }, []);

  // P-NAV (Bug 2) — make the phone's hardware/gesture back button navigate
  // in-app instead of minimizing the PWA. The app navigates via React state
  // (setNav), which pushes no browser history, so the OS back has nothing to
  // pop. We keep ONE sentinel history entry present whenever a back gesture
  // should stay in-app; a popstate then routes to the in-app back target and
  // re-arms the sentinel so the NEXT back is caught too.
  //
  // Composition: Quiz / Advanced-test run their OWN popstate guard
  // (ConfirmExitDialog), so this handler treats those screens as self-guarded
  // and does nothing. The merge prompt is a forced choice → back is a no-op
  // (re-arm only), never an accidental dismiss. The welcome tour CAN be backed
  // out of → Home. From Home with nothing open → no sentinel, so back exits.
  const navBackRef = useRef({ screen: 'home', overlayOpen: false, selfGuarded: false, kind: 'none' });
  const sentinelArmedRef = useRef(false);
  useEffect(() => {
    const selfGuarded = NAV_SELF_GUARDED_SCREENS.has(nav.screen);
    const kind = pendingMerge ? 'merge' : (showWelcome ? 'welcome' : 'none');
    const overlayOpen = kind !== 'none';
    navBackRef.current = { screen: nav.screen, overlayOpen, selfGuarded, kind };
    // Arm a sentinel whenever back should stay in-app (and we don't already
    // hold one, and the screen isn't self-guarding its own entry).
    // #30 — ROOT screens are now armed too: the first back press on Home is
    // intercepted to show the "Press back again to exit" snackbar; only the
    // second press (within 2.5s) lets the OS exit.
    if (typeof window !== 'undefined' && window.history) {
      const needs = !selfGuarded;
      if (needs && !sentinelArmedRef.current) {
        try { window.history.pushState({ navGuard: true }, ''); sentinelArmedRef.current = true; } catch (e) {}
      }
    }
  }, [nav.screen, pendingMerge, showWelcome]);

  // #5/#12 — back-button DEBOUNCE + a single exit path. A rapid double-tap of
  // the hardware back was popping more history than existed and crashing the
  // PWA (and the same in the Welcome Tour). Two guards close this:
  //   • lastPopRef debounces consecutive popstates within 350ms into ONE step.
  //   • the app now exits ONLY when the user taps Exit in the dialog
  //     (programmaticExitRef) — a hardware back never closes the app, so a
  //     fast double-back can no longer fall out of the app accidentally (#6).
  const lastPopRef = useRef(0);
  const programmaticExitRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;
    const reArm = () => {
      try { window.history.pushState({ navGuard: true }, ''); sentinelArmedRef.current = true; } catch (e) {}
    };
    const onPop = () => {
      // Exit button path: confirmExit() set this flag and called history.back()
      // to pop the re-armed sentinel; pop ONE more past it so the OS closes the
      // PWA. This is the ONLY code path that ever exits the app.
      if (programmaticExitRef.current) {
        programmaticExitRef.current = false;
        try { window.history.back(); } catch (e) {}
        return;
      }
      sentinelArmedRef.current = false;            // the sentinel was just consumed
      const now = Date.now();
      const rapid = now - lastPopRef.current < 350; // #5/#12 — collapse fast double-taps
      lastPopRef.current = now;
      const s = navBackRef.current;
      const action = decideBackAction(s);
      if (action === 'self-guarded') return;       // Quiz/advanced guard owns it
      // A second back within the debounce window is treated as part of the same
      // gesture: re-arm the sentinel and do nothing else (no double pop / crash).
      if (rapid) { reArm(); return; }
      if (action === 'exit') {
        // #6 — show the centred "Exit app?" dialog and re-arm; the back press
        // itself NEVER closes the app. Exit happens only via confirmExit().
        reArm();
        exitPendingRef.current = true;
        setExitSnack(true);
        return;
      }
      reArm();                                      // keep intercepting subsequent backs
      if (action === 'close-overlay') {
        if (s.kind === 'merge') return;             // forced choice → no dismiss on back
        if (s.kind === 'welcome') {
          // Issues round — the tour mirrors the app's own back button: its
          // open help popup closes first; at the tour root a leave-
          // confirmation is shown. welcome.jsx listens for this event.
          try { window.dispatchEvent(new CustomEvent('norcet:welcome-back')); } catch (e) {}
        }
        return;
      }
      // BUG-01 — give the active screen a chance to pop its OWN internal
      // sub-view first (Settings sub-pages, Bookmark detail, Knowledge-Map
      // overlays, the Revision date view). The sentinel is already re-armed
      // above, so if a screen consumes the back we stop here and stay put —
      // making the device back, browser back and on-screen ← arrow consistent.
      if (runTopBackHandler()) return;
      restoreNextScrollRef.current = true;          // #30 — hardware back restores scroll
      // #8 — hardware back also pops the nav stack (same rule as goHome).
      {
        const st = navStackRef.current;
        let popped = null;
        while (st.length > 0) {
          const prev = st.pop();
          if (prev && prev.screen && prev.screen !== navRef.current.screen) { popped = prev; break; }
        }
        setNav(popped || { screen: 'home' });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // #30 reworked — exit confirmation dialog state (Home + hardware back only).
  const [exitSnack, setExitSnack] = useState(false);
  const exitPendingRef = useRef(false);
  const cancelExit = useCallback(() => {
    exitPendingRef.current = false;
    setExitSnack(false);
    // The sentinel re-armed when the dialog opened stays in place, so the next
    // back press simply re-shows this dialog — never an accidental exit.
  }, []);
  const confirmExit = useCallback(() => {
    // The ONLY exit path: pop the re-armed sentinel; the popstate handler sees
    // programmaticExitRef and pops once more past it, letting the OS close.
    setExitSnack(false);
    exitPendingRef.current = false;
    programmaticExitRef.current = true;
    try { window.history.back(); } catch (e) {}
  }, []);

  const startQuiz = useCallback((spec) => {
    // Record where the quiz was launched from so exiting it returns to that
    // screen (e.g. Weak Areas / Syllabus-coverage), not Home. startQuiz uses
    // setNav below, which bypasses the nav stack, so we push here exactly the
    // way navigate() does (respecting NAV_NO_STACK, so launches from Home or
    // another quiz don't add a spurious entry).
    {
      const cur = navRef.current;
      if (cur && cur.screen !== 'quiz' && !NAV_NO_STACK.includes(cur.screen)) {
        const st = navStackRef.current;
        st.push({ ...cur });
        if (st.length > 12) st.shift();
      }
    }
    let qs = [];
    // NEW-03 "The Pulse" — explicit choice (from a setup screen) wins and is
    // remembered; otherwise inherit the saved preference so topic-wise tests
    // launched straight from a picker still honour it.
    const pulseOn = spec.pulse !== undefined ? !!spec.pulse : !!(data && data.preferences && data.preferences.pulseTimer);
    if (spec.pulse !== undefined) {
      setData(prev => ({ ...prev, preferences: { ...prev.preferences, pulseTimer: !!spec.pulse } }));
    }
    // B2 — bias selection so questions the user was shown but never attempted
    // (and didn't reveal/skip) come back FIRST, then fall through to the normal
    // unseen-first / weakest-next selector to fill the remaining slots.
    const selectWithRepeats = (pool, count, history) => {
      const { toRepeat, rest } = partitionByRepeat(pool, repeatPoolRef.current);
      if (toRepeat.length === 0) return selectQuickPracticeQuestions(pool, count, history);
      const repeatPick = shuffle(toRepeat).slice(0, count);
      if (repeatPick.length >= count) return repeatPick;
      const restPick = selectQuickPracticeQuestions(rest, count - repeatPick.length, history);
      return [...repeatPick, ...restPick];
    };
    if (spec.mode === 'quick') {
      // Both Quick Practice entry points (this and `startQuickPractice`) go
      // through the same smart selector — no caller can accidentally end up
      // with raw-shuffled questions and miss the unseen-first / weakest-next
      // ordering. Kept here defensively in case future code paths invoke
      // `startQuiz({ mode: 'quick' })` directly.
      const pool = spec.topic && spec.topic !== 'all'
        ? allQuestions.filter(q => q.topic === spec.topic)
        : allQuestions;
      qs = selectWithRepeats(pool, spec.count || 5, data ? data.history : {});
    } else if (spec.mode === 'topic') {
      // P16 — optional PYQ-only narrowing for Topic-wise practice.
      const base = spec.pyqOnly ? allQuestions.filter(isPYQ) : allQuestions;
      let pool = base.filter(q => q.topic === spec.topic);
      // Optional sub-topic filter — comes from the Coverage map's per-sub
      // Start button. "General" matches questions that have no `sub` field.
      if (spec.sub) {
        pool = pool.filter(q => {
          const s = (q.sub && String(q.sub).trim()) || 'General';
          return s === spec.sub;
        });
      }
      // #21 — unseen-first so Topic Wise Test never repeats a question across
      // sessions until the topic's bank is exhausted (was a raw shuffle, which
      // could re-serve the same questions every time).
      qs = selectWithRepeats(pool, spec.count || 10, data ? data.history : {});
    } else if (spec.mode === 'weak-topic') {
      // Practice mode launched from the Weak Areas screen. Bias the question
      // selection toward questions she's previously got WRONG in this topic
      // — that's the whole point of the screen. Fallback order:
      //   1) questions she's been wrong on at least once in this topic
      //   2) questions she's never attempted in this topic
      //   3) anything else in this topic, to fill the slot count
      const history = data ? data.history : {};
      const topicPool = allQuestions.filter(q => q.topic === spec.topic);
      const wrong = [], unseen = [], rest = [];
      topicPool.forEach(q => {
        const h = history[q.id];
        // P15 — attemptStats.anyWrong is true for compacted records that
        // had any wrong attempts pre-compaction; hasBeenSeen catches both
        // Tier 2 and Tier 3.
        if (h && (h.lastResult === 'wrong' || attemptStats(h).anyWrong)) {
          wrong.push(q);
        } else if (!hasBeenSeen(h)) {
          unseen.push(q);
        } else {
          rest.push(q);
        }
      });
      const target = spec.count || 5;
      // Shuffle within each tier so she doesn't see the same order every time.
      qs = [...shuffle(wrong), ...shuffle(unseen), ...shuffle(rest)].slice(0, target);
      // Route as 'quick' for the Quiz renderer — Weak Area drills are study
      // sessions, not exams, so hints + alt explanations should remain visible.
      setNav({ screen: 'quiz', questions: qs, mode: 'quick', timed: false, pulse: pulseOn });
      return;
    } else if (spec.mode === 'mock') {
      qs = shuffle(allQuestions).slice(0, spec.count || 50);
    } else if (spec.mode === 'bookmarks') {
      qs = allQuestions.filter(q => data.bookmarks.includes(q.id));
    } else if (spec.mode === 'review-due') {
      qs = getDueQuestions(data.history, allQuestions);
    } else if (spec.mode === 'wrong') {
      qs = allQuestions.filter(q => spec.qIds && spec.qIds.includes(q.id));
    }
    setNav({
      screen: 'quiz',
      questions: qs,
      mode: spec.mode,
      timed: spec.mode === 'mock',
      // Countdown duration for mock. Other modes leave this undefined.
      timeLimitMin: spec.mode === 'mock' ? (spec.durationMin || spec.count || 50) : null,
      pulse: pulseOn
    });
  }, [allQuestions, data]);

  const completeQuiz = useCallback((results, bookmarkedLocal, elapsed, skipCounts) => {
    if (!data) return;
    setData(prev => {
      const newHistory = { ...prev.history };
      const today = todayStr();
      let attemptedToday = 0, correctToday = 0;

      results.forEach(r => {
        const h = newHistory[r.qId] || { attempts: [], reviewCount: 0, nextDue: null, lastResult: null };
        h.attempts = [...h.attempts, {
          ts: Date.now(),
          correct: r.correct,
          timeMs: r.timeMs || null,
          // #4 — the user's declared confidence for this answer (sure/unsure/
          // guess), or null for legacy/reveal. Powers the calibration report.
          conf: r.confidence || null,
          // True when the user tapped "Show answer" instead of attempting.
          // Counted as wrong (so the question feeds spaced repetition + Weak
          // Areas) but flagged so future granularity is possible without a
          // history backfill.
          revealed: r.revealed || false
        }];
        h.lastResult = r.correct ? 'right' : 'wrong';
        if (r.correct) h.reviewCount = (h.reviewCount || 0) + 1;
        else h.reviewCount = 0;
        const daysAhead = spacedRepetitionNext(h.lastResult, h.reviewCount);
        const next = new Date();
        next.setDate(next.getDate() + daysAhead);
        h.nextDue = next.toISOString();
        newHistory[r.qId] = h;
        // A revealed (Submit-without-answering) result is NEUTRAL: it is not an
        // attempt, so it stays out of both the daily denominator and the
        // accuracy %. It is still recorded above (revealed:true) and scheduled
        // for review so the user revisits what they didn't know.
        if (!r.revealed) attemptedToday++;
        if (r.correct) correctToday++;
      });

      const newDaily = [...prev.stats.dailyHistory];
      const todayIdx = newDaily.findIndex(d => d.date === today);
      if (todayIdx >= 0) {
        newDaily[todayIdx] = { date: today, attempted: newDaily[todayIdx].attempted + attemptedToday,
                               correct: newDaily[todayIdx].correct + correctToday };
      } else {
        newDaily.push({ date: today, attempted: attemptedToday, correct: correctToday });
      }
      // Keep last 60 days
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
      const filtered = newDaily.filter(d => new Date(d.date) >= cutoff);

      // Streak logic with one-day forgiveness per streak
      let streakCurrent = prev.stats.streakCurrent;
      let streakGraceAvailable = prev.stats.streakGraceAvailable !== false; // default true for old data
      let graceJustUsed = prev.stats.graceJustUsed || false;
      const lastDate = prev.stats.lastStudiedDate;
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(); dayBefore.setDate(dayBefore.getDate() - 2);
      const yStr = yesterday.toISOString().slice(0, 10);
      const dbStr = dayBefore.toISOString().slice(0, 10);

      if (lastDate === today) {
        // same day — no change
      } else if (lastDate === yStr) {
        // studied yesterday, normal increment
        streakCurrent = streakCurrent + 1;
      } else if (!lastDate) {
        // very first time
        streakCurrent = 1;
        streakGraceAvailable = true;
      } else if (lastDate === dbStr && streakGraceAvailable) {
        // missed exactly one day — use the grace token, streak continues.
        // Flag it so the user sees a one-time banner explaining what happened
        // — otherwise the save is invisible and they never learn the rule.
        streakCurrent = streakCurrent + 1;
        streakGraceAvailable = false;
        graceJustUsed = true;
      } else {
        // missed more than one day OR grace already used — reset
        streakCurrent = 1;
        streakGraceAvailable = true;
        graceJustUsed = false;
      }

      return {
        ...prev,
        history: newHistory,
        bookmarks: Array.from(bookmarkedLocal),
        stats: {
          ...prev.stats,
          totalAttempted: prev.stats.totalAttempted + attemptedToday,
          totalCorrect: prev.stats.totalCorrect + correctToday,
          streakCurrent,
          streakBest: Math.max(prev.stats.streakBest, streakCurrent),
          streakGraceAvailable,
          graceJustUsed,
          lastStudiedDate: today,
          dailyHistory: filtered
        }
      };
    });
    setNav({ screen: 'results', results, questions: nav.questions, elapsed, mode: nav.mode });
    // B2 — fold this run into the repeat-unattempted pool: presented questions
    // with no result (not answered, not revealed) and not skipped get queued to
    // come back first next time; anything now resolved or skipped is dropped.
    try {
      const presentedIds = Array.isArray(nav.questions) ? nav.questions.map(q => q.id) : [];
      if (presentedIds.length) {
        const resultIds = (results || []).map(r => r.qId);
        const skippedIds = skipCounts
          ? Object.keys(skipCounts).filter(qid => (skipCounts[qid] || 0) > 0)
          : [];
        const updated = nextPool(repeatPoolRef.current, { presentedIds, resultIds, skippedIds });
        repeatPoolRef.current = updated;
        saveRepeatPool(profile && profile.id, updated);
      }
    } catch (e) { /* pool is best-effort; never block results */ }
    // #18 — auto-resolve question solution flags: any still-open flag whose
    // question was just answered CORRECTLY clears itself, with a small
    // Achievements notification ("you got it right"). Fire-and-forget; a
    // storage failure can never block the results screen.
    if (profile && profile.id && results.some(r => r.correct)) {
      (async () => {
        try {
          const before = await loadQDoubts(profile.id);
          const { map: after, resolved: justResolved } = autoResolveQDoubts(before, results);
          if (justResolved.length === 0) return;
          await saveQDoubts(profile.id, after);
          const first = justResolved[0];
          const topicLabel = first && first.topic ? topicName(first.topic) : 'a flagged question';
          await pushNotification({
            type: 'doubt_milestone',
            dedupeMs: 60 * 1000,
            title: justResolved.length === 1
              ? `Your doubt on ${topicLabel} was auto-resolved`
              : `${justResolved.length} question doubts auto-resolved`,
            body: justResolved.length === 1
              ? 'You answered it correctly — the flag cleared itself.'
              : 'You answered them correctly this session — the flags cleared themselves.',
          });
        } catch (e) { /* silent — purely additive */ }
      })();
    }
    // GUEST MODE (Phase A): bump the local-only guest counter (drives nudges /
    // future explore->convert measurement). No-op for real accounts. Never
    // sent anywhere; purely local.
    if (isGuestProfile(profile)) {
      setGuestMeta(prev => {
        const next = { ...(prev || { firstSeen: Date.now(), quizzesAttempted: 0, signedUp: false }),
                       quizzesAttempted: ((prev && prev.quizzesAttempted) || 0) + 1 };
        saveGuestMeta(next);
        return next;
      });
    }
  }, [data, nav.questions, profile]);

  const saveCustomQuestion = useCallback((q) => {
    setData(prev => ({ ...prev, customQuestions: [...prev.customQuestions, q] }));
    goHome();
  }, [goHome]);

  const saveBulkQuestions = useCallback((qs) => {
    setData(prev => ({ ...prev, customQuestions: [...prev.customQuestions, ...qs] }));
    goHome();
  }, [goHome]);

  const importBackup = useCallback((payload) => {
    // Merge with defaults so older or partial backups don't break the app.
    // A11: walk the imported payload forward to current schema before the
    // spread-merge — a backup may be from an old version of the app.
    const migrated = runMigrations(payload);
    setData({
      ...DEFAULT_DATA,
      ...migrated,
      stats: { ...DEFAULT_DATA.stats, ...(migrated.stats || {}) },
      advancedTestHistory: migrated.advancedTestHistory || []
    });
  }, []);

  const startAdvancedTest = useCallback((spec) => {
    const pool = spec.pool && spec.pool.length >= spec.count ? spec.pool : allQuestions;
    const qs = shuffle(pool).slice(0, spec.count);
    setNav({
      screen: 'advanced-test',
      questions: qs,
      timeMinutes: spec.timeMinutes,
      strict: !!spec.strict,
      filters: { count: spec.count, difficulty: spec.difficulty, pyqOnly: spec.pyqOnly }
    });
  }, [allQuestions]);

  const submitAdvancedTest = useCallback(({ answers, timePerQ, elapsedSec, auto, timeMinutes, everCorrectIds }) => {
    const qs = nav.questions || [];
    let correct = 0, wrong = 0, blank = 0;
    qs.forEach(q => {
      const ans = answers[q.id] || [];
      if (ans.length === 0) blank++;
      else if (arraysEqualUnordered(ans, q.correct)) correct++;
      else wrong++;
    });
    const netScore = correct - (wrong / 3);
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    setData(prev => ({
      ...prev,
      advancedTestHistory: [
        ...(prev.advancedTestHistory || []),
        {
          ts: Date.now(),
          count: qs.length,
          correct, wrong, blank,
          netScore: Number(netScore.toFixed(2)),
          accuracy,
          elapsedSec,
          autoSubmitted: !!auto,
          filters: nav.filters || null
        }
      ].slice(-50)
    }));

    setNav({
      screen: 'advanced-results',
      questions: qs,
      answers,
      timePerQ,
      elapsedSec,
      timeMinutes,
      auto,
      everCorrectIds: everCorrectIds || []
    });
  }, [nav.questions, nav.filters]);

  // ===== P7 — Previous Year Papers =====
  // Admin-uploaded banks tagged type:'previous_paper' show up here as papers
  // (and are kept OUT of the regular Library — see the library render block).
  const paperBanks = useMemo(() => {
    const pid = profile ? profile.id : null;
    return banks.filter(b => b && b.type === 'previous_paper' && canSeeBank(b, pid, isAdmin));
  }, [banks, profile, isAdmin]);

  // Built-in papers + normalized admin paper-banks, in the shared paper shape.
  const allPapers = useMemo(() => {
    const fromBanks = paperBanks.map(b => ({
      id: b.id,
      year: b.year || null,
      name: b.name || b.id,
      // Default to ~1 min/question if the bank didn't specify a limit.
      timeMinutes: (typeof b.timeMinutes === 'number' && b.timeMinutes > 0)
        ? b.timeMinutes
        : Math.max(1, (Array.isArray(b.questions) ? b.questions.length : 1)),
      questions: Array.isArray(b.questions) ? b.questions : [],
      type: 'previous_paper',
      source: 'bank'
    }));
    return [...PREVIOUS_YEAR_PAPERS, ...fromBanks];
  }, [paperBanks]);

  // Launch a paper through the existing AdvancedTest engine. Questions are
  // NOT shuffled — a previous paper is sat in its original order.
  const startPaperTest = useCallback((paper) => {
    if (!paper || !Array.isArray(paper.questions) || paper.questions.length === 0) return;
    // P16 — a previous paper carries its year at the BANK level, not on each
    // question. Stamp provenance onto a COPY of each question so the PYQ badge
    // can show the real year in paper / mock mode. Non-mutating (new objects,
    // the shared PREVIOUS_YEAR_PAPERS array is untouched), in-memory only — it
    // never reaches storage (submitPaperTest persists only attempt stats) and
    // does not change the schema or scoring (id + correct are preserved).
    const py = (typeof paper.year === 'number' && paper.year > 0) ? paper.year : null;
    const questions = (isPYQ(paper.questions[0]) || !py)
      ? paper.questions
      : paper.questions.map(q => isPYQ(q) ? q : {
          ...q,
          isPYQ: true,
          pyqYear: py,
          source: q.source || `${paper.name || 'NORCET'} ${py} PYQ`
        });
    setNav({
      screen: 'paper-test',
      questions,
      timeMinutes: paper.timeMinutes,
      paperId: paper.id,
      paperName: paper.name
    });
  }, []);

  // #28 — open the Crib Sheet from an answers-map test (Advanced / PYQ paper:
  // `answers` is qId -> selected indices; blank = not attempted). Negative
  // marking badges mirror the engine's real scoring (+1 / −⅓).
  const openAnswersCrib = useCallback((title) => {
    const items = (nav.questions || []).map(q => {
      const ans = (nav.answers && nav.answers[q.id]) || [];
      const status = ans.length === 0 ? 'na' : (arraysEqualUnordered(ans, q.correct) ? 'correct' : 'wrong');
      return { q, selected: ans, status };
    });
    setNav({
      screen: 'crib-sheet', items,
      cribTitle: title,
      cribSubtitle: `${items.length} questions · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`,
      cribNegative: { plus: '1', minus: '\u2153' },
      backNav: nav,
    });
  }, [nav]);

  // Score a finished paper and append the attempt to data.previousPapers[id].
  // Mirrors submitAdvancedTest's scoring (negative marking), but writes to the
  // separate previousPapers section instead of advancedTestHistory.
  const submitPaperTest = useCallback(({ answers, timePerQ, elapsedSec, auto, timeMinutes }) => {
    const qs = nav.questions || [];
    const paperId = nav.paperId;
    let correct = 0, wrong = 0, blank = 0;
    qs.forEach(q => {
      const ans = answers[q.id] || [];
      if (ans.length === 0) blank++;
      else if (arraysEqualUnordered(ans, q.correct)) correct++;
      else wrong++;
    });
    const netScore = Number((correct - (wrong / 3)).toFixed(2));
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const attempt = {
      ts: Date.now(),
      count: qs.length,
      correct, wrong, blank,
      netScore, accuracy,
      elapsedSec,
      autoSubmitted: !!auto
    };

    if (paperId) {
      setData(prev => {
        const all = (prev.previousPapers && typeof prev.previousPapers === 'object' && !Array.isArray(prev.previousPapers))
          ? prev.previousPapers : {};
        const existing = all[paperId] || {};
        const priorAttempts = Array.isArray(existing.attempts) ? existing.attempts : [];
        // Cap per-paper attempt history at 20 (matches the spirit of the
        // advancedTestHistory -50 cap; per-paper so a smaller cap is fine).
        const attempts = [...priorAttempts, attempt].slice(-20);
        const bestNet = attempts.reduce((m, a) => Math.max(m, a.netScore), -Infinity);
        return {
          ...prev,
          previousPapers: {
            ...all,
            [paperId]: { attempts, bestNet, lastTs: attempt.ts, lastAccuracy: accuracy }
          }
        };
      });
    }

    setNav({
      screen: 'paper-results',
      questions: qs,
      answers,
      timePerQ,
      elapsedSec,
      timeMinutes,
      auto,
      paperName: nav.paperName
    });
  }, [nav.questions, nav.paperId, nav.paperName]);

  const setExamDate = useCallback((dateStr) => {
    setData(prev => ({ ...prev, stats: { ...prev.stats, examDate: dateStr } }));
  }, []);

  const clearExamDate = useCallback(() => {
    setData(prev => ({ ...prev, stats: { ...prev.stats, examDate: null, dailyTarget: null } }));
    goHome();
  }, [goHome]);

  const setDailyTarget = useCallback((n) => {
    // null/0 → auto; positive number → manual override
    const v = (typeof n === 'number' && n > 0) ? n : null;
    setData(prev => ({ ...prev, stats: { ...prev.stats, dailyTarget: v } }));
    goHome();
  }, [goHome]);

  // PHIL-03 — current economy snapshot in a ref so claimWhyBonus can decide
  // (awarded vs already-claimed) synchronously, then commit via setData.
  const economyRef = useRef(null);
  economyRef.current = data && data.economy;
  const claimWhyBonus = useCallback((questionId) => {
    const { economy, awarded } = claimWhyBonusPure(economyRef.current, questionId);
    if (awarded) setData(prev => ({ ...prev, economy }));
    return awarded;
  }, []);

  // NEW-02 — merge a demographics patch into the synced profile blob. Defaults
  // customTargetPercentile to the UR/Open-Merit standard (98.5) the first time
  // anything is set. setData auto-persists + syncs, so no extra plumbing.
  const setDemographics = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setData(prev => {
      const cur = (prev && prev.demographics) || {};
      const next = { ...cur, ...patch };
      if (typeof next.customTargetPercentile !== 'number') next.customTargetPercentile = DEFAULT_TARGET_PERCENTILE;
      return { ...prev, demographics: next };
    });
  }, []);

  const completeDosage = useCallback((results, questions) => {
    setNav({ screen: 'dosage-results', results, questions });
  }, []);

  // Record that the user opened the Revision sheet today, storing a snapshot
  // of that day's set so they can jump back to it later. One entry per day —
  // re-opening the same day refreshes the snapshot. Capped to the last 60 days.
  const recordRevisionVisit = useCallback((ids) => {
    const arr = Array.from(ids || []);
    if (arr.length === 0) return;
    const dateKey = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
    setData(prev => {
      if (!prev) return prev;
      const log = (Array.isArray(prev.revisionLog) ? prev.revisionLog : []).filter(e => e.date !== dateKey);
      log.unshift({ date: dateKey, ts: Date.now(), ids: arr });
      log.sort((a, b) => b.ts - a.ts);
      return { ...prev, revisionLog: log.slice(0, 60) };
    });
  }, []);

  // Toggle a bookmark from any screen (not just inside Quiz). Used by the
  // read-only Bookmarks viewer's "Remove" button so the user can prune
  // without re-entering the question.
  const toggleBookmarkById = useCallback((qId) => {
    setData(prev => {
      const set = new Set(prev.bookmarks || []);
      if (set.has(qId)) set.delete(qId); else set.add(qId);
      return { ...prev, bookmarks: Array.from(set) };
    });
  }, []);

  const clearAll = useCallback(() => {
    // Only resets THIS profile's progress. Other profiles untouched.
    setData(DEFAULT_DATA);
    goHome();
  }, [goHome]);

  // Commit a real account session. `finalData` is the account's canonical data
  // (post schema-walk), OPTIONALLY already merged with guest progress (Phase
  // B). Profile + data are set SYNCHRONOUSLY first so there's never a frame of
  // mismatched identity/data; the rest (announcement, guestMeta, tour) follows.
  const commitAuth = useCallback(async (p, finalData) => {
    setProfile(p);
    setData(finalData);
    setLegacyData(null);
    setNav({ screen: 'home' });
    touchProfileActivity(p.id);
    try { setLogContext({ profileId: p.id }); } catch (e) {}
    loadAnnouncement().then(setAnnouncement).catch(() => {});
    // GUEST MODE: a real account is now active — stop the guest nudges.
    try {
      const gm = await loadGuestMeta();
      const next = { ...gm, signedUp: true };
      await saveGuestMeta(next); setGuestMeta(next);
    } catch (e) {}
    // Welcome tour for a brand-new, EMPTY profile that hasn't seen it (mirrors
    // the boot-path check). After a guest MERGE the data is no longer empty, so
    // the tour correctly will NOT show for a returning-via-merge user.
    try {
      const seen = await hasSeenOnboarding(p.id);
      const isBrandNew = finalData.stats.totalAttempted === 0
        && finalData.customQuestions.length === 0
        && finalData.bookmarks.length === 0;
      if (!seen && isBrandNew) setShowWelcome(true);
    } catch (e) { /* tour is non-critical; never block auth on it */ }
  }, []);

  // GUEST MODE (Phase B): entry point from AuthScreen on successful sign-up /
  // login. Build the account's canonical data, then decide whether to OFFER a
  // guest-progress merge. The merge is offered only when (a) a guest blob
  // exists, (b) it has genuine activity, and (c) it hasn't already been merged
  // (clearGuestData removes it after any choice, so a later logout->login can't
  // re-merge stale data). Otherwise we commit straight through — identical to
  // the pre-Phase-B behaviour for a normal account login.
  const handleAuthed = useCallback(async (p) => {
    const accountData = normalizeUserData(p.data || {});
    let guestData = null;
    try {
      const gb = await loadGuestData();
      if (gb) guestData = normalizeUserData(gb);
    } catch (e) {}
    if (guestData && guestBlobHasActivity(guestData)) {
      mergeResolveBusyRef.current = false; // arm the re-entrancy guard for this offer
      setPendingMerge({ profile: p, accountData, guestData });
      return;                              // pause auth until the user chooses
    }
    await commitAuth(p, accountData);
  }, [commitAuth]);

  // Resolve the "Keep your guest progress?" choice. keep=true MERGES guest
  // into the account (account canonical, never regressed); keep=false discards
  // it. Either way the guest blob is cleared and the account session commits.
  // Re-entrancy-guarded: a second tap while resolving is a no-op.
  const resolveGuestMerge = useCallback((keep) => {
    if (mergeResolveBusyRef.current) return;
    mergeResolveBusyRef.current = true;
    const pm = pendingMerge;
    if (!pm) { mergeResolveBusyRef.current = false; return; }
    let finalData = pm.accountData;
    if (keep) {
      try {
        finalData = mergeGuestIntoAccount(pm.accountData, pm.guestData);
      } catch (e) {
        try { log.error('guest.merge', e); } catch (_) {}
        finalData = pm.accountData; // a merge failure must never block sign-in
      }
    }
    // Commit synchronously (profile + data inside commitAuth) BEFORE clearing
    // the guest blob, so there's no flash of guest UI between dialog and home.
    setPendingMerge(null);
    commitAuth(pm.profile, finalData);
    // End the guest session regardless of choice (the "already merged" guard).
    clearGuestData();
  }, [pendingMerge, commitAuth]);

  const handleLogout = useCallback(async () => {
    await saveSession(null);
    // Session 4, Item 4 — drop admin privilege on logout/switch so it never
    // leaks into the next profile loaded in the same JS session.
    setIsAdmin(false);
    // GUEST MODE (Phase A): logging out lands in guest mode (not the old
    // wall). Load any prior guest-local blob so a returning guest keeps their
    // separate guest progress; the account's data is untouched in storage.
    const index = await loadProfileIndex();
    setAuthInitialMode(index.length > 0 ? 'login' : 'create');
    try {
      const guestBlob = await loadGuestData();
      const migratedGuest = runMigrations(guestBlob || {});
      const guestData = {
        ...DEFAULT_DATA,
        ...migratedGuest,
        stats: { ...DEFAULT_DATA.stats, ...(migratedGuest.stats || {}) },
        advancedTestHistory: migratedGuest.advancedTestHistory || [],
        preferences: { ...DEFAULT_DATA.preferences, ...(migratedGuest.preferences || {}) }
      };
      setProfile(makeGuestProfile());
      setData(guestData);
      const gm = await loadGuestMeta(); setGuestMeta(gm);
    } catch (e) {
      setProfile(makeGuestProfile());
      setData({ ...DEFAULT_DATA });
    }
    setLegacyData(null);
    setGuestBannerDismissed(false);
    setNav({ screen: 'home' });
  }, []);

  // ===== Rename profile =====
  // Flushes any pending profile save first so we don't lose unsaved progress
  // mid-rename, then performs the rename, then updates local state and the
  // session pointer if the id changed. Errors bubble to the calling modal.
  const handleRenameProfile = useCallback(async (newDisplayName) => {
    if (!profile) throw new Error('Not logged in');

    // Force-flush the debounced profile save BEFORE renaming. If we rename
    // first, the debounced save fires later with the OLD profile object and
    // writes a duplicate blob under the old key.
    if (saveTimerRef.current && pendingSaveRef.current) {
      clearTimeout(saveTimerRef.current);
      const p = pendingSaveRef.current;
      await saveProfile({ ...p.profile, data: p.data });
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
    }

    // Always rename from the latest in-memory state so user's most recent
    // session data goes into the renamed blob.
    const latest = { ...profile, data };
    const updated = await renameProfile(latest, newDisplayName);

    // If the id changed, update the session pointer too.
    if (updated.id !== profile.id) {
      await saveSession({ profileId: updated.id });
    }

    setProfile(updated);
    // `data` was preserved on the renamed blob; React state stays as-is.
    return updated;
  }, [profile, data]);

  // ===== Admin =====
  // A4: passphrase is the UX gate (don't pop admin UI on a stray tap), but
  // the SOURCE OF TRUTH is the server. We only grant isAdmin if BOTH the
  // passphrase verifies AND the current profile id is in admin_profile_ids
  // on Supabase. Returns a string reason on failure so the form can tell the
  // user WHY (wrong passphrase vs. this profile isn't an admin vs. offline).
  const handleUnlockAdmin = useCallback(async (passphrase) => {
    let passOk;
    try {
      passOk = await verifyAdminPassphrase(passphrase); // server-side check
    } catch (e) {
      // Couldn't reach the verify function (offline / unreachable). Don't claim
      // "wrong passphrase" — surface the same offline path as the server check.
      return 'not-authorized';
    }
    if (!passOk) return false; // form shows "Incorrect passphrase"
    const pid = profile ? profile.id : null;
    const uid = profile ? profile.uid : null;
    const serverOk = await checkServerAdmin(pid, uid);
    if (!serverOk) {
      // Passphrase right, but this profile isn't authorised server-side (or
      // we're offline / Supabase unreachable). Do NOT grant — fail closed.
      return 'not-authorized';
    }
    await saveAdminStatus(true);
    setIsAdmin(true);
    return true;
  }, [profile]);

  const handleLockAdmin = useCallback(async () => {
    await saveAdminStatus(false);
    setIsAdmin(false);
  }, []);

  // ===== Announcements =====
  // A4: writes go through the admin direct-fetch path and can THROW (network,
  // not-authorised, config). Surface the failure to the caller instead of
  // optimistically flipping local state, so the admin sees a real result.
  const handleSaveAnnouncement = useCallback(async (text, level, expiresDays = null) => {
    const pid = profile ? profile.id : null;
    const entry = await saveAnnouncement(text, level, pid, expiresDays); // throws on failure
    setAnnouncement(entry);
    return entry;
  }, [profile]);

  // #12 — history management for the admin panel.
  const handleLoadAnnHistory = useCallback(() => loadAnnouncementHistory(), []);
  const handleDeleteAnnHistoryItem = useCallback(async (id) => {
    await deleteAnnouncementHistoryItem(id, profile ? profile.id : null);
    return loadAnnouncementHistory();
  }, [profile]);
  const handleClearAnnHistory = useCallback(async () => {
    await clearAnnouncementHistory(profile ? profile.id : null);
    return [];
  }, [profile]);

  const handleClearAnnouncement = useCallback(async () => {
    const pid = profile ? profile.id : null;
    await clearAnnouncement(pid); // throws on failure
    setAnnouncement(null);
  }, [profile]);

  // A4: server re-verify of cached admin status. The boot path optimistically
  // trusts the local KEYS.ADMIN_STATUS cache so a legit admin's UI doesn't
  // flicker. This effect then confirms against Supabase whenever we have both
  // a profile and a cached-admin flag:
  //   - If online and the server says this profile is NOT an admin → silently
  //     downgrade and clear the cache (covers a profile that was de-listed, or
  //     a stale/forged cache).
  //   - If offline / Supabase unreachable → leave the cached flag alone. The
  //     admin keeps their UI, but any actual admin WRITE still goes through the
  //     server and will be rejected there, so no privilege is actually granted.
  // We intentionally do NOT auto-PROMOTE here: unlock always requires the
  // passphrase via handleUnlockAdmin. This effect can only ever downgrade.
  useEffect(() => {
    if (!isAdmin) return;            // nothing to verify
    if (!profile || !profile.id) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // offline: keep cache
    let cancelled = false;
    (async () => {
      const ok = await checkServerAdmin(profile.id, profile.uid);
      if (cancelled) return;
      if (!ok) {
        // Definitive (online) negative — drop admin silently.
        await saveAdminStatus(false);
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, profile]);

  const dismissAnnouncement = useCallback((id) => {
    setData(prev => ({ ...prev, dismissedAnnouncementId: id }));
  }, []);

  // Clear the one-time "streak saved by grace" banner once the user has read it.
  const dismissGrace = useCallback(() => {
    setData(prev => ({ ...prev, stats: { ...prev.stats, graceJustUsed: false } }));
  }, []);

  // "Hide for today" on the spaced-revision reminder card. Tomorrow's date
  // resets the gate naturally without us needing a scheduled clear.
  const dismissReviewToday = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setData(prev => ({
      ...prev,
      preferences: { ...(prev.preferences || {}), reviewDismissedDate: today }
    }));
  }, []);

  // Permanent on/off for the spaced-revision Home card. When re-enabling we
  // also clear any "hidden for today" flag so the user sees the card again
  // immediately rather than having to wait until tomorrow.
  const toggleReviewReminders = useCallback((enabled) => {
    setData(prev => ({
      ...prev,
      preferences: {
        ...(prev.preferences || {}),
        reviewRemindersEnabled: !!enabled,
        ...(enabled ? { reviewDismissedDate: null } : {})
      }
    }));
  }, []);

  // P18 — opt GK & Aptitude (non-nursing) topics in/out of nursing analytics.
  const toggleIncludeGkInStats = useCallback((on) => {
    setData(prev => ({
      ...prev,
      preferences: { ...(prev.preferences || {}), includeGkInStats: !!on }
    }));
  }, []);

  // P3 — daily reminder preference. Turning ON requests Notification
  // permission and only persists enabled:true if it's granted (so the toggle
  // can't claim to be on while silently muted). Stored in data.preferences
  // (local IndexedDB via saveProfile, shared:false, like every other pref).
  // Returns the resulting permission so Settings can show a "blocked" hint.
  const setDailyReminder = useCallback(async (patch) => {
    let grant = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
    let enabled = patch.enabled;
    if (patch.enabled === true) {
      if (typeof Notification === 'undefined') { enabled = false; }
      else {
        if (Notification.permission === 'default') {
          try { grant = await Notification.requestPermission(); } catch (e) { grant = Notification.permission; }
        } else { grant = Notification.permission; }
        if (grant !== 'granted') enabled = false; // can't enable without permission
      }
    }
    let effTime = patch.time || '20:00';
    setData(prev => {
      const cur = (prev.preferences && prev.preferences.dailyReminder) || {};
      const merged = {
        enabled: typeof enabled === 'boolean' ? enabled : (cur.enabled || false),
        time: patch.time || cur.time || '20:00',
        lastNotified: cur.lastNotified || null
      };
      effTime = merged.time; // capture freshest time for the push subscription
      return { ...prev, preferences: { ...(prev.preferences || {}), dailyReminder: merged } };
    });
    // Session 5 — when reminders are on + permission granted, (re)register the
    // Web Push subscription so the cron can reach this device in the background.
    // No-ops entirely when VAPID isn't configured (subscribeToPush guards that).
    if (enabled === true && grant === 'granted') { subscribeToPush(effTime); }
    return grant;
  }, []);

  // P3 — best-effort daily nudge. vite-plugin-pwa's service worker can't do
  // TRUE background push without a push server, so this is the practical
  // fallback: when the app is opened (or the tab becomes visible), if
  // reminders are on + permission granted + the user hasn't studied today +
  // it's past their reminder time + we haven't nudged today, fire a local
  // notification through the SW registration (foreground-capable).
  //
  // TRUE BACKGROUND PUSH (not implemented) would need: a push server signing
  // payloads with VAPID keys, PushManager.subscribe() to store a subscription,
  // and a 'push' handler in the service worker. Periodic Background Sync (a
  // 'periodicsync' handler in the SW) could also run this check while the app
  // is closed on supported, installed PWAs. Both require editing the generated
  // service worker + backend, out of scope here.
  const drPref = data && data.preferences && data.preferences.dailyReminder;
  const drEnabled = !!(drPref && drPref.enabled);
  const drTime = drPref && drPref.time;
  const drLast = drPref && drPref.lastNotified;
  const lastStudied = data && data.stats && data.stats.lastStudiedDate;
  useEffect(() => {
    if (!profile || !drEnabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const maybeNotify = async () => {
      const today = todayStr();
      if (drLast === today) return;            // already nudged today
      if (lastStudied === today) return;       // already studied today
      const [hh, mm] = String(drTime || '20:00').split(':').map(n => parseInt(n, 10) || 0);
      const now = new Date();
      const past = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
      if (!past) return;
      try {
        const opts = { body: 'Your streak is at risk! Open NORCET Prep to keep it alive 🔥', tag: 'norcet-daily-reminder' };
        const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
        if (reg && reg.showNotification) await reg.showNotification('NORCET Prep', opts);
        else new Notification('NORCET Prep', opts);
        // Feature 7 — also log the reminder into the in-app Notification Center
        // (Feature 6), so it's visible even if the OS notification was missed.
        await pushNotification({
          type: 'daily_reminder',
          title: 'Time to study! 📚',
          body: 'Your NORCET prep session is waiting. Even 15 minutes of focused practice counts.',
          action: null,
        });
        setData(prev => ({
          ...prev,
          preferences: {
            ...(prev.preferences || {}),
            dailyReminder: { ...((prev.preferences || {}).dailyReminder || {}), lastNotified: today }
          }
        }));
      } catch (e) { /* notification failed — ignore quietly */ }
    };

    maybeNotify();
    const onVis = () => { if (document.visibilityState === 'visible') maybeNotify(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [profile, drEnabled, drTime, drLast, lastStudied]);

  // P4 — keep this user's leaderboard row fresh. Cumulative stats only change
  // at the END of a session (quiz/mock/paper/drill all roll up into
  // totalAttempted / streakCurrent), so depending on those two means the
  // upsert fires once per finished session — plus once on load to register
  // returning users. Shared write; fails quietly offline; skips zero-activity
  // users. We intentionally read the live `data` snapshot without listing it
  // as a dep, so an unrelated data change doesn't trigger an extra write.
  const lbTotal = data && data.stats && data.stats.totalAttempted;
  const lbStreak = data && data.stats && data.stats.streakCurrent;
  useEffect(() => {
    if (!profile || isGuestProfile(profile) || !lbTotal) return;
    saveLeaderboardEntry(profile, data, allQuestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, lbTotal, lbStreak]);

  // ===== My feedback (replies the admin sent back) =====
  const refreshMyReports = useCallback(async () => {
    if (!profile) return;
    setMyReportsLoading(true);
    try {
      const list = await listMyFeedback(profile.id);
      setMyReports(list);
    } finally {
      setMyReportsLoading(false);
    }
  }, [profile]);

  // Acknowledge every reply currently visible so the "new" badge clears.
  const markRepliesSeen = useCallback(() => {
    setData(prev => {
      const seen = { ...(prev.feedbackRepliesSeen || {}) };
      let changed = false;
      myReports.forEach(r => {
        if ((r.reply || r.status) && r.repliedAt && seen[r.id] !== r.repliedAt) {
          seen[r.id] = r.repliedAt;
          changed = true;
        }
      });
      return changed ? { ...prev, feedbackRepliesSeen: seen } : prev;
    });
  }, [myReports]);

  // ===== Banks =====
  const refreshBanks = useCallback(async () => {
    setBanksLoading(true);
    try {
      const list = await listBanks();
      setBanks(list);
    } finally {
      setBanksLoading(false);
    }
  }, []);

  const handleOpenLibrary = useCallback(() => {
    setNav({ screen: 'library' });
    refreshBanks();
  }, [refreshBanks]);

  const handleOpenBank = useCallback(async (bankId) => {
    setBanksLoading(true);
    const fresh = await loadBank(bankId);
    setBanksLoading(false);
    if (fresh && canSeeBank(fresh, profile ? profile.id : null, isAdmin)) {
      setNav({ screen: 'bank-detail', bankId, bank: fresh });
    } else { setNav({ screen: 'library' }); refreshBanks(); }
  }, [refreshBanks, isAdmin, profile]);

  const handleSaveBank = useCallback(async (bank) => {
    await saveBank(bank);
    await refreshBanks();
    setNav({ screen: 'bank-detail', bankId: bank.id, bank });
  }, [refreshBanks]);

  const handleDeleteBank = useCallback(async (bankId) => {
    await deleteBank(bankId);
    await refreshBanks();
    setNav({ screen: 'library' });
  }, [refreshBanks]);

  // Visibility change — allowed for the bank's owner, or any bank for admin.
  const handleSetBankVisibility = useCallback(async (bank, visibility) => {
    if (!bank) return;
    const allowed = isAdmin || isBankOwner(bank, profile ? profile.id : null);
    if (!allowed) return;
    const updated = await setBankVisibility(bank.id, visibility);
    await refreshBanks();
    if (updated) setNav({ screen: 'bank-detail', bankId: updated.id, bank: updated });
  }, [refreshBanks, isAdmin, profile]);

  const handleImportBank = useCallback((bank, replaceExisting) => {
    // Stable per-question id so updates can preserve history.
    // bankq:{bankId}:{questionInternalId} → consistent across versions.
    const stamped = bank.questions.map((q) => ({
      ...q,
      id: `bankq-${bank.id}-${q.id}`,
      custom: true,
      sourceBank: bank.id,
      sourceBankName: bank.name,
      sourceBankVersion: bank.version
    }));
    setData(prev => {
      // Always drop prior imports from this bank so we don't duplicate or
      // keep stale content; user progress (data.history keyed by qId) is
      // unaffected because the new stamped ids are deterministic.
      const filtered = prev.customQuestions.filter(q => q.sourceBank !== bank.id);
      // Importing also clears any prior "disabled" mark for this bank — the
      // user is clearly opting in to its questions.
      const nextDisabled = { ...(prev.disabledBanks || {}) };
      delete nextDisabled[bank.id];
      return {
        ...prev,
        customQuestions: [...filtered, ...stamped],
        bankVersionsSeen: { ...(prev.bankVersionsSeen || {}), [bank.id]: bank.version },
        disabledBanks: nextDisabled
      };
    });
    goHome();
  }, [goHome]);

  // Pause / resume an imported bank without deleting it. The bank's questions
  // remain in customQuestions (so history, bookmarks, accuracy stats survive),
  // but `allQuestions` filters them out while the bank is disabled.
  const handleToggleBankEnabled = useCallback((bankId, enabled) => {
    setData(prev => {
      const next = { ...(prev.disabledBanks || {}) };
      if (enabled) {
        delete next[bankId];
      } else {
        next[bankId] = true;
      }
      return { ...prev, disabledBanks: next };
    });
  }, []);

  // Auto-sync imported banks to latest version, and compute "what's new"
  const syncImportedBanks = useCallback(async () => {
    const all = await listBanks();
    setBanks(all);

    if (!data) return;

    // Only consider banks the user is allowed to see (public, own private, or
    // anything if admin) — so private banks never leak via sync or "what's new".
    const pid = profile ? profile.id : null;
    const list = all.filter(b => canSeeBank(b, pid, isAdmin));

    // Find banks the user has imported where the live bank is at a newer version
    const importedBankIds = new Set(
      data.customQuestions.filter(q => q.sourceBank).map(q => q.sourceBank)
    );
    const seenMap = data.bankVersionsSeen || {};
    const pubSeenMap = data.bankPublishedSeen || {};
    const updates = [];

    list.forEach(b => {
      const seenVer = seenMap[b.id] || 0;
      const lastImportedVer = Math.max(
        seenVer,
        ...data.customQuestions
          .filter(q => q.sourceBank === b.id)
          .map(q => q.sourceBankVersion || 0)
      );
      if (importedBankIds.has(b.id) && b.version > lastImportedVer) {
        updates.push(b);
      }
    });

    if (updates.length > 0) {
      // Auto-sync: replace imported questions with the latest version.
      // History is preserved automatically because bankq IDs are stable.
      setData(prev => {
        let newCustom = prev.customQuestions.slice();
        const newSeen = { ...(prev.bankVersionsSeen || {}) };
        updates.forEach(bank => {
          newCustom = newCustom.filter(q => q.sourceBank !== bank.id);
          const stamped = bank.questions.map(q => ({
            ...q,
            id: `bankq-${bank.id}-${q.id}`,
            custom: true,
            sourceBank: bank.id,
            sourceBankName: bank.name,
            sourceBankVersion: bank.version
          }));
          newCustom = [...newCustom, ...stamped];
          // Don't mark as "seen" here — leave it so the What's New badge appears
        });
        return { ...prev, customQuestions: newCustom, bankVersionsSeen: newSeen };
      });
      setWhatsNew(updates.map(b => ({ id: b.id, name: b.name, version: b.version, publishedAt: b.publishedAt || 0 })));
    } else {
      // Banks the user hasn't imported but that have either a newer version OR
      // are newly published (e.g. just flipped from private → public). Either
      // signal counts as discovery, tracked in two separate seen maps so a
      // version bump and a re-publish stay independent.
      const fresh = list.filter(b => {
        if (importedBankIds.has(b.id)) return false;
        const seenVer = seenMap[b.id] || 0;
        const seenPub = pubSeenMap[b.id] || 0;
        const versionFresh  = b.version > seenVer;
        const publishedFresh = !!b.publishedAt && b.publishedAt > seenPub;
        return versionFresh || publishedFresh;
      });
      if (fresh.length > 0) {
        setWhatsNew(fresh.map(b => ({ id: b.id, name: b.name, version: b.version, publishedAt: b.publishedAt || 0 })));
      }
    }
  }, [data, profile, isAdmin]);

  // Run bank sync once after data loads
  const syncedOnceRef = useRef(false);
  useEffect(() => {
    if (data && profile && !loading && !syncedOnceRef.current) {
      syncedOnceRef.current = true;
      syncImportedBanks();
      refreshMyReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, profile, loading]);

  // Opening "My feedback": pull the latest, and acknowledge any replies shown.
  useEffect(() => {
    if (nav.screen === 'my-reports') refreshMyReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.screen]);
  useEffect(() => {
    if (nav.screen === 'my-reports' && myReports.length > 0) markRepliesSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.screen, myReports]);

  const dismissWhatsNew = useCallback(() => {
    if (!data || whatsNew.length === 0) return;
    setData(prev => {
      const seen = { ...(prev.bankVersionsSeen || {}) };
      const pubSeen = { ...(prev.bankPublishedSeen || {}) };
      whatsNew.forEach(it => {
        seen[it.id] = it.version;
        if (it.publishedAt) pubSeen[it.id] = it.publishedAt;
      });
      return { ...prev, bankVersionsSeen: seen, bankPublishedSeen: pubSeen };
    });
    setWhatsNew([]);
  }, [data, whatsNew]);

  // ===== Theme + welcome =====
  const toggleTheme = useCallback(async () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    await saveThemeMode(next);
  }, [themeMode]);

  const setColorTheme = useCallback(async (id) => {
    if (!THEMES[id]) return;
    setThemeMode(id);
    await saveThemeMode(id);
  }, []);

  // Feature 4 — load the dismissed-week marker once at boot; if it matches the
  // current ISO week, the weekly summary stays hidden until next Monday.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await safeStorage.get(KEYS.WEEKLY_SUMMARY_DISMISSED);
        if (!cancelled && r && r.value === getISOWeek()) setWeeklySummaryDismissed(true);
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const dismissWeeklySummary = useCallback(async () => {
    setWeeklySummaryDismissed(true);
    try { await safeStorage.set(KEYS.WEEKLY_SUMMARY_DISMISSED, getISOWeek()); } catch (e) {}
  }, []);

  // Feature 6 — keep the Home bell badge accurate. Recompute the unread count
  // from storage on mount and on every navigation (so it refreshes when the
  // user returns from the Notification Center after marking things read).
  useEffect(() => {
    loadNotifications().then(list => {
      setUnreadNotifCount(list.filter(n => !n.read).length);
    }).catch(() => {});
  }, [nav.screen]);

  // Session 5 — tell the server this device opened today (so the cron skips
  // it). Fire-and-forget on mount; no-ops when push isn't configured / no sub.
  useEffect(() => { pingActive(); }, []);

  // F-E — gentle nudge for doubts left unresolved 7+ days, throttled to ~once
  // every 3 days via a local timestamp, surfaced through the notification inbox.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      try {
        const map = await loadDoubtsForNudge(profile.id);
        const stale = staleUnresolvedCount(map, 7);
        if (cancelled || stale <= 0) return;
        const r = await safeStorage.get(KEYS.DOUBT_NUDGE_TS, false);
        const last = r && r.value ? parseInt(r.value, 10) : 0;
        if (Date.now() - last < 3 * 86400000) return;
        await pushNotification({
          type: 'doubt_nudge',
          title: 'Unresolved doubts',
          body: `You have ${stale} flagged point${stale === 1 ? '' : 's'} waiting to be cleared up. A quick re-read could close the gap.`,
          action: { screen: 'doubts' },
        });
        await safeStorage.set(KEYS.DOUBT_NUDGE_TS, String(Date.now()), false);
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [profile]);

  // Session 4, Item 2 — blur the whole app while it's backgrounded / unfocused.
  // (Named visibilitychange handler so cleanup removes the SAME reference.)
  useEffect(() => {
    const blur = () => document.body.classList.add('app-blurred');
    const unblur = () => document.body.classList.remove('app-blurred');
    const onVis = () => { document.hidden ? blur() : unblur(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', unblur);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', unblur);
    };
  }, []);

  const dismissWelcome = useCallback(async () => {
    setShowWelcome(false);
    setNav({ screen: 'home' });   // always land on Home, regardless of what nav held before
    cameFromWelcomeRef.current = false;
    // GUEST MODE (Phase A): do NOT mark onboarding "seen" for the guest
    // sentinel — guests keep getting the tour each launch until they sign up
    // (an account, once created, marks it seen and never re-shows). This is
    // the deliberate "keep onboarding the not-yet-signed-up user" behaviour.
    if (profile && !isGuestProfile(profile)) await markOnboardingSeen(profile.id);
  }, [profile]);

  const reopenWelcome = useCallback(() => {
    setShowWelcome(true);
  }, []);

  // ===== Quick Practice setup =====
  const startQuickPractice = useCallback(({ count, pulse }) => {
    // NEW-03 — remember The Pulse choice so topic-wise tests inherit it too.
    setData(prev => ({ ...prev, preferences: { ...prev.preferences, quickCount: count, ...(pulse !== undefined ? { pulseTimer: !!pulse } : {}) } }));
    // #20 — Quick Test is a topic-balanced black box: sample the whole syllabus
    // in proportion to the real exam's topic weightage (derived from the PYQ
    // papers), preferring fresh/unseen questions (#21) and naturally blending
    // in PYQ-tagged items (#25, they live in allQuestions).
    const weights = examTopicWeightage(PREVIOUS_YEAR_PAPERS, false);
    const qs = selectBalancedQuestions(allQuestions, count, weights, data ? data.history : {});
    const pulseOn = pulse !== undefined ? !!pulse : !!(data && data.preferences && data.preferences.pulseTimer);
    setNav({ screen: 'quiz', questions: qs, mode: 'quick', timed: false, pulse: pulseOn });
  }, [allQuestions, data]);

  const bridgeBanner = (bridgeDead && !bridgeWarnDismissed) ? (
    <div className="anim-fadeup" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: T.accent, color: '#fff',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.18)'
    }}>
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div className="text-xs" style={{ lineHeight: 1.4, flex: 1 }}>
        <span style={{ fontWeight: 700 }}>Your progress won't be saved here.</span>{' '}
        Storage isn't reachable in this mode. Open the app in your browser
        (not the home-screen shortcut) so your work is saved.
      </div>
      <button onClick={() => setBridgeWarnDismissed(true)}
              aria-label="Dismiss"
              className="no-tap-highlight"
              style={{ flexShrink: 0, background: 'transparent', border: 'none',
                       color: '#fff', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
        <X size={18} />
      </button>
    </div>
  ) : null;

  // [A7 step 36] Wrap every render branch (loading / guest-merge / auth /
  // welcome / main) in the context providers, fed by this render's live state.
  // Defined here — after all state, isAdmin, allQuestions and the T/IS_DARK
  // bridge are in scope — so every branch below can `return provide(<...>)`.
  // This guarantees Pill/Button/TopBar/FeedbackButton (which read the context
  // hooks) resolve in ALL branches, and is the mount point screens attach to as
  // they are extracted in steps 37-38.
  const provide = (node) => (
    <AppProviders
      theme={T} themeMode={themeMode} setThemeMode={setThemeMode} isDark={IS_DARK}
      profile={profile} setProfile={setProfile} isAdmin={isAdmin}
      data={data} setData={setData} allQuestions={allQuestions}>
      {node}
      {pendingBatchId && (
        <BatchJoinModal batchId={pendingBatchId}
                        onDone={() => { clearPendingBatch(); setPendingBatchId(null); }} />
      )}
    </AppProviders>
  );

  if (loading || sessionResolving) {
    return provide(
      <div className="font-body min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <style>{fontStyles}</style>
        <div className="text-center px-8 max-w-sm mx-auto">

          {/* App name */}
          <div className="font-display text-3xl font-semibold mb-1" style={{ color: T.primary }}>NORCET prep</div>

          {/* Thin accent rule */}
          <div className="mx-auto mb-6 mt-3 rounded-full"
               style={{ width: 36, height: 2, background: T.primary, opacity: 0.3 }} />

          {/* Motivational quote */}
          <p className="text-sm leading-relaxed italic mb-8" style={{ color: T.inkSoft }}>
            Remember, it's never where you started,<br />
            it's always where you finished.
          </p>

          {/* Animated loading dots */}
          <div className="flex items-center justify-center gap-1.5">
            <span className="loading-dot w-1.5 h-1.5 rounded-full" style={{ background: T.primary }} />
            <span className="loading-dot w-1.5 h-1.5 rounded-full" style={{ background: T.primary }} />
            <span className="loading-dot w-1.5 h-1.5 rounded-full" style={{ background: T.primary }} />
          </div>

        </div>
      </div>
    );
  }

  // GUEST MODE (Phase B): auth is paused on the "Keep your guest progress?"
  // choice. Rendered as its own screen so nothing inconsistent shows behind it
  // (profile/data are not swapped to the account until the choice is made).
  if (pendingMerge) {
    return provide(
      <div className="font-body min-h-screen" style={{ background: T.bg, color: T.ink }}>
        <style>{fontStyles}</style>
        <GuestMergePrompt
          guestData={pendingMerge.guestData}
          onKeep={() => resolveGuestMerge(true)}
          onDiscard={() => resolveGuestMerge(false)}
        />
      </div>
    );
  }

  if (!profile || !data) {
    return provide(
      <>
        {bridgeBanner}
        <AuthScreen
          legacyData={legacyData}
          initialMode={authInitialMode}
          onAuthed={handleAuthed}
        />
      </>
    );
  }

  // GUEST MODE (Phase A): explicit auth route, reachable from Settings →
  // Profile and the sign-in nudges. Unlike the old wall, this is OPT-IN — the
  // guest chose to come here and can back out to keep exploring. On success,
  // handleAuthed swaps the guest session for the real account.
  if (nav.screen === 'auth') {
    return provide(
      <>
        {bridgeBanner}
        <AuthScreen
          legacyData={legacyData}
          initialMode={authInitialMode}
          onAuthed={handleAuthed}
          onBack={() => setNav({ screen: 'settings' })}
        />
      </>
    );
  }

  if (showWelcome) {
    // Launching from welcome closes the tour and navigates to the chosen mode.
    // We stamp `cameFromWelcomeRef` so the launched screen's "back" returns
    // to the welcome tour instead of dropping the user on Home.
    // Library has its own open handler that loads the bank list before
    // navigating, so we route through that. handleHomeNavigate is defined
    // below this early return, so we inline the equivalent logic here.
    const launchFromWelcome = (n) => {
      cameFromWelcomeRef.current = true;
      // Inline the dismiss side-effects rather than calling dismissWelcome():
      // dismissWelcome() defensively resets cameFromWelcomeRef to false, which
      // would immediately undo the flag we just set and send Back to Home
      // instead of returning to the welcome tour.
      setShowWelcome(false);
      if (profile && !isGuestProfile(profile)) markOnboardingSeen(profile.id);
      if (n.screen === 'library') {
        handleOpenLibrary();
      } else {
        setNav(n);
      }
    };
    return provide(
      <div className="font-body min-h-screen" style={{ background: T.bg, color: T.ink }}>
        <style>{fontStyles}</style>
        <WelcomeScreen displayName={profile.displayName}
                       firstRun={welcomeFirstRun}
                       demographics={data && data.demographics}
                       onSaveDemographics={setDemographics}
                       onDismiss={dismissWelcome}
                       onLaunch={launchFromWelcome} />
      </div>
    );
  }

  const handleHomeNavigate = (n) => {
    if (n.screen === 'quiz') startQuiz(n);
    else if (n.screen === 'library') handleOpenLibrary();
    else navigate(n);
  };

  return provide(
    <div className="font-body min-h-screen" style={{ background: T.bg, color: T.ink }}>
      <style>{fontStyles}</style>

      {/* Session 4, Item 2 — blur overlay (CSS-toggled via body.app-blurred) */}
      <div id="app-blur-overlay" aria-hidden="true" />

      {/* F-B — one global pull-to-refresh (disabled on gesture/timed screens). */}
      <PullToRefresh onRefresh={refreshApp} disabled={drawerOpen || PTR_DISABLED_SCREENS.has(nav.screen)} />

      {bridgeBanner}

      {/* P19 — in-app PWA update toast. Rendered once here so it can surface
          from any in-app screen; quizInProgress gates the mid-quiz confirm. */}
      <UpdateToast quizInProgress={nav.screen === 'quiz'} />

      {/* Report modal lives at the app root (no transformed ancestor) so its
          position:fixed centering is relative to the viewport, not a screen. */}
      <FeedbackHost />
      <HelpHost />

      {/* Rename modal lives at the app root for the same reason as FeedbackHost —
          Settings is wrapped in `anim-fadeup` which leaves a CSS transform, and
          a transformed ancestor breaks `position: fixed` centering. */}
      <RenameProfileHost />

      {/* Support ("buy me a chai") modal — app root for the same transform
          reason as the others (P9 / step 33). Opened via requestSupport(). */}
      <SupportHost />

      {/* #7 — app-root confirmation dialog. Opened via requestConfirm() — used
          by the un-bookmark caution and reusable for any future confirm. */}
      <ConfirmHost />

      {/* Nav drawer lives at the app root (no transformed ancestor), so its
          position:fixed is relative to the viewport and it scrolls correctly.
          #21 — onOpen lets the drawer's own edge-swipe gesture open itself. */}
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
                 onOpen={() => { if (nav.screen === 'home') setDrawerOpen(true); }}
                 gesturesAllowed={nav.screen === 'home'}
                 isGuest={isGuestProfile(profile)}
                 replyUnread={unseenFeedbackReplies(myReports, data.feedbackRepliesSeen).length}
                 onNavigate={handleHomeNavigate} />

      {/* #30 — "Press back again to exit" snackbar (Home + hardware back). */}
      <ExitConfirmDialog visible={exitSnack} onCancel={cancelExit} onExit={confirmExit} />

      {/* TIP — global tooltip bubble (hold on mobile / hover on desktop). */}
      <TipHost />

      {nav.screen === 'home' && (
        <Home whatsNew={whatsNew} onDismissWhatsNew={dismissWhatsNew}
              announcement={announcement} onDismissAnnouncement={dismissAnnouncement}
              userName={profile ? profile.displayName : null}
              isGuest={isGuestProfile(profile)}
              guestBannerDismissed={guestBannerDismissed}
              onGuestSignIn={() => setNav({ screen: 'auth' })}
              onDismissGuestBanner={() => setGuestBannerDismissed(true)}
              unseenReplies={unseenFeedbackReplies(myReports, data.feedbackRepliesSeen)}
              onOpenMyReports={() => setNav({ screen: 'my-reports' })}
              onDismissReplies={markRepliesSeen}
              onDismissGrace={dismissGrace}
              onDismissReviewToday={dismissReviewToday}
              onShowReviewInfo={() => requestHelp({ screen: 'Spaced revision' })}
              onOpenMenu={() => setDrawerOpen(true)}
              weeklySummaryDismissed={weeklySummaryDismissed}
              dismissWeeklySummary={dismissWeeklySummary}
              onOpenNotifications={() => setNav({ screen: 'notifications' })}
              unreadNotifCount={unreadNotifCount}
              onNotifRead={() => setUnreadNotifCount(0)}
              onNavigate={handleHomeNavigate} />
      )}

      {nav.screen === 'my-reports' && (
        <MyReports reports={myReports} loading={myReportsLoading}
                   seenMap={data.feedbackRepliesSeen}
                   onRefresh={refreshMyReports}
                   onBack={goHome} />
      )}

      {nav.screen === 'notifications' && (
        <NotificationCenter
          onBack={goHome}
          onNavigate={handleHomeNavigate}
        />
      )}

      {nav.screen === 'quick-setup' && (
        <QuickPracticeSetup
                            onStart={startQuickPractice} onBack={goHome} />
      )}

      {nav.screen === 'weak-areas' && (
        <WeakAreasScreen
                         onStartWeakQuiz={(topic) => startQuiz({ mode: 'weak-topic', topic, count: 5 })}
                         onBack={goHome} />
      )}

      {nav.screen === 'coverage' && (
        <Suspense fallback={<LazyScreenFallback />}>
        <CoverageMap onDrill={(action, topic, sub) => {
                       if (action === 'topic') startQuiz({ mode: 'topic', topic, count: 10 });
                       else if (action === 'sub') startQuiz({ mode: 'topic', topic, sub, count: 10 });
                       else if (action === 'quick-setup') navigate({ screen: 'quick-setup' });
                     }}
                     onBack={goHome} />
        </Suspense>
      )}

      {nav.screen === 'weightage' && (
        <Suspense fallback={<LazyScreenFallback />}>
        <WeightageScreen papers={allPapers}
                         onDrill={(action, topic) => { if (action === 'topic') startQuiz({ mode: 'topic', topic, count: 10 }); }}
                         onOpenPapers={() => navigate({ screen: 'previous-papers' })}
                         onBack={goHome} />
        </Suspense>
      )}

      {nav.screen === 'leaderboard' && (
        <Suspense fallback={<LazyScreenFallback />}>
        <LeaderboardScreen profileId={profile && profile.id}
                           isGuest={isGuestProfile(profile)}
                           onGuestSignIn={() => setNav({ screen: 'auth' })}
                           attemptedCount={(data && data.stats && data.stats.totalAttempted) || 0}
                           myMastered={(() => { try { const inc = !!(data && data.preferences && data.preferences.includeGkInStats === true); return masteryTally(data && data.history, allQuestions, attemptStats, (t) => countsInNursingStats(t, inc)).mastered; } catch (e) { return 0; } })()}
                           onStartQuiz={() => handleHomeNavigate({ screen: 'quick-setup' })}
                           onBack={goHome} />
        </Suspense>
      )}

      {nav.screen === 'feedback-inbox' && (
        <FeedbackInbox onBack={goHome} />
      )}

      {nav.screen === 'admin-panel' && isAdmin && (
        <Suspense fallback={<LazyScreenFallback />}>
        <AdminPanel profile={profile} banks={banks} banksLoading={banksLoading}
                    allQuestions={allQuestions}
                    announcement={announcement}
                    onSaveAnnouncement={handleSaveAnnouncement}
                    onClearAnnouncement={handleClearAnnouncement}
                    onLoadAnnHistory={handleLoadAnnHistory}
                    onDeleteAnnHistoryItem={handleDeleteAnnHistoryItem}
                    onClearAnnHistory={handleClearAnnHistory}
                    onRefreshBanks={refreshBanks}
                    onOpenLibrary={() => { setNav({ screen: 'library', adminReturn: true }); refreshBanks(); }}
                    onCreateBank={() => setNav({ screen: 'bank-editor', adminReturn: true })}
                    onLockAdmin={async () => { await handleLockAdmin(); goHome(); }}
                    onListUsers={adminListUsers}
                    onDeleteProfile={adminDeleteProfile}
                    onBack={goHome} />
        </Suspense>
      )}

      {nav.screen === 'topic-select' && (
        <TopicSelect
                     onPick={(topic, count) => startQuiz({ mode: 'topic', topic, count: count || 10 })}
                     onBack={goHome} />
      )}

      {nav.screen === 'mock-setup' && (
        <MockSetup onStart={(count, durationMin, pulse) => startQuiz({ mode: 'mock', count, durationMin, pulse })}
                   onBack={goHome} totalQuestions={allQuestions.length} />
      )}

      {nav.screen === 'quiz' && (
        <Quiz questions={nav.questions} mode={nav.mode} timed={nav.timed}
              timeLimitMin={nav.timeLimitMin} pulse={nav.pulse}
              coins={normalizeEconomy(data && data.economy).coins}
              onWhyBonus={claimWhyBonus}
              onComplete={completeQuiz} onBack={goHome} profileId={profile && profile.id} />
      )}

      {nav.screen === 'results' && (
        <Results results={nav.results} questions={nav.questions} elapsed={nav.elapsed || 0}
                 displayName={profile ? (profile.displayName || profile.id) : null}
                 streak={(data && data.stats && data.stats.streakCurrent) || 0}
                 totalAttempted={(data && data.stats && data.stats.totalAttempted) || 0}
                 referralCode={referralCodeFor(profile)}
                 examDate={(data && data.stats && data.stats.examDate) || null}
                 quizType={quizTypeLabel(nav.mode)}
                 isGuest={isGuestProfile(profile)}
                 onGuestSignIn={() => setNav({ screen: 'auth' })}
                 onHome={goHomeDirect}
                 onCribSheet={isCribSheetEnabled() ? () => {
                   // #28 — shape the finished session into Crib Sheet items.
                   // Quiz results carry per-question outcomes; "Show answer"
                   // reveals (revealed:true) count as Not attempted here.
                   const items = (nav.results || []).map(r => {
                     const q = (nav.questions || []).find(qq => qq.id === r.qId);
                     if (!q) return null;
                     const status = r.revealed ? 'na' : (r.correct ? 'correct' : 'wrong');
                     return { q, selected: r.selected || [], status };
                   }).filter(Boolean);
                   setNav({
                     screen: 'crib-sheet', items,
                     cribTitle: quizTypeLabel(nav.mode),
                     cribSubtitle: `${items.length} questions · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`,
                     backNav: nav,
                   });
                 } : null}
                 onReview={(qIds) => startQuiz({ mode: 'wrong', qIds })} />
      )}

      {/* #28 — Crib Sheet: PDF-like review of the session just finished.
          Session-based: `items` live only in nav state; back returns to the
          exact results screen it was opened from. */}
      {nav.screen === 'crib-sheet' && (
        <CribSheet title={nav.cribTitle || 'Test review'}
                   onHome={goHomeDirect}
                   subtitle={nav.cribSubtitle || ''}
                   items={nav.items || []}
                   savedMode={!!nav.savedMode}
                   negative={nav.cribNegative || null}
                   profileId={profile && !isGuestProfile(profile) ? profile.id : null}
                   onBack={() => setNav(nav.backNav || { screen: 'home' })} />
      )}

      {/* FAV — Your Favourites: manage list, priority order, strip toggle. */}
      {nav.screen === 'favorites' && (
        <FavoritesScreen onBack={goHome} startInEdit={!!nav.edit} startInAdd={!!nav.add}
                         onNavigate={handleHomeNavigate}
                         onOpenSettings={() => setNav({ screen: 'settings' })} />
      )}

      {/* #17 — PYQ Read Mode: calm, untimed reading of a paper's questions.
          No scoring, no spaced repetition — bookmarks + helpful bulb only. */}
      {nav.screen === 'paper-read' && (
        <PyqRead paper={nav.paper}
                 bookmarks={data.bookmarks}
                 onToggleBookmark={toggleBookmarkById}
                 profileId={profile && profile.id}
                 isAdmin={isAdmin}
                 onBack={() => setNav({ screen: 'previous-papers' })} />
      )}

      {nav.screen === 'learn-topics' && (
        <LearnTopics onPick={(topicId, sub) => navigate({ screen: 'learn-cards', topicId, sub })} onBack={goHome}
                     onOpenDoubts={() => navigate({ screen: 'doubts' })}
                     onStartQuickTest={() => handleHomeNavigate({ screen: 'quick-setup' })}
                     weakTopics={learnSignals.weakTopics} dueTopicIds={learnSignals.dueTopicIds} examDaysLeft={learnSignals.examDaysLeft} />
      )}

      {/* F-E — Doubts review. Go-to-topic routes back into the card reader. */}
      {nav.screen === 'doubts' && (
        <DoubtsScreen onBack={goHome} onNavigate={handleHomeNavigate} />
      )}

      {/* F-F — FAQ. Admin reply/delete + helpful counts show only when isAdmin. */}
      {nav.screen === 'faq' && (
        <Suspense fallback={<LazyScreenFallback />}>
        <FAQScreen onBack={goHome} isAdmin={isAdmin} profile={profile} />
        </Suspense>
      )}

      {nav.screen === 'learn-cards' && (
        <LearnCards topicId={nav.topicId} subFilter={nav.sub || null} onBack={goHome} />
      )}

      {nav.screen === 'stats' && (
        <Suspense fallback={<LazyScreenFallback />}>
        <StatsScreen onBack={goHome}
                     onQuick={() => navigate({ screen: 'quick-setup' })}
                     onResetData={clearAll}
                     onStartAdvanced={() => navigate({ screen: 'advanced-setup' })}
                     onPracticeTopic={(topicId) => startQuiz({ mode: 'topic', topic: topicId, count: 10 })} />
        </Suspense>
      )}

      {/* P10 Phase A — Interactive Knowledge Map. Reads progress only; the
          Practice buttons launch a topic-locked (and, for subtopics,
          sub-filtered) quiz exactly the way the Coverage map drills do. */}
      {nav.screen === 'knowledge-map' && (
        <Suspense fallback={<LazyScreenFallback />}>
        <KnowledgeMap onPracticeTopic={(topicId) => startQuiz({ mode: 'topic', topic: topicId, count: 10 })}
                      onPracticeSub={(topicId, sub) => startQuiz({ mode: 'topic', topic: topicId, sub, count: 10 })}
                      onBack={goHome} />
        </Suspense>
      )}

      {/* F-A — Study Methods. Reads progress only; "Go to feature" routes
          through handleHomeNavigate so quiz specs actually start a quiz. */}
      {nav.screen === 'study-methods' && (
        <StudyMethods onBack={goHome} onNavigate={handleHomeNavigate} progress={studyProgress} />
      )}

      {/* #11 — Drill Tests hub. Cards route to the existing setup screens via
          handleHomeNavigate (plain navigate targets). */}
      {nav.screen === 'drill-tests' && (
        <DrillTests onBack={goHome} onNavigate={handleHomeNavigate} />
      )}

      {nav.screen === 'advanced-setup' && (
        <AdvancedTestSetup allQuestions={allQuestions}
                           onStart={startAdvancedTest}
                           onBack={goHome} />
      )}

      {nav.screen === 'advanced-test' && (
        <AdvancedTest questions={nav.questions} timeMinutes={nav.timeMinutes}
                      bookmarks={data.bookmarks} onToggleBookmark={toggleBookmarkById}
                      onSubmit={submitAdvancedTest}
                      strict={nav.strict}
                      onAbort={goHome} />
      )}

      {nav.screen === 'advanced-results' && (
        <AdvancedTestResults questions={nav.questions} answers={nav.answers}
                             timePerQ={nav.timePerQ} elapsedSec={nav.elapsedSec}
                             timeMinutes={nav.timeMinutes}
                             auto={nav.auto}
                             everCorrectIds={nav.everCorrectIds}
                             advancedTestHistory={data && data.advancedTestHistory}
                             onHome={goHomeDirect}
                             onReview={(qIds) => startQuiz({ mode: 'wrong', qIds })}
                             displayName={profile ? (profile.displayName || profile.id) : null}
                             streak={(data && data.stats && data.stats.streakCurrent) || 0}
                             isGuest={isGuestProfile(profile)}
                             onGuestSignIn={() => setNav({ screen: 'auth' })}
                             onCribSheet={isCribSheetEnabled() ? () => openAnswersCrib('Advanced Test') : null}
                             referralCode={referralCodeFor(profile)}
                             profileId={profile && profile.id} />
      )}

      {/* P7 — Previous Year Papers section + its own engine launch/results.
          Reuses AdvancedTest / AdvancedTestResults but routes scoring to
          data.previousPapers via submitPaperTest. onReview is intentionally
          omitted on paper-results: paper question ids don't live in
          allQuestions, so the cross-quiz "practice missed" path wouldn't
          resolve — the inline per-question review covers it instead. */}
      {nav.screen === 'previous-papers' && (
        <PreviousPapers papers={allPapers} previousPapers={data.previousPapers}
                        onStart={startPaperTest}
                        onRead={(paper) => setNav({ screen: 'paper-read', paper })}
                        onBack={goHome} />
      )}

      {nav.screen === 'paper-test' && (
        <AdvancedTest questions={nav.questions} timeMinutes={nav.timeMinutes}
                      label={nav.paperName}
                      bookmarks={data.bookmarks} onToggleBookmark={toggleBookmarkById}
                      onSubmit={submitPaperTest}
                      onAbort={() => setNav({ screen: 'previous-papers' })} />
      )}

      {nav.screen === 'paper-results' && (
        <AdvancedTestResults questions={nav.questions} answers={nav.answers}
                             timePerQ={nav.timePerQ} elapsedSec={nav.elapsedSec}
                             timeMinutes={nav.timeMinutes}
                             auto={nav.auto}
                             label={nav.paperName}
                             onHome={() => setNav({ screen: 'previous-papers' })}
                             onCribSheet={isCribSheetEnabled() ? () => openAnswersCrib(nav.paperName || 'Previous Year Paper') : null}
                             displayName={profile ? (profile.displayName || profile.id) : null}
                             streak={(data && data.stats && data.stats.streakCurrent) || 0}
                             referralCode={referralCodeFor(profile)}
                             isGuest={isGuestProfile(profile)}
                             onGuestSignIn={() => setNav({ screen: 'auth' })}
                             profileId={profile && profile.id} />
      )}

      {nav.screen === 'add-question' && !isGuestProfile(profile) && (
        <AddQuestion onSave={saveCustomQuestion} onSaveBulk={saveBulkQuestions}
                     onBack={goHome}
                     existingCustomCount={data.customQuestions.length} />
      )}

      {nav.screen === 'add-question' && isGuestProfile(profile) && (
        <SignInGate
          icon={<Plus size={26} style={{ color: T.primary }} />}
          title="Sign in to add questions"
          body="Adding your own questions saves them to your account so you can practise and share them. Sign in to start building your own question set."
          onSignIn={() => setNav({ screen: 'auth' })}
          onBack={goHome} />
      )}

      {nav.screen === 'library' && isGuestProfile(profile) && (
        <SignInGate
          icon={<Layers size={26} style={{ color: T.primary }} />}
          title="Sign in to use the Library"
          body="The Question Bank Library holds sets shared by other users. Sign in to browse and import them — and to share your own."
          onSignIn={() => setNav({ screen: 'auth' })}
          onBack={goHome} />
      )}

      {nav.screen === 'library' && !isGuestProfile(profile) && (() => {
        const pid = profile ? profile.id : null;
        const visibleBanks = banks.filter(b => canSeeBank(b, pid, isAdmin) && b.type !== 'previous_paper');
        return (
          <Library banks={visibleBanks} profileId={pid} loading={banksLoading}
                   disabledBanks={data ? data.disabledBanks : {}}
                   onRefresh={refreshBanks}
                   onOpen={handleOpenBank}
                   onCreateNew={() => setNav({ screen: 'bank-editor' })}
                   onBack={() => nav.adminReturn ? setNav({ screen: 'admin-panel' }) : goHome()} />
        );
      })()}

      {nav.screen === 'bank-detail' && nav.bank && (() => {
        const pid = profile ? profile.id : null;
        // Defensive: if this bank isn't visible to the viewer, bounce to library.
        if (!canSeeBank(nav.bank, pid, isAdmin)) {
          return <Library banks={banks.filter(b => canSeeBank(b, pid, isAdmin))} profileId={pid}
                          disabledBanks={data ? data.disabledBanks : {}}
                          loading={banksLoading} onRefresh={refreshBanks} onOpen={handleOpenBank}
                          onCreateNew={() => setNav({ screen: 'bank-editor' })} onBack={goHome} />;
        }
        const importedFromThisBank = data.customQuestions.filter(q => q.sourceBank === nav.bank.id);
        const importedVersion = importedFromThisBank.reduce((max, q) => Math.max(max, q.sourceBankVersion || 0), 0);
        const owner = isBankOwner(nav.bank, pid);
        const canToggleVis = isAdmin || owner;
        return (
          <BankDetail bank={nav.bank} isAdmin={isAdmin} isOwner={owner} canToggleVisibility={canToggleVis}
                      alreadyImported={{ count: importedFromThisBank.length, version: importedVersion || null }}
                      isDisabled={!!(data.disabledBanks && data.disabledBanks[nav.bank.id])}
                      onImport={() => handleImportBank(nav.bank, false)}
                      onUpdate={() => handleImportBank(nav.bank, true)}
                      onEdit={() => setNav({ screen: 'bank-editor', bank: nav.bank })}
                      onDelete={() => handleDeleteBank(nav.bank.id)}
                      onToggleVisibility={(vis) => handleSetBankVisibility(nav.bank, vis)}
                      onToggleEnabled={(enabled) => handleToggleBankEnabled(nav.bank.id, enabled)}
                      onBack={() => { setNav({ screen: 'library' }); refreshBanks(); }} />
        );
      })()}

      {/* New-bank creation is open to any logged-in user; EDITING an existing
          bank stays admin-only. */}
      {nav.screen === 'bank-editor' && (isAdmin || !nav.bank) && (
        <BankEditor existingBank={nav.bank || null} profile={profile}
                    onSave={handleSaveBank}
                    onBack={() => setNav(nav.bank ? { screen: 'bank-detail', bankId: nav.bank.id, bank: nav.bank } : (nav.adminReturn ? { screen: 'admin-panel' } : { screen: 'library' }))} />
      )}

      {nav.screen === 'reference' && (
        <Reference onBack={goHome} />
      )}

      {nav.screen === 'dosage' && (
        <DosagePractice onComplete={completeDosage} onBack={goHome} profile={profile} isAdmin={isAdmin}
                        bookmarks={data.bookmarks} onToggleBookmark={toggleBookmarkById} />
      )}

      {nav.screen === 'dosage-results' && (
        <DosageResults results={nav.results} questions={nav.questions} onHome={goHomeDirect}
                       displayName={profile ? (profile.displayName || profile.id) : null}
                       streak={(data && data.stats && data.stats.streakCurrent) || 0}
                       profile={profile} isAdmin={isAdmin} />
      )}

      {nav.screen === 'bookmarks-view' && (
        <BookmarksScreen onToggleBookmark={toggleBookmarkById}
                         onBack={goHome} />
      )}

      {nav.screen === 'revision-sheet' && (
        <Suspense fallback={<LazyScreenFallback />}>
        {/* FEAT-02 — the Study Plan entry was REMOVED from Revision; it now lives
            as its own sidebar item (the former "Exam date" entry). */}
        <RevisionSheet onLogVisit={recordRevisionVisit} onBack={goHome}
                       onStartReview={() => startQuiz({ mode: 'review-due' })}
                       onOpenCrib={(c) => navigate({
                         screen: 'crib-sheet', items: c.items,
                         cribTitle: c.title, cribSubtitle: c.subtitle,
                         savedMode: true, backNav: { screen: 'revision-sheet' },
                       })} />
        </Suspense>
      )}

      {/* FEAT-02 — Study Plan is the single home for exam date + daily goal +
          the day-by-day plan (the embedded ExamDateEditor sets the date). The
          old standalone 'exam-date' route is gone; the sidebar opens this. */}
      {nav.screen === 'study-plan' && (
        <Suspense fallback={<LazyScreenFallback />}>
        <StudyPlan profileId={profile.id} onBack={goHome}
                   onStartTopic={(topic) => startQuiz({ mode: 'topic', topic, count: 10 })}
                   onStartMock={() => navigate({ screen: 'mock-setup' })}
                   onStartReview={() => startQuiz({ mode: 'review-due' })}
                   allQuestionsCount={allQuestions.length}
                   onSetExamDateValue={setExamDate}
                   onClearExamDate={clearExamDate}
                   onSaveTarget={setDailyTarget} />
        </Suspense>
      )}

      {/* Issues round — dedicated Share page (was inline in Settings). */}
      {nav.screen === 'share-app' && (
        <ShareAppScreen onBack={goHome} />
      )}

      {/* Issues round — dedicated Themes page (was the inline Appearance
          block in Settings). */}
      {nav.screen === 'themes' && (
        <ThemesScreen themeMode={themeMode} onSetColorTheme={setColorTheme} onBack={goHome} />
      )}

      {nav.screen === 'settings' && (
        <Settings themeMode={themeMode}
                  isGuest={isGuestProfile(profile)}
                  onGuestSignIn={() => setNav({ screen: 'auth' })}
                  onClearAll={clearAll} onImportBackup={importBackup}
                  onLogout={handleLogout} onSwitchProfile={handleLogout}
                  onUnlockAdmin={handleUnlockAdmin} onLockAdmin={handleLockAdmin}
                  onToggleTheme={toggleTheme}
                  onSetColorTheme={setColorTheme}
                  onShowWelcome={() => { setWelcomeFirstRun(false); setShowWelcome(true); }}
                  onOpenFeedbackInbox={() => setNav({ screen: 'feedback-inbox' })}
                  onOpenAdminPanel={() => setNav({ screen: 'admin-panel' })}
                  onOpenMyReports={() => setNav({ screen: 'my-reports' })}
                  onOpenShare={() => navigate({ screen: 'share-app' })}
                  onOpenThemes={() => navigate({ screen: 'themes' })}
                  onOpenFavorites={() => navigate({ screen: 'favorites', edit: true })}
                  onManageFavorites={() => navigate({ screen: 'favorites', add: true })}
                  onRenameProfile={handleRenameProfile}
                  onToggleReviewReminders={toggleReviewReminders}
                  onToggleIncludeGkInStats={toggleIncludeGkInStats}
                  onSetDailyReminder={setDailyReminder}
                  onSetDemographics={setDemographics}
                  unseenReplyCount={unseenFeedbackReplies(myReports, data.feedbackRepliesSeen).length}
                  onBack={goHome} />
      )}
    </div>
  );
}
