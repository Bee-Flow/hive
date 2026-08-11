import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Plus, Trash2, Share2, Star, Check, X, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { HTTP_AUTH_TYPES, httpKindName, splitHttpAuthValues, missingHttpAuthFields } from '../../utils/httpCredentialTypes';

const BASE = `${API_BASE}/api/integrations/connections`;
const EMERALD = '#059669';

// Providers that support multiple named API-key / basic connections. The field
// keys MUST match the server's legacy mirror map so the default connection
// keeps the existing integration code working.
//
// `labelKey` is the i18n key; `label` is the English fallback.
const PROVIDERS = [
    { id: 'fireflies', name: 'Fireflies.ai', kind: 'api_key', fields: [{ key: 'api_key', label: 'API key', labelKey: 'connections.field_api_key', type: 'password' }] },
    { id: 'gamma', name: 'Gamma', kind: 'api_key', fields: [{ key: 'api_key', label: 'API key', labelKey: 'connections.field_api_key', type: 'password' }] },
    { id: 'github', name: 'GitHub', kind: 'api_key', fields: [{ key: 'token', label: 'Personal access token', labelKey: 'connections.field_pat', type: 'password' }] },
    { id: 'youtrack', name: 'YouTrack', kind: 'basic', fields: [{ key: 'url', label: 'Instance URL', labelKey: 'connections.field_instance_url', type: 'text' }, { key: 'token', label: 'Permanent token', labelKey: 'connections.field_permanent_token', type: 'password' }] },
    { id: 'signrequest', name: 'SignRequest', kind: 'basic', fields: [{ key: 'subdomain', label: 'Subdomain', labelKey: 'connections.field_subdomain', type: 'text' }, { key: 'token', label: 'API token', labelKey: 'connections.field_api_token', type: 'password' }] },
    { id: 'afas-profit', name: 'AFAS Profit', kind: 'basic', fields: [{ key: 'member_number', label: 'Member number (digits, e.g. 12345)', labelKey: 'connections.field_member_number', type: 'text' }, { key: 'token', label: 'AppConnector token (XML or code)', labelKey: 'connections.field_afas_token', type: 'password' }, { key: 'env_type', label: 'Environment (production / test / accept)', labelKey: 'connections.field_afas_env', type: 'text' }] },
    { id: 'vplan', name: 'vPlan', kind: 'basic', fields: [{ key: 'api_env', label: 'API env', labelKey: 'connections.field_vplan_env', type: 'text' }, { key: 'api_key', label: 'API key', labelKey: 'connections.field_vplan_key', type: 'password' }] },
    { id: 'nmbrs', name: 'NMBRS', kind: 'basic', fields: [{ key: 'api_mode', label: 'API (soap / rest)', labelKey: 'connections.field_nmbrs_mode', type: 'text' }, { key: 'subdomain', label: 'Subdomain (e.g. mycompany)', labelKey: 'connections.field_nmbrs_subdomain', type: 'text' }, { key: 'email', label: 'Login email (SOAP only)', labelKey: 'connections.field_nmbrs_email', type: 'text' }, { key: 'token', label: 'API token', labelKey: 'connections.field_api_token', type: 'password' }, { key: 'env', label: 'Environment (production / sandbox)', labelKey: 'connections.field_nmbrs_env', type: 'text' }] },
    // Reusable HTTP credentials for the automation http_request step. The
    // auth type picks the kind + fields; each field's `target` routes it to
    // the encrypted `secret` blob or the plaintext `secretMeta` on submit.
    { id: 'http', name: 'HTTP API (custom)', authTypes: HTTP_AUTH_TYPES },
];
const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));

const EXPIRY_OPTIONS = [
    { labelKey: 'connections.expiry_none', label: 'No expiry', value: '' },
    { labelKey: 'connections.expiry_7d', label: '7 days', value: 7 },
    { labelKey: 'connections.expiry_30d', label: '30 days', value: 30 },
    { labelKey: 'connections.expiry_90d', label: '90 days', value: 90 },
];

const inputStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' };
const inputCls = 'px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors';

const GroupLabel = ({ children }) => (
    <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>{children}</p>
);

const ErrorLine = ({ children }) => (
    <p role="alert" className="text-[11px] mt-1" style={{ color: '#dc2626' }}>{children}</p>
);

function daysFromNowIso(days) {
    if (!days) return null;
    return new Date(Date.now() + days * 86400000).toISOString();
}

// Pull a server error message out of a failed response, falling back to a
// translated generic. Mutations used to ignore !res.ok entirely, so a rejected
// rename or delete looked like it had worked until the list reloaded.
async function errorFrom(res, fallback) {
    try {
        const body = await res.json();
        if (body && typeof body.error === 'string' && body.error) return body.error;
    } catch { /* empty or non-JSON body */ }
    return fallback;
}

// Kind + display metadata line for an HTTP credential card. secretMeta is
// plaintext display-only data by API contract (headerName / tokenUrl /
// username / clientIdHint) — actual secret values are never returned.
function httpMetaSummary(connection) {
    const meta = connection.secretMeta || {};
    const bits = [httpKindName(connection.kind)];
    if (meta.headerName) bits.push(meta.headerName);
    if (meta.username) bits.push(meta.username);
    if (meta.tokenUrl) bits.push(meta.tokenUrl);
    if (meta.clientIdHint) bits.push(`client ${meta.clientIdHint}`);
    if (meta.scope) bits.push(meta.scope);
    return bits.join(' · ');
}

// ── Share panel for a single connection ─────────────────────────────
const SharePanel = ({ connection, grants, onChanged }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [expiry, setExpiry] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const mine = grants.filter(g => g.connection_id === connection.id);

    const share = async (body) => {
        setBusy(true); setErr(null);
        try {
            const res = await authFetch(`${BASE}/${connection.id}/grants`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...body, expiresAt: daysFromNowIso(expiry ? Number(expiry) : 0) }),
            });
            if (!res.ok) setErr(await errorFrom(res, t('connections.share_failed', 'Share failed')));
            else { setEmail(''); onChanged(); }
        } catch (e) { setErr(e.message); }
        setBusy(false);
    };

    const revoke = async (grantId) => {
        setBusy(true); setErr(null);
        try {
            const res = await authFetch(`${BASE}/grants/${grantId}`, { method: 'DELETE' });
            if (!res.ok) setErr(await errorFrom(res, t('connections.revoke_failed', 'Could not revoke this share')));
            else onChanged();
        } catch (e) { setErr(e.message); }
        setBusy(false);
    };

    // The server returns grantee_label (email or group name); fall back to the
    // raw id only when it could not be resolved.
    const granteeName = (g) => {
        if (g.grantee_type === 'org') return t('connections.grantee_org', 'Everyone in org');
        if (g.grantee_label) return g.grantee_label;
        return g.grantee_type === 'group'
            ? t('connections.grantee_group', 'Group')
            : t('connections.grantee_user', 'User');
    };

    return (
        <div className="mt-2 p-3 rounded-lg space-y-2.5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t('connections.lend_explainer', "Lending shares this connection with full delegation — the recipient's runs use your credentials.")}
            </p>
            {connection.provider === 'http' && (
                <p className="text-[11px]" style={{ color: '#d97706' }}>
                    {t('connections.lend_http_warning', 'Sharing lends the full credential — recipients can call any URL with it.')}
                </p>
            )}
            <div className="flex flex-wrap gap-2 items-center">
                <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={t('connections.teammate_email_placeholder', 'teammate@company.com')}
                    aria-label={t('connections.teammate_email_label', 'Teammate email')}
                    className={`flex-1 min-w-[180px] ${inputCls}`} style={inputStyle}
                    onKeyDown={e => e.key === 'Enter' && email.trim() && share({ granteeType: 'user', granteeEmail: email.trim() })}
                />
                <select
                    value={expiry} onChange={e => setExpiry(e.target.value)}
                    aria-label={t('connections.expiry_label', 'Expiry')}
                    className={inputCls} style={inputStyle}
                >
                    {EXPIRY_OPTIONS.map(o => <option key={o.label} value={o.value}>{t(o.labelKey, o.label)}</option>)}
                </select>
                <button
                    onClick={() => share({ granteeType: 'user', granteeEmail: email.trim() })}
                    disabled={busy || !email.trim()}
                    className="px-3 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40"
                    style={{ background: 'var(--accent-primary)' }}
                >{t('connections.lend_to_teammate', 'Lend to teammate')}</button>
            </div>
            <button
                onClick={() => share({ granteeType: 'org' })}
                disabled={busy}
                className="text-[12px] underline disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}
            >{t('connections.lend_to_org', 'Lend to everyone in my organization')}</button>
            {err && <ErrorLine>{err}</ErrorLine>}

            {mine.length > 0 && (
                <div className="space-y-1 pt-1">
                    {mine.map(g => (
                        <div key={g.id} className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded" style={{ background: 'var(--bg-secondary)' }}>
                            <span style={{ color: 'var(--text-primary)' }}>
                                {granteeName(g)}
                                {g.resource_type ? ` · ${g.resource_type}` : ''}
                                {g.expires_at ? ` · ${t('connections.expires_on', 'expires')} ${new Date(g.expires_at).toLocaleDateString()}` : ''}
                            </span>
                            <button onClick={() => revoke(g.id)} disabled={busy} title={t('connections.revoke', 'Revoke')} className="opacity-70 hover:opacity-100">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── A single named connection row ───────────────────────────────────
const ConnectionRow = ({ connection, grants, onChanged }) => {
    const { t } = useTranslation();
    const [renaming, setRenaming] = useState(false);
    const [label, setLabel] = useState(connection.label);
    const [sharing, setSharing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    // Keep the rename box in step with the server's value — without this a
    // reopened box still shows whatever was typed before the last reload.
    useEffect(() => { setLabel(connection.label); }, [connection.label]);

    const patch = async (body, fallbackMsg) => {
        setBusy(true); setErr(null);
        try {
            const res = await authFetch(`${BASE}/${connection.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            if (!res.ok) setErr(await errorFrom(res, fallbackMsg));
            else onChanged();
        } catch (e) { setErr(e.message); }
        setBusy(false);
    };

    const saveRename = async () => {
        const next = label.trim();
        if (!next || next === connection.label) { setRenaming(false); setLabel(connection.label); return; }
        await patch({ label: next }, t('connections.rename_failed', 'Could not rename this connection'));
        setRenaming(false);
    };

    // Deleting a credential is destructive and cannot be undone, so it always
    // confirms. A 409 means the connection backs active shares — that needs a
    // second, more explicit confirmation before forcing.
    const remove = async () => {
        if (!window.confirm(t('connections.confirm_delete', 'Delete this connection? Any automation using it will stop working.'))) return;
        setBusy(true); setErr(null);
        try {
            let res = await authFetch(`${BASE}/${connection.id}`, { method: 'DELETE' });
            if (res.status === 409) {
                if (!window.confirm(t('connections.confirm_delete_shared', 'This connection is shared. Delete anyway and revoke all shares?'))) {
                    setBusy(false);
                    return; // nothing changed — don't reload the list
                }
                res = await authFetch(`${BASE}/${connection.id}?force=1`, { method: 'DELETE' });
            }
            if (!res.ok) setErr(await errorFrom(res, t('connections.delete_failed', 'Could not delete this connection')));
            else onChanged();
        } catch (e) { setErr(e.message); }
        setBusy(false);
    };

    const sharedCount = grants.filter(g => g.connection_id === connection.id).length;

    return (
        <div className="px-3 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
                {renaming ? (
                    <>
                        <input
                            value={label} onChange={e => setLabel(e.target.value)} autoFocus
                            aria-label={t('connections.name_label', 'Connection name')}
                            className={`flex-1 ${inputCls}`} style={inputStyle}
                            onKeyDown={e => {
                                if (e.key === 'Enter') saveRename();
                                if (e.key === 'Escape') { setLabel(connection.label); setRenaming(false); }
                            }}
                        />
                        <button onClick={saveRename} disabled={busy} className="p-1" title={t('connections.save', 'Save')}><Check size={14} /></button>
                        <button onClick={() => { setLabel(connection.label); setRenaming(false); }} className="p-1" title={t('connections.cancel', 'Cancel')}><X size={14} /></button>
                    </>
                ) : (
                    <>
                        <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                            {connection.label}
                            {connection.provider === 'http' && (
                                <span className="block text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>
                                    {httpMetaSummary(connection)}
                                </span>
                            )}
                        </span>
                        {connection.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1" style={{ background: 'rgba(5,150,105,0.1)', color: EMERALD }}>
                                <Star size={9} /> {t('connections.default', 'Default')}
                            </span>
                        )}
                        {sharedCount > 0 && (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {t('connections.share_count', '{count} shared', { count: sharedCount })}
                            </span>
                        )}
                        {!connection.isDefault && (
                            <button
                                onClick={() => patch({ makeDefault: true }, t('connections.set_default_failed', 'Could not set this as the default'))}
                                disabled={busy} className="text-[11px] underline" style={{ color: 'var(--text-muted)' }}
                            >{t('connections.set_default', 'Set default')}</button>
                        )}
                        <button onClick={() => setRenaming(true)} className="text-[11px] underline" style={{ color: 'var(--text-muted)' }}>{t('connections.rename', 'Rename')}</button>
                        <button onClick={() => setSharing(v => !v)} className="p-1" title={t('connections.share', 'Share')} style={{ color: sharing ? 'var(--accent-primary)' : 'var(--text-muted)' }}><Share2 size={14} /></button>
                        <button onClick={remove} disabled={busy} className="p-1" title={t('connections.delete', 'Delete')} style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
                    </>
                )}
            </div>
            {err && <ErrorLine>{err}</ErrorLine>}
            {sharing && <SharePanel connection={connection} grants={grants} onChanged={onChanged} />}
        </div>
    );
};

// ── Add-connection inline form ──────────────────────────────────────
const AddConnectionForm = ({ onAdded }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [providerId, setProviderId] = useState(PROVIDERS[0].id);
    const [authTypeId, setAuthTypeId] = useState(HTTP_AUTH_TYPES[0].id);
    const [label, setLabel] = useState('');
    const [fields, setFields] = useState({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const provider = PROVIDER_BY_ID[providerId];
    // Providers with per-auth-type field specs (http): the chosen auth type
    // supplies kind + fields; classic providers keep their static spec.
    const authType = provider.authTypes
        ? (provider.authTypes.find(t2 => t2.id === authTypeId) || provider.authTypes[0])
        : null;
    const activeFields = authType ? authType.fields : provider.fields;
    const reset = () => { setLabel(''); setFields({}); setErr(null); };

    const submit = async () => {
        let secret = {};
        let secretMeta = null;
        if (authType) {
            if (missingHttpAuthFields(authType, fields).length > 0) {
                setErr(t('connections.fill_required', 'Fill in all required fields'));
                return;
            }
            const split = splitHttpAuthValues(authType, fields);
            secret = split.secret;
            if (Object.keys(split.secretMeta).length > 0) secretMeta = split.secretMeta;
        } else {
            for (const f of provider.fields) { if (fields[f.key]) secret[f.key] = fields[f.key]; }
            if (Object.keys(secret).length === 0) {
                setErr(t('connections.fill_credentials', 'Fill in the credential fields'));
                return;
            }
        }
        setBusy(true); setErr(null);
        try {
            const res = await authFetch(BASE, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: providerId,
                    kind: authType ? authType.kind : provider.kind,
                    label: label.trim() || (authType ? `${provider.name} — ${t(authType.nameKey, authType.name)}` : provider.name),
                    secret,
                    ...(secretMeta ? { secretMeta } : {}),
                }),
            });
            if (!res.ok) {
                setErr(await errorFrom(res, t('connections.create_failed', 'Could not create')));
                // Drop the typed secrets even on failure — leaving them in
                // component state keeps them in the DOM indefinitely.
                setFields({});
            } else { reset(); setOpen(false); onAdded(); }
        } catch (e) { setErr(e.message); setFields({}); }
        setBusy(false);
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2" style={{ color: 'var(--accent-primary)' }}>
                <Plus size={14} /> {t('connections.add', 'Add a connection')}
            </button>
        );
    }
    return (
        <div className="p-3 space-y-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex gap-2">
                <select
                    value={providerId} onChange={e => { setProviderId(e.target.value); setFields({}); }}
                    aria-label={t('connections.provider_label', 'Provider')}
                    className={inputCls} style={inputStyle}
                >
                    {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input
                    value={label} onChange={e => setLabel(e.target.value)}
                    placeholder={t('connections.name_placeholder', 'Name (e.g. "{provider} – Work")', { provider: provider.name })}
                    aria-label={t('connections.name_label', 'Connection name')}
                    className={`flex-1 ${inputCls}`} style={inputStyle}
                />
            </div>
            {provider.authTypes && (
                <select
                    aria-label={t('connections.auth_type_label', 'Auth type')} value={authType.id}
                    onChange={e => { setAuthTypeId(e.target.value); setFields({}); }}
                    className={`w-full ${inputCls}`} style={inputStyle}
                >
                    {provider.authTypes.map(at => <option key={at.id} value={at.id}>{t(at.nameKey, at.name)}</option>)}
                </select>
            )}
            {activeFields.map(f => (
                <input
                    key={f.key} type={f.type} value={fields[f.key] || ''}
                    onChange={e => setFields(s => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={t(f.labelKey, f.label)} aria-label={t(f.labelKey, f.label)}
                    autoComplete="off" className={`w-full ${inputCls}`} style={inputStyle}
                />
            ))}
            {err && <ErrorLine>{err}</ErrorLine>}
            <div className="flex gap-2">
                <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40" style={{ background: 'var(--accent-primary)' }}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : t('connections.create', 'Create connection')}
                </button>
                <button onClick={() => { reset(); setOpen(false); }} className="px-4 py-2 rounded-lg text-[13px]" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                    {t('connections.cancel', 'Cancel')}
                </button>
            </div>
        </div>
    );
};

// ── Manager ─────────────────────────────────────────────────────────
const ConnectionsManager = () => {
    const { t } = useTranslation();
    const [connections, setConnections] = useState([]);
    const [grants, setGrants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const [cRes, gRes] = await Promise.all([
                authFetch(BASE),
                authFetch(`${BASE}/grants?mine=outgoing`),
            ]);
            // A failed list used to render as "No named connections yet.",
            // which reads as "your credentials are gone".
            if (!cRes.ok) throw new Error(await errorFrom(cRes, t('connections.load_failed', 'Could not load your connections')));
            const c = await cRes.json();
            const g = gRes.ok ? await gRes.json() : { grants: [] };
            setConnections(c.connections || []);
            setGrants(g.grants || []);
        } catch (e) {
            console.error('[ConnectionsManager]', e);
            setLoadError(e.message || t('connections.load_failed', 'Could not load your connections'));
        }
        setLoading(false);
    }, [t]);

    useEffect(() => { load(); }, [load]);

    // Group connections by provider for display.
    const byProvider = {};
    for (const c of connections) (byProvider[c.provider] ||= []).push(c);

    return (
        <div className="space-y-1.5">
            <GroupLabel>{t('connections.title', 'Connections')}</GroupLabel>
            <p className="text-[11px] px-1 -mt-1 mb-1" style={{ color: 'var(--text-muted)' }}>
                {t('connections.description', 'Keep multiple named credentials per integration and lend a specific one to teammates. Recipients without a lent connection bring their own.')}
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                {loading ? (
                    <div className="px-4 py-6 flex items-center gap-2 text-[13px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                        <Loader2 size={14} className="animate-spin" /> {t('connections.loading', 'Loading…')}
                    </div>
                ) : (
                    <div style={{ background: 'var(--bg-secondary)' }}>
                        {loadError ? (
                            <div className="px-4 py-4">
                                <ErrorLine>{loadError}</ErrorLine>
                                <button onClick={() => { setLoading(true); load(); }} className="text-[12px] underline mt-1" style={{ color: 'var(--accent-primary)' }}>
                                    {t('connections.retry', 'Try again')}
                                </button>
                            </div>
                        ) : (
                            <>
                                {Object.keys(byProvider).length === 0 && (
                                    <p className="px-4 py-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                        {t('connections.empty', 'No named connections yet.')}
                                    </p>
                                )}
                                {Object.entries(byProvider).map(([provider, conns]) => (
                                    <div key={provider} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <div className="px-3 pt-2.5 pb-1 text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                            {PROVIDER_BY_ID[provider]?.name || provider}
                                        </div>
                                        {conns.map(c => <ConnectionRow key={c.id} connection={c} grants={grants} onChanged={load} />)}
                                    </div>
                                ))}
                                <AddConnectionForm onAdded={load} />
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionsManager;
