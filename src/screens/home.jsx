// =====================================================================
// HOME SCREEN  (Pipeline step 38 / A1 session 4 — batch 1b slice 10 —
// extracted from App.jsx)
// The landing dashboard: greeting, streak, spaced-revision + weak-area
// prompts, primary practice actions, announcements/feedback banners, the
// guest sign-in nudge, and the support card. [A7] theme via useTheme();
// app data + question pool via useData(). All navigation/dismiss callbacks
// and presentation flags stay props.
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Activity, AlertCircle, AlertTriangle, BarChart2, Bell, BellRing, BookOpen, Brain, Calculator, CalendarDays, Check, CheckCircle, ChevronRight, ClipboardList, Crown, Droplet, Dumbbell, Flag, Flame, GraduationCap, HelpCircle, Hourglass, Layers, Lightbulb, ListChecks, Menu, Network, Play, RotateCcw, Ruler, ScrollText, Settings as SettingsIcon, Shuffle, Sparkles, Syringe, Target, Ticket, Timer, UserPlus, X } from 'lucide-react';
// Layer 1 — the quiet "terms updated" card compares the stamped acceptance
// against the current LEGAL_VERSION (App seeds/records the stamp).
import { LEGAL_VERSION } from '../lib/legal.js';
import { useTheme, useData, useProfile, useI18n } from '../lib/app-context.jsx';
import StreakFire, { STREAK_FIRE_MIN } from '../ui/streak-fire.jsx';
import { topicName, getWeakTopics } from '../lib/topics.js';
import { getDueQuestions } from '../lib/selectors.js';
import { todayStr } from '../lib/utils.js';
import { getNextQuote } from '../lib/quotes.js';
import { progress as luProgress, tierFor as luTierFor, normalizeLevelup } from '../lib/levelup.js';
import { pushNotification } from '../lib/notifications.js';
import RichText from '../ui/rich-text.jsx';
import { toPlainText } from '../lib/rich-text.js';
import { Card, Button, requestConfirm, NoteButton } from '../ui/primitives.jsx';
// FAV — opt-in premium Favourites strip (renders null unless enabled + non-empty).
// Push-reach fix — one-tap notification opt-in card (renders null unless the
// tested rules in lib/push-opt-in.js say this is the right moment).
import NotificationNudge from '../ui/notification-nudge.jsx';
// PWA install card — subordinate to the notification card by rule (one ask at
// a time; lib/install-prompt.js), so mounting both never stacks two banners.
import InstallNudge from '../ui/install-nudge.jsx';
// TIP — hold (mobile) / hover (PC) info bubbles.
import { Tip } from '../ui/tooltip.jsx';
// LAUNCH WAITLIST — guest-only "reserve your seat" card, shown only while
// game_config waitlist.collect is ON and this device hasn't joined yet.
import { getConfig } from '../lib/game-config.js';
import { isPremiumEnabled } from '../lib/premium.js';
import { haptic, HAPTIC } from '../lib/juice.js';
import { playTapSound } from '../lib/sound.js';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { summarize as summarizeResume } from '../lib/test-session.js';

// Nursing Calculator Suite card hue. Fixed (not theme-derived) and a clinical
// blue on purpose: Drill and Learn are tonal shades of the theme primary, so the
// calculator needs its own colour or it reads as a third practice card.
const CALC_HUE = '#1D4ED8';

// Lighten a 6-digit hex colour toward white by fraction t (0..1). Used to
// build the Learn card's gradient from its single accent (T.sec.learn) so the
// card reads as "premium" like Drill Tests while staying a DIFFERENT colour —
// the two cards must remain visually distinct. Returns the input unchanged if
// it isn't a 6-digit hex.
function lightenHex(hex, t) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * t);
  const to2 = (n) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

// Darken a 6-digit hex toward black by fraction t (0..1). Pairs with lightenHex
// so the Drill and Learn cards can be a TONAL PAIR drawn from the same theme
// primary — Drill brighter, Learn deeper — instead of clashing fixed colours.
function darkenHex(hex, t) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (c) => Math.round(c * (1 - t));
  const to2 = (n) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

// Feature 3 — brief positive feedback when the spaced-review queue is empty
// for an active user. Auto-hides after 3s so it rewards, then clears space.
// Not dismissable (it's reassurance, not an interruption).
function AllCaughtUpCard() {
  const { theme: T } = useTheme();
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="anim-fadeup mb-4 px-4 py-3 rounded-2xl flex items-center gap-3"
         style={{ background: T.successSoft, border: `1px solid ${T.success}30` }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white shadow-sm">
        <CheckCircle size={18} style={{ color: T.success }} />
      </div>
      <div>
        <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>{t('home.caughtUp')}</div>
        <div className="text-xs" style={{ color: T.muted }}>{t('home.caughtUpSub')}</div>
      </div>
    </div>
  );
}

// The "NurseHolic" eyebrow above the greeting: tapping it springs the
// wordmark (brand-pop, shared with the DesktopNav tile) with a soft haptic.
// Pure delight, no navigation; self-contained so Home's hook order is safe.
function BrandMark() {
  const { theme: T } = useTheme();
  const [pop, setPop] = useState(0);
  return (
    <button onClick={() => { playTapSound(); haptic(HAPTIC.PLACE); setPop((c) => c + 1); }}
            aria-label="NurseHolic"
            className="no-tap-highlight text-left">
      <span key={pop}
            className={'inline-block text-[11px] uppercase tracking-[0.2em] font-semibold' + (pop ? ' brand-pop' : '')}
            style={{ color: T.muted }}>
        Nurse<span style={{ color: T.primary }}>Holic</span>
      </span>
    </button>
  );
}

function Home({ onNavigate, whatsNew, onDismissWhatsNew, announcement, onDismissAnnouncement, userName, isGuest, guestBannerDismissed, onGuestSignIn, onDismissGuestBanner, unseenReplies, onOpenMyReports, onDismissReplies, onDismissGrace, onDismissReviewToday, onShowReviewInfo, onOpenMenu, weeklySummaryDismissed, dismissWeeklySummary, onOpenNotifications, unreadNotifCount = 0, onNotifRead, onEnableNotifications, onAckLegalUpdate, resumeSnap, onResumeTest, onDiscardResume }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { data, allQuestions } = useData();
  const { profile } = useProfile();
  const { t } = useI18n();
  const profileId = (profile && profile.id) || 'guest';

  // LAUNCH WAITLIST nudge — guests only, while signups are open
  // (waitlist.collect) and this device hasn't already joined.
  const [waitlistNudge, setWaitlistNudge] = useState(false);
  useEffect(() => {
    if (!isGuest) { setWaitlistNudge(false); return; }
    const wl = getConfig().waitlist || {};
    if (wl.collect !== true) { setWaitlistNudge(false); return; }
    let alive = true;
    safeStorage.get(KEYS.WAITLIST_IDENTITY, false)
      .then(r => { if (alive) setWaitlistNudge(!(r && r.value)); })
      .catch(() => { if (alive) setWaitlistNudge(true); });
    return () => { alive = false; };
  }, [isGuest]);

  // Issue 6 — the top bar (Menu / notifications / settings) is a FIXED bar that
  // hides as you scroll down and slides back in the moment you scroll up, so it's
  // never permanently out of reach. (Mirrors the TopBar pattern used elsewhere:
  // portaled to <body> so the home root's anim-fadeup transform can't break
  // position:fixed, with a spacer reserving its height.)
  const [barHidden, setBarHidden] = useState(false);
  useEffect(() => {
    let lastY = (typeof window !== 'undefined' && window.scrollY) || 0;
    let ticking = false;
    const THRESH = 6; // ignore sub-pixel jitter
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const dy = y - lastY;
        if (y < 48) setBarHidden(false);            // always visible near the top
        else if (dy > THRESH) setBarHidden(true);   // scrolling down → hide
        else if (dy < -THRESH) setBarHidden(false); // scrolling up → reveal
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const due = getDueQuestions(data.history, allQuestions);
  const weak = getWeakTopics(data.history, allQuestions, data.preferences && data.preferences.includeGkInStats === true);
  const accuracy = data.stats.totalAttempted > 0
    ? Math.round((data.stats.totalCorrect / data.stats.totalAttempted) * 100) : 0;
  const today = todayStr();
  const todayEntry = data.stats.dailyHistory.find(d => d.date === today);
  const todayCount = todayEntry ? todayEntry.attempted : 0;

  // Level Up — live level / tier / XP progress for the Home entry card.
  const lu = normalizeLevelup(data.levelup);
  const luProg = luProgress(lu.xp);
  const luTier = luTierFor(luProg.level);

  // Live time-of-day greeting — re-evaluates each minute so it flips correctly
  // when the hour crosses noon / 5pm even if the app is left open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  // Feature 4 — week-over-week snapshot. ADAPTED to the real data model:
  //   • dailyHistory entries are { date, attempted, correct } — NOT `answered`.
  //   • per-question history does NOT store a topic; we resolve it from
  //     allQuestions (the same pattern getWeakTopics uses).
  const weeklySummary = useMemo(() => {
    const nowD = new Date();
    const dayOfWeek = nowD.getDay() || 7; // 1=Mon … 7=Sun
    const startOfThisWeek = new Date(nowD);
    startOfThisWeek.setDate(nowD.getDate() - (dayOfWeek - 1));
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const thisWeekStart = startOfThisWeek.toISOString().slice(0, 10);
    const lastWeekStart = startOfLastWeek.toISOString().slice(0, 10);
    const lastWeekEnd = new Date(startOfThisWeek);
    lastWeekEnd.setDate(startOfThisWeek.getDate() - 1);
    const lastWeekEndStr = lastWeekEnd.toISOString().slice(0, 10);

    const daily = data.stats.dailyHistory || [];
    const thisWeekEntries = daily.filter(d => d.date >= thisWeekStart);
    const lastWeekEntries = daily.filter(d => d.date >= lastWeekStart && d.date <= lastWeekEndStr);
    const sum = (arr, key) => arr.reduce((a, b) => a + (b[key] || 0), 0);

    const thisAnswered = sum(thisWeekEntries, 'attempted');
    const thisCorrect = sum(thisWeekEntries, 'correct');
    const lastAnswered = sum(lastWeekEntries, 'attempted');
    const lastCorrect = sum(lastWeekEntries, 'correct');

    const thisAcc = thisAnswered >= 5 ? Math.round((thisCorrect / thisAnswered) * 100) : null;
    const lastAcc = lastAnswered >= 5 ? Math.round((lastCorrect / lastAnswered) * 100) : null;

    const topicOf = (qId) => { const q = allQuestions.find(x => x.id === qId); return q ? q.topic : null; };

    const topicThisWeek = {};
    const topicLastWeek = {};
    Object.entries(data.history || {}).forEach(([qId, h]) => {
      const topic = topicOf(qId);
      if (!topic || !h.attempts) return;
      h.attempts.forEach(a => {
        if (!a.ts) return;
        const d = new Date(a.ts).toISOString().slice(0, 10);
        const bucket = d >= thisWeekStart ? topicThisWeek
                     : (d >= lastWeekStart && d <= lastWeekEndStr) ? topicLastWeek
                     : null;
        if (!bucket) return;
        if (!bucket[topic]) bucket[topic] = { correct: 0, total: 0 };
        bucket[topic].total++;
        if (a.correct) bucket[topic].correct++;
      });
    });

    const allTopicStats = {};
    Object.entries(data.history || {}).forEach(([qId, h]) => {
      const topic = topicOf(qId);
      if (!topic || !h.attempts) return;
      if (!allTopicStats[topic]) allTopicStats[topic] = { correct: 0, total: 0 };
      allTopicStats[topic].total += h.attempts.length;
      allTopicStats[topic].correct += h.attempts.filter(a => a.correct).length;
    });
    const weakestTopic = Object.entries(allTopicStats)
      .filter(([, s]) => s.total >= 3)
      .sort(([, a], [, b]) => (a.correct / a.total) - (b.correct / b.total))[0]?.[0] || null;

    let improvedTopic = null;
    let bestImprovement = 0;
    Object.keys(topicThisWeek).forEach(tid => {
      if (!topicLastWeek[tid]) return;
      const thisT = topicThisWeek[tid];
      const lastT = topicLastWeek[tid];
      if (thisT.total < 2 || lastT.total < 2) return;
      const imp = (thisT.correct / thisT.total) - (lastT.correct / lastT.total);
      if (imp > bestImprovement) { bestImprovement = imp; improvedTopic = tid; }
    });

    const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
    const dateRange = `${fmt(startOfThisWeek)}–${fmt(endOfThisWeek)}`;

    return { thisAnswered, thisAcc, lastAcc, weakestTopic, improvedTopic, dateRange };
  }, [data.stats.dailyHistory, data.history, allQuestions]);

  const showWeeklySummary = !weeklySummaryDismissed
    && (data.stats.totalAttempted || 0) >= 10
    && new Date().getDay() !== 0; // not Sunday — show Mon–Sat only

  // Feature 5 — daily quote. New quote on every Home mount (each navigation
  // here); cycles the full set without repeats. Renders only once resolved.
  // #6 — ALSO swaps on every pull-to-refresh (App dispatches
  // 'norcet:refreshed'), with a swap animation: the old quote slips away,
  // the new one settles in (quoteSeq keys the block so CSS re-runs).
  const [dailyQuote, setDailyQuote] = useState(null);
  const [quoteSeq, setQuoteSeq] = useState(0);
  useEffect(() => {
    getNextQuote().then(q => setDailyQuote(q));
    const onRefreshed = () => {
      getNextQuote().then(q => { setDailyQuote(q); setQuoteSeq(n => n + 1); });
    };
    window.addEventListener('norcet:refreshed', onRefreshed);
    return () => window.removeEventListener('norcet:refreshed', onRefreshed);
  }, []);

  // Feature 6 — generate inbox notifications from existing signals. Both
  // de-dupe inside pushNotification(), so re-mounts won't spam the inbox.
  useEffect(() => {
    if (due.length > 0) {
      pushNotification({
        type: 'spaced_due',
        title: t('home.notif.reviewTitle'),
        body: due.length === 1 ? t('home.notif.reviewBodyOne') : t('home.notif.reviewBodyMany', { n: due.length }),
        action: { screen: 'quiz', mode: 'review-due' }
      });
    }
  }, [due.length]);

  const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100];
  useEffect(() => {
    const s = data.stats.streakCurrent;
    if (STREAK_MILESTONES.includes(s)) {
      pushNotification({
        type: 'streak',
        title: t('home.notif.streakTitle', { s }),
        body: t('home.notif.streakBody', { s }),
        action: null
      });
    }
  }, [data.stats.streakCurrent]);

  // #7 — Exam-countdown REMINDER. Mentor one-liner once the exam is under
  // 30 days out. Re-checked daily (dedupe 23h) so it surfaces at most once
  // a day, routing to the high-yield Revision digest.
  useEffect(() => {
    const examDate = data.stats.examDate;
    if (!examDate) return;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const tgt = new Date(examDate); tgt.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((tgt - t0) / 86400000);
    if (daysLeft < 0 || daysLeft > 30) return;
    const line = daysLeft <= 7
      ? t('home.notif.exam7')
      : daysLeft <= 14
        ? t('home.notif.exam14')
        : t('home.notif.exam30');
    pushNotification({
      type: 'exam_countdown',
      title: daysLeft === 0 ? t('home.notif.examDay') : (daysLeft === 1 ? t('home.notif.examOneDay') : t('home.notif.examDays', { n: daysLeft })),
      body: line,
      action: { screen: 'revision-sheet' },
      dedupeMs: 23 * 60 * 60 * 1000,
    });
  }, [data.stats.examDate]);

  // #7 — Weekly INSIGHT + ACHIEVEMENT from the week-over-week snapshot Home
  // already computes. Slow cadence (dedupe ~6 days) so they read as a weekly
  // observation, not a daily nag. Gated on enough activity to be meaningful.
  useEffect(() => {
    if ((data.stats.totalAttempted || 0) < 10) return;
    const WEEK = 6 * 24 * 60 * 60 * 1000;
    const { thisAcc, lastAcc, improvedTopic } = weeklySummary;
    if (thisAcc != null && lastAcc != null && thisAcc - lastAcc >= 5) {
      pushNotification({
        type: 'improvement',
        title: t('home.notif.trendingUp'),
        body: t('home.notif.trendingUpBody', { lastAcc, thisAcc }),
        action: { screen: 'stats' },
        dedupeMs: WEEK,
      });
    }
    if (improvedTopic) {
      pushNotification({
        type: 'accuracy_up',
        title: t('home.notif.sharper'),
        body: t('home.notif.sharperBody', { topic: topicName(improvedTopic) }),
        action: { screen: 'stats' },
        dedupeMs: WEEK,
      });
    }
  }, [weeklySummary, data.stats.totalAttempted]);

  // #7 — UPDATES category. Admin announcements and "what's new" bank/content
  // updates also land in the inbox (they keep their own dismissible Home
  // banners too). De-duped by type over a multi-day window so the same notice
  // never stacks up; the prominent Home banner remains the primary surface, so
  // a brand-new notice arriving inside that window simply shows there.
  useEffect(() => {
    if (!announcement || !announcement.text) return;
    if (announcement.id === data.dismissedAnnouncementId) return;
    pushNotification({
      type: 'admin',
      title: announcement.level === 'important' ? t('home.notif.importantAnnouncement') : t('home.notif.announcement'),
      body: toPlainText(announcement.text).slice(0, 240),
      action: null,
      dedupeMs: 7 * 24 * 60 * 60 * 1000,
    });
  }, [announcement, data.dismissedAnnouncementId]);

  useEffect(() => {
    if (!whatsNew || whatsNew.length === 0) return;
    const body = whatsNew.length === 1
      ? t('home.notif.bankUpdatedOne', { name: whatsNew[0].name, version: whatsNew[0].version })
      : t('home.notif.bankUpdatedMany', { n: whatsNew.length });
    pushNotification({
      type: 'feature',
      title: t('home.notif.newContent'),
      body,
      action: { screen: 'library' },
      dedupeMs: 3 * 24 * 60 * 60 * 1000,
    });
  }, [whatsNew]);

  // In-app notice when the admin has replied to / resolved the user's feedback.
  const replies = unseenReplies || [];
  const fixedReply = replies.find(r => r.status === 'fixed');
  const replyMsg = fixedReply
    ? (fixedReply.questionId ? t('home.reply.fixedOn', { id: fixedReply.questionId }) : t('home.reply.fixed'))
    : (replies.length === 1
        ? t('home.reply.one')
        : t('home.reply.many', { n: replies.length }));

  // Focus row (Weak area + Syllabus coverage). Computed once here so it can
  // render in TWO places without duplicating the logic: in the left status
  // column on MOBILE (its original position, between Review and the exam
  // countdown) and at the TOP of the right actions column on DESKTOP, directly
  // above Drill Tests. Returns null when there's nothing meaningful to show.
  const focusRow = (() => {
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
        <Tip key="weak" title={t('home.weakArea')} text={t('home.weakAreaTip')}>
        <Card className="p-3.5 cursor-pointer no-tap-highlight pressable press-safe"
              onClick={() => onNavigate({ screen: 'weak-areas' })}
              onContextMenu={(e) => e.preventDefault()}
              style={{ background: `linear-gradient(140deg, ${lightenHex(T.error, 0.10)} 0%, ${T.error} 62%, ${darkenHex(T.error, 0.16)} 100%)`,
                       border: 'none', boxShadow: `0 8px 22px ${darkenHex(T.error, 0.45)}38` }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
              <AlertCircle size={16} color="#FFF" />
            </div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {t('home.weakArea')}
            </div>
          </div>
          <div className="font-display text-sm font-semibold leading-tight" style={{ color: '#FFF', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {topicName(worstWeak.topic)}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>
            {t('home.pctAccuracy', { pct: Math.round(worstWeak.accuracy * 100) })}
          </div>
        </Card>
        </Tip>
      );
    }

    // Coverage tile — always render once she has any data, since the drawer no
    // longer surfaces Coverage anywhere else. The message adapts: while there
    // are untouched topics it warns, once she's started every topic it becomes
    // a calmer "open the breakdown".
    if (hasAnyAttempts) {
      const showWarning = untouchedCount > 0;
      const sc = showWarning ? T.accent : T.primary;
      tiles.push(
        <Tip key="untouched" title={t('home.syllabusCoverage')} text={t('home.syllabusCoverageTip')}>
        <Card className="p-3.5 cursor-pointer no-tap-highlight pressable press-safe"
              onClick={() => onNavigate({ screen: 'coverage' })}
              onContextMenu={(e) => e.preventDefault()}
              style={{ background: `linear-gradient(140deg, ${lightenHex(sc, 0.12)} 0%, ${sc} 60%, ${darkenHex(sc, 0.14)} 100%)`,
                       border: 'none', boxShadow: `0 8px 22px ${darkenHex(sc, 0.45)}38` }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
              <Activity size={16} color="#FFF" />
            </div>
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {t('home.syllabus')}
            </div>
          </div>
          {showWarning ? (
            <>
              <div className="font-display text-sm font-semibold" style={{ color: '#FFF' }}>
                {untouchedCount === 1 ? t('home.topicOne') : t('home.topicMany', { n: untouchedCount })}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>
                {t('home.notStartedYet')}
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-sm font-semibold" style={{ color: '#FFF' }}>
                {t('home.allTopics')}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>
                {t('home.viewBreakdown')}
              </div>
            </>
          )}
        </Card>
        </Tip>
      );
    }

    // If only one tile qualifies, stretch it to full width rather than leaving
    // a lonely half-width card next to empty space.
    return (
      <div className={`grid gap-2 mb-4 ${tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {tiles}
      </div>
    );
  })();

  return (
    <div className="max-w-md md:max-w-3xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8 pb-24">
      {/* Issue 6 — fixed top bar that hides on scroll-down and reveals on
          scroll-up. Portaled to <body> so no transformed ancestor can ever
          break its position:fixed. GPU-GLITCH FIX: this bar is now OPAQUE (no
          backdrop-filter). On some Android GPUs (e.g. Mali on the Realme Pad)
          a backdrop-filter layer that ALSO carries a transform — this bar has
          the hide-on-scroll translateY — composites against the page as
          uninitialised, noisy memory, painting a corrupted box over the cards.
          A solid background + soft shadow removes the artifact while keeping
          the same look. */}
      {typeof document !== 'undefined' && createPortal(
        /* lg:hidden — on desktop the persistent DesktopNav (App root) replaces
           this header; all of its actions (menu, notes, bell, settings) live
           there. Mobile/tablet keep this bar byte-identical. */
        <div className="fixed top-0 left-0 right-0 z-40 lg:hidden"
             style={{ background: T.bg,
                      borderBottom: `1px solid ${T.borderSoft}`,
                      boxShadow: IS_DARK ? '0 2px 14px rgba(0,0,0,0.5)' : '0 2px 14px rgba(0,0,0,0.06)',
                      paddingTop: 'env(safe-area-inset-top, 0px)',
                      transform: barHidden ? 'translateY(-100%)' : 'translateY(0)',
                      transition: 'transform .28s cubic-bezier(.22,.61,.36,1)' }}>
          <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-2.5 max-w-md md:max-w-3xl lg:max-w-6xl mx-auto">
            <Tip title={t('nav.drawer.menu')} text={t('home.menuTip')}>
              <button onClick={onOpenMenu}
                      className="no-tap-highlight flex items-center gap-2 p-2 -ml-2 rounded-xl active:bg-black/5"
                      aria-label={t('nav.openMenu')}>
                <Menu size={22} style={{ color: T.ink }} />
                <span className="text-sm font-medium" style={{ color: T.inkSoft }}>{t('nav.drawer.menu')}</span>
              </button>
            </Tip>
            <div className="flex items-center gap-1">
              {/* AI Learning Notes — fixed access point on Home (custom header,
                  not the shared TopBar). Same leftmost slot as elsewhere. */}
              <NoteButton />
              {/* Golden Premium shortcut (mobile counterpart of the DesktopNav
                  pill; desktop hides this whole header on lg). */}
              {isPremiumEnabled() && (
                <button onClick={() => { playTapSound(); onNavigate({ screen: 'premium' }); }}
                        className="no-tap-highlight p-2 rounded-full active:bg-black/5 pressable"
                        aria-label={t('nav.drawer.premium.label')}>
                  <Crown size={20} style={{ color: '#D97706' }} />
                </button>
              )}
              {onOpenNotifications && (
                <Tip title={t('home.todayTipTitle')} text={t('home.todayTip')}>
                <button onClick={() => { onNotifRead && onNotifRead(); onOpenNotifications(); }}
                        className="no-tap-highlight relative p-2 rounded-full active:bg-black/5 pressable"
                        aria-label={t('nav.notifications')}>
                  {unreadNotifCount > 0
                    ? <BellRing size={20} style={{ color: T.primary }} />
                    : <Bell size={20} style={{ color: T.muted }} />}
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ background: T.error, lineHeight: 1 }}>
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </button>
                </Tip>
              )}
              <Tip title={t('nav.tabs.settings')} text={t('home.settingsTip')}>
                <button onClick={() => onNavigate({ screen: 'settings' })}
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5" aria-label={t('nav.tabs.settings')}>
                  <SettingsIcon size={20} style={{ color: T.muted }} />
                </button>
              </Tip>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* spacer reserving the fixed bar's REAL height. The bar row is ≈ 59px
          (Menu button 38px + py-2.5), so the old 52px spacer let the first line
          (the "NurseHolic" eyebrow) tuck under the bar. 60px clears it on every
          device; the masthead adds extra top air on desktop below. */}
      <div aria-hidden="true" className="lg:hidden" style={{ height: 'calc(60px + env(safe-area-inset-top, 0px))' }} />

      {/* Notification banners — span the full content width so their left AND
          right edges line up with the greeting and dashboard below. (They used
          to be capped narrower and left-stuck, which read as off-centre strips
          on desktop.) Premium gradient cards + a pointer hover lift keep them
          from feeling like full-bleed OS bars. */}
      <div>

      {/* RESUME AN IN-PROGRESS TEST — the top-most banner (a time-sensitive
          "pick up where you left off" CTA). Full-width so its edges line up with
          every card below on mobile, tablet and desktop. Only shown when a
          fresh, non-stale untimed-practice snapshot exists (App re-checks it on
          each Home visit). Resume relaunches the run; the X discards it. */}
      {resumeSnap && onResumeTest && (() => {
        const sum = summarizeResume(resumeSnap);
        if (!sum || sum.total === 0) return null;
        return (
          <Card className="home-notice p-4 mb-4 anim-fadeup"
                style={{ background: `linear-gradient(135deg, ${T.primary}1C, ${T.primary}0A)`, border: `1px solid ${T.primary}45` }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: T.primary + '20' }}>
                <RotateCcw size={19} style={{ color: T.primary }} />
              </div>
              {/* English-only, matching the hardcoded-English exit/resume dialog
                  copy this feature ships with (no 16-locale prose burden). */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold" style={{ color: T.ink }}>Pick up where you left off</div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
                  {sum.label}, {sum.answered} of {sum.total} answered. Your run is saved on this device.
                </div>
              </div>
              {/* Discarding does not throw the questions away: the run is retired,
                  so the ones seen but never attempted come back in a later test. */}
              <button onClick={() => onDiscardResume(resumeSnap)} aria-label="Discard saved test"
                      className="no-tap-highlight p-1.5 -m-1 rounded-lg active:bg-black/5 flex-shrink-0">
                <X size={16} style={{ color: T.muted }} />
              </button>
            </div>
            <button onClick={() => onResumeTest(resumeSnap)}
                    className="no-tap-highlight mt-3 w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold rounded-xl active:scale-[0.98] transition min-h-[44px]"
                    style={{ background: T.primary, color: '#FFF' }}>
              <Play size={14} fill="#FFF" strokeWidth={0} /> Resume test
            </button>
          </Card>
        );
      })()}

      {/* GUEST MODE (Phase A): subtle, dismissible sign-in nudge — shown only
          to guests who haven't dismissed it this session. Benefit-framed, never
          blocking. Dismiss is session-only (reappears next launch). */}
      {isGuest && !guestBannerDismissed && (
        <Card className="relative p-4 mb-4 anim-fadeup"
              style={{ background: `linear-gradient(135deg, ${T.primary}16, ${T.primary}08)`, border: `1px solid ${T.primary}33` }}>
          {/* dismiss pinned to the top-right so the actions row can own the width */}
          <button onClick={onDismissGuestBanner} aria-label="Dismiss"
                  className="no-tap-highlight absolute top-2.5 right-2.5 p-1 rounded-lg active:bg-black/5">
            <X size={16} style={{ color: T.muted }} />
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1 pr-6 sm:pr-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '1A' }}>
                <UserPlus size={19} style={{ color: T.primary }} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: T.ink }}>{t('home.guestTitle')}</div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
                  {t('home.guestBody')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 pl-[52px] sm:pl-0">
              <Button size="sm" onClick={onGuestSignIn}>{t('home.guestCta')}</Button>
              <button onClick={onDismissGuestBanner}
                      className="no-tap-highlight text-xs font-medium px-2.5 py-2 rounded-lg active:bg-black/5"
                      style={{ color: T.muted }}>
                {t('common.notNow')}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* LAUNCH WAITLIST — guest-only reserve-your-seat card while signups
          are open (waitlist.collect) and this device hasn't joined yet. */}
      {isGuest && waitlistNudge && (
        <Card className="home-notice p-3.5 mb-4 anim-fadeup"
              onClick={() => onNavigate({ screen: 'waitlist' })}
              style={{ background: `linear-gradient(135deg, ${T.accent}16, ${T.accent}0A)`, border: `1px solid ${T.accent}40` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.accent + '1A' }}>
              <Ticket size={18} style={{ color: T.accent }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold" style={{ color: T.ink }}>{t('home.waitlistTitle')}</div>
              <div className="text-xs mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
                {t('home.waitlistBody')}
              </div>
            </div>
            <ChevronRight size={16} className="flex-shrink-0" style={{ color: T.muted }} />
          </div>
        </Card>
      )}

      {announcement && announcement.id !== data.dismissedAnnouncementId
        && !(announcement.expiresAt && Date.now() > announcement.expiresAt) && (() => {
        const important = announcement.level === 'important';
        const annAccent = important ? T.accent : T.primary;
        const AnnIcon = important ? AlertTriangle : Flag;
        return (
          <Card className="p-3.5 mb-4 anim-fadeup"
                style={{ background: `linear-gradient(135deg, ${annAccent}18, ${annAccent}0A)`, border: `1px solid ${annAccent}40` }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: annAccent }}>
                <AnnIcon size={14} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold mb-0.5" style={{ color: annAccent }}>
                  {important ? t('home.important') : t('home.notif.announcement')}
                </div>
                <RichText text={announcement.text} className="text-sm" style={{ color: T.inkSoft }} />
              </div>
              <button onClick={() => onDismissAnnouncement(announcement.id)}
                      className="no-tap-highlight p-1 -m-1 flex-shrink-0" aria-label="Dismiss">
                <X size={14} style={{ color: T.muted }} />
              </button>
            </div>
          </Card>
        );
      })()}

      {/* Layer 1 — quiet "terms updated" notice. Appears ONLY when a signed-in
          user's stamped acceptance predates the current LEGAL_VERSION (i.e.
          after a future legal-doc update). Never blocks anything; "Got it"
          stamps the new version. */}
      {!isGuest && typeof (data.preferences || {}).legalAcceptedVersion === 'number'
        && data.preferences.legalAcceptedVersion < LEGAL_VERSION && (
        <Card className="p-3 mb-4 anim-fadeup"
              style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '18' }}>
              <ScrollText size={14} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.ink }}>{t('home.legalUpdated.title')}</div>
              <div className="text-sm leading-snug" style={{ color: T.inkSoft }}>
                {t('home.legalUpdated.body')}{' '}
                <button onClick={() => onNavigate({ screen: 'legal', doc: 'terms' })}
                        className="no-tap-highlight underline font-medium" style={{ color: T.primary }}>
                  {t('home.legalUpdated.review')}
                </button>
              </div>
            </div>
            <button onClick={onAckLegalUpdate}
                    className="no-tap-highlight flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-full active:scale-95 transition"
                    style={{ background: T.primary + '14', color: T.primary }}>
              {t('welcome.gotIt')}
            </button>
          </div>
        </Card>
      )}

      {/* Feedback reply — your report got a response */}
      {replies.length > 0 && (
        <Card className="home-notice p-3.5 mb-4 anim-fadeup" onClick={onOpenMyReports}
              style={{ background: `linear-gradient(135deg, ${T.success}18, ${T.success}0A)`, border: `1px solid ${T.success}40`, cursor: 'pointer' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.success }}>
              {fixedReply ? <Check size={14} color="#FFF" /> : <AlertCircle size={14} color="#FFF" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.success }}>{t('home.feedbackUpdate')}</div>
              <div className="text-sm leading-snug" style={{ color: T.inkSoft }}>
                {replyMsg} <span className="underline">{t('common.view')}</span>
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
        <Card className="p-3.5 mb-4 anim-fadeup"
              style={{ background: `linear-gradient(135deg, ${T.accent}1C, ${T.accent}0C)`, border: `1px solid ${T.accent}40` }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent }}>
              <span style={{ fontSize: 14 }}>🛡️</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.accent }}>{t('home.streakSaved')}</div>
              <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
                {t('home.streakSavedBody')}
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
        <Card className="home-notice p-3.5 mb-4 anim-fadeup" onClick={() => onNavigate({ screen: 'library' })}
              style={{ background: `linear-gradient(135deg, ${T.accent}1C, ${T.accent}0C)`, border: `1px solid ${T.accent}40`, cursor: 'pointer' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent }}>
              <Sparkles size={15} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.accent }}>{t('home.whatsNew')}</div>
              <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
                {whatsNew.length === 1
                  ? t('home.whatsNewOne', { name: whatsNew[0].name, version: whatsNew[0].version })
                  : t('home.whatsNewMany', { n: whatsNew.length })}
              </div>
            </div>
            <ChevronRight size={16} className="flex-shrink-0" style={{ color: T.accent }} aria-hidden="true" />
            <button onClick={(e) => { e.stopPropagation(); onDismissWhatsNew(); }}
                    className="no-tap-highlight p-1 -m-1 flex-shrink-0" aria-label="Dismiss">
              <X size={14} style={{ color: T.muted }} />
            </button>
          </div>
        </Card>
      )}

      </div>{/* /notification banners */}

      {/* HEADER — greeting + quote now span the FULL row on every breakpoint.
          The KPI cluster (Streak · Accuracy · Today) moved out of the header
          and now leads the left status column below. */}
      <div className="mb-2 lg:mb-6">

      {/* Greeting */}
      <div className="mb-6 mt-2 lg:mt-4">
        <BrandMark />
        <h1 className="font-display text-3xl lg:text-[2.6rem] lg:leading-[1.08] font-semibold mt-1.5" style={{ color: T.ink }}>
          {t('home.greeting.' + timeOfDay)}{userName ? `, ${userName}` : ''}
        </h1>
      </div>

      {/* Daily quote — Feature 5. New quote each Home visit; no card chrome. */}
      {dailyQuote && (
        <div className="anim-fadeup mb-6">
          <div className="relative pl-5" style={{ borderLeft: `2px solid ${T.primary}40` }}>
            <div className="font-display text-3xl leading-none mb-3 select-none"
                 style={{ color: T.primary, opacity: 0.25, lineHeight: 1, marginLeft: -2, marginBottom: 0 }}>
              &#8220;
            </div>
            <div key={quoteSeq} className={quoteSeq > 0 ? 'quote-swap' : ''}>
              <p className="text-sm leading-relaxed italic mt-0" style={{ color: T.inkSoft }}>
                {dailyQuote.text}
              </p>
              {/* The attribution used to read as part of the quote. A leading
                  separator sets it apart. NOT an em dash or "--" (house rule);
                  a tilde is the allowed mark. */}
              <p className="text-[10px] mt-2 font-medium uppercase tracking-wider" style={{ color: T.muted }}>
                <span aria-hidden="true" style={{ marginRight: 5, opacity: 0.75 }}>~</span>
                {dailyQuote.source}
              </p>
            </div>
          </div>
        </div>
      )}

      </div>{/* /header — full-row greeting + quote */}

      {/* Desktop/tablet dashboard body — two curated columns on lg+: secondary
          status (left) and the primary action cards (right). Each column
          wrapper is display:contents on mobile, so it dissolves and the cards
          fall back to the EXACT single-column mobile order. */}
      <div className="md:grid md:grid-cols-12 md:gap-5 lg:gap-6 md:items-start">
      <div className="contents md:block md:col-span-6 lg:col-span-5">

      {/* Streak · Accuracy · Today — the stats cluster now LEADS the left status
          column (above the weekly summary) on every breakpoint. */}
      <div className="grid grid-cols-3 gap-2.5 mb-5 lg:mb-4">
        {/* Streak */}
        <Card className="px-2 py-4 text-center relative cursor-pointer no-tap-highlight pressable"
              onClick={() => onNavigate({ screen: 'stats' })}>
          {data.stats.streakCurrent > 0 && data.stats.streakGraceAvailable !== false && (
            <span className="absolute top-2 right-2 text-[10px]" title={t('home.stats.graceTitle')}>🛡️</span>
          )}
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.accent + '15' }}>
            {data.stats.streakCurrent >= STREAK_FIRE_MIN
              ? <StreakFire size={16} />
              : <Flame size={16} style={{ color: T.accent }} />}
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            {t('home.stats.streak')}
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {data.stats.streakCurrent}
          </div>
          <div className="text-[10px] font-medium" style={{ color: T.inkSoft }}>
            {data.stats.streakCurrent === 1 ? t('home.stats.day') : t('home.stats.days')}
          </div>
        </Card>

        {/* Accuracy */}
        <Card className="px-2 py-4 text-center cursor-pointer no-tap-highlight pressable"
              onClick={() => onNavigate({ screen: 'stats' })}>
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.primary + '15' }}>
            <Target size={16} style={{ color: T.primary }} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            {t('home.stats.accuracy')}
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {accuracy}<span className="text-base font-medium">%</span>
          </div>
          <div className="text-[10px] font-medium" style={{ color: T.inkSoft }}>
            {t('home.stats.done', { n: data.stats.totalAttempted })}
          </div>
        </Card>

        {/* Today */}
        <Card className="px-2 py-4 text-center cursor-pointer no-tap-highlight pressable"
              onClick={() => onNavigate({ screen: 'stats' })}>
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.success + '20' }}>
            <Sparkles size={16} style={{ color: T.success }} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            {t('home.stats.today')}
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {todayCount}
          </div>
          <div className="text-[10px] font-medium" style={{ color: T.inkSoft }}>
            {todayCount === 1 ? t('home.stats.question') : t('home.stats.questions')}
          </div>
        </Card>
      </div>

      {/* Feature 4 — weekly summary (first nudge of a new week, Mon–Sat) */}
      {showWeeklySummary && (
        <div className="anim-fadeup mb-4">
          <Card className="p-4" style={{ border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} style={{ color: T.primary }} />
                <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>
                  {t('home.week.title', { range: weeklySummary.dateRange })}
                </div>
              </div>
              <button onClick={dismissWeeklySummary}
                      className="no-tap-highlight p-1 -m-1 rounded-full active:bg-black/5"
                      aria-label="Dismiss">
                <X size={15} style={{ color: T.muted }} />
              </button>
            </div>

            {weeklySummary.thisAnswered < 5 ? (
              <div className="text-sm" style={{ color: T.muted }}>
                {t('home.week.keepGoing')}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <div className="text-sm font-semibold" style={{ color: T.ink }}>
                    {t('home.week.questions', { n: weeklySummary.thisAnswered })}
                  </div>
                  {weeklySummary.thisAcc !== null && (
                    <div className="text-sm font-semibold" style={{ color: T.ink }}>
                      {t('home.week.accuracy', { pct: weeklySummary.thisAcc })}
                    </div>
                  )}
                </div>

                {weeklySummary.thisAcc !== null && weeklySummary.lastAcc !== null && (
                  (() => {
                    const diff = weeklySummary.thisAcc - weeklySummary.lastAcc;
                    if (Math.abs(diff) <= 1) return null;
                    return (
                      <div className="text-xs mb-2 font-medium"
                           style={{ color: diff > 0 ? T.success : T.error }}>
                        {diff > 0 ? '\u25b2' : '\u25bc'} {t('home.week.vsLastWeek', { pct: Math.abs(diff) })}
                      </div>
                    );
                  })()
                )}

                {weeklySummary.improvedTopic && (
                  <div className="text-xs mb-1" style={{ color: T.muted }}>
                    {t('home.week.improved')} <span style={{ color: T.success, fontWeight: 600 }}>
                      {topicName(weeklySummary.improvedTopic)}
                    </span>
                  </div>
                )}

                {weeklySummary.weakestTopic && (
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3"
                       style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                    <div className="text-xs" style={{ color: T.muted }}>
                      {t('home.week.focusNext')} <span style={{ color: T.ink, fontWeight: 600 }}>
                        {topicName(weeklySummary.weakestTopic)}
                      </span>
                    </div>
                    <button onClick={() => onNavigate({ screen: 'quiz', mode: 'topic',
                                                        topic: weeklySummary.weakestTopic, count: 10 })}
                            className="no-tap-highlight flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold pressable"
                            style={{ background: T.primary, color: '#FFF' }}>
                      {t('common.start')} <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* Push-reach fix — one-tap notification opt-in. Renders null unless the
          pure rules (lib/push-opt-in.js) say so: ≥5 attempts, not already on,
          permission not denied, not snoozed/dismissed-twice. iOS Safari tabs
          get the Add-to-Home-Screen walkthrough variant. */}
      {onEnableNotifications && (
        <NotificationNudge onEnable={onEnableNotifications}
                           reminderTime={(data.preferences && data.preferences.dailyReminder && data.preferences.dailyReminder.time) || '20:00'} />
      )}
      {/* PWA install ask — only ever appears when the notification card is
          quiet (already on / dismissed / ineligible) and the user has ≥10
          attempts. Native one-tap sheet on Android/Chrome; iOS walkthrough. */}
      <InstallNudge />

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
        // Feature 3 — when nothing is due, show a brief "all caught up" pat on
        // the back for active users (≥10 attempts); first-timers see nothing.
        const hasEnoughActivity = (data.stats.totalAttempted || 0) >= 10;
        if (due.length === 0) {
          if (!enabled || !hasEnoughActivity) return null;
          return <AllCaughtUpCard />;
        }
        if (!enabled || dismissedToday) return null;

        // BUG-03 — the review test now starts ONLY from the explicit Start
        // button below (the card body no longer launches it), and that button
        // shows a short caution first so a stray tap can't drop the user into
        // a spaced-review test by accident.
        const startReview = () => requestConfirm({
          icon: <RotateCcw size={20} style={{ color: T.success }} />,
          title: t('home.review.confirmTitle'),
          body: due.length === 1 ? t('home.review.confirmBodyOne') : t('home.review.confirmBodyMany', { n: due.length }),
          confirmLabel: t('home.review.start'),
          cancelLabel: t('common.notNow'),
          tone: 'primary',
          onConfirm: () => onNavigate({ screen: 'quiz', mode: 'review-due' }),
        });
        return (
          <Card className="p-4 mb-4"
                style={{ background: T.successSoft, border: `1px solid ${T.success}30` }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.success }}>
                  <RotateCcw size={18} color="#FFF" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold flex items-center gap-1.5" style={{ color: T.ink }}>
                    {t('home.review.due')}
                    <button onClick={() => onShowReviewInfo && onShowReviewInfo()}
                            className="no-tap-highlight p-0.5 -m-0.5 rounded-full"
                            aria-label={t('home.review.whatIsThis')}>
                      <HelpCircle size={13} style={{ color: T.muted }} />
                    </button>
                  </div>
                  <div className="text-xs truncate" style={{ color: T.inkSoft }}>
                    {due.length === 1 ? t('home.review.subOne') : t('home.review.subMany', { n: due.length })}
                  </div>
                </div>
              </div>
              <button onClick={() => onDismissReviewToday && onDismissReviewToday()}
                      className="no-tap-highlight p-2 -m-1 rounded-full active:bg-black/5 flex-shrink-0"
                      aria-label={t('home.review.hideToday')}
                      title={t('home.review.hideToday')}>
                <X size={16} style={{ color: T.muted }} />
              </button>
            </div>
            <button onClick={startReview}
                    aria-label={t('home.review.startAria')}
                    className="no-tap-highlight w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold active:scale-[0.98] transition"
                    style={{ background: T.success, color: '#FFF', boxShadow: `0 4px 12px ${T.success}55` }}>
              <Play size={15} fill="#FFF" strokeWidth={0} />
              {t('home.review.start')}
            </button>
          </Card>
        );
      })()}

      {/* Focus row (weak area / syllabus). It sits in THIS (left) status column on
          every breakpoint, so the Nursing Calc card can lead the right actions
          column, aligned with the stats row. (It used to hop columns depending on
          whether the Favourites strip was on; that strip is gone.) */}
      {focusRow && <div>{focusRow}</div>}

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
          <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'study-plan' })}
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
                      <div className="font-display text-base font-semibold">{t('home.exam.passed')}</div>
                      <div className="text-xs mt-0.5">{t('home.exam.setNewDate')}</div>
                    </>
                  ) : daysLeft === 0 ? (
                    <>
                      <div className="font-display text-base font-semibold">{t('home.exam.examDayLuck')}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{niceDate}</div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="font-display text-2xl font-semibold leading-none">{daysLeft}</div>
                        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{daysLeft === 1 ? t('home.exam.dayTo', { date: niceDate }) : t('home.exam.daysTo', { date: niceDate })}</div>
                      </div>
                      <div className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {perDay > 0 ? (
                          <>
                            {t('home.exam.todayLabel')} <span className="font-semibold">{todayCount2}/{perDay}</span>{' '}
                            <span style={{ opacity: 0.75 }}>
                              ({todayProgress}% · {manualTarget ? t('home.exam.yourGoal') : t('home.exam.auto')})
                            </span>
                          </>
                        ) : t('home.exam.keepRevising')}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight size={20} style={{ color: examPassed ? T.muted : 'rgba(255,255,255,0.7)' }} className="flex-shrink-0 mt-1" />
            </div>
            {!examPassed && (
              <button onClick={(e) => { e.stopPropagation(); onNavigate({ screen: 'study-plan' }); }}
                      className="no-tap-highlight mt-3 w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-xl py-2 active:scale-[0.98] transition"
                      style={{ background: 'rgba(255,255,255,0.20)', color: '#FFF' }}>
                <Target size={13} /> {t('home.exam.openStudyPlan')}
              </button>
            )}
          </Card>
        );
      })()}

      </div>{/* /status column */}
      <div className="contents md:block md:col-span-6 lg:col-span-7">

      {/* Nursing Calculator Suite — leads the right actions column (it took the
          slot the old Favourites strip used to hold), aligned with the stats row
          on the left. A clinical blue keeps it clearly distinct from the
          primary-toned practice cards below. */}
      <Tip title={t('home.calc.title')} text={t('home.calc.tip')}>
      <Card className="p-4 mb-4 break-inside-avoid cursor-pointer no-tap-highlight pressable press-safe" onClick={() => onNavigate({ screen: 'nursing-calc' })}
            onContextMenu={(e) => e.preventDefault()}
            style={{ background: `linear-gradient(140deg, ${lightenHex(CALC_HUE, 0.14)} 0%, ${CALC_HUE} 58%, ${darkenHex(CALC_HUE, 0.26)} 100%)`, border: 'none', boxShadow: `0 8px 22px ${darkenHex(CALC_HUE, 0.45)}45` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
            <Calculator size={20} color="#FFF" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base font-semibold mb-0.5" style={{ color: '#FFF' }}>{t('home.calc.title')}</div>
            <div className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>{t('home.calc.sub')}</div>
          </div>
          <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.85)' }} className="flex-shrink-0" />
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          {[Syringe, Ruler, Droplet, RotateCcw, ClipboardList, CalendarDays].map((Ic, i) => (
            <Ic key={i} size={15} color="rgba(255,255,255,0.8)" />
          ))}
        </div>
      </Card>
      </Tip>

      {/* #11 — Drill Tests hub entry. Replaces the old inline practice
          section; all six test modes now live on the dedicated Drill Tests
          screen. Prominent, gradient, with a mini mode-icon row so it reads
          as an entry point to something substantial. */}
      {/* Unified home-card template (issues round): every section card below
          shares the same grid — p-4, rounded-2xl, w-11 h-11 rounded-xl icon
          zone, text-base display title, text-xs subtitle, right chevron —
          with per-section accent treatments on top. press-safe + a suppressed
          context menu kill the native long-press glitch; the hold-tooltips
          were removed from these cards because each already carries a
          visible subtitle (the bubble only blocked the card below). The
          tap-and-hold INFO tip is restored here (issues #2) — it is
          glitch-free now that the bubble carries no backdrop-filter and the
          card suppresses the native long-press chrome. */}
      <Tip title={t('home.drill.title')} text={t('home.drill.tip')}>
      <Card className="p-4 mb-4 break-inside-avoid cursor-pointer no-tap-highlight pressable press-safe" onClick={() => onNavigate({ screen: 'drill-tests' })}
            onContextMenu={(e) => e.preventDefault()}
            style={{ background: `linear-gradient(140deg, ${lightenHex(T.primary, 0.12)} 0%, ${T.primary} 60%, ${darkenHex(T.primary, 0.12)} 100%)`, border: 'none', boxShadow: `0 8px 22px ${darkenHex(T.primary, 0.45)}38` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
            <Dumbbell size={20} color="#FFF" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base font-semibold mb-0.5" style={{ color: '#FFF' }}>{t('home.drill.title')}</div>
            <div className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {t('home.drill.sub')}
            </div>
          </div>
          <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.85)' }} className="flex-shrink-0" />
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          {[Shuffle, ListChecks, Timer, Calculator, ClipboardList, Hourglass].map((Ic, i) => (
            <Ic key={i} size={15} color="rgba(255,255,255,0.8)" />
          ))}
        </div>
      </Card>
      </Tip>

      {/* Learn Topic Wise — stays on Home as its own standalone card
          (learning, not testing). Mirrors the premium Drill Tests card UI, and
          now shares the THEME PRIMARY as a tonal pair: Drill is the brighter
          tone, Learn the deeper one — cohesive with the theme grading in every
          palette, while staying clearly distinct from Drill. */}
      <Tip title={t('home.learn.title')} text={t('home.learn.tip')}>
      <Card className="p-4 mb-4 break-inside-avoid cursor-pointer no-tap-highlight pressable press-safe" onClick={() => onNavigate({ screen: 'learn-topics' })}
            onContextMenu={(e) => e.preventDefault()}
            style={{ background: `linear-gradient(140deg, ${T.primary} 0%, ${darkenHex(T.primary, 0.26)} 55%, ${darkenHex(T.primary, 0.42)} 100%)`, border: 'none', boxShadow: `0 8px 22px ${darkenHex(T.primary, 0.5)}40` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.16)' }}>
            <Brain size={20} color="#FFF" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base font-semibold mb-0.5" style={{ color: '#FFF' }}>{t('home.learn.title')}</div>
            <div className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>{t('home.learn.sub')}</div>
          </div>
          <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.85)' }} className="flex-shrink-0" />
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          {[BookOpen, Layers, Lightbulb, GraduationCap, Sparkles, Network].map((Ic, i) => (
            <Ic key={i} size={15} color="rgba(255,255,255,0.8)" />
          ))}
        </div>
      </Card>
      </Tip>

      {/* Level Up — the gamification hub. A LIVE entry: current level, prestige
          tier and XP-to-next progress. Groups the clinical games + the Knowledge
          Map under one progression spine. */}
      <Tip title={t('home.levelUp.title')} text={t('home.levelUp.tip')}>
      <Card className="p-4 mb-4 break-inside-avoid cursor-pointer no-tap-highlight pressable press-safe" onClick={() => onNavigate({ screen: 'level-up' })}
            onContextMenu={(e) => e.preventDefault()}
            style={{ background: `linear-gradient(135deg, ${luTier.accent} 0%, ${luTier.accent}CC 50%, rgba(0,0,0,0.5) 130%)`,
                     border: 'none', boxShadow: `0 8px 22px ${luTier.accent}55` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(255,255,255,0.18)' }}>
            <span className="text-[8px] uppercase tracking-wider font-bold leading-none" style={{ color: 'rgba(255,255,255,0.85)' }}>Lv</span>
            <span className="font-display text-lg font-semibold leading-none" style={{ color: '#FFF' }}>{luProg.level}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <div className="font-display text-base font-semibold" style={{ color: '#FFF' }}>{t('home.levelUp.title')}</div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#FFF' }}>{luTier.title}</span>
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>{t('home.levelUp.sub')}</div>
          </div>
          <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.85)' }} className="flex-shrink-0" />
        </div>
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.22)' }}>
            <div className="h-full rounded-full" style={{ width: `${luProg.pct}%`, background: '#FFF', transition: 'width 0.6s ease' }} />
          </div>
          <div className="text-[10px] mt-1.5 font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {luProg.level >= 100
              ? t('home.levelUp.maxLevel', { xp: luProg.xp.toLocaleString() })
              : t('home.levelUp.toNext', { into: luProg.into.toLocaleString(), span: luProg.span.toLocaleString(), next: luProg.level + 1 })}
          </div>
        </div>
      </Card>
      </Tip>

      </div>{/* /actions column */}
      </div>{/* /desktop dashboard grid */}

      {/* F-A — Study Methods moved to the sidebar's Help & Learn section (#8);
          its Home card was removed to reduce duplication. */}

      {/* Support/donation lives only in Settings → Support now (kept subtle).
          The Home nudge was removed to avoid surfacing it on the home screen. */}

      {/* Secondary destinations (Bookmarks, Stats, Library, Add Q, Reference,
          Revision, Coverage) and Settings now live in the slide-in
          menu (NavDrawer), opened from the Menu button at the top. */}
    </div>
  );
}

export default Home;
