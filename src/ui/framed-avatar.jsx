// =====================================================================
// src/ui/framed-avatar.jsx  (Level Up P3 — avatar with a cosmetic frame)
// A round avatar (initial) wrapped in the equipped cosmetic frame: a gradient
// ring + soft glow. `frame='none'` renders a plain circle (no ring). Pure
// presentational — pass the initial + colours in.
// =====================================================================
import React from 'react';
import { frameDef } from '../lib/cosmetics.js';

export default function FramedAvatar({ initial = '?', frame = 'none', size = 44, bg, fg, fontSize }) {
  const f = frameDef(frame);
  const ring = f.ring;
  const pad = ring ? Math.max(2, Math.round(size * 0.07)) : 0;
  const inner = size - pad * 2;
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                   padding: pad, flexShrink: 0,
                   background: ring ? `linear-gradient(135deg, ${ring[0]}, ${ring[1]})` : 'transparent',
                   boxShadow: f.glow ? `0 0 10px ${f.glow}` : 'none' }}>
      <span className="font-display font-bold" style={{ width: inner, height: inner, borderRadius: '50%', background: bg, color: fg,
                   display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fontSize || Math.round(inner * 0.42), lineHeight: 1 }}>
        {String(initial || '?').charAt(0).toUpperCase()}
      </span>
    </span>
  );
}
