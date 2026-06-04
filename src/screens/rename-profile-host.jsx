// =====================================================================
// src/screens/rename-profile-host.jsx — app-root host for the rename-profile
// modal (A1 slice 40). Listens on the rename channel (registerRenameOpener)
// and mounts RenameProfileModal (slice 19) at the root so its position:fixed
// overlay isn't broken by a transformed Settings ancestor. No theme reads.
// Render site (<RenameProfileHost/>) unchanged.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { registerRenameOpener } from '../ui/rename-channel.js';
import RenameProfileModal from './rename-profile-modal.jsx';

function RenameProfileHost() {
  const [ctx, setCtx] = useState(null); // null = closed; otherwise { profile, onRename }
  useEffect(() => registerRenameOpener((c) => setCtx(c || null)), []);
  if (!ctx || !ctx.profile) return null;
  return (
    <RenameProfileModal
      profile={ctx.profile}
      onRename={ctx.onRename}
      onClose={() => setCtx(null)}
    />
  );
}

export default RenameProfileHost;
