// =====================================================================
// src/ui/admin-faq-manager.jsx  (Feature F-F, admin side)
// FAQ authoring for admins: create / edit / delete FAQs (question, answer,
// category, order). A sub-screen of AdminPanel, mirroring AdminManager.
// Community-question replies happen inline on the FAQ screen itself (admin
// controls there), so this is purely the FAQ content CRUD.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, X, MessageCircle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from './primitives.jsx';
import AdminEmpty from './admin-empty.jsx';
import { listFaqs, createFaq, updateFaq, deleteFaq } from '../lib/faq.js';

const blank = { id: null, question: '', answer: '', category: '', order: '' };

export default function AdminFaqManager({ onBack }) {
  const { theme: T } = useTheme();
  const [faqs, setFaqs] = useState(null);
  const [form, setForm] = useState(null); // null = list view; object = editing/creating
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  // BUG-04 — surface write failures instead of swallowing them. The save/delete
  // now use the strict broker path (faq.js), so a rejection (stale token,
  // rate-limit, offline, not-an-admin) THROWS — and the admin sees why.
  const [err, setErr] = useState(null);

  const refresh = () => listFaqs().then(setFaqs).catch(() => setFaqs([]));
  useEffect(() => { refresh(); }, []);

  const startNew = () => { setErr(null); setForm({ ...blank }); };
  const startEdit = (f) => { setErr(null); setForm({ id: f.id, question: f.question, answer: f.answer, category: f.category || '', order: typeof f.order === 'number' ? String(f.order) : '' }); };

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
      const order = form.order.trim() === '' ? undefined : Number(form.order);
      if (form.id) {
        const existing = (faqs || []).find(x => x.id === form.id);
        await updateFaq(existing, { question: form.question.trim(), answer: form.answer.trim(), category: (form.category.trim() || 'General'), ...(order != null && !isNaN(order) ? { order } : {}) });
      } else {
        await createFaq({ question: form.question, answer: form.answer, category: form.category, ...(order != null && !isNaN(order) ? { order } : {}) });
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
    try { await deleteFaq(id); setConfirmDel(null); await refresh(); }
    catch (e) { setErr(failText(e)); }
    finally { setBusy(false); }
  };

  const input = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  // ---- Form view ----
  if (form) {
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
            <textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} rows={6}
                      className="w-full mt-1 text-sm rounded-xl px-3 py-2 resize-none outline-none" style={input} placeholder="Write the answer. Line breaks are preserved." />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                     className="w-full mt-1 text-sm rounded-xl px-3 py-2 outline-none" style={input} placeholder="General" />
            </div>
            <div className="w-24">
              <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Order</label>
              <input value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value.replace(/[^0-9]/g, '') }))}
                     inputMode="numeric" className="w-full mt-1 text-sm rounded-xl px-3 py-2 outline-none" style={input} placeholder="auto" />
            </div>
          </div>
          <div className="text-[11px]" style={{ color: T.muted }}>Lower order numbers appear first. Leave blank to add at the end.</div>
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

        {err && (
          <div className="text-xs rounded-xl px-3 py-2.5 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}40`, color: T.error }}>{err}</div>
        )}

        {faqs === null ? (
          <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : faqs.length === 0 ? (
          <AdminEmpty icon={MessageCircle} accent={T.primary}
            title="No FAQs yet"
            what="The questions and answers shown on the public FAQ screen. You author them here; lower order numbers appear first."
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
                      <span className="text-[10px]" style={{ color: T.muted }}>order {typeof f.order === 'number' ? f.order : '—'}</span>
                    </div>
                    <div className="text-xs mt-1.5 line-clamp-2" style={{ color: T.muted }}>{f.answer}</div>
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
