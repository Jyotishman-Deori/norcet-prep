// =====================================================================
// src/ui/media-fields.jsx — the image/video inputs shared by the question
// editors (AddQuestion single form + BankEditor per-question editor).
//
// Image: paste any https URL, or "Upload" to send the picked file straight
// to the owner's Cloudflare R2 bucket via the media-sign broker (coadmin+
// server-gated; a student session would just get a 403, and these editors
// are admin surfaces anyway). Video: paste a YouTube / https link; rendered
// by QuestionVideo. A live thumbnail preview confirms the image URL works.
// =====================================================================
import React, { useRef, useState } from 'react';
import { Check, Copy, ImagePlus, Loader2, X } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { uploadViaSigner } from '../lib/media.js';

// Bulk-workflow helper (BankEditor): upload images to R2 one by one and copy
// their public URLs into the JSON/CSV you are about to paste. Keeps a small
// session list so a paper's worth of figures can be uploaded in one sitting.
export function MediaUploadHelper() {
  const { theme: T } = useTheme();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [urls, setUrls] = useState([]);
  const [copied, setCopied] = useState('');

  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setError('');
    try {
      for (const f of files) {
        const url = await uploadViaSigner(f);
        setUrls(prev => [{ name: f.name, url }, ...prev]);
      }
    } catch (err) {
      setError(String((err && err.message) || err));
    } finally {
      setBusy(false);
    }
  };
  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(''), 1600); } catch (e) {}
  };

  return (
    <div className="rounded-xl p-3 mb-3" style={{ background: T.surfaceWarm, border: `1px dashed ${T.border}` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11.5px] leading-snug" style={{ color: T.muted }}>
          Image questions: upload figures here, then paste each URL into your JSON's <code>image</code> field.
        </div>
        <button onClick={() => { setError(''); fileRef.current && fileRef.current.click(); }} disabled={busy}
                className="no-tap-highlight flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0 active:scale-95 transition"
                style={{ background: T.primary + '14', color: T.primary, border: `1px solid ${T.primary}44` }}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {busy ? 'Uploading' : 'Upload images'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFile} />
      </div>
      {error && <div className="text-[11px] mt-2" style={{ color: T.error }}>{error}</div>}
      {urls.length > 0 && (
        <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
          {urls.map(({ name, url }) => (
            <div key={url} className="flex items-center gap-2 text-[11px]" style={{ color: T.inkSoft }}>
              <span className="truncate flex-1" title={url}>{name}: {url}</span>
              <button onClick={() => copy(url)} className="no-tap-highlight p-1 flex-shrink-0" aria-label={`Copy URL for ${name}`}>
                {copied === url ? <Check size={13} style={{ color: T.success }} /> : <Copy size={13} style={{ color: T.primary }} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MediaFields({ image = '', video = '', onImage, onVideo }) {
  const { theme: T } = useTheme();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  const pick = () => { setError(''); if (fileRef.current) fileRef.current.click(); };
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setError('');
    try {
      const url = await uploadViaSigner(file);
      onImage(url);
    } catch (err) {
      setError(String((err && err.message) || err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4">
      <div className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>
        Image <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <input value={image} onChange={(e) => onImage(e.target.value)}
               placeholder="https://... (R2 public URL) or Upload"
               spellCheck={false}
               className="flex-1 rounded-xl px-4 py-2.5 text-sm" style={inputStyle} />
        <button onClick={pick} disabled={busy}
                className="no-tap-highlight flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold flex-shrink-0 active:scale-95 transition"
                style={{ background: T.primary + '14', color: T.primary, border: `1px solid ${T.primary}44` }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {busy ? 'Uploading' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {image && (
        <div className="relative inline-block mb-1">
          <img src={image} alt="Question figure preview" className="rounded-lg"
               style={{ maxHeight: 110, maxWidth: '100%', border: `1px solid ${T.border}` }} />
          <button onClick={() => onImage('')} aria-label="Remove image"
                  className="no-tap-highlight absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: T.error, color: '#FFF' }}>
            <X size={12} />
          </button>
        </div>
      )}
      {error && <div className="text-[11px] mb-1" style={{ color: T.error }}>{error}</div>}

      <div className="text-xs uppercase tracking-wider font-semibold mb-2 mt-3" style={{ color: T.muted }}>
        Video link <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional, YouTube or https)</span>
      </div>
      <input value={video} onChange={(e) => onVideo(e.target.value)}
             placeholder="https://youtu.be/..." spellCheck={false}
             className="w-full rounded-xl px-4 py-2.5 text-sm" style={inputStyle} />
    </div>
  );
}
