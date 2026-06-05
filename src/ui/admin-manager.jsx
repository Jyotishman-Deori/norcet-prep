// =====================================================================
// src/ui/admin-manager.jsx — in-app "Manage admins" panel (soft model).
// Rendered inside Settings → Admin, only when the current profile is admin.
// Lists everyone in admin_profile_ids, lets an admin add/remove others by
// profile id (slug or uid), and shows the current user's own id with a copy
// button so it's easy to share for promotion. All writes go through lib/admin.js
// (anon PostgREST) and require the SOFT RLS grant on admin_profile_ids.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Copy, Check, Trash2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, Button } from './primitives.jsx';
import { listAdmins, addAdmin, removeAdmin } from '../lib/admin.js';

export default function AdminManager() {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const myId = profile ? (profile.uid || profile.id) : null;

  const [list, setList] = useState(null);   // null = loading
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newId, setNewId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [copied, setCopied] = useState(false);
  const [pass, setPass] = useState('');   // admin passphrase — verified server-side for writes

  const load = async () => {
    setErr(null);
    try { setList(await listAdmins()); }
    catch (e) { setList([]); setErr('Couldn’t load the admin list — are you online?'); }
  };
  useEffect(() => { load(); }, []);

  const onAdd = async () => {
    const id = newId.trim();
    if (!id || busy) return;
    if (!pass.trim()) { setErr('Enter the admin passphrase to make changes.'); return; }
    setBusy(true); setErr(null);
    try { await addAdmin(id, newNote.trim() || null, pass); setNewId(''); setNewNote(''); await load(); }
    catch (e) { setErr(e && e.status === 401 ? 'Wrong passphrase.' : 'Couldn’t add that id. Check it and your connection.'); }
    setBusy(false);
  };

  const onRemove = async (id) => {
    if (busy) return;
    if (!pass.trim()) { setErr('Enter the admin passphrase to make changes.'); return; }
    setBusy(true); setErr(null);
    try { await removeAdmin(id, pass); await load(); }
    catch (e) { setErr(e && e.status === 401 ? 'Wrong passphrase.' : 'Couldn’t remove — try again.'); }
    setBusy(false);
  };

  const copyMine = async () => {
    if (!myId) return;
    try { await navigator.clipboard.writeText(myId); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (e) { setErr('Copy failed — long-press the id to copy manually.'); }
  };

  return (
    <Card className="p-4 mb-3">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={16} style={{ color: T.accent }} />
        <div className="font-medium text-sm" style={{ color: T.ink }}>Manage admins</div>
      </div>
      <div className="text-xs mb-3" style={{ color: T.muted }}>
        Everyone listed here is a full admin. Add by profile id (or uid).
      </div>

      {/* Your own id, for sharing */}
      {myId && (
        <div className="flex items-center justify-between gap-2 mb-3 px-2.5 py-2 rounded-lg"
             style={{ background: T.surfaceWarm }}>
          <div className="min-w-0">
            <div className="text-[11px]" style={{ color: T.muted }}>Your id</div>
            <div className="text-xs font-mono truncate" style={{ color: T.inkSoft }}>{myId}</div>
          </div>
          <button onClick={copyMine}
                  className="no-tap-highlight flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium active:bg-black/5"
                  style={{ color: copied ? T.success : T.accent }} aria-label="Copy your id">
            {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* Passphrase — required for any add/remove, verified server-side by the Edge Function */}
      <div className="mb-3">
        <input value={pass} onChange={e => setPass(e.target.value)} type="password"
               placeholder="Admin passphrase (required to add/remove)"
               className="w-full rounded-lg px-3 py-2 text-sm"
               style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }} />
      </div>

      {/* Current admins */}
      {list === null ? (
        <div className="text-xs py-2" style={{ color: T.muted }}>Loading…</div>
      ) : list.length === 0 ? (
        <div className="text-xs py-2" style={{ color: T.muted }}>No admins listed yet.</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-3">
          {list.map((a) => (
            <div key={a.profile_id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg"
                 style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <div className="min-w-0">
                <div className="text-xs font-mono truncate" style={{ color: T.ink }}>{a.profile_id}</div>
                {a.note && <div className="text-[11px] truncate" style={{ color: T.muted }}>{a.note}</div>}
              </div>
              <button onClick={() => onRemove(a.profile_id)} disabled={busy}
                      className="no-tap-highlight p-1.5 -m-1 rounded-lg active:bg-black/5"
                      aria-label={`Remove ${a.profile_id}`}>
                <Trash2 size={14} style={{ color: T.danger || '#b00' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="flex flex-col gap-2">
        <input value={newId} onChange={e => setNewId(e.target.value)}
               placeholder="Profile id or uid to add"
               className="w-full rounded-lg px-3 py-2 text-sm"
               style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }} />
        <input value={newNote} onChange={e => setNewNote(e.target.value)}
               placeholder="Note (optional, e.g. name)"
               className="w-full rounded-lg px-3 py-2 text-sm"
               style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.ink }} />
        <div className="flex gap-2">
          <Button onClick={onAdd} disabled={busy || !newId.trim()} className="flex-1"
                  icon={busy ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}>
            Add admin
          </Button>
          <Button variant="ghost" onClick={load} disabled={busy} icon={<RefreshCw size={14} />}>
            Refresh
          </Button>
        </div>
      </div>

      {err && <div className="text-xs mt-2 px-1" style={{ color: T.error || '#c00' }}>{err}</div>}
    </Card>
  );
}
