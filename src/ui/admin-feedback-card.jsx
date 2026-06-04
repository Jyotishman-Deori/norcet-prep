// =====================================================================
// src/ui/admin-feedback-card.jsx — admin feedback reply card (A1 slice 26)
// Extracted from App.jsx. Body byte-identical; changes are the A7 hook lines
// (T -> useTheme; feedbackStatusMeta -> useStatusMeta, slice 25). Props stay
// { item, onSaveReply, onDelete, onPeek }. FEEDBACK_STATUSES from lib/feedback.
// =====================================================================
import React, { useState } from 'react';
import { Check, Eye, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { useStatusMeta } from '../lib/theme-helpers.js';
import { Card, Button, Pill } from '../ui/primitives.jsx';
import { FEEDBACK_STATUSES } from '../lib/feedback.js';

function AdminFeedbackCard({ item, onSaveReply, onDelete, onPeek }) {
  const { theme: T } = useTheme();
  const feedbackStatusMeta = useStatusMeta();
  const [reply, setReply] = useState(item.reply || '');
  const [status, setStatus] = useState(item.status || null);
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const date = new Date(item.ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  const dirty = (reply.trim() !== (item.reply || '')) || (status !== (item.status || null));

  const save = async () => {
    setBusy(true);
    await onSaveReply(item, { reply: reply.trim() || null, status: status || null });
    setBusy(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1500);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill bg={T.primary + '18'} color={T.primary}>{item.screen}</Pill>
          {item.questionId && (
            <button onClick={() => onPeek && onPeek(item.questionId)}
                    className="no-tap-highlight inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium active:scale-95 transition"
                    style={{ background: T.primary + '12', color: T.primary, border: `1px solid ${T.primary}33` }}>
              <Eye size={11} /> Q: {item.questionId}
            </button>
          )}
          {item.profileName && <Pill bg={T.accent + '15'} color={T.accent}>{item.profileName}</Pill>}
          {item.status && (() => {
            const m = feedbackStatusMeta(item.status);
            return <Pill bg={m.color + '1F'} color={m.color}>{m.label}</Pill>;
          })()}
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setConfirmDelete(false)}
                    className="no-tap-highlight text-xs px-2 py-1 rounded-lg"
                    style={{ color: T.muted, background: T.surfaceWarm }}>No</button>
            <button onClick={() => onDelete(item.id)}
                    className="no-tap-highlight text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ color: '#FFF', background: T.error }}>Delete</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
                  className="no-tap-highlight p-1 -m-1 flex-shrink-0 rounded-lg active:bg-black/5"
                  aria-label="Delete report">
            <Trash2 size={14} style={{ color: T.error }} />
          </button>
        )}
      </div>

      <div className="text-sm whitespace-pre-wrap leading-relaxed mb-2" style={{ color: T.ink }}>{item.report}</div>
      {item.fix && (
        <div className="text-xs whitespace-pre-wrap leading-relaxed pt-2 mt-1 border-t" style={{ color: T.inkSoft, borderColor: T.borderSoft }}>
          <span className="font-semibold" style={{ color: T.muted }}>Suggested fix: </span>{item.fix}
        </div>
      )}
      <div className="text-[10px] mt-2 mb-3" style={{ color: T.muted }}>{date}</div>

      {/* Status chips */}
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Status</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FEEDBACK_STATUSES.map(s => {
          const active = status === s.id;
          const meta = feedbackStatusMeta(s.id);
          return (
            <button key={s.id} onClick={() => setStatus(active ? null : s.id)}
                    className="no-tap-highlight px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                    style={{
                      background: active ? meta.color : T.surfaceWarm,
                      color: active ? '#FFF' : T.inkSoft,
                      border: `1px solid ${active ? meta.color : T.border}`
                    }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Reply */}
      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: T.muted }}>Reply to user</div>
      <textarea value={reply} onChange={e => setReply(e.target.value)}
                placeholder="A short note back to the user (optional)" rows={2} maxLength={300}
                className="w-full rounded-xl px-3 py-2.5 mb-2 text-sm resize-none"
                style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={busy || !dirty} size="sm" className="flex-1"
                icon={busy ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}>
          {savedMsg ? 'Saved' : (item.reply || item.status ? 'Update' : 'Send')}
        </Button>
        {savedMsg && <Check size={16} style={{ color: T.success }} />}
      </div>
    </Card>
  );
}

export default AdminFeedbackCard;
