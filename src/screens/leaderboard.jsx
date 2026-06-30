// =====================================================================
// src/screens/leaderboard.jsx — Leaderboard screen.
// TWO boards via a top toggle:
//   • Study — Growth (weekly effort+accuracy+improvement, anti-elitism, default),
//     Mastery (all-time), Streak, Accuracy, Flashpoint.
//   • Games — This Week (weekly capped XP, anti-grind), Level (all-time tier).
// All ranking math is precomputed per-user in lib/leaderboard.js and stored on
// the user's row; this screen only sorts + renders. Podium / your-standing /
// rows are metric-generic (driven by metricOf), so they're reused across tabs.
// =====================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Trophy, Crown, Flame, Target, CalendarDays, Sparkles, ChevronRight, Zap, TrendingUp, Gamepad2 } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import EmptyState from '../ui/empty-state.jsx';
import StreakFire, { STREAK_FIRE_MIN } from '../ui/streak-fire.jsx';
import FramedAvatar from '../ui/framed-avatar.jsx';
import { normalizeLevelup } from '../lib/levelup.js';
import { loadLeaderboard } from '../lib/leaderboard.js';

const STUDY_TABS = [
  { id: 'growth',     label: 'Growth',     icon: TrendingUp },
  { id: 'mastery',    label: 'Mastery',    icon: Crown },
  { id: 'streak',     label: 'Streak',     icon: Flame },
  { id: 'accuracy',   label: 'Accuracy',   icon: Target },
  { id: 'flashpoint', label: 'Flashpoint', icon: Zap },
];
const GAMES_TABS = [
  { id: 'games-week',  label: 'This Week', icon: CalendarDays },
  { id: 'games-level', label: 'Level',     icon: Gamepad2 },
];
const DEFAULT_TAB = { study: 'growth', games: 'games-week' };

const NOTE = {
  growth:        'Answer some questions this week to join the Growth board.',
  mastery:       'Master your first topic in the Knowledge Map to claim a spot here.',
  streak:        'Start a streak — study today to appear here.',
  accuracy:      'Answer at least 50 questions to qualify for the accuracy board.',
  flashpoint:    'Play a test in Flashpoint pace to score points and rank here.',
  'games-week':  'Play a clinical game this week to rank on weekly XP.',
  'games-level': 'Play Level Up games to earn XP and climb the levels.',
};
const EMPTY = {
  growth:        { title: 'Your name belongs on this board', text: 'Study this week to join the Growth board — it rewards effort and improvement, not just raw totals, and resets every Monday.' },
  mastery:       { title: 'Light up your first constellation', text: 'Master a topic in the Knowledge Map to appear here and compare your progress with other aspirants.' },
  streak:        { title: 'Start your streak', text: 'Study today to start a streak and appear on this board.' },
  accuracy:      { title: 'Earn your accuracy rank', text: 'Answer at least 50 questions to qualify for the accuracy board.' },
  flashpoint:    { title: 'Ignite the Flashpoint board', text: 'Finish a test in Flashpoint pace — half the time, double the points — to claim your spot here.' },
  'games-week':  { title: 'Play to rank this week', text: 'Finish a clinical game in Level Up to score weekly XP. Daily-capped and reset every Monday, so it rewards play — not grinding.' },
  'games-level': { title: 'Climb the levels', text: 'Earn XP in Level Up games to raise your level and tier, and rank on the all-time Level board.' },
};

function LeaderboardScreen({ profileId, isGuest = false, onGuestSignIn, onBack, attemptedCount = 0, onStartQuiz, myMastered = 0 }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const myFrame = normalizeLevelup(data && data.levelup).frame;
  const [board, setBoard] = useState('study'); // 'study' | 'games'
  const [tab, setTab] = useState('growth');
  const [entries, setEntries] = useState(null); // null = loading
  const [offline, setOffline] = useState(false);

  const isGames = board === 'games';
  const subTabs = isGames ? GAMES_TABS : STUDY_TABS;
  const switchBoard = (b) => { setBoard(b); setTab(DEFAULT_TAB[b]); };

  const load = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true); setEntries([]); return;
    }
    setOffline(false); setEntries(null);
    const list = await loadLeaderboard();
    setEntries(list);
  }, []);
  useEffect(() => { load(); }, [load]);

  const ranked = useMemo(() => {
    const list = entries || [];
    const byTotal = (a, b) => (b.totalAnswered || 0) - (a.totalAnswered || 0);
    switch (tab) {
      case 'flashpoint':
        return list.filter(e => (e.flashpointPoints || 0) > 0)
                   .sort((a, b) => (b.flashpointPoints || 0) - (a.flashpointPoints || 0) || byTotal(a, b));
      case 'mastery':
        return list.filter(e => (e.masteredTopics || 0) > 0)
                   .sort((a, b) => (b.masteredTopics || 0) - (a.masteredTopics || 0) || byTotal(a, b));
      case 'streak':
        return list.filter(e => (e.currentStreak || 0) > 0)
                   .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0) || byTotal(a, b));
      case 'accuracy':
        return list.filter(e => (e.totalAnswered || 0) >= 50)
                   .map(e => ({ ...e, acc: e.totalAnswered ? e.totalCorrect / e.totalAnswered : 0 }))
                   .sort((a, b) => b.acc - a.acc || byTotal(a, b));
      case 'games-week':
        return list.filter(e => (e.weekXp || 0) > 0)
                   .sort((a, b) => (b.weekXp || 0) - (a.weekXp || 0) || (b.level || 0) - (a.level || 0));
      case 'games-level':
        return list.filter(e => (e.level || 0) > 1 || (e.xp || 0) > 0)
                   .sort((a, b) => (b.level || 0) - (a.level || 0) || (b.xp || 0) - (a.xp || 0));
      case 'growth':
      default:
        return list.filter(e => (e.growthScore || 0) > 0)
                   .sort((a, b) => (b.growthScore || 0) - (a.growthScore || 0) || (b.weeklyAnswered || 0) - (a.weeklyAnswered || 0));
    }
  }, [entries, tab]);

  const metricOf = (e) => {
    switch (tab) {
      case 'flashpoint':  return `${(e.flashpointPoints || 0).toLocaleString()} pts`;
      case 'mastery':     return `${e.masteredTopics || 0} ★`;
      case 'streak':      return `${e.currentStreak || 0}d`;
      case 'accuracy':    return `${Math.round((e.totalAnswered ? e.totalCorrect / e.totalAnswered : 0) * 100)}%`;
      case 'games-week':  return `${(e.weekXp || 0).toLocaleString()} XP`;
      case 'games-level': return `Lvl ${e.level || 1}`;
      case 'growth':
      default:            return `${(e.growthScore || 0).toLocaleString()}`;
    }
  };

  const contextLine = {
    growth:        <>Ranked by <span style={{ color: T.ink, fontWeight: 600 }}>weekly growth</span> — effort, accuracy, and improvement vs your own recent baseline. Resets every Monday, so it never locks.</>,
    flashpoint:    <>Ranked by lifetime <span style={{ color: T.ink, fontWeight: 600 }}>Flashpoint points</span> — correct answers in Flashpoint pace score 2×.</>,
    mastery:       <>Ranked by topics mastered in your <span style={{ color: T.ink, fontWeight: 600 }}>Knowledge Map</span> — see how your constellation compares.</>,
    'games-week':  <>Ranked by <span style={{ color: T.ink, fontWeight: 600 }}>XP earned this week</span> — daily-capped and reset every Monday, so it rewards play, not grinding.</>,
    'games-level': <>Ranked by all-time <span style={{ color: T.ink, fontWeight: 600 }}>level</span> across the Level Up games.</>,
  }[tab];
  const contextIcon = tab === 'flashpoint' ? <Zap size={12} style={{ color: '#F59E0B' }} />
    : tab === 'mastery' ? <Sparkles size={12} style={{ color: T.accent }} />
    : isGames ? <Gamepad2 size={12} style={{ color: T.primary }} />
    : <TrendingUp size={12} style={{ color: T.primary }} />;

  const medal = (i) => i === 0 ? '#D4AF37' : i === 1 ? '#A8B0B8' : i === 2 ? '#B87333' : null;
  const myRank = ranked.findIndex(e => e.id === profileId);
  const notRankedNote = NOTE[tab] || NOTE.growth;
  const empty = EMPTY[tab] || EMPTY.growth;

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeights = top3.length === 3 ? [64, 86, 50] : top3.map(() => 70);

  return (
    <div className="anim-fadeup">
      <TopBar title="Leaderboard" onBack={onBack}
              right={
                <button onClick={load} disabled={entries === null} aria-label="Refresh"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                  <RefreshCw size={18} style={{ color: T.muted }} className={entries === null && !offline ? 'animate-spin' : ''} />
                </button>
              } />
      <PageContainer size="content" className="pb-24 pt-3">

        {isGuest && (
          <Card className="p-3 mb-4 anim-fadeup" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}33` }}>
            <div className="flex items-center gap-3">
              <Trophy size={18} style={{ color: T.primary }} className="flex-shrink-0" />
              <div className="text-xs leading-relaxed flex-1" style={{ color: T.inkSoft }}>
                You're viewing as a guest. Sign in to appear on the leaderboard and compete.
              </div>
              <button onClick={onGuestSignIn}
                      className="no-tap-highlight text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
                      style={{ color: T.primary, background: T.primary + '14' }}>
                Sign in
              </button>
            </div>
          </Card>
        )}

        {/* Board switch — Study vs Games. */}
        <div className="grid grid-cols-2 gap-1.5 mb-3 p-1 rounded-2xl" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
          {[
            { id: 'study', label: 'Study', icon: Trophy, tint: T.primary },
            { id: 'games', label: 'Games', icon: Gamepad2, tint: '#7C3AED' },
          ].map(b => {
            const on = board === b.id;
            const Icon = b.icon;
            return (
              <button key={b.id} onClick={() => switchBoard(b.id)}
                      className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold active:scale-[0.98] transition-colors"
                      style={{ background: on ? b.tint : 'transparent', color: on ? '#FFF' : T.inkSoft }}>
                <Icon size={14} /> {b.label}
              </button>
            );
          })}
        </div>

        {/* Sub-tabs for the active board. */}
        <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1 pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {subTabs.map(t => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className="no-tap-highlight flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap flex-shrink-0 active:scale-95"
                      style={{ background: active ? T.primary : T.surface, color: active ? '#FFF' : T.inkSoft,
                               border: `1.5px solid ${active ? T.primary : T.border}`,
                               transition: 'background .2s, color .2s, border-color .2s' }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Context line for the active tab. */}
        {contextLine && !offline && entries !== null && (
          <div className="text-[12px] leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
            <span className="inline -mt-0.5 mr-1">{contextIcon}</span>{contextLine}
          </div>
        )}

        {offline ? (
          <Card className="p-6 text-center" style={{ background: T.surfaceWarm }}>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.4 }} />
            <div className="text-sm" style={{ color: T.muted }}>Connect to the internet to view the leaderboard.</div>
          </Card>
        ) : entries === null ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 rounded-2xl skeleton-pulse" style={{ background: T.borderSoft }} />
            ))}
          </div>
        ) : ranked.length === 0 ? (
          <EmptyState
            icon={tab === 'flashpoint' ? Zap : tab === 'mastery' ? Crown : isGames ? Gamepad2 : Trophy}
            title={empty.title}
            text={empty.text}
            progress={tab === 'mastery' ? `${myMastered} topic${myMastered === 1 ? '' : 's'} mastered so far`
              : tab === 'growth' ? `${Math.min(attemptedCount, 10)} / 10 questions completed` : undefined}
            actionLabel={onStartQuiz ? (isGames ? 'Open Level Up' : 'Start Practising') : undefined}
            onAction={onStartQuiz}
            kmNote={tab === 'mastery'} />
        ) : (
          <>
            {/* Your standing — pinned summary. */}
            {profileId && (
              <Card className="p-3.5 mb-4 lb-pop"
                    style={{ background: `linear-gradient(135deg, ${T.primary}14, ${T.primary}06)`, border: `1px solid ${T.primary}2E` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
                    <Trophy size={18} color="#FFF" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: T.muted }}>Your standing</div>
                    <div className="text-sm font-semibold" style={{ color: T.ink }}>
                      {myRank >= 0
                        ? <>Rank #{myRank + 1} of {ranked.length}{' · '}<span style={{ color: T.primary }}>{metricOf(ranked[myRank])}</span></>
                        : <span style={{ color: T.inkSoft, fontWeight: 500 }}>{notRankedNote}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Podium — top 3. */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-2.5 mb-5 pt-2">
                {podiumOrder.map((e, idx) => {
                  if (!e) return null;
                  const realRank = ranked.findIndex(x => x.id === e.id);
                  const m = medal(realRank);
                  const me = e.id === profileId;
                  const h = podiumHeights[idx];
                  const isFirst = realRank === 0;
                  return (
                    <div key={e.id} className="flex flex-col items-center lb-rise" style={{ width: 92, animationDelay: `${idx * 90}ms` }}>
                      <div className="relative mb-1.5">
                        {isFirst && <Crown size={18} className="absolute -top-4 left-1/2 -translate-x-1/2 lb-pop" style={{ color: m, animationDelay: '300ms' }} />}
                        <div className="rounded-full flex items-center justify-center font-display font-bold"
                             style={{ width: isFirst ? 54 : 46, height: isFirst ? 54 : 46,
                                      background: m + '22', color: m, border: `2px solid ${m}`, fontSize: isFirst ? 20 : 17 }}>
                          {(e.displayName || e.id || '?').charAt(0).toUpperCase()}
                        </div>
                        {(e.currentStreak || 0) >= STREAK_FIRE_MIN && (
                          <span className="absolute -top-1 -right-1"><StreakFire size={isFirst ? 16 : 14} /></span>
                        )}
                      </div>
                      <div className="text-[11px] font-semibold text-center truncate w-full px-0.5" style={{ color: me ? T.primary : T.ink }}>
                        {(e.displayName || e.id)}{me ? ' (you)' : ''}
                      </div>
                      <div className="text-[11px] font-bold mb-1" style={{ color: m }}>{metricOf(e)}</div>
                      <div className="w-full rounded-t-xl relative overflow-hidden"
                           style={{ height: h, background: `linear-gradient(180deg, ${m}40, ${m}14)`, border: `1px solid ${m}55`, borderBottom: 'none' }}>
                        <div className="lb-medal-shimmer absolute inset-0" />
                        <div className="absolute inset-x-0 top-1.5 text-center font-display font-bold" style={{ color: m, fontSize: 18 }}>
                          {realRank + 1}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ranks 4+ */}
            <div className="space-y-2">
              {rest.map((e, i) => {
                const me = e.id === profileId;
                return (
                  <div key={e.id} className="lb-row" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                    <Card className={me ? 'p-3 lb-you-glow' : 'p-3'}
                          style={me ? { border: `1.5px solid ${T.primary}`, background: T.primary + '0C', '--lb-glow': T.primary + '40' } : {}}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 flex-shrink-0 flex items-center justify-center">
                          <span className="text-sm font-semibold tabular-nums" style={{ color: T.muted }}>{i + 4}</span>
                        </div>
                        <FramedAvatar initial={e.displayName || e.id} frame={me ? myFrame : 'none'} size={32}
                                      bg={(me ? T.primary : T.muted) + '22'} fg={me ? T.primary : T.inkSoft} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.ink }}>
                            <span className="truncate">{e.displayName || e.id}{me ? ' (you)' : ''}</span>
                            {(e.currentStreak || 0) >= STREAK_FIRE_MIN && <StreakFire size={14} className="flex-shrink-0" />}
                          </div>
                        </div>
                        <div className="font-display text-base flex-shrink-0 tabular-nums" style={{ color: me ? T.primary : T.ink }}>
                          {metricOf(e)}
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Not on this board → nudge to the relevant action. */}
            {profileId && myRank === -1 && tab === 'mastery' && onStartQuiz && (
              <button onClick={onStartQuiz}
                      className="no-tap-highlight w-full mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-2xl active:scale-[0.98]"
                      style={{ background: T.primary + '12', color: T.primary }}>
                Practise to master a topic <ChevronRight size={16} />
              </button>
            )}
          </>
        )}
      </PageContainer>
    </div>
  );
}

export default LeaderboardScreen;
