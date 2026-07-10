// =====================================================================
// src/screens/library.jsx — Question Bank Library (list) + VisibilityPill
// Extracted from App.jsx (A1 batch 1b, slice 11), then REVAMPED (UX round
// 2026-07-10): banks are curated by the team and only admins upload, so
// ownership filters (Mine / From others) mean nothing to a student. The
// student view now filters and badges by what she actually cares about:
// is this bank IN MY PRACTICE right now?
//   · In use            imported + active (green accent bar + chip)
//   · Update available  imported, but the bank moved on (amber)
//   · Paused            imported, toggled off on the bank page (grey)
//   · Not added         browsable, one tap away (dashed "Add" chip)
// The ADMIN app also renders this list (browse → edit); it keeps the old
// ownership chips + visibility pills, since that's what an editor needs.
// `profileId` stays a prop; import state comes from data.customQuestions
// (same sourceBank/sourceBankVersion contract as App's bank-detail route).
// =====================================================================
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, ChevronRight, RefreshCw, Layers, EyeOff, Eye, PenLine, Target, Check, Pause } from 'lucide-react';
import { useTheme, useProfile, useData } from '../lib/app-context.jsx';
import { bankVisibility, isBankOwner } from '../lib/banks.js';
import { Card, TopBar } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';

function VisibilityPill({ bank }) {
  const { theme: T } = useTheme();
  const priv = bankVisibility(bank) === 'private';
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{ background: priv ? T.accent + '18' : T.success + '18', color: priv ? T.accent : T.success }}>
      {priv ? <EyeOff size={10} /> : <Eye size={10} />}
      {priv ? 'Private' : 'Public'}
    </span>
  );
}

// One glanceable chip per practice status (student view).
function StatusChip({ status }) {
  const { theme: T } = useTheme();
  if (status === 'inuse') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
          style={{ background: T.success + '18', color: T.success }}>
      <Check size={10} /> In use
    </span>
  );
  if (status === 'update') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
          style={{ background: T.accent + '18', color: T.accent }}>
      <RefreshCw size={10} /> Update available
    </span>
  );
  if (status === 'paused') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
          style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>
      <Pause size={10} /> Paused
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
          style={{ background: 'transparent', color: T.muted, border: `1px dashed ${T.border}` }}>
      <Plus size={10} /> Not added
    </span>
  );
}

function Library({ banks, profileId, loading, onRefresh, onOpen, onCreateNew, onBack, disabledBanks }) {
  const { theme: T } = useTheme();
  const { isAdmin } = useProfile();
  // Issues round — the Custom-questions + Total-practice counters moved here
  // from Settings (this is where question content lives).
  const { data } = useData();
  const [filter, setFilter] = useState('all');

  // bankId → { count, version } of what the user has imported from it.
  const importStatus = useMemo(() => {
    const map = {};
    (data.customQuestions || []).forEach(q => {
      if (!q.sourceBank) return;
      const m = map[q.sourceBank] || (map[q.sourceBank] = { count: 0, version: 0 });
      m.count++;
      if ((q.sourceBankVersion || 0) > m.version) m.version = q.sourceBankVersion || 0;
    });
    return map;
  }, [data.customQuestions]);

  const statusOf = (b) => {
    const imp = importStatus[b.id];
    if (!imp) return 'new';
    if (disabledBanks && disabledBanks[b.id]) return 'paused';
    if (imp.version && imp.version < b.version) return 'update';
    return 'inuse';
  };

  // Student chips answer "what's in my practice?"; admin chips (the admin
  // app reuses this list as its browse-to-edit index) keep ownership.
  const CHIP_SETS = {
    student: [
      { id: 'all',   label: 'All' },
      { id: 'inuse', label: 'In my practice' },
      { id: 'new',   label: 'Not added' },
    ],
    admin: [
      { id: 'all',    label: 'All' },
      { id: 'mine',   label: 'Mine' },
      { id: 'others', label: 'From others' },
    ],
  };
  const chips = isAdmin ? CHIP_SETS.admin : CHIP_SETS.student;

  const matches = (b, f) => {
    if (f === 'mine')   return isBankOwner(b, profileId);
    if (f === 'others') return !isBankOwner(b, profileId);
    if (f === 'inuse')  return statusOf(b) !== 'new';       // in practice, incl. paused / needs update
    if (f === 'new')    return statusOf(b) === 'new';
    return true;
  };

  const counts = useMemo(() => {
    const c = {};
    chips.forEach(ch => { c[ch.id] = banks.filter(b => matches(b, ch.id)).length; });
    return c;
  }, [banks, profileId, importStatus, disabledBanks, isAdmin]);

  const visibleBanks = useMemo(
    () => banks.filter(b => matches(b, filter)),
    [banks, profileId, filter, importStatus, disabledBanks]);

  // #26/1.4 — enrich the count label with the total question count.
  const totalQs = useMemo(() => visibleBanks.reduce((a, b) => a + ((b.questions && b.questions.length) || 0), 0), [visibleBanks]);

  // #26/1.2 — sliding-pill filter chips: the active background physically
  // travels (left + width morph, spring curve) instead of swapping colour.
  const chipRefs = useRef({});
  const [pill, setPill] = useState(null); // { left, width }
  useEffect(() => {
    const el = chipRefs.current[filter];
    if (!el) { setPill(null); return; }
    const measure = () => setPill({ left: el.offsetLeft, width: el.offsetWidth });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [filter, banks.length]);

  return (
    <div className="anim-fadeup">
      <TopBar title="Question Bank Library" onBack={onBack}
              feedback={{ screen: "Library" }} />
      <PageContainer size="content" className="pb-24 pt-2">

        {/* Uploading a bank is ADMIN ONLY now (content authority) — the upload
            card is shown to admins only; everyone else browses + imports.
            #26/1.1 — app-gradient card, warmer copy, single shimmer sweep. */}
        {isAdmin && (
        <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable relative overflow-hidden" onClick={onCreateNew}
              style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primarySoft})`, border: 'none', borderRadius: 14 }}>
          <div className="card-shimmer absolute inset-y-0 w-16 pointer-events-none"
               style={{ background: 'rgba(255,255,255,0.18)' }} aria-hidden="true" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.18)' }}>
              <Plus size={18} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-semibold mb-0.5" style={{ color: '#FFF' }}>Upload a new bank</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Share with the community or keep it just for you
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
          </div>
        </Card>
        )}

        {/* Your numbers — moved from Settings (issues round): structured,
            consistently-styled stat tiles that belong with the question
            content they describe. */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Card className="p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
                <PenLine size={14} style={{ color: T.primary }} />
              </div>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Custom questions</div>
            </div>
            <div className="font-display text-xl font-semibold leading-none" style={{ color: T.ink }}>{(data.customQuestions || []).length}</div>
            <div className="text-[10px] mt-1" style={{ color: T.muted }}>written by you</div>
          </Card>
          <Card className="p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.success + '18' }}>
                <Target size={14} style={{ color: T.success }} />
              </div>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Total practice</div>
            </div>
            <div className="font-display text-xl font-semibold leading-none" style={{ color: T.ink }}>{(data.stats && data.stats.totalAttempted) || 0}</div>
            <div className="text-[10px] mt-1" style={{ color: T.muted }}>questions answered</div>
          </Card>
        </div>

        <div className="text-xs mb-4 leading-relaxed px-1" style={{ color: T.muted }}>
          {isAdmin
            ? 'Browse banks and import them into your own practice. As admin you can upload banks and edit, delete, or change the visibility of any of them.'
            : 'Question banks curated by the team. Open one to preview it and add it to your practice: its questions then appear in Quick test, topics, and stats.'}
        </div>

        {/* Filter chips — a sliding active pill travels between chips (left +
            width morph, spring). Students filter by practice status; the
            admin app keeps ownership chips. */}
        {banks.length > 1 && (
          <div className="relative flex gap-2 mb-3">
            {pill && (
              <div className="absolute top-0 bottom-0 rounded-full pointer-events-none"
                   style={{
                     left: pill.left, width: pill.width,
                     background: T.primary,
                     transition: 'left 0.32s cubic-bezier(0.34,1.56,0.64,1), width 0.32s cubic-bezier(0.34,1.56,0.64,1)',
                   }} aria-hidden="true" />
            )}
            {chips.map(opt => {
              const active = filter === opt.id;
              return (
                <button key={opt.id} onClick={() => setFilter(opt.id)}
                        ref={el => { chipRefs.current[opt.id] = el; }}
                        className="no-tap-highlight relative px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0"
                        style={{
                          background: active ? 'transparent' : T.surface,
                          color: active ? '#FFF' : T.inkSoft,
                          border: `1px solid ${active ? 'transparent' : T.border}`,
                          transition: 'color 0.25s',
                        }}>
                  {opt.label} <span style={{ opacity: 0.7 }}>· {counts[opt.id]}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Header row — count label + refresh. #26/1.4 — the label carries the
            total question count across the visible banks. */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
            {banks.length > 0
              ? `${visibleBanks.length} bank${visibleBanks.length === 1 ? '' : 's'}${totalQs > 0 ? ` · ${totalQs} questions` : ''}`
              : 'Available banks'}
          </div>
          <button onClick={onRefresh} disabled={loading}
                  className="no-tap-highlight inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-50"
                  style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}
                  aria-label="Refresh bank list">
            <RefreshCw size={14} style={{ color: T.muted }} className={loading ? 'animate-spin' : ''} />
            <span className="text-xs font-medium">Refresh</span>
          </button>
        </div>

        {loading && banks.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin" style={{ color: T.muted, opacity: 0.5 }} />
            <div className="text-sm" style={{ color: T.muted }}>Loading banks…</div>
          </div>
        ) : banks.length === 0 ? (
          <div className="text-center py-12">
            <Layers size={40} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>No banks yet</div>
            <div className="text-sm" style={{ color: T.muted }}>{isAdmin ? 'Upload the first one above.' : 'Check back soon: the team is adding banks.'}</div>
          </div>
        ) : visibleBanks.length === 0 ? (
          /* Banks exist but the current filter rules them all out. */
          <div className="text-center py-10">
            <Layers size={32} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="text-sm mb-3" style={{ color: T.muted }}>
              {filter === 'mine' ? "You haven't uploaded any banks yet."
                : filter === 'others' ? 'No banks from other users yet.'
                : filter === 'inuse' ? "Nothing in your practice yet. Open a bank and tap Add to practice."
                : "You've added every bank. Nothing new right now."}
            </div>
            <button onClick={() => setFilter('all')}
                    className="no-tap-highlight text-xs font-medium underline"
                    style={{ color: T.primary }}>
              Show all banks
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-2.5 md:items-start">
            {visibleBanks.map((b, bi) => {
              const date = b.updatedAt ? new Date(b.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
              const mine = isBankOwner(b, profileId);
              const owner = mine ? 'You' : (b.ownerName || 'Admin');
              const priv = bankVisibility(b) === 'private';
              const status = statusOf(b);
              const imp = importStatus[b.id];
              /* Accent bar speaks PRACTICE STATUS for students (green = in
                 use, amber = update available, grey otherwise); the admin
                 list keeps the old public/private encoding. */
              const bar = isAdmin
                ? (priv ? T.border : T.success)
                : (status === 'inuse' ? T.success : status === 'update' ? T.accent : T.border);
              return (
                <Card key={b.id} className="p-4 seq-item" onClick={() => onOpen(b.id)}
                      style={{ borderLeft: `3px solid ${bar}`, animationDelay: `${Math.min(bi, 8) * 110}ms` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="font-display text-base font-semibold truncate" style={{ color: T.ink }}>{b.name}</div>
                        {isAdmin && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                style={{ background: T.primary + '15', color: T.primary }}>v{b.version}</span>
                        )}
                        {isAdmin ? <VisibilityPill bank={b} /> : <StatusChip status={status} />}
                      </div>
                      <div className="text-xs leading-relaxed flex items-center gap-1.5 flex-wrap" style={{ color: T.muted }}>
                        <span className="font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: T.surfaceWarm, color: T.inkSoft }}>
                          {b.questions.length} question{b.questions.length === 1 ? '' : 's'}
                        </span>
                        {isAdmin && <span>by {owner}</span>}
                        {date && <span>{isAdmin ? '· ' : ''}updated {date}</span>}
                        {!isAdmin && status === 'update' && imp && (
                          <span style={{ color: T.accent, fontWeight: 600 }}>· you have v{imp.version}, v{b.version} is out</span>
                        )}
                      </div>
                      {b.description && (
                        <div className="text-xs mt-1.5 leading-snug" style={{ color: T.inkSoft }}>{b.description}</div>
                      )}
                    </div>
                    <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0 mt-1" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </PageContainer>
    </div>
  );
}

export default Library;
