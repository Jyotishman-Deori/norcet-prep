// =====================================================================
// src/screens/recently-deleted.jsx — the undo shelf ("Recently deleted").
// Deletion is a state, not an event: deleted Knowledge-Map notes (synced
// data.trash) and saved Crib Sheets (soft-deleted in their local store) stay
// restorable here for TRASH_RETENTION_DAYS, then are purged for real on load.
// Restore puts the item back exactly where it lived; "Delete now" is the
// one truly irreversible action, so IT carries the confirm friction.
// Opened from Settings. All list math lives in lib/trash.js (tested).
// =====================================================================
import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Undo2, StickyNote, FileText, ListChecks } from 'lucide-react';
import { useTheme, useData, useProfile } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import { loadDeletedCribs, restoreCrib, purgeCrib, daysAgo } from '../lib/cribs.js';
import { purgeTrash, takeFromTrash, addToTrash, trashDaysLeft, TRASH_RETENTION_DAYS } from '../lib/trash.js';

function RecentlyDeleted({ onBack }) {
  const { theme: T } = useTheme();
  const { data, setData } = useData();
  const { profile } = useProfile();
  const pid = (profile && profile.id) || 'guest';

  const [deletedCribs, setDeletedCribs] = useState([]);
  const [confirmId, setConfirmId] = useState(null); // pending "Delete now"
  const [justRestored, setJustRestored] = useState(null); // label for the confirmation line

  useEffect(() => {
    let alive = true;
    loadDeletedCribs(pid).then(c => { if (alive) setDeletedCribs(c); }).catch(() => {});
    return () => { alive = false; };
  }, [pid]);

  // Lazy purge of the synced shelf on open (expired entries are gone for real).
  useEffect(() => {
    setData(prev => {
      const purged = purgeTrash(prev.trash);
      if (purged.length === (Array.isArray(prev.trash) ? prev.trash.length : 0)) return prev;
      return { ...prev, trash: purged };
    });
  }, [setData]);

  // One unified list, newest deletion first.
  const rows = useMemo(() => {
    const noteRows = purgeTrash(data.trash).map(e => ({
      source: 'trash', id: e.id, kind: e.kind, label: e.label,
      sub: e.kind === 'kmap-note' ? 'Topic note' : (e.sub || ''),
      preview: e.payload && typeof e.payload.text === 'string' ? e.payload.text : '',
      deletedAt: e.deletedAt,
    }));
    const cribRows = deletedCribs.map(c => ({
      source: 'crib', id: c.id, kind: 'crib', label: c.title,
      sub: `Crib sheet · ${c.items.length} question${c.items.length === 1 ? '' : 's'}`,
      preview: '', deletedAt: c.deletedAt,
    }));
    return [...noteRows, ...cribRows].sort((a, b) => b.deletedAt - a.deletedAt);
  }, [data.trash, deletedCribs]);

  const flashRestored = (label) => {
    setJustRestored(label);
    setTimeout(() => setJustRestored(v => (v === label ? null : v)), 3200);
  };

  const restore = async (row) => {
    setConfirmId(null);
    if (row.source === 'crib') {
      const { deleted } = await restoreCrib(pid, row.id);
      setDeletedCribs(deleted);
    } else {
      setData(prev => {
        const { entry, rest } = takeFromTrash(prev.trash, row.id);
        if (!entry) return prev;
        const out = { ...prev, trash: rest };
        if (entry.kind === 'kmap-note' && entry.payload && entry.payload.key) {
          const key = entry.payload.key;
          const notes = prev.mindmapNotes || {};
          // A newer note may exist on that topic; restoring displaces it INTO
          // the trash rather than silently overwriting it, so nothing is lost.
          if (notes[key] && notes[key].text && notes[key].text !== entry.payload.text) {
            out.trash = addToTrash(rest, {
              kind: 'kmap-note', label: entry.label,
              payload: { key, text: notes[key].text },
            });
          }
          out.mindmapNotes = { ...notes, [key]: { text: entry.payload.text, updatedAt: Date.now() } };
        }
        return out;
      });
    }
    flashRestored(row.label);
  };

  const deleteForever = async (row) => {
    setConfirmId(null);
    if (row.source === 'crib') setDeletedCribs(await purgeCrib(pid, row.id));
    else setData(prev => ({ ...prev, trash: takeFromTrash(prev.trash, row.id).rest }));
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Recently deleted" onBack={onBack} solid />
      <div className="max-w-md md:max-w-2xl mx-auto px-4 md:px-6 pb-24 pt-2 space-y-3">
        <Card className="p-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: T.primary + '18' }}>
              <Trash2 size={17} style={{ color: T.primary }} />
            </div>
            <div className="text-[12.5px] leading-relaxed" style={{ color: T.inkSoft }}>
              Deleted notes and crib sheets wait here for <b>{TRASH_RETENTION_DAYS} days</b> before
              they are gone for good. Restore puts them back exactly where they were.
            </div>
          </div>
        </Card>

        {justRestored && (
          <div className="text-[12.5px] rounded-xl px-3 py-2.5 anim-fadeup flex items-center gap-2"
               style={{ background: T.successSoft, border: `1px solid ${T.success}44`, color: T.success }}>
            <Undo2 size={14} /> Restored "{justRestored}".
          </div>
        )}

        {rows.length === 0 ? (
          <div className="text-center pt-12">
            <Trash2 size={30} className="mx-auto mb-3" style={{ color: T.muted }} />
            <div className="text-sm font-medium" style={{ color: T.ink }}>Nothing in the trash</div>
            <div className="text-[12px] mt-1" style={{ color: T.muted }}>
              Anything you delete stays restorable here for {TRASH_RETENTION_DAYS} days.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(row => {
              const Icon = row.kind === 'crib' ? FileText : StickyNote;
              const left = trashDaysLeft(row.deletedAt);
              return (
                <Card key={`${row.source}-${row.id}`} className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: T.surfaceWarm }}>
                      <Icon size={16} style={{ color: T.inkSoft }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate" style={{ color: T.ink }}>{row.label}</div>
                      <div className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: T.muted }}>
                        {row.sub && <span>{row.sub}</span>}
                        {row.sub && <span>·</span>}
                        <span>deleted {daysAgo(row.deletedAt).toLowerCase()}</span>
                        <span className="px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: left <= 1 ? T.errorSoft : T.surfaceWarm, color: left <= 1 ? T.error : T.muted }}>
                          {left} day{left === 1 ? '' : 's'} left
                        </span>
                      </div>
                      {row.preview && (
                        <div className="text-[11.5px] mt-1 truncate" style={{ color: T.inkSoft }}>{row.preview}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => restore(row)} aria-label={`Restore ${row.label}`}
                              className="no-tap-highlight text-[11px] font-bold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 active:scale-95 transition"
                              style={{ background: T.primary + '18', color: T.primary }}>
                        <Undo2 size={12} /> Restore
                      </button>
                      {confirmId === `${row.source}-${row.id}` ? (
                        <button onClick={() => deleteForever(row)}
                                className="no-tap-highlight text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-95 transition"
                                style={{ background: T.error, color: '#FFF' }}>
                          Sure?
                        </button>
                      ) : (
                        <button onClick={() => { const k = `${row.source}-${row.id}`; setConfirmId(k); setTimeout(() => setConfirmId(v => (v === k ? null : v)), 2500); }}
                                aria-label={`Delete ${row.label} forever`}
                                className="no-tap-highlight p-2 rounded-lg active:bg-black/10">
                          <Trash2 size={14} style={{ color: T.muted }} />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {rows.length > 0 && (
          <div className="text-[11px] text-center pt-1 flex items-center justify-center gap-1" style={{ color: T.muted }}>
            <ListChecks size={12} /> Deleting from here is immediate and cannot be undone.
          </div>
        )}
      </div>
    </div>
  );
}

export default RecentlyDeleted;
