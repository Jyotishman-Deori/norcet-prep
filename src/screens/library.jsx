// =====================================================================
// src/screens/library.jsx — Question Bank Library (list) + VisibilityPill
// Extracted from App.jsx (A1 batch 1b, slice 11). Bodies are byte-identical
// to the originals; the only changes are the A7 hook lines and Library's
// signature dropping `isAdmin` (now from useProfile). `profileId` stays a prop.
// =====================================================================
import React, { useState, useMemo } from 'react';
import { Plus, ChevronRight, RefreshCw, Layers, EyeOff, Eye } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { bankVisibility, isBankOwner } from '../lib/banks.js';
import { Card, TopBar } from '../ui/primitives.jsx';

function VisibilityPill({ bank }) {
  const { theme: T } = useTheme();
  const priv = bankVisibility(bank) === 'private';
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{ background: priv ? T.accent + '18' : T.success + '18', color: priv ? T.accent : T.success }}>
      {priv ? <EyeOff size={10} /> : <Eye size={10} />}
      {priv ? 'Private' : 'Public'}
    </span>
  );
}

function Library({ banks, profileId, loading, onRefresh, onOpen, onCreateNew, onBack, disabledBanks }) {
  const { theme: T } = useTheme();
  const { isAdmin } = useProfile();
  // Filter chips: All / Mine / From others. "Mine" = banks I uploaded.
  // "From others" = banks anyone else uploaded (including admin's seeds).
  // Default to All so the user immediately sees discoverable content.
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    let mine = 0, others = 0;
    banks.forEach(b => {
      if (isBankOwner(b, profileId)) mine++;
      else others++;
    });
    return { all: banks.length, mine, others };
  }, [banks, profileId]);

  const visibleBanks = useMemo(() => {
    if (filter === 'mine')   return banks.filter(b => isBankOwner(b, profileId));
    if (filter === 'others') return banks.filter(b => !isBankOwner(b, profileId));
    return banks;
  }, [banks, profileId, filter]);

  return (
    <div className="anim-fadeup">
      <TopBar title="Question Bank Library" onBack={onBack}
              feedback={{ screen: "Library" }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">

        {/* Anyone can upload a bank */}
        <Card className="p-4 mb-4 cursor-pointer no-tap-highlight pressable" onClick={onCreateNew}
              style={{ background: T.ink, border: 'none' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Plus size={18} color="#FFF" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-semibold mb-0.5" style={{ color: '#FFF' }}>Upload a new bank</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Choose private (just you) or public (everyone)
              </div>
            </div>
            <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
        </Card>

        <div className="text-xs mb-4 leading-relaxed px-1" style={{ color: T.muted }}>
          Browse banks and import them into your own practice.{' '}
          {isAdmin
            ? 'As admin you can see every bank and edit, delete, or change the visibility of any of them.'
            : 'Public banks are shared by everyone; private banks are visible only to whoever uploaded them. Only an admin can edit or delete a bank.'}
        </div>

        {/* Filter chips — quickly switch between everything, just mine, just others.
            Only show when there's something to filter (>1 bank or mixed ownership). */}
        {banks.length > 1 && (
          <div className="flex gap-2 mb-3">
            {[
              { id: 'all',    label: 'All',         count: counts.all },
              { id: 'mine',   label: 'Mine',        count: counts.mine },
              { id: 'others', label: 'From others', count: counts.others }
            ].map(opt => {
              const active = filter === opt.id;
              return (
                <button key={opt.id} onClick={() => setFilter(opt.id)}
                        className="no-tap-highlight px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-shrink-0"
                        style={{
                          background: active ? T.primary : T.surface,
                          color: active ? '#FFF' : T.inkSoft,
                          border: `1px solid ${active ? T.primary : T.border}`
                        }}>
                  {opt.label} <span style={{ opacity: 0.7 }}>· {opt.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Header row — count label + refresh */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: T.muted }}>
            {banks.length > 0
              ? `${visibleBanks.length} ${filter === 'mine' ? 'mine' : filter === 'others' ? 'from others' : (visibleBanks.length === 1 ? 'bank' : 'banks')}`
              : 'Available banks'}
          </div>
          <button onClick={onRefresh} disabled={loading}
                  className="no-tap-highlight inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-full active:scale-95 transition-transform disabled:opacity-50"
                  style={{ background: T.surfaceWarm, border: `1px solid ${T.border}`, color: T.inkSoft }}
                  aria-label="Refresh bank list">
            <RefreshCw size={14} style={{ color: T.muted }} className={loading ? 'animate-spin' : ''} />
            <span className="text-xs font-medium">Refresh</span>
          </button>
        </div>

        {loading && banks.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin" style={{ color: T.muted, opacity: 0.5 }} />
            <div className="text-sm" style={{ color: T.muted }}>Loading banks…</div>
          </div>
        ) : banks.length === 0 ? (
          <div className="text-center py-12">
            <Layers size={40} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>No banks yet</div>
            <div className="text-sm" style={{ color: T.muted }}>Upload the first one above.</div>
          </div>
        ) : visibleBanks.length === 0 ? (
          /* Banks exist but the current filter rules them all out. */
          <div className="text-center py-10">
            <Layers size={32} className="mx-auto mb-3" style={{ color: T.muted, opacity: 0.3 }} />
            <div className="text-sm mb-3" style={{ color: T.muted }}>
              {filter === 'mine' ? "You haven't uploaded any banks yet." : 'No banks from other users yet.'}
            </div>
            <button onClick={() => setFilter('all')}
                    className="no-tap-highlight text-xs font-medium underline"
                    style={{ color: T.primary }}>
              Show all banks
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleBanks.map(b => {
              const date = b.updatedAt ? new Date(b.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
              const mine = isBankOwner(b, profileId);
              const owner = mine ? 'You' : (b.ownerName || 'Admin');
              return (
                <Card key={b.id} className="p-4" onClick={() => onOpen(b.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="font-display text-base font-semibold truncate" style={{ color: T.ink }}>{b.name}</div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                              style={{ background: T.primary + '15', color: T.primary }}>v{b.version}</span>
                        <VisibilityPill bank={b} />
                        {disabledBanks && disabledBanks[b.id] && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1"
                                style={{ background: T.surfaceWarm, color: T.muted, border: `1px solid ${T.border}` }}>
                            <EyeOff size={9} /> Paused
                          </span>
                        )}
                      </div>
                      <div className="text-xs leading-relaxed" style={{ color: T.muted }}>
                        {b.questions.length} question{b.questions.length === 1 ? '' : 's'}
                        {` · by ${owner}`}
                        {date && ` · ${date}`}
                      </div>
                      {b.description && (
                        <div className="text-xs mt-1.5 leading-snug" style={{ color: T.inkSoft }}>{b.description}</div>
                      )}
                    </div>
                    <ChevronRight size={18} style={{ color: T.muted }} className="flex-shrink-0 mt-1" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Library;
