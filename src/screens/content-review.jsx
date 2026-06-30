// Content Review — admin-only screen for the AI question-staging pipeline.
// Lists rows from `questions_staging` (via the content-staging broker), grouped
// into per-topic folders. From a folder the admin can "Approve all as a set" —
// which opens a Save-set page (name / description / visibility) and writes a
// real bank — or, inside a folder, Approve / Delete individual drafts (the
// original per-question flow, kept verbatim: single Approve appends to the
// topic's private `bank:ai-<topic>` holding bank).
// Admin app only — never imported by the student bundle.
import React, { useState, useEffect, useCallback } from 'react';
import {
  Check, Trash2, RefreshCw, AlertTriangle, Sparkles,
  ChevronDown, ChevronRight, Layers, Save, Eye, EyeOff,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button, TopBar, Pill, requestConfirm } from '../ui/primitives.jsx';
import { listStaging, approveStaging, deleteStaging, generateStaging } from '../lib/content-staging.js';
import { saveBank } from '../lib/banks-storage.js';
import { groupStagingByTopic, difficultySpread, buildAiBank } from '../lib/staging-review.js';
import { validateQuestionFields, processQuestionInput } from '../lib/question-import.js';
import { topicName, topicColor, topicIcon } from '../lib/topics.js';

const DIFF_TONE = { easy: '#2F9E44', medium: '#E8590C', hard: '#C2255C' };

// Exam topic ids → names (mirrors scripts/generate.js + the Edge Function allow-list).
const TOPIC_NAMES = {
  fund: 'Fundamentals of Nursing', anat: 'Anatomy & Physiology', msn: 'Medical-Surgical Nursing',
  pharm: 'Pharmacology', peds: 'Pediatric Nursing', obg: 'Obstetrics & Gynaecology',
  ch: 'Community Health', mhn: 'Mental Health Nursing', micro: 'Microbiology', nutr: 'Nutrition',
  gk: 'General Knowledge', apt: 'Reasoning & Aptitude',
};

const folderLabel = (topic) => TOPIC_NAMES[topic] || topicName(topic) || topic;

// ── One AI-draft question card (the original per-question review unit) ──────
function DraftCard({ row, busy, onApprove, onDelete, T }) {
  const correct = Array.isArray(row.correct) ? row.correct : [];
  const wrong = (row.wrong && typeof row.wrong === 'object') ? row.wrong : {};
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <Pill bg={T.primary + '14'} color={T.primary}>{row.topic || '—'}</Pill>
        {row.sub && <Pill bg={T.surfaceWarm} color={T.muted}>{row.sub}</Pill>}
        <Pill bg={T.surfaceWarm} color={T.muted}>{row.type === 'msq' ? 'Multi' : 'Single'}</Pill>
        {row.difficulty && (
          <Pill bg={(DIFF_TONE[row.difficulty] || T.muted) + '1A'} color={DIFF_TONE[row.difficulty] || T.muted}>
            {row.difficulty}
          </Pill>
        )}
      </div>

      <div className="text-sm font-medium mb-2 whitespace-pre-wrap" style={{ color: T.ink }}>{row.q}</div>

      <div className="space-y-1.5 mb-3">
        {(row.options || []).map((opt, i) => {
          const isCorrect = correct.includes(i);
          return (
            <div key={i} className="rounded-lg px-2.5 py-2 text-[13px]"
                 style={{ background: isCorrect ? T.success + '12' : T.surfaceWarm,
                          border: `1px solid ${isCorrect ? T.success + '55' : T.border}` }}>
              <div className="flex items-start gap-2">
                {isCorrect
                  ? <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
                  : <span className="w-3.5 flex-shrink-0" />}
                <span style={{ color: T.ink }}>{opt}</span>
              </div>
              {!isCorrect && wrong[i] && (
                <div className="text-[11px] mt-1 pl-5.5" style={{ color: T.muted }}>{wrong[i]}</div>
              )}
            </div>
          );
        })}
      </div>

      {row.exp && (
        <div className="text-[12px] leading-relaxed mb-2 whitespace-pre-wrap" style={{ color: T.inkSoft }}>
          <span className="font-semibold" style={{ color: T.muted }}>WHY: </span>{row.exp}
        </div>
      )}
      {row.memoryTip && (
        <div className="text-[12px] leading-relaxed mb-3 px-2.5 py-2 rounded-lg"
             style={{ background: T.accent + '10', color: T.inkSoft }}>
          <span className="font-semibold" style={{ color: T.accent }}>TIP: </span>{row.memoryTip}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={() => onApprove(row)} disabled={busy} size="sm" className="flex-1"
                icon={busy ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}>
          Approve
        </Button>
        <button onClick={() => onDelete(row)} disabled={busy}
                className="no-tap-highlight px-3 py-2 rounded-xl text-sm font-semibold active:scale-95 disabled:opacity-50"
                style={{ background: T.error + '12', color: T.error, border: `1px solid ${T.error}33` }}>
          <Trash2 size={15} />
        </button>
      </div>
    </Card>
  );
}

function ContentReview({ onBack, profile }) {
  const { theme: T } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [expanded, setExpanded] = useState(() => new Set()); // expanded topic folders

  // Generate panel state.
  const [genTopic, setGenTopic] = useState('msn');
  const [genCount, setGenCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');

  // Save-set sub-view. `setCtx` non-null → we're on the "Save question set" page.
  const [setCtx, setSetCtx] = useState(null); // { questions, validRows, invalidRows }
  const [setName, setSetName] = useState('');
  const [setDesc, setSetDesc] = useState('');
  const [setVis, setSetVis] = useState('public');
  const [saveErr, setSaveErr] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setErr('');
    try { setRows(await listStaging()); }
    catch (e) { setErr(e.message || 'Could not load the review queue'); setRows([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const toggleFolder = (topic) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(topic)) next.delete(topic); else next.add(topic);
    return next;
  });

  const generate = async () => {
    setGenerating(true); setErr(''); setGenMsg('');
    try {
      const { inserted } = await generateStaging(genTopic, genCount);
      setGenMsg(`Added ${inserted} draft${inserted === 1 ? '' : 's'} to the queue.`);
      setExpanded(prev => new Set(prev).add(genTopic)); // reveal the topic that just grew
      await refresh();
    } catch (e) {
      setErr(e.message || 'Generation failed — try again');
    } finally { setGenerating(false); }
  };

  // Per-question approve — unchanged: appends the single draft to the topic's
  // private holding bank `bank:ai-<topic>` (publish it later from the Library).
  const approve = async (row) => {
    const bankKey = `bank:ai-${row.topic || 'misc'}`;
    setBusyId(row.id); setErr('');
    try {
      await approveStaging(row.id, bankKey);
      setRows(prev => prev.filter(r => r.id !== row.id)); // instant, no reload
    } catch (e) { setErr(e.message || 'Approve failed'); }
    finally { setBusyId(null); }
  };

  const confirmDelete = (row) => requestConfirm({
    icon: <Trash2 size={20} style={{ color: T.error }} />,
    title: 'Delete this draft?',
    body: 'Removes it from the review queue permanently. It is not added to any bank.',
    confirmLabel: 'Delete', cancelLabel: 'Cancel', tone: 'danger',
    onConfirm: async () => {
      setBusyId(row.id); setErr('');
      try { await deleteStaging(row.id); setRows(prev => prev.filter(r => r.id !== row.id)); }
      catch (e) { setErr(e.message || 'Delete failed'); }
      finally { setBusyId(null); }
    },
  });

  // Open the Save-set page for a folder: normalize the drafts into canonical
  // questions (the same parse/validate path as a bank upload), splitting off any
  // that fail validation so a bad draft never blocks the rest.
  const openSetFromFolder = (folderRows, topic) => {
    const validRows = [], invalidRows = [];
    for (const r of folderRows) {
      (validateQuestionFields(r).length === 0 ? validRows : invalidRows).push(r);
    }
    const { valid: questions } = processQuestionInput(JSON.stringify(validRows), 'json', 'ai');
    setSetCtx({ questions, validRows, invalidRows });
    setSetName(`${folderLabel(topic)} — AI set`);
    setSetDesc('');
    setSetVis('public');
    setSaveErr('');
    setOkMsg('');
  };

  const closeSet = () => { setSetCtx(null); setSaveErr(''); };

  // Save the approved batch as a real bank, then clear its source drafts from
  // the staging queue. A public set is live for students immediately (same as a
  // hand-uploaded public bank); a private one is only visible to admins.
  const saveSet = async () => {
    setSaveErr('');
    if (!setName.trim()) { setSaveErr('Give the set a name first'); return; }
    if (!setCtx || setCtx.questions.length === 0) { setSaveErr('No valid questions to save'); return; }
    setSaving(true);
    try {
      const bank = buildAiBank({
        name: setName, description: setDesc, visibility: setVis,
        questions: setCtx.questions, profile,
      });
      await saveBank(bank);
      // Best-effort clear of the source drafts; any that fail stay in the queue.
      await Promise.allSettled(setCtx.validRows.map(r => deleteStaging(r.id)));
      const n = bank.questions.length;
      setOkMsg(`Saved "${bank.name}" — ${n} question${n === 1 ? '' : 's'}${setVis === 'public' ? ' · live for students' : ' · private'}.`);
      setSetCtx(null);
      await refresh();
    } catch (e) {
      setSaveErr(e.message || 'Could not save the set');
    } finally { setSaving(false); }
  };

  // ─────────────────────────────── Save-set page ───────────────────────────
  if (setCtx) {
    const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };
    const n = setCtx.questions.length;
    return (
      <div className="anim-fadeup">
        <TopBar title="Save question set" onBack={closeSet} />
        <div className="max-w-md mx-auto px-4 pb-32 pt-2">
          <div className="text-xs leading-relaxed mb-4 px-1" style={{ color: T.muted }}>
            Review the details, then save these approved drafts as a question set.
            A <strong>public</strong> set goes live for students right away.
          </div>

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Set name</div>
          <input value={setName} onChange={e => setSetName(e.target.value)}
                 placeholder="e.g. Medical-Surgical Nursing — AI set"
                 className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle} />

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Description (optional)</div>
          <textarea value={setDesc} onChange={e => setSetDesc(e.target.value)}
                    placeholder="What's in this set?" rows={2}
                    className="w-full rounded-xl px-4 py-3 mb-4 text-sm resize-none" style={inputStyle} />

          <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Visibility</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[
              { val: 'public', icon: <Eye size={16} />, title: 'Public', desc: 'Everyone can browse & import' },
              { val: 'private', icon: <EyeOff size={16} />, title: 'Private', desc: 'Only you can see & use it' },
            ].map(opt => {
              const active = setVis === opt.val;
              return (
                <button key={opt.val} onClick={() => setSetVis(opt.val)}
                        className="no-tap-highlight text-left p-3 rounded-xl transition-all"
                        style={{
                          background: active ? (opt.val === 'private' ? T.accent + '12' : T.success + '12') : T.surface,
                          border: `1.5px solid ${active ? (opt.val === 'private' ? T.accent : T.success) : T.border}`,
                          color: T.ink,
                        }}>
                  <div className="flex items-center gap-1.5 mb-1"
                       style={{ color: active ? (opt.val === 'private' ? T.accent : T.success) : T.muted }}>
                    {opt.icon}
                    <span className="font-display text-sm font-semibold">{opt.title}</span>
                  </div>
                  <div className="text-[11px] leading-snug" style={{ color: T.muted }}>{opt.desc}</div>
                </button>
              );
            })}
          </div>
          <div className="text-[11px] mb-4 px-1 leading-relaxed" style={{ color: T.muted }}>
            You can switch this anytime from the bank's page in the Library.
          </div>

          <Card className="p-3 mb-3" style={{ background: n > 0 ? T.successSoft : T.surfaceWarm }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>Questions in this set</div>
            <div className="font-display text-2xl font-semibold" style={{ color: n > 0 ? T.success : T.muted }}>{n}</div>
          </Card>

          {setCtx.invalidRows.length > 0 && (
            <Card className="p-3 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
              <div className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
                <div>
                  {setCtx.invalidRows.length} draft{setCtx.invalidRows.length === 1 ? '' : 's'} couldn't be added
                  (failed validation) and will be left in the review queue.
                </div>
              </div>
            </Card>
          )}

          {n > 0 && (
            <details className="mb-3">
              <summary className="no-tap-highlight cursor-pointer text-xs uppercase tracking-wider font-semibold pb-2"
                       style={{ color: T.muted }}>
                Preview questions ({n})
              </summary>
              <div className="space-y-1.5 max-h-64 overflow-y-auto mt-1">
                {setCtx.questions.map((q, i) => (
                  <div key={q.id || i} className="flex items-start gap-2 p-2 rounded-lg"
                       style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                    <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: T.muted }}>{i + 1}.</span>
                    <div className="flex-1 text-xs leading-snug" style={{ color: T.inkSoft }}>{q.q}</div>
                  </div>
                ))}
              </div>
            </details>
          )}

          {saveErr && (
            <Card className="p-3 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
              <div className="flex items-start gap-2 text-sm" style={{ color: T.error }}>
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><div>{saveErr}</div>
              </div>
            </Card>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3"
             style={{ background: T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={saveSet} disabled={saving || !setName.trim() || n === 0} size="lg" className="w-full"
                    icon={saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}>
              {saving ? 'Saving…' : `Save question set (${n})`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────── Queue list ──────────────────────────────
  const groups = groupStagingByTopic(rows);

  return (
    <div className="anim-fadeup">
      <TopBar title="Content Review" onBack={onBack}
              right={
                <button onClick={refresh} disabled={loading} aria-label="Refresh"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                  <RefreshCw size={18} style={{ color: T.muted }} className={loading ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-28 pt-2">
        <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
          AI-drafted questions awaiting review, grouped by topic. <strong>Approve all as a set</strong> bundles
          a whole topic into a question set you name and publish. Or open a folder to <strong>Approve</strong>
          {' '}(adds to that topic's private <code>bank:ai-&lt;topic&gt;</code>) or <strong>Delete</strong> single drafts.
        </div>

        {/* ---- Generate panel ---- */}
        <Card className="p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} style={{ color: T.primary }} />
            <div className="font-display text-sm" style={{ color: T.ink }}>Generate questions</div>
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
              Topic
              <select
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                disabled={generating}
                className="mt-1 w-full rounded-xl px-3 py-2 text-sm font-normal normal-case tracking-normal disabled:opacity-50"
                style={{ background: T.surfaceWarm, color: T.ink, border: `1px solid ${T.border}` }}
              >
                {Object.entries(TOPIC_NAMES).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>How many</span>
              <div className="flex gap-1.5">
                {[3, 5].map((num) => {
                  const on = genCount === num;
                  return (
                    <button key={num} onClick={() => setGenCount(num)} disabled={generating}
                            className="no-tap-highlight px-3 py-1.5 rounded-lg text-sm font-semibold active:scale-95 disabled:opacity-50"
                            style={{ background: on ? T.primary : T.surfaceWarm,
                                     color: on ? '#fff' : T.muted,
                                     border: `1px solid ${on ? T.primary : T.border}` }}>
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={generate} disabled={generating}
                    icon={generating ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}>
              {generating ? 'Generating… (~20s)' : `Generate ${genCount}`}
            </Button>

            {genMsg && (
              <div className="text-[12px] flex items-center gap-1.5" style={{ color: T.success }}>
                <Check size={13} /> {genMsg}
              </div>
            )}
          </div>
        </Card>

        {okMsg && (
          <Card className="p-3 mb-3" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-start gap-2 text-sm" style={{ color: T.inkSoft }}>
              <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
              <div className="flex-1">{okMsg}</div>
              <button onClick={() => setOkMsg('')} className="no-tap-highlight p-1 -m-1 text-sm leading-none"
                      style={{ color: T.muted }} aria-label="Dismiss">✕</button>
            </div>
          </Card>
        )}

        {err && (
          <Card className="p-3 mb-3" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <div className="flex items-start gap-2 text-sm" style={{ color: T.error }}>
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><div>{err}</div>
            </div>
          </Card>
        )}

        {loading ? (
          <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center">
            <Sparkles size={32} className="mx-auto mb-3" style={{ color: T.primary, opacity: 0.6 }} />
            <div className="font-display text-base mb-0.5" style={{ color: T.ink }}>Queue empty</div>
            <div className="text-sm" style={{ color: T.muted }}>
              Use <strong>Generate questions</strong> above to draft a new batch for review.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map(({ topic, rows: folderRows }) => {
              const open = expanded.has(topic);
              const spread = difficultySpread(folderRows);
              const tColor = topicColor(topic);
              return (
                <div key={topic}>
                  {/* Folder header — detailed row card */}
                  <Card className="p-3.5" style={{ borderColor: tColor + '55' }}>
                    <button onClick={() => toggleFolder(topic)}
                            className="no-tap-highlight w-full flex items-center gap-2.5 text-left">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                           style={{ background: tColor + '18' }}>
                        {topicIcon(topic)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm font-semibold truncate" style={{ color: T.ink }}>
                          {folderLabel(topic)}
                        </div>
                        <div className="text-[11px]" style={{ color: T.muted }}>
                          {folderRows.length} draft{folderRows.length === 1 ? '' : 's'} awaiting review
                        </div>
                      </div>
                      {open ? <ChevronDown size={18} style={{ color: T.muted }} />
                            : <ChevronRight size={18} style={{ color: T.muted }} />}
                    </button>

                    {/* Difficulty spread */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {['easy', 'medium', 'hard'].map(d => spread[d] > 0 && (
                        <Pill key={d} bg={DIFF_TONE[d] + '1A'} color={DIFF_TONE[d]}>{spread[d]} {d}</Pill>
                      ))}
                      {spread.other > 0 && <Pill bg={T.surfaceWarm} color={T.muted}>{spread.other} other</Pill>}
                    </div>

                    <Button onClick={() => openSetFromFolder(folderRows, topic)} size="sm" className="w-full mt-3"
                            icon={<Layers size={15} />}>
                      Approve all as a set ({folderRows.length})
                    </Button>
                  </Card>

                  {/* Expanded: the individual drafts (original per-question flow) */}
                  {open && (
                    <div className="space-y-3 mt-2 ml-1 pl-3" style={{ borderLeft: `2px solid ${tColor}33` }}>
                      {folderRows.map(row => (
                        <DraftCard key={row.id} row={row} busy={busyId === row.id}
                                   onApprove={approve} onDelete={confirmDelete} T={T} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContentReview;
