// =====================================================================
// src/lib/backup-status.js — pure presentation logic for the Sync & Backup
// screen (the WhatsApp-style status card). No storage, no React.
//
// The app already syncs the whole profile blob to the cloud offline-first
// (lib/profiles.js saveProfile: local cache first → Supabase, with a
// pending-sync queue that drains on reconnect). This module turns the raw
// signals (guest? online? how many profiles pending? last confirmed sync)
// into the four display states the screen renders. The pending-sync count
// is the source of truth for "am I backed up": 0 = everything is on the
// cloud; >0 = still catching up.
// =====================================================================

// describeSyncState(input) → { state, title, detail, tone, showBackupNow }
//   state:  'guest'   — no account, nothing is in the cloud
//           'offline' — account, but no connection right now
//           'pending' — account + online, changes still uploading
//           'synced'  — account + online + nothing pending (backed up ✓)
//   tone:   'warn' | 'muted' | 'progress' | 'ok'  (UI maps to colours)
// input: { isGuest, online, pendingCount, lastSyncedAt, now }
export function describeSyncState(input) {
  const i = input || {};
  const now = typeof i.now === 'number' ? i.now : Date.now();
  const pending = Math.max(0, Number(i.pendingCount) || 0);

  if (i.isGuest) {
    return {
      state: 'guest',
      tone: 'warn',
      title: 'Not backed up yet',
      detail: 'You’re signed out, so your progress lives only on this device. Sign in and it’s automatically backed up to the cloud — and restores on any device you sign in on.',
      showBackupNow: false,
    };
  }
  if (i.online === false) {
    return {
      state: 'offline',
      tone: 'muted',
      title: pending > 0 ? 'Waiting for connection' : 'You’re offline',
      detail: pending > 0
        ? 'Your latest changes are saved on this device and will back up automatically the moment you’re online.'
        : 'Everything so far is backed up. New changes will sync when you reconnect.',
      showBackupNow: false,
    };
  }
  if (pending > 0) {
    return {
      state: 'pending',
      tone: 'progress',
      title: 'Backing up…',
      detail: 'Uploading your latest changes to the cloud. This usually takes a moment.',
      showBackupNow: true,
    };
  }
  return {
    state: 'synced',
    tone: 'ok',
    title: 'Backed up to the cloud',
    detail: lastSyncedLine(i.lastSyncedAt, now),
    showBackupNow: true,
  };
}

function lastSyncedLine(lastSyncedAt, now) {
  const base = 'Your progress restores automatically when you sign in on another device — no files needed.';
  const rel = relTimeShort(lastSyncedAt, now);
  return rel ? `Last backed up ${rel}. ${base}` : base;
}

// relTimeShort(ms, now?) → 'just now' | 'Nm ago' | 'Nh ago' | 'Nd ago' | null
// null for missing/invalid/future timestamps (caller omits the clause).
export function relTimeShort(ms, now = Date.now()) {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0 || t > now) return null;
  const s = Math.floor((now - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
