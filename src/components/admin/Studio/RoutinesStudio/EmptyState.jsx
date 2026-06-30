import React, { useState } from 'react';
import { Plus, Clock } from 'lucide-react';
import scopedStorage from '../../../../utils/scopedStorage';
import BuildWithAITab from './BuildWithAITab';
import FindRepeatingWorkTab from './FindRepeatingWorkTab';
import TemplatesTab from './TemplatesTab';
import StepsTab from './StepsTab';
import ExecutionsPanel from '../Executions/ExecutionsPanel';

/**
 * Right-pane empty state shown when no routine is selected.
 *
 * For the `automation` segment it's a tabbed launcher — four self-contained
 * tabs (Build with AI · Find repeating work · Templates · History). All four
 * panels stay mounted and are shown/hidden with a `hidden` class so each tab
 * keeps its own state across switches (e.g. a completed scan), and network
 * behaviour matches the old single-scroll page (no extra fetches). The chosen
 * tab persists per-user via scopedStorage.
 *
 * The `prompt_task` segment keeps its original simple CTA layout.
 */
const TABS = [
    { id: 'build', label: 'Build with AI' },
    { id: 'repeating', label: 'Find repeating work' },
    { id: 'steps', label: 'Steps' },
    { id: 'templates', label: 'Templates' },
    { id: 'history', label: 'Executions' },
];
const TAB_KEY = 'routinesStartTab';

export default function RoutinesEmptyState({ segment, onCreateAutomation, onCreateTask, onUseExample, onOpenAutomation, onPickTemplate, onBuildSuggestion, onAskSuggestion, steps, stepsLoading, onCreateStep, onOpenStep, onOpenStepRuns, onDeleteStep }) {
    const [activeTab, setActiveTab] = useState(() => {
        const saved = scopedStorage.getItem(TAB_KEY);
        return TABS.some(t => t.id === saved) ? saved : 'build';
    });
    const selectTab = (id) => {
        setActiveTab(id);
        try { scopedStorage.setItem(TAB_KEY, id); } catch (_) { /* storage best-effort */ }
    };

    if (segment === 'prompt_task') {
        return (
            <div className="h-full flex flex-col items-center justify-center px-6 py-12">
                <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center bg-[var(--bg-secondary)]">
                    <Clock size={28} className="text-[var(--text-primary)] opacity-60" />
                </div>
                <div className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Schedule a routine
                </div>
                <div className="text-sm text-[var(--text-tertiary)] mb-6 max-w-md text-center leading-relaxed">
                    Recurring AI workflows — weekly digests, daily reports, lead summaries.
                    Results land in your notifications when ready.
                </div>
                <button
                    onClick={onCreateTask}
                    className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white"
                    style={{ background: 'var(--accent-primary, var(--text-primary))' }}
                >
                    <Plus size={15} /> New routine
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Tab bar — underline style, matching the builder's chrome. */}
            <div className="flex-shrink-0 border-b border-[var(--border-default)]">
                <div className="max-w-3xl mx-auto px-6 flex items-center justify-center gap-1">
                    {TABS.map(t => (
                        <Tab key={t.id} id={t.id} active={activeTab} onClick={selectTab}>{t.label}</Tab>
                    ))}
                </div>
            </div>

            {/* Panels. The four "launcher" tabs stay mounted (so each keeps its
                own state) in a centered column; Executions renders full-width and
                mounts only while active (it streams live, so we don't run it in
                the background). */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className={`flex-1 min-h-0 overflow-y-auto ${activeTab === 'history' ? 'hidden' : ''}`}>
                    <div className="max-w-3xl mx-auto px-6 py-8">
                        <div className={activeTab === 'build' ? '' : 'hidden'}>
                            <BuildWithAITab onCreateAutomation={onCreateAutomation} onUseExample={onUseExample} />
                        </div>
                        <div className={activeTab === 'repeating' ? '' : 'hidden'}>
                            <FindRepeatingWorkTab onBuildSuggestion={onBuildSuggestion} onAskSuggestion={onAskSuggestion} />
                        </div>
                        <div className={activeTab === 'steps' ? '' : 'hidden'}>
                            <StepsTab steps={steps} loading={stepsLoading} onCreateStep={onCreateStep} onOpenStep={onOpenStep} onOpenStepRuns={onOpenStepRuns} onDeleteStep={onDeleteStep} />
                        </div>
                        <div className={activeTab === 'templates' ? '' : 'hidden'}>
                            <TemplatesTab onPickTemplate={onPickTemplate} />
                        </div>
                    </div>
                </div>
                {activeTab === 'history' && (
                    <div className="flex-1 min-h-0">
                        <ExecutionsPanel scope="global" onOpenEditor={onOpenAutomation} />
                    </div>
                )}
            </div>
        </div>
    );
}

// Underline tab button — copied from the builder header so the start-screen
// tabs read as the same control. Uses the theme accent token, not a
// hardcoded brand hue.
function Tab({ id, active, onClick, children }) {
    const isActive = active === id;
    return (
        <button
            onClick={() => onClick(id)}
            className={`px-3 py-2.5 border-b-2 transition text-sm font-medium ${
                isActive
                    ? 'border-[var(--accent-primary,var(--accent))] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
        >
            {children}
        </button>
    );
}
