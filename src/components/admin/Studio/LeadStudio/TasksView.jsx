import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle2, Loader2, Clock, Building2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import { formatRelativeTime } from '../../../../utils/dateFormatters';

const startOfTomorrow = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); return d; };

/**
 * Org-wide follow-up tasks across all campaigns, grouped Overdue / Today /
 * Upcoming / No date. Complete inline; click a task to open its lead's CRM panel.
 */
export default function TasksView({ onOpenLead, version = 0, t }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/lead-studio/tasks?status=open&limit=500`);
            if (res.ok) { const d = await res.json(); setTasks(d.tasks || []); }
        } catch (_) { /* ignore */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load, version]);

    const complete = async (task) => {
        setTasks(prev => prev.filter(x => x.id !== task.id));
        await authFetch(`${API_BASE}/api/lead-studio/tasks/${task.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => load());
    };

    const groups = useMemo(() => {
        const now = new Date();
        const tom = startOfTomorrow();
        const g = { overdue: [], today: [], upcoming: [], undated: [] };
        for (const tk of tasks) {
            if (!tk.dueAt) g.undated.push(tk);
            else { const d = new Date(tk.dueAt); if (d < now) g.overdue.push(tk); else if (d < tom) g.today.push(tk); else g.upcoming.push(tk); }
        }
        return g;
    }, [tasks]);

    const SECTIONS = [
        { key: 'overdue', label: t('tasks.overdue', 'Te laat'), color: 'text-rose-500' },
        { key: 'today', label: t('tasks.today', 'Vandaag'), color: 'text-amber-500' },
        { key: 'upcoming', label: t('tasks.upcoming', 'Aankomend'), color: 'text-[var(--text-secondary)]' },
        { key: 'undated', label: t('tasks.undated', 'Zonder datum'), color: 'text-[var(--text-tertiary)]' },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-[var(--border-default)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('tasks.title', 'Taken')}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading && !tasks.length ? (
                    <div className="flex justify-center py-10 text-[var(--text-tertiary)]"><Loader2 size={18} className="animate-spin" /></div>
                ) : !tasks.length ? (
                    <div className="text-center text-xs text-[var(--text-tertiary)] py-10">{t('tasks.none_all', 'Geen open taken.')}</div>
                ) : SECTIONS.map(sec => groups[sec.key].length > 0 && (
                    <div key={sec.key}>
                        <h4 className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${sec.color}`}>{sec.label} <span className="text-[var(--text-tertiary)]">({groups[sec.key].length})</span></h4>
                        <ul className="space-y-1">
                            {groups[sec.key].map(tk => (
                                <li key={tk.id} className="flex items-center gap-2 text-xs rounded border border-[var(--border-subtle)] px-2 py-1.5 hover:bg-[var(--bg-secondary)]">
                                    <button onClick={() => complete(tk)} className="text-[var(--text-tertiary)] hover:text-emerald-500" title={t('tasks.complete', 'Afronden')}><CheckCircle2 size={15} /></button>
                                    <button onClick={() => onOpenLead?.(tk.leadId)} className="flex-1 text-left min-w-0">
                                        <span className="text-[var(--text-primary)]">{tk.title}</span>
                                        {tk.companyName && <span className="ml-2 text-[var(--text-tertiary)] inline-flex items-center gap-0.5"><Building2 size={10} /> {tk.companyName}</span>}
                                    </button>
                                    {tk.dueAt && <span className="text-[10px] text-[var(--text-tertiary)] inline-flex items-center gap-0.5 flex-shrink-0"><Clock size={10} /> {formatRelativeTime(tk.dueAt)}</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}
