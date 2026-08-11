import React, { useState } from 'react';
import {
    Plus, ChevronDown, ChevronRight, Play, CheckCircle2, AlertTriangle,
    ClipboardList, Users, Target, FileWarning, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import { Empty } from '../MonitoringPanel/shared';

/**
 * ISMS process page — the clause 9/10/6.2 records an auditor asks for:
 *   Internal audits (9.2)      planned → in progress → closed, with findings
 *   Management reviews (9.3)   auto-built 9.3.2 inputs + HUMAN minutes
 *   Nonconformities (10)       open → corrective action → effectiveness review → closed
 *   Objectives (6.2)           measurable objectives with review dates
 *
 * Pure presentational: all data arrives via props, all mutations go through
 * callback props. Sign-offs record who+when server-side — nothing here
 * auto-approves, and the review minutes are typed by a person.
 */
export default function AuditPage({
    audits, findings, reviews, ncs, objectives, busy, independenceWarning,
    onCreateAudit, onUpdateAudit, onAddFinding,
    onCreateReview, onCreateNc, onUpdateNc,
    onCreateObjective, onUpdateObjective,
    mrInputs, orgUsers,
}) {
    const { t } = useTranslation();
    const [tab, setTab] = useState('audits');

    const tabs = [
        { id: 'audits', icon: ClipboardList, text: t('compliance.audit_tab') },
        { id: 'reviews', icon: Users, text: t('compliance.mr_tab') },
        { id: 'ncs', icon: FileWarning, text: t('compliance.nc_tab') },
        { id: 'objectives', icon: Target, text: t('compliance.obj_tab') },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tabs.map(({ id, icon: TabIcon, text }) => (
                    <button key={id} onClick={() => setTab(id)} style={{
                        ...tabBtn,
                        background: tab === id ? 'var(--accent-primary, #6366f1)' : 'transparent',
                        color: tab === id ? '#fff' : 'var(--text-muted, #999)',
                        border: `1px solid ${tab === id ? 'transparent' : 'var(--border-default, rgba(255,255,255,0.1))'}`,
                    }}>
                        <TabIcon size={14} /> {text}
                    </button>
                ))}
            </div>

            {tab === 'audits' && (
                <AuditsTab t={t} audits={audits} findings={findings} busy={busy}
                    independenceWarning={independenceWarning} orgUsers={orgUsers}
                    onCreateAudit={onCreateAudit} onUpdateAudit={onUpdateAudit}
                    onAddFinding={onAddFinding} onCreateNc={onCreateNc} />
            )}
            {tab === 'reviews' && (
                <ReviewsTab t={t} reviews={reviews} mrInputs={mrInputs} busy={busy}
                    orgUsers={orgUsers} onCreateReview={onCreateReview} />
            )}
            {tab === 'ncs' && (
                <NcTab t={t} ncs={ncs} busy={busy} orgUsers={orgUsers}
                    onCreateNc={onCreateNc} onUpdateNc={onUpdateNc} />
            )}
            {tab === 'objectives' && (
                <ObjectivesTab t={t} objectives={objectives} busy={busy} orgUsers={orgUsers}
                    onCreateObjective={onCreateObjective} onUpdateObjective={onUpdateObjective} />
            )}
        </div>
    );
}

const userName = (orgUsers, id) => {
    if (!id) return null;
    const u = (orgUsers || []).find(x => String(x.id) === String(id));
    return u ? (u.displayName || u.email || u.id) : id;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

// ------------------------------------------------------------------ Audits

const AUDIT_STATUS = {
    planned: { color: '#6b7280', key: 'compliance.audit_status_planned' },
    in_progress: { color: '#f59e0b', key: 'compliance.audit_status_in_progress' },
    closed: { color: '#10b981', key: 'compliance.audit_status_closed' },
};
const SEVERITY_COLOR = { observation: '#6b7280', minor: '#f59e0b', major: '#ef4444' };

function AuditsTab({ t, audits, findings, busy, independenceWarning, orgUsers, onCreateAudit, onUpdateAudit, onAddFinding, onCreateNc }) {
    const [showCreate, setShowCreate] = useState(false);
    const [draft, setDraft] = useState({ title: '', scope_note: '', auditor_user_id: '', planned_at: '' });
    const [openId, setOpenId] = useState(null);
    const [findingDrafts, setFindingDrafts] = useState({});

    if (audits === null || findings === null) return <CheckCardSkeleton count={3} />;

    const emptyFinding = { severity: 'observation', control_ref: '', clause: '', description: '', evidence_ref: '' };
    const setFinding = (auditId, patch) =>
        setFindingDrafts(d => ({ ...d, [auditId]: { ...(d[auditId] || emptyFinding), ...patch } }));

    const submitCreate = () => {
        if (!draft.title.trim()) return;
        onCreateAudit({
            title: draft.title.trim(),
            scope_note: draft.scope_note.trim() || undefined,
            auditor_user_id: draft.auditor_user_id || undefined,
            planned_at: draft.planned_at || undefined,
        });
        setDraft({ title: '', scope_note: '', auditor_user_id: '', planned_at: '' });
        setShowCreate(false);
    };

    const submitFinding = (auditId) => {
        const f = findingDrafts[auditId] || emptyFinding;
        if (!f.description.trim()) return;
        onAddFinding(auditId, {
            severity: f.severity,
            control_ref: f.control_ref.trim() || undefined,
            clause: f.clause.trim() || undefined,
            description: f.description.trim(),
            evidence_ref: f.evidence_ref.trim() || undefined,
        });
        setFindingDrafts(d => ({ ...d, [auditId]: emptyFinding }));
    };

    const raiseNc = (audit, f) => {
        onCreateNc({
            title: String(f.description).slice(0, 120),
            description: `${t('compliance.audit_nc_from')} "${audit.title}"${f.control_ref ? ` (${f.control_ref})` : ''}: ${f.description}`,
            source: 'internal_audit',
            severity: f.severity === 'major' ? 'major' : 'minor',
            finding_id: f.id,
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', flex: 1 }}>
                    {t('compliance.audit_subtitle')}
                </div>
                <button onClick={() => setShowCreate(v => !v)} style={btn('var(--accent-primary, #6366f1)')}>
                    <Plus size={14} /> {t('compliance.audit_plan')}
                </button>
            </div>

            {showCreate && (
                <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label={t('compliance.audit_f_title')}>
                        <input style={input} value={draft.title} autoFocus
                            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                    </Field>
                    <Field label={t('compliance.audit_f_scope')}>
                        <textarea style={{ ...input, resize: 'vertical' }} rows={2} value={draft.scope_note}
                            placeholder={t('compliance.audit_f_scope_ph')}
                            onChange={e => setDraft(d => ({ ...d, scope_note: e.target.value }))} />
                    </Field>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Field label={t('compliance.audit_f_auditor')}>
                            <select style={input} value={draft.auditor_user_id}
                                onChange={e => setDraft(d => ({ ...d, auditor_user_id: e.target.value }))}>
                                <option value="">{t('compliance.audit_auditor_none')}</option>
                                {(orgUsers || []).map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label={t('compliance.audit_f_planned')}>
                            <input type="date" style={input} value={draft.planned_at}
                                onChange={e => setDraft(d => ({ ...d, planned_at: e.target.value }))} />
                        </Field>
                    </div>
                    {independenceWarning && (
                        <div style={warnBox}>
                            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 2 }}>{t('compliance.audit_independence_title')}</div>
                                {independenceWarning}
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submitCreate} disabled={busy} style={btn('#10b981')}>{t('compliance.audit_create')}</button>
                        <button onClick={() => setShowCreate(false)} style={btn('transparent', 'var(--text-muted, #888)')}>
                            {t('compliance.audit_cancel')}
                        </button>
                    </div>
                </div>
            )}

            {audits.length === 0 && !showCreate ? (
                <Empty text={t('compliance.audit_empty')} />
            ) : (
                audits.map(a => {
                    const s = AUDIT_STATUS[a.status] || AUDIT_STATUS.planned;
                    const open = openId === a.id;
                    const auditFindings = (findings || []).filter(f => f.audit_id === a.id);
                    const fd = findingDrafts[a.id] || emptyFinding;
                    return (
                        <div key={a.id} style={{ ...box, borderLeft: `4px solid ${s.color}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                onClick={() => setOpenId(open ? null : a.id)}>
                                {open ? <ChevronDown size={15} style={{ color: 'var(--text-muted, #888)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-muted, #888)' }} />}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{a.title}</span>
                                        <span style={pill(s.color)}>{t(s.key)}</span>
                                        {auditFindings.length > 0 && <span style={pill('#6366f1')}>{auditFindings.length} {t('compliance.audit_findings')}</span>}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #888)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        {a.auditor_user_id && <span>{t('compliance.audit_f_auditor')}: {userName(orgUsers, a.auditor_user_id)}</span>}
                                        {a.planned_at && <span>{t('compliance.audit_planned_on')} {fmtDate(a.planned_at)}</span>}
                                        {a.started_at && <span>{t('compliance.audit_started_on')} {fmtDate(a.started_at)}</span>}
                                        {a.closed_at && <span>{t('compliance.audit_closed_on')} {fmtDate(a.closed_at)}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                                    {a.status === 'planned' && (
                                        <button disabled={busy} style={btn('#f59e0b')} onClick={() => onUpdateAudit(a.id, { status: 'in_progress' })}>
                                            <Play size={13} /> {t('compliance.audit_start')}
                                        </button>
                                    )}
                                    {a.status === 'in_progress' && (
                                        <button disabled={busy} style={btn('#10b981')} onClick={() => onUpdateAudit(a.id, { status: 'closed' })}>
                                            <CheckCircle2 size={13} /> {t('compliance.audit_close')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {open && (
                                <div style={innerPanel}>
                                    {a.scope_note && <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #bbb)' }}>{a.scope_note}</div>}

                                    <div style={label}>{t('compliance.audit_findings')}</div>
                                    {auditFindings.length === 0 ? (
                                        <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{t('compliance.audit_no_findings')}</div>
                                    ) : (
                                        auditFindings.map(f => (
                                            <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.04))' }}>
                                                <span style={pill(SEVERITY_COLOR[f.severity] || '#6b7280')}>{t(`compliance.audit_sev_${f.severity}`)}</span>
                                                {f.control_ref && <span style={pill('#6366f1')}>{f.control_ref}</span>}
                                                {f.clause && <span style={pill('#0ea5e9')}>{t('compliance.audit_f_clause')} {f.clause}</span>}
                                                <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: 'var(--text-secondary, #bbb)' }}>
                                                    {f.description}
                                                    {f.evidence_ref && <span style={{ color: 'var(--text-muted, #777)', fontSize: 11 }}> · {f.evidence_ref}</span>}
                                                </span>
                                                {f.nonconformity_id ? (
                                                    <span style={pill('#8b5cf6')}>{t('compliance.audit_nc_raised')} #{f.nonconformity_id}</span>
                                                ) : (f.severity !== 'observation' && (
                                                    <button disabled={busy} style={btn('transparent', '#ef4444')} onClick={() => raiseNc(a, f)}>
                                                        <ArrowRight size={12} /> {t('compliance.audit_raise_nc')}
                                                    </button>
                                                ))}
                                            </div>
                                        ))
                                    )}

                                    {a.status !== 'closed' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <Field label={t('compliance.audit_f_severity')}>
                                                    <select style={input} value={fd.severity} onChange={e => setFinding(a.id, { severity: e.target.value })}>
                                                        <option value="observation">{t('compliance.audit_sev_observation')}</option>
                                                        <option value="minor">{t('compliance.audit_sev_minor')}</option>
                                                        <option value="major">{t('compliance.audit_sev_major')}</option>
                                                    </select>
                                                </Field>
                                                <Field label={t('compliance.audit_f_control')}>
                                                    <input style={input} value={fd.control_ref} placeholder="A.5.15"
                                                        onChange={e => setFinding(a.id, { control_ref: e.target.value })} />
                                                </Field>
                                                <Field label={t('compliance.audit_f_clause')}>
                                                    <input style={input} value={fd.clause} placeholder="9.2"
                                                        onChange={e => setFinding(a.id, { clause: e.target.value })} />
                                                </Field>
                                                <Field label={t('compliance.audit_f_evidence')}>
                                                    <input style={input} value={fd.evidence_ref}
                                                        onChange={e => setFinding(a.id, { evidence_ref: e.target.value })} />
                                                </Field>
                                            </div>
                                            <Field label={t('compliance.audit_f_finding')}>
                                                <textarea style={{ ...input, resize: 'vertical' }} rows={2} value={fd.description}
                                                    placeholder={t('compliance.audit_f_finding_ph')}
                                                    onChange={e => setFinding(a.id, { description: e.target.value })} />
                                            </Field>
                                            <button disabled={busy || !fd.description.trim()} style={{ ...btn('var(--accent-primary, #6366f1)'), alignSelf: 'flex-start' }}
                                                onClick={() => submitFinding(a.id)}>
                                                <Plus size={13} /> {t('compliance.audit_add_finding')}
                                            </button>
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

// -------------------------------------------------------- Management reviews

const labelize = (k) => String(k).replace(/_/g, ' ');
const fmtVal = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.map(x => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join(', ') || '—';
    if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${labelize(k)}: ${typeof x === 'object' && x !== null ? JSON.stringify(x) : x}`).join(' · ');
    return String(v);
};

function MrInputRows({ inputs }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(inputs).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 10, fontSize: 12.5, alignItems: 'baseline' }}>
                    <div style={{ ...label, marginBottom: 0, minWidth: 160, flexShrink: 0 }}>{labelize(k)}</div>
                    <div style={{ color: 'var(--text-secondary, #bbb)', overflowWrap: 'anywhere' }}>{fmtVal(v)}</div>
                </div>
            ))}
        </div>
    );
}

function ReviewsTab({ t, reviews, mrInputs, busy, orgUsers, onCreateReview }) {
    const [showCreate, setShowCreate] = useState(false);
    const [draft, setDraft] = useState({ held_at: '', attendees: [], decisions: '' });
    const [openId, setOpenId] = useState(null);

    if (reviews === null) return <CheckCardSkeleton count={3} />;

    const toggleAttendee = (id) => setDraft(d => ({
        ...d,
        attendees: d.attendees.includes(id) ? d.attendees.filter(x => x !== id) : [...d.attendees, id],
    }));

    const submit = () => {
        if (!draft.held_at) return;
        onCreateReview({
            held_at: draft.held_at,
            attendees: draft.attendees.map(id => ({ id, name: userName(orgUsers, id) })),
            decisions: draft.decisions.trim() || undefined,
            inputs: mrInputs || {},
        });
        setDraft({ held_at: '', attendees: [], decisions: '' });
        setShowCreate(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', flex: 1 }}>
                    {t('compliance.mr_subtitle')}
                </div>
                <button onClick={() => setShowCreate(v => !v)} style={btn('var(--accent-primary, #6366f1)')}>
                    <Plus size={14} /> {t('compliance.mr_record')}
                </button>
            </div>

            {/* Auto-built 9.3.2 agenda */}
            <div style={box}>
                <div style={sectionTitle}>{t('compliance.mr_inputs_title')}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted, #888)', marginBottom: 10 }}>
                    {t('compliance.mr_inputs_hint')}
                </div>
                {mrInputs && Object.keys(mrInputs).length > 0
                    ? <MrInputRows inputs={mrInputs} />
                    : <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{t('compliance.mr_no_inputs')}</div>}
            </div>

            {showCreate && (
                <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Field label={t('compliance.mr_f_held')}>
                            <input type="date" style={input} value={draft.held_at} autoFocus
                                onChange={e => setDraft(d => ({ ...d, held_at: e.target.value }))} />
                        </Field>
                        <Field label={t('compliance.mr_f_attendees')}>
                            <div style={{ ...input, maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {(orgUsers || []).map(u => (
                                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400, color: 'var(--text-primary, #eee)' }}>
                                        <input type="checkbox" checked={draft.attendees.includes(u.id)} onChange={() => toggleAttendee(u.id)} />
                                        {u.displayName} — {u.email}
                                    </label>
                                ))}
                            </div>
                        </Field>
                    </div>
                    <Field label={t('compliance.mr_f_decisions')}>
                        <textarea style={{ ...input, resize: 'vertical' }} rows={4} value={draft.decisions}
                            placeholder={t('compliance.mr_f_decisions_ph')}
                            onChange={e => setDraft(d => ({ ...d, decisions: e.target.value }))} />
                    </Field>
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #777)' }}>{t('compliance.mr_minutes_note')}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submit} disabled={busy || !draft.held_at} style={btn('#10b981')}>{t('compliance.mr_create')}</button>
                        <button onClick={() => setShowCreate(false)} style={btn('transparent', 'var(--text-muted, #888)')}>
                            {t('compliance.audit_cancel')}
                        </button>
                    </div>
                </div>
            )}

            {reviews.length === 0 && !showCreate ? (
                <Empty text={t('compliance.mr_empty')} />
            ) : (
                reviews.map(r => {
                    const open = openId === r.id;
                    const attendees = (Array.isArray(r.attendees) ? r.attendees : [])
                        .map(a => (a && typeof a === 'object') ? (a.name || a.id) : String(a));
                    const hasInputs = r.inputs && typeof r.inputs === 'object' && Object.keys(r.inputs).length > 0;
                    return (
                        <div key={r.id} style={{ ...box, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                onClick={() => setOpenId(open ? null : r.id)}>
                                {open ? <ChevronDown size={15} style={{ color: 'var(--text-muted, #888)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-muted, #888)' }} />}
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                                        {t('compliance.mr_held_on')} {fmtDate(r.held_at)}
                                    </span>
                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #888)', marginTop: 3 }}>
                                        {t('compliance.mr_attendees')}: {attendees.length ? attendees.join(', ') : '—'}
                                    </div>
                                </div>
                            </div>
                            {open && (
                                <div style={innerPanel}>
                                    <div style={label}>{t('compliance.mr_decisions')}</div>
                                    <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #bbb)', whiteSpace: 'pre-wrap' }}>
                                        {r.decisions || '—'}
                                    </div>
                                    {hasInputs && (
                                        <>
                                            <div style={{ ...label, marginTop: 8 }}>{t('compliance.mr_show_inputs')}</div>
                                            <MrInputRows inputs={r.inputs} />
                                        </>
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

// ------------------------------------------------------------ Nonconformities

const NC_STATUS = {
    open: { color: '#ef4444', key: 'compliance.nc_status_open' },
    corrective_action: { color: '#f59e0b', key: 'compliance.nc_status_corrective_action' },
    effectiveness_review: { color: '#3b82f6', key: 'compliance.nc_status_effectiveness_review' },
    closed: { color: '#10b981', key: 'compliance.nc_status_closed' },
};

function NcTab({ t, ncs, busy, orgUsers, onCreateNc, onUpdateNc }) {
    const [showCreate, setShowCreate] = useState(false);
    const [draft, setDraft] = useState({ title: '', description: '', severity: 'minor', due_at: '', owner_user_id: '' });
    const [openId, setOpenId] = useState(null);
    const [editDrafts, setEditDrafts] = useState({});

    if (ncs === null) return <CheckCardSkeleton count={3} />;

    const submit = () => {
        if (!draft.title.trim()) return;
        onCreateNc({
            title: draft.title.trim(),
            description: draft.description.trim() || undefined,
            severity: draft.severity,
            due_at: draft.due_at || undefined,
            owner_user_id: draft.owner_user_id || undefined,
            source: 'manual',
        });
        setDraft({ title: '', description: '', severity: 'minor', due_at: '', owner_user_id: '' });
        setShowCreate(false);
    };

    const openRow = (nc) => {
        if (openId === nc.id) { setOpenId(null); return; }
        setOpenId(nc.id);
        setEditDrafts(d => ({
            ...d,
            [nc.id]: d[nc.id] || {
                corrective_action: nc.corrective_action || '',
                due_at: nc.due_at ? String(nc.due_at).slice(0, 10) : '',
                effectiveness_review_due_at: nc.effectiveness_review_due_at ? String(nc.effectiveness_review_due_at).slice(0, 10) : '',
                owner_user_id: nc.owner_user_id || '',
            },
        }));
    };

    const saveEdit = (id) => {
        const e = editDrafts[id];
        if (!e) return;
        onUpdateNc(id, {
            corrective_action: e.corrective_action.trim() || undefined,
            due_at: e.due_at || undefined,
            effectiveness_review_due_at: e.effectiveness_review_due_at || undefined,
            owner_user_id: e.owner_user_id || undefined,
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', flex: 1 }}>
                    {t('compliance.nc_subtitle')}
                </div>
                <button onClick={() => setShowCreate(v => !v)} style={btn('#ef4444')}>
                    <Plus size={14} /> {t('compliance.nc_record')}
                </button>
            </div>

            {showCreate && (
                <div style={{ ...box, borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label={t('compliance.nc_f_title')}>
                        <input style={input} value={draft.title} autoFocus
                            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                    </Field>
                    <Field label={t('compliance.nc_f_desc')}>
                        <textarea style={{ ...input, resize: 'vertical' }} rows={3} value={draft.description}
                            placeholder={t('compliance.nc_f_desc_ph')}
                            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                    </Field>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Field label={t('compliance.nc_f_severity')}>
                            <select style={input} value={draft.severity}
                                onChange={e => setDraft(d => ({ ...d, severity: e.target.value }))}>
                                <option value="minor">{t('compliance.nc_sev_minor')}</option>
                                <option value="major">{t('compliance.nc_sev_major')}</option>
                            </select>
                        </Field>
                        <Field label={t('compliance.nc_f_due')}>
                            <input type="date" style={input} value={draft.due_at}
                                onChange={e => setDraft(d => ({ ...d, due_at: e.target.value }))} />
                        </Field>
                        <Field label={t('compliance.nc_f_owner')}>
                            <select style={input} value={draft.owner_user_id}
                                onChange={e => setDraft(d => ({ ...d, owner_user_id: e.target.value }))}>
                                <option value="">{t('compliance.nc_owner_none')}</option>
                                {(orgUsers || []).map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submit} disabled={busy} style={btn('#ef4444')}>{t('compliance.nc_create')}</button>
                        <button onClick={() => setShowCreate(false)} style={btn('transparent', 'var(--text-muted, #888)')}>
                            {t('compliance.audit_cancel')}
                        </button>
                    </div>
                </div>
            )}

            {ncs.length === 0 && !showCreate ? (
                <Empty text={t('compliance.nc_empty')} />
            ) : (
                ncs.map(nc => {
                    const s = NC_STATUS[nc.status] || NC_STATUS.open;
                    const open = openId === nc.id;
                    const overdue = nc.due_at && nc.status !== 'closed' && new Date(nc.due_at).getTime() < Date.now();
                    const e = editDrafts[nc.id];
                    return (
                        <div key={nc.id} style={{
                            ...box,
                            border: `1px solid ${overdue ? '#ef444455' : 'var(--border-default, rgba(255,255,255,0.06))'}`,
                            borderLeft: `4px solid ${overdue ? '#ef4444' : s.color}`,
                            display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openRow(nc)}>
                                {open ? <ChevronDown size={15} style={{ color: 'var(--text-muted, #888)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-muted, #888)' }} />}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{nc.title}</span>
                                        <span style={pill(s.color)}>{t(s.key)}</span>
                                        <span style={pill(nc.severity === 'major' ? '#ef4444' : '#f59e0b')}>{t(`compliance.nc_sev_${nc.severity}`)}</span>
                                        <span style={pill('#6b7280')}>{t(`compliance.nc_source_${nc.source}`)}</span>
                                        {overdue && (
                                            <span style={{ ...pill('#ef4444'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <AlertTriangle size={11} /> {t('compliance.nc_overdue')}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #888)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        {nc.due_at && <span style={{ color: overdue ? '#ef4444' : undefined }}>{t('compliance.nc_due')} {fmtDate(nc.due_at)}</span>}
                                        {nc.owner_user_id && <span>{t('compliance.nc_f_owner')}: {userName(orgUsers, nc.owner_user_id)}</span>}
                                        {nc.closed_at && <span>{t('compliance.nc_closed_on')} {fmtDate(nc.closed_at)}</span>}
                                    </div>
                                </div>
                            </div>

                            {open && (
                                <div style={innerPanel}>
                                    {nc.description && <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #bbb)', whiteSpace: 'pre-wrap' }}>{nc.description}</div>}

                                    {nc.effectiveness_confirmed_at && (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981' }}>
                                            <ShieldCheck size={13} />
                                            {t('compliance.nc_effectiveness_by')} {userName(orgUsers, nc.effectiveness_confirmed_by) || nc.effectiveness_confirmed_by} · {fmtDate(nc.effectiveness_confirmed_at)}
                                        </div>
                                    )}

                                    {nc.status !== 'closed' && e && (
                                        <>
                                            <Field label={t('compliance.nc_f_corrective')}>
                                                <textarea style={{ ...input, resize: 'vertical' }} rows={2} value={e.corrective_action}
                                                    placeholder={t('compliance.nc_f_corrective_ph')}
                                                    onChange={ev => setEditDrafts(d => ({ ...d, [nc.id]: { ...e, corrective_action: ev.target.value } }))} />
                                            </Field>
                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                <Field label={t('compliance.nc_f_due')}>
                                                    <input type="date" style={input} value={e.due_at}
                                                        onChange={ev => setEditDrafts(d => ({ ...d, [nc.id]: { ...e, due_at: ev.target.value } }))} />
                                                </Field>
                                                <Field label={t('compliance.nc_f_eff_due')}>
                                                    <input type="date" style={input} value={e.effectiveness_review_due_at}
                                                        onChange={ev => setEditDrafts(d => ({ ...d, [nc.id]: { ...e, effectiveness_review_due_at: ev.target.value } }))} />
                                                </Field>
                                                <Field label={t('compliance.nc_f_owner')}>
                                                    <select style={input} value={e.owner_user_id}
                                                        onChange={ev => setEditDrafts(d => ({ ...d, [nc.id]: { ...e, owner_user_id: ev.target.value } }))}>
                                                        <option value="">{t('compliance.nc_owner_none')}</option>
                                                        {(orgUsers || []).map(u => (
                                                            <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                                        ))}
                                                    </select>
                                                </Field>
                                                <button disabled={busy} style={btn('transparent', 'var(--accent-primary, #6366f1)')} onClick={() => saveEdit(nc.id)}>
                                                    {t('compliance.nc_save')}
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                {nc.status === 'open' && (
                                                    <button disabled={busy} style={btn('#f59e0b')} onClick={() => onUpdateNc(nc.id, { status: 'corrective_action' })}>
                                                        <ArrowRight size={13} /> {t('compliance.nc_start_ca')}
                                                    </button>
                                                )}
                                                {nc.status === 'corrective_action' && (
                                                    <button disabled={busy} style={btn('#3b82f6')} onClick={() => onUpdateNc(nc.id, { status: 'effectiveness_review' })}>
                                                        <ArrowRight size={13} /> {t('compliance.nc_to_er')}
                                                    </button>
                                                )}
                                                {nc.status === 'effectiveness_review' && (
                                                    <>
                                                        <button disabled={busy} style={btn('#10b981')}
                                                            onClick={() => onUpdateNc(nc.id, { status: 'closed', confirm_effectiveness: true })}>
                                                            <CheckCircle2 size={13} /> {t('compliance.nc_confirm_close')}
                                                        </button>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted, #777)' }}>{t('compliance.nc_confirm_hint')}</span>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                    {nc.status === 'closed' && nc.corrective_action && (
                                        <div>
                                            <div style={label}>{t('compliance.nc_f_corrective')}</div>
                                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #bbb)', whiteSpace: 'pre-wrap' }}>{nc.corrective_action}</div>
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

// ---------------------------------------------------------------- Objectives

const OBJ_STATUS = {
    active: { color: '#0ea5e9', key: 'compliance.obj_status_active' },
    achieved: { color: '#10b981', key: 'compliance.obj_status_achieved' },
    dropped: { color: '#6b7280', key: 'compliance.obj_status_dropped' },
};

function ObjectivesTab({ t, objectives, busy, orgUsers, onCreateObjective, onUpdateObjective }) {
    const [showCreate, setShowCreate] = useState(false);
    const [draft, setDraft] = useState({ title: '', measure: '', target: '', review_due_at: '', owner_user_id: '' });

    if (objectives === null) return <CheckCardSkeleton count={3} />;

    const submit = () => {
        if (!draft.title.trim()) return;
        onCreateObjective({
            title: draft.title.trim(),
            measure: draft.measure.trim() || undefined,
            target: draft.target.trim() || undefined,
            review_due_at: draft.review_due_at || undefined,
            owner_user_id: draft.owner_user_id || undefined,
        });
        setDraft({ title: '', measure: '', target: '', review_due_at: '', owner_user_id: '' });
        setShowCreate(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #888)', flex: 1 }}>
                    {t('compliance.obj_subtitle')}
                </div>
                <button onClick={() => setShowCreate(v => !v)} style={btn('var(--accent-primary, #6366f1)')}>
                    <Plus size={14} /> {t('compliance.obj_add')}
                </button>
            </div>

            {showCreate && (
                <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label={t('compliance.obj_f_title')}>
                        <input style={input} value={draft.title} autoFocus
                            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                    </Field>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <Field label={t('compliance.obj_f_measure')}>
                            <input style={input} value={draft.measure} placeholder={t('compliance.obj_f_measure_ph')}
                                onChange={e => setDraft(d => ({ ...d, measure: e.target.value }))} />
                        </Field>
                        <Field label={t('compliance.obj_f_target')}>
                            <input style={input} value={draft.target} placeholder={t('compliance.obj_f_target_ph')}
                                onChange={e => setDraft(d => ({ ...d, target: e.target.value }))} />
                        </Field>
                        <Field label={t('compliance.obj_f_review')}>
                            <input type="date" style={input} value={draft.review_due_at}
                                onChange={e => setDraft(d => ({ ...d, review_due_at: e.target.value }))} />
                        </Field>
                        <Field label={t('compliance.obj_f_owner')}>
                            <select style={input} value={draft.owner_user_id}
                                onChange={e => setDraft(d => ({ ...d, owner_user_id: e.target.value }))}>
                                <option value="">{t('compliance.nc_owner_none')}</option>
                                {(orgUsers || []).map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submit} disabled={busy} style={btn('#10b981')}>{t('compliance.obj_create')}</button>
                        <button onClick={() => setShowCreate(false)} style={btn('transparent', 'var(--text-muted, #888)')}>
                            {t('compliance.audit_cancel')}
                        </button>
                    </div>
                </div>
            )}

            {objectives.length === 0 && !showCreate ? (
                <Empty text={t('compliance.obj_empty')} />
            ) : (
                <div style={box}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={table}>
                            <thead>
                                <tr>
                                    <th style={th}>{t('compliance.obj_col_objective')}</th>
                                    <th style={th}>{t('compliance.obj_col_measure')}</th>
                                    <th style={th}>{t('compliance.obj_col_target')}</th>
                                    <th style={th}>{t('compliance.obj_col_review')}</th>
                                    <th style={th}>{t('compliance.obj_col_owner')}</th>
                                    <th style={th}>{t('compliance.obj_col_status')}</th>
                                    <th style={th} />
                                </tr>
                            </thead>
                            <tbody>
                                {objectives.map(o => {
                                    const s = OBJ_STATUS[o.status] || OBJ_STATUS.active;
                                    const reviewOverdue = o.review_due_at && o.status === 'active' && new Date(o.review_due_at).getTime() < Date.now();
                                    return (
                                        <tr key={o.id} style={{ opacity: o.status === 'dropped' ? 0.55 : 1 }}>
                                            <td style={{ ...td, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{o.title}</td>
                                            <td style={td}>{o.measure || '—'}</td>
                                            <td style={td}>{o.target || '—'}</td>
                                            <td style={{ ...td, color: reviewOverdue ? '#ef4444' : undefined, fontWeight: reviewOverdue ? 700 : undefined }}>
                                                {fmtDate(o.review_due_at)}
                                            </td>
                                            <td style={td}>{userName(orgUsers, o.owner_user_id) || '—'}</td>
                                            <td style={td}><span style={pill(s.color)}>{t(s.key)}</span></td>
                                            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                                {o.status === 'active' ? (
                                                    <span style={{ display: 'inline-flex', gap: 6 }}>
                                                        <button disabled={busy} style={btn('transparent', '#10b981')} onClick={() => onUpdateObjective(o.id, { status: 'achieved' })}>
                                                            <CheckCircle2 size={12} /> {t('compliance.obj_mark_achieved')}
                                                        </button>
                                                        <button disabled={busy} style={btn('transparent', 'var(--text-muted, #888)')} onClick={() => onUpdateObjective(o.id, { status: 'dropped' })}>
                                                            {t('compliance.obj_mark_dropped')}
                                                        </button>
                                                    </span>
                                                ) : (
                                                    <button disabled={busy} style={btn('transparent', '#0ea5e9')} onClick={() => onUpdateObjective(o.id, { status: 'active' })}>
                                                        {t('compliance.obj_reactivate')}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// -------------------------------------------------------------------- shared

function Field({ label: text, children }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted, #666)' }}>{text}</span>
            {children}
        </label>
    );
}

const box = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 12, padding: 16,
};
const innerPanel = {
    padding: '12px 14px', borderRadius: 8,
    background: 'var(--bg-primary, rgba(0,0,0,0.2))',
    display: 'flex', flexDirection: 'column', gap: 10,
};
const sectionTitle = {
    fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 4,
};
const label = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'var(--text-muted, #666)', marginBottom: 4,
};
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 };
const th = {
    textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.05em', textTransform: 'uppercase',
    color: 'var(--text-muted, #666)',
    borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.08))',
};
const td = {
    padding: '8px 10px', color: 'var(--text-secondary, #bbb)', verticalAlign: 'top',
    borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.04))',
};
const pill = (color) => ({
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    padding: '2px 6px', borderRadius: 4, background: `${color}22`, color, whiteSpace: 'nowrap',
});
const btn = (bg, color = '#fff') => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: bg, color, border: 'none',
    padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
});
const tabBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
};
const warnBox = {
    display: 'flex', gap: 8, alignItems: 'flex-start',
    fontSize: 12, color: '#f59e0b',
    background: '#f59e0b15', border: '1px solid #f59e0b44',
    borderRadius: 8, padding: '10px 12px',
};
const input = {
    background: 'var(--bg-card, #ffffff08)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
    borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
    color: 'var(--text-primary, #eee)', width: '100%',
    outline: 'none', fontFamily: 'inherit',
};
