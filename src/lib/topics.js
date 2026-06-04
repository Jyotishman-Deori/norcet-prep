// =====================================================================
// src/lib/topics.js — topic metadata + weak-topic ranking
//   (extracted from App.jsx). topicName/topicColor/topicIcon look up TOPICS;
//   getWeakTopics ranks attempted topics weakest-first (via attemptStats so
//   compacted records contribute their pre-compaction totals).
//   Two lines differ from the old App.jsx — see [REBUILD] comments below.
// =====================================================================
import { TOPICS, countsInNursingStats } from '../data/seed.js';
import { attemptStats } from './compact.js';

function topicName(id) {
  const t = TOPICS.find(x => x.id === id);
  if (t) return t.name;
  // custom topics
  return id;
}

function topicColor(id) {
  const t = TOPICS.find(x => x.id === id);
  return t ? t.color : '#94a3b8'; // [REBUILD] orig used T.muted (theme); lib is theme-free — neutral gray fallback (only hit for unknown/custom topics)
}

function topicIcon(id) {
  const t = TOPICS.find(x => x.id === id);
  return t ? t.icon : '📚';
}

function getWeakTopics(history, allQuestions, includeGk = false) {
  const byTopic = {};
  Object.entries(history).forEach(([qId, h]) => {
    const q = allQuestions.find(x => x.id === qId);
    if (!q || !h) return;
    if (!countsInNursingStats(q.topic, includeGk)) return; // [REBUILD] honor includeGkInStats (added 3rd arg, see seed.js)
    // P15 — route through attemptStats so compacted records contribute
    // their PRE-COMPACTION totals, not just the 5-attempt tail.
    const s = attemptStats(h);
    if (s.total === 0) return;
    if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 };
    byTopic[q.topic].total += s.total;
    byTopic[q.topic].correct += s.correct;
  });
  return Object.entries(byTopic)
    .map(([topic, { correct, total }]) => ({ topic, accuracy: total > 0 ? correct / total : 0, total }))
    .filter(x => x.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy);
}

export { topicName, topicColor, topicIcon, getWeakTopics };
