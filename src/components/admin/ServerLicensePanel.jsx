import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Key, AlertCircle, Loader2, X, Globe } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import { useLicenseContext } from '../LicenseContext';

/**
 * ServerLicensePanel — super-admin entry point for activating ONE licence
 * key that governs the entire install. Per-org licences are overridden
 * while a server-wide licence is active.
 *
 * Available to super-admins on any deployment mode; the surrounding /admin
 * tab gates on superAdminOnly and the backend re-asserts the super-admin
 * check on activate/deactivate.
 */

const TIER_BADGE = {
    community: { label: 'Community', bg: 'bg-slate-500/15', fg: 'text-slate-400', border: 'border-slate-500/30' },
    enterprise: { label: 'Enterprise', bg: 'bg-emerald-500/15', fg: 'text-emerald-500', border: 'border-emerald-500/30' },
    full: { label: 'Full', bg: 'bg-amber-500/15', fg: 'text-amber-500', border: 'border-amber-500/30' },
};

function fmtDate(s) {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return s; }
}

function daysUntil(s) {
    if (!s) return null;
    const ms = new Date(s).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    return Math.ceil(ms / 86400000);
}

export default function ServerLicensePanel() {
    const { t } = useTranslation();
    const { reload: reloadLicenseContext } = useLicenseContext();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tokenInput, setTokenInput] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [busy, setBusy] = useState(null); // 'activate' | 'deactivate'
    const [actionError, setActionError] = useState(null);

    // Pull the server-wide licence status. The server-side getLicenseStatus
    // returns the server-scope row with serverOverride:true when present,
    // regardless of the caller's org — so a plain GET /status suffices.
    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const r = await authFetch(`${API_BASE}/api/license/status`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setStatus(data);
            setActionError(null);
        } catch (e) {
            console.warn('[ServerLicensePanel] reload failed', e);
            setActionError(e.message || 'Failed to load licence status');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const isServerScope = status?.scope === 'server' && status?.serverOverride === true;
    const tier = status?.tier || 'community';
    const badge = TIER_BADGE[tier] || TIER_BADGE.community;
    const expiresAt = status?.license?.expiresAt || null;
    const daysLeft = daysUntil(expiresAt);

    const handleActivate = async () => {
        const token = tokenInput.trim();
        if (!token) return;
        // Hard confirm — this is destructive (overrides every per-org licence).
        const ok = window.confirm(
            t('admin.server_license.confirm_activate',
              'Activating a server-wide licence overrides EVERY existing organisation licence on this install. Every org runs at the server-wide tier while this licence is active. Continue?')
        );
        if (!ok) return;
        setBusy('activate');
        setActionError(null);
        try {
            const r = await authFetch(`${API_BASE}/api/license/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, scope: 'server' }),
            });
            let data = {};
            try { data = await r.json(); } catch { /* ignore */ }
            if (!r.ok) {
                const code = data.code || data.error;
                const msg = data.message || data.error || `HTTP ${r.status}`;
                throw new Error(`${msg}${code ? ` (${code})` : ''}`);
            }
            setTokenInput('');
            setShowInput(false);
            await reload();
            // Bubble out so the rest of the UI re-derives features.
            reloadLicenseContext && reloadLicenseContext();
        } catch (e) {
            setActionError(e.message || 'Activation failed');
        } finally {
            setBusy(null);
        }
    };

    const handleDeactivate = async () => {
        const ok = window.confirm(
            t('admin.server_license.confirm_deactivate',
              'Remove the server-wide licence? Every organisation will revert to its own per-organisation licence (or Community fallback) on the next request.')
        );
        if (!ok) return;
        setBusy('deactivate');
        setActionError(null);
        try {
            const r = await authFetch(`${API_BASE}/api/license/deactivate?scope=server`, { method: 'DELETE' });
            if (!r.ok && r.status !== 404) {
                let data = {};
                try { data = await r.json(); } catch { /* ignore */ }
                throw new Error(data.error || `HTTP ${r.status}`);
            }
            await reload();
            reloadLicenseContext && reloadLicenseContext();
        } catch (e) {
            setActionError(e.message || 'Deactivation failed');
        } finally {
            setBusy(null);
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border p-5 animate-pulse" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                <div className="h-5 w-48 rounded mb-3" style={{ background: 'var(--bg-tertiary)' }} />
                <div className="h-10 rounded" style={{ background: 'var(--bg-tertiary)' }} />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Heading */}
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}>
                    <Globe className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        {t('admin.server_license.title') || 'Server licence'}
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {t('admin.server_license.intro') ||
                            'One licence key applied install-wide. Every organisation on this server runs at the tier this licence carries; per-organisation licences are ignored while this is active.'}
                    </p>
                </div>
            </div>

            {/* Active state card */}
            <div className="rounded-2xl border p-5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-3 mb-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${badge.bg} ${badge.fg} ${badge.border}`}>
                        {badge.label}
                    </span>
                    {isServerScope ? (
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            <ShieldCheck className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                            {t('admin.server_license.active_badge') || 'Server-wide licence active'}
                        </span>
                    ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t('admin.server_license.inactive_badge') || 'No server-wide licence applied'}
                        </span>
                    )}
                </div>

                {isServerScope && status?.license && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <div>
                            <div className="opacity-60 mb-0.5">{t('admin.server_license.issuer') || 'Issuer'}</div>
                            <div className="font-mono truncate">{status.license.issuer || '—'}</div>
                        </div>
                        <div>
                            <div className="opacity-60 mb-0.5">{t('admin.server_license.expires') || 'Expires'}</div>
                            <div>{fmtDate(expiresAt)} {daysLeft != null && daysLeft >= 0 ? `· ${daysLeft}d` : ''}</div>
                        </div>
                        <div>
                            <div className="opacity-60 mb-0.5">{t('admin.server_license.billing') || 'Billing'}</div>
                            <div>{status.license.billingInterval || '—'}</div>
                        </div>
                    </div>
                )}

                {actionError && (
                    <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">{actionError}</div>
                        <button onClick={() => setActionError(null)} className="opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4">
                    {isServerScope ? (
                        <>
                            <button
                                onClick={() => setShowInput((v) => !v)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                disabled={!!busy}
                            >
                                <Key className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                                {t('admin.server_license.replace') || 'Replace licence'}
                            </button>
                            <button
                                onClick={handleDeactivate}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: 'rgba(239,68,68,0.10)', color: '#dc2626' }}
                                disabled={!!busy}
                            >
                                {busy === 'deactivate'
                                    ? (<><Loader2 className="inline w-3.5 h-3.5 mr-1 -mt-0.5 animate-spin" />{t('admin.server_license.deactivating') || 'Deactivating…'}</>)
                                    : (t('admin.server_license.deactivate') || 'Deactivate')}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowInput(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600"
                            disabled={!!busy}
                        >
                            <Key className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                            {t('admin.server_license.activate') || 'Apply server-wide licence'}
                        </button>
                    )}
                </div>

                {showInput && (
                    <div className="mt-4 p-3 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                        <textarea
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            placeholder={t('admin.server_license.token_placeholder') || 'Paste licence JWT or admin blob (beeflow-admin-v1.…)'}
                            className="w-full h-24 rounded-md px-2 py-1.5 text-xs font-mono"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <button
                                onClick={() => { setShowInput(false); setTokenInput(''); setActionError(null); }}
                                className="px-3 py-1 rounded-md text-xs font-medium"
                                style={{ color: 'var(--text-secondary)' }}
                                disabled={!!busy}
                            >
                                {t('common.cancel') || 'Cancel'}
                            </button>
                            <button
                                onClick={handleActivate}
                                disabled={!tokenInput.trim() || busy === 'activate'}
                                className="px-3 py-1 rounded-md text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                                {busy === 'activate'
                                    ? (<><Loader2 className="inline w-3.5 h-3.5 mr-1 -mt-0.5 animate-spin" />{t('admin.server_license.activating') || 'Activating…'}</>)
                                    : (t('admin.server_license.activate_confirm') || 'Activate server-wide')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Warning panel */}
            <div className="rounded-xl border p-4 text-xs" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)', color: 'var(--text-secondary)' }}>
                <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                    <div>
                        <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            {t('admin.server_license.warn_title') || 'Override semantics'}
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                            <li>{t('admin.server_license.warn_override') || 'Every organisation on this install will resolve to the server-wide tier.'}</li>
                            <li>{t('admin.server_license.warn_per_org_hidden') || 'Per-organisation activation is disabled in Org Settings while a server-wide licence is active.'}</li>
                            <li>{t('admin.server_license.warn_rollback') || 'Per-organisation licences are preserved — deactivating restores them.'}</li>
                            <li>{t('admin.server_license.warn_tier_min') || 'Community-tier licences are rejected: Community is the default floor already.'}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
