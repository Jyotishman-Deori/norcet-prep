// =====================================================================
// src/ui/admin-manager.jsx — "Manage staff" Admin Panel detail screen.
// Role hierarchy: Owner (admin) > Co-Admin > Moderator (admin-roles.sql).
//
//   - Groups rows BY PERSON: an account's slug id + uid rows render as ONE
//     card (both identifiers listed inside) — actions apply to the whole
//     group, so removing someone actually removes their access.
//   - Live username lookup before adding; a role DROPDOWN (only roles below
//     your own — the promotion ceiling, also enforced server-side).
//   - EVERY action (add / role change / remove / transfer) goes through an
//     explicit confirmation naming the person, with a reason field on the
//     destructive ones (logged to the audit trail server-side).
//   - You can never remove or demote yourself; the Owner can only change
//     via the atomic ownership transfer.
// =====================================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy, Check, Trash2, UserPlus, RefreshCw, ShieldCheck, Shield, Crown,
  Lock, Search, AlertTriangle, ChevronDown, ArrowRightLeft,
} from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, Button, TopBar, requestConfirm } from './primitives.jsx';
import {
  listAdmins, addAdmin, removeAdmin, setAdminRole, transferOwnership, resolveAdminProfiles,
} from '../lib/admin.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANK = { admin: 3, coadmin: 2, moderator: 1 };
const ROLE_META = {
  admin:     { label: 'Owner',     fg: '#E5484D', bg: '#E5484D18', Icon: Crown },
  coadmin:   { label: 'Co-Admin',  fg: '#6E56CF', bg: '#6E56CF18', Icon: ShieldCheck },
  moderator: { label: 'Moderator', fg: '#12A594', bg: '#12A59418', Icon: Shield },
};
const ROLE_BLURB = {
  coadmin: 'Almost everything: config, push, announcements, users, waitlist. Can add/remove Moderators. Can’t touch you or other Co-Admins.',
  moderator: 'Community control only: feedback replies, FAQs, content drafts, reading reports & logs. No config, push or user powers.',
};

function shortId(id) {
  const s = String(id || '');
  if (UUID_RE.test(s)) return `${s.slice(0, 8)}…${s.slice(-4)}`;
  return s;
}

export default function AdminManager({ onBack, staffRole = 'admin' }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const myId = profile ? profile.id : null;
  const myUid = profile ? profile.uid : null;
  const myName = profile ? (profile.displayName || profile.id) : null;

  const [rows, setRows] = useState(null);      // raw admin_profile_ids rows
  const [myRole, setMyRole] = useState(staffRole);
  const [profilesMap, setProfilesMap] = useState({}); // profile_id/uid → {id, uid, display_name}
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Add form
  const [newId, setNewId] = useState('');
  const [newRole, setNewRole] = useState('moderator');
  const [newNote, setNewNote] = useState('');
  const [lookup, setLookup] = useState(null); // null | {status, name}
  const lookupTimer = useRef(null);

  // Per-group inline action panel: { key, kind: 'remove'|'role', toRole? }
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');

  // Transfer flow (owner only)
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState('');

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await listAdmins();
      const list = res.admins || [];
      setRows(list);
      if (res.callerRole) setMyRole(res.callerRole);
      const ids = list.map((a) => a.profile_id);
      if (ids.length) {
        const profs = await resolveAdminProfiles(ids);
        const map = {};
        for (const p of profs) {
          if (p.id) map[p.id] = p;
          if (p.uid) map[p.uid] = p;
        }
        setProfilesMap(map);
      }
    } catch (e) {
      setRows([]);
      setErr(e && e.status === 403 ? 'Your role can’t manage staff.' : 'Couldn’t load the staff list — are you online?');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Live lookup of the id being typed (debounced).
  useEffect(() => {
    const id = newId.trim();
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!id || id.length < 3) { setLookup(null); return; }
    setLookup({ status: 'looking' });
    lookupTimer.current = setTimeout(async () => {
      const profs = await resolveAdminProfiles([id]);
      const match = profs.find((r) => r.id === id || r.uid === id);
      setLookup(match ? { status: 'found', name: match.display_name } : { status: 'missing' });
    }, 450);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [newId]);

  const msgFor = (e, fallback) => (e && e.status === 401 ? 'Wrong passphrase (or session expired)' : (e && e.message) || fallback);
  const needPass = () => {
    if (!pass.trim()) { setErr('Enter the admin passphrase first — every change requires it.'); return true; }
    return false;
  };

  // ---- GROUP rows by PERSON (slug id + uid rows = one human) ----------
  const groups = (() => {
    if (!rows) return null;
    const byKey = new Map();
    for (const a of rows) {
      const prof = profilesMap[a.profile_id];
      const isMe = a.profile_id === myId || a.profile_id === myUid;
      // Same person = same resolved profile record; unresolved rows stand alone.
      const key = isMe ? '__me__' : (prof ? `p:${prof.id}` : `raw:${a.profile_id}`);
      const g = byKey.get(key) || {
        key, ids: [], notes: [], rank: 0, isMe,
        name: isMe ? myName : (prof ? prof.display_name : null),
      };
      g.ids.push(a.profile_id);
      if (a.note) g.notes.push(a.note);
      const rank = a.role ? (RANK[a.role] || 2) : 2; // legacy null = coadmin
      if (rank > g.rank) g.rank = rank;
      if (!g.name && prof) g.name = prof.display_name;
      byKey.set(key, g);
    }
    return [...byKey.values()].map((g) => ({
      ...g,
      role: g.rank >= 3 ? 'admin' : g.rank === 2 ? 'coadmin' : 'moderator',
    }));
  })();

  const owners = (groups || []).filter((g) => g.role === 'admin');
  const coadmins = (groups || []).filter((g) => g.role === 'coadmin');
  const moderators = (groups || []).filter((g) => g.role === 'moderator');
  const myRank = RANK[myRole] || 0;
  const canTouch = (g) => !g.isMe && g.role !== 'admin' && myRank > g.rank;
  const grantable = myRole === 'admin' ? ['coadmin', 'moderator'] : myRole === 'coadmin' ? ['moderator'] : [];

  // ---- actions (each applies to EVERY id in the person's group) -------
  const doGroup = async (g, fn, doneMsg) => {
    setBusy(true); setErr(null); setOk(null);
    try {
      for (const pid of g.ids) await fn(pid);
      setOk(doneMsg);
      setPending(null); setReason('');
      await load();
    } catch (e) { setErr(msgFor(e, 'That didn’t go through — try again.')); }
    setBusy(false);
  };

  const confirmRemove = (g) => doGroup(
    g, (pid) => removeAdmin(pid, pass, reason.trim() || null),
    `${g.name || shortId(g.ids[0])} no longer has staff access.`,
  );
  const confirmRole = (g, toRole) => doGroup(
    g, (pid) => setAdminRole(pid, toRole, pass, reason.trim() || null),
    `${g.name || shortId(g.ids[0])} is now a ${ROLE_META[toRole].label}.`,
  );

  const doAdd = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      await addAdmin(newId.trim(), pass, newNote.trim() || null, newRole);
      const who = (lookup && lookup.status === 'found' && lookup.name) || shortId(newId.trim());
      setNewId(''); setNewNote(''); setLookup(null);
      setOk(`${who} added as ${ROLE_META[newRole].label}.`);
      await load();
    } catch (e) { setErr(msgFor(e, 'Couldn’t add that id. Check it and your connection.')); }
    setBusy(false);
  };
  const onAddClick = () => {
    const id = newId.trim();
    if (!id) { setErr('Paste a profile id or uid to add.'); return; }
    if (needPass()) return;
    const found = lookup && lookup.status === 'found';
    const roleLabel = ROLE_META[newRole].label;
    requestConfirm({
      icon: found ? <ShieldCheck size={20} style={{ color: T.primary }} /> : <AlertTriangle size={20} style={{ color: '#D4900A' }} />,
      title: found ? `Make ${lookup.name} a ${roleLabel}?` : `Add this id as ${roleLabel}?`,
      body: found
        ? `${lookup.name} gets ${roleLabel} powers: ${ROLE_BLURB[newRole]}`
        : `No registered profile matches “${shortId(id)}”. Adding a wrong id just creates a dead entry. Add it anyway?`,
      confirmLabel: found ? `Grant ${roleLabel}` : 'Add anyway',
      cancelLabel: 'Cancel',
      tone: found ? 'primary' : 'danger',
      onConfirm: doAdd,
    });
  };

  const onTransfer = () => {
    if (needPass()) return;
    const target = coadmins.find((g) => g.key === transferTo);
    if (!target) { setErr('Pick the Co-Admin who becomes the new owner.'); return; }
    requestConfirm({
      icon: <Crown size={20} style={{ color: '#E5484D' }} />,
      title: `Transfer ownership to ${target.name || shortId(target.ids[0])}?`,
      body: 'This is the ONE action that changes who owns the app: they become the Owner and you become a Co-Admin, in a single atomic step. Only the new owner can ever reverse it.',
      confirmLabel: 'Transfer ownership',
      cancelLabel: 'Cancel',
      tone: 'danger',
      confirmWord: 'TRANSFER',
      onConfirm: () => doGroup(
        { ...target, ids: [target.ids[0]] },
        (pid) => transferOwnership(pid, pass, reason.trim() || null),
        `Ownership transferred to ${target.name || shortId(target.ids[0])}.`,
      ).then(() => setTransferOpen(false)),
    });
  };

  const copyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id); setTimeout(() => setCopiedId(null), 1500);
    } catch (e) { setErr('Copy failed — long-press the id to copy manually.'); }
  };

  const inputStyle = { background: T.surface, border: `1px solid ${T.border}`, color: T.ink };

  const RoleBadge = ({ role }) => {
    const m = ROLE_META[role];
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: m.bg, color: m.fg }}>
        <m.Icon size={11} /> {m.label}
      </span>
    );
  };

  // One PERSON card (all their rows grouped; ids listed inside).
  const PersonCard = ({ g }) => {
    const m = ROLE_META[g.role];
    const isPending = pending && pending.key === g.key;
    return (
      <Card className="p-3.5 mb-2" style={g.isMe ? { border: `1.5px solid ${m.fg}40`, background: m.fg + '08' } : undefined}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: m.bg }}>
            <m.Icon size={18} style={{ color: m.fg }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[15px] truncate" style={{ color: T.ink }}>
                {g.name || <span style={{ color: T.muted, fontStyle: 'italic', fontWeight: 400 }}>Unknown profile</span>}
              </span>
              <RoleBadge role={g.role} />
              {g.isMe && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{ background: T.ink + '12', color: T.inkSoft }}>You</span>
              )}
            </div>
            {/* every identifier this person holds, copy-on-tap */}
            {g.ids.map((pid) => (
              <button key={pid} onClick={() => copyId(pid)}
                      className="no-tap-highlight mt-1 mr-3 inline-flex items-center gap-1.5 text-[11px] font-mono max-w-full active:opacity-70"
                      style={{ color: T.muted }} aria-label="Copy id">
                <span className="truncate">{shortId(pid)}</span>
                {copiedId === pid ? <Check size={12} className="flex-shrink-0" style={{ color: T.success }} />
                                  : <Copy size={12} className="flex-shrink-0" style={{ opacity: 0.7 }} />}
              </button>
            ))}
            {g.notes.length > 0 && (
              <div className="text-[11px] mt-1 truncate" style={{ color: T.muted }}>{g.notes.join(' · ')}</div>
            )}
          </div>
          {g.isMe || g.role === 'admin' ? (
            <div className="flex-shrink-0 pt-0.5" title={g.isMe ? "You can't change your own access" : 'The owner only changes via ownership transfer'}>
              <Lock size={15} style={{ color: T.muted }} />
            </div>
          ) : canTouch(g) ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              {grantable.filter((r) => r !== g.role).map((r) => (
                <button key={r} onClick={() => { setPending({ key: g.key, kind: 'role', toRole: r }); setReason(''); setOk(null); }}
                        disabled={busy}
                        className="no-tap-highlight p-2 -m-0.5 rounded-lg active:bg-black/5 disabled:opacity-50"
                        title={`Make ${ROLE_META[r].label}`} aria-label={`Make ${ROLE_META[r].label}`}>
                  <ArrowRightLeft size={15} style={{ color: ROLE_META[r].fg }} />
                </button>
              ))}
              <button onClick={() => { setPending({ key: g.key, kind: 'remove' }); setReason(''); setOk(null); }}
                      disabled={busy}
                      className="no-tap-highlight p-2 -m-0.5 rounded-lg active:bg-black/5 disabled:opacity-50"
                      aria-label={`Remove ${g.name || g.ids[0]}`}>
                <Trash2 size={15} style={{ color: T.error }} />
              </button>
            </div>
          ) : (
            <div className="flex-shrink-0 pt-0.5" title="Above your rank">
              <Lock size={15} style={{ color: T.muted }} />
            </div>
          )}
        </div>

        {/* Inline caution panel — the FINAL gate before a staff change. */}
        {isPending && (
          <div className="mt-3 rounded-xl p-3 anim-scalein"
               style={{ background: T.errorSoft, border: `1px solid ${T.error}35` }}>
            <div className="text-[12.5px] font-semibold mb-1" style={{ color: pending.kind === 'remove' ? T.error : T.ink }}>
              {pending.kind === 'remove'
                ? `Remove ${g.name || 'this person'} from staff?`
                : `Change ${g.name || 'this person'} to ${ROLE_META[pending.toRole].label}?`}
            </div>
            <div className="text-[11px] leading-relaxed mb-2" style={{ color: T.inkSoft }}>
              {pending.kind === 'remove'
                ? 'Takes effect on their very next action. Nothing else is deleted; you can re-add them anytime.'
                : ROLE_BLURB[pending.toRole]}
              {' '}This is recorded in the audit log.
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
                   placeholder="Reason (logged — e.g. 'left the team')"
                   className="w-full rounded-xl px-3 py-2 mb-2 text-sm" style={inputStyle} />
            <div className="flex gap-2">
              <button onClick={() => { if (needPass()) return; pending.kind === 'remove' ? confirmRemove(g) : confirmRole(g, pending.toRole); }}
                      disabled={busy}
                      className="no-tap-highlight flex-1 py-2 rounded-xl text-sm font-semibold active:scale-[0.99] transition"
                      style={{ background: pending.kind === 'remove' ? T.error : T.primary, color: '#FFF', opacity: busy ? 0.7 : 1 }}>
                {busy ? 'Working…' : pending.kind === 'remove' ? 'Yes, remove' : 'Yes, change role'}
              </button>
              <button onClick={() => { setPending(null); setReason(''); }} disabled={busy}
                      className="no-tap-highlight px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  const Section = ({ title, list, empty }) => (
    <>
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-2 px-1" style={{ color: T.muted }}>
        {title}{list.length ? ` · ${list.length}` : ''}
      </div>
      {rows === null ? (
        <Card className="p-4 mb-4"><div className="text-sm" style={{ color: T.muted }}>Loading…</div></Card>
      ) : list.length === 0 ? (
        <Card className="p-3.5 mb-4"><div className="text-[12.5px]" style={{ color: T.muted }}>{empty}</div></Card>
      ) : (
        <div className="mb-4">{list.map((g) => <PersonCard key={g.key} g={g} />)}</div>
      )}
    </>
  );

  return (
    <div className="anim-fadeup">
      <TopBar title="Manage staff" onBack={onBack}
              right={
                <button onClick={load} disabled={busy} aria-label="Refresh"
                        className="no-tap-highlight p-2 -mr-2 rounded-full active:bg-black/5 disabled:opacity-50">
                  <RefreshCw size={18} style={{ color: T.muted }} className={rows === null ? 'animate-spin' : ''} />
                </button>
              } />
      <div className="max-w-md md:max-w-3xl mx-auto px-4 md:px-6 pb-24 pt-2">

        {/* Hierarchy explainer */}
        <Card className="p-3.5 mb-4" style={{ background: `linear-gradient(150deg, ${T.primary}0E, transparent 70%)` }}>
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: T.primary }} />
            <div className="text-[12px] leading-relaxed" style={{ color: T.inkSoft }}>
              <span className="font-semibold" style={{ color: T.ink }}>Owner &gt; Co-Admin &gt; Moderator.</span>{' '}
              You can only grant, change or remove roles <span className="font-semibold" style={{ color: T.ink }}>below your own</span>.
              Role changes bite on the person's next action and are audit-logged. Every change needs the passphrase.
            </div>
          </div>
        </Card>

        {/* Passphrase — required for any change */}
        <div className="relative mb-4">
          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
          <input value={pass} onChange={e => setPass(e.target.value)} type="password"
                 placeholder={myRole === 'admin'
                   ? 'Owner passphrase — required for any change'
                   : 'Staff passphrase — required for any change'}
                 className="w-full rounded-xl pl-9 pr-3 py-3 text-sm" style={inputStyle} />
        </div>

        <Section title="Owner" list={owners}
                 empty="No owner row found — run supabase/admin-roles.sql to assign roles." />

        {/* Ownership transfer — owner only, needs a Co-Admin to hand over to */}
        {myRole === 'admin' && coadmins.length > 0 && (
          <div className="mb-4 -mt-2">
            {!transferOpen ? (
              <button onClick={() => { setTransferOpen(true); setOk(null); }}
                      className="no-tap-highlight text-[11.5px] underline px-1" style={{ color: T.muted }}>
                Transfer ownership…
              </button>
            ) : (
              <Card className="p-3.5" style={{ border: `1.5px solid #E5484D40` }}>
                <div className="text-[12.5px] font-semibold mb-2" style={{ color: T.ink }}>
                  Hand the app to a Co-Admin
                </div>
                <div className="relative mb-2">
                  <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
                          className="w-full appearance-none rounded-xl px-3 py-2.5 text-sm pr-9" style={inputStyle}>
                    <option value="">Choose the new owner…</option>
                    {coadmins.map((g) => (
                      <option key={g.key} value={g.key}>{g.name || shortId(g.ids[0])}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={onTransfer} disabled={busy || !transferTo}
                          className="no-tap-highlight flex-1 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: '#E5484D', color: '#FFF', opacity: (busy || !transferTo) ? 0.6 : 1 }}>
                    Review transfer…
                  </button>
                  <button onClick={() => setTransferOpen(false)}
                          className="no-tap-highlight px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                    Cancel
                  </button>
                </div>
              </Card>
            )}
          </div>
        )}

        <Section title="Co-Admins" list={coadmins}
                 empty="No co-admins yet — promote someone you trust with the day-to-day." />
        <Section title="Moderators" list={moderators}
                 empty="No moderators yet — they handle feedback, FAQs and content drafts." />

        {/* Add form with live username preview + role dropdown */}
        {grantable.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus size={16} style={{ color: T.primary }} />
              <div className="font-semibold text-sm" style={{ color: T.ink }}>Add a staff member</div>
            </div>

            <div className="relative mb-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
              <input value={newId} onChange={e => setNewId(e.target.value)}
                     placeholder="Paste their profile id or uid"
                     className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm" style={inputStyle} />
            </div>

            {/* Live resolve preview — confirms WHO before you grant anything */}
            {lookup && (
              <div className="rounded-xl px-3 py-2.5 mb-2 flex items-center gap-2 anim-scalein"
                   style={lookup.status === 'found'
                     ? { background: T.successSoft, border: `1px solid ${T.success}40` }
                     : lookup.status === 'missing'
                       ? { background: '#F4A62615', border: '1px solid #D4900A40' }
                       : { background: T.surfaceWarm, border: `1px solid ${T.border}` }}>
                {lookup.status === 'looking' && <><RefreshCw size={14} className="animate-spin" style={{ color: T.muted }} /><span className="text-[12px]" style={{ color: T.muted }}>Looking up…</span></>}
                {lookup.status === 'found' && <><Check size={14} style={{ color: T.success }} /><span className="text-[12.5px] font-medium" style={{ color: T.success }}>This is <span className="font-bold">{lookup.name}</span></span></>}
                {lookup.status === 'missing' && <><AlertTriangle size={14} style={{ color: '#D4900A' }} /><span className="text-[12px]" style={{ color: T.inkSoft }}>No registered profile matches this id yet.</span></>}
              </div>
            )}

            {/* Role dropdown — only roles BELOW yours are offered */}
            <div className="relative mb-1">
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                      className="w-full appearance-none rounded-xl px-3 py-2.5 text-sm pr-9" style={inputStyle}>
                {grantable.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
            </div>
            <div className="text-[10.5px] leading-relaxed mb-2 px-1" style={{ color: T.muted }}>
              {ROLE_BLURB[newRole]}
            </div>

            <input value={newNote} onChange={e => setNewNote(e.target.value)}
                   placeholder="Note (optional — e.g. their real name)"
                   className="w-full rounded-xl px-3 py-2.5 mb-3 text-sm" style={inputStyle} />

            <Button onClick={onAddClick} disabled={busy || !newId.trim()} className="w-full"
                    icon={busy ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}>
              {lookup && lookup.status === 'found'
                ? `Review & add ${lookup.name} as ${ROLE_META[newRole].label}`
                : `Review & add ${ROLE_META[newRole].label}`}
            </Button>
          </Card>
        )}

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
