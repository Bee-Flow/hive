import React, { useState, useCallback } from 'react';
import { Mail, Plus, Trash2, Link2, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import Section from '../../../shared/Section';
import FormField from '../../../shared/FormField';
import IconButton from '../../../shared/IconButton';
import EmptyState from '../../../shared/EmptyState';
import { INPUT_FIELD, PRIMARY_BTN, PRIMARY_BTN_STYLE, GHOST_BTN } from './supportStyles';

/**
 * InboxesTab — connect/disconnect mailboxes and edit each inbox's identity
 * (display name, reply agent, knowledge bases). Creating an inbox needs only a
 * provider + name; everything else has a sensible default so a new inbox works
 * the moment OAuth completes.
 */
export default function InboxesTab({ inboxes = [], agents = [], kbs = [], selectedInboxId, onSelectInbox, onChanged }) {
    const { t } = useTranslation();
    const [creating, setCreating] = useState(false);
    const [newProvider, setNewProvider] = useState('gmail');
    const [newName, setNewName] = useState('');

    const createInbox = async () => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: newProvider, displayName: newName || `${newProvider} inbox` }),
        });
        if (res.ok) { setCreating(false); setNewName(''); onChanged?.(); }
        else { const d = await res.json().catch(() => ({})); window.alert(d.error || t('support.settings.create_failed', 'Could not create mailbox')); }
    };

    return (
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('support.settings.title', 'Support inboxes')}</h3>
                <button onClick={() => setCreating(v => !v)} className={PRIMARY_BTN} style={PRIMARY_BTN_STYLE}>
                    <Plus size={14} /> {t('support.settings.add_mailbox', 'Add mailbox')}
                </button>
            </div>

            {creating && (
                <Section padded>
                    <div className="flex flex-wrap gap-3 items-center">
                        <select value={newProvider} onChange={e => setNewProvider(e.target.value)} className={`${INPUT_FIELD} w-auto`}>
                            <option value="gmail">Gmail</option>
                            <option value="outlook">Outlook</option>
                        </select>
                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('support.settings.display_name_placeholder', 'Display name (e.g. Support)')}
                            className={`${INPUT_FIELD} flex-1 min-w-[12rem]`} />
                        <button onClick={createInbox} className={PRIMARY_BTN} style={PRIMARY_BTN_STYLE}>{t('support.common.create', 'Create')}</button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">{t('support.settings.connect_hint', 'After creating, click “Connect” to link the mailbox via OAuth.')}</p>
                </Section>
            )}

            {inboxes.length === 0 && !creating && (
                <EmptyState icon={<Mail size={40} />}
                    title={t('support.settings.no_mailbox', 'No mailbox connected yet.')}
                    action={{ label: t('support.settings.add_mailbox', 'Add mailbox'), onClick: () => setCreating(true), icon: <Plus size={16} /> }} />
            )}

            {inboxes.map(inbox => (
                <InboxCard key={inbox.id} inbox={inbox} agents={agents} kbs={kbs}
                    selected={inbox.id === selectedInboxId} onSelect={() => onSelectInbox?.(inbox.id)} onChanged={onChanged} />
            ))}
        </div>
    );
}

function InboxCard({ inbox, agents, kbs, selected, onSelect, onChanged }) {
    const { t } = useTranslation();
    const orgKbs = kbs.filter(kb => !kb.organization_id || !inbox.organization_id || kb.organization_id === inbox.organization_id);
    const [form, setForm] = useState({
        display_name: inbox.display_name || '',
        default_agent_id: inbox.default_agent_id || '',
        kb_ids: Array.isArray(inbox.kb_ids) ? inbox.kb_ids : [],
    });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const toggleKb = (id) => set('kb_ids', form.kb_ids.includes(id) ? form.kb_ids.filter(x => x !== id) : [...form.kb_ids, id]);

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
                body: JSON.stringify({ display_name: form.display_name, default_agent_id: form.default_agent_id || null, kb_ids: form.kb_ids }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(d.error || t('support.common.save_failed', 'Save failed')); }
            else onChanged?.();
        } finally { setSaving(false); }
    };

    const remove = async () => {
        if (!window.confirm(t('support.settings.remove_confirm', 'Disconnect and delete mailbox?'))) return;
        const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}`, { method: 'DELETE' });
        if (res.ok) onChanged?.();
    };

    return (
        <Section padded className={selected ? 'ring-1 ring-[var(--accent-primary)]' : ''}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <button type="button" onClick={onSelect} className="flex items-center gap-2 min-w-0 text-left" title={t('support.settings.select_inbox', 'Configure this inbox')}>
                    <Mail size={16} className="text-[var(--text-secondary)] shrink-0" />
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{inbox.email_address || inbox.display_name || `${inbox.provider} inbox`}</span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">{inbox.provider}</span>
                    {inbox.connected
                        ? <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400"><CheckCircle2 size={12} /> {t('support.settings.connected', 'Connected')}</span>
                        : <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"><AlertCircle size={12} /> {t('support.settings.not_connected', 'Not connected')}</span>}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                    <button type="button" className={GHOST_BTN} onClick={connect}>
                        <Link2 size={12} /> {inbox.connected ? t('support.settings.reconnect', 'Reconnect') : t('support.settings.connect', 'Connect')}
                    </button>
                    <IconButton ariaLabel={t('support.common.delete', 'Delete')} variant="danger" onClick={remove}><Trash2 /></IconButton>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label={t('support.settings.display_name', 'Display name')}>
                        <input value={form.display_name} onChange={e => set('display_name', e.target.value)} className={INPUT_FIELD} />
                    </FormField>
                    <FormField label={t('support.settings.reply_agent', 'Reply agent')}>
                        <select value={form.default_agent_id} onChange={e => set('default_agent_id', e.target.value)} className={INPUT_FIELD}>
                            <option value="">{t('support.common.none', '— none —')}</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </FormField>
                </div>
                <FormField label={t('support.settings.knowledge_bases', 'Knowledge bases')} hint={t('support.settings.kb_hint', 'Optional — the agent grounds replies in these.')}>
                    <div className="flex flex-wrap gap-1.5">
                        {orgKbs.length === 0 && <span className="text-xs text-[var(--text-tertiary)] italic">{t('support.settings.no_kbs', 'No knowledge bases available.')}</span>}
                        {orgKbs.map(kb => (
                            <button key={kb.id} type="button" onClick={() => toggleKb(kb.id)}
                                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${form.kb_ids.includes(kb.id)
                                    ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                                {kb.name}
                            </button>
                        ))}
                    </div>
                </FormField>
                <div className="flex justify-end">
                    <button onClick={save} disabled={saving} className={PRIMARY_BTN} style={PRIMARY_BTN_STYLE}>
                        <Save size={14} /> {saving ? t('support.common.saving', 'Saving…') : t('support.common.save', 'Save')}
                    </button>
                </div>
            </div>
        </Section>
    );
}
