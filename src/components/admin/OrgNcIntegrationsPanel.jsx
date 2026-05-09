import React, { useEffect, useState, useCallback } from 'react';
import { Cloud, Save, Loader2, Check, AlertTriangle, ChevronRight, Users } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * Org-admin UI for toggling Nextcloud integrations org-wide and adding
 * per-group exceptions. Only rendered for NC-bound organisations (gated
 * by user.ncOrg upstream in IntegrationsSection / OrganisationSection).
 *
 * Conflict resolution at runtime is "enable wins" — see
 * server/core/integrationTools.js isAppOn().
 */
const OrgNcIntegrationsPanel = ({ user }) => {
    const orgId = user?.organizationId;
    const [config, setConfig] = useState(null);          // { ncCatalog, enabled, usingDefaults }
    const [groups, setGroups] = useState([]);             // [{ id, name, disabledIntegrations, userCount }]
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [expandedGroup, setExpandedGroup] = useState(null);

    const load = useCallback(async () => {
        if (!orgId) return;
        try {
            const [cfgRes, grpRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/admin/${orgId}/nc-integrations`),
                authFetch(`${API_BASE}/auth/admin/${orgId}/nc-integrations/groups`),
            ]);
            if (cfgRes.ok) setConfig(await cfgRes.json());
            if (grpRes.ok) setGroups((await grpRes.json()).groups || []);
        } catch (e) {
            console.error('[NcIntegrations] load:', e);
        } finally { setLoading(false); }
    }, [orgId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!message) return;
        const t = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(t);
    }, [message]);

    const toggleOrgWide = (id) => {
        if (!config) return;
        const next = config.enabled.includes(id)
            ? config.enabled.filter(x => x !== id)
            : [...config.enabled, id];
        setConfig({ ...config, enabled: next });
    };

    const handleSaveOrg = async () => {
        if (!config) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/admin/${orgId}/nc-integrations`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: config.enabled }),
            });
            if (!res.ok) throw new Error('Save failed');
            setMessage({ type: 'ok', text: 'Saved' });
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally { setSaving(false); }
    };

    const toggleGroupDisable = async (groupId, integrationId) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        const cur = Array.isArray(group.disabledIntegrations) ? group.disabledIntegrations : [];
        const next = cur.includes(integrationId)
            ? cur.filter(x => x !== integrationId)
            : [...cur, integrationId];
        // Optimistic
        setGroups(gs => gs.map(g => g.id === groupId ? { ...g, disabledIntegrations: next } : g));
        try {
            const res = await authFetch(`${API_BASE}/auth/admin/${orgId}/nc-integrations/groups/${encodeURIComponent(groupId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ disabledIntegrations: next }),
            });
            if (!res.ok) throw new Error('Save failed');
        } catch (e) {
            // Revert on failure
            setGroups(gs => gs.map(g => g.id === groupId ? { ...g, disabledIntegrations: cur } : g));
            setMessage({ type: 'error', text: e.message });
        }
    };

    if (loading) {
        return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
    }
    if (!config) {
        return <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Nextcloud integrations are only available for organisations bound to a Nextcloud instance.</div>;
    }

    const catalog = config.ncCatalog || [];

    return (
        <div className="space-y-5">
            <header className="flex items-center gap-2">
                <Cloud className="w-5 h-5" style={{ color: '#0082C9' }} />
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Nextcloud integrations</h2>
            </header>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Choose which Nextcloud tools your agents may use, and exclude specific groups.
                A user keeps a tool as long as at least one of their groups still allows it.
            </p>

            {/* Org-wide toggles */}
            <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Org-wide</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Default for every member of this organisation.</p>
                    </div>
                    <button
                        onClick={handleSaveOrg}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {catalog.map(it => {
                        const on = config.enabled.includes(it.id);
                        return (
                            <label
                                key={it.id}
                                className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                                style={{ background: on ? 'rgba(0,130,201,0.06)' : 'var(--bg-tertiary)', border: `1px solid ${on ? 'rgba(0,130,201,0.30)' : 'var(--border-subtle)'}` }}
                            >
                                <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleOrgWide(it.id)}
                                    className="mt-0.5 accent-[#0082C9]"
                                />
                                <div className="min-w-0">
                                    <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{it.name}</div>
                                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{it.description}</div>
                                </div>
                            </label>
                        );
                    })}
                </div>
                {message && (
                    <p className={`mt-3 text-xs flex items-center gap-1.5 ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                        {message.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                        {message.text}
                    </p>
                )}
            </section>

            {/* Per-group exceptions */}
            <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div className="mb-3">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Per-group exceptions</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Disable specific tools for a Nextcloud group. Groups inherit the org-wide settings unless something is checked below.
                    </p>
                </div>
                {groups.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No Nextcloud groups synced yet. Sync runs automatically every 6 hours, or use "Sync now" in Nextcloud Sync.</p>
                ) : (
                    <div className="space-y-1.5">
                        {groups.map(g => {
                            const isOpen = expandedGroup === g.id;
                            const disabledCount = (g.disabledIntegrations || []).length;
                            return (
                                <div key={g.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedGroup(isOpen ? null : g.id)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5 transition-transform" style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                                        <span className="text-[13px] font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
                                        <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                            <Users className="w-3 h-3" /> {g.userCount}
                                        </span>
                                        {disabledCount > 0 && (
                                            <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>
                                                {disabledCount} disabled
                                            </span>
                                        )}
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                            {catalog.map(it => {
                                                const orgOn = config.enabled.includes(it.id);
                                                const groupDisabled = (g.disabledIntegrations || []).includes(it.id);
                                                return (
                                                    <label
                                                        key={it.id}
                                                        className={`flex items-center gap-2 p-2 rounded-lg text-[12px] ${orgOn ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                                        title={orgOn ? `Block ${it.name} for this group` : 'Enable org-wide first'}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            disabled={!orgOn}
                                                            checked={groupDisabled}
                                                            onChange={() => orgOn && toggleGroupDisable(g.id, it.id)}
                                                            className="accent-amber-500"
                                                        />
                                                        <span style={{ color: 'var(--text-primary)' }}>Disable {it.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
};

export default OrgNcIntegrationsPanel;
