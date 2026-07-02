// =====================================================================
// src/ui/admin-audit-log.jsx  (admin → Audit log)
// Chronological, tamper-evident feed of every privileged admin action
// (coin grants, resets, deletes, config changes, pushes, content edits).
// Reads adminlog: rows through kv-read (admin-only). Actor + timestamp are
// SERVER-stamped (kv-write), so the "who/when" can't be forged. All parsing
// / formatting is lib/admin-audit.js (unit-tested); this is presentation.
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollText, RefreshCw, Coins, RotateCcw, Trash2, SlidersHorizontal,
  BellRing, Flag, HelpCircle, Activity, ShieldAlert,
} from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from './primitives.jsx';
import { safeStorage } from '../lib/safe-storage.js';
import { KEY_PREFIXES } from '../lib/keys.js';
import { normalizeEntries, describeEntry, actionMeta } from '../lib/admin-audit.js';

const ICONS = { Coins, RotateCcw, Trash2, SlidersHorizontal, BellRing, Flag, HelpCircle, Activity };

async function loadAudit() {
  let keys = [];
  try {
    const r = await safeStorage.list(KEY_PREFIXES.ADMINLOG, true); // admin broker list
    keys = (r && r.keys) ? r.keys : [];
  } catch (e) { return []; }
  const items = await Promise.all(keys.map(async k => {
    try { const r = await safeStorage.get(k, true); if (r && r.value) return JSON.parse(r.value); } catch (e) {}
    return null;
  }));
  return normalizeEntries(items);
}

function whenLabel(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const FILTERS = [
  { id: 'all',   label: 'All' },
  { id: 'high',  label: 'Sensitive' },
  { id: 'user',  label: 'Users' },
  { id: 'content', label: 'Content' },
];
function matchesFilter(e, f) {
  if (f === 'all') return true;
  const meta = actionMeta(e.action);
  if (f === 'high') return meta.severity === 'high';
  if (f === 'user') return e.action.startsWith('coins.') || e.action.startsWith('user.');
  if (f === 'content') return e.action.startsWith('faq.') || e.action.startsWith('announcement.') || e.action.startsWith('config.');
  return true;
}

export default function AdminAuditLog({ onBack }) {
  const { theme: T } = useTheme();
  const [entries, setEntries] = useState(null);
  const [spin, setSpin] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = async () => { setSpin(true); try { setEntries(await loadAudit()); } catch (e) { setEntries([]); } finally { setSpin(false); } };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (entries || []).filter(e => matchesFilter(e, filter)), [entries, filter]);

  // group by calendar day for a clean timeline
  const groups = useMemo(() => {
    const m = new Map();
    for (const e of shown) {
      const key = e.ts ? new Date(e.ts).toDateString() : 'Unknown';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(e);
    }
    return [...m.entries()];
  }, [shown]);

  const dayLabel = (str) => {
    if (str === 'Unknown') return 'Unknown date';
    const d = new Date(str), today = new Date();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Audit log" onBack={onBack}
              right={
                <button onClick={load} disabled={spin} aria-label="Refresh"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5">
                  <RefreshCw size={18} style={{ color: T.muted }} className={spin ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="text-xs leading-relaxed mb-3 px-1 flex items-start gap-1.5" style={{ color: T.muted }}>
          <ShieldAlert size={13} className="flex-shrink-0 mt-0.5" />
          <span>Every privileged action, newest first. The <b>who</b> and <b>when</b> are stamped by the server and can't be edited.</span>
        </div>

        {/* filter chips */}
        <div className="flex gap-2 mb-3">
          {FILTERS.map(f => {
            const on = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                      className="no-tap-highlight flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors active:scale-95"
                      style={{ background: on ? T.primary : T.surface, color: on ? '#FFF' : T.inkSoft, border: `1px solid ${on ? T.primary : T.border}` }}>
                {f.label}
              </button>
            );
          })}
        </div>

        {entries === null ? (
          <Card className="p-6 text-center"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : shown.length === 0 ? (
          <Card className="p-8 text-center">
            <ScrollText size={26} className="mx-auto mb-2" style={{ color: T.muted }} />
            <div className="text-sm font-semibold" style={{ color: T.ink }}>{filter === 'all' ? 'No admin actions logged yet' : 'Nothing in this filter'}</div>
            <div className="text-[12px] mt-1" style={{ color: T.muted }}>Actions like coin grants, resets, config changes and pushes appear here from now on.</div>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map(([day, list]) => (
              <div key={day}>
                <div className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-1" style={{ color: T.muted }}>{dayLabel(day)}</div>
                <div className="space-y-2">
                  {list.map((e, i) => {
                    const meta = actionMeta(e.action);
                    const Icon = ICONS[meta.icon] || Activity;
                    const high = meta.severity === 'high';
                    return (
                      <Card key={e.id} className="p-3 eng-kpi" style={{ animationDelay: `${Math.min(i, 8) * 35}ms`, borderLeft: `3px solid ${meta.tone}` }}>
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: meta.tone + '1E' }}>
                            <Icon size={15} style={{ color: meta.tone }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] leading-snug" style={{ color: T.ink }}>{describeEntry(e)}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {high && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: meta.tone + '22', color: meta.tone }}>Sensitive</span>}
                              <span className="text-[10.5px]" style={{ color: T.muted }}>
                                {whenLabel(e.ts)}{e.actorId ? ` · ${e.actorName || e.actorId}` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
