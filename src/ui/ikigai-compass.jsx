// =====================================================================
// src/ui/ikigai-compass.jsx — PHIL-01 the 4-circle living Venn.
// Custom SVG (no chart library). Each dimension is a circle that DRIFTS toward
// the shared centre and GROWS as its 0..1 score rises; when all four converge,
// the centre glows gold ("Ikigai Master"). On open, the circles animate from a
// small/separated/dim baseline to their computed state, so you literally watch
// your readiness take shape. Reduced-motion safe.
// =====================================================================
import React, { useEffect, useState, useRef } from 'react';
import { IKIGAI_DIMENSIONS } from '../lib/ikigai.js';

// Diagonal corners: passion TL, profession TR, mission BR, vocation BL.
const DIRS = {
  passion:    [-0.707, -0.707],
  profession: [ 0.707, -0.707],
  mission:    [ 0.707,  0.707],
  vocation:   [-0.707,  0.707],
};
const C = 130;            // canvas centre
const FAR = 74, NEAR = 30;
const reduce = () => { try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

export default function IkigaiCompass({ scores, master = false, isDark = false, size = 260 }) {
  const [mounted, setMounted] = useState(false);
  const rm = useRef(reduce());
  useEffect(() => {
    if (rm.current) { setMounted(true); return undefined; }
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const minScore = Math.min(...IKIGAI_DIMENSIONS.map(d => scores[d.key] || 0));
  const centerGlow = Math.max(0, Math.min(1, minScore * 1.15));
  const blend = isDark ? 'screen' : 'multiply';

  const geomFor = (key) => {
    const s = mounted ? Math.max(0, Math.min(1, scores[key] || 0)) : 0;
    const offset = FAR - (FAR - NEAR) * s;
    const r = 28 + s * 36;
    const [dx, dy] = DIRS[key];
    return { cx: C + dx * offset, cy: C + dy * offset, r, op: 0.22 + s * 0.34 };
  };

  const trans = rm.current ? 'none' : 'cx 1.1s cubic-bezier(.2,.8,.2,1), cy 1.1s cubic-bezier(.2,.8,.2,1), r 1.1s cubic-bezier(.2,.8,.2,1), fill-opacity 1.1s ease';

  return (
    <svg viewBox="0 0 260 260" width={size} height={size} className="mx-auto block" style={{ maxWidth: '100%' }}>
      <defs>
        <radialGradient id="ik-gold" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FCD34D" stopOpacity={master ? 0.95 : 0.8} />
          <stop offset="55%" stopColor="#F59E0B" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
        <filter id="ik-soft"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>

      {/* centre glow — only visible once the circles converge */}
      <circle cx={C} cy={C} r={mounted ? 34 + centerGlow * 26 : 20} fill="url(#ik-gold)"
              style={{ opacity: mounted ? centerGlow : 0, transition: trans === 'none' ? 'none' : 'opacity 1.2s ease, r 1.2s ease' }}>
        {master && !rm.current && (
          <animate attributeName="opacity" values="0.7;1;0.7" dur="2.4s" repeatCount="indefinite" />
        )}
      </circle>

      {/* the four dimension circles */}
      <g style={{ mixBlendMode: blend }}>
        {IKIGAI_DIMENSIONS.map((d) => {
          const g = geomFor(d.key);
          return (
            <circle key={d.key} cx={g.cx} cy={g.cy} r={g.r}
                    fill={d.color} fillOpacity={g.op}
                    stroke={d.color} strokeOpacity={Math.min(0.6, g.op + 0.15)} strokeWidth="1.5"
                    style={{ transition: trans }} />
          );
        })}
      </g>

      {/* master star at the centre */}
      {master && (
        <text x={C} y={C + 5} textAnchor="middle" fontSize="22" style={{ filter: 'url(#ik-soft)' }}>⭐</text>
      )}
    </svg>
  );
}
