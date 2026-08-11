import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import PlanCard from './PlanCard';

/**
 * Responsive plan layout.
 *
 * The consumer settings grid it replaces used
 * `gridTemplateColumns: repeat(min(n,3), 1fr)` with no breakpoints, so three
 * plans stayed three columns down to phone width and the cards became unusable
 * slivers. Tailwind breakpoints plus `min-w-0` on the cards fix that; the grid
 * itself never scrolls the page sideways.
 */
export default function PlanGrid({
    plans = [],
    currentPlanId = null,
    selectedPlanId = null,
    busyPlanId = null,
    variant = 'settings',
    seats,
    onSelect,
    ctaLabelFor,
    emptyMessage,
}) {
    const { t } = useTranslation();

    if (!plans.length) {
        return (
            <div
                className="rounded-2xl border border-dashed p-8 text-center text-sm"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
                {emptyMessage || t('billing.no_plans', 'No plans are available right now.')}
            </div>
        );
    }

    const cols = plans.length === 1
        ? 'grid-cols-1'
        : plans.length === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';

    return (
        <div className={`grid gap-4 ${cols}`}>
            {plans.map(plan => (
                <PlanCard
                    key={plan.id}
                    plan={plan}
                    variant={variant}
                    seats={seats}
                    current={plan.id === currentPlanId}
                    selected={plan.id === selectedPlanId}
                    busy={plan.id === busyPlanId}
                    disabled={!!busyPlanId && plan.id !== busyPlanId}
                    ctaLabel={ctaLabelFor ? ctaLabelFor(plan) : undefined}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
}
