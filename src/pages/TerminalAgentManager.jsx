import React, { useState, useRef } from 'react';
import { Plus, Terminal, Shield, Zap, X, FolderOpen, Clock, Ban, Upload, File, Paperclip } from 'lucide-react';
import ModelSelector from '../components/ModelSelector';
import VersionHistory from '../components/VersionHistory';
import { API_BASE, authFetch } from '../utils/helpers';
import useAgentManager from '../hooks/useAgentManager';
import AgentSidebar from '../components/shared/AgentSidebar';
import SectionNav from '../components/shared/SectionNav';
import EmojiPicker from '../components/shared/EmojiPicker';

const SECTIONS = [
    { id: 'identity', label: 'Identity', icon: '🆔' },
    { id: 'terminal', label: 'Terminal Config', icon: '💻' },
    { id: 'files', label: 'Files', icon: '📎' },
    { id: 'security', label: 'Security', icon: '🔒' },
];

const TERMINAL_EMOJIS = [
    '💻', '🖥️', '⌨️', '🐍', '🔧', '⚙️', '📟', '🛠️', '🧰', '🔨',
    '🚀', '⚡', '🎯', '📊', '📈', '🤖', '📝', '📋', '🗂️', '🔗',
    '🧪', '🔬', '🧠', '🎨', '📦', '🐳', '🐧', '🐙', '👨‍💻', '🥷',
    '💾', '📀', '🗄️', '🌐', '🔐', '🛡️', '🔥', '💡', '✨', '🌟'
];

const DEFAULT_AGENT = {
    name: '',
    description: '',
    icon: '💻',
    model: null,
    system_prompt: '',
    enabled: true,
    config: {
        maxIterations: 30,
        timeout: 60000,
        workingDirectory: '',
        sandboxMode: true,
        blockedCommands: ['rm -rf /', 'shutdown', 'reboot', 'mkfs', 'dd if='],
        pythonVersion: '3',
        autoInstallPackages: true
    }
};

export default function TerminalAgentManager({ onBack }) {
    const mgr = useAgentManager('/terminal-agents', 'terminal', DEFAULT_AGENT);
    const { selected, activeSection, isCreating, saving, availableModels, updateSelected, updateConfig, saveAgent } = mgr;
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);


    // Wrap selectAgent to also load files
    const selectAgent = (agent) => {
        mgr.selectAgent(agent);
        loadFiles(agent.id);
    };

    const loadFiles = async (agentId) => {
        if (!agentId) { setAttachedFiles([]); return; }
        try {
            const res = await authFetch(`${API_BASE}/terminal-agents/${agentId}/files`);
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
            const res = await authFetch(`${API_BASE}/terminal-agents/${selected.id}/files`, {
                method: 'POST', body: form
            });
            if (res.ok) { await loadFiles(selected.id); }
        } catch (err) { console.error('Upload error:', err); }
        setUploading(false);
    };

    const deleteFile = async (filename) => {
        if (!selected?.id) return;
        try {
            await authFetch(`${API_BASE}/terminal-agents/${selected.id}/files/${encodeURIComponent(filename)}`, {
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

    return (
        <div className="h-full flex flex-col p-6" style={{ background: 'var(--bg-primary)' }}>
            <div className="flex-1 flex overflow-hidden border rounded-xl shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>

                <AgentSidebar
                    title="Terminal Agents"
                    agents={mgr.agents}
                    selected={selected}
                    loading={mgr.loading}
                    isCreating={isCreating}
                    onSelect={selectAgent}
                    onCreate={mgr.createAgent}
                    onDelete={mgr.deleteAgent}
                    onDuplicate={mgr.duplicateAgent}
                    typeBadge={
                        <span className="text-[10px] uppercase tracking-wider font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <Terminal className="w-3 h-3" /> Terminal
                        </span>
                    }
                    emptyIcon="💻"
                    emptyText="No terminal agents"
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
                                            {isCreating ? 'Create Terminal Agent' : 'Edit Terminal Agent'}
                                        </h1>
                                        <p className="text-sm text-muted">Configure terminal automation with Python virtual environment.</p>
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
                                            className="btn-primary px-6 shadow-lg shadow-emerald-500/20"
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
                                                    <EmojiPicker value={selected.icon} onChange={(v) => updateSelected('icon', v)} emojis={TERMINAL_EMOJIS} placeholder="💻" />

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Name</label>
                                                            <input
                                                                type="text"
                                                                value={selected.name}
                                                                onChange={(e) => updateSelected('name', e.target.value)}
                                                                className="input w-full px-4 py-3 text-base"
                                                                placeholder="e.g. Data Pipeline Agent"
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
                                                            placeholder="Describe what this terminal agent does..."
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">System Prompt</label>
                                                        <textarea
                                                            value={selected.system_prompt || ''}
                                                            onChange={(e) => updateSelected('system_prompt', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm font-mono"
                                                            rows={6}
                                                            placeholder="Instructions for the terminal agent... (leave empty for default)"
                                                        />
                                                        <p className="text-[10px] text-muted mt-1">Custom instructions for the agent. Leave empty to use the default terminal agent persona.</p>
                                                    </div>



                                                </div>
                                            )}

                                            {/* TERMINAL CONFIG SECTION */}
                                            {activeSection === 'terminal' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Terminal Configuration</h2>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
                                                            <FolderOpen className="w-3.5 h-3.5 inline mr-1" />
                                                            Working Directory
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={selected.config?.workingDirectory || ''}
                                                            onChange={(e) => updateConfig('workingDirectory', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm font-mono"
                                                            placeholder="/path/to/project (leave empty for auto)"
                                                        />
                                                        <p className="text-[10px] text-muted mt-1">The directory where commands execute. Leave empty to use an auto-created workspace.</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                                                            <p className="text-[10px] text-muted mt-1">Maximum LLM → tool execution cycles per task.</p>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">
                                                                <Clock className="w-3.5 h-3.5 inline mr-1" />
                                                                Timeout (ms)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="5000"
                                                                max="300000"
                                                                step="1000"
                                                                value={selected.config?.timeout || 60000}
                                                                onChange={(e) => updateConfig('timeout', parseInt(e.target.value) || 60000)}
                                                                className="input w-full px-4 py-3 text-sm"
                                                            />
                                                            <p className="text-[10px] text-muted mt-1">Max time for each individual command execution.</p>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 block">Python Version</label>
                                                        <select
                                                            value={selected.config?.pythonVersion || '3'}
                                                            onChange={(e) => updateConfig('pythonVersion', e.target.value)}
                                                            className="input w-full px-4 py-3 text-sm"
                                                            style={{
                                                                backgroundColor: 'var(--bg-tertiary)',
                                                                color: 'var(--text-primary)',
                                                                borderColor: 'var(--border-default)'
                                                            }}
                                                        >
                                                            <option value="3">Python 3 (default)</option>
                                                            <option value="3.10">Python 3.10</option>
                                                            <option value="3.11">Python 3.11</option>
                                                            <option value="3.12">Python 3.12</option>
                                                        </select>
                                                    </div>

                                                    {/* Tools Overview */}
                                                    <div className="p-4 rounded-xl bg-white/5 border border-transparent">
                                                        <h4 className="text-sm font-medium text-primary mb-3">Available Tools</h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                            {[
                                                                { name: 'run_command', icon: '⌨️', desc: 'Shell commands' },
                                                                { name: 'python_exec', icon: '🐍', desc: 'Python code' },
                                                                { name: 'pip_install', icon: '📦', desc: 'Install packages' },
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

                                            {/* FILES SECTION */}
                                            {activeSection === 'files' && (
                                                <div className="space-y-6 animate-fadeIn">
                                                    <h2 className="text-lg font-semibold text-primary">Attached Files</h2>
                                                    <p className="text-sm text-muted -mt-3">
                                                        Files uploaded here are automatically copied into <code className="px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">/workspace/</code> when a conversation starts.
                                                    </p>

                                                    {isCreating ? (
                                                        <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
                                                            <p className="text-sm text-amber-400">Save the agent first to upload files.</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* Upload Zone */}
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
                                                                        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Drop file here or click to browse</p>
                                                                        <p className="text-xs text-muted">Max 10MB per file</p>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* File List */}
                                                            {attachedFiles.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {attachedFiles.map(file => (
                                                                        <div key={file.name} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] group">
                                                                            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0">
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
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="p-6 rounded-xl bg-white/5 border border-transparent text-center">
                                                                    <Paperclip className="w-8 h-8 mx-auto mb-2 text-muted opacity-50" />
                                                                    <p className="text-sm text-muted">No files attached</p>
                                                                    <p className="text-xs text-muted opacity-70 mt-1">Upload CSV, JSON, Python scripts, or any file the agent needs</p>
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

                                                    {/* Sandbox Mode Toggle */}
                                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500">
                                                            <Shield className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label htmlFor="sandboxMode" className="font-medium text-sm text-[var(--text-primary)] cursor-pointer select-none">Sandbox Mode</label>
                                                            <p className="text-[var(--text-secondary)] text-xs">Restrict file operations to the working directory. Prevents access outside the sandbox.</p>
                                                        </div>
                                                        <input
                                                            id="sandboxMode"
                                                            type="checkbox"
                                                            checked={selected.config?.sandboxMode !== false}
                                                            onChange={(e) => updateConfig('sandboxMode', e.target.checked)}
                                                            className="w-5 h-5 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
                                                        />
                                                    </div>

                                                    {/* Blocked Commands */}
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
                                                            <li>Each agent gets an isolated Python virtual environment</li>
                                                            <li>Packages installed in one agent don't affect others</li>
                                                            <li>Core dangerous commands (fork bombs, disk formatting, etc.) are always blocked</li>
                                                            <li>Commands have a configurable timeout to prevent runaway processes</li>
                                                            <li>Sandbox mode restricts file operations to the working directory</li>
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
                                <div className="text-6xl mb-4">💻</div>
                                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                                    Terminal Agents
                                </h2>
                                <p className="text-sm text-muted max-w-md mx-auto mb-6">
                                    Create AI agents that can execute shell commands and Python code
                                    in isolated virtual environments. Perfect for data processing,
                                    automation, and development tasks.
                                </p>
                                <button onClick={mgr.createAgent} className="btn-primary px-6 shadow-lg">
                                    <Plus className="w-4 h-4 mr-2 inline" />
                                    Create Terminal Agent
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
