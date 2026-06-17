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
import { BookOpen, ClipboardList, ListChecks, Hourglass, Check, GraduationCap, Play, Search } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';

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

function PreviousPapers({ papers, previousPapers, onStart, onRead, onBack }) {
  const { theme: T } = useTheme();
  const records = previousPapers || {};
  const [examFilter, setExamFilter] = useState('all');
  const [query, setQuery] = useState('');

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
                  className="no-tap-highlight inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition"
                  style={{ background: T.sec.mock, color: '#FFF' }}>
            <Play size={13} /> Attempt
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
      <TopBar title="Previous Year Papers" onBack={onBack} feedback={{ screen: "Previous year papers" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <div className="text-sm leading-relaxed mb-4" style={{ color: T.muted }}>
          Sit a full official paper under exam conditions — or just{' '}
          <span style={{ color: T.inkSoft, fontWeight: 500 }}>read</span> through its questions
          and answers for a calm, no-pressure revision session. Scores are saved per paper
          for attempted tests only.
        </div>

        {totalPapers === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Papers coming soon"
            text="Official previous year papers will appear here once uploaded." />
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
      </div>
    </div>
  );
}

export default PreviousPapers;
