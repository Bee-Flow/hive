import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bell, Check, CheckCheck, Info, AlertTriangle, AlertCircle, X, Trash2, Clock, Plus, Calendar, Repeat, BellOff, AlarmClock, Bot, Play, Pause, Sparkles, Zap, Filter } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import MarkdownRenderer from './MarkdownRenderer';

const CATEGORY_CONFIG = {
    info: { icon: Info, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.08)', label: 'Info' },
    heads_up: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', label: 'Heads Up' },
    urgent: { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', label: 'Urgent' },
    ai_task: { icon: Bot, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', label: 'AI Task' },
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

function formatReminderTime(dateStr) {
    if (!dateStr) return '—';
    const dt = new Date(dateStr);
    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = dt.toDateString() === tomorrow.toDateString();

    const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

/** Group notifications by time period */
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

export default function NotificationCenter() {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('notifications');
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'
    const panelRef = useRef(null);

    // Reminders state
    const [reminders, setReminders] = useState([]);
    const [remindersLoading, setRemindersLoading] = useState(false);
    const [showReminderForm, setShowReminderForm] = useState(false);
    const [reminderTitle, setReminderTitle] = useState('');
    const [reminderMessage, setReminderMessage] = useState('');
    const [reminderDate, setReminderDate] = useState('');
    const [reminderTime, setReminderTime] = useState('');
    const [reminderRepeat, setReminderRepeat] = useState('');

    // AI Tasks state
    const [aiTasks, setAiTasks] = useState([]);
    const [aiTasksLoading, setAiTasksLoading] = useState(false);
    const [showAiTaskForm, setShowAiTaskForm] = useState(false);
    const [aiTaskTitle, setAiTaskTitle] = useState('');
    const [aiTaskPrompt, setAiTaskPrompt] = useState('');
    const [aiTaskDate, setAiTaskDate] = useState('');
    const [aiTaskTime, setAiTaskTime] = useState('');
    const [aiTaskRepeat, setAiTaskRepeat] = useState('weekly');
    const [aiTaskTier, setAiTaskTier] = useState('fast');
    const [maxAiTasks, setMaxAiTasks] = useState(10);
    const [expandedTaskId, setExpandedTaskId] = useState(null);
    const [resultModal, setResultModal] = useState(null); // { title, content, notifId? }

    // Helper: open result modal and auto-mark-as-read
    const openResultModal = useCallback((data, notifId) => {
        setResultModal(data);
        if (notifId) {
            const n = notifications.find(x => x.id === notifId);
            if (n && !n.read) markRead(notifId);
        }
    }, [notifications]);

    // Helper: open AI task result in Direct Chat for follow-up questions
    const openInDirectChat = useCallback((title, content) => {
        setResultModal(null); // close modal if open
        window.dispatchEvent(new CustomEvent('openDirectChatWithContext', {
            detail: { title, content }
        }));
    }, []);

    const fetchCount = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/notifications/unread-count`);
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.count || 0);
            }
        } catch (err) { /* silent */ }
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
        } catch (err) { /* silent */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 30000);
        return () => clearInterval(interval);
    }, [fetchCount]);

    useEffect(() => {
        if (open) {
            fetchNotifications();
            fetchReminders();
            fetchAiTasks();
            setExpandedId(null);
        }
    }, [open, fetchNotifications]);

    const fetchReminders = useCallback(async () => {
        setRemindersLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/reminders`);
            if (res.ok) setReminders(await res.json());
        } catch (err) { /* silent */ }
        setRemindersLoading(false);
    }, []);

    const fetchAiTasks = useCallback(async () => {
        setAiTasksLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks`);
            if (res.ok) {
                const data = await res.json();
                setAiTasks(data.tasks || []);
                if (data.maxTasks) setMaxAiTasks(data.maxTasks);
            }
        } catch (err) { /* silent */ }
        setAiTasksLoading(false);
    }, []);

    const createReminder = async () => {
        if (!reminderTitle.trim() || !reminderDate || !reminderTime) return;
        const remindAt = new Date(`${reminderDate}T${reminderTime}`).toISOString();
        try {
            const res = await authFetch(`${API_BASE}/api/reminders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: reminderTitle.trim(), message: reminderMessage, remindAt, repeatInterval: reminderRepeat || null }),
            });
            if (res.ok) {
                fetchReminders();
                setReminderTitle(''); setReminderMessage(''); setReminderDate(''); setReminderTime(''); setReminderRepeat('');
                setShowReminderForm(false);
            }
        } catch (err) { console.error('Create reminder failed:', err); }
    };

    const completeReminder = async (id) => {
        try {
            await authFetch(`${API_BASE}/api/reminders/${id}/complete`, { method: 'POST' });
            fetchReminders();
        } catch (err) { console.error('Complete reminder failed:', err); }
    };

    const deleteReminder = async (id) => {
        try {
            await authFetch(`${API_BASE}/api/reminders/${id}`, { method: 'DELETE' });
            setReminders(prev => prev.filter(r => r.id !== id));
        } catch (err) { console.error('Delete reminder failed:', err); }
    };

    // AI Task handlers
    const createAiTask = async () => {
        if (!aiTaskTitle.trim() || !aiTaskPrompt.trim() || !aiTaskDate || !aiTaskTime) return;
        const nextRunAt = new Date(`${aiTaskDate}T${aiTaskTime}`).toISOString();
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: aiTaskTitle.trim(),
                    prompt: aiTaskPrompt.trim(),
                    nextRunAt,
                    repeatInterval: aiTaskRepeat || null,
                    modelTier: aiTaskTier,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                }),
            });
            if (res.ok) {
                fetchAiTasks();
                setAiTaskTitle(''); setAiTaskPrompt(''); setAiTaskDate(''); setAiTaskTime('');
                setAiTaskRepeat('weekly'); setAiTaskTier('fast');
                setShowAiTaskForm(false);
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to create task');
            }
        } catch (err) { console.error('Create AI task failed:', err); }
    };

    const toggleAiTask = async (id) => {
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks/${id}/toggle`, { method: 'POST' });
            if (res.ok) fetchAiTasks();
        } catch (err) { console.error('Toggle AI task failed:', err); }
    };

    const deleteAiTask = async (id) => {
        try {
            await authFetch(`${API_BASE}/api/ai-tasks/${id}`, { method: 'DELETE' });
            setAiTasks(prev => prev.filter(t => t.id !== id));
        } catch (err) { console.error('Delete AI task failed:', err); }
    };

    const runAiTaskNow = async (id) => {
        try {
            const res = await authFetch(`${API_BASE}/api/ai-tasks/${id}/run-now`, { method: 'POST' });
            if (res.ok) {
                fetchAiTasks();
            }
        } catch (err) { console.error('Run AI task failed:', err); }
    };

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

    const activeReminders = reminders.filter(r => !r.isCompleted);
    const overdueReminders = activeReminders.filter(r => r.remindAt && new Date(r.remindAt) < new Date());
    const upcomingReminders = activeReminders.filter(r => r.remindAt && new Date(r.remindAt) >= new Date());
    const activeAiTasks = aiTasks.filter(t => t.isActive);
    const inactiveAiTasks = aiTasks.filter(t => !t.isActive);

    // Filtered & grouped notifications
    const filteredNotifications = useMemo(() => {
        const list = notifFilter === 'unread'
            ? notifications.filter(n => !n.read)
            : notifications;
        return list;
    }, [notifications, notifFilter]);

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

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            {/* Bell button */}
            <button
                onClick={() => setOpen(!open)}
                style={{
                    position: 'relative',
                    background: open ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    border: 'none',
                    borderRadius: 10,
                    padding: 7,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    color: open ? '#6366f1' : 'var(--text-secondary, #334155)',
                }}
                onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent'; }}
                title="Notifications"
            >
                <Bell style={{ width: 18, height: 18 }} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: 1, right: 1,
                        minWidth: 17, height: 17,
                        borderRadius: 9, padding: '0 4px',
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1,
                        boxShadow: '0 0 0 2px var(--bg-primary, #fafafa), 0 2px 4px rgba(220,38,38,0.3)',
                        animation: unreadCount > 0 ? 'notifBadgePop 0.3s ease' : 'none',
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div style={{
                    position: 'absolute', bottom: '100%', left: 0,
                    marginBottom: 8,
                    width: 520,
                    maxHeight: 680,
                    background: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                    borderRadius: 16,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
                    display: 'flex', flexDirection: 'column',
                    zIndex: 1000,
                    animation: 'notifSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    overflow: 'hidden',
                }}>
                    {/* Header with tabs */}
                    <div style={{
                        padding: '0 16px',
                        borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                        display: 'flex', gap: 0,
                        background: 'var(--bg-card, #ffffff)',
                    }}>
                        {[
                            { id: 'notifications', label: 'Notifications', icon: Bell },
                            { id: 'reminders', label: 'Reminders', icon: AlarmClock },
                            { id: 'ai-tasks', label: 'AI Tasks', icon: Bot },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '11px 14px', fontSize: 12.5, fontWeight: 600,
                                    borderBottom: tab === t.id ? `2px solid ${t.id === 'ai-tasks' ? '#8b5cf6' : '#6366f1'}` : '2px solid transparent',
                                    color: tab === t.id ? (t.id === 'ai-tasks' ? '#8b5cf6' : '#6366f1') : 'var(--text-muted, #64748b)',
                                    transition: 'all 0.15s ease',
                                    letterSpacing: '0.01em',
                                }}
                            >
                                <t.icon style={{ width: 14, height: 14 }} />
                                {t.label}
                                {t.id === 'notifications' && unreadCount > 0 && (
                                    <span style={{
                                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                        color: '#fff', fontSize: 9.5, fontWeight: 700,
                                        borderRadius: 10, padding: '2px 6px', lineHeight: 1.3,
                                        boxShadow: '0 1px 3px rgba(220,38,38,0.2)',
                                    }}>{unreadCount}</span>
                                )}
                                {t.id === 'reminders' && activeReminders.length > 0 && (
                                    <span style={{
                                        background: overdueReminders.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                                        color: overdueReminders.length > 0 ? '#ef4444' : '#6366f1',
                                        fontSize: 9.5, fontWeight: 700,
                                        borderRadius: 10, padding: '2px 6px', lineHeight: 1.3,
                                    }}>{activeReminders.length}</span>
                                )}
                                {t.id === 'ai-tasks' && activeAiTasks.length > 0 && (
                                    <span style={{
                                        background: 'rgba(139,92,246,0.1)',
                                        color: '#8b5cf6',
                                        fontSize: 9.5, fontWeight: 700,
                                        borderRadius: 10, padding: '2px 6px', lineHeight: 1.3,
                                    }}>{activeAiTasks.length}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Notifications Tab */}
                    {tab === 'notifications' && (
                    <>
                        {/* Filter + Actions bar */}
                        <div style={{
                            padding: '6px 14px',
                            display: 'flex', alignItems: 'center', gap: 6,
                            borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.04))',
                        }}>
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
                                            padding: '4px 12px', borderRadius: 6,
                                            color: notifFilter === f.id ? '#6366f1' : 'var(--text-muted, #94a3b8)',
                                            transition: 'all 0.15s',
                                            boxShadow: notifFilter === f.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                        }}
                                    >
                                        {f.label}
                                        {f.id === 'unread' && unreadCount > 0 && (
                                            <span style={{
                                                marginLeft: 4, fontSize: 9, fontWeight: 700,
                                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                                borderRadius: 8, padding: '1px 5px',
                                            }}>{unreadCount}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <div style={{ flex: 1 }} />
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: 11, color: '#6366f1', fontWeight: 500,
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '4px 8px', borderRadius: 6,
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.06)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                >
                                    <CheckCheck style={{ width: 13, height: 13 }} />
                                    Mark all read
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
                                            {/* Header row */}
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                <div style={{
                                                    flexShrink: 0, width: 34, height: 34,
                                                    borderRadius: 10,
                                                    background: n.read ? 'rgba(0,0,0,0.03)' : cat.bg,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    border: `1px solid ${n.read ? 'rgba(0,0,0,0.05)' : cat.color + '20'}`,
                                                    transition: 'all 0.2s ease',
                                                }}>
                                                    <CatIcon style={{ width: 16, height: 16, color: n.read ? 'var(--text-muted, #94a3b8)' : cat.color, transition: 'color 0.2s' }} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                        {!n.read && (
                                                            <span style={{
                                                                width: 6, height: 6, borderRadius: '50%',
                                                                background: cat.color, flexShrink: 0,
                                                                boxShadow: `0 0 4px ${cat.color}40`,
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
                                                            transition: 'color 0.2s, font-weight 0.2s',
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
                                                            transition: 'color 0.2s',
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
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; e.currentTarget.style.background = 'none'; }}
                                                    title="Delete"
                                                    className="notif-delete-btn"
                                                >
                                                    <X style={{ width: 14, height: 14 }} />
                                                </button>
                                            </div>

                                            {/* Expanded content */}
                                            {isExpanded && (
                                                <div style={{
                                                    marginTop: 10, marginLeft: 44,
                                                    padding: '12px 14px',
                                                    background: 'var(--bg-secondary, #f8fafc)',
                                                    borderRadius: 10,
                                                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.05))',
                                                    animation: 'notifExpand 0.2s ease',
                                                }}>
                                                    {n.message && (
                                                        n.category === 'ai_task' ? (
                                                            <div style={{
                                                                fontSize: 13, color: 'var(--text-primary, #0f172a)',
                                                                lineHeight: 1.6,
                                                                wordBreak: 'break-word',
                                                                maxHeight: 600, overflowY: 'auto',
                                                            }}>
                                                                <MarkdownRenderer content={n.message} />
                                                            </div>
                                                        ) : (
                                                            <p style={{
                                                                fontSize: 13, color: 'var(--text-primary, #0f172a)',
                                                                margin: 0, lineHeight: 1.6,
                                                                wordBreak: 'break-word',
                                                                whiteSpace: 'pre-wrap',
                                                            }}>
                                                                {n.message}
                                                            </p>
                                                        )
                                                    )}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: n.message ? 10 : 0, flexWrap: 'wrap' }}>
                                                        <span style={{
                                                            fontSize: 10, padding: '2px 8px', borderRadius: 6,
                                                            background: cat.bg, color: cat.color, fontWeight: 600,
                                                            letterSpacing: '0.02em',
                                                        }}>
                                                            {cat.label}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
                                                            {n.created_at ? new Date(n.created_at).toLocaleString(undefined, {
                                                                month: 'short', day: 'numeric',
                                                                hour: '2-digit', minute: '2-digit',
                                                            }) : ''}
                                                        </span>
                                                        {n.category === 'ai_task' && n.message && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openResultModal({ title: n.title, content: n.message }, n.id); }}
                                                                style={{
                                                                    marginLeft: 'auto',
                                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                                    padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                                                                    border: 'none', cursor: 'pointer',
                                                                    background: 'rgba(139,92,246,0.08)', color: '#8b5cf6',
                                                                    transition: 'all 0.15s',
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.08)'}
                                                            >
                                                                <Sparkles style={{ width: 11, height: 11 }} />
                                                                View Full Result
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                    )}

                    {/* Reminders Tab */}
                    {tab === 'reminders' && (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                        {/* Add reminder button / form */}
                        <div style={{ padding: '8px 14px' }}>
                            {!showReminderForm ? (
                                <button
                                    onClick={() => setShowReminderForm(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        width: '100%', padding: '10px 12px',
                                        border: '1.5px dashed var(--border-subtle, rgba(0,0,0,0.12))',
                                        background: 'transparent', borderRadius: 12, cursor: 'pointer',
                                        color: '#6366f1', fontSize: 13, fontWeight: 600,
                                        transition: 'all 0.2s ease',
                                        letterSpacing: '0.01em',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; e.currentTarget.style.borderColor = '#6366f1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.12))'; }}
                                >
                                    <Plus style={{ width: 15, height: 15 }} />
                                    New Reminder
                                </button>
                            ) : (
                                <div style={{
                                    padding: 14, borderRadius: 14,
                                    background: 'var(--bg-secondary, #f8fafc)',
                                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                                    animation: 'notifExpand 0.2s ease',
                                }}>
                                    <input
                                        value={reminderTitle}
                                        onChange={e => setReminderTitle(e.target.value)}
                                        placeholder="What do you want to remember?"
                                        autoFocus
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 10,
                                            border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                            background: 'var(--bg-card, #fff)', fontSize: 13,
                                            color: 'var(--text-primary, #0f172a)', outline: 'none',
                                            marginBottom: 6, transition: 'border-color 0.15s',
                                            boxSizing: 'border-box',
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#6366f1'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.08))'}
                                    />
                                    <input
                                        value={reminderMessage}
                                        onChange={e => setReminderMessage(e.target.value)}
                                        placeholder="Add details (optional)"
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 10,
                                            border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                            background: 'var(--bg-card, #fff)', fontSize: 13,
                                            color: 'var(--text-primary, #0f172a)', outline: 'none',
                                            marginBottom: 6, transition: 'border-color 0.15s',
                                            boxSizing: 'border-box',
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#6366f1'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.08))'}
                                    />
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                        <input
                                            type="date"
                                            value={reminderDate}
                                            onChange={e => setReminderDate(e.target.value)}
                                            style={{
                                                flex: 1, padding: '9px 12px', borderRadius: 10,
                                                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                                background: 'var(--bg-card, #fff)', fontSize: 12,
                                                color: 'var(--text-primary, #0f172a)', outline: 'none',
                                                transition: 'border-color 0.15s',
                                            }}
                                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.08))'}
                                        />
                                        <input
                                            type="time"
                                            value={reminderTime}
                                            onChange={e => setReminderTime(e.target.value)}
                                            style={{
                                                flex: 1, padding: '9px 12px', borderRadius: 10,
                                                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                                background: 'var(--bg-card, #fff)', fontSize: 12,
                                                color: 'var(--text-primary, #0f172a)', outline: 'none',
                                                transition: 'border-color 0.15s',
                                            }}
                                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.08))'}
                                        />
                                    </div>
                                    <select
                                        value={reminderRepeat}
                                        onChange={e => setReminderRepeat(e.target.value)}
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 10,
                                            border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                            background: 'var(--bg-card, #fff)', fontSize: 12,
                                            color: 'var(--text-primary, #0f172a)', outline: 'none',
                                            marginBottom: 10, cursor: 'pointer',
                                        }}
                                    >
                                        <option value="">No repeat (one-time)</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => { setShowReminderForm(false); setReminderTitle(''); setReminderMessage(''); }}
                                            style={{
                                                padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                                                border: 'none', background: 'transparent', cursor: 'pointer',
                                                color: 'var(--text-muted, #64748b)',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >Cancel</button>
                                        <button
                                            onClick={createReminder}
                                            disabled={!reminderTitle.trim() || !reminderDate || !reminderTime}
                                            style={{
                                                padding: '7px 18px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                                                border: 'none',
                                                background: (!reminderTitle.trim() || !reminderDate || !reminderTime)
                                                    ? 'rgba(99,102,241,0.3)'
                                                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                color: '#fff', cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                boxShadow: (!reminderTitle.trim() || !reminderDate || !reminderTime)
                                                    ? 'none'
                                                    : '0 2px 8px rgba(99,102,241,0.25)',
                                            }}
                                        >Create</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Reminders list */}
                        {remindersLoading && reminders.length === 0 ? (
                            <div style={{
                                padding: 40, textAlign: 'center',
                                color: 'var(--text-muted, #94a3b8)', fontSize: 13
                            }}>
                                <div style={{
                                    width: 28, height: 28, margin: '0 auto 10px',
                                    border: '2px solid rgba(99,102,241,0.2)',
                                    borderTopColor: '#6366f1',
                                    borderRadius: '50%',
                                    animation: 'notifSpin 0.8s linear infinite',
                                }} />
                                Loading reminders...
                            </div>
                        ) : activeReminders.length === 0 && !showReminderForm ? (
                            <div style={{
                                padding: '40px 32px', textAlign: 'center',
                                color: 'var(--text-muted, #94a3b8)',
                            }}>
                                <div style={{
                                    width: 52, height: 52, margin: '0 auto 14px',
                                    borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(99,102,241,0.06)',
                                }}>
                                    <AlarmClock style={{ width: 24, height: 24, color: '#6366f1', opacity: 0.4 }} />
                                </div>
                                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                                    No reminders
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                                    Ask the AI or tap + to create one
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Overdue section */}
                                {overdueReminders.length > 0 && (
                                    <div style={{ padding: '4px 14px 0' }}>
                                        <div style={{
                                            fontSize: 10, fontWeight: 700, color: '#ef4444',
                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                            padding: '4px 0', marginBottom: 2,
                                        }}>
                                            Overdue
                                        </div>
                                    </div>
                                )}
                                {overdueReminders.map((r, index) => (
                                    <ReminderItem key={r.id} r={r} index={index} isOverdue
                                        onComplete={completeReminder} onDelete={deleteReminder} />
                                ))}

                                {/* Upcoming section */}
                                {upcomingReminders.length > 0 && (
                                    <div style={{ padding: `${overdueReminders.length > 0 ? 8 : 4}px 14px 0` }}>
                                        <div style={{
                                            fontSize: 10, fontWeight: 700, color: 'var(--text-muted, #94a3b8)',
                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                            padding: '4px 0', marginBottom: 2,
                                        }}>
                                            Upcoming
                                        </div>
                                    </div>
                                )}
                                {upcomingReminders.map((r, index) => (
                                    <ReminderItem key={r.id} r={r} index={index} isOverdue={false}
                                        onComplete={completeReminder} onDelete={deleteReminder} />
                                ))}
                            </>
                        )}
                    </div>
                    )}

                    {/* AI Tasks Tab */}
                    {tab === 'ai-tasks' && (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                        {/* Add task button / form */}
                        <div style={{ padding: '8px 14px' }}>
                            {!showAiTaskForm ? (
                                <button
                                    onClick={() => setShowAiTaskForm(true)}
                                    disabled={aiTasks.length >= maxAiTasks}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        width: '100%', padding: '10px 12px',
                                        border: '1.5px dashed var(--border-subtle, rgba(0,0,0,0.12))',
                                        background: 'transparent', borderRadius: 12, cursor: 'pointer',
                                        color: aiTasks.length >= maxAiTasks ? 'var(--text-muted, #94a3b8)' : '#8b5cf6',
                                        fontSize: 13, fontWeight: 600,
                                        transition: 'all 0.2s ease',
                                        letterSpacing: '0.01em',
                                        opacity: aiTasks.length >= maxAiTasks ? 0.5 : 1,
                                    }}
                                    onMouseEnter={e => { if (aiTasks.length < maxAiTasks) { e.currentTarget.style.background = 'rgba(139,92,246,0.04)'; e.currentTarget.style.borderColor = '#8b5cf6'; } }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.12))'; }}
                                >
                                    <Plus style={{ width: 15, height: 15 }} />
                                    New AI Task
                                    <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6, fontWeight: 500 }}>
                                        {aiTasks.length}/{maxAiTasks}
                                    </span>
                                </button>
                            ) : (
                                <div style={{
                                    padding: 14, borderRadius: 14,
                                    background: 'var(--bg-secondary, #f8fafc)',
                                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                                    animation: 'notifExpand 0.2s ease',
                                }}>
                                    <input
                                        value={aiTaskTitle}
                                        onChange={e => setAiTaskTitle(e.target.value)}
                                        placeholder="Task name (e.g. Weekly AI News Digest)"
                                        autoFocus
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 10,
                                            border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                            background: 'var(--bg-card, #fff)', fontSize: 13,
                                            color: 'var(--text-primary, #0f172a)', outline: 'none',
                                            marginBottom: 6, transition: 'border-color 0.15s',
                                            boxSizing: 'border-box',
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#8b5cf6'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.08))'}
                                    />
                                    <textarea
                                        value={aiTaskPrompt}
                                        onChange={e => setAiTaskPrompt(e.target.value)}
                                        placeholder="What should the AI do? Be specific...&#10;e.g. Search for the top 5 AI news from the past week and summarize each with a source link."
                                        rows={3}
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 10,
                                            border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                            background: 'var(--bg-card, #fff)', fontSize: 13,
                                            color: 'var(--text-primary, #0f172a)', outline: 'none',
                                            marginBottom: 6, transition: 'border-color 0.15s',
                                            boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#8b5cf6'}
                                        onBlur={e => e.target.style.borderColor = 'var(--border-subtle, rgba(0,0,0,0.08))'}
                                    />
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                        <input
                                            type="date"
                                            value={aiTaskDate}
                                            onChange={e => setAiTaskDate(e.target.value)}
                                            style={{
                                                flex: 1, padding: '9px 12px', borderRadius: 10,
                                                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                                background: 'var(--bg-card, #fff)', fontSize: 12,
                                                color: 'var(--text-primary, #0f172a)', outline: 'none',
                                            }}
                                        />
                                        <input
                                            type="time"
                                            value={aiTaskTime}
                                            onChange={e => setAiTaskTime(e.target.value)}
                                            style={{
                                                flex: 1, padding: '9px 12px', borderRadius: 10,
                                                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                                background: 'var(--bg-card, #fff)', fontSize: 12,
                                                color: 'var(--text-primary, #0f172a)', outline: 'none',
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                                        <select
                                            value={aiTaskRepeat}
                                            onChange={e => setAiTaskRepeat(e.target.value)}
                                            style={{
                                                flex: 1, padding: '9px 12px', borderRadius: 10,
                                                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                                background: 'var(--bg-card, #fff)', fontSize: 12,
                                                color: 'var(--text-primary, #0f172a)', outline: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                        <select
                                            value={aiTaskTier}
                                            onChange={e => setAiTaskTier(e.target.value)}
                                            style={{
                                                flex: 1, padding: '9px 12px', borderRadius: 10,
                                                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                                                background: 'var(--bg-card, #fff)', fontSize: 12,
                                                color: 'var(--text-primary, #0f172a)', outline: 'none',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <option value="fast">⚡ Fast (quick lookups)</option>
                                            <option value="smart">🧠 Smart (analysis)</option>
                                            <option value="thinking">💎 Thinking (deep research)</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => { setShowAiTaskForm(false); setAiTaskTitle(''); setAiTaskPrompt(''); }}
                                            style={{
                                                padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                                                border: 'none', background: 'transparent', cursor: 'pointer',
                                                color: 'var(--text-muted, #64748b)',
                                            }}
                                        >Cancel</button>
                                        <button
                                            onClick={createAiTask}
                                            disabled={!aiTaskTitle.trim() || !aiTaskPrompt.trim() || !aiTaskDate || !aiTaskTime}
                                            style={{
                                                padding: '7px 18px', borderRadius: 9, fontSize: 12, fontWeight: 600,
                                                border: 'none',
                                                background: (!aiTaskTitle.trim() || !aiTaskPrompt.trim() || !aiTaskDate || !aiTaskTime)
                                                    ? 'rgba(139,92,246,0.3)'
                                                    : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                                color: '#fff', cursor: 'pointer',
                                                boxShadow: (!aiTaskTitle.trim() || !aiTaskPrompt.trim() || !aiTaskDate || !aiTaskTime)
                                                    ? 'none'
                                                    : '0 2px 8px rgba(139,92,246,0.25)',
                                            }}
                                        >Create</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* AI Tasks list */}
                        {aiTasksLoading && aiTasks.length === 0 ? (
                            <div style={{
                                padding: 40, textAlign: 'center',
                                color: 'var(--text-muted, #94a3b8)', fontSize: 13,
                            }}>
                                <div style={{
                                    width: 28, height: 28, margin: '0 auto 10px',
                                    border: '2px solid rgba(139,92,246,0.2)',
                                    borderTopColor: '#8b5cf6',
                                    borderRadius: '50%',
                                    animation: 'notifSpin 0.8s linear infinite',
                                }} />
                                Loading AI tasks...
                            </div>
                        ) : aiTasks.length === 0 && !showAiTaskForm ? (
                            <div style={{
                                padding: '40px 32px', textAlign: 'center',
                                color: 'var(--text-muted, #94a3b8)',
                            }}>
                                <div style={{
                                    width: 52, height: 52, margin: '0 auto 14px',
                                    borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(139,92,246,0.06)',
                                }}>
                                    <Bot style={{ width: 24, height: 24, color: '#8b5cf6', opacity: 0.4 }} />
                                </div>
                                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
                                    No AI Tasks yet
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                                    Ask the AI chat or tap + to create one
                                </p>
                            </div>
                        ) : (
                            <>
                                {activeAiTasks.length > 0 && (
                                    <div style={{ padding: '4px 14px 0' }}>
                                        <div style={{
                                            fontSize: 10, fontWeight: 700, color: '#8b5cf6',
                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                            padding: '4px 0', marginBottom: 2,
                                        }}>Active</div>
                                    </div>
                                )}
                                {activeAiTasks.map((t, i) => (
                                    <AITaskItem key={t.id} task={t} index={i}
                                        expanded={expandedTaskId === t.id}
                                        onToggleExpand={() => setExpandedTaskId(expandedTaskId === t.id ? null : t.id)}
                                        onToggle={toggleAiTask} onDelete={deleteAiTask} onRunNow={runAiTaskNow}
                                        onOpenInChat={openInDirectChat}
                                        onOpenResult={(data) => setResultModal(data)} />
                                ))}
                                {inactiveAiTasks.length > 0 && (
                                    <div style={{ padding: '8px 14px 0' }}>
                                        <div style={{
                                            fontSize: 10, fontWeight: 700, color: 'var(--text-muted, #94a3b8)',
                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                            padding: '4px 0', marginBottom: 2,
                                        }}>Inactive</div>
                                    </div>
                                )}
                                {inactiveAiTasks.map((t, i) => (
                                    <AITaskItem key={t.id} task={t} index={i}
                                        expanded={expandedTaskId === t.id}
                                        onToggleExpand={() => setExpandedTaskId(expandedTaskId === t.id ? null : t.id)}
                                        onToggle={toggleAiTask} onDelete={deleteAiTask} onRunNow={runAiTaskNow}
                                        onOpenInChat={openInDirectChat}
                                        onOpenResult={(data) => setResultModal(data)} />
                                ))}
                            </>
                        )}
                    </div>
                    )}
                </div>
            )}

            {/* AI Task Result Modal */}
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
                        {/* Modal header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(99,102,241,0.02))',
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'rgba(139,92,246,0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(139,92,246,0.15)',
                                flexShrink: 0,
                            }}>
                                <Bot style={{ width: 18, height: 18, color: '#8b5cf6' }} />
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
                                    AI Task Result
                                </div>
                            </div>
                            <button
                                onClick={() => { openInDirectChat(resultModal.title, resultModal.content); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 14px', borderRadius: 10,
                                    fontSize: 13, fontWeight: 600,
                                    border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                    color: '#fff',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
                                    flexShrink: 0,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(139,92,246,0.4)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(139,92,246,0.3)'; }}
                            >
                                💬 Discuss in Chat
                            </button>
                            <button
                                onClick={() => setResultModal(null)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: 6, borderRadius: 8,
                                    color: 'var(--text-muted, #94a3b8)',
                                    transition: 'all 0.15s',
                                    flexShrink: 0,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = 'var(--text-primary, #0f172a)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; }}
                            >
                                <X style={{ width: 18, height: 18 }} />
                            </button>
                        </div>

                        {/* Modal body — markdown rendered */}
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
                @keyframes notifFadeIn {
                    from { opacity: 0; transform: translateX(-4px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes notifExpand {
                    from { opacity: 0; transform: scaleY(0.95); }
                    to { opacity: 1; transform: scaleY(1); }
                }
                @keyframes notifBadgePop {
                    0% { transform: scale(0.5); }
                    60% { transform: scale(1.15); }
                    100% { transform: scale(1); }
                }
                @keyframes notifSpin {
                    to { transform: rotate(360deg); }
                }
                @keyframes resultModalBgIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes resultModalIn {
                    from { opacity: 0; transform: translateY(12px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                /* Show delete button on hover */
                div:hover > div > .notif-delete-btn {
                    opacity: 0.4 !important;
                }
            `}</style>
        </div>
    );
}

function ReminderItem({ r, index, isOverdue, onComplete, onDelete }) {
    const dt = r.remindAt ? new Date(r.remindAt) : null;
    return (
        <div style={{
            padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
            borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.04))',
            animation: `notifFadeIn 0.2s ease ${index * 0.04}s both`,
            transition: 'background 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.01)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <button
                onClick={() => onComplete(r.id)}
                style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                    border: `1.5px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle, rgba(0,0,0,0.12))'}`,
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    marginTop: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; e.currentTarget.style.borderColor = '#22c55e'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = isOverdue ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle, rgba(0,0,0,0.12))'; }}
                title="Mark complete"
            >
                <Check style={{ width: 14, height: 14, color: '#22c55e', opacity: 0.5 }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: 'var(--text-primary, #0f172a)',
                    marginBottom: 3, lineHeight: 1.4,
                }}>
                    {r.title}
                </div>
                {r.message && (
                    <p style={{
                        fontSize: 12, color: 'var(--text-muted, #64748b)',
                        margin: '0 0 4px', lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {r.message}
                    </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11,
                        color: isOverdue ? '#ef4444' : 'var(--text-muted, #94a3b8)',
                        fontWeight: isOverdue ? 600 : 500,
                    }}>
                        <Clock style={{ width: 11, height: 11 }} />
                        {formatReminderTime(r.remindAt)}
                    </span>
                    {r.repeatInterval && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 10, padding: '2px 7px', borderRadius: 6,
                            background: 'rgba(99,102,241,0.06)', color: '#6366f1', fontWeight: 600,
                            letterSpacing: '0.02em',
                        }}>
                            <Repeat style={{ width: 10, height: 10 }} />
                            {r.repeatInterval}
                        </span>
                    )}
                    {isOverdue && (
                        <span style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 6,
                            background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontWeight: 600,
                        }}>
                            overdue
                        </span>
                    )}
                </div>
            </div>
            <button
                onClick={() => onDelete(r.id)}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 4, borderRadius: 6,
                    color: 'var(--text-muted, #94a3b8)',
                    opacity: 0, flexShrink: 0,
                    transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = 0; e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; }}
                title="Delete reminder"
                className="notif-delete-btn"
            >
                <Trash2 style={{ width: 13, height: 13 }} />
            </button>
        </div>
    );
}

function AITaskItem({ task, index, expanded, onToggleExpand, onToggle, onDelete, onRunNow, onOpenInChat, onOpenResult }) {
    const t = task;
    const statusColors = {
        pending: { bg: 'rgba(99,102,241,0.08)', color: '#6366f1', label: '⏳ Pending' },
        running: { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', label: '⚡ Running' },
        success: { bg: 'rgba(34,197,94,0.08)', color: '#22c55e', label: '✅ Success' },
        error: { bg: 'rgba(239,68,68,0.08)', color: '#ef4444', label: '❌ Error' },
    };
    const status = statusColors[t.lastStatus] || statusColors.pending;
    const tierLabels = { fast: '⚡ Fast', smart: '🧠 Smart', thinking: '💎 Thinking' };

    return (
        <div
            style={{
                padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start',
                borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.04))',
                animation: `notifFadeIn 0.2s ease ${index * 0.04}s both`,
                transition: 'background 0.15s ease',
                cursor: 'pointer',
                opacity: t.isActive ? 1 : 0.55,
            }}
            onClick={onToggleExpand}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.01)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <div style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                background: t.isActive ? 'rgba(139,92,246,0.08)' : 'rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${t.isActive ? 'rgba(139,92,246,0.15)' : 'rgba(0,0,0,0.06)'}`,
            }}>
                <Bot style={{ width: 16, height: 16, color: t.isActive ? '#8b5cf6' : '#94a3b8' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: 'var(--text-primary, #0f172a)',
                    marginBottom: 3, lineHeight: 1.4,
                }}>{t.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 6,
                        background: status.bg, color: status.color, fontWeight: 600,
                    }}>{status.label}</span>
                    {t.repeatInterval && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 10, padding: '2px 7px', borderRadius: 6,
                            background: 'rgba(139,92,246,0.06)', color: '#8b5cf6', fontWeight: 600,
                        }}>
                            <Repeat style={{ width: 10, height: 10 }} />
                            {t.repeatInterval}
                        </span>
                    )}
                    <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 6,
                        background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted, #94a3b8)',
                        fontWeight: 600,
                    }}>{tierLabels[t.modelTier] || t.modelTier}</span>
                </div>
                {t.nextRunAt && t.isActive && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, color: 'var(--text-muted, #94a3b8)',
                        marginTop: 4, fontWeight: 500,
                    }}>
                        <Clock style={{ width: 11, height: 11 }} />
                        Next: {formatReminderTime(t.nextRunAt)}
                    </div>
                )}

                {/* Expanded content */}
                {expanded && (
                    <div style={{
                        marginTop: 10, padding: '10px 12px',
                        background: 'var(--bg-secondary, #f8fafc)',
                        borderRadius: 10,
                        border: '1px solid var(--border-subtle, rgba(0,0,0,0.05))',
                        animation: 'notifExpand 0.2s ease',
                    }}>
                        <div style={{
                            fontSize: 10, fontWeight: 700, color: 'var(--text-muted, #94a3b8)',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                            marginBottom: 6,
                        }}>Prompt</div>
                        <p style={{
                            fontSize: 12, color: 'var(--text-secondary, #64748b)',
                            margin: '0 0 10px', lineHeight: 1.5,
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>{t.prompt}</p>

                        {t.lastResult && (
                            <>
                                <div style={{
                                    fontSize: 10, fontWeight: 700, color: 'var(--text-muted, #94a3b8)',
                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                    marginBottom: 6,
                                    display: 'flex', alignItems: 'center', gap: 8,
                                }}>
                                    <span>Last Result {t.lastRunAt && <span style={{ fontWeight: 500, textTransform: 'none' }}>• {timeAgo(t.lastRunAt)}</span>}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenResult && onOpenResult({ title: t.title, content: t.lastResult }); }}
                                        style={{
                                            marginLeft: 'auto',
                                            display: 'flex', alignItems: 'center', gap: 3,
                                            padding: '2px 8px', borderRadius: 6,
                                            fontSize: 10, fontWeight: 600,
                                            border: 'none', cursor: 'pointer',
                                            background: 'rgba(139,92,246,0.08)', color: '#8b5cf6',
                                            textTransform: 'none', letterSpacing: 'normal',
                                            transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.08)'}
                                    >
                                        View ↗
                                    </button>
                                </div>
                                <div style={{
                                    fontSize: 12, color: 'var(--text-primary, #0f172a)',
                                    lineHeight: 1.6,
                                    maxHeight: 120, overflowY: 'hidden',
                                    padding: '8px 10px', borderRadius: 8,
                                    background: 'var(--bg-card, #fff)',
                                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.05))',
                                    position: 'relative',
                                }}>
                                    <MarkdownRenderer content={t.lastResult} />
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
                                        background: 'linear-gradient(transparent, var(--bg-card, #fff))',
                                        pointerEvents: 'none',
                                    }} />
                                </div>
                            </>
                        )}

                        {t.runCount > 0 && (
                            <div style={{
                                fontSize: 11, color: 'var(--text-muted, #94a3b8)',
                                marginTop: 8,
                            }}>
                                Ran {t.runCount} time{t.runCount !== 1 ? 's' : ''}
                            </div>
                        )}

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRunNow(t.id); }}
                                disabled={t.lastStatus === 'running'}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                                    border: 'none', cursor: 'pointer',
                                    background: 'rgba(139,92,246,0.08)', color: '#8b5cf6',
                                    opacity: t.lastStatus === 'running' ? 0.5 : 1,
                                    transition: 'all 0.15s',
                                }}
                            >
                                <Play style={{ width: 11, height: 11 }} />
                                Run Now
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggle(t.id); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                                    border: 'none', cursor: 'pointer',
                                    background: t.isActive ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                                    color: t.isActive ? '#f59e0b' : '#22c55e',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {t.isActive ? <Pause style={{ width: 11, height: 11 }} /> : <Play style={{ width: 11, height: 11 }} />}
                                {t.isActive ? 'Pause' : 'Resume'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 4, borderRadius: 6,
                    color: 'var(--text-muted, #94a3b8)',
                    opacity: 0, flexShrink: 0,
                    transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = 0; e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'; }}
                title="Delete AI task"
                className="notif-delete-btn"
            >
                <Trash2 style={{ width: 13, height: 13 }} />
            </button>
        </div>
    );
}
