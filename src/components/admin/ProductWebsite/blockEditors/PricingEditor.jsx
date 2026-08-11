import React from 'react';
import { TextField, Toggle } from '../fields';
import { InlineHint, CollapsibleCard, FieldSelect } from '../primitives';
import { set } from './shared';

// ── Pricing ───────────────────────────────────────────────────────────
//
// Dynamic pricing block. Plans come from the subscription database via
// `GET /api/billing/public-plans`. The admin picks an audience
// (`planType`: organization or consumer); the marketing block fetches
// and renders matching plans live. To show both audiences on one page,
// drop two pricing blocks — one per audience — onto the page.
//
// Editor exposes only: heading/subheading + audience + monthly/yearly
// toggle controls + CTA / empty-state copy. Plan content itself is
// managed at /app/admin/subscriptions and is NOT editable here.

const PRICING_PLAN_TYPES = [
    { value: 'organization', label: 'Organisations' },
    { value: 'consumer',     label: 'Consumers' },
];

const PRICING_INTERVAL_OPTIONS = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly',  label: 'Yearly' },
];

export function PricingEditor({ data = {}, onChange }) {
    const setField = (key, value) => onChange(set(data, key, value));

    const planType        = data.planType === 'consumer' ? 'consumer' : 'organization';
    const enableToggle    = data.enableToggle !== false;
    const defaultInterval = data.defaultInterval === 'yearly' ? 'yearly' : 'monthly';

    // Live preview of which plans the visitor will see, given the
    // currently-selected planType. Refetched on Refresh — admins can
    // change plans in /app/admin/subscriptions and confirm here without
    // reopening the editor.
    const [preview, setPreview] = React.useState({ loading: true, error: null, plans: [] });
    const reloadPreview = React.useCallback(() => {
        setPreview(p => ({ ...p, loading: true, error: null }));
        fetch('/api/billing/public-plans', { credentials: 'include' })
            .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
            .then(payload => {
                const plans = Array.isArray(payload?.plans) ? payload.plans : [];
                setPreview({ loading: false, error: null, plans });
            })
            .catch(err => setPreview({ loading: false, error: err.message || 'Failed', plans: [] }));
    }, []);
    React.useEffect(() => { reloadPreview(); }, [reloadPreview]);
    const matchingPlans = preview.plans.filter(p => p?.planType === planType);

    return (
        <>
            <InlineHint>
                Pricing cards are pulled live from your published subscription
                plans. Manage plans at <a href="/app/admin/subscriptions" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>/app/admin/subscriptions</a>.
                For both audiences on one page, add a second pricing block
                with the other audience.
            </InlineHint>

            <CollapsibleCard title="Heading" defaultOpen={true} persistKey="blk.pricing.heading">
                <TextField
                    label="Heading"
                    value={data.heading || ''}
                    onChange={v => setField('heading', v)}
                    placeholder="Pricing"
                />
                <TextField
                    label="Subheading"
                    value={data.subheading || ''}
                    onChange={v => setField('subheading', v)}
                    placeholder="Short line that sits under the heading."
                />
            </CollapsibleCard>

            <CollapsibleCard title="Audience" persistKey="blk.pricing.audience">
                <FieldSelect
                    label="Show plans for"
                    value={planType}
                    options={PRICING_PLAN_TYPES}
                    onChange={v => setField('planType', v)}
                />

                {/* Live preview list — tells the admin exactly which plans
                    will show up for this audience right now. */}
                <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            Plans the visitor will see
                        </div>
                        <button
                            type="button"
                            onClick={reloadPreview}
                            className="text-xs underline text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            Refresh
                        </button>
                    </div>
                    {preview.loading ? (
                        <div className="text-xs text-[var(--text-muted)]">Loading…</div>
                    ) : preview.error ? (
                        <div className="text-xs text-red-500">Failed: {preview.error}</div>
                    ) : matchingPlans.length === 0 ? (
                        <div className="text-xs text-[var(--text-muted)]">
                            No public plans for this audience. Create one at /app/admin/subscriptions.
                        </div>
                    ) : (
                        <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc pl-4">
                            {matchingPlans.map(p => (
                                <li key={p.id}>
                                    <strong>{p.name}</strong>
                                    {p.price != null ? ` — ${p.currency || 'EUR'} ${p.price} / ${p.billingInterval || '—'}` : ' — Custom pricing'}
                                    {p.trialDays > 0 ? ` · ${p.trialDays}d trial` : ''}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CollapsibleCard>

            <CollapsibleCard title="Billing interval toggle" persistKey="blk.pricing.interval">
                <Toggle
                    label="Show monthly/yearly toggle to visitors"
                    value={enableToggle}
                    onChange={v => setField('enableToggle', v)}
                />
                {enableToggle ? (
                    <>
                        <FieldSelect
                            label="Default side"
                            value={defaultInterval}
                            options={PRICING_INTERVAL_OPTIONS}
                            onChange={v => setField('defaultInterval', v)}
                        />
                        <TextField
                            label="Monthly label"
                            value={data.toggleLabelMonthly || ''}
                            onChange={v => setField('toggleLabelMonthly', v)}
                            placeholder="Maandelijks"
                        />
                        <TextField
                            label="Yearly label"
                            value={data.toggleLabelYearly || ''}
                            onChange={v => setField('toggleLabelYearly', v)}
                            placeholder="Jaarlijks"
                        />
                    </>
                ) : (
                    <FieldSelect
                        label="Show only this interval"
                        value={defaultInterval}
                        options={PRICING_INTERVAL_OPTIONS}
                        onChange={v => setField('defaultInterval', v)}
                    />
                )}
            </CollapsibleCard>

            <CollapsibleCard title="Featured tier" persistKey="blk.pricing.featured">
                <FieldSelect
                    label="Highlight plan"
                    value={data.featuredPlanId || ''}
                    options={[
                        { value: '', label: 'None (all buttons filled)' },
                        ...matchingPlans.map(p => ({ value: p.id, label: p.name })),
                    ]}
                    onChange={v => setField('featuredPlanId', v)}
                />
                {data.featuredPlanId ? (
                    <FieldSelect
                        label="Highlight style"
                        value={data.featuredStyle === 'flip' ? 'flip' : 'border'}
                        options={[
                            { value: 'border', label: 'Accent border + glow' },
                            { value: 'flip',   label: 'Dark card (polarity flip)' },
                        ]}
                        onChange={v => setField('featuredStyle', v)}
                    />
                ) : null}
            </CollapsibleCard>

            <CollapsibleCard title="Price copy" persistKey="blk.pricing.copy">
                <TextField
                    label="Monthly suffix"
                    value={data.suffixMonthly || ''}
                    onChange={v => setField('suffixMonthly', v)}
                    placeholder="/maand"
                />
                <TextField
                    label="Yearly suffix"
                    value={data.suffixYearly || ''}
                    onChange={v => setField('suffixYearly', v)}
                    placeholder="/jaar"
                />
                <TextField
                    label="Custom-price text"
                    value={data.customPriceText || ''}
                    onChange={v => setField('customPriceText', v)}
                    placeholder="Op aanvraag"
                    hint="Shown for plans without a fixed price."
                />
                <TextField
                    label="Trial text"
                    value={data.trialText || ''}
                    onChange={v => setField('trialText', v)}
                    placeholder="{days} dagen gratis proberen"
                    hint="{days} is replaced by the plan's trial length."
                />
            </CollapsibleCard>

            <CollapsibleCard title="Call to action" defaultOpen={false} persistKey="blk.pricing.cta">
                <TextField
                    label="Button label"
                    value={data.ctaLabel || ''}
                    onChange={v => setField('ctaLabel', v)}
                    placeholder="Kies plan"
                    hint="Buttons link to /app/billing?plan=<id>. The plan id is added automatically per card."
                />
                <TextField
                    label="Empty-state text"
                    value={data.emptyText || ''}
                    onChange={v => setField('emptyText', v)}
                    placeholder="Geen plannen beschikbaar"
                    hint="Shown when no public plans match the selected audience and interval."
                />
            </CollapsibleCard>
        </>
    );
}
