// =====================================================================
// src/screens/progress-report.jsx — the Progress Report screen.
//
// A WYSIWYG on-screen preview of the SAME model that feeds both artifacts
// (src/lib/report-card.js), then two actions: Share image card (the WhatsApp
// virality path, via the canvas pipeline) and Save as PDF (window.print over
// src/ui/report-print.jsx). Honest by construction: no rank, no percentile,
// no "study hours", and every artifact carries the baked-in disclaimer.
//
// 🔴 iOS + installed PWA: window.print() is a no-op there. We detect it and
// swap the PDF button for an honest note, keeping the image share primary
// (the push-opt-in.js "no install lie" precedent).
// =====================================================================
import React, { useMemo, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Printer, Info } from 'lucide-react';
import { useTheme, useData, useProfile, useI18n } from '../lib/app-context.jsx';
import { Card, Button, TopBar, EduTag } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';
import LanguageDisclaimer from '../ui/language-disclaimer.jsx';
import { buildReportCard } from '../lib/report-card.js';
import { paintProgressReportCard, shareOrSavePng } from '../lib/qr-canvas.js';
import { ReportPrintDoc } from '../ui/report-print.jsx';
import { referralCodeFor, buildReferralUrl, VIA, displayAppUrl } from '../lib/referral.js';
import { isIOS } from '../lib/platform.js';
import { progressReportLocked } from '../lib/premium.js';

function isStandaloneDisplay() {
  try {
    return (typeof window !== 'undefined') && (
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (typeof navigator !== 'undefined' && navigator.standalone === true)
    );
  } catch (e) { return false; }
}

function StatLine({ s, T }) {
  if (!s) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5" style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: T.ink }}>{s.label}</div>
        <div className="text-xs leading-snug mt-0.5" style={{ color: T.muted }}>{s.detail}</div>
      </div>
      <div className="flex-shrink-0 text-right font-display font-bold"
           style={{ color: s.value === null ? T.muted : T.primary, fontSize: s.value === null ? '13px' : '19px' }}>
        {s.value === null ? <span className="text-xs font-body font-medium">{s.display}</span> : s.display}
      </div>
    </div>
  );
}

export default function ProgressReport({ onBack, onQuick, onOpenPremium }) {
  const { theme: T } = useTheme();
  const { data, allQuestions } = useData();
  const { profile } = useProfile();
  const { lang } = useI18n();

  const nowRef = useRef(Date.now());
  const report = useMemo(
    () => buildReportCard({ profile, data, allQuestions, now: nowRef.current }),
    [profile, data, allQuestions]
  );

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'ok' | 'err', text }

  const locked = progressReportLocked(profile);
  const iosStandalone = isIOS() && isStandaloneDisplay();

  const onShareImage = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const code = referralCodeFor(profile);
      const url = buildReferralUrl(code, VIA.POSTER);
      const blob = await paintProgressReportCard({ report, url, displayUrl: displayAppUrl(), theme: T });
      const res = await shareOrSavePng(blob, 'nurseholic-progress-card.png', {
        title: 'My NurseHolic progress',
        text: `My practice progress on NurseHolic. Free NORCET nursing prep: ${url}`,
      });
      if (res === 'downloaded') setMsg({ kind: 'ok', text: 'Image saved. Share it on WhatsApp or Instagram.' });
      else if (res === 'error') setMsg({ kind: 'err', text: 'Could not create the image. Please try again.' });
      // 'shared' / 'cancelled' are silent.
    } catch (e) {
      setMsg({ kind: 'err', text: 'Could not create the image. Please try again.' });
    } finally {
      setBusy(false);
      if (typeof setTimeout === 'function') setTimeout(() => setMsg(null), 4000);
    }
  };

  const onSavePdf = () => { try { window.print(); } catch (e) { /* no-op */ } };

  const headline = Array.isArray(report.headline) ? report.headline : [];
  const stats = Array.isArray(report.stats) ? report.stats : [];
  const subjects = report.subjects;
  const timed = report.timedTests || {};
  const scope = report.scope || { title: 'What this counts', lines: [] };

  return (
    <div>
      <TopBar title="Progress card" onBack={onBack} />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 pb-28 pt-2">

        {report.isEmpty ? (
          <div className="mt-6">
            <EmptyState
              icon={FileText}
              title="Nothing to show yet"
              text="Answer a few quiz questions and your progress card will appear here, ready to share or save as a PDF."
              actionLabel="Start a Quick Test"
              onAction={onQuick}
            />
          </div>
        ) : (
          <>
            {/* honesty leads: the scope box first */}
            <Card className="p-4 mt-3 mb-4" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: T.inkSoft }}>{scope.title}</div>
              {scope.lines.map((ln, i) => (
                <div key={i} className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>{ln}</div>
              ))}
            </Card>

            {/* headline grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {headline.map((s, i) => (
                <Card key={i} className="p-3.5">
                  <div className="font-display font-bold" style={{ color: s && s.value === null ? T.muted : T.primary, fontSize: s && s.value === null ? '14px' : '26px' }}>
                    {s ? s.display : ''}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: T.muted }}>
                    {s ? s.label : ''}
                  </div>
                </Card>
              ))}
            </div>

            {/* full stat list */}
            <Card className="p-4 mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: T.inkSoft }}>Your practice</div>
              {stats.map((s) => <StatLine key={s.id} s={s} T={T} />)}
            </Card>

            {/* subjects */}
            {subjects && subjects.rows && subjects.rows.length > 0 && (
              <Card className="p-4 mb-4">
                <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: T.inkSoft }}>By subject</div>
                <div className="space-y-2.5">
                  {subjects.rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <div className="text-sm font-medium truncate flex-shrink-0" style={{ color: T.ink, width: '38%' }}>{r.name}</div>
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: T.borderSoft }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, r.accuracy))}%`, background: r.color || T.primary }} />
                      </div>
                      <div className="text-sm font-display font-bold flex-shrink-0 text-right tabular-nums" style={{ color: T.primary, width: '52px' }}>{r.accuracy}%</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs leading-relaxed mt-3" style={{ color: T.muted }}>{subjects.note}</div>
              </Card>
            )}

            {/* timed tests */}
            <Card className="p-4 mb-4" style={{ border: `1px dashed ${T.border}` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: T.inkSoft }}>Timed tests</div>
              <StatLine s={timed.mocks} T={T} />
              <StatLine s={timed.papers} T={T} />
              <StatLine s={timed.timeInTests} T={T} />
              <div className="text-xs leading-relaxed mt-2" style={{ color: T.muted }}>{timed.note}</div>
            </Card>

            {/* disclaimer */}
            <Card className="p-4 mb-4" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
              <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>{report.disclaimer}</div>
            </Card>

            {lang && lang !== 'en' && (
              <div className="mb-4"><LanguageDisclaimer compact /></div>
            )}

            {/* actions */}
            {locked ? (
              <Card className="p-4 mb-2 text-center">
                <div className="text-sm font-semibold mb-1" style={{ color: T.ink }}>A premium feature</div>
                <div className="text-xs mb-3" style={{ color: T.muted }}>Sharing and saving your progress card is part of premium.</div>
                <Button variant="primary" className="w-full" onClick={onOpenPremium}>See Premium</Button>
              </Card>
            ) : (
              <div className="space-y-2.5">
                <Button variant="primary" size="lg" className="w-full" icon={<ImageIcon size={18} />}
                        onClick={onShareImage} disabled={busy}>
                  {busy ? 'Creating…' : 'Share image card'}
                </Button>

                {iosStandalone ? (
                  <Card className="p-3.5" style={{ background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                    <div className="flex items-start gap-2.5">
                      <Info size={16} style={{ color: T.muted, marginTop: 1 }} className="flex-shrink-0" />
                      <div className="text-xs leading-relaxed" style={{ color: T.inkSoft }}>
                        On the installed iPhone app, saving as PDF is not available. Open www.nurseholic.in in Safari to save a PDF, or share the image card above.
                      </div>
                    </div>
                  </Card>
                ) : (
                  <>
                    <Button variant="ghost" size="lg" className="w-full" icon={<Printer size={18} />} onClick={onSavePdf}>
                      Save as PDF
                    </Button>
                    <div className="text-[11px] text-center" style={{ color: T.muted }}>
                      Opens your print dialog. Choose Save as PDF, and switch off headers and footers for a clean page.
                    </div>
                  </>
                )}

                {msg && (
                  <div className="text-xs text-center mt-1 anim-fadeup" role="status" aria-live="polite"
                       style={{ color: msg.kind === 'err' ? T.error : T.muted }}>
                    {msg.text}
                  </div>
                )}
              </div>
            )}

            <EduTag className="mt-6" />
          </>
        )}
      </div>

      {/* The print document lives at body level, hidden on screen, shown only
          when the OS print dialog runs. Mounted unconditionally so there is no
          printing-state race to get stuck on. */}
      {!report.isEmpty && <ReportPrintDoc report={report} />}
    </div>
  );
}
