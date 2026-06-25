// =====================================================================
// src/ui/admin-empty.jsx — premium, self-explaining empty state for admin
// sections. An empty section reads as "broken" unless it tells the admin what
// it does, why it's empty, and that the pipe is live. `collecting` shows a
// reassuring "data appears automatically" pill for telemetry that just needs
// user activity (engagement, crashes, helpfulness, …).
// =====================================================================
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';

export default function AdminEmpty({ icon: Icon, accent, title, what, when, collecting = false, tone }) {
  const { theme: T } = useTheme();
  const a = accent || T.primary;
  return (
    <div className="anim-fadeup text-center px-5 py-12 max-w-sm mx-auto">
      {Icon && (
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
             style={{ background: a + '14', border: `1px solid ${a}33` }}>
          <Icon size={28} strokeWidth={1.7} style={{ color: a }} />
        </div>
      )}
      <div className="font-display text-lg font-semibold mb-1.5" style={{ color: tone || T.ink }}>{title}</div>
      {what && <div className="text-[13px] leading-relaxed" style={{ color: T.inkSoft }}>{what}</div>}
      {when && <div className="text-[12px] leading-relaxed mt-2" style={{ color: T.muted }}>{when}</div>}
      {collecting && (
        <div className="inline-flex items-center gap-1.5 mt-4 px-2.5 py-1 rounded-full text-[11px] font-semibold"
             style={{ background: T.success + '14', color: T.success }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.success }} />
          Live — results appear here automatically
        </div>
      )}
    </div>
  );
}
