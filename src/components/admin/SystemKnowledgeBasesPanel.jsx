import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, Circle, Loader2, RefreshCw, ExternalLink, ShieldCheck, Download, Bot, Plus } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const SystemKnowledgeBasesPanel = () => {
    const [items, setItems] = useState([]);
    const [orgId, setOrgId] = useState(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(null);
    const [error, setError] = useState(null);
    // slug → { running, total, done, okCount, failCount, finishedAt, ... }
    const [refreshStatus, setRefreshStatus] = useState({});
    const pollRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/system`);
            if (!res.ok) throw new Error(`Load failed (${res.status})`);
            const j = await res.json();
            setItems(Array.isArray(j.items) ? j.items : []);
            setOrgId(j.orgId || null);
            setIsSuperAdmin(!!j.isSuperAdmin);
        } catch (e) {
            setError(e.message || 'Load failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Poll the per-slug seed status while any refresh is running. Stops as
    // soon as the server reports `running: false` for every slug; restarts
    // when a new refresh is triggered. 2s interval keeps the panel responsive
    // without hammering the server during the (typically 30–60s) ingest.
    const startPolling = useCallback(() => {
        if (pollRef.current) return;
        pollRef.current = setInterval(async () => {
            try {
                const slugs = items.filter(i => i.system_slug).map(i => i.system_slug);
                const updates = await Promise.all(slugs.map(async (slug) => {
                    const r = await authFetch(`${API_BASE}/api/kb/system/${slug}/status`);
                    if (!r.ok) return [slug, null];
                    return [slug, await r.json()];
                }));
                let stillRunning = false;
                setRefreshStatus(prev => {
                    const next = { ...prev };
                    for (const [slug, s] of updates) {
                        if (s) next[slug] = s;
                        if (s?.running) stillRunning = true;
                    }
                    return next;
                });
                if (!stillRunning) {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                    // One last reload to pick up the new document counts.
                    load();
                }
            } catch (_) { /* keep polling — transient errors are OK */ }
        }, 2000);
    }, [items, load]);

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    const refresh = async (item, { force = false } = {}) => {
        if (!isSuperAdmin || !item.system_slug) return;
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/kb/system/${item.system_slug}/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force }),
            });
            if (!res.ok && res.status !== 202) {
                const txt = await res.text().catch(() => '');
                throw new Error(`Refresh kick-off failed (${res.status}): ${txt.slice(0, 200)}`);
            }
            const j = await res.json();
            setRefreshStatus(prev => ({ ...prev, [item.system_slug]: j.status }));
            startPolling();
        } catch (e) {
            setError(e.message || 'Refresh failed');
        }
    };

    const toggle = async (item) => {
        if (!item.betaFeatureId || toggling) return;
        if (!orgId) {
            setError('No organisation to toggle on. Create an organisation first.');
            return;
        }
        setToggling(item.betaFeatureId);
        try {
            const goingOn = !item.enabledForOrg;

            // Super-admins can write the allow-list too. When enabling, make
            // sure the slug is in the org's super-admin allow-list before we
            // try to write the active subset — /auth/me/active-features
            // silently drops anything not in the allow-list.
            if (isSuperAdmin && goingOn && !item.allowedForOrg) {
                const cur = await authFetch(`${API_BASE}/auth/beta-features`);
                if (!cur.ok) throw new Error('Could not read allow-list');
                const curJ = await cur.json();
                const current = (curJ.assignments && curJ.assignments[orgId]) || [];
                const nextAllow = current.includes(item.betaFeatureId)
                    ? current
                    : [...current, item.betaFeatureId];
                const putAllow = await authFetch(`${API_BASE}/auth/organizations/${orgId}/beta-features`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ features: nextAllow }),
                });
                if (!putAllow.ok) throw new Error('Could not grant feature to organisation');
            }

            // Flip the org-admin active subset (the toggle every user sees).
            const cur = await authFetch(`${API_BASE}/auth/me/active-features`);
            if (!cur.ok) throw new Error('Could not read current features');
            const curJ = await cur.json();
            const active = new Set(Array.isArray(curJ.enabledBetaFeatures) ? curJ.enabledBetaFeatures : []);
            if (goingOn) active.add(item.betaFeatureId);
            else active.delete(item.betaFeatureId);
            const put = await authFetch(`${API_BASE}/auth/me/active-features`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ betaEnabled: Array.from(active) }),
            });
            if (!put.ok) throw new Error('Save failed');
            await load();
        } catch (e) {
            setError(e.message || 'Toggle failed');
        } finally {
            setToggling(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-6 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading system knowledge bases…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 rounded-lg border" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: 'rgb(239, 68, 68)' }}>
                <div className="flex items-center justify-between">
                    <span className="text-sm">{error}</span>
                    <button onClick={load} className="text-xs underline">Retry</button>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="p-6 rounded-lg border text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <div className="text-sm">No system knowledge bases have been provisioned yet.</div>
                <div className="text-xs mt-1 opacity-70">The server auto-seeds on next boot when a beta feature exists. You can also click "Refresh now" once the row appears.</div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        System knowledge bases
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Read-only collections maintained by Bee Flow. Toggle a collection on to make it available to your agents and chat — same picker as your own KBs.
                    </p>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}
                    title="Refresh status"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map(item => {
                    const isOn = !!item.enabledForOrg;
                    const isBusy = toggling === item.betaFeatureId;
                    return (
                        <div
                            key={item.id}
                            className="rounded-lg border p-4 flex flex-col gap-3"
                            style={{
                                borderColor: isOn ? 'var(--accent-primary)' : 'var(--border-subtle)',
                                background: 'var(--bg-secondary)',
                            }}
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-2xl shrink-0">{item.icon || '📚'}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                                    {item.description && (
                                        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                                <span>{item.documentCount} document{item.documentCount === 1 ? '' : 's'}</span>
                                <span>·</span>
                                <span>{item.totalChunks} chunk{item.totalChunks === 1 ? '' : 's'}</span>
                                {item.updatedAt && (
                                    <>
                                        <span>·</span>
                                        <span title={item.updatedAt}>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
                                    </>
                                )}
                            </div>

                            {/* Refresh progress — visible while a seed is running or just finished. */}
                            {(() => {
                                const s = item.system_slug ? refreshStatus[item.system_slug] : null;
                                if (!s) return null;
                                if (s.running) {
                                    const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                                    return (
                                        <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Seeding {s.done} / {s.total} statutes ({pct}%)</span>
                                            </div>
                                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                                                <div className="h-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent-primary)' }} />
                                            </div>
                                        </div>
                                    );
                                }
                                if (s.finishedAt && (s.okCount || s.failCount)) {
                                    return (
                                        <div className="text-xs" style={{ color: s.failCount > 0 ? 'rgb(217, 119, 6)' : 'var(--text-muted)' }}>
                                            Last seed: {s.okCount} ok, {s.failCount} failed · {new Date(s.finishedAt).toLocaleTimeString()}
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                                <button
                                    onClick={() => toggle(item)}
                                    disabled={isBusy || !item.betaFeatureId || !orgId}
                                    className="flex items-center gap-2 text-sm font-medium"
                                    style={{ color: isOn ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: (!item.betaFeatureId || !orgId) ? 'not-allowed' : 'pointer' }}
                                    title={!orgId ? 'No organisation to toggle on' : (isOn ? 'Click to disable for this organisation' : 'Click to enable for this organisation')}
                                >
                                    {isBusy ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : isOn ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                        <Circle className="w-4 h-4" />
                                    )}
                                    {isOn ? 'Enabled for organisation' : 'Disabled for organisation'}
                                </button>
                                {/* Super-admin always has access via their bypass; surface that
                                    explicitly so they aren't confused by a "Disabled" label. */}
                                {item.superAdminBypass && !isOn && (
                                    <span
                                        className="flex items-center gap-1 text-xs"
                                        style={{ color: 'var(--accent-primary)' }}
                                        title="As a global admin, you can use this knowledge base in your own chats regardless of organisation toggle."
                                    >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        Available to you (super-admin)
                                    </span>
                                )}
                                {isSuperAdmin && item.system_slug && (() => {
                                    const s = refreshStatus[item.system_slug];
                                    const running = !!s?.running;
                                    return (
                                        <button
                                            onClick={() => refresh(item)}
                                            disabled={running}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                                            style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', cursor: running ? 'wait' : 'pointer' }}
                                            title="Re-ingest statutes from KOOP (wetten.overheid.nl). Super-admin only."
                                        >
                                            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                            {running ? 'Seeding…' : 'Refresh now'}
                                        </button>
                                    );
                                })()}
                                {item.system_slug === 'dutch_legal_sources' && (
                                    <a
                                        href="https://wetten.overheid.nl"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        wetten.overheid.nl
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <AgentPresetsSection />
        </div>
    );
};

// Recommended agent presets — appear right under the System KB toggle because
// the presets are functionally useless without the matching system KB
// enabled. Installing creates a real, tenant-owned agent the admin can then
// rename, tweak, or share.
const AgentPresetsSection = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState(null);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/agent-presets`);
            if (!res.ok) throw new Error(`Load failed (${res.status})`);
            const j = await res.json();
            setItems(Array.isArray(j.items) ? j.items : []);
        } catch (e) {
            setError(e.message || 'Load failed');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const install = async (item) => {
        if (!item.available || item.installedAgentId) return;
        setInstalling(item.slug);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/agent-presets/${item.slug}/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => '');
                throw new Error(`Install failed (${res.status}): ${txt.slice(0, 200)}`);
            }
            await load();
        } catch (e) {
            setError(e.message || 'Install failed');
        } finally {
            setInstalling(null);
        }
    };

    if (loading || items.length === 0) return null;

    return (
        <div className="space-y-3 pt-4 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
                <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Bot className="w-4 h-4" />
                    Aanbevolen agents
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Kant-en-klare agent-templates die bovenstaande systeem-KB gebruiken. Eén klik installeert een tenant-eigen agent die je daarna kunt aanpassen of delen.
                </p>
            </div>

            {error && (
                <div className="p-3 rounded-md text-xs" style={{ background: 'rgba(239, 68, 68, 0.05)', color: 'rgb(239, 68, 68)' }}>
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map(p => {
                    const isInstalled = !!p.installedAgentId;
                    const isBusy = installing === p.slug;
                    const disabled = !p.available || isInstalled || isBusy;
                    return (
                        <div
                            key={p.slug}
                            className="rounded-lg border p-4 flex flex-col gap-3"
                            style={{
                                borderColor: isInstalled ? 'var(--accent-primary)' : 'var(--border-subtle)',
                                background: 'var(--bg-secondary)',
                                opacity: p.available ? 1 : 0.6,
                            }}
                        >
                            <div className="flex items-start gap-3">
                                <Bot className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{p.description}</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                {isInstalled ? (
                                    <a
                                        href={`/app/agents/${p.installedAgentId}`}
                                        className="flex items-center gap-1.5 text-sm font-medium"
                                        style={{ color: 'var(--accent-primary)' }}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Geïnstalleerd — open agent
                                    </a>
                                ) : (
                                    <button
                                        onClick={() => install(p)}
                                        disabled={disabled}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                                        style={{
                                            color: p.available ? 'var(--accent-foreground)' : 'var(--text-muted)',
                                            background: p.available ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                        }}
                                        title={p.available ? 'Maak een nieuwe agent op basis van deze preset' : `Eerst de systeem-KB '${p.betaFeature}' inschakelen.`}
                                    >
                                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Installeer
                                    </button>
                                )}
                                {!p.available && !isInstalled && (
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Schakel eerst de systeem-KB hierboven in.
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SystemKnowledgeBasesPanel;
