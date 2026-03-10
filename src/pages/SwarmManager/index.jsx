import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Edit3, Bot, Globe, Terminal, Copy, Download, Upload, X, Zap } from 'lucide-react';
import SwarmAgentFullEditor from './SwarmAgentFullEditor';
import VersionHistory from '../../components/VersionHistory';
import { filterVisibleModels } from '../../utils/modelMeta.js';
import { API_BASE, authFetch } from '../../utils/helpers';
import SectionNav from '../../components/shared/SectionNav';
import EmojiPicker from '../../components/shared/EmojiPicker';

export default function SwarmManager({ onBack }) {
    const [swarms, setSwarms] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [expandedPhase, setExpandedPhase] = useState(null);
    const [availableModels, setAvailableModels] = useState([]);
    const [components, setComponents] = useState([]); // For tool selector
    const [browserAgents, setBrowserAgents] = useState([]); // Available browser agents
    const [terminalAgents, setTerminalAgents] = useState([]); // Available terminal agents
    const [activeSection, setActiveSection] = useState('identity');
    const [isCreating, setIsCreating] = useState(false);

    // Editing state for agents
    const [editingAgent, setEditingAgent] = useState(null); // { phaseIdx, agentIdx }
    const fileInputRef = React.useRef(null);

    // Load swarms + models + components
    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE}/swarms`).then(r => r.json()),
            authFetch(`${API_BASE}/agents/meta/models`).then(r => r.json()).catch(() => ({ models: [] })),
            authFetch(`${API_BASE}/agents/meta/components`).then(r => r.json()).catch(() => []),
            authFetch(`${API_BASE}/browser-agents`).then(r => r.json()).catch(() => []),
            authFetch(`${API_BASE}/terminal-agents`).then(r => r.json()).catch(() => [])
        ]).then(([data, modelData, componentData, browserAgentData, terminalAgentData]) => {
            setSwarms(data);
            if (modelData.models) {
                setAvailableModels(filterVisibleModels(modelData.models));
            }
            if (Array.isArray(componentData)) {
                setComponents(componentData);
            }
            if (Array.isArray(browserAgentData)) {
                setBrowserAgents(browserAgentData);
            }
            if (Array.isArray(terminalAgentData)) {
                setTerminalAgents(terminalAgentData);
            }
            setLoading(false);
        }).catch(err => { console.error(err); setLoading(false); });
    }, []);

    const selectSwarm = (swarm) => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        setSelected(JSON.parse(JSON.stringify(swarm)));
        setDirty(false);
        setExpandedPhase(null);
        setIsCreating(false);
        setActiveSection('identity');
        setEditingAgent(null);
    };

    const updateSelected = (field, value) => {
        setSelected(prev => ({ ...prev, [field]: value }));
        setDirty(true);
    };

    const saveSwarm = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const isNew = isCreating || !swarms.find(s => s.id === selected.id);
            const url = isNew ? `${API_BASE}/swarms` : `${API_BASE}/swarms/${selected.id}`;
            const method = isNew ? 'POST' : 'PUT';
            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selected)
            });
            const saved = await res.json();
            setSwarms(prev => {
                const idx = prev.findIndex(s => s.id === saved.id);
                if (idx >= 0) return prev.map(s => s.id === saved.id ? saved : s);
                return [...prev, saved];
            });
            setSelected(JSON.parse(JSON.stringify(saved)));
            setDirty(false);
            setIsCreating(false);
        } catch (err) { console.error('Save error:', err); }
        setSaving(false);
    };

    const deleteSwarm = async (id) => {
        if (!confirm('Delete this swarm configuration?')) return;
        try {
            await authFetch(`${API_BASE}/swarms/${id}`, { method: 'DELETE' });
            setSwarms(prev => prev.filter(s => s.id !== id));
            if (selected?.id === id) { setSelected(null); setIsCreating(false); }
        } catch (err) { console.error('Delete error:', err); }
    };

    const duplicateSwarm = (swarm) => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        const clone = JSON.parse(JSON.stringify(swarm));
        delete clone.id;
        delete clone.is_builtin;
        clone.name = `${clone.name} (Copy)`;
        setSelected(clone);
        setIsCreating(true);
        setDirty(true);
        setExpandedPhase(null);
        setActiveSection('identity');
        setEditingAgent(null);
    };

    // ─── Export / Import ─────────────────────────────────────────
    const exportSwarm = (swarm) => {
        const exportData = JSON.parse(JSON.stringify(swarm));
        // Strip internal / server-only fields
        delete exportData.id;
        delete exportData.is_builtin;
        delete exportData.organization_id;
        exportData._exportVersion = 1;
        exportData._exportedAt = new Date().toISOString();

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(swarm.name || 'swarm').replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importSwarm = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Reset input so the same file can be re-imported
        e.target.value = '';

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Basic validation
            if (!data.name || !Array.isArray(data.phases)) {
                alert('Invalid swarm file — must contain "name" and "phases".');
                return;
            }

            // Strip any leftover internal fields
            delete data.id;
            delete data.is_builtin;
            delete data._exportVersion;
            delete data._exportedAt;

            // Create via API
            const res = await authFetch(`${API_BASE}/swarms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Server error');
            const created = await res.json();

            setSwarms(prev => [...prev, created]);
            setSelected(JSON.parse(JSON.stringify(created)));
            setIsCreating(false);
            setDirty(false);
            setExpandedPhase(null);
            setActiveSection('identity');
            setEditingAgent(null);
        } catch (err) {
            console.error('Import error:', err);
            alert('Failed to import swarm. Make sure the file is valid JSON.');
        }
    };

    const createSwarm = () => {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        setIsCreating(true);
        setSelected({
            name: '',
            description: '',
            icon: '🤖',
            type: 'custom',
            enabled: true,
            phases: [
                { id: 'phase_1', name: 'Phase 1', description: 'First phase', color: '#3b82f6', icon: '🔄', agents: [] }
            ],
            model: null,
            system_prompt: `You are the {swarm_name} Orchestrator. Coordinate your team of specialized AI workers to fulfill the user's request.

## Your Team
{workers}

## Workflow
Phases: {phase_list}

## 🐝 Hive Mind
Your swarm operates like a honeybee colony. Each worker is a scout bee that explores independently.
When a worker completes their task, their findings are contributed to the Hive Mind — a shared knowledge pool.
Later workers automatically receive all prior findings, so they can build upon existing knowledge instead of repeating work.

## Instructions
1. Analyze the user's request and break it into exploration tasks.
2. Send out scout workers to explore different angles in parallel when possible.
3. Each worker will automatically receive the Hive Mind's accumulated knowledge.
4. Give workers concise task instructions — do NOT paste large blocks of data.
5. If findings contradict each other, send additional workers to investigate.
6. **Your LAST tool call must ALWAYS be to "{last_worker}".** This worker will produce the final user-facing response.
7. **You must NEVER write a final answer yourself.** After calling "{last_worker}", simply stop.

You are the queen bee — coordinate the swarm but let the workers do the heavy lifting.
The final answer is ALWAYS produced by {last_worker}, never by you directly.`,
            config: {}
        });
        setDirty(true);
        setExpandedPhase(null);
        setActiveSection('identity');
        setEditingAgent(null);
    };

    // Phase Helpers
    const addPhase = () => {
        const phases = selected.phases || [];
        const num = phases.length + 1;
        updateSelected('phases', [...phases, {
            id: `phase_${Date.now()}`,
            name: `Phase ${num}`,
            description: '',
            color: ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4', '#ec4899'][num % 6],
            icon: '🔄',
            agents: []
        }]);
    };

    const removePhase = (idx) => {
        updateSelected('phases', selected.phases.filter((_, i) => i !== idx));
        if (expandedPhase === idx) setExpandedPhase(null);
    };

    const updatePhase = (idx, field, value) => {
        const phases = [...selected.phases];
        phases[idx] = { ...phases[idx], [field]: value };
        updateSelected('phases', phases);
    };

    const movePhase = (idx, dir) => {
        const phases = [...selected.phases];
        const target = idx + dir;
        if (target < 0 || target >= phases.length) return;
        [phases[idx], phases[target]] = [phases[target], phases[idx]];
        updateSelected('phases', phases);
        setExpandedPhase(target);
    };

    // Agent helpers within a phase
    const addAgent = (phaseIdx, type = 'llm') => {
        const phases = [...selected.phases];
        let newAgent;
        if (type === 'browser') {
            newAgent = {
                role: 'browser_worker',
                name: 'Browser Agent',
                type: 'browser',
                browserAgentId: null,
                avatar: '🌐'
            };
        } else if (type === 'terminal') {
            newAgent = {
                role: 'terminal_worker',
                name: 'Terminal Agent',
                type: 'terminal',
                terminalAgentId: null,
                avatar: '💻'
            };
        } else {
            newAgent = {
                role: 'worker',
                name: 'New Agent',
                type: 'llm',
                systemPrompt: '',
                model: null,
                temperature: 0.3,
                maxTokens: 2000,
                tools: []
            };
        }
        phases[phaseIdx].agents = [...(phases[phaseIdx].agents || []), newAgent];
        updateSelected('phases', phases);
        // Automatically open editor for new agent
        setEditingAgent({ phaseIdx, agentIdx: phases[phaseIdx].agents.length - 1 });
    };

    const removeAgent = (phaseIdx, agentIdx) => {
        const phases = [...selected.phases];
        phases[phaseIdx].agents = phases[phaseIdx].agents.filter((_, i) => i !== agentIdx);
        updateSelected('phases', phases);
        if (editingAgent?.phaseIdx === phaseIdx && editingAgent?.agentIdx === agentIdx) {
            setEditingAgent(null);
        }
    };

    const updateAgent = (phaseIdx, agentIdx, field, value) => {
        const phases = [...selected.phases];
        const agents = [...phases[phaseIdx].agents];
        agents[agentIdx] = { ...agents[agentIdx], [field]: value };
        phases[phaseIdx].agents = agents;
        updateSelected('phases', phases);
    };

    const handleAgentEditorChange = (field, value) => {
        if (!editingAgent) return;
        updateAgent(editingAgent.phaseIdx, editingAgent.agentIdx, field, value);
    };

    const getCurrentAgentData = () => {
        if (!editingAgent || !selected) return null;
        const { phaseIdx, agentIdx } = editingAgent;
        return selected.phases[phaseIdx]?.agents[agentIdx];
    };

    return (
        <div className="h-full flex flex-col p-6" style={{ background: 'var(--bg-primary)' }}>
            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden border rounded-xl shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>

                {/* 1. Swarm List Sidebar */}
                <div className="w-64 border-r flex flex-col flex-shrink-0" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>My Swarms</span>
                        <div className="flex items-center gap-1">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={importSwarm}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                title="Import Swarm from JSON"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                <Upload className="w-4 h-4" />
                            </button>
                            <button
                                onClick={createSwarm}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                title="Create New Swarm"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center text-muted text-sm">
                                <div className="spinner-sm mx-auto mb-2"></div>
                                Loading...
                            </div>
                        ) : swarms.length === 0 ? (
                            <div className="p-8 text-center text-muted text-sm flex flex-col items-center">
                                <span className="text-2xl mb-2">⚡</span>
                                <p className="mb-3">No swarms found</p>
                                <button onClick={createSwarm} className="btn-primary text-xs py-1.5">
                                    Create First Swarm
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                                {swarms.map((swarm, si) => (
                                    <div
                                        key={`${swarm.id}-${si}`}
                                        onClick={() => selectSwarm(swarm)}
                                        className={`group p-4 cursor-pointer transition-all hover:bg-white/5 relative border-l-2 ${selected?.id === swarm.id && !isCreating ? 'bg-white/5 border-[var(--accent-primary)]' : 'border-transparent'}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`font-medium text-sm truncate ${selected?.id === swarm.id && !isCreating ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                                                {swarm.name}
                                            </span>
                                            {!swarm.is_builtin && (
                                                <div className="flex items-center gap-0.5">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); exportSwarm(swarm); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-green-400 transition-all"
                                                        title="Export swarm as JSON"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); duplicateSwarm(swarm); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-400 transition-all"
                                                        title="Duplicate swarm"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteSwarm(swarm.id); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                                        title="Delete swarm"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted truncate leading-relaxed">
                                            {typeof swarm.description === 'string' ? swarm.description : 'No description'}
                                        </div>
                                        <div className="flex items-center gap-3 mt-3">
                                            <span className="text-[10px] uppercase tracking-wider font-medium text-muted bg-white/5 px-2 py-0.5 rounded">
                                                {swarm.phases?.length || 0} PHASES
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider font-medium text-muted bg-white/5 px-2 py-0.5 rounded">
                                                {swarm.phases?.reduce((sum, p) => sum + (p.agents?.length || 0), 0) || 0} AGENTS
                                            </span>
                                            {swarm.is_builtin && (
                                                <span className="text-[10px] uppercase tracking-wider font-medium text-purple-400 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                                    Built-in
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Main Workspace */}
                <div className="flex-1 flex overflow-hidden relative">
                    {(selected) ? (
                        <div className="flex-1 flex w-full">
                            {/* Configuration Area */}
                            <div className="flex-1 flex flex-col min-w-[600px]" style={{ borderColor: 'var(--border-default)' }}>
                                {/* Header */}
                                <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-primary)' }}>
                                    <div>
                                        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                                            {isCreating ? 'Create New Swarm' : 'Edit Swarm'}
                                        </h1>
                                        <p className="text-sm text-muted">Configure swarm pipeline, phases, and agents.</p>
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
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        Enabled
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        Disabled
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={saveSwarm}
                                            disabled={saving || !selected.name?.trim()}
                                            className="btn-primary px-6 shadow-lg shadow-purple-500/20"
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>

                                {/* Config Content (Sidebar + Main) */}
                                <div className="flex-1 flex overflow-hidden">
                                    {/* Navigation Sidebar */}
                                    <SectionNav
                                        sections={[
                                            { id: 'identity', label: 'Identity', icon: '🆔' },
                                            { id: 'pipeline', label: 'Pipeline', icon: '🔗' },
                                            { id: 'settings', label: 'Settings', icon: '⚙️' },
                                        ]}
                                        activeSection={activeSection}
                                        onChange={setActiveSection}
                                    />

                                    {/* Section Content */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                        <div className="max-w-3xl mx-auto">

                                            {/* IDENTITY SECTION */}
                                            {activeSection === 'identity' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Swarm Identity</h2>

                                                    {/* Avatar Picker */}
                                                    <EmojiPicker
                                                        value={selected.icon}
                                                        onChange={(v) => updateSelected('icon', v)}
                                                        emojis={['⚡', '🧠', '🔬', '🔧', '🚀', '🎯', '💻', '🌐', '🤖', '🐝',
                                                            '🔄', '📊', '🎨', '📝', '🔍', '🎓', '🏆', '🌟', '🔮', '🎪',
                                                            '🦊', '🐱', '🐶', '🦁', '🐼', '🐨', '🦉', '🦋', '🐙', '🧬',
                                                            '👨‍💻', '👩‍🔬', '🧙‍♂️', '🦸‍♀️', '👾', '🤓', '😎', '🥷', '🧑‍🚀', '🤝'
                                                        ]}
                                                        placeholder="🤖"
                                                    />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Name</label>
                                                            <input
                                                                type="text"
                                                                value={selected.name}
                                                                onChange={(e) => updateSelected('name', e.target.value)}
                                                                className="input w-full px-4 py-3 text-base"
                                                                placeholder="e.g. Deep Research Swarm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Type</label>
                                                            <input
                                                                type="text"
                                                                value={selected.type || ''}
                                                                onChange={(e) => updateSelected('type', e.target.value)}
                                                                className="input w-full px-4 py-3 text-base"
                                                                placeholder="e.g. deep_research"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Role Description</label>
                                                        <textarea
                                                            value={selected.description || ''}
                                                            onChange={(e) => updateSelected('description', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm"
                                                            rows={3}
                                                            placeholder="Describe what this swarm does..."
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Orchestrator System Prompt</label>
                                                        <textarea
                                                            value={selected.system_prompt || ''}
                                                            onChange={(e) => updateSelected('system_prompt', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm font-mono"
                                                            rows={6}
                                                            placeholder="Custom instructions for the orchestrator agent..."
                                                        />
                                                        <p className="text-[10px] text-muted mt-1">Custom instructions prepended to the auto-generated orchestrator prompt. Leave empty to use defaults.</p>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 block">Orchestrator Model</label>
                                                        <div className="grid grid-cols-5 gap-3">
                                                            {[
                                                                { key: 'auto', icon: '🔀', label: 'Auto', desc: 'Smart selection', gradient: 'from-purple-500/20 to-indigo-500/20', border: 'border-purple-500/50', glow: 'shadow-purple-500/20' },
                                                                { key: 'fast', icon: '⚡', label: 'Fast', desc: 'Quick answers', gradient: 'from-emerald-500/20 to-green-500/20', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/20' },
                                                                { key: 'thinking', icon: '🧠', label: 'Thinking', desc: 'Complex problems', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/50', glow: 'shadow-blue-500/20' },
                                                                { key: 'writer', icon: '✍️', label: 'Writer', desc: 'Long-form content', gradient: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/50', glow: 'shadow-pink-500/20' },
                                                                { key: 'pro', icon: '✨', label: 'Pro', desc: 'Max quality', gradient: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/50', glow: 'shadow-amber-500/20' },
                                                            ].map(tier => {
                                                                const currentTier = selected.model ? selected.model.replace('tier:', '') : 'auto';
                                                                const isSelected = currentTier === tier.key;
                                                                return (
                                                                    <button
                                                                        key={tier.key}
                                                                        type="button"
                                                                        onClick={() => updateSelected('model', `tier:${tier.key}`)}
                                                                        className={`relative p-4 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer group ${isSelected
                                                                            ? `bg-gradient-to-b ${tier.gradient} ${tier.border} shadow-lg ${tier.glow}`
                                                                            : 'border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:bg-white/[0.03]'
                                                                            }`}
                                                                    >
                                                                        <span className={`text-2xl block mb-1.5 transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>{tier.icon}</span>
                                                                        <span className={`text-sm font-semibold block ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>{tier.label}</span>
                                                                        <span className={`text-[10px] block mt-0.5 ${isSelected ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{tier.desc}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <p className="text-[10px] text-muted mt-2">Foundational model used for routing and orchestration.</p>
                                                    </div>

                                                    {/* Swarm Mode Toggle */}
                                                    <div className="flex items-center gap-3 mt-4 bg-[var(--bg-tertiary)] p-3 rounded-lg border border-[var(--border-subtle)]">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500">
                                                            <Bot className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label htmlFor="swarm-mode" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Enable Swarm Mode UI</label>
                                                            <p className="text-[var(--text-secondary)] text-xs">Visualize phases and worker activities in the chat.</p>
                                                        </div>
                                                        <div className="flex items-center h-5">
                                                            <input
                                                                id="swarm-mode"
                                                                type="checkbox"
                                                                checked={selected.config?.enable_swarm_mode || false}
                                                                onChange={(e) => {
                                                                    const newConfig = { ...(selected.config || {}), enable_swarm_mode: e.target.checked };
                                                                    updateSelected('config', newConfig);
                                                                }}
                                                                className="w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PIPELINE SECTION — Unified phases + agents */}
                                            {activeSection === 'pipeline' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <div className="flex items-center justify-between">
                                                        <h2 className="text-lg font-semibold text-primary">Pipeline Phases</h2>
                                                        <button
                                                            onClick={addPhase}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
                                                            style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
                                                        >
                                                            <Plus className="w-3 h-3" /> Add Phase
                                                        </button>
                                                    </div>

                                                    {/* Phase Cards — unified config + agents */}
                                                    {selected.phases?.map((phase, idx) => {
                                                        const isExpanded = expandedPhase === idx;
                                                        return (
                                                            <div
                                                                key={phase.id}
                                                                className={`rounded-xl border overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-lg' : 'shadow-sm hover:shadow-md'}`}
                                                                style={{ borderColor: isExpanded ? phase.color : 'var(--border-subtle)', borderLeftWidth: '4px', borderLeftColor: phase.color, background: 'var(--bg-secondary)', opacity: phase.enabled === false ? 0.5 : 1 }}
                                                            >
                                                                {/* Phase Header — collapsed: full info, expanded: minimal */}
                                                                <button
                                                                    onClick={() => setExpandedPhase(isExpanded ? null : idx)}
                                                                    className={`w-full flex items-center gap-3 px-5 text-left hover:bg-white/[0.02] transition-colors ${isExpanded ? 'py-2.5' : 'py-4'}`}
                                                                >
                                                                    {!isExpanded && (
                                                                        <>
                                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: `${phase.color}20`, color: phase.color }}>
                                                                                {phase.icon || '🔄'}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{phase.name}</span>
                                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5" style={{ color: 'var(--text-tertiary)' }}>
                                                                                        {phase.agents?.length || 0} agent{(phase.agents?.length || 0) !== 1 ? 's' : ''}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                                    {phase.parallel && (
                                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">⚡ Parallel</span>
                                                                                    )}
                                                                                    {phase.runOnce && (
                                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">🔂 Run Once</span>
                                                                                    )}
                                                                                    {phase.enabled === false && (
                                                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">⏸ Disabled</span>
                                                                                    )}
                                                                                    {phase.description && typeof phase.description === 'string' && (
                                                                                        <span className="text-[10px] truncate max-w-[300px]" style={{ color: 'var(--text-tertiary)' }}>
                                                                                            {phase.description.slice(0, 60)}{phase.description.length > 60 ? '…' : ''}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    {isExpanded && <div className="flex-1" />}
                                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                                        <button onClick={(e) => { e.stopPropagation(); movePhase(idx, -1); }} disabled={idx === 0}
                                                                            className="p-1 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-20 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                                                                            <ChevronUp className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button onClick={(e) => { e.stopPropagation(); movePhase(idx, 1); }} disabled={idx === selected.phases.length - 1}
                                                                            className="p-1 rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-20 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                                                                            <ChevronDown className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button onClick={(e) => { e.stopPropagation(); removePhase(idx); }}
                                                                            className="p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors" style={{ color: 'var(--text-tertiary)' }}>
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown className="w-4 h-4 ml-1" style={{ color: 'var(--text-tertiary)' }} />}
                                                                    </div>
                                                                </button>

                                                                {/* Expanded: config + agents */}
                                                                {isExpanded && (
                                                                    <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                        {/* Phase Config */}
                                                                        <div className="flex items-center gap-3">
                                                                            <input
                                                                                value={phase.icon || '🔄'}
                                                                                onChange={e => updatePhase(idx, 'icon', e.target.value)}
                                                                                className="w-10 text-center text-lg bg-transparent border rounded-lg p-1"
                                                                                style={{ borderColor: 'var(--border-subtle)' }}
                                                                                maxLength={4}
                                                                            />
                                                                            <input
                                                                                value={phase.name}
                                                                                onChange={e => updatePhase(idx, 'name', e.target.value)}
                                                                                className="flex-1 min-w-0 text-sm font-semibold bg-transparent border rounded-lg px-3 py-2 outline-none focus:border-[var(--accent-primary)]"
                                                                                style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                                                                            />
                                                                            <input
                                                                                type="color"
                                                                                value={phase.color || '#3b82f6'}
                                                                                onChange={e => updatePhase(idx, 'color', e.target.value)}
                                                                                className="w-6 h-6 rounded cursor-pointer border-none"
                                                                                title="Phase color"
                                                                            />
                                                                        </div>

                                                                        <textarea
                                                                            value={phase.description || ''}
                                                                            onChange={e => updatePhase(idx, 'description', e.target.value)}
                                                                            className="w-full text-xs bg-transparent border rounded-lg p-2 resize-none outline-none focus:border-[var(--accent-primary)]"
                                                                            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                                                            placeholder="Phase description / instructions for the orchestrator..."
                                                                            rows={2}
                                                                        />

                                                                        {/* Toggle Pills */}
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => updatePhase(idx, 'parallel', !phase.parallel)}
                                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${phase.parallel
                                                                                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                                                                                    : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-blue-500/30 hover:text-blue-400'
                                                                                    }`}
                                                                            >
                                                                                ⚡ Parallel
                                                                            </button>
                                                                            <button
                                                                                onClick={() => updatePhase(idx, 'runOnce', !phase.runOnce)}
                                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${phase.runOnce
                                                                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                                                                                    : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-amber-500/30 hover:text-amber-400'
                                                                                    }`}
                                                                            >
                                                                                🔂 Run Once
                                                                            </button>
                                                                            <button
                                                                                onClick={() => updatePhase(idx, 'enabled', phase.enabled === false ? true : false)}
                                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${phase.enabled === false
                                                                                    ? 'bg-red-500/15 border-red-500/40 text-red-400'
                                                                                    : 'bg-transparent border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-red-500/30 hover:text-red-400'
                                                                                    }`}
                                                                            >
                                                                                {phase.enabled === false ? '⏸ Disabled' : '✅ Enabled'}
                                                                            </button>
                                                                        </div>

                                                                        {/* Divider */}
                                                                        <div className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                            <div className="flex items-center justify-between mb-3">
                                                                                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Agents</span>
                                                                                <div className="flex items-center gap-2">
                                                                                    <button
                                                                                        onClick={() => addAgent(idx, 'llm')}
                                                                                        className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                                                                        style={{ color: 'var(--accent-primary)' }}
                                                                                    >
                                                                                        <Plus className="w-3 h-3" /> Agent
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => addAgent(idx, 'browser')}
                                                                                        className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                                                                        style={{ color: 'var(--accent-secondary, #22c55e)' }}
                                                                                    >
                                                                                        <Globe className="w-3 h-3" /> Browser Agent
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => addAgent(idx, 'terminal')}
                                                                                        className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                                                                        style={{ color: '#f59e0b' }}
                                                                                    >
                                                                                        <Terminal className="w-3 h-3" /> Terminal Agent
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                            {/* Agent Cards */}
                                                                            <div className="space-y-2">
                                                                                {phase.agents?.map((agent, aIdx) => (
                                                                                    <div
                                                                                        key={aIdx}
                                                                                        className="flex items-center gap-3 p-3 rounded-lg border group hover:border-[var(--accent-primary)]/40 hover:translate-y-[-1px] hover:shadow-md transition-all"
                                                                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', opacity: agent.enabled === false ? 0.45 : 1 }}
                                                                                    >
                                                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${agent.type === 'browser' ? 'bg-green-500/10' : agent.type === 'terminal' ? 'bg-amber-500/10' : 'bg-[var(--bg-tertiary)]'}`}>
                                                                                            {agent.type === 'browser' ? '🌐' : agent.type === 'terminal' ? '💻' : (agent.avatar || '🤖')}
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <div className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                                                                                                {agent.name}
                                                                                                {agent.type === 'browser' && (
                                                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">BROWSER</span>
                                                                                                )}
                                                                                                {agent.type === 'terminal' && (
                                                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">TERMINAL</span>
                                                                                                )}
                                                                                                {agent.enabled === false && (
                                                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">DISABLED</span>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                                {agent.type === 'browser' ? (
                                                                                                    <span className="text-[11px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 truncate">
                                                                                                        {browserAgents.find(b => b.id === agent.browserAgentId)?.name || 'No browser agent linked'}
                                                                                                    </span>
                                                                                                ) : agent.type === 'terminal' ? (
                                                                                                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 truncate">
                                                                                                        {terminalAgents.find(t => t.id === agent.terminalAgentId)?.name || 'No terminal agent linked'}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <>
                                                                                                        <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                                                                                            {agent.model || 'Default Model'}
                                                                                                        </span>
                                                                                                        <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                                                                                            {(agent.tools || []).length} tools
                                                                                                        </span>
                                                                                                    </>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                                            <button
                                                                                                onClick={(e) => { e.stopPropagation(); updateAgent(idx, aIdx, 'enabled', agent.enabled === false ? true : false); }}
                                                                                                className={`p-1.5 rounded-lg transition-colors ${agent.enabled === false ? 'bg-red-500/10 text-red-400' : 'hover:bg-green-500/10 text-[var(--text-tertiary)] hover:text-green-400'}`}
                                                                                                title={agent.enabled === false ? 'Enable worker' : 'Disable worker'}
                                                                                            >
                                                                                                {agent.enabled === false ? '⏸' : '▶'}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => setEditingAgent({ phaseIdx: idx, agentIdx: aIdx })}
                                                                                                className="p-1.5 rounded-lg hover:bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] transition-colors"
                                                                                            >
                                                                                                <Edit3 className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => removeAgent(idx, aIdx)}
                                                                                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                                                                                            >
                                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}

                                                                                {(!phase.agents || phase.agents.length === 0) && (
                                                                                    <div className="text-center py-5 text-xs border border-dashed rounded-lg" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                                                                                        No agents yet — add one above
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {(!selected.phases || selected.phases.length === 0) && (
                                                        <div className="text-center py-12 border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                                                            <div className="text-4xl mb-3">🔗</div>
                                                            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No phases configured</div>
                                                            <div className="text-xs mb-4">Create phases to define your swarm's execution pipeline.</div>
                                                            <button
                                                                onClick={addPhase}
                                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
                                                            >
                                                                <Plus className="w-3 h-3" /> Add First Phase
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}



                                            {/* SETTINGS SECTION */}
                                            {activeSection === 'settings' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold mb-4 text-primary">Swarm Settings</h2>

                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-colors">
                                                            <div>
                                                                <h4 className="text-sm font-medium text-primary">Enabled</h4>
                                                                <p className="text-xs text-muted mt-0.5">Allow this swarm to be used in conversations</p>
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

                                                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-colors">
                                                            <div>
                                                                <h4 className="text-sm font-medium text-primary">Built-in</h4>
                                                                <p className="text-xs text-muted mt-0.5">Whether this is a system-provided swarm configuration</p>
                                                            </div>
                                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${selected.is_builtin ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-muted'}`}>
                                                                {selected.is_builtin ? 'Yes' : 'No'}
                                                            </span>
                                                        </div>

                                                        <div className="p-4 rounded-xl bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-colors">
                                                            <h4 className="text-sm font-medium text-primary mb-1">Summary</h4>
                                                            <div className="grid grid-cols-3 gap-4 mt-3">
                                                                <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                                                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>{selected.phases?.length || 0}</div>
                                                                    <div className="text-[10px] uppercase tracking-wider text-muted mt-1">Phases</div>
                                                                </div>
                                                                <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                                                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>{selected.phases?.reduce((sum, p) => sum + (p.agents?.length || 0), 0) || 0}</div>
                                                                    <div className="text-[10px] uppercase tracking-wider text-muted mt-1">Total Agents</div>
                                                                </div>
                                                                <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                                                                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>{selected.type || 'custom'}</div>
                                                                    <div className="text-[10px] uppercase tracking-wider text-muted mt-1">Type</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Pipeline Configuration */}
                                                    <div className="p-4 rounded-xl bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-colors">
                                                        <h4 className="text-sm font-medium text-primary mb-3">Pipeline Configuration</h4>

                                                        {selected.type === 'deep_research' ? (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 block">Max Sub-Questions</label>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        max="10"
                                                                        value={selected.config?.maxSubQuestions || 5}
                                                                        onChange={(e) => updateSelected('config', { ...selected.config, maxSubQuestions: parseInt(e.target.value) || 5 })}
                                                                        className="input w-full px-4 py-2 text-sm"
                                                                        placeholder="5"
                                                                    />
                                                                    <p className="text-[10px] text-muted mt-1">Number of parallel research topics to generate.</p>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 block">Max Search Iterations</label>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        max="10"
                                                                        value={selected.config?.maxSearchIterations || 5}
                                                                        onChange={(e) => updateSelected('config', { ...selected.config, maxSearchIterations: parseInt(e.target.value) || 5 })}
                                                                        className="input w-full px-4 py-2 text-sm"
                                                                        placeholder="5"
                                                                    />
                                                                    <p className="text-[10px] text-muted mt-1">Max sequential searches per sub-question (re-tries).</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 block">Custom Config (JSON)</label>
                                                                <textarea
                                                                    value={JSON.stringify(selected.config || {}, null, 2)}
                                                                    onChange={(e) => {
                                                                        try {
                                                                            const parsed = JSON.parse(e.target.value);
                                                                            updateSelected('config', parsed);
                                                                        } catch (err) {
                                                                            // allow invalid json while typing, but maybe warn?
                                                                        }
                                                                    }}
                                                                    className="input w-full px-4 py-2 text-xs font-mono"
                                                                    rows={5}
                                                                    placeholder="{}"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Shared Terminal Workspace */}
                                                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-colors">
                                                        <div>
                                                            <h4 className="text-sm font-medium text-primary flex items-center gap-2">
                                                                <Terminal className="w-4 h-4" style={{ color: '#f59e0b' }} />
                                                                Shared Terminal Workspace
                                                            </h4>
                                                            <p className="text-xs text-muted mt-0.5">When enabled, all terminal agent workers in this swarm share a single workspace directory — they can read and write each other's files.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={selected.config?.sharedTerminalWorkspace || false}
                                                                onChange={(e) => updateSelected('config', { ...selected.config, sharedTerminalWorkspace: e.target.checked })}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                                        </label>
                                                    </div>

                                                    {/* Sequential Thinking */}
                                                    <div className="p-4 rounded-xl bg-white/5 border border-transparent hover:border-[var(--border-subtle)] transition-colors space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h4 className="text-sm font-medium text-primary flex items-center gap-2">
                                                                    💭 Orchestrator Thinking
                                                                </h4>
                                                                <p className="text-xs text-muted mt-0.5">Run a separate thinking model before the orchestrator responds, to plan worker coordination.</p>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selected.config?.sequentialThinkingEnabled || false}
                                                                    onChange={(e) => updateSelected('config', { ...selected.config, sequentialThinkingEnabled: e.target.checked })}
                                                                    className="sr-only peer"
                                                                />
                                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                                                            </label>
                                                        </div>
                                                        {selected.config?.sequentialThinkingEnabled && (
                                                            <div>
                                                                <label className="block text-xs text-muted mb-1">Thinking Model</label>
                                                                <select
                                                                    value={selected.config?.sequentialThinkingModel || ''}
                                                                    onChange={(e) => updateSelected('config', { ...selected.config, sequentialThinkingModel: e.target.value || undefined })}
                                                                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm"
                                                                    style={{ color: 'var(--text-primary)' }}
                                                                >
                                                                    <option value="">Same as orchestrator model</option>
                                                                    {availableModels.map(m => (
                                                                        <option key={m.id} value={m.id}>{m.displayName || m.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Version History */}
                                                    {selected.id && !isCreating && (
                                                        <VersionHistory agentId={selected.id} onRestore={() => window.location.reload()} />
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center p-8">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-5 shadow-lg">
                                <Zap className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Swarm Agents</h2>
                            <p className="text-sm text-center max-w-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                                Select a swarm from the list to view and edit its pipeline, or create a new one.
                            </p>
                            <button
                                onClick={createSwarm}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-xl text-sm font-medium shadow-md transition-all hover:scale-105"
                            >
                                <Plus className="w-4 h-4" /> Create New Swarm
                            </button>
                        </div>
                    )}
                </div>

                {/* VS Code-style Agent Editor Modal Overlay */}
                {editingAgent && selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div
                            className="w-[90vw] h-[90vh] max-w-6xl bg-[var(--bg-primary)] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border-default)]"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${getCurrentAgentData()?.type === 'browser' ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' : getCurrentAgentData()?.type === 'terminal' ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 'bg-gradient-to-br from-purple-500 to-blue-600 text-white'}`}>
                                        {getCurrentAgentData()?.type === 'browser' ? '🌐' : getCurrentAgentData()?.type === 'terminal' ? '💻' : (getCurrentAgentData()?.avatar || '🤖')}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                                            {getCurrentAgentData()?.type === 'browser' ? 'Edit Browser Agent' : getCurrentAgentData()?.type === 'terminal' ? 'Edit Terminal Agent' : 'Edit Agent'}
                                        </h3>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            {selected.phases[editingAgent.phaseIdx].name} • {getCurrentAgentData()?.name}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingAgent(null)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden">
                                {getCurrentAgentData()?.type === 'browser' || getCurrentAgentData()?.type === 'terminal' ? (
                                    /* ─── Browser Agent Editor ─── */
                                    <div className="h-full overflow-y-auto p-6 space-y-6">
                                        {/* Agent Name & Role */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 block">Agent Name</label>
                                                <input
                                                    value={getCurrentAgentData()?.name || ''}
                                                    onChange={e => handleAgentEditorChange('name', e.target.value)}
                                                    className="input w-full px-4 py-2.5 text-sm"
                                                    placeholder="e.g. Web Researcher"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 block">Role Key</label>
                                                <input
                                                    value={getCurrentAgentData()?.role || ''}
                                                    onChange={e => handleAgentEditorChange('role', e.target.value)}
                                                    className="input w-full px-4 py-2.5 text-sm font-mono"
                                                    placeholder="e.g. web_researcher"
                                                />
                                                <p className="text-[10px] text-muted mt-1">Unique identifier used by the orchestrator</p>
                                            </div>
                                        </div>

                                        {/* Browser Agent Selector */}
                                        {getCurrentAgentData()?.type === 'browser' && (
                                            <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-green-500/10">
                                                        🌐
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Browser Agent</h3>
                                                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Select which browser agent this worker should use</p>
                                                    </div>
                                                </div>

                                                <select
                                                    value={getCurrentAgentData()?.browserAgentId || ''}
                                                    onChange={e => handleAgentEditorChange('browserAgentId', e.target.value || null)}
                                                    className="input w-full px-4 py-2.5 text-sm"
                                                >
                                                    <option value="">— Select a browser agent —</option>
                                                    {browserAgents.map(ba => (
                                                        <option key={ba.id} value={ba.id}>
                                                            {ba.icon || '🌐'} {ba.name}{ba.description ? ` — ${ba.description}` : ''}
                                                        </option>
                                                    ))}
                                                </select>

                                                {/* Show linked agent details */}
                                                {getCurrentAgentData()?.browserAgentId && (() => {
                                                    const linked = browserAgents.find(b => b.id === getCurrentAgentData().browserAgentId);
                                                    if (!linked) return null;
                                                    return (
                                                        <div className="mt-4 p-4 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="text-lg">{linked.icon || '🌐'}</span>
                                                                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{linked.name}</span>
                                                                {linked.model && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">{linked.model}</span>
                                                                )}
                                                            </div>
                                                            {linked.description && (
                                                                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{linked.description}</p>
                                                            )}
                                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                                <div className="p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                                                    <div className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{linked.config?.maxActions || 20}</div>
                                                                    <div className="text-[10px] text-muted">Max Actions</div>
                                                                </div>
                                                                <div className="p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                                                    <div className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{linked.config?.headless !== false ? 'Yes' : 'No'}</div>
                                                                    <div className="text-[10px] text-muted">Headless</div>
                                                                </div>
                                                                <div className="p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                                                    <div className="text-sm font-bold truncate" style={{ color: 'var(--accent-primary)' }}>{linked.config?.startingUrl || '—'}</div>
                                                                    <div className="text-[10px] text-muted">Starting URL</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {browserAgents.length === 0 && (
                                                    <div className="mt-4 p-4 rounded-lg border border-dashed text-center" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                                                        <p className="text-sm mb-2">No browser agents found</p>
                                                        <p className="text-xs">Create one in the Browser Agents section first.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Terminal Agent Selector */}
                                        {getCurrentAgentData()?.type === 'terminal' && (
                                            <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-amber-500/10">
                                                        💻
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Terminal Agent</h3>
                                                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Select which terminal agent this worker should use</p>
                                                    </div>
                                                </div>

                                                <select
                                                    value={getCurrentAgentData()?.terminalAgentId || ''}
                                                    onChange={e => handleAgentEditorChange('terminalAgentId', e.target.value || null)}
                                                    className="input w-full px-4 py-2.5 text-sm"
                                                >
                                                    <option value="">— Select a terminal agent —</option>
                                                    {terminalAgents.map(ta => (
                                                        <option key={ta.id} value={ta.id}>
                                                            {ta.icon || '💻'} {ta.name}{ta.description ? ` — ${ta.description}` : ''}
                                                        </option>
                                                    ))}
                                                </select>

                                                {/* Show linked terminal agent details */}
                                                {getCurrentAgentData()?.terminalAgentId && (() => {
                                                    const linked = terminalAgents.find(t => t.id === getCurrentAgentData().terminalAgentId);
                                                    if (!linked) return null;
                                                    return (
                                                        <div className="mt-4 p-4 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="text-lg">{linked.icon || '💻'}</span>
                                                                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{linked.name}</span>
                                                                {linked.model && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">{linked.model}</span>
                                                                )}
                                                            </div>
                                                            {linked.description && (
                                                                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{linked.description}</p>
                                                            )}
                                                            <div className="grid grid-cols-3 gap-3 text-center">
                                                                <div className="p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                                                    <div className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{linked.config?.maxIterations || 30}</div>
                                                                    <div className="text-[10px] text-muted">Max Iterations</div>
                                                                </div>
                                                                <div className="p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                                                    <div className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{linked.config?.sandboxMode !== false ? 'Yes' : 'No'}</div>
                                                                    <div className="text-[10px] text-muted">Sandboxed</div>
                                                                </div>
                                                                <div className="p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                                                    <div className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{Math.round((linked.config?.timeout || 60000) / 1000)}s</div>
                                                                    <div className="text-[10px] text-muted">Timeout</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {terminalAgents.length === 0 && (
                                                    <div className="mt-4 p-4 rounded-lg border border-dashed text-center" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                                                        <p className="text-sm mb-2">No terminal agents found</p>
                                                        <p className="text-xs">Create one in the Terminal Agents section first.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Hive Mind Access */}
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 block">Hive Mind Access</label>
                                            <select
                                                value={getCurrentAgentData()?.hiveMindAccess || 'readwrite'}
                                                onChange={e => handleAgentEditorChange('hiveMindAccess', e.target.value)}
                                                className="input w-full px-4 py-2.5 text-sm"
                                            >
                                                <option value="readwrite">Read & Write</option>
                                                <option value="read">Read Only</option>
                                                <option value="write">Write Only</option>
                                                <option value="none">No Access</option>
                                            </select>
                                            <p className="text-[10px] text-muted mt-1">Controls whether this browser agent can read from or write to the shared Hive Mind.</p>
                                        </div>
                                    </div>
                                ) : (
                                    /* ─── LLM Agent Editor (Full Designer Style) ─── */
                                    <SwarmAgentFullEditor
                                        data={getCurrentAgentData()}
                                        onChange={handleAgentEditorChange}
                                        components={components}
                                        availableModels={availableModels}
                                    />
                                )}
                            </div>

                            <div className="px-6 py-4 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] flex justify-end gap-3">
                                <button
                                    onClick={() => setEditingAgent(null)}
                                    className="px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:bg-[var(--accent-primary)]/90 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
