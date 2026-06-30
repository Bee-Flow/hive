import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Plus, Trash2, Share2, Star, Check, X, Loader2 } from 'lucide-react';

const BASE = `${API_BASE}/api/integrations/connections`;
const EMERALD = '#059669';

// Providers that support multiple named API-key / basic connections. The field
// keys MUST match the server's legacy mirror map so the default connection
// keeps the existing integration code working.
const PROVIDERS = [
    { id: 'fireflies', name: 'Fireflies.ai', kind: 'api_key', fields: [{ key: 'api_key', label: 'API key', type: 'password' }] },
    { id: 'gamma', name: 'Gamma', kind: 'api_key', fields: [{ key: 'api_key', label: 'API key', type: 'password' }] },
    { id: 'github', name: 'GitHub', kind: 'api_key', fields: [{ key: 'token', label: 'Personal access token', type: 'password' }] },
    { id: 'youtrack', name: 'YouTrack', kind: 'basic', fields: [{ key: 'url', label: 'Instance URL', type: 'text' }, { key: 'token', label: 'Permanent token', type: 'password' }] },
    { id: 'signrequest', name: 'SignRequest', kind: 'basic', fields: [{ key: 'subdomain', label: 'Subdomain', type: 'text' }, { key: 'token', label: 'API token', type: 'password' }] },
    { id: 'afas-profit', name: 'AFAS Profit', kind: 'basic', fields: [{ key: 'member_number', label: 'Member number (digits, e.g. 12345)', type: 'text' }, { key: 'token', label: 'AppConnector token (XML or code)', type: 'password' }, { key: 'env_type', label: 'Environment (production / test / accept)', type: 'text' }] },
    { id: 'nmbrs', name: 'NMBRS', kind: 'basic', fields: [{ key: 'api_mode', label: 'API (soap / rest)', type: 'text' }, { key: 'subdomain', label: 'Subdomain (e.g. mycompany)', type: 'text' }, { key: 'email', label: 'Login email (SOAP only)', type: 'text' }, { key: 'token', label: 'API token', type: 'password' }, { key: 'env', label: 'Environment (production / sandbox)', type: 'text' }] },
];
const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));

const EXPIRY_OPTIONS = [
    { label: 'No expiry', value: '' },
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
];

const inputStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' };
const inputCls = 'px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors';

const GroupLabel = ({ children }) => (
    <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>{children}</p>
);

function daysFromNowIso(days) {
    if (!days) return null;
    return new Date(Date.now() + days * 86400000).toISOString();
}

// ── Share panel for a single connection ─────────────────────────────
const SharePanel = ({ connection, grants, onChanged }) => {
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
            if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Share failed'); }
            else { setEmail(''); onChanged(); }
        } catch (e) { setErr(e.message); }
        setBusy(false);
    };

    const revoke = async (grantId) => {
        setBusy(true);
        try { await authFetch(`${BASE}/grants/${grantId}`, { method: 'DELETE' }); onChanged(); }
        catch (e) { console.error(e); }
        setBusy(false);
    };

    return (
        <div className="mt-2 p-3 rounded-lg space-y-2.5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Lending shares this connection with full delegation — the recipient's runs use your credentials.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
                <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className={`flex-1 min-w-[180px] ${inputCls}`} style={inputStyle}
                    onKeyDown={e => e.key === 'Enter' && email.trim() && share({ granteeType: 'user', granteeEmail: email.trim() })}
                />
                <select value={expiry} onChange={e => setExpiry(e.target.value)} className={inputCls} style={inputStyle}>
                    {EXPIRY_OPTIONS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                </select>
                <button
                    onClick={() => share({ granteeType: 'user', granteeEmail: email.trim() })}
                    disabled={busy || !email.trim()}
                    className="px-3 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40"
                    style={{ background: 'var(--accent-primary)' }}
                >Lend to teammate</button>
            </div>
            <button
                onClick={() => share({ granteeType: 'org' })}
                disabled={busy}
                className="text-[12px] underline disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}
            >Lend to everyone in my organization</button>
            {err && <p className="text-[11px]" style={{ color: '#dc2626' }}>{err}</p>}

            {mine.length > 0 && (
                <div className="space-y-1 pt-1">
                    {mine.map(g => (
                        <div key={g.id} className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded" style={{ background: 'var(--bg-secondary)' }}>
                            <span style={{ color: 'var(--text-primary)' }}>
                                {g.grantee_type === 'org' ? 'Everyone in org' : g.grantee_type === 'group' ? `Group ${g.grantee_id}` : `User ${g.grantee_id}`}
                                {g.resource_type ? ` · ${g.resource_type}` : ''}
                                {g.expires_at ? ` · expires ${new Date(g.expires_at).toLocaleDateString()}` : ''}
                            </span>
                            <button onClick={() => revoke(g.id)} disabled={busy} title="Revoke" className="opacity-70 hover:opacity-100">
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
    const [renaming, setRenaming] = useState(false);
    const [label, setLabel] = useState(connection.label);
    const [sharing, setSharing] = useState(false);
    const [busy, setBusy] = useState(false);

    const patch = async (body) => {
        setBusy(true);
        try { await authFetch(`${BASE}/${connection.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); onChanged(); }
        catch (e) { console.error(e); }
        setBusy(false);
    };
    const remove = async () => {
        setBusy(true);
        try {
            let res = await authFetch(`${BASE}/${connection.id}`, { method: 'DELETE' });
            if (res.status === 409 && window.confirm('This connection is shared. Delete anyway and revoke all shares?')) {
                res = await authFetch(`${BASE}/${connection.id}?force=1`, { method: 'DELETE' });
            }
            onChanged();
        } catch (e) { console.error(e); }
        setBusy(false);
    };

    const sharedCount = grants.filter(g => g.connection_id === connection.id).length;

    return (
        <div className="px-3 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
                {renaming ? (
                    <>
                        <input value={label} onChange={e => setLabel(e.target.value)} autoFocus className={`flex-1 ${inputCls}`} style={inputStyle}
                            onKeyDown={e => { if (e.key === 'Enter') { patch({ label }); setRenaming(false); } if (e.key === 'Escape') setRenaming(false); }} />
                        <button onClick={() => { patch({ label }); setRenaming(false); }} className="p-1" title="Save"><Check size={14} /></button>
                        <button onClick={() => { setLabel(connection.label); setRenaming(false); }} className="p-1" title="Cancel"><X size={14} /></button>
                    </>
                ) : (
                    <>
                        <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{connection.label}</span>
                        {connection.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1" style={{ background: 'rgba(5,150,105,0.1)', color: EMERALD }}>
                                <Star size={9} /> Default
                            </span>
                        )}
                        {sharedCount > 0 && (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sharedCount} share{sharedCount > 1 ? 's' : ''}</span>
                        )}
                        {!connection.isDefault && (
                            <button onClick={() => patch({ makeDefault: true })} disabled={busy} className="text-[11px] underline" style={{ color: 'var(--text-muted)' }}>Set default</button>
                        )}
                        <button onClick={() => setRenaming(true)} className="text-[11px] underline" style={{ color: 'var(--text-muted)' }}>Rename</button>
                        <button onClick={() => setSharing(v => !v)} className="p-1" title="Share" style={{ color: sharing ? 'var(--accent-primary)' : 'var(--text-muted)' }}><Share2 size={14} /></button>
                        <button onClick={remove} disabled={busy} className="p-1" title="Delete" style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
                    </>
                )}
            </div>
            {sharing && <SharePanel connection={connection} grants={grants} onChanged={onChanged} />}
        </div>
    );
};

// ── Add-connection inline form ──────────────────────────────────────
const AddConnectionForm = ({ onAdded }) => {
    const [open, setOpen] = useState(false);
    const [providerId, setProviderId] = useState(PROVIDERS[0].id);
    const [label, setLabel] = useState('');
    const [fields, setFields] = useState({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const provider = PROVIDER_BY_ID[providerId];
    const reset = () => { setLabel(''); setFields({}); setErr(null); };

    const submit = async () => {
        const secret = {};
        for (const f of provider.fields) { if (fields[f.key]) secret[f.key] = fields[f.key]; }
        if (Object.keys(secret).length === 0) { setErr('Fill in the credential fields'); return; }
        setBusy(true); setErr(null);
        try {
            const res = await authFetch(BASE, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerId, kind: provider.kind, label: label.trim() || provider.name, secret }),
            });
            if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Could not create'); }
            else { reset(); setOpen(false); onAdded(); }
        } catch (e) { setErr(e.message); }
        setBusy(false);
    };

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2" style={{ color: 'var(--accent-primary)' }}>
                <Plus size={14} /> Add a connection
            </button>
        );
    }
    return (
        <div className="p-3 space-y-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex gap-2">
                <select value={providerId} onChange={e => { setProviderId(e.target.value); setFields({}); }} className={inputCls} style={inputStyle}>
                    {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder={`Name (e.g. "${provider.name} – Work")`} className={`flex-1 ${inputCls}`} style={inputStyle} />
            </div>
            {provider.fields.map(f => (
                <input key={f.key} type={f.type} value={fields[f.key] || ''} onChange={e => setFields(s => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={f.label} className={`w-full ${inputCls}`} style={inputStyle} />
            ))}
            {err && <p className="text-[11px]" style={{ color: '#dc2626' }}>{err}</p>}
            <div className="flex gap-2">
                <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40" style={{ background: 'var(--accent-primary)' }}>
                    {busy ? <Loader2 size={14} className="animate-spin" /> : 'Create connection'}
                </button>
                <button onClick={() => { reset(); setOpen(false); }} className="px-4 py-2 rounded-lg text-[13px]" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>Cancel</button>
            </div>
        </div>
    );
};

// ── Manager ─────────────────────────────────────────────────────────
const ConnectionsManager = () => {
    const [connections, setConnections] = useState([]);
    const [grants, setGrants] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const [cRes, gRes] = await Promise.all([
                authFetch(BASE),
                authFetch(`${BASE}/grants?mine=outgoing`),
            ]);
            const c = cRes.ok ? await cRes.json() : { connections: [] };
            const g = gRes.ok ? await gRes.json() : { grants: [] };
            setConnections(c.connections || []);
            setGrants(g.grants || []);
        } catch (e) { console.error('[ConnectionsManager]', e); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Group connections by provider for display.
    const byProvider = {};
    for (const c of connections) (byProvider[c.provider] ||= []).push(c);

    return (
        <div className="space-y-1.5">
            <GroupLabel>Connections</GroupLabel>
            <p className="text-[11px] px-1 -mt-1 mb-1" style={{ color: 'var(--text-muted)' }}>
                Keep multiple named credentials per integration and lend a specific one to teammates. Recipients without a lent connection bring their own.
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                {loading ? (
                    <div className="px-4 py-6 flex items-center gap-2 text-[13px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                        <Loader2 size={14} className="animate-spin" /> Loading…
                    </div>
                ) : (
                    <div style={{ background: 'var(--bg-secondary)' }}>
                        {Object.keys(byProvider).length === 0 && (
                            <p className="px-4 py-4 text-[12px]" style={{ color: 'var(--text-muted)' }}>No named connections yet.</p>
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionsManager;
