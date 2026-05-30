import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, RefreshCw, Upload, Settings, Check, AlertTriangle, Loader2, Unlink, ExternalLink, Clock, Bot, Sparkles, ChevronRight, FolderGit2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const GitHubSyncPanel = ({ user }) => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [configuring, setConfiguring] = useState(false);
    const [message, setMessage] = useState(null);
    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    // Config form
    const [repoOwner, setRepoOwner] = useState('');
    const [repoName, setRepoName] = useState('');
    const [branch, setBranch] = useState('main');
    const [autoSync, setAutoSync] = useState(false);
    const [showConfig, setShowConfig] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github-sync/status`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                if (data.config) {
                    setRepoOwner(data.config.repoOwner || '');
                    setRepoName(data.config.repoName || '');
                    setBranch(data.config.branch || 'main');
                    setAutoSync(data.config.autoSync || false);
                }
            }
        } catch (err) {
            console.error('[GitHubSync] Status fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleConfigure = async () => {
        if (!repoOwner.trim() || !repoName.trim()) {
            setMessage({ type: 'error', text: 'Repository owner and name are required' });
            return;
        }
        setConfiguring(true);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github-sync/configure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoOwner: repoOwner.trim(), repoName: repoName.trim(), branch: branch.trim() || 'main', autoSync }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'GitHub sync configured successfully!' });
                setShowConfig(false);
                await fetchStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Configuration failed' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to configure sync' });
        } finally {
            setConfiguring(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Disconnect GitHub sync? This will stop syncing agent configurations.')) return;
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github-sync/configure`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'GitHub sync disconnected' });
                setStatus(prev => ({ ...prev, configured: false, config: null, overview: null }));
                // Clear the config form so re-configuring starts from a clean slate.
                setRepoOwner('');
                setRepoName('');
                setBranch('main');
                setAutoSync(false);
                setShowConfig(false);
                setShowDetails(false);
                setDetails(null);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to disconnect' });
        }
    };

    const handlePushAll = async () => {
        setSyncing(true);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github-sync/push`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const r = data.results;
                setMessage({
                    type: 'success',
                    text: `Sync complete! ${r.agents.pushed} agents, ${r.skills.pushed} skills pushed.${r.agents.skipped + r.skills.skipped > 0 ? ` (${r.agents.skipped + r.skills.skipped} unchanged)` : ''}`
                });
                await fetchStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Sync failed' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Sync failed: ' + err.message });
        } finally {
            setSyncing(false);
        }
    };

    const handlePushPending = async () => {
        setSyncing(true);
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github-sync/push-pending`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const r = data.results;
                setMessage({ type: 'success', text: `Pushed ${r.pushed} pending changes.${r.errors > 0 ? ` (${r.errors} errors)` : ''}` });
                await fetchStatus();
            } else {
                setMessage({ type: 'error', text: data.error || 'Push failed' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Push failed: ' + err.message });
        } finally {
            setSyncing(false);
        }
    };

    const fetchDetails = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/github-sync/details`);
            if (res.ok) {
                const data = await res.json();
                setDetails(data);
                setShowDetails(true);
            }
        } catch (err) {
            console.error('[GitHubSync] Details fetch error:', err);
        }
    };

    const inputClass = "w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors";

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
                <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
                <div className="h-32 bg-[var(--bg-tertiary)] rounded-2xl" />
                <div className="h-24 bg-[var(--bg-tertiary)] rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <FolderGit2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    GitHub Sync
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    Version-control your AI agent configurations by syncing them to a GitHub repository.
                </p>
            </div>

            {/* Message Banner */}
            {message && (
                <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${message.type === 'success'
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                    {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* GitHub Connection Required */}
            {!status?.githubConnected && (
                <div className="p-5 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] text-center">
                    <GitBranch className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
                    <p className="text-sm font-medium text-[var(--text-primary)]">GitHub Not Connected</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        Connect your GitHub account in Settings → Integrations first, then return here to configure sync.
                    </p>
                </div>
            )}

            {/* Not Configured */}
            {status?.githubConnected && !status?.configured && !showConfig && (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                    <div className="p-6 text-center">
                        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: 'var(--brand-gradient-soft)' }}>
                            <FolderGit2 className="w-7 h-7" style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Set Up Agent Sync</h3>
                        <p className="text-sm text-[var(--text-muted)] mb-5 max-w-md mx-auto">
                            Choose a GitHub repository to store your agent configurations. Every change will be tracked as a commit with full diff history.
                        </p>
                        <button
                            onClick={() => setShowConfig(true)}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                            style={{ background: 'var(--brand-gradient)' }}
                        >
                            Configure Repository
                        </button>
                    </div>
                </div>
            )}

            {/* Configuration Form */}
            {status?.githubConnected && (showConfig || (!status?.configured && showConfig)) && (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                        Repository Configuration
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">Repository Owner</label>
                            <input
                                type="text"
                                value={repoOwner}
                                onChange={e => setRepoOwner(e.target.value)}
                                placeholder="your-username"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">Repository Name</label>
                            <input
                                type="text"
                                value={repoName}
                                onChange={e => setRepoName(e.target.value)}
                                placeholder="beeflow-agents"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">Branch</label>
                        <input
                            type="text"
                            value={branch}
                            onChange={e => setBranch(e.target.value)}
                            placeholder="main"
                            className={inputClass}
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)]">
                        <button
                            onClick={() => setAutoSync(!autoSync)}
                            className={`w-10 h-5.5 rounded-full transition-all flex-shrink-0 relative ${autoSync ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'}`}
                        >
                            <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-all ${autoSync ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                        <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">Auto-sync</p>
                            <p className="text-[11px] text-[var(--text-muted)]">Automatically push changes when agents are modified</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleConfigure}
                            disabled={configuring}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'var(--brand-gradient)' }}
                        >
                            {configuring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {status?.configured ? 'Update Configuration' : 'Connect Repository'}
                        </button>
                        {(status?.configured || showConfig) && (
                            <button
                                onClick={() => setShowConfig(false)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Sync Dashboard (when configured) */}
            {status?.configured && !showConfig && (
                <>
                    {/* Connected Repo Card */}
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                        <div className="p-5 flex items-center justify-between" style={{ background: 'var(--brand-gradient-soft)' }}>
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-gradient)' }}>
                                    <GitBranch className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                                            {status.config.repoOwner}/{status.config.repoName}
                                        </h3>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-500/15 text-green-500">Connected</span>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5">
                                        <GitBranch className="w-3 h-3" />
                                        {status.config.branch}
                                        {status.config.autoSync && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium ml-1">auto-sync</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={`https://github.com/${status.config.repoOwner}/${status.config.repoName}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                    title="Open in GitHub"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <button
                                    onClick={() => setShowConfig(true)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                    title="Edit configuration"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                                    title="Disconnect"
                                >
                                    <Unlink className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Sync Overview Stats */}
                        {status.overview && (
                            <div className="grid grid-cols-4 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
                                {[
                                    { label: 'Synced', value: status.overview.synced, color: '#10b981' },
                                    { label: 'Pending', value: status.overview.pending, color: '#f59e0b' },
                                    { label: 'Errors', value: status.overview.error, color: '#ef4444' },
                                    { label: 'Total', value: status.overview.total, color: 'var(--text-secondary)' },
                                ].map(s => (
                                    <div key={s.label} className="p-3.5 text-center">
                                        <div className="text-lg font-bold text-[var(--text-primary)]">{s.value}</div>
                                        <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: s.color }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handlePushAll}
                            disabled={syncing}
                            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: 'var(--brand-gradient)' }}
                        >
                            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Push All to GitHub
                        </button>
                        {status.overview?.pending > 0 && (
                            <button
                                onClick={handlePushPending}
                                disabled={syncing}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-all hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            >
                                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Push {status.overview.pending} Pending
                            </button>
                        )}
                    </div>

                    {/* Last Sync Info */}
                    {status.config?.lastFullSync && (
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <Clock className="w-3.5 h-3.5" />
                            Last full sync: {new Date(status.config.lastFullSync).toLocaleString()}
                        </div>
                    )}

                    {/* Details toggle */}
                    <button
                        onClick={() => showDetails ? setShowDetails(false) : fetchDetails()}
                        className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                    >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
                        {showDetails ? 'Hide' : 'Show'} sync details
                    </button>

                    {/* Detailed Sync States */}
                    {showDetails && details && (
                        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
                            <div className="max-h-72 overflow-y-auto">
                                {details.length === 0 ? (
                                    <p className="p-4 text-sm text-[var(--text-muted)] text-center">No sync data yet. Push to GitHub to get started.</p>
                                ) : details.map(item => (
                                    <div key={item.id} className="px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                {item.resource_type === 'agent'
                                                    ? <Bot className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                                    : <Sparkles className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                                                }
                                                <div className="min-w-0">
                                                    <span className="text-xs font-medium text-[var(--text-primary)] truncate block">
                                                        {item.resource_type}/{item.resource_id.substring(0, 8)}
                                                    </span>
                                                    {item.last_synced_at && (
                                                        <span className="text-[10px] text-[var(--text-muted)]">
                                                            {new Date(item.last_synced_at).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${item.sync_status === 'synced' ? 'bg-green-500/15 text-green-500'
                                                : item.sync_status === 'pending' ? 'bg-amber-500/15 text-amber-500'
                                                    : item.sync_status === 'error' ? 'bg-red-500/15 text-red-500'
                                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                                                }`}>
                                                {item.sync_status}
                                            </span>
                                        </div>
                                        {item.sync_status === 'error' && item.error_message && (
                                            <p className="mt-1.5 ml-6 text-[10px] text-red-500/90 break-words">
                                                {item.error_message}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="p-3 rounded-xl text-[12px] flex items-start gap-2"
                        style={{ background: 'var(--brand-gradient-soft)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <FolderGit2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                        <span>
                            Agent system prompts are stored as <code className="text-[11px] px-1 py-0.5 rounded bg-[var(--bg-tertiary)]">.md</code> files for clean diffs.
                            Each agent change creates a traceable commit in your GitHub repo.
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};

export default GitHubSyncPanel;
