// =====================================================================
// src/screens/learn-topics.jsx — concept-cards topic list + Quick Revision
// F-D UPGRADE: (1) a Study / Quick-Revision mode toggle at the top; (2) study
// mode gains per-topic & per-module read-time and a "continue where you left
// off" banner; (3) quick mode renders the app-curated revision stream. Props
// onPick/onBack unchanged; new (optional) ranking-signal props come from App.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Clock, Layers, Sparkles, GraduationCap, RotateCcw, Flag } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { useFgOnDark } from '../lib/theme-helpers.js';
import { Card, TopBar } from '../ui/primitives.jsx';
import { ContentGate } from '../ui/content-gate.jsx';
import { TOPICS } from '../data/seed.js';
import { topicName } from '../lib/topics.js';
import { useContent } from '../lib/content.js';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { buildQuickRevisionPlan, cardBudget, buildRevisionStream, readMinutes } from '../lib/quick-revision.js';
import { loadDoubts, unresolvedCards, unresolvedCount } from '../lib/doubts.js';
import QuickRevisionView from '../ui/quick-revision-view.jsx';

function LearnTopics({ onPick, onBack, onOpenDoubts, weakTopics = [], dueTopicIds = [], examDaysLeft = null }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const fgOnDark = useFgOnDark();
  const profileId = (profile && profile.id) || 'guest';
  const { data: cc, loading, error, reload } = useContent('conceptCards');
  const CONCEPT_CARDS = cc || {};
  const topicsWithCards = TOPICS.filter(t => CONCEPT_CARDS[t.id] && CONCEPT_CARDS[t.id].length > 0);
  const [expanded, setExpanded] = useState(null);
  const [mode, setMode] = useState('study'); // 'study' | 'quick'
  const [resume, setResume] = useState(null);
  const [recentTopics, setRecentTopics] = useState([]);
  const [doubtMap, setDoubtMap] = useState({});
  const totalCards = topicsWithCards.reduce((acc, t) => acc + CONCEPT_CARDS[t.id].reduce((a, s) => a + s.cards.length, 0), 0);

  // F-D — load resume + recently-studied (local, per profile).
  useEffect(() => {
    let alive = true;
    safeStorage.get(`${KEYS.LEARN_RESUME}${profileId}`, false).then(r => {
      if (!alive) return;
      try { const v = r && r.value ? JSON.parse(r.value) : null; if (v && v.topicId) setResume(v); } catch (e) {}
    }).catch(() => {});
    safeStorage.get(`${KEYS.LEARN_RECENT}${profileId}`, false).then(r => {
      if (!alive) return;
      try { const v = r && r.value ? JSON.parse(r.value) : []; if (Array.isArray(v)) setRecentTopics(v); } catch (e) {}
    }).catch(() => {});
    loadDoubts(profileId).then(m => { if (alive) setDoubtMap(m); }).catch(() => {});
    return () => { alive = false; };
  }, [profileId]);

  // Quick-revision plan + stream (only meaningful once cards are loaded).
  const availableTopics = topicsWithCards.map(t => t.id);
  const budget = cardBudget(examDaysLeft);
  const plan = buildQuickRevisionPlan({ weakTopics, dueTopicIds, recentTopics, availableTopics, examDaysLeft });
  const stream = cc ? buildRevisionStream(plan, CONCEPT_CARDS, budget, unresolvedCards(doubtMap)) : [];
  const openDoubts = unresolvedCount(doubtMap);

  const resumeValid = resume && CONCEPT_CARDS[resume.topicId];

  const Toggle = () => (
    <div className="flex p-1 rounded-2xl mb-4" style={{ background: T.surfaceWarm }}>
      {[{ id: 'study', label: 'Study mode', icon: <GraduationCap size={14} /> },
        { id: 'quick', label: 'Quick revision', icon: <Sparkles size={14} /> }].map(t => {
        const on = mode === t.id;
        return (
          <button key={t.id} onClick={() => setMode(t.id)}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[13px] font-semibold transition"
                  style={{ background: on ? T.surface : 'transparent', color: on ? T.primary : T.muted, boxShadow: on ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            {t.icon}{t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="anim-fadeup">
      <TopBar title="Learn topic wise" onBack={onBack} feedback={{ screen: "Learn — topics" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="px-1 mb-4">
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>
            {mode === 'quick' ? 'Quick revision' : 'Concept cards'}
          </div>
          <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
            {mode === 'quick'
              ? 'A fast, smart sweep of the points that matter most for you right now.'
              : `Bite-sized notes across ${topicsWithCards.length} topics · ${totalCards} cards. Open a topic to pick a module, or read it top-to-bottom.`}
          </div>
        </div>

        {(!cc) ? (
          <ContentGate loading={loading} error={error} onRetry={reload} label="concept cards" />
        ) : (
          <>
            <Toggle />

            {/* F-E — review-doubts entry (shown when there are unresolved flags). */}
            {openDoubts > 0 && onOpenDoubts && (
              <Card className="p-3.5 mb-3 cursor-pointer no-tap-highlight pressable"
                    onClick={onOpenDoubts}
                    style={{ borderLeft: `3px solid ${T.error}`, background: T.error + '0C' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.error + '18' }}>
                    <Flag size={16} style={{ color: T.error, fill: T.error }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: T.ink }}>
                      {openDoubts} doubt{openDoubts === 1 ? '' : 's'} to review
                    </div>
                    <div className="text-[11px]" style={{ color: T.muted }}>Points you flagged as unclear</div>
                  </div>
                  <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0" />
                </div>
              </Card>
            )}

            {mode === 'quick' ? (
              <QuickRevisionView stream={stream} examDaysLeft={examDaysLeft} onPick={onPick} />
            ) : (
              <>
                {/* Resume banner */}
                {resumeValid && (
                  <Card className="p-3.5 mb-3 cursor-pointer no-tap-highlight pressable"
                        onClick={() => onPick(resume.topicId, resume.sub || null)}
                        style={{ borderLeft: `3px solid ${T.primary}`, background: T.primary + '0C' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '18' }}>
                        <RotateCcw size={16} style={{ color: T.primary }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.primary }}>Continue where you left off</div>
                        <div className="text-sm font-medium truncate" style={{ color: T.ink }}>
                          {topicName(resume.topicId)}{resume.sub ? ` · ${resume.sub}` : ''}
                        </div>
                      </div>
                      <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0" />
                    </div>
                  </Card>
                )}

                <div className="space-y-3">
                  {topicsWithCards.map(topic => {
                    const subs = CONCEPT_CARDS[topic.id];
                    const cardCount = subs.reduce((acc, s) => acc + s.cards.length, 0);
                    const topicMins = readMinutes(subs.reduce((a, s) => a.concat(s.cards), []));
                    const isOpen = expanded === topic.id;
                    return (
                      <Card key={topic.id} className="overflow-hidden transition-shadow"
                            style={{ borderLeft: `3px solid ${topic.color}`,
                                     boxShadow: isOpen ? `0 6px 20px ${topic.color}1A` : '0 1px 2px rgba(26,43,35,0.04)' }}>
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
                                  <span className="inline-flex items-center gap-1"><Clock size={11} /> {topicMins} min</span>
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
                                <ChevronDown size={16} className="transition-transform duration-200"
                                             style={{ color: T.muted, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                              </button>
                            </div>
                          </div>
                        </div>

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
                                      <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: T.muted }}>
                                        <span>{s.cards.length} card{s.cards.length === 1 ? '' : 's'}</span>
                                        <span className="inline-flex items-center gap-0.5"><Clock size={9} /> {readMinutes(s.cards)} min</span>
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
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LearnTopics;
