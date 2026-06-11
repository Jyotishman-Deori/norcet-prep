// =====================================================================
// src/screens/leaderboard.jsx — Leaderboard screen (A1 slice 16)
// UX pass + Knowledge-Map tie-in:
//   • New "Mastery" board ranks by mastered topics (same math as the map), so
//     users see where their constellation stands against everyone else.
//   • A pinned "your standing" card (rank + metric, or how to qualify).
//   • Top-3 podium with rising/shimmer micro-interactions; staggered row
//     entrance; a soft glow on the current user's row.
// Props unchanged (profileId, isGuest, onGuestSignIn, onBack, attemptedCount,
// onStartQuiz) + optional myMastered for the empty/your-standing copy.
// =====================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Trophy, Crown, Flame, Target, CalendarDays, Sparkles, ChevronRight } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';
import { loadLeaderboard } from '../lib/leaderboard.js';

function LeaderboardScreen({ profileId, isGuest = false, onGuestSignIn, onBack, attemptedCount = 0, onStartQuiz, myMastered = 0 }) {
  const { theme: T } = useTheme();
  const [tab, setTab] = useState('week'); // 'week' | 'mastery' | 'streak' | 'accuracy'
  const [entries, setEntries] = useState(null); // null = loading
  const [offline, setOffline] = useState(false);

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
    if (tab === 'mastery') {
      return list.filter(e => (e.masteredTopics || 0) > 0)
                 .sort((a, b) => (b.masteredTopics || 0) - (a.masteredTopics || 0) || (b.totalAnswered || 0) - (a.totalAnswered || 0));
    }
    if (tab === 'streak') {
      return list.filter(e => (e.currentStreak || 0) > 0)
                 .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0) || (b.totalAnswered || 0) - (a.totalAnswered || 0));
    }
    if (tab === 'accuracy') {
      return list.filter(e => (e.totalAnswered || 0) >= 50)
                 .map(e => ({ ...e, acc: e.totalAnswered ? e.totalCorrect / e.totalAnswered : 0 }))
                 .sort((a, b) => b.acc - a.acc || (b.totalAnswered || 0) - (a.totalAnswered || 0));
    }
    return list.filter(e => (e.weeklyAnswered || 0) > 0)
               .sort((a, b) => (b.weeklyAnswered || 0) - (a.weeklyAnswered || 0));
  }, [entries, tab]);

  const tabs = [
    { id: 'week',     label: 'This Week', icon: CalendarDays },
    { id: 'mastery',  label: 'Mastery',   icon: Crown },
    { id: 'streak',   label: 'Streak',    icon: Flame },
    { id: 'accuracy', label: 'Accuracy',  icon: Target },
  ];
  const metricOf = (e) => {
    if (tab === 'mastery') return `${e.masteredTopics || 0} \u2605`;
    if (tab === 'streak') return `${e.currentStreak || 0}d`;
    if (tab === 'accuracy') return `${Math.round((e.totalAnswered ? e.totalCorrect / e.totalAnswered : 0) * 100)}%`;
    return `${e.weeklyAnswered || 0} Q`;
  };
  const medal = (i) => i === 0 ? '#D4AF37' : i === 1 ? '#A8B0B8' : i === 2 ? '#B87333' : null;
  const myRank = ranked.findIndex(e => e.id === profileId);
  const notRankedNote = tab === 'mastery'
    ? 'Master your first topic in the Knowledge Map to claim a spot here.'
    : tab === 'accuracy'
      ? 'Answer at least 50 questions to qualify for the accuracy board.'
      : tab === 'streak'
        ? 'Start a streak \u2014 study today to appear here.'
        : 'Answer some questions this week to join the board.';

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  // Podium display order: 2nd, 1st, 3rd (1st centre + tallest).
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
      <div className="max-w-md mx-auto px-4 pb-24 pt-3">

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

        {/* Tabs — horizontally scrollable chips with icons. */}
        <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1 pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => {
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

        {/* Mastery context line — ties the board to the Knowledge Map. */}
        {tab === 'mastery' && !offline && entries !== null && (
          <div className="text-[12px] leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
            <Sparkles size={12} className="inline -mt-0.5 mr-1" style={{ color: T.accent }} />
            Ranked by topics mastered in your <span style={{ color: T.ink, fontWeight: 600 }}>Knowledge Map</span> {'\u2014'} see how your constellation compares.
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
            icon={tab === 'mastery' ? Crown : Trophy}
            title={tab === 'mastery' ? 'Light up your first constellation' : 'Your name belongs on this board'}
            text={tab === 'mastery'
              ? 'Master a topic in the Knowledge Map to appear here and compare your progress with other aspirants.'
              : 'Complete 10 questions to appear on the leaderboard and see how you rank against other NORCET aspirants.'}
            progress={tab === 'mastery' ? `${myMastered} topic${myMastered === 1 ? '' : 's'} mastered so far` : `${Math.min(attemptedCount, 10)} / 10 questions completed`}
            actionLabel={onStartQuiz ? 'Start Practising' : undefined}
            onAction={onStartQuiz}
            kmNote />
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
                        ? <>Rank #{myRank + 1} of {ranked.length}{' \u00b7 '}<span style={{ color: T.primary }}>{metricOf(ranked[myRank])}</span></>
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
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
                             style={{ background: (me ? T.primary : T.muted) + '22', color: me ? T.primary : T.inkSoft }}>
                          {(e.displayName || e.id || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" style={{ color: T.ink }}>
                            {e.displayName || e.id}{me ? ' (you)' : ''}
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
      </div>
    </div>
  );
}

export default LeaderboardScreen;
