import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import Section from '../../../shared/Section';
import FormField from '../../../shared/FormField';
import { INPUT_FIELD, PRIMARY_BTN, PRIMARY_BTN_STYLE } from './supportStyles';

/**
 * TemplatesTab — organisation-wide tag taxonomy + canned replies. All reads and
 * writes hit the tenant /api/support-inbox/* namespace (org-scoped), so a tenant
 * manages its own taxonomy without touching the super-admin company inbox.
 */
export default function TemplatesTab() {
    return (
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
            <Tags />
            <Canned />
        </div>
    );
}

function Tags() {
    const { t } = useTranslation();
    const [tags, setTags] = useState([]);
    const [name, setName] = useState('');
    const [color, setColor] = useState('#64748b');
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/tags`);
        if (res.ok) setTags((await res.json()).tags || []);
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!name.trim()) return;
        setError(null);
        const res = await authFetch(`${API_BASE}/api/support-inbox/tags`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), color }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || 'Create failed'); return; }
        setName(''); await load();
    };
    const remove = async (id) => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/tags/${id}`, { method: 'DELETE' });
        if (res.ok) await load();
    };

    return (
        <Section padded title={t('support.tags.title', 'Tags')} description={t('support.tags.desc', 'The catalogue of tags the AI may auto-assign and staff can apply to tickets.')}>
            {error && <div className="text-xs mb-3 px-3 py-2 rounded text-rose-600 bg-rose-500/10">{error}</div>}
            <div className="flex items-center gap-2 mb-4">
                <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder={t('support.tags.new', 'New tag name')} className={`${INPUT_FIELD} flex-1`} />
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-9 h-9 rounded border border-[var(--border-default)]" />
                <button onClick={create} disabled={!name.trim()} className={PRIMARY_BTN} style={PRIMARY_BTN_STYLE}><Plus size={14} /> {t('support.common.add', 'Add')}</button>
            </div>
            <div className="flex flex-wrap gap-2">
                {tags.length === 0 && <div className="text-xs text-[var(--text-muted)]">{t('support.tags.empty', 'No tags yet.')}</div>}
                {tags.map(tg => (
                    <span key={tg.id} className="text-sm px-2 py-1 rounded inline-flex items-center gap-1.5 border border-[var(--border-default)] text-[var(--text-secondary)]">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: tg.color || '#64748b' }} />
                        #{tg.name}
                        {tg.organization_id == null && <span className="text-xs text-[var(--text-muted)]">({t('support.tags.system', 'system')})</span>}
                        {tg.organization_id != null && <button onClick={() => remove(tg.id)} className="opacity-60 hover:opacity-100 text-rose-600"><Trash2 className="w-3 h-3" /></button>}
                    </span>
                ))}
            </div>
        </Section>
    );
}

function Canned() {
    const { t } = useTranslation();
    const [items, setItems] = useState([]);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ title: '', shortcut: '', body: '' });
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/canned`);
        if (res.ok) setItems((await res.json()).canned || []);
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!form.title.trim() || !form.body.trim()) { setError(t('support.canned.required', 'Title and body are required.')); return; }
        setError(null);
        const res = await authFetch(`${API_BASE}/api/support-inbox/canned`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: form.title.trim(), shortcut: form.shortcut.trim() || null, body: form.body }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || 'Create failed'); return; }
        setForm({ title: '', shortcut: '', body: '' }); setAdding(false); await load();
    };
    const remove = async (id) => {
        const res = await authFetch(`${API_BASE}/api/support-inbox/canned/${id}`, { method: 'DELETE' });
        if (res.ok) await load();
    };

    return (
        <Section padded title={t('support.canned.title', 'Canned replies')} description={t('support.canned.desc', 'Reusable reply templates your team can insert in one click.')}
            actions={<button onClick={() => setAdding(v => !v)} className={PRIMARY_BTN} style={PRIMARY_BTN_STYLE}><Plus size={14} /> {t('support.common.add', 'Add')}</button>}>
            {error && <div className="text-xs mb-3 px-3 py-2 rounded text-rose-600 bg-rose-500/10">{error}</div>}
            {adding && (
                <div className="space-y-3 mb-4 p-3 rounded-lg border border-[var(--border-default)]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField label={t('support.canned.title_label', 'Title')}>
                            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={INPUT_FIELD} />
                        </FormField>
                        <FormField label={t('support.canned.shortcut', 'Shortcut (optional)')}>
                            <input value={form.shortcut} onChange={e => setForm(f => ({ ...f, shortcut: e.target.value }))} className={INPUT_FIELD} placeholder="/refund" />
                        </FormField>
                    </div>
                    <FormField label={t('support.canned.body', 'Body')}>
                        <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} className={`${INPUT_FIELD} resize-y`} />
                    </FormField>
                    <div className="flex justify-end">
                        <button onClick={create} className={PRIMARY_BTN} style={PRIMARY_BTN_STYLE}>{t('support.common.create', 'Create')}</button>
                    </div>
                </div>
            )}
            <div className="space-y-2">
                {items.length === 0 && <div className="text-xs text-[var(--text-muted)]">{t('support.canned.empty', 'No canned replies yet.')}</div>}
                {items.map(c => (
                    <div key={c.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border-default)]">
                        <div className="min-w-0">
                            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{c.title}{c.shortcut ? ` · ${c.shortcut}` : ''}</div>
                            <div className="text-xs text-[var(--text-tertiary)] line-clamp-2">{c.body}</div>
                        </div>
                        {c.organization_id != null && <button onClick={() => remove(c.id)} className="opacity-60 hover:opacity-100 text-rose-600 shrink-0"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                ))}
            </div>
        </Section>
    );
}
