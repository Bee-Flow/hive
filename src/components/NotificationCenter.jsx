import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bell, Check, CheckCheck, Info, AlertTriangle, AlertCircle, X, BellOff, Bot } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import MarkdownRenderer from './MarkdownRenderer';

const CATEGORY_CONFIG = {
    info: { icon: Info, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.08)', label: 'Info' },
    heads_up: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', label: 'Heads Up' },
    urgent: { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', label: 'Urgent' },
    ai_task: { icon: Bot, color: '#0f172a', bg: 'rgba(15, 23, 42, 0.06)', label: 'Routine' },
};

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
}

function getTimeGroup(dateStr) {
    if (!dateStr) return 'older';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 24 && date.getDate() === now.getDate()) return 'today';
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (date > weekAgo) return 'this_week';
    return 'older';
}

const TIME_GROUP_LABELS = {
    today: 'Today',
    this_week: 'Earlier This Week',
    older: 'Older',
};

/**
 * Notifications panel: trigger + inbox popover.
 *
 * Two variants:
 *  - 'row'  (default): full-width sidebar-style row with icon + label + badge.
 *                      Popover floats above the trigger.
 *  - 'icon'           : compact icon-only button (badge overlaid). Popover
 *                       drops downward from the trigger. Use this when the
 *                       trigger sits in a top bar.
 */
export default function NotificationCenter({ variant = 'row' } = {}) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [notifFilter, setNotifFilter] = useState('all');
    const [resultModal, setResultModal] = useState(null);
    const panelRef = useRef(null);

    const openResultModal = useCallback((data, notifId) => {
        setResultModal({ ...data, notifId });
        if (notifId) {
            const n = notifications.find(x => x.id === notifId);
            if (n && !n.read) markRead(notifId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [notifications]);

    const openInDirectChat = useCallback(async (title, content, notifId) => {
        setResultModal(null);
        // If the source notification was an agent routine, look up the
        // routine's agent + persisted conversation so the chat opens on the
        // agent (not generic direct chat) and continues the same thread the
        // routine ran in.
        let agentId = null;
        let conversationId = null;
        try {
            const n = notifId ? notifications.find(x => x.id === notifId) : null;
            const taskId = n?.task_id || n?.taskId || null;
            if (taskId) {
                const res = await fetch(`/api/ai-tasks/${taskId}`, { credentials: 'include' });
                if (res.ok) {
                    const task = await res.json();
                    agentId = task?.agentId || task?.agent_id || null;
                    conversationId = task?.conversationId || task?.conversation_id || null;
                }
            }
        } catch (_) { /* fall through to direct chat */ }
        window.dispatchEvent(new CustomEvent('openDirectChatWithContext', {
            detail: { title, content, agentId, conversationId },
        }));
    }, [notifications]);

    // Routine credentials expired/revoked notifications carry a deep-link
    // token at the start of the body: `routine_reauth:<provider>\n\n…`. Parse
    // it once so we can hide the token from the rendered message and surface
    // a one-click Reconnect button instead.
    const parseReauthToken = (msg) => {
        if (!msg || typeof msg !== 'string') return { provider: null, body: msg || '' };
        const m = msg.match(/^routine_reauth:([a-z0-9_-]+)\n\n?([\s\S]*)$/i);
        if (!m) return { provider: null, body: msg };
        return { provider: m[1].toLowerCase(), body: m[2] };
    };
    const startReconnect = (provider) => {
        // Pop a fresh tab so the user keeps the notifications panel open.
        const url = `/auth/login/${encodeURIComponent(provider)}?returnTo=${encodeURIComponent(window.location.pathname || '/')}`;
        window.open(url, '_blank', 'noopener');
    };

    const fetchCount = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/notifications/unread-count`);
            if (res.ok) {
                const data = await res.json();
                const newCount = data.count || 0;
                setUnreadCount(prev => {
                    if (newCount > prev) {
                        fetchNotificationsRef.current?.();
                    }
                    return newCount;
                });
            }
        } catch { /* silent */ }
    }, []);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/notifications?limit=30`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount((data.notifications || []).filter(n => !n.read).length);
            }
        } catch { /* silent */ }
        setLoading(false);
    }, []);

    const fetchNotificationsRef = useRef(fetchNotifications);
    useEffect(() => { fetchNotificationsRef.current = fetchNotifications; }, [fetchNotifications]);

    useEffect(() => {
        fetchCount();
        fetchNotifications();
        const interval = setInterval(fetchCount, 30000);
        return () => clearInterval(interval);
    }, [fetchCount, fetchNotifications]);

    useEffect(() => {
        if (open) {
            fetchNotifications();
            setExpandedId(null);
        }
    }, [open, fetchNotifications]);

    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const markRead = async (id) => {
        await authFetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST' });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllRead = async () => {
        await authFetch(`${API_BASE}/api/notifications/read-all`, { method: 'POST' });
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const deleteNotification = async (id) => {
        const wasUnread = notifications.find(n => n.id === id && !n.read);
        await authFetch(`${API_BASE}/api/notifications/${id}`, { method: 'DELETE' });
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
        if (expandedId === id) setExpandedId(null);
    };

    const toggleExpand = (n) => {
        if (expandedId === n.id) {
            setExpandedId(null);
        } else {
            setExpandedId(n.id);
            if (!n.read) markRead(n.id);
        }
    };

    const filteredNotifications = useMemo(() => (
        notifFilter === 'unread' ? notifications.filter(n => !n.read) : notifications
    ), [notifications, notifFilter]);

    const groupedNotifications = useMemo(() => {
        const groups = [];
        let lastGroup = null;
        for (const n of filteredNotifications) {
            const group = getTimeGroup(n.created_at);
            if (group !== lastGroup) {
                groups.push({ type: 'header', group, label: TIME_GROUP_LABELS[group] });
                lastGroup = group;
            }
            groups.push({ type: 'notification', data: n });
        }
        return groups;
    }, [filteredNotifications]);

    const isIcon = variant === 'icon';

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            {isIcon ? (
                /* Compact icon-only trigger (sits in top bar) */
                <button
                    onClick={() => setOpen(o => !o)}
                    aria-label="Notifications"
                    title="Notifications"
                    className={`relative p-1.5 rounded-lg transition-colors ${open ? 'bg-[var(--bg-tertiary)] text-[var(--accent-primary)]' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}
                    data-testid="sidebar-notifications"
                >
                    <Bell className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    {unreadCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: 1, right: 1,
                            minWidth: 14, height: 14,
                            borderRadius: 7, padding: '0 3px',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            color: '#fff',
                            fontSize: 9, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                            boxShadow: '0 2px 4px rgba(220,38,38,0.3)',
                        }}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            ) : (
                /* Sidebar-style trigger row */
                <button
                    onClick={() => setOpen(o => !o)}
                    aria-label="Notifications"
                    title="Notifications"
                    className={`w-full flex items-center gap-2.5 px-3 h-9 rounded-lg transition-colors text-left ${open ? 'bg-[var(--item-active-bg)]' : 'hover:bg-[var(--item-hover-bg)]'}`}
                    data-testid="sidebar-notifications"
                >
                    <Bell className={`w-4 h-4 ${open ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'}`} strokeWidth={1.75} />
                    <span className={`text-[13px] ${open ? 'font-bold text-black' : 'text-black'}`}>
                        Notifications
                    </span>
                    {unreadCount > 0 && (
                        <span style={{
                            marginLeft: 'auto',
                            minWidth: 18, height: 18,
                            borderRadius: 9, padding: '0 5px',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            color: '#fff',
                            fontSize: 10, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                            boxShadow: '0 2px 4px rgba(220,38,38,0.3)',
                        }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Dropdown panel */}
            {open && (
                <div style={{
                    position: 'absolute',
                    ...(isIcon
                        ? { top: '100%', left: 0, marginTop: 8 }
                        : { bottom: '100%', left: 0, marginBottom: 8 }),
                    width: 520,
                    maxHeight: 680,
                    background: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                    borderRadius: 16,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
                    display: 'flex', flexDirection: 'column',
                    zIndex: 1000,
                    animation: `${isIcon ? 'notifSlideDown' : 'notifSlideUp'} 0.2s cubic-bezier(0.16, 1, 0.3, 1)`,
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--bg-card, #ffffff)',
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'rgba(99,102,241,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(99,102,241,0.15)',
                            flexShrink: 0,
                        }}>
                            <Bell style={{ width: 15, height: 15, color: '#6366f1' }} />
                        </div>
                        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                            Notifications
                            {unreadCount > 0 && (
                                <span style={{
                                    marginLeft: 8,
                                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    color: '#fff', fontSize: 10, fontWeight: 700,
                                    borderRadius: 10, padding: '2px 7px', lineHeight: 1.3,
                                }}>{unreadCount}</span>
                            )}
                        </div>
                        {/* Filter toggle */}
                        <div style={{
                            display: 'flex', gap: 2,
                            background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
                            borderRadius: 8, padding: 2,
                        }}>
                            {[{ id: 'all', label: 'All' }, { id: 'unread', label: 'Unread' }].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setNotifFilter(f.id)}
                                    style={{
                                        background: notifFilter === f.id ? 'var(--bg-card, #fff)' : 'transparent',
                                        border: 'none', cursor: 'pointer',
                                        fontSize: 11, fontWeight: 600,
                                        padding: '4px 10px', borderRadius: 6,
                                        color: notifFilter === f.id ? '#6366f1' : 'var(--text-muted, #94a3b8)',
                                        transition: 'all 0.15s',
                                        boxShadow: notifFilter === f.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                    }}
                                >{f.label}</button>
                            ))}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 11, color: '#6366f1', fontWeight: 500,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '4px 8px', borderRadius: 6,
                                }}
                                title="Mark all as read"
                            >
                                <CheckCheck style={{ width: 13, height: 13 }} />
                            </button>
                        )}
                    </div>

                    {/* Notification list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
                        {loading && notifications.length === 0 ? (
                            <div style={{
                                padding: 40, textAlign: 'center',
                                color: 'var(--text-muted, #94a3b8)', fontSize: 13,
                            }}>
                                <div style={{
                                    width: 28, height: 28, margin: '0 auto 10px',
                                    border: '2px solid rgba(99,102,241,0.2)',
                                    borderTopColor: '#6366f1',
                                    borderRadius: '50%',
                                    animation: 'notifSpin 0.8s linear infinite',
                                }} />
                                Loading notifications...
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div style={{
                                padding: '48px 32px', textAlign: 'center',
                                color: 'var(--text-muted, #94a3b8)',
                            }}>
                                <div style={{
                                    width: 52, height: 52, margin: '0 auto 14px',
                                    borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(99,102,241,0.06)',
                                }}>
                                    {notifFilter === 'unread'
                                        ? <Check style={{ width: 24, height: 24, color: '#22c55e', opacity: 0.6 }} />
                                        : <BellOff style={{ width: 24, height: 24, color: '#6366f1', opacity: 0.4 }} />
                                    }
                                </div>
                                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                                    {notifFilter === 'unread' ? 'All caught up!' : 'No notifications yet'}
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                                    {notifFilter === 'unread' ? 'You\'ve read all your notifications' : 'Notifications will appear here'}
                                </p>
                            </div>
                        ) : (
                            groupedNotifications.map((item, index) => {
                                if (item.type === 'header') {
                                    return (
                                        <div
                                            key={`group-${item.group}`}
                                            style={{
                                                padding: '8px 18px 4px',
                                                fontSize: 10, fontWeight: 700,
                                                color: 'var(--text-muted, #94a3b8)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em',
                                                background: 'var(--bg-secondary, rgba(0,0,0,0.015))',
                                                borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.04))',
                                            }}
                                        >
                                            {item.label}
                                        </div>
                                    );
                                }

                                const n = item.data;
                                const cat = CATEGORY_CONFIG[n.category] || CATEGORY_CONFIG.info;
                                const CatIcon = cat.icon;
                                const isExpanded = expandedId === n.id;
                                return (
                                    <div
                                        key={n.id}
                                        style={{
                                            padding: '10px 16px',
                                            cursor: 'pointer',
                                            background: isExpanded
                                                ? 'rgba(99, 102, 241, 0.04)'
                                                : n.read ? 'transparent' : 'rgba(99, 102, 241, 0.025)',
                                            borderLeft: n.read ? '3px solid transparent' : `3px solid ${cat.color}`,
                                            transition: 'all 0.2s ease',
                                            borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.04))',
                                            animation: `notifFadeIn 0.2s ease ${index * 0.02}s both`,
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.018)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = isExpanded ? 'rgba(99, 102, 241, 0.04)' : (n.read ? 'transparent' : 'rgba(99, 102, 241, 0.025)'); }}
                                        onClick={() => toggleExpand(n)}
                                    >
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            <div style={{
                                                flexShrink: 0, width: 34, height: 34,
                                                borderRadius: 10,
                                                background: n.read ? 'rgba(0,0,0,0.03)' : cat.bg,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                border: `1px solid ${n.read ? 'rgba(0,0,0,0.05)' : cat.color + '20'}`,
                                            }}>
                                                <CatIcon style={{ width: 16, height: 16, color: n.read ? 'var(--text-muted, #94a3b8)' : cat.color }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                    {!n.read && (
                                                        <span style={{
                                                            width: 6, height: 6, borderRadius: '50%',
                                                            background: cat.color, flexShrink: 0,
                                                        }} />
                                                    )}
                                                    <span style={{
                                                        fontSize: 13,
                                                        fontWeight: n.read ? 400 : 600,
                                                        color: n.read ? 'var(--text-secondary, #64748b)' : 'var(--text-primary, #0f172a)',
                                                        ...(isExpanded
                                                            ? { wordBreak: 'break-word' }
                                                            : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                                                        ),
                                                        flex: 1,
                                                        lineHeight: 1.4,
                                                    }}>
                                                        {n.title}
                                                    </span>
                                                    <span style={{
                                                        fontSize: 10, color: 'var(--text-muted, #94a3b8)', flexShrink: 0,
                                                        fontWeight: 500,
                                                    }}>
                                                        {timeAgo(n.created_at)}
                                                    </span>
                                                </div>
                                                {n.message && !isExpanded && (
                                                    <p style={{
                                                        fontSize: 12,
                                                        color: n.read ? 'var(--text-muted, #94a3b8)' : 'var(--text-secondary, #64748b)',
                                                        margin: 0, lineHeight: 1.45,
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {n.message}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    padding: 4, borderRadius: 6,
                                                    color: 'var(--text-muted, #94a3b8)',
                                                    opacity: 0, flexShrink: 0,
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#ef4444'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; }}
                                                title="Delete"
                                                className="notif-delete-btn"
                                            >
                                                <X style={{ width: 14, height: 14 }} />
                                            </button>
                                        </div>

                                        {isExpanded && (
                                            <div style={{
                                                marginTop: 10, marginLeft: 44,
                                                padding: '12px 14px',
                                                background: 'var(--bg-secondary, #f8fafc)',
                                                borderRadius: 10,
                                                border: '1px solid var(--border-subtle, rgba(0,0,0,0.05))',
                                            }}>
                                                {(() => {
                                                    const { provider: reauthProvider, body: cleanedBody } = parseReauthToken(n.message);
                                                    return (
                                                        <>
                                                            {reauthProvider && (
                                                                <div style={{ marginBottom: 10 }}>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); startReconnect(reauthProvider); }}
                                                                        style={{
                                                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                                                            border: 'none', cursor: 'pointer',
                                                                            background: 'var(--text-primary, #0f172a)', color: 'var(--bg-primary, #fff)',
                                                                        }}
                                                                    >
                                                                        Reconnect {reauthProvider.charAt(0).toUpperCase() + reauthProvider.slice(1)}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {n.category === 'ai_task' && cleanedBody && !reauthProvider && (
                                                                <div style={{ marginBottom: 10 }}>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openResultModal({ title: n.title, content: cleanedBody }, n.id); }}
                                                                        style={{
                                                                            display: 'flex', alignItems: 'center', gap: 5,
                                                                            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                                                            border: 'none', cursor: 'pointer',
                                                                            background: 'var(--bg-secondary, rgba(0,0,0,0.04))', color: 'var(--text-primary, #0f172a)',
                                                                        }}
                                                                    >
                                                                        View Full Result
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {n.category === 'ai_task' && !cleanedBody && !reauthProvider && (
                                                                <div style={{ marginBottom: 10 }}>
                                                                    <p style={{
                                                                        fontSize: 13, color: 'var(--text-secondary, #64748b)',
                                                                        margin: '0 0 8px 0', lineHeight: 1.6,
                                                                    }}>
                                                                        De routine is uitgevoerd, maar er is geen tekstresultaat opgeslagen. Open de chat om de uitvoering te bekijken.
                                                                    </p>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openInDirectChat(n.title, '', n.id); }}
                                                                        style={{
                                                                            display: 'flex', alignItems: 'center', gap: 5,
                                                                            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                                                            border: 'none', cursor: 'pointer',
                                                                            background: 'var(--bg-secondary, rgba(0,0,0,0.04))', color: 'var(--text-primary, #0f172a)',
                                                                        }}
                                                                    >
                                                                        Open chat
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {cleanedBody && (
                                                                n.category === 'ai_task' && !reauthProvider ? (
                                                                    <div style={{
                                                                        fontSize: 13, color: 'var(--text-primary, #0f172a)',
                                                                        lineHeight: 1.6,
                                                                        wordBreak: 'break-word',
                                                                        maxHeight: 600, overflowY: 'auto',
                                                                    }}>
                                                                        <MarkdownRenderer content={cleanedBody} />
                                                                    </div>
                                                                ) : (
                                                                    <p style={{
                                                                        fontSize: 13, color: 'var(--text-primary, #0f172a)',
                                                                        margin: 0, lineHeight: 1.6,
                                                                        wordBreak: 'break-word',
                                                                        whiteSpace: 'pre-wrap',
                                                                    }}>
                                                                        {cleanedBody}
                                                                    </p>
                                                                )
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: n.message ? 10 : 0, flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        fontSize: 10, padding: '2px 8px', borderRadius: 6,
                                                        background: cat.bg, color: cat.color, fontWeight: 600,
                                                    }}>
                                                        {cat.label}
                                                    </span>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                                                        {n.created_at ? new Date(n.created_at).toLocaleString(undefined, {
                                                            month: 'short', day: 'numeric',
                                                            hour: '2-digit', minute: '2-digit',
                                                        }) : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* AI Task Result Modal (still surfaced from notifications) */}
            {resultModal && (
                <div
                    onClick={() => setResultModal(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 2000,
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 24,
                        animation: 'resultModalBgIn 0.2s ease',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%', maxWidth: 720, maxHeight: '85vh',
                            background: 'var(--bg-card, #ffffff)',
                            borderRadius: 20,
                            boxShadow: '0 25px 80px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.12)',
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden',
                            animation: 'resultModalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                        }}
                    >
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                            background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'var(--bg-secondary, rgba(0,0,0,0.04))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                flexShrink: 0,
                            }}>
                                <Bot style={{ width: 18, height: 18, color: 'var(--text-primary, #0f172a)' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 15, fontWeight: 700,
                                    color: 'var(--text-primary, #0f172a)',
                                    lineHeight: 1.3,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {resultModal.title}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', fontWeight: 500, marginTop: 2 }}>
                                    Routine Result
                                </div>
                            </div>
                            <button
                                onClick={() => openInDirectChat(resultModal.title, resultModal.content, resultModal.notifId)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 14px', borderRadius: 10,
                                    fontSize: 13, fontWeight: 600,
                                    border: 'none', cursor: 'pointer',
                                    background: 'var(--text-primary, #0f172a)',
                                    color: 'var(--bg-primary, #fff)',
                                    flexShrink: 0,
                                }}
                            >
                                💬 Discuss in Chat
                            </button>
                            <button
                                onClick={() => setResultModal(null)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: 6, borderRadius: 8,
                                    color: 'var(--text-muted, #94a3b8)',
                                    flexShrink: 0,
                                }}
                            >
                                <X style={{ width: 18, height: 18 }} />
                            </button>
                        </div>

                        <div style={{
                            flex: 1, overflowY: 'auto',
                            padding: '20px 24px',
                            fontSize: 14, lineHeight: 1.7,
                            color: 'var(--text-primary, #0f172a)',
                        }}>
                            <MarkdownRenderer content={resultModal.content} />
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes notifSlideUp {
                    from { opacity: 0; transform: translateY(8px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes notifSlideDown {
                    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes notifFadeIn {
                    from { opacity: 0; transform: translateX(-4px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes notifSpin { to { transform: rotate(360deg); } }
                @keyframes resultModalBgIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes resultModalIn {
                    from { opacity: 0; transform: translateY(12px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                div:hover > div > .notif-delete-btn {
                    opacity: 0.4 !important;
                }
            `}</style>
        </div>
    );
}
