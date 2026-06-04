// =====================================================================
// PYQ HELPERS  (Pipeline step 37 / A1 session 3 — extracted from App.jsx)
// Pure provenance helpers for "previous year question" tagging. No theme,
// no React, no storage — safe to import anywhere (used by ui/primitives.jsx
// PyqBadge and by the quiz/setup screens).
// =====================================================================
const isPYQ = (q) => !!q && (q.isPYQ === true ||
  (typeof q.source === 'string' && /pyq/i.test(q.source)));

// P16 — build the provenance label without ever printing "undefined".
//   • structured field present → "NORCET {pyqYear} PYQ" (+ " · {pyqExam}")
//   • else a 4-digit year inside `source` → "NORCET {year} PYQ"
//   • else fall back to the exam family the source names (AIIMS vs NORCET)
function pyqLabel(q) {
  if (!q) return 'PYQ';
  let base;
  if (typeof q.pyqYear === 'number' && q.pyqYear > 0) {
    base = `NORCET ${q.pyqYear} PYQ`;
  } else {
    const src = typeof q.source === 'string' ? q.source : '';
    const yr = (src.match(/\b(?:19|20)\d{2}\b/) || [])[0];
    if (yr) base = `NORCET ${yr} PYQ`;
    else if (/aiims/i.test(src)) base = 'AIIMS PYQ';
    else base = 'NORCET PYQ';
  }
  if (typeof q.pyqExam === 'string' && q.pyqExam.trim()) base += ` · ${q.pyqExam.trim()}`;
  return base;
}

export { isPYQ, pyqLabel };
