import React, { useMemo, useState } from 'react';
import { ScrollText, ChevronDown, ChevronRight } from 'lucide-react';
import { SectionHeader } from '../ui/SectionHeader';
import { SearchInput } from '../ui/SearchInput';
import { FilterPills } from '../ui/Tabs';
import { Card } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Dot } from '../ui/Badge';
import { useResource } from '../hooks/useApi';

const ACTION_TONE = {
    create_plan: 'success',
    update_plan: 'info',
    delete_plan: 'danger',
    assign_subscription: 'teal',
    update_subscription: 'info',
    remove_subscription: 'danger',
};

const ENTITY_TYPES = [
    { value: 'plan',         label: 'Plans' },
    { value: 'subscription', label: 'Subscriptions' },
];

function LogRow({ log }) {
    const [open, setOpen] = useState(false);
    const hasDetails = log.new_values && typeof log.new_values === 'object';
    const summary = hasDetails
        ? Object.entries(log.new_values).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')
        : '';

    return (
        <Card className="!p-3.5" hover>
            <button
                type="button"
                className="w-full flex items-start gap-3 text-left"
                onClick={() => hasDetails && setOpen(o => !o)}
            >
                <Dot tone={ACTION_TONE[log.action] || 'neutral'} className="mt-1.5" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                            {(log.action || '').replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                            {log.target_type}:{(log.target_id || '').slice(0, 12)}
                        </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                        by <strong className="text-[var(--text-secondary)] font-semibold">{log.changed_by || 'system'}</strong>{' • '}
                        {new Date(log.created_at).toLocaleString()}
                    </div>
                    {!open && summary && (
                        <div className="mt-1 text-[11px] text-[var(--text-muted)] truncate max-w-full">{summary}</div>
                    )}
                </div>
                {hasDetails && (
                    open ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-1" />
                         : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-1" />
                )}
            </button>

            {open && hasDetails && (
                <pre className="mt-3 p-2.5 rounded-lg bg-[var(--bg-tertiary)] text-[11px] text-[var(--text-secondary)] overflow-x-auto">
{JSON.stringify(log.new_values, null, 2)}
                </pre>
            )}
        </Card>
    );
}

export function AuditView() {
    const { data: logs = [], loading } = useResource('/api/subscriptions/audit?limit=100', { initial: [] });
    const [query, setQuery]       = useState('');
    const [entity, setEntity]     = useState(null);

    const visible = useMemo(() => {
        let list = Array.isArray(logs) ? logs : [];
        if (entity) list = list.filter(l => (l.target_type || '').toLowerCase() === entity);
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(l =>
                (l.action || '').toLowerCase().includes(q)
                || (l.target_id || '').toLowerCase().includes(q)
                || (l.changed_by || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [logs, entity, query]);

    return (
        <div className="px-6 py-6 max-w-3xl mx-auto">
            <SectionHeader
                title="Subscription Audit Log"
                description="Track all subscription plan and organization changes."
                action={<SearchInput value={query} onChange={setQuery} placeholder="Filter by action, target, user…" className="w-72" />}
            />

            <FilterPills
                value={entity}
                onChange={setEntity}
                options={ENTITY_TYPES}
                className="mb-5"
            />

            {loading ? (
                <Spinner label="Loading audit log…" />
            ) : visible.length === 0 ? (
                <EmptyState
                    icon={ScrollText}
                    title="No audit log entries"
                    description={query || entity ? 'No entries match the current filter.' : 'Changes to plans and subscriptions will appear here.'}
                />
            ) : (
                <div className="flex flex-col gap-2">
                    {visible.map(log => <LogRow key={log.id} log={log} />)}
                </div>
            )}
        </div>
    );
}
