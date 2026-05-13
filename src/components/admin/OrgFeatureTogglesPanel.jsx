import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Sparkles, Settings, Loader2, Check, AlertTriangle, Clock, BookOpen, Globe, Zap, Workflow, Brain, SlidersHorizontal } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { INTEGRATION_CATALOG, NEXTCLOUD_INTEGRATION_IDS } from '../../config/integrationCatalog';
import { getIntegrationIcon } from '../../config/integrationIcons';

const SAVE_DEBOUNCE_MS = 400;
const SAVED_FLASH_MS = 1500;

// Best-guess icon for a beta feature based on its id/name — beta features
// are dynamic (registry-driven), so no hardcoded map by id. Keyword match
// keeps new betas auto-iconed without a code change.
function pickBetaIcon(idOrName) {
    const s = (idOrName || '').toLowerCase();
    if (s.includes('skill')) return <Sparkles className="w-4 h-4" />;
    if (s.includes('routine')) return <Clock className="w-4 h-4" />;
    if (s.includes('knowledge') || s.includes('kb')) return <BookOpen className="w-4 h-4" />;
    if (s.includes('webpage') || s.includes('web')) return <Globe className="w-4 h-4" />;
    if (s.includes('automation')) return <Workflow className="w-4 h-4" />;
    if (s.includes('memory')) return <Brain className="w-4 h-4" />;
    if (s.includes('zap') || s.includes('quick')) return <Zap className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
}

const OrgFeatureTogglesPanel = ({ settingsSlot = null }) => {
    const [tab, setTab] = useState('integrations');
    const [orgId, setOrgId] = useState(null);
    const [betaAllowed, setBetaAllowed] = useState([]);
    const [betaEnabled, setBetaEnabled] = useState([]);
    const [betaRegistry, setBetaRegistry] = useState([]);
    const [intAllowed, setIntAllowed] = useState([]);
    const [intEnabled, setIntEnabled] = useState([]);
    const [loading, setLoading] = useState(true);
    const [betaSaveState, setBetaSaveState] = useState('idle'); // idle | saving | saved
    const [intSaveState, setIntSaveState] = useState('idle');
    const [message, setMessage] = useState(null);

    // Refs hold the last server-confirmed state so a failed save can roll back
    // without re-fetching. Initialized on load and updated after each
    // successful PUT.
    const betaServerRef = useRef([]);
    const intServerRef = useRef([]);
    const betaTimerRef = useRef(null);
    const intTimerRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/me/active-features`);
            if (!res.ok) {
                setMessage({ type: 'error', text: `Failed to load (${res.status})` });
                return;
            }
            const j = await res.json();
            setOrgId(j.orgId || null);
            setBetaAllowed(Array.isArray(j.allowedBetaFeatures) ? j.allowedBetaFeatures : []);
            const betaServer = Array.isArray(j.enabledBetaFeatures) ? j.enabledBetaFeatures : [];
            setBetaEnabled(betaServer);
            betaServerRef.current = betaServer;
            setBetaRegistry(Array.isArray(j.betaRegistry) ? j.betaRegistry : []);
            const allowed = (j.allowedIntegrations || []).filter(id => !NEXTCLOUD_INTEGRATION_IDS.has(id));
            setIntAllowed(allowed);
            const intServer = (j.enabledIntegrations || []).filter(id => allowed.includes(id));
            setIntEnabled(intServer);
            intServerRef.current = intServer;
        } catch (e) {
            console.error('[OrgFeatures] load:', e);
            setMessage({ type: 'error', text: 'Failed to load' });
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!message) return;
        const t = setTimeout(() => setMessage(null), 4000);
        return () => clearTimeout(t);
    }, [message]);

    // Clean up any pending save timers on unmount so we don't fire a PUT
    // after the user has navigated away (would still succeed, but the
    // state-setter calls would log a warning).
    useEffect(() => () => {
        if (betaTimerRef.current) clearTimeout(betaTimerRef.current);
        if (intTimerRef.current) clearTimeout(intTimerRef.current);
    }, []);

    const flashSaved = (setter) => {
        setter('saved');
        setTimeout(() => setter(prev => prev === 'saved' ? 'idle' : prev), SAVED_FLASH_MS);
    };

    const queueBetaSave = (nextList) => {
        if (betaTimerRef.current) clearTimeout(betaTimerRef.current);
        betaTimerRef.current = setTimeout(async () => {
            setBetaSaveState('saving');
            try {
                const res = await authFetch(`${API_BASE}/auth/me/active-features`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ betaEnabled: nextList }),
                });
                if (!res.ok) throw new Error('Save failed');
                const j = await res.json();
                const confirmed = Array.isArray(j.enabledBetaFeatures) ? j.enabledBetaFeatures : [];
                setBetaEnabled(confirmed);
                betaServerRef.current = confirmed;
                flashSaved(setBetaSaveState);
            } catch (e) {
                setBetaEnabled(betaServerRef.current);
                setBetaSaveState('idle');
                setMessage({ type: 'error', text: e.message || 'Save failed' });
            }
        }, SAVE_DEBOUNCE_MS);
    };

    const queueIntSave = (nextList) => {
        if (intTimerRef.current) clearTimeout(intTimerRef.current);
        intTimerRef.current = setTimeout(async () => {
            setIntSaveState('saving');
            try {
                const res = await authFetch(`${API_BASE}/auth/me/active-features`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ integrationsEnabled: nextList }),
                });
                if (!res.ok) throw new Error('Save failed');
                const j = await res.json();
                const confirmed = (j.enabledIntegrations || []).filter(id => intAllowed.includes(id));
                setIntEnabled(confirmed);
                intServerRef.current = confirmed;
                flashSaved(setIntSaveState);
            } catch (e) {
                setIntEnabled(intServerRef.current);
                setIntSaveState('idle');
                setMessage({ type: 'error', text: e.message || 'Save failed' });
            }
        }, SAVE_DEBOUNCE_MS);
    };

    const toggleBeta = (id) => {
        setBetaEnabled(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            queueBetaSave(next);
            return next;
        });
    };

    const toggleIntegration = (id) => {
        setIntEnabled(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            queueIntSave(next);
            return next;
        });
    };

    const intByCategory = useMemo(() => {
        const groups = new Map();
        for (const id of intAllowed) {
            const item = INTEGRATION_CATALOG.find(i => i.id === id);
            if (!item) continue;
            const key = item.category || 'Other';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        }
        return groups;
    }, [intAllowed]);

    const betaItems = useMemo(() => {
        return betaAllowed.map(id => {
            const reg = betaRegistry.find(f => f.id === id);
            return reg || { id, name: id, description: '' };
        });
    }, [betaAllowed, betaRegistry]);

    if (loading) {
        return (
            <div className="p-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    if (!orgId) {
        return (
            <div
                className="rounded-2xl p-5 text-sm"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            >
                Your account is not bound to an organisation. Ask your platform administrator to assign one.
            </div>
        );
    }

    const SaveStatus = ({ state }) => {
        if (state === 'saving') {
            return (
                <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving…
                </span>
            );
        }
        if (state === 'saved') {
            return (
                <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent-primary, #10b981)' }}>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                </span>
            );
        }
        return null;
    };

    const IntegrationCard = ({ item, selected, onToggle }) => (
        <div
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
            style={{
                border: `1px solid ${selected ? 'var(--accent-primary, #10b981)' : 'var(--border-subtle)'}`,
                background: selected ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-primary)',
                opacity: selected ? 1 : 0.85,
            }}
            onClick={() => onToggle(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(item.id); } }}
        >
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg-secondary)' }}
            >
                {getIntegrationIcon(item.id)}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                {item.description ? (
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
                ) : null}
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected} onChange={() => onToggle(item.id)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
            </label>
        </div>
    );

    const BetaCard = ({ item, selected, onToggle }) => (
        <div
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
            style={{
                border: `1px solid ${selected ? 'var(--accent-primary, #10b981)' : 'var(--border-subtle)'}`,
                background: selected ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-primary)',
                opacity: selected ? 1 : 0.85,
            }}
            onClick={() => onToggle(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(item.id); } }}
        >
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: selected ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                    color: selected ? 'var(--accent-primary, #10b981)' : 'var(--text-secondary)',
                }}
            >
                {pickBetaIcon(item.id || item.name)}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                {item.description ? (
                    <p className="text-[11px] line-clamp-2" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
                ) : null}
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected} onChange={() => onToggle(item.id)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
            </label>
        </div>
    );

    const tabs = [
        { id: 'integrations', label: 'Integrations', icon: <Settings size={14} /> },
        { id: 'beta', label: 'Beta features', icon: <Sparkles size={14} /> },
        ...(settingsSlot ? [{ id: 'settings', label: 'Integration settings', icon: <SlidersHorizontal size={14} /> }] : []),
    ];

    return (
        <div className="space-y-4">
            {/* Top sub-nav — matches Studio tab style */}
            <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border-default, var(--border-subtle))' }}>
                {tabs.map((t) => {
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition"
                            style={{
                                background: active ? 'var(--bg-secondary)' : 'transparent',
                                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: active ? 500 : 400,
                            }}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {message ? (
                <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{
                        background: message.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        color: message.type === 'ok' ? '#059669' : '#dc2626',
                        border: `1px solid ${message.type === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}
                >
                    {message.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </div>
            ) : null}

            {/* ── Beta Features ─────────────────────────────────────── */}
            {tab === 'beta' && (
            <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <header className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary, #10b981)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Beta features</h2>
                    </div>
                    <SaveStatus state={betaSaveState} />
                </header>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                    Turn on the beta features your team should have access to. Only features granted by your platform administrator are listed here.
                </p>
                {betaItems.length === 0 ? (
                    <div className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>
                        No beta features granted to this organisation yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {betaItems.map(f => (
                            <BetaCard
                                key={f.id}
                                item={f}
                                selected={betaEnabled.includes(f.id)}
                                onToggle={toggleBeta}
                            />
                        ))}
                    </div>
                )}
            </section>
            )}

            {/* ── Integrations ──────────────────────────────────────── */}
            {tab === 'integrations' && (
            <section className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <header className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Integrations</h2>
                    </div>
                    <SaveStatus state={intSaveState} />
                </header>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                    Decide which third-party tools your agents are allowed to use. Nextcloud is configured separately in the panel below.
                </p>
                {intAllowed.length === 0 ? (
                    <div className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>
                        No integrations granted to this organisation yet.
                    </div>
                ) : (
                    <div className="space-y-5">
                        {[...intByCategory.entries()].map(([cat, items]) => (
                            <div key={cat}>
                                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{cat}</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {items.map(i => (
                                        <IntegrationCard
                                            key={i.id}
                                            item={i}
                                            selected={intEnabled.includes(i.id)}
                                            onToggle={toggleIntegration}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            )}

            {/* ── Integration settings (slot) ──────────────────────── */}
            {tab === 'settings' && settingsSlot}
        </div>
    );
};

export default OrgFeatureTogglesPanel;
