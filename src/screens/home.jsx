// =====================================================================
// HOME SCREEN  (Pipeline step 38 / A1 session 4 — batch 1b slice 10 —
// extracted from App.jsx)
// The landing dashboard: greeting, streak, spaced-revision + weak-area
// prompts, primary practice actions, announcements/feedback banners, the
// guest sign-in nudge, and the support card. [A7] theme via useTheme();
// app data + question pool via useData(). All navigation/dismiss callbacks
// and presentation flags stay props.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, AlertTriangle, Brain, Calculator, CalendarDays, Check, ChevronRight, ClipboardList, Flag, Flame, HelpCircle, Hourglass, ListChecks, Menu, Network, RotateCcw, Settings as SettingsIcon, Shuffle, Sparkles, Target, Timer, UserPlus, X } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { topicName, getWeakTopics } from '../lib/topics.js';
import { getDueQuestions } from '../lib/selectors.js';
import { todayStr } from '../lib/utils.js';
import { Card, Button } from '../ui/primitives.jsx';
import { HomeSupportNudge } from '../ui/home-support-nudge.jsx';

function Home({ onNavigate, whatsNew, onDismissWhatsNew, announcement, onDismissAnnouncement, userName, isGuest, guestBannerDismissed, onGuestSignIn, onDismissGuestBanner, unseenReplies, onOpenMyReports, onDismissReplies, onDismissGrace, onDismissReviewToday, onShowReviewInfo, onOpenMenu }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const due = getDueQuestions(data.history, allQuestions);
  const weak = getWeakTopics(data.history, allQuestions, data.preferences && data.preferences.includeGkInStats === true);
  const accuracy = data.stats.totalAttempted > 0
    ? Math.round((data.stats.totalCorrect / data.stats.totalAttempted) * 100) : 0;
  const today = todayStr();
  const todayEntry = data.stats.dailyHistory.find(d => d.date === today);
  const todayCount = todayEntry ? todayEntry.attempted : 0;

  // Live time-of-day greeting — re-evaluates each minute so it flips correctly
  // when the hour crosses noon / 5pm even if the app is left open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  // In-app notice when the admin has replied to / resolved the user's feedback.
  const replies = unseenReplies || [];
  const fixedReply = replies.find(r => r.status === 'fixed');
  const replyMsg = fixedReply
    ? `Your report${fixedReply.questionId ? ` on ${fixedReply.questionId}` : ''} was fixed — thank you!`
    : (replies.length === 1
        ? 'An admin replied to your feedback.'
        : `An admin responded to ${replies.length} of your reports.`);

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-2 anim-fadeup">
      {/* Top bar: menu + quick settings */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onOpenMenu}
                className="no-tap-highlight flex items-center gap-2 p-2 -ml-2 rounded-xl active:bg-black/5"
                aria-label="Open menu">
          <Menu size={22} style={{ color: T.ink }} />
          <span className="text-sm font-medium" style={{ color: T.inkSoft }}>Menu</span>
        </button>
        <button onClick={() => onNavigate({ screen: 'settings' })}
                className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5" aria-label="Settings">
          <SettingsIcon size={20} style={{ color: T.muted }} />
        </button>
      </div>

      {/* GUEST MODE (Phase A): subtle, dismissible sign-in nudge — shown only
          to guests who haven't dismissed it this session. Benefit-framed, never
          blocking. Dismiss is session-only (reappears next launch). */}
      {isGuest && !guestBannerDismissed && (
        <Card className="p-3 mb-4 anim-fadeup" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}33` }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '1A' }}>
              <UserPlus size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold" style={{ color: T.ink }}>You're exploring as a guest</div>
              <div className="text-xs mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
                Sign in to save your progress, sync across devices, and unlock the leaderboard & library.
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <Button size="sm" onClick={onGuestSignIn}>Sign in / Create account</Button>
                <button onClick={onDismissGuestBanner}
                        className="no-tap-highlight text-xs font-medium px-2 py-1.5 rounded-lg active:bg-black/5"
                        style={{ color: T.muted }}>
                  Not now
                </button>
              </div>
            </div>
            <button onClick={onDismissGuestBanner} aria-label="Dismiss"
                    className="no-tap-highlight p-1 -m-1 rounded-lg active:bg-black/5 flex-shrink-0">
              <X size={16} style={{ color: T.muted }} />
            </button>
          </div>
        </Card>
      )}

      {announcement && announcement.id !== data.dismissedAnnouncementId && (() => {
        const important = announcement.level === 'important';
        const annAccent = important ? T.accent : T.primary;
        const AnnIcon = important ? AlertTriangle : Flag;
        return (
          <Card className="p-3 mb-4 anim-fadeup"
                style={{ background: annAccent + '12', border: `1px solid ${annAccent}40` }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: annAccent }}>
                <AnnIcon size={14} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold mb-0.5" style={{ color: annAccent }}>
                  {important ? 'Important' : 'Announcement'}
                </div>
                <div className="text-sm leading-snug whitespace-pre-wrap" style={{ color: T.inkSoft }}>
                  {announcement.text}
                </div>
              </div>
              <button onClick={() => onDismissAnnouncement(announcement.id)}
                      className="no-tap-highlight p-1 -m-1 flex-shrink-0" aria-label="Dismiss">
                <X size={14} style={{ color: T.muted }} />
              </button>
            </div>
          </Card>
        );
      })()}

      {/* Feedback reply — your report got a response */}
      {replies.length > 0 && (
        <Card className="p-3 mb-4 anim-fadeup" onClick={onOpenMyReports}
              style={{ background: T.success + '12', border: `1px solid ${T.success}40`, cursor: 'pointer' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.success }}>
              {fixedReply ? <Check size={14} color="#FFF" /> : <AlertCircle size={14} color="#FFF" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.success }}>Feedback update</div>
              <div className="text-sm leading-snug" style={{ color: T.inkSoft }}>
                {replyMsg} <span className="underline">View</span>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDismissReplies(); }}
                    className="no-tap-highlight p-1 -m-1 flex-shrink-0" aria-label="Dismiss">
              <X size={14} style={{ color: T.muted }} />
            </button>
          </div>
        </Card>
      )}

      {/* Streak saved — one-time banner the day after grace fires, so the user
          actually learns the forgiveness rule instead of silently benefiting. */}
      {data.stats.graceJustUsed && (
        <Card className="p-3 mb-4 anim-fadeup"
              style={{ background: T.accent + '15', border: `1px solid ${T.accent}40` }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent }}>
              <span style={{ fontSize: 14 }}>🛡️</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.accent }}>Streak saved</div>
              <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
                You missed yesterday — your grace day covered it. Keep going today to keep the streak alive.
              </div>
            </div>
            <button onClick={onDismissGrace}
                    className="no-tap-highlight p-1 -m-1 flex-shrink-0" aria-label="Dismiss">
              <X size={14} style={{ color: T.muted }} />
            </button>
          </div>
        </Card>
      )}

      {/* What's new */}
      {whatsNew && whatsNew.length > 0 && (
        <Card className="p-3 mb-4 anim-fadeup" onClick={() => onNavigate({ screen: 'library' })}
              style={{ background: T.accent + '15', border: `1px solid ${T.accent}40`, cursor: 'pointer' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent }}>
              <Sparkles size={14} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.accent }}>What's new</div>
              <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
                {whatsNew.length === 1
                  ? `"${whatsNew[0].name}" updated to v${whatsNew[0].version}`
                  : `${whatsNew.length} banks updated`} — tap to view
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDismissWhatsNew(); }}
                    className="no-tap-highlight p-1 -m-1 flex-shrink-0">
              <X size={14} style={{ color: T.muted }} />
            </button>
          </div>
        </Card>
      )}

      {/* Greeting */}
      <div className="mb-6 mt-2">
        <div className="text-sm" style={{ color: T.muted }}>NORCET prep</div>
        <h1 className="font-display text-3xl font-semibold mt-1" style={{ color: T.ink }}>
          Good {timeOfDay}{userName ? `, ${userName}` : ''}
        </h1>
      </div>

      {/* Streak · Accuracy · Today — center-aligned summary strip */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {/* Streak */}
        <Card className="px-2 py-4 text-center relative">
          {data.stats.streakCurrent > 0 && data.stats.streakGraceAvailable !== false && (
            <span className="absolute top-2 right-2 text-[10px]" title="One missed day allowed">🛡️</span>
          )}
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.accent + '15' }}>
            <Flame size={16} style={{ color: T.accent }} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            Streak
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {data.stats.streakCurrent}
          </div>
          <div className="text-[10px]" style={{ color: T.muted }}>
            day{data.stats.streakCurrent === 1 ? '' : 's'}
          </div>
        </Card>

        {/* Accuracy */}
        <Card className="px-2 py-4 text-center">
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.primary + '15' }}>
            <Target size={16} style={{ color: T.primary }} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            Accuracy
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {accuracy}<span className="text-base font-medium">%</span>
          </div>
          <div className="text-[10px]" style={{ color: T.muted }}>
            {data.stats.totalAttempted} done
          </div>
        </Card>

        {/* Today */}
        <Card className="px-2 py-4 text-center">
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.success + '20' }}>
            <Sparkles size={16} style={{ color: T.success }} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            Today
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {todayCount}
          </div>
          <div className="text-[10px]" style={{ color: T.muted }}>
            question{todayCount === 1 ? '' : 's'}
          </div>
        </Card>
      </div>

      {/* Spaced revision reminder. Three respects for the user:
            1. (?) icon explains what spaced revision is the first time they wonder.
            2. (×) hides it for today only; tomorrow it returns if still due.
            3. Settings toggle lets them turn it off permanently.
          The body of the card is still tappable to launch the review quiz;
          the small icons stop propagation so they don't double-trigger. */}
      {(() => {
        const prefs = data.preferences || {};
        const enabled = prefs.reviewRemindersEnabled !== false;
        const todayStr = new Date().toISOString().slice(0, 10);
        const dismissedToday = prefs.reviewDismissedDate === todayStr;
        if (due.length === 0 || !enabled || dismissedToday) return null;

        return (
          <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable"
                onClick={() => onNavigate({ screen: 'quiz', mode: 'review-due' })}
                style={{ background: T.successSoft, border: `1px solid ${T.success}30` }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.success }}>
                  <RotateCcw size={18} color="#FFF" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold flex items-center gap-1.5" style={{ color: T.ink }}>
                    Review due
                    <button onClick={(e) => { e.stopPropagation(); onShowReviewInfo && onShowReviewInfo(); }}
                            className="no-tap-highlight p-0.5 -m-0.5 rounded-full"
                            aria-label="What is this?">
                      <HelpCircle size={13} style={{ color: T.muted }} />
                    </button>
                  </div>
                  <div className="text-xs truncate" style={{ color: T.inkSoft }}>
                    {due.length} question{due.length === 1 ? '' : 's'} for spaced revision
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); onDismissReviewToday && onDismissReviewToday(); }}
                        className="no-tap-highlight p-2 -m-1 rounded-full active:bg-black/5"
                        aria-label="Hide for today"
                        title="Hide for today">
                  <X size={16} style={{ color: T.muted }} />
                </button>
                <ChevronRight size={20} style={{ color: T.muted }} />
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Focus row — Weak area & Coverage gaps, side by side.
          Weak Area = where she's struggling (accuracy too low).
          Untouched = where she hasn't even started yet.
          Two halves of the same picture; both deep-link to Coverage. */}
      {(() => {
        // Topics she has practised at least a bit, sorted weakest-first.
        const worstWeak = weak.find(w => w.accuracy < 0.6);

        // How many topics she has 0 attempts in.
        const practisedTopicIds = new Set(weak.map(w => w.topic));
        const allTopicIds = new Set();
        allQuestions.forEach(q => allTopicIds.add(q.topic));
        const untouchedCount = Array.from(allTopicIds).filter(t => !practisedTopicIds.has(t)).length;

        const hasAnyAttempts = (data.stats.totalAttempted || 0) > 0;

        // Nothing to show on a brand-new profile (no attempts and nothing weak).
        if (!worstWeak && !hasAnyAttempts) return null;

        // Build each tile so the inner layout can be identical.
        const tiles = [];

        if (worstWeak) {
          tiles.push(
            <Card key="weak" className="p-3 cursor-pointer no-tap-highlight pressable"
                  onClick={() => onNavigate({ screen: 'weak-areas' })}
                  style={{ background: T.errorSoft, border: `1px solid ${T.error}30` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertCircle size={14} style={{ color: T.error }} />
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.error }}>
                  Weak area
                </div>
              </div>
              <div className="font-display text-sm font-semibold truncate" style={{ color: T.ink }}>
                {topicName(worstWeak.topic)}
              </div>
              <div className="text-[11px]" style={{ color: T.muted }}>
                {Math.round(worstWeak.accuracy * 100)}% accuracy
              </div>
            </Card>
          );
        }

        // Coverage tile — always render once she has any data, since the
        // drawer no longer surfaces Coverage anywhere else. The message
        // adapts: while there are untouched topics it warns, once she's
        // started every topic it becomes a calmer "open the breakdown".
        if (hasAnyAttempts) {
          const showWarning = untouchedCount > 0;
          tiles.push(
            <Card key="untouched" className="p-3 cursor-pointer no-tap-highlight pressable"
                  onClick={() => onNavigate({ screen: 'coverage' })}
                  style={{
                    background: showWarning ? T.accent + '12' : T.surfaceWarm,
                    border: `1px solid ${showWarning ? T.accent + '30' : T.border}`
                  }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Activity size={14} style={{ color: showWarning ? T.accent : T.primary }} />
                <div className="text-[10px] uppercase tracking-wider font-semibold"
                     style={{ color: showWarning ? T.accent : T.primary }}>
                  Coverage
                </div>
              </div>
              {showWarning ? (
                <>
                  <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>
                    {untouchedCount} topic{untouchedCount === 1 ? '' : 's'}
                  </div>
                  <div className="text-[11px]" style={{ color: T.muted }}>
                    not started yet
                  </div>
                </>
              ) : (
                <>
                  <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>
                    All topics
                  </div>
                  <div className="text-[11px]" style={{ color: T.muted }}>
                    view the breakdown
                  </div>
                </>
              )}
            </Card>
          );
        }

        // If only one tile qualifies, stretch it to full width rather than
        // leaving a lonely half-width card next to empty space.
        return (
          <div className={`grid gap-2 mb-4 ${tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {tiles}
          </div>
        );
      })()}

      {/* Exam countdown — the "set a date" entry point now lives in the
          slide-in menu (Tools). The dashboard only shows the countdown once a
          date is actually set. */}
      {(() => {
        const examDate = data.stats.examDate;
        if (!examDate) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const target = new Date(examDate); target.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((target - today) / (1000 * 60 * 60 * 24));
        const examPassed = daysLeft < 0;

        // Daily pace target:
        //  - If the user set a manual target, honour it exactly.
        //  - Otherwise auto-derive: aim to cover the whole question pool once
        //    over the days remaining, with a floor of 20/day so it's never
        //    trivially small. This scales with the actual content available
        //    rather than a fixed 1500-question assumption.
        const todayCount2 = todayEntry ? todayEntry.attempted : 0;
        const manualTarget = data.stats.dailyTarget;
        const poolSize = allQuestions.length;
        let perDay;
        if (manualTarget && manualTarget > 0) {
          perDay = manualTarget;
        } else if (daysLeft > 0) {
          // Auto pace: cover the pool over the days remaining, with a floor of
          // 20/day and a cap of 120/day so the final day or two never demands
          // an impossible (and demoralising) whole-pool target.
          perDay = Math.min(120, Math.max(20, Math.ceil(poolSize / daysLeft)));
        } else {
          perDay = 0;
        }
        const todayProgress = Math.min(100, Math.round((todayCount2 / Math.max(1, perDay)) * 100));
        const niceDate = target.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

        const bg = examPassed ? T.surfaceWarm : daysLeft <= 14 ? T.accent : daysLeft <= 30 ? T.accent + 'CC' : T.primary;

        return (
          <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'exam-date' })}
                style={{ background: bg, border: 'none' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: examPassed ? T.surface : 'rgba(255,255,255,0.18)' }}>
                  <CalendarDays size={18} style={{ color: examPassed ? T.muted : '#FFF' }} />
                </div>
                <div className="min-w-0 flex-1" style={{ color: examPassed ? T.muted : '#FFF' }}>
                  {examPassed ? (
                    <>
                      <div className="font-display text-base font-semibold">Exam date passed</div>
                      <div className="text-xs mt-0.5">Tap to set a new date</div>
                    </>
                  ) : daysLeft === 0 ? (
                    <>
                      <div className="font-display text-base font-semibold">Exam day — good luck</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{niceDate}</div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="font-display text-2xl font-semibold leading-none">{daysLeft}</div>
                        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>day{daysLeft === 1 ? '' : 's'} to {niceDate}</div>
                      </div>
                      <div className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {perDay > 0 ? (
                          <>
                            Today: <span className="font-semibold">{todayCount2}/{perDay}</span>{' '}
                            <span style={{ opacity: 0.75 }}>
                              ({todayProgress}% · {manualTarget ? 'your goal' : 'auto'})
                            </span>
                          </>
                        ) : 'Keep revising.'}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight size={20} style={{ color: examPassed ? T.muted : 'rgba(255,255,255,0.7)' }} className="flex-shrink-0 mt-1" />
            </div>
          </Card>
        );
      })()}

      {/* Advanced Test — featured */}
      <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'advanced-setup' })}
            style={{ background: T.sec.advanced, border: 'none' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Hourglass size={20} color={T.bg} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="font-display text-base font-semibold" style={{ color: T.bg }}>Advanced Test</div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ background: T.accent, color: '#FFF' }}>Exam</span>
              </div>
              <div className="text-xs leading-snug truncate" style={{ color: T.bg, opacity: 0.7 }}>
                Negative marking · Countdown · Palette
              </div>
            </div>
          </div>
          <ChevronRight size={20} style={{ color: T.bg, opacity: 0.6 }} />
        </div>
      </Card>

      {/* Main actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4" onClick={() => onNavigate({ screen: 'quick-setup' })}
              style={{ borderTop: `3px solid ${T.sec.quick}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.sec.quick }}>
            <Shuffle size={18} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Quick test</div>
          <div className="text-xs" style={{ color: T.muted }}>Pick count + topic</div>
        </Card>
        <Card className="p-4" onClick={() => onNavigate({ screen: 'topic-select' })}
              style={{ borderTop: `3px solid ${T.sec.topic}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.sec.topic }}>
            <ListChecks size={18} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Topic wise test</div>
          <div className="text-xs" style={{ color: T.muted }}>Pick a subject</div>
        </Card>
        <Card className="p-4" onClick={() => onNavigate({ screen: 'mock-setup' })}
              style={{ borderTop: `3px solid ${T.sec.mock}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.sec.mock }}>
            <Timer size={18} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Mock test</div>
          <div className="text-xs" style={{ color: T.muted }}>Timed simulation</div>
        </Card>
        <Card className="p-4" onClick={() => onNavigate({ screen: 'learn-topics' })}
              style={{ borderTop: `3px solid ${T.sec.learn}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.sec.learn }}>
            <Brain size={18} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Learn topic wise</div>
          <div className="text-xs" style={{ color: T.muted }}>Concept cards</div>
        </Card>
      </div>

      {/* Dosage calculator — numeric drug-math practice. Lives on the dashboard
          (not the slide-in menu) since it's a core practice mode. */}
      <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'dosage' })}
            style={{ borderTop: `3px solid ${T.primary}` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
            <Calculator size={20} color="#FFF" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Dosage calculation test</div>
            <div className="text-xs" style={{ color: T.muted }}>Numeric drug-math practice · type-in answers</div>
          </div>
          <ChevronRight size={20} style={{ color: T.muted }} />
        </div>
      </Card>

      {/* P7 — Previous Year Papers. Exam-style entry point, so it sits on the
          dashboard alongside the other core practice modes rather than in the
          slide-in menu. */}
      <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'previous-papers' })}
            style={{ borderTop: `3px solid ${T.sec.mock}` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.sec.mock }}>
            <ClipboardList size={20} color="#FFF" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="font-display text-base font-semibold" style={{ color: T.ink }}>Previous Year Papers</div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: T.accent, color: '#FFF' }}>PYQ</span>
            </div>
            <div className="text-xs" style={{ color: T.muted }}>Official AIIMS NORCET papers · full mock with negative marking</div>
          </div>
          <ChevronRight size={20} style={{ color: T.muted }} />
        </div>
      </Card>

      {/* P10 — Interactive Knowledge Map. Visualises the whole syllabus as a
          graph the user unlocks by practising; a headline feature, so it sits
          on the dashboard. Network icon (added to the lucide import for this). */}
      <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'knowledge-map' })}
            style={{ borderTop: `3px solid ${T.accent}` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.accent }}>
            <Network size={20} color="#FFF" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="font-display text-base font-semibold" style={{ color: T.ink }}>Knowledge Map</div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: T.primary, color: '#FFF' }}>NEW</span>
            </div>
            <div className="text-xs" style={{ color: T.muted }}>Your syllabus as a graph {'\u00b7'} unlock topics as you practise</div>
          </div>
          <ChevronRight size={20} style={{ color: T.muted }} />
        </div>
      </Card>

      {/* P9 / step 33 — quiet "support the app" nudge. Self-contained: only
          renders after >=100 questions answered and is dismissible forever
          (donatedismissed:v1, shared:false). Never blocks anything. */}
      <HomeSupportNudge totalAttempted={data.stats.totalAttempted} />

      {/* Secondary destinations (Bookmarks, Stats, Library, Add Q, Reference,
          Revision, Coverage) and Settings now live in the slide-in
          menu (NavDrawer), opened from the Menu button at the top. */}
    </div>
  );
}

export default Home;
