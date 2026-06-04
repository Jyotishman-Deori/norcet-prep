// =====================================================================
// src/lib/format.js — small pure formatters (A1 slice 27)
// Extracted VERBATIM from App.jsx. fmtWhen(ts): relative "time ago" string
// (just now / Nm / Nh / Nd ago, else a localized date). Used by MyReports and
// AdminPanel (user "active/joined", announcement "posted").
// =====================================================================

export function fmtWhen(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
