import React, { useEffect, useRef, useState } from 'react';
import { Boxes, Loader2, RefreshCw, Store } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAdminModules, useImportModule, useRemoveModule } from '../../../api/queries/modules';
import { useEntitlements } from '../../EntitlementsContext';
import ModuleCard from './ModuleCard';
import RemoveModuleDialog from './RemoveModuleDialog';
import MarketplaceTab from './MarketplaceTab';

export default function ModulesPanel() {
    const { t } = useTranslation();
    const { data: modules = [], isLoading, isError, refetch } = useAdminModules();
    const importModule = useImportModule();
    const removeModule = useRemoveModule();
    const { reload: reloadEntitlements } = useEntitlements();

    // 'installed' | 'marketplace' — ?tab=marketplace opens the marketplace
    // directly (Stripe Checkout return URLs rely on this to land the customer
    // back on the tab that handles ?purchase=…).
    const [tab, setTab] = useState(() => (
        new URLSearchParams(window.location.search).get('tab') === 'marketplace' ? 'marketplace' : 'installed'
    ));
    const [message, setMessage] = useState(null);
    const [removeTarget, setRemoveTarget] = useState(null);

    const flashTimer = useRef(null);
    useEffect(() => () => clearTimeout(flashTimer.current), []);
    const flash = (msg) => {
        setMessage(msg);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setMessage(null), 3000);
    };

    // The API layer surfaces wire error slugs as the Error message — translate
    // the known ones instead of flashing the raw slug.
    const errorText = (e, fallback) => {
        if (e?.message === 'module_unavailable') return t('modules.error_unavailable');
        if (e?.message === 'not_found') return t('modules.error_not_found');
        return e?.message || fallback;
    };

    const handleImport = (module) => {
        importModule.mutate(module.id, {
            onSuccess: () => {
                // Refresh the acting super-admin's own entitlements so the
                // module's surfaces (e.g. its Studio tab) appear without a
                // page reload. Other members pick it up on their next reload.
                reloadEntitlements();
                flash({ type: 'success', text: t('modules.import_success', { name: module.name }) });
            },
            onError: (e) => flash({ type: 'error', text: errorText(e, 'Import failed') }),
        });
    };

    const handleRemoveConfirm = () => {
        const module = removeTarget;
        if (!module) return;
        removeModule.mutate(module.id, {
            onSuccess: () => {
                setRemoveTarget(null);
                reloadEntitlements();
                flash({ type: 'success', text: t('modules.remove_success', { name: module.name }) });
            },
            onError: (e) => {
                setRemoveTarget(null);
                flash({ type: 'error', text: errorText(e, 'Remove failed') });
            },
        });
    };

    const importedCount = modules.filter(m => m.status === 'imported').length;

    const TABS = [
        { id: 'installed', label: t('modules.tab_installed'), Icon: Boxes },
        { id: 'marketplace', label: t('modules.tab_marketplace'), Icon: Store },
    ];

    return (
        <div className="space-y-6">
            {removeTarget && (
                <RemoveModuleDialog
                    module={removeTarget}
                    busy={removeModule.isPending}
                    onCancel={() => setRemoveTarget(null)}
                    onConfirm={handleRemoveConfirm}
                />
            )}

            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Boxes className="w-5 h-5" style={{ color: '#f59e0b' }} />
                    {t('modules.title')}
                    {importedCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                            {t('modules.imported_count', { count: importedCount })}
                        </span>
                    )}
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('modules.subtitle')}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('modules.members_reload_hint')}
                </p>
            </div>

            {/* Installed | Marketplace tabs */}
            <div className="flex gap-1.5">
                {TABS.map(tb => {
                    const active = tab === tb.id;
                    return (
                        <button
                            key={tb.id}
                            onClick={() => setTab(tb.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all border"
                            style={{
                                background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: active ? '#fff' : 'var(--text-secondary)',
                                borderColor: active ? 'transparent' : 'var(--border-default)',
                            }}
                        >
                            <tb.Icon className="w-3.5 h-3.5" /> {tb.label}
                        </button>
                    );
                })}
            </div>

            {/* Success / info / error flash */}
            {message && (
                <div className={`text-xs px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : message.type === 'info' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {tab === 'marketplace' ? (
                <MarketplaceTab flash={flash} reloadEntitlements={reloadEntitlements} />
            ) : isLoading ? (
                <div className="flex items-center justify-center py-20" data-testid="modules-loading">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
            ) : isError ? (
                <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-between gap-3" data-testid="modules-error">
                    <span>{t('modules.error_load')}</span>
                    <button onClick={() => refetch()} className="flex items-center gap-1 font-medium hover:opacity-80">
                        <RefreshCw className="w-3.5 h-3.5" /> {t('modules.retry')}
                    </button>
                </div>
            ) : modules.length === 0 ? (
                <div className="text-center py-12" data-testid="modules-empty">
                    <Boxes className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('modules.empty')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {modules.map(module => (
                        <ModuleCard
                            key={module.id}
                            module={module}
                            onImport={handleImport}
                            onRemoveRequest={setRemoveTarget}
                            busy={
                                (importModule.isPending && importModule.variables === module.id) ||
                                (removeModule.isPending && removeModule.variables === module.id)
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
