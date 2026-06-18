// =====================================================================
// src/ui/bookmark-actions.jsx  (#7 — un-bookmark caution)
// One place that gates every "remove bookmark" path. Adding a bookmark is
// frictionless (no prompt); removing one — a potentially costly accidental
// tap — asks first via the shared app-root confirm dialog.
//
//   confirmBookmarkToggle(isBookmarked, applyToggle)
//     isBookmarked  — is the question currently bookmarked?
//     applyToggle   — the function that actually flips the bookmark state.
//
// Use it anywhere a bookmark icon is tapped:
//   onClick={() => confirmBookmarkToggle(isBm, () => doToggle(q.id))}
// =====================================================================
import React from 'react';
import { BookmarkX } from 'lucide-react';
import { requestConfirm } from './primitives.jsx';

export function confirmBookmarkToggle(isBookmarked, applyToggle) {
  // Adding (or re-adding) a bookmark never prompts.
  if (!isBookmarked) { applyToggle(); return; }
  // Removing one asks for a quick confirmation.
  requestConfirm({
    icon: <BookmarkX size={20} style={{ color: '#E5484D' }} />,
    title: 'Remove bookmark?',
    body: 'This question will be removed from your saved list. You can bookmark it again any time.',
    confirmLabel: 'Remove',
    cancelLabel: 'Cancel',
    tone: 'danger',
    onConfirm: applyToggle,
  });
}
