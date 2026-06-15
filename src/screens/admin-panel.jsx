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
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertCircle, Check, EyeOff, Flag, HelpCircle, Layers, Lightbulb, Lock, Plus,
  RefreshCw, Send, ShieldCheck, Trash2, Upload, User
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Pill, Card, Button, TopBar } from '../ui/primitives.jsx';
import AdminTile from '../ui/admin-tile.jsx';
import ConfirmDialog from '../ui/confirm-dialog.jsx';
import AdminManager from '../ui/admin-manager.jsx';
import AdminFaqManager from '../ui/admin-faq-manager.jsx';
import AdminFeedbackCard from '../ui/admin-feedback-card.jsx';
import ReportedQuestionModal from './reported-question-modal.jsx';
import { listFeedback, deleteFeedback, updateFeedback } from '../lib/feedback.js';
import { loadHelpfulnessReport } from '../lib/helpful-votes.js';
// FAV — Favourites insights: hearts + average priority rank per section.
import { loadFavInsights } from '../lib/favorites.js';
import { FavIcon } from '../ui/fav-icons.jsx';
import { Heart } from 'lucide-react';
import { fmtWhen } from '../lib/format.js';
import { topicName } from '../lib/topics.js';

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
  const [fbFilter, setFbFilter] = useState('open');   // 'all' | 'open' | 'resolved'
  const [peekId, setPeekId] = useState(null);          // reported question being viewed

  // P8 — Helpfulness Insights
  const [helpful, setHelpful] = useState([]);
  const [helpfulLoading, setHelpfulLoading] = useState(true);
  const [helpfulSort, setHelpfulSort] = useState('notHelpful'); // 'helpful'|'notHelpful'|'ratio'
  const [helpfulOpen, setHelpfulOpen] = useState(null);          // expanded row id
  const refreshHelpful = useCallback(async () => {
    setHelpfulLoading(true);
    const rows = await loadHelpfulnessReport(allQuestions);
    setHelpful(rows);
    setHelpfulLoading(false);
  }, [allQuestions]);

  // FAV — Favourites insights
  const [favIns, setFavIns] = useState({ rows: [], users: 0 });
  const [favInsLoading, setFavInsLoading] = useState(true);
  const refreshFavIns = useCallback(async () => {
    setFavInsLoading(true);
    try { setFavIns(await loadFavInsights()); } catch (e) {}
    setFavInsLoading(false);
  }, []);

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    const list = await onListUsers();
    setUsers(list);
    setUsersLoading(false);
  }, []);

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

  // Keep the editor in sync if the announcement changes elsewhere
  useEffect(() => {
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
    try {
      await onClearAnnouncement();
      setAnnText('');
      setAnnMsg({ ok: true, text: 'Announcement cleared.' });
    } catch (e) {
      setAnnMsg({ ok: false, text: 'Could not clear — server rejected the write (are you online and using the admin profile?).' });
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

  const backToDash = () => setView('dashboard');

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
    return (
      <div className="anim-fadeup">
        <TopBar title="Helpfulness" onBack={backToDash}
                right={
                  <button onClick={refreshHelpful} disabled={helpfulLoading} aria-label="Refresh"
                          className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                    <RefreshCw size={18} style={{ color: T.muted }} className={helpfulLoading ? 'animate-spin' : ''} />
                  </button>
                } />
        <div className="max-w-md mx-auto px-4 pb-24 pt-2">
          <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
            How users rate explanations. Only questions with at least one response appear — silent users are intentionally excluded. A high <span style={{ color: T.error, fontWeight: 600 }}>✕</span> count flags an explanation worth rewriting. Tap a row to read the full question and explanation.
          </div>

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

          {helpfulLoading ? (
            <div className="text-center text-sm py-10" style={{ color: T.muted }}>Loading…</div>
          ) : sorted.length === 0 ? (
            <Card className="p-6 text-center" style={{ background: T.surfaceWarm }}>
              <Lightbulb size={32} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.4 }} />
              <div className="text-sm" style={{ color: T.muted }}>No feedback yet. Once users start rating explanations, they'll show up here.</div>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {sorted.map(r => {
                const open = helpfulOpen === r.id;
                return (
                  <Card key={r.id} className="p-3.5 cursor-pointer no-tap-highlight pressable"
                        onClick={() => setHelpfulOpen(open ? null : r.id)}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm" style={{ color: T.ink, ...(open ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
                          {r.stem}
                        </div>
                        {r.topic && <div className="text-[11px] mt-1" style={{ color: T.muted }}>{topicName(r.topic)}{!r.found ? ' · not in pool' : ''}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold" style={{ color: T.success }}>✓ {r.helpful}</span>
                        <span className="text-xs font-semibold" style={{ color: T.error }}>✕ {r.notHelpful}</span>
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

  // FAV — Favourites insights: which sections users love (hearts), how they
  // rank them (avg priority), and which aren't attracting anyone (0 hearts,
  // shown dimmed on purpose — that's the "needs work" signal).
  if (view === 'favourites') {
    const maxHearts = Math.max(1, ...favIns.rows.map(r => r.hearts));
    return (
      <div className="anim-fadeup">
        <TopBar title="Favourites insights" onBack={backToDash}
                right={
                  <button onClick={refreshFavIns} disabled={favInsLoading} aria-label="Refresh"
                          className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                    <RefreshCw size={18} style={{ color: T.muted }} className={favInsLoading ? 'animate-spin' : ''} />
                  </button>
                } />
        <div className="max-w-md mx-auto px-4 pb-24 pt-2">
          <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
            Which sections users heart, and where they place them in their priority order.
            High hearts + low avg rank = a hit feature worth doubling down on.
            Zero hearts (dimmed) = a section that isn't attracting users — candidates for improvement or better discovery.
            Guests are excluded; counts reflect CURRENT hearts (un-hearting removes it).
          </div>
          <Card className="p-3 mb-3" style={{ background: '#E0245E10', border: '1px solid #E0245E30' }}>
            <div className="text-[13px]" style={{ color: T.ink }}>
              <span className="font-semibold" style={{ color: '#E0245E' }}>{favIns.users}</span> user{favIns.users === 1 ? '' : 's'} with at least one favourite
            </div>
          </Card>
          {favInsLoading ? (
            <div className="text-center text-sm py-10" style={{ color: T.muted }}>Loading…</div>
          ) : (
            <div className="space-y-2">
              {favIns.rows.map(r => (
                <Card key={r.id} className="p-3.5" style={{ opacity: r.hearts === 0 ? 0.55 : 1 }}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                         style={{ background: r.hue + '20' }}>
                      <FavIcon name={r.icon} size={15} color={r.hue} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate" style={{ color: T.ink }}>{r.label}</div>
                      <div className="text-[11px]" style={{ color: T.muted }}>
                        {r.hearts === 0
                          ? 'No hearts yet — not attracting users'
                          : <>avg priority <span className="font-semibold" style={{ color: T.inkSoft }}>#{r.avgRank ? r.avgRank.toFixed(1) : '—'}</span>{r.top3 > 0 ? <> · in a top-3 for {r.top3}</> : null}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Heart size={12} fill={r.hearts > 0 ? '#E0245E' : 'none'} style={{ color: '#E0245E' }} />
                      <span className="text-sm font-semibold tabular-nums" style={{ color: r.hearts > 0 ? T.ink : T.muted }}>{r.hearts}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: T.borderSoft }}>
                    <div className="h-1.5 rounded-full transition-all duration-500"
                         style={{ background: r.hue, width: `${Math.round((r.hearts / maxHearts) * 100)}%` }} />
                  </div>
                </Card>
              ))}
            </div>
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
            <Card className="p-8 text-center">
              <AlertCircle size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
              <div className="font-display text-lg mb-0.5" style={{ color: T.ink }}>No reports yet</div>
              <div className="text-sm" style={{ color: T.muted }}>Users can tap the report icon on any screen.</div>
            </Card>
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
            <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>No profiles yet.</div></Card>
          ) : (
            <div className="space-y-2">
              {users.map(u => {
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
                <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: T.ink }}>{announcement.text}</div>
                <div className="text-[10px] mt-1.5" style={{ color: T.muted }}>
                  Posted {fmtWhen(announcement.ts)}
                  {announcement.expiresAt
                    ? ` · auto-expires in ${Math.max(0, Math.ceil((announcement.expiresAt - Date.now()) / 86400000))} day(s)`
                    : ' · stays until cleared'}
                </div>
              </div>
            )}
            <textarea value={annText} onChange={e => { setAnnText(e.target.value); setAnnMsg(null); }}
                      placeholder="e.g. New Pharmacology bank added — give it a try!" rows={3} maxLength={280}
                      className="w-full rounded-xl px-3 py-3 mb-2 text-sm resize-none"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
            <div className="text-[10px] mb-3 text-right" style={{ color: T.muted }}>{annText.length}/280</div>

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
                        icon={<Trash2 size={14} />}>Clear</Button>
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

  // =================== DETAIL VIEW: MANAGE ADMINS ===================
  if (view === 'manageAdmins') {
    return <AdminManager onBack={backToDash} />;
  }

  if (view === 'faq') {
    return <AdminFaqManager onBack={backToDash} />;
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

          {/* P8 — Helpfulness Insights: which explanations users rate */}
          <AdminTile
            icon={<Lightbulb size={22} style={{ color: T.accent }} />}
            accent={T.accent}
            label="Helpfulness"
            hint="Explanation ratings"
            onClick={() => { setView('helpfulness'); refreshHelpful(); }}
            signal={<Lightbulb size={18} style={{ color: T.muted }} />} />

          {/* FAV — Favourites insights: section popularity + priority ranks */}
          <AdminTile
            icon={<Heart size={22} style={{ color: '#E0245E' }} />}
            accent={'#E0245E'}
            label="Favourites"
            hint="Section popularity"
            onClick={() => { setView('favourites'); refreshFavIns(); }}
            signal={<Heart size={18} style={{ color: T.muted }} />} />

          {/* Manage admins — add/remove who has admin access */}
          <AdminTile
            icon={<ShieldCheck size={22} style={{ color: T.primary }} />}
            accent={T.primary}
            label="Manage admins"
            hint="Add / remove admins"
            onClick={() => setView('manageAdmins')}
            signal={<ShieldCheck size={18} style={{ color: T.muted }} />} />

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
