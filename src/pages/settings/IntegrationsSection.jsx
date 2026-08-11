import React, { useMemo, useState } from 'react';
import ConnectionsManager from './ConnectionsManager';
import N8nSection from './N8nSection';
import SimpleApiKeyIntegration from './SimpleApiKeyIntegration';
import { useEntitlements } from '../../components/EntitlementsContext';
import { useTranslation } from '../../hooks/useTranslation';
import useUserSettingSave from '../../hooks/useUserSettingSave';
import { openGoogleOAuthPopup } from '../../lib/googleOAuthPopup';
import { API_BASE, authFetch } from '../../utils/helpers';

// Named connections + lending UI — re-enabled for reusable HTTP credentials
// (the http_request step's Authentication settings reference these).
const SHOW_NAMED_CONNECTIONS = true;

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
// Exported so SimpleApiKeyIntegration can reuse the same primitives (circular
// import — safe because they're only read at render time).
export const IntegrationRow = ({ icon, name, description, connected, badge, children, last = false }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div data-tour="integration-card" style={{ borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
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
                    {/* An explicit badge renders alongside Connected (e.g. "Update
                        needed" when a connected integration needs re-consent). */}
                    {connected ? <>{badge || null}<ConnectedBadge /></> : badge || null}
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
export const ApiKeyField = ({ placeholder, value, onChange, onSave, saving, hint, t, canSave }) => (
    <div>
        <div className="flex gap-2">
            <input
                type="password"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                aria-label={placeholder}
                // These are API tokens, not account passwords — without this the
                // browser's password manager offers to save them.
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                className="flex-1 px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                onKeyDown={e => e.key === 'Enter' && (canSave ?? value.trim()) && onSave()}
            />
            <button
                onClick={onSave}
                disabled={saving || !(canSave ?? value.trim())}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--accent-primary)' }}
            >
                {saving ? '…' : (t ? t('settings.save') : 'Save')}
            </button>
        </div>
        {hint && <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
);

export const DisconnectButton = ({ onDisconnect, disconnecting, t }) => (
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
// Single-key integration — all save/disconnect/error logic lives in
// SimpleApiKeyIntegration + useUserSettingSave; this is just declarative config.
const FirefliesIntegration = ({ hasFirefliesKey, onSaved, last }) => {
    const { t } = useTranslation();
    return (
        <SimpleApiKeyIntegration
            last={last}
            connected={hasFirefliesKey}
            name="Fireflies.ai"
            payloadKey="firefliesApiKey"
            description={t('integ.fireflies_desc')}
            connectedDescription={t('integ.fireflies_connected')}
            placeholder="Enter your Fireflies.ai API key"
            onSaved={onSaved}
            icon={<svg viewBox="22 20 24 24" fill="none" style={{ width: '18px', height: '18px' }}><path d="M30.5749 22H24V28.5267H30.5749V22Z" fill="url(#ffs_g1)" /><path d="M38.3633 29.8789H31.7883V36.4056H38.3633V29.8789Z" fill="url(#ffs_g2)" /><path d="M38.3633 22H31.7883V28.5267H43.9998V27.594C43.9997 26.1104 43.4058 24.6875 42.3489 23.6384C41.2919 22.5894 39.8585 22 38.3638 22H38.3633Z" fill="url(#ffs_g3)" /><path d="M24 29.8789V36.4056C24.0002 37.8892 24.594 39.3121 25.6509 40.3612C26.7079 41.4103 28.1413 41.9996 29.636 41.9996H30.5749V29.8789H24Z" fill="url(#ffs_g4)" /><defs><linearGradient id="ffs_g1" x1="40.08" y1="38.51" x2="12.44" y2="9.47" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ffs_g2" x1="40.18" y1="38.42" x2="12.54" y2="9.38" gradientUnits="userSpaceOnUse"><stop stopColor="#FF3C82" /><stop offset="0.49" stopColor="#B251B2" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ffs_g3" x1="44.77" y1="34.05" x2="35.4" y2="0.12" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ffs_g4" x1="35.55" y1="42.82" x2="2.03" y2="32.61" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient></defs></svg>}
            hint={<>Get your key from <a href="https://app.fireflies.ai/integrations/custom/fireflies" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">app.fireflies.ai</a></>}
        />
    );
};

// ── YouTrack ──────────────────────────────────────────────────────────────────
const YouTrackIntegration = ({ hasYouTrackConfig, onSaved, last }) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [token, setToken] = useState('');
    const { saving, disconnecting, error, save, disconnect } = useUserSettingSave(onSaved);
    const clearFields = () => { setUrl(''); setToken(''); };
    const handleSave = () => {
        if (!url.trim() && !token.trim()) return;
        const body = {};
        if (url.trim()) body.youtrackUrl = url.replace(/\/+$/, '');
        if (token.trim()) body.youtrackToken = token;
        save(body, { onSuccess: clearFields });
    };
    const handleDisconnect = () => disconnect({ youtrackUrl: '', youtrackToken: '' }, { onSuccess: clearFields });
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
                    value={token} onChange={e => setToken(e.target.value)} onSave={handleSave} saving={saving}
                    hint={<>Token from <a href="https://www.jetbrains.com/help/youtrack/server/manage-permanent-token.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">YouTrack → Profile → Authentication</a></>}
                />
                {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>{error}</p>}
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
    const { saving, disconnecting, error, save, disconnect } = useUserSettingSave(onSaved);
    const clearFields = () => { setSubdomain(''); setToken(''); };
    const handleSave = () => {
        if (!subdomain.trim() && !token.trim()) return;
        const body = {};
        if (subdomain.trim()) body.signrequestSubdomain = subdomain.trim();
        if (token.trim()) body.signrequestToken = token;
        save(body, { onSuccess: clearFields });
    };
    const handleDisconnect = () => disconnect({ signrequestSubdomain: '', signrequestToken: '' }, { onSuccess: clearFields });
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
                    value={token} onChange={e => setToken(e.target.value)} onSave={handleSave} saving={saving}
                    hint={<>Get your token from <a href="https://signrequest.com/api/v1/api-docs/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">SignRequest → API Settings</a>. Use your sandbox team subdomain for testing.</>}
                />
                {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>{error}</p>}
                {hasSignRequestConfig && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
            </div>
        </IntegrationRow>
    );
};

// ── Gamma ─────────────────────────────────────────────────────────────────────
const GammaIntegration = ({ hasGammaKey, onSaved, last }) => {
    const { t } = useTranslation();
    return (
        <SimpleApiKeyIntegration
            last={last}
            connected={hasGammaKey}
            name="Gamma"
            payloadKey="gammaApiKey"
            description={t('integ.gamma_desc')}
            connectedDescription={t('integ.gamma_connected')}
            placeholder="Enter your Gamma API key"
            onSaved={onSaved}
            icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '20px', height: '20px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="url(#gamma_g)" /><path d="M7 8h10v1.5H7zM7 12h8v1.5H7zM7 16h5v1.5H7z" fill="white" fillOpacity="0.9" /><defs><linearGradient id="gamma_g" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#A855F7" /></linearGradient></defs></svg>}
            hint={<>Get key from <a href="https://gamma.app/settings" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">gamma.app/settings</a> → API Tokens</>}
        />
    );
};

// ── AFAS Profit ───────────────────────────────────────────────────────────────
// Read-only ERP access via an AFAS AppConnector token. The member number forms
// the API subdomain ({nr}.rest.afas.online) — digits only, validated server-side.
const AFASIntegration = ({ hasAfasConfig, onSaved, last }) => {
    const { t } = useTranslation();
    const [memberNumber, setMemberNumber] = useState('');
    const [token, setToken] = useState('');
    const [envType, setEnvType] = useState('production');
    const [envTouched, setEnvTouched] = useState(false);
    const { saving, disconnecting, error, setError, save, disconnect } = useUserSettingSave(onSaved);
    const handleSave = () => {
        if (!memberNumber.trim() && !token.trim() && !envTouched) return;
        // First connect needs both secrets — a token-only save would store a
        // half-configured integration that still shows as disconnected.
        if (!hasAfasConfig && (!memberNumber.trim() || !token.trim())) {
            setError(t('integ.afas_need_both'));
            return;
        }
        const body = {};
        if (memberNumber.trim()) body.afasMemberNumber = memberNumber.trim();
        if (token.trim()) body.afasToken = token.trim();
        // Only send the environment when first connecting or explicitly
        // changed — otherwise a token-only update would silently reset a
        // saved test/accept environment back to the select's default.
        if (!hasAfasConfig || envTouched) body.afasEnvType = envType;
        save(body, { onSuccess: () => { setMemberNumber(''); setToken(''); setEnvTouched(false); } });
    };
    const handleDisconnect = () => disconnect(
        { afasMemberNumber: '', afasToken: '', afasEnvType: '' },
        { onSuccess: () => { setMemberNumber(''); setToken(''); setEnvType('production'); setEnvTouched(false); } },
    );
    return (
        <IntegrationRow
            last={last}
            connected={hasAfasConfig}
            name="AFAS Profit"
            description={hasAfasConfig ? t('integ.afas_connected') : t('integ.afas_desc')}
            icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '20px', height: '20px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="#E30613" /><path d="M12 6.5L7 17.5h2.3l1-2.4h3.4l1 2.4H17L12 6.5zm0 4.1l1 2.5h-2l1-2.5z" fill="white" /></svg>}
        >
            <div className="space-y-2">
                <ol className="list-decimal pl-4 space-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <li>{t('integ.afas_step1')}</li>
                    <li>{t('integ.afas_step2')}</li>
                    <li>{t('integ.afas_step3')}</li>
                </ol>
                <div className="flex gap-2">
                    <input type="text" inputMode="numeric" value={memberNumber}
                        onChange={e => setMemberNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder={hasAfasConfig ? '••••••' : t('integ.afas_member_placeholder')}
                        aria-label={t('integ.afas_member_label')}
                        className="flex-1 px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                    <select value={envType}
                        onChange={e => { setEnvType(e.target.value); setEnvTouched(true); }}
                        aria-label={t('integ.afas_env_label')}
                        className="px-3 py-2 rounded-lg border outline-none text-[13px]"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                        <option value="production">{t('integ.afas_env_production')}</option>
                        <option value="test">{t('integ.afas_env_test')}</option>
                        <option value="accept">{t('integ.afas_env_accept')}</option>
                    </select>
                </div>
                <ApiKeyField
                    placeholder={hasAfasConfig ? '••••••••••••••••' : t('integ.afas_token_placeholder')}
                    value={token} onChange={e => setToken(e.target.value)} onSave={handleSave} saving={saving}
                    canSave={!!(token.trim() || memberNumber.trim() || envTouched)}
                    hint={<>AFAS Help: <a href="https://help.afas.nl/help/NL/SE/App_Cnr_Rest_Token.htm" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">App connector &amp; token aanmaken</a></>}
                />
                {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>{error}</p>}
                {hasAfasConfig && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
            </div>
        </IntegrationRow>
    );
};

// ── vPlan ─────────────────────────────────────────────────────────────────────
// Read-only planning access. vPlan issues an API key AND an API env together
// (Settings → Developers); both travel in request headers, so both are
// shape-checked server-side before they are stored.
const VplanIntegration = ({ hasVplanConfig, onSaved, last }) => {
    const { t } = useTranslation();
    const [apiEnv, setApiEnv] = useState('');
    const [apiKey, setApiKey] = useState('');
    const { saving, disconnecting, error, setError, save, disconnect } = useUserSettingSave(onSaved);
    const clearFields = () => { setApiEnv(''); setApiKey(''); };
    const handleSave = () => {
        if (!apiEnv.trim() && !apiKey.trim()) return;
        // First connect needs both — a key-only save would store a half-configured
        // integration that still shows as disconnected.
        if (!hasVplanConfig && (!apiEnv.trim() || !apiKey.trim())) {
            setError(t('integ.vplan_need_both'));
            return;
        }
        const body = {};
        if (apiEnv.trim()) body.vplanApiEnv = apiEnv.trim();
        if (apiKey.trim()) body.vplanApiKey = apiKey.trim();
        save(body, { onSuccess: clearFields });
    };
    const handleDisconnect = () => disconnect({ vplanApiKey: '', vplanApiEnv: '' }, { onSuccess: clearFields });
    return (
        <IntegrationRow
            last={last}
            connected={hasVplanConfig}
            name="vPlan"
            description={hasVplanConfig ? t('integ.vplan_connected') : t('integ.vplan_desc')}
            icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '20px', height: '20px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="#1D4ED8" /><rect x="6" y="7" width="11" height="2.4" rx="1.2" fill="white" /><rect x="8.5" y="10.8" width="9.5" height="2.4" rx="1.2" fill="white" fillOpacity="0.85" /><rect x="6" y="14.6" width="7" height="2.4" rx="1.2" fill="white" fillOpacity="0.7" /></svg>}
        >
            <div className="space-y-2">
                <ol className="list-decimal pl-4 space-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <li>{t('integ.vplan_step1')}</li>
                    <li>{t('integ.vplan_step2')}</li>
                    <li>{t('integ.vplan_step3')}</li>
                </ol>
                <input type="text" value={apiEnv} onChange={e => setApiEnv(e.target.value)}
                    placeholder={hasVplanConfig ? '••••••••' : t('integ.vplan_env_placeholder')}
                    aria-label={t('integ.vplan_env_label')}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                <ApiKeyField
                    placeholder={hasVplanConfig ? '••••••••••••••••' : t('integ.vplan_key_placeholder')}
                    value={apiKey} onChange={e => setApiKey(e.target.value)} onSave={handleSave} saving={saving}
                    canSave={!!(apiKey.trim() || apiEnv.trim())}
                    hint={<>vPlan Help: <a href="https://support.vplan.com/en/articles/158922-api" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">create an API key</a> (available from the Basic plan)</>}
                />
                {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>{error}</p>}
                {hasVplanConfig && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
            </div>
        </IntegrationRow>
    );
};

// ── NMBRS ───────────────────────────────────────────────────────────────────
// Read-only payroll/HR access. Supports both NMBRS APIs: SOAP (login email +
// token) and REST (Bearer token). The subdomain is the tenant; non-secret
// fields pre-fill from the saved config, the token is never returned.
const NMBRSIntegration = ({ hasNmbrsConfig, apiMode: initialMode, subdomain: initialSub, email: initialEmail, env: initialEnv, onSaved, last }) => {
    const { t } = useTranslation();
    const [apiMode, setApiMode] = useState(initialMode || 'soap');
    const [subdomain, setSubdomain] = useState(initialSub || '');
    const [email, setEmail] = useState(initialEmail || '');
    const [token, setToken] = useState('');
    const [env, setEnv] = useState(initialEnv || 'production');
    const { saving, disconnecting, error, setError, save, disconnect } = useUserSettingSave(onSaved);
    const handleSave = () => {
        // First connect needs subdomain + token (+ login email for the SOAP API);
        // a partial save would store a half-configured integration.
        if (!hasNmbrsConfig && (!subdomain.trim() || !token.trim() || (apiMode === 'soap' && !email.trim()))) {
            setError(t('integ.nmbrs_need_fields'));
            return;
        }
        const body = { nmbrsApiMode: apiMode, nmbrsEnv: env };
        if (subdomain.trim()) body.nmbrsSubdomain = subdomain.trim();
        if (email.trim()) body.nmbrsEmail = email.trim();
        if (token.trim()) body.nmbrsToken = token.trim();
        save(body, { onSuccess: () => setToken('') });
    };
    const handleDisconnect = () => disconnect(
        { nmbrsApiMode: '', nmbrsSubdomain: '', nmbrsEmail: '', nmbrsToken: '', nmbrsEnv: '' },
        { onSuccess: () => { setSubdomain(''); setEmail(''); setToken(''); setApiMode('soap'); setEnv('production'); } },
    );
    const inputCls = "flex-1 px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors";
    const inputStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' };
    return (
        <IntegrationRow
            last={last}
            connected={hasNmbrsConfig}
            name="NMBRS"
            description={hasNmbrsConfig ? t('integ.nmbrs_connected') : t('integ.nmbrs_desc')}
            icon={<svg viewBox="0 0 24 24" fill="none" style={{ width: '20px', height: '20px' }}><rect x="2" y="2" width="20" height="20" rx="4" fill="#00C389" /><path d="M7 16.5v-9h1.9v1.1c.45-.8 1.3-1.3 2.4-1.3 1.05 0 1.85.42 2.3 1.2.5-.78 1.4-1.2 2.45-1.2 1.95 0 2.95 1.2 2.95 3.2v6H19v-5.6c0-1-.35-1.75-1.4-1.75-1 0-1.5.78-1.5 1.8v5.55h-2v-5.6c0-1-.35-1.75-1.4-1.75-1 0-1.5.78-1.5 1.8v5.55H7z" fill="white" /></svg>}
        >
            <div className="space-y-2">
                <ol className="list-decimal pl-4 space-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <li>{t('integ.nmbrs_step1')}</li>
                    <li>{t('integ.nmbrs_step2')}</li>
                    <li>{t('integ.nmbrs_step3')}</li>
                </ol>
                <div className="flex gap-2">
                    <select value={apiMode} onChange={e => setApiMode(e.target.value)} aria-label={t('integ.nmbrs_mode_label')}
                        className="px-3 py-2 rounded-lg border outline-none text-[13px]" style={inputStyle}>
                        <option value="soap">{t('integ.nmbrs_mode_soap')}</option>
                        <option value="rest">{t('integ.nmbrs_mode_rest')}</option>
                    </select>
                    <select value={env} onChange={e => setEnv(e.target.value)} aria-label={t('integ.nmbrs_env_label')}
                        className="px-3 py-2 rounded-lg border outline-none text-[13px]" style={inputStyle}>
                        <option value="production">{t('integ.nmbrs_env_production')}</option>
                        <option value="sandbox">{t('integ.nmbrs_env_sandbox')}</option>
                    </select>
                </div>
                <input type="text" value={subdomain}
                    onChange={e => setSubdomain(e.target.value.trim())}
                    placeholder={t('integ.nmbrs_subdomain_placeholder')}
                    aria-label={t('integ.nmbrs_subdomain_label')}
                    className={inputCls} style={inputStyle} />
                {apiMode === 'soap' && (
                    <input type="email" value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t('integ.nmbrs_email_placeholder')}
                        aria-label={t('integ.nmbrs_email_label')}
                        className={inputCls} style={inputStyle} />
                )}
                <ApiKeyField
                    placeholder={hasNmbrsConfig ? '••••••••••••••••' : t('integ.nmbrs_token_placeholder')}
                    value={token} onChange={e => setToken(e.target.value)} onSave={handleSave} saving={saving}
                    canSave={!!(token.trim() || subdomain.trim() || email.trim())}
                    hint={<>NMBRS Help: <a href="https://support.nmbrs.nl/hc/nl/articles/360010686800-Connect-Nmbrs-with-an-API-token" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">API-token aanmaken</a></>}
                />
                {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>{error}</p>}
                {hasNmbrsConfig && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
            </div>
        </IntegrationRow>
    );
};

// ── Google Workspace ──────────────────────────────────────────────────────────
// BFSF-255: manual connect for Gmail/Calendar/Drive & co. Email/password
// accounts never go through Google-SSO login, so without this tile the whole
// Google toolset was silently dead for them; SSO users also had no way to see
// or revoke their authorisation. The popup + postMessage flow lives in
// lib/googleOAuthPopup (shared with the Meeting Notes surfaces); lazy status
// fetch (GitHub).
const GoogleWorkspaceIntegration = ({ onSaved, last }) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState(null); // null = loading skeleton
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [error, setError] = useState('');

    const checkStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/google/status`);
            setStatus(res.ok ? await res.json() : { configured: false, connected: false });
        } catch { setStatus({ configured: false, connected: false }); }
    };
    React.useEffect(() => { checkStatus(); }, []);

    const handleConnect = async () => {
        setConnecting(true); setError('');
        try {
            await openGoogleOAuthPopup({
                authFetch,
                apiBase: API_BASE,
                onOpened: () => setConnecting(false),
                onDone: ({ success, closed }) => {
                    if (closed) return;
                    checkStatus();
                    if (success) onSaved();
                },
            });
        } catch (e) {
            setError(e?.message || t('integ.google_error', 'Could not start the Google connection. Try again.'));
            setConnecting(false);
        }
    };
    const handleDisconnect = async () => {
        setDisconnecting(true); setError('');
        try {
            await authFetch(`${API_BASE}/api/integrations/google/disconnect`, { method: 'POST' });
            await checkStatus();
            onSaved();
        } catch (e) { console.error(e); }
        setDisconnecting(false);
    };

    const loading = status === null;
    const connected = !!status?.connected;
    const needsReauth = !loading && !connected && !!status?.needsReauth;
    // Connected before the Meet scopes were added to the connector — the token
    // works for Gmail/Calendar/Drive but Meeting Notes can't read Meet
    // recordings until the user re-consents (incremental: existing grants stay).
    const needsMeetReconsent = connected && status?.meetScopesGranted === false;
    return (
        <IntegrationRow
            last={last}
            connected={connected}
            badge={needsMeetReconsent ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ background: 'rgba(217,119,6,0.12)', color: '#d97706' }}>
                    {t('integ.google_update_needed', 'Update needed')}
                </span>
            ) : null}
            name="Google Workspace"
            description={loading
                ? '…'
                : connected
                    ? (status.email ? t('integ.google_connected_as', { email: status.email }) : t('integ.google_connected'))
                    : needsReauth
                        ? t('integ.google_needs_reauth')
                        : t('integ.google_desc')}
            icon={<svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }} aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" /><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" /><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" /><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" /></svg>}
        >
            {loading ? (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>…</p>
            ) : !status.configured ? (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('integ.google_not_configured')}</p>
            ) : connected ? (
                <div className="space-y-2">
                    {needsMeetReconsent && (
                        <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.35)' }}>
                            <p className="text-[11px]" style={{ color: '#b45309' }}>
                                {t('integ.google_meet_scope_missing', 'Meeting Notes needs extra Google Meet permissions to import your meeting recordings — re-authorize to grant them. Your existing Gmail, Calendar and Drive access is kept.')}
                            </p>
                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="mt-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                                style={{ background: '#d97706' }}
                            >
                                {connecting ? t('integ.google_opening', 'Opening Google…') : t('integ.google_reauthorize', 'Re-authorize Google')}
                            </button>
                        </div>
                    )}
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('integ.google_disconnect_note')}</p>
                    <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />
                </div>
            ) : (
                <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                    style={{ background: needsReauth ? '#d97706' : '#4285F4' }}
                >
                    {connecting
                        ? t('integ.google_opening', 'Opening Google…')
                        : needsReauth ? t('integ.google_reconnect') : t('integ.google_connect')}
                </button>
            )}
            {error && <p className="text-[11px] mt-2" style={{ color: '#dc2626' }}>{error}</p>}
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
    const [connected, setConnected] = useState(false);
    const [username, setUsername] = useState(null);
    // GitHub connect/disconnect hit dedicated endpoints (not /ai/user-settings)
    // and read the response (username), so they pass endpoint + onSuccess to the
    // shared hook. Error handling is unified to the visible `error` state (this
    // used to be an alert()).
    const { saving, disconnecting, error, save, disconnect } = useUserSettingSave(onSaved);
    React.useEffect(() => { checkStatus(); }, []);
    const checkStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github/status`);
            if (res.ok) { const data = await res.json(); setConnected(data.connected); setUsername(data.username); }
        } catch { /* ignore */ }
    };
    const handleSave = () => {
        if (!token.trim()) return;
        save({ token: token.trim() }, {
            endpoint: `${API_BASE}/api/integrations/github/connect`,
            fallback: 'Failed to connect',
            onSuccess: (data) => { setConnected(true); setUsername(data.username); setToken(''); },
        });
    };
    const handleDisconnect = () => disconnect(null, {
        endpoint: `${API_BASE}/api/integrations/github/disconnect`,
        onSuccess: () => { setConnected(false); setUsername(null); },
    });
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
                    value={token} onChange={e => setToken(e.target.value)} onSave={handleSave} saving={saving}
                    hint={<>Create token at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }} className="underline">github.com/settings/tokens</a> with <strong>repo</strong> scope</>}
                />
            ) : (
                <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />
            )}
            {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>{error}</p>}
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
    const [autoCreating, setAutoCreating] = useState(false);
    const [notice, setNotice] = useState(null);
    // Nextcloud uses dedicated /auth/* endpoints, so save/disconnect pass a
    // custom endpoint (+ DELETE method) to the shared hook. `notice` stays local
    // for the auto-create (OAuth) flow, which surfaces info/warnings too.
    const { saving, disconnecting, error, setError, save, disconnect } = useUserSettingSave(onSaved);

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
                description={t('integ.nextcloud_connector', 'Connected via Bee Flow Nextcloud connector — files, calendar, mail and more work in chat without extra setup.')}
                icon={<svg viewBox="0 0 32 32" fill="none" style={{ width: '20px', height: '20px' }}><circle cx="16" cy="16" r="16" fill="#0082C9" /><path d="M11.5 11.2c-2 0-3.7 1.4-4.2 3.3a3.5 3.5 0 1 0 0 3 4.4 4.4 0 0 0 7 1.7l1.5-1.4 1.6 1.4a4.4 4.4 0 0 0 7-1.7 3.5 3.5 0 1 0 0-3 4.4 4.4 0 0 0-7-1.7l-1.6 1.4-1.5-1.4a4.4 4.4 0 0 0-2.8-1.6zm0 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm9 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z" fill="white" /></svg>}
            />
        );
    }

    const handleSave = () => {
        if (!username.trim() || !password.trim()) return;
        setNotice(null);
        save(
            { username: username.trim(), password: password.trim(), url: url.trim() },
            {
                endpoint: `${API_BASE}/auth/save-app-password`,
                onSuccess: () => { setUsername(''); setPassword(''); },
            },
        );
    };

    const autoCreate = async () => {
        setAutoCreating(true); setNotice(null); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/auth/create-app-password`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                onSaved();
                if (data.warning) setNotice(data.warning);
            } else {
                setNotice(data.error || t('integ.nextcloud_autocreate_failed', 'Failed to create app password'));
            }
        } catch (e) { console.error(e); setNotice(e.message); }
        setAutoCreating(false);
    };

    const handleDisconnect = () => disconnect(null, { endpoint: `${API_BASE}/auth/app-password`, method: 'DELETE' });

    return (
        <IntegrationRow
            last={last}
            connected={hasNextcloudAppPassword}
            name="Nextcloud"
            description={hasNextcloudAppPassword
                ? t('integ.nextcloud_connected', 'App password saved — files & WebDAV available to agents')
                : t('integ.nextcloud_desc', 'Connect Nextcloud for file/WebDAV access in chat')}
            icon={<svg viewBox="0 0 32 32" fill="none" style={{ width: '20px', height: '20px' }}><circle cx="16" cy="16" r="16" fill="#0082C9" /><path d="M11.5 11.2c-2 0-3.7 1.4-4.2 3.3a3.5 3.5 0 1 0 0 3 4.4 4.4 0 0 0 7 1.7l1.5-1.4 1.6 1.4a4.4 4.4 0 0 0 7-1.7 3.5 3.5 0 1 0 0-3 4.4 4.4 0 0 0-7-1.7l-1.6 1.4-1.5-1.4a4.4 4.4 0 0 0-2.8-1.6zm0 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm9 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z" fill="white" /></svg>}
        >
            <div className="space-y-2">
                <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder={t('integ.nextcloud_url_placeholder', 'Nextcloud URL (e.g. https://cloud.example.com)')}
                    aria-label={t('integ.nextcloud_url_placeholder', 'Nextcloud URL (e.g. https://cloud.example.com)')}
                    autoComplete="off"
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder={hasNextcloudAppPassword ? '••••••••' : t('integ.nextcloud_username_placeholder', 'Nextcloud username')}
                    aria-label={t('integ.nextcloud_username_placeholder', 'Nextcloud username')}
                    autoComplete="off"
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <ApiKeyField
                    placeholder={hasNextcloudAppPassword ? '••••••••••••••••' : t('integ.nextcloud_password_placeholder', 'App password')}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onSave={handleSave}
                    saving={saving}
                    hint={t('integ.nextcloud_hint', 'Generate at Nextcloud → Settings → Security → Devices & sessions.')}
                    t={t}
                />
                {isNextcloudUser && (
                    <button
                        onClick={autoCreate}
                        disabled={autoCreating}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                    >
                        {autoCreating ? '…' : t('integ.nextcloud_autocreate', 'Auto-create from OAuth session (short-lived)')}
                    </button>
                )}
                {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>{error}</p>}
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
                                        placeholder={cred.configured ? '••••••••••••••••' : t('integ.mcp_enter_credential', 'Enter {label}', { label: cred.label || cred.key })}
                                        value={credValues[stateKey] || ''}
                                        onChange={e => setCredValues(prev => ({ ...prev, [stateKey]: e.target.value }))}
                                        onSave={() => saveCred(server.id, cred.key)}
                                        saving={saving === stateKey}
                                        t={t}
                                    />
                                    {cred.configured && <p className="text-[10px] mt-0.5" style={{ color: '#4ade80' }}>{t('integ.mcp_configured', '✓ Configured')}{cred.description ? ` — ${cred.description}` : ''}</p>}
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
const IntegrationsSection = ({ statuses, onSaved, isOrgAdmin, user, showOrgIntegrations = false }) => {
    const { t } = useTranslation();
    // Only list integrations the user's organisation actually has access to: the
    // plan-trimmed EFFECTIVE entitlement set (subscription-included AND granted in
    // org settings), not the plan-agnostic org allow-list. While the snapshot is
    // still loading — or if it failed to load — fall back to showing everything so
    // the page never flashes (or stays) empty.
    const { effective, loading, error } = useEntitlements() || {};
    const effectiveIntegrations = useMemo(() => new Set(effective?.integration || []), [effective]);
    const isEnabled = (id) => loading || error || effectiveIntegrations.has(id);

    // BFSF-255: show the Google Workspace connect tile whenever at least one
    // Google integration is in the org's effective entitlement set.
    const showGoogle = ['gmail', 'google-calendar', 'google-drive'].some(isEnabled);
    const showFireflies = isEnabled('fireflies');
    const showYouTrack = isEnabled('youtrack');
    const showSignRequest = isEnabled('signrequest');
    const showGamma = isEnabled('gamma');
    const showAfas = isEnabled('afas-profit');
    const showVplan = isEnabled('vplan');
    const showNmbrs = isEnabled('nmbrs');
    const showLinkedIn = isEnabled('linkedin');
    const showGitHub = isEnabled('github');
    // Nextcloud-bound users always see the card so they can manage their link.
    // `provider` (login payload) covers connector + OAuth NC users synchronously,
    // so the card never depends on the async app-password-status fetch, which can
    // fail-closed; `statuses.isNextcloudUser` is just a belt-and-braces fallback.
    const isNcUser = user?.provider === 'nextcloud_connector' || user?.provider === 'nextcloud'
        || !!user?.ncOrg?.instanceId || !!statuses?.isNextcloudUser;
    // For everyone else, only show it when the org actually enables Nextcloud.
    // Nextcloud is org-exempt in the resolver (granted to all via the
    // isNcCapability bypass), so effective.integration / isEnabled('nextcloud')
    // is always true and can't tell enabled from disabled. Gate on the org's
    // enabled-integrations allow-list from the login payload instead: null/absent
    // = unrestricted (show it); a list must contain 'nextcloud'.
    const orgEnabledIntegrations = user?.enabledIntegrations;
    const orgEnablesNextcloud = !Array.isArray(orgEnabledIntegrations) || orgEnabledIntegrations.includes('nextcloud');
    const showNextcloud = isNcUser || orgEnablesNextcloud;
    // MCP servers are opt-in per plan; show the per-server credentials section
    // only when the effective set includes at least one installed server.
    const showMcp = loading || error || (effective?.integration || []).some(id => id.startsWith('mcp:'));

    const productivityItems = [showFireflies, showYouTrack, showSignRequest, showGamma, showAfas, showVplan, showNmbrs, showNextcloud].filter(Boolean).length;
    const socialItems = [showLinkedIn].filter(Boolean).length;
    const devItems = [showGitHub].filter(Boolean).length;

    return (
        <div className="space-y-6">
            {/* Named connections + sharing (bring-your-own vs lend) — hidden for now */}
            {SHOW_NAMED_CONNECTIONS && <ConnectionsManager />}

            {/* Google Workspace (BFSF-255) */}
            {showGoogle && (
                <div className="space-y-1.5">
                    <GroupLabel>{t('settings.integrations_google_workspace', 'Google Workspace')}</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        <GoogleWorkspaceIntegration onSaved={() => onSaved('google')} last />
                    </div>
                </div>
            )}

            {/* Productivity */}
            {productivityItems > 0 && (
                <div className="space-y-1.5">
                    <GroupLabel>{t('settings.integrations_productivity')}</GroupLabel>
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        {showFireflies && <FirefliesIntegration hasFirefliesKey={statuses.hasFirefliesKey} onSaved={() => onSaved('fireflies')} last={!showYouTrack && !showSignRequest && !showGamma && !showAfas && !showVplan && !showNmbrs && !showNextcloud} />}
                        {showYouTrack && <YouTrackIntegration hasYouTrackConfig={statuses.hasYouTrackConfig} onSaved={() => onSaved('youtrack')} last={!showSignRequest && !showGamma && !showAfas && !showVplan && !showNmbrs && !showNextcloud} />}
                        {showSignRequest && <SignRequestIntegration hasSignRequestConfig={statuses.hasSignRequestConfig} onSaved={() => onSaved('signrequest')} last={!showGamma && !showAfas && !showVplan && !showNmbrs && !showNextcloud} />}
                        {showGamma && <GammaIntegration hasGammaKey={statuses.hasGammaKey} onSaved={() => onSaved('gamma')} last={!showAfas && !showVplan && !showNmbrs && !showNextcloud} />}
                        {showAfas && <AFASIntegration hasAfasConfig={statuses.hasAfasConfig} onSaved={() => onSaved('afas-profit')} last={!showVplan && !showNmbrs && !showNextcloud} />}
                        {showVplan && <VplanIntegration hasVplanConfig={statuses.hasVplanConfig} onSaved={() => onSaved('vplan')} last={!showNmbrs && !showNextcloud} />}
                        {showNmbrs && <NMBRSIntegration hasNmbrsConfig={statuses.hasNmbrsConfig} apiMode={statuses.nmbrsApiMode} subdomain={statuses.nmbrsSubdomain} email={statuses.nmbrsEmail} env={statuses.nmbrsEnv} onSaved={() => onSaved('nmbrs')} last={!showNextcloud} />}
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
