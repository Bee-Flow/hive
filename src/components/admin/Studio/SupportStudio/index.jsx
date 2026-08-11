import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Settings, Inbox, LifeBuoy, Sparkles, Send, RefreshCw, CheckCircle2, Loader2, Search, BarChart3, Flag, Tag as TagIcon, Users, MessageSquareText, EyeOff, RotateCcw, Clock, Star, AlertTriangle } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import StudioShell from '../../../shared/StudioShell';
import EmailHtmlBody from '../../EmailHtmlBody';
import SupportSettings from './SupportSettings';
import InsightsPanel from './InsightsPanel';
import TicketTimeline from './TicketTimeline';
import useSupportInboxEvents from './useSupportInboxEvents';

const NOT_SUPPORT_TAG = 'not-support';
const STATUS_IDS = ['open', 'ai_responding', 'awaiting_user', 'awaiting_agent', 'resolved', 'closed'];
const PRIORITY_IDS = ['low', 'normal', 'high', 'urgent'];
const STATUS_COLORS = {
    open: 'text-blue-500',
    ai_responding: 'text-amber-500',
    awaiting_user: 'text-[var(--text-tertiary)]',
    awaiting_agent: 'text-amber-600',
    resolved: 'text-green-500',
    closed: 'text-[var(--text-tertiary)]',
};
// Status tabs + a tag-based "Not support" pseudo-tab.
const FILTER_IDS = ['awaiting_agent', 'awaiting_user', 'resolved', '', 'not_support'];

// Auto-refresh interval choices for the ticket list (persisted per browser).
const AUTO_REFRESH_STORAGE_KEY = 'support.autoRefreshMs';
const DEFAULT_AUTO_REFRESH_MS = 30000;
const AUTO_REFRESH_OPTIONS = [
    { ms: 0, key: 'off' },
    { ms: 15000, key: '15s' },
    { ms: 30000, key: '30s' },
    { ms: 60000, key: '1m' },
    { ms: 300000, key: '5m' },
];

const autoRefreshLabel = (t, key) => {
    if (key === 'off') return t('support.refresh.off', 'Off');
    return t(`support.refresh.${key}`, key);
};

const readStoredAutoRefreshMs = () => {
    try {
        const raw = window.localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
        if (raw === null) return DEFAULT_AUTO_REFRESH_MS;
        const v = Number(raw);
        return AUTO_REFRESH_OPTIONS.some(o => o.ms === v) ? v : DEFAULT_AUTO_REFRESH_MS;
    } catch (_) { return DEFAULT_AUTO_REFRESH_MS; }
};

const statusLabel = (t, s) => {
    if (s === '') return t('support.filter.all', 'All');
    if (s === 'not_support') return t('support.filter.not_support', 'Not support');
    return t(`support.status.${s}`, s);
};

function Dot({ status }) {
    return <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[status] || 'text-[var(--text-tertiary)]'}`} style={{ backgroundColor: 'currentColor' }} />;
}

const slaBreached = (th) => !!(th && (th.sla_first_response_breached_at || th.sla_resolution_breached_at));

/**
 * SupportStudio — tenant customer-support inbox inside the Studio.
 * Backend: /api/support-inbox/* (support_inbox license + beta + permission).
 */
/**
 * @param {string} [initialTicketId] Open this thread on mount instead of the
 *   "Select a ticket" pane. Same seam SkillsStudio, KBsStudio, AgentStudio and
 *   NotebooksPage already expose (`initialSkillId`, `initialKbId`, …) — it is
 *   how a deep link, and the public demo, land on something worth reading
 *   rather than on an empty right-hand pane.
 */
export default function SupportStudio({ user, initialTicketId = null }) {
    const { t } = useTranslation();
    const [inboxes, setInboxes] = useState([]);
    const [activeInbox, setActiveInbox] = useState('all');
    const [statusFilter, setStatusFilter] = useState('awaiting_agent');
    const [search, setSearch] = useState('');
    const [threads, setThreads] = useState([]);
    const [counts, setCounts] = useState({});
    const [activeThreadId, setActiveThreadId] = useState(initialTicketId);
    const [view, setView] = useState('inbox'); // 'inbox' | 'settings' | 'insights'
    const [limit, setLimit] = useState(100);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefreshMs, setAutoRefreshMs] = useState(readStoredAutoRefreshMs);

    const fetchInboxes = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes`);
            if (res.ok) { const d = await res.json(); setInboxes(d.inboxes || []); }
        } catch (_) {}
    }, []);

    const fetchThreads = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (activeInbox && activeInbox !== 'all') params.set('inbox', activeInbox);
            if (statusFilter === 'not_support') params.set('tag', NOT_SUPPORT_TAG);
            else if (statusFilter) params.set('status', statusFilter);
            if (search.trim()) params.set('q', search.trim());
            params.set('limit', String(limit));
            const res = await authFetch(`${API_BASE}/api/support-inbox/threads?${params.toString()}`);
            if (res.ok) { const d = await res.json(); setThreads(d.threads || []); setCounts(d.counts || {}); }
        } catch (_) {}
    }, [activeInbox, statusFilter, search, limit]);

    // Manual refresh — same fetch, but with a spinning indicator so the click
    // gives visible feedback even when the list comes back unchanged.
    const manualRefresh = useCallback(async () => {
        setRefreshing(true);
        try { await fetchThreads(); } finally { setRefreshing(false); }
    }, [fetchThreads]);

    useEffect(() => { fetchInboxes(); }, [fetchInboxes]);
    useEffect(() => {
        const id = setTimeout(fetchThreads, search ? 250 : 0); // debounce search typing
        return () => clearTimeout(id);
    }, [fetchThreads, search]);

    // Persist the chosen interval so it sticks across reloads.
    useEffect(() => {
        try { window.localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(autoRefreshMs)); } catch (_) {}
    }, [autoRefreshMs]);

    // Poll the ticket list on the chosen interval. This is the reliable fallback
    // when the SSE stream is idle-dropped (e.g. behind an embed gateway), so the
    // list stays fresh without a manual refresh.
    useEffect(() => {
        if (!autoRefreshMs) return undefined;
        const id = setInterval(() => { fetchThreads(); }, autoRefreshMs);
        return () => clearInterval(id);
    }, [autoRefreshMs, fetchThreads]);

    // Live updates: refresh the ticket list on any inbox event. The open ticket
    // refreshes via its own Refresh control / re-open.
    const onEvent = useCallback(() => { fetchThreads(); }, [fetchThreads]);
    useSupportInboxEvents(onEvent);

    const hasConnected = inboxes.some(i => i.connected);
    const filterCount = (id) => (id === 'not_support' ? counts.not_support : counts[id]);

    return (
        <StudioShell
            sidebarTitle={(
                <span className="flex items-center gap-2">
                    <LifeBuoy size={15} /> {t('studio.tab.support', 'Support')}
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">Beta</span>
                </span>
            )}
            sidebarActions={(
                <span className="flex items-center gap-1">
                    <button onClick={() => setView(v => v === 'insights' ? 'inbox' : 'insights')}
                        className={`p-1 rounded hover:bg-[var(--bg-secondary)] ${view === 'insights' ? 'text-[var(--accent-primary)]' : ''}`}
                        title={t('support.nav.insights', 'Insights')}>
                        <BarChart3 size={14} />
                    </button>
                    <button onClick={() => setView(v => v === 'settings' ? 'inbox' : 'settings')}
                        className={`p-1 rounded hover:bg-[var(--bg-secondary)] ${view === 'settings' ? 'text-[var(--accent-primary)]' : ''}`}
                        title={t('support.nav.settings', 'Settings')}>
                        <Settings size={14} />
                    </button>
                </span>
            )}
            sidebar={(
                <div className="flex flex-col gap-2 p-3">
                    <select value={activeInbox} onChange={e => setActiveInbox(e.target.value)}
                        className="text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5">
                        <option value="all">{t('support.nav.all_inboxes', 'All inboxes')}</option>
                        {inboxes.map(i => <option key={i.id} value={i.id}>{i.email_address || i.display_name || i.provider}</option>)}
                    </select>

                    <div className="relative">
                        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={t('support.ticket.search', 'Search tickets…')}
                            className="w-full text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] pl-7 pr-2 py-1.5" />
                    </div>

                    <div className="flex flex-wrap gap-1">
                        {FILTER_IDS.map(id => (
                            <button key={id || 'all'} onClick={() => setStatusFilter(id)}
                                className={`text-[11px] px-2 py-1 rounded border ${statusFilter === id
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                                {statusLabel(t, id)}{filterCount(id) ? ` (${filterCount(id)})` : ''}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between mt-1 px-1">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{t('support.nav.tickets', 'Tickets')}</h4>
                        <div className="flex items-center gap-1">
                            <select value={autoRefreshMs} onChange={e => setAutoRefreshMs(Number(e.target.value))}
                                title={t('support.refresh.auto_title', 'Auto-refresh interval')}
                                className="text-[10px] rounded border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-tertiary)] px-1 py-0.5">
                                {AUTO_REFRESH_OPTIONS.map(o => (
                                    <option key={o.key} value={o.ms}>{autoRefreshLabel(t, o.key)}</option>
                                ))}
                            </select>
                            <button onClick={manualRefresh} disabled={refreshing}
                                className="p-0.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] disabled:opacity-60"
                                title={t('support.common.refresh', 'Refresh')}>
                                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {threads.length === 0 && (
                        <div className="text-xs text-[var(--text-tertiary)] italic px-1">
                            {statusFilter === 'not_support'
                                ? t('support.empty.no_not_support', 'No non-support email here.')
                                : hasConnected ? t('support.empty.no_tickets', 'No tickets in this view.') : t('support.empty.connect_first', 'Connect a mailbox via Settings first.')}
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        {threads.map(th => (
                            <button key={th.id} onClick={() => { setActiveThreadId(th.id); setView('inbox'); }}
                                className={`text-left text-xs px-3 py-2 rounded border ${activeThreadId === th.id
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                    : 'border-transparent hover:bg-[var(--bg-secondary)]'}`}>
                                <div className="flex items-center gap-1.5">
                                    <Dot status={th.status} />
                                    <span className="font-medium truncate flex-1 text-[var(--text-primary)]">{th.subject || t('support.thread.no_subject', '(no subject)')}</span>
                                    {slaBreached(th) && <AlertTriangle size={11} className="text-rose-500" title={t('support.ticket.sla_breached', 'SLA breached')} />}
                                    {th.priority && th.priority !== 'normal' && <Flag size={11} className={th.priority === 'urgent' || th.priority === 'high' ? 'text-rose-500' : 'text-[var(--text-tertiary)]'} />}
                                </div>
                                <div className="text-[var(--text-tertiary)] truncate mt-0.5">{th.requester_email}</div>
                            </button>
                        ))}
                    </div>
                    {threads.length >= limit && (
                        <button onClick={() => setLimit(l => l + 100)}
                            className="text-[11px] px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                            {t('support.nav.load_more', 'Load more')}
                        </button>
                    )}
                </div>
            )}
        >
            {view === 'settings'
                ? <SupportSettings inboxes={inboxes} user={user}
                    onChanged={() => { fetchInboxes(); fetchThreads(); }}
                    onOpenThread={(id) => { setActiveThreadId(id); setView('inbox'); }} />
                : view === 'insights'
                    ? <InsightsPanel inboxes={inboxes} activeInbox={activeInbox} onChanged={() => { fetchInboxes(); fetchThreads(); }} />
                    : activeThreadId
                        ? <TicketDetail key={activeThreadId} threadId={activeThreadId} user={user} onChanged={fetchThreads} autoRefreshMs={autoRefreshMs} />
                        : <EmptyState hasConnected={hasConnected} onSettings={() => setView('settings')} />}
        </StudioShell>
    );
}

function EmptyState({ hasConnected, onSettings }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-8">
            <Inbox size={32} className="text-[var(--text-tertiary)]" />
            <div className="text-sm font-semibold text-[var(--text-secondary)]">
                {hasConnected ? t('support.empty.select_ticket', 'Select a ticket') : t('support.empty.connect_mailbox', 'Connect your support mailbox')}
            </div>
            <div className="text-xs text-[var(--text-tertiary)] max-w-sm">
                {hasConnected
                    ? t('support.empty.select_hint', 'Pick a ticket on the left to view the conversation and reply with your AI agent.')
                    : t('support.empty.connect_hint', 'Connect a Gmail or Outlook support mailbox. Incoming emails become tickets you answer with an agent + knowledge base.')}
            </div>
            {!hasConnected && (
                <button onClick={onSettings} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded text-white font-medium" style={{ background: 'var(--accent-primary)' }}>
                    <Plus size={12} /> {t('support.empty.connect_cta', 'Connect mailbox')}
                </button>
            )}
        </div>
    );
}

function TicketDetail({ threadId, user, onChanged, autoRefreshMs = 0 }) {
    const { t } = useTranslation();
    const [thread, setThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [reply, setReply] = useState('');
    const [internal, setInternal] = useState(false);
    const [busy, setBusy] = useState(false);
    const [drafting, setDrafting] = useState(false);
    const [teammates, setTeammates] = useState([]);
    const [tagPalette, setTagPalette] = useState([]);
    const [canned, setCanned] = useState([]);
    const [showCanned, setShowCanned] = useState(false);
    const [showActivity, setShowActivity] = useState(false);
    const [context, setContext] = useState(null);
    const [showContext, setShowContext] = useState(false);

    const load = useCallback(async () => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/threads/${threadId}`);
        if (res.ok) { const d = await res.json(); setThread(d.thread); setMessages(d.messages || []); }
    }, [threadId]);
    useEffect(() => { load(); }, [load]);

    // Keep the open conversation fresh on the same interval as the ticket list,
    // so a new customer reply or status change shows up without re-opening it.
    useEffect(() => {
        if (!autoRefreshMs) return undefined;
        const id = setInterval(() => { load(); }, autoRefreshMs);
        return () => clearInterval(id);
    }, [autoRefreshMs, load]);

    const toggleActivity = () => setShowActivity(v => !v);

    const loadContext = useCallback(async () => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/threads/${threadId}/context`);
        if (res.ok) setContext(await res.json());
    }, [threadId]);
    const toggleContext = () => setShowContext(v => { const nv = !v; if (nv && !context) loadContext(); return nv; });

    // Reference data for the ticket controls (fetched once).
    useEffect(() => {
        authFetch(`${API_BASE}/api/support-inbox/teammates`).then(r => r.ok ? r.json() : { teammates: [] }).then(d => setTeammates(d.teammates || [])).catch(() => {});
        authFetch(`${API_BASE}/api/support-inbox/tags`).then(r => r.ok ? r.json() : { tags: [] }).then(d => setTagPalette(d.tags || [])).catch(() => {});
        authFetch(`${API_BASE}/api/support-inbox/canned`).then(r => r.ok ? r.json() : { canned: [] }).then(d => setCanned(d.canned || [])).catch(() => {});
    }, []);

    const draftWithAi = async () => {
        setDrafting(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/threads/${threadId}/draft`, { method: 'POST' });
            const d = await res.json().catch(() => ({}));
            if (res.ok && d.message?.body) { setReply(d.message.body); setInternal(false); }
            else if (!res.ok) window.alert(d.error || t('support.composer.draft_failed', 'Could not generate draft'));
            await load();
        } finally { setDrafting(false); }
    };

    const send = async () => {
        if (!reply.trim()) return;
        setBusy(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/threads/${threadId}/reply`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: reply, internalNote: internal }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) { window.alert(d.error || t('support.composer.send_failed', 'Could not send')); }
            else { setReply(''); setInternal(false); await load(); onChanged?.(); }
        } finally { setBusy(false); }
    };

    const patch = async (body) => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/threads/${threadId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (res.ok) { await load(); onChanged?.(); }
    };

    if (!thread) return <div className="p-8 text-sm text-[var(--text-tertiary)]">{t('support.common.loading', 'Loading…')}</div>;

    const tags = Array.isArray(thread.tags) ? thread.tags : [];
    const isNotSupport = tags.includes(NOT_SUPPORT_TAG);
    const editableTags = tags.filter(tg => tg !== NOT_SUPPORT_TAG);
    const toggleTag = (name) => {
        const next = editableTags.includes(name) ? editableTags.filter(x => x !== name) : [...editableTags, name];
        // Preserve the reserved tag if present.
        patch({ tags: isNotSupport ? [...next, NOT_SUPPORT_TAG] : next });
    };

    return (
        <div className="flex flex-col h-full">
            <header className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{thread.subject || t('support.thread.no_subject', '(no subject)')}</div>
                    <div className="text-xs text-[var(--text-tertiary)] truncate">{thread.requester_email} · <span className={STATUS_COLORS[thread.status]}>{statusLabel(t, thread.status)}</span></div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <select value={thread.status} onChange={e => patch({ status: e.target.value })}
                        className="text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1">
                        {STATUS_IDS.map(s => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
                    </select>
                    {thread.status !== 'resolved' && (
                        <button onClick={() => patch({ status: 'resolved' })}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-green-500/40 text-green-600 dark:text-green-400 hover:bg-green-500/10">
                            <CheckCircle2 size={12} /> {t('support.ticket.resolve', 'Resolve')}
                        </button>
                    )}
                </div>
            </header>

            {/* Meta controls: priority · assignee · tags · non-support */}
            <div className="px-5 py-2 border-b border-[var(--border-default)] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <Flag size={12} className="text-[var(--text-tertiary)]" />
                    <select value={thread.priority || 'normal'} onChange={e => patch({ priority: e.target.value })}
                        className="text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-1.5 py-1">
                        {PRIORITY_IDS.map(p => <option key={p} value={p}>{t(`support.priority.${p}`, p)}</option>)}
                    </select>
                </label>

                <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <Users size={12} className="text-[var(--text-tertiary)]" />
                    <select value={thread.assignee_user_id || ''} onChange={e => patch({ assignee_user_id: e.target.value || null })}
                        className="text-xs rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-1.5 py-1 max-w-[160px]">
                        <option value="">{t('support.ticket.unassigned', 'Unassigned')}</option>
                        {user?.id && !teammates.some(tm => tm.id === user.id) && <option value={user.id}>{t('support.ticket.assign_me', 'Assign to me')}</option>}
                        {teammates.map(tm => <option key={tm.id} value={tm.id}>{tm.name || tm.email || tm.id}{tm.id === user?.id ? ` (${t('support.ticket.you', 'you')})` : ''}</option>)}
                    </select>
                </label>

                {tagPalette.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <TagIcon size={12} className="text-[var(--text-tertiary)]" />
                        {tagPalette.filter(tg => tg.name !== NOT_SUPPORT_TAG).map(tg => (
                            <button key={tg.id || tg.name} onClick={() => toggleTag(tg.name)}
                                className={`px-1.5 py-0.5 rounded border text-[11px] ${editableTags.includes(tg.name)
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                                {tg.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    {slaBreached(thread) && (
                        <span className="flex items-center gap-1 text-[11px] text-rose-500" title={t('support.ticket.sla_breached', 'SLA breached')}>
                            <AlertTriangle size={12} /> {t('support.ticket.sla_breached', 'SLA breached')}
                        </span>
                    )}
                    {thread.csat_score != null && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-500" title={thread.csat_comment || ''}>
                            <Star size={12} /> {thread.csat_score}/5
                        </span>
                    )}
                    <button onClick={toggleContext}
                        className={`flex items-center gap-1 px-2 py-1 rounded border text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] ${showContext ? 'border-[var(--accent-primary)]' : 'border-[var(--border-default)]'}`}>
                        <Users size={12} /> {t('support.ticket.customer', 'Customer')}
                    </button>
                    <button onClick={toggleActivity}
                        className={`flex items-center gap-1 px-2 py-1 rounded border text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] ${showActivity ? 'border-[var(--accent-primary)]' : 'border-[var(--border-default)]'}`}>
                        <Clock size={12} /> {t('support.ticket.activity', 'Activity')}
                    </button>
                    <button onClick={() => patch(isNotSupport ? { unfilter: true } : { markNotSupport: true })}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                        {isNotSupport ? <><RotateCcw size={12} /> {t('support.ticket.is_support', 'This is support')}</> : <><EyeOff size={12} /> {t('support.ticket.mark_not_support', 'Not support')}</>}
                    </button>
                </div>
            </div>

            {showContext && (
                <div className="px-5 py-2 border-b border-[var(--border-default)] text-[11px] text-[var(--text-secondary)] flex flex-col gap-1">
                    {!context ? <span className="italic text-[var(--text-tertiary)]">{t('support.common.loading', 'Loading…')}</span> : (
                        <>
                            {context.profile && (
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                    <span><span className="text-[var(--text-tertiary)]">{t('support.context.name', 'Name')}:</span> {context.profile.name || '—'}</span>
                                    <span><span className="text-[var(--text-tertiary)]">{t('support.context.org', 'Organization')}:</span> {context.profile.organizationName || '—'}</span>
                                    <span><span className="text-[var(--text-tertiary)]">{t('support.context.role', 'Role')}:</span> {context.profile.orgRole || '—'}</span>
                                    <span><span className="text-[var(--text-tertiary)]">{t('support.context.logged_in', 'Logged in')}:</span> {context.profile.loggedIn ? '✓' : '—'}</span>
                                </div>
                            )}
                            {context.subscription && context.subscription.status && (
                                <div><span className="text-[var(--text-tertiary)]">{t('support.context.plan', 'Plan')}:</span> {context.subscription.planName || context.subscription.planTier || '—'} · {context.subscription.status}</div>
                            )}
                            {Array.isArray(context.recentThreads) && context.recentThreads.length > 0 && (
                                <div>
                                    <span className="text-[var(--text-tertiary)]">{t('support.context.recent', 'Recent tickets')}:</span>{' '}
                                    {context.recentThreads.map((rt, i) => <span key={i}>{i > 0 ? ', ' : ''}{rt.subject || '(no subject)'} ({statusLabel(t, rt.status)})</span>)}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {showActivity && (
                <div className="px-5 py-2 border-b border-[var(--border-default)] max-h-56 overflow-y-auto">
                    <TicketTimeline threadId={threadId} teammates={teammates} />
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {messages.map(m => <MessageBubble key={m.id} m={m} t={t} />)}
            </div>

            <div className="border-t border-[var(--border-default)] p-3 flex flex-col gap-2">
                <textarea value={reply} onChange={e => setReply(e.target.value)} rows={4}
                    placeholder={internal ? t('support.composer.internal_placeholder', 'Internal note (not visible to the customer)…') : t('support.composer.reply_placeholder', 'Type your reply… or let the AI draft one.')}
                    className="text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 resize-y" />
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                        <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} /> {t('support.composer.internal_note', 'Internal note')}
                    </label>
                    <div className="flex items-center gap-2">
                        {canned.length > 0 && (
                            <div className="relative">
                                <button onClick={() => setShowCanned(v => !v)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)]">
                                    <MessageSquareText size={13} /> {t('support.composer.insert_canned', 'Canned reply')}
                                </button>
                                {showCanned && (
                                    <div className="absolute bottom-full mb-1 right-0 w-64 max-h-60 overflow-y-auto rounded border border-[var(--border-default)] bg-[var(--bg-card)] shadow-lg z-10">
                                        {canned.map(c => (
                                            <button key={c.id || c.shortcut || c.title} onClick={() => { setReply(r => (r ? `${r}\n\n` : '') + (c.body || '')); setShowCanned(false); }}
                                                className="block w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-secondary)] border-b border-[var(--border-default)] last:border-0">
                                                <div className="font-medium text-[var(--text-primary)] truncate">{c.title}{c.shortcut ? ` · ${c.shortcut}` : ''}</div>
                                                <div className="text-[var(--text-tertiary)] truncate">{c.body}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <button onClick={draftWithAi} disabled={drafting}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] disabled:opacity-60">
                            {drafting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {t('support.composer.ai_draft', 'AI draft')}
                        </button>
                        <button onClick={send} disabled={busy || !reply.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-60"
                            style={{ background: 'var(--accent-primary)' }}>
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {internal ? t('support.composer.save_note', 'Save note') : t('support.composer.send', 'Send')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MessageBubble({ m, t }) {
    const isReq = m.author_kind === 'requester';
    const isSystem = m.author_kind === 'system';
    const isInternal = m.internal_note;
    const isDraft = m.email_send_status && m.email_send_status.state === 'draft';
    const align = isReq ? 'items-start' : 'items-end';
    const bubble = isReq
        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
        : isInternal
            ? 'bg-amber-500/10 border border-amber-500/30 text-[var(--text-primary)]'
            : 'text-white';
    if (isSystem) {
        return <div className="text-center text-[11px] text-[var(--text-tertiary)] italic py-1">{m.body}</div>;
    }
    return (
        <div className={`flex flex-col ${align}`}>
            <div className="text-[10px] text-[var(--text-tertiary)] mb-0.5 px-1">
                {m.author_display || m.author_kind}
                {isInternal && ` · ${t('support.message.internal_note', 'internal note')}`}
                {isDraft && ` · ${t('support.message.draft_unsent', 'draft (not sent)')}`}
                {m.email_send_status && m.email_send_status.ok === false && ` · ${t('support.message.send_failed', '⚠ send failed')}`}
            </div>
            {m.body_html ? (
                <div className="w-full max-w-[680px] rounded-lg overflow-hidden border border-[var(--border-default)] bg-white">
                    <EmailHtmlBody html={m.body_html} />
                </div>
            ) : (
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${bubble}`}
                    style={!isReq && !isInternal ? { background: 'var(--accent-primary)' } : undefined}>
                    {m.body}
                </div>
            )}
            {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 px-1 max-w-[80%]">
                    {m.attachments.map((a, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)]" title={a.mimeType || ''}>
                            📎 {a.filename || t('support.message.attachment', 'attachment')}
                        </span>
                    ))}
                </div>
            )}
            {Array.isArray(m.kb_citations) && m.kb_citations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 px-1 max-w-[80%]">
                    {m.kb_citations.map((c, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)]" title={`score ${c.score ?? ''}`}>
                            📎 {c.title}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
