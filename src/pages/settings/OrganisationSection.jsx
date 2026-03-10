import React, { useState, useEffect } from 'react';
import { Building2, Users, Link2 } from 'lucide-react';
import OrgInfoPanel from '../../components/admin/OrgInfoPanel';
import OrgUsersPanel from '../../components/admin/OrgUsersPanel';
import N8nSection from './N8nSection';
import { API_BASE, authFetch } from '../../utils/helpers';

// ── Google Maps Config Card ──────────────────────────────────────
const GoogleMapsConfig = () => {
    const [key, setKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [hasKey, setHasKey] = useState(false);

    useEffect(() => {
        authFetch(`${API_BASE}/ai/config`)
            .then(r => r.json())
            .then(d => setHasKey(!!d.hasGoogleMapsKey))
            .catch(() => {});
    }, []);

    const save = async () => {
        if (!key.trim()) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ googleMapsApiKey: key })
            });
            if (res.ok) { setHasKey(true); setKey(''); }
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    return (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }}>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
                        <circle cx="12" cy="9" r="2.5" fill="#fff"/>
                    </svg>
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Google Maps</p>
                        {hasKey && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(34,197,94,0.10)', color: '#4ade80' }}>
                                Connected
                            </span>
                        )}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Directions, route maps & places search in chat</p>
                </div>
            </div>
            <div className="flex gap-2">
                <input
                    type="password" value={key} onChange={e => setKey(e.target.value)}
                    placeholder={hasKey ? '••••••••••••••••' : 'Enter Google Maps API key'}
                    className="flex-1 px-3 py-2 rounded-lg border outline-none text-sm focus:border-[var(--accent-primary)] transition-colors"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    onKeyDown={e => e.key === 'Enter' && save()}
                />
                <button onClick={save} disabled={saving || !key.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                    style={{ background: 'var(--accent-primary)' }}>
                    {saving ? '…' : 'Save'}
                </button>
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Enable <strong>Directions API</strong>, <strong>Places API</strong> & <strong>Maps Embed API</strong> in{' '}
                <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>Google Cloud Console</a>
            </p>
        </div>
    );
};

const SUB_TABS = [
    { id: 'info', label: 'Organisation', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
];

/**
 * Organisation section inside the unified Settings page.
 * Renders the same panels as the old standalone OrgSettings page
 * but inside the settings layout with matching styling.
 *
 * Visibility is controlled by the parent (AdvancedSettings) —
 * the nav item is only rendered for users with org_admin / all / admin_* permissions.
 */
const OrganisationSection = ({ user }) => {
    const [subTab, setSubTab] = useState('info');

    // Determine what this user can see
    const perms = user?.permissions || [];
    const isFullAdmin = perms.includes('all') || perms.some(p => p.startsWith('admin_'));
    const isOrgAdmin = perms.includes('org_admin') || isFullAdmin;
    const canManageUsers = isOrgAdmin;

    // Filter tabs based on permissions
    const visibleTabs = SUB_TABS.filter(t => {
        if (t.id === 'users') return canManageUsers;
        if (t.id === 'integrations') return isOrgAdmin;
        return true; // info tab always visible
    });

    return (
        <div>
            {/* Description */}
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                Manage your organisation's profile, team members, and integrations.
            </p>

            {/* Sub-tab pills */}
            <div style={{
                display: 'flex',
                gap: '4px',
                padding: '3px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '24px',
            }}>
                {visibleTabs.map(({ id, label, icon: Icon }) => {
                    const active = subTab === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setSubTab(id)}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '7px 12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: active ? 600 : 500,
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all .15s ease',
                                background: active ? 'var(--bg-primary)' : 'transparent',
                                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                                boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                            }}
                        >
                            <Icon style={{ width: 14, height: 14, opacity: active ? 1 : 0.55 }} />
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Panel content */}
            {subTab === 'info' && (
                <div style={{ margin: '0 -32px' }}>
                    <OrgInfoPanel user={user} />
                </div>
            )}

            {subTab === 'users' && canManageUsers && (
                <div style={{ margin: '0 -32px' }}>
                    <OrgUsersPanel user={user} />
                </div>
            )}

            {subTab === 'integrations' && isOrgAdmin && (
                <div>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Organisation Integrations</h3>
                    <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                        These integrations are shared across all members of your organisation.
                    </p>
                    <div className="rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <div className="flex items-center gap-2.5 mb-3">
                            <img src="/n8n-color.png" alt="n8n" className="w-6 h-6 object-contain" />
                            <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>n8n</p>
                                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Connect n8n workflows as AI tools for your organisation</p>
                            </div>
                        </div>
                        <N8nSection />
                    </div>
                    <GoogleMapsConfig />
                </div>
            )}
        </div>
    );
};

export default OrganisationSection;
