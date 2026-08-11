import { useQuery } from '@tanstack/react-query';
import { Database, Loader2, Table2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ChartDataPanel, { deriveChartMapping } from './ChartDataPanel';
import FilterRowsEditor, { NO_VALUE_OPS } from './FilterRowsEditor';
import useAppTables, { fieldsForTable } from './useAppTables';
import useDatasets from './useDatasets';
import { API_BASE, authFetch } from '../../../../../utils/helpers';
import Modal from '../../../../shared/Modal';
import toast from '../../../../shared/Toast';
import { inputCls, RepeatableList } from '../../../ProductWebsite/fields';
import { useEditorChrome } from '../editor/EditorChromeContext';
import AppChart from '../runtime/components/AppChart';
import { DEFAULT_RUNTIME, RuntimeProvider } from '../runtime/RuntimeContext';

/**
 * App Studio BI — the visual Query Builder.
 *
 * Pick a source table, group-by dimensions (with an optional date bucket),
 * measures (count/sum/avg/min/max) and filters; a debounced live preview POSTs
 * the built descriptor to /data/query (RLS-scoped, cache-aware server-side) and
 * renders it as a small table + a live AppChart. Save persists a named dataset
 * and returns its id (plus, for charts, the column→series mapping) to the
 * caller, which points props.source at { kind:'dataset', datasetId }.
 *
 * No SQL is ever produced here — only a structured aggregate descriptor
 * (filters/groupBy/aggregates) that server/appStudio/queryCompiler.js compiles.
 * Filters are structured {field, op, value} rows because that is exactly what
 * compileAggregate consumes (its closed FILTER_OPS vocabulary).
 */

export const AGGS = [
    { value: 'count', label: 'Count' },
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'min', label: 'Lowest' },
    { value: 'max', label: 'Highest' },
];

export const DATE_BUCKETS = [
    { value: '', label: 'Exact' },
    { value: 'day', label: 'By day' },
    { value: 'week', label: 'By week' },
    { value: 'month', label: 'By month' },
    { value: 'quarter', label: 'By quarter' },
    { value: 'year', label: 'By year' },
];

const DATE_TYPES = new Set(['date', 'datetime']);
const PREVIEW_ROWS = 8;

// A stable run-mode runtime so the preview AppChart draws real rows (not the
// edit-mode placeholder) without needing the editor's providers.
const PREVIEW_RUNTIME = { ...DEFAULT_RUNTIME, mode: 'run' };

function useDebounced(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/**
 * Read a number the way people type it here: this is a Dutch product, so
 * "1.234,56" and "1,5" mean 1234.56 and 1.5. Returns null when it is not a
 * number at all (the value then travels on as text, as before).
 */
export function parseUserNumber(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? input : null;
    let s = String(input ?? '').replace(/\s/g, '');
    if (!s) return null;
    const comma = s.lastIndexOf(',');
    const dot = s.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
        // The LAST separator is the decimal one; the other groups thousands.
        const thousands = comma > dot ? '.' : ',';
        s = s.split(thousands).join('');
        if (comma > dot) s = s.replace(',', '.');
    } else if (comma >= 0) {
        s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.split(',').join('') : s.replace(',', '.');
    }
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/** "Sum of Amount" — the row header for one measure, in plain words. */
function measureSentence(a, fieldName) {
    const verb = AGGS.find((x) => x.value === a.agg)?.label || 'Sum';
    if (a.agg === 'count' && !a.field) return 'Count of every row';
    return `${verb} of ${fieldName(a.field) || '…'}`;
}

/** Constrain a human label to the compiler's alias grammar (ALIAS_RE). */
function sanitizeAlias(label, fallback) {
    let s = String(label || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    if (!s || !/^[a-z]/.test(s)) s = fallback;
    return s;
}

/** Build the structured aggregate descriptor compileAggregate consumes. */
export function buildDescriptor(tableId, fields, groupBy, aggregates, filters) {
    const fieldType = (key) => (fields.find((f) => f.key === key) || {}).type;

    const gb = (groupBy || [])
        .filter((g) => g.field)
        .map((g) => (g.bucket && DATE_TYPES.has(fieldType(g.field)) ? { field: g.field, bucket: g.bucket } : { field: g.field }));

    const usedAliases = new Set();
    const aggs = (aggregates || [])
        .filter((a) => a.agg && (a.agg === 'count' || a.field))
        .map((a) => {
            const isCount = a.agg === 'count';
            let alias = sanitizeAlias(a.label, isCount ? 'count' : `${a.agg}_${a.field || 'x'}`);
            let n = 2;
            while (usedAliases.has(alias)) alias = `${alias.slice(0, 58)}_${n++}`;
            usedAliases.add(alias);
            return { fn: a.agg, ...(isCount && !a.field ? {} : { field: a.field }), as: alias };
        });

    const flt = (filters || [])
        .filter((f) => f.field && f.op)
        .map((f) => {
            const base = { field: f.field, op: f.op };
            if (NO_VALUE_OPS.has(f.op)) return base;
            let value = f.value;
            if (fieldType(f.field) === 'number' && typeof value !== 'boolean' && value !== '' && value != null) {
                const num = parseUserNumber(value);
                if (num != null) value = num;
            }
            return { ...base, value: value ?? '' };
        });

    // A row left pointing at a field the table doesn't have would compile to a
    // broken query server-side — name them so the user can repick, and block.
    const known = new Set(fields.map((f) => f.key));
    const referenced = [...gb, ...aggs, ...flt].map((x) => x.field).filter(Boolean);
    const unknownFields = [...new Set(referenced.filter((k) => !known.has(k)))];

    return {
        descriptor: { groupBy: gb, aggregates: aggs, filters: flt },
        unknownFields,
        valid: !!tableId && (gb.length > 0 || aggs.length > 0) && unknownFields.length === 0,
    };
}

async function runPreview(appId, payload) {
    const res = await authFetch(`${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/data/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: payload.tableId, aggregate: payload.descriptor }),
    });
    if (res.status === 404) return { rows: [] };
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) throw new Error(body?.error || `Preview failed (${res.status})`);
    return { rows: Array.isArray(body?.rows) ? body.rows : [] };
}

export default function QueryBuilder({ open, onClose, appId, componentType = 'chart', onSave, onOpenTables = null }) {
    const { tables, isLoading: tablesLoading } = useAppTables(open ? appId : null);
    const { saveDataset, saving } = useDatasets(appId);

    const [tableId, setTableId] = useState('');
    const [groupBy, setGroupBy] = useState([]);
    const [aggregates, setAggregates] = useState([]);
    const [filters, setFilters] = useState([]);
    const [name, setName] = useState('');
    const [chartMapping, setChartMapping] = useState(null);

    const fields = useMemo(() => fieldsForTable(tables, tableId), [tables, tableId]);
    const fieldName = useCallback((key) => (fields.find((f) => f.key === key) || {}).name || key || '', [fields]);
    const fieldType = useCallback((key) => (fields.find((f) => f.key === key) || {}).type, [fields]);

    // Auto-select the first table, and seed a Count measure so the preview and
    // descriptor are valid the moment a table is chosen.
    useEffect(() => {
        if (!open) return;
        if (!tableId && tables.length) setTableId(tables[0].id);
    }, [open, tables, tableId]);
    useEffect(() => {
        if (tableId && aggregates.length === 0 && groupBy.length === 0) {
            setAggregates([{ agg: 'count', field: '', label: 'Count' }]);
        }
    }, [tableId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { setChartMapping(null); }, [tableId]);

    // Another table means other columns — every row that named a field of the
    // old one is dropped, so nothing keeps pointing at a column that is gone.
    const changeTable = (nextId) => {
        if (nextId === tableId) return;
        setTableId(nextId);
        setGroupBy([]);
        setFilters([]);
        setAggregates([{ agg: 'count', field: '', label: 'Count' }]);
        setChartMapping(null);
    };

    const { descriptor, valid, unknownFields } = useMemo(
        () => buildDescriptor(tableId, fields, groupBy, aggregates, filters),
        [tableId, fields, groupBy, aggregates, filters],
    );

    // Debounced live preview: the key carries the exact payload, so the fetch
    // always matches the key. `enabled` is gated on the DEBOUNCED payload's
    // validity (not the live one) so a mid-debounce empty descriptor can never
    // fire a stale request.
    const previewKey = useMemo(() => JSON.stringify({ tableId, descriptor }), [tableId, descriptor]);
    const debouncedKey = useDebounced(previewKey, 350);
    const debouncedValid = useMemo(() => {
        try {
            const p = JSON.parse(debouncedKey);
            const gb = p?.descriptor?.groupBy;
            const ag = p?.descriptor?.aggregates;
            return !!p?.tableId && ((Array.isArray(gb) && gb.length > 0) || (Array.isArray(ag) && ag.length > 0));
        } catch { return false; }
    }, [debouncedKey]);
    const preview = useQuery({
        queryKey: ['studio-app-query-preview', appId, debouncedKey],
        queryFn: () => runPreview(appId, JSON.parse(debouncedKey)),
        enabled: !!open && !!appId && debouncedValid,
        retry: false,
        staleTime: 10_000,
    });

    const previewRows = useMemo(() => (Array.isArray(preview.data?.rows) ? preview.data.rows : []), [preview.data]);
    const previewColumns = useMemo(
        () => (previewRows[0] && typeof previewRows[0] === 'object' ? Object.keys(previewRows[0]) : []),
        [previewRows],
    );

    // Both ends of the mapping must still exist in the result — a series key
    // left over from an earlier query would otherwise be saved into the chart.
    const effectiveMapping = useMemo(() => {
        const seriesResolve = (chartMapping?.series || []).every((s) => previewColumns.includes(s.key));
        if (chartMapping && previewColumns.includes(chartMapping.xKey) && seriesResolve) return chartMapping;
        return deriveChartMapping(previewColumns, previewRows, chartMapping?.chartType || 'bar');
    }, [chartMapping, previewColumns, previewRows]);

    const previewChartNode = useMemo(() => ({
        id: 'qb_preview_chart',
        type: 'chart',
        props: {
            chartType: effectiveMapping.chartType,
            source: { kind: 'static', value: previewRows },
            xKey: effectiveMapping.xKey,
            series: effectiveMapping.series,
            showLegend: true,
            showGrid: true,
            valueFormat: 'number',
        },
        style: { height: 'md' },
    }), [effectiveMapping, previewRows]);

    const currentTable = tables.find((t) => t.id === tableId) || null;

    // The chart mapping is read off the preview columns, so it is only real
    // once the preview for THIS query has landed — saving mid-refetch would
    // hand the component an empty mapping.
    const previewPending = valid && (previewKey !== debouncedKey || preview.isFetching);

    const handleSave = useCallback(async () => {
        if (!valid || previewPending) return;
        try {
            const res = await saveDataset({
                name: name.trim() || (currentTable?.name ? `${currentTable.name} view` : 'View'),
                tableId,
                source: { kind: 'aggregate' },
                descriptor,
                cacheTtlSeconds: 60,
            });
            const dataset = res?.dataset;
            if (!dataset?.id) throw new Error('This view could not be saved.');
            const chart = componentType === 'chart' && effectiveMapping.xKey ? effectiveMapping : null;
            onSave?.({ datasetId: dataset.id, chart });
            toast.success('Saved.');
            onClose?.();
        } catch (err) {
            toast.error(err?.message || 'Could not save this view.');
        }
    }, [valid, previewPending, saveDataset, name, currentTable, tableId, descriptor, onSave, componentType, effectiveMapping, onClose]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="xl"
            title={componentType === 'chart' ? 'What should this chart show?' : 'What should this show?'}
            description="Pick a table, then choose what you want to see."
            footer={(
                <>
                    <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">Cancel</button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!valid || saving || previewPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white disabled:opacity-40"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {saving || previewPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Use this
                    </button>
                </>
            )}
        >
            {tablesLoading ? (
                <div className="flex items-center justify-center py-10 text-[var(--text-muted)]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : tables.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-muted)]">
                    <p className="mb-3">There are no tables in this app yet — a table is where its information lives.</p>
                    {onOpenTables ? (
                        <button
                            type="button"
                            onClick={() => { onClose?.(); onOpenTables(); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            <Table2 className="w-4 h-4" aria-hidden="true" /> Add a table
                        </button>
                    ) : (
                        <p>Add one with the Data button in the toolbar first.</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
                    {/* ── LEFT: query configuration ── */}
                    <div className="flex flex-col gap-4 min-w-0">
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-[var(--text-secondary)]">Which table?</span>
                            <select className={inputCls} value={tableId} onChange={(e) => changeTable(e.target.value)} aria-label="Which table">
                                {tables.map((t) => <option key={t.id} value={t.id}>{t.name || t.key}</option>)}
                            </select>
                        </label>

                        <fieldset className="min-w-0">
                            <RepeatableList
                                label="Break it down by"
                                items={groupBy}
                                onChange={setGroupBy}
                                makeNew={() => ({ field: '', bucket: '' })}
                                addLabel="Add a breakdown"
                                itemLabel={(g) => fieldName(g.field) || 'Pick a column'}
                                renderItem={(g, update) => (
                                    <div className="flex flex-col gap-2">
                                        <select className={inputCls} value={g.field || ''} onChange={(e) => update({ ...g, field: e.target.value, bucket: '' })} aria-label="Break down by">
                                            <option value="">Pick a column…</option>
                                            {fields.map((f) => <option key={f.key} value={f.key}>{f.name || f.key}</option>)}
                                        </select>
                                        {DATE_TYPES.has(fieldType(g.field)) ? (
                                            <select className={inputCls} value={g.bucket || ''} onChange={(e) => update({ ...g, bucket: e.target.value })} aria-label="Group dates">
                                                {DATE_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                                            </select>
                                        ) : null}
                                    </div>
                                )}
                            />
                        </fieldset>

                        <fieldset className="min-w-0">
                            <RepeatableList
                                label="What do you want to see?"
                                items={aggregates}
                                onChange={setAggregates}
                                makeNew={() => ({ agg: 'sum', field: '', label: '' })}
                                addLabel="Add a number"
                                itemLabel={(a) => a.label || measureSentence(a, fieldName)}
                                renderItem={(a, update) => (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <select
                                                className={inputCls}
                                                value={a.agg || 'sum'}
                                                onChange={(e) => update({ ...a, agg: e.target.value, ...(e.target.value === 'count' ? { field: '' } : {}) })}
                                                aria-label="What to work out"
                                            >
                                                {AGGS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                                            </select>
                                            <span className="shrink-0 text-xs text-[var(--text-secondary)]">of</span>
                                            <select className={inputCls} value={a.field || ''} onChange={(e) => update({ ...a, field: e.target.value })} aria-label="Which column" disabled={a.agg === 'count'}>
                                                <option value="">{a.agg === 'count' ? 'every row' : 'Pick a column…'}</option>
                                                {fields.map((f) => <option key={f.key} value={f.key}>{f.name || f.key}</option>)}
                                            </select>
                                        </div>
                                        <input type="text" className={inputCls} value={a.label || ''} onChange={(e) => update({ ...a, label: e.target.value })} placeholder="Call it something else (optional)" spellCheck={false} />
                                    </div>
                                )}
                            />
                        </fieldset>

                        <FilterRowsEditor fields={fields} filters={filters} onChange={setFilters} label="Only count rows where" />


                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-[var(--text-secondary)]">Name this view</span>
                            <input type="text" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={currentTable?.name ? `${currentTable.name} view` : 'View'} />
                        </label>
                    </div>

                    {/* ── RIGHT: live preview ── */}
                    <div className="flex flex-col gap-4 min-w-0">
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Preview</div>
                            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3 min-h-[120px]">
                                {unknownFields.length ? (
                                    <p className="text-xs" style={{ color: 'var(--role-danger, var(--text-muted))' }}>
                                        This table has no {unknownFields.map((k) => fieldName(k)).join(', ')} column any more. Pick another column above (or remove that row).
                                    </p>
                                ) : !valid ? (
                                    <p className="text-xs text-[var(--text-muted)]">Choose what you want to see to get a preview.</p>
                                ) : preview.isLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><Loader2 className="w-4 h-4 animate-spin" /> Running…</div>
                                ) : preview.isError ? (
                                    <p className="text-xs" style={{ color: 'var(--role-danger, var(--text-muted))' }}>{preview.error?.message || 'Preview failed.'}</p>
                                ) : previewRows.length === 0 ? (
                                    <p className="text-xs text-[var(--text-muted)]">No rows match this query.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr>
                                                    {previewColumns.map((c) => (
                                                        <th key={c} className="text-left font-medium text-[var(--text-secondary)] px-2 py-1 border-b border-[var(--border-subtle)]">{c}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewRows.slice(0, PREVIEW_ROWS).map((row, ri) => (
                                                    <tr key={ri}>
                                                        {previewColumns.map((c) => (
                                                            <td key={c} className="px-2 py-1 border-b border-[var(--border-subtle)] text-[var(--text-primary)] truncate max-w-[160px]">{formatCell(row[c])}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {previewRows.length > PREVIEW_ROWS ? (
                                            <p className="text-[11px] text-[var(--text-muted)] mt-1">+{previewRows.length - PREVIEW_ROWS} more rows</p>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>

                        {componentType === 'chart' && valid && previewRows.length > 0 ? (
                            <>
                                <div className="rounded-lg border border-[var(--border-subtle)] p-3 min-w-0" data-testid="qb-chart-preview">
                                    <RuntimeProvider value={PREVIEW_RUNTIME}>
                                        <AppChart node={previewChartNode} />
                                    </RuntimeProvider>
                                </div>
                                <ChartDataPanel columns={previewColumns} rows={previewRows} value={effectiveMapping} onChange={setChartMapping} />
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </Modal>
    );
}

function formatCell(v) {
    if (v == null) return '—';
    if (typeof v === 'number') return v.toLocaleString();
    return String(v);
}

/**
 * The inspector affordance: a "Configure data" button that opens the builder
 * and, on save, points the node's data binding at the new dataset (and, for a
 * chart, prefills chartType/xKey/series from the column mapping). `patch` is the
 * inspector's own updateNodeProps→onCommit committer, so a chart lands in ONE
 * history entry. appId comes from the editor-chrome context; the button renders
 * inert (disabled) outside the editor shell, where no appId is in scope — so the
 * per-type inspector smoke tests stay green. (Inspectors also pass node/
 * definition for symmetry; they're unused here and safely ignored.)
 */
export function ConfigureDataButton({ patch, componentType = 'chart', disabled = false }) {
    const chrome = useEditorChrome();
    const appId = chrome?.appId ?? null;
    const [open, setOpen] = useState(false);

    const handleSave = useCallback(({ datasetId, chart }) => {
        if (!datasetId) return;
        // Point the node's data binding at the saved dataset. `stat` has no
        // `source` prop (its binding is `value`) — writing `source` there would
        // trip validate.js's prop.unknown guard and make the app unsaveable — so
        // it targets `value` instead. Everyone else uses `source`.
        const bindingProp = componentType === 'stat' ? 'value' : 'source';
        const p = { [bindingProp]: { kind: 'dataset', datasetId } };
        if (componentType === 'chart' && chart) {
            if (chart.chartType) p.chartType = chart.chartType;
            if (chart.xKey) p.xKey = chart.xKey;
            if (Array.isArray(chart.series) && chart.series.length) {
                p.series = chart.series.map((s) => ({ key: s.key, label: s.label || s.key, ...(s.color ? { color: s.color } : {}) }));
            }
        }
        patch?.(p);
    }, [componentType, patch]);

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                disabled={disabled || !appId}
                onClick={() => setOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Database className="w-4 h-4" aria-hidden="true" /> Configure data
            </button>
            {!appId ? <p className="text-[11px] text-[var(--text-muted)]">Open the app to build a dataset.</p> : null}
            {open && appId ? (
                <QueryBuilder
                    open={open}
                    onClose={() => setOpen(false)}
                    appId={appId}
                    componentType={componentType}
                    onSave={handleSave}
                    onOpenTables={chrome?.openTables || null}
                />
            ) : null}
        </div>
    );
}
