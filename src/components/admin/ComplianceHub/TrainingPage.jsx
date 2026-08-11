import React, { useState } from 'react';
import { GraduationCap, CalendarClock, Plus, CheckCircle2, Clock, AlertTriangle, Repeat, User } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import { Empty } from '../MonitoringPanel/shared';

/**
 * Training & obligations (ISO 27001 cl. 7.2/7.3 + the ISMS clock).
 *
 * Purely presentational — data arrives via props, mutations leave via
 * callbacks; the parent wires the fetches.
 *
 * (1) Personnel: per member the policy-ack coverage, platform learning
 *     progress when available, and a security-training ATTESTATION for
 *     courses done outside Bee Flow — a human records who/when + note,
 *     never automatic.
 * (2) Obligations: the recurring due-date engine (reviews, audits,
 *     training, pentest…) with countdown coloring and a complete button
 *     that stamps who/when and rolls recurring due dates forward.
 */

const KINDS = [
    'policy_review', 'soa_review', 'internal_audit', 'management_review',
    'training', 'access_review', 'supplier_review', 'pentest', 'custom',
];
const KIND_COLOR = {
    policy_review: '#6366f1', soa_review: '#0ea5e9', internal_audit: '#8b5cf6',
    management_review: '#f59e0b', training: '#10b981', access_review: '#14b8a6',
    supplier_review: '#f97316', pentest: '#ef4444', custom: '#6b7280',
};

function DueBadge({ dueAt }) {
    const { t } = useTranslation();
    const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
    const overdue = days < 0;
    const soon = !overdue && days <= 14;
    const color = overdue ? '#ef4444' : soon ? '#f59e0b' : 'var(--text-muted, #888)';
    // t() returns the raw KEY when a string is missing, so `t(...) || fallback`
    // never fires — the fallback has to be an argument to t() itself.
    const text = overdue
        ? t('compliance.obl_overdue_days', '{days}d overdue', { days: Math.abs(days) })
        : days === 0
            ? t('compliance.obl_due_today', 'due today')
            : t('compliance.obl_due_in_days', 'in {days}d', { days });
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: overdue || soon ? 700 : 500, color }}>
            {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
            {new Date(dueAt).toLocaleDateString()} · {text}
        </span>
    );
}

const EMPTY_DRAFT = { kind: 'policy_review', subject: '', title: '', due_at: '', recur_months: '', owner_user_id: '' };

export default function TrainingPage({ personnel, obligations, busyId, onAttest, onCreateObligation, onCompleteObligation, orgUsers }) {
    const { t } = useTranslation();
    const [attestFor, setAttestFor] = useState(null);
    const [attestNote, setAttestNote] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [draft, setDraft] = useState(EMPTY_DRAFT);

    if (personnel === null || obligations === null) return <CheckCardSkeleton count={3} />;

    const ownerName = (uid) => {
        const u = (orgUsers || []).find(x => x.id === uid);
        return u ? u.displayName : null;
    };

    const submitAttest = (userId) => {
        onAttest(userId, attestNote.trim() || undefined);
        setAttestFor(null);
        setAttestNote('');
    };

    const submitCreate = () => {
        if (!draft.title.trim() || !draft.due_at) return;
        onCreateObligation({
            kind: draft.kind,
            subject: draft.subject.trim() || undefined,
            title: draft.title.trim(),
            due_at: draft.due_at,
            recur_months: draft.recur_months ? Number(draft.recur_months) : undefined,
            owner_user_id: draft.owner_user_id || undefined,
        });
        setDraft(EMPTY_DRAFT);
        setShowCreate(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* (1) Personnel — policy acks, learning, training attestation */}
            <div style={box}>
                <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <GraduationCap size={15} /> {t('compliance.training_personnel_title')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #999)', marginBottom: 12 }}>
                    {t('compliance.training_personnel_desc')}
                </div>
                {personnel.length === 0 ? (
                    <Empty text={t('compliance.training_no_personnel')} />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                        {personnel.map(p => {
                            const acked = p.policy_acks ?? 0;
                            const total = p.policy_total ?? 0;
                            const full = total > 0 && acked >= total;
                            const busy = busyId === p.user_id;
                            const open = attestFor === p.user_id;
                            return (
                                <div key={p.user_id} style={card}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.displayName || p.email}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.email}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                                        <span style={pill(full ? '#10b981' : total > 0 ? '#f59e0b' : '#6b7280')}>
                                            {acked}/{total} {t('compliance.training_policy_acks')}
                                        </span>
                                        {p.learning_done != null && (
                                            <span style={pill('#0ea5e9')}>
                                                {t('compliance.training_learning_done', { count: p.learning_done }) || `${p.learning_done} learning modules`}
                                            </span>
                                        )}
                                    </div>
                                    {open ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <input style={input} value={attestNote} autoFocus
                                                placeholder={t('compliance.training_attest_note_ph')}
                                                onChange={e => setAttestNote(e.target.value)} />
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button disabled={busy} onClick={() => submitAttest(p.user_id)} style={btn('#10b981')}>
                                                    <CheckCircle2 size={13} /> {t('compliance.training_attest_confirm')}
                                                </button>
                                                <button onClick={() => { setAttestFor(null); setAttestNote(''); }} style={btn('transparent', 'var(--text-muted, #888)')}>
                                                    {t('compliance.auto_fix_cancel')}
                                                </button>
                                            </div>
                                            <div style={{ fontSize: 10.5, color: 'var(--text-muted, #777)' }}>
                                                {t('compliance.training_attest_hint')}
                                            </div>
                                        </div>
                                    ) : p.attested_at ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#10b981' }}>
                                                <CheckCircle2 size={13} />
                                                {t('compliance.training_attested_at', { date: new Date(p.attested_at).toLocaleDateString() })
                                                    || `Training attested ${new Date(p.attested_at).toLocaleDateString()}`}
                                            </span>
                                            {p.attested_note && (
                                                <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>{p.attested_note}</span>
                                            )}
                                            <button onClick={() => { setAttestFor(p.user_id); setAttestNote(''); }} style={ghostBtn}>
                                                {t('compliance.training_reattest')}
                                            </button>
                                        </div>
                                    ) : (
                                        <button disabled={busy} onClick={() => { setAttestFor(p.user_id); setAttestNote(''); }}
                                            style={{ ...btn('#6366f1'), alignSelf: 'flex-start' }}>
                                            <GraduationCap size={13} /> {t('compliance.training_attest')}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* (2) Obligations — the ISMS due-date engine */}
            <div style={box}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            <CalendarClock size={15} /> {t('compliance.obl_title')}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted, #999)', marginBottom: 10 }}>
                            {t('compliance.obl_desc')}
                        </div>
                    </div>
                    <button onClick={() => setShowCreate(v => !v)} style={btn('#6366f1')}>
                        <Plus size={14} /> {t('compliance.obl_add')}
                    </button>
                </div>

                {showCreate && (
                    <div style={{ ...card, borderLeft: '4px solid #6366f1', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <Field label={t('compliance.obl_f_kind')}>
                                <select style={input} value={draft.kind}
                                    onChange={e => setDraft(d => ({ ...d, kind: e.target.value }))}>
                                    {KINDS.map(k => (
                                        <option key={k} value={k}>{t(`compliance.obl_kind_${k}`)}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label={t('compliance.obl_f_subject')}>
                                <input style={input} value={draft.subject}
                                    placeholder={t('compliance.obl_f_subject_ph')}
                                    onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} />
                            </Field>
                        </div>
                        <Field label={t('compliance.obl_f_title')}>
                            <input style={input} value={draft.title} autoFocus
                                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                        </Field>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <Field label={t('compliance.obl_f_due')}>
                                <input type="date" style={input} value={draft.due_at}
                                    onChange={e => setDraft(d => ({ ...d, due_at: e.target.value }))} />
                            </Field>
                            <Field label={t('compliance.obl_f_recur')}>
                                <input type="number" min="0" max="120" style={input} value={draft.recur_months}
                                    onChange={e => setDraft(d => ({ ...d, recur_months: e.target.value }))} />
                            </Field>
                            <Field label={t('compliance.obl_f_owner')}>
                                <select style={input} value={draft.owner_user_id}
                                    onChange={e => setDraft(d => ({ ...d, owner_user_id: e.target.value }))}>
                                    <option value="">{t('compliance.obl_owner_none')}</option>
                                    {(orgUsers || []).map(u => (
                                        <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
                            {t('compliance.obl_recur_hint')}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={submitCreate} style={btn('#6366f1')}>{t('compliance.obl_create')}</button>
                            <button onClick={() => setShowCreate(false)} style={btn('transparent', 'var(--text-muted, #888)')}>
                                {t('compliance.auto_fix_cancel')}
                            </button>
                        </div>
                    </div>
                )}

                {obligations.length === 0 ? (
                    <Empty text={t('compliance.obl_empty')} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {obligations.map(o => {
                            const busy = busyId === o.id;
                            const done = !!o.completed_at;
                            const owner = ownerName(o.owner_user_id);
                            return (
                                <div key={o.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px',
                                    borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.05))',
                                    opacity: done ? 0.55 : 1,
                                }}>
                                    <span style={pill(KIND_COLOR[o.kind] || '#6b7280')}>
                                        {t(`compliance.obl_kind_${o.kind}`) || o.kind}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                                            {o.title}
                                            {o.subject && (
                                                <span style={{ fontWeight: 400, color: 'var(--text-muted, #888)' }}> · {o.subject}</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 3 }}>
                                            <DueBadge dueAt={o.due_at} />
                                            {o.recur_months && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted, #888)' }}>
                                                    <Repeat size={11} />
                                                    {t('compliance.obl_recur_every', { months: o.recur_months }) || `every ${o.recur_months} mo`}
                                                </span>
                                            )}
                                            {owner && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted, #888)' }}>
                                                    <User size={11} /> {owner}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {done ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#10b981', flexShrink: 0 }}>
                                            <CheckCircle2 size={13} />
                                            {t('compliance.obl_completed_at', { date: new Date(o.completed_at).toLocaleDateString() })
                                                || `Done ${new Date(o.completed_at).toLocaleDateString()}`}
                                        </span>
                                    ) : (
                                        <button disabled={busy} onClick={() => onCompleteObligation(o.id)}
                                            style={{ ...btn('#10b981'), flexShrink: 0 }}>
                                            <CheckCircle2 size={13} /> {t('compliance.obl_complete')}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
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

const box = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 12, padding: 16,
};
const sectionTitle = {
    fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 10,
};
const card = {
    background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 10, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 2,
};
const pill = (color) => ({
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    padding: '2px 7px', borderRadius: 5, background: `${color}22`, color, whiteSpace: 'nowrap',
});
const btn = (bg, color = '#fff') => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: bg, color, border: 'none',
    padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
});
const ghostBtn = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted, #888)', padding: 0, borderRadius: 4,
    fontSize: 10.5, fontFamily: 'inherit', alignSelf: 'flex-start', textDecoration: 'underline',
};
const input = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
    color: 'var(--text-primary, #fff)', width: '100%',
    outline: 'none', fontFamily: 'inherit',
};
