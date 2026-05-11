import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Sparkles, Settings, Save, Loader2, Check, AlertTriangle } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { INTEGRATION_CATALOG, NEXTCLOUD_INTEGRATION_IDS } from '../../config/integrationCatalog';

/**
 * Org-admin UI for activating beta features and (non-Nextcloud) integrations
 * within the allow-list the super admin has granted to this organisation.
 *
 * Two stacked sub-panels (Beta Features above, Integrations below). Each is
 * a card grid with a switch per item; "Save" persists the selection. The
 * runtime gates intersect this selection with the super-admin allow-list so
 * a stale toggle here cannot grant access to something the super admin has
 * since revoked.
 */
const OrgFeatureTogglesPanel = ({ user }) => {
    const orgId = user?.organizationId;
    const [betaAllowed, setBetaAllowed] = useState([]);
    const [betaEnabled, setBetaEnabled] = useState([]);
    const [betaRegistry, setBetaRegistry] = useState([]);
    const [intAllowed, setIntAllowed] = useState([]);
    const [intEnabled, setIntEnabled] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingBeta, setSavingBeta] = useState(false);
    const [savingInt, setSavingInt] = useState(false);
    const [message, setMessage] = useState(null);

    const load = useCallback(async () => {
        if (!orgId) return;
        try {
            const [betaRes, intRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/organizations/${encodeURIComponent(orgId)}/active-beta-features`),
                authFetch(`${API_BASE}/auth/organizations/${encodeURIComponent(orgId)}/active-integrations`),
            ]);
            if (betaRes.ok) {
                const j = await betaRes.json();
                setBetaAllowed(Array.isArray(j.allowed) ? j.allowed : []);
                setBetaEnabled(Array.isArray(j.enabled) ? j.enabled : []);
                setBetaRegistry(Array.isArray(j.registry) ? j.registry : []);
            }
            if (intRes.ok) {
                const j = await intRes.json();
                // Backend already strips NC IDs but filter again client-side
                // so a stale snapshot can't sneak one in.
                const allowed = (j.allowed || []).filter(id => !NEXTCLOUD_INTEGRATION_IDS.has(id));
                setIntAllowed(allowed);
                setIntEnabled((j.enabled || []).filter(id => allowed.includes(id)));
            }
        } catch (e) {
            console.error('[OrgFeatures] load:', e);
            setMessage({ type: 'error', text: 'Failed to load' });
        } finally { setLoading(false); }
    }, [orgId]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!message) return;
        const t = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(t);
    }, [message]);

    const toggleBeta = (id) => {
        setBetaEnabled(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleIntegration = (id) => {
        setIntEnabled(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const saveBeta = async () => {
        setSavingBeta(true);
        try {
            const res = await authFetch(
                `${API_BASE}/auth/organizations/${encodeURIComponent(orgId)}/active-beta-features`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: betaEnabled }),
                }
            );
            if (!res.ok) throw new Error('Save failed');
            const j = await res.json();
            setBetaEnabled(Array.isArray(j.enabled) ? j.enabled : []);
            setMessage({ type: 'ok', text: 'Beta features saved' });
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally { setSavingBeta(false); }
    };

    const saveIntegrations = async () => {
        setSavingInt(true);
        try {
            const res = await authFetch(
                `${API_BASE}/auth/organizations/${encodeURIComponent(orgId)}/active-integrations`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: intEnabled }),
                }
            );
            if (!res.ok) throw new Error('Save failed');
            const j = await res.json();
            setIntEnabled(Array.isArray(j.enabled) ? j.enabled : []);
            setMessage({ type: 'ok', text: 'Integrations saved' });
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally { setSavingInt(false); }
    };

    // Group integrations by category for readability.
    const intByCategory = useMemo(() => {
        const groups = new Map();
        for (const id of intAllowed) {
            const item = INTEGRATION_CATALOG.find(i => i.id === id);
            if (!item) continue;
            const key = item.category || 'Other';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        }
        return groups;
    }, [intAllowed]);

    const betaItems = useMemo(() => {
        return betaAllowed.map(id => {
            const reg = betaRegistry.find(f => f.id === id);
            return reg || { id, name: id, description: '' };
        });
    }, [betaAllowed, betaRegistry]);

    if (!orgId) return null;

    if (loading) {
        return (
            <div className="p-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    const Card = ({ id, title, description, checked, onChange }) => (
        <div
            key={id}
            className="flex items-start gap-3 rounded-xl p-4 cursor-pointer"
            style={{
                background: 'var(--bg-primary)',
                border: `1px solid ${checked ? 'var(--accent-primary, #10b981)' : 'var(--border-subtle)'}`,
                transition: 'border-color 120ms ease',
            }}
            onClick={() => onChange(id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(id); } }}
        >
            <input
                type="checkbox"
                checked={checked}
                readOnly
                style={{ marginTop: 4, accentColor: 'var(--accent-primary, #10b981)' }}
            />
            <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</div>
                {description ? (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</div>
                ) : null}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Status banner */}
            {message ? (
                <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{
                        background: message.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        color: message.type === 'ok' ? '#059669' : '#dc2626',
                        border: `1px solid ${message.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}
                >
                    {message.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </div>
            ) : null}

            {/* ── Beta Features ─────────────────────────────────────── */}
            <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <header className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary, #10b981)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Beta features</h2>
                    </div>
                    <button
                        onClick={saveBeta}
                        disabled={savingBeta || betaAllowed.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                        style={{
                            background: 'var(--accent-primary, #10b981)',
                            color: 'white',
                            opacity: (savingBeta || betaAllowed.length === 0) ? 0.6 : 1,
                            cursor: (savingBeta || betaAllowed.length === 0) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {savingBeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                    </button>
                </header>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                    Turn on the beta features your team should have access to. Only features granted by your platform administrator are listed here.
                </p>
                {betaItems.length === 0 ? (
                    <div className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>
                        No beta features granted to this organisation yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {betaItems.map(f => (
                            <Card
                                key={f.id}
                                id={f.id}
                                title={f.name}
                                description={f.description}
                                checked={betaEnabled.includes(f.id)}
                                onChange={toggleBeta}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* ── Integrations ──────────────────────────────────────── */}
            <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <header className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Integrations</h2>
                    </div>
                    <button
                        onClick={saveIntegrations}
                        disabled={savingInt || intAllowed.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                        style={{
                            background: 'var(--accent-primary, #10b981)',
                            color: 'white',
                            opacity: (savingInt || intAllowed.length === 0) ? 0.6 : 1,
                            cursor: (savingInt || intAllowed.length === 0) ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {savingInt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                    </button>
                </header>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                    Decide which third-party tools your agents are allowed to use. Nextcloud is configured separately in the panel below.
                </p>
                {intAllowed.length === 0 ? (
                    <div className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>
                        No integrations granted to this organisation yet.
                    </div>
                ) : (
                    <div className="space-y-5">
                        {[...intByCategory.entries()].map(([cat, items]) => (
                            <div key={cat}>
                                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{cat}</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {items.map(i => (
                                        <Card
                                            key={i.id}
                                            id={i.id}
                                            title={i.label}
                                            description={i.description}
                                            checked={intEnabled.includes(i.id)}
                                            onChange={toggleIntegration}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default OrgFeatureTogglesPanel;
