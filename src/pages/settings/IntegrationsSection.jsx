import React, { useState } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import N8nSection from './N8nSection';

// ── Shared UI helpers ─────────────────────────────────────────────────────────
// Pull translations from the hook directly so parents don't have to thread `t`
// through. Historically callers forgot to pass t={t}, causing render-time
// crashes ("TypeError: t is not a function") the moment an integration was
// connected and this badge actually rendered.
const ConnectedBadge = () => {
    const { t } = useTranslation();
    return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
            {t('settings.connected')}
        </span>
    );
};

const GroupLabel = ({ children }) => (
    <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
        {children}
    </p>
);

// ── Integration row (expands inline) ─────────────────────────────────────────
const IntegrationRow = ({ icon, name, description, connected, badge, children, last = false }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{ borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
            <button
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                style={{ background: 'var(--bg-secondary)' }}
                onClick={() => setExpanded(v => !v)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            >
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-black">{name}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {connected ? <ConnectedBadge /> : badge || null}
                    <svg
                        className="transition-transform"
                        style={{ color: 'var(--text-muted)', width: '13px', height: '13px', transform: expanded ? 'rotate(90deg)' : 'none' }}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </button>

            {expanded && (
                <div className="px-5 pb-4 pt-2 space-y-3" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

// ── Field helpers ─────────────────────────────────────────────────────────────
const ApiKeyField = ({ placeholder, value, onChange, onSave, saving, hint, t }) => (
    <div>
        <div className="flex gap-2">
            <input
                type="password"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                onKeyDown={e => e.key === 'Enter' && value.trim() && onSave()}
            />
            <button
                onClick={onSave}
                disabled={saving || !value.trim()}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--accent-primary)' }}
            >
                {saving ? '…' : (t ? t('settings.save') : 'Save')}
            </button>
        </div>
        {hint && <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
);

const DisconnectButton = ({ onDisconnect, disconnecting, t }) => (
    <button
        onClick={onDisconnect}
        disabled={disconnecting}
        className="px-4 py-2 rounded-lg text-[13px] font-medium transition-opacity disabled:opacity-50"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
    >
        {disconnecting ? '…' : (t ? t('settings.disconnect') : 'Disconnect')}
    </button>
);

// ── Fireflies ─────────────────────────────────────────────────────────────────
const FirefliesIntegration = ({ hasFirefliesKey, onSaved, last }) => {
    const { t } = useTranslation();
    const [key, setKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const save = async () => {
        if (!key.trim()) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firefliesApiKey: key }),
            });
            if (res.ok) { onSaved(); setKey(''); }
        } catch (e) { console.error(e); }
        setSaving(false);
    };
    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firefliesApiKey: '' }),
            });
            if (res.ok) onSaved();
        } catch (e) { console.error(e); }
        setDisconnecting(false);
    };
    return (
        <IntegrationRow
            last={last}
            connected={hasFirefliesKey}
            name="Fireflies.ai"
            description={hasFirefliesKey ? t('integ.fireflies_connected') : t('integ.fireflies_desc')}
            icon={<svg viewBox="22 20 24 24" fill="none" style={{ width: '18px', height: '18px' }}><path d="M30.5749 22H24V28.5267H30.5749V22Z" fill="url(#ffs_g1)" /><path d="M38.3633 29.8789H31.7883V36.4056H38.3633V29.8789Z" fill="url(#ffs_g2)" /><path d="M38.3633 22H31.7883V28.5267H43.9998V27.594C43.9997 26.1104 43.4058 24.6875 42.3489 23.6384C41.2919 22.5894 39.8585 22 38.3638 22H38.3633Z" fill="url(#ffs_g3)" /><path d="M24 29.8789V36.4056C24.0002 37.8892 24.594 39.3121 25.6509 40.3612C26.7079 41.4103 28.1413 41.9996 29.636 41.9996H30.5749V29.8789H24Z" fill="url(#ffs_g4)" /><defs><linearGradient id="ffs_g1" x1="40.08" y1="38.51" x2="12.44" y2="9.47" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ffs_g2" x1="40.18" y1="38.42" x2="12.54" y2="9.38" gradientUnits="userSpaceOnUse"><stop stopColor="#FF3C82" /><stop offset="0.49" stopColor="#B251B2" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ffs_g3" x1="44.77" y1="34.05" x2="35.4" y2="0.12" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ffs_g4" x1="35.55" y1="42.82" x2="2.03" y2="32.61" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient></defs></svg>}
        >
            <ApiKeyField
                placeholder={hasFirefliesKey ? '••••••••••••••••' : 'Enter your Fireflies.ai API key'}
                value={key} onChange={e => setKey(e.target.value)} onSave={save} saving={saving}
                hint={<>Get your key from <a href="https://app.fireflies.ai/integrations/custom/fireflies" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">app.fireflies.ai</a></>}
            />
            {hasFirefliesKey && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
        </IntegrationRow>
    );
};

// ── YouTrack ──────────────────────────────────────────────────────────────────
const YouTrackIntegration = ({ hasYouTrackConfig, onSaved, last }) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [token, setToken] = useState('');
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const save = async () => {
        if (!url.trim() && !token.trim()) return;
        setSaving(true);
        try {
            const body = {};
            if (url.trim()) body.youtrackUrl = url.replace(/\/+$/, '');
            if (token.trim()) body.youtrackToken = token;
            const res = await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) { onSaved(); setUrl(''); setToken(''); }
        } catch (e) { console.error(e); }
        setSaving(false);
    };
    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtrackUrl: '', youtrackToken: '' }),
            });
            if (res.ok) { onSaved(); setUrl(''); setToken(''); }
        } catch (e) { console.error(e); }
        setDisconnecting(false);
    };
    return (
        <IntegrationRow
            last={last}
            connected={hasYouTrackConfig}
            name="YouTrack"
            description={hasYouTrackConfig ? t('integ.youtrack_connected') : t('integ.youtrack_desc')}
            icon={<svg viewBox="0 0 70 70" fill="none" style={{ width: '22px', height: '22px' }}><defs><linearGradient id="yt_g1" x1="12" y1="58" x2="58" y2="12" gradientUnits="userSpaceOnUse"><stop stopColor="#FC3791" /><stop offset="0.52" stopColor="#9B4AB0" /><stop offset="1" stopColor="#6166E8" /></linearGradient></defs><rect width="70" height="70" rx="14" fill="url(#yt_g1)" /><path d="M16 18h38v34H16z" fill="white" fillOpacity="0.9" /><path d="M20 25h20v3H20zM20 32h28v3H20zM20 39h14v3H20z" fill="url(#yt_g1)" /></svg>}
        >
            <div className="space-y-2">
                <input type="text" value={url} onChange={e => setUrl(e.target.value)}
                    placeholder={hasYouTrackConfig ? '••••••••••••••••' : 'https://your-instance.youtrack.cloud'}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                <ApiKeyField
                    placeholder={hasYouTrackConfig ? '••••••••••••••••' : 'Permanent token'}
                    value={token} onChange={e => setToken(e.target.value)} onSave={save} saving={saving}
                    hint={<>Token from <a href="https://www.jetbrains.com/help/youtrack/server/manage-permanent-token.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">YouTrack → Profile → Authentication</a></>}
                />
                {hasYouTrackConfig && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
            </div>
        </IntegrationRow>
    );
};

// ── SignRequest ───────────────────────────────────────────────────────────────
const SignRequestIntegration = ({ hasSignRequestConfig, onSaved, last }) => {
    const { t } = useTranslation();
    const [subdomain, setSubdomain] = useState('');
    const [token, setToken] = useState('');
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const save = async () => {
        if (!subdomain.trim() && !token.trim()) return;
        setSaving(true);
        try {
            const body = {};
            if (subdomain.trim()) body.signrequestSubdomain = subdomain.trim();
            if (token.trim()) body.signrequestToken = token;
            const res = await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) { onSaved(); setSubdomain(''); setToken(''); }
        } catch (e) { console.error(e); }
        setSaving(false);
    };
    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signrequestSubdomain: '', signrequestToken: '' }),
            });
            if (res.ok) { onSaved(); setSubdomain(''); setToken(''); }
        } catch (e) { console.error(e); }
        setDisconnecting(false);
    };
    return (
        <IntegrationRow
            last={last}
            connected={hasSignRequestConfig}
            name="SignRequest"
            description={hasSignRequestConfig ? t('integ.signrequest_connected') : t('integ.signrequest_desc')}
            icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '20px', height: '20px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="url(#sr_g)" /><path d="M7 14.5c0-1 .8-2 2.5-2 1.5 0 2.2.7 3 1.2.8.5 1.5 1.3 3 1.3 1.5 0 2.5-1 2.5-2" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" /><path d="M8 8h8M8 11h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" /><defs><linearGradient id="sr_g" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#22c55e" /><stop offset="1" stopColor="#16a34a" /></linearGradient></defs></svg>}
        >
            <div className="space-y-2">
                <input type="text" value={subdomain} onChange={e => setSubdomain(e.target.value)}
                    placeholder={hasSignRequestConfig ? '••••••••••••••••' : 'your-team (team subdomain)'}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                <ApiKeyField
                    placeholder={hasSignRequestConfig ? '••••••••••••••••' : 'API Token'}
                    value={token} onChange={e => setToken(e.target.value)} onSave={save} saving={saving}
                    hint={<>Get your token from <a href="https://signrequest.com/api/v1/api-docs/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">SignRequest → API Settings</a>. Use your sandbox team subdomain for testing.</>}
                />
                {hasSignRequestConfig && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
            </div>
        </IntegrationRow>
    );
};

// ── Gamma ─────────────────────────────────────────────────────────────────────
const GammaIntegration = ({ hasGammaKey, onSaved, last }) => {
    const { t } = useTranslation();
    const [key, setKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const save = async () => {
        if (!key.trim()) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gammaApiKey: key }),
            });
            if (res.ok) { onSaved(); setKey(''); }
        } catch (e) { console.error(e); }
        setSaving(false);
    };
    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gammaApiKey: '' }),
            });
            if (res.ok) onSaved();
        } catch (e) { console.error(e); }
        setDisconnecting(false);
    };
    return (
        <IntegrationRow
            last={last}
            connected={hasGammaKey}
            name="Gamma"
            description={hasGammaKey ? t('integ.gamma_connected') : t('integ.gamma_desc')}
            icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '20px', height: '20px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="url(#gamma_g)" /><path d="M7 8h10v1.5H7zM7 12h8v1.5H7zM7 16h5v1.5H7z" fill="white" fillOpacity="0.9" /><defs><linearGradient id="gamma_g" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#A855F7" /></linearGradient></defs></svg>}
        >
            <ApiKeyField
                placeholder={hasGammaKey ? '••••••••••••••••' : 'Enter your Gamma API key'}
                value={key} onChange={e => setKey(e.target.value)} onSave={save} saving={saving}
                hint={<>Get key from <a href="https://gamma.app/settings" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">gamma.app/settings</a> → API Tokens</>}
            />
            {hasGammaKey && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
        </IntegrationRow>
    );
};

// ── LinkedIn ──────────────────────────────────────────────────────────────────
const LinkedInIntegration = ({ connected, linkedInName, hasLinkedInConfig, onSaved, last }) => {
    const { t } = useTranslation();
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    React.useEffect(() => {
        const handler = (e) => { if (e.data?.type === 'linkedin-callback' && e.data?.success) onSaved(); };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onSaved]);
    const handleConnect = async () => {
        setConnecting(true);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/linkedin/auth-url`);
            if (res.ok) {
                const { url } = await res.json();
                const [w, h] = [600, 700];
                window.open(url, 'linkedin-oauth', `width=${w},height=${h},left=${(screen.width - w) / 2},top=${(screen.height - h) / 2}`);
            }
        } catch (e) { console.error(e); }
        setConnecting(false);
    };
    const handleDisconnect = async () => {
        setDisconnecting(true);
        try { await authFetch(`${API_BASE}/api/integrations/linkedin/disconnect`, { method: 'POST' }); onSaved(); }
        catch (e) { console.error(e); }
        setDisconnecting(false);
    };
    return (
        <IntegrationRow
            last={last}
            connected={connected}
            name="LinkedIn"
            description={connected ? (linkedInName ? t('integ.linkedin_connected_as', { name: linkedInName }) : t('integ.linkedin_connected')) : t('integ.linkedin_desc')}
            icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '20px', height: '20px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" /><path d="M7.5 9.5h2v7h-2v-7zm1-3.2a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm3.5 3.2h1.9v1h0c.27-.5.92-1.1 1.9-1.1 2 0 2.4 1.3 2.4 3.1v3.6h-2v-3.2c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.7v3.3h-2v-6.6z" fill="white" /></svg>}
        >
            {!hasLinkedInConfig && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('integ.linkedin_not_configured')}</p>}
            {hasLinkedInConfig && !connected && (
                <button onClick={handleConnect} disabled={connecting} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ background: '#0A66C2' }}>
                    {connecting ? t('integ.linkedin_opening') : t('integ.linkedin_connect')}
                </button>
            )}
            {connected && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
        </IntegrationRow>
    );
};

// ── GitHub ────────────────────────────────────────────────────────────────────
const GitHubIntegration = ({ onSaved, last }) => {
    const { t } = useTranslation();
    const [token, setToken] = useState('');
    const [saving, setSaving] = useState(false);
    const [connected, setConnected] = useState(false);
    const [username, setUsername] = useState(null);
    const [disconnecting, setDisconnecting] = useState(false);
    React.useEffect(() => { checkStatus(); }, []);
    const checkStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github/status`);
            if (res.ok) { const data = await res.json(); setConnected(data.connected); setUsername(data.username); }
        } catch { /* ignore */ }
    };
    const save = async () => {
        if (!token.trim()) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github/connect`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token.trim() }),
            });
            if (res.ok) { const data = await res.json(); setConnected(true); setUsername(data.username); setToken(''); onSaved?.(); }
            else { const err = await res.json().catch(() => ({})); alert(err.error || 'Failed to connect'); }
        } catch (e) { console.error(e); }
        setSaving(false);
    };
    const handleDisconnect = async () => {
        setDisconnecting(true);
        try { await authFetch(`${API_BASE}/api/integrations/github/disconnect`, { method: 'POST' }); setConnected(false); setUsername(null); onSaved?.(); }
        catch (e) { console.error(e); }
        setDisconnecting(false);
    };
    return (
        <IntegrationRow
            last={last}
            connected={connected}
            name="GitHub"
            description={connected ? t('integ.github_connected', { username: username || 'user' }) : t('integ.github_desc')}
            icon={<svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px', color: 'var(--text-primary)' }}><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>}
        >
            {!connected ? (
                <ApiKeyField
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={token} onChange={e => setToken(e.target.value)} onSave={save} saving={saving}
                    hint={<>Create token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">github.com/settings/tokens</a> with <strong>repo</strong> scope</>}
                />
            ) : (
                <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />
            )}
        </IntegrationRow>
    );
};

// ── Nextcloud ─────────────────────────────────────────────────────────────────
// Stores a username + app password used by Nextcloud-aware components for
// WebDAV / OCS Basic auth. Manually-generated app passwords (Nextcloud
// Settings → Security → Devices & sessions) are recommended over OAuth-minted
// ones, which inherit the access-token TTL (~10 min).
const NextcloudIntegration = ({ hasNextcloudAppPassword, isNextcloudUser, isConnectorUser, nextcloudUrl: savedNextcloudUrl, onSaved, last }) => {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [url, setUrl] = useState(savedNextcloudUrl || '');
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [autoCreating, setAutoCreating] = useState(false);
    const [notice, setNotice] = useState(null);

    // Keep the URL field in sync once the saved value arrives (status loads after mount)
    // and after a save re-fetches it. Username/password stay blank — they're write-only.
    React.useEffect(() => { setUrl(savedNextcloudUrl || ''); }, [savedNextcloudUrl]);

    // When the user signs into Bee Flow via the Nextcloud ExApp connector,
    // every NC call is proxied back through the connector with AppAPI
    // shared-secret + impersonation. There's no app password to enter and
    // nothing the user can disconnect — the binding lives on the org level.
    if (isConnectorUser) {
        return (
            <IntegrationRow
                last={last}
                connected
                name="Nextcloud"
                description="Connected via Bee Flow Nextcloud connector — files, calendar, mail and more are available to agents automatically. No app password needed."
                icon={<svg viewBox="0 0 32 32" fill="none" style={{ width: '20px', height: '20px' }}><circle cx="16" cy="16" r="16" fill="#0082C9" /><path d="M11.5 11.2c-2 0-3.7 1.4-4.2 3.3a3.5 3.5 0 1 0 0 3 4.4 4.4 0 0 0 7 1.7l1.5-1.4 1.6 1.4a4.4 4.4 0 0 0 7-1.7 3.5 3.5 0 1 0 0-3 4.4 4.4 0 0 0-7-1.7l-1.6 1.4-1.5-1.4a4.4 4.4 0 0 0-2.8-1.6zm0 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm9 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z" fill="white" /></svg>}
            />
        );
    }

    const save = async () => {
        if (!username.trim() || !password.trim()) return;
        setSaving(true); setNotice(null);
        try {
            const res = await authFetch(`${API_BASE}/auth/save-app-password`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password: password.trim(), url: url.trim() }),
            });
            if (res.ok) { onSaved(); setUsername(''); setPassword(''); }
            else { const err = await res.json().catch(() => ({})); setNotice(err.error || 'Failed to save'); }
        } catch (e) { console.error(e); setNotice(e.message); }
        setSaving(false);
    };

    const autoCreate = async () => {
        setAutoCreating(true); setNotice(null);
        try {
            const res = await authFetch(`${API_BASE}/auth/create-app-password`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                onSaved();
                if (data.warning) setNotice(data.warning);
            } else {
                setNotice(data.error || 'Failed to create app password');
            }
        } catch (e) { console.error(e); setNotice(e.message); }
        setAutoCreating(false);
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/app-password`, { method: 'DELETE' });
            if (res.ok) onSaved();
        } catch (e) { console.error(e); }
        setDisconnecting(false);
    };

    return (
        <IntegrationRow
            last={last}
            connected={hasNextcloudAppPassword}
            name="Nextcloud"
            description={hasNextcloudAppPassword ? 'App password saved — files & WebDAV available to agents' : 'Connect Nextcloud for file/WebDAV access in chat'}
            icon={<svg viewBox="0 0 32 32" fill="none" style={{ width: '20px', height: '20px' }}><circle cx="16" cy="16" r="16" fill="#0082C9" /><path d="M11.5 11.2c-2 0-3.7 1.4-4.2 3.3a3.5 3.5 0 1 0 0 3 4.4 4.4 0 0 0 7 1.7l1.5-1.4 1.6 1.4a4.4 4.4 0 0 0 7-1.7 3.5 3.5 0 1 0 0-3 4.4 4.4 0 0 0-7-1.7l-1.6 1.4-1.5-1.4a4.4 4.4 0 0 0-2.8-1.6zm0 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm9 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z" fill="white" /></svg>}
        >
            <div className="space-y-2">
                <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="Nextcloud URL (e.g. https://cloud.example.com)"
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder={hasNextcloudAppPassword ? '••••••••' : 'Nextcloud username (uid)'}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <ApiKeyField
                    placeholder={hasNextcloudAppPassword ? '••••••••••••••••' : 'App password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onSave={save}
                    saving={saving}
                    hint={<>Generate at <strong>Nextcloud → Settings → Security → Devices &amp; sessions</strong>. App passwords created here last indefinitely; auto-creation via OAuth is short-lived.</>}
                    t={t}
                />
                {isNextcloudUser && (
                    <button
                        onClick={autoCreate}
                        disabled={autoCreating}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                    >
                        {autoCreating ? '…' : 'Auto-create from OAuth session (short-lived)'}
                    </button>
                )}
                {notice && (
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{notice}</p>
                )}
                {hasNextcloudAppPassword && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} t={t} />}
            </div>
        </IntegrationRow>
    );
};

// ── MCP Servers ───────────────────────────────────────────────────────────────
const McpCredentialsSection = ({ onSaved }) => {
    const { t } = useTranslation();
    const [mcpServers, setMcpServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [credValues, setCredValues] = useState({});
    const [saving, setSaving] = useState(null);
    React.useEffect(() => { loadMcpServers(); }, []);
    const loadMcpServers = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/mcp-servers/user-credentials`);
            if (res.ok) { const data = await res.json(); setMcpServers(data.servers || []); }
        } catch { /* ignore */ }
        setLoading(false);
    };
    const saveCred = async (serverId, credKey) => {
        const stateKey = `${serverId}:${credKey}`;
        const value = credValues[stateKey];
        if (!value?.trim()) return;
        setSaving(stateKey);
        try {
            const res = await authFetch(`${API_BASE}/ai/mcp-servers/user-credentials`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId, credKey, value: value.trim() }),
            });
            if (res.ok) { setCredValues(prev => ({ ...prev, [stateKey]: '' })); loadMcpServers(); onSaved?.(); }
        } catch (e) { console.error(e); }
        setSaving(null);
    };
    if (loading || mcpServers.length === 0) return null;
    return (
        <>
            {mcpServers.map((server, si) => (
                <IntegrationRow
                    key={server.id}
                    last={si === mcpServers.length - 1}
                    connected={server.allConfigured}
                    name={server.name}
                    description={server.allConfigured ? t('integ.mcp_connected', { toolCount: server.toolCount }) : t('integ.mcp_desc', { toolCount: server.toolCount })}
                    icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '18px', height: '18px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="url(#mcp_g)" /><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" strokeLinecap="round" /><defs><linearGradient id="mcp_g" x1="2" y1="2" x2="22" y2="22"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs></svg>}
                >
                    <div className="space-y-2">
                        {server.credentials.map(cred => {
                            const stateKey = `${server.id}:${cred.key}`;
                            return (
                                <div key={cred.key}>
                                    <ApiKeyField
                                        placeholder={cred.configured ? '••••••••••••••••' : `Enter ${cred.label || cred.key}`}
                                        value={credValues[stateKey] || ''}
                                        onChange={e => setCredValues(prev => ({ ...prev, [stateKey]: e.target.value }))}
                                        onSave={() => saveCred(server.id, cred.key)}
                                        saving={saving === stateKey}
                                    />
                                    {cred.configured && <p className="text-[10px] mt-0.5" style={{ color: '#4ade80' }}>✓ Configured{cred.description ? ` — ${cred.description}` : ''}</p>}
                                </div>
                            );
                        })}
                    </div>
                </IntegrationRow>
            ))}
        </>
    );
};

// ── IntegrationsSection ───────────────────────────────────────────────────────
const IntegrationsSection = ({ statuses, onSaved, enabledIntegrations, isOrgAdmin, user, showOrgIntegrations = false }) => {
    const { t } = useTranslation();
    const isEnabled = (id) => !enabledIntegrations || enabledIntegrations.includes(id);

    const showFireflies = isEnabled('fireflies');
    const showYouTrack = isEnabled('youtrack');
    const showSignRequest = isEnabled('signrequest');
    const showGamma = isEnabled('gamma');
    const showLinkedIn = isEnabled('linkedin');
    const showGitHub = isEnabled('github');
    const showNextcloud = isEnabled('nextcloud');
    const showMcp = !enabledIntegrations || enabledIntegrations.some(id => id.startsWith('mcp:'));

    const productivityItems = [showFireflies, showYouTrack, showSignRequest, showGamma, showNextcloud].filter(Boolean).length;
    const socialItems = [showLinkedIn].filter(Boolean).length;
    const devItems = [showGitHub].filter(Boolean).length;

    return (
        <div className="space-y-6">
            {/* Productivity */}
            {productivityItems > 0 && (
                <div className="space-y-1.5">
                    <GroupLabel>{t('settings.integrations_productivity')}</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        {showFireflies && <FirefliesIntegration hasFirefliesKey={statuses.hasFirefliesKey} onSaved={() => onSaved('fireflies')} last={!showYouTrack && !showSignRequest && !showGamma && !showNextcloud} />}
                        {showYouTrack && <YouTrackIntegration hasYouTrackConfig={statuses.hasYouTrackConfig} onSaved={() => onSaved('youtrack')} last={!showSignRequest && !showGamma && !showNextcloud} />}
                        {showSignRequest && <SignRequestIntegration hasSignRequestConfig={statuses.hasSignRequestConfig} onSaved={() => onSaved('signrequest')} last={!showGamma && !showNextcloud} />}
                        {showGamma && <GammaIntegration hasGammaKey={statuses.hasGammaKey} onSaved={() => onSaved('gamma')} last={!showNextcloud} />}
                        {showNextcloud && <NextcloudIntegration hasNextcloudAppPassword={statuses.hasNextcloudAppPassword} isNextcloudUser={statuses.isNextcloudUser} isConnectorUser={user?.provider === 'nextcloud_connector'} nextcloudUrl={statuses.nextcloudUrl} onSaved={() => onSaved('nextcloud')} last />}
                    </div>
                </div>
            )}

            {/* Social */}
            {socialItems > 0 && (
                <div className="space-y-1.5">
                    <GroupLabel>{t('settings.integrations_social')}</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        {showLinkedIn && <LinkedInIntegration connected={statuses.linkedInConnected} linkedInName={statuses.linkedInName} hasLinkedInConfig={statuses.hasLinkedInConfig} onSaved={() => onSaved('linkedin')} last />}
                    </div>
                </div>
            )}

            {/* Developer */}
            {(devItems > 0 || showMcp) && (
                <div className="space-y-1.5">
                    <GroupLabel>{t('settings.integrations_developer')}</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        {showGitHub && <GitHubIntegration onSaved={() => onSaved('github')} last={!showMcp} />}
                        {showMcp && <McpCredentialsSection onSaved={() => onSaved('mcp')} />}
                    </div>
                </div>
            )}

            {/* Organisation Integrations — merged for consumer accounts */}
            {showOrgIntegrations && (
                <div className="space-y-1.5">
                    <GroupLabel>{t('settings.integrations_org_tools')}</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: 'var(--bg-secondary)' }}>
                                <img src="/n8n-color.png" alt="n8n" style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }} />
                                <div className="flex-1">
                                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>n8n</p>
                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('integ.n8n_desc')}</p>
                                </div>
                            </div>
                            <div className="px-5 pb-4" style={{ background: 'var(--bg-secondary)' }}>
                                <N8nSection />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrationsSection;
