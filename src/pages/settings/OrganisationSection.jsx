import React, { useState } from 'react';
import OrgInfoPanel, { SECTIONS as INFO_SECTIONS } from '../../components/admin/OrgInfoPanel';
import OrgUsersPanel from '../../components/admin/OrgUsersPanel';
import N8nSection from './N8nSection';
import UsageSection from './UsageSection';
import { API_BASE, authFetch } from '../../utils/helpers';

/* ── Google Maps integration card ────────────────────────────────────────── */
const GoogleMapsRow = () => {
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
        <div>
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
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>Google Maps</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {hasKey ? 'Maps, directions & places — configured' : 'Directions, route maps & places search in chat'}
                    </p>
                </div>
                {hasKey && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                        style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>Connected</span>
                )}
                <svg className="flex-shrink-0" style={{ color: 'var(--text-muted)', width: '13px', height: '13px', transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
            {open && (
                <div className="px-5 pb-4 pt-2 space-y-2" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex gap-2">
                        <input
                            type="password" value={key} onChange={e => setKey(e.target.value)}
                            placeholder={hasKey ? '••••••••••••••••' : 'Enter Google Maps API key'}
                            className="flex-1 px-3 py-2 rounded-lg border outline-none text-[13px]"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            onKeyDown={e => e.key === 'Enter' && save()}
                        />
                        <button onClick={save} disabled={saving || !key.trim()}
                            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white disabled:opacity-40"
                            style={{ background: 'var(--accent-primary)' }}>
                            {saving ? '…' : 'Save'}
                        </button>
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Enable <strong>Directions API</strong>, <strong>Places API</strong> &amp; <strong>Maps Embed API</strong> in{' '}
                        <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener noreferrer"
                            className="underline" style={{ color: 'var(--accent-primary)' }}>Google Cloud Console</a>
                    </p>
                </div>
            )}
        </div>
    );
};

/* ── OrganisationSection ─────────────────────────────────────────────────── */
// activeSection is now controlled entirely by the parent sidebar.
// Possible values: 'license' | 'auth' | 'privacy' | 'branding' | 'legal' | 'users' | 'integrations'
const OrganisationSection = ({ user, activeSection = 'license' }) => {
    const [orgState, setOrgState] = useState({ hasChanges: false, saving: false, message: null, handleSave: null });

    const perms = user?.permissions || [];
    const isFullAdmin = perms.includes('all') || perms.some(p => p.startsWith('admin_'));
    const isOrgAdmin = perms.includes('org_admin') || isFullAdmin;

    const ei = user?.enabledIntegrations;
    const showN8n = !ei || ei.includes('n8n');
    const showGoogleMaps = !ei || ei.includes('google-maps');

    const isInfoSection = INFO_SECTIONS.some(s => s.id === activeSection);

    return (
        <div>
            {/* Save bar — shown above content when info section has changes */}
            {isInfoSection && (orgState.hasChanges || orgState.saving || orgState.message) && (
                <div
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                    {orgState.message && (
                        <span className={`text-[12px] font-medium flex items-center gap-1.5 ${orgState.message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                            {orgState.message.type === 'success' ? '✓' : '⚠'} {orgState.message.text}
                        </span>
                    )}
                    {orgState.hasChanges && !orgState.message && (
                        <span className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: '#d97706' }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                            Unsaved changes
                        </span>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={() => orgState.handleSave?.()}
                        disabled={orgState.saving || !orgState.hasChanges}
                        className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-white transition-all disabled:opacity-40"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {orgState.saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            )}

            {/* Org info sub-sections */}
            {isInfoSection && (
                <OrgInfoPanel
                    user={user}
                    activeSection={activeSection}
                    onStateChange={setOrgState}
                />
            )}

            {/* Users & Groups */}
            {activeSection === 'users' && (
                <OrgUsersPanel user={user} />
            )}

            {/* Usage & Monitoring */}
            {activeSection === 'usage' && (
                <UsageSection />
            )}

            {/* Integrations */}
            {activeSection === 'integrations' && isOrgAdmin && (
                <div className="space-y-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                            Organisation Integrations
                        </p>
                        <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
                            Shared across all members of your organisation.
                        </p>
                    </div>
                    {!showN8n && !showGoogleMaps ? (
                        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                                No integrations are enabled for this organisation. Contact your platform administrator.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                            {showN8n && (
                                <div style={{ borderBottom: showGoogleMaps ? '1px solid var(--border-subtle)' : 'none' }}>
                                    <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: 'var(--bg-secondary)' }}>
                                        <img src="/n8n-color.png" alt="n8n" style={{ width: '20px', height: '20px', objectFit: 'contain', flexShrink: 0 }} />
                                        <div className="flex-1">
                                            <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>n8n</p>
                                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Connect n8n workflows as AI tools</p>
                                        </div>
                                    </div>
                                    <div className="px-5 pb-4" style={{ background: 'var(--bg-secondary)' }}>
                                        <N8nSection />
                                    </div>
                                </div>
                            )}
                            {showGoogleMaps && <GoogleMapsRow />}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OrganisationSection;
