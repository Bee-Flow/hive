import {
    AlertTriangle, AlertOctagon, ZapOff, RefreshCcw, XCircle,
    Clock, Filter, Search, Bot, Paperclip, FileWarning, RefreshCw,
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fNum as fmt, fmtTime, fmtDuration, fmtBytes, shortModel } from './usage/format';
import { Card, MetricCard, MetricGrid, MonitorHero, TabHeader, AlertBanner, EmptyInline, TOKENS } from './usage/kit';
import { SEMANTIC } from '../../config/analyticsConfig';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';

const TERMINATIONS_ERROR_ALERT_PCT = 5;
const TERMINATIONS_MIN_SAMPLE = 10;
const API = `${API_BASE}/api/terminations/org`;

const C = SEMANTIC;

const LARGE_INPUT_TOKEN_THRESHOLD = 8000;
const LARGE_ATTACHMENT_BYTES_THRESHOLD = 256 * 1024;
const TYPE_ORDER = ['max_tokens', 'max_iterations', 'error', 'aborted'];

function typeMeta(tk) {
    if (tk === 'max_tokens') return { color: C.amber, icon: ZapOff };
    if (tk === 'max_iterations') return { color: C.orange, icon: RefreshCcw };
    if (tk === 'error') return { color: C.rose, icon: AlertOctagon };
    if (tk === 'aborted') return { color: C.cyan, icon: XCircle };
    return { color: C.rose, icon: AlertTriangle };
}

// Token-based heuristics only count when tokens are visible (self-hosted /
// cloud-admin); in the cloud customer view the badge is attachment-driven only,
// so it never leaks token magnitude.
function isLargeInput(row, showTokens) {
    if ((row.attachment_bytes || 0) >= LARGE_ATTACHMENT_BYTES_THRESHOLD) return true;
    if (!showTokens) return false;
    if ((row.prompt_tokens || 0) >= LARGE_INPUT_TOKEN_THRESHOLD) return true;
    const total = (row.prompt_tokens || 0) + (row.completion_tokens || 0);
    if (total > 0 && (row.prompt_tokens / total) >= 0.85 && row.termination_type === 'max_tokens') return true;
    return false;
}

function TypeBadge({ type, t }) {
    const meta = typeMeta(type);
    const Icon = meta.icon;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
            <Icon style={{ width: 11, height: 11 }} />{t(`org.terminations_type_${type}`) || type}
        </span>
    );
}

function StackedBarChart({ data, t }) {
    if (!data || data.length === 0) return <EmptyInline boxed text={t('org.terminations_no_data')} />;
    const buckets = {};
    for (const r of data) {
        if (!buckets[r.period]) buckets[r.period] = { period: r.period };
        buckets[r.period][r.termination_type] = (buckets[r.period][r.termination_type] || 0) + r.count;
    }
    const periods = Object.values(buckets).sort((a, b) => a.period.localeCompare(b.period));
    const maxTotal = Math.max(...periods.map(p => TYPE_ORDER.reduce((s, t2) => s + (p[t2] || 0), 0)), 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, padding: '8px 0' }}>
            {periods.map(p => {
                const total = TYPE_ORDER.reduce((s, t2) => s + (p[t2] || 0), 0);
                const heightPct = (total / maxTotal) * 100;
                return (
                    <div key={p.period} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 8 }}>
                        <div title={`${p.period} · ${total}`} style={{ width: '100%', height: `${heightPct}%`, minHeight: total > 0 ? 2 : 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '4px 4px 0 0', overflow: 'hidden' }}>
                            {TYPE_ORDER.map(tk => {
                                const v = p[tk] || 0;
                                if (v === 0) return null;
                                return <div key={tk} style={{ height: `${(v / total) * 100}%`, background: typeMeta(tk).color }} />;
                            })}
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.period.slice(5)}</span>
                    </div>
                );
            })}
        </div>
    );
}

function DetailRow({ label, value, mono }) {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span style={{ minWidth: 110, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            <span style={{ fontFamily: mono ? 'var(--font-mono, ui-monospace, monospace)' : 'inherit', wordBreak: 'break-all', flex: 1, color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>{value || '—'}</span>
        </div>
    );
}

export default function OrgTerminationsPanel({ rangeParams, showTokens = true }) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [rows, setRows] = useState([]);
    const [byAgent, setByAgent] = useState([]);

    const [filterType, setFilterType] = useState('');
    const [filterAgent, setFilterAgent] = useState('');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const q = rangeParams?.startDate
                ? `?startDate=${encodeURIComponent(rangeParams.startDate)}&endDate=${encodeURIComponent(rangeParams.endDate)}`
                : (rangeParams?.days != null ? `?days=${rangeParams.days}` : '');
            const intervalQ = (q ? '&' : '?') + `interval=${rangeParams?.interval || 'day'}`;
            const [sumR, tlR, listR, agR] = await Promise.all([
                authFetch(`${API}/summary${q}`),
                authFetch(`${API}/timeline${q}${intervalQ}`),
                authFetch(`${API}${q}${q ? '&' : '?'}limit=200`),
                authFetch(`${API}/by-agent${q}`),
            ]);
            const sj = async r => { try { return r.ok ? await r.json() : null; } catch { return null; } };
            const [sum, tl, list, ag] = await Promise.all([sj(sumR), sj(tlR), sj(listR), sj(agR)]);
            setSummary(sum);
            setTimeline(tl?.rows || []);
            setRows(list?.rows || []);
            setByAgent(ag?.rows || []);
        } catch (e) {
            console.error('[OrgTerminations] fetch error:', e);
        }
        setLoading(false);
    }, [rangeParams]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = useMemo(() => {
        let data = rows;
        if (filterType) data = data.filter(r => r.termination_type === filterType);
        if (filterAgent) data = data.filter(r => r.agent_id === filterAgent);
        if (search) {
            const q = search.toLowerCase();
            data = data.filter(r => (r.agent_name || '').toLowerCase().includes(q) || (r.model || '').toLowerCase().includes(q) || (r.error_code || '').toLowerCase().includes(q));
        }
        return data;
    }, [rows, filterType, filterAgent, search]);

    const agentOptions = useMemo(() => {
        const seen = new Map();
        for (const r of rows) if (r.agent_id && !seen.has(r.agent_id)) seen.set(r.agent_id, r.agent_name || r.agent_id);
        return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }, [rows]);

    const largeInputCount = useMemo(() => rows.filter(r => isLargeInput(r, showTokens)).length, [rows, showTokens]);

    const total = summary?.total || 0;
    const by = summary?.by_type || {};
    const errCount = by.error || 0;
    const errPct = total > 0 ? Math.round((errCount / total) * 100) : null;
    const cleanPct = errPct === null ? null : 100 - errPct;
    const heroColor = cleanPct === null ? '#94a3b8' : cleanPct >= 95 ? '#10b981' : cleanPct >= 80 ? '#f59e0b' : '#ef4444';
    const heroLabel = cleanPct === null ? 'No data' : cleanPct >= 95 ? 'Healthy' : cleanPct >= 80 ? 'Watch' : 'Failing';

    // Detail table column template (drop the TOKENS track in the cloud view).
    const cols = showTokens
        ? '90px 1fr 1fr 130px 90px 50px 70px 70px 24px'
        : '90px 1fr 1fr 130px 90px 50px 70px 24px';

    const refreshBtn = (
        <button onClick={fetchData} title={t('org.terminations_refresh')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-muted)',
        }}>
            <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: TOKENS.pagePad }}>
            <TabHeader icon={AlertTriangle} iconColor="#f43f5e" title={t('org.terminations_title')} description={t('org.terminations_subtitle')} actions={refreshBtn} />

            {loading && rows.length === 0 ? (
                <Card><div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{t('org.terminations_loading')}</div></Card>
            ) : (
                <>
                    {total >= TERMINATIONS_MIN_SAMPLE && errPct > TERMINATIONS_ERROR_ALERT_PCT && (
                        <AlertBanner
                            severity={errPct > TERMINATIONS_ERROR_ALERT_PCT * 4 ? 'red' : 'amber'}
                            icon={AlertOctagon}
                            message={`${errCount} session${errCount === 1 ? '' : 's'} terminated by error (${errPct}% of total) — investigate failing integrations.`}
                            ctaLabel="Review errors"
                            onCta={() => setFilterType('error')}
                        />
                    )}

                    <MonitorHero
                        accent={heroColor}
                        eyebrow="Clean completion rate"
                        value={cleanPct === null ? '—' : `${cleanPct}%`}
                        valueColor={heroColor}
                        status={{ label: heroLabel, color: heroColor }}
                        subline={`${total} session${total === 1 ? '' : 's'} terminated · ${errCount} error${errCount === 1 ? '' : 's'} (${errPct ?? 0}%)`}
                        aside={
                            <MetricGrid cols={2} gap={TOKENS.tileGap}>
                                <MetricCard size="sm" icon={ZapOff} color={C.amber} label={t('org.terminations_kpi_max_tokens')} value={fmt(by.max_tokens || 0)} />
                                <MetricCard size="sm" icon={RefreshCcw} color={C.orange} label={t('org.terminations_kpi_max_iterations')} value={fmt(by.max_iterations || 0)} />
                                <MetricCard size="sm" icon={AlertOctagon} color={C.rose} label={t('org.terminations_kpi_errors')} value={fmt(errCount)} />
                                <MetricCard size="sm" icon={XCircle} color={C.cyan} label={t('org.terminations_kpi_aborted')} value={fmt(by.aborted || 0)} />
                            </MetricGrid>
                        }
                    />

                    {largeInputCount > 0 && (
                        <MetricGrid min={170}>
                            <MetricCard size="md" icon={FileWarning} color={C.amber} label={t('org.terminations_kpi_large_input')} value={fmt(largeInputCount)} subtitle={t('org.terminations_kpi_large_input_sub')} />
                        </MetricGrid>
                    )}

                    {/* Timeline */}
                    <Card title={t('org.terminations_over_time')} icon={Clock}>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, flexWrap: 'wrap' }}>
                            {TYPE_ORDER.map(tk => (
                                <span key={tk} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: typeMeta(tk).color }} />{t(`org.terminations_type_${tk}`)}
                                </span>
                            ))}
                        </div>
                        <StackedBarChart data={timeline} t={t} />
                    </Card>

                    {/* By agent */}
                    {byAgent.length > 0 && (
                        <Card title={t('org.terminations_by_agent')} icon={Bot}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 70px 70px', gap: 8, padding: '6px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                <span>{t('org.terminations_col_agent')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_total')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_max_tok')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_max_iter')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_errors')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_aborted')}</span>
                            </div>
                            {byAgent.map(a => (
                                <div key={a.agent_id || 'unknown'} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 70px 70px', gap: 8, padding: '8px 4px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-primary)', alignItems: 'center' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.agent_name || a.agent_id || '—'}</span>
                                    <span style={{ textAlign: 'right', fontWeight: 700 }}>{a.total}</span>
                                    <span style={{ textAlign: 'right', color: C.amber }}>{a.max_tokens || 0}</span>
                                    <span style={{ textAlign: 'right', color: C.orange }}>{a.max_iterations || 0}</span>
                                    <span style={{ textAlign: 'right', color: C.rose }}>{a.errors || 0}</span>
                                    <span style={{ textAlign: 'right', color: C.cyan }}>{a.aborted || 0}</span>
                                </div>
                            ))}
                        </Card>
                    )}

                    {/* Detail table */}
                    <Card>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', flex: '0 1 220px' }}>
                                <Search style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('org.terminations_search_placeholder')} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', width: '100%' }} />
                            </div>
                            <div style={filterSelectWrapper}>
                                <Filter style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                                <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterSelectStyle}>
                                    <option value="">{t('org.terminations_all_types')}</option>
                                    {TYPE_ORDER.map(tk => <option key={tk} value={tk}>{t(`org.terminations_type_${tk}`)}</option>)}
                                </select>
                            </div>
                            <div style={filterSelectWrapper}>
                                <Bot style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                                <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} style={filterSelectStyle}>
                                    <option value="">{t('org.terminations_all_agents')}</option>
                                    {agentOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} {t(filtered.length === 1 ? 'org.terminations_event' : 'org.terminations_events')}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                            <span>{t('org.terminations_col_time')}</span>
                            <span>{t('org.terminations_col_agent')}</span>
                            <span>{t('org.terminations_col_model')}</span>
                            <span>{t('org.terminations_col_type')}</span>
                            <span>{t('org.terminations_col_error_code')}</span>
                            <span style={{ textAlign: 'right' }}>{t('org.terminations_col_iter')}</span>
                            <span style={{ textAlign: 'right' }}>{t('org.terminations_col_duration')}</span>
                            {showTokens && <span style={{ textAlign: 'right' }}>{t('org.terminations_col_tokens')}</span>}
                            <span></span>
                        </div>

                        {filtered.length === 0 && <EmptyInline boxed text={t('org.terminations_empty')} />}

                        {filtered.map(r => {
                            const isOpen = expanded === r.id;
                            const meta = typeMeta(r.termination_type);
                            return (
                                <div key={r.id}>
                                    <div onClick={() => setExpanded(isOpen ? null : r.id)} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '10px 8px', borderTop: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-primary)', alignItems: 'center', cursor: 'pointer' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{fmtTime(r.timestamp)}</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.agent_name || r.agent_id || <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{shortModel(r.model)}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <TypeBadge type={r.termination_type} t={t} />
                                            {isLargeInput(r, showTokens) && (
                                                <span title={t('org.terminations_large_input_hint')} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: `${C.amber}15`, color: C.amber, border: `1px solid ${C.amber}30`, marginLeft: 6 }}>
                                                    <FileWarning style={{ width: 10, height: 10 }} />{t('org.terminations_large_input')}
                                                </span>
                                            )}
                                        </span>
                                        <span style={{ fontSize: 11, color: r.error_code ? C.rose : 'var(--text-muted)' }}>{r.error_code || '—'}</span>
                                        <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{r.iteration_count || 0}</span>
                                        <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{fmtDuration(r.duration_ms)}</span>
                                        {showTokens && (
                                            <span style={{ textAlign: 'right', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                                {r.attachment_count > 0 && <Paperclip title={`${r.attachment_count} · ${fmtBytes(r.attachment_bytes || 0)}`} style={{ width: 11, height: 11, color: C.amber }} />}
                                                {fmt(r.total_tokens)}
                                            </span>
                                        )}
                                        <span style={{ color: meta.color, textAlign: 'right' }}>{isOpen ? '▾' : '▸'}</span>
                                    </div>
                                    {isOpen && (
                                        <div style={{ padding: '12px 16px', background: 'var(--bg-primary)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-subtle)' }}>
                                            <DetailRow label={t('org.terminations_detail_source')} value={r.source} />
                                            <DetailRow label={t('org.terminations_detail_conversation')} value={r.conversation_id} mono />
                                            <DetailRow label={t('org.terminations_detail_user')} value={r.user_id} mono />
                                            <DetailRow label={t('org.terminations_detail_error_class')} value={r.error_class} />
                                            <DetailRow label={t('org.terminations_detail_error')} value={r.error_first_line} mono />
                                            <DetailRow label={t('org.terminations_detail_stack')} value={r.stack_first_line} mono />
                                            {showTokens && (
                                                <DetailRow label={t('org.terminations_detail_tokens')} value={(() => {
                                                    const tot = (r.prompt_tokens || 0) + (r.completion_tokens || 0);
                                                    const ratio = tot > 0 ? Math.round((r.prompt_tokens / tot) * 100) : 0;
                                                    return `prompt ${fmt(r.prompt_tokens)} · completion ${fmt(r.completion_tokens)} · total ${fmt(r.total_tokens)}${tot > 0 ? ` (prompt ${ratio}%)` : ''}`;
                                                })()} />
                                            )}
                                            <DetailRow label={t('org.terminations_detail_attachments')} value={r.attachment_count > 0 ? `${r.attachment_count} · ${fmtBytes(r.attachment_bytes || 0)}` : null} />
                                            {isLargeInput(r, showTokens) && (
                                                <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: `${C.amber}12`, border: `1px solid ${C.amber}30`, fontSize: 11, color: C.amber, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                                    <FileWarning style={{ width: 12, height: 12, marginTop: 1, flexShrink: 0 }} />
                                                    <span><strong>{t('org.terminations_large_input_strong')}</strong> {t('org.terminations_large_input_explain')}</span>
                                                </div>
                                            )}
                                            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('org.terminations_privacy_note')}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </Card>
                </>
            )}
        </div>
    );
}

const filterSelectWrapper = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
    borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
};
const filterSelectStyle = {
    background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer',
};
