import React from 'react';
import { ShieldCheck, ListChecks, FileDown, Clock, FileText, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { CheckCardSkeleton } from './shared/Skeleton';
import ScoreSparkline from './shared/ScoreSparkline';

/**
 * ISO 27001 readiness — deliberately TWO numbers, never one blended
 * "% compliant" (a vanity metric an auditor attacks instantly):
 *   1. controls continuously verified (auto + connector buckets only)
 *   2. SoA decision progress across all 93 rows
 * Plus the evidence-continuity signal Stage 2 actually samples: how long the
 * ISMS has been operating and the score trend over that period.
 */
export default function IsoOverviewPage({ readiness, soaPdfUrl, clausePdfUrl, riskPdfUrl, policyPackUrl, bundleUrl, onNavigate }) {
    const { t } = useTranslation();

    if (readiness === null) return <CheckCardSkeleton count={3} />;

    const c = readiness?.controls || {};
    const soa = readiness?.soa || { total: 0, approved: 0 };
    const clauses = readiness?.clauses || [];
    const points = (readiness?.history_points || []).map(p => ({ captured_at: p.captured_at, overall_score: p.score }));
    const since = readiness?.operating_since ? new Date(readiness.operating_since) : null;
    const days = since ? Math.floor((Date.now() - since.getTime()) / 86400000) : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* The two numbers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <button onClick={() => onNavigate?.('admin/compliance/iso_controls')} style={{ ...tile, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={tileHead}><ShieldCheck size={15} style={{ color: '#10b981' }} /> {t('compliance.iso_ov_verified_title')}</div>
                    <div style={bigNumber}>
                        {c.verified ?? 0}<span style={denom}>/{c.verifiable_total ?? 0}</span>
                    </div>
                    <div style={tileSub}>
                        {t('compliance.iso_ov_verified_sub', { failing: c.failing ?? 0, unchecked: c.unchecked ?? 0 }, null)
                            || `${c.failing ?? 0} failing · ${c.unchecked ?? 0} not yet checked`}
                    </div>
                </button>
                <button onClick={() => onNavigate?.('admin/compliance/iso_soa')} style={{ ...tile, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={tileHead}><ListChecks size={15} style={{ color: '#8b5cf6' }} /> {t('compliance.iso_ov_soa_title')}</div>
                    <div style={bigNumber}>
                        {soa.approved ?? 0}<span style={denom}>/{readiness?.controls?.catalog_total ?? 93}</span>
                    </div>
                    <div style={tileSub}>
                        {t('compliance.iso_ov_soa_sub', { reviewed: soa.reviewed ?? 0, excluded: soa.excluded ?? 0 }, null)
                            || `${soa.reviewed ?? 0} reviewed · ${soa.excluded ?? 0} excluded with justification`}
                    </div>
                </button>
            </div>

            {/* Evidence continuity */}
            <div style={{ ...tile, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={tileHead}><Clock size={15} style={{ color: since ? '#10b981' : '#f59e0b' }} /> {t('compliance.iso_ov_operating_title')}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary, #eee)', marginTop: 6, fontWeight: 600 }}>
                        {since
                            ? (t('compliance.iso_ov_operating_since', { date: since.toLocaleDateString(), days }, null) || `Operating since ${since.toLocaleDateString()} (${days} days)`)
                            : t('compliance.iso_ov_not_operating')}
                    </div>
                    <div style={{ ...tileSub, marginTop: 4 }}>{t('compliance.iso_ov_operating_hint')}</div>
                </div>
                {points.length >= 2 && <ScoreSparkline history={points} />}
            </div>

            {/* Clause conformity strip */}
            <div style={tile}>
                <div style={tileHead}><FileText size={15} style={{ color: '#0ea5e9' }} /> {t('compliance.iso_ov_clauses_title')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    {clauses.map(cl => (
                        <span key={cl.clause} title={cl.title} style={{
                            ...pill(CLAUSE_COLOR[cl.status] || '#6b7280'),
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}>
                            {cl.status === 'not_recorded' && <AlertTriangle size={11} />}
                            {t('compliance.iso_ov_clause_chip', { clause: cl.clause }, null) || `Clause ${cl.clause}`}
                            {' · '}{t(`compliance.iso_ov_status_${cl.status}`)}
                        </span>
                    ))}
                </div>
                <div style={{ ...tileSub, marginTop: 10 }}>{t('compliance.iso_ov_clauses_hint')}</div>
            </div>

            {/* Stage-1 export pack */}
            <div style={{ ...tile, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={tileHead}><FileDown size={15} style={{ color: '#f59e0b' }} /> {t('compliance.iso_ov_exports_title')}</div>
                    <div style={{ ...tileSub, marginTop: 4 }}>{t('compliance.iso_ov_exports_hint')}</div>
                </div>
                <a href={soaPdfUrl} download style={dlLink}>{t('compliance.iso_ov_dl_soa')}</a>
                <a href={clausePdfUrl} download style={dlLink}>{t('compliance.iso_ov_dl_clauses')}</a>
                {riskPdfUrl && <a href={riskPdfUrl} download style={dlLink}>{t('compliance.iso_ov_dl_risks')}</a>}
                {policyPackUrl && <a href={policyPackUrl} download style={dlLink}>{t('compliance.iso_ov_dl_policies')}</a>}
                {bundleUrl && <a href={bundleUrl} download style={{ ...dlLink, borderColor: 'var(--accent-primary, #6366f1)' }}>{t('compliance.iso_ov_dl_bundle')}</a>}
            </div>

            <div style={{ fontSize: 11.5, color: 'var(--text-muted, #888)', lineHeight: 1.5 }}>
                {t('compliance.iso_ov_disclaimer')}
            </div>
        </div>
    );
}

const CLAUSE_COLOR = { in_place: '#10b981', partial: '#f59e0b', not_recorded: '#ef4444' };

const tile = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 12, padding: 16, fontFamily: 'inherit',
};
const tileHead = {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #fff)',
};
const bigNumber = {
    fontSize: 34, fontWeight: 800, color: 'var(--text-primary, #fff)', marginTop: 8, lineHeight: 1,
};
const denom = { fontSize: 17, fontWeight: 600, color: 'var(--text-muted, #888)' };
const tileSub = { fontSize: 11.5, color: 'var(--text-muted, #999)', marginTop: 6 };
const pill = (color) => ({
    fontSize: 10.5, fontWeight: 700, padding: '4px 9px', borderRadius: 6,
    background: `${color}22`, color, whiteSpace: 'nowrap',
});
const dlLink = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 600, textDecoration: 'none',
    color: 'var(--accent-primary, #6366f1)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.15))',
    padding: '8px 12px', borderRadius: 8,
};
