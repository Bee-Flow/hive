import React, { useState, useEffect } from 'react';
import { CreditCard, MessageSquare, Zap, DollarSign, Bot, Database, BarChart3, ArrowUpRight } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

/* ── Usage bar (matches OrgInfoPanel style) ─────────────────────────────── */
const UsageBar = ({ label, icon: Icon, used, limit, unit, color = '#8b5cf6' }) => {
    const isUnlimited = limit === null || limit === undefined || limit === -1;
    const pct = isUnlimited ? 0 : limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const isWarning = pct >= 80 && pct < 95;
    const isCritical = pct >= 95;
    const barColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : color;

    const fmt = (val) => {
        if (val === null || val === undefined || val === -1) return '∞';
        if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
        if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
        return val.toLocaleString();
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    {label}
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                    {fmt(used)}{unit ? ` ${unit}` : ''} / {fmt(limit)}{unit ? ` ${unit}` : ''}
                </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: isUnlimited ? '0%' : `${pct}%`,
                        background: isUnlimited ? 'transparent' : barColor,
                    }}
                />
            </div>
            {!isUnlimited && (
                <div className="flex justify-end">
                    <span className={`text-[10px] font-medium ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>
                        {pct}% used
                    </span>
                </div>
            )}
        </div>
    );
};

/* ── Skeleton ──────────────────────────────────────────────────────────── */
const Skeleton = () => (
    <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-[var(--bg-tertiary)] rounded" />
                    <div className="h-2 w-full bg-[var(--bg-tertiary)] rounded-full" />
                </div>
            ))}
        </div>
    </div>
);

/* ── Main Component ───────────────────────────────────────────────────── */
const ConsumerLicenseSection = ({ user }) => {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                setLoading(true);
                const res = await authFetch(`${API_BASE}/api/subscriptions/consumer/usage`);
                if (!res.ok) throw new Error('Failed to load usage data');
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error('[ConsumerLicense] fetch error:', e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchUsage();
    }, []);

    if (loading) return <Skeleton />;
    if (error) return (
        <div className="text-center py-12">
            <p className="text-sm text-[var(--text-muted)]">Failed to load account data.</p>
        </div>
    );

    const { limits, usage, billing_period } = data || {};
    const periodEnd = billing_period?.end ? new Date(billing_period.end) : null;
    const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd - new Date()) / (1000 * 60 * 60 * 24))) : null;

    return (
        <div className="space-y-6 animate-fadeIn">

            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {t('settings.license_usage') || 'License & Usage'}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                    Your personal account usage and limits
                </p>
            </div>

            {/* Plan Card */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                                <CreditCard className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-[var(--text-primary)]">
                                    {limits?.plan_name === '__consumer_default__' ? 'Personal Plan' : (limits?.plan_name || 'Free Plan')}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                    {daysLeft !== null ? `${daysLeft} days remaining in billing period` : 'Monthly billing'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                    <div className="p-4 text-center">
                        <div className="text-lg font-bold text-[var(--text-primary)]">{(usage?.total_calls || 0).toLocaleString()}</div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Messages</div>
                    </div>
                    <div className="p-4 text-center">
                        <div className="text-lg font-bold text-[var(--text-primary)]">
                            {(usage?.total_tokens || 0) >= 1_000_000 ? `${((usage?.total_tokens || 0) / 1_000_000).toFixed(1)}M` :
                             (usage?.total_tokens || 0) >= 1_000 ? `${((usage?.total_tokens || 0) / 1_000).toFixed(1)}K` :
                             (usage?.total_tokens || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Tokens</div>
                    </div>
                    <div className="p-4 text-center">
                        <div className="text-lg font-bold text-[var(--text-primary)]">€{Number(usage?.total_estimated_cost || 0).toFixed(2)}</div>
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Cost</div>
                    </div>
                </div>
            </div>

            {/* Usage Bars */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Usage This Period</h3>
                </div>

                <UsageBar
                    label="Messages"
                    icon={MessageSquare}
                    used={usage?.total_calls || 0}
                    limit={limits?.max_messages_per_month}
                    color="#3b82f6"
                />
                <UsageBar
                    label="Cost"
                    icon={DollarSign}
                    used={usage?.total_estimated_cost || 0}
                    limit={limits?.max_cost_per_month}
                    unit="€"
                    color="#10b981"
                />
                <UsageBar
                    label="Tokens"
                    icon={Zap}
                    used={usage?.total_tokens || 0}
                    limit={limits?.max_tokens_per_month}
                    color="#8b5cf6"
                />
            </div>

            {/* Plan Limits Grid */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Plan Limits</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'Agents', icon: Bot, val: limits?.max_agents, color: '#f59e0b' },
                        { label: 'Knowledge Sources', icon: Database, val: limits?.max_knowledge_sources, color: '#10b981' },
                        { label: 'Messages / Month', icon: MessageSquare, val: limits?.max_messages_per_month, color: '#3b82f6' },
                        { label: 'Cost / Month', icon: DollarSign, val: limits?.max_cost_per_month, color: '#8b5cf6', prefix: '€' },
                    ].map(item => {
                        const Icon = item.icon;
                        const isUnlimited = item.val === null || item.val === undefined || item.val === -1;
                        return (
                            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}10` }}>
                                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-[var(--text-primary)]">
                                        {isUnlimited ? '∞' : `${item.prefix || ''}${item.val.toLocaleString()}`}
                                    </div>
                                    <div className="text-[10px] text-[var(--text-muted)]">{item.label}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Upgrade CTA */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                        <ArrowUpRight className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Need more capacity?</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Create or join an organization to unlock higher limits, team collaboration, integrations, and more.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsumerLicenseSection;
