// One connected self-hosted runtime: its address, a connection test, the
// model-download panel (Ollama only) and the download progress bar.

import React, { useState } from 'react';
import { BTN_PRIMARY, BTN_GHOST, TIER_LABELS, testRuntime, pullModel } from './localRuntimeApi';
import ProbeResult from './ProbeResult';
import DeleteConfirmButtons from '../shared/DeleteConfirmButtons';
import { ProviderStatusPill, PROVIDER_INPUT_CLS, PROVIDER_INPUT_STYLE } from '../shared/ProviderCardShell';

const RuntimeRow = ({ provider, runtime, starterModels, onMessage, onChanged, onRemove }) => {
    const [probe, setProbe] = useState(null);
    const [testing, setTesting] = useState(false);
    const [pullOpen, setPullOpen] = useState(false);
    const [pullInput, setPullInput] = useState('');
    const [pull, setPull] = useState(null);   // { model, status, pct, error }

    // Providers created from an env var are recreated on restart, so deleting
    // one in the UI is not the way to turn it off — say so rather than letting
    // it reappear unexplained.
    const isEnvManaged = provider.id.endsWith('-env');
    const downloading = !!pull && !pull.error && pull.status !== 'done';

    const runTest = async () => {
        setTesting(true);
        setProbe(await testRuntime({ type: provider.type, url: provider.url }));
        setTesting(false);
    };

    const download = async (model) => {
        if (!model?.trim()) return;
        const name = model.trim();
        setPull({ model: name, status: 'starting…', pct: 0, error: null });
        const result = await pullModel(provider.id, name, ({ status, pct }) => {
            setPull({ model: name, status, pct, error: null });
        });
        if (result.ok) {
            setPull({ model: name, status: 'done', pct: 100, error: null });
            onMessage?.({ type: 'success', text: `${name} downloaded — assign it to a tier under Chat Models.` });
            onChanged?.();
        } else {
            setPull({ model: name, status: 'failed', pct: null, error: result.error });
        }
    };

    return (
        <div className="p-3 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{provider.name}</span>
                <ProviderStatusPill tone="blue">{runtime.label || provider.type}</ProviderStatusPill>
                {isEnvManaged && <ProviderStatusPill tone="orange">from environment</ProviderStatusPill>}
                <span className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>{provider.url}</span>
                <div className="flex-1" />
                <button className={BTN_GHOST} style={{ color: 'var(--text-muted)' }} disabled={testing} onClick={runTest}>
                    {testing ? 'Testing…' : 'Test'}
                </button>
                {runtime.canPull && (
                    <button
                        className={BTN_GHOST}
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => { setPullOpen(o => !o); setPullInput(''); }}
                    >
                        {pullOpen ? 'Close' : '↓ Add model'}
                    </button>
                )}
                <DeleteConfirmButtons
                    size="xs"
                    label="🗑️"
                    title="Disconnect this runtime"
                    onConfirm={() => onRemove(provider.id)}
                />
            </div>

            {isEnvManaged && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Declared by an environment variable, so it is recreated on restart. Remove the variable to disconnect it permanently.
                </p>
            )}

            <ProbeResult result={probe} />

            {pullOpen && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-default)' }}>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                        Pick a starter model, or enter any tag from the Ollama library.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mb-3">
                        {starterModels.map(m => (
                            <button
                                key={m.model}
                                onClick={() => download(m.model)}
                                disabled={downloading}
                                className="text-left px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/5 disabled:opacity-50"
                                style={{ background: 'var(--bg-tertiary)' }}
                            >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                                    {m.tier && <ProviderStatusPill tone="blue">{TIER_LABELS[m.tier] || m.tier}</ProviderStatusPill>}
                                    <span style={{ color: 'var(--text-muted)' }}>{m.vram}</span>
                                </div>
                                <div style={{ color: 'var(--text-muted)' }}>{m.note}</div>
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={pullInput}
                            onChange={e => setPullInput(e.target.value)}
                            placeholder="e.g. qwen3:14b or hf.co/unsloth/gpt-oss-20b-GGUF:Q4_K_M"
                            className={PROVIDER_INPUT_CLS}
                            style={PROVIDER_INPUT_STYLE}
                        />
                        <button className={BTN_PRIMARY} disabled={!pullInput.trim() || downloading} onClick={() => download(pullInput)}>
                            Download
                        </button>
                    </div>
                </div>
            )}

            {pull && (
                <div className="mt-2">
                    <div className="flex items-center justify-between text-xs gap-2" style={{ color: 'var(--text-muted)' }}>
                        <span className="truncate">{pull.model} — {pull.error || pull.status}</span>
                        {pull.pct !== null && <span>{pull.pct}%</span>}
                    </div>
                    {pull.pct !== null && !pull.error && (
                        <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                            <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pull.pct}%`, background: 'var(--accent-primary)' }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RuntimeRow;
