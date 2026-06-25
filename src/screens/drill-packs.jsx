// =====================================================================
// src/screens/drill-packs.jsx — import / manage / author Drill Packs.
// Packs are portable JSON content for the interactive drills (IBQ, Crash Cart,
// Tie-Breaker, Sorter, ICU rhythms). Anyone can IMPORT a pack (paste JSON or
// pick a .json file) → it's validated and added to the synced profile, so its
// content shows up inside the matching drill. Authors can load a template,
// edit, validate live, then EXPORT a .json to share — "upload like question
// sets, download to practise". No server, no cost.
// =====================================================================
import React, { useState, useMemo, useRef } from 'react';
import { Package, Upload, Download, Check, X, Trash2, FileJson, Sparkles, AlertTriangle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from '../ui/primitives.jsx';
import { PACK_KINDS, validatePack, exportPackJson, sampleTemplate, normalizePacks } from '../lib/drill-packs.js';

function DrillPacks({ data, onBack, onInstall, onToggle, onRemove }) {
  const { theme: T } = useTheme();
  const [raw, setRaw] = useState('');
  const [justInstalled, setJustInstalled] = useState('');
  const fileRef = useRef(null);

  const installed = normalizePacks(data);
  const check = useMemo(() => (raw.trim() ? validatePack(raw) : null), [raw]);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setRaw(String(reader.result || '')); setJustInstalled(''); };
    reader.readAsText(f);
    e.target.value = '';
  };

  const install = () => {
    if (!check || !check.ok) return;
    onInstall(check.pack);
    setJustInstalled(`${check.pack.name} · ${check.count} item${check.count === 1 ? '' : 's'}`);
    setRaw('');
  };

  const download = (pack) => {
    try {
      const blob = new Blob([exportPackJson(pack)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${(pack.name || 'pack').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {}
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Drill Packs" onBack={onBack} feedback={{ screen: 'Drill Packs' }} solid />
      <div className="max-w-md mx-auto px-4 pt-2 pb-28">

        {/* intro */}
        <Card className="p-4 mb-4 flex items-start gap-3" style={{ background: T.surfaceWarm, border: `1px solid ${T.borderSoft}` }}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '18', color: T.primary }}>
            <Package size={18} />
          </span>
          <div className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>
            Packs add extra content to the interactive drills. <b style={{ color: T.ink }}>Import</b> a pack to play it; <b style={{ color: T.ink }}>export</b> one to share. Built-in content always stays.
          </div>
        </Card>

        {/* IMPORT / AUTHOR */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Import or paste a pack</div>
        <textarea value={raw} onChange={(e) => { setRaw(e.target.value); setJustInstalled(''); }}
                  placeholder='Paste pack JSON here, or use a template / file below…'
                  spellCheck={false}
                  className="w-full rounded-xl p-3 text-[12px] font-mono leading-relaxed mb-2 no-tap-highlight"
                  style={{ background: T.surface, border: `1.5px solid ${check && !check.ok ? T.error : check && check.ok ? T.success : T.border}`,
                           color: T.ink, minHeight: 132, resize: 'vertical', outline: 'none' }} />

        {/* live validation */}
        {check && (
          <div className="flex items-start gap-1.5 text-[12px] mb-2 px-1" style={{ color: check.ok ? T.success : T.error }}>
            {check.ok ? <Check size={14} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
            <span>{check.ok ? `Valid ${PACK_KINDS[check.pack.kind].label} pack · ${check.count} item${check.count === 1 ? '' : 's'}` : check.error}</span>
          </div>
        )}
        {justInstalled && (
          <div className="flex items-center gap-1.5 text-[12px] mb-2 px-1" style={{ color: T.success }}>
            <Check size={14} /> Installed {justInstalled}
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
          <Button variant="ghost" onClick={() => fileRef.current && fileRef.current.click()} icon={<FileJson size={15} />} className="flex-shrink-0">File…</Button>
          <Button onClick={install} disabled={!check || !check.ok} size="md" className="flex-1" icon={<Upload size={15} />}>Install pack</Button>
        </div>

        {/* template helpers */}
        <div className="text-[11px] mb-1.5 px-0.5 flex items-center gap-1.5" style={{ color: T.muted }}>
          <Sparkles size={12} /> Start a new pack from a template:
        </div>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {Object.entries(PACK_KINDS).map(([k, v]) => (
            <button key={k} onClick={() => { setRaw(sampleTemplate(k)); setJustInstalled(''); }}
                    className="no-tap-highlight text-[11px] font-semibold px-2.5 py-1.5 rounded-lg active:scale-95 transition"
                    style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* INSTALLED */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
          Installed packs {installed.length > 0 && `· ${installed.length}`}
        </div>
        {installed.length === 0 ? (
          <div className="text-[13px] italic px-1 py-4" style={{ color: T.muted }}>No packs yet. Import one above — the built-in drills work without any.</div>
        ) : (
          <div className="space-y-2">
            {installed.map((p) => {
              const on = p.enabled !== false;
              return (
                <Card key={p.id} className="p-3 flex items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[14px] font-semibold truncate" style={{ color: T.ink }}>{p.name}</div>
                    <div className="text-[11px]" style={{ color: T.muted }}>
                      {PACK_KINDS[p.kind] ? PACK_KINDS[p.kind].label : p.kind} · {p.items.length} item{p.items.length === 1 ? '' : 's'}{p.author ? ` · ${p.author}` : ''}
                    </div>
                  </div>
                  {/* enable toggle */}
                  <button onClick={() => onToggle(p.id, !on)} aria-label="Toggle pack"
                          className="no-tap-highlight relative w-10 h-6 rounded-full flex-shrink-0 transition-colors"
                          style={{ background: on ? T.success : T.border }}>
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
                  </button>
                  <button onClick={() => download(p)} aria-label="Export pack" className="no-tap-highlight p-1.5 rounded-lg active:bg-black/5" style={{ color: T.muted }}>
                    <Download size={16} />
                  </button>
                  <button onClick={() => onRemove(p.id)} aria-label="Remove pack" className="no-tap-highlight p-1.5 rounded-lg active:bg-black/5" style={{ color: T.error }}>
                    <Trash2 size={16} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default DrillPacks;
