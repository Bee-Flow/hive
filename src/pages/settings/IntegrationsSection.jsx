import React, { useState } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

// ── Shared UI helpers ─────────────────────────────────────────────────────────
const ConnectedBadge = () => (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
        Connected
    </span>
);

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
const ApiKeyField = ({ placeholder, value, onChange, onSave, saving, hint }) => (
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
                {saving ? '…' : 'Save'}
            </button>
        </div>
        {hint && <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
);

const DisconnectButton = ({ onDisconnect, disconnecting }) => (
    <button
        onClick={onDisconnect}
        disabled={disconnecting}
        className="px-4 py-2 rounded-lg text-[13px] font-medium transition-opacity disabled:opacity-50"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
    >
        {disconnecting ? '…' : 'Disconnect'}
    </button>
);

// ── Fireflies ─────────────────────────────────────────────────────────────────
const FirefliesIntegration = ({ hasFirefliesKey, onSaved, last }) => {
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
            description={hasFirefliesKey ? 'AI can search your meeting transcripts' : 'Connect to search & summarize meeting transcripts'}
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
            description={hasYouTrackConfig ? 'AI can search and manage your issues' : 'Connect to search, create & manage issues'}
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

// ── Gamma ─────────────────────────────────────────────────────────────────────
const GammaIntegration = ({ hasGammaKey, onSaved, last }) => {
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
            description={hasGammaKey ? 'AI can generate presentations' : 'Connect to generate presentations & web pages'}
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
            description={connected ? `Connected${linkedInName ? ` as ${linkedInName}` : ''} — AI can post to LinkedIn` : 'Connect to post on LinkedIn via AI'}
            icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '20px', height: '20px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" /><path d="M7.5 9.5h2v7h-2v-7zm1-3.2a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm3.5 3.2h1.9v1h0c.27-.5.92-1.1 1.9-1.1 2 0 2.4 1.3 2.4 3.1v3.6h-2v-3.2c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.7v3.3h-2v-6.6z" fill="white" /></svg>}
        >
            {!hasLinkedInConfig && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>LinkedIn not configured. Ask your admin to set it up in Admin → Integrations.</p>}
            {hasLinkedInConfig && !connected && (
                <button onClick={handleConnect} disabled={connecting} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ background: '#0A66C2' }}>
                    {connecting ? 'Opening…' : 'Connect LinkedIn'}
                </button>
            )}
            {connected && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
        </IntegrationRow>
    );
};

// ── WhatsApp ──────────────────────────────────────────────────────────────────
const WhatsAppIntegration = ({ onSaved, last }) => {
    const [status, setStatus] = useState('loading');
    const [qrDataUrl, setQrDataUrl] = useState(null);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [polling, setPolling] = useState(false);
    React.useEffect(() => { checkStatus(); }, []);
    const checkStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/whatsapp/status`);
            if (res.ok) { const data = await res.json(); setStatus(data.status || 'disconnected'); }
            else setStatus('disconnected');
        } catch { setStatus('disconnected'); }
    };
    const isConnected = status === 'connected';
    const handleConnect = async () => {
        setConnecting(true); setQrDataUrl(null);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/whatsapp/connect`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'already_connected') { setStatus('connected'); setConnecting(false); return; }
                if (data.qrDataUrl) setQrDataUrl(data.qrDataUrl);
                setStatus(data.status || 'connecting');
                if (!polling) {
                    setPolling(true);
                    const interval = setInterval(async () => {
                        const r = await authFetch(`${API_BASE}/api/integrations/whatsapp/qr`);
                        if (r.ok) {
                            const d = await r.json();
                            if (d.connected) { setStatus('connected'); setQrDataUrl(null); setPolling(false); clearInterval(interval); onSaved?.(); return; }
                            if (d.qrDataUrl) setQrDataUrl(d.qrDataUrl);
                            setStatus(d.status || 'connecting');
                        }
                    }, 3000);
                    setTimeout(() => { clearInterval(interval); setPolling(false); }, 120000);
                }
            }
        } catch (e) { console.error(e); }
        setConnecting(false);
    };
    const handleDisconnect = async () => {
        setDisconnecting(true);
        try { await authFetch(`${API_BASE}/api/integrations/whatsapp/disconnect`, { method: 'POST' }); setStatus('disconnected'); setQrDataUrl(null); onSaved?.(); }
        catch (e) { console.error(e); }
        setDisconnecting(false);
    };
    return (
        <IntegrationRow
            last={last}
            connected={isConnected}
            name="WhatsApp"
            description={isConnected ? 'AI can read & send WhatsApp messages with your approval' : 'Connect your WhatsApp to send & receive messages'}
            icon={<svg viewBox="0 0 24 24" fill="#25D366" style={{ width: '18px', height: '18px' }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>}
        >
            {!isConnected && !qrDataUrl && (
                <button onClick={handleConnect} disabled={connecting} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ background: '#25D366' }}>
                    {connecting ? 'Connecting…' : 'Connect WhatsApp'}
                </button>
            )}
            {qrDataUrl && !isConnected && (
                <div className="flex flex-col items-center gap-3 py-2">
                    <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Scan with WhatsApp → Linked Devices → Link a Device</p>
                    <div className="p-2 bg-white rounded-xl shadow-lg"><img src={qrDataUrl} alt="WhatsApp QR Code" style={{ width: '200px', height: '200px' }} /></div>
                    <p className="text-[11px] animate-pulse" style={{ color: 'var(--text-muted)' }}>Waiting for scan…</p>
                </div>
            )}
            {isConnected && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
        </IntegrationRow>
    );
};

// ── GitHub ────────────────────────────────────────────────────────────────────
const GitHubIntegration = ({ onSaved, last }) => {
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
            description={connected ? `Connected as ${username || 'user'} — AI can manage repos & view code` : 'Connect to manage repos, view code, and browse branches'}
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

// ── MCP Servers ───────────────────────────────────────────────────────────────
const McpCredentialsSection = ({ onSaved }) => {
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
                    description={server.allConfigured ? `${server.toolCount} tool${server.toolCount !== 1 ? 's' : ''} available — credentials configured` : `Configure your credentials for ${server.toolCount} tool${server.toolCount !== 1 ? 's' : ''}`}
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
const IntegrationsSection = ({ statuses, onSaved, enabledIntegrations, isOrgAdmin }) => {
    const isEnabled = (id) => !enabledIntegrations || enabledIntegrations.includes(id);

    const showFireflies = isEnabled('fireflies');
    const showYouTrack = isEnabled('youtrack');
    const showGamma = isEnabled('gamma');
    const showLinkedIn = isEnabled('linkedin');
    const showGitHub = isEnabled('github');
    const showWhatsApp = isEnabled('whatsapp');
    const showMcp = !enabledIntegrations || enabledIntegrations.some(id => id.startsWith('mcp:'));

    const productivityItems = [showFireflies, showYouTrack, showGamma].filter(Boolean).length;
    const socialItems = [showLinkedIn, showWhatsApp].filter(Boolean).length;
    const devItems = [showGitHub].filter(Boolean).length;

    return (
        <div className="space-y-6">
            {/* Productivity */}
            {productivityItems > 0 && (
                <div className="space-y-1.5">
                    <GroupLabel>Productivity</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        {showFireflies && <FirefliesIntegration hasFirefliesKey={statuses.hasFirefliesKey} onSaved={() => onSaved('fireflies')} last={!showYouTrack && !showGamma} />}
                        {showYouTrack && <YouTrackIntegration hasYouTrackConfig={statuses.hasYouTrackConfig} onSaved={() => onSaved('youtrack')} last={!showGamma} />}
                        {showGamma && <GammaIntegration hasGammaKey={statuses.hasGammaKey} onSaved={() => onSaved('gamma')} last />}
                    </div>
                </div>
            )}

            {/* Social */}
            {socialItems > 0 && (
                <div className="space-y-1.5">
                    <GroupLabel>Social</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        {showLinkedIn && <LinkedInIntegration connected={statuses.linkedInConnected} linkedInName={statuses.linkedInName} hasLinkedInConfig={statuses.hasLinkedInConfig} onSaved={() => onSaved('linkedin')} last={!showWhatsApp} />}
                        {showWhatsApp && <WhatsAppIntegration onSaved={() => onSaved('whatsapp')} last />}
                    </div>
                </div>
            )}

            {/* Developer */}
            {(devItems > 0 || showMcp) && (
                <div className="space-y-1.5">
                    <GroupLabel>Developer</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        {showGitHub && <GitHubIntegration onSaved={() => onSaved('github')} last={!showMcp} />}
                        {showMcp && <McpCredentialsSection onSaved={() => onSaved('mcp')} />}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrationsSection;
