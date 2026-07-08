// =====================================================================
// src/ui/flashpoint-intro.jsx — NEW-03 / Flashpoint one-time entry warning.
// Shown the first time a user switches the Pace to Flashpoint. A Portal so it
// sits above the setup UI. "Get your fingers ready."
// =====================================================================
import React from 'react';
import { createPortal } from 'react-dom';
import { Zap, Clock, Trophy } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

const AMBER = '#F59E0B';

export default function FlashpointIntro({ open, onClose }) {
  const { theme: T } = useTheme();
  if (!open || typeof document === 'undefined') return null;

  const Row = ({ icon: Icon, title, body }) => (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
           style={{ background: AMBER + '1A', border: `1px solid ${AMBER}40` }}>
        <Icon size={15} style={{ color: AMBER }} />
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
         role="alertdialog" aria-modal="true" aria-label="Flashpoint mode">
      <div className="anim-fadeup w-full max-w-sm rounded-3xl overflow-hidden"
           style={{ background: T.bg, border: `1px solid ${AMBER}55`, boxShadow: '0 24px 70px rgba(0,0,0,0.5)' }}>
        <div className="px-5 pt-6 pb-4 text-center" style={{ background: `linear-gradient(180deg, ${AMBER}1F, transparent)` }}>
          <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
               style={{ background: AMBER + '22', border: `1px solid ${AMBER}66` }}>
            <Zap size={26} style={{ color: AMBER }} fill={AMBER} />
          </div>
          <div className="font-display text-xl font-bold" style={{ color: T.ink }}>Flashpoint Mode</div>
          <div className="text-[13px] mt-1" style={{ color: T.muted }}>Get your fingers ready.</div>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <Row icon={Clock} title="Timers are cut in half"
               body="Every question's clock is halved. And it counts. Run out and the question locks." />
          <Row icon={Trophy} title="Points are doubled"
               body="Each correct answer scores 2× into a separate Flashpoint leaderboard." />
        </div>
        <div className="px-5 pb-5 pt-1">
          <button onClick={onClose}
                  className="no-tap-highlight w-full py-3.5 rounded-2xl text-sm font-semibold active:scale-[0.99]"
                  style={{ background: AMBER, color: '#FFF', boxShadow: `0 12px 28px ${AMBER}55` }}>
            I'm ready
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
