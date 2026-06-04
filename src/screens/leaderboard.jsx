// =====================================================================
// src/screens/leaderboard.jsx — Leaderboard screen (A1 slice 16)
// Extracted from App.jsx. Body byte-identical; only change is the A7 hook
// line (T -> useTheme). Props stay (profileId, isGuest, onGuestSignIn,
// onBack). loadLeaderboard now imported from ../lib/leaderboard.js.
// =====================================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import { loadLeaderboard } from '../lib/leaderboard.js';

function LeaderboardScreen({ profileId, isGuest = false, onGuestSignIn, onBack }) {
  const { theme: T } = useTheme();
  const [tab, setTab] = useState('week'); // 'week' | 'streak' | 'accuracy'
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
    { id: 'week', label: 'This Week' },
    { id: 'streak', label: 'Streak' },
    { id: 'accuracy', label: 'Accuracy' }
  ];
  const metricOf = (e) => {
    if (tab === 'streak') return `${e.currentStreak || 0} day${(e.currentStreak || 0) === 1 ? '' : 's'}`;
    if (tab === 'accuracy') return `${Math.round((e.totalAnswered ? e.totalCorrect / e.totalAnswered : 0) * 100)}%`;
    return `${e.weeklyAnswered || 0} Q`;
  };
  const medal = (i) => i === 0 ? '#D4AF37' : i === 1 ? '#A8B0B8' : i === 2 ? '#B87333' : null;
  const myRank = ranked.findIndex(e => e.id === profileId);
  const notRankedNote = tab === 'accuracy'
    ? 'Answer at least 50 questions to qualify for the accuracy board.'
    : tab === 'streak'
      ? 'Start a streak — study today to appear here.'
      : 'Answer some questions this week to join the board.';

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

        <div className="grid grid-cols-3 gap-2 mb-4">
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className="no-tap-highlight py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: active ? T.primary : T.surface, color: active ? '#FFF' : T.ink, border: `1.5px solid ${active ? T.primary : T.border}` }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {offline ? (
          <Card className="p-6 text-center" style={{ background: T.surfaceWarm }}>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.4 }} />
            <div className="text-sm" style={{ color: T.muted }}>Connect to the internet to view the leaderboard.</div>
          </Card>
        ) : entries === null ? (
          <div className="text-center text-sm py-10" style={{ color: T.muted }}>Loading…</div>
        ) : ranked.length === 0 ? (
          <Card className="p-6 text-center" style={{ background: T.surfaceWarm }}>
            <Trophy size={32} className="mx-auto mb-3" style={{ color: T.accent, opacity: 0.6 }} />
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>No one here yet</div>
            <div className="text-sm" style={{ color: T.muted }}>Be the first — finish a quiz and you'll top the board.</div>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              {ranked.map((e, i) => {
                const me = e.id === profileId;
                const m = medal(i);
                return (
                  <Card key={e.id} className="p-3"
                        style={me ? { border: `1.5px solid ${T.primary}`, background: T.primary + '0C' } : {}}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex-shrink-0 flex items-center justify-center">
                        {m
                          ? <Trophy size={20} style={{ color: m }} />
                          : <span className="text-sm font-semibold" style={{ color: T.muted }}>{i + 1}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" style={{ color: T.ink }}>
                          {e.displayName || e.id}{me ? ' (you)' : ''}
                        </div>
                      </div>
                      <div className="font-display text-base flex-shrink-0" style={{ color: me ? T.primary : T.ink }}>
                        {metricOf(e)}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Current user not on this board → show why / their rank */}
            {profileId && myRank === -1 && (
              <Card className="p-3 mt-3" style={{ background: T.surfaceWarm }}>
                <div className="text-xs" style={{ color: T.muted }}>{notRankedNote}</div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LeaderboardScreen;
