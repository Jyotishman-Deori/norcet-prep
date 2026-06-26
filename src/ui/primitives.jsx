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
import React from 'react';
import { createPortal } from 'react-dom';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { isPYQ, pyqLabel } from '../lib/pyq.js';
import { ArrowLeft, HelpCircle, AlertCircle, History, Flame } from 'lucide-react';
import { conceptCount, highYieldTier } from '../lib/high-yield.js';
// FAV — TopBar heart (lazy circular-safe: fav-heart imports app-context only).
import FavHeart from './fav-heart.jsx';
// TIP — hold (mobile) / hover (PC) info bubbles on the chrome icons.
import { Tip } from './tooltip.jsx';

// ---- Report / Help open-request channel -----------------------------------
// Buttons (rendered inside any TopBar) call request*(); the single host modal
// mounted at the app root registers its setter via register*Opener().
let _openFeedback = null;
export function requestFeedback(ctx) { if (_openFeedback) _openFeedback(ctx || {}); }
export function registerFeedbackOpener(fn) { _openFeedback = fn; }

let _openHelp = null;
export function requestHelp(ctx) { if (_openHelp) _openHelp(ctx || {}); }
export function registerHelpOpener(fn) { _openHelp = fn; }

let _openSupport = null;
export function requestSupport() { if (_openSupport) _openSupport(); }
export function registerSupportOpener(fn) { _openSupport = fn; }

// #7 — a single app-root confirmation dialog reachable imperatively from any
// screen (e.g. the un-bookmark caution). opts: { title, body, confirmLabel,
// cancelLabel, tone, icon, onConfirm, onCancel }.
let _openConfirm = null;
export function requestConfirm(opts) { if (_openConfirm) _openConfirm(opts || {}); }
export function registerConfirmOpener(fn) { _openConfirm = fn; }

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
  if (!isPYQ(q) || !q || !q.topic) return null;
  const n = conceptCount(q.topic, q.sub);
  const tier = highYieldTier(n);
  if (tier === 'none') return null;
  return (
    <Pill bg={HIGH_YIELD_AMBER + (tier === 'high' ? '24' : '16')} color={HIGH_YIELD_AMBER} className={className}>
      <Flame size={10} />Asked {n}×
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

function TopBar({ title, onBack, right, feedback, favId, solid = false }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
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
    <div className={"fixed top-0 left-0 right-0 z-40" + (solid ? '' : ' backdrop-blur-md')}
         style={{ background: tbBg, borderBottom: `1px solid ${T.borderSoft}`,
                  paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Inner content tracks the app content width on PC (matches PageContainer
          size="app": max-w-5xl + px-8), so the back button aligns to the left
          edge of the page and the actions to the right edge — a proper app
          header instead of a tiny 448px island floating mid-screen. Mobile and
          tablet widths are unchanged. */}
      <div className="flex items-center justify-between px-4 lg:px-8 py-3 max-w-md md:max-w-2xl lg:max-w-5xl mx-auto">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <Tip text="Go back to the previous screen">
              {/* Premium back affordance: a circular chip that matches the
                  Help/Report pills, scales down on press and nudges its arrow
                  left with a soft spring, plus a light haptic tap. */}
              <button onClick={() => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6); } catch (e) {} onBack(); }}
                      aria-label="Go back"
                      className="no-tap-highlight group flex items-center justify-center w-9 h-9 -ml-1 flex-shrink-0 rounded-full active:scale-90 transition-transform duration-150"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                <ArrowLeft size={18} color={T.ink}
                           className="transition-transform duration-200 ease-[cubic-bezier(.34,1.56,.64,1)] group-active:-translate-x-[3px]" />
              </button>
            </Tip>
          )}
          <div className="font-display text-lg lg:text-xl truncate" style={{ color: T.ink }}>{title}</div>
        </div>
        <div className="flex items-center gap-1.5">
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
      {/* spacer — same height as the fixed bar (row ≈ 60px) + the safe area */}
      <div aria-hidden="true" style={{ height: 'calc(60px + env(safe-area-inset-top, 0px))' }} />
    </>
  );
}

function FeedbackButton({ screen, questionId, profileId, profileName }) {
  const { profile: CURRENT_PROFILE } = useProfile();
  const { theme: T } = useTheme();
  const pid = profileId || (CURRENT_PROFILE && CURRENT_PROFILE.id) || null;
  const pname = profileName || (CURRENT_PROFILE && CURRENT_PROFILE.displayName) || null;
  return (
    <Tip text="Found a bug or have an idea? Send a report straight to the developer">
    <button onClick={() => requestFeedback({ screen, questionId, profileId: pid, profileName: pname })}
            className="no-tap-highlight flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full active:scale-95 transition-transform flex-shrink-0"
            style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}
            aria-label="Report a bug or suggest a feature">
      <AlertCircle size={15} style={{ color: T.accent }} />
      <span className="text-xs font-medium">Report</span>
    </button>
    </Tip>
  );
}

function HelpButton({ screen }) {
  const { theme: T } = useTheme();
  return (
    <Tip text="What this screen does, how to use it, and why it helps">
      <button onClick={() => requestHelp({ screen })}
              className="no-tap-highlight flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full active:scale-95 transition-transform flex-shrink-0"
              style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}
              aria-label="What is this screen?">
        <HelpCircle size={15} style={{ color: T.primary }} />
        <span className="text-xs font-medium">Help</span>
      </button>
    </Tip>
  );
}

export { Pill, PyqBadge, HighYieldBadge, Card, Button, TopBar };
