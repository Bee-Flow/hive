import { AlertTriangle, ArrowUpCircle, Download, Loader2, RefreshCw, ScrollText, ShoppingCart, X } from 'lucide-react';
import React, { Suspense, lazy, useState } from 'react';
import { ModuleIcon, priceLabel } from './MarketplaceModuleCard';
import MediaGallery from './MediaGallery';
import PermissionList from './PermissionList';
import UpdatePolicySelector from './UpdatePolicySelector';
import VersionHistory from './VersionHistory';
import { useMarketplaceModuleDetail, useModuleVersions } from '../../../api/queries/modules';
import { useTranslation } from '../../../hooks/useTranslation';

// Right-hand detail drawer for one marketplace module. Opened by card click or
// a ?module=<id> deep link (MarketplaceTab owns that URL state). Rich fields
// come from GET /marketplace/:id — a v1 hub omits most of them, so every tab
// renders defensively from the row we already have.

// Lazy: the markdown pipeline (katex / highlight.js / mermaid) is heavy and
// only needed when a hub readme is actually rendered.
const MarkdownRenderer = lazy(() => import('../../MarkdownRenderer'));

const TAB_IDS = ['overview', 'versions', 'permissions'];

// Tab id → label key (variable lookup; every value is in the dict).
const TAB_KEY = {
    overview: 'modules.details_overview',
    versions: 'modules.details_versions',
    permissions: 'modules.details_permissions',
};

export default function ModuleDetailDrawer({ module, health = null, actions, onClose, onOpenLogs }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('overview');

    const detailQuery = useMarketplaceModuleDetail(module.id);
    const detail = detailQuery.data || null;
    // Ledger truth fallback for when the detail endpoint doesn't join it yet.
    const versionsQuery = useModuleVersions(module.id, { enabled: !detail?.ledgerVersions });
    const ledgerVersions = detail?.ledgerVersions ?? versionsQuery.data ?? [];

    const quarantined = health?.ledgerStatus === 'quarantined';
    const sideloaded = health?.source === 'sideload';
    const pendingRestart = !!(module.pendingRestart || health?.pendingRestart);
    const awaiting = actions.awaitingIds.has(module.id);
    const busy = actions.busyFor(module);
    const installCount = detail?.install_count ?? module.installCount ?? null;
    const vendor = detail?.vendor ?? module.vendor;
    const readme = detail?.readme || null;

    // One primary action, mirroring the card footer's priority order.
    const primary = (() => {
        if (quarantined) return { label: t('modules.reactivate'), Icon: RefreshCw, run: () => actions.reactivateModule(module) };
        if (module.status === 'expired') return { label: t('modules.renew'), Icon: RefreshCw, run: () => actions.buy(module) };
        if (module.installed && module.updateAvailable && !sideloaded) {
            return { label: t('modules.update'), Icon: ArrowUpCircle, run: () => actions.updateModule(module) };
        }
        if (module.installed) return null;
        if (module.entitled) return { label: t('modules.install'), Icon: Download, run: () => actions.installModule(module) };
        if (awaiting) return { label: t('modules.paid_refresh'), Icon: RefreshCw, run: () => actions.paidRefresh(module) };
        if (!sideloaded) return { label: t('modules.buy'), Icon: ShoppingCart, run: () => actions.buy(module) };
        return null;
    })();

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose} data-testid="module-detail-drawer">
            <div
                className="w-full max-w-2xl h-full border-l overflow-y-auto flex flex-col"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-start gap-3">
                        <ModuleIcon icon={module.icon} />
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{module.name}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
                                {vendor && <span>{t('modules.details_by', { vendor })}</span>}
                                {module.latestVersion && <span>v{module.latestVersion}</span>}
                                {installCount != null && <span>{t('modules.install_count', { count: installCount })}</span>}
                                <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                                    {priceLabel(t, detail?.pricing ?? module.pricing)}
                                </span>
                                {sideloaded && (
                                    <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                                        {t('modules.badge_sideloaded')}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {module.installed && onOpenLogs && (
                                <button
                                    onClick={() => onOpenLogs(module)}
                                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]"
                                    title={t('modules.details_logs')}
                                    data-testid="drawer-logs"
                                >
                                    <ScrollText className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                </button>
                            )}
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" data-testid="drawer-close">
                                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </button>
                        </div>
                    </div>

                    {(quarantined || pendingRestart) && (
                        <div className="mt-3 space-y-1.5">
                            {quarantined && (
                                <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {health?.lastActivationError || t('modules.badge_quarantined')}
                                </div>
                            )}
                            {pendingRestart && (
                                <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {t('modules.badge_restart_required')}
                                </div>
                            )}
                        </div>
                    )}

                    {primary && (
                        <button
                            onClick={primary.run}
                            disabled={busy}
                            className="mt-3 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            data-testid="drawer-primary-action"
                        >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <primary.Icon className="w-3.5 h-3.5" />}
                            {primary.label}
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="px-5 pt-3 flex gap-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    {TAB_IDS.map((id) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className="px-3 py-1.5 rounded-t-lg text-xs font-medium transition-all"
                            style={tab === id
                                ? { background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }
                                : { color: 'var(--text-muted)' }}
                            data-testid={`drawer-tab-${id}`}
                        >
                            {t(TAB_KEY[id])}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="px-5 py-4 flex-1">
                    {detailQuery.isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    ) : tab === 'overview' ? (
                        <div className="space-y-4">
                            <MediaGallery moduleId={module.id} media={detail?.media} />
                            {readme ? (
                                <Suspense fallback={<Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />}>
                                    <MarkdownRenderer content={readme} className="text-sm" />
                                </Suspense>
                            ) : (
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {module.description || t('modules.details_no_readme')}
                                </p>
                            )}
                        </div>
                    ) : tab === 'versions' ? (
                        <div className="space-y-4">
                            {module.installed && !sideloaded && (
                                <UpdatePolicySelector
                                    policy={detail?.updatePolicy}
                                    busy={actions.updatePolicy.isPending}
                                    onChange={(policy) => actions.setPolicy(module, policy)}
                                />
                            )}
                            <VersionHistory
                                hubVersions={detail?.versions}
                                ledgerVersions={ledgerVersions}
                                busy={busy}
                                onRollback={(version) => actions.rollbackTo(module, version)}
                                onActivateStaged={(version) => actions.activateStagedVersion(module, version)}
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <PermissionList
                                permissions={detail?.permissions}
                                granted={detail?.grantedPermissions}
                            />
                            {detail?.grantedPermissions?.acceptedAt && (
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    {t('modules.permissions.accepted_at', {
                                        by: detail.grantedPermissions.acceptedBy || '—',
                                        at: new Date(detail.grantedPermissions.acceptedAt).toLocaleString(),
                                    })}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
