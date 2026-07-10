// Contract test for src/lib/topics.js (resolveTopicId + lookups) — Node:
//   node src/lib/topics.test.js
import assert from 'node:assert/strict';

const { resolveTopicId, topicName, topicIcon, getWeakTopics } = await import('./topics.js');

// ---- canonical ids pass through untouched ----
{
  for (const id of ['fund', 'anat', 'msn', 'pharm', 'peds', 'obg', 'ch', 'mhn', 'micro', 'nutr', 'gk', 'apt']) {
    assert.equal(resolveTopicId(id), id);
  }
}

// ---- the reported bug: 'aptitude' variants collapse onto apt ----
{
  for (const raw of ['aptitude', 'Aptitude', 'APTITUDE', ' aptitude ', 'Reasoning', 'Reasoning & Aptitude', 'reasoning and aptitude']) {
    assert.equal(resolveTopicId(raw), 'apt', raw);
  }
  assert.equal(topicName('aptitude'), 'Reasoning & Aptitude');
  assert.equal(topicIcon('aptitude'), topicIcon('apt'));
}

// ---- display names and common variants resolve for every topic ----
{
  assert.equal(resolveTopicId('General Knowledge'), 'gk');
  assert.equal(resolveTopicId('Pharmacology'), 'pharm');
  assert.equal(resolveTopicId('Pediatric Nursing'), 'peds');
  assert.equal(resolveTopicId('paediatrics'), 'peds');
  assert.equal(resolveTopicId('Obstetrics & Gynaecology'), 'obg');
  assert.equal(resolveTopicId('midwifery'), 'obg');
  assert.equal(resolveTopicId('Medical-Surgical Nursing'), 'msn');
  assert.equal(resolveTopicId('med-surg'), 'msn');
  assert.equal(resolveTopicId('Community Health'), 'ch');
  assert.equal(resolveTopicId('Mental Health Nursing'), 'mhn');
  assert.equal(resolveTopicId('Anatomy & Physiology'), 'anat');
  assert.equal(resolveTopicId('Fundamentals of Nursing'), 'fund');
  assert.equal(resolveTopicId('Microbiology'), 'micro');
  assert.equal(resolveTopicId('Nutrition'), 'nutr');
}

// ---- genuinely custom topics pass through; empty input is safe ----
{
  assert.equal(resolveTopicId('ophthalmic-nursing'), 'ophthalmic-nursing');
  assert.equal(topicName('ophthalmic-nursing'), 'ophthalmic-nursing');
  assert.equal(resolveTopicId(''), '');
  assert.equal(resolveTopicId(null), null);
  assert.equal(resolveTopicId(undefined), undefined);
}

// ---- getWeakTopics merges alias topics into one canonical bucket ----
{
  const questions = [
    { id: 'a1', topic: 'apt' },
    { id: 'a2', topic: 'aptitude' }, // legacy upload variant
  ];
  const wrong = { correct: false, ts: 1 }; const right = { correct: true, ts: 1 };
  const history = {
    a1: { attempts: [wrong, wrong] },
    a2: { attempts: [right, wrong] },
  };
  const weak = getWeakTopics(history, questions, true); // includeGk -> apt counts
  assert.equal(weak.length, 1, 'apt + aptitude merge into one row');
  assert.equal(weak[0].topic, 'apt');
  assert.equal(weak[0].total, 4);
}

console.log('topics.test.js: all passed');
