import React, { useState, useRef } from 'react';
import { Plus, Shield, Zap, X, Clock, Ban, Upload, File, Paperclip, Radar, Gauge } from 'lucide-react';
import ModelSelector from '../components/ModelSelector';
import VersionHistory from '../components/VersionHistory';
import { API_BASE, authFetch } from '../utils/helpers';
import useAgentManager from '../hooks/useAgentManager';
import AgentSidebar from '../components/shared/AgentSidebar';
import SectionNav from '../components/shared/SectionNav';
import EmojiPicker from '../components/shared/EmojiPicker';

const SECTIONS = [
    { id: 'identity', label: 'Identity', icon: '🆔' },
    { id: 'scan', label: 'Scan Config', icon: '🔍' },
    { id: 'files', label: 'Templates', icon: '📎' },
    { id: 'security', label: 'Security', icon: '🔒' },
];

const SECURITY_EMOJIS = [
    '🛡️', '🔐', '🔒', '🕵️', '🔍', '🧪', '⚡', '🎯', '🚨', '⚠️',
    '🛠️', '🔬', '🧰', '🌐', '📡', '🖥️', '💻', '🤖', '📊', '📋',
    '🔥', '💀', '☠️', '🐛', '🕷️', '🦠', '🔓', '🔑', '🗝️', '🏴‍☠️',
    '🏗️', '🧱', '🔭', '📈', '🛸', '👁️', '🎖️', '🏅', '💎', '⭐'
];

const DEFAULT_AGENT = {
    name: '',
    description: '',
    icon: '🛡️',
    model: null,
    system_prompt: '',
    enabled: true,
    config: {
        maxIterations: 30,
        timeout: 120000,
        defaultSeverity: 'low,medium,high,critical',
        defaultTemplates: '',
        rateLimitRps: 50,
        scanTimeout: 300000,
        blockedCommands: ['rm -rf /', 'shutdown', 'reboot', 'mkfs', 'dd if='],
        sandboxMode: true
    }
};

const SEVERITY_OPTIONS = [
    { value: 'info', label: 'Info', color: '#94a3b8' },
    { value: 'low', label: 'Low', color: '#3b82f6' },
    { value: 'medium', label: 'Medium', color: '#eab308' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'critical', label: 'Critical', color: '#ef4444' },
];

export default function SecurityAgentManager({ onBack }) {
    const mgr = useAgentManager('/security-agents', 'security', DEFAULT_AGENT);
    const { selected, activeSection, isCreating, saving, availableModels, updateSelected, updateConfig, saveAgent } = mgr;
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const selectAgent = (agent) => {
        mgr.selectAgent(agent);
        loadFiles(agent.id);
    };

    const loadFiles = async (agentId) => {
        if (!agentId) { setAttachedFiles([]); return; }
        try {
            const res = await authFetch(`${API_BASE}/security-agents/${agentId}/files`);
            const data = await res.json();
            setAttachedFiles(Array.isArray(data) ? data : []);
        } catch (err) { console.error('Load files error:', err); setAttachedFiles([]); }
    };

    const uploadFile = async (file) => {
        if (!selected?.id || isCreating) return;
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await authFetch(`${API_BASE}/security-agents/${selected.id}/files`, {
                method: 'POST', body: form
            });
            if (res.ok) { await loadFiles(selected.id); }
        } catch (err) { console.error('Upload error:', err); }
        setUploading(false);
    };

    const deleteFile = async (filename) => {
        if (!selected?.id) return;
        try {
            await authFetch(`${API_BASE}/security-agents/${selected.id}/files/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
            });
            setAttachedFiles(prev => prev.filter(f => f.name !== filename));
        } catch (err) { console.error('Delete file error:', err); }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer?.files;
        if (files?.length) uploadFile(files[0]);
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Parse current severity selections
    const currentSeverities = (selected?.config?.defaultSeverity || '').split(',').map(s => s.trim()).filter(Boolean);
    const toggleSeverity = (sev) => {
        const idx = currentSeverities.indexOf(sev);
        let newSevs;
        if (idx >= 0) {
            newSevs = currentSeverities.filter(s => s !== sev);
        } else {
            newSevs = [...currentSeverities, sev];
        }
        updateConfig('defaultSeverity', newSevs.join(','));
    };

    return (
        <div className="h-full flex flex-col p-6" style={{ background: 'var(--bg-primary)' }}>
            <div className="flex-1 flex overflow-hidden border rounded-xl shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>

                <AgentSidebar
                    title="Security Agents"
                    agents={mgr.agents}
                    selected={selected}
                    loading={mgr.loading}
                    isCreating={isCreating}
                    onSelect={selectAgent}
                    onCreate={mgr.createAgent}
                    onDelete={mgr.deleteAgent}
                    onDuplicate={mgr.duplicateAgent}
                    typeBadge={
                        <span className="text-[10px] uppercase tracking-wider font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Security
                        </span>
                    }
                    emptyIcon="🛡️"
                    emptyText="No security agents"
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
                                            {isCreating ? 'Create Security Agent' : 'Edit Security Agent'}
                                        </h1>
                                        <p className="text-sm text-muted">Automated security scanning with Nuclei vulnerability scanner.</p>
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
                                            className="btn-primary px-6 shadow-lg shadow-red-500/20"
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                </div>

                                {/* Config Area */}
                                <div className="flex-1 flex overflow-hidden">
                                    <SectionNav sections={SECTIONS} activeSection={activeSection} onChange={mgr.setActiveSection} />

                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                        <div className="max-w-3xl mx-auto">

                                            {/* IDENTITY SECTION */}
                                            {activeSection === 'identity' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Agent Identity</h2>

                                                    <EmojiPicker value={selected.icon} onChange={(v) => updateSelected('icon', v)} emojis={SECURITY_EMOJIS} placeholder="🛡️" />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Name</label>
                                                            <input
                                                                type="text"
                                                                value={selected.name}
                                                                onChange={(e) => updateSelected('name', e.target.value)}
                                                                className="input w-full px-4 py-3 text-base"
                                                                placeholder="e.g. Web App Scanner"
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
                                                            placeholder="Describe what this security agent scans for..."
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">System Prompt</label>
                                                        <textarea
                                                            value={selected.system_prompt || ''}
                                                            onChange={(e) => updateSelected('system_prompt', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm font-mono"
                                                            rows={6}
                                                            placeholder="Instructions for the security agent... (leave empty for default)"
                                                        />
                                                        <p className="text-[10px] text-muted mt-1">Custom instructions for the agent. Leave empty to use the default security scanner persona.</p>
                                                    </div>

                                                    {/* Sequential Thinking */}
                                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500">
                                                            🧠
                                                        </div>
                                                        <div className="flex-1">
                                                            <label htmlFor="sequentialThinking" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Sequential Thinking</label>
                                                            <p className="text-[var(--text-secondary)] text-xs">Structured chain-of-thought reasoning for planning complex scan strategies.</p>
                                                        </div>
                                                        <input
                                                            id="sequentialThinking"
                                                            type="checkbox"
                                                            checked={selected.config?.sequentialThinkingEnabled === true}
                                                            onChange={(e) => updateConfig('sequentialThinkingEnabled', e.target.checked)}
                                                            className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                        />
                                                    </div>

                                                    {selected.config?.sequentialThinkingEnabled && (
                                                        <div className="ml-2 p-4 rounded-xl bg-purple-500/5 border border-purple-500/15">
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2 block">
                                                                Thinking Model
                                                                <span className="ml-2 normal-case font-normal opacity-60 text-[10px]">Optional — uses a separate model for reasoning</span>
                                                            </label>
                                                            <ModelSelector
                                                                models={availableModels}
                                                                value={selected.config?.sequentialThinkingModel || ''}
                                                                onChange={(val) => updateConfig('sequentialThinkingModel', val || undefined)}
                                                                defaultLabel="Same as agent model"
                                                                compact
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* SCAN CONFIG SECTION */}
                                            {activeSection === 'scan' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Scan Configuration</h2>

                                                    {/* Severity Filter */}
                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 block">
                                                            <Radar className="w-3.5 h-3.5 inline mr-1" />
                                                            Default Severity Filter
                                                        </label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {SEVERITY_OPTIONS.map(sev => (
                                                                <button
                                                                    key={sev.value}
                                                                    onClick={() => toggleSeverity(sev.value)}
                                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${currentSeverities.includes(sev.value)
                                                                        ? 'opacity-100'
                                                                        : 'opacity-40 hover:opacity-70'
                                                                        }`}
                                                                    style={{
                                                                        background: currentSeverities.includes(sev.value) ? `${sev.color}20` : 'transparent',
                                                                        borderColor: currentSeverities.includes(sev.value) ? `${sev.color}40` : 'var(--border-default)',
                                                                        color: sev.color
                                                                    }}
                                                                >
                                                                    {sev.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <p className="text-[10px] text-muted mt-2">Select which severity levels to include by default. Can be overridden per scan.</p>
                                                    </div>

                                                    {/* Default Templates */}
                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Default Template Tags</label>
                                                        <input
                                                            type="text"
                                                            value={selected.config?.defaultTemplates || ''}
                                                            onChange={(e) => updateConfig('defaultTemplates', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm font-mono"
                                                            placeholder="e.g. cves,vulnerabilities,exposures (comma-separated)"
                                                        />
                                                        <p className="text-[10px] text-muted mt-1">Default Nuclei template tags to use. Leave empty for all templates.</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
                                                                <Gauge className="w-3.5 h-3.5 inline mr-1" />
                                                                Rate Limit (req/s)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="500"
                                                                value={selected.config?.rateLimitRps || 50}
                                                                onChange={(e) => updateConfig('rateLimitRps', parseInt(e.target.value) || 50)}
                                                                className="input w-full px-4 py-3 text-sm"
                                                            />
                                                            <p className="text-[10px] text-muted mt-1">Max requests per second.</p>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
                                                                <Clock className="w-3.5 h-3.5 inline mr-1" />
                                                                Scan Timeout (s)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="30"
                                                                max="3600"
                                                                value={Math.round((selected.config?.scanTimeout || 300000) / 1000)}
                                                                onChange={(e) => updateConfig('scanTimeout', (parseInt(e.target.value) || 300) * 1000)}
                                                                className="input w-full px-4 py-3 text-sm"
                                                            />
                                                            <p className="text-[10px] text-muted mt-1">Max time per scan.</p>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
                                                                <Zap className="w-3.5 h-3.5 inline mr-1" />
                                                                Max Iterations
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="100"
                                                                value={selected.config?.maxIterations || 30}
                                                                onChange={(e) => updateConfig('maxIterations', parseInt(e.target.value) || 30)}
                                                                className="input w-full px-4 py-3 text-sm"
                                                            />
                                                            <p className="text-[10px] text-muted mt-1">Max LLM cycles per task.</p>
                                                        </div>
                                                    </div>

                                                    {/* Tools Overview */}
                                                    <div className="p-4 rounded-xl bg-white/5 border border-transparent">
                                                        <h4 className="text-sm font-medium text-primary mb-3">Available Tools</h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                            {[
                                                                { name: 'nuclei_scan', icon: '🎯', desc: 'Run Nuclei scans' },
                                                                { name: 'run_command', icon: '⌨️', desc: 'Shell commands' },
                                                                { name: 'generate_report', icon: '📊', desc: 'Create reports' },
                                                                { name: 'write_file', icon: '📝', desc: 'Create/edit files' },
                                                                { name: 'read_file', icon: '📖', desc: 'Read files' },
                                                            ].map(tool => (
                                                                <div key={tool.name} className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                                    <span className="text-base">{tool.icon}</span>
                                                                    <div>
                                                                        <div className="text-xs font-mono font-medium text-[var(--text-primary)]">{tool.name}</div>
                                                                        <div className="text-[10px] text-muted">{tool.desc}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* TEMPLATES (FILES) SECTION */}
                                            {activeSection === 'files' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Custom Templates</h2>
                                                    <p className="text-sm text-muted -mt-3">
                                                        Upload custom Nuclei templates (.yaml) that will be copied into <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">/workspace/</code> when a scan starts.
                                                    </p>

                                                    {isCreating ? (
                                                        <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
                                                            <p className="text-sm text-amber-400">Save the agent first to upload templates.</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div
                                                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                                                onDragLeave={() => setDragOver(false)}
                                                                onDrop={handleDrop}
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver
                                                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                                                    : 'border-[var(--border-default)] hover:border-[var(--accent-primary)] hover:bg-white/5'
                                                                    }`}
                                                            >
                                                                <input
                                                                    ref={fileInputRef}
                                                                    type="file"
                                                                    className="hidden"
                                                                    onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ''; }}
                                                                />
                                                                {uploading ? (
                                                                    <>
                                                                        <div className="spinner-sm mx-auto mb-2"></div>
                                                                        <p className="text-sm text-muted">Uploading...</p>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Upload className="w-8 h-8 mx-auto mb-3 text-muted" />
                                                                        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Drop template here or click to browse</p>
                                                                        <p className="text-xs text-muted">YAML templates, scripts, or wordlists (max 10MB)</p>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {attachedFiles.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {attachedFiles.map(file => (
                                                                        <div key={file.name} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] group">
                                                                            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 text-red-400 flex-shrink-0">
                                                                                <File className="w-4 h-4" />
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{file.name}</p>
                                                                                <p className="text-xs text-muted">{formatSize(file.size)}</p>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => deleteFile(file.name)}
                                                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-all"
                                                                                title="Remove file"
                                                                            >
                                                                                <X className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="p-6 rounded-xl bg-white/5 border border-transparent text-center">
                                                                    <Paperclip className="w-8 h-8 mx-auto mb-2 text-muted opacity-50" />
                                                                    <p className="text-sm text-muted">No templates attached</p>
                                                                    <p className="text-xs text-muted opacity-70 mt-1">Upload custom Nuclei YAML templates or wordlists</p>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* SECURITY SECTION */}
                                            {activeSection === 'security' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Security & Restrictions</h2>

                                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500">
                                                            <Shield className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label htmlFor="sandboxMode" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Sandbox Mode</label>
                                                            <p className="text-[var(--text-secondary)] text-xs">Restrict file operations to the working directory inside the container.</p>
                                                        </div>
                                                        <input
                                                            id="sandboxMode"
                                                            type="checkbox"
                                                            checked={selected.config?.sandboxMode !== false}
                                                            onChange={(e) => updateConfig('sandboxMode', e.target.checked)}
                                                            className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
                                                            <Ban className="w-3.5 h-3.5 inline mr-1" />
                                                            Blocked Commands
                                                        </label>
                                                        <textarea
                                                            value={(selected.config?.blockedCommands || []).join('\n')}
                                                            onChange={(e) => {
                                                                const cmds = e.target.value.split('\n').map(c => c.trim()).filter(Boolean);
                                                                updateConfig('blockedCommands', cmds);
                                                            }}
                                                            className="input w-full px-4 py-3 text-sm font-mono"
                                                            rows={5}
                                                            placeholder={"rm -rf /\nshutdown\nreboot\n(one command per line)"}
                                                        />
                                                        <p className="text-[10px] text-muted mt-1">Commands containing these strings will be blocked. Core dangerous commands are always blocked regardless.</p>
                                                    </div>

                                                    {(selected.config?.blockedCommands || []).length > 0 && (
                                                        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                                                            <h4 className="text-sm font-medium text-red-400 mb-2">Active Blocklist</h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {selected.config.blockedCommands.map((cmd, i) => (
                                                                    <span key={i} className="px-2.5 py-1 text-xs font-mono bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
                                                                        {cmd}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Security Info */}
                                                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                                        <h4 className="text-sm font-medium text-amber-400 mb-2">⚠️ Security Notes</h4>
                                                        <ul className="text-xs text-muted space-y-1 list-disc pl-4">
                                                            <li>Each agent runs in an isolated Docker container with Nuclei pre-installed</li>
                                                            <li>Never scan targets without explicit authorization</li>
                                                            <li>Scans have configurable rate limits to avoid overwhelming targets</li>
                                                            <li>Core dangerous commands (fork bombs, disk formatting, etc.) are always blocked</li>
                                                            <li>Containers are auto-removed after 15 minutes of inactivity</li>
                                                        </ul>
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
                        <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
                            <div className="text-center">
                                <div className="text-6xl mb-4">🛡️</div>
                                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                                    Security Agents
                                </h2>
                                <p className="text-sm text-muted max-w-md mx-auto mb-6">
                                    Create AI agents that run automated security scans using Nuclei
                                    vulnerability scanner. Get comprehensive reports with severity
                                    breakdowns and remediation advice.
                                </p>
                                <button onClick={mgr.createAgent} className="btn-primary px-6 shadow-lg">
                                    <Plus className="w-4 h-4 mr-2 inline" />
                                    Create Security Agent
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
