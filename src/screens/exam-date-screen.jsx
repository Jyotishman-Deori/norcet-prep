// =====================================================================
// src/screens/exam-date-screen.jsx — exam date / daily target setup
// FEAT-02 — the inner form is now the reusable <ExamDateEditor/> so the Study
// Plan screen can embed it (one "Study plan" home for date + goal + timeline).
// ExamDateScreen stays as a thin TopBar wrapper for any legacy deep-link, but
// the app routes the sidebar straight to Study Plan now.
// =====================================================================
import React, { useState } from 'react';
import { CalendarDays, Edit3, Save, Sparkles, X } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import DatePicker from './date-picker.jsx';

// The editor body, with NO TopBar — embeddable. `onSaved` fires after a save so
// a host (Study Plan) can collapse the editor / let the plan regenerate.
export function ExamDateEditor({ allQuestionsCount, onSave, onClear, onSaveTarget, onSaved }) {
  const { theme: T } = useTheme();
  const { data } = useData();
  const [dateValue, setDateValue] = useState(data.stats.examDate || '');
  // Manual daily target (questions/day). Stored as a number; null/0 = auto.
  const initialTarget = data.stats.dailyTarget || 0;
  const [targetValue, setTargetValue] = useState(initialTarget > 0 ? String(initialTarget) : '');
  const [targetMode, setTargetMode] = useState(initialTarget > 0 ? 'manual' : 'auto');
  const todayISO = new Date().toISOString().slice(0, 10);

  const target = dateValue ? new Date(dateValue) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (target) target.setHours(0, 0, 0, 0);
  const daysLeft = target ? Math.round((target - today) / (1000 * 60 * 60 * 24)) : null;

  // Auto pace preview — mirrors the formula on Home so the user sees what
  // "auto" will work out to before saving.
  const autoPace = (daysLeft && daysLeft > 0 && allQuestionsCount > 0)
    ? Math.min(120, Math.max(20, Math.ceil(allQuestionsCount / daysLeft)))
    : null;

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  const handleSaveAll = () => {
    onSave(dateValue);
    const n = parseInt(targetValue, 10);
    const finalTarget = targetMode === 'manual' && n > 0 ? n : null;
    if (onSaveTarget) onSaveTarget(finalTarget);
    if (onSaved) onSaved();
  };

  return (
    <>
      <Card className="p-5 mb-5" style={{ background: T.primary, border: 'none' }}>
        <div className="flex items-center gap-3 mb-2">
          <CalendarDays size={20} color="#FFF" />
          <div className="font-display text-lg font-semibold" style={{ color: '#FFF' }}>Set your target</div>
        </div>
        <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Set your exam date to unlock a home-screen countdown, a daily question-pace target, and a personalised day-by-day plan below.
        </div>
      </Card>

      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Exam date</div>
      <DatePicker value={dateValue} onChange={setDateValue} min={todayISO} />
      {daysLeft !== null && daysLeft >= 0 && (
        <Card className="p-4 mb-5" style={{ background: T.surfaceWarm }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>That's</div>
          <div className="font-display text-3xl font-semibold" style={{ color: T.ink }}>
            {daysLeft} <span className="text-base font-normal" style={{ color: T.muted }}>day{daysLeft === 1 ? '' : 's'} away</span>
          </div>
        </Card>
      )}

      {/* Daily goal — kept deliberately plain-spoken */}
      <div className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>Daily goal</div>
      <div className="text-xs mb-3 px-0.5 leading-relaxed" style={{ color: T.muted }}>
        How many questions to study each day. We'll show it on your home screen and tick it off as you go.
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 mt-1">
        {[
          { id: 'auto', label: 'Decide for me', icon: <Sparkles size={15} />, rec: true },
          { id: 'manual', label: "I'll pick", icon: <Edit3 size={15} />, rec: false }
        ].map(opt => {
          const active = targetMode === opt.id;
          return (
            <button key={opt.id} onClick={() => setTargetMode(opt.id)}
                    className="no-tap-highlight relative py-3 px-3 rounded-xl text-sm font-semibold flex flex-col items-center gap-1.5 transition-all active:scale-[0.98]"
                    style={{ background: active ? T.primary : T.surface,
                             color: active ? '#FFF' : T.inkSoft,
                             border: `1.5px solid ${active ? T.primary : T.border}`,
                             boxShadow: active ? `0 2px 10px ${T.primary}33` : 'none' }}>
              {opt.rec && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: active ? '#FFF' : T.accent, color: active ? T.primary : '#FFF' }}>
                  Recommended
                </span>
              )}
              <span style={{ opacity: active ? 1 : 0.7 }}>{opt.icon}</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      {targetMode === 'auto' && (
        autoPace ? (
          <Card className="p-4 mb-4 flex items-center gap-4" style={{ background: T.primary + '0E', border: `1px solid ${T.primary}26` }}>
            <div className="flex-shrink-0 w-16 text-center">
              <div className="font-display text-3xl font-semibold leading-none" style={{ color: T.primary }}>{autoPace}</div>
              <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: T.muted }}>a day</div>
            </div>
            <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
              Study about <span className="font-semibold" style={{ color: T.ink }}>{autoPace} questions a day</span> and you'll get through everything before your exam.
            </div>
          </Card>
        ) : (
          <Card className="p-4 mb-4 flex items-center gap-3" style={{ background: T.surfaceWarm }}>
            <CalendarDays size={18} className="flex-shrink-0" style={{ color: T.muted }} />
            <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
              Pick your exam date above first — then we'll work out a daily number for you.
            </div>
          </Card>
        )
      )}

      {targetMode === 'manual' && (
        <div className="mb-4">
          <div className="text-xs mb-2 px-0.5" style={{ color: T.muted }}>Tap a number, or type your own:</div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[10, 20, 30, 50, 75, 100].map(n => {
              const sel = targetValue === String(n);
              return (
                <button key={n} onClick={() => setTargetValue(String(n))}
                        className="no-tap-highlight py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
                        style={{ background: sel ? T.primary : T.surface,
                                 color: sel ? '#FFF' : T.inkSoft,
                                 border: `1.5px solid ${sel ? T.primary : T.border}` }}>
                  {n}
                </button>
              );
            })}
          </div>
          <input type="number" inputMode="numeric" min="1" max="500"
                 value={targetValue} onChange={e => setTargetValue(e.target.value)}
                 placeholder="Or type a number…"
                 className="w-full rounded-xl px-4 py-3 text-sm" style={inputStyle} />
          {targetValue && parseInt(targetValue, 10) > 0 && (
            <div className="text-xs mt-2 px-0.5" style={{ color: T.muted }}>
              Your goal: <span className="font-semibold" style={{ color: T.ink }}>{parseInt(targetValue, 10)} questions a day</span>.
            </div>
          )}
        </div>
      )}

      <Button onClick={handleSaveAll} disabled={!dateValue}
              size="lg" className="w-full mb-2" icon={<Save size={18} />}>
        Save
      </Button>

      {data.stats.examDate && (
        <Button onClick={() => { onClear(); if (onSaved) onSaved(); }} variant="ghost" size="lg" className="w-full" icon={<X size={16} />}>
          Clear exam date
        </Button>
      )}
    </>
  );
}

// Thin wrapper kept for any legacy/deep-link route. The sidebar now opens the
// Study Plan screen, which embeds ExamDateEditor directly.
function ExamDateScreen({ allQuestionsCount, onSave, onClear, onSaveTarget, onBack }) {
  const { theme: T } = useTheme();
  return (
    <div className="anim-fadeup">
      <TopBar title="Study plan" onBack={onBack} feedback={{ screen: "Study plan" }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-24">
        <ExamDateEditor allQuestionsCount={allQuestionsCount} onSave={onSave} onClear={onClear} onSaveTarget={onSaveTarget} />
      </div>
    </div>
  );
}

export default ExamDateScreen;
