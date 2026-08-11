// Shared marketplace module actions — one hook used by BOTH the card grid
// (MarketplaceTab) and the detail drawer, so buy/install/update/rollback/
// reactivate behave identically from either surface. Owns the cross-cutting
// state: awaiting-payment ids, the in-flight install (progress polling), and
// the pending permission-consent request.

import { useEffect, useState } from 'react';
import { normalizePermissions } from './permissionCopy';
import { buildPurchaseReturnUrls } from './purchaseReturn';
import {
    useActivateStaged,
    useInstallModule,
    useInstallProgress,
    usePurchaseModule,
    useReactivateModule,
    useRefreshEntitlements,
    useRollbackModule,
    useUpdateModule,
    useUpdatePolicy,
} from '../../../api/queries/modules';
import { useTranslation } from '../../../hooks/useTranslation';
import { reloadRemoteModules } from '../../../moduleRuntime/registry';

/** consent_required payload → missing permission ids, else null. */
export function consentRequiredPermissions(e) {
    if (e?.body?.error === 'consent_required') return e.body.missingPermissions || [];
    return null;
}

export function useModuleActions({ t: tOverride, flash, reloadEntitlements, refetchMarketplace }) {
    const { t: tHook } = useTranslation();
    const t = tOverride || tHook;

    const purchase = usePurchaseModule();
    const refreshEnt = useRefreshEntitlements();
    const install = useInstallModule();
    const update = useUpdateModule();
    const reactivate = useReactivateModule();
    const rollback = useRollbackModule();
    const activateStaged = useActivateStaged();
    const updatePolicy = useUpdatePolicy();

    // Modules whose Checkout was opened and are awaiting payment confirmation.
    const [awaitingIds, setAwaitingIds] = useState(() => new Set());
    // The module currently installing on this node (drives progress polling).
    const [installing, setInstalling] = useState(null); // { id, name } | null
    // Pending consent request: { module, permissions:[{id,reason?}], mode }.
    const [consent, setConsent] = useState(null);
    const progress = useInstallProgress(installing?.id || null, { enabled: !!installing });

    const refreshAll = () => {
        reloadEntitlements();
        refetchMarketplace();
    };

    // ── Error → user text ──
    const purchaseErrText = (e) => {
        if (e?.body?.error === 'already_entitled' || e?.status === 409) return null; // benign
        return t('modules.purchase_failed');
    };
    const installErrText = (e) => {
        if (e?.status === 402 || e?.body?.error === 'not_entitled') return t('modules.error_not_entitled');
        if (e?.status === 409 || e?.body?.error === 'install_in_progress' || e?.body?.error === 'module_unavailable') {
            return t('modules.error_install_in_progress');
        }
        return t('modules.install_failed');
    };

    // ── Install progress → terminal handling ──
    useEffect(() => {
        if (!installing) return;
        const phase = progress.data?.phase;
        if (phase === 'done') {
            setInstalling(null);
            refreshAll();
            reloadRemoteModules();  // surface the module's Studio tab without a reload
            flash?.({ type: 'success', text: t('modules.install_success', { name: installing.name }) });
        } else if (phase === 'staged') {
            // Terminal but inert: verified + stored, needs restart / activate-staged.
            setInstalling(null);
            refreshAll();
            flash?.({ type: 'info', text: t('modules.install_staged', { name: installing.name }) });
        } else if (phase === 'error') {
            setInstalling(null);
            const missing = progress.data?.error === 'consent_required'
                ? (progress.data?.detail?.missingPermissions || [])
                : null;
            if (missing) {
                setConsent({
                    module: { id: installing.id, name: installing.name },
                    permissions: normalizePermissions(missing),
                    mode: 'install',
                });
            } else {
                flash?.({ type: 'error', text: progress.data?.error || t('modules.install_failed') });
            }
        } else if (progress.isError) {
            // Progress record gone (404) — reconcile from the list's terminal truth.
            setInstalling(null);
            refetchMarketplace();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [progress.data?.phase, progress.isError, installing]);

    // ── Actions ──
    const buy = (module) => {
        // Checkout return URLs land back on this page's marketplace tab (see
        // the ?purchase=… mount effect in MarketplaceTab).
        const { successUrl, cancelUrl } = buildPurchaseReturnUrls(module.id);
        purchase.mutate({ id: module.id, successUrl, cancelUrl }, {
            onSuccess: (res) => {
                if (res?.checkoutUrl) {
                    try { window.open(res.checkoutUrl, '_blank', 'noopener,noreferrer'); } catch { /* popup blocked */ }
                    setAwaitingIds((s) => new Set(s).add(module.id));
                } else {
                    // Free / instantly-active entitlement — reflect immediately.
                    refreshAll();
                }
            },
            onError: (e) => {
                const msg = purchaseErrText(e);
                if (msg) flash?.({ type: 'error', text: msg });
                else refreshAll(); // already entitled
            },
        });
    };

    const paidRefresh = (module) => {
        refreshEnt.mutate(undefined, {
            onSuccess: (res) => {
                const ids = res?.entitledModuleIds || [];
                if (ids.includes(module.id)) {
                    setAwaitingIds((s) => { const n = new Set(s); n.delete(module.id); return n; });
                }
                refreshAll();
            },
            onError: () => refetchMarketplace(),
        });
    };

    const installModule = (module, acceptedPermissions = null) => {
        install.mutate({ id: module.id, acceptedPermissions: acceptedPermissions || undefined }, {
            onSuccess: () => setInstalling({ id: module.id, name: module.name }),
            onError: (e) => flash?.({ type: 'error', text: installErrText(e) }),
        });
    };

    const updateModule = (module, acceptedPermissions = null) => {
        update.mutate({ id: module.id, acceptedPermissions: acceptedPermissions || undefined }, {
            onSuccess: (res) => {
                refreshAll();
                reloadRemoteModules();
                flash?.({
                    type: 'success',
                    text: res?.requiresRestart ? t('modules.update_restart_required') : t('modules.install_success', { name: module.name }),
                });
            },
            onError: (e) => {
                const missing = consentRequiredPermissions(e);
                if (missing) {
                    setConsent({ module, permissions: normalizePermissions(missing), mode: 'update' });
                    return;
                }
                flash?.({ type: 'error', text: installErrText(e) });
            },
        });
    };

    // Consent dialog accept → retry the original action with the accepted ids.
    const acceptConsent = (acceptedIds) => {
        const c = consent;
        setConsent(null);
        if (!c) return;
        if (c.mode === 'update') updateModule(c.module, acceptedIds);
        else installModule(c.module, acceptedIds);
    };

    const reactivateModule = (module) => {
        reactivate.mutate(module.id, {
            onSuccess: () => {
                refreshAll();
                flash?.({ type: 'success', text: t('modules.reactivate_success', { name: module.name }) });
            },
            onError: (e) => {
                if (e?.body?.error === 'not_quarantined') { refetchMarketplace(); return; } // benign race
                flash?.({ type: 'error', text: t('modules.reactivate_failed') });
            },
        });
    };

    const rollbackTo = (module, version) => {
        rollback.mutate({ id: module.id, version }, {
            onSuccess: (res) => {
                refreshAll();
                flash?.({ type: 'success', text: t('modules.rollback_success', { name: module.name, version: res?.version || version || '' }) });
            },
            onError: (e) => {
                if (e?.body?.error === 'schema_downgrade') {
                    flash?.({ type: 'error', text: t('modules.rollback_schema_downgrade') });
                } else if (e?.status === 404 || e?.body?.error === 'no_rollback_candidate') {
                    flash?.({ type: 'error', text: t('modules.rollback_no_candidate') });
                } else if (e?.status === 402 || e?.body?.error === 'not_entitled') {
                    flash?.({ type: 'error', text: t('modules.error_not_entitled') });
                } else {
                    flash?.({ type: 'error', text: t('modules.rollback_failed') });
                }
            },
        });
    };

    const activateStagedVersion = (module, version = undefined) => {
        activateStaged.mutate({ id: module.id, version }, {
            onSuccess: (res) => {
                refreshAll();
                reloadRemoteModules();
                flash?.({ type: 'success', text: t('modules.install_success', { name: module.name || res?.version || '' }) });
            },
            onError: () => flash?.({ type: 'error', text: t('modules.activate_staged_failed') }),
        });
    };

    const setPolicy = (module, policy) => {
        updatePolicy.mutate({ id: module.id, ...policy }, {
            onError: () => flash?.({ type: 'error', text: t('modules.update_policy_failed') }),
        });
    };

    const busyFor = (module) =>
        (purchase.isPending && purchase.variables?.id === module.id)
        || (install.isPending && install.variables?.id === module.id)
        || (update.isPending && update.variables?.id === module.id)
        || (rollback.isPending && rollback.variables?.id === module.id)
        || (activateStaged.isPending && activateStaged.variables?.id === module.id)
        || (reactivate.isPending && reactivate.variables === module.id)
        || (refreshEnt.isPending && awaitingIds.has(module.id));

    return {
        // mutations (exposed for pending flags / direct use)
        purchase, refreshEnt, install, update, reactivate, rollback, activateStaged, updatePolicy,
        // state
        awaitingIds, setAwaitingIds, installing, progress, consent, setConsent,
        // actions
        buy, paidRefresh, installModule, updateModule, acceptConsent,
        reactivateModule, rollbackTo, activateStagedVersion, setPolicy,
        busyFor, refreshAll,
    };
}
