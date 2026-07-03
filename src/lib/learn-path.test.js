// Contract test for src/lib/learn-path.js — runnable under Node:
//   node src/lib/learn-path.test.js
import assert from 'node:assert/strict';
import { buildLearnPath, orderTopicsByPrereq, compileGuidebook, PATH_REASON_LABEL } from './learn-path.js';

const NOW = 1783100000000;

const TOPICS = [
  { id: 'fund',  name: 'Fundamentals of Nursing', icon: '🩺', color: '#0F4C4C' },
  { id: 'anat',  name: 'Anatomy & Physiology',    icon: '🫀', color: '#7A4A2E' },
  { id: 'msn',   name: 'Medical-Surgical Nursing', icon: '💊', color: '#1F5A4A' },
  { id: 'pharm', name: 'Pharmacology',            icon: '⚕️', color: '#5A3A6A' },
  { id: 'nutr',  name: 'Nutrition',               icon: '🥗', color: '#3A6A4A' },
];

const q = (id, topic) => ({ id, topic, q: 's', options: ['a', 'b'], correct: [0] });
const QUESTIONS = [
  q('f1', 'fund'), q('f2', 'fund'),
  q('a1', 'anat'), q('a2', 'anat'),
  q('m1', 'msn'),
  q('p1', 'pharm'),
  q('n1', 'nutr'),
];
const att = (n, right) => ({
  attempts: Array.from({ length: n }, (_, i) => ({ ts: NOW - i, correct: i < right })),
  reviewCount: 0, nextDue: null, lastResult: right > 0 ? 'right' : 'wrong',
});

// ---- prerequisite ordering: fund/anat before msn; msn after pharm too ----
{
  const order = orderTopicsByPrereq(TOPICS.map(t => t.id));
  const at = (id) => order.indexOf(id);
  assert.ok(at('fund') < at('msn'), 'fund before msn');
  assert.ok(at('anat') < at('msn'), 'anat before msn');
  assert.ok(at('anat') < at('pharm'), 'anat before pharm');
  assert.ok(at('pharm') < at('msn'), 'pharm before msn');
  assert.equal(order.length, 5, 'every topic placed exactly once');
  // ids without edges keep original relative position among the ready pool
  assert.ok(order.includes('nutr'));
}

// ---- node states + coverage from history ----
{
  const history = {
    f1: att(12, 10), f2: att(14, 12),   // fund: 26 attempts, ~85% → familiar (needs 25+80% for mastered: 22/26 = 84.6% → mastered!)
    a1: att(2, 1),                      // anat: discovered
  };
  const path = buildLearnPath({ history, allQuestions: QUESTIONS, topics: TOPICS });
  const by = Object.fromEntries(path.map(n => [n.topicId, n]));
  assert.equal(by.fund.state, 'mastered', '26 attempts @ ~85% accuracy');
  assert.equal(by.fund.coverage, 1, 'both fund questions answered');
  assert.equal(by.anat.state, 'discovered');
  assert.equal(by.msn.state, 'locked');
  assert.equal(by.msn.attempted, 0);
  assert.ok(by.anat.next.label.includes('Familiar'), 'next-step hint rides kmap thresholds');
}

// ---- recommended: first non-mastered with all prereqs touched ----
{
  const history = { f1: att(12, 10), f2: att(14, 12), a1: att(2, 1) };
  const path = buildLearnPath({ history, allQuestions: QUESTIONS, topics: TOPICS });
  const rec = path.filter(n => n.recommended);
  assert.equal(rec.length, 1, 'exactly one recommended node');
  assert.equal(rec[0].topicId, 'anat', 'fund is mastered; anat is the next non-mastered in order');
  assert.equal(rec[0].reason, 'continue');
  assert.ok(PATH_REASON_LABEL[rec[0].reason]);
}
// struggling unit gets the 'strengthen' reason
{
  const history = { f1: att(6, 1) };   // fund: 6 attempts, 16% accuracy
  const path = buildLearnPath({ history, allQuestions: QUESTIONS, topics: TOPICS });
  const rec = path.find(n => n.recommended);
  assert.equal(rec.topicId, 'fund');
  assert.equal(rec.reason, 'strengthen');
}
// untouched everything → first unit in path order says 'start'
{
  const path = buildLearnPath({ history: {}, allQuestions: QUESTIONS, topics: TOPICS });
  const rec = path.find(n => n.recommended);
  assert.equal(rec.reason, 'start');
  assert.equal(rec.topicId, path[0].topicId);
}

// ---- degenerate inputs ----
assert.deepEqual(buildLearnPath({}), []);
assert.deepEqual(buildLearnPath(), []);
assert.deepEqual(orderTopicsByPrereq(null), []);

// ---- compileGuidebook: keypoints + mnemonics from concept cards ----
{
  const cc = {
    pharm: [
      { sub: 'Endocrine', cards: [
        { type: 'concept', title: 'Insulin types', body: 'Prose…' },
        { type: 'keypoints', title: 'Key points', body: ['Rapid: lispro', 'Long: glargine'] },
        { type: 'mnemonic', title: 'MONA', body: 'Morphine Oxygen Nitrates Aspirin' },
      ] },
      { sub: 'Cardiac', cards: [
        { type: 'keypoints', title: 'KP', body: 'Single string body' },   // string body variant
      ] },
      { sub: 'Empty', cards: [ { type: 'concept', title: 'Only prose', body: 'x' } ] }, // dropped
    ],
    junk: 'not-an-array',
  };
  const g = compileGuidebook('pharm', cc);
  assert.equal(g.topicId, 'pharm');
  assert.equal(g.totalCards, 5);
  assert.equal(g.modules.length, 2, 'module with neither keypoints nor mnemonics dropped');
  assert.deepEqual(g.modules[0].keypoints, ['Rapid: lispro', 'Long: glargine']);
  assert.equal(g.modules[0].mnemonics[0].title, 'MONA');
  assert.deepEqual(g.modules[1].keypoints, ['Single string body']);

  assert.equal(compileGuidebook('missing', cc), null);
  assert.equal(compileGuidebook('junk', cc), null);
  assert.equal(compileGuidebook('pharm', null), null);
}

console.log('learn-path.test.js: all passed');
