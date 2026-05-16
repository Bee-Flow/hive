import React, { useMemo, useState } from 'react';
import { Building2, Plus, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { SectionHeader } from '../ui/SectionHeader';
import { SearchInput } from '../ui/SearchInput';
import { FilterPills } from '../ui/Tabs';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { ConfirmModal } from '../ui/Modal';
import { useResource, apiJson } from '../hooks/useApi';
import { useToast } from '../ui/Toast';
import { OrgEditor } from './OrgEditor';
import { QuickAssignDialog } from './QuickAssignDialog';

const STATUS_TONE = { active: 'success', trialing: 'info', suspended: 'warning', cancelled: 'danger' };

function StatusBadge({ status }) {
    return <Badge tone={STATUS_TONE[status] || 'neutral'} size="sm">{status}</Badge>;
}

export function OrgsView() {
    const { t } = useTranslation();
    const toast = useToast();

    const orgsRes  = useResource('/auth/organizations', { initial: [], transform: data => {
        const list = Array.isArray(data) ? data : (data.organizations || data.orgs || []);
        return list
            .map(o => ({ id: o.id, name: o.name || o.id, trial_used_at: o.trial_used_at || null, total_calls: o.total_calls, estimated_cost: o.estimated_cost }))
            .filter(o => o.id && o.id !== '__unassigned');
    }});
    const subsRes  = useResource('/api/subscriptions/orgs',  { initial: [] });
    const plansRes = useResource('/api/subscriptions/plans', { initial: [] });

    const [editing, setEditing]   = useState(null); // sub object
    const [assigning, setAssigning] = useState(null); // org object
    const [removing, setRemoving] = useState(null); // sub object
    const [busy, setBusy]         = useState(false);
    const [query, setQuery]       = useState('');
    const [statusFilter, setStatusFilter] = useState(null);

    const reloadAll = () => { orgsRes.reload(); subsRes.reload(); };

    const subs  = Array.isArray(subsRes.data)  ? subsRes.data  : [];
    const orgs  = Array.isArray(orgsRes.data)  ? orgsRes.data  : [];
    const plans = Array.isArray(plansRes.data) ? plansRes.data : [];

    const filteredSubs = useMemo(() => {
        let list = subs;
        if (statusFilter) list = list.filter(s => s.status === statusFilter);
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(s => (s.org_name || '').toLowerCase().includes(q));
        }
        return list;
    }, [subs, statusFilter, query]);

    const unsubscribedOrgs = useMemo(
        () => orgs.filter(o => !subs.find(s => s.organization_id === o.id)),
        [orgs, subs]
    );

    const handleSave = async (orgId, form) => {
        try {
            await apiJson(`/api/subscriptions/orgs/${orgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            toast.success('Subscription saved.');
            setEditing(null);
            setAssigning(null);
            reloadAll();
        } catch (e) {
            toast.error(e.message || 'Save failed');
        }
    };

    const handleStartTrial = async (orgId, planId) => {
        try {
            const res = await apiJson(`/api/subscriptions/orgs/${orgId}/start-trial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: planId }),
            });
            setEditing(null);
            setAssigning(null);
            reloadAll();
            return res;
        } catch (e) {
            if (e.body?.error === 'trial_already_used') {
                throw new Error('This organization has already used its trial.');
            }
            throw e;
        }
    };

    const handleRemove = async () => {
        if (!removing) return;
        setBusy(true);
        try {
            await apiJson(`/api/subscriptions/orgs/${removing.organization_id}`, { method: 'DELETE' });
            toast.success('Subscription removed.');
            setRemoving(null);
            setEditing(null);
            reloadAll();
        } catch (e) {
            toast.error(e.message || 'Remove failed');
        } finally {
            setBusy(false);
        }
    };

    if (editing) {
        return (
            <OrgEditor
                orgSub={editing}
                plans={plans}
                onBack={() => setEditing(null)}
                onSave={(form) => handleSave(editing.organization_id, form)}
                onRemove={() => setRemoving(editing)}
                onStartTrial={(planId) => handleStartTrial(editing.organization_id, planId)}
            />
        );
    }

    const loading = orgsRes.loading || subsRes.loading || plansRes.loading;

    return (
        <div className="px-6 py-6 max-w-[1280px] mx-auto">
            <SectionHeader
                title={t('admin.sub_org_title', 'Organization Subscriptions')}
                description={t('admin.sub_org_desc', 'Assign plans and manage limits for each organization.')}
            />

            {loading ? (
                <Spinner label="Loading organizations…" />
            ) : (
                <>
                    {/* Active subscriptions */}
                    <div className="mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
                                Active subscriptions
                                <span className="ml-2 text-[var(--text-muted)] font-normal">{filteredSubs.length}{filteredSubs.length !== subs.length ? ` / ${subs.length}` : ''}</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                <SearchInput value={query} onChange={setQuery} placeholder="Search organizations…" className="w-56" />
                            </div>
                        </div>
                        <FilterPills
                            value={statusFilter}
                            onChange={setStatusFilter}
                            className="mb-3"
                            options={[
                                { value: 'active', label: 'Active' },
                                { value: 'trialing', label: 'Trialing' },
                                { value: 'suspended', label: 'Suspended' },
                                { value: 'cancelled', label: 'Cancelled' },
                            ]}
                        />

                        {filteredSubs.length === 0 ? (
                            <EmptyState
                                icon={Building2}
                                title={subs.length === 0 ? 'No active subscriptions' : 'No matches'}
                                description={subs.length === 0
                                    ? 'Assign a plan to an organization to see it here.'
                                    : 'Adjust the search or status filter.'}
                            />
                        ) : (
                            <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
                                <table className="w-full text-[13px]">
                                    <thead className="bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                        <tr>
                                            <th className="text-left font-semibold px-4 py-2.5">Organization</th>
                                            <th className="text-left font-semibold px-4 py-2.5">Plan</th>
                                            <th className="text-left font-semibold px-4 py-2.5">Status</th>
                                            <th className="text-left font-semibold px-4 py-2.5">Messages</th>
                                            <th className="text-left font-semibold px-4 py-2.5">Cost</th>
                                            <th className="px-4 py-2.5"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSubs.map(sub => {
                                            const msgLimit  = sub.effective_limits?.max_messages_per_month;
                                            const costLimit = sub.effective_limits?.max_cost_per_month;
                                            const msgPct  = msgLimit  ? Math.round((sub.current_usage?.messages || 0) / msgLimit * 100) : null;
                                            const costPct = costLimit ? Math.round((sub.current_usage?.cost || 0) / costLimit * 100) : null;
                                            return (
                                                <tr
                                                    key={sub.organization_id}
                                                    onClick={() => setEditing(sub)}
                                                    className="cursor-pointer bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border-t border-[var(--border-default)]"
                                                >
                                                    <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">{sub.org_name}</td>
                                                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{sub.plan_name || 'Custom'}</td>
                                                    <td className="px-4 py-2.5"><StatusBadge status={sub.status} /></td>
                                                    <td className="px-4 py-2.5 text-[var(--text-secondary)] tabular-nums">
                                                        {(sub.current_usage?.messages || 0).toLocaleString()}{msgLimit ? ` / ${msgLimit.toLocaleString()}` : ''}
                                                        {msgPct != null && msgPct >= 80 && (
                                                            <AlertTriangle className={`inline w-3.5 h-3.5 ml-1 align-middle ${msgPct >= 90 ? 'text-rose-400' : 'text-amber-400'}`} />
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-[var(--text-secondary)] tabular-nums">
                                                        €{(sub.current_usage?.cost || 0).toFixed(4)}{costLimit ? ` / €${costLimit.toFixed(2)}` : ''}
                                                        {costPct != null && costPct >= 80 && (
                                                            <AlertTriangle className={`inline w-3.5 h-3.5 ml-1 align-middle ${costPct >= 90 ? 'text-rose-400' : 'text-amber-400'}`} />
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-[var(--text-muted)]">
                                                        →
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Unsubscribed orgs */}
                    {unsubscribedOrgs.length > 0 && (
                        <div>
                            <h3 className="text-[14px] font-bold text-[var(--text-secondary)] mb-3">
                                Unsubscribed organizations
                                <span className="ml-2 text-[var(--text-muted)] font-normal">{unsubscribedOrgs.length}</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {unsubscribedOrgs.map(org => (
                                    <div key={org.id} className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
                                        <div className="min-w-0">
                                            <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{org.name}</div>
                                            <div className="text-[11px] text-[var(--text-muted)]">
                                                {(org.total_calls || 0).toLocaleString()} calls · €{(org.estimated_cost || 0).toFixed(4)}
                                            </div>
                                        </div>
                                        <Button size="sm" icon={Plus} onClick={() => setAssigning(org)}>Assign</Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {orgs.length === 0 && subs.length === 0 && (
                        <EmptyState
                            icon={Building2}
                            title="No organizations yet"
                            description="Create organizations in Security → Users first, then come back here to assign subscriptions."
                        />
                    )}
                </>
            )}

            {assigning && (
                <QuickAssignDialog
                    org={assigning}
                    plans={plans}
                    onClose={() => setAssigning(null)}
                    onSave={(form) => handleSave(assigning.id, form)}
                    onStartTrial={(planId) => handleStartTrial(assigning.id, planId)}
                />
            )}

            <ConfirmModal
                open={!!removing}
                onClose={() => setRemoving(null)}
                onConfirm={handleRemove}
                busy={busy}
                title={`Remove ${removing?.org_name || ''}'s subscription?`}
                message="The organization will lose all plan-assigned limits and features. This does not delete the org itself."
                confirmLabel="Remove subscription"
            />
        </div>
    );
}
