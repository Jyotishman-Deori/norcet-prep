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
import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, Check, EyeOff, Flag, Layers, Lightbulb, Lock, Plus,
  RefreshCw, Send, ShieldCheck, Trash2, Upload, User
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Pill, Card, Button, TopBar } from '../ui/primitives.jsx';
import AdminTile from '../ui/admin-tile.jsx';
import AdminManager from '../ui/admin-manager.jsx';
import AdminFeedbackCard from '../ui/admin-feedback-card.jsx';
import ReportedQuestionModal from './reported-question-modal.jsx';
import { listFeedback, deleteFeedback, updateFeedback } from '../lib/feedback.js';
import { loadHelpfulnessReport } from '../lib/helpful-votes.js';
import { fmtWhen } from '../lib/format.js';
import { topicName } from '../lib/topics.js';

function AdminPanel({
  profile, banks, banksLoading,
  announcement, onSaveAnnouncement, onClearAnnouncement,
  onRefreshBanks, onOpenLibrary, onCreateBank,
  onLockAdmin, onBack, allQuestions = [],
  onListUsers, onDeleteProfile
}) {
  const { theme: T } = useTheme();
  // Which screen we're on: the tile dashboard, or one detail view a level deeper.
  const [view, setView] = useState('dashboard');

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [feedback, setFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  const [annText, setAnnText] = useState(announcement?.text || '');
  const [annLevel, setAnnLevel] = useState(announcement?.level === 'important' ? 'important' : 'info');
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
      await onSaveAnnouncement(annText.trim(), annLevel);
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
                <div className="text-[10px] mt-1.5" style={{ color: T.muted }}>Posted {fmtWhen(announcement.ts)}</div>
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
        </div>
      </div>
    );
  }

  // =================== DETAIL VIEW: MANAGE ADMINS ===================
  if (view === 'manageAdmins') {
    return <AdminManager onBack={backToDash} />;
  }

  // =================== DASHBOARD HOME (tiles only) ===================
  return (
    <div className="anim-fadeup">
      <TopBar title="Admin" onBack={onBack}
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

          {/* Manage admins — add/remove who has admin access */}
          <AdminTile
            icon={<ShieldCheck size={22} style={{ color: T.primary }} />}
            accent={T.primary}
            label="Manage admins"
            hint="Add / remove admins"
            onClick={() => setView('manageAdmins')}
            signal={<ShieldCheck size={18} style={{ color: T.muted }} />} />

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
            onClick={() => setView('announcement')}
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
    </div>
  );
}

export default AdminPanel;
