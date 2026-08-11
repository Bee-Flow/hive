import React from 'react';
import { AlertTriangle, ArrowUpCircle, Check, Download, Globe, Inbox, Loader2, Mic, Package, RefreshCw, ShoppingCart, Shield, Target } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import UpdatePolicySelector from './UpdatePolicySelector';

// Hub catalogue card. Distinct from the installed-tab ModuleCard: it consumes a
// MarketplaceModule and renders the buy / entitled / installing / update /
// expired footer variants. Kept separate so the installed card (requirements +
// capabilities) stays untouched.

const NAMED_ICONS = { shield: Shield, globe: Globe, inbox: Inbox, target: Target, mic: Mic, package: Package };

// Shared with ModuleDetailDrawer (same icon + price rendering there).
export function ModuleIcon({ icon }) {
    if (icon && icon.length <= 4 && /\p{Extended_Pictographic}/u.test(icon)) {
        return <span className="text-2xl leading-none">{icon}</span>;
    }
    const Glyph = NAMED_ICONS[String(icon || '').toLowerCase()] || Package;
    return <Glyph className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />;
}

function formatPrice(amountCents, currency) {
    const amount = (amountCents || 0) / 100;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currency || 'EUR',
            maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
        }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency || ''}`.trim();
    }
}

// Server-derived typed pricing { type, amount, currency, interval } (v3.1);
// tolerates the legacy { model, amountCents } shape and null (→ free).
export function priceLabel(t, pricing) {
    const type = pricing?.type || pricing?.model;
    if (!pricing || type === 'free' || !type) return t('modules.price_free');
    const price = formatPrice(pricing.amount ?? pricing.amountCents, pricing.currency);
    if (type === 'subscription') {
        return pricing.interval === 'year'
            ? t('modules.price_per_year', { price })
            : t('modules.price_per_month', { price });
    }
    return t('modules.price_one_time', { price });
}

// Non-terminal install phase → label key. Variable lookup (not a literal t())
// so the i18n guard's literal-call check skips it; every value is in the dict.
const PHASE_KEY = {
    downloading: 'modules.installing_download',
    verifying: 'modules.installing_verify',
    migrating: 'modules.installing_migrate',
    activating: 'modules.installing_activate',
};

export default function MarketplaceModuleCard({
    module, health = null, awaiting, installProgress, busy,
    onBuy, onInstall, onUpdate, onPaidRefresh, onReactivate, onOpenDetails, onPolicyChange, policyBusy = false,
}) {
    const { t } = useTranslation();
    const expired = module.status === 'expired';
    const installing = installProgress && installProgress.phase !== 'done' && installProgress.phase !== 'error';
    // Runtime chips (M1/M3): quarantined / restart-pending / sideloaded come
    // off the health row; sideloaded modules have no hub Buy/Update actions.
    const quarantined = health?.ledgerStatus === 'quarantined';
    const sideloaded = health?.source === 'sideload';
    const pendingRestart = !!(module.pendingRestart || health?.pendingRestart);
    // Card click opens the drawer; every action button stops propagation.
    const act = (fn) => (e) => { e.stopPropagation(); fn(module); };

    return (
        <div
            className="rounded-xl border p-4 transition-all hover:shadow-lg relative flex flex-col cursor-pointer"
            style={{
                background: 'var(--bg-secondary)',
                borderColor: module.installed && !expired ? 'var(--accent-primary)' : 'var(--border-default)',
            }}
            onClick={() => onOpenDetails?.(module)}
            data-testid={`marketplace-card-${module.id}`}
        >
            {/* Status badge */}
            <div className="absolute top-3 right-3">
                {expired ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        <AlertTriangle className="w-3 h-3" /> {t('modules.badge_expired')}
                    </span>
                ) : module.installed ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">
                        <Check className="w-3 h-3" /> {t('modules.badge_imported')}
                    </span>
                ) : module.entitled ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">
                        <Check className="w-3 h-3" /> {t('modules.badge_purchased')}
                    </span>
                ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        {priceLabel(t, module.pricing)}
                    </span>
                )}
            </div>

            {/* Icon + name + category */}
            <div className="flex items-start gap-3 mb-2 pr-24">
                <ModuleIcon icon={module.icon} />
                <div className="min-w-0">
                    <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {module.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {module.category && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                {module.category}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                            <Globe className="w-3 h-3" /> {t('modules.badge_remote')}
                        </span>
                        {module.latestVersion && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v{module.latestVersion}</span>
                        )}
                        {sideloaded && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }} data-testid={`sideloaded-${module.id}`}>
                                {t('modules.badge_sideloaded')}
                            </span>
                        )}
                        {quarantined && (
                            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400" data-testid={`quarantined-${module.id}`}>
                                <AlertTriangle className="w-3 h-3" /> {t('modules.badge_quarantined')}
                            </span>
                        )}
                        {pendingRestart && !quarantined && (
                            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }} data-testid={`restart-required-${module.id}`}>
                                <AlertTriangle className="w-3 h-3" /> {t('modules.badge_restart_required')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Description */}
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                {module.description}
            </p>

            {/* Footer — one variant at a time */}
            <div className="mt-auto pt-1">
                {installing ? (
                    <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }} data-testid={`install-progress-${module.id}`}>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                        {t(PHASE_KEY[installProgress.phase] || 'modules.installing_download')}
                        {typeof installProgress.pct === 'number' && <span style={{ color: 'var(--text-muted)' }}>{Math.round(installProgress.pct)}%</span>}
                    </div>
                ) : quarantined ? (
                    <button
                        onClick={act(onReactivate)}
                        disabled={busy}
                        className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                        data-testid={`reactivate-${module.id}`}
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {t('modules.reactivate')}
                    </button>
                ) : expired && !sideloaded ? (
                    <button
                        onClick={act(onBuy)}
                        disabled={busy}
                        className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {t('modules.renew')}
                    </button>
                ) : module.installed || sideloaded ? (
                    module.updateAvailable && !sideloaded ? (
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#f59e0b' }}>
                                <ArrowUpCircle className="w-3.5 h-3.5" /> {t('modules.update_available')}
                            </span>
                            <div className="flex-1" />
                            <button
                                onClick={act(onUpdate)}
                                disabled={busy}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
                                {t('modules.update')}
                            </button>
                        </div>
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-green-500">
                            <span className="w-2 h-2 rounded-full bg-green-500" /> {t('modules.active')}
                        </span>
                    )
                ) : module.entitled ? (
                    <button
                        onClick={act(onInstall)}
                        disabled={busy}
                        className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {t('modules.install')}
                    </button>
                ) : awaiting ? (
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }} data-testid={`awaiting-${module.id}`}>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('modules.awaiting_payment')}
                        </span>
                        <div className="flex-1" />
                        <button
                            onClick={act(onPaidRefresh)}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5 border"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
                        >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            {t('modules.paid_refresh')}
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={act(onBuy)}
                        disabled={busy}
                        className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                        {t('modules.buy')}
                    </button>
                )}

                {/* Update policy (channel + pin) — installed hub modules only */}
                {module.installed && !sideloaded && !installing && onPolicyChange && (
                    <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <UpdatePolicySelector
                            policy={module.updatePolicy}
                            busy={policyBusy}
                            onChange={(policy) => onPolicyChange(module, policy)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
