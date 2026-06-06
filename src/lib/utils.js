// =====================================================================
// src/lib/utils.js  — pure, dependency-free helpers (Pipeline step 34 / A1).
// Extracted VERBATIM from App.jsx (no hand-edits to logic). Each function is
// self-contained: it reads no module-level mutable state (no T / IS_DARK /
// CURRENT_PROFILE), no app data, and no React. stemSimilarity uses
// normalizeStem, which is co-located here. Behaviour is unchanged.
// =====================================================================

export const todayStr = () => new Date().toISOString().slice(0, 10);

export function spacedRepetitionNext(lastResult, reviewCount) {
  if (!lastResult || lastResult === 'wrong') return 1;            // 1 day
  const intervals = [1, 3, 7, 14, 30, 60];
  return intervals[Math.min(reviewCount, intervals.length - 1)];
}

export function arraysEqualUnordered(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

export function downloadAsFile(text, filename, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function normalizeStem(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^\s*(q\s*\.?\s*\d+[\.\):]?|\d+[\.\):])\s*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stemSimilarity(a, b) {
  const aN = normalizeStem(a);
  const bN = normalizeStem(b);
  if (!aN || !bN) return 0;
  if (aN === bN) return 1;
  const aw = new Set(aN.split(' ').filter(Boolean));
  const bw = new Set(bN.split(' ').filter(Boolean));
  if (aw.size === 0 || bw.size === 0) return 0;
  let inter = 0;
  for (const w of aw) if (bw.has(w)) inter++;
  const union = aw.size + bw.size - inter;
  return union === 0 ? 0 : inter / union;
}

export const DUPLICATE_THRESHOLD = 0.75;  // 75% word-overlap → flag

// Returns { match, similarity } if a likely duplicate is found in pool, else null.
// [A1 step 34 follow-up] moved here from App.jsx alongside its dep stemSimilarity.
export function findDuplicateStem(newQ, pool) {
  let bestMatch = null;
  let bestScore = 0;
  for (const ex of pool) {
    const s = stemSimilarity(newQ.q, ex.q);
    if (s > bestScore) { bestScore = s; bestMatch = ex; }
  }
  if (bestMatch && bestScore >= DUPLICATE_THRESHOLD) {
    return { match: bestMatch, similarity: bestScore };
  }
  return null;
}

export function relativeTimeShort(ts, now) {
  if (!ts || typeof ts !== 'number') return '';
  const n = now || Date.now();
  const diff = Math.max(0, n - ts);
  const min = 60000, hr = 3600000, day = 86400000;
  if (diff < min) return 'just now';
  if (diff < hr) return Math.floor(diff / min) + 'm ago';
  if (diff < day) return Math.floor(diff / hr) + 'h ago';
  if (diff < 7 * day) return Math.floor(diff / day) + 'd ago';
  try { return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (e) { return ''; }
}

export function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Session 1/2 — ISO-8601 week string, e.g. "2026-W23". Single source of truth
// shared by the Weekly Summary card (Home) and its dismiss key (App). Pure.
export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil((((d - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
}
