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
  'settings': async () => {
    const m = await import('../../src/screens/settings.jsx');
    return React.createElement(m.default, {
      themeMode: 'dark', isGuest: false, onGuestSignIn: noop,
      onClearAll: noop, onLogout: noop, onSwitchProfile: noop,
      onToggleTheme: noop, onSetColorTheme: noop, onShowWelcome: noop,
      onOpenFeedbackInbox: noop, onOpenMyReports: noop, onOpenShare: noop,
      onOpenThemes: noop, onOpenFavorites: noop, onManageFavorites: noop,
      onRenameProfile: noop, onToggleReviewReminders: noop,
      onToggleIncludeGkInStats: noop, onSetDailyReminder: noop,
      onSetDemographics: noop, unseenReplyCount: 0, onBack: noop,
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
