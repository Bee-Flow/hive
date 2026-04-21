import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
// Toast feedback happens centrally in ComplianceHub.handleSaveSettings.

const LEGAL_BASES = [
    { id: 'consent', labelKey: 'compliance.lb_consent' },
    { id: 'contract', labelKey: 'compliance.lb_contract' },
    { id: 'legal_obligation', labelKey: 'compliance.lb_legal_obligation' },
    { id: 'vital_interests', labelKey: 'compliance.lb_vital_interests' },
    { id: 'public_task', labelKey: 'compliance.lb_public_task' },
    { id: 'legitimate_interests', labelKey: 'compliance.lb_legitimate_interests' },
];

export default function SettingsPage({ settings, onSave }) {
    const { t } = useTranslation();
    const [form, setForm] = useState(() => normalize(settings));
    const [saving, setSaving] = useState(false);

    useEffect(() => { setForm(normalize(settings)); }, [settings]);

    const update = (patch) => setForm(prev => ({ ...prev, ...patch }));

    const toggleBasis = (id) => {
        const arr = new Set(form.legal_bases);
        arr.has(id) ? arr.delete(id) : arr.add(id);
        update({ legal_bases: Array.from(arr) });
    };

    const addRecipient = () => {
        const v = (form.newRecipient || '').trim();
        if (!v) return;
        update({ breach_recipients: [...form.breach_recipients, v], newRecipient: '' });
    };
    const removeRecipient = (i) => update({
        breach_recipients: form.breach_recipients.filter((_, idx) => idx !== i),
    });

    const save = async () => {
        setSaving(true);
        try {
            await onSave({
                dpo_name: form.dpo_name || null,
                dpo_email: form.dpo_email || null,
                dpo_phone: form.dpo_phone || null,
                legal_bases: form.legal_bases,
                data_residency: form.data_residency,
                breach_recipients: form.breach_recipients,
                default_retention_days: form.default_retention_days ? Number(form.default_retention_days) : null,
                privacy_notice_url: form.privacy_notice_url || null,
            });
        } catch { /* onSave shows its own error toast */ }
        finally { setSaving(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>

            <Section title={t('compliance.settings_dpo')} description={t('compliance.settings_dpo_desc')}>
                <Field label={t('compliance.dpo_name')}>
                    <input value={form.dpo_name} onChange={e => update({ dpo_name: e.target.value })}
                        placeholder="Jane Doe" style={input} />
                </Field>
                <Field label={t('compliance.dpo_email')}>
                    <input type="email" value={form.dpo_email} onChange={e => update({ dpo_email: e.target.value })}
                        placeholder="dpo@example.com" style={input} />
                </Field>
                <Field label={t('compliance.dpo_phone')}>
                    <input value={form.dpo_phone} onChange={e => update({ dpo_phone: e.target.value })}
                        placeholder="+31 6 ..." style={input} />
                </Field>
            </Section>

            <Section title={t('compliance.settings_legal_bases')} description={t('compliance.settings_legal_bases_desc')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {LEGAL_BASES.map(lb => {
                        const active = form.legal_bases.includes(lb.id);
                        return (
                            <button key={lb.id} onClick={() => toggleBasis(lb.id)} style={{
                                ...chip,
                                background: active ? 'var(--accent-primary, #6366f1)' : 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                color: active ? '#fff' : 'var(--text-secondary, #aaa)',
                                borderColor: active ? 'var(--accent-primary, #6366f1)' : 'var(--border-default, rgba(255,255,255,0.1))',
                            }}>
                                {t(lb.labelKey)}
                            </button>
                        );
                    })}
                </div>
            </Section>

            <Section title={t('compliance.settings_residency')} description={t('compliance.settings_residency_desc')}>
                <Field label={t('compliance.data_residency')}>
                    <select value={form.data_residency} onChange={e => update({ data_residency: e.target.value })} style={input}>
                        <option value="eu">{t('compliance.residency_eu')}</option>
                        <option value="internal">{t('compliance.residency_internal')}</option>
                        <option value="hybrid">{t('compliance.residency_hybrid')}</option>
                    </select>
                </Field>
                <Field label={t('compliance.default_retention_days')}>
                    <input type="number" min={0} value={form.default_retention_days} onChange={e => update({ default_retention_days: e.target.value })}
                        placeholder="365" style={input} />
                </Field>
                <Field label={t('compliance.privacy_notice_url')}>
                    <input value={form.privacy_notice_url} onChange={e => update({ privacy_notice_url: e.target.value })}
                        placeholder="https://yourcompany.com/privacy" style={input} />
                </Field>
            </Section>

            <Section title={t('compliance.settings_breach')} description={t('compliance.settings_breach_desc')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.breach_recipients.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-tertiary, rgba(255,255,255,0.04))', fontSize: 13 }}>{r}</span>
                            <button onClick={() => removeRecipient(i)} style={{ ...input, width: 'auto', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>×</button>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                        <input value={form.newRecipient || ''} onChange={e => update({ newRecipient: e.target.value })}
                            placeholder="security@example.com"
                            onKeyDown={e => e.key === 'Enter' && addRecipient()}
                            style={{ ...input, flex: 1 }} />
                        <button onClick={addRecipient} style={{ ...input, width: 'auto', background: 'var(--accent-primary, #6366f1)', color: '#fff', cursor: 'pointer', border: 'none' }}>
                            {t('compliance.add')}
                        </button>
                    </div>
                </div>
            </Section>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                <button onClick={save} disabled={saving} style={primaryBtn}>
                    <Save size={14} />
                    {saving ? t('compliance.saving') : t('compliance.save')}
                </button>
            </div>
        </div>
    );
}

function normalize(s) {
    return {
        dpo_name: s?.dpo_name || '',
        dpo_email: s?.dpo_email || '',
        dpo_phone: s?.dpo_phone || '',
        legal_bases: Array.isArray(s?.legal_bases) ? s.legal_bases : [],
        data_residency: s?.data_residency || 'eu',
        breach_recipients: Array.isArray(s?.breach_recipients) ? s.breach_recipients : [],
        default_retention_days: s?.default_retention_days ?? '',
        privacy_notice_url: s?.privacy_notice_url || '',
        newRecipient: '',
    };
}

function Section({ title, description, children }) {
    return (
        <div style={{
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
            borderRadius: 12, padding: 18,
        }}>
            <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</h3>
                {description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted, #888)' }}>{description}</p>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {children}
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted, #888)' }}>{label}</span>
            {children}
        </label>
    );
}

const input = {
    background: 'var(--bg-primary, #0f0f1a)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    borderRadius: 8, padding: '8px 10px',
    fontSize: 13, fontFamily: 'inherit',
    color: 'var(--text-primary, #fff)', width: '100%',
    outline: 'none',
};
const chip = {
    border: '1px solid', borderRadius: 20, padding: '6px 12px',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s',
};
const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'var(--accent-primary, #6366f1)', color: '#fff',
    border: 'none', padding: '9px 18px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
