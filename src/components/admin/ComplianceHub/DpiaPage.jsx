import React, { useState } from 'react';
import { ChevronDown, CheckCircle2, AlertTriangle, ClipboardList, FileDown } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import { Empty } from '../MonitoringPanel/shared';

/**
 * DPIA page (GDPR Art. 35) — one row per high-risk agent, derived from the
 * per-source Art-35 check rows (they carry agent id/name + risk_reason in
 * evidence). Two paths per agent, both server-persisted via POST /dpia/:id:
 *   - quick "Attest": mode=attestation, 12-month validity — for agents the
 *     admin has assessed outside the tool;
 *   - questionnaire: a short structured assessment stored as answers JSON.
 */
export default function DpiaPage({ checks, dpiaList, savingId, pdfUrlFor, onSave, focusId }) {
    const { t } = useTranslation();
    const [openId, setOpenId] = useState(focusId || null);
    const [forms, setForms] = useState({});

    if (dpiaList === null) return <CheckCardSkeleton count={3} />;

    // Art-35 rows are per-source: one row per flagged high-risk agent.
    const rows = (checks || [])
        .filter(c => c.check_id === 'GDPR-Art35-dpia-high-risk' && c.scope_id)
        .map(c => {
            const dpia = (dpiaList || []).find(d => d.agent_id === c.scope_id) || null;
            return {
                agentId: c.scope_id,
                agentName: c.evidence?.agent_name || c.scope_id,
                riskReason: c.evidence?.risk_reason || null,
                status: c.status,
                dpia,
            };
        });

    const defaultExpiry = () => {
        const d = new Date();
        d.setMonth(d.getMonth() + 12);
        return d.toISOString();
    };

    const formFor = (agentId) => forms[agentId] || {
        purpose: '', data_categories: '', automated_decisions: false,
        human_oversight: '', mitigations: '', risk_level: 'medium',
    };
    const setForm = (agentId, patch) => setForms(f => ({ ...f, [agentId]: { ...formFor(agentId), ...patch } }));

    const attest = (agentId) => onSave(agentId, {
        mode: 'attestation',
        risk_level: 'medium',
        expires_at: defaultExpiry(),
    });

    const submitQuestionnaire = (agentId) => {
        const f = formFor(agentId);
        onSave(agentId, {
            mode: 'questionnaire',
            risk_level: f.risk_level,
            expires_at: defaultExpiry(),
            answers: {
                purpose: f.purpose,
                data_categories: f.data_categories,
                automated_decisions: !!f.automated_decisions,
                human_oversight: f.human_oversight,
            },
            mitigations: f.mitigations
                ? f.mitigations.split('\n').map(s => s.trim()).filter(Boolean)
                : [],
        });
    };

    if (rows.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Empty text={t('compliance.dpia_empty')} />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
                {t('compliance.dpia_subtitle')}
            </div>
            {rows.map(row => {
                const open = openId === row.agentId;
                const saving = savingId === row.agentId;
                const ok = row.status === 'pass';
                const color = ok ? '#10b981' : row.status === 'warn' ? '#f59e0b' : '#ef4444';
                const f = formFor(row.agentId);
                return (
                    <div key={row.agentId} style={{
                        border: `1px solid ${color}33`, borderLeft: `4px solid ${color}`,
                        background: 'var(--bg-secondary, #1a1a2e)', borderRadius: 10,
                        padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                            onClick={() => setOpenId(open ? null : row.agentId)}>
                            {ok ? <CheckCircle2 size={20} style={{ color, flexShrink: 0 }} />
                                : <AlertTriangle size={20} style={{ color, flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                                    {row.agentName}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', marginTop: 2 }}>
                                    {row.dpia
                                        ? (t('compliance.dpia_on_record', { mode: row.dpia.mode, date: new Date(row.dpia.approved_at).toLocaleDateString() })
                                            || `DPIA on record (${row.dpia.mode}) — ${new Date(row.dpia.approved_at).toLocaleDateString()}`)
                                        : t('compliance.dpia_missing')}
                                    {row.riskReason ? ` · ${row.riskReason}` : ''}
                                </div>
                            </div>
                            <ChevronDown size={16} style={{
                                color: 'var(--text-muted, #888)', flexShrink: 0,
                                transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
                            }} />
                        </div>

                        {open && (
                            <div style={{
                                padding: '12px 14px', borderRadius: 8,
                                background: 'var(--bg-primary, rgba(0,0,0,0.2))',
                                display: 'flex', flexDirection: 'column', gap: 12,
                                fontSize: 12.5, color: 'var(--text-secondary, #bbb)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <button disabled={saving} onClick={() => attest(row.agentId)} style={btn('#10b981')}>
                                        <CheckCircle2 size={13} /> {t('compliance.dpia_attest')}
                                    </button>
                                    <span style={{ fontSize: 11.5, color: 'var(--text-muted, #888)' }}>
                                        {t('compliance.dpia_attest_hint')}
                                    </span>
                                    {row.dpia && pdfUrlFor && (
                                        <a href={pdfUrlFor(row.agentId)} download style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                            fontSize: 12, fontWeight: 600, textDecoration: 'none',
                                            color: 'var(--accent-primary, #6366f1)', marginLeft: 'auto',
                                        }}>
                                            <FileDown size={13} /> {t('compliance.dpia_download_pdf')}
                                        </a>
                                    )}
                                </div>

                                <div style={{ borderTop: '1px solid var(--border-default, rgba(255,255,255,0.06))', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                                        <ClipboardList size={14} /> {t('compliance.dpia_questionnaire')}
                                    </div>
                                    <Field label={t('compliance.dpia_q_purpose')}>
                                        <input style={input} value={f.purpose}
                                            onChange={e => setForm(row.agentId, { purpose: e.target.value })} />
                                    </Field>
                                    <Field label={t('compliance.dpia_q_data')}>
                                        <input style={input} value={f.data_categories}
                                            placeholder={t('compliance.dpia_q_data_ph')}
                                            onChange={e => setForm(row.agentId, { data_categories: e.target.value })} />
                                    </Field>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={f.automated_decisions}
                                            onChange={e => setForm(row.agentId, { automated_decisions: e.target.checked })} />
                                        {t('compliance.dpia_q_automated')}
                                    </label>
                                    <Field label={t('compliance.dpia_q_oversight')}>
                                        <input style={input} value={f.human_oversight}
                                            placeholder={t('compliance.dpia_q_oversight_ph')}
                                            onChange={e => setForm(row.agentId, { human_oversight: e.target.value })} />
                                    </Field>
                                    <Field label={t('compliance.dpia_q_mitigations')}>
                                        <textarea style={{ ...input, resize: 'vertical' }} rows={3} value={f.mitigations}
                                            placeholder={t('compliance.dpia_q_mitigations_ph')}
                                            onChange={e => setForm(row.agentId, { mitigations: e.target.value })} />
                                    </Field>
                                    <Field label={t('compliance.dpia_q_risk')}>
                                        <select style={input} value={f.risk_level}
                                            onChange={e => setForm(row.agentId, { risk_level: e.target.value })}>
                                            <option value="low">{t('compliance.dpia_risk_low')}</option>
                                            <option value="medium">{t('compliance.dpia_risk_medium')}</option>
                                            <option value="high">{t('compliance.dpia_risk_high')}</option>
                                        </select>
                                    </Field>
                                    <button disabled={saving} onClick={() => submitQuestionnaire(row.agentId)}
                                        style={{ ...btn('var(--accent-primary, #6366f1)'), alignSelf: 'flex-start' }}>
                                        {saving ? t('compliance.saving') : t('compliance.dpia_submit')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted, #666)' }}>{label}</span>
            {children}
        </label>
    );
}

const input = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
    color: 'var(--text-primary, #fff)', width: '100%',
    outline: 'none', fontFamily: 'inherit',
};
const btn = (bg) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: bg, color: '#fff', border: 'none',
    padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
});
