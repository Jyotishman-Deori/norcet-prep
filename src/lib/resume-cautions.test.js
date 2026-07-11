// Contract test for src/lib/resume-cautions.js — runnable under Node:
//   node src/lib/resume-cautions.test.js
import assert from 'node:assert/strict';
import {
  INTEGRITY_REMINDER, BREAK_NOTE, EXIT_TIPS, RESUME_TIPS,
  pickTip, buildCaution,
} from './resume-cautions.js';

// ---- the pools exist and are substantial (a real rotating list) ----
assert.ok(EXIT_TIPS.length >= 4, 'several exit nudges so they feel fresh');
assert.ok(RESUME_TIPS.length >= 4, 'several return welcomes');
assert.ok(INTEGRITY_REMINDER.length > 20 && BREAK_NOTE.length > 20);

// ---- HOUSE RULE: no em dash and no double hyphen in any user-facing string ----
{
  const all = [INTEGRITY_REMINDER, BREAK_NOTE, ...EXIT_TIPS, ...RESUME_TIPS];
  for (const s of all) {
    assert.ok(!s.includes('—'), `em dash in caution copy: ${s}`);
    assert.ok(!s.includes('--'), `double hyphen in caution copy: ${s}`);
    assert.equal(typeof s, 'string');
    assert.ok(s.trim().length > 0, 'no blank entries');
  }
  // the fixed integrity line must actually speak to honesty / not looking up
  assert.ok(/honest|know|notes|search|borrow/i.test(INTEGRITY_REMINDER),
    'integrity line addresses answering honestly');
  // the break note reassures about water / bathroom
  assert.ok(/water|bathroom|break/i.test(BREAK_NOTE));
}

// ---- pickTip rotates through the whole pool without an immediate repeat ----
{
  for (let c = 0; c < EXIT_TIPS.length; c++) {
    assert.equal(pickTip(EXIT_TIPS, c), EXIT_TIPS[c]);
    // consecutive cursors never yield the same string (pool has no dupes)
    assert.notEqual(pickTip(EXIT_TIPS, c), pickTip(EXIT_TIPS, c + 1),
      'adjacent cursors give different tips');
  }
  // a full cycle returns to the start
  assert.equal(pickTip(EXIT_TIPS, EXIT_TIPS.length), EXIT_TIPS[0]);
  // negative / non-finite cursors are safe
  assert.equal(pickTip(EXIT_TIPS, -1), EXIT_TIPS[EXIT_TIPS.length - 1]);
  assert.equal(pickTip(EXIT_TIPS, NaN), EXIT_TIPS[0]);
  // empty / invalid pool is graceful
  assert.equal(pickTip([], 3), '');
  assert.equal(pickTip(null, 3), '');
  // no duplicate strings within a pool (so rotation always feels new)
  assert.equal(new Set(EXIT_TIPS).size, EXIT_TIPS.length, 'exit tips are unique');
  assert.equal(new Set(RESUME_TIPS).size, RESUME_TIPS.length, 'resume tips are unique');
}

// ---- buildCaution assembles the render bundle ----
{
  const exit = buildCaution({ kind: 'exit', cursor: 0 });
  assert.equal(exit.tip, EXIT_TIPS[0]);
  assert.equal(exit.integrity, INTEGRITY_REMINDER, 'fixed integrity line always present');
  assert.equal(exit.breakNote, BREAK_NOTE);

  const resume = buildCaution({ kind: 'resume', cursor: 1 });
  assert.equal(resume.tip, RESUME_TIPS[1]);
  assert.equal(resume.integrity, INTEGRITY_REMINDER);

  // unknown / missing kind defaults to the exit pool, never throws
  assert.equal(buildCaution({ cursor: 0 }).tip, EXIT_TIPS[0]);
  assert.equal(buildCaution().integrity, INTEGRITY_REMINDER);
}

console.log('resume-cautions.test.js: all passed');
