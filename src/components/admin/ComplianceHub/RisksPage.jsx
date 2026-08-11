import React, { useState } from 'react';
import { Sprout, Plus, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, ShieldCheck, Save } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import { Empty } from '../MonitoringPanel/shared';

/**
 * Risk register (ISO 27001 clause 6.1.2/6.1.3) — likelihood × impact scoring,
 * treatment plans, and risk acceptance as an explicit, recorded human decision
 * (who accepted, when). Purely presentational: data arrives via props, all
 * mutations go through callback props wired by the parent.
 */
const STATUS_ORDER = ['open', 'treating', 'accepted', 'closed'];
const STATUS_COLOR = { open: '#ef4444', treating: '#f59e0b', accepted: '#8b5cf6', closed: '#10b981' };
const CATEGORIES = ['confidentiality', 'integrity', 'availability', 'compliance'];
const OPTIONS = ['mitigate', 'transfer', 'avoid', 'accept'];
const SCALE = [1, 2, 3, 4, 5];

// Score bands: 1–4 green, 5–9 amber, 10–15 orange, 16–25 red.
const bandColor = (score) => (score >= 16 ? '#ef4444' : score >= 10 ? '#f97316' : score >= 5 ? '#f59e0b' : '#10b981');

const isOverdue = (r) => r.review_due_at && r.status !== 'closed' && new Date(r.review_due_at).getTime() < Date.now();

const EMPTY_DRAFT = { title: '', description: '', category: 'confidentiality', likelihood: 3, impact: 3, owner_user_id: '' };
const EMPTY_TREATMENT = { option: 'mitigate', description: '', due_at: '' };

export default function RisksPage({ risks, treatments, stats, busyId, onCreate, onUpdate, onAddTreatment, onSeed, orgUsers }) {
    const { t } = useTranslation();
    const [openId, setOpenId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [createDraft, setCreateDraft] = useState(EMPTY_DRAFT);
    const [treatDraft, setTreatDraft] = useState(EMPTY_TREATMENT);

    if (risks === null) return <CheckCardSkeleton count={3} />;

    const s = stats || { total: 0, open: 0, treating: 0, accepted: 0, closed: 0, high: 0, overdue_reviews: 0 };

    const userName = (id) => {
        if (!id) return null;
        const u = (orgUsers || []).find(x => x.id === id);
        return u ? u.displayName : id;
    };

    const openRow = (r) => {
        if (openId === r.id) { setOpenId(null); setDraft(null); return; }
        setOpenId(r.id);
        setDraft({
            title: r.title || '',
            description: r.description || '',
            category: r.category || 'confidentiality',
            likelihood: r.likelihood || 3,
            impact: r.impact || 3,
            status: r.status || 'open',
            owner_user_id: r.owner_user_id || '',
            review_due_at: r.review_due_at ? String(r.review_due_at).slice(0, 10) : '',
        });
        setTreatDraft(EMPTY_TREATMENT);
    };

    const saveRow = (id) => {
        onUpdate(id, {
            title: draft.title.trim() || undefined,
            description: draft.description.trim() || null,
            category: draft.category,
            likelihood: Number(draft.likelihood),
            impact: Number(draft.impact),
            status: draft.status,
            owner_user_id: draft.owner_user_id || null,
            review_due_at: draft.review_due_at || null,
        });
        setOpenId(null);
        setDraft(null);
    };

    const submitCreate = async () => {
        if (!createDraft.title.trim()) return;
        await onCreate({
            title: createDraft.title.trim(),
            description: createDraft.description.trim() || undefined,
            category: createDraft.category,
            likelihood: Number(createDraft.likelihood),
            impact: Number(createDraft.impact),
            owner_user_id: createDraft.owner_user_id || undefined,
        });
        setCreateDraft(EMPTY_DRAFT);
        setShowCreate(false);
    };

    const submitTreatment = async (riskId) => {
        await onAddTreatment(riskId, {
            option: treatDraft.option,
            description: treatDraft.description.trim() || undefined,
            due_at: treatDraft.due_at || undefined,
        });
        setTreatDraft(EMPTY_TREATMENT);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Stats bar + actions */}
            <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <Stat label={t('compliance.risk_stats_total')} value={s.total} />
                    <Stat label={t('compliance.risk_stats_open')} value={s.open} color={s.open > 0 ? '#ef4444' : undefined} />
                    <Stat label={t('compliance.risk_stats_high')} value={s.high} color={s.high > 0 ? '#f97316' : undefined} />
                    <Stat label={t('compliance.risk_stats_overdue')} value={s.overdue_reviews} color={s.overdue_reviews > 0 ? '#f59e0b' : undefined} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={onSeed} disabled={!!busyId} style={ghostBtn} title={t('compliance.risk_seed_hint')}>
                        <Sprout size={14} /> {t('compliance.risk_seed_button')}
                    </button>
                    <button onClick={() => setShowCreate(v => !v)} style={primaryBtn}>
                        <Plus size={14} /> {t('compliance.risk_add')}
                    </button>
                </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{t('compliance.risk_subtitle')}</div>

            {/* Create form (collapsed by default) */}
            {showCreate && (
                <div style={{ ...box, borderLeft: '4px solid #f97316', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label={t('compliance.risk_f_title')}>
                        <input style={input} value={createDraft.title} autoFocus
                            onChange={e => setCreateDraft(d => ({ ...d, title: e.target.value }))} />
                    </Field>
                    <Field label={t('compliance.risk_f_desc')}>
                        <textarea style={{ ...input, resize: 'vertical' }} rows={3} value={createDraft.description}
                            placeholder={t('compliance.risk_f_desc_ph')}
                            onChange={e => setCreateDraft(d => ({ ...d, description: e.target.value }))} />
                    </Field>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <Field label={t('compliance.risk_f_category')}>
                            <select style={input} value={createDraft.category}
                                onChange={e => setCreateDraft(d => ({ ...d, category: e.target.value }))}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{t(`compliance.risk_cat_${c}`)}</option>)}
                            </select>
                        </Field>
                        <Field label={t('compliance.risk_f_likelihood')}>
                            <select style={input} value={createDraft.likelihood}
                                onChange={e => setCreateDraft(d => ({ ...d, likelihood: e.target.value }))}>
                                {SCALE.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </Field>
                        <Field label={t('compliance.risk_f_impact')}>
                            <select style={input} value={createDraft.impact}
                                onChange={e => setCreateDraft(d => ({ ...d, impact: e.target.value }))}>
                                {SCALE.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </Field>
                        <Field label={t('compliance.risk_f_owner')}>
                            <select style={input} value={createDraft.owner_user_id}
                                onChange={e => setCreateDraft(d => ({ ...d, owner_user_id: e.target.value }))}>
                                <option value="">{t('compliance.risk_owner_none')}</option>
                                {(orgUsers || []).map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={submitCreate} disabled={!!busyId} style={primaryBtn}>{t('compliance.risk_create')}</button>
                        <button onClick={() => setShowCreate(false)} style={ghostBtn}>{t('compliance.risk_cancel')}</button>
                    </div>
                </div>
            )}

            {risks.length === 0 && !showCreate && <Empty text={t('compliance.risk_empty')} />}

            {/* Risk table grouped by status */}
            {STATUS_ORDER.map(status => {
                const rows = risks.filter(r => r.status === status);
                if (!rows.length) return null;
                return (
                    <div key={status} style={box}>
                        <div style={sectionTitle}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block', marginRight: 7 }} />
                            {t(`compliance.risk_status_${status}`)}
                            <span style={{ fontWeight: 400, color: 'var(--text-muted, #888)', marginLeft: 8, fontSize: 11 }}>{rows.length}</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={table}>
                                <thead>
                                    <tr>
                                        <th style={{ ...th, width: 26 }} />
                                        <th style={th}>{t('compliance.risk_col_risk')}</th>
                                        <th style={th}>{t('compliance.risk_col_category')}</th>
                                        <th style={th}>{t('compliance.risk_col_score')}</th>
                                        <th style={th}>{t('compliance.risk_col_owner')}</th>
                                        <th style={th}>{t('compliance.risk_col_review')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => {
                                        const open = openId === r.id;
                                        const busy = busyId === r.id;
                                        const riskTreatments = (treatments || []).filter(tr => tr.risk_id === r.id);
                                        return (
                                            <React.Fragment key={r.id}>
                                                <tr onClick={() => openRow(r)} style={{ cursor: 'pointer' }}>
                                                    <td style={td}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                                                    <td style={{ ...td, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                                                        {r.title}
                                                        {isOverdue(r) && (
                                                            <span style={{ ...pill('#f59e0b'), marginLeft: 6 }}>
                                                                <AlertTriangle size={9} style={{ marginRight: 3, verticalAlign: -1 }} />
                                                                {t('compliance.risk_overdue_pill')}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={td}>
                                                        {r.category
                                                            ? <span style={pill('#6366f1')}>
                                                                {CATEGORIES.includes(r.category) ? t(`compliance.risk_cat_${r.category}`) : r.category}
                                                            </span>
                                                            : '—'}
                                                    </td>
                                                    <td style={td}>
                                                        <span style={scoreBadge(bandColor(r.score))}>{r.score}</span>
                                                        <span style={{ fontSize: 10.5, color: 'var(--text-muted, #777)', marginLeft: 6 }}>
                                                            {t('compliance.risk_score_formula', { likelihood: r.likelihood, impact: r.impact }, null)
                                                                || `L${r.likelihood} × I${r.impact}`}
                                                        </span>
                                                    </td>
                                                    <td style={td}>{userName(r.owner_user_id) || '—'}</td>
                                                    <td style={td}>{r.review_due_at ? new Date(r.review_due_at).toLocaleDateString() : '—'}</td>
                                                </tr>
                                                {open && draft && (
                                                    <tr>
                                                        <td colSpan={6} style={{ ...td, background: 'var(--bg-tertiary, rgba(255,255,255,0.03))', padding: 14 }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onClick={e => e.stopPropagation()}>
                                                                {/* Edit fields */}
                                                                <Field label={t('compliance.risk_f_title')}>
                                                                    <input style={input} value={draft.title}
                                                                        onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                                                                </Field>
                                                                <Field label={t('compliance.risk_f_desc')}>
                                                                    <textarea style={{ ...input, resize: 'vertical' }} rows={2} value={draft.description}
                                                                        onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                                                                </Field>
                                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                                    <Field label={t('compliance.risk_f_category')}>
                                                                        <select style={input} value={draft.category}
                                                                            onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}>
                                                                            {CATEGORIES.map(c => <option key={c} value={c}>{t(`compliance.risk_cat_${c}`)}</option>)}
                                                                            {!CATEGORIES.includes(draft.category) && <option value={draft.category}>{draft.category}</option>}
                                                                        </select>
                                                                    </Field>
                                                                    <Field label={t('compliance.risk_f_likelihood')}>
                                                                        <select style={input} value={draft.likelihood}
                                                                            onChange={e => setDraft(d => ({ ...d, likelihood: e.target.value }))}>
                                                                            {SCALE.map(n => <option key={n} value={n}>{n}</option>)}
                                                                        </select>
                                                                    </Field>
                                                                    <Field label={t('compliance.risk_f_impact')}>
                                                                        <select style={input} value={draft.impact}
                                                                            onChange={e => setDraft(d => ({ ...d, impact: e.target.value }))}>
                                                                            {SCALE.map(n => <option key={n} value={n}>{n}</option>)}
                                                                        </select>
                                                                    </Field>
                                                                    <Field label={t('compliance.risk_f_owner')}>
                                                                        <select style={input} value={draft.owner_user_id}
                                                                            onChange={e => setDraft(d => ({ ...d, owner_user_id: e.target.value }))}>
                                                                            <option value="">{t('compliance.risk_owner_none')}</option>
                                                                            {(orgUsers || []).map(u => (
                                                                                <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                                                            ))}
                                                                        </select>
                                                                    </Field>
                                                                    <Field label={t('compliance.risk_f_review_due')}>
                                                                        <input type="date" style={input} value={draft.review_due_at}
                                                                            onChange={e => setDraft(d => ({ ...d, review_due_at: e.target.value }))} />
                                                                    </Field>
                                                                    <Field label={t('compliance.risk_col_status')}>
                                                                        <select style={input} value={draft.status}
                                                                            onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                                                                            <option value="open">{t('compliance.risk_status_open')}</option>
                                                                            <option value="treating">{t('compliance.risk_status_treating')}</option>
                                                                            {draft.status === 'accepted' && <option value="accepted">{t('compliance.risk_status_accepted')}</option>}
                                                                            <option value="closed">{t('compliance.risk_status_closed')}</option>
                                                                        </select>
                                                                    </Field>
                                                                    <button onClick={() => saveRow(r.id)} disabled={busy} style={primaryBtn}>
                                                                        <Save size={14} /> {t('compliance.risk_save')}
                                                                    </button>
                                                                </div>

                                                                {/* Acceptance — an explicit, recorded decision */}
                                                                {r.status === 'accepted' && r.accepted_at ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8b5cf6' }}>
                                                                        <ShieldCheck size={13} />
                                                                        {t('compliance.risk_accepted_stamp', {
                                                                            name: userName(r.accepted_by) || '—',
                                                                            date: new Date(r.accepted_at).toLocaleDateString(),
                                                                        }, null) || `Accepted by ${userName(r.accepted_by) || '—'} on ${new Date(r.accepted_at).toLocaleDateString()}`}
                                                                    </div>
                                                                ) : r.status !== 'closed' && (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                        <button onClick={() => onUpdate(r.id, { status: 'accepted' })} disabled={busy}
                                                                            style={{ ...acceptBtn, alignSelf: 'flex-start' }}>
                                                                            <CheckCircle2 size={14} /> {t('compliance.risk_accept_button')}
                                                                        </button>
                                                                        <div style={{ fontSize: 11, color: 'var(--text-muted, #777)' }}>
                                                                            {t('compliance.risk_accept_note')}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Treatments */}
                                                                <div>
                                                                    <div style={miniTitle}>{t('compliance.risk_treatments')}</div>
                                                                    {riskTreatments.length === 0 ? (
                                                                        <div style={{ fontSize: 12, color: 'var(--text-muted, #777)' }}>
                                                                            {t('compliance.risk_no_treatments')}
                                                                        </div>
                                                                    ) : (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                            {riskTreatments.map(tr => (
                                                                                <div key={tr.id} style={{
                                                                                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                                                                                    fontSize: 12, color: 'var(--text-secondary, #bbb)',
                                                                                    padding: '6px 8px', borderRadius: 6,
                                                                                    background: 'var(--bg-card, rgba(255,255,255,0.03))',
                                                                                }}>
                                                                                    <span style={pill(tr.done_at ? '#10b981' : '#6366f1')}>
                                                                                        {t(`compliance.risk_opt_${tr.option}`, tr.option, null) || tr.option}
                                                                                    </span>
                                                                                    <span style={{ flex: 1, minWidth: 120 }}>{tr.description || '—'}</span>
                                                                                    <span style={{ fontSize: 11, color: 'var(--text-muted, #777)' }}>
                                                                                        {tr.done_at
                                                                                            ? (t('compliance.risk_t_done', { date: new Date(tr.done_at).toLocaleDateString() }, null)
                                                                                                || `Done ${new Date(tr.done_at).toLocaleDateString()}`)
                                                                                            : tr.due_at
                                                                                                ? `${t('compliance.risk_t_due')} ${new Date(tr.due_at).toLocaleDateString()}`
                                                                                                : '—'}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
                                                                        <Field label={t('compliance.risk_t_option')}>
                                                                            <select style={input} value={treatDraft.option}
                                                                                onChange={e => setTreatDraft(d => ({ ...d, option: e.target.value }))}>
                                                                                {OPTIONS.map(o => <option key={o} value={o}>{t(`compliance.risk_opt_${o}`)}</option>)}
                                                                            </select>
                                                                        </Field>
                                                                        <Field label={t('compliance.risk_t_desc')} grow>
                                                                            <input style={input} value={treatDraft.description}
                                                                                onChange={e => setTreatDraft(d => ({ ...d, description: e.target.value }))} />
                                                                        </Field>
                                                                        <Field label={t('compliance.risk_t_due')}>
                                                                            <input type="date" style={input} value={treatDraft.due_at}
                                                                                onChange={e => setTreatDraft(d => ({ ...d, due_at: e.target.value }))} />
                                                                        </Field>
                                                                        <button onClick={() => submitTreatment(r.id)} disabled={busy} style={ghostBtn}>
                                                                            <Plus size={13} /> {t('compliance.risk_t_add')}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Stat({ label: text, value, color }) {
    return (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted, #666)' }}>{text}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary, #fff)' }}>{value}</div>
        </div>
    );
}

function Field({ label: text, children, grow }) {
    return (
        <label style={{ ...fieldLabel, ...(grow ? { flex: '1 1 180px' } : { minWidth: 120 }) }}>
            {text}
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
    display: 'flex', alignItems: 'center',
};
const miniTitle = {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    color: 'var(--text-muted, #888)', marginBottom: 6,
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
    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
    background: `${color}22`, color, whiteSpace: 'nowrap',
});
const scoreBadge = (color) => ({
    display: 'inline-block', minWidth: 26, textAlign: 'center',
    fontSize: 12, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
    background: `${color}22`, color, border: `1px solid ${color}55`,
});
const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#10b981', color: '#fff', border: 'none',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
};
const acceptBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#8b5cf6', color: '#fff', border: 'none',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
};
const ghostBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'transparent', color: 'var(--text-secondary, #bbb)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
    padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
};
const fieldLabel = {
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: 'var(--text-muted, #888)',
};
const input = {
    background: 'var(--bg-card, #ffffff08)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
    borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
    color: 'var(--text-primary, #eee)', width: '100%',
    outline: 'none', fontFamily: 'inherit',
};
