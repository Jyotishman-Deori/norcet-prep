// [A1 slice 45] AdminPanel — the admin hub (visible only when admin mode is
// unlocked). Tile dashboard + detail views: bank management, announcement
// publish/clear, user overview (list + delete), feedback inbox, and the
// helpful-votes report. Extracted from App.jsx with: ONE inserted A7 hook line,
// plus TWO deliberate signature additions — onListUsers / onDeleteProfile.
//
// WHY props instead of moving the helpers in: AdminPanel's only two App-local
// helpers (adminListUsers, adminDeleteProfile) were single-consumer, but
// adminDeleteProfile cascades into App-local storage ops (listBanks/deleteBank,
// 5+/3+ other consumers) that must stay in App. Inverting that dependency
// (a child importing App-local fns) is forbidden, so the two helpers stay in
// App and are passed down — a minimal, documented signature change at the one
// render site. Everything else is VERBATIM.
//
// A7: was a bare-T reader -> useTheme(). No IS_DARK / fgOnDark / fontStyles, no
// data/setData context (profile + allQuestions are props). Renders the already-
// extracted AdminTile, AdminFeedbackCard and ReportedQuestionModal.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  AlertCircle, AlertTriangle, Check, CheckSquare, Database, EyeOff, Flag, HelpCircle, Layers, Lightbulb, Lock, Plus,
  RefreshCw, Send, ShieldCheck, Square, Trash2, Upload, User, TrendingUp, TrendingDown, Award, ChevronDown, Sparkles
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Pill, Card, Button, TopBar, requestConfirm } from '../ui/primitives.jsx';
import AdminTile from '../ui/admin-tile.jsx';
import ConfirmDialog from '../ui/confirm-dialog.jsx';
import AdminManager from '../ui/admin-manager.jsx';
import AdminFaqManager from '../ui/admin-faq-manager.jsx';
import AdminFeedbackCard from '../ui/admin-feedback-card.jsx';
import AdminEmpty from '../ui/admin-empty.jsx';
import ReportedQuestionModal from './reported-question-modal.jsx';
import ContentReview from './content-review.jsx';
import AdminStorageCheck from '../ui/admin-storage-check.jsx';
import RichText, { RichTextEditor } from '../ui/rich-text.jsx';
import { listFeedback, deleteFeedback, updateFeedback } from '../lib/feedback.js';
import { aggregateFlaggedQuestions, saveHiddenIds, loadQuestionGate, FLAG_THRESHOLD } from '../lib/question-gate.js';
import { loadHelpfulnessReport, clearHelpfulnessMany, clearAllHelpfulness } from '../lib/helpful-votes.js';
import { listErrorGroups, setErrorResolved, deleteErrorGroup } from '../lib/errorlog.js';
import { loadReferralGraph, CHANNEL_LABEL } from '../lib/referral-admin.js';
import { loadSignupAnomalies } from '../lib/referral-stats.js';
import { fmtWhen } from '../lib/format.js';
import { topicName } from '../lib/topics.js';
// #24 — bank demand vs supply uses the exam-weightage distribution.
import { examTopicWeightage } from '../lib/weightage.js';
import { PREVIOUS_YEAR_PAPERS } from '../norcet-pyq-data.js';

function AdminPanel({
  profile, banks, banksLoading,
  announcement, onSaveAnnouncement, onClearAnnouncement,
  onLoadAnnHistory, onDeleteAnnHistoryItem, onClearAnnHistory,
  onRefreshBanks, onOpenLibrary, onCreateBank,
  onLockAdmin, onBack, allQuestions = [],
  onListUsers, onDeleteProfile
}) {
  const { theme: T } = useTheme();
  // Which screen we're on: the tile dashboard, or one detail view a level deeper.
  const [view, setView] = useState('dashboard');

  // ── Issues round: HARDWARE-BACK GUARD ──────────────────────────────
  // The Admin Panel is registered as self-guarded in App (its NAV_SELF_
  // GUARDED_SCREENS), so the global handler stands aside. On mount we push
  // our own history entry; every device back press then mirrors exactly what
  // the app's own back does inside the panel:
  //   • inside a detail view → return to the dashboard (and re-arm)
  //   • on the dashboard     → show a "Leave Admin Panel?" confirmation;
  //                            only an explicit "Leave" exits the panel.
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const leaveRef = useRef(false); // true once the user confirms — stop re-arming
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;
    try { window.history.pushState({ adminGuard: true }, ''); } catch (e) {}
    const onPop = () => {
      if (leaveRef.current) return;             // exiting — let App take over
      try { window.history.pushState({ adminGuard: true }, ''); } catch (e) {}
      if (viewRef.current !== 'dashboard') {
        setView('dashboard');                   // mirror the in-panel back
      } else {
        setLeaveConfirm(true);                  // confirm before leaving
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const confirmLeave = () => {
    leaveRef.current = true;
    setLeaveConfirm(false);
    onBack();
  };

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  // Growth & Referrals (Phase 2) — referral rollups computed client-side from
  // the admin-readable profile blobs. Loaded on demand when the section opens.
  const [growth, setGrowth] = useState(null);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthTab, setGrowthTab] = useState('overview'); // overview | referrers | channels
  const [openReferrer, setOpenReferrer] = useState(null);  // expanded referrer id
  const [referrerSort, setReferrerSort] = useState('volume'); // volume | quality
  const [anomalies, setAnomalies] = useState(null); // [{kind,key,count,profiles,lastAt}] | null
  const [feedback, setFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  const [annText, setAnnText] = useState(announcement?.text || '');
  const [annLevel, setAnnLevel] = useState(announcement?.level === 'important' ? 'important' : 'info');
  // #12 — expiry + history state
  const [annExpiry, setAnnExpiry] = useState('7');           // days | 'never'
  const [annHistory, setAnnHistory] = useState([]);
  const [annHistConfirm, setAnnHistConfirm] = useState(null); // id | 'ALL'
  const [annBusy, setAnnBusy] = useState(false);
  const [annMsg, setAnnMsg] = useState(null);

  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
  // #27b — Users list search + sort.
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState('active'); // 'active' | 'joined' | 'name'
  const [fbFilter, setFbFilter] = useState('open');   // 'all' | 'open' | 'resolved'
  const [peekId, setPeekId] = useState(null);          // reported question being viewed

  // Content quality gate (UPGRADE 2 / Layer 3) — questions the admin has pulled
  // from the served pool. Loaded from the public `qgate:hidden` key on mount.
  const [hiddenQ, setHiddenQ] = useState([]);
  const [gateBusy, setGateBusy] = useState('');        // questionId currently saving
  const [gateErr, setGateErr] = useState('');
  useEffect(() => { loadQuestionGate().then(ids => setHiddenQ(ids || [])); }, []);

  const togglePull = useCallback(async (qid, pull) => {
    setGateErr(''); setGateBusy(qid);
    const next = pull
      ? Array.from(new Set([...hiddenQ, qid]))
      : hiddenQ.filter(x => x !== qid);
    try {
      const saved = await saveHiddenIds(next);
      setHiddenQ(saved);
    } catch (e) {
      setGateErr('Could not save. Deploy the updated kv-write function (supabase functions deploy kv-write), then retry.');
    } finally {
      setGateBusy('');
    }
  }, [hiddenQ]);

  // P8 — Helpfulness Insights
  const [helpful, setHelpful] = useState([]);
  const [helpfulLoading, setHelpfulLoading] = useState(true);
  const [helpfulSort, setHelpfulSort] = useState('notHelpful'); // 'helpful'|'notHelpful'|'ratio'
  const [helpfulOpen, setHelpfulOpen] = useState(null);          // expanded row id
  // BUG-05 — selection + bulk/single clear for the helpfulness report.
  const [helpfulSelMode, setHelpfulSelMode] = useState(false);
  const [helpfulSel, setHelpfulSel] = useState(() => new Set());  // selected row ids
  const [helpfulBusy, setHelpfulBusy] = useState(false);
  const refreshHelpful = useCallback(async () => {
    setHelpfulLoading(true);
    const rows = await loadHelpfulnessReport(allQuestions);
    setHelpful(rows);
    setHelpfulLoading(false);
  }, [allQuestions]);

  // #29 — crash reports
  const [errs, setErrs] = useState([]);
  const [errsLoading, setErrsLoading] = useState(true);
  const [errFilter, setErrFilter] = useState('open'); // 'open' | 'resolved' | 'all'
  const [errOpen, setErrOpen] = useState(null);        // expanded signature
  const [errDelConfirm, setErrDelConfirm] = useState(null);
  // #29 — crash reports loader + actions
  const refreshErrs = useCallback(async () => {
    setErrsLoading(true);
    try { setErrs(await listErrorGroups()); } catch (e) { setErrs([]); }
    setErrsLoading(false);
  }, []);
  const resolveErr = useCallback(async (sig, val) => {
    setErrs(prev => prev.map(e => e.sig === sig ? { ...e, resolved: val } : e));
    await setErrorResolved(sig, val);
  }, []);
  const deleteErr = useCallback(async (sig) => {
    setErrs(prev => prev.filter(e => e.sig !== sig));
    setErrDelConfirm(null);
    await deleteErrorGroup(sig);
  }, []);

  // #24 — bank demand vs supply (computed, no telemetry). Supply = questions in
  // each topic's bank; demand = how heavily the exam tests that topic (weightage
  // from the PYQ papers). A topic the exam emphasises but whose bank is thin gets
  // exhausted fastest, so the admin knows where to add questions first.
  const demand = useMemo(() => {
    const weights = examTopicWeightage(PREVIOUS_YEAR_PAPERS, false);
    const total = allQuestions.length || 0;
    const bankByTopic = {};
    allQuestions.forEach(q => { if (q && q.topic) bankByTopic[q.topic] = (bankByTopic[q.topic] || 0) + 1; });
    const ids = new Set([...Object.keys(bankByTopic), ...Object.keys(weights)]);
    const rows = [];
    ids.forEach(id => {
      const size = bankByTopic[id] || 0;
      const w = weights[id] || 0;                       // exam weightage %
      const supplyShare = total > 0 ? size / total : 0; // 0..1
      const demandShare = w / 100;                      // 0..1
      const ratio = demandShare > 0 ? supplyShare / demandShare : (size > 0 ? 2 : 0);
      let risk = 'ok';
      if (w > 0 && (ratio < 0.6 || size < 10)) risk = 'high';
      else if (w > 0 && ratio < 0.9) risk = 'watch';
      rows.push({ id, name: topicName(id) || id, size, w, supplyShare, demandShare, ratio, risk });
    });
    const rank = { high: 0, watch: 1, ok: 2 };
    rows.sort((a, b) => (rank[a.risk] - rank[b.risk]) || (a.ratio - b.ratio) || (b.w - a.w));
    return { rows, highCount: rows.filter(r => r.risk === 'high').length, total };
  }, [allQuestions]);

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    const list = await onListUsers();
    setUsers(list);
    setUsersLoading(false);
  }, []);

  // Reads each user's blob (admin-scoped) and aggregates the referral graph.
  // Reuses the freshest user list; refreshes it first if it hasn't loaded.
  const refreshGrowth = useCallback(async () => {
    setGrowthLoading(true);
    try {
      let list = users;
      if (!list || list.length === 0) { list = await onListUsers(); setUsers(list); }
      const g = await loadReferralGraph(list);
      setGrowth(g);
      // Anomaly flags (server-side, admin-only). Null if referral-intel isn't
      // deployed yet — the panel just omits the card in that case.
      try { setAnomalies(await loadSignupAnomalies()); } catch (e) { setAnomalies(null); }
    } catch (e) { setGrowth(null); }
    setGrowthLoading(false);
  }, [users]);

  const refreshFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    const list = await listFeedback();
    setFeedback(list);
    setFeedbackLoading(false);
  }, []);

  useEffect(() => {
    refreshUsers();
    refreshFeedback();
    if (onRefreshBanks) onRefreshBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the editor in sync if the announcement changes elsewhere. After a
  // "Stop showing" we deliberately KEEP the editor text (so the admin can tweak
  // and re-post), so skip this sync exactly once when the live notice goes away.
  const preserveTextRef = useRef(false);
  useEffect(() => {
    if (preserveTextRef.current) { preserveTextRef.current = false; return; }
    setAnnText(announcement?.text || '');
    setAnnLevel(announcement?.level === 'important' ? 'important' : 'info');
  }, [announcement?.id]);

  const postAnnouncement = async () => {
    if (!annText.trim()) { setAnnMsg({ ok: false, text: 'Write a short notice first.' }); return; }
    setAnnBusy(true);
    // A4: the write now hits Supabase directly and can throw (server rejected
    // the write because this profile isn't an admin, or network/config error).
    // Show a real failure message instead of optimistically claiming success.
    try {
      await onSaveAnnouncement(annText.trim(), annLevel, annExpiry === 'never' ? null : Number(annExpiry));
      if (onLoadAnnHistory) setAnnHistory(await onLoadAnnHistory());
      setAnnMsg({ ok: true, text: 'Posted — all users will see it on their home screen.' });
    } catch (e) {
      setAnnMsg({ ok: false, text: 'Could not post — server rejected the write (are you online and using the admin profile?).' });
    } finally {
      setAnnBusy(false);
    }
  };

  const removeAnnouncement = async () => {
    setAnnBusy(true);
    preserveTextRef.current = true;   // keep the editor text through announcement → null
    try {
      await onClearAnnouncement();
      setAnnMsg({ ok: true, text: 'Stopped — users no longer see it. The text is kept here so you can edit and re-post.' });
    } catch (e) {
      preserveTextRef.current = false;
      setAnnMsg({ ok: false, text: 'Could not stop it — are you online and using the admin profile?' });
    } finally {
      setAnnBusy(false);
    }
  };

  const removeFeedback = async (id) => {
    await deleteFeedback(id);
    setFeedback(prev => prev.filter(x => x.id !== id));
  };

  const saveReply = async (item, patch) => {
    const updated = await updateFeedback(item, patch);
    setFeedback(prev => prev.map(x => x.id === item.id ? updated : x));
  };

  const deleteUser = async (id) => {
    await onDeleteProfile(id);
    setUsers(prev => prev.filter(u => u.id !== id));
    setConfirmDeleteUser(null);
  };

  const totalUsers = users.length;
  const totalBanks = banks ? banks.length : 0;
  const totalFeedback = feedback.length;
  // #19 — open (unhandled) reports for the dashboard summary band.
  const openFeedback = feedback.filter(it => !(it.status === 'fixed' || it.status === 'wontfix' || it.status === 'thanks')).length;

  const backToDash = () => { setHelpfulSelMode(false); setHelpfulSel(new Set()); setView('dashboard'); };

  // ---- Reusable count/badge signals for the tiles ----
  const bigCount = (n, loading) => (
    <span className="font-display text-3xl font-semibold leading-none" style={{ color: T.ink }}>
      {loading ? '—' : n}
    </span>
  );

  // =================== DETAIL VIEW: FEEDBACK ===================
  if (view === 'helpfulness') {
    const sorted = [...helpful].sort((a, b) => {
      if (helpfulSort === 'helpful') return b.helpful - a.helpful;
      if (helpfulSort === 'ratio') return b.ratio - a.ratio || b.total - a.total;
      return b.notHelpful - a.notHelpful; // default: most NOT helpful first (needs attention)
    });
    const sortOpts = [
      { id: 'notHelpful', label: 'Most ✕' },
      { id: 'helpful',    label: 'Most ✓' },
      { id: 'ratio',      label: 'Best ratio' }
    ];
    // BUG-05 — selection, single + bulk clear, and clear-history (all cautioned).
    const totalResponses = helpful.reduce((s, r) => s + r.total, 0);
    const selCount = helpfulSel.size;
    const visibleIds = sorted.map(r => r.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => helpfulSel.has(id));
    const toggleOne = (id) => setHelpfulSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const toggleAll = () => setHelpfulSel(allSelected ? new Set() : new Set(visibleIds));
    const exitSel = () => { setHelpfulSelMode(false); setHelpfulSel(new Set()); };
    const runClear = async (ids) => {
      setHelpfulBusy(true);
      try { await clearHelpfulnessMany(ids); } catch (e) {}
      setHelpfulBusy(false);
      exitSel();
      await refreshHelpful();
    };
    const confirmClearOne = (r) => requestConfirm({
      icon: <Trash2 size={20} style={{ color: T.error }} />,
      title: "Clear this question's votes?",
      body: 'Resets the helpful / not-helpful tally for this one question so it drops off the list. Users can rate it again later — nothing is permanently deleted.',
      confirmLabel: 'Clear votes', cancelLabel: 'Cancel', tone: 'danger',
      onConfirm: () => runClear([r.id]),
    });
    const confirmClearSelected = () => requestConfirm({
      icon: <Trash2 size={20} style={{ color: T.error }} />,
      title: `Clear votes for ${selCount} question${selCount === 1 ? '' : 's'}?`,
      body: 'Resets the helpful / not-helpful tally for each selected question so they drop off the list. Users can rate them again later — nothing is permanently deleted.',
      confirmLabel: `Clear ${selCount}`, cancelLabel: 'Cancel', tone: 'danger',
      onConfirm: () => runClear([...helpfulSel]),
    });
    const confirmClearAll = () => requestConfirm({
      icon: <AlertTriangle size={20} style={{ color: T.error }} />,
      title: 'Clear ALL helpfulness history?',
      body: "This resets every question's helpful / not-helpful votes across all users. The report starts empty. Users can rate again afterwards, but the current signal can't be recovered.",
      confirmLabel: 'Clear everything', cancelLabel: 'Cancel', tone: 'danger', confirmWord: 'CLEAR',
      onConfirm: async () => { setHelpfulBusy(true); try { await clearAllHelpfulness(); } catch (e) {} setHelpfulBusy(false); exitSel(); await refreshHelpful(); },
    });
    const pillBtn = (active) => ({
      background: active ? T.primary : T.surface, color: active ? '#FFF' : T.inkSoft,
      border: `1px solid ${active ? T.primary : T.border}`,
    });
    return (
      <div className="anim-fadeup">
        <TopBar title="Helpfulness" onBack={backToDash}
                right={
                  <button onClick={refreshHelpful} disabled={helpfulLoading} aria-label="Refresh"
                          className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                    <RefreshCw size={18} style={{ color: T.muted }} className={helpfulLoading ? 'animate-spin' : ''} />
                  </button>
                } />
        <div className="max-w-md mx-auto px-4 pb-28 pt-2">
          <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
            How users rate explanations. Only questions with at least one response appear — silent users are intentionally excluded. A high <span style={{ color: T.error, fontWeight: 600 }}>✕</span> count flags an explanation worth rewriting. Tap a row to read the full question and explanation.
          </div>

          {/* Summary band + Select / Clear-history actions */}
          {!helpfulLoading && sorted.length > 0 && (
            <Card className="p-3 mb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] min-w-0" style={{ color: T.ink }}>
                  <span className="font-semibold tabular-nums">{sorted.length}</span> rated
                  <span style={{ color: T.muted }}> · {totalResponses} response{totalResponses === 1 ? '' : 's'}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => { if (helpfulSelMode) exitSel(); else setHelpfulSelMode(true); }}
                          className="no-tap-highlight inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full active:scale-95 transition"
                          style={pillBtn(helpfulSelMode)}>
                    <CheckSquare size={13} /> {helpfulSelMode ? 'Done' : 'Select'}
                  </button>
                  <button onClick={confirmClearAll} disabled={helpfulBusy}
                          className="no-tap-highlight inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full active:scale-95 transition disabled:opacity-50"
                          style={{ background: T.error + '12', color: T.error, border: `1px solid ${T.error}30` }}>
                    <Trash2 size={13} /> Clear history
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Controls: sort chips, OR the selection toolbar in select mode */}
          {!helpfulLoading && sorted.length > 0 && (
            helpfulSelMode ? (
              <div className="flex items-center gap-2 mb-4">
                <button onClick={toggleAll}
                        className="no-tap-highlight text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition"
                        style={pillBtn(allSelected)}>
                  {allSelected ? 'Unselect all' : 'Select all'}
                </button>
                <div className="text-xs flex-1" style={{ color: T.muted }}>{selCount} selected</div>
                <button onClick={confirmClearSelected} disabled={selCount === 0 || helpfulBusy}
                        className="no-tap-highlight inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition disabled:opacity-40"
                        style={{ background: selCount > 0 ? T.error : T.surface, color: selCount > 0 ? '#FFF' : T.muted, border: `1px solid ${selCount > 0 ? T.error : T.border}` }}>
                  <Trash2 size={14} /> Clear{selCount > 0 ? ` (${selCount})` : ''}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {sortOpts.map(o => {
                  const active = helpfulSort === o.id;
                  return (
                    <button key={o.id} onClick={() => setHelpfulSort(o.id)}
                            className="no-tap-highlight py-2 rounded-xl text-xs font-semibold transition-all"
                            style={{ background: active ? T.primary : T.surface, color: active ? '#FFF' : T.ink, border: `1.5px solid ${active ? T.primary : T.border}` }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )
          )}

          {helpfulLoading ? (
            <div className="text-center text-sm py-10" style={{ color: T.muted }}>Loading…</div>
          ) : sorted.length === 0 ? (
            <AdminEmpty icon={Lightbulb} accent={T.primary}
              title="No ratings yet"
              what="Every explanation users mark “helpful” or “not helpful” lands here, sorted so the weakest ones rise to the top — your shortlist of explanations to rewrite."
              when="It fills in as members tap the 👍 / 👎 on an explanation after answering. Questions no one has rated stay hidden."
              collecting />
          ) : (
            <div className="space-y-2.5">
              {sorted.map(r => {
                const open = !helpfulSelMode && helpfulOpen === r.id;
                const checked = helpfulSel.has(r.id);
                return (
                  <Card key={r.id} className="p-3.5 cursor-pointer no-tap-highlight pressable"
                        style={helpfulSelMode && checked ? { borderColor: T.primary, boxShadow: `0 0 0 1.5px ${T.primary}` } : undefined}
                        onClick={() => helpfulSelMode ? toggleOne(r.id) : setHelpfulOpen(open ? null : r.id)}>
                    <div className="flex items-start gap-3">
                      {helpfulSelMode && (
                        <div className="flex-shrink-0 mt-0.5">
                          {checked
                            ? <CheckSquare size={20} style={{ color: T.primary }} />
                            : <Square size={20} style={{ color: T.muted }} />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm" style={{ color: T.ink, ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
                          {r.stem}
                        </div>
                        {r.topic && <div className="text-[11px] mt-1" style={{ color: T.muted }}>{topicName(r.topic)}{!r.found ? ' · not in pool' : ''}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold" style={{ color: T.success }}>✓ {r.helpful}</span>
                        <span className="text-xs font-semibold" style={{ color: T.error }}>✕ {r.notHelpful}</span>
                        {!helpfulSelMode && (
                          <button onClick={(e) => { e.stopPropagation(); confirmClearOne(r); }}
                                  aria-label="Clear this question's votes"
                                  className="no-tap-highlight p-1.5 -m-1 rounded-lg active:bg-black/5">
                            <Trash2 size={15} style={{ color: T.error }} />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* ratio bar */}
                    <div className="h-1.5 rounded-full overflow-hidden mt-2 flex" style={{ background: T.border }}>
                      <div style={{ width: `${r.ratio * 100}%`, background: T.success }} />
                      <div style={{ width: `${(1 - r.ratio) * 100}%`, background: T.error }} />
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: T.muted }}>
                      {r.total} response{r.total === 1 ? '' : 's'} · {Math.round(r.ratio * 100)}% helpful
                    </div>
                    {open && (
                      <div className="mt-3 pt-3 border-t text-xs leading-relaxed" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                        <div className="font-semibold text-[10px] uppercase tracking-wider mb-1" style={{ color: T.muted }}>Explanation</div>
                        <div className="whitespace-pre-wrap">{r.exp || '(no explanation on this question)'}</div>
                        {r.found
                          ? <div className="text-[11px] mt-2" style={{ color: T.muted }}>To rewrite: edit this question in its bank via the Banks section (built-in questions are edited in source).</div>
                          : <div className="text-[11px] mt-2" style={{ color: T.muted }}>This question isn't in the current pool (older bank or removed).</div>}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'growth') {
    const g = growth;
    const tabs = [['overview', 'Overview'], ['referrers', 'Top referrers'], ['channels', 'Channels']];
    const maxChan = (g && g.channels.length) ? Math.max(...g.channels.map(c => c.total)) : 0;
    const sortedReferrers = g ? (referrerSort === 'quality'
      ? [...g.topReferrers].sort((a, b) => (b.retention - a.retention) || (b.confirmed - a.confirmed) || (b.total - a.total))
      : g.topReferrers) : [];
    const medal = ['#D4A017', '#9CA3AF', '#B45309']; // gold / silver / bronze for top 3
    const StatCard = ({ label, value, sub, accent }) => (
      <Card className="p-3.5">
        <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>{label}</div>
        <div className="font-display text-2xl font-semibold tabular-nums" style={{ color: accent || T.ink }}>{value}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{sub}</div>}
      </Card>
    );
    return (
      <div className="anim-fadeup">
        <TopBar title="Growth & Referrals" onBack={backToDash} feedback={{ screen: 'Settings' }} />
        <div className="max-w-md mx-auto px-4 pt-3 pb-24">
          {/* tab switcher */}
          <div className="grid grid-cols-3 gap-1.5 mb-3 p-1 rounded-xl" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
            {tabs.map(([id, label]) => {
              const on = growthTab === id;
              return (
                <button key={id} onClick={() => setGrowthTab(id)}
                        className="no-tap-highlight py-2 rounded-lg text-[12px] font-semibold transition-colors active:scale-95"
                        style={{ background: on ? T.primary : 'transparent', color: on ? '#FFF' : T.inkSoft }}>
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px]" style={{ color: T.muted }}>{g ? `Updated ${fmtWhen(g.generatedAt)}` : ''}</div>
            <button onClick={refreshGrowth} disabled={growthLoading}
                    className="no-tap-highlight inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg active:scale-95"
                    style={{ color: T.primary, background: T.primary + '12' }}>
              <RefreshCw size={12} className={growthLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {growthLoading && !g ? (
            <div className="text-center text-sm py-10" style={{ color: T.muted }}>Loading referral data{'\u2026'}</div>
          ) : !g ? (
            <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>Couldn{'\u2019'}t load referral data. Tap Refresh.</div></Card>
          ) : g.totalUsers === 0 ? (
            <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>No users yet.</div></Card>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {growthTab === 'overview' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Joined via referral" value={g.viaReferral} sub={`${g.pct}% of all users`} accent={T.success} />
                    <StatCard label="This week" value={g.thisWeek}
                              sub={g.trend === 0 ? 'same as last week' : (g.trend > 0 ? `\u25B2 ${g.trend} vs last week` : `\u25BC ${Math.abs(g.trend)} vs last week`)} />
                    <StatCard label="This month" value={g.thisMonth} />
                    <StatCard label="Confirmed" value={g.confirmedTotal} sub={`${g.pendingTotal} pending`} />
                  </div>
                  <Card className="p-4">
                    <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Top channel</div>
                    {g.topChannel ? (
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium" style={{ color: T.ink }}>{g.topChannel.label}</div>
                        <div className="text-sm font-semibold tabular-nums" style={{ color: T.primary }}>{g.topChannel.total} signup{g.topChannel.total === 1 ? '' : 's'}</div>
                      </div>
                    ) : (
                      <div className="text-sm" style={{ color: T.muted }}>No attributed referrals yet.</div>
                    )}
                  </Card>
                  {anomalies !== null && (
                    anomalies.length === 0 ? (
                      <Card className="p-3.5 flex items-center gap-2.5">
                        <ShieldCheck size={16} style={{ color: T.success }} />
                        <div className="text-[13px]" style={{ color: T.muted }}>No signup anomalies detected.</div>
                      </Card>
                    ) : (
                      <Card className="p-4">
                        <div className="flex items-center gap-2 mb-2.5">
                          <AlertTriangle size={15} style={{ color: T.accent }} />
                          <div className="text-sm font-semibold" style={{ color: T.ink }}>{anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} to review</div>
                        </div>
                        <div className="space-y-2">
                          {anomalies.map((a, i) => {
                            const desc = a.kind === 'device' ? `${a.count} accounts from one device`
                              : a.kind === 'ip' ? `${a.count} accounts from one network`
                                : `${a.count} signups in an hour from link \u201C${a.key}\u201D`;
                            return (
                              <div key={i} className="flex items-center justify-between text-xs gap-2">
                                <span className="truncate" style={{ color: T.ink }}>{desc}</span>
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
                                      style={{ background: T.accent + '1A', color: T.accent }}>{a.kind}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[10.5px] mt-2.5 leading-relaxed" style={{ color: T.muted }}>
                          Shared networks (colleges, hostels) can share an IP {'\u2014'} review before acting. Nothing is auto-blocked.
                        </div>
                      </Card>
                    )
                  )}
                  <div className="text-[11px] leading-relaxed px-1" style={{ color: T.muted }}>
                    {'\u201C'}Confirmed{'\u201D'} is approximate {'\u2014'} the invited user attempted at least one question or returned to the app after signing up. Precise activation tracking comes later.
                  </div>
                </div>
              )}

              {/* ── TOP REFERRERS ── */}
              {growthTab === 'referrers' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="text-[11px]" style={{ color: T.muted }}>{sortedReferrers.length} ambassador{sortedReferrers.length === 1 ? '' : 's'}</div>
                    <div className="inline-flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                      {[['volume', 'By volume'], ['quality', 'By quality']].map(([id, label]) => {
                        const on = referrerSort === id;
                        return (
                          <button key={id} onClick={() => setReferrerSort(id)}
                                  className="no-tap-highlight px-2.5 py-1 text-[11px] font-semibold active:scale-95"
                                  style={{ background: on ? T.primary : T.surface, color: on ? '#FFF' : T.muted }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {sortedReferrers.length === 0 ? (
                    <AdminEmpty icon={Award} accent={T.accent}
                      title="No referrals attributed yet"
                      what="Your word-of-mouth leaderboard — who has invited the most friends, and how many of those actually stuck around."
                      when="It populates when someone joins through a user’s share link (Settings → Share). Direct sign-ups don’t count as referrals."
                      collecting />
                  ) : sortedReferrers.map((r, i) => {
                    const isTop3 = referrerSort === 'volume' && i < 3;
                    const open = openReferrer === r.id;
                    return (
                      <Card key={r.id} className="p-0 overflow-hidden"
                            style={isTop3 ? { border: `1.5px solid ${medal[i]}55`, background: `${medal[i]}0D` } : undefined}>
                        <button onClick={() => setOpenReferrer(open ? null : r.id)}
                                className="no-tap-highlight w-full p-3.5 flex items-center gap-3 text-left active:scale-[0.99]">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-display font-semibold text-sm"
                               style={{ background: isTop3 ? medal[i] + '22' : T.surfaceWarm, color: isTop3 ? medal[i] : T.muted }}>
                            {isTop3 ? <Award size={16} /> : i + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" style={{ color: T.ink }}>
                              {r.displayName}{!r.exists && <span className="text-[10px] ml-1" style={{ color: T.muted }}>(unknown)</span>}
                            </div>
                            <div className="text-[11px]" style={{ color: T.muted }}>
                              {r.total} invited {'\u00B7'} {r.confirmed} confirmed {'\u00B7'} {r.pending} pending
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0">
                            <div className="text-sm font-semibold tabular-nums" style={{ color: r.retention >= 50 ? T.success : T.inkSoft }}>{r.retention}%</div>
                            <div className="text-[9px] uppercase tracking-wide" style={{ color: T.muted }}>retention</div>
                          </div>
                          <ChevronDown size={16} style={{ color: T.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} className="flex-shrink-0" />
                        </button>
                        {open && (
                          <div className="px-3.5 pb-3 pt-0 space-y-1.5" style={{ borderTop: `1px solid ${T.border}` }}>
                            <div className="text-[10px] uppercase tracking-wider font-semibold pt-2.5" style={{ color: T.muted }}>Invited</div>
                            {r.referees.map(ref => (
                              <div key={ref.id} className="flex items-center justify-between text-xs">
                                <span className="truncate" style={{ color: T.ink }}>{ref.displayName}</span>
                                <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <span style={{ color: T.muted }}>{CHANNEL_LABEL[ref.channel] || ref.channel}</span>
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{ background: ref.confirmed ? T.success + '1A' : T.surfaceWarm, color: ref.confirmed ? T.success : T.muted }}>
                                    {ref.confirmed ? 'confirmed' : 'pending'}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* ── CHANNELS ── */}
              {growthTab === 'channels' && (
                <div className="space-y-2">
                  {g.channels.length === 0 ? (
                    <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>No signups yet.</div></Card>
                  ) : g.channels.map(c => {
                    const isDirect = c.channel === 'direct';
                    const hue = isDirect ? T.muted : T.primary;
                    return (
                      <Card key={c.channel} className="p-3.5" style={{ opacity: isDirect ? 0.7 : 1 }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium" style={{ color: T.ink }}>{c.label}</div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px]" style={{ color: T.muted }}>{c.retention}% kept</span>
                            <span className="text-sm font-semibold tabular-nums" style={{ color: T.ink }}>{c.total}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: T.borderSoft }}>
                          <div className="h-1.5 rounded-full transition-all duration-500"
                               style={{ background: hue, width: `${maxChan ? Math.round((c.total / maxChan) * 100) : 0}%` }} />
                        </div>
                      </Card>
                    );
                  })}
                  <div className="text-[11px] leading-relaxed px-1 pt-1" style={{ color: T.muted }}>
                    Which sharing surface each signup came through. {'\u201C'}Direct{'\u201D'} means no referral link {'\u2014'} they found the app another way.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (view === 'feedback') {
    const isResolved = (it) => it.status === 'fixed' || it.status === 'wontfix' || it.status === 'thanks';
    const openCount = feedback.filter(it => !isResolved(it)).length;
    const resolvedCount = feedback.length - openCount;
    const shown = feedback.filter(it =>
      fbFilter === 'all' ? true : fbFilter === 'open' ? !isResolved(it) : isResolved(it)
    );
    const filters = [
      { id: 'open',     label: 'Open',     count: openCount },
      { id: 'resolved', label: 'Resolved', count: resolvedCount },
      { id: 'all',      label: 'All',      count: feedback.length }
    ];
    // Content quality gate: questions grouped by distinct-reporter count, plus
    // any currently-hidden ids whose reports have since been cleared (so the
    // admin can still restore them).
    const flagged = aggregateFlaggedQuestions(feedback, { threshold: FLAG_THRESHOLD });
    const flaggedIds = new Set(flagged.map(f => f.questionId));
    const hiddenOnly = hiddenQ.filter(id => !flaggedIds.has(id));
    const gateRows = [
      ...flagged.map(f => ({ ...f, hidden: hiddenQ.includes(f.questionId) })),
      ...hiddenOnly.map(id => ({ questionId: id, count: 0, autoFlag: false, hidden: true, samples: [] })),
    ];
    return (
      <>
      <div className="anim-fadeup">
        <TopBar title="Feedback" onBack={backToDash}
                right={
                  <button onClick={refreshFeedback} disabled={feedbackLoading} aria-label="Refresh"
                          className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                    <RefreshCw size={18} style={{ color: T.muted }} className={feedbackLoading ? 'animate-spin' : ''} />
                  </button>
                } />
        <div className="max-w-md mx-auto px-4 pb-24 pt-2">
          <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
            Reports and suggestions from users, newest first. Tap a <span style={{ color: T.primary, fontWeight: 600 }}>Q:</span> chip to view the exact question. Set a status or reply — the user sees it in "My feedback". Resolved items (Fixed / Won't fix / Thanks) move to their own filter.
          </div>

          {/* Content quality gate — questions reported by multiple readers.
              "Pull from tests" hides a question from every user's pool until
              restored (it stops appearing in any quiz/drill immediately). */}
          {gateRows.length > 0 && (
            <Card className="p-3.5 mb-4" style={{ border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <Flag size={15} style={{ color: T.accent }} />
                <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>Question quality gate</div>
              </div>
              <div className="text-[11px] leading-relaxed mb-3" style={{ color: T.muted }}>
                Questions readers reported, by number of distinct reporters. Anything reported by {FLAG_THRESHOLD}+ readers is an <span style={{ color: T.error, fontWeight: 600 }}>auto-flag</span> candidate. Pulling a question removes it from every user's tests until you restore it.
              </div>
              {gateErr && (
                <div className="text-[11px] leading-relaxed mb-2 px-2.5 py-2 rounded-lg"
                     style={{ background: T.error + '12', color: T.error, border: `1px solid ${T.error}33` }}>
                  {gateErr}
                </div>
              )}
              <div className="space-y-2">
                {gateRows.map(row => {
                  const busy = gateBusy === row.questionId;
                  return (
                    <div key={row.questionId} className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                         style={{ background: row.hidden ? T.surfaceWarm : T.surface, border: `1px solid ${row.hidden ? T.accent + '40' : T.borderSoft}` }}>
                      <div className="min-w-0 flex-1">
                        <button onClick={() => setPeekId(row.questionId)}
                                className="no-tap-highlight font-mono text-[11px] truncate block text-left active:opacity-70"
                                style={{ color: T.primary }}>{row.questionId}</button>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {row.count > 0 && (
                            <Pill bg={row.autoFlag ? T.error + '18' : T.surfaceWarm} color={row.autoFlag ? T.error : T.muted}>
                              {row.count} {row.count === 1 ? 'reporter' : 'reporters'}
                            </Pill>
                          )}
                          {row.autoFlag && <Pill bg={T.error + '18'} color={T.error}>Auto-flag</Pill>}
                          {row.hidden && <Pill bg={T.accent + '18'} color={T.accent}>Hidden</Pill>}
                        </div>
                      </div>
                      <button onClick={() => togglePull(row.questionId, !row.hidden)} disabled={busy}
                              className="no-tap-highlight flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold active:scale-95 disabled:opacity-50"
                              style={row.hidden
                                ? { background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }
                                : { background: T.error, color: '#FFF' }}>
                        {busy ? <RefreshCw size={13} className="animate-spin" /> : (row.hidden ? <Check size={13} /> : <EyeOff size={13} />)}
                        {row.hidden ? 'Restore' : 'Pull'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Triage filter */}
          {!feedbackLoading && feedback.length > 0 && (
            <div className="flex gap-2 mb-4">
              {filters.map(f => {
                const active = fbFilter === f.id;
                return (
                  <button key={f.id} onClick={() => setFbFilter(f.id)}
                          className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors active:scale-95"
                          style={{ background: active ? T.primary : T.surface,
                                   color: active ? '#FFF' : T.inkSoft,
                                   border: `1px solid ${active ? T.primary : T.border}` }}>
                    {f.label}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                          style={{ background: active ? 'rgba(255,255,255,0.22)' : T.surfaceWarm,
                                   color: active ? '#FFF' : T.muted }}>{f.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {feedbackLoading ? (
            <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
          ) : feedback.length === 0 ? (
            <AdminEmpty icon={AlertCircle} accent={T.accent}
              title="No reports yet"
              what="Bug reports and feature ideas users send via the report icon on any screen — each one tagged with the exact screen and question."
              when="As soon as someone submits feedback it shows here, where you can reply (they see it in “My feedback”) and set a status."
              collecting />
          ) : shown.length === 0 ? (
            <Card className="p-8 text-center">
              <Check size={32} className="mx-auto mb-3" style={{ color: T.success, opacity: 0.6 }} />
              <div className="font-display text-base mb-0.5" style={{ color: T.ink }}>
                {fbFilter === 'open' ? 'All caught up' : 'Nothing here'}
              </div>
              <div className="text-sm" style={{ color: T.muted }}>
                {fbFilter === 'open' ? 'No open reports — every item has been handled.' : 'No reports match this filter.'}
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {shown.map(it => (
                <AdminFeedbackCard key={it.id} item={it}
                                   onSaveReply={saveReply} onDelete={removeFeedback} onPeek={setPeekId} />
              ))}
            </div>
          )}
        </div>
      </div>
      <ReportedQuestionModal questionId={peekId} onClose={() => setPeekId(null)} />
      </>
    );
  }

  // =================== DETAIL VIEW: USERS ===================
  if (view === 'users') {
    return (
      <div className="anim-fadeup">
        <TopBar title="Users" onBack={backToDash}
                right={
                  <button onClick={refreshUsers} disabled={usersLoading} aria-label="Refresh"
                          className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                    <RefreshCw size={18} style={{ color: T.muted }} className={usersLoading ? 'animate-spin' : ''} />
                  </button>
                } />
        <div className="max-w-md mx-auto px-4 pb-24 pt-2">
          <div className="text-xs leading-relaxed mb-3 px-1 flex items-start gap-1.5" style={{ color: T.muted }}>
            <EyeOff size={13} className="flex-shrink-0 mt-0.5" />
            <span>High-level only. Personal answers, progress, and passwords stay private — never shown here.</span>
          </div>
          {usersLoading ? (
            <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
          ) : users.length === 0 ? (
            <AdminEmpty icon={User} accent={T.primary}
              title="No members yet"
              what="A high-level roster of everyone who has signed up — display name, when they joined, and when they were last active. Personal answers and progress are never shown."
              when="The first person to create an account appears here. Guests (who never sign up) are not listed." />
          ) : (() => {
            const q = userSearch.trim().toLowerCase();
            const shownUsers = users
              .filter(u => !q || (u.displayName || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q))
              .slice()
              .sort((a, b) => {
                if (userSort === 'name') return (a.displayName || '').localeCompare(b.displayName || '');
                if (userSort === 'joined') return (b.createdAt || 0) - (a.createdAt || 0);
                return (b.lastActive || 0) - (a.lastActive || 0);
              });
            const sorts = [{ id: 'active', label: 'Recent' }, { id: 'joined', label: 'Newest' }, { id: 'name', label: 'A–Z' }];
            return (
            <>
              {/* search */}
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                     placeholder={`Search ${users.length} user${users.length === 1 ? '' : 's'}…`}
                     className="w-full px-3.5 py-2.5 rounded-xl text-sm mb-2.5 outline-none"
                     style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
              {/* sort */}
              <div className="flex gap-2 mb-3">
                {sorts.map(s => {
                  const active = userSort === s.id;
                  return (
                    <button key={s.id} onClick={() => setUserSort(s.id)}
                            className="no-tap-highlight flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95"
                            style={{ background: active ? T.primary : T.surface, color: active ? '#FFF' : T.inkSoft, border: `1px solid ${active ? T.primary : T.border}` }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {shownUsers.length === 0 ? (
                <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>No users match “{userSearch.trim()}”.</div></Card>
              ) : (
              <div className="space-y-2">
              {shownUsers.map(u => {
                const isSelf = profile && u.id === profile.id;
                return (
                  <Card key={u.id} className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ background: T.surfaceWarm }}>
                        <User size={16} style={{ color: T.inkSoft }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="font-medium text-sm truncate" style={{ color: T.ink }}>{u.displayName}</div>
                          {isSelf && <Pill bg={T.primary + '18'} color={T.primary}>you</Pill>}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>
                          Active {fmtWhen(u.lastActive)}{u.createdAt ? ` · joined ${fmtWhen(u.createdAt)}` : ''}
                        </div>
                      </div>
                      {!isSelf && (
                        confirmDeleteUser === u.id ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setConfirmDeleteUser(null)}
                                    className="no-tap-highlight text-xs px-2 py-1 rounded-lg"
                                    style={{ color: T.muted, background: T.surfaceWarm }}>No</button>
                            <button onClick={() => deleteUser(u.id)}
                                    className="no-tap-highlight text-xs px-2 py-1 rounded-lg font-medium"
                                    style={{ color: '#FFF', background: T.error }}>Delete</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteUser(u.id)}
                                  className="no-tap-highlight p-1.5 -m-1.5 flex-shrink-0 rounded-lg active:bg-black/5"
                                  aria-label="Delete profile">
                            <Trash2 size={15} style={{ color: T.error }} />
                          </button>
                        )
                      )}
                    </div>
                  </Card>
                );
              })}
              </div>
              )}
            </>
            );
          })()}
        </div>
      </div>
    );
  }

  // =================== DETAIL VIEW: ANNOUNCEMENT ===================
  if (view === 'announcement') {
    const liveImportant = announcement && announcement.level === 'important';
    return (
      <div className="anim-fadeup">
        <TopBar title="Announcement" onBack={backToDash} />
        <div className="max-w-md mx-auto px-4 pb-24 pt-2">
          <Card className="p-4">
            <div className="text-xs leading-relaxed mb-3" style={{ color: T.muted }}>
              Post a short notice shown on every user's home screen until they dismiss it. Posting again replaces the current one.
            </div>
            {announcement && (
              <div className="mb-3 px-3 py-2.5 rounded-xl"
                   style={{ background: (liveImportant ? T.accent : T.primary) + '15',
                            border: `1px solid ${(liveImportant ? T.accent : T.primary)}40` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="text-[10px] uppercase tracking-wider font-semibold"
                       style={{ color: T.success }}>Live now</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: liveImportant ? T.accent : T.primary, color: '#FFF' }}>
                    {liveImportant ? 'Important' : 'Info'}
                  </span>
                </div>
                <RichText text={announcement.text} style={{ color: T.ink }} />
                <div className="text-[10px] mt-1.5" style={{ color: T.muted }}>
                  Posted {fmtWhen(announcement.ts)}
                  {announcement.expiresAt
                    ? ` · auto-expires in ${Math.max(0, Math.ceil((announcement.expiresAt - Date.now()) / 86400000))} day(s)`
                    : ' · stays until you stop it'}
                </div>
              </div>
            )}
            <div className="mb-3">
              <RichTextEditor value={annText} onChange={v => { setAnnText(v); setAnnMsg(null); }}
                              placeholder="e.g. New Pharmacology bank added — give it a try!" rows={3} maxLength={280} />
            </div>

            {/* Urgency level toggle */}
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Urgency</div>
            <div className="grid grid-cols-2 gap-2 mb-3 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
              {[
                { id: 'info',      label: 'Info',      color: T.primary, hint: 'Routine notice' },
                { id: 'important', label: 'Important', color: T.accent,  hint: 'Stands out — for time-sensitive items' }
              ].map(lv => {
                const active = annLevel === lv.id;
                return (
                  <button key={lv.id} onClick={() => setAnnLevel(lv.id)}
                          className="no-tap-highlight py-2.5 px-2 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: active ? lv.color : 'transparent',
                                   color: active ? '#FFF' : T.inkSoft,
                                   border: `1px solid ${active ? lv.color : 'transparent'}` }}>
                    <div className="font-semibold">{lv.label}</div>
                    <div className="text-[10px] mt-0.5 font-normal"
                         style={{ color: active ? 'rgba(255,255,255,0.85)' : T.muted }}>{lv.hint}</div>
                  </button>
                );
              })}
            </div>

            {/* #12 — auto-expiry: never lets a notice become furniture. */}
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Auto-expires after</div>
            <div className="flex gap-1.5 mb-3">
              {[{ id: '1', l: '1 day' }, { id: '3', l: '3 days' }, { id: '7', l: '7 days' }, { id: '30', l: '30 days' }, { id: 'never', l: 'Never' }].map(o => (
                <button key={o.id} onClick={() => setAnnExpiry(o.id)}
                        className="no-tap-highlight flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors active:scale-95"
                        style={{ background: annExpiry === o.id ? T.primary : T.surfaceWarm,
                                 color: annExpiry === o.id ? '#FFF' : T.inkSoft,
                                 border: `1px solid ${annExpiry === o.id ? T.primary : T.border}` }}>
                  {o.l}
                </button>
              ))}
            </div>

            {annMsg && (
              <div className="text-xs mb-3 px-1" style={{ color: annMsg.ok ? T.success : T.error }}>{annMsg.text}</div>
            )}
            <div className="flex gap-2">
              {announcement && (
                <Button variant="ghost" onClick={removeAnnouncement} disabled={annBusy} className="flex-1"
                        icon={<EyeOff size={14} />}>Stop showing</Button>
              )}
              <Button onClick={postAnnouncement} disabled={annBusy || !annText.trim()} className="flex-1"
                      icon={annBusy ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}>
                {announcement ? 'Replace' : 'Post'}
              </Button>
            </div>
          </Card>

          {/* #12 — PAST ANNOUNCEMENTS: every post is recorded here; delete
              individual entries or wipe the whole history (with an inline
              two-tap confirm — no accidental wipes). */}
          {annHistory.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>
                  Past announcements · {annHistory.length}
                </div>
                {annHistConfirm === 'ALL' ? (
                  <button onClick={async () => { setAnnHistory(await onClearAnnHistory()); setAnnHistConfirm(null); }}
                          className="no-tap-highlight text-[10px] font-bold px-2.5 py-1 rounded-full active:scale-95 transition"
                          style={{ background: T.error, color: '#FFF' }}>
                    Wipe all — sure?
                  </button>
                ) : (
                  <button onClick={() => { setAnnHistConfirm('ALL'); setTimeout(() => setAnnHistConfirm(v => v === 'ALL' ? null : v), 2500); }}
                          className="no-tap-highlight text-[11px] font-medium active:scale-95 transition"
                          style={{ color: T.error, opacity: 0.8 }}>
                    Clear history
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {annHistory.map((a, ai) => {
                  const isLive = announcement && announcement.id === a.id;
                  const expired = a.expiresAt && Date.now() > a.expiresAt;
                  return (
                    <Card key={a.id} className="p-3 seq-item" style={{ animationDelay: `${Math.min(ai, 8) * 60}ms`, opacity: expired && !isLive ? 0.7 : 1 }}>
                      <div className="flex items-start gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                  style={{ background: a.level === 'important' ? T.accent : T.primary, color: '#FFF' }}>
                              {a.level === 'important' ? 'Important' : 'Info'}
                            </span>
                            {isLive && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                    style={{ background: T.successSoft, color: T.success }}>Live</span>
                            )}
                            {expired && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                    style={{ background: T.surfaceWarm, color: T.muted }}>Expired</span>
                            )}
                            <span className="text-[10px]" style={{ color: T.muted }}>{fmtWhen(a.ts)}</span>
                          </div>
                          <div className="text-[13px] leading-snug" style={{ color: T.inkSoft, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {a.text}
                          </div>
                        </div>
                        {annHistConfirm === a.id ? (
                          <button onClick={async () => { setAnnHistory(await onDeleteAnnHistoryItem(a.id)); setAnnHistConfirm(null); }}
                                  className="no-tap-highlight text-[10px] font-bold px-2 py-1.5 rounded-full active:scale-95 transition flex-shrink-0"
                                  style={{ background: T.error, color: '#FFF' }}>
                            Sure?
                          </button>
                        ) : (
                          <button onClick={() => { setAnnHistConfirm(a.id); setTimeout(() => setAnnHistConfirm(v => v === a.id ? null : v), 2500); }}
                                  aria-label="Delete this announcement from history"
                                  className="no-tap-highlight p-1.5 rounded-full active:bg-black/10 flex-shrink-0">
                            <Trash2 size={13} style={{ color: T.muted }} />
                          </button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =================== DETAIL VIEW: CRASH REPORTS (#29) ===================
  if (view === 'errors') {
    const unresolved = errs.filter(e => !e.resolved);
    const resolved = errs.filter(e => e.resolved);
    const shown = errFilter === 'all' ? errs : errFilter === 'resolved' ? resolved : unresolved;
    const filters = [
      { id: 'open', label: 'Open', count: unresolved.length },
      { id: 'resolved', label: 'Resolved', count: resolved.length },
      { id: 'all', label: 'All', count: errs.length },
    ];
    const sevColor = (s) => (s === 'crash' ? T.error : T.accent);
    return (
      <>
      <div className="anim-fadeup">
        <TopBar title="Crash reports" onBack={backToDash}
                right={
                  <button onClick={refreshErrs} disabled={errsLoading} aria-label="Refresh"
                          className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                    <RefreshCw size={18} style={{ color: T.muted }} className={errsLoading ? 'animate-spin' : ''} />
                  </button>
                } />
        <div className="max-w-md mx-auto px-4 pb-24 pt-2">
          <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
            Uncaught errors, promise rejections and render crashes from across the app, grouped by signature and newest first. The count is how many times each has happened. A re-occurrence reopens a resolved group.
          </div>

          {!errsLoading && errs.length > 0 && (
            <div className="flex gap-2 mb-4">
              {filters.map(f => {
                const active = errFilter === f.id;
                return (
                  <button key={f.id} onClick={() => setErrFilter(f.id)}
                          className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors active:scale-95"
                          style={{ background: active ? T.primary : T.surface, color: active ? '#FFF' : T.inkSoft,
                                   border: `1px solid ${active ? T.primary : T.border}` }}>
                    {f.label}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                          style={{ background: active ? 'rgba(255,255,255,0.22)' : T.surfaceWarm, color: active ? '#FFF' : T.muted }}>{f.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {errsLoading ? (
            <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
          ) : errs.length === 0 ? (
            <AdminEmpty icon={Check} accent={T.success} tone={T.success}
              title="No crashes recorded"
              what="Uncaught errors, promise rejections and render crashes from across the app, grouped by signature so you can fix the worst first."
              when="An empty list is the goal — nothing has thrown. If a crash happens anywhere, it lands here automatically with its stack and a hit count."
              collecting />
          ) : shown.length === 0 ? (
            <Card className="p-8 text-center">
              <Check size={28} className="mx-auto mb-3" style={{ color: T.success, opacity: 0.6 }} />
              <div className="font-display text-base mb-0.5" style={{ color: T.ink }}>{errFilter === 'open' ? 'All clear' : 'Nothing here'}</div>
              <div className="text-sm" style={{ color: T.muted }}>{errFilter === 'open' ? 'No open crashes — every group is resolved.' : 'No groups match this filter.'}</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {shown.map(e => {
                const isOpen = errOpen === e.sig;
                return (
                  <Card key={e.sig} className="p-3.5" style={e.resolved ? { opacity: 0.6 } : undefined}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{ background: sevColor(e.severity) + '1A', color: sevColor(e.severity) }}>
                        {e.severity === 'crash' ? 'Crash' : 'Error'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums font-semibold"
                            style={{ background: T.surfaceWarm, color: T.inkSoft }}>×{e.count}</span>
                      <span className="text-[10px]" style={{ color: T.muted }}>{e.source}</span>
                      <span className="text-[10px] ml-auto" style={{ color: T.muted }}>{fmtWhen(e.lastSeen)}</span>
                    </div>
                    <div className="text-[13px] font-medium break-words mb-1" style={{ color: T.ink }}>{e.message}</div>
                    <div className="text-[10px] mb-2" style={{ color: T.muted }}>
                      {e.lastScreen ? <>on <span style={{ color: T.inkSoft }}>{e.lastScreen}</span> · </> : null}
                      {e.stackTop || 'no stack'}
                    </div>
                    {isOpen && e.sampleStack && (
                      <pre className="text-[10px] leading-relaxed p-2.5 rounded-lg mb-2 overflow-x-auto whitespace-pre-wrap break-words"
                           style={{ background: T.bg, color: T.inkSoft, border: `1px solid ${T.borderSoft}`, maxHeight: 200 }}>{e.sampleStack}</pre>
                    )}
                    <div className="flex items-center gap-2">
                      {e.sampleStack && (
                        <button onClick={() => setErrOpen(isOpen ? null : e.sig)}
                                className="no-tap-highlight text-xs font-medium px-2.5 py-1.5 rounded-lg active:scale-95 transition"
                                style={{ background: T.surfaceWarm, color: T.inkSoft }}>
                          {isOpen ? 'Hide stack' : 'View stack'}
                        </button>
                      )}
                      <button onClick={() => resolveErr(e.sig, !e.resolved)}
                              className="no-tap-highlight text-xs font-medium px-2.5 py-1.5 rounded-lg active:scale-95 transition"
                              style={{ background: e.resolved ? T.surfaceWarm : T.success + '1A', color: e.resolved ? T.muted : T.success }}>
                        {e.resolved ? 'Reopen' : 'Resolve'}
                      </button>
                      <button onClick={() => setErrDelConfirm(e.sig)} aria-label="Delete group"
                              className="no-tap-highlight ml-auto p-1.5 rounded-lg active:scale-95 transition" style={{ color: T.muted }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog open={!!errDelConfirm}
                     title="Delete this crash group?"
                     body="Removes the grouped record for everyone. If it happens again it'll reappear as a new group."
                     confirmLabel="Delete" cancelLabel="Cancel" tone="danger"
                     onConfirm={() => deleteErr(errDelConfirm)} onCancel={() => setErrDelConfirm(null)} />
      </>
    );
  }

  // =================== DETAIL VIEW: BANK HEALTH (#24) ===================
  if (view === 'demand') {
    const riskColor = (r) => (r === 'high' ? T.error : r === 'watch' ? T.accent : T.success);
    const riskLabel = (r) => (r === 'high' ? 'Low supply' : r === 'watch' ? 'Watch' : 'Healthy');
    return (
      <div className="anim-fadeup">
        <TopBar title="Bank health" onBack={backToDash} feedback={{ screen: 'Admin · Bank health' }} />
        <div className="max-w-md mx-auto px-4 pb-24 pt-2">
          <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
            Supply (questions in each bank) vs demand (how heavily the exam tests that topic). Topics the exam emphasises but your bank is thin on get used up fastest — add questions there first. {demand.total} questions total.
          </div>

          {demand.highCount > 0 ? (
            <Card className="p-3.5 mb-4" style={{ background: T.error + '10', border: `1px solid ${T.error}40` }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} style={{ color: T.error }} />
                <div className="text-sm font-medium" style={{ color: T.error }}>
                  {demand.highCount} topic{demand.highCount === 1 ? '' : 's'} under-supplied for their exam weight
                </div>
              </div>
            </Card>
          ) : demand.rows.length > 0 ? (
            <Card className="p-3.5 mb-4" style={{ background: T.success + '10', border: `1px solid ${T.success}40` }}>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} style={{ color: T.success }} />
                <div className="text-sm font-medium" style={{ color: T.success }}>
                  Every topic is well-supplied for its exam weight
                </div>
              </div>
            </Card>
          ) : null}

          {demand.rows.length === 0 ? (
            <AdminEmpty icon={Layers} accent={T.primary}
              title="No questions in the pool yet"
              what="A supply-vs-demand map of every topic — how many questions you have against how heavily the exam tests it, so you know where to write next."
              when="It appears once a question bank is loaded. Upload or add a bank from the Banks section to begin." />
          ) : (
          <div className="space-y-2.5">
            {demand.rows.map(r => {
              const supplyPct = Math.round(r.supplyShare * 100);
              const demandPct = Math.round(r.w);
              return (
                <Card key={r.id} className="p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: T.ink }}>{r.name}</div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: riskColor(r.risk) + '1A', color: riskColor(r.risk) }}>{riskLabel(r.risk)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] mb-2" style={{ color: T.muted }}>
                    <span><span className="font-semibold tabular-nums" style={{ color: T.inkSoft }}>{r.size}</span> questions</span>
                    <span>·</span>
                    <span>exam weight <span className="font-semibold tabular-nums" style={{ color: T.inkSoft }}>{demandPct}%</span></span>
                  </div>
                  {/* supply (have) vs demand (need) bars */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] w-12 flex-shrink-0" style={{ color: T.muted }}>supply</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.surfaceWarm }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(supplyPct * 3, 100)}%`, background: T.primary }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] w-12 flex-shrink-0" style={{ color: T.muted }}>demand</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.surfaceWarm }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(demandPct * 3, 100)}%`, background: riskColor(r.risk) }} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          )}
        </div>
      </div>
    );
  }

  // =================== DETAIL VIEW: MANAGE ADMINS ===================
  if (view === 'manageAdmins') {
    return <AdminManager onBack={backToDash} />;
  }

  if (view === 'faq') {
    return <AdminFaqManager onBack={backToDash} />;
  }

  if (view === 'content-review') {
    return <ContentReview onBack={backToDash} profile={profile} />;
  }

  if (view === 'storage-check') {
    return <AdminStorageCheck onBack={backToDash} />;
  }

  // =================== DASHBOARD HOME (tiles only) ===================
  return (
    <div className="anim-fadeup">
      {/* Issues round — the in-app back goes through the same leave
          confirmation as the device back, so the two always mirror. */}
      <TopBar title="Admin" onBack={() => setLeaveConfirm(true)}
              right={
                <button onClick={onLockAdmin}
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5"
                        aria-label="Lock admin">
                  <Lock size={18} style={{ color: T.muted }} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-24 pt-3">
        {/* #19 — at-a-glance summary band. The numbers that need attention,
            before the section tiles. */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: 'Users', value: usersLoading ? '—' : totalUsers, tone: T.ink },
            { label: openFeedback === 1 ? 'Open report' : 'Open reports', value: feedbackLoading ? '—' : openFeedback, tone: openFeedback > 0 ? T.accent : T.success },
            { label: demand.highCount === 1 ? 'Bank alert' : 'Bank alerts', value: demand.highCount, tone: demand.highCount > 0 ? T.error : T.success },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl p-3 text-center" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
              <div className="font-display text-2xl font-semibold tabular-nums leading-none" style={{ color: s.tone }}>{s.value}</div>
              <div className="text-[10px] mt-1" style={{ color: T.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">

          {/* Feedback — N new badge */}
          <AdminTile
            icon={<AlertCircle size={22} style={{ color: T.accent }} />}
            accent={T.accent}
            label="Feedback"
            hint="Reports & ideas"
            onClick={() => setView('feedback')}
            signal={
              feedbackLoading
                ? <span className="text-sm" style={{ color: T.muted }}>—</span>
                : totalFeedback > 0
                  ? <span className="px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                          style={{ background: T.accent, color: '#FFF' }}>{totalFeedback} new</span>
                  : <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: T.success }}>
                      <Check size={13} /> Clear
                    </span>
            } />

          {/* Upload bank — straight to creating a bank */}
          <AdminTile
            icon={<Upload size={22} style={{ color: T.primary }} />}
            accent={T.primary}
            label="Upload bank"
            hint="Create a new bank"
            onClick={onCreateBank}
            signal={<Plus size={18} style={{ color: T.muted }} />} />

          {/* Banks — total count; manage/edit/delete inside */}
          <AdminTile
            icon={<Layers size={22} style={{ color: T.sec.library }} />}
            accent={T.sec.library}
            label="Banks"
            hint="Manage · edit · delete"
            onClick={onOpenLibrary}
            signal={bigCount(totalBanks, banksLoading)} />

          {/* Users — total count; overview inside */}
          <AdminTile
            icon={<User size={22} style={{ color: T.primary }} />}
            accent={T.primary}
            label="Users"
            hint="Overview"
            onClick={() => setView('users')}
            signal={bigCount(totalUsers, usersLoading)} />

          {/* Growth & Referrals — word-of-mouth intelligence (Phase 2) */}
          <AdminTile
            icon={<TrendingUp size={22} style={{ color: T.success }} />}
            accent={T.success}
            label="Growth"
            hint="Referrals & channels"
            onClick={() => { setView('growth'); refreshGrowth(); }}
            signal={<TrendingUp size={18} style={{ color: T.muted }} />} />

          {/* P8 — Helpfulness Insights: which explanations users rate */}
          <AdminTile
            icon={<Lightbulb size={22} style={{ color: T.accent }} />}
            accent={T.accent}
            label="Helpfulness"
            hint="Explanation ratings"
            onClick={() => { setView('helpfulness'); refreshHelpful(); }}
            signal={<Lightbulb size={18} style={{ color: T.muted }} />} />

          {/* #24 — Bank health: per-topic supply vs exam demand */}
          <AdminTile
            icon={<Layers size={22} style={{ color: T.sec.mock }} />}
            accent={T.sec.mock}
            label="Bank health"
            hint="Supply vs exam demand"
            onClick={() => setView('demand')}
            signal={demand.highCount > 0
              ? <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ background: T.error, color: '#FFF' }}>{demand.highCount}</span>
              : <Layers size={18} style={{ color: T.muted }} />} />

          {/* #29 — Crash reports: grouped client errors + render crashes */}
          <AdminTile
            icon={<AlertTriangle size={22} style={{ color: T.error }} />}
            accent={T.error}
            label="Crash reports"
            hint="Errors & crashes"
            onClick={() => { setView('errors'); refreshErrs(); }}
            signal={<AlertTriangle size={18} style={{ color: T.muted }} />} />

          {/* Manage admins — add/remove who has admin access */}
          <AdminTile
            icon={<ShieldCheck size={22} style={{ color: T.primary }} />}
            accent={T.primary}
            label="Manage admins"
            hint="Add / remove admins"
            onClick={() => setView('manageAdmins')}
            signal={<ShieldCheck size={18} style={{ color: T.muted }} />} />

          {/* AI content pipeline — review/approve drafted questions from questions_staging */}
          <AdminTile
            icon={<Sparkles size={22} style={{ color: T.primary }} />}
            accent={T.primary}
            label="Content Review"
            hint="Approve AI-drafted questions"
            onClick={() => setView('content-review')}
            signal={<Sparkles size={18} style={{ color: T.muted }} />} />

          {/* Storage self-test — verify admin content is readable by the app
              (catches the RLS/broker "saved but invisible" class in one tap) */}
          <AdminTile
            icon={<Database size={22} style={{ color: T.sec.revision }} />}
            accent={T.sec.revision}
            label="Storage self-test"
            hint="Verify content is readable"
            onClick={() => setView('storage-check')}
            signal={<Database size={18} style={{ color: T.muted }} />} />

          {/* F-F — author / edit FAQs (community replies happen on the FAQ screen) */}
          <AdminTile
            icon={<HelpCircle size={22} style={{ color: T.accent }} />}
            accent={T.accent}
            label="FAQ manager"
            hint="Add, edit & order FAQs"
            onClick={() => setView('faq')}
            signal={<HelpCircle size={18} style={{ color: T.muted }} />} />

          {/* Announcement — post a notice to everyone */}
          <AdminTile
            wide
            icon={<Flag size={22} style={{ color: T.sec.revision }} />}
            accent={T.sec.revision}
            label="Announcement"
            hint={
              announcement
                ? `${announcement.level === 'important' ? '⚠ ' : ''}"${announcement.text.length > 60 ? announcement.text.slice(0, 60).trim() + '…' : announcement.text}"`
                : 'Post a notice to everyone'
            }
            onClick={() => { setView('announcement'); if (onLoadAnnHistory) onLoadAnnHistory().then(setAnnHistory).catch(() => {}); }}
            signal={
              announcement
                ? <span className="px-2 py-1 rounded-full text-xs font-bold"
                        style={{
                          background: announcement.level === 'important' ? T.accent : T.success,
                          color: '#FFF'
                        }}>
                    {announcement.level === 'important' ? 'Important' : 'Live'}
                  </span>
                : <span className="text-xs font-medium" style={{ color: T.muted }}>None</span>
            } />
        </div>
      </div>
      {/* Leave-confirmation for the device back button (issues round) */}
      <ConfirmDialog open={leaveConfirm}
                     title="Leave Admin Panel?"
                     body="Any unsaved changes will be lost."
                     confirmLabel="Leave" cancelLabel="Stay" tone="danger"
                     onConfirm={confirmLeave}
                     onCancel={() => setLeaveConfirm(false)} />
    </div>
  );
}

export default AdminPanel;
