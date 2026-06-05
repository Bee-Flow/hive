import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Plus, Trash2, Link2, CheckCircle2, AlertCircle, Save, BookOpen } from 'lucide-react';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import useTranslation from '../../../../hooks/useTranslation';

const REPLY_MODE_IDS = ['draft', 'auto_confident', 'autonomous'];

/**
 * Support settings — connect/disconnect mailboxes and configure each inbox's
 * agent, knowledge bases, reply mode, threshold, signature and the resolved-
 * tickets → knowledge-base ingestion automation.
 */
export default function SettingsPanel({ inboxes, onChanged }) {
    const { t } = useTranslation();
    const [agents, setAgents] = useState([]);
    const [kbs, setKbs] = useState([]);
    const [creating, setCreating] = useState(false);
    const [newProvider, setNewProvider] = useState('gmail');
    const [newName, setNewName] = useState('');

    useEffect(() => {
        authFetch(`${API_BASE}/agents/all`).then(r => r.ok ? r.json() : []).then(d => setAgents(Array.isArray(d) ? d : [])).catch(() => {});
        authFetch(`${API_BASE}/api/kb`).then(r => r.ok ? r.json() : []).then(d => setKbs(Array.isArray(d) ? d : (d.kbs || []))).catch(() => {});
    }, []);

    const onKbCreated = useCallback((kb) => {
        if (kb && kb.id) setKbs(list => (list.some(x => x.id === kb.id) ? list : [...list, kb]));
    }, []);

    const createInbox = async () => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: newProvider, displayName: newName || `${newProvider} inbox` }),
        });
        if (res.ok) { setCreating(false); setNewName(''); onChanged?.(); }
        else { const d = await res.json().catch(() => ({})); window.alert(d.error || t('support.settings.create_failed', 'Could not create mailbox')); }
    };

    return (
        <div className="p-6 max-w-3xl mx-auto flex flex-col gap-5">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">{t('support.settings.title', 'Support inboxes')}</h2>
                <button
                    onClick={() => setCreating(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded text-white font-medium"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    <Plus size={13} /> {t('support.settings.add_mailbox', 'Add mailbox')}
                </button>
            </div>

            {creating && (
                <div className="rounded-lg border border-[var(--border-default)] p-4 flex flex-col gap-3 bg-[var(--bg-secondary)]">
                    <div className="flex gap-3">
                        <select value={newProvider} onChange={e => setNewProvider(e.target.value)}
                            className="text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5">
                            <option value="gmail">Gmail</option>
                            <option value="outlook">Outlook</option>
                        </select>
                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('support.settings.display_name_placeholder', 'Display name (e.g. Support)')}
                            className="flex-1 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5" />
                        <button onClick={createInbox} className="px-3 py-1.5 text-xs rounded text-white font-medium" style={{ background: 'var(--accent-primary)' }}>
                            {t('support.common.create', 'Create')}
                        </button>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">{t('support.settings.connect_hint', 'After creating, click “Connect” to link the mailbox via OAuth.')}</p>
                </div>
            )}

            {inboxes.length === 0 && !creating && (
                <div className="text-sm text-[var(--text-tertiary)] italic">{t('support.settings.no_mailbox', 'No mailbox connected yet.')}</div>
            )}

            {inboxes.map(inbox => (
                <InboxCard key={inbox.id} inbox={inbox} agents={agents} kbs={kbs} onChanged={onChanged} onKbCreated={onKbCreated} />
            ))}
        </div>
    );
}

function InboxCard({ inbox, agents, kbs, onChanged, onKbCreated }) {
    const { t } = useTranslation();
    const REPLY_MODES = REPLY_MODE_IDS.map(id => ({
        id,
        label: t(`support.reply_mode.${id}`, id),
        hint: t(`support.reply_mode.${id}_hint`, ''),
    }));
    const orgKbs = kbs.filter(kb => !kb.organization_id || !inbox.organization_id || kb.organization_id === inbox.organization_id);

    const [form, setForm] = useState({
        display_name: inbox.display_name || '',
        default_agent_id: inbox.default_agent_id || '',
        kb_ids: Array.isArray(inbox.kb_ids) ? inbox.kb_ids : [],
        reply_mode: inbox.reply_mode || 'draft',
        autoresolve_threshold: inbox.autoresolve_threshold ?? 0.78,
        tools_enabled: !!inbox.tools_enabled,
        signature: inbox.signature || '',
    });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // ── Knowledge ingestion (resolved tickets → KB) ──
    const [kbEnabled, setKbEnabled] = useState(!!inbox.kb_ingest_enabled);
    const [kbIngestKbId, setKbIngestKbId] = useState(inbox.kb_ingest_kb_id || '');
    const [routineId, setRoutineId] = useState(inbox.kb_ingest_routine_id || null);
    const [newKbName, setNewKbName] = useState('');
    const [kbBusy, setKbBusy] = useState(false);
    const [kbStatus, setKbStatus] = useState('');

    const connect = useCallback(async () => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}/oauth/start`);
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.url) { window.alert(d.error || t('support.settings.connect_failed', 'Could not connect')); return; }
        const popup = window.open(d.url, 'support-mailbox-oauth', 'width=520,height=680');
        const onMsg = (ev) => {
            if (ev?.data && typeof ev.data === 'string' && ev.data.includes('support-mailbox-oauth')) {
                window.removeEventListener('message', onMsg);
                try { popup && popup.close(); } catch (_) {}
                setTimeout(() => onChanged?.(), 600);
            }
        };
        window.addEventListener('message', onMsg);
    }, [inbox.id, onChanged, t]);

    const save = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    display_name: form.display_name,
                    default_agent_id: form.default_agent_id || null,
                    kb_ids: form.kb_ids,
                    reply_mode: form.reply_mode,
                    autoresolve_threshold: Number(form.autoresolve_threshold),
                    tools_enabled: form.tools_enabled,
                    signature: form.signature,
                }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(d.error || t('support.common.save_failed', 'Save failed')); }
            else onChanged?.();
        } finally { setSaving(false); }
    };

    const remove = async () => {
        if (!window.confirm(t('support.settings.remove_confirm', 'Disconnect and delete mailbox "{name}"?', { name: inbox.display_name || inbox.email_address }))) return;
        const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}`, { method: 'DELETE' });
        if (res.ok) onChanged?.();
    };

    const toggleKb = (id) => set('kb_ids', form.kb_ids.includes(id) ? form.kb_ids.filter(x => x !== id) : [...form.kb_ids, id]);

    const createKb = async () => {
        const name = newKbName.trim();
        if (!name) return;
        setKbBusy(true); setKbStatus('');
        try {
            const res = await authFetch(`${API_BASE}/api/kb`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, organizationId: inbox.organization_id }),
            });
            const kb = await res.json().catch(() => ({}));
            if (!res.ok || !kb.id) { setKbStatus(kb.error || t('support.kb_ingest.create_failed', 'Could not create knowledge base')); return; }
            onKbCreated?.(kb);
            setKbIngestKbId(kb.id);
            setNewKbName('');
        } finally { setKbBusy(false); }
    };

    const saveKbIngestion = async () => {
        if (kbEnabled && !kbIngestKbId) { setKbStatus(t('support.kb_ingest.kb_required', 'Pick or create a knowledge base first.')); return; }
        setKbBusy(true); setKbStatus('');
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}/kb-automation`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: kbEnabled, knowledgeBaseId: kbEnabled ? kbIngestKbId : null }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) { setKbStatus(d.error || t('support.kb_ingest.save_failed', 'Could not save knowledge ingestion')); return; }
            setRoutineId(d.routineId || (kbEnabled ? routineId : null));
            setKbStatus(t('support.kb_ingest.saved', 'Knowledge ingestion saved.'));
            onChanged?.();
        } finally { setKbBusy(false); }
    };

    return (
        <div className="rounded-lg border border-[var(--border-default)] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Mail size={16} className="text-[var(--text-secondary)]" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                        {inbox.email_address || inbox.display_name || `${inbox.provider} inbox`}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">{inbox.provider}</span>
                    {inbox.connected
                        ? <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400"><CheckCircle2 size={12} /> {t('support.settings.connected', 'Connected')}</span>
                        : <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"><AlertCircle size={12} /> {t('support.settings.not_connected', 'Not connected')}</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={connect} className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)]">
                        <Link2 size={12} /> {inbox.connected ? t('support.settings.reconnect', 'Reconnect') : t('support.settings.connect', 'Connect')}
                    </button>
                    <button onClick={remove} className="p-1.5 rounded text-red-500 hover:bg-red-500/10" title={t('support.common.delete', 'Delete')}><Trash2 size={13} /></button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                    {t('support.settings.display_name', 'Display name')}
                    <input value={form.display_name} onChange={e => set('display_name', e.target.value)}
                        className="text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                    {t('support.settings.reply_agent', 'Reply agent')}
                    <select value={form.default_agent_id} onChange={e => set('default_agent_id', e.target.value)}
                        className="text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5">
                        <option value="">{t('support.common.none', '— none —')}</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </label>
            </div>

            <div className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                {t('support.settings.knowledge_bases', 'Knowledge bases')}
                <div className="flex flex-wrap gap-1.5">
                    {orgKbs.length === 0 && <span className="text-[var(--text-tertiary)] italic">{t('support.settings.no_kbs', 'No knowledge bases available.')}</span>}
                    {orgKbs.map(kb => (
                        <button key={kb.id} onClick={() => toggleKb(kb.id)}
                            className={`text-xs px-2 py-1 rounded border ${form.kb_ids.includes(kb.id)
                                ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                : 'border-[var(--border-default)] text-[var(--text-secondary)]'}`}>
                            {kb.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                {t('support.settings.reply_mode', 'Reply mode')}
                <div className="flex flex-col gap-1.5">
                    {REPLY_MODES.map(m => (
                        <label key={m.id} className="flex items-start gap-2 cursor-pointer">
                            <input type="radio" name={`mode-${inbox.id}`} checked={form.reply_mode === m.id} onChange={() => set('reply_mode', m.id)} className="mt-0.5" />
                            <span><span className="text-[var(--text-primary)]">{m.label}</span> <span className="text-[var(--text-tertiary)]">— {m.hint}</span></span>
                        </label>
                    ))}
                </div>
            </div>

            {form.reply_mode === 'auto_confident' && (
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    {t('support.settings.threshold', 'Confidence threshold (0–1)')}
                    <input type="number" min="0" max="1" step="0.01" value={form.autoresolve_threshold}
                        onChange={e => set('autoresolve_threshold', e.target.value)}
                        className="w-20 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1" />
                </label>
            )}

            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input type="checkbox" checked={form.tools_enabled} onChange={e => set('tools_enabled', e.target.checked)} />
                {t('support.settings.tools_enabled', 'Give the agent access to read-only support tools (look up customer/subscription)')}
            </label>

            <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                {t('support.settings.signature_label', 'Custom signature (HTML, optional — appended to every reply)')}
                <textarea value={form.signature} onChange={e => set('signature', e.target.value)} rows={2}
                    placeholder={t('support.settings.signature_placeholder', 'e.g. <strong>Support Team</strong><br>Bee Flow B.V. · info@beeflow.nl')}
                    className="text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5 font-mono" />
                <span className="text-[11px] text-[var(--text-tertiary)]">
                    {t('support.settings.signature_help', 'AI replies automatically get a clear AI disclaimer at the bottom (“drafted automatically by our AI assistant”). This field is for your own branding above it.')}
                </span>
            </label>

            <div className="flex justify-end">
                <button onClick={save} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-60"
                    style={{ background: 'var(--accent-primary)' }}>
                    <Save size={13} /> {saving ? t('support.common.saving', 'Saving…') : t('support.common.save', 'Save')}
                </button>
            </div>

            {/* ── Knowledge ingestion ── */}
            <div className="mt-1 pt-3 border-t border-[var(--border-default)] flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                    <BookOpen size={14} className="text-[var(--text-secondary)]" /> {t('support.kb_ingest.section_title', 'Knowledge ingestion')}
                </div>
                <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                    <input type="checkbox" checked={kbEnabled} onChange={e => setKbEnabled(e.target.checked)} className="mt-0.5" />
                    <span>{t('support.kb_ingest.enable', 'Turn resolved tickets into knowledge-base articles')}</span>
                </label>
                {kbEnabled && (
                    <div className="flex flex-col gap-2 pl-6">
                        <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
                            {t('support.kb_ingest.choose_kb', 'Knowledge base')}
                            <select value={kbIngestKbId} onChange={e => setKbIngestKbId(e.target.value)}
                                className="text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5">
                                <option value="">{t('support.kb_ingest.none', 'Choose a knowledge base…')}</option>
                                {orgKbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}
                            </select>
                        </label>
                        <div className="flex items-center gap-2">
                            <input value={newKbName} onChange={e => setNewKbName(e.target.value)} placeholder={t('support.kb_ingest.new_kb_placeholder', 'New knowledge base name')}
                                className="flex-1 text-sm rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1.5" />
                            <button onClick={createKb} disabled={kbBusy || !newKbName.trim()}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">
                                <Plus size={12} /> {t('support.kb_ingest.create_new', 'Create new KB')}
                            </button>
                        </div>
                        {routineId && (
                            <span className="text-[11px] text-green-600 dark:text-green-400">{t('support.kb_ingest.routine_active', 'Automation active — resolved tickets are distilled into this knowledge base.')}</span>
                        )}
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[var(--text-tertiary)]">{kbStatus}</span>
                    <button onClick={saveKbIngestion} disabled={kbBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded text-white font-medium disabled:opacity-60"
                        style={{ background: 'var(--accent-primary)' }}>
                        <Save size={13} /> {kbBusy ? t('support.common.saving', 'Saving…') : t('support.common.save', 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
