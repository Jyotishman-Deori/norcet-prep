// =====================================================================
// src/screens/nursing-calc.jsx — the Nursing Calculator Suite.
//
// One lazy route ('nursing-calc') with an internal hub <-> calculator
// sub-view (the settings.jsx sub-page pattern): device back pops the open
// calculator first, then leaves the screen.
//
// EVERYTHING here is offline, deterministic, hardcoded math from
// src/lib/calc-*.js via the src/data/calculators.js registry. ZERO AI, ever
// (hard rule). The screen renders forms GENERICALLY from each entry's input
// schema, so all 23 tools share one code path:
//   • results compute live once every required visible input is valid,
//   • the result card always shows the formula, the standard, and the stated
//     rounding rule (the envelope carries them; the card just renders),
//   • interpretation bands render with their source and, where flagged, a
//     visible "verify against your institution's protocol" tag,
//   • the per-calculator disclaimer (CALC_DISCLAIMER) is always on screen.
//
// Recently used (cap 6) + calculation history (cap 12) persist locally per
// profile (KEYS.nursingCalc, shared:false — health-adjacent values never
// leave the device). One-time ClinicalNote on first open, gated by
// preferences.clinicalNoteCalcSeen (the DosageSetup pattern).
// =====================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Baby, Calculator, Check, ChevronRight, ClipboardList, Copy,
  Droplet, History, Info, Ruler, Search, ShieldCheck, Syringe, Trash2, X,
} from 'lucide-react';
import { useTheme, useData, useProfile } from '../lib/app-context.jsx';
import { Card, TopBar, EduTag } from '../ui/primitives.jsx';
import PageContainer from '../ui/page-container.jsx';
import ClinicalNote from '../ui/clinical-note.jsx';
import { useBackHandler } from '../lib/back-handler.js';
import { safeStorage } from '../lib/safe-storage.js';
import { KEYS } from '../lib/keys.js';
import { prefersReducedMotion } from '../lib/juice.js';
import {
  CALCULATORS, CALC_CATEGORIES, CALC_DISCLAIMER, calculatorById, searchCalculators,
} from '../data/calculators.js';

const RECENT_CAP = 6;
const HISTORY_CAP = 12;

const CAT_ICONS = {
  dosage: Syringe, body: Ruler, fluids: Droplet,
  conversion: Copy, scores: ClipboardList, obstetric: Baby,
};
// One fixed accent per category (theme-independent, like FAV_SECTIONS hues).
const CAT_HUES = {
  dosage: '#0E7490', body: '#7C3AED', fluids: '#0369A1',
  conversion: '#B45309', scores: '#BE185D', obstetric: '#15803D',
};

const buzz = (ms) => { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };

async function copyText(str) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(str);
      return true;
    }
  } catch (e) {}
  return false;
}

// ---- local store: { recent, history } --------------------------------------
const cleanStore = (v) => {
  const out = { recent: [], history: [] };
  if (v && typeof v === 'object') {
    if (Array.isArray(v.recent)) out.recent = v.recent.filter((id) => calculatorById(id)).slice(0, RECENT_CAP);
    if (Array.isArray(v.history)) out.history = v.history.filter((h) => h && h.calcId && h.display).slice(0, HISTORY_CAP);
  }
  return out;
};

// `initialCalcId` / `initialValues` open the screen straight on one calculator
// with prefilled inputs. Used by the render smoke to exercise the detail view
// and the result card at build time; also ready for future deep links.
function NursingCalcScreen({ onBack, initialCalcId, initialValues }) {
  const { theme: T } = useTheme();
  const { data, setData } = useData();
  const { profile } = useProfile();
  const profileId = (profile && (profile.uid || profile.id)) || 'guest';
  const reduced = prefersReducedMotion();

  const [activeId, setActiveId] = useState(
    () => (initialCalcId && calculatorById(initialCalcId) ? initialCalcId : null)  // null = hub
  );
  const [query, setQuery] = useState('');
  const [store, setStore] = useState({ recent: [], history: [] });
  const [hydrated, setHydrated] = useState(false);
  const active = activeId ? calculatorById(activeId) : null;

  // One-time practice-environment note (Layer 2b pattern, own flag).
  const [clinicalNote, setClinicalNote] = useState(false);
  const noteSeen = !!(data && data.preferences && data.preferences.clinicalNoteCalcSeen);
  const markNoteSeen = () => setData(prev => ({
    ...prev,
    preferences: { ...(prev.preferences || {}), clinicalNoteCalcSeen: true },
  }));
  useEffect(() => {
    if (!noteSeen) setClinicalNote(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate recents + history (local only).
  useEffect(() => {
    let alive = true;
    safeStorage.get(KEYS.nursingCalc(profileId), false)
      .then(r => {
        if (!alive) return;
        try { setStore(cleanStore(r && r.value ? JSON.parse(r.value) : null)); } catch (e) {}
        setHydrated(true);
      })
      .catch(() => { if (alive) setHydrated(true); });
    return () => { alive = false; };
  }, [profileId]);

  useEffect(() => {
    if (!hydrated) return;
    try { safeStorage.set(KEYS.nursingCalc(profileId), JSON.stringify(store), false); } catch (e) {}
  }, [store, hydrated, profileId]);

  // Device back pops the open calculator first, then leaves the screen.
  useBackHandler(() => {
    if (activeId) { setActiveId(null); return true; }
    return false;
  });

  const openCalc = (id) => {
    setActiveId(id);
    setQuery('');
    buzz(6);
    setStore(prev => ({
      ...prev,
      recent: [id, ...prev.recent.filter(r => r !== id)].slice(0, RECENT_CAP),
    }));
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) {}
  };

  // Called by the calculator view whenever a NEW valid result lands, so the
  // history log survives navigation. Deduped against the newest entry.
  const logResult = (calc, summary, result) => {
    setStore(prev => {
      const top = prev.history[0];
      if (top && top.calcId === calc.id && top.summary === summary && top.display === result.display) return prev;
      return {
        ...prev,
        history: [{
          calcId: calc.id, name: calc.name, summary,
          display: result.display, unit: result.unit || '', ts: Date.now(),
        }, ...prev.history].slice(0, HISTORY_CAP),
      };
    });
  };

  const clearHistory = () => { setStore(prev => ({ ...prev, history: [] })); buzz(8); };

  const results = useMemo(() => searchCalculators(query), [query]);

  return (
    <div className="anim-fadeup">
      <TopBar title={active ? active.name : 'Nursing Calculator Suite'}
              onBack={active ? () => setActiveId(null) : onBack}
              favId={active ? undefined : 'nursing-calc'}
              feedback={{ screen: active ? `Calc: ${active.name}` : 'Nursing Calculator Suite' }}
              solid />
      <PageContainer size="content" className="pt-2 pb-32">
        {active ? (
          <CalculatorView key={active.id} T={T} calc={active} reduced={reduced} onResult={logResult}
                          initialValues={active.id === initialCalcId ? initialValues : undefined} />
        ) : (
          <Hub T={T} reduced={reduced} query={query} setQuery={setQuery} results={results}
               recent={store.recent} history={store.history}
               onOpen={openCalc} onClearHistory={clearHistory} />
        )}
        <EduTag className="mt-8" />
      </PageContainer>

      <ClinicalNote
        open={clinicalNote}
        title="A reference tool, not an order"
        body={'Every calculator here runs a fixed, published formula on this device, and each result shows the formula it used.\n\nThe numbers are for study and quick reference. Real medication and care decisions always follow your institution protocols, the prescriber and current official references.'}
        buttonLabel="Understood"
        onAcknowledge={() => { setClinicalNote(false); markNoteSeen(); }}
        onClose={() => { setClinicalNote(false); markNoteSeen(); }} />
    </div>
  );
}

// =====================================================================
// HUB — search, recently used, history, six category groups.
// =====================================================================
function Hub({ T, reduced, query, setQuery, results, recent, history, onOpen, onClearHistory }) {
  const searching = query.trim().length > 0;
  const recentCalcs = recent.map(calculatorById).filter(Boolean);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      {/* hero strip — offline + zero-AI promise up front */}
      <div className="flex items-center gap-2.5 mb-4 px-3.5 py-2.5 rounded-xl"
           style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
        <ShieldCheck size={15} style={{ color: T.success, flexShrink: 0 }} aria-hidden="true" />
        <div className="text-xs leading-snug" style={{ color: T.inkSoft }}>
          Fixed published formulas, computed on this device. Works fully offline, and every result shows its formula.
        </div>
      </div>

      {/* search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: T.muted }} aria-hidden="true" />
        <input value={query}
               onChange={(e) => setQuery(e.target.value)}
               placeholder="Find a calculator: drip, BMI, GCS..."
               aria-label="Search calculators"
               inputMode="search" autoComplete="off"
               className="w-full rounded-xl pl-10 pr-9 py-3 text-sm"
               style={{ background: T.bg, border: `1.5px solid ${T.border}`, color: T.ink, outline: 'none' }}
               onFocus={(e) => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.primary}1A`; }}
               onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }} />
        {searching && (
          <button onClick={() => setQuery('')} aria-label="Clear search"
                  className="no-tap-highlight absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg active:bg-black/5">
            <X size={14} style={{ color: T.muted }} />
          </button>
        )}
      </div>

      {searching ? (
        /* search results */
        results.length ? (
          <div className="space-y-2 mb-6">
            {results.map((c, i) => (
              <CalcRow key={c.id} T={T} c={c} reduced={reduced} index={i} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-center py-8" style={{ color: T.muted }}>
            Nothing matches. Try a shorter word, like drip, dose or scale.
          </div>
        )
      ) : (
        <>
          {/* recently used */}
          {recentCalcs.length > 0 && (
            <>
              <SectionLabel T={T}>Recently used</SectionLabel>
              <div className="flex flex-wrap gap-2 mb-5">
                {recentCalcs.map((c, i) => {
                  const hue = CAT_HUES[c.cat] || T.primary;
                  return (
                    <button key={c.id} onClick={() => onOpen(c.id)}
                            className={'no-tap-highlight inline-flex items-center gap-1.5 pl-2.5 pr-3 py-2 rounded-full text-xs font-semibold active:scale-95 transition' + (reduced ? '' : ' calc-chip-in')}
                            style={{
                              background: hue + '14', border: `1.5px solid ${hue}40`, color: hue,
                              animationDelay: reduced ? undefined : `${i * 45}ms`,
                            }}>
                      <History size={12} aria-hidden="true" />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* history log */}
          {history.length > 0 && (
            <Card className="p-0 mb-5 overflow-hidden">
              <button onClick={() => setHistoryOpen(v => !v)}
                      className="no-tap-highlight w-full flex items-center justify-between gap-2 px-4 py-3 text-left active:bg-black/5"
                      aria-expanded={historyOpen}>
                <div className="flex items-center gap-2 min-w-0">
                  <History size={15} style={{ color: T.primary, flexShrink: 0 }} aria-hidden="true" />
                  <span className="text-sm font-semibold" style={{ color: T.ink }}>Recent calculations</span>
                  <span className="text-xs" style={{ color: T.muted }}>({history.length})</span>
                </div>
                <ChevronRight size={15} style={{ color: T.muted, transform: historyOpen ? 'rotate(90deg)' : 'none', transition: 'transform 180ms' }} aria-hidden="true" />
              </button>
              {historyOpen && (
                <div style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                  {history.map((h, i) => (
                    <button key={h.ts + '-' + i} onClick={() => onOpen(h.calcId)}
                            className="no-tap-highlight w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left active:bg-black/5"
                            style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate" style={{ color: T.ink }}>{h.name}</div>
                        {h.summary && <div className="text-[11px] truncate mt-0.5" style={{ color: T.muted }}>{h.summary}</div>}
                      </div>
                      <div className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: T.primary }}>
                        {h.display}{h.unit ? ' ' + h.unit : ''}
                      </div>
                    </button>
                  ))}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[11px]" style={{ color: T.muted }}>Saved on this device only. Never synced.</span>
                    <button onClick={onClearHistory}
                            className="no-tap-highlight inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg active:scale-95"
                            style={{ color: T.error }}>
                      <Trash2 size={12} aria-hidden="true" /> Clear
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* the six category groups */}
          {CALC_CATEGORIES.map((cat) => {
            const items = CALCULATORS.filter((c) => c.cat === cat.id);
            const hue = CAT_HUES[cat.id] || T.primary;
            const Icon = CAT_ICONS[cat.id] || Calculator;
            return (
              <div key={cat.id} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: hue + '16' }}>
                    <Icon size={13} style={{ color: hue }} aria-hidden="true" />
                  </span>
                  <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>{cat.label}</div>
                  <div className="flex-1 h-px" style={{ background: T.borderSoft }} aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  {items.map((c, i) => (
                    <CalcRow key={c.id} T={T} c={c} reduced={reduced} index={i} onOpen={onOpen} />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function SectionLabel({ T, children }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>{children}</div>
      <div className="flex-1 h-px" style={{ background: T.borderSoft }} aria-hidden="true" />
    </div>
  );
}

// A large-tap-target calculator row (56px+), used by search and the groups.
function CalcRow({ T, c, reduced, index, onOpen }) {
  const hue = CAT_HUES[c.cat] || T.primary;
  return (
    <Card onClick={() => onOpen(c.id)}
          className={'home-notice p-3.5' + (reduced ? '' : ' calc-chip-in')}
          style={reduced ? undefined : { animationDelay: `${Math.min(index, 8) * 40}ms` }}
          ariaLabel={`Open ${c.name}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: hue + '14', border: `1px solid ${hue}30` }}>
          <Calculator size={17} style={{ color: hue }} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold" style={{ color: T.ink }}>{c.name}</div>
          <div className="text-xs mt-0.5 truncate" style={{ color: T.muted }}>{c.subtitle}</div>
        </div>
        <ChevronRight size={16} className="flex-shrink-0" style={{ color: T.muted }} aria-hidden="true" />
      </div>
    </Card>
  );
}

// =====================================================================
// CALCULATOR VIEW — generic form + live result card.
// =====================================================================
function CalculatorView({ T, calc, reduced, onResult, initialValues }) {
  const hue = CAT_HUES[calc.cat] || T.primary;

  // Seed segments to their first option so a one-hand flow starts instantly;
  // everything else starts blank (or from the deep-link prefill).
  const [values, setValues] = useState(() => {
    const v = {};
    const seed = initialValues || {};
    for (const inp of calc.inputs) {
      v[inp.key] = seed[inp.key] !== undefined
        ? String(seed[inp.key])
        : (inp.type === 'segment' ? inp.options[0].value : '');
    }
    return v;
  });
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const visible = calc.inputs.filter((inp) => {
    if (!inp.showIf) return true;
    return Object.entries(inp.showIf).every(([k, vals]) => vals.includes(values[k]));
  });

  // Compute only once every required VISIBLE input has something in it, so the
  // user is never shown "X is required" mid-typing. Invalid values still show
  // the engine's plain-sentence error.
  const filled = visible.every((inp) => inp.optional || String(values[inp.key] || '').trim() !== '');
  const result = useMemo(() => {
    if (!filled) return null;
    const args = {};
    for (const inp of visible) args[inp.key] = values[inp.key];
    try { return calc.compute(args); } catch (e) { return { ok: false, error: 'Something went wrong with these inputs.' }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, values, calc]);

  // Log valid results to the history (debounced so mid-typing states settle).
  const summary = visible
    .map((inp) => {
      const v = String(values[inp.key] || '').trim();
      if (!v) return null;
      const opt = (inp.options || []).find((o) => o.value === v);
      return `${inp.label}: ${opt ? opt.label : v}${!opt && inp.unit ? ' ' + inp.unit : ''}`;
    })
    .filter(Boolean)
    .join(', ');
  useEffect(() => {
    if (!result || !result.ok) return undefined;
    const t = setTimeout(() => { onResult(calc, summary, result); buzz(10); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result && result.display, result && result.ok]);

  const set = (key, val) => setValues((prev) => ({ ...prev, [key]: val }));

  const doCopy = async () => {
    if (!result || !result.ok) return;
    const okCopy = await copyText(`${calc.name}: ${result.display}${result.unit ? ' ' + result.unit : ''} (${result.standard})`);
    if (okCopy) {
      setCopied(true);
      buzz(10);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1400);
    }
  };

  // Group bands for display (BMI carries two labelled sets side by side).
  const bandGroups = useMemo(() => {
    if (!result || !result.ok || !result.bands || !result.bands.length) return [];
    const groups = new Map();
    for (const b of result.bands) {
      const g = b.group || '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(b);
    }
    return [...groups.entries()];
  }, [result]);

  // How many of the REQUIRED visible fields still need a value. Drives the "1 of 3"
  // counter and the empty-state copy, so the screen always tells the user exactly
  // what it is waiting for instead of just sitting there.
  const required = visible.filter((inp) => !inp.optional);
  const filledCount = required.filter((inp) => String(values[inp.key] || '').trim() !== '').length;
  const remaining = Math.max(0, required.length - filledCount);

  return (
    <>
      {/* header strip: what this is + the formula chip */}
      <div className="mb-4">
        <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>{calc.subtitle}.</div>
        <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-medium"
             style={{ background: hue + '12', color: hue }}>
          <Info size={11} aria-hidden="true" /> {calc.formulaLabel}
        </div>
      </div>

      {/* HOW IT WORKS — the screen used to open as a subtitle and blank rows, with
          no hint that anything would ever happen. Three steps set the expectation
          before the user touches a single field. */}
      <div className="flex items-stretch gap-1.5 mb-4">
        {[
          { n: 1, label: 'Enter the details' },
          { n: 2, label: 'Answer appears instantly' },
          { n: 3, label: 'Check it against your protocol' },
        ].map((s, i) => (
          <div key={s.n}
               className={'flex-1 rounded-xl px-2.5 py-2' + (reduced ? '' : ' calc-chip-in')}
               style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}`,
                        animationDelay: reduced ? undefined : `${i * 70}ms` }}>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: hue + '20', color: hue }}>{s.n}</span>
              <span className="text-[10.5px] font-semibold leading-tight" style={{ color: T.inkSoft }}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* the form */}
      <Card className="p-4 mb-4">
        {/* Form header + a live counter, so progress toward an answer is visible. */}
        <div className="flex items-center justify-between gap-3 mb-3.5 pb-3"
             style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
          <div className="text-[13px] font-semibold" style={{ color: T.ink }}>Enter the details</div>
          {required.length > 0 && (
            <div className="text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-full"
                 style={{ background: filled ? T.success + '18' : T.surfaceWarm,
                          color: filled ? T.success : T.muted }}>
              {filledCount} of {required.length} filled
            </div>
          )}
        </div>
        <div className="space-y-4">
          {visible.map((inp) => (
            <FormInput key={inp.key} T={T} hue={hue} inp={inp} value={values[inp.key]} onChange={set} reduced={reduced} />
          ))}
        </div>
      </Card>

      {/* RESULT PLACEHOLDER — shown until every required field has a value. Without
          this the screen was simply blank below the form and read as broken. */}
      {!filled && (
        <Card className={'p-6 mb-4 text-center' + (reduced ? '' : ' calc-empty-in')}
              style={{ background: 'transparent', border: `1.5px dashed ${T.border}` }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-3"
               style={{ background: hue + '12' }}>
            <Calculator size={20} style={{ color: hue }} aria-hidden="true" />
          </div>
          <div className="text-[13.5px] font-semibold mb-1.5" style={{ color: T.ink }}>
            Your answer will appear here
          </div>
          <div className="text-[12.5px] leading-relaxed mx-auto" style={{ color: T.muted, maxWidth: 320 }}>
            {remaining > 0
              ? `Fill in ${remaining === required.length ? 'the' : 'the last'} ${remaining} ${remaining === 1 ? 'detail' : 'details'} above. The result updates as you type, and always shows the formula it used.`
              : 'The result updates as you type, and always shows the formula it used.'}
          </div>
        </Card>
      )}

      {/* the result card / validation message */}
      {result && !result.ok && (
        <Card className="p-4 mb-4" style={{ background: T.errorSoft, border: `1px solid ${T.error}30` }}>
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} style={{ color: T.error, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div className="text-sm leading-relaxed" style={{ color: T.error }}>{result.error}</div>
          </div>
        </Card>
      )}

      {result && result.ok && (
        <Card className={'p-0 mb-4 overflow-hidden' + (reduced ? '' : ' calc-result-in')}>
          {/* headline value */}
          <div className="px-5 pt-5 pb-4 text-center" style={{ background: hue + '0C' }}>
            <div className="text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: hue }}>
              {calc.name}
            </div>
            <div key={result.display}
                 className={'font-display font-bold tabular-nums' + (reduced ? '' : ' calc-value-pop')}
                 style={{ color: T.ink, fontSize: result.display.length > 8 ? '1.7rem' : '2.4rem', lineHeight: 1.15 }}>
              {result.display}{result.unit ? <span className="text-lg font-semibold ml-1.5" style={{ color: T.inkSoft }}>{result.unit}</span> : null}
            </div>
            {/* secondary readouts */}
            {result.extras && result.extras.length > 0 && (
              <div className="mt-3 space-y-1">
                {result.extras.map((ex, i) => (
                  <div key={i} className="text-xs" style={{ color: T.inkSoft }}>
                    <span style={{ color: T.muted }}>{ex.label}: </span>
                    <span className="font-semibold tabular-nums">{ex.value}</span>
                    {ex.note ? <span style={{ color: T.muted }}> ({ex.note})</span> : null}
                  </div>
                ))}
              </div>
            )}
            <button onClick={doCopy}
                    className="no-tap-highlight inline-flex items-center gap-1.5 mt-3.5 px-3.5 py-2 rounded-full text-xs font-semibold active:scale-95 transition"
                    style={{
                      background: copied ? T.success : hue,
                      color: '#FFF',
                      boxShadow: `0 3px 12px ${copied ? T.success : hue}45`,
                    }}
                    aria-label="Copy the result value">
              {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy value'}
            </button>
          </div>

          {/* formula + standard + rounding: ALWAYS visible, screenshot-friendly */}
          <div className="px-4 py-3 space-y-1.5" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
            <MetaLine T={T} label="Formula" value={result.formula} />
            <MetaLine T={T} label="Standard" value={result.standard} />
            <MetaLine T={T} label="Rounding" value={result.rounding} />
          </div>

          {/* worked steps */}
          {result.steps && result.steps.length > 0 && (
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Working</div>
              <ol className="space-y-1">
                {result.steps.map((s, i) => (
                  <li key={i} className="text-xs tabular-nums flex gap-2" style={{ color: T.inkSoft }}>
                    <span className="font-semibold flex-shrink-0" style={{ color: T.muted }}>{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* interpretation bands, per labelled group, each with its source */}
          {bandGroups.map(([group, bands]) => (
            <div key={group || 'bands'} className="px-4 py-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
                  {group || 'Reference ranges'}
                </div>
                {bands.some((b) => b.flagged) && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: T.accentSoft, color: T.accent }}>
                    Verify against your institution's protocol
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {bands.map((b, i) => (
                  <div key={i}
                       className={'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs' + (b.match && !reduced ? ' calc-band-sweep' : '')}
                       style={{
                         background: b.match ? hue + '14' : 'transparent',
                         color: b.match ? T.ink : T.muted,
                         fontWeight: b.match ? 600 : 400,
                         '--band-glow': hue + '28',
                       }}>
                    {b.match
                      ? <Check size={12} style={{ color: hue, flexShrink: 0 }} aria-hidden="true" />
                      : <span className="w-3 flex-shrink-0" aria-hidden="true" />}
                    <span>{b.label}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] mt-1.5" style={{ color: T.muted }}>Source: {bands[0].source}.</div>
            </div>
          ))}

          {/* warnings from the engine */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="px-4 py-3 space-y-1.5" style={{ borderTop: `1px solid ${T.borderSoft}`, background: T.accentSoft + '55' }}>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                  <AlertTriangle size={12} style={{ color: T.accent, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* persistent per-calculator disclaimer (owner's verbatim sentence) */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[11px] leading-relaxed"
           style={{ background: T.surfaceWarm, color: T.muted, borderLeft: `3px solid ${T.border}` }}
           role="note">
        <ShieldCheck size={12} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        <span>{CALC_DISCLAIMER}</span>
      </div>
    </>
  );
}

function MetaLine({ T, label, value }) {
  if (!value) return null;
  return (
    <div className="text-xs leading-snug">
      <span className="font-semibold" style={{ color: T.muted }}>{label}: </span>
      <span style={{ color: T.inkSoft }}>{value}</span>
    </div>
  );
}

// One generic input renderer for all five input types. Large targets
// throughout (48px fields, 44px+ options) for one-handed bedside use.
function FormInput({ T, hue, inp, value, onChange, reduced }) {
  const label = (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-xs font-semibold" style={{ color: T.ink }} htmlFor={`calc-${inp.key}`}>
        {inp.label}
        {inp.unit ? <span className="font-normal" style={{ color: T.muted }}> ({inp.unit})</span> : null}
      </label>
      {inp.optional && <span className="text-[10px]" style={{ color: T.muted }}>optional</span>}
    </div>
  );

  if (inp.type === 'segment') {
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={inp.label}>
          {inp.options.map((o) => {
            const on = value === o.value;
            return (
              <button key={o.value} onClick={() => onChange(inp.key, o.value)}
                      role="radio" aria-checked={on}
                      className={'no-tap-highlight px-3.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition' + (on && !reduced ? ' note-select-pop' : '')}
                      style={{
                        background: on ? hue : T.bg,
                        border: `1.5px solid ${on ? hue : T.border}`,
                        color: on ? '#FFF' : T.inkSoft,
                        minHeight: 44,
                      }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (inp.type === 'select') {
    return (
      <div>
        {label}
        <div className="relative">
          <select id={`calc-${inp.key}`} value={value}
                  onChange={(e) => onChange(inp.key, e.target.value)}
                  aria-label={inp.label}
                  className="w-full appearance-none rounded-xl px-3.5 py-3 pr-9 text-sm"
                  style={{
                    background: T.bg,
                    border: `1.5px solid ${String(value).trim() ? hue + '70' : T.border}`,
                    color: String(value).trim() ? T.ink : T.muted,
                    outline: 'none', minHeight: 48,
                  }}>
            <option value="" disabled>Choose...</option>
            {inp.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronRight size={15} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none"
                        style={{ color: T.muted }} aria-hidden="true" />
        </div>
      </div>
    );
  }

  // number / date / time share the text-field treatment
  const inputType = inp.type === 'date' ? 'date' : 'text';
  const inputMode = inp.type === 'number' ? 'decimal' : undefined;
  return (
    <div>
      {label}
      <input id={`calc-${inp.key}`}
             type={inputType}
             inputMode={inputMode}
             value={value}
             onChange={(e) => onChange(inp.key, e.target.value)}
             placeholder={inp.type === 'time' ? 'e.g. 13:45' : inp.placeholder}
             autoComplete="off"
             aria-label={inp.label}
             className="w-full rounded-xl px-3.5 py-3 text-base font-medium tabular-nums"
             style={{
               background: T.bg, border: `1.5px solid ${T.border}`, color: T.ink,
               outline: 'none', minHeight: 48,
               transition: 'border-color 160ms, box-shadow 160ms',
             }}
             onFocus={(e) => { e.currentTarget.style.borderColor = hue; e.currentTarget.style.boxShadow = `0 0 0 3px ${hue}1A`; }}
             onBlur={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }} />
      {inp.hint && <div className="text-[11px] mt-1" style={{ color: T.muted }}>{inp.hint}</div>}
    </div>
  );
}

export default NursingCalcScreen;
