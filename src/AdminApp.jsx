// =====================================================================
// src/AdminApp.jsx — the STANDALONE ADMIN APP
//
// A separate React app (its own entry: admin.html → src/admin-main.jsx) that the
// admin uses to upload/manage content. It SHARES the student app's backend
// (Supabase) and reuses shared code from src/lib + the already-extracted admin
// screens — but it MUST NOT import App.jsx (that would pull the entire student
// app into this bundle, and vice versa). Anything both need lives in src/lib.
//
// Flow: boot storage → restore session → require LOGIN (reuses AuthScreen) →
// verify admin server-side (admin_profile_ids) → render the Admin Panel, the
// Bank Editor (upload/edit question sets), and the Library (browse → edit).
// =====================================================================
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { AppProviders } from './lib/app-context.jsx';
import { LIGHT_THEME, DARK_THEME } from './lib/themes.js';
import { fontStyles } from './lib/font-styles.js';
import { checkStorageBridge } from './lib/safe-storage.js';
import { loadSession, saveSession, loadProfile } from './lib/profiles.js';
import { listBanks, loadBank, saveBank } from './lib/banks-storage.js';
import { SEED_QUESTIONS } from './data/seed.js';
import AuthScreen from './screens/auth-screen.jsx';
import { BankEditor } from './screens/bank-screens.jsx';
import Library from './screens/library.jsx';
import {
  checkServerAdminRole, loadAdminStatus, saveAdminStatus,
  loadAnnouncement, loadAnnouncementHistory, saveAnnouncement,
  deleteAnnouncementHistoryItem, clearAnnouncementHistory, clearAnnouncement,
  adminListUsers, adminDeleteProfile,
} from './lib/admin-ops.js';

const AdminPanel = lazy(() => import('./screens/admin-panel.jsx'));

// Minimal error boundary (the student app's lives in App.jsx, which we must not
// import). Keeps a thrown render from blanking the admin tool.
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { try { console.error('AdminApp crash', err, info); } catch (e) {} }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#FBF7ED', color: '#15130F', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Admin panel hit an error</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>Reload to try again.</div>
            <button onClick={() => window.location.reload()}
                    style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#0F4C4C', color: '#fff', fontWeight: 600 }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Splash({ T, label }) {
  return (
    <div className="font-body min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
      <style>{fontStyles}</style>
      <div className="text-center px-8">
        <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.primary }}>NurseHolic Admin</div>
        <div className="mx-auto mb-5 mt-3 rounded-full" style={{ width: 32, height: 2, background: T.primary, opacity: 0.3 }} />
        <div className="text-sm" style={{ color: T.inkSoft }}>{label || 'Loading…'}</div>
      </div>
    </div>
  );
}

function NotAuthorized({ T, profile, onSignOut }) {
  return (
    <div className="font-body min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
      <style>{fontStyles}</style>
      <div className="text-center px-8" style={{ maxWidth: 420 }}>
        <div className="font-display text-xl font-semibold mb-2" style={{ color: T.ink }}>Not an admin account</div>
        <div className="text-sm leading-relaxed mb-6" style={{ color: T.inkSoft }}>
          You're signed in as <strong>{profile ? (profile.displayName || profile.id) : 'this account'}</strong>, which
          isn't on the admin allow-list. Sign in with an admin account to manage content.
        </div>
        <button onClick={onSignOut}
                className="no-tap-highlight w-full py-3 rounded-xl font-semibold"
                style={{ background: T.primary, color: '#FFF' }}>
          Sign in with a different account
        </button>
      </div>
    </div>
  );
}

function AdminApp() {
  // Theme — admin tool defaults to light; a tiny toggle keeps both palettes wired.
  const [themeMode, setThemeMode] = useState('light');
  const isDark = themeMode === 'dark';
  const T = isDark ? DARK_THEME : LIGHT_THEME;

  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState(null);
  const [adminState, setAdminState] = useState('unknown'); // 'unknown' | 'yes' | 'no'
  const [staffRole, setStaffRole] = useState(null); // 'admin' | 'coadmin' | 'moderator' | null
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [nav, setNav] = useState({ screen: 'panel' });

  // 1) Boot: storage bridge + restore an existing session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await checkStorageBridge(); } catch (e) {}
      try {
        const session = await loadSession();
        if (session && session.profileId) {
          const p = await loadProfile(session.profileId);
          if (!cancelled && p) setProfile(p);
        }
      } catch (e) {}
      if (!cancelled) setBooting(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // 2) Verify admin server-side whenever a profile is active (fail-closed).
  // Also captures the caller's STAFF ROLE (admin/coadmin/moderator) — the
  // panel renders only what the role can use; the brokers enforce it anyway.
  useEffect(() => {
    if (!profile || !profile.id) { setAdminState('unknown'); return; }
    let cancelled = false;
    (async () => {
      try { if (await loadAdminStatus() && !cancelled) setAdminState('yes'); } catch (e) {}
      const res = await checkServerAdminRole(profile.id, profile.uid);
      if (cancelled) return;
      setAdminState(res.ok ? 'yes' : 'no');
      // Legacy server (no role field yet) → treat as full admin (that is
      // exactly what list membership meant before the migration).
      setStaffRole(res.ok ? (res.role || 'admin') : null);
      try { await saveAdminStatus(res.ok); } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [profile]);

  const refreshBanks = useCallback(async () => {
    setBanksLoading(true);
    try { setBanks(await listBanks()); } finally { setBanksLoading(false); }
  }, []);

  // 3) Load content once admin is confirmed.
  useEffect(() => {
    if (adminState !== 'yes') return;
    refreshBanks();
    loadAnnouncement().then(setAnnouncement).catch(() => {});
  }, [adminState, refreshBanks]);

  // Reported-question lookups in the panel resolve against the full pool: the
  // bundled seed bank + every question across uploaded banks.
  const allQuestions = useMemo(() => {
    const out = [...SEED_QUESTIONS];
    banks.forEach(b => { if (b && Array.isArray(b.questions)) out.push(...b.questions); });
    return out;
  }, [banks]);

  // Minimal data stub so context consumers (Library reads data.customQuestions /
  // data.stats) don't crash — the admin app has no per-user practice data.
  const dataStub = useMemo(() => ({
    customQuestions: [], stats: { totalAttempted: 0 }, disabledBanks: {}, bookmarks: [], preferences: {},
  }), []);

  const handleSignOut = useCallback(async () => {
    try { await saveAdminStatus(false); } catch (e) {}
    try { await saveSession(null); } catch (e) {}
    setProfile(null); setAdminState('unknown'); setNav({ screen: 'panel' });
  }, []);

  const provide = (node) => (
    <AppProviders
      theme={T} themeMode={themeMode} setThemeMode={setThemeMode} isDark={isDark}
      profile={profile} setProfile={setProfile} isAdmin={adminState === 'yes'}
      data={dataStub} setData={() => {}} allQuestions={allQuestions}>
      <style>{fontStyles}</style>
      {node}
    </AppProviders>
  );

  if (booting) return provide(<Splash T={T} />);
  if (!profile) return provide(<AuthScreen initialMode="login" onAuthed={setProfile} />);
  if (adminState === 'unknown') return provide(<Splash T={T} label="Checking admin access…" />);
  if (adminState === 'no') return provide(<NotAuthorized T={T} profile={profile} onSignOut={handleSignOut} />);

  // adminState === 'yes' → the content-management surface.
  return provide(
    <Suspense fallback={<Splash T={T} />}>
      {nav.screen === 'panel' && (
        <AdminPanel
          profile={profile} staffRole={staffRole} banks={banks} banksLoading={banksLoading} allQuestions={allQuestions}
          announcement={announcement}
          onSaveAnnouncement={(text, level, days) => saveAnnouncement(text, level, profile.id, days).then(e => { setAnnouncement(e); return e; })}
          onClearAnnouncement={() => clearAnnouncement().then(() => setAnnouncement(null))}
          onLoadAnnHistory={() => loadAnnouncementHistory()}
          onDeleteAnnHistoryItem={(id) => deleteAnnouncementHistoryItem(id).then(() => loadAnnouncementHistory())}
          onClearAnnHistory={() => clearAnnouncementHistory().then(() => [])}
          onRefreshBanks={refreshBanks}
          onOpenLibrary={() => { setNav({ screen: 'library' }); refreshBanks(); }}
          onCreateBank={() => setNav({ screen: 'bank-editor', bank: null })}
          onLockAdmin={handleSignOut}
          onListUsers={adminListUsers}
          onDeleteProfile={adminDeleteProfile}
          onBack={() => {}} />
      )}

      {nav.screen === 'library' && (
        <Library
          banks={banks} profileId={profile.id} loading={banksLoading} disabledBanks={{}}
          onRefresh={refreshBanks}
          onOpen={async (bankId) => { const fresh = await loadBank(bankId); setNav({ screen: 'bank-editor', bank: fresh || null, from: 'library' }); }}
          onCreateNew={() => setNav({ screen: 'bank-editor', bank: null, from: 'library' })}
          onBack={() => setNav({ screen: 'panel' })} />
      )}

      {nav.screen === 'bank-editor' && (
        <BankEditor
          existingBank={nav.bank || null} profile={profile}
          onSave={async (bank) => { await saveBank(bank); await refreshBanks(); setNav({ screen: nav.from === 'library' ? 'library' : 'panel' }); }}
          onBack={() => setNav({ screen: nav.from === 'library' ? 'library' : 'panel' })} />
      )}
    </Suspense>
  );
}

export default AdminApp;
