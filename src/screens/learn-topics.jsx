// =====================================================================
// src/screens/learn-topics.jsx — concept-cards topic list + Quick Revision
// F-D UPGRADE: (1) a Study / Quick-Revision mode toggle at the top; (2) study
// mode gains per-topic & per-module read-time and a "continue where you left
// off" banner; (3) quick mode renders the app-curated revision stream. Props
// onPick/onBack unchanged; new (optional) ranking-signal props come from App.
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, BookMarked, Check, ChevronDown, ChevronRight, Clock, Layers, Route, Sparkles, GraduationCap, RotateCcw, Flag } from 'lucide-react';
import { useTheme, useProfile, useData } from '../lib/app-context.jsx';
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
// M1 — the sequential Learn PATH (prereq-ordered units + mastery rings +
// recommended-next) and the per-unit Guidebook digest.
import { buildLearnPath, compileGuidebook, PATH_REASON_LABEL } from '../lib/learn-path.js';
import { KMAP_STATE_LABEL } from '../lib/kmap.js';
import UnitGuidebook from '../ui/unit-guidebook.jsx';

function LearnTopics({ onPick, onBack, onOpenDoubts, onStartQuickTest, weakTopics = [], dueTopicIds = [], examDaysLeft = null }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const { data, allQuestions } = useData();
  const fgOnDark = useFgOnDark();
  const profileId = (profile && profile.id) || 'guest';
  const { data: cc, loading, error, reload } = useContent('conceptCards');
  const CONCEPT_CARDS = cc || {};
  const topicsWithCards = TOPICS.filter(t => CONCEPT_CARDS[t.id] && CONCEPT_CARDS[t.id].length > 0);
  const [expanded, setExpanded] = useState(null);
  const [mode, setMode] = useState('path'); // 'path' | 'study' | 'quick'
  // M1 — the ordered unit timeline (quiz-derived states; no reading tracker).
  const pathNodes = useMemo(
    () => buildLearnPath({ history: data && data.history, allQuestions, topics: topicsWithCards }),
    [data && data.history, allQuestions, cc]
  );
  const [guideTopicId, setGuideTopicId] = useState(null);
  const guideTopic = guideTopicId ? topicsWithCards.find(t => t.id === guideTopicId) : null;
  const guidebook = useMemo(
    () => (guideTopicId ? compileGuidebook(guideTopicId, CONCEPT_CARDS) : null),
    [guideTopicId, cc]
  );
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
      {[{ id: 'path', label: 'Path', icon: <Route size={14} /> },
        { id: 'study', label: 'Modules', icon: <GraduationCap size={14} /> },
        { id: 'quick', label: 'Quick', icon: <Sparkles size={14} /> }].map(t => {
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

  // M1 — one Learn-path node: mastery ring (progress toward the NEXT state)
  // around the unit emoji, name + state chips, Guidebook + modules actions.
  // Alternating sides give the timeline its gentle "snake". No hard locks.
  const PathNode = ({ n, i }) => {
    const topic = topicsWithCards.find(t => t.id === n.topicId);
    if (!topic) return null;
    const ratio = n.state === 'mastered' ? 1 : (n.next && n.next.ratio) || 0;
    const R = 25, C = 2 * Math.PI * R;
    const ringColor = n.state === 'locked' ? T.border : topic.color;
    const right = i % 2 === 1;
    return (
      <div className={`path-node-in relative flex items-center gap-3 py-2.5 ${right ? 'flex-row-reverse' : ''}`}
           style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}>
        {/* Ring node */}
        <button onClick={() => onPick(n.topicId, null)}
                aria-label={`Open ${n.name}`}
                className={`no-tap-highlight relative flex-shrink-0 active:scale-95 transition-transform rounded-full ${n.recommended ? 'path-reco-pulse' : ''}`}
                style={n.recommended ? { '--path-reco-glow': topic.color + '59' } : undefined}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={R} fill={T.surface} stroke={T.borderSoft} strokeWidth="4" />
            <circle cx="32" cy="32" r={R} fill="none" stroke={ringColor} strokeWidth="4"
                    strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ratio)}
                    transform="rotate(-90 32 32)" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl">{topic.icon}</span>
          {n.state === 'mastered' && (
            <span className="absolute -right-0.5 -top-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: '#D97706', boxShadow: '0 2px 6px rgba(217,119,6,0.5)' }}>
              <Check size={11} color="#FFF" strokeWidth={3} />
            </span>
          )}
        </button>

        {/* Info card */}
        <div className={`flex-1 min-w-0 rounded-2xl px-3.5 py-3 ${right ? 'text-right' : ''}`}
             style={{ background: T.surface, border: `1px solid ${n.recommended ? topic.color + '66' : T.border}` }}>
          {n.recommended && (
            <div className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${right ? 'text-right' : ''}`}
                 style={{ color: topic.color }}>
              {PATH_REASON_LABEL[n.reason] || 'Up next'}
            </div>
          )}
          <div className="font-display text-sm font-semibold leading-tight truncate" style={{ color: T.ink }}>
            {n.name}
          </div>
          <div className={`flex items-center gap-1.5 flex-wrap mt-1.5 ${right ? 'justify-end' : ''}`}>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: ringColor + '18', color: n.state === 'locked' ? T.muted : fgOnDark(topic.color) }}>
              {KMAP_STATE_LABEL[n.state]}
            </span>
            {n.attempted > 0 && (
              <span className="text-[10px]" style={{ color: T.muted }}>
                {n.attempted} attempts · {Math.round(n.accuracy * 100)}%
              </span>
            )}
          </div>
          <div className={`flex items-center gap-1.5 mt-2 ${right ? 'justify-end' : ''}`}>
            <button onClick={() => setGuideTopicId(n.topicId)}
                    className="no-tap-highlight inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition"
                    style={{ background: topic.color + '14', color: fgOnDark(topic.color) }}>
              <BookMarked size={11} /> Guidebook
            </button>
            <button onClick={() => { setMode('study'); setExpanded(n.topicId); }}
                    className="no-tap-highlight inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition"
                    style={{ background: T.surfaceWarm, color: T.inkSoft }}>
              <Layers size={11} /> Modules
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Learn topic wise" onBack={onBack} feedback={{ screen: "Learn: topics" }} />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pb-24 pt-2">
        <div className="px-1 mb-4">
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>
            {mode === 'quick' ? 'Quick revision' : mode === 'path' ? 'Your learning path' : 'Concept cards'}
          </div>
          <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
            {mode === 'quick'
              ? 'A fast, smart sweep of the points that matter most for you right now.'
              : mode === 'path'
              ? 'Units in study order, foundations first. Rings fill as you practise; nothing is locked, the pulse just shows your best next step.'
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

            {mode === 'path' && (
              <div className="relative">
                {/* Central spine the alternating nodes hang off. */}
                <div aria-hidden="true" className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2"
                     style={{ background: `linear-gradient(${T.borderSoft}, ${T.border}, ${T.borderSoft})` }} />
                {pathNodes.map((n, i) => <PathNode key={n.topicId} n={n} i={i} />)}
              </div>
            )}

            {mode === 'quick' && (
              <QuickRevisionView stream={stream} examDaysLeft={examDaysLeft} onPick={onPick} onStartQuiz={onStartQuickTest} />
            )}

            {mode === 'study' && (
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
                      <Card key={topic.id} className="overflow-hidden transition-all duration-200"
                            style={{ borderLeft: `3px solid ${topic.color}`,
                                     background: `linear-gradient(135deg, ${topic.color}0F 0%, ${T.surface} 52%)`,
                                     boxShadow: isOpen ? `0 8px 24px ${topic.color}22` : `0 2px 10px ${topic.color}12` }}>
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            <button onClick={() => setExpanded(isOpen ? null : topic.id)}
                                    className="no-tap-highlight flex items-center gap-3.5 flex-1 min-w-0 text-left">
                              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                                   style={{ background: `linear-gradient(140deg, ${topic.color}26, ${topic.color}10)`,
                                            boxShadow: `inset 0 0 0 1px ${topic.color}33, 0 4px 12px ${topic.color}1F` }}>
                                {topic.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-display text-base font-semibold leading-tight" style={{ color: T.ink }}>{topic.name}</div>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {[
                                    { ic: <Layers size={10} />, tx: `${subs.length} module${subs.length === 1 ? '' : 's'}` },
                                    { ic: <BookOpen size={10} />, tx: `${cardCount} card${cardCount === 1 ? '' : 's'}` },
                                    { ic: <Clock size={10} />, tx: `${topicMins} min` },
                                  ].map((chip, ci) => (
                                    <span key={ci} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                          style={{ background: topic.color + '12', color: T.inkSoft }}>
                                      {chip.ic}{chip.tx}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button onClick={() => onPick(topic.id, null)}
                                      className="no-tap-highlight inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold active:scale-95 transition"
                                      style={{ background: `linear-gradient(135deg, ${topic.color}, ${topic.color}D0)`, color: '#FFF', boxShadow: `0 4px 12px ${topic.color}50` }}>
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

      {/* M1 — per-unit Guidebook digest (keypoints + mnemonics). */}
      <UnitGuidebook open={!!guideTopic} topic={guideTopic} guidebook={guidebook}
                     onClose={() => setGuideTopicId(null)}
                     onRead={() => { const id = guideTopicId; setGuideTopicId(null); if (id) onPick(id, null); }} />
    </div>
  );
}

export default LearnTopics;
