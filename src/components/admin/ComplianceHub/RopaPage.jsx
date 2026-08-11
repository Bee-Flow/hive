import React from 'react';
import { RefreshCw, CheckCircle2, Globe2, ShieldCheck, ShieldAlert, FileDown } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import { Empty } from '../MonitoringPanel/shared';

/**
 * Records of Processing Activities (GDPR Art. 30) — rendered straight from the
 * server-side synthesis (/api/compliance/ropa). The admin's job is to REVIEW
 * and attest, not to type the register from scratch: agents become activities,
 * observed egress operators become processors, settings become the controller
 * block. Non-EU processors carry a per-operator SCC attestation toggle.
 */
export default function RopaPage({ ropa, busy, pdfUrl, onReview, onSccToggle, onRefresh }) {
    const { t } = useTranslation();

    if (ropa === null) return <CheckCardSkeleton count={3} />;
    if (ropa?.error) return <Empty text={t('compliance.ropa_load_failed')} />;

    const sccConfirmed = new Set(
        (ropa.scc_confirmed_operators || []).map(o => String(o?.operator || o || '').toLowerCase()).filter(Boolean)
    );
    // The overview settings row carries the attestations; the /ropa payload may
    // not repeat them — derive the confirmed set from processor rows as backup.
    const isConfirmed = (op) => sccConfirmed.has(String(op || '').toLowerCase());

    const reviewedAt = ropa.last_reviewed_at ? new Date(ropa.last_reviewed_at) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Review banner */}
            <div style={{
                ...box,
                borderLeft: `4px solid ${reviewedAt ? '#10b981' : '#f59e0b'}`,
                display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'space-between', flexWrap: 'wrap',
            }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                        {t('compliance.ropa_title')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #999)', marginTop: 3 }}>
                        {reviewedAt
                            ? (t('compliance.ropa_reviewed_at', { date: reviewedAt.toLocaleDateString() }) || `Last reviewed ${reviewedAt.toLocaleDateString()}`)
                            : t('compliance.ropa_never_reviewed')}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={onRefresh} style={ghostBtn} title={t('compliance.ropa_regenerate')}>
                        <RefreshCw size={14} />
                    </button>
                    {pdfUrl && (
                        <a href={pdfUrl} download style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 12, fontWeight: 600, textDecoration: 'none',
                            color: 'var(--accent-primary, #6366f1)', padding: '8px 10px',
                        }}>
                            <FileDown size={14} /> {t('compliance.ropa_download_pdf')}
                        </a>
                    )}
                    <button onClick={onReview} disabled={busy} style={primaryBtn}>
                        <CheckCircle2 size={14} /> {t('compliance.ropa_mark_reviewed')}
                    </button>
                </div>
            </div>

            {/* Controller */}
            <div style={box}>
                <div style={sectionTitle}>{t('compliance.ropa_controller')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 12.5 }}>
                    <Info label={t('compliance.ropa_org')} value={ropa.controller?.name} />
                    <Info label={t('compliance.dpo_name')} value={ropa.controller?.dpo_name} />
                    <Info label={t('compliance.dpo_email')} value={ropa.controller?.dpo_email} />
                    <Info label={t('compliance.data_residency')} value={ropa.data_residency} />
                    <Info label={t('compliance.settings_legal_bases')} value={(ropa.legal_bases || []).join(', ')} />
                </div>
            </div>

            {/* Activities */}
            <div style={box}>
                <div style={sectionTitle}>{t('compliance.ropa_activities')}</div>
                {(ropa.activities || []).length === 0 ? (
                    <Empty text={t('compliance.ropa_no_activities')} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={table}>
                            <thead>
                                <tr>
                                    <th style={th}>{t('compliance.ropa_col_activity')}</th>
                                    <th style={th}>{t('compliance.ropa_col_purpose')}</th>
                                    <th style={th}>{t('compliance.ropa_col_data')}</th>
                                    <th style={th}>{t('compliance.ropa_col_retention')}</th>
                                    <th style={th}>{t('compliance.ropa_col_transfers')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ropa.activities.map(a => (
                                    <tr key={a.activity_id}>
                                        <td style={{ ...td, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{a.name}</td>
                                        <td style={td}>{a.purpose}</td>
                                        <td style={td}>{(a.data_categories || []).join(', ')}</td>
                                        <td style={td}>{a.retention}</td>
                                        <td style={td}>{(a.transfers || []).length ? a.transfers.join(', ') : t('compliance.ropa_no_transfers')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Processors */}
            <div style={box}>
                <div style={sectionTitle}>{t('compliance.ropa_processors')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #999)', marginBottom: 10 }}>
                    {t('compliance.ropa_processors_desc')}
                </div>
                {(ropa.processors || []).length === 0 ? (
                    <Empty text={t('compliance.ropa_no_processors')} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={table}>
                            <thead>
                                <tr>
                                    <th style={th}>{t('compliance.ropa_col_operator')}</th>
                                    <th style={th}>{t('compliance.ropa_col_location')}</th>
                                    <th style={th}>{t('compliance.ropa_col_calls')}</th>
                                    <th style={th}>{t('compliance.ropa_col_last_seen')}</th>
                                    <th style={th}>{t('compliance.ropa_col_scc')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ropa.processors.map(p => {
                                    const confirmed = isConfirmed(p.operator);
                                    return (
                                        <tr key={p.operator || 'unknown'}>
                                            <td style={{ ...td, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{p.operator || '—'}</td>
                                            <td style={td}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                    <Globe2 size={13} style={{ color: p.is_eu ? '#10b981' : '#f59e0b' }} />
                                                    {p.country_name || p.country_code || '—'}
                                                    {p.is_eu && <span style={pill('#10b981')}>EU</span>}
                                                </span>
                                            </td>
                                            <td style={td}>{p.calls}</td>
                                            <td style={td}>{p.last_seen ? new Date(p.last_seen).toLocaleDateString() : '—'}</td>
                                            <td style={td}>
                                                {p.is_eu ? (
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
                                                        {t('compliance.ropa_scc_not_needed')}
                                                    </span>
                                                ) : (
                                                    <button disabled={busy}
                                                        onClick={() => onSccToggle(p.operator, !confirmed)}
                                                        style={{
                                                            ...sccBtn,
                                                            background: confirmed ? '#10b98122' : '#f59e0b22',
                                                            color: confirmed ? '#10b981' : '#f59e0b',
                                                            border: `1px solid ${confirmed ? '#10b98155' : '#f59e0b55'}`,
                                                        }}>
                                                        {confirmed
                                                            ? <><ShieldCheck size={13} /> {t('compliance.ropa_scc_confirmed')}</>
                                                            : <><ShieldAlert size={13} /> {t('compliance.ropa_scc_confirm')}</>}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Info({ label, value }) {
    return (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted, #666)', marginBottom: 3 }}>{label}</div>
            <div style={{ color: 'var(--text-primary, #eee)' }}>{value || '—'}</div>
        </div>
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
    fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
    background: `${color}22`, color,
});
const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#10b981', color: '#fff', border: 'none',
    padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
    fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
};
const ghostBtn = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted, #888)', padding: 6, borderRadius: 6,
};
const sccBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
    fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit',
};
