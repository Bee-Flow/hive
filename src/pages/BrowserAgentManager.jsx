import React from 'react';
import { Plus, Globe, Monitor, Eye, Shield, Zap, Settings, X } from 'lucide-react';
import ModelSelector from '../components/ModelSelector';
import VersionHistory from '../components/VersionHistory';
import useAgentManager from '../hooks/useAgentManager';
import AgentSidebar from '../components/shared/AgentSidebar';
import SectionNav from '../components/shared/SectionNav';
import EmojiPicker from '../components/shared/EmojiPicker';

const SECTIONS = [
    { id: 'identity', label: 'Identity', icon: '🆔' },
    { id: 'browser', label: 'Browser Config', icon: '🌐' },
    { id: 'execution', label: 'Execution', icon: '🧠' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const DEFAULT_AGENT = {
    name: '',
    description: '',
    icon: '🌐',
    model: null,
    system_prompt: 'You are an autonomous browser agent. You control a web browser to accomplish tasks requested by the user. Be efficient and precise with your actions.',
    enabled: true,
    config: {
        startingUrl: '',
        maxActions: 20,
        headless: true,
        screenshotStreaming: true,
        allowedDomains: [],
        viewport: { width: 1280, height: 720 },
        timeout: 30000,
        plannerEnabled: true,
        plannerModel: '',
        maxMilestones: 6,
        actionBatchSize: 5,
        maxRetriesPerAction: 2,
        actionTimeout: 10000,
        retryEscalation: true,
        replanAfterErrors: 2,
        replanAfterStale: 3,
        loopDetection: true,
        memorySummaryInterval: 3,
        rollingWindowSize: 8
    }
};

export default function BrowserAgentManager({ onBack }) {
    const mgr = useAgentManager('/browser-agents', 'browser', DEFAULT_AGENT);
    const { selected, activeSection, isCreating, saving, availableModels, updateSelected, updateConfig, saveAgent } = mgr;



    return (
        <div className="h-full flex flex-col p-6" style={{ background: 'var(--bg-primary)' }}>
            <div className="flex-1 flex overflow-hidden border rounded-xl shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>

                <AgentSidebar
                    title="Browser Agents"
                    agents={mgr.agents}
                    selected={selected}
                    loading={mgr.loading}
                    isCreating={isCreating}
                    onSelect={mgr.selectAgent}
                    onCreate={mgr.createAgent}
                    onDelete={mgr.deleteAgent}
                    onDuplicate={mgr.duplicateAgent}
                    typeBadge={
                        <span className="text-[10px] uppercase tracking-wider font-medium text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Browser
                        </span>
                    }
                    emptyIcon="🌐"
                    emptyText="No browser agents"
                />

                {/* Main Editor */}
                <div className="flex-1 flex overflow-hidden relative">
                    {selected ? (
                        <div className="flex-1 flex w-full">
                            <div className="flex-1 flex flex-col min-w-[600px]" style={{ borderColor: 'var(--border-default)' }}>
                                {/* Header */}
                                <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)' }}>
                                    <div>
                                        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                                            {isCreating ? 'Create Browser Agent' : 'Edit Browser Agent'}
                                        </h1>
                                        <p className="text-sm text-muted">Configure browser automation settings and behavior.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {selected && !isCreating && (
                                            <button
                                                onClick={() => updateSelected('enabled', !selected.enabled)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selected.enabled
                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'
                                                    }`}
                                            >
                                                {selected.enabled ? (
                                                    <>
                                                        <Zap className="w-4 h-4" />
                                                        Enabled
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="w-4 h-4" />
                                                        Disabled
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={saveAgent}
                                            disabled={saving || !selected.name?.trim()}
                                            className="btn-primary px-6 shadow-lg shadow-cyan-500/20"
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>

                                {/* Config Area */}
                                <div className="flex-1 flex overflow-hidden">
                                    {/* Navigation Sidebar */}
                                    <SectionNav sections={SECTIONS} activeSection={activeSection} onChange={mgr.setActiveSection} />

                                    {/* Section Content */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                        <div className="max-w-3xl mx-auto">

                                            {/* IDENTITY SECTION */}
                                            {activeSection === 'identity' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Agent Identity</h2>

                                                    {/* Avatar */}
                                                    <EmojiPicker value={selected.icon} onChange={(v) => updateSelected('icon', v)} />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Name</label>
                                                            <input
                                                                type="text"
                                                                value={selected.name}
                                                                onChange={(e) => updateSelected('name', e.target.value)}
                                                                className="input w-full px-4 py-3 text-base"
                                                                placeholder="e.g. Web Scraper Agent"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Model</label>
                                                            <ModelSelector
                                                                models={availableModels}
                                                                value={selected.model || ''}
                                                                onChange={(val) => updateSelected('model', val)}
                                                                defaultLabel="Default (Global Config)"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Description</label>
                                                        <textarea
                                                            value={selected.description || ''}
                                                            onChange={(e) => updateSelected('description', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm"
                                                            rows={3}
                                                            placeholder="Describe what this browser agent does..."
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">System Prompt</label>
                                                        <textarea
                                                            value={selected.system_prompt || ''}
                                                            onChange={(e) => updateSelected('system_prompt', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm font-mono"
                                                            rows={6}
                                                            placeholder="Instructions for the browser agent..."
                                                        />
                                                        <p className="text-[10px] text-muted mt-1">How the agent should behave when controlling the browser. Browser action instructions are appended automatically.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* BROWSER CONFIG SECTION */}
                                            {activeSection === 'browser' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Browser Configuration</h2>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Starting URL</label>
                                                        <div className="flex items-center gap-2">
                                                            <Globe className="w-4 h-4 text-muted shrink-0" />
                                                            <input
                                                                type="url"
                                                                value={selected.config?.startingUrl || ''}
                                                                onChange={(e) => updateConfig('startingUrl', e.target.value)}
                                                                className="input w-full px-4 py-3 text-sm"
                                                                placeholder="https://example.com (optional)"
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-muted mt-1">The browser will navigate here before starting the task. Leave empty to let the agent decide.</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Max Actions</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="100"
                                                                value={selected.config?.maxActions || 20}
                                                                onChange={(e) => updateConfig('maxActions', parseInt(e.target.value) || 20)}
                                                                className="input w-full px-4 py-3 text-sm"
                                                            />
                                                            <p className="text-[10px] text-muted mt-1">Maximum browser actions per task (navigate, click, type, etc.).</p>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Timeout (ms)</label>
                                                            <input
                                                                type="number"
                                                                min="5000"
                                                                max="120000"
                                                                step="1000"
                                                                value={selected.config?.timeout || 30000}
                                                                onChange={(e) => updateConfig('timeout', parseInt(e.target.value) || 30000)}
                                                                className="input w-full px-4 py-3 text-sm"
                                                            />
                                                            <p className="text-[10px] text-muted mt-1">Max time to wait for page loads and elements.</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Viewport Width</label>
                                                            <input
                                                                type="number"
                                                                min="320"
                                                                max="3840"
                                                                value={selected.config?.viewport?.width || 1280}
                                                                onChange={(e) => updateConfig('viewport', { ...(selected.config?.viewport || {}), width: parseInt(e.target.value) || 1280 })}
                                                                className="input w-full px-4 py-3 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Viewport Height</label>
                                                            <input
                                                                type="number"
                                                                min="240"
                                                                max="2160"
                                                                value={selected.config?.viewport?.height || 720}
                                                                onChange={(e) => updateConfig('viewport', { ...(selected.config?.viewport || {}), height: parseInt(e.target.value) || 720 })}
                                                                className="input w-full px-4 py-3 text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Toggle options */}
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500">
                                                                <Monitor className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label htmlFor="headless" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Headless Mode</label>
                                                                <p className="text-[var(--text-secondary)] text-xs">Run browser without visible window (faster, recommended for production).</p>
                                                            </div>
                                                            <input
                                                                id="headless"
                                                                type="checkbox"
                                                                checked={selected.config?.headless !== false}
                                                                onChange={(e) => updateConfig('headless', e.target.checked)}
                                                                className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                            />
                                                        </div>

                                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500">
                                                                <Eye className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label htmlFor="screenshots" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Screenshot Streaming</label>
                                                                <p className="text-[var(--text-secondary)] text-xs">Stream screenshots back to the chat during execution.</p>
                                                            </div>
                                                            <input
                                                                id="screenshots"
                                                                type="checkbox"
                                                                checked={selected.config?.screenshotStreaming !== false}
                                                                onChange={(e) => updateConfig('screenshotStreaming', e.target.checked)}
                                                                className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                            />
                                                        </div>

                                                        {/* Screenshot Per Step */}
                                                        <div className="flex items-center justify-between p-4 rounded-xl bg-card/80 border-subtle">
                                                            <div className="flex-1">
                                                                <label htmlFor="screenshotPerStep" className="text-sm font-medium text-primary cursor-pointer">
                                                                    📸 Screenshot Per Step
                                                                </label>
                                                                <p className="text-xs text-muted mt-1">
                                                                    Send an annotated screenshot with element labels on <strong>every</strong> LLM call (slower but more accurate). Otherwise only sent on first interaction.
                                                                </p>
                                                            </div>
                                                            <input
                                                                id="screenshotPerStep"
                                                                type="checkbox"
                                                                checked={!!selected.config?.screenshotPerStep}
                                                                onChange={(e) => updateConfig('screenshotPerStep', e.target.checked)}
                                                                className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* EXECUTION SECTION */}
                                            {activeSection === 'execution' && (
                                                <div className="space-y-8 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Execution Configuration</h2>
                                                    <p className="text-xs text-muted -mt-4">Configure the Planner → Executor → Coordinator architecture that controls how the agent plans and executes browser tasks.</p>

                                                    {/* ── Planner ── */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">🗺️</span>
                                                            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Planner</h3>
                                                        </div>
                                                        <p className="text-xs text-muted -mt-2">The planner creates a step-by-step strategy before execution begins. It replans automatically when the agent gets stuck.</p>

                                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 text-violet-500">
                                                                <Zap className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label htmlFor="plannerEnabled" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Enable Planner</label>
                                                                <p className="text-[var(--text-secondary)] text-xs">Run a planning step before execution. Disable for simple, direct tasks.</p>
                                                            </div>
                                                            <input
                                                                id="plannerEnabled"
                                                                type="checkbox"
                                                                checked={selected.config?.plannerEnabled !== false}
                                                                onChange={(e) => updateConfig('plannerEnabled', e.target.checked)}
                                                                className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Planner Model</label>
                                                                <ModelSelector
                                                                    models={availableModels}
                                                                    value={selected.config?.plannerModel || ''}
                                                                    onChange={(val) => updateConfig('plannerModel', val)}
                                                                    defaultLabel="Same as agent model"
                                                                    compact
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">Use a cheaper/faster model for planning to reduce cost.</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Max Plan Steps</label>
                                                                <input
                                                                    type="number"
                                                                    min="2"
                                                                    max="15"
                                                                    value={selected.config?.maxMilestones || 6}
                                                                    onChange={(e) => updateConfig('maxMilestones', parseInt(e.target.value) || 6)}
                                                                    className="input w-full px-4 py-3 text-sm"
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">Max milestones the planner generates per plan.</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <hr className="border-[var(--border-subtle)]" />

                                                    {/* ── Executor ── */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">⚡</span>
                                                            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Executor</h3>
                                                        </div>
                                                        <p className="text-xs text-muted -mt-2">Controls how the agent executes individual browser actions — timeouts, retries, and batch sizing.</p>

                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Action Batch Size</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="20"
                                                                    value={selected.config?.actionBatchSize || 5}
                                                                    onChange={(e) => updateConfig('actionBatchSize', parseInt(e.target.value) || 5)}
                                                                    className="input w-full px-4 py-3 text-sm"
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">Actions per LLM call before yielding to coordinator.</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Action Timeout (ms)</label>
                                                                <input
                                                                    type="number"
                                                                    min="3000"
                                                                    max="60000"
                                                                    step="1000"
                                                                    value={selected.config?.actionTimeout || 10000}
                                                                    onChange={(e) => updateConfig('actionTimeout', parseInt(e.target.value) || 10000)}
                                                                    className="input w-full px-4 py-3 text-sm"
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">Max wait per click/type/wait action (not navigation).</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Max Retries</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="5"
                                                                    value={selected.config?.maxRetriesPerAction ?? 2}
                                                                    onChange={(e) => updateConfig('maxRetriesPerAction', parseInt(e.target.value) || 0)}
                                                                    className="input w-full px-4 py-3 text-sm"
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">Retry attempts per failed action (0 = no retries).</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500">
                                                                <Settings className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label htmlFor="retryEscalation" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Retry Escalation</label>
                                                                <p className="text-[var(--text-secondary)] text-xs">On retry, escalate strategy: CSS → text matching → scroll-into-view + retry.</p>
                                                            </div>
                                                            <input
                                                                id="retryEscalation"
                                                                type="checkbox"
                                                                checked={selected.config?.retryEscalation !== false}
                                                                onChange={(e) => updateConfig('retryEscalation', e.target.checked)}
                                                                className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>

                                                    <hr className="border-[var(--border-subtle)]" />

                                                    {/* ── Coordinator ── */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">🔄</span>
                                                            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Coordinator</h3>
                                                        </div>
                                                        <p className="text-xs text-muted -mt-2">The coordinator monitors execution and triggers replanning when the agent gets stuck, loops, or errors out.</p>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Replan After Errors</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="10"
                                                                    value={selected.config?.replanAfterErrors ?? 2}
                                                                    onChange={(e) => updateConfig('replanAfterErrors', parseInt(e.target.value) || 2)}
                                                                    className="input w-full px-4 py-3 text-sm"
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">Consecutive action failures before triggering a replan.</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Replan After Stale</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="10"
                                                                    value={selected.config?.replanAfterStale ?? 3}
                                                                    onChange={(e) => updateConfig('replanAfterStale', parseInt(e.target.value) || 3)}
                                                                    className="input w-full px-4 py-3 text-sm"
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">Actions with no page state change before replanning.</p>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Memory Window Size</label>
                                                                <input
                                                                    type="number"
                                                                    min="2"
                                                                    max="30"
                                                                    value={selected.config?.rollingWindowSize || 8}
                                                                    onChange={(e) => updateConfig('rollingWindowSize', parseInt(e.target.value) || 8)}
                                                                    className="input w-full px-4 py-3 text-sm"
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">Recent messages kept in context (rolling window). Higher = more context but more tokens.</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Summary Interval</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="10"
                                                                    value={selected.config?.memorySummaryInterval || 3}
                                                                    onChange={(e) => updateConfig('memorySummaryInterval', parseInt(e.target.value) || 3)}
                                                                    className="input w-full px-4 py-3 text-sm"
                                                                />
                                                                <p className="text-[10px] text-muted mt-1">How often (in actions) to update the memory summary.</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-500">
                                                                <Shield className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label htmlFor="loopDetection" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Loop Detection</label>
                                                                <p className="text-[var(--text-secondary)] text-xs">Detect when the agent repeats the same actions and trigger automatic replanning.</p>
                                                            </div>
                                                            <input
                                                                id="loopDetection"
                                                                type="checkbox"
                                                                checked={selected.config?.loopDetection !== false}
                                                                onChange={(e) => updateConfig('loopDetection', e.target.checked)}
                                                                className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Visual Summary */}
                                                    <div className="p-4 rounded-xl bg-white/5 border border-transparent">
                                                        <h4 className="text-sm font-medium text-primary mb-3">Architecture Overview</h4>
                                                        <div className="flex items-center gap-3 text-xs">
                                                            <div className="flex-1 text-center p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                                                <div className="text-lg mb-1">🗺️</div>
                                                                <div className="font-semibold text-violet-400">Planner</div>
                                                                <div className="text-[10px] text-muted mt-1">
                                                                    {selected.config?.plannerEnabled !== false ? 'Active' : 'Disabled'}
                                                                </div>
                                                            </div>
                                                            <div className="text-muted">→</div>
                                                            <div className="flex-1 text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                                <div className="text-lg mb-1">⚡</div>
                                                                <div className="font-semibold text-amber-400">Executor</div>
                                                                <div className="text-[10px] text-muted mt-1">
                                                                    {selected.config?.actionBatchSize || 5} actions/batch
                                                                </div>
                                                            </div>
                                                            <div className="text-muted">→</div>
                                                            <div className="flex-1 text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                                <div className="text-lg mb-1">🔄</div>
                                                                <div className="font-semibold text-red-400">Coordinator</div>
                                                                <div className="text-[10px] text-muted mt-1">
                                                                    {selected.config?.loopDetection !== false ? 'Loop guard' : 'No guard'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* SECURITY SECTION */}
                                            {activeSection === 'security' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Security & Restrictions</h2>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
                                                            <Shield className="w-3.5 h-3.5 inline mr-1" />
                                                            Allowed Domains
                                                        </label>
                                                        <textarea
                                                            value={(selected.config?.allowedDomains || []).join('\n')}
                                                            onChange={(e) => {
                                                                const domains = e.target.value.split('\n').map(d => d.trim()).filter(Boolean);
                                                                updateConfig('allowedDomains', domains);
                                                            }}
                                                            className="input w-full px-4 py-3 text-sm font-mono"
                                                            rows={5}
                                                            placeholder="example.com&#10;google.com&#10;(one domain per line, leave empty for unrestricted)"
                                                        />
                                                        <p className="text-[10px] text-muted mt-1">Restrict which domains the agent can navigate to. Leave empty to allow all domains.</p>
                                                    </div>

                                                    {(selected.config?.allowedDomains || []).length > 0 && (
                                                        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                                            <h4 className="text-sm font-medium text-emerald-400 mb-2">Active Domain Restrictions</h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {selected.config.allowedDomains.map((domain, i) => (
                                                                    <span key={i} className="px-2.5 py-1 text-xs font-mono bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                                                                        {domain}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(selected.config?.allowedDomains || []).length === 0 && (
                                                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                                            <h4 className="text-sm font-medium text-amber-400 mb-1">⚠️ Unrestricted Access</h4>
                                                            <p className="text-xs text-amber-400/80">This agent can navigate to any domain. Consider adding domain restrictions for production use.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* SETTINGS SECTION */}
                                            {activeSection === 'settings' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Agent Settings</h2>

                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-colors">
                                                            <div>
                                                                <h4 className="text-sm font-medium text-primary">Enabled</h4>
                                                                <p className="text-xs text-muted mt-0.5">Allow this agent to be used in conversations</p>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selected.enabled}
                                                                    onChange={(e) => updateSelected('enabled', e.target.checked)}
                                                                    className="sr-only peer"
                                                                />
                                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 rounded-xl bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-colors">
                                                        <h4 className="text-sm font-medium text-primary mb-1">Summary</h4>
                                                        <div className="grid grid-cols-3 gap-4 mt-3">
                                                            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                                                <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>{selected.config?.maxActions || 20}</div>
                                                                <div className="text-[10px] uppercase tracking-wider text-muted mt-1">Max Actions</div>
                                                            </div>
                                                            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                                                <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>
                                                                    {selected.config?.headless !== false ? '🔒' : '👁️'}
                                                                </div>
                                                                <div className="text-[10px] uppercase tracking-wider text-muted mt-1">
                                                                    {selected.config?.headless !== false ? 'Headless' : 'Visible'}
                                                                </div>
                                                            </div>
                                                            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                                                <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>
                                                                    {(selected.config?.allowedDomains || []).length || '∞'}
                                                                </div>
                                                                <div className="text-[10px] uppercase tracking-wider text-muted mt-1">Domains</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {selected.id && (
                                                        <div className="p-4 rounded-xl bg-white/5">
                                                            <h4 className="text-sm font-medium text-primary mb-2">Agent Details</h4>
                                                            <div className="space-y-1.5 text-xs text-muted font-mono">
                                                                <div>ID: {selected.id}</div>
                                                                <div>Created: {selected.created_at || 'N/A'}</div>
                                                                <div>Updated: {selected.updated_at || 'N/A'}</div>
                                                            </div>
                                                            <VersionHistory agentId={selected.id} onRestore={() => window.location.reload()} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-6xl mb-4">🌐</div>
                                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Browser Agents</h2>
                                <p className="text-sm text-muted max-w-md mx-auto mb-6">
                                    Create AI agents that autonomously control a web browser using Playwright.
                                    They can navigate pages, fill forms, extract data, and more.
                                </p>
                                <button onClick={mgr.createAgent} className="btn-primary px-6 py-2.5">
                                    <Plus className="w-4 h-4 inline mr-2" />
                                    Create Browser Agent
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
