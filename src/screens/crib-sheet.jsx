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
import { ArrowUp, BookmarkPlus, CalendarDays, Check, ChevronLeft, Home, Lightbulb, Minus, Printer, Share2, X, Headphones } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
// #5 — save this sheet into the Revision section (dated, printable).
import { addCrib, cribSignature, findCribBySig } from '../lib/cribs.js';
import { Tip } from '../ui/tooltip.jsx';
import { PyqBadge, HighYieldBadge } from '../ui/primitives.jsx';

const CRIB_PRINT_STYLES = `
@media print {
  body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .crib-no-print { display: none !important; }
  .crib-print-page { padding-bottom: 0 !important; }
  .crib-card { page-break-inside: avoid; break-inside: avoid; }
}
`;
import { topicName, topicColor } from '../lib/topics.js';
import { Card, TopBar } from '../ui/primitives.jsx';
import { useListenMode } from '../lib/use-listen-mode.js';
import ListenBar from '../ui/listen-bar.jsx';

// #8 — compose what gets read aloud for one card: stem, answer, explanation.
function composeListenText(q, i) {
  if (!q) return '';
  const ans = (!Array.isArray(q.options) || q.options.length === 0)
    ? (q.answer != null ? `${q.answer}${q.unit ? ' ' + q.unit : ''}` : '')
    : (q.correct || []).map(c => q.options && q.options[c]).filter(Boolean).join(', ');
  const parts = [`Question ${i + 1}.`, q.q];
  if (ans) parts.push(`The answer is: ${ans}.`);
  if (q.exp) parts.push(String(q.exp));
  return parts.filter(Boolean).join(' ');
}
import { HelpfulToggle } from '../ui/question-widgets.jsx';

const WINDOW = 25;

function QuestionCard({ item, num, T, negative, profileId, accent }) {
  const { q, selected, status } = item;
  // Dosage questions are numeric (no options) — render a "your answer vs correct"
  // block instead of the A/B/C/D list.
  const isNumeric = !Array.isArray(q.options) || q.options.length === 0;
  return (
    <Card className="p-4 crib-card" style={{ borderLeft: `3px solid ${accent}`, borderRadius: 12 }}>
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
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <PyqBadge q={q} />
        <HighYieldBadge q={q} />
      </div>
      <div className="text-sm mb-3" style={{ color: T.ink, lineHeight: 1.6 }}>{q.q}</div>

      {/* numeric (dosage) answer block */}
      {isNumeric ? (
        <div className="flex items-stretch gap-2.5 mb-3">
          {selected != null && selected !== '' && (
            <div className="flex-1 rounded-lg px-3 py-2.5"
                 style={{ background: status === 'correct' ? T.successSoft : T.errorSoft,
                          border: `1px solid ${(status === 'correct' ? T.success : T.error)}55`,
                          borderLeft: `3px solid ${status === 'correct' ? T.success : T.error}` }}>
              <div className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: T.muted }}>You gave</div>
              <div className="font-display font-semibold tabular-nums text-sm" style={{ color: status === 'correct' ? T.success : T.error }}>
                {selected}{q.unit ? ` ${q.unit}` : ''}
              </div>
            </div>
          )}
          <div className="flex-1 rounded-lg px-3 py-2.5"
               style={{ background: T.successSoft, border: `1px solid ${T.success}55`, borderLeft: `3px solid ${T.success}` }}>
            <div className="text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: T.muted }}>Correct</div>
            <div className="font-display font-semibold tabular-nums text-sm" style={{ color: T.success }}>
              {q.answer}{q.unit ? ` ${q.unit}` : ''}
            </div>
          </div>
        </div>
      ) : (
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
      )}

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

function CribSheet({ title, subtitle, items, negative = null, profileId = null, savedMode = false, onBack, onHome = null }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const pid = profileId || (profile && profile.id) || 'guest';
  // #5 — save into Revision. PERSISTENTLY one-shot (issues round): the
  // sheet's content signature is checked against the saved shelf on mount,
  // so returning to an already-saved Crib Sheet shows "Added to Revision ✓"
  // (disabled) instead of allowing a duplicate save. addCrib also dedupes
  // server-side-of-truth, so a double-tap can never write twice either.
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
  const sheetSig = useMemo(() => cribSignature(title, items), [title, items]);
  useEffect(() => {
    let alive = true;
    if (savedMode) return; // viewing an already-saved sheet — button hidden
    findCribBySig(pid, sheetSig).then(found => {
      if (alive && found) setSaveState('saved');
    }).catch(() => {});
    return () => { alive = false; };
  }, [pid, sheetSig, savedMode]);
  const saveToRevision = async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    try {
      await addCrib(pid, { title, subtitle, items });
      try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
      setSaveState('saved');
    } catch (e) { setSaveState('idle'); }
  };
  // #5 — print: render EVERYTHING first (the windowed list would otherwise
  // cut the printout short), then hand over to the browser print dialog.
  const printSheet = () => {
    setLimit(items.length);
    setTimeout(() => { try { window.print(); } catch (e) {} }, 120);
  };
  const correct = useMemo(() => items.filter(i => i.status === 'correct'), [items]);
  const wrong = useMemo(() => items.filter(i => i.status === 'wrong'), [items]);
  const na = useMemo(() => items.filter(i => i.status === 'na'), [items]);

  // #8 — Listen mode: read every card aloud, in order, hands-free.
  const listenTexts = useMemo(() => (items || []).map((it, i) => composeListenText(it.q, i)), [items]);
  const listen = useListenMode(listenTexts);

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

  // Floating scroll-to-top — appears once the user is a little way down (long
  // crib sheets scroll a lot; surface it early so getting back up is one tap).
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop((window.scrollY || 0) > 420);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const correctRef = useRef(null);
  const wrongRef = useRef(null);
  const naRef = useRef(null);
  const jump = (ref) => { try { ref.current && ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} };

  const share = async () => {
    // Premium branded share output (issues round): a clean typographic
    // header with the app name + one-line description, well-spaced
    // question/answer blocks, and the URL as a subtle footer — the shared
    // sheet doubles as a high-quality ambassador for the app.
    const RULE = '\u2500'.repeat(26);
    const baseUrl = ((typeof window !== 'undefined' && window.location && window.location.host) || 'norcet-prep.vercel.app');
    const head = [
      `\u2727${RULE}\u2727`,
      '      N O R C E T   P R E P',
      '         Crib Sheet',
      `\u2727${RULE}\u2727`,
      '',
      `${title}${subtitle ? ` \u00b7 ${subtitle}` : ''}`,
      `\u2713 ${correct.length} correct  \u00b7  \u2715 ${wrong.length} wrong  \u00b7  \u2014 ${na.length} skipped`,
      '',
    ];
    const qBlocks = items.slice(0, 50).map((it, i) => {
      const ans = it.q.correct.map(c => `${String.fromCharCode(65 + c)}. ${it.q.options[c] || ''}`).join('  /  ');
      // A blank line sits between the question, the answer and the explanation
      // so each block reads with clear vertical rhythm (issue #10 — the old
      // `.filter(Boolean)` was silently dropping the '' separators, leaving
      // every line stacked tight). Blocks are joined with a full blank line.
      const lines = [`\u2726 Q${i + 1}. ${it.q.q}`, '', `   ANSWER: ${ans}`];
      if (it.q.exp) { lines.push('', `   ${String(it.q.exp).replace(/\n+/g, '\n   ')}`); }
      return lines.join('\n');
    });
    const foot = [
      items.length > 50 ? `\u2026and ${items.length - 50} more questions inside the app.` : null,
      RULE,
      'NORCET Prep \u2014 Free nursing exam prep:',
      'tests, revision notes, PYQs, dosage drills.',
      `\u27a4 ${baseUrl}`,
    ].filter(Boolean);
    const text = [...head, qBlocks.join('\n\n'), '', ...foot].join('\n');
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
    <div ref={refEl} style={{ scrollMarginTop: 'calc(120px + env(safe-area-inset-top, 0px))' }}>
      <div className="sticky z-10 flex items-center gap-2 px-3 py-2 rounded-xl mb-2.5"
           style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))', background: soft, border: `1px solid ${color}30` }}>
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
    <div className="anim-fadeup crib-print-page">
      <style>{CRIB_PRINT_STYLES}</style>
      <div className="crib-no-print">
        <TopBar title="Crib Sheet" onBack={onBack} feedback={{ screen: 'Crib sheet' }}
                right={
                  <div className="flex items-center gap-1">
                  {listen.supported && items.length > 0 && (
                    <Tip text={listen.active ? 'Stop listening' : 'Listen — read this sheet aloud, hands-free'}>
                    <button onClick={() => (listen.active ? listen.stop() : listen.start(0))}
                            aria-label={listen.active ? 'Stop listening' : 'Listen to this sheet'}
                            aria-pressed={listen.active}
                            className="no-tap-highlight p-2 rounded-full active:bg-black/5"
                            style={listen.active ? { color: (T.sec && T.sec.revision) || T.primary } : undefined}>
                      <Headphones size={18} style={listen.active ? undefined : { color: T.muted }} />
                    </button>
                    </Tip>
                  )}
                  <Tip text="Print this sheet, or save it as a PDF from the print dialog">
                  <button onClick={printSheet} aria-label="Print crib sheet"
                          className="no-tap-highlight p-2 rounded-full active:bg-black/5">
                    <Printer size={18} style={{ color: T.muted }} />
                  </button>
                  </Tip>
                  </div>
                } />
      </div>
      <div className="max-w-md mx-auto px-4 pt-2 pb-28">
        {/* PREMIUM RESULTS HEADER (issues round) — clear typographic
            hierarchy, structured score summary and an intentional Add-to-
            Revision action, instead of the old plain metadata list. */}
        <div className="crib-card rounded-2xl overflow-hidden mb-5"
             style={{ background: `linear-gradient(150deg, ${T.primary}14 0%, ${T.surface} 58%)`,
                      border: `1px solid ${T.primary}30`, boxShadow: `0 4px 16px ${T.primary}14` }}>
          <div className="p-4 pb-3.5">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold mb-1" style={{ color: T.primary }}>
              Crib Sheet
            </div>
            <div className="font-display text-2xl font-semibold leading-tight" style={{ color: T.ink }}>{title}</div>
            {subtitle && (
              <div className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: T.muted }}>
                <CalendarDays size={12} className="flex-shrink-0" />
                <span>{subtitle}</span>
              </div>
            )}
          </div>

          {!abandoned && (
            <div className="grid gap-px mx-4 mb-4 rounded-xl overflow-hidden"
                 style={{ gridTemplateColumns: na.length > 0 ? '1fr 1fr 1fr' : '1fr 1fr', background: T.borderSoft, border: `1px solid ${T.borderSoft}` }}>
              <button onClick={() => jump(correctRef)}
                      className="no-tap-highlight py-2.5 text-center active:scale-95 transition"
                      style={{ background: T.successSoft }}>
                <div className="font-display text-lg font-semibold leading-none" style={{ color: T.success }}>{correct.length}</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mt-1" style={{ color: T.success }}>Correct</div>
              </button>
              <button onClick={() => jump(wrongRef)}
                      className="no-tap-highlight py-2.5 text-center active:scale-95 transition"
                      style={{ background: T.errorSoft }}>
                <div className="font-display text-lg font-semibold leading-none" style={{ color: T.error }}>{wrong.length}</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mt-1" style={{ color: T.error }}>Wrong</div>
              </button>
              {na.length > 0 && (
                <button onClick={() => jump(naRef)}
                        className="no-tap-highlight py-2.5 text-center active:scale-95 transition"
                        style={{ background: T.surfaceWarm }}>
                  <div className="font-display text-lg font-semibold leading-none" style={{ color: T.muted }}>{na.length}</div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold mt-1" style={{ color: T.muted }}>Skipped</div>
                </button>
              )}
            </div>
          )}

          {/* #5 — keep this sheet. It lands in Revision → Crib Sheets with
              today's date. Once added it can NEVER be added again for the
              same session — the button locks into its confirmed state. */}
          {!savedMode && (
            <div className="px-4 pb-4 crib-no-print">
              <button onClick={saveToRevision} disabled={saveState !== 'idle'}
                      className="no-tap-highlight w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition"
                      style={saveState === 'saved'
                        ? { background: T.successSoft, color: T.success, border: `1.5px solid ${T.success}50`, cursor: 'default' }
                        : { background: T.primary, color: '#FFF', boxShadow: `0 3px 10px ${T.primary}45` }}>
                {saveState === 'saved'
                  ? (<><Check size={13} /> Added to Revision ✓</>)
                  : (<><BookmarkPlus size={13} /> {saveState === 'saving' ? 'Saving…' : 'Add to Revision (save this sheet)'}</>)}
              </button>
            </div>
          )}
        </div>

        {abandoned && (
          <Card className="p-5 text-center mb-5">
            <div className="text-sm leading-relaxed" style={{ color: T.inkSoft }}>
              Looks like this test wasn't completed — here are all the questions with their answers, whenever you're ready.
            </div>
          </Card>
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
      <div className="crib-no-print fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
           style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-2">
          <button onClick={onBack}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition"
                  style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
            <ChevronLeft size={15} /> {savedMode ? 'Back' : 'Back to results'}
          </button>
          {/* direct route home — one tap, no retracing (issues round) */}
          {onHome && (
            <button onClick={onHome} aria-label="Back to home"
                    className="no-tap-highlight inline-flex items-center justify-center px-3.5 py-2.5 rounded-xl active:scale-95 transition flex-shrink-0"
                    style={{ background: T.surface, color: T.inkSoft, border: `1px solid ${T.border}` }}>
              <Home size={16} />
            </button>
          )}
          <button onClick={share}
                  className="no-tap-highlight flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition"
                  style={{ background: T.primary, color: '#FFF' }}>
            <Share2 size={15} /> Share Crib Sheet
          </button>
        </div>
      </div>

      {/* #8 — Listen player, floated above the action bar */}
      <ListenBar ctl={listen} label="Revision" bottomOffset={76} />

      {/* floating scroll-to-top — premium pill, sits above the action bar */}
      {showTop && (
        <button onClick={() => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }}
                aria-label="Back to top"
                className="crib-no-print no-tap-highlight fixed right-4 z-30 inline-flex items-center gap-1.5 rounded-full pl-3 pr-3.5 py-2.5 active:scale-95 transition-transform anim-fadeup"
                style={{ bottom: 80, background: T.primary, color: '#FFF', boxShadow: `0 8px 24px ${T.primary}66` }}>
          <ArrowUp size={16} />
          <span className="text-xs font-semibold">Top</span>
        </button>
      )}
    </div>
  );
}

export default CribSheet;
