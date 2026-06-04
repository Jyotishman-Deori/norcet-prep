// =====================================================================
// FEEDBACK INBOX SCREEN  (extracted verbatim from App.jsx)
// Admin view of all submitted user feedback/reports, with refresh + delete.
// [A7] theme via useTheme(); feedback storage via lib/feedback.js.
// onBack stays a prop.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { listFeedback, deleteFeedback } from '../lib/feedback.js';
import { Card, Pill, TopBar } from '../ui/primitives.jsx';

function FeedbackInbox({ onBack }) {
  const { theme: T } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const list = await listFeedback();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const remove = async (id) => {
    await deleteFeedback(id);
    setItems(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Feedback inbox" onBack={onBack}
              feedback={{ screen: "Feedback inbox" }}
              right={
                <button onClick={refresh} disabled={loading}
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                  <RefreshCw size={18} style={{ color: T.muted }} className={loading ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle size={36} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>No reports yet</div>
            <div className="text-sm" style={{ color: T.muted }}>Users can tap the report icon on any screen.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(it => {
              const date = new Date(it.ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
              return (
                <Card key={it.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill bg={T.primary + '18'} color={T.primary}>{it.screen}</Pill>
                      {it.questionId && <Pill bg={T.surfaceWarm} color={T.inkSoft}>Q: {it.questionId}</Pill>}
                      {it.profileName && <Pill bg={T.accent + '15'} color={T.accent}>{it.profileName}</Pill>}
                    </div>
                    <button onClick={() => remove(it.id)} className="no-tap-highlight p-1 -m-1 flex-shrink-0">
                      <Trash2 size={14} style={{ color: T.error }} />
                    </button>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed mb-2" style={{ color: T.ink }}>{it.report}</div>
                  {it.fix && (
                    <div className="text-xs whitespace-pre-wrap leading-relaxed pt-2 mt-1 border-t" style={{ color: T.inkSoft, borderColor: T.borderSoft }}>
                      <span className="font-semibold" style={{ color: T.muted }}>Suggested fix: </span>{it.fix}
                    </div>
                  )}
                  <div className="text-[10px] mt-2" style={{ color: T.muted }}>{date}</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedbackInbox;
