import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import useTranslation from '../../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../../utils/helpers';
import { getIntegrationById } from '../../../../config/integrationCatalog';
import Section from '../../../shared/Section';
import FormField from '../../../shared/FormField';
import ConfigToggle from '../../../shared/ConfigToggle';
import Slider from '../../../shared/Slider';
import Disclosure from '../../../shared/Disclosure';
import { INPUT_FIELD, PRIMARY_BTN, PRIMARY_BTN_STYLE } from './supportStyles';

const REPLY_MODE_IDS = ['draft', 'auto_confident', 'autonomous'];

/**
 * RepliesTab — how the AI answers for one inbox. Reply mode + signature are
 * always visible; power-user controls (AI tools, operator integrations,
 * non-support filtering) live behind a single "Advanced" disclosure to keep the
 * common case simple.
 */
export default function RepliesTab({ inbox, teammates = [], onChanged }) {
    const { t } = useTranslation();
    const REPLY_MODES = REPLY_MODE_IDS.map(id => ({ id, label: t(`support.reply_mode.${id}`, id), hint: t(`support.reply_mode.${id}_hint`, '') }));

    const [form, setForm] = useState(initForm(inbox));
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    useEffect(() => { setForm(initForm(inbox)); }, [inbox?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const [availableIntegrations, setAvailableIntegrations] = useState([]);
    const [intLoading, setIntLoading] = useState(false);
    useEffect(() => {
        const op = form.operator_user_id;
        if (!op || !inbox) { setAvailableIntegrations([]); return undefined; }
        let cancelled = false;
        setIntLoading(true);
        authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}/available-integrations?operator=${encodeURIComponent(op)}`)
            .then(r => r.ok ? r.json() : { integrations: [] })
            .then(d => { if (!cancelled) setAvailableIntegrations(Array.isArray(d.integrations) ? d.integrations : []); })
            .catch(() => { if (!cancelled) setAvailableIntegrations([]); })
            .finally(() => { if (!cancelled) setIntLoading(false); });
        return () => { cancelled = true; };
    }, [form.operator_user_id, inbox?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleToolId = (id) => set('enabled_tool_ids', form.enabled_tool_ids.includes(id) ? form.enabled_tool_ids.filter(x => x !== id) : [...form.enabled_tool_ids, id]);

    const save = async () => {
        if (!inbox) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/support-inbox/inboxes/${inbox.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reply_mode: form.reply_mode,
                    autoresolve_threshold: Number(form.autoresolve_threshold),
                    signature: form.signature,
                    enabled_tool_ids: form.enabled_tool_ids,
                    tools_enabled: form.enabled_tool_ids.includes('builtin:read'),
                    operator_user_id: form.operator_user_id || null,
                    classify_non_support_enabled: form.classify_non_support_enabled,
                    classify_sensitivity: Number(form.classify_sensitivity),
                    classify_suppress_autoreply: form.classify_suppress_autoreply,
                }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); window.alert(d.error || t('support.common.save_failed', 'Save failed')); }
            else onChanged?.();
        } finally { setSaving(false); }
    };

    if (!inbox) return null;

    return (
        <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
            <Section padded>
                <FormField label={t('support.settings.reply_mode', 'Reply mode')}>
                    <div className="space-y-1.5">
                        {REPLY_MODES.map(m => {
                            const active = form.reply_mode === m.id;
                            return (
                                <button key={m.id} type="button" onClick={() => set('reply_mode', m.id)}
                                    className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${active
                                        ? 'border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                        : 'border-[var(--border-default)] hover:bg-[var(--bg-secondary)]'}`}>
                                    <span className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${active ? 'border-[var(--accent-primary)]' : 'border-[var(--text-tertiary)]'}`}>
                                        {active && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)' }} />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm text-[var(--text-primary)]">{m.label}</span>
                                        {m.hint && <span className="block text-xs text-[var(--text-tertiary)] mt-0.5">{m.hint}</span>}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </FormField>
                {form.reply_mode === 'auto_confident' && (
                    <div className="mt-4">
                        <Slider label={t('support.settings.threshold', 'Confidence threshold (0–1)')} min={0} max={1} step={0.01}
                            value={Number(form.autoresolve_threshold)} onChange={(v) => set('autoresolve_threshold', v)} valueFormatter={(v) => v.toFixed(2)} />
                    </div>
                )}
            </Section>

            <Section padded>
                <FormField
                    label={t('support.settings.signature_label', 'Custom signature (HTML, optional — appended to every reply)')}
                    hint={t('support.settings.signature_help', 'AI replies automatically get a clear AI disclaimer at the bottom. This field is for your own branding above it.')}
                >
                    <textarea value={form.signature} onChange={e => set('signature', e.target.value)} rows={3}
                        placeholder={t('support.settings.signature_placeholder', 'e.g. <strong>Support Team</strong><br>Bee Flow B.V. · info@beeflow.nl')}
                        className={`${INPUT_FIELD} font-mono resize-y`} />
                </FormField>
            </Section>

            <Disclosure variant="card" title={t('support.settings.advanced', 'Advanced')}>
                <div className="space-y-4 pt-1">
                    {/* AI tools */}
                    <div className="space-y-1.5">
                        <div className="text-sm font-medium text-[var(--text-primary)]">{t('support.settings.tools_section', 'AI tools')}</div>
                        <ConfigToggle id={`tool-read-${inbox.id}`} checked={form.enabled_tool_ids.includes('builtin:read')} onChange={() => toggleToolId('builtin:read')}
                            label={t('support.settings.tools_read', 'Read-only lookups (customer, organization, subscription, knowledge base)')} />
                        <ConfigToggle id={`tool-action-${inbox.id}`} checked={form.enabled_tool_ids.includes('builtin:action')} onChange={() => toggleToolId('builtin:action')}
                            label={t('support.settings.tools_action', 'Ticket actions (set priority, tags, category, status, assignment, escalation)')} />
                        {form.enabled_tool_ids.includes('builtin:action') && (
                            <p className="text-[11px] text-[var(--text-tertiary)] px-1">
                                {t('support.settings.tools_action_help', 'How much the AI may do scales with the reply mode. The AI never emails the customer through a tool.')}
                            </p>
                        )}
                    </div>

                    {/* Operator integrations */}
                    <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                        <FormField label={t('support.settings.operator', 'Run integrations as')}
                            hint={t('support.settings.operator_help', 'The AI uses the integrations this person has connected, acting under their account. It never emails the customer through a tool.')}>
                            <select value={form.operator_user_id} onChange={e => set('operator_user_id', e.target.value)} className={INPUT_FIELD}>
                                <option value="">{t('support.settings.operator_none', '— no operator (integrations off) —')}</option>
                                {teammates.map(u => <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>)}
                            </select>
                        </FormField>
                        {form.operator_user_id && (
                            intLoading ? <span className="text-[11px] text-[var(--text-tertiary)] px-1">{t('support.common.loading', 'Loading…')}</span>
                                : availableIntegrations.length === 0 ? <span className="text-[11px] text-[var(--text-tertiary)] px-1">{t('support.settings.integration_none', 'This person has no integrations connected.')}</span>
                                    : (
                                        <div className="space-y-1.5">
                                            {availableIntegrations.map(id => {
                                                const tok = `integration:${id}`;
                                                const meta = getIntegrationById(id);
                                                return <ConfigToggle key={id} id={`int-${inbox.id}-${id}`} checked={form.enabled_tool_ids.includes(tok)} onChange={() => toggleToolId(tok)} label={meta?.label || id} description={meta?.description || undefined} />;
                                            })}
                                        </div>
                                    )
                        )}
                    </div>

                    {/* Non-support filtering */}
                    <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                        <ConfigToggle id={`classify-enable-${inbox.id}`} checked={form.classify_non_support_enabled} onChange={(v) => set('classify_non_support_enabled', v)}
                            label={t('support.settings.classify_enable', "Move email that isn't a customer support request out of the inbox")} />
                        {form.classify_non_support_enabled && (
                            <div className="space-y-3 pl-1">
                                <Slider label={t('support.settings.classify_sensitivity', 'Confidence to filter (0–1)')} min={0} max={1} step={0.01}
                                    value={Number(form.classify_sensitivity)} onChange={(v) => set('classify_sensitivity', v)} valueFormatter={(v) => v.toFixed(2)} />
                                <ConfigToggle id={`classify-suppress-${inbox.id}`} checked={form.classify_suppress_autoreply} onChange={(v) => set('classify_suppress_autoreply', v)}
                                    label={t('support.settings.classify_suppress', "Don't auto-reply to filtered (non-support) email")} />
                                <p className="text-[11px] text-[var(--text-tertiary)] px-1">{t('support.settings.classify_help', 'Filtered email is tagged and moved to a separate “Not support” view — never deleted.')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </Disclosure>

            <div className="flex justify-end">
                <button onClick={save} disabled={saving} className={PRIMARY_BTN} style={PRIMARY_BTN_STYLE}>
                    <Save size={14} /> {saving ? t('support.common.saving', 'Saving…') : t('support.common.save', 'Save')}
                </button>
            </div>
        </div>
    );
}

function initForm(inbox) {
    return {
        reply_mode: inbox?.reply_mode || 'draft',
        autoresolve_threshold: inbox?.autoresolve_threshold ?? 0.78,
        signature: inbox?.signature || '',
        enabled_tool_ids: Array.isArray(inbox?.enabled_tool_ids) && inbox.enabled_tool_ids.length
            ? inbox.enabled_tool_ids : (inbox?.tools_enabled ? ['builtin:read'] : []),
        operator_user_id: inbox?.operator_user_id || '',
        classify_non_support_enabled: !!inbox?.classify_non_support_enabled,
        classify_sensitivity: inbox?.classify_sensitivity ?? 0.85,
        classify_suppress_autoreply: inbox?.classify_suppress_autoreply !== false,
    };
}
