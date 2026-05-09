import React, { useState } from 'react';
import { Key, ShieldCheck, AlertCircle, Loader2, ExternalLink, RefreshCw, X } from 'lucide-react';
import useLicense from '../../hooks/useLicense';
import { useTranslation } from '../../hooks/useTranslation';

const TIER_BADGE = {
    community: { label: 'Community', bg: 'bg-slate-500/15', fg: 'text-slate-400', border: 'border-slate-500/30' },
    pro: { label: 'Pro', bg: 'bg-blue-500/15', fg: 'text-blue-500', border: 'border-blue-500/30' },
    enterprise: { label: 'Enterprise', bg: 'bg-emerald-500/15', fg: 'text-emerald-500', border: 'border-emerald-500/30' },
    full: { label: 'Full', bg: 'bg-amber-500/15', fg: 'text-amber-500', border: 'border-amber-500/30' },
};

const REFRESH_BADGE = {
    active: { label: 'OK', fg: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    pending: { label: 'pending', fg: 'text-blue-400', bg: 'bg-blue-500/10' },
    grace: { label: 'grace period', fg: 'text-amber-500', bg: 'bg-amber-500/10' },
    expired: { label: 'expired', fg: 'text-red-500', bg: 'bg-red-500/10' },
    revoked: { label: 'revoked', fg: 'text-red-500', bg: 'bg-red-500/10' },
};

function fmtDate(s) {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s; }
}

function daysUntil(s) {
    if (!s) return null;
    const ms = new Date(s).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    return Math.ceil(ms / 86400000);
}

export default function LicenseKeyActivation() {
    const { t } = useTranslation();
    const { tier, source, license, loading, error, activate, deactivate, refresh, reload } = useLicense();
    const [tokenInput, setTokenInput] = useState('');
    const [busy, setBusy] = useState(null); // 'activate' | 'refresh' | 'deactivate'
    const [actionError, setActionError] = useState(null);
    const [showInput, setShowInput] = useState(false);

    const badge = TIER_BADGE[tier] || TIER_BADGE.community;
    const isActivated = source === 'license_key' && license;

    const handleActivate = async () => {
        const token = tokenInput.trim();
        if (!token) return;
        setBusy('activate');
        setActionError(null);
        try {
            await activate(token);
            setTokenInput('');
            setShowInput(false);
        } catch (e) {
            setActionError(e.message || 'Activation failed');
        } finally {
            setBusy(null);
        }
    };

    const handleDeactivate = async () => {
        if (!window.confirm(t('license.confirm_deactivate', 'Remove the active license? Your instance will fall back to the free Community tier.'))) return;
        setBusy('deactivate');
        setActionError(null);
        try {
            await deactivate();
        } catch (e) {
            setActionError(e.message || 'Deactivation failed');
        } finally {
            setBusy(null);
        }
    };

    const handleRefresh = async () => {
        setBusy('refresh');
        setActionError(null);
        try {
            const result = await refresh();
            if (result && result.skipped && result.reason === 'license_server_not_configured') {
                setActionError(t('license.refresh_no_server', 'No license server configured — JWT signature is authoritative. Refresh has no effect.'));
            }
        } catch (e) {
            setActionError(e.message || 'Refresh failed');
        } finally {
            setBusy(null);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 animate-pulse">
                <div className="h-5 w-32 bg-[var(--bg-tertiary)] rounded mb-3" />
                <div className="h-10 bg-[var(--bg-tertiary)] rounded" />
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
            {/* Header — current tier */}
            <div className="p-5 flex items-center justify-between gap-4 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${badge.border} ${badge.bg}`}>
                        <ShieldCheck className={`w-5 h-5 ${badge.fg}`} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                {t('license.tier_label', 'License tier')}: {badge.label}
                            </h3>
                            {isActivated && license?.refreshStatus && REFRESH_BADGE[license.refreshStatus] && (
                                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${REFRESH_BADGE[license.refreshStatus].bg} ${REFRESH_BADGE[license.refreshStatus].fg}`}>
                                    {REFRESH_BADGE[license.refreshStatus].label}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {isActivated
                                ? t('license.activated_subtitle', 'Activated via license key')
                                : t('license.community_subtitle', 'No license key — running on the free Community tier')}
                        </p>
                    </div>
                </div>
                {isActivated && (
                    <button
                        onClick={handleRefresh}
                        disabled={busy !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                        title={t('license.refresh_now', 'Re-check with license server')}
                    >
                        {busy === 'refresh' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        {t('license.refresh', 'Refresh')}
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
                {actionError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 break-words">{actionError}</div>
                        <button onClick={() => setActionError(null)} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
                    </div>
                )}
                {error && !actionError && (
                    <div className="text-xs text-red-400">{error}</div>
                )}

                {isActivated ? (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t('license.expires_on', 'Expires on')}</div>
                            <div className="text-[var(--text-primary)] font-medium mt-0.5">
                                {fmtDate(license.expiresAt)}
                                {(() => {
                                    const d = daysUntil(license.expiresAt);
                                    if (d == null) return null;
                                    if (d < 0) return <span className="ml-1.5 text-red-400">({t('license.expired', 'expired')})</span>;
                                    if (d <= 14) return <span className="ml-1.5 text-amber-500">({t('license.in_days', '{n} days').replace('{n}', d)})</span>;
                                    return <span className="ml-1.5 text-[var(--text-muted)]">({t('license.in_days', '{n} days').replace('{n}', d)})</span>;
                                })()}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t('license.billing_interval', 'Billing')}</div>
                            <div className="text-[var(--text-primary)] font-medium mt-0.5 capitalize">{license.billingInterval || 'monthly'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t('license.last_refresh', 'Last refresh')}</div>
                            <div className="text-[var(--text-primary)] font-medium mt-0.5">{license.lastRefreshAt ? fmtDate(license.lastRefreshAt) : '—'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{t('license.license_id', 'License ID')}</div>
                            <div className="text-[var(--text-primary)] font-mono text-[11px] mt-0.5 truncate" title={license.id}>{license.id}</div>
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {t('license.community_explainer', 'You can activate Pro, Enterprise, or a custom plan with a license key purchased at beeflow.ai. Activation unlocks features like automations, multi-user, guardrails, and more.')}
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    {!showInput && !isActivated && (
                        <>
                            <button
                                onClick={() => setShowInput(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            >
                                <Key className="w-3.5 h-3.5" />
                                {t('license.enter_key', 'Enter license key')}
                            </button>
                            <a
                                href="https://beeflow.ai/pricing"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                {t('license.buy_at_beeflow', 'Buy at beeflow.ai')}
                            </a>
                        </>
                    )}
                    {!showInput && isActivated && (
                        <>
                            <button
                                onClick={() => setShowInput(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                            >
                                <Key className="w-3.5 h-3.5" />
                                {t('license.replace_key', 'Replace key')}
                            </button>
                            <button
                                onClick={handleDeactivate}
                                disabled={busy !== null}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-red-500/30 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                            >
                                {busy === 'deactivate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                {t('license.deactivate', 'Deactivate')}
                            </button>
                        </>
                    )}
                </div>

                {/* Token input */}
                {showInput && (
                    <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                        <label className="block text-xs font-medium text-[var(--text-primary)]">
                            {t('license.paste_token', 'Paste your license key (JWT)')}
                        </label>
                        <textarea
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            rows={4}
                            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-[11px] outline-none focus:border-blue-500 transition-colors resize-y"
                        />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleActivate}
                                disabled={busy !== null || !tokenInput.trim()}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                                {busy === 'activate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                {t('license.activate', 'Activate')}
                            </button>
                            <button
                                onClick={() => { setShowInput(false); setTokenInput(''); setActionError(null); }}
                                className="px-3 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
