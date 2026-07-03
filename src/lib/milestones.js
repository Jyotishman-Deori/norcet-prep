// =====================================================================
// src/lib/milestones.js — MILESTONE EVENT LOG + ACTIVITY FEED (pure).
// The blob previously stored only CURRENT state (xp, streakCurrent,
// mastery derived on the fly) — no memory of WHEN anything was achieved.
// `data.milestones` is a small append-only event list (synced with the
// blob, explicitly wired through merge.js) recording the moments worth
// celebrating: level-ups, mastery tier upgrades, streak milestones.
//
// There is deliberately NO search over this data (blueprint M3): it is
// consumed only as a chronological "Activity history" feed, assembled by
// buildActivityFeed() from the milestone log PLUS the event-like
// structures the blob already had (advancedTestHistory, previousPapers
// attempts, revisionLog) — tests/revisions need no new events.
//
// Entry: { id, type: 'level-up'|'mastery'|'streak', ts, label, meta }
// `id` is the dedupe key (a level or a mastery tier is achieved once;
// a streak milestone can legitimately recur after a reset, so its id
// carries the date).
// =====================================================================

export const MILESTONE_CAP = 200;
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];

// ---- event builders (id encodes the dedupe rule) ----
export function levelUpMilestone(toLevel) {
  return { type: 'level-up', id: `level-up:${toLevel}`, label: `Reached Level ${toLevel}`, meta: { toLevel } };
}
export function masteryMilestone(nodeId, state, name) {
  return { type: 'mastery', id: `mastery:${nodeId}:${state}`, label: `${name || nodeId} — ${state}`, meta: { nodeId, state } };
}
export function streakMilestone(days, dateStr) {
  return { type: 'streak', id: `streak:${days}:${dateStr}`, label: `${days}-day streak`, meta: { days } };
}

// Append an event (immutable). No-op when the id already exists or the
// event is malformed. Caps by dropping the OLDEST entries.
export function recordMilestone(list, evt, now = Date.now()) {
  const arr = Array.isArray(list) ? list : [];
  if (!evt || !evt.id || !evt.type) return arr;
  if (arr.some(m => m && m.id === evt.id)) return arr;
  const next = [...arr, { id: evt.id, type: evt.type, ts: now, label: evt.label || evt.id, meta: evt.meta || {} }];
  next.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return next.length > MILESTONE_CAP ? next.slice(next.length - MILESTONE_CAP) : next;
}

// Which streak milestones does a jump from `prevStreak` to `newStreak`
// newly cross? (Usually zero or one, but grace-day math can skip.)
export function crossedStreakMilestones(prevStreak, newStreak) {
  const p = typeof prevStreak === 'number' ? prevStreak : 0;
  const n = typeof newStreak === 'number' ? newStreak : 0;
  if (n <= p) return [];
  return STREAK_MILESTONES.filter(d => p < d && n >= d);
}

// ---------------------------------------------------------------------
// buildActivityFeed — merged, newest-first chronological items:
//   { id, ts, kind, title, sub }
// kind ∈ 'level-up' | 'mastery' | 'streak' | 'advanced-test' | 'paper' | 'revision'
// ---------------------------------------------------------------------
export function buildActivityFeed({ milestones, advancedTestHistory, previousPapers, revisionLog } = {}, { limit = 0 } = {}) {
  const items = [];

  for (const m of (Array.isArray(milestones) ? milestones : [])) {
    if (!m || !m.ts) continue;
    items.push({ id: `ms:${m.id}`, ts: m.ts, kind: m.type, title: m.label || m.id, sub: '' });
  }

  (Array.isArray(advancedTestHistory) ? advancedTestHistory : []).forEach((t, i) => {
    if (!t || !t.ts) return;
    items.push({
      id: `adv:${t.ts}:${i}`, ts: t.ts, kind: 'advanced-test',
      title: 'Advanced test completed',
      sub: `${t.correct || 0}/${t.count || 0} correct · net ${t.netScore != null ? t.netScore : '—'}`,
    });
  });

  const papers = (previousPapers && typeof previousPapers === 'object' && !Array.isArray(previousPapers)) ? previousPapers : {};
  for (const pid of Object.keys(papers)) {
    const atts = papers[pid] && Array.isArray(papers[pid].attempts) ? papers[pid].attempts : [];
    atts.forEach((t, i) => {
      if (!t || !t.ts) return;
      items.push({
        id: `pyq:${pid}:${t.ts}:${i}`, ts: t.ts, kind: 'paper',
        title: 'Previous year paper attempt',
        sub: `${t.correct || 0}/${t.count || 0} correct · net ${t.netScore != null ? t.netScore : '—'}`,
      });
    });
  }

  for (const r of (Array.isArray(revisionLog) ? revisionLog : [])) {
    if (!r || !r.ts) continue;
    const n = Array.isArray(r.ids) ? r.ids.length : 0;
    items.push({
      id: `rev:${r.date || r.ts}`, ts: r.ts, kind: 'revision',
      title: 'Revision session',
      sub: n ? `${n} question${n === 1 ? '' : 's'} revisited` : '',
    });
  }

  items.sort((a, b) => b.ts - a.ts);
  return limit > 0 ? items.slice(0, limit) : items;
}
