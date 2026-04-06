import React from 'react';
import { ArrowLeft, ShieldOff } from 'lucide-react';
import AgentDesigner from '../components/admin/AgentDesigner';
import OrgUsersPanel from '../components/admin/OrgUsersPanel';
import OrgInfoPanel from '../components/admin/OrgInfoPanel';
import { AGENT_MANAGEMENT_ROLES, USER_MANAGEMENT_ROLES } from '../config/orgRoles';

const OrgSettings = ({ user, onBack, orgSettingsPath = {}, onNavigate }) => {
    // Permission helper — derives from the actual user permission set
    const hasPermission = (perm) => {
        const perms = user?.permissions || [];
        return perms.includes('all') || perms.includes(perm);
    };

    const isSuperAdmin = user?.isAdmin || user?.role === 'admin' || hasPermission('all');
    const orgRole = user?.orgRole || '';

    // Gate: user must be an org admin, agent admin, agent editor, or super admin
    const canAccessOrgSettings = isSuperAdmin || orgRole === 'org_admin'
        || hasPermission('org_admin') || hasPermission('manage_users') || hasPermission('manage_agents');

    // Tab-level permissions
    const canManageAgents = isSuperAdmin || AGENT_MANAGEMENT_ROLES.includes(orgRole)
        || hasPermission('manage_agents');
    const canManageUsers = isSuperAdmin || USER_MANAGEMENT_ROLES.includes(orgRole)
        || hasPermission('manage_users');

    const tabs = [
        { id: 'organisation', label: 'Organisation', allowed: canAccessOrgSettings },
        { id: 'agents', label: 'Agents', allowed: canManageAgents },
        { id: 'users', label: 'Users', allowed: canManageUsers },
    ];

    const allowedTabs = tabs.filter(t => t.allowed);
    const activeTab = allowedTabs.some(t => t.id === orgSettingsPath.seg1)
        ? orgSettingsPath.seg1
        : (allowedTabs[0]?.id || 'organisation');

    const handleTabClick = (tabId) => {
        if (onNavigate) {
            onNavigate(`org-settings/${tabId}`);
        }
    };

    // Full access denied gate
    if (!canAccessOrgSettings) {
        return (
            <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-center p-8 rounded-2xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                        <ShieldOff className="w-8 h-8" style={{ color: 'rgb(239, 68, 68)' }} />
                    </div>
                    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>You don't have permission to access organisation settings.</p>
                    {onBack && <button onClick={onBack} className="px-4 py-2 rounded-lg font-medium text-white" style={{ background: 'var(--accent-primary)' }}>Go Back</button>}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Top Navigation Bar */}
            <div className="h-14 flex items-center justify-between px-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            title="Back to chat"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <h2 className="text-lg font-semibold text-primary">
                        Organisation Settings
                    </h2>
                </div>

                <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    {allowedTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                                : 'text-muted hover:text-primary hover:bg-white/5'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="w-20"></div> {/* Spacer for balance */}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'organisation' ? (
                    <div className="absolute inset-0 overflow-auto">
                        <OrgInfoPanel user={user} />
                    </div>
                ) : activeTab === 'users' ? (
                    <div className="absolute inset-0 overflow-auto p-6">
                        <OrgUsersPanel user={user} />
                    </div>
                ) : activeTab === 'agents' ? (
                    <div className="absolute inset-0">
                        <AgentDesigner onBack={null} hasPermission={hasPermission} />
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default OrgSettings;
