// =====================================================================
// src/screens/pyq-read.jsx  (#17 — PYQ Read Mode)
// The calm counterpart to the timed paper simulation: browse a previous-year
// paper's questions and answers freely — no timer, no scoring, no pressure.
// Built for the 10–15 minute between-shifts session: scroll, tap "Show
// answer" (the curtain-lift moment), move on.
//
// Connections: the bookmark icon reuses the app-wide toggle (state stays
// consistent with quiz mode); the "Was this helpful?" bulb reuses
// ui/helpful-bulb.jsx with vote id `pyqread:{paperId}:{questionId}`. Read
// sessions deliberately do NOT touch quiz stats or spaced repetition —
// passive reading is revision, not assessment.
// =====================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, BookOpen, Check, ChevronLeft, Eye } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { topicName, topicColor } from '../lib/topics.js';
import { Card, Button, TopBar, EduTag } from '../ui/primitives.jsx';
import { confirmBookmarkToggle } from '../ui/bookmark-actions.jsx';
import HelpfulBulb from '../ui/helpful-bulb.jsx';
import { QuestionImage, QuestionVideo } from '../ui/question-widgets.jsx';

const WINDOW = 20;

function PyqRead({ paper, bookmarks, onToggleBookmark, profileId, isAdmin = false, onBack }) {
  const { theme: T } = useTheme();
  const all = paper.questions || [];

  // Optional subject filter within the paper.
  const [topicFilter, setTopicFilter] = useState('all');
  const topics = useMemo(() => Array.from(new Set(all.map(q => q.topic).filter(Boolean))), [all]);
  const qs = useMemo(() => topicFilter === 'all' ? all : all.filter(q => q.topic === topicFilter), [all, topicFilter]);

  const [revealed, setRevealed] = useState(() => new Set());
  const reveal = (id) => setRevealed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // "Question X of N" — tracks the topmost visible card cheaply.
  const [current, setCurrent] = useState(1);
  const cardRefs = useRef({});
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const n = Number(e.target.getAttribute('data-qnum'));
          if (n) setCurrent(c => (e.boundingClientRect.top < 200 ? n : Math.min(c, n)));
        }
      }
    }, { rootMargin: '-10% 0px -70% 0px' });
    Object.values(cardRefs.current).forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [qs.length, topicFilter]);

  // Incremental render window for big papers.
  const [limit, setLimit] = useState(WINDOW);
  const sentinelRef = useRef(null);
  useEffect(() => { setLimit(WINDOW); }, [topicFilter]);
  useEffect(() => {
    if (limit >= qs.length) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setLimit(qs.length); return; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) setLimit(l => Math.min(qs.length, l + WINDOW));
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [limit, qs.length]);

  const bookmarked = useMemo(() => new Set(bookmarks || []), [bookmarks]);
  const progress = qs.length > 0 ? Math.min(100, Math.round((current / qs.length) * 100)) : 0;

  return (
    <div className="anim-fadeup">
      <TopBar title={`${paper.name || 'Previous paper'} · Read`} onBack={onBack}
              feedback={{ screen: 'PYQ read mode' }} />

      {/* sticky progress strip — calm, no countdown */}
      <div className="sticky z-20 max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8" style={{ top: 'calc(60px + env(safe-area-inset-top, 0px))' }}>
        <div className="rounded-b-2xl px-3 py-2" style={{ background: T.bg + 'F2', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: T.muted }}>
            <span className="inline-flex items-center gap-1"><BookOpen size={11} /> Question {Math.min(current, qs.length)} of {qs.length}</span>
            <span>{revealed.size} answer{revealed.size === 1 ? '' : 's'} revealed</span>
          </div>
          <div className="h-1 rounded-full" style={{ background: T.borderSoft }}>
            <div className="h-1 rounded-full transition-all duration-300" style={{ background: T.sec.mock, width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-3 pb-24">
        {/* subject filter chips */}
        {topics.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setTopicFilter('all')}
                    className="no-tap-highlight px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors"
                    style={{ background: topicFilter === 'all' ? T.primary : T.surface, color: topicFilter === 'all' ? '#FFF' : T.inkSoft, border: `1px solid ${topicFilter === 'all' ? T.primary : T.border}` }}>
              All · {all.length}
            </button>
            {topics.map(tid => {
              const active = topicFilter === tid;
              const count = all.filter(q => q.topic === tid).length;
              return (
                <button key={tid} onClick={() => setTopicFilter(tid)}
                        className="no-tap-highlight px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors"
                        style={{ background: active ? topicColor(tid) : T.surface, color: active ? '#FFF' : T.inkSoft, border: `1px solid ${active ? topicColor(tid) : T.border}` }}>
                  {topicName(tid)} · {count}
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-3">
          {qs.slice(0, limit).map((q, i) => {
            const isRevealed = revealed.has(q.id);
            const isBm = bookmarked.has(q.id);
            return (
              <div key={q.id || i} data-qnum={i + 1}
                   ref={el => { cardRefs.current[q.id || i] = el; }}>
              <Card className="p-4 seq-item"
                    style={{ animationDelay: `${Math.min(i, 8) * 80}ms` }}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-[11px] font-mono font-semibold mt-1 flex-shrink-0" style={{ color: T.muted }}>Q{i + 1}</span>
                  <div className="text-sm flex-1" style={{ color: T.ink, lineHeight: 1.6 }}>{q.q}</div>
                  {onToggleBookmark && (
                    <button onClick={() => confirmBookmarkToggle(isBm, () => onToggleBookmark(q.id))}
                            aria-pressed={isBm}
                            aria-label={isBm ? 'Remove bookmark' : 'Bookmark this question'}
                            className="no-tap-highlight p-1.5 -mr-1 -mt-1 rounded-full active:bg-black/5 flex-shrink-0">
                      <span className="inline-block" style={{ lineHeight: 0 }}>
                        {isBm ? <BookmarkCheck size={17} className="text-accent bm-pop" /> : <Bookmark size={17} className="text-muted" />}
                      </span>
                    </button>
                  )}
                </div>

                {/* Media round — image PYQs render their figure/video in read mode too. */}
                <QuestionImage q={q} />
                <QuestionVideo q={q} />

                <div className="space-y-1.5 mb-3">
                  {q.options.map((opt, oi) => {
                    const ok = isRevealed && q.correct.includes(oi);
                    return (
                      <div key={oi} className="flex items-start gap-2 text-[13px] leading-snug px-2.5 py-2 rounded-lg transition-colors"
                           style={{
                             background: ok ? T.successSoft : T.surface,
                             border: `1px solid ${ok ? T.success + '60' : T.borderSoft}`,
                           }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold"
                              style={{ background: ok ? T.success : T.surface, color: ok ? '#FFF' : T.muted, border: `1px solid ${ok ? T.success : T.border}` }}>
                          {ok ? <Check size={11} /> : String.fromCharCode(65 + oi)}
                        </span>
                        <span className="pt-0.5" style={{ color: ok ? T.ink : T.inkSoft, fontWeight: ok ? 500 : 400 }}>{opt}</span>
                      </div>
                    );
                  })}
                </div>

                {!isRevealed ? (
                  <button onClick={() => reveal(q.id)}
                          className="no-tap-highlight w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold active:scale-95 transition"
                          style={{ background: T.sec.mock + '15', color: T.sec.mock, border: `1.5px dashed ${T.sec.mock}50` }}>
                    <Eye size={13} /> Show answer
                  </button>
                ) : (
                  <div className="anim-fadeup">
                    {q.exp && (
                      <div className="text-[13px] leading-relaxed whitespace-pre-wrap mb-2.5 px-1" style={{ color: T.inkSoft }}>
                        {q.exp}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <HelpfulBulb voteId={`pyqread:${paper.id}:${q.id}`} profileId={profileId} isAdmin={isAdmin} compact />
                      <button onClick={() => reveal(q.id)}
                              className="no-tap-highlight text-[11px] font-medium active:scale-95 transition"
                              style={{ color: T.muted }}>
                        Hide answer
                      </button>
                    </div>
                  </div>
                )}
              </Card>
              </div>
            );
          })}
        </div>

        {limit < qs.length ? (
          <div ref={sentinelRef} className="py-6 text-center text-xs" style={{ color: T.muted }}>
            Loading more questions…
          </div>
        ) : qs.length > 0 && (
          <Card className="p-5 mt-4 text-center" style={{ background: T.successSoft, border: `1px solid ${T.success}30` }}>
            <Check size={20} className="mx-auto mb-2" style={{ color: T.success }} />
            <div className="font-display text-base font-semibold mb-1" style={{ color: T.ink }}>
              You've read all {qs.length} question{qs.length === 1 ? '' : 's'}{topicFilter !== 'all' ? ' in this subject' : ' in this paper'}
            </div>
            <div className="text-xs mb-4" style={{ color: T.muted }}>No score, no pressure. That was revision, and it counts.</div>
            <Button onClick={onBack} variant="ghost" className="w-full" icon={<ChevronLeft size={15} />}>
              Read another paper
            </Button>
          </Card>
        )}

        {/* Layer 3 — quiet educational footnote (screenshot-safe context). */}
        <EduTag className="mt-6" />
      </div>
    </div>
  );
}

export default PyqRead;
