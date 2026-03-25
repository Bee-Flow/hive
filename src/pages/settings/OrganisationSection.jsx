import React, { useState, useCallback, useRef } from 'react';
import { CreditCard, KeyRound, Shield, Palette, FileText, Users, Link2 } from 'lucide-react';
import OrgInfoPanel, { SECTIONS } from '../../components/admin/OrgInfoPanel';
import OrgUsersPanel from '../../components/admin/OrgUsersPanel';
import N8nSection from './N8nSection';
import { API_BASE, authFetch } from '../../utils/helpers';

// ── Google Maps (same logic, macOS IntegrationRow style) ─────────────────────
const GoogleMapsRow = ({ last }) => {
    const [key, setKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [open, setOpen] = useState(false);

    React.useEffect(() => {
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
                body: JSON.stringify({ googleMapsApiKey: key }),
            });
            if (res.ok) { setHasKey(true); setKey(''); setOpen(false); }
        } catch (e) { console.error(e); }
        setSaving(false);
    };

    return (
        <div style={{ borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
            <button
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                style={{ background: 'var(--bg-secondary)' }}
                onClick={() => setOpen(v => !v)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            >
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: '18px', height: '18px' }}>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-black">Google Maps</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {hasKey ? 'Directions, route maps & places search — configured' : 'Directions, route maps & places search in chat'}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {hasKey && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>Connected</span>}
                    <svg className="transition-transform" style={{ color: 'var(--text-muted)', width: '13px', height: '13px', transform: open ? 'rotate(90deg)' : 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </button>
            {open && (
                <div className="px-5 pb-4 pt-2 space-y-2" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex gap-2">
                        <input type="password" value={key} onChange={e => setKey(e.target.value)}
                            placeholder={hasKey ? '••••••••••••••••' : 'Enter Google Maps API key'}
                            className="flex-1 px-3 py-2 rounded-lg border outline-none text-[13px] focus:border-[var(--accent-primary)] transition-colors"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            onKeyDown={e => e.key === 'Enter' && save()} />
                        <button onClick={save} disabled={saving || !key.trim()}
                            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40"
                            style={{ background: 'var(--accent-primary)' }}>{saving ? '…' : 'Save'}</button>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Enable <strong>Directions API</strong>, <strong>Places API</strong> & <strong>Maps Embed API</strong> in{' '}
                        <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>Google Cloud Console</a>
                    </p>
                </div>
            )}
        </div>
    );
};

// ── The sub-nav items ─────────────────────────────────────────────────────────
const INFO_SECTIONS = SECTIONS; // [license, auth, privacy, branding, legal]

const ALL_SECTIONS = [
    ...INFO_SECTIONS,
    { id: 'users', label: 'Users & Groups', icon: Users, color: '#3b82f6' },
    { id: 'integrations', label: 'Integrations', icon: Link2, color: '#0ea5e9' },
];

// ── NavItem (matching the macOS-style nav from AdvancedSettings) ──────────────
const SubNavItem = ({ section, isActive, onClick }) => {
    const Icon = section.icon;
    return (
        <button
            onClick={() => onClick(section.id)}
            className="w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-left transition-all duration-100"
            style={{
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
        >
            <div className="flex-shrink-0" style={{ color: isActive ? section.color : 'var(--text-muted)' }}>
                <Icon style={{ width: '14px', height: '14px' }} />
            </div>
            <span className={`text-[13px] ${isActive ? 'font-medium text-black' : 'text-black'}`}>{section.label}</span>
        </button>
    );
};

// ── OrganisationSection ───────────────────────────────────────────────────────
const OrganisationSection = ({ user }) => {
    const [activeSection, setActiveSection] = useState('license');
    const [orgState, setOrgState] = useState({ hasChanges: false, saving: false, message: null, handleSave: null });

    const perms = user?.permissions || [];
    const isFullAdmin = perms.includes('all') || perms.some(p => p.startsWith('admin_'));
    const isOrgAdmin = perms.includes('org_admin') || isFullAdmin;
    const canManageUsers = isOrgAdmin;

    const ei = user?.enabledIntegrations;
    const showN8n = !ei || ei.includes('n8n');
    const showGoogleMaps = !ei || ei.includes('google-maps');

    // Info sections always visible; users/integrations gated on permissions
    const visibleSections = ALL_SECTIONS.filter(s => {
        if (s.id === 'users') return canManageUsers;
        if (s.id === 'integrations') return isOrgAdmin;
        return true;
    });

    const isInfoSection = INFO_SECTIONS.some(s => s.id === activeSection);

    return (
        <div className="flex h-full overflow-hidden" style={{ minHeight: 0 }}>
            {/* ── Sub-nav ── */}
            <div className="flex-shrink-0 flex flex-col gap-0.5 pr-4 pt-1" style={{ width: '160px' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-1" style={{ color: 'var(--text-muted)' }}>Organisation</p>
                {visibleSections.slice(0, INFO_SECTIONS.length).map(s => (
                    <SubNavItem key={s.id} section={s} isActive={activeSection === s.id} onClick={setActiveSection} />
                ))}

                {/* Separator before Users/Integrations */}
                {(canManageUsers || isOrgAdmin) && (
                    <>
                        <div className="mx-3 my-1.5" style={{ height: '1px', background: 'var(--border-subtle)' }} />
                        {visibleSections.filter(s => s.id === 'users' || s.id === 'integrations').map(s => (
                            <SubNavItem key={s.id} section={s} isActive={activeSection === s.id} onClick={setActiveSection} />
                        ))}
                    </>
                )}

                {/* Save button — visible when org info sections are active and have changes */}
                {isInfoSection && (orgState.hasChanges || orgState.saving || orgState.message) && (
                    <div className="mt-auto pt-3 space-y-1.5">
                        <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
                        {orgState.message && (
                            <div className={`text-[11px] px-2 py-1.5 rounded-lg flex items-center gap-1.5 ${orgState.message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                                {orgState.message.type === 'success' ? '✓' : '⚠'} {orgState.message.text}
                            </div>
                        )}
                        {orgState.hasChanges && (
                            <div className="text-[10px] px-2 font-medium flex items-center gap-1.5" style={{ color: '#d97706' }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                Unsaved changes
                            </div>
                        )}
                        <button
                            onClick={() => orgState.handleSave?.()}
                            disabled={orgState.saving || !orgState.hasChanges}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all disabled:opacity-40"
                            style={{ background: orgState.hasChanges ? 'var(--accent-primary)' : '#9ca3af' }}
                        >
                            {orgState.saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto pl-4" style={{ borderLeft: '1px solid var(--border-subtle)' }}>
                {/* Org info sections — delegated to OrgInfoPanel */}
                {isInfoSection && (
                    <OrgInfoPanel
                        user={user}
                        activeSection={activeSection}
                        onStateChange={setOrgState}
                    />
                )}

                {/* Users & Groups */}
                {activeSection === 'users' && canManageUsers && (
                    <div className="py-2">
                        <OrgUsersPanel user={user} />
                    </div>
                )}

                {/* Integrations */}
                {activeSection === 'integrations' && isOrgAdmin && (
                    <div className="py-2 space-y-6">
                        {!showN8n && !showGoogleMaps ? (
                            <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Integrations</p>
                                <div className="rounded-xl px-5 py-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                                    <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>No integrations are enabled for this organisation. Contact your platform administrator.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-widest px-1 mb-2" style={{ color: 'var(--text-muted)' }}>Organisation Integrations</p>
                                <p className="text-[12px] px-1 mb-3" style={{ color: 'var(--text-muted)' }}>Shared across all members of your organisation.</p>
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                                    {showN8n && (
                                        <div style={{ borderBottom: showGoogleMaps ? '1px solid var(--border-subtle)' : 'none' }}>
                                            {/* n8n header row */}
                                            <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: 'var(--bg-secondary)' }}>
                                                <img src="/n8n-color.png" alt="n8n" style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }} />
                                                <div className="flex-1">
                                                    <p className="text-[13px] font-medium text-black">n8n</p>
                                                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Connect n8n workflows as AI tools</p>
                                                </div>
                                            </div>
                                            <div className="px-5 pb-4" style={{ background: 'var(--bg-secondary)' }}>
                                                <N8nSection />
                                            </div>
                                        </div>
                                    )}
                                    {showGoogleMaps && <GoogleMapsRow last />}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrganisationSection;
