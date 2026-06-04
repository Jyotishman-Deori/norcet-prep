// [A1 slice 44] Question-bank detail + editor pair. Extracted VERBATIM from
// App.jsx (one inserted A7 hook line per component). They are the bank
// view/import screen (BankDetail) and the admin create/edit screen
// (BankEditor), contiguous in App and conceptually paired (the library flow
// opens one or the other). The two single-consumer example-payload constants
// EXAMPLE_QUESTIONS_JSON / EXAMPLE_QUESTIONS_CSV (used only by BankEditor's
// "paste an example" button) move in with the editor.
//
// A7: both were bare-T readers that also read IS_DARK (the fixed-footer
// translucency) -> `const { theme: T, isDark: IS_DARK } = useTheme();`. No
// data/setData context — isAdmin/isOwner (BankDetail) and profile (BankEditor)
// stay PROPS. No fgOnDark, no fontStyles. Two render sites in App (the
// 'bank-detail' and 'bank-editor' routes) are UNCHANGED.
import React, { useState } from 'react';
import {
  AlertCircle, AlertTriangle, Check, X, Download, Edit3, Eye, EyeOff,
  Layers, Plus, RefreshCw, Save, Trash2
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Pill, Card, Button, TopBar } from '../ui/primitives.jsx';
import { newBankId, bankVisibility } from '../lib/banks.js';
import { topicName, topicColor, topicIcon } from '../lib/topics.js';
import { processQuestionInput, validateQuestionFields } from '../lib/question-import.js';

// Single-consumer example payloads (used only by BankEditor's "paste an
// example" button) — moved here VERBATIM with the editor.
const EXAMPLE_QUESTIONS_JSON = JSON.stringify([
  {
    q: "What is the normal adult resting pulse rate?",
    type: "mcq",
    topic: "fund",
    sub: "Vital Signs",
    options: ["40-60 bpm", "60-100 bpm", "100-120 bpm", "120-140 bpm"],
    correct: [1],
    exp: "Normal adult resting pulse is 60-100 bpm.",
    wrong: { "0": "Bradycardia", "2": "Mild tachycardia", "3": "Significant tachycardia" },
    difficulty: "easy",
    source: "NORCET 2023 PYQ"
  },
  {
    q: "Which are signs of digoxin toxicity? (Select all that apply)",
    type: "msq",
    topic: "pharm",
    options: ["Yellow halos", "Bradycardia", "Nausea", "Hypertension"],
    correct: [0, 1, 2],
    exp: "Digoxin toxicity: visual disturbances, bradycardia, GI symptoms.",
    wrong: { "3": "Hypertension is not a digoxin toxicity feature." },
    difficulty: "medium",
    source: "Park textbook"
  },
  {
    // P17 — image-based example. `image` is OPTIONAL: a public URL (host in a
    // Supabase `pyq-images` bucket) or, as here, an inline data URI for a quick
    // test. The figure renders between the stem and the options.
    q: "Identify the figure shown above.",
    type: "mcq",
    topic: "fund",
    sub: "Equipment",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120'%3E%3Crect width='240' height='120' rx='10' fill='%23e9e2d4'/%3E%3Ctext x='120' y='66' font-size='15' text-anchor='middle' fill='%23555' font-family='sans-serif'%3ESample figure%3C/text%3E%3C/svg%3E",
    options: ["Sample figure", "ECG strip", "Chest X-ray", "Suction catheter"],
    correct: [0],
    exp: "This is a placeholder figure — replace `image` with your hosted PYQ image URL.",
    difficulty: "easy",
    source: "Image demo"
  }
], null, 2);

const EXAMPLE_QUESTIONS_CSV = `q,type,topic,sub,options,correct,exp,wrong,difficulty,source,image
"Normal adult pulse rate?",mcq,fund,Vital Signs,"40-60 bpm|60-100 bpm|100-120 bpm|120-140 bpm","1","Normal adult pulse is 60-100 bpm.","0:Bradycardia;2:Mild tachycardia;3:Significant tachycardia",easy,"NORCET 2023 PYQ",
"Signs of digoxin toxicity?",msq,pharm,Cardiac,"Yellow halos|Bradycardia|Nausea|Hypertension","0,1,2","Visual + brady + GI.","3:HTN is not digoxin toxicity",medium,"Park textbook",
"Identify the instrument shown above.",mcq,fund,Equipment,"Laryngoscope|Otoscope|Ophthalmoscope|Stethoscope","0","Replace the image URL with your hosted PYQ image.","",easy,"Image demo","https://YOUR-PROJECT.supabase.co/storage/v1/object/public/pyq-images/example.png"`;

function BankDetail({ bank, isAdmin, isOwner, canToggleVisibility, alreadyImported, isDisabled, onImport, onUpdate, onEdit, onDelete, onToggleVisibility, onToggleEnabled, onBack }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [visBusy, setVisBusy] = useState(false);
  const date = bank.updatedAt ? new Date(bank.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  const previewQ = bank.questions[previewIndex];
  const priv = bankVisibility(bank) === 'private';
  const ownerLabel = isOwner ? 'You' : (bank.ownerName || 'Admin');

  const toggleVis = async () => {
    if (visBusy) return;
    setVisBusy(true);
    await onToggleVisibility(priv ? 'public' : 'private');
    setVisBusy(false);
  };

  return (
    <div className="anim-fadeup">
      <TopBar title={bank.name} onBack={onBack} feedback={{ screen: "Bank detail" }} />
      <div className="max-w-md mx-auto px-4 pb-32 pt-2">

        <Card className="p-4 mb-4" style={{ background: T.primary, border: 'none' }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="font-display text-xl font-semibold leading-tight" style={{ color: '#FFF' }}>{bank.name}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#FFF' }}>v{bank.version}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(255,255,255,0.18)', color: '#FFF' }}>
              {priv ? <EyeOff size={10} /> : <Eye size={10} />}
              {priv ? 'Private' : 'Public'}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>by {ownerLabel}</span>
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {bank.questions.length} question{bank.questions.length === 1 ? '' : 's'}
            {date && ` · updated ${date}`}
          </div>
          {bank.description && (
            <div className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{bank.description}</div>
          )}
        </Card>

        {/* Import status */}
        {alreadyImported.count > 0 && (
          <Card className="p-3 mb-3" style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-start gap-2.5">
              <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                You've imported {alreadyImported.count} question{alreadyImported.count === 1 ? '' : 's'} from this bank
                {alreadyImported.version && ` (v${alreadyImported.version})`}.
                {alreadyImported.version && alreadyImported.version < bank.version &&
                  <span style={{ color: T.accent, fontWeight: 600 }}> A newer version is available — tap "Update" to refresh.</span>}
              </div>
            </div>
          </Card>
        )}

        {/* Active / paused toggle. Only meaningful once she's imported the bank. */}
        {alreadyImported.count > 0 && onToggleEnabled && (
          <Card className="p-4 mb-3 cursor-pointer no-tap-highlight pressable"
                onClick={() => onToggleEnabled(isDisabled)}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: isDisabled ? T.surfaceWarm : T.success + '20' }}>
                  {isDisabled
                    ? <EyeOff size={16} style={{ color: T.muted }} />
                    : <Check size={16} style={{ color: T.success }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm" style={{ color: T.ink }}>
                    Use these questions in my practice
                  </div>
                  <div className="text-[11px] mt-0.5 leading-snug" style={{ color: T.muted }}>
                    {isDisabled
                      ? 'Paused — these questions are hidden from quizzes, drills, and stats. Your progress is kept.'
                      : 'Active — questions appear across Quick test, topics, and stats.'}
                  </div>
                </div>
              </div>
              {/* Switch — same visual pattern as the dark-mode toggle. */}
              <div className="w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
                   style={{ background: isDisabled ? T.border : T.success }}>
                <div className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                     style={{ transform: isDisabled ? 'translateX(0px)' : 'translateX(20px)' }} />
              </div>
            </div>
          </Card>
        )}

        {/* Preview */}
        {previewQ && (
          <Card className="p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>Preview</div>
              <div className="text-xs tabular-nums" style={{ color: T.muted }}>{previewIndex + 1} / {bank.questions.length}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <Pill bg={topicColor(previewQ.topic) + '15'} color={topicColor(previewQ.topic)}>
                {topicIcon(previewQ.topic)} {topicName(previewQ.topic)}
              </Pill>
              {previewQ.sub && <Pill bg={T.surfaceWarm} color={T.inkSoft}>{previewQ.sub}</Pill>}
            </div>
            <div className="text-sm leading-snug" style={{ color: T.ink }}>{previewQ.q}</div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))} disabled={previewIndex === 0}
                      className="no-tap-highlight flex-1 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                ← Prev
              </button>
              <button onClick={() => setPreviewIndex(Math.min(bank.questions.length - 1, previewIndex + 1))}
                      disabled={previewIndex === bank.questions.length - 1}
                      className="no-tap-highlight flex-1 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
                      style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                Next →
              </button>
            </div>
          </Card>
        )}

        {/* Visibility control — owner (their own bank) or admin (any bank) */}
        {canToggleVisibility && (
          <Card className="p-4 mt-6 mb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm" style={{ color: T.ink }}>Visibility</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                  {priv
                    ? 'Private — only you' + (isAdmin && !isOwner ? ' (the owner)' : '') + ' can see and use it.'
                    : 'Public — everyone can browse, import, and practise it.'}
                </div>
              </div>
              <button onClick={toggleVis} disabled={visBusy}
                      className="no-tap-highlight flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 disabled:opacity-50"
                      style={{ background: priv ? T.success : T.surfaceWarm, color: priv ? '#FFF' : T.ink, border: `1px solid ${priv ? T.success : T.border}` }}>
                {visBusy ? <RefreshCw size={14} className="animate-spin" /> : (priv ? <Eye size={14} /> : <EyeOff size={14} />)}
                {priv ? 'Make public' : 'Make private'}
              </button>
            </div>
            {isAdmin && !isOwner && (
              <div className="text-[11px] mt-2.5 pt-2.5 border-t" style={{ color: T.muted, borderColor: T.borderSoft }}>
                You're changing another user's bank as admin.
              </div>
            )}
          </Card>
        )}

        {/* Edit / delete — ADMIN ONLY (any bank) */}
        {isAdmin && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Admin · edit & delete</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Card className="p-3 cursor-pointer no-tap-highlight pressable" onClick={onEdit}>
                <Edit3 size={16} style={{ color: T.primary }} />
                <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Edit bank</div>
                <div className="text-[10px]" style={{ color: T.muted }}>Update name or questions (bumps version)</div>
              </Card>
              <Card className="p-3 cursor-pointer no-tap-highlight pressable" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} style={{ color: T.error }} />
                <div className="font-display text-sm font-semibold mt-2" style={{ color: T.ink }}>Delete bank</div>
                <div className="text-[10px]" style={{ color: T.muted }}>Remove for everyone</div>
              </Card>
            </div>
          </div>
        )}

        {/* Owner (non-admin) note */}
        {isOwner && !isAdmin && (
          <div className="text-[11px] mt-3 leading-relaxed px-1" style={{ color: T.muted }}>
            This is your bank — you can change its visibility above. Only an admin can edit its questions or delete it.
          </div>
        )}
      </div>

      {/* Bottom import bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto flex gap-2">
          {alreadyImported.count > 0 && alreadyImported.version && alreadyImported.version < bank.version ? (
            <Button onClick={onUpdate} size="lg" className="flex-1" icon={<RefreshCw size={18} />}>
              Update to v{bank.version}
            </Button>
          ) : alreadyImported.count > 0 ? (
            <Button onClick={onImport} variant="ghost" size="lg" className="flex-1" icon={<Plus size={18} />}>
              Import again
            </Button>
          ) : (
            <Button onClick={onImport} size="lg" className="flex-1" icon={<Download size={18} />}>
              Import {bank.questions.length} question{bank.questions.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setConfirmDelete(false)}>
          <Card className="p-5 max-w-sm w-full anim-scalein" onClick={e => e.stopPropagation()}>
            <div className="font-display text-xl font-semibold mb-2" style={{ color: T.ink }}>Delete "{bank.name}"?</div>
            <div className="text-sm mb-4 leading-relaxed" style={{ color: T.muted }}>
              This removes the bank for everyone, immediately. Users who have already imported its questions keep their copies.
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} className="flex-1">Cancel</Button>
              <Button variant="accent" onClick={() => { setConfirmDelete(false); onDelete(); }} className="flex-1">Delete</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function BankEditor({ existingBank, profile, onSave, onBack }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const isEdit = !!existingBank;
  const [name, setName] = useState(existingBank ? existingBank.name : '');
  const [description, setDescription] = useState(existingBank ? (existingBank.description || '') : '');
  const [questions, setQuestions] = useState(existingBank ? existingBank.questions : []);
  const [visibility, setVisibility] = useState(existingBank ? bankVisibility(existingBank) : 'public');

  const [format, setFormat] = useState('json');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Duplicate handling
  const [dupReview, setDupReview] = useState(null);   // { unique: [...], duplicates: [{ newQ, match, similarity, keep }] }
  const [lastAdded, setLastAdded] = useState(null);   // { added, flagged, skipped, kept, flaggedDetails: [...] }

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  const parse = () => {
    setError(null);
    setLastAdded(null);
    const result = processQuestionInput(text, format, 'bank');
    if (result.parseError) {
      setPreview({ valid: [], invalid: [], message: result.parseError });
    } else {
      setPreview({ valid: result.valid, invalid: result.invalid });
    }
  };

  // Replace: blow away current and use only the parsed valid set (no duplicates by definition).
  const doReplace = () => {
    if (!preview || preview.valid.length === 0) return;
    setQuestions(preview.valid);
    setLastAdded({ added: preview.valid.length, flagged: 0, skipped: 0, kept: 0, flaggedDetails: [], replaced: true });
    setText('');
    setPreview(null);
  };

  // Append: check each new question against the bank's current questions (and already-accepted from
  // this paste). Unique ones added straight away. Anything that looks like a near-duplicate is
  // surfaced for a per-question Keep / Skip choice — the whole upload is never rejected.
  const doAppend = () => {
    if (!preview || preview.valid.length === 0) return;
    const unique = [];
    const duplicates = [];
    const pool = [...questions];   // existing bank questions
    for (const newQ of preview.valid) {
      const dup = findDuplicateStem(newQ, pool);
      if (dup) {
        duplicates.push({ newQ, match: dup.match, similarity: dup.similarity, keep: false });
      } else {
        unique.push(newQ);
        pool.push(newQ);  // detect within-paste duplicates too
      }
    }
    if (duplicates.length === 0) {
      setQuestions([...questions, ...unique]);
      setLastAdded({ added: unique.length, flagged: 0, skipped: 0, kept: 0, flaggedDetails: [] });
      setText('');
      setPreview(null);
    } else {
      setDupReview({ unique, duplicates });
    }
  };

  const toggleDupKeep = (idx) => {
    setDupReview(prev => prev ? {
      ...prev,
      duplicates: prev.duplicates.map((d, i) => i === idx ? { ...d, keep: !d.keep } : d)
    } : prev);
  };

  const cancelDupReview = () => setDupReview(null);

  const confirmDupReview = () => {
    if (!dupReview) return;
    const kept = dupReview.duplicates.filter(d => d.keep).map(d => d.newQ);
    const skippedDetails = dupReview.duplicates.filter(d => !d.keep);
    const finalAdd = [...dupReview.unique, ...kept];
    setQuestions([...questions, ...finalAdd]);
    setLastAdded({
      added: finalAdd.length,
      flagged: dupReview.duplicates.length,
      skipped: skippedDetails.length,
      kept: kept.length,
      flaggedDetails: dupReview.duplicates
    });
    setDupReview(null);
    setText('');
    setPreview(null);
  };

  const removeQuestion = (i) => setQuestions(questions.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) { setError('The set needs a name'); return; }
    if (questions.length === 0) { setError('Add at least one question first'); return; }
    // Re-validate every question to make sure nothing got into the array malformed
    for (const q of questions) {
      const errs = validateQuestionFields(q);
      if (errs.length > 0) {
        setError(`Invalid question "${(q.q || '').slice(0, 40)}…": ${errs.join(', ')}`);
        return;
      }
    }
    setSaving(true);
    try {
      const now = Date.now();
      const bank = isEdit ? {
        ...existingBank,
        name: name.trim(),
        description: description.trim(),
        questions,
        version: (existingBank.version || 1) + 1,
        updatedAt: now
      } : {
        id: newBankId(),
        name: name.trim(),
        description: description.trim(),
        questions,
        version: 1,
        visibility: visibility === 'private' ? 'private' : 'public',
        // Brand-new public banks should be discoverable via the home "What's new"
        // banner. Private banks intentionally have no publishedAt.
        ...(visibility !== 'private' ? { publishedAt: now } : {}),
        ownerId: profile ? profile.id : null,
        ownerName: profile ? profile.displayName : null,
        createdAt: now,
        updatedAt: now
      };
      await onSave(bank);
    } catch (e) {
      setError('Could not save: ' + e.message);
      setSaving(false);
    }
  };

  return (
    <div className="anim-fadeup">
      <TopBar title={isEdit ? 'Edit question set' : 'New question set'} onBack={onBack} feedback={{ screen: "Bank editor" }} />
      <div className="max-w-md mx-auto px-4 pb-32 pt-2">

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Set name</div>
        <input value={name} onChange={e => setName(e.target.value)}
               placeholder="e.g. NORCET 2024 PYQ Set 1"
               className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle} />

        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Description (optional)</div>
        <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What's in this set?" rows={2}
                  className="w-full rounded-xl px-4 py-3 mb-4 text-sm resize-none" style={inputStyle} />

        {/* Visibility — chosen at upload (new banks only) */}
        {!isEdit && (
          <>
            <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Visibility</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[
                { val: 'public', icon: <Eye size={16} />, title: 'Public', desc: 'Everyone can browse & import' },
                { val: 'private', icon: <EyeOff size={16} />, title: 'Private', desc: 'Only you can see & use it' }
              ].map(opt => {
                const active = visibility === opt.val;
                return (
                  <button key={opt.val} onClick={() => setVisibility(opt.val)}
                          className="no-tap-highlight text-left p-3 rounded-xl transition-all"
                          style={{
                            background: active ? (opt.val === 'private' ? T.accent + '12' : T.success + '12') : T.surface,
                            border: `1.5px solid ${active ? (opt.val === 'private' ? T.accent : T.success) : T.border}`,
                            color: T.ink
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
              You can switch this anytime from the bank's page. Only an admin can later edit or delete a bank.
            </div>
          </>
        )}

        {/* Current question count */}
        <Card className="p-3 mb-5" style={{ background: questions.length > 0 ? T.successSoft : T.surfaceWarm }}>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: T.muted }}>
            Questions in this bank{isEdit ? ` (currently v${existingBank.version})` : ''}
          </div>
          <div className="font-display text-2xl font-semibold" style={{ color: questions.length > 0 ? T.success : T.muted }}>
            {questions.length}
          </div>
          {isEdit && (
            <div className="text-xs mt-1" style={{ color: T.muted }}>Saving will publish as v{existingBank.version + 1}</div>
          )}
        </Card>

        {/* Existing questions preview (for edit mode) */}
        {questions.length > 0 && (
          <details className="mb-5">
            <summary className="no-tap-highlight cursor-pointer text-xs uppercase tracking-wider font-semibold pb-2"
                     style={{ color: T.muted }}>
              View / remove questions ({questions.length})
            </summary>
            <div className="space-y-1.5 max-h-64 overflow-y-auto mt-2">
              {questions.map((q, i) => (
                <div key={q.id || i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: T.muted }}>{i + 1}.</span>
                  <div className="flex-1 text-xs leading-snug truncate" style={{ color: T.inkSoft }}>{q.q}</div>
                  <button onClick={() => removeQuestion(i)} className="no-tap-highlight p-1 -m-1 flex-shrink-0">
                    <X size={14} style={{ color: T.error }} />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Paste new questions */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
          {isEdit || questions.length > 0 ? 'Add more questions' : 'Add questions'}
        </div>

        {/* Last-import summary */}
        {lastAdded && (
          <Card className="p-3 mb-3 anim-fadeup"
                style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <div className="flex items-start gap-2.5">
              <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
              <div className="text-xs leading-relaxed flex-1" style={{ color: T.inkSoft }}>
                <div className="font-medium" style={{ color: T.success }}>
                  {lastAdded.replaced ? 'Done — set replaced.' : 'Added.'}{' '}
                  {lastAdded.added} question{lastAdded.added === 1 ? '' : 's'} {lastAdded.replaced ? 'now in the set' : 'added'}.
                </div>
                {lastAdded.flagged > 0 && (
                  <div className="mt-1" style={{ color: T.muted }}>
                    {lastAdded.flagged} flagged as possible duplicate{lastAdded.flagged === 1 ? '' : 's'}
                    {' — '}
                    <span style={{ color: T.success }}>{lastAdded.kept} kept</span>
                    {', '}
                    <span style={{ color: T.accent }}>{lastAdded.skipped} skipped</span>.
                  </div>
                )}
                {lastAdded.flaggedDetails && lastAdded.flaggedDetails.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] underline" style={{ color: T.muted }}>
                      view flagged items
                    </summary>
                    <ul className="mt-1.5 space-y-1.5 text-[11px]" style={{ color: T.inkSoft }}>
                      {lastAdded.flaggedDetails.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="flex-shrink-0 mt-0.5"
                                style={{ color: d.keep ? T.success : T.accent }}>
                            {d.keep ? '✓' : '−'}
                          </span>
                          <span className="leading-snug">{d.newQ.q.slice(0, 90)}{d.newQ.q.length > 90 ? '…' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <button onClick={() => setLastAdded(null)} className="no-tap-highlight p-1 -m-1">
                <X size={14} style={{ color: T.muted }} />
              </button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
          {['json', 'csv'].map(f => (
            <button key={f} onClick={() => { setFormat(f); setPreview(null); }}
                    className="no-tap-highlight py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={{ background: format === f ? T.surface : 'transparent',
                             color: format === f ? T.ink : T.muted,
                             boxShadow: format === f ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <button onClick={() => { setText(format === 'json' ? EXAMPLE_QUESTIONS_JSON : EXAMPLE_QUESTIONS_CSV); setPreview(null); }}
                className="no-tap-highlight text-xs underline mb-3" style={{ color: T.primary }}>
          insert example {format.toUpperCase()}
        </button>

        <textarea value={text} onChange={e => { setText(e.target.value); setPreview(null); }}
                  placeholder={format === 'json' ? 'Paste a JSON array of questions...' : 'Paste CSV (q,type,topic,sub,options,correct,exp,wrong,difficulty,source)...'}
                  rows={8}
                  className="w-full rounded-xl px-3 py-3 mb-3 text-xs resize-y font-mono"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, minHeight: '180px' }} />

        <Button onClick={parse} disabled={!text.trim()} className="w-full mb-4" icon={<Layers size={16} />}>
          Check questions
        </Button>

        {/* Duplicate review — appears when Append finds near-matches */}
        {dupReview && (
          <Card className="p-4 mb-4 anim-fadeup"
                style={{ background: T.accent + '12', border: `1.5px solid ${T.accent}` }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} style={{ color: T.accent }} />
              <div className="font-display text-sm font-semibold" style={{ color: T.accent }}>
                Possible duplicates
              </div>
            </div>
            <div className="text-xs leading-relaxed mb-3" style={{ color: T.inkSoft }}>
              {dupReview.unique.length > 0
                ? `${dupReview.unique.length} unique question${dupReview.unique.length === 1 ? '' : 's'} will be added. `
                : ''}
              {dupReview.duplicates.length} look{dupReview.duplicates.length === 1 ? 's' : ''} similar to existing question{dupReview.duplicates.length === 1 ? '' : 's'} — choose which to keep.
            </div>

            <div className="space-y-2.5 mb-3">
              {dupReview.duplicates.map((d, i) => (
                <Card key={i} className="p-3" style={{ background: T.surface }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Pill bg={T.accent + '15'} color={T.accent}>
                      {Math.round(d.similarity * 100)}% match
                    </Pill>
                    <button onClick={() => toggleDupKeep(i)}
                            className="no-tap-highlight px-3 py-1 rounded-full text-xs font-semibold transition-colors flex-shrink-0"
                            style={{
                              background: d.keep ? T.success : T.surfaceWarm,
                              color: d.keep ? '#FFF' : T.muted,
                              border: `1px solid ${d.keep ? T.success : T.border}`
                            }}>
                      {d.keep ? '✓ Keep' : 'Skip'}
                    </button>
                  </div>
                  <div className="text-xs mb-2">
                    <div className="font-semibold mb-0.5" style={{ color: T.muted }}>New:</div>
                    <div className="leading-snug" style={{ color: T.ink }}>{d.newQ.q}</div>
                  </div>
                  <div className="text-xs pt-2 border-t" style={{ borderColor: T.borderSoft }}>
                    <div className="font-semibold mb-0.5" style={{ color: T.muted }}>Already in bank:</div>
                    <div className="leading-snug" style={{ color: T.inkSoft }}>{d.match.q}</div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={cancelDupReview} className="w-full">
                Cancel
              </Button>
              <Button onClick={confirmDupReview} className="w-full" icon={<Check size={14} />}>
                Confirm import
              </Button>
            </div>
          </Card>
        )}

        {preview && (
          <div className="anim-fadeup mb-4">
            {preview.message ? (
              <Card className="p-4" style={{ background: T.errorSoft, border: `1px solid ${T.error}` }}>
                <div className="text-sm font-medium" style={{ color: T.error }}>{preview.message}</div>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Card className="p-3" style={{ background: preview.valid.length > 0 ? T.successSoft : T.surface }}>
                    <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Valid</div>
                    <div className="font-display text-2xl font-semibold" style={{ color: T.success }}>{preview.valid.length}</div>
                  </Card>
                  <Card className="p-3" style={{ background: preview.invalid.length > 0 ? T.errorSoft : T.surface }}>
                    <div className="text-xs uppercase tracking-wider" style={{ color: T.muted }}>Invalid</div>
                    <div className="font-display text-2xl font-semibold" style={{ color: T.error }}>{preview.invalid.length}</div>
                  </Card>
                </div>

                {preview.invalid.length > 0 && (
                  <Card className="p-3 mb-3">
                    <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
                      Errors (these will be rejected)
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {preview.invalid.slice(0, 20).map(({ index, errors, preview: p }) => (
                        <div key={index} className="text-xs">
                          <div className="font-medium" style={{ color: T.error }}>#{index}: {errors.join(', ')}</div>
                          <div className="truncate" style={{ color: T.muted }}>{p}</div>
                        </div>
                      ))}
                      {preview.invalid.length > 20 && <div className="text-xs" style={{ color: T.muted }}>… and {preview.invalid.length - 20} more</div>}
                    </div>
                  </Card>
                )}

                {preview.valid.length > 0 && (
                  questions.length === 0 ? (
                    // Set is empty — Append and Replace would produce identical
                    // results, so we don't surface a choice. One button, one
                    // clear action.
                    <Button onClick={doAppend} className="w-full" icon={<Plus size={14} />}>
                      Add these {preview.valid.length} question{preview.valid.length === 1 ? '' : 's'}
                    </Button>
                  ) : (
                    // Set already has questions — Append vs Replace genuinely
                    // differ. Stack the two as a clear choice in plain English,
                    // with a destructive warning on the one that destroys data.
                    <div className="space-y-2">
                      <Button onClick={doAppend} className="w-full" icon={<Plus size={16} />}>
                        Add to the existing questions
                      </Button>
                      <div className="text-[11px] -mt-1 mb-1 text-center" style={{ color: T.muted }}>
                        Keeps the {questions.length} question{questions.length === 1 ? '' : 's'} already here
                      </div>
                      <Button onClick={doReplace} variant="ghost" className="w-full"
                              icon={<RefreshCw size={14} />}>
                        Start over with just these
                      </Button>
                      <div className="text-[11px] -mt-1 text-center" style={{ color: T.error }}>
                        Removes the {questions.length} question{questions.length === 1 ? '' : 's'} already here
                      </div>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <Card className="p-3 mb-3 anim-fadeup" style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <div className="flex items-start gap-2 text-sm" style={{ color: T.error }}>
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          </Card>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
        <div className="max-w-md mx-auto">
          <Button onClick={handleSave} disabled={saving || !name.trim() || questions.length === 0}
                  size="lg" className="w-full"
                  icon={saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}>
            {saving ? 'Saving…' : (isEdit ? `Save changes (v${existingBank.version + 1})` : 'Save question set')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { BankDetail, BankEditor };
