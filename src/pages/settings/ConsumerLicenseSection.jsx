import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, MessageSquare, Zap, DollarSign, Bot, Database, BarChart3, ArrowUpRight, Check, Crown, Loader2, ExternalLink, Sparkles } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import { getCostVisibility } from '../../components/admin/subscriptions/ui/costVisibility';

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

/* ── Currency helper ──────────────────────────────────────────────────── */
const currencySymbol = (c) => ({ EUR: '€', USD: '$', GBP: '£' }[c?.toUpperCase()] || '€');

/* ── Main Component ───────────────────────────────────────────────────── */
const ConsumerLicenseSection = ({ user }) => {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [plans, setPlans] = useState([]);
    const [stripeEnabled, setStripeEnabled] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(null); // planId being loaded
    const [portalLoading, setPortalLoading] = useState(false);
    const [checkoutMessage, setCheckoutMessage] = useState(null); // success/cancel banner

    // Check URL params for checkout result
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('checkout') === 'success') {
            setCheckoutMessage({ type: 'success', text: 'Subscription activated! Your plan will be updated shortly.' });
            // Clean URL
            const url = new URL(window.location);
            url.searchParams.delete('checkout');
            url.searchParams.delete('session_id');
            window.history.replaceState({}, '', url.toString());
        } else if (params.get('checkout') === 'cancelled') {
            setCheckoutMessage({ type: 'cancelled', text: 'Checkout was cancelled. You can try again anytime.' });
            const url = new URL(window.location);
            url.searchParams.delete('checkout');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [usageRes, statusRes] = await Promise.all([
                authFetch(`${API_BASE}/api/subscriptions/consumer/usage`),
                authFetch(`${API_BASE}/api/stripe/status`),
            ]);
            if (usageRes.ok) setData(await usageRes.json());
            else throw new Error('Failed to load usage data');

            if (statusRes.ok) {
                const status = await statusRes.json();
                setStripeEnabled(status.enabled);
                if (status.enabled) {
                    const plansRes = await authFetch(`${API_BASE}/api/stripe/plans?type=consumer`);
                    if (plansRes.ok) setPlans(await plansRes.json());
                }
            }
        } catch (e) {
            console.error('[ConsumerLicense] fetch error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleCheckout = async (planId) => {
        setCheckoutLoading(planId);
        try {
            const res = await authFetch(`${API_BASE}/api/stripe/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, origin: window.location.origin }),
            });
            const result = await res.json();
            if (res.ok && result.url) {
                window.location.href = result.url;
            } else {
                alert(result.error || 'Failed to start checkout');
            }
        } catch (e) {
            alert('Connection error. Please try again.');
        } finally {
            setCheckoutLoading(null);
        }
    };

    const handlePortal = async () => {
        setPortalLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/stripe/portal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin: window.location.origin }),
            });
            const result = await res.json();
            if (res.ok && result.url) {
                window.location.href = result.url;
            } else {
                alert(result.error || 'Failed to open billing portal');
            }
        } catch (e) {
            alert('Connection error. Please try again.');
        } finally {
            setPortalLoading(false);
        }
    };

    if (loading) return <Skeleton />;
    if (error) return (
        <div className="text-center py-12">
            <p className="text-sm text-[var(--text-muted)]">Failed to load account data.</p>
        </div>
    );

    const { limits, usage, billing_period, subscription } = data || {};
    const periodEnd = billing_period?.end ? new Date(billing_period.end) : null;
    const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd - new Date()) / (1000 * 60 * 60 * 24))) : null;
    const hasActiveSub = subscription && ['active', 'trialing'].includes(subscription.status);
    const hasBilling = subscription?.stripe_customer_id;

    // Flat-rate consumers don't see internal € amounts — only % of quota.
    // PAYG consumers do, because that's literally their Stripe bill.
    const { showCost } = getCostVisibility(data?.billing_model);
    const msgPct = limits?.max_messages_per_month
        ? Math.min(100, Math.round(((usage?.total_calls || 0) / limits.max_messages_per_month) * 100))
        : 0;
    const tokPct = limits?.max_tokens_per_month
        ? Math.min(100, Math.round(((usage?.total_tokens || 0) / limits.max_tokens_per_month) * 100))
        : 0;
    const showUpgradeCta = !showCost && Math.max(msgPct, tokPct) >= 80 && stripeEnabled && plans.length > 0;
    const scrollToPlans = () => {
        const el = document.getElementById('consumer-plan-picker');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

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

            {/* Checkout result banner */}
            {checkoutMessage && (
                <div className={`rounded-xl p-4 flex items-center gap-3 ${
                    checkoutMessage.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : 'bg-amber-500/10 border border-amber-500/30'
                }`}>
                    {checkoutMessage.type === 'success' ? (
                        <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : (
                        <CreditCard className="w-5 h-5 text-amber-500 shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${
                        checkoutMessage.type === 'success' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                        {checkoutMessage.text}
                    </span>
                    <button
                        onClick={() => setCheckoutMessage(null)}
                        className="ml-auto text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >✕</button>
                </div>
            )}

            {/* Plan Card */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                                background: hasActiveSub ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                            }}>
                                {hasActiveSub ? <Crown className="w-5 h-5 text-white" /> : <CreditCard className="w-5 h-5 text-white" />}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-[var(--text-primary)]">
                                    {limits?.plan_name === '__consumer_default__' ? 'Free' : (limits?.plan_name || 'Free')}
                                    {subscription?.payment_status === 'trialing' && (
                                        <span className="ml-2 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">TRIAL</span>
                                    )}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                    {daysLeft !== null ? `${daysLeft} days remaining in billing period` : 'Monthly billing'}
                                </p>
                            </div>
                        </div>
                        {/* Manage Billing button */}
                        {hasBilling && (
                            <button
                                onClick={handlePortal}
                                disabled={portalLoading}
                                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                                style={{
                                    color: '#635bff',
                                    borderColor: 'rgba(99,91,255,0.3)',
                                    background: 'rgba(99,91,255,0.05)',
                                }}
                            >
                                {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                Manage Billing
                            </button>
                        )}
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
                        {showCost ? (
                            <>
                                <div className="text-lg font-bold text-[var(--text-primary)]">€{Number(usage?.total_estimated_cost || 0).toFixed(2)}</div>
                                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Cost</div>
                            </>
                        ) : (
                            <>
                                <div className="text-lg font-bold text-[var(--text-primary)]">{msgPct}%</div>
                                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">Plan used</div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Upgrade CTA — surfaces when a flat-plan consumer nears their quota */}
            {showUpgradeCta && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                            You've used {Math.max(msgPct, tokPct)}% of your plan this period.
                        </p>
                        <p className="text-[11.5px] text-[var(--text-muted)]">Upgrade for more messages and the higher model tiers.</p>
                    </div>
                    <button
                        onClick={scrollToPlans}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                        Upgrade plan
                    </button>
                </div>
            )}

            {/* Usage Bars */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-[var(--text-muted)]" />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Usage This Period</h3>
                </div>

                <UsageBar label="Messages" icon={MessageSquare} used={usage?.total_calls || 0} limit={limits?.max_messages_per_month} color="#3b82f6" />
                {showCost ? (
                    <UsageBar label="Cost" icon={DollarSign} used={usage?.total_estimated_cost || 0} limit={limits?.max_cost_per_month} unit="€" color="#10b981" />
                ) : (
                    <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed pl-1">
                        Your plan includes a flat-rate price — there are no per-message charges to track.
                    </p>
                )}
                <UsageBar label="Tokens" icon={Zap} used={usage?.total_tokens || 0} limit={limits?.max_tokens_per_month} color="#3b82f6" />
            </div>

            {/* Plan Limits Grid */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Plan Limits</h3>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'Agents', icon: Bot, val: limits?.max_agents, color: '#f59e0b' },
                        { label: 'Knowledge Sources', icon: Database, val: limits?.max_knowledge_sources, color: '#10b981' },
                        { label: 'Messages / Month', icon: MessageSquare, val: limits?.max_messages_per_month, color: '#3b82f6' },
                        showCost ? { label: 'Cost / Month', icon: DollarSign, val: limits?.max_cost_per_month, color: '#10b981', prefix: '€' } : null,
                    ].filter(Boolean).map(item => {
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

            {/* ── Subscription Plans / Upgrade ──────────────────────────── */}
            {stripeEnabled && plans.length > 0 && (
                <div id="consumer-plan-picker" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {hasActiveSub ? 'Change Plan' : 'Upgrade Your Plan'}
                        </h3>
                    </div>

                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, 1fr)` }}>
                        {plans.map(plan => {
                            const isCurrentPlan = hasActiveSub && subscription?.plan_id === plan.id;
                            const sym = currencySymbol(plan.currency);
                            return (
                                <div
                                    key={plan.id}
                                    className="relative rounded-xl border overflow-hidden transition-all duration-200"
                                    style={{
                                        borderColor: isCurrentPlan ? '#10b981' : 'var(--border-subtle)',
                                        background: isCurrentPlan ? 'rgba(16,185,129,0.03)' : 'var(--bg-secondary)',
                                    }}
                                >
                                    {isCurrentPlan && (
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                                    )}
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold text-[var(--text-primary)]">{plan.name}</h4>
                                            {isCurrentPlan && (
                                                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        {plan.description && (
                                            <p className="text-[11px] text-[var(--text-muted)] mb-3 leading-relaxed">{plan.description}</p>
                                        )}
                                        <div className="flex items-baseline gap-1 mb-3">
                                            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
                                                {sym}{Number(plan.price).toFixed(2)}
                                            </span>
                                            <span className="text-xs text-[var(--text-muted)]">
                                                / {plan.billing_interval === 'yearly' ? 'year' : 'month'}
                                            </span>
                                        </div>
                                        {plan.trial_days > 0 && (
                                            <div className="text-[11px] font-semibold text-emerald-500 mb-3">
                                                {plan.trial_days}-day free trial
                                            </div>
                                        )}

                                        {/* Feature highlights */}
                                        <div className="space-y-1.5 mb-4">
                                            {plan.max_messages_per_month && (
                                                <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    {plan.max_messages_per_month.toLocaleString()} messages/mo
                                                </div>
                                            )}
                                            {plan.max_cost_per_month && (
                                                <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    {sym}{plan.max_cost_per_month} cost budget
                                                </div>
                                            )}
                                            {plan.max_agents && (
                                                <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    {plan.max_agents} agents
                                                </div>
                                            )}
                                            {plan.max_knowledge_sources && (
                                                <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                                                    <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    {plan.max_knowledge_sources} knowledge sources
                                                </div>
                                            )}
                                        </div>

                                        {isCurrentPlan ? (
                                            <button
                                                disabled
                                                className="w-full py-2 rounded-lg text-xs font-semibold border"
                                                style={{
                                                    color: '#10b981',
                                                    borderColor: 'rgba(16,185,129,0.3)',
                                                    background: 'rgba(16,185,129,0.05)',
                                                    cursor: 'default',
                                                }}
                                            >
                                                <Check className="w-3.5 h-3.5 inline mr-1" /> Active Plan
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleCheckout(plan.id)}
                                                disabled={!!checkoutLoading}
                                                className="w-full py-2.5 rounded-lg text-xs font-bold text-white transition-all duration-200 flex items-center justify-center gap-1.5"
                                                style={{
                                                    background: checkoutLoading === plan.id ? '#6366f1' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                    opacity: checkoutLoading && checkoutLoading !== plan.id ? 0.5 : 1,
                                                    cursor: checkoutLoading ? 'wait' : 'pointer',
                                                }}
                                            >
                                                {checkoutLoading === plan.id ? (
                                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redirecting...</>
                                                ) : (
                                                    <><ArrowUpRight className="w-3.5 h-3.5" /> {hasActiveSub ? 'Switch Plan' : 'Subscribe'}</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Promo code hint */}
                    <p className="text-[11px] text-[var(--text-muted)] text-center mt-4">
                        Have a promo code? You can apply it during checkout.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ConsumerLicenseSection;
