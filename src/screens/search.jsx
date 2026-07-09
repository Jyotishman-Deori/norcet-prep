// =====================================================================
// src/screens/search.jsx — GLOBAL UTILITY SEARCH (the bottom-nav Search tab).
// STRICTLY a navigation shortcut router (blueprint M1/M2): it finds and
// deep-links to App Settings, Features, Section/Unit titles and FAQ &
// Help articles. It deliberately does NOT query curriculum content —
// no questions, no reference values, no concept cards, no dictionary
// lookups (learning stays on the sequential Learn path; the Reference
// screen keeps its own in-section table filter).
//
// The index is the sanitized navigationRegistry compiled by
// lib/nav-registry.js: static app routes + per-topic Units + the DYNAMIC
// admin-authored FAQ list, every entry schema-validated and route-
// allowlisted (sanitizeRegistry) so nothing admin/internal can surface.
// Ranked title > keywords > description, capped small; ↑/↓ + Enter
// keyboard selection on the input.
// =====================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search as SearchIcon, X, History, Sparkles, HelpCircle,
  Compass, ArrowUpRight, Settings as SettingsIcon, Zap, BookOpen,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { listFaqs } from '../lib/faq.js';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { TOPICS } from '../data/seed.js';
import { haptic } from '../lib/juice.js';
import { TopBar, requestNote, requestFeedback } from '../ui/primitives.jsx';
import { tokenize, highlightSegments, MIN_QUERY_LEN } from '../lib/search.js';
import { buildDynamicRegistry, searchRegistry } from '../lib/nav-registry.js';

const RECENT_MAX = 8;
const RESULT_LIMIT = 7; // spec: 5–7; this is the only result list now
// Idle-state suggestions — every one demonstrates the ROUTER (not content):
// settings, features, a unit, help.
const SUGGESTED = ['dark mode', 'mistakes', 'mock test', 'pharmacology', 'leaderboard', 'backup'];

// Highlighted text — every query-token occurrence gets a soft accent wash.
function Hi({ text, tokens, color }) {
  const segs = useMemo(() => highlightSegments(text, tokens), [text, tokens]);
  return (
    <>
      {segs.map((s, i) => s.hit
        ? <span key={i} className="rounded-[3px] font-semibold" style={{ background: color + '22', color: 'inherit' }}>{s.text}</span>
        : <React.Fragment key={i}>{s.text}</React.Fragment>)}
    </>
  );
}

export default function SearchScreen({ onBack, onNavigate, profileId }) {
  const { theme: T } = useTheme();
  const [faqs, setFaqs] = useState(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [recent, setRecent] = useState([]);
  const [selIdx, setSelIdx] = useState(-1);
  const inputRef = useRef(null);

  // Dynamic half of the registry: admin-authored FAQs (async, offline just
  // means the FAQ entries are absent — never an error state).
  useEffect(() => {
    let on = true;
    listFaqs().then(list => { if (on && Array.isArray(list)) setFaqs(list); }).catch(() => {});
    return () => { on = false; };
  }, []);

  // Recent searches (local-only, per profile).
  const recentKey = KEYS.searchRecent(profileId || 'guest');
  useEffect(() => {
    let on = true;
    safeStorage.get(recentKey, false).then(raw => {
      if (!on || !raw) return;
      try { const arr = JSON.parse(raw); if (Array.isArray(arr)) setRecent(arr.filter(s => typeof s === 'string')); } catch (e) {}
    }).catch(() => {});
    return () => { on = false; };
  }, [recentKey]);
  const saveRecent = (q) => {
    const t = String(q || '').trim();
    if (t.length < MIN_QUERY_LEN) return;
    setRecent(prev => {
      const next = [t, ...prev.filter(p => p.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
      safeStorage.set(recentKey, JSON.stringify(next), false).catch(() => {});
      return next;
    });
  };
  const clearRecent = () => {
    setRecent([]);
    safeStorage.delete(recentKey, false).catch(() => {});
  };

  // Debounce typing → search runs ~180ms after the last keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => { setSelIdx(-1); }, [debounced]);

  const registry = useMemo(() => buildDynamicRegistry({ topics: TOPICS, faqs }), [faqs]);
  const tokens = useMemo(() => tokenize(debounced), [debounced]);
  const navHits = useMemo(() => searchRegistry(registry, debounced, { limit: RESULT_LIMIT }), [registry, debounced]);

  const searching = debounced.trim().length >= MIN_QUERY_LEN;

  // Category identity (icon + badge accent).
  const CAT_META = {
    Settings: { Icon: SettingsIcon, color: T.inkSoft },
    Features: { Icon: Zap,          color: T.primary },
    Units:    { Icon: BookOpen,     color: T.sec.learn },
    FAQ:      { Icon: HelpCircle,   color: T.sec.revision },
  };

  const runQuery = (q) => { setQuery(q); setDebounced(q); saveRecent(q); };

  // Route a shortcut: nav-object routes go through the app router; the two
  // imperative popups (notes / feedback) open through their request channels.
  const openNav = (entry) => {
    haptic(5);
    saveRecent(debounced);
    if (entry.action === 'note') { requestNote(); return; }
    if (entry.action === 'feedback') { requestFeedback({ source: 'feedback', screen: 'Search' }); return; }
    if (entry.route) onNavigate(entry.route);
  };

  const Chip = ({ label, icon, onClick }) => (
    <button onClick={() => { haptic(5); onClick(); }}
            className="no-tap-highlight flex-shrink-0 flex items-center gap-1.5 pl-3 pr-3.5 py-2 rounded-full text-xs font-semibold active:scale-95 transition-transform"
            style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
      {icon}
      {label}
    </button>
  );

  return (
    <div className="anim-fadeup">
      <TopBar title="Search" onBack={onBack} feedback={{ screen: 'Search' }} desktopHidden />
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pb-8 pt-2">

        {/* Hero search box */}
        <div className="relative mb-4">
          <SearchIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                 onKeyDown={e => {
                   if (e.key === 'ArrowDown' && navHits.length) {
                     e.preventDefault(); setSelIdx(i => (i + 1) % navHits.length);
                   } else if (e.key === 'ArrowUp' && navHits.length) {
                     e.preventDefault(); setSelIdx(i => (i <= 0 ? navHits.length - 1 : i - 1));
                   } else if (e.key === 'Enter') {
                     if (selIdx >= 0 && navHits[selIdx]) openNav(navHits[selIdx]);
                     else if (navHits.length === 1) openNav(navHits[0]);
                     else { e.currentTarget.blur(); saveRecent(query); }
                   } else if (e.key === 'Escape') { setQuery(''); setDebounced(''); }
                 }}
                 placeholder="Find settings, features, units, help…"
                 autoFocus inputMode="search" enterKeyHint="go" aria-label="Search app sections and settings"
                 className="w-full rounded-2xl pl-11 pr-11 py-3.5 text-sm font-body"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink,
                          boxShadow: '0 2px 8px rgba(26,43,35,0.05)' }} />
          {query && (
            <button onClick={() => { setQuery(''); setDebounced(''); try { inputRef.current && inputRef.current.focus(); } catch (e) {} }}
                    aria-label="Clear search"
                    className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl active:bg-black/5">
              <X size={15} style={{ color: T.muted }} />
            </button>
          )}
        </div>

        {/* Idle state — recents + suggestions */}
        {!searching && (
          <div className="anim-fadeup">
            {recent.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-xs font-semibold" style={{ color: T.inkSoft }}>Recent</div>
                  <button onClick={clearRecent} className="no-tap-highlight text-[11px] font-medium p-1" style={{ color: T.muted }}>
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-5">
                  {recent.map(r => (
                    <Chip key={r} label={r} onClick={() => runQuery(r)}
                          icon={<History size={12} style={{ color: T.muted }} />} />
                  ))}
                </div>
              </>
            )}
            <div className="text-xs font-semibold mb-2 px-1" style={{ color: T.inkSoft }}>Try searching</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map(s => (
                <Chip key={s} label={s} onClick={() => runQuery(s)}
                      icon={<Sparkles size={12} style={{ color: T.accent }} />} />
              ))}
            </div>
            <div className="mt-8 text-center text-xs leading-relaxed px-6" style={{ color: T.muted }}>
              Search jumps you straight to any screen, setting, subject unit or FAQ. It doesn’t search
              questions or study content. For learning, follow your path in Learn.
            </div>
          </div>
        )}

        {/* Results — the shortcut router list */}
        {searching && (
          <>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Compass size={14} style={{ color: T.primary }} />
              <div className="text-xs font-semibold" style={{ color: T.inkSoft }}>Go to</div>
              <div className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
                   style={{ background: T.primary + '15', color: T.primary }}>
                {navHits.length}
              </div>
            </div>

            {navHits.length > 0 && (
              <div className="space-y-2" role="listbox" aria-label="Navigation shortcuts">
                {navHits.map((entry, i) => {
                  const meta = CAT_META[entry.category] || CAT_META.Features;
                  const selected = i === selIdx;
                  return (
                    <button key={entry.id} onClick={() => openNav(entry)}
                            role="option" aria-selected={selected}
                            className="search-row-in no-tap-highlight press-safe w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left active:scale-[0.99] transition-transform"
                            style={{ background: selected ? T.primary + '0F' : T.surface,
                                     border: `1px solid ${selected ? T.primary : T.border}`,
                                     animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                      <span className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                            style={{ background: meta.color + '15' }}>
                        {entry.icon ? entry.icon : <meta.Icon size={15} style={{ color: meta.color }} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate" style={{ color: T.ink }}>
                            <Hi text={entry.title} tokens={tokens} color={meta.color} />
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: meta.color + '15', color: meta.color }}>
                            {entry.category}
                          </span>
                        </span>
                        <span className="block text-xs mt-0.5 truncate" style={{ color: T.muted }}>
                          <Hi text={entry.description} tokens={tokens} color={meta.color} />
                        </span>
                      </span>
                      <ArrowUpRight size={15} className="flex-shrink-0"
                                    style={{ color: selected ? T.primary : T.muted }} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Zero results */}
            {navHits.length === 0 && (
              <div className="text-center py-14 anim-fadeup">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                     style={{ background: T.surfaceWarm }}>
                  <SearchIcon size={22} style={{ color: T.muted }} />
                </div>
                <div className="text-sm font-medium" style={{ color: T.inkSoft }}>
                  Nothing to jump to for “{debounced.trim()}”
                </div>
                <div className="text-xs mt-1.5 leading-relaxed px-8" style={{ color: T.muted }}>
                  Try a feature name (“mock test”), a setting (“dark mode”), a subject (“pharmacology”)
                  or a help topic (“streak”).
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
