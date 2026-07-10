// Runtime smoke: server-render the REAL high-traffic screens. Executes each
// component's full body — every const, hook call, useMemo factory and deps
// array — so first-render crashes (like the shipped fogSet TDZ) throw here,
// in `npm test`, instead of in production.
//
// Globals are shimmed BEFORE any app module evaluates (that's why every app
// import below is dynamic — esbuild keeps them lazily initialized).
globalThis.window = globalThis;
window.matchMedia = () => ({
  matches: false,
  addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {},
});
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.requestAnimationFrame = (f) => setTimeout(f, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
const fakeEl = () => ({
  style: {},
  setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
  appendChild() {}, removeChild() {}, insertBefore() {},
  addEventListener() {}, removeEventListener() {},
  contains: () => false,
  ownerDocument: null,
});
globalThis.document = {
  body: fakeEl(),
  documentElement: fakeEl(),
  createElement: fakeEl,
  createElementNS: fakeEl,
  createTextNode: () => ({}),
  createEvent: () => ({ initEvent() {} }),
  addEventListener() {}, removeEventListener() {},
  getElementById: () => null, querySelector: () => null,
  querySelectorAll: () => [],
  activeElement: null,
};

const { default: React } = await import('react');
const { renderToString } = await import('react-dom/server');
const { SEED_QUESTIONS } = await import('../../src/data/seed.js');

const noop = () => {};

// screen name -> async element factory. Props mirror what App.jsx passes at
// each router dispatch site (callbacks no-oped, data props realistic).
const SCREENS = {
  'home': async () => {
    const m = await import('../../src/screens/home.jsx');
    return React.createElement(m.default, {
      onNavigate: noop, whatsNew: null, onDismissWhatsNew: noop,
      announcement: null, onDismissAnnouncement: noop,
      userName: 'Smoke', isGuest: false,
      guestBannerDismissed: true, onGuestSignIn: noop, onDismissGuestBanner: noop,
      unseenReplies: [], onOpenMyReports: noop, onDismissReplies: noop,
      onDismissGrace: noop, onDismissReviewToday: noop, onShowReviewInfo: noop,
      onOpenMenu: noop, weeklySummaryDismissed: true, dismissWeeklySummary: noop,
      onOpenNotifications: noop, unreadNotifCount: 0, onNotifRead: noop,
      onEnableNotifications: noop,
    });
  },
  'quiz': async () => {
    const m = await import('../../src/screens/quiz.jsx');
    return React.createElement(m.default, {
      questions: SEED_QUESTIONS.slice(0, 5), mode: 'quick',
      timed: false, timeLimitMin: undefined, pulse: false, flashpoint: false,
      coins: 0, onWhyBonus: noop, onCodeBlueResolved: noop,
      onComplete: noop, onBack: noop, profileId: 'smoke-test',
    });
  },
  // isGuest: true renders the inline data zone, exercising the new
  // Recently-deleted row + the restore-erased-progress row (trash build).
  'settings': async () => {
    const m = await import('../../src/screens/settings.jsx');
    return React.createElement(m.default, {
      themeMode: 'dark', isGuest: true, onGuestSignIn: noop,
      onClearAll: noop, onLogout: noop, onSwitchProfile: noop,
      onToggleTheme: noop, onSetColorTheme: noop, onShowWelcome: noop,
      onOpenFeedbackInbox: noop, onOpenMyReports: noop, onOpenShare: noop,
      onOpenThemes: noop, onOpenFavorites: noop, onManageFavorites: noop,
      onRenameProfile: noop, onToggleReviewReminders: noop,
      onToggleIncludeGkInStats: noop, onSetDailyReminder: noop,
      onSetDemographics: noop, unseenReplyCount: 0, onBack: noop,
      onOpenTrash: noop, progressSnapshotAt: Date.now() - 3600e3, onRestoreProgress: noop,
    });
  },
  'level-up': async () => {
    const m = await import('../../src/screens/LevelUp.jsx');
    return React.createElement(m.default, {
      onBack: noop, onNavigate: noop, onClaimQuest: noop,
      onOpenCrate: noop, onEquipFrame: noop, onBuyFrame: noop,
    });
  },
  'learn-topics': async () => {
    const m = await import('../../src/screens/learn-topics.jsx');
    return React.createElement(m.default, {
      onPick: noop, onBack: noop, onOpenDoubts: noop, onStartQuickTest: noop,
      weakTopics: [], dueTopicIds: [], examDaysLeft: null,
    });
  },
  'knowledge-map': async () => {
    const m = await import('../../src/screens/knowledge-map.jsx');
    return React.createElement(m.default, {
      onPracticeTopic: noop, onPracticeSub: noop, onBack: noop,
    });
  },
  'search': async () => {
    const m = await import('../../src/screens/search.jsx');
    return React.createElement(m.default, {
      onBack: noop, onNavigate: noop, profileId: 'smoke-test',
    });
  },
  // I18N build: welcome gained the language-suggestion chip and t() chrome;
  // firstRun renders the pitch page (chip + onboarding entry).
  'welcome': async () => {
    const m = await import('../../src/screens/welcome.jsx');
    return React.createElement(m.default, {
      displayName: 'Smoke', firstRun: true, demographics: null,
      onSaveDemographics: noop, onDismiss: noop, onLaunch: noop,
    });
  },
  // Library UX revamp (2026-07-10): practice-status chips + badges derive
  // from data.customQuestions/sourceBank — exercise that path with one
  // bank in each state (in use / update available / not added).
  'library': async () => {
    const m = await import('../../src/screens/library.jsx');
    const bank = (id, name, version) => ({
      id, name, version, visibility: 'public', ownerId: 'admin-x', ownerName: 'Admin',
      updatedAt: Date.now(), questions: SEED_QUESTIONS.slice(0, 3),
    });
    return React.createElement(m.default, {
      banks: [bank('b1', 'Pharmacology', 1), bank('b2', 'Pediatrics', 3), bank('b3', 'Microbiology', 1)],
      profileId: 'smoke-test', loading: false, disabledBanks: {},
      onRefresh: noop, onOpen: noop, onCreateNew: noop, onBack: noop,
    });
  },
  // Bank detail + editor pair (UX revamp: status card, options-in-preview;
  // editor gained multi-file upload + per-file report).
  'bank-detail': async () => {
    const m = await import('../../src/screens/bank-screens.jsx');
    return React.createElement(m.BankDetail, {
      bank: {
        id: 'b1', name: 'Pharmacology', version: 2, visibility: 'public',
        ownerId: 'admin-x', ownerName: 'Admin', updatedAt: Date.now(),
        description: 'Smoke bank', questions: SEED_QUESTIONS.slice(0, 5),
      },
      isAdmin: false, isOwner: false, canToggleVisibility: false,
      alreadyImported: { count: 5, version: 1 }, isDisabled: false,
      onImport: noop, onUpdate: noop, onEdit: noop, onDelete: noop,
      onToggleVisibility: noop, onToggleEnabled: noop, onBack: noop,
    });
  },
  'bank-editor': async () => {
    const m = await import('../../src/screens/bank-screens.jsx');
    return React.createElement(m.BankEditor, {
      existingBank: null, profile: { id: 'smoke-test', displayName: 'Smoke' },
      onSave: noop, onBack: noop,
    });
  },
  // Crib sheet now mounts the shared BackToTop FAB (progress-ring rework).
  'crib-sheet': async () => {
    const m = await import('../../src/screens/crib-sheet.jsx');
    return React.createElement(m.default, {
      title: 'Smoke crib', subtitle: '4 questions',
      items: SEED_QUESTIONS.slice(0, 4).map(q => ({ q, selected: [q.correct[0]], status: 'correct' })),
      profileId: 'smoke-test', onBack: noop, onHome: noop,
    });
  },
  // Desktop footer gained the language popover (FooterLanguage).
  'app-footer': async () => {
    const m = await import('../../src/ui/app-footer.jsx');
    return React.createElement(m.default, { onNavigate: noop });
  },
  // NEW-07 Advanced analytics. DEFAULT_DATA is empty (totalAttempted 0), which
  // would early-return StatsScreen and skip every new hook — so these two
  // entries install a POPULATED fixture via the stub's __setSmokeData first.
  // They are the last entries; the fixture staying installed afterwards is
  // harmless. 'stats' proves the tab shell + populated Overview; the panel
  // entry executes the doubt-matrix / leak-radar / benchmark useMemo bodies.
  'stats': async () => {
    const stub = await import('./stub-app-context.jsx');
    const { DEFAULT_DATA } = await import('../../src/data/seed.js');
    const history = {};
    SEED_QUESTIONS.slice(0, 12).forEach((q, i) => {
      history[q.id] = { attempts: [
        { ts: 1000 + i, correct: i % 3 !== 0, timeMs: 42000, pick: [0], conf: ['sure', 'unsure', 'guess'][i % 3] },
        { ts: 2000 + i, correct: i % 2 === 0, timeMs: 55000, pick: [1], conf: 'sure' },
      ] };
    });
    stub.__setSmokeData({
      ...DEFAULT_DATA,
      stats: { ...DEFAULT_DATA.stats, totalAttempted: 24, totalCorrect: 14, streakCurrent: 3, streakBest: 5,
               dailyHistory: [{ date: '2026-07-09', attempted: 12, correct: 7 }, { date: '2026-07-10', attempted: 12, correct: 7 }] },
      history,
      advancedTestHistory: [{ ts: Date.now(), count: 100, correct: 52, wrong: 30, blank: 18, netScore: 42, accuracy: 63, elapsedSec: 3200 }],
    });
    const m = await import('../../src/screens/StatsScreen.jsx');
    return React.createElement(m.default, {
      onBack: noop, onQuick: noop, onResetData: noop,
      onPracticeTopic: noop, onStartAdvanced: noop, onReviewQuestions: noop,
    });
  },
  'stats-advanced': async () => {
    const m = await import('../../src/screens/stats-advanced.jsx');
    return React.createElement(m.default, { onReviewQuestions: noop, onStartAdvanced: noop });
  },
  // Recently deleted (trash build): renders with a populated data.trash via
  // the __setSmokeData fixture, so the row-mapping useMemo bodies execute.
  'recently-deleted': async () => {
    const stub = await import('./stub-app-context.jsx');
    const { DEFAULT_DATA } = await import('../../src/data/seed.js');
    stub.__setSmokeData({
      ...DEFAULT_DATA,
      mindmapNotes: { 'sub:cardio': { text: 'existing note', updatedAt: Date.now() } },
      trash: [
        { id: 't-1', kind: 'kmap-note', label: 'Cardiac', sub: '', payload: { key: 'sub:cardio', text: 'old mnemonic' }, deletedAt: Date.now() - 3600e3 },
        { id: 't-2', kind: 'kmap-note', label: 'Renal', sub: '', payload: { key: 'sub:renal', text: 'loop of henle' }, deletedAt: Date.now() - 86400e3 },
      ],
    });
    const m = await import('../../src/screens/recently-deleted.jsx');
    return React.createElement(m.default, { onBack: noop });
  },
  // NEW-07.4 High-Stress Drill: the AdvancedTest engine in SECTIONED mode
  // (per-section clock, locked palette, section strip). First render must
  // not throw with a sections array installed.
  'advanced-test-stress': async () => {
    const m = await import('../../src/screens/advanced-test.jsx');
    const { buildSections } = await import('../../src/lib/section-lock.js');
    const qs = SEED_QUESTIONS.slice(0, 40);
    return React.createElement(m.AdvancedTest, {
      questions: qs, timeMinutes: 36, sections: buildSections(qs.length),
      bookmarks: [], onToggleBookmark: noop, onSubmit: noop, onAbort: noop, strict: false,
    });
  },
};

let failed = 0;
for (const [name, make] of Object.entries(SCREENS)) {
  try {
    const html = renderToString(await make());
    if (!html || html.length < 200) throw new Error(`suspiciously empty render (${html.length} chars)`);
    console.log(`ok   - ${name} rendered (${html.length} chars)`);
  } catch (e) {
    failed++;
    console.error(`FAIL - ${name} crashed on first render:`);
    console.error(e && e.stack ? e.stack : e);
  }
}

if (failed) {
  console.error(`\nSMOKE FAIL — ${failed} screen(s) crashed`);
  process.exit(1);
}
console.log('SMOKE PASS — all screens completed first render without throwing');
