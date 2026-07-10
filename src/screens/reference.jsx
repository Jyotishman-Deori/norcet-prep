// =====================================================================
// REFERENCE  (Pipeline step 38 / A1 session 4 — batch 1b slice 6 —
// extracted from App.jsx)
// The A2 quick-reference table (labs / vitals / drugs / abbreviations /
// conversions), as both a full screen (Reference, from the nav) and a
// modal (ReferenceLookupModal, opened from the Quiz screen). Both read
// the same lazily-loaded reference.json via useContent('reference').
// [A7] theme via useTheme(); focus via the useFocusTrap lib hook.
// REFERENCE_CATEGORIES (the chip metadata) lives here — reference-only.
// =====================================================================
import React, { useState, useMemo } from 'react';
import { FlaskConical, HeartPulse, Pill as PillIcon, ClipboardList, ArrowRightLeft, AlertTriangle, Search, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useContent } from '../lib/content.js';
import { useFocusTrap } from '../lib/use-focus-trap.js';
import { Card, TopBar } from '../ui/primitives.jsx';
import { ContentGate } from '../ui/content-gate.jsx';

// =====================================================================
// QUICK REFERENCE — lab values, vitals, drug doses, abbreviations, conversions
// =====================================================================
const REFERENCE_CATEGORIES = [
  { id: 'labs',   name: 'Lab Values',     icon: '🧪' },
  { id: 'vitals', name: 'Vital Signs',    icon: '🩺' },
  { id: 'drugs',  name: 'Drug Doses',     icon: '💊' },
  { id: 'abbr',   name: 'Abbreviations',  icon: '📋' },
  { id: 'conv',   name: 'Conversions',    icon: '🔄' }
];

// `initialQuery` — optional deep-link from the global Search screen: lands
// with the search box pre-filled so the user sees the same matches here.
function Reference({ onBack, initialQuery }) {
  const { theme: T } = useTheme();
  const [cat, setCat] = useState('labs');
  const [query, setQuery] = useState(initialQuery || '');
  // A2 — reference table loaded lazily from /public/data/reference.json.
  const { data: refData, loading, error, reload } = useContent('reference');
  const REFERENCE = refData || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = REFERENCE.filter(r => r.cat === cat);
    if (q) {
      // When searching, expand to all categories so results aren't hidden behind a tab
      items = REFERENCE.filter(r =>
        r.label.toLowerCase().includes(q) ||
        r.value.toLowerCase().includes(q) ||
        (r.note && r.note.toLowerCase().includes(q)) ||
        r.section.toLowerCase().includes(q)
      );
    }
    return items;
  }, [cat, query, refData]);

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(item => {
      const key = `${item.cat}::${item.section}`;
      if (!map.has(key)) map.set(key, { cat: item.cat, section: item.section, items: [] });
      map.get(key).items.push(item);
    });
    return Array.from(map.values());
  }, [filtered]);

  // Per-category visual identity — clinical icon + an earthy accent pulled
  // from the theme's section palette. Mapped here (not in the data) so the
  // underlying REFERENCE_CATEGORIES stays untouched.
  const CAT_META = {
    labs:   { Icon: FlaskConical,   color: T.sec.stats },
    vitals: { Icon: HeartPulse,     color: T.sec.topic },
    drugs:  { Icon: PillIcon,       color: T.sec.revision },
    abbr:   { Icon: ClipboardList,  color: T.sec.learn },
    conv:   { Icon: ArrowRightLeft, color: T.sec.library }
  };
  const metaFor = (id) => CAT_META[id] || { Icon: FlaskConical, color: T.primary };
  // Flag clinically dangerous values so they read like a real chart alert.
  const isAlert = (note) => !!note && /critical|toxic|fatal|danger|risk/i.test(note);

  const searching = query.trim().length > 0;
  const totalInCat = REFERENCE.filter(r => r.cat === cat).length;

  return (
    <div className="anim-fadeup">
      <TopBar title="Reference" onBack={onBack} feedback={{ screen: "Reference" }}
              right={!searching && (
                <div className="text-[11px] font-medium tabular-nums px-2 py-1 rounded-full"
                     style={{ background: metaFor(cat).color + '14', color: metaFor(cat).color }}>
                  {totalInCat}
                </div>
              )} />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pb-24 pt-2">

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
                 placeholder="Search labs, drugs, abbreviations…"
                 className="w-full rounded-2xl pl-10 pr-10 py-3 text-sm font-body"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink,
                          boxShadow: '0 1px 2px rgba(26,43,35,0.04)' }} />
          {query && (
            <button onClick={() => setQuery('')}
                    className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5">
              <X size={14} style={{ color: T.muted }} />
            </button>
          )}
        </div>

        {/* Category selector — colour-coded icon chips */}
        {!searching && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
            {REFERENCE_CATEGORIES.map(c => {
              const { Icon, color } = metaFor(c.id);
              const active = cat === c.id;
              return (
                <button key={c.id} onClick={() => setCat(c.id)}
                        className="no-tap-highlight flex-shrink-0 pl-2 pr-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
                        style={{ background: active ? color : T.surface,
                                 color: active ? '#FFF' : T.inkSoft,
                                 border: `1px solid ${active ? color : T.border}`,
                                 boxShadow: active ? `0 2px 8px ${color}33` : 'none' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: active ? 'rgba(255,255,255,0.2)' : color + '15' }}>
                    <Icon size={13} style={{ color: active ? '#FFF' : color }} />
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {searching && (
          <div className="text-xs mb-3 px-1 font-medium" style={{ color: T.muted }}>
            {filtered.length} match{filtered.length === 1 ? '' : 'es'} across all categories
          </div>
        )}

        {/* Sections */}
        {(loading && REFERENCE.length === 0) || (error && REFERENCE.length === 0) ? (
          <ContentGate loading={loading} error={error} onRetry={reload} label="reference" />
        ) : grouped.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                 style={{ background: T.surfaceWarm }}>
              <Search size={24} style={{ color: T.muted, opacity: 0.5 }} />
            </div>
            <div className="text-sm font-medium" style={{ color: T.inkSoft }}>No matches for "{query}"</div>
            <div className="text-xs mt-1" style={{ color: T.muted }}>Try a shorter or different term</div>
          </div>
        ) : (
          grouped.map(group => {
            const { Icon, color } = metaFor(group.cat);
            const catName = REFERENCE_CATEGORIES.find(c => c.id === group.cat)?.name;
            return (
              <div key={group.cat + group.section} className="mb-5">
                {/* Section header — icon tile + title, with category context when searching */}
                <div className="flex items-center gap-2.5 mb-2 px-1">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: color + '16' }}>
                    <Icon size={13} style={{ color }} />
                  </span>
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[13px] font-semibold truncate" style={{ color: T.ink }}>{group.section}</span>
                    {searching && catName && (
                      <span className="text-[10px] uppercase tracking-wider flex-shrink-0" style={{ color: T.muted }}>{catName}</span>
                    )}
                  </div>
                </div>

                <Card className="overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
                  {group.items.map((item, idx) => {
                    const alert = isAlert(item.note);
                    return (
                      <div key={item.label + idx}
                           className="px-4 py-3"
                           style={{ borderBottom: idx < group.items.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
                        <div className="flex items-baseline justify-between gap-4">
                          <div className="text-[13px] font-medium leading-snug" style={{ color: T.ink }}>{item.label}</div>
                          <div className="text-[13px] font-semibold text-right tabular-nums tracking-tight flex-shrink-0"
                               style={{ color: T.inkSoft }}>{item.value}</div>
                        </div>
                        {item.note && (
                          alert ? (
                            <div className="flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-lg"
                                 style={{ background: T.errorSoft }}>
                              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
                              <div className="text-[11px] leading-snug font-medium" style={{ color: T.error }}>{item.note}</div>
                            </div>
                          ) : (
                            <div className="text-[11px] mt-1.5 leading-snug" style={{ color: T.muted }}>{item.note}</div>
                          )
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


function ReferenceLookupModal({ open, onClose }) {
  const { theme: T } = useTheme();
  const [cat, setCat] = useState('labs');
  const [query, setQuery] = useState('');
  // A2 — reference table loaded lazily from /public/data/reference.json.
  const { data: refData, loading, error, reload } = useContent('reference');
  const REFERENCE = refData || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return REFERENCE.filter(r =>
        r.label.toLowerCase().includes(q) ||
        r.value.toLowerCase().includes(q) ||
        (r.note && r.note.toLowerCase().includes(q)) ||
        r.section.toLowerCase().includes(q)
      );
    }
    return REFERENCE.filter(r => r.cat === cat);
  }, [cat, query, refData]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(item => {
      const key = `${item.cat}::${item.section}`;
      if (!map.has(key)) map.set(key, { cat: item.cat, section: item.section, items: [] });
      map.get(key).items.push(item);
    });
    return Array.from(map.values());
  }, [filtered]);

  const CAT_META = {
    labs:   { Icon: FlaskConical,   color: T.sec.stats },
    vitals: { Icon: HeartPulse,     color: T.sec.topic },
    drugs:  { Icon: PillIcon,       color: T.sec.revision },
    abbr:   { Icon: ClipboardList,  color: T.sec.learn },
    conv:   { Icon: ArrowRightLeft, color: T.sec.library }
  };
  const metaFor = (id) => CAT_META[id] || { Icon: FlaskConical, color: T.primary };
  const isAlert = (note) => !!note && /critical|toxic|fatal|danger|risk/i.test(note);
  const searching = query.trim().length > 0;
  const dialogRef = useFocusTrap(onClose, open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.5)' }}
         onClick={onClose}>
      <div className="w-full max-w-md mx-auto flex flex-col anim-scalein rounded-t-3xl sm:rounded-3xl overflow-hidden"
           ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quick reference"
           style={{ background: T.bg, maxHeight: '88vh', border: `1px solid ${T.border}` }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
             style={{ borderBottom: `1px solid ${T.borderSoft}`, background: T.surface }}>
          <div className="flex items-center gap-2">
            <FlaskConical size={18} style={{ color: T.accent }} />
            <div className="font-display text-lg font-semibold" style={{ color: T.ink }}>Quick reference</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
            <X size={20} style={{ color: T.muted }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-4 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
            <input value={query} onChange={e => setQuery(e.target.value)} autoFocus={false}
                   placeholder="Search labs, drugs, abbreviations…"
                   className="w-full rounded-2xl pl-10 pr-10 py-3 text-sm font-body"
                   style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
            {query && (
              <button onClick={() => setQuery('')}
                      className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg active:bg-black/5">
                <X size={14} style={{ color: T.muted }} />
              </button>
            )}
          </div>

          {/* Category chips */}
          {!searching && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
              {REFERENCE_CATEGORIES.map(c => {
                const { Icon, color } = metaFor(c.id);
                const active = cat === c.id;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)}
                          className="no-tap-highlight flex-shrink-0 pl-2 pr-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
                          style={{ background: active ? color : T.surface,
                                   color: active ? '#FFF' : T.inkSoft,
                                   border: `1px solid ${active ? color : T.border}` }}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: active ? 'rgba(255,255,255,0.2)' : color + '15' }}>
                      <Icon size={13} style={{ color: active ? '#FFF' : color }} />
                    </span>
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {searching && (
            <div className="text-xs mb-3 px-1 font-medium" style={{ color: T.muted }}>
              {filtered.length} match{filtered.length === 1 ? '' : 'es'} across all categories
            </div>
          )}

          {/* Grouped list */}
          {(loading && REFERENCE.length === 0) || (error && REFERENCE.length === 0) ? (
            <ContentGate loading={loading} error={error} onRetry={reload} label="reference" />
          ) : grouped.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-sm font-medium" style={{ color: T.inkSoft }}>No matches for "{query}"</div>
              <div className="text-xs mt-1" style={{ color: T.muted }}>Try a shorter or different term</div>
            </div>
          ) : (
            grouped.map(group => {
              const { Icon, color } = metaFor(group.cat);
              const catName = REFERENCE_CATEGORIES.find(c => c.id === group.cat)?.name;
              return (
                <div key={group.cat + group.section} className="mb-4">
                  <div className="flex items-center gap-2.5 mb-2 px-1">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: color + '16' }}>
                      <Icon size={13} style={{ color }} />
                    </span>
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[13px] font-semibold truncate" style={{ color: T.ink }}>{group.section}</span>
                      {searching && catName && (
                        <span className="text-[10px] uppercase tracking-wider flex-shrink-0" style={{ color: T.muted }}>{catName}</span>
                      )}
                    </div>
                  </div>
                  <Card className="overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
                    {group.items.map((item, idx) => {
                      const alert = isAlert(item.note);
                      return (
                        <div key={item.label + idx} className="px-4 py-3"
                             style={{ borderBottom: idx < group.items.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
                          <div className="flex items-baseline justify-between gap-4">
                            <div className="text-[13px] font-medium leading-snug" style={{ color: T.ink }}>{item.label}</div>
                            <div className="text-[13px] font-semibold text-right tabular-nums tracking-tight flex-shrink-0"
                                 style={{ color: T.inkSoft }}>{item.value}</div>
                          </div>
                          {item.note && (
                            alert ? (
                              <div className="flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-lg" style={{ background: T.errorSoft }}>
                                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
                                <div className="text-[11px] leading-snug font-medium" style={{ color: T.error }}>{item.note}</div>
                              </div>
                            ) : (
                              <div className="text-[11px] mt-1.5 leading-snug" style={{ color: T.muted }}>{item.note}</div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </Card>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export { Reference, ReferenceLookupModal, REFERENCE_CATEGORIES };
