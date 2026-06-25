// =====================================================================
// src/ui/ecg-monitor.jsx — the animated bedside-monitor display.
// Renders a rhythm's procedural SVG path as a scrolling "phosphor" trace on
// a dark graticule, mimicking a real ICU monitor. Two seamless copies of the
// strip translate left in a loop (GPU transform, no JS per-frame). Honours
// prefers-reduced-motion (static trace, no scroll). Pure CSS + SVG — no asset.
// =====================================================================
import React, { useMemo } from 'react';
import { buildEcgPath } from '../data/ecg-rhythms.js';

const STRIP = 1000;   // strip width in user units
const H = 150;        // strip height
const BL = 88;        // ECG baseline (R wave spikes up toward y=0)

const prefersReducedMotion = () => {
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
};

export default function EcgMonitor({ rhythm, running = true, speedSec = 4, height = 150 }) {
  const d = useMemo(() => buildEcgPath(rhythm, STRIP, BL), [rhythm && rhythm.id]);
  const noMotion = prefersReducedMotion();
  const trace = (rhythm && rhythm.trace) || '#46F08A';
  const animate = running && !noMotion;

  const css = '@keyframes ecg-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}';

  return (
    <div className="relative rounded-2xl overflow-hidden"
         style={{ background: '#06100E', border: '1px solid #0F2A24', boxShadow: 'inset 0 0 44px rgba(0,0,0,0.65)' }}>
      <style>{css}</style>

      {/* fine + bold graticule (fixed graticule, like a real monitor face) */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `repeating-linear-gradient(0deg, ${trace}12 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, ${trace}12 0 1px, transparent 1px 18px)`,
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `repeating-linear-gradient(0deg, ${trace}22 0 1px, transparent 1px 90px), repeating-linear-gradient(90deg, ${trace}22 0 1px, transparent 1px 90px)`,
      }} />

      {/* the scrolling trace — two tiling copies */}
      <div style={{ height, overflow: 'hidden' }}>
        <div style={{ display: 'flex', width: '200%', height: '100%',
                      animation: animate ? `ecg-scroll ${speedSec}s linear infinite` : 'none' }}>
          {[0, 1].map((i) => (
            <svg key={i} viewBox={`0 0 ${STRIP} ${H}`} preserveAspectRatio="none"
                 style={{ flex: '0 0 50%', height: '100%', display: 'block', filter: `drop-shadow(0 0 4px ${trace}cc)` }}>
              <path d={d} fill="none" stroke={trace} strokeWidth="2.4" strokeLinejoin="round"
                    strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
          ))}
        </div>
      </div>

      {/* left depth fade (trace dims as it ages off-screen) */}
      <div className="absolute inset-y-0 left-0 w-14 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, #06100E, transparent)' }} />
    </div>
  );
}
