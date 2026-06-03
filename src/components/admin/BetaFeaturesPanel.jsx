import React, { useState, useEffect } from 'react';
import { CheckSquare, Building2, Sparkles, Loader2, Lock } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

// Project accent — emerald (the no-purple rule bans violet/indigo). Mirrors
// the green used across the subscriptions feature UIs.
const ACCENT = '#10b981';
const ACCENT_SOFT = 'rgba(16, 185, 129, 0.1)';

/**
 * BetaFeaturesPanel — Admin UI to manage beta feature assignments per organization.
 *
 * On cloud (`governed`), the per-org allow-list is set by each org's
 * SUBSCRIPTION plan, not here — so the panel renders read-only and shows the
 * resolved subscription allow-list. On self-hosted it stays editable.
 */
const BetaFeaturesPanel = () => {
    const [registry, setRegistry] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);
    const [governed, setGoverned] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [bfRes, orgsRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/beta-features`),
                authFetch(`${API_BASE}/auth/organizations`),
            ]);
            if (bfRes.ok) {
                const data = await bfRes.json();
                setRegistry(data.registry || []);
                setAssignments(data.assignments || {});
                setGoverned(!!data.governed);
            }
            if (orgsRes.ok) {
                const data = await orgsRes.json();
                setOrgs(data);
            }
        } catch (err) {
            console.error('Failed to load beta features:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleFeature = async (orgId, featureId) => {
        if (governed) return; // read-only on cloud — subscription governs
        const current = assignments[orgId] || [];
        const updated = current.includes(featureId)
            ? current.filter(f => f !== featureId)
            : [...current, featureId];

        setSaving(`${orgId}-${featureId}`);
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations/${orgId}/beta-features`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ features: updated }),
            });
            if (res.ok) {
                const data = await res.json();
                setAssignments(prev => ({ ...prev, [orgId]: data.features }));
            }
        } catch (err) {
            console.error('Failed to toggle beta feature:', err);
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 style={{ width: 24, height: 24, color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (orgs.length === 0) {
        return (
            <div style={{ padding: 24 }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <Building2 style={{ width: 40, height: 40, color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Organizations</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        Create an organization first to assign beta features.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', overflow: 'auto', height: '100%' }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Sparkles style={{ width: 20, height: 20, color: ACCENT }} />
                    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Beta Features
                    </h2>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    Enable beta features per organization. All users in an organization will get access to enabled features. Super admins always have access to all beta features.
                </p>
            </div>

            {/* Governed-by-subscription banner (cloud) */}
            {governed && (
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '12px 14px', borderRadius: 10, marginBottom: 20,
                    border: `1px solid ${ACCENT}`, background: ACCENT_SOFT,
                }}>
                    <Lock style={{ width: 16, height: 16, color: ACCENT, marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        Beta access on this deployment is set by each organization's <strong>subscription plan</strong>.
                        The assignments below are read-only and show what each org's plan grants — to change them,
                        edit the plan in <strong>Subscriptions → Plans</strong>.
                    </p>
                </div>
            )}

            {/* Feature Registry */}
            <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                    Available Features ({registry.length})
                </h3>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                    {registry.map(feature => (
                        <div key={feature.id}
                            style={{
                                padding: '12px 14px',
                                borderRadius: 10,
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-secondary)',
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <CheckSquare style={{ width: 14, height: 14, color: ACCENT }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{feature.name}</span>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Per-Organization Assignments */}
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                Organization Assignments
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orgs.map(org => {
                    const orgFeatures = assignments[org.id] || [];
                    return (
                        <div key={org.id}
                            style={{
                                padding: '14px 16px',
                                borderRadius: 12,
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-secondary)',
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <Building2 style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} />
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {org.name}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                                    {orgFeatures.length} of {registry.length} enabled
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {registry.map(feature => {
                                    const isEnabled = orgFeatures.includes(feature.id);
                                    const isSaving = saving === `${org.id}-${feature.id}`;
                                    return (
                                        <button
                                            key={feature.id}
                                            onClick={() => toggleFeature(org.id, feature.id)}
                                            disabled={isSaving || governed}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 5,
                                                padding: '5px 10px',
                                                borderRadius: 8,
                                                border: `1px solid ${isEnabled ? ACCENT : 'var(--border-subtle)'}`,
                                                background: isEnabled ? ACCENT_SOFT : 'var(--bg-primary)',
                                                color: isEnabled ? ACCENT : 'var(--text-secondary)',
                                                fontSize: 12,
                                                fontWeight: isEnabled ? 600 : 400,
                                                cursor: governed ? 'default' : (isSaving ? 'wait' : 'pointer'),
                                                transition: 'all 0.15s ease',
                                                opacity: isSaving ? 0.6 : 1,
                                            }}
                                        >
                                            <div style={{
                                                width: 14, height: 14,
                                                borderRadius: 4,
                                                border: `2px solid ${isEnabled ? ACCENT : 'var(--border-default)'}`,
                                                background: isEnabled ? ACCENT : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.15s ease',
                                            }}>
                                                {isEnabled && (
                                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </div>
                                            {feature.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default BetaFeaturesPanel;
