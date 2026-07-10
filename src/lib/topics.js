// =====================================================================
// src/lib/topics.js — topic metadata + weak-topic ranking
//   (extracted from App.jsx). topicName/topicColor/topicIcon look up TOPICS;
//   getWeakTopics ranks attempted topics weakest-first (via attemptStats so
//   compacted records contribute their pre-compaction totals).
//   Two lines differ from the old App.jsx — see [REBUILD] comments below.
// =====================================================================
import { TOPICS, countsInNursingStats } from '../data/seed.js';
import { attemptStats } from './compact.js';

// ---------------------------------------------------------------------
// Topic id canonicalisation. Uploaded banks carry FREE-TEXT topic ids, so
// a bank drafted with `topic: "aptitude"` silently created a phantom
// topic beside the canonical `apt` ("Reasoning & Aptitude"): duplicate
// rows in the admin Bank-health view, split user stats, and topic
// practice that misses those questions. resolveTopicId collapses known
// aliases AND full display names (case-insensitive) onto canonical ids;
// genuinely custom topics pass through untouched.
// ---------------------------------------------------------------------
const TOPIC_ALIASES = {
  // canonical display names (lowercased) map back to their id
  ...Object.fromEntries(TOPICS.map(t => [t.name.toLowerCase(), t.id])),
  // common shorthand / AI-drafting variants seen or likely in uploads
  'aptitude': 'apt', 'reasoning': 'apt', 'reasoning and aptitude': 'apt',
  'generalknowledge': 'gk',
  'fundamentals': 'fund', 'fundamental of nursing': 'fund', 'fon': 'fund',
  'anatomy': 'anat', 'physiology': 'anat', 'anatomy and physiology': 'anat',
  'medical surgical nursing': 'msn', 'medical-surgical': 'msn', 'med-surg': 'msn', 'medical surgical': 'msn',
  'pharmacology': 'pharm', 'pharma': 'pharm',
  'pediatrics': 'peds', 'paediatrics': 'peds', 'pediatric nursing': 'peds', 'paediatric nursing': 'peds',
  'obstetrics and gynaecology': 'obg', 'obstetrics & gynecology': 'obg', 'obstetrics and gynecology': 'obg',
  'obg nursing': 'obg', 'midwifery': 'obg',
  'community health nursing': 'ch', 'community': 'ch', 'chn': 'ch',
  'mental health': 'mhn', 'psychiatric nursing': 'mhn', 'psychiatry': 'mhn',
  'microbiology': 'micro',
  'nutrition and dietetics': 'nutr', 'dietetics': 'nutr',
};
const CANONICAL_IDS = new Set(TOPICS.map(t => t.id));

function resolveTopicId(raw) {
  if (!raw) return raw;
  const id = String(raw).trim();
  if (CANONICAL_IDS.has(id)) return id;
  const alias = TOPIC_ALIASES[id.toLowerCase().replace(/\s+/g, ' ')];
  return alias || id;
}

function topicName(id) {
  const t = TOPICS.find(x => x.id === resolveTopicId(id));
  if (t) return t.name;
  // custom topics
  return id;
}

function topicColor(id) {
  const t = TOPICS.find(x => x.id === resolveTopicId(id));
  return t ? t.color : '#94a3b8'; // [REBUILD] orig used T.muted (theme); lib is theme-free — neutral gray fallback (only hit for unknown/custom topics)
}

function topicIcon(id) {
  const t = TOPICS.find(x => x.id === resolveTopicId(id));
  return t ? t.icon : '📚';
}

function getWeakTopics(history, allQuestions, includeGk = false) {
  const byTopic = {};
  Object.entries(history).forEach(([qId, h]) => {
    const q = allQuestions.find(x => x.id === qId);
    if (!q || !h) return;
    const topic = resolveTopicId(q.topic); // merge alias topics into their canonical bucket
    if (!countsInNursingStats(topic, includeGk)) return; // [REBUILD] honor includeGkInStats (added 3rd arg, see seed.js)
    // P15 — route through attemptStats so compacted records contribute
    // their PRE-COMPACTION totals, not just the 5-attempt tail.
    const s = attemptStats(h);
    if (s.total === 0) return;
    if (!byTopic[topic]) byTopic[topic] = { correct: 0, total: 0 };
    byTopic[topic].total += s.total;
    byTopic[topic].correct += s.correct;
  });
  return Object.entries(byTopic)
    .map(([topic, { correct, total }]) => ({ topic, accuracy: total > 0 ? correct / total : 0, total }))
    .filter(x => x.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy);
}

export { resolveTopicId, topicName, topicColor, topicIcon, getWeakTopics };
