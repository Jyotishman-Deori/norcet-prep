// =====================================================================
// src/screens/study-methods.jsx  (Feature F-A — Study Methods Section)
// A permanent, revisitable guide of 6 science-backed study methods. List
// view (numbered 1→6, each row shows a live progress stat + visited state)
// → tap a row → full-screen mentor card (hook → science stat → NORCET
// application → [Go to feature] + [Next method]).
//
// Read-only: pulls real progress from the `progress` prop (computed in App
// from data.stats / history). Visited state is a local per-profile kv blob
// (NOT a schema change). "Go to feature" routes via onNavigate
// (= handleHomeNavigate), so quiz specs actually start a quiz.
// =====================================================================
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Lightbulb, Brain, Repeat, Shuffle, Target, ChevronRight, ArrowRight, ArrowLeft, Sparkles, Check } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { STUDY_METHODS } from '../data/study-methods.js';

const ICON = { sq3r: BookOpen, why: Lightbulb, recall: Brain, spaced: Repeat, interleave: Shuffle, testing: Target };
const NOT_STARTED = 'Not started yet — tap to learn how';

// Map a method's statKind + the live progress numbers to its row label.
// Returns { text, strong, dim } — dim = no real activity yet (muted styling).
function rowStat(kind, p) {
  const att = (p && p.totalAttempted) || 0;
  switch (kind) {
    case 'reading':
      return { text: 'Open the reading guide', strong: false, dim: false };
    case 'accuracy':
      return att > 0
        ? { text: `${Math.round((p.accuracy || 0) * 100)}% accuracy so far`, strong: (p.accuracy || 0) >= 0.8, dim: false }
        : { text: NOT_STARTED, strong: false, dim: true };
    case 'attempted':
      return att > 0
        ? { text: `${att} question${att === 1 ? '' : 's'} practised`, strong: att >= 50, dim: false }
        : { text: NOT_STARTED, strong: false, dim: true };
    case 'due': {
      const due = (p && p.dueCount) || 0;
      if (due > 0) return { text: `${due} due for review now`, strong: false, dim: false };
      if (att > 0) return { text: 'All caught up — nothing due', strong: true, dim: false };
      return { text: NOT_STARTED, strong: false, dim: true };
    }
    case 'coverage': {
      const cov = (p && p.topicsCovered) || 0;
      const tot = (p && p.totalTopics) || 0;
      return cov > 0
        ? { text: `${cov}${tot ? ` of ${tot}` : ''} topic${cov === 1 ? '' : 's'} touched`, strong: tot > 0 && cov >= Math.ceil(tot * 0.5), dim: false }
        : { text: NOT_STARTED, strong: false, dim: true };
    }
    case 'streak': {
      const st = (p && p.streakCurrent) || 0;
      return st > 0
        ? { text: `${st}-day streak`, strong: st >= 3, dim: false }
        : { text: NOT_STARTED, strong: false, dim: true };
    }
    default:
      return { text: '', strong: false, dim: true };
  }
}

function StudyMethods({ onBack, onNavigate, progress }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const profileId = (profile && profile.id) || 'guest';
  const storeKey = `${KEYS.STUDY_METHODS_VISITED}${profileId}`;

  const [openId, setOpenId] = useState(null);
  const [visited, setVisited] = useState(() => new Set());
  const loadedRef = useRef(false);

  // Load visited set once (per profile).
  useEffect(() => {
    let alive = true;
    safeStorage.get(storeKey, false).then(r => {
      if (!alive) return;
      try {
        const arr = r && r.value ? JSON.parse(r.value) : [];
        if (Array.isArray(arr)) setVisited(new Set(arr));
      } catch (e) {}
      loadedRef.current = true;
    }).catch(() => { loadedRef.current = true; });
    return () => { alive = false; };
  }, [storeKey]);

  // Mark a method visited (idempotent) and persist.
  const markVisited = (id) => {
    setVisited(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev); next.add(id);
      try { safeStorage.set(storeKey, JSON.stringify([...next]), false); } catch (e) {}
      return next;
    });
  };

  const openMethod = (id) => { markVisited(id); setOpenId(id); window.scrollTo({ top: 0, behavior: 'auto' }); };

  const openIndex = STUDY_METHODS.findIndex(m => m.id === openId);
  const method = openIndex >= 0 ? STUDY_METHODS[openIndex] : null;

  // ---------- DETAIL VIEW ----------
  if (method) {
    const Icon = ICON[method.id] || Sparkles;
    const isLast = openIndex === STUDY_METHODS.length - 1;
    const next = !isLast ? STUDY_METHODS[openIndex + 1] : null;
    return (
      <div className="min-h-screen" style={{ background: T.bg }}>
        <TopBar title="Study method" onBack={() => setOpenId(null)} feedback={{ screen: 'Study methods' }} />
        <div className="max-w-md mx-auto px-4 pt-3 pb-28">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: T.primary + '15' }}>
              <Icon size={22} style={{ color: T.primary }} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.muted }}>
                Method {method.n} of {STUDY_METHODS.length}
              </div>
              <div className="font-display text-xl font-semibold leading-tight" style={{ color: T.ink }}>{method.name}</div>
            </div>
          </div>

          {/* Mentor explanation */}
          <div className="text-[15px] leading-relaxed font-medium mb-3" style={{ color: T.ink }}>{method.hook}</div>
          <div className="text-sm leading-relaxed mb-4" style={{ color: T.inkSoft }}>{method.science}</div>

          {/* Science stat — prominent highlight */}
          <Card className="p-4 mb-4" style={{ background: T.primary + '12', border: `1px solid ${T.primary}33` }}>
            <div className="flex items-start gap-2.5">
              <Sparkles size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
              <div className="text-[15px] leading-snug font-semibold" style={{ color: T.ink }}>{method.stat}</div>
            </div>
          </Card>

          {/* NORCET application */}
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.muted }}>
            How to apply this in NORCET prep
          </div>
          <Card className="p-4 mb-6" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{method.application}</div>
          </Card>

          {/* CTAs */}
          <button onClick={() => onNavigate && onNavigate(method.nav)}
                  className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold active:scale-[0.99] transition mb-3"
                  style={{ background: T.primary, color: '#FFF' }}>
            {method.goLabel} <ArrowRight size={16} />
          </button>
          <button onClick={() => (next ? openMethod(next.id) : setOpenId(null))}
                  className="no-tap-highlight w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium active:scale-[0.99] transition"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }}>
            {next ? `Next: ${next.name}` : 'Back to all methods'}
            {next && <ChevronRight size={16} style={{ color: T.muted }} />}
          </button>
        </div>
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <TopBar title="Study Methods" onBack={onBack} feedback={{ screen: 'Study methods' }} favId="study-methods" />
      <div className="max-w-md mx-auto px-4 pt-3 pb-24">
        <div className="mb-4">
          <div className="font-display text-lg font-semibold mb-1" style={{ color: T.ink }}>
            Study smarter, not just harder
          </div>
          <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
            Six proven methods, in order — from how to first open a book to how to lock it in for exam day. Tap any one.
          </div>
        </div>

        <div className="space-y-2.5">
          {STUDY_METHODS.map(m => {
            const Icon = ICON[m.id] || Sparkles;
            const s = rowStat(m.statKind, progress);
            const seen = visited.has(m.id);
            return (
              <Card key={m.id} onClick={() => openMethod(m.id)}
                    className="p-3.5 cursor-pointer no-tap-highlight pressable"
                    style={{
                      background: T.surface,
                      border: `1px solid ${s.strong ? T.primary + '55' : T.border}`,
                      borderLeft: `3px solid ${s.strong ? T.primary : T.borderSoft}`,
                      opacity: seen ? 1 : 0.82,
                    }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                       style={{ background: seen ? T.primary + '15' : T.surfaceWarm }}>
                    <Icon size={18} style={{ color: seen ? T.primary : T.muted }} />
                    {seen && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: T.primary }}>
                        <Check size={10} color="#FFF" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-bold" style={{ color: T.muted }}>{m.n}.</span>
                      <span className="font-display text-[15px] font-semibold truncate" style={{ color: T.ink }}>{m.name}</span>
                    </div>
                    <div className="text-xs leading-snug mb-1 line-clamp-2" style={{ color: T.muted }}>{m.hook}</div>
                    <div className="text-[11px] font-semibold" style={{ color: s.dim ? T.muted : (s.strong ? T.primary : T.inkSoft) }}>
                      {s.text}
                    </div>
                  </div>
                  <ChevronRight size={18} className="flex-shrink-0" style={{ color: T.muted }} />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-5 text-center text-[11px]" style={{ color: T.muted }}>
          These methods connect to the tools already in the app — each card links you straight to one.
        </div>
      </div>
    </div>
  );
}

export default StudyMethods;
