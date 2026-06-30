import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MemoryPanel from '../components/MemoryPanel';
import { API_BASE, authFetch } from '../utils/helpers';
import scopedStorage from '../utils/scopedStorage';
import { formatVersion, formatVersionWithDate } from '../utils/appVersion';
import { useTranslation } from '../hooks/useTranslation';
import { useViewport } from '../hooks/useViewport';
import { useSubscriptionContext } from '../components/SubscriptionContext';
import { useCan } from '../components/Gate';
import PreferencesSection from './settings/PreferencesSection';
import MemorySection from './settings/MemorySection';
import IntegrationsSection from './settings/IntegrationsSection';
import OrganisationSection from './settings/OrganisationSection';
import ConsumerLicenseSection from './settings/ConsumerLicenseSection';
import ConsumerPrivacySection from './settings/ConsumerPrivacySection';
import ConsumerUsageSection from './settings/ConsumerUsageSection';
import ConsumerIntegrationsSection from './settings/ConsumerIntegrationsSection';
import ConsumerBetaFeaturesSection from './settings/ConsumerBetaFeaturesSection';
import AppearanceSection from './settings/AppearanceSection';
import SecuritySection from './settings/SecuritySection';
import HelpSupportSection from './settings/HelpSupportSection';
import LegalConsentSection from './settings/LegalConsentSection';
import LearningCenterSection from './settings/LearningCenterSection';
import { SECTIONS as ORG_SECTIONS } from '../components/admin/OrgInfoPanel';
import OrgAzureConfigPanel from '../components/admin/OrgAzureConfigPanel';
import { Users, Link2, BarChart2, Cloud, CreditCard, Shield, FolderGit2, Palette, Sparkles, LifeBuoy, GraduationCap, ArrowLeft } from 'lucide-react';

/* ── Org sub-items (use labelKey for i18n) ────────────────────────────────── */
const BASE_ORG_SUB_ITEMS = [
    ...ORG_SECTIONS,                                            // license, auth, privacy, info — already use labelKey
    { id: 'org_usage', labelKey: 'settings.usage_monitoring', icon: BarChart2, color: '#f59e0b' },
    { id: 'org_users', labelKey: 'settings.users_groups', icon: Users, color: '#3b82f6' },
    { id: 'org_academy', labelKey: 'settings.academy', icon: GraduationCap, color: '#059669' },
    { id: 'org_integrations', labelKey: 'settings.integrations', icon: Link2, color: '#0ea5e9' },
    { id: 'org_github_sync', labelKey: 'settings.github_sync', icon: FolderGit2, color: '#8b5cf6' },
    { id: 'org_nextcloud_sync', labelKey: 'settings.nextcloud_sync', icon: Cloud, color: '#0082C9' },
];
const AZURE_SUB_ITEM = { id: 'org_azure', labelKey: 'settings.azure_config', icon: Cloud, color: '#0078D4' };

/* ── URL ⟷ activeTab mapping ──────────────────────────────────────────────
 * Top-level segments live at /app/settings/{section}.
 * Organisation sub-tabs live at /app/settings/organisation/{sub}.
 * We keep internal tab ids (`org_users`, `license`, …) the same but expose
 * friendlier URL names (`users`, `license`) — disambiguated by the parent
 * path segment.
 */
const TOP_LEVEL_TAB_IDS = ['preferences', 'appearance', 'memory', 'integrations', 'learning', 'help_support', 'legal_consent'];
const TOP_LEVEL_ID_TO_URL = {};
const TOP_LEVEL_URL_TO_ID = Object.fromEntries(Object.entries(TOP_LEVEL_ID_TO_URL).map(([id, url]) => [url, id]));
// Legacy URL: Simple Mode used to live at /app/settings/simple-mode. It now
// lives inside Preferences as a single toggle — bounce old bookmarks there.
const LEGACY_URL_REDIRECTS = { 'simple-mode': 'preferences' };
// Consumer (Account) sub-tabs live under /app/settings/account/{sub}.
// Parallels the Organisation sub-routing so the URL segments don't collide
// with the Profile group ('integrations' is already a Profile tab URL).
const ACCOUNT_ID_TO_URL = {
    consumer_license: 'license',
    consumer_privacy: 'privacy',
    consumer_usage: 'usage',
    consumer_integrations: 'integrations',
    consumer_beta: 'beta',
};
const ACCOUNT_URL_TO_ID = Object.fromEntries(Object.entries(ACCOUNT_ID_TO_URL).map(([id, url]) => [url, id]));
const ORG_ID_TO_URL = {
    license: 'license',
    auth: 'auth',
    privacy: 'privacy',
    info: 'info',
    org_usage: 'usage',
    org_users: 'users',
    org_academy: 'academy',
    org_integrations: 'integrations',
    org_github_sync: 'github-sync',
    org_nextcloud_sync: 'nextcloud-sync',
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
    if (seg === 'account') {
        const sub = parts[3];
        return ACCOUNT_URL_TO_ID[sub] || 'consumer_license';
    }
    if (TOP_LEVEL_URL_TO_ID[seg]) return TOP_LEVEL_URL_TO_ID[seg];
    if (LEGACY_URL_REDIRECTS[seg]) return LEGACY_URL_REDIRECTS[seg];
    if (TOP_LEVEL_TAB_IDS.includes(seg)) return seg;
    return 'preferences';
}

function urlForTab(tabId) {
    if (TOP_LEVEL_TAB_IDS.includes(tabId)) {
        const urlName = TOP_LEVEL_ID_TO_URL[tabId] || tabId;
        return `/app/settings/${urlName}`;
    }
    const accountUrl = ACCOUNT_ID_TO_URL[tabId];
    if (accountUrl) return `/app/settings/account/${accountUrl}`;
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

/* On phones the settings surface is trimmed to user-only sections: Connections
 * (integrations), Learning Center (learning) and the whole Organisation section
 * are hidden. These are the top-level NAV_ITEMS ids that stay visible on mobile.
 * Derived from the NAV_ITEMS ids below (NOT TOP_LEVEL_TAB_IDS, which omits
 * 'security'). */
const MOBILE_VISIBLE_TOP_TABS = ['preferences', 'appearance', 'security', 'memory', 'help_support', 'legal_consent'];
const MOBILE_VISIBLE_TAB_SET = new Set(MOBILE_VISIBLE_TOP_TABS);

/* ── Nav items (use labelKey for i18n) ────────────────────────────────────── */
const NAV_ITEMS = [
    {
        id: 'preferences', labelKey: 'settings.preferences',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
    },
    {
        id: 'appearance', labelKey: 'settings.appearance',
        icon: <Palette width="15" height="15" strokeWidth={1.75} />,
    },
    {
        id: 'security', labelKey: 'settings.security',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
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
        id: 'learning', labelKey: 'settings.learning_center',
        icon: <GraduationCap width="15" height="15" strokeWidth={1.75} />,
    },
    {
        id: 'help_support', labelKey: 'settings.help_support',
        icon: <LifeBuoy width="15" height="15" strokeWidth={1.75} />,
    },
    {
        id: 'legal_consent', labelKey: 'settings.legal_consent',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="15" height="15"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
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
const AdvancedSettings = ({ onBack, onNavigate, onLogout, user, onUpdateUser, onClose }) => {
    const { t } = useTranslation();
    // Phones show a trimmed, user-only settings surface (see MOBILE_VISIBLE_TOP_TABS).
    const { isMobile } = useViewport();
    // Orgs with no active plan are routed to the License tab by SubscriptionGate —
    // keep that one reachable on mobile so they can still subscribe.
    const { hasActiveSub } = useSubscriptionContext();
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
    // Learning Center is toggleable per subscription plan (capability
    // `learning_center`). Hide its nav item + page when the org's plan doesn't
    // include it; the /ai/learning API is gated server-side too.
    const canUseLearning = useCan('learning_center');

    const canManageUsers = perms.includes('all') || perms.includes('manage_users') || user?.orgRole === 'admin' || user?.orgRole === 'org_admin';
    const deploymentMode = user?.featureFlags?.deploymentMode || 'cloud';
    const isSelfHosted = deploymentMode === 'self-hosted';
    const isConsumerAccount = !!user?.isConsumerAccount;
    const ei = user?.enabledIntegrations;
    // The Integrations sub-item is shown when the org has anything to toggle —
    // either a super-admin integration allow-list (legacy gate) OR a beta-
    // feature grant. Orgs that only have beta features granted still need the
    // item so the org admin can flip those on/off.
    const hasOrgBetaFeatures = Array.isArray(user?.betaFeatures) && user.betaFeatures.length > 0;
    const hasOrgIntegrations = !ei || (Array.isArray(ei) && ei.length > 0) || hasOrgBetaFeatures;
    // Users coming in through the Nextcloud ExApp connector authenticate via
    // their NC session — the Bee Flow "Sign-in Method" panel (password/SSO/
    // OAuth provider config) doesn't apply because identity is delegated to
    // Nextcloud. Hide that section to avoid the false impression that they
    // can configure auth here. We hide based on org-level binding (ncOrg)
    // rather than the current user's provider so the original creator who
    // bootstrapped the NC org also sees the same gated UI.
    const isNcConnectorUser = user?.provider === 'nextcloud_connector';
    const isNcOrg = !!user?.ncOrg?.instanceId;
    // Super-admins (perms 'all' or role 'admin') manage every org in the
    // deployment, so they should see NC-related sections even if their own
    // session isn't tied to an NC-bound org. Org-admins only see the section
    // when their own org is NC-bound.
    const isSuperAdmin = perms.includes('all') || user?.role === 'admin';
    const showNcSync = isNcOrg || isSuperAdmin;

    const ALL_ORG_IDS = [...BASE_ORG_SUB_ITEMS.map(s => s.id), AZURE_SUB_ITEM.id, 'org_github_sync', 'org_nextcloud_sync'];
    const isOrgSubTab = ALL_ORG_IDS.includes(activeTab);

    // Simple Mode collapses the settings sidebar to just Preferences. If the
    // user arrives on a deep link (or toggles ON while on another section),
    // bounce them back to Preferences where the toggle now lives.
    const isSimpleMode = !!user?.simpleMode;
    useEffect(() => {
        if (isSimpleMode && activeTab !== 'preferences') {
            setActiveTab('preferences');
        }
    }, [isSimpleMode, activeTab, setActiveTab]);

    // Legal & Consent and Help & Support are hidden on self-hosted — bounce a
    // deep-link/hard-refresh that lands on either (the nav items are filtered
    // out, but the routes still exist).
    useEffect(() => {
        if (isSelfHosted && (activeTab === 'legal_consent' || activeTab === 'help_support')) {
            setActiveTab('preferences');
        }
    }, [isSelfHosted, activeTab, setActiveTab]);

    // Mobile: bounce hidden tabs (Connections, Learning Center, org/account
    // sub-tabs) to Preferences. Covers deep-links/hard-refresh to e.g.
    // /app/settings/connections or /app/settings/organisation/* and a resize
    // that crosses the breakpoint while sitting on a now-hidden tab. The License
    // tab is exempt when the org has no active plan so SubscriptionGate's
    // subscribe redirect still lands somewhere usable.
    useEffect(() => {
        if (!isMobile) return;
        if (activeTab === 'license' && !hasActiveSub) return;
        if (!MOBILE_VISIBLE_TAB_SET.has(activeTab)) {
            setActiveTab('preferences');
        }
    }, [isMobile, activeTab, hasActiveSub, setActiveTab]);

    // orgSubItems is computed below — it depends on `statuses.githubConnected`
    // which is hydrated in fetchSettingsStatuses() and the `statuses` state
    // declared further down. The actual filter lives in the useMemo block
    // immediately after `statuses` is declared.

    // If user navigates to an org sub-tab, keep org expanded
    useEffect(() => {
        if (isOrgSubTab) setOrgExpanded(true);
    }, [isOrgSubTab]);

    const [showMemoryPanel, setShowMemoryPanel] = useState(false);
    const [memoryStats, setMemoryStats] = useState(null);
    const [agents, setAgents] = useState([]);
    const [statuses, setStatuses] = useState({
        hasFirefliesKey: false, hasYouTrackConfig: false, hasGammaKey: false, hasAfasConfig: false,
        hasNmbrsConfig: false, nmbrsApiMode: 'soap', nmbrsSubdomain: '', nmbrsEmail: '', nmbrsEnv: 'production',
        hasN8nConfig: false, linkedInConnected: false, linkedInName: null, hasLinkedInConfig: false,
        hasNextcloudAppPassword: false, isNextcloudUser: false,
        githubConnected: false,
    });
    // Whether this org has already locked in its sign-in method. Once locked,
    // the "Sign-in Method" sidebar entry is hidden — the panel is a one-time
    // choice and adds no value after the fact.
    const [orgAuthLocked, setOrgAuthLocked] = useState(false);
    const orgSubItems = useMemo(() => {
        const items = BASE_ORG_SUB_ITEMS.filter(s => {
            // Self-hosted: licensing is governed server-wide from the admin
            // dashboard ("Server licence"), not per-org. Drop the per-org
            // "License & Usage" entry entirely.
            if (s.id === 'license' && isSelfHosted) return false;
            if (s.id === 'org_users') return canManageUsers;
            // Academy overview only makes sense when the plan carries the
            // Learning Center at all (entitlements-gated like the member tab).
            if (s.id === 'org_academy') return canSeeOrg && canUseLearning;
            // Always show Integrations to org admins — the panel inside
            // displays empty states for orgs without grants, and beta-feature
            // toggling lives here too (not just integrations).
            if (s.id === 'org_integrations') return canSeeOrg;
            // NC-bound orgs: auth is delegated to Nextcloud entirely. The
            // Sign-in Method panel configures username/password + OAuth
            // providers which are no-ops once identity comes from NC, so
            // hide it for everyone — including super-admins.
            if ((isNcOrg || isNcConnectorUser) && s.id === 'auth') return false;
            // Sign-in method is a one-time, locked choice. Once the org has
            // picked one, the panel only shows a "locked" notice with no
            // editable controls — drop the sidebar entry so admins aren't
            // pointed at a dead-end page.
            if (orgAuthLocked && s.id === 'auth') return false;
            // Nextcloud Sync — visible when the user's own org is NC-bound,
            // OR when the user is a super-admin who could be managing NC orgs.
            if (s.id === 'org_nextcloud_sync' && !showNcSync) return false;
            // GitHub Sync only matters once the org has actually connected a
            // GitHub account in Settings → Integrations. Hide the menu item
            // until then so admins aren't dropped on a "Not connected" stub.
            if (s.id === 'org_github_sync' && !statuses.githubConnected) return false;

            return true;
        });
        // Azure services config — self-hosted operator surface for org admins.
        if (isSelfHosted && canSeeOrg) {
            items.push(AZURE_SUB_ITEM);
        }
        return items;
    }, [canSeeOrg, canManageUsers, canUseLearning, isSelfHosted, hasOrgIntegrations, isNcConnectorUser, isNcOrg, isSuperAdmin, showNcSync, statuses.githubConnected, orgAuthLocked]);

    // The per-org "License & Usage" section is hidden on self-hosted (see the
    // orgSubItems filter above). A default/deep-link can still resolve activeTab
    // to 'license', so bounce it to the first visible org section. Placed after
    // orgSubItems so the dependency array can reference it without a TDZ error.
    useEffect(() => {
        if (isSelfHosted && activeTab === 'license') {
            setActiveTab(orgSubItems[0]?.id || 'org_usage');
        }
    }, [isSelfHosted, activeTab, orgSubItems, setActiveTab]);

    // User-scoped: these are personal "which agent do I start on?" preferences.
    const [defaultAgentMode, setDefaultAgentMode] = useState(() => scopedStorage.getItem('defaultAgentMode') || 'last-used');
    const [defaultAgentId, setDefaultAgentId] = useState(() => scopedStorage.getItem('defaultAgentId') || '');

    useEffect(() => { fetchMemoryStats(); fetchAgents(); fetchSettingsStatuses(); fetchOrgAuthLocked(); }, []);
    useEffect(() => { scopedStorage.setItem('defaultAgentMode', defaultAgentMode); }, [defaultAgentMode]);
    useEffect(() => { scopedStorage.setItem('defaultAgentId', defaultAgentId); }, [defaultAgentId]);

    const fetchAgents = async () => {
        try { const res = await authFetch(`${API_BASE}/agents/all`); setAgents(await res.json()); }
        catch (err) { console.error('Failed to fetch agents:', err); }
    };
    const fetchMemoryStats = async () => {
        try {
            const res = await authFetch(`${API_BASE}/agents/memory/stats`);
            if (!res.ok) return;
            const data = await res.json();
            setMemoryStats(data);
        } catch (err) { console.error('Failed to fetch memory stats:', err); }
    };
    const fetchOrgAuthLocked = async () => {
        if (!canSeeOrg) return;
        try {
            const res = await authFetch(`${API_BASE}/auth/organizations`);
            if (!res.ok) return;
            const orgs = await res.json();
            const myOrg = user?.organizationId
                ? orgs.find(o => o.id === user.organizationId)
                : orgs[0];
            setOrgAuthLocked(!!myOrg?.authMethod);
        } catch (e) { /* non-critical */ }
    };
    const fetchSettingsStatuses = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/user-settings`);
            if (res.ok) {
                const data = await res.json();
                setStatuses({ hasFirefliesKey: !!data.hasFirefliesKey, hasYouTrackConfig: !!data.hasYouTrackConfig, hasGammaKey: !!data.hasGammaKey, hasAfasConfig: !!data.hasAfasConfig, hasNmbrsConfig: !!data.hasNmbrsConfig, nmbrsApiMode: data.nmbrsApiMode || 'soap', nmbrsSubdomain: data.nmbrsSubdomain || '', nmbrsEmail: data.nmbrsEmail || '', nmbrsEnv: data.nmbrsEnv || 'production', hasN8nConfig: !!data.hasN8nConfig, hasLinkedInConfig: !!data.hasLinkedInConfig });
            }
        } catch (e) { console.error(e); }
        try {
            const liRes = await authFetch(`${API_BASE}/api/integrations/linkedin/status`);
            if (liRes.ok) { const d = await liRes.json(); setStatuses(p => ({ ...p, linkedInConnected: !!d.connected, linkedInName: d.name })); }
        } catch (e) { }
        try {
            const ncRes = await authFetch(`${API_BASE}/auth/app-password-status`);
            if (ncRes.ok) { const d = await ncRes.json(); setStatuses(p => ({ ...p, hasNextcloudAppPassword: !!d.hasAppPassword, isNextcloudUser: !!d.isNextcloudUser, nextcloudUrl: d.nextcloudUrl || '' })); }
        } catch (e) { }
        // GitHub Sync menu item is hidden until the org-admin connects a
        // GitHub account in Settings → Integrations. The org-sync panel
        // itself prompts for that step, but there's no point exposing the
        // sub-tab to admins who haven't reached integration setup yet.
        try {
            const ghRes = await authFetch(`${API_BASE}/api/integrations/github/status`);
            if (ghRes.ok) { const d = await ghRes.json(); setStatuses(p => ({ ...p, githubConnected: !!d.connected })); }
        } catch (e) { }
    };
    const handleIntegrationSaved = (key) => {
        const keyMap = { fireflies: 'hasFirefliesKey', youtrack: 'hasYouTrackConfig', gamma: 'hasGammaKey' };
        if (keyMap[key]) setStatuses(p => ({ ...p, [keyMap[key]]: true }));
        // AFAS fires onSaved for connect AND disconnect — re-fetch instead of
        // optimistically forcing true (which would show "Connected" after a
        // disconnect, or after a token-only save that isn't fully configured).
        if (key === 'afas-profit') fetchSettingsStatuses();
        if (key === 'nmbrs') fetchSettingsStatuses();
        if (key === 'linkedin') fetchSettingsStatuses();
        if (key === 'nextcloud') fetchSettingsStatuses();
    };
    const handleClose = () => {
        if (onClose) onClose();
        else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };

    // Map org sub-tab ids to the activeSection prop OrganisationSection expects
    const orgActiveSection = isOrgSubTab
        ? (activeTab === 'org_users' ? 'users' : activeTab === 'org_academy' ? 'academy' : activeTab === 'org_integrations' ? 'integrations' : activeTab === 'org_usage' ? 'usage' : activeTab === 'org_azure' ? 'azure' : activeTab === 'org_github_sync' ? 'github_sync' : activeTab === 'org_nextcloud_sync' ? 'nextcloud_sync' : activeTab)
        : 'license';

    const renderContent = () => {
        // Mobile: never render a hidden section's panel (covers the one frame
        // before the bounce effect moves activeTab to Preferences). License stays
        // renderable for no-plan orgs so they can subscribe.
        if (isMobile && !MOBILE_VISIBLE_TAB_SET.has(activeTab) && !(activeTab === 'license' && !hasActiveSub)) {
            return null;
        }
        if (activeTab === 'org_azure' && canSeeOrg) return <OrgAzureConfigPanel user={user} />;
        if (isOrgSubTab && canSeeOrg) return <OrganisationSection user={user} activeSection={orgActiveSection} />;
        // Consumer account tabs
        if (activeTab === 'consumer_license' && isConsumerAccount) return <ConsumerLicenseSection user={user} />;
        if (activeTab === 'consumer_privacy' && isConsumerAccount) return <ConsumerPrivacySection user={user} />;
        if (activeTab === 'consumer_usage' && isConsumerAccount) return <ConsumerUsageSection user={user} />;
        if (activeTab === 'consumer_integrations' && isConsumerAccount) return <ConsumerIntegrationsSection user={user} />;
        if (activeTab === 'consumer_beta' && isConsumerAccount) return <ConsumerBetaFeaturesSection user={user} />;
        switch (activeTab) {
            case 'preferences': return <PreferencesSection defaultAgentMode={defaultAgentMode} setDefaultAgentMode={setDefaultAgentMode} defaultAgentId={defaultAgentId} setDefaultAgentId={setDefaultAgentId} agents={agents} onLogout={onLogout} user={user} onUpdateUser={onUpdateUser} />;
            case 'appearance': return <AppearanceSection />;
            case 'security': return <SecuritySection />;
            case 'memory': return <MemorySection memoryStats={memoryStats} onOpenMemory={() => setShowMemoryPanel(true)} onImported={fetchMemoryStats} />;
            case 'integrations': return <IntegrationsSection statuses={statuses} onSaved={handleIntegrationSaved} isOrgAdmin={canSeeOrg} user={user} showOrgIntegrations={isConsumerAccount} />;
            case 'learning': return canUseLearning ? <LearningCenterSection user={user} /> : null;
            case 'help_support': return isSelfHosted ? null : <HelpSupportSection user={user} />;
            case 'legal_consent': return isSelfHosted ? null : <LegalConsentSection user={user} />;
            case 'organisation': return canSeeOrg ? <OrganisationSection user={user} activeSection={isSelfHosted ? 'auth' : 'license'} /> : null;
            default: return null;
        }
    };

    // Mobile master–detail: the section menu ('list') and a single section's
    // content ('detail') are shown one at a time on phones. Desktop shows both
    // side by side and ignores this flag.
    const [mobileDetail, setMobileDetail] = useState(false);
    // SubscriptionGate routes a no-plan org to the License tab; surface it
    // directly on mobile so they can still subscribe (the org menu is hidden).
    useEffect(() => {
        if (isMobile && activeTab === 'license' && !hasActiveSub) setMobileDetail(true);
    }, [isMobile, activeTab, hasActiveSub]);

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
            if (isMobile) setMobileDetail(true);   // drill into the section
        }
    };

    // Phone title bar shows the section name while in detail view.
    const activeNavItem = NAV_ITEMS.find(i => i.id === activeTab);
    const mobileInDetail = isMobile && mobileDetail;
    const titleLabel = mobileInDetail
        ? (activeNavItem ? t(activeNavItem.labelKey) : t('settings.title'))
        : t('settings.title');

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)', position: 'relative' }}>
            {/* ── Title bar ── */}
            <div
                className="flex-shrink-0 flex items-center gap-2 px-5"
                style={{ height: '48px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
            >
                {/* Phone back button. In a section (detail) it returns to the
                    section list; on the list it exits Settings back to chat —
                    phones have no persistent sidebar while Settings is open.
                    Desktop keeps the sidebar, so the button is hidden there. */}
                <button
                    onClick={() => { if (mobileInDetail) setMobileDetail(false); else handleClose(); }}
                    className="md:hidden -ml-2 mr-0.5 p-1.5 rounded-lg"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label={t('common.back') || 'Back'}
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{titleLabel}</span>
            </div>

            {/* ── Body ── */}
            {/* Desktop: nav + content side by side. Phone: master–detail — the
                nav list and a section's content are shown one at a time. */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── Sidebar ── */}
                {/* 180px on laptops <1280, 220px on larger screens — keeps enough room
                    for the settings content area without forcing horizontal scroll.
                    On phones it's the full-screen section list; once a section is
                    opened it's hidden in favour of the content panel. */}
                <div
                    className={`flex-shrink-0 flex-col w-full md:w-[180px] xl:w-[220px] ${mobileDetail ? 'hidden md:flex' : 'flex'}`}
                    style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)' }}
                >
                    {/* User mini-card */}
                    <button
                        onClick={() => { setActiveTab('preferences'); if (isMobile) setMobileDetail(true); }}
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

                        {isSimpleMode ? (
                            <NavItem
                                key={NAV_ITEMS[0].id}
                                {...NAV_ITEMS[0]}
                                label={t(NAV_ITEMS[0].labelKey)}
                                isActive={activeTab === NAV_ITEMS[0].id}
                                onClick={handleNavClick}
                            />
                        ) : (
                            NAV_ITEMS.filter(item => {
                                if (item.id === 'learning' && !canUseLearning) return false;
                                // Legal & Consent and Help & Support are Bee Flow Cloud
                                // surfaces (the support inbox talks to the Bee Flow team) —
                                // hidden on self-hosted, where neither applies.
                                if (item.id === 'legal_consent' && isSelfHosted) return false;
                                if (item.id === 'help_support' && isSelfHosted) return false;
                                // Mobile hides Connections + Learning Center.
                                if (isMobile && !MOBILE_VISIBLE_TAB_SET.has(item.id)) return false;
                                return true;
                            }).map(item => (
                                <NavItem
                                    key={item.id}
                                    {...item}
                                    label={item.labelKey ? t(item.labelKey) : item.label}
                                    isActive={activeTab === item.id && !isOrgSubTab}
                                    onClick={handleNavClick}
                                />
                            ))
                        )}

                        {/* Organisation accordion — only if permitted. Hidden on
                            mobile: phones show user settings only. */}
                        {!isSimpleMode && !isMobile && canSeeOrg && (
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

                        {/* Consumer Account section — for org-less cloud users.
                            Hidden on mobile (user settings only). */}
                        {!isSimpleMode && !isMobile && isConsumerAccount && !canSeeOrg && (
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
                                <NavItem
                                    id="consumer_usage"
                                    label={t('settings.usage_monitoring') || 'Usage & Monitoring'}
                                    icon={<BarChart2 style={{ width: '15px', height: '15px' }} />}
                                    isActive={activeTab === 'consumer_usage'}
                                    onClick={handleNavClick}
                                />
                                <NavItem
                                    id="consumer_integrations"
                                    label={t('settings.integrations') || 'Integrations'}
                                    icon={<Link2 style={{ width: '15px', height: '15px' }} />}
                                    isActive={activeTab === 'consumer_integrations'}
                                    onClick={handleNavClick}
                                />
                                <NavItem
                                    id="consumer_beta"
                                    label={t('settings.beta_features') || 'Beta features'}
                                    icon={<Sparkles style={{ width: '15px', height: '15px' }} />}
                                    isActive={activeTab === 'consumer_beta'}
                                    onClick={handleNavClick}
                                />
                            </>
                        )}
                    </div>

                    {/* Footer — product name + build version (commit SHA is unique per CI deploy). */}
                    <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <p
                            className="text-[10px]"
                            style={{ color: 'var(--text-muted)' }}
                            title={formatVersionWithDate()}
                        >
                            Bee Flow <span style={{ opacity: 0.7 }}>{formatVersion()}</span>
                        </p>
                    </div>
                </div>

                {/* ── Content panel ── */}
                <div className={`flex-1 overflow-auto ${mobileDetail ? 'block' : 'hidden md:block'}`} style={{ background: 'var(--bg-primary)' }}>
                    <div
                        className={`mx-auto py-6 md:py-8 px-4 md:px-8 ${(isOrgSubTab || activeTab === 'consumer_usage' || activeTab === 'consumer_integrations') ? 'max-w-5xl' : 'max-w-[640px]'}`}
                        style={activeTab === 'org_usage' ? { maxWidth: '100%', padding: '24px 32px 32px' } : undefined}
                    >
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
