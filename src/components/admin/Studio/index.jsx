import React, { useState } from 'react';
import { Bot, Sparkles, ListChecks, BookOpen, Globe, Bug, Mic } from 'lucide-react';
import useTranslation from '../../../hooks/useTranslation';
import AgentStudio from '../AgentStudio';
import AITasksDesigner from '../AITasksDesigner';
import SkillsStudio from './SkillsStudio';
import KBsStudio from './KBsStudio';
import WebpagesPage from '../../../pages/WebpagesPage';
import TestsStudio from './TestsStudio';
import MeetingNotesPage from '../../../pages/meeting-notes/MeetingNotesPage';
import { useLicenseContext } from '../../LicenseContext';

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
    const { hasFeature: hasLicenseFeature } = useLicenseContext();
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

    // Webpages tab: licence feature is authoritative. canUseFeature is the
    // server-derived intersection of licence × beta and includes webpages
    // automatically when the tier matches, but we re-check the licence
    // explicitly so a stale session can't keep the tab visible after a
    // downgrade.
    const canSeeWebpages = hasLicenseFeature('webpages') && !!(user?.canUseFeature?.webpages ?? (user?.permissions?.includes('all') || user?.betaFeatures?.includes('webpages')));
    // Mirrors the canSeeWebpages pattern — playwright_tests is enterprise-tier
    // + beta-opt-in. canUseFeature already does the AND on the server side.
    const canSeeTests = hasLicenseFeature('playwright_tests') && !!(user?.canUseFeature?.playwright_tests ?? (user?.permissions?.includes('all') || user?.betaFeatures?.includes('playwright_tests')));
    // Meeting Notes is enterprise + beta opt-in (mirrors webpages/tests). We
    // intentionally rely on canUseFeature (server-resolved license × beta)
    // rather than spot-checking betaFeatures so super-admin grants flow
    // correctly down to ordinary org members.
    const canSeeMeetingNotes = hasLicenseFeature('meeting_notes') && !!(user?.canUseFeature?.meeting_notes ?? (user?.permissions?.includes('all') || user?.betaFeatures?.includes('meeting_notes')));
    const tabs = [
        { id: 'agents',    label: t('studio.tab.agents'),    icon: <Bot size={14} /> },
        { id: 'skills',    label: t('studio.tab.skills'),    icon: <Sparkles size={14} /> },
        { id: 'knowledge', label: t('studio.tab.knowledge'), icon: <BookOpen size={14} /> },
        { id: 'aiTasks',   label: t('studio.tab.ai_tasks'),  icon: <ListChecks size={14} /> },
        ...(canSeeWebpages ? [{ id: 'webpages', label: t('studio.tab.webpages') || 'Webpages', icon: <Globe size={14} /> }] : []),
        ...(canSeeTests ? [{ id: 'tests', label: t('studio.tab.tests') || 'Tests', icon: <Bug size={14} /> }] : []),
        ...(canSeeMeetingNotes ? [{ id: 'meetingNotes', label: t('studio.tab.meeting_notes') || 'Meeting Notes', icon: <Mic size={14} /> }] : []),
    ];

    const switchTo = (id) => {
        if (!onNavigate) return;
        const seg = id === 'aiTasks' ? 'routines'
            : id === 'meetingNotes' ? 'meeting-notes'
            : id;
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
                {section === 'tests' && (
                    <TestsStudio
                        user={user}
                        onNavigate={onNavigate}
                        hasPermission={hasPermission}
                    />
                )}
                {section === 'meetingNotes' && (
                    <MeetingNotesPage
                        user={user}
                        embedded
                        onBack={null}
                    />
                )}
            </div>
        </div>
    );
}
