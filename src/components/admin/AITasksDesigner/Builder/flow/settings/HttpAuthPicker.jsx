import { Loader2, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { inputClass, FormRow } from './formPrimitives';
import useAutomationApi from '../../../../../../hooks/useAutomationApi';
import { HTTP_AUTH_TYPES, HTTP_AUTH_TYPE_BY_ID, httpKindName, splitHttpAuthValues, missingHttpAuthFields } from '../../../../../../utils/httpCredentialTypes';

/**
 * Credential picker for the http_request step's Authentication section.
 * Mirrors TicketAssistantConnectionPicker (triggerFilters.jsx): lazy-loads
 * the accessible HTTP credentials once on mount, falls back to a free-text
 * connection-id input on fetch error. Also hosts an inline "+ Add credential"
 * mini-form so the user never has to leave the builder to save a secret.
 *
 * `value` is the selected connectionId (or ''); `onChange` receives the new
 * id, or null when "None" is picked.
 */
export default function HttpAuthPicker({ value, onChange }) {
    const api = useAutomationApi();
    const [conns, setConns] = useState(null); // null = loading; array = loaded
    const [error, setError] = useState(null);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        let alive = true;
        api.listHttpConnections()
            .then(d => { if (alive) setConns(d.connections || []); })
            .catch(e => { if (alive) setError(e.message || 'Failed to load credentials'); });
        return () => { alive = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) {
        // Degraded mode: the list route failed (older server / network) —
        // let the user still paste a credential id they know.
        return (
            <div>
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    placeholder="credential id"
                    className={inputClass() + ' font-mono'}
                />
                <div className="text-xs text-[var(--text-tertiary)] mt-1">Could not load your credentials — paste a credential id instead.</div>
            </div>
        );
    }
    if (conns === null) {
        return <div className="text-xs text-[var(--text-tertiary)] py-1.5">Loading credentials…</div>;
    }

    const known = !value || conns.some(c => c.id === value);

    return (
        <div className="space-y-2">
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                className={inputClass()}
            >
                <option value="">None (no credential)</option>
                {!known && (
                    <option value={value} disabled>Unknown credential (not accessible) — pick another</option>
                )}
                {conns.map(c => (
                    <option key={c.id} value={c.id}>
                        {c.label} — {httpKindName(c.kind)}{c.access === 'lent' ? ' (shared with you)' : ''}
                    </option>
                ))}
            </select>
            <div className="text-xs text-[var(--text-tertiary)]">
                The secret is stored encrypted in your organization's vault and injected at run time.
                It is never shown here and never stored in the flow.
            </div>
            {adding ? (
                <InlineCredentialForm
                    api={api}
                    onCreated={(connection) => {
                        setConns(prev => [...(prev || []), { ...connection, access: 'own' }]);
                        onChange(connection.id);
                        setAdding(false);
                    }}
                    onCancel={() => setAdding(false)}
                />
            ) : (
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80 transition"
                    >
                        <Plus size={12} /> Add credential
                    </button>
                    <a
                        href="/app/settings/integrations"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--text-tertiary)] underline hover:text-[var(--text-secondary)] transition"
                    >
                        Manage credentials in Settings
                    </a>
                </div>
            )}
        </div>
    );
}

function InlineCredentialForm({ api, onCreated, onCancel }) {
    const [label, setLabel] = useState('');
    const [typeId, setTypeId] = useState(HTTP_AUTH_TYPES[0].id);
    const [values, setValues] = useState({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    const authType = HTTP_AUTH_TYPE_BY_ID[typeId];

    const submit = async () => {
        if (missingHttpAuthFields(authType, values).length > 0) {
            setErr('Fill in all required fields');
            return;
        }
        setBusy(true); setErr(null);
        try {
            const { secret, secretMeta } = splitHttpAuthValues(authType, values);
            const body = { provider: 'http', kind: authType.kind, label: label.trim() || authType.name, secret };
            if (Object.keys(secretMeta).length > 0) body.secretMeta = secretMeta;
            const d = await api.createHttpConnection(body);
            onCreated(d.connection);
        } catch (e) {
            setErr(e.message || 'Could not create credential');
            setBusy(false);
        }
    };

    return (
        <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-3">
            <FormRow label="Name">
                <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={`e.g. "${authType.name} – Production"`}
                    className={inputClass()}
                />
            </FormRow>
            <FormRow label="Auth type">
                <select
                    value={typeId}
                    onChange={(e) => { setTypeId(e.target.value); setValues({}); }}
                    className={inputClass()}
                >
                    {HTTP_AUTH_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
            </FormRow>
            {authType.fields.map(f => (
                <FormRow key={f.key} label={f.label}>
                    <input
                        type={f.type}
                        value={values[f.key] || ''}
                        onChange={(e) => setValues(s => ({ ...s, [f.key]: e.target.value }))}
                        autoComplete="off"
                        className={inputClass()}
                    />
                </FormRow>
            ))}
            {err && <div className="text-xs text-red-600 dark:text-red-400">{err}</div>}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded bg-[var(--accent)] text-white disabled:opacity-40"
                >
                    {busy ? <Loader2 size={12} className="animate-spin" /> : null} Save credential
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs px-2.5 py-1.5 rounded border border-[var(--border-default)] text-[var(--text-tertiary)]"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
