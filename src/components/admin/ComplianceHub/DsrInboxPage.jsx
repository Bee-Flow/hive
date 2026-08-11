import React, { useState } from 'react';
import { RefreshCw, ChevronDown, Download, Clock, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import { Empty } from '../MonitoringPanel/shared';

const TYPE_LABEL_KEY = {
    access: 'compliance.dsr_type_access',
    rectification: 'compliance.dsr_type_rectification',
    deletion: 'compliance.dsr_type_deletion',
    portability: 'compliance.dsr_type_portability',
    restriction: 'compliance.dsr_type_restriction',
    objection: 'compliance.dsr_type_objection',
};

const STATUS_STYLE = {
    pending: { color: '#f59e0b', labelKey: 'compliance.dsr_status_pending' },
    in_progress: { color: '#3b82f6', labelKey: 'compliance.dsr_status_in_progress' },
    fulfilled: { color: '#10b981', labelKey: 'compliance.dsr_status_fulfilled' },
    rejected: { color: '#6b7280', labelKey: 'compliance.dsr_status_rejected' },
};

// GDPR Art. 12(3): answer within one month of receipt.
const SLA_DAYS = 30;

function daysLeft(createdAt) {
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / 86400000;
    return Math.ceil(SLA_DAYS - elapsed);
}

function Countdown({ request }) {
    const { t } = useTranslation();
    if (request.status === 'fulfilled' || request.status === 'rejected') {
        return <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>—</span>;
    }
    const left = daysLeft(request.created_at);
    const overdue = left < 0;
    const urgent = !overdue && left <= 5;
    const color = overdue ? '#ef4444' : urgent ? '#f59e0b' : 'var(--text-muted, #888)';
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: overdue || urgent ? 700 : 500, color }}>
            {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
            {overdue
                ? t('compliance.dsr_overdue_by', { days: Math.abs(left) }) || `${Math.abs(left)}d overdue`
                : t('compliance.dsr_days_left', { days: left }) || `${left}d left`}
        </span>
    );
}

export default function DsrInboxPage({ requests, busyId, onUpdate, onRefresh, exportUrlFor, focusId }) {
    const { t } = useTranslation();
    const [openId, setOpenId] = useState(focusId ? Number(focusId) || null : null);
    const [summaryDrafts, setSummaryDrafts] = useState({});

    if (requests === null) return <CheckCardSkeleton count={4} />;

    const setDraft = (id, text) => setSummaryDrafts(d => ({ ...d, [id]: text }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
                    {t('compliance.dsr_subtitle')}
                </div>
                <button onClick={onRefresh} style={ghostBtn} title={t('compliance.dsr_refresh')}>
                    <RefreshCw size={14} />
                </button>
            </div>

            {requests.length === 0 ? (
                <Empty text={t('compliance.dsr_empty')} />
            ) : (
                requests.map(r => {
                    const s = STATUS_STYLE[r.status] || STATUS_STYLE.pending;
                    const open = openId === r.id;
                    const busy = busyId === r.id;
                    return (
                        <div key={r.id} style={{
                            border: `1px solid ${s.color}33`,
                            borderLeft: `4px solid ${s.color}`,
                            background: 'var(--bg-secondary, #1a1a2e)',
                            borderRadius: 10, padding: '12px 16px',
                            display: 'flex', flexDirection: 'column', gap: 10,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                                onClick={() => setOpenId(open ? null : r.id)}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                                            {t(TYPE_LABEL_KEY[r.request_type]) || r.request_type}
                                        </span>
                                        <span style={pill(s.color)}>{t(s.labelKey) || r.status}</span>
                                        <Countdown request={r} />
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', marginTop: 3 }}>
                                        {r.subject_email} · #{r.id} · {new Date(r.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <ChevronDown size={16} style={{
                                    color: 'var(--text-muted, #888)', flexShrink: 0,
                                    transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
                                }} />
                            </div>

                            {open && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: 8,
                                    background: 'var(--bg-primary, rgba(0,0,0,0.2))',
                                    display: 'flex', flexDirection: 'column', gap: 10,
                                    fontSize: 12.5, color: 'var(--text-secondary, #bbb)',
                                }}>
                                    {r.notes && (
                                        <div>
                                            <div style={label}>{t('compliance.dsr_notes')}</div>
                                            <div>{r.notes}</div>
                                        </div>
                                    )}
                                    {r.result_summary && (
                                        <div>
                                            <div style={label}>{t('compliance.dsr_result_summary')}</div>
                                            <div>{r.result_summary}</div>
                                        </div>
                                    )}
                                    {(r.status === 'pending' || r.status === 'in_progress') && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={label}>{t('compliance.dsr_resolution')}</div>
                                            <textarea
                                                value={summaryDrafts[r.id] ?? ''}
                                                onChange={e => setDraft(r.id, e.target.value)}
                                                placeholder={t('compliance.dsr_summary_placeholder')}
                                                rows={2}
                                                style={textarea}
                                            />
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {r.status === 'pending' && (
                                                    <button disabled={busy} style={btn('#3b82f6')}
                                                        onClick={() => onUpdate(r.id, { status: 'in_progress' })}>
                                                        {t('compliance.dsr_start')}
                                                    </button>
                                                )}
                                                <button disabled={busy} style={btn('#10b981')}
                                                    onClick={() => onUpdate(r.id, { status: 'fulfilled', result_summary: summaryDrafts[r.id] || undefined })}>
                                                    {t('compliance.dsr_fulfil')}
                                                </button>
                                                <button disabled={busy} style={btn('#6b7280')}
                                                    onClick={() => onUpdate(r.id, { status: 'rejected', result_summary: summaryDrafts[r.id] || undefined })}>
                                                    {t('compliance.dsr_reject')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <a href={exportUrlFor(r.id)} download style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        fontSize: 12, color: 'var(--accent-primary, #6366f1)',
                                        textDecoration: 'none', alignSelf: 'flex-start', fontWeight: 600,
                                    }}>
                                        <Download size={13} /> {t('compliance.dsr_export_json')}
                                    </a>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}

const label = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', color: 'var(--text-muted, #666)', marginBottom: 4,
};
const pill = (color) => ({
    fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    padding: '2px 6px', borderRadius: 4, background: `${color}22`, color,
});
const btn = (bg) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: bg, color: '#fff', border: 'none',
    padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
});
const ghostBtn = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted, #888)', padding: 6, borderRadius: 6,
};
const textarea = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
    color: 'var(--text-primary, #fff)', width: '100%',
    outline: 'none', fontFamily: 'inherit', resize: 'vertical',
};
