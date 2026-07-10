// Contract test for src/lib/content-packs.js — runnable under Node:
//   node src/lib/content-packs.test.js
import assert from 'node:assert/strict';

const {
  CPACK_TYPES, cpackKey, validatePackItems, makePack, normalizePack,
  mergeDosage, mergeReference, mergeQuotes, mergeConceptCards,
} = await import('./content-packs.js');

assert.deepEqual(CPACK_TYPES, ['dosage', 'conceptCards', 'reference', 'quotes']);
assert.equal(cpackKey('quotes'), 'cpack:quotes');

// ---- dosage validation ----
{
  const good = { id: 'x1', q: 'Give?', answer: 2, unit: 'tablet(s)', tolerance: 0, steps: ['a', 'b'] };
  const r = validatePackItems('dosage', [good]);
  assert.equal(r.valid.length, 1);
  const bad = validatePackItems('dosage', [{ id: 'x', answer: 'two', unit: 'x' }]);
  assert.equal(bad.valid.length, 0);
  assert.ok(bad.invalid[0].errors.some(e => /answer/.test(e)));
}

// ---- reference + quotes ----
assert.equal(validatePackItems('reference', [{ cat: 'labs', label: 'Hb', value: '12-15' }]).valid.length, 1);
assert.equal(validatePackItems('reference', [{ cat: 'labs' }]).valid.length, 0);
assert.equal(validatePackItems('quotes', [{ text: 'Hi', source: 'Me' }]).valid.length, 1);
assert.equal(validatePackItems('quotes', [{ text: 'Hi' }]).valid.length, 0);

// ---- em-dash rule enforced ----
{
  const r = validatePackItems('quotes', [{ text: 'Study hard — always', source: 'X' }]);
  assert.equal(r.valid.length, 0, 'em dash rejected');
  assert.ok(r.invalid[0].errors.some(e => /dash/.test(e)));
  const r2 = validatePackItems('reference', [{ cat: 'a', label: 'b', value: 'c -- d' }]);
  assert.equal(r2.valid.length, 0, 'double hyphen rejected');
}

// ---- concept card group validation ----
{
  const good = { topicId: 'fund', sub: 'Vitals', cards: [{ type: 'concept', title: 'T', body: 'B' }, { type: 'keypoints', title: 'K', body: ['a', 'b'] }] };
  assert.equal(validatePackItems('conceptCards', [good]).valid.length, 1);
  const bad = validatePackItems('conceptCards', [{ topicId: 'fund', sub: 'x', cards: [{ type: 'weird', title: '', body: 3 }] }]);
  assert.equal(bad.valid.length, 0);
}

// ---- unknown type ----
assert.ok(validatePackItems('nope', []).parseError);

// ---- makePack / normalizePack ----
{
  const p = makePack('quotes', [{ text: 't', source: 's' }], 111);
  assert.equal(p.v, 1); assert.equal(p.type, 'quotes'); assert.equal(p.updatedAt, 111);
  assert.equal(normalizePack(p).items.length, 1);
  assert.equal(normalizePack({}), null);
  assert.equal(normalizePack(null), null);
}

// ---- mergers ----
{
  // dosage dedupes by id, base wins
  const base = [{ id: 'd1', q: 'base' }];
  const merged = mergeDosage(base, [{ id: 'd1', q: 'dup' }, { id: 'd2', q: 'new' }]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(x => x.id === 'd1').q, 'base', 'base wins on id clash');

  // reference just appends
  assert.equal(mergeReference([{ label: 'a' }], [{ label: 'b' }]).length, 2);

  // quotes dedupe by text
  const q = mergeQuotes([{ text: 'x', source: 'a' }], [{ text: 'x', source: 'b' }, { text: 'y', source: 'c' }]);
  assert.equal(q.length, 2);

  // concept cards: append to existing sub, create new topic
  const cbase = { fund: [{ sub: 'Vitals', cards: [{ title: 'A', body: '1' }] }] };
  const cm = mergeConceptCards(cbase, [
    { topicId: 'fund', sub: 'Vitals', cards: [{ title: 'B', body: '2' }] },
    { topicId: 'obg', sub: 'Labor', cards: [{ title: 'C', body: '3' }] },
  ]);
  assert.equal(cm.fund[0].cards.length, 2, 'appended into existing sub');
  assert.equal(cm.fund[0].cards[0].title, 'A', 'base card first');
  assert.equal(cm.obg[0].sub, 'Labor', 'new topic added');
  // base object not mutated
  assert.equal(cbase.fund[0].cards.length, 1, 'base untouched');
}

console.log('content-packs.test.js: all assertions passed');
