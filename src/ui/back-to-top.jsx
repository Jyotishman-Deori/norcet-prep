// =====================================================================
// src/ui/back-to-top.jsx — premium floating "back to top" FAB.
// Appears once the user is a little way down a long list (Revision / Crib
// Sheet), slides + fades in, and smooth-scrolls to the top. Window-level
// scroll (the app scrolls the window, not an inner container). Hidden in print.
// =====================================================================
import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';

export default function BackToTop({ threshold = 420, label = 'Top' }) {
  const { theme: T } = useTheme();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow((window.scrollY || 0) > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [threshold]);
  const toTop = () => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { window.scrollTo(0, 0); }
  };
  if (!show) return null;
  return (
    <button onClick={toTop} aria-label="Back to top"
            className="no-print fixed z-40 inline-flex items-center gap-1.5 rounded-full pl-3 pr-3.5 py-2.5 anim-fadeup active:scale-95 transition-transform"
            style={{
              right: 'calc(16px + env(safe-area-inset-right, 0px))',
              /* --bnav-h is published by the bottom nav bar while it's mounted,
                 so the FAB rides above it instead of colliding (0 elsewhere). */
              bottom: 'calc(20px + env(safe-area-inset-bottom, 0px) + var(--bnav-h, 0px))',
              background: T.primary, color: '#FFF',
              boxShadow: `0 8px 24px ${T.primary}66`,
            }}>
      <ArrowUp size={16} />
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
