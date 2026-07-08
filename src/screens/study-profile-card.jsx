// =====================================================================
// src/screens/study-profile-card.jsx  (NEW-02 — Study profile editor)
// A quiet, collapsible card in Settings → Profile. Mirrors the optional
// Recovery-email pattern: whatever the user skipped during onboarding can be
// set or changed here any time. All three fields are optional.
//   • Gender        → simulated leaderboard calibration (AIIMS 80:20 quota)
//   • Qualification → bedside-to-theory framing for GNM
//   • Employment    → pacing (mock length, audio/micro-drill emphasis)
// Saves go to the synced profile blob via onSave({ field: value }).
// =====================================================================
import React, { useState, useEffect } from 'react';
import { UserCircle2, ChevronRight, Check, Heart, Lightbulb } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card } from '../ui/primitives.jsx';
import {
  GENDER_OPTIONS, QUALIFICATION_OPTIONS, EMPLOYMENT_OPTIONS,
  normalizeDemographics, demographicsFilled, sanitizeIkigai, IKIGAI_MAX,
} from '../lib/demographics.js';

// One labelled segmented pill group.
function PillGroup({ T, label, hint, options, value, onPick }) {
  return (
    <div className="mb-3.5">
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {options.map(o => {
          const active = value === o.id;
          return (
            <button key={o.id} onClick={() => onPick(active ? null : o.id)}
                    className="no-tap-highlight rounded-xl px-2 py-2.5 text-center transition-all active:scale-95"
                    style={{ background: active ? T.primary : T.surface,
                             color: active ? '#FFF' : T.inkSoft,
                             border: `1.5px solid ${active ? T.primary : T.border}`,
                             boxShadow: active ? `0 2px 10px ${T.primary}33` : 'none' }}>
              <div className="text-[12px] font-semibold leading-tight">{o.label}</div>
              {o.sub && <div className="text-[9px] mt-0.5" style={{ color: active ? 'rgba(255,255,255,0.8)' : T.muted }}>{o.sub}</div>}
            </button>
          );
        })}
      </div>
      {hint && <div className="text-[10px] mt-1.5 leading-relaxed" style={{ color: T.muted }}>{hint}</div>}
    </div>
  );
}

export default function StudyProfileCard({ demographics, onSave }) {
  const { theme: T } = useTheme();
  const d = normalizeDemographics(demographics);
  const [open, setOpen] = useState(false);
  const filled = demographicsFilled(demographics);
  // PHIL-08 — editable-later Ikigai. Local while typing; saved (sanitised) on blur.
  const [ikigai, setIkigai] = useState(d.ikigai || '');
  // Never make the user guess whether it saved — flash an explicit "Saved ✓".
  const [ikigaiSaved, setIkigaiSaved] = useState(false);
  const saveIkigai = () => {
    const clean = sanitizeIkigai(ikigai);
    if (onSave && clean !== (d.ikigai || '')) { onSave({ ikigai: clean }); setIkigaiSaved(true); }
  };
  useEffect(() => {
    if (!ikigaiSaved) return undefined;
    const t = setTimeout(() => setIkigaiSaved(false), 2400);
    return () => clearTimeout(t);
  }, [ikigaiSaved]);

  const pick = (field, value) => { if (onSave) onSave({ [field]: value }); };

  return (
    <Card className="mb-3 p-0 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
              className="no-tap-highlight w-full flex items-center gap-3 p-4 text-left active:bg-black/5 transition-colors">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.accent + '15' }}>
          <UserCircle2 size={17} style={{ color: T.accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm" style={{ color: T.ink }}>Study profile <span style={{ color: T.muted, fontWeight: 400 }}>· optional</span></div>
          <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>Tunes your leaderboard pool &amp; pacing</div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mr-1 flex-shrink-0"
              style={filled > 0 ? { background: T.successSoft, color: T.success } : { background: T.surfaceWarm, color: T.muted }}>
          {filled > 0 ? `${filled}/3 set` : 'Not set'}
        </span>
        <ChevronRight size={16} className="flex-shrink-0"
                      style={{ color: T.muted, transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)', transform: open ? 'rotate(90deg)' : 'none' }} />
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="px-4 pb-4">
            <div className="text-[11px] leading-relaxed mb-3" style={{ color: T.muted }}>
              All optional and private, used only to personalise your simulated rank and study pacing, never to gate content or shared with advertisers. Tap a choice again to clear it.
            </div>
            <PillGroup T={T} label="Gender" options={GENDER_OPTIONS} value={d.gender}
                       hint="Calibrates your simulated leaderboard rank for the AIIMS 80:20 pool."
                       onPick={(v) => pick('gender', v)} />
            <PillGroup T={T} label="Qualification" options={QUALIFICATION_OPTIONS} value={d.qualification}
                       hint="GNM unlocks bedside-to-theory framing."
                       onPick={(v) => pick('qualification', v)} />
            <PillGroup T={T} label="Schedule" options={EMPLOYMENT_OPTIONS} value={d.employment}
                       hint="Shapes mock length and audio / micro-drill emphasis."
                       onPick={(v) => pick('employment', v)} />

            {/* PHIL-08 — your private "why" (Ikigai), editable any time. */}
            <div className="mb-3.5">
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: T.muted }}>
                <Heart size={11} style={{ color: '#E0245E' }} /> Your Ikigai
                <span className="normal-case font-normal tracking-normal" style={{ color: T.muted }}>· your reason why</span>
                {/* explicit save confirmation — never let the user guess */}
                {ikigaiSaved && (
                  <span className="anim-fadeup ml-auto inline-flex items-center gap-1 normal-case tracking-normal font-semibold" style={{ color: T.success }}>
                    <Check size={11} /> Saved
                  </span>
                )}
              </div>
              <textarea value={ikigai} onChange={e => setIkigai(e.target.value.slice(0, IKIGAI_MAX))} onBlur={saveIkigai}
                        rows={3} maxLength={IKIGAI_MAX}
                        placeholder="Why do you want to be a Nursing Officer? (private)"
                        className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                        style={{ background: T.surface, border: `1.5px solid ${ikigaiSaved ? T.success : T.border}`, color: T.ink, transition: 'border-color 0.3s' }} />
              <div className="flex items-center justify-between mt-1">
                <div className="text-[10px] flex items-center gap-1" style={{ color: T.muted }}>
                  <Lightbulb size={11} /> Private, only you ever see this. Saves when you tap away.
                </div>
                <div className="text-[10px]" style={{ color: ikigai.length >= IKIGAI_MAX ? T.error : T.muted }}>{ikigai.length}/{IKIGAI_MAX}</div>
              </div>
            </div>

            {filled === 3 && (
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mt-1" style={{ background: T.successSoft, border: `1px solid ${T.success}33` }}>
                <Check size={14} style={{ color: T.success }} />
                <div className="text-[12px]" style={{ color: T.success }}>Study profile complete. Your dashboard is tuned to you.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
