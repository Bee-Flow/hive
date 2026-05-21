import React from 'react';
import { Building2, Users, Star, Pencil, Trash2, CreditCard, TrendingUp, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { StatRow, StatGrid } from '../ui/StatRow';
import { CURRENCY_SYMBOL } from '../constants';

export function PlanCard({ plan, onEdit, onDelete, onSyncStripe, syncing }) {
    const isConsumer = plan.plan_type === 'consumer';
    const sym = CURRENCY_SYMBOL[plan.currency] || '€';
    const metered = plan.billing_model === 'metered';
    const perSeat = !!plan.per_seat && !metered && !isConsumer;
    const isPaid = metered || (plan.price != null && plan.price > 0);

    return (
        <Card className="flex flex-col" hover>
            {/* Header: badges */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Badge tone={isConsumer ? 'success' : 'sky'} icon={isConsumer ? Users : Building2} size="sm">
                            {isConsumer ? 'Consumer' : 'Org'}
                        </Badge>
                        {perSeat && (
                            <Badge tone="teal" icon={Users} size="sm">Per seat</Badge>
                        )}
                        {plan.is_default && (
                            <Badge tone="warning" icon={Star} size="sm">Default</Badge>
                        )}
                        {plan.is_public && (
                            <Badge tone="info" size="sm">Public</Badge>
                        )}
                    </div>
                    <h3 className="text-[15px] font-bold text-[var(--text-primary)] leading-tight truncate">{plan.name}</h3>
                    {plan.tagline && <div className="mt-0.5 text-[11.5px] text-[var(--text-muted)] line-clamp-1">{plan.tagline}</div>}
                </div>
            </div>

            {/* Price line */}
            <div className="mb-4">
                {metered ? (
                    <div className="flex items-baseline gap-2">
                        <TrendingUp className="w-5 h-5 self-center text-emerald-400" />
                        <span className="text-[22px] font-extrabold text-emerald-400 leading-none">
                            PAYG · +{Number(plan.markup_percent ?? 0).toFixed(plan.markup_percent % 1 === 0 ? 0 : 1)}%
                        </span>
                        <span className="text-[11.5px] text-[var(--text-muted)]">metered / {plan.billing_interval || 'month'}</span>
                    </div>
                ) : plan.price != null ? (
                    <div className="flex items-baseline gap-2">
                        <span className="text-[26px] font-extrabold text-[var(--text-primary)] leading-none">{sym}{plan.price.toFixed(2)}</span>
                        <span className="text-[12px] text-[var(--text-muted)]">/ {perSeat ? 'seat / month' : (plan.billing_interval || 'month')}</span>
                        {plan.trial_days > 0 && (
                            <Badge tone="success" size="sm" className="ml-auto">{plan.trial_days}d trial</Badge>
                        )}
                    </div>
                ) : (
                    <div className="text-[14px] font-semibold text-[var(--text-muted)]">Free / Internal</div>
                )}
            </div>

            {/* Description */}
            {plan.description && (
                <p className="mb-3 text-[12px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{plan.description}</p>
            )}

            {/* Key limits — cost cap + capacity */}
            <StatGrid className="mb-4">
                <StatRow label="Cost cap" value={plan.max_cost_per_month} unit="€" />
                <StatRow label="Users"    value={plan.max_users} />
                <StatRow label="Agents"   value={plan.max_agents} />
                <StatRow label="KB"       value={plan.max_knowledge_sources} />
            </StatGrid>

            {/* Stripe sync status — only relevant for paid plans */}
            {isPaid && (
                <div className="mb-3">
                    {plan.stripe_price_id ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                            <CreditCard className="w-3.5 h-3.5" />
                            Stripe synced
                        </span>
                    ) : (
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={syncing ? Loader2 : CreditCard}
                            onClick={onSyncStripe}
                            busy={syncing}
                            className={syncing ? '[&>svg]:animate-spin' : ''}
                        >
                            {syncing ? 'Syncing…' : 'Sync to Stripe'}
                        </Button>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="mt-auto flex items-center gap-2 pt-3 border-t border-[var(--border-default)]">
                <Button variant="secondary" icon={Pencil} onClick={onEdit} className="flex-1">
                    Edit
                </Button>
                <IconButton icon={Trash2} variant="danger" title="Delete plan" onClick={onDelete} />
            </div>
        </Card>
    );
}
