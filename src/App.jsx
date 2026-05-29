import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BookOpen, ListChecks, Clock, RotateCcw, BarChart3,
  Plus, Bookmark, BookmarkCheck, ChevronRight, ChevronLeft, Check, X,
  Flame, Target, Brain, Sparkles, ArrowLeft, Shuffle, Timer,
  GraduationCap, Lightbulb, Heart, AlertCircle, Settings as SettingsIcon,
  Trash2, Save, Edit3, FileText, Upload, Download, Flag, Send,
  LayoutGrid, EyeOff, Hourglass, Layers, AlertTriangle,
  User, UserPlus, LogIn, LogOut, Lock, Eye, RefreshCw,
  Volume2, Pause, Square, Calendar, CalendarDays, Calculator, Printer,
  Search, ChevronDown, ChevronUp, Sigma, Activity, FlaskConical, Menu,
  Pill as PillIcon, ArrowRightLeft, ClipboardList, HeartPulse, SkipForward, HelpCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, PolarAngleAxis, LineChart, Line, Cell
} from 'recharts';
import { KEYS, KEY_PREFIXES } from './lib/keys.js';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './lib/migrations.js';
import { compactData, needsCompaction, attemptStats, hasBeenSeen, COMPACTION_SIZE_THRESHOLD } from './lib/compact.js';
import { log, setLogContext } from './lib/log.js';
import * as kvStorage from './storage';

// =====================================================================
// ERROR BOUNDARY (Pipeline step 1 / A3; "Reset device data" added at P1)
// Catches render-time crashes anywhere below App and shows a friendly
// recovery screen instead of a white page. Self-contained: styles are
// hardcoded (not theme-aware) so the fallback still works even if
// context/state is broken.
//
// Reset device data is now ENABLED because P1 (cloud sync) ships the
// canonical progress copy to Supabase. Wiping the local cache only
// drops the device-side mirror; the next sign-in pulls fresh data
// from Supabase. We keep a strong confirm() because losing unsynced
// offline writes is still a real risk if the user is offline at the
// moment of reset.
// =====================================================================
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, wiping: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // A10: report through the structured logger. log.error never throws
    // and, in prod, ships the breadcrumb ring buffer to Supabase. We
    // also attach the React component stack as the detail tail.
    try {
      const stack = (info && info.componentStack) ? String(info.componentStack).slice(0, 2000) : '';
      log.error('errorBoundary.render', error);
      if (stack) log.warn('errorBoundary.componentStack', stack);
    } catch (e) { /* logger is fail-safe; nothing more to do */ }
  }
  handleReload = () => {
    try { window.location.reload(); } catch (e) {}
  };
  handleResetScreen = () => {
    try { window.dispatchEvent(new CustomEvent('norcet:reset-screen')); } catch (e) {}
    this.setState({ hasError: false, error: null });
  };
  handleResetDeviceData = async () => {
    // Strong confirm — last line of defence against an accidental tap.
    // If the user is offline, any local writes that haven't synced yet
    // will be lost; the confirm copy says so explicitly.
    const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
    const msg = offline
      ? "You're currently OFFLINE. This will sign you out and delete all locally cached data on this device. Any progress from this offline session that hasn't synced to the cloud yet will be LOST. Continue?"
      : "This will sign you out and clear all locally cached data on this device. Your progress is backed up to the cloud and will reload when you sign in again. Continue?";
    if (!window.confirm(msg)) return;
    this.setState({ wiping: true });
    try {
      // Drop the session pointer first so a partial wipe still leaves
      // the user logged out on next boot (safer than half-wiping cache
      // but leaving the session intact).
      try { await safeStorage.delete(KEYS.SESSION, false); } catch (e) {}
      // All per-profile local caches (added in P1).
      try {
        const listed = await safeStorage.list(KEY_PREFIXES.USERDATA, false);
        const keys = (listed && listed.keys) || [];
        await Promise.all(keys.map(k => safeStorage.delete(k, false).catch(() => {})));
      } catch (e) {}
      // Pending-sync map + admin lock + storage canary.
      try { await safeStorage.delete(KEYS.PENDING_SYNC, false); } catch (e) {}
      try { await safeStorage.delete(KEYS.ADMIN_STATUS, false); } catch (e) {}
      try { await safeStorage.delete(KEYS.HEALTH, false); } catch (e) {}
      // Intentionally LEFT alone: KEYS.THEME (cosmetic), ONBOARDING
      // prefix (already-seen flags). The user's actual progress lives
      // in Supabase under profile:<id>, untouched.
    } finally {
      // Hard reload so React state is fully reset and boot path
      // re-runs against the cleared cache.
      try { window.location.reload(); } catch (e) {}
    }
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    const err = this.state.error;
    const msg = (err && (err.message || String(err))) || 'Unknown error';
    return (
      <div role="alert" style={{
        minHeight: '100vh', background: '#FBF7ED', color: '#1A2B23',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: 480, width: '100%', background: '#FFFFFF',
          borderRadius: 16, padding: 28,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid #E5DFC9', boxSizing: 'border-box'
        }}>
          <div style={{ fontSize: 40, marginBottom: 8, lineHeight: 1 }}>😕</div>
          <h1 style={{ fontSize: 22, margin: '0 0 8px 0', fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#3A4A40', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            The app hit a render error. Your progress is safe — it&apos;s
            backed up to the cloud. Try one of the options below.
          </p>
          <details style={{
            background: '#F5EFDF', borderRadius: 8, padding: 10,
            marginBottom: 16, fontSize: 12, color: '#7A7263'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Technical details</summary>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: '8px 0 0 0', fontFamily: 'ui-monospace, monospace', fontSize: 11
            }}>{msg}</pre>
          </details>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={this.handleReload} disabled={this.state.wiping} style={{
              padding: '12px 16px', background: '#0F4C4C', color: '#FFFFFF',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: this.state.wiping ? 'wait' : 'pointer', width: '100%',
              opacity: this.state.wiping ? 0.6 : 1
            }}>Reload app</button>
            <button onClick={this.handleResetScreen} disabled={this.state.wiping} style={{
              padding: '12px 16px', background: '#FFFFFF', color: '#0F4C4C',
              border: '1.5px solid #0F4C4C', borderRadius: 10, fontSize: 15, fontWeight: 600,
              cursor: this.state.wiping ? 'wait' : 'pointer', width: '100%',
              opacity: this.state.wiping ? 0.6 : 1
            }}>Go back to Home</button>
            <button onClick={this.handleResetDeviceData} disabled={this.state.wiping} style={{
              padding: '10px 16px', background: 'transparent', color: '#9B5050',
              border: '1px dashed #C9A0A0', borderRadius: 10, fontSize: 13, fontWeight: 500,
              cursor: this.state.wiping ? 'wait' : 'pointer', width: '100%',
              marginTop: 4, opacity: this.state.wiping ? 0.6 : 1
            }}>{this.state.wiping ? 'Clearing…' : 'Reset device data (last resort)'}</button>
          </div>
          <p style={{ fontSize: 11, color: '#7A7263', marginTop: 14, marginBottom: 0, textAlign: 'center' }}>
            Still stuck? Close and reopen the app.
          </p>
        </div>
      </div>
    );
  }
}

// =====================================================================
// THEME
// =====================================================================
const LIGHT_THEME = {
  bg: '#FBF7ED',
  surface: '#FFFFFF',
  surfaceWarm: '#F5EFDF',
  ink: '#1A2B23',
  inkSoft: '#3A4A40',
  muted: '#7A7263',
  primary: '#0F4C4C',
  primarySoft: '#1A6868',
  accent: '#D45A3F',
  accentSoft: '#E68B72',
  success: '#2D7A4F',
  successSoft: '#E7F3EB',
  error: '#C04A2E',
  errorSoft: '#FBE8DF',
  border: '#E8DFC9',
  borderSoft: '#F0E8D2',
  // Section accents — muted, earthy, harmonious with primary/accent
  sec: {
    quick:    '#0F4C4C',  // forest teal
    topic:    '#C6553D',  // muted terracotta
    mock:     '#2D7A4F',  // forest green
    advanced: '#1A2B23',  // ink
    learn:    '#7A4A2E',  // walnut
    revision: '#5A3A6A',  // dusty plum
    library:  '#3A5A2E',  // sage
    stats:    '#3D5A7A'   // dusty blue
  }
};

const DARK_THEME = {
  // Warm-charcoal neutrals with clear, perceptible elevation steps so cards
  // visibly lift off the background instead of blending into it.
  bg: '#15130F',          // deep warm near-black (was a muddy brown)
  surface: '#211D17',     // raised card — clearly separated from bg
  surfaceWarm: '#2B2620', // second elevation step / warm panel
  // Text: crisp warm-white primary, clearly-stepped secondary + tertiary.
  ink: '#F3EEE3',         // ~13:1 on bg — sharp without pure-white glare
  inkSoft: '#CFC8B7',     // secondary headings/labels (~9:1)
  muted: '#A69E8C',       // tertiary text — lifted to stay readable (~6:1)
  // Brand: primary is deep enough that the hard-coded white button/icon text
  // reads on it, while still vivid as a foreground accent on dark.
  primary: '#1F8A7C',
  primarySoft: '#34A695',
  accent: '#DD6450',
  accentSoft: '#B84A33',
  success: '#46AE72',
  successSoft: '#14271B',  // dark green tint for success backgrounds
  error: '#E0664C',
  errorSoft: '#30150F',    // dark red tint for error backgrounds
  border: '#3A332B',       // visible but subtle hairline
  borderSoft: '#2A251F',   // faint divider
  // Section accents — medium tones tuned to work BOTH as solid fills with
  // white icons (home tiles) AND as readable foreground on dark surfaces.
  // `advanced` stays light on purpose: its featured card draws dark text on it.
  sec: {
    quick:    '#258B7E',  // deep teal
    topic:    '#CF5B42',  // terracotta
    mock:     '#34965E',  // forest green
    advanced: '#DBD4C4',  // warm light (featured card uses dark text)
    learn:    '#A66E45',  // walnut
    revision: '#8E6FA4',  // dusty plum
    library:  '#5F8A4C',  // sage
    stats:    '#4E78A8'   // dusty blue
  }
};

// ── BLOOM — dusty rose / mauve ──────────────────────────────────────────────
const BLOOM_THEME = {
  bg: '#FDF5F7',
  surface: '#FFFFFF',
  surfaceWarm: '#F8EAF0',
  ink: '#261822',
  inkSoft: '#42303C',
  muted: '#8A6A78',
  primary: '#8E3D60',
  primarySoft: '#AA5078',
  accent: '#C07848',
  accentSoft: '#D89060',
  success: '#4A7A5A',
  successSoft: '#E8F3EC',
  error: '#B84040',
  errorSoft: '#FAE8E8',
  border: '#EACDD8',
  borderSoft: '#F2DFEA',
  sec: {
    quick:    '#8E3D60',
    topic:    '#C07848',
    mock:     '#4A7A5A',
    advanced: '#261822',
    learn:    '#7A4A5A',
    revision: '#5A4A8A',
    library:  '#3A6A5A',
    stats:    '#5A6A90',
  }
};

// ── DUSK — soft lavender / violet ────────────────────────────────────────────
const DUSK_THEME = {
  bg: '#F5F3FB',
  surface: '#FFFFFF',
  surfaceWarm: '#EDE8F8',
  ink: '#1C1828',
  inkSoft: '#342E48',
  muted: '#786E90',
  primary: '#5C4A9A',
  primarySoft: '#7060B0',
  accent: '#9A5A78',
  accentSoft: '#B87090',
  success: '#4A7A5A',
  successSoft: '#E8F3EC',
  error: '#A03848',
  errorSoft: '#F5E5E8',
  border: '#D0C8F0',
  borderSoft: '#E5E0F8',
  sec: {
    quick:    '#5C4A9A',
    topic:    '#9A5A78',
    mock:     '#4A7A5A',
    advanced: '#1C1828',
    learn:    '#7A5A3A',
    revision: '#8A6AB0',
    library:  '#3A6A5A',
    stats:    '#4A6A9A',
  }
};

// ── MEADOW — sage / soft forest green ────────────────────────────────────────
const MEADOW_THEME = {
  bg: '#F2F6F2',
  surface: '#FFFFFF',
  surfaceWarm: '#E4EEE4',
  ink: '#182218',
  inkSoft: '#2E3E2E',
  muted: '#6A7A6A',
  primary: '#3E6848',
  primarySoft: '#508A5C',
  accent: '#8A6A3A',
  accentSoft: '#A88050',
  success: '#3A7A4A',
  successSoft: '#E5F3E8',
  error: '#9A3838',
  errorSoft: '#F5E5E5',
  border: '#C5D8C5',
  borderSoft: '#D8E8D8',
  sec: {
    quick:    '#3E6848',
    topic:    '#8A6A3A',
    mock:     '#3A7A6A',
    advanced: '#182218',
    learn:    '#5A4A3A',
    revision: '#5A4A7A',
    library:  '#4A6A3A',
    stats:    '#3A5A7A',
  }
};

const THEMES = {
  light:   LIGHT_THEME,
  dark:    DARK_THEME,
  bloom:   BLOOM_THEME,
  dusk:    DUSK_THEME,
  meadow:  MEADOW_THEME,
};

// Metadata for the theme picker in Settings
const LIGHT_THEMES = [
  { id: 'light',  label: 'Classic',  swatch: '#0F4C4C', bg: '#FBF7ED' },
  { id: 'bloom',  label: 'Bloom',    swatch: '#8E3D60', bg: '#FDF5F7' },
  { id: 'dusk',   label: 'Dusk',     swatch: '#5C4A9A', bg: '#F5F3FB' },
  { id: 'meadow', label: 'Meadow',   swatch: '#3E6848', bg: '#F2F6F2' },
];

let T = LIGHT_THEME;
let IS_DARK = false;   // true only when themeMode === 'dark'

// --- Dark-mode foreground helper -------------------------------------------
// A handful of brand/topic colours are intentionally deep so that hard-coded
// white text reads on them when they're used as a *fill*. When that SAME deep
// colour is reused as foreground (text/icon) on a dark surface it becomes
// unreadable. This lifts only colours that are genuinely too dark for a dark
// background; already-bright colours — and everything in light mode — pass
// through unchanged.
function _dmHexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function _dmRgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function _dmRelLum([r, g, b]) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function fgOnDark(hex) {
  if (T !== DARK_THEME || typeof hex !== 'string' || hex[0] !== '#') return hex;
  const rgb = _dmHexToRgb(hex);
  if (_dmRelLum(rgb) >= 0.18) return hex;          // already readable on dark
  const [r, g, b] = rgb, m = 0.55;                  // mix ~55% toward white
  return _dmRgbToHex(r + (255 - r) * m, g + (255 - g) * m, b + (255 - b) * m);
}

const fontStyles = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=DM+Sans:wght@400;500;600;700&display=swap');
.font-display { font-family: 'Fraunces', Georgia, serif; font-feature-settings: 'ss01'; letter-spacing: -0.01em; }
.font-body { font-family: 'DM Sans', system-ui, sans-serif; }
.no-tap-highlight { -webkit-tap-highlight-color: transparent; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.anim-fadeup { animation: fadeUp 0.35s ease-out both; }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
.anim-scalein { animation: scaleIn 0.25s ease-out both; }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
@keyframes slideInRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
.anim-slide-next { animation: slideInRight 0.3s cubic-bezier(0.22,1,0.36,1) both; }
.anim-slide-prev { animation: slideInLeft 0.3s cubic-bezier(0.22,1,0.36,1) both; }

/* ── Theme transition — smooth crossfade when switching colour themes ───────
   Scoped to properties that change between themes. Deliberately excludes
   transform (would fight the active-press scale) and opacity/animation
   (would slow down existing enter animations and the quiz timer). */
*:not([class*="anim-"]):not([class*="animate-"]) {
  transition-property: background-color, border-color, color, box-shadow;
  transition-duration: 180ms;
  transition-timing-function: ease;
}
/* Override: elements that must stay instant (timer digits, progress fills) */
.no-transition, .no-transition * { transition: none !important; }

/* ── Tap / press feedback — cards feel physically pressed ───────────────────
   Applied via the .pressable class. The scale snaps back on release via the
   short duration; the timing-function gives a springy feel. */
.pressable { transition: transform 120ms cubic-bezier(0.34,1.56,0.64,1) !important; }
.pressable:active { transform: scale(0.975) !important; }

/* ── Skeleton shimmer for loading states ────────────────────────────────────*/
@keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
.skeleton-pulse { animation: skeletonPulse 1.4s ease-in-out infinite; }

/* Custom scrollbars — subtle, rounded, and theme-aware. The thumb colour is
   driven by --sb-thumb / --sb-thumb-hover, set on :root from the theme (see the
   themeMode effect in App), so the harsh default white bar never shows in dark
   mode. Inline scrollbarWidth:'none' on horizontal chip rows still overrides
   this and stays hidden. */
* { scrollbar-width: thin; scrollbar-color: var(--sb-thumb, rgba(120,120,120,0.4)) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--sb-thumb, rgba(120,120,120,0.4)); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: var(--sb-thumb-hover, rgba(120,120,120,0.6)); background-clip: padding-box; }
::-webkit-scrollbar-corner { background: transparent; }
`;

// =====================================================================
// TOPICS
// =====================================================================
const TOPICS = [
  { id: 'fund', name: 'Fundamentals of Nursing', icon: '🩺', color: '#0F4C4C' },
  { id: 'anat', name: 'Anatomy & Physiology', icon: '🫀', color: '#7A4A2E' },
  { id: 'msn', name: 'Medical-Surgical Nursing', icon: '💊', color: '#1F5A4A' },
  { id: 'pharm', name: 'Pharmacology', icon: '⚕️', color: '#5A3A6A' },
  { id: 'peds', name: 'Pediatric Nursing', icon: '👶', color: '#C6553D' },
  { id: 'obg', name: 'Obstetrics & Gynaecology', icon: '🤰', color: '#8B3A5A' },
  { id: 'ch', name: 'Community Health', icon: '🏘️', color: '#3A5A2E' },
  { id: 'mhn', name: 'Mental Health Nursing', icon: '🧠', color: '#4A3A7A' },
  { id: 'micro', name: 'Microbiology', icon: '🦠', color: '#5A6A2E' },
  { id: 'nutr', name: 'Nutrition', icon: '🥗', color: '#3A6A4A' }
];

// =====================================================================
// MOTIVATION QUOTES — shown on completion screens, picked by TONE so the
// message fits how the user actually did. A triumphant quote on a 20% score
// reads as mockery; a defeatist quote on 95% reads as wrong. The picker takes
// the score percentage and returns a quote whose tone is appropriate.
//
// Tone buckets:
//   victory  — celebrate genuine excellence (≥75%)
//   growth   — encourage steady progress, recognise effort (40–74%)
//   support  — kind, honest, resilience-themed; never mocks or fake-cheers (<40%)
// =====================================================================
const MOTIVATION_QUOTES = {
  victory: [
    { t: 'Success is the sum of small efforts repeated daily.', a: 'Robert Collier' },
    { t: 'Excellence is not an act, but a habit.', a: 'Will Durant' },
    { t: 'Quality is not an act, it is a habit.', a: 'Aristotle' },
    { t: 'The harder you work, the luckier you get.', a: 'Gary Player' },
    { t: 'Discipline is the bridge between goals and accomplishment.', a: 'Jim Rohn' },
    { t: 'Energy and persistence conquer all things.', a: 'Benjamin Franklin' },
    { t: "Today's accomplishments were yesterday's impossibilities.", a: 'Robert H. Schuller' },
    { t: 'The difference between ordinary and extraordinary is that little extra.', a: 'Jimmy Johnson' },
    { t: 'Confidence comes from discipline and training.', a: 'Robert Kiyosaki' },
    { t: 'Make each day your masterpiece.', a: 'John Wooden' },
    { t: 'Action is the foundational key to all success.', a: 'Pablo Picasso' },
    { t: 'Continuous effort is the key to unlocking your potential.', a: 'Winston Churchill' },
    { t: "Be so good they can't ignore you.", a: 'Steve Martin' },
    { t: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
    { t: 'You are capable of more than you know.', a: 'Unknown' },
    { t: 'Knowledge is power.', a: 'Francis Bacon' }
  ],
  growth: [
    { t: 'Strive for progress, not perfection.', a: 'Unknown' },
    { t: 'Little by little, one travels far.', a: 'Spanish proverb' },
    { t: 'Small steps every day add up to big results.', a: 'Unknown' },
    { t: 'Slow progress is still progress.', a: 'Unknown' },
    { t: 'A river cuts through rock not by power, but by persistence.', a: 'Jim Watkins' },
    { t: 'The expert in anything was once a beginner.', a: 'Helen Hayes' },
    { t: 'Focus on the step in front of you, not the whole staircase.', a: 'Unknown' },
    { t: 'It does not matter how slowly you go, so long as you do not stop.', a: 'Confucius' },
    { t: 'The man who moves a mountain begins by carrying small stones.', a: 'Confucius' },
    { t: "A year from now you'll wish you had started today.", a: 'Karen Lamb' },
    { t: 'Perseverance is many short races, one after another.', a: 'Walter Elliot' },
    { t: 'The future depends on what you do today.', a: 'Mahatma Gandhi' },
    { t: 'Your future is created by what you do today.', a: 'Robert Kiyosaki' },
    { t: 'Learn as if you were to live forever.', a: 'Mahatma Gandhi' },
    { t: 'Discipline equals freedom.', a: 'Jocko Willink' },
    { t: 'Start where you are. Use what you have. Do what you can.', a: 'Arthur Ashe' },
    { t: 'The journey of a thousand miles begins with one step.', a: 'Lao Tzu' },
    { t: 'Goals turn the invisible into the visible.', a: 'Tony Robbins' },
    { t: 'Keep going. Everything you need will come to you.', a: 'Unknown' },
    { t: 'Do something today your future self will thank you for.', a: 'Unknown' }
  ],
  support: [
    { t: 'Fall seven times, stand up eight.', a: 'Japanese proverb' },
    { t: 'Our greatest glory is in rising every time we fall.', a: 'Confucius' },
    { t: 'Failure is the chance to begin again, more intelligently.', a: 'Henry Ford' },
    { t: "I have not failed. I've just found ways that won't work.", a: 'Thomas Edison' },
    { t: 'The comeback is always stronger than the setback.', a: 'Unknown' },
    { t: 'Difficult roads often lead to beautiful destinations.', a: 'Unknown' },
    { t: 'Tough times never last, but tough people do.', a: 'Robert H. Schuller' },
    { t: "Stars can't shine without darkness.", a: 'Unknown' },
    { t: 'The pain you feel today is the strength you feel tomorrow.', a: 'Unknown' },
    { t: 'Success is not final, failure is not fatal: courage counts.', a: 'Winston Churchill' },
    { t: "Don't let yesterday take up too much of today.", a: 'Will Rogers' },
    { t: "Courage doesn't always roar.", a: 'Mary Anne Radmacher' },
    { t: 'It is never too late to be what you might have been.', a: 'George Eliot' },
    { t: 'With the new day comes new strength and new thoughts.', a: 'Eleanor Roosevelt' },
    { t: 'The darkest hour has only sixty minutes.', a: 'Morris Mandel' },
    { t: 'Every expert was once where you are right now.', a: 'Unknown' },
    { t: "Mistakes are proof that you're trying.", a: 'Unknown' },
    { t: "What didn't work today teaches what will work tomorrow.", a: 'Unknown' }
  ]
};

// Pick a quote whose tone matches the score (0–100). Falls back gracefully
// if a bucket is somehow empty. Remembers the last quote shown (module-level,
// persists across completion screens within a session) and re-rolls so the
// same quote never appears twice in a row.
let _lastQuoteText = null;
function pickQuoteForScore(pct) {
  let bucket;
  if (pct >= 75)      bucket = MOTIVATION_QUOTES.victory;
  else if (pct >= 40) bucket = MOTIVATION_QUOTES.growth;
  else                bucket = MOTIVATION_QUOTES.support;
  if (!bucket || bucket.length === 0) bucket = MOTIVATION_QUOTES.growth;
  let pick = bucket[Math.floor(Math.random() * bucket.length)];
  if (bucket.length > 1) {
    let guard = 0;
    while (pick.t === _lastQuoteText && guard < 8) {
      pick = bucket[Math.floor(Math.random() * bucket.length)];
      guard++;
    }
  }
  _lastQuoteText = pick.t;
  return pick;
}

// =====================================================================
// SEED QUESTIONS  (concise but exam-quality, with "why others wrong")
// =====================================================================
const SEED_QUESTIONS = [
  // FUNDAMENTALS
  { id: 'f1', topic: 'fund', sub: 'Vital Signs', type: 'mcq',
    q: 'The normal pulse rate range for a healthy adult at rest is:',
    options: ['40–60 bpm', '60–100 bpm', '100–120 bpm', '120–140 bpm'],
    correct: [1],
    exp: 'Normal adult resting pulse is 60–100 bpm. Below 60 = bradycardia, above 100 = tachycardia. Trained athletes may have a resting rate below 60 due to higher stroke volume, but this is physiological, not pathological.',
    wrong: { 0: 'Bradycardia — abnormally slow except in trained athletes.', 2: 'Mild tachycardia — could be from fever, anxiety, exertion.', 3: 'Significant tachycardia — needs evaluation.' } },
  { id: 'f2', topic: 'fund', sub: 'Medication Safety', type: 'msq',
    q: 'Which of the following are part of the "Rights of Medication Administration"? (Select all that apply)',
    options: ['Right patient', 'Right colour of tablet', 'Right dose', 'Right route', 'Right time', 'Right documentation'],
    correct: [0, 2, 3, 4, 5],
    exp: 'The classic 5 Rights are Patient, Drug, Dose, Route, Time. Modern frameworks extend to 10 Rights including Documentation, Reason, Response, Refuse, and Education. Colour of tablet is never a verification criterion — generics and brands vary in appearance.',
    wrong: { 1: 'Tablet colour varies by manufacturer; never use appearance as the primary verification.' } },
  { id: 'f3', topic: 'fund', sub: 'Infection Control', type: 'mcq',
    q: 'According to WHO, the "5 Moments for Hand Hygiene" does NOT include:',
    options: ['Before touching a patient', 'After body fluid exposure risk', 'Before entering the hospital building', 'After touching patient surroundings'],
    correct: [2],
    exp: 'WHO 5 Moments: (1) Before patient contact, (2) Before aseptic task, (3) After body fluid exposure, (4) After patient contact, (5) After contact with patient surroundings. Entering the building is not one of them — though hand hygiene on entry is good practice.',
    wrong: { 0: 'This is Moment 1.', 1: 'This is Moment 3.', 3: 'This is Moment 5.' } },
  { id: 'f4', topic: 'fund', sub: 'Positioning', type: 'mcq',
    q: 'Which position is most appropriate for a patient with severe dyspnoea?',
    options: ['Supine', 'Trendelenburg', 'High Fowler\'s', 'Left lateral'],
    correct: [2],
    exp: 'High Fowler\'s (60°–90° head elevation) maximises lung expansion by allowing the diaphragm to descend, reducing the work of breathing. Often combined with a pillow on an over-bed table for the patient to lean forward (orthopneic position).',
    wrong: { 0: 'Supine worsens dyspnoea — abdominal contents push the diaphragm up.', 1: 'Trendelenburg (head down) is for hypotension/shock, never dyspnoea.', 3: 'Left lateral helps cardiac output in pregnancy but not dyspnoea generally.' } },
  { id: 'f5', topic: 'fund', sub: 'Asepsis', type: 'mcq',
    q: 'The difference between sterilisation and disinfection is:',
    options: ['Sterilisation kills all microorganisms including spores; disinfection kills most but not necessarily spores', 'Both kill the same organisms but differ in temperature', 'Disinfection is more thorough than sterilisation', 'There is no clinical difference'],
    correct: [0],
    exp: 'Sterilisation = complete destruction of ALL microbial life, including bacterial spores (e.g. autoclaving, ethylene oxide). Disinfection = elimination of most pathogenic organisms but may spare spores (e.g. chemical disinfectants, boiling). Critical instruments need sterilisation; semi-critical may need high-level disinfection.',
    wrong: { 1: 'They differ in completeness, not just temperature.', 2: 'Opposite — sterilisation is more complete.', 3: 'Highly clinically significant — affects what instrument processing method to use.' } },
  { id: 'f6', topic: 'fund', sub: 'Pain Assessment', type: 'mcq',
    q: 'The most reliable indicator of a patient\'s pain is:',
    options: ['Vital sign changes', 'Facial expression', 'Patient\'s self-report', 'Activity level'],
    correct: [2],
    exp: 'Pain is subjective. McCaffery\'s classic definition: "Pain is whatever the experiencing person says it is, existing whenever they say it does." Self-report is gold standard. Use behavioural scales (FLACC, PAINAD) only when self-report is impossible (infants, unconscious, advanced dementia).',
    wrong: { 0: 'Vitals may not change in chronic pain; can change for other reasons.', 1: 'Cultural and individual variation — stoic patients hide pain.', 3: 'Patients in pain may force activity; activity does not rule out pain.' } },

  // ANATOMY & PHYSIOLOGY
  { id: 'a1', topic: 'anat', sub: 'Cardiovascular', type: 'mcq',
    q: 'Normal resting cardiac output in a healthy adult is approximately:',
    options: ['2–3 L/min', '4–8 L/min', '10–12 L/min', '15–20 L/min'],
    correct: [1],
    exp: 'Cardiac Output = Stroke Volume × Heart Rate ≈ 70 mL × 70 bpm ≈ 4.9 L/min. Normal range 4–8 L/min. Can rise to 20+ L/min during heavy exercise. Low CO causes hypoperfusion; very high suggests sepsis or hyperdynamic state.',
    wrong: { 0: 'Too low — would indicate severe cardiac dysfunction.', 2: 'High — seen in exercise, sepsis, hyperthyroidism.', 3: 'Only achievable in peak athletic exertion.' } },
  { id: 'a2', topic: 'anat', sub: 'Renal', type: 'mcq',
    q: 'The functional unit of the kidney is the:',
    options: ['Glomerulus', 'Nephron', 'Bowman\'s capsule', 'Loop of Henle'],
    correct: [1],
    exp: 'The nephron is the functional unit — each kidney has ~1 million. A nephron includes the renal corpuscle (glomerulus + Bowman\'s capsule), proximal tubule, Loop of Henle, distal tubule, and collecting duct. Each part has a specific role in filtration, reabsorption, and secretion.',
    wrong: { 0: 'Glomerulus is part of the nephron, not the whole unit.', 2: 'Bowman\'s capsule surrounds the glomerulus — just one component.', 3: 'Loop of Henle concentrates urine but is one segment of the nephron.' } },
  { id: 'a3', topic: 'anat', sub: 'Nervous System', type: 'msq',
    q: 'Which cranial nerves are purely sensory? (Select all that apply)',
    options: ['I — Olfactory', 'II — Optic', 'III — Oculomotor', 'V — Trigeminal', 'VIII — Vestibulocochlear', 'X — Vagus'],
    correct: [0, 1, 4],
    exp: 'Purely sensory: I (Olfactory), II (Optic), VIII (Vestibulocochlear). Purely motor: III, IV, VI, XI, XII. Mixed: V, VII, IX, X. Mnemonic — "Some Say Marry Money But My Brother Says Big Brains Matter More" (S=Sensory, M=Motor, B=Both).',
    wrong: { 2: 'III is purely motor — eye movements and pupil.', 3: 'V is mixed (facial sensation + muscles of mastication).', 5: 'X is mixed and very widely distributed.' } },
  { id: 'a4', topic: 'anat', sub: 'Endocrine', type: 'mcq',
    q: 'Which hormone is NOT secreted by the anterior pituitary?',
    options: ['Growth hormone (GH)', 'Thyroid-stimulating hormone (TSH)', 'Antidiuretic hormone (ADH)', 'Prolactin'],
    correct: [2],
    exp: 'ADH (vasopressin) is produced in the hypothalamus and stored/released by the POSTERIOR pituitary. Anterior pituitary releases GH, TSH, ACTH, FSH, LH, Prolactin (mnemonic: "GAT FLaP"). Posterior releases only ADH and Oxytocin.',
    wrong: { 0: 'GH — anterior pituitary.', 1: 'TSH — anterior pituitary.', 3: 'Prolactin — anterior pituitary.' } },
  { id: 'a5', topic: 'anat', sub: 'Integumentary', type: 'mcq',
    q: 'The deepest layer of the epidermis is the:',
    options: ['Stratum corneum', 'Stratum lucidum', 'Stratum basale', 'Stratum granulosum'],
    correct: [2],
    exp: 'Epidermal layers (deep to superficial): Basale → Spinosum → Granulosum → Lucidum (only in thick skin) → Corneum. Mnemonic "Be Sure Get Lots of Coffee". Stratum basale is where mitosis occurs — new keratinocytes are born here and pushed upward.',
    wrong: { 0: 'Corneum is the most superficial layer (dead, keratinised).', 1: 'Lucidum is just below corneum, in thick skin only.', 3: 'Granulosum is the middle layer where keratin granules form.' } },
  { id: 'a6', topic: 'anat', sub: 'Blood', type: 'mcq',
    q: 'The normal haemoglobin range for adult females is:',
    options: ['8–10 g/dL', '10–12 g/dL', '12–15 g/dL', '15–17 g/dL'],
    correct: [2],
    exp: 'Adult females: 12–15 g/dL. Adult males: 13.5–17.5 g/dL. WHO defines anaemia as <12 in non-pregnant women, <11 in pregnant women, <13 in men. India has very high prevalence of anaemia in reproductive-age women.',
    wrong: { 0: 'Severe anaemia — symptomatic.', 1: 'Mild anaemia by most cut-offs.', 3: 'Male range; would be polycythaemia in a female.' } },

  // MEDICAL-SURGICAL
  { id: 'm1', topic: 'msn', sub: 'Cardiac', type: 'mcq',
    q: 'A patient with suspected acute MI arrives in the ER. The FIRST nursing action is:',
    options: ['Administer aspirin 325 mg', 'Obtain 12-lead ECG', 'Establish IV access', 'Provide oxygen if SpO₂ < 94%'],
    correct: [1],
    exp: 'For chest pain protocol, 12-lead ECG within 10 minutes is the priority — it determines whether the patient has STEMI (needing immediate reperfusion) or NSTEMI/unstable angina. Aspirin, IV access, and oxygen follow rapidly, but ECG drives the entire pathway.',
    wrong: { 0: 'Aspirin is given quickly but ECG comes first to confirm cardiac origin.', 2: 'IV access happens in parallel but ECG is the diagnostic priority.', 3: 'Routine oxygen is no longer recommended if SpO₂ ≥ 94% — and ECG is still first.' } },
  { id: 'm2', topic: 'msn', sub: 'Endocrine', type: 'mcq',
    q: 'A diabetic patient is found drowsy with deep, sighing respirations and fruity breath. The most likely diagnosis is:',
    options: ['Hypoglycaemia', 'Diabetic ketoacidosis', 'Hyperosmolar hyperglycaemic state', 'Lactic acidosis'],
    correct: [1],
    exp: 'Classic DKA triad: hyperglycaemia + ketosis + metabolic acidosis. Kussmaul breathing (deep, sighing) is compensation for acidosis. Fruity breath = exhaled acetone. Usually in Type 1 DM. Management: fluids → insulin → potassium replacement → correct underlying cause.',
    wrong: { 0: 'Hypoglycaemia: tremor, sweating, confusion — NOT Kussmaul or fruity breath.', 2: 'HHS: very high glucose, minimal ketosis, no acidosis → no Kussmaul; more common in Type 2.', 3: 'Lactic acidosis — possible but no fruity breath; different context (sepsis, metformin).' } },
  { id: 'm3', topic: 'msn', sub: 'Respiratory', type: 'mcq',
    q: 'The hallmark physiological difference between asthma and COPD is:',
    options: ['Asthma is reversible airway obstruction; COPD is largely irreversible', 'COPD only affects smokers', 'Asthma never causes hyperinflation', 'COPD has no inflammatory component'],
    correct: [0],
    exp: 'Asthma = reversible bronchoconstriction (responds well to bronchodilators, post-bronchodilator spirometry normalises). COPD = chronic, progressive, mostly irreversible airflow limitation due to emphysema + chronic bronchitis. Both involve inflammation but the pattern and reversibility differ.',
    wrong: { 1: 'COPD is mostly smoking-related but also caused by biomass fuel exposure, alpha-1 antitrypsin deficiency, occupational dust.', 2: 'Acute severe asthma absolutely causes hyperinflation.', 3: 'COPD has neutrophilic inflammation; asthma has more eosinophilic inflammation.' } },
  { id: 'm4', topic: 'msn', sub: 'Surgical', type: 'mcq',
    q: 'The most common cause of post-operative fever in the first 24 hours is:',
    options: ['Wound infection', 'Atelectasis', 'Urinary tract infection', 'Deep vein thrombosis'],
    correct: [1],
    exp: 'The "5 W\'s" of post-op fever by timing: Wind (atelectasis, day 1) → Water (UTI, day 3) → Wound (infection, day 5) → Walking (DVT, day 5–7) → Wonder drugs (drug reaction, anytime). Atelectasis from shallow breathing post-anaesthesia is by far the commonest day-1 cause. Encourage incentive spirometry, ambulation, deep breathing.',
    wrong: { 0: 'Wound infection typically appears day 5+.', 2: 'UTI typically day 3+ (catheter-related).', 3: 'DVT typically day 5–7+ when ambulation is delayed.' } },
  { id: 'm5', topic: 'msn', sub: 'Blood', type: 'mcq',
    q: 'During a blood transfusion, the patient develops fever, chills, low back pain and dark urine. The nurse should FIRST:',
    options: ['Slow the transfusion to KVO rate', 'Stop the transfusion immediately', 'Give paracetamol', 'Inform the doctor and continue at slower rate'],
    correct: [1],
    exp: 'These are signs of acute haemolytic transfusion reaction (most often due to ABO incompatibility) — a life-threatening emergency. STOP the transfusion immediately. Keep the IV line open with normal saline (using a NEW set, not the contaminated tubing). Notify the doctor and blood bank. Send unit + post-transfusion sample for cross-match recheck.',
    wrong: { 0: 'Even slow rate continues to deliver incompatible blood — never slow, always STOP.', 2: 'Paracetamol is for febrile non-haemolytic reactions, after stopping; symptoms here indicate haemolysis.', 3: 'Continuing in any form is contraindicated.' } },
  { id: 'm6', topic: 'msn', sub: 'Renal', type: 'mcq',
    q: 'Which electrolyte abnormality is most life-threatening in chronic kidney disease?',
    options: ['Hyponatraemia', 'Hyperkalaemia', 'Hypocalcaemia', 'Hypermagnesaemia'],
    correct: [1],
    exp: 'Hyperkalaemia causes peaked T waves → widened QRS → sine wave pattern → cardiac arrest. ECG changes mandate immediate treatment: calcium gluconate (cardioprotection), insulin+dextrose / salbutamol / bicarbonate (intracellular shift), then dialysis or resin (true removal). The mnemonic "C BIG K DROP" captures this.',
    wrong: { 0: 'Hyponatraemia is common but slower-developing.', 2: 'Hypocalcaemia in CKD causes secondary hyperparathyroidism — chronic, not acutely fatal.', 3: 'Hypermagnesaemia matters mostly with magnesium-containing antacids in CKD.' } },
  { id: 'm7', topic: 'msn', sub: 'Neuro', type: 'mcq',
    q: 'A Glasgow Coma Scale score of 8 indicates:',
    options: ['Mild head injury', 'Moderate head injury', 'Severe head injury', 'Normal level of consciousness'],
    correct: [2],
    exp: 'GCS categories: 13–15 mild, 9–12 moderate, 3–8 severe. "GCS 8 — intubate" is the classic teaching, because at this level the airway is at risk. Maximum is 15 (E4 V5 M6), minimum is 3 (E1 V1 M1) — never zero.',
    wrong: { 0: 'Mild = 13–15.', 1: 'Moderate = 9–12.', 3: 'Normal = 15.' } },
  { id: 'm8', topic: 'msn', sub: 'Oncology', type: 'mcq',
    q: 'The most important nursing priority for a patient receiving chemotherapy with absolute neutrophil count of 400/µL is:',
    options: ['Adequate hydration', 'Protective isolation / neutropenic precautions', 'Pain assessment', 'Nutritional support'],
    correct: [1],
    exp: 'ANC < 500 = severe neutropenia. Risk of life-threatening infection is extreme. Neutropenic precautions: private room, no fresh flowers, no raw fruits/vegetables, strict hand hygiene, visitor screening, daily mouth care, monitor temperature — fever ≥38°C is a medical emergency (neutropenic fever) requiring blood cultures and empirical broad-spectrum antibiotics within 1 hour.',
    wrong: { 0: 'Important but not priority over infection risk.', 2: 'Important but secondary to infection risk.', 3: 'Important but secondary.' } },

  // PHARMACOLOGY
  { id: 'p1', topic: 'pharm', sub: 'Insulin', type: 'mcq',
    q: 'Which insulin has the fastest onset of action?',
    options: ['Regular (Actrapid)', 'NPH (Insulatard)', 'Lispro / Aspart', 'Glargine'],
    correct: [2],
    exp: 'Rapid-acting analogues (Lispro, Aspart, Glulisine): onset 5–15 min, peak 1 h, duration 3–4 h — give within 15 min of meal. Regular: 30–60 min onset (give 30 min pre-meal). NPH: intermediate, 1–2 h onset. Glargine/Detemir: long-acting, no peak, ~24 h.',
    wrong: { 0: 'Regular is short-acting, 30 min onset.', 1: 'NPH is intermediate-acting.', 3: 'Glargine is long-acting basal insulin.' } },
  { id: 'p2', topic: 'pharm', sub: 'Cardiac', type: 'mcq',
    q: 'Early signs of digoxin toxicity include all EXCEPT:',
    options: ['Anorexia and nausea', 'Yellow-green visual halos', 'Bradycardia', 'Hypokalaemia symptoms'],
    correct: [3],
    exp: 'Digoxin toxicity: GI symptoms (anorexia, nausea — often FIRST), visual disturbances (yellow/green halos — xanthopsia), arrhythmias (bradycardia, heart blocks, ventricular ectopy). Importantly, hypokalaemia PREDISPOSES to digoxin toxicity rather than being caused by it. Therapeutic level: 0.5–2.0 ng/mL.',
    wrong: { 0: 'Classic early symptom.', 1: 'Classic visual sign.', 2: 'AV block / bradycardia are common toxic effects.' } },
  { id: 'p3', topic: 'pharm', sub: 'Anticoagulation', type: 'mcq',
    q: 'The antidote for warfarin overdose is:',
    options: ['Protamine sulphate', 'Vitamin K', 'Naloxone', 'Flumazenil'],
    correct: [1],
    exp: 'Vitamin K (phytomenadione) reverses warfarin by replenishing vitamin K-dependent clotting factors (II, VII, IX, X). For life-threatening bleeding, give FFP or prothrombin complex concentrate (PCC) for immediate reversal — vitamin K alone takes hours. Protamine is for heparin. Naloxone for opioids. Flumazenil for benzodiazepines.',
    wrong: { 0: 'Protamine sulphate reverses heparin.', 2: 'Naloxone reverses opioid overdose.', 3: 'Flumazenil reverses benzodiazepines.' } },
  { id: 'p4', topic: 'pharm', sub: 'Antibiotics', type: 'msq',
    q: 'Aminoglycosides (e.g. gentamicin, amikacin) require monitoring for which adverse effects? (Select all that apply)',
    options: ['Nephrotoxicity', 'Ototoxicity', 'Neuromuscular blockade', 'Hepatotoxicity', 'QT prolongation'],
    correct: [0, 1, 2],
    exp: 'Aminoglycoside adverse effects: Nephrotoxicity (proximal tubular damage — monitor creatinine), Ototoxicity (both vestibular and cochlear — irreversible deafness possible), Neuromuscular blockade (potentiates muscle relaxants — caution in myasthenia gravis). They are NOT typically hepatotoxic or QT-prolonging. Therapeutic drug monitoring (trough and peak levels) reduces risk.',
    wrong: { 3: 'Aminoglycosides are not hepatotoxic — they are excreted unchanged in urine.', 4: 'QT prolongation is associated with macrolides and fluoroquinolones, not aminoglycosides.' } },
  { id: 'p5', topic: 'pharm', sub: 'CNS', type: 'mcq',
    q: 'A patient on phenytoin should be educated to watch for which adverse effect?',
    options: ['Hair loss', 'Gingival hyperplasia', 'Weight loss', 'Hyperpigmentation'],
    correct: [1],
    exp: 'Phenytoin classic adverse effects: Gingival hyperplasia (40–50% — emphasise oral hygiene), hirsutism, coarse facial features, ataxia, nystagmus, megaloblastic anaemia (folate antagonism), Stevens-Johnson syndrome. Therapeutic level 10–20 µg/mL — narrow therapeutic index.',
    wrong: { 0: 'Hair growth (hirsutism) is more typical than hair loss.', 2: 'Weight gain is more common than loss.', 3: 'Phenytoin causes "fetal hydantoin syndrome" in pregnancy but hyperpigmentation is not typical.' } },
  { id: 'p6', topic: 'pharm', sub: 'Respiratory', type: 'mcq',
    q: 'Salbutamol acts primarily by:',
    options: ['Beta-1 adrenergic agonism', 'Beta-2 adrenergic agonism', 'Alpha-1 antagonism', 'Muscarinic antagonism'],
    correct: [1],
    exp: 'Salbutamol is a selective β2-agonist → bronchodilation. Side effects come from spillover to β2 receptors elsewhere (tremor, hypokalaemia) and at high doses to β1 (tachycardia, palpitations). For chronic COPD/asthma, combined LABA + ICS is preferred. Ipratropium (muscarinic antagonist) is alternative bronchodilator.',
    wrong: { 0: 'β1 agonism increases heart rate (e.g. dobutamine).', 2: 'α1 antagonism lowers BP (e.g. prazosin).', 3: 'Muscarinic antagonism describes ipratropium, not salbutamol.' } },

  // PEDIATRICS
  { id: 'pe1', topic: 'peds', sub: 'Immunisation', type: 'mcq',
    q: 'According to the Indian Universal Immunisation Programme (UIP), BCG vaccine is given:',
    options: ['At birth', 'At 6 weeks', 'At 9 months', 'At 16 months'],
    correct: [0],
    exp: 'UIP at birth: BCG, OPV-0, Hepatitis B-0. At 6, 10, 14 weeks: OPV + Pentavalent (DPT+HepB+Hib) + Rotavirus + fIPV + PCV. At 9 months: MR-1 + JE-1 (in endemic areas) + Vit A. 16–24 months: DPT booster + OPV booster + MR-2. 5–6 years: DPT booster. 10 & 16 years: Td.',
    wrong: { 1: '6 weeks is for first dose of pentavalent, OPV, rotavirus, etc.', 2: '9 months is MR-1.', 3: '16 months is DPT booster, MR-2.' } },
  { id: 'pe2', topic: 'peds', sub: 'Newborn', type: 'mcq',
    q: 'APGAR score is assessed at:',
    options: ['1 and 5 minutes after birth', 'Immediately at birth only', '1, 5 and 10 minutes', 'Every minute for 10 minutes'],
    correct: [0],
    exp: 'APGAR is routinely assessed at 1 minute (immediate adaptation) and 5 minutes (response to resuscitation). If 5-minute score < 7, repeat every 5 minutes up to 20 minutes. Components: Appearance (colour), Pulse, Grimace (reflex), Activity (tone), Respiration — each 0–2, max 10. 7–10 normal, 4–6 moderate distress, 0–3 severe.',
    wrong: { 1: 'Immediate is too early to assess response to interventions.', 2: '10-minute only if 5-min score was abnormal.', 3: 'Not the routine schedule.' } },
  { id: 'pe3', topic: 'peds', sub: 'Growth', type: 'mcq',
    q: 'An infant typically doubles their birth weight by:',
    options: ['3 months', '5 months', '9 months', '12 months'],
    correct: [1],
    exp: 'Weight milestones: Doubles by 5 months, triples by 1 year, quadruples by 2 years. Length: increases ~25 cm in first year. Head circumference: increases ~12 cm in first year. Average newborn 2.5–3.5 kg; if below 2.5 kg = low birth weight (LBW).',
    wrong: { 0: 'Too early — only ~50% gain by then.', 2: 'By 9 months ~2.5× birth weight.', 3: 'By 1 year weight has tripled, not just doubled.' } },
  { id: 'pe4', topic: 'peds', sub: 'IMNCI', type: 'mcq',
    q: 'In IMNCI, which sign in a child aged 2 months – 5 years classifies pneumonia as "severe"?',
    options: ['Fast breathing only', 'Chest indrawing', 'Runny nose', 'Mild cough'],
    correct: [1],
    exp: 'IMNCI cough/breathing classification: NO PNEUMONIA = no fast breathing, no chest indrawing. PNEUMONIA = fast breathing alone (≥50/min for 2–12 m, ≥40/min for 1–5 yr). SEVERE PNEUMONIA = chest indrawing OR any general danger sign (not feeding, lethargy, convulsions, vomiting everything). Severe requires urgent referral after first dose of antibiotic.',
    wrong: { 0: 'Fast breathing alone = pneumonia, not severe.', 2: 'Runny nose without fast breathing = no pneumonia.', 3: 'Mild cough alone = no pneumonia.' } },
  { id: 'pe5', topic: 'peds', sub: 'Fluids', type: 'mcq',
    q: 'The Holliday-Segar formula for daily maintenance fluid in a 25 kg child is:',
    options: ['1000 mL', '1500 mL', '1600 mL', '2500 mL'],
    correct: [2],
    exp: 'Holliday-Segar: 100 mL/kg for first 10 kg, 50 mL/kg for next 10 kg, 20 mL/kg for each additional kg. For 25 kg = (10×100) + (10×50) + (5×20) = 1000 + 500 + 100 = 1600 mL/day. Hourly rate (4-2-1 rule): 4+2+1 = 65 mL/hr for the same child.',
    wrong: { 0: 'Only covers first 10 kg.', 1: 'Missed the third tier (20 mL/kg above 20 kg).', 3: 'Excessive — would risk overload.' } },
  { id: 'pe6', topic: 'peds', sub: 'Diarrhoea', type: 'mcq',
    q: 'WHO recommends which type of ORS for acute diarrhoea in children?',
    options: ['High-osmolarity ORS (311 mOsm/L)', 'Low-osmolarity ORS (245 mOsm/L)', 'Plain rice water', 'Coconut water alone'],
    correct: [1],
    exp: 'Low-osmolarity ORS (Na+ 75, K+ 20, glucose 75, citrate 10, Cl- 65 mmol/L; total 245 mOsm/L) is WHO/UNICEF standard since 2002 — reduces stool output, vomiting, and need for IV therapy compared to the old high-osmolarity formula. Plus zinc supplementation for 10–14 days reduces severity and recurrence.',
    wrong: { 0: 'Old formula — replaced because of higher osmolarity.', 2: 'Useful as home fluid but not balanced electrolyte replacement.', 3: 'Inadequate sodium content.' } },

  // OBG
  { id: 'o1', topic: 'obg', sub: 'Labour', type: 'mcq',
    q: 'The first stage of labour begins with:',
    options: ['Onset of regular uterine contractions', 'Full cervical dilatation (10 cm)', 'Delivery of the baby', 'Delivery of the placenta'],
    correct: [0],
    exp: 'Stage 1: onset of regular painful contractions → full dilatation (10 cm). Subdivided into latent (0–6 cm, slow) and active (6–10 cm, faster, ~1 cm/hr in primigravida). Stage 2: full dilatation → birth of baby. Stage 3: birth of baby → expulsion of placenta. Stage 4: 1–2 hr observation post-placenta.',
    wrong: { 1: 'Full dilatation marks the END of Stage 1.', 2: 'Birth of baby is the END of Stage 2.', 3: 'Placenta delivery ends Stage 3.' } },
  { id: 'o2', topic: 'obg', sub: 'Hypertension', type: 'msq',
    q: 'Severe pre-eclampsia is defined by which of the following? (Select all that apply)',
    options: ['BP ≥ 160/110 mmHg', 'Proteinuria > 300 mg/24 hr', 'Platelets < 100,000/µL', 'Persistent epigastric pain', 'BP ≥ 140/90 mmHg'],
    correct: [0, 2, 3],
    exp: 'Pre-eclampsia = BP ≥140/90 + proteinuria (≥300 mg/24h) or end-organ damage, after 20 weeks. SEVERE features: BP ≥160/110, platelets <100k, transaminases ≥2×ULN, creatinine >1.1 or doubled, pulmonary oedema, persistent headache, visual changes, epigastric/RUQ pain. Eclampsia adds seizures. HELLP = Haemolysis + Elevated Liver enzymes + Low Platelets.',
    wrong: { 1: 'Proteinuria alone qualifies for pre-eclampsia diagnosis but not the "severe" label.', 4: 'BP ≥140/90 defines pre-eclampsia in general, not severe.' } },
  { id: 'o3', topic: 'obg', sub: 'Postpartum', type: 'mcq',
    q: 'The most common cause of primary postpartum haemorrhage (PPH) is:',
    options: ['Uterine atony', 'Retained placenta', 'Genital tract trauma', 'Coagulopathy'],
    correct: [0],
    exp: 'The "4 T\'s" of PPH: Tone (uterine atony — 70%, commonest), Trauma (lacerations — 20%), Tissue (retained placenta — 10%), Thrombin (coagulopathy — 1%). Primary PPH = >500 mL within 24 h (or >1000 mL after C-section). Management: massage, oxytocin, ergometrine, carboprost, misoprostol, bimanual compression, surgical options.',
    wrong: { 1: 'Retained placenta is ~10% of cases.', 2: 'Trauma ~20%.', 3: 'Coagulopathy is rare but life-threatening.' } },
  { id: 'o4', topic: 'obg', sub: 'Antenatal', type: 'mcq',
    q: 'According to the Government of India, the minimum number of antenatal care visits recommended is:',
    options: ['2', '3', '4', '8'],
    correct: [2],
    exp: 'India\'s "Pradhan Mantri Surakshit Matritva Abhiyan" (PMSMA) and earlier RCH guidelines recommend minimum 4 ANC visits: 1st within 1st trimester, 2nd 14–26 weeks, 3rd 28–34 weeks, 4th 36 weeks to term. WHO 2016 actually recommends 8 contacts for better outcomes, and India is gradually adopting this. The exam answer depends on which guideline — but for NORCET, 4 is the standard answer.',
    wrong: { 0: 'Below the recommended minimum.', 1: 'Below the recommended minimum.', 3: 'WHO 2016 recommendation; not yet the official Indian minimum.' } },
  { id: 'o5', topic: 'obg', sub: 'Family Planning', type: 'mcq',
    q: 'Which contraceptive method has the highest typical-use failure rate?',
    options: ['Copper-T 380A IUCD', 'Oral combined contraceptive pills', 'Condom', 'Calendar (rhythm) method'],
    correct: [3],
    exp: 'Typical-use failure rates: Implant <0.1%, IUCD 0.2–0.8%, Sterilisation <0.5%, OCPs ~9%, Condom ~13%, Withdrawal ~20%, Calendar/rhythm ~24%. Calendar method depends on regular cycles and disciplined avoidance during fertile window — highly user-dependent.',
    wrong: { 0: 'IUCD highly effective.', 1: 'OCPs have ~9% typical-use failure (mostly missed pills).', 2: 'Condom ~13% — better than rhythm.' } },
  { id: 'o6', topic: 'obg', sub: 'Foetal', type: 'mcq',
    q: 'Normal foetal heart rate at term is:',
    options: ['80–100 bpm', '110–160 bpm', '170–200 bpm', '200–220 bpm'],
    correct: [1],
    exp: 'Normal FHR: 110–160 bpm. <110 = bradycardia (consider cord compression, maternal hypotension, foetal hypoxia). >160 = tachycardia (consider maternal fever, chorioamnionitis, dehydration, foetal hypoxia, drugs). Variability and accelerations indicate well-being; late decelerations are ominous (uteroplacental insufficiency).',
    wrong: { 0: 'Bradycardia — concerning.', 2: 'Tachycardia.', 3: 'Severe tachycardia.' } },

  // COMMUNITY HEALTH
  { id: 'c1', topic: 'ch', sub: 'Health Indicators', type: 'mcq',
    q: 'Infant Mortality Rate (IMR) is defined as deaths under 1 year per:',
    options: ['1,000 population', '1,000 live births', '10,000 population', '100,000 live births'],
    correct: [1],
    exp: 'IMR = (Deaths < 1 year / Live births) × 1000 in a given year. India\'s IMR is steadily declining (~28 per 1000 live births per SRS 2020). Neonatal Mortality Rate (NMR) = deaths in first 28 days / 1000 live births. Under-5 Mortality Rate (U5MR) per 1000 live births. Maternal Mortality Ratio (MMR) per 100,000 live births.',
    wrong: { 0: 'Wrong denominator — IMR uses live births.', 2: 'Wrong scale.', 3: 'This is the MMR denominator.' } },
  { id: 'c2', topic: 'ch', sub: 'National Programmes', type: 'mcq',
    q: 'The Revised National Tuberculosis Control Programme (RNTCP) was renamed in 2020 to:',
    options: ['National Tuberculosis Programme (NTP)', 'National Tuberculosis Elimination Programme (NTEP)', 'TB Elimination Mission (TBEM)', 'India TB Free Initiative (ITFI)'],
    correct: [1],
    exp: 'RNTCP was renamed to NTEP — National Tuberculosis Elimination Programme — in 2020, reflecting India\'s commitment to eliminate TB by 2025, five years ahead of the global SDG target of 2030. Strategy: detect, treat, prevent, build (the 4 pillars of National Strategic Plan).',
    wrong: { 0: 'Old programme name from before RNTCP.', 2: 'Not the official name.', 3: 'Not the official name.' } },
  { id: 'c3', topic: 'ch', sub: 'Levels of Prevention', type: 'mcq',
    q: 'Administering BCG vaccine to a newborn is an example of:',
    options: ['Primordial prevention', 'Primary prevention', 'Secondary prevention', 'Tertiary prevention'],
    correct: [1],
    exp: 'Primary prevention = preventing disease BEFORE it occurs (immunisation, health education, sanitation). Primordial = preventing risk factor emergence (e.g. promoting healthy lifestyle in entire populations). Secondary = early detection in asymptomatic stage (screening). Tertiary = limiting disability and rehabilitation in established disease.',
    wrong: { 0: 'Primordial prevents the underlying risk factor, not disease directly.', 2: 'Screening like Pap smear is secondary.', 3: 'Rehabilitation after a stroke is tertiary.' } },
  { id: 'c4', topic: 'ch', sub: 'Epidemiology', type: 'mcq',
    q: 'Herd immunity threshold depends on:',
    options: ['Vaccine cost', 'Basic reproduction number (R₀)', 'Country population', 'Number of healthcare workers'],
    correct: [1],
    exp: 'Herd immunity threshold ≈ 1 − (1/R₀). Higher R₀ → higher threshold needed. Measles (R₀ ~12–18) needs ~95% coverage. Polio ~5–7 needs ~80–86%. COVID-19 (original) ~2–3 needed ~50–67% but waning immunity and new variants complicated this.',
    wrong: { 0: 'Cost affects implementation, not the biological threshold.', 2: 'Population size doesn\'t change the threshold proportion.', 3: 'Workforce affects delivery, not the threshold.' } },
  { id: 'c5', topic: 'ch', sub: 'Water & Sanitation', type: 'mcq',
    q: 'According to WHO, the minimum daily water requirement per person for all purposes is approximately:',
    options: ['20 litres', '50 litres', '100 litres', '200 litres'],
    correct: [1],
    exp: 'WHO recommendations: minimum 20 L/person/day for survival (drinking, basic cooking, basic hygiene), 50 L/person/day as a basic access standard (covers drinking, cooking, hygiene, laundry), 100+ L/person/day for full needs. In emergencies, the SPHERE standard is 15 L/person/day.',
    wrong: { 0: 'Survival minimum only.', 2: 'Optimal but not minimum.', 3: 'Above optimal.' } },
  { id: 'c6', topic: 'ch', sub: 'Programmes', type: 'msq',
    q: 'Which of the following are National Health Programmes in India? (Select all that apply)',
    options: ['NTEP (TB)', 'NACP (HIV/AIDS)', 'NLEP (Leprosy)', 'NMHP (Mental Health)', 'NIDDCP (Iodine Deficiency)'],
    correct: [0, 1, 2, 3, 4],
    exp: 'All five are major National Health Programmes: NTEP (Tuberculosis Elimination), NACP (National AIDS Control Programme), NLEP (National Leprosy Eradication Programme), NMHP (National Mental Health Programme, since 1982), NIDDCP (National Iodine Deficiency Disorders Control Programme). Other key ones: NVBDCP (Vector Borne), RCH, NPCDCS (NCDs), Pulse Polio.',
    wrong: {} },

  // MENTAL HEALTH
  { id: 'mh1', topic: 'mhn', sub: 'Schizophrenia', type: 'msq',
    q: 'Which of the following are POSITIVE symptoms of schizophrenia? (Select all that apply)',
    options: ['Delusions', 'Hallucinations', 'Flat affect', 'Disorganised speech', 'Avolition', 'Anhedonia'],
    correct: [0, 1, 3],
    exp: 'Positive symptoms = ADDITIONS to normal mental life: delusions, hallucinations, disorganised speech/behaviour. Negative symptoms = SUBTRACTIONS: flat affect (5 A\'s — Affect flat, Alogia, Anhedonia, Avolition, Asociality). Antipsychotics work better on positive symptoms.',
    wrong: { 2: 'Flat affect is a negative symptom.', 4: 'Avolition (loss of motivation) is negative.', 5: 'Anhedonia (inability to feel pleasure) is negative.' } },
  { id: 'mh2', topic: 'mhn', sub: 'Defence Mechanisms', type: 'mcq',
    q: 'A patient with terminal illness insists they have been misdiagnosed and continues making future plans. This is an example of:',
    options: ['Denial', 'Projection', 'Rationalisation', 'Reaction formation'],
    correct: [0],
    exp: 'Denial = refusal to accept a painful reality. Kübler-Ross stages of grief begin with denial. Projection = attributing one\'s unacceptable feelings to others. Rationalisation = creating logical-sounding excuses. Reaction formation = behaving opposite to actual unconscious feeling (e.g. excessive kindness to someone you hate).',
    wrong: { 1: 'Projection attributes feelings outward.', 2: 'Rationalisation creates excuses.', 3: 'Reaction formation is opposite behaviour.' } },
  { id: 'mh3', topic: 'mhn', sub: 'ECT', type: 'mcq',
    q: 'The most common indication for Electroconvulsive Therapy (ECT) is:',
    options: ['Mild anxiety disorder', 'Severe depression with suicidal risk or catatonia', 'Personality disorder', 'Substance abuse'],
    correct: [1],
    exp: 'ECT is indicated for severe major depression (especially with suicidal intent, psychotic features, or catatonia), treatment-resistant depression, severe mania, and catatonia. Modern ECT is given under general anaesthesia with muscle relaxants — safe and effective. Main side effect: temporary memory impairment (especially retrograde and anterograde for events around treatment).',
    wrong: { 0: 'Anxiety is not an ECT indication.', 2: 'Personality disorders need long-term psychotherapy.', 3: 'Substance abuse needs detox and behavioural therapy.' } },
  { id: 'mh4', topic: 'mhn', sub: 'Therapeutic Communication', type: 'mcq',
    q: 'A patient says: "I just feel like there is no point to anything anymore." The most therapeutic nurse response is:',
    options: ['"Don\'t worry, everyone feels that way sometimes."', '"Are you thinking about hurting yourself?"', '"You should focus on the positives in your life."', '"Why do you feel this way?"'],
    correct: [1],
    exp: 'When suicidal ideation is suspected, ASK DIRECTLY and calmly. Research shows asking does NOT plant the idea — it actually opens the door to help. Avoid: false reassurance, minimising, giving advice, or "why" questions (which feel interrogative). Validating + exploring + assessing safety is the priority.',
    wrong: { 0: 'False reassurance — dismissive.', 2: 'Giving advice; minimises feelings.', 3: '"Why" questions feel judgemental and often unanswerable.' } },

  // MICROBIOLOGY
  { id: 'mi1', topic: 'micro', sub: 'Gram Staining', type: 'mcq',
    q: 'Gram-positive bacteria appear which colour after Gram staining?',
    options: ['Pink/red', 'Purple/violet', 'Blue', 'Yellow'],
    correct: [1],
    exp: 'Gram staining: crystal violet → iodine (mordant) → alcohol/acetone (decolouriser) → safranin (counterstain). Gram-POSITIVE retain the violet/purple (thick peptidoglycan holds the crystal violet-iodine complex). Gram-NEGATIVE lose violet during decolourisation, take up safranin → pink/red. Mnemonic: P for Positive = Purple.',
    wrong: { 0: 'Gram-negative.', 2: 'Not a Gram stain colour.', 3: 'Not a Gram stain colour.' } },
  { id: 'mi2', topic: 'micro', sub: 'Sterilisation', type: 'mcq',
    q: 'Standard autoclave parameters for sterilisation are:',
    options: ['100 °C, 5 psi, 5 minutes', '121 °C, 15 psi, 15 minutes', '160 °C dry heat, 1 hour', '80 °C, 30 psi, 30 minutes'],
    correct: [1],
    exp: 'Standard autoclave (moist heat sterilisation): 121 °C at 15 psi for 15–20 minutes. Kills all microorganisms including bacterial spores. High-vacuum autoclaves achieve 134 °C for 3 minutes. Dry heat (hot air oven) needs higher temperature/longer time: 160 °C for 2 hours OR 180 °C for 30 min — used for glassware, oils, powders.',
    wrong: { 0: 'Inadequate — won\'t kill spores.', 2: 'Dry heat parameters typically need longer.', 3: 'Not a standard combination.' } },
  { id: 'mi3', topic: 'micro', sub: 'Tuberculosis', type: 'mcq',
    q: 'Which staining technique is used to identify Mycobacterium tuberculosis?',
    options: ['Gram stain', 'Ziehl-Neelsen acid-fast stain', 'India ink', 'Giemsa stain'],
    correct: [1],
    exp: 'M. tuberculosis has a waxy mycolic-acid-rich cell wall that resists Gram staining. Ziehl-Neelsen (acid-fast) stain: carbol fuchsin (heat) → acid-alcohol decoloriser → methylene blue counterstain. Acid-fast organisms retain red. NTEP also uses fluorescent auramine-rhodamine staining for sputum microscopy + CB-NAAT (GeneXpert) for rapid diagnosis with drug resistance detection.',
    wrong: { 0: 'TB does NOT stain well with Gram method.', 2: 'India ink for Cryptococcus.', 3: 'Giemsa for malaria, leishmania.' } },
  { id: 'mi4', topic: 'micro', sub: 'HAI', type: 'mcq',
    q: 'The most common type of hospital-acquired infection (HAI) is:',
    options: ['Surgical site infection', 'Urinary tract infection', 'Pneumonia', 'Bloodstream infection'],
    correct: [1],
    exp: 'CAUTI (catheter-associated UTI) is the commonest HAI worldwide. Prevention: avoid unnecessary catheterisation, use aseptic insertion, maintain closed drainage system, remove catheter ASAP. Other major HAIs: VAP (ventilator-associated pneumonia), SSI (surgical site infection), CLABSI (central line-associated bloodstream infection).',
    wrong: { 0: 'SSI is significant but not the most common.', 2: 'VAP is common in ICUs but UTI is overall most common.', 3: 'Bloodstream infections are less common than UTIs but high mortality.' } },

  // NUTRITION
  { id: 'n1', topic: 'nutr', sub: 'BMI', type: 'mcq',
    q: 'A BMI of 24 kg/m² is classified as (Asian-Indian criteria):',
    options: ['Underweight', 'Normal', 'Overweight', 'Obese'],
    correct: [2],
    exp: 'Asian-Indian BMI cut-offs (lower than WHO international, due to higher cardiometabolic risk at lower BMI): <18.5 underweight, 18.5–22.9 normal, 23.0–24.9 OVERWEIGHT, ≥25 obese. Standard WHO: <18.5 / 18.5–24.9 / 25.0–29.9 / ≥30. So 24 is "normal" by WHO but "overweight" by Indian standards. Modern Indian exam papers usually use Asian-Indian cut-offs.',
    wrong: { 0: 'BMI < 18.5.', 1: 'Indian normal is 18.5–22.9.', 3: 'Indian obese is ≥25.' } },
  { id: 'n2', topic: 'nutr', sub: 'Vitamin Deficiency', type: 'mcq',
    q: 'Night blindness in children is caused by deficiency of:',
    options: ['Vitamin A', 'Vitamin B12', 'Vitamin C', 'Vitamin D'],
    correct: [0],
    exp: 'Vitamin A (retinol) deficiency: night blindness (earliest), Bitot\'s spots, conjunctival xerosis, corneal xerosis, keratomalacia (irreversible blindness). India\'s National Vitamin A Prophylaxis Programme gives oral mega-doses: 100,000 IU at 9 months, then 200,000 IU every 6 months till 5 years. Mnemonic: A = Avision (vision).',
    wrong: { 1: 'B12 deficiency: pernicious anaemia, neuropathy.', 2: 'Vitamin C: scurvy.', 3: 'Vitamin D: rickets in children, osteomalacia in adults.' } },
  { id: 'n3', topic: 'nutr', sub: 'Diet Therapy', type: 'mcq',
    q: 'A patient on chronic haemodialysis should restrict intake of:',
    options: ['Protein, all fluids and sodium', 'Potassium, phosphate, sodium and fluids', 'Carbohydrates', 'Calcium and iron'],
    correct: [1],
    exp: 'Dialysis diet: restrict potassium (oranges, bananas, tomatoes, coconut water — risk of hyperkalaemic arrhythmia), phosphate (dairy, nuts, processed foods — bone disease), sodium and fluid (between dialysis sessions). Protein intake is actually INCREASED (1.2–1.4 g/kg/day) because dialysis removes protein. Calcium often supplemented; iron and EPO given for anaemia.',
    wrong: { 0: 'Protein is INCREASED, not restricted.', 2: 'Carbs not specifically restricted.', 3: 'Calcium and iron are often supplemented.' } },
  { id: 'n4', topic: 'nutr', sub: 'Pregnancy', type: 'mcq',
    q: 'The recommended daily iron and folic acid supplementation during pregnancy in India is:',
    options: ['30 mg iron + 100 µg folic acid', '60 mg iron + 500 µg folic acid', '100 mg iron + 1000 µg folic acid', '20 mg iron + 50 µg folic acid'],
    correct: [1],
    exp: 'National Anaemia Prophylaxis: ALL pregnant women receive IFA tablets (60 mg elemental iron + 500 µg folic acid) daily for ≥180 days during pregnancy AND ≥180 days postpartum. If Hb < 11 g/dL, dose doubles to therapeutic. Folic acid 400 µg/day preconceptionally prevents neural tube defects (most effective if started 1 month before conception and continued through first trimester).',
    wrong: { 0: 'Below the national recommendation.', 2: 'Higher than prophylaxis — would be therapeutic dose.', 3: 'Far below recommendation.' } },
  // =====================================================================
  // AIIMS / NORCET-level high-yield questions (difficulty: hard).
  // Application/clinical-vignette style with mechanism-based explanations
  // and a rationale for every distractor. IDs prefixed 'x' to stay unique.
  // =====================================================================
  // FUNDAMENTALS
  { id: 'xf1', topic: 'fund', sub: 'IV Therapy', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'A peripheral IV site is cool, pale and swollen with no blood return and a slowed drip rate. This most likely indicates:',
    options: ['Phlebitis', 'Infiltration', 'Extravasation', 'Air embolism'],
    correct: [1],
    exp: 'Infiltration = leakage of a NON-vesicant fluid into surrounding tissue → a cool, pale, swollen site with absent blood return and slowed flow. Phlebitis is the opposite picture (warm, red, tender along the vein). Extravasation is infiltration of a VESICANT drug. Action: stop the infusion, remove the cannula, elevate the limb, apply the appropriate compress.',
    wrong: { 0: 'Phlebitis is warm, red and tender — vein wall inflammation, not a cool, pale swelling.', 2: 'Extravasation specifically involves a tissue-damaging vesicant drug.', 3: 'Air embolism causes sudden dyspnoea and chest pain, not a localised cool swelling.' } },
  { id: 'xf2', topic: 'fund', sub: 'Fluid Balance', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Which finding BEST indicates a fluid volume deficit?',
    options: ['Bounding pulse', 'Distended neck veins', 'Urine specific gravity 1.030', 'Crackles in the lung bases'],
    correct: [2],
    exp: 'Concentrated urine (specific gravity >1.025–1.030) reflects kidneys conserving water in hypovolaemia. Deficit signs: tachycardia, weak thready pulse, dry mucosa, falling urine output, postural hypotension, raised specific gravity. The other three are OVERLOAD signs.',
    wrong: { 0: 'A bounding pulse suggests fluid overload.', 1: 'Distended neck veins indicate volume overload / right heart failure.', 3: 'Basal crackles suggest pulmonary congestion from overload.' } },
  { id: 'xf3', topic: 'fund', sub: 'Pressure Injury', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'A pressure injury presents as intact skin with localised non-blanchable erythema over a bony prominence. This is staged as:',
    options: ['Stage 1', 'Stage 2', 'Stage 3', 'Deep tissue injury'],
    correct: [0],
    exp: 'Stage 1 = intact skin with non-blanchable redness. Stage 2 = partial-thickness loss with exposed dermis (shallow ulcer/blister). Stage 3 = full-thickness loss with visible fat. Stage 4 = exposed bone/tendon/muscle. Intact skin + non-blanchable redness is the hallmark of Stage 1.',
    wrong: { 1: 'Stage 2 involves partial-thickness skin LOSS (blister/abrasion), not intact skin.', 2: 'Stage 3 shows full-thickness loss with visible subcutaneous fat.', 3: 'Deep tissue injury is a persistent deep maroon/purple discolouration or blood-filled blister.' } },

  // ANATOMY & PHYSIOLOGY
  { id: 'xa1', topic: 'anat', sub: 'Acid-Base Balance', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'ABG: pH 7.30, PaCO\u2082 30 mmHg, HCO\u2083\u207b 15 mEq/L. This represents:',
    options: ['Respiratory acidosis', 'Metabolic acidosis with respiratory compensation', 'Respiratory alkalosis', 'Metabolic alkalosis'],
    correct: [1],
    exp: 'Low pH = acidosis. The low HCO\u2083\u207b (15) is the primary metabolic problem \u2192 metabolic acidosis. The low PaCO\u2082 (30) shows the lungs blowing off CO\u2082 to compensate (Kussmaul breathing). Use ROME: Respiratory Opposite, Metabolic Equal \u2014 here pH and HCO\u2083\u207b move the SAME direction (both down), so it is metabolic.',
    wrong: { 0: 'Respiratory acidosis would show a HIGH PaCO\u2082.', 2: 'Respiratory alkalosis would have a HIGH pH.', 3: 'Metabolic alkalosis would have a high pH and high HCO\u2083\u207b.' } },
  { id: 'xa2', topic: 'anat', sub: 'Renal', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'When blood pressure falls, the kidney releases renin. Renin ultimately raises BP mainly by:',
    options: ['Acting directly as a vasoconstrictor', 'Converting angiotensinogen straight to angiotensin II', 'Generating angiotensin II, which vasoconstricts and stimulates aldosterone', 'Inhibiting ADH release'],
    correct: [2],
    exp: 'Renin converts angiotensinogen \u2192 angiotensin I; ACE (largely in the lungs) converts angiotensin I \u2192 angiotensin II. Angiotensin II is a potent vasoconstrictor AND stimulates aldosterone (Na\u207a/water retention) and ADH \u2014 all raising BP. Renin itself is an enzyme, not a vasoconstrictor.',
    wrong: { 0: 'Renin is an enzyme; it does not directly constrict vessels.', 1: 'Renin first produces angiotensin I; ACE then makes angiotensin II.', 3: 'Angiotensin II actually STIMULATES ADH to retain water.' } },
  { id: 'xa3', topic: 'anat', sub: 'Respiratory', type: 'msq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'Which factors shift the oxygen\u2013haemoglobin dissociation curve to the RIGHT (releasing more O\u2082 to tissues)? (Select all that apply)',
    options: ['Increased CO\u2082', 'Decreased pH (acidosis)', 'Increased temperature', 'Decreased 2,3-DPG'],
    correct: [0, 1, 2],
    exp: 'A right shift means haemoglobin gives up O\u2082 more readily to active tissue (Bohr effect). Causes: \u2191CO\u2082, \u2191H\u207a/\u2193pH, \u2191temperature, \u2191 2,3-DPG \u2014 all markers of metabolically active tissue. A LEFT shift (Hb holds O\u2082) occurs with the opposite: \u2193CO\u2082, alkalosis, hypothermia, \u2193 2,3-DPG, and fetal haemoglobin.',
    wrong: { 3: 'DECREASED 2,3-DPG causes a LEFT shift (Hb holds onto O\u2082) \u2014 the opposite effect.' } },

  // MEDICAL-SURGICAL NURSING
  { id: 'xm1', topic: 'msn', sub: 'Cardiac', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'A patient with chest pain shows ST-segment ELEVATION in leads II, III and aVF. Which coronary artery is most likely occluded?',
    options: ['Left anterior descending (LAD)', 'Right coronary artery (RCA)', 'Left circumflex', 'Left main'],
    correct: [1],
    exp: 'Leads II, III, aVF = INFERIOR wall, supplied by the RCA in most people. Inferior MIs can involve the SA/AV node (also RCA-supplied) \u2014 watch for bradycardia / heart block. LAD = anterior (V1\u2013V4); circumflex = lateral (I, aVL, V5\u2013V6).',
    wrong: { 0: 'LAD occlusion causes an ANTERIOR MI (V1\u2013V4).', 2: 'The circumflex supplies the LATERAL wall (I, aVL, V5\u2013V6).', 3: 'Left main occlusion is catastrophic, affecting a large anterolateral territory.' } },
  { id: 'xm2', topic: 'msn', sub: 'Neurology', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'A patient arrives 2 hours after onset of an ischaemic stroke. Before giving thrombolytic (rtPA), the MOST critical step is to:',
    options: ['Give aspirin immediately', 'Rule out haemorrhage with a non-contrast CT head', 'Start IV heparin', 'Lower the BP rapidly to normal'],
    correct: [1],
    exp: 'Thrombolytics dissolve clots \u2014 giving them in a HAEMORRHAGIC stroke is fatal. A non-contrast CT must exclude bleeding before rtPA, which is only for ischaemic stroke within the window (\u22644.5 h). Aspirin is withheld for 24 h after thrombolysis; heparin is not routine acutely; BP is only treated if very high (>185/110) before tPA.',
    wrong: { 0: 'Aspirin is delayed for 24 h after thrombolysis to limit bleeding.', 2: 'Heparin is not standard acute therapy and adds bleeding risk.', 3: 'Aggressively normalising BP can worsen cerebral perfusion; only extreme HTN is treated pre-tPA.' } },
  { id: 'xm3', topic: 'msn', sub: 'Respiratory', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Why is oxygen given cautiously (controlled low-flow) to a patient with chronic CO\u2082-retaining COPD?',
    options: ['High O\u2082 causes oxygen toxicity within minutes', 'They rely on hypoxic drive; high O\u2082 can blunt respiratory drive and worsen CO\u2082 retention', 'Oxygen dries the airways', 'It increases the risk of fire'],
    correct: [1],
    exp: 'In chronic CO\u2082 retainers the central chemoreceptors are desensitised to CO\u2082, so breathing is partly driven by LOW oxygen (hypoxic drive). High-flow O\u2082 can reduce that drive and worsen V/Q matching, raising CO\u2082 toward narcosis. Target SpO\u2082 ~88\u201392% using controlled (e.g. Venturi) delivery.',
    wrong: { 0: 'Oxygen toxicity needs prolonged high concentrations, not minutes.', 2: 'Drying is managed with humidification and is not the core danger.', 3: 'Fire risk exists but is not the physiological reason for caution.' } },

  // PHARMACOLOGY
  { id: 'xp1', topic: 'pharm', sub: 'Anticoagulants', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'A patient is on IV unfractionated heparin. Which monitoring test and reversal agent are correct?',
    options: ['Monitor INR; reverse with vitamin K', 'Monitor aPTT; reverse with protamine sulphate', 'Monitor platelets only; reverse with FFP', 'Monitor aPTT; reverse with vitamin K'],
    correct: [1],
    exp: 'Unfractionated heparin is monitored by aPTT and reversed by protamine sulphate. Warfarin is monitored by INR/PT and reversed by vitamin K (plus FFP/PCC if urgent). A classic exam trap is to swap these. Also monitor platelets for HIT.',
    wrong: { 0: 'INR + vitamin K belong to WARFARIN, not heparin.', 2: 'FFP is not the specific heparin antidote; protamine is.', 3: 'Vitamin K reverses warfarin, not heparin.' } },
  { id: 'xp2', topic: 'pharm', sub: 'Endocrine Drugs', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Regular (short-acting) insulin is given at 0800. Hypoglycaemia is MOST likely around:',
    options: ['0815', '1030', '1700', 'Midnight'],
    correct: [1],
    exp: 'Regular insulin: onset ~30 min, PEAK ~2\u20133 h, duration ~6\u20138 h. The peak carries the highest hypoglycaemia risk \u2192 ~2\u20133 h after 0800 \u2248 1030. Know the peaks: rapid (lispro/aspart) ~1 h; regular ~2\u20133 h; NPH ~4\u201312 h; glargine is essentially peakless.',
    wrong: { 0: '15 minutes is before regular insulin has meaningfully started acting.', 2: '1700 is past its main action window.', 3: 'Midnight is well beyond regular insulin\'s duration.' } },
  { id: 'xp3', topic: 'pharm', sub: 'Corticosteroids', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'A patient on long-term corticosteroids should be monitored for all of the following EXCEPT:',
    options: ['Hyperglycaemia', 'Osteoporosis', 'Hypokalaemia', 'Hypotension'],
    correct: [3],
    exp: 'Glucocorticoids cause HYPERtension (mineralocorticoid effect: Na\u207a and water retention), not hypotension. Expected effects to monitor: hyperglycaemia, osteoporosis, hypokalaemia, weight gain, immunosuppression/infection, peptic ulcer, mood change, Cushingoid features. Never stop steroids abruptly \u2192 risk of adrenal crisis.',
    wrong: { 0: 'Steroids raise blood glucose \u2014 monitor it.', 1: 'Long-term steroids cause bone loss.', 2: 'Na\u207a retention drives K\u207a loss \u2192 hypokalaemia.' } },

  // PAEDIATRIC NURSING
  { id: 'xpe1', topic: 'peds', sub: 'Immunisation', type: 'msq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Under the Indian Universal Immunisation Programme (UIP), which vaccines are given AT BIRTH? (Select all that apply)',
    options: ['BCG', 'OPV-0', 'Hepatitis B birth dose', 'DPT', 'Measles / MR'],
    correct: [0, 1, 2],
    exp: 'At birth (for institutional deliveries): BCG, OPV-0, and Hepatitis B birth dose (within 24 h). DPT (within pentavalent) begins at 6 weeks. Measles/MR is given at 9\u201312 months. Birth doses target early TB, polio, and vertical hepatitis B transmission.',
    wrong: { 3: 'DPT (in pentavalent) starts at 6 weeks, not at birth.', 4: 'Measles / MR is given at 9\u201312 months.' } },
  { id: 'xpe2', topic: 'peds', sub: 'Growth & Development', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'A healthy infant can usually sit WITHOUT support by approximately:',
    options: ['2 months', '4 months', '6\u20138 months', '12 months'],
    correct: [2],
    exp: 'Gross motor milestones: head control ~3\u20134 mo, rolls over ~5 mo, sits without support ~6\u20138 mo, crawls ~9 mo, stands with support ~9\u201310 mo, walks ~12\u201315 mo. "Sits at six" is the memory hook. Significant delay warrants developmental assessment.',
    wrong: { 0: 'At 2 months the infant only briefly lifts the head when prone.', 1: 'At 4 months head control is developing but independent sitting is not yet expected.', 3: 'By 12 months most infants are pulling to stand and starting to walk.' } },
  { id: 'xpe3', topic: 'peds', sub: 'Newborn Assessment', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'The five components of the APGAR score are Appearance, Pulse, Grimace, Activity and:',
    options: ['Reflex', 'Respiration', 'Reaction', 'Rate'],
    correct: [1],
    exp: 'APGAR = Appearance (colour), Pulse (heart rate), Grimace (reflex irritability), Activity (muscle tone), Respiration (respiratory effort). Each scored 0\u20132 at 1 and 5 minutes. 7\u201310 normal, 4\u20136 moderately depressed, 0\u20133 severely depressed needing resuscitation.',
    wrong: { 0: '"Reflex" is captured under Grimace, not a separate component.', 2: '"Reaction" is not an APGAR component.', 3: 'Heart rate is captured under Pulse; "Rate" alone is not the term.' } },

  // OBSTETRICS & GYNAECOLOGY
  { id: 'xo1', topic: 'obg', sub: 'Pre-eclampsia', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'A woman with severe pre-eclampsia is on IV magnesium sulphate. Which finding indicates magnesium TOXICITY requiring you to stop the infusion?',
    options: ['Brisk deep tendon reflexes', 'Respiratory rate 10/min with absent knee reflexes', 'Urine output 60 mL/hr', 'BP 150/95 mmHg'],
    correct: [1],
    exp: 'Magnesium toxicity progresses: loss of deep tendon reflexes \u2192 respiratory depression (<12/min) \u2192 cardiac arrest. Monitor reflexes, RR (\u226512/min) and urine output (\u226530 mL/hr, since Mg is renally cleared). Antidote: IV calcium gluconate. Absent reflexes + RR 10 = stop and give calcium gluconate.',
    wrong: { 0: 'Brisk reflexes suggest the level is NOT yet toxic.', 2: 'Adequate urine output (\u226530 mL/hr) is reassuring.', 3: 'This BP reflects the pre-eclampsia being treated, not Mg toxicity.' } },
  { id: 'xo2', topic: 'obg', sub: 'Labour', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'The second stage of labour is defined as:',
    options: ['Onset of true contractions to full dilatation', 'Full cervical dilatation to delivery of the baby', 'Delivery of the baby to delivery of the placenta', 'The first hour after delivery'],
    correct: [1],
    exp: 'First stage: onset of true labour \u2192 full (10 cm) dilatation. Second stage: full dilatation \u2192 birth of the baby. Third stage: birth of baby \u2192 delivery of the placenta. Fourth stage: ~1 h after the placenta (immediate recovery, watch for PPH).',
    wrong: { 0: 'That describes the FIRST stage.', 2: 'That is the THIRD (placental) stage.', 3: 'That is the FOURTH stage.' } },
  { id: 'xo3', topic: 'obg', sub: 'Postpartum', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'The most common cause of primary postpartum haemorrhage is:',
    options: ['Retained placenta', 'Uterine atony', 'Genital tract trauma', 'Coagulation disorder'],
    correct: [1],
    exp: 'The "4 Ts" of PPH: Tone (atony), Tissue (retained products), Trauma (lacerations), Thrombin (coagulopathy). Uterine ATONY causes ~70\u201380% \u2014 a boggy uterus that fails to contract. First action: firm fundal massage and uterotonics (oxytocin). Atony is the leading cause worldwide.',
    wrong: { 0: 'Retained tissue is a cause but far less common than atony.', 2: 'Trauma matters when the uterus is firm yet bleeding continues.', 3: 'Coagulopathy (Thrombin) is the least common of the 4 Ts.' } },

  // COMMUNITY HEALTH
  { id: 'xc1', topic: 'ch', sub: 'Epidemiology', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Vaccinating a high proportion of a population to indirectly protect the unvaccinated is the principle of:',
    options: ['Herd immunity', 'Passive immunity', 'Cold chain', 'Cross immunity'],
    correct: [0],
    exp: 'Herd (community) immunity: when enough people are immune, transmission chains break, indirectly protecting those who cannot be vaccinated (infants, immunocompromised). The threshold depends on R\u2080 (measles needs ~95%). Passive immunity = ready-made antibodies (maternal, immunoglobulin).',
    wrong: { 1: 'Passive immunity is transfer of pre-formed antibodies and is short-lived.', 2: 'Cold chain is the temperature-controlled vaccine supply system.', 3: 'Cross immunity is protection against a related organism \u2014 a different concept.' } },
  { id: 'xc2', topic: 'ch', sub: 'Water & Sanitation', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Chlorination of drinking water primarily aims to:',
    options: ['Remove turbidity', 'Soften the water', 'Kill pathogenic micro-organisms', 'Remove dissolved iron'],
    correct: [2],
    exp: 'Chlorination disinfects \u2014 it kills pathogens. Minimum recommended free residual chlorine after 1 h contact is 0.5 mg/L; the orthotolidine (OT) test checks residual chlorine. Turbidity must be removed FIRST by sedimentation and filtration, because chlorine works poorly in turbid water.',
    wrong: { 0: 'Turbidity is removed earlier by sedimentation and filtration.', 1: 'Hardness is reduced by water-softening methods, not chlorine.', 3: 'Iron is removed by aeration/oxidation, not by chlorination.' } },
  { id: 'xc3', topic: 'ch', sub: 'Vital Statistics', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'The Infant Mortality Rate (IMR) expresses deaths under 1 year of age per:',
    options: ['1,000 mid-year population', '1,000 live births in the same year', '100,000 women', '1,000 under-5 children'],
    correct: [1],
    exp: 'IMR = (infant deaths under 1 year in a year \u00f7 live births in the same year) \u00d7 1,000. It is a sensitive index of a population\'s health and socio-economic status. Don\'t confuse it with Under-5 Mortality Rate, Neonatal MR (<28 days), or the Maternal Mortality Ratio (per 100,000 live births).',
    wrong: { 0: 'The crude death rate uses mid-year population; IMR uses live births.', 2: 'Per 100,000 women relates to maternal mortality.', 3: 'Under-5 deaths per 1,000 live births is the U5MR.' } },

  // MENTAL HEALTH NURSING
  { id: 'xmh1', topic: 'mhn', sub: 'Defence Mechanisms', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'A man angry with his boss goes home and shouts at his children. This defence mechanism is:',
    options: ['Projection', 'Displacement', 'Sublimation', 'Reaction formation'],
    correct: [1],
    exp: 'Displacement = transferring feelings from a threatening target (the boss) to a safer one (the children). Projection = attributing your own unacceptable feelings to others. Sublimation (mature) = channelling impulses into acceptable activity (aggression \u2192 sport). Reaction formation = behaving the opposite of true feelings.',
    wrong: { 0: 'Projection is attributing one\'s own feelings or impulses to someone else.', 2: 'Sublimation channels the impulse into a constructive outlet.', 3: 'Reaction formation is acting opposite to what one truly feels.' } },
  { id: 'xmh2', topic: 'mhn', sub: 'Psychopharmacology', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'A patient on lithium develops coarse tremor, vomiting, slurred speech and ataxia. The priority nursing action is to:',
    options: ['Encourage a low-sodium diet', 'Withhold the next dose and check the serum lithium level', 'Increase fluid restriction', 'Give the next dose early'],
    correct: [1],
    exp: 'These are signs of lithium toxicity (therapeutic 0.6\u20131.2 mEq/L; toxic >1.5). Withhold the drug and check a level. Lithium and sodium are handled similarly by the kidney, so LOW sodium or dehydration RAISES lithium toward toxicity \u2014 maintain normal salt and fluid intake, never restrict.',
    wrong: { 0: 'A low-sodium diet RAISES lithium levels and worsens toxicity.', 2: 'Fluid restriction / dehydration increases lithium reabsorption \u2014 dangerous.', 3: 'Giving more lithium during toxicity is harmful.' } },
  { id: 'xmh3', topic: 'mhn', sub: 'Therapeutic Communication', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Which is an example of a THERAPEUTIC communication technique?',
    options: ['"Why did you do that?"', '"Everything will be fine, don\'t worry."', '"You seem upset \u2014 tell me more about what you\'re feeling."', 'Changing the subject to something cheerful'],
    correct: [2],
    exp: 'Offering an observation plus an open-ended invitation ("tell me more") encourages the patient to express feelings \u2014 therapeutic. "Why" questions sound accusatory; false reassurance dismisses feelings; changing the subject blocks communication. Active listening, silence, reflection and clarification are the helpful tools.',
    wrong: { 0: '"Why" questions can feel interrogating and put patients on the defensive.', 1: 'False reassurance dismisses the patient\'s real concerns.', 3: 'Changing the subject is a communication block.' } },

  // MICROBIOLOGY
  { id: 'xmi1', topic: 'micro', sub: 'Sterilisation', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'The most reliable way to CONFIRM that autoclave sterilisation has been effective is:',
    options: ['Chemical indicator tape colour change', 'A biological indicator using Geobacillus stearothermophilus spores', 'The autoclave timer reading', 'Visual cleanliness of the instruments'],
    correct: [1],
    exp: 'A biological indicator (heat-resistant Geobacillus stearothermophilus spores) is the GOLD STANDARD \u2014 if these spores are killed, sterilisation worked. Chemical/tape indicators only confirm the item was EXPOSED to the process, not that it was effective. Standard autoclave: 121\u00b0C at 15 psi for 15 min (or 134\u00b0C for 3 min).',
    wrong: { 0: 'Tape only confirms exposure, not that organisms were actually killed.', 2: 'A timer shows duration, not biological kill.', 3: 'Visual cleanliness says nothing about microbial sterility.' } },
  { id: 'xmi2', topic: 'micro', sub: 'Infection Precautions', type: 'msq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Which conditions require AIRBORNE precautions (negative-pressure room + N95)? (Select all that apply)',
    options: ['Pulmonary tuberculosis', 'Measles', 'Chickenpox (varicella)', 'Influenza'],
    correct: [0, 1, 2],
    exp: 'Airborne precautions are for organisms in droplet nuclei (<5 \u00b5m) that stay suspended \u2014 remember "M-T-V": Measles, TB, Varicella (and disseminated zoster). These need a negative-pressure room and an N95 respirator. Influenza spreads by larger DROPLETS (>5 \u00b5m) \u2192 droplet precautions with a surgical mask.',
    wrong: { 3: 'Influenza spreads by droplets, needing droplet precautions (surgical mask), not airborne.' } },
  { id: 'xmi3', topic: 'micro', sub: 'Occupational Safety', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'After a needle-stick from a known Hepatitis B-positive source, an UNVACCINATED nurse should receive:',
    options: ['Hepatitis B vaccine only', 'Hepatitis B immunoglobulin (HBIG) plus start the vaccine series', 'A course of antibiotics', 'No action if asymptomatic'],
    correct: [1],
    exp: 'For a non-immune exposed person with an HBsAg-positive source: give HBIG (immediate passive antibodies) AND start the Hep B vaccine series (active immunity) as soon as possible, ideally within 24 h. First wash the site with soap and water; then report and document. Antibiotics do not treat a virus.',
    wrong: { 0: 'Vaccine alone is too slow against a known positive source \u2014 add HBIG.', 2: 'Antibiotics are useless against a virus.', 3: 'Doing nothing risks seroconversion; prophylaxis is time-critical.' } },

  // NUTRITION
  { id: 'xn1', topic: 'nutr', sub: 'Vitamins', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'Night blindness, conjunctival xerosis and Bitot\'s spots are classic features of deficiency of:',
    options: ['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K'],
    correct: [0],
    exp: 'Vitamin A deficiency causes ocular signs: night blindness (earliest), conjunctival xerosis, Bitot\'s spots, then keratomalacia and blindness. India runs a Vitamin A prophylaxis programme (1 lakh IU at 9 months, then 2 lakh IU 6-monthly up to 5 years). Vitamin C \u2192 scurvy; D \u2192 rickets; K \u2192 bleeding.',
    wrong: { 1: 'Vitamin C deficiency causes scurvy (bleeding gums, poor healing).', 2: 'Vitamin D deficiency causes rickets / osteomalacia.', 3: 'Vitamin K deficiency causes bleeding from impaired clotting factors.' } },
  { id: 'xn2', topic: 'nutr', sub: 'Malnutrition', type: 'mcq', difficulty: 'hard', source: 'PYQ AIIMS',
    q: 'A child with generalised pitting oedema, "flaky-paint" dermatosis and a puffy "moon" face most likely has:',
    options: ['Marasmus', 'Kwashiorkor', 'Marasmic-kwashiorkor', 'Nutritional dwarfism'],
    correct: [1],
    exp: 'Kwashiorkor = protein deficiency with relatively adequate calories \u2192 OEDEMA (pitting), hair/skin changes ("flaky paint"), fatty liver, moon face, apathy. Marasmus = energy deficiency \u2192 severe wasting, "old-man" facies, NO oedema. Pitting oedema is the distinguishing feature pointing to kwashiorkor.',
    wrong: { 0: 'Marasmus shows severe wasting WITHOUT oedema.', 2: 'Marasmic-kwashiorkor has both wasting AND oedema; the puffy picture here fits pure kwashiorkor.', 3: 'Nutritional dwarfism is stunting from chronic undernutrition, without the acute oedema picture.' } },
  { id: 'xn3', topic: 'nutr', sub: 'Therapeutic Diets', type: 'mcq', difficulty: 'hard', source: 'PYQ NORCET',
    q: 'A patient with chronic kidney disease on conservative (pre-dialysis) management should generally have a diet that is:',
    options: ['High protein and high potassium', 'Low protein with restricted potassium and phosphorus', 'High sodium with high fluid', 'High phosphorus and low calcium'],
    correct: [1],
    exp: 'In pre-dialysis CKD, restrict protein (less urea/nitrogenous waste), potassium (hyperkalaemia risk \u2192 arrhythmia), phosphorus (renal osteodystrophy), sodium and fluid (oedema/HTN). Keep calories adequate to prevent catabolism. Once on dialysis, protein needs INCREASE because dialysis removes amino acids.',
    wrong: { 0: 'High potassium is dangerous in CKD; protein is restricted pre-dialysis.', 2: 'Sodium and fluid are restricted to control oedema and BP.', 3: 'Phosphorus is restricted; calcium balance is managed with binders, not phosphorus loading.' } }
];

// =====================================================================
// CONCEPT CARDS  (Learn mode - the "video alternative")
// =====================================================================
const CONCEPT_CARDS = {
  fund: [
    { sub: 'Vital Signs', cards: [
      { type: 'concept', title: 'Normal Vital Sign Ranges (Adult)', body: 'Pulse: 60–100 bpm\nRespiratory rate: 12–20 /min\nBP: <120/80 ideal\nTemperature: 36.5–37.5 °C orally\nSpO₂: 95–100%\n\nKnow the cut-offs — questions often hide on the borderline values.' },
      { type: 'mnemonic', title: 'Remember Hypertension Stages', body: 'JNC 8 / ACC-AHA:\n• Normal: <120/<80\n• Elevated: 120–129 / <80\n• Stage 1: 130–139 / 80–89\n• Stage 2: ≥140 / ≥90\n• Crisis: >180 / >120 → emergency if end-organ damage\n\nMemory hook: "13/8 starts the stage."' },
      { type: 'keypoints', title: 'When Vitals Are Lying', body: ['Patient just ran in → wait 5 min before BP', 'Cuff too small → falsely HIGH', 'Cuff too large → falsely low', 'Hot drink within 15 min → oral temp unreliable', 'Cold extremity → SpO₂ inaccurate', 'White-coat HTN → patient nervous in clinic'] },
      { type: 'quiz', title: 'Quick Self-Check', body: 'Pulse 110 in a febrile patient — primary or compensatory tachycardia?\n\nAnswer: COMPENSATORY. Each 1°C above 38.3 °C raises HR by ~10 bpm. Treat the fever, recheck the pulse.' }
    ]},
    { sub: 'Infection Control', cards: [
      { type: 'concept', title: 'WHO 5 Moments of Hand Hygiene', body: '1. BEFORE touching a patient\n2. BEFORE clean/aseptic procedure\n3. AFTER body fluid exposure risk\n4. AFTER touching a patient\n5. AFTER touching patient surroundings\n\nMoments 1, 2 protect the patient. Moments 3, 4, 5 protect YOU and OTHERS.' },
      { type: 'mnemonic', title: 'Levels of Asepsis', body: 'Cleaning < Disinfection < Sterilisation\n\n• Cleaning: removes visible dirt\n• Disinfection: kills most microbes (not always spores)\n• Sterilisation: kills ALL, including spores\n\nSpaulding classification:\n• Critical (enters sterile tissue) → Sterilise\n• Semi-critical (mucosa contact) → High-level disinfection\n• Non-critical (skin contact) → Low-level disinfection' },
      { type: 'keypoints', title: 'PPE Donning vs Doffing', body: ['Don IN ORDER: Gown → Mask → Goggles → Gloves', 'Doff IN OPPOSITE ORDER (mostly): Gloves → Goggles → Gown → Mask', 'Most contaminated piece comes off first', 'Mask comes off LAST (highest infectious risk near face)', 'Hand hygiene between each step'] }
    ]}
  ],
  anat: [
    { sub: 'Cardiac', cards: [
      { type: 'concept', title: 'The Cardiac Cycle in 30 Seconds', body: 'DIASTOLE (relaxation, filling):\n• Atria contract → push final 20–30% blood into ventricles\n• "Atrial kick" — lost in AFib\n\nSYSTOLE (contraction, ejection):\n• AV valves CLOSE → S1 ("lub")\n• Ventricles contract isovolumetrically\n• Aortic & pulmonary valves open\n• Blood ejects\n• Semilunar valves CLOSE → S2 ("dub")\n\nStroke Volume = End-Diastolic − End-Systolic Volume' },
      { type: 'mnemonic', title: 'Heart Sounds', body: 'S1 ("lub") — AV valves closing — beginning of systole\nS2 ("dub") — semilunar valves closing — end of systole\nS3 — early diastole rapid filling — normal in young, pathological in HF (ventricular gallop)\nS4 — late diastole atrial kick — pathological, ventricular stiffness (atrial gallop)\n\nMnemonic: "Tennessee" = S4 S1 S2 (a-S4-S1-S2 = ten-ne-ssee). "Kentucky" = S1 S2 S3.' },
      { type: 'keypoints', title: 'Cardiac Output Equation', body: ['CO = SV × HR', 'Normal: ~4–8 L/min', 'SV depends on: Preload (filling), Afterload (resistance), Contractility', 'Frank-Starling Law: more stretch = stronger contraction (up to a point)', 'In heart failure, the curve flattens — more preload no longer helps'] }
    ]}
  ],
  msn: [
    { sub: 'Diabetes Emergencies', cards: [
      { type: 'concept', title: 'DKA vs HHS — How To Tell Them Apart', body: 'DKA (Type 1, younger, acute):\n• Glucose 250–600\n• Severe ketosis ↑↑\n• pH < 7.3 (acidosis)\n• Kussmaul breathing, fruity breath\n• Onset: hours to days\n\nHHS (Type 2, older, slower):\n• Glucose >600 (often >1000)\n• Minimal ketosis\n• pH > 7.3 (no acidosis)\n• Profound dehydration, altered mental state\n• Onset: days to weeks' },
      { type: 'mnemonic', title: 'DKA Management Priorities', body: 'F-I-K (in that order):\n\nFLUIDS first — NS 1L in first hour, then continue\nINSULIN second — regular insulin infusion 0.1 U/kg/hr\nPOTASSIUM third — replenish before serum K+ drops with insulin therapy (insulin drives K+ into cells)\n\nDO NOT give insulin first without fluids — risk of vascular collapse.\nDO NOT give insulin if K+ < 3.3 — give K+ first.' },
      { type: 'keypoints', title: 'Hypoglycaemia — Rule of 15', body: ['Conscious patient with BG < 70: give 15g fast carbs (e.g. 3 glucose tabs, 150mL juice)', 'Recheck in 15 minutes', 'If still <70, repeat', 'When >70 → give a complex carb + protein snack', 'Unconscious: IV dextrose 25% 50mL OR IM glucagon 1 mg', 'NEVER give oral glucose to an unconscious patient (aspiration)'] }
    ]}
  ],
  pharm: [
    { sub: 'High-Alert Drugs', cards: [
      { type: 'concept', title: 'The "LASA" Look-Alike Sound-Alike Drugs', body: 'Common dangerous confusions:\n• Hydralazine vs Hydroxyzine\n• Cefazolin vs Ceftazidime\n• Furosemide vs Torsemide\n• Insulin Humalog vs Humulin\n• Digoxin vs Doxepin\n\nDefences: read label THREE times (pulling, preparing, giving), use generic names, "tall man" lettering (HumALOG vs HumULIN), independent double-checks for high-alert drugs.' },
      { type: 'mnemonic', title: '"High-Alert" Categories — APINCH', body: 'A — Anticoagulants (heparin, warfarin)\nP — Potassium concentrate (NEVER push IV undiluted — fatal!)\nI — Insulin\nN — Narcotics (opioids)\nC — Chemotherapy / Cytotoxics\nH — Heparin specifically (often listed twice)\n\nThese have the highest harm potential when given wrong. Always double-check.' }
    ]}
  ],
  peds: [
    { sub: 'Immunisation Schedule', cards: [
      { type: 'concept', title: 'India UIP Schedule (Quick View)', body: 'BIRTH: BCG + OPV-0 + HepB-0\n6 WEEKS: Penta-1 + OPV-1 + Rota-1 + fIPV-1 + PCV-1\n10 WEEKS: Penta-2 + OPV-2 + Rota-2\n14 WEEKS: Penta-3 + OPV-3 + Rota-3 + fIPV-2 + PCV-2\n9 MONTHS: MR-1 + JE-1 (endemic) + PCV booster + Vit A\n16–24 M: DPT-1 booster + OPV booster + MR-2 + JE-2\n5–6 YR: DPT-2 booster\n10 YR & 16 YR: Td' },
      { type: 'mnemonic', title: 'Live vs Inactivated Vaccines', body: 'LIVE (don\'t give in pregnancy / severe immunosuppression):\n• MMR, MR\n• BCG\n• OPV\n• Varicella\n• Yellow fever\n• Rotavirus\n• Typhoid (oral Ty21a)\n\nINACTIVATED / SUBUNIT (safer):\n• DPT, Hib, HepB, IPV\n• Influenza (injectable)\n• PCV, HPV\n• Rabies, JE\n• Typhoid (injectable)' }
    ]}
  ],
  obg: [
    { sub: 'Labour Stages', cards: [
      { type: 'concept', title: 'Four Stages of Labour', body: 'STAGE 1: Onset of regular contractions → full cervical dilatation (10 cm).\n  • Latent phase: 0 → ~6 cm\n  • Active phase: 6 → 10 cm (~1 cm/hr primigravida)\n\nSTAGE 2: Full dilatation → birth of baby.\n  • Cardinal movements happen here\n\nSTAGE 3: Birth of baby → expulsion of placenta (typically <30 min)\n\nSTAGE 4: 1–2 hr observation post-placenta — watch for PPH' },
      { type: 'mnemonic', title: 'Cardinal Movements (Mechanism of Labour)', body: 'Every Decent Family Is Extremely Rich, Earning Excellent Eternal Riches\n\n• Engagement\n• Descent\n• Flexion\n• Internal rotation\n• Extension\n• Restitution\n• External rotation\n• Expulsion\n\nThese describe how the foetal head navigates the pelvic canal.' }
    ]}
  ],
  ch: [
    { sub: 'Indicators You MUST Know', cards: [
      { type: 'concept', title: 'Mortality Indicators (India approx.)', body: 'IMR (Infant Mortality Rate): ~28 per 1000 live births\nNMR (Neonatal): ~20 per 1000 live births\nU5MR (Under-5): ~32 per 1000 live births\nMMR (Maternal): ~97 per 100,000 live births\n\nKey definition trick — IMR/NMR/U5MR use /1000 LIVE BIRTHS. MMR uses /100,000 LIVE BIRTHS. Crude death rate uses /1000 POPULATION.' },
      { type: 'mnemonic', title: 'Levels of Prevention — Quick Mapping', body: 'PRIMORDIAL → eliminate the risk factor (e.g., healthy lifestyle in whole society)\nPRIMARY → prevent disease before onset (immunisation, sanitation)\nSECONDARY → early detection in asymptomatic (Pap smear, BP screening)\nTERTIARY → limit disability after disease (rehab, dialysis)' }
    ]}
  ],
  mhn: [
    { sub: 'Therapeutic Communication', cards: [
      { type: 'concept', title: 'Therapeutic vs Non-Therapeutic Responses', body: 'THERAPEUTIC:\n• Active listening\n• Open-ended questions\n• Reflection ("You feel scared right now")\n• Silence (let them speak)\n• Validation ("Your feelings make sense")\n\nAVOID:\n• False reassurance ("Everything will be fine")\n• Giving advice ("You should…")\n• "Why" questions (feel accusatory)\n• Changing the subject\n• Minimising ("It\'s not that bad")\n• Approval/disapproval' },
      { type: 'mnemonic', title: 'Suicide Risk — SAD PERSONS Scale', body: 'S — Sex (male higher)\nA — Age (<19 or >45)\nD — Depression\nP — Previous attempts\nE — Ethanol/drug abuse\nR — Rational thinking loss\nS — Social support lacking\nO — Organised plan\nN — No spouse\nS — Sickness (chronic illness)\n\n0–4 low, 5–6 moderate, 7–10 high risk. ASK directly — it does not plant ideas.' }
    ]}
  ],
  micro: [
    { sub: 'Sterilisation Methods', cards: [
      { type: 'concept', title: 'Which Method For Which Item?', body: 'AUTOCLAVE (121°C, 15 psi, 15 min): surgical instruments, dressings, fluids, glassware\nDRY HEAT (160°C / 2 hr): glassware, oils, powders, sharp instruments (won\'t blunt)\nETHYLENE OXIDE: heat-sensitive items (endoscopes, plastics)\nFORMALDEHYDE / GLUTARALDEHYDE: heat-sensitive equipment, surfaces\nRADIATION (gamma): single-use plastics, sutures, commercial items\nFILTRATION: heat-sensitive liquids (serum, vaccines)' }
    ]}
  ],
  nutr: [
    { sub: 'Special Diets', cards: [
      { type: 'concept', title: 'Renal Diet Cheat Sheet', body: 'PRE-DIALYSIS CKD: limit protein (~0.6–0.8 g/kg), restrict K+, phosphate, sodium, fluid\n\nON HAEMODIALYSIS: INCREASE protein (1.2 g/kg) because dialysis removes it. Still restrict K+, phosphate, sodium, fluid.\n\nFOODS HIGH IN K+ to avoid: bananas, oranges, tomato, coconut water, leafy greens, potatoes (soak before cooking helps)\nFOODS HIGH IN PHOSPHATE: dairy, nuts, processed foods, cola\n\nFluid limit on dialysis: ~1L/day + previous day\'s urine output' }
    ]}
  ]
};
// =====================================================================
// AIIMS / NORCET-level supplementary concept modules (Learn section).
// Merged (appended) into CONCEPT_CARDS so the existing modules are
// untouched and each topic simply gains a higher-yield module.
// =====================================================================
const AIIMS_CONCEPT_CARDS = {
  fund: [
    { sub: 'Oxygen Delivery Devices', cards: [
      { type: 'concept', title: 'Device \u2192 FiO\u2082 \u2192 Flow', body: 'Nasal cannula: 1\u20136 L/min \u2192 ~24\u201344% (each 1 L adds ~4%)\nSimple face mask: 5\u20138 L/min \u2192 ~40\u201360% (min 5 L to flush CO\u2082)\nVenturi mask: precise, fixed FiO\u2082 (24\u201360%) \u2014 best for COPD\nNon-rebreather: 10\u201315 L/min \u2192 up to ~90% \u2014 emergencies\n\nRule: the more precise the control needed, the more you favour a Venturi.' },
      { type: 'keypoints', title: 'Oxygen Safety', body: ['No open flames / smoking near O\u2082', 'Humidify flows >4 L/min to prevent mucosal drying', 'COPD CO\u2082-retainers: target SpO\u2082 88\u201392%, low flow', 'A non-rebreather needs the reservoir bag inflated before applying', 'Check tubing for kinks; assess SpO\u2082 and work of breathing, not the number alone'] }
    ]}
  ],
  anat: [
    { sub: 'Acid-Base Made Simple', cards: [
      { type: 'mnemonic', title: 'ROME \u2014 Read an ABG Fast', body: 'Step 1 \u2013 pH: <7.35 acidosis, >7.45 alkalosis\nStep 2 \u2013 ROME: Respiratory Opposite, Metabolic Equal\n  \u2022 pH and CO\u2082 move OPPOSITE \u2192 respiratory\n  \u2022 pH and HCO\u2083\u207b move the SAME way \u2192 metabolic\nStep 3 \u2013 Compensation: is the other value shifting to push pH back to normal?\n\nNormals: pH 7.35\u20137.45 \u00b7 PaCO\u2082 35\u201345 \u00b7 HCO\u2083\u207b 22\u201326' },
      { type: 'keypoints', title: 'Common Causes', body: ['Metabolic acidosis: DKA, lactic acidosis, diarrhoea, renal failure', 'Metabolic alkalosis: vomiting, excess antacids, diuretics', 'Respiratory acidosis: hypoventilation, COPD, opioid overdose', 'Respiratory alkalosis: hyperventilation, anxiety, high altitude'] }
    ]}
  ],
  msn: [
    { sub: 'Shock', cards: [
      { type: 'concept', title: 'Four Types at a Glance', body: 'HYPOVOLAEMIC: blood/fluid loss \u2192 \u2193preload (haemorrhage, burns)\nCARDIOGENIC: pump failure (MI) \u2192 \u2193cardiac output, congestion\nDISTRIBUTIVE: massive vasodilation (septic, anaphylactic, neurogenic) \u2192 \u2193SVR, warm then cold\nOBSTRUCTIVE: physical block (tamponade, tension pneumothorax, PE)\n\nAll end the same way: inadequate tissue perfusion \u2192 cellular hypoxia.' },
      { type: 'keypoints', title: 'Early Recognition & Priorities', body: ['Early signs: tachycardia, restlessness, cool clammy skin, narrowing pulse pressure', 'Late signs: hypotension, weak pulse, oliguria (<30 mL/hr), altered consciousness', 'Position: flat with legs raised (except cardiogenic \u2192 semi-Fowler)', 'Hypovolaemic: stop bleeding + IV fluids; Anaphylactic: IM adrenaline first', 'Monitor urine output \u2014 the most sensitive bedside perfusion marker'] }
    ]}
  ],
  pharm: [
    { sub: 'Antidotes & Reversals', cards: [
      { type: 'keypoints', title: 'Drug \u2192 Antidote (Must-Know)', body: ['Heparin \u2192 Protamine sulphate (monitor aPTT)', 'Warfarin \u2192 Vitamin K (+ FFP/PCC if urgent; monitor INR)', 'Opioids \u2192 Naloxone', 'Benzodiazepines \u2192 Flumazenil', 'Paracetamol \u2192 N-acetylcysteine', 'Digoxin \u2192 Digoxin-specific Fab fragments', 'Iron \u2192 Desferrioxamine', 'Organophosphates \u2192 Atropine + Pralidoxime', 'Methotrexate \u2192 Folinic acid (leucovorin)'] },
      { type: 'mnemonic', title: 'High-Alert Drugs \u2014 A PINCH', body: 'A \u2013 Anticoagulants (heparin, warfarin)\nP \u2013 Potassium (NEVER IV push undiluted \u2014 fatal)\nI \u2013 Insulin\nN \u2013 Narcotics (opioids)\nC \u2013 Chemotherapy / cytotoxics\nH \u2013 Heparin\n\nThese carry the highest harm if given wrong \u2014 independent double-check.' }
    ]}
  ],
  peds: [
    { sub: 'Danger Signs (IMNCI)', cards: [
      { type: 'concept', title: 'General Danger Signs in a Sick Child', body: 'Refer URGENTLY if a child:\n\u2022 Is unable to drink or breastfeed\n\u2022 Vomits everything\n\u2022 Has had convulsions\n\u2022 Is lethargic or unconscious\n\nIMNCI uses a colour triage: PINK = urgent referral, YELLOW = treat at facility, GREEN = home care/advice.' },
      { type: 'keypoints', title: 'Fast Breathing Cut-offs (Pneumonia)', body: ['<2 months: \u2265 60 breaths/min', '2\u201312 months: \u2265 50 breaths/min', '12 months\u20135 years: \u2265 40 breaths/min', 'Chest indrawing = severe pneumonia \u2192 refer', 'Count breaths for a FULL minute when the child is calm'] }
    ]}
  ],
  obg: [
    { sub: 'Stages of Labour', cards: [
      { type: 'concept', title: 'The Four Stages', body: 'FIRST: onset of true labour \u2192 full dilatation (10 cm)\n  \u2022 Latent (0\u20133 cm) then active (4\u201310 cm)\nSECOND: full dilatation \u2192 birth of the baby\nTHIRD: birth of baby \u2192 delivery of placenta (watch for the 3 signs of separation)\nFOURTH: ~1 hr after the placenta \u2014 immediate recovery, watch for PPH.' },
      { type: 'keypoints', title: 'Partograph Essentials', body: ['Plots cervical dilatation against time to spot abnormal/obstructed labour early', 'Alert line: 1 cm/hr in active phase; crossing it prompts review', 'Action line: 4 hr right of the alert line \u2192 intervention', 'Also tracks fetal heart rate, contractions, descent, liquor', 'A simple tool that prevents prolonged/obstructed labour deaths'] }
    ]}
  ],
  ch: [
    { sub: 'National Health Programmes', cards: [
      { type: 'concept', title: 'Key Programmes & Their Focus', body: 'RNTCP / NTEP \u2013 Tuberculosis (DOTS)\nNVBDCP \u2013 Vector-borne (malaria, dengue, filaria)\nNLEP \u2013 Leprosy\nRCH / RMNCH+A \u2013 Reproductive & child health\nUIP \u2013 Universal Immunisation\nNPCDCS \u2013 Non-communicable diseases (diabetes, cancer, stroke)\nNMHP \u2013 Mental health' },
      { type: 'keypoints', title: 'Quick Facts', body: ['DOTS = Directly Observed Treatment, Short-course \u2014 cornerstone of TB control', 'India aims to ELIMINATE TB ahead of the global 2030 SDG target', 'ASHA = Accredited Social Health Activist, the village-level link worker', 'Cold chain keeps vaccines viable from manufacturer to child', 'Sub-centre is the first/most peripheral contact point in rural health'] }
    ]}
  ],
  mhn: [
    { sub: 'Defence Mechanisms', cards: [
      { type: 'concept', title: 'Recognise Them in a Vignette', body: 'Denial \u2013 refusing to accept reality\nRepression \u2013 unconscious blocking of painful thoughts\nProjection \u2013 attributing your feelings to others\nDisplacement \u2013 redirecting feelings to a safer target\nRationalisation \u2013 logical excuses for behaviour\nRegression \u2013 reverting to earlier behaviour under stress\nReaction formation \u2013 acting opposite to true feelings\nSublimation (mature) \u2013 channelling impulses into acceptable activity' },
      { type: 'keypoints', title: 'Exam Tips', body: ['Sublimation is the only one considered consistently "mature/healthy"', 'Displacement vs projection: displacement REDIRECTS the feeling; projection ASSIGNS it to someone else', 'Regression is common in hospitalised children (bed-wetting, thumb-sucking)', 'Identify by the behaviour described, not the label the patient uses'] }
    ]}
  ],
  micro: [
    { sub: 'Isolation Precautions', cards: [
      { type: 'mnemonic', title: 'Airborne \u2014 "My Chicken Tastes Tasty"', body: 'AIRBORNE (droplet nuclei <5 \u00b5m, negative-pressure room + N95):\n  \u2022 Measles\n  \u2022 Tuberculosis\n  \u2022 Varicella (chickenpox) / disseminated zoster\n\nDROPLET (>5 \u00b5m, surgical mask, ~1 m): influenza, pertussis, meningococcus, mumps, rubella\nCONTACT (gown + gloves): MRSA, C. difficile, scabies\n\nC. difficile and norovirus need SOAP-AND-WATER (alcohol rub doesn\'t kill spores).' },
      { type: 'keypoints', title: 'Standard Precautions', body: ['Apply to ALL patients regardless of diagnosis', 'Hand hygiene is the single most effective measure', 'PPE chosen by anticipated exposure', 'Don: gown \u2192 mask \u2192 goggles \u2192 gloves; Doff: gloves \u2192 goggles \u2192 gown \u2192 mask', 'Most contaminated item comes off first; hand hygiene between steps'] }
    ]}
  ],
  nutr: [
    { sub: 'Vitamins at a Glance', cards: [
      { type: 'keypoints', title: 'Fat- vs Water-Soluble', body: ['Fat-soluble = "ADEK" (A, D, E, K) \u2014 stored in body, toxicity possible', 'Water-soluble = B-complex + C \u2014 not stored, deficiency appears faster', 'Vitamin A: night blindness, Bitot\'s spots', 'Vitamin D: rickets (child) / osteomalacia (adult)', 'Vitamin K: bleeding (clotting factors II, VII, IX, X)'] },
      { type: 'keypoints', title: 'B-Complex Deficiencies', body: ['B1 (Thiamine): beriberi, Wernicke encephalopathy', 'B2 (Riboflavin): angular stomatitis, glossitis', 'B3 (Niacin): pellagra \u2014 the 3 Ds (Dermatitis, Diarrhoea, Dementia)', 'B6 (Pyridoxine): peripheral neuropathy (esp. with isoniazid)', 'B9/B12: megaloblastic anaemia; B12 also causes neuro signs', 'Vitamin C: scurvy (bleeding gums, poor wound healing)'] }
    ]}
  ]
};
Object.keys(AIIMS_CONCEPT_CARDS).forEach(function (k) {
  if (Array.isArray(CONCEPT_CARDS[k])) {
    CONCEPT_CARDS[k] = CONCEPT_CARDS[k].concat(AIIMS_CONCEPT_CARDS[k]);
  } else {
    CONCEPT_CARDS[k] = AIIMS_CONCEPT_CARDS[k];
  }
});


// =====================================================================
// STORAGE
// =====================================================================

const DEFAULT_DATA = {
  // Bumped via CURRENT_SCHEMA_VERSION in src/lib/migrations.js. Fresh
  // users start at the current version so the migration loop is a no-op
  // for them. Existing users without this field default to 1 in the
  // runner and walk forward through every migration on next load.
  schemaVersion: CURRENT_SCHEMA_VERSION,
  customQuestions: [],
  history: {},        // qId -> { attempts: [{ts, correct, timeMs}], reviewCount, nextDue, lastResult }
  bookmarks: [],
  stats: {
    totalAttempted: 0,
    totalCorrect: 0,
    streakCurrent: 0,
    streakBest: 0,
    lastStudiedDate: null,
    dailyHistory: [],
    examDate: null,
    streakGraceAvailable: true,
    dailyTarget: null,  // user-set questions-per-day goal; null = "auto" (derive from pool/days left)
    lastCompactedTs: null  // P15 — timestamp of last lazy compaction pass; null = never run yet
  },
  advancedTestHistory: [],
  bankVersionsSeen: {},   // bankId -> last seen version (per user)
  bankPublishedSeen: {},  // bankId -> last seen publishedAt (per user) — separate from version so
                          //          a public/private re-flip can still surface in "What's new"
  // Imported banks the user has temporarily paused. The bank's questions
  // stay in customQuestions (preserves history) but get filtered out of
  // allQuestions so they don't show up in quizzes/drills/stats.
  // Map shape: { [bankId]: true }
  disabledBanks: {},
  dismissedAnnouncementId: null,  // last admin announcement this user dismissed
  feedbackRepliesSeen: {},        // feedbackId -> repliedAt the user has acknowledged
  preferences: {          // remembers user choices
    quickCount: 5,
    quickTopic: 'all',
    // Spaced-revision reminder card on Home.
    //   reviewRemindersEnabled — permanent off-switch (Settings)
    //   reviewDismissedDate    — "hide for today" (YYYY-MM-DD). Reappears tomorrow.
    reviewRemindersEnabled: true,
    reviewDismissedDate: null
  },
  // Dates the user opened the Revision sheet, each with a snapshot of that
  // day's revision set so they can jump back and re-revise. One entry per day.
  revisionLog: []         // [{ date: 'YYYY-MM-DD', ts, ids: [qId,...] }]
};

// Legacy on-device data, from before profiles existed. Reading is handled
// in `peekLegacyData` below — kept around so a one-time migration into the
// first profile created on this device can still find old progress.
//
// Note: `loadUserData` / `saveUserData` were removed in favour of the
// profile-scoped storage. All study data now lives in the profile blob;
// see `loadProfile` / `saveProfile`.

// =====================================================================
// PROFILE SYSTEM
//   - profiles live in SHARED storage so the same login works on any device
//   - the session pointer (who's logged in on THIS device) lives in personal storage
//   - passwords are PBKDF2 (SHA-256, 100k iter) + per-profile random salt; never plaintext
// =====================================================================

// =====================================================================
// SAFE STORAGE — shim over `./storage.js`
//   The artifact host's `window.storage` postMessage bridge is gone. Every
//   storage call now goes through `./storage.js`, which is backed by
//   IndexedDB (via the `idb` library) for device-local data and Supabase for
//   shared data. Same `get / set / delete / list` contract as the original
//   `window.storage`, same return shapes — so the ~40 call sites elsewhere in
//   this file did not need to change. `delete` maps to `kvStorage.del` (the
//   storage module avoids `delete` as a property name for lint reasons).
//
//   The `shared` flag on each call is the boundary between truly device-local
//   data (sessions, theme, onboarding, admin unlock) and data that is visible
//   across users/devices (profiles, banks, feedback, announcements).
// =====================================================================
const STORAGE_OP_TIMEOUT_MS = 6000;

// Generic promise-timeout helper. Races an op against a deadline and reports
// WHY it ended: { ok, value } | { timeout:true } | { error }. Used by the P1
// cloud-sync paths (canonical Supabase writes via kvStorage) where we want an
// explicit success/timeout/error signal that the plain safeStorage wrapper
// flattens away. The op itself decides what it calls (here, kvStorage).
function raceStorage(op, ms) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => done({ timeout: true }), ms);
    try {
      Promise.resolve(op()).then(
        (value) => done({ ok: true, value }),
        (error) => done({ error: error || true })
      );
    } catch (error) {
      done({ error });
    }
  });
}

const safeStorage = {
  get:    (key, shared)        => kvStorage.get(key, shared),
  set:    (key, value, shared) => kvStorage.set(key, value, shared),
  delete: (key, shared)        => kvStorage.del(key, shared),
  list:   (prefix, shared)     => kvStorage.list(prefix, shared),
};

// Liveness probe — kept so the boot code can still surface a "your progress
// won't be saved" banner if IndexedDB itself is unreachable (private mode in
// some old browsers, quota exhausted, etc.). In a healthy browser this
// resolves to true almost instantly.
async function checkStorageBridge() {
  return kvStorage.isAlive();
}


// One shared key PER user for the lightweight directory entry. Using a key per
// user removes the read-modify-write contention the old monolithic list had:
// two users signing in simultaneously can never overwrite each other's metadata.

// Convert a free-form display name into a safe storage id
function normalizeProfileId(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '').slice(0, 32);
}

function genSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// =====================================================================
// LOAD / SAVE PROFILE — with offline resilience (Pipeline step 4 / P1)
// ---------------------------------------------------------------------
// Strategy: Supabase is the canonical store; IndexedDB is a per-device
// write-through cache. Every saveProfile writes BOTH layers so the user
// can keep working offline; on reconnect, anything that didn't reach
// Supabase is flushed up. Last-write-wins per profile is acceptable at
// this scale (10-50 beta users).
//
// PENDING_SYNC tracks which profileIds have local writes not yet
// confirmed in Supabase. It's keyed off the local IndexedDB only; the
// flush replays the cached blob to Supabase and clears the entry.
//
// We use raceStorage (not safeStorage) for the canonical Supabase write
// so we can distinguish "succeeded" from "timed out / errored", which
// safeStorage flattens to `null`. The cache write keeps using
// safeStorage — IndexedDB is local and never times out in practice.
// =====================================================================
async function loadProfile(id) {
  // Try Supabase (canonical) first.
  try {
    const result = await safeStorage.get(KEYS.profile(id), true);
    if (result && result.value) {
      const profile = JSON.parse(result.value);
      // Refresh the local cache so a subsequent offline reload still
      // returns the latest known-good copy.
      try {
        await safeStorage.set(KEYS.userdata(id), result.value, false);
      } catch (e) { /* cache refresh is best-effort */ }
      return profile;
    }
  } catch (e) { log.warn('storage.profileLoad.supabase', e); /* fall through to cache */ }
  // Supabase didn't return a profile — either offline, timed out, or
  // genuinely not there. Fall back to the local cache.
  try {
    const cached = await safeStorage.get(KEYS.userdata(id), false);
    if (cached && cached.value) return JSON.parse(cached.value);
  } catch (e) { log.warn('storage.profileLoad.cache', e); /* no cache either */ }
  return null;
}

// Saves the full profile blob. Last-write-wins on the SAME profile is fine — but
// we debounce writes at the call site so rapid `setData` bursts coalesce into a
// single network write, drastically reducing the chance of multi-device clobber.
async function saveProfile(profile) {
  if (!profile || !profile.id) return;
  const payload = JSON.stringify(profile);
  // 1) Write-through to the local IndexedDB cache FIRST. This is fast,
  //    cannot fail meaningfully offline, and means even if the Supabase
  //    write below times out the user's progress survives a reload.
  try { await safeStorage.set(KEYS.userdata(profile.id), payload, false); }
  catch (e) { log.error('storage.profileSave.cache', e); }
  // 2) Mark this profile as pending before attempting the Supabase write.
  //    If the Supabase write succeeds we clear the flag; if not, the next
  //    `flushPendingSync` (on reconnect or boot) will replay this write.
  try { await markPendingSync(profile.id); } catch (e) {}
  // 3) Attempt the canonical Supabase write. raceStorage gives us a clear
  //    success/timeout/error signal that safeStorage flattens away.
  const r = await raceStorage(
    () => kvStorage.set(KEYS.profile(profile.id), payload, true),
    STORAGE_OP_TIMEOUT_MS
  );
  if (r.ok) {
    try { await clearPendingSync(profile.id); } catch (e) {}
  }
  // On timeout/error: pending flag remains set, flush handler will retry.
}

// Returns the current pending-sync map: { [profileId]: timestamp }. Safe to
// call when the key doesn't exist yet — returns {}.
async function getPendingSync() {
  try {
    const r = await safeStorage.get(KEYS.PENDING_SYNC, false);
    if (r && r.value) {
      const obj = JSON.parse(r.value);
      return (obj && typeof obj === 'object') ? obj : {};
    }
  } catch (e) {}
  return {};
}

async function markPendingSync(profileId) {
  const obj = await getPendingSync();
  obj[profileId] = Date.now();
  try { await safeStorage.set(KEYS.PENDING_SYNC, JSON.stringify(obj), false); } catch (e) {}
}

async function clearPendingSync(profileId) {
  const obj = await getPendingSync();
  if (!(profileId in obj)) return;
  delete obj[profileId];
  try {
    if (Object.keys(obj).length === 0) {
      await safeStorage.delete(KEYS.PENDING_SYNC, false);
    } else {
      await safeStorage.set(KEYS.PENDING_SYNC, JSON.stringify(obj), false);
    }
  } catch (e) {}
}

// Replays any pending local writes up to Supabase. Called on the `online`
// event, on boot once after the initial load settles, and after any
// explicit user action that would benefit from a sync attempt. Idempotent:
// each successful push clears that profile's pending flag; failures leave
// the flag for the next attempt. Re-entry-safe via an in-memory lock so a
// rapid online/offline flap doesn't spawn parallel flushes.
let _flushInFlight = false;
async function flushPendingSync() {
  if (_flushInFlight) return;
  _flushInFlight = true;
  try {
    const pending = await getPendingSync();
    const ids = Object.keys(pending);
    if (ids.length === 0) return;
    for (const id of ids) {
      try {
        const cached = await safeStorage.get(KEYS.userdata(id), false);
        if (!cached || !cached.value) {
          // Nothing in cache to flush — drop the stale flag.
          await clearPendingSync(id);
          continue;
        }
        const r = await raceStorage(
          () => kvStorage.set(KEYS.profile(id), cached.value, true),
          STORAGE_OP_TIMEOUT_MS
        );
        if (r.ok) await clearPendingSync(id);
        // r.timeout / r.error: leave flag, retry next time.
      } catch (e) { /* leave flag set */ }
    }
  } finally {
    _flushInFlight = false;
  }
}

async function loadOneProfileMeta(id) {
  try {
    const r = await safeStorage.get(KEYS.profileMeta(id), true);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) { /* none */ }
  return null;
}

async function saveProfileMeta(meta) {
  if (!meta || !meta.id) return;
  try { await safeStorage.set(KEYS.profileMeta(meta.id), JSON.stringify(meta), true); } catch (e) {}
}

// List every profile's lightweight metadata. Each user has their own key, so
// listing here means a simple prefix scan + parallel fetch — no contention.
// One-time migration: if the legacy monolithic `profile_index` key still
// exists, fold its entries into per-user meta keys and remove it. Subsequent
// reads use only the new keys.
async function listProfileMetas() {
  // Migrate the legacy list, if present, then continue. The migration writes
  // one new key per old entry, so it's tolerant of partial failures: any
  // entry that was missed will simply not appear until it's touched again,
  // at which point it gets written fresh.
  try {
    const legacy = await safeStorage.get(KEYS.PROFILE_INDEX, true);
    if (legacy && legacy.value) {
      const arr = JSON.parse(legacy.value);
      if (Array.isArray(arr) && arr.length > 0) {
        await Promise.all(arr.map(p => p && p.id ? saveProfileMeta({
          id: p.id,
          displayName: p.displayName || p.id,
          createdAt: p.createdAt || null,
          lastActive: p.lastActive || null
        }) : null));
        try { await safeStorage.delete(KEYS.PROFILE_INDEX, true); } catch (e) {}
      }
    }
  } catch (e) { /* no legacy list — fine */ }

  let keys = [];
  try {
    const r = await safeStorage.list(KEY_PREFIXES.PROFILE_META, true);
    keys = (r && r.keys) ? r.keys : [];
  } catch (e) { return []; }
  const metas = await Promise.all(keys.map(async k => {
    try {
      const r = await safeStorage.get(k, true);
      if (r && r.value) return JSON.parse(r.value);
    } catch (e) {}
    return null;
  }));
  return metas.filter(Boolean);
}

// Back-compat shim: anywhere old code called loadProfileIndex(), keep returning
// the unified list. Internally it now reads the per-user keys.
async function loadProfileIndex() {
  return listProfileMetas();
}

// Upsert a user's directory entry. Writes ONLY that user's key — never a
// shared list — so concurrent signups/logins do not clobber each other.
async function upsertProfileIndex(entry) {
  if (!entry || !entry.id) return;
  const prev = await loadOneProfileMeta(entry.id);
  await saveProfileMeta({
    id: entry.id,
    displayName: entry.displayName,
    createdAt: entry.createdAt || (prev && prev.createdAt) || Date.now(),
    lastActive: entry.lastActive || (prev && prev.lastActive) || Date.now()
  });
}

// Bump lastActive for one user. Per-user key + per-session throttle (see App)
// keeps writes tiny and contention-free.
async function touchProfileActivity(id) {
  if (!id) return;
  const prev = await loadOneProfileMeta(id);
  if (!prev) return;
  await saveProfileMeta({ ...prev, lastActive: Date.now() });
}


// DOB normalization — accept what the date input gives us (YYYY-MM-DD)
// and reject anything else. Hashed separately from the password so the
// profile blob never carries a plaintext date of birth.
function normalizeDob(dob) {
  if (!dob) return null;
  const s = String(dob).trim();
  // YYYY-MM-DD only — that's what <input type="date"> produces.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

async function createProfile({ displayName, password, dob, importData }) {
  const id = normalizeProfileId(displayName);
  if (!id) throw new Error('Display name needs at least one letter or number');
  if (password.length < 4) throw new Error('Password must be at least 4 characters');
  const normDob = normalizeDob(dob);
  if (!normDob) throw new Error('Pick your date of birth — used to recover your password if you forget it');
  const existing = await loadProfile(id);
  if (existing) throw new Error('That display name is already taken — pick another, or log in instead');
  const salt = genSalt();
  const passwordHash = await hashPassword(password, salt);
  // DOB gets its OWN salt so a compromised password salt doesn't help an
  // attacker brute-force the DOB (dates have low entropy).
  const dobSalt = genSalt();
  const dobHash = await hashPassword(normDob, dobSalt);
  const profile = {
    id,
    displayName: displayName.trim(),
    passwordHash,
    salt,
    dobHash,
    dobSalt,
    createdAt: Date.now(),
    // Run migrations on legacy/imported data so an old shape gets walked
    // forward to current before it's stored. DEFAULT_DATA is already at
    // current version so doesn't need it.
    data: importData ? runMigrations(importData) : DEFAULT_DATA
  };
  await saveProfile(profile);
  await upsertProfileIndex({ ...profile, lastActive: Date.now() });
  return profile;
}

async function authenticateProfile(displayName, password) {
  const id = normalizeProfileId(displayName);
  if (!id) throw new Error('Enter your display name');
  const profile = await loadProfile(id);
  if (!profile) throw new Error('No profile with that name. Check the spelling or create a new profile.');
  const hash = await hashPassword(password, profile.salt);
  if (hash !== profile.passwordHash) throw new Error('Incorrect password');
  return profile;
}

// Rename a profile. Two cases:
//
//   CASE A — Cosmetic rename: the new name normalises to the SAME id as the
//   old one (e.g. "jyo deori" → "Jyo Deori" → both normalise to `jyodeori`).
//   Just update the displayName on the profile blob and metadata entry.
//   No keys change.
//
//   CASE B — Real rename: the new name normalises to a DIFFERENT id. Storage
//   keys (`profile:<id>`, `profilemeta:<id>`, `myfeedback:<id>`) and the
//   `ownerId` on any banks she owns plus the `profileId` on her feedback all
//   need to move.
//
// Strategy for Case B: WRITE the new keys first, VERIFY they're readable,
// then DELETE the old keys. If anything fails mid-way the worst case is
// duplicate data (recoverable by retry) — never silent data loss.
//
// Returns the updated profile.
async function renameProfile(profile, newDisplayName) {
  const trimmed = String(newDisplayName || '').trim();
  if (!trimmed) throw new Error('Enter a display name');
  const newId = normalizeProfileId(trimmed);
  if (!newId) throw new Error('Display name needs at least one letter or number');

  // Case A — same id, cosmetic only.
  if (newId === profile.id) {
    if (trimmed === profile.displayName) return profile; // nothing to do
    const updated = { ...profile, displayName: trimmed };
    await saveProfile(updated);
    const prevMeta = await loadOneProfileMeta(profile.id);
    await saveProfileMeta({
      ...(prevMeta || {}),
      id: profile.id,
      displayName: trimmed,
      createdAt: (prevMeta && prevMeta.createdAt) || profile.createdAt || Date.now(),
      lastActive: Date.now()
    });
    return updated;
  }

  // Case B — new id. Check for collisions.
  const collision = await loadProfile(newId);
  if (collision) {
    throw new Error('That name is already taken by another profile. Pick a different name.');
  }

  // 1) Write the renamed profile blob at the new key.
  const renamed = { ...profile, id: newId, displayName: trimmed };
  await saveProfile(renamed);

  // 2) Verify it landed before touching anything else. If this fails, we
  //    abort cleanly: nothing has been broken on the user's account yet.
  const verify = await loadProfile(newId);
  if (!verify || verify.id !== newId) {
    throw new Error("Couldn't save the new profile name. Try again.");
  }

  // 3) Write new metadata entry.
  const prevMeta = await loadOneProfileMeta(profile.id);
  await saveProfileMeta({
    id: newId,
    displayName: trimmed,
    createdAt: (prevMeta && prevMeta.createdAt) || profile.createdAt || Date.now(),
    lastActive: Date.now()
  });

  // 4) Move the per-user feedback index.
  try {
    const myIds = await loadMyFeedbackIndex(profile.id);
    if (myIds && myIds.length > 0) {
      await safeStorage.set(KEYS.myFeedback(newId), JSON.stringify(myIds), true);
    }
  } catch (e) { /* tolerate */ }

  // 5) Patch ownerId/ownerName on any banks she owns.
  try {
    const allBanks = await listBanks();
    const mine = allBanks.filter(b => b && b.ownerId === profile.id);
    await Promise.all(mine.map(b => saveBank({ ...b, ownerId: newId, ownerName: trimmed })));
  } catch (e) { /* tolerate — banks keep loading even with stale owner */ }

  // 6) Patch profileId/profileName on her feedback entries (shared storage).
  try {
    const all = await listFeedback();
    const hers = all.filter(f => f && f.profileId === profile.id);
    await Promise.all(hers.map(f => saveFeedback({ ...f, profileId: newId, profileName: trimmed })));
  } catch (e) { /* tolerate */ }

  // 7) Now safe to remove the old keys.
  try { await safeStorage.delete(KEYS.profile(profile.id), true); } catch (e) {}
  try { await safeStorage.delete(KEYS.profileMeta(profile.id), true); } catch (e) {}
  try { await safeStorage.delete(KEYS.myFeedback(profile.id), true); } catch (e) {}
  // P1 — clear the local cache + any pending-sync flag for the old id.
  try { await safeStorage.delete(KEYS.userdata(profile.id), false); } catch (e) {}
  try { await clearPendingSync(profile.id); } catch (e) {}

  return renamed;
}
// Older profiles that pre-date the DOB requirement will have no dobHash —
// for those, recovery is impossible and we say so honestly.
async function recoverPasswordWithDob(displayName, dob, newPassword) {
  const id = normalizeProfileId(displayName);
  if (!id) throw new Error('Enter your display name');
  const profile = await loadProfile(id);
  if (!profile) throw new Error('No profile with that name');
  if (!profile.dobHash || !profile.dobSalt) {
    throw new Error("This profile doesn't have a date of birth on file, so password recovery isn't available. Create a new profile.");
  }
  const normDob = normalizeDob(dob);
  if (!normDob) throw new Error('Pick a valid date of birth');
  const tryHash = await hashPassword(normDob, profile.dobSalt);
  if (tryHash !== profile.dobHash) throw new Error("That date of birth doesn't match what's on file for this profile");
  if (!newPassword || newPassword.length < 4) throw new Error('New password must be at least 4 characters');
  const newSalt = genSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const updated = { ...profile, salt: newSalt, passwordHash: newHash };
  await saveProfile(updated);
  return updated;
}

async function loadSession() {
  try {
    const result = await safeStorage.get(KEYS.SESSION);
    if (result && result.value) return JSON.parse(result.value);
  } catch (e) { /* not found */ }
  return null;
}

async function saveSession(session) {
  if (session) {
    await safeStorage.set(KEYS.SESSION, JSON.stringify(session));
  } else {
    try { await safeStorage.delete(KEYS.SESSION); } catch (e) {}
  }
}

// Returns legacy on-device data IF it represents real progress worth migrating
async function peekLegacyData() {
  try {
    const result = await safeStorage.get(KEYS.USERDATA);
    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      const attempted = parsed?.stats?.totalAttempted || 0;
      const customs = parsed?.customQuestions?.length || 0;
      const bookmarks = parsed?.bookmarks?.length || 0;
      if (attempted > 0 || customs > 0 || bookmarks > 0) {
        return parsed;
      }
    }
  } catch (e) { /* none */ }
  return null;
}

async function clearLegacyData() {
  try { await safeStorage.delete(KEYS.USERDATA); } catch (e) {}
}

// =====================================================================
// PER-DEVICE PREFERENCES — theme mode + onboarding completion
// =====================================================================

async function loadThemeMode() {
  try {
    const r = await safeStorage.get(KEYS.THEME);
    if (r && r.value && THEMES[r.value]) return r.value;
  } catch (e) {}
  return 'light';
}

async function saveThemeMode(mode) {
  try { await safeStorage.set(KEYS.THEME, mode); } catch (e) {}
}

async function hasSeenOnboarding(profileId) {
  try {
    const r = await safeStorage.get(`${KEYS.ONBOARDING}:${profileId}`);
    return !!(r && r.value === '1');
  } catch (e) { return false; }
}

async function markOnboardingSeen(profileId) {
  try { await safeStorage.set(`${KEYS.ONBOARDING}:${profileId}`, '1'); } catch (e) {}
}

// =====================================================================
// FEEDBACK INBOX — shared storage; one key per report
// =====================================================================
const newFeedbackId = () => `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function saveFeedback(entry) {
  await safeStorage.set(KEYS.feedback(entry.id), JSON.stringify(entry), true);
}

async function listFeedback() {
  let keys = [];
  try {
    const r = await safeStorage.list(KEY_PREFIXES.FEEDBACK, true);
    keys = (r && r.keys) ? r.keys : [];
  } catch (e) { return []; }
  const items = await Promise.all(keys.map(async k => {
    try {
      const r = await safeStorage.get(k, true);
      if (r && r.value) return JSON.parse(r.value);
    } catch (e) {}
    return null;
  }));
  return items.filter(Boolean).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

async function deleteFeedback(id) {
  try { await safeStorage.delete(KEYS.feedback(id), true); } catch (e) {}
}

// Admin reply + status live on the same feedback entry (kept lightweight).
const FEEDBACK_STATUSES = [
  { id: 'looking', label: 'Looking into it' },
  { id: 'fixed',   label: 'Fixed' },
  { id: 'wontfix', label: "Won't fix" },
  { id: 'thanks',  label: 'Thanks' }
];

function feedbackStatusMeta(id) {
  switch (id) {
    case 'looking': return { label: 'Looking into it', color: T.sec.stats };
    case 'fixed':   return { label: 'Fixed', color: T.success };
    case 'wontfix': return { label: "Won't fix", color: T.muted };
    case 'thanks':  return { label: 'Thanks', color: T.accent };
    default:        return null;
  }
}

// Merge an admin reply/status onto an entry and persist it.
async function updateFeedback(entry, patch) {
  const updated = { ...entry, ...patch, repliedAt: Date.now() };
  await saveFeedback(updated);
  return updated;
}

// ---- Per-user feedback index ----
// A small per-user pointer list so a device fetches only its OWN reports, rather
// than pulling the entire shared inbox down and filtering. Other users' feedback
// never reaches the device.

async function loadMyFeedbackIndex(profileId) {
  // Array of feedback ids, or null if the index has never been written.
  try {
    const r = await safeStorage.get(KEYS.myFeedback(profileId), true);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { /* none yet */ }
  return null;
}

async function saveMyFeedbackIndex(profileId, ids) {
  try { await safeStorage.set(KEYS.myFeedback(profileId), JSON.stringify(ids), true); } catch (e) {}
}

// Record a freshly-submitted report against its author.
async function addToMyFeedbackIndex(profileId, id) {
  if (!profileId || !id) return;
  const existing = (await loadMyFeedbackIndex(profileId)) || [];
  if (!existing.includes(id)) {
    existing.push(id);
    await saveMyFeedbackIndex(profileId, existing);
  }
}

// A user's own reports. Steady state fetches ONLY this user's entries by id;
// other users' feedback never touches the device. A profile whose index doesn't
// exist yet (e.g. reports sent before this index existed) is backfilled once
// from the shared list, then never lists the full inbox again.
async function listMyFeedback(profileId) {
  if (!profileId) return [];
  let ids = await loadMyFeedbackIndex(profileId);

  if (ids === null) {
    const all = await listFeedback();              // one-time migration only
    ids = all.filter(f => f.profileId === profileId).map(f => f.id);
    await saveMyFeedbackIndex(profileId, ids);
  }

  const entries = await Promise.all(ids.map(async (id) => {
    try {
      const r = await safeStorage.get(KEYS.feedback(id), true);
      if (r && r.value) return JSON.parse(r.value);
    } catch (e) {}
    return null;                                   // deleted by admin → skip
  }));
  const live = entries.filter(Boolean);

  // Keep the index tidy if some reports were deleted.
  if (live.length !== ids.length) {
    await saveMyFeedbackIndex(profileId, live.map(f => f.id));
  }

  return live.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

// Replies the user hasn't acknowledged yet (entry replied/updated after last seen).
function unseenFeedbackReplies(myList, seenMap) {
  const seen = seenMap || {};
  return (myList || []).filter(f =>
    (f.reply || f.status) && f.repliedAt && f.repliedAt > (seen[f.id] || 0)
  );
}

// =====================================================================
// ADMIN — USER OVERVIEW  (privacy-preserving)
//   - Reads ONLY the lightweight shared directory (id/displayName/createdAt/
//     lastActive). It NEVER opens a user's profile blob, so it cannot expose
//     passwords, answers, history, or any private study data — by construction.
// =====================================================================
async function adminListUsers() {
  const list = await loadProfileIndex();
  return list
    .map(p => ({
      id: p.id,
      displayName: p.displayName || p.id,
      createdAt: p.createdAt || null,
      lastActive: p.lastActive || null
    }))
    .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
}

// Remove a profile entirely: deletes the private blob, the directory entry,
// the per-user feedback index, AND any feedback they submitted. Cascading the
// feedback delete avoids leaving "orphaned" reports referring to a name that
// no longer exists in the user list.
async function adminDeleteProfile(id) {
  if (!id) return;
  // 1) Their private blob + lightweight metadata
  try { await safeStorage.delete(KEYS.profile(id), true); } catch (e) {}
  try { await safeStorage.delete(KEYS.profileMeta(id), true); } catch (e) {}
  // 1b) P1 — local cache + pending-sync flag (only matters if the admin
  //     is operating on their OWN device's cache; harmless no-op otherwise).
  try { await safeStorage.delete(KEYS.userdata(id), false); } catch (e) {}
  try { await clearPendingSync(id); } catch (e) {}
  // 2) Their per-user feedback index pointer
  try { await safeStorage.delete(KEYS.myFeedback(id), true); } catch (e) {}
  // 3) Every feedback report they authored
  try {
    const all = await listFeedback();
    const theirs = all.filter(f => f && f.profileId === id);
    await Promise.all(theirs.map(f => deleteFeedback(f.id)));
  } catch (e) {}
  // 4) Every bank they uploaded (otherwise it lingers in shared storage with
  //    a dangling ownerId). canSeeBank handles missing owners, but we should
  //    not leave orphaned shared data behind.
  try {
    const allBanks = await listBanks();
    const theirs = allBanks.filter(b => b && b.ownerId === id);
    await Promise.all(theirs.map(b => deleteBank(b.id)));
  } catch (e) {}
}

// =====================================================================
// ANNOUNCEMENTS — a single current notice, shared with every user
//   - One shared key holds the active notice { id, text, ts }.
//   - Posting a new notice replaces the old one (and gets a fresh id so every
//     user sees it again). Clearing removes it.
//   - Each user records the id they dismissed in their OWN data, so dismissal
//     is per-user and private.
// =====================================================================

async function loadAnnouncement() {
  try {
    const r = await safeStorage.get(KEYS.ANNOUNCEMENT, true);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      if (parsed && parsed.text) return parsed;
    }
  } catch (e) { /* none */ }
  return null;
}

// A4: announcement WRITES are admin-only and now go through the direct
// PostgREST path (with the x-profile-id header) so the server-side RLS policy
// can enforce them. `loadAnnouncement` (read) stays on safeStorage — reads are
// open to everyone. The caller must pass the current admin profile id; the
// server rejects the write if that id is not in admin_profile_ids, so a
// DevTools-patched isAdmin no longer buys anything.
async function saveAnnouncement(text, level, adminProfileId) {
  // Two urgency levels:
  //  - 'info'      → calm teal card; default for routine notices.
  //  - 'important' → terracotta with an alert icon; for time-sensitive items
  //                  (schedule changes, exam reminders) so users notice.
  const lv = level === 'important' ? 'important' : 'info';
  const entry = { id: `ann-${Date.now()}`, text: String(text || '').trim(), level: lv, ts: Date.now() };
  await adminWriteShared(KEYS.ANNOUNCEMENT, JSON.stringify(entry), adminProfileId);
  return entry;
}

async function clearAnnouncement(adminProfileId) {
  await adminDeleteShared(KEYS.ANNOUNCEMENT, adminProfileId);
}

// =====================================================================
// ADMIN UNLOCK  (Pipeline step 6 / A4 — server-side trust boundary)
//   Before A4: passphrase was the entire gate. Hash + salt are baked
//   into the JS bundle and the check happened client-side; any user
//   could patch `isAdmin = true` in DevTools and then write to
//   `announcement:current` directly against PostgREST because the
//   kv_shared write policy was open-anon. Security theatre.
//
//   After A4: passphrase is a UX gate only (so a casual tap doesn't
//   pop the unlock UI). The REAL check is server-side:
//     1) `checkServerAdmin(profileId)` reads the `admin_profile_ids`
//        table on Supabase — anon-readable, service-role-writable.
//     2) Admin-only writes (announcement create/clear) go via
//        `adminWriteShared` / `adminDeleteShared`, which POST/DELETE
//        directly to PostgREST with an `x-profile-id` header. The
//        kv_shared RLS policy reads that header and only permits the
//        write if the profile id is in `admin_profile_ids`.
//   Local `KEYS.ADMIN_STATUS` is now a UX cache so admin stays
//   unlocked between reloads without re-typing — boot re-verifies
//   against the server (see the useEffect in App) and silently
//   downgrades on failure. Offline: stays admin from cache; next
//   online boot re-verifies.
//
//   To CHANGE the admin passphrase: pick a new one and recompute the
//   hash with the same PBKDF2 params (SHA-256, 100k iter, 32-byte
//   output, UTF-8 bytes, salt below). Then paste the hex into
//   ADMIN_PASSPHRASE_HASH. Note: rotating the passphrase no longer
//   adds or removes anyone's admin power — that's done by INSERT /
//   DELETE on `admin_profile_ids` in the Supabase SQL editor.
// =====================================================================

const ADMIN_PASSPHRASE_HASH = '02786e6bc3bd324be1df06cf7159def507860fde25efb28418aadc7247042fbc';
const ADMIN_SALT = 'norcet-admin-salt-v1';

async function verifyAdminPassphrase(passphrase) {
  if (!passphrase) return false;
  const hash = await hashPassword(passphrase, ADMIN_SALT);
  return hash === ADMIN_PASSPHRASE_HASH;
}

// A4: Supabase config. Vite injects these at build time from .env / Vercel
// env vars. If your env-var names differ, change the two strings below — they
// are the ONLY references in App.jsx. Reads return `undefined` if unset.
const SUPABASE_URL_FOR_ADMIN = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_URL : undefined;
const SUPABASE_ANON_KEY_FOR_ADMIN = (typeof import.meta !== 'undefined' && import.meta.env)
  ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

// A4: Returns true iff `profileId` appears in the Supabase `admin_profile_ids`
// table. Never throws — any network / parse / config failure resolves to false
// (fail-closed: a broken admin check should reject, not grant).
async function checkServerAdmin(profileId) {
  if (!profileId) return false;
  if (!SUPABASE_URL_FOR_ADMIN || !SUPABASE_ANON_KEY_FOR_ADMIN) return false;
  try {
    const url = `${SUPABASE_URL_FOR_ADMIN}/rest/v1/admin_profile_ids`
      + `?profile_id=eq.${encodeURIComponent(profileId)}&select=profile_id`;
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY_FOR_ADMIN,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY_FOR_ADMIN}`,
        'Accept': 'application/json',
      },
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    return false;
  }
}

// A4: Direct PostgREST upsert for admin-only keys (currently: announcement:*).
// Bypasses safeStorage so we can attach the `x-profile-id` header that the new
// RLS policy on kv_shared inspects. Throws on non-2xx so the caller can show
// a real error to the user (the safeStorage helpers swallow failures, which
// would be wrong here — a silent failure would corrupt the admin's mental
// model of what they just did).
async function adminWriteShared(key, valueJson, adminProfileId) {
  if (!SUPABASE_URL_FOR_ADMIN || !SUPABASE_ANON_KEY_FOR_ADMIN) {
    throw new Error('Supabase URL / anon key not configured');
  }
  if (!adminProfileId) throw new Error('Missing admin profile id');
  const url = `${SUPABASE_URL_FOR_ADMIN}/rest/v1/kv_shared`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY_FOR_ADMIN,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY_FOR_ADMIN}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      'x-profile-id': adminProfileId,
    },
    body: JSON.stringify({ key, value: valueJson }),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`admin write failed: ${r.status} ${text || ''}`.trim());
  }
}

// A4: Direct PostgREST delete for admin-only keys. Same header story as
// adminWriteShared. 404 is treated as success (idempotent delete).
async function adminDeleteShared(key, adminProfileId) {
  if (!SUPABASE_URL_FOR_ADMIN || !SUPABASE_ANON_KEY_FOR_ADMIN) {
    throw new Error('Supabase URL / anon key not configured');
  }
  if (!adminProfileId) throw new Error('Missing admin profile id');
  const url = `${SUPABASE_URL_FOR_ADMIN}/rest/v1/kv_shared`
    + `?key=eq.${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_ANON_KEY_FOR_ADMIN,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY_FOR_ADMIN}`,
      'x-profile-id': adminProfileId,
    },
  });
  if (!r.ok && r.status !== 404) {
    const text = await r.text().catch(() => '');
    throw new Error(`admin delete failed: ${r.status} ${text || ''}`.trim());
  }
}

// A4: ADMIN_STATUS local cache is a UX shortcut so admin stays unlocked
// across reloads. Truthfulness is verified server-side by the boot re-verify
// effect; this read can be stale until that runs.
async function loadAdminStatus() {
  try {
    const result = await safeStorage.get(KEYS.ADMIN_STATUS);
    if (result && result.value) {
      const parsed = JSON.parse(result.value);
      return parsed && parsed.unlocked === true;
    }
  } catch (e) { /* not unlocked */ }
  return false;
}

async function saveAdminStatus(unlocked) {
  if (unlocked) {
    await safeStorage.set(KEYS.ADMIN_STATUS, JSON.stringify({ unlocked: true, ts: Date.now() }));
  } else {
    try { await safeStorage.delete(KEYS.ADMIN_STATUS); } catch (e) {}
  }
}

// =====================================================================
// QUESTION BANK LIBRARY
//   - Each bank is one shared-storage key: bank:<id>
//   - No central index — banks discovered by listing the "bank:" prefix
//   - ANY logged-in user can upload a bank and choose its visibility:
//       • public  → everyone can browse, import, and practise it
//       • private → only the creator (and admin) can see / use it
//   - The creator may toggle their OWN bank's visibility (not content).
//   - ONLY the admin can EDIT or DELETE any bank, and can override the
//     visibility of any bank.
//   - Banks carry: ownerId, ownerName, visibility, version, createdAt, updatedAt.
//   - Legacy banks with no visibility are treated as PUBLIC.
// =====================================================================

const newBankId = () => `bk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const bankVisibility = (bank) => (bank && bank.visibility === 'private' ? 'private' : 'public');
const isBankOwner = (bank, profileId) => !!(bank && profileId && bank.ownerId && bank.ownerId === profileId);

// Who may SEE / browse / import / practise a bank.
function canSeeBank(bank, profileId, isAdmin) {
  if (!bank) return false;
  if (isAdmin) return true;
  if (bankVisibility(bank) === 'public') return true;
  return isBankOwner(bank, profileId);
}

async function listBanks() {
  let keys = [];
  try {
    const result = await safeStorage.list(KEY_PREFIXES.BANK, true);
    keys = (result && result.keys) ? result.keys : [];
  } catch (e) {
    return [];
  }
  // Fetch all bank blobs in parallel; tolerate per-bank failures
  const banks = await Promise.all(keys.map(async (k) => {
    try {
      const r = await safeStorage.get(k, true);
      if (r && r.value) {
        const parsed = JSON.parse(r.value);
        if (parsed && parsed.id && Array.isArray(parsed.questions)) return parsed;
      }
    } catch (e) { /* skip */ }
    return null;
  }));
  return banks.filter(Boolean).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function loadBank(id) {
  try {
    const r = await safeStorage.get(KEYS.bank(id), true);
    if (r && r.value) return JSON.parse(r.value);
  } catch (e) { /* not found */ }
  return null;
}

async function saveBank(bank) {
  await safeStorage.set(KEYS.bank(bank.id), JSON.stringify(bank), true);
}

async function deleteBank(id) {
  try { await safeStorage.delete(KEYS.bank(id), true); return true; }
  catch (e) { return false; }
}

// Visibility-only change. Content version/updatedAt are deliberately left
// untouched (a public/private flip is not a content release). But we DO stamp
// `publishedAt` on the moment a bank first becomes public, so the home
// "What's new" sync can use it as a discovery signal — otherwise newly-shared
// banks would never surface for users until their next version bump.
async function setBankVisibility(id, visibility) {
  const bank = await loadBank(id);
  if (!bank) return null;
  const newVis = visibility === 'private' ? 'private' : 'public';
  const becomingPublic = newVis === 'public' && bankVisibility(bank) !== 'public';
  const updated = {
    ...bank,
    visibility: newVis,
    ...(becomingPublic ? { publishedAt: Date.now() } : {})
  };
  await saveBank(updated);
  return updated;
}

// =====================================================================
// HELPERS
// =====================================================================
const todayStr = () => new Date().toISOString().slice(0, 10);

function spacedRepetitionNext(lastResult, reviewCount) {
  if (!lastResult || lastResult === 'wrong') return 1;            // 1 day
  const intervals = [1, 3, 7, 14, 30, 60];
  return intervals[Math.min(reviewCount, intervals.length - 1)];
}

function arraysEqualUnordered(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function topicName(id, allQuestions) {
  const t = TOPICS.find(x => x.id === id);
  if (t) return t.name;
  // custom topics
  return id;
}

function topicColor(id) {
  const t = TOPICS.find(x => x.id === id);
  return t ? t.color : T.muted;
}

function topicIcon(id) {
  const t = TOPICS.find(x => x.id === id);
  return t ? t.icon : '📚';
}

function getWeakTopics(history, allQuestions) {
  const byTopic = {};
  Object.entries(history).forEach(([qId, h]) => {
    const q = allQuestions.find(x => x.id === qId);
    if (!q || !h) return;
    // P15 — route through attemptStats so compacted records contribute
    // their PRE-COMPACTION totals, not just the 5-attempt tail.
    const s = attemptStats(h);
    if (s.total === 0) return;
    if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0 };
    byTopic[q.topic].total += s.total;
    byTopic[q.topic].correct += s.correct;
  });
  return Object.entries(byTopic)
    .map(([topic, { correct, total }]) => ({ topic, accuracy: total > 0 ? correct / total : 0, total }))
    .filter(x => x.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy);
}

function getDueQuestions(history, allQuestions) {
  const today = new Date();
  return allQuestions.filter(q => {
    const h = history[q.id];
    if (!h || !h.nextDue) return false;
    return new Date(h.nextDue) <= today;
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =====================================================================
// QUICK PRACTICE SELECTION
//   Orders a pool so practice feels fresh and useful:
//   1. UNSEEN questions first (shuffled), so new material leads.
//   2. Then seen questions ordered by "need" — wrong/overdue/stale rank
//      high; recently-and-consistently-correct rank low.
//   Picking distinct items from this single ordered list guarantees no
//   repeats within a session; across sessions the ordering shifts as
//   history updates, so least-recently-seen / weakest items surface first.
// =====================================================================
function lastSeenTs(h) {
  // P15 — compacted records carry lastAttemptedTs directly; attemptStats
  // normalizes both shapes.
  return attemptStats(h).lastTs;
}

// Higher score → should be served sooner (only for already-seen questions).
function quickNeedScore(h, now) {
  if (!h) return 0;
  const daysSince = (now - lastSeenTs(h)) / 86400000;
  let score = daysSince; // base: staleness, in days (older = more need)

  // Overdue for spaced review
  if (h.nextDue && new Date(h.nextDue).getTime() <= now) score += 30;
  // Missed it last time — needs another look
  if (h.lastResult === 'wrong') score += 50;

  // Consistently correct on recent attempts — lower the need...
  const recent = (h.attempts || []).slice(-3);
  const allRecentCorrect = recent.length > 0 && recent.every(a => a.correct);
  if (allRecentCorrect) {
    score -= 20;
    if (daysSince < 1) score -= 40; // ...and don't re-serve if just answered right
  }
  // Well-rehearsed items (long correct streak) drift further down
  score -= Math.min((h.reviewCount || 0) * 3, 18);

  return score;
}

function selectQuickPracticeQuestions(pool, count, history) {
  const now = Date.now();
  const h = history || {};
  const unseen = [];
  const seen = [];
  pool.forEach(q => {
    const rec = h[q.id];
    // P15 — hasBeenSeen returns true for both Tier 2 (has attempts) and
    // Tier 3 (compacted) records.
    if (!hasBeenSeen(rec)) unseen.push(q);
    else seen.push(q);
  });
  // Fresh material first, in a varied order
  const orderedUnseen = shuffle(unseen);
  // Seen material by descending need; ties → least-recently-seen first
  const orderedSeen = seen.sort((a, b) => {
    const diff = quickNeedScore(h[b.id], now) - quickNeedScore(h[a.id], now);
    if (diff !== 0) return diff;
    return lastSeenTs(h[a.id]) - lastSeenTs(h[b.id]);
  });
  return [...orderedUnseen, ...orderedSeen].slice(0, count);
}

// Parses a single CSV line, handling quoted fields with embedded commas and escaped quotes.
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

// Download a string as a file in the browser
function downloadAsFile(text, filename, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =====================================================================
// SHARED QUESTION INPUT — parsing + validation
// Used by both the per-user bulk import and the admin bank uploader,
// so format and rules stay identical across both code paths.
// =====================================================================

function validateQuestionFields(q) {
  const errs = [];
  if (!q.q || typeof q.q !== 'string' || !q.q.trim()) errs.push('Missing question text');
  if (!Array.isArray(q.options) || q.options.length < 2) errs.push('Need ≥2 options');
  else if (q.options.some(o => !o || typeof o !== 'string' || !o.trim())) errs.push('Empty option');
  if (!Array.isArray(q.correct) || q.correct.length === 0) errs.push('Missing correct answer(s)');
  else if (q.correct.some(c => !Number.isInteger(c) || c < 0 || c >= (q.options?.length || 0))) errs.push('Correct index out of range');
  if (!q.exp || typeof q.exp !== 'string' || !q.exp.trim()) errs.push('Missing explanation');
  if (q.type && !['mcq', 'msq'].includes(q.type)) errs.push('type must be mcq or msq');
  if (q.type === 'mcq' && q.correct && q.correct.length !== 1) errs.push('mcq needs exactly 1 correct');
  if (q.difficulty && !['easy', 'medium', 'hard'].includes(q.difficulty)) errs.push('difficulty must be easy/medium/hard');
  return errs;
}

// Normalize a raw parsed question into the canonical shape used app-wide.
function normalizeQuestion(raw, idPrefix) {
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    topic: raw.topic || 'fund',
    sub: raw.sub || 'General',
    type: raw.type || 'mcq',
    q: raw.q.trim(),
    options: raw.options.map(o => o.trim()),
    correct: raw.correct,
    exp: raw.exp.trim(),
    wrong: raw.wrong || {},
    ...(raw.difficulty ? { difficulty: raw.difficulty } : {}),
    ...(raw.source ? { source: String(raw.source).trim() } : {})
  };
}

// Parse JSON or CSV → { items: [...] } or { parseError: '...' }
function parseQuestionInput(text, format) {
  if (!text || !text.trim()) return { parseError: 'Paste something first.' };
  try {
    if (format === 'json') {
      const parsed = JSON.parse(text);
      return { items: Array.isArray(parsed) ? parsed : [parsed] };
    }
    // CSV
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { parseError: 'Need a header row and at least one data row.' };
    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    const items = lines.slice(1).map(line => {
      const fields = parseCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = fields[i] !== undefined ? fields[i] : ''; });
      if (obj.options) obj.options = String(obj.options).split('|').map(s => s.trim()).filter(Boolean);
      if (obj.correct !== undefined && obj.correct !== '') {
        obj.correct = String(obj.correct).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      }
      if (obj.wrong && typeof obj.wrong === 'string' && obj.wrong.trim()) {
        const wrongObj = {};
        obj.wrong.split(';').forEach(pair => {
          const idx = pair.indexOf(':');
          if (idx > 0) {
            const k = pair.slice(0, idx).trim();
            const v = pair.slice(idx + 1).trim();
            if (k && v) wrongObj[k] = v;
          }
        });
        obj.wrong = wrongObj;
      } else if (!obj.wrong) {
        obj.wrong = {};
      }
      return obj;
    });
    return { items };
  } catch (e) {
    return { parseError: 'Parse error: ' + e.message };
  }
}

// Run parse + validate together. Returns { valid, invalid, parseError }
function processQuestionInput(text, format, idPrefix = 'q') {
  const parsed = parseQuestionInput(text, format);
  if (parsed.parseError) return { valid: [], invalid: [], parseError: parsed.parseError };
  const valid = [], invalid = [];
  parsed.items.forEach((q, i) => {
    const errs = validateQuestionFields(q);
    if (errs.length === 0) {
      valid.push(normalizeQuestion(q, idPrefix));
    } else {
      invalid.push({
        index: i + 1,
        errors: errs,
        preview: (q && q.q) ? String(q.q).slice(0, 80) : '(no question text)'
      });
    }
  });
  return { valid, invalid };
}

const EXAMPLE_QUESTIONS_JSON = JSON.stringify([
  {
    q: "What is the normal adult resting pulse rate?",
    type: "mcq",
    topic: "fund",
    sub: "Vital Signs",
    options: ["40-60 bpm", "60-100 bpm", "100-120 bpm", "120-140 bpm"],
    correct: [1],
    exp: "Normal adult resting pulse is 60-100 bpm.",
    wrong: { "0": "Bradycardia", "2": "Mild tachycardia", "3": "Significant tachycardia" },
    difficulty: "easy",
    source: "NORCET 2023 PYQ"
  },
  {
    q: "Which are signs of digoxin toxicity? (Select all that apply)",
    type: "msq",
    topic: "pharm",
    options: ["Yellow halos", "Bradycardia", "Nausea", "Hypertension"],
    correct: [0, 1, 2],
    exp: "Digoxin toxicity: visual disturbances, bradycardia, GI symptoms.",
    wrong: { "3": "Hypertension is not a digoxin toxicity feature." },
    difficulty: "medium",
    source: "Park textbook"
  }
], null, 2);

const EXAMPLE_QUESTIONS_CSV = `q,type,topic,sub,options,correct,exp,wrong,difficulty,source
"Normal adult pulse rate?",mcq,fund,Vital Signs,"40-60 bpm|60-100 bpm|100-120 bpm|120-140 bpm","1","Normal adult pulse is 60-100 bpm.","0:Bradycardia;2:Mild tachycardia;3:Significant tachycardia",easy,"NORCET 2023 PYQ"
"Signs of digoxin toxicity?",msq,pharm,Cardiac,"Yellow halos|Bradycardia|Nausea|Hypertension","0,1,2","Visual + brady + GI.","3:HTN is not digoxin toxicity",medium,"Park textbook"`;

// =====================================================================
// DUPLICATE DETECTION — used by bank upload to flag possible duplicates
// =====================================================================
// Normalize a stem: lowercase, drop punctuation, collapse whitespace,
// strip leading question numbers like "Q.1" or "1)".
function normalizeStem(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^\s*(q\s*\.?\s*\d+[\.\):]?|\d+[\.\):])\s*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Word-set Jaccard similarity (1.0 = identical words, 0 = nothing in common).
// Cheap, predictable, good enough for spotting near-duplicate stems.
function stemSimilarity(a, b) {
  const aN = normalizeStem(a);
  const bN = normalizeStem(b);
  if (!aN || !bN) return 0;
  if (aN === bN) return 1;
  const aw = new Set(aN.split(' ').filter(Boolean));
  const bw = new Set(bN.split(' ').filter(Boolean));
  if (aw.size === 0 || bw.size === 0) return 0;
  let inter = 0;
  for (const w of aw) if (bw.has(w)) inter++;
  const union = aw.size + bw.size - inter;
  return union === 0 ? 0 : inter / union;
}

const DUPLICATE_THRESHOLD = 0.75;  // 75% word-overlap → flag

// Returns { match, similarity } if a likely duplicate is found in pool, else null.
function findDuplicateStem(newQ, pool) {
  let bestMatch = null;
  let bestScore = 0;
  for (const ex of pool) {
    const s = stemSimilarity(newQ.q, ex.q);
    if (s > bestScore) { bestScore = s; bestMatch = ex; }
  }
  if (bestMatch && bestScore >= DUPLICATE_THRESHOLD) {
    return { match: bestMatch, similarity: bestScore };
  }
  return null;
}

// =====================================================================
// COMPONENTS
// =====================================================================

function Pill({ children, color = T.primary, bg = T.successSoft, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
          style={{ color, background: bg }}>
      {children}
    </span>
  );
}

function Card({ children, onClick, className = '', style = {} }) {
  return (
    <div onClick={onClick}
         className={`no-tap-highlight rounded-2xl ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''} ${className}`}
         style={{ background: T.surface, border: `1px solid ${T.border}`, ...style }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '', icon }) {
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
  // Theme-aware translucent background
  const tbBg = IS_DARK ? 'rgba(21,19,15,0.85)' : T.bg + 'D9';
  return (
    <div className="sticky top-0 z-20 backdrop-blur-md" style={{ background: tbBg, borderBottom: `1px solid ${T.borderSoft}` }}>
      <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onBack && (
            <button onClick={onBack} className="no-tap-highlight p-2 -ml-2 rounded-full active:bg-black/5">
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

// =====================================================================
// NAV DRAWER — slide-in "collapsible sidebar" for secondary destinations.
//   Keeps the home screen calm: study tools & utilities live in here behind
//   the menu button, grouped so they're easy to scan.
// =====================================================================
function NavDrawer({ open, onClose, data, onNavigate }) {
  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const go = (screen, extra) => { onClose(); onNavigate(extra ? { screen, ...extra } : { screen }); };

  const study = [
    { key: 'bookmarks', icon: Bookmark,    color: T.accent,       label: 'Bookmarks', sub: `${data.bookmarks.length} saved`, action: () => go('bookmarks-view') },
    { key: 'stats',     icon: BarChart3,   color: T.sec.stats,    label: 'Stats',     sub: 'Progress by topic',              action: () => go('stats') },
    { key: 'library',   icon: Layers,      color: T.sec.library,  label: 'Library',   sub: 'Question banks',                 action: () => go('library') },
    { key: 'addq',      icon: Plus,        color: T.primary,      label: 'Add question', sub: 'Your own custom Qs',          action: () => go('add-question') }
  ];
  const tools = [
    { key: 'examdate',  icon: CalendarDays, color: T.primary,      label: 'Exam date', sub: 'Countdown & daily goal',         action: () => go('exam-date') },
    { key: 'reference', icon: FlaskConical, color: T.accent,      label: 'Reference', sub: 'Labs, drugs, values',            action: () => go('reference') },
    { key: 'revision',  icon: FileText,     color: T.sec.revision,label: 'Revision',  sub: 'High-yield digest',              action: () => go('revision-sheet') }
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

  return (
    <div className="fixed inset-0 z-[70]" style={{ pointerEvents: open ? 'auto' : 'none' }} aria-hidden={!open}>
      {/* Scrim */}
      <div onClick={onClose}
           className="absolute inset-0 transition-opacity duration-300"
           style={{ background: 'rgba(0,0,0,0.45)', opacity: open ? 1 : 0 }} />

      {/* Sliding panel — the panel itself scrolls. Its height comes from
          inset-y-0 against the fixed full-screen wrapper (always definite),
          so scrolling works on every device without relying on flexbox. */}
      <div className="absolute inset-y-0 left-0 w-[82%] max-w-[330px] overflow-y-auto overscroll-contain transition-transform duration-300 ease-out"
           style={{
             background: T.bg,
             WebkitOverflowScrolling: 'touch',
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

          <GroupLabel>Tools</GroupLabel>
          {tools.map(it => <Item key={it.key} it={it} />)}

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

// =====================================================================
// HOME
// =====================================================================
function Home({ data, allQuestions, onNavigate, whatsNew, onDismissWhatsNew, announcement, onDismissAnnouncement, userName, unseenReplies, onOpenMyReports, onDismissReplies, onDismissGrace, onDismissReviewToday, onShowReviewInfo, onOpenMenu }) {
  const due = getDueQuestions(data.history, allQuestions);
  const weak = getWeakTopics(data.history, allQuestions);
  const accuracy = data.stats.totalAttempted > 0
    ? Math.round((data.stats.totalCorrect / data.stats.totalAttempted) * 100) : 0;
  const today = todayStr();
  const todayEntry = data.stats.dailyHistory.find(d => d.date === today);
  const todayCount = todayEntry ? todayEntry.attempted : 0;

  // Live time-of-day greeting — re-evaluates each minute so it flips correctly
  // when the hour crosses noon / 5pm even if the app is left open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';


  // In-app notice when the admin has replied to / resolved the user's feedback.
  const replies = unseenReplies || [];
  const fixedReply = replies.find(r => r.status === 'fixed');
  const replyMsg = fixedReply
    ? `Your report${fixedReply.questionId ? ` on ${fixedReply.questionId}` : ''} was fixed — thank you!`
    : (replies.length === 1
        ? 'An admin replied to your feedback.'
        : `An admin responded to ${replies.length} of your reports.`);

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-2 anim-fadeup">
      {/* Top bar: menu + quick settings */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onOpenMenu}
                className="no-tap-highlight flex items-center gap-2 p-2 -ml-2 rounded-xl active:bg-black/5"
                aria-label="Open menu">
          <Menu size={22} style={{ color: T.ink }} />
          <span className="text-sm font-medium" style={{ color: T.inkSoft }}>Menu</span>
        </button>
        <button onClick={() => onNavigate({ screen: 'settings' })}
                className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5" aria-label="Settings">
          <SettingsIcon size={20} style={{ color: T.muted }} />
        </button>
      </div>

      {/* Admin announcement — colour and icon depend on urgency level so
          time-sensitive notices stand out and users don't learn to dismiss
          everything reflexively. */}
      {announcement && announcement.id !== data.dismissedAnnouncementId && (() => {
        const important = announcement.level === 'important';
        const annAccent = important ? T.accent : T.primary;
        const AnnIcon = important ? AlertTriangle : Flag;
        return (
          <Card className="p-3 mb-4 anim-fadeup"
                style={{ background: annAccent + '12', border: `1px solid ${annAccent}40` }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: annAccent }}>
                <AnnIcon size={14} color="#FFF" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold mb-0.5" style={{ color: annAccent }}>
                  {important ? 'Important' : 'Announcement'}
                </div>
                <div className="text-sm leading-snug whitespace-pre-wrap" style={{ color: T.inkSoft }}>
                  {announcement.text}
                </div>
              </div>
              <button onClick={() => onDismissAnnouncement(announcement.id)}
                      className="no-tap-highlight p-1 -m-1 flex-shrink-0" aria-label="Dismiss">
                <X size={14} style={{ color: T.muted }} />
              </button>
            </div>
          </Card>
        );
      })()}

      {/* Feedback reply — your report got a response */}
      {replies.length > 0 && (
        <Card className="p-3 mb-4 anim-fadeup" onClick={onOpenMyReports}
              style={{ background: T.success + '12', border: `1px solid ${T.success}40`, cursor: 'pointer' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.success }}>
              {fixedReply ? <Check size={14} color="#FFF" /> : <AlertCircle size={14} color="#FFF" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.success }}>Feedback update</div>
              <div className="text-sm leading-snug" style={{ color: T.inkSoft }}>
                {replyMsg} <span className="underline">View</span>
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
        <Card className="p-3 mb-4 anim-fadeup"
              style={{ background: T.accent + '15', border: `1px solid ${T.accent}40` }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent }}>
              <span style={{ fontSize: 14 }}>🛡️</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.accent }}>Streak saved</div>
              <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
                You missed yesterday — your grace day covered it. Keep going today to keep the streak alive.
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
        <Card className="p-3 mb-4 anim-fadeup" onClick={() => onNavigate({ screen: 'library' })}
              style={{ background: T.accent + '15', border: `1px solid ${T.accent}40`, cursor: 'pointer' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent }}>
              <Sparkles size={14} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold mb-0.5" style={{ color: T.accent }}>What's new</div>
              <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
                {whatsNew.length === 1
                  ? `"${whatsNew[0].name}" updated to v${whatsNew[0].version}`
                  : `${whatsNew.length} banks updated`} — tap to view
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDismissWhatsNew(); }}
                    className="no-tap-highlight p-1 -m-1 flex-shrink-0">
              <X size={14} style={{ color: T.muted }} />
            </button>
          </div>
        </Card>
      )}

      {/* Greeting */}
      <div className="mb-6 mt-2">
        <div className="text-sm" style={{ color: T.muted }}>NORCET prep</div>
        <h1 className="font-display text-3xl font-semibold mt-1" style={{ color: T.ink }}>
          Good {timeOfDay}{userName ? `, ${userName}` : ''}
        </h1>
      </div>

      {/* Streak · Accuracy · Today — center-aligned summary strip */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {/* Streak */}
        <Card className="px-2 py-4 text-center relative">
          {data.stats.streakCurrent > 0 && data.stats.streakGraceAvailable !== false && (
            <span className="absolute top-2 right-2 text-[10px]" title="One missed day allowed">🛡️</span>
          )}
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.accent + '15' }}>
            <Flame size={16} style={{ color: T.accent }} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            Streak
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {data.stats.streakCurrent}
          </div>
          <div className="text-[10px]" style={{ color: T.muted }}>
            day{data.stats.streakCurrent === 1 ? '' : 's'}
          </div>
        </Card>

        {/* Accuracy */}
        <Card className="px-2 py-4 text-center">
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.primary + '15' }}>
            <Target size={16} style={{ color: T.primary }} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            Accuracy
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {accuracy}<span className="text-base font-medium">%</span>
          </div>
          <div className="text-[10px]" style={{ color: T.muted }}>
            {data.stats.totalAttempted} done
          </div>
        </Card>

        {/* Today */}
        <Card className="px-2 py-4 text-center">
          <div className="w-9 h-9 mx-auto rounded-full flex items-center justify-center mb-2"
               style={{ background: T.success + '20' }}>
            <Sparkles size={16} style={{ color: T.success }} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>
            Today
          </div>
          <div className="font-display text-2xl font-semibold leading-none mb-1" style={{ color: T.ink }}>
            {todayCount}
          </div>
          <div className="text-[10px]" style={{ color: T.muted }}>
            question{todayCount === 1 ? '' : 's'}
          </div>
        </Card>
      </div>

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
        if (due.length === 0 || !enabled || dismissedToday) return null;

        return (
          <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable"
                onClick={() => onNavigate({ screen: 'quiz', mode: 'review-due' })}
                style={{ background: T.successSoft, border: `1px solid ${T.success}30` }}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.success }}>
                  <RotateCcw size={18} color="#FFF" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold flex items-center gap-1.5" style={{ color: T.ink }}>
                    Review due
                    <button onClick={(e) => { e.stopPropagation(); onShowReviewInfo && onShowReviewInfo(); }}
                            className="no-tap-highlight p-0.5 -m-0.5 rounded-full"
                            aria-label="What is this?">
                      <HelpCircle size={13} style={{ color: T.muted }} />
                    </button>
                  </div>
                  <div className="text-xs truncate" style={{ color: T.inkSoft }}>
                    {due.length} question{due.length === 1 ? '' : 's'} for spaced revision
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); onDismissReviewToday && onDismissReviewToday(); }}
                        className="no-tap-highlight p-2 -m-1 rounded-full active:bg-black/5"
                        aria-label="Hide for today"
                        title="Hide for today">
                  <X size={16} style={{ color: T.muted }} />
                </button>
                <ChevronRight size={20} style={{ color: T.muted }} />
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Focus row — Weak area & Coverage gaps, side by side.
          Weak Area = where she's struggling (accuracy too low).
          Untouched = where she hasn't even started yet.
          Two halves of the same picture; both deep-link to Coverage. */}
      {(() => {
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
            <Card key="weak" className="p-3 cursor-pointer no-tap-highlight pressable"
                  onClick={() => onNavigate({ screen: 'weak-areas' })}
                  style={{ background: T.errorSoft, border: `1px solid ${T.error}30` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertCircle size={14} style={{ color: T.error }} />
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.error }}>
                  Weak area
                </div>
              </div>
              <div className="font-display text-sm font-semibold truncate" style={{ color: T.ink }}>
                {topicName(worstWeak.topic)}
              </div>
              <div className="text-[11px]" style={{ color: T.muted }}>
                {Math.round(worstWeak.accuracy * 100)}% accuracy
              </div>
            </Card>
          );
        }

        // Coverage tile — always render once she has any data, since the
        // drawer no longer surfaces Coverage anywhere else. The message
        // adapts: while there are untouched topics it warns, once she's
        // started every topic it becomes a calmer "open the breakdown".
        if (hasAnyAttempts) {
          const showWarning = untouchedCount > 0;
          tiles.push(
            <Card key="untouched" className="p-3 cursor-pointer no-tap-highlight pressable"
                  onClick={() => onNavigate({ screen: 'coverage' })}
                  style={{
                    background: showWarning ? T.accent + '12' : T.surfaceWarm,
                    border: `1px solid ${showWarning ? T.accent + '30' : T.border}`
                  }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Activity size={14} style={{ color: showWarning ? T.accent : T.primary }} />
                <div className="text-[10px] uppercase tracking-wider font-semibold"
                     style={{ color: showWarning ? T.accent : T.primary }}>
                  Coverage
                </div>
              </div>
              {showWarning ? (
                <>
                  <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>
                    {untouchedCount} topic{untouchedCount === 1 ? '' : 's'}
                  </div>
                  <div className="text-[11px]" style={{ color: T.muted }}>
                    not started yet
                  </div>
                </>
              ) : (
                <>
                  <div className="font-display text-sm font-semibold" style={{ color: T.ink }}>
                    All topics
                  </div>
                  <div className="text-[11px]" style={{ color: T.muted }}>
                    view the breakdown
                  </div>
                </>
              )}
            </Card>
          );
        }

        // If only one tile qualifies, stretch it to full width rather than
        // leaving a lonely half-width card next to empty space.
        return (
          <div className={`grid gap-2 mb-4 ${tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {tiles}
          </div>
        );
      })()}

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
          <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'exam-date' })}
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
                      <div className="font-display text-base font-semibold">Exam date passed</div>
                      <div className="text-xs mt-0.5">Tap to set a new date</div>
                    </>
                  ) : daysLeft === 0 ? (
                    <>
                      <div className="font-display text-base font-semibold">Exam day — good luck</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{niceDate}</div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="font-display text-2xl font-semibold leading-none">{daysLeft}</div>
                        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>day{daysLeft === 1 ? '' : 's'} to {niceDate}</div>
                      </div>
                      <div className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {perDay > 0 ? (
                          <>
                            Today: <span className="font-semibold">{todayCount2}/{perDay}</span>{' '}
                            <span style={{ opacity: 0.75 }}>
                              ({todayProgress}% · {manualTarget ? 'your goal' : 'auto'})
                            </span>
                          </>
                        ) : 'Keep revising.'}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight size={20} style={{ color: examPassed ? T.muted : 'rgba(255,255,255,0.7)' }} className="flex-shrink-0 mt-1" />
            </div>
          </Card>
        );
      })()}

      {/* Advanced Test — featured */}
      <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'advanced-setup' })}
            style={{ background: T.sec.advanced, border: 'none' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Hourglass size={20} color={T.bg} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="font-display text-base font-semibold" style={{ color: T.bg }}>Advanced Test</div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ background: T.accent, color: '#FFF' }}>Exam</span>
              </div>
              <div className="text-xs leading-snug truncate" style={{ color: T.bg, opacity: 0.7 }}>
                Negative marking · Countdown · Palette
              </div>
            </div>
          </div>
          <ChevronRight size={20} style={{ color: T.bg, opacity: 0.6 }} />
        </div>
      </Card>

      {/* Main actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-4" onClick={() => onNavigate({ screen: 'quick-setup' })}
              style={{ borderTop: `3px solid ${T.sec.quick}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.sec.quick }}>
            <Shuffle size={18} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Quick test</div>
          <div className="text-xs" style={{ color: T.muted }}>Pick count + topic</div>
        </Card>
        <Card className="p-4" onClick={() => onNavigate({ screen: 'topic-select' })}
              style={{ borderTop: `3px solid ${T.sec.topic}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.sec.topic }}>
            <ListChecks size={18} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Topic wise test</div>
          <div className="text-xs" style={{ color: T.muted }}>Pick a subject</div>
        </Card>
        <Card className="p-4" onClick={() => onNavigate({ screen: 'mock-setup' })}
              style={{ borderTop: `3px solid ${T.sec.mock}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.sec.mock }}>
            <Timer size={18} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Mock test</div>
          <div className="text-xs" style={{ color: T.muted }}>Timed simulation</div>
        </Card>
        <Card className="p-4" onClick={() => onNavigate({ screen: 'learn-topics' })}
              style={{ borderTop: `3px solid ${T.sec.learn}` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: T.sec.learn }}>
            <Brain size={18} color="#FFF" />
          </div>
          <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Learn topic wise</div>
          <div className="text-xs" style={{ color: T.muted }}>Concept cards</div>
        </Card>
      </div>

      {/* Dosage calculator — numeric drug-math practice. Lives on the dashboard
          (not the slide-in menu) since it's a core practice mode. */}
      <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={() => onNavigate({ screen: 'dosage' })}
            style={{ borderTop: `3px solid ${T.primary}` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
            <Calculator size={20} color="#FFF" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-base font-semibold mb-0.5" style={{ color: T.ink }}>Dosage calculation test</div>
            <div className="text-xs" style={{ color: T.muted }}>Numeric drug-math practice · type-in answers</div>
          </div>
          <ChevronRight size={20} style={{ color: T.muted }} />
        </div>
      </Card>

      {/* Secondary destinations (Bookmarks, Stats, Library, Add Q, Reference,
          Revision, Coverage) and Settings now live in the slide-in
          menu (NavDrawer), opened from the Menu button at the top. */}
    </div>
  );
}

// =====================================================================
// DATE PICKER — custom calendar so the whole field is tappable and the
// calendar UI is fully themeable (the native one can't be styled).
// Works on ISO 'YYYY-MM-DD' strings to stay drop-in compatible.
// =====================================================================
function DatePicker({ value, onChange, min }) {
  const [open, setOpen] = useState(false);

  const parseISO = (s) => {
    if (!s) return null;
    const [y, m, d] = String(s).split('-').map(Number);
    return (y && m && d) ? new Date(y, m - 1, d) : null;
  };
  const toISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const selected = parseISO(value);
  const minDate = parseISO(min); if (minDate) minDate.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [view, setView] = useState(() => {
    const base = selected || today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const fmt = selected
    ? selected.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isDisabled = (dt) => minDate && dt < minDate;

  const cells = (() => {
    const year = view.getFullYear(), month = view.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  })();

  const prevDisabled = minDate && (view.getFullYear() < minDate.getFullYear()
    || (view.getFullYear() === minDate.getFullYear() && view.getMonth() <= minDate.getMonth()));

  const goMonth = (delta) => setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));
  const pick = (dt) => { if (isDisabled(dt)) return; onChange(toISO(dt)); setView(new Date(dt.getFullYear(), dt.getMonth(), 1)); setOpen(false); };

  const presets = [{ l: '+1 mo', m: 1 }, { l: '+3 mo', m: 3 }, { l: '+6 mo', m: 6 }, { l: '+1 yr', m: 12 }];

  return (
    <div className="relative mb-4">
      <button onClick={() => setOpen(o => !o)}
              className="no-tap-highlight w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-sm transition-all"
              style={{ background: T.surface, border: `1px solid ${open ? T.primary : T.border}`,
                       boxShadow: open ? `0 0 0 3px ${T.primary}1A` : '0 1px 2px rgba(26,43,35,0.04)' }}>
        <span style={{ color: fmt ? T.ink : T.muted, fontWeight: fmt ? 600 : 400 }}>
          {fmt || 'dd – mm – yyyy'}
        </span>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: open ? T.primary : T.primary + '12' }}>
          <Calendar size={16} style={{ color: open ? '#FFF' : T.primary }} />
        </span>
      </button>

      {open && (
        <div className="anim-scalein mt-2 rounded-2xl p-4"
             style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: '0 12px 32px rgba(26,43,35,0.14)' }}>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => goMonth(-1)} disabled={prevDisabled}
                    className="no-tap-highlight w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition"
                    style={{ background: T.surfaceWarm, opacity: prevDisabled ? 0.4 : 1, cursor: prevDisabled ? 'not-allowed' : 'pointer' }}>
              <ChevronLeft size={18} style={{ color: T.ink }} />
            </button>
            <div className="font-display text-base font-semibold" style={{ color: T.ink }}>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </div>
            <button onClick={() => goMonth(1)}
                    className="no-tap-highlight w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition"
                    style={{ background: T.surfaceWarm }}>
              <ChevronRight size={18} style={{ color: T.ink }} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 mb-1.5">
            {WEEK.map((w, i) => (
              <div key={i} className="text-center text-[10px] uppercase tracking-wide font-semibold py-1" style={{ color: T.muted }}>{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((dt, i) => {
              if (!dt) return <div key={i} />;
              const sel = sameDay(dt, selected);
              const isToday = sameDay(dt, today);
              const dis = isDisabled(dt);
              return (
                <button key={i} onClick={() => pick(dt)} disabled={dis}
                        className="no-tap-highlight aspect-square rounded-xl flex items-center justify-center text-sm relative transition active:scale-90"
                        style={{
                          background: sel ? T.primary : isToday ? T.primary + '14' : 'transparent',
                          color: sel ? '#FFF' : dis ? T.muted : T.ink,
                          opacity: dis ? 0.3 : 1,
                          fontWeight: sel || isToday ? 700 : 500,
                          boxShadow: sel ? `0 2px 8px ${T.primary}55` : 'none'
                        }}>
                  {dt.getDate()}
                </button>
              );
            })}
          </div>

          {/* Quick exam-date presets */}
          <div className="flex gap-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
            {presets.map(p => (
              <button key={p.l}
                      onClick={() => pick(new Date(today.getFullYear(), today.getMonth() + p.m, today.getDate()))}
                      className="no-tap-highlight flex-1 py-2 rounded-lg text-[11px] font-semibold active:scale-95 transition"
                      style={{ background: T.surfaceWarm, color: T.inkSoft }}>
                {p.l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// EXAM DATE SETTER
// =====================================================================
function ExamDateScreen({ data, allQuestionsCount, onSave, onClear, onSaveTarget, onBack }) {
  const [dateValue, setDateValue] = useState(data.stats.examDate || '');
  // Manual daily target (questions/day). Stored as a number; null/0 = auto.
  const initialTarget = data.stats.dailyTarget || 0;
  const [targetValue, setTargetValue] = useState(initialTarget > 0 ? String(initialTarget) : '');
  const [targetMode, setTargetMode] = useState(initialTarget > 0 ? 'manual' : 'auto');
  const todayISO = new Date().toISOString().slice(0, 10);

  const target = dateValue ? new Date(dateValue) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (target) target.setHours(0, 0, 0, 0);
  const daysLeft = target ? Math.round((target - today) / (1000 * 60 * 60 * 24)) : null;

  // Auto pace preview — mirrors the formula on Home so the user sees what
  // "auto" will work out to before saving.
  const autoPace = (daysLeft && daysLeft > 0 && allQuestionsCount > 0)
    ? Math.min(120, Math.max(20, Math.ceil(allQuestionsCount / daysLeft)))
    : null;

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  const handleSaveAll = () => {
    onSave(dateValue);
    const n = parseInt(targetValue, 10);
    const finalTarget = targetMode === 'manual' && n > 0 ? n : null;
    if (onSaveTarget) onSaveTarget(finalTarget);
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Exam date" onBack={onBack} feedback={{ screen: "Exam date" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">

        <Card className="p-5 mb-5" style={{ background: T.primary, border: 'none' }}>
          <div className="flex items-center gap-3 mb-2">
            <CalendarDays size={20} color="#FFF" />
            <div className="font-display text-lg font-semibold" style={{ color: '#FFF' }}>Set your target</div>
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Show a countdown on the home screen and get a daily question-pace target so you stay on schedule.
          </div>
        </Card>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Exam date</div>
        <DatePicker value={dateValue} onChange={setDateValue} min={todayISO} />
        {daysLeft !== null && daysLeft >= 0 && (
          <Card className="p-4 mb-5" style={{ background: T.surfaceWarm }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>That's</div>
            <div className="font-display text-3xl font-semibold" style={{ color: T.ink }}>
              {daysLeft} <span className="text-base font-normal" style={{ color: T.muted }}>day{daysLeft === 1 ? '' : 's'} away</span>
            </div>
          </Card>
        )}

        {/* Daily goal — kept deliberately plain-spoken */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>Daily goal</div>
        <div className="text-xs mb-3 px-0.5 leading-relaxed" style={{ color: T.muted }}>
          How many questions to study each day. We'll show it on your home screen and tick it off as you go.
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 mt-1">
          {[
            { id: 'auto', label: 'Decide for me', icon: <Sparkles size={15} />, rec: true },
            { id: 'manual', label: "I'll pick", icon: <Edit3 size={15} />, rec: false }
          ].map(opt => {
            const active = targetMode === opt.id;
            return (
              <button key={opt.id} onClick={() => setTargetMode(opt.id)}
                      className="no-tap-highlight relative py-3 px-3 rounded-xl text-sm font-semibold flex flex-col items-center gap-1.5 transition-all active:scale-[0.98]"
                      style={{ background: active ? T.primary : T.surface,
                               color: active ? '#FFF' : T.inkSoft,
                               border: `1.5px solid ${active ? T.primary : T.border}`,
                               boxShadow: active ? `0 2px 10px ${T.primary}33` : 'none' }}>
                {opt.rec && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: active ? '#FFF' : T.accent, color: active ? T.primary : '#FFF' }}>
                    Recommended
                  </span>
                )}
                <span style={{ opacity: active ? 1 : 0.7 }}>{opt.icon}</span>
                {opt.label}
              </button>
            );
          })}
        </div>

        {targetMode === 'auto' && (
          autoPace ? (
            <Card className="p-4 mb-4 flex items-center gap-4" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}26` }}>
              <div className="flex-shrink-0 w-16 text-center">
                <div className="font-display text-3xl font-semibold leading-none" style={{ color: T.primary }}>{autoPace}</div>
                <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: T.muted }}>a day</div>
              </div>
              <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
                Study about <span className="font-semibold" style={{ color: T.ink }}>{autoPace} questions a day</span> and you'll get through everything before your exam.
              </div>
            </Card>
          ) : (
            <Card className="p-4 mb-4 flex items-center gap-3" style={{ background: T.surfaceWarm }}>
              <CalendarDays size={18} className="flex-shrink-0" style={{ color: T.muted }} />
              <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
                Pick your exam date above first — then we'll work out a daily number for you.
              </div>
            </Card>
          )
        )}

        {targetMode === 'manual' && (
          <div className="mb-4">
            <div className="text-xs mb-2 px-0.5" style={{ color: T.muted }}>Tap a number, or type your own:</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {[10, 20, 30, 50, 75, 100].map(n => {
                const sel = targetValue === String(n);
                return (
                  <button key={n} onClick={() => setTargetValue(String(n))}
                          className="no-tap-highlight py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
                          style={{ background: sel ? T.primary : T.surface,
                                   color: sel ? '#FFF' : T.inkSoft,
                                   border: `1.5px solid ${sel ? T.primary : T.border}` }}>
                    {n}
                  </button>
                );
              })}
            </div>
            <input type="number" inputMode="numeric" min="1" max="500"
                   value={targetValue} onChange={e => setTargetValue(e.target.value)}
                   placeholder="Or type a number…"
                   className="w-full rounded-xl px-4 py-3 text-sm" style={inputStyle} />
            {targetValue && parseInt(targetValue, 10) > 0 && (
              <div className="text-xs mt-2 px-0.5" style={{ color: T.muted }}>
                Your goal: <span className="font-semibold" style={{ color: T.ink }}>{parseInt(targetValue, 10)} questions a day</span>.
              </div>
            )}
          </div>
        )}

        <Button onClick={handleSaveAll} disabled={!dateValue}
                size="lg" className="w-full mb-2" icon={<Save size={18} />}>
          Save
        </Button>

        {data.stats.examDate && (
          <Button onClick={onClear} variant="ghost" size="lg" className="w-full" icon={<X size={16} />}>
            Clear exam date
          </Button>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// TOPIC SELECT
// =====================================================================
function TopicSelect({ allQuestions, history, onPick, onBack }) {
  const countsByTopic = useMemo(() => {
    const c = {};
    allQuestions.forEach(q => { c[q.topic] = (c[q.topic] || 0) + 1; });
    return c;
  }, [allQuestions]);

  const accuracyByTopic = useMemo(() => {
    const a = {};
    Object.entries(history).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      // P15 — accurate totals across Tier 2 and Tier 3 records.
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!a[q.topic]) a[q.topic] = { c: 0, t: 0 };
      a[q.topic].t += s.total;
      a[q.topic].c += s.correct;
    });
    return a;
  }, [history, allQuestions]);

  return (
    <div className="anim-fadeup">
      <TopBar title="Pick a topic" onBack={onBack} feedback={{ screen: "Topic select" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">
        <div className="space-y-2.5">
          {TOPICS.filter(t => countsByTopic[t.id] > 0).map(topic => {
            const acc = accuracyByTopic[topic.id];
            const accPct = acc && acc.t > 0 ? Math.round((acc.c / acc.t) * 100) : null;
            return (
              <Card key={topic.id} className="p-4" onClick={() => onPick(topic.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                         style={{ background: topic.color + '15' }}>
                      {topic.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base font-semibold truncate" style={{ color: T.ink }}>
                        {topic.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                        {countsByTopic[topic.id]} question{countsByTopic[topic.id] === 1 ? '' : 's'}
                        {accPct !== null && ` · ${accPct}% accuracy`}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} style={{ color: T.muted }} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// QUIZ
// =====================================================================
function Quiz({ questions, mode, allQuestions, data, onComplete, onBack, timed, timeLimitMin }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);   // user tapped "Show answer" without selecting
  const [results, setResults] = useState([]);        // per question { qId, correct, selected, timeMs, revealed? }
  const [bookmarkedLocal, setBookmarkedLocal] = useState(new Set(data.bookmarks));
  // For count-down (mock): seconds remaining. For count-up (legacy): seconds elapsed.
  // `isCountdown` is the single switch: true iff timeLimitMin > 0.
  const isCountdown = !!(timed && timeLimitMin && timeLimitMin > 0);
  const totalSeconds = isCountdown ? timeLimitMin * 60 : 0;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [elapsed, setElapsed] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [altShown, setAltShown] = useState(false);

  // Skip queue. When the user taps "Skip" we move the current question to the
  // end of the round so they can try the rest first. Tracking is by question
  // ID (not index) because positions in `questions` are stable but our
  // traversal is dynamic.
  //
  // `schedule` is the actual play order. It starts as 0..n-1. Skipping the
  // current item moves its INDEX (into `questions`) to the end of `schedule`.
  // If a question is skipped twice, it stays where it is (cap loop) and
  // continues to the next item.
  const [schedule, setSchedule] = useState(() => questions.map((_, i) => i));
  const [skipCounts, setSkipCounts] = useState({});   // qId -> number of times skipped
  // Confirm-before-exit. The user can lose meaningful progress if they tap
  // back accidentally — and they will, on phones. Any tap on Back during an
  // active test routes through this dialog instead of immediately exiting.
  // The dialog is also triggered when the device's back button or browser
  // back fires (popstate handler below).
  const [confirmExit, setConfirmExit] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const questionStart = useRef(Date.now());

  // Mode capabilities:
  //   - Hints & Show-answer are study aids — Quick Practice only.
  //   - Skip exists in Quick AND Mock. In Mock it mirrors real exam strategy:
  //     defer hard questions, attempt easy ones first. The "Show answer"
  //     bypass stays gated so mocks remain content-honest.
  const isPractice = mode === 'quick';
  const hintsAllowed = isPractice;
  const showAnswerAllowed = isPractice;
  const skipAllowed = isPractice || mode === 'mock';

  // Position in the schedule, not in the original `questions` array.
  const scheduleIndex = index;
  const realIndex = schedule[scheduleIndex];
  const q = questions[realIndex];

  // How many questions remain AFTER this one in the current schedule.
  const remainingAfter = schedule.length - scheduleIndex - 1;
  const canSkip = skipAllowed && !submitted && !revealed && remainingAfter > 0;

  // Time tracking. For mock we count DOWN from totalSeconds; for any other
  // timed mode we count UP (legacy behaviour, unused today but kept for
  // future modes). When countdown hits zero, finish the test with whatever
  // we have. `elapsed` is always reported to onComplete as time spent.
  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => {
      if (isCountdown) {
        setSecondsRemaining(s => {
          if (s <= 1) {
            clearInterval(t);
            return 0;
          }
          return s - 1;
        });
        setElapsed(e => e + 1);
      } else {
        setElapsed(e => e + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [timed, isCountdown]);

  // Auto-finish when the countdown hits 0. Submits whatever's been answered.
  // We defer to a tick so React commits state cleanly before navigating away.
  useEffect(() => {
    if (!isCountdown) return;
    if (secondsRemaining > 0) return;
    // Avoid double-fire by checking against a ref-less guard: just run once.
    const id = setTimeout(() => onComplete(results, bookmarkedLocal, elapsed), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCountdown, secondsRemaining]);

  // Intercept device/browser back button so it routes through the confirm
  // dialog too — same rule as the in-app back arrow. We push a placeholder
  // history entry on mount; when the user fires back, popstate triggers, we
  // push the entry again (cancelling the navigation) and show the confirm.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;
    window.history.pushState({ quizGuard: true }, '');
    const onPop = (e) => {
      // Each pop consumes the guard entry; push another so the next back
      // tap is intercepted too. Then surface the confirm.
      window.history.pushState({ quizGuard: true }, '');
      setConfirmExit(true);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Best-effort: on normal completion or programmatic exit we leave the
      // guard entry in place. Browsers collapse forward stack on next nav so
      // this doesn't pollute history meaningfully.
    };
  }, []);

  // Reset question start time + hint/reveal visibility on every question change
  useEffect(() => {
    questionStart.current = Date.now();
    setHintShown(false);
    setAltShown(false);
    setRevealed(false);
  }, [index]);

  if (!q) {
    const emptyTitle = mode === 'bookmarks' ? 'Bookmarks'
      : mode === 'review-due' ? 'Review'
      : mode === 'wrong' ? 'Review'
      : 'Practice';
    return (
      <div className="anim-fadeup">
        <TopBar title={emptyTitle} onBack={onBack}
                feedback={{ screen: `Quiz · ${mode || 'practice'} (empty)` }} />
        <div className="p-6 text-center max-w-md mx-auto pt-16">
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>No questions available</div>
          <div className="text-sm" style={{ color: T.muted }}>
            {mode === 'bookmarks' && 'You have no bookmarked questions yet — bookmark a few during practice, then come back.'}
            {mode === 'review-due' && 'Nothing is due for review yet — come back tomorrow.'}
            {mode === 'wrong' && 'No wrong answers to review.'}
            {!['bookmarks', 'review-due', 'wrong'].includes(mode) && 'Nothing to show here.'}
          </div>
        </div>
      </div>
    );
  }

  const toggleSelect = (i) => {
    if (submitted || revealed) return;
    if (q.type === 'mcq') setSelected([i]);
    else setSelected(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const submit = () => {
    if (selected.length === 0) return;
    const correct = arraysEqualUnordered(selected, q.correct);
    const timeMs = Date.now() - questionStart.current;
    setResults(r => [...r, { qId: q.id, correct, selected, timeMs }]);
    setSubmitted(true);
  };

  // "Show answer" — reveals the explanation without an attempt. Recorded as
  // INCORRECT (so the question feeds into spaced repetition and Weak Areas),
  // with `revealed: true` so future stats can distinguish a true miss from
  // a "didn't try". The submitted/revealed flags both gate option taps so
  // the user can't sneakily turn a reveal into a free correct answer.
  const revealAnswer = () => {
    if (submitted || revealed) return;
    const timeMs = Date.now() - questionStart.current;
    setResults(r => [...r, { qId: q.id, correct: false, selected: [], timeMs, revealed: true }]);
    setRevealed(true);
  };

  // "Skip" — defer this question to the end of the round so the user can
  // attempt easier ones first. Each question can only be skipped twice
  // before it sticks in place; this caps the worst-case "infinite skip" loop.
  const skipQuestion = () => {
    if (!canSkip) return;
    const qId = q.id;
    const skips = skipCounts[qId] || 0;

    setSkipCounts(s => ({ ...s, [qId]: skips + 1 }));

    if (skips >= 1) {
      // Already skipped once — leave in place and just advance the cursor.
      // (We'd otherwise risk shuffling the queue forever.)
      setSelected([]);
      setIndex(i => i + 1);
      return;
    }

    // Move the realIndex from `scheduleIndex` to the end of the schedule.
    setSchedule(prev => {
      const next = prev.slice();
      const [moved] = next.splice(scheduleIndex, 1);
      next.push(moved);
      return next;
    });
    setSelected([]);
    // Stay at the same scheduleIndex — the next question now occupies it.
    // Force a question-change effect by bumping a non-existent state? No —
    // schedule itself changed, so q updates automatically. Reset per-question
    // state explicitly here since the index didn't change.
    questionStart.current = Date.now();
    setHintShown(false);
    setAltShown(false);
    setRevealed(false);
  };

  const next = () => {
    if (scheduleIndex + 1 < schedule.length) {
      setIndex(i => i + 1);
      setSelected([]);
      setSubmitted(false);
      setRevealed(false);
    } else {
      onComplete(results, bookmarkedLocal, elapsed);
    }
  };

  const toggleBookmark = () => {
    const newSet = new Set(bookmarkedLocal);
    if (newSet.has(q.id)) newSet.delete(q.id);
    else newSet.add(q.id);
    setBookmarkedLocal(newSet);
  };

  // Progress reflects how far along the schedule (which may include re-queued
  // skipped items), not the original questions array.
  const progress = ((scheduleIndex + ((submitted || revealed) ? 1 : 0)) / schedule.length) * 100;
  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
    <div className="anim-fadeup">
      <TopBar
        title={`Q ${scheduleIndex + 1} of ${schedule.length}`}
        onBack={() => setConfirmExit(true)}
        feedback={{ screen: `Quiz · ${mode || 'practice'}`, questionId: q.id }}
        right={
          <div className="flex items-center gap-2">
            {timed && (() => {
              // Countdown: show time remaining; flash red when under a minute.
              // Count-up: show elapsed (legacy).
              const displaySec = isCountdown ? secondsRemaining : elapsed;
              const lowTime   = isCountdown && secondsRemaining <= 60 && secondsRemaining > 0;
              const noTime    = isCountdown && secondsRemaining === 0;
              const bg = noTime ? T.errorSoft : (lowTime ? T.errorSoft : T.surfaceWarm);
              const fg = (lowTime || noTime) ? T.error : T.ink;
              return (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tabular-nums"
                     style={{ background: bg, color: fg }}>
                  <Timer size={12} />
                  {fmtTime(displaySec)}
                </div>
              );
            })()}
            <button onClick={toggleBookmark} className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
              {bookmarkedLocal.has(q.id)
                ? <BookmarkCheck size={20} style={{ color: T.accent }} />
                : <Bookmark size={20} style={{ color: T.muted }} />}
            </button>
          </div>
        }
      />

      <div className="max-w-md mx-auto px-4 pb-40 pt-2">
        {/* Progress */}
        <div className="mb-5">
          <div className="h-1 rounded-full" style={{ background: T.borderSoft }}>
            <div className="h-1 rounded-full transition-all duration-300" style={{ background: T.primary, width: `${progress}%` }} />
          </div>
        </div>

        {/* Topic + type pills */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Pill bg={topicColor(q.topic) + '15'} color={topicColor(q.topic)}>
            {topicIcon(q.topic)} {topicName(q.topic)}
          </Pill>
          {q.sub && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.sub}</Pill>}
          <Pill bg={q.type === 'msq' ? T.errorSoft : T.successSoft} color={q.type === 'msq' ? T.error : T.success}>
            {q.type === 'msq' ? 'Multi-select' : 'Single answer'}
          </Pill>
        </div>

        {/* Question */}
        <div className="flex items-start gap-2 mb-4">
          <div className="font-display text-xl leading-snug flex-1" style={{ color: T.ink }}>
            {q.q}
          </div>
          <TTSButton text={q.q} className="flex-shrink-0 mt-1" />
        </div>

        {/* Hint (Quick Practice only, and only if question has one) */}
        {hintsAllowed && q.hint && !submitted && (
          <div className="mb-5">
            {!hintShown ? (
              <button onClick={() => setHintShown(true)}
                      className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition"
                      style={{ background: T.accent + '15', color: T.accent, border: `1px solid ${T.accent}40` }}>
                <Lightbulb size={12} />
                Need a hint?
              </button>
            ) : (
              <Card className="anim-fadeup p-3" style={{ background: T.accent + '12', border: `1px solid ${T.accent}40` }}>
                <div className="flex items-start gap-2">
                  <Lightbulb size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
                  <div className="text-sm leading-snug italic" style={{ color: T.inkSoft }}>{q.hint}</div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Options */}
        <div className="space-y-2.5 mb-6">
          {q.options.map((opt, i) => {
            const isSelected = selected.includes(i);
            const isCorrect = q.correct.includes(i);
            // After submit OR reveal, options become read-only and the correct
            // answers light up green. Submit also marks wrong picks in red;
            // reveal has no "selected" picks so only correct ones are styled.
            const isLocked = submitted || revealed;
            let bg = T.surface;
            let border = T.border;
            let textColor = T.ink;
            let dotBg = T.surface;
            let dotBorder = T.border;
            let dotColor = T.muted;
            if (isLocked) {
              if (isCorrect) {
                bg = T.successSoft;
                border = T.success;
                dotBg = T.success;
                dotColor = '#FFF';
              } else if (isSelected) {
                // Only happens on submit (reveal has no selection)
                bg = T.errorSoft;
                border = T.error;
                dotBg = T.error;
                dotColor = '#FFF';
              }
            } else if (isSelected) {
              bg = T.primary + '08';
              border = T.primary;
              dotBg = T.primary;
              dotColor = '#FFF';
            }
            return (
              <div key={i} onClick={() => toggleSelect(i)}
                   className="no-tap-highlight rounded-2xl px-4 py-3.5 flex items-start gap-3 transition-colors cursor-pointer active:scale-[0.99]"
                   style={{ background: bg, border: `1.5px solid ${border}` }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold"
                     style={{ background: dotBg, border: `1.5px solid ${isLocked && isCorrect ? T.success : (isSelected ? border : T.border)}`, color: dotColor }}>
                  {isLocked && isCorrect ? <Check size={14} /> : isLocked && isSelected ? <X size={14} /> : String.fromCharCode(65 + i)}
                </div>
                <div className="text-sm leading-snug pt-0.5" style={{ color: textColor }}>{opt}</div>
              </div>
            );
          })}
        </div>

        {/* "You revealed this" banner — gentle nudge so she sees this was an
            assist, not a real attempt. Honest about the consequence for stats. */}
        {revealed && (
          <Card className="p-3 mb-3 anim-fadeup"
                style={{ background: T.accent + '12', border: `1px solid ${T.accent}40` }}>
            <div className="flex items-start gap-2.5 text-xs leading-relaxed" style={{ color: T.inkSoft }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
              <div>
                Answer revealed. This question will show up in Weak Areas so you can revisit it.
              </div>
            </div>
          </Card>
        )}

        {/* Explanation */}
        {(submitted || revealed) && (
          <div className="anim-fadeup space-y-3 mb-6">
            <Card className="p-4" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb size={16} style={{ color: T.accent }} />
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Explanation</div>
                </div>
                <TTSButton text={q.exp} />
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{q.exp}</div>
            </Card>
            {q.wrong && Object.keys(q.wrong).length > 0 && (
              <Card className="p-4" style={{ background: T.surface }}>
                <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>Why the others are wrong</div>
                <div className="space-y-2.5">
                  {Object.entries(q.wrong).map(([idx, text]) => (
                    <div key={idx} className="flex gap-2.5 text-sm" style={{ color: T.inkSoft }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-semibold"
                           style={{ background: T.errorSoft, color: T.error }}>
                        {String.fromCharCode(65 + parseInt(idx))}
                      </div>
                      <div className="leading-relaxed pt-0.5">{text}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Explain differently (only if alt_exp present) */}
            {q.alt_exp && !altShown && (
              <button onClick={() => setAltShown(true)}
                      className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium active:scale-95 transition"
                      style={{ background: T.surface, border: `1.5px dashed ${T.primary}50`, color: T.primary }}>
                <Brain size={14} />
                I still don't get it
              </button>
            )}
            {q.alt_exp && altShown && (
              <Card className="anim-fadeup p-4" style={{ background: T.primary + '12', border: `1px solid ${T.primary}40` }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Brain size={14} style={{ color: T.primary }} />
                    <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.primary }}>Explained another way</div>
                  </div>
                  <TTSButton text={q.alt_exp} />
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{q.alt_exp}</div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {/* Quick reference — opens a lookup overlay (labs, drugs, vitals,
              conversions) without leaving the question. Always available in
              Quick / Topic / Mock; Advanced Test is a separate component and
              intentionally has no reference. */}
          <div className="flex justify-center mb-2">
            <button onClick={() => setShowReference(true)}
                    className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium active:scale-95 transition"
                    style={{ background: T.surfaceWarm, color: T.accent, border: `1px solid ${T.border}` }}>
              <FlaskConical size={13} />
              Reference
            </button>
          </div>
          {(submitted || revealed) ? (
            <Button onClick={next} size="lg" className="w-full" variant="primary"
                    icon={<ChevronRight size={18} />}>
              {scheduleIndex + 1 < schedule.length ? 'Next question' : 'Finish'}
            </Button>
          ) : (
            <>
              {/* Quick Practice gets both shortcuts: Skip (defer to later) and
                  Show answer (peek the explanation, counted as wrong). Mock
                  gets Skip only — exam-realistic strategy aid without letting
                  the user peek at answers. Other modes get no shortcuts. */}
              {showAnswerAllowed ? (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button onClick={skipQuestion}
                          disabled={!canSkip}
                          className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium active:scale-95 transition disabled:opacity-40"
                          style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
                    <ChevronRight size={12} />
                    Skip{remainingAfter > 0 ? ` (try later)` : ''}
                  </button>
                  <button onClick={revealAnswer}
                          className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium active:scale-95 transition"
                          style={{ background: T.surface, color: T.accent, border: `1px solid ${T.accent}50` }}>
                    <Eye size={12} />
                    Show answer
                  </button>
                </div>
              ) : skipAllowed && (
                <button onClick={skipQuestion}
                        disabled={!canSkip}
                        className="no-tap-highlight w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium active:scale-95 transition disabled:opacity-40 mb-2"
                        style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
                  <ChevronRight size={12} />
                  Skip{remainingAfter > 0 ? ` (come back to this)` : ''}
                </button>
              )}
              <Button onClick={submit} disabled={selected.length === 0} size="lg" className="w-full">
                Check answer
              </Button>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Confirm-before-exit modal. Lives as a sibling of the anim-fadeup wrapper
        so its `position: fixed` is relative to the viewport rather than to a
        transformed ancestor. Tapping the dim overlay defaults to "Stay" — safer
        when an accidental tap is what triggered the prompt in the first place. */}
    {confirmExit && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
           style={{ background: 'rgba(0,0,0,0.5)' }}
           onClick={() => setConfirmExit(false)}>
        <Card className="w-full max-w-md anim-scalein"
              onClick={e => e.stopPropagation()}>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={18} style={{ color: T.accent }} />
              <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>
                Leave this {mode === 'mock' ? 'mock test' : 'session'}?
              </div>
            </div>
            <div className="text-sm leading-relaxed mb-4" style={{ color: T.inkSoft }}>
              Your progress in this {mode === 'mock' ? 'test' : 'round'} won't be saved.
              {results.length > 0 && (
                <> You've answered <span style={{ color: T.ink, fontWeight: 600 }}>{results.length} of {schedule.length}</span> so far — those answers will be lost.</>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setConfirmExit(false)} className="flex-1">
                Keep going
              </Button>
              <Button variant="accent" onClick={() => { setConfirmExit(false); onBack(); }} className="flex-1">
                Leave anyway
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )}

    {/* Reference lookup overlay — sibling of the anim-fadeup wrapper so its
        position:fixed anchors to the viewport. Toggling it preserves all quiz
        state, so the user returns to the exact same question. */}
    <ReferenceLookupModal open={showReference} onClose={() => setShowReference(false)} />
    </>
  );
}

// =====================================================================
// RESULTS
// =====================================================================
// Tone-aware celebration banner. The score drives the headline, sub-line,
// icon, gradient and quote — so a 95% gets genuine celebration while a 20%
// gets honest, supportive acknowledgement rather than hollow applause.
//
// Three tiers:
//   ≥75%  victory — bright teal gradient, "Excellent work"
//   40–74 growth  — calm primary gradient, "Solid effort"
//   <40   support — muted earthy tone, "Keep going" (NEVER fakes congratulations)
//
// The caller passes the score directly; an optional `label` (e.g. "Test",
// "Dosage calc") tunes the sub-line wording without changing the tone logic.
function MotivationCard({ pct = 50, label = 'session' }) {
  const tier =
    pct >= 75 ? 'victory' :
    pct >= 40 ? 'growth'  :
                'support';

  // Quote picked exactly once per mount, matched to tier — no defeatist quotes
  // on a 95% and no triumphant quotes on a 20%. A ref (not useMemo) guarantees
  // the quote can never re-roll on an incidental re-render.
  const quoteRef = useRef(null);
  if (quoteRef.current === null) quoteRef.current = pickQuoteForScore(pct);
  const quote = quoteRef.current;

  // Tier-specific copy + visuals. Kept warm and honest, never mocking.
  const config = {
    victory: {
      headline: pct >= 90 ? 'Outstanding!' : 'Excellent work!',
      sub: `That was a strong ${label}.`,
      icon: <Sparkles size={20} color="#FFF" />,
      gradient: 'linear-gradient(135deg, #0F4C4C 0%, #1A6868 100%)',
      textColor: '#FFF',
      mutedColor: 'rgba(255,255,255,0.7)'
    },
    growth: {
      headline: pct >= 60 ? 'Good progress.' : 'Nice effort.',
      sub: `Every ${label} sharpens your prep.`,
      icon: <Target size={20} color="#FFF" />,
      gradient: 'linear-gradient(135deg, #1A6868 0%, #3D8585 100%)',
      textColor: '#FFF',
      mutedColor: 'rgba(255,255,255,0.75)'
    },
    support: {
      headline: pct === 0 ? "That was tough." : 'Keep going.',
      sub: `Each ${label} shows you exactly what to focus on next.`,
      icon: <Flame size={20} color="#FFF" />,
      // Warm, earthy — not red/alarming. Supportive, not celebratory.
      gradient: 'linear-gradient(135deg, #7A4A2E 0%, #A56B47 100%)',
      textColor: '#FFF',
      mutedColor: 'rgba(255,255,255,0.78)'
    }
  }[tier];

  return (
    <div className="anim-scalein rounded-2xl p-5 mb-6 text-center"
         style={{ background: config.gradient, color: config.textColor }}>
      <div className="flex justify-center mb-2">
        <div className="w-11 h-11 rounded-full flex items-center justify-center"
             style={{ background: 'rgba(255,255,255,0.15)' }}>
          {config.icon}
        </div>
      </div>
      <div className="font-display text-xl font-semibold mb-1">{config.headline}</div>
      <div className="text-xs mb-3" style={{ color: config.mutedColor }}>{config.sub}</div>
      <div className="font-display text-base leading-snug mb-2">“{quote.t}”</div>
      <div className="text-xs" style={{ color: config.mutedColor }}>— {quote.a}</div>
    </div>
  );
}

function Results({ results, questions, elapsed, onHome, onReview }) {
  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const wrong = results.filter(r => !r.correct);

  const verdict =
    pct >= 90 ? { word: 'Exceptional', color: T.success } :
    pct >= 75 ? { word: 'Strong work', color: T.success } :
    pct >= 60 ? { word: 'Solid effort', color: T.primary } :
    pct >= 40 ? { word: 'Keep going', color: T.accent } :
                { word: 'Time to learn', color: T.error };

  const fmtTime = (s) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="anim-fadeup max-w-md mx-auto px-4 pt-8 pb-24">
      <MotivationCard pct={pct} label="round" />
      <div className="text-center mb-8">
        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>Session complete</div>
        <div className="font-display text-3xl font-semibold mb-1" style={{ color: verdict.color }}>{verdict.word}</div>
        <div className="text-sm" style={{ color: T.muted }}>{correct} of {total} correct</div>
      </div>

      {/* Big score circle */}
      <div className="flex justify-center mb-8">
        <div className="relative w-44 h-44">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke={T.borderSoft} strokeWidth="7" />
            <circle cx="50" cy="50" r="44" fill="none" stroke={verdict.color} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * 276.46} 276.46`}
                    style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-5xl font-semibold" style={{ color: T.ink }}>{pct}<span className="text-2xl" style={{ color: T.muted }}>%</span></div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {elapsed > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-8">
          <Card className="p-3 text-center">
            <Check size={16} className="mx-auto mb-1" style={{ color: T.success }} />
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{correct}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Correct</div>
          </Card>
          <Card className="p-3 text-center">
            <X size={16} className="mx-auto mb-1" style={{ color: T.error }} />
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{total - correct}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Wrong</div>
          </Card>
          <Card className="p-3 text-center">
            <Timer size={16} className="mx-auto mb-1" style={{ color: T.primary }} />
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>{fmtTime(elapsed)}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Time</div>
          </Card>
        </div>
      )}

      {/* Wrong question list */}
      {wrong.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>To revise</div>
          <div className="space-y-2">
            {wrong.map(r => {
              const q = questions.find(qq => qq.id === r.qId);
              if (!q) return null;
              return (
                <Card key={r.qId} className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="text-base flex-shrink-0">{topicIcon(q.topic)}</div>
                    <div className="text-sm leading-snug" style={{ color: T.ink }}>{q.q}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {wrong.length > 0 && (
          <Button onClick={() => onReview(wrong.map(r => r.qId))} variant="ghost" size="lg" className="w-full">
            Re-do the wrong ones
          </Button>
        )}
        <Button onClick={onHome} size="lg" className="w-full">
          Back to home
        </Button>
      </div>
    </div>
  );
}

// =====================================================================
// LEARN — Topic List
// =====================================================================
function LearnTopics({ onPick, onBack }) {
  const topicsWithCards = TOPICS.filter(t => CONCEPT_CARDS[t.id] && CONCEPT_CARDS[t.id].length > 0);
  // Accordion: only one topic open at a time — same pattern as Coverage so
  // the page stays scannable. Tap a row to toggle; tap the topic-wide Start
  // to read everything; tap a module-level Start to scope to that module.
  const [expanded, setExpanded] = useState(null);
  const totalCards = topicsWithCards.reduce((acc, t) => acc + CONCEPT_CARDS[t.id].reduce((a, s) => a + s.cards.length, 0), 0);

  return (
    <div className="anim-fadeup">
      <TopBar title="Learn topic wise" onBack={onBack} feedback={{ screen: "Learn — topics" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        {/* Intro */}
        <div className="px-1 mb-5">
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Concept cards</div>
          <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
            Bite-sized notes across {topicsWithCards.length} topics · {totalCards} cards. Open a topic to pick a module, or read the whole topic top-to-bottom.
          </div>
        </div>

        <div className="space-y-3">
          {topicsWithCards.map(topic => {
            const subs = CONCEPT_CARDS[topic.id];
            const cardCount = subs.reduce((acc, s) => acc + s.cards.length, 0);
            const isOpen = expanded === topic.id;
            return (
              <Card key={topic.id} className="overflow-hidden transition-shadow"
                    style={{ borderLeft: `3px solid ${topic.color}`,
                             boxShadow: isOpen ? `0 6px 20px ${topic.color}1A` : '0 1px 2px rgba(26,43,35,0.04)' }}>
                {/* TOPIC ROW — tap body to expand; Read reads the whole topic. */}
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setExpanded(isOpen ? null : topic.id)}
                            className="no-tap-highlight flex items-center gap-3.5 flex-1 min-w-0 text-left">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                           style={{ background: topic.color + '14', boxShadow: `inset 0 0 0 1px ${topic.color}22` }}>
                        {topic.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-base font-semibold leading-tight" style={{ color: T.ink }}>{topic.name}</div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] font-medium" style={{ color: T.muted }}>
                          <span className="inline-flex items-center gap-1"><Layers size={11} /> {subs.length} module{subs.length === 1 ? '' : 's'}</span>
                          <span className="inline-flex items-center gap-1"><BookOpen size={11} /> {cardCount} card{cardCount === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => onPick(topic.id, null)}
                              className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold active:scale-95 transition"
                              style={{ background: topic.color, color: '#FFF', boxShadow: `0 2px 8px ${topic.color}40` }}>
                        <BookOpen size={13} />
                        Read
                      </button>
                      <button onClick={() => setExpanded(isOpen ? null : topic.id)}
                              className="no-tap-highlight p-1.5 rounded-full active:bg-black/5"
                              aria-label={isOpen ? 'Collapse' : 'Expand modules'}>
                        <ChevronDown size={16}
                                     className="transition-transform duration-200"
                                     style={{ color: T.muted, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* MODULE PANEL — each row is tappable to read that module. */}
                {isOpen && (
                  <div className="px-4 pb-4 anim-fadeup">
                    <div className="pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                      <div className="text-[10px] uppercase tracking-widest font-semibold mb-2.5 px-0.5" style={{ color: T.muted }}>
                        {subs.length} module{subs.length === 1 ? '' : 's'}
                      </div>
                      <div className="space-y-1.5">
                        {subs.map((s, i) => (
                          <button key={s.sub} onClick={() => onPick(topic.id, s.sub)}
                                  className="no-tap-highlight w-full flex items-center gap-3 p-2.5 rounded-xl active:scale-[0.99] transition text-left"
                                  style={{ background: T.surfaceWarm }}>
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold flex-shrink-0 tabular-nums"
                                  style={{ background: topic.color + '18', color: fgOnDark(topic.color) }}>
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium leading-snug" style={{ color: T.ink }}>{s.sub}</div>
                              <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>
                                {s.cards.length} card{s.cards.length === 1 ? '' : 's'}
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold flex-shrink-0" style={{ color: fgOnDark(topic.color) }}>
                              Read <ChevronRight size={13} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// LEARN — Card Reader
// =====================================================================
function LearnCards({ topicId, subFilter, onBack }) {
  const subs = CONCEPT_CARDS[topicId] || [];
  // If a specific module was requested from LearnTopics, only render its
  // cards. Falling back to the full topic preserves the "Start all" path.
  const allCards = useMemo(() => {
    const arr = [];
    subs.forEach(s => {
      if (subFilter && s.sub !== subFilter) return;
      s.cards.forEach(c => arr.push({ ...c, sub: s.sub }));
    });
    return arr;
  }, [topicId, subFilter]);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);   // self-check answer toggle
  const [direction, setDirection] = useState('next'); // drives slide animation
  const touchStartX = useRef(null);
  const card = allCards[index];

  // Keyboard navigation (← →). Declared before any early return so the hook
  // order stays stable; re-binds each index change to capture current state.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' && index + 1 < allCards.length) {
        setDirection('next'); setIndex(index + 1); setRevealed(false);
      } else if (e.key === 'ArrowLeft' && index > 0) {
        setDirection('prev'); setIndex(index - 1); setRevealed(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, allCards.length]);

  if (!card) {
    return (
      <div className="p-6 max-w-md mx-auto text-center anim-fadeup">
        <div className="font-display text-xl mb-3" style={{ color: T.ink }}>Cards coming soon</div>
        <div className="text-sm mb-6" style={{ color: T.muted }}>This topic's concept cards are being prepared.</div>
        <Button onClick={onBack}>Back</Button>
      </div>
    );
  }

  const typeMeta = {
    concept:   { label: 'Concept', icon: <BookOpen size={13} />, color: T.primary, bg: T.primary + '15' },
    mnemonic:  { label: 'Mnemonic', icon: <Sparkles size={13} />, color: T.accent, bg: T.accent + '15' },
    keypoints: { label: 'Key Points', icon: <ListChecks size={13} />, color: T.success, bg: T.successSoft },
    quiz:      { label: 'Self-Check', icon: <Brain size={13} />, color: '#7A4A2E', bg: '#7A4A2E15' }
  };
  const meta = typeMeta[card.type] || typeMeta.concept;

  // Self-check cards store "question … Answer: …" in one string — split so the
  // answer can be hidden behind a tap.
  let quiz = null;
  if (card.type === 'quiz' && typeof card.body === 'string') {
    const parts = card.body.split(/Answer\s*:/i);
    quiz = parts.length >= 2
      ? { question: parts[0].trim(), answer: parts.slice(1).join('Answer:').trim() }
      : { question: card.body, answer: null };
  }

  const canPrev = index > 0;
  const canNext = index + 1 < allCards.length;
  const navTo = (i, dir) => { setDirection(dir); setIndex(i); setRevealed(false); };
  const goPrev = () => { if (canPrev) navTo(index - 1, 'prev'); };
  const goNext = () => { if (canNext) navTo(index + 1, 'next'); };

  // Swipe to navigate.
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -50) goNext();
    else if (dx > 50) goPrev();
  };

  const useDots = allCards.length <= 14;

  return (
    <div className="anim-fadeup">
      <TopBar title={subFilter ? `${topicName(topicId)} · ${subFilter}` : topicName(topicId)} onBack={onBack}
              feedback={{ screen: 'Learn — cards' }}
              right={<div className="text-xs font-semibold tabular-nums" style={{ color: T.muted }}>{index + 1} / {allCards.length}</div>} />
      <div className="max-w-md mx-auto px-4 pb-36 pt-4">
        {/* Progress — tappable segments jump to any card */}
        {useDots ? (
          <div className="flex gap-1.5 mb-2">
            {allCards.map((_, i) => (
              <button key={i} onClick={() => navTo(i, i > index ? 'next' : 'prev')}
                      aria-label={`Go to card ${i + 1}`}
                      className="no-tap-highlight flex-1 rounded-full transition-all active:scale-y-150"
                      style={{ height: 5, background: i === index ? meta.color : i < index ? meta.color + '66' : T.borderSoft }} />
            ))}
          </div>
        ) : (
          <div className="h-1.5 rounded-full mb-2" style={{ background: T.borderSoft }}>
            <div className="h-1.5 rounded-full transition-all duration-300" style={{ background: meta.color, width: `${((index + 1) / allCards.length) * 100}%` }} />
          </div>
        )}
        <div className="flex items-center justify-center gap-1.5 mb-5 text-[10px]" style={{ color: T.muted }}>
          <ArrowLeft size={10} /> Swipe or use arrow keys <ChevronRight size={10} />
        </div>

        {/* Card */}
        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
             className={direction === 'prev' ? 'anim-slide-prev' : 'anim-slide-next'} key={index}>
          <Card className="overflow-hidden mb-4" style={{ borderTop: `3px solid ${meta.color}` }}>
            <div className="p-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <Pill bg={meta.bg} color={meta.color}>{meta.icon}{meta.label}</Pill>
                <span className="text-[10px] uppercase tracking-widest font-semibold truncate" style={{ color: T.muted }}>{card.sub}</span>
              </div>
              <div className="font-display text-2xl font-semibold leading-tight mb-4" style={{ color: T.ink }}>
                {card.title}
              </div>

              {card.type === 'keypoints' && Array.isArray(card.body) ? (
                <ul className="space-y-2.5">
                  {card.body.map((b, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: meta.color + '18' }}>
                        <Check size={12} style={{ color: fgOnDark(meta.color) }} />
                      </span>
                      <div className="text-sm leading-relaxed" style={{ color: T.ink }}>{b}</div>
                    </li>
                  ))}
                </ul>
              ) : quiz ? (
                <>
                  <div className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{quiz.question}</div>
                  {quiz.answer && (
                    revealed ? (
                      <div className="mt-5 p-4 rounded-xl anim-fadeup" style={{ background: meta.color + '12', border: `1px solid ${meta.color}33` }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Lightbulb size={13} style={{ color: fgOnDark(meta.color) }} />
                          <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: fgOnDark(meta.color) }}>Answer</div>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{quiz.answer}</div>
                      </div>
                    ) : (
                      <button onClick={() => setRevealed(true)}
                              className="no-tap-highlight mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition"
                              style={{ border: `1.5px dashed ${meta.color}66`, color: fgOnDark(meta.color), background: meta.color + '0A' }}>
                        <Eye size={15} /> Reveal answer
                      </button>
                    )
                  )}
                </>
              ) : (
                <div className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{card.body}</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 backdrop-blur-md"
           style={{ background: IS_DARK ? 'rgba(21,19,15,0.9)' : T.bg + 'E6', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-3">
          <Button variant="ghost" onClick={goPrev} disabled={!canPrev} size="lg" className="flex-1"
                  icon={<ChevronLeft size={18} />}>
            Previous
          </Button>
          <Button onClick={() => canNext ? goNext() : onBack()} size="lg" className="flex-1"
                  icon={canNext ? <ChevronRight size={18} /> : <Check size={18} />}>
            {canNext ? 'Next' : 'Done'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// STATS
// =====================================================================
function StatsScreen({ data, allQuestions, onBack, onQuick, onPracticeTopic }) {
  const [topicSort, setTopicSort] = useState('weak'); // 'weak' | 'strong'
  const [chartReady, setChartReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setChartReady(true), 280); return () => clearTimeout(t); }, []);
  const [trendWindow, setTrendWindow] = useState(6);          // P13: months — 3 | 6 | 12
  const [showAllTrends, setShowAllTrends] = useState(false);  // P13: top-6 vs all topics

  const byTopic = useMemo(() => {
    const acc = {};
    Object.entries(data.history).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      // P15 — attemptStats returns accurate pre-compaction totals.
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!acc[q.topic]) acc[q.topic] = { id: q.topic, correct: 0, total: 0, name: topicName(q.topic), color: topicColor(q.topic) };
      acc[q.topic].total += s.total;
      acc[q.topic].correct += s.correct;
    });
    return Object.values(acc).map(x => ({
      ...x, accuracy: x.total > 0 ? Math.round((x.correct / x.total) * 100) : 0
    }));
  }, [data.history, allQuestions]);

  const dailyData = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const entry = data.stats.dailyHistory.find(x => x.date === key);
      days.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
        label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        attempted: entry ? entry.attempted : 0
      });
    }
    return days;
  }, [data.stats.dailyHistory]);

  // How much of the pool has been touched at least once.
  const coverage = useMemo(() => {
    // P15 — hasBeenSeen counts both Tier 2 (attempts present) and Tier 3.
    const seen = Object.values(data.history).filter(h => hasBeenSeen(h)).length;
    const total = allQuestions.length || 1;
    return { seen, total, pct: Math.round((seen / total) * 100) };
  }, [data.history, allQuestions]);

  // Accuracy over the last 7 days vs the 7 days before — needs a little data
  // in each window to be meaningful.
  const trend = useMemo(() => {
    const now = Date.now(), day = 86400000;
    const cutA = now - 7 * day, cutB = now - 14 * day;
    let a = { c: 0, t: 0 }, b = { c: 0, t: 0 };
    Object.values(data.history).forEach(h => {
      (h.attempts || []).forEach(at => {
        if (typeof at.ts !== 'number') return;
        if (at.ts >= cutA) { a.t++; if (at.correct) a.c++; }
        else if (at.ts >= cutB) { b.t++; if (at.correct) b.c++; }
      });
    });
    if (a.t < 3 || b.t < 3) return null;
    return { delta: Math.round((a.c / a.t) * 100 - (b.c / b.t) * 100) };
  }, [data.history]);

  // The single most useful next action.
  const recommendation = useMemo(() => {
    const practiced = byTopic.filter(t => t.total >= 2);
    const weak = [...practiced].sort((x, y) => x.accuracy - y.accuracy)[0];
    if (weak && weak.accuracy < 70) return { kind: 'weak', topicId: weak.id, name: weak.name, accuracy: weak.accuracy };
    const practicedIds = new Set(byTopic.map(t => t.id));
    const poolTopicIds = Array.from(new Set(allQuestions.map(q => q.topic)));
    const untouched = poolTopicIds.find(id => !practicedIds.has(id));
    if (untouched) return { kind: 'new', topicId: untouched, name: topicName(untouched) };
    return { kind: 'sharp' };
  }, [byTopic, allQuestions]);

  const mastery = useMemo(() => {
    let strong = 0, building = 0, weak = 0;
    byTopic.forEach(t => { if (t.accuracy >= 75) strong++; else if (t.accuracy >= 50) building++; else weak++; });
    return { strong, building, weak };
  }, [byTopic]);

  // P13 — per-topic accuracy OVER TIME (monthly). Derived entirely from
  // data.history[qId].attempts[].ts (spec point 6): additive, migration-free,
  // does not touch data.stats.dailyHistory. Safe vs P15 compaction — any
  // trend window here is ≤12 months, well inside the 730-day per-attempt
  // retention, so attempts[] is always complete within the window.
  const topicTrends = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = trendWindow - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'short' })
      });
    }
    const windowStart = new Date(now.getFullYear(), now.getMonth() - (trendWindow - 1), 1).getTime();

    const acc = {};    // topicId -> monthKey -> { c, t }
    const totals = {}; // topicId -> attempts within the window
    Object.entries(data.history).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      (h.attempts || []).forEach(at => {
        if (typeof at.ts !== 'number' || at.ts < windowStart) return;
        const d = new Date(at.ts);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        acc[q.topic] = acc[q.topic] || {};
        acc[q.topic][mk] = acc[q.topic][mk] || { c: 0, t: 0 };
        acc[q.topic][mk].t++; if (at.correct) acc[q.topic][mk].c++;
        totals[q.topic] = (totals[q.topic] || 0) + 1;
      });
    });

    const topics = Object.keys(acc)
      .filter(tid => (totals[tid] || 0) >= 10)            // require ≥10 attempts in window
      .map(tid => {
        const series = months.map(m => {
          const cell = acc[tid][m.key];
          const ok = cell && cell.t >= 5;                  // skip months with <5 (too noisy)
          return {
            key: m.key, label: m.label, n: cell ? cell.t : 0,
            accuracy: ok ? Math.round((cell.c / cell.t) * 100) : null
          };
        });
        return { id: tid, name: topicName(tid), color: topicColor(tid), total: totals[tid], series };
      })
      .filter(t => t.series.filter(p => p.accuracy !== null).length >= 2) // a line needs ≥2 points
      .sort((a, b) => b.total - a.total);

    // Auto-derived insights: compare first vs last plotted month per topic.
    const cand = [];
    topics.forEach(t => {
      const pts = t.series.filter(p => p.accuracy !== null);
      if (pts.length < 2) return;
      const delta = pts[pts.length - 1].accuracy - pts[0].accuracy;
      if (delta >= 10) cand.push({ type: 'up', name: t.name, delta });
      else if (delta <= -10) cand.push({ type: 'down', name: t.name, delta });
      else if (pts.every(p => p.accuracy >= 75)) cand.push({ type: 'strong', name: t.name, delta: 0 });
    });
    const movers = cand.filter(c => c.type !== 'strong').sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const insights = [...movers, ...cand.filter(c => c.type === 'strong')].slice(0, 3);

    return { months, topics, insights };
  }, [data.history, allQuestions, trendWindow]);

  if (data.stats.totalAttempted === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Your stats" onBack={onBack} feedback={{ screen: "Stats" }} />
        <div className="max-w-md mx-auto px-4 pt-12 pb-24 text-center">
          <BarChart3 size={48} className="mx-auto mb-4" style={{ color: T.muted, opacity: 0.4 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>No data yet</div>
          <div className="text-sm mb-6" style={{ color: T.muted }}>
            Practise some questions and your progress, speed, weak areas, and a suggested next step will show up here.
          </div>
          {onQuick && (
            <Button onClick={onQuick} className="inline-flex" icon={<Shuffle size={16} />}>
              Start Quick test
            </Button>
          )}
        </div>
      </div>
    );
  }

  const overallAcc = Math.round((data.stats.totalCorrect / data.stats.totalAttempted) * 100);
  const fortnightTotal = dailyData.reduce((s, d) => s + d.attempted, 0);
  const sortedTopics = [...byTopic].sort((a, b) => topicSort === 'weak' ? a.accuracy - b.accuracy : b.accuracy - a.accuracy);
  const streak = data.stats.streakCurrent || 0;
  const bestStreak = data.stats.streakBest || 0;

  const recColor = recommendation.kind === 'weak' ? T.error : recommendation.kind === 'new' ? T.primary : T.success;

  return (
    <div className="anim-fadeup">
      <TopBar title="Your stats" onBack={onBack} feedback={{ screen: "Stats" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">

        {/* Headline */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Questions answered</div>
            <div className="font-display text-3xl font-semibold" style={{ color: T.ink }}>{data.stats.totalAttempted}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Overall accuracy</div>
            <div className="flex items-baseline gap-2">
              <div className="font-display text-3xl font-semibold" style={{ color: T.primary }}>{overallAcc}%</div>
              {trend && trend.delta !== 0 && (
                <span className="inline-flex items-center text-[11px] font-semibold"
                      style={{ color: trend.delta > 0 ? T.success : T.error }}>
                  {trend.delta > 0 ? <ChevronUp size={13} /> : <ChevronDown size={13} />}{Math.abs(trend.delta)}
                </span>
              )}
            </div>
            {trend && trend.delta !== 0 && (
              <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>vs last week</div>
            )}
          </Card>
        </div>

        {/* Streak + coverage strip */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card className="p-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={14} style={{ color: streak > 0 ? T.accent : T.muted }} />
              <div className="text-[11px] uppercase tracking-wider" style={{ color: T.muted }}>Streak</div>
            </div>
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>
              {streak} <span className="text-sm font-normal" style={{ color: T.muted }}>day{streak === 1 ? '' : 's'}</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>best {bestStreak}</div>
          </Card>
          <Card className="p-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers size={14} style={{ color: T.sec.library }} />
              <div className="text-[11px] uppercase tracking-wider" style={{ color: T.muted }}>Coverage</div>
            </div>
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>
              {coverage.pct}% <span className="text-sm font-normal" style={{ color: T.muted }}>of pool</span>
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: T.muted }}>{coverage.seen} of {coverage.total} seen</div>
          </Card>
        </div>

        {/* Focus next — the actionable recommendation */}
        <Card className="p-4 mb-5" style={{ background: recColor + '0E', border: `1px solid ${recColor}33` }}>
          <div className="flex items-center gap-2 mb-2">
            <Target size={15} style={{ color: recColor }} />
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: recColor }}>Focus next</div>
          </div>
          <div className="text-sm leading-relaxed mb-3" style={{ color: T.ink }}>
            {recommendation.kind === 'weak' && (
              <>Your weakest area is <span style={{ fontWeight: 600 }}>{recommendation.name}</span> at {recommendation.accuracy}%. A focused round here will raise your overall score fastest.</>
            )}
            {recommendation.kind === 'new' && (
              <>You haven't tried <span style={{ fontWeight: 600 }}>{recommendation.name}</span> yet. Covering new ground rounds out your preparation.</>
            )}
            {recommendation.kind === 'sharp' && (
              <>You're strong across every topic you've practised. Keep the edge with a quick mixed round.</>
            )}
          </div>
          <Button
            onClick={() => {
              if (recommendation.kind === 'sharp') { onQuick && onQuick(); }
              else { onPracticeTopic ? onPracticeTopic(recommendation.topicId) : (onQuick && onQuick()); }
            }}
            size="sm" className="w-full"
            icon={recommendation.kind === 'sharp' ? <Shuffle size={14} /> : <Target size={14} />}>
            {recommendation.kind === 'sharp' ? 'Start a quick round' : `Practise ${recommendation.name}`}
          </Button>
        </Card>

        {/* Last 14 days */}
        <Card className="p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Last 14 days</div>
            <div className="text-xs" style={{ color: T.muted }}>{fortnightTotal} answered</div>
          </div>
          <div className="h-32">
            {!chartReady ? (
              <div className="h-full flex items-end gap-1.5 pb-1">
                {[40,65,30,80,55,45,90,35,70,60,50,75,45,85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm skeleton-pulse"
                       style={{ height: `${h}%`, background: T.borderSoft, animationDelay: `${i * 50}ms` }} />
                ))}
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.muted }} />
                <Tooltip cursor={{ fill: T.borderSoft, opacity: 0.5 }}
                         content={({ active, payload }) => {
                           if (!active || !payload || !payload.length) return null;
                           const v = payload[0].payload;
                           return (
                             <div className="text-xs px-2.5 py-1.5 rounded-lg"
                                  style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }}>
                               <span style={{ color: T.muted }}>{v.label}: </span>
                               <span style={{ fontWeight: 600 }}>{v.attempted}</span>
                             </div>
                           );
                         }} />
                <Bar dataKey="attempted" radius={[4, 4, 0, 0]}>
                  {dailyData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.attempted > 0 ? T.primary : T.borderSoft} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* By topic — tappable rows + sort toggle + mastery legend */}
        {byTopic.length > 0 && (
          <Card className="p-4 mb-5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>By topic</div>
              <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                {[{ id: 'weak', label: 'Weakest' }, { id: 'strong', label: 'Strongest' }].map(s => {
                  const active = topicSort === s.id;
                  return (
                    <button key={s.id} onClick={() => setTopicSort(s.id)}
                            className="no-tap-highlight text-[11px] font-medium px-2.5 py-1 transition-colors"
                            style={{ background: active ? T.primary : 'transparent', color: active ? '#FFF' : T.muted }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mastery legend */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[11px]" style={{ color: T.muted }}>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: T.success }} />{mastery.strong} strong</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: T.primary }} />{mastery.building} building</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: T.error }} />{mastery.weak} to work on</span>
            </div>

            <div className="space-y-1">
              {sortedTopics.map(t => (
                <button key={t.id}
                        onClick={() => onPracticeTopic && onPracticeTopic(t.id)}
                        className="no-tap-highlight w-full text-left rounded-xl px-2 py-2 -mx-2 active:bg-black/5 transition-colors">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="flex-shrink-0">{topicIcon(t.id)}</span>
                      <span className="font-medium truncate" style={{ color: T.ink }}>{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" style={{ color: T.muted }}>
                      <span>{t.accuracy}% <span className="text-xs">({t.correct}/{t.total})</span></span>
                      <ChevronRight size={14} style={{ color: T.muted, opacity: 0.7 }} />
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: T.borderSoft }}>
                    <div className="h-1.5 rounded-full transition-all"
                         style={{ width: `${t.accuracy}%`,
                                  background: t.accuracy >= 75 ? T.success : t.accuracy >= 50 ? T.primary : T.error }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="text-[10px] mt-2.5 px-0.5" style={{ color: T.muted }}>Tap any topic to practise it.</div>
          </Card>
        )}

        {/* Topic trends — P13: per-topic accuracy over time */}
        <Card className="p-4 mb-5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Topic trends</div>
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
              {[3, 6, 12].map(w => {
                const active = trendWindow === w;
                return (
                  <button key={w} onClick={() => setTrendWindow(w)}
                          className="no-tap-highlight text-[11px] font-medium px-2.5 py-1 transition-colors"
                          style={{ background: active ? T.primary : 'transparent', color: active ? '#FFF' : T.muted }}>
                    {w}M
                  </button>
                );
              })}
            </div>
          </div>
          <div className="text-[11px] mb-3" style={{ color: T.muted }}>Monthly accuracy by topic.</div>

          {topicTrends.topics.length === 0 ? (
            <div className="text-sm text-center py-6" style={{ color: T.muted }}>
              Not enough data yet. Practise at least 10 questions in a topic across a couple of months to see its trend.
            </div>
          ) : (() => {
            const visible = showAllTrends ? topicTrends.topics : topicTrends.topics.slice(0, 6);
            const rows = topicTrends.months.map(m => {
              const row = { label: m.label };
              visible.forEach(t => {
                const pt = t.series.find(p => p.key === m.key);
                row[t.id] = pt ? pt.accuracy : null;
              });
              return row;
            });
            return (
              <>
                <div className="h-48">
                  {!chartReady ? (
                    <div className="h-full w-full skeleton-pulse rounded-xl" style={{ background: T.borderSoft }} />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rows} margin={{ top: 5, right: 6, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.borderSoft} vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: T.muted }} />
                        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} axisLine={false} tickLine={false}
                               tick={{ fontSize: 10, fill: T.muted }} width={34} unit="%" />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const pts = payload.filter(p => p.value !== null && p.value !== undefined);
                          if (!pts.length) return null;
                          return (
                            <div className="text-xs px-2.5 py-1.5 rounded-lg"
                                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, maxWidth: 200 }}>
                              <div style={{ color: T.muted, marginBottom: 2 }}>{label}</div>
                              {pts.map(p => {
                                const t = visible.find(x => x.id === p.dataKey);
                                const s = t && t.series.find(x => x.label === label);
                                return (
                                  <div key={p.dataKey} className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                                    <span style={{ fontWeight: 600 }}>{t ? t.name : p.dataKey}</span>
                                    <span style={{ color: T.muted }}>{p.value}%{s ? ` · n=${s.n}` : ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }} />
                        {visible.map(t => (
                          <Line key={t.id} type="monotone" dataKey={t.id} stroke={t.color}
                                strokeWidth={2} dot={{ r: 2.5, fill: t.color }} activeDot={{ r: 4 }}
                                connectNulls isAnimationActive={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px]" style={{ color: T.muted }}>
                  {visible.map(t => (
                    <span key={t.id} className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />{t.name}
                    </span>
                  ))}
                </div>

                {topicTrends.topics.length > 6 && (
                  <button onClick={() => setShowAllTrends(v => !v)}
                          className="no-tap-highlight text-[11px] font-medium mt-2" style={{ color: T.primary }}>
                    {showAllTrends ? 'Show top 6' : `Show all ${topicTrends.topics.length}`}
                  </button>
                )}

                {topicTrends.insights.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {topicTrends.insights.map((ins, i) => {
                      const c = ins.type === 'up' ? T.success : ins.type === 'down' ? T.error : T.primary;
                      const txt = ins.type === 'up' ? `${ins.name} +${ins.delta}%`
                                : ins.type === 'down' ? `${ins.name} ${ins.delta}%`
                                : `${ins.name} ✓`;
                      return (
                        <span key={i} className="text-[11px] rounded-full px-2.5 py-1"
                              style={{ background: c + '15', color: c, fontWeight: 600 }}>
                          {txt}
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </Card>

        {/* Speed */}
        {(() => {
          const speedByTopic = {};
          let allTimes = [];
          Object.entries(data.history || {}).forEach(([qId, h]) => {
            const q = allQuestions.find(x => x.id === qId);
            if (!q || !h.attempts) return;
            h.attempts.forEach(a => {
              if (typeof a.timeMs !== 'number' || a.timeMs <= 0) return;
              const tt = speedByTopic[q.topic] || { times: [], correctTimes: [], name: topicName(q.topic) };
              tt.times.push(a.timeMs);
              if (a.correct) tt.correctTimes.push(a.timeMs);
              speedByTopic[q.topic] = tt;
              allTimes.push(a.timeMs);
            });
          });
          if (allTimes.length === 0) return null;
          const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
          const fmt = (ms) => ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
          const overallAvgMs = avg(allTimes);

          const slowAccurate = Object.entries(speedByTopic).map(([tid, tt]) => {
            const totals = byTopic.find(b => b.name === tt.name);
            const acc = totals ? totals.accuracy : 0;
            const corrAvg = tt.correctTimes.length > 0 ? avg(tt.correctTimes) : avg(tt.times);
            return { tid, name: tt.name, acc, corrAvg, isSlowAccurate: acc >= 70 && corrAvg > overallAvgMs * 1.3 };
          });

          return (
            <Card className="p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Speed</div>
                <div className="text-xs" style={{ color: T.muted }}>avg per question</div>
              </div>
              <div className="font-display text-2xl font-semibold mb-3" style={{ color: T.ink }}>{fmt(overallAvgMs)}</div>

              <div className="space-y-2.5">
                {Object.entries(speedByTopic)
                  .map(([tid, tt]) => ({ tid, name: tt.name, avgMs: avg(tt.times), n: tt.times.length }))
                  .sort((a, b) => b.avgMs - a.avgMs)
                  .map(row => {
                    const sa = slowAccurate.find(x => x.tid === row.tid);
                    return (
                      <div key={row.tid} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span>{topicIcon(row.tid)}</span>
                          <span className="text-sm truncate" style={{ color: T.ink }}>{row.name}</span>
                          {sa && sa.isSlowAccurate && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ml-1 whitespace-nowrap"
                                  style={{ background: T.accent + '20', color: T.accent }}>
                              Accurate but slow
                            </span>
                          )}
                        </div>
                        <div className="text-xs tabular-nums flex-shrink-0" style={{ color: T.muted }}>
                          {fmt(row.avgMs)} <span style={{ opacity: 0.6 }}>· {row.n}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

// =====================================================================
// ADD QUESTION
// =====================================================================
function AddQuestion({ onSave, onSaveBulk, onBack, existingCustomCount }) {
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [type, setType] = useState('mcq');
  const [topic, setTopic] = useState('fund');
  const [sub, setSub] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [source, setSource] = useState('');

  const toggleCorrect = (i) => {
    if (type === 'mcq') setCorrect([i]);
    else setCorrect(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const canSave = questionText.trim() && options.every(o => o.trim()) && correct.length > 0 && explanation.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: `custom-${Date.now()}`,
      topic,
      sub: sub || 'General',
      type,
      q: questionText.trim(),
      options: options.map(o => o.trim()),
      correct,
      exp: explanation.trim(),
      wrong: {},
      custom: true,
      ...(difficulty ? { difficulty } : {}),
      ...(source.trim() ? { source: source.trim() } : {})
    });
  };

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  return (
    <div className="anim-fadeup">
      <TopBar title="Add a question" onBack={onBack} feedback={{ screen: "Add question" }} />
      <div className="max-w-md mx-auto px-4 pb-32 pt-2">
        <div className="text-xs mb-4" style={{ color: T.muted }}>
          Custom questions live alongside the preloaded ones. {existingCustomCount} added so far.
        </div>

        {/* Single vs Bulk toggle */}
        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
          <button onClick={() => setMode('single')}
                  className="no-tap-highlight py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                  style={{ background: mode === 'single' ? T.surface : 'transparent',
                           color: mode === 'single' ? T.ink : T.muted,
                           boxShadow: mode === 'single' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
            <Plus size={14} />
            Single
          </button>
          <button onClick={() => setMode('bulk')}
                  className="no-tap-highlight py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                  style={{ background: mode === 'bulk' ? T.surface : 'transparent',
                           color: mode === 'bulk' ? T.ink : T.muted,
                           boxShadow: mode === 'bulk' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
            <Layers size={14} />
            Bulk import
          </button>
        </div>

        {mode === 'bulk' ? (
          <BulkImport onSaveBulk={onSaveBulk} />
        ) : (
          <>
        {/* Type toggle */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Question type</div>
        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
          {['mcq', 'msq'].map(t => (
            <button key={t} onClick={() => { setType(t); setCorrect([]); }}
                    className={`no-tap-highlight py-2.5 px-3 rounded-lg text-sm font-medium transition-all`}
                    style={{ background: type === t ? T.surface : 'transparent', color: type === t ? T.ink : T.muted,
                             boxShadow: type === t ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              {t === 'mcq' ? 'Single answer' : 'Multi-select'}
            </button>
          ))}
        </div>

        {/* Topic */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Topic</div>
        <select value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle}>
          {TOPICS.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>

        {/* Sub */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Sub-topic (optional)</div>
        <input value={sub} onChange={e => setSub(e.target.value)} placeholder="e.g. Vital signs"
               className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle} />

        {/* Difficulty */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Difficulty (optional)</div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { id: '', label: 'None' },
            { id: 'easy', label: 'Easy' },
            { id: 'medium', label: 'Medium' },
            { id: 'hard', label: 'Hard' }
          ].map(d => (
            <button key={d.id || 'none'} onClick={() => setDifficulty(d.id)}
                    className="no-tap-highlight py-2 rounded-lg text-xs font-medium transition-all"
                    style={{ background: difficulty === d.id ? T.primary : T.surface,
                             color: difficulty === d.id ? '#FFF' : T.ink,
                             border: `1px solid ${difficulty === d.id ? T.primary : T.border}` }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Source */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Source (optional)</div>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. NORCET 2023 PYQ"
               className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle} />

        {/* Question */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Question</div>
        <textarea value={questionText} onChange={e => setQuestionText(e.target.value)}
                  placeholder="Type the question..." rows={3}
                  className="w-full rounded-xl px-4 py-3 mb-4 text-sm resize-none" style={inputStyle} />

        {/* Options */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
          Options {type === 'msq' ? '(tap all correct)' : '(tap the correct one)'}
        </div>
        <div className="space-y-2 mb-4">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button onClick={() => toggleCorrect(i)}
                      className="no-tap-highlight w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-all"
                      style={{ background: correct.includes(i) ? T.success : T.surface,
                               border: `1.5px solid ${correct.includes(i) ? T.success : T.border}`,
                               color: correct.includes(i) ? '#FFF' : T.muted }}>
                {correct.includes(i) ? <Check size={16} /> : String.fromCharCode(65 + i)}
              </button>
              <input value={opt} onChange={e => {
                const copy = [...options]; copy[i] = e.target.value; setOptions(copy);
              }} placeholder={`Option ${String.fromCharCode(65 + i)}`}
                     className="flex-1 rounded-xl px-4 py-2.5 text-sm" style={inputStyle} />
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button onClick={() => setOptions([...options, ''])}
                  className="no-tap-highlight text-xs underline mb-4" style={{ color: T.muted }}>
            + add another option
          </button>
        )}

        {/* Explanation */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Explanation</div>
        <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
                  placeholder="Why is this the correct answer? Include any key intuitions..." rows={4}
                  className="w-full rounded-xl px-4 py-3 mb-4 text-sm resize-none" style={inputStyle} />
          </>
        )}
      </div>

      {mode === 'single' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={handleSave} disabled={!canSave} size="lg" className="w-full" icon={<Save size={18} />}>
              Save question
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// MOCK SETUP
// =====================================================================
function MockSetup({ onStart, onBack, totalQuestions }) {
  const [count, setCount] = useState(Math.min(20, totalQuestions));
  const presets = [10, 25, 50, 100].filter(p => p <= totalQuestions);
  if (presets.length === 0) presets.push(totalQuestions);

  // Duration picker. NORCET pacing is roughly 1 min/question, so we default to
  // that. Presets cover sprint / normal / relaxed pace and re-anchor whenever
  // the question count changes. `customMinutes` lets the user override if
  // they want a non-standard time.
  const defaultDuration = count;                       // 1 min/question
  const [customMinutes, setCustomMinutes] = useState(null);
  const durationMinutes = customMinutes ?? defaultDuration;
  const pacePerQ = count > 0 ? Math.round((durationMinutes * 60) / count) : 0;

  // Build pace presets relative to the question count so they always make sense.
  const durationPresets = useMemo(() => {
    if (count <= 0) return [];
    const tight   = Math.max(1, Math.round(count * 0.5));   // 30s/q
    const normal  = count;                                   // 60s/q (NORCET)
    const relaxed = Math.round(count * 1.5);                 // 90s/q (real NORCET pace)
    return [
      { mins: tight,   label: 'Sprint',  pace: '30s/Q' },
      { mins: normal,  label: 'Normal',  pace: '1 min/Q' },
      { mins: relaxed, label: 'Relaxed', pace: '90s/Q' }
    ];
  }, [count]);

  return (
    <div className="anim-fadeup">
      <TopBar title="Mock test setup" onBack={onBack} feedback={{ screen: "Mock setup" }} />
      <div className="max-w-md mx-auto px-4 pt-4 pb-24">
        <div className="text-sm mb-6" style={{ color: T.muted }}>
          Timed practice across all topics. The timer counts down — if it hits zero, the test ends with whatever you've answered.
        </div>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many questions?</div>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {presets.map(p => (
            <button key={p} onClick={() => { setCount(p); setCustomMinutes(null); }}
                    className="no-tap-highlight py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: count === p ? T.primary : T.surface,
                             color: count === p ? '#FFF' : T.ink,
                             border: `1.5px solid ${count === p ? T.primary : T.border}` }}>
              {p}
            </button>
          ))}
        </div>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Time limit</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {durationPresets.map(p => {
            const active = customMinutes === null
              ? p.mins === defaultDuration
              : p.mins === customMinutes;
            return (
              <button key={p.label} onClick={() => setCustomMinutes(p.mins === defaultDuration ? null : p.mins)}
                      className="no-tap-highlight py-2.5 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: active ? T.primary : T.surface,
                               color: active ? '#FFF' : T.ink,
                               border: `1.5px solid ${active ? T.primary : T.border}` }}>
                <div>{p.label}</div>
                <div className="text-[10px] mt-0.5 font-medium" style={{ opacity: active ? 0.85 : 0.6 }}>
                  {p.mins} min · {p.pace}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom minutes — free-form fallback. */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs" style={{ color: T.muted }}>Custom:</span>
          <input type="number" min={1} max={300}
                 value={customMinutes ?? ''}
                 onChange={e => {
                   const n = parseInt(e.target.value, 10);
                   setCustomMinutes(Number.isFinite(n) && n > 0 ? n : null);
                 }}
                 placeholder={String(defaultDuration)}
                 className="w-20 rounded-lg px-2.5 py-1.5 text-sm"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
          <span className="text-xs" style={{ color: T.muted }}>minutes</span>
        </div>

        <Card className="p-4 mb-6" style={{ background: T.surfaceWarm }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: T.muted }}>Test pace</div>
          <div className="font-display text-2xl font-semibold" style={{ color: T.ink }}>{durationMinutes} min</div>
          <div className="text-xs mt-1" style={{ color: T.muted }}>
            {count} question{count === 1 ? '' : 's'} · ~{pacePerQ}s per question
          </div>
        </Card>

        <Button onClick={() => onStart(count, durationMinutes)} size="lg" className="w-full" icon={<Timer size={18} />}>
          Start mock test
        </Button>
      </div>
    </div>
  );
}

// =====================================================================
// ADVANCED TEST — SETUP
// =====================================================================
function AdvancedTestSetup({ allQuestions, onStart, onBack }) {
  const [count, setCount] = useState(100);
  const [difficulty, setDifficulty] = useState(new Set()); // empty = all
  const [pyqOnly, setPyqOnly] = useState(false);
  const [customTime, setCustomTime] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);

  const filtered = useMemo(() => {
    return allQuestions.filter(q => {
      if (difficulty.size > 0) {
        const d = q.difficulty || 'unmarked';
        if (!difficulty.has(d)) return false;
      }
      if (pyqOnly && !(q.source && /pyq/i.test(q.source))) return false;
      return true;
    });
  }, [allQuestions, difficulty, pyqOnly]);

  const canStart = filtered.length >= count;
  const defaultMinutes = count === 50 ? 45 : 90;
  const timeMinutes = customTime ?? defaultMinutes;

  // Time preset chips. The full 6-chip ladder felt over-busy; cut to two
  // sensible defaults (matching the count) + a Custom toggle that reveals a
  // small input. Power users still have full control; new users see two
  // obvious choices.
  const presetA = 45;
  const presetB = 90;
  const isCustom = customTime !== null && customTime !== defaultMinutes && customTime !== presetA && customTime !== presetB;

  // Row component — used inside both cards for visual consistency. Label on
  // the left, control on the right, optional hint below.
  const Row = ({ label, hint, children, last }) => (
    <div className={`flex items-start justify-between gap-3 ${last ? '' : 'mb-4'}`}>
      <div className="min-w-0 flex-1 pt-1.5">
        <div className="text-sm font-medium" style={{ color: T.ink }}>{label}</div>
        {hint && <div className="text-[11px] mt-0.5 leading-snug" style={{ color: T.muted }}>{hint}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );

  // Small segmented control used in multiple places. Renders a pill of
  // mutually exclusive options.
  const Segmented = ({ value, options, onChange }) => (
    <div className="inline-flex rounded-xl p-0.5" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
      {options.map(opt => {
        const active = value === opt.id;
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)}
                  className="no-tap-highlight px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: active ? T.primary : 'transparent',
                    color: active ? '#FFF' : T.inkSoft
                  }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="anim-fadeup">
      <TopBar title="Advanced Test" onBack={onBack} feedback={{ screen: "Advanced test setup" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-32">

        {/* Slimmed tagline — the heavy teal hero became visual noise once
            the Help popover existed. One line of context is enough. */}
        <div className="text-sm mb-5 leading-relaxed px-1" style={{ color: T.muted }}>
          A full exam simulation — timed, with negative marking, and no feedback until the end.
        </div>

        {/* ===== TEST SETUP ===== */}
        <Card className="p-4 mb-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>
            Test setup
          </div>

          <Row label="Questions">
            <Segmented value={count}
                       onChange={setCount}
                       options={[{ id: 50, label: '50' }, { id: 100, label: '100' }]} />
          </Row>

          <Row label="Difficulty">
            <Segmented value={difficulty.size === 0 ? 'all' : (difficulty.size === 1 ? Array.from(difficulty)[0] : 'all')}
                       onChange={(v) => {
                         if (v === 'all') setDifficulty(new Set());
                         else setDifficulty(new Set([v]));
                       }}
                       options={[
                         { id: 'all',    label: 'All' },
                         { id: 'easy',   label: 'Easy' },
                         { id: 'medium', label: 'Med' },
                         { id: 'hard',   label: 'Hard' }
                       ]} />
          </Row>

          <Row label="Source"
               hint={pyqOnly ? 'Previous-year questions only' : 'All questions in your pool'}
               last>
            <Segmented value={pyqOnly ? 'pyq' : 'all'}
                       onChange={(v) => setPyqOnly(v === 'pyq')}
                       options={[{ id: 'all', label: 'All' }, { id: 'pyq', label: 'PYQ' }]} />
          </Row>
        </Card>

        {/* ===== TIMING + SCORING ===== */}
        <Card className="p-4 mb-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>
            Timing
          </div>

          <Row label="Time limit"
               hint={timeMinutes === 45 ? '~54 sec per question (sprint)'
                     : timeMinutes === 90 ? '~54 sec per question'
                     : `~${Math.round((timeMinutes * 60) / count)} sec per question`}>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { setCustomTime(presetA); setCustomOpen(false); }}
                      className="no-tap-highlight px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: timeMinutes === presetA && !isCustom ? T.primary : T.surface,
                        color: timeMinutes === presetA && !isCustom ? '#FFF' : T.inkSoft,
                        border: `1px solid ${timeMinutes === presetA && !isCustom ? T.primary : T.border}`
                      }}>
                45m
              </button>
              <button onClick={() => { setCustomTime(presetB); setCustomOpen(false); }}
                      className="no-tap-highlight px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: timeMinutes === presetB && !isCustom ? T.primary : T.surface,
                        color: timeMinutes === presetB && !isCustom ? '#FFF' : T.inkSoft,
                        border: `1px solid ${timeMinutes === presetB && !isCustom ? T.primary : T.border}`
                      }}>
                90m
              </button>
              <button onClick={() => setCustomOpen(v => !v)}
                      className="no-tap-highlight px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        background: isCustom || customOpen ? T.primary : T.surface,
                        color: isCustom || customOpen ? '#FFF' : T.inkSoft,
                        border: `1px solid ${isCustom || customOpen ? T.primary : T.border}`
                      }}>
                Custom
              </button>
            </div>
          </Row>

          {customOpen && (
            <div className="-mt-2 mb-4 flex items-center gap-2 pl-1 anim-fadeup">
              <input type="number" min={5} max={300}
                     value={isCustom ? customTime : ''}
                     onChange={e => {
                       const n = parseInt(e.target.value, 10);
                       setCustomTime(Number.isFinite(n) && n > 0 ? n : null);
                     }}
                     placeholder={String(timeMinutes)}
                     className="w-20 rounded-lg px-2.5 py-1.5 text-sm tabular-nums"
                     style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
              <span className="text-xs" style={{ color: T.muted }}>minutes</span>
            </div>
          )}

          <Row label="Scoring"
               hint="Auto-submits when time runs out. No feedback during the test."
               last>
            <div className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums"
                 style={{ color: T.inkSoft }}>
              <span style={{ color: T.success }}>+1</span>
              <span style={{ color: T.muted }}>·</span>
              <span style={{ color: T.error }}>−⅓</span>
              <span style={{ color: T.muted }}>·</span>
              <span style={{ color: T.muted }}>0</span>
            </div>
          </Row>
        </Card>
      </div>

      {/* Bottom bar: summary + Start. The pool-validity check lives here
          rather than as a separate red card — it's a constraint on Start,
          so it belongs next to Start. */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {canStart ? (
            <div className="text-xs text-center mb-2 tabular-nums" style={{ color: T.muted }}>
              {count} questions · {timeMinutes} min · ready to start
            </div>
          ) : (
            <div className="flex items-start gap-2 mb-2 px-2 py-2 rounded-lg"
                 style={{ background: T.errorSoft, border: `1px solid ${T.error}30` }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
              <div className="text-[11px] leading-relaxed" style={{ color: T.inkSoft }}>
                <span style={{ color: T.error, fontWeight: 600 }}>
                  Only {filtered.length} question{filtered.length === 1 ? '' : 's'} match your filters — you need {count}.
                </span>{' '}
                Switch difficulty back to All, turn off PYQ, or pick fewer questions.
              </div>
            </div>
          )}
          <Button onClick={() => onStart({ count, difficulty: Array.from(difficulty), pyqOnly, timeMinutes, pool: filtered })}
                  disabled={!canStart} size="lg" className="w-full" icon={<Hourglass size={18} />}>
            Start advanced test
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// ADVANCED TEST — ENGINE
// =====================================================================
function AdvancedTest({ questions, timeMinutes, onSubmit, onAbort }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [visited, setVisited] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(timeMinutes * 60);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'abort' | 'submit' | null
  const timePerQ = useRef({});
  const lastTick = useRef(Date.now());
  const currentQId = useRef(null);

  const q = questions[index];

  // Track visited on question change
  useEffect(() => {
    if (q) {
      currentQId.current = q.id;
      setVisited(v => v[q.id] ? v : { ...v, [q.id]: true });
      lastTick.current = Date.now();
    }
  }, [q?.id]);

  // Timer — single interval; reads currentQId from ref to attribute time correctly
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTick.current) / 1000;
      lastTick.current = now;
      const cid = currentQId.current;
      if (cid) timePerQ.current[cid] = (timePerQ.current[cid] || 0) + delta;

      setTimeRemaining(t => {
        if (t <= 1) {
          clearInterval(interval);
          // Defer the submit by one tick so state has flushed
          setTimeout(() => {
            onSubmit({
              answers,
              timePerQ: { ...timePerQ.current },
              elapsedSec: timeMinutes * 60,
              auto: true
            });
          }, 50);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeMinutes]);

  if (!q) return <div className="p-6 max-w-md mx-auto text-center">No questions.</div>;

  const toggleOption = (i) => {
    setAnswers(prev => {
      const cur = prev[q.id] || [];
      if (q.type === 'mcq') {
        return { ...prev, [q.id]: cur[0] === i ? [] : [i] };
      }
      return { ...prev, [q.id]: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] };
    });
  };

  const clearAnswer = () => setAnswers(prev => ({ ...prev, [q.id]: [] }));
  const toggleMark = () => setMarked(prev => ({ ...prev, [q.id]: !prev[q.id] }));
  const goNext = () => setIndex(Math.min(questions.length - 1, index + 1));
  const goPrev = () => setIndex(Math.max(0, index - 1));
  const goTo = (i) => { setIndex(i); setPaletteOpen(false); };

  const doManualSubmit = () => {
    onSubmit({
      answers,
      timePerQ: { ...timePerQ.current },
      elapsedSec: timeMinutes * 60 - timeRemaining,
      auto: false
    });
  };

  const answeredCount = Object.values(answers).filter(a => a && a.length > 0).length;
  const markedCount = Object.values(marked).filter(Boolean).length;
  const blankCount = questions.length - answeredCount;

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const timeColor = timeRemaining < 60 ? T.error : timeRemaining < 300 ? T.accent : T.ink;
  const selected = answers[q.id] || [];
  const isMarked = !!marked[q.id];

  return (
    <div className="anim-fadeup">
      <div className="sticky top-0 z-20" style={{ background: T.bg, borderBottom: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={() => setConfirm('abort')} className="no-tap-highlight p-1.5 rounded-lg active:bg-black/5">
            <X size={20} style={{ color: T.muted }} />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold tabular-nums"
               style={{ background: timeRemaining < 60 ? T.errorSoft : T.surfaceWarm, color: timeColor }}>
            <Hourglass size={14} />
            {fmtTime(timeRemaining)}
          </div>
          <button onClick={() => setPaletteOpen(true)}
                  className="no-tap-highlight flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: T.primary, color: '#FFF' }}>
            <LayoutGrid size={14} />
            {index + 1}/{questions.length}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 pb-40">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Pill bg={topicColor(q.topic) + '15'} color={topicColor(q.topic)}>
            {topicIcon(q.topic)} {topicName(q.topic)}
          </Pill>
          {q.sub && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.sub}</Pill>}
          <Pill bg={q.type === 'msq' ? T.errorSoft : T.successSoft} color={q.type === 'msq' ? T.error : T.success}>
            {q.type === 'msq' ? 'Multi-select' : 'Single answer'}
          </Pill>
          {isMarked && <Pill bg={T.accent + '20'} color={T.accent}><Flag size={10} />Marked</Pill>}
        </div>

        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: T.muted }}>Question {index + 1}</div>
        <div className="font-display text-xl leading-snug mb-6" style={{ color: T.ink }}>{q.q}</div>

        <div className="space-y-2.5 mb-6">
          {q.options.map((opt, i) => {
            const isSel = selected.includes(i);
            return (
              <div key={i} onClick={() => toggleOption(i)}
                   className="no-tap-highlight rounded-2xl px-4 py-3.5 flex items-start gap-3 cursor-pointer active:scale-[0.99] transition-colors"
                   style={{ background: isSel ? T.primary + '08' : T.surface,
                            border: `1.5px solid ${isSel ? T.primary : T.border}` }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold"
                     style={{ background: isSel ? T.primary : T.surface,
                              border: `1.5px solid ${isSel ? T.primary : T.border}`,
                              color: isSel ? '#FFF' : T.muted }}>
                  {String.fromCharCode(65 + i)}
                </div>
                <div className="text-sm leading-snug pt-0.5" style={{ color: T.ink }}>{opt}</div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={toggleMark}
                  className="no-tap-highlight flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                  style={{ background: isMarked ? T.accent + '15' : T.surface,
                           border: `1px solid ${isMarked ? T.accent : T.border}`,
                           color: isMarked ? T.accent : T.inkSoft }}>
            <Flag size={12} />
            {isMarked ? 'Unmark' : 'Mark for review'}
          </button>
          <button onClick={clearAnswer} disabled={selected.length === 0}
                  className="no-tap-highlight flex-1 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-40"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
            <RotateCcw size={12} />
            Clear answer
          </button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-2">
          <Button variant="ghost" onClick={goPrev} disabled={index === 0} className="flex-1" icon={<ChevronLeft size={16} />}>
            Previous
          </Button>
          {index < questions.length - 1 ? (
            <Button onClick={goNext} className="flex-1" icon={<ChevronRight size={16} />}>
              Next
            </Button>
          ) : (
            <Button variant="accent" onClick={() => setConfirm('submit')} className="flex-1" icon={<Send size={16} />}>
              Submit test
            </Button>
          )}
        </div>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-md mx-auto rounded-t-2xl anim-fadeup"
               style={{ background: T.bg, maxHeight: '85vh', overflowY: 'auto' }}
               onClick={e => e.stopPropagation()}>
            <div className="p-4 sticky top-0" style={{ background: T.bg, borderBottom: `1px solid ${T.borderSoft}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Question palette</div>
                <button onClick={() => setPaletteOpen(false)} className="no-tap-highlight p-2 -mr-2 rounded-lg active:bg-black/5">
                  <X size={18} style={{ color: T.muted }} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs" style={{ color: T.inkSoft }}>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: T.success }} />Answered <span style={{ color: T.muted }}>({answeredCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: T.border }} />Blank <span style={{ color: T.muted }}>({blankCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: T.surface, boxShadow: `0 0 0 2px ${T.accent}` }} />Marked <span style={{ color: T.muted }}>({markedCount})</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded" style={{ background: T.primary }} />Current</div>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-6 gap-2 mb-4">
                {questions.map((qq, i) => {
                  const ans = answers[qq.id] && answers[qq.id].length > 0;
                  const mk = !!marked[qq.id];
                  const isCurrent = i === index;
                  let bg = T.border, textColor = T.muted;
                  if (ans) { bg = T.success; textColor = '#FFF'; }
                  if (isCurrent) { bg = T.primary; textColor = '#FFF'; }
                  return (
                    <button key={qq.id} onClick={() => goTo(i)}
                            className="no-tap-highlight w-full aspect-square rounded-lg text-sm font-semibold active:scale-95 transition-all"
                            style={{ background: bg, color: textColor,
                                     boxShadow: mk ? `0 0 0 2px ${T.accent}` : 'none' }}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <Button variant="accent" onClick={() => { setPaletteOpen(false); setConfirm('submit'); }} size="lg" className="w-full" icon={<Send size={16} />}>
                Submit test now
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirm(null)}>
          <Card className="p-5 max-w-sm w-full anim-scalein" onClick={e => e.stopPropagation()}>
            <div className="font-display text-xl font-semibold mb-2" style={{ color: T.ink }}>
              {confirm === 'abort' ? 'Quit the test?' : 'Submit your test?'}
            </div>
            <div className="text-sm mb-4 leading-relaxed" style={{ color: T.muted }}>
              {confirm === 'abort'
                ? 'Your progress in this test will be lost. The main app data is unaffected.'
                : `You answered ${answeredCount} of ${questions.length}${blankCount > 0 ? `, leaving ${blankCount} blank` : ''}. ${markedCount > 0 ? `${markedCount} marked for review.` : ''}`}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)} className="flex-1">Cancel</Button>
              <Button variant={confirm === 'abort' ? 'accent' : 'primary'}
                      onClick={() => { if (confirm === 'abort') onAbort(); else doManualSubmit(); }}
                      className="flex-1">
                {confirm === 'abort' ? 'Quit' : 'Submit'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ADVANCED TEST — RESULTS
// =====================================================================
function AdvancedTestResults({ questions, answers, timePerQ, elapsedSec, auto, onHome, onReview }) {
  const summary = useMemo(() => {
    let correct = 0, wrong = 0, blank = 0;
    const detail = [];
    questions.forEach(q => {
      const ans = answers[q.id] || [];
      if (ans.length === 0) {
        blank++; detail.push({ q, status: 'blank' });
      } else if (arraysEqualUnordered(ans, q.correct)) {
        correct++; detail.push({ q, status: 'correct', selected: ans });
      } else {
        wrong++; detail.push({ q, status: 'wrong', selected: ans });
      }
    });
    const netScore = correct - (wrong / 3);
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const avgTime = questions.length > 0 ? elapsedSec / questions.length : 0;

    const byTopic = {};
    detail.forEach(d => {
      const tid = d.q.topic;
      if (!byTopic[tid]) byTopic[tid] = { correct: 0, wrong: 0, blank: 0, total: 0 };
      byTopic[tid].total++;
      byTopic[tid][d.status]++;
    });
    const topicArr = Object.entries(byTopic).map(([tid, s]) => ({
      tid, ...s,
      accuracy: (s.correct + s.wrong) > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0
    })).sort((a, b) => b.accuracy - a.accuracy);

    return { correct, wrong, blank, netScore, accuracy, avgTime, detail, topicArr };
  }, [questions, answers, elapsedSec]);

  const wrongAndBlank = summary.detail.filter(d => d.status !== 'correct');
  const maxScore = questions.length;
  const pctOfMax = (summary.netScore / maxScore) * 100;

  const verdict =
    pctOfMax >= 80 ? { word: 'Exam-ready', color: T.success } :
    pctOfMax >= 60 ? { word: 'On track', color: T.primary } :
    pctOfMax >= 40 ? { word: 'Keep pushing', color: T.accent } :
                     { word: 'More prep needed', color: T.error };

  const fmtTime = (s) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  const qTime = (qid) => timePerQ && timePerQ[qid] ? `${Math.round(timePerQ[qid])}s` : '—';

  return (
    <div className="anim-fadeup">
      <TopBar title="Test results" onBack={onHome} feedback={{ screen: "Advanced test results" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <MotivationCard pct={Math.max(0, pctOfMax)} label="test" />
        {auto && (
          <Card className="p-3 mb-4" style={{ background: T.accent + '15', border: `1px solid ${T.accent}40` }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: T.accent }}>
              <AlertTriangle size={16} />
              <span className="font-medium">Time expired — auto-submitted</span>
            </div>
          </Card>
        )}

        <div className="text-center mb-6 mt-4">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>Net score (after negative marking)</div>
          <div className="font-display text-6xl font-semibold leading-none" style={{ color: verdict.color }}>
            {summary.netScore.toFixed(2)}
          </div>
          <div className="text-sm mt-2" style={{ color: T.muted }}>out of {maxScore} · {verdict.word}</div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Card className="p-3 text-center">
            <Check size={16} className="mx-auto mb-1" style={{ color: T.success }} />
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>{summary.correct}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Correct +1</div>
          </Card>
          <Card className="p-3 text-center">
            <X size={16} className="mx-auto mb-1" style={{ color: T.error }} />
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>{summary.wrong}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Wrong −⅓</div>
          </Card>
          <Card className="p-3 text-center">
            <EyeOff size={16} className="mx-auto mb-1" style={{ color: T.muted }} />
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>{summary.blank}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>Blank 0</div>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: T.muted }}>Accuracy</div>
            <div className="font-display text-2xl font-semibold" style={{ color: T.ink }}>{summary.accuracy}%</div>
            <div className="text-[10px]" style={{ color: T.muted }}>of attempted</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: T.muted }}>Total time</div>
            <div className="font-display text-2xl font-semibold" style={{ color: T.ink }}>{fmtTime(elapsedSec)}</div>
            <div className="text-[10px]" style={{ color: T.muted }}>~{Math.round(summary.avgTime)}s per Q</div>
          </Card>
        </div>

        {summary.topicArr.length > 0 && (
          <Card className="p-4 mb-5">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: T.muted }}>Topic-wise breakdown</div>
            <div className="space-y-3">
              {summary.topicArr.map(t => (
                <div key={t.tid}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="font-medium truncate flex-1 pr-2" style={{ color: T.ink }}>
                      {topicIcon(t.tid)} {topicName(t.tid)}
                    </div>
                    <div className="text-xs tabular-nums flex-shrink-0" style={{ color: T.muted }}>
                      <span style={{ color: T.success }}>{t.correct}</span>
                      <span> / </span>
                      <span style={{ color: T.error }}>{t.wrong}</span>
                      <span> / </span>
                      <span style={{ color: T.muted }}>{t.blank}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: T.borderSoft }}>
                    <div style={{ width: `${(t.correct / t.total) * 100}%`, background: T.success, transition: 'width 0.6s ease-out' }} />
                    <div style={{ width: `${(t.wrong / t.total) * 100}%`, background: T.error, transition: 'width 0.6s ease-out' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {wrongAndBlank.length > 0 && (
          <div className="mb-5">
            <div className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: T.muted }}>
              Wrong & skipped questions ({wrongAndBlank.length})
            </div>
            <div className="space-y-3">
              {wrongAndBlank.map(({ q, status, selected }) => {
                const qNum = questions.findIndex(qq => qq.id === q.id) + 1;
                return (
                  <Card key={q.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Pill bg={status === 'blank' ? T.surfaceWarm : T.errorSoft}
                            color={status === 'blank' ? T.muted : T.error}>
                        {status === 'blank' ? <><EyeOff size={10} />Skipped</> : <><X size={10} />Wrong</>}
                      </Pill>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: T.muted }}>
                        Q{qNum} · {topicName(q.topic)}{q.sub ? ` · ${q.sub}` : ''} · {qTime(q.id)}
                      </span>
                    </div>
                    <div className="text-sm font-medium mb-3 leading-snug" style={{ color: T.ink }}>{q.q}</div>

                    <div className="space-y-1.5 mb-3">
                      {q.options.map((opt, i) => {
                        const isCorrect = q.correct.includes(i);
                        const wasSelected = selected && selected.includes(i);
                        let labelBg = T.surfaceWarm, labelColor = T.inkSoft, iconEl = null;
                        if (isCorrect) { labelBg = T.successSoft; labelColor = T.success; iconEl = <Check size={12} />; }
                        else if (wasSelected) { labelBg = T.errorSoft; labelColor = T.error; iconEl = <X size={12} />; }
                        return (
                          <div key={i} className="flex items-start gap-2 text-xs" style={{ color: T.inkSoft }}>
                            <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 font-semibold"
                                 style={{ background: labelBg, color: labelColor }}>
                              {iconEl || String.fromCharCode(65 + i)}
                            </div>
                            <div className="leading-snug pt-0.5">{opt}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-xs leading-relaxed pt-3 mt-1 border-t" style={{ borderColor: T.borderSoft, color: T.inkSoft }}>
                      <div className="font-semibold text-[10px] uppercase tracking-wider mb-1.5" style={{ color: T.muted }}>Explanation</div>
                      <div className="whitespace-pre-wrap">{q.exp}</div>
                      {q.wrong && Object.keys(q.wrong).length > 0 && (
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                          <div className="font-semibold text-[10px] uppercase tracking-wider mb-1.5" style={{ color: T.muted }}>Why the others are wrong</div>
                          <div className="space-y-1">
                            {Object.entries(q.wrong).map(([idx, txt]) => (
                              <div key={idx}><span className="font-semibold">{String.fromCharCode(65 + parseInt(idx))}.</span> {txt}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2 mt-6">
          {wrongAndBlank.length > 0 && (
            <Button variant="ghost" onClick={() => onReview(wrongAndBlank.map(d => d.q.id))} size="lg" className="w-full">
              Practice the missed ones
            </Button>
          )}
          <Button onClick={onHome} size="lg" className="w-full">
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// BULK IMPORT (used inside AddQuestion)
// =====================================================================
function BulkImport({ onSaveBulk }) {
  const [format, setFormat] = useState('json');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);

  const parse = () => {
    const result = processQuestionInput(text, format, 'custom');
    if (result.parseError) {
      setPreview({ valid: [], invalid: [], message: result.parseError });
    } else {
      setPreview({ valid: result.valid, invalid: result.invalid });
    }
  };

  const handleConfirm = () => {
    if (preview && preview.valid.length > 0) onSaveBulk(preview.valid);
  };

  return (
    <>
      <div className="text-xs mb-4 leading-relaxed" style={{ color: T.muted }}>
        Paste many questions at once. JSON is most reliable. CSV is good for spreadsheet exports.
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
        {['json', 'csv'].map(f => (
          <button key={f} onClick={() => { setFormat(f); setPreview(null); }}
                  className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{ background: format === f ? T.surface : 'transparent',
                           color: format === f ? T.ink : T.muted,
                           boxShadow: format === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <button onClick={() => { setText(format === 'json' ? EXAMPLE_QUESTIONS_JSON : EXAMPLE_QUESTIONS_CSV); setPreview(null); }}
              className="no-tap-highlight text-xs underline mb-3" style={{ color: T.primary }}>
        insert example {format.toUpperCase()}
      </button>

      <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null); }}
                placeholder={format === 'json' ? 'Paste a JSON array of questions...' : 'Paste CSV with headers (q,type,topic,sub,options,correct,exp,wrong,difficulty,source)...'}
                rows={10}
                className="w-full rounded-xl px-3 py-3 mb-4 text-xs resize-y font-mono"
                style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, minHeight: '220px' }} />

      <Button onClick={parse} disabled={!text.trim()} className="w-full mb-4" icon={<Layers size={16} />}>
        Validate
      </Button>

      {preview && (
        <div className="anim-fadeup mb-4">
          {preview.message ? (
            <Card className="p-4" style={{ background: T.errorSoft, border: `1px solid ${T.error}` }}>
              <div className="text-sm font-medium" style={{ color: T.error }}>{preview.message}</div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Card className="p-3" style={{ background: preview.valid.length > 0 ? T.successSoft : T.surface }}>
                  <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Valid</div>
                  <div className="font-display text-2xl font-semibold" style={{ color: T.success }}>{preview.valid.length}</div>
                </Card>
                <Card className="p-3" style={{ background: preview.invalid.length > 0 ? T.errorSoft : T.surface }}>
                  <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Invalid</div>
                  <div className="font-display text-2xl font-semibold" style={{ color: T.error }}>{preview.invalid.length}</div>
                </Card>
              </div>

              {preview.invalid.length > 0 && (
                <Card className="p-3 mb-3">
                  <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Errors</div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {preview.invalid.slice(0, 20).map(({ index, errors, preview: p }) => (
                      <div key={index} className="text-xs">
                        <div className="font-medium" style={{ color: T.error }}>#{index}: {errors.join(', ')}</div>
                        <div className="truncate" style={{ color: T.muted }}>{p}</div>
                      </div>
                    ))}
                    {preview.invalid.length > 20 && <div className="text-xs" style={{ color: T.muted }}>… and {preview.invalid.length - 20} more</div>}
                  </div>
                </Card>
              )}

              {preview.valid.length > 0 && (
                <Button onClick={handleConfirm} className="w-full" icon={<Plus size={16} />}>
                  Add {preview.valid.length} question{preview.valid.length === 1 ? '' : 's'}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

// =====================================================================
// QUESTION BANK — LIBRARY (list)
// =====================================================================
function VisibilityPill({ bank }) {
  const priv = bankVisibility(bank) === 'private';
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{ background: priv ? T.accent + '18' : T.success + '18', color: priv ? T.accent : T.success }}>
      {priv ? <EyeOff size={10} /> : <Eye size={10} />}
      {priv ? 'Private' : 'Public'}
    </span>
  );
}

function Library({ banks, isAdmin, profileId, loading, onRefresh, onOpen, onCreateNew, onBack, disabledBanks }) {
  // Filter chips: All / Mine / From others. "Mine" = banks I uploaded.
  // "From others" = banks anyone else uploaded (including admin's seeds).
  // Default to All so the user immediately sees discoverable content.
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    let mine = 0, others = 0;
    banks.forEach(b => {
      if (isBankOwner(b, profileId)) mine++;
      else others++;
    });
    return { all: banks.length, mine, others };
  }, [banks, profileId]);

  const visibleBanks = useMemo(() => {
    if (filter === 'mine')   return banks.filter(b => isBankOwner(b, profileId));
    if (filter === 'others') return banks.filter(b => !isBankOwner(b, profileId));
    return banks;
  }, [banks, profileId, filter]);

  return (
    <div className="anim-fadeup">
      <TopBar title="Question Bank Library" onBack={onBack}
              feedback={{ screen: "Library" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">

        {/* Anyone can upload a bank */}
        <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={onCreateNew}
              style={{ background: T.ink, border: 'none' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Plus size={18} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-semibold mb-0.5" style={{ color: '#FFF' }}>Upload a new bank</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Choose private (just you) or public (everyone)
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
        </Card>

        <div className="text-xs mb-4 leading-relaxed px-1" style={{ color: T.muted }}>
          Browse banks and import them into your own practice.{' '}
          {isAdmin
            ? 'As admin you can see every bank and edit, delete, or change the visibility of any of them.'
            : 'Public banks are shared by everyone; private banks are visible only to whoever uploaded them. Only an admin can edit or delete a bank.'}
        </div>

        {/* Filter chips — quickly switch between everything, just mine, just others.
            Only show when there's something to filter (>1 bank or mixed ownership). */}
        {banks.length > 1 && (
          <div className="flex gap-2 mb-3">
            {[
              { id: 'all',    label: 'All',         count: counts.all },
              { id: 'mine',   label: 'Mine',        count: counts.mine },
              { id: 'others', label: 'From others', count: counts.others }
            ].map(opt => {
              const active = filter === opt.id;
              return (
                <button key={opt.id} onClick={() => setFilter(opt.id)}
                        className="no-tap-highlight px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0"
                        style={{
                          background: active ? T.primary : T.surface,
                          color: active ? '#FFF' : T.inkSoft,
                          border: `1px solid ${active ? T.primary : T.border}`
                        }}>
                  {opt.label} <span style={{ opacity: 0.7 }}>· {opt.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Header row — count label + refresh */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
            {banks.length > 0
              ? `${visibleBanks.length} ${filter === 'mine' ? 'mine' : filter === 'others' ? 'from others' : (visibleBanks.length === 1 ? 'bank' : 'banks')}`
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
            <div className="text-sm" style={{ color: T.muted }}>Upload the first one above.</div>
          </div>
        ) : visibleBanks.length === 0 ? (
          /* Banks exist but the current filter rules them all out. */
          <div className="text-center py-10">
            <Layers size={32} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="text-sm mb-3" style={{ color: T.muted }}>
              {filter === 'mine' ? "You haven't uploaded any banks yet." : 'No banks from other users yet.'}
            </div>
            <button onClick={() => setFilter('all')}
                    className="no-tap-highlight text-xs font-medium underline"
                    style={{ color: T.primary }}>
              Show all banks
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleBanks.map(b => {
              const date = b.updatedAt ? new Date(b.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
              const mine = isBankOwner(b, profileId);
              const owner = mine ? 'You' : (b.ownerName || 'Admin');
              return (
                <Card key={b.id} className="p-4" onClick={() => onOpen(b.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="font-display text-base font-semibold truncate" style={{ color: T.ink }}>{b.name}</div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                              style={{ background: T.primary + '15', color: T.primary }}>v{b.version}</span>
                        <VisibilityPill bank={b} />
                        {disabledBanks && disabledBanks[b.id] && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1"
                                style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>
                            <EyeOff size={9} /> Paused
                          </span>
                        )}
                      </div>
                      <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
                        {b.questions.length} question{b.questions.length === 1 ? '' : 's'}
                        {` · by ${owner}`}
                        {date && ` · ${date}`}
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
      </div>
    </div>
  );
}

// =====================================================================
// QUESTION BANK — DETAIL (view + import)
// =====================================================================
function BankDetail({ bank, isAdmin, isOwner, canToggleVisibility, alreadyImported, isDisabled, onImport, onUpdate, onEdit, onDelete, onToggleVisibility, onToggleEnabled, onBack }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [visBusy, setVisBusy] = useState(false);
  const date = bank.updatedAt ? new Date(bank.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const previewQ = bank.questions[previewIndex];
  const priv = bankVisibility(bank) === 'private';
  const ownerLabel = isOwner ? 'You' : (bank.ownerName || 'Admin');

  const toggleVis = async () => {
    if (visBusy) return;
    setVisBusy(true);
    await onToggleVisibility(priv ? 'public' : 'private');
    setVisBusy(false);
  };

  return (
    <div className="anim-fadeup">
      <TopBar title={bank.name} onBack={onBack} feedback={{ screen: "Bank detail" }} />
      <div className="max-w-md mx-auto px-4 pb-32 pt-2">

        <Card className="p-4 mb-4" style={{ background: T.primary, border: 'none' }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="font-display text-xl font-semibold leading-tight" style={{ color: '#FFF' }}>{bank.name}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#FFF' }}>v{bank.version}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(255,255,255,0.18)', color: '#FFF' }}>
              {priv ? <EyeOff size={10} /> : <Eye size={10} />}
              {priv ? 'Private' : 'Public'}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>by {ownerLabel}</span>
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {bank.questions.length} question{bank.questions.length === 1 ? '' : 's'}
            {date && ` · updated ${date}`}
          </div>
          {bank.description && (
            <div className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{bank.description}</div>
          )}
        </Card>

        {/* Import status */}
        {alreadyImported.count > 0 && (
          <Card className="p-3 mb-3" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-start gap-2.5">
              <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                You've imported {alreadyImported.count} question{alreadyImported.count === 1 ? '' : 's'} from this bank
                {alreadyImported.version && ` (v${alreadyImported.version})`}.
                {alreadyImported.version && alreadyImported.version < bank.version &&
                  <span style={{ color: T.accent, fontWeight: 600 }}> A newer version is available — tap "Update" to refresh.</span>}
              </div>
            </div>
          </Card>
        )}

        {/* Active / paused toggle. Only meaningful once she's imported the bank. */}
        {alreadyImported.count > 0 && onToggleEnabled && (
          <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
                onClick={() => onToggleEnabled(isDisabled)}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: isDisabled ? T.surfaceWarm : T.success + '20' }}>
                  {isDisabled
                    ? <EyeOff size={16} style={{ color: T.muted }} />
                    : <Check size={16} style={{ color: T.success }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm" style={{ color: T.ink }}>
                    Use these questions in my practice
                  </div>
                  <div className="text-[11px] mt-0.5 leading-snug" style={{ color: T.muted }}>
                    {isDisabled
                      ? 'Paused — these questions are hidden from quizzes, drills, and stats. Your progress is kept.'
                      : 'Active — questions appear across Quick test, topics, and stats.'}
                  </div>
                </div>
              </div>
              {/* Switch — same visual pattern as the dark-mode toggle. */}
              <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                   style={{ background: isDisabled ? T.border : T.success }}>
                <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                     style={{ transform: isDisabled ? 'translateX(0px)' : 'translateX(20px)' }} />
              </div>
            </div>
          </Card>
        )}

        {/* Preview */}
        {previewQ && (
          <Card className="p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Preview</div>
              <div className="text-xs tabular-nums" style={{ color: T.muted }}>{previewIndex + 1} / {bank.questions.length}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Pill bg={topicColor(previewQ.topic) + '15'} color={topicColor(previewQ.topic)}>
                {topicIcon(previewQ.topic)} {topicName(previewQ.topic)}
              </Pill>
              {previewQ.sub && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{previewQ.sub}</Pill>}
            </div>
            <div className="text-sm leading-snug" style={{ color: T.ink }}>{previewQ.q}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))} disabled={previewIndex === 0}
                      className="no-tap-highlight flex-1 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                ← Prev
              </button>
              <button onClick={() => setPreviewIndex(Math.min(bank.questions.length - 1, previewIndex + 1))}
                      disabled={previewIndex === bank.questions.length - 1}
                      className="no-tap-highlight flex-1 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                Next →
              </button>
            </div>
          </Card>
        )}

        {/* Visibility control — owner (their own bank) or admin (any bank) */}
        {canToggleVisibility && (
          <Card className="p-4 mt-6 mb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm" style={{ color: T.ink }}>Visibility</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                  {priv
                    ? 'Private — only you' + (isAdmin && !isOwner ? ' (the owner)' : '') + ' can see and use it.'
                    : 'Public — everyone can browse, import, and practise it.'}
                </div>
              </div>
              <button onClick={toggleVis} disabled={visBusy}
                      className="no-tap-highlight flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 disabled:opacity-50"
                      style={{ background: priv ? T.success : T.surfaceWarm, color: priv ? '#FFF' : T.ink, border: `1px solid ${priv ? T.success : T.border}` }}>
                {visBusy ? <RefreshCw size={14} className="animate-spin" /> : (priv ? <Eye size={14} /> : <EyeOff size={14} />)}
                {priv ? 'Make public' : 'Make private'}
              </button>
            </div>
            {isAdmin && !isOwner && (
              <div className="text-[11px] mt-2.5 pt-2.5 border-t" style={{ color: T.muted, borderColor: T.borderSoft }}>
                You're changing another user's bank as admin.
              </div>
            )}
          </Card>
        )}

        {/* Edit / delete — ADMIN ONLY (any bank) */}
        {isAdmin && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Admin · edit & delete</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Card className="p-3 cursor-pointer no-tap-highlight pressable" onClick={onEdit}>
                <Edit3 size={16} style={{ color: T.primary }} />
                <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Edit bank</div>
                <div className="text-[10px]" style={{ color: T.muted }}>Update name or questions (bumps version)</div>
              </Card>
              <Card className="p-3 cursor-pointer no-tap-highlight pressable" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} style={{ color: T.error }} />
                <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Delete bank</div>
                <div className="text-[10px]" style={{ color: T.muted }}>Remove for everyone</div>
              </Card>
            </div>
          </div>
        )}

        {/* Owner (non-admin) note */}
        {isOwner && !isAdmin && (
          <div className="text-[11px] mt-3 leading-relaxed px-1" style={{ color: T.muted }}>
            This is your bank — you can change its visibility above. Only an admin can edit its questions or delete it.
          </div>
        )}
      </div>

      {/* Bottom import bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-2">
          {alreadyImported.count > 0 && alreadyImported.version && alreadyImported.version < bank.version ? (
            <Button onClick={onUpdate} size="lg" className="flex-1" icon={<RefreshCw size={18} />}>
              Update to v{bank.version}
            </Button>
          ) : alreadyImported.count > 0 ? (
            <Button onClick={onImport} variant="ghost" size="lg" className="flex-1" icon={<Plus size={18} />}>
              Import again
            </Button>
          ) : (
            <Button onClick={onImport} size="lg" className="flex-1" icon={<Download size={18} />}>
              Import {bank.questions.length} question{bank.questions.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirmDelete(false)}>
          <Card className="p-5 max-w-sm w-full anim-scalein" onClick={e => e.stopPropagation()}>
            <div className="font-display text-xl font-semibold mb-2" style={{ color: T.ink }}>Delete "{bank.name}"?</div>
            <div className="text-sm mb-4 leading-relaxed" style={{ color: T.muted }}>
              This removes the bank for everyone, immediately. Users who have already imported its questions keep their copies.
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} className="flex-1">Cancel</Button>
              <Button variant="accent" onClick={() => { setConfirmDelete(false); onDelete(); }} className="flex-1">Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// QUESTION BANK — EDITOR (admin only — create or edit)
// =====================================================================
function BankEditor({ existingBank, profile, onSave, onBack }) {
  const isEdit = !!existingBank;
  const [name, setName] = useState(existingBank ? existingBank.name : '');
  const [description, setDescription] = useState(existingBank ? (existingBank.description || '') : '');
  const [questions, setQuestions] = useState(existingBank ? existingBank.questions : []);
  const [visibility, setVisibility] = useState(existingBank ? bankVisibility(existingBank) : 'public');

  const [format, setFormat] = useState('json');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Duplicate handling
  const [dupReview, setDupReview] = useState(null);   // { unique: [...], duplicates: [{ newQ, match, similarity, keep }] }
  const [lastAdded, setLastAdded] = useState(null);   // { added, flagged, skipped, kept, flaggedDetails: [...] }

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  const parse = () => {
    setError(null);
    setLastAdded(null);
    const result = processQuestionInput(text, format, 'bank');
    if (result.parseError) {
      setPreview({ valid: [], invalid: [], message: result.parseError });
    } else {
      setPreview({ valid: result.valid, invalid: result.invalid });
    }
  };

  // Replace: blow away current and use only the parsed valid set (no duplicates by definition).
  const doReplace = () => {
    if (!preview || preview.valid.length === 0) return;
    setQuestions(preview.valid);
    setLastAdded({ added: preview.valid.length, flagged: 0, skipped: 0, kept: 0, flaggedDetails: [], replaced: true });
    setText('');
    setPreview(null);
  };

  // Append: check each new question against the bank's current questions (and already-accepted from
  // this paste). Unique ones added straight away. Anything that looks like a near-duplicate is
  // surfaced for a per-question Keep / Skip choice — the whole upload is never rejected.
  const doAppend = () => {
    if (!preview || preview.valid.length === 0) return;
    const unique = [];
    const duplicates = [];
    const pool = [...questions];   // existing bank questions
    for (const newQ of preview.valid) {
      const dup = findDuplicateStem(newQ, pool);
      if (dup) {
        duplicates.push({ newQ, match: dup.match, similarity: dup.similarity, keep: false });
      } else {
        unique.push(newQ);
        pool.push(newQ);  // detect within-paste duplicates too
      }
    }
    if (duplicates.length === 0) {
      setQuestions([...questions, ...unique]);
      setLastAdded({ added: unique.length, flagged: 0, skipped: 0, kept: 0, flaggedDetails: [] });
      setText('');
      setPreview(null);
    } else {
      setDupReview({ unique, duplicates });
    }
  };

  const toggleDupKeep = (idx) => {
    setDupReview(prev => prev ? {
      ...prev,
      duplicates: prev.duplicates.map((d, i) => i === idx ? { ...d, keep: !d.keep } : d)
    } : prev);
  };

  const cancelDupReview = () => setDupReview(null);

  const confirmDupReview = () => {
    if (!dupReview) return;
    const kept = dupReview.duplicates.filter(d => d.keep).map(d => d.newQ);
    const skippedDetails = dupReview.duplicates.filter(d => !d.keep);
    const finalAdd = [...dupReview.unique, ...kept];
    setQuestions([...questions, ...finalAdd]);
    setLastAdded({
      added: finalAdd.length,
      flagged: dupReview.duplicates.length,
      skipped: skippedDetails.length,
      kept: kept.length,
      flaggedDetails: dupReview.duplicates
    });
    setDupReview(null);
    setText('');
    setPreview(null);
  };

  const removeQuestion = (i) => setQuestions(questions.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) { setError('The set needs a name'); return; }
    if (questions.length === 0) { setError('Add at least one question first'); return; }
    // Re-validate every question to make sure nothing got into the array malformed
    for (const q of questions) {
      const errs = validateQuestionFields(q);
      if (errs.length > 0) {
        setError(`Invalid question "${(q.q || '').slice(0, 40)}…": ${errs.join(', ')}`);
        return;
      }
    }
    setSaving(true);
    try {
      const now = Date.now();
      const bank = isEdit ? {
        ...existingBank,
        name: name.trim(),
        description: description.trim(),
        questions,
        version: (existingBank.version || 1) + 1,
        updatedAt: now
      } : {
        id: newBankId(),
        name: name.trim(),
        description: description.trim(),
        questions,
        version: 1,
        visibility: visibility === 'private' ? 'private' : 'public',
        // Brand-new public banks should be discoverable via the home "What's new"
        // banner. Private banks intentionally have no publishedAt.
        ...(visibility !== 'private' ? { publishedAt: now } : {}),
        ownerId: profile ? profile.id : null,
        ownerName: profile ? profile.displayName : null,
        createdAt: now,
        updatedAt: now
      };
      await onSave(bank);
    } catch (e) {
      setError('Could not save: ' + e.message);
      setSaving(false);
    }
  };

  return (
    <div className="anim-fadeup">
      <TopBar title={isEdit ? 'Edit question set' : 'New question set'} onBack={onBack} feedback={{ screen: "Bank editor" }} />
      <div className="max-w-md mx-auto px-4 pb-32 pt-2">

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Set name</div>
        <input value={name} onChange={e => setName(e.target.value)}
               placeholder="e.g. NORCET 2024 PYQ Set 1"
               className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle} />

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Description (optional)</div>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's in this set?" rows={2}
                  className="w-full rounded-xl px-4 py-3 mb-4 text-sm resize-none" style={inputStyle} />

        {/* Visibility — chosen at upload (new banks only) */}
        {!isEdit && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Visibility</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[
                { val: 'public', icon: <Eye size={16} />, title: 'Public', desc: 'Everyone can browse & import' },
                { val: 'private', icon: <EyeOff size={16} />, title: 'Private', desc: 'Only you can see & use it' }
              ].map(opt => {
                const active = visibility === opt.val;
                return (
                  <button key={opt.val} onClick={() => setVisibility(opt.val)}
                          className="no-tap-highlight text-left p-3 rounded-xl transition-all"
                          style={{
                            background: active ? (opt.val === 'private' ? T.accent + '12' : T.success + '12') : T.surface,
                            border: `1.5px solid ${active ? (opt.val === 'private' ? T.accent : T.success) : T.border}`,
                            color: T.ink
                          }}>
                    <div className="flex items-center gap-1.5 mb-1"
                         style={{ color: active ? (opt.val === 'private' ? T.accent : T.success) : T.muted }}>
                      {opt.icon}
                      <span className="font-display text-sm font-semibold">{opt.title}</span>
                    </div>
                    <div className="text-[11px] leading-snug" style={{ color: T.muted }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] mb-4 px-1 leading-relaxed" style={{ color: T.muted }}>
              You can switch this anytime from the bank's page. Only an admin can later edit or delete a bank.
            </div>
          </>
        )}

        {/* Current question count */}
        <Card className="p-3 mb-5" style={{ background: questions.length > 0 ? T.successSoft : T.surfaceWarm }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>
            Questions in this bank{isEdit ? ` (currently v${existingBank.version})` : ''}
          </div>
          <div className="font-display text-2xl font-semibold" style={{ color: questions.length > 0 ? T.success : T.muted }}>
            {questions.length}
          </div>
          {isEdit && (
            <div className="text-xs mt-1" style={{ color: T.muted }}>Saving will publish as v{existingBank.version + 1}</div>
          )}
        </Card>

        {/* Existing questions preview (for edit mode) */}
        {questions.length > 0 && (
          <details className="mb-5">
            <summary className="no-tap-highlight cursor-pointer text-xs uppercase tracking-wider font-semibold pb-2"
                     style={{ color: T.muted }}>
              View / remove questions ({questions.length})
            </summary>
            <div className="space-y-1.5 max-h-64 overflow-y-auto mt-2">
              {questions.map((q, i) => (
                <div key={q.id || i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: T.muted }}>{i + 1}.</span>
                  <div className="flex-1 text-xs leading-snug truncate" style={{ color: T.inkSoft }}>{q.q}</div>
                  <button onClick={() => removeQuestion(i)} className="no-tap-highlight p-1 -m-1 flex-shrink-0">
                    <X size={14} style={{ color: T.error }} />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Paste new questions */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
          {isEdit || questions.length > 0 ? 'Add more questions' : 'Add questions'}
        </div>

        {/* Last-import summary */}
        {lastAdded && (
          <Card className="p-3 mb-3 anim-fadeup"
                style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-start gap-2.5">
              <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
              <div className="text-xs leading-relaxed flex-1" style={{ color: T.inkSoft }}>
                <div className="font-medium" style={{ color: T.success }}>
                  {lastAdded.replaced ? 'Done — set replaced.' : 'Added.'}{' '}
                  {lastAdded.added} question{lastAdded.added === 1 ? '' : 's'} {lastAdded.replaced ? 'now in the set' : 'added'}.
                </div>
                {lastAdded.flagged > 0 && (
                  <div className="mt-1" style={{ color: T.muted }}>
                    {lastAdded.flagged} flagged as possible duplicate{lastAdded.flagged === 1 ? '' : 's'}
                    {' — '}
                    <span style={{ color: T.success }}>{lastAdded.kept} kept</span>
                    {', '}
                    <span style={{ color: T.accent }}>{lastAdded.skipped} skipped</span>.
                  </div>
                )}
                {lastAdded.flaggedDetails && lastAdded.flaggedDetails.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] underline" style={{ color: T.muted }}>
                      view flagged items
                    </summary>
                    <ul className="mt-1.5 space-y-1.5 text-[11px]" style={{ color: T.inkSoft }}>
                      {lastAdded.flaggedDetails.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="flex-shrink-0 mt-0.5"
                                style={{ color: d.keep ? T.success : T.accent }}>
                            {d.keep ? '✓' : '−'}
                          </span>
                          <span className="leading-snug">{d.newQ.q.slice(0, 90)}{d.newQ.q.length > 90 ? '…' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <button onClick={() => setLastAdded(null)} className="no-tap-highlight p-1 -m-1">
                <X size={14} style={{ color: T.muted }} />
              </button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
          {['json', 'csv'].map(f => (
            <button key={f} onClick={() => { setFormat(f); setPreview(null); }}
                    className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{ background: format === f ? T.surface : 'transparent',
                             color: format === f ? T.ink : T.muted,
                             boxShadow: format === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <button onClick={() => { setText(format === 'json' ? EXAMPLE_QUESTIONS_JSON : EXAMPLE_QUESTIONS_CSV); setPreview(null); }}
                className="no-tap-highlight text-xs underline mb-3" style={{ color: T.primary }}>
          insert example {format.toUpperCase()}
        </button>

        <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null); }}
                  placeholder={format === 'json' ? 'Paste a JSON array of questions...' : 'Paste CSV (q,type,topic,sub,options,correct,exp,wrong,difficulty,source)...'}
                  rows={8}
                  className="w-full rounded-xl px-3 py-3 mb-3 text-xs resize-y font-mono"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, minHeight: '180px' }} />

        <Button onClick={parse} disabled={!text.trim()} className="w-full mb-4" icon={<Layers size={16} />}>
          Check questions
        </Button>

        {/* Duplicate review — appears when Append finds near-matches */}
        {dupReview && (
          <Card className="p-4 mb-4 anim-fadeup"
                style={{ background: T.accent + '12', border: `1.5px solid ${T.accent}` }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} style={{ color: T.accent }} />
              <div className="font-display text-sm font-semibold" style={{ color: T.accent }}>
                Possible duplicates
              </div>
            </div>
            <div className="text-xs leading-relaxed mb-3" style={{ color: T.inkSoft }}>
              {dupReview.unique.length > 0
                ? `${dupReview.unique.length} unique question${dupReview.unique.length === 1 ? '' : 's'} will be added. `
                : ''}
              {dupReview.duplicates.length} look{dupReview.duplicates.length === 1 ? 's' : ''} similar to existing question{dupReview.duplicates.length === 1 ? '' : 's'} — choose which to keep.
            </div>

            <div className="space-y-2.5 mb-3">
              {dupReview.duplicates.map((d, i) => (
                <Card key={i} className="p-3" style={{ background: T.surface }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Pill bg={T.accent + '15'} color={T.accent}>
                      {Math.round(d.similarity * 100)}% match
                    </Pill>
                    <button onClick={() => toggleDupKeep(i)}
                            className="no-tap-highlight px-3 py-1 rounded-full text-xs font-semibold transition-colors flex-shrink-0"
                            style={{
                              background: d.keep ? T.success : T.surfaceWarm,
                              color: d.keep ? '#FFF' : T.muted,
                              border: `1px solid ${d.keep ? T.success : T.border}`
                            }}>
                      {d.keep ? '✓ Keep' : 'Skip'}
                    </button>
                  </div>
                  <div className="text-xs mb-2">
                    <div className="font-semibold mb-0.5" style={{ color: T.muted }}>New:</div>
                    <div className="leading-snug" style={{ color: T.ink }}>{d.newQ.q}</div>
                  </div>
                  <div className="text-xs pt-2 border-t" style={{ borderColor: T.borderSoft }}>
                    <div className="font-semibold mb-0.5" style={{ color: T.muted }}>Already in bank:</div>
                    <div className="leading-snug" style={{ color: T.inkSoft }}>{d.match.q}</div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={cancelDupReview} className="w-full">
                Cancel
              </Button>
              <Button onClick={confirmDupReview} className="w-full" icon={<Check size={14} />}>
                Confirm import
              </Button>
            </div>
          </Card>
        )}

        {preview && (
          <div className="anim-fadeup mb-4">
            {preview.message ? (
              <Card className="p-4" style={{ background: T.errorSoft, border: `1px solid ${T.error}` }}>
                <div className="text-sm font-medium" style={{ color: T.error }}>{preview.message}</div>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Card className="p-3" style={{ background: preview.valid.length > 0 ? T.successSoft : T.surface }}>
                    <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Valid</div>
                    <div className="font-display text-2xl font-semibold" style={{ color: T.success }}>{preview.valid.length}</div>
                  </Card>
                  <Card className="p-3" style={{ background: preview.invalid.length > 0 ? T.errorSoft : T.surface }}>
                    <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Invalid</div>
                    <div className="font-display text-2xl font-semibold" style={{ color: T.error }}>{preview.invalid.length}</div>
                  </Card>
                </div>

                {preview.invalid.length > 0 && (
                  <Card className="p-3 mb-3">
                    <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                      Errors (these will be rejected)
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {preview.invalid.slice(0, 20).map(({ index, errors, preview: p }) => (
                        <div key={index} className="text-xs">
                          <div className="font-medium" style={{ color: T.error }}>#{index}: {errors.join(', ')}</div>
                          <div className="truncate" style={{ color: T.muted }}>{p}</div>
                        </div>
                      ))}
                      {preview.invalid.length > 20 && <div className="text-xs" style={{ color: T.muted }}>… and {preview.invalid.length - 20} more</div>}
                    </div>
                  </Card>
                )}

                {preview.valid.length > 0 && (
                  questions.length === 0 ? (
                    // Set is empty — Append and Replace would produce identical
                    // results, so we don't surface a choice. One button, one
                    // clear action.
                    <Button onClick={doAppend} className="w-full" icon={<Plus size={14} />}>
                      Add these {preview.valid.length} question{preview.valid.length === 1 ? '' : 's'}
                    </Button>
                  ) : (
                    // Set already has questions — Append vs Replace genuinely
                    // differ. Stack the two as a clear choice in plain English,
                    // with a destructive warning on the one that destroys data.
                    <div className="space-y-2">
                      <Button onClick={doAppend} className="w-full" icon={<Plus size={16} />}>
                        Add to the existing questions
                      </Button>
                      <div className="text-[11px] -mt-1 mb-1 text-center" style={{ color: T.muted }}>
                        Keeps the {questions.length} question{questions.length === 1 ? '' : 's'} already here
                      </div>
                      <Button onClick={doReplace} variant="ghost" className="w-full"
                              icon={<RefreshCw size={14} />}>
                        Start over with just these
                      </Button>
                      <div className="text-[11px] -mt-1 text-center" style={{ color: T.error }}>
                        Removes the {questions.length} question{questions.length === 1 ? '' : 's'} already here
                      </div>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <Card className="p-3 mb-3 anim-fadeup" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <div className="flex items-start gap-2 text-sm" style={{ color: T.error }}>
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          <Button onClick={handleSave} disabled={saving || !name.trim() || questions.length === 0}
                  size="lg" className="w-full"
                  icon={saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}>
            {saving ? 'Saving…' : (isEdit ? `Save changes (v${existingBank.version + 1})` : 'Save question set')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// QUICK REFERENCE — lab values, vitals, drug doses, abbreviations, conversions
// =====================================================================
const REFERENCE_CATEGORIES = [
  { id: 'labs',   name: 'Lab Values',     icon: '🧪' },
  { id: 'vitals', name: 'Vital Signs',    icon: '🩺' },
  { id: 'drugs',  name: 'Drug Doses',     icon: '💊' },
  { id: 'abbr',   name: 'Abbreviations',  icon: '📋' },
  { id: 'conv',   name: 'Conversions',    icon: '🔄' }
];

const REFERENCE = [
  // ===== LAB VALUES =====
  { cat: 'labs', section: 'Haematology', label: 'Haemoglobin',           value: 'M 13.5–17.5 · F 12–15 g/dL',        note: '<11 in pregnancy = anaemia' },
  { cat: 'labs', section: 'Haematology', label: 'WBC count',             value: '4,000 – 11,000 /µL',                note: 'Leucocytosis vs leucopenia' },
  { cat: 'labs', section: 'Haematology', label: 'RBC count',             value: 'M 4.7–6.1 · F 4.2–5.4 ×10⁶/µL' },
  { cat: 'labs', section: 'Haematology', label: 'Haematocrit',           value: 'M 40–50 % · F 36–44 %' },
  { cat: 'labs', section: 'Haematology', label: 'Platelets',             value: '150,000 – 450,000 /µL',             note: '<50k → bleeding risk; <20k → spontaneous' },
  { cat: 'labs', section: 'Haematology', label: 'MCV',                   value: '80 – 100 fL',                       note: '<80 microcytic · >100 macrocytic' },
  { cat: 'labs', section: 'Haematology', label: 'ESR',                   value: 'M 0–15 · F 0–20 mm/hr' },
  { cat: 'labs', section: 'Haematology', label: 'Reticulocyte count',    value: '0.5 – 2.5 %' },

  { cat: 'labs', section: 'Electrolytes', label: 'Sodium (Na⁺)',         value: '135 – 145 mEq/L',                   note: 'Critical <120 or >160' },
  { cat: 'labs', section: 'Electrolytes', label: 'Potassium (K⁺)',       value: '3.5 – 5.0 mEq/L',                   note: 'Critical <2.5 or >6.5 — cardiac risk' },
  { cat: 'labs', section: 'Electrolytes', label: 'Chloride (Cl⁻)',       value: '96 – 106 mEq/L' },
  { cat: 'labs', section: 'Electrolytes', label: 'Calcium (total)',      value: '8.5 – 10.5 mg/dL',                  note: 'Corrected for albumin if low' },
  { cat: 'labs', section: 'Electrolytes', label: 'Magnesium',            value: '1.5 – 2.5 mEq/L' },
  { cat: 'labs', section: 'Electrolytes', label: 'Phosphorus',           value: '2.5 – 4.5 mg/dL' },

  { cat: 'labs', section: 'Renal', label: 'BUN',                         value: '7 – 20 mg/dL' },
  { cat: 'labs', section: 'Renal', label: 'Creatinine',                  value: 'M 0.7–1.3 · F 0.6–1.1 mg/dL' },
  { cat: 'labs', section: 'Renal', label: 'Uric acid',                   value: 'M 3.4–7.0 · F 2.4–6.0 mg/dL' },
  { cat: 'labs', section: 'Renal', label: 'BUN/Creat ratio',             value: '10 – 20 : 1',                       note: '>20:1 suggests pre-renal' },

  { cat: 'labs', section: 'Glucose / Diabetes', label: 'Fasting glucose',value: '70 – 100 mg/dL',                    note: '100–125 = pre-diabetes · ≥126 = diabetes' },
  { cat: 'labs', section: 'Glucose / Diabetes', label: 'Random glucose', value: '<140 mg/dL normal' },
  { cat: 'labs', section: 'Glucose / Diabetes', label: 'OGTT 2-hr',      value: '<140 normal · 140–199 IGT · ≥200 DM' },
  { cat: 'labs', section: 'Glucose / Diabetes', label: 'HbA1c',          value: '<5.7 % normal · 5.7–6.4 prediab · ≥6.5 DM',  note: 'Target ≤7 % in most patients' },

  { cat: 'labs', section: 'Liver', label: 'AST (SGOT)',                  value: '10 – 40 U/L' },
  { cat: 'labs', section: 'Liver', label: 'ALT (SGPT)',                  value: '7 – 56 U/L' },
  { cat: 'labs', section: 'Liver', label: 'Alkaline phosphatase',        value: '44 – 147 U/L' },
  { cat: 'labs', section: 'Liver', label: 'Total bilirubin',             value: '0.3 – 1.2 mg/dL',                   note: 'Direct ≤0.3' },
  { cat: 'labs', section: 'Liver', label: 'Total protein',               value: '6.0 – 8.3 g/dL' },
  { cat: 'labs', section: 'Liver', label: 'Albumin',                     value: '3.5 – 5.0 g/dL' },

  { cat: 'labs', section: 'Lipids', label: 'Total cholesterol',          value: '<200 mg/dL desirable' },
  { cat: 'labs', section: 'Lipids', label: 'LDL',                        value: '<100 mg/dL optimal' },
  { cat: 'labs', section: 'Lipids', label: 'HDL',                        value: 'M >40 · F >50 mg/dL' },
  { cat: 'labs', section: 'Lipids', label: 'Triglycerides',              value: '<150 mg/dL' },

  { cat: 'labs', section: 'ABG (Arterial Blood Gas)', label: 'pH',       value: '7.35 – 7.45' },
  { cat: 'labs', section: 'ABG (Arterial Blood Gas)', label: 'PaCO₂',    value: '35 – 45 mmHg',                      note: '↑ = respiratory acidosis' },
  { cat: 'labs', section: 'ABG (Arterial Blood Gas)', label: 'PaO₂',     value: '80 – 100 mmHg' },
  { cat: 'labs', section: 'ABG (Arterial Blood Gas)', label: 'HCO₃⁻',    value: '22 – 26 mEq/L',                     note: '↓ = metabolic acidosis' },
  { cat: 'labs', section: 'ABG (Arterial Blood Gas)', label: 'SaO₂',     value: '95 – 100 %' },
  { cat: 'labs', section: 'ABG (Arterial Blood Gas)', label: 'Base excess', value: '−2 to +2 mEq/L' },

  { cat: 'labs', section: 'Coagulation', label: 'PT',                    value: '11 – 13.5 sec' },
  { cat: 'labs', section: 'Coagulation', label: 'INR',                   value: '0.8 – 1.1',                         note: 'Therapeutic on warfarin: 2.0–3.0 (or 2.5–3.5 for valves)' },
  { cat: 'labs', section: 'Coagulation', label: 'aPTT',                  value: '25 – 35 sec',                       note: 'Therapeutic on heparin: 1.5–2.5× control' },
  { cat: 'labs', section: 'Coagulation', label: 'D-dimer',               value: '<500 ng/mL' },
  { cat: 'labs', section: 'Coagulation', label: 'Fibrinogen',            value: '200 – 400 mg/dL' },

  { cat: 'labs', section: 'Cardiac', label: 'Troponin I',                value: '<0.04 ng/mL',                       note: '↑ in MI' },
  { cat: 'labs', section: 'Cardiac', label: 'CK-MB',                     value: '<5 ng/mL' },
  { cat: 'labs', section: 'Cardiac', label: 'BNP',                       value: '<100 pg/mL',                        note: '>400 strongly suggests CHF' },

  { cat: 'labs', section: 'Thyroid', label: 'TSH',                       value: '0.4 – 4.0 µIU/mL' },
  { cat: 'labs', section: 'Thyroid', label: 'Free T4',                   value: '0.8 – 1.8 ng/dL' },
  { cat: 'labs', section: 'Thyroid', label: 'Free T3',                   value: '2.3 – 4.2 pg/mL' },

  { cat: 'labs', section: 'Inflammation', label: 'CRP',                  value: '<10 mg/L' },
  { cat: 'labs', section: 'Inflammation', label: 'Procalcitonin',        value: '<0.05 ng/mL',                       note: '>2.0 suggests severe bacterial' },

  { cat: 'labs', section: 'Urinalysis', label: 'Specific gravity',       value: '1.005 – 1.030' },
  { cat: 'labs', section: 'Urinalysis', label: 'pH',                     value: '4.5 – 8.0' },
  { cat: 'labs', section: 'Urinalysis', label: 'Protein',                value: 'None / trace',                      note: '>300 mg/24h = abnormal' },
  { cat: 'labs', section: 'Urinalysis', label: 'Ketones / Glucose',      value: 'Negative' },

  // ===== VITAL SIGNS =====
  { cat: 'vitals', section: 'Heart Rate by age', label: 'Newborn',       value: '100 – 160 bpm' },
  { cat: 'vitals', section: 'Heart Rate by age', label: 'Infant (1m–1y)',value: '90 – 150 bpm' },
  { cat: 'vitals', section: 'Heart Rate by age', label: 'Toddler (1–3y)',value: '80 – 130 bpm' },
  { cat: 'vitals', section: 'Heart Rate by age', label: 'Preschool',     value: '80 – 120 bpm' },
  { cat: 'vitals', section: 'Heart Rate by age', label: 'School age',    value: '70 – 110 bpm' },
  { cat: 'vitals', section: 'Heart Rate by age', label: 'Adolescent',    value: '60 – 100 bpm' },
  { cat: 'vitals', section: 'Heart Rate by age', label: 'Adult',         value: '60 – 100 bpm',                      note: 'Athletes can be <60' },

  { cat: 'vitals', section: 'Respiratory rate', label: 'Newborn',        value: '30 – 60 /min' },
  { cat: 'vitals', section: 'Respiratory rate', label: 'Infant',         value: '25 – 40 /min' },
  { cat: 'vitals', section: 'Respiratory rate', label: 'Toddler',        value: '20 – 30 /min' },
  { cat: 'vitals', section: 'Respiratory rate', label: 'School age',     value: '18 – 25 /min' },
  { cat: 'vitals', section: 'Respiratory rate', label: 'Adolescent / Adult', value: '12 – 20 /min' },

  { cat: 'vitals', section: 'Blood pressure (Adult, ACC/AHA)', label: 'Normal',     value: '<120 / <80 mmHg' },
  { cat: 'vitals', section: 'Blood pressure (Adult, ACC/AHA)', label: 'Elevated',   value: '120–129 / <80' },
  { cat: 'vitals', section: 'Blood pressure (Adult, ACC/AHA)', label: 'Stage 1 HTN',value: '130–139 / 80–89' },
  { cat: 'vitals', section: 'Blood pressure (Adult, ACC/AHA)', label: 'Stage 2 HTN',value: '≥140 / ≥90' },
  { cat: 'vitals', section: 'Blood pressure (Adult, ACC/AHA)', label: 'Crisis',     value: '>180 / >120',           note: 'Emergency if end-organ damage' },

  { cat: 'vitals', section: 'Temperature', label: 'Oral',                value: '36.5 – 37.5 °C' },
  { cat: 'vitals', section: 'Temperature', label: 'Rectal',              value: '+0.5 °C above oral' },
  { cat: 'vitals', section: 'Temperature', label: 'Axillary',            value: '−0.5 °C below oral' },
  { cat: 'vitals', section: 'Temperature', label: 'Fever / Hypothermia', value: '>38 °C · <36 °C' },

  { cat: 'vitals', section: 'Oxygen / Pulse Ox', label: 'SpO₂ normal',   value: '95 – 100 %' },
  { cat: 'vitals', section: 'Oxygen / Pulse Ox', label: 'COPD target',   value: '88 – 92 %' },
  { cat: 'vitals', section: 'Oxygen / Pulse Ox', label: 'Below 90 %',    value: 'Hypoxaemia — urgent' },

  { cat: 'vitals', section: 'GCS (Glasgow Coma Scale)', label: 'Score range', value: '3 (deep coma) – 15 (normal)' },
  { cat: 'vitals', section: 'GCS (Glasgow Coma Scale)', label: 'Severe head injury', value: '≤8',          note: '"GCS 8 — intubate"' },
  { cat: 'vitals', section: 'GCS (Glasgow Coma Scale)', label: 'Moderate',  value: '9 – 12' },
  { cat: 'vitals', section: 'GCS (Glasgow Coma Scale)', label: 'Mild',      value: '13 – 15' },

  // ===== DRUG DOSES =====
  { cat: 'drugs', section: 'Cardiac emergency', label: 'Adrenaline (cardiac arrest)', value: '1 mg IV/IO q3–5 min',  note: '1:10,000 dilution · 10 mL' },
  { cat: 'drugs', section: 'Cardiac emergency', label: 'Adrenaline (anaphylaxis)',    value: '0.3–0.5 mg IM (1:1000)', note: 'Paeds: 0.01 mg/kg' },
  { cat: 'drugs', section: 'Cardiac emergency', label: 'Atropine (bradycardia)',      value: '0.5 mg IV q3–5 min · max 3 mg' },
  { cat: 'drugs', section: 'Cardiac emergency', label: 'Amiodarone (VF/VT)',          value: '300 mg IV bolus, then 150 mg' },
  { cat: 'drugs', section: 'Cardiac emergency', label: 'Aspirin (ACS)',               value: '162–325 mg PO chewable' },
  { cat: 'drugs', section: 'Cardiac emergency', label: 'Nitroglycerin',               value: '0.4 mg SL q5 min · max 3 doses' },

  { cat: 'drugs', section: 'Neuro emergency', label: 'Lorazepam (status)',  value: '2–4 mg IV slowly' },
  { cat: 'drugs', section: 'Neuro emergency', label: 'Diazepam (status)',   value: '5–10 mg IV (max 30 mg)' },
  { cat: 'drugs', section: 'Neuro emergency', label: 'Phenytoin loading',   value: '15–20 mg/kg IV at ≤50 mg/min' },
  { cat: 'drugs', section: 'Neuro emergency', label: 'Mannitol (↑ICP)',     value: '0.25–1 g/kg IV over 30 min' },

  { cat: 'drugs', section: 'Other emergency', label: 'Naloxone (opioid OD)', value: '0.4–2 mg IV · repeat q2–3 min' },
  { cat: 'drugs', section: 'Other emergency', label: 'Glucose D50',          value: '25–50 mL IV (hypoglycaemia)' },
  { cat: 'drugs', section: 'Other emergency', label: 'Glucagon',             value: '1 mg IM/SC' },
  { cat: 'drugs', section: 'Other emergency', label: 'Magnesium SO₄ (eclampsia)', value: '4 g IV load → 1–2 g/hr' },
  { cat: 'drugs', section: 'Other emergency', label: 'Furosemide',           value: '20–40 mg IV (CHF, oedema)' },

  { cat: 'drugs', section: 'Antidotes', label: 'Vitamin K (warfarin)',       value: '1–10 mg PO/IV depending on INR' },
  { cat: 'drugs', section: 'Antidotes', label: 'Protamine (heparin)',        value: '1 mg per 100 U heparin' },
  { cat: 'drugs', section: 'Antidotes', label: 'N-acetylcysteine (paracetamol)', value: '150 mg/kg IV load' },
  { cat: 'drugs', section: 'Antidotes', label: 'Flumazenil (benzo OD)',      value: '0.2 mg IV, repeat to max 1 mg' },
  { cat: 'drugs', section: 'Antidotes', label: 'Digibind (digoxin)',         value: 'Per kit instructions, by dig level' },

  { cat: 'drugs', section: 'Paediatric (mg/kg)', label: 'Paracetamol',       value: '15 mg/kg PO/PR q4–6h',         note: 'Max 75 mg/kg/day' },
  { cat: 'drugs', section: 'Paediatric (mg/kg)', label: 'Ibuprofen',         value: '5–10 mg/kg PO q6–8h' },
  { cat: 'drugs', section: 'Paediatric (mg/kg)', label: 'Amoxicillin',       value: '25–50 mg/kg/day ÷ TDS' },
  { cat: 'drugs', section: 'Paediatric (mg/kg)', label: 'ORS (acute diarrhoea)', value: '75 mL/kg over 4 hr' },
  { cat: 'drugs', section: 'Paediatric (mg/kg)', label: 'Maintenance fluid', value: '4-2-1 rule (mL/hr)',           note: '1st 10 kg ×4 + next 10 ×2 + above ×1' },

  { cat: 'drugs', section: 'Insulin onset/peak/duration', label: 'Lispro / Aspart (rapid)', value: '5–15 min · 1 h · 3–4 h' },
  { cat: 'drugs', section: 'Insulin onset/peak/duration', label: 'Regular (short)',         value: '30–60 min · 2–3 h · 5–8 h' },
  { cat: 'drugs', section: 'Insulin onset/peak/duration', label: 'NPH (intermediate)',      value: '1–2 h · 4–12 h · 14–24 h' },
  { cat: 'drugs', section: 'Insulin onset/peak/duration', label: 'Glargine / Detemir (long)', value: '1–2 h · No peak · ~24 h' },

  // ===== ABBREVIATIONS =====
  { cat: 'abbr', section: 'Frequency', label: 'OD / QD',  value: 'Once daily' },
  { cat: 'abbr', section: 'Frequency', label: 'BD / BID', value: 'Twice daily' },
  { cat: 'abbr', section: 'Frequency', label: 'TDS / TID',value: 'Three times daily' },
  { cat: 'abbr', section: 'Frequency', label: 'QID',      value: 'Four times daily' },
  { cat: 'abbr', section: 'Frequency', label: 'HS',       value: 'At bedtime (hora somni)' },
  { cat: 'abbr', section: 'Frequency', label: 'PRN',      value: 'As needed' },
  { cat: 'abbr', section: 'Frequency', label: 'STAT',     value: 'Immediately' },
  { cat: 'abbr', section: 'Frequency', label: 'AC / PC',  value: 'Before / After meals' },

  { cat: 'abbr', section: 'Route', label: 'PO',  value: 'By mouth (per os)' },
  { cat: 'abbr', section: 'Route', label: 'SL',  value: 'Sublingual' },
  { cat: 'abbr', section: 'Route', label: 'PR',  value: 'Per rectum' },
  { cat: 'abbr', section: 'Route', label: 'IV',  value: 'Intravenous' },
  { cat: 'abbr', section: 'Route', label: 'IM',  value: 'Intramuscular' },
  { cat: 'abbr', section: 'Route', label: 'SC',  value: 'Subcutaneous' },
  { cat: 'abbr', section: 'Route', label: 'ID',  value: 'Intradermal' },

  { cat: 'abbr', section: 'Status / Care', label: 'NPO / NBM', value: 'Nothing by mouth' },
  { cat: 'abbr', section: 'Status / Care', label: 'KVO / TKO', value: 'Keep vein open' },
  { cat: 'abbr', section: 'Status / Care', label: 'I&O',       value: 'Intake & output' },
  { cat: 'abbr', section: 'Status / Care', label: 'HOB',       value: 'Head of bed' },
  { cat: 'abbr', section: 'Status / Care', label: 'ROM',       value: 'Range of motion' },
  { cat: 'abbr', section: 'Status / Care', label: 'ADL',       value: 'Activities of daily living' },
  { cat: 'abbr', section: 'Status / Care', label: 'DNR',       value: 'Do not resuscitate' },
  { cat: 'abbr', section: 'Status / Care', label: 'BMI',       value: 'Body mass index' },
  { cat: 'abbr', section: 'Status / Care', label: 'BSA',       value: 'Body surface area' },

  { cat: 'abbr', section: 'Conditions', label: 'DM',    value: 'Diabetes mellitus' },
  { cat: 'abbr', section: 'Conditions', label: 'HTN',   value: 'Hypertension' },
  { cat: 'abbr', section: 'Conditions', label: 'COPD',  value: 'Chronic obstructive pulmonary disease' },
  { cat: 'abbr', section: 'Conditions', label: 'CHF',   value: 'Congestive heart failure' },
  { cat: 'abbr', section: 'Conditions', label: 'CKD / AKI', value: 'Chronic kidney disease / Acute kidney injury' },
  { cat: 'abbr', section: 'Conditions', label: 'MI',    value: 'Myocardial infarction' },
  { cat: 'abbr', section: 'Conditions', label: 'CVA / TIA', value: 'Stroke / Transient ischaemic attack' },
  { cat: 'abbr', section: 'Conditions', label: 'DVT / PE', value: 'Deep vein thrombosis / Pulmonary embolism' },
  { cat: 'abbr', section: 'Conditions', label: 'ARDS',  value: 'Acute respiratory distress syndrome' },
  { cat: 'abbr', section: 'Conditions', label: 'PPH',   value: 'Postpartum haemorrhage' },
  { cat: 'abbr', section: 'Conditions', label: 'LBW',   value: 'Low birth weight (<2.5 kg)' },
  { cat: 'abbr', section: 'Conditions', label: 'GCS',   value: 'Glasgow Coma Scale' },
  { cat: 'abbr', section: 'Conditions', label: 'PEEP',  value: 'Positive end-expiratory pressure' },
  { cat: 'abbr', section: 'Conditions', label: 'IFA',   value: 'Iron + Folic Acid' },

  // ===== CONVERSIONS =====
  { cat: 'conv', section: 'Weight', label: '1 kg',     value: '2.2 lb' },
  { cat: 'conv', section: 'Weight', label: '1 lb',     value: '0.45 kg' },
  { cat: 'conv', section: 'Weight', label: '1 grain',  value: '60 mg (approx.)' },

  { cat: 'conv', section: 'Length', label: '1 inch',   value: '2.54 cm' },
  { cat: 'conv', section: 'Length', label: '1 m',      value: '39.4 inches' },

  { cat: 'conv', section: 'Volume', label: '1 tsp',    value: '5 mL' },
  { cat: 'conv', section: 'Volume', label: '1 tbsp',   value: '15 mL' },
  { cat: 'conv', section: 'Volume', label: '1 oz',     value: '30 mL' },
  { cat: 'conv', section: 'Volume', label: '1 cup',    value: '240 mL' },

  { cat: 'conv', section: 'Drop factor', label: 'Macrodrip',  value: '15 gtt/mL (also 10, 20)' },
  { cat: 'conv', section: 'Drop factor', label: 'Microdrip',  value: '60 gtt/mL' },
  { cat: 'conv', section: 'Drop factor', label: 'mL/hr → gtt/min', value: '(mL/hr × drop factor) ÷ 60' },

  { cat: 'conv', section: 'Temperature', label: '°F → °C',   value: '(°F − 32) × 5/9' },
  { cat: 'conv', section: 'Temperature', label: '°C → °F',   value: '(°C × 9/5) + 32' },

  { cat: 'conv', section: 'Dose units', label: '1 mg → mcg', value: '×1000' },
  { cat: 'conv', section: 'Dose units', label: '1 g → mg',   value: '×1000' },
  { cat: 'conv', section: 'Dose units', label: '1 mEq Na',   value: '23 mg' }
];

// =====================================================================
// DOSAGE CALCULATION — practice questions with numeric answers
// =====================================================================
const DOSAGE_QUESTIONS = [
  {
    id: 'd1',
    type: 'tablets',
    q: 'Ordered: Amoxicillin 500 mg PO. Stock: 250 mg tablets. How many tablets do you give?',
    answer: 2, unit: 'tablet(s)', tolerance: 0,
    steps: [
      'Dose on hand (what each tablet contains) = 250 mg',
      'Dose desired (what is ordered) = 500 mg',
      'Formula — Tablets = Dose desired ÷ Dose on hand',
      '500 mg ÷ 250 mg = 2 tablets'
    ],
    intuition: 'You are really just asking "how many 250 mg tablets fit into 500 mg?" — and 250 goes into 500 exactly twice. The mg units cancel, leaving a plain count of tablets, so a clean whole number is a good sign you set it up correctly. If you ever land on an awkward fraction like 1.7 tablets, re-check your numbers, since most tablets can be split in half at most.'
  },
  {
    id: 'd2',
    type: 'liquid',
    q: 'Ordered: Paracetamol 250 mg PO. Stock: 125 mg per 5 mL syrup. How many mL?',
    answer: 10, unit: 'mL', tolerance: 0,
    steps: [
      'Dose on hand = 125 mg, and it lives in 5 mL of syrup (its volume)',
      'Dose desired = 250 mg',
      'Formula — Volume = (Dose desired ÷ Dose on hand) × Volume on hand',
      '(250 mg ÷ 125 mg) × 5 mL = 2 × 5 mL',
      '= 10 mL'
    ],
    intuition: 'First work out how many "doses-worth" of drug you need (250 ÷ 125 = 2), then give that many of the volume each dose is dissolved in (2 × 5 mL). The difference from a tablet is that the drug is suspended in liquid, so you must carry the 5 mL along. Forgetting to multiply by that volume is the single most common mistake in liquid calculations.'
  },
  {
    id: 'd3',
    type: 'mg/kg',
    q: 'Order: Paracetamol 15 mg/kg PO. The child weighs 20 kg. Calculate the dose in mg.',
    answer: 300, unit: 'mg', tolerance: 0,
    steps: [
      'Read the order as a rate: 15 mg of drug for every 1 kg of body weight',
      'Multiply the rate by the actual weight: 15 mg/kg × 20 kg',
      'The kg units cancel, leaving mg: = 300 mg per dose'
    ],
    intuition: 'Weight-based dosing simply scales the drug to the patient\'s size — a 20 kg child needs twice what a 10 kg child would. Let the units guide you: "mg/kg" multiplied by "kg" leaves "mg", confirming you should multiply (not divide). Always notice whether the order is written per DOSE or per DAY — here it is per dose, so no further dividing is needed.'
  },
  {
    id: 'd4',
    type: 'mg/kg',
    q: 'A 60 kg adult is prescribed Vancomycin 15 mg/kg IV. Calculate the dose in mg.',
    answer: 900, unit: 'mg', tolerance: 0,
    steps: [
      'Same weight-based rule: 15 mg for every 1 kg of body weight',
      '15 mg/kg × 60 kg',
      '= 900 mg per dose'
    ],
    intuition: 'This is the identical setup to a paediatric mg/kg dose — adults are just heavier, so the final number is larger. Quick sanity check: 15 × 60 is the same as 15 × 6 × 10 = 900, so the magnitude looks right. In real practice you would also confirm 900 mg sits within Vancomycin\'s recommended maximum, since it is dosed by weight but capped for safety.'
  },
  {
    id: 'd5',
    type: 'IV mL/hr',
    q: 'Order: 1000 mL Normal Saline IV over 8 hours. What is the infusion rate in mL/hr?',
    answer: 125, unit: 'mL/hr', tolerance: 0,
    steps: [
      'You need to spread a fixed volume evenly across a fixed time',
      'Formula — Rate (mL/hr) = Total volume ÷ Total time in hours',
      '1000 mL ÷ 8 hr',
      '= 125 mL/hr'
    ],
    intuition: 'An infusion rate is nothing more than "how much fluid per hour", so you divide the whole bag by the hours it must last. Because the answer must be mL/hr, volume (mL) goes on top and time (hr) on the bottom — the units literally spell out the formula. If the time had been given in minutes, you would convert to hours first, or the rate would come out 60× too small.'
  },
  {
    id: 'd6',
    type: 'IV gtt/min',
    q: 'Order: 1000 mL D5W IV over 8 hours. Drop factor 15 gtt/mL. Drops per minute?',
    answer: 31, unit: 'gtt/min', tolerance: 1,
    steps: [
      'Drops depend on three things: the volume, the tubing\'s drop factor, and the time in MINUTES',
      'Formula — gtt/min = (Total volume × Drop factor) ÷ Time in minutes',
      'Convert the time to minutes: 8 hr × 60 = 480 min',
      '(1000 mL × 15 gtt/mL) ÷ 480 min',
      '= 15,000 ÷ 480 = 31.25',
      '≈ 31 gtt/min (round to a whole drop)'
    ],
    intuition: 'The drop factor tells you how many drops make up 1 mL for that particular tubing, so multiplying volume by drop factor converts millilitres into a total number of drops; dividing by minutes then spreads those drops evenly across the infusion. The classic trap is leaving time in hours — drops are counted per MINUTE, so the time must be in minutes. Since a fraction of a drop is impossible, always round to the nearest whole drop.'
  },
  {
    id: 'd7',
    type: 'IV gtt/min',
    q: 'Order: 500 mL Ringer\'s Lactate over 4 hours. Microdrip (60 gtt/mL). Drops per minute?',
    answer: 125, unit: 'gtt/min', tolerance: 1,
    steps: [
      'Microdrip tubing has a drop factor of 60 gtt/mL',
      'gtt/min = (500 mL × 60 gtt/mL) ÷ (4 hr × 60 min)',
      '= 30,000 ÷ 240',
      '= 125 gtt/min'
    ],
    intuition: 'Here is a time-saving shortcut: with microdrip (60 gtt/mL), the drop factor of 60 and the 60 minutes-in-an-hour cancel each other out, so gtt/min always equals mL/hr. The mL/hr here is 500 ÷ 4 = 125, which is exactly the gtt/min — no long calculation needed. Remember this only holds for 60 gtt/mL microdrip tubing; for any other drop factor you must use the full formula.'
  },
  {
    id: 'd8',
    type: 'IV gtt/min',
    q: 'Order: 100 mL antibiotic infusion over 30 minutes. Drop factor 20 gtt/mL. Drops per minute?',
    answer: 67, unit: 'gtt/min', tolerance: 1,
    steps: [
      'The time is already in minutes (30 min), so no conversion is needed',
      'gtt/min = (100 mL × 20 gtt/mL) ÷ 30 min',
      '= 2,000 ÷ 30',
      '= 66.67',
      '≈ 67 gtt/min'
    ],
    intuition: 'Short infusions are often timed in minutes, which actually makes the maths easier — you plug the minutes straight in with no hour-to-minute conversion. Because you cannot deliver two-thirds of a drop, 66.67 rounds up to 67. Being off by a single drop per minute is clinically trivial, which is why a ±1 tolerance is accepted on these questions.'
  },
  {
    id: 'd9',
    type: 'units / insulin',
    q: 'Order: Regular insulin 12 units SC. Stock: U-100 insulin (100 units/mL). How many mL?',
    answer: 0.12, unit: 'mL', tolerance: 0.01,
    steps: [
      'U-100 is a concentration: 100 units of insulin sit in every 1 mL',
      'Formula — Volume = Units ordered ÷ Units per mL',
      '12 units ÷ 100 units/mL',
      '= 0.12 mL'
    ],
    intuition: 'U-100 is the standard insulin strength, so 1 mL always contains 100 units. The volume comes out tiny (0.12 mL) — which is precisely why insulin is never drawn into an ordinary syringe. You use a unit-marked insulin syringe and simply dial to 12 units; the mL figure is a conceptual check rather than something you measure at the bedside.'
  },
  {
    id: 'd10',
    type: 'concentration',
    q: 'Dopamine 400 mg is added to 250 mL D5W. What is the concentration in mg/mL?',
    answer: 1.6, unit: 'mg/mL', tolerance: 0.01,
    steps: [
      'Concentration means "how much drug per 1 mL of fluid"',
      'Formula — Concentration = Total drug ÷ Total volume',
      '400 mg ÷ 250 mL',
      '= 1.6 mg/mL'
    ],
    intuition: 'You are spreading 400 mg of drug evenly through 250 mL of fluid and asking how much sits in each single millilitre. Because the drug amount (400) is larger than the volume (250), the answer must be more than 1 mg/mL — which 1.6 satisfies. This per-mL value is the bridge for the next step in drip problems, where you turn an ordered dose into a pump rate.'
  },
  {
    id: 'd11',
    type: 'mcg/kg/min',
    q: 'Dopamine drip at 5 mcg/kg/min for a 70 kg patient. Concentration 1600 mcg/mL. mL/hr?',
    answer: 13, unit: 'mL/hr', tolerance: 1,
    steps: [
      'Step 1 — Dose per minute (multiply by weight): 5 mcg/kg/min × 70 kg = 350 mcg/min',
      'Step 2 — Dose per hour (multiply by 60): 350 mcg/min × 60 = 21,000 mcg/hr',
      'Step 3 — Convert dose to volume using the concentration: 21,000 mcg/hr ÷ 1600 mcg/mL ≈ 13.1',
      '≈ 13 mL/hr'
    ],
    intuition: 'These drips look intimidating but are just three unit-conversions chained together: per-kg becomes per-minute, per-minute becomes per-hour, and per-hour becomes per-mL. Take one step at a time and let the units cancel until only mL/hr — what the pump needs — is left. The most common error is skipping the ×60 that converts a per-minute dose into a per-hour dose.'
  },
  {
    id: 'd12',
    type: 'mL/hr ↔ gtt/min',
    q: 'Patient on 100 mL/hr IV. Drop factor 15 gtt/mL. Convert to gtt/min.',
    answer: 25, unit: 'gtt/min', tolerance: 1,
    steps: [
      'You already have the hourly rate (100 mL/hr); you want drops per minute',
      'Formula — gtt/min = (mL/hr × Drop factor) ÷ 60',
      '(100 × 15) ÷ 60',
      '= 1,500 ÷ 60',
      '= 25 gtt/min'
    ],
    intuition: 'This one formula quietly does two conversions at once: multiplying by the drop factor turns mL into drops, and dividing by 60 turns "per hour" into "per minute". If you ever blank on the formula, rebuild it from the units — (mL/hr × gtt/mL) gives gtt/hr, then ÷ 60 gives gtt/min. That habit of tracking units will rescue almost any drip calculation.'
  },
  {
    id: 'd13',
    type: 'BSA / paediatric',
    q: 'A child weighs 15 kg. Maintenance fluid using 4-2-1 rule. mL/hr?',
    answer: 50, unit: 'mL/hr', tolerance: 0,
    steps: [
      'The 4-2-1 rule builds maintenance fluid in weight bands',
      'First 10 kg: 4 mL/kg/hr → 10 × 4 = 40 mL/hr',
      'Next 10 kg (here only 5 kg of it): 2 mL/kg/hr → 5 × 2 = 10 mL/hr',
      'Add the bands: 40 + 10 = 50 mL/hr'
    ],
    intuition: 'Smaller bodies need proportionally more fluid per kg, so the rule is generous for the first 10 kg (4 mL/kg/hr), then tapers to 2, then 1 mL/kg/hr for heavier bands. A 15 kg child only reaches 5 kg into the second band, so you stop there. For a child over 20 kg you would add a third band at 1 mL/kg/hr for every kilogram beyond 20.'
  },
  {
    id: 'd14',
    type: 'unit conversion',
    q: 'Order: 0.25 mg of digoxin. Stock: 125 mcg/mL elixir. How many mL?',
    answer: 2, unit: 'mL', tolerance: 0,
    steps: [
      'The units don\'t match — the order is in mg, the stock in mcg. Convert FIRST',
      'Convert: 0.25 mg × 1000 = 250 mcg (since 1 mg = 1000 mcg)',
      'Now both are in mcg. Volume = (Dose desired ÷ Dose on hand) × Volume on hand',
      '(250 mcg ÷ 125 mcg) × 1 mL',
      '= 2 mL'
    ],
    intuition: 'The entire challenge here is the unit mismatch — divide mg by mcg directly and you will be 1000× off. The rule is simple: convert everything to the same unit before you calculate anything. Digoxin is also a high-alert drug with a very narrow margin between effective and toxic, so a tiny dose like this always deserves an independent double-check.'
  },
  {
    id: 'd15',
    type: 'time calculation',
    q: '500 mL infusion at 50 mL/hr. How many hours will it take?',
    answer: 10, unit: 'hours', tolerance: 0,
    steps: [
      'You know the volume and the rate; you want the time',
      'Formula — Time = Total volume ÷ Rate',
      '500 mL ÷ 50 mL/hr',
      '= 10 hours'
    ],
    intuition: 'This is the infusion-rate formula run backwards: if rate = volume ÷ time, then time = volume ÷ rate. The mL cancel and leave hours. Sanity check it in your head — at 50 mL every hour, reaching 500 mL must take ten hours, which matches the answer exactly.'
  },
  {
    id: 'd16',
    type: 'heparin',
    q: 'Heparin 25,000 units in 250 mL D5W. Ordered at 1000 units/hr. mL/hr?',
    answer: 10, unit: 'mL/hr', tolerance: 0,
    steps: [
      'Step 1 — Find the concentration (units per mL): 25,000 units ÷ 250 mL = 100 units/mL',
      'Step 2 — Convert the ordered dose into volume per hour using that concentration',
      '1000 units/hr ÷ 100 units/mL = 10 mL/hr'
    ],
    intuition: 'Work it in two stages: first turn the bag into a concentration (units per mL), then use that to convert the ordered units/hr into the mL/hr a pump can actually deliver. The units cancel against units, leaving mL/hr. Heparin is a high-alert anticoagulant, so this is exactly the kind of calculation that requires an independent second-nurse check before it runs.'
  },
  {
    id: 'd17',
    type: 'paediatric mg/kg',
    q: 'Order: Amoxicillin 40 mg/kg/day in 3 divided doses. Child is 18 kg. Each dose in mg?',
    answer: 240, unit: 'mg', tolerance: 0,
    steps: [
      'Notice the order is per DAY and split into 3 doses — that is two operations',
      'Step 1 — Total daily dose: 40 mg/kg/day × 18 kg = 720 mg/day',
      'Step 2 — Per dose: 720 mg ÷ 3 doses = 240 mg',
      'So 240 mg every 8 hours (24 hr ÷ 3 doses)'
    ],
    intuition: 'The classic trap is stopping at 720 mg — but that is the whole DAY\'s dose, not a single one. Always check whether a mg/kg order is per dose or per day, and if it is per day, divide the daily total by the number of doses. "3 divided doses" across 24 hours naturally works out to one dose every 8 hours.'
  },
  {
    id: 'd18',
    type: 'IV mL/hr',
    q: 'Order: 2 L (2000 mL) Normal Saline IV over 24 hours. Rate in mL/hr?',
    answer: 83, unit: 'mL/hr', tolerance: 1,
    steps: [
      'Convert litres to mL first if needed: 2 L = 2000 mL',
      'Formula — Rate = Total volume ÷ Total time in hours',
      '2000 mL ÷ 24 hr',
      '= 83.33',
      '≈ 83 mL/hr'
    ],
    intuition: 'A 24-hour infusion is the standard for maintenance fluids, and dividing by 24 rarely gives a whole number, so rounding (and the small ±1 tolerance) is expected. Quick check: 2000 ÷ 24 is just over 80, so 83 mL/hr is sensible. Always convert litres to millilitres first — skip that and your rate will be 1000× off.'
  }
];

// =====================================================================
// TTS BUTTON — small play/pause button using Web Speech API
// =====================================================================
function TTSButton({ text, size = 14, label, className = '', tone = 'soft' }) {
  const [speaking, setSpeaking] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // The "stay mounted across question changes" lifecycle is the tricky part
  // here. The Quiz screen reuses the SAME TTSButton instance while cycling
  // through questions — only its `text` prop changes — so a plain unmount
  // cleanup never fires when the user moves to the next question.
  //
  // We therefore cancel any in-flight speech whenever:
  //   (a) the text being spoken changes (next question / explanation toggle), or
  //   (b) the component finally unmounts.
  // This keeps the speech aligned with what's on screen.
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      // Only reset state if we're still mounted (text changed); after a real
      // unmount the state is discarded anyway, so skip the no-op update.
      if (mountedRef.current) setSpeaking(false);
    };
  }, [text]);

  const supported = typeof window !== 'undefined' && !!window.speechSynthesis && !!window.SpeechSynthesisUtterance;
  if (!supported) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    if (speaking) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
      setSpeaking(false);
      return;
    }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    const u = new window.SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1;
    u.lang = 'en-IN';
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    try { window.speechSynthesis.speak(u); } catch (e) { setSpeaking(false); }
  };

  const baseStyle = tone === 'soft'
    ? { background: T.surfaceWarm, color: T.inkSoft, border: `1px solid ${T.border}` }
    : { background: 'transparent', color: T.muted, border: 'none' };
  const activeStyle = speaking
    ? { background: T.primary, color: '#FFF', border: `1px solid ${T.primary}` }
    : baseStyle;

  return (
    <button onClick={handleClick} type="button" aria-label={label || (speaking ? 'Stop' : 'Read aloud')}
            className={`no-tap-highlight inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors active:scale-95 ${className}`}
            style={activeStyle}>
      {speaking ? <Square size={size - 2} /> : <Volume2 size={size} />}
      {label && <span>{speaking ? 'Stop' : label}</span>}
    </button>
  );
}

// =====================================================================
// REFERENCE SCREEN
// =====================================================================
function Reference({ onBack }) {
  const [cat, setCat] = useState('labs');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = REFERENCE.filter(r => r.cat === cat);
    if (q) {
      // When searching, expand to all categories so results aren't hidden behind a tab
      items = REFERENCE.filter(r =>
        r.label.toLowerCase().includes(q) ||
        r.value.toLowerCase().includes(q) ||
        (r.note && r.note.toLowerCase().includes(q)) ||
        r.section.toLowerCase().includes(q)
      );
    }
    return items;
  }, [cat, query]);

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(item => {
      const key = `${item.cat}::${item.section}`;
      if (!map.has(key)) map.set(key, { cat: item.cat, section: item.section, items: [] });
      map.get(key).items.push(item);
    });
    return Array.from(map.values());
  }, [filtered]);

  // Per-category visual identity — clinical icon + an earthy accent pulled
  // from the theme's section palette. Mapped here (not in the data) so the
  // underlying REFERENCE_CATEGORIES stays untouched.
  const CAT_META = {
    labs:   { Icon: FlaskConical,   color: T.sec.stats },
    vitals: { Icon: HeartPulse,     color: T.sec.topic },
    drugs:  { Icon: PillIcon,       color: T.sec.revision },
    abbr:   { Icon: ClipboardList,  color: T.sec.learn },
    conv:   { Icon: ArrowRightLeft, color: T.sec.library }
  };
  const metaFor = (id) => CAT_META[id] || { Icon: FlaskConical, color: T.primary };
  // Flag clinically dangerous values so they read like a real chart alert.
  const isAlert = (note) => !!note && /critical|toxic|fatal|danger|risk/i.test(note);

  const searching = query.trim().length > 0;
  const totalInCat = REFERENCE.filter(r => r.cat === cat).length;

  return (
    <div className="anim-fadeup">
      <TopBar title="Reference" onBack={onBack} feedback={{ screen: "Reference" }}
              right={!searching && (
                <div className="text-[11px] font-medium tabular-nums px-2 py-1 rounded-full"
                     style={{ background: metaFor(cat).color + '14', color: metaFor(cat).color }}>
                  {totalInCat}
                </div>
              )} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
                 placeholder="Search labs, drugs, abbreviations…"
                 className="w-full rounded-2xl pl-10 pr-10 py-3 text-sm font-body"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink,
                          boxShadow: '0 1px 2px rgba(26,43,35,0.04)' }} />
          {query && (
            <button onClick={() => setQuery('')}
                    className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5">
              <X size={14} style={{ color: T.muted }} />
            </button>
          )}
        </div>

        {/* Category selector — colour-coded icon chips */}
        {!searching && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
            {REFERENCE_CATEGORIES.map(c => {
              const { Icon, color } = metaFor(c.id);
              const active = cat === c.id;
              return (
                <button key={c.id} onClick={() => setCat(c.id)}
                        className="no-tap-highlight flex-shrink-0 pl-2 pr-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
                        style={{ background: active ? color : T.surface,
                                 color: active ? '#FFF' : T.inkSoft,
                                 border: `1px solid ${active ? color : T.border}`,
                                 boxShadow: active ? `0 2px 8px ${color}33` : 'none' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: active ? 'rgba(255,255,255,0.2)' : color + '15' }}>
                    <Icon size={13} style={{ color: active ? '#FFF' : color }} />
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {searching && (
          <div className="text-xs mb-3 px-1 font-medium" style={{ color: T.muted }}>
            {filtered.length} match{filtered.length === 1 ? '' : 'es'} across all categories
          </div>
        )}

        {/* Sections */}
        {grouped.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                 style={{ background: T.surfaceWarm }}>
              <Search size={24} style={{ color: T.muted, opacity: 0.5 }} />
            </div>
            <div className="text-sm font-medium" style={{ color: T.inkSoft }}>No matches for "{query}"</div>
            <div className="text-xs mt-1" style={{ color: T.muted }}>Try a shorter or different term</div>
          </div>
        ) : (
          grouped.map(group => {
            const { Icon, color } = metaFor(group.cat);
            const catName = REFERENCE_CATEGORIES.find(c => c.id === group.cat)?.name;
            return (
              <div key={group.cat + group.section} className="mb-5">
                {/* Section header — icon tile + title, with category context when searching */}
                <div className="flex items-center gap-2.5 mb-2 px-1">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: color + '16' }}>
                    <Icon size={13} style={{ color }} />
                  </span>
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[13px] font-semibold truncate" style={{ color: T.ink }}>{group.section}</span>
                    {searching && catName && (
                      <span className="text-[10px] uppercase tracking-wider flex-shrink-0" style={{ color: T.muted }}>{catName}</span>
                    )}
                  </div>
                </div>

                <Card className="overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
                  {group.items.map((item, idx) => {
                    const alert = isAlert(item.note);
                    return (
                      <div key={item.label + idx}
                           className="px-4 py-3"
                           style={{ borderBottom: idx < group.items.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
                        <div className="flex items-baseline justify-between gap-4">
                          <div className="text-[13px] font-medium leading-snug" style={{ color: T.ink }}>{item.label}</div>
                          <div className="text-[13px] font-semibold text-right tabular-nums tracking-tight flex-shrink-0"
                               style={{ color: T.inkSoft }}>{item.value}</div>
                        </div>
                        {item.note && (
                          alert ? (
                            <div className="flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-lg"
                                 style={{ background: T.errorSoft }}>
                              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
                              <div className="text-[11px] leading-snug font-medium" style={{ color: T.error }}>{item.note}</div>
                            </div>
                          ) : (
                            <div className="text-[11px] mt-1.5 leading-snug" style={{ color: T.muted }}>{item.note}</div>
                          )
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =====================================================================
// REFERENCE LOOKUP MODAL — the same lookup table as the Reference screen,
// but as an overlay so it can be opened from inside a test (Quick / Topic /
// Mock) without leaving the question. Self-contained state; closing it
// returns the user exactly where they were. Rendered as a sibling of the
// quiz's anim-fadeup wrapper so its position:fixed anchors to the viewport.
// =====================================================================
function ReferenceLookupModal({ open, onClose }) {
  const [cat, setCat] = useState('labs');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return REFERENCE.filter(r =>
        r.label.toLowerCase().includes(q) ||
        r.value.toLowerCase().includes(q) ||
        (r.note && r.note.toLowerCase().includes(q)) ||
        r.section.toLowerCase().includes(q)
      );
    }
    return REFERENCE.filter(r => r.cat === cat);
  }, [cat, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(item => {
      const key = `${item.cat}::${item.section}`;
      if (!map.has(key)) map.set(key, { cat: item.cat, section: item.section, items: [] });
      map.get(key).items.push(item);
    });
    return Array.from(map.values());
  }, [filtered]);

  const CAT_META = {
    labs:   { Icon: FlaskConical,   color: T.sec.stats },
    vitals: { Icon: HeartPulse,     color: T.sec.topic },
    drugs:  { Icon: PillIcon,       color: T.sec.revision },
    abbr:   { Icon: ClipboardList,  color: T.sec.learn },
    conv:   { Icon: ArrowRightLeft, color: T.sec.library }
  };
  const metaFor = (id) => CAT_META[id] || { Icon: FlaskConical, color: T.primary };
  const isAlert = (note) => !!note && /critical|toxic|fatal|danger|risk/i.test(note);
  const searching = query.trim().length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onClose}>
      <div className="w-full max-w-md mx-auto flex flex-col anim-scalein rounded-t-3xl sm:rounded-3xl overflow-hidden"
           style={{ background: T.bg, maxHeight: '88vh', border: `1px solid ${T.border}` }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
             style={{ borderBottom: `1px solid ${T.borderSoft}`, background: T.surface }}>
          <div className="flex items-center gap-2">
            <FlaskConical size={18} style={{ color: T.accent }} />
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Quick reference</div>
          </div>
          <button onClick={onClose} className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
            <X size={20} style={{ color: T.muted }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-4 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
            <input value={query} onChange={e => setQuery(e.target.value)} autoFocus={false}
                   placeholder="Search labs, drugs, abbreviations…"
                   className="w-full rounded-2xl pl-10 pr-10 py-3 text-sm font-body"
                   style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
            {query && (
              <button onClick={() => setQuery('')}
                      className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5">
                <X size={14} style={{ color: T.muted }} />
              </button>
            )}
          </div>

          {/* Category chips */}
          {!searching && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
              {REFERENCE_CATEGORIES.map(c => {
                const { Icon, color } = metaFor(c.id);
                const active = cat === c.id;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)}
                          className="no-tap-highlight flex-shrink-0 pl-2 pr-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
                          style={{ background: active ? color : T.surface,
                                   color: active ? '#FFF' : T.inkSoft,
                                   border: `1px solid ${active ? color : T.border}` }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: active ? 'rgba(255,255,255,0.2)' : color + '15' }}>
                      <Icon size={13} style={{ color: active ? '#FFF' : color }} />
                    </span>
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {searching && (
            <div className="text-xs mb-3 px-1 font-medium" style={{ color: T.muted }}>
              {filtered.length} match{filtered.length === 1 ? '' : 'es'} across all categories
            </div>
          )}

          {/* Grouped list */}
          {grouped.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-sm font-medium" style={{ color: T.inkSoft }}>No matches for "{query}"</div>
              <div className="text-xs mt-1" style={{ color: T.muted }}>Try a shorter or different term</div>
            </div>
          ) : (
            grouped.map(group => {
              const { Icon, color } = metaFor(group.cat);
              const catName = REFERENCE_CATEGORIES.find(c => c.id === group.cat)?.name;
              return (
                <div key={group.cat + group.section} className="mb-4">
                  <div className="flex items-center gap-2.5 mb-2 px-1">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: color + '16' }}>
                      <Icon size={13} style={{ color }} />
                    </span>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[13px] font-semibold truncate" style={{ color: T.ink }}>{group.section}</span>
                      {searching && catName && (
                        <span className="text-[10px] uppercase tracking-wider flex-shrink-0" style={{ color: T.muted }}>{catName}</span>
                      )}
                    </div>
                  </div>
                  <Card className="overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
                    {group.items.map((item, idx) => {
                      const alert = isAlert(item.note);
                      return (
                        <div key={item.label + idx} className="px-4 py-3"
                             style={{ borderBottom: idx < group.items.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
                          <div className="flex items-baseline justify-between gap-4">
                            <div className="text-[13px] font-medium leading-snug" style={{ color: T.ink }}>{item.label}</div>
                            <div className="text-[13px] font-semibold text-right tabular-nums tracking-tight flex-shrink-0"
                                 style={{ color: T.inkSoft }}>{item.value}</div>
                          </div>
                          {item.note && (
                            alert ? (
                              <div className="flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-lg" style={{ background: T.errorSoft }}>
                                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
                                <div className="text-[11px] leading-snug font-medium" style={{ color: T.error }}>{item.note}</div>
                              </div>
                            ) : (
                              <div className="text-[11px] mt-1.5 leading-snug" style={{ color: T.muted }}>{item.note}</div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </Card>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// DOSAGE PRACTICE — numeric answer input
// =====================================================================
function DosagePractice({ onComplete, onBack }) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]);
  const questions = useMemo(() => shuffle(DOSAGE_QUESTIONS).slice(0, 10), []);
  const q = questions[index];

  if (!q) {
    return (
      <div className="p-6 max-w-md mx-auto text-center anim-fadeup">
        <div className="font-display text-xl" style={{ color: T.ink }}>No questions</div>
      </div>
    );
  }

  const userValue = parseFloat(input);
  const isValidInput = !isNaN(userValue) && input.trim() !== '';
  const isCorrect = isValidInput && Math.abs(userValue - q.answer) <= q.tolerance;
  // A question is "resolved" once it's been checked or its answer revealed —
  // both lock the input and surface the worked solution.
  const done = submitted || revealed;

  // Advance to the next question, or finish. `finalResults` is passed
  // explicitly so a skip on the LAST question still hands a complete set to
  // onComplete (state updates wouldn't have flushed yet).
  const goNext = (finalResults) => {
    if (index + 1 < questions.length) {
      setIndex(i => i + 1);
      setInput('');
      setSubmitted(false);
      setRevealed(false);
    } else {
      onComplete(finalResults, questions);
    }
  };

  const submit = () => {
    if (!isValidInput) return;
    setResults(r => [...r, { qId: q.id, correct: isCorrect, userAnswer: userValue }]);
    setSubmitted(true);
  };

  // Reveal the answer without judging the user — recorded as not-correct but
  // tagged `revealed` so results can show it as "revealed" rather than "wrong".
  const reveal = () => {
    setResults(r => [...r, { qId: q.id, correct: false, revealed: true, userAnswer: null }]);
    setRevealed(true);
  };

  // Skip straight past — recorded as `skipped` and excluded from accuracy.
  const skip = () => {
    const entry = { qId: q.id, correct: false, skipped: true, userAnswer: null };
    setResults(r => [...r, entry]);
    goNext([...results, entry]);
  };

  const next = () => goNext(results);

  const progress = ((index + (done ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="anim-fadeup">
      <TopBar title="Dosage calculation test" onBack={onBack} feedback={{ screen: "Dosage calc" }}
              right={<div className="text-xs font-semibold tabular-nums" style={{ color: T.muted }}>{index + 1} / {questions.length}</div>} />

      <div className="max-w-md mx-auto px-4 pb-40 pt-3">
        {/* Progress */}
        <div className="h-1.5 rounded-full mb-6" style={{ background: T.borderSoft }}>
          <div className="h-1.5 rounded-full transition-all duration-300" style={{ background: T.primary, width: `${progress}%` }} />
        </div>

        {/* Order card — reads like a prescription */}
        <Card className="p-5 mb-5" style={{ borderLeft: `3px solid ${T.primary}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: T.primary + '14', color: T.primary }}>
              <Calculator size={11} /> {q.type}
            </span>
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Order</span>
          </div>
          <div className="font-display text-xl leading-snug whitespace-pre-wrap" style={{ color: T.ink }}>
            {q.q}
          </div>
        </Card>

        {/* Answer input — calculator-style field */}
        <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-1" style={{ color: T.muted }}>Your answer</div>
        <div className="relative mb-2">
          <input type="text" inputMode="decimal" value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter' && !done) submit(); }}
                 disabled={done}
                 placeholder="0"
                 className="w-full rounded-2xl pl-5 pr-24 py-5 text-3xl font-display font-semibold tabular-nums outline-none"
                 style={{ background: T.surface,
                          border: `1.5px solid ${submitted ? (isCorrect ? T.success : T.error) : revealed ? T.primary : T.border}`,
                          color: submitted ? (isCorrect ? T.success : T.error) : T.ink,
                          boxShadow: '0 1px 2px rgba(26,43,35,0.04)' }} />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold px-3 py-1.5 rounded-xl"
               style={{ background: T.surfaceWarm, color: T.muted }}>
            {q.unit}
          </div>
        </div>
        {q.tolerance > 0 && !done && (
          <div className="text-xs mb-4 px-1" style={{ color: T.muted }}>Accepted within ±{q.tolerance} {q.unit}</div>
        )}

        {done && (
          <div className="anim-fadeup space-y-3 mt-5">
            {submitted ? (
              <Card className="p-4" style={{ background: isCorrect ? T.successSoft : T.errorSoft,
                                              border: `1px solid ${isCorrect ? T.success : T.error}40` }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: isCorrect ? T.success : T.error }}>
                    {isCorrect ? <Check size={14} style={{ color: '#FFF' }} /> : <X size={14} style={{ color: '#FFF' }} />}
                  </span>
                  <div className="font-display text-base font-semibold" style={{ color: isCorrect ? T.success : T.error }}>
                    {isCorrect ? 'Correct' : 'Not quite'}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: T.muted }}>You gave</div>
                    <div className="font-semibold tabular-nums" style={{ color: T.inkSoft }}>{userValue} {q.unit}</div>
                  </div>
                  {!isCorrect && (
                    <>
                      <div className="w-px self-stretch" style={{ background: T.error + '30' }} />
                      <div>
                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: T.muted }}>Correct</div>
                        <div className="font-semibold tabular-nums" style={{ color: T.success }}>{q.answer} {q.unit}</div>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-4" style={{ background: T.primary + '12', border: `1px solid ${T.primary}33` }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: T.primary }}>
                    <Eye size={14} style={{ color: '#FFF' }} />
                  </span>
                  <div className="font-display text-base font-semibold" style={{ color: T.primary }}>Answer revealed</div>
                </div>
                <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: T.muted }}>Correct answer</div>
                <div className="font-display text-2xl font-semibold tabular-nums" style={{ color: T.ink }}>{q.answer} {q.unit}</div>
              </Card>
            )}

            <Card className="p-4" style={{ background: T.surfaceWarm }}>
              <div className="flex items-center gap-2 mb-3">
                <Sigma size={14} style={{ color: T.accent }} />
                <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Worked solution</div>
              </div>
              <ol className="space-y-3">
                {q.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold mt-0.5"
                          style={{ background: T.primary, color: '#FFF' }}>
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed font-mono" style={{ color: T.ink }}>{step}</span>
                  </li>
                ))}
              </ol>
              {q.intuition && (
                <div className="mt-4 rounded-xl p-3.5" style={{ background: T.accent + '12', border: `1px solid ${T.accent}2E` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Lightbulb size={14} style={{ color: T.accent }} />
                    <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Why it works</div>
                  </div>
                  <div className="text-sm leading-relaxed" style={{ color: T.ink }}>{q.intuition}</div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 backdrop-blur-md"
           style={{ background: IS_DARK ? 'rgba(21,19,15,0.9)' : T.bg + 'E6', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          {!done ? (
            <div className="space-y-2.5">
              <Button onClick={submit} disabled={!isValidInput} size="lg" className="w-full" icon={<Check size={18} />}>
                Check answer
              </Button>
              <div className="flex gap-2.5">
                <Button variant="ghost" onClick={skip} size="md" className="flex-1" icon={<SkipForward size={16} />}>
                  Skip
                </Button>
                <Button variant="soft" onClick={reveal} size="md" className="flex-1" icon={<Eye size={16} />}>
                  Show answer
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={next} size="lg" className="w-full" icon={<ChevronRight size={18} />}>
              {index + 1 < questions.length ? 'Next question' : 'Finish'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DosageResults({ results, questions, onHome }) {
  // Accuracy is measured only over genuinely attempted questions — skipped and
  // revealed items are study actions, not failures, so they don't drag the score.
  const attempted = results.filter(r => !r.skipped && !r.revealed);
  const correct = attempted.filter(r => r.correct).length;
  const total = attempted.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const wrongCount = attempted.filter(r => !r.correct).length;
  const skippedCount = results.filter(r => r.skipped).length;
  const revealedCount = results.filter(r => r.revealed).length;
  // Everything worth another look: wrong attempts, revealed, and skipped.
  const toRevise = results.filter(r => !r.correct);

  const scoreColor = pct >= 75 ? T.success : pct >= 50 ? T.primary : T.error;

  return (
    <div className="anim-fadeup max-w-md mx-auto px-4 pt-8 pb-24">
      <MotivationCard pct={pct} label="calc" />

      {/* Score summary */}
      <Card className="p-6 mb-5">
        <div className="flex items-center gap-5">
          {/* Score ring */}
          <div className="relative flex-shrink-0" style={{ width: 92, height: 92 }}>
            <svg width="92" height="92" viewBox="0 0 92 92" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="46" cy="46" r="40" fill="none" stroke={T.borderSoft} strokeWidth="7" />
              <circle cx="46" cy="46" r="40" fill="none" stroke={scoreColor} strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - pct / 100)}
                      style={{ transition: 'stroke-dashoffset 0.6s ease-out' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-2xl font-semibold leading-none" style={{ color: scoreColor }}>{pct}%</div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Calculator size={13} style={{ color: T.muted }} />
              <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Dosage test complete</div>
            </div>
            <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>
              {total > 0 ? `${correct} of ${total} correct` : 'No questions attempted'}
            </div>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {correct > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: T.successSoft, color: T.success }}>
                  <Check size={11} /> {correct} right
                </span>
              )}
              {wrongCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: T.errorSoft, color: T.error }}>
                  <X size={11} /> {wrongCount} to fix
                </span>
              )}
              {revealedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: T.primary + '14', color: T.primary }}>
                  <Eye size={11} /> {revealedCount} revealed
                </span>
              )}
              {skippedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: T.surfaceWarm, color: T.muted }}>
                  <SkipForward size={11} /> {skippedCount} skipped
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {toRevise.length > 0 && (
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-widest font-semibold mb-3 px-1" style={{ color: T.muted }}>To revise</div>
          <div className="space-y-2.5">
            {toRevise.map(r => {
              const q = questions.find(qq => qq.id === r.qId);
              if (!q) return null;
              const tag = r.skipped ? { label: 'Skipped', Icon: SkipForward, color: T.muted, edge: T.muted }
                        : r.revealed ? { label: 'Revealed', Icon: Eye, color: T.primary, edge: T.primary }
                        : { label: 'Incorrect', Icon: X, color: T.error, edge: T.error };
              return (
                <Card key={r.qId} className="p-4" style={{ borderLeft: `3px solid ${tag.edge}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: tag.color + '18', color: tag.color }}>
                      <tag.Icon size={9} /> {tag.label}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>{q.type}</span>
                  </div>
                  <div className="text-sm leading-snug mb-3" style={{ color: T.ink }}>{q.q}</div>
                  <div className="flex items-center gap-4 text-xs">
                    {r.userAnswer != null && (
                      <>
                        <div>
                          <span className="uppercase tracking-wider text-[9px]" style={{ color: T.muted }}>You gave</span>
                          <div className="font-semibold tabular-nums" style={{ color: T.error }}>{r.userAnswer} {q.unit}</div>
                        </div>
                        <div className="w-px self-stretch" style={{ background: T.borderSoft }} />
                      </>
                    )}
                    <div>
                      <span className="uppercase tracking-wider text-[9px]" style={{ color: T.muted }}>Correct</span>
                      <div className="font-semibold tabular-nums" style={{ color: T.success }}>{q.answer} {q.unit}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Button onClick={onHome} size="lg" className="w-full">Back to home</Button>
    </div>
  );
}

// =====================================================================
// BOOKMARKS — READ-ONLY VIEWER with table of contents
// =====================================================================
// Opening Bookmarks should not feel like another quiz. It's a quick-reference
// study aid: the user already decided this question was important, so we show
// the stem, the correct answer highlighted, and the explanation directly.
// The TOC at the top is the killer feature — when you have 40 bookmarks
// spread across 10 topics, jumping to one specific item is a single tap
// instead of scrolling forever.
function BookmarksScreen({ data, allQuestions, onToggleBookmark, onBack }) {
  // Two-mode component:
  //   selected === null   → INDEX page  : a Table of Contents only. Just titles
  //                                       grouped by topic. Tapping a row opens
  //                                       that one bookmark.
  //   selected === qId    → DETAIL page : the question, its options with the
  //                                       correct answer highlighted, explanation,
  //                                       "why others are wrong", and the
  //                                       optional alt explanation. A small Back
  //                                       button returns to the index.
  //
  // This matches the user's mental model exactly: bookmarks are a textbook
  // index, and tapping an entry takes you straight to that chapter — no long
  // scroll, no clutter.
  const [topicFilter, setTopicFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  // Rebuilds whenever data.bookmarks changes so live un-bookmark works.
  const itemIds = useMemo(() => new Set(data.bookmarks || []), [data.bookmarks]);

  // All bookmarked questions, ordered as they appear in allQuestions for
  // predictable index ordering.
  const allBookmarked = useMemo(
    () => allQuestions.filter(q => itemIds.has(q.id)),
    [allQuestions, itemIds]
  );

  const items = useMemo(() => {
    return allBookmarked.filter(q => topicFilter === 'all' || q.topic === topicFilter);
  }, [allBookmarked, topicFilter]);

  const groupedByTopic = useMemo(() => {
    const map = new Map();
    items.forEach(q => {
      if (!map.has(q.topic)) map.set(q.topic, []);
      map.get(q.topic).push(q);
    });
    return Array.from(map.entries()).map(([topic, qs]) => ({ topic, questions: qs }));
  }, [items]);

  const availableTopics = useMemo(() => {
    const set = new Set();
    allBookmarked.forEach(q => set.add(q.topic));
    return Array.from(set);
  }, [allBookmarked]);

  // Trim a stem so long questions render as one or two tidy lines in the index.
  const stemPreview = (s) => {
    const txt = String(s || '').replace(/\s+/g, ' ').trim();
    return txt.length > 90 ? txt.slice(0, 90).trim() + '…' : txt;
  };

  // ===== EMPTY STATE: nothing bookmarked yet =====
  if (itemIds.size === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Bookmarks" onBack={onBack} feedback={{ screen: "Bookmarks" }} />
        <div className="max-w-md mx-auto px-4 pt-16 pb-24 text-center">
          <Bookmark size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.35 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>No bookmarks yet</div>
          <div className="text-sm mb-6 leading-relaxed" style={{ color: T.muted }}>
            Tap the bookmark icon on any question during practice — they'll show up here as
            a quick-reference study list with the answer and explanation ready to read.
          </div>
          <Button onClick={onBack} variant="ghost">Back</Button>
        </div>
      </div>
    );
  }

  // ===== DETAIL PAGE: a single bookmark, opened from the index =====
  if (selectedId !== null) {
    const q = allQuestions.find(x => x.id === selectedId);
    // If the bookmark was removed elsewhere or the question vanished, bounce
    // back to the index gracefully.
    if (!q) {
      // Clear during render is unsafe; defer via effect would over-engineer.
      // The safe move is to render a tiny "not found" with a back action.
      return (
        <div className="anim-fadeup">
          <TopBar title="Bookmark" onBack={() => setSelectedId(null)} feedback={{ screen: "Bookmark detail" }} />
          <div className="max-w-md mx-auto px-4 pt-16 pb-24 text-center">
            <div className="text-sm" style={{ color: T.muted }}>This bookmark is no longer available.</div>
            <Button onClick={() => setSelectedId(null)} className="mt-4">Back to index</Button>
          </div>
        </div>
      );
    }

    const topic = TOPICS.find(x => x.id === q.topic);
    const ttsText = `${q.q}. Options: ${q.options.map((o, i) => String.fromCharCode(65 + i) + ': ' + o).join('. ')}. Correct: ${q.correct.map(i => String.fromCharCode(65 + i)).join(', ')}. ${q.exp}`;

    return (
      <div className="anim-fadeup">
        <TopBar title="Bookmark" onBack={() => setSelectedId(null)}
                feedback={{ screen: "Bookmark detail", questionId: q.id }} />
        <div className="max-w-md mx-auto px-4 pt-2 pb-24">

          {/* Topic pill */}
          {topic && (
            <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full text-[11px] font-medium"
                 style={{ background: (topic.color || T.primary) + '18', color: fgOnDark(topic.color || T.primary) }}>
              <span>{topic.icon}</span>
              <span>{topic.name}</span>
            </div>
          )}

          {/* Question */}
          <div className="font-display text-lg leading-snug mb-4" style={{ color: T.ink }}>
            {q.q}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-5">
            <TTSButton text={ttsText} label="Read aloud" tone="soft" />
            <button onClick={() => { onToggleBookmark(q.id); setSelectedId(null); }}
                    className="no-tap-highlight inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium active:scale-95"
                    style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>
              <BookmarkCheck size={12} />
              Remove
            </button>
          </div>

          {/* Options — correct answer highlighted */}
          <div className="space-y-2 mb-5">
            {q.options.map((opt, i) => {
              const isCorrect = q.correct.includes(i);
              return (
                <div key={i}
                     className="flex items-start gap-2.5 text-sm leading-snug px-3 py-2.5 rounded-xl"
                     style={{
                       background: isCorrect ? T.successSoft : T.surfaceWarm,
                       border: `1.5px solid ${isCorrect ? T.success + '60' : 'transparent'}`
                     }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold"
                       style={{
                         background: isCorrect ? T.success : T.surface,
                         color: isCorrect ? '#FFF' : T.muted,
                         border: `1.5px solid ${isCorrect ? T.success : T.border}`
                       }}>
                    {isCorrect ? <Check size={13} /> : String.fromCharCode(65 + i)}
                  </div>
                  <div className="pt-0.5"
                       style={{ color: isCorrect ? T.ink : T.inkSoft,
                                fontWeight: isCorrect ? 500 : 400 }}>
                    {opt}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          {q.exp && (
            <Card className="p-4 mb-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={14} style={{ color: T.accent }} />
                <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
                  Explanation
                </div>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>
                {q.exp}
              </div>
            </Card>
          )}

          {/* Why the others are wrong */}
          {q.wrong && Object.keys(q.wrong).length > 0 && (
            <Card className="p-4 mb-3">
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-2.5" style={{ color: T.muted }}>
                Why the others are wrong
              </div>
              <div className="space-y-2">
                {Object.entries(q.wrong).map(([idx, text]) => (
                  <div key={idx} className="flex gap-2.5 text-sm" style={{ color: T.inkSoft }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-semibold"
                         style={{ background: T.errorSoft, color: T.error }}>
                      {String.fromCharCode(65 + parseInt(idx))}
                    </div>
                    <div className="leading-relaxed pt-0.5">{text}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Optional second-take explanation */}
          {q.alt_exp && (
            <Card className="p-4" style={{ background: T.primary + '10', border: `1px solid ${T.primary}40` }}>
              <div className="flex items-center gap-2 mb-2">
                <Brain size={14} style={{ color: T.primary }} />
                <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.primary }}>
                  Explained another way
                </div>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>
                {q.alt_exp}
              </div>
            </Card>
          )}

          {/* Back to index */}
          <Button onClick={() => setSelectedId(null)} variant="ghost"
                  className="w-full mt-5" icon={<ChevronLeft size={16} />}>
            Back to index
          </Button>
        </div>
      </div>
    );
  }

  // ===== INDEX PAGE: pure table of contents =====
  return (
    <div className="anim-fadeup">
      <TopBar title={`Bookmarks (${itemIds.size})`} onBack={onBack}
              feedback={{ screen: "Bookmarks" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">

        <div className="text-xs leading-relaxed mb-4 px-1" style={{ color: T.muted }}>
          Tap a question below to open it with its full answer and explanation.
        </div>

        {/* Topic filter chips — hidden when there's only one topic */}
        {availableTopics.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => setTopicFilter('all')}
                    className="no-tap-highlight px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: topicFilter === 'all' ? T.primary : T.surface,
                      color: topicFilter === 'all' ? '#FFF' : T.inkSoft,
                      border: `1px solid ${topicFilter === 'all' ? T.primary : T.border}`
                    }}>
              All <span style={{ opacity: 0.7 }}>· {itemIds.size}</span>
            </button>
            {availableTopics.map(tid => {
              const t = TOPICS.find(x => x.id === tid);
              const count = allBookmarked.filter(q => q.topic === tid).length;
              const active = topicFilter === tid;
              return (
                <button key={tid} onClick={() => setTopicFilter(tid)}
                        className="no-tap-highlight px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                        style={{
                          background: active ? (t?.color || T.primary) : T.surface,
                          color: active ? '#FFF' : T.inkSoft,
                          border: `1px solid ${active ? (t?.color || T.primary) : T.border}`
                        }}>
                  {t?.icon} {t?.name || tid} <span style={{ opacity: 0.7 }}>· {count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* The index itself: topic group → tappable rows */}
        <div className="space-y-4">
          {groupedByTopic.map((group, gi) => {
            const t = TOPICS.find(x => x.id === group.topic);
            return (
              <div key={group.topic}>
                <div className="flex items-center gap-1.5 mb-2 px-1 text-[11px] uppercase tracking-wider font-semibold"
                     style={{ color: t?.color || T.muted }}>
                  <span>{t?.icon}</span>
                  <span>{t?.name || group.topic}</span>
                  <span style={{ color: T.muted, fontWeight: 400 }}>· {group.questions.length}</span>
                </div>
                <Card className="overflow-hidden">
                  {group.questions.map((q, qi) => (
                    <button key={q.id}
                            onClick={() => setSelectedId(q.id)}
                            className="no-tap-highlight w-full text-left px-3 py-3 flex items-start gap-2.5 active:bg-black/5 transition-colors"
                            style={{
                              borderBottom: qi < group.questions.length - 1 ? `1px solid ${T.borderSoft}` : 'none'
                            }}>
                      <span className="text-[10px] flex-shrink-0 mt-1 font-mono tabular-nums"
                            style={{ color: T.muted }}>{(gi + 1)}.{(qi + 1).toString().padStart(2, '0')}</span>
                      <span className="text-sm leading-snug flex-1" style={{ color: T.ink }}>
                        {stemPreview(q.q)}
                      </span>
                      <ChevronRight size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.muted }} />
                    </button>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>

        {items.length === 0 && itemIds.size > 0 && (
          <div className="text-center py-10 text-sm" style={{ color: T.muted }}>
            No bookmarks in this topic — try another filter.
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// REVISION SHEET — read-only digest of bookmarks (+ optionally wrong)
// =====================================================================
const PRINT_STYLES = `
@media print {
  body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .revision-print-page { padding: 0 !important; max-width: 100% !important; }
  .revision-item { page-break-inside: avoid; break-inside: avoid; border: 1px solid #ddd !important; background: white !important; }
  /* Items collapsed on screen are hidden with .hidden; force every answer to
     print in full regardless of expand state. */
  .revision-item-content { display: block !important; }
}
`;

function RevisionSheet({ data, allQuestions, onLogVisit, onBack }) {
  const [includeWrong, setIncludeWrong] = useState(false);
  const [topicFilter, setTopicFilter] = useState('all');
  const [expanded, setExpanded] = useState({}); // qId -> bool
  const [allExpanded, setAllExpanded] = useState(true); // default to expanded for revision
  // null = live "Today" set; a 'YYYY-MM-DD' string = read-only snapshot from history.
  const [viewDate, setViewDate] = useState(null);

  const revisionLog = useMemo(() => Array.isArray(data.revisionLog) ? data.revisionLog : [], [data.revisionLog]);
  const todayKey = new Date().toLocaleDateString('en-CA');

  // The live (today) set: bookmarks, plus previously-wrong if toggled on.
  const liveIds = useMemo(() => {
    const ids = new Set(data.bookmarks || []);
    if (includeWrong) {
      Object.entries(data.history || {}).forEach(([qId, h]) => {
        // P15 — attemptStats.anyWrong correctly flags compacted records
        // whose pre-compaction history contained any wrong attempts.
        if (h && (h.lastResult === 'wrong' || attemptStats(h).anyWrong)) {
          ids.add(qId);
        }
      });
    }
    return ids;
  }, [data.bookmarks, data.history, includeWrong]);

  // Log today's visit once on open (with the current bookmark snapshot).
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    if (onLogVisit && (data.bookmarks || []).length > 0) {
      onLogVisit(data.bookmarks);
      loggedRef.current = true;
    }
  }, []); // mount only

  // Reset the topic filter when switching between live and a snapshot, since
  // the available topics differ.
  useEffect(() => { setTopicFilter('all'); }, [viewDate]);

  const snapshotEntry = viewDate ? revisionLog.find(e => e.date === viewDate) : null;
  const isSnapshot = !!snapshotEntry;

  // Active id set depends on mode.
  const itemIds = useMemo(() => {
    if (isSnapshot) return new Set(snapshotEntry.ids || []);
    return liveIds;
  }, [isSnapshot, snapshotEntry, liveIds]);

  const items = useMemo(() => {
    return allQuestions
      .filter(q => itemIds.has(q.id))
      .filter(q => topicFilter === 'all' || q.topic === topicFilter);
  }, [allQuestions, itemIds, topicFilter]);

  const groupedByTopic = useMemo(() => {
    const map = new Map();
    items.forEach(q => {
      if (!map.has(q.topic)) map.set(q.topic, []);
      map.get(q.topic).push(q);
    });
    return Array.from(map.entries()).map(([topic, qs]) => ({ topic, questions: qs }));
  }, [items]);

  const availableTopics = useMemo(() => {
    const set = new Set();
    allQuestions.filter(q => itemIds.has(q.id)).forEach(q => set.add(q.topic));
    return Array.from(set);
  }, [allQuestions, itemIds]);

  // Friendly relative date label for the history chips.
  const fmtDay = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((t - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  // Past visits (everything except today) — these become tappable snapshots.
  const pastVisits = revisionLog.filter(e => e.date !== todayKey);

  const isOpen = (qId) => expanded[qId] !== undefined ? expanded[qId] : allExpanded;
  const toggleOne = (qId) => setExpanded(e => ({ ...e, [qId]: !isOpen(qId) }));
  const expandAll = () => { setAllExpanded(true); setExpanded({}); };
  const collapseAll = () => { setAllExpanded(false); setExpanded({}); };
  const handlePrint = () => { if (typeof window !== 'undefined') window.print(); };

  // Generate full TTS text for one question
  const ttsTextFor = (q) => {
    const correctLetters = q.correct.map(i => String.fromCharCode(65 + i)).join(', ');
    return `Question: ${q.q}. Options: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}`).join('. ')}. Correct answer: ${correctLetters}. Explanation: ${q.exp}`;
  };

  return (
    <div className="anim-fadeup">
      <style>{PRINT_STYLES}</style>
      <div className="no-print">
        <TopBar title="Revision" onBack={onBack}
                feedback={{ screen: "Revision sheet" }} />
      </div>

      <div className="max-w-md mx-auto px-4 pb-24 pt-2 revision-print-page">

        <div className="no-print mb-5">
          {/* Intro + Print/PDF. Print/PDF now lives here in the body, clearly
              separated from the Report button (which stays in the top bar). */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="text-xs leading-relaxed flex-1 pt-1" style={{ color: T.muted }}>
              Everything visible at once for fast revision. Save or print it for offline study.
            </div>
            <button onClick={handlePrint}
                    className="no-tap-highlight flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold flex-shrink-0 active:scale-95 transition"
                    style={{ background: T.primary, color: '#FFF', boxShadow: `0 2px 8px ${T.primary}40` }}>
              <Printer size={14} />
              Print / PDF
            </button>
          </div>

          {/* Revision history — tap a past date to revisit that day's set */}
          {pastVisits.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2 px-0.5">
                <CalendarDays size={13} style={{ color: T.muted }} />
                <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Revision history</div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                <button onClick={() => setViewDate(null)}
                        className="no-tap-highlight flex-shrink-0 px-3 py-2 rounded-xl text-left transition active:scale-95"
                        style={{ background: !isSnapshot ? T.primary : T.surface,
                                 border: `1px solid ${!isSnapshot ? T.primary : T.border}`,
                                 color: !isSnapshot ? '#FFF' : T.ink }}>
                  <div className="text-xs font-semibold">Today</div>
                  <div className="text-[10px]" style={{ color: !isSnapshot ? 'rgba(255,255,255,0.8)' : T.muted }}>{liveIds.size} card{liveIds.size === 1 ? '' : 's'}</div>
                </button>
                {pastVisits.map(e => {
                  const active = viewDate === e.date;
                  const n = (e.ids || []).length;
                  return (
                    <button key={e.date} onClick={() => setViewDate(e.date)}
                            className="no-tap-highlight flex-shrink-0 px-3 py-2 rounded-xl text-left transition active:scale-95"
                            style={{ background: active ? T.primary : T.surface,
                                     border: `1px solid ${active ? T.primary : T.border}`,
                                     color: active ? '#FFF' : T.ink }}>
                      <div className="text-xs font-semibold whitespace-nowrap">{fmtDay(e.date)}</div>
                      <div className="text-[10px]" style={{ color: active ? 'rgba(255,255,255,0.8)' : T.muted }}>{n} card{n === 1 ? '' : 's'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Snapshot banner — shown when viewing a past day */}
          {isSnapshot && (
            <Card className="p-3 mb-3 flex items-center justify-between gap-3" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}26` }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock size={15} className="flex-shrink-0" style={{ color: T.primary }} />
                <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
                  Viewing your <span className="font-semibold" style={{ color: T.ink }}>{fmtDay(viewDate)}</span> revision set.
                </div>
              </div>
              <button onClick={() => setViewDate(null)}
                      className="no-tap-highlight text-xs font-semibold flex-shrink-0 px-2.5 py-1.5 rounded-lg active:scale-95"
                      style={{ background: T.primary, color: '#FFF' }}>
                Back to today
              </button>
            </Card>
          )}

          {/* Toggle wrong — only relevant in the live "Today" view */}
          {!isSnapshot && (
            <Card className="p-3 mb-3 cursor-pointer no-tap-highlight pressable" onClick={() => setIncludeWrong(v => !v)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: includeWrong ? T.accent + '20' : T.surfaceWarm }}>
                    <X size={16} style={{ color: includeWrong ? T.accent : T.muted }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: T.ink }}>Include previously-wrong</div>
                    <div className="text-xs" style={{ color: T.muted }}>Adds questions you've gotten wrong before</div>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                     style={{ background: includeWrong ? T.accent : T.border }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                       style={{ transform: includeWrong ? 'translateX(20px)' : 'translateX(0px)' }} />
                </div>
              </div>
            </Card>
          )}

          {/* Topic filter chips */}
          {availableTopics.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
              <button onClick={() => setTopicFilter('all')}
                      className="no-tap-highlight flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ background: topicFilter === 'all' ? T.primary : T.surface,
                               color: topicFilter === 'all' ? '#FFF' : T.ink,
                               border: `1px solid ${topicFilter === 'all' ? T.primary : T.border}` }}>
                All ({items.length})
              </button>
              {availableTopics.map(tid => {
                const count = allQuestions.filter(q => itemIds.has(q.id) && q.topic === tid).length;
                return (
                  <button key={tid} onClick={() => setTopicFilter(tid)}
                          className="no-tap-highlight flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
                          style={{ background: topicFilter === tid ? topicColor(tid) : T.surface,
                                   color: topicFilter === tid ? '#FFF' : T.ink,
                                   border: `1px solid ${topicFilter === tid ? topicColor(tid) : T.border}` }}>
                    <span>{topicIcon(tid)}</span>
                    {topicName(tid)} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Expand / collapse all */}
          {items.length > 0 && (
            <div className="flex gap-2 mb-1">
              <button onClick={expandAll}
                      className="no-tap-highlight flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                <ChevronDown size={12} /> Expand all
              </button>
              <button onClick={collapseAll}
                      className="no-tap-highlight flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                <ChevronUp size={12} /> Collapse all
              </button>
            </div>
          )}
        </div>

        {/* Print header (visible only in print) */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-display font-bold mb-1">NORCET Revision Sheet</h1>
          <div className="text-sm" style={{ color: T.muted }}>
            {items.length} questions
            {topicFilter !== 'all' && ` · ${topicName(topicFilter)}`}
            {!isSnapshot && includeWrong && ' · includes previously-wrong'}
            {isSnapshot && ` · saved ${fmtDay(viewDate)}`}
            {' · '}{new Date().toLocaleDateString()}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>
              {isSnapshot ? 'Nothing left from that day' : 'Nothing to revise yet'}
            </div>
            <div className="text-sm" style={{ color: T.muted }}>
              {isSnapshot
                ? 'The questions saved on this date are no longer in your banks.'
                : 'Bookmark questions during practice to build your revision sheet, or toggle "Include previously-wrong" above.'}
            </div>
          </div>
        ) : (
          groupedByTopic.map(group => (
            <div key={group.topic} className="mb-6">
              <div className="text-xs uppercase tracking-wider font-semibold mb-3 px-1 flex items-center gap-2"
                   style={{ color: topicColor(group.topic) }}>
                <span>{topicIcon(group.topic)}</span>
                <span>{topicName(group.topic)}</span>
                <span style={{ color: T.muted }}>· {group.questions.length}</span>
              </div>

              <div className="space-y-3">
                {group.questions.map((q, qi) => {
                  const open = isOpen(q.id);
                  return (
                    <Card key={q.id} className="revision-item overflow-hidden">
                      <div className="px-4 py-3" style={{ borderBottom: open ? `1px solid ${T.borderSoft}` : 'none' }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: T.muted }}>
                            <span>#{qi + 1}</span>
                            {q.sub && <span>· {q.sub}</span>}
                          </div>
                          <div className="no-print flex items-center gap-1.5">
                            <TTSButton text={ttsTextFor(q)} tone="ghost" />
                            <button onClick={() => toggleOne(q.id)} className="no-tap-highlight p-1 -m-1 rounded">
                              {open ? <ChevronUp size={16} style={{ color: T.muted }} /> : <ChevronDown size={16} style={{ color: T.muted }} />}
                            </button>
                          </div>
                        </div>
                        <div className="text-sm font-medium leading-snug" style={{ color: T.ink }}>{q.q}</div>
                      </div>

                      <div className={`revision-item-content px-4 py-3 ${open ? '' : 'hidden print:block'}`} style={{ background: T.bg }}>
                          <div className="space-y-1.5 mb-3">
                            {q.options.map((opt, i) => {
                              const isCorrect = q.correct.includes(i);
                              return (
                                <div key={i} className="flex items-start gap-2.5 text-sm">
                                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-semibold mt-0.5"
                                       style={{ background: isCorrect ? T.success : T.surfaceWarm,
                                                color: isCorrect ? '#FFF' : T.muted }}>
                                    {isCorrect ? <Check size={11} /> : String.fromCharCode(65 + i)}
                                  </div>
                                  <div className="leading-snug" style={{ color: isCorrect ? T.ink : T.inkSoft, fontWeight: isCorrect ? 500 : 400 }}>
                                    {opt}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="pt-3 mt-1 border-t" style={{ borderColor: T.borderSoft }}>
                            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Explanation</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.inkSoft }}>{q.exp}</div>
                          </div>

                          {q.wrong && Object.keys(q.wrong).length > 0 && (
                            <div className="pt-3 mt-3 border-t" style={{ borderColor: T.borderSoft }}>
                              <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Why the others are wrong</div>
                              <div className="space-y-1">
                                {Object.entries(q.wrong).map(([idx, text]) => (
                                  <div key={idx} className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                                    <span className="font-semibold">{String.fromCharCode(65 + parseInt(idx))}.</span> {text}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// =====================================================================
// WELCOME / ONBOARDING SCREEN
// =====================================================================
function WelcomeScreen({ displayName, onDismiss, onLaunch }) {
  // Each row is now a launchable shortcut. Tapping the card closes the
  // welcome screen and navigates straight to that mode — so the tour
  // doubles as a quick-start menu for first-time users.
  const items = [
    { icon: <Shuffle size={18} />,    title: 'Quick test',           desc: 'Fast questions with hints — start a quick round any time.',                color: LIGHT_THEME.sec.quick,    darkColor: DARK_THEME.sec.quick,    nav: { screen: 'quick-setup' } },
    { icon: <ListChecks size={18} />, title: 'Topic wise test',      desc: 'Focus on one subject at a time.',                                          color: LIGHT_THEME.sec.topic,    darkColor: DARK_THEME.sec.topic,    nav: { screen: 'topic-select' } },
    { icon: <Timer size={18} />,      title: 'Mock & Advanced Test', desc: 'Exam-realistic — no hints, real countdown, negative marking.',             color: LIGHT_THEME.sec.mock,     darkColor: DARK_THEME.sec.mock,     nav: { screen: 'mock-setup' } },
    { icon: <Brain size={18} />,      title: 'Learn topic wise',     desc: 'Bite-sized concept cards instead of passive video.',                       color: LIGHT_THEME.sec.learn,    darkColor: DARK_THEME.sec.learn,    nav: { screen: 'learn-topics' } },
    { icon: <FileText size={18} />,   title: 'Revision Sheet',       desc: 'Bookmarks digested into one printable page.',                              color: LIGHT_THEME.sec.revision, darkColor: DARK_THEME.sec.revision, nav: { screen: 'revision-sheet' } },
    { icon: <Layers size={18} />,     title: 'Question Bank Library',desc: 'Browse shared banks and import questions.',                                color: LIGHT_THEME.sec.library,  darkColor: DARK_THEME.sec.library,  nav: { screen: 'library' } }
  ];

  const handleTap = (nav) => {
    if (onLaunch) onLaunch(nav);
    else onDismiss();
  };

  return (
    <div className="anim-fadeup max-w-md mx-auto px-4 pt-8 pb-12">
      <div className="text-center mb-7">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
             style={{ background: T.primary }}>
          <GraduationCap size={28} color="#FFF" />
        </div>
        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: T.muted }}>Welcome{displayName ? `, ${displayName}` : ''}</div>
        <h1 className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Here's what's inside</h1>
        <div className="text-sm" style={{ color: T.muted }}>Tap any section to jump straight in. You can reopen this from Settings.</div>
      </div>

      <div className="space-y-2.5 mb-6">
        {items.map((it, i) => (
          <Card key={i} className="p-3.5 cursor-pointer no-tap-highlight pressable active:scale-[0.99] transition-transform"
                onClick={() => handleTap(it.nav)}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: (IS_DARK ? it.darkColor : it.color) + '18', color: IS_DARK ? it.darkColor : it.color }}>
                {it.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-semibold mb-0.5" style={{ color: T.ink }}>{it.title}</div>
                <div className="text-xs leading-snug" style={{ color: T.muted }}>{it.desc}</div>
              </div>
              <ChevronRight size={16} style={{ color: T.muted }} className="flex-shrink-0" />
            </div>
          </Card>
        ))}
      </div>

      <Button onClick={onDismiss} size="lg" className="w-full" icon={<Check size={18} />}>
        Got it
      </Button>
    </div>
  );
}

// =====================================================================
// FEEDBACK — small icon button + modal, on every main screen
// =====================================================================
// Module-level current-profile reference for FeedbackButton convenience.
// App sets this on every render so any TopBar can drop in a FeedbackButton.
let CURRENT_PROFILE = null;

// The Report modal is rendered once at the app root (FeedbackHost) so it sits
// outside any animated/transformed screen wrapper, keeping its `position: fixed`
// centering relative to the real viewport. Buttons anywhere request it through
// this tiny module-level channel rather than rendering their own copy.
let _openFeedback = null;
function requestFeedback(ctx) { if (_openFeedback) _openFeedback(ctx || {}); }

function FeedbackButton({ screen, questionId, profileId, profileName }) {
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

// Single modal instance, mounted at the app root. Listens for open requests and
// holds the current report context (which screen / question it was opened from).
function FeedbackHost() {
  const [ctx, setCtx] = useState(null); // null = closed
  useEffect(() => {
    _openFeedback = (c) => setCtx(c || {});
    return () => { _openFeedback = null; };
  }, []);
  if (!ctx) return null;
  return (
    <FeedbackModal screen={ctx.screen} questionId={ctx.questionId}
                   profileId={ctx.profileId} profileName={ctx.profileName}
                   onClose={() => setCtx(null)} />
  );
}

// =====================================================================
// HELP — a context-sensitive "what is this screen?" guide. Mirrors the
// Report button: present on every screen with a TopBar, opens a modal at
// the app root (so fixed-positioning isn't broken by transformed ancestors).
// =====================================================================
const HELP_CONTENT = {
  'Spaced revision': {
    title: 'Spaced revision',
    what: 'A reminder for questions the app thinks you’re about to forget. Each time you answer a question, its next review date gets calculated — sooner if you got it wrong, much later as you keep getting it right.',
    how: 'Tap the card to drill just the overdue questions. Tap the × to hide it for today (it returns tomorrow if you still have due work). To turn it off permanently, open Settings → Spaced revision reminders.',
    why: 'Spaced repetition is one of the best-proven ways to retain knowledge long-term. Reviewing right before you forget is far more effective than re-reading endlessly.'
  },

  'Learn — topics': {
    title: 'Learn topic wise',
    what: 'The theory side of the app — short concept cards grouped by topic and then by sub-module. Not a quiz. Each topic (Anatomy, Pharmacology, etc.) is broken into small modules like “Cardiovascular” or “Medication Safety”, and each module holds a handful of cards: concepts, mnemonics, key points and the occasional self-check.',
    how: 'Tap a topic row to expand its modules. From there, use the green Read button to read the whole topic top-to-bottom, or tap a single module to focus on just those few cards. You can collapse a topic by tapping it again.',
    why: 'Quizzes test what you know; Learn is where you pick up and revise the actual concepts. Skimming a few cards before a topic-wise quiz dramatically improves how much sticks afterwards.'
  },

  'Learn — cards': {
    title: 'Concept cards',
    what: 'A one-card-at-a-time reader. Cards come in four types: Concept (a short explanation), Mnemonic (a memory trick), Key Points (the must-know bullets) and Self-Check (a single question to test recall).',
    how: 'Swipe left/right, use the on-screen arrows, or use your keyboard arrow keys to move between cards. The dots below let you jump anywhere. On a Self-Check card, tap “Reveal answer” after you’ve formed your own answer in your head.',
    why: 'Reading something short and sharp on its own page — then trying to recall it — sticks far better than skimming a long page of notes. The Self-Check cards force active recall, which is what really builds memory.'
  },

  'Dosage calc': {
    title: 'Dosage calculation test',
    what: 'A focused drill for the numeric drug-math questions in NORCET — tablet counts, mL doses, mg/kg conversions, IV drip rates, infusion times. You type the answer rather than picking from options, so there’s nowhere to guess from.',
    how: 'Read the order carefully, type your numeric answer in the input and tap Check. If you’re stuck, Skip moves the question to later in the round; Show answer reveals the worked solution — neither hurts your accuracy stats since this is a learning drill. Each question has a worked explanation showing the formula and units.',
    why: 'Calculation questions use a totally different skill from multiple-choice — setting up the equation and getting units right — and they’re where people most often lose easy marks. A separate drill builds the reflex of “read, set up, calculate, double-check units”.'
  },

  'Reference': {
    title: 'Reference',
    what: 'A searchable lookup of lab values, vital signs, common drug doses, abbreviations and unit conversions. Think of it as a tiny clinical handbook built into the app — normal ranges, critical thresholds, and the everyday numbers that come up in questions.',
    how: 'Use the search bar at the top for a quick keyword (“haemoglobin”, “digoxin”) or tap a category to browse. Values flagged in red are critical/dangerous thresholds you should recognise on sight — they’re the ones examiners love to test.',
    why: 'During practice you’ll constantly need to check a number. Having it here means you don’t lose 5 minutes flipping through notes, and the repeated lookups gradually drill the values into memory.'
  },

  'Revision sheet': {
    title: 'Revision',
    what: 'A digest page that pulls together your bookmarked questions — and, if you choose, questions you’ve previously got wrong — into one clean, scrollable list with stems, correct answers and explanations all visible at once.',
    how: 'Toggle “Include wrong answers” at the top to add your past mistakes. Filter by topic to focus a single subject. The date list shows past revision sessions so you can re-open exactly what you revised on, say, last Tuesday. Tap Print / PDF to export it for offline study.',
    why: 'The last few days before an exam are not the time to read new material — they’re for re-reading what you already flagged as important. This is that cram sheet, built automatically from your own study history.'
  },

  'Bookmarks': {
    title: 'Bookmarks',
    what: 'An index of every question you’ve saved during practice, grouped by topic. It’s a fast lookup, not a quiz — each entry shows the question with its full answer and explanation so you can re-read without re-attempting.',
    how: 'Tap any entry to open it. To add a bookmark in the first place, tap the bookmark icon at the top-right of any question while you’re practising. To remove one, open the entry and tap the bookmark icon to un-save it.',
    why: 'Bookmarks become your personal “high-yield” list — the tricky questions, the ones with great explanations, the ones with mnemonics you want to re-read. Keeping them in one place means you actually revisit them.'
  },

  'Bookmark detail': {
    title: 'Bookmark',
    what: 'The full read-only view of one saved question. Shows the stem, all options with the correct answer highlighted in green, the full explanation and any “why the other options are wrong” notes.',
    how: 'Read it, or tap the speaker icon to listen to it being read aloud (useful while commuting or doing chores). Tap the bookmark icon to remove it from your saved list. Tap back to return to the bookmarks index.',
    why: 'A focused single-question view, optimised for re-reading and reflection — not for re-testing. The point of a bookmark is that you already attempted it; now you’re studying the explanation.'
  },

  'Exam date': {
    title: 'Exam date',
    what: 'The page where you tell the app when your NORCET (or similar) exam is. Once set, you get a countdown on the home screen, plus an automatic daily question target so you know whether you’re on pace.',
    how: 'Tap the date field and pick your exam date. Then choose how to set your daily target: “Decide for me” uses how many questions are left in your pool plus how many days remain to compute a sensible pace, while “I’ll pick” lets you set your own number per day. You can change either anytime.',
    why: 'A daily target turns a vague “I should study more” into a concrete “I need to finish 30 questions today.” Most people fall behind because they don’t track pace — this stops that quietly.'
  },

  'Stats': {
    title: 'Stats',
    what: 'Your progress dashboard. Total questions attempted, overall accuracy %, current streak, today’s count, plus a topic-by-topic breakdown showing accuracy and attempts for each subject.',
    how: 'Scroll through. The 14-day bar chart shows daily attempt counts so you can spot patterns (or gaps). The “By topic” list at the bottom is sorted alphabetically; each row’s accuracy bar makes weak vs strong subjects obvious at a glance.',
    why: 'Without data, prep feels vague — “I’m doing OK, I think.” With it, you know exactly which topics need more work and whether your accuracy is trending up. It also makes streaks feel earned rather than abstract.'
  },

  'Weak areas': {
    title: 'Weak areas',
    what: 'A focused list of every topic where your accuracy is currently below 80% (and where you’ve done enough questions for the number to mean something). Sorted worst-first, with a severity badge — Critical, Weak, or Shaky — so you know which to prioritise.',
    how: 'Each row has a Start button that launches a short 5-question drill on that topic, biased toward questions you’ve previously got wrong. Hints and Show answer are both available — this is for learning, not testing.',
    why: 'Most score improvements come from fixing the bottom 20% of your topics, not polishing the top. Spending 10 focused minutes on a Critical-rated topic shifts your overall accuracy noticeably faster than mixed practice.'
  },

  'Coverage map': {
    title: 'Coverage',
    what: 'How much of each topic’s questions you’ve attempted at least once — the breadth side of your prep, not the accuracy side. Each topic shows a progress bar, attempt count, and accuracy if you have one.',
    how: 'Tap any topic row to expand it and see its sub-topics broken down separately (e.g. Anatomy splits into Cardiovascular, Renal, etc.). Each row has a coloured Start button that launches a quiz scoped exactly to that level — whole topic from the topic row, or just that sub-topic from the sub-row.',
    why: 'It’s easy to keep revisiting the same comfortable topics and never touch the unfamiliar ones. Coverage makes the gaps visible — “0 / 28 in Pharmacology” is harder to ignore than a vague feeling that you should study more.'
  },

  'Quick practice setup': {
    title: 'Quick test',
    what: 'The setup screen for a casual, untimed quiz. You choose how many questions and which topic (or all topics mixed). No time pressure, no negative marking, and study aids (hints, Skip, Show answer) are all available during the quiz.',
    how: 'Pick a count using the chips (5, 10, 20, 50). Optionally pick a topic or leave it as All. Then tap Start. The questions are smart-selected: unseen ones first, then ones you’ve struggled with, so practice always feels fresh.',
    why: 'This is the everyday mode — something you can fit into 5 minutes between other things. The relaxed format encourages actually doing it, which compounds over weeks far more than occasional intense sessions.'
  },

  'Topic select': {
    title: 'Topic wise test',
    what: 'A page listing every subject you can drill, with each topic showing how many questions are in its pool. Tapping a topic immediately starts a quiz scoped only to that subject.',
    how: 'Scroll the list and tap a topic to start. The quiz uses the same rules as Quick test — untimed, with hints and Show answer available. Want to focus even tighter, on a sub-topic? Use Coverage instead and drill from there.',
    why: 'When you’re actively studying one topic (say, you read about Cardiovascular this morning), a topic-scoped quiz right after is the best way to lock it in. Mixed practice is good for retention; focused practice is good for learning new material.'
  },

  'Mock setup': {
    title: 'Mock test',
    what: 'The setup screen for a timed test that imitates exam pressure but still gives you instant feedback on each question. Sits between Quick test (no pressure, all aids) and Advanced test (full exam, no feedback).',
    how: 'Pick how many questions, then how long — Sprint (30s/Q), Normal (1 min/Q), Relaxed (90s/Q), or a custom number of minutes. During the test, the timer counts down; Skip is allowed so you can defer hard questions; Show answer is disabled to keep things honest. Auto-submits when time runs out.',
    why: 'Real exams have a clock. Practising under a clock teaches you when to commit to an answer and move on — a separate skill from knowing content. Mock builds that pacing without going to the full no-feedback rigour of Advanced.'
  },

  'Advanced test setup': {
    title: 'Advanced test',
    what: 'The most exam-realistic mode in the app. Unlike Mock test (where you check each answer one at a time), Advanced test runs like the real NORCET: 50 or 100 questions, no instant feedback, a question palette to jump around, and negative marking (−⅓ per wrong answer).',
    how: 'Choose 50 or 100 questions, pick a difficulty if you want to focus, optionally restrict to past-year questions (PYQ), set a time limit, then tap Start. During the test you can flag questions and revisit them via the palette before submitting.',
    why: 'To rehearse the full exam experience — pacing, second-guessing, deciding when to skip a hard question rather than waste time. That mental conditioning is as important as knowing the content.'
  },

  'Advanced test results': {
    title: 'Test results',
    what: 'Your score and full breakdown from the Advanced test you just finished. Shows net score (after negative marking), per-topic accuracy, time spent per question, and a question-by-question review with explanations.',
    how: 'Scroll the topic breakdown to find your weakest sections — those are where the next study session should focus. Tap any question to see what you picked, the correct answer, and the explanation. Bookmark the ones you want to re-read later.',
    why: 'The score itself is just a number. The real value of a full test is in the review afterwards — understanding why you got specific questions wrong is where the lift in your next score comes from.'
  },

  // ===== Active quiz screens (dynamic IDs Quiz · {mode}) =====
  'Quiz': {
    title: 'Quiz',
    what: 'The active question screen. Each card shows one question — the stem at the top, options below, and any topic / type tags. Your job: read the stem carefully, pick the option(s) you think are right, then tap Check answer.',
    how: 'Tap an option to select it. For multi-select questions (marked “Multi-select” in the tag row) you can pick more than one. Use the bookmark icon at the top to save a question for later review. Skip and Show answer (where available) sit above the main Check button.',
    why: 'Active recall — answering questions yourself, not reading the answer first — is the single most-proven way to make information stick. Even getting one wrong builds the memory more than re-reading would.'
  },

  'Quiz · quick': {
    title: 'Quick test in progress',
    what: 'A casual, untimed quiz drawn from your practice pool. Hints, Skip and Show answer are all available, and a wrong answer just shows the explanation rather than penalising you.',
    how: 'Pick an option and tap Check. If a Hint button is visible, tap it for a nudge before answering — it doesn’t affect your score. Stuck? Show answer reveals the correct option and the explanation (it does count as wrong, so the question reappears later for review). Skip moves a question to the end of the round so you can come back to it.',
    why: 'No timer, no negative marking — this mode is for learning, not for measuring your exam score. The freedom to use hints and reveal answers means you spend more time understanding why something is right, instead of guessing under pressure.'
  },

  'Quiz · mock': {
    title: 'Mock test in progress',
    what: 'A timed quiz that mimics exam pressure. A countdown timer runs at the top of the screen and turns red in the final minute; the test auto-submits when it hits zero.',
    how: 'Pick an answer and Check. Skip is available — it defers a question to the end of the round, useful for tough ones you want to come back to. Show answer is disabled here on purpose; if you don’t know, just pick your best guess and move on. The timer keeps running whether you’re reading the explanation or not, so don’t linger.',
    why: 'Exams aren’t lost on content gaps — they’re lost on running out of time. Practising under a real clock teaches your brain when to commit and move on, which is a separate skill from knowing the material.'
  },

  'Quiz · topic': {
    title: 'Topic-wise test in progress',
    what: 'A focused drill on a single subject. The question pool is filtered to only that topic, so every question reinforces what you’re currently studying.',
    how: 'Same controls as Quick test — pick an answer, optionally Skip or Show answer, use hints if shown. Read the explanation carefully after each one; topic-focused practice is most useful when you actually digest the explanation, not just the answer.',
    why: 'When you’ve just read a textbook chapter on, say, Cardiovascular, doing 10 questions on Cardiovascular right after is far more useful than mixed practice. Topic drills are where new material gets locked in before it slips away.'
  },

  'Quiz · bookmarks': {
    title: 'Bookmarks quiz',
    what: 'A quiz built entirely from questions you’ve bookmarked — the ones you previously flagged as important. The pool depends on what you’ve saved over time.',
    how: 'Work through them like any other quiz. If you can now answer one confidently and don’t need to revisit it, tap the bookmark icon to remove it from your saved list. Bookmarks you keep will come back next time you run this mode.',
    why: 'Re-testing the questions you flagged closes the loop — it tells you whether the concept actually stuck, or whether it’s still wobbly and needs another revision. A clean bookmark list is one you can trust.'
  },

  'Quiz · review-due': {
    title: 'Spaced revision quiz',
    what: 'A quiz of questions the app thinks you’re about to forget. Each question has a “next due” date set by the spaced-repetition engine; this mode pulls the ones whose date has passed.',
    how: 'Answer the questions as you normally would. Getting one right pushes its next review further out (e.g. 7 days → 14 days → 30 days). Getting one wrong brings it back to tomorrow. The goal is to keep the queue manageable — ideally clear it daily.',
    why: 'Forgetting is exponential: you lose most of what you learnt within a week unless you review. Spaced repetition slots a review right before the forgetting curve dives — the most efficient way to retain knowledge long-term.'
  },

  'Quiz · wrong': {
    title: 'Wrong-answer review',
    what: 'A quiz of questions you’ve previously got wrong. The pool is built from your attempt history — every wrong answer earns a question a place in this queue.',
    how: 'Work through them again. Getting one right this time doesn’t erase the past wrong attempt — your history records both — but it does show real improvement, and the question won’t reappear here again unless you get it wrong again later.',
    why: 'Your mistakes are the highest-yield study material you have. They’re hand-picked by your own brain as things you don’t know yet. Targeting them directly is far more efficient than random practice.'
  },

  'Quiz · weak-topic': {
    title: 'Weak-area drill',
    what: 'A focused mini-drill, launched from the Weak Areas screen, on a topic where your accuracy is below 80%. Just 5 questions per drill, biased toward ones you’ve previously got wrong in that topic.',
    how: 'Pick an answer, optionally Skip or Show answer. Hints stay visible — this is a learning drill, not an exam. After 5 questions you’re back at the Weak Areas list and can either drill the same topic again or move to the next weakest one.',
    why: 'Five questions sounds small, but a focused mini-drill on one weak topic moves your accuracy on that topic faster than 30 mixed questions — because every one of those 5 is high-yield material your stats already identified as a gap.'
  },

  'Library': {
    title: 'Library',
    what: 'A directory of question banks — collections of questions you can add to your practice pool. Banks can be public (anyone can use them) or private (only the person who uploaded them sees them). Each bank shows its name, owner, version and question count.',
    how: 'Use the filter chips at the top to switch between All / Mine / From others. Tap a bank to see its full details. Tap “Upload a new bank” at the top to create your own. Once you’ve imported a bank, you can pause it any time to remove its questions from practice without deleting your progress.',
    why: 'The Library lets you customise the question set beyond what’s built in — import a friend’s bank for an upcoming test, build your own from your notes, or pause one that’s not relevant right now. It’s how the app stays useful as your needs change.'
  },

  'Bank detail': {
    title: 'Question bank',
    what: 'The detail page for one question bank. Shows the name, description, version, who uploaded it, and a preview of every question inside. If you’ve already imported the bank, you also see a toggle to pause/resume its questions in your practice pool.',
    how: 'Scroll the preview to see what’s inside before importing. Tap “Import” to add the bank’s questions to your pool (they’ll show up in Quick test, topic drills, mocks, everywhere). If you’ve already imported it, use the toggle to pause without deleting — your progress on those questions is kept.',
    why: 'Importing without seeing the contents is risky — you might end up with bad or low-quality questions in your pool. This page is the “try before you commit” step, plus the on-off switch for when a bank stops being useful.'
  },

  'Bank editor': {
    title: 'Question set editor',
    what: 'Where you create a new question bank or edit one you already own. Banks have a name, description, visibility setting (private or public), and a list of questions you paste in as JSON.',
    how: 'Fill in the name and description, paste your questions into the JSON box (an example is shown to copy the format), tap Check questions to see how many parsed successfully, then save. The visibility toggle decides whether only you see it or everyone in the app can.',
    why: 'For building your own custom sets — questions from your college’s notes, a friend’s tough collection, or anything not covered by the built-in pool. Sharing publicly means others can benefit too.'
  },

  'Add question': {
    title: 'Add a question',
    what: 'A form to add a single question to your personal practice pool. You write the stem, 4 options, mark the correct one(s), pick a topic and difficulty, and write a short explanation that’ll show after the user answers.',
    how: 'Fill in the fields top to bottom. For multi-correct questions, tick more than one option. The Explanation field is the most important: it’s what you’ll read when you (or your future self) re-encounter the question. Save when done.',
    why: 'Writing your own questions — from notes, lecture slides or textbook problems — is a powerful way to study: you have to actually understand the material to phrase a good distractor. Then you get to drill it later like any other question.'
  },

  'Feedback inbox': {
    title: 'My reports',
    what: 'A list of every bug report and suggestion you’ve submitted via the Report button, with the admin’s reply status next to each one. New replies show a coloured badge so you don’t miss them.',
    how: 'Tap a report to read its full thread — your original message and any reply. Once you’ve seen a reply, the badge goes away. Reports stay here permanently so you can refer back later.',
    why: 'Reporting a wrong answer or a confusing UI is only useful if you can see what happens next. This is the loop — you tell the admin, the admin replies, and you know.'
  },

  'Settings': {
    title: 'Settings',
    what: 'Where everything app-wide lives: your profile (rename, log out, switch user), data (backup, restore, reset progress), appearance (light / dark mode), reminders (spaced revision on / off), and admin tools if you’re the admin.',
    how: 'Scroll to the section you want and tap the relevant control. Toggles like dark mode flip immediately. Destructive actions (reset progress, log out) ask for confirmation before doing anything. Your profile card at the top is tappable to rename yourself.',
    why: 'One predictable place for all the meta-app stuff, so the main study screens stay focused on practice. If you can’t find a setting, it’s here.'
  }
};

let _openHelp = null;
function requestHelp(ctx) { if (_openHelp) _openHelp(ctx || {}); }

function HelpButton({ screen }) {
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

function HelpHost() {
  const [ctx, setCtx] = useState(null); // null = closed
  useEffect(() => {
    _openHelp = (c) => setCtx(c || {});
    return () => { _openHelp = null; };
  }, []);
  if (!ctx) return null;
  return <HelpModal screen={ctx.screen} onClose={() => setCtx(null)} />;
}

function HelpModal({ screen, onClose }) {
  // Lookup order:
  //   1. Exact match (e.g. "Coverage map", "Quiz · quick")
  //   2. Strip the "(empty)" suffix used for empty-state screens
  //   3. Fall back to the generic "Quiz" entry for any Quiz · {mode} we
  //      haven't specifically documented yet
  //   4. Last-resort generic placeholder
  const lookup = (key) => HELP_CONTENT[key];
  let c = lookup(screen);
  if (!c && typeof screen === 'string') {
    const noEmpty = screen.replace(/\s*\(empty\)\s*$/, '');
    if (noEmpty !== screen) c = lookup(noEmpty);
    if (!c && noEmpty.startsWith('Quiz · ')) c = lookup('Quiz');
  }
  if (!c) c = {
    title: 'Help',
    what: 'This is one of the app\u2019s sections.',
    how: 'Explore the controls on screen — they\u2019re labelled to guide you.',
    why: 'Everything here is built to help you prepare efficiently.'
  };
  const sections = [
    { label: 'What it is', icon: <Lightbulb size={13} />, text: c.what },
    { label: 'How to use it', icon: <ListChecks size={13} />, text: c.how },
    { label: 'Why it\u2019s here', icon: <Sparkles size={13} />, text: c.why }
  ];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <Card className="w-full max-w-md anim-scalein max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '15' }}>
                <HelpCircle size={17} style={{ color: T.primary }} />
              </span>
              <div className="font-display text-lg font-semibold truncate" style={{ color: T.ink }}>{c.title}</div>
            </div>
            <button onClick={onClose} className="no-tap-highlight p-1.5 -m-1.5 rounded-lg active:bg-black/5 flex-shrink-0">
              <X size={18} style={{ color: T.muted }} />
            </button>
          </div>
          <div className="text-[11px] mb-4 px-0.5" style={{ color: T.muted }}>A quick guide to this screen</div>

          <div className="space-y-4">
            {sections.map(s => (
              <div key={s.label}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: T.primary }}>{s.icon}</span>
                  <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>{s.label}</div>
                </div>
                <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{s.text}</div>
              </div>
            ))}
          </div>

          <button onClick={onClose}
                  className="no-tap-highlight w-full mt-5 py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                  style={{ background: T.primary, color: '#FFF' }}>
            Got it
          </button>
        </div>
      </Card>
    </div>
  );
}

// The rename-profile modal follows the same app-root pattern as FeedbackHost.
// Why: Settings is rendered inside an `anim-fadeup` wrapper whose final
// keyframe leaves a `transform: translateY(0)` on the element. Any
// `position: fixed` child of a transformed ancestor positions relative to
// THAT ancestor, not the viewport — which causes the dim overlay to render
// over the screen while the modal itself sits where the centering math
// doesn't actually centre it. Result: a "frozen" page with a dim layer that
// blocks taps. Hoisting the modal up to the app root (no transformed
// ancestors) restores viewport-relative fixed positioning.
let _openRename = null;
function requestRename(ctx) { if (_openRename) _openRename(ctx || {}); }

function RenameProfileHost() {
  const [ctx, setCtx] = useState(null); // null = closed; otherwise { profile, onRename }
  useEffect(() => {
    _openRename = (c) => setCtx(c || null);
    return () => { _openRename = null; };
  }, []);
  if (!ctx || !ctx.profile) return null;
  return (
    <RenameProfileModal
      profile={ctx.profile}
      onRename={ctx.onRename}
      onClose={() => setCtx(null)}
    />
  );
}

function RenameProfileModal({ profile, onRename, onClose }) {
  const [value, setValue] = useState(profile.displayName || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const trimmed = value.trim();
  const newId = normalizeProfileId(trimmed);
  const idCleared = trimmed && !newId;

  const close = () => { if (!busy) onClose(); };

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!trimmed) { setError('Enter a display name'); return; }
    if (!newId) { setError('Name needs at least one letter or number'); return; }
    if (trimmed === profile.displayName) { onClose(); return; }
    setBusy(true);
    try {
      await onRename(trimmed);
      setBusy(false);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not rename');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={close}>
      <Card className="w-full max-w-md anim-scalein"
            onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Rename profile</div>
            <button onClick={close}
                    className="no-tap-highlight p-1.5 -m-1.5 rounded-lg active:bg-black/5"
                    disabled={busy}>
              <X size={18} style={{ color: T.muted }} />
            </button>
          </div>

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
            New name
          </div>
          <input value={value}
                 onChange={e => setValue(e.target.value)}
                 autoCapitalize="words"
                 autoComplete="off"
                 placeholder="Your name"
                 className="w-full rounded-xl px-3 py-3 mb-3 text-sm"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />

          {/* Warning panel — always make clear this IS the new login name.
              The user is renaming for a reason; we don't want copy that
              suggests the rename "doesn't really" change anything. */}
          <Card className="p-3 mb-3"
                style={{ background: T.accent + '12', border: `1px solid ${T.accent}40` }}>
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5"
                           style={{ color: T.accent }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                <span className="font-semibold" style={{ color: T.accent }}>You'll log in with this new name from now on.</span>{' '}
                Make sure you remember it — your password and date of birth are unchanged.
              </div>
            </div>
          </Card>

          {idCleared && (
            <div className="text-xs mb-3 px-1" style={{ color: T.error }}>
              Needs at least one letter or number.
            </div>
          )}
          {error && (
            <div className="text-xs mb-3 px-1" style={{ color: T.error }}>{error}</div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={close} disabled={busy} className="flex-1">Cancel</Button>
            <Button onClick={submit}
                    disabled={busy || !trimmed || !newId || trimmed === profile.displayName}
                    className="flex-1"
                    icon={busy ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FeedbackModal({ screen, questionId, profileId, profileName, onClose }) {
  const [report, setReport] = useState('');
  const [fix, setFix] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!report.trim()) { setErr('Please describe the issue or suggestion'); return; }
    setSubmitting(true);
    try {
      const id = newFeedbackId();
      await saveFeedback({
        id,
        ts: Date.now(),
        screen: screen || 'unknown',
        questionId: questionId || null,
        report: report.trim(),
        fix: fix.trim() || null,
        profileId: profileId || null,
        profileName: profileName || null
      });
      // Point the author's own index at this report so their device can find it
      // without ever fetching anyone else's feedback.
      if (profileId) await addToMyFeedbackIndex(profileId, id);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setErr('Could not send. Try again.');
      setSubmitting(false);
    }
  };

  // This modal is rendered at the APP ROOT (see <FeedbackHost/> in App), not
  // inside a screen. Screen wrappers carry an `anim-fadeup` animation whose
  // `both` fill-mode leaves a lingering `transform`, and a transformed ancestor
  // makes `position: fixed` anchor to THAT element instead of the viewport —
  // which dropped this modal into the middle of the (tall) page and cropped it.
  // Rendering at the root (no transformed ancestor) restores true
  // viewport-relative centering, the same trick the nav drawer uses.
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
           className="w-full max-w-md anim-scalein flex flex-col rounded-2xl overflow-hidden"
           style={{
             background: T.surface,
             border: `1px solid ${T.border}`,
             maxHeight: 'min(88dvh, 660px)',
             boxShadow: '0 12px 40px rgba(0,0,0,0.25)'
           }}>
        {done ? (
          <div className="text-center px-6 py-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                 style={{ background: T.successSoft }}>
              <Check size={24} style={{ color: T.success }} />
            </div>
            <div className="font-display text-lg font-semibold mb-1" style={{ color: T.ink }}>Sent</div>
            <div className="text-sm" style={{ color: T.muted }}>Thanks — the admin will see it.</div>
          </div>
        ) : (
          <>
            {/* Pinned header — always visible */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Report or suggest</div>
              <button onClick={onClose} className="no-tap-highlight p-1.5 -m-1.5 rounded-lg active:bg-black/5" aria-label="Close">
                <X size={18} style={{ color: T.muted }} />
              </button>
            </div>

            {/* Scrollable body — the form scrolls here if it's taller than the sheet */}
            <div className="px-5 overflow-y-auto overscroll-contain flex-1 min-h-0"
                 style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="mb-4 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 text-xs"
                   style={{ background: T.surfaceWarm, color: T.muted }}>
                <span>From:</span>
                <span className="font-medium" style={{ color: T.inkSoft }}>{screen || 'unknown'}</span>
                {questionId && (<><span>·</span><span className="font-mono">{questionId}</span></>)}
              </div>

              <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                Report a bug or suggest a feature <span style={{ color: T.error }}>*</span>
              </div>
              <textarea value={report} onChange={e => setReport(e.target.value)}
                        placeholder="What's wrong, or what would you like?" rows={4}
                        className="w-full rounded-xl px-3 py-3 mb-4 text-sm resize-none"
                        style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }} />

              <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                Your suggested fix <span className="font-normal normal-case">(optional)</span>
              </div>
              <textarea value={fix} onChange={e => setFix(e.target.value)}
                        placeholder="How should it work instead?" rows={3}
                        className="w-full rounded-xl px-3 py-3 mb-2 text-sm resize-none"
                        style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }} />

              {err && (
                <div className="text-xs mb-2 px-1" style={{ color: T.error }}>{err}</div>
              )}
            </div>

            {/* Pinned footer — actions always reachable */}
            <div className="flex gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
              <Button onClick={submit} disabled={submitting || !report.trim()} className="flex-1"
                      icon={submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}>
                {submitting ? 'Sending' : 'Send'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// FEEDBACK INBOX — admin only
// =====================================================================
function FeedbackInbox({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const list = await listFeedback();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const remove = async (id) => {
    await deleteFeedback(id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Feedback inbox" onBack={onBack}
              feedback={{ screen: "Feedback inbox" }}
              right={
                <button onClick={refresh} disabled={loading}
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                  <RefreshCw size={18} style={{ color: T.muted }} className={loading ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>No reports yet</div>
            <div className="text-sm" style={{ color: T.muted }}>Users can tap the report icon on any screen.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(it => {
              const date = new Date(it.ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
              return (
                <Card key={it.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill bg={T.primary + '18'} color={T.primary}>{it.screen}</Pill>
                      {it.questionId && <Pill bg={T.surfaceWarm} color={T.inkSoft}>Q: {it.questionId}</Pill>}
                      {it.profileName && <Pill bg={T.accent + '15'} color={T.accent}>{it.profileName}</Pill>}
                    </div>
                    <button onClick={() => remove(it.id)} className="no-tap-highlight p-1 -m-1 flex-shrink-0">
                      <Trash2 size={14} style={{ color: T.error }} />
                    </button>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed mb-2" style={{ color: T.ink }}>{it.report}</div>
                  {it.fix && (
                    <div className="text-xs whitespace-pre-wrap leading-relaxed pt-2 mt-1 border-t" style={{ color: T.inkSoft, borderColor: T.borderSoft }}>
                      <span className="font-semibold" style={{ color: T.muted }}>Suggested fix: </span>{it.fix}
                    </div>
                  )}
                  <div className="text-[10px] mt-2" style={{ color: T.muted }}>{date}</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// ADMIN PANEL — single hub for all shared/structural controls.
//   Visible ONLY when admin mode is unlocked. Gathers: overview counts,
//   bank management, announcements, user overview, and feedback.
//   Privacy: the user overview reads only the lightweight directory — it
//   never exposes any user's answers, progress, or password.
// =====================================================================
function fmtWhen(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// =====================================================================
// MY REPORTS — a user's own submitted feedback + any admin reply/status.
//   Reads only the user's own entries. A "New" marker shows when a reply
//   has arrived since the user last looked.
// =====================================================================
function MyReports({ reports, loading, seenMap, onRefresh, onBack }) {
  // Snapshot the "seen" map on entry so replies that are new on arrival stay
  // highlighted for this visit, even after the app marks them acknowledged.
  const seenSnapshot = useRef(seenMap || {});

  return (
    <div className="anim-fadeup">
      <TopBar title="My feedback" onBack={onBack}
              right={
                <button onClick={onRefresh} disabled={loading}
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                  <RefreshCw size={18} style={{ color: T.muted }} className={loading ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
          Reports and suggestions you've sent, newest first, with any reply from the admin.
        </div>

        {loading && reports.length === 0 ? (
          <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : reports.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-0.5" style={{ color: T.ink }}>Nothing yet</div>
            <div className="text-sm" style={{ color: T.muted }}>
              Tap the report icon at the top of any screen to send a bug or idea.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(r => {
              const meta = feedbackStatusMeta(r.status);
              const hasResponse = !!(r.reply || meta);
              const isNew = hasResponse && r.repliedAt && r.repliedAt > (seenSnapshot.current[r.id] || 0);
              const sent = new Date(r.ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
              return (
                <Card key={r.id} className="p-4"
                      style={isNew ? { border: `1.5px solid ${T.primary}66` } : {}}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill bg={T.primary + '18'} color={T.primary}>{r.screen}</Pill>
                      {r.questionId && <Pill bg={T.surfaceWarm} color={T.inkSoft}>Q: {r.questionId}</Pill>}
                    </div>
                    {isNew && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                            style={{ background: T.primary, color: '#FFF' }}>New</span>
                    )}
                  </div>

                  <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: T.ink }}>{r.report}</div>
                  {r.fix && (
                    <div className="text-xs whitespace-pre-wrap leading-relaxed mt-1.5" style={{ color: T.muted }}>
                      <span className="font-semibold">Your suggested fix: </span>{r.fix}
                    </div>
                  )}
                  <div className="text-[10px] mt-2" style={{ color: T.muted }}>Sent {sent}</div>

                  {/* Admin response */}
                  {hasResponse ? (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Admin response</span>
                        {meta && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: meta.color, color: '#FFF' }}>{meta.label}</span>
                        )}
                      </div>
                      {r.reply && (
                        <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: T.inkSoft }}>{r.reply}</div>
                      )}
                      {r.repliedAt && (
                        <div className="text-[10px] mt-1.5" style={{ color: T.muted }}>Replied {fmtWhen(r.repliedAt)}</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t flex items-center gap-1.5" style={{ borderColor: T.borderSoft }}>
                      <Hourglass size={12} style={{ color: T.muted }} />
                      <span className="text-xs" style={{ color: T.muted }}>Awaiting a reply</span>
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

// A large, thumb-friendly dashboard tile. Shows an icon, a label, and a single
// glanceable signal (a count or a badge) — nothing more.
function AdminTile({ icon, accent, label, hint, signal, onClick, wide }) {
  return (
    <button onClick={onClick}
            className={`no-tap-highlight text-left rounded-2xl p-5 active:scale-[0.98] transition-transform ${wide ? 'col-span-2' : ''}`}
            style={{ background: T.surface, border: `1px solid ${T.border}`, minHeight: 132 }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
             style={{ background: accent + '18' }}>
          {icon}
        </div>
        {signal}
      </div>
      <div className="font-display text-base font-semibold leading-tight" style={{ color: T.ink }}>{label}</div>
      {hint && (
        <div className="text-xs mt-0.5 overflow-hidden"
             style={{
               color: T.muted,
               display: '-webkit-box',
               WebkitLineClamp: 2,
               WebkitBoxOrient: 'vertical'
             }}>
          {hint}
        </div>
      )}
    </button>
  );
}

// One feedback report in the admin inbox, with inline reply + status controls.
// Look up a reported question by id in the built-in pools. Bank/custom
// questions aren't loaded in the admin panel, so those return null and the
// modal shows a graceful "not in the built-in pool" note.
function lookupReportedQuestion(id) {
  if (!id) return null;
  const mcq = SEED_QUESTIONS.find(q => q.id === id);
  if (mcq) return { kind: 'mcq', q: mcq };
  const dose = DOSAGE_QUESTIONS.find(q => q.id === id);
  if (dose) return { kind: 'dose', q: dose };
  return null;
}

// Read-only popup so an admin can see exactly what a reported question says —
// stem, options (correct ones marked), and the explanation — without leaving
// the feedback inbox. Rendered as a sibling of the anim-fadeup wrapper so its
// position:fixed anchors to the viewport.
function ReportedQuestionModal({ questionId, onClose }) {
  if (!questionId) return null;
  const found = lookupReportedQuestion(questionId);
  const q = found ? found.q : null;
  const correctSet = found && found.kind === 'mcq' ? new Set(q.correct || []) : null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md mx-auto flex flex-col anim-scalein rounded-t-3xl sm:rounded-3xl overflow-hidden"
           style={{ background: T.bg, maxHeight: '88vh', border: `1px solid ${T.border}` }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
             style={{ borderBottom: `1px solid ${T.borderSoft}`, background: T.surface }}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} style={{ color: T.primary }} />
            <div className="min-w-0">
              <div className="font-display text-base font-semibold leading-tight" style={{ color: T.ink }}>Reported question</div>
              <div className="text-[11px] truncate font-mono" style={{ color: T.muted }}>{questionId}</div>
            </div>
          </div>
          <button onClick={onClose} className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
            <X size={20} style={{ color: T.muted }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {!found ? (
            <div className="text-center py-10">
              <AlertCircle size={34} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.4 }} />
              <div className="text-sm font-medium" style={{ color: T.inkSoft }}>Not in the built-in pool</div>
              <div className="text-xs mt-1.5 leading-relaxed max-w-xs mx-auto" style={{ color: T.muted }}>
                This is likely a custom or question-bank item (or a screen with no specific question). Open the relevant bank from Library to review it.
              </div>
            </div>
          ) : found.kind === 'mcq' ? (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Pill bg={T.primary + '15'} color={T.primary}>{q.correct && q.correct.length > 1 ? 'Multi-answer' : 'Single answer'}</Pill>
                {q.sub && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.sub}</Pill>}
                {q.difficulty && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.difficulty}</Pill>}
                {q.source && <Pill bg={T.accent + '15'} color={T.accent}>{q.source}</Pill>}
              </div>
              <div className="font-display text-base leading-snug mb-3" style={{ color: T.ink }}>{q.q}</div>
              <div className="mb-4">
                {q.options.map((opt, i) => {
                  const correct = correctSet.has(i);
                  return (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl mb-1.5"
                         style={{ background: correct ? T.success + '14' : T.surface,
                                  border: `1px solid ${correct ? T.success + '55' : T.border}` }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-semibold"
                           style={{ background: correct ? T.success : T.surfaceWarm, color: correct ? '#FFF' : T.muted }}>
                        {correct ? <Check size={12} /> : String.fromCharCode(65 + i)}
                      </div>
                      <div className="text-sm leading-snug flex-1" style={{ color: T.ink }}>{opt}</div>
                    </div>
                  );
                })}
              </div>
              {q.exp && (
                <div className="rounded-xl p-3 mb-3" style={{ background: T.primary + '10', border: `1px solid ${T.primary}26` }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: T.muted }}>Explanation</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{q.exp}</div>
                </div>
              )}
              {q.wrong && Object.keys(q.wrong).length > 0 && (
                <div className="rounded-xl p-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: T.muted }}>Why the distractors are wrong</div>
                  <div className="space-y-1.5">
                    {Object.keys(q.wrong).map(k => (
                      <div key={k} className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                        <span className="font-semibold" style={{ color: T.muted }}>{String.fromCharCode(65 + Number(k))}: </span>{q.wrong[k]}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Pill bg={T.primary + '15'} color={T.primary}>Dosage</Pill>
                {q.type && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.type}</Pill>}
              </div>
              <div className="font-display text-base leading-snug mb-3" style={{ color: T.ink }}>{q.q}</div>
              <div className="rounded-xl p-3 mb-3 flex items-baseline justify-between gap-3"
                   style={{ background: T.success + '14', border: `1px solid ${T.success}40` }}>
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Correct answer</span>
                <span className="font-display text-lg font-semibold tabular-nums" style={{ color: T.ink }}>{q.answer} {q.unit}</span>
              </div>
              {Array.isArray(q.steps) && (
                <div className="rounded-xl p-3 mb-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: T.muted }}>Worked solution</div>
                  <ol className="space-y-1.5">
                    {q.steps.map((s, i) => (
                      <li key={i} className="text-xs leading-relaxed font-mono" style={{ color: T.ink }}>{i + 1}. {s}</li>
                    ))}
                  </ol>
                </div>
              )}
              {q.intuition && (
                <div className="rounded-xl p-3" style={{ background: T.accent + '12', border: `1px solid ${T.accent}2E` }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: T.muted }}>Why it works</div>
                  <div className="text-sm leading-relaxed" style={{ color: T.ink }}>{q.intuition}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminFeedbackCard({ item, onSaveReply, onDelete, onPeek }) {
  const [reply, setReply] = useState(item.reply || '');
  const [status, setStatus] = useState(item.status || null);
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const date = new Date(item.ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  const dirty = (reply.trim() !== (item.reply || '')) || (status !== (item.status || null));

  const save = async () => {
    setBusy(true);
    await onSaveReply(item, { reply: reply.trim() || null, status: status || null });
    setBusy(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1500);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill bg={T.primary + '18'} color={T.primary}>{item.screen}</Pill>
          {item.questionId && (
            <button onClick={() => onPeek && onPeek(item.questionId)}
                    className="no-tap-highlight inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium active:scale-95 transition"
                    style={{ background: T.primary + '12', color: T.primary, border: `1px solid ${T.primary}33` }}>
              <Eye size={11} /> Q: {item.questionId}
            </button>
          )}
          {item.profileName && <Pill bg={T.accent + '15'} color={T.accent}>{item.profileName}</Pill>}
          {item.status && (() => {
            const m = feedbackStatusMeta(item.status);
            return <Pill bg={m.color + '1F'} color={m.color}>{m.label}</Pill>;
          })()}
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setConfirmDelete(false)}
                    className="no-tap-highlight text-xs px-2 py-1 rounded-lg"
                    style={{ color: T.muted, background: T.surfaceWarm }}>No</button>
            <button onClick={() => onDelete(item.id)}
                    className="no-tap-highlight text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ color: '#FFF', background: T.error }}>Delete</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
                  className="no-tap-highlight p-1 -m-1 flex-shrink-0 rounded-lg active:bg-black/5"
                  aria-label="Delete report">
            <Trash2 size={14} style={{ color: T.error }} />
          </button>
        )}
      </div>

      <div className="text-sm whitespace-pre-wrap leading-relaxed mb-2" style={{ color: T.ink }}>{item.report}</div>
      {item.fix && (
        <div className="text-xs whitespace-pre-wrap leading-relaxed pt-2 mt-1 border-t" style={{ color: T.inkSoft, borderColor: T.borderSoft }}>
          <span className="font-semibold" style={{ color: T.muted }}>Suggested fix: </span>{item.fix}
        </div>
      )}
      <div className="text-[10px] mt-2 mb-3" style={{ color: T.muted }}>{date}</div>

      {/* Status chips */}
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Status</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FEEDBACK_STATUSES.map(s => {
          const active = status === s.id;
          const meta = feedbackStatusMeta(s.id);
          return (
            <button key={s.id} onClick={() => setStatus(active ? null : s.id)}
                    className="no-tap-highlight px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: active ? meta.color : T.surfaceWarm,
                      color: active ? '#FFF' : T.inkSoft,
                      border: `1px solid ${active ? meta.color : T.border}`
                    }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Reply */}
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Reply to user</div>
      <textarea value={reply} onChange={e => setReply(e.target.value)}
                placeholder="A short note back to the user (optional)" rows={2} maxLength={300}
                className="w-full rounded-xl px-3 py-2.5 mb-2 text-sm resize-none"
                style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={busy || !dirty} size="sm" className="flex-1"
                icon={busy ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}>
          {savedMsg ? 'Saved' : (item.reply || item.status ? 'Update' : 'Send')}
        </Button>
        {savedMsg && <Check size={16} style={{ color: T.success }} />}
      </div>
    </Card>
  );
}

function AdminPanel({
  profile, banks, banksLoading,
  announcement, onSaveAnnouncement, onClearAnnouncement,
  onRefreshBanks, onOpenLibrary, onCreateBank,
  onLockAdmin, onBack
}) {
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

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    const list = await adminListUsers();
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
    await adminDeleteProfile(id);
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
                  <button onClick={refreshFeedback} disabled={feedbackLoading}
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
                  <button onClick={refreshUsers} disabled={usersLoading}
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

// =====================================================================
// QUICK PRACTICE SETUP
// =====================================================================
function QuickPracticeSetup({ data, allQuestions, onStart, onBack }) {
  const prefs = data.preferences || { quickCount: 5, quickTopic: 'all' };
  const [count, setCount] = useState(prefs.quickCount);
  const [topic, setTopic] = useState(prefs.quickTopic);

  const topicsWithCounts = useMemo(() => {
    const map = {};
    allQuestions.forEach(q => { map[q.topic] = (map[q.topic] || 0) + 1; });
    return TOPICS.map(t => ({ ...t, count: map[t.id] || 0 })).filter(t => t.count > 0);
  }, [allQuestions]);

  const availablePool = topic === 'all'
    ? allQuestions.length
    : (topicsWithCounts.find(t => t.id === topic)?.count || 0);

  const canStart = availablePool >= count;

  return (
    <div className="anim-fadeup">
      <TopBar title="Quick test" onBack={onBack} feedback={{ screen: "Quick practice setup" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-32">
        <Card className="p-4 mb-5" style={{ background: T.sec.quick, border: 'none' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Shuffle size={18} color="#FFF" />
            </div>
            <div style={{ color: '#FFF' }}>
              <div className="font-display text-lg font-semibold">Fast practice with hints</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>Instant feedback after each answer</div>
            </div>
          </div>
        </Card>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>How many?</div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[5, 10, 15, 20].map(c => (
            <button key={c} onClick={() => setCount(c)}
                    className="no-tap-highlight py-3 rounded-xl text-base font-semibold transition-all"
                    style={{ background: count === c ? T.primary : T.surface,
                             color: count === c ? '#FFF' : T.ink,
                             border: `1.5px solid ${count === c ? T.primary : T.border}` }}>
              {c}
            </button>
          ))}
        </div>

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Topic</div>
        <div className="space-y-2 mb-5">
          <button onClick={() => setTopic('all')}
                  className="no-tap-highlight w-full p-3 rounded-xl text-left transition-all"
                  style={{ background: topic === 'all' ? T.primary + '18' : T.surface,
                           color: T.ink,
                           border: `1.5px solid ${topic === 'all' ? T.primary : T.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                   style={{ background: topic === 'all' ? T.primary + '25' : T.surfaceWarm }}>
                🎲
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: T.ink }}>All topics mixed</div>
                <div className="text-xs" style={{ color: T.muted }}>{allQuestions.length} questions in pool</div>
              </div>
            </div>
          </button>
          {topicsWithCounts.map(t => {
            const active = topic === t.id;
            return (
              <button key={t.id} onClick={() => setTopic(t.id)}
                      className="no-tap-highlight w-full p-3 rounded-xl text-left transition-all"
                      style={{ background: active ? t.color + '18' : T.surface,
                               border: `1.5px solid ${active ? t.color : T.border}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                       style={{ background: active ? t.color + '25' : T.surfaceWarm }}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: T.ink }}>{t.name}</div>
                    <div className="text-xs" style={{ color: T.muted }}>{t.count} question{t.count === 1 ? '' : 's'}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!canStart && (
          <Card className="p-3 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <div className="text-xs" style={{ color: T.error }}>
              Only {availablePool} question{availablePool === 1 ? '' : 's'} available in this topic — reduce the count or pick another topic.
            </div>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          <Button onClick={() => onStart({ count, topic })} disabled={!canStart} size="lg" className="w-full" icon={<Shuffle size={16} />}>
            Start {count} question{count === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// WEAK AREAS — focused list of topics where accuracy is low
// =====================================================================
// Distinct from Coverage on purpose: Coverage = "what have I seen / am I
// covering the syllabus", Weak Areas = "what am I getting wrong, fix it now".
// One scannable list, sorted worst-first, with a Start button on every row
// that launches a short quiz biased toward her past mistakes in that topic.
function WeakAreasScreen({ data, allQuestions, onBack, onStartWeakQuiz }) {
  const rows = useMemo(() => {
    // Re-derive from history rather than reusing getWeakTopics — we want all
    // topics she's attempted, not pre-filtered. We'll filter for display below.
    const byTopic = {};
    Object.entries(data.history || {}).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      // P15 — attemptStats normalizes Tier 2 / Tier 3 shapes.
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!byTopic[q.topic]) byTopic[q.topic] = { correct: 0, total: 0, wrongIds: new Set() };
      byTopic[q.topic].total += s.total;
      byTopic[q.topic].correct += s.correct;
      // Track questions where the user has EVER gotten an answer wrong.
      // For compacted records we lose the per-attempt detail but
      // anyWrong is still accurate.
      if (s.anyWrong) byTopic[q.topic].wrongIds.add(qId);
    });

    return Object.entries(byTopic)
      .map(([topic, { correct, total, wrongIds }]) => {
        const t = TOPICS.find(x => x.id === topic);
        return {
          topic,
          name: t?.name || topic,
          color: t?.color || T.primary,
          icon: t?.icon || '📘',
          correct,
          total,
          accuracy: total > 0 ? correct / total : 0,
          wrongCount: wrongIds.size
        };
      })
      // Only show topics with enough data to mean something AND not strong.
      // 3+ attempts is the minimum signal; 80% is the "still has room to fix" cap.
      .filter(x => x.total >= 3 && x.accuracy < 0.8)
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [data.history, allQuestions]);

  // Empty states — two flavours so the message is honest about which case
  // the user is in. "Nothing practised yet" vs "Nothing weak, keep going".
  const totalAttempted = data.stats.totalAttempted || 0;

  if (totalAttempted === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Weak areas" onBack={onBack} feedback={{ screen: "Weak areas" }} />
        <div className="max-w-md mx-auto px-4 pt-12 pb-24 text-center">
          <AlertCircle size={48} className="mx-auto mb-4" style={{ color: T.muted, opacity: 0.4 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>Nothing to fix yet</div>
          <div className="text-sm mb-6" style={{ color: T.muted }}>
            Practise a few questions first. As you take quizzes, the topics you struggle with will land here so you can drill them directly.
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Weak areas" onBack={onBack} feedback={{ screen: "Weak areas" }} />
        <div className="max-w-md mx-auto px-4 pt-12 pb-24 text-center">
          <Check size={48} className="mx-auto mb-4" style={{ color: T.success, opacity: 0.6 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>No weak areas right now</div>
          <div className="text-sm" style={{ color: T.muted }}>
            Every topic you've attempted is at 80% accuracy or better. Keep going — broaden your coverage or revise to lock it in.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fadeup">
      <TopBar title="Weak areas" onBack={onBack} feedback={{ screen: "Weak areas" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <div className="text-xs mb-4 leading-relaxed px-1" style={{ color: T.muted }}>
          Topics where your accuracy is below 80%, worst first. Tap Start on any row to drill 5 questions — questions you've previously got wrong are prioritised.
        </div>

        <div className="space-y-2.5">
          {rows.map(r => {
            const pct = Math.round(r.accuracy * 100);
            // Three accuracy tiers — visual cue for severity.
            const tier =
              r.accuracy < 0.4 ? { color: T.error,   bg: T.errorSoft,        label: 'Critical' } :
              r.accuracy < 0.6 ? { color: T.error,   bg: T.error + '12',     label: 'Weak'     } :
                                 { color: T.accent,  bg: T.accent + '12',    label: 'Shaky'    };

            return (
              <Card key={r.topic} className="p-3"
                    style={{ background: tier.bg, border: `1px solid ${tier.color}30` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                       style={{ background: r.color + '20' }}>
                    {r.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-display text-sm font-semibold truncate" style={{ color: T.ink }}>
                        {r.name}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0"
                            style={{ background: tier.color, color: '#FFF' }}>
                        {tier.label}
                      </span>
                    </div>
                    <div className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: T.muted }}>
                      <span style={{ color: tier.color, fontWeight: 700 }}>{pct}% accuracy</span>
                      <span>·</span>
                      <span>{r.correct}/{r.total} correct</span>
                      {r.wrongCount > 0 && (
                        <>
                          <span>·</span>
                          <span>{r.wrongCount} to revisit</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button onClick={() => onStartWeakQuiz(r.topic)}
                          className="no-tap-highlight inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 flex-shrink-0"
                          style={{ background: tier.color, color: '#FFF' }}>
                    <Shuffle size={11} />
                    Start
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SYLLABUS COVERAGE MAP
// =====================================================================
// Two-level drill-down: topic → sub-topic. Each level has its own
// coverage / accuracy / "Start" button so the user can practise a whole
// topic OR a single weak sub-topic without leaving this screen.
function CoverageMap({ data, allQuestions, onBack, onDrill }) {
  // Accordion state: which topic id is currently expanded. Only one at a
  // time so the page doesn't turn into an unscrollable mess.
  const [expandedTopic, setExpandedTopic] = useState(null);

  const rows = useMemo(() => {
    // Count attempts + corrects per topic from history
    const byTopic = {};
    Object.entries(data.history || {}).forEach(([qId, h]) => {
      const q = allQuestions.find(x => x.id === qId);
      if (!q || !h) return;
      // P15 — attemptStats covers Tier 2 + Tier 3.
      const s = attemptStats(h);
      if (s.total === 0) return;
      if (!byTopic[q.topic]) byTopic[q.topic] = { attempted: 0, correct: 0, uniqueAnswered: new Set() };
      byTopic[q.topic].uniqueAnswered.add(qId);
      byTopic[q.topic].attempted += s.total;
      byTopic[q.topic].correct += s.correct;
    });
    // Total available per topic
    const totalPerTopic = {};
    allQuestions.forEach(q => { totalPerTopic[q.topic] = (totalPerTopic[q.topic] || 0) + 1; });

    return TOPICS
      .filter(t => totalPerTopic[t.id] > 0)
      .map(t => {
        const s = byTopic[t.id] || { attempted: 0, correct: 0, uniqueAnswered: new Set() };
        const total = totalPerTopic[t.id] || 0;
        const coverage = total > 0 ? (s.uniqueAnswered.size / total) : 0;
        const accuracy = s.attempted > 0 ? (s.correct / s.attempted) : null;
        return {
          ...t,
          attempted: s.attempted,
          correct: s.correct,
          uniqueAnswered: s.uniqueAnswered.size,
          total,
          coverage,
          accuracy
        };
      })
      .sort((a, b) => a.coverage - b.coverage);
  }, [data.history, allQuestions]);

  // Build sub-topic breakdown ONLY for the expanded topic. Memoised against
  // `expandedTopic` so collapsed topics don't pay the cost.
  const subRowsForExpanded = useMemo(() => {
    if (!expandedTopic) return [];

    // All questions in this topic.
    const tQs = allQuestions.filter(q => q.topic === expandedTopic);
    // Bucket by `sub` field. Missing/blank → "General".
    const buckets = new Map();
    tQs.forEach(q => {
      const sub = (q.sub && String(q.sub).trim()) || 'General';
      if (!buckets.has(sub)) buckets.set(sub, []);
      buckets.get(sub).push(q);
    });

    // Score each sub-topic against history.
    const history = data.history || {};
    const result = [];
    buckets.forEach((qs, subName) => {
      let attempted = 0, correct = 0;
      const uniqueAnswered = new Set();
      qs.forEach(q => {
        const h = history[q.id];
        if (!h) return;
        // P15 — attemptStats normalizes Tier 2 / Tier 3.
        const s = attemptStats(h);
        if (s.total === 0) return;
        uniqueAnswered.add(q.id);
        attempted += s.total;
        correct += s.correct;
      });
      const total = qs.length;
      const coverage = total > 0 ? uniqueAnswered.size / total : 0;
      const accuracy = attempted > 0 ? correct / attempted : null;
      result.push({
        sub: subName,
        total,
        attempted,
        uniqueAnswered: uniqueAnswered.size,
        coverage,
        accuracy
      });
    });

    // Weakest / least-covered first — same ordering rule as the topic list.
    return result.sort((a, b) => a.coverage - b.coverage);
  }, [expandedTopic, allQuestions, data.history]);

  const totalAttempted = data.stats.totalAttempted || 0;

  if (totalAttempted === 0) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Syllabus Coverage" onBack={onBack} feedback={{ screen: "Coverage map" }} />
        <div className="max-w-md mx-auto px-4 pt-12 pb-24 text-center">
          <Activity size={48} className="mx-auto mb-4" style={{ color: T.muted, opacity: 0.4 }} />
          <div className="font-display text-xl mb-2" style={{ color: T.ink }}>No coverage yet</div>
          <div className="text-sm mb-6" style={{ color: T.muted }}>
            Practise some questions and your topic-by-topic coverage will show up here.
          </div>
          <Button onClick={() => onDrill('quick-setup')} className="inline-flex">
            Start Quick test
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fadeup">
      <TopBar title="Syllabus Coverage" onBack={onBack} feedback={{ screen: "Coverage map" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="text-xs mb-4 leading-relaxed px-1" style={{ color: T.muted }}>
          Tap a topic to see its sub-topics. Use the start button to practise just that area.
        </div>

        <div className="space-y-3">
          {rows.map(r => {
            const isWeak = r.coverage < 0.2;
            const labelTone = r.attempted === 0
              ? { text: 'Not touched', color: T.error, bg: T.errorSoft }
              : isWeak
                ? { text: 'Barely touched', color: T.accent, bg: T.accent + '15' }
                : r.coverage < 0.5
                  ? { text: 'Light coverage', color: T.muted, bg: T.surfaceWarm }
                  : r.coverage < 0.8
                    ? { text: 'Building', color: T.primary, bg: T.primary + '15' }
                    : { text: 'Well covered', color: T.success, bg: T.successSoft };
            const accColor = r.accuracy == null
              ? T.muted
              : r.accuracy >= 0.75 ? T.success : r.accuracy >= 0.5 ? T.primary : T.error;

            const isOpen = expandedTopic === r.id;

            return (
              <Card key={r.id} className="overflow-hidden">
                {/* TOPIC ROW — tap to expand sub-topics. The Start button is a
                    sibling element so its tap doesn't bubble up to the row. */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => setExpandedTopic(isOpen ? null : r.id)}
                            className="no-tap-highlight flex items-start gap-3 flex-1 min-w-0 text-left">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                           style={{ background: r.color + '18' }}>
                        {r.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="font-display text-sm font-semibold truncate" style={{ color: T.ink }}>{r.name}</div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                                style={{ background: labelTone.bg, color: labelTone.color }}>
                            {labelTone.text}
                          </span>
                        </div>
                        <div className="text-xs mb-2 flex items-center gap-1.5 flex-wrap" style={{ color: T.muted }}>
                          <span>{r.uniqueAnswered}/{r.total} unique</span>
                          <span>·</span>
                          <span>{r.attempted} attempt{r.attempted === 1 ? '' : 's'}</span>
                          {r.accuracy != null && (
                            <>
                              <span>·</span>
                              <span style={{ color: accColor, fontWeight: 600 }}>{Math.round(r.accuracy * 100)}% acc</span>
                            </>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
                          <div className="h-1.5 rounded-full transition-all duration-500"
                               style={{ width: `${Math.round(r.coverage * 100)}%`,
                                        background: r.color }} />
                        </div>
                      </div>
                    </button>

                    {/* Right column: Start button + expand chevron, stacked. */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <button onClick={() => onDrill('topic', r.id)}
                              className="no-tap-highlight inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition"
                              style={{ background: r.color, color: '#FFF' }}>
                        <Shuffle size={11} />
                        Start
                      </button>
                      <button onClick={() => setExpandedTopic(isOpen ? null : r.id)}
                              className="no-tap-highlight p-1"
                              aria-label={isOpen ? 'Collapse' : 'Expand sub-topics'}>
                        <ChevronRight size={16}
                                      className="transition-transform"
                                      style={{
                                        color: T.muted,
                                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                                      }} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* SUB-TOPIC PANEL — only rendered when this topic is open. */}
                {isOpen && (
                  <div className="px-4 pb-4 anim-fadeup">
                    <div className="border-t pt-3" style={{ borderColor: T.borderSoft }}>
                      <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                        Sub-topics ({subRowsForExpanded.length})
                      </div>
                      {subRowsForExpanded.length === 0 ? (
                        <div className="text-xs py-2" style={{ color: T.muted }}>
                          No sub-topics in this topic.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {subRowsForExpanded.map(s => {
                            const subAccColor = s.accuracy == null
                              ? T.muted
                              : s.accuracy >= 0.75 ? T.success : s.accuracy >= 0.5 ? T.primary : T.error;
                            const subStatus = s.attempted === 0
                              ? 'Not touched'
                              : s.coverage < 0.2
                                ? 'Barely touched'
                                : s.coverage < 0.5
                                  ? 'Light'
                                  : s.coverage < 0.8
                                    ? 'Building'
                                    : 'Well covered';
                            return (
                              <div key={s.sub}
                                   className="flex items-center gap-3 p-2.5 rounded-lg"
                                   style={{ background: T.surfaceWarm }}>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate mb-0.5" style={{ color: T.ink }}>{s.sub}</div>
                                  <div className="text-[10px] flex items-center gap-1 flex-wrap" style={{ color: T.muted }}>
                                    <span>{s.uniqueAnswered}/{s.total}</span>
                                    <span>·</span>
                                    <span>{subStatus}</span>
                                    {s.accuracy != null && (
                                      <>
                                        <span>·</span>
                                        <span style={{ color: subAccColor, fontWeight: 600 }}>{Math.round(s.accuracy * 100)}%</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="h-1 rounded-full overflow-hidden mt-1.5"
                                       style={{ background: T.border }}>
                                    <div className="h-1 rounded-full transition-all duration-500"
                                         style={{ width: `${Math.round(s.coverage * 100)}%`, background: r.color }} />
                                  </div>
                                </div>
                                <button onClick={() => onDrill('sub', r.id, s.sub)}
                                        className="no-tap-highlight inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 flex-shrink-0"
                                        style={{ background: r.color, color: '#FFF' }}>
                                  <Shuffle size={11} />
                                  Start
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// AUTH SCREEN — first-open profile create / log in
// =====================================================================
function AuthScreen({ legacyData, initialMode = 'create', onAuthed }) {
  const [mode, setMode] = useState(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');          // YYYY-MM-DD from <input type="date">
  const [showPassword, setShowPassword] = useState(false);
  const [importExisting, setImportExisting] = useState(!!legacyData);
  const [error, setError] = useState(null);
  const [working, setWorking] = useState(false);
  // Forgot-password recovery flow lives inline (no separate screen).
  // When `recovering` is true, the form swaps to: name + DOB + new password.
  const [recovering, setRecovering] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  // Live name-taken check (create mode only). null = unknown / not checked yet;
  // true = a profile with this id exists in Supabase; false = name is free.
  // We deliberately use raceStorage directly (not loadProfile, which after P1
  // falls back to local cache) so the check reflects the canonical store.
  // On offline / timeout we stay at `null` so we never falsely block — the
  // final authoritative check still happens in createProfile at submit time.
  const [nameTaken, setNameTaken] = useState(null);
  const [checkingName, setCheckingName] = useState(false);
  const nameCheckTimerRef = useRef(null);
  useEffect(() => {
    // Only run during fresh sign-up. Logging in or recovering doesn't need
    // a "name taken" hint because the user is supplying an EXISTING name on
    // purpose; we'd be reporting expected behaviour as a problem.
    if (mode !== 'create' || recovering) {
      setNameTaken(null);
      setCheckingName(false);
      return;
    }
    const name = displayName.trim();
    if (!name) {
      setNameTaken(null);
      setCheckingName(false);
      return;
    }
    if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    setCheckingName(true);
    nameCheckTimerRef.current = setTimeout(async () => {
      const id = normalizeProfileId(name);
      if (!id) { setNameTaken(null); setCheckingName(false); return; }
      try {
        const r = await raceStorage(
          () => kvStorage.get(KEYS.profile(id), true),
          4000
        );
        if (r.ok && r.value) setNameTaken(true);
        else if (r.ok) setNameTaken(false);
        else setNameTaken(null); // timeout / error — don't make claims
      } catch (e) {
        setNameTaken(null);
      } finally {
        setCheckingName(false);
      }
    }, 600);
    return () => {
      if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    };
  }, [displayName, mode, recovering]);

  const legacyStats = legacyData ? {
    attempted: legacyData.stats?.totalAttempted || 0,
    streak: legacyData.stats?.streakCurrent || 0,
    customs: legacyData.customQuestions?.length || 0,
    bookmarks: legacyData.bookmarks?.length || 0
  } : null;

  const todayISO = new Date().toISOString().slice(0, 10);

  const handleSubmit = async () => {
    if (working) return;
    setError(null);

    // Recovery flow has its own validation + handler
    if (recovering) {
      if (!displayName.trim()) { setError('Enter your display name'); return; }
      if (!dob) { setError('Pick your date of birth'); return; }
      if (!newPassword) { setError('Enter a new password'); return; }
      setWorking(true);
      try {
        await recoverPasswordWithDob(displayName, dob, newPassword);
        // Don't auto-log them in — make them log in with the new password
        // explicitly so they confirm it works and remember it.
        setRecoverySuccess(true);
        setPassword(newPassword);
        setRecovering(false);
        setMode('login');
        setNewPassword('');
        setDob('');
      } catch (e) {
        setError(e.message || 'Recovery failed');
      } finally {
        setWorking(false);
      }
      return;
    }

    if (!displayName.trim()) { setError('Enter a display name'); return; }
    if (!password) { setError('Enter a password'); return; }
    if (mode === 'create' && !dob) { setError('Pick your date of birth — used to recover your password later'); return; }
    setWorking(true);
    try {
      let profile;
      if (mode === 'create') {
        profile = await createProfile({
          displayName,
          password,
          dob,
          importData: (importExisting && legacyData) ? legacyData : undefined
        });
        // One-time migration: after first profile creation on this device,
        // wipe legacy data so subsequent profiles on the same device don't see it.
        if (legacyData) await clearLegacyData();
      } else {
        profile = await authenticateProfile(displayName, password);
      }
      await saveSession({ profileId: profile.id });
      onAuthed(profile);
    } catch (e) {
      setError(e.message || 'Something went wrong');
      setWorking(false);
    }
  };

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  return (
    <div className="font-body min-h-screen" style={{ background: T.bg, color: T.ink }}>
      <style>{fontStyles}</style>
      <div className="max-w-md mx-auto px-4 pt-10 pb-12 anim-fadeup">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
               style={{ background: T.primary }}>
            <GraduationCap size={28} color="#FFF" />
          </div>
          <div className="font-display text-3xl font-semibold" style={{ color: T.ink }}>NORCET prep</div>
          <div className="text-sm mt-1" style={{ color: T.muted }}>
            {mode === 'create' ? 'Create a profile to save your progress across devices' : 'Welcome back'}
          </div>
        </div>

        {/* Tabs — hidden during recovery so the user isn't tempted to swap mid-flow */}
        {!recovering && (
          <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
            <button onClick={() => { setMode('create'); setError(null); setRecoverySuccess(false); }}
                    className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                    style={{ background: mode === 'create' ? T.surface : 'transparent',
                             color: mode === 'create' ? T.ink : T.muted,
                             boxShadow: mode === 'create' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              <UserPlus size={14} />
              Create profile
            </button>
            <button onClick={() => { setMode('login'); setError(null); }}
                    className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                    style={{ background: mode === 'login' ? T.surface : 'transparent',
                             color: mode === 'login' ? T.ink : T.muted,
                             boxShadow: mode === 'login' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              <LogIn size={14} />
              Log in
            </button>
          </div>
        )}

        {/* Recovery header */}
        {recovering && (
          <div className="mb-4 px-1">
            <div className="font-display text-base font-semibold mb-1" style={{ color: T.ink }}>Reset password</div>
            <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
              Enter your display name and the date of birth you set when creating the profile. You'll then pick a new password.
            </div>
          </div>
        )}

        {/* Post-recovery success banner */}
        {recoverySuccess && !recovering && (
          <Card className="p-3 mb-4 anim-fadeup" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-start gap-2.5">
              <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                Password reset. Log in with your new password — we've pre-filled it for you.
              </div>
            </div>
          </Card>
        )}

        {/* Display name */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
          Display name
        </div>
        <div className="relative mb-4">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={mode === 'create' ? 'Your name' : 'Enter your name'}
            autoCapitalize="words"
            autoComplete="off"
            className="w-full rounded-xl pl-10 pr-4 py-3 text-sm"
            style={inputStyle}
          />
          {/* Live "name taken" hint (create mode only). Renders BELOW the input
              as a subtle inline note plus a quick-action to switch to login.
              Stays out of the way when status is unknown or the field is empty. */}
          {mode === 'create' && !recovering && nameTaken === true && (
            <div className="mt-2 text-xs flex items-start gap-1.5"
                 style={{ color: T.error || '#9B5050' }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                This name is already taken.{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setPassword(''); setNameTaken(null); }}
                  className="no-tap-highlight underline font-medium"
                  style={{ color: T.primary }}
                >
                  Log in instead?
                </button>
              </span>
            </div>
          )}
          {mode === 'create' && !recovering && checkingName && nameTaken === null && displayName.trim() && (
            <div className="mt-2 text-xs" style={{ color: T.muted }}>
              Checking availability…
            </div>
          )}
        </div>

        {/* DOB — required in create mode, used as the recovery key in recovery mode.
            Hidden during login. */}
        {(mode === 'create' || recovering) && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2 flex items-center justify-between" style={{ color: T.muted }}>
              <span>Date of birth</span>
              {mode === 'create' && !recovering && (
                <span className="font-normal normal-case text-[10px]" style={{ color: T.muted }}>For password recovery</span>
              )}
            </div>
            <div className="relative mb-4">
              <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                max={todayISO}
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm"
                style={inputStyle}
              />
            </div>
          </>
        )}

        {/* Password (or NEW password during recovery) */}
        {!recovering && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
              Password
            </div>
            <div className="relative mb-2">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'create' ? 'Choose a password (min 4 chars)' : 'Your password'}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                className="w-full rounded-xl pl-10 pr-12 py-3 text-sm"
                style={inputStyle}
              />
              <button onClick={() => setShowPassword(v => !v)}
                      className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5"
                      type="button">
                {showPassword ? <EyeOff size={16} style={{ color: T.muted }} /> : <Eye size={16} style={{ color: T.muted }} />}
              </button>
            </div>
            {mode === 'login' && (
              <div className="text-right mb-4">
                <button onClick={() => { setRecovering(true); setError(null); setPassword(''); setRecoverySuccess(false); }}
                        className="no-tap-highlight text-xs font-medium underline"
                        style={{ color: T.primary }}
                        type="button">
                  Forgot password?
                </button>
              </div>
            )}
            {mode === 'create' && <div className="mb-3" />}
          </>
        )}

        {recovering && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
              New password
            </div>
            <div className="relative mb-4">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Choose a new password (min 4 chars)"
                autoComplete="new-password"
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                className="w-full rounded-xl pl-10 pr-12 py-3 text-sm"
                style={inputStyle}
              />
              <button onClick={() => setShowPassword(v => !v)}
                      className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5"
                      type="button">
                {showPassword ? <EyeOff size={16} style={{ color: T.muted }} /> : <Eye size={16} style={{ color: T.muted }} />}
              </button>
            </div>
          </>
        )}

        {/* Security warning — only in create/login, not in recovery */}
        {!recovering && (
          <Card className="p-3 mb-5" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
            <div className="flex items-start gap-2.5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                {mode === 'create'
                  ? <>Remember your display name and password — you'll need both to log in. Your date of birth is the only way to recover access if you forget.</>
                  : <>This is a study app, not a secure account — don't reuse a password you use elsewhere.</>}
              </div>
            </div>
          </Card>
        )}

        {/* Legacy migration */}
        {mode === 'create' && legacyData && (
          <Card className="p-4 mb-5 cursor-pointer no-tap-highlight pressable"
                onClick={() => setImportExisting(v => !v)}
                style={{ background: importExisting ? T.successSoft : T.surface,
                         border: `1px solid ${importExisting ? T.success : T.border}` }}>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                   style={{ background: importExisting ? T.success : T.surface,
                            border: `1.5px solid ${importExisting ? T.success : T.border}` }}>
                {importExisting && <Check size={12} color="#FFF" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: T.ink }}>
                  Move existing on-device progress into this profile
                </div>
                <div className="text-xs mt-1 leading-relaxed" style={{ color: T.muted }}>
                  {legacyStats.attempted} question{legacyStats.attempted === 1 ? '' : 's'} practiced
                  {legacyStats.streak > 0 && ` · ${legacyStats.streak}-day streak`}
                  {legacyStats.bookmarks > 0 && ` · ${legacyStats.bookmarks} bookmark${legacyStats.bookmarks === 1 ? '' : 's'}`}
                  {legacyStats.customs > 0 && ` · ${legacyStats.customs} custom Q${legacyStats.customs === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="p-3 mb-4 anim-fadeup" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <div className="flex items-start gap-2 text-sm" style={{ color: T.error }}>
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          </Card>
        )}

        <Button onClick={handleSubmit}
                disabled={working
                          || !displayName.trim()
                          || (recovering ? (!dob || !newPassword) : !password)
                          || (mode === 'create' && !recovering && !dob)}
                size="lg" className="w-full"
                icon={working
                        ? <RefreshCw size={18} className="animate-spin" />
                        : (recovering ? <Lock size={18} /> : (mode === 'create' ? <UserPlus size={18} /> : <LogIn size={18} />))}>
          {working
            ? (recovering ? 'Resetting…' : (mode === 'create' ? 'Creating…' : 'Logging in…'))
            : (recovering ? 'Reset password' : (mode === 'create' ? 'Create profile' : 'Log in'))}
        </Button>

        <div className="text-center mt-6">
          {recovering ? (
            <button onClick={() => { setRecovering(false); setError(null); setDob(''); setNewPassword(''); }}
                    className="no-tap-highlight text-xs underline" style={{ color: T.muted }} type="button">
              Back to log in
            </button>
          ) : (
            <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
              {mode === 'create'
                ? 'Profiles sync across devices. Remember your display name, password, and date of birth.'
                : 'Forgot your password? Use the link above — you can reset it with your date of birth.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SETTINGS
// =====================================================================
function Settings({ data, profile, isAdmin, themeMode, onClearAll, onImportBackup, onLogout, onSwitchProfile, onUnlockAdmin, onLockAdmin, onToggleTheme, onSetColorTheme, onShowWelcome, onOpenFeedbackInbox, onOpenAdminPanel, onOpenMyReports, onRenameProfile, onToggleReviewReminders, unseenReplyCount = 0, onBack }) {
  const [confirming, setConfirming] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const fileInputRef = useRef(null);
  const [adminInput, setAdminInput] = useState('');
  const [adminShow, setAdminShow] = useState(false);
  const [adminError, setAdminError] = useState(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);

  const handleExport = () => {
    const blob = {
      exportedAt: new Date().toISOString(),
      appVersion: 'norcet-prep-1',
      profileDisplayName: profile?.displayName,
      data
    };
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = profile?.id || 'profile';
    downloadAsFile(JSON.stringify(blob, null, 2), `norcet-backup-${safeName}-${stamp}.json`);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const payload = parsed.data || parsed; // accept raw or wrapped
        if (!payload || typeof payload !== 'object') throw new Error('Invalid file');
        if (!('customQuestions' in payload) && !('history' in payload) && !('stats' in payload)) {
          throw new Error('This does not look like a NORCET backup');
        }
        onImportBackup(payload);
        setImportMsg({ ok: true, text: 'Backup restored into this profile.' });
      } catch (err) {
        setImportMsg({ ok: false, text: 'Could not import: ' + err.message });
      }
      e.target.value = '';
    };
    reader.onerror = () => setImportMsg({ ok: false, text: 'Could not read file' });
    reader.readAsText(file);
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Settings" onBack={onBack} feedback={{ screen: "Settings" }} />
      <div className="max-w-md mx-auto px-4 pt-4 pb-24">

        {/* Profile section */}
        {profile && (
          <>
            <div className="mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Profile</div>
            <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
                  style={{ background: T.primary, border: 'none' }}
                  onClick={() => {
                    if (onRenameProfile) {
                      requestRename({ profile, onRename: onRenameProfile });
                    }
                  }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <User size={20} color="#FFF" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-lg font-semibold truncate" style={{ color: '#FFF' }}>
                      {profile.displayName}
                    </div>
                    {onRenameProfile && (
                      <Edit3 size={14} style={{ color: 'rgba(255,255,255,0.7)' }} className="flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {onRenameProfile ? 'Tap to rename · syncs across devices' : 'Logged in · syncs across devices'}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-2 mb-6">
              <Card className="p-3 cursor-pointer no-tap-highlight pressable" onClick={onSwitchProfile}>
                <RefreshCw size={16} style={{ color: T.ink }} />
                <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Switch</div>
                <div className="text-[10px]" style={{ color: T.muted }}>Use a different profile</div>
              </Card>
              <Card className="p-3 cursor-pointer no-tap-highlight pressable" onClick={onLogout}>
                <LogOut size={16} style={{ color: T.error }} />
                <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Log out</div>
                <div className="text-[10px]" style={{ color: T.muted }}>End session on this device</div>
              </Card>
            </div>
          </>
        )}

        {/* My feedback */}
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onOpenMyReports}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent + '15' }}>
              <AlertCircle size={18} style={{ color: T.accent }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>My feedback</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>Reports you've sent and admin replies</div>
            </div>
            {unseenReplyCount > 0 && (
              <span className="px-2 py-1 rounded-full text-xs font-bold flex-shrink-0"
                    style={{ background: T.primary, color: '#FFF' }}>{unseenReplyCount} new</span>
            )}
            <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0" />
          </div>
        </Card>

        <Card className="p-4 mb-3">
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Custom questions</div>
          <div className="font-display text-xl" style={{ color: T.ink }}>{data.customQuestions.length} added</div>
        </Card>
        <Card className="p-4 mb-3">
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Total practice</div>
          <div className="font-display text-xl" style={{ color: T.ink }}>{data.stats.totalAttempted} questions</div>
        </Card>

        {/* Reminders — at the moment, just the spaced-revision card on Home.
            Toggling this off removes the green "Review due" card from Home
            entirely. The underlying spaced-repetition logic still runs — it
            just stops nudging her. */}
        {onToggleReviewReminders && (
          <>
            <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Reminders</div>
            <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
                  onClick={() => onToggleReviewReminders(!(data.preferences && data.preferences.reviewRemindersEnabled !== false))}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: T.success + '20' }}>
                    <RotateCcw size={18} style={{ color: T.success }} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: T.ink }}>Spaced revision reminders</div>
                    <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                      {data.preferences && data.preferences.reviewRemindersEnabled !== false
                        ? "Show the green 'Review due' card on Home when questions are ready for review"
                        : "Hidden — the spaced-repetition engine still tracks dates, just doesn't nudge you"}
                    </div>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                     style={{ background: (data.preferences && data.preferences.reviewRemindersEnabled !== false) ? T.success : T.border }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                       style={{ transform: (data.preferences && data.preferences.reviewRemindersEnabled !== false) ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Appearance */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Appearance</div>
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onToggleTheme}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: themeMode === 'dark' ? T.surface : T.surfaceWarm }}>
                {themeMode === 'dark' ? '🌙' : '☀️'}
              </div>
              <div>
                <div className="font-medium" style={{ color: T.ink }}>Dark mode</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                  {themeMode === 'dark' ? 'Easier on the eyes at night' : 'Tap to switch to dark'}
                </div>
              </div>
            </div>
            <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                 style={{ background: themeMode === 'dark' ? T.primary : T.border }}>
              <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                   style={{ transform: themeMode === 'dark' ? 'translateX(20px)' : 'translateX(0px)' }} />
            </div>
          </div>
        </Card>

        {/* Color theme picker — only relevant in light mode */}
        {themeMode !== 'dark' && (
          <Card className="p-4 mb-3">
            <div className="text-xs font-medium mb-3" style={{ color: T.muted }}>Colour theme</div>
            <div className="grid grid-cols-4 gap-2">
              {LIGHT_THEMES.map(opt => {
                const active = themeMode === opt.id;
                return (
                  <button key={opt.id}
                          onClick={() => onSetColorTheme && onSetColorTheme(opt.id)}
                          className="flex flex-col items-center gap-1.5 no-tap-highlight"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    {/* Swatch circle */}
                    <div className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all"
                         style={{
                           background: opt.bg,
                           border: active ? `2.5px solid ${opt.swatch}` : `2px solid ${T.border}`,
                           boxShadow: active ? `0 0 0 3px ${opt.swatch}28` : 'none',
                         }}>
                      {/* Inner accent dot */}
                      <div className="w-6 h-6 rounded-full" style={{ background: opt.swatch, opacity: 0.85 }} />
                      {/* Checkmark overlay when active */}
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full"
                             style={{ background: opt.swatch + '18' }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3.5 8.5l3 3 6-6" stroke={opt.swatch} strokeWidth="2.2"
                                  strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-tight"
                          style={{ color: active ? opt.swatch : T.muted }}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Help */}
        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Help</div>
        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={onShowWelcome}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '15' }}>
              <GraduationCap size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Show welcome tour</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>Quick recap of what each mode does</div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>

        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Backup</div>
        <div className="text-xs mb-3" style={{ color: T.muted }}>
          Your profile already syncs across devices via your account. A local backup file is an extra safety net.
        </div>

        <Card className="p-4 mb-2 cursor-pointer no-tap-highlight pressable" onClick={handleExport}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '15' }}>
              <Download size={18} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Download backup</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                This profile's questions, history, stats, bookmarks
              </div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>

        <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={handleImportClick}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: T.accent + '15' }}>
              <Upload size={18} style={{ color: T.accent }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium" style={{ color: T.ink }}>Restore from backup</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                Replace this profile's data with a saved file
              </div>
            </div>
            <ChevronRight size={18} style={{ color: T.muted }} />
          </div>
        </Card>
        <input ref={fileInputRef} type="file" accept="application/json,.json"
               className="hidden" onChange={handleFile} />

        {importMsg && (
          <Card className="p-3 mb-3 anim-fadeup"
                style={{ background: importMsg.ok ? T.successSoft : T.errorSoft,
                         border: `1px solid ${importMsg.ok ? T.success : T.error}40` }}>
            <div className="text-sm" style={{ color: importMsg.ok ? T.success : T.error }}>
              {importMsg.text}
            </div>
          </Card>
        )}

        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Admin</div>
        {isAdmin ? (
          <Card className="p-4 mb-3" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: T.success }}>
                  <Check size={16} color="#FFF" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm" style={{ color: T.ink }}>Admin mode is on</div>
                  <div className="text-xs" style={{ color: T.muted }}>Banks · users · feedback · announcements</div>
                </div>
              </div>
            </div>
            {/* P15 — Storage info, debug line. Only visible when admin is
                unlocked. "Last compacted" only shows once a real
                compaction has run (lastCompactedTs is null on a fresh
                v8-migrated blob). */}
            {(() => {
              let kb = '?';
              try { kb = (JSON.stringify(data).length / 1024).toFixed(0); } catch (e) {}
              const lc = data && data.stats && data.stats.lastCompactedTs;
              let lastStr = 'never';
              if (typeof lc === 'number' && lc > 0) {
                const days = Math.floor((Date.now() - lc) / (24 * 60 * 60 * 1000));
                if (days === 0) lastStr = 'today';
                else if (days === 1) lastStr = '1 day ago';
                else if (days < 30) lastStr = days + ' days ago';
                else if (days < 365) lastStr = Math.floor(days / 30) + ' months ago';
                else lastStr = Math.floor(days / 365) + ' years ago';
              }
              return (
                <div className="text-[11px] mb-2 px-1" style={{ color: T.muted }}>
                  Your data: {kb} KB · last compacted {lastStr}
                </div>
              );
            })()}
            <Button onClick={onOpenAdminPanel} className="w-full mb-2" icon={<ChevronRight size={14} />}>
              Open Admin Panel
            </Button>
            <Button variant="ghost" onClick={onLockAdmin} className="w-full" icon={<Lock size={14} />}>
              Lock admin
            </Button>
          </Card>
        ) : !showAdminForm ? (
          <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable" onClick={() => { setShowAdminForm(true); setAdminError(null); }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: T.surfaceWarm }}>
                <Lock size={16} style={{ color: T.muted }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium" style={{ color: T.ink }}>Unlock admin mode</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>Enter the admin passphrase</div>
              </div>
              <ChevronRight size={18} style={{ color: T.muted }} />
            </div>
          </Card>
        ) : (
          <Card className="p-4 mb-3 anim-fadeup">
            <div className="text-xs leading-relaxed mb-3" style={{ color: T.muted }}>
              Admin access is for the app owner only. This is soft security — don't reuse a real password.
            </div>
            <div className="relative mb-3">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
              <input type={adminShow ? 'text' : 'password'} value={adminInput}
                     onChange={e => setAdminInput(e.target.value)}
                     placeholder="Admin passphrase"
                     autoComplete="off"
                     onKeyDown={async e => {
                       if (e.key === 'Enter' && adminInput && !adminBusy) {
                         setAdminBusy(true);
                         // A4: tri-state result. true → granted; 'not-authorized'
                         // → passphrase ok but server didn't confirm this profile
                         // (or we're offline); anything else → wrong passphrase.
                         const res = await onUnlockAdmin(adminInput);
                         if (res === true) { setAdminInput(''); setShowAdminForm(false); setAdminBusy(false); }
                         else if (res === 'not-authorized') { setAdminError('This profile is not an admin, or you are offline. Connect and use the owner profile.'); setAdminBusy(false); }
                         else { setAdminError('Incorrect passphrase'); setAdminBusy(false); }
                       }
                     }}
                     className="w-full rounded-xl pl-10 pr-12 py-3 text-sm"
                     style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
              <button onClick={() => setAdminShow(v => !v)}
                      className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5"
                      type="button">
                {adminShow ? <EyeOff size={16} style={{ color: T.muted }} /> : <Eye size={16} style={{ color: T.muted }} />}
              </button>
            </div>
            {adminError && (
              <div className="text-xs mb-3 px-1" style={{ color: T.error }}>{adminError}</div>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setShowAdminForm(false); setAdminInput(''); setAdminError(null); }} className="flex-1">
                Cancel
              </Button>
              <Button disabled={!adminInput || adminBusy}
                      onClick={async () => {
                        setAdminBusy(true);
                        const res = await onUnlockAdmin(adminInput);
                        if (res === true) { setAdminInput(''); setShowAdminForm(false); setAdminBusy(false); }
                        else if (res === 'not-authorized') { setAdminError('This profile is not an admin, or you are offline. Connect and use the owner profile.'); setAdminBusy(false); }
                        else { setAdminError('Incorrect passphrase'); setAdminBusy(false); }
                      }}
                      className="flex-1"
                      icon={adminBusy ? <RefreshCw size={14} className="animate-spin" /> : null}>
                {adminBusy ? 'Checking' : 'Unlock'}
              </Button>
            </div>
          </Card>
        )}

        <div className="mt-8 mb-3 text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Danger zone</div>
        {!confirming ? (
          <Card className="p-4 cursor-pointer" onClick={() => setConfirming(true)}>
            <div className="flex items-center gap-3">
              <Trash2 size={18} style={{ color: T.error }} />
              <div>
                <div className="font-medium" style={{ color: T.ink }}>Reset this profile's data</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>Progress, bookmarks, custom questions, stats</div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4" style={{ background: T.errorSoft, border: `1px solid ${T.error}` }}>
            <div className="font-medium mb-2" style={{ color: T.error }}>This cannot be undone.</div>
            <div className="text-xs mb-3" style={{ color: T.inkSoft }}>
              Affects {profile ? profile.displayName + "'s" : 'this'} progress only. Other profiles are not touched. Consider downloading a backup first.
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="ghost" onClick={() => setConfirming(false)} className="flex-1">Cancel</Button>
              <Button variant="accent" onClick={() => { onClearAll(); setConfirming(false); }} className="flex-1">Reset</Button>
            </div>
          </Card>
        )}

        {/* P19 — build-version string so users (and you) can confirm which
            build is live. __APP_VERSION__ is injected by vite.config.js;
            the typeof guard keeps it from throwing outside a Vite build. */}
        <div className="mt-8 mb-2 text-center" style={{ color: T.muted, fontSize: 11, opacity: 0.75 }}>
          Version: {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// PWA UPDATE TOAST (Pipeline step 8 / P19)
// ---------------------------------------------------------------------
// With registerType:'prompt' (vite.config.js), main.jsx fires a
// 'pwa-update-available' event when a new build is installed and
// waiting, and stashes the activator on window.__pwaUpdateSW. We show a
// non-blocking bottom toast; the USER chooses when to reload — we never
// auto-reload. "Later" hides it for the rest of this browser session
// (sessionStorage) but it returns next session if the update is still
// pending. If a quiz is in progress, Reload asks for confirmation first
// so a session is never interrupted mid-question (progress is
// debounce-saved regardless, so the reload is safe either way).
// =====================================================================
const PWA_DISMISS_KEY = 'pwa-update-dismissed';

function UpdateToast({ quizInProgress }) {
  const [show, setShow] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    // If the user already chose "Later" this session, don't subscribe.
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(PWA_DISMISS_KEY) === '1'; } catch (e) {}
    if (dismissed) return;
    const onAvailable = () => setShow(true);
    window.addEventListener('pwa-update-available', onAvailable);
    // The event may have fired during boot before this listener attached.
    // main.jsx leaves window.__pwaUpdateSW set in that case, so check once.
    try { if (window.__pwaUpdateSW) setShow(true); } catch (e) {}
    return () => window.removeEventListener('pwa-update-available', onAvailable);
  }, []);

  if (!show) return null;

  const doReload = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.__pwaUpdateSW === 'function') {
        window.__pwaUpdateSW(true); // activate the waiting SW, then reload
      } else {
        window.location.reload();   // fallback if the activator went missing
      }
    } catch (e) {
      try { window.location.reload(); } catch (_) {}
    }
  };

  const onReloadClick = () => {
    // Mid-quiz: ask once before reloading. Otherwise reload immediately.
    if (quizInProgress && !confirming) { setConfirming(true); return; }
    doReload();
  };

  // Left button: in confirm mode it just backs out (toast stays);
  // otherwise it's "Later" — dismiss for the rest of the session.
  const onLeftClick = () => {
    if (confirming) { setConfirming(false); return; }
    setShow(false);
    try { sessionStorage.setItem(PWA_DISMISS_KEY, '1'); } catch (e) {}
  };

  return (
    <div className="anim-fadeup no-tap-highlight" role="status" aria-live="polite" style={{
      position: 'fixed', left: 12, right: 12, bottom: 84, zIndex: 210,
      maxWidth: 460, margin: '0 auto',
      background: T.surface, color: T.ink,
      border: `1px solid ${T.border}`, borderRadius: 14,
      boxShadow: '0 6px 24px rgba(0,0,0,0.20)',
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12
    }}>
      <RefreshCw size={18} style={{ flexShrink: 0, color: T.primary }} />
      <div className="text-sm" style={{ flex: 1, lineHeight: 1.35 }}>
        {confirming ? (
          <span><span style={{ fontWeight: 700 }}>Reload now?</span> Your current progress is saved.</span>
        ) : (
          <span><span style={{ fontWeight: 700 }}>New version available.</span> Reload to update.</span>
        )}
      </div>
      <button onClick={onLeftClick}
              aria-label={confirming ? 'Cancel reload' : 'Dismiss update until next session'}
              className="no-tap-highlight text-xs"
              style={{ flexShrink: 0, background: 'transparent', border: 'none',
                       color: T.muted, cursor: 'pointer', padding: '6px 8px', fontWeight: 600 }}>
        {confirming ? 'Cancel' : 'Later'}
      </button>
      <button onClick={onReloadClick}
              aria-label="Reload to apply the new version"
              className="no-tap-highlight text-xs"
              style={{ flexShrink: 0, background: T.primary, border: 'none',
                       color: '#fff', cursor: 'pointer', padding: '8px 14px',
                       borderRadius: 9, fontWeight: 700 }}>
        Reload
      </button>
    </div>
  );
}

// =====================================================================
// MAIN APP
// =====================================================================
export default function App() {
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [legacyData, setLegacyData] = useState(null);
  const [nav, setNav] = useState({ screen: 'home' });
  // A10: keep the logger's context in sync so every error report carries
  // the current profile + screen without each call site passing them.
  useEffect(() => {
    try { setLogContext({ screen: nav && nav.screen ? nav.screen : null }); } catch (e) {}
  }, [nav]);
  // ErrorBoundary's "Go back to Home" button (Pipeline step 1 / A3) dispatches
  // this event. Listen and reset nav so the user re-enters via Home cleanly,
  // without a full page reload (preserves React state like profile, banks).
  useEffect(() => {
    const handler = () => setNav({ screen: 'home' });
    window.addEventListener('norcet:reset-screen', handler);
    return () => window.removeEventListener('norcet:reset-screen', handler);
  }, []);
  // P1 — offline write queue. When the browser regains connectivity, replay
  // any local saves that didn't reach Supabase. Also fire once on mount
  // (after a short delay so we don't fight boot's own loadProfile) so a user
  // who closed the app while offline gets their last session synced as soon
  // as they next open it online.
  useEffect(() => {
    const onOnline = () => { flushPendingSync(); };
    window.addEventListener('online', onOnline);
    const bootFlushTimer = setTimeout(() => {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        flushPendingSync();
      }
    }, 2000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearTimeout(bootFlushTimer);
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [authInitialMode, setAuthInitialMode] = useState('create');
  const [isAdmin, setIsAdmin] = useState(false);
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [themeMode, setThemeMode] = useState('light');
  const [showWelcome, setShowWelcome] = useState(false);
  // When the user launches a section from the welcome tour (e.g. Settings →
  // Show welcome tour → tap "Quick test"), the next "back to home" should
  // return them to the welcome tour rather than dropping them on Home. This
  // ref records that origin so goHome can branch correctly. Cleared on
  // dismiss / explicit Got-it / or after the user returns to welcome once.
  const cameFromWelcomeRef = useRef(false);
  const [whatsNew, setWhatsNew] = useState([]); // [{ id, name, version }]
  const [announcement, setAnnouncement] = useState(null); // shared admin notice
  const [myReports, setMyReports] = useState([]); // this user's own feedback (with admin replies)
  const [myReportsLoading, setMyReportsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false); // nav drawer (lifted out of Home so position:fixed is viewport-relative)
  const [bridgeDead, setBridgeDead] = useState(false); // storage bridge unreachable (e.g. standalone home-screen app)
  const [bridgeWarnDismissed, setBridgeWarnDismissed] = useState(false);

  // Probe storage liveness in the background and only warn if a deliberate
  // round-trip (with a retry) fails. This avoids false alarms from a single slow
  // call — the banner appears only when storage is genuinely unreachable.
  useEffect(() => {
    let cancelled = false;
    checkStorageBridge().then((alive) => {
      if (!cancelled && !alive) setBridgeDead(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Reassign module-level T BEFORE any child renders for this pass.
  // (React calls function components synchronously during render — this works.)
  T = THEMES[themeMode] || LIGHT_THEME;
  IS_DARK = themeMode === 'dark';
  CURRENT_PROFILE = profile;

  // Boot: restore session if any, else show auth.
  //
  // Two safety nets ensure the "loading your progress…" screen ALWAYS clears:
  //   1. A watchdog forces loading=false after a few seconds, so even a slow or
  //      dead storage bridge (see safeStorage) can't trap the user on the
  //      splash screen — they fall through to the auth screen with defaults.
  //   2. A `finally` clears loading the instant the boot sequence finishes,
  //      regardless of which branch ran or whether anything threw.
  useEffect(() => {
    let cancelled = false;
    const watchdog = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 7000);
    (async () => {
      try {
        const tm = await loadThemeMode();
        setThemeMode(tm);
        setIsAdmin(await loadAdminStatus());
        loadAnnouncement().then(setAnnouncement).catch(() => {});
        const session = await loadSession();
        if (session && session.profileId) {
          const p = await loadProfile(session.profileId);
          if (p) {
            setProfile(p);
            touchProfileActivity(p.id);
            try { setLogContext({ profileId: p.id }); } catch (e) {}
            const pd = p.data || {};
            // A11: walk the loaded blob forward to current schema BEFORE
            // the spread-merge below. Migrations preserve user values;
            // the spread-merge below remains as a forward-compat safety
            // net for any field a halted migration didn't fill in.
            const migrated = runMigrations(pd);
            const loaded = {
              ...DEFAULT_DATA,
              ...migrated,
              customQuestions: Array.isArray(migrated.customQuestions) ? migrated.customQuestions : DEFAULT_DATA.customQuestions,
              bookmarks: Array.isArray(migrated.bookmarks) ? migrated.bookmarks : DEFAULT_DATA.bookmarks,
              stats: { ...DEFAULT_DATA.stats, ...(migrated.stats || {}) },
              advancedTestHistory: migrated.advancedTestHistory || [],
              bankVersionsSeen: migrated.bankVersionsSeen || {},
              bankPublishedSeen: migrated.bankPublishedSeen || {},
              disabledBanks: migrated.disabledBanks || {},
              revisionLog: Array.isArray(migrated.revisionLog) ? migrated.revisionLog : DEFAULT_DATA.revisionLog,
              preferences: { ...DEFAULT_DATA.preferences, ...(migrated.preferences || {}) }
            };
            // P15 — lazy compaction. Only runs when the serialized blob
            // crosses ~500 KB AND compactData would actually trim
            // something (avoids spinning cycles when the size is from
            // Tier 1 fields like bookmarks). Compaction happens in
            // memory; the saveData effect persists it on the next tick.
            let bootData = loaded;
            try {
              if (needsCompaction(loaded)) {
                bootData = compactData(loaded);
              }
            } catch (e) {
              try { log.error('boot.compaction', e); } catch (_) {}
            }
            setData(bootData);
            // Check onboarding: only show automatically for brand-new users
            const seen = await hasSeenOnboarding(p.id);
            const isBrandNew = loaded.stats.totalAttempted === 0
              && loaded.customQuestions.length === 0
              && loaded.bookmarks.length === 0;
            if (!seen && isBrandNew) setShowWelcome(true);
            return;
          }
          await saveSession(null);
        }
        const legacy = await peekLegacyData();
        setLegacyData(legacy);
        const index = await loadProfileIndex();
        setAuthInitialMode(index.length > 0 ? 'login' : 'create');
      } catch (e) {
        // Never let a boot error strand the user on the loading screen.
        log.error('boot.fatal', e);
      } finally {
        clearTimeout(watchdog);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; clearTimeout(watchdog); };
  }, []);

  // Persist on data change. Profile writes are DEBOUNCED so bursts of setData
  // (rapid streak/grace/preference updates after a quiz, settings edits, etc.)
  // coalesce into a single shared-storage write. This dramatically narrows the
  // window where two devices could clobber each other's blob, and avoids
  // hammering storage with one write per keystroke.
  //
  // On unmount or before a flush is due, we still write — so closing the tab
  // never loses progress.
  const pendingSaveRef = useRef(null);  // latest unsaved { profile, data }
  const saveTimerRef = useRef(null);
  // Effect A — schedule a debounced save whenever data changes. Deliberately
  // has NO cleanup: a rapid burst of state updates across separate render
  // ticks should reset the same 1.5s timer, not force an immediate flush on
  // every change (which defeated the debounce in the old single-effect form).
  useEffect(() => {
    if (!data || !profile || loading) return;
    pendingSaveRef.current = { profile, data };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const p = pendingSaveRef.current;
      if (p) {
        saveProfile({ ...p.profile, data: p.data });
        pendingSaveRef.current = null;
      }
      saveTimerRef.current = null;
    }, 1500);
  }, [data, profile, loading]);
  // Effect B — flush any pending save on unmount only, so closing the tab or
  // navigating away never loses the latest snapshot.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current && pendingSaveRef.current) {
        clearTimeout(saveTimerRef.current);
        const p = pendingSaveRef.current;
        saveProfile({ ...p.profile, data: p.data });
        pendingSaveRef.current = null;
        saveTimerRef.current = null;
      }
    };
  }, []);

  const allQuestions = useMemo(() => {
    if (!data) return SEED_QUESTIONS;
    // Filter out imported questions belonging to banks the user has paused.
    // The questions stay in customQuestions (so history + bookmarks survive
    // a re-enable) — they're just excluded from the active pool.
    const disabled = data.disabledBanks || {};
    const activeCustom = data.customQuestions.filter(q => {
      if (!q.sourceBank) return true;          // user's own additions
      return !disabled[q.sourceBank];          // imported but bank is enabled
    });
    return [...SEED_QUESTIONS, ...activeCustom];
  }, [data]);

  const navigate = useCallback((n) => setNav(n), []);

  // When the screen changes (e.g. completing a test → results), the window can
  // carry over the previous screen's scroll position, so the new page appears
  // to "launch from the middle". Reset scroll to the top on every screen change.
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (e) { /* no-op */ }
  }, [nav.screen]);

  // Theme-aware scrollbar colours. Set on :root so they apply to the window
  // scrollbar and every overflow container (sidebar, reference popup, etc.).
  // Warm, translucent neutrals that match the palette instead of the harsh
  // default white bar that looked out of place in dark mode.
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.style.setProperty('--sb-thumb', 'rgba(243,238,227,0.18)');
      root.style.setProperty('--sb-thumb-hover', 'rgba(243,238,227,0.32)');
    } else {
      // For light themes, tint the scrollbar with the primary colour at low opacity
      const primary = T.primary;
      root.style.setProperty('--sb-thumb', primary + '38');
      root.style.setProperty('--sb-thumb-hover', primary + '60');
    }
  }, [themeMode]);
  // goHome respects the welcome-tour-origin flag: if she came from welcome,
  // route her back to welcome instead of Home. Flag clears itself in the
  // process, so the next goHome (or her tapping "Got it" on welcome) goes
  // to Home normally.
  const goHome = useCallback(() => {
    if (cameFromWelcomeRef.current) {
      cameFromWelcomeRef.current = false;
      setShowWelcome(true);
    } else {
      setNav({ screen: 'home' });
    }
  }, []);

  const startQuiz = useCallback((spec) => {
    let qs = [];
    if (spec.mode === 'quick') {
      // Both Quick Practice entry points (this and `startQuickPractice`) go
      // through the same smart selector — no caller can accidentally end up
      // with raw-shuffled questions and miss the unseen-first / weakest-next
      // ordering. Kept here defensively in case future code paths invoke
      // `startQuiz({ mode: 'quick' })` directly.
      const pool = spec.topic && spec.topic !== 'all'
        ? allQuestions.filter(q => q.topic === spec.topic)
        : allQuestions;
      qs = selectQuickPracticeQuestions(pool, spec.count || 5, data ? data.history : {});
    } else if (spec.mode === 'topic') {
      let pool = allQuestions.filter(q => q.topic === spec.topic);
      // Optional sub-topic filter — comes from the Coverage map's per-sub
      // Start button. "General" matches questions that have no `sub` field.
      if (spec.sub) {
        pool = pool.filter(q => {
          const s = (q.sub && String(q.sub).trim()) || 'General';
          return s === spec.sub;
        });
      }
      qs = shuffle(pool).slice(0, spec.count || 10);
    } else if (spec.mode === 'weak-topic') {
      // Practice mode launched from the Weak Areas screen. Bias the question
      // selection toward questions she's previously got WRONG in this topic
      // — that's the whole point of the screen. Fallback order:
      //   1) questions she's been wrong on at least once in this topic
      //   2) questions she's never attempted in this topic
      //   3) anything else in this topic, to fill the slot count
      const history = data ? data.history : {};
      const topicPool = allQuestions.filter(q => q.topic === spec.topic);
      const wrong = [], unseen = [], rest = [];
      topicPool.forEach(q => {
        const h = history[q.id];
        // P15 — attemptStats.anyWrong is true for compacted records that
        // had any wrong attempts pre-compaction; hasBeenSeen catches both
        // Tier 2 and Tier 3.
        if (h && (h.lastResult === 'wrong' || attemptStats(h).anyWrong)) {
          wrong.push(q);
        } else if (!hasBeenSeen(h)) {
          unseen.push(q);
        } else {
          rest.push(q);
        }
      });
      const target = spec.count || 5;
      // Shuffle within each tier so she doesn't see the same order every time.
      qs = [...shuffle(wrong), ...shuffle(unseen), ...shuffle(rest)].slice(0, target);
      // Route as 'quick' for the Quiz renderer — Weak Area drills are study
      // sessions, not exams, so hints + alt explanations should remain visible.
      setNav({ screen: 'quiz', questions: qs, mode: 'quick', timed: false });
      return;
    } else if (spec.mode === 'mock') {
      qs = shuffle(allQuestions).slice(0, spec.count || 50);
    } else if (spec.mode === 'bookmarks') {
      qs = allQuestions.filter(q => data.bookmarks.includes(q.id));
    } else if (spec.mode === 'review-due') {
      qs = getDueQuestions(data.history, allQuestions);
    } else if (spec.mode === 'wrong') {
      qs = allQuestions.filter(q => spec.qIds && spec.qIds.includes(q.id));
    }
    setNav({
      screen: 'quiz',
      questions: qs,
      mode: spec.mode,
      timed: spec.mode === 'mock',
      // Countdown duration for mock. Other modes leave this undefined.
      timeLimitMin: spec.mode === 'mock' ? (spec.durationMin || spec.count || 50) : null
    });
  }, [allQuestions, data]);

  const completeQuiz = useCallback((results, bookmarkedLocal, elapsed) => {
    if (!data) return;
    setData(prev => {
      const newHistory = { ...prev.history };
      const today = todayStr();
      let attemptedToday = 0, correctToday = 0;

      results.forEach(r => {
        const h = newHistory[r.qId] || { attempts: [], reviewCount: 0, nextDue: null, lastResult: null };
        h.attempts = [...h.attempts, {
          ts: Date.now(),
          correct: r.correct,
          timeMs: r.timeMs || null,
          // True when the user tapped "Show answer" instead of attempting.
          // Counted as wrong (so the question feeds spaced repetition + Weak
          // Areas) but flagged so future granularity is possible without a
          // history backfill.
          revealed: r.revealed || false
        }];
        h.lastResult = r.correct ? 'right' : 'wrong';
        if (r.correct) h.reviewCount = (h.reviewCount || 0) + 1;
        else h.reviewCount = 0;
        const daysAhead = spacedRepetitionNext(h.lastResult, h.reviewCount);
        const next = new Date();
        next.setDate(next.getDate() + daysAhead);
        h.nextDue = next.toISOString();
        newHistory[r.qId] = h;
        attemptedToday++;
        if (r.correct) correctToday++;
      });

      const newDaily = [...prev.stats.dailyHistory];
      const todayIdx = newDaily.findIndex(d => d.date === today);
      if (todayIdx >= 0) {
        newDaily[todayIdx] = { date: today, attempted: newDaily[todayIdx].attempted + attemptedToday,
                               correct: newDaily[todayIdx].correct + correctToday };
      } else {
        newDaily.push({ date: today, attempted: attemptedToday, correct: correctToday });
      }
      // Keep last 60 days
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
      const filtered = newDaily.filter(d => new Date(d.date) >= cutoff);

      // Streak logic with one-day forgiveness per streak
      let streakCurrent = prev.stats.streakCurrent;
      let streakGraceAvailable = prev.stats.streakGraceAvailable !== false; // default true for old data
      let graceJustUsed = prev.stats.graceJustUsed || false;
      const lastDate = prev.stats.lastStudiedDate;
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(); dayBefore.setDate(dayBefore.getDate() - 2);
      const yStr = yesterday.toISOString().slice(0, 10);
      const dbStr = dayBefore.toISOString().slice(0, 10);

      if (lastDate === today) {
        // same day — no change
      } else if (lastDate === yStr) {
        // studied yesterday, normal increment
        streakCurrent = streakCurrent + 1;
      } else if (!lastDate) {
        // very first time
        streakCurrent = 1;
        streakGraceAvailable = true;
      } else if (lastDate === dbStr && streakGraceAvailable) {
        // missed exactly one day — use the grace token, streak continues.
        // Flag it so the user sees a one-time banner explaining what happened
        // — otherwise the save is invisible and they never learn the rule.
        streakCurrent = streakCurrent + 1;
        streakGraceAvailable = false;
        graceJustUsed = true;
      } else {
        // missed more than one day OR grace already used — reset
        streakCurrent = 1;
        streakGraceAvailable = true;
        graceJustUsed = false;
      }

      return {
        ...prev,
        history: newHistory,
        bookmarks: Array.from(bookmarkedLocal),
        stats: {
          ...prev.stats,
          totalAttempted: prev.stats.totalAttempted + attemptedToday,
          totalCorrect: prev.stats.totalCorrect + correctToday,
          streakCurrent,
          streakBest: Math.max(prev.stats.streakBest, streakCurrent),
          streakGraceAvailable,
          graceJustUsed,
          lastStudiedDate: today,
          dailyHistory: filtered
        }
      };
    });
    setNav({ screen: 'results', results, questions: nav.questions, elapsed });
  }, [data, nav.questions]);

  const saveCustomQuestion = useCallback((q) => {
    setData(prev => ({ ...prev, customQuestions: [...prev.customQuestions, q] }));
    goHome();
  }, [goHome]);

  const saveBulkQuestions = useCallback((qs) => {
    setData(prev => ({ ...prev, customQuestions: [...prev.customQuestions, ...qs] }));
    goHome();
  }, [goHome]);

  const importBackup = useCallback((payload) => {
    // Merge with defaults so older or partial backups don't break the app.
    // A11: walk the imported payload forward to current schema before the
    // spread-merge — a backup may be from an old version of the app.
    const migrated = runMigrations(payload);
    setData({
      ...DEFAULT_DATA,
      ...migrated,
      stats: { ...DEFAULT_DATA.stats, ...(migrated.stats || {}) },
      advancedTestHistory: migrated.advancedTestHistory || []
    });
  }, []);

  const startAdvancedTest = useCallback((spec) => {
    const pool = spec.pool && spec.pool.length >= spec.count ? spec.pool : allQuestions;
    const qs = shuffle(pool).slice(0, spec.count);
    setNav({
      screen: 'advanced-test',
      questions: qs,
      timeMinutes: spec.timeMinutes,
      filters: { count: spec.count, difficulty: spec.difficulty, pyqOnly: spec.pyqOnly }
    });
  }, [allQuestions]);

  const submitAdvancedTest = useCallback(({ answers, timePerQ, elapsedSec, auto }) => {
    const qs = nav.questions || [];
    let correct = 0, wrong = 0, blank = 0;
    qs.forEach(q => {
      const ans = answers[q.id] || [];
      if (ans.length === 0) blank++;
      else if (arraysEqualUnordered(ans, q.correct)) correct++;
      else wrong++;
    });
    const netScore = correct - (wrong / 3);
    const attempted = correct + wrong;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    setData(prev => ({
      ...prev,
      advancedTestHistory: [
        ...(prev.advancedTestHistory || []),
        {
          ts: Date.now(),
          count: qs.length,
          correct, wrong, blank,
          netScore: Number(netScore.toFixed(2)),
          accuracy,
          elapsedSec,
          autoSubmitted: !!auto,
          filters: nav.filters || null
        }
      ].slice(-50)
    }));

    setNav({
      screen: 'advanced-results',
      questions: qs,
      answers,
      timePerQ,
      elapsedSec,
      auto
    });
  }, [nav.questions, nav.filters]);

  const setExamDate = useCallback((dateStr) => {
    setData(prev => ({ ...prev, stats: { ...prev.stats, examDate: dateStr } }));
  }, []);

  const clearExamDate = useCallback(() => {
    setData(prev => ({ ...prev, stats: { ...prev.stats, examDate: null, dailyTarget: null } }));
    goHome();
  }, [goHome]);

  const setDailyTarget = useCallback((n) => {
    // null/0 → auto; positive number → manual override
    const v = (typeof n === 'number' && n > 0) ? n : null;
    setData(prev => ({ ...prev, stats: { ...prev.stats, dailyTarget: v } }));
    goHome();
  }, [goHome]);

  const completeDosage = useCallback((results, questions) => {
    setNav({ screen: 'dosage-results', results, questions });
  }, []);

  // Record that the user opened the Revision sheet today, storing a snapshot
  // of that day's set so they can jump back to it later. One entry per day —
  // re-opening the same day refreshes the snapshot. Capped to the last 60 days.
  const recordRevisionVisit = useCallback((ids) => {
    const arr = Array.from(ids || []);
    if (arr.length === 0) return;
    const dateKey = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
    setData(prev => {
      if (!prev) return prev;
      const log = (Array.isArray(prev.revisionLog) ? prev.revisionLog : []).filter(e => e.date !== dateKey);
      log.unshift({ date: dateKey, ts: Date.now(), ids: arr });
      log.sort((a, b) => b.ts - a.ts);
      return { ...prev, revisionLog: log.slice(0, 60) };
    });
  }, []);

  // Toggle a bookmark from any screen (not just inside Quiz). Used by the
  // read-only Bookmarks viewer's "Remove" button so the user can prune
  // without re-entering the question.
  const toggleBookmarkById = useCallback((qId) => {
    setData(prev => {
      const set = new Set(prev.bookmarks || []);
      if (set.has(qId)) set.delete(qId); else set.add(qId);
      return { ...prev, bookmarks: Array.from(set) };
    });
  }, []);

  const clearAll = useCallback(() => {
    // Only resets THIS profile's progress. Other profiles untouched.
    setData(DEFAULT_DATA);
    goHome();
  }, [goHome]);

  const handleAuthed = useCallback((p) => {
    setProfile(p);
    touchProfileActivity(p.id);
    try { setLogContext({ profileId: p.id }); } catch (e) {}
    loadAnnouncement().then(setAnnouncement);
    // A11: walk the freshly-loaded profile's data forward to current
    // schema before the spread-merge.
    const migrated = runMigrations(p.data || {});
    setData({
      ...DEFAULT_DATA,
      ...migrated,
      stats: { ...DEFAULT_DATA.stats, ...(migrated.stats || {}) },
      advancedTestHistory: migrated.advancedTestHistory || []
    });
    setLegacyData(null);
    setNav({ screen: 'home' });
  }, []);

  const handleLogout = useCallback(async () => {
    await saveSession(null);
    setProfile(null);
    setData(null);
    setLegacyData(null);
    // After someone logs out, default the auth screen to "log in"
    const index = await loadProfileIndex();
    setAuthInitialMode(index.length > 0 ? 'login' : 'create');
    setNav({ screen: 'home' });
  }, []);

  // ===== Rename profile =====
  // Flushes any pending profile save first so we don't lose unsaved progress
  // mid-rename, then performs the rename, then updates local state and the
  // session pointer if the id changed. Errors bubble to the calling modal.
  const handleRenameProfile = useCallback(async (newDisplayName) => {
    if (!profile) throw new Error('Not logged in');

    // Force-flush the debounced profile save BEFORE renaming. If we rename
    // first, the debounced save fires later with the OLD profile object and
    // writes a duplicate blob under the old key.
    if (saveTimerRef.current && pendingSaveRef.current) {
      clearTimeout(saveTimerRef.current);
      const p = pendingSaveRef.current;
      await saveProfile({ ...p.profile, data: p.data });
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
    }

    // Always rename from the latest in-memory state so user's most recent
    // session data goes into the renamed blob.
    const latest = { ...profile, data };
    const updated = await renameProfile(latest, newDisplayName);

    // If the id changed, update the session pointer too.
    if (updated.id !== profile.id) {
      await saveSession({ profileId: updated.id });
    }

    setProfile(updated);
    // `data` was preserved on the renamed blob; React state stays as-is.
    return updated;
  }, [profile, data]);

  // ===== Admin =====
  // A4: passphrase is the UX gate (don't pop admin UI on a stray tap), but
  // the SOURCE OF TRUTH is the server. We only grant isAdmin if BOTH the
  // passphrase verifies AND the current profile id is in admin_profile_ids
  // on Supabase. Returns a string reason on failure so the form can tell the
  // user WHY (wrong passphrase vs. this profile isn't an admin vs. offline).
  const handleUnlockAdmin = useCallback(async (passphrase) => {
    const passOk = await verifyAdminPassphrase(passphrase);
    if (!passOk) return false; // form shows "Incorrect passphrase"
    const pid = profile ? profile.id : null;
    const serverOk = await checkServerAdmin(pid);
    if (!serverOk) {
      // Passphrase right, but this profile isn't authorised server-side (or
      // we're offline / Supabase unreachable). Do NOT grant — fail closed.
      return 'not-authorized';
    }
    await saveAdminStatus(true);
    setIsAdmin(true);
    return true;
  }, [profile]);

  const handleLockAdmin = useCallback(async () => {
    await saveAdminStatus(false);
    setIsAdmin(false);
  }, []);

  // ===== Announcements =====
  // A4: writes go through the admin direct-fetch path and can THROW (network,
  // not-authorised, config). Surface the failure to the caller instead of
  // optimistically flipping local state, so the admin sees a real result.
  const handleSaveAnnouncement = useCallback(async (text, level) => {
    const pid = profile ? profile.id : null;
    const entry = await saveAnnouncement(text, level, pid); // throws on failure
    setAnnouncement(entry);
    return entry;
  }, [profile]);

  const handleClearAnnouncement = useCallback(async () => {
    const pid = profile ? profile.id : null;
    await clearAnnouncement(pid); // throws on failure
    setAnnouncement(null);
  }, [profile]);

  // A4: server re-verify of cached admin status. The boot path optimistically
  // trusts the local KEYS.ADMIN_STATUS cache so a legit admin's UI doesn't
  // flicker. This effect then confirms against Supabase whenever we have both
  // a profile and a cached-admin flag:
  //   - If online and the server says this profile is NOT an admin → silently
  //     downgrade and clear the cache (covers a profile that was de-listed, or
  //     a stale/forged cache).
  //   - If offline / Supabase unreachable → leave the cached flag alone. The
  //     admin keeps their UI, but any actual admin WRITE still goes through the
  //     server and will be rejected there, so no privilege is actually granted.
  // We intentionally do NOT auto-PROMOTE here: unlock always requires the
  // passphrase via handleUnlockAdmin. This effect can only ever downgrade.
  useEffect(() => {
    if (!isAdmin) return;            // nothing to verify
    if (!profile || !profile.id) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // offline: keep cache
    let cancelled = false;
    (async () => {
      const ok = await checkServerAdmin(profile.id);
      if (cancelled) return;
      if (!ok) {
        // Definitive (online) negative — drop admin silently.
        await saveAdminStatus(false);
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, profile]);

  const dismissAnnouncement = useCallback((id) => {
    setData(prev => ({ ...prev, dismissedAnnouncementId: id }));
  }, []);

  // Clear the one-time "streak saved by grace" banner once the user has read it.
  const dismissGrace = useCallback(() => {
    setData(prev => ({ ...prev, stats: { ...prev.stats, graceJustUsed: false } }));
  }, []);

  // "Hide for today" on the spaced-revision reminder card. Tomorrow's date
  // resets the gate naturally without us needing a scheduled clear.
  const dismissReviewToday = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setData(prev => ({
      ...prev,
      preferences: { ...(prev.preferences || {}), reviewDismissedDate: today }
    }));
  }, []);

  // Permanent on/off for the spaced-revision Home card. When re-enabling we
  // also clear any "hidden for today" flag so the user sees the card again
  // immediately rather than having to wait until tomorrow.
  const toggleReviewReminders = useCallback((enabled) => {
    setData(prev => ({
      ...prev,
      preferences: {
        ...(prev.preferences || {}),
        reviewRemindersEnabled: !!enabled,
        ...(enabled ? { reviewDismissedDate: null } : {})
      }
    }));
  }, []);

  // ===== My feedback (replies the admin sent back) =====
  const refreshMyReports = useCallback(async () => {
    if (!profile) return;
    setMyReportsLoading(true);
    try {
      const list = await listMyFeedback(profile.id);
      setMyReports(list);
    } finally {
      setMyReportsLoading(false);
    }
  }, [profile]);

  // Acknowledge every reply currently visible so the "new" badge clears.
  const markRepliesSeen = useCallback(() => {
    setData(prev => {
      const seen = { ...(prev.feedbackRepliesSeen || {}) };
      let changed = false;
      myReports.forEach(r => {
        if ((r.reply || r.status) && r.repliedAt && seen[r.id] !== r.repliedAt) {
          seen[r.id] = r.repliedAt;
          changed = true;
        }
      });
      return changed ? { ...prev, feedbackRepliesSeen: seen } : prev;
    });
  }, [myReports]);

  // ===== Banks =====
  const refreshBanks = useCallback(async () => {
    setBanksLoading(true);
    try {
      const list = await listBanks();
      setBanks(list);
    } finally {
      setBanksLoading(false);
    }
  }, []);

  const handleOpenLibrary = useCallback(() => {
    setNav({ screen: 'library' });
    refreshBanks();
  }, [refreshBanks]);

  const handleOpenBank = useCallback(async (bankId) => {
    setBanksLoading(true);
    const fresh = await loadBank(bankId);
    setBanksLoading(false);
    if (fresh && canSeeBank(fresh, profile ? profile.id : null, isAdmin)) {
      setNav({ screen: 'bank-detail', bankId, bank: fresh });
    } else { setNav({ screen: 'library' }); refreshBanks(); }
  }, [refreshBanks, isAdmin, profile]);

  const handleSaveBank = useCallback(async (bank) => {
    await saveBank(bank);
    await refreshBanks();
    setNav({ screen: 'bank-detail', bankId: bank.id, bank });
  }, [refreshBanks]);

  const handleDeleteBank = useCallback(async (bankId) => {
    await deleteBank(bankId);
    await refreshBanks();
    setNav({ screen: 'library' });
  }, [refreshBanks]);

  // Visibility change — allowed for the bank's owner, or any bank for admin.
  const handleSetBankVisibility = useCallback(async (bank, visibility) => {
    if (!bank) return;
    const allowed = isAdmin || isBankOwner(bank, profile ? profile.id : null);
    if (!allowed) return;
    const updated = await setBankVisibility(bank.id, visibility);
    await refreshBanks();
    if (updated) setNav({ screen: 'bank-detail', bankId: updated.id, bank: updated });
  }, [refreshBanks, isAdmin, profile]);

  const handleImportBank = useCallback((bank, replaceExisting) => {
    // Stable per-question id so updates can preserve history.
    // bankq:{bankId}:{questionInternalId} → consistent across versions.
    const stamped = bank.questions.map((q) => ({
      ...q,
      id: `bankq-${bank.id}-${q.id}`,
      custom: true,
      sourceBank: bank.id,
      sourceBankName: bank.name,
      sourceBankVersion: bank.version
    }));
    setData(prev => {
      // Always drop prior imports from this bank so we don't duplicate or
      // keep stale content; user progress (data.history keyed by qId) is
      // unaffected because the new stamped ids are deterministic.
      const filtered = prev.customQuestions.filter(q => q.sourceBank !== bank.id);
      // Importing also clears any prior "disabled" mark for this bank — the
      // user is clearly opting in to its questions.
      const nextDisabled = { ...(prev.disabledBanks || {}) };
      delete nextDisabled[bank.id];
      return {
        ...prev,
        customQuestions: [...filtered, ...stamped],
        bankVersionsSeen: { ...(prev.bankVersionsSeen || {}), [bank.id]: bank.version },
        disabledBanks: nextDisabled
      };
    });
    goHome();
  }, [goHome]);

  // Pause / resume an imported bank without deleting it. The bank's questions
  // remain in customQuestions (so history, bookmarks, accuracy stats survive),
  // but `allQuestions` filters them out while the bank is disabled.
  const handleToggleBankEnabled = useCallback((bankId, enabled) => {
    setData(prev => {
      const next = { ...(prev.disabledBanks || {}) };
      if (enabled) {
        delete next[bankId];
      } else {
        next[bankId] = true;
      }
      return { ...prev, disabledBanks: next };
    });
  }, []);

  // Auto-sync imported banks to latest version, and compute "what's new"
  const syncImportedBanks = useCallback(async () => {
    const all = await listBanks();
    setBanks(all);

    if (!data) return;

    // Only consider banks the user is allowed to see (public, own private, or
    // anything if admin) — so private banks never leak via sync or "what's new".
    const pid = profile ? profile.id : null;
    const list = all.filter(b => canSeeBank(b, pid, isAdmin));

    // Find banks the user has imported where the live bank is at a newer version
    const importedBankIds = new Set(
      data.customQuestions.filter(q => q.sourceBank).map(q => q.sourceBank)
    );
    const seenMap = data.bankVersionsSeen || {};
    const pubSeenMap = data.bankPublishedSeen || {};
    const updates = [];

    list.forEach(b => {
      const seenVer = seenMap[b.id] || 0;
      const lastImportedVer = Math.max(
        seenVer,
        ...data.customQuestions
          .filter(q => q.sourceBank === b.id)
          .map(q => q.sourceBankVersion || 0)
      );
      if (importedBankIds.has(b.id) && b.version > lastImportedVer) {
        updates.push(b);
      }
    });

    if (updates.length > 0) {
      // Auto-sync: replace imported questions with the latest version.
      // History is preserved automatically because bankq IDs are stable.
      setData(prev => {
        let newCustom = prev.customQuestions.slice();
        const newSeen = { ...(prev.bankVersionsSeen || {}) };
        updates.forEach(bank => {
          newCustom = newCustom.filter(q => q.sourceBank !== bank.id);
          const stamped = bank.questions.map(q => ({
            ...q,
            id: `bankq-${bank.id}-${q.id}`,
            custom: true,
            sourceBank: bank.id,
            sourceBankName: bank.name,
            sourceBankVersion: bank.version
          }));
          newCustom = [...newCustom, ...stamped];
          // Don't mark as "seen" here — leave it so the What's New badge appears
        });
        return { ...prev, customQuestions: newCustom, bankVersionsSeen: newSeen };
      });
      setWhatsNew(updates.map(b => ({ id: b.id, name: b.name, version: b.version, publishedAt: b.publishedAt || 0 })));
    } else {
      // Banks the user hasn't imported but that have either a newer version OR
      // are newly published (e.g. just flipped from private → public). Either
      // signal counts as discovery, tracked in two separate seen maps so a
      // version bump and a re-publish stay independent.
      const fresh = list.filter(b => {
        if (importedBankIds.has(b.id)) return false;
        const seenVer = seenMap[b.id] || 0;
        const seenPub = pubSeenMap[b.id] || 0;
        const versionFresh  = b.version > seenVer;
        const publishedFresh = !!b.publishedAt && b.publishedAt > seenPub;
        return versionFresh || publishedFresh;
      });
      if (fresh.length > 0) {
        setWhatsNew(fresh.map(b => ({ id: b.id, name: b.name, version: b.version, publishedAt: b.publishedAt || 0 })));
      }
    }
  }, [data, profile, isAdmin]);

  // Run bank sync once after data loads
  const syncedOnceRef = useRef(false);
  useEffect(() => {
    if (data && profile && !loading && !syncedOnceRef.current) {
      syncedOnceRef.current = true;
      syncImportedBanks();
      refreshMyReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, profile, loading]);

  // Opening "My feedback": pull the latest, and acknowledge any replies shown.
  useEffect(() => {
    if (nav.screen === 'my-reports') refreshMyReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.screen]);
  useEffect(() => {
    if (nav.screen === 'my-reports' && myReports.length > 0) markRepliesSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.screen, myReports]);

  const dismissWhatsNew = useCallback(() => {
    if (!data || whatsNew.length === 0) return;
    setData(prev => {
      const seen = { ...(prev.bankVersionsSeen || {}) };
      const pubSeen = { ...(prev.bankPublishedSeen || {}) };
      whatsNew.forEach(it => {
        seen[it.id] = it.version;
        if (it.publishedAt) pubSeen[it.id] = it.publishedAt;
      });
      return { ...prev, bankVersionsSeen: seen, bankPublishedSeen: pubSeen };
    });
    setWhatsNew([]);
  }, [data, whatsNew]);

  // ===== Theme + welcome =====
  const toggleTheme = useCallback(async () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    await saveThemeMode(next);
  }, [themeMode]);

  const setColorTheme = useCallback(async (id) => {
    if (!LIGHT_THEMES.find(t => t.id === id)) return;
    setThemeMode(id);
    await saveThemeMode(id);
  }, []);

  const dismissWelcome = useCallback(async () => {
    setShowWelcome(false);
    setNav({ screen: 'home' });   // always land on Home, regardless of what nav held before
    cameFromWelcomeRef.current = false;
    if (profile) await markOnboardingSeen(profile.id);
  }, [profile]);

  const reopenWelcome = useCallback(() => {
    setShowWelcome(true);
  }, []);

  // ===== Quick Practice setup =====
  const startQuickPractice = useCallback(({ count, topic }) => {
    setData(prev => ({ ...prev, preferences: { ...prev.preferences, quickCount: count, quickTopic: topic } }));
    let pool = allQuestions;
    if (topic !== 'all') pool = allQuestions.filter(q => q.topic === topic);
    // Prioritise fresh/unseen, then weakest/stalest; never repeats within a session.
    const qs = selectQuickPracticeQuestions(pool, count, data ? data.history : {});
    setNav({ screen: 'quiz', questions: qs, mode: 'quick', timed: false });
  }, [allQuestions, data]);

  const bridgeBanner = (bridgeDead && !bridgeWarnDismissed) ? (
    <div className="anim-fadeup" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: T.accent, color: '#fff',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.18)'
    }}>
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div className="text-xs" style={{ lineHeight: 1.4, flex: 1 }}>
        <span style={{ fontWeight: 700 }}>Your progress won't be saved here.</span>{' '}
        Storage isn't reachable in this mode. Open the app in your browser
        (not the home-screen shortcut) so your work is saved.
      </div>
      <button onClick={() => setBridgeWarnDismissed(true)}
              aria-label="Dismiss"
              className="no-tap-highlight"
              style={{ flexShrink: 0, background: 'transparent', border: 'none',
                       color: '#fff', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
        <X size={18} />
      </button>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="font-body min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <style>{fontStyles}</style>
        <div className="text-center">
          <div className="font-display text-2xl" style={{ color: T.primary }}>NORCET</div>
          <div className="text-xs mt-2" style={{ color: T.muted }}>loading your progress…</div>
        </div>
      </div>
    );
  }

  if (!profile || !data) {
    return (
      <>
        {bridgeBanner}
        <AuthScreen
          legacyData={legacyData}
          initialMode={authInitialMode}
          onAuthed={handleAuthed}
        />
      </>
    );
  }

  if (showWelcome) {
    // Launching from welcome closes the tour and navigates to the chosen mode.
    // We stamp `cameFromWelcomeRef` so the launched screen's "back" returns
    // to the welcome tour instead of dropping the user on Home.
    // Library has its own open handler that loads the bank list before
    // navigating, so we route through that. handleHomeNavigate is defined
    // below this early return, so we inline the equivalent logic here.
    const launchFromWelcome = (n) => {
      cameFromWelcomeRef.current = true;
      // Inline the dismiss side-effects rather than calling dismissWelcome():
      // dismissWelcome() defensively resets cameFromWelcomeRef to false, which
      // would immediately undo the flag we just set and send Back to Home
      // instead of returning to the welcome tour.
      setShowWelcome(false);
      if (profile) markOnboardingSeen(profile.id);
      if (n.screen === 'library') {
        handleOpenLibrary();
      } else {
        setNav(n);
      }
    };
    return (
      <div className="font-body min-h-screen" style={{ background: T.bg, color: T.ink }}>
        <style>{fontStyles}</style>
        <WelcomeScreen displayName={profile.displayName}
                       onDismiss={dismissWelcome}
                       onLaunch={launchFromWelcome} />
      </div>
    );
  }

  const handleHomeNavigate = (n) => {
    if (n.screen === 'quiz') startQuiz(n);
    else if (n.screen === 'library') handleOpenLibrary();
    else navigate(n);
  };

  return (
    <div className="font-body min-h-screen" style={{ background: T.bg, color: T.ink }}>
      <style>{fontStyles}</style>

      {bridgeBanner}

      {/* P19 — in-app PWA update toast. Rendered once here so it can surface
          from any in-app screen; quizInProgress gates the mid-quiz confirm. */}
      <UpdateToast quizInProgress={nav.screen === 'quiz'} />

      {/* Report modal lives at the app root (no transformed ancestor) so its
          position:fixed centering is relative to the viewport, not a screen. */}
      <FeedbackHost />
      <HelpHost />

      {/* Rename modal lives at the app root for the same reason as FeedbackHost —
          Settings is wrapped in `anim-fadeup` which leaves a CSS transform, and
          a transformed ancestor breaks `position: fixed` centering. */}
      <RenameProfileHost />

      {/* Nav drawer lives at the app root (no transformed ancestor), so its
          position:fixed is relative to the viewport and it scrolls correctly. */}
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}
                 data={data} onNavigate={handleHomeNavigate} />

      {nav.screen === 'home' && (
        <Home data={data} allQuestions={allQuestions}
              whatsNew={whatsNew} onDismissWhatsNew={dismissWhatsNew}
              announcement={announcement} onDismissAnnouncement={dismissAnnouncement}
              userName={profile ? profile.displayName : null}
              unseenReplies={unseenFeedbackReplies(myReports, data.feedbackRepliesSeen)}
              onOpenMyReports={() => setNav({ screen: 'my-reports' })}
              onDismissReplies={markRepliesSeen}
              onDismissGrace={dismissGrace}
              onDismissReviewToday={dismissReviewToday}
              onShowReviewInfo={() => requestHelp({ screen: 'Spaced revision' })}
              onOpenMenu={() => setDrawerOpen(true)}
              onNavigate={handleHomeNavigate} />
      )}

      {nav.screen === 'my-reports' && (
        <MyReports reports={myReports} loading={myReportsLoading}
                   seenMap={data.feedbackRepliesSeen}
                   onRefresh={refreshMyReports}
                   onBack={goHome} />
      )}

      {nav.screen === 'quick-setup' && (
        <QuickPracticeSetup data={data} allQuestions={allQuestions}
                            onStart={startQuickPractice} onBack={goHome} />
      )}

      {nav.screen === 'weak-areas' && (
        <WeakAreasScreen data={data} allQuestions={allQuestions}
                         onStartWeakQuiz={(topic) => startQuiz({ mode: 'weak-topic', topic, count: 5 })}
                         onBack={goHome} />
      )}

      {nav.screen === 'coverage' && (
        <CoverageMap data={data} allQuestions={allQuestions}
                     onDrill={(action, topic, sub) => {
                       if (action === 'topic') startQuiz({ mode: 'topic', topic, count: 10 });
                       else if (action === 'sub') startQuiz({ mode: 'topic', topic, sub, count: 10 });
                       else if (action === 'quick-setup') navigate({ screen: 'quick-setup' });
                     }}
                     onBack={goHome} />
      )}

      {nav.screen === 'feedback-inbox' && (
        <FeedbackInbox onBack={goHome} />
      )}

      {nav.screen === 'admin-panel' && isAdmin && (
        <AdminPanel profile={profile} banks={banks} banksLoading={banksLoading}
                    announcement={announcement}
                    onSaveAnnouncement={handleSaveAnnouncement}
                    onClearAnnouncement={handleClearAnnouncement}
                    onRefreshBanks={refreshBanks}
                    onOpenLibrary={() => { setNav({ screen: 'library', adminReturn: true }); refreshBanks(); }}
                    onCreateBank={() => setNav({ screen: 'bank-editor', adminReturn: true })}
                    onLockAdmin={async () => { await handleLockAdmin(); goHome(); }}
                    onBack={goHome} />
      )}

      {nav.screen === 'topic-select' && (
        <TopicSelect allQuestions={allQuestions} history={data.history}
                     onPick={(topic) => startQuiz({ mode: 'topic', topic, count: 10 })}
                     onBack={goHome} />
      )}

      {nav.screen === 'mock-setup' && (
        <MockSetup onStart={(count, durationMin) => startQuiz({ mode: 'mock', count, durationMin })}
                   onBack={goHome} totalQuestions={allQuestions.length} />
      )}

      {nav.screen === 'quiz' && (
        <Quiz questions={nav.questions} mode={nav.mode} timed={nav.timed}
              timeLimitMin={nav.timeLimitMin}
              allQuestions={allQuestions} data={data}
              onComplete={completeQuiz} onBack={goHome} />
      )}

      {nav.screen === 'results' && (
        <Results results={nav.results} questions={nav.questions} elapsed={nav.elapsed || 0}
                 onHome={goHome}
                 onReview={(qIds) => startQuiz({ mode: 'wrong', qIds })} />
      )}

      {nav.screen === 'learn-topics' && (
        <LearnTopics onPick={(topicId, sub) => navigate({ screen: 'learn-cards', topicId, sub })} onBack={goHome} />
      )}

      {nav.screen === 'learn-cards' && (
        <LearnCards topicId={nav.topicId} subFilter={nav.sub || null} onBack={() => navigate({ screen: 'learn-topics' })} />
      )}

      {nav.screen === 'stats' && (
        <StatsScreen data={data} allQuestions={allQuestions} onBack={goHome}
                     onQuick={() => navigate({ screen: 'quick-setup' })}
                     onPracticeTopic={(topicId) => startQuiz({ mode: 'topic', topic: topicId, count: 10 })} />
      )}

      {nav.screen === 'advanced-setup' && (
        <AdvancedTestSetup allQuestions={allQuestions}
                           onStart={startAdvancedTest}
                           onBack={goHome} />
      )}

      {nav.screen === 'advanced-test' && (
        <AdvancedTest questions={nav.questions} timeMinutes={nav.timeMinutes}
                      onSubmit={submitAdvancedTest}
                      onAbort={goHome} />
      )}

      {nav.screen === 'advanced-results' && (
        <AdvancedTestResults questions={nav.questions} answers={nav.answers}
                             timePerQ={nav.timePerQ} elapsedSec={nav.elapsedSec}
                             auto={nav.auto}
                             onHome={goHome}
                             onReview={(qIds) => startQuiz({ mode: 'wrong', qIds })} />
      )}

      {nav.screen === 'add-question' && (
        <AddQuestion onSave={saveCustomQuestion} onSaveBulk={saveBulkQuestions}
                     onBack={goHome}
                     existingCustomCount={data.customQuestions.length} />
      )}

      {nav.screen === 'library' && (() => {
        const pid = profile ? profile.id : null;
        const visibleBanks = banks.filter(b => canSeeBank(b, pid, isAdmin));
        return (
          <Library banks={visibleBanks} isAdmin={isAdmin} profileId={pid} loading={banksLoading}
                   disabledBanks={data ? data.disabledBanks : {}}
                   onRefresh={refreshBanks}
                   onOpen={handleOpenBank}
                   onCreateNew={() => setNav({ screen: 'bank-editor' })}
                   onBack={() => nav.adminReturn ? setNav({ screen: 'admin-panel' }) : goHome()} />
        );
      })()}

      {nav.screen === 'bank-detail' && nav.bank && (() => {
        const pid = profile ? profile.id : null;
        // Defensive: if this bank isn't visible to the viewer, bounce to library.
        if (!canSeeBank(nav.bank, pid, isAdmin)) {
          return <Library banks={banks.filter(b => canSeeBank(b, pid, isAdmin))} isAdmin={isAdmin} profileId={pid}
                          disabledBanks={data ? data.disabledBanks : {}}
                          loading={banksLoading} onRefresh={refreshBanks} onOpen={handleOpenBank}
                          onCreateNew={() => setNav({ screen: 'bank-editor' })} onBack={goHome} />;
        }
        const importedFromThisBank = data.customQuestions.filter(q => q.sourceBank === nav.bank.id);
        const importedVersion = importedFromThisBank.reduce((max, q) => Math.max(max, q.sourceBankVersion || 0), 0);
        const owner = isBankOwner(nav.bank, pid);
        const canToggleVis = isAdmin || owner;
        return (
          <BankDetail bank={nav.bank} isAdmin={isAdmin} isOwner={owner} canToggleVisibility={canToggleVis}
                      alreadyImported={{ count: importedFromThisBank.length, version: importedVersion || null }}
                      isDisabled={!!(data.disabledBanks && data.disabledBanks[nav.bank.id])}
                      onImport={() => handleImportBank(nav.bank, false)}
                      onUpdate={() => handleImportBank(nav.bank, true)}
                      onEdit={() => setNav({ screen: 'bank-editor', bank: nav.bank })}
                      onDelete={() => handleDeleteBank(nav.bank.id)}
                      onToggleVisibility={(vis) => handleSetBankVisibility(nav.bank, vis)}
                      onToggleEnabled={(enabled) => handleToggleBankEnabled(nav.bank.id, enabled)}
                      onBack={() => { setNav({ screen: 'library' }); refreshBanks(); }} />
        );
      })()}

      {/* New-bank creation is open to any logged-in user; EDITING an existing
          bank stays admin-only. */}
      {nav.screen === 'bank-editor' && (isAdmin || !nav.bank) && (
        <BankEditor existingBank={nav.bank || null} profile={profile}
                    onSave={handleSaveBank}
                    onBack={() => setNav(nav.bank ? { screen: 'bank-detail', bankId: nav.bank.id, bank: nav.bank } : (nav.adminReturn ? { screen: 'admin-panel' } : { screen: 'library' }))} />
      )}

      {nav.screen === 'reference' && (
        <Reference onBack={goHome} />
      )}

      {nav.screen === 'dosage' && (
        <DosagePractice onComplete={completeDosage} onBack={goHome} />
      )}

      {nav.screen === 'dosage-results' && (
        <DosageResults results={nav.results} questions={nav.questions} onHome={goHome} />
      )}

      {nav.screen === 'bookmarks-view' && (
        <BookmarksScreen data={data} allQuestions={allQuestions}
                         onToggleBookmark={toggleBookmarkById}
                         onBack={goHome} />
      )}

      {nav.screen === 'revision-sheet' && (
        <RevisionSheet data={data} allQuestions={allQuestions} onLogVisit={recordRevisionVisit} onBack={goHome} />
      )}

      {nav.screen === 'exam-date' && (
        <ExamDateScreen data={data}
                        allQuestionsCount={allQuestions.length}
                        onSave={setExamDate}
                        onClear={clearExamDate}
                        onSaveTarget={setDailyTarget}
                        onBack={goHome} />
      )}

      {nav.screen === 'settings' && (
        <Settings data={data} profile={profile} isAdmin={isAdmin}
                  themeMode={themeMode}
                  onClearAll={clearAll} onImportBackup={importBackup}
                  onLogout={handleLogout} onSwitchProfile={handleLogout}
                  onUnlockAdmin={handleUnlockAdmin} onLockAdmin={handleLockAdmin}
                  onToggleTheme={toggleTheme}
                  onSetColorTheme={setColorTheme}
                  onShowWelcome={() => { setShowWelcome(true); }}
                  onOpenFeedbackInbox={() => setNav({ screen: 'feedback-inbox' })}
                  onOpenAdminPanel={() => setNav({ screen: 'admin-panel' })}
                  onOpenMyReports={() => setNav({ screen: 'my-reports' })}
                  onRenameProfile={handleRenameProfile}
                  onToggleReviewReminders={toggleReviewReminders}
                  unseenReplyCount={unseenFeedbackReplies(myReports, data.feedbackRepliesSeen).length}
                  onBack={goHome} />
      )}
    </div>
  );
}
