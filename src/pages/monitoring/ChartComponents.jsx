/**
 * 20+ Visualization Components for Monitoring Dashboard
 * Uses Recharts for charts, custom components for gauges/stats
 */
import React, { useRef, useEffect } from 'react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Treemap, FunnelChart, Funnel, LabelList,
    RadialBarChart, RadialBar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];

function getDataKeys(data) {
    if (!data?.columns?.length) return { categoryKey: null, valueKeys: [] };
    const numericKeys = [];
    const textKeys = [];
    for (const col of data.columns) {
        const sample = data.rows?.[0]?.[col.name];
        if (typeof sample === 'number' || (!isNaN(Number(sample)) && sample !== null && sample !== '')) {
            numericKeys.push(col.name);
        } else {
            textKeys.push(col.name);
        }
    }
    return { categoryKey: textKeys[0] || numericKeys[0], valueKeys: numericKeys.length ? numericKeys : [data.columns[0]?.name] };
}

function prepRows(data) {
    if (!data?.rows?.length) return [];
    const { valueKeys } = getDataKeys(data);
    return data.rows.map(r => {
        const row = { ...r };
        for (const k of valueKeys) { if (row[k] !== undefined) row[k] = Number(row[k]) || 0; }
        return row;
    });
}

const NoData = () => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>No data</div>;

// ── 1. Stat ──
export const StatViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const value = Object.values(data.rows[0])[0];
    const label = data.columns?.[0]?.name || 'Value';
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}>
            <span style={{ fontSize: 42, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{typeof value === 'number' ? value.toLocaleString() : String(value ?? '—')}</span>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>{label}</span>
        </div>
    );
};

// ── 2. Multi-Stat ──
export const MultiStatViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const row = data.rows[0];
    const entries = Object.entries(row);
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 12 }}>
            {entries.map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{typeof v === 'number' ? v.toLocaleString() : String(v ?? '—')}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>{k}</div>
                </div>
            ))}
        </div>
    );
};

// ── 3. Gauge ──
export const GaugeViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const value = Number(Object.values(data.rows[0])[0]) || 0;
    const label = data.columns?.[0]?.name || '';
    const max = Math.max(value * 1.2, 100);
    const pct = Math.min((value / max) * 100, 100);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <svg viewBox="0 0 120 80" style={{ width: '70%', maxWidth: 200 }}>
                <path d="M 10 70 A 50 50 0 0 1 110 70" fill="none" stroke="var(--border-default)" strokeWidth="10" strokeLinecap="round" />
                <path d="M 10 70 A 50 50 0 0 1 110 70" fill="none" stroke="#6366f1" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${pct * 1.57} 157`} />
                <text x="60" y="65" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text-primary)">{value.toLocaleString()}</text>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 4 }}>{label}</span>
        </div>
    );
};

// ── 4. Progress Bar ──
export const ProgressViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data);
    const { categoryKey, valueKeys } = getDataKeys(data);
    const vk = valueKeys[0];
    const maxVal = Math.max(...rows.map(r => r[vk] || 0), 1);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, height: '100%', overflow: 'auto' }}>
            {rows.slice(0, 20).map((r, i) => (
                <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{categoryKey ? r[categoryKey] : `Item ${i + 1}`}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{(r[vk] || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: COLORS[i % COLORS.length], width: `${((r[vk] || 0) / maxVal) * 100}%`, transition: 'width 0.5s ease' }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── 5. Sparkline ──
export const SparklineViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data);
    const { valueKeys } = getDataKeys(data);
    const vk = valueKeys[0];
    return (
        <div style={{ height: '100%', padding: '8px 4px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                    <Area type="monotone" dataKey={vk} stroke="#6366f1" strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

// ── 6. Data Table ──
export const TableViz = ({ data }) => {
    if (!data?.columns?.length) return <NoData />;
    return (
        <div style={{ height: '100%', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{data.columns.map((c, i) => (
                    <th key={i} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, position: 'sticky', top: 0, background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>{c.name}</th>
                ))}</tr></thead>
                <tbody>{data.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {data.columns.map((c, j) => (
                            <td key={j} style={{ padding: '6px 10px', color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row[c.name] != null ? String(row[c.name]) : '—'}</td>
                        ))}
                    </tr>
                ))}</tbody>
            </table>
        </div>
    );
};

// ── 7. List ──
export const ListViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const { categoryKey, valueKeys } = getDataKeys(data);
    const vk = valueKeys[0];
    return (
        <div style={{ height: '100%', overflow: 'auto', padding: 8 }}>
            {data.rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{categoryKey ? r[categoryKey] : `#${i + 1}`}</span>
                    <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 700 }}>{typeof r[vk] === 'number' ? r[vk].toLocaleString() : r[vk]}</span>
                </div>
            ))}
        </div>
    );
};

// ── Recharts wrappers ──
const ChartWrap = ({ children }) => (
    <div style={{ height: '100%', padding: '4px 0' }}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
);

const TT = (props) => <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} {...props} />;

// ── 8. Bar Chart ──
export const BarViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data);
    return <ChartWrap><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey={categoryKey} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><TT />{valueKeys.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}</BarChart></ChartWrap>;
};

// ── 9. Horizontal Bar ──
export const HBarViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data);
    return <ChartWrap><BarChart data={rows} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis dataKey={categoryKey} type="category" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={80} /><TT />{valueKeys.map((k, i) => <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />)}</BarChart></ChartWrap>;
};

// ── 10. Stacked Bar ──
export const StackedBarViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data);
    return <ChartWrap><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey={categoryKey} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><TT /><Legend />{valueKeys.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={COLORS[i % COLORS.length]} />)}</BarChart></ChartWrap>;
};

// ── 11. Line Chart ──
export const LineViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data);
    return <ChartWrap><LineChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey={categoryKey} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><TT />{valueKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />)}</LineChart></ChartWrap>;
};

// ── 12. Area Chart ──
export const AreaViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data);
    return <ChartWrap><AreaChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey={categoryKey} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><TT />{valueKeys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />)}</AreaChart></ChartWrap>;
};

// ── 13. Stacked Area ──
export const StackedAreaViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data);
    return <ChartWrap><AreaChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey={categoryKey} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><TT /><Legend />{valueKeys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />)}</AreaChart></ChartWrap>;
};

// ── 14. Pie Chart ──
export const PieViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data); const vk = valueKeys[0];
    return <ChartWrap><PieChart><Pie data={rows} dataKey={vk} nameKey={categoryKey} cx="50%" cy="50%" outerRadius="75%" label={{ fontSize: 11 }}>{rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><TT /></PieChart></ChartWrap>;
};

// ── 15. Donut ──
export const DonutViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data); const vk = valueKeys[0];
    return <ChartWrap><PieChart><Pie data={rows} dataKey={vk} nameKey={categoryKey} cx="50%" cy="50%" innerRadius="50%" outerRadius="75%" label={{ fontSize: 11 }}>{rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><TT /><Legend /></PieChart></ChartWrap>;
};

// ── 16. Scatter ──
export const ScatterViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { valueKeys } = getDataKeys(data);
    const xk = valueKeys[0]; const yk = valueKeys[1] || valueKeys[0];
    return <ChartWrap><ScatterChart><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey={xk} name={xk} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis dataKey={yk} name={yk} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><TT /><Scatter data={rows} fill="#6366f1" /></ScatterChart></ChartWrap>;
};

// ── 17. Radar ──
export const RadarViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data);
    return <ChartWrap><RadarChart data={rows} cx="50%" cy="50%" outerRadius="70%"><PolarGrid stroke="var(--border-subtle)" /><PolarAngleAxis dataKey={categoryKey} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} /><PolarRadiusAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />{valueKeys.map((k, i) => <Radar key={k} dataKey={k} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} />)}<TT /></RadarChart></ChartWrap>;
};

// ── 18. Treemap ──
export const TreemapViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data); const vk = valueKeys[0];
    const tmData = rows.map((r, i) => ({ name: categoryKey ? r[categoryKey] : `#${i}`, size: r[vk] || 0, fill: COLORS[i % COLORS.length] }));
    const renderContent = (props) => {
        const { x, y, width, height, name, fill } = props;
        if (width > 30 && height > 20) {
            return (<g><rect x={x} y={y} width={width} height={height} fill={fill} rx={4} /><text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={11} fontWeight={600}>{name}</text></g>);
        }
        return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
    };
    return <ChartWrap><Treemap data={tmData} dataKey="size" nameKey="name" aspectRatio={4 / 3} stroke="var(--bg-primary)" content={renderContent} /></ChartWrap>;
};

// ── 19. Funnel ──
export const FunnelViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data); const vk = valueKeys[0];
    const fData = rows.map((r, i) => ({ name: categoryKey ? r[categoryKey] : `Step ${i + 1}`, value: r[vk] || 0, fill: COLORS[i % COLORS.length] }));
    return <ChartWrap><FunnelChart><TT /><Funnel dataKey="value" nameKey="name" data={fData}><LabelList position="center" fill="#fff" fontSize={11} fontWeight={600} /></Funnel></FunnelChart></ChartWrap>;
};

// ── 20. Radial Bar ──
export const RadialBarViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data); const vk = valueKeys[0];
    const rbData = rows.slice(0, 6).map((r, i) => ({ name: categoryKey ? r[categoryKey] : `#${i}`, value: r[vk] || 0, fill: COLORS[i % COLORS.length] }));
    return <ChartWrap><RadialBarChart innerRadius="20%" outerRadius="90%" data={rbData} startAngle={180} endAngle={0}><RadialBar background dataKey="value" /><Legend layout="vertical" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} /><TT /></RadialBarChart></ChartWrap>;
};

// ── 21. Composed (Line + Bar) ──
export const ComposedViz = ({ data }) => {
    if (!data?.rows?.length) return <NoData />;
    const rows = prepRows(data); const { categoryKey, valueKeys } = getDataKeys(data);
    return <ChartWrap><ComposedChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" /><XAxis dataKey={categoryKey} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} /><TT />{valueKeys[0] && <Bar dataKey={valueKeys[0]} fill={COLORS[0]} radius={[4, 4, 0, 0]} opacity={0.7} />}{valueKeys[1] && <Line type="monotone" dataKey={valueKeys[1]} stroke={COLORS[1]} strokeWidth={2} />}</ComposedChart></ChartWrap>;
};

// ── Registry ──
export const VIZ_TYPES = [
    { id: 'stat', label: 'Stat', icon: '#', color: '#6366f1', category: 'Numbers' },
    { id: 'multi_stat', label: 'Multi-Stat', icon: '##', color: '#8b5cf6', category: 'Numbers' },
    { id: 'gauge', label: 'Gauge', icon: '◔', color: '#06b6d4', category: 'Numbers' },
    { id: 'progress', label: 'Progress', icon: '▬', color: '#14b8a6', category: 'Numbers' },
    { id: 'sparkline', label: 'Sparkline', icon: '~', color: '#22c55e', category: 'Numbers' },
    { id: 'bar', label: 'Bar', icon: '▮', color: '#3b82f6', category: 'Charts' },
    { id: 'hbar', label: 'H. Bar', icon: '▬', color: '#2563eb', category: 'Charts' },
    { id: 'stacked_bar', label: 'Stacked Bar', icon: '▮▮', color: '#7c3aed', category: 'Charts' },
    { id: 'line', label: 'Line', icon: '⌇', color: '#f97316', category: 'Charts' },
    { id: 'area', label: 'Area', icon: '▲', color: '#10b981', category: 'Charts' },
    { id: 'stacked_area', label: 'S. Area', icon: '▲▲', color: '#059669', category: 'Charts' },
    { id: 'composed', label: 'Composed', icon: '▮~', color: '#d946ef', category: 'Charts' },
    { id: 'pie', label: 'Pie', icon: '◕', color: '#ec4899', category: 'Circular' },
    { id: 'donut', label: 'Donut', icon: '◎', color: '#f43f5e', category: 'Circular' },
    { id: 'radial_bar', label: 'Radial', icon: '◐', color: '#e11d48', category: 'Circular' },
    { id: 'scatter', label: 'Scatter', icon: '⁘', color: '#eab308', category: 'Advanced' },
    { id: 'radar', label: 'Radar', icon: '⬡', color: '#84cc16', category: 'Advanced' },
    { id: 'treemap', label: 'Treemap', icon: '▦', color: '#0ea5e9', category: 'Advanced' },
    { id: 'funnel', label: 'Funnel', icon: '▽', color: '#a855f7', category: 'Advanced' },
    { id: 'table', label: 'Table', icon: '☰', color: '#64748b', category: 'List' },
    { id: 'list', label: 'List', icon: '≡', color: '#475569', category: 'List' },
];

export const VIZ_COMPONENTS = {
    stat: StatViz, multi_stat: MultiStatViz, gauge: GaugeViz, progress: ProgressViz, sparkline: SparklineViz,
    bar: BarViz, hbar: HBarViz, stacked_bar: StackedBarViz, line: LineViz, area: AreaViz,
    stacked_area: StackedAreaViz, composed: ComposedViz,
    pie: PieViz, donut: DonutViz, radial_bar: RadialBarViz,
    scatter: ScatterViz, radar: RadarViz, treemap: TreemapViz, funnel: FunnelViz,
    table: TableViz, list: ListViz,
};
