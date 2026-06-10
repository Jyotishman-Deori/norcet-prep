// =====================================================================
// src/screens/notification-center.jsx — Session 2 Feature 6, reworked by #7
// The Notification Panel: a structured, mentor-like inbox.
//
//   1. Daily Briefing — a live, non-dismissible summary card fixed at the
//      top (days to exam, reviews due, open doubts, today's focus subject).
//      Computed fresh from app state on every open; never stored.
//   2. Category chips — All / Reminders / Achievements / Insights / Updates,
//      each with its own unread badge. Reminders first (most actionable).
//   3. The list — stored notifications, grouped by category in the All view
//      (Reminders → Achievements → Insights → Updates), newest first within
//      each. Reminder cards use the home-screen "Review Due" visual language
//      with on-card Dismiss (×) and action (→) buttons.
//   4. Read/unread — unread cards carry a soft primary tint + a primary dot
//      top-right; tapping fades them to neutral. "Mark all as read" lives at
//      the panel's top right.
//
// [A7] theme/data/profile via context; navigation/back stay props.
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell, RotateCcw, Flame, BarChart3, Flag, BookOpen, Trophy,
  Megaphone, Sparkles, CalendarClock, Brain, MessageSquare, TrendingUp,
  CheckCircle2, ChevronRight, X, Target, CalendarDays,
} from 'lucide-react';
import { useTheme, useData, useProfile } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import {
  loadNotifications, saveNotifications, categoryOf,
  CATEGORY_ORDER, CATEGORY_LABELS, unreadByCategory,
  markRead as markReadFn, markAllRead as markAllReadFn, dismissOne,
} from '../lib/notifications.js';
import { getDueQuestions } from '../lib/selectors.js';
import { getWeakTopics, topicName } from '../lib/topics.js';
import { loadDoubts, unresolved } from '../lib/doubts.js';
import { TOPICS } from '../data/seed.js';

function NotificationCenter({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const { profileId } = useProfile();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | one of CATEGORY_ORDER
  const [doubtMap, setDoubtMap] = useState({});

  useEffect(() => {
    loadNotifications().then(list => { setNotifications(list); setLoading(false); });
  }, []);
  useEffect(() => {
    if (!profileId) return;
    loadDoubts(profileId).then(setDoubtMap).catch(() => {});
  }, [profileId]);

  // ---- Daily Briefing — live, recomputed each open ------------------
  const briefing = useMemo(() => {
    const stats = data.stats || {};
    let daysToExam = null;
    if (stats.examDate) {
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      const tgt = new Date(stats.examDate); tgt.setHours(0, 0, 0, 0);
      daysToExam = Math.round((tgt - t0) / 86400000);
    }
    const dueCount = getDueQuestions(data.history || {}, allQuestions).length;
    const doubtCount = unresolved(doubtMap).length;

    // Today's focus subject: weakest practised topic; else the largest
    // untouched exam topic; else nothing (omit the line).
    const includeGk = data.preferences && data.preferences.includeGkInStats === true;
    const weak = getWeakTopics(data.history || {}, allQuestions, includeGk);
    let focusTopicId = null;
    const worst = weak.find(w => w.accuracy < 0.7) || weak[0];
    if (worst) {
      focusTopicId = worst.topic;
    } else {
      const attempted = new Set(weak.map(w => w.topic));
      const counts = {};
      allQuestions.forEach(q => { counts[q.topic] = (counts[q.topic] || 0) + 1; });
      const cand = TOPICS
        .filter(t => !attempted.has(t.id) && counts[t.id])
        .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
      focusTopicId = cand[0] ? cand[0].id : null;
    }
    return { daysToExam, dueCount, doubtCount, focusTopicId };
  }, [data, allQuestions, doubtMap]);

  // ---- Read / dismiss actions ---------------------------------------
  const persist = async (next) => { setNotifications(next); await saveNotifications(next); };

  const markAllRead = () => persist(markAllReadFn(notifications));
  const clearAll = () => persist([]);

  const handleTap = async (notif) => {
    await persist(markReadFn(notifications, notif.id));
    if (notif.action) onNavigate(notif.action);
  };
  const handleDismiss = (e, id) => { e.stopPropagation(); persist(dismissOne(notifications, id)); };
  const handleAction = (e, notif) => {
    e.stopPropagation();
    persist(markReadFn(notifications, notif.id));
    if (notif.action) onNavigate(notif.action);
  };

  // ---- Per-type visual metadata -------------------------------------
  const TYPE_META = {
    // Reminders
    spaced_due:      { icon: RotateCcw,    color: T.success, soft: T.successSoft },
    daily_reminder:  { icon: BookOpen,     color: T.primary, soft: T.primary + '15' },
    doubt_nudge:     { icon: Flag,         color: T.accent,  soft: T.accent + '15' },
    topic_reminder:  { icon: Target,       color: T.primary, soft: T.primary + '15' },
    exam_countdown:  { icon: CalendarClock,color: T.accent,  soft: T.accent + '18' },
    // Achievements
    streak:          { icon: Flame,        color: T.accent,  soft: T.accent + '15' },
    accuracy_up:     { icon: TrendingUp,   color: T.success, soft: T.successSoft },
    topic_mastered:  { icon: Trophy,       color: T.success, soft: T.successSoft },
    doubt_milestone: { icon: CheckCircle2, color: T.success, soft: T.successSoft },
    session_done:    { icon: Sparkles,     color: T.accent,  soft: T.accent + '15' },
    // Insights
    consistency:     { icon: CalendarDays, color: T.primary, soft: T.primary + '12' },
    exam_readiness:  { icon: BarChart3,    color: T.primary, soft: T.primary + '12' },
    improvement:     { icon: TrendingUp,   color: T.primary, soft: T.primary + '12' },
    pattern:         { icon: Brain,        color: T.primary, soft: T.primary + '12' },
    weekly:          { icon: BarChart3,    color: T.primary, soft: T.primary + '12' },
    // Updates
    admin:           { icon: Megaphone,    color: T.accent,  soft: T.accent + '12' },
    feature:         { icon: Sparkles,     color: T.primary, soft: T.primary + '12' },
    content_update:  { icon: BookOpen,     color: T.primary, soft: T.primary + '12' },
    faq_reply:       { icon: MessageSquare,color: T.primary, soft: T.primary + '12' },
    feedback_reply:  { icon: MessageSquare,color: T.primary, soft: T.primary + '12' },
  };
  const metaFor = (n) => TYPE_META[n.type] || { icon: Bell, color: T.primary, soft: T.primary + '12' };

  const timeAgo = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  // ---- Derived list state -------------------------------------------
  const unreadCounts = useMemo(() => unreadByCategory(notifications), [notifications]);
  const totalUnread = unreadCounts.reminders + unreadCounts.achievements
                    + unreadCounts.insights + unreadCounts.updates;

  const displayed = filter === 'all'
    ? notifications
    : notifications.filter(n => categoryOf(n) === filter);

  // Group for the All view. Sections are ordered by RECENCY — the category
  // containing the newest notification appears first, so what just happened
  // is always at the top (CATEGORY_ORDER only breaks ties).
  const grouped = useMemo(() => {
    const g = { reminders: [], achievements: [], insights: [], updates: [] };
    for (const n of notifications) { const c = categoryOf(n); (g[c] || g.updates).push(n); }
    return g;
  }, [notifications]);
  const sectionOrder = useMemo(() => {
    return CATEGORY_ORDER
      .filter(c => grouped[c] && grouped[c].length > 0)
      .map(c => ({ c, newest: Math.max(...grouped[c].map(n => n.ts || 0)) }))
      .sort((a, b) => (b.newest - a.newest) ||
                      (CATEGORY_ORDER.indexOf(a.c) - CATEGORY_ORDER.indexOf(b.c)))
      .map(x => x.c);
  }, [grouped]);

  const chips = [
    { id: 'all', label: 'All', count: totalUnread },
    ...CATEGORY_ORDER.map(c => ({ id: c, label: CATEGORY_LABELS[c], count: unreadCounts[c] })),
  ];

  // ---- Card renderers ------------------------------------------------
  const ReminderCard = (notif) => {
    const meta = metaFor(notif);
    const Icon = meta.icon;
    const unread = !notif.read;
    return (
      <Card key={notif.id} className="p-3.5"
            onClick={() => handleTap(notif)}
            style={{
              background: unread ? meta.soft : T.surface,
              border: `1px solid ${unread ? meta.color + '40' : T.border}`,
              transition: 'background .4s ease, border-color .4s ease',
            }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: meta.color }}>
            <Icon size={18} color="#FFF" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-semibold leading-snug flex items-center gap-1.5"
                 style={{ color: T.ink }}>
              <span className="truncate">{notif.title}</span>
              {unread && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />}
            </div>
            {notif.body && (
              <div className="text-xs leading-relaxed mt-0.5 truncate" style={{ color: T.inkSoft }}>
                {notif.body}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={(e) => handleDismiss(e, notif.id)}
                    className="no-tap-highlight p-2 -m-0.5 rounded-full active:bg-black/5"
                    aria-label="Dismiss" title="Dismiss">
              <X size={16} style={{ color: T.muted }} />
            </button>
            {notif.action && (
              <button onClick={(e) => handleAction(e, notif)}
                      className="no-tap-highlight w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition"
                      style={{ background: meta.color }}
                      aria-label="Open" title="Open">
                <ChevronRight size={18} color="#FFF" />
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const StandardCard = (notif) => {
    const meta = metaFor(notif);
    const Icon = meta.icon;
    const unread = !notif.read;
    return (
      <Card key={notif.id} className="p-4"
            onClick={() => handleTap(notif)}
            style={{
              background: unread ? T.primary + '0A' : T.surface,
              border: `1px solid ${unread ? T.primary + '2E' : T.border}`,
              transition: 'background .4s ease, border-color .4s ease',
            }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: meta.soft, color: meta.color }}>
            <Icon size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-sm leading-snug" style={{ color: T.ink }}>
                {notif.title}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {unread && <span className="w-2 h-2 rounded-full mt-1" style={{ background: T.primary }} />}
                <button onClick={(e) => handleDismiss(e, notif.id)}
                        className="no-tap-highlight p-1 -m-0.5 rounded-full active:bg-black/5"
                        aria-label="Dismiss" title="Dismiss">
                  <X size={14} style={{ color: T.muted }} />
                </button>
              </div>
            </div>
            {notif.body && (
              <div className="text-xs leading-relaxed mt-0.5" style={{ color: T.inkSoft }}>{notif.body}</div>
            )}
            <div className="text-[10px] mt-1.5 font-medium" style={{ color: T.muted }}>
              {timeAgo(notif.ts)}
              {notif.action && <span style={{ color: T.primary }}> · Tap to open →</span>}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderCard = (notif) =>
    categoryOf(notif) === 'reminders' ? ReminderCard(notif) : StandardCard(notif);

  // ---- Daily Briefing card ------------------------------------------
  const BriefingCard = () => {
    const { daysToExam, dueCount, doubtCount, focusTopicId } = briefing;
    const rows = [];
    if (daysToExam != null && daysToExam >= 0) {
      rows.push({ k: 'exam', icon: CalendarClock,
        label: daysToExam === 0 ? 'Exam is today' : `${daysToExam} day${daysToExam === 1 ? '' : 's'} to your exam` });
    }
    rows.push({ k: 'due', icon: RotateCcw,
      label: dueCount > 0
        ? `${dueCount} spaced revision question${dueCount === 1 ? '' : 's'} waiting`
        : 'No revisions due — you’re caught up' });
    if (doubtCount > 0) {
      rows.push({ k: 'doubt', icon: Flag,
        label: `${doubtCount} unresolved doubt${doubtCount === 1 ? '' : 's'}` });
    }
    if (focusTopicId) {
      rows.push({ k: 'focus', icon: Target, label: `Focus today: ${topicName(focusTopicId)}` });
    }

    return (
      <div className="rounded-2xl p-4 mb-4"
           style={{
             background: `linear-gradient(135deg, ${T.primary}14, ${T.primary}06)`,
             border: `1px solid ${T.primary}2A`,
           }}>
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: T.primary }}>
            <Sparkles size={15} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold" style={{ color: T.ink }}>
            Your daily briefing
          </div>
        </div>
        <div className="space-y-1.5">
          {rows.map(r => {
            const RIcon = r.icon;
            return (
              <div key={r.k} className="flex items-center gap-2.5">
                <RIcon size={15} style={{ color: T.primary }} className="flex-shrink-0" />
                <div className="text-[13px] leading-snug" style={{ color: T.inkSoft }}>{r.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---- Empty state for the active filter ----------------------------
  const EmptyForFilter = () => {
    const label = filter === 'all' ? '' : CATEGORY_LABELS[filter];
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
             style={{ background: T.surfaceWarm }}>
          <Bell size={26} style={{ color: T.muted }} />
        </div>
        <div className="font-display text-lg mb-1" style={{ color: T.ink }}>
          {filter === 'all' ? 'Nothing here yet' : `No ${label.toLowerCase()} yet`}
        </div>
        <div className="text-sm max-w-xs" style={{ color: T.muted }}>
          {filter === 'all'
            ? 'Reminders, achievements and insights will appear here as you study.'
            : filter === 'reminders' ? 'Reminders show up when reviews, doubts or your exam date need attention.'
            : filter === 'achievements' ? 'Keep studying — milestones and wins land here.'
            : filter === 'insights' ? 'As patterns emerge in your study, observations show up here.'
            : 'Announcements and content updates appear here.'}
        </div>
      </div>
    );
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Notifications" onBack={onBack}
              right={
                totalUnread > 0 ? (
                  <button onClick={markAllRead}
                          className="no-tap-highlight text-xs font-medium px-2.5 py-1.5 rounded-lg active:bg-black/5"
                          style={{ color: T.primary }}>
                    Mark all read
                  </button>
                ) : null
              } />

      <div className="max-w-md mx-auto px-4 pt-3 pb-24">
        {/* 1 — Daily Briefing (always present) */}
        <BriefingCard />

        {/* 2 — Category chips */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto -mx-1 px-1 pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {chips.map(chip => {
            const active = filter === chip.id;
            return (
              <button key={chip.id} onClick={() => setFilter(chip.id)}
                      className="no-tap-highlight flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0"
                      style={{
                        background: active ? T.primary : T.surfaceWarm,
                        color: active ? '#FFF' : T.inkSoft,
                        border: `1px solid ${active ? T.primary : T.border}`,
                      }}>
                {chip.label}
                {chip.count > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                        style={{ background: active ? 'rgba(255,255,255,0.25)' : T.primary,
                                 color: '#FFF' }}>
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3 — List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl skeleton-pulse" style={{ background: T.borderSoft }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyForFilter />
        ) : filter === 'all' ? (
          <div className="space-y-4">
            {sectionOrder.map(cat => {
              const items = grouped[cat];
              if (!items || items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-2 px-1"
                       style={{ color: T.muted }}>
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <div className="space-y-2">{items.map(renderCard)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">{displayed.map(renderCard)}</div>
        )}

        {/* Clear all — quiet, destructive, at the very bottom */}
        {notifications.length > 0 && (
          <div className="text-center mt-6">
            <button onClick={clearAll}
                    className="no-tap-highlight text-xs px-3 py-1.5 rounded-lg active:bg-black/5"
                    style={{ color: T.muted }}>
              Clear all notifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationCenter;
