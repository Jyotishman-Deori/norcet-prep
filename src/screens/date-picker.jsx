// =====================================================================
// src/screens/date-picker.jsx — calendar date picker (A1 slice 19)
// Extracted from App.jsx. Body byte-identical; only change is the A7 hook
// line (T -> useTheme). Props stay { value, onChange, min }. Shared by
// ExamDateScreen (and any future date inputs).
// =====================================================================
import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

function DatePicker({ value, onChange, min }) {
  const { theme: T } = useTheme();
  const [open, setOpen] = useState(false);

  const parseISO = (s) => {
    if (!s) return null;
    const [y, m, d] = String(s).split('-').map(Number);
    return (y && m && d) ? new Date(y, m - 1, d) : null;
  };
  const toISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const selected = parseISO(value);
  const minDate = parseISO(min); if (minDate) minDate.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [view, setView] = useState(() => {
    const base = selected || today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const fmt = selected
    ? selected.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isDisabled = (dt) => minDate && dt < minDate;

  const cells = (() => {
    const year = view.getFullYear(), month = view.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  })();

  const prevDisabled = minDate && (view.getFullYear() < minDate.getFullYear()
    || (view.getFullYear() === minDate.getFullYear() && view.getMonth() <= minDate.getMonth()));

  const goMonth = (delta) => setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));
  const pick = (dt) => { if (isDisabled(dt)) return; onChange(toISO(dt)); setView(new Date(dt.getFullYear(), dt.getMonth(), 1)); setOpen(false); };

  const presets = [{ l: '+1 mo', m: 1 }, { l: '+3 mo', m: 3 }, { l: '+6 mo', m: 6 }, { l: '+1 yr', m: 12 }];

  return (
    <div className="relative mb-4">
      <button onClick={() => setOpen(o => !o)}
              className="no-tap-highlight w-full flex items-center justify-between rounded-xl px-4 py-3.5 text-sm transition-all"
              style={{ background: T.surface, border: `1px solid ${open ? T.primary : T.border}`,
                       boxShadow: open ? `0 0 0 3px ${T.primary}1A` : '0 1px 2px rgba(26,43,35,0.04)' }}>
        <span style={{ color: fmt ? T.ink : T.muted, fontWeight: fmt ? 600 : 400 }}>
          {fmt || 'dd – mm – yyyy'}
        </span>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ background: open ? T.primary : T.primary + '12' }}>
          <Calendar size={16} style={{ color: open ? '#FFF' : T.primary }} />
        </span>
      </button>

      {open && (
        <div className="anim-scalein mt-2 rounded-2xl p-4"
             style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: '0 12px 32px rgba(26,43,35,0.14)' }}>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => goMonth(-1)} disabled={prevDisabled}
                    className="no-tap-highlight w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition"
                    style={{ background: T.surfaceWarm, opacity: prevDisabled ? 0.4 : 1, cursor: prevDisabled ? 'not-allowed' : 'pointer' }}>
              <ChevronLeft size={18} style={{ color: T.ink }} />
            </button>
            <div className="font-display text-base font-semibold" style={{ color: T.ink }}>
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </div>
            <button onClick={() => goMonth(1)}
                    className="no-tap-highlight w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition"
                    style={{ background: T.surfaceWarm }}>
              <ChevronRight size={18} style={{ color: T.ink }} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 mb-1.5">
            {WEEK.map((w, i) => (
              <div key={i} className="text-center text-[10px] uppercase tracking-wide font-semibold py-1" style={{ color: T.muted }}>{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((dt, i) => {
              if (!dt) return <div key={i} />;
              const sel = sameDay(dt, selected);
              const isToday = sameDay(dt, today);
              const dis = isDisabled(dt);
              return (
                <button key={i} onClick={() => pick(dt)} disabled={dis}
                        className="no-tap-highlight aspect-square rounded-xl flex items-center justify-center text-sm relative transition active:scale-90"
                        style={{
                          background: sel ? T.primary : isToday ? T.primary + '14' : 'transparent',
                          color: sel ? '#FFF' : dis ? T.muted : T.ink,
                          opacity: dis ? 0.3 : 1,
                          fontWeight: sel || isToday ? 700 : 500,
                          boxShadow: sel ? `0 2px 8px ${T.primary}55` : 'none'
                        }}>
                  {dt.getDate()}
                </button>
              );
            })}
          </div>

          {/* Quick exam-date presets */}
          <div className="flex gap-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
            {presets.map(p => (
              <button key={p.l}
                      onClick={() => pick(new Date(today.getFullYear(), today.getMonth() + p.m, today.getDate()))}
                      className="no-tap-highlight flex-1 py-2 rounded-lg text-[11px] font-semibold active:scale-95 transition"
                      style={{ background: T.surfaceWarm, color: T.inkSoft }}>
                {p.l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
