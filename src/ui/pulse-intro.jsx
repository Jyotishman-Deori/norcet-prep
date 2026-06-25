// =====================================================================
// src/ui/pulse-intro.jsx — NEW-03 "The Pulse" one-time entry note.
// Shown the first time a user switches the Pace to The Pulse. Mirrors the
// Flashpoint warning so the enforced countdown is never a surprise. A Portal
// so it sits above the setup UI.
// =====================================================================
import React from 'react';
import { createPortal } from 'react-dom';
import { HeartPulse, Clock, Lock } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

const GREEN = '#16A34A';

export default function PulseIntro({ open, onClose }) {
  const { theme: T } = useTheme();
  if (!open || typeof document === 'undefined') return null;

  const Row = ({ icon: Icon, title, body }) => (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
           style={{ background: GREEN + '1A', border: `1px solid ${GREEN}40` }}>
        <Icon size={15} style={{ color: GREEN }} />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold" style={{ color: T.ink }}>{title}</div>
        <div className="text-[12px] leading-snug" style={{ color: T.muted }}>{body}</div>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center px-4"
         style={{ zIndex: 2147483200, background: 'rgba(8,10,14,0.74)', backdropFilter: 'blur(4px)' }}
         role="alertdialog" aria-modal="true" aria-label="The Pulse">
      <div className="anim-fadeup w-full max-w-sm rounded-3xl overflow-hidden"
           style={{ background: T.bg, border: `1px solid ${GREEN}55`, boxShadow: '0 24px 70px rgba(0,0,0,0.5)' }}>
        <div className="px-5 pt-6 pb-4 text-center" style={{ background: `linear-gradient(180deg, ${GREEN}1F, transparent)` }}>
          <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
               style={{ background: GREEN + '22', border: `1px solid ${GREEN}66` }}>
            <HeartPulse size={26} style={{ color: GREEN }} />
          </div>
          <div className="font-display text-xl font-bold" style={{ color: T.ink }}>The Pulse</div>
          <div className="text-[13px] mt-1" style={{ color: T.muted }}>Beat the clock on every question.</div>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <Row icon={Clock} title="A live countdown on each question"
               body="A colour-grading bar drains as you think — tuned per subject so it mirrors real exam pace (harder questions get more)." />
          <Row icon={Lock} title="Run out of time? It locks"
               body="When the bar empties, the question auto-submits. It trains you to commit on instinct instead of dawdling — no points lost beyond the question itself." />
        </div>
        <div className="px-5 pb-5 pt-1">
          <button onClick={onClose}
                  className="no-tap-highlight w-full py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.99]"
                  style={{ background: GREEN, color: '#FFF', boxShadow: `0 12px 28px ${GREEN}55` }}>
            Got it — let's go
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
