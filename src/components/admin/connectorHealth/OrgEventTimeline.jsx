import { RefreshCw } from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';
import { sevMeta, labelFor, summarize, SEVERITY_IDS, SEVERITY_META } from './healthMeta';
import { useTranslation } from '../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../utils/helpers';

/**
 * OrgEventTimeline — keyset-paginated connector-health audit trail for one org.
 * Structure mirrors SupportStudio/AuditTab.jsx (severity filter + Load more).
 *
 * Privacy: rows render labelFor(code) + summarize(event) — only whitelisted
 * meta keys, never the raw meta payload. No export button.
 */
export default function OrgEventTimeline({ orgId }) {
    const { t } = useTranslation();
    const [events, setEvents] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [loading, setLoading] = useState(false);
    const [severity, setSeverity] = useState('');

    const fetchPage = useCallback(async (cursor) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('limit', '50');
            if (severity) params.set('severity', severity);
            if (cursor) params.set('cursor', cursor);
            const res = await authFetch(`${API_BASE}/auth/admin/connector-health/${orgId}/events?${params.toString()}`);
            const d = await res.json().catch(() => ({ events: [] }));
            setEvents(prev => cursor ? [...prev, ...(d.events || [])] : (d.events || []));
            setNextCursor(d.nextCursor || null);
        } catch {
            if (!cursor) setEvents([]);
            setNextCursor(null);
        } finally {
            setLoading(false);
        }
    }, [orgId, severity]);

    useEffect(() => { fetchPage(null); }, [fetchPage]);

    return (
        <div className="space-y-3">
            <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                        {t('admin.ch_severity', 'Severity')}
                    </span>
                    <select
                        value={severity}
                        onChange={e => setSeverity(e.target.value)}
                        className="text-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5"
                    >
                        <option value="">{t('admin.ch_sev_all', 'All severities')}</option>
                        {SEVERITY_IDS.map(s => (
                            <option key={s} value={s}>{t(SEVERITY_META[s].labelKey, SEVERITY_META[s].fallback)}</option>
                        ))}
                    </select>
                </label>
                <button
                    onClick={() => fetchPage(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    {t('admin.ch_refresh', 'Refresh')}
                </button>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                {events.length === 0 && !loading && (
                    <div className="p-6 text-center text-sm text-[var(--text-tertiary)]">
                        {t('admin.ch_no_events', 'No events recorded yet.')}
                    </div>
                )}
                {events.map(ev => {
                    const sm = sevMeta(ev.severity);
                    const Icon = sm.Icon;
                    const summary = summarize(ev);
                    return (
                        <div key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
                            <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full border shrink-0 ${sm.chip}`}>
                                <Icon size={13} style={{ color: sm.color }} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm text-[var(--text-primary)]">{labelFor(ev.code)}</span>
                                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${sm.chip}`}>
                                        {t(sm.labelKey, sm.fallback)}
                                    </span>
                                    {summary && <span className="text-xs text-[var(--text-tertiary)] truncate">· {summary}</span>}
                                </div>
                                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                                    {ev.actorKind ? ` · ${ev.actorKind}` : ''}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {nextCursor && (
                <div className="flex justify-center">
                    <button
                        onClick={() => fetchPage(nextCursor)}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50"
                    >
                        {loading ? t('admin.ch_loading_short', 'Loading…') : t('admin.ch_load_more', 'Load more')}
                    </button>
                </div>
            )}
        </div>
    );
}
