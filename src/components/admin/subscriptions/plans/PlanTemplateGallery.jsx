import React, { useMemo, useState } from 'react';
import { Building2, Users, Check, TrendingUp, Star, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Tabs } from '../ui/Tabs';
import { Badge } from '../ui/Badge';
import { Banner } from '../ui/Banner';
import { PLAN_TEMPLATES } from './planTemplates';

const AUDIENCE_FILTERS = [
    { value: 'all',          label: 'All' },
    { value: 'organization', label: 'Org',      icon: Building2 },
    { value: 'consumer',     label: 'Consumer', icon: Users },
];

export function PlanTemplateGallery({ open, onClose, onPick }) {
    const [filter, setFilter] = useState('all');

    const counts = useMemo(() => ({
        all:           PLAN_TEMPLATES.length,
        organization:  PLAN_TEMPLATES.filter(t => t.audience === 'organization').length,
        consumer:      PLAN_TEMPLATES.filter(t => t.audience === 'consumer').length,
    }), []);

    const visible = useMemo(() => (
        filter === 'all'
            ? PLAN_TEMPLATES
            : PLAN_TEMPLATES.filter(t => t.audience === filter)
    ), [filter]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Start from a template"
            subtitle="Pick a curated plan to pre-fill the editor. You can edit anything before saving."
            width="max-w-5xl"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <Tabs
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: 'all',          label: 'All',      count: counts.all },
                        { value: 'organization', label: 'Org',      icon: Building2, count: counts.organization },
                        { value: 'consumer',     label: 'Consumer', icon: Users,     count: counts.consumer },
                    ]}
                />
                <span className="text-[11px] text-[var(--text-muted)]">
                    Saving syncs to Stripe automatically for paid plans.
                </span>
            </div>

            <Banner tone="info" icon={Info} className="mb-4">
                Subscriptions are for <strong>Bee Flow Cloud</strong> customers. Self-hosted installs use <strong>Community / Pro / Enterprise license keys</strong> instead (managed in Settings → License &amp; Usage on the customer's server). Org tiers (Team / Business / Enterprise) bill <strong>per active seat</strong>; the org-wide message cap scales with seat count. White-label branding is a self-hosted Full-tier license-key feature and is never included on cloud plans.
            </Banner>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {visible.map(t => (
                    <TemplateCard key={t.id} template={t} onPick={() => onPick(t)} />
                ))}
            </div>
        </Modal>
    );
}

function TemplateCard({ template, onPick }) {
    const { plan, display, audience } = template;
    const isConsumer = audience === 'consumer';
    const isMetered = plan.billing_model === 'metered';

    return (
        <button
            type="button"
            onClick={onPick}
            className="text-left rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)]/40 hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]/70 transition-colors p-4 flex flex-col"
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-1.5">
                    <Badge tone={isConsumer ? 'success' : 'sky'} icon={isConsumer ? Users : Building2} size="sm">
                        {isConsumer ? 'Consumer' : 'Org'}
                    </Badge>
                    {plan.per_seat && <Badge tone="teal" icon={Users} size="sm">Per seat</Badge>}
                    {display.badge === 'FREE' && <Badge tone="teal" size="sm">Free</Badge>}
                    {display.badge === 'PAYG' && <Badge tone="warning" icon={TrendingUp} size="sm">PAYG</Badge>}
                    {plan.is_default && <Badge tone="warning" icon={Star} size="sm">Default</Badge>}
                    {plan.nc_recommended && <Badge tone="info" size="sm">Recommended</Badge>}
                </div>
            </div>

            <h4 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">{display.title}</h4>
            <p className="mt-1 text-[11.5px] text-[var(--text-muted)] line-clamp-2 leading-relaxed">{display.subtitle}</p>

            <div className="mt-3 mb-3">
                <span className={`text-[18px] font-extrabold ${isMetered ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                    {display.priceLabel}
                </span>
            </div>

            <ul className="space-y-1 mb-4">
                {display.highlights?.map(h => (
                    <li key={h} className="flex items-start gap-1.5 text-[11.5px] text-[var(--text-secondary)]">
                        <Check className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
                        <span>{h}</span>
                    </li>
                ))}
            </ul>

            <span className="mt-auto inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                Use this template
            </span>
        </button>
    );
}
