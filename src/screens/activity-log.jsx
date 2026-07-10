// =====================================================================
// src/screens/activity-log.jsx — ACTIVITY HISTORY (blueprint M3).
// A newest-first, infinite-scroll chronological feed of the user's
// journey: level-ups, streak milestones, mastery moments (from the
// data.milestones event log) plus test attempts and revision sessions
// (derived from the aggregates the blob already kept). Deliberately
// scroll-only — no search, no filters — the point is wandering back
// through your own progress. Day-grouped like the admin audit feed.
// =====================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy, Flame, Star, ClipboardCheck, ScrollText, RotateCcw, History,
} from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { TopBar } from '../ui/primitives.jsx';
import { buildActivityFeed } from '../lib/milestones.js';

const PAGE = 30; // rows revealed per scroll "page"

export default function ActivityLog({ onBack }) {
  const { theme: T } = useTheme();
  const { data } = useData();

  const feed = useMemo(() => buildActivityFeed({
    milestones: data && data.milestones,
    advancedTestHistory: data && data.advancedTestHistory,
    previousPapers: data && data.previousPapers,
    revisionLog: data && data.revisionLog,
  }), [data]);

  // Infinite scroll: reveal PAGE more rows whenever the sentinel enters view.
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= feed.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisibleCount(c => Math.min(c + PAGE, feed.length));
      }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, feed.length]);

  const KIND_META = {
    'level-up':      { Icon: Trophy,         color: '#D97706' },
    'streak':        { Icon: Flame,          color: T.accent },
    'mastery':       { Icon: Star,           color: T.sec.learn },
    'advanced-test': { Icon: ClipboardCheck, color: T.primary },
    'paper':         { Icon: ScrollText,     color: T.sec.revision },
    'revision':      { Icon: RotateCcw,      color: T.sec.stats },
  };

  // Day-group the visible slice (feed is already newest-first).
  const groups = useMemo(() => {
    const out = [];
    let cur = null;
    for (const item of feed.slice(0, visibleCount)) {
      const day = new Date(item.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      if (!cur || cur.day !== day) { cur = { day, items: [] }; out.push(cur); }
      cur.items.push(item);
    }
    return out;
  }, [feed, visibleCount]);

  return (
    <div className="anim-fadeup">
      <TopBar title="History" onBack={onBack} feedback={{ screen: 'Activity history' }} />
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pb-8 pt-2">

        {feed.length === 0 ? (
          <div className="text-center py-16">
            <History size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>Your story starts here</div>
            <div className="text-sm leading-relaxed px-6" style={{ color: T.muted }}>
              Level-ups, streak milestones, mastery moments and test attempts will all appear
              here as a timeline. Keep studying and watch it grow.
            </div>
          </div>
        ) : (
          <>
            {groups.map(g => (
              <div key={g.day} className="mb-5">
                <div className="text-[11px] font-bold uppercase tracking-wide mb-2 px-1" style={{ color: T.muted }}>
                  {g.day}
                </div>
                <div className="space-y-2">
                  {g.items.map((item, i) => {
                    const meta = KIND_META[item.kind] || KIND_META.revision;
                    return (
                      <div key={item.id}
                           className="search-row-in flex items-start gap-3 rounded-2xl px-3.5 py-3"
                           style={{ background: T.surface, border: `1px solid ${T.border}`,
                                    animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                        <span className="w-8 h-8 mt-0.5 rounded-full flex-shrink-0 flex items-center justify-center"
                              style={{ background: meta.color + '15' }}>
                          <meta.Icon size={15} style={{ color: meta.color }} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium leading-snug" style={{ color: T.ink }}>
                            {item.title}
                          </span>
                          <span className="flex items-center gap-2 mt-0.5">
                            {item.sub && <span className="text-xs" style={{ color: T.muted }}>{item.sub}</span>}
                            <span className="text-[10px] tabular-nums" style={{ color: T.muted }}>
                              {new Date(item.ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {visibleCount < feed.length && (
              <div ref={sentinelRef} className="py-6 text-center text-xs" style={{ color: T.muted }}>
                Loading more…
              </div>
            )}
            {visibleCount >= feed.length && feed.length > PAGE && (
              <div className="py-6 text-center text-xs" style={{ color: T.muted }}>
                That’s the whole story so far ✨
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
