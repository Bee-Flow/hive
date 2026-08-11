import React from 'react';
import FormField from '../../../../shared/FormField';
import SegmentedControl from '../../../../shared/SegmentedControl';
import { inputCls } from '../../../ProductWebsite/fields';
import { CHART_COLORS, chartColorAt } from '../runtime/chartPalette';

/**
 * App Studio BI — maps a query RESULT (columns + rows) onto a chart binding:
 * chartType + xKey + series[]. Mirrors the notebook ChartConfigModal idiom
 * (pick the label column, toggle the value columns) but the series palette is
 * restricted to chartPalette.CHART_COLORS — there is NO purple/violet/indigo
 * anywhere in this file (enforced by AppStudio.noPurple.test).
 */

const CHART_TYPES = [
    { value: 'bar', label: 'Bar' },
    { value: 'line', label: 'Line' },
    { value: 'area', label: 'Area' },
    { value: 'pie', label: 'Pie' },
    { value: 'donut', label: 'Donut' },
];

function isPieType(chartType) {
    return chartType === 'pie' || chartType === 'donut';
}

/** A column looks numeric if its first non-null value coerces to a finite number. */
function isNumericColumn(rows, key) {
    const sample = (Array.isArray(rows) ? rows : []).find((r) => r && r[key] != null);
    if (!sample) return true; // no data yet → assume plottable
    return Number.isFinite(Number(sample[key]));
}

/**
 * Auto-derive a mapping from the result shape: the FIRST column is the x-axis /
 * name key; the remaining numeric columns become series, each coloured from the
 * palette by index. A pie/donut keeps a single value series.
 */
export function deriveChartMapping(columns, rows = [], chartType = 'bar') {
    const cols = (Array.isArray(columns) ? columns : []).filter((c) => typeof c === 'string' && c);
    if (cols.length === 0) return { chartType, xKey: '', series: [] };
    const xKey = cols[0];
    const rest = cols.slice(1);
    const numeric = rest.filter((c) => isNumericColumn(rows, c));
    const chosen = numeric.length ? numeric : rest;
    const pick = isPieType(chartType) ? chosen.slice(0, 1) : chosen;
    const series = pick.map((key, i) => ({ key, label: key, color: chartColorAt(i) }));
    return { chartType, xKey, series };
}

export default function ChartDataPanel({ columns = [], rows = [], value, onChange, disabled = false }) {
    const mapping = value || deriveChartMapping(columns, rows);
    const cols = (Array.isArray(columns) ? columns : []).filter((c) => typeof c === 'string' && c);
    const isPie = isPieType(mapping.chartType);
    const seriesKeys = new Set((mapping.series || []).map((s) => s.key));

    const set = (patch) => onChange?.({ ...mapping, ...patch });

    const setChartType = (chartType) => {
        let series = mapping.series || [];
        if (isPieType(chartType) && series.length > 1) series = series.slice(0, 1);
        set({ chartType, series });
    };

    const setXKey = (xKey) => {
        // The x column can't also be a series.
        const series = (mapping.series || []).filter((s) => s.key !== xKey);
        set({ xKey, series });
    };

    const toggleSeries = (key) => {
        if (key === mapping.xKey) return;
        let series;
        if (isPie) {
            series = [{ key, label: key, color: chartColorAt(0) }];
        } else if (seriesKeys.has(key)) {
            series = (mapping.series || []).filter((s) => s.key !== key);
        } else {
            series = [...(mapping.series || []), { key, label: key, color: chartColorAt((mapping.series || []).length) }];
        }
        set({ series });
    };

    const setSeriesColor = (key, color) => {
        const series = (mapping.series || []).map((s) => (s.key === key ? { ...s, color } : s));
        set({ series });
    };

    return (
        <fieldset disabled={disabled} className="flex flex-col gap-3 min-w-0">
            <FormField label="Chart type">
                <SegmentedControl
                    value={mapping.chartType || 'bar'}
                    onChange={setChartType}
                    options={CHART_TYPES}
                    size="sm"
                    fullWidth
                    ariaLabel="Chart type"
                />
            </FormField>

            <FormField label={isPie ? 'Name column' : 'X-axis column'}>
                <select className={inputCls} value={mapping.xKey || ''} onChange={(e) => setXKey(e.target.value)} aria-label="X-axis column">
                    <option value="">Pick a column…</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
            </FormField>

            <div>
                <div className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">{isPie ? 'Value column' : 'Series columns'}</div>
                <div className="flex flex-wrap gap-1.5">
                    {cols.filter((c) => c !== mapping.xKey).map((c) => {
                        const on = seriesKeys.has(c);
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => toggleSeries(c)}
                                aria-pressed={on}
                                className="px-2.5 py-1 rounded-full border text-[11px] transition-colors"
                                style={on
                                    ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'var(--bg-tertiary)' }
                                    : { borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                            >
                                {c}
                            </button>
                        );
                    })}
                    {cols.filter((c) => c !== mapping.xKey).length === 0 ? (
                        <span className="text-[11px] text-[var(--text-muted)]">Run a query to pick series.</span>
                    ) : null}
                </div>
            </div>

            {(mapping.series || []).length ? (
                <div className="flex flex-col gap-2">
                    {(mapping.series || []).map((s) => (
                        <div key={s.key} className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-[var(--text-secondary)] truncate flex-1 min-w-0">{s.label || s.key}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                                {CHART_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        aria-label={`Colour ${c} for ${s.key}`}
                                        onClick={() => setSeriesColor(s.key, c)}
                                        className="w-4 h-4 rounded-full border"
                                        style={{ background: c, borderColor: s.color === c ? 'var(--text-primary)' : 'transparent', outline: s.color === c ? '2px solid var(--text-primary)' : 'none' }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </fieldset>
    );
}
