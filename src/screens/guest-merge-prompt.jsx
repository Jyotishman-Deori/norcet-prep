// =====================================================================
// src/screens/guest-merge-prompt.jsx — keep/discard guest progress (A1 slice 18)
// Extracted from App.jsx. Body byte-identical (no theme refs -> no hook line).
// Props stay { guestData, onKeep, onDiscard }.
// =====================================================================
import React from 'react';
import { Check, Save } from 'lucide-react';
import { Card, Button } from '../ui/primitives.jsx';
import { useFocusTrap } from '../lib/use-focus-trap.js';

function GuestMergePrompt({ guestData, onKeep, onDiscard }) {
  const dialogRef = useFocusTrap(onKeep);
  const s = (guestData && guestData.stats) || {};
  const answered = s.totalAttempted || 0;
  const bookmarks = (guestData && Array.isArray(guestData.bookmarks)) ? guestData.bookmarks.length : 0;
  const tests = ((guestData && Array.isArray(guestData.advancedTestHistory)) ? guestData.advancedTestHistory.length : 0)
    + ((guestData && guestData.previousPapers && typeof guestData.previousPapers === 'object') ? Object.keys(guestData.previousPapers).length : 0);
  const bits = [];
  if (answered > 0) bits.push(`${answered} question${answered === 1 ? '' : 's'} answered`);
  if (bookmarks > 0) bits.push(`${bookmarks} bookmark${bookmarks === 1 ? '' : 's'}`);
  if (tests > 0) bits.push(`${tests} test${tests === 1 ? '' : 's'}`);
  const summary = bits.join(' · ');
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.5)' }}>
      <Card className="w-full max-w-md anim-scalein">
        <div className="p-5" ref={dialogRef} role="dialog" aria-modal="true"
             aria-label="Keep your guest progress?">
          <div className="flex items-center gap-2 mb-2">
            <Save size={18} className="text-accent" />
            <div className="font-display text-lg font-semibold text-ink">
              Keep your guest progress?
            </div>
          </div>
          <div className="text-sm leading-relaxed mb-1 text-ink-soft">
            You built up some progress while exploring{summary ? ':' : '.'}
          </div>
          {summary && (
            <div className="text-sm font-semibold mb-3 text-ink">{summary}</div>
          )}
          <div className="text-sm leading-relaxed mb-4 text-ink-soft">
            Add it to your account, or start fresh? Either way, any progress
            already on your account is kept.
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onDiscard} className="flex-1">
              Start fresh
            </Button>
            <Button variant="accent" onClick={onKeep} className="flex-1" icon={<Check size={16} />}>
              Keep my progress
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default GuestMergePrompt;
