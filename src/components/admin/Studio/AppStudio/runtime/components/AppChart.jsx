import { useLayoutEffect, useMemo, useState } from 'react';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
    Pie, PieChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
    CHART_AXIS, CHART_GRID_STROKE, CHART_TOOLTIP_STYLE,
    PLACEHOLDER_DATA, PLACEHOLDER_SERIES_KEY, PLACEHOLDER_XKEY,
    makeValueFormatter, resolveSeriesColor,
} from '../chartPalette';
import { brandPalette } from '../appDesign';
import { resolveBinding } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { isFill } from '../styleResolver';
import { EmptyText, ErrorText, SkeletonLines, useStickyBinding } from '../uiBits';

/** App Studio runtime — 'chart'. Spec: server/appStudio/componentSpecs.js. */

const MAX_SERIES = 12;
const MAX_SCAN_ROWS = 200; // enough to type a column without walking a full page
const HEIGHT_MAP = { sm: 120, md: 200, lg: 320 };

/**
 * A column plots as a series when it holds at least one finite number and no
 * value that is plainly not one. Both halves matter: typing off the FIRST row
 * alone plots text columns as a flat zero line and drops any column that
 * happens to be null there. Exported for tests.
 */
export function deriveSeries(rows, xKey) {
    const sample = rows.filter((r) => r && typeof r === 'object').slice(0, MAX_SCAN_ROWS);
    const keys = [];
    const seen = new Set();
    for (const row of sample) {
        for (const key of Object.keys(row)) {
            if (key === xKey || seen.has(key)) continue;
            seen.add(key);
            keys.push(key);
        }
    }
    return keys
        .filter((key) => isNumericColumn(sample, key))
        .slice(0, MAX_SERIES)
        .map((key) => ({ key, label: key }));
}

function isNumericColumn(rows, key) {
    let numeric = false;
    for (const row of rows) {
        const value = row[key];
        if (value == null || value === '') continue; // a gap, not a verdict
        if (typeof value === 'object' || typeof value === 'boolean') return false;
        if (!Number.isFinite(Number(value))) return false;
        numeric = true;
    }
    return numeric;
}

/**
 * Measure the container width so we can hand recharts an explicit width — its
 * ResponsiveContainer renders nothing at a 0×0 measurement (jsdom/tests), so
 * we measure ourselves and fall back to a sane default before layout settles.
 * The measured div only exists once the chart itself renders (a bound chart
 * shows a skeleton first), so measuring is driven by a callback ref + an
 * observer rather than by mount.
 */
function useMeasuredBox() {
    const [el, setEl] = useState(null);
    const [box, setBox] = useState({ w: 0, h: 0 });
    useLayoutEffect(() => {
        if (!el) return undefined;
        const measure = () => setBox({ w: el.clientWidth || 0, h: el.clientHeight || 0 });
        measure();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure);
            return () => window.removeEventListener('resize', measure);
        }
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [el]);
    return [setEl, box.w > 0 ? box.w : 600, box.h];
}

export default function AppChart({ node }) {
    const { mode, actionState, dataState, scope, appDesign } = useRuntime();
    const props = node.props || {};
    const {
        chartType = 'bar', title = null, xKey = 'label', series = [],
        stacked = false, showLegend = true, showGrid = true, valueFormat = 'number',
    } = props;

    const { value: source, isLoading, error, errorCode } = useStickyBinding(
        resolveBinding(props.source, { actionState, dataState, scope }),
    );
    const [wrapRef, width, measuredHeight] = useMeasuredBox();

    const rows = useMemo(
        () => (Array.isArray(source) ? source : []).filter((r) => r && typeof r === 'object'),
        [source],
    );

    // Edit mode never shows a blank box: fall back to a built-in sample series.
    const usingPlaceholder = rows.length === 0 && mode === 'edit' && !isLoading;
    const data = usingPlaceholder ? PLACEHOLDER_DATA : rows;
    const effectiveXKey = usingPlaceholder ? PLACEHOLDER_XKEY : xKey;

    const activeSeries = useMemo(() => {
        if (usingPlaceholder) return [{ key: PLACEHOLDER_SERIES_KEY, label: 'Sample' }];
        const configured = (Array.isArray(series) ? series : []).filter((s) => s && s.key);
        return configured.length ? configured.slice(0, MAX_SERIES) : deriveSeries(data, effectiveXKey);
    }, [usingPlaceholder, series, data, effectiveXKey]);

    // Brand palette (design.chartPalette:'brand') derives from the app's
    // primary colour; anything else keeps the classic categorical set.
    const palette = useMemo(
        () => (appDesign?.chartPalette === 'brand' && appDesign.primary ? brandPalette(appDesign.primary) : null),
        [appDesign?.chartPalette, appDesign?.primary],
    );

    // Charts used to be frozen: every recharts animation was hard-disabled, so
    // data appeared with a snap. They animate in the RUN view when the design
    // allows it — the edit canvas stays still (stable screenshots and tests),
    // and 'none' / the OS reduced-motion setting always win.
    const animate = mode === 'run'
        && appDesign?.motion !== 'none'
        && !(typeof window !== 'undefined' && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (error) return <ErrorText error={error} errorCode={errorCode} />;

    if (isLoading) return <SkeletonLines lines={4} />;
    if (rows.length === 0 && !usingPlaceholder) {
        return <EmptyText text="No chart data yet." />;
    }

    // recharts is driven by explicit pixels here (not ResponsiveContainer), so
    // 'fill' has to become a measured number. It used to fall through
    // `HEIGHT_MAP[h] || HEIGHT_MAP.md` and silently render 200px — a chart asked
    // to fill a dashboard tile quietly ignored the request.
    const fill = isFill(node);
    const height = fill
        ? (measuredHeight > 0 ? measuredHeight : HEIGHT_MAP.md)
        : (HEIGHT_MAP[node.style?.height] || HEIGHT_MAP.md);
    const fmt = makeValueFormatter(valueFormat);
    const isPie = chartType === 'pie' || chartType === 'donut';

    const grid = showGrid && !isPie
        ? <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
        : null;
    const tooltip = <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => fmt(v)} />;
    const legend = showLegend ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null;

    let chart = null;
    if (isPie) {
        const valueKey = activeSeries[0]?.key;
        const outer = Math.max(40, Math.min(width, height) / 2 - 28);
        const inner = chartType === 'donut' ? Math.max(24, outer * 0.58) : 0;
        chart = (
            <PieChart width={width} height={height}>
                {tooltip}
                {legend}
                <Pie
                    data={data}
                    dataKey={valueKey}
                    nameKey={effectiveXKey}
                    cx="50%"
                    cy="50%"
                    outerRadius={outer}
                    innerRadius={inner}
                    isAnimationActive={animate}
                >
                    {data.map((_, i) => (
                        <Cell key={i} fill={resolveSeriesColor(activeSeries[0]?.color, i, palette)} />
                    ))}
                </Pie>
            </PieChart>
        );
    } else if (chartType === 'line') {
        chart = (
            <LineChart width={width} height={height} data={data}>
                <XAxis dataKey={effectiveXKey} {...CHART_AXIS} />
                <YAxis tickFormatter={fmt} {...CHART_AXIS} />
                {grid}{tooltip}{legend}
                {activeSeries.map((s, i) => (
                    <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.label || s.key}
                        stroke={resolveSeriesColor(s.color, i, palette)}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={animate}
                    />
                ))}
            </LineChart>
        );
    } else if (chartType === 'area') {
        chart = (
            <AreaChart width={width} height={height} data={data}>
                <XAxis dataKey={effectiveXKey} {...CHART_AXIS} />
                <YAxis tickFormatter={fmt} {...CHART_AXIS} />
                {grid}{tooltip}{legend}
                {activeSeries.map((s, i) => {
                    const color = resolveSeriesColor(s.color, i, palette);
                    return (
                        <Area
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.label || s.key}
                            stackId={stacked ? 'stack' : undefined}
                            stroke={color}
                            fill={color}
                            fillOpacity={0.2}
                            strokeWidth={2}
                            isAnimationActive={animate}
                        />
                    );
                })}
            </AreaChart>
        );
    } else {
        chart = (
            <BarChart width={width} height={height} data={data}>
                <XAxis dataKey={effectiveXKey} {...CHART_AXIS} />
                <YAxis tickFormatter={fmt} {...CHART_AXIS} />
                {grid}{tooltip}{legend}
                {activeSeries.map((s, i) => (
                    <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label || s.key}
                        stackId={stacked ? 'stack' : undefined}
                        fill={resolveSeriesColor(s.color, i, palette)}
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={animate}
                    />
                ))}
            </BarChart>
        );
    }

    return (
        <div
            className={`w-full min-w-0${fill ? ' app-fill flex flex-col h-full min-h-0' : ''}`}
            data-app-chart={chartType}
        >
            {title ? (
                <div className={`text-sm font-semibold mb-2${fill ? ' shrink-0' : ''}`} style={{ color: 'var(--text-primary)' }}>{title}</div>
            ) : null}
            <div
                ref={wrapRef}
                className={`w-full overflow-hidden${fill ? ' flex-1 min-h-0' : ''}`}
                style={fill ? undefined : { height }}
            >
                {chart}
            </div>
        </div>
    );
}
