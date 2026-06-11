// =====================================================================
// src/screens/crib-sheet.jsx  (#28 — Post-Test Crib Sheet)
// A clean, scrollable, PDF-like review of EVERY question from a finished
// test session, in three anchored sections: Correct / Wrong / Not attempted.
// Opt-in from the results screen ("Review answers — Crib Sheet"); gated by
// the Settings toggle (#29, lib/ui-prefs.js). Session-based — nothing here
// is persisted; "Share" (native share sheet / clipboard) is the way to keep
// a copy.
//
// Items are pre-shaped by App so one screen serves Quick/Topic/Mock (results
// array) AND Advanced/PYQ paper tests (answers map):
//   { q, selected: number[], status: 'correct'|'wrong'|'na' }
// `negative` shows the Advanced-Test ±marks badges (+4 / −1/3-style labels
// are passed in as plus/minus strings so scoring stays App's business).
//
// Large papers (100–200 Qs): cards render in incremental windows of 25 via
// an IntersectionObserver sentinel — never all at once on load.
// =====================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronLeft, Lightbulb, Minus, Share2, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { topicName, topicColor } from '../lib/topics.js';
import { Card, TopBar } from '../ui/primitives.jsx';
import { HelpfulToggle } from '../ui/question-widgets.jsx';

const WINDOW = 25;

function QuestionCard({ item, num, T, negative, profileId, accent }) {
  const { q, selected, status } = item;
  return (
    <Card className="p-4" style={{ borderLeft: `3px solid ${accent}`, borderRadius: 12 }}>
      {/* number + tags row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <span className="text-[11px] font-mono font-semibold" style={{ color: T.muted }}>Q{num}</span>
        {q.topic && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: topicColor(q.topic) + '15', color: topicColor(q.topic) }}>
            {topicName(q.topic)}
          </span>
        )}
        {q.sub && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: T.primary + '12', color: T.primary }}>
            {q.sub}
          </span>
        )}
        {status === 'na' && (
          <span className="text-[10px]" style={{ color: T.muted }}>Not attempted</span>
        )}
        {negative && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto"
                style={{
                  background: status === 'correct' ? T.successSoft : status === 'wrong' ? T.errorSoft : T.surfaceWarm,
                  color: status === 'correct' ? T.success : status === 'wrong' ? T.error : T.muted,
                }}>
            {status === 'correct' ? `+${negative.plus}` : status === 'wrong' ? `−${negative.minus}` : '0'} marks
          </span>
        )}
      </div>

      {/* full stem — never truncated */}
      <div className="text-sm mb-3" style={{ color: T.ink, lineHeight: 1.6 }}>{q.q}</div>

      {/* all four options */}
      <div className="space-y-1.5 mb-3">
        {q.options.map((opt, i) => {
          const ok = q.correct.includes(i);
          const pickedWrong = status === 'wrong' && selected.includes(i) && !ok;
          return (
            <div key={i} className="flex items-start gap-2 text-[13px] leading-snug px-2.5 py-2 rounded-lg"
                 style={{
                   background: ok ? T.successSoft : pickedWrong ? T.errorSoft : T.surface,
                   border: `1px solid ${ok ? T.success + '60' : pickedWrong ? T.error + '60' : T.borderSoft}`,
                   borderLeft: `3px solid ${ok ? T.success : pickedWrong ? T.error : T.borderSoft}`,
                 }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold"
                    style={{
                      background: ok ? T.success : pickedWrong ? T.error : T.surface,
                      color: (ok || pickedWrong) ? '#FFF' : T.muted,
                      border: `1px solid ${ok ? T.success : pickedWrong ? T.error : T.border}`,
                    }}>
                {ok ? <Check size={11} /> : pickedWrong ? <X size={11} /> : String.fromCharCode(65 + i)}
              </span>
              <span className="pt-0.5" style={{ color: (ok || pickedWrong) ? T.ink : T.inkSoft, fontWeight: ok ? 500 : 400 }}>
                {opt}
              </span>
            </div>
          );
        })}
      </div>

      {/* explanation — always visible, never behind a tap */}
      <div className="pt-2.5" style={{ borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Lightbulb size={12} style={{ color: T.accent }} />
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Explanation</span>
        </div>
        {q.exp ? (
          <>
            <div className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: T.inkSoft }}>{q.exp}</div>
            {profileId && <HelpfulToggle questionId={q.id} explanation={q.exp} profileId={profileId} />}
          </>
        ) : (
          <div className="text-[12px] italic" style={{ color: T.muted }}>No explanation available for this question</div>
        )}
      </div>
    </Card>
  );
}

function CribSheet({ title, subtitle, items, negative = null, profileId = null, onBack }) {
  const { theme: T } = useTheme();
  const correct = useMemo(() => items.filter(i => i.status === 'correct'), [items]);
  const wrong = useMemo(() => items.filter(i => i.status === 'wrong'), [items]);
  const na = useMemo(() => items.filter(i => i.status === 'na'), [items]);

  // Incremental rendering window for very long papers.
  const [limit, setLimit] = useState(WINDOW);
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (limit >= items.length) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setLimit(items.length); return; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) setLimit(l => Math.min(items.length, l + WINDOW));
    }, { rootMargin: '600px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [limit, items.length]);

  // Floating scroll-to-top after the user is a few cards deep.
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop((window.scrollY || 0) > 900);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const correctRef = useRef(null);
  const wrongRef = useRef(null);
  const naRef = useRef(null);
  const jump = (ref) => { try { ref.current && ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} };

  const share = async () => {
    const lines = [
      `${title} — Crib Sheet`,
      subtitle,
      `✓ ${correct.length} correct · ✕ ${wrong.length} wrong · — ${na.length} not attempted`,
      '',
      ...items.slice(0, 50).map((it, i) => {
        const ans = it.q.correct.map(c => String.fromCharCode(65 + c)).join(',');
        return `Q${i + 1}. ${it.q.q}\nAnswer: ${ans}${it.q.exp ? `\n${it.q.exp}` : ''}\n`;
      }),
      items.length > 50 ? `…and ${items.length - 50} more questions.` : '',
    ].filter(Boolean);
    const text = lines.join('\n');
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `${title} — Crib Sheet`, text });
        return;
      }
    } catch (e) { /* fall through to clipboard */ }
    try { await navigator.clipboard.writeText(text); alert('Crib Sheet copied — paste it anywhere to share.'); } catch (e) {}
  };

  // Abandoned session — nothing attempted at all.
  const abandoned = correct.length === 0 && wrong.length === 0 && na.length === items.length && items.length > 0;

  const Section = ({ label, icon, color, soft, list, refEl, startNum, empty }) => (
    <div ref={refEl} style={{ scrollMarginTop: 64 }}>
      <div className="sticky z-10 flex items-center gap-2 px-3 py-2 rounded-xl mb-2.5"
           style={{ top: 8, background: soft, border: `1px solid ${color}30`, backdropFilter: 'blur(6px)' }}>
        {icon}
        <span className="text-[12px] font-semibold" style={{ color }}>{label} — {list.length} question{list.length === 1 ? '' : 's'}</span>
      </div>
      {list.length === 0 ? (
        <Card className="p-4 mb-5 text-[13px]" style={{ background: soft, border: `1px solid ${color}25`, color: T.inkSoft }}>
          {empty}
        </Card>
      ) : (
        <div className="space-y-3 mb-6">
          {list.map((it, i) => (
            <QuestionCard key={it.q.id || i} item={it} num={startNum + i} T={T}
                          negative={negative} profileId={profileId} accent={color} />
          ))}
        </div>
      )}
    </div>
  );

  // Apply the render window across the concatenated section order.
  const winCorrect = correct.slice(0, limit);
  const winWrong = wrong.slice(0, Math.max(0, limit - correct.length));
  const winNa = na.slice(0, Math.max(0, limit - correct.length - wrong.length));

  return (
    <div className="anim-fadeup">
      <TopBar title="Crib Sheet" onBack={onBack} feedback={{ screen: 'Crib sheet' }} />
      <div className="max-w-md mx-auto px-4 pt-2 pb-28">
        <div className="px-1 mb-4">
          <div className="font-display text-xl font-semibold" style={{ color: T.ink }}>{title}</div>
          <div className="text-xs mt-0.5" style={{ color: T.muted }}>{subtitle}</div>
        </div>

        {abandoned ? (
          <Card className="p-5 text-center">
            <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
              Looks like this test wasn't completed — here are all the questions with their answers, whenever you're ready.
            </div>
          </Card>
        ) : (
          <div className="flex gap-2 mb-5">
            <button onClick={() => jump(correctRef)}
                    className="no-tap-highlight flex-1 py-2 rounded-full text-[12px] font-semibold active:scale-95 transition"
                    style={{ background: T.successSoft, color: T.success, border: `1px solid ${T.success}40` }}>
              ✓ {correct.length} Correct
            </button>
            <button onClick={() => jump(wrongRef)}
                    className="no-tap-highlight flex-1 py-2 rounded-full text-[12px] font-semibold active:scale-95 transition"
                    style={{ background: T.errorSoft, color: T.error, border: `1px solid ${T.error}40` }}>
              ✕ {wrong.length} Wrong
            </button>
            {na.length > 0 && (
              <button onClick={() => jump(naRef)}
                      className="no-tap-highlight flex-1 py-2 rounded-full text-[12px] font-semibold active:scale-95 transition"
                      style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>
                — {na.length} Skipped
              </button>
            )}
          </div>
        )}

        <Section label="✓ Correct" color={T.success} soft={T.successSoft}
                 icon={<Check size={14} style={{ color: T.success }} />}
                 list={winCorrect} refEl={correctRef} startNum={1}
                 empty="Nothing here this time — but the explanations below will change that." />

        <Section label="✕ Wrong" color={T.error} soft={T.errorSoft}
                 icon={<X size={14} style={{ color: T.error }} />}
                 list={winWrong} refEl={wrongRef} startNum={correct.length + 1}
                 empty="Nothing here — you got everything right. Seriously impressive." />

        {na.length > 0 && (
          <Section label="— Not attempted" color={T.muted} soft={T.surfaceWarm}
                   icon={<Minus size={14} style={{ color: T.muted }} />}
                   list={winNa} refEl={naRef} startNum={correct.length + wrong.length + 1}
                   empty="" />
        )}

        {/* incremental-render sentinel */}
        {limit < items.length && (
          <div ref={sentinelRef} className="py-6 text-center text-xs" style={{ color: T.muted }}>
            Loading more questions…
          </div>
        )}
      </div>

      {/* fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-2">
          <button onClick={onBack}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition"
                  style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
            <ChevronLeft size={15} /> Back to results
          </button>
          <button onClick={share}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition"
                  style={{ background: T.primary, color: '#FFF' }}>
            <Share2 size={15} /> Share Crib Sheet
          </button>
        </div>
      </div>

      {/* floating scroll-to-top */}
      {showTop && (
        <button onClick={() => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }}
                aria-label="Scroll to top"
                className="no-tap-highlight fixed right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition anim-fadeup"
                style={{ bottom: 76, background: T.surface, border: `1px solid ${T.border}`, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}>
          <ArrowUp size={18} style={{ color: T.inkSoft }} />
        </button>
      )}
    </div>
  );
}

export default CribSheet;
