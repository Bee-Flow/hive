// Integration Activity Monitor tab — tool usage, data flow, EU data sovereignty.
// Token-free already (counts of EU/local/non-EU egress, not LLM tokens).

import {
    Globe, Info, Activity, Users, Link2, Bot, Server, Fingerprint, Zap,
    AlertTriangle, ArrowRight, ArrowLeft,
} from 'lucide-react';
import React, { useState, useRef, useMemo } from 'react';
import {
    Card, MetricCard, MetricGrid, MonitorHero, TabHeader, AlertBanner,
    SectionTitle, TrendChip, FilterChipBar, DrillChip, ShowMore, EmptyInline, TOKENS,
} from './kit';
import { Avatar, IconBadge, IntegrationLogo } from './widgets';
import { paletteColor as getColor, operatorColor, scoreColor, scoreLabel, ALERT_SCORE_THRESHOLD } from '../../../config/analyticsConfig';
import { getIntegrationIcon, hasIntegrationIcon } from '../../../config/integrationIcons';

// ── Sovereignty-over-time mini chart (integration-local) ─────────────────────
const SovereigntyTrend = ({ timeline }) => {
    if (!Array.isArray(timeline) || timeline.length < 2) return null;
    const data = timeline.map(r => ({
        period: r.period, eu: Number(r.eu_count || 0), local: Number(r.local_count || 0),
        nonEu: Number(r.non_eu_count || 0), total: Number(r.total || 0),
    }));
    const maxTotal = Math.max(...data.map(d => d.total), 1);
    const H = 90, PAD_T = 14, PAD_B = 18, barW = 12, gap = 6;
    const W = data.length * (barW + gap) + gap;
    return (
        <div style={{ padding: '6px 4px 0 4px', overflowX: 'auto' }}>
            <svg width={W} height={H + PAD_T + PAD_B} style={{ display: 'block' }}>
                {data.map((d, i) => {
                    const x = gap + i * (barW + gap);
                    const totalH = Math.round((d.total / maxTotal) * H);
                    const euLocal = d.eu + d.local;
                    const euLocalH = d.total > 0 ? Math.round((euLocal / d.total) * totalH) : 0;
                    const nonEuH = totalH - euLocalH;
                    const yTop = PAD_T + (H - totalH);
                    const pctEu = d.total > 0 ? Math.round((euLocal / d.total) * 100) : 0;
                    const pctColor = pctEu >= 80 ? '#10b981' : pctEu >= 40 ? '#f59e0b' : '#ef4444';
                    const dateLabel = (d.period || '').slice(5);
                    return (
                        <g key={i}>
                            {d.total > 0 && <text x={x + barW / 2} y={PAD_T - 3} fontSize="8" fontWeight="700" textAnchor="middle" fill={pctColor}>{pctEu}%</text>}
                            {nonEuH > 0 && <rect x={x} y={yTop} width={barW} height={nonEuH} rx="2" fill="#f59e0b"><title>{`${d.period}: ${d.nonEu} non-EU of ${d.total}`}</title></rect>}
                            {euLocalH > 0 && <rect x={x} y={yTop + nonEuH} width={barW} height={euLocalH} rx="2" fill="#10b981"><title>{`${d.period}: ${euLocal} EU/local of ${d.total} (${pctEu}%)`}</title></rect>}
                            <text x={x + barW / 2} y={PAD_T + H + 12} fontSize="8" textAnchor="middle" fill="var(--text-muted)">{dateLabel}</text>
                        </g>
                    );
                })}
            </svg>
            <div style={{ display: 'flex', gap: 10, fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#10b981', marginRight: 4 }} />EU+Local</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b', marginRight: 4 }} />Non-EU</span>
            </div>
        </div>
    );
};

// ── One row of the Sovereignty breakdown ─────────────────────────────────────
const SovereigntyRow = ({ row, onClick, avatarFor, topOperatorColorFor }) => {
    const total = Number(row.total || 0);
    const eu = Number(row.eu_count || 0);
    const local = Number(row.local_count || 0);
    const nonEu = Number(row.non_eu_count || 0);
    const piiNonEu = Number(row.pii_non_eu_count || 0);
    const score = total > 0 ? Math.round(((eu + local) / (total + piiNonEu)) * 100) : 100;
    const euPct = total > 0 ? (eu / total) * 100 : 0;
    const localPct = total > 0 ? (local / total) * 100 : 0;
    const nonEuPct = total > 0 ? (nonEu / total) * 100 : 0;
    const sc = scoreColor(score);
    const opColor = topOperatorColorFor ? topOperatorColorFor(row.top_operator) : '#94a3b8';
    return (
        <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 70px', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', cursor: onClick ? 'pointer' : 'default', transition: 'background 0.12s' }}
            onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-primary)'; }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarFor ? avatarFor(row) : <div style={{ width: 26, height: 26, borderRadius: '50%', background: opColor, opacity: 0.18 }} />}
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }} title={row.label}>{(row.label || row.key || '').toString().replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{total} call{total === 1 ? '' : 's'}</span>
                </div>
                <div style={{ display: 'flex', height: 7, borderRadius: 99, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                    {eu > 0 && <div style={{ width: `${euPct}%`, background: '#10b981' }} title={`${eu} EU/EEA`} />}
                    {local > 0 && <div style={{ width: `${localPct}%`, background: '#14b8a6' }} title={`${local} Local`} />}
                    {nonEu > 0 && <div style={{ width: `${nonEuPct}%`, background: '#f59e0b' }} title={`${nonEu} Non-EU`} />}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 9, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    {eu > 0 && <span><span style={{ color: '#10b981', fontWeight: 700 }}>{eu}</span> EU</span>}
                    {local > 0 && <span><span style={{ color: '#14b8a6', fontWeight: 700 }}>{local}</span> Local</span>}
                    {nonEu > 0 && <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>{nonEu}</span> Non-EU</span>}
                    {piiNonEu > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#ef4444', fontWeight: 700 }}><Fingerprint style={{ width: 9, height: 9 }} />−{piiNonEu} PII abroad</span>}
                    {row.top_operator && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: opColor }} />top: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.top_operator}</span></span>}
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: sc, letterSpacing: '-0.03em', lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Score</div>
            </div>
        </div>
    );
};

export default function IntegrationsTab({ t, integData }) {
    const [egressEuFilter, setEgressEuFilter] = useState('all');
    const [sovereigntyAxis, setSovereigntyAxis] = useState('user');
    const [egressDrill, setEgressDrill] = useState(null);
    const [egressShow, setEgressShow] = useState(50);
    const egressLogRef = useRef(null);

    // PII-weighted sovereignty score + half-period trend (moved in from UsageSection).
    const sovereigntyStats = useMemo(() => {
        const eg = integData.egress || [];
        const total = eg.length;
        const euCount = eg.filter(r => r.is_eu === true).length;
        const localCount = eg.filter(r => !!r.is_local).length;
        const nonEuCount = total - euCount - localCount;
        const piiNonEuCount = eg.filter(r => !r.is_eu && !r.is_local && r.pii_categories_detected && r.pii_categories_detected.trim() !== '').length;
        const score = total > 0 ? Math.round(((euCount + localCount) / (total + piiNonEuCount)) * 100) : 100;
        const tl = (integData.timeline || []).map(r => ({
            eu: Number(r.eu_count || 0), local: Number(r.local_count || 0), nonEu: Number(r.non_eu_count || 0),
            piiNonEu: Number(r.pii_non_eu_count || 0), total: Number(r.total || 0),
        }));
        let trend = null;
        if (tl.length >= 2) {
            const half = Math.floor(tl.length / 2);
            const sum = (arr) => arr.reduce((s, r) => ({ eu: s.eu + r.eu, local: s.local + r.local, nonEu: s.nonEu + r.nonEu, piiNonEu: s.piiNonEu + r.piiNonEu, total: s.total + r.total }), { eu: 0, local: 0, nonEu: 0, piiNonEu: 0, total: 0 });
            const prev = sum(tl.slice(0, half));
            const curr = sum(tl.slice(half));
            const scoreOf = (b) => b.total > 0 ? Math.round(((b.eu + b.local) / (b.total + b.piiNonEu)) * 100) : null;
            const prevScore = scoreOf(prev), currScore = scoreOf(curr);
            if (prevScore !== null && currScore !== null) trend = { delta: currScore - prevScore, prevScore };
        }
        return { total, euCount, localCount, nonEuCount, piiNonEuCount, score, trend };
    }, [integData.egress, integData.timeline]);

    const drillToPiiAbroad = () => {
        setEgressDrill({ axis: 'pii-non-eu', key: 'pii-non-eu', label: 'PII leaks abroad' });
        setTimeout(() => egressLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };

    const noData = !integData.summary || (Number(integData.summary.total_calls) === 0 && integData.byType.length === 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.pagePad }}>
            <TabHeader icon={Globe} iconColor="#0ea5e9" title={t('usage.integ_title')} description={t('usage.integ_subtitle')} />

            {noData ? (
                <Card style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Info style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('usage.integ_not_enabled')}</span>
                </Card>
            ) : (
                <>
                    {sovereigntyStats.total > 0 && sovereigntyStats.score < ALERT_SCORE_THRESHOLD && (() => {
                        const severity = sovereigntyStats.score < 20 ? 'red' : 'amber';
                        const reasonBits = [];
                        if (sovereigntyStats.piiNonEuCount > 0) reasonBits.push(`${sovereigntyStats.piiNonEuCount} call${sovereigntyStats.piiNonEuCount === 1 ? '' : 's'} leaked PII outside the EU/EEA`);
                        else if (sovereigntyStats.nonEuCount > 0) reasonBits.push(`${sovereigntyStats.nonEuCount} of ${sovereigntyStats.total} call${sovereigntyStats.total === 1 ? '' : 's'} left the EU/EEA`);
                        const onCta = sovereigntyStats.piiNonEuCount > 0 ? drillToPiiAbroad : null;
                        return <AlertBanner severity={severity} message={`Sovereignty score ${sovereigntyStats.score}/100 — ${reasonBits.join(' · ')}`} ctaLabel={onCta ? 'Review PII leaks' : null} onCta={onCta} />;
                    })()}

                    {/* Sovereignty hero */}
                    {(() => {
                        const { total, euCount, localCount, nonEuCount, piiNonEuCount, score } = sovereigntyStats;
                        const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
                        const sc = scoreColor(score);
                        const summary = integData.summary || {};
                        const hasTrend = (integData.timeline?.length || 0) > 1;
                        return (
                            <MonitorHero
                                accent="#10b981"
                                eyebrow="Data sovereignty score"
                                infoTip={<span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', opacity: 0.8, cursor: 'help' }} title={`(EU + Local) / (Total + PII-leaks-abroad) × 100. A non-EU call that exposed PII counts twice against the denominator, so the score punishes leaks of personal data more than benign non-EU traffic.`}>ⓘ how is this scored?</span>}
                                value={<>{score} <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '-0.02em' }}>/ 100</span></>}
                                valueColor={sc}
                                status={{ label: scoreLabel(score), color: sc }}
                                trend={sovereigntyStats.trend ? <TrendChip delta={sovereigntyStats.trend.delta} display={sovereigntyStats.trend.delta === 0 ? '0' : Math.abs(sovereigntyStats.trend.delta)} title={`Previous half-period score: ${sovereigntyStats.trend.prevScore}`} /> : null}
                                subline="Score drops on Non-EU traffic; PII leaks abroad count double."
                                leftRatio={1.4}
                                aside={hasTrend ? (
                                    <div>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Sovereignty over time</div>
                                        <SovereigntyTrend timeline={integData.timeline} />
                                    </div>
                                ) : (
                                    <MetricGrid cols={2} gap={TOKENS.tileGap}>
                                        <MetricCard size="sm" icon={Zap} color="#0ea5e9" label="Total calls" value={Number(summary.total_calls || 0).toLocaleString()} />
                                        <MetricCard size="sm" icon={Link2} color="#0ea5e9" label="Integrations" value={Number(summary.unique_integrations || 0).toLocaleString()} />
                                        <MetricCard size="sm" icon={Server} color="#10b981" label="Endpoints" value={Number(summary.unique_servers || 0).toLocaleString()} />
                                        <MetricCard size="sm" icon={Fingerprint} color="#ef4444" label="PII events" value={Number(summary.pii_events || 0).toLocaleString()} />
                                    </MetricGrid>
                                )}
                            >
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                        <span><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pct(euCount + localCount)}%</span> raw EU/EEA + local share</span>
                                        {piiNonEuCount > 0 && (
                                            <button onClick={drillToPiiAbroad} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontWeight: 700, fontSize: 11 }} title="Click to filter the egress log to the PII-leaking calls">
                                                <Fingerprint style={{ width: 12, height: 12 }} />−{piiNonEuCount} PII leak{piiNonEuCount === 1 ? '' : 's'} abroad
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                                        {euCount > 0 && <div title={`${euCount} EU/EEA calls`} style={{ width: `${pct(euCount)}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />}
                                        {localCount > 0 && <div title={`${localCount} local calls`} style={{ width: `${pct(localCount)}%`, background: 'linear-gradient(90deg,#14b8a6,#2dd4bf)' }} />}
                                        {nonEuCount > 0 && <div title={`${nonEuCount} non-EU calls`} style={{ width: `${pct(nonEuCount)}%`, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />}
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{euCount}</span><span style={{ color: 'var(--text-muted)' }}>EU/EEA ({pct(euCount)}%)</span></span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#14b8a6' }} /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{localCount}</span><span style={{ color: 'var(--text-muted)' }}>Local ({pct(localCount)}%)</span></span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} /><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{nonEuCount}</span><span style={{ color: 'var(--text-muted)' }}>Non-EU ({pct(nonEuCount)}%)</span></span>
                                    </div>
                                </div>
                            </MonitorHero>
                        );
                    })()}

                    {/* Sovereignty breakdown */}
                    {(() => {
                        const axes = [
                            { value: 'user', label: 'User', icon: Users },
                            { value: 'integration', label: 'Integration', icon: Link2 },
                            { value: 'agent', label: 'Agent', icon: Bot },
                            { value: 'pii', label: 'PII (when detected)', icon: Fingerprint },
                        ];
                        const rows = (integData.sovereignty?.[sovereigntyAxis] || []).slice(0, 12);
                        const handleDrill = (axis, row) => {
                            setEgressDrill({ axis, key: row.key, label: row.label || row.key });
                            setTimeout(() => egressLogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                        };
                        const avatarFor = (row) => {
                            if (sovereigntyAxis === 'user') return <Avatar user={{ ...row, display_name: row.label }} color={getColor(0)} size={26} />;
                            if (sovereigntyAxis === 'integration' && hasIntegrationIcon(row.key)) return <IntegrationLogo integrationType={row.key} size={26} />;
                            return null;
                        };
                        return (
                            <div>
                                <SectionTitle icon={Activity} right={<FilterChipBar size="sm" value={sovereigntyAxis} onChange={setSovereigntyAxis} options={axes} />}>Sovereignty breakdown</SectionTitle>
                                <Card>
                                    {rows.length === 0 ? <EmptyInline text={sovereigntyAxis === 'pii' ? 'No PII detected in any tool result.' : 'No data for this dimension.'} /> : rows.map((row, i) => (
                                        <SovereigntyRow key={i} row={row} onClick={() => handleDrill(sovereigntyAxis, row)} avatarFor={avatarFor} topOperatorColorFor={operatorColor} />
                                    ))}
                                </Card>
                            </div>
                        );
                    })()}

                    {/* By Type + Servers */}
                    <MetricGrid cols={2}>
                        <div>
                            <SectionTitle icon={Link2}>{t('usage.integ_by_type')}</SectionTitle>
                            <Card>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Integration · Direction · PII</span>
                                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Calls · Last used</span>
                                </div>
                                {integData.byType.length === 0 ? <EmptyInline text={t('usage.integ_no_data')} /> : integData.byType.slice(0, 10).map((item, i) => {
                                    const total = Number(item.total) || 0;
                                    const pii = Number(item.pii_events) || 0;
                                    return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                <IntegrationLogo integrationType={item.integration_type} fallbackColor={getColor(i)} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{(item.integration_type || 'unknown').replace(/_/g, ' ')}</div>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 10 }}>
                                                        {Number(item.sent) > 0 && <span style={{ color: '#3b82f6', fontWeight: 600 }}>{item.sent} {t('usage.integ_sent')}</span>}
                                                        {Number(item.received) > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}>{item.received} {t('usage.integ_received')}</span>}
                                                        {pii > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{pii} {t('usage.integ_pii')}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{total}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('usage.integ_last_used')} {item.last_used ? new Date(item.last_used).toLocaleDateString() : '—'}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </Card>
                        </div>

                        <div>
                            <SectionTitle icon={Server}>{t('usage.integ_by_server')}</SectionTitle>
                            <Card>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Hostname · Region · IPs</span>
                                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Calls · Last contact</span>
                                </div>
                                {integData.servers.length === 0 ? <EmptyInline text={t('usage.integ_no_data')} /> : integData.servers.slice(0, 10).map((srv, i) => {
                                    const total = Number(srv.total) || 0;
                                    const flags = srv.country_flags || [], names = srv.country_names || [], codes = srv.country_codes || [], ips = srv.server_ips || [];
                                    return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                <IconBadge icon={Server} color={getColor(i + 2)} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={srv.server_endpoint}>{srv.server_endpoint}</div>
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 2, fontSize: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                                        {flags.length > 0 && flags.map((flag, fi) => (<span key={fi} style={{ fontWeight: 600, color: srv.is_eu ? '#10b981' : '#f59e0b' }}>{flag} {names[fi] || codes[fi]}</span>))}
                                                        {srv.is_eu !== undefined && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: srv.is_eu ? '#10b98118' : '#f59e0b18', color: srv.is_eu ? '#10b981' : '#f59e0b', letterSpacing: '0.03em' }}>{srv.is_eu ? 'EU/EEA' : 'Non-EU'}</span>}
                                                        <span style={{ color: 'var(--text-muted)' }}>{Number(srv.integration_count) || 0} integrations</span>
                                                        {Number(srv.sent) > 0 && <span style={{ color: '#3b82f6', fontWeight: 600 }}>{srv.sent}↑</span>}
                                                        {Number(srv.received) > 0 && <span style={{ color: '#10b981', fontWeight: 600 }}>{srv.received}↓</span>}
                                                    </div>
                                                    {ips.length > 0 && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>IP: {ips.join(', ')}</div>}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{total}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('usage.integ_last_contact')} {srv.last_contact ? new Date(srv.last_contact).toLocaleDateString() : '—'}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </Card>
                        </div>
                    </MetricGrid>

                    {/* PII categories warning frame */}
                    {integData.piiSummary.length > 0 && (
                        <div style={{ padding: 14, borderRadius: 12, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.35)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <AlertTriangle style={{ width: 13, height: 13, color: '#ef4444' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', letterSpacing: '-0.01em' }}>{t('usage.integ_pii_by_category')}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Personal data detected leaving the agent — verify these tools have a legitimate reason to handle the categories below.</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {integData.piiSummary.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--bg-primary)', border: '1px solid rgba(239,68,68,0.35)' }}>
                                        <Fingerprint style={{ width: 11, height: 11, color: '#ef4444' }} />
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>{p.pii_category}</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 8 }}>{p.count}</span>
                                        <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{(p.integration_type || '').replace(/_/g, ' ')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Operators */}
                    {integData.operators.length > 0 && (() => {
                        const ops = integData.operators;
                        const grand = ops.reduce((s, o) => s + (Number(o.total) || 0), 0) || 1;
                        return (
                            <div>
                                <SectionTitle icon={Server}>Destinations by operator</SectionTitle>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                                    {ops.map((op, i) => {
                                        const total = Number(op.total) || 0, ips = Number(op.unique_ips) || 0, integs = Number(op.unique_integrations) || 0;
                                        const name = op.operator || 'Unknown';
                                        const isUnknown = name === 'Unknown';
                                        const c = operatorColor(name);
                                        const pct = Math.round((total / grand) * 100);
                                        return (
                                            <div key={i} style={{ position: 'relative', padding: 14, borderRadius: 12, overflow: 'hidden', background: isUnknown ? 'rgba(245,158,11,0.08)' : 'var(--bg-secondary)', border: isUnknown ? '1px solid rgba(245,158,11,0.45)' : '1px solid var(--border-subtle)' }}>
                                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: isUnknown ? 4 : 3, background: c }} />
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${c}18`, color: c, fontSize: 12, fontWeight: 800, letterSpacing: '-0.02em' }}>{isUnknown ? <AlertTriangle style={{ width: 14, height: 14 }} /> : name[0]}</div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                                                            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ips} IP{ips === 1 ? '' : 's'} · {integs} integration{integs === 1 ? '' : 's'}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{total}</div>
                                                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{pct}% of egress</div>
                                                    </div>
                                                </div>
                                                <div style={{ height: 4, borderRadius: 99, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, background: c, transition: 'width 0.4s ease' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 9, color: 'var(--text-muted)' }}>
                                                    {op.any_eu ? <span style={{ padding: '2px 6px', borderRadius: 5, background: '#10b98115', color: '#10b981', fontWeight: 700, letterSpacing: '0.03em' }}>EU/EEA SEEN</span> : <span style={{ padding: '2px 6px', borderRadius: 5, background: '#f59e0b15', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.03em' }}>NON-EU</span>}
                                                    <span>last {op.last_seen ? new Date(op.last_seen).toLocaleDateString() : '—'}</span>
                                                </div>
                                                {isUnknown && <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, color: '#92400e' }}>Operator not in our registry — verify these IPs are expected.</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Egress log */}
                    {integData.egress.length > 0 && (() => {
                        const euOpts = [
                            { value: 'all', label: 'All' },
                            { value: 'eu', label: '🇪🇺 EU only' },
                            { value: 'non-eu', label: 'Non-EU' },
                            { value: 'local', label: 'Local' },
                        ];
                        const filtered = integData.egress.filter(ev => {
                            if (egressEuFilter === 'eu' && ev.is_eu !== true) return false;
                            if (egressEuFilter === 'non-eu' && (ev.is_eu !== false || ev.is_local)) return false;
                            if (egressEuFilter === 'local' && !ev.is_local) return false;
                            if (egressDrill) {
                                const d = egressDrill;
                                if (d.axis === 'user' && ev.user_id !== d.key) return false;
                                if (d.axis === 'agent' && (ev.agent_id || 'direct-chat') !== d.key) return false;
                                if (d.axis === 'integration' && ev.integration_type !== d.key) return false;
                                if (d.axis === 'pii') {
                                    const cats = (ev.pii_categories_detected || '').split(',').map(s => s.trim());
                                    if (!cats.includes(d.key)) return false;
                                }
                                if (d.axis === 'pii-non-eu') {
                                    const hasPii = ev.pii_categories_detected && ev.pii_categories_detected.trim() !== '';
                                    if (ev.is_eu || ev.is_local || !hasPii) return false;
                                }
                            }
                            return true;
                        });
                        return (
                            <div ref={egressLogRef}>
                                <SectionTitle icon={Activity} right={<FilterChipBar size="sm" value={egressEuFilter} onChange={setEgressEuFilter} options={euOpts} />}>Data egress log</SectionTitle>
                                {egressDrill && <DrillChip axis={egressDrill.axis} label={egressDrill.label || egressDrill.key} onClear={() => setEgressDrill(null)} />}
                                <Card>
                                    <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 90px 100px 160px 130px 70px 60px', padding: '8px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)', borderLeft: '3px solid transparent' }}>
                                        {['Time', 'User', 'Tool', 'Integration', 'Hostname → Peer IP', 'Operator', 'Region', 'Direction'].map(h => (
                                            <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{h}</span>
                                        ))}
                                    </div>
                                    {filtered.length === 0 ? <EmptyInline text="No rows match this filter." /> : filtered.slice(0, egressShow).map((ev, i) => {
                                        const dirColor = ev.data_direction === 'sent' ? '#3b82f6' : ev.data_direction === 'received' ? '#10b981' : '#f59e0b';
                                        const sourceColor = ev.peer_ip_source === 'socket' ? '#10b981' : ev.peer_ip_source === 'dns_pre_call' ? '#0ea5e9' : ev.peer_ip_source === 'local' ? '#64748b' : '#f59e0b';
                                        const rowAccent = ev.is_local ? '#14b8a6' : (ev.operator ? operatorColor(ev.operator) : '#94a3b8');
                                        return (
                                            <div key={ev.id || i} style={{ display: 'grid', gridTemplateColumns: '110px 130px 90px 100px 160px 130px 70px 60px', padding: '7px 14px 7px 11px', alignItems: 'center', background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', borderLeft: `3px solid ${rowAccent}`, fontSize: 11 }}>
                                                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{new Date(ev.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0 }}>
                                                    <Avatar user={ev} color={getColor(i)} size={18} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.display_name || ev.user_id || 'Unknown'}</span>
                                                </span>
                                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }} title={ev.tool_name}>{ev.tool_name}</span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: getColor(i), textTransform: 'capitalize', fontSize: 10, minWidth: 0 }}>
                                                    {hasIntegrationIcon(ev.integration_type) && <span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getIntegrationIcon(ev.integration_type)}</span>}
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(ev.integration_type || '').replace(/_/g, ' ')}</span>
                                                </span>
                                                <span style={{ minWidth: 0, overflow: 'hidden' }}>
                                                    {ev.is_local ? <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#10b98115', color: '#10b981' }}>Local</span> : (() => {
                                                        const realHost = ev.tls_servername || ev.server_endpoint || '—';
                                                        const showAlt = ev.tls_servername && ev.server_endpoint && ev.tls_servername !== ev.server_endpoint;
                                                        return (
                                                            <>
                                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={realHost}>{realHost}</div>
                                                                {showAlt && <div style={{ fontSize: 8, color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Configured: ${ev.server_endpoint}`}>cfg: {ev.server_endpoint}</div>}
                                                                <div style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', fontWeight: 700, color: 'var(--text-primary)', fontSize: 11 }}>{ev.peer_ip || '—'}</div>
                                                                {ev.peer_ip_source && <span style={{ fontSize: 8, fontWeight: 700, color: sourceColor, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{ev.peer_ip_source.replace(/_/g, ' ')}</span>}
                                                            </>
                                                        );
                                                    })()}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: ev.operator ? 'var(--text-primary)' : 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap' }} title={ev.operator || (ev.is_local ? 'Local' : 'Unknown')}>
                                                    {!ev.is_local && <span style={{ width: 6, height: 6, borderRadius: '50%', background: rowAccent, flexShrink: 0 }} />}
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.operator || (ev.is_local ? '—' : 'Unknown')}</span>
                                                </span>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: ev.is_eu ? '#10b981' : ev.country_flag ? '#f59e0b' : 'var(--text-muted)' }} title={ev.country_name || ''}>{ev.is_local ? '—' : ev.country_flag ? `${ev.country_flag} ${ev.country_code || ''}` : '—'}</span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                    {ev.data_direction === 'sent' && <ArrowRight style={{ width: 10, height: 10, color: dirColor }} />}
                                                    {ev.data_direction === 'received' && <ArrowLeft style={{ width: 10, height: 10, color: dirColor }} />}
                                                    {ev.data_direction === 'both' && <><ArrowRight style={{ width: 8, height: 8, color: dirColor }} /><ArrowLeft style={{ width: 8, height: 8, color: dirColor }} /></>}
                                                    <span style={{ fontWeight: 600, color: dirColor, textTransform: 'capitalize', fontSize: 10 }}>{ev.data_direction}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {filtered.length > egressShow && <ShowMore remaining={filtered.length - egressShow} onMore={() => setEgressShow(c => c + 50)} label={t('usage.safety_show_more', 'Show more')} />}
                                </Card>
                            </div>
                        );
                    })()}
                </>
            )}
        </div>
    );
}
