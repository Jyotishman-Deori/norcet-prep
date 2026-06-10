// =====================================================================
// NAV DRAWER  (Pipeline step 38 / A1 session 4 — extracted from App.jsx)
// The slide-in navigation menu (opened from the Home Menu button).
//
// #8 Sidebar Revamp — restructured into FIVE clearly-defined groups, same
// row/icon/chevron visual language as before:
//   Study     — Revision, Library, Bookmarks, My Doubts, Add Question
//   Progress  — Stats, Leaderboard, Exam Weightage
//   Tools     — Exam Date, Reference
//   Help&Learn— Study Methods + FAQ, shown as elevated CARDS (richer
//               destinations), not plain rows
//   Settings  — standalone, always at the very bottom
// My Doubts is kept in Study (spec rule: reorganise, never remove an
// existing item — the spec's lists predate the F-E Doubts feature).
// FAQ card is badge-ready via the optional `faqUnread` prop (default 0).
//
// [A7] theme via useTheme(), bookmarks count via useData().
// open/onClose/onNavigate stay props.
// =====================================================================
import React, { useEffect, useRef } from 'react';
import { Activity, BarChart3, Bookmark, CalendarDays, ChevronRight, FileText, Flag, FlaskConical, GraduationCap, Layers, MessagesSquare, Plus, Settings as SettingsIcon, Trophy, X } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';

function NavDrawer({ open, onClose, onNavigate, faqUnread = 0 }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const panelRef = useRef(null);
  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // The panel stays mounted (it slides off-screen), so its internal scroll
  // position would otherwise persist between opens — making the menu appear
  // to "open from the middle". Always start from the top.
  useEffect(() => {
    if (open && panelRef.current) panelRef.current.scrollTop = 0;
  }, [open]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const go = (screen, extra) => { onClose(); onNavigate(extra ? { screen, ...extra } : { screen }); };

  // ---- Category 1 — Study ----
  const study = [
    { key: 'revision',  icon: FileText,    color: T.sec.revision, label: 'Revision',  sub: 'High-yield digest',              action: () => go('revision-sheet') },
    { key: 'library',   icon: Layers,      color: T.sec.library,  label: 'Library',   sub: 'Question banks',                 action: () => go('library') },
    { key: 'bookmarks', icon: Bookmark,    color: T.accent,       label: 'Bookmarks', sub: `${data.bookmarks.length} saved`,  action: () => go('bookmarks-view') },
    { key: 'doubts',    icon: Flag,        color: T.error,        label: 'My Doubts', sub: 'Points you flagged to revisit',  action: () => go('doubts') },
    { key: 'addq',      icon: Plus,        color: T.primary,      label: 'Add question', sub: 'Your own custom Qs',          action: () => go('add-question') },
  ];
  // ---- Category 2 — Progress ----
  const progress = [
    { key: 'stats',       icon: BarChart3, color: T.sec.stats, label: 'Stats',          sub: 'Progress by topic',          action: () => go('stats') },
    { key: 'leaderboard', icon: Trophy,    color: T.accent,    label: 'Leaderboard',    sub: 'Compare with other users',   action: () => go('leaderboard') },
    { key: 'weightage',   icon: Activity,  color: T.primary,   label: 'Exam weightage', sub: 'What the exam tests most',    action: () => go('weightage') },
  ];
  // ---- Category 3 — Tools ----
  const tools = [
    { key: 'examdate',  icon: CalendarDays, color: T.primary, label: 'Exam date', sub: 'Countdown & daily goal', action: () => go('exam-date') },
    { key: 'reference', icon: FlaskConical, color: T.accent,  label: 'Reference', sub: 'Labs, drugs, values',    action: () => go('reference') },
  ];

  const Item = ({ it }) => {
    const Icon = it.icon;
    return (
      <button onClick={it.action}
              className="no-tap-highlight w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-black/5 transition-colors text-left">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: it.color + '18' }}>
          <Icon size={18} style={{ color: it.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm" style={{ color: T.ink }}>{it.label}</div>
          <div className="text-[11px]" style={{ color: T.muted }}>{it.sub}</div>
        </div>
        <ChevronRight size={16} style={{ color: T.muted }} className="flex-shrink-0" />
      </button>
    );
  };

  const GroupLabel = ({ children }) => (
    <div className="text-[10px] uppercase tracking-wider font-semibold px-3 mt-4 mb-1" style={{ color: T.muted }}>{children}</div>
  );

  // Help & Learn — elevated cards. More visual weight than a plain row to
  // signal these are richer destinations (a guide / a Q&A experience).
  const LearnCard = ({ icon: Icon, iconColor, title, sub, badge, badgeTone, onClick }) => (
    <button onClick={onClick}
            className="no-tap-highlight w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left active:scale-[0.99] transition-transform"
            style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconColor }}>
        <Icon size={20} color="#FFF" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>{title}</div>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider leading-none"
                  style={{ background: badgeTone || T.primary, color: '#FFF' }}>{badge}</span>
          )}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{sub}</div>
      </div>
      <ChevronRight size={16} style={{ color: T.muted }} className="flex-shrink-0" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70]" style={{ pointerEvents: open ? 'auto' : 'none' }} aria-hidden={!open}>
      {/* Scrim */}
      <div onClick={onClose}
           className="absolute inset-0 transition-opacity duration-300"
           style={{ background: 'rgba(0,0,0,0.45)', opacity: open ? 1 : 0 }} />

      {/* Sliding panel — the panel itself scrolls. Its height comes from
          inset-y-0 against the fixed full-screen wrapper (always definite),
          so scrolling works on every device without relying on flexbox. */}
      <div ref={panelRef}
           data-no-ptr
           className="absolute inset-y-0 left-0 w-[82%] max-w-[330px] overflow-y-auto overscroll-contain transition-transform duration-300 ease-out"
           style={{
             background: T.bg,
             WebkitOverflowScrolling: 'touch',
             touchAction: 'pan-y',
             transform: open ? 'translateX(0)' : 'translateX(-102%)',
             boxShadow: open ? '0 0 40px rgba(0,0,0,0.25)' : 'none'
           }}>
        {/* Header (sticky so it stays pinned while the list scrolls) */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4"
             style={{ background: T.bg, borderBottom: `1px solid ${T.borderSoft}` }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
              <GraduationCap size={18} color="#FFF" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-semibold leading-tight" style={{ color: T.ink }}>NORCET prep</div>
              <div className="text-[11px]" style={{ color: T.muted }}>Menu</div>
            </div>
          </div>
          <button onClick={onClose} className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5" aria-label="Close menu">
            <X size={20} style={{ color: T.muted }} />
          </button>
        </div>

        {/* Nav list */}
        <div className="px-2 py-2 pb-10">
          <GroupLabel>Study</GroupLabel>
          {study.map(it => <Item key={it.key} it={it} />)}

          <GroupLabel>Progress</GroupLabel>
          {progress.map(it => <Item key={it.key} it={it} />)}

          <GroupLabel>Tools</GroupLabel>
          {tools.map(it => <Item key={it.key} it={it} />)}

          <GroupLabel>Help &amp; Learn</GroupLabel>
          <div className="px-1 mt-1 space-y-2">
            <LearnCard icon={GraduationCap} iconColor={T.primary}
                       title="Study Methods" sub="Learn how to study smarter"
                       badge="Guide" badgeTone={T.primary}
                       onClick={() => go('study-methods')} />
            <LearnCard icon={MessagesSquare} iconColor={T.sec.revision}
                       title="FAQ" sub="Questions answered by our team"
                       badge={faqUnread > 0 ? String(faqUnread) : null} badgeTone={T.error}
                       onClick={() => go('faq')} />
          </div>

          <div className="my-3 mx-3 border-t" style={{ borderColor: T.borderSoft }} />
          <button onClick={() => go('settings')}
                  className="no-tap-highlight w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-black/5 transition-colors text-left">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.surfaceWarm }}>
              <SettingsIcon size={18} style={{ color: T.inkSoft }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm" style={{ color: T.ink }}>Settings</div>
              <div className="text-[11px]" style={{ color: T.muted }}>Profile, backup, appearance</div>
            </div>
            <ChevronRight size={16} style={{ color: T.muted }} className="flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { NavDrawer };
