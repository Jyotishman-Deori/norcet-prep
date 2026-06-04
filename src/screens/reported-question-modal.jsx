// =====================================================================
// src/screens/reported-question-modal.jsx — admin read-only viewer for a
// reported question (A1 slice 41). Looks the id up in the built-in pools
// (SEED_QUESTIONS for MCQs; dosage via useContent('dosage')); shows stem,
// options (correct marked), explanation/worked-solution. Bank/custom items
// aren't loaded here -> graceful "not in the built-in pool" note. Modal gains
// a useTheme() hook (was a bare-T reader). Render site (inside AdminPanel)
// unchanged.
// =====================================================================
import React from 'react';
import { FileText, X, AlertCircle, Check } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { useContent } from '../lib/content.js';
import { SEED_QUESTIONS } from '../data/seed.js';
import { Pill } from '../ui/primitives.jsx';

function lookupReportedQuestion(id, dosageList) {
  if (!id) return null;
  const mcq = SEED_QUESTIONS.find(q => q.id === id);
  if (mcq) return { kind: 'mcq', q: mcq };
  const dose = (dosageList || []).find(q => q.id === id);
  if (dose) return { kind: 'dose', q: dose };
  return null;
}

function ReportedQuestionModal({ questionId, onClose }) {
  const { theme: T } = useTheme();
  // A2 — dosage questions loaded lazily; hook must run before any early return.
  // SEED_QUESTIONS (MCQs) stay in-bundle, so MCQ reports resolve immediately;
  // a dosage report resolves once the bank loads (else the existing graceful
  // "not in the built-in pool" note shows).
  const { data: dosageData } = useContent('dosage');
  const dialogRef = useFocusTrap(onClose, !!questionId);
  if (!questionId) return null;
  const found = lookupReportedQuestion(questionId, dosageData || []);
  const q = found ? found.q : null;
  const correctSet = found && found.kind === 'mcq' ? new Set(q.correct || []) : null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md mx-auto flex flex-col anim-scalein rounded-t-3xl sm:rounded-3xl overflow-hidden"
           ref={dialogRef} role="dialog" aria-modal="true" aria-label="Reported question"
           style={{ background: T.bg, maxHeight: '88vh', border: `1px solid ${T.border}` }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
             style={{ borderBottom: `1px solid ${T.borderSoft}`, background: T.surface }}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} style={{ color: T.primary }} />
            <div className="min-w-0">
              <div className="font-display text-base font-semibold leading-tight" style={{ color: T.ink }}>Reported question</div>
              <div className="text-[11px] truncate font-mono" style={{ color: T.muted }}>{questionId}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
            <X size={20} style={{ color: T.muted }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {!found ? (
            <div className="text-center py-10">
              <AlertCircle size={34} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.4 }} />
              <div className="text-sm font-medium" style={{ color: T.inkSoft }}>Not in the built-in pool</div>
              <div className="text-xs mt-1.5 leading-relaxed max-w-xs mx-auto" style={{ color: T.muted }}>
                This is likely a custom or question-bank item (or a screen with no specific question). Open the relevant bank from Library to review it.
              </div>
            </div>
          ) : found.kind === 'mcq' ? (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Pill bg={T.primary + '15'} color={T.primary}>{q.correct && q.correct.length > 1 ? 'Multi-answer' : 'Single answer'}</Pill>
                {q.sub && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.sub}</Pill>}
                {q.difficulty && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.difficulty}</Pill>}
                {q.source && <Pill bg={T.accent + '15'} color={T.accent}>{q.source}</Pill>}
              </div>
              <div className="font-display text-base leading-snug mb-3" style={{ color: T.ink }}>{q.q}</div>
              <div className="mb-4">
                {q.options.map((opt, i) => {
                  const correct = correctSet.has(i);
                  return (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl mb-1.5"
                         style={{ background: correct ? T.success + '14' : T.surface,
                                  border: `1px solid ${correct ? T.success + '55' : T.border}` }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-semibold"
                           style={{ background: correct ? T.success : T.surfaceWarm, color: correct ? '#FFF' : T.muted }}>
                        {correct ? <Check size={12} /> : String.fromCharCode(65 + i)}
                      </div>
                      <div className="text-sm leading-snug flex-1" style={{ color: T.ink }}>{opt}</div>
                    </div>
                  );
                })}
              </div>
              {q.exp && (
                <div className="rounded-xl p-3 mb-3" style={{ background: T.primary + '10', border: `1px solid ${T.primary}26` }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: T.muted }}>Explanation</div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: T.ink }}>{q.exp}</div>
                </div>
              )}
              {q.wrong && Object.keys(q.wrong).length > 0 && (
                <div className="rounded-xl p-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: T.muted }}>Why the distractors are wrong</div>
                  <div className="space-y-1.5">
                    {Object.keys(q.wrong).map(k => (
                      <div key={k} className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                        <span className="font-semibold" style={{ color: T.muted }}>{String.fromCharCode(65 + Number(k))}: </span>{q.wrong[k]}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Pill bg={T.primary + '15'} color={T.primary}>Dosage</Pill>
                {q.type && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{q.type}</Pill>}
              </div>
              <div className="font-display text-base leading-snug mb-3" style={{ color: T.ink }}>{q.q}</div>
              <div className="rounded-xl p-3 mb-3 flex items-baseline justify-between gap-3"
                   style={{ background: T.success + '14', border: `1px solid ${T.success}40` }}>
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>Correct answer</span>
                <span className="font-display text-lg font-semibold tabular-nums" style={{ color: T.ink }}>{q.answer} {q.unit}</span>
              </div>
              {Array.isArray(q.steps) && (
                <div className="rounded-xl p-3 mb-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: T.muted }}>Worked solution</div>
                  <ol className="space-y-1.5">
                    {q.steps.map((s, i) => (
                      <li key={i} className="text-xs leading-relaxed font-mono" style={{ color: T.ink }}>{i + 1}. {s}</li>
                    ))}
                  </ol>
                </div>
              )}
              {q.intuition && (
                <div className="rounded-xl p-3" style={{ background: T.accent + '12', border: `1px solid ${T.accent}2E` }}>
                  <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: T.muted }}>Why it works</div>
                  <div className="text-sm leading-relaxed" style={{ color: T.ink }}>{q.intuition}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportedQuestionModal;
