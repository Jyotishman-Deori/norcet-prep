// =====================================================================
// src/ui/admin-manager.jsx — "Manage admins" Admin Panel detail screen.
// Reached from the Manage admins tile (AdminPanel sets view='manageAdmins').
// Mirrors the other detail views: TopBar + max-w-md body.
//
//   - Lists everyone in admin_profile_ids (direct anon REST read).
//   - Shows YOUR id with a copy button (so it's easy to add others).
//   - Passphrase field (verified server-side by the Edge Function).
//   - Add: profile id (+ optional note) -> Edge Function action "add".
//   - Remove (per row) -> Edge Function action "remove".
//   - HTTP 401 from the function is shown as "Wrong passphrase".
// =====================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Trash2, Plus, RefreshCw } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, Button, TopBar } from './primitives.jsx';
import { listAdmins, addAdmin, removeAdmin } from '../lib/admin.js';

export default function AdminManager({ onBack }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const myId = profile ? (profile.uid || profile.id) : null;

  const [list, setList] = useState(null);   // null = loading
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newId, setNewId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [pass, setPass] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try { setList(await listAdmins()); }
    catch (e) { setList([]); setErr('Couldn’t load the admin list — are you online?'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // 401 from the Edge Function => wrong passphrase; anything else => fallback.
  const msgFor = (e, fallback) => (e && e.status === 401 ? 'Wrong passphrase' : fallback);

  const onAdd = async () => {
    const id = newId.trim();
    if (!id || busy) return;
    if (!pass.trim()) { setErr('Enter the admin passphrase to make changes.'); return; }
    setBusy(true); setErr(null);
    try {
      await addAdmin(id, pass, newNote.trim() || null);
      setNewId(''); setNewNote('');
      await load();
    } catch (e) { setErr(msgFor(e, 'Couldn’t add that id. Check it and your connection.')); }
    setBusy(false);
  };

  const onRemove = async (id) => {
    if (busy) return;
    if (!pass.trim()) { setErr('Enter the admin passphrase to make changes.'); return; }
    setBusy(true); setErr(null);
    try { await removeAdmin(id, pass); await load(); }
    catch (e) { setErr(msgFor(e, 'Couldn’t remove — try again.')); }
    setBusy(false);
  };

  const copyMine = async () => {
    if (!myId) return;
    try {
      await navigator.clipboard.writeText(myId);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch (e) { setErr('Copy failed — long-press the id to copy manually.'); }
  };

  return (
    <div className="anim-fadeup">
      <TopBar title="Manage admins" onBack={onBack}
              right={
                <button onClick={load} disabled={busy} aria-label="Refresh"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                  <RefreshCw size={18} style={{ color: T.muted }} className={list === null ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.muted }}>
          Everyone listed here is a full admin. Add or remove by profile id (or uid).
          Changes require the admin passphrase, which is verified on the server.
        </div>

        {/* Your own id — handy for adding yourself or sharing */}
        {myId && (
          <Card className="p-3 mb-3" style={{ background: T.surfaceWarm }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px]" style={{ color: T.muted }}>Your id</div>
                <div className="text-xs font-mono truncate" style={{ color: T.inkSoft }}>{myId}</div>
              </div>
              <button onClick={copyMine}
                      className="no-tap-highlight flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium active:bg-black/5"
                      style={{ color: copied ? T.success : T.primary }} aria-label="Copy your id">
                {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </Card>
        )}

        {/* Passphrase — required for any add/remove */}
        <input value={pass} onChange={e => setPass(e.target.value)} type="password"
               placeholder="Admin passphrase (required to add/remove)"
               className="w-full rounded-xl px-3 py-2.5 mb-3 text-sm"
               style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />

        {/* Current admins */}
        {list === null ? (
          <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : list.length === 0 ? (
          <Card className="p-4"><div className="text-sm" style={{ color: T.muted }}>No admins listed yet.</div></Card>
        ) : (
          <div className="space-y-2 mb-3">
            {list.map(a => (
              <Card key={a.profile_id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-mono truncate" style={{ color: T.ink }}>{a.profile_id}</div>
                    {a.note && <div className="text-[11px] truncate" style={{ color: T.muted }}>{a.note}</div>}
                  </div>
                  <button onClick={() => onRemove(a.profile_id)} disabled={busy}
                          className="no-tap-highlight p-1.5 -m-1 flex-shrink-0 rounded-lg active:bg-black/5 disabled:opacity-50"
                          aria-label={`Remove ${a.profile_id}`}>
                    <Trash2 size={15} style={{ color: T.error }} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add form */}
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: T.muted }}>Add an admin</div>
          <input value={newId} onChange={e => setNewId(e.target.value)}
                 placeholder="Profile id or uid"
                 className="w-full rounded-xl px-3 py-2.5 mb-2 text-sm"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
          <input value={newNote} onChange={e => setNewNote(e.target.value)}
                 placeholder="Note (optional, e.g. name)"
                 className="w-full rounded-xl px-3 py-2.5 mb-2 text-sm"
                 style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.ink }} />
          <Button onClick={onAdd} disabled={busy || !newId.trim()} className="w-full"
                  icon={busy ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}>
            Add admin
          </Button>
        </Card>

        {err && <div className="text-xs mt-3 px-1" style={{ color: T.error }}>{err}</div>}
      </div>
    </div>
  );
}
