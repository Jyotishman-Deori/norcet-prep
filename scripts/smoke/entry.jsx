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
  // isGuest + an undismissed guest banner + a what's-new notice: exercises the
  // redesigned full-width notification banners (guest sign-in card with the
  // right-aligned actions, plus the what's-new hover card).
  'home-guest': async () => {
    const m = await import('../../src/screens/home.jsx');
    return React.createElement(m.default, {
      onNavigate: noop, whatsNew: [{ name: 'Pharmacology', version: 2 }], onDismissWhatsNew: noop,
      announcement: null, onDismissAnnouncement: noop,
      userName: 'Guest', isGuest: true,
      guestBannerDismissed: false, onGuestSignIn: noop, onDismissGuestBanner: noop,
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
  // RESUME — a Quiz relaunched from a saved snapshot: exercises the seeded
  // index/results/elapsed useState initializers, the resume machinery effects
  // and buildCaution, so a first-render crash on the resume path fails here.
  'quiz-resume': async () => {
    const m = await import('../../src/screens/quiz.jsx');
    const qs = SEED_QUESTIONS.slice(0, 5);
    return React.createElement(m.default, {
      questions: qs, mode: 'topic',
      timed: false, timeLimitMin: undefined, pulse: false, flashpoint: false,
      coins: 0, onWhyBonus: noop, onCodeBlueResolved: noop,
      onComplete: noop, onBack: noop, profileId: 'smoke-test',
      resumeState: {
        v: 1, kind: 'quiz', mode: 'topic',
        questionIds: qs.map(q => q.id),
        results: [{ qId: qs[0].id, correct: true }, { qId: qs[1].id, correct: false }],
        index: 2, elapsed: 42, startedAt: Date.now(), ts: Date.now(),
      },
    });
  },
  // RESUME — the Home "Pick up where you left off" card (in-body, not portaled).
  'home-resume': async () => {
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
      resumeSnap: {
        v: 1, kind: 'quiz', mode: 'topic',
        questionIds: ['a', 'b', 'c', 'd', 'e'],
        results: [{ qId: 'a' }, { qId: 'b' }],
        index: 2, elapsed: 0, startedAt: Date.now(), ts: Date.now(),
      },
      onResumeTest: noop, onDiscardResume: noop,
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
  // Content Disclaimer round (2026-07-10): About gained the "Our content
  // promise" card; the legal screen gained the 5th doc. Render both.
  'about': async () => {
    const m = await import('../../src/screens/about.jsx');
    return React.createElement(m.default, { onBack: noop, onNavigate: noop });
  },
  'legal-disclaimer': async () => {
    const m = await import('../../src/screens/legal.jsx');
    return React.createElement(m.LegalScreen, { doc: 'disclaimer', onBack: noop });
  },
  // Top-bar revamp (2026-07-11): persistent DesktopNav with active-section
  // highlight, bell swing and the golden Premium pill. Rendered on a CHILD
  // screen (crib-sheet → Revision lights up via SECTION_OF) with unread
  // notifications; the member variant exercises the gold tier-badge branch.
  'desktop-nav': async () => {
    const m = await import('../../src/ui/desktop-nav.jsx');
    return React.createElement(m.default, {
      screen: 'crib-sheet', onTab: noop, onNavigate: noop, onOpenMenu: noop,
      onOpenNote: noop, unreadNotifCount: 3, onOpenNotifications: noop,
    });
  },
  // Where-you-stand fix (2026-07-11): the You pill must stay INSIDE the
  // 30-70 plot even at 0% (the screenshot overflow bug). Render all three
  // phases; markers asserted below.
  'where-you-stand-zero': async () => {
    const m = await import('../../src/ui/where-you-stand-card.jsx');
    return React.createElement(m.default, {
      history: [{ netScore: 0, count: 100, ts: Date.now() }],
      estimate: null, onStartAdvanced: noop, onQuick: noop,
    });
  },
  'where-you-stand-mid': async () => {
    const m = await import('../../src/ui/where-you-stand-card.jsx');
    return React.createElement(m.default, {
      history: [{ netScore: 47, count: 100, ts: Date.now() }],
      estimate: null, onStartAdvanced: noop, onQuick: noop,
    });
  },
  'where-you-stand-placeholder': async () => {
    const m = await import('../../src/ui/where-you-stand-card.jsx');
    return React.createElement(m.default, {
      history: [], estimate: null, onStartAdvanced: noop, onQuick: noop,
    });
  },
  'desktop-nav-member': async () => {
    const stub = await import('./stub-app-context.jsx');
    stub.__setSmokeProfile({ premium: { active: true, tier: 'MAX', expiresAt: Date.now() + 86400000 } });
    const m = await import('../../src/ui/desktop-nav.jsx');
    const el = React.createElement(m.default, {
      screen: 'premium', onTab: noop, onNavigate: noop, onOpenMenu: noop,
      onOpenNote: noop, unreadNotifCount: 0, onOpenNotifications: noop,
    });
    return el;
  },
  // Layered-disclaimer round (2026-07-11): AuthScreen CREATE mode now renders
  // the required consent checkbox (recorded Layer 1). Turnstile/Google render
  // nothing without env keys, so this exercises the plain create form.
  'auth-create': async () => {
    const m = await import('../../src/screens/auth-screen.jsx');
    return React.createElement(m.default, {
      legacyData: null, initialMode: 'create', onAuthed: noop,
    });
  },
  // Weightage revamp (2026-07-11): true %-of-exam over the WHOLE paper, the
  // nursing/non-nursing split bar, and the labelled Non-nursing section.
  // Fixture papers carry gk/apt questions like the real bundled PYQs.
  'weightage': async () => {
    const m = await import('../../src/screens/weightage.jsx');
    const alt = (id, topic) => ({ id, topic, type: 'mcq', q: 'Smoke question', options: ['a', 'b', 'c', 'd'], correct: [0] });
    const paper = (id, year, extra) => ({
      id, year, name: `NORCET ${year}`, questions: [...SEED_QUESTIONS.slice(0, 18), ...extra],
    });
    return React.createElement(m.default, {
      papers: [
        paper('p1', 2023, [alt('g1', 'gk'), alt('g2', 'gk'), alt('a1', 'apt')]),
        paper('p2', 2024, [alt('g3', 'gk'), alt('a2', 'apt')]),
      ],
      onDrill: noop, onOpenPapers: noop, onBack: noop,
    });
  },
  // Coverage map gained the enter-a-test requestConfirm gate on its Start pills.
  'coverage-map': async () => {
    const m = await import('../../src/screens/coverage-map.jsx');
    return React.createElement(m.default, { onBack: noop, onDrill: noop });
  },
  // Dosage setup gained the one-time clinical note gate on Start (Layer 2b).
  'dosage-setup': async () => {
    const m = await import('../../src/screens/DosageSetup.jsx');
    return React.createElement(m.default, { onStart: noop, onBack: noop, onSetPace: noop });
  },
  // Ask-companion chat (2026-07-12): fresh chat renders the intro bubble +
  // quick-start chips; the engine + KB module scope executes fully.
  'assistant': async () => {
    const m = await import('../../src/screens/assistant.jsx');
    return React.createElement(m.default, { onBack: noop, onNavigate: noop });
  },
  // Nursing Calculator Suite: the hub (search + six category groups) renders,
  // which also executes the whole registry + every calc-*.js module scope.
  'nursing-calc': async () => {
    const m = await import('../../src/screens/nursing-calc.jsx');
    return React.createElement(m.default, { onBack: noop });
  },
  // ...and the DETAIL view with a live computed result card (MAP 120/80),
  // via the deep-link props, so the form, envelope meta lines, working,
  // bands and the flagged "verify" tag all render at build time.
  'nursing-calc-detail': async () => {
    const m = await import('../../src/screens/nursing-calc.jsx');
    return React.createElement(m.default, {
      onBack: noop,
      initialCalcId: 'map',
      initialValues: { systolic: '120', diastolic: '80' },
    });
  },
  // Maintenance / kill switch overlay: force the config on, then render the
  // host. It reads config synchronously, so the server render shows the screen.
  // (Only this entry mounts MaintenanceHost, so the forced config is harmless
  // to the other entries.)
  'maintenance': async () => {
    const cfg = await import('../../src/lib/game-config.js');
    cfg.applyRemoteConfig({ maintenance: { on: true } });
    const m = await import('../../src/screens/maintenance.jsx');
    return React.createElement(m.MaintenanceHost, {});
  },
  // Home's quiet "terms updated" card: only visible when the stamped
  // acceptance predates LEGAL_VERSION — install exactly that state. (The
  // fixture persists into the stats entries below, which install their own.)
  'home-legal-update': async () => {
    const stub = await import('./stub-app-context.jsx');
    const { DEFAULT_DATA } = await import('../../src/data/seed.js');
    stub.__setSmokeData({
      ...DEFAULT_DATA,
      preferences: { ...DEFAULT_DATA.preferences, legalAcceptedVersion: 1, legalAcceptedAt: 1 },
    });
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
      onEnableNotifications: noop, onAckLegalUpdate: noop,
    });
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

// Optional per-entry content markers: strings that MUST appear in the
// rendered HTML, so a silently-empty branch (e.g. a gated pill) fails loud.
const MARKERS = {
  'desktop-nav': ['dnav-gold', 'dnav-link-active', 'dnav-bell-ring', 'Premium'],
  'desktop-nav-member': ['dnav-gold', 'MAX'],
  // pill clamped inside the plot (translate(41 = x0+27) not translate(14)),
  // plus the off-scale hint line. Markers must be SINGLE JSX strings
  // (renderToString comment-separates adjacent text children), so the SVG
  // aria-label template literals stand in for the pill text.
  'where-you-stand-zero': ['about 0 percent', 'translate(41', 'sits left of it for now'],
  'where-you-stand-mid': ['about 47 percent'],
  'where-you-stand-placeholder': ['You appear here'],
  // Layered-disclaimer round. All single-string JSX literals (renderToString
  // comment-separates adjacent text children).
  'auth-create': ['educational study tool for exam preparation', 'Content Disclaimer'],
  'welcome': ['By continuing you agree to our'],
  'app-footer': ['Educational use only. Not for clinical decisions.'],
  'assistant': ['your guide to everything NurseHolic', 'Popular questions', 'How do streaks work?'],
  'weightage': ['Non-nursing section', 'How a typical paper splits', 'marks from the same papers'],
  'home-legal-update': ['Our terms were updated', 'Review the changes'],
  'home-guest': ['exploring as a guest', 'Sign in / Create account'],
  'maintenance': ['Down for a quick tune-up', 'Try again'],
  'settings': ['Export my data'],
  // the hero card that replaced the Favourites strip
  'home': ['Nursing Calculator Suite'],
  // hub: a category label + calculator rows + the offline promise strip.
  // (No TopBar-title marker: TopBar portals to body and the smoke nulls portals.
  //  No 'Recently used' either: the store starts empty on a fresh render.)
  'nursing-calc': ['Scoring Tools', 'Mean Arterial Pressure', 'Glasgow Coma Scale', 'Works fully offline'],
  // detail: the computed MAP 120/80 result card end-to-end. 93.3 is the value,
  // the meta lines state the rounding + formula, the matched band renders, and
  // the flagged-band tag appears (no apostrophe in the marker: renderToString
  // escapes ' as &#x27;).
  'nursing-calc-detail': ['93.3', 'Rounded to 1 decimal place.', 'Copy value', '70 to 100 mmHg', 'Verify against your institution'],
  'quiz': ['Educational use only. Not for clinical decisions.'],
  // RESUME — the relaunched quiz still renders its question card + EduTag (the
  // return caution is portaled, so it is nulled in smoke like other dialogs).
  'quiz-resume': ['Educational use only. Not for clinical decisions.'],
  // RESUME — the in-body Home card title (single string literal).
  'home-resume': ['Pick up where you left off'],
};

let failed = 0;
for (const [name, make] of Object.entries(SCREENS)) {
  try {
    const html = renderToString(await make());
    if (!html || html.length < 200) throw new Error(`suspiciously empty render (${html.length} chars)`);
    for (const mark of (MARKERS[name] || [])) {
      if (!html.includes(mark)) throw new Error(`rendered without expected marker "${mark}"`);
    }
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
