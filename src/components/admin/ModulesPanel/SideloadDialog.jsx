import { CheckCircle2, FileUp, KeyRound, Loader2, Upload, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import PermissionConsentDialog from './PermissionConsentDialog';
import { normalizePermissions } from './permissionCopy';
import { useActivateStaged, useOfflineGrant, useSideloadModule } from '../../../api/queries/modules';
import { useTranslation } from '../../../hooks/useTranslation';

// Enterprise sideload: upload a raw .bfmod package. Two recoverable detours:
//   402 offline_grant_required → pick + apply a .bfgrant JSON, then
//        activate-staged brings the already-stored package up;
//   409 consent_required     → permission consent dialog, then retry the
//        upload with acceptedPermissions (query param — body is the package).
export default function SideloadDialog({ onClose, onDone }) {
    const { t } = useTranslation();
    const sideload = useSideloadModule();
    const offlineGrant = useOfflineGrant();
    const activateStaged = useActivateStaged();

    const fileRef = useRef(null);
    const grantRef = useRef(null);
    const [file, setFile] = useState(null);          // File (.bfmod)
    const [error, setError] = useState(null);        // user-facing text
    const [needGrant, setNeedGrant] = useState(false);
    const [consent, setConsent] = useState(null);    // [{id,reason?}] | null
    const [result, setResult] = useState(null);      // { version, requiresRestart, activated? }

    const busy = sideload.isPending || offlineGrant.isPending || activateStaged.isPending;

    const errText = (e) => {
        const slug = e?.body?.error || e?.message;
        if (slug === 'package_verify_failed') return t('modules.sideload_verify_failed');
        if (slug === 'module_id_conflict') return t('modules.sideload_id_conflict');
        if (slug === 'incompatible') return t('modules.sideload_incompatible');
        if (slug === 'install_in_progress') return t('modules.error_install_in_progress');
        return t('modules.sideload_failed');
    };

    const doSideload = (acceptedPermissions = null) => {
        if (!file) return;
        setError(null);
        sideload.mutate({ file, acceptedPermissions: acceptedPermissions || undefined }, {
            onSuccess: (res) => {
                setResult({ version: res?.version || '', requiresRestart: !!res?.requiresRestart });
                onDone?.(res);
            },
            onError: (e) => {
                if (e?.status === 402 || e?.body?.error === 'offline_grant_required') { setNeedGrant(true); return; }
                const missing = e?.body?.error === 'consent_required' ? (e.body.missingPermissions || []) : null;
                if (missing) { setConsent(normalizePermissions(missing)); return; }
                setError(errText(e));
            },
        });
    };

    const applyGrant = async (grantFile) => {
        setError(null);
        let grant = null;
        try { grant = JSON.parse(await grantFile.text()); } catch { grant = null; }
        const moduleId = grant && (grant.module_id || grant.moduleId || grant.sub);
        if (!grant || !moduleId) {
            setError(t('modules.sideload_grant_invalid'));
            return;
        }
        offlineGrant.mutate({ id: String(moduleId), grant }, {
            onSuccess: () => {
                // The package was already verified + staged by the 402'd upload;
                // the grant unlocks it — bring it up.
                activateStaged.mutate({ id: String(moduleId) }, {
                    onSuccess: (res) => {
                        setNeedGrant(false);
                        setResult({ version: res?.version || '', requiresRestart: false, activated: true });
                        onDone?.(res);
                    },
                    onError: (e) => {
                        if (e?.status === 404 || e?.body?.error === 'no_staged_version') {
                            // Grant applied but nothing staged — re-run the upload.
                            setNeedGrant(false);
                            doSideload();
                            return;
                        }
                        setError(t('modules.activate_staged_failed'));
                    },
                });
            },
            onError: () => setError(t('modules.sideload_grant_invalid')),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : onClose} data-testid="sideload-dialog">
            {consent && (
                <PermissionConsentDialog
                    module={{ id: file?.name || 'package', name: file?.name || 'package' }}
                    permissions={consent}
                    mode="install"
                    busy={busy}
                    onCancel={() => setConsent(null)}
                    onAccept={(ids) => { setConsent(null); doSideload(ids); }}
                />
            )}
            <div
                className="w-full max-w-md rounded-2xl border overflow-hidden"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <FileUp className="w-4 h-4" style={{ color: '#f59e0b' }} />
                        {t('modules.sideload_title')}
                    </h3>
                    <button onClick={onClose} disabled={busy} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                        <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-3">
                    {result ? (
                        <>
                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-primary)' }} data-testid="sideload-success">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                {result.activated
                                    ? t('modules.sideload_activated', { version: result.version })
                                    : t('modules.sideload_success', { version: result.version })}
                            </div>
                            {result.requiresRestart && (
                                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                    {t('modules.sideload_restart_required')}
                                </p>
                            )}
                            <div className="flex justify-end pt-1">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-lg text-sm font-medium"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                >
                                    {t('modules.close')}
                                </button>
                            </div>
                        </>
                    ) : needGrant ? (
                        <>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {t('modules.sideload_grant_needed')}
                            </p>
                            {error && <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">{error}</div>}
                            <input
                                ref={grantRef}
                                type="file"
                                accept=".bfgrant,application/json,.json"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) applyGrant(f); e.target.value = ''; }}
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    onClick={onClose}
                                    disabled={busy}
                                    className="px-3 py-2 rounded-lg text-sm border disabled:opacity-50"
                                    style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                                >
                                    {t('modules.cancel')}
                                </button>
                                <button
                                    onClick={() => grantRef.current?.click()}
                                    disabled={busy}
                                    className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                    data-testid="sideload-pick-grant"
                                >
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                    {t('modules.sideload_pick_grant')}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {t('modules.sideload_body')}
                            </p>
                            {error && <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">{error}</div>}
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".bfmod,application/octet-stream,application/zip"
                                className="hidden"
                                onChange={(e) => { setFile(e.target.files?.[0] || null); setError(null); }}
                            />
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={busy}
                                className="w-full px-3 py-2.5 rounded-lg text-xs border border-dashed disabled:opacity-50 flex items-center justify-center gap-2"
                                style={{ background: 'var(--bg-primary)', color: file ? 'var(--text-primary)' : 'var(--text-muted)', borderColor: 'var(--border-default)' }}
                                data-testid="sideload-pick-file"
                            >
                                <FileUp className="w-3.5 h-3.5" />
                                {file ? file.name : t('modules.sideload_pick')}
                            </button>
                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    onClick={onClose}
                                    disabled={busy}
                                    className="px-3 py-2 rounded-lg text-sm border disabled:opacity-50"
                                    style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                                >
                                    {t('modules.cancel')}
                                </button>
                                <button
                                    onClick={() => doSideload()}
                                    disabled={busy || !file}
                                    className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                    data-testid="sideload-submit"
                                >
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    {t('modules.sideload_submit')}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
