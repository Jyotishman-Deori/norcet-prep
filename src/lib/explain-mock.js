// =====================================================================
// src/lib/explain-mock.js — the "Explain my mistake" COACH (mock engine).
// Blueprint M6 asks for an AI explanation service; this app has a HARD
// no-runtime-AI rule (CLAUDE.md), so this is the sanctioned adaptation:
// a fully local, rule-based composer that assembles a conversational
// tutoring note from the question's REAL authored content — `exp` (why
// the answer is right) and `wrong[idx]` (why the user's specific pick is
// wrong, which quiz authors already write per option). Zero network,
// zero keys, works offline. `explainMistake` adds a short simulated
// "thinking" delay so the UI's loading experience is real; if a live
// model provider is ever approved, only that function's body changes.
//
// Output is PLAIN TEXT (CAPS labels + blank lines) per the house
// explanation format — never markdown.
// =====================================================================

export const EXPLAIN_DELAY_MS = 1200;
export const EXPLAIN_DISCLOSURE =
  'Coach notes are assembled from this app’s authored explanations, no AI, works offline.';

// composeExplanation({ question, pick }) → plain-text tutoring note.
// `pick` = the option indices the user chose on their last wrong attempt
// (may be [] for timeouts/reveals/legacy history — degrades gracefully).
export function composeExplanation({ question, pick } = {}) {
  const q = question || {};
  const options = Array.isArray(q.options) ? q.options : [];
  const correct = Array.isArray(q.correct) ? q.correct : [];
  const picked = Array.isArray(pick) ? pick.filter(i => typeof i === 'number') : [];

  const correctText = correct.map(i => options[i]).filter(Boolean).join(' + ') || 'the marked answer';
  const wrongPicked = picked.filter(i => !correct.includes(i));
  const firstWrong = wrongPicked.length > 0 ? wrongPicked[0] : null;

  const parts = [];
  if (firstWrong != null && options[firstWrong] != null) {
    parts.push(`Let's review this one! You answered "${options[firstWrong]}", but the correct answer is "${correctText}".`);
    const why = q.wrong && q.wrong[firstWrong];
    if (why) parts.push(`WHY YOUR PICK IS WRONG\n${why}`);
  } else if (picked.length === 0) {
    parts.push(`Let's review this one! You didn't lock in an answer last time. The correct answer is "${correctText}".`);
  } else {
    // Picked something, but all picked options were correct (partial MSQ miss)
    // or the pick can't be resolved — keep it encouraging and factual.
    parts.push(`Let's review this one! The correct answer is "${correctText}".`);
  }

  if (q.exp) parts.push(`WHY IT'S RIGHT\n${q.exp}`);

  parts.push('Answer it correctly twice in a row in a review round and it moves to your Fixed list.');
  return parts.join('\n\n');
}

// explainMistake(args, opts) → Promise<{ text }>. Simulated processing delay
// only — NO external call. Pass { delayMs: 0 } in tests.
export async function explainMistake(args, { delayMs = EXPLAIN_DELAY_MS } = {}) {
  const text = composeExplanation(args);
  const wait = Math.max(0, Number(delayMs) || 0);
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  return { text };
}
