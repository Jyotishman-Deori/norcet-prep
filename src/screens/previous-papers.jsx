// =====================================================================
// src/screens/previous-papers.jsx — Previous Year Papers archive
// #26 — premium MULTI-EXAM archive. Papers are grouped by EXAM and then by
// YEAR (newest first). The exam is taken from `paper.exam` when present, and
// otherwise inferred from the paper name (everything before the year), so the
// existing NORCET papers need no data change and any future exam (AIIMS
// Nursing, JIPMER, PGIMER, BHU, DSSSB, …) just sets `exam:` on its papers.
// Attempt + Read flows and per-paper saved scores are preserved exactly
// (props unchanged: papers, previousPapers, onStart, onRead, onBack).
// =====================================================================
import React, { useMemo, useState } from 'react';
import { BookOpen, ClipboardList, ListChecks, Hourglass, Check, GraduationCap, Play, Search, Flame, FileText, Monitor, Keyboard } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';
import { buildHighYieldIndex, HIGH_YIELD_MIN, HIGH_YIELD_HIGH } from '../lib/high-yield.js';
import { topicName, topicColor } from '../lib/topics.js';

const HY_AMBER = '#B8791A';

// Premium CBT signposting micro-interaction — a slow light sheen sweeping the
// banner + Attempt button. Disabled under prefers-reduced-motion.
const PPR_CSS = `
@keyframes pprSheen { 0% { transform: translateX(-130%); } 55%, 100% { transform: translateX(240%); } }
.ppr-sheen { background: linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.16) 50%, transparent 58%); animation: pprSheen 3.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .ppr-sheen { animation: none; display: none; } }
`;

// Split a paper into { exam, label } — exam = section header, label = the
// year/session shown on the card (e.g. "2023 Mains").
function splitPaper(p) {
  const name = String(p.name || '').trim();
  if (p.exam) {
    const rem = name.replace(p.exam, '').trim();
    return { exam: p.exam, label: rem || String(p.year || '') };
  }
  const m = name.match(/\b(19|20)\d{2}\b/);
  if (m) {
    const idx = name.indexOf(m[0]);
    const exam = name.slice(0, idx).trim() || 'Previous Papers';
    return { exam, label: name.slice(idx).trim() || String(p.year || '') };
  }
  return { exam: name || 'Previous Papers', label: String(p.year || '') };
}

// #3 — segmented view tab (Papers / High-Yield).
function ViewTab({ active, onClick, icon: Icon, label, count, T, accent }) {
  const c = accent || T.sec.mock;
  return (
    <button onClick={onClick}
      className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition active:scale-[0.98]"
      style={{ background: active ? c : T.surface, color: active ? '#FFF' : T.inkSoft, border: `1.5px solid ${active ? c : T.border}` }}>
      <Icon size={14} />{label}
      {typeof count === 'number' && count > 0 && (
        <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded-full"
              style={{ background: active ? 'rgba(255,255,255,0.25)' : c + '18', color: active ? '#FFF' : c }}>{count}</span>
      )}
    </button>
  );
}

function yearSpanLabel(years) {
  if (!years || years.length === 0) return '';
  return years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`;
}

// #3 — the ranked "what the exam repeats" priority list.
function HighYieldView({ concepts, years, T }) {
  if (!concepts || concepts.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="text-sm" style={{ color: T.muted }}>Not enough paper data yet to spot repeated concepts.</div>
      </Card>
    );
  }
  return (
    <div>
      <Card className="p-4 mb-4" style={{ background: HY_AMBER + '0E', border: `1px solid ${HY_AMBER}33` }}>
        <div className="flex items-center gap-1.5 mb-1">
          <Flame size={14} style={{ color: HY_AMBER }} />
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: HY_AMBER }}>What gets repeated</span>
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
          <b style={{ color: T.ink }}>{concepts.length} concepts</b> the exam has asked {HIGH_YIELD_MIN}+ times
          {years.length ? ` across ${yearSpanLabel(years)}` : ''}. Study these first — most marks per hour.
        </p>
      </Card>

      <div className="space-y-2">
        {concepts.map((c, i) => {
          const hot = c.count >= HIGH_YIELD_HIGH;
          const tc = topicColor(c.topic);
          return (
            <div key={c.topic + '|' + c.sub}
                 className="flex items-center gap-3 px-3 py-2.5 rounded-xl seq-item"
                 style={{ background: T.surface, border: `1px solid ${hot ? HY_AMBER + '40' : T.border}`,
                          borderLeft: `3px solid ${hot ? HY_AMBER : tc}`, animationDelay: `${Math.min(i, 10) * 45}ms` }}>
              <div className="flex flex-col items-center justify-center w-9 shrink-0">
                <span className="font-display text-lg font-bold leading-none" style={{ color: hot ? HY_AMBER : T.ink }}>{c.count}</span>
                <span className="text-[8px] uppercase tracking-wide" style={{ color: T.muted }}>times</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: T.ink }}>
                  {hot && <Flame size={12} style={{ color: HY_AMBER }} className="shrink-0" />}
                  {c.sub}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium truncate"
                        style={{ background: tc + '18', color: tc }}>{topicName(c.topic)}</span>
                  {c.years.length > 0 && <span className="text-[10px]" style={{ color: T.muted }}>{yearSpanLabel(c.years)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviousPapers({ papers, previousPapers, onStart, onRead, onBack }) {
  const { theme: T } = useTheme();
  const records = previousPapers || {};
  const [examFilter, setExamFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('papers'); // 'papers' | 'highyield'

  // #3 — concepts the exam repeats most, mined from the papers in hand.
  const hy = useMemo(() => buildHighYieldIndex(papers), [papers]);
  const hyConcepts = useMemo(() => hy.concepts.filter(c => c.count >= HIGH_YIELD_MIN), [hy]);
  const hyYears = useMemo(() => {
    const ys = new Set();
    (papers || []).forEach(p => { if (typeof p.year === 'number') ys.add(p.year); });
    return [...ys].sort();
  }, [papers]);

  // Group by exam → papers (each sorted newest-year-first). Exams ordered by
  // paper count (the primary exam, NORCET, surfaces first), then name.
  const groups = useMemo(() => {
    const byExam = new Map();
    (papers || []).forEach(p => {
      const { exam, label } = splitPaper(p);
      if (!byExam.has(exam)) byExam.set(exam, []);
      byExam.get(exam).push({ ...p, _label: label, _exam: exam });
    });
    const arr = [...byExam.entries()].map(([exam, list]) => ({
      exam,
      papers: list.sort((a, b) => (b.year || 0) - (a.year || 0)),
    }));
    arr.sort((a, b) => (b.papers.length - a.papers.length) || a.exam.localeCompare(b.exam));
    return arr;
  }, [papers]);

  const totalPapers = (papers || []).length;
  const multiExam = groups.length > 1;

  const q = query.trim().toLowerCase();
  const visibleGroups = groups
    .filter(g => examFilter === 'all' || g.exam === examFilter)
    .map(g => ({
      ...g,
      papers: g.papers.filter(p => !q || (p.name || '').toLowerCase().includes(q) || String(p.year || '').includes(q)),
    }))
    .filter(g => g.papers.length > 0);

  const renderPaper = (paper, pi) => {
    const rec = records[paper.id];
    const attempts = (rec && Array.isArray(rec.attempts)) ? rec.attempts : [];
    const attempted = attempts.length > 0;
    const last = attempted ? attempts[attempts.length - 1] : null;
    const bestNet = attempted
      ? (typeof rec.bestNet === 'number' ? rec.bestNet : Math.max(...attempts.map(a => a.netScore)))
      : null;
    const qCount = (paper.questions || []).length;
    return (
      <Card key={paper.id} className="p-4 seq-item"
            style={{ borderTop: `3px solid ${T.sec.mock}`, animationDelay: `${Math.min(pi, 8) * 90}ms` }}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="font-display text-base font-semibold truncate" style={{ color: T.ink }}>
                {paper._label || paper.name}
              </div>
              {paper.year && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                      style={{ background: T.sec.mock, color: '#FFF' }}>
                  {paper.year}
                </span>
              )}
            </div>
            <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: T.muted }}>
              <span className="inline-flex items-center gap-1"><ListChecks size={11} />{qCount} Qs</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1"><Hourglass size={11} />{paper.timeMinutes} min</span>
            </div>
            {attempted ? (
              <div className="text-xs mt-2 flex items-center gap-2 flex-wrap" style={{ color: T.inkSoft }}>
                <span className="inline-flex items-center gap-1" style={{ color: T.success }}>
                  <Check size={11} />Best {bestNet.toFixed(2)}
                </span>
                <span style={{ color: T.muted }}>· Last {last.accuracy}% · {attempts.length} attempt{attempts.length > 1 ? 's' : ''}</span>
              </div>
            ) : (
              <div className="text-xs mt-2" style={{ color: T.muted }}>Not attempted yet</div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onStart(paper)}
                  className="no-tap-highlight relative overflow-hidden inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition"
                  style={{ background: T.sec.mock, color: '#FFF' }}>
            <span className="ppr-sheen absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Play size={13} /> Attempt
              <span className="text-[8px] font-bold px-1 py-0.5 rounded leading-none tracking-wide" style={{ background: 'rgba(255,255,255,0.26)' }}>CBT</span>
            </span>
          </button>
          <button onClick={() => onRead && onRead(paper)}
                  className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition"
                  style={{ background: T.sec.mock + '14', color: T.sec.mock, border: `1.5px solid ${T.sec.mock}50` }}>
            <BookOpen size={13} /> Read
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div className="anim-fadeup">
      <style>{PPR_CSS}</style>
      <TopBar title="Previous Year Papers" onBack={onBack} feedback={{ screen: "Previous year papers" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <div className="text-sm leading-relaxed mb-3" style={{ color: T.muted }}>
          <b style={{ color: T.inkSoft }}>Attempt</b> a paper as a full computer-based test, or{' '}
          <b style={{ color: T.inkSoft }}>Read</b> through its questions and answers for calm,
          no-pressure revision. Scores are saved per paper for attempted tests only.
        </div>

        {/* premium CBT-mode banner — the Attempt path runs the full CBT engine */}
        <div className="relative overflow-hidden rounded-2xl mb-4 px-3.5 py-2.5 flex items-center gap-2.5 anim-fadeup"
             style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)' }}>
          <span className="ppr-sheen absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />
          <span className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(56,189,248,0.18)' }}>
            <Monitor size={16} color="#38BDF8" />
          </span>
          <div className="relative z-10 min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold leading-tight" style={{ color: '#FFF' }}>Computer-Based Test mode</div>
            <div className="text-[10.5px] leading-tight mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.62)' }}>
              Timed · palette · mark-for-review · <Keyboard size={10} /> keyboard
            </div>
          </div>
        </div>

        {totalPapers === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Papers coming soon"
            text="Official previous year papers will appear here once uploaded." />
        ) : (
          <>
            {/* #3 — Papers vs High-Yield view toggle */}
            <div className="flex gap-2 mb-4">
              <ViewTab active={view === 'papers'} onClick={() => setView('papers')} icon={FileText} label="Papers" T={T} />
              <ViewTab active={view === 'highyield'} onClick={() => setView('highyield')} icon={Flame} label="High-Yield" count={hyConcepts.length} T={T} accent={HY_AMBER} />
            </div>

            {view === 'highyield' ? (
              <HighYieldView concepts={hyConcepts} years={hyYears} T={T} />
            ) : (
            <>
            {/* Exam filter — only when more than one exam is present */}
            {multiExam && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
                {[{ exam: 'all', papers: papers }, ...groups].map(g => {
                  const active = examFilter === g.exam;
                  const label = g.exam === 'all' ? 'All' : g.exam;
                  return (
                    <button key={g.exam} onClick={() => setExamFilter(g.exam)}
                            className="no-tap-highlight whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors active:scale-95 flex-shrink-0"
                            style={{ background: active ? T.sec.mock : T.surface, color: active ? '#FFF' : T.inkSoft,
                                     border: `1px solid ${active ? T.sec.mock : T.border}` }}>
                      {label}
                      <span className="ml-1.5 text-[10px] tabular-nums opacity-80">{g.exam === 'all' ? totalPapers : g.papers.length}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search — only useful with a reasonable number of papers */}
            {totalPapers > 4 && (
              <div className="relative mb-4">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by year or name…"
                       className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                       style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
              </div>
            )}

            {visibleGroups.length === 0 ? (
              <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>No papers match your search.</div></Card>
            ) : (
              visibleGroups.map(g => (
                <div key={g.exam} className="mb-6">
                  {/* Exam shelf header */}
                  <div className="flex items-center gap-2 mb-2.5 px-0.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                         style={{ background: T.sec.mock + '18' }}>
                      <GraduationCap size={15} style={{ color: T.sec.mock }} />
                    </div>
                    <div className="font-display text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: T.ink }}>{g.exam}</div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full tabular-nums flex-shrink-0"
                          style={{ background: T.surfaceWarm, color: T.muted }}>
                      {g.papers.length} paper{g.papers.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {g.papers.map((paper, pi) => renderPaper(paper, pi))}
                  </div>
                </div>
              ))
            )}
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PreviousPapers;
