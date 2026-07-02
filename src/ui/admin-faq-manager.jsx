// =====================================================================
// src/ui/admin-faq-manager.jsx  (Feature F-F, admin side)
// FAQ authoring for admins: create / edit / delete FAQs (question, answer,
// category). A sub-screen of AdminPanel, mirroring AdminManager.
// Community-question replies happen inline on the FAQ screen itself (admin
// controls there), so this is purely the FAQ content CRUD.
//
// Category is a predefined dropdown + "Other…" (custom). Ordering is a stack —
// newest FAQ appears first for students (lib/faq.js#listFaqs), so there is no
// manual "order" field. Every successful save shows a confirmation banner.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, Check, MessageCircle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from './primitives.jsx';
import AdminEmpty from './admin-empty.jsx';
import { listFaqs, createFaq, updateFaq, deleteFaq, FAQ_CATEGORIES } from '../lib/faq.js';
import { RichTextEditor } from './rich-text.jsx';
import { toPlainText } from '../lib/rich-text.js';
import { logAdminAction } from '../lib/admin-audit.js';

const blank = { id: null, question: '', answer: '', category: 'General' };
const OTHER = '__other__';

export default function AdminFaqManager({ onBack, actorName }) {
  const { theme: T } = useTheme();
  const [faqs, setFaqs] = useState(null);
  const [form, setForm] = useState(null); // null = list view; object = editing/creating
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  // BUG-04 — surface write failures instead of swallowing them. The save/delete
  // now use the strict broker path (faq.js), so a rejection (stale token,
  // rate-limit, offline, not-an-admin) THROWS — and the admin sees why.
  const [err, setErr] = useState(null);
  // Confirm-on-save: the editor used to just close, leaving the admin unsure it
  // worked. A success banner removes the doubt.
  const [okMsg, setOkMsg] = useState(null);

  const refresh = () => listFaqs().then(setFaqs).catch(() => setFaqs([]));
  useEffect(() => { refresh(); }, []);

  const startNew = () => { setErr(null); setOkMsg(null); setForm({ ...blank }); };
  const startEdit = (f) => { setErr(null); setOkMsg(null); setForm({ id: f.id, question: f.question, answer: f.answer, category: f.category || 'General' }); };

  const canSave = form && form.question.trim() && form.answer.trim();

  const failText = (e) => {
    const m = String((e && e.message) || e || '');
    if (/401/.test(m)) return 'Your admin session expired — log out and back in, then try again.';
    if (/403/.test(m)) return 'This profile is not authorised to publish FAQs (admin only).';
    if (/429|rate/i.test(m)) return 'Too many admin writes for now — wait a little and try again.';
    return 'Could not save — are you online and using the admin profile? Please try again.';
  };

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const category = form.category.trim() || 'General';
      if (form.id) {
        const existing = (faqs || []).find(x => x.id === form.id);
        await updateFaq(existing, { question: form.question.trim(), answer: form.answer.trim(), category });
        logAdminAction({ action: 'faq.update', target: form.id, targetName: form.question.trim().slice(0, 60), actorName });
        setOkMsg('FAQ updated — changes are live for students.');
      } else {
        await createFaq({ question: form.question, answer: form.answer, category });
        logAdminAction({ action: 'faq.create', targetName: form.question.trim().slice(0, 60), actorName });
        setOkMsg('FAQ published — it’s live at the top of the FAQ screen.');
      }
      setForm(null);
      await refresh();
    } catch (e) {
      setErr(failText(e));
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    setBusy(true);
    setErr(null);
    try { await deleteFaq(id); logAdminAction({ action: 'faq.delete', target: id, actorName }); setConfirmDel(null); setOkMsg('FAQ deleted.'); await refresh(); }
    catch (e) { setErr(failText(e)); }
    finally { setBusy(false); }
  };

  const input = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  // ---- Form view ----
  if (form) {
    const isPreset = FAQ_CATEGORIES.includes(form.category);
    return (
      <div className="anim-fadeup">
        <TopBar title={form.id ? 'Edit FAQ' : 'New FAQ'} onBack={() => setForm(null)} />
        <div className="max-w-md mx-auto px-4 pb-24 pt-2 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Question</label>
            <textarea value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} rows={2}
                      className="w-full mt-1 text-sm rounded-xl px-3 py-2 resize-none outline-none" style={input} placeholder="e.g. How does negative marking work in mock tests?" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Answer</label>
            <div className="mt-1">
              <RichTextEditor value={form.answer} onChange={v => setForm(f => ({ ...f, answer: v }))} rows={6}
                              placeholder="Write the answer, then format it with the toolbar — bold, headings, lists, links, highlight…" />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Category</label>
            <select value={isPreset ? form.category : OTHER}
                    onChange={e => { const v = e.target.value; setForm(f => ({ ...f, category: v === OTHER ? '' : v })); }}
                    className="w-full mt-1 text-sm rounded-xl px-3 py-2 outline-none" style={input}>
              {FAQ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              <option value={OTHER}>Other…</option>
            </select>
            {!isPreset && (
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} autoFocus
                     className="w-full mt-2 text-sm rounded-xl px-3 py-2 outline-none" style={input} placeholder="Type a custom category" />
            )}
          </div>
          <div className="text-[11px]" style={{ color: T.muted }}>New FAQs appear at the top of the FAQ screen for students.</div>
          {err && (
            <div className="text-xs rounded-xl px-3 py-2.5" style={{ background: T.errorSoft, border: `1px solid ${T.error}40`, color: T.error }}>{err}</div>
          )}
          <Button onClick={save} size="lg" className="w-full" disabled={!canSave || busy} icon={<Save size={18} />}>
            {busy ? 'Saving…' : (form.id ? 'Save changes' : 'Create FAQ')}
          </Button>
        </div>
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="anim-fadeup">
      <TopBar title="FAQ manager" onBack={onBack} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <button onClick={startNew}
                className="no-tap-highlight w-full mb-4 inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                style={{ background: T.primary, color: '#FFF' }}>
          <Plus size={18} /> Add a FAQ
        </button>

        {okMsg && (
          <div className="text-xs rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2" style={{ background: T.successSoft, border: `1px solid ${T.success}40`, color: T.inkSoft }}>
            <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
            <span className="flex-1">{okMsg}</span>
            <button onClick={() => setOkMsg(null)} className="no-tap-highlight p-0.5 -m-0.5 leading-none" style={{ color: T.muted }} aria-label="Dismiss">✕</button>
          </div>
        )}

        {err && (
          <div className="text-xs rounded-xl px-3 py-2.5 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}40`, color: T.error }}>{err}</div>
        )}

        {faqs === null ? (
          <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : faqs.length === 0 ? (
          <AdminEmpty icon={MessageCircle} accent={T.primary}
            title="No FAQs yet"
            what="The questions and answers shown on the public FAQ screen. You author them here; the newest appears first for students."
            when="Tap “Add a FAQ” above — it appears instantly in the FAQ screen for everyone." />
        ) : (
          <div className="space-y-2.5">
            {faqs.map(f => (
              <Card key={f.id} className="p-3.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm font-semibold leading-snug" style={{ color: T.ink }}>{f.question}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: T.primary + '18', color: T.primary }}>{f.category || 'General'}</span>
                    </div>
                    <div className="text-xs mt-1.5 line-clamp-2" style={{ color: T.muted }}>{toPlainText(f.answer)}</div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => startEdit(f)} className="no-tap-highlight p-2 rounded-lg active:scale-90 transition" style={{ background: T.surfaceWarm }} aria-label="Edit">
                      <Edit3 size={15} style={{ color: T.ink }} />
                    </button>
                    <button onClick={() => setConfirmDel(f.id)} className="no-tap-highlight p-2 rounded-lg active:scale-90 transition" style={{ background: T.error + '14' }} aria-label="Delete">
                      <Trash2 size={15} style={{ color: T.error }} />
                    </button>
                  </div>
                </div>

                {confirmDel === f.id && (
                  <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                    <div className="text-xs flex-1" style={{ color: T.ink }}>Delete this FAQ and its community thread?</div>
                    <button onClick={() => remove(f.id)} disabled={busy} className="no-tap-highlight px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: T.error, color: '#FFF' }}>Delete</button>
                    <button onClick={() => setConfirmDel(null)} className="no-tap-highlight px-3 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: T.surfaceWarm, color: T.muted }}>Cancel</button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
