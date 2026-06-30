import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Search, Plus, Check, ChevronDown, RefreshCw, Trash2, ToggleLeft, ToggleRight, Loader2, Plug, ExternalLink, Globe, Terminal, X, Wrench, Sparkles, Compass, ShieldCheck } from 'lucide-react';
import { MCP_REGISTRY, CATEGORIES } from '../../config/mcpCatalog';
import { McpLogo, bestLogoUrl } from '../../utils/mcpLogos';

// Mirror the server-side id derivation (config.js: name → id) so we can match a
// browse/registry card (no id yet) against installed servers by name.
const slugify = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Status → dot colour. 'pending_credentials' (server installed but awaiting the
// per-user credentials needed to connect) is amber, not red — it isn't an error.
const statusDotClass = (status) =>
    status === 'ready' ? 'bg-green-500'
        : status === 'pending_credentials' ? 'bg-amber-500'
            : status === 'error' ? 'bg-red-500'
                : 'bg-gray-500';

export default function McpMarketplace({ setMessage }) {
    // ─── State ──────────────────────────────────────────────────────
    const [installedServers, setInstalledServers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [expandedServer, setExpandedServer] = useState(null);
    const [installing, setInstalling] = useState(null);
    const [showCustomAdd, setShowCustomAdd] = useState(false);
    const [showInstalled, setShowInstalled] = useState(false);

    // Self-hosted (configurable_url) entries collect the operator's endpoint before install
    const [configureServer, setConfigureServer] = useState(null);
    const [configureUrl, setConfigureUrl] = useState('');

    // Featured vs live "Browse all" (official open registry)
    const [tab, setTab] = useState('featured'); // 'featured' | 'browse'
    const [browseResults, setBrowseResults] = useState([]);
    const [browseCursor, setBrowseCursor] = useState(null);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [browseError, setBrowseError] = useState(null);
    const [browseLoaded, setBrowseLoaded] = useState(false);

    // Custom server form state
    const [customName, setCustomName] = useState('');
    const [customTransport, setCustomTransport] = useState('stdio');
    const [customCommand, setCustomCommand] = useState('');
    const [customArgs, setCustomArgs] = useState('');
    const [customUrl, setCustomUrl] = useState('');
    const [customCreds, setCustomCreds] = useState('');
    const [customCategory, setCustomCategory] = useState('development');
    const [customTesting, setCustomTesting] = useState(false);
    const [customTestResult, setCustomTestResult] = useState(null);
    const [customAdding, setCustomAdding] = useState(false);

    // ─── Data Loading ───────────────────────────────────────────────
    const loadServers = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/mcp-servers`);
            if (res.ok) {
                const data = await res.json();
                setInstalledServers(data.servers || []);
            }
        } catch (e) {
            console.error('Failed to load MCP servers:', e);
        }
        setLoading(false);
    };

    useEffect(() => { loadServers(); }, []);

    const installedIds = useMemo(() => new Set(installedServers.map(s => s.id)), [installedServers]);
    const activeCount = useMemo(() => installedServers.filter(s => s.enabled && s.status === 'ready').length, [installedServers]);

    // A catalog/registry card counts as installed if its id OR its name-slug matches.
    const isServerInstalled = (server) => installedIds.has(server.id) || installedIds.has(slugify(server.name));
    const findInstalled = (server) => installedServers.find(s => s.id === server.id) || installedServers.find(s => s.id === slugify(server.name)) || null;

    // ─── Filtered Featured Registry ─────────────────────────────────
    const filteredRegistry = useMemo(() => {
        let items = MCP_REGISTRY;
        if (activeCategory !== 'all') {
            items = items.filter(s => s.category === activeCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            items = items.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.category.toLowerCase().includes(q)
            );
        }
        return items;
    }, [activeCategory, searchQuery]);

    // ─── Live registry browse (debounced) ───────────────────────────
    const fetchBrowse = async ({ q, cursor, append }) => {
        setBrowseLoading(true);
        setBrowseError(null);
        try {
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            if (cursor) params.set('cursor', cursor);
            const res = await authFetch(`${API_BASE}/ai/mcp-registry/search?${params.toString()}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || err.error || 'Registry unavailable');
            }
            const data = await res.json();
            setBrowseResults(prev => append ? [...prev, ...(data.servers || [])] : (data.servers || []));
            setBrowseCursor(data.nextCursor || null);
            setBrowseLoaded(true);
        } catch (e) {
            setBrowseError(e.message);
            if (!append) setBrowseResults([]);
        }
        setBrowseLoading(false);
    };

    // Re-query the live registry on tab/search change (debounced 350ms).
    useEffect(() => {
        if (tab !== 'browse') return;
        const handle = setTimeout(() => {
            fetchBrowse({ q: searchQuery.trim(), cursor: null, append: false });
        }, 350);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, searchQuery]);

    // ─── Install a server (featured or registry) ────────────────────
    // Shared POST. `overrides.url` lets the configure step supply a per-instance
    // endpoint for self-hosted (configurable_url) servers.
    const doInstall = async (server, overrides = {}) => {
        const key = server.id || slugify(server.name);
        setInstalling(key);
        try {
            const res = await authFetch(`${API_BASE}/ai/mcp-servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: server.name,
                    command: server.command,
                    args: server.args || [],
                    required_credentials: server.required_credentials || [],
                    transport: server.transport || 'stdio',
                    url: overrides.url ?? (server.url || null),
                    category: server.category,
                    description: server.description,
                    // Persist the resolved official logo URL (GitHub org avatar / catalog
                    // logo) so the Installed panel + entitlements UI show it too; fall back
                    // to the emoji when no logo resolves.
                    icon: bestLogoUrl(server) || server.icon,
                    source: server.source || 'registry',
                }),
            });
            if (res.ok) {
                setMessage?.({ type: 'success', text: `${server.name} installed successfully` });
                await loadServers();
            } else {
                const err = await res.json();
                setMessage?.({ type: 'error', text: err.error || 'Installation failed' });
            }
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Installation failed: ' + e.message });
        }
        setInstalling(null);
        setTimeout(() => setMessage?.(null), 3000);
    };

    const handleInstall = async (server) => {
        const key = server.id || slugify(server.name);
        // Browse-tab cards have no id yet (the server derives it from name). If that
        // slug already maps to an installed server, installing would overwrite it
        // (createServer does ON CONFLICT DO UPDATE) — confirm first.
        if (!server.id && installedIds.has(key)) {
            if (!confirm(`A server named "${server.name}" is already installed. Overwrite its configuration?`)) return;
        }
        // Self-hosted servers ship only a template URL in the catalog — collect the
        // operator's real endpoint before installing.
        if (server.configurable_url) {
            setConfigureServer(server);
            setConfigureUrl(server.url || '');
            return;
        }
        await doInstall(server);
    };

    // Confirm the per-instance endpoint for a configurable_url server, then install.
    const handleConfirmConfigure = async () => {
        if (!configureServer || !configureUrl.trim()) return;
        const server = configureServer;
        setConfigureServer(null);
        await doInstall(server, { url: configureUrl.trim() });
        setConfigureUrl('');
    };

    // ─── Uninstall ──────────────────────────────────────────────────
    const handleUninstall = async (serverId, serverName) => {
        if (!confirm(`Remove "${serverName}"? This will disconnect the server and remove its configuration.`)) return;
        try {
            await authFetch(`${API_BASE}/ai/mcp-servers/${serverId}`, { method: 'DELETE' });
            setInstalledServers(prev => prev.filter(s => s.id !== serverId));
            setMessage?.({ type: 'success', text: `${serverName} removed` });
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Remove failed' });
        }
        setTimeout(() => setMessage?.(null), 3000);
    };

    // ─── Toggle enable/disable ──────────────────────────────────────
    const handleToggle = async (server) => {
        try {
            await authFetch(`${API_BASE}/ai/mcp-servers/${server.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !server.enabled }),
            });
            await loadServers();
            setMessage?.({ type: 'success', text: `${server.name} ${!server.enabled ? 'enabled' : 'disabled'}` });
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Toggle failed' });
        }
        setTimeout(() => setMessage?.(null), 3000);
    };

    // ─── Refresh tools ──────────────────────────────────────────────
    const handleRefresh = async (server) => {
        try {
            await authFetch(`${API_BASE}/ai/mcp-servers/${server.id}/refresh`, { method: 'POST' });
            await loadServers();
            setMessage?.({ type: 'success', text: `${server.name} tools refreshed` });
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Refresh failed' });
        }
        setTimeout(() => setMessage?.(null), 3000);
    };

    // ─── Custom server add ──────────────────────────────────────────
    const handleTestCustom = async () => {
        setCustomTesting(true);
        setCustomTestResult(null);
        try {
            const args = customArgs.trim() ? customArgs.trim().split(/\s+/) : [];
            const res = await authFetch(`${API_BASE}/ai/mcp-servers/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: customCommand.trim() || undefined,
                    args,
                    transport: customTransport,
                    url: customUrl.trim() || undefined,
                }),
            });
            setCustomTestResult(await res.json());
        } catch (e) {
            setCustomTestResult({ success: false, error: e.message });
        }
        setCustomTesting(false);
    };

    const handleAddCustom = async () => {
        setCustomAdding(true);
        try {
            const args = customArgs.trim() ? customArgs.trim().split(/\s+/) : [];
            const required_credentials = customCreds.trim()
                ? customCreds.split(',').map(s => s.trim()).filter(Boolean).map(key => ({ key, label: key }))
                : [];
            const res = await authFetch(`${API_BASE}/ai/mcp-servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: customName.trim(),
                    command: customCommand.trim() || undefined,
                    args,
                    required_credentials,
                    transport: customTransport,
                    url: customUrl.trim() || undefined,
                    category: customCategory,
                    source: 'manual',
                }),
            });
            if (res.ok) {
                setMessage?.({ type: 'success', text: 'Custom server added' });
                setCustomName(''); setCustomCommand(''); setCustomArgs(''); setCustomUrl(''); setCustomCreds('');
                setShowCustomAdd(false); setCustomTestResult(null);
                await loadServers();
            } else {
                const err = await res.json();
                setMessage?.({ type: 'error', text: err.error || 'Failed to add' });
            }
        } catch (e) {
            setMessage?.({ type: 'error', text: 'Failed: ' + e.message });
        }
        setCustomAdding(false);
        setTimeout(() => setMessage?.(null), 3000);
    };

    const canTestCustom = customTransport === 'stdio' ? !!customCommand.trim() : !!customUrl.trim();
    const canAddCustom = !!customName.trim() && canTestCustom;

    // ─── Card renderer (shared by Featured + Browse) ────────────────
    const renderCard = (server) => {
        const key = server.id || slugify(server.name);
        const isInstalled = isServerInstalled(server);
        const isInstalling = installing === key;
        const installed = isInstalled ? findInstalled(server) : null;
        const credCount = (server.required_credentials || []).length;
        const viewOnly = !!server.viewOnly;

        return (
            <div
                key={key}
                className="group rounded-xl border p-4 transition-all hover:shadow-lg hover:border-[var(--accent-primary)] relative"
                style={{
                    background: 'var(--bg-secondary)',
                    borderColor: isInstalled ? 'var(--accent-primary)' : 'var(--border-default)',
                    opacity: isInstalled ? 0.85 : 1,
                }}
            >
                {/* Installed badge */}
                {isInstalled && (
                    <div className="absolute top-3 right-3">
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">
                            <Check className="w-3 h-3" /> Installed
                        </span>
                    </div>
                )}

                {/* Icon + Name */}
                <div className="flex items-start gap-3 mb-2">
                    <McpLogo server={server} size={32} />
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            {server.name}
                            {server.verified && <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#10b981' }} title="Verified / first-party" />}
                        </h4>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                            {server.transport === 'http' ? '🌐 HTTP' : '💻 Local'}
                        </span>
                    </div>
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                    {server.description}
                </p>

                {/* Credentials needed */}
                {credCount > 0 && (
                    <div className="text-xs mb-3 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        🔑 {credCount} credential{credCount !== 1 ? 's' : ''} needed
                    </div>
                )}

                {/* Install / Status buttons */}
                <div className="flex items-center gap-2">
                    {isInstalled ? (
                        <>
                            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                <div className={`w-2 h-2 rounded-full ${statusDotClass(installed?.status)}`} title={installed?.status === 'pending_credentials' ? 'Awaiting credentials' : installed?.status} />
                                {installed?.tools_cache?.length || 0} tool{(installed?.tools_cache?.length || 0) !== 1 ? 's' : ''}
                            </div>
                            <div className="flex-1" />
                            {installed && (
                                <>
                                    <button onClick={() => handleToggle(installed)} className="p-0.5" title={installed?.enabled ? 'Disable' : 'Enable'}>
                                        {installed?.enabled
                                            ? <ToggleRight className="w-5 h-5" style={{ color: '#10b981' }} />
                                            : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />}
                                    </button>
                                    <button onClick={() => handleUninstall(installed.id, server.name)}
                                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Remove">
                                        <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                    </button>
                                </>
                            )}
                        </>
                    ) : viewOnly ? (
                        <a
                            href={server.homepage || server.repository || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 border"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                            title="No installable package published — open the source instead"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> View only
                        </a>
                    ) : (
                        <button
                            onClick={() => handleInstall(server)}
                            disabled={isInstalling}
                            className="w-full py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                        >
                            {isInstalling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            {isInstalling ? 'Installing...' : 'Install'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div className="p-6">
            {/* Configure per-instance endpoint (self-hosted http servers) */}
            {configureServer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfigureServer(null)}>
                    <div className="w-full max-w-md rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                            <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <McpLogo server={configureServer} size={20} /> Configure {configureServer.name}
                            </h3>
                            <button onClick={() => setConfigureServer(null)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {configureServer.name} is self-hosted — enter your instance's MCP endpoint, replacing the host and organization with your own.
                            </p>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>MCP endpoint URL</label>
                                <input
                                    value={configureUrl}
                                    onChange={e => setConfigureUrl(e.target.value)}
                                    placeholder="https://<your-openobserve-host>/api/<org>/mcp"
                                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    autoFocus
                                />
                            </div>
                            {(configureServer.required_credentials || []).length > 0 && (
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    🔑 After installing, each user adds their credentials under Settings → Integrations: {configureServer.required_credentials.map(c => c.label || c.key).join(', ')}.
                                </p>
                            )}
                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button onClick={() => setConfigureServer(null)}
                                    className="px-3 py-2 rounded-lg text-sm border"
                                    style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}>
                                    Cancel
                                </button>
                                <button onClick={handleConfirmConfigure} disabled={!configureUrl.trim()}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                                    <Plus className="w-4 h-4" /> Install
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Plug className="w-5 h-5" style={{ color: '#f59e0b' }} />
                            MCP Server Marketplace
                            {activeCount > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">{activeCount} active</span>
                            )}
                        </h2>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Browse and install MCP servers to extend AI agent capabilities. Users configure their credentials in Settings.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowInstalled(!showInstalled)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                            style={{
                                background: showInstalled ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: showInstalled ? '#fff' : 'var(--text-primary)',
                                borderColor: showInstalled ? 'transparent' : 'var(--border-default)',
                            }}
                        >
                            <Wrench className="w-3.5 h-3.5" />
                            Installed ({installedServers.length})
                        </button>
                        <button
                            onClick={() => { setShowCustomAdd(!showCustomAdd); setCustomTestResult(null); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                            style={{ background: 'var(--accent-primary)', color: '#fff' }}
                        >
                            <Plus className="w-3.5 h-3.5" /> Custom Server
                        </button>
                    </div>
                </div>

                {/* Featured | Browse all tabs */}
                <div className="flex gap-1.5">
                    {[{ id: 'featured', label: 'Featured', Icon: Sparkles }, { id: 'browse', label: 'Browse all', Icon: Compass }].map(tb => (
                        <button
                            key={tb.id}
                            onClick={() => setTab(tb.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all border"
                            style={{
                                background: tab === tb.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: tab === tb.id ? '#fff' : 'var(--text-secondary)',
                                borderColor: tab === tb.id ? 'transparent' : 'var(--border-default)',
                            }}
                        >
                            <tb.Icon className="w-3.5 h-3.5" /> {tb.label}
                        </button>
                    ))}
                    {tab === 'browse' && (
                        <span className="flex items-center text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                            Live from the open MCP registry · verified servers only
                        </span>
                    )}
                </div>

                {/* Custom Server Form */}
                {showCustomAdd && (
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Add Custom MCP Server</h3>
                            <button onClick={() => setShowCustomAdd(false)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            {/* Transport toggle */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Transport:</label>
                                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
                                    {[{ id: 'stdio', label: 'Local (stdio)', Icon: Terminal }, { id: 'http', label: 'Remote (HTTP)', Icon: Globe }].map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setCustomTransport(t.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                                            style={{
                                                background: customTransport === t.id ? 'var(--accent-primary)' : 'var(--bg-primary)',
                                                color: customTransport === t.id ? '#fff' : 'var(--text-secondary)',
                                            }}
                                        >
                                            <t.Icon className="w-3.5 h-3.5" /> {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input value={customName} onChange={e => setCustomName(e.target.value)}
                                    placeholder="Server name" className="px-3 py-2 rounded-lg text-sm border outline-none transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                <select value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                                    className="px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                    {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                    ))}
                                </select>
                            </div>

                            {customTransport === 'stdio' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input value={customCommand} onChange={e => setCustomCommand(e.target.value)}
                                        placeholder="Command (e.g. npx)" className="px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                    <input value={customArgs} onChange={e => setCustomArgs(e.target.value)}
                                        placeholder="Arguments (e.g. -y @package/server)" className="px-3 py-2 rounded-lg text-sm border outline-none"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                </div>
                            ) : (
                                <input value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                                    placeholder="Server URL (e.g. https://my-mcp-server.com/mcp)" className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                            )}

                            <input value={customCreds} onChange={e => setCustomCreds(e.target.value)}
                                placeholder="Required credentials (comma-separated, e.g. GITHUB_TOKEN, API_KEY)"
                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />

                            <div className="flex items-center gap-2">
                                <button onClick={handleTestCustom} disabled={customTesting || !canTestCustom}
                                    className="px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5 border"
                                    style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}>
                                    {customTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />} Test
                                </button>
                                <button onClick={handleAddCustom} disabled={customAdding || !canAddCustom}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}>
                                    {customAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Server
                                </button>
                            </div>

                            {customTestResult && (
                                <div className={`text-xs px-3 py-2 rounded-lg ${customTestResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {customTestResult.success
                                        ? `✅ Connected — ${customTestResult.tools?.length || 0} tool(s): ${(customTestResult.tools || []).map(t => t.name).join(', ')}`
                                        : `❌ Failed: ${customTestResult.error}`}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Installed Servers Management */}
                {showInstalled && installedServers.length > 0 && (
                    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Wrench className="w-4 h-4" /> Installed Servers
                            </h3>
                        </div>
                        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                            {installedServers.map(server => {
                                const isExpanded = expandedServer === server.id;
                                const toolCount = server.tools_cache?.length || 0;
                                return (
                                    <div key={server.id}>
                                        <div className="flex items-center gap-3 px-5 py-3">
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotClass(server.status)}`}
                                                title={server.status === 'error' ? server.error : server.status === 'pending_credentials' ? 'Awaiting credentials' : server.status} />
                                            <McpLogo server={server} size={20} />
                                            <button onClick={() => setExpandedServer(isExpanded ? null : server.id)} className="flex-1 text-left min-w-0">
                                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{server.name}</div>
                                                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                                    {server.transport === 'http' ? server.url : `${server.command} ${(server.args || []).join(' ')}`} · {toolCount} tool{toolCount !== 1 ? 's' : ''}
                                                    {server.category && ` · ${server.category}`}
                                                </div>
                                            </button>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button onClick={() => handleRefresh(server)} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" title="Refresh tools">
                                                    <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                                                </button>
                                                <button onClick={() => handleToggle(server)} className="p-0.5">
                                                    {server.enabled
                                                        ? <ToggleRight className="w-5 h-5" style={{ color: '#10b981' }} />
                                                        : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />}
                                                </button>
                                                <button onClick={() => handleUninstall(server.id, server.name)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Remove">
                                                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                                </button>
                                                <button onClick={() => setExpandedServer(isExpanded ? null : server.id)} className="p-1">
                                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                                                </button>
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="px-5 pb-4">
                                                {server.error && (
                                                    <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 mb-2">Error: {server.error}</div>
                                                )}
                                                {server.status === 'pending_credentials' && (
                                                    <div className="text-xs px-3 py-2 rounded-lg mb-2" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                                        🔑 Awaiting credentials. This server needs credentials to connect, which each user adds under Settings → Integrations. Its tools are discovered automatically once configured.
                                                    </div>
                                                )}
                                                {server.description && (
                                                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{server.description}</p>
                                                )}
                                                {(server.required_credentials || []).length > 0 && (
                                                    <div className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                                        🔑 Required: {server.required_credentials.map(c => c.label || c.key).join(', ')}
                                                    </div>
                                                )}
                                                {toolCount === 0 ? (
                                                    server.status !== 'pending_credentials' && (
                                                        <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No tools discovered. Try refreshing.</div>
                                                    )
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                        {(server.tools_cache || []).map((tool, idx) => (
                                                            <div key={idx} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{tool.name}</div>
                                                                {tool.description && <div className="mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{tool.description}</div>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Search + Categories */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={tab === 'browse' ? 'Search thousands of MCP servers…' : 'Search MCP servers...'}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none transition-all"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    {tab === 'featured' && (
                        <div className="flex flex-wrap gap-1.5">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                                    style={{
                                        background: activeCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                        color: activeCategory === cat.id ? '#fff' : 'var(--text-secondary)',
                                        borderColor: activeCategory === cat.id ? 'transparent' : 'var(--border-default)',
                                    }}
                                >
                                    <span>{cat.icon}</span> {cat.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Featured grid ─── */}
                {tab === 'featured' && (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredRegistry.map(renderCard)}
                        </div>
                        {filteredRegistry.length === 0 && (
                            <div className="text-center py-12">
                                <div className="text-3xl mb-2">🔍</div>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    No servers found{searchQuery.trim() ? ` for "${searchQuery}"` : ' in this category'}.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* ─── Browse (live registry) grid ─── */}
                {tab === 'browse' && (
                    <>
                        {browseError && (
                            <div className="text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400">
                                Could not reach the MCP registry: {browseError}
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {browseResults.map(renderCard)}
                        </div>

                        {browseLoading && (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                            </div>
                        )}

                        {!browseLoading && browseLoaded && browseResults.length === 0 && !browseError && (
                            <div className="text-center py-12">
                                <div className="text-3xl mb-2">🔍</div>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    No registry servers found{searchQuery.trim() ? ` for "${searchQuery}"` : ''}.
                                </p>
                            </div>
                        )}

                        {!browseLoading && browseCursor && (
                            <div className="flex justify-center">
                                <button
                                    onClick={() => fetchBrowse({ q: searchQuery.trim(), cursor: browseCursor, append: true })}
                                    className="px-4 py-2 rounded-lg text-xs font-medium transition-all border"
                                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
                                >
                                    Load more
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
