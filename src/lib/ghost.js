// =====================================================================
// src/lib/ghost.js — PHIL-04 "The Ghost Shift"
// Philosophical root: Oubaitori — bloom in your own time, never compare to
// others. The only opponent is the version of you from ~2 weeks ago.
//
// Pure math over the app's existing data.advancedTestHistory (the scored mock
// log). No Supabase query, no new table — adapts the spec to the client-blob
// model. The most-recent entry is "you, now"; the ghost is a PAST self, ideally
// ~14 days back (±3-day grace), else the prior session closest to 14 days.
//
// Metrics are PER-QUESTION normalised so tests of different lengths compare
// fairly. Tone is always Oubaitori — a dip is reframed as the climb, never a
// verdict. Section-level deltas aren't possible (history stores totals only),
// so we compare net score, accuracy, negative penalty and pace.
// =====================================================================

const DAY = 86400000;

const perQ = (v, n) => (n > 0 ? v / n : 0);

function buildMetrics(cur, gho) {
  const curPace = cur.elapsedSec ? cur.elapsedSec / cur.count : null;
  const ghoPace = gho.elapsedSec ? gho.elapsedSec / gho.count : null;
  const metrics = {
    net: {
      label: 'Net / question', betterWhenHigher: true,
      cur: perQ(cur.netScore, cur.count), gho: perQ(gho.netScore, gho.count),
      fmt: (v) => v.toFixed(2),
    },
    accuracy: {
      label: 'Accuracy', betterWhenHigher: true,
      cur: cur.accuracy, gho: gho.accuracy,
      fmt: (v) => `${Math.round(v)}%`,
    },
    penalty: {
      label: 'Lost to negatives / 100Q', betterWhenHigher: false,
      cur: perQ(cur.wrong / 3, cur.count) * 100, gho: perQ(gho.wrong / 3, gho.count) * 100,
      fmt: (v) => `−${v.toFixed(1)}`,
    },
  };
  if (curPace != null && ghoPace != null) {
    metrics.pace = {
      label: 'Pace / question', betterWhenHigher: false,
      cur: curPace, gho: ghoPace, fmt: (v) => `${Math.round(v)}s`,
    };
  }
  // delta + "better?" on each
  Object.values(metrics).forEach((m) => {
    m.delta = m.cur - m.gho;
    m.better = m.betterWhenHigher ? m.delta > 0 : m.delta < 0;
    m.same = Math.abs(m.delta) < 1e-9;
  });
  return metrics;
}

function buildVerdict(m, gapDays) {
  const netDelta = m.net.delta;       // marks per question
  const accDelta = m.accuracy.delta;  // percentage points
  const improved = netDelta >= 0.03 || accDelta >= 2;
  const dipped = !improved && (netDelta <= -0.03 || accDelta <= -2);

  // A short, specific highlight of the biggest win (for the "up" headline).
  let highlight = '';
  if (improved) {
    const wins = [];
    if (accDelta >= 1) wins.push({ s: `accuracy up ${Math.round(accDelta)} point${Math.round(accDelta) === 1 ? '' : 's'}`, w: accDelta });
    if (m.penalty.delta <= -0.5) wins.push({ s: `${Math.abs(m.penalty.delta).toFixed(1)} fewer marks bled to negatives per 100Q`, w: Math.abs(m.penalty.delta) });
    if (m.pace && m.pace.delta <= -2) wins.push({ s: `~${Math.round(Math.abs(m.pace.delta))}s quicker per question`, w: Math.abs(m.pace.delta) });
    if (netDelta >= 0.03) wins.push({ s: `${(netDelta).toFixed(2)} more net marks per question`, w: netDelta * 20 });
    wins.sort((a, b) => b.w - a.w);
    highlight = wins.length ? wins[0].s : 'sharper across the board';
  }

  if (improved) {
    return { kind: 'up', title: 'You’re levelling up',
      line: `Against your Ghost from ${gapDays} days ago — ${highlight}. Keep blooming at your own pace.` };
  }
  if (dipped) {
    return { kind: 'down', title: 'The climb continues',
      line: `A step under your Ghost from ${gapDays} days ago. Every topper has off days — this is data, not a verdict.` };
  }
  return { kind: 'steady', title: 'Holding your ground',
    line: `Neck-and-neck with your Ghost from ${gapDays} days ago. Steady is its own kind of progress.` };
}

// history: data.advancedTestHistory (array). Returns:
//   null                                  — no usable data
//   { firstGhost: true }                  — only this test exists yet
//   { firstGhost:false, current, ghost, gapDays, ideal, metrics, verdict }
export function buildGhostShift(history) {
  const list = (Array.isArray(history) ? history : [])
    .filter((e) => e && typeof e.ts === 'number' && e.count > 0)
    .sort((a, b) => a.ts - b.ts);
  if (list.length === 0) return null;

  const current = list[list.length - 1];
  const priors = list.slice(0, -1).filter((e) => e.ts < current.ts);
  if (priors.length === 0) return { firstGhost: true };

  // Prefer a ghost ~14 days back within the ±3-day grace window; otherwise the
  // prior session whose age is closest to 14 days.
  const target = current.ts - 14 * DAY;
  const inWindow = priors.filter((e) => {
    const age = (current.ts - e.ts) / DAY;
    return age >= 11 && age <= 17;
  });
  const pool = inWindow.length ? inWindow : priors;
  let ghost = pool[0];
  let best = Math.abs(ghost.ts - target);
  for (const e of pool) {
    const d = Math.abs(e.ts - target);
    if (d < best) { best = d; ghost = e; }
  }
  const gapDays = Math.max(1, Math.round((current.ts - ghost.ts) / DAY));
  const metrics = buildMetrics(current, ghost);
  const verdict = buildVerdict(metrics, gapDays);
  return { firstGhost: false, current, ghost, gapDays, ideal: inWindow.length > 0, metrics, verdict };
}
