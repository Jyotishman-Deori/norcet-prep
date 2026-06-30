// =====================================================================
// src/lib/staging-review.js — pure helpers for the admin Content Review
// folder / bulk-approve flow. No React, no I/O, no theme — just shaping
// `questions_staging` rows for the UI and building a bank object from an
// approved batch. Admin-app only (imported by content-review.jsx).
//
//   groupStagingByTopic(rows)  -> [{ topic, rows }]  (first-seen order)
//   difficultySpread(rows)     -> { easy, medium, hard, other }
//   buildAiBank({ ... })       -> a brand-new bank object (BankEditor shape)
// =====================================================================
import { newBankId } from './banks.js';

// Group staging rows into topic "folders", preserving the order each topic is
// first seen. Rows with no topic fall under 'misc' (mirrors the approve target
// `bank:ai-${row.topic || 'misc'}` in content-review.jsx).
export function groupStagingByTopic(rows) {
  const order = [];
  const byTopic = new Map();
  for (const r of (rows || [])) {
    const topic = (r && r.topic) ? r.topic : 'misc';
    if (!byTopic.has(topic)) { byTopic.set(topic, []); order.push(topic); }
    byTopic.get(topic).push(r);
  }
  return order.map(topic => ({ topic, rows: byTopic.get(topic) }));
}

// Count drafts by difficulty for the folder summary pills. Anything that isn't
// easy/medium/hard (incl. missing) lands in `other`.
export function difficultySpread(rows) {
  const out = { easy: 0, medium: 0, hard: 0, other: 0 };
  for (const r of (rows || [])) {
    const d = r && r.difficulty;
    if (d === 'easy' || d === 'medium' || d === 'hard') out[d] += 1;
    else out.other += 1;
  }
  return out;
}

// Build a brand-new bank object from an approved batch of questions. Mirrors
// the new-bank shape produced by BankEditor.handleSave (src/screens/
// bank-screens.jsx) so an AI-approved set is indistinguishable from a
// hand-uploaded one downstream (Library, import, "What's new" discovery).
// Public banks stamp `publishedAt`; private banks deliberately omit it.
export function buildAiBank({ name, description, visibility, questions, profile }) {
  const now = Date.now();
  const vis = visibility === 'private' ? 'private' : 'public';
  return {
    id: newBankId(),
    name: (name || '').trim(),
    description: (description || '').trim(),
    questions: questions || [],
    version: 1,
    visibility: vis,
    ...(vis !== 'private' ? { publishedAt: now } : {}),
    ownerId: profile ? profile.id : null,
    ownerName: profile ? profile.displayName : null,
    createdAt: now,
    updatedAt: now,
  };
}
