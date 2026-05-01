import React from 'react';
import { Bot, Sparkles, ListChecks } from 'lucide-react';
import useTranslation from '../../../hooks/useTranslation';
import AgentStudio from '../AgentStudio';
import AITasksDesigner from '../AITasksDesigner';
import SkillsStudio from './SkillsStudio';

// Unified Studio: a single shell that hosts the Agents editor, the Skills
// editor, and the AI Tasks scheduler. Each sub-section uses the same
// list-on-left + editor-on-right layout pioneered by the Agents wizard.
export default function Studio({
    user,
    section = 'agents',     // 'agents' | 'skills' | 'aiTasks'
    initialAgentId = null,
    initialSkillId = null,
    initialTaskId = null,
    onClose,
    onNavigate,
    hasPermission = () => true,
    modelTiers = {},
}) {
    const { t } = useTranslation();

    const tabs = [
        { id: 'agents', label: t('studio.tab.agents'), icon: <Bot size={14} /> },
        { id: 'skills', label: t('studio.tab.skills'), icon: <Sparkles size={14} /> },
        { id: 'aiTasks', label: t('studio.tab.ai_tasks'), icon: <ListChecks size={14} /> },
    ];

    const switchTo = (id) => {
        if (!onNavigate) return;
        onNavigate(`studio/${id === 'aiTasks' ? 'ai-tasks' : id}`);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)]">
            {/* Top sub-nav */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-default)]">
                {tabs.map((tab) => {
                    const active = section === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => switchTo(tab.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${active
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Sub-section */}
            <div className="flex-1 min-h-0">
                {section === 'agents' && (
                    <AgentStudio
                        user={user}
                        initialAgentId={initialAgentId}
                        onClose={onClose}
                        onNavigate={onNavigate}
                        hasPermission={hasPermission}
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
                {section === 'aiTasks' && (
                    <AITasksDesigner
                        initialTaskId={initialTaskId}
                        onClose={onClose}
                        modelTiers={modelTiers}
                        embedded={true}
                    />
                )}
            </div>
        </div>
    );
}
