import React, { useState } from 'react';
import { ChevronDown, Plus, Clock, AlertTriangle, CheckCircle2, Mail, Landmark, Users } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import { Empty } from '../MonitoringPanel/shared';

/**
 * Incident registry (GDPR Art. 33/34) — records the 72-hour workflow.
 * "Notify recipients" emails the org's configured breach recipients;
 * "authority notified" / "data subjects notified" are record-only
 * attestations — the org files with the supervisory authority itself.
 */
const STATUS_STYLE = {
    open: { color: '#ef4444', labelKey: 'compliance.inc_status_open' },
    assessing: { color: '#f59e0b', labelKey: 'compliance.inc_status_assessing' },
    authority_notified: { color: '#3b82f6', labelKey: 'compliance.inc_status_authority' },
    subjects_notified: { color: '#8b5cf6', labelKey: 'compliance.inc_status_subjects' },
    closed: { color: '#10b981', labelKey: 'compliance.inc_status_closed' },
};

function DeadlineCountdown({ incident }) {
    const { t } = useTranslation();
    if (incident.authority_notified_at || incident.status === 'closed') {
        return null;
    }
    const msLeft = new Date(incident.deadline_at).getTime() - Date.now();
    const hoursLeft = Math.ceil(msLeft / 3600000);
    const overdue = msLeft < 0;
    const urgent = !overdue && hoursLeft <= 24;
    const color = overdue ? '#ef4444' : urgent ? '#f59e0b' : 'var(--text-muted, #888)';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: overdue || urgent ? 700 : 500, color }}>
            {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
            {overdue
                ? (t('compliance.inc_overdue', { hours: Math.abs(hoursLeft) }) || `${Math.abs(hoursLeft)}h past the 72h deadline`)
                : (t('compliance.inc_hours_left', { hours: hoursLeft }) || `${hoursLeft}h to Art. 33 deadline`)}
        </span>
    );
}

export default function IncidentsPage({ incidents, busyId, onCreate, onUpdate, onNotify, focusId }) {
    const { t } = useTranslation();
    const [openId, setOpenId] = useState(focusId ? Number(focusId) || null : null);
    const [showCreate, setShowCreate] = useState(false);
    const [draft, setDraft] = useState({ title: '', description: '', severity: 'medium', high_risk: false, occurred_at: '' });
    const [refDrafts, setRefDrafts] = useState({});

    if (incidents === null) return <CheckCardSkeleton count={3} />;

    const submitCreate = async () => {
        if (!draft.title.trim()) return;
        await onCreate({
            title: draft.title.trim(),
            description: draft.description.trim() || undefined,
            severity: draft.severity,
            high_risk: draft.high_risk,
            occurred_at: draft.occurred_at || undefined,
        });
        setDraft({ title: '', description: '', severity: 'medium', high_risk: false, occurred_at: '' });
        setShowCreate(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', flex: 1 }}>
                    {t('compliance.inc_subtitle')}
                </div>
                <button onClick={() => setShowCreate(v => !v)} style={btn('#ef4444')}>
                    <Plus size={14} /> {t('compliance.inc_record')}
                </button>
            </div>

            {showCreate && (
                <div style={{ ...panel, borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label={t('compliance.inc_f_title')}>
                        <input style={input} value={draft.title} autoFocus
                            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                    </Field>
                    <Field label={t('compliance.inc_f_desc')}>
                        <textarea style={{ ...input, resize: 'vertical' }} rows={3} value={draft.description}
                            placeholder={t('compliance.inc_f_desc_ph')}
                            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                    </Field>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <Field label={t('compliance.inc_f_severity')}>
                            <select style={input} value={draft.severity}
                                onChange={e => setDraft(d => ({ ...d, severity: e.target.value }))}>
                                <option value="low">{t('compliance.dpia_risk_low')}</option>
                                <option value="medium">{t('compliance.dpia_risk_medium')}</option>
                                <option value="high">{t('compliance.dpia_risk_high')}</option>
                            </select>
                        </Field>
                        <Field label={t('compliance.inc_f_occurred')}>
                            <input type="datetime-local" style={input} value={draft.occurred_at}
                                onChange={e => setDraft(d => ({ ...d, occurred_at: e.target.value }))} />
                        </Field>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', paddingBottom: 8 }}>
                            <input type="checkbox" checked={draft.high_risk}
                                onChange={e => setDraft(d => ({ ...d, high_risk: e.target.checked }))} />
                            {t('compliance.inc_f_high_risk')}
                        </label>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #888)' }}>
                        {t('compliance.inc_clock_hint')}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submitCreate} style={btn('#ef4444')}>{t('compliance.inc_create')}</button>
                        <button onClick={() => setShowCreate(false)} style={btn('transparent', 'var(--text-muted, #888)')}>
                            {t('compliance.auto_fix_cancel')}
                        </button>
                    </div>
                </div>
            )}

            {incidents.length === 0 && !showCreate ? (
                <Empty text={t('compliance.inc_empty')} />
            ) : (
                incidents.map(inc => {
                    const s = STATUS_STYLE[inc.status] || STATUS_STYLE.open;
                    const open = openId === inc.id;
                    const busy = busyId === inc.id;
                    const refDraft = refDrafts[inc.id] ?? '';
                    return (
                        <div key={inc.id} style={{
                            ...panel,
                            border: `1px solid ${s.color}33`, borderLeft: `4px solid ${s.color}`,
                            display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                                onClick={() => setOpenId(open ? null : inc.id)}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{inc.title}</span>
                                        <span style={pill(s.color)}>{t(s.labelKey) || inc.status}</span>
                                        {inc.high_risk && <span style={pill('#8b5cf6')}>{t('compliance.inc_high_risk_pill')}</span>}
                                        <DeadlineCountdown incident={inc} />
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', marginTop: 3 }}>
                                        #{inc.id} · {t('compliance.inc_detected')} {new Date(inc.detected_at).toLocaleString()}
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
                                    {inc.description && <div>{inc.description}</div>}

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 11.5 }}>
                                        <Stamp done={!!inc.recipients_notified_at} icon={Mail}
                                            label={t('compliance.inc_stamp_recipients')} at={inc.recipients_notified_at} />
                                        <Stamp done={!!inc.authority_notified_at} icon={Landmark}
                                            label={t('compliance.inc_stamp_authority')} at={inc.authority_notified_at}
                                            extra={inc.authority_reference ? `ref: ${inc.authority_reference}` : null} />
                                        {inc.high_risk && (
                                            <Stamp done={!!inc.subjects_notified_at} icon={Users}
                                                label={t('compliance.inc_stamp_subjects')} at={inc.subjects_notified_at} />
                                        )}
                                    </div>

                                    {inc.status !== 'closed' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {inc.status === 'open' && (
                                                    <button disabled={busy} style={btn('#f59e0b')}
                                                        onClick={() => onUpdate(inc.id, { status: 'assessing' })}>
                                                        {t('compliance.inc_start_assess')}
                                                    </button>
                                                )}
                                                {!inc.recipients_notified_at && (
                                                    <button disabled={busy} style={btn('#3b82f6')}
                                                        onClick={() => onNotify(inc.id)}>
                                                        <Mail size={13} /> {t('compliance.inc_notify_recipients')}
                                                    </button>
                                                )}
                                                <button disabled={busy} style={btn('#6b7280')}
                                                    onClick={() => onUpdate(inc.id, { status: 'closed', note: t('compliance.inc_closed_note') })}>
                                                    <CheckCircle2 size={13} /> {t('compliance.inc_close')}
                                                </button>
                                            </div>
                                            {!inc.authority_notified_at && (
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    <input style={{ ...input, flex: '1 1 200px' }} value={refDraft}
                                                        placeholder={t('compliance.inc_authority_ref_ph')}
                                                        onChange={e => setRefDrafts(d => ({ ...d, [inc.id]: e.target.value }))} />
                                                    <button disabled={busy} style={btn('#10b981')}
                                                        onClick={() => onUpdate(inc.id, { status: 'authority_notified', authority_reference: refDraft || undefined })}>
                                                        <Landmark size={13} /> {t('compliance.inc_record_authority')}
                                                    </button>
                                                </div>
                                            )}
                                            {inc.high_risk && !inc.subjects_notified_at && (
                                                <button disabled={busy} style={{ ...btn('#8b5cf6'), alignSelf: 'flex-start' }}
                                                    onClick={() => onUpdate(inc.id, { status: 'subjects_notified' })}>
                                                    <Users size={13} /> {t('compliance.inc_record_subjects')}
                                                </button>
                                            )}
                                            <div style={{ fontSize: 11, color: 'var(--text-muted, #777)' }}>
                                                {t('compliance.inc_attestation_note')}
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(inc.notes) && inc.notes.length > 0 && (
                                        <div>
                                            <div style={label}>{t('compliance.inc_notes')}</div>
                                            {inc.notes.map((n, i) => (
                                                <div key={i} style={{ fontSize: 11.5 }}>
                                                    <span style={{ color: 'var(--text-muted, #777)' }}>{n.at ? new Date(n.at).toLocaleString() : ''}</span> — {n.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}

function Stamp({ done, icon: Icon, label: text, at, extra }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px', borderRadius: 6,
            background: done ? '#10b98115' : 'var(--bg-tertiary, rgba(255,255,255,0.03))',
            color: done ? '#10b981' : 'var(--text-muted, #888)',
        }}>
            <Icon size={13} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{text}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10.5 }}>
                {done ? new Date(at).toLocaleDateString() : '—'}{extra ? ` · ${extra}` : ''}
            </span>
        </div>
    );
}

function Field({ label: text, children }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted, #666)' }}>{text}</span>
            {children}
        </label>
    );
}

const panel = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 10, padding: '12px 16px',
};
const label = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'var(--text-muted, #666)', marginBottom: 4,
};
const pill = (color) => ({
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    padding: '2px 6px', borderRadius: 4, background: `${color}22`, color,
});
const btn = (bg, color = '#fff') => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: bg, color, border: 'none',
    padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
});
const input = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
    color: 'var(--text-primary, #fff)', width: '100%',
    outline: 'none', fontFamily: 'inherit',
};
