import React, { useMemo, useState } from 'react';
import { Package, Plus, Building2, Users, LayoutTemplate } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { SectionHeader } from '../ui/SectionHeader';
import { Tabs } from '../ui/Tabs';
import { SearchInput } from '../ui/SearchInput';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { ConfirmModal } from '../ui/Modal';
import { useResource, apiJson } from '../hooks/useApi';
import { useToast } from '../ui/Toast';
import { PlanCard } from './PlanCard';
import { TrialOffersPanel } from './TrialOffersPanel';
import { PlanEditor } from './PlanEditor';
import { PlanTemplateGallery } from './PlanTemplateGallery';

export function PlansView() {
    const { t } = useTranslation();
    const toast = useToast();
    const { data: plans = [], loading, reload } = useResource('/api/subscriptions/plans', { initial: [] });

    const [editing, setEditing]       = useState(null); // null | 'new' | <plan>
    const [seedPlan, setSeedPlan]     = useState(null); // template payload when launched from gallery
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [confirmDel, setConfirmDel] = useState(null);
    const [saving, setSaving]         = useState(false);
    const [syncingId, setSyncingId]   = useState(null);
    const [filter, setFilter]         = useState('all');     // all | organization | consumer
    const [query, setQuery]           = useState('');
    const [sort, setSort]             = useState('sort_order');

    const visible = useMemo(() => {
        let list = Array.isArray(plans) ? [...plans] : [];
        if (filter !== 'all') list = list.filter(p => (p.plan_type || 'organization') === filter);
        if (query.trim()) {
            const q = query.toLowerCase();
            list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.tagline || '').toLowerCase().includes(q));
        }
        list.sort((a, b) => {
            if (sort === 'name')  return (a.name || '').localeCompare(b.name || '');
            if (sort === 'price') return (a.price ?? 0) - (b.price ?? 0);
            return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        });
        return list;
    }, [plans, filter, query, sort]);

    const counts = useMemo(() => ({
        all:           plans.length,
        organization:  plans.filter(p => (p.plan_type || 'organization') === 'organization').length,
        consumer:      plans.filter(p => p.plan_type === 'consumer').length,
    }), [plans]);

    const handleSave = async (form) => {
        setSaving(true);
        try {
            if (editing && editing !== 'new') {
                await apiJson(`/api/subscriptions/plans/${editing.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                });
                toast.success('Plan updated.');
            } else {
                await apiJson('/api/subscriptions/plans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                });
                toast.success('Plan created.');
            }
            setEditing(null);
            setSeedPlan(null);
            reload();
        } catch (e) {
            toast.error(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handlePickTemplate = (template) => {
        setGalleryOpen(false);
        setSeedPlan(template.plan);
        setEditing('new');
    };

    const handleDelete = async () => {
        if (!confirmDel) return;
        const id = confirmDel.id;
        setSaving(true);
        try {
            await apiJson(`/api/subscriptions/plans/${id}`, { method: 'DELETE' });
            toast.success('Plan deleted.');
            setConfirmDel(null);
            setEditing(null);
            setSeedPlan(null);
            reload();
        } catch (e) {
            toast.error(e.message || 'Delete failed');
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async (plan) => {
        setSyncingId(plan.id);
        try {
            await apiJson(`/api/subscriptions/plans/${plan.id}/sync-stripe`, { method: 'POST' });
            toast.success('Synced to Stripe.');
            reload();
        } catch (e) {
            toast.error(e.message || 'Stripe sync failed');
        } finally {
            setSyncingId(null);
        }
    };

    // ── Full-page editor swap ──
    if (editing) {
        const isTemplateLaunch = editing === 'new' && !!seedPlan;
        return (
            <PlanEditor
                plan={editing === 'new' ? seedPlan : editing}
                isNew={editing === 'new'}
                onBack={() => { setEditing(null); setSeedPlan(null); }}
                onSave={handleSave}
                onDelete={editing !== 'new' ? () => setConfirmDel(editing) : undefined}
                saving={saving}
                key={isTemplateLaunch ? `tpl-${seedPlan?.name}` : (editing === 'new' ? 'new' : editing.id)}
            />
        );
    }

    return (
        <div className="px-6 py-6 max-w-[1280px] mx-auto">
            <SectionHeader
                title={t('admin.sub_title', 'Subscription Plans')}
                description={t('admin.sub_desc', 'Create reusable plan templates with limits and feature access.')}
                action={
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" icon={LayoutTemplate} onClick={() => setGalleryOpen(true)}>
                            {t('admin.sub_from_template', 'From template')}
                        </Button>
                        <Button icon={Plus} onClick={() => { setSeedPlan(null); setEditing('new'); }}>
                            {t('admin.sub_new_plan', 'New plan')}
                        </Button>
                    </div>
                }
            />

            <TrialOffersPanel plans={plans} />

            {loading ? (
                <Spinner label="Loading plans…" />
            ) : plans.length === 0 ? (
                <EmptyState
                    icon={Package}
                    title="No plans yet"
                    description="Subscription plans bundle a price, a set of limits, and a list of features. Create one to start gating access for organizations and consumers."
                    action={
                        <div className="flex items-center gap-2 justify-center">
                            <Button variant="secondary" icon={LayoutTemplate} onClick={() => setGalleryOpen(true)}>From template</Button>
                            <Button icon={Plus} onClick={() => { setSeedPlan(null); setEditing('new'); }}>Create your first plan</Button>
                        </div>
                    }
                />
            ) : (
                <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                        <Tabs
                            value={filter}
                            onChange={setFilter}
                            options={[
                                { value: 'all',          label: 'All',          count: counts.all },
                                { value: 'organization', label: 'Org',          icon: Building2, count: counts.organization },
                                { value: 'consumer',     label: 'Consumer',     icon: Users,     count: counts.consumer },
                            ]}
                        />
                        <div className="flex items-center gap-2">
                            <SearchInput value={query} onChange={setQuery} placeholder="Search plans…" className="w-56" />
                            <select
                                value={sort}
                                onChange={e => setSort(e.target.value)}
                                className="px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[12px] text-[var(--text-secondary)] outline-none"
                            >
                                <option value="sort_order">Sort: order</option>
                                <option value="name">Sort: name</option>
                                <option value="price">Sort: price</option>
                            </select>
                        </div>
                    </div>

                    {visible.length === 0 ? (
                        <EmptyState title="No plans match" description="Adjust the filter or search query." icon={Package} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {visible.map(plan => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    onEdit={() => setEditing(plan)}
                                    onDelete={() => setConfirmDel(plan)}
                                    onSyncStripe={() => handleSync(plan)}
                                    syncing={syncingId === plan.id}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            <ConfirmModal
                open={!!confirmDel}
                onClose={() => setConfirmDel(null)}
                onConfirm={handleDelete}
                busy={saving}
                title={`Delete ${confirmDel?.name || 'plan'}?`}
                message="Organizations currently on this plan will lose their plan assignment and fall back to defaults. This cannot be undone."
                confirmLabel="Delete plan"
            />

            <PlanTemplateGallery
                open={galleryOpen}
                onClose={() => setGalleryOpen(false)}
                onPick={handlePickTemplate}
            />
        </div>
    );
}
