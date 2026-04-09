import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Loader2, Clock, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { Input, Toggle, SectionCard, StatusBadge } from './components';

export default function SSOSection({ ssoClientId, setSsoClientId, ssoClientSecret, setSsoClientSecret, hasSsoClientSecret, ssoTenantId, setSsoTenantId, autoApproveSSO, setAutoApproveSSO, handleSave, saving, saved, orgId, groupSyncSettings, groupSyncStatus, onSyncSettingsChange, onSyncStatusChange }) {
    const { t } = useTranslation();
    const ssoConfigured = !!(ssoClientId && hasSsoClientSecret);

    // ── Group Sync local state ──
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    const settings = groupSyncSettings || {
        destructiveSync: false,
        autoActivateUsers: true,
        periodicSync: false,
        syncIntervalHours: 6,
    };
    const status = groupSyncStatus || {};

    // ── Sync trigger ──
    const handleSync = async () => {
        if (!orgId || syncing) return;
        setSyncing(true);
        setSyncResult(null);
        setSyncError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/org-azure-config/${orgId}/sync-groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.ok) {
                setSyncResult(data);
                if (onSyncStatusChange) {
                    onSyncStatusChange({
                        lastSyncAt: new Date().toISOString(),
                        lastSyncResult: data.errors?.length > 0 ? 'partial' : 'success',
                        syncedGroups: data.synced?.groups || 0,
                        syncedUsers: data.synced?.users || 0,
                        errors: data.errors || [],
                    });
                }
            } else {
                setSyncError(data.error || 'Sync failed');
            }
        } catch (err) {
            setSyncError(err.message);
        }
        setSyncing(false);
    };

    // ── Save sync setting ──
    const handleSyncSetting = async (key, value) => {
        if (!orgId) return;
        setSavingSettings(true);
        try {
            const res = await authFetch(`${API_BASE}/api/org-azure-config/${orgId}/sync-groups/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value }),
            });
            const data = await res.json();
            if (data.ok && onSyncSettingsChange) {
                onSyncSettingsChange(data.settings);
            }
        } catch (err) {
            console.error('Failed to update sync setting:', err);
        }
        setSavingSettings(false);
    };

    // ── Format relative time ──
    const formatTimeAgo = (isoString) => {
        if (!isoString) return 'Never';
        const dt = new Date(isoString);
        const now = new Date();
        const diffMs = now - dt;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        return `${diffDay}d ago`;
    };

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

            <div className="h-px my-1" style={{ background: 'var(--border-subtle)' }} />

            {/* ═══════════════ AZURE AD GROUP SYNC ═══════════════ */}
            <div className="space-y-4">
                <div>
                    <h4 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {t('azure.sync_groups_title', 'Azure AD Group Sync')}
                    </h4>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {t('azure.sync_groups_desc', 'Automatically sync groups and users assigned to your Azure AD enterprise app to BeeFlow.')}
                    </p>
                </div>

                {/* Sync status card */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
                        background: status.lastSyncResult === 'success' ? 'rgba(34,197,94,0.12)' :
                            status.lastSyncResult === 'partial' ? 'rgba(245,158,11,0.12)' :
                                status.lastSyncResult === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.12)'
                    }}>
                        {status.lastSyncResult === 'success' ? <CheckCircle2 size={18} style={{ color: '#22c55e' }} /> :
                            status.lastSyncResult === 'partial' ? <AlertTriangle size={18} style={{ color: '#f59e0b' }} /> :
                                status.lastSyncResult === 'error' ? <XCircle size={18} style={{ color: '#ef4444' }} /> :
                                    <Clock size={18} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <div className="flex-1">
                        <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                            {status.lastSyncAt
                                ? `${t('azure.sync_last_synced', 'Last synced')}: ${formatTimeAgo(status.lastSyncAt)}`
                                : t('azure.sync_never', 'Never synced')}
                        </p>
                        {status.lastSyncAt && (
                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {status.syncedGroups || 0} group(s), {status.syncedUsers || 0} user(s) synced
                                {settings.periodicSync && ` • Auto-sync every ${settings.syncIntervalHours}h`}
                            </p>
                        )}
                        {settings.periodicSync && status.lastSyncAt && (() => {
                            const nextSyncDate = new Date(new Date(status.lastSyncAt).getTime() + settings.syncIntervalHours * 60 * 60 * 1000);
                            const now = new Date();
                            const diffMs = nextSyncDate - now;
                            const isOverdue = diffMs < 0;
                            const absDiffMin = Math.floor(Math.abs(diffMs) / 60000);
                            const absDiffHr = Math.floor(absDiffMin / 60);
                            const remainingMin = absDiffMin % 60;

                            let timeLabel;
                            if (isOverdue) {
                                timeLabel = t('azure.sync_overdue', 'Overdue');
                            } else if (absDiffMin < 1) {
                                timeLabel = t('azure.sync_next_imminent', 'Any moment');
                            } else if (absDiffHr < 1) {
                                timeLabel = `${absDiffMin}m`;
                            } else {
                                timeLabel = remainingMin > 0 ? `${absDiffHr}h ${remainingMin}m` : `${absDiffHr}h`;
                            }

                            return (
                                <p className="text-[11px] flex items-center gap-1" style={{ color: isOverdue ? '#f59e0b' : '#22c55e' }}>
                                    <Clock size={10} />
                                    {t('azure.sync_next', 'Next sync')}: {timeLabel}
                                </p>
                            );
                        })()}
                    </div>

                    {/* Sync button */}
                    <button
                        onClick={handleSync}
                        disabled={syncing || !ssoConfigured}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                        style={{
                            background: ssoConfigured ? '#0078D4' : 'var(--bg-tertiary)',
                            color: ssoConfigured ? '#fff' : 'var(--text-muted)',
                            opacity: syncing ? 0.7 : 1,
                            cursor: ssoConfigured ? 'pointer' : 'not-allowed',
                        }}
                    >
                        {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        {syncing ? t('azure.sync_syncing', 'Syncing...') : t('azure.sync_groups_button', 'Sync Now')}
                    </button>
                </div>

                {/* Sync result or error */}
                {syncResult && (
                    <div className="rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                        <div
                            className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer"
                            style={{ background: 'rgba(34,197,94,0.06)' }}
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
                            <span className="text-[12px] font-medium flex-1" style={{ color: '#166534' }}>
                                {t('azure.sync_groups_success', 'Sync completed')}: {syncResult.synced?.groups || 0} group(s), {syncResult.synced?.users || 0} new user(s)
                            </span>
                            {showDetails ? <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />}
                        </div>
                        {showDetails && syncResult.details && (
                            <div className="px-3.5 py-2.5 text-[11px] font-mono space-y-0.5 max-h-[200px] overflow-y-auto" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
                                {syncResult.details.map((d, i) => <div key={i}>{d}</div>)}
                            </div>
                        )}
                    </div>
                )}

                {syncError && (
                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg text-[12px]" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <XCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                        <div>
                            <p className="font-medium" style={{ color: '#b91c1c' }}>{t('azure.sync_groups_error', 'Sync failed')}</p>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{syncError}</p>
                        </div>
                    </div>
                )}

                {/* Not configured hint */}
                {!ssoConfigured && (
                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg text-[12px]" style={{ background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.15)' }}>
                        <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>
                            {t('azure.sync_requires_sso', 'Configure Microsoft SSO credentials above before using group sync.')}
                        </p>
                    </div>
                )}

                {/* ── Sync Settings Toggles ── */}
                {ssoConfigured && (
                    <div className="space-y-3 rounded-lg px-4 py-3" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            {t('azure.sync_settings', 'Sync Settings')}
                        </p>

                        {/* Auto-activate users */}
                        <Toggle
                            checked={settings.autoActivateUsers}
                            onChange={(val) => handleSyncSetting('autoActivateUsers', val)}
                            label={t('azure.sync_auto_activate', 'Auto-activate synced users')}
                            description={t('azure.sync_auto_activate_desc', 'When enabled, new users from Azure groups are immediately active. When disabled, they require admin approval.')}
                        />

                        {/* Destructive sync */}
                        <Toggle
                            checked={settings.destructiveSync}
                            onChange={(val) => handleSyncSetting('destructiveSync', val)}
                            label={t('azure.sync_destructive', 'Destructive sync')}
                            description={t('azure.sync_destructive_desc', 'Remove groups and group memberships from BeeFlow when they are no longer assigned in Azure AD.')}
                        />
                        {settings.destructiveSync && (
                            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg text-[11px] ml-[48px]" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                                <p style={{ color: '#b91c1c' }}>
                                    {t('azure.sync_destructive_warning', 'Warning: This will remove users from BeeFlow groups and delete Azure-synced groups that are no longer assigned to the enterprise app.')}
                                </p>
                            </div>
                        )}

                        {/* Periodic sync */}
                        <Toggle
                            checked={settings.periodicSync}
                            onChange={(val) => handleSyncSetting('periodicSync', val)}
                            label={t('azure.sync_periodic', 'Automatic periodic sync')}
                            description={t('azure.sync_periodic_desc', 'Automatically sync groups from Azure AD at a regular interval.')}
                        />
                        {settings.periodicSync && (
                            <div className="flex items-center gap-2 ml-[48px]">
                                <label className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                    {t('azure.sync_interval', 'Sync every')}
                                </label>
                                <select
                                    value={settings.syncIntervalHours}
                                    onChange={(e) => handleSyncSetting('syncIntervalHours', parseInt(e.target.value, 10))}
                                    className="px-2 py-1 rounded-lg border text-[12px] outline-none"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                >
                                    <option value={1}>1 hour</option>
                                    <option value={3}>3 hours</option>
                                    <option value={6}>6 hours</option>
                                    <option value={12}>12 hours</option>
                                    <option value={24}>24 hours</option>
                                    <option value={48}>48 hours</option>
                                    <option value={168}>Weekly</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}

                {/* Azure permissions info */}
                {ssoConfigured && (
                    <div className="rounded-lg px-4 py-3 space-y-1.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                        <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                            {t('azure.sync_permissions_title', 'Required Azure Permissions')}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {t('azure.sync_permissions_desc', 'The following Application permissions must be granted in Azure Portal → App registrations → API permissions, with admin consent:')}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {['GroupMember.Read.All', 'User.Read.All', 'Application.Read.All'].map(perm => (
                                <span key={perm} className="px-2 py-0.5 rounded text-[10px] font-mono" style={{ background: 'rgba(0,120,212,0.08)', color: '#0078D4', border: '1px solid rgba(0,120,212,0.2)' }}>
                                    {perm}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="h-px my-1" style={{ background: 'var(--border-subtle)' }} />

            {/* Setup guide */}
            <div className="rounded-lg px-4 py-3 space-y-1.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{t('azure.sso_setup_guide')}</p>
                <ol className="text-[11px] space-y-1 list-decimal list-inside" style={{ color: 'var(--text-muted)' }}>
                    <li>{t('azure.sso_step_1')} <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#0078D4' }}>Azure Portal → App registrations</a></li>
                    <li>{t('azure.sso_step_2')}</li>
                    <li>Under <strong>Authentication</strong>, add a redirect URI: <code style={{ background: 'var(--bg-tertiary)', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>https://your-domain/auth/callback/microsoft</code></li>
                    <li>{t('azure.sso_step_4')}</li>
                    <li>{t('azure.sso_step_5')}</li>
                    <li>{t('azure.sso_step_6', 'Under API permissions, add Application permissions: GroupMember.Read.All, User.Read.All, Application.Read.All and grant admin consent')}</li>
                </ol>
            </div>
        </SectionCard>
    );
}
