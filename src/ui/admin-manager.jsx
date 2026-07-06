// =====================================================================
// src/ui/admin-manager.jsx — "Manage admins" Admin Panel detail screen.
// Reached from the Manage admins tile (AdminPanel sets view='manageAdmins').
//
// Model today: a single OWNER (you) + zero or more full ADMINS. The richer
// Co-Admin / Moderator tiers are a planned expansion (see the journal's
// "Role hierarchy" spec) and are intentionally NOT faked here.
//
//   - Lists everyone in admin_profile_ids, resolving each id/uid to a real
//     USERNAME (admin-manage resolve-profiles → profile_secrets).
//   - Splits them into OWNER (you) and OTHER ADMINS so the hierarchy is clear.
//   - You can NEVER remove your own access (no self-lockout footgun).
//   - Add flow: type an id/uid → it resolves the username live → you confirm
//     WHO you're granting admin to before it's written.
//   - Passphrase (verified server-side) gates every add/remove.
// =====================================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy, Check, Trash2, UserPlus, RefreshCw, ShieldCheck, Crown,
  Lock, Search, AlertTriangle, User as UserIcon, X,
} from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, Button, TopBar, requestConfirm } from './primitives.jsx';
import { listAdmins, addAdmin, removeAdmin, resolveAdminProfiles } from '../lib/admin.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Short, human-friendly rendering of a long id/uid: keep it copyable but not
// visually overwhelming. UUIDs collapse to head…tail; slugs show whole.
function shortId(id) {
  const s = String(id || '');
  if (UUID_RE.test(s)) return `${s.slice(0, 8)}…${s.slice(-4)}`;
  return s;
}

export default function AdminManager({ onBack }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const myId = profile ? profile.id : null;
  const myUid = profile ? profile.uid : null;
  const myName = profile ? (profile.displayName || profile.id) : null;

  const [list, setList] = useState(null);   // null = loading; [{profile_id, note, added_at}]
  const [names, setNames] = useState({});    // id-or-uid → display_name
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);        // success toast text
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Add form
  const [newId, setNewId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [lookup, setLookup] = useState(null); // null | {status:'looking'|'found'|'missing', name?}
  const lookupTimer = useRef(null);

  const isMineRow = useCallback(
    (pid) => !!pid && (pid === myId || pid === myUid),
    [myId, myUid],
  );

  // Resolve a set of ids/uids → display names and merge into the name map.
  const resolveNames = useCallback(async (ids) => {
    const rows = await resolveAdminProfiles(ids);
    if (!rows.length) return {};
    const map = {};
    for (const r of rows) {
      if (r.display_name) {
        if (r.id) map[r.id] = r.display_name;
        if (r.uid) map[r.uid] = r.display_name;
      }
    }
    setNames((prev) => ({ ...prev, ...map }));
    return map;
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const rows = await listAdmins();
      setList(rows);
      // Resolve everyone's name in one call (my own name I already know).
      const ids = rows.map((a) => a.profile_id).filter((id) => !isMineRow(id));
      if (ids.length) resolveNames(ids);
    } catch (e) {
      setList([]);
      setErr('Couldn’t load the admin list — are you online?');
    }
  }, [isMineRow, resolveNames]);
  useEffect(() => { load(); }, [load]);

  // Live lookup of the id being typed in the Add form (debounced).
  useEffect(() => {
    const id = newId.trim();
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!id || id.length < 3) { setLookup(null); return; }
    setLookup({ status: 'looking' });
    lookupTimer.current = setTimeout(async () => {
      const rows = await resolveAdminProfiles([id]);
      const match = rows.find((r) => r.id === id || r.uid === id);
      setLookup(match ? { status: 'found', name: match.display_name } : { status: 'missing' });
    }, 450);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [newId]);

  const msgFor = (e, fallback) => (e && e.status === 401 ? 'Wrong passphrase' : fallback);

  const doAdd = async () => {
    const id = newId.trim();
    if (!id || busy) return;
    if (!pass.trim()) { setErr('Enter the admin passphrase to make changes.'); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      await addAdmin(id, pass, newNote.trim() || null);
      const grantedName = (lookup && lookup.status === 'found' && lookup.name) || shortId(id);
      setNewId(''); setNewNote(''); setLookup(null);
      setOk(`${grantedName} is now an admin.`);
      await load();
    } catch (e) { setErr(msgFor(e, 'Couldn’t add that id. Check it and your connection.')); }
    setBusy(false);
  };

  // Add → confirm WHO before granting. Shows the resolved username (or a clear
  // warning that no profile matched) so admin is never granted to a typo.
  const onAddClick = () => {
    const id = newId.trim();
    if (!id) { setErr('Enter a profile id or uid to add.'); return; }
    if (!pass.trim()) { setErr('Enter the admin passphrase to make changes.'); return; }
    const found = lookup && lookup.status === 'found';
    requestConfirm({
      icon: found ? <ShieldCheck size={20} style={{ color: T.primary }} /> : <AlertTriangle size={20} style={{ color: T.warning || '#D4900A' }} />,
      title: found ? `Make ${lookup.name} an admin?` : 'Add this id as an admin?',
      body: found
        ? `${lookup.name} will get FULL admin access — announcements, live config, user management, everything. Make sure this is the right person.`
        : `No registered profile matches “${shortId(id)}”. Double-check the id/uid — adding a wrong one just creates a dead entry. Add it anyway?`,
      confirmLabel: found ? 'Grant admin' : 'Add anyway',
      cancelLabel: 'Cancel',
      tone: found ? 'primary' : 'danger',
      onConfirm: doAdd,
    });
  };

  const onRemove = (a) => {
    if (busy) return;
    if (isMineRow(a.profile_id)) return; // guarded in UI too — never removable
    if (!pass.trim()) { setErr('Enter the admin passphrase to make changes.'); return; }
    const name = names[a.profile_id] || a.note || shortId(a.profile_id);
    requestConfirm({
      icon: <Trash2 size={20} style={{ color: T.error }} />,
      title: `Remove ${name}?`,
      body: `${name} will immediately lose all admin access on their next action. They stay a normal user — nothing else is deleted. You can re-add them anytime.`,
      confirmLabel: 'Remove admin',
      cancelLabel: 'Cancel',
      tone: 'danger',
      onConfirm: async () => {
        setBusy(true); setErr(null); setOk(null);
        try { await removeAdmin(a.profile_id, pass); setOk(`${name} is no longer an admin.`); await load(); }
        catch (e) { setErr(msgFor(e, 'Couldn’t remove — try again.')); }
        setBusy(false);
      },
    });
  };

  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id); setTimeout(() => setCopiedId(null), 1500);
    } catch (e) { setErr('Copy failed — long-press the id to copy manually.'); }
  };

  // Split rows into OWNER (you) and OTHER admins for a clear hierarchy.
  const rows = list || [];
  const mine = rows.filter((a) => isMineRow(a.profile_id));
  const others = rows.filter((a) => !isMineRow(a.profile_id));

  const nameFor = (a) => names[a.profile_id] || null;

  const RoleBadge = ({ kind }) => {
    const map = {
      owner: { label: 'Owner', bg: '#E5484D18', fg: '#E5484D', Icon: Crown },
      admin: { label: 'Admin', bg: T.primary + '18', fg: T.primary, Icon: ShieldCheck },
    };
    const m = map[kind];
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: m.bg, color: m.fg }}>
        <m.Icon size={11} /> {m.label}
      </span>
    );
  };

  // One admin row card (used for both tiers). `owner` = your protected rows.
  const AdminRow = ({ a, owner }) => {
    const name = owner ? myName : nameFor(a);
    const pid = a.profile_id;
    return (
      <Card className="p-3.5 mb-2" style={owner ? { border: `1.5px solid #E5484D40`, background: '#E5484D08' } : undefined}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
               style={{ background: owner ? '#E5484D18' : T.primary + '14' }}>
            {owner ? <Crown size={18} style={{ color: '#E5484D' }} /> : <UserIcon size={18} style={{ color: T.primary }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[15px] truncate" style={{ color: T.ink }}>
                {name || <span style={{ color: T.muted, fontStyle: 'italic', fontWeight: 400 }}>Unknown profile</span>}
              </span>
              <RoleBadge kind={owner ? 'owner' : 'admin'} />
              {owner && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: T.ink + '12', color: T.inkSoft }}>You</span>
              )}
            </div>
            {/* id/uid shown WITH the name so there's zero ambiguity */}
            <button onClick={() => copyId(pid)}
                    className="no-tap-highlight mt-1 inline-flex items-center gap-1.5 text-[11px] font-mono max-w-full active:opacity-70"
                    style={{ color: T.muted }} aria-label="Copy id">
              <span className="truncate">{pid}</span>
              {copiedId === pid ? <Check size={12} className="flex-shrink-0" style={{ color: T.success }} />
                                : <Copy size={12} className="flex-shrink-0" style={{ opacity: 0.7 }} />}
            </button>
            {a.note && !owner && (
              <div className="text-[11px] mt-1 truncate" style={{ color: T.muted }}>{a.note}</div>
            )}
          </div>
          {owner ? (
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5" title="You can't remove your own access">
              <Lock size={15} style={{ color: T.muted }} />
            </div>
          ) : (
            <button onClick={() => onRemove(a)} disabled={busy}
                    className="no-tap-highlight p-2 -m-1 flex-shrink-0 rounded-lg active:bg-black/5 disabled:opacity-50"
                    aria-label={`Remove ${name || pid}`}>
              <Trash2 size={16} style={{ color: T.error }} />
            </button>
          )}
        </div>
      </Card>
    );
  };

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

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

        {/* Hierarchy explainer */}
        <Card className="p-3.5 mb-4" style={{ background: `linear-gradient(150deg, ${T.primary}0E, transparent 70%)` }}>
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
            <div className="text-[12px] leading-relaxed" style={{ color: T.inkSoft }}>
              <span className="font-semibold" style={{ color: T.ink }}>You’re the owner.</span> Everyone you add
              below is a <span className="font-semibold" style={{ color: T.ink }}>full admin</span> with the same
              powers as you — except they can’t remove you. Every change needs the admin passphrase.
            </div>
          </div>
        </Card>

        {/* Passphrase — required for any add/remove */}
        <div className="relative mb-4">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
          <input value={pass} onChange={e => setPass(e.target.value)} type="password"
                 placeholder="Admin passphrase — required to add or remove"
                 className="w-full rounded-xl pl-9 pr-3 py-3 text-sm" style={inputStyle} />
        </div>

        {/* OWNER tier */}
        <div className="text-[11px] uppercase tracking-wider font-semibold mb-2 px-1" style={{ color: T.muted }}>Owner</div>
        {list === null ? (
          <Card className="p-4 mb-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
        ) : mine.length ? (
          <div className="mb-4">{mine.map(a => <AdminRow key={a.profile_id} a={a} owner />)}</div>
        ) : (
          // You aren't in the list under your current identity — surface your id
          // so you can add yourself (prevents an accidental lock-out).
          <Card className="p-3.5 mb-4" style={{ background: T.warningSoft || '#F4A62615', border: `1px solid ${(T.warning || '#D4900A')}40` }}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.warning || '#D4900A' }} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ color: T.ink }}>Your account isn’t in the list</div>
                <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: T.inkSoft }}>
                  You’re signed in as <span className="font-semibold">{myName}</span>. Add your id below to secure your access.
                </div>
                {myUid && (
                  <button onClick={() => copyId(myUid)}
                          className="no-tap-highlight mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-mono active:opacity-70" style={{ color: T.muted }}>
                    <span className="truncate">{myUid}</span>
                    {copiedId === myUid ? <Check size={12} style={{ color: T.success }} /> : <Copy size={12} style={{ opacity: 0.7 }} />}
                  </button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ADMINS tier */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
            Admins{others.length ? ` · ${others.length}` : ''}
          </div>
        </div>
        {list === null ? null : others.length === 0 ? (
          <Card className="p-4 mb-4">
            <div className="text-sm" style={{ color: T.muted }}>No other admins yet. Add someone below to share the load.</div>
          </Card>
        ) : (
          <div className="mb-4">{others.map(a => <AdminRow key={a.profile_id} a={a} owner={false} />)}</div>
        )}

        {/* Add form with live username preview */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={16} style={{ color: T.primary }} />
            <div className="font-semibold text-sm" style={{ color: T.ink }}>Add an admin</div>
          </div>

          <div className="relative mb-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
            <input value={newId} onChange={e => setNewId(e.target.value)}
                   placeholder="Paste their profile id or uid"
                   className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
          </div>

          {/* Live resolve preview — confirms WHO before you grant admin */}
          {lookup && (
            <div className="rounded-xl px-3 py-2.5 mb-2 flex items-center gap-2 anim-scalein"
                 style={lookup.status === 'found'
                   ? { background: T.successSoft, border: `1px solid ${T.success}40` }
                   : lookup.status === 'missing'
                     ? { background: (T.warningSoft || '#F4A62615'), border: `1px solid ${(T.warning || '#D4900A')}40` }
                     : { background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
              {lookup.status === 'looking' && <><RefreshCw size={14} className="animate-spin" style={{ color: T.muted }} /><span className="text-[12px]" style={{ color: T.muted }}>Looking up…</span></>}
              {lookup.status === 'found' && <><Check size={14} style={{ color: T.success }} /><span className="text-[12.5px] font-medium" style={{ color: T.success }}>This is <span className="font-bold">{lookup.name}</span></span></>}
              {lookup.status === 'missing' && <><AlertTriangle size={14} style={{ color: T.warning || '#D4900A' }} /><span className="text-[12px]" style={{ color: T.inkSoft }}>No registered profile matches this id yet.</span></>}
            </div>
          )}

          <input value={newNote} onChange={e => setNewNote(e.target.value)}
                 placeholder="Note (optional — e.g. their real name or role)"
                 className="w-full rounded-xl px-3 py-2.5 mb-3 text-sm" style={inputStyle} />

          <Button onClick={onAddClick} disabled={busy || !newId.trim()} className="w-full"
                  icon={busy ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}>
            {lookup && lookup.status === 'found' ? `Review & add ${lookup.name}` : 'Review & add admin'}
          </Button>
        </Card>

        {/* Feedback */}
        {ok && (
          <div className="rounded-xl px-3 py-2.5 mt-3 flex items-start gap-2 anim-scalein"
               style={{ background: T.successSoft, border: `1px solid ${T.success}40` }}>
            <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.success }} />
            <div className="text-[12.5px] font-medium" style={{ color: T.success }}>{ok}</div>
          </div>
        )}
        {err && (
          <div className="rounded-xl px-3 py-2.5 mt-3 flex items-start gap-2 anim-scalein"
               style={{ background: T.errorSoft, border: `1px solid ${T.error}40` }}>
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: T.error }} />
            <div className="text-[12.5px] font-medium" style={{ color: T.error }}>{err}</div>
          </div>
        )}
      </div>
    </div>
  );
}
