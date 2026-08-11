import React, { useState } from 'react';
import { Sprout, FileText, UploadCloud, Save, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import { Empty } from '../MonitoringPanel/shared';

/**
 * ISMS policy documents (ISO 27001 A.5.1 / clause 7.5 / 7.3).
 *
 * Master-detail: seeded templates become the org's OWN documents on first
 * save; publishing freezes an immutable sha256'd version that member
 * acknowledgements bind to. The "template not customised" nudge stays until
 * the body actually diverges from the seed — auditors spot unedited templates
 * instantly.
 */
export default function PoliciesPage({ docs, busySlug, onSeed, onSave, onPublish, onLoadDoc, orgUsers }) {
    const { t } = useTranslation();
    const [openSlug, setOpenSlug] = useState(null);
    const [draft, setDraft] = useState(null);

    if (docs === null) return <CheckCardSkeleton count={3} />;

    const documents = docs?.documents || [];
    const missing = docs?.missing_seeds || [];

    const openDoc = async (slug) => {
        if (openSlug === slug) { setOpenSlug(null); setDraft(null); return; }
        setOpenSlug(slug);
        setDraft(null);
        const full = await onLoadDoc(slug);
        if (full) {
            setDraft({
                title: full.title || '',
                body: full.draft_body || '',
                owner_user_id: full.owner_user_id || '',
                review_due_at: full.review_due_at ? String(full.review_due_at).slice(0, 10) : '',
                edited: !!full.edited,
                status: full.status,
                current_version: full.current_version,
                ack_count: full.ack_count,
            });
        }
    };

    const patchFromDraft = () => ({
        title: draft.title,
        body: draft.body,
        owner_user_id: draft.owner_user_id || null,
        review_due_at: draft.review_due_at || null,
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {missing.length > 0 && (
                <div style={{ ...box, borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary, #bbb)' }}>
                        {t('compliance.policies_seed_hint', { count: missing.length }, null) || `${missing.length} policy templates available to seed`}
                    </div>
                    <button onClick={onSeed} disabled={!!busySlug} style={primaryBtn}>
                        <Sprout size={14} /> {t('compliance.policies_seed_button')}
                    </button>
                </div>
            )}

            {documents.length === 0 && missing.length === 0 && (
                <Empty text={t('compliance.policies_empty')} />
            )}

            {documents.map(d => {
                const open = openSlug === d.slug;
                return (
                    <div key={d.slug} style={box}>
                        <div onClick={() => openDoc(d.slug)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexWrap: 'wrap' }}>
                            <FileText size={16} style={{ color: d.status === 'published' ? '#10b981' : '#f59e0b', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 180 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{d.title}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--text-muted, #999)', marginTop: 2 }}>
                                    {d.status === 'published'
                                        ? (t('compliance.policies_published_v', { version: d.current_version }, null) || `Published v${d.current_version}`)
                                        : t('compliance.policies_draft')}
                                    {d.status === 'published' && (
                                        <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            <Users size={11} /> {d.ack_count ?? 0} {t('compliance.policies_acks')}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {!d.edited && (
                                <span style={{ ...pill('#f59e0b'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <AlertTriangle size={11} /> {t('compliance.policies_not_customised')}
                                </span>
                            )}
                            {d.review_due_at && new Date(d.review_due_at) < new Date() && (
                                <span style={pill('#ef4444')}>{t('compliance.policies_review_overdue')}</span>
                            )}
                        </div>

                        {open && draft && (
                            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label style={fieldLabel}>
                                    {t('compliance.policies_title_label')}
                                    <input value={draft.title}
                                        onChange={e => setDraft(x => ({ ...x, title: e.target.value }))}
                                        style={input} />
                                </label>
                                <label style={fieldLabel}>
                                    {t('compliance.policies_body_label')}
                                    <textarea value={draft.body} rows={16} spellCheck={false}
                                        onChange={e => setDraft(x => ({ ...x, body: e.target.value }))}
                                        style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.55 }} />
                                </label>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                    <label style={{ ...fieldLabel, flex: 1, minWidth: 170 }}>
                                        {t('compliance.policies_owner')}
                                        <select value={draft.owner_user_id}
                                            onChange={e => setDraft(x => ({ ...x, owner_user_id: e.target.value }))}
                                            style={input}>
                                            <option value="">{t('compliance.soa_owner_none')}</option>
                                            {(orgUsers || []).map(u => (
                                                <option key={u.id} value={u.id}>{u.displayName} — {u.email}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label style={{ ...fieldLabel, minWidth: 150 }}>
                                        {t('compliance.policies_review_due')}
                                        <input type="date" value={draft.review_due_at}
                                            onChange={e => setDraft(x => ({ ...x, review_due_at: e.target.value }))}
                                            style={input} />
                                    </label>
                                    <button disabled={busySlug === d.slug}
                                        onClick={() => onSave(d.slug, patchFromDraft())}
                                        style={secondaryBtn}>
                                        <Save size={14} /> {t('compliance.policies_save')}
                                    </button>
                                    <button disabled={busySlug === d.slug}
                                        onClick={async () => { await onSave(d.slug, patchFromDraft()); onPublish(d.slug); }}
                                        style={primaryBtn}
                                        title={t('compliance.policies_publish_hint')}>
                                        <UploadCloud size={14} /> {t('compliance.policies_publish')}
                                    </button>
                                </div>
                                {!draft.edited && (
                                    <div style={{ fontSize: 11.5, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <AlertTriangle size={12} /> {t('compliance.policies_customise_nudge')}
                                    </div>
                                )}
                                {draft.status === 'published' && (
                                    <div style={{ fontSize: 11.5, color: 'var(--text-muted, #888)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <CheckCircle2 size={12} style={{ color: '#10b981' }} /> {t('compliance.policies_republish_note')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

const box = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 12, padding: 16,
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
const secondaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'transparent', color: 'var(--text-secondary, #bbb)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.15))',
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
