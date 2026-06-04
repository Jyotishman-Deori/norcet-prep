// =====================================================================
// SELECTORS  (Pipeline step 38 / A1 session 4 — batch 1b slice 8 —
// extracted from App.jsx)
// Pure derived-state selectors over the question history. No deps.
// =====================================================================

function getDueQuestions(history, allQuestions) {
  const today = new Date();
  return allQuestions.filter(q => {
    const h = history[q.id];
    if (!h || !h.nextDue) return false;
    return new Date(h.nextDue) <= today;
  });
}

export { getDueQuestions };
