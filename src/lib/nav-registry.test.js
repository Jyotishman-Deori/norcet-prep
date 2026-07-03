// Contract test for src/lib/nav-registry.js — runnable under Node:
//   node src/lib/nav-registry.test.js
// Pure module (no storage/DOM), so no stubs are needed.
import assert from 'node:assert/strict';
import {
  buildNavRegistry, searchRegistry, NAV_CATEGORIES, NAV_RESULT_LIMIT,
  faqRegistryEntries, sanitizeRegistry, buildDynamicRegistry, STUDENT_ROUTE_SCREENS,
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

// ---- faqRegistryEntries: dynamic admin content → the same schema ----
{
  const faqs = [
    { id: 'f1', question: 'How is my streak calculated?', answer: 'One **graded** day at a time, with a grace day.', category: 'Scoring' },
    { id: 'f2', question: 'Can I use the app offline?', answer: 'Yes — everything except sync.', category: 'App' },
    { id: '', question: 'malformed' }, null,
  ];
  const entries = faqRegistryEntries(faqs);
  assert.equal(entries.length, 2, 'malformed rows dropped');
  const e = entries[0];
  assert.equal(e.id, 'faq-f1');
  assert.equal(e.category, 'FAQ');
  assert.deepEqual(e.route, { screen: 'faq', focusId: 'f1' });
  assert.ok(!e.description.includes('**'), 'rich-text markers stripped from description');
  assert.ok(e.keywords.some(k => k.includes('grace day')), 'full answer text searchable via keywords');
  // and they rank in searchRegistry like any other entry
  const hit = searchRegistry(entries, 'offline');
  assert.equal(hit[0].id, 'faq-f2');
  assert.deepEqual(faqRegistryEntries(null), []);
}

// ---- sanitizeRegistry: strips admin/unknown routes + malformed entries ----
{
  const good = { id: 'ok', title: 'Stats', category: 'Features', keywords: ['stats'], route: { screen: 'stats' }, description: 'x' };
  const evil = [
    { ...good, id: 'adm1', route: { screen: 'add-question' } },        // admin-only screen
    { ...good, id: 'adm2', route: { screen: 'admin-panel' } },         // not a student route
    { ...good, id: 'bad1', category: 'Internal' },                     // unknown category
    { ...good, id: 'bad2', keywords: [] },                             // no keywords
    { ...good, id: 'bad3', route: null },                              // null route without action
    { ...good, id: 'bad4', description: '' },
    { ...good, id: 'act1', route: null, action: 'note' },              // allowed action
    good,
  ];
  const clean = sanitizeRegistry(evil);
  assert.deepEqual(clean.map(e => e.id).sort(), ['act1', 'ok'], 'only the valid entries survive');
  assert.ok(!STUDENT_ROUTE_SCREENS.has('add-question'), 'admin route stays off the allowlist');
  assert.deepEqual(sanitizeRegistry(null), []);
}

// ---- buildDynamicRegistry: static + units + FAQs, sanitized, all routable ----
{
  const reg = buildDynamicRegistry({
    topics: TOPICS_FIXTURE,
    faqs: [{ id: 'f1', question: 'How do coins work?', answer: 'Earn by accuracy.', category: 'Scoring' }],
  });
  assert.ok(reg.some(e => e.id === 'faq-f1'));
  assert.ok(reg.some(e => e.id === 'unit-pharm'));
  assert.ok(reg.some(e => e.id === 'settings'));
  for (const e of reg) {
    assert.ok(e.route === null ? e.action : STUDENT_ROUTE_SCREENS.has(e.route.screen),
      `every compiled entry is route-safe: ${e.id}`);
  }
  // static-only registry survives sanitization untouched (nothing legal dropped)
  assert.equal(buildDynamicRegistry({ topics: TOPICS_FIXTURE }).length,
    buildNavRegistry(TOPICS_FIXTURE).length, 'sanitize drops nothing from the static registry');
}

console.log('nav-registry.test.js: all passed');
