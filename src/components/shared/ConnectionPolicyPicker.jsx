import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * ConnectionPolicyPicker — per-integration "Bring-your-own (default) vs Lend my
 * connection" control for a shared resource (agent / webpage / skill / routine).
 *
 * "Lend" creates a connection_grants row bound to this resource (granteeType
 * 'org' — same-org users who can access the resource borrow the owner's
 * connection, full delegation). "BYO" = no grant (recipients connect their own).
 *
 * Only renders providers the resource uses AND the owner has a named connection
 * for — there's nothing to lend otherwise.
 */

const BASE = `${API_BASE}/api/integrations/connections`;

// Providers that support lending today (API-key / basic named connections).
const LENDABLE = new Set(['fireflies', 'youtrack', 'gamma', 'signrequest', 'linkedin', 'github']);
const PROVIDER_NAME = {
    fireflies: 'Fireflies.ai', youtrack: 'YouTrack', gamma: 'Gamma',
    signrequest: 'SignRequest', linkedin: 'LinkedIn', github: 'GitHub',
};

const selStyle = {
    background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)',
};

const ConnectionPolicyPicker = ({ resourceType, resourceId, providers }) => {
    const [connsByProvider, setConnsByProvider] = useState({});
    const [grantByProvider, setGrantByProvider] = useState({}); // provider -> { grantId, connectionId }
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);

    const lendable = (providers || []).filter(p => LENDABLE.has(p));

    const load = useCallback(async () => {
        if (!resourceId || lendable.length === 0) { setLoading(false); return; }
        try {
            const [cRes, gRes] = await Promise.all([
                authFetch(BASE),
                authFetch(`${BASE}/grants?resourceType=${resourceType}&resourceId=${encodeURIComponent(resourceId)}`),
            ]);
            const c = cRes.ok ? await cRes.json() : { connections: [] };
            const g = gRes.ok ? await gRes.json() : { grants: [] };
            const byProv = {};
            for (const conn of (c.connections || [])) (byProv[conn.provider] ||= []).push(conn);
            setConnsByProvider(byProv);
            const grantMap = {};
            for (const grant of (g.grants || [])) {
                if (grant.revoked_at) continue;
                grantMap[grant.provider] = { grantId: grant.id, connectionId: grant.connection_id };
            }
            setGrantByProvider(grantMap);
        } catch (e) { console.error('[ConnectionPolicyPicker]', e); }
        setLoading(false);
    }, [resourceType, resourceId, lendable.length]);

    useEffect(() => { load(); }, [load]);

    const onChange = async (provider, value) => {
        setBusy(provider);
        try {
            const existing = grantByProvider[provider];
            // Revoke any current grant for this provider+resource first.
            if (existing?.grantId) await authFetch(`${BASE}/grants/${existing.grantId}`, { method: 'DELETE' });
            // value === '' means bring-your-own (no grant).
            if (value) {
                await authFetch(`${BASE}/${value}/grants`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ granteeType: 'org', resourceType, resourceId }),
                });
            }
            await load();
        } catch (e) { console.error(e); }
        setBusy(null);
    };

    // Nothing to lend → render nothing (no clutter).
    const rows = lendable.filter(p => (connsByProvider[p] || []).length > 0);
    if (loading || !resourceId || rows.length === 0) {
        if (!resourceId && lendable.length > 0) {
            return <p className="text-[11px] text-muted mt-2">Save the agent to configure connection lending.</p>;
        }
        return null;
    }

    return (
        <div className="mt-4 rounded-xl p-3" style={{ border: '1px solid var(--border-subtle)', background: 'rgba(16,185,129,0.04)' }}>
            <p className="text-xs font-medium text-primary">Connection lending</p>
            <p className="text-[11px] text-muted mt-0.5 mb-2">
                Recipients use their own credentials by default. Lend one of your connections to let them run as you (full delegation).
            </p>
            <div className="space-y-2">
                {rows.map(provider => {
                    const conns = connsByProvider[provider] || [];
                    const current = grantByProvider[provider]?.connectionId || '';
                    return (
                        <div key={provider} className="flex items-center gap-2">
                            <span className="text-[12px] text-primary flex-1">{PROVIDER_NAME[provider] || provider}</span>
                            <select
                                value={current}
                                disabled={busy === provider}
                                onChange={e => onChange(provider, e.target.value)}
                                className="px-2.5 py-1.5 rounded-lg border outline-none text-[12px]"
                                style={selStyle}
                            >
                                <option value="">Bring-your-own (default)</option>
                                {conns.map(c => (
                                    <option key={c.id} value={c.id}>Lend: {c.label}</option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ConnectionPolicyPicker;
