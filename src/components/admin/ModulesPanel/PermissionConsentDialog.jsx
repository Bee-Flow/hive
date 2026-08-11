import { Loader2, ShieldCheck, X } from 'lucide-react';
import React from 'react';
import { normalizePermissions } from './permissionCopy';
import PermissionList from './PermissionList';
import { useTranslation } from '../../../hooks/useTranslation';

// mv2 permission consent. Opens when an install/update/sideload fails with
// consent_required; Accept re-fires the action with acceptedPermissions set to
// exactly the ids shown here. `diff` (update mode) marks which ids are new
// relative to the already-granted set.
export default function PermissionConsentDialog({ module, permissions, mode = 'install', diff = null, busy = false, onAccept, onCancel }) {
    const { t } = useTranslation();
    const perms = normalizePermissions(permissions);
    const title = mode === 'update'
        ? t('modules.consent_title_update', { name: module?.name || module?.id || '' })
        : t('modules.consent_title_install', { name: module?.name || module?.id || '' });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={busy ? undefined : onCancel} data-testid="permission-consent-dialog">
            <div
                className="w-full max-w-lg rounded-2xl border overflow-hidden"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <ShieldCheck className="w-4 h-4" style={{ color: '#f59e0b' }} />
                        {title}
                    </h3>
                    <button onClick={onCancel} disabled={busy} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                        <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-3">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {t('modules.consent_body')}
                    </p>
                    <div className="max-h-72 overflow-y-auto pr-1">
                        <PermissionList permissions={perms} diff={diff} />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            onClick={onCancel}
                            disabled={busy}
                            className="px-3 py-2 rounded-lg text-sm border disabled:opacity-50"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                        >
                            {t('modules.cancel')}
                        </button>
                        <button
                            onClick={() => onAccept(perms.map((p) => p.id))}
                            disabled={busy || perms.length === 0}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            data-testid="consent-accept"
                        >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                            {t('modules.consent_accept')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
