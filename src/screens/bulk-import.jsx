// =====================================================================
// src/screens/bulk-import.jsx — per-user bulk question import (A1 slice 17)
// Extracted from App.jsx. Body byte-identical; only change is the A7 hook
// line (T -> useTheme). Signature { onSaveBulk } stays. processQuestionInput
// now imported from ../lib/question-import.js.
// =====================================================================
import React, { useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, Button } from '../ui/primitives.jsx';
import { processQuestionInput } from '../lib/question-import.js';

function BulkImport({ onSaveBulk }) {
  const { theme: T } = useTheme();
  const [format, setFormat] = useState('json');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);

  const parse = () => {
    const result = processQuestionInput(text, format, 'custom');
    if (result.parseError) {
      setPreview({ valid: [], invalid: [], message: result.parseError });
    } else {
      setPreview({ valid: result.valid, invalid: result.invalid });
    }
  };

  const handleConfirm = () => {
    if (preview && preview.valid.length > 0) onSaveBulk(preview.valid);
  };

  return (
    <>
      <div className="text-xs mb-4 leading-relaxed" style={{ color: T.muted }}>
        Paste many questions at once. JSON is most reliable. CSV is good for spreadsheet exports.
      </div>

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
                placeholder={format === 'json' ? 'Paste a JSON array of questions...' : 'Paste CSV with headers (q,type,topic,sub,options,correct,exp,wrong,difficulty,source,image)...'}
                rows={10}
                className="w-full rounded-xl px-3 py-3 mb-4 text-xs resize-y font-mono"
                style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink, minHeight: '220px' }} />

      <Button onClick={parse} disabled={!text.trim()} className="w-full mb-4" icon={<Layers size={16} />}>
        Validate
      </Button>

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
                  <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Errors</div>
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
                <Button onClick={handleConfirm} className="w-full" icon={<Plus size={16} />}>
                  Add {preview.valid.length} question{preview.valid.length === 1 ? '' : 's'}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

export default BulkImport;
