import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Settings, Inbox, LifeBuoy, Sparkles, Send, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import StudioShell from '../../../shared/StudioShell';
import SettingsPanel from './SettingsPanel';
import useSupportInboxEvents from './useSupportInboxEvents';

const STATUS_IDS = ['open', 'ai_responding', 'awaiting_user', 'awaiting_agent', 'resolved', 'closed'];
const STATUS_COLORS = {
    open: 'text-blue-500',
    ai_responding: 'text-amber-500',
    awaiting_user: 'text-[var(--text-tertiary)]',
    awaiting_agent: 'text-amber-600',
    resolved: 'text-green-500',
    closed: 'text-[var(--text-tertiary)]',
};
const FILTER_IDS = ['awaiting_agent', 'awaiting_user', 'resolved', ''];

const statusLabel = (t, s) => (s === '' ? t('support.filter.all', 'All') : t(`support.status.${s}`, s));

function Dot({ status }) {
    return <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[status] || 'text-[var(--text-tertiary)]'}`} style={{ backgroundColor: 'currentColor' }} />;
}

/**
 * SupportStudio — tenant customer-support inbox inside the Studio.
 * Backend: /api/support-inbox/* (support_inbox license + beta + permission).
 */
export default function SupportStudio({ user }) {
    const { t } = useTranslation();
    const [inboxes, setInboxes] = useState([]);
    const [activeInbox, setActiveInbox] = useState('all');
    const [statusFilter, setStatusFilter] = useState('awaiting_agent');
    const [threads, setThreads] = useState([]);
    const [counts, setCounts] = useState({});
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [view, setView] = useState('inbox'); // 'inbox' | 'settings'

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
            if (statusFilter) params.set('status', statusFilter);
            const res = await authFetch(`${API_BASE}/api/support-inbox/threads?${params.toString()}`);
            if (res.ok) { const d = await res.json(); setThreads(d.threads || []); setCounts(d.counts || {}); }
        } catch (_) {}
    }, [activeInbox, statusFilter]);

    useEffect(() => { fetchInboxes(); }, [fetchInboxes]);
    useEffect(() => { fetchThreads(); }, [fetchThreads]);

    // Live updates: refresh the ticket list on any inbox event. The open ticket
    // refreshes via its own Refresh control / re-open.
    const onEvent = useCallback(() => { fetchThreads(); }, [fetchThreads]);
    useSupportInboxEvents(onEvent);

    const hasConnected = inboxes.some(i => i.connected);

    return (
        <StudioShell
            sidebarTitle={(
                <span className="flex items-center gap-2">
                    <LifeBuoy size={15} /> {t('studio.tab.support', 'Support')}
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">Beta</span>
                </span>
            )}
            sidebarActions={(
                <button onClick={() => setView(v => v === 'settings' ? 'inbox' : 'settings')}
                    className={`p-1 rounded hover:bg-[var(--bg-secondary)] ${view === 'settings' ? 'text-[var(--accent-primary)]' : ''}`}
                    title={t('support.nav.settings', 'Settings')}>
                    <Settings size={14} />
                </button>
            )}
            sidebar={(
                <div className="flex flex-col gap-2 p-3">
                    <select value={activeInbox} onChange={e => setActiveInbox(e.target.value)}
                        className="text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5">
                        <option value="all">{t('support.nav.all_inboxes', 'All inboxes')}</option>
                        {inboxes.map(i => <option key={i.id} value={i.id}>{i.email_address || i.display_name || i.provider}</option>)}
                    </select>

                    <div className="flex flex-wrap gap-1">
                        {FILTER_IDS.map(id => (
                            <button key={id || 'all'} onClick={() => setStatusFilter(id)}
                                className={`text-[11px] px-2 py-1 rounded border ${statusFilter === id
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                                {statusLabel(t, id)}{counts[id] ? ` (${counts[id]})` : ''}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between mt-1 px-1">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{t('support.nav.tickets', 'Tickets')}</h4>
                        <button onClick={fetchThreads} className="p-0.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]" title={t('support.common.refresh', 'Refresh')}><RefreshCw size={11} /></button>
                    </div>

                    {threads.length === 0 && (
                        <div className="text-xs text-[var(--text-tertiary)] italic px-1">
                            {hasConnected ? t('support.empty.no_tickets', 'No tickets in this view.') : t('support.empty.connect_first', 'Connect a mailbox via Settings first.')}
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
                                </div>
                                <div className="text-[var(--text-tertiary)] truncate mt-0.5">{th.requester_email}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        >
            {view === 'settings'
                ? <SettingsPanel inboxes={inboxes} onChanged={() => { fetchInboxes(); fetchThreads(); }} />
                : activeThreadId
                    ? <TicketDetail key={activeThreadId} threadId={activeThreadId} user={user} onChanged={fetchThreads} />
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

function TicketDetail({ threadId, user, onChanged }) {
    const { t } = useTranslation();
    const [thread, setThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [reply, setReply] = useState('');
    const [internal, setInternal] = useState(false);
    const [busy, setBusy] = useState(false);
    const [drafting, setDrafting] = useState(false);

    const load = useCallback(async () => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/threads/${threadId}`);
        if (res.ok) { const d = await res.json(); setThread(d.thread); setMessages(d.messages || []); }
    }, [threadId]);
    useEffect(() => { load(); }, [load]);

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
                    {user?.id && thread.assignee_user_id !== user.id && (
                        <button onClick={() => patch({ assignee_user_id: user.id })}
                            className="px-2.5 py-1 text-xs rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)]">
                            {t('support.ticket.assign_me', 'Assign to me')}
                        </button>
                    )}
                </div>
            </header>

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
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${bubble}`}
                style={!isReq && !isInternal ? { background: 'var(--accent-primary)' } : undefined}>
                {m.body}
            </div>
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
