// =====================================================================
// src/lib/leaderboard.js — leaderboard storage cluster (A1 slice 16)
// Extracted VERBATIM from App.jsx. One shared kv key per user
// (leaderboard:{profileId}); v9 data blob untouched. Deps: safeStorage,
// todayStr. EXPORTS: saveLeaderboardEntry (App upsert), loadLeaderboard
// (board screen). LEADERBOARD_PREFIX/leaderboardKey/weekStartStr/
// computeLeaderboardEntry stay module-internal.
// =====================================================================
import { safeStorage } from './safe-storage.js';
import { todayStr, weekStartStr } from './utils.js';
import { attemptStats } from './compact.js';
import { masteryTally } from './kmap.js';
import { countsInNursingStats } from '../data/seed.js';
import { weeklyGrowth, firstAttemptTotals } from './leaderboard-score.js';
import { normalizeLevelup, progress } from './levelup.js';
import { getConfig } from './game-config.js';
import { isInternalAccount, normalizeInternalIds } from './internal-accounts.js';

const LEADERBOARD_PREFIX = 'leaderboard:';
const leaderboardKey = (pid) => LEADERBOARD_PREFIX + pid;

function computeLeaderboardEntry(profile, data, allQuestions) {
  const s = (data && data.stats) || {};
  const daily = Array.isArray(s.dailyHistory) ? s.dailyHistory : [];
  // Study "Growth" — effort + accuracy + improvement vs the user's own recent
  // baseline, weekly (lib/leaderboard-score.js). Auto-resets every UTC-Monday.
  const growth = weeklyGrowth(daily);
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
  // Games — weekly capped XP + all-time level. weekXp only counts when it
  // belongs to the CURRENT week (normalizeLevelup doesn't auto-roll the window).
  const lu = normalizeLevelup(data && data.levelup);
  const weekXp = lu.weekStart === weekStartStr() ? (lu.weekXp || 0) : 0;
  // Leaderboard integrity (2026-07-10): the Accuracy board ranks on FIRST
  // attempts only, so re-answering questions with known answers can't buy
  // rank. Computed from history (pure fn, tainted/compacted excluded).
  let first = { attempted: 0, correct: 0 };
  try { first = firstAttemptTotals(data && data.history); } catch (e) {}
  return {
    id: profile.id,
    displayName: profile.displayName || profile.id,
    totalAnswered: s.totalAttempted || 0,
    totalCorrect: s.totalCorrect || 0,
    firstAttempted: first.attempted,
    firstCorrect: first.correct,
    currentStreak: s.streakCurrent || 0,
    weeklyAnswered: growth.weeklyAnswered,
    weeklyCorrect: growth.weeklyCorrect,
    weeklyAccuracy: growth.weeklyAccuracy,
    growthScore: growth.growthScore,
    masteredTopics,
    // Flashpoint — lifetime 2× points; ranks the Flashpoint board.
    flashpointPoints: s.flashpointPoints || 0,
    // Gamified board fields.
    xp: lu.xp,
    level: progress(lu.xp).level,
    weekXp,
    // Cohort-ready seam: one global cohort now; a future assigner can stamp
    // leagues once weekly-actives grow, and the board filters by cohort.
    cohort: 'global',
    lastActiveDate: s.lastStudiedDate || todayStr(),
    ts: Date.now()
  };
}

// Fire-and-forget upsert of this user's row. Fails quietly when offline.
export async function saveLeaderboardEntry(profile, data, allQuestions) {
  if (!profile || !profile.id) return;
  // Internal (test/staff) accounts never publish a row. The kv-write broker
  // enforces the same rule server-side; this just saves the request.
  if (isInternalAccount(getConfig(), profile)) return;
  const entry = computeLeaderboardEntry(profile, data, allQuestions);
  // Board a user with study OR game activity (so games-only players still appear
  // on the Games board).
  if ((entry.totalAnswered || 0) <= 0 && (entry.xp || 0) <= 0) return;
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
  // Hide internal (test/staff) accounts even if an old row still exists on the
  // server: flagging an account takes effect on the next board load, before
  // any manual row cleanup.
  const internal = normalizeInternalIds(getConfig().internalIds);
  return items.filter(e => e && !(e.id && internal.includes(String(e.id).toLowerCase())));
}
