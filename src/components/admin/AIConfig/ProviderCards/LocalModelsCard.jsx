// Self-hosted LLM runtimes (Ollama, vLLM, llama.cpp, LM Studio, …).
//
// Unlike the other provider cards this is not a single API key: a customer can
// run several runtimes at once (a GPU box with vLLM plus Ollama on a laptop),
// so it is CRUD over the generic /ai/providers records whose type is one of the
// self-hosted runtimes.
//
// The three things that make this genuinely easy to set up:
//   · Autodetect — probes the usual local addresses and offers whatever
//     answers, so the common case is one click and no typing.
//   · Test connection — says whether it is reachable AND what it is serving,
//     before you go looking for the model in the tier picker.
//   · Download — pulls a model into Ollama with a real progress bar, from a
//     curated starter list or any tag from the Ollama library.

import React, { useState, useEffect, useCallback } from 'react';
import AddRuntimeForm from './local/AddRuntimeForm';
import {
    BTN_PRIMARY,
    BTN_GHOST,
    fetchRuntimeCatalog,
    fetchProviders,
    detectRuntimes,
    connectRuntime,
    disconnectRuntime,
} from './local/localRuntimeApi';
import RuntimeRow from './local/RuntimeRow';
import ProviderCardShell, { ProviderStatusPill } from './shared/ProviderCardShell';

const LocalModelsCard = ({ onMessage, onProvidersChanged }) => {
    const [runtimes, setRuntimes] = useState([]);
    const [starterModels, setStarterModels] = useState([]);
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showAdd, setShowAdd] = useState(false);
    const [saving, setSaving] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [detected, setDetected] = useState(null);

    const localTypes = new Set(runtimes.map(r => r.type));
    const localProviders = providers.filter(p => localTypes.has(p.type));

    const reload = useCallback(async () => {
        setProviders(await fetchProviders());
        onProvidersChanged?.();
    }, [onProvidersChanged]);

    useEffect(() => {
        (async () => {
            try {
                const catalog = await fetchRuntimeCatalog();
                setRuntimes(catalog.runtimes);
                setStarterModels(catalog.starterModels);
                setProviders(await fetchProviders());
            } catch (e) {
                console.error('Failed to load the local runtime catalogue:', e);
            }
            setLoading(false);
        })();
    }, []);

    const handleConnect = async ({ type, name, url, apiKey }) => {
        setSaving(true);
        const result = await connectRuntime({ type, name, url, apiKey });
        if (result.ok) {
            onMessage?.({ type: 'success', text: `${name} connected. Its models are now selectable under Chat Models.` });
            setShowAdd(false);
            // Reflect it immediately in the detect list so the row doesn't keep
            // offering a Connect button for something already connected.
            setDetected(d => d ? { ...d, found: d.found.map(f => (f.url === url ? { ...f, alreadyConfigured: true } : f)) } : d);
            await reload();
        } else {
            onMessage?.({ type: 'error', text: result.error });
        }
        setSaving(false);
    };

    const handleRemove = async (id) => {
        const { ok } = await disconnectRuntime(id);
        onMessage?.(ok
            ? { type: 'success', text: 'Runtime disconnected' }
            : { type: 'error', text: 'Failed to disconnect the runtime' });
        if (ok) await reload();
    };

    const handleDetect = async () => {
        setDetecting(true);
        setDetected(null);
        try {
            setDetected(await detectRuntimes());
        } catch (e) {
            onMessage?.({ type: 'error', text: e.message });
            setDetected({ found: [], probed: 0 });
        }
        setDetecting(false);
    };

    return (
        <ProviderCardShell
            icon="🖥️"
            iconGradient="linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2))"
            title="Local models (self-hosted)"
            subtitle="Ollama, vLLM, llama.cpp, LM Studio and other OpenAI-compatible runtimes — nothing leaves your infrastructure, and there is no per-token cost"
            badges={localProviders.length > 0 ? <ProviderStatusPill>{localProviders.length} connected</ProviderStatusPill> : null}
        >
            {loading ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : (
                <>
                    {localProviders.map(provider => (
                        <RuntimeRow
                            key={provider.id}
                            provider={provider}
                            runtime={runtimes.find(r => r.type === provider.type) || {}}
                            starterModels={starterModels}
                            onMessage={onMessage}
                            onChanged={reload}
                            onRemove={handleRemove}
                        />
                    ))}

                    <div className="flex gap-2 flex-wrap">
                        <button className={BTN_PRIMARY} disabled={detecting} onClick={handleDetect}>
                            {detecting ? 'Scanning…' : '🔍 Find running runtimes'}
                        </button>
                        <button
                            className={BTN_GHOST}
                            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
                            onClick={() => setShowAdd(s => !s)}
                        >
                            {showAdd ? 'Cancel' : '+ Add manually'}
                        </button>
                    </div>

                    {detected && (
                        <div className="space-y-1.5">
                            {detected.found.length === 0 ? (
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Nothing found on the {detected.probed} usual addresses. Start a runtime (for example <code>ollama serve</code>)
                                    and scan again, or add its address manually. If Bee Flow itself runs in Docker, the runtime has to be
                                    reachable from inside that container — use <code>host.docker.internal</code> rather than <code>localhost</code>.
                                </p>
                            ) : detected.found.map(f => (
                                <div
                                    key={f.url}
                                    className="flex items-center gap-2 p-2.5 rounded-lg border flex-wrap"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                                >
                                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{f.label}</span>
                                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{f.url}</span>
                                    <ProviderStatusPill tone="blue">{f.modelCount} model{f.modelCount !== 1 ? 's' : ''}</ProviderStatusPill>
                                    <div className="flex-1" />
                                    {f.alreadyConfigured ? (
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Already connected</span>
                                    ) : (
                                        <button
                                            className={BTN_PRIMARY}
                                            disabled={saving}
                                            onClick={() => handleConnect({ type: f.type, name: f.label, url: f.url, apiKey: '' })}
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {showAdd && (
                        <AddRuntimeForm runtimes={runtimes} saving={saving} onConnect={handleConnect} />
                    )}

                    {localProviders.length === 0 && !showAdd && !detected && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Nothing connected yet. Models served this way run on your own hardware and are billed at €0 — connect a
                            runtime here, then assign its models to tiers under <strong>Chat Models</strong>.
                        </p>
                    )}
                </>
            )}
        </ProviderCardShell>
    );
};

export default LocalModelsCard;
