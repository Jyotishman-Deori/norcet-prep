// =====================================================================
// src/screens/mistake-vault.jsx — THE MISTAKE VAULT (blueprint M5/M6).
// Every question the user has ever answered wrong, derived live from
// history (lib/mistakes.js) — no separate store to drift. Two shelves:
//   • Review queue — unresolved mistakes, due-now first (rides the
//     existing spaced-repetition nextDue), each expandable to "you
//     answered X → correct is Y" with a coach note (lib/explain-mock.js,
//     simulated-delay local composer — no AI, per the house rule).
//   • Fixed — mistakes resolved by answering right twice in a row
//     (reviewCount streak); a later wrong answer moves them back.
// "Review now" launches the existing untimed explicit-id quiz mode; the
// resolve state then updates by itself through normal history writes.
//
// FREEMIUM: behind the same (default-off) cribVault gate as saved cribs.
// Locked = count-only teaser + the PremiumCribSheetModal — the local
// equivalent of the blueprint's "403 + {total_unresolved_mistakes}".
// =====================================================================
import React, { useMemo, useState } from 'react';
import {
  Play, ChevronRight, Check, X as XIcon, Sparkles, Lock, Clock, ShieldCheck,
} from 'lucide-react';
import { useTheme, useData, useProfile } from '../lib/app-context.jsx';
import { topicIcon, topicName } from '../lib/topics.js';
import { TopBar, Card } from '../ui/primitives.jsx';
import { haptic } from '../lib/juice.js';
import { buildMistakes, unresolvedCount, orderMistakeQueue } from '../lib/mistakes.js';
import { explainMistake, EXPLAIN_DISCLOSURE } from '../lib/explain-mock.js';
import { cribVaultLocked } from '../lib/premium.js';
import PremiumCribSheetModal from '../ui/premium-gate-modal.jsx';

const REVIEW_CAP = 20; // most mistakes handed to one review round

export default function MistakeVault({ onBack, onStartReview, onOpenPremium }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const { profile } = useProfile();

  const mistakes = useMemo(
    () => buildMistakes((data && data.history) || {}, allQuestions),
    [data && data.history, allQuestions]
  );
  const queue = useMemo(() => orderMistakeQueue(mistakes), [mistakes]);
  const fixed = useMemo(() => mistakes.filter(m => m.resolved), [mistakes]);
  const unresolved = queue.length;
  const dueNow = useMemo(() => {
    const now = Date.now();
    return queue.filter(m => m.nextDue && Date.parse(m.nextDue) <= now).length;
  }, [queue]);

  const locked = cribVaultLocked(profile);
  const [gateOpen, setGateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [showFixed, setShowFixed] = useState(false);
  // qId -> { loading, text } for the coach notes.
  const [coach, setCoach] = useState({});

  const explain = async (m) => {
    haptic(5);
    setCoach(c => ({ ...c, [m.qId]: { loading: true, text: '' } }));
    const { text } = await explainMistake({ question: m.question, pick: m.lastPick });
    setCoach(c => ({ ...c, [m.qId]: { loading: false, text } }));
  };

  const startReview = () => {
    if (!queue.length) return;
    haptic(12);
    onStartReview(queue.slice(0, REVIEW_CAP).map(m => m.qId));
  };

  const Stat = ({ value, label, color }) => (
    <div className="flex-1 rounded-2xl px-3 py-3 text-center" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div className="font-display text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: T.muted }}>{label}</div>
    </div>
  );

  const Row = ({ m, i }) => {
    const q = m.question;
    const expanded = expandedId === m.qId;
    const options = Array.isArray(q.options) ? q.options : [];
    const yourText = (m.lastPick || []).map(ix => options[ix]).filter(Boolean).join(' + ');
    const correctText = (Array.isArray(q.correct) ? q.correct : []).map(ix => options[ix]).filter(Boolean).join(' + ');
    const isDue = m.nextDue && Date.parse(m.nextDue) <= Date.now();
    const note = coach[m.qId];
    return (
      <div className="search-row-in rounded-2xl overflow-hidden"
           style={{ background: T.surface, border: `1px solid ${expanded ? T.primary + '55' : T.border}`,
                    animationDelay: `${Math.min(i, 8) * 35}ms` }}>
        <button onClick={() => { haptic(5); setExpandedId(expanded ? null : m.qId); }}
                className="no-tap-highlight press-safe w-full flex items-start gap-3 px-3.5 py-3 text-left active:scale-[0.99] transition-transform">
          <span className="w-8 h-8 mt-0.5 rounded-full flex-shrink-0 flex items-center justify-center text-sm"
                style={{ background: T.errorSoft }}>
            {topicIcon(q.topic) || '❓'}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium leading-snug" style={{ color: T.ink }}>{q.q}</span>
            <span className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: T.errorSoft, color: T.error }}>
                wrong ×{m.failCount}
              </span>
              {isDue && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: T.accentSoft, color: T.accent }}>
                  <Clock size={9} /> due now
                </span>
              )}
              <span className="text-[10px]" style={{ color: T.muted }}>{topicName(q.topic)}</span>
            </span>
          </span>
          <ChevronRight size={15} className={`mt-1 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                        style={{ color: T.muted }} />
        </button>
        {expanded && (
          <div className="px-3.5 pb-3.5 anim-fadeup">
            <div className="space-y-1.5 mb-3">
              {yourText ? (
                <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
                     style={{ background: T.errorSoft, border: `1px solid ${T.error}44`, color: T.error }}>
                  <XIcon size={13} className="mt-[1px] flex-shrink-0" />
                  <span className="min-w-0"><span className="font-semibold">You answered:</span> {yourText}</span>
                </div>
              ) : (
                <div className="rounded-xl px-3 py-2 text-xs" style={{ background: T.surfaceWarm, color: T.muted }}>
                  Your last answer wasn’t recorded (timed out or older history).
                </div>
              )}
              <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
                   style={{ background: T.successSoft, border: `1px solid ${T.success}44`, color: T.success }}>
                <Check size={13} className="mt-[1px] flex-shrink-0" />
                <span className="min-w-0 font-semibold">Correct: <span className="font-normal">{correctText}</span></span>
              </div>
            </div>
            {!note && (
              <button onClick={() => explain(m)}
                      className="no-tap-highlight w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold active:scale-[0.98] transition-transform"
                      style={{ background: T.primary + '12', color: T.primary, border: `1px solid ${T.primary}33` }}>
                <Sparkles size={13} />
                Explain my mistake
              </button>
            )}
            {note && note.loading && (
              <div className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-xs" style={{ background: T.surfaceWarm, color: T.muted }}>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: T.primary, borderTopColor: 'transparent' }} />
                Putting your coach note together…
              </div>
            )}
            {note && !note.loading && (
              <div className="anim-fadeup">
                <div className="text-xs leading-relaxed rounded-xl px-3 py-2.5"
                     style={{ background: T.surfaceWarm, color: T.inkSoft, whiteSpace: 'pre-wrap' }}>
                  {note.text}
                </div>
                <div className="text-[10px] mt-1.5 px-1" style={{ color: T.muted }}>{EXPLAIN_DISCLOSURE}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Mistake Vault" onBack={onBack} feedback={{ screen: 'Mistake Vault' }} />
      <div className="max-w-md md:max-w-2xl mx-auto px-4 pb-8 pt-2">

        {locked ? (
          <>
            {/* Count-only teaser — the local "403 + metadata" equivalent. */}
            <div className="text-center py-12 px-4 rounded-2xl" style={{ background: T.surface, border: `1px dashed ${T.border}` }}>
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: T.primary + '15' }}>
                <Lock size={20} style={{ color: T.primary }} />
              </div>
              <div className="font-display text-lg mb-1" style={{ color: T.ink }}>The Vault is Premium</div>
              <div className="text-sm leading-relaxed px-2" style={{ color: T.muted }}>
                Post-test review is always free. Keeping every mistake until you fix it is a Premium perk.
              </div>
              <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-bold"
                   style={{ background: T.primary + '15', color: T.primary }}>
                {unresolvedCount(mistakes)} unresolved mistake{unresolvedCount(mistakes) === 1 ? '' : 's'} inside
              </div>
              <button onClick={() => setGateOpen(true)}
                      className="no-tap-highlight mt-4 w-full max-w-xs mx-auto flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold active:scale-[0.98] transition-transform"
                      style={{ background: T.primary, color: '#FFF', boxShadow: `0 6px 18px ${T.primary}44` }}>
                Open my Vault
              </button>
            </div>
            <PremiumCribSheetModal open={gateOpen} count={unresolvedCount(mistakes)}
                                   onClose={() => setGateOpen(false)}
                                   onUpgrade={() => { setGateOpen(false); onOpenPremium && onOpenPremium(); }} />
          </>
        ) : (
          <>
            {/* Stats band */}
            <div className="flex gap-2 mb-4">
              <Stat value={unresolved} label="To fix" color={T.error} />
              <Stat value={dueNow} label="Due now" color={T.accent} />
              <Stat value={fixed.length} label="Fixed" color={T.success} />
            </div>

            {unresolved > 0 && (
              <button onClick={startReview}
                      className="no-tap-highlight w-full mb-4 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold active:scale-[0.98] transition-transform"
                      style={{ background: T.primary, color: '#FFF', boxShadow: `0 6px 18px ${T.primary}44` }}>
                <Play size={16} fill="#FFF" />
                Review {Math.min(unresolved, REVIEW_CAP)} mistake{Math.min(unresolved, REVIEW_CAP) === 1 ? '' : 's'} now
              </button>
            )}

            {/* Queue */}
            {unresolved > 0 ? (
              <div className="space-y-2">
                {queue.map((m, i) => <Row key={m.qId} m={m} i={i} />)}
              </div>
            ) : (
              <div className="text-center py-12">
                <ShieldCheck size={36} className="mx-auto mb-3" style={{ color: T.success, opacity: 0.5 }} />
                <div className="font-display text-lg mb-1" style={{ color: T.ink }}>
                  {fixed.length > 0 ? 'Vault cleared — every mistake fixed!' : 'No mistakes recorded yet'}
                </div>
                <div className="text-sm leading-relaxed px-6" style={{ color: T.muted }}>
                  {fixed.length > 0
                    ? 'New wrong answers will land here automatically so you can fix them too.'
                    : 'Answer questions anywhere in the app — anything you get wrong is saved here to review until it sticks.'}
                </div>
              </div>
            )}

            {/* Fixed shelf */}
            {fixed.length > 0 && (
              <div className="mt-6">
                <button onClick={() => setShowFixed(s => !s)}
                        className="no-tap-highlight w-full flex items-center justify-between px-1 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: T.inkSoft }}>
                    <Check size={14} style={{ color: T.success }} />
                    Fixed ({fixed.length})
                  </span>
                  <ChevronRight size={15} className={`transition-transform duration-200 ${showFixed ? 'rotate-90' : ''}`}
                                style={{ color: T.muted }} />
                </button>
                {showFixed && (
                  <div className="space-y-2 mt-1">
                    {fixed.map((m, i) => (
                      <Card key={m.qId} className="px-3.5 py-3 flex items-start gap-3" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                        <span className="vault-tick-in w-6 h-6 mt-0.5 rounded-full flex-shrink-0 flex items-center justify-center"
                              style={{ background: T.successSoft }}>
                          <Check size={13} style={{ color: T.success }} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm leading-snug line-through" style={{ color: T.muted }}>{m.question.q}</span>
                          <span className="block text-[10px] mt-1" style={{ color: T.muted }}>
                            was wrong ×{m.failCount} · {topicName(m.question.topic)}
                          </span>
                        </span>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
