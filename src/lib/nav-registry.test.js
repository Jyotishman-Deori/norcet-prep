// Contract test for src/lib/nav-registry.js — runnable under Node:
//   node src/lib/nav-registry.test.js
// Pure module (no storage/DOM), so no stubs are needed.
import assert from 'node:assert/strict';
import {
  buildNavRegistry, searchRegistry, NAV_CATEGORIES, NAV_RESULT_LIMIT,
} from './nav-registry.js';

const TOPICS_FIXTURE = [
  { id: 'fund', name: 'Fundamentals of Nursing', icon: '🩺', color: '#0F4C4C' },
  { id: 'pharm', name: 'Pharmacology', icon: '⚕️', color: '#5A3A6A' },
];

const registry = buildNavRegistry(TOPICS_FIXTURE);

// ---- registry shape contract (every entry, including generated units) ----
{
  const ids = new Set();
  for (const e of registry) {
    assert.ok(e.id && typeof e.id === 'string', 'id required');
    assert.ok(!ids.has(e.id), `duplicate id: ${e.id}`);
    ids.add(e.id);
    assert.ok(e.title && typeof e.title === 'string', `${e.id}: title required`);
    assert.ok(NAV_CATEGORIES.includes(e.category), `${e.id}: bad category ${e.category}`);
    assert.ok(Array.isArray(e.keywords) && e.keywords.length > 0, `${e.id}: keywords required`);
    assert.ok(typeof e.description === 'string' && e.description.length > 0, `${e.id}: description required`);
    // Every entry is actionable: a nav-object route OR an imperative action.
    if (e.route === null) assert.ok(e.action, `${e.id}: null route needs an action`);
    else assert.ok(e.route && typeof e.route.screen === 'string', `${e.id}: route.screen required`);
  }
}

// ---- units are generated from the passed topics, one each, deep-linked ----
{
  const units = registry.filter(e => e.category === 'Units');
  assert.equal(units.length, 2);
  const pharm = units.find(u => u.id === 'unit-pharm');
  assert.deepEqual(pharm.route, { screen: 'learn-cards', topicId: 'pharm' });
  assert.ok(pharm.keywords.includes('pharmacology'));
  // registry works without topics too (static shortcuts only)
  assert.equal(buildNavRegistry().filter(e => e.category === 'Units').length, 0);
  assert.equal(buildNavRegistry(null).filter(e => e.category === 'Units').length, 0);
}

// ---- ranking: exact title > title prefix/word > keyword > description ----
{
  // exact title match wins outright
  const r = searchRegistry(registry, 'settings');
  assert.equal(r[0].id, 'settings');

  // keyword tag routes correctly: "dark mode" → Themes
  const dark = searchRegistry(registry, 'dark mode');
  assert.equal(dark[0].id, 'themes');

  // "mistakes" → Weak Areas hub (title + keyword)
  const mist = searchRegistry(registry, 'mistakes');
  assert.equal(mist[0].id, 'weak-areas');

  // unit deep-link: "pharmacology" puts the unit at/near the top
  const ph = searchRegistry(registry, 'pharmacology');
  assert.equal(ph[0].id, 'unit-pharm');

  // title-word hit outranks a description-only hit
  const guide = searchRegistry(registry, 'guidebook');
  assert.equal(guide[0].id, 'study-methods');
}

// ---- AND semantics: extra tokens narrow, never widen ----
{
  const wide = searchRegistry(registry, 'test');
  assert.ok(wide.length > 1);
  const narrow = searchRegistry(registry, 'mock test');
  assert.equal(narrow[0].id, 'mock-test');
  assert.ok(narrow.length <= wide.length);
  // a token that matches nothing kills the entry (no partial OR results)
  assert.deepEqual(searchRegistry(registry, 'test zzznothing'), []);
}

// ---- limit + degenerate inputs ----
{
  assert.ok(searchRegistry(registry, 'a').length <= NAV_RESULT_LIMIT); // single letter tokenizes; still capped
  const capped = searchRegistry(registry, 'test', { limit: 2 });
  assert.ok(capped.length <= 2);
  assert.deepEqual(searchRegistry(registry, ''), []);
  assert.deepEqual(searchRegistry(registry, '   '), []);
  assert.deepEqual(searchRegistry(null, 'test'), []);
}

// ---- imperative popups are represented as actions, not routes ----
{
  const notes = searchRegistry(registry, 'notebook');
  assert.equal(notes[0].id, 'notes');
  assert.equal(notes[0].route, null);
  assert.equal(notes[0].action, 'note');
  const fb = searchRegistry(registry, 'report a bug');
  assert.equal(fb[0].id, 'send-feedback');
  assert.equal(fb[0].action, 'feedback');
}

console.log('nav-registry.test.js: all passed');
