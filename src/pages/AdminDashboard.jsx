import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { ArrowLeft } from 'lucide-react';
import NavLink from '../components/NavLink';
import AgentConfigHub from '../components/admin/AgentConfigHub';
import AIConfigPanel from '../components/admin/AIConfig';
import SecurityHub from '../components/admin/SecurityHub';
import IntegrationsAdminPanel from '../components/admin/IntegrationsAdminPanel';
import MonitoringPanel from '../components/admin/MonitoringPanel';
import ComplianceHub from '../components/admin/ComplianceHub';
import SubscriptionsPanel from '../components/admin/subscriptions';
import LanguagesPanel from '../components/admin/LanguagesPanel';
import LegalDocsPanel from '../components/admin/LegalDocsPanel';
import AppearancePanel from '../components/admin/appearance-studio/AppearancePanel';
import ProductWebsitePanel from '../components/admin/ProductWebsite/ProductWebsitePanel';
import AnalyticsPanel from '../components/admin/ProductWebsite/AnalyticsPanel';
import ReleaseNotesPanel from '../components/admin/ProductWebsite/ReleaseNotesPanel';
import ServerLicensePanel from '../components/admin/ServerLicensePanel';
import ModulesPanel from '../components/admin/ModulesPanel';
import SupportInboxPanel from '../components/admin/SupportInboxPanel';
import AccessPermissionsPanel from '../components/admin/AccessPermissionsPanel';
import { useDeploymentMode } from '../hooks/useDeploymentMode';
import { useLicenseContext, TIER_RANK } from '../components/LicenseContext';


const AdminDashboard = ({ user, onBack, adminPath = {}, onNavigate }) => {
    const { t } = useTranslation();
    const { isCloud, isSelfHosted } = useDeploymentMode();
    // A server-wide licence covers the whole install — no org needs a Stripe
    // subscription, so the cloud Subscriptions management surface is moot.
    const { serverOverride, tier } = useLicenseContext();
    const isPlatformAdmin = user?.isAdmin || user?.role === 'admin';

    // Permission helper - checks if user has a specific permission
    const hasPermission = (perm) => {
        if (isPlatformAdmin) return true;
        const perms = user?.permissions || [];
        return perms.includes('all') || perms.includes(perm);
    };

    // Platform admin means users.role === 'admin' — NOT the 'all' permission.
    // The server draws the same line (auth/permissions.js requireSuperAdmin),
    // and it deliberately does not honour 'all': that wildcard is reachable
    // from inside a tenant via a role attached to a group. Including it here
    // would render operator-only tabs that then 403 on every request, which
    // reads as a broken console rather than a clean denial.
    const isSuperAdmin = isPlatformAdmin;

    // Tab definitions — each tab requires its page-level permission
    // 'agents' tab accepts admin_agents (catch-all) OR any granular admin_agents_* permission
    //
    // minTier: 'enterprise' marks a tab as part of the paid admin surface. The
    // Community tier only exposes AI Config, Security, Integrations, Server
    // licence and Languages — every other tab carries minTier and stays hidden
    // until the install reaches Enterprise. checkTabAccess reads the REAL
    // resolved tier (LicenseContext.hasTier has no super-admin elevation), so a
    // Community install hides these from its own operator too. Subscriptions is
    // already cloudOnly, so it never surfaces on a self-hosted Community install
    // and intentionally carries no minTier (keeps the cloud operator console
    // reachable regardless of the operator org's own tier).
    const tabs = [
        { id: 'agents', label: t('admin.tab_agents'), perm: ['admin_agents', 'admin_agents_chat', 'admin_agents_system'], superAdminOnly: false, minTier: 'enterprise' },
        { id: 'ai-config', label: t('admin.tab_ai_config'), perm: ['admin_ai_config'], superAdminOnly: true },
        { id: 'security', label: t('admin.tab_security'), perm: ['admin_security'], superAdminOnly: false },
        { id: 'integrations', label: t('admin.tab_integrations'), perm: ['admin_security'], superAdminOnly: true },
        // Access & Permissions — grant features/integrations to All members or
        // per group, within the plan/license ceiling. Available to org-admins
        // too (they manage their own org); super-admins get an org picker.
        { id: 'access', label: t('admin.tab_access', 'Access'), perm: ['admin_security', 'org_admin', 'manage_users'], superAdminOnly: false },
        { id: 'monitoring', label: t('admin.tab_monitoring'), perm: ['admin_monitoring'], superAdminOnly: false, minTier: 'enterprise' },
        // Compliance Hub — available on cloud AND self-hosted (Enterprise):
        // self-hosted GDPR customers are exactly who the hub serves. Also
        // reachable from Settings → Organisation for org-admins/DPOs.
        { id: 'compliance', label: t('admin.tab_compliance'), perm: ['admin_compliance'], superAdminOnly: false, minTier: 'enterprise' },
        // Bee Flow customer-support inbox. Visible to any super-admin (or a
        // user with the `admin_support` permission), on cloud and self-hosted
        // alike — outbound email + AI reply are best-effort and degrade
        // gracefully if SMTP / KB aren't configured.
        { id: 'support', label: t('admin.tab_support', 'Support'), perm: ['admin_support'], superAdminOnly: true, minTier: 'enterprise' },
        // Subscriptions are a Bee Flow Cloud feature. Self-hosted installs
        // manage paid access via license keys (Settings → License & Usage).
        { id: 'subscriptions', label: t('admin.tab_subscriptions'), perm: ['admin_subscriptions'], superAdminOnly: true, cloudOnly: true },
        // Server-wide licence governs every org/user on this install.
        // Available to super-admins on any deployment mode — a single-tenant
        // operator applies one licence for the whole server.
        { id: 'licenses', label: t('admin.tab_server_license', 'Server licence'), perm: ['all'], superAdminOnly: true },
        // Optional server modules — import/remove feature modules install-wide.
        // Mirrors the Server-licence gating: global super-admin, any deployment.
        { id: 'modules', label: t('admin.tab_modules', 'Modules'), perm: ['all'], superAdminOnly: true },
        { id: 'appearance', label: t('admin.tab_appearance'), perm: ['admin_ai_config'], superAdminOnly: true, minTier: 'enterprise' },
        { id: 'languages', label: t('admin.tab_languages'), perm: ['admin_ai_config'], superAdminOnly: true },
        // Legal — platform admin edits the legal documents (content + version +
        // which require consent) and manages optional (marketing) consents.
        // Legal & Consent is a Bee Flow Cloud surface; self-hosted installs are
        // governed by their licence agreement, so the tab is hidden there.
        { id: 'legal', label: t('admin.tab_legal', 'Legal'), perm: ['admin_ai_config'], superAdminOnly: true, cloudOnly: true },
        // Product website builder — a Bee Flow Cloud marketing surface. On a
        // self-hosted install the public site is disabled (root goes straight
        // to /app), so the editor tab is hidden too.
        { id: 'product-website', label: t('admin.tab_product_website'), perm: ['admin_ai_config'], superAdminOnly: true, minTier: 'enterprise', cloudOnly: true },
        // Website analytics — self-hosted usage tracking for the CMS site.
        // Gated identically to product-website so it only surfaces when the
        // Website CMS product is active (super-admin, Enterprise, cloud).
        { id: 'website-analytics', label: t('admin.tab_website_analytics', 'Website Analytics'), perm: ['admin_ai_config'], superAdminOnly: true, minTier: 'enterprise', cloudOnly: true },
        // Release notes review queue. Same gating as the two tabs above — it is
        // part of the Website CMS surface, and it is where machine-drafted
        // changelog copy is approved before a customer ever sees it.
        { id: 'release-notes', label: t('admin.tab_release_notes', 'Release Notes'), perm: ['admin_ai_config'], superAdminOnly: true, minTier: 'enterprise', cloudOnly: true },
    ];

    // If current tab isn't allowed, fall back to the first tab the user has access to
    const checkTabAccess = (tab) => {
        if (!tab) return true;
        if (tab.cloudOnly && !isCloud) return false;
        // Tier gate — paid admin surfaces are hidden below their minTier. Uses
        // the REAL resolved tier (TIER_RANK[tier]) rather than hasTier(), which
        // is equivalent here but keeps the intent explicit: a Community install
        // exposes only AI Config / Security / Integrations / Server licence /
        // Languages, even to its own super-admin. tier is already normalised
        // (LEGACY_TIER_ALIAS applied at fetch); default rank 0 = community.
        if (tab.minTier && (TIER_RANK[tier] ?? 0) < (TIER_RANK[tab.minTier] ?? Infinity)) return false;
        // Server-wide licence active → no per-org subscriptions to manage.
        if (tab.id === 'subscriptions' && serverOverride) return false;
        if (tab.selfHostedOnly && !isSelfHosted) return false;
        if (tab.superAdminOnly && !isSuperAdmin) return false;
        return tab.perm.some(p => hasPermission(p));
    };

    // Support direct paths like /admin/chat → maps to agents tab with chat section
    const AGENT_SECTION_IDS = ['chat', 'system'];
    let requestedTab = adminPath.seg1 || 'agents';
    let agentSection = adminPath.seg2 || '';

    // If seg1 is an agent section (e.g. /admin/chat), remap to agents tab
    if (AGENT_SECTION_IDS.includes(requestedTab)) {
        agentSection = requestedTab;
        requestedTab = 'agents';
    }

    const firstAllowedTab = tabs.find(t => checkTabAccess(t));
    const requestedTabDef = tabs.find(t => t.id === requestedTab);
    const isRequestedAllowed = checkTabAccess(requestedTabDef);
    const activeTab = isRequestedAllowed ? requestedTab : (firstAllowedTab?.id || requestedTab);

    // The tab bar scrolls horizontally (it's at capacity). Bring the active tab
    // into view so newly-added right-edge tabs (e.g. Website Analytics) aren't
    // stranded off-screen when selected.
    const tabScrollRef = React.useRef(null);
    React.useEffect(() => {
        const el = tabScrollRef.current?.querySelector(`a[href="/admin/${activeTab}"]`);
        el?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    }, [activeTab]);

    const handleTabClick = (tabId) => {
        if (onNavigate) {
            onNavigate(`admin/${tabId}`);
        }
    };

    // Check if user has ANY admin permission at all
    const hasAnyAdminPermission = isSuperAdmin || hasPermission('all') || tabs.some(tab => checkTabAccess(tab));

    if (!hasAnyAdminPermission) {
        return (
            <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-center p-8 rounded-2xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t('admin.access_denied_title')}</h2>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{t('admin.access_denied_desc')}</p>
                    {onBack && <button onClick={onBack} className="px-4 py-2 rounded-lg font-medium text-white" style={{ background: 'var(--accent-primary)' }}>{t('admin.go_back')}</button>}
                </div>
            </div>
        );
    }

    // Check if the currently active tab is allowed
    const activeTabDef = tabs.find(t => t.id === activeTab);
    const isTabAllowed = checkTabAccess(activeTabDef);

    // Render access denied for forbidden tab content
    const renderAccessDenied = () => (
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8 rounded-2xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('admin.forbidden_title')}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('admin.forbidden_desc')}</p>
            </div>
        </div>
    );

    // Product website — full-screen builder. It escapes the admin chrome
    // entirely (no dashboard top bar): the builder owns its own TopBar and
    // navigates back / cross-links via onExit / onNavigate. Gating is
    // identical to the tab (checkTabAccess ran above); a forbidden request
    // falls through to the normal chrome + renderAccessDenied below.
    if (activeTab === 'product-website' && isTabAllowed) {
        return (
            <div className="h-full" style={{ background: 'var(--bg-primary)' }}>
                <ProductWebsitePanel
                    onExit={() => handleTabClick(firstAllowedTab?.id || 'agents')}
                    onNavigate={onNavigate}
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-card)' }}>
            {/* Top Navigation Bar */}
            <div className="h-14 flex items-center justify-between px-4 border-b shrink-0" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            title={t('admin.back_to_chat')}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <h2 className="text-lg font-semibold text-primary">
                        {t('admin.dashboard_title')}
                    </h2>
                </div>

                {/* Scrollable so the full tab set (now incl. Website Analytics)
                    is always reachable — the bar is at capacity and a fixed
                    single row would clip the rightmost tabs off-screen. */}
                <div ref={tabScrollRef} className="flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                    <div className="flex gap-2 p-1 rounded-lg w-max mx-auto" style={{ background: 'var(--bg-tertiary)' }} data-surface="default" data-static>
                        {tabs.map((tab) => {
                            if (!checkTabAccess(tab)) return null;

                            return (
                                <NavLink
                                    key={tab.id}
                                    href={`/admin/${tab.id}`}
                                    onNavigate={() => handleTabClick(tab.id)}
                                    className={`shrink-0 whitespace-nowrap px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                                        ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                                        : 'text-muted hover:text-primary hover:bg-white/5'
                                        }`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    {tab.label}
                                </NavLink>
                            );
                        })}
                    </div>
                </div>

                <div className="w-20"></div> {/* Spacer for balance */}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {!isTabAllowed ? renderAccessDenied() :
                    activeTab === 'agents' ? (
                        <div className="absolute inset-0">
                            <AgentConfigHub user={user} hasPermission={hasPermission} activeSection={agentSection} onNavigate={onNavigate} />
                        </div>
                    ) : activeTab === 'ai-config' ? (
                        <div className="absolute inset-0 overflow-hidden p-6">
                            <div className="h-full mx-auto max-w-full">
                                <AIConfigPanel />
                            </div>
                        </div>
                    ) : activeTab === 'security' ? (
                        <div className="absolute inset-0">
                            <SecurityHub user={user} activeSection={adminPath.seg2} userSection={adminPath.seg3} onNavigate={onNavigate} />
                        </div>
                    ) : activeTab === 'integrations' ? (
                        <div className="absolute inset-0">
                            <IntegrationsAdminPanel activeSection={adminPath.seg2} onNavigate={onNavigate} />
                        </div>
                    ) : activeTab === 'access' ? (
                        <div className="absolute inset-0">
                            <AccessPermissionsPanel user={user} activeSection={adminPath.seg2} onNavigate={onNavigate} />
                        </div>
                    ) : activeTab === 'monitoring' ? (
                        <div className="absolute inset-0">
                            <MonitoringPanel activeSection={adminPath.seg2} onNavigate={onNavigate} />
                        </div>
                    ) : activeTab === 'compliance' ? (
                        <div className="absolute inset-0">
                            <ComplianceHub activeSection={adminPath.seg2} focusCheckId={adminPath.seg3} onNavigate={onNavigate} />
                        </div>
                    ) : activeTab === 'subscriptions' ? (
                        <div className="absolute inset-0 overflow-hidden">
                            <SubscriptionsPanel />
                        </div>
                    ) : activeTab === 'support' ? (
                        <div className="absolute inset-0">
                            <SupportInboxPanel focusThreadId={adminPath.seg2 || null} />
                        </div>
                    ) : activeTab === 'licenses' ? (
                        <div className="absolute inset-0 overflow-auto p-6">
                            <div className="mx-auto max-w-3xl">
                                <ServerLicensePanel />
                            </div>
                        </div>
                    ) : activeTab === 'modules' ? (
                        <div className="absolute inset-0 overflow-auto p-6">
                            <div className="mx-auto max-w-5xl">
                                <ModulesPanel />
                            </div>
                        </div>
                    ) : activeTab === 'appearance' ? (
                        <div className="absolute inset-0">
                            <AppearancePanel />
                        </div>
                    ) : activeTab === 'languages' ? (
                        <div className="absolute inset-0 overflow-hidden">
                            <LanguagesPanel />
                        </div>
                    ) : activeTab === 'legal' ? (
                        <div className="absolute inset-0 overflow-auto">
                            <LegalDocsPanel />
                        </div>
                    ) : activeTab === 'website-analytics' ? (
                        <div className="absolute inset-0">
                            <AnalyticsPanel />
                        </div>
                    ) : activeTab === 'release-notes' ? (
                        <div className="absolute inset-0">
                            <ReleaseNotesPanel />
                        </div>
                    ) : null}
            </div>
        </div>
    );
};

export default AdminDashboard;
