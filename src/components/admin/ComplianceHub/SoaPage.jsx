import React, { useMemo, useState } from 'react';
import { Sprout, ChevronDown, ChevronRight, CheckCircle2, Circle, Eye } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';

/**
 * Statement of Applicability (ISO 27001 6.1.3 d) — 93 Annex A rows.
 *
 * The SoA is rows-with-a-trail, never a generated document: each row records
 * applicability, justification, HOW it is satisfied (auto/connector/attest/
 * inherited), an owner, and a review status. Automated checks linked via the
 * registry's `controls` arrays show their live result next to the decision.
 */
export default function SoaPage({ soa, checks, busyRef, onSeed, onUpdate, orgUsers }) {
    const { t } = useTranslation();
    const [openRef, setOpenRef] = useState(null);
    const [draft, setDraft] = useState(null);

    // Latest status per check id (checks carry per-subject rows; worst wins).
    const checkStatus = useMemo(() => {
        const rank = { fail: 3, warn: 2, pass: 1, not_applicable: 0 };
        const map = {};
        for (const c of checks || []) {
            const prev = map[c.check_id];
            if (!prev || (rank[c.status] || 0) > (rank[prev] || 0)) map[c.check_id] = c.status;
        }
        return map;
    }, [checks]);

    if (soa === null) return <CheckCardSkeleton count={3} />;

    const controls = soa?.controls || [];
    const stats = soa?.stats || { total: 0, approved: 0, reviewed: 0, todo: 0, excluded: 0 };
    const missing = controls.length - stats.total;
    const themes = [5, 6, 7, 8];

    const openRow = (c) => {
        if (openRef === c.ref) { setOpenRef(null); setDraft(null); return; }
        setOpenRef(c.ref);
        setDraft({
            applicable: c.entry ? !!c.entry.applicable : true,
            justification: c.entry?.justification || '',
            status: c.entry?.status || 'todo',
            owner_user_id: c.entry?.owner_user_id || '',
            source: c.entry?.source || (c.bucket === 'physical' ? 'inherited' : c.bucket === 'auto' ? 'auto' : c.bucket === 'connector' ? 'connector' : 'attest'),
        });
    };

    const save = (ref) => {
        onUpdate(ref, {
            applicable: draft.applicable,
            justification: draft.justification || null,
            status: draft.status,
            owner_user_id: draft.owner_user_id || null,
            source: draft.source,
        });
        setOpenRef(null);
        setDraft(null);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Progress header */}
            <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                        {t('compliance.soa_progress', { approved: stats.approved, total: controls.length }, null)
                            || `${stats.approved}/${controls.length} rows approved`}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={pill('#10b981')}>{stats.approved} {t('compliance.soa_status_approved')}</span>
                        <span style={pill('#0ea5e9')}>{stats.reviewed} {t('compliance.soa_status_reviewed')}</span>
                        <span style={pill('#f59e0b')}>{stats.todo} {t('compliance.soa_status_todo')}</span>
                        <span style={pill('#6b7280')}>{stats.excluded} {t('compliance.soa_excluded')}</span>
                    </div>
                </div>
                {missing > 0 && (
                    <button onClick={onSeed} disabled={!!busyRef} style={primaryBtn} title={t('compliance.soa_seed_hint')}>
                        <Sprout size={14} /> {t('compliance.soa_seed_button', { count: missing }, null) || `Seed ${missing} missing rows`}
                    </button>
                )}
            </div>

            {themes.map(theme => {
                const rows = controls.filter(c => c.theme === theme);
                if (!rows.length) return null;
                return (
                    <div key={theme} style={box}>
                        <div style={sectionTitle}>
                            {t(`compliance.iso.theme_${theme}`)}
                            <span style={{ fontWeight: 400, color: 'var(--text-muted, #888)', marginLeft: 8, fontSize: 11 }}>
                                {rows.length}
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={table}>
                                <thead>
                                    <tr>
                                        <th style={{ ...th, width: 26 }} />
                                        <th style={th}>{t('compliance.soa_col_control')}</th>
                                        <th style={th}>{t('compliance.soa_col_title')}</th>
                                        <th style={th}>{t('compliance.soa_col_how')}</th>
                                        <th style={th}>{t('compliance.soa_col_check')}</th>
                                        <th style={th}>{t('compliance.soa_col_status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(c => {
                                        const excluded = c.entry && !c.entry.applicable;
                                        const status = c.entry?.status || 'todo';
                                        const worst = c.checks.map(id => checkStatus[id]).filter(Boolean)
                                            .sort((a, b) => (RANK[b] || 0) - (RANK[a] || 0))[0] || null;
                                        const open = openRef === c.ref;
                                        return (
                                            <React.Fragment key={c.ref}>
                                                <tr onClick={() => openRow(c)} style={{ cursor: 'pointer', opacity: excluded ? 0.55 : 1 }}>
                                                    <td style={td}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                                                    <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--text-primary, #fff)' }}>{c.ref}</td>
                                                    <td style={td}>
                                                        {t(c.titleKey)}
                                                        {excluded && <span style={{ ...pill('#6b7280'), marginLeft: 6 }}>{t('compliance.soa_excluded')}</span>}
                                                    </td>
                                                    <td style={td}><span style={pill(BUCKET_COLOR[c.entry?.source || c.bucket] || '#6b7280')}>{t(`compliance.iso.bucket_${normBucket(c.entry?.source || c.bucket)}`)}</span></td>
                                                    <td style={td}>
                                                        {worst
                                                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: STATUS_COLOR[worst] }}>
                                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[worst], display: 'inline-block' }} />
                                                                {t(`compliance.status_${worst}`, worst, null) || worst}
                                                            </span>
                                                            : <span style={{ fontSize: 11, color: 'var(--text-muted, #777)' }}>{t('compliance.soa_check_none')}</span>}
                                                    </td>
                                                    <td style={td}><StatusIcon status={excluded ? 'excluded' : status} t={t} /></td>
                                                </tr>
                                                {open && draft && (
                                                    <tr>
                                                        <td colSpan={6} style={{ ...td, background: 'var(--bg-tertiary, rgba(255,255,255,0.03))', padding: 14 }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onClick={e => e.stopPropagation()}>
                                                                <div style={{ fontSize: 12, color: 'var(--text-secondary, #bbb)' }}>{t(c.objectiveKey)}</div>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-primary, #eee)' }}>
                                                                    <input type="checkbox" checked={draft.applicable}
                                                                        onChange={e => setDraft(d => ({ ...d, applicable: e.target.checked }))} />
                                                                    {t('compliance.soa_applicable')}
                                                                </label>
                                                                <label style={fieldLabel}>
                                                                    {t('compliance.soa_justification')}
                                                                    <textarea value={draft.justification} rows={3}
                                                                        placeholder={t('compliance.soa_justification_ph')}
                                                                        onChange={e => setDraft(d => ({ ...d, justification: e.target.value }))}
                                                                        style={input} />
                                                                </label>
                                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                                    <label style={{ ...fieldLabel, flex: 1, minWidth: 160 }}>
                                                                        {t('compliance.soa_col_owner')}
                                                                        <select value={draft.owner_user_id}
                                                                            onChange={e => setDraft(d => ({ ...d, owner_user_id: e.target.value }))}
                                                                            style={input}>
                                                                            <option value="">{t('compliance.soa_owner_none')}</option>
                                                                            {(orgUsers || []).map(u => (
                                                                                <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                    <label style={{ ...fieldLabel, minWidth: 140 }}>
                                                                        {t('compliance.soa_col_status')}
                                                                        <select value={draft.status}
                                                                            onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}
                                                                            style={input}>
                                                                            <option value="todo">{t('compliance.soa_status_todo')}</option>
                                                                            <option value="reviewed">{t('compliance.soa_status_reviewed')}</option>
                                                                            <option value="approved">{t('compliance.soa_status_approved')}</option>
                                                                        </select>
                                                                    </label>
                                                                    <button onClick={() => save(c.ref)} disabled={busyRef === c.ref} style={primaryBtn}>
                                                                        <CheckCircle2 size={14} /> {t('compliance.soa_save')}
                                                                    </button>
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

const RANK = { fail: 3, warn: 2, pass: 1, not_applicable: 0 };
const STATUS_COLOR = { pass: '#10b981', warn: '#f59e0b', fail: '#ef4444', not_applicable: '#6b7280' };
const BUCKET_COLOR = { auto: '#10b981', connector: '#6366f1', attest: '#f59e0b', physical: '#6b7280', inherited: '#6b7280' };
// entry.source 'inherited' shares the physical bucket label.
const normBucket = (b) => (b === 'inherited' ? 'physical' : b);

function StatusIcon({ status, t }) {
    if (status === 'approved') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#10b981', fontSize: 12 }}><CheckCircle2 size={13} /> {t('compliance.soa_status_approved')}</span>;
    if (status === 'reviewed') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#0ea5e9', fontSize: 12 }}><Eye size={13} /> {t('compliance.soa_status_reviewed')}</span>;
    if (status === 'excluded') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6b7280', fontSize: 12 }}><Circle size={13} /> {t('compliance.soa_excluded')}</span>;
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-muted, #888)', fontSize: 12 }}><Circle size={13} /> {t('compliance.soa_status_todo')}</span>;
}

const box = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 12, padding: 16,
};
const sectionTitle = {
    fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 10,
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
const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#10b981', color: '#fff', border: 'none',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
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
