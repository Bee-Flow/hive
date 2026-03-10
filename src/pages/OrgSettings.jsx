import React from 'react';
import { ArrowLeft } from 'lucide-react';
import AgentDesigner from '../components/admin/AgentDesigner';
import OrgUsersPanel from '../components/admin/OrgUsersPanel';
import OrgInfoPanel from '../components/admin/OrgInfoPanel';

const OrgSettings = ({ user, onBack, orgSettingsPath = {}, onNavigate }) => {
    const tabs = [
        { id: 'organisation', label: 'Organisation' },
        { id: 'agents', label: 'Agents' },
        { id: 'users', label: 'Users' },
    ];

    const activeTab = tabs.some(t => t.id === orgSettingsPath.seg1) ? orgSettingsPath.seg1 : 'organisation';

    const handleTabClick = (tabId) => {
        if (onNavigate) {
            onNavigate(`org-settings/${tabId}`);
        }
    };

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
                    {tabs.map((tab) => (
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
                        <AgentDesigner onBack={null} hasPermission={() => true} />
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default OrgSettings;
