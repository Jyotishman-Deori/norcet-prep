// Contract test for src/lib/search.js — runnable under Node:
//   node src/lib/search.test.js
// Pure module (no storage/DOM), so no stubs are needed.
import assert from 'node:assert/strict';
import {
  tokenize, buildEntries, searchEntries, highlightSegments,
  SEARCH_GROUPS, MIN_QUERY_LEN, PRACTICE_CAP,
} from './search.js';

// ---- tokenize: lowercase, punctuation-stripped, deduped ----
assert.deepEqual(tokenize('  Insulin, INSULIN dose! '), ['insulin', 'dose']);
assert.deepEqual(tokenize(''), []);
assert.deepEqual(tokenize('§±☺'), [], 'symbol-only input yields no tokens');
assert.deepEqual(tokenize('b12'), ['b12'], 'alphanumerics survive');

// ---- fixture sources (mirror real shapes, incl. the awkward ones) ----
const questions = [
  { id: 'q1', topic: 'pharm', sub: 'Endocrine', type: 'mcq', q: 'Which insulin is rapid acting?',
    options: ['Lispro', 'NPH', 'Glargine', 'Regular'], correct: [0], exp: 'Lispro onset 10–15 min.' },
  { id: 'q2', topic: 'fund', q: 'First step in hand hygiene?', options: ['Wet hands', 'Apply soap'],
    correct: [0], exp: 'Wet hands before applying soap.' },
  { id: 'q3', topic: 'pharm', q: 'Insulin storage temperature?', options: ['2–8°C', 'Room temp'],
    correct: [0], exp: 'Refrigerate unopened insulin.' },
];
const reference = [
  { cat: 'labs', section: 'Glucose', label: 'Fasting blood sugar', value: '70–110 mg/dL', note: 'insulin regulates' },
  { cat: 'drugs', section: 'Emergency', label: 'Adrenaline dose', value: '1 mg IV' },
];
const dosage = [
  { id: 'd1', type: 'liquid', q: 'Insulin 30 units from 100 units/mL vial', answer: 0.3, unit: 'mL',
    steps: ['30/100'], intuition: 'Less than half a mL.' },
];
const conceptCards = {
  pharm: [
    { sub: 'Endocrine', cards: [
      { type: 'concept', title: 'Insulin types', body: 'Rapid, short, intermediate, long acting.', clinicalNote: 'Never shake vials.' },
      { type: 'keypoints', title: 'Hypoglycemia signs', body: ['Sweating', 'Tremor', 'Confusion'] },
    ] },
  ],
  junk: 'not-an-array',            // malformed topic must be skipped, not throw
};
const faqs = [
  { id: 'f1', question: 'How is my streak calculated?', answer: 'One **graded** day at a time.', category: 'Scoring' },
];

const entries = buildEntries({ questions, reference, dosage, conceptCards, faqs });

// ---- buildEntries: every source flattened; malformed input skipped ----
assert.equal(entries.filter(e => e.type === 'question').length, 3);
assert.equal(entries.filter(e => e.type === 'reference').length, 2);
assert.equal(entries.filter(e => e.type === 'dosage').length, 1);
assert.equal(entries.filter(e => e.type === 'concept').length, 2, 'junk topic contributes nothing');
assert.equal(entries.filter(e => e.type === 'faq').length, 1);
// keypoints body (string[]) is joined into the haystack
const kp = entries.find(e => e.title === 'Hypoglycemia signs');
assert.ok(kp.bHay.includes('tremor'));
// FAQ rich-text markers are stripped from snippet + haystack
const faqE = entries.find(e => e.type === 'faq');
assert.ok(!faqE.snippet.includes('**'));
assert.ok(faqE.bHay.includes('graded'));
// empty / missing sources are fine
assert.deepEqual(buildEntries({}), []);
assert.deepEqual(buildEntries(), []);

// ---- searchEntries: grouped, AND semantics, weighted ----
const r1 = searchEntries(entries, 'insulin');
assert.equal(r1.total, 5, 'insulin hits: q1 + q3 + FBS ref + dosage + concept card (not faq/q2)');
assert.deepEqual(r1.groups.map(g => g.type),
  ['question', 'concept', 'reference', 'dosage'],
  'groups follow SEARCH_GROUPS order and empty groups are dropped');
// title word-start hits outrank body-only hits inside the question group
const qGroup = r1.groups.find(g => g.type === 'question');
assert.equal(qGroup.total, 2);
assert.deepEqual([...r1.questionIds].sort(), ['q1', 'q3'], 'questionIds = exactly the matching ids');

// AND semantics: adding a token narrows
const r2 = searchEntries(entries, 'insulin storage');
assert.equal(r2.total, 1);
assert.equal(r2.groups[0].items[0].payload.id, 'q3');

// field weighting: a title hit ("Adrenaline dose") must rank first within
// its group even when other entries match the token in body fields only.
const r3 = searchEntries(entries, 'dose');
const refGroup = r3.groups.find(g => g.type === 'reference');
assert.equal(refGroup.items[0].title, 'Adrenaline dose');

// perGroup caps items but total keeps the full count
const many = buildEntries({
  questions: Array.from({ length: 12 }, (_, i) =>
    ({ id: 'x' + i, topic: 'fund', q: 'Oxygen therapy question ' + i, options: ['a'], correct: [0], exp: '' })),
});
const r4 = searchEntries(many, 'oxygen', { perGroup: 5 });
assert.equal(r4.groups[0].items.length, 5);
assert.equal(r4.groups[0].total, 12);
assert.equal(r4.questionIds.length, 12, 'questionIds lists ALL matches (screen caps at PRACTICE_CAP)');

// short/empty queries return the empty result
assert.deepEqual(searchEntries(entries, 'i'), { groups: [], total: 0, questionIds: [] });
assert.deepEqual(searchEntries(entries, '   '), { groups: [], total: 0, questionIds: [] });
assert.deepEqual(searchEntries(null, 'insulin'), { groups: [], total: 0, questionIds: [] });
assert.ok(MIN_QUERY_LEN >= 2 && PRACTICE_CAP > 0);

// no match → no groups
assert.equal(searchEntries(entries, 'zzzznothing').total, 0);

// ---- highlightSegments ----
assert.deepEqual(highlightSegments('Insulin dose', ['insulin']),
  [{ text: 'Insulin', hit: true }, { text: ' dose', hit: false }]);
// overlapping token ranges merge into one hit segment
assert.deepEqual(highlightSegments('abcde', ['abc', 'cde']),
  [{ text: 'abcde', hit: true }]);
// multiple occurrences all mark
const segs = highlightSegments('insulin then more insulin', ['insulin']);
assert.equal(segs.filter(s => s.hit).length, 2);
// no tokens / no text degrade gracefully
assert.deepEqual(highlightSegments('plain', []), [{ text: 'plain', hit: false }]);
assert.deepEqual(highlightSegments('', ['x']), []);
assert.deepEqual(highlightSegments('plain', ['zz']), [{ text: 'plain', hit: false }]);

// ---- SEARCH_GROUPS is the render contract ----
assert.deepEqual(SEARCH_GROUPS.map(g => g.type),
  ['question', 'concept', 'reference', 'dosage', 'faq']);

console.log('search.test.js: all passed');
