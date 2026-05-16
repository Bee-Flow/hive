import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import ScoreRing from './shared/ScoreRing';
import { OverviewSkeleton, CheckCardSkeleton } from './shared/Skeleton';

function timeAgo(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function OverviewPage({ overview, checks, running, loading, onRunNow, onNavigate, onStartWizard }) {
    const { t } = useTranslation();
    if (loading || !overview) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <OverviewSkeleton />
                <CheckCardSkeleton count={3} />
            </div>
        );
    }

    // Hero for organisations that haven't finished the 2-minute setup yet.
    // Showing a 0/100 ring on an un-onboarded org is misleading and demotivating.
    if (!overview.onboarded) {
        return (
            <div style={{
                ...heroBox,
                display: 'flex', gap: 28, alignItems: 'center',
                borderLeft: '4px solid var(--accent-primary, #6366f1)',
            }}>
                <div style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: 'color-mix(in srgb, var(--accent-primary, #6366f1) 14%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <ShieldCheck size={44} style={{ color: 'var(--accent-primary, #6366f1)' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary, #fff)' }}>
                        {t('compliance.hero_onboard_title')}
                    </h2>
                    <p style={{ margin: '6px 0 18px', color: 'var(--text-muted, #aaa)', fontSize: 14, maxWidth: 560 }}>
                        {t('compliance.hero_onboard_desc')}
                    </p>
                    <button onClick={onStartWizard} style={primaryBtn}>
                        {t('compliance.hero_onboard_cta')}
                    </button>
                </div>
            </div>
        );
    }

    const openItems = (checks || [])
        .filter(c => c.status === 'fail' || c.status === 'warn')
        .sort((a, b) => {
            const order = { fail: 0, warn: 1 };
            if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
            const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
        })
        .slice(0, 5);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Hero */}
            <div style={heroBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <ScoreRing score={overview.overall.score} size={140} label={t('compliance.overall_score')} />
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: 22, color: 'var(--text-primary, #fff)' }}>
                            {overview.overall.score >= 85
                                ? t('compliance.headline_good')
                                : overview.overall.score >= 60
                                    ? t('compliance.headline_warn')
                                    : t('compliance.headline_bad')}
                        </h2>
                        <p style={{ margin: '6px 0 14px', color: 'var(--text-muted, #aaa)', fontSize: 14 }}>
                            {t('compliance.overview_subtitle')}
                        </p>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <Stat label={t('compliance.passing')} value={overview.overall.pass} color="#10b981" />
                            <Stat label={t('compliance.warnings')} value={overview.overall.warn} color="#f59e0b" />
                            <Stat label={t('compliance.failing')} value={overview.overall.fail} color="#ef4444" />
                            <Stat label={t('compliance.not_applicable')} value={overview.overall.na} color="#6b7280" />
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button onClick={onRunNow} disabled={running} style={primaryBtn}>
                            <RefreshCw size={14} style={{ animation: running ? 'spin 1s linear infinite' : 'none' }} />
                            {running ? t('compliance.running') : t('compliance.run_now')}
                        </button>
                        <span style={{ fontSize: 11, color: 'var(--text-muted, #888)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            <Clock size={11} /> {t('compliance.last_run')}: {timeAgo(overview.last_run_at)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Traffic lights */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <TrafficLight title="GDPR" summary={overview.gdpr} onClick={() => onNavigate && onNavigate('admin/compliance/gdpr')} />
                <TrafficLight title="AI Act" summary={overview.aia} onClick={() => onNavigate && onNavigate('admin/compliance/aia')} />
            </div>

            {/* Open items */}
            <div style={sectionBox}>
                <div style={sectionHeader}>
                    <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-primary, #fff)' }}>{t('compliance.top_open_items')}</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>{openItems.length} {t('compliance.of')} {overview.overall.total}</span>
                </div>
                {openItems.length === 0 ? (
                    overview.overall.score === 100
                        ? (
                            <div style={{
                                padding: '28px 20px', textAlign: 'center',
                                color: '#10b981',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                                background: 'color-mix(in srgb, #10b981 8%, transparent)',
                                borderRadius: 10,
                                border: '1px solid #10b98133',
                            }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <ShieldCheck size={32} />
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{t('compliance.all_clear_title')}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted, #aaa)' }}>{t('compliance.all_clear_subtitle')}</div>
                            </div>
                        )
                        : (
                            <div style={{ padding: 20, textAlign: 'center', color: '#10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                <CheckCircle2 size={28} />
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{t('compliance.all_clear')}</div>
                            </div>
                        )
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {openItems.map(c => (
                            <button key={c.check_id} onClick={() => onNavigate && onNavigate(
                                `admin/compliance/${c.regulation === 'GDPR' ? 'gdpr' : 'aia'}/${encodeURIComponent(c.check_id)}`
                            )} style={openItemRow(c.status)}>
                                <AlertTriangle size={16} style={{ color: c.status === 'fail' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{t(c.titleKey) || c.check_id}</div>
                                    {c.details && <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>{c.details}</div>}
                                </div>
                                <ArrowRight size={14} style={{ color: 'var(--text-muted, #666)', flexShrink: 0 }} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value, color }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #888)', marginTop: 3 }}>{label}</span>
        </div>
    );
}

function TrafficLight({ title, summary, onClick }) {
    const { t } = useTranslation();
    const score = summary?.score ?? 0;
    let color = '#10b981';
    if (score < 60) color = '#ef4444';
    else if (score < 85) color = '#f59e0b';
    return (
        <button onClick={onClick} style={{
            ...sectionBox,
            cursor: 'pointer',
            border: `1px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            textAlign: 'left', fontFamily: 'inherit',
        }}>
            <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>
                    {summary?.pass ?? 0} {t('compliance.pass')} · {summary?.warn ?? 0} {t('compliance.warn')} · {summary?.fail ?? 0} {t('compliance.fail')}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color }}>{score}</span>
                <ArrowRight size={16} style={{ color: 'var(--text-muted, #666)' }} />
            </div>
        </button>
    );
}

const heroBox = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 14, padding: 24,
};
const sectionBox = {
    background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
    borderRadius: 12, padding: 16,
};
const sectionHeader = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
};
const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
    background: 'var(--accent-primary, #6366f1)', color: '#fff',
    padding: '8px 14px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
};

const openItemRow = (status) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 8,
    background: 'var(--bg-primary, rgba(0,0,0,0.15))',
    border: `1px solid ${status === 'fail' ? '#ef444433' : '#f59e0b33'}`,
    cursor: 'pointer', width: '100%', fontFamily: 'inherit',
});
