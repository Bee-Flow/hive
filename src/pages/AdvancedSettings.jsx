import React, { useState, useEffect, useMemo } from 'react';
import MemoryPanel from '../components/MemoryPanel';
import { API_BASE, authFetch } from '../utils/helpers';
import { useTranslation } from '../hooks/useTranslation';
import AccountSection from './settings/AccountSection';
import StartupAgentSection from './settings/StartupAgentSection';
import MemorySection from './settings/MemorySection';
import IntegrationsSection from './settings/IntegrationsSection';
import OrganisationSection from './settings/OrganisationSection';


const NAV_ITEMS = [
    {
        id: 'account',
        labelKey: 'settings.account',
        icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        id: 'preferences',
        labelKey: 'settings.preferences',
        icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
        ),
    },
    {
        id: 'memory',
        labelKey: 'settings.memory',
        icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
        ),
    },
    {
        id: 'integrations',
        labelKey: 'settings.integrations',
        icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
        ),
    },
];

const ORG_NAV_ITEM = {
    id: 'organisation',
    labelKey: 'settings.organisation',
    icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '15px', height: '15px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
    ),
};



const AdvancedSettings = ({ onBack, onNavigate, onLogout, user }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('account');

    // Determine if user can see org settings
    const perms = user?.permissions || [];
    const canSeeOrg = perms.includes('all') || perms.includes('org_admin') || perms.some(p => p.startsWith('admin_')) || user?.orgRole === 'admin' || user?.orgRole === 'org_admin';

    const navItems = useMemo(() => {
        const items = [...NAV_ITEMS];
        if (canSeeOrg) {
            items.push(ORG_NAV_ITEM);
        }
        return items;
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

        // LinkedIn status (separate endpoint)
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
        if (key === 'linkedin') fetchSettingsStatuses(); // Re-fetch to get LinkedIn name
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
            {/* Header */}
            <div className="px-6 py-4 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {onBack && (
                    <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Go back">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.title')}</h1>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Nav */}
                <nav className="w-44 flex-shrink-0 flex flex-col gap-0.5 pt-5 px-3" style={{ borderRight: '1px solid var(--border-subtle)' }}>
                    {navItems.map(({ id, labelKey, icon }) => {
                        const isActive = activeTab === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left w-full"
                                style={{
                                    background: isActive ? 'var(--bg-secondary)' : 'transparent',
                                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}
                                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                            >
                                <span style={{ opacity: isActive ? 1 : 0.55, flexShrink: 0 }}>{icon}</span>
                                {t(labelKey)}
                            </button>
                        );
                    })}
                </nav>

                {/* Content panel */}
                <div className="flex-1 overflow-auto">
                    <div className={`mx-auto px-8 py-8 ${activeTab === 'organisation' ? 'max-w-5xl' : 'max-w-lg'}`}>
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
