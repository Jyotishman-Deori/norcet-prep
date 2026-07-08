// =====================================================================
// src/screens/share-app.jsx  (issues round — Settings → Share sub-page)
// The full "Share NurseHolic" experience (platform selector, live message
// preview, Share / Copy actions) moved out of the Settings scroll into its
// own focused page. Settings keeps a single tappable row that opens this.
// All the actual share UI lives in ui/share-app-card.jsx (now rendered
// frameless here via its `page` prop).
// =====================================================================
import React from 'react';
import { useTheme } from '../lib/app-context.jsx';
import { TopBar } from '../ui/primitives.jsx';
import ShareAppCard from '../ui/share-app-card.jsx';

function ShareAppScreen({ onBack }) {
  const { theme: T } = useTheme();
  return (
    <div className="anim-fadeup">
      <TopBar title="Share NurseHolic" onBack={onBack} feedback={{ screen: 'Share app' }} />
      <div className="max-w-md mx-auto px-4 pt-3 pb-24">
        <div className="text-xs leading-relaxed mb-4 px-1" style={{ color: T.muted }}>
          Pick who you're sending it to, the message carries the link <b>and</b> the
          exact setup steps for your friend's device.
        </div>
        <ShareAppCard page />
      </div>
    </div>
  );
}

export default ShareAppScreen;
