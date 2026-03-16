import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

const SSOConfigPanel = () => {
    const [providers, setProviders] = useState({
        nextcloud: { enabled: false, url: '', clientId: '', clientSecretSet: false },
        google: { enabled: false, clientId: '', clientSecretSet: false },
        microsoft: { enabled: false, clientId: '', clientSecretSet: false, tenantId: 'common' }
    });
    const [secrets, setSecrets] = useState({ nextcloud: '', google: '', microsoft: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState({});
    const [testing, setTesting] = useState({});
    const [message, setMessage] = useState(null);
    const [activeTab, setActiveTab] = useState('nextcloud');

    const navItems = [
        { id: 'nextcloud', label: 'Nextcloud', icon: '☁️', color: '#0082c9' },
        { id: 'google', label: 'Google', icon: '🔍', color: '#4285f4' },
        { id: 'microsoft', label: 'Microsoft', icon: '🪟', color: '#00a4ef' },
    ];

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/providers`);
            if (res.ok) {
                const data = await res.json();
                setProviders(data);
            }
        } catch (e) {
            console.error('Failed to fetch providers:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProvider = async (provider) => {
        setSaving(prev => ({ ...prev, [provider]: true }));
        setMessage(null);

        try {
            const body = {};
            const config = providers[provider];

            if (provider === 'nextcloud') {
                body.url = config.url;
                body.clientId = config.clientId;
                if (secrets.nextcloud) body.clientSecret = secrets.nextcloud;
            } else if (provider === 'google') {
                body.clientId = config.clientId;
                if (secrets.google) body.clientSecret = secrets.google;
            } else if (provider === 'microsoft') {
                body.clientId = config.clientId;
                body.tenantId = config.tenantId;
                if (secrets.microsoft) body.clientSecret = secrets.microsoft;
            }

            const res = await authFetch(`${API_BASE}/auth/providers/${provider}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setSecrets(prev => ({ ...prev, [provider]: '' }));
                fetchProviders();
            } else {
                setMessage({ type: 'error', text: data.error });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save configuration' });
        } finally {
            setSaving(prev => ({ ...prev, [provider]: false }));
        }
    };

    const handleTestProvider = async (provider) => {
        setTesting(prev => ({ ...prev, [provider]: true }));
        setMessage(null);

        try {
            const res = await authFetch(`${API_BASE}/auth/providers/${provider}/test`, {
                method: 'POST',
            });
            const data = await res.json();
            setMessage({ type: res.ok ? 'success' : 'error', text: res.ok ? data.message : data.error });
        } catch (e) {
            setMessage({ type: 'error', text: 'Connection test failed' });
        } finally {
            setTesting(prev => ({ ...prev, [provider]: false }));
        }
    };

    const updateProviderField = (provider, field, value) => {
        setProviders(prev => ({
            ...prev,
            [provider]: { ...prev[provider], [field]: value }
        }));
    };

    if (loading) {
        return (
            <div className="flex h-full border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-muted">Loading...</div>
                </div>
            </div>
        );
    }

    const renderProviderStatus = (provider) => {
        const config = providers[provider];
        return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${config?.enabled ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${config?.enabled ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                {config?.enabled ? 'Active' : 'Not configured'}
            </span>
        );
    };

    return (
        <div className="flex h-full border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
            {/* Left Sidebar */}
            <div className="w-64 flex flex-col p-2 border-r" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="p-4 mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">SSO Providers</h3>
                </div>
                <div className="space-y-1">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setMessage(null); }}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === item.id
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{item.icon}</span>
                                {item.label}
                            </div>
                            {activeTab !== item.id && renderProviderStatus(item.id)}
                        </button>
                    ))}
                </div>

                {/* Overall Status */}
                <div className="mt-auto p-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
                    <p className="text-xs text-muted mb-2">Configured providers</p>
                    <div className="flex gap-2 flex-wrap">
                        {Object.entries(providers).filter(([_, v]) => v.enabled).map(([key]) => (
                            <span key={key} className="px-2 py-1 rounded text-xs bg-green-500/10 text-green-400 capitalize">{key}</span>
                        ))}
                        {!Object.values(providers).some(p => p.enabled) && (
                            <span className="text-xs text-muted">None</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg-primary)]">
                {message && (
                    <div className={`mb-6 p-3 rounded-lg text-sm ${message.type === 'success'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Nextcloud Tab */}
                {activeTab === 'nextcloud' && (
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0, 130, 201, 0.15)' }}>
                                    <svg className="w-7 h-7" style={{ color: '#0082c9' }} fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-primary">Nextcloud OAuth 2.0</h3>
                                    <p className="text-sm text-muted">Allow users to sign in with their Nextcloud account</p>
                                </div>
                                {renderProviderStatus('nextcloud')}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="lg:col-span-2">
                                    <label className="block text-sm font-medium text-secondary mb-2">Nextcloud URL</label>
                                    <input
                                        type="url"
                                        value={providers.nextcloud.url}
                                        onChange={(e) => updateProviderField('nextcloud', 'url', e.target.value)}
                                        placeholder="https://your-nextcloud.com"
                                        className="w-full px-4 py-2.5 rounded-lg text-sm"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">Client ID</label>
                                    <input
                                        type="text"
                                        value={providers.nextcloud.clientId}
                                        onChange={(e) => updateProviderField('nextcloud', 'clientId', e.target.value)}
                                        placeholder="OAuth Client ID"
                                        className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">
                                        Client Secret {providers.nextcloud.clientSecretSet && <span className="text-green-400 text-xs">(configured)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={secrets.nextcloud}
                                        onChange={(e) => setSecrets(prev => ({ ...prev, nextcloud: e.target.value }))}
                                        placeholder={providers.nextcloud.clientSecretSet ? "Leave empty to keep current" : "OAuth Client Secret"}
                                        className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <h4 className="font-semibold text-primary mb-3">📋 Setup Instructions</h4>
                            <ol className="text-sm text-secondary space-y-2 list-decimal list-inside">
                                <li>Go to Nextcloud → Settings → Security → OAuth 2.0 clients</li>
                                <li>Click "Add client" and enter a name (e.g., "Bee Flow")</li>
                                <li>Set the redirect URL to: <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">{window.location.origin}/auth/callback/nextcloud</code></li>
                                <li>Copy the Client ID and Client Secret here</li>
                            </ol>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => handleSaveProvider('nextcloud')} disabled={saving.nextcloud}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-md"
                                style={{ background: 'var(--accent-primary)' }}>
                                {saving.nextcloud ? 'Saving...' : 'Save Configuration'}
                            </button>
                            <button onClick={() => handleTestProvider('nextcloud')} disabled={testing.nextcloud || !providers.nextcloud.url}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium border"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                                {testing.nextcloud ? 'Testing...' : 'Test Connection'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Google Tab */}
                {activeTab === 'google' && (
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(66, 133, 244, 0.15)' }}>
                                    <svg className="w-7 h-7" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-primary">Google OAuth 2.0</h3>
                                    <p className="text-sm text-muted">Allow users to sign in with their Google account</p>
                                </div>
                                {renderProviderStatus('google')}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">Client ID</label>
                                    <input
                                        type="text"
                                        value={providers.google.clientId}
                                        onChange={(e) => updateProviderField('google', 'clientId', e.target.value)}
                                        placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                                        className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">
                                        Client Secret {providers.google.clientSecretSet && <span className="text-green-400 text-xs">(configured)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={secrets.google}
                                        onChange={(e) => setSecrets(prev => ({ ...prev, google: e.target.value }))}
                                        placeholder={providers.google.clientSecretSet ? "Leave empty to keep current" : "OAuth Client Secret"}
                                        className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <h4 className="font-semibold text-primary mb-3">📋 Setup Instructions</h4>
                            <ol className="text-sm text-secondary space-y-2 list-decimal list-inside">
                                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Cloud Console → Credentials</a></li>
                                <li>Create a new OAuth 2.0 Client ID (Web application)</li>
                                <li>Add authorized redirect URI: <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">{window.location.origin}/auth/callback/google</code></li>
                                <li>Copy the Client ID and Client Secret here</li>
                            </ol>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => handleSaveProvider('google')} disabled={saving.google}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-md"
                                style={{ background: 'var(--accent-primary)' }}>
                                {saving.google ? 'Saving...' : 'Save Configuration'}
                            </button>
                            <button onClick={() => handleTestProvider('google')} disabled={testing.google || !providers.google.clientId}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium border"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                                {testing.google ? 'Testing...' : 'Validate Format'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Microsoft Tab */}
                {activeTab === 'microsoft' && (
                    <div className="space-y-6">
                        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0, 164, 239, 0.15)' }}>
                                    <svg className="w-7 h-7" viewBox="0 0 23 23">
                                        <path fill="#f35325" d="M1 1h10v10H1z" />
                                        <path fill="#81bc06" d="M12 1h10v10H12z" />
                                        <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                        <path fill="#ffba08" d="M12 12h10v10H12z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-primary">Microsoft / Azure AD</h3>
                                    <p className="text-sm text-muted">Allow users to sign in with Microsoft accounts</p>
                                </div>
                                {renderProviderStatus('microsoft')}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">Application (Client) ID</label>
                                    <input
                                        type="text"
                                        value={providers.microsoft.clientId}
                                        onChange={(e) => updateProviderField('microsoft', 'clientId', e.target.value)}
                                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                        className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">
                                        Client Secret {providers.microsoft.clientSecretSet && <span className="text-green-400 text-xs">(configured)</span>}
                                    </label>
                                    <input
                                        type="password"
                                        value={secrets.microsoft}
                                        onChange={(e) => setSecrets(prev => ({ ...prev, microsoft: e.target.value }))}
                                        placeholder={providers.microsoft.clientSecretSet ? "Leave empty to keep current" : "Client Secret Value"}
                                        className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="block text-sm font-medium text-secondary mb-2">
                                        Tenant ID <span className="text-muted text-xs">(optional, defaults to "common" for multi-tenant)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={providers.microsoft.tenantId}
                                        onChange={(e) => updateProviderField('microsoft', 'tenantId', e.target.value)}
                                        placeholder="common"
                                        className="w-full px-4 py-2.5 rounded-lg text-sm font-mono"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                    <p className="text-xs text-muted mt-1">Use "common" for any Microsoft account, or your Azure AD tenant ID for organization-only access</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            <h4 className="font-semibold text-primary mb-3">📋 Setup Instructions</h4>
                            <ol className="text-sm text-secondary space-y-2 list-decimal list-inside">
                                <li>Go to <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Azure Portal → App registrations</a></li>
                                <li>Register a new application or select an existing one</li>
                                <li>Add a redirect URI (Web): <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">{window.location.origin}/auth/callback/microsoft</code></li>
                                <li>Create a client secret under "Certificates & secrets"</li>
                                <li>Copy the Application (Client) ID and Secret Value here</li>
                                <li>Under "API permissions", add the following <strong>Microsoft Graph</strong> delegated permissions and grant admin consent: <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">Mail.Read</code>, <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">Mail.Send</code>, <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">Calendars.ReadWrite</code>, <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">Files.ReadWrite</code>, <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">Contacts.ReadWrite</code>, <code className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">offline_access</code></li>
                            </ol>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => handleSaveProvider('microsoft')} disabled={saving.microsoft}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-md"
                                style={{ background: 'var(--accent-primary)' }}>
                                {saving.microsoft ? 'Saving...' : 'Save Configuration'}
                            </button>
                            <button onClick={() => handleTestProvider('microsoft')} disabled={testing.microsoft || !providers.microsoft.clientId}
                                className="px-5 py-2.5 rounded-lg text-sm font-medium border"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                                {testing.microsoft ? 'Testing...' : 'Validate Format'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SSOConfigPanel;
