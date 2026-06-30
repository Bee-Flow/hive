import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import { metaFor, CATEGORY_IDS, CATEGORY_META } from './auditMeta';

/**
 * AuditTab — organisation-wide audit trail of every support interaction
 * (system · automation · AI · staff · requester) across the inboxes the viewer
 * can access, plus admin/config events. Filterable + cursor-paginated. No export.
 */
export default function AuditTab({ inboxes = [], onOpenThread }) {
    const { t } = useTranslation();
    const [events, setEvents] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ inbox: '', actor: '', from: '', to: '' });

    const inboxLabel = useCallback((id) => {
        if (!id) return t('support.audit.config_event', 'Configuration'); // config event — no inbox
        const i = inboxes.find(x => x.id === id);
        return i ? (i.email_address || i.display_name || i.provider) : t('support.audit.an_inbox', 'an inbox');
    }, [inboxes, t]);

    const fetchPage = useCallback(async (cursor) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.inbox) params.set('inbox', filters.inbox);
            if (filters.actor) params.set('actor', filters.actor);
            if (filters.from) params.set('from', new Date(filters.from).toISOString());
            if (filters.to) params.set('to', new Date(filters.to).toISOString());
            if (cursor) params.set('cursor', cursor);
            params.set('limit', '50');
            const res = await authFetch(`${API_BASE}/api/support-inbox/audit?${params.toString()}`);
            const d = await res.json().catch(() => ({ events: [] }));
            setEvents(prev => cursor ? [...prev, ...(d.events || [])] : (d.events || []));
            setNextCursor(d.nextCursor || null);
        } finally { setLoading(false); }
    }, [filters]);

    useEffect(() => { fetchPage(null); }, [fetchPage]);

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-4">
            <div className="flex flex-wrap items-end gap-2">
                <Field label={t('support.audit.inbox', 'Inbox')}>
                    <select value={filters.inbox} onChange={e => setFilters(f => ({ ...f, inbox: e.target.value }))} className={SELECT}>
                        <option value="">{t('support.audit.all_inboxes', 'All inboxes')}</option>
                        {inboxes.map(i => <option key={i.id} value={i.id}>{i.email_address || i.display_name || i.provider}</option>)}
                    </select>
                </Field>
                <Field label={t('support.audit.actor', 'Actor')}>
                    <select value={filters.actor} onChange={e => setFilters(f => ({ ...f, actor: e.target.value }))} className={SELECT}>
                        <option value="">{t('support.audit.all_actors', 'Everyone')}</option>
                        {CATEGORY_IDS.map(k => <option key={k} value={k}>{CATEGORY_META[k].label}</option>)}
                    </select>
                </Field>
                <Field label={t('support.audit.from', 'From')}>
                    <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className={SELECT} />
                </Field>
                <Field label={t('support.audit.to', 'To')}>
                    <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className={SELECT} />
                </Field>
                <button onClick={() => fetchPage(null)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]">
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> {t('support.common.refresh', 'Refresh')}
                </button>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                {events.length === 0 && !loading && (
                    <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">{t('support.audit.empty', 'No audit events match these filters.')}</div>
                )}
                {events.map(ev => {
                    const m = metaFor(ev);
                    const Icon = m.Icon;
                    return (
                        <div key={ev.id} className={`flex items-start gap-3 px-4 py-2.5 ${ev.thread_id && onOpenThread ? 'cursor-pointer hover:bg-[var(--bg-secondary)]' : ''}`}
                            onClick={() => { if (ev.thread_id && onOpenThread) onOpenThread(ev.thread_id); }}>
                            <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full border ${m.chip}`}><Icon size={13} style={{ color: m.color }} /></span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-[var(--text-primary)]">{m.label}</span>
                                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${m.chip}`}>{m.label && CATEGORY_META[m.category].label}</span>
                                    {m.summary && <span className="text-xs text-[var(--text-tertiary)] truncate">· {m.summary}</span>}
                                </div>
                                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                                    {new Date(ev.created_at).toLocaleString()} · {inboxLabel(ev.inbox_id)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {nextCursor && (
                <div className="flex justify-center">
                    <button onClick={() => fetchPage(nextCursor)} disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">
                        {loading ? t('support.common.loading', 'Loading…') : t('support.nav.load_more', 'Load more')}
                    </button>
                </div>
            )}
        </div>
    );
}

const SELECT = 'text-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5';

function Field({ label, children }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
            {children}
        </label>
    );
}
