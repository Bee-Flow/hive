import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    AlertTriangle, AlertOctagon, ZapOff, RefreshCcw, XCircle,
    Clock, Filter, Search, Bot, Paperclip, FileWarning, Calendar, RefreshCw,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

const API = `${API_BASE}/api/terminations/org`;

// Palette — explicitly excludes purple/violet/indigo.
const C = {
    blue: '#3b82f6',
    green: '#10b981',
    amber: '#f59e0b',
    orange: '#f97316',
    rose: '#f43f5e',
    cyan: '#06b6d4',
};

// LARGE_INPUT_TOKEN_THRESHOLD / LARGE_ATTACHMENT_BYTES_THRESHOLD mirror the
// admin Terminations page so an "input-driven" stop is flagged identically.
const LARGE_INPUT_TOKEN_THRESHOLD = 8000;
const LARGE_ATTACHMENT_BYTES_THRESHOLD = 256 * 1024;

const TYPE_ORDER = ['max_tokens', 'max_iterations', 'error', 'aborted'];

function typeMeta(t) {
    if (t === 'max_tokens') return { color: C.amber, icon: ZapOff };
    if (t === 'max_iterations') return { color: C.orange, icon: RefreshCcw };
    if (t === 'error') return { color: C.rose, icon: AlertOctagon };
    if (t === 'aborted') return { color: C.cyan, icon: XCircle };
    return { color: C.rose, icon: AlertTriangle };
}

const RANGES = [
    { id: 'today', labelKey: 'org.terminations_today' },
    { id: '7d', labelKey: 'org.terminations_7d' },
    { id: '30d', labelKey: 'org.terminations_30d' },
    { id: 'all', labelKey: 'org.terminations_all_time' },
    { id: 'custom', labelKey: 'org.terminations_custom' },
];

function rangeQuery(range, customStart, customEnd) {
    if (range === 'all') return '';
    if (range === 'custom' && customStart && customEnd) {
        return `?startDate=${encodeURIComponent(new Date(customStart).toISOString())}&endDate=${encodeURIComponent(new Date(customEnd).toISOString())}`;
    }
    const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 30;
    return `?days=${days}`;
}

function toLocalInput(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(n) {
    if (n == null) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(Math.round(n));
}

function fmtDuration(ms) {
    if (!ms) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return d.toLocaleDateString();
}

function fmtBytes(n) {
    if (!n || n <= 0) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function shortModel(m) {
    if (!m) return 'Unknown';
    return m.replace(/^(openai\/|anthropic\/|google\/|azure\/|mistral\/)/, '')
        .replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

function isLargeInput(row) {
    if ((row.attachment_bytes || 0) >= LARGE_ATTACHMENT_BYTES_THRESHOLD) return true;
    if ((row.prompt_tokens || 0) >= LARGE_INPUT_TOKEN_THRESHOLD) return true;
    const total = (row.prompt_tokens || 0) + (row.completion_tokens || 0);
    if (total > 0 && (row.prompt_tokens / total) >= 0.85 && row.termination_type === 'max_tokens') return true;
    return false;
}

const Card = ({ children, style, title, icon: Icon }) => (
    <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: '14px 16px', ...style,
    }}>
        {title && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                {Icon && <Icon style={{ width: 14, height: 14, color: 'var(--accent-primary)', opacity: 0.8 }} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
            </div>
        )}
        {children}
    </div>
);

const Empty = ({ text }) => (
    <div style={{
        padding: '1.5rem 1rem', textAlign: 'center',
        color: 'var(--text-muted)', fontSize: 13,
        borderRadius: 10, background: 'var(--bg-tertiary)',
    }}>{text}</div>
);

const Kpi = ({ icon: Icon, label, value, color, subtitle }) => (
    <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 5,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
                width: 26, height: 26, borderRadius: 6,
                background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Icon style={{ width: 13, height: 13, color }} />
            </div>
            <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--text-muted)',
            }}>{label}</span>
        </div>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.05 }}>
            {value}
        </span>
        {subtitle && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</span>
        )}
    </div>
);

function TypeBadge({ type, t }) {
    const meta = typeMeta(type);
    const Icon = meta.icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30`,
        }}>
            <Icon style={{ width: 11, height: 11 }} />
            {t(`org.terminations_type_${type}`) || type}
        </span>
    );
}

function StackedBarChart({ data, t }) {
    if (!data || data.length === 0) return <Empty text={t('org.terminations_no_data')} />;
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
                        <div title={`${p.period} · ${total}`} style={{
                            width: '100%', height: `${heightPct}%`, minHeight: total > 0 ? 2 : 0,
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                            borderRadius: '4px 4px 0 0', overflow: 'hidden',
                        }}>
                            {TYPE_ORDER.map(tk => {
                                const v = p[tk] || 0;
                                if (v === 0) return null;
                                return (
                                    <div key={tk} style={{
                                        height: `${(v / total) * 100}%`,
                                        background: typeMeta(tk).color,
                                    }} />
                                );
                            })}
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {p.period.slice(5)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function DetailRow({ label, value, mono }) {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span style={{
                minWidth: 110, fontSize: 11, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{label}</span>
            <span style={{
                fontFamily: mono ? 'var(--font-mono, ui-monospace, monospace)' : 'inherit',
                wordBreak: 'break-all', flex: 1,
                color: value ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
                {value || '—'}
            </span>
        </div>
    );
}

export default function OrgTerminationsPanel() {
    const { t } = useTranslation();
    const [range, setRange] = useState('7d');
    const [customStart, setCustomStart] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return toLocalInput(d);
    });
    const [customEnd, setCustomEnd] = useState(() => toLocalInput(new Date()));
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
            const q = rangeQuery(range, customStart, customEnd);
            const interval = (range === 'today'
                || (range === 'custom' && customStart && customEnd && (new Date(customEnd) - new Date(customStart)) <= 86400000))
                ? 'hour' : 'day';
            const intervalQ = (q ? '&' : '?') + `interval=${interval}`;
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
    }, [range, customStart, customEnd]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = useMemo(() => {
        let data = rows;
        if (filterType) data = data.filter(r => r.termination_type === filterType);
        if (filterAgent) data = data.filter(r => r.agent_id === filterAgent);
        if (search) {
            const q = search.toLowerCase();
            data = data.filter(r =>
                (r.agent_name || '').toLowerCase().includes(q) ||
                (r.model || '').toLowerCase().includes(q) ||
                (r.error_code || '').toLowerCase().includes(q)
            );
        }
        return data;
    }, [rows, filterType, filterAgent, search]);

    const agentOptions = useMemo(() => {
        const seen = new Map();
        for (const r of rows) {
            if (r.agent_id && !seen.has(r.agent_id)) seen.set(r.agent_id, r.agent_name || r.agent_id);
        }
        return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }, [rows]);

    const largeInputCount = useMemo(() => rows.filter(isLargeInput).length, [rows]);

    const total = summary?.total || 0;
    const by = summary?.by_type || {};

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header / range selector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {t('org.terminations_title')}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 400 }}>
                        {t('org.terminations_subtitle')}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex', borderRadius: 8, overflow: 'hidden',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        {RANGES.map(r => {
                            const active = range === r.id;
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => setRange(r.id)}
                                    style={{
                                        padding: '6px 12px', fontSize: 11, fontWeight: 600,
                                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                        background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                        color: active ? '#fff' : 'var(--text-muted)',
                                        display: 'flex', alignItems: 'center', gap: 5,
                                    }}
                                >
                                    {r.id === 'custom' && <Calendar style={{ width: 11, height: 11 }} />}
                                    {t(r.labelKey)}
                                </button>
                            );
                        })}
                    </div>
                    {range === 'custom' && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 8px', borderRadius: 8,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            <input
                                type="datetime-local"
                                value={customStart}
                                max={customEnd}
                                onChange={e => setCustomStart(e.target.value)}
                                style={dateInputStyle}
                            />
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→</span>
                            <input
                                type="datetime-local"
                                value={customEnd}
                                min={customStart}
                                onChange={e => setCustomEnd(e.target.value)}
                                style={dateInputStyle}
                            />
                        </div>
                    )}
                    <button
                        onClick={fetchData}
                        title={t('org.terminations_refresh')}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-secondary)', cursor: 'pointer',
                            color: 'var(--text-muted)',
                        }}
                    >
                        <RefreshCw style={{ width: 13, height: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
            </div>

            {loading && rows.length === 0 ? (
                <Card>
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t('org.terminations_loading')}
                    </div>
                </Card>
            ) : (
                <>
                    {/* KPI cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                        <Kpi icon={AlertTriangle} label={t('org.terminations_kpi_total')} value={fmt(total)} color={C.rose} />
                        <Kpi icon={ZapOff} label={t('org.terminations_kpi_max_tokens')} value={fmt(by.max_tokens || 0)} color={C.amber}
                            subtitle={total ? `${Math.round(((by.max_tokens || 0) / total) * 100)}% ${t('org.terminations_of_stops')}` : ''} />
                        <Kpi icon={RefreshCcw} label={t('org.terminations_kpi_max_iterations')} value={fmt(by.max_iterations || 0)} color={C.orange}
                            subtitle={total ? `${Math.round(((by.max_iterations || 0) / total) * 100)}% ${t('org.terminations_of_stops')}` : ''} />
                        <Kpi icon={AlertOctagon} label={t('org.terminations_kpi_errors')} value={fmt(by.error || 0)} color={C.rose}
                            subtitle={total ? `${Math.round(((by.error || 0) / total) * 100)}% ${t('org.terminations_of_stops')}` : ''} />
                        <Kpi icon={XCircle} label={t('org.terminations_kpi_aborted')} value={fmt(by.aborted || 0)} color={C.cyan}
                            subtitle={t('org.terminations_kpi_aborted_sub')} />
                        <Kpi icon={FileWarning} label={t('org.terminations_kpi_large_input')} value={fmt(largeInputCount)} color={C.amber}
                            subtitle={t('org.terminations_kpi_large_input_sub')} />
                    </div>

                    {/* Timeline */}
                    <Card title={t('org.terminations_over_time')} icon={Clock}>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, flexWrap: 'wrap' }}>
                            {TYPE_ORDER.map(tk => (
                                <span key={tk} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: typeMeta(tk).color }} />
                                    {t(`org.terminations_type_${tk}`)}
                                </span>
                            ))}
                        </div>
                        <StackedBarChart data={timeline} t={t} />
                    </Card>

                    {/* By agent */}
                    {byAgent.length > 0 && (
                        <Card title={t('org.terminations_by_agent')} icon={Bot}>
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 70px 70px', gap: 8, padding: '6px 4px',
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)',
                            }}>
                                <span>{t('org.terminations_col_agent')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_total')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_max_tok')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_max_iter')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_errors')}</span>
                                <span style={{ textAlign: 'right' }}>{t('org.terminations_col_aborted')}</span>
                            </div>
                            {byAgent.map(a => (
                                <div key={a.agent_id || 'unknown'} style={{
                                    display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 70px 70px', gap: 8,
                                    padding: '8px 4px', borderTop: '1px solid var(--border-subtle)',
                                    fontSize: 12, color: 'var(--text-primary)', alignItems: 'center',
                                }}>
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
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                                borderRadius: 8, background: 'var(--bg-primary)',
                                border: '1px solid var(--border-subtle)', flex: '0 1 220px',
                            }}>
                                <Search style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={t('org.terminations_search_placeholder')}
                                    style={{
                                        background: 'transparent', border: 'none', outline: 'none',
                                        fontSize: 12, color: 'var(--text-primary)', width: '100%',
                                    }}
                                />
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
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {filtered.length} {t(filtered.length === 1 ? 'org.terminations_event' : 'org.terminations_events')}
                            </span>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '90px 1fr 1fr 130px 90px 50px 70px 70px 24px',
                            gap: 8, padding: '8px',
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: 'var(--text-muted)',
                        }}>
                            <span>{t('org.terminations_col_time')}</span>
                            <span>{t('org.terminations_col_agent')}</span>
                            <span>{t('org.terminations_col_model')}</span>
                            <span>{t('org.terminations_col_type')}</span>
                            <span>{t('org.terminations_col_error_code')}</span>
                            <span style={{ textAlign: 'right' }}>{t('org.terminations_col_iter')}</span>
                            <span style={{ textAlign: 'right' }}>{t('org.terminations_col_duration')}</span>
                            <span style={{ textAlign: 'right' }}>{t('org.terminations_col_tokens')}</span>
                            <span></span>
                        </div>

                        {filtered.length === 0 && <Empty text={t('org.terminations_empty')} />}

                        {filtered.map(r => {
                            const isOpen = expanded === r.id;
                            const meta = typeMeta(r.termination_type);
                            return (
                                <div key={r.id}>
                                    <div
                                        onClick={() => setExpanded(isOpen ? null : r.id)}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '90px 1fr 1fr 130px 90px 50px 70px 70px 24px',
                                            gap: 8, padding: '10px 8px',
                                            borderTop: '1px solid var(--border-subtle)',
                                            fontSize: 12, color: 'var(--text-primary)',
                                            alignItems: 'center', cursor: 'pointer',
                                        }}
                                    >
                                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{fmtTime(r.timestamp)}</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.agent_name || r.agent_id || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                            {shortModel(r.model)}
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <TypeBadge type={r.termination_type} t={t} />
                                            {isLargeInput(r) && (
                                                <span title={t('org.terminations_large_input_hint')} style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                                    padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                                                    background: `${C.amber}15`, color: C.amber,
                                                    border: `1px solid ${C.amber}30`, marginLeft: 6,
                                                }}>
                                                    <FileWarning style={{ width: 10, height: 10 }} />
                                                    {t('org.terminations_large_input')}
                                                </span>
                                            )}
                                        </span>
                                        <span style={{ fontSize: 11, color: r.error_code ? C.rose : 'var(--text-muted)' }}>
                                            {r.error_code || '—'}
                                        </span>
                                        <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{r.iteration_count || 0}</span>
                                        <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{fmtDuration(r.duration_ms)}</span>
                                        <span style={{
                                            textAlign: 'right', color: 'var(--text-muted)',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                                        }}>
                                            {r.attachment_count > 0 && (
                                                <Paperclip
                                                    title={`${r.attachment_count} · ${fmtBytes(r.attachment_bytes || 0)}`}
                                                    style={{ width: 11, height: 11, color: C.amber }}
                                                />
                                            )}
                                            {fmt(r.total_tokens)}
                                        </span>
                                        <span style={{ color: meta.color, textAlign: 'right' }}>
                                            {isOpen ? '▾' : '▸'}
                                        </span>
                                    </div>
                                    {isOpen && (
                                        <div style={{
                                            padding: '12px 16px',
                                            background: 'var(--bg-primary)',
                                            fontSize: 12, color: 'var(--text-muted)',
                                            display: 'flex', flexDirection: 'column', gap: 6,
                                            borderTop: '1px solid var(--border-subtle)',
                                        }}>
                                            <DetailRow label={t('org.terminations_detail_source')} value={r.source} />
                                            <DetailRow label={t('org.terminations_detail_conversation')} value={r.conversation_id} mono />
                                            <DetailRow label={t('org.terminations_detail_user')} value={r.user_id} mono />
                                            <DetailRow label={t('org.terminations_detail_error_class')} value={r.error_class} />
                                            <DetailRow label={t('org.terminations_detail_error')} value={r.error_first_line} mono />
                                            <DetailRow label={t('org.terminations_detail_stack')} value={r.stack_first_line} mono />
                                            <DetailRow
                                                label={t('org.terminations_detail_tokens')}
                                                value={(() => {
                                                    const tot = (r.prompt_tokens || 0) + (r.completion_tokens || 0);
                                                    const ratio = tot > 0 ? Math.round((r.prompt_tokens / tot) * 100) : 0;
                                                    return `prompt ${fmt(r.prompt_tokens)} · completion ${fmt(r.completion_tokens)} · total ${fmt(r.total_tokens)}${tot > 0 ? ` (prompt ${ratio}%)` : ''}`;
                                                })()}
                                            />
                                            <DetailRow
                                                label={t('org.terminations_detail_attachments')}
                                                value={r.attachment_count > 0
                                                    ? `${r.attachment_count} · ${fmtBytes(r.attachment_bytes || 0)}`
                                                    : null}
                                            />
                                            {isLargeInput(r) && (
                                                <div style={{
                                                    marginTop: 6, padding: '8px 10px', borderRadius: 8,
                                                    background: `${C.amber}12`, border: `1px solid ${C.amber}30`,
                                                    fontSize: 11, color: C.amber, display: 'flex', gap: 6, alignItems: 'flex-start',
                                                }}>
                                                    <FileWarning style={{ width: 12, height: 12, marginTop: 1, flexShrink: 0 }} />
                                                    <span>
                                                        <strong>{t('org.terminations_large_input_strong')}</strong>{' '}
                                                        {t('org.terminations_large_input_explain')}
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                {t('org.terminations_privacy_note')}
                                            </div>
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
    borderRadius: 8, background: 'var(--bg-primary)',
    border: '1px solid var(--border-subtle)',
};

const filterSelectStyle = {
    background: 'transparent', border: 'none', outline: 'none',
    fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer',
};

const dateInputStyle = {
    background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
    borderRadius: 6, padding: '3px 6px', fontSize: 11,
    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
};
