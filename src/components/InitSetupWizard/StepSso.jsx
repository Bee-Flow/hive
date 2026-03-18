import React from 'react';
import { MicrosoftLogo } from './ProviderLogos';

const StepSso = ({ isAzure, msClientId, setMsClientId, msClientSecret, setMsClientSecret, msTenantId, setMsTenantId, inputClass, inputStyle }) => (
    <>
        <div className="flex items-center gap-3 mb-3">
            <MicrosoftLogo size={28} />
            <div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {isAzure ? 'Azure AD / Entra ID SSO' : 'Microsoft SSO'}
                </span>
                <span className="text-xs px-2 py-0.5 ml-2 rounded-full" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>Optional</span>
            </div>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Enable "Sign in with Microsoft" for your users. Register an app in{' '}
            <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>
                Azure Portal → App Registrations
            </a>.
        </p>
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Application (Client) ID</label>
                <input type="text" value={msClientId} onChange={e => setMsClientId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className={inputClass} style={inputStyle} />
            </div>
            <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Client Secret</label>
                <input type="password" value={msClientSecret} onChange={e => setMsClientSecret(e.target.value)}
                    placeholder="Client secret value"
                    className={inputClass} style={inputStyle} />
            </div>
            <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tenant ID</label>
                <input type="text" value={msTenantId} onChange={e => setMsTenantId(e.target.value)}
                    placeholder="common (multi-tenant) or your tenant GUID"
                    className={inputClass} style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Use <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)' }}>common</code> for multi-tenant, or your specific Azure AD tenant ID.
                </p>
            </div>
        </div>
    </>
);

export default StepSso;
