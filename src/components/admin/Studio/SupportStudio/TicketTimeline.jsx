import React, { useEffect, useState, useCallback } from 'react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import { metaFor } from './auditMeta';

/**
 * TicketTimeline — the per-ticket audit trail. Reads the unified audit feed
 * (/threads/:id/events) which now distinguishes system / automation / AI / staff
 * / requester precisely, and renders each as an icon + coloured category chip +
 * human label + payload summary. Newest-first.
 */
export default function TicketTimeline({ threadId, teammates = [] }) {
    const { t } = useTranslation();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const nameFor = useCallback((id) => {
        if (!id) return '';
        const tm = teammates.find(x => x.id === id);
        return tm ? (tm.name || tm.email || id) : id;
    }, [teammates]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/threads/${threadId}/events`);
            if (res.ok) { const d = await res.json(); setEvents(Array.isArray(d.events) ? d.events : []); }
        } finally { setLoading(false); }
    }, [threadId]);
    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="text-[11px] text-[var(--text-tertiary)] italic px-1 py-1">{t('support.common.loading', 'Loading…')}</div>;
    if (events.length === 0) return <div className="text-[11px] text-[var(--text-tertiary)] italic px-1 py-1">{t('support.activity.empty', 'No activity yet.')}</div>;

    return (
        <div className="flex flex-col gap-2 py-1">
            {events.map(ev => {
                const m = metaFor(ev);
                const Icon = m.Icon;
                const who = ev.actor_user_id ? nameFor(ev.actor_user_id) : m.label;
                return (
                    <div key={ev.id} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full border shrink-0 ${m.chip}`}>
                            <Icon size={11} style={{ color: m.color }} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap text-[12px]">
                                <span className="text-[var(--text-primary)]">{m.label}</span>
                                {m.summary && <span className="text-[var(--text-tertiary)] truncate">· {m.summary}</span>}
                            </div>
                            <div className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                                {new Date(ev.created_at).toLocaleString()}{ev.actor_user_id ? ` · ${who}` : ''}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
