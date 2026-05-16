import { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import { formatRelativeTime } from '../utils/dateFormatters';
import { Clock, RotateCcw, ChevronDown, ChevronRight, Trash2, Eye } from 'lucide-react';

/**
 * Version History panel — reusable across all agent editors.
 * Shows a timeline of previous versions with restore capability.
 *
 * @param {string} agentId - The agent ID
 * @param {function} onRestore - Called after a successful restore; parent should reload agent data
 */
export default function VersionHistory({ agentId, onRestore }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [previewVersion, setPreviewVersion] = useState(null);
    const [restoring, setRestoring] = useState(null);

    const loadVersions = useCallback(async () => {
        if (!agentId) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/versions/${agentId}`);
            const data = await res.json();
            setVersions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('[VersionHistory] Load error:', err);
        }
        setLoading(false);
    }, [agentId]);

    useEffect(() => {
        if (expanded) loadVersions();
    }, [expanded, agentId, loadVersions]);

    const handleRestore = async (versionId, versionNumber) => {
        if (!confirm(`Restore to version ${versionNumber}? Your current configuration will be saved as a new version.`)) return;
        setRestoring(versionId);
        try {
            await authFetch(`${API_BASE}/versions/${agentId}/${versionId}/restore`, { method: 'POST' });
            await loadVersions();
            if (onRestore) onRestore();
        } catch (err) {
            console.error('[VersionHistory] Restore error:', err);
            alert('Failed to restore version');
        }
        setRestoring(null);
    };

    const handlePreview = async (versionId) => {
        if (previewVersion?.id === versionId) {
            setPreviewVersion(null);
            return;
        }
        try {
            const res = await authFetch(`${API_BASE}/versions/${agentId}/${versionId}`);
            const data = await res.json();
            setPreviewVersion(data);
        } catch (err) {
            console.error('[VersionHistory] Preview error:', err);
        }
    };

    const handleDelete = async (versionId, e) => {
        e.stopPropagation();
        if (!confirm('Delete this version?')) return;
        try {
            await authFetch(`${API_BASE}/versions/${agentId}/${versionId}`, { method: 'DELETE' });
            setVersions(prev => prev.filter(v => v.id !== versionId));
            if (previewVersion?.id === versionId) setPreviewVersion(null);
        } catch (err) {
            console.error('[VersionHistory] Delete error:', err);
        }
    };

    // The DB stores timestamps without a TZ suffix; assume UTC by appending 'Z'.
    const formatDate = (dateStr) => formatRelativeTime(dateStr ? `${dateStr}Z` : dateStr);

    const renderSnapshotPreview = (snapshot, versionId) => {
        if (!snapshot) return null;
        const s = snapshot.snapshot || snapshot;

        // Basic text fields
        const textFields = [];
        if (s.name) textFields.push({ label: 'Name', value: s.name });
        if (s.description) textFields.push({ label: 'Description', value: s.description });
        if (s.model) textFields.push({ label: 'Model', value: s.model });
        if (s.icon) textFields.push({ label: 'Icon', value: s.icon });
        if (s.type) textFields.push({ label: 'Type', value: s.type });

        // Boolean/toggle fields
        const boolFields = [];
        if (s.enabled !== undefined) boolFields.push({ label: 'Enabled', value: s.enabled });
        if (s.workspace_enabled !== undefined) boolFields.push({ label: 'Workspace', value: !!s.workspace_enabled });
        if (s.embed_enabled !== undefined) boolFields.push({ label: 'Embed', value: !!s.embed_enabled });
        if (s.copy_enabled !== undefined) boolFields.push({ label: 'Copy', value: !!s.copy_enabled });
        if (s.threads_enabled !== undefined) boolFields.push({ label: 'Threads', value: !!s.threads_enabled });
        if (s.sandbox_mode !== undefined) boolFields.push({ label: 'Sandbox', value: !!s.sandbox_mode });

        // System prompt
        const sysPrompt = s.system_prompt || s.systemPrompt;

        // Tools
        const tools = s.tools || [];

        // Starter prompts
        const starters = typeof s.starter_prompts === 'string'
            ? (() => { try { return JSON.parse(s.starter_prompts); } catch { return []; } })()
            : (s.starter_prompts || []);

        // Config object
        const config = typeof s.config === 'string'
            ? (() => { try { return JSON.parse(s.config); } catch { return {}; } })()
            : (s.config || {});

        // Phases (legacy, kept for historical snapshot rendering)
        const phases = typeof s.phases === 'string'
            ? (() => { try { return JSON.parse(s.phases); } catch { return []; } })()
            : (s.phases || []);


        const configKeys = Object.keys(config);

        return (
            <div className="mt-2 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 max-h-[500px] overflow-y-auto">
                {/* Basic fields */}
                {textFields.map(f => (
                    <div key={f.label}>
                        <span className="text-[var(--text-tertiary)] font-medium">{f.label}:</span>
                        <span className="ml-2 text-[var(--text-secondary)]">{f.value}</span>
                    </div>
                ))}

                {/* Boolean toggles */}
                {boolFields.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {boolFields.map(f => (
                            <span key={f.label} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${f.value ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-[var(--text-tertiary)]'}`}>
                                {f.label}: {f.value ? 'On' : 'Off'}
                            </span>
                        ))}
                    </div>
                )}



                {/* System Prompt */}
                {sysPrompt && (
                    <div>
                        <span className="text-[var(--text-tertiary)] font-medium block mb-1">System Prompt:</span>
                        <pre className="text-[10px] text-[var(--text-secondary)] bg-black/20 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono leading-relaxed">
                            {sysPrompt.length > 500 ? sysPrompt.substring(0, 500) + '...' : sysPrompt}
                        </pre>
                    </div>
                )}

                {/* Tools */}
                {tools.length > 0 && (
                    <div>
                        <span className="text-[var(--text-tertiary)] font-medium">Tools ({tools.length}):</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {tools.map(t => (
                                <span key={t} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 text-[10px]">{t}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Starter Prompts */}
                {starters.length > 0 && (
                    <div>
                        <span className="text-[var(--text-tertiary)] font-medium">Starter Prompts ({starters.length}):</span>
                        <div className="mt-1 space-y-0.5">
                            {starters.map((p, i) => (
                                <div key={i} className="text-[10px] text-[var(--text-secondary)] pl-2 border-l border-[var(--border-subtle)]">{p}</div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Config */}
                {configKeys.length > 0 && (
                    <div>
                        <span className="text-[var(--text-tertiary)] font-medium">Config:</span>
                        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                            {configKeys.map(k => (
                                <div key={k} className="text-[10px]">
                                    <span className="text-[var(--text-tertiary)]">{k}:</span>
                                    <span className="ml-1 text-[var(--text-secondary)]">{typeof config[k] === 'object' ? JSON.stringify(config[k]) : String(config[k])}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Phases (legacy snapshots) */}
                {phases.length > 0 && (
                    <div>
                        <span className="text-[var(--text-tertiary)] font-medium">Phases ({phases.length}):</span>
                        <div className="mt-1 space-y-2">
                            {phases.map((phase, pi) => (
                                <div key={phase.id || pi} className="rounded-lg bg-black/15 p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        {phase.icon && <span>{phase.icon}</span>}
                                        <span className="font-medium text-[var(--text-primary)]">{phase.name || `Phase ${pi + 1}`}</span>
                                        {phase.parallel && <span className="px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px]">parallel</span>}
                                    </div>
                                    {phase.description && (
                                        <div className="text-[10px] text-[var(--text-tertiary)] mb-1">{phase.description}</div>
                                    )}
                                    {phase.agents && phase.agents.length > 0 && (
                                        <div className="space-y-2 mt-1">
                                            {phase.agents.map((agent, ai) => (
                                                <div key={ai} className="pl-2 border-l-2 space-y-1" style={{ borderColor: phase.color || 'var(--border-subtle)' }}>
                                                    <div className="flex items-center gap-2 text-[10px]">
                                                        <span className="text-[var(--text-primary)] font-medium">{agent.name || agent.role}</span>
                                                        {agent.role && agent.name && <span className="text-[var(--text-tertiary)]">({agent.role})</span>}
                                                        {agent.model && <span className="text-purple-400 text-[9px]">{agent.model}</span>}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 text-[9px]">
                                                        {agent.temperature !== undefined && (
                                                            <span className="px-1 py-0.5 rounded bg-white/5 text-[var(--text-tertiary)]">temp: {agent.temperature}</span>
                                                        )}
                                                        {agent.maxTokens !== undefined && (
                                                            <span className="px-1 py-0.5 rounded bg-white/5 text-[var(--text-tertiary)]">tokens: {agent.maxTokens}</span>
                                                        )}
                                                        {agent.hiveMindAccess && (
                                                            <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">hive: {agent.hiveMindAccess}</span>
                                                        )}

                                                    </div>
                                                    {agent.tools && agent.tools.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 text-[9px]">
                                                            {agent.tools.map(t => (
                                                                <span key={t} className="px-1 py-0.5 rounded bg-blue-500/10 text-blue-300">🔧 {t}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {(agent.system_prompt || agent.systemPrompt) && (() => {
                                                        const prompt = agent.system_prompt || agent.systemPrompt;
                                                        return (
                                                            <pre className="text-[9px] text-[var(--text-tertiary)] bg-black/20 rounded p-1.5 whitespace-pre-wrap max-h-20 overflow-y-auto font-mono leading-relaxed">{prompt.length > 300 ? prompt.substring(0, 300) + '...' : prompt}</pre>
                                                        );
                                                    })()}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (!agentId) return null;

    return (
        <div className="mt-4">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors w-full"
            >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Clock className="w-4 h-4" />
                <span>Version History</span>
                {versions.length > 0 && (
                    <span className="ml-auto text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full text-[var(--text-tertiary)]">
                        {versions.length}
                    </span>
                )}
            </button>

            {expanded && (
                <div className="mt-3 space-y-1 max-h-[400px] overflow-y-auto">
                    {loading && (
                        <div className="text-xs text-[var(--text-tertiary)] py-4 text-center">Loading versions...</div>
                    )}
                    {!loading && versions.length === 0 && (
                        <div className="text-xs text-[var(--text-tertiary)] py-4 text-center">
                            No versions yet. Versions are created automatically when you save changes.
                        </div>
                    )}
                    {versions.map((v) => (
                        <div key={v.id} className="group">
                            <div
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                                onClick={() => handlePreview(v.id)}
                            >
                                {/* Version bullet */}
                                <div className="w-2 h-2 rounded-full bg-blue-400/60 flex-shrink-0" />

                                {/* Version info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-[var(--text-primary)]">v{v.version_number}</span>
                                        <span className="text-[10px] text-[var(--text-tertiary)]">{formatDate(v.created_at)}</span>
                                    </div>
                                    {v.change_summary && (
                                        <div className="text-[10px] text-[var(--text-tertiary)] truncate">{v.change_summary}</div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePreview(v.id); }}
                                        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-blue-400"
                                        title="Preview"
                                    >
                                        <Eye className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRestore(v.id, v.version_number); }}
                                        disabled={restoring === v.id}
                                        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-green-400 disabled:opacity-50"
                                        title="Restore this version"
                                    >
                                        <RotateCcw className={`w-3 h-3 ${restoring === v.id ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(v.id, e)}
                                        className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-red-400"
                                        title="Delete version"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            {previewVersion?.id === v.id && renderSnapshotPreview(previewVersion, v.id)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
