import React, { useState } from 'react';
import { Activity, Settings as SettingsIcon, GitBranch, Clock } from 'lucide-react';
import useConnectionSettings from './hooks/useConnectionSettings';
import ProviderIcon from './ProviderIcon';
import SyncStatusBadge from './SyncStatusBadge';
import OverviewTab from './tabs/OverviewTab';
import SettingsTab from './tabs/SettingsTab';
import PipelineTab from './tabs/PipelineTab';
import HistoryTab from './tabs/HistoryTab';

const TABS = [
    { id: 'overview', labelKey: 'email_kb.tab_overview', icon: Activity },
    { id: 'settings', labelKey: 'email_kb.tab_settings', icon: SettingsIcon },
    { id: 'pipeline', labelKey: 'email_kb.tab_pipeline', icon: GitBranch },
    { id: 'history',  labelKey: 'email_kb.tab_history',  icon: Clock },
];

const DetailPane = ({ conn, knowledgeBases, onSync, onUpdate, onDelete, onEditingChange, t }) => {
    const [tab, setTab] = useState('overview');
    const controller = useConnectionSettings(conn, { onUpdate, onSync });

    return (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[var(--bg-primary)]">
            {/* Sub-header */}
            <div className="flex-shrink-0 px-6 pt-5 pb-0 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-3">
                    <ProviderIcon provider={conn.provider} size={28} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[16px] font-bold text-[var(--text-primary)] truncate">
                                {conn.email_address}
                            </h2>
                            <SyncStatusBadge status={conn.sync_status} t={t} />
                            {!conn.enabled && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                                    {t('email_kb.disabled')}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-[var(--text-tertiary)] capitalize mt-0.5">
                            {conn.provider}
                        </p>
                    </div>
                </div>
                {/* Tabs */}
                <div className="flex items-center gap-1 mt-4 -mb-px">
                    {TABS.map(tb => {
                        const Icon = tb.icon;
                        const active = tab === tb.id;
                        return (
                            <button
                                key={tb.id}
                                onClick={() => setTab(tb.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                                    active
                                        ? 'border-[var(--accent-primary)] text-[var(--text-primary)]'
                                        : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {t(tb.labelKey)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Active tab */}
            <div className="flex-1 min-h-0 flex flex-col">
                {tab === 'overview' && (
                    <OverviewTab conn={conn} controller={controller} onUpdate={onUpdate} onDelete={onDelete} t={t} />
                )}
                {tab === 'settings' && (
                    <SettingsTab conn={conn} controller={controller} onEditingChange={onEditingChange} knowledgeBases={knowledgeBases} t={t} />
                )}
                {tab === 'pipeline' && (
                    <PipelineTab
                        controller={controller}
                        onEditingChange={onEditingChange}
                        connectionId={conn.id}
                        t={t}
                    />
                )}
                {tab === 'history' && (
                    <HistoryTab controller={controller} t={t} />
                )}
            </div>
        </div>
    );
};

export default DetailPane;
