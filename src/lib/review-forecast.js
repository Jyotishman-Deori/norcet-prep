// =====================================================================
// REVIEW FORECAST  —  pure "what's coming up to revise" math
// =====================================================================
// No React, no storage. Reads the existing SRS field (history[id].nextDue, the
// same one getDueQuestions uses) and buckets questions by the day they fall
// due, so revision reads as a manageable schedule instead of a surprise pile.
//
// Bucket 0 = today (includes anything overdue). Buckets 1..days-1 = the next
// days. Anything past the window counts toward `laterTotal`.
// =====================================================================

const DAY = 86400000;

function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function reviewForecast(history, opts = {}) {
  const days = opts.days ?? 7;
  const now = opts.now ?? Date.now();
  const todayStart = startOfDay(now);

  const buckets = [];
  for (let i = 0; i < days; i++) buckets.push({ offset: i, dayStart: todayStart + i * DAY, count: 0 });

  let overdue = 0;
  let dueToday = 0;
  let weekTotal = 0;
  let laterTotal = 0;
  let scheduled = 0;

  Object.values(history || {}).forEach((h) => {
    if (!h || !h.nextDue) return;
    scheduled += 1;
    const due = startOfDay(new Date(h.nextDue).getTime());
    if (Number.isNaN(due)) return;

    if (due < todayStart) {
      overdue += 1;
      buckets[0].count += 1;
      weekTotal += 1;
      return;
    }
    const offset = Math.round((due - todayStart) / DAY);
    if (offset === 0) dueToday += 1;
    if (offset < days) {
      buckets[offset].count += 1;
      weekTotal += 1;
    } else {
      laterTotal += 1;
    }
  });

  return {
    buckets,
    days,
    scheduled,                       // questions with any schedule at all
    overdue,
    dueToday,
    dueNow: overdue + dueToday,       // what bucket 0 represents
    weekTotal,                        // due within the window (incl. today/overdue)
    laterTotal,
    peak: buckets.reduce((m, b) => Math.max(m, b.count), 0),
  };
}

// Short weekday label for a bucket ('Today', then 'Mon', 'Tue', …).
export function bucketLabel(bucket) {
  if (!bucket) return '';
  if (bucket.offset === 0) return 'Today';
  return new Date(bucket.dayStart).toLocaleDateString(undefined, { weekday: 'short' });
}
