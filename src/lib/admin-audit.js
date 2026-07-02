// =====================================================================
// src/lib/admin-audit.js — the admin AUDIT LOG (accountability trail).
//
// Every privileged admin action appends one row: adminlog:<id> ->
//   { id, action, target, targetName, detail, actorName, actorId, actorUid, ts }
// The BROKER stamps actorId/actorUid + server ts (see kv-write) — the "who/
// when" can't be forged. actorName is display-only. Reads are admin-only
// (kv-read admin tier + the anon-read denylist).
//
// This module is pure except logAdminAction (a fire-and-forget writer that
// must NEVER throw back into the action it's recording). Building/formatting/
// normalizing entries is pure and unit-tested. safeStorage is imported LAZILY
// inside the writer so the pure helpers stay Node-testable (no Vite-only dep).
// =====================================================================
import { KEYS } from './keys.js';

// action id -> { label, icon (lucide name), tone, severity }.
// severity: 'high' (sensitive / cross-user mutation) | 'normal' (content).
export const ACTION_META = {
  'coins.grant':        { label: 'Granted coins',      icon: 'Coins',        tone: '#D97706', severity: 'high' },
  'coins.deduct':       { label: 'Deducted coins',     icon: 'Coins',        tone: '#B45309', severity: 'high' },
  'user.reset':         { label: 'Reset progress',     icon: 'RotateCcw',    tone: '#DC2626', severity: 'high' },
  'user.delete':        { label: 'Deleted account',    icon: 'Trash2',       tone: '#DC2626', severity: 'high' },
  'config.save':        { label: 'Changed config',     icon: 'SlidersHorizontal', tone: '#0F766E', severity: 'normal' },
  'config.reset':       { label: 'Reset config',       icon: 'SlidersHorizontal', tone: '#0F766E', severity: 'normal' },
  'push.send':          { label: 'Sent push',          icon: 'BellRing',     tone: '#C2410C', severity: 'high' },
  'announcement.post':  { label: 'Posted announcement', icon: 'Flag',        tone: '#7C3AED', severity: 'normal' },
  'announcement.clear': { label: 'Cleared announcement', icon: 'Flag',       tone: '#6B7280', severity: 'normal' },
  'faq.create':         { label: 'Created FAQ',        icon: 'HelpCircle',   tone: '#2563EB', severity: 'normal' },
  'faq.update':         { label: 'Edited FAQ',         icon: 'HelpCircle',   tone: '#2563EB', severity: 'normal' },
  'faq.delete':         { label: 'Deleted FAQ',        icon: 'HelpCircle',   tone: '#6B7280', severity: 'normal' },
};

export function actionMeta(action) {
  return ACTION_META[action] || { label: action || 'Action', icon: 'Activity', tone: '#6B7280', severity: 'normal' };
}

const rand = () => Math.random().toString(36).slice(2, 8);

// Build an entry client-side. actorId/actorUid/ts are placeholders — the broker
// overwrites them with verified values on write. `now`/`r` injectable for tests.
export function buildAuditEntry({ action, target, targetName, detail, actorName }, now = Date.now(), r = rand()) {
  return {
    id: `al-${now}-${r}`,
    action: String(action || 'unknown'),
    target: target != null ? String(target) : null,
    targetName: targetName != null ? String(targetName) : null,
    detail: detail && typeof detail === 'object' ? detail : (detail != null ? { note: String(detail) } : null),
    actorName: actorName != null ? String(actorName) : null,
    ts: now, // server overrides
  };
}

// Fire-and-forget: write the entry through the broker. Never throws — a logging
// failure must not break or reverse the action being logged.
export async function logAdminAction(fields) {
  try {
    const { safeStorage } = await import('./safe-storage.js');
    const entry = buildAuditEntry(fields);
    await safeStorage.setSharedStrict(KEYS.adminlog(entry.id), JSON.stringify(entry));
    return true;
  } catch (_) {
    return false;
  }
}

// Normalize a raw list of entries: keep well-formed ones, newest first.
export function normalizeEntries(raw) {
  const out = [];
  for (const e of Array.isArray(raw) ? raw : []) {
    if (!e || typeof e !== 'object' || !e.action) continue;
    out.push({
      id: e.id || `al-${e.ts || 0}`,
      action: String(e.action),
      target: e.target != null ? String(e.target) : null,
      targetName: e.targetName != null ? String(e.targetName) : null,
      detail: e.detail && typeof e.detail === 'object' ? e.detail : null,
      actorName: e.actorName != null ? String(e.actorName) : null,
      actorId: e.actorId != null ? String(e.actorId) : null,
      ts: Number.isFinite(e.ts) ? e.ts : 0,
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

// A short human sentence describing an entry (for the feed + a11y labels).
export function describeEntry(e) {
  const meta = actionMeta(e.action);
  const who = e.actorName || e.actorId || 'An admin';
  const on = e.targetName || e.target;
  const d = e.detail || {};
  switch (e.action) {
    case 'coins.grant':
    case 'coins.deduct': {
      const amt = Math.abs(Number(d.amount) || 0).toLocaleString();
      const dir = e.action === 'coins.grant' ? 'to' : 'from';
      const bal = (d.before != null && d.after != null) ? ` (${Number(d.before).toLocaleString()} → ${Number(d.after).toLocaleString()})` : '';
      return `${who} ${e.action === 'coins.grant' ? 'gave' : 'took'} ${amt} 🪙 ${dir} ${on || 'a user'}${bal}`;
    }
    case 'user.reset':  return `${who} reset ${on || 'a user'}'s progress`;
    case 'user.delete': return `${who} deleted ${on || 'a user'}'s account`;
    case 'config.save': {
      const n = Array.isArray(d.changed) ? d.changed.length : (d.count || 0);
      return `${who} changed ${n || 'some'} config value${n === 1 ? '' : 's'}`;
    }
    case 'config.reset': return `${who} reset the game config to defaults`;
    case 'push.send':    return `${who} sent a push${d.title ? ` “${d.title}”` : ''}${d.sent != null ? ` to ${d.sent} device${Number(d.sent) === 1 ? '' : 's'}` : ''}`;
    case 'announcement.post':  return `${who} posted an announcement${d.title ? `: “${d.title}”` : ''}`;
    case 'announcement.clear': return `${who} cleared the announcement`;
    case 'faq.create': return `${who} created a FAQ${on ? `: “${on}”` : ''}`;
    case 'faq.update': return `${who} edited a FAQ${on ? `: “${on}”` : ''}`;
    case 'faq.delete': return `${who} deleted a FAQ`;
    default: return `${who} — ${meta.label}`;
  }
}
