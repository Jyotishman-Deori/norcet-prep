// =====================================================================
// src/screens/drill-settings.jsx — Drill-Tests-specific settings.
// Lets the user turn the smart-coaching behaviours on/off. They're ON by
// default (so nothing changes for anyone who never visits here); a user who
// finds them intrusive can switch any off. Applies across all Drill-Tests
// sections. Reached from the gear on the Drill Tests screen.
// =====================================================================
import React from 'react';
import { HeartPulse, Activity, Ghost, Sparkles } from 'lucide-react';
import { useTheme, useData } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import { drillFeatureOn, setDrillFeature } from '../lib/drill-settings.js';

const FEATURES = [
  { key: 'vitalsCheck', label: 'Vitals Check', icon: HeartPulse, accent: '#DC2626',
    where: 'Quick · Topic · Mock',
    desc: 'Miss a must-know survival protocol and the test pauses briefly so you review why — the kind you can’t afford to get wrong on the floor.' },
  { key: 'codeBlue', label: 'Code Blue', icon: Activity, accent: '#1D4ED8',
    where: 'Quick · Topic · Mock',
    desc: 'Three wrong in a row switches to a short recovery drill of your own mistakes, then drops you back in. Reframes a slump as a comeback.' },
  { key: 'ghostShift', label: 'Ghost Shift', icon: Ghost, accent: '#16A34A',
    where: 'Advanced Test results',
    desc: 'After an Advanced Test, see how you did against your own self from about two weeks ago — your only opponent.' },
];

function Toggle({ on, accent }) {
  return (
    <div className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors"
         style={{ background: on ? accent : '#9CA3AF55' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
            style={{ left: on ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </div>
  );
}

function DrillSettings({ onBack }) {
  const { theme: T } = useTheme();
  const { data, setData } = useData();
  const prefs = (data && data.preferences) || {};

  const toggle = (key) => {
    const next = !drillFeatureOn(prefs, key);
    setData(prev => ({ ...prev, preferences: setDrillFeature(prev && prev.preferences, key, next) }));
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Drill Tests settings" onBack={onBack} feedback={{ screen: 'Drill Tests settings' }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-3">
        <Card className="p-3.5 mb-4" style={{ background: T.primary + '0C', border: `1px solid ${T.primary}26` }}>
          <div className="flex items-start gap-2.5">
            <Sparkles size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
            <div className="text-[12px] leading-relaxed" style={{ color: T.inkSoft }}>
              Smart-coaching touches for your tests. All on by default — switch off anything you’d rather not see.
              These apply across every Drill-Tests section.
            </div>
          </div>
        </Card>

        <div className="space-y-2.5">
          {FEATURES.map(f => {
            const on = drillFeatureOn(prefs, f.key);
            const Icon = f.icon;
            return (
              <Card key={f.key} className="p-4" style={on ? { borderColor: f.accent + '40' } : undefined}>
                <button onClick={() => toggle(f.key)} aria-pressed={on}
                        className="no-tap-highlight w-full flex items-start gap-3 text-left active:scale-[0.995] transition">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                       style={{ background: (on ? f.accent : T.muted) + '18', border: `1px solid ${(on ? f.accent : T.muted)}40` }}>
                    <Icon size={17} style={{ color: on ? f.accent : T.muted }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display text-[15px] font-semibold" style={{ color: T.ink }}>{f.label}</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: T.muted }}>{f.where}</div>
                    <div className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>{f.desc}</div>
                  </div>
                  <div className="pt-1"><Toggle on={on} accent={f.accent} /></div>
                </button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DrillSettings;
