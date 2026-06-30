// =====================================================================
// src/screens/faq.jsx  (Feature F-F — FAQ Section, user side)
// A chat-style FAQ: tap a question to reveal its answer, filter by category,
// vote with the helpful bulb, and under each answer a PUBLIC community thread
// (students ask follow-ups, admins reply with an "Admin" badge). All data is
// the shared kv store (mirrors feedback). Admin controls (inline reply,
// delete, helpful counts) appear only when isAdmin is true.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { ChevronDown, MessageCircle, Send, Shield, Sparkles, Trash2, HelpCircle } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';
import HelpfulBulb from '../ui/helpful-bulb.jsx';
import {
  listFaqs, faqCategories, listCommunityQuestions, addCommunityQuestion,
  replyToCommunityQuestion, deleteCommunityQuestion, faqAnswerVoteId, faqReplyVoteId,
} from '../lib/faq.js';
import { GUEST_ID } from '../lib/profiles.js';
import TrendingBadge from '../ui/trending-badge.jsx';
import { recordInteraction, loadDailyCounts } from '../lib/trending-store.js';
import { rankTrending } from '../lib/trending.js';

function relTime(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const NEW_FAQ_MS = 7 * 86400000; // a FAQ added within 7 days shows a "New" badge
const isNewFaq = (f) => !!(f && f.createdAt) && (Date.now() - f.createdAt) < NEW_FAQ_MS;

function FAQScreen({ onBack, isAdmin = false, profile }) {
  const { theme: T } = useTheme();
  const profileId = (profile && profile.id) || GUEST_ID;
  const profileName = (profile && profile.displayName) || 'Student';
  const uid = (profile && profile.uid) || null;
  const isGuest = !profile || profileId === GUEST_ID || profileId === '__guest__';

  const [faqs, setFaqs] = useState(null); // null = loading
  const [cat, setCat] = useState('All');
  const [openId, setOpenId] = useState(null);
  const [threads, setThreads] = useState({}); // { faqId: { loading, items } }
  const [draftQ, setDraftQ] = useState({});   // { faqId: text }
  const [draftReply, setDraftReply] = useState({}); // { qid: text }

  useEffect(() => { let a = true; listFaqs().then(f => { if (a) setFaqs(f); }).catch(() => { if (a) setFaqs([]); }); return () => { a = false; }; }, []);

  // TRENDING — which FAQs are surging right now (shared free-tier counters, pure
  // scoring). Recomputed whenever the FAQ list changes.
  const [trendingFaqIds, setTrendingFaqIds] = useState(() => new Set());
  useEffect(() => {
    if (!faqs || faqs.length === 0) { setTrendingFaqIds(new Set()); return; }
    let alive = true;
    loadDailyCounts('faq', faqs.map(f => f.id), 7).then(counts => {
      if (!alive) return;
      const ranked = rankTrending(faqs.map(f => ({ id: f.id })), counts, { topN: 3 });
      setTrendingFaqIds(new Set(ranked.filter(r => r.isTrending).map(r => r.id)));
    }).catch(() => {});
    return () => { alive = false; };
  }, [faqs]);

  const categories = ['All', ...faqCategories(faqs || [])];
  const visible = (faqs || []).filter(f => cat === 'All' || f.category === cat);

  const openFaq = async (id) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (uid) recordInteraction('faq', id, uid); // fire-and-forget trending signal
    if (!threads[id]) {
      setThreads(t => ({ ...t, [id]: { loading: true, items: [] } }));
      try { const items = await listCommunityQuestions(id); setThreads(t => ({ ...t, [id]: { loading: false, items } })); }
      catch (e) { setThreads(t => ({ ...t, [id]: { loading: false, items: [] } })); }
    }
  };

  const refreshThread = async (faqId) => {
    try { const items = await listCommunityQuestions(faqId); setThreads(t => ({ ...t, [faqId]: { loading: false, items } })); } catch (e) {}
  };

  const postQuestion = async (faqId) => {
    const text = (draftQ[faqId] || '').trim();
    if (!text || isGuest) return;
    setDraftQ(d => ({ ...d, [faqId]: '' }));
    try { await addCommunityQuestion(faqId, { text, authorId: profileId, authorName: profileName }); await refreshThread(faqId); } catch (e) {}
  };

  const postReply = async (q) => {
    const text = (draftReply[q.id] || '').trim();
    if (!text) return;
    setDraftReply(d => ({ ...d, [q.id]: '' }));
    try { await replyToCommunityQuestion(q, text); await refreshThread(q.faqId); } catch (e) {}
  };

  const removeQuestion = async (q) => {
    try { await deleteCommunityQuestion(q.faqId, q.id); await refreshThread(q.faqId); } catch (e) {}
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="FAQ & Help" onBack={onBack} feedback={{ screen: 'FAQ' }} />
      <div className="max-w-md mx-auto px-4 pb-28 pt-2">
        {/* Chat-style intro */}
        <div className="flex gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary }}>
            <Sparkles size={15} color="#FFF" />
          </div>
          <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed" style={{ background: T.surface, color: T.ink, border: `1px solid ${T.border}` }}>
            Hi! Tap any question to see the answer. Still stuck? Ask under any answer and an admin will reply.
          </div>
        </div>

        {faqs === null ? (
          <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : faqs.length === 0 ? (
          // #15 — admin-controlled (Type 2): "coming soon", no CTA for users.
          // Shows when zero FAQs exist in the admin panel's FAQ manager.
          <EmptyState
            icon={MessageCircle}
            title="Questions incoming"
            text={isAdmin
              ? 'No FAQs yet — add your first from the Admin panel → FAQ manager. It appears here instantly.'
              : 'The FAQ section is being set up. Check back soon — answers to common questions will appear here.'} />
        ) : (
          <>
            {/* Category chips */}
            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                {categories.map(c => {
                  const on = cat === c;
                  return (
                    <button key={c} onClick={() => setCat(c)}
                            className="no-tap-highlight flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition"
                            style={{ background: on ? T.primary : T.surface, color: on ? '#FFF' : T.muted, border: `1px solid ${on ? T.primary : T.border}` }}>
                      {c}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="space-y-2.5">
              {visible.map(f => {
                const isOpen = openId === f.id;
                const th = threads[f.id];
                return (
                  <Card key={f.id} className="overflow-hidden" style={{ borderLeft: `3px solid ${isOpen ? T.primary : T.borderSoft}` }}>
                    {/* Question row */}
                    <button onClick={() => openFaq(f.id)} className="no-tap-highlight w-full text-left p-4 flex items-start gap-3">
                      <MessageCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-[15px] font-semibold leading-snug" style={{ color: T.ink }}>{f.question}</div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {trendingFaqIds.has(f.id)
                            ? <TrendingBadge />
                            : isNewFaq(f) && <TrendingBadge variant="new" />}
                          {!isOpen && <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>{f.category}</span>}
                        </div>
                      </div>
                      <ChevronDown size={18} className="flex-shrink-0 transition-transform" style={{ color: T.muted, transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 anim-fadeup">
                        {/* Answer bubble */}
                        <div className="flex gap-2.5 mb-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '22' }}>
                            <Sparkles size={13} style={{ color: T.primary }} />
                          </div>
                          <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: T.surfaceWarm, color: T.ink }}>
                            {f.answer}
                          </div>
                        </div>

                        {/* Helpful bulb on the answer */}
                        <div className="pl-9 mb-4">
                          <HelpfulBulb voteId={faqAnswerVoteId(f.id)} profileId={profileId} isAdmin={isAdmin} />
                        </div>

                        {/* Community thread */}
                        <div className="pt-3" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                          <div className="text-[10px] uppercase tracking-widest font-semibold mb-2.5" style={{ color: T.muted }}>
                            Community questions
                          </div>

                          {th && th.loading ? (
                            <div className="text-xs" style={{ color: T.muted }}>Loading…</div>
                          ) : th && th.items.length > 0 ? (
                            <div className="space-y-3 mb-3">
                              {th.items.map(q => (
                                <div key={q.id}>
                                  {/* user question (right) */}
                                  <div className="flex justify-end">
                                    <div className="max-w-[85%]">
                                      <div className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm leading-relaxed" style={{ background: T.primary + '14', color: T.ink }}>
                                        {q.text}
                                      </div>
                                      <div className="text-[10px] mt-1 text-right" style={{ color: T.muted }}>{q.authorName} · {relTime(q.createdAt)}</div>
                                    </div>
                                  </div>

                                  {/* admin reply (left) */}
                                  {q.reply ? (
                                    <div className="flex gap-2 mt-2">
                                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.success + '22' }}>
                                        <Shield size={13} style={{ color: T.success }} />
                                      </div>
                                      <div className="max-w-[85%]">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: T.success, color: '#FFF' }}>Admin</span>
                                          <span className="text-[10px]" style={{ color: T.muted }}>{relTime(q.repliedAt)}</span>
                                        </div>
                                        <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: T.surfaceWarm, color: T.ink }}>
                                          {q.reply}
                                        </div>
                                        <div className="mt-1.5"><HelpfulBulb voteId={faqReplyVoteId(q.id)} profileId={profileId} isAdmin={isAdmin} compact /></div>
                                      </div>
                                    </div>
                                  ) : isAdmin ? (
                                    <div className="mt-2 pl-9">
                                      <textarea value={draftReply[q.id] || ''} onChange={e => setDraftReply(d => ({ ...d, [q.id]: e.target.value }))}
                                                placeholder="Write an admin reply…" rows={2}
                                                className="w-full text-sm rounded-xl px-3 py-2 resize-none outline-none" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
                                      <div className="flex gap-2 mt-1.5">
                                        <button onClick={() => postReply(q)} className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition" style={{ background: T.primary, color: '#FFF' }}>
                                          <Send size={13} /> Reply
                                        </button>
                                        <button onClick={() => removeQuestion(q)} className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition" style={{ background: T.error + '18', color: T.error }}>
                                          <Trash2 size={13} /> Delete
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-[11px] mt-1.5 pl-2" style={{ color: T.muted }}>Awaiting an admin reply</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs mb-3" style={{ color: T.muted }}>No questions yet. Be the first to ask.</div>
                          )}

                          {/* Ask box */}
                          {isGuest ? (
                            <div className="text-[11px]" style={{ color: T.muted }}>Sign in to ask a question.</div>
                          ) : (
                            <div className="flex items-end gap-2">
                              <textarea value={draftQ[f.id] || ''} onChange={e => setDraftQ(d => ({ ...d, [f.id]: e.target.value }))}
                                        placeholder="Ask a follow-up question…" rows={1}
                                        className="flex-1 text-sm rounded-xl px-3 py-2 resize-none outline-none" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
                              <button onClick={() => postQuestion(f.id)} disabled={!(draftQ[f.id] || '').trim()}
                                      className="no-tap-highlight flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition"
                                      style={{ background: (draftQ[f.id] || '').trim() ? T.primary : T.border, color: '#FFF' }}>
                                <Send size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            <div className="mt-5 text-center text-[11px]" style={{ color: T.muted }}>
              Questions and admin replies here are public to all students.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default FAQScreen;
