import React, { useState } from 'react';
import { Plus, Loader2, XCircle, Info, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../../utils/helpers';
import ProviderIcon from './ProviderIcon';

// ──────────────────────────────────────────────────────────────
// Per-provider credential forms
//   - Gmail / Outlook rely on the current browser session's OAuth token,
//     so the form is a session-state note.
//   - Ticket providers (Jira, Freshservice, Zendesk, ServiceNow, TopDesk)
//     collect API-token / Basic-auth credentials in-form and validate
//     them against POST /api/ticket-assistant/connections/test before
//     the connection is created.
// ──────────────────────────────────────────────────────────────

const CONFIG_SCHEMAS = {
    gmail: {
        kind: 'oauth',
        label: 'Gmail',
        description: 'Uses your current Google sign-in session to access Gmail.',
    },
    outlook: {
        kind: 'oauth',
        label: 'Outlook',
        description: 'Uses your current Microsoft sign-in session to access Outlook.',
    },
    jira: {
        kind: 'form',
        label: 'Jira Service Management',
        description: 'API token auth — no OAuth app needed.',
        fields: [
            { name: 'siteUrl', label: 'Site URL', placeholder: 'https://acme.atlassian.net', required: true },
            { name: 'email', label: 'Atlassian email', placeholder: 'you@acme.com', required: true },
            { name: 'token', label: 'API token', placeholder: 'ATATT3xFf...', required: true, secret: true, hint: 'Create at id.atlassian.com → Security → API tokens.' },
            { name: 'projectKeys', label: 'Project keys', placeholder: 'PROJ, HELP', required: true, hint: 'Comma-separated.' },
            { name: 'jql', label: 'Extra JQL (optional)', placeholder: 'resolution != Unresolved' },
        ],
    },
    freshservice: {
        kind: 'form',
        label: 'Freshservice',
        description: 'API key auth.',
        fields: [
            { name: 'domain', label: 'Domain', placeholder: 'acme.freshservice.com', required: true },
            { name: 'apiKey', label: 'API key', placeholder: 'xxx', required: true, secret: true, hint: 'Profile → API Key in Freshservice.' },
        ],
    },
    zendesk: {
        kind: 'form',
        label: 'Zendesk',
        description: 'Email + API token via Basic Auth. Minimum sync interval 5 min (Zendesk limit).',
        fields: [
            { name: 'subdomain', label: 'Subdomain', placeholder: 'acme (without .zendesk.com)', required: true },
            { name: 'email', label: 'Agent email', placeholder: 'you@acme.com', required: true },
            { name: 'apiToken', label: 'API token', placeholder: 'xxx', required: true, secret: true, hint: 'Admin Center → Apps & integrations → Zendesk API.' },
        ],
    },
    servicenow: {
        kind: 'form',
        label: 'ServiceNow',
        description: 'Username + password via Basic Auth. Works against Personal Developer Instance out-of-box.',
        fields: [
            { name: 'instance', label: 'Instance', placeholder: 'dev12345 (or full URL)', required: true },
            { name: 'username', label: 'Username', placeholder: 'admin', required: true },
            { name: 'password', label: 'Password', placeholder: '•••••', required: true, secret: true },
        ],
    },
    topdesk: {
        kind: 'form',
        label: 'TopDesk',
        description: 'Operator login + application password. The TopDesk admin must enable REST API first.',
        fields: [
            { name: 'baseUrl', label: 'Base URL', placeholder: 'https://acme.topdesk.net', required: true },
            { name: 'username', label: 'Operator login', placeholder: 'firstname.lastname', required: true },
            { name: 'password', label: 'Application password', placeholder: '•••••', required: true, secret: true, hint: 'Not the operator\'s main password — a separate app password.' },
        ],
    },
};

const PROVIDERS_ORDER = ['gmail', 'outlook', 'jira', 'freshservice', 'zendesk', 'servicenow', 'topdesk'];

const ConnectMailboxModal = ({ onClose, onAdd, knowledgeBases, onKBCreated, oauthProvider, t }) => {
    const [step, setStep] = useState('pick'); // 'pick' | 'form'
    const [provider, setProvider] = useState('');
    const [kbId, setKbId] = useState(knowledgeBases?.[0]?.id || '');
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testOk, setTestOk] = useState(false);
    const [error, setError] = useState('');
    const [creatingKB, setCreatingKB] = useState(false);
    const [newKBName, setNewKBName] = useState('');
    const [credentials, setCredentials] = useState({});

    const canConnectOAuth = (p) =>
        (p === 'gmail' && oauthProvider === 'google')
        || (p === 'outlook' && oauthProvider === 'microsoft');

    const pickProvider = (p) => {
        setProvider(p);
        setCredentials({});
        setTestOk(false);
        setError('');
        setStep('form');
    };

    const setField = (name, value) => {
        setCredentials(c => ({ ...c, [name]: value }));
        setTestOk(false);
    };

    const buildCredsForSubmit = () => {
        const c = { ...credentials };
        if (c.projectKeys && typeof c.projectKeys === 'string') {
            c.projectKeys = c.projectKeys.split(',').map(s => s.trim()).filter(Boolean);
        }
        return c;
    };

    const handleTest = async () => {
        setTesting(true); setError(''); setTestOk(false);
        try {
            const res = await fetch(`${API_BASE}/api/ticket-assistant/connections/test`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, credentials: buildCredsForSubmit() }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
            setTestOk(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setTesting(false);
        }
    };

    const handleCreateKB = async () => {
        if (!newKBName.trim()) return;
        setLoading(true); setError('');
        try {
            const res = await fetch(`${API_BASE}/api/kb`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKBName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            setKbId(data.id);
            setCreatingKB(false);
            setNewKBName('');
            onKBCreated?.(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!provider || !kbId) return;
        setLoading(true); setError('');
        try {
            const schema = CONFIG_SCHEMAS[provider];
            const payload = { provider, knowledgeBaseId: kbId };
            if (schema.kind === 'form') payload.credentials = buildCredsForSubmit();
            await onAdd(payload);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const schema = provider ? CONFIG_SCHEMAS[provider] : null;
    const formValid = schema?.kind !== 'form' || schema.fields.every(f => !f.required || !!credentials[f.name]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-xl bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
                style={{ animation: 'emailKBModalIn .2s ease-out' }}>

                {step === 'pick' && (
                    <>
                        <div>
                            <h3 className="text-[17px] font-bold text-[var(--text-primary)]">{t('ticket_assistant.connect_modal_title')}</h3>
                            <p className="text-[12px] text-[var(--text-tertiary)] mt-1">{t('ticket_assistant.connect_modal_helper')}</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {PROVIDERS_ORDER.map(p => {
                                const s = CONFIG_SCHEMAS[p];
                                const disabled = s.kind === 'oauth' && !canConnectOAuth(p);
                                return (
                                    <button
                                        key={p}
                                        onClick={() => !disabled && pickProvider(p)}
                                        disabled={disabled}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                            disabled
                                                ? 'border-[var(--border-subtle)] opacity-40 cursor-not-allowed'
                                                : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-secondary)]'
                                        }`}
                                    >
                                        <ProviderIcon provider={p} size={32} />
                                        <span className="text-[12px] font-semibold text-[var(--text-primary)] text-center leading-tight">{s.label}</span>
                                        {disabled && <span className="text-[10px] text-[var(--text-tertiary)] text-center">sign-in required</span>}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button onClick={onClose}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all">
                                {t('ticket_assistant.cancel')}
                            </button>
                        </div>
                    </>
                )}

                {step === 'form' && schema && (
                    <>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { setStep('pick'); setProvider(''); setError(''); setTestOk(false); }}
                                className="p-1 rounded-lg hover:bg-[var(--bg-secondary)]">
                                <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                            <ProviderIcon provider={provider} size={24} />
                            <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{schema.label}</h3>
                        </div>
                        <p className="text-[12px] text-[var(--text-tertiary)]">{schema.description}</p>

                        {schema.kind === 'oauth' && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] text-[12px] text-[var(--text-secondary)]">
                                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span>Your current browser session's OAuth token will be used. No additional credentials needed.</span>
                            </div>
                        )}

                        {schema.kind === 'form' && (
                            <div className="space-y-3">
                                {schema.fields.map(f => (
                                    <div key={f.name}>
                                        <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1 block">
                                            {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                                        </label>
                                        <input
                                            type={f.secret ? 'password' : 'text'}
                                            value={credentials[f.name] || ''}
                                            onChange={e => setField(f.name, e.target.value)}
                                            placeholder={f.placeholder}
                                            autoComplete="off"
                                            className="w-full px-3 py-2 rounded-lg text-[13px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                                        />
                                        {f.hint && <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{f.hint}</p>}
                                    </div>
                                ))}
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        onClick={handleTest}
                                        disabled={testing || !formValid}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                                    >
                                        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : testOk ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : null}
                                        {testOk ? t('ticket_assistant.test_success') : t('ticket_assistant.test_connection')}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-[12px] font-medium text-[var(--text-secondary)] mb-1 block">{t('ticket_assistant.target_kb')}</label>
                            <p className="text-[11px] text-[var(--text-tertiary)] mb-2">{t('ticket_assistant.target_kb_desc')}</p>
                            {creatingKB ? (
                                <div className="flex gap-2">
                                    <input
                                        value={newKBName}
                                        onChange={e => setNewKBName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateKB()}
                                        placeholder="Knowledge base name…"
                                        autoFocus
                                        className="flex-1 px-3 py-2 rounded-lg text-[13px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                                    />
                                    <button onClick={handleCreateKB} disabled={!newKBName.trim() || loading}
                                        className="px-3 py-2 rounded-lg text-[12px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                                    </button>
                                    <button onClick={() => { setCreatingKB(false); setNewKBName(''); }}
                                        className="px-2 py-2 rounded-lg text-[12px] text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]">
                                        {t('ticket_assistant.cancel')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <select value={kbId} onChange={e => setKbId(e.target.value)}
                                        className="flex-1 px-3 py-2 rounded-lg text-[13px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                                        {(knowledgeBases || []).map(kb => (
                                            <option key={kb.id} value={kb.id}>{kb.name}</option>
                                        ))}
                                    </select>
                                    <button onClick={() => setCreatingKB(true)}
                                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 border border-[var(--border-subtle)] transition-all whitespace-nowrap">
                                        <Plus className="w-3.5 h-3.5" /> New
                                    </button>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                                <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <button onClick={onClose}
                                className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-all">
                                {t('ticket_assistant.cancel')}
                            </button>
                            <button onClick={handleSubmit} disabled={!kbId || loading || creatingKB || (schema.kind === 'form' && !formValid)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all">
                                {loading && !creatingKB ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Connect
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ConnectMailboxModal;
