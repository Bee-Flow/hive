import React, { useState } from 'react';
import { Bot, Sparkles, ListChecks, BookOpen, Globe } from 'lucide-react';
import useTranslation from '../../../hooks/useTranslation';
import AgentStudio from '../AgentStudio';
import AITasksDesigner from '../AITasksDesigner';
import SkillsStudio from './SkillsStudio';
import KBsStudio from './KBsStudio';
import WebpagesPage from '../../../pages/WebpagesPage';

// Unified Studio: a single shell hosting Agents, Skills, Knowledge Bases, and AI Tasks.
// All sections share a sidebar-list + editor-right split layout.
export default function Studio({
    user,
    section = 'agents',     // 'agents' | 'skills' | 'knowledge' | 'aiTasks' | 'webpages'
    initialAgentId = null,
    initialSkillId = null,
    initialKbId = null,
    initialTaskId = null,
    initialWebpageId = null,
    onClose,
    onNavigate,
    hasPermission = () => true,
    modelTiers = {},
    onEditingChange,
}) {
    const { t } = useTranslation();
    const [agentEditing, setAgentEditing] = useState(false);
    const [automationEditing, setAutomationEditing] = useState(false);
    const editing = agentEditing || automationEditing;
    const handleAgentEditing = (next) => {
        setAgentEditing(next);
        onEditingChange?.(next || automationEditing);
    };
    const handleAutomationEditing = (next) => {
        setAutomationEditing(next);
        onEditingChange?.(next || agentEditing);
    };

    const canSeeWebpages = !!(user?.canUseFeature?.webpages ?? (user?.permissions?.includes('all') || user?.betaFeatures?.includes('webpages')));
    const tabs = [
        { id: 'agents',    label: t('studio.tab.agents'),    icon: <Bot size={14} /> },
        { id: 'skills',    label: t('studio.tab.skills'),    icon: <Sparkles size={14} /> },
        { id: 'knowledge', label: t('studio.tab.knowledge'), icon: <BookOpen size={14} /> },
        { id: 'aiTasks',   label: t('studio.tab.ai_tasks'),  icon: <ListChecks size={14} /> },
        ...(canSeeWebpages ? [{ id: 'webpages', label: t('studio.tab.webpages') || 'Webpages', icon: <Globe size={14} /> }] : []),
    ];

    const switchTo = (id) => {
        if (!onNavigate) return;
        const seg = id === 'aiTasks' ? 'routines' : id;
        onNavigate(`studio/${seg}`);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Top sub-nav — hidden in any fullscreen edit mode */}
            {!editing && (
            <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-default)]">
                {tabs.map((tab) => {
                    const active = section === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => switchTo(tab.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${active
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            )}

            {/* Sub-section */}
            <div className="flex-1 min-h-0">
                {section === 'agents' && (
                    <AgentStudio
                        user={user}
                        initialAgentId={initialAgentId}
                        onClose={onClose}
                        onNavigate={onNavigate}
                        hasPermission={hasPermission}
                        onEditingChange={handleAgentEditing}
                    />
                )}
                {section === 'skills' && (
                    <SkillsStudio
                        user={user}
                        initialSkillId={initialSkillId}
                        onNavigate={onNavigate}
                        hasPermission={hasPermission}
                    />
                )}
                {section === 'knowledge' && (
                    <KBsStudio
                        user={user}
                        initialKbId={initialKbId}
                        onNavigate={onNavigate}
                        hasPermission={hasPermission}
                    />
                )}
                {section === 'webpages' && (
                    <WebpagesPage
                        user={user}
                        initialWebpageId={initialWebpageId}
                        onWebpageChange={(id) => onNavigate && onNavigate(id ? `studio/webpages/${id}` : 'studio/webpages')}
                        embedded
                        hasPermission={hasPermission}
                    />
                )}
                {section === 'aiTasks' && (
                    <AITasksDesigner
                        initialTaskId={initialTaskId}
                        onClose={onClose}
                        onNavigate={onNavigate}
                        modelTiers={modelTiers}
                        embedded={true}
                        user={user}
                        onEditingChange={handleAutomationEditing}
                    />
                )}
            </div>
        </div>
    );
}
