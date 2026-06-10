// =====================================================================
// src/lib/leaderboard.js — leaderboard storage cluster (A1 slice 16)
// Extracted VERBATIM from App.jsx. One shared kv key per user
// (leaderboard:{profileId}); v9 data blob untouched. Deps: safeStorage,
// todayStr. EXPORTS: saveLeaderboardEntry (App upsert), loadLeaderboard
// (board screen). LEADERBOARD_PREFIX/leaderboardKey/weekStartStr/
// computeLeaderboardEntry stay module-internal.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { todayStr } from './utils.js';
import { attemptStats } from './compact.js';
import { masteryTally } from './kmap.js';
import { countsInNursingStats } from '../data/seed.js';

const LEADERBOARD_PREFIX = 'leaderboard:';
const leaderboardKey = (pid) => LEADERBOARD_PREFIX + pid;

// Most recent Monday as a UTC YYYY-MM-DD, matching how dailyHistory dates are
// stored (new Date().toISOString().slice(0,10)). weeklyAnswered counts from
// here, so it auto-resets every Monday — no stored counter, no reset job.
function weekStartStr(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const back = (d.getUTCDay() + 6) % 7; // days since Monday (0=Sun..6=Sat)
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

function computeLeaderboardEntry(profile, data, allQuestions) {
  const s = (data && data.stats) || {};
  const daily = Array.isArray(s.dailyHistory) ? s.dailyHistory : [];
  const wk = weekStartStr();
  const weeklyAnswered = daily.reduce((sum, d) => (d && d.date >= wk ? sum + (d.attempted || 0) : sum), 0);
  // Knowledge-Map mastery (mastered sub-topics) — same math the map uses, so a
  // user's board rank matches their constellation. GK/Aptitude follow the
  // user's stats preference. Falls back to 0 when the question pool isn't given.
  let masteredTopics = 0;
  try {
    if (allQuestions && allQuestions.length) {
      const includeGk = !!(data && data.preferences && data.preferences.includeGkInStats === true);
      masteredTopics = masteryTally(data && data.history, allQuestions, attemptStats,
        (t) => countsInNursingStats(t, includeGk)).mastered;
    }
  } catch (e) { masteredTopics = 0; }
  return {
    id: profile.id,
    displayName: profile.displayName || profile.id,
    totalAnswered: s.totalAttempted || 0,
    totalCorrect: s.totalCorrect || 0,
    currentStreak: s.streakCurrent || 0,
    weeklyAnswered,
    masteredTopics,
    lastActiveDate: s.lastStudiedDate || todayStr(),
    ts: Date.now()
  };
}

// Fire-and-forget upsert of this user's row. Fails quietly when offline.
export async function saveLeaderboardEntry(profile, data, allQuestions) {
  if (!profile || !profile.id) return;
  const entry = computeLeaderboardEntry(profile, data, allQuestions);
  if ((entry.totalAnswered || 0) <= 0) return; // don't board a user with no activity
  try { await safeStorage.set(leaderboardKey(profile.id), JSON.stringify(entry), true); } catch (e) {}
}

// Fetch the whole board. Returns an array of entries (possibly empty).
export async function loadLeaderboard() {
  let keys = [];
  try { const r = await safeStorage.list(LEADERBOARD_PREFIX, true); keys = (r && r.keys) ? r.keys : []; }
  catch (e) { return []; }
  const items = await Promise.all(keys.map(async k => {
    try { const r = await safeStorage.get(k, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {}
    return null;
  }));
  return items.filter(Boolean);
}
