// Contract test for src/lib/question-import.js — runnable under Node:
//   node src/lib/question-import.test.js
import assert from 'node:assert/strict';

const { processQuestionInput, validateQuestionFields } = await import('./question-import.js');

const BASE = {
  q: 'Normal adult pulse?', type: 'mcq', topic: 'fund',
  options: ['40-60', '60-100', '100-120'], correct: [1], exp: '60-100 bpm.',
};

// ---- happy path keeps working ----
{
  const r = processQuestionInput(JSON.stringify([BASE]), 'json', 't');
  assert.equal(r.valid.length, 1);
  assert.equal(r.invalid.length, 0);
  assert.equal(r.valid[0].exp, '60-100 bpm.');
}

// ---- media fields survive normalization ----
{
  const withMedia = { ...BASE, image: ' https://pub-x.r2.dev/q/a.png ', video: ' https://youtu.be/dQw4w9WgXcQ ' };
  const r = processQuestionInput(JSON.stringify([withMedia]), 'json', 't');
  assert.equal(r.valid[0].image, 'https://pub-x.r2.dev/q/a.png', 'image trimmed + kept');
  assert.equal(r.valid[0].video, 'https://youtu.be/dQw4w9WgXcQ', 'video trimmed + kept');
  const bare = processQuestionInput(JSON.stringify([BASE]), 'json', 't');
  assert.equal('video' in bare.valid[0], false, 'no video field when absent');
}

// ---- requireExp: default strict, papers relaxed ----
{
  const noExp = { ...BASE, exp: undefined };
  const strict = processQuestionInput(JSON.stringify([noExp]), 'json', 't');
  assert.equal(strict.valid.length, 0, 'missing exp rejected by default');
  assert.ok(strict.invalid[0].errors.some(e => /explanation/i.test(e)));

  const relaxed = processQuestionInput(JSON.stringify([noExp]), 'json', 't', { requireExp: false });
  assert.equal(relaxed.valid.length, 1, 'paper mode accepts answer-only questions');
  assert.equal(relaxed.valid[0].exp, '', 'empty exp normalized to empty string');

  // other rules still bite in relaxed mode
  const bad = { ...noExp, correct: [9] };
  const r2 = processQuestionInput(JSON.stringify([bad]), 'json', 't', { requireExp: false });
  assert.equal(r2.valid.length, 0, 'out-of-range correct still rejected');
}

// ---- validateQuestionFields opts surface directly ----
assert.ok(validateQuestionFields({ ...BASE, exp: '' }).length === 1);
assert.ok(validateQuestionFields({ ...BASE, exp: '' }, { requireExp: false }).length === 0);

// ---- CSV path still parses (with the new video column present but empty) ----
{
  const csv = 'q,type,topic,options,correct,exp,video\n"Pulse?",mcq,fund,"a|b","1","Because.",';
  const r = processQuestionInput(csv, 'csv', 't');
  assert.equal(r.valid.length, 1);
  assert.equal('video' in r.valid[0], false, 'empty CSV video cell omitted');
}

console.log('question-import.test.js: all assertions passed');
