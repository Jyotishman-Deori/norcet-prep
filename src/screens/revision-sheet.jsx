// =====================================================================
// src/screens/revision-sheet.jsx — read-only revision digest + print (A1 slice 31)
// Extracted from App.jsx. PRINT_STYLES (screen-private) moves with it, verbatim.
// Body byte-identical except:
//   (1) signature: { data, allQuestions, onLogVisit, onBack }
//                -> { onLogVisit, onBack }   (data+allQuestions -> useData)
//   (2) inserted A7 hook lines: useTheme (T), useData (data, allQuestions).
// Render site drops data=/allQuestions= props. attemptStats from lib/compact;
// topicName/Color/Icon from lib/topics; TTSButton from ui/question-widgets.
// =====================================================================
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Printer, CalendarDays, Clock, X, ChevronDown, ChevronUp, Bookmark, Check, Lightbulb } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { attemptStats } from '../lib/compact.js';
import { topicName, topicColor, topicIcon } from '../lib/topics.js';
import { Card, TopBar } from '../ui/primitives.jsx';
import { TTSButton } from '../ui/question-widgets.jsx';
// #5 — saved Crib Sheets shelf (dated test reviews, reopenable + printable).
import { useProfile } from '../lib/app-context.jsx';
import { loadCribs, removeCrib, daysAgo } from '../lib/cribs.js';
import { FileText, ListChecks, Trash2 } from 'lucide-react';
import { Tip } from '../ui/tooltip.jsx';

const PRINT_STYLES = `
@media print {
  body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .revision-print-page { padding: 0 !important; max-width: 100% !important; }
  .revision-item { page-break-inside: avoid; break-inside: avoid; border: 1px solid #ddd !important; background: white !important; }
  /* Items collapsed on screen are hidden with .hidden; force every answer to
     print in full regardless of expand state. */
  .revision-item-content { display: block !important; }
}
`;

function RevisionSheet({ onLogVisit, onBack, onOpenCrib }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const { data, allQuestions } = useData();
  const { profile } = useProfile();
  const cribPid = (profile && profile.id) || 'guest';
  // #5 — saved Crib Sheets (separate shelf inside Revision).
  const [cribs, setCribs] = useState([]);
  const [cribConfirm, setCribConfirm] = useState(null); // id pending delete
  useEffect(() => {
    let alive = true;
    loadCribs(cribPid).then(c => { if (alive) setCribs(c); }).catch(() => {});
    return () => { alive = false; };
  }, [cribPid]);
  const deleteCrib = async (id) => {
    setCribs(await removeCrib(cribPid, id));
    setCribConfirm(null);
  };
  const [includeWrong, setIncludeWrong] = useState(false);
  const [topicFilter, setTopicFilter] = useState('all');
  const [expanded, setExpanded] = useState({}); // qId -> bool
  const [allExpanded, setAllExpanded] = useState(true); // default to expanded for revision
  // null = live "Today" set; a 'YYYY-MM-DD' string = read-only snapshot from history.
  const [viewDate, setViewDate] = useState(null);

  const revisionLog = useMemo(() => Array.isArray(data.revisionLog) ? data.revisionLog : [], [data.revisionLog]);
  const todayKey = new Date().toLocaleDateString('en-CA');

  // The live (today) set: bookmarks, plus previously-wrong if toggled on.
  const liveIds = useMemo(() => {
    const ids = new Set(data.bookmarks || []);
    if (includeWrong) {
      Object.entries(data.history || {}).forEach(([qId, h]) => {
        // P15 — attemptStats.anyWrong correctly flags compacted records
        // whose pre-compaction history contained any wrong attempts.
        if (h && (h.lastResult === 'wrong' || attemptStats(h).anyWrong)) {
          ids.add(qId);
        }
      });
    }
    return ids;
  }, [data.bookmarks, data.history, includeWrong]);

  // Log today's visit once on open (with the current bookmark snapshot).
  const loggedRef = useRef(false);
  useEffect(() => {
    if (loggedRef.current) return;
    if (onLogVisit && (data.bookmarks || []).length > 0) {
      onLogVisit(data.bookmarks);
      loggedRef.current = true;
    }
  }, []); // mount only

  // Reset the topic filter when switching between live and a snapshot, since
  // the available topics differ.
  useEffect(() => { setTopicFilter('all'); }, [viewDate]);

  const snapshotEntry = viewDate ? revisionLog.find(e => e.date === viewDate) : null;
  const isSnapshot = !!snapshotEntry;

  // Active id set depends on mode.
  const itemIds = useMemo(() => {
    if (isSnapshot) return new Set(snapshotEntry.ids || []);
    return liveIds;
  }, [isSnapshot, snapshotEntry, liveIds]);

  const items = useMemo(() => {
    return allQuestions
      .filter(q => itemIds.has(q.id))
      .filter(q => topicFilter === 'all' || q.topic === topicFilter);
  }, [allQuestions, itemIds, topicFilter]);

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
    allQuestions.filter(q => itemIds.has(q.id)).forEach(q => set.add(q.topic));
    return Array.from(set);
  }, [allQuestions, itemIds]);

  // Friendly relative date label for the history chips.
  const fmtDay = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((t - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  // Past visits (everything except today) — these become tappable snapshots.
  const pastVisits = revisionLog.filter(e => e.date !== todayKey);

  const isOpen = (qId) => expanded[qId] !== undefined ? expanded[qId] : allExpanded;
  const toggleOne = (qId) => setExpanded(e => ({ ...e, [qId]: !isOpen(qId) }));
  const expandAll = () => { setAllExpanded(true); setExpanded({}); };
  const collapseAll = () => { setAllExpanded(false); setExpanded({}); };
  const handlePrint = () => { if (typeof window !== 'undefined') window.print(); };

  // Generate full TTS text for one question
  const ttsTextFor = (q) => {
    const correctLetters = q.correct.map(i => String.fromCharCode(65 + i)).join(', ');
    return `Question: ${q.q}. Options: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}`).join('. ')}. Correct answer: ${correctLetters}. Explanation: ${q.exp}`;
  };

  return (
    <div className="anim-fadeup">
      <style>{PRINT_STYLES}</style>
      <div className="no-print">
        <TopBar title="Revision" onBack={onBack}
                feedback={{ screen: "Revision sheet" }} />
      </div>

      <div className="max-w-md mx-auto px-4 pb-24 pt-2 revision-print-page">

        <div className="no-print mb-5">
          {/* Intro + Print/PDF. Print/PDF now lives here in the body, clearly
              separated from the Report button (which stays in the top bar). */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="text-xs leading-relaxed flex-1 pt-1" style={{ color: T.muted }}>
              Everything visible at once for fast revision. Save or print it for offline study.
            </div>
            <button onClick={handlePrint}
                    className="no-tap-highlight flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold flex-shrink-0 active:scale-95 transition"
                    style={{ background: T.primary, color: '#FFF', boxShadow: `0 2px 8px ${T.primary}40` }}>
              <Printer size={14} />
              Print / PDF
            </button>
          </div>

          {/* #5 — CRIB SHEETS: every test review you chose to keep, dated.
              Separate from the live digest below; each opens in the full
              Crib Sheet view (printable from there). */}
          {cribs.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <FileText size={12} style={{ color: T.primary }} />
                <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>
                  Crib Sheets · {cribs.length}
                </span>
              </div>
              <div className="space-y-2">
                {cribs.map((c, ci) => {
                  const right = Math.round((c.items.filter(i => i.status === 'correct').length / Math.max(1, c.items.length)) * 100);
                  return (
                    <Tip key={c.id} title={c.title} text="A saved test review — tap to reopen with every answer and explanation, or print it.">
                    <div role="button" tabIndex={0}
                         onClick={() => onOpenCrib && onOpenCrib(c)}
                         onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenCrib && onOpenCrib(c); } }}
                         className="no-tap-highlight pressable cursor-pointer rounded-2xl p-3.5 seq-item relative overflow-hidden"
                         style={{
                           background: `linear-gradient(140deg, ${T.primary}14 0%, ${T.surface} 55%)`,
                           border: `1.5px solid ${T.primary}35`,
                           boxShadow: `0 3px 12px ${T.primary}14`,
                           animationDelay: `${Math.min(ci, 8) * 80}ms`,
                         }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                             style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.primary}B3)`, boxShadow: `0 3px 10px ${T.primary}45` }}>
                          <FileText size={17} color="#FFF" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-display font-semibold truncate" style={{ color: T.ink }}>{c.title}</div>
                          <div className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: T.muted }}>
                            <span className="font-semibold" style={{ color: T.primary }}>{daysAgo(c.createdAt)}</span>
                            <span>· {new Date(c.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className="inline-flex items-center gap-0.5">· <ListChecks size={10} /> {c.items.length} Qs</span>
                            <span>· {right}% right</span>
                          </div>
                        </div>
                        {cribConfirm === c.id ? (
                          <button onClick={(e) => { e.stopPropagation(); deleteCrib(c.id); }}
                                  className="no-tap-highlight text-[10px] font-bold px-2.5 py-1.5 rounded-full active:scale-95 transition flex-shrink-0"
                                  style={{ background: T.error, color: '#FFF' }}>
                            Sure?
                          </button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setCribConfirm(c.id); setTimeout(() => setCribConfirm(v => v === c.id ? null : v), 2500); }}
                                  aria-label="Delete this crib sheet"
                                  className="no-tap-highlight p-2 rounded-full active:bg-black/10 flex-shrink-0">
                            <Trash2 size={14} style={{ color: T.muted }} />
                          </button>
                        )}
                      </div>
                    </div>
                    </Tip>
                  );
                })}
              </div>
            </div>
          )}

          {/* Revision history — tap a past date to revisit that day's set */}
          {pastVisits.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2 px-0.5">
                <CalendarDays size={13} style={{ color: T.muted }} />
                <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Revision history</div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                <button onClick={() => setViewDate(null)}
                        className="no-tap-highlight flex-shrink-0 px-3 py-2 rounded-xl text-left transition active:scale-95"
                        style={{ background: !isSnapshot ? T.primary : T.surface,
                                 border: `1px solid ${!isSnapshot ? T.primary : T.border}`,
                                 color: !isSnapshot ? '#FFF' : T.ink }}>
                  <div className="text-xs font-semibold">Today</div>
                  <div className="text-[10px]" style={{ color: !isSnapshot ? 'rgba(255,255,255,0.8)' : T.muted }}>{liveIds.size} card{liveIds.size === 1 ? '' : 's'}</div>
                </button>
                {pastVisits.map(e => {
                  const active = viewDate === e.date;
                  const n = (e.ids || []).length;
                  return (
                    <button key={e.date} onClick={() => setViewDate(e.date)}
                            className="no-tap-highlight flex-shrink-0 px-3 py-2 rounded-xl text-left transition active:scale-95"
                            style={{ background: active ? T.primary : T.surface,
                                     border: `1px solid ${active ? T.primary : T.border}`,
                                     color: active ? '#FFF' : T.ink }}>
                      <div className="text-xs font-semibold whitespace-nowrap">{fmtDay(e.date)}</div>
                      <div className="text-[10px]" style={{ color: active ? 'rgba(255,255,255,0.8)' : T.muted }}>{n} card{n === 1 ? '' : 's'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Snapshot banner — shown when viewing a past day */}
          {isSnapshot && (
            <Card className="p-3 mb-3 flex items-center justify-between gap-3" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}26` }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock size={15} className="flex-shrink-0" style={{ color: T.primary }} />
                <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
                  Viewing your <span className="font-semibold" style={{ color: T.ink }}>{fmtDay(viewDate)}</span> revision set.
                </div>
              </div>
              <button onClick={() => setViewDate(null)}
                      className="no-tap-highlight text-xs font-semibold flex-shrink-0 px-2.5 py-1.5 rounded-lg active:scale-95"
                      style={{ background: T.primary, color: '#FFF' }}>
                Back to today
              </button>
            </Card>
          )}

          {/* Toggle wrong — only relevant in the live "Today" view */}
          {!isSnapshot && (
            <Card className="p-3 mb-3 cursor-pointer no-tap-highlight pressable" onClick={() => setIncludeWrong(v => !v)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                       style={{ background: includeWrong ? T.accent + '20' : T.surfaceWarm }}>
                    <X size={16} style={{ color: includeWrong ? T.accent : T.muted }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: T.ink }}>Include previously-wrong</div>
                    <div className="text-xs" style={{ color: T.muted }}>Adds questions you've gotten wrong before</div>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                     style={{ background: includeWrong ? T.accent : T.border }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                       style={{ transform: includeWrong ? 'translateX(20px)' : 'translateX(0px)' }} />
                </div>
              </div>
            </Card>
          )}

          {/* Topic filter chips */}
          {availableTopics.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
              <button onClick={() => setTopicFilter('all')}
                      className="no-tap-highlight flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ background: topicFilter === 'all' ? T.primary : T.surface,
                               color: topicFilter === 'all' ? '#FFF' : T.ink,
                               border: `1px solid ${topicFilter === 'all' ? T.primary : T.border}` }}>
                All ({items.length})
              </button>
              {availableTopics.map(tid => {
                const count = allQuestions.filter(q => itemIds.has(q.id) && q.topic === tid).length;
                return (
                  <button key={tid} onClick={() => setTopicFilter(tid)}
                          className="no-tap-highlight flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
                          style={{ background: topicFilter === tid ? topicColor(tid) : T.surface,
                                   color: topicFilter === tid ? '#FFF' : T.ink,
                                   border: `1px solid ${topicFilter === tid ? topicColor(tid) : T.border}` }}>
                    <span>{topicIcon(tid)}</span>
                    {topicName(tid)} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Expand / collapse all */}
          {items.length > 0 && (
            <div className="flex gap-2 mb-1">
              <button onClick={expandAll}
                      className="no-tap-highlight flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                <ChevronDown size={12} /> Expand all
              </button>
              <button onClick={collapseAll}
                      className="no-tap-highlight flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                <ChevronUp size={12} /> Collapse all
              </button>
            </div>
          )}
        </div>

        {/* Print header (visible only in print) */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-display font-bold mb-1">NORCET Revision Sheet</h1>
          <div className="text-sm" style={{ color: T.muted }}>
            {items.length} questions
            {topicFilter !== 'all' && ` · ${topicName(topicFilter)}`}
            {!isSnapshot && includeWrong && ' · includes previously-wrong'}
            {isSnapshot && ` · saved ${fmtDay(viewDate)}`}
            {' · '}{new Date().toLocaleDateString()}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>
              {isSnapshot ? 'Nothing left from that day' : 'Nothing to revise yet'}
            </div>
            <div className="text-sm" style={{ color: T.muted }}>
              {isSnapshot
                ? 'The questions saved on this date are no longer in your banks.'
                : 'Bookmark questions during practice to build your revision sheet, or toggle "Include previously-wrong" above.'}
            </div>
          </div>
        ) : (
          groupedByTopic.map(group => (
            <div key={group.topic} className="mb-6">
              <div className="text-xs uppercase tracking-wider font-semibold mb-3 px-1 flex items-center gap-2"
                   style={{ color: topicColor(group.topic) }}>
                <span>{topicIcon(group.topic)}</span>
                <span>{topicName(group.topic)}</span>
                <span style={{ color: T.muted }}>· {group.questions.length}</span>
              </div>

              <div className="space-y-3">
                {group.questions.map((q, qi) => {
                  const open = isOpen(q.id);
                  return (
                    <Card key={q.id} className="revision-item overflow-hidden">
                      <div className="px-4 py-3" style={{ borderBottom: open ? `1px solid ${T.borderSoft}` : 'none' }}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: T.muted }}>
                            <span>#{qi + 1}</span>
                            {q.sub && <span>· {q.sub}</span>}
                          </div>
                          <div className="no-print flex items-center gap-1.5">
                            <TTSButton text={ttsTextFor(q)} tone="ghost" />
                            <button onClick={() => toggleOne(q.id)} className="no-tap-highlight p-1 -m-1 rounded">
                              {open ? <ChevronUp size={16} style={{ color: T.muted }} /> : <ChevronDown size={16} style={{ color: T.muted }} />}
                            </button>
                          </div>
                        </div>
                        <div className="text-sm font-medium leading-snug" style={{ color: T.ink }}>{q.q}</div>
                      </div>

                      <div className={`revision-item-content px-4 py-3 ${open ? '' : 'hidden print:block'}`} style={{ background: T.bg }}>
                          <div className="space-y-1.5 mb-3">
                            {q.options.map((opt, i) => {
                              const isCorrect = q.correct.includes(i);
                              return (
                                <div key={i} className="flex items-start gap-2.5 text-sm">
                                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-semibold mt-0.5"
                                       style={{ background: isCorrect ? T.success : T.surfaceWarm,
                                                color: isCorrect ? '#FFF' : T.muted }}>
                                    {isCorrect ? <Check size={11} /> : String.fromCharCode(65 + i)}
                                  </div>
                                  <div className="leading-snug" style={{ color: isCorrect ? T.ink : T.inkSoft, fontWeight: isCorrect ? 500 : 400 }}>
                                    {opt}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="pt-3 mt-1 border-t" style={{ borderColor: T.borderSoft }}>
                            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Explanation</div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.inkSoft }}>{q.exp}</div>
                          </div>

                          {q.memoryTip && (
                            <div className="mt-3 rounded-lg p-3 overflow-hidden"
                                 style={{
                                   background: IS_DARK ? '#2A2010' : '#FFF8E8',
                                   border: `1px solid #D4900A33`,
                                   borderLeft: `3px solid #D4900A`
                                 }}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Lightbulb size={12} style={{ color: '#D4900A' }} />
                                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#D4900A' }}>Memory tip</div>
                              </div>
                              <div className="text-sm leading-relaxed" style={{ color: T.ink }}>{q.memoryTip}</div>
                            </div>
                          )}

                          {q.wrong && Object.keys(q.wrong).length > 0 && (
                            <div className="pt-3 mt-3 border-t" style={{ borderColor: T.borderSoft }}>
                              <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Why the others are wrong</div>
                              <div className="space-y-1">
                                {Object.entries(q.wrong).map(([idx, text]) => (
                                  <div key={idx} className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                                    <span className="font-semibold">{String.fromCharCode(65 + parseInt(idx))}.</span> {text}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RevisionSheet;
