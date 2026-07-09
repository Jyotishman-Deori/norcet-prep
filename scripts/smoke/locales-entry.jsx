// Multi-locale render verification (runner: scripts/verify-locales-render.mjs).
// For EVERY public/locales/<code>/ui.json, this activates the locale in the
// real src/lib/i18n.js module and server-renders the real Home screen,
// asserting that (a) translated strings actually reach the markup, (b) no
// raw dot-namespaced key leaked, and (c) no em dash sneaked into output.
// Same global shims + stubs as entry.jsx (only app-context hooks + storage
// are stubbed; the stub's `t` delegates to the real i18n module, so the
// dict activated here is exactly what renders).
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
  remove() {},
});
globalThis.document = {
  body: fakeEl(),
  head: fakeEl(),
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
const { readFileSync, readdirSync, existsSync } = await import('node:fs');
const { join } = await import('node:path');
const i18n = await import('../../src/lib/i18n.js');
const { default: Home } = await import('../../src/screens/home.jsx');

const noop = () => {};
const homeEl = () => React.createElement(Home, {
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

const localesDir = join(process.cwd(), 'public', 'locales');
const codes = existsSync(localesDir)
  ? readdirSync(localesDir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
  : [];

let failed = 0;
// English baseline first.
{
  const html = renderToString(homeEl());
  if (!html.includes('Streak')) { failed++; console.error('FAIL en: baseline missing "Streak"'); }
  else console.log(`ok   en      rendered (${html.length} chars, baseline)`);
}
for (const code of codes) {
  if (code === 'en') continue;
  try {
    const dict = JSON.parse(readFileSync(join(localesDir, code, 'ui.json'), 'utf8'));
    const loc = i18n.getLocale(code);
    if (!loc) throw new Error(`'${code}' not in the LOCALES registry`);
    i18n._seedDictForTest(code, dict);
    await i18n.setLocale(code);
    const html = renderToString(homeEl());
    const probe = dict['home.stats.streak'];
    if (!probe || !html.includes(probe.replace(/&/g, '&amp;'))) {
      throw new Error(`translated 'home.stats.streak' (${probe}) not found in markup`);
    }
    const leak = html.match(/\b(?:home|nav|quiz|settings|welcome|auth|common|topbar)\.[a-zA-Z0-9_.]+/);
    if (leak) throw new Error(`raw i18n key leaked into markup: ${leak[0]}`);
    if (html.includes('—')) throw new Error('em dash found in rendered markup');
    console.log(`ok   ${code.padEnd(6)} rendered (${html.length} chars)`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${code}: ${e.message}`);
  }
}
await i18n.setLocale('en');

if (failed) {
  console.error(`\nLOCALE RENDER FAIL — ${failed} locale(s)`);
  process.exit(1);
}
console.log(`LOCALE RENDER PASS — Home rendered under ${codes.length - 1} translated locale(s) + en`);
