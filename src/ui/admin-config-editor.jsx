// =====================================================================
// src/ui/admin-config-editor.jsx  (admin → Live config)
// Edit the single `game_config` row — XP curve, daily cap, premium prices,
// frame prices, crate rewards, quest rewards — WITHOUT a redeploy. Reads the
// live row, lets the admin tune it, validates/clamps (lib/game-config-edit.js),
// writes back through the broker. Changes take effect on each player's next
// app boot. Premium form with animated micro-interactions.
// =====================================================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Save, RotateCcw, Check, Loader2, ChevronDown, SlidersHorizontal,
  Gauge, Crown, Sparkles, Gift, Target, Minus, Plus, AlertTriangle, Shield, Ticket,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from './primitives.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { DEFAULTS, applyRemoteConfig } from '../lib/game-config.js';
import {
  SECTIONS, sanitizeConfig, validateConfig, xpForLevel, changedFields,
  getAtPath, setAtPath,
} from '../lib/game-config-edit.js';
import { logAdminAction } from '../lib/admin-audit.js';

const ICONS = { Gauge, Crown, Sparkles, Gift, Target, Shield, Ticket };
const clone = (o) => JSON.parse(JSON.stringify(o));

export default function AdminConfigEditor({ onBack, actorName }) {
  const { theme: T } = useTheme();
  const [baseline, setBaseline] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);
  const [showAdv, setShowAdv] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const savedTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let base;
      try {
        const r = await safeStorage.get('game_config', true);
        const parsed = r && r.value != null ? (typeof r.value === 'string' ? JSON.parse(r.value) : r.value) : null;
        base = clone(applyRemoteConfig(parsed)); // DEFAULTS deep-merged with the live row
      } catch (e) { base = clone(DEFAULTS); }
      if (!alive) return;
      setBaseline(base); setCfg(clone(base)); setStatus('ready');
    })();
    return () => { alive = false; if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, []);

  const changed = useMemo(() => (baseline && cfg ? changedFields(baseline, cfg) : []), [baseline, cfg]);
  const errors = useMemo(() => (cfg ? validateConfig(cfg) : []), [cfg]);
  const dirty = changed.length > 0;

  const setField = (path, value) => { setSaved(false); setErr(null); setCfg(prev => setAtPath(prev, path, value)); };

  const save = async () => {
    if (busy || !dirty) return;
    const errs = validateConfig(cfg);
    if (errs.length) { setErr(errs[0]); return; }
    setBusy(true); setErr(null);
    try {
      const clean = sanitizeConfig(cfg);
      await safeStorage.setSharedStrict('game_config', JSON.stringify(clean));
      logAdminAction({ action: 'config.save', detail: { changed: changed.slice() }, actorName });
      applyRemoteConfig(clean);
      setBaseline(clone(clean)); setCfg(clone(clean));
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2600);
    } catch (e) {
      const m = String((e && e.message) || e);
      setErr(/403/.test(m) ? 'Not authorised (admin only).' : /401/.test(m) ? 'Session expired — sign in again.' : 'Could not save — check your connection.');
    } finally { setBusy(false); }
  };

  const reset = async () => {
    setBusy(true); setErr(null);
    try {
      await safeStorage.delSharedStrict('game_config');
      logAdminAction({ action: 'config.reset', actorName });
      const base = clone(DEFAULTS); applyRemoteConfig(null);
      setBaseline(base); setCfg(clone(base)); setConfirmReset(false); setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2600);
    } catch (e) { setErr('Could not reset — check your connection.'); }
    finally { setBusy(false); }
  };

  if (status === 'loading' || !cfg) {
    return (
      <div className="anim-fadeup">
        <TopBar title="Live config" onBack={onBack} />
        <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 pt-10 flex justify-center">
          <Loader2 size={22} className="animate-spin" style={{ color: T.muted }} />
        </div>
      </div>
    );
  }

  const xpPreview = [5, 15, 30].map(l => ({ l, xp: xpForLevel(cfg, l) }));

  return (
    <div className="anim-fadeup">
      <TopBar title="Live config" onBack={onBack} />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 pb-32 pt-2 space-y-3">
        <Card className="p-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '18' }}>
              <SlidersHorizontal size={18} style={{ color: T.primary }} />
            </div>
            <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>
              Tune the game economy live — no redeploy. Changes reach players on their next app open.
            </div>
          </div>
        </Card>

        {SECTIONS.map((section, si) => {
          const Icon = ICONS[section.icon] || Gauge;
          const visibleFields = section.fields.filter(f => !f.advanced || showAdv);
          const secChanged = section.fields.some(f => changed.includes(f.path));
          return (
            <Card key={section.id} className="p-4 anim-fadeup" style={{ animationDelay: `${40 + si * 45}ms` }}>
              <div className="flex items-center gap-2.5 mb-3">
                <Icon size={17} style={{ color: T.primary }} />
                <div className="flex-1">
                  <div className="font-display text-[15px] font-bold leading-tight" style={{ color: T.ink }}>{section.title}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{section.blurb}</div>
                </div>
                {secChanged && <span className="w-2 h-2 rounded-full" style={{ background: T.accent }} title="Edited" />}
              </div>

              <div className="space-y-3">
                {visibleFields.map(f => (
                  <FieldRow key={f.path} f={f} value={getAtPath(cfg, f.path)}
                            edited={changed.includes(f.path)} onChange={(v) => setField(f.path, v)} T={T} />
                ))}
              </div>

              {section.id === 'xp' && (
                <div className="mt-3 pt-3 flex items-center gap-3 flex-wrap" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                  <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Preview</span>
                  {xpPreview.map(p => (
                    <span key={p.l} className="text-[12px]" style={{ color: T.inkSoft }}>
                      Lv {p.l} <b style={{ color: T.ink }}>{p.xp.toLocaleString()} XP</b>
                    </span>
                  ))}
                </div>
              )}

              {section.id === 'xp' && section.fields.some(f => f.advanced) && (
                <button onClick={() => setShowAdv(s => !s)}
                        className="no-tap-highlight mt-3 inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: T.primary }}>
                  <ChevronDown size={14} style={{ transform: showAdv ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                  {showAdv ? 'Hide advanced' : 'Advanced curve'}
                </button>
              )}
            </Card>
          );
        })}

        {/* reqScale test-value nudge */}
        {getAtPath(cfg, 'xp.reqScale') < 1 && (
          <div className="text-xs rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: T.accent + '14', border: `1px solid ${T.accent}40`, color: T.inkSoft }}>
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.accent }} />
            <span>Level pace is below 1 (faster than normal) — the test setting. Set it to <b>1</b> before real launch.</span>
          </div>
        )}
      </div>

      {/* sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-20"
           style={{ background: T.bg + 'F2', borderTop: `1px solid ${T.border}`, backdropFilter: 'blur(8px)',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center gap-2.5">
          {confirmReset ? (
            <>
              <span className="text-[12px] flex-1" style={{ color: T.ink }}>Reset everything to defaults?</span>
              <button onClick={reset} disabled={busy} className="no-tap-highlight px-3 py-2 rounded-xl text-[12px] font-bold" style={{ background: T.error, color: '#FFF' }}>Reset</button>
              <button onClick={() => setConfirmReset(false)} className="no-tap-highlight px-3 py-2 rounded-xl text-[12px] font-semibold" style={{ background: T.surfaceWarm, color: T.muted }}>Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmReset(true)} disabled={busy}
                      className="no-tap-highlight w-11 h-11 rounded-xl flex items-center justify-center active:scale-90 transition disabled:opacity-40"
                      style={{ background: T.surfaceWarm, color: T.muted }} aria-label="Reset to defaults" title="Reset to defaults">
                <RotateCcw size={17} />
              </button>
              <div className="flex-1 min-w-0">
                {err ? <span className="text-[12px] font-medium" style={{ color: T.error }}>{err}</span>
                     : saved ? <span className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: T.success }}><Check size={14} /> Saved — live on next open</span>
                     : <span className="text-[12px]" style={{ color: T.muted }}>{dirty ? `${changed.length} unsaved change${changed.length === 1 ? '' : 's'}` : 'All changes saved'}</span>}
              </div>
              <Button onClick={save} disabled={!dirty || busy || errors.length > 0}
                      icon={busy ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- one field row, dispatched by type ----
function FieldRow({ f, value, edited, onChange, T }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label className="text-[13px] font-medium inline-flex items-center gap-1.5" style={{ color: T.ink }}>
          {f.label}
          {edited && <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.accent }} />}
        </label>
        {(f.type === 'slider') && <span className="text-[13px] font-bold tabular-nums" style={{ color: T.primary }}>{Number(value).toFixed(2)}</span>}
      </div>

      {f.type === 'toggle' ? (
        <ToggleRow value={!!value} onChange={onChange} help={f.help} T={T} />
      ) : f.type === 'slider' ? (
        <>
          <input type="range" min={f.min} max={f.max} step={f.step} value={value}
                 onChange={(e) => onChange(Number(e.target.value))}
                 className="w-full" style={{ accentColor: T.primary, height: 24 }} />
          {f.help && <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{f.help}</div>}
        </>
      ) : (
        <>
          <Stepper value={Number(value)} min={f.min} max={f.max} step={f.step}
                   prefix={f.prefix} suffix={f.suffix} onChange={onChange} T={T} />
          {f.help && <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>{f.help}</div>}
        </>
      )}
    </div>
  );
}

function ToggleRow({ value, onChange, help, T }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] flex-1" style={{ color: T.muted }}>{help}</span>
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
              className="no-tap-highlight flex-shrink-0 rounded-full transition-colors active:scale-95"
              style={{ width: 46, height: 27, padding: 3, background: value ? T.primary : T.border }}>
        <span className="block rounded-full bg-white shadow"
              style={{ width: 21, height: 21, transform: value ? 'translateX(19px)' : 'translateX(0)', transition: 'transform .22s cubic-bezier(.34,1.56,.64,1)' }} />
      </button>
    </div>
  );
}

function Stepper({ value, min, max, step, prefix, suffix, onChange, T }) {
  const clamp = (n) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
  const bump = (d) => onChange(clamp(Math.round((Number(value) + d * (step || 1)) * 100) / 100));
  const btn = { background: T.surfaceWarm, color: T.ink };
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => bump(-1)} className="no-tap-highlight w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition" style={btn} aria-label="Decrease">
        <Minus size={15} />
      </button>
      <div className="flex-1 flex items-center justify-center gap-1 h-9 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
        {prefix && <span className="text-[13px]" style={{ color: T.muted }}>{prefix}</span>}
        <input type="number" value={value} min={min} max={max} step={step}
               onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(clamp(n)); }}
               className="w-full text-center text-[14px] font-bold tabular-nums bg-transparent outline-none" style={{ color: T.ink }} />
        {suffix && <span className="text-[11px]" style={{ color: T.muted }}>{suffix}</span>}
      </div>
      <button type="button" onClick={() => bump(1)} className="no-tap-highlight w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition" style={btn} aria-label="Increase">
        <Plus size={15} />
      </button>
    </div>
  );
}
