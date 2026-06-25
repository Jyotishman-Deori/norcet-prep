// =====================================================================
// src/ui/ibq-diagram.jsx — generic renderer for a data-driven IBQ diagram.
// Draws any diagram's `art` primitives + tappable `hotspots` straight from
// JSON (so uploaded diagrams render with no code change). Premium motion:
// the artwork strokes itself in, the active candidate regions breathe, a
// correct tap pops a pin + label, a miss shakes then reveals. Reduced-motion
// safe. Theme colours come from T (success/error/primary).
// =====================================================================
import React, { useMemo } from 'react';

const prefersReducedMotion = () => {
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
};

const CSS = `
@keyframes ibq-draw { from { stroke-dashoffset: 1400; } to { stroke-dashoffset: 0; } }
@keyframes ibq-breathe { 0%,100% { opacity: .45; } 50% { opacity: .95; } }
@keyframes ibq-pop { from { transform: scale(.3); opacity: 0; } 60% { transform: scale(1.12); } to { transform: scale(1); opacity: 1; } }
@keyframes ibq-shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-3px)} 40%,80%{transform:translateX(3px)} }
.ibq-draw { stroke-dasharray: 1400; animation: ibq-draw 1.1s ease forwards; }
.ibq-breathe { animation: ibq-breathe 1.8s ease-in-out infinite; }
.ibq-pop { animation: ibq-pop .42s cubic-bezier(.34,1.56,.64,1) both; transform-box: fill-box; transform-origin: center; }
.ibq-shake { animation: ibq-shake .42s ease both; transform-box: fill-box; transform-origin: center; }
`;

export default function IbqDiagram({ diagram, found = [], picked = null, checked = false, answer = null, onPick, T, height = 280 }) {
  const noMotion = prefersReducedMotion();

  const artEls = useMemo(() => (diagram.art || []).map((a, i) => {
    const common = {
      fill: a.fill || 'none', stroke: a.stroke || 'none', strokeWidth: a.strokeWidth || 1,
      opacity: a.opacity != null ? a.opacity : 1, strokeLinejoin: 'round', strokeLinecap: 'round',
      style: { pointerEvents: 'none' },
    };
    if (a.dash) common.strokeDasharray = a.dash;
    const cls = a.draw && !noMotion ? 'ibq-draw' : undefined;
    switch (a.type) {
      case 'path':     return <path key={i} d={a.d} className={cls} {...common} />;
      case 'line':     return <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} {...common} />;
      case 'rect':     return <rect key={i} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} className={cls} {...common} />;
      case 'circle':   return <circle key={i} cx={a.cx} cy={a.cy} r={a.r} {...common} />;
      case 'ellipse':  return <ellipse key={i} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} {...common} />;
      case 'polyline': return <polyline key={i} points={a.points} {...common} />;
      case 'polygon':  return <polygon key={i} points={a.points} {...common} />;
      case 'text':     return <text key={i} x={a.x} y={a.y} fontSize={a.fontSize || 12} fill={a.fill || '#000'} textAnchor={a.anchor || 'middle'} style={{ pointerEvents: 'none' }}>{a.text}</text>;
      default:         return null;
    }
  }), [diagram, noMotion]);

  const center = (hs) => hs.shape === 'circle'
    ? { x: hs.cx, y: hs.cy }
    : hs.shape === 'rect' ? { x: hs.x + hs.w / 2, y: hs.y + hs.h / 2 }
    : { x: 0, y: 0 };

  const shapeProps = (hs) => {
    if (hs.shape === 'circle') return { el: 'circle', attrs: { cx: hs.cx, cy: hs.cy, r: hs.r } };
    if (hs.shape === 'rect') return { el: 'rect', attrs: { x: hs.x, y: hs.y, width: hs.w, height: hs.h, rx: hs.rx || 6 } };
    return { el: 'polygon', attrs: { points: hs.points } };
  };

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.borderSoft}` }}>
      <style>{CSS}</style>
      <svg viewBox={diagram.viewBox} width="100%" style={{ height, display: 'block' }}>
        <g>{artEls}</g>

        {(diagram.hotspots || []).map((hs) => {
          const { el, attrs } = shapeProps(hs);
          const isFound = found.includes(hs.id);
          const isAnswer = checked && hs.id === answer;
          const isWrong = checked && hs.id === picked && hs.id !== answer;
          const showAsHit = isFound || isAnswer;

          let fill = 'transparent', stroke = T.primary, sw = 1.5, dash = '5 4', cls = '';
          if (showAsHit) { fill = T.success + '2E'; stroke = T.success; sw = 2; dash = 'none'; }
          else if (isWrong) { fill = T.error + '2E'; stroke = T.error; sw = 2; dash = 'none'; cls = noMotion ? '' : 'ibq-shake'; }
          else if (!checked) { fill = T.primary + '12'; stroke = T.primary; cls = noMotion ? '' : 'ibq-breathe'; }
          else { fill = 'transparent'; stroke = T.borderSoft; }

          const c = center(hs);
          const Shape = el;
          return (
            <g key={hs.id}>
              <Shape {...attrs} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
                     className={cls} onClick={() => { if (!checked && onPick) onPick(hs.id); }}
                     style={{ cursor: checked ? 'default' : 'pointer' }} />
              {/* pin + label on a hit */}
              {showAsHit && (
                <g className={noMotion ? '' : 'ibq-pop'} style={{ pointerEvents: 'none' }}>
                  <circle cx={c.x} cy={c.y} r={9} fill={T.success} />
                  <path d={`M ${c.x - 4} ${c.y} l 2.6 2.8 l 5 -5.4`} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <text x={c.x} y={c.y + (hs.shape === 'circle' ? hs.r + 14 : (hs.h / 2) - 6)} fontSize={11} fontWeight={700}
                        textAnchor="middle" fill={T.success}
                        style={{ paintOrder: 'stroke', stroke: T.surface, strokeWidth: 3 }}>{hs.label}</text>
                </g>
              )}
              {isWrong && (
                <g style={{ pointerEvents: 'none' }}>
                  <circle cx={c.x} cy={c.y} r={9} fill={T.error} />
                  <path d={`M ${c.x - 3.5} ${c.y - 3.5} l 7 7 M ${c.x + 3.5} ${c.y - 3.5} l -7 7`} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
