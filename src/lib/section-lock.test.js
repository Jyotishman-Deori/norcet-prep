// Contract test for src/lib/section-lock.js — runnable under Node:
//   node src/lib/section-lock.test.js
import assert from 'node:assert/strict';

const { SECTION_SIZE, SECTION_MINUTES, STRESS_WINDOW_SEC, CRITICAL_WINDOW_SEC,
        buildSections, totalSeconds, sectionForIndex, stressPhase, sectionLabel } =
  await import('./section-lock.js');

// ---- the real NORCET Prelims shape: 100 Qs -> 5 x 20 Q x 18 min ----
{
  const s = buildSections(100);
  assert.equal(s.length, 5);
  s.forEach((sec, i) => {
    assert.equal(sec.index, i);
    assert.equal(sec.count, 20);
    assert.equal(sec.seconds, 18 * 60);
    assert.equal(sec.start, i * 20);
    assert.equal(sec.end, i * 20 + 20);
  });
  assert.equal(totalSeconds(s), 5 * 18 * 60);
  assert.equal(SECTION_SIZE, 20);
  assert.equal(SECTION_MINUTES, 18);
}

// ---- 20 Qs = a single 18-min section; 50 Qs = 20/20/10 with scaled tail ----
{
  const one = buildSections(20);
  assert.equal(one.length, 1);
  assert.equal(one[0].seconds, 18 * 60);

  const fifty = buildSections(50);
  assert.equal(fifty.length, 3);
  assert.deepEqual(fifty.map(x => x.count), [20, 20, 10]);
  assert.equal(fifty[2].seconds, Math.round((10 / 20) * 18 * 60), 'trailing section gets proportional time');
}

// ---- degenerate inputs never produce a broken clock ----
{
  assert.deepEqual(buildSections(0), []);
  assert.deepEqual(buildSections(-5), []);
  assert.deepEqual(buildSections(NaN), []);
  const tiny = buildSections(1);
  assert.equal(tiny.length, 1);
  assert.ok(tiny[0].seconds >= 60, 'no section shorter than one minute');
}

// ---- sectionForIndex boundaries (end is exclusive) ----
{
  const s = buildSections(100);
  assert.equal(sectionForIndex(s, 0), 0);
  assert.equal(sectionForIndex(s, 19), 0);
  assert.equal(sectionForIndex(s, 20), 1);
  assert.equal(sectionForIndex(s, 99), 4);
  assert.equal(sectionForIndex(s, 100), -1);
  assert.equal(sectionForIndex(s, -1), -1);
  assert.equal(sectionForIndex(null, 3), -1);
}

// ---- stress phases: calm above 90s, tense at/below 90s, critical at/below 30s ----
{
  assert.equal(stressPhase(91), 'calm');
  assert.equal(stressPhase(STRESS_WINDOW_SEC), 'tense');
  assert.equal(stressPhase(31), 'tense');
  assert.equal(stressPhase(CRITICAL_WINDOW_SEC), 'critical');
  assert.equal(stressPhase(0), 'critical');
}

// ---- labels are human ordinals, no em dashes ----
{
  const s = buildSections(100);
  const label = sectionLabel(s[1], s);
  assert.equal(label, 'Section 2 of 5 · Q21 to 40');
  assert.ok(!label.includes('—'));
  assert.equal(sectionLabel(null, s), '');
}

console.log('section-lock.test.js: all passed');
