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
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { isPYQ, pyqLabel } from '../lib/pyq.js';
import { ArrowLeft, HelpCircle, AlertCircle, History } from 'lucide-react';

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

function Card({ children, onClick, className = '', style = {}, ariaLabel }) {
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
         style={style}>
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

function TopBar({ title, onBack, right, feedback }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  // Theme-aware translucent background
  const tbBg = IS_DARK ? 'rgba(21,19,15,0.85)' : T.bg + 'D9';
  return (
    <div className="sticky top-0 z-20 backdrop-blur-md" style={{ background: tbBg, borderBottom: `1px solid ${T.borderSoft}` }}>
      <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <button onClick={onBack} aria-label="Go back" className="no-tap-highlight p-2 -ml-2 rounded-full active:bg-black/5">
              <ArrowLeft size={20} color={T.ink} />
            </button>
          )}
          <div className="font-display text-lg truncate" style={{ color: T.ink }}>{title}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {right}
          {feedback && <HelpButton screen={feedback.screen} />}
          {feedback && (
            <FeedbackButton screen={feedback.screen} questionId={feedback.questionId}
                            profileId={feedback.profileId} profileName={feedback.profileName} />
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackButton({ screen, questionId, profileId, profileName }) {
  const { profile: CURRENT_PROFILE } = useProfile();
  const { theme: T } = useTheme();
  const pid = profileId || (CURRENT_PROFILE && CURRENT_PROFILE.id) || null;
  const pname = profileName || (CURRENT_PROFILE && CURRENT_PROFILE.displayName) || null;
  return (
    <button onClick={() => requestFeedback({ screen, questionId, profileId: pid, profileName: pname })}
            className="no-tap-highlight flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full active:scale-95 transition-transform flex-shrink-0"
            style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}
            aria-label="Report a bug or suggest a feature">
      <AlertCircle size={15} style={{ color: T.accent }} />
      <span className="text-xs font-medium">Report</span>
    </button>
  );
}

function HelpButton({ screen }) {
  const { theme: T } = useTheme();
  return (
    <button onClick={() => requestHelp({ screen })}
            className="no-tap-highlight flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full active:scale-95 transition-transform flex-shrink-0"
            style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}
            aria-label="What is this screen?">
      <HelpCircle size={15} style={{ color: T.primary }} />
      <span className="text-xs font-medium">Help</span>
    </button>
  );
}

export { Pill, PyqBadge, Card, Button, TopBar };
