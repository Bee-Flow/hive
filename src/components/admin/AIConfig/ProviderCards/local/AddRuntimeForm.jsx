// Manual "connect a runtime" form: runtime type, display name, address and an
// optional API key (vLLM and llama.cpp can be started with --api-key; Ollama
// and LM Studio have none). Test before connecting, so a typo is caught here
// rather than as an empty model list two screens later.

import React, { useState } from 'react';
import { BTN_PRIMARY, BTN_GHOST, testRuntime } from './localRuntimeApi';
import ProbeResult from './ProbeResult';
import { PROVIDER_INPUT_CLS, PROVIDER_INPUT_STYLE } from '../shared/ProviderCardShell';

const AddRuntimeForm = ({ runtimes, saving, onConnect }) => {
    const first = runtimes[0] || {};
    const [form, setForm] = useState({
        type: first.type || 'ollama',
        name: first.label || '',
        url: first.defaultUrl || '',
        apiKey: '',
    });
    const [probe, setProbe] = useState(null);
    const [testing, setTesting] = useState(false);

    const runtimeFor = (type) => runtimes.find(r => r.type === type) || {};
    const current = runtimeFor(form.type);

    const changeType = (type) => {
        const next = runtimeFor(type);
        const prev = runtimeFor(form.type);
        setProbe(null);
        setForm(f => ({
            ...f,
            type,
            // Only replace name/url while they still hold the previous preset's
            // defaults — never clobber something the admin typed.
            name: !f.name || f.name === prev.label ? (next.label || type) : f.name,
            url: !f.url || f.url === prev.defaultUrl ? (next.defaultUrl || '') : f.url,
        }));
    };

    const runTest = async () => {
        setTesting(true);
        setProbe(await testRuntime({ type: form.type, url: form.url.trim(), apiKey: form.apiKey }));
        setTesting(false);
    };

    return (
        <div className="p-3 rounded-lg border space-y-2" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <select
                    value={form.type}
                    onChange={e => changeType(e.target.value)}
                    className={PROVIDER_INPUT_CLS}
                    style={PROVIDER_INPUT_STYLE}
                >
                    {runtimes.map(r => <option key={r.type} value={r.type}>{r.label}</option>)}
                </select>
                <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Display name (e.g. GPU box)"
                    className={PROVIDER_INPUT_CLS}
                    style={PROVIDER_INPUT_STYLE}
                />
            </div>

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{current.description}</p>

            <input
                type="text"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder={current.defaultUrl || 'http://localhost:8000/v1'}
                className={PROVIDER_INPUT_CLS}
                style={PROVIDER_INPUT_STYLE}
            />
            <input
                type="password"
                value={form.apiKey}
                onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                placeholder="API key — only if you started the server with one (optional)"
                className={PROVIDER_INPUT_CLS}
                style={PROVIDER_INPUT_STYLE}
            />

            <div className="flex gap-2 items-center flex-wrap">
                <button
                    className={BTN_GHOST}
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
                    disabled={!form.url.trim() || testing}
                    onClick={runTest}
                >
                    {testing ? 'Testing…' : 'Test connection'}
                </button>
                <button
                    className={BTN_PRIMARY}
                    disabled={!form.url.trim() || saving}
                    onClick={() => onConnect({ ...form, url: form.url.trim(), name: form.name || current.label || form.type })}
                >
                    {saving ? 'Connecting…' : 'Connect'}
                </button>
                {current.docsUrl && (
                    <a href={current.docsUrl} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: 'var(--text-muted)' }}>
                        {current.label} docs
                    </a>
                )}
            </div>

            <ProbeResult result={probe} />
        </div>
    );
};

export default AddRuntimeForm;
