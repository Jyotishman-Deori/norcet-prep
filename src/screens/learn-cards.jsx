// =====================================================================
// src/screens/learn-cards.jsx — swipeable concept-card reader (A1 slice 28)
// Extracted from App.jsx. Body byte-identical except the A7 hook lines:
//   T      -> useTheme().theme
//   IS_DARK-> useTheme().isDark
//   fgOnDark-> useFgOnDark()  (slice-25 hook)
// Props stay { topicId, subFilter, onBack }; render site UNCHANGED. Pairs with
// the slice-26 LearnTopics; topicName from lib/topics, lazy cards via useContent.
// =====================================================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Sparkles, ListChecks, Brain, ArrowLeft, ChevronRight, Check, Eye, Lightbulb, ChevronLeft } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFgOnDark } from '../lib/theme-helpers.js';
import { useContent } from '../lib/content.js';
import { ContentGate } from '../ui/content-gate.jsx';
import { topicName } from '../lib/topics.js';
import { Card, Pill, Button, TopBar } from '../ui/primitives.jsx';

function LearnCards({ topicId, subFilter, onBack }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const fgOnDark = useFgOnDark();
  // A2 — concept cards loaded lazily from /public/data/concept-cards.json.
  const { data: cc, loading, error, reload } = useContent('conceptCards');
  const subs = (cc && cc[topicId]) || [];
  // If a specific module was requested from LearnTopics, only render its
  // cards. Falling back to the full topic preserves the "Start all" path.
  const allCards = useMemo(() => {
    const arr = [];
    subs.forEach(s => {
      if (subFilter && s.sub !== subFilter) return;
      s.cards.forEach(c => arr.push({ ...c, sub: s.sub }));
    });
    return arr;
  }, [topicId, subFilter, cc]);

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
    // A2 — distinguish "still loading / failed to load" from a genuinely
    // empty topic so the message is honest (and offers retry on failure).
    if (!cc && (loading || error)) {
      return (
        <div className="anim-fadeup">
          <TopBar title="Concept cards" onBack={onBack} />
          <div className="max-w-md mx-auto px-4">
            <ContentGate loading={loading} error={error} onRetry={reload} label="concept cards" />
          </div>
        </div>
      );
    }
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

export default LearnCards;
