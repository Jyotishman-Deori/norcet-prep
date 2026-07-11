// =====================================================================
// src/ui/report-print.jsx — the printable Progress Report (Save as PDF).
//
// TWO exports:
//   ReportPrintBody — pure markup, NO portal, so the render smoke can cover it
//                     (the smoke stubs createPortal to null).
//   ReportPrintDoc  — wraps the body in a BodyPortal under #nh-report-print.
//
// WHY a body-level print root: TopBar portals into <body>, and DesktopNav /
// AppFooter / BackToTop / every dialog mount OUTSIDE the screen, so a
// screen-scoped `.no-print` class (the crib-sheet pattern) cannot hide them.
// One rule, `body > *:not(#nh-report-print) { display:none }`, hides the whole
// SPA and every portaled node at once, and stays correct when new chrome is
// added later. (#root is a direct body child, so it is caught by that rule.)
//
// The palette is a FIXED ink-on-white, never the live theme: a dark-theme user
// must not print white text on white paper.
//
// Styles live in this file's own template literal, NOT in font-styles.js (one
// stray backtick there breaks every screen). No animation classes, so nothing
// to add to the reduced-motion catch-all.
// =====================================================================
import React from 'react';
import BodyPortal from './body-portal.jsx';

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
// Fixed ink-on-white. Subject bar colours come from topicColor (fixed hex in
// seed.js), so they are theme-independent and safe to print.
const P = {
  ink: '#1A2B23', soft: '#3A4A40', muted: '#5B6B62',
  line: '#DDD6C6', lineSoft: '#EEE8DA', brand: '#0F4C4C', paper: '#FFFFFF',
};

export const REPORT_PRINT_STYLES = `
#nh-report-print { display: none; }
@media print {
  @page { size: A4 portrait; margin: 14mm 12mm; }
  html, body { background: #FFFFFF !important; padding: 0 !important; margin: 0 !important; }
  /* Hide the entire SPA (#root) AND every portaled node (TopBar, dialogs,
     toasts, drawer, install nudge) in one selector. */
  body > *:not(#nh-report-print) { display: none !important; }
  #nh-report-print { display: block !important; }
  #nh-report-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .nhr-section { page-break-inside: avoid; break-inside: avoid; }
  .nhr-table { width: 100%; border-collapse: collapse; }
  .nhr-table thead { display: table-header-group; }
  .nhr-table tr { page-break-inside: avoid; break-inside: avoid; }
}
`;

function StatRow({ s }) {
  if (!s) return null;
  return (
    <div className="nhr-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '9px 0', borderBottom: `1px solid ${P.lineSoft}` }}>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: '13px', fontWeight: 600, color: P.ink }}>{s.label}</div>
        <div style={{ fontFamily: SANS, fontSize: '11px', color: P.muted, lineHeight: 1.4, marginTop: '2px' }}>{s.detail}</div>
      </div>
      <div style={{ flex: '0 0 auto', fontFamily: SERIF, fontSize: '20px', fontWeight: 700, color: s.value === null ? P.muted : P.brand, textAlign: 'right' }}>
        {s.value === null ? <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 500 }}>{s.display}</span> : s.display}
      </div>
    </div>
  );
}

export function ReportPrintBody({ report }) {
  const R = report || {};
  const meta = R.meta || {};
  const identity = R.identity;
  const headline = Array.isArray(R.headline) ? R.headline : [];
  const stats = Array.isArray(R.stats) ? R.stats : [];
  const subjects = R.subjects;
  const timed = R.timedTests || {};
  const scope = R.scope || { title: 'What this counts', lines: [] };

  return (
    <div style={{ fontFamily: SERIF, color: P.ink, background: P.paper, maxWidth: '760px', margin: '0 auto', padding: '10px 6px' }}>
      {/* letterhead */}
      <div className="nhr-section" style={{ borderBottom: `2px solid ${P.brand}`, paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: '22px', fontWeight: 700, color: P.brand, letterSpacing: '0.2px' }}>NurseHolic</div>
            <div style={{ fontFamily: SERIF, fontSize: '30px', fontWeight: 700, marginTop: '2px' }}>{R.title || 'Progress Card'}</div>
          </div>
          <div style={{ textAlign: 'right', fontFamily: SANS }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: P.ink }}>{meta.name || 'NORCET Aspirant'}</div>
            <div style={{ fontSize: '12px', color: P.muted, marginTop: '2px' }}>Generated {meta.generatedOnDisplay || ''}</div>
            {identity ? <div style={{ fontSize: '12px', color: P.soft, marginTop: '2px' }}>Level {identity.level}, {identity.tierTitle}</div> : null}
          </div>
        </div>
      </div>

      {/* scope box FIRST, honesty leads */}
      <div className="nhr-section" style={{ background: '#F7F3E9', border: `1px solid ${P.line}`, borderRadius: '8px', padding: '12px 14px', marginBottom: '18px' }}>
        <div style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: P.soft, marginBottom: '6px' }}>{scope.title}</div>
        {scope.lines.map((ln, i) => (
          <div key={i} style={{ fontFamily: SANS, fontSize: '12px', color: P.soft, lineHeight: 1.5, marginBottom: '2px' }}>{ln}</div>
        ))}
      </div>

      {/* headline grid */}
      <div className="nhr-section" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
        {headline.map((s, i) => (
          <div key={i} style={{ flex: '1 1 44%', minWidth: '180px', border: `1px solid ${P.line}`, borderRadius: '8px', padding: '12px 14px' }}>
            <div style={{ fontFamily: SERIF, fontSize: s && s.value === null ? '15px' : '26px', fontWeight: 700, color: s && s.value === null ? P.muted : P.brand }}>{s ? s.display : ''}</div>
            <div style={{ fontFamily: SANS, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: P.muted, marginTop: '4px' }}>{s ? s.label : ''}</div>
          </div>
        ))}
      </div>

      {/* full stat list */}
      <div className="nhr-section" style={{ marginBottom: '18px' }}>
        <div style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: P.soft, marginBottom: '4px' }}>Your practice</div>
        {stats.map((s) => <StatRow key={s.id} s={s} />)}
      </div>

      {/* subject table */}
      {subjects && subjects.rows && subjects.rows.length > 0 ? (
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: P.soft, marginBottom: '6px' }}>By subject</div>
          <table className="nhr-table">
            <thead>
              <tr style={{ borderBottom: `2px solid ${P.line}` }}>
                <th style={{ textAlign: 'left', fontFamily: SANS, fontSize: '11px', color: P.muted, padding: '5px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject</th>
                <th style={{ textAlign: 'right', fontFamily: SANS, fontSize: '11px', color: P.muted, padding: '5px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Correct</th>
                <th style={{ textAlign: 'right', fontFamily: SANS, fontSize: '11px', color: P.muted, padding: '5px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attempted</th>
                <th style={{ textAlign: 'right', fontFamily: SANS, fontSize: '11px', color: P.muted, padding: '5px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {subjects.rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${P.lineSoft}` }}>
                  <td style={{ fontFamily: SANS, fontSize: '13px', color: P.ink, padding: '7px 4px' }}>
                    <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '2px', background: r.color || P.muted, marginRight: '7px' }} />
                    {r.name}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: SANS, fontSize: '13px', color: P.soft, padding: '7px 4px' }}>{r.correct}</td>
                  <td style={{ textAlign: 'right', fontFamily: SANS, fontSize: '13px', color: P.soft, padding: '7px 4px' }}>{r.total}</td>
                  <td style={{ textAlign: 'right', fontFamily: SERIF, fontSize: '15px', fontWeight: 700, color: P.brand, padding: '7px 4px' }}>{r.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontFamily: SANS, fontSize: '11px', color: P.muted, lineHeight: 1.5, marginTop: '6px' }}>{subjects.note}</div>
        </div>
      ) : null}

      {/* timed tests, visually separated with the "not included above" note */}
      <div className="nhr-section" style={{ marginBottom: '18px', border: `1px dashed ${P.line}`, borderRadius: '8px', padding: '12px 14px' }}>
        <div style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: P.soft, marginBottom: '4px' }}>Timed tests</div>
        <StatRow s={timed.mocks} />
        <StatRow s={timed.papers} />
        <StatRow s={timed.timeInTests} />
        <div style={{ fontFamily: SANS, fontSize: '11px', color: P.muted, lineHeight: 1.5, marginTop: '6px' }}>{timed.note}</div>
      </div>

      {/* disclaimer */}
      <div className="nhr-section" style={{ border: `1px solid ${P.line}`, borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
        <div style={{ fontFamily: SANS, fontSize: '11.5px', color: P.soft, lineHeight: 1.6 }}>{R.disclaimer}</div>
      </div>

      {/* footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', borderTop: `1px solid ${P.line}`, paddingTop: '8px', fontFamily: SANS, fontSize: '11px', color: P.muted, flexWrap: 'wrap' }}>
        <span>{R.disclaimerShort}</span>
        <span>www.nurseholic.in</span>
      </div>
    </div>
  );
}

export function ReportPrintDoc({ report }) {
  return (
    <BodyPortal>
      <div id="nh-report-print">
        <style>{REPORT_PRINT_STYLES}</style>
        <ReportPrintBody report={report} />
      </div>
    </BodyPortal>
  );
}

export default ReportPrintDoc;
