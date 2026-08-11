import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileUp, Loader2, Plug, Search } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useEntitlements } from '../../EntitlementsContext';
import {
    useConnectHub,
    useDisconnectHub,
    useMarketplace,
    useModulesHealth,
} from '../../../api/queries/modules';
import MarketplaceModuleCard from './MarketplaceModuleCard';
import ConnectHubBanner from './ConnectHubBanner';
import ConnectHubDialog from './ConnectHubDialog';
import ModuleDetailDrawer from './ModuleDetailDrawer';
import ModuleLogsDialog from './ModuleLogsDialog';
import PermissionConsentDialog from './PermissionConsentDialog';
import SideloadDialog from './SideloadDialog';
import { useModuleActions } from './moduleActions';
import { parsePurchaseReturn, stripPurchaseReturnParams } from './purchaseReturn';
import { parseModuleDeepLink, searchWithModule, searchWithoutModule } from './moduleDeepLink';

// Marketplace (module hub) tab. Owns the connect/browse/buy/install lifecycle;
// all wire calls go through the modules.ts hooks and the shared useModuleActions
// hook (also driving the detail drawer). Purchases are honest: Buy opens Stripe
// Checkout in a new tab, the card shows "awaiting payment" with an explicit
// "I've paid — refresh" button, and the entitlement flip drives the Install
// button. Terminal install truth always comes from a fresh list fetch.

export default function MarketplaceTab({ flash, reloadEntitlements }) {
    const { t } = useTranslation();
    const { tier } = useEntitlements();
    const licensed = tier && tier !== 'community';

    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    useEffect(() => {
        const h = setTimeout(() => setDebouncedQ(q.trim()), 350);
        return () => clearTimeout(h);
    }, [q]);

    const marketplace = useMarketplace(debouncedQ);
    const connectHub = useConnectHub();
    const disconnectHub = useDisconnectHub();

    // Shared buy/install/update/rollback/reactivate machinery — used by the
    // card grid AND the detail drawer so both surfaces behave identically.
    const actions = useModuleActions({
        flash,
        reloadEntitlements,
        refetchMarketplace: () => marketplace.refetch(),
    });
    const { refreshEnt, awaitingIds, setAwaitingIds, installing, progress } = actions;

    // Connect / disconnect confirm dialog: null | 'connect' | 'disconnect'.
    const [dialog, setDialog] = useState(null);
    const [dialogError, setDialogError] = useState(null);

    // Detail drawer (card click / ?module=<id> deep link) + logs + sideload.
    const [detailId, setDetailId] = useState(null);
    const [logsModule, setLogsModule] = useState(null);
    const [sideloadOpen, setSideloadOpen] = useState(false);

    // react-query keeps `data.pages` referentially stable until it changes, so
    // memoising over it (not a fresh `|| []`) avoids recomputing every render.
    const pages = marketplace.data?.pages;
    const first = pages?.[0];
    const connected = first?.connected;
    const stale = !!first?.stale;
    const hubUrl = first?.hubUrl;
    const modules = useMemo(() => (pages || []).flatMap((p) => p?.modules || []), [pages]);

    // Runtime health (quarantine / restart / sideload chips), joined by id.
    const healthQuery = useModulesHealth();
    const healthById = useMemo(() => {
        const map = new Map();
        for (const row of healthQuery.data?.modules || []) map.set(row.moduleId, row);
        return map;
    }, [healthQuery.data]);

    // Distinguish "hub down" (502) from "not connected" (a normal 200 payload).
    const hubUnavailable = marketplace.isError
        && (marketplace.error?.status === 502 || marketplace.error?.body?.error === 'hub_unavailable');
    const hubDetail = marketplace.error?.body?.detail;

    // ── Stripe Checkout return (?purchase=success|cancel&module=<id>) ──
    // Checkout sends the customer back here (URLs built in moduleActions.buy).
    // Handle once on mount, then strip the params so a reload doesn't replay
    // the flash. Success also marks the module awaiting so the background poll
    // below keeps refreshing until the entitlement lands.
    useEffect(() => {
        const ret = parsePurchaseReturn(window.location.search);
        if (!ret) return;
        window.history.replaceState(null, '', stripPurchaseReturnParams(window.location));
        if (ret.result === 'success') {
            flash?.({ type: 'success', text: t('modules.purchase_return_success') });
            if (ret.moduleId) setAwaitingIds((s) => new Set(s).add(ret.moduleId));
            refreshEnt.mutate(undefined, {
                onSuccess: (res) => {
                    const ids = res?.entitledModuleIds || [];
                    if (ids.length) {
                        setAwaitingIds((s) => { const n = new Set(s); for (const id of ids) n.delete(id); return n; });
                    }
                    reloadEntitlements();
                    marketplace.refetch();
                },
            });
        } else {
            flash?.({ type: 'info', text: t('modules.purchase_return_cancel') });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── ?module=<id> deep link → open the detail drawer on mount ──
    useEffect(() => {
        const id = parseModuleDeepLink(window.location.search);
        if (id) setDetailId(id);
    }, []);

    const openDetails = (module) => {
        setDetailId(module.id);
        window.history.replaceState(null, '', searchWithModule(module.id));
    };
    const closeDetails = () => {
        setDetailId(null);
        window.history.replaceState(null, '', searchWithoutModule(window.location));
    };

    // ── Background entitlement poll while a purchase is awaiting payment ──
    // Honest, no hub→install push: after Checkout opens we poll entitlements so
    // a completed payment flips the card to Install on its own; the explicit
    // "I've paid — refresh" button remains for impatient admins. A fixed 6s
    // cadence keeps this simple (the plan's tapering cadence is a refinement).
    useEffect(() => {
        if (awaitingIds.size === 0) return undefined;
        const iv = setInterval(() => {
            if (refreshEnt.isPending) return;
            refreshEnt.mutate(undefined, {
                onSuccess: (res) => {
                    const ids = res?.entitledModuleIds || [];
                    if (ids.length) {
                        setAwaitingIds((s) => { const n = new Set(s); for (const id of ids) n.delete(id); return n; });
                    }
                    reloadEntitlements();
                    marketplace.refetch();
                },
            });
        }, 6000);
        return () => clearInterval(iv);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [awaitingIds.size]);

    const handleConnectConfirm = () => {
        setDialogError(null);
        connectHub.mutate({}, {
            onSuccess: () => {
                setDialog(null);
                reloadEntitlements();
                marketplace.refetch();
                flash?.({ type: 'success', text: t('modules.connect_success') });
            },
            onError: (e) => setDialogError(
                e?.status === 409 || e?.body?.error === 'already_connected'
                    ? t('modules.error_already_connected')
                    : t('modules.hub_unavailable'),
            ),
        });
    };

    const handleDisconnectConfirm = () => {
        setDialogError(null);
        disconnectHub.mutate(undefined, {
            onSuccess: () => { setDialog(null); reloadEntitlements(); marketplace.refetch(); },
            onError: () => setDialogError(t('modules.hub_unavailable')),
        });
    };

    const detailModule = detailId ? modules.find((m) => m.id === detailId) || null : null;

    const dialogNode = dialog && (
        <ConnectHubDialog
            mode={dialog}
            licensed={licensed}
            busy={connectHub.isPending || disconnectHub.isPending}
            error={dialogError}
            onCancel={() => { setDialog(null); setDialogError(null); }}
            onConfirm={dialog === 'disconnect' ? handleDisconnectConfirm : handleConnectConfirm}
        />
    );

    // Overlays for the connected view (consent can pop mid-install/update).
    const overlayNodes = (
        <>
            {actions.consent && (
                <PermissionConsentDialog
                    module={actions.consent.module}
                    permissions={actions.consent.permissions}
                    mode={actions.consent.mode}
                    busy={actions.install.isPending || actions.update.isPending}
                    onCancel={() => actions.setConsent(null)}
                    onAccept={actions.acceptConsent}
                />
            )}
            {sideloadOpen && (
                <SideloadDialog
                    onClose={() => setSideloadOpen(false)}
                    onDone={() => actions.refreshAll()}
                />
            )}
            {logsModule && <ModuleLogsDialog module={logsModule} onClose={() => setLogsModule(null)} />}
            {detailModule && (
                <ModuleDetailDrawer
                    module={detailModule}
                    health={healthById.get(detailModule.id) || null}
                    actions={actions}
                    onClose={closeDetails}
                    onOpenLogs={(m) => setLogsModule(m)}
                />
            )}
        </>
    );

    // ── Render ──
    if (marketplace.isLoading) {
        return (
            <div className="flex items-center justify-center py-20" data-testid="marketplace-loading">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    if (hubUnavailable) {
        return (
            <div className="space-y-3">
                <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 flex items-center gap-2" data-testid="marketplace-hub-unavailable">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{t('modules.hub_unavailable')}{hubDetail ? ` (${hubDetail})` : ''}</span>
                </div>
                <button
                    onClick={() => marketplace.refetch()}
                    className="text-xs font-medium flex items-center gap-1 hover:opacity-80"
                    style={{ color: 'var(--accent-primary)' }}
                >
                    {t('modules.retry')}
                </button>
            </div>
        );
    }

    if (connected === false) {
        return (
            <>
                {dialogNode}
                <ConnectHubBanner
                    licensed={licensed}
                    busy={connectHub.isPending}
                    onConnect={() => { setDialogError(null); setDialog('connect'); }}
                />
            </>
        );
    }

    return (
        <div className="space-y-4">
            {dialogNode}
            {overlayNodes}

            {/* Connection status row */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Plug className="w-3.5 h-3.5" style={{ color: '#10b981' }} />
                    {t('modules.connected_to', { hub: hubUrl || '' })}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setSideloadOpen(true)}
                        className="text-xs font-medium hover:opacity-80 flex items-center gap-1"
                        style={{ color: 'var(--text-secondary)' }}
                        data-testid="sideload-open"
                    >
                        <FileUp className="w-3.5 h-3.5" /> {t('modules.sideload')}
                    </button>
                    <button
                        onClick={() => { setDialogError(null); setDialog('disconnect'); }}
                        className="text-xs font-medium hover:opacity-80"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {t('modules.disconnect')}
                    </button>
                </div>
            </div>

            {stale && (
                <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }} data-testid="marketplace-stale">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {t('modules.marketplace_stale')}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('modules.marketplace_search')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
            </div>

            {/* Grid */}
            {modules.length === 0 ? (
                <div className="text-center py-12" data-testid="marketplace-empty">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('modules.empty')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {modules.map((module) => (
                        <MarketplaceModuleCard
                            key={module.id}
                            module={module}
                            health={healthById.get(module.id) || null}
                            awaiting={awaitingIds.has(module.id)}
                            installProgress={installing?.id === module.id ? progress.data : null}
                            busy={actions.busyFor(module)}
                            onBuy={actions.buy}
                            onInstall={actions.installModule}
                            onUpdate={actions.updateModule}
                            onPaidRefresh={actions.paidRefresh}
                            onReactivate={actions.reactivateModule}
                            onOpenDetails={openDetails}
                            onPolicyChange={actions.setPolicy}
                            policyBusy={actions.updatePolicy.isPending}
                        />
                    ))}
                </div>
            )}

            {/* Load more */}
            {marketplace.hasNextPage && (
                <div className="flex justify-center">
                    <button
                        onClick={() => marketplace.fetchNextPage()}
                        disabled={marketplace.isFetchingNextPage}
                        className="px-4 py-2 rounded-lg text-xs font-medium transition-all border disabled:opacity-50 flex items-center gap-1.5"
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
                    >
                        {marketplace.isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {t('modules.load_more')}
                    </button>
                </div>
            )}
        </div>
    );
}
