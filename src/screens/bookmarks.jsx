// =====================================================================
// src/screens/bookmarks.jsx — read-only bookmarks viewer w/ TOC (A1 slice 30)
// Extracted from App.jsx. Body byte-identical except:
//   (1) signature: { data, allQuestions, onToggleBookmark, onBack }
//                -> { onToggleBookmark, onBack }   (data+allQuestions->useData)
//   (2) inserted A7 hook lines: useTheme (T), useData (data, allQuestions),
//       useFgOnDark (fgOnDark).
// Render site drops data=/allQuestions= props. TOPICS from data/seed; TTSButton
// from ui/question-widgets.
// =====================================================================
import React, { useState, useMemo } from 'react';
import { Bookmark, BookmarkCheck, Brain, Calculator, Check, ChevronLeft, Lightbulb } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { useFgOnDark } from '../lib/theme-helpers.js';
import { TOPICS } from '../data/seed.js';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import { TTSButton } from '../ui/question-widgets.jsx';
import { confirmBookmarkToggle } from '../ui/bookmark-actions.jsx';
import { useContent } from '../lib/content.js';
import { useBackHandler } from '../lib/back-handler.js';
import EmptyState from '../ui/empty-state.jsx';

function BookmarksScreen({ onToggleBookmark, onBack, onStartQuiz }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { data, allQuestions } = useData();
  const fgOnDark = useFgOnDark();
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
  // BUG-01 — device/browser back returns from a bookmark's DETAIL view to the
  // index first (mirrors the on-screen ← arrow), instead of leaving the screen.
  useBackHandler(() => {
    if (selectedId !== null) { setSelectedId(null); return true; }
    return false;
  });
  // #19 — unbookmark with a smooth exit: ids currently fading out. The actual
  // removal (onToggleBookmark) fires after the 280ms row-fade-out completes,
  // so the card never vanishes instantly — and the empty state appears only
  // after the last animation has finished.
  const [removing, setRemoving] = useState(() => new Set());
  const removeWithFade = (qId) => {
    setRemoving(prev => new Set(prev).add(qId));
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    setTimeout(() => {
      onToggleBookmark(qId);
      setRemoving(prev => { const n = new Set(prev); n.delete(qId); return n; });
    }, 280);
  };

  // Rebuilds whenever data.bookmarks changes so live un-bookmark works.
  const itemIds = useMemo(() => new Set(data.bookmarks || []), [data.bookmarks]);

  // #4 — dosage-calc questions live in a separate content pool (dosage.json),
  // not allQuestions, and have no topic/options. Load that pool so bookmarked
  // dosage questions resolve and render here too (instead of silently vanishing).
  // They're grouped under a synthetic "Dosage calc" topic and rendered with a
  // dosage-specific detail view below.
  const { data: dosagePool } = useContent('dosage');
  const DOSAGE_TOPIC = '__dosage__';
  const topicMeta = (tid) => tid === DOSAGE_TOPIC
    ? { name: 'Dosage calc', icon: '🧮', color: T.primary }
    : (TOPICS.find(x => x.id === tid) || { name: tid, color: T.muted, icon: '' });

  const dosageBookmarked = useMemo(
    () => (dosagePool || []).filter(q => itemIds.has(q.id)).map(q => ({ ...q, topic: DOSAGE_TOPIC, _dosage: true })),
    [dosagePool, itemIds]
  );

  // All bookmarked questions, ordered as they appear in allQuestions for
  // predictable index ordering; dosage bookmarks are appended as their own group.
  const allBookmarked = useMemo(
    () => [...allQuestions.filter(q => itemIds.has(q.id)), ...dosageBookmarked],
    [allQuestions, itemIds, dosageBookmarked]
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
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          text="Tap the bookmark icon on any question during a quiz to save it here for later."
          actionLabel={onStartQuiz ? 'Start a Quiz' : undefined}
          onAction={onStartQuiz} />
      </div>
    );
  }

  // ===== DETAIL PAGE: a single bookmark, opened from the index =====
  if (selectedId !== null) {
    const q = allBookmarked.find(x => x.id === selectedId) || allQuestions.find(x => x.id === selectedId);
    // If the bookmark was removed elsewhere or the question vanished, bounce
    // back to the index gracefully.
    if (!q) {
      // Clear during render is unsafe; defer via effect would over-engineer.
      // The safe move is to render a tiny "not found" with a back action.
      return (
        <div className="anim-fadeup">
          <TopBar title="Bookmark" onBack={() => setSelectedId(null)} feedback={{ screen: "Bookmark detail" }} />
          <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-16 pb-24 text-center">
            <div className="text-sm" style={{ color: T.muted }}>This bookmark is no longer available.</div>
            <Button onClick={() => setSelectedId(null)} className="mt-4">Back to index</Button>
          </div>
        </div>
      );
    }

    const topic = TOPICS.find(x => x.id === q.topic);

    // #4 — dosage bookmarks render their own detail (order + worked answer),
    // since they have no options/explanation to show like an MCQ.
    if (q._dosage) {
      const dTts = `${q.q} Answer: ${q.answer} ${q.unit}.`;
      return (
        <div className="anim-fadeup">
          <TopBar title="Bookmark" onBack={() => setSelectedId(null)}
                  feedback={{ screen: "Bookmark detail", questionId: q.id }} />
          <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-2 pb-24">
            <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full text-[11px] font-medium"
                 style={{ background: T.primary + '18', color: T.primary }}>
              <Calculator size={12} /> Dosage calc{q.type ? ` · ${q.type}` : ''}
            </div>
            <div className="font-display text-lg leading-snug mb-4 whitespace-pre-wrap" style={{ color: T.ink }}>{q.q}</div>
            <div className="flex items-center gap-2 mb-5">
              <TTSButton text={dTts} label="Read aloud" tone="soft" />
              <button onClick={() => confirmBookmarkToggle(true, () => { onToggleBookmark(q.id); setSelectedId(null); })}
                      className="no-tap-highlight inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium active:scale-95"
                      style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>
                <BookmarkCheck size={12} /> Remove
              </button>
            </div>
            <div className="rounded-2xl p-4 mb-4" style={{ background: T.successSoft, border: `1.5px solid ${T.success}40` }}>
              <div className="text-[10px] uppercase tracking-wider mb-0.5 font-semibold" style={{ color: T.muted }}>Correct answer</div>
              <div className="font-display text-2xl font-semibold tabular-nums" style={{ color: T.ink }}>{q.answer} {q.unit}</div>
            </div>
            {Array.isArray(q.steps) && q.steps.length > 0 && (
              <div className="rounded-2xl p-4 mb-4" style={{ background: T.surfaceWarm }}>
                <div className="text-[10px] uppercase tracking-wider mb-2 font-semibold" style={{ color: T.muted }}>Working</div>
                <ol className="space-y-1.5">
                  {q.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm" style={{ color: T.inkSoft }}>
                      <span className="font-mono text-xs mt-0.5 flex-shrink-0" style={{ color: T.muted }}>{i + 1}.</span>
                      <span className="flex-1">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {q.intuition && (
              <div className="rounded-2xl p-4" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}26` }}>
                <div className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: T.primary }}>Intuition</div>
                <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{q.intuition}</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    const ttsText = `${q.q}. Options: ${q.options.map((o, i) => String.fromCharCode(65 + i) + ': ' + o).join('. ')}. Correct: ${q.correct.map(i => String.fromCharCode(65 + i)).join(', ')}. ${q.exp}`;

    return (
      <div className="anim-fadeup">
        <TopBar title="Bookmark" onBack={() => setSelectedId(null)}
                feedback={{ screen: "Bookmark detail", questionId: q.id }} />
        <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-2 pb-24">

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
            <button onClick={() => confirmBookmarkToggle(true, () => { onToggleBookmark(q.id); setSelectedId(null); })}
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

          {/* Memory tip — same amber treatment as the quiz, shown during revision */}
          {q.memoryTip && (
            <Card className="p-4 mb-3 overflow-hidden"
                  style={{
                    background: IS_DARK ? '#2A2010' : '#FFF8E8',
                    border: `1px solid #D4900A33`,
                    borderLeft: `3px solid #D4900A`
                  }}>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={14} style={{ color: '#D4900A' }} />
                <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#D4900A' }}>Memory tip</div>
              </div>
              <div className="text-sm leading-relaxed" style={{ color: T.ink }}>
                {q.memoryTip}
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
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pt-2 pb-24">

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
              const t = topicMeta(tid);
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
            const t = topicMeta(group.topic);
            return (
              <div key={group.topic} className="seq-item" style={{ animationDelay: `${Math.min(gi, 8) * 110}ms` }}>
                <div className="flex items-center gap-1.5 mb-2 px-1 text-[11px] uppercase tracking-wider font-semibold"
                     style={{ color: t?.color || T.muted }}>
                  <span>{t?.icon}</span>
                  <span>{t?.name || group.topic}</span>
                  <span style={{ color: T.muted, fontWeight: 400 }}>· {group.questions.length}</span>
                </div>
                <Card className="overflow-hidden">
                  {group.questions.map((q, qi) => (
                    <div key={q.id}
                         className={"w-full flex items-start gap-1 " + (removing.has(q.id) ? 'row-fade-out' : '')}
                         style={{
                           borderBottom: qi < group.questions.length - 1 ? `1px solid ${T.borderSoft}` : 'none'
                         }}>
                      <button onClick={() => setSelectedId(q.id)}
                              className="no-tap-highlight flex-1 min-w-0 text-left pl-3 py-3 flex items-start gap-2.5 active:bg-black/5 transition-colors">
                        <span className="text-[10px] flex-shrink-0 mt-1 font-mono tabular-nums"
                              style={{ color: T.muted }}>{(gi + 1)}.{(qi + 1).toString().padStart(2, '0')}</span>
                        <span className="text-sm leading-snug flex-1" style={{ color: T.ink }}>
                          {stemPreview(q.q)}
                        </span>
                      </button>
                      {/* #19 — filled bookmark = saved; one tap removes it
                          (fade-out, then the data updates). No confirm dialog —
                          unbookmarking is as frictionless as bookmarking. */}
                      <button onClick={() => confirmBookmarkToggle(true, () => removeWithFade(q.id))}
                              aria-label="Remove bookmark"
                              className="no-tap-highlight p-2.5 mt-0.5 flex-shrink-0 rounded-full active:bg-black/5">
                        <BookmarkCheck size={16} className={removing.has(q.id) ? 'bm-deflate' : ''} style={{ color: T.accent }} />
                      </button>
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>

        {items.length === 0 && itemIds.size > 0 && (
          <div className="text-center py-10 text-sm" style={{ color: T.muted }}>
            No bookmarks in this topic, try another filter.
          </div>
        )}
      </div>
    </div>
  );
}

export default BookmarksScreen;
