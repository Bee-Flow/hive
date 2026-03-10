import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, ExternalLink, BarChart3, TrendingUp, PieChart as PieChartIcon, Table2, ArrowUpDown, Hash, DollarSign, Percent, Filter, X, ChevronDown, Euro } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

// ─── Formula Evaluator (for KPI values) ────────────────────────
function evaluateKpiFormula(formula, values) {
    if (!formula || !values || values.length < 2) return formula;
    if (!String(formula).startsWith('=')) return formula;

    const expr = String(formula).slice(1).toUpperCase();
    const headers = values[0];
    const rows = values.slice(1);

    // Helper: get numeric value from cell reference like B2
    const cellVal = (ref) => {
        const col = ref.charCodeAt(0) - 65;
        const row = parseInt(ref.slice(1)) - 2; // row 2 = data index 0
        const v = parseFloat(rows[row]?.[col]);
        return isNaN(v) ? 0 : v;
    };

    // Parse range functions: SUM(B2:B13), AVERAGE(C2:C7), etc.
    const rangeMatch = expr.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX)\(([A-Z])(\d+):([A-Z])(\d+)\)$/);
    if (rangeMatch) {
        const [, func, colLetter1, startRow, colLetter2, endRow] = rangeMatch;
        const colIdx = colLetter1.charCodeAt(0) - 65;
        const r1 = parseInt(startRow) - 2;
        const r2 = parseInt(endRow) - 2;

        const nums = [];
        for (let r = Math.max(0, r1); r <= Math.min(rows.length - 1, r2); r++) {
            const v = parseFloat(rows[r]?.[colIdx]);
            if (!isNaN(v)) nums.push(v);
        }

        if (nums.length === 0) return 0;

        switch (func) {
            case 'SUM': return nums.reduce((a, b) => a + b, 0);
            case 'AVERAGE': case 'AVG': return nums.reduce((a, b) => a + b, 0) / nums.length;
            case 'COUNT': return nums.length;
            case 'MIN': return Math.min(...nums);
            case 'MAX': return Math.max(...nums);
            default: return formula;
        }
    }

    // Simple arithmetic with cell references: =(B7-B2)/B2
    try {
        let evalExpr = expr.replace(/([A-Z]\d+)/gi, (ref) => cellVal(ref.toUpperCase()).toString());
        if (/^[\d+\-*/().\s]+$/.test(evalExpr)) {
            const result = Function('"use strict"; return (' + evalExpr + ')')();
            if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                return Math.round(result * 10000) / 10000;
            }
        }
    } catch { }

    return formula;
}

function formatKpiValue(value, format) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return String(value);

    switch (format) {
        case 'currency': return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
        case 'currency_eur': return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
        case 'percent':
            // If <= 1 and has decimal, treat as fraction → multiply by 100
            if (Math.abs(num) <= 1 && String(value).includes('.')) return `${(num * 100).toFixed(1)}%`;
            return `${num.toFixed(1)}%`;
        case 'number': default: return new Intl.NumberFormat('en-US').format(Math.round(num * 100) / 100);
    }
}

// ─── Filter Dropdown ───────────────────────────────────────────
function FilterDropdown({ label, options, selectedValues, onChange }) {
    const [open, setOpen] = useState(false);
    const activeCount = selectedValues.length;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    activeCount > 0
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]'
                }`}
            >
                <Filter className="w-3 h-3" />
                {label}
                {activeCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[9px] font-bold min-w-[16px] text-center">
                        {activeCount}
                    </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg shadow-xl min-w-[160px] max-h-[200px] overflow-y-auto custom-scrollbar">
                        {/* Select All / Clear */}
                        <div className="px-2 py-1.5 border-b border-[var(--border-subtle)] flex items-center gap-2">
                            <button
                                onClick={() => onChange([])}
                                className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                Clear
                            </button>
                            <span className="text-[var(--text-tertiary)]">·</span>
                            <button
                                onClick={() => onChange([...options])}
                                className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                All
                            </button>
                        </div>
                        {options.map((opt) => (
                            <label
                                key={opt}
                                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--bg-secondary)] cursor-pointer text-[11px] text-[var(--text-primary)]"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedValues.includes(opt)}
                                    onChange={(e) => {
                                        if (e.target.checked) onChange([...selectedValues, opt]);
                                        else onChange(selectedValues.filter(v => v !== opt));
                                    }}
                                    className="rounded border-[var(--border-subtle)] text-indigo-500 focus:ring-indigo-500 w-3.5 h-3.5"
                                />
                                <span className="truncate">{opt}</span>
                            </label>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── KPI Card ──────────────────────────────────────────────────
function KpiCard({ panel, values }) {
    const computed = evaluateKpiFormula(panel.value, values);
    const formatted = formatKpiValue(computed, panel.format);
    const color = panel.color || '#6366f1';

    const FormatIcon = panel.format === 'currency' ? DollarSign
        : panel.format === 'currency_eur' ? Euro
        : panel.format === 'percent' ? Percent
        : Hash;

    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 flex flex-col gap-1"
             style={{ borderLeft: `3px solid ${color}` }}>
            <div className="flex items-center gap-1.5">
                <FormatIcon className="w-3 h-3" style={{ color }} />
                <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{panel.title}</span>
            </div>
            <span className="text-xl font-bold text-[var(--text-primary)]">{formatted}</span>
        </div>
    );
}

// ─── Chart Panel ───────────────────────────────────────────────
function ChartPanel({ panel, values }) {
    if (!values || values.length < 2) return null;
    const headers = values[0];
    const rows = values.slice(1);

    const labelCol = panel.labelColumn ?? 0;
    const dataCols = panel.dataColumns || [];
    if (dataCols.length === 0) return null;

    const chartData = rows.map((row, ri) => {
        const entry = { name: String(row[labelCol] ?? `Row ${ri + 1}`) };
        dataCols.forEach(ci => {
            const val = parseFloat(row[ci]);
            entry[headers[ci] || `Col${ci}`] = isNaN(val) ? 0 : Math.round(val * 100) / 100;
        });
        return entry;
    });

    const pieData = chartData.map(d => ({
        name: d.name,
        value: d[headers[dataCols[0]] || `Col${dataCols[0]}`] || 0,
    }));

    const tooltipStyle = {
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        fontSize: '11px',
        padding: '6px 10px',
    };

    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] overflow-hidden">
            <div className="px-3 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)] flex items-center gap-1.5">
                {panel.type === 'bar' && <BarChart3 className="w-3 h-3 text-[var(--text-tertiary)]" />}
                {panel.type === 'line' && <TrendingUp className="w-3 h-3 text-[var(--text-tertiary)]" />}
                {panel.type === 'pie' && <PieChartIcon className="w-3 h-3 text-[var(--text-tertiary)]" />}
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">{panel.title}</span>
                <span className="ml-auto text-[9px] text-[var(--text-tertiary)]">{dataCols.length} series · {rows.length} pts</span>
            </div>
            <div className="p-2" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                    {panel.type === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                            <YAxis tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            {dataCols.map((ci, idx) => (
                                <Bar key={ci} dataKey={headers[ci] || `Col${ci}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                            ))}
                        </BarChart>
                    ) : panel.type === 'line' ? (
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                            <YAxis tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                            {dataCols.map((ci, idx) => (
                                <Line key={ci} type="monotone" dataKey={headers[ci] || `Col${ci}`} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                            ))}
                        </LineChart>
                    ) : (
                        <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} innerRadius={40} dataKey="value"
                                 label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                 labelLine={{ stroke: 'var(--text-tertiary)' }} fontSize={9}>
                                {pieData.map((_, i) => (
                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend wrapperStyle={{ fontSize: 9 }} />
                        </PieChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ─── Table Panel ───────────────────────────────────────────────
function TablePanel({ panel, values }) {
    const [sortCol, setSortCol] = useState(panel.sortBy ?? null);
    const [sortDir, setSortDir] = useState(panel.sortDir || 'desc');

    if (!values || values.length < 2) return null;
    const headers = values[0];
    const rows = values.slice(1);
    const cols = panel.columns || headers.map((_, i) => i);

    const sorted = useMemo(() => {
        let data = [...rows];
        if (sortCol !== null) {
            data.sort((a, b) => {
                const va = parseFloat(a[sortCol]);
                const vb = parseFloat(b[sortCol]);
                if (!isNaN(va) && !isNaN(vb)) return sortDir === 'asc' ? va - vb : vb - va;
                return sortDir === 'asc' ? String(a[sortCol] || '').localeCompare(String(b[sortCol] || '')) : String(b[sortCol] || '').localeCompare(String(a[sortCol] || ''));
            });
        }
        if (panel.limit) data = data.slice(0, panel.limit);
        return data;
    }, [rows, sortCol, sortDir, panel.limit]);

    const toggleSort = (ci) => {
        if (sortCol === ci) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(ci); setSortDir('desc'); }
    };

    return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] overflow-hidden">
            <div className="px-3 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)] flex items-center gap-1.5">
                <Table2 className="w-3 h-3 text-[var(--text-tertiary)]" />
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">{panel.title}</span>
                {panel.limit && <span className="ml-auto text-[9px] text-[var(--text-tertiary)]">Top {panel.limit}</span>}
            </div>
            <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="bg-[var(--bg-secondary)]">
                            {cols.map(ci => (
                                <th key={ci} className="px-2 py-1 text-left font-semibold text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-tertiary)] select-none whitespace-nowrap"
                                    onClick={() => toggleSort(ci)}>
                                    <span className="flex items-center gap-0.5">
                                        {headers[ci] || `Col${ci}`}
                                        <ArrowUpDown className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row, ri) => (
                            <tr key={ri} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]">
                                {cols.map(ci => {
                                    const v = row[ci];
                                    const isNum = !isNaN(parseFloat(v)) && v !== '' && v !== null;
                                    return (
                                        <td key={ci} className={`px-2 py-1 whitespace-nowrap ${isNum ? 'text-right font-mono' : ''}`}>
                                            {isNum ? new Intl.NumberFormat('en-US').format(parseFloat(v)) : v}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Main Report View with Interactive Filters ─────────────────
function SheetsReportItem({ report }) {
    const { values, reportConfig, url, truncated, totalRows } = report;
    const panels = reportConfig?.panels || [];
    const filterConfig = reportConfig?.filters || [];

    // Build filter state: { columnIndex: [selectedValues] }
    const [activeFilters, setActiveFilters] = useState({});

    // Auto-detect filterable columns: text columns with limited unique values
    const filterableColumns = useMemo(() => {
        if (!values || values.length < 2) return [];
        const headers = values[0];
        const rows = values.slice(1);

        // If AI specified filters, use those
        if (filterConfig.length > 0) {
            return filterConfig.map(f => {
                const colIdx = typeof f.column === 'number' ? f.column : headers.indexOf(f.column);
                if (colIdx < 0) return null;
                const uniqueVals = [...new Set(rows.map(r => String(r[colIdx] ?? '')).filter(Boolean))];
                return { colIdx, label: f.label || headers[colIdx], options: uniqueVals };
            }).filter(Boolean);
        }

        // Auto-detect: columns where all values are non-numeric text with ≤ 20 unique values
        const detected = [];
        for (let ci = 0; ci < headers.length; ci++) {
            const vals = rows.map(r => String(r[ci] ?? '')).filter(Boolean);
            const uniq = [...new Set(vals)];
            const allText = vals.every(v => isNaN(parseFloat(v)));
            if (allText && uniq.length >= 2 && uniq.length <= 20) {
                detected.push({ colIdx: ci, label: headers[ci], options: uniq });
            }
        }
        return detected;
    }, [values, filterConfig]);

    // Apply filters to get filtered values
    const filteredValues = useMemo(() => {
        if (!values || values.length < 2) return values;
        const headers = values[0];
        const rows = values.slice(1);

        const activeEntries = Object.entries(activeFilters).filter(([_, vals]) => vals.length > 0);
        if (activeEntries.length === 0) return values;

        const filtered = rows.filter(row => {
            return activeEntries.every(([colIdxStr, selectedVals]) => {
                const colIdx = parseInt(colIdxStr);
                return selectedVals.includes(String(row[colIdx] ?? ''));
            });
        });

        return [headers, ...filtered];
    }, [values, activeFilters]);

    const handleFilterChange = (colIdx, selectedValues) => {
        setActiveFilters(prev => ({ ...prev, [colIdx]: selectedValues }));
    };

    const clearAllFilters = () => setActiveFilters({});

    const hasActiveFilters = Object.values(activeFilters).some(v => v.length > 0);
    const filteredRowCount = filteredValues ? filteredValues.length - 1 : 0;
    const totalDataRows = values ? values.length - 1 : 0;

    // Separate panel types
    const kpis = panels.filter(p => p.type === 'kpi');
    const charts = panels.filter(p => ['bar', 'line', 'pie'].includes(p.type));
    const tables = panels.filter(p => p.type === 'table');

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-primary)] shadow-sm mt-2">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-b border-[var(--border-subtle)]">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold text-[var(--text-primary)]">{reportConfig?.title || 'Report'}</span>
                <span className="ml-auto text-[9px] text-[var(--text-tertiary)]">
                    {hasActiveFilters ? `${filteredRowCount} of ${totalDataRows} rows` : totalRows ? `${totalRows} rows` : ''}
                    {truncated ? ' (truncated)' : ''}
                </span>
                {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 text-[10px] text-indigo-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Open
                    </a>
                )}
            </div>

            {/* Filter Bar */}
            {filterableColumns.length > 0 && (
                <div className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 flex items-center gap-2 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <span className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mr-1">Filters</span>
                    {filterableColumns.map((fc) => (
                        <FilterDropdown
                            key={fc.colIdx}
                            label={fc.label}
                            options={fc.options}
                            selectedValues={activeFilters[fc.colIdx] || []}
                            onChange={(vals) => handleFilterChange(fc.colIdx, vals)}
                        />
                    ))}
                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                            <X className="w-3 h-3" /> Clear all
                        </button>
                    )}
                </div>
            )}

            {/* Dashboard panels — full width */}
            <div className="p-3 space-y-3">
                {/* KPI row */}
                {kpis.length > 0 && (
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, 1fr)` }}>
                        {kpis.map((panel, i) => (
                            <KpiCard key={i} panel={panel} values={filteredValues} />
                        ))}
                    </div>
                )}

                {/* Charts — grid layout for multiple charts */}
                {charts.length > 0 && (
                    <div className={charts.length > 1 ? 'grid gap-3 grid-cols-1 lg:grid-cols-2' : ''}>
                        {charts.map((panel, i) => (
                            <ChartPanel key={`chart-${i}`} panel={panel} values={filteredValues} />
                        ))}
                    </div>
                )}

                {/* Tables */}
                {tables.map((panel, i) => (
                    <TablePanel key={`table-${i}`} panel={panel} values={filteredValues} />
                ))}

                {panels.length === 0 && (
                    <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)] text-sm">
                        No panels configured
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Exported wrapper ──────────────────────────────────────────
export function SheetsReportCard({ msg }) {
    if (!msg.sheetsReports || msg.sheetsReports.length === 0) return null;
    return msg.sheetsReports.map((report, i) => (
        <SheetsReportItem key={i} report={report} />
    ));
}

export default SheetsReportCard;
