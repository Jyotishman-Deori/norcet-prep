// =====================================================================
// src/screens/learn-topics.jsx — concept-cards topic list (A1 slice 26)
// Extracted from App.jsx. Body byte-identical; changes are the A7 hook lines
// (T -> useTheme; fgOnDark -> useFgOnDark, slice 25). Props stay { onPick,
// onBack }. (`data` was useContent's return destructured to `cc`, not App data.)
// =====================================================================
import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFgOnDark } from '../lib/theme-helpers.js';
import { Card, TopBar } from '../ui/primitives.jsx';
import { ContentGate } from '../ui/content-gate.jsx';
import { TOPICS } from '../data/seed.js';
import { useContent } from '../lib/content.js';

function LearnTopics({ onPick, onBack }) {
  const { theme: T } = useTheme();
  const fgOnDark = useFgOnDark();
  // A2 — concept cards are now loaded lazily from /public/data/concept-cards.json.
  const { data: cc, loading, error, reload } = useContent('conceptCards');
  const CONCEPT_CARDS = cc || {};
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

        {(!cc) ? (
          <ContentGate loading={loading} error={error} onRetry={reload} label="concept cards" />
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default LearnTopics;
