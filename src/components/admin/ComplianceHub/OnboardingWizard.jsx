import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

const LEGAL_BASES = [
    { id: 'consent', labelKey: 'compliance.lb_consent' },
    { id: 'contract', labelKey: 'compliance.lb_contract' },
    { id: 'legal_obligation', labelKey: 'compliance.lb_legal_obligation' },
    { id: 'vital_interests', labelKey: 'compliance.lb_vital_interests' },
    { id: 'public_task', labelKey: 'compliance.lb_public_task' },
    { id: 'legitimate_interests', labelKey: 'compliance.lb_legitimate_interests' },
];

export default function OnboardingWizard({ initialSettings, onFinish, onSkip }) {
    const { t } = useTranslation();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState(() => ({
        dpo_name: initialSettings?.dpo_name || '',
        dpo_email: initialSettings?.dpo_email || '',
        dpo_phone: initialSettings?.dpo_phone || '',
        legal_bases: initialSettings?.legal_bases || ['contract', 'legitimate_interests'],
        data_residency: initialSettings?.data_residency || 'eu',
        default_retention_days: initialSettings?.default_retention_days ?? 365,
        privacy_notice_url: initialSettings?.privacy_notice_url || '',
        breach_recipients: initialSettings?.breach_recipients || [],
        newRecipient: '',
    }));

    const steps = [
        { key: 'dpo', titleKey: 'compliance.wizard_step_dpo' },
        { key: 'legal', titleKey: 'compliance.wizard_step_legal' },
        { key: 'residency', titleKey: 'compliance.wizard_step_residency' },
        { key: 'breach', titleKey: 'compliance.wizard_step_breach' },
    ];

    const update = (patch) => setData(d => ({ ...d, ...patch }));
    const canNext = () => {
        if (step === 0) return !!(data.dpo_email && /@/.test(data.dpo_email) && data.dpo_name);
        if (step === 1) return data.legal_bases.length > 0;
        return true;
    };

    const finish = async () => {
        setSaving(true);
        try {
            await onFinish({
                dpo_name: data.dpo_name,
                dpo_email: data.dpo_email,
                dpo_phone: data.dpo_phone,
                legal_bases: data.legal_bases,
                data_residency: data.data_residency,
                default_retention_days: data.default_retention_days ? Number(data.default_retention_days) : null,
                privacy_notice_url: data.privacy_notice_url,
                breach_recipients: data.breach_recipients,
            });
        } finally { setSaving(false); }
    };

    return (
        <div style={overlay}>
            <div style={modal}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ShieldCheck size={22} style={{ color: '#10b981' }} />
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{t('compliance.wizard_title')}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{t('compliance.wizard_subtitle')}</div>
                        </div>
                    </div>
                    {onSkip && (
                        <button onClick={onSkip} style={iconBtn}><X size={16} /></button>
                    )}
                </div>

                {/* Progress — circles + checkmarks, mirroring InitSetupWizard */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24, alignItems: 'center' }}>
                    {steps.map((s, i) => (
                        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 600,
                                background: i <= step ? 'var(--accent-primary, #6366f1)' : 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                color: i <= step ? '#fff' : 'var(--text-muted, #888)',
                                boxShadow: i === step ? '0 0 0 3px color-mix(in srgb, var(--accent-primary, #6366f1) 18%, transparent)' : 'none',
                                transition: 'all 0.2s',
                            }}>
                                {i < step ? <CheckCircle2 size={16} /> : i + 1}
                            </div>
                            {i < steps.length - 1 && (
                                <div style={{
                                    width: 28, height: 2, borderRadius: 1,
                                    background: i < step ? 'var(--accent-primary, #6366f1)' : 'var(--border-default, rgba(255,255,255,0.1))',
                                    transition: 'background 0.2s',
                                }} />
                            )}
                        </div>
                    ))}
                </div>

                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary, #fff)' }}>
                    {t(steps[step].titleKey)}
                </h3>
                <p style={{ margin: '4px 0 18px', fontSize: 13, color: 'var(--text-muted, #aaa)' }}>
                    {t(`${steps[step].titleKey}_desc`)}
                </p>

                {/* Step content */}
                <div style={{ minHeight: 200 }}>
                    {step === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Field label={t('compliance.dpo_name')}>
                                <input value={data.dpo_name} onChange={e => update({ dpo_name: e.target.value })} style={input} autoFocus />
                            </Field>
                            <Field label={t('compliance.dpo_email')}>
                                <input type="email" value={data.dpo_email} onChange={e => update({ dpo_email: e.target.value })} style={input} />
                            </Field>
                            <Field label={t('compliance.dpo_phone')}>
                                <input value={data.dpo_phone} onChange={e => update({ dpo_phone: e.target.value })} style={input} />
                            </Field>
                        </div>
                    )}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {LEGAL_BASES.map(lb => {
                                const active = data.legal_bases.includes(lb.id);
                                return (
                                    <button key={lb.id} onClick={() => {
                                        const s = new Set(data.legal_bases);
                                        s.has(lb.id) ? s.delete(lb.id) : s.add(lb.id);
                                        update({ legal_bases: Array.from(s) });
                                    }} style={{
                                        ...chip,
                                        background: active ? 'var(--accent-primary, #6366f1)' : 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                        color: active ? '#fff' : 'var(--text-secondary, #aaa)',
                                        borderColor: active ? 'var(--accent-primary, #6366f1)' : 'var(--border-default, rgba(255,255,255,0.1))',
                                    }}>
                                        {active && <CheckCircle2 size={12} style={{ marginRight: 4 }} />}
                                        {t(lb.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Field label={t('compliance.data_residency')}>
                                <select value={data.data_residency} onChange={e => update({ data_residency: e.target.value })} style={input}>
                                    <option value="eu">{t('compliance.residency_eu')}</option>
                                    <option value="internal">{t('compliance.residency_internal')}</option>
                                    <option value="hybrid">{t('compliance.residency_hybrid')}</option>
                                </select>
                            </Field>
                            <Field label={t('compliance.default_retention_days')}>
                                <input type="number" min={0} value={data.default_retention_days}
                                    onChange={e => update({ default_retention_days: e.target.value })} style={input} />
                            </Field>
                            <Field label={t('compliance.privacy_notice_url')}>
                                <input value={data.privacy_notice_url}
                                    onChange={e => update({ privacy_notice_url: e.target.value })}
                                    placeholder="https://yourcompany.com/privacy" style={input} />
                            </Field>
                        </div>
                    )}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {data.breach_recipients.map((r, i) => (
                                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-tertiary, rgba(255,255,255,0.04))', fontSize: 13 }}>{r}</span>
                                    <button onClick={() => update({ breach_recipients: data.breach_recipients.filter((_, idx) => idx !== i) })}
                                        style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input value={data.newRecipient} onChange={e => update({ newRecipient: e.target.value })}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && data.newRecipient.trim()) {
                                            update({ breach_recipients: [...data.breach_recipients, data.newRecipient.trim()], newRecipient: '' });
                                        }
                                    }}
                                    placeholder="security@example.com"
                                    style={{ ...input, flex: 1 }} />
                                <button onClick={() => {
                                    if (data.newRecipient.trim()) {
                                        update({ breach_recipients: [...data.breach_recipients, data.newRecipient.trim()], newRecipient: '' });
                                    }
                                }} style={{
                                    background: 'var(--accent-primary, #6366f1)', color: '#fff',
                                    border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                                }}>{t('compliance.add')}</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 8 }}>
                    <button onClick={() => setStep(s => Math.max(0, s - 1))}
                        disabled={step === 0}
                        style={{ ...secondaryBtn, opacity: step === 0 ? 0.3 : 1 }}>
                        <ArrowLeft size={14} /> {t('compliance.back')}
                    </button>
                    {step < steps.length - 1 ? (
                        <button onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
                            disabled={!canNext()}
                            style={{ ...primaryBtn, opacity: canNext() ? 1 : 0.5 }}>
                            {t('compliance.next')} <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button onClick={finish} disabled={saving} style={primaryBtn}>
                            <CheckCircle2 size={14} /> {saving ? t('compliance.saving') : t('compliance.finish')}
                        </button>
                    )}
                </div>
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

const overlay = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20,
};
const modal = {
    background: 'var(--bg-primary, #0f0f1a)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    borderRadius: 16, padding: 28, width: 520, maxWidth: '100%',
    maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
};
const input = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    borderRadius: 8, padding: '9px 12px', fontSize: 13,
    color: 'var(--text-primary, #fff)', width: '100%',
    outline: 'none', fontFamily: 'inherit',
};
const chip = {
    border: '1px solid', borderRadius: 20, padding: '7px 14px',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center',
};
const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#10b981', color: '#fff', border: 'none',
    padding: '9px 16px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const secondaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'transparent', color: 'var(--text-muted, #aaa)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    padding: '9px 16px', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const iconBtn = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted, #888)', padding: 4, borderRadius: 6,
};
