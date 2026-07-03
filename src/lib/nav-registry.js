// =====================================================================
// src/lib/nav-registry.js — the NAVIGATION REGISTRY behind global search.
// The Search tab is first a SHORTCUT ROUTER: type "dark mode" / "mistakes" /
// "pharmacology" and jump straight to the screen, not just to content. This
// module is the single index of every jumpable destination, plus the ranked
// matcher that queries it. Pure and Node-testable (no React, no storage);
// the screen supplies TOPICS and dispatches the returned `route` nav-objects
// through the app's state-machine router (setNav via onNavigate) — there is
// no URL router in this app, so routes ARE nav objects: { screen, ...payload }.
//
// Entry contract (KEEP this shape — the test enforces it):
//   {
//     id:          'unique-string-id',
//     title:       'Display title',
//     category:    'Settings' | 'Features' | 'Units' | 'FAQ',
//     keywords:    ['search', 'synonyms', 'tags'],
//     route:       { screen: 'settings', ... }   // nav object — OR null when
//     action:      'note' | 'feedback',          // an imperative popup opens
//     description: 'One line shown under the result title.',
//   }
// Ranking: exact/prefix TITLE match first, then title words, then KEYWORDS,
// then DESCRIPTION text — capped small so the dropdown stays scannable.
// =====================================================================
import { tokenize } from './search.js';

export const NAV_CATEGORIES = ['Settings', 'Features', 'Units', 'FAQ'];
export const NAV_RESULT_LIMIT = 6; // spec: 5–7 max, keep the list clean

// ---- Static destinations (screens + the two imperative popups) ----
const STATIC_REGISTRY = [
  // — Settings —
  { id: 'settings', title: 'Settings', category: 'Settings',
    keywords: ['settings', 'preferences', 'options', 'account', 'privacy'],
    route: { screen: 'settings' },
    description: 'All app settings in one place.' },
  { id: 'themes', title: 'Themes & dark mode', category: 'Settings',
    keywords: ['dark', 'light', 'night', 'theme', 'color', 'colour', 'appearance'],
    route: { screen: 'themes' },
    description: 'Switch between light, dark and colour themes.' },
  { id: 'account', title: 'Account & profile', category: 'Settings',
    keywords: ['account', 'profile', 'rename', 'sign in', 'login', 'logout', 'guest', 'name'],
    route: { screen: 'settings' },
    description: 'Sign in, rename your profile or manage your account.' },
  { id: 'reminders', title: 'Daily study reminder', category: 'Settings',
    keywords: ['reminder', 'daily', 'notification', 'alarm', 'schedule', 'push'],
    route: { screen: 'settings' },
    description: 'Turn the daily reminder on or off in Settings.' },
  { id: 'backup', title: 'Backup & export', category: 'Settings',
    keywords: ['backup', 'export', 'import', 'restore', 'transfer', 'data'],
    route: { screen: 'settings' },
    description: 'Export your progress or restore it on a new device.' },
  { id: 'notifications', title: 'Notifications inbox', category: 'Settings',
    keywords: ['notifications', 'announcements', 'inbox', 'updates', 'news'],
    route: { screen: 'notifications' },
    description: 'Announcements and updates from the team.' },
  { id: 'share', title: 'Share the app', category: 'Settings',
    keywords: ['share', 'invite', 'friends', 'refer', 'referral', 'link'],
    route: { screen: 'share-app' },
    description: 'Invite friends with your personal share link.' },
  { id: 'premium', title: 'Premium preview', category: 'Settings',
    keywords: ['premium', 'plans', 'subscription', 'upgrade', 'pricing', 'pay'],
    route: { screen: 'premium' },
    description: 'See upcoming plans — everything is free during testing.' },

  // — Features —
  { id: 'quick-test', title: 'Quick Test', category: 'Features',
    keywords: ['quick', 'practice', 'test', 'mcq', 'random', 'start'],
    route: { screen: 'quick-setup' },
    description: 'A fast smart-picked MCQ practice round.' },
  { id: 'topic-test', title: 'Topic-wise practice', category: 'Features',
    keywords: ['topic', 'subject', 'practice', 'chapter', 'wise'],
    route: { screen: 'topic-select' },
    description: 'Practise one subject at a time.' },
  { id: 'mock-test', title: 'Mock Test', category: 'Features',
    keywords: ['mock', 'exam', 'timed', 'full test', 'simulation', 'norcet'],
    route: { screen: 'mock-setup' },
    description: 'A timed, exam-style full test.' },
  { id: 'previous-papers', title: 'Previous year papers', category: 'Features',
    keywords: ['pyq', 'previous', 'papers', 'past', 'year', 'official'],
    route: { screen: 'previous-papers' },
    description: 'Solve real past NORCET papers.' },
  { id: 'drills', title: 'Drill Tests', category: 'Features',
    keywords: ['drill', 'drills', 'rapid', 'speed', 'timed'],
    route: { screen: 'drill-tests' },
    description: 'Short rapid-fire drills.' },
  { id: 'level-up', title: 'Level Up games', category: 'Features',
    keywords: ['games', 'play', 'arcade', 'xp', 'level', 'fun', 'clinical'],
    route: { screen: 'level-up' },
    description: 'Clinical mini-games — earn XP and level up.' },
  { id: 'weak-areas', title: 'Weak Areas — mistakes hub', category: 'Features',
    keywords: ['weak', 'mistakes', 'wrong', 'errors', 'improve', 'retry', 'hub'],
    route: { screen: 'weak-areas' },
    description: 'Re-practise the questions you got wrong.' },
  { id: 'stats', title: 'Your Stats', category: 'Features',
    keywords: ['stats', 'progress', 'accuracy', 'performance', 'analytics', 'streak'],
    route: { screen: 'stats' },
    description: 'Accuracy, streaks and progress by topic.' },
  { id: 'ikigai', title: 'Ikigai Compass', category: 'Features',
    keywords: ['ikigai', 'readiness', 'compass', 'balance', 'purpose'],
    route: { screen: 'ikigai' },
    description: 'Your living 4-circle readiness map.' },
  { id: 'leaderboard', title: 'Leaderboard', category: 'Features',
    keywords: ['leaderboard', 'rank', 'ranking', 'compare', 'weekly', 'top'],
    route: { screen: 'leaderboard' },
    description: 'How your week stacks up against other aspirants.' },
  { id: 'coverage', title: 'Syllabus coverage', category: 'Features',
    keywords: ['coverage', 'syllabus', 'completion', 'map', 'progress'],
    route: { screen: 'coverage' },
    description: 'How much of each subject you have covered.' },
  { id: 'weightage', title: 'Exam weightage', category: 'Features',
    keywords: ['weightage', 'marks', 'distribution', 'important', 'subjects'],
    route: { screen: 'weightage' },
    description: 'How many marks each subject carries.' },
  { id: 'knowledge-map', title: 'Knowledge Map', category: 'Features',
    keywords: ['knowledge', 'map', 'mindmap', 'explore', 'connections'],
    route: { screen: 'knowledge-map' },
    description: 'Explore topics as a visual map.' },
  { id: 'learn', title: 'Learn — concept cards', category: 'Features',
    keywords: ['learn', 'cards', 'concepts', 'theory', 'read', 'study'],
    route: { screen: 'learn-topics' },
    description: 'Concept cards, mnemonics and key points by topic.' },
  { id: 'revision', title: 'Revision digest', category: 'Features',
    keywords: ['revision', 'revise', 'due', 'review', 'crib', 'digest', 'spaced'],
    route: { screen: 'revision-sheet' },
    description: 'Today’s high-yield revision digest and crib sheets.' },
  { id: 'bookmarks', title: 'Bookmarks', category: 'Features',
    keywords: ['bookmarks', 'saved', 'starred', 'marked', 'questions'],
    route: { screen: 'bookmarks-view' },
    description: 'Every question you saved, grouped by topic.' },
  { id: 'favorites', title: 'Favourites grid', category: 'Features',
    keywords: ['favourites', 'favorites', 'shortcuts', 'pinned', 'heart'],
    route: { screen: 'favorites' },
    description: 'Your personalised grid of favourite sections.' },
  { id: 'library', title: 'Question bank Library', category: 'Features',
    keywords: ['library', 'banks', 'question bank', 'import', 'download', 'sets'],
    route: { screen: 'library' },
    description: 'Browse and import curated question banks.' },
  { id: 'doubts', title: 'My Doubts', category: 'Features',
    keywords: ['doubts', 'flagged', 'unclear', 'confusing', 'revisit'],
    route: { screen: 'doubts' },
    description: 'Points you flagged as unclear — resolve them here.' },
  { id: 'study-plan', title: 'Study plan', category: 'Features',
    keywords: ['plan', 'exam date', 'schedule', 'goal', 'countdown', 'days'],
    route: { screen: 'study-plan' },
    description: 'Your day-by-day plan to exam day.' },
  { id: 'reference', title: 'Quick Reference', category: 'Features',
    keywords: ['reference', 'lab values', 'labs', 'drugs', 'vitals', 'abbreviations', 'normal values'],
    route: { screen: 'reference' },
    description: 'Lab values, drug tables and clinical numbers.' },
  { id: 'dosage', title: 'Dosage practice', category: 'Features',
    keywords: ['dosage', 'dose', 'calculation', 'drip', 'math', 'formula'],
    route: { screen: 'dosage' },
    description: 'Timed drug-calculation drills.' },
  { id: 'notes', title: 'Study notes', category: 'Features',
    keywords: ['notes', 'notebook', 'jot', 'write', 'companion'],
    route: null, action: 'note',
    description: 'Open your quick-notes notebook.' },

  // — FAQ / Help —
  { id: 'faq', title: 'FAQ & Help Center', category: 'FAQ',
    keywords: ['faq', 'help', 'questions', 'support', 'answers', 'ask'],
    route: { screen: 'faq' },
    description: 'Common questions answered by the team — ask your own too.' },
  { id: 'study-methods', title: 'Study Methods guidebook', category: 'FAQ',
    keywords: ['guide', 'guidebook', 'methods', 'techniques', 'how to study', 'tips'],
    route: { screen: 'study-methods' },
    description: 'Evidence-based techniques and how to use this app well.' },
  { id: 'send-feedback', title: 'Send feedback', category: 'FAQ',
    keywords: ['feedback', 'bug', 'report', 'suggest', 'idea', 'problem'],
    route: null, action: 'feedback',
    description: 'Report a bug or suggest a feature to the developer.' },
  { id: 'my-reports', title: 'My feedback & replies', category: 'FAQ',
    keywords: ['reports', 'replies', 'my feedback', 'inbox', 'admin reply'],
    route: { screen: 'my-reports' },
    description: 'Your past reports and the admin’s replies.' },
];

// ---------------------------------------------------------------------
// buildNavRegistry(topics) — static destinations + one deep-link per unit
// (topic → its Learn concept-card reader). Topics come in as a parameter
// (the screen passes TOPICS from data/seed.js) so this module stays free of
// data imports and trivially testable.
// ---------------------------------------------------------------------
export function buildNavRegistry(topics) {
  const units = (Array.isArray(topics) ? topics : [])
    .filter(t => t && t.id && t.name)
    .map(t => ({
      id: `unit-${t.id}`,
      title: t.name,
      category: 'Units',
      keywords: [t.id, ...String(t.name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean), 'unit', 'topic', 'chapter'],
      route: { screen: 'learn-cards', topicId: t.id },
      description: `Open the ${t.name} concept cards.`,
      icon: t.icon,
    }));
  return [...STATIC_REGISTRY, ...units];
}

// ---------------------------------------------------------------------
// searchRegistry(registry, query, { limit }) — ranked shortcut matching.
// AND semantics across tokens (each token must hit SOMEWHERE); per-token
// rank: title > keywords > description, with exact/prefix title matches
// boosted above everything so "stats" puts Your Stats first.
// ---------------------------------------------------------------------
export function searchRegistry(registry, query, { limit = NAV_RESULT_LIMIT } = {}) {
  const tokens = tokenize(query);
  if (tokens.length === 0 || !Array.isArray(registry)) return [];
  const qNorm = tokens.join(' ');

  const scored = [];
  for (const entry of registry) {
    if (!entry || !entry.title) continue;
    const title = entry.title.toLowerCase();
    const kws = (entry.keywords || []).map(k => String(k).toLowerCase());
    const desc = String(entry.description || '').toLowerCase();

    let score = 0;
    if (title === qNorm) score += 100;                 // exact title
    else if (title.startsWith(qNorm)) score += 50;     // title prefix

    let allMatch = true;
    for (const tok of tokens) {
      if (title.includes(tok)) {
        score += (title.startsWith(tok) || title.includes(' ' + tok)) ? 12 : 8;
      } else if (kws.some(k => k === tok)) {
        score += 10;                                   // exact keyword tag
      } else if (kws.some(k => k.includes(tok))) {
        score += 6;                                    // partial keyword
      } else if (desc.includes(tok)) {
        score += 2;                                    // description text
      } else {
        allMatch = false;
        break;
      }
    }
    if (!allMatch || score <= 0) continue;
    scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, limit)).map(s => s.entry);
}
