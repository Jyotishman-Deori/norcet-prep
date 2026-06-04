// =====================================================================
// src/screens/my-reports.jsx — a user's own submitted feedback (A1 slice 27)
// Extracted from App.jsx. Body byte-identical; changes are the A7 hook lines
// (T -> useTheme; feedbackStatusMeta -> useStatusMeta, slice 25). Props stay
// { reports, loading, seenMap, onRefresh, onBack }. fmtWhen from lib/format.
// =====================================================================
import React, { useRef } from 'react';
import { AlertCircle, Hourglass, RefreshCw } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useStatusMeta } from '../lib/theme-helpers.js';
import { Card, Pill, TopBar } from '../ui/primitives.jsx';
import { fmtWhen } from '../lib/format.js';

function MyReports({ reports, loading, seenMap, onRefresh, onBack }) {
  const { theme: T } = useTheme();
  const feedbackStatusMeta = useStatusMeta();
  // Snapshot the "seen" map on entry so replies that are new on arrival stay
  // highlighted for this visit, even after the app marks them acknowledged.
  const seenSnapshot = useRef(seenMap || {});

  return (
    <div className="anim-fadeup">
      <TopBar title="My feedback" onBack={onBack}
              right={
                <button onClick={onRefresh} disabled={loading} aria-label="Refresh"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                  <RefreshCw size={18} style={{ color: T.muted }} className={loading ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
          Reports and suggestions you've sent, newest first, with any reply from the admin.
        </div>

        {loading && reports.length === 0 ? (
          <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : reports.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-0.5" style={{ color: T.ink }}>Nothing yet</div>
            <div className="text-sm" style={{ color: T.muted }}>
              Tap the report icon at the top of any screen to send a bug or idea.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map(r => {
              const meta = feedbackStatusMeta(r.status);
              const hasResponse = !!(r.reply || meta);
              const isNew = hasResponse && r.repliedAt && r.repliedAt > (seenSnapshot.current[r.id] || 0);
              const sent = new Date(r.ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
              return (
                <Card key={r.id} className="p-4"
                      style={isNew ? { border: `1.5px solid ${T.primary}66` } : {}}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill bg={T.primary + '18'} color={T.primary}>{r.screen}</Pill>
                      {r.questionId && <Pill bg={T.surfaceWarm} color={T.inkSoft}>Q: {r.questionId}</Pill>}
                    </div>
                    {isNew && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                            style={{ background: T.primary, color: '#FFF' }}>New</span>
                    )}
                  </div>

                  <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: T.ink }}>{r.report}</div>
                  {r.fix && (
                    <div className="text-xs whitespace-pre-wrap leading-relaxed mt-1.5" style={{ color: T.muted }}>
                      <span className="font-semibold">Your suggested fix: </span>{r.fix}
                    </div>
                  )}
                  <div className="text-[10px] mt-2" style={{ color: T.muted }}>Sent {sent}</div>

                  {/* Admin response */}
                  {hasResponse ? (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: T.borderSoft }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Admin response</span>
                        {meta && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: meta.color, color: '#FFF' }}>{meta.label}</span>
                        )}
                      </div>
                      {r.reply && (
                        <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: T.inkSoft }}>{r.reply}</div>
                      )}
                      {r.repliedAt && (
                        <div className="text-[10px] mt-1.5" style={{ color: T.muted }}>Replied {fmtWhen(r.repliedAt)}</div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 border-t flex items-center gap-1.5" style={{ borderColor: T.borderSoft }}>
                      <Hourglass size={12} style={{ color: T.muted }} />
                      <span className="text-xs" style={{ color: T.muted }}>Awaiting a reply</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MyReports;
