// =====================================================================
// src/screens/notification-center.jsx — Session 2, Feature 6
// In-app notification inbox. Full screen (TopBar + body). Reads/writes
// the per-device list via lib/notifications. Tapping a notification
// marks it read and, if it carries an `action`, navigates there.
// [A7] theme via useTheme(); navigation/back stay props.
// =====================================================================
import React, { useState, useEffect } from 'react';
import { Bell, RotateCcw, Flame, BarChart3, Flag, BookOpen } from 'lucide-react';
import { useTheme } from '../lib/app-context.jsx';
import { Card, TopBar } from '../ui/primitives.jsx';
import { loadNotifications, saveNotifications } from '../lib/notifications.js';

function NotificationCenter({ onBack, onNavigate }) {
  const { theme: T } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  useEffect(() => {
    loadNotifications().then(list => {
      setNotifications(list);
      setLoading(false);
    });
  }, []);

  const markAllRead = async () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const handleTap = async (notif) => {
    const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
    setNotifications(updated);
    await saveNotifications(updated);
    if (notif.action) onNavigate(notif.action);
  };

  const clearAll = async () => {
    setNotifications([]);
    await saveNotifications([]);
  };

  const TYPE_META = {
    spaced_due:     { icon: <RotateCcw size={16} />, color: T.success, bg: T.successSoft },
    streak:         { icon: <Flame size={16} />,     color: T.accent,  bg: T.accent + '15' },
    weekly:         { icon: <BarChart3 size={16} />, color: T.primary, bg: T.primary + '15' },
    admin:          { icon: <Flag size={16} />,      color: T.accent,  bg: T.accent + '12' },
    daily_reminder: { icon: <BookOpen size={16} />,  color: T.primary, bg: T.primary + '12' },
  };

  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  const displayed = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="anim-fadeup">
      <TopBar title="Notifications" onBack={onBack}
              right={
                notifications.length > 0 && (
                  <button onClick={clearAll}
                          className="no-tap-highlight text-xs px-2 py-1 rounded-lg active:bg-black/5"
                          style={{ color: T.muted }}>
                    Clear all
                  </button>
                )
              } />
      <div className="max-w-md mx-auto px-4 pt-3 pb-24">

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4 p-1 rounded-xl" style={{ background: T.surfaceWarm }}>
          {[
            { id: 'all',    label: 'All',    count: notifications.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
          ].map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
                    className="flex-1 no-tap-highlight py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-all"
                    style={{
                      background: filter === tab.id ? T.surface : 'transparent',
                      color: filter === tab.id ? T.ink : T.muted,
                      boxShadow: filter === tab.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}>
              {tab.label}
              {tab.count > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: filter === tab.id ? T.primary : T.border,
                               color: filter === tab.id ? '#fff' : T.muted }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mark all read */}
        {unreadCount > 0 && (
          <button onClick={markAllRead}
                  className="no-tap-highlight w-full text-xs text-right mb-3 py-1"
                  style={{ color: T.primary }}>
            Mark all as read
          </button>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl skeleton-pulse" style={{ background: T.borderSoft }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                 style={{ background: T.surfaceWarm }}>
              <Bell size={28} style={{ color: T.muted }} />
            </div>
            <div className="font-display text-lg mb-1" style={{ color: T.ink }}>
              {filter === 'unread' ? 'All caught up' : 'No notifications yet'}
            </div>
            <div className="text-sm" style={{ color: T.muted }}>
              {filter === 'unread'
                ? 'No unread notifications.'
                : 'Notifications will appear here as you use the app.'}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(notif => {
              const meta = TYPE_META[notif.type] || TYPE_META.daily_reminder;
              return (
                <button key={notif.id}
                        onClick={() => handleTap(notif)}
                        className="w-full text-left no-tap-highlight pressable"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: notif.action ? 'pointer' : 'default' }}>
                  <Card className="p-4"
                        style={{
                          background: notif.read ? T.surface : T.primary + '08',
                          border: `1px solid ${notif.read ? T.border : T.primary + '30'}`
                        }}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ background: meta.bg, color: meta.color }}>
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-sm leading-snug" style={{ color: T.ink }}>
                            {notif.title}
                          </div>
                          {!notif.read && (
                            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                                 style={{ background: T.primary }} />
                          )}
                        </div>
                        <div className="text-xs leading-relaxed mt-0.5" style={{ color: T.muted }}>
                          {notif.body}
                        </div>
                        <div className="text-[10px] mt-1.5 font-medium" style={{ color: T.muted }}>
                          {timeAgo(notif.ts)}
                          {notif.action && (
                            <span style={{ color: T.primary }}> · Tap to open →</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationCenter;
