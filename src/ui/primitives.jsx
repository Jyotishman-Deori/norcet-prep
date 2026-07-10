// =====================================================================
// UI PRIMITIVES & TOPBAR CHROME
//   (Pipeline step 37 / A1 session 3 — extracted from App.jsx)
// Leaf presentational components plus the report/help request channel.
// Pill / PyqBadge / Button / TopBar / FeedbackButton / HelpButton read the
// active theme via useTheme(); FeedbackButton also reads the active profile
// via useProfile(). Card is CSS-only (.surface-card) and theme-free.
//
// [A7] The Report/Help MODALS still live at the app root (FeedbackHost /
// HelpHost in App.jsx). Those hosts now register their open() callback here
// via registerFeedbackOpener / registerHelpOpener instead of poking a shared
// module global directly, so this module owns the whole request channel.
// =====================================================================
import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, useProfile, useI18n } from '../lib/app-context.jsx';
import { isPYQ, pyqLabel } from '../lib/pyq.js';
import { ArrowLeft, HelpCircle, AlertCircle, History, Flame, NotebookPen } from 'lucide-react';
import { conceptCount, highYieldTier } from '../lib/high-yield.js';
// FAV — TopBar heart (lazy circular-safe: fav-heart imports app-context only).
import FavHeart from './fav-heart.jsx';
// TIP — hold (mobile) / hover (PC) info bubbles on the chrome icons.
import { Tip } from './tooltip.jsx';

// ---- Report / Help open-request channel -----------------------------------
// Buttons (rendered inside any TopBar) call request*(); the single host modal
// mounted at the app root registers its setter via register*Opener().
// Feedback/Help/Note channels are OBSERVABLE (subscribe/has): their TopBar
// buttons hide themselves in bundles that mount no host (the admin app),
// instead of rendering dead chrome there.
let _openFeedback = null;
const _feedbackSubs = new Set();
export function requestFeedback(ctx) { if (_openFeedback) _openFeedback(ctx || {}); }
export function registerFeedbackOpener(fn) {
  _openFeedback = fn;
  _feedbackSubs.forEach(cb => { try { cb(); } catch (e) {} });
}
export function subscribeFeedbackOpener(cb) { _feedbackSubs.add(cb); return () => _feedbackSubs.delete(cb); }
export function hasFeedbackOpener() { return !!_openFeedback; }

let _openHelp = null;
const _helpSubs = new Set();
export function requestHelp(ctx) { if (_openHelp) _openHelp(ctx || {}); }
export function registerHelpOpener(fn) {
  _openHelp = fn;
  _helpSubs.forEach(cb => { try { cb(); } catch (e) {} });
}
export function subscribeHelpOpener(cb) { _helpSubs.add(cb); return () => _helpSubs.delete(cb); }
export function hasHelpOpener() { return !!_openHelp; }

let _openSupport = null;
export function requestSupport() { if (_openSupport) _openSupport(); }
export function registerSupportOpener(fn) { _openSupport = fn; }

// #7 — a single app-root confirmation dialog reachable imperatively from any
// screen (e.g. the un-bookmark caution). opts: { title, body, confirmLabel,
// cancelLabel, tone, icon, onConfirm, onCancel }.
let _openConfirm = null;
export function requestConfirm(opts) { if (_openConfirm) _openConfirm(opts || {}); }
export function registerConfirmOpener(fn) { _openConfirm = fn; }

// AI Learning Notes — the note-taking popup is a single app-root host
// (NoteHost) opened imperatively from the TopBar note button AND the draggable
// floating button (note-fab.jsx), so both entry points share one modal.
// The channel is OBSERVABLE (subscribe/has) so NoteButton can hide itself in
// bundles that mount no NoteHost (the admin app) instead of being a dead
// button there — no per-call-site prop needed.
let _openNote = null;
const _noteSubs = new Set();
export function requestNote(ctx) { if (_openNote) _openNote(ctx || {}); }
export function registerNoteOpener(fn) {
  _openNote = fn;
  _noteSubs.forEach(cb => { try { cb(); } catch (e) {} });
}
export function subscribeNoteOpener(cb) { _noteSubs.add(cb); return () => _noteSubs.delete(cb); }
export function hasNoteOpener() { return !!_openNote; }

function Pill({ children, color, bg, className = '' }) {
  const { theme: T } = useTheme();
  const fg = color ?? T.primary;
  const background = bg ?? T.successSoft;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
          style={{ color: fg, background }}>
      {children}
    </span>
  );
}

// P16 — provenance badge. Reuses Pill but with a distinct plum accent
// (T.sec.revision, defined in every theme) so it reads as "where this came
// from", never as a topic chip or as the orange "Marked" pill. Renders
// nothing for non-PYQ questions, so it is safe to drop into any question
// header unconditionally.
function PyqBadge({ q, className = '' }) {
  const { theme: T } = useTheme();
  if (!isPYQ(q)) return null;
  const c = (T.sec && T.sec.revision) || T.accent;
  return (
    <Pill bg={c + '1A'} color={c} className={className}>
      <History size={10} />{pyqLabel(q)}
    </Pill>
  );
}

// #3 — HIGH-YIELD badge. Flags a PYQ whose CONCEPT (topic + sub) recurs across
// the official papers, so a learner sees "this gets asked a lot" at a glance.
// Amber is a deliberate, distinct "high-value" accent — not the plum PYQ badge
// and not the orange "Marked" pill — and it renders nothing for one-off
// concepts, so it is safe to drop next to PyqBadge unconditionally.
const HIGH_YIELD_AMBER = '#B8791A';
function HighYieldBadge({ q, className = '' }) {
  const { t } = useI18n();
  if (!isPYQ(q) || !q || !q.topic) return null;
  const n = conceptCount(q.topic, q.sub);
  const tier = highYieldTier(n);
  if (tier === 'none') return null;
  return (
    <Pill bg={HIGH_YIELD_AMBER + (tier === 'high' ? '24' : '16')} color={HIGH_YIELD_AMBER} className={className}>
      <Flame size={10} />{t('quiz.askedTimes', { n })}
    </Pill>
  );
}

function Card({ children, onClick, className = '', style = {}, ariaLabel, ...rest }) {
  // A8: the static surface + hairline border now come from the .surface-card
  // utility (CSS vars) instead of a per-render style object. Callers can still
  // pass `style` to override or extend (e.g. a coloured left border); those
  // win via normal inline-style precedence over the class.
  // A9: when the card is clickable it becomes a real keyboard control —
  // role="button", focusable, and Enter/Space activate it. Non-clickable cards
  // stay plain <div>s (no role/tab stop), so we don't add empty tab stops.
  const interactive = !!onClick;
  const onKeyDown = interactive
    ? (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          onClick(e);
        }
      }
    : undefined;
  return (
    <div onClick={onClick}
         role={interactive ? 'button' : undefined}
         tabIndex={interactive ? 0 : undefined}
         onKeyDown={onKeyDown}
         aria-label={ariaLabel}
         className={`no-tap-highlight rounded-2xl surface-card ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
         style={style}
         {...rest}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '', icon }) {
  const { theme: T } = useTheme();
  const base = 'no-tap-highlight inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-2 text-sm', md: 'px-4 py-3 text-sm', lg: 'px-5 py-4 text-base' };
  const variants = {
    primary: { background: T.primary, color: '#FFF' },
    accent: { background: T.accent, color: '#FFF' },
    ghost: { background: 'transparent', color: T.ink, border: `1px solid ${T.border}` },
    soft: { background: T.surfaceWarm, color: T.ink }
  };
  return (
    <button onClick={onClick} disabled={disabled}
            className={`${base} ${sizes[size]} ${className}`}
            style={variants[variant]}>
      {icon}
      {children}
    </button>
  );
}

// `desktopHidden` — the four tab-root screens (search/favorites/settings)
// pass true so THEIR TopBar disappears on lg, where the persistent DesktopNav
// replaces it. Sub-views (Settings → Legal etc.) keep their TopBar, which
// offsets itself below the navbar via the `--dnav-h` var DesktopNav publishes
// while mounted (0px everywhere else, so nothing moves on mobile).
function TopBar({ title, onBack, right, feedback, favId, solid = false, desktopHidden = false }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { t } = useI18n();
  // Theme-aware background. `solid` opts OUT of the frosted blur: a fully opaque
  // bar with no backdrop-filter, so there is no compositing layer to re-sample
  // (and ghost) when animated content — e.g. the Favourites jiggle/enter tiles
  // or a closing picker — moves behind it. Same family of fix as the Home bar.
  const tbBg = solid ? T.bg : (IS_DARK ? 'rgba(21,19,15,0.92)' : T.bg + 'F0');
  // FIXED top bar (issues round, hardened): the bar is pinned to the viewport
  // on every screen so navigation/Help/Report never scroll out of reach, and it
  // pads itself by env(safe-area-inset-top) so the title/counter never collide
  // with the status bar/notch. A spacer keeps page content from sliding under.
  //
  // #13 — the bar is rendered through a PORTAL into <body>. Every screen wraps
  // its TopBar in a `.anim-fadeup` div; while that entrance animation runs the
  // wrapper holds a transform, and ANY transformed ancestor turns position:fixed
  // into "fixed to that ancestor" (so the bar scrolled away). Portaling the bar
  // out of the screen subtree makes it a child of <body> — no screen wrapper,
  // animation, overflow container or future layout can ever contain it again.
  // useTheme still works through the portal (React context follows the tree,
  // not the DOM). The spacer stays in flow to reserve the bar's height.
  const bar = (
    <div className={"fixed left-0 right-0 z-40" + (solid ? '' : ' backdrop-blur-md') + (desktopHidden ? ' lg:hidden' : '')}
         style={{ top: 'var(--dnav-h, 0px)',
                  background: tbBg, borderBottom: `1px solid ${T.borderSoft}`,
                  paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Inner content tracks the DESKTOP NAV width on PC (max-w-6xl + px-8),
          so the back button lines up flush under the DesktopNav brand and the
          action chips under its Menu button — the two stacked bars read as one
          coherent header instead of two misaligned rails. Mobile and tablet
          widths are unchanged. */}
      <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-3 max-w-md md:max-w-3xl lg:max-w-6xl mx-auto">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <Tip text={t('topbar.backTip')}>
              {/* Premium back affordance: a circular chip that matches the
                  Help/Report pills, scales down on press and nudges its arrow
                  left with a soft spring, plus a light haptic tap. */}
              <button onClick={() => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6); } catch (e) {} onBack(); }}
                      aria-label={t('topbar.back')}
                      className="no-tap-highlight tbar-btn group flex items-center justify-center w-9 h-9 -ml-1 flex-shrink-0 rounded-full"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                <ArrowLeft size={18} color={T.ink}
                           className="transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-active:-translate-x-[3px]" />
              </button>
            </Tip>
          )}
          <div className="font-display text-lg lg:text-xl truncate" style={{ color: T.ink }}>{title}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Learning Notes — FIRST (leftmost) action so it holds the same
              slot on every screen regardless of which other actions are present.
              Home has a custom header that renders <NoteButton/> too. */}
          <NoteButton />
          {/* FAV — heart on favoritable sections (registry-gated; renders
              nothing for ids outside lib/favorites.js). */}
          {favId && <FavHeart favId={favId} />}
          {right}
          {feedback && !feedback.noHelp && <HelpButton screen={feedback.screen} />}
          {feedback && (
            <FeedbackButton screen={feedback.screen} questionId={feedback.questionId}
                            profileId={feedback.profileId} profileName={feedback.profileName} />
          )}
        </div>
      </div>
    </div>
  );
  const target = (typeof document !== 'undefined') ? document.body : null;
  return (
    <>
      {target ? createPortal(bar, target) : bar}
      {/* spacer — clears the fixed bar (row ≈ 61px: back button 36px + py-3) with
          a few px of premium breathing room, so content on every screen sits
          comfortably below the bar regardless of its own top padding. When the
          bar is desktopHidden the spacer hides with it (DesktopNav has its own). */}
      <div aria-hidden="true" className={desktopHidden ? 'lg:hidden' : undefined}
           style={{ height: 'calc(64px + env(safe-area-inset-top, 0px))' }} />
    </>
  );
}

// AI Learning Notes — icon-only circular chip (keeps the crowded action row
// compact on mobile alongside the labelled Help/Report pills). Opens the shared
// note popup via the request channel above. 36px meets the 44px guidance with
// its surrounding tap padding; labelled by aria + Tip for accessibility.
function NoteButton() {
  const { theme: T } = useTheme();
  const { t } = useI18n();
  // Registry-gated: renders nothing until a NoteHost has registered an opener
  // (student app root). In the admin bundle there is no NoteHost, so the
  // button never appears there.
  const hasHost = useSyncExternalStore(subscribeNoteOpener, hasNoteOpener, hasNoteOpener);
  if (!hasHost) return null;
  return (
    <Tip text={t('topbar.noteTip')}>
      <button onClick={() => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6); } catch (e) {} requestNote(); }}
              aria-label={t('nav.openStudyNotes')}
              className="no-tap-highlight tbar-btn flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-full"
              style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
        <NotebookPen size={16} style={{ color: T.primary }} />
      </button>
    </Tip>
  );
}

function FeedbackButton({ screen, questionId, profileId, profileName }) {
  const { profile: CURRENT_PROFILE } = useProfile();
  const { theme: T } = useTheme();
  const { t } = useI18n();
  const hasHost = useSyncExternalStore(subscribeFeedbackOpener, hasFeedbackOpener, hasFeedbackOpener);
  const pid = profileId || (CURRENT_PROFILE && CURRENT_PROFILE.id) || null;
  const pname = profileName || (CURRENT_PROFILE && CURRENT_PROFILE.displayName) || null;
  if (!hasHost) return null;
  return (
    <Tip text={t('topbar.reportTip')}>
    <button onClick={() => requestFeedback({ screen, questionId, profileId: pid, profileName: pname })}
            className="no-tap-highlight tbar-btn flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full flex-shrink-0"
            style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}
            aria-label={t('topbar.reportAria')}>
      <AlertCircle size={15} style={{ color: T.accent }} />
      <span className="text-xs font-medium">{t('topbar.report')}</span>
    </button>
    </Tip>
  );
}

function HelpButton({ screen }) {
  const { theme: T } = useTheme();
  const { t } = useI18n();
  const hasHost = useSyncExternalStore(subscribeHelpOpener, hasHelpOpener, hasHelpOpener);
  if (!hasHost) return null;
  return (
    <Tip text={t('topbar.helpTip')}>
      <button onClick={() => requestHelp({ screen })}
              className="no-tap-highlight tbar-btn flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full flex-shrink-0"
              style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}
              aria-label={t('topbar.helpAria')}>
        <HelpCircle size={15} style={{ color: T.primary }} />
        <span className="text-xs font-medium">{t('topbar.help')}</span>
      </button>
    </Tip>
  );
}

export { Pill, PyqBadge, HighYieldBadge, Card, Button, TopBar, NoteButton };
