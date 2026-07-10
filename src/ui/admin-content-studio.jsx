// =====================================================================
// src/ui/admin-content-studio.jsx — author the four content packs
// (dosage drills, concept cards, reference values, quotes) that merge OVER
// the bundled base at runtime (src/lib/content-packs.js). Each pack lives in
// kv_shared under cpack:<type> (public read, Co-Admin+ write via kv-write).
//
// One shell, four sections. Every section: current pack summary, a JSON
// paste box validated per-type with a per-item error report, Append/Replace,
// a live preview, Save. Quotes + reference also get a quick single-item form.
// A format guide (collapsible) shows the exact shape. No em dashes in any
// authored copy (the validator rejects them).
// =====================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, FileText, BookOpen, Beaker, Quote, Plus, AlertTriangle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from './primitives.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { logAdminAction } from '../lib/admin-audit.js';
import {
  CPACK_TYPES, cpackKey, validatePackItems, makePack, normalizePack,
} from '../lib/content-packs.js';

const SECTIONS = [
  { type: 'dosage',       title: 'Dosage drills',  icon: Beaker,   noun: 'drill',   plural: 'drills' },
  { type: 'conceptCards', title: 'Concept cards',  icon: BookOpen, noun: 'group',   plural: 'card groups' },
  { type: 'reference',    title: 'Reference values', icon: FileText, noun: 'value',  plural: 'values' },
  { type: 'quotes',       title: 'Quotes',         icon: Quote,    noun: 'quote',   plural: 'quotes' },
];

const GUIDE = {
  dosage: `[
  { "id": "d-custom-1", "type": "tablets",
    "q": "Ordered 500 mg, stock 250 mg tablets. How many tablets?",
    "answer": 2, "unit": "tablet(s)", "tolerance": 0,
    "steps": ["Desired / on-hand = 500 / 250"], "intuition": "Two halves make one." }
]`,
  conceptCards: `[
  { "topicId": "fund", "sub": "Vital Signs",
    "cards": [
      { "type": "concept", "title": "Normal ranges", "body": "Pulse 60 to 100..." },
      { "type": "keypoints", "title": "Red flags", "body": ["Tachy + low BP = shock"] }
    ] }
]`,
  reference: `[
  { "cat": "labs", "section": "Electrolytes", "label": "Potassium",
    "value": "3.5 to 5.0 mmol/L", "note": "Watch the heart at the extremes" }
]`,
  quotes: `[
  { "text": "Discipline is choosing what you want most over what you want now.", "source": "Anonymous" }
]`,
};

function AdminContentStudio({ onBack, actorName }) {
  const { theme: T } = useTheme();
  const [active, setActive] = useState('dosage');
  const section = SECTIONS.find(s => s.type === active) || SECTIONS[0];

  const [pack, setPack] = useState(null);        // current pack {items,...} or null
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);  // { valid, invalid, parseError }
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  // Load the current pack whenever the section changes.
  useEffect(() => {
    let alive = true;
    setLoading(true); setPack(null); setText(''); setPreview(null); setMsg(''); setError('');
    safeStorage.get(cpackKey(active), true)
      .then(r => { if (!alive) return; setPack(r && r.value ? normalizePack(JSON.parse(r.value)) : null); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [active]);

  const currentItems = (pack && Array.isArray(pack.items)) ? pack.items : [];

  const parse = () => {
    setError(''); setMsg('');
    let arr;
    try { arr = JSON.parse(text); }
    catch (e) { setPreview({ valid: [], invalid: [], parseError: 'That is not valid JSON: ' + e.message }); return; }
    setPreview(validatePackItems(active, arr));
  };

  const save = async (mode) => {
    if (!preview || preview.valid.length === 0) return;
    setError(''); setSaving(true);
    try {
      const nextItems = mode === 'replace' ? preview.valid : [...currentItems, ...preview.valid];
      const nextPack = makePack(active, nextItems);
      await safeStorage.set(cpackKey(active), JSON.stringify(nextPack), true);
      setPack(nextPack);
      setText(''); setPreview(null);
      setMsg(`Saved. ${section.title} pack now has ${nextItems.length} ${nextItems.length === 1 ? section.noun : section.plural}.`);
      try { logAdminAction({ action: 'cpack.save', target: active, detail: { mode, count: nextItems.length }, actorName }); } catch (e) {}
    } catch (e) {
      setError('Could not save: ' + (e && e.message ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Content Studio" onBack={onBack} />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 lg:px-8 pb-28 pt-3">
        <div className="text-[12.5px] mb-4 leading-relaxed" style={{ color: T.muted }}>
          Add study content that appears instantly for everyone, no app update needed. New items are added on top of the built-in content.
        </div>

        {/* Section tabs */}
        <div className="grid grid-cols-4 gap-1.5 mb-4 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
          {SECTIONS.map(s => {
            const on = active === s.type;
            const Icon = s.icon;
            return (
              <button key={s.type} onClick={() => setActive(s.type)}
                      className="no-tap-highlight py-2 rounded-lg text-[11px] font-semibold flex flex-col items-center gap-1 transition"
                      style={{ background: on ? T.surface : 'transparent', color: on ? T.primary : T.muted,
                               boxShadow: on ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
                <Icon size={15} />
                {s.title.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Current pack summary */}
        <Card className="p-3.5 mb-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>{section.title} pack</div>
              <div className="font-display text-2xl font-semibold" style={{ color: currentItems.length ? T.ink : T.muted }}>
                {loading ? <Loader2 size={20} className="animate-spin" /> : currentItems.length}
                {!loading && <span className="text-sm font-normal ml-1.5" style={{ color: T.muted }}>{currentItems.length === 1 ? section.noun : section.plural}</span>}
              </div>
            </div>
            {pack && pack.updatedAt ? (
              <div className="text-[11px] text-right" style={{ color: T.muted }}>
                updated<br />{new Date(pack.updatedAt).toLocaleDateString()}
              </div>
            ) : null}
          </div>
        </Card>

        {msg && (
          <div className="text-[12.5px] rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
               style={{ background: T.successSoft, border: `1px solid ${T.success}44`, color: T.success }}>
            <Check size={14} /> {msg}
          </div>
        )}

        {active === 'quotes' && <QuickQuoteForm T={T} onAdd={(obj) => setText(JSON.stringify([obj], null, 2))} />}
        {active === 'reference' && <QuickReferenceForm T={T} onAdd={(obj) => setText(JSON.stringify([obj], null, 2))} />}

        {/* Paste box */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
          Paste JSON ({section.plural})
        </div>
        <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null); }}
                  placeholder={`A JSON array of ${section.plural}. Tap "Format guide" for the shape.`}
                  rows={7} spellCheck={false}
                  className="w-full rounded-xl px-3.5 py-3 text-[12px] font-mono resize-y" style={inputStyle} />

        <button onClick={() => setShowGuide(g => !g)}
                className="no-tap-highlight text-[11.5px] font-medium mt-1.5 mb-2" style={{ color: T.primary }}>
          {showGuide ? 'Hide' : 'Show'} format guide
        </button>
        {showGuide && (
          <pre className="text-[11px] font-mono rounded-xl p-3 mb-3 overflow-x-auto whitespace-pre"
               style={{ background: T.surfaceWarm, color: T.inkSoft, border: `1px solid ${T.border}` }}>{GUIDE[active]}</pre>
        )}

        <div className="flex gap-2 mb-3">
          <Button onClick={parse} disabled={!text.trim()} variant="soft" className="flex-1">Check</Button>
        </div>

        {error && (
          <div className="text-[12.5px] rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2"
               style={{ background: T.errorSoft, border: `1px solid ${T.error}44`, color: T.error }}>
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Preview + validation report */}
        {preview && (
          <Card className="p-3.5 mb-3">
            {preview.parseError ? (
              <div className="text-[12.5px]" style={{ color: T.error }}>{preview.parseError}</div>
            ) : (
              <>
                <div className="text-[13px] font-semibold mb-1.5" style={{ color: preview.valid.length ? T.success : T.error }}>
                  {preview.valid.length} valid{preview.invalid.length ? ` · ${preview.invalid.length} rejected` : ''}
                </div>
                {preview.invalid.length > 0 && (
                  <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                    {preview.invalid.map(inv => (
                      <div key={inv.index} className="text-[11.5px]" style={{ color: T.error }}>
                        #{inv.index} "{inv.preview}": {inv.errors.join(', ')}
                      </div>
                    ))}
                  </div>
                )}
                {preview.valid.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => save('append')} disabled={saving} className="flex-1"
                            icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
                      Add {preview.valid.length}
                    </Button>
                    <Button onClick={() => save('replace')} disabled={saving} variant="ghost" className="flex-1">
                      Replace all
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* Current items preview */}
        {currentItems.length > 0 && (
          <details className="mt-1">
            <summary className="no-tap-highlight cursor-pointer text-xs uppercase tracking-wider font-semibold pb-2" style={{ color: T.muted }}>
              View current {section.plural} ({currentItems.length})
            </summary>
            <div className="space-y-1 mt-1 max-h-64 overflow-y-auto">
              {currentItems.slice(0, 200).map((it, i) => (
                <div key={i} className="text-[11.5px] px-2.5 py-1.5 rounded-lg truncate" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                  {itemLabel(active, it)}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function itemLabel(type, it) {
  if (!it) return '(empty)';
  if (type === 'quotes') return `"${String(it.text || '').slice(0, 70)}" — ${it.source || ''}`;
  if (type === 'reference') return `${it.label || ''}: ${it.value || ''}`;
  if (type === 'conceptCards') return `${it.topicId || '?'} / ${it.sub || ''} (${(it.cards || []).length} cards)`;
  return `${it.q || it.id || ''}`.slice(0, 80);
}

// Single-quote quick add (fills the paste box with a one-item array).
function QuickQuoteForm({ T, onAdd }) {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const s = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };
  return (
    <Card className="p-3.5 mb-3">
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Quick add one quote</div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Quote text (no long dashes)"
                rows={2} className="w-full rounded-xl px-3 py-2 text-sm mb-2 resize-none" style={s} />
      <input value={source} onChange={e => setSource(e.target.value)} placeholder="Source (author, book)"
             className="w-full rounded-xl px-3 py-2 text-sm mb-2" style={s} />
      <button onClick={() => text.trim() && source.trim() && onAdd({ text: text.trim(), source: source.trim() })}
              className="no-tap-highlight text-[12px] font-semibold" style={{ color: T.primary }}>
        Load into the box below
      </button>
    </Card>
  );
}

function QuickReferenceForm({ T, onAdd }) {
  const [f, setF] = useState({ cat: '', section: '', label: '', value: '', note: '' });
  const s = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  return (
    <Card className="p-3.5 mb-3">
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Quick add one value</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={f.cat} onChange={set('cat')} placeholder="cat (e.g. labs)" className="rounded-xl px-3 py-2 text-sm" style={s} />
        <input value={f.section} onChange={set('section')} placeholder="section" className="rounded-xl px-3 py-2 text-sm" style={s} />
      </div>
      <input value={f.label} onChange={set('label')} placeholder="label (e.g. Potassium)" className="w-full rounded-xl px-3 py-2 text-sm mb-2" style={s} />
      <input value={f.value} onChange={set('value')} placeholder="value (e.g. 3.5 to 5.0 mmol/L)" className="w-full rounded-xl px-3 py-2 text-sm mb-2" style={s} />
      <input value={f.note} onChange={set('note')} placeholder="note (optional)" className="w-full rounded-xl px-3 py-2 text-sm mb-2" style={s} />
      <button onClick={() => f.cat.trim() && f.label.trim() && f.value.trim() && onAdd({
                cat: f.cat.trim(), section: f.section.trim(), label: f.label.trim(), value: f.value.trim(),
                ...(f.note.trim() ? { note: f.note.trim() } : {}),
              })}
              className="no-tap-highlight text-[12px] font-semibold" style={{ color: T.primary }}>
        Load into the box below
      </button>
    </Card>
  );
}

export default AdminContentStudio;
