// =====================================================================
// src/screens/add-question.jsx — add custom question / bulk import (A1 slice 22)
// Extracted from App.jsx. Body byte-identical; only change is the A7 hook line
// (T + IS_DARK -> useTheme). Props stay { onSave, onSaveBulk, onBack,
// existingCustomCount }. Renders the extracted <BulkImport>.
// =====================================================================
import React, { useState } from 'react';
import { Check, Layers, Plus, Save } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Button, TopBar } from '../ui/primitives.jsx';
import { TOPICS } from '../data/seed.js';
import BulkImport from './bulk-import.jsx';

function AddQuestion({ onSave, onSaveBulk, onBack, existingCustomCount }) {
  const { theme: T, isDark: IS_DARK } = useTheme();
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [type, setType] = useState('mcq');
  const [topic, setTopic] = useState('fund');
  const [sub, setSub] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [memoryTip, setMemoryTip] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [source, setSource] = useState('');

  const toggleCorrect = (i) => {
    if (type === 'mcq') setCorrect([i]);
    else setCorrect(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const canSave = questionText.trim() && options.every(o => o.trim()) && correct.length > 0 && explanation.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: `custom-${Date.now()}`,
      topic,
      sub: sub || 'General',
      type,
      q: questionText.trim(),
      options: options.map(o => o.trim()),
      correct,
      exp: explanation.trim(),
      wrong: {},
      custom: true,
      ...(memoryTip.trim() ? { memoryTip: memoryTip.trim() } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(source.trim() ? { source: source.trim() } : {})
    });
  };

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  return (
    <div className="anim-fadeup">
      <TopBar title="Add a question" onBack={onBack} feedback={{ screen: "Add question" }} />
      <div className="max-w-md mx-auto px-4 pb-32 pt-2">
        <div className="text-xs mb-4" style={{ color: T.muted }}>
          Custom questions live alongside the preloaded ones. {existingCustomCount} added so far.
        </div>

        {/* Single vs Bulk toggle */}
        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
          <button onClick={() => setMode('single')}
                  className="no-tap-highlight py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                  style={{ background: mode === 'single' ? T.surface : 'transparent',
                           color: mode === 'single' ? T.ink : T.muted,
                           boxShadow: mode === 'single' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
            <Plus size={14} />
            Single
          </button>
          <button onClick={() => setMode('bulk')}
                  className="no-tap-highlight py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                  style={{ background: mode === 'bulk' ? T.surface : 'transparent',
                           color: mode === 'bulk' ? T.ink : T.muted,
                           boxShadow: mode === 'bulk' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
            <Layers size={14} />
            Bulk import
          </button>
        </div>

        {mode === 'bulk' ? (
          <BulkImport onSaveBulk={onSaveBulk} />
        ) : (
          <>
        {/* Type toggle */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Question type</div>
        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
          {['mcq', 'msq'].map(t => (
            <button key={t} onClick={() => { setType(t); setCorrect([]); }}
                    className={`no-tap-highlight py-2.5 px-3 rounded-lg text-sm font-medium transition-all`}
                    style={{ background: type === t ? T.surface : 'transparent', color: type === t ? T.ink : T.muted,
                             boxShadow: type === t ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>
              {t === 'mcq' ? 'Single answer' : 'Multi-select'}
            </button>
          ))}
        </div>

        {/* Topic */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Topic</div>
        <select value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle}>
          {TOPICS.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>

        {/* Sub */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Sub-topic (optional)</div>
        <input value={sub} onChange={e => setSub(e.target.value)} placeholder="e.g. Vital signs"
               className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle} />

        {/* Difficulty */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Difficulty (optional)</div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { id: '', label: 'None' },
            { id: 'easy', label: 'Easy' },
            { id: 'medium', label: 'Medium' },
            { id: 'hard', label: 'Hard' }
          ].map(d => (
            <button key={d.id || 'none'} onClick={() => setDifficulty(d.id)}
                    className="no-tap-highlight py-2 rounded-lg text-xs font-medium transition-all"
                    style={{ background: difficulty === d.id ? T.primary : T.surface,
                             color: difficulty === d.id ? '#FFF' : T.ink,
                             border: `1px solid ${difficulty === d.id ? T.primary : T.border}` }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Source */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Source (optional)</div>
        <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. NORCET 2023 PYQ"
               className="w-full rounded-xl px-4 py-3 mb-4 text-sm" style={inputStyle} />

        {/* Question */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Question</div>
        <textarea value={questionText} onChange={e => setQuestionText(e.target.value)}
                  placeholder="Type the question..." rows={3}
                  className="w-full rounded-xl px-4 py-3 mb-4 text-sm resize-none" style={inputStyle} />

        {/* Options */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
          Options {type === 'msq' ? '(tap all correct)' : '(tap the correct one)'}
        </div>
        <div className="space-y-2 mb-4">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button onClick={() => toggleCorrect(i)}
                      className="no-tap-highlight w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 transition-all"
                      style={{ background: correct.includes(i) ? T.success : T.surface,
                               border: `1.5px solid ${correct.includes(i) ? T.success : T.border}`,
                               color: correct.includes(i) ? '#FFF' : T.muted }}>
                {correct.includes(i) ? <Check size={16} /> : String.fromCharCode(65 + i)}
              </button>
              <input value={opt} onChange={e => {
                const copy = [...options]; copy[i] = e.target.value; setOptions(copy);
              }} placeholder={`Option ${String.fromCharCode(65 + i)}`}
                     className="flex-1 rounded-xl px-4 py-2.5 text-sm" style={inputStyle} />
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button onClick={() => setOptions([...options, ''])}
                  className="no-tap-highlight text-xs underline mb-4" style={{ color: T.muted }}>
            + add another option
          </button>
        )}

        {/* Explanation */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Explanation</div>
        <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
                  placeholder="Why is this the correct answer? Include any key intuitions..." rows={4}
                  className="w-full rounded-xl px-4 py-3 mb-4 text-sm resize-none" style={inputStyle} />

        {/* Memory tip */}
        <div className="text-xs uppercase tracking-wider font-semibold mb-2 mt-0" style={{ color: T.muted }}>Memory tip <span style={{ color: T.muted, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
        <textarea value={memoryTip} onChange={e => setMemoryTip(e.target.value)}
                  placeholder="A pattern, mnemonic, or clinical intuition that makes this stick — e.g. 'HIGH K = HIGH RISK: think of potassium as a volume knob on the heart'"
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 mb-4 text-sm resize-none" style={inputStyle} />
          </>
        )}
      </div>

      {mode === 'single' && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3" style={{ background: IS_DARK ? 'rgba(21,19,15,0.95)' : T.bg + 'F2', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.borderSoft}` }}>
          <div className="max-w-md mx-auto">
            <Button onClick={handleSave} disabled={!canSave} size="lg" className="w-full" icon={<Save size={18} />}>
              Save question
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddQuestion;
