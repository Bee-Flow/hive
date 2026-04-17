import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MemoryPanel from '../components/MemoryPanel';
import { API_BASE, authFetch } from '../utils/helpers';
import scopedStorage from '../utils/scopedStorage';
import { useTranslation } from '../hooks/useTranslation';
import StartupAgentSection from './settings/StartupAgentSection';
import MemorySection from './settings/MemorySection';
import IntegrationsSection from './settings/IntegrationsSection';
import PersonalAccessTokensSection from './settings/PersonalAccessTokensSection';
import OrganisationSection from './settings/OrganisationSection';
import ConsumerLicenseSection from './settings/ConsumerLicenseSection';
import ConsumerPrivacySection from './settings/ConsumerPrivacySection';
import { SECTIONS as ORG_SECTIONS } from '../components/admin/OrgInfoPanel';
import OrgAzureConfigPanel from '../components/admin/OrgAzureConfigPanel';
import { Users, Link2, BarChart2, Cloud, CreditCard, Shield, FolderGit2 } from 'lucide-react';

/* ── Org sub-items (use labelKey for i18n) ────────────────────────────────── */
const BASE_ORG_SUB_ITEMS = [
    ...ORG_SECTIONS,                                            // license, auth, privacy, info — already use labelKey
    { id: 'org_usage', labelKey: 'settings.usage_monitoring', icon: BarChart2, color: '#f59e0b' },
    { id: 'org_users', labelKey: 'settings.users_groups', icon: Users, color: '#3b82f6' },
    { id: 'org_integrations', labelKey: 'settings.integrations', icon: Link2, color: '#0ea5e9' },
    { id: 'org_github_sync', labelKey: 'settings.github_sync', icon: FolderGit2, color: '#8b5cf6' },
];
const AZURE_SUB_ITEM = { id: 'org_azure', labelKey: 'settings.azure_config', icon: Cloud, color: '#0078D4' };

/* ── URL ⟷ activeTab mapping ──────────────────────────────────────────────
 * Top-level segments live at /app/settings/{section}.
 * Organisation sub-tabs live at /app/settings/organisation/{sub}.
 * We keep internal tab ids (`org_users`, `license`, …) the same but expose
 * friendlier URL names (`users`, `license`) — disambiguated by the parent
 * path segment.
 */
const TOP_LEVEL_TAB_IDS = ['preferences', 'memory', 'integrations', 'api_tokens'];
const ORG_ID_TO_URL = {
    license: 'license',
    auth: 'auth',
    privacy: 'privacy',
    info: 'info',
    org_usage: 'usage',
    org_users: 'users',
    org_integrations: 'integrations',
    org_github_sync: 'github-sync',
    org_azure: 'azure',
};
const ORG_URL_TO_ID = Object.fromEntries(Object.entries(ORG_ID_TO_URL).map(([id, url]) => [url, id]));

function readTabFromUrl() {
    const parts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
    // Expecting 'app', 'settings', …
    if (parts[0] !== 'app' || parts[1] !== 'settings') return null;
    const seg = parts[2];
    if (!seg) return 'preferences';
    if (seg === 'organisation') {
        const sub = parts[3];
        return ORG_URL_TO_ID[sub] || 'license';
    }
    if (TOP_LEVEL_TAB_IDS.includes(seg)) return seg;
    return 'preferences';
}

function urlForTab(tabId) {
    if (TOP_LEVEL_TAB_IDS.includes(tabId)) return `/app/settings/${tabId}`;
    const urlName = ORG_ID_TO_URL[tabId];
    if (urlName) return `/app/settings/organisation/${urlName}`;
    return '/app/settings';
}

export const AvatarDisplay = ({ user, size = 40, className = '' }) => {
    const sizeStyle = { width: `${size}px`, height: `${size}px`, flexShrink: 0 };
    if (user?.avatarType === 'emoji' && user?.avatar) {
        return (
            <div
                className={`rounded-full flex items-center justify-center ${className}`}
                style={{ ...sizeStyle, background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', fontSize: `${size * 0.5}px`, lineHeight: 1 }}
            >
                {user.avatar}
            </div>
        );
    }
    if (user?.avatarType === 'url' && user?.avatar) {
        return <img src={user.avatar} alt="Avatar" className={`rounded-full object-cover ${className}`} style={sizeStyle} />;
    }
    return (
        <div
            className={`rounded-full flex items-center justify-center font-bold ${className}`}
            style={{ ...sizeStyle, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', fontSize: `${Math.round(size * 0.38)}px` }}
        >
            {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
        </div>
    );
};

/* ── Nav items (use labelKey for i18n) ────────────────────────────────────── */
const NAV_ITEMS = [
    {
        id: 'preferences', labelKey: 'settings.preferences',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
    },
    {
        id: 'memory', labelKey: 'settings.memory',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    },
    {
        id: 'integrations', labelKey: 'settings.connections',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    },
    {
        id: 'api_tokens', label: 'API Tokens',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
    },
];

const ORG_PARENT_ITEM = {
    id: 'organisation', labelKey: 'settings.organisation',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
};

/* ── Chevron icon ─────────────────────────────────────────────────────────── */
const Chevron = ({ open }) => (
    <svg
        width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'transform 200ms', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}
    >
        <path d="M9 18l6-6-6-6" />
    </svg>
);

/* ── NavItem ─────────────────────────────────────────────────────────────── */
const NavItem = ({ id, label, icon, isActive, onClick, rightSlot }) => (
    <button
        onClick={() => onClick(id)}
        className="w-full flex items-center gap-2.5 px-3 rounded-md text-left transition-all duration-100"
        style={{
            height: '32px',
            background: isActive ? 'rgba(0,0,0,0.07)' : 'transparent',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
        <span style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>{icon}</span>
        <span
            className="flex-1 text-[13px] truncate"
            style={{ color: 'var(--text-primary)', fontWeight: isActive ? 600 : 400 }}
        >
            {label}
        </span>
        {rightSlot}
    </button>
);

/* ── Org sub-menu item ───────────────────────────────────────────────────── */
const OrgSubItem = ({ section, label, isActive, onClick }) => {
    const Icon = section.icon;
    return (
        <button
            onClick={() => onClick(section.id)}
            className="w-full flex items-center gap-2 rounded-md text-left transition-all duration-100"
            style={{
                height: '28px',
                paddingLeft: '36px',
                paddingRight: '12px',
                background: isActive ? 'rgba(0,0,0,0.07)' : 'transparent',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
        >
            <Icon style={{ width: '12px', height: '12px', color: isActive ? section.color : 'var(--text-muted)', flexShrink: 0 }} />
            <span
                className="text-[12px] truncate"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive ? 500 : 400 }}
            >
                {label}
            </span>
        </button>
    );
};

/* ── Main component ──────────────────────────────────────────────────────── */
const AdvancedSettings = ({ onBack, onNavigate, onLogout, user, onClose }) => {
    const { t } = useTranslation();
    // activeTab can be a top-level id OR an org sub-item id (e.g. 'license', 'org_users')
    // State is kept in sync with the URL: /app/settings/{section} or
    // /app/settings/organisation/{sub}. Back/forward buttons just work.
    const [activeTab, setActiveTabState] = useState(() => readTabFromUrl() || 'preferences');
    const setActiveTab = useCallback((id) => {
        setActiveTabState(id);
        const url = urlForTab(id);
        if (window.location.pathname !== url) {
            window.history.pushState({}, '', url);
        }
    }, []);
    useEffect(() => {
        const onPop = () => {
            const tab = readTabFromUrl();
            if (tab) setActiveTabState(tab);
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
    const [orgExpanded, setOrgExpanded] = useState(() => {
        const tab = readTabFromUrl();
        return !!tab && Object.prototype.hasOwnProperty.call(ORG_ID_TO_URL, tab);
    });

    const perms = user?.permissions || [];
    const canSeeOrg = perms.includes('all') || perms.includes('org_admin') || user?.orgRole === 'admin' || user?.orgRole === 'org_admin';

    const canManageUsers = perms.includes('all') || perms.includes('manage_users') || user?.orgRole === 'admin' || user?.orgRole === 'org_admin';
    const deploymentMode = user?.featureFlags?.deploymentMode || 'cloud';
    const isPrivateCloud = deploymentMode === 'private-cloud';
    const isConsumerAccount = !!user?.isConsumerAccount;
    const ei = user?.enabledIntegrations;
    const hasOrgIntegrations = !ei || (Array.isArray(ei) && ei.length > 0);
    const orgSubItems = useMemo(() => {
        const items = BASE_ORG_SUB_ITEMS.filter(s => {
            if (s.id === 'org_users') return canManageUsers;
            if (s.id === 'org_integrations') return canSeeOrg && hasOrgIntegrations;
            // In private-cloud mode, license is managed externally
            if (isPrivateCloud && s.id === 'license') return false;

            // Hide privacy shield in local host
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isLocalhost && s.id === 'privacy') return false;

            return true;
        });
        // Azure config only in private-cloud mode for org admins
        if (isPrivateCloud && canSeeOrg) {
            items.push(AZURE_SUB_ITEM);
        }
        return items;
    }, [canSeeOrg, canManageUsers, isPrivateCloud, hasOrgIntegrations]);

    const ALL_ORG_IDS = [...BASE_ORG_SUB_ITEMS.map(s => s.id), AZURE_SUB_ITEM.id, 'org_github_sync'];
    const isOrgSubTab = ALL_ORG_IDS.includes(activeTab);

    // If user navigates to an org sub-tab, keep org expanded
    useEffect(() => {
        if (isOrgSubTab) setOrgExpanded(true);
    }, [isOrgSubTab]);

    const [showMemoryPanel, setShowMemoryPanel] = useState(false);
    const [memoryStats, setMemoryStats] = useState(null);
    const [agents, setAgents] = useState([]);
    const [statuses, setStatuses] = useState({
        hasFirefliesKey: false, hasYouTrackConfig: false, hasGammaKey: false,
        hasN8nConfig: false, linkedInConnected: false, linkedInName: null, hasLinkedInConfig: false,
    });
    // User-scoped: these are personal "which agent do I start on?" preferences.
    const [defaultAgentMode, setDefaultAgentMode] = useState(() => scopedStorage.getItem('defaultAgentMode') || 'last-used');
    const [defaultAgentId, setDefaultAgentId] = useState(() => scopedStorage.getItem('defaultAgentId') || '');

    useEffect(() => { fetchMemoryStats(); fetchAgents(); fetchSettingsStatuses(); }, []);
    useEffect(() => { scopedStorage.setItem('defaultAgentMode', defaultAgentMode); }, [defaultAgentMode]);
    useEffect(() => { scopedStorage.setItem('defaultAgentId', defaultAgentId); }, [defaultAgentId]);

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
                setStatuses({ hasFirefliesKey: !!data.hasFirefliesKey, hasYouTrackConfig: !!data.hasYouTrackConfig, hasGammaKey: !!data.hasGammaKey, hasN8nConfig: !!data.hasN8nConfig, hasLinkedInConfig: !!data.hasLinkedInConfig });
            }
        } catch (e) { console.error(e); }
        try {
            const liRes = await authFetch(`${API_BASE}/api/integrations/linkedin/status`);
            if (liRes.ok) { const d = await liRes.json(); setStatuses(p => ({ ...p, linkedInConnected: !!d.connected, linkedInName: d.name })); }
        } catch (e) { }
    };
    const handleIntegrationSaved = (key) => {
        const keyMap = { fireflies: 'hasFirefliesKey', youtrack: 'hasYouTrackConfig', gamma: 'hasGammaKey' };
        if (keyMap[key]) setStatuses(p => ({ ...p, [keyMap[key]]: true }));
        if (key === 'linkedin') fetchSettingsStatuses();
    };
    const handleClose = () => {
        if (onClose) onClose();
        else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };

    // Map org sub-tab ids to the activeSection prop OrganisationSection expects
    const orgActiveSection = isOrgSubTab
        ? (activeTab === 'org_users' ? 'users' : activeTab === 'org_integrations' ? 'integrations' : activeTab === 'org_usage' ? 'usage' : activeTab === 'org_azure' ? 'azure' : activeTab === 'org_github_sync' ? 'github_sync' : activeTab)
        : 'license';

    const renderContent = () => {
        if (activeTab === 'org_azure' && canSeeOrg) return <OrgAzureConfigPanel user={user} />;
        if (isOrgSubTab && canSeeOrg) return <OrganisationSection user={user} activeSection={orgActiveSection} />;
        // Consumer account tabs
        if (activeTab === 'consumer_license' && isConsumerAccount) return <ConsumerLicenseSection user={user} />;
        if (activeTab === 'consumer_privacy' && isConsumerAccount) return <ConsumerPrivacySection user={user} />;
        switch (activeTab) {
            case 'preferences': return <StartupAgentSection defaultAgentMode={defaultAgentMode} setDefaultAgentMode={setDefaultAgentMode} defaultAgentId={defaultAgentId} setDefaultAgentId={setDefaultAgentId} agents={agents} onLogout={onLogout} user={user} />;
            case 'memory': return <MemorySection memoryStats={memoryStats} onOpenMemory={() => setShowMemoryPanel(true)} user={user} />;
            case 'integrations': return <IntegrationsSection statuses={statuses} onSaved={handleIntegrationSaved} enabledIntegrations={user?.enabledIntegrations} isOrgAdmin={canSeeOrg} user={user} showOrgIntegrations={isConsumerAccount} />;
            case 'api_tokens': return <PersonalAccessTokensSection />;
            case 'organisation': return canSeeOrg ? <OrganisationSection user={user} activeSection="license" /> : null;
            default: return null;
        }
    };

    const handleNavClick = (id) => {
        if (id === 'organisation') {
            // toggle expand; if collapsing from an org sub-tab go to first sub-item
            if (orgExpanded && isOrgSubTab) {
                setOrgExpanded(false);
                setActiveTab('preferences');
            } else {
                const newExpanded = !orgExpanded;
                setOrgExpanded(newExpanded);
                if (newExpanded && !isOrgSubTab) {
                    // auto-select first sub-item
                    setActiveTab(orgSubItems[0]?.id || 'licence');
                }
            }
        } else {
            setActiveTab(id);
        }
    };

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)', position: 'relative' }}>
            {/* ── Title bar ── */}
            <div
                className="flex-shrink-0 flex items-center px-5"
                style={{ height: '48px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
            >
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.title')}</span>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── Sidebar ── */}
                {/* 180px on laptops <1280, 220px on larger screens — keeps enough room
                    for the settings content area without forcing horizontal scroll. */}
                <div
                    className="flex-shrink-0 flex flex-col w-[180px] xl:w-[220px]"
                    style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}
                >
                    {/* User mini-card */}
                    <button
                        onClick={() => setActiveTab('preferences')}
                        className="flex items-center gap-3 px-4 py-3.5 transition-colors text-left w-full flex-shrink-0"
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <AvatarDisplay user={user} size={34} />
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {user?.displayName || user?.username || 'User'}
                            </p>
                            {(() => {
                                const effectiveRole = user?.orgRole || user?.role;
                                if (!effectiveRole) return null;
                                const ROLE_LABELS = { admin: 'Admin', org_admin: 'Organisation Admin', agent_admin: 'Agent Admin', agent_editor: 'Agent Editor', user: 'User', member: 'Member' };
                                const label = ROLE_LABELS[effectiveRole] || effectiveRole.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                const isAdmin = ['admin', 'org_admin'].includes(effectiveRole);
                                return (
                                    <span
                                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                        style={{
                                            background: isAdmin ? 'rgba(5,150,105,0.1)' : 'var(--bg-tertiary)',
                                            color: isAdmin ? '#059669' : 'var(--text-muted)',
                                        }}
                                    >
                                        {label}
                                    </span>
                                );
                            })()}
                        </div>
                    </button>

                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 12px' }} />

                    {/* Nav */}
                    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-px">
                        <p className="text-[9px] font-semibold uppercase tracking-widest px-3 pb-1 pt-1.5" style={{ color: 'var(--text-muted)' }}>
                            {t('settings.profile_section')}
                        </p>

                        {NAV_ITEMS.map(item => (
                            <NavItem
                                key={item.id}
                                {...item}
                                label={item.labelKey ? t(item.labelKey) : item.label}
                                isActive={activeTab === item.id && !isOrgSubTab}
                                onClick={handleNavClick}
                            />
                        ))}

                        {/* Organisation accordion — only if permitted */}
                        {canSeeOrg && (
                            <>
                                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '6px 8px' }} />
                                <p className="text-[9px] font-semibold uppercase tracking-widest px-3 pb-1 pt-1" style={{ color: 'var(--text-muted)' }}>
                                    {t('settings.workspace_section')}
                                </p>
                                {/* Parent row */}
                                <NavItem
                                    id="organisation"
                                    label={t(ORG_PARENT_ITEM.labelKey)}
                                    icon={ORG_PARENT_ITEM.icon}
                                    isActive={isOrgSubTab && !orgExpanded ? true : false}
                                    onClick={handleNavClick}
                                    rightSlot={<Chevron open={orgExpanded} />}
                                />

                                {/* Sub-items — animated slide-down */}
                                {orgExpanded && (
                                    <div className="space-y-px overflow-hidden" style={{ animation: 'fadeIn 120ms ease' }}>
                                        {orgSubItems.map((s, i) => (
                                            <React.Fragment key={s.id}>
                                                {/* Divider before Users & Groups */}
                                                {s.id === 'org_users' && (
                                                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 12px 4px 36px' }} />
                                                )}
                                                <OrgSubItem
                                                    section={s}
                                                    label={t(s.labelKey)}
                                                    isActive={activeTab === s.id}
                                                    onClick={setActiveTab}
                                                />
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Consumer Account section — for org-less cloud users */}
                        {isConsumerAccount && !canSeeOrg && (
                            <>
                                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '6px 8px' }} />
                                <p className="text-[9px] font-semibold uppercase tracking-widest px-3 pb-1 pt-1" style={{ color: 'var(--text-muted)' }}>
                                    {t('settings.account_section') || 'Account'}
                                </p>
                                <NavItem
                                    id="consumer_license"
                                    label={t('settings.license_usage') || 'License & Usage'}
                                    icon={<CreditCard style={{ width: '15px', height: '15px' }} />}
                                    isActive={activeTab === 'consumer_license'}
                                    onClick={handleNavClick}
                                />
                                <NavItem
                                    id="consumer_privacy"
                                    label={t('settings.privacy_shield') || 'Privacy Shield'}
                                    icon={<Shield style={{ width: '15px', height: '15px' }} />}
                                    isActive={activeTab === 'consumer_privacy'}
                                    onClick={handleNavClick}
                                />
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>BeeFlow</p>
                    </div>
                </div>

                {/* ── Content panel ── */}
                <div className="flex-1 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
                    <div className={`mx-auto py-8 ${isOrgSubTab ? 'max-w-5xl px-8' : 'max-w-[640px] px-8'}`} style={activeTab === 'org_usage' ? { maxWidth: '100%', padding: '24px 32px 32px' } : undefined}>
                        {renderContent()}
                    </div>
                </div>
            </div>

            {showMemoryPanel && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg-primary)' }}>
                    <MemoryPanel onClose={() => { setShowMemoryPanel(false); fetchMemoryStats(); }} />
                </div>
            )}
        </div>
    );
};

export default AdvancedSettings;
