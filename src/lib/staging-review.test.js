// Focused contract test for src/lib/staging-review.js — runnable under Node:
//   node src/lib/staging-review.test.js
// Pure module (only depends on banks.js), so no DOM/build stubs are needed.
import assert from 'node:assert/strict';
import { groupStagingByTopic, difficultySpread, buildAiBank } from './staging-review.js';

// groupStagingByTopic: groups by topic, preserves first-seen order, defaults to 'misc'.
{
  const rows = [
    { id: '1', topic: 'msn' }, { id: '2', topic: 'pharm' },
    { id: '3', topic: 'msn' }, { id: '4' /* no topic */ },
  ];
  const g = groupStagingByTopic(rows);
  assert.deepEqual(g.map(x => x.topic), ['msn', 'pharm', 'misc']);
  assert.equal(g[0].rows.length, 2);
  assert.equal(g[1].rows[0].id, '2');
  assert.equal(g[2].topic, 'misc');
  assert.deepEqual(groupStagingByTopic(null), []);
}

// difficultySpread: buckets easy/medium/hard, everything else -> other.
{
  const s = difficultySpread([
    { difficulty: 'easy' }, { difficulty: 'easy' }, { difficulty: 'hard' },
    { difficulty: 'weird' }, {},
  ]);
  assert.deepEqual(s, { easy: 2, medium: 0, hard: 1, other: 2 });
  assert.deepEqual(difficultySpread([]), { easy: 0, medium: 0, hard: 0, other: 0 });
}

// buildAiBank: BankEditor new-bank shape; public stamps publishedAt, private omits it.
{
  const qs = [{ id: 'q1' }, { id: 'q2' }];
  const pub = buildAiBank({
    name: '  Set A  ', description: '  d  ', visibility: 'public',
    questions: qs, profile: { id: 'p1', displayName: 'Admin' },
  });
  assert.equal(pub.name, 'Set A');
  assert.equal(pub.description, 'd');
  assert.equal(pub.visibility, 'public');
  assert.equal(pub.version, 1);
  assert.ok(pub.publishedAt > 0, 'public bank stamps publishedAt');
  assert.equal(pub.ownerId, 'p1');
  assert.equal(pub.ownerName, 'Admin');
  assert.equal(pub.questions, qs);
  assert.ok(/^bk-/.test(pub.id), 'id uses newBankId() format');

  const priv = buildAiBank({ name: 'B', visibility: 'private', questions: qs, profile: null });
  assert.equal(priv.visibility, 'private');
  assert.equal('publishedAt' in priv, false, 'private bank omits publishedAt');
  assert.equal(priv.ownerId, null);
  assert.equal(priv.ownerName, null);

  // Unknown/blank visibility defaults to public (matches bankVisibility()).
  assert.equal(buildAiBank({ name: 'C', questions: [], profile: null }).visibility, 'public');
}

console.log('staging-review.test.js: all assertions passed');
