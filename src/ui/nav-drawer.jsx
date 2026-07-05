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
import React, { useEffect, useRef, useState } from 'react';
import { Activity, BarChart3, Bookmark, CalendarDays, ChevronRight, Compass, Crown, FileText, Flag, FlaskConical, GraduationCap, History, Info, Layers, Megaphone, MessagesSquare, Plus, Search, Send, Inbox, Settings as SettingsIcon, Target, Trophy, X } from 'lucide-react';
import { useTheme, useData, useProfile } from '../lib/app-context.jsx';
import { isPremiumEnabled } from '../lib/premium.js';
import { requestFeedback } from './primitives.jsx';
import { getSidebarGestures } from '../lib/ui-prefs.js';
// DRAWER — soft tick on row taps (gated by the Settings sound toggle).
import { playTapSound } from '../lib/sound.js';
// FAV — inline heart beside favoritable section titles (#2 rework).
import FavHeart from './fav-heart.jsx';
// TIP #13 — hold/hover info on every drawer row.
import { Tip } from './tooltip.jsx';

// Remembered across open/close (module-level): the row the user last
// navigated to, so the NEXT open can welcome them back with a brief glow.
let _lastVisitedKey = null;

function NavDrawer({ open, onClose, onNavigate, onOpen, gesturesAllowed = true, faqUnread = 0, replyUnread = 0 }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const { isAdmin } = useProfile();
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

  // ===================================================================
  // #21 — Sidebar gesture controls. Two opt-in gestures, both governed by
  // the Settings → Sidebar gestures toggles (lib/ui-prefs.js, read LIVE at
  // touchstart so a settings change applies without remounting):
  //   swipe-to-CLOSE (default ON)  — leftward drag anywhere on the open
  //     panel; the panel tracks the finger 1:1, commits past 38% width or a
  //     fast leftward flick, otherwise springs back open.
  //   swipe-to-OPEN  (default OFF) — rightward drag starting in the left
  //     20% screen-edge zone while the drawer is closed (Home only, via
  //     gesturesAllowed). Same threshold/velocity logic, mirrored.
  // Tap-backdrop and the hamburger/X button are ALWAYS available — gestures
  // are additive, never the only way out. Direct style mutation during the
  // drag (no re-renders) keeps tracking smooth on low-end phones.
  // ===================================================================
  const dragRef = useRef(null); // { mode:'close'|'open', startX, startY, lastX, lastT, vx, active }
  const setPanelX = (px, animate) => {
    const el = panelRef.current; if (!el) return;
    el.style.transition = animate ? '' : 'none';
    el.style.transform = `translateX(${px}px)`;
  };
  // BUGFIX (post-#21): never clear the inline transform to '' — React owns
  // `transform` via the style prop, and a direct wipe leaves the panel stuck
  // at translateX(0) ("sidebar stuck open at launch") because React's style
  // diff still believes the old value is applied and won't rewrite it.
  // Instead, always RESTORE the explicit state-correct transform.
  const restorePanel = (isOpen) => {
    const el = panelRef.current; if (!el) return;
    el.style.transition = '';
    el.style.transform = isOpen ? 'translateX(0)' : 'translateX(-102%)';
  };

  // -- swipe-to-close: handlers attached to the panel itself --
  const onPanelTouchStart = (e) => {
    if (!open) return;
    if (!getSidebarGestures().close) return;
    const t = e.touches && e.touches[0]; if (!t) return;
    dragRef.current = { mode: 'close', startX: t.clientX, startY: t.clientY, lastX: t.clientX, lastT: Date.now(), vx: 0, active: false };
  };
  const onPanelTouchMove = (e) => {
    const d = dragRef.current; if (!d || d.mode !== 'close') return;
    const t = e.touches && e.touches[0]; if (!t) return;
    const dx = t.clientX - d.startX;
    const dy = t.clientY - d.startY;
    // Only claim clearly-horizontal leftward drags; let vertical scrolls win.
    if (!d.active) {
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      d.active = true;
    }
    const now = Date.now();
    d.vx = (t.clientX - d.lastX) / Math.max(1, now - d.lastT);
    d.lastX = t.clientX; d.lastT = now;
    setPanelX(Math.min(0, dx), false);
  };
  const onPanelTouchEnd = () => {
    const d = dragRef.current; dragRef.current = null;
    if (!d || d.mode !== 'close' || !d.active) return;
    const el = panelRef.current; if (!el) return;
    const w = el.offsetWidth || 300;
    const dx = d.lastX - d.startX;
    const commit = (-dx) > w * 0.38 || d.vx < -0.4; // distance OR fast flick left
    restorePanel(!commit);            // committed → animate to closed; else spring back open
    if (commit) onClose();
  };

  // -- swipe-to-open: a document-level edge listener while closed --
  useEffect(() => {
    if (open || !gesturesAllowed || typeof document === 'undefined') return;
    // Home-only (gesturesAllowed) rightward-swipe to open, anywhere on the
    // screen, on every platform. We no longer restrict to the left edge — a
    // mid-screen start is what AVOIDS the iOS system back-edge, so this is safe
    // on iOS too. Horizontal intent is required below before we claim the drag,
    // so vertical scrolling is unaffected.
    const onStart = (e) => {
      if (!getSidebarGestures().open) return;
      // Popups own the screen: never begin an edge-swipe while ANY modal is up
      // (same [aria-modal] rule as pull-to-refresh), and ignore touches that
      // start on an opt-out surface like the floating note button — dragging
      // it sideways used to drag the sidebar out underneath.
      if (typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]')) return;
      const t = e.touches && e.touches[0]; if (!t) return;
      if (t.target && t.target.closest && t.target.closest('[data-no-ptr]')) return;
      dragRef.current = { mode: 'open', startX: t.clientX, startY: t.clientY, lastX: t.clientX, lastT: Date.now(), vx: 0, active: false };
    };
    const onMove = (e) => {
      const d = dragRef.current; if (!d || d.mode !== 'open') return;
      const t = e.touches && e.touches[0]; if (!t) return;
      const dx = t.clientX - d.startX;
      const dy = t.clientY - d.startY;
      if (!d.active) {
        if (dx < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        d.active = true;
      }
      const now = Date.now();
      d.vx = (t.clientX - d.lastX) / Math.max(1, now - d.lastT);
      d.lastX = t.clientX; d.lastT = now;
      const el = panelRef.current; if (!el) return;
      const w = el.offsetWidth || 300;
      setPanelX(Math.min(0, -w + dx), false);
    };
    const onEnd = () => {
      const d = dragRef.current; dragRef.current = null;
      if (!d || d.mode !== 'open' || !d.active) return;
      const el = panelRef.current;
      const w = (el && el.offsetWidth) || 300;
      const dx = d.lastX - d.startX;
      const commit = dx > w * 0.38 || d.vx > 0.4;
      restorePanel(commit);           // committed → animate to open; else slide back out
      if (commit && onOpen) onOpen();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [open, gesturesAllowed, onOpen]);

  // The drag mutates the panel's inline transform; make sure a state-driven
  // open/close always wins by re-asserting the explicit transform whenever
  // `open` flips (and on mount — same value React rendered, so harmless).
  useEffect(() => { restorePanel(open); }, [open]);

  // DRAWER micro-interactions: every open replays the staggered row
  // entrance (openCount keys the list), and the row last visited glows
  // briefly to welcome the user back to where they left from.
  const [openCount, setOpenCount] = useState(0);
  const [returnGlowKey, setReturnGlowKey] = useState(null);
  // `entering` is true only during the open animation window. The row-entrance
  // class is applied solely while it's true, so a later re-render (e.g.
  // expanding a collapsible) does NOT replay the whole-sidebar stagger — only
  // the tapped section's grid expand animates.
  const [entering, setEntering] = useState(false);
  // Fix 4 — collapsible sections. Primary nav (Study/Progress/Tools) starts
  // expanded; the two "folder" sections (Help & Learn, Feedback) start
  // collapsed and open like a folder when their heading is tapped.
  const [openSections, setOpenSections] = useState({
    study: true, progress: true, tools: true, learn: false, feedback: false,
  });
  const toggleSection = (key) => {
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(5); } catch (e) {}
    try { playTapSound(); } catch (e) {}
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  };
  useEffect(() => {
    if (!open) { setEntering(false); return; }
    setOpenCount(c => c + 1);
    setReturnGlowKey(_lastVisitedKey);
    _lastVisitedKey = null;
    setEntering(true);
    const t = setTimeout(() => { setEntering(false); setReturnGlowKey(null); }, 900);
    return () => clearTimeout(t);
  }, [open]);

  const go = (screen, extra, key) => {
    _lastVisitedKey = key || screen;
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    playTapSound();
    // Shared-axis forward launch (issues round): tag <html> for ~400ms so the
    // destination screen's entrance becomes a refined slide-in-from-right
    // (280ms ease-in-out, see .nav-fwd in font-styles) instead of the
    // default fade-up. Self-clearing; reduced-motion users see no motion.
    try {
      document.documentElement.classList.add('nav-fwd');
      setTimeout(() => { try { document.documentElement.classList.remove('nav-fwd'); } catch (e) {} }, 420);
    } catch (e) {}
    onClose();
    onNavigate(extra ? { screen, ...extra } : { screen });
  };

  // ---- Category 1 — Study ----
  const study = [
    { key: 'revision',  fav: 'revision-sheet', icon: FileText,    color: T.sec.revision, label: 'Revision', tip: 'A printable high-yield digest of everything due for revision today — plus your saved Crib Sheets.',  sub: 'High-yield digest',              action: () => go('revision-sheet', null, 'revision') },
    { key: 'library',   fav: 'library', icon: Layers,      color: T.sec.library,  label: 'Library', tip: 'Browse and import question banks curated by the team.',   sub: 'Question banks',                 action: () => go('library', null, 'library') },
    { key: 'bookmarks', fav: 'bookmarks-view', icon: Bookmark,    color: T.accent,       label: 'Bookmarks', tip: 'Every question you saved, grouped by topic, ready to re-read or retest.', sub: 'Questions you saved', badge: data.bookmarks.length, action: () => go('bookmarks-view', null, 'bookmarks') },
    { key: 'mistake-vault', icon: Target, color: T.error, label: 'Mistake Vault', tip: 'Every question you got wrong, kept until you answer it right twice in a row.', sub: 'Fix what you got wrong', action: () => go('mistake-vault', null, 'mistake-vault') },
    { key: 'doubts',    fav: 'doubts', icon: Flag,        color: T.error,        label: 'My Doubts', tip: 'Concept points and question explanations you flagged as unclear — resolve them here.', sub: 'Points you flagged to revisit',  action: () => go('doubts', null, 'doubts') },
    // Adding questions is now ADMIN ONLY (content authority) — hidden for users.
    ...(isAdmin ? [{ key: 'addq', icon: Plus, color: T.primary, label: 'Add question', tip: 'Upload and write the question sets students practise.', sub: 'Admin · question sets', action: () => go('add-question', null, 'addq') }] : []),
  ];
  // ---- Category 2 — Progress ----
  const progress = [
    { key: 'ikigai',      fav: 'ikigai', icon: Compass,   color: '#9333EA',   label: 'Ikigai Compass', badge: 'New', tip: 'Your living 4-circle readiness map — Passion, Profession, Mission and Vocation drift together as you practise.', sub: 'Your readiness, balanced', action: () => go('ikigai', null, 'ikigai') },
    { key: 'stats',       fav: 'stats', icon: BarChart3, color: T.sec.stats, label: 'Stats', tip: 'Accuracy, streaks and progress, broken down topic by topic.',          sub: 'Progress by topic',          action: () => go('stats', null, 'stats') },
    { key: 'leaderboard', fav: 'leaderboard', icon: Trophy,    color: T.accent,    label: 'Leaderboard', tip: 'See how your week stacks up against other aspirants.',    sub: 'Compare with other users',   action: () => go('leaderboard', null, 'leaderboard') },
    { key: 'weightage',   fav: 'weightage', icon: Activity,  color: T.primary,   label: 'Exam weightage', tip: 'How many marks each subject carries — study where the marks are.', sub: 'What the exam tests most',    action: () => go('weightage', null, 'weightage') },
    { key: 'activity-log', icon: History, color: T.sec.stats, label: 'History', tip: 'A newest-first timeline of your level-ups, streak milestones, mastery moments and test attempts.', sub: 'Achievements & study timeline', action: () => go('activity-log', null, 'activity-log') },
  ];
  // ---- Category 3 — Tools ----
  const tools = [
    // Global search also lives on the bottom nav bar (mobile/tablet); this row
    // keeps it reachable on desktop, where the bar is hidden.
    { key: 'search',    icon: Search, color: T.primary, label: 'Search', tip: 'One search across practice questions, concept cards, lab values, dosage drills and FAQs.', sub: 'Find anything in the app', action: () => go('search', null, 'search') },
    { key: 'examdate',  icon: CalendarDays, color: T.primary, label: 'Study plan', tip: 'Set your NORCET date and daily goal, and get a personalised day-by-day plan to exam day.', sub: 'Date, daily goal & day-by-day plan', action: () => go('study-plan', null, 'examdate') },
    { key: 'reference', fav: 'reference', icon: FlaskConical, color: T.accent,  label: 'Reference', tip: 'Lab values, drug tables and quick-look clinical numbers.', sub: 'Labs, drugs, values',    action: () => go('reference', null, 'reference') },
    // Premium — a preview of upcoming plans/perks. Gated on the contract flag
    // the same way the admin-only "Add question" row is conditionally spread;
    // nothing in the app is gated, everything is free during the test phase.
    ...(isPremiumEnabled() ? [{ key: 'premium', icon: Crown, color: '#D97706', label: 'Premium', badge: 'New', tip: 'See what Premium will include — everything is free during the test phase.', sub: 'Plans & perks preview', action: () => go('premium', null, 'premium') }] : []),
  ];
  // ---- Category 4 — Help & Learn ---- (rendered through the SAME Item card as
  // every other section so spacing + sizing stay perfectly symmetric.)
  const learn = [
    { key: 'study-methods', fav: 'study-methods', icon: GraduationCap, color: T.primary, label: 'Study Methods', badge: 'Guide', tip: 'Evidence-based techniques \u2014 active recall, spaced repetition and how to use this app well.', sub: 'Learn how to study smarter', action: () => go('study-methods', null, 'methods') },
    { key: 'faq', fav: 'faq', icon: MessagesSquare, color: T.sec.revision, label: 'FAQ', badge: faqUnread > 0 ? String(faqUnread) : null, badgeUrgent: true, tip: 'Common questions answered by the team \u2014 ask your own too.', sub: 'Questions answered by our team', action: () => go('faq', null, 'faq') },
    { key: 'about', icon: Info, color: T.accent, label: 'About', tip: 'Our mission, how the app teaches, and the person building it.', sub: 'The story behind NurseHolic', action: () => go('about', null, 'about') },
  ];
  // ---- Category 5 — Feedback ---- (same Item card; two separate, evenly
  // spaced rows replacing the old combined panel.)
  const feedback = [
    { key: 'send-feedback', icon: Send, color: T.accent, label: 'Send feedback', tip: 'Found a bug or have an idea? Send a report straight to the developer.', sub: 'Report a bug or suggest a feature', action: () => { onClose(); requestFeedback({ source: 'feedback', screen: 'Sidebar feedback' }); } },
    { key: 'my-reports', icon: Inbox, color: T.primary, label: 'My feedback', badge: replyUnread > 0 ? String(replyUnread) : null, badgeUrgent: true, tip: 'Your past reports and the admin\u2019s replies.', sub: 'Your reports and admin replies', action: () => go('my-reports', null, 'my-reports') },
  ];

  const Item = ({ it, index = 0 }) => {
    const Icon = it.icon;
    const glowing = returnGlowKey === it.key;
    return (
      <Tip title={it.label} text={it.tip || it.sub}>
      <button onClick={it.action}
              className={"no-tap-highlight drawer-row w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left mb-1.5" + (entering ? ' drawer-item-in' : '') + (glowing ? ' drawer-glow' : '')}
              style={{
                background: T.surface,
                border: `1px solid ${glowing ? it.color + '70' : T.borderSoft}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                animationDelay: entering ? `${Math.min(index, 9) * 45}ms` : undefined,
                '--row-glow': it.color,
              }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{
               background: `linear-gradient(135deg, ${it.color}26, ${it.color}10)`,
               border: `1px solid ${it.color}30`,
               boxShadow: `0 2px 8px ${it.color}1F`,
             }}>
          <Icon size={18} style={{ color: it.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm flex items-center gap-1" style={{ color: T.ink }}>
            {it.label}
            {it.badge != null && it.badge !== 0 && it.badge !== '' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                    style={it.badgeUrgent
                      ? { background: T.error, color: '#FFF' }
                      : { background: it.color + '18', color: it.color }}>{it.badge}</span>
            )}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{it.sub}</div>
        </div>
        {/* FAV (issues round) — hearts live in a dedicated action column just
            before the chevron, so every heart in the sidebar sits on the
            same vertical line instead of trailing the title text. */}
        {it.fav && <span className="flex-shrink-0 -mr-1"><FavHeart favId={it.fav} inline /></span>}
        <ChevronRight size={16} style={{ color: it.color, opacity: 0.55 }} className="flex-shrink-0 drawer-chev" />
      </button>
      </Tip>
    );
  };

  const GroupLabel = ({ children }) => (
    <div className="text-[10px] uppercase tracking-wider font-semibold px-3 mt-4 mb-1" style={{ color: T.muted }}>{children}</div>
  );

  // Fix 4 — a tappable section heading with an animated disclosure chevron.
  const SectionHeader = ({ label, sectionKey }) => {
    const isOpen = !!openSections[sectionKey];
    return (
      <button onClick={() => toggleSection(sectionKey)}
              aria-expanded={isOpen}
              className="no-tap-highlight w-full flex items-center justify-between gap-2 px-3 mt-4 mb-1 text-left active:opacity-70 transition-opacity">
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>{label}</span>
        <ChevronRight size={14}
                      style={{ color: T.muted,
                               transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                               transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
      </button>
    );
  };

  // Fix 4 — smooth open/close via the grid-rows 0fr→1fr trick (animates real
  // height with no JS measuring; the inner wrapper clips + fades the content).
  const Collapsible = ({ open: isOpen, children }) => (
    <div style={{ display: 'grid',
                  gridTemplateRows: isOpen ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
      <div style={{ overflow: 'hidden', minHeight: 0,
                    opacity: isOpen ? 1 : 0,
                    transition: 'opacity 0.22s ease',
                    transitionDelay: isOpen ? '0.06s' : '0s' }}
           aria-hidden={!isOpen}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70]"
         onTouchStart={onPanelTouchStart}
         onTouchMove={onPanelTouchMove}
         onTouchEnd={onPanelTouchEnd}
         onTouchCancel={onPanelTouchEnd}
         style={{ pointerEvents: open ? 'auto' : 'none' }} aria-hidden={!open}>
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
        {/* Header (sticky so it stays pinned while the list scrolls). Pads
            itself by the safe-area inset so the title clears the iOS status
            bar / notch instead of colliding with the clock. */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 pb-4"
             style={{ background: T.bg, borderBottom: `1px solid ${T.borderSoft}`,
                      paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
              <GraduationCap size={18} color="#FFF" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-semibold leading-tight" style={{ color: T.ink }}>NurseHolic</div>
              <div className="text-[11px]" style={{ color: T.muted }}>Menu</div>
            </div>
          </div>
          <button onClick={onClose} className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5" aria-label="Close menu">
            <X size={20} style={{ color: T.muted }} />
          </button>
        </div>

        {/* Nav list */}
        <div className="px-2 py-2 pb-10">
          <div key={openCount}>{/* remount per open → entrance replays */}
          <SectionHeader label="Study" sectionKey="study" />
          <Collapsible open={openSections.study}>
            {study.map((it, i) => <Item key={it.key} it={it} index={i} />)}
          </Collapsible>

          <SectionHeader label="Progress" sectionKey="progress" />
          <Collapsible open={openSections.progress}>
            {progress.map((it, i) => <Item key={it.key} it={it} index={study.length + i} />)}
          </Collapsible>

          <SectionHeader label="Tools" sectionKey="tools" />
          <Collapsible open={openSections.tools}>
            {tools.map((it, i) => <Item key={it.key} it={it} index={study.length + progress.length + i} />)}
          </Collapsible>

          <SectionHeader label="Help & Learn" sectionKey="learn" />
          <Collapsible open={openSections.learn}>
            {learn.map((it, i) => <Item key={it.key} it={it} index={study.length + progress.length + tools.length + i} />)}
          </Collapsible>

          {/* #9 / Fix 4 — Feedback is now a collapsible folder: tapping the
              heading expands "Send feedback" + "My feedback" as children. Same
              targets as before (source:'feedback' → the one admin inbox; and
              the user's own reports + admin replies, with an unread badge). */}
          <SectionHeader label="Feedback" sectionKey="feedback" />
          <Collapsible open={openSections.feedback}>
            {feedback.map((it, i) => <Item key={it.key} it={it} index={study.length + progress.length + tools.length + learn.length + i} />)}
          </Collapsible>

          </div>

          <div className="my-3 mx-3 border-t" style={{ borderColor: T.borderSoft }} />
          <Tip title="Settings" text="Themes, sounds, gestures, reminders, backup and your profile.">
          <button onClick={() => go('settings', null, 'settings')}
                  className="no-tap-highlight drawer-row w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left"
                  style={{ background: T.surface, border: `1px solid ${T.borderSoft}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.surfaceWarm }}>
              <SettingsIcon size={18} style={{ color: T.inkSoft }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm" style={{ color: T.ink }}>Settings</div>
              <div className="text-[11px]" style={{ color: T.muted }}>Profile, backup, appearance</div>
            </div>
            <ChevronRight size={16} style={{ color: T.muted }} className="flex-shrink-0" />
          </button>
          </Tip>
        </div>
      </div>
    </div>
  );
}

export { NavDrawer };
