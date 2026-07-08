// Contract test for src/lib/rage-click.js — runnable under Node:
//   node src/lib/rage-click.test.js
// Only the PURE detector is under test (the DOM installer is exercised by
// the runtime verification pass; it lazy-imports storage-coupled modules
// precisely so this file can import rage-click.js under plain Node).
import assert from 'node:assert/strict';
import {
  createRageDetector, describeTarget,
  RAGE_CLICKS, RAGE_WINDOW_MS, RAGE_RADIUS_PX, RAGE_COOLDOWN_MS,
  RAGE_MAX_REPORTS_PER_SESSION, RAGE_EXCLUDED_SCREENS,
} from './rage-click.js';

const T0 = 1783200000000;

// Helper: a click at (x, y) on `screen`, defaulting to a dead-zone div.
function click(ts, x, y, over = {}) {
  return {
    x, y, ts, screen: 'home', interactive: false,
    label: 'div "Weak areas"', xPct: 50, yPct: 40, ...over,
  };
}

// ---- fires once after RAGE_CLICKS clustered clicks ----
{
  const d = createRageDetector();
  let ev = null;
  for (let i = 0; i < RAGE_CLICKS; i++) {
    ev = d.feed(click(T0 + i * 200, 100 + i * 3, 200 + i * 2));
  }
  assert.ok(ev, 'burst of RAGE_CLICKS rapid clicks fires');
  assert.equal(ev.screen, 'home');
  assert.equal(ev.label, 'div "Weak areas"');
  assert.equal(ev.interactive, false);
  assert.equal(ev.clicks, RAGE_CLICKS);
  assert.equal(ev.xPct, 50);
  assert.equal(ev.yPct, 40);
  // the click BEFORE the threshold must not fire
  const d2 = createRageDetector();
  for (let i = 0; i < RAGE_CLICKS - 1; i++) {
    assert.equal(d2.feed(click(T0 + i * 100, 100, 200)), null, 'sub-threshold click stays null');
  }
}

// ---- a distant click re-anchors the burst (radius guard) ----
{
  const d = createRageDetector();
  d.feed(click(T0, 100, 200));
  d.feed(click(T0 + 100, 105, 203));
  d.feed(click(T0 + 200, 98, 199));
  // 4th click far away: outside RAGE_RADIUS_PX of the anchor -> new burst
  const ev = d.feed(click(T0 + 300, 100 + RAGE_RADIUS_PX + 30, 200));
  assert.equal(ev, null, 'distant 4th click does not fire');
  // ...and three more at the NEW anchor complete a fresh burst there
  d.feed(click(T0 + 400, 100 + RAGE_RADIUS_PX + 32, 201));
  d.feed(click(T0 + 500, 100 + RAGE_RADIUS_PX + 28, 199));
  const ev2 = d.feed(click(T0 + 600, 100 + RAGE_RADIUS_PX + 31, 202));
  assert.ok(ev2, 're-anchored burst fires at the new spot');
}

// ---- clicks spread wider than the window do not fire ----
{
  const d = createRageDetector();
  const gap = Math.ceil(RAGE_WINDOW_MS / 2); // total span 3*gap > window
  let ev = null;
  for (let i = 0; i < RAGE_CLICKS; i++) ev = d.feed(click(T0 + i * gap, 100, 200));
  assert.equal(ev, null, 'slow clicking never fires');
}

// ---- cooldown: one report per tantrum ----
{
  const d = createRageDetector();
  let ev = null;
  for (let i = 0; i < RAGE_CLICKS; i++) ev = d.feed(click(T0 + i * 100, 100, 200));
  assert.ok(ev, 'first tantrum fires');
  // keep hammering right after: suppressed by cooldown
  let ev2 = null;
  for (let i = 0; i < RAGE_CLICKS * 2; i++) ev2 = d.feed(click(T0 + 1000 + i * 100, 100, 200));
  assert.equal(ev2, null, 'continued hammering inside cooldown stays silent');
  // after the cooldown expires a new tantrum reports again
  const t1 = T0 + 1000 + RAGE_COOLDOWN_MS + 1000;
  let ev3 = null;
  for (let i = 0; i < RAGE_CLICKS; i++) ev3 = d.feed(click(t1 + i * 100, 100, 200));
  assert.ok(ev3, 'post-cooldown tantrum fires again');
}

// ---- excluded screens never fire (games + knowledge map) ----
{
  assert.ok(RAGE_EXCLUDED_SCREENS.includes('ward-boss'), 'ward-boss excluded');
  assert.ok(RAGE_EXCLUDED_SCREENS.includes('knowledge-map'), 'knowledge-map excluded');
  assert.ok(!RAGE_EXCLUDED_SCREENS.includes('quiz'), 'quiz stays INCLUDED by design');
  const d = createRageDetector();
  let ev = null;
  for (let i = 0; i < RAGE_CLICKS * 3; i++) {
    ev = d.feed(click(T0 + i * 50, 100, 200, { screen: 'ward-boss' }));
  }
  assert.equal(ev, null, 'game-screen spam never fires');
}

// ---- screen change mid-burst resets the burst ----
{
  const d = createRageDetector();
  d.feed(click(T0, 100, 200, { screen: 'home' }));
  d.feed(click(T0 + 100, 100, 200, { screen: 'home' }));
  d.feed(click(T0 + 200, 100, 200, { screen: 'home' }));
  const ev = d.feed(click(T0 + 300, 100, 200, { screen: 'settings' }));
  assert.equal(ev, null, 'click on a new screen re-anchors instead of firing');
}

// ---- session cap stops report N+1 ----
{
  const d = createRageDetector({ cooldownMs: 1 }); // collapse cooldown for the loop
  let fired = 0;
  let t = T0;
  for (let burst = 0; burst < RAGE_MAX_REPORTS_PER_SESSION + 3; burst++) {
    let ev = null;
    for (let i = 0; i < RAGE_CLICKS; i++) { t += 100; ev = d.feed(click(t, 100, 200)); }
    if (ev) fired += 1;
    t += 1000; // past the tiny cooldown, new burst
  }
  assert.equal(fired, RAGE_MAX_REPORTS_PER_SESSION, 'reports capped per session');
}

// ---- malformed / unattributable clicks are ignored ----
{
  const d = createRageDetector();
  assert.equal(d.feed(null), null);
  assert.equal(d.feed({}), null);
  assert.equal(d.feed(click(T0, 100, 200, { screen: null })), null, 'no screen, no signal');
  assert.equal(d.feed({ x: 'a', y: 200, ts: T0, screen: 'home' }), null, 'non-numeric coords ignored');
}

// ---- the anchor click names the report (interactive flag + label) ----
{
  const d = createRageDetector();
  d.feed(click(T0, 100, 200, { interactive: true, label: 'button "Start test"' }));
  d.feed(click(T0 + 100, 102, 201, { interactive: false, label: 'div "?"' }));
  d.feed(click(T0 + 200, 99, 200, { interactive: false, label: 'div "?"' }));
  const ev = d.feed(click(T0 + 300, 101, 202, { interactive: false, label: 'div "?"' }));
  assert.ok(ev, 'burst fires');
  assert.equal(ev.interactive, true, 'anchor click provides the interactive flag');
  assert.equal(ev.label, 'button "Start test"', 'anchor click provides the label');
}

// ---- describeTarget: PII-safe labels ----
{
  assert.equal(describeTarget(null), 'page background');
  const fake = (tag, attrs = {}, text = '') => ({
    nodeType: 1, tagName: tag,
    getAttribute: (k) => attrs[k] || null,
    textContent: text,
  });
  assert.equal(describeTarget(fake('BUTTON', {}, '  Start   test  ')), 'button "Start test"');
  assert.equal(describeTarget(fake('BUTTON', { 'aria-label': 'Close' }, 'X')), 'button "Close"');
  // inputs never leak text content (which could mirror typed values)
  assert.equal(describeTarget(fake('INPUT', {}, 'secret-value')), '<input>');
  const long = 'a'.repeat(120);
  const label = describeTarget(fake('DIV', {}, long));
  assert.ok(label.length <= 4 + 2 + 40 + 2, 'label capped at 40 chars of text');
}

console.log('rage-click.test.js: all assertions passed');
