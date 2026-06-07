// =====================================================================
// src/screens/doubts.jsx  (Feature F-E — Doubt Flag)
// The dedicated "My Doubts" review space. Shows points the user flagged as
// unclear while reading, grouped by subject, split into Unresolved / Resolved.
// Resolve is one tap (archived, never deleted); items deep-link back to the
// topic so the user can re-read and clear the gap.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Flag, Check, ChevronRight, RotateCcw, HelpCircle } from 'lucide-react';
import { useTheme, useProfile } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import EmptyState from '../ui/empty-state.jsx';
import { topicName, topicColor } from '../lib/topics.js';
import { loadDoubts, saveDoubts, setResolved, unresolved, resolved, groupByTopic, relativeAge } from '../lib/doubts.js';

function DoubtsScreen({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const { profile } = useProfile();
  const profileId = (profile && profile.id) || 'guest';
  const [map, setMap] = useState({});
  const [tab, setTab] = useState('open'); // 'open' | 'done'

  useEffect(() => { let a = true; loadDoubts(profileId).then(m => { if (a) setMap(m); }); return () => { a = false; }; }, [profileId]);

  const resolve = (id, on) => {
    setMap(prev => { const next = setResolved(prev, id, on); saveDoubts(profileId, next); return next; });
  };

  const list = tab === 'open' ? unresolved(map) : resolved(map);
  const grouped = groupByTopic(list);
  const topics = Object.keys(grouped);
  const openCount = unresolved(map).length;
  const doneCount = resolved(map).length;

  return (
    <div className="anim-fadeup">
      <TopBar title="My Doubts" onBack={onBack} feedback={{ screen: 'Doubts' }} />
      <div className="max-w-md mx-auto px-4 pb-24 pt-2">
        <div className="px-1 mb-4">
          <div className="font-display text-2xl font-semibold mb-1" style={{ color: T.ink }}>Doubts</div>
          <div className="text-sm leading-relaxed" style={{ color: T.muted }}>
            Points you flagged while reading. Re-read them, then mark resolved — they also jump to the top of Quick Revision.
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 rounded-2xl mb-4" style={{ background: T.surfaceWarm }}>
          {[{ id: 'open', label: `Unresolved${openCount ? ` (${openCount})` : ''}` },
            { id: 'done', label: `Resolved${doneCount ? ` (${doneCount})` : ''}` }].map(t => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className="no-tap-highlight flex-1 py-2 rounded-xl text-[13px] font-semibold transition"
                      style={{ background: on ? T.surface : 'transparent', color: on ? T.primary : T.muted, boxShadow: on ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {list.length === 0 ? (
          tab === 'open' ? (
            <EmptyState
              icon={Flag}
              title="No doubts flagged yet"
              text="While reading Revision Notes, tap the flag icon next to anything unclear. It will appear here until you resolve it."
              actionLabel={onNavigate ? 'Go to Revision Notes' : undefined}
              onAction={onNavigate ? () => onNavigate({ screen: 'learn-topics' }) : undefined}
              note="Resolving doubts strengthens your Knowledge Map nodes faster." />
          ) : (
            <EmptyState
              icon={Check}
              title="Nothing resolved yet"
              text="Once you re-read a flagged point and mark it resolved, it moves here as a record of progress." />
          )
        ) : (
          <div className="space-y-5">
            {topics.map(topic => (
              <div key={topic}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: topicColor(topic) }} />
                  <div className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: T.muted }}>
                    {topicName(topic)} · {grouped[topic].length}
                  </div>
                </div>
                <div className="space-y-2">
                  {grouped[topic].map(d => (
                    <Card key={d.id} className="p-3.5" style={{ borderLeft: `3px solid ${tab === 'open' ? T.error : T.success}` }}>
                      <div className="flex items-start gap-2 mb-2">
                        <Flag size={14} className="flex-shrink-0 mt-0.5" style={{ color: tab === 'open' ? T.error : T.success, fill: tab === 'open' ? T.error : T.success }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm leading-snug" style={{ color: T.ink }}>{d.text || d.cardTitle}</div>
                          <div className="text-[11px] mt-1" style={{ color: T.muted }}>
                            {d.sub ? `${d.sub} · ` : ''}{relativeAge(tab === 'open' ? d.createdAt : (d.resolvedAt || d.createdAt))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onNavigate && onNavigate({ screen: 'learn-cards', topicId: d.topic, sub: d.sub || null })}
                                className="no-tap-highlight inline-flex items-center gap-1 text-[12px] font-semibold active:scale-95 transition"
                                style={{ color: T.primary }}>
                          Go to topic <ChevronRight size={13} />
                        </button>
                        <div className="flex-1" />
                        {tab === 'open' ? (
                          <button onClick={() => resolve(d.id, true)}
                                  className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition"
                                  style={{ background: T.success + '18', color: T.success }}>
                            <Check size={13} /> Mark resolved
                          </button>
                        ) : (
                          <button onClick={() => resolve(d.id, false)}
                                  className="no-tap-highlight inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition"
                                  style={{ background: T.surfaceWarm, color: T.muted }}>
                            <RotateCcw size={13} /> Reopen
                          </button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DoubtsScreen;
