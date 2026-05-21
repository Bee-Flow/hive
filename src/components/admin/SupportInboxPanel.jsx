import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, Send, CheckCircle2, AlertTriangle, RefreshCw, Bot, User, Settings as SettingsIcon, Shield, ChevronDown, ChevronRight, History } from 'lucide-react';
import { authFetch, API_BASE } from '../../utils/helpers';
import SupportAIConfig from './SupportAIConfig';

// Mirrors server/auth/permissions.js OrgRoles for display purposes.
const ROLE_LABELS = {
    org_admin: 'Org admin',
    admin: 'Org admin',         // legacy variant — normalised to org_admin server-side
    dpo: 'DPO',
    agent_admin: 'Agent admin',
    agent_editor: 'Agent editor',
    member: 'Member',
};
function roleLabel(role) {
    if (!role) return 'Guest';
    return ROLE_LABELS[role] || role;
}

const STATUS_LABELS = {
    open: 'Open',
    ai_responding: 'AI replying',
    awaiting_user: 'Awaiting user',
    awaiting_agent: 'Awaiting agent',
    resolved: 'Resolved',
    closed: 'Closed',
};

const STATUS_DOT = {
    open: '#3b82f6',
    ai_responding: '#0ea5e9',
    awaiting_user: '#94a3b8',
    awaiting_agent: '#f59e0b',
    resolved: '#10b981',
    closed: '#6b7280',
};

const PRIORITY_BADGES = {
    low: { label: 'Low', bg: 'rgba(148,163,184,0.15)', fg: '#64748b' },
    normal: { label: 'Normal', bg: 'rgba(59,130,246,0.12)', fg: '#2563eb' },
    high: { label: 'High', bg: 'rgba(245,158,11,0.15)', fg: '#b45309' },
    urgent: { label: 'Urgent', bg: 'rgba(239,68,68,0.15)', fg: '#dc2626' },
};

function formatRelative(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const m = Math.round(diffMs / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.round(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
}

export default function SupportInboxPanel({ focusThreadId = null }) {
    const [threads, setThreads] = useState([]);
    const [counts, setCounts] = useState({});
    const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'all' | one of statuses
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState(focusThreadId || null);
    const [thread, setThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [reply, setReply] = useState('');
    const [internalNote, setInternalNote] = useState(false);
    const [sending, setSending] = useState(false);
    const [view, setView] = useState('inbox'); // 'inbox' | 'ai-config'
    const [showActivity, setShowActivity] = useState(false);
    const [activity, setActivity] = useState([]);
    const esRef = useRef(null);

    const statusInQuery = useMemo(() => {
        if (statusFilter === 'all') return null;
        if (statusFilter === 'active') return ['open', 'ai_responding', 'awaiting_user', 'awaiting_agent'];
        return [statusFilter];
    }, [statusFilter]);

    const fetchThreads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusInQuery) params.set('status', statusInQuery.join(','));
            if (search.trim()) params.set('q', search.trim());
            const res = await authFetch(`${API_BASE}/api/support/threads?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setThreads(data.threads || []);
                setCounts(data.counts || {});
            }
        } catch (e) {
            console.warn('[Support] fetchThreads:', e.message);
        } finally {
            setLoading(false);
        }
    }, [statusInQuery, search]);

    const fetchThread = useCallback(async (id) => {
        if (!id) return;
        try {
            const res = await authFetch(`${API_BASE}/api/support/threads/${id}`);
            if (res.ok) {
                const data = await res.json();
                setThread(data.thread);
                setMessages(data.messages || []);
            }
        } catch (e) {
            console.warn('[Support] fetchThread:', e.message);
        }
    }, []);

    useEffect(() => { fetchThreads(); }, [fetchThreads]);
    useEffect(() => {
        if (selectedId) fetchThread(selectedId);
        else { setThread(null); setMessages([]); }
        setShowActivity(false);
        setActivity([]);
    }, [selectedId, fetchThread]);

    const fetchActivity = useCallback(async () => {
        if (!selectedId) return;
        try {
            const res = await authFetch(`${API_BASE}/api/support/threads/${selectedId}/events`);
            if (res.ok) {
                const data = await res.json();
                setActivity(Array.isArray(data?.events) ? data.events : []);
            }
        } catch {}
    }, [selectedId]);

    useEffect(() => {
        if (showActivity && selectedId) fetchActivity();
    }, [showActivity, selectedId, fetchActivity]);

    // SSE — listen for thread_created / thread_updated and refresh.
    useEffect(() => {
        try {
            const es = new EventSource(`${API_BASE}/api/support/stream`, { withCredentials: true });
            esRef.current = es;
            const refresh = () => fetchThreads();
            const refreshOpen = (e) => {
                try {
                    const payload = JSON.parse(e.data || '{}');
                    if (selectedId && payload.threadId === selectedId) fetchThread(selectedId);
                } catch {}
                refresh();
            };
            es.addEventListener('thread_created', refresh);
            es.addEventListener('thread_updated', refreshOpen);
            es.onerror = () => { /* let EventSource auto-retry */ };
            return () => {
                try { es.close(); } catch {}
            };
        } catch (e) {
            console.warn('[Support] SSE failed:', e.message);
        }
    }, [fetchThreads, fetchThread, selectedId]);

    const sendReply = async () => {
        const body = reply.trim();
        if (!body || !selectedId) return;
        setSending(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support/threads/${selectedId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body, internalNote }),
            });
            if (res.ok) {
                setReply('');
                setInternalNote(false);
                await fetchThread(selectedId);
                await fetchThreads();
            }
        } finally {
            setSending(false);
        }
    };

    const patchThread = async (patch) => {
        if (!selectedId) return;
        const res = await authFetch(`${API_BASE}/api/support/threads/${selectedId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        if (res.ok) {
            await fetchThread(selectedId);
            await fetchThreads();
        }
    };

    const counter = (key) => counts[key] || 0;
    const activeTotal = counter('open') + counter('ai_responding') + counter('awaiting_user') + counter('awaiting_agent');

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-3">
                    <Inbox className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Customer Support</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        {activeTotal} active · {counter('resolved')} resolved
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* View tabs — Inbox / AI configuration */}
                    <div className="flex gap-1 p-1 rounded-md" style={{ background: 'var(--bg-tertiary)' }}>
                        <button
                            onClick={() => setView('inbox')}
                            className="px-3 py-1 rounded text-sm font-medium flex items-center gap-1.5"
                            style={{
                                background: view === 'inbox' ? 'var(--accent-primary)' : 'transparent',
                                color: view === 'inbox' ? 'white' : 'var(--text-secondary)',
                            }}
                        >
                            <Inbox className="w-3.5 h-3.5" /> Inbox
                        </button>
                        <button
                            onClick={() => setView('ai-config')}
                            className="px-3 py-1 rounded text-sm font-medium flex items-center gap-1.5"
                            style={{
                                background: view === 'ai-config' ? 'var(--accent-primary)' : 'transparent',
                                color: view === 'ai-config' ? 'white' : 'var(--text-secondary)',
                            }}
                        >
                            <SettingsIcon className="w-3.5 h-3.5" /> AI configuration
                        </button>
                    </div>
                    {view === 'inbox' && (
                        <button onClick={fetchThreads} title="Refresh" className="p-2 rounded-md hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}
                </div>
            </div>

            {view === 'ai-config' ? (
                <div className="flex-1 min-h-0">
                    <SupportAIConfig />
                </div>
            ) : (
            <>
            {/* Inbox view (default) */}

            <div className="flex-1 min-h-0 grid grid-cols-12">
                {/* Left: thread list */}
                <div className="col-span-4 border-r flex flex-col min-h-0" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchThreads()}
                            placeholder="Search subject or email..."
                            className="flex-1 px-3 py-1.5 rounded-md border text-sm"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    <div className="px-3 py-2 border-b flex gap-1 overflow-x-auto" style={{ borderColor: 'var(--border-default)' }}>
                        {[
                            { id: 'active', label: `Active (${activeTotal})` },
                            { id: 'awaiting_agent', label: `Awaiting (${counter('awaiting_agent')})` },
                            { id: 'awaiting_user', label: `Sent (${counter('awaiting_user')})` },
                            { id: 'resolved', label: `Resolved (${counter('resolved')})` },
                            { id: 'all', label: 'All' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setStatusFilter(f.id)}
                                className="px-2 py-1 rounded-md text-xs whitespace-nowrap"
                                style={{
                                    background: statusFilter === f.id ? 'var(--accent-primary)' : 'var(--bg-card)',
                                    color: statusFilter === f.id ? 'white' : 'var(--text-secondary)',
                                    border: '1px solid var(--border-default)',
                                }}
                            >{f.label}</button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {threads.length === 0 && !loading && (
                            <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No threads</div>
                        )}
                        {threads.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedId(t.id)}
                                className="w-full text-left px-3 py-2.5 border-b hover:bg-[var(--bg-tertiary)]"
                                style={{
                                    borderColor: 'var(--border-default)',
                                    background: selectedId === t.id ? 'var(--bg-tertiary)' : 'transparent',
                                }}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS_DOT[t.status] }} />
                                    <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                        {STATUS_LABELS[t.status] || t.status}
                                    </span>
                                    {t.source === 'marketing' && (
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.12)', color: '#2563eb' }}>marketing</span>
                                    )}
                                    {PRIORITY_BADGES[t.priority] && t.priority !== 'normal' && (
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={PRIORITY_BADGES[t.priority] && { background: PRIORITY_BADGES[t.priority].bg, color: PRIORITY_BADGES[t.priority].fg }}>
                                            {PRIORITY_BADGES[t.priority].label}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm font-medium line-clamp-1" style={{ color: 'var(--text-primary)' }}>{t.subject}</div>
                                <div className="text-xs mt-0.5 flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                                    <span className="truncate">{t.requester_email}</span>
                                    <span className="shrink-0 ml-2">{formatRelative(t.last_message_at)}</span>
                                </div>
                                {(t.requester_org_role || t.requester_org_name) && (
                                    <div className="text-xs mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                            <Shield className="w-3 h-3" /> {roleLabel(t.requester_org_role)}
                                        </span>
                                        {t.requester_org_name && (
                                            <span className="truncate">{t.requester_org_name}</span>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: thread detail */}
                <div className="col-span-8 flex flex-col min-h-0" style={{ background: 'var(--bg-card)' }}>
                    {!thread ? (
                        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
                            Select a thread to view the conversation
                        </div>
                    ) : (
                        <>
                            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{thread.subject}</div>
                                        <div className="text-xs flex flex-wrap items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                                            <span>From: {thread.requester_name ? `${thread.requester_name} <${thread.requester_email}>` : thread.requester_email}</span>
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                                <Shield className="w-3 h-3" /> {roleLabel(thread.requester_org_role)}
                                            </span>
                                            {thread.requester_org_name && (
                                                <span>at <strong style={{ color: 'var(--text-primary)' }}>{thread.requester_org_name}</strong></span>
                                            )}
                                            <span>Source: {thread.source}</span>
                                            {thread.ai_handled && <span style={{ color: '#0ea5e9' }}>AI handled</span>}
                                            {thread.ai_escalated_reason && <span style={{ color: '#b45309' }}>Escalated: {thread.ai_escalated_reason}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={thread.status}
                                            onChange={e => patchThread({ status: e.target.value })}
                                            className="px-2 py-1 rounded-md border text-xs"
                                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        >
                                            {Object.entries(STATUS_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                                        </select>
                                        <select
                                            value={thread.priority}
                                            onChange={e => patchThread({ priority: e.target.value })}
                                            className="px-2 py-1 rounded-md border text-xs"
                                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        >
                                            {Object.entries(PRIORITY_BADGES).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
                                        </select>
                                        {thread.status !== 'resolved' && (
                                            <button
                                                onClick={() => patchThread({ status: 'resolved' })}
                                                className="px-2 py-1 rounded-md text-xs flex items-center gap-1 border"
                                                style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', borderColor: 'rgba(16,185,129,0.3)' }}
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {(() => {
                                const failed = messages.find(m => m.email_send_status && m.email_send_status.ok === false);
                                if (!failed) return null;
                                const err = failed.email_send_status?.error || 'Unknown error';
                                return (
                                    <div className="px-4 py-2 border-b text-xs flex items-start gap-2"
                                        style={{ background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.35)', color: '#92400e' }}>
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-medium">Outbound email failed for one of the messages in this thread.</div>
                                            <div className="opacity-80">{err}</div>
                                            <div className="opacity-60 mt-0.5">Check Admin → Integrations → Email and confirm SMTP credentials are valid.</div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="px-4 py-1.5 border-b" style={{ borderColor: 'var(--border-default)' }}>
                                <button
                                    onClick={() => setShowActivity(v => !v)}
                                    className="text-xs flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    {showActivity ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    <History className="w-3 h-3" /> Activity log
                                    {activity.length > 0 && (
                                        <span className="ml-1 px-1.5 py-0 rounded" style={{ background: 'var(--bg-tertiary)' }}>{activity.length}</span>
                                    )}
                                </button>
                                {showActivity && (
                                    <div className="mt-2 max-h-40 overflow-y-auto text-xs space-y-1 pl-4 pb-2" style={{ color: 'var(--text-muted)' }}>
                                        {activity.length === 0 && <div className="opacity-60">No events recorded yet.</div>}
                                        {activity.map(ev => (
                                            <div key={ev.id} className="flex items-baseline gap-2">
                                                <span style={{ color: 'var(--text-secondary)', minWidth: 84 }}>{formatRelative(ev.created_at)}</span>
                                                <span><strong>{ev.actor_kind}{ev.actor_user_id ? ` (${ev.actor_user_id.slice(0, 8)})` : ''}</strong> — {ev.action}{ev.payload && Object.keys(ev.payload).length ? `: ${JSON.stringify(ev.payload).slice(0, 120)}` : ''}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {messages.map(m => {
                                    const isStaff = m.author_kind === 'staff';
                                    const isAI = m.author_kind === 'ai';
                                    const isSystem = m.author_kind === 'system';
                                    return (
                                        <div key={m.id} className="rounded-lg p-3 text-sm" style={{
                                            background: m.internal_note ? 'rgba(245,158,11,0.08)'
                                                : isStaff ? 'rgba(16,185,129,0.08)'
                                                    : isAI ? 'rgba(14,165,233,0.08)'
                                                        : isSystem ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                            border: '1px solid var(--border-default)',
                                            color: 'var(--text-primary)',
                                        }}>
                                            <div className="flex items-center gap-2 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                                {isAI ? <Bot className="w-3.5 h-3.5" /> : isStaff ? <User className="w-3.5 h-3.5" /> : isSystem ? <AlertTriangle className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                                <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                                                    {m.author_display || m.author_kind}
                                                </span>
                                                {m.internal_note && <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#b45309' }}>internal note</span>}
                                                <span className="ml-auto">{formatRelative(m.created_at)}</span>
                                            </div>
                                            <div className="whitespace-pre-wrap">{m.body}</div>
                                            {Array.isArray(m.kb_citations) && m.kb_citations.length > 0 && (
                                                <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                                                    Cited: {m.kb_citations.map(c => c.title).filter(Boolean).join(' · ')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="border-t p-3" style={{ borderColor: 'var(--border-default)' }}>
                                <textarea
                                    rows={3}
                                    value={reply}
                                    onChange={e => setReply(e.target.value)}
                                    placeholder={internalNote ? 'Internal note (only visible to staff)…' : 'Reply to the customer…'}
                                    className="w-full px-3 py-2 rounded-md border text-sm resize-y"
                                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                                <div className="mt-2 flex items-center justify-between">
                                    <label className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={internalNote} onChange={e => setInternalNote(e.target.checked)} />
                                        Internal note
                                    </label>
                                    <button
                                        onClick={sendReply}
                                        disabled={sending || !reply.trim()}
                                        className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                                        style={{ background: 'var(--accent-primary)', color: 'white' }}
                                    >
                                        <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : (internalNote ? 'Save note' : 'Send reply')}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            </>
            )}
        </div>
    );
}
