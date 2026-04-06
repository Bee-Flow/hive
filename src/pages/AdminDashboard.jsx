import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { ArrowLeft } from 'lucide-react';
import NavLink from '../components/NavLink';
import AgentConfigHub from '../components/admin/AgentConfigHub';
import AIConfigPanel from '../components/admin/AIConfig';
import SecurityHub from '../components/admin/SecurityHub';
import IntegrationsAdminPanel from '../components/admin/IntegrationsAdminPanel';
import MonitoringPanel from '../components/admin/MonitoringPanel';
import SubscriptionsPanel from '../components/admin/SubscriptionsPanel';
import LanguagesPanel from '../components/admin/LanguagesPanel';
import AppearanceAdminPanel from '../components/admin/AppearanceAdminPanel';


const AdminDashboard = ({ user, onBack, adminPath = {}, onNavigate }) => {
    const { t } = useTranslation();
    // Permission helper - checks if user has a specific permission
    const hasPermission = (perm) => {
        const perms = user?.permissions || [];
        return perms.includes('all') || perms.includes(perm);
    };

    const isSuperAdmin = user?.isAdmin || user?.role === 'admin' || hasPermission('all');

    // Tab definitions — each tab requires its page-level permission
    // 'agents' tab accepts admin_agents (catch-all) OR any granular admin_agents_* permission
    const tabs = [
        { id: 'agents', label: t('admin.tab_agents'), perm: ['admin_agents', 'admin_agents_chat', 'admin_agents_system'], superAdminOnly: false },
        { id: 'ai-config', label: t('admin.tab_ai_config'), perm: ['admin_ai_config'], superAdminOnly: true },
        { id: 'security', label: t('admin.tab_security'), perm: ['admin_security'], superAdminOnly: false },
        { id: 'integrations', label: t('admin.tab_integrations'), perm: ['admin_security'], superAdminOnly: true },
        { id: 'monitoring', label: t('admin.tab_monitoring'), perm: ['admin_monitoring'], superAdminOnly: false },
        { id: 'subscriptions', label: t('admin.tab_subscriptions'), perm: ['admin_subscriptions'], superAdminOnly: true },
        { id: 'appearance', label: t('admin.tab_appearance'), perm: ['admin_ai_config'], superAdminOnly: true },
        { id: 'languages', label: t('admin.tab_languages'), perm: ['admin_ai_config'], superAdminOnly: true },
    ];

    // If current tab isn't allowed, fall back to the first tab the user has access to
    const checkTabAccess = (tab) => {
        if (!tab) return true;
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

    const handleTabClick = (tabId) => {
        if (onNavigate) {
            onNavigate(`admin/${tabId}`);
        }
    };

    // Check if user has ANY admin permission at all
    const hasAnyAdminPermission = hasPermission('all') || tabs.some(tab => checkTabAccess(tab));

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

                <div className="flex gap-2 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    {tabs.map((tab) => {
                        if (!checkTabAccess(tab)) return null;

                        return (
                            <NavLink
                                key={tab.id}
                                href={`/admin/${tab.id}`}
                                onNavigate={() => handleTabClick(tab.id)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
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
                    ) : activeTab === 'monitoring' ? (
                        <div className="absolute inset-0">
                            <MonitoringPanel activeSection={adminPath.seg2} onNavigate={onNavigate} />
                        </div>
                    ) : activeTab === 'subscriptions' ? (
                        <div className="absolute inset-0 overflow-hidden">
                            <SubscriptionsPanel />
                        </div>
                    ) : activeTab === 'appearance' ? (
                        <div className="absolute inset-0">
                            <AppearanceAdminPanel />
                        </div>
                    ) : activeTab === 'languages' ? (
                        <div className="absolute inset-0 overflow-hidden">
                            <LanguagesPanel />
                        </div>
                    ) : null}
            </div>
        </div>
    );
};

export default AdminDashboard;
