import { Check, ServerCrash, ShieldAlert } from 'lucide-react';
import React from 'react';
import { normalizePermissions, permissionCopy, splitEnvPermissions } from './permissionCopy';
import { useTranslation } from '../../../hooks/useTranslation';

// Permission list shared by the consent dialog (pre-install review) and the
// detail drawer's Permissions tab (granted state). `granted` is the drawer's
// grantedPermissions object; `diff` marks ids that are NEW in an update.

function PermissionRow({ perm, granted, isNew }) {
    const { t } = useTranslation();
    return (
        <li className="flex items-start gap-2.5 py-2" data-testid={`perm-${perm.id}`}>
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {permissionCopy(t, perm.id)}
                    </span>
                    {isNew && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                            {t('modules.permissions.new')}
                        </span>
                    )}
                    {granted && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">
                            <Check className="w-2.5 h-2.5" /> {t('modules.permissions.granted')}
                        </span>
                    )}
                </div>
                {perm.reason && (
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{perm.reason}</p>
                )}
                <code className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{perm.id}</code>
            </div>
        </li>
    );
}

export default function PermissionList({ permissions, granted = null, diff = null }) {
    const { t } = useTranslation();
    const perms = normalizePermissions(permissions);
    if (perms.length === 0) {
        return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('modules.permissions.none')}</p>;
    }

    const { normal, env } = splitEnvPermissions(perms);
    const grantedSet = new Set(granted?.list || []);
    const diffSet = new Set(diff || []);

    return (
        <div className="space-y-3">
            {normal.length > 0 && (
                <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {normal.map((p) => (
                        <PermissionRow key={p.id} perm={p} granted={grantedSet.has(p.id)} isNew={diffSet.has(p.id)} />
                    ))}
                </ul>
            )}
            {env.length > 0 && (
                <div className="rounded-lg border p-3" style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)' }} data-testid="perm-env-section">
                    <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#ef4444' }}>
                        <ServerCrash className="w-3.5 h-3.5" /> {t('modules.permissions.env_section')}
                    </div>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {t('modules.permissions.env_disclaimer')}
                    </p>
                    <ul className="divide-y mt-1" style={{ borderColor: 'var(--border-subtle)' }}>
                        {env.map((p) => (
                            <PermissionRow key={p.id} perm={p} granted={grantedSet.has(p.id)} isNew={diffSet.has(p.id)} />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
