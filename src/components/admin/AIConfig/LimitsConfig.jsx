import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const PER_SURFACE_DEFAULTS = [
    { name: 'Direct chat', value: 5 },
    { name: 'Notebook chat', value: 5 },
    { name: 'Webpage chat', value: 10 },
    { name: 'Native streaming loop', value: 10 },
];

const LimitsConfig = ({ onNavigateToTab }) => {
    const [value, setValue] = useState('');
    const [kbProvider, setKbProvider] = useState('auto');
    const [cpuRerankerEnabled, setCpuRerankerEnabled] = useState(true);
    const [status, setStatus] = useState({
        embedModel: null,
        embedProvider: null,
        searchProvider: null,
        hasSerperKey: false,
        hasAgentSearchUrl: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => { fetchConfig(); }, []);

    const fetchConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                setValue(data.maxToolRoundsChat ?? '');
                setKbProvider(data.kbProvider || 'auto');
                setCpuRerankerEnabled(data.cpuRerankerEnabled !== false);
                setStatus({
                    embedModel: data.embeddingModel || null,
                    embedProvider: data.embeddingProviderId || null,
                    searchProvider: data.searchProvider || 'agent-search',
                    hasSerperKey: !!data.hasSerperKey,
                    hasAgentSearchUrl: !!data.hasAgentSearchUrl,
                });
            }
        } catch (e) {
            console.error('Failed to load limits:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const trimmed = String(value).trim();
            const payload = {
                maxToolRoundsChat: trimmed === '' ? null : parseInt(trimmed, 10),
                kbProvider: kbProvider === 'auto' ? null : kbProvider,
                cpuRerankerEnabled,
            };
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Saved' });
                fetchConfig();
            } else {
                setMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (_) {
            setMessage({ type: 'error', text: 'Failed to save' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 2500);
        }
    };

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

    const KB_OPTIONS = [
        { id: 'auto', label: 'Auto', desc: 'Local KB when no SEARCH_SERVICE_URL is set, remote service when it is. Safe default for both fresh installs and upgrades.' },
        { id: 'local', label: 'Local (in-process)', desc: 'pgvector + RRF + reranker run inside this Node server. No GPU service required. Recommended for most self-hosted setups.' },
        { id: 'remote', label: 'Remote search-service', desc: 'Forward KB ingest + search to the external services.beeflow.ai (or self-hosted SEARCH_SERVICE_URL). Required for legacy GPU-backed deployments.' },
    ];

    return (
        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Limits & Self-host</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Runtime caps and routing for self-hosted deployments. Background agents (AI tasks, swarms, browser, automation builder) keep their own internal limits and are out of scope.
                </p>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            {/* ── Self-host status summary ─────────────────────────────── */}
            <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Setup status</div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    What this server will use right now. Click a row to jump to the tab that controls it.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {/* Embedding model */}
                    <button
                        type="button"
                        onClick={() => onNavigateToTab && onNavigateToTab('embeddings')}
                        className="text-left px-3 py-2 rounded-lg border hover:bg-white/5 transition-colors"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                    >
                        <div style={{ color: 'var(--text-muted)' }}>Embedding model (global)</div>
                        <div className="font-semibold mt-0.5" style={{ color: status.embedModel ? 'var(--text-primary)' : '#f59e0b' }}>
                            {status.embedModel ? `${status.embedModel}${status.embedProvider ? ` · ${status.embedProvider}` : ''}` : 'Not set — pick one in Embeddings'}
                        </div>
                    </button>

                    {/* Search provider */}
                    <button
                        type="button"
                        onClick={() => onNavigateToTab && onNavigateToTab('webSearchInference')}
                        className="text-left px-3 py-2 rounded-lg border hover:bg-white/5 transition-colors"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                    >
                        <div style={{ color: 'var(--text-muted)' }}>Web search provider</div>
                        <div className="font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {status.searchProvider === 'node-search' ? 'Cloud-only (Serper + provider APIs)'
                                : status.searchProvider === 'bing' ? 'Azure Bing Web Search'
                                : status.searchProvider === 'disabled' ? 'Disabled'
                                : 'Self-hosted (Agent Search + Serper)'}
                            {(status.searchProvider === 'node-search' && !status.hasSerperKey) && (
                                <span className="ml-2" style={{ color: '#f59e0b' }}>· needs Serper key</span>
                            )}
                            {(status.searchProvider === 'agent-search' && !status.hasAgentSearchUrl) && (
                                <span className="ml-2" style={{ color: '#f59e0b' }}>· needs SEARCH_SERVICE_URL</span>
                            )}
                        </div>
                    </button>

                    {/* KB provider (current) */}
                    <button
                        type="button"
                        className="text-left px-3 py-2 rounded-lg border"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                    >
                        <div style={{ color: 'var(--text-muted)' }}>KB provider</div>
                        <div className="font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {kbProvider === 'auto' ? 'Auto' : kbProvider === 'local' ? 'Local (in-process)' : 'Remote search-service'}
                        </div>
                    </button>

                    {/* CPU reranker */}
                    <button
                        type="button"
                        className="text-left px-3 py-2 rounded-lg border"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                    >
                        <div style={{ color: 'var(--text-muted)' }}>CPU cross-encoder reranker</div>
                        <div className="font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {cpuRerankerEnabled ? 'Enabled' : 'Disabled'}
                        </div>
                    </button>
                </div>
            </div>

            {/* ── Tool-call rounds ─────────────────────────────────────── */}
            <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tool calls per chat turn</div>
                <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
                    Maximum number of tool-call rounds the model is allowed before it must produce a final answer. Applies uniformly to direct chat, notebook chat, webpage chat, and the native streaming loop.
                </p>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        min="1"
                        max="50"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder="Use per-surface defaults"
                        className="w-48 px-3 py-2.5 rounded-lg border outline-none text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Range 1–50. Leave empty to use per-surface defaults.
                    </span>
                </div>
                <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        Per-surface defaults (when empty)
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {PER_SURFACE_DEFAULTS.map(s => (
                            <div key={s.name} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                                <div style={{ color: 'var(--text-muted)' }}>{s.name}</div>
                                <div className="font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{s.value} rounds</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── KB provider ──────────────────────────────────────────── */}
            <div className="rounded-xl border p-4 mb-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Knowledge-base provider</div>
                <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
                    Where KB chunk retrieval and ranking happens. Local routes everything through the in-process pgvector + reranker pipeline; remote forwards to the external search-service.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {KB_OPTIONS.map(opt => {
                        const selected = kbProvider === opt.id;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => setKbProvider(opt.id)}
                                className="text-left p-3 rounded-lg border transition-all"
                                style={{
                                    background: selected ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                                    borderColor: selected ? '#10B981' : 'var(--border-default)',
                                }}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                                        style={{ borderColor: selected ? '#10B981' : 'var(--border-default)', background: selected ? '#10B981' : 'transparent' }}>
                                        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                                    </span>
                                    <span className="text-sm font-medium" style={{ color: selected ? '#10B981' : 'var(--text-primary)' }}>
                                        {opt.label}
                                    </span>
                                </div>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── CPU reranker ─────────────────────────────────────────── */}
            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>In-process CPU reranker</div>
                <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
                    When Azure Cohere reranker is not configured, fall back to the in-process Transformers.js cross-encoder (Xenova/bge-reranker-base, MIT, ~280 MB). First call downloads the model; subsequent calls run locally with no network round-trip.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={cpuRerankerEnabled}
                        onChange={e => setCpuRerankerEnabled(e.target.checked)}
                        className="rounded"
                    />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        Enable CPU cross-encoder reranker (recommended)
                    </span>
                </label>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: saving ? 'var(--bg-tertiary)' : 'var(--accent-primary)', color: 'white', opacity: saving ? 0.6 : 1 }}
                >
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
};

export default LimitsConfig;
