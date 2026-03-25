import React, { useState, useEffect, useMemo } from 'react';
import MemoryPanel from '../components/MemoryPanel';
import { API_BASE, authFetch } from '../utils/helpers';
import { useTranslation } from '../hooks/useTranslation';
import AccountSection from './settings/AccountSection';
import StartupAgentSection from './settings/StartupAgentSection';
import MemorySection from './settings/MemorySection';
import IntegrationsSection from './settings/IntegrationsSection';
import OrganisationSection from './settings/OrganisationSection';
import { AvatarDisplay } from './settings/AccountSection';

/* ── Nav definition ──────────────────────────────────────────────────────── */
const NAV_GROUPS = [
    {
        label: 'PROFILE',
        items: [
            {
                id: 'account',
                label: 'Account',
                icon: (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                ),
            },
            {
                id: 'preferences',
                label: 'Preferences',
                icon: (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                ),
            },
            {
                id: 'memory',
                label: 'Memory',
                icon: (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                ),
            },
            {
                id: 'integrations',
                label: 'Connections',
                icon: (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                ),
            },
        ],
    },
];

const ORG_GROUP = {
    label: 'SYSTEM',
    items: [
        {
            id: 'organisation',
            label: 'Organisation',
            icon: (
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
        },
    ],
};

/* ── NavItem ─────────────────────────────────────────────────────────────── */
const NavItem = ({ item, isActive, onClick }) => (
    <button
        onClick={() => onClick(item.id)}
        className="w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-left transition-all duration-100"
        style={{
            background: isActive ? 'var(--bg-tertiary)' : 'transparent',
            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
        <span style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0 }}>{item.icon}</span>
        <span className={`text-[13px] ${isActive ? 'font-medium text-black' : 'text-black'}`}>{item.label}</span>
    </button>
);

/* ── Main component ──────────────────────────────────────────────────────── */
const AdvancedSettings = ({ onBack, onNavigate, onLogout, user, onClose }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('account');

    const perms = user?.permissions || [];
    const canSeeOrg = perms.includes('all') || perms.includes('org_admin') || perms.some(p => p.startsWith('admin_')) || user?.orgRole === 'admin' || user?.orgRole === 'org_admin';

    const navGroups = useMemo(() => {
        const groups = [...NAV_GROUPS];
        if (canSeeOrg) groups.push(ORG_GROUP);
        return groups;
    }, [canSeeOrg]);

    const [showMemoryPanel, setShowMemoryPanel] = useState(false);
    const [memoryStats, setMemoryStats] = useState(null);
    const [agents, setAgents] = useState([]);
    const [statuses, setStatuses] = useState({
        hasFirefliesKey: false,
        hasYouTrackConfig: false,
        hasGammaKey: false,
        hasN8nConfig: false,
        linkedInConnected: false,
        linkedInName: null,
        hasLinkedInConfig: false,
    });

    const [defaultAgentMode, setDefaultAgentMode] = useState(
        () => localStorage.getItem('defaultAgentMode') || 'last-used'
    );
    const [defaultAgentId, setDefaultAgentId] = useState(
        () => localStorage.getItem('defaultAgentId') || ''
    );

    useEffect(() => {
        fetchMemoryStats();
        fetchAgents();
        fetchSettingsStatuses();
    }, []);

    useEffect(() => { localStorage.setItem('defaultAgentMode', defaultAgentMode); }, [defaultAgentMode]);
    useEffect(() => { localStorage.setItem('defaultAgentId', defaultAgentId); }, [defaultAgentId]);

    const fetchAgents = async () => {
        try { const res = await authFetch(`${API_BASE}/agents/all`); setAgents(await res.json()); }
        catch (err) { console.error('Failed to fetch agents:', err); }
    };

    const fetchMemoryStats = async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents/memory`);
            if (!res.ok) return;
            const data = await res.json();
            setMemoryStats({ total: data.memories?.length || 0 });
        } catch (err) { console.error('Failed to fetch memory stats:', err); }
    };

    const fetchSettingsStatuses = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`);
            if (res.ok) {
                const data = await res.json();
                setStatuses({
                    hasFirefliesKey: !!data.hasFirefliesKey,
                    hasYouTrackConfig: !!data.hasYouTrackConfig,
                    hasGammaKey: !!data.hasGammaKey,
                    hasN8nConfig: !!data.hasN8nConfig,
                    hasLinkedInConfig: !!data.hasLinkedInConfig,
                });
            }
        } catch (e) { console.error('Failed to fetch settings status:', e); }

        try {
            const liRes = await authFetch(`${API_BASE}/api/integrations/linkedin/status`);
            if (liRes.ok) {
                const liData = await liRes.json();
                setStatuses(prev => ({ ...prev, linkedInConnected: !!liData.connected, linkedInName: liData.name }));
            }
        } catch (e) { /* LinkedIn not configured */ }
    };

    const handleIntegrationSaved = (key) => {
        const keyMap = { fireflies: 'hasFirefliesKey', youtrack: 'hasYouTrackConfig', gamma: 'hasGammaKey' };
        if (keyMap[key]) setStatuses(prev => ({ ...prev, [keyMap[key]]: true }));
        if (key === 'linkedin') fetchSettingsStatuses();
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'account':
                return <AccountSection user={user} onLogout={onLogout} />;
            case 'preferences':
                return (
                    <StartupAgentSection
                        defaultAgentMode={defaultAgentMode}
                        setDefaultAgentMode={setDefaultAgentMode}
                        defaultAgentId={defaultAgentId}
                        setDefaultAgentId={setDefaultAgentId}
                        agents={agents}
                    />
                );
            case 'memory':
                return <MemorySection memoryStats={memoryStats} onOpenMemory={() => setShowMemoryPanel(true)} user={user} />;
            case 'integrations':
                return <IntegrationsSection statuses={statuses} onSaved={handleIntegrationSaved} enabledIntegrations={user?.enabledIntegrations} isOrgAdmin={canSeeOrg} user={user} />;
            case 'organisation':
                return canSeeOrg ? <OrganisationSection user={user} /> : null;
            default:
                return null;
        }
    };

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* ── Title bar ── */}
            <div
                className="flex-shrink-0 flex items-center justify-between px-5 h-12"
                style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
            >
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</span>
                <div className="flex items-center gap-2">
                    <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                    >
                        Esc
                    </span>
                    <button
                        onClick={handleClose}
                        className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        title="Close"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── Sidebar ── */}
                <div
                    className="w-64 flex-shrink-0 flex flex-col"
                    style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}
                >
                    {/* User mini-card */}
                    <button
                        onClick={() => setActiveTab('account')}
                        className="flex items-center gap-3 px-4 py-4 transition-colors text-left w-full"
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <AvatarDisplay user={user} size={36} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate text-black">
                                {user?.displayName || user?.username || 'User'}
                            </p>
                            {user?.role && (
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                    style={{
                                        background: user.role === 'admin' ? 'rgba(5,150,105,0.1)' : 'var(--bg-tertiary)',
                                        color: user.role === 'admin' ? '#059669' : 'var(--text-muted)',
                                    }}
                                >
                                    {user.role}
                                </span>
                            )}
                        </div>
                    </button>

                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 16px' }} />

                    {/* Nav groups */}
                    <div className="flex-1 overflow-y-auto px-2 py-2">
                        {navGroups.map((group, gi) => (
                            <div key={group.label} className={gi > 0 ? 'mt-4' : ''}>
                                <p
                                    className="text-[9px] font-semibold uppercase tracking-widest px-3 pb-1 pt-2"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    {group.label}
                                </p>
                                <div className="flex flex-col gap-px">
                                    {group.items.map(item => (
                                        <NavItem
                                            key={item.id}
                                            item={item}
                                            isActive={activeTab === item.id}
                                            onClick={setActiveTab}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Version footer */}
                    <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>BeeFlow</p>
                    </div>
                </div>

                {/* ── Content panel ── */}
                <div className="flex-1 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
                    <div className={`mx-auto px-8 py-8 ${activeTab === 'organisation' ? 'max-w-5xl' : 'max-w-[640px]'}`}>
                        {renderContent()}
                    </div>
                </div>
            </div>

            {showMemoryPanel && (
                <MemoryPanel onClose={() => { setShowMemoryPanel(false); fetchMemoryStats(); }} />
            )}
        </div>
    );
};

export default AdvancedSettings;
