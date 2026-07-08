// Runtime smoke: server-render the REAL KnowledgeMap screen. This executes the
// full component body — every const, every hook call, every useMemo factory and
// deps array (TDZ crashes like the shipped fogSet bug throw right here).
globalThis.window = globalThis;
window.matchMedia = () => ({
  matches: false,
  addEventListener() {}, removeEventListener() {},
  addListener() {}, removeListener() {},
});
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
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
const { default: KnowledgeMap } = await import('KMAP_SCREEN');

const noop = () => {};
let html;
try {
  html = renderToString(
    React.createElement(KnowledgeMap, {
      onPracticeTopic: noop, onPracticeSub: noop, onBack: noop,
    })
  );
} catch (e) {
  console.error('SMOKE FAIL — KnowledgeMap crashed on first render:');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}

const checks = [
  ['<svg', 'map SVG rendered'],
  ['viewBox', 'viewBox present'],
];
let bad = 0;
for (const [needle, label] of checks) {
  const ok = html.includes(needle);
  console.log((ok ? 'ok  ' : 'MISS') + ' - ' + label);
  if (!ok) bad++;
}
console.log('rendered HTML length:', html.length);
if (bad) process.exit(1);
console.log('SMOKE PASS — KnowledgeMap first render completed without throwing');
