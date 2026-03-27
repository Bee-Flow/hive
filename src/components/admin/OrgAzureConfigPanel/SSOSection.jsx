import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Input, Toggle, SectionCard, StatusBadge } from './components';

export default function SSOSection({ ssoClientId, setSsoClientId, ssoClientSecret, setSsoClientSecret, hasSsoClientSecret, ssoTenantId, setSsoTenantId, autoApproveSSO, setAutoApproveSSO, handleSave, saving, saved }) {
    const { t } = useTranslation();
    const ssoConfigured = !!(ssoClientId && hasSsoClientSecret);

    return (
        <SectionCard
            title={t('azure.sso_title')}
            description={t('azure.sso_section_desc')}
            onSave={() => handleSave('sso', { ssoClientId, ssoClientSecret: ssoClientSecret || undefined, ssoTenantId, autoApproveSSO })}
            saving={saving}
            saved={saved}
        >
            {/* Status overview */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: 'rgba(0,164,239,0.15)' }}>
                    🪟
                </div>
                <div className="flex-1">
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{t('azure.sso_status')}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {ssoConfigured ? t('azure.sso_configured_desc') : t('azure.sso_not_configured_desc')}
                    </p>
                </div>
                <StatusBadge configured={ssoConfigured} />
            </div>

            {/* Warning: Impact of misconfiguration */}
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg text-[12px]" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                <div style={{ color: '#b91c1c' }}>
                    <p className="font-semibold mb-1">{t('azure.sso_warning_title')}</p>
                    <ul className="space-y-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        <li>• {t('azure.sso_warning_client')}</li>
                        <li>• {t('azure.sso_warning_tenant')}</li>
                        <li>• {t('azure.sso_warning_remove')}</li>
                    </ul>
                </div>
            </div>

            {/* Credentials */}
            <Input
                label={t('azure.sso_client_id')}
                value={ssoClientId}
                onChange={setSsoClientId}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                helpText={t('azure.sso_client_id_help')}
            />
            <Input
                label={t('azure.sso_client_secret')}
                type="password"
                value={ssoClientSecret}
                onChange={setSsoClientSecret}
                placeholder={hasSsoClientSecret ? '••••••••••••' : 'Enter client secret value'}
                helpText={hasSsoClientSecret ? t('azure.sso_client_secret_help_set') : t('azure.sso_client_secret_help_empty')}
            />

            {/* Tenant ID */}
            <div className="space-y-1.5">
                <label className="block text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {t('azure.sso_tenant_id')}
                </label>
                <input
                    type="text"
                    value={ssoTenantId}
                    onChange={e => setSsoTenantId(e.target.value)}
                    placeholder="your-tenant-guid or common"
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] transition-colors focus:ring-2 focus:ring-blue-500/20"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {t('azure.sso_tenant_help').replace('{code}', '')}
                    <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>common</code>
                    {' '}{t('azure.sso_tenant_help').split('{code}')[1] || ''}
                </p>
            </div>

            {/* Warning: Tenant ID = common */}
            {(ssoTenantId === 'common' || ssoTenantId === '') && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg text-[12px]" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                    <div style={{ color: '#92400e' }}>
                        <p className="font-semibold mb-0.5">{t('azure.sso_tenant_common_title')}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {t('azure.sso_tenant_common_desc')}
                        </p>
                    </div>
                </div>
            )}

            <div className="h-px my-1" style={{ background: 'var(--border-subtle)' }} />

            {/* Auto-approve toggle */}
            <div className="space-y-2">
                <Toggle
                    checked={autoApproveSSO}
                    onChange={setAutoApproveSSO}
                    label={t('azure.sso_auto_approve')}
                    description={t('azure.sso_auto_approve_desc')}
                />
                {autoApproveSSO && (
                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg text-[12px] ml-[48px]" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                        <p style={{ color: '#92400e' }}>{t('azure.sso_auto_approve_warning')}</p>
                    </div>
                )}
            </div>

            {/* Setup guide */}
            <div className="rounded-lg px-4 py-3 space-y-1.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{t('azure.sso_setup_guide')}</p>
                <ol className="text-[11px] space-y-1 list-decimal list-inside" style={{ color: 'var(--text-muted)' }}>
                    <li>{t('azure.sso_step_1')} <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#0078D4' }}>Azure Portal → App registrations</a></li>
                    <li>{t('azure.sso_step_2')}</li>
                    <li>Under <strong>Authentication</strong>, add a redirect URI: <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>https://your-domain/auth/callback/microsoft</code></li>
                    <li>{t('azure.sso_step_4')}</li>
                    <li>{t('azure.sso_step_5')}</li>
                </ol>
            </div>
        </SectionCard>
    );
}
