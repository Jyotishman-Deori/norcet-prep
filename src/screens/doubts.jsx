// =====================================================================
// src/screens/doubts.jsx  (Feature F-E — Doubt Flag, + #18 Question flags)
// The dedicated "My Doubts" review space, now with TWO top-level tabs:
//   Concepts  — revision-note point flags (F-E, unchanged behaviour)
//   Questions — #18 question SOLUTION flags ("explanation still unclear"),
//               flagged from the quiz explanation screen. Tap to expand the
//               full question + options + explanation; resolve manually here
//               or automatically by answering the question correctly later.
// Each top-level tab shares the Unresolved / Resolved sub-filter. Resolve is
// one tap (archived, never deleted); items deep-link back to the topic.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Flag, Check, ChevronDown, ChevronRight, ChevronUp, HelpCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useTheme, useProfile, useData } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';
import { topicName, topicColor } from '../lib/topics.js';
import { loadDoubts, saveDoubts, setResolved, unresolved, resolved, groupByTopic, relativeAge } from '../lib/doubts.js';
import { loadQDoubts, saveQDoubts, setQResolved, unresolvedQ, resolvedQ } from '../lib/qdoubts.js';

function DoubtsScreen({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const { allQuestions } = useData();
  const profileId = (profile && profile.id) || 'guest';
  const [map, setMap] = useState({});
  const [qMap, setQMap] = useState({});
  const [kind, setKind] = useState('concepts'); // 'concepts' | 'questions'
  const [tab, setTab] = useState('open');       // 'open' | 'done'
  const [expanded, setExpanded] = useState(null); // qdoubt id expanded in Questions tab

  useEffect(() => {
    let a = true;
    loadDoubts(profileId).then(m => { if (a) setMap(m); });
    loadQDoubts(profileId).then(m => { if (a) setQMap(m); });
    return () => { a = false; };
  }, [profileId]);

  const resolve = (id, on) => {
    setMap(prev => { const next = setResolved(prev, id, on); saveDoubts(profileId, next); return next; });
  };
  const resolveQ = (id, on) => {
    setQMap(prev => { const next = setQResolved(prev, id, on); saveQDoubts(profileId, next); return next; });
  };

  const openCount = unresolved(map).length;
  const doneCount = resolved(map).length;
  const qOpenCount = unresolvedQ(qMap).length;
  const qDoneCount = resolvedQ(qMap).length;

  // ---- Concepts tab data (unchanged from F-E) ----
  const list = tab === 'open' ? unresolved(map) : resolved(map);
  const grouped = groupByTopic(list);
  const topics = Object.keys(grouped);

  // ---- Questions tab data (#18) ----
  const qList = tab === 'open' ? unresolvedQ(qMap) : resolvedQ(qMap);

  const SubTabs = ({ open, done }) => (
    <div className="flex p-1 rounded-2xl mb-4" style={{ background: T.surfaceWarm }}>
      {[{ id: 'open', label: `Unresolved${open ? ` (${open})` : ''}` },
        { id: 'done', label: `Resolved${done ? ` (${done})` : ''}` }].map(t => {
        const on = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className="no-tap-highlight flex-1 py-2 rounded-xl text-[13px] font-semibold transition"
                  style={{ background: on ? T.surface : 'transparent', color: on ? T.primary : T.muted, boxShadow: on ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="anim-fadeup">
      <TopBar title="My Doubts" onBack={onBack} feedback={{ screen: 'Doubts' }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="px-1 mb-4">
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Doubts</div>
          <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
            {kind === 'concepts'
              ? 'Points you flagged while reading. Re-read them, then mark resolved, they also jump to the top of Quick Revision.'
              : 'Explanations you flagged as unclear after answering. They resolve when you mark them, or automatically when you later get the question right.'}
          </div>
        </div>

        {/* #18 — top-level Concepts / Questions tabs, each with an unresolved badge */}
        <div className="flex gap-2 mb-3">
          {[
            { id: 'concepts',  label: 'Concepts',  badge: openCount },
            { id: 'questions', label: 'Questions', badge: qOpenCount },
          ].map(t => {
            const on = kind === t.id;
            return (
              <button key={t.id} onClick={() => { setKind(t.id); setExpanded(null); }}
                      className="no-tap-highlight flex-1 py-2.5 rounded-2xl text-[13px] font-semibold transition flex items-center justify-center gap-1.5"
                      style={{
                        background: on ? T.primary : T.surface,
                        color: on ? '#FFF' : T.inkSoft,
                        border: `1px solid ${on ? T.primary : T.border}`,
                      }}>
                {t.label}
                {t.badge > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                        style={{ background: on ? 'rgba(255,255,255,0.22)' : T.error + '18', color: on ? '#FFF' : T.error }}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <SubTabs open={kind === 'concepts' ? openCount : qOpenCount}
                 done={kind === 'concepts' ? doneCount : qDoneCount} />

        {/* ===================== CONCEPTS (existing F-E) ===================== */}
        {kind === 'concepts' && (list.length === 0 ? (
          tab === 'open' ? (
            <EmptyState
              icon={Flag}
              title="No doubts flagged yet"
              text="While reading Revision Notes, tap the flag icon next to anything unclear. It will appear here until you resolve it."
              actionLabel={onNavigate ? 'Go to Revision Notes' : undefined}
              onAction={onNavigate ? () => onNavigate({ screen: 'learn-topics' }) : undefined}
              note="Resolving doubts strengthens your Knowledge Map nodes faster." />
          ) : (
            <EmptyState
              icon={Check}
              title="Nothing resolved yet"
              text="Once you re-read a flagged point and mark it resolved, it moves here as a record of progress." />
          )
        ) : (
          <div className="space-y-5">
            {topics.map(topic => (
              <div key={topic}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: topicColor(topic) }} />
                  <div className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>
                    {topicName(topic)} · {grouped[topic].length}
                  </div>
                </div>
                <div className="space-y-2">
                  {grouped[topic].map((d, di) => (
                    <Card key={d.id} className="p-3.5 seq-item" style={{ borderLeft: `3px solid ${tab === 'open' ? T.error : T.success}`, animationDelay: `${Math.min(di, 8) * 80}ms` }}>
                      <div className="flex items-start gap-2 mb-2">
                        <Flag size={14} className="flex-shrink-0 mt-0.5" style={{ color: tab === 'open' ? T.error : T.success, fill: tab === 'open' ? T.error : T.success }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm leading-snug" style={{ color: T.ink }}>{d.text || d.cardTitle}</div>
                          <div className="text-[11px] mt-1" style={{ color: T.muted }}>
                            {d.sub ? `${d.sub} · ` : ''}{relativeAge(tab === 'open' ? d.createdAt : (d.resolvedAt || d.createdAt))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onNavigate && onNavigate({ screen: 'learn-cards', topicId: d.topic, sub: d.sub || null })}
                                className="no-tap-highlight inline-flex items-center gap-1 text-[12px] font-semibold active:scale-95 transition"
                                style={{ color: T.primary }}>
                          Go to topic <ChevronRight size={13} />
                        </button>
                        <div className="flex-1" />
                        {tab === 'open' ? (
                          <button onClick={() => resolve(d.id, true)}
                                  className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition"
                                  style={{ background: T.success + '18', color: T.success }}>
                            <Check size={13} /> Mark resolved
                          </button>
                        ) : (
                          <button onClick={() => resolve(d.id, false)}
                                  className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition"
                                  style={{ background: T.surfaceWarm, color: T.muted }}>
                            <RotateCcw size={13} /> Reopen
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* ===================== QUESTIONS (#18) ===================== */}
        {kind === 'questions' && (qList.length === 0 ? (
          tab === 'open' ? (
            <EmptyState
              icon={HelpCircle}
              title="No question doubts yet"
              text="After answering a question, tap the flag on the explanation to mark it as unclear. We will help you revisit it here." />
          ) : (
            <EmptyState
              icon={Check}
              title="Nothing resolved yet"
              text="Flags clear when you mark them resolved, or automatically, the moment you answer that question correctly." />
          )
        ) : (
          <div className="space-y-2">
            {qList.map((d, di) => {
              const live = allQuestions.find(q => q.id === d.id) || null;
              const isOpen = expanded === d.id;
              return (
                <Card key={d.id} className="p-3.5 seq-item" style={{ borderLeft: `3px solid ${tab === 'open' ? T.error : T.success}`, animationDelay: `${Math.min(di, 8) * 80}ms` }}>
                  <button onClick={() => setExpanded(isOpen ? null : d.id)}
                          className="no-tap-highlight w-full text-left flex items-start gap-2">
                    <Flag size={14} className="flex-shrink-0 mt-0.5"
                          style={{ color: tab === 'open' ? T.error : T.success, fill: tab === 'open' ? T.error : T.success }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-snug" style={{
                        color: T.ink,
                        display: '-webkit-box', WebkitLineClamp: isOpen ? 'unset' : 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {(live && live.q) || d.qSnapshot}
                      </div>
                      <div className="text-[11px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: T.muted }}>
                        {d.topic && <span style={{ color: topicColor(d.topic) }}>{topicName(d.topic)}</span>}
                        {d.sub ? <span>· {d.sub}</span> : null}
                        <span>· {relativeAge(tab === 'open' ? d.createdAt : (d.resolvedAt || d.createdAt))}</span>
                        {d.autoResolved && tab === 'done' && (
                          <span className="inline-flex items-center gap-0.5" style={{ color: T.success }}>
                            · <Sparkles size={10} /> auto-resolved
                          </span>
                        )}
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.muted }} />
                            : <ChevronDown size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.muted }} />}
                  </button>

                  {isOpen && (
                    <div className="anim-fadeup mt-3 pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                      {live ? (
                        <>
                          <div className="space-y-1.5 mb-3">
                            {live.options.map((opt, i) => {
                              const ok = live.correct.includes(i);
                              return (
                                <div key={i} className="flex items-start gap-2 text-[13px] leading-snug px-2.5 py-2 rounded-lg"
                                     style={{ background: ok ? T.successSoft : T.surfaceWarm }}>
                                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold"
                                        style={{ background: ok ? T.success : T.surface, color: ok ? '#FFF' : T.muted, border: `1px solid ${ok ? T.success : T.border}` }}>
                                    {ok ? <Check size={11} /> : String.fromCharCode(65 + i)}
                                  </span>
                                  <span style={{ color: ok ? T.ink : T.inkSoft, fontWeight: ok ? 500 : 400 }}>{opt}</span>
                                </div>
                              );
                            })}
                          </div>
                          {live.exp && (
                            <div className="text-[13px] leading-relaxed whitespace-pre-wrap mb-3 px-1" style={{ color: T.inkSoft }}>
                              {live.exp}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs mb-3 px-1" style={{ color: T.muted }}>
                          This question is no longer in your library (its bank may have been removed).
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        {d.topic && (
                          <button onClick={() => onNavigate && onNavigate({ screen: 'learn-cards', topicId: d.topic, sub: d.sub || null })}
                                  className="no-tap-highlight inline-flex items-center gap-1 text-[12px] font-semibold active:scale-95 transition"
                                  style={{ color: T.primary }}>
                            Go to topic <ChevronRight size={13} />
                          </button>
                        )}
                        <div className="flex-1" />
                        {tab === 'open' ? (
                          <button onClick={() => resolveQ(d.id, true)}
                                  className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition"
                                  style={{ background: T.success + '18', color: T.success }}>
                            <Check size={13} /> Resolved
                          </button>
                        ) : (
                          <button onClick={() => resolveQ(d.id, false)}
                                  className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition"
                                  style={{ background: T.surfaceWarm, color: T.muted }}>
                            <RotateCcw size={13} /> Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DoubtsScreen;
