// =====================================================================
// src/lib/weightage.js — shared exam-weightage distribution.
//
// The "exam weightage" of a topic = its average share (%) of the NURSING
// portion across all previous-year papers. screens/weightage.jsx computes a
// richer model (accuracy, coverage, year-over-year) for its analytics screen;
// this is the slim, reusable CORE so the smart Quick Test selector (#20) can
// mirror the real exam's topic mix without duplicating that logic ad-hoc.
//
// Pure — no React, no storage, no theme. Safe to import anywhere.
// =====================================================================
import { countsInNursingStats } from '../data/seed.js';

// Returns { [topicId]: percent } — the mean topic % across papers (a topic
// absent from a given paper counts as 0% for that paper). Empty object if
// there are no usable papers.
export function examTopicWeightage(papers, includeGk = false) {
  const loaded = (papers || []).filter(p => p && Array.isArray(p.questions) && p.questions.length > 0);
  const paperMix = [];
  loaded.forEach(p => {
    const nursing = p.questions.filter(q => q && countsInNursingStats(q.topic, includeGk));
    const tot = nursing.length;
    if (tot === 0) return;
    const counts = {};
    nursing.forEach(q => { counts[q.topic] = (counts[q.topic] || 0) + 1; });
    const pct = {};
    Object.keys(counts).forEach(t => { pct[t] = (counts[t] / tot) * 100; });
    paperMix.push(pct);
  });
  const topicSet = new Set();
  paperMix.forEach(m => Object.keys(m).forEach(t => topicSet.add(t)));
  const typical = {};
  topicSet.forEach(t => {
    const sum = paperMix.reduce((acc, m) => acc + (m[t] || 0), 0);
    typical[t] = paperMix.length ? sum / paperMix.length : 0;
  });
  return typical;
}
