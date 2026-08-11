import { Calculator, Database, Pencil, Play, Plug, Sigma, Table2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { INPUT_CLS } from './kit';
import FilterRowsEditor from '../../bi/FilterRowsEditor';
import QueryBuilder, { AGGS, DATE_BUCKETS } from '../../bi/QueryBuilder';
import useAppTables, { fieldsForTable } from '../../bi/useAppTables';
import useConnectors from '../../bi/useConnectors';
import useDatasets from '../../bi/useDatasets';
import { useEditorChrome } from '../../editor/EditorChromeContext';
import FormulaField from '../logic/FormulaField';
import FormField from '../../../../../shared/FormField';

/**
 * BindingField — editor for a `binding` prop value (server contract in
 * server/appStudio/componentSpecs.js, authoritative). All six binding kinds:
 *
 *   { kind: 'static', value }                              — a literal
 *   { kind: 'formula', expr }                              — a derived value
 *   { kind: 'record',  tableId, filter?, sort?, limit? }   — first matching row
 *   { kind: 'records', tableId, filter?, sort?, limit? }   — matching rows
 *   { kind: 'dataset', datasetId, pick? }                  — a saved query
 *   { kind: 'connector', connectorId, params? }            — external source
 *   { kind: 'actionResult', actionId, path }               — a routine result
 *
 * Nothing chosen yet (no binding, or the untouched `[]`/empty literal the
 * catalog defaults to) opens on the CHOOSER — one card per everyday way to
 * give a component data — instead of a hand-typed literal. Once a source is
 * set the field states it as a sentence with a Change link, and the picker for
 * that kind sits underneath. Typing the values by hand is the fourth card, and
 * formula/connector are one click deeper behind "Something else" — every kind
 * stays reachable.
 *
 * record/records/dataset/connector need the app's data model, so the pickers
 * load from the editor-chrome appId; outside the editor shell (per-type
 * inspector smoke tests) those modes degrade to a friendly "open the app" note.
 * filter values may be a literal or {kind:'formula',expr} (resolved client-side
 * before fetch — see runtime/resolveBinding.resolveBindingFilters); a connector
 * param is likewise a literal or {kind:'formula',expr} (resolveBindingParams).
 */

// The four everyday sources, in the order they are offered.
const SOURCE_CHOICES = [
    { kind: 'records', icon: Table2, title: 'A table in this app', blurb: 'Rows straight out of one of this app’s tables.' },
    { kind: 'dataset', icon: Database, title: 'A saved view', blurb: 'A question you saved earlier — or build a new one here.' },
    { kind: 'actionResult', icon: Play, title: 'The result of a routine', blurb: 'Whatever a routine hands back when it finishes.' },
    { kind: 'static', icon: Pencil, title: 'Type the values myself', blurb: 'Write the values in by hand.' },
];

// Two rarer sources, one click deeper.
const MORE_SOURCE_CHOICES = [
    { kind: 'aggregate', icon: Sigma, title: 'A count or total', blurb: 'How many, or the total — optionally split by a column.' },
    { kind: 'formula', icon: Calculator, title: 'Worked out on the page', blurb: 'Built from other things on the screen, like who is signed in.' },
    { kind: 'connector', icon: Plug, title: 'Another system', blurb: 'Rows fetched from a system outside this app.' },
];

const SORT_DIRS = [
    { value: 'asc', label: 'Ascending' },
    { value: 'desc', label: 'Descending' },
];

const KINDS = [...SOURCE_CHOICES, ...MORE_SOURCE_CHOICES].map((c) => c.kind);

function modeOf(binding) {
    const kind = binding?.kind;
    // record + records share one card (a "Single row" toggle picks between them).
    if (kind === 'record') return 'records';
    if (KINDS.includes(kind)) return kind;
    return 'static';
}

/** Nothing chosen yet: no binding at all, or the untouched default literal. */
function isUnset(binding) {
    if (!binding || binding.kind !== 'static') return false;
    const v = binding.value;
    if (v == null || v === '') return true;
    return Array.isArray(v) && v.length === 0;
}

/** The empty binding each card drops the user into. */
function skeletonFor(kind, runActions) {
    switch (kind) {
        case 'static': return { kind: 'static', value: null };
        case 'formula': return { kind: 'formula', expr: '' };
        case 'records': return { kind: 'records', tableId: '' };
        // Starts as a plain row count — the most common thing anyone wants, and
        // valid on its own so the tile renders something immediately.
        case 'aggregate': return { kind: 'aggregate', tableId: '', aggregates: [{ fn: 'count', as: 'count' }] };
        case 'dataset': return { kind: 'dataset', datasetId: null };
        case 'connector': return { kind: 'connector', connectorId: null, params: {} };
        case 'actionResult': return { kind: 'actionResult', actionId: runActions[0]?.[0] || null, path: '' };
        default: return null;
    }
}

function staticDisplay(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch { return String(value); }
}

function parseStatic(raw) {
    const trimmed = raw.trim();
    if (trimmed === '') return raw;
    if (/^[[{"]|^-?\d+(\.\d+)?$|^(true|false|null)$/.test(trimmed)) {
        try { return JSON.parse(trimmed); } catch { /* keep raw */ }
    }
    return raw;
}

function normSort(sort) {
    if (Array.isArray(sort)) return sort[0] || null;
    if (sort && typeof sort === 'object') return sort;
    return null;
}

// ── the chooser ──────────────────────────────────────────────────────────────

function SourceCard({ choice, onPick, disabled }) {
    const Icon = choice.icon;
    return (
        <button
            type="button"
            onClick={() => onPick(choice.kind)}
            disabled={disabled}
            className="flex items-start gap-2.5 text-left px-3 py-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
            <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--text-primary)]">{choice.title}</span>
                <span className="block text-xs text-[var(--text-secondary)]">{choice.blurb}</span>
            </span>
        </button>
    );
}

function SourceChooser({ onPick, onCancel, disabled }) {
    const [showMore, setShowMore] = useState(false);
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--text-secondary)]">
                {onCancel ? 'Where should this come from?' : 'No data yet — choose where this comes from.'}
            </p>
            <div className="flex flex-col gap-1.5">
                {SOURCE_CHOICES.map((c) => <SourceCard key={c.kind} choice={c} onPick={onPick} disabled={disabled} />)}
                {showMore ? MORE_SOURCE_CHOICES.map((c) => <SourceCard key={c.kind} choice={c} onPick={onPick} disabled={disabled} />) : null}
            </div>
            <div className="flex items-center gap-3">
                {!showMore ? (
                    <button type="button" onClick={() => setShowMore(true)} className="text-xs text-[var(--text-secondary)] hover:underline">
                        Something else…
                    </button>
                ) : null}
                {onCancel ? (
                    <button type="button" onClick={onCancel} className="text-xs text-[var(--text-secondary)] hover:underline">
                        Keep what’s there
                    </button>
                ) : null}
            </div>
        </div>
    );
}

// ── the "this is what it shows" sentence ─────────────────────────────────────

// Names live in the app's data model, so each lookup is its own component —
// the hook only mounts for the kind that needs it.
function TableName({ appId, tableId }) {
    const { tables } = useAppTables(appId);
    const t = tables.find((x) => x && (x.id === tableId || x.key === tableId));
    return <>{t?.name || t?.key || tableId}</>;
}

function DatasetName({ appId, datasetId }) {
    const { datasets } = useDatasets(appId);
    const d = datasets.find((x) => x && x.id === datasetId);
    return <>{d?.name || datasetId}</>;
}

function ConnectorName({ appId, connectorId }) {
    const { connectors } = useConnectors(appId);
    const c = connectors.find((x) => x && x.id === connectorId);
    return <>{c?.name || connectorId}</>;
}

function Named({ appId, kind, id }) {
    if (!appId) return <span className="font-medium">{id}</span>;
    const inner = kind === 'table' ? <TableName appId={appId} tableId={id} />
        : kind === 'dataset' ? <DatasetName appId={appId} datasetId={id} />
            : <ConnectorName appId={appId} connectorId={id} />;
    return <span className="font-medium">“{inner}”</span>;
}

function SourceSentence({ binding, appId }) {
    const kind = binding.kind;
    if (kind === 'record' || kind === 'records') {
        if (!binding.tableId) return <>Rows from a table — pick which one below.</>;
        const name = <Named appId={appId} kind="table" id={binding.tableId} />;
        return kind === 'record'
            ? <>Showing: the first row of {name}.</>
            : <>Showing: rows from {name}.</>;
    }
    if (kind === 'dataset') {
        if (!binding.datasetId) return <>A saved view — pick which one below.</>;
        return <>Showing: the saved view <Named appId={appId} kind="dataset" id={binding.datasetId} />.</>;
    }
    if (kind === 'connector') {
        if (!binding.connectorId) return <>Another system — pick which one below.</>;
        return <>Showing: rows from <Named appId={appId} kind="connector" id={binding.connectorId} />.</>;
    }
    if (kind === 'actionResult') {
        if (!binding.actionId) return <>The result of a routine — pick which one below.</>;
        return <>Showing: what a routine sends back.</>;
    }
    if (kind === 'aggregate') {
        if (!binding.tableId) return <>A count or total — pick the table below.</>;
        const name = <Named appId={appId} kind="table" id={binding.tableId} />;
        const what = (binding.aggregates || []).map((a) => a?.fn).filter(Boolean).join(' + ') || 'count';
        const by = (binding.groupBy || []).map((g) => g?.field).filter(Boolean);
        return <>Showing: the {what} of {name}{by.length ? <>, per {by.join(' and ')}</> : null}.</>;
    }
    if (kind === 'formula') return <>Showing: a value worked out on the page.</>;
    return <>Showing: values typed in here.</>;
}

function SourceSummary({ binding, appId, onChangeClick, disabled }) {
    return (
        <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-sm text-[var(--text-primary)]">
                <SourceSentence binding={binding} appId={appId} />
            </p>
            <button
                type="button"
                onClick={onChangeClick}
                disabled={disabled}
                className="shrink-0 text-xs font-medium text-[var(--accent-primary)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Change
            </button>
        </div>
    );
}


/**
 * A count or a total, optionally split by a column.
 *
 * The "A count or total" card committed an `aggregate` binding and then nothing
 * rendered — no editor, and a summary sentence that called it "values typed in
 * here". So picking it was a dead end you could not even see you were in.
 *
 * The vocabulary (which functions, which date buckets) comes from QueryBuilder,
 * which already speaks it, rather than a second list that drifts.
 */
function AggregateBinding({ binding, onChange, appId, disabled, definition, node, singleValue = false }) {
    const { tables, isLoading } = useAppTables(appId);
    const tableId = binding.tableId || '';
    const fields = fieldsForTable(tables, tableId);
    const aggregates = Array.isArray(binding.aggregates) && binding.aggregates.length
        ? binding.aggregates
        : [{ fn: 'count', as: 'count' }];
    const groupBy = Array.isArray(binding.groupBy) ? binding.groupBy : [];

    const patch = (delta) => onChange({ ...binding, ...delta });

    // The column names this answer table carries — same aliasing the query
    // compiler applies, and the same list datasetColumns builds for a saved view.
    const columns = [
        ...aggregates.map((a) => a?.as || (a?.fn ? `${a.fn}_${a.field || 'all'}` : null)),
        ...groupBy.map((g) => g?.as || (g?.bucket ? `${g.field}_${g.bucket}` : g?.field)),
    ].filter((c) => typeof c === 'string' && c);

    // Not split by anything → the answer IS one number, and asking which column
    // it is would be busywork. Split, and the choice is real, so the field below
    // asks. Guarded on the binding object like DatasetBinding's: a fill the
    // parent drops must not retry every render.
    const autoPicked = useRef(null);
    useEffect(() => {
        if (!singleValue || disabled) return;
        if (!tableId || binding.pick || groupBy.length || !columns.length) return;
        if (autoPicked.current === binding) return;
        autoPicked.current = binding;
        onChange({ ...binding, pick: { row: 'first', column: columns[0] } });
    });

    if (!appId) {
        return <p className="text-xs text-[var(--text-secondary)]">Open the app to pick a table.</p>;
    }
    if (isLoading) {
        return <p className="text-xs text-[var(--text-secondary)]">Loading the tables…</p>;
    }

    return (
        <div className="flex flex-col gap-2">
            <select
                className={INPUT_CLS}
                value={tableId}
                onChange={(e) => patch({ tableId: e.target.value })}
                disabled={disabled}
                aria-label="Table to count"
            >
                <option value="">Pick a table…</option>
                {tables.map((t) => <option key={t.id} value={t.id}>{t.name || t.key}</option>)}
            </select>

            {tableId ? (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            className={INPUT_CLS}
                            value={aggregates[0]?.fn || 'count'}
                            onChange={(e) => {
                                const fn = e.target.value;
                                const field = fn === 'count' ? undefined : (aggregates[0]?.field || fields[0]?.key);
                                patch({ aggregates: [{ fn, ...(field ? { field } : {}), as: fn }] });
                            }}
                            disabled={disabled}
                            aria-label="What to work out"
                        >
                            {AGGS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>

                        {/* `count` counts rows; everything else needs a column. */}
                        {aggregates[0]?.fn && aggregates[0].fn !== 'count' ? (
                            <select
                                className={INPUT_CLS}
                                value={aggregates[0]?.field || ''}
                                onChange={(e) => patch({ aggregates: [{ ...aggregates[0], field: e.target.value }] })}
                                disabled={disabled}
                                aria-label="Which column"
                            >
                                <option value="">Pick a column…</option>
                                {fields.map((f) => <option key={f.key} value={f.key}>{f.name || f.key}</option>)}
                            </select>
                        ) : <span />}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <select
                            className={INPUT_CLS}
                            value={groupBy[0]?.field || ''}
                            onChange={(e) => {
                                const field = e.target.value;
                                patch({ groupBy: field ? [{ field, ...(groupBy[0]?.bucket ? { bucket: groupBy[0].bucket } : {}) }] : undefined });
                            }}
                            disabled={disabled}
                            aria-label="Split by"
                        >
                            <option value="">One number for everything</option>
                            {fields.map((f) => <option key={f.key} value={f.key}>Per {f.name || f.key}</option>)}
                        </select>

                        {/* A date column split "per day" rather than per exact
                            timestamp is the only useful reading of it. */}
                        {groupBy[0]?.field && ['date', 'datetime'].includes(fields.find((f) => f.key === groupBy[0].field)?.type) ? (
                            <select
                                className={INPUT_CLS}
                                value={groupBy[0]?.bucket || ''}
                                onChange={(e) => patch({ groupBy: [{ ...groupBy[0], ...(e.target.value ? { bucket: e.target.value } : {}) }] })}
                                disabled={disabled}
                                aria-label="Group dates"
                            >
                                {DATE_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                            </select>
                        ) : <span />}
                    </div>

                    <FilterRowsEditor
                        fields={fields}
                        filters={Array.isArray(binding.filter) ? binding.filter : []}
                        onChange={(filter) => patch({ filter: filter.length ? filter : undefined })}
                        allowFormula
                        disabled={disabled}
                        definition={definition}
                        node={node}
                    />

                    {singleValue && groupBy.length ? (
                        <PickValueField
                            pick={binding.pick}
                            columns={columns}
                            onChange={(pick) => patch({ pick })}
                            disabled={disabled}
                        />
                    ) : null}
                </>
            ) : null}
        </div>
    );
}

// ── record/records editor ────────────────────────────────────────────────────

function TableBinding({ binding, onChange, appId, disabled, definition, node, singleValue = false }) {
    const { tables, isLoading } = useAppTables(appId);
    const isSingle = binding.kind === 'record';
    const tableId = binding.tableId || '';
    const fields = fieldsForTable(tables, tableId);
    const sort = normSort(binding.sort);

    if (!appId) {
        return <p className="text-xs text-[var(--text-secondary)]">Open the app to use one of its tables.</p>;
    }
    if (isLoading) {
        return <p className="text-xs text-[var(--text-secondary)]">Loading tables…</p>;
    }
    if (!tables.length) {
        return <p className="text-xs text-[var(--text-secondary)]">This app has no data tables yet. Add one in the data model first.</p>;
    }

    const patch = (p) => onChange({ ...binding, ...p });

    return (
        <div className="flex flex-col gap-2">
            <select
                className={INPUT_CLS}
                value={tableId}
                onChange={(e) => patch({ tableId: e.target.value })}
                disabled={disabled}
                aria-label="Source table"
            >
                <option value="">Pick a table…</option>
                {tables.map((t) => <option key={t.id} value={t.id}>{t.name || t.key}</option>)}
            </select>

            {tableId ? (
                <>
                    <FilterRowsEditor
                        fields={fields}
                        filters={Array.isArray(binding.filter) ? binding.filter : []}
                        onChange={(filter) => patch({ filter: filter.length ? filter : undefined })}
                        allowFormula
                        disabled={disabled}
                        definition={definition}
                        node={node}
                    />

                    <div className="grid grid-cols-2 gap-2">
                        <select
                            className={INPUT_CLS}
                            value={sort?.field || ''}
                            onChange={(e) => patch({ sort: e.target.value ? [{ field: e.target.value, dir: sort?.dir || 'asc' }] : undefined })}
                            disabled={disabled}
                            aria-label="Sort field"
                        >
                            <option value="">No sort</option>
                            {fields.map((f) => <option key={f.key} value={f.key}>{f.name || f.key}</option>)}
                        </select>
                        <select
                            className={INPUT_CLS}
                            value={sort?.dir || 'asc'}
                            onChange={(e) => patch({ sort: sort?.field ? [{ field: sort.field, dir: e.target.value }] : undefined })}
                            disabled={disabled || !sort?.field}
                            aria-label="Sort direction"
                        >
                            {SORT_DIRS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                            <input
                                type="checkbox"
                                checked={isSingle}
                                onChange={(e) => onChange({ ...binding, kind: e.target.checked ? 'record' : 'records' })}
                                disabled={disabled}
                                className="accent-[var(--accent-primary)]"
                            />
                            Single row
                        </label>
                        {!isSingle ? (
                            <input
                                type="number"
                                className={`${INPUT_CLS} flex-1`}
                                value={binding.limit ?? ''}
                                min={1}
                                onChange={(e) => {
                                    const n = Number(e.target.value);
                                    patch({ limit: e.target.value === '' || !Number.isFinite(n) ? undefined : Math.max(1, Math.round(n)) });
                                }}
                                placeholder="Row limit (optional)"
                                disabled={disabled}
                                aria-label="Row limit"
                            />
                        ) : null}
                    </div>

                    {/* A tile bound to a TABLE had no way to name the column,
                        although the runtime applies `pick` to record/records
                        exactly as it does to a saved view — so the tile was
                        handed the whole row array and showed an object where a
                        number belonged. */}
                    {singleValue ? (
                        <PickValueField
                            pick={binding.pick}
                            columns={fields.map((f) => f.key)}
                            onChange={(pick) => patch({ pick })}
                            disabled={disabled}
                        />
                    ) : null}
                </>
            ) : null}
        </div>
    );
}

// ── dataset editor ───────────────────────────────────────────────────────────

const TYPE_MY_OWN = '__own';

/**
 * The column names a saved view produces — its numbers first, then its
 * breakdowns. Mirrors the aliasing in server/appStudio/queryCompiler.js
 * (compileAggregate): an explicit `as`, else the bucketed `field_bucket`,
 * else the field name.
 */
export function datasetColumns(dataset) {
    const d = dataset && typeof dataset.descriptor === 'object' ? dataset.descriptor : null;
    if (!d) return [];
    const out = [];
    const add = (name) => { if (typeof name === 'string' && name && !out.includes(name)) out.push(name); };
    for (const a of Array.isArray(d.aggregates) ? d.aggregates : []) {
        if (a && typeof a === 'object') add(a.as || (a.fn ? `${a.fn}_${a.field || 'all'}` : null));
    }
    for (const g of Array.isArray(d.groupBy) ? d.groupBy : []) {
        if (g && typeof g === 'object') add(g.as || (g.bucket ? `${g.field}_${g.bucket}` : g.field));
    }
    return out;
}

/**
 * Which ONE value a tile takes out of a view's answer table. Written as
 * `pick: { row, column }` on the binding; without it the tile would show the
 * whole answer instead of a single number.
 */
function PickValueField({ pick, columns, onChange, disabled }) {
    const [typing, setTyping] = useState(false);
    const column = pick?.column || '';
    const row = pick?.row === 'last' ? 'last' : 'first';
    const showText = !columns.length || typing || (!!column && !columns.includes(column));

    const set = (p) => onChange({ row, column, ...p });

    return (
        <div className="flex flex-col gap-1.5 rounded-md border border-[var(--border-subtle)] p-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Which number should this show?</span>
            <div className="flex items-center gap-2 min-w-0">
                <select
                    className={INPUT_CLS}
                    value={row}
                    onChange={(e) => set({ row: e.target.value })}
                    disabled={disabled}
                    aria-label="Which row"
                >
                    <option value="first">First row</option>
                    <option value="last">Last row</option>
                </select>
                {columns.length ? (
                    <select
                        className={INPUT_CLS}
                        value={showText ? TYPE_MY_OWN : column}
                        onChange={(e) => {
                            if (e.target.value === TYPE_MY_OWN) { setTyping(true); return; }
                            setTyping(false);
                            set({ column: e.target.value });
                        }}
                        disabled={disabled}
                        aria-label="Which column"
                    >
                        <option value="">Pick a column…</option>
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                        <option value={TYPE_MY_OWN}>Type a name myself…</option>
                    </select>
                ) : null}
            </div>
            {showText ? (
                <input
                    type="text"
                    className={INPUT_CLS}
                    value={column}
                    onChange={(e) => set({ column: e.target.value })}
                    placeholder="Column name"
                    disabled={disabled}
                    spellCheck={false}
                    aria-label="Column name"
                />
            ) : null}
            {!column ? (
                <p className="text-xs text-[var(--text-secondary)]">Until you pick one, the tile shows the whole answer instead of a single number.</p>
            ) : null}
        </div>
    );
}

function DatasetBinding({ binding, onChange, onBuild, appId, componentType, singleValue, disabled }) {
    const { datasets, isLoading } = useDatasets(appId);
    const [building, setBuilding] = useState(false);
    const autoPicked = useRef(null);

    const selected = useMemo(
        () => datasets.find((d) => d && d.id === binding.datasetId) || null,
        [datasets, binding.datasetId],
    );
    const columns = useMemo(() => datasetColumns(selected), [selected]);

    // A view built here lands before its columns are known, so the first number
    // it produces is filled in as soon as they arrive — otherwise the tile keeps
    // rendering the whole answer. Only a binding that carries NO pick at all is
    // filled: once the field has been offered, an empty column is the user's own
    // answer. The guard is the binding OBJECT, not its id — one panel instance
    // serves every node of a type, and a fill that the parent drops must not
    // retry on the next render.
    useEffect(() => {
        if (!singleValue || disabled) return;
        if (!binding.datasetId || binding.pick || !columns.length) return;
        if (autoPicked.current === binding) return;
        autoPicked.current = binding;
        onChange({ ...binding, pick: { row: 'first', column: columns[0] } });
    }, [singleValue, disabled, binding, columns, onChange]);

    if (!appId) {
        return <p className="text-xs text-[var(--text-secondary)]">Open the app to use a saved view.</p>;
    }

    // Switching to another view invalidates a column chosen from the old one.
    const selectDataset = (id) => onChange({ kind: 'dataset', datasetId: id || null });

    return (
        <div className="flex flex-col gap-2">
            <select
                className={INPUT_CLS}
                value={binding.datasetId || ''}
                onChange={(e) => selectDataset(e.target.value)}
                disabled={disabled}
                aria-label="Saved view"
            >
                <option value="">{isLoading ? 'Loading saved views…' : 'Pick a saved view…'}</option>
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name || d.id}</option>)}
            </select>
            {singleValue && binding.datasetId ? (
                <PickValueField
                    pick={binding.pick}
                    columns={columns}
                    onChange={(pick) => onChange({ ...binding, pick })}
                    disabled={disabled}
                />
            ) : null}
            <button
                type="button"
                onClick={() => setBuilding(true)}
                disabled={disabled}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:border-[var(--accent-primary)] disabled:opacity-50 transition-colors"
            >
                <Database className="w-4 h-4" aria-hidden="true" /> Build a new view…
            </button>
            {building ? (
                <QueryBuilder
                    open={building}
                    onClose={() => setBuilding(false)}
                    appId={appId}
                    componentType={componentType}
                    onSave={(built) => {
                        if (!built?.datasetId) return;
                        // onBuild lets the owning inspector land the new view and
                        // whatever it prefills (a chart's mapping) in ONE patch.
                        if (onBuild) onBuild(built); else selectDataset(built.datasetId);
                    }}
                />
            ) : null}
        </div>
    );
}

// ── connector editor ─────────────────────────────────────────────────────────

function isFormulaVal(v) { return v && typeof v === 'object' && v.kind === 'formula'; }

// One declared param: a literal (Value) OR a {kind:'formula',expr} toggle.
function ConnectorParamField({ param, value, onChange, definition, node, disabled }) {
    const isFormula = isFormulaVal(value);
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">{param.key}{param.required ? ' *' : ''}</span>
                <label className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                    <input
                        type="checkbox"
                        checked={isFormula}
                        onChange={(e) => onChange(e.target.checked ? { kind: 'formula', expr: '' } : undefined)}
                        disabled={disabled}
                        className="accent-[var(--accent-primary)]"
                    />
                    formula
                </label>
            </div>
            {isFormula ? (
                <FormulaField
                    value={value.expr || ''}
                    onChange={(expr) => onChange({ kind: 'formula', expr })}
                    definition={definition}
                    node={node}
                    placeholder="e.g. vars.filters.q"
                    disabled={disabled}
                />
            ) : (
                <input
                    type="text"
                    className={INPUT_CLS}
                    value={value == null ? '' : (typeof value === 'string' ? value : staticDisplay(value))}
                    onChange={(e) => onChange(e.target.value === '' ? undefined : parseStatic(e.target.value))}
                    placeholder={param.type || 'text'}
                    disabled={disabled}
                    spellCheck={false}
                    aria-label={`Param ${param.key}`}
                />
            )}
        </div>
    );
}

function ConnectorBinding({ binding, onChange, appId, definition, node, disabled }) {
    const { connectors, isLoading } = useConnectors(appId);

    if (!appId) {
        return <p className="text-xs text-[var(--text-secondary)]">Open the app to use another system.</p>;
    }

    const connectorId = binding.connectorId || '';
    const selected = connectors.find((c) => c.id === connectorId) || null;
    const declaredParams = selected && Array.isArray(selected.params) ? selected.params : [];
    const params = binding.params && typeof binding.params === 'object' && !Array.isArray(binding.params) ? binding.params : {};

    const setParam = (key, val) => {
        const next = { ...params };
        if (val === undefined) delete next[key]; else next[key] = val;
        onChange({ kind: 'connector', connectorId, params: next });
    };

    return (
        <div className="flex flex-col gap-2">
            <select
                className={INPUT_CLS}
                value={connectorId}
                onChange={(e) => onChange({ kind: 'connector', connectorId: e.target.value || null, params: {} })}
                disabled={disabled}
                aria-label="Connector"
            >
                <option value="">{isLoading ? 'Loading connectors…' : 'Pick a connector…'}</option>
                {connectors.map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
            </select>

            {connectorId && declaredParams.length ? (
                <div className="flex flex-col gap-2">
                    {declaredParams.map((p) => (
                        <ConnectorParamField
                            key={p.key}
                            param={p}
                            value={params[p.key]}
                            onChange={(v) => setParam(p.key, v)}
                            definition={definition}
                            node={node}
                            disabled={disabled}
                        />
                    ))}
                </div>
            ) : null}
            {connectorId && !declaredParams.length ? (
                <p className="text-xs text-[var(--text-secondary)]">This connector takes no params.</p>
            ) : null}
            {connectors.length === 0 && !isLoading ? (
                <p className="text-xs text-[var(--text-secondary)]">No connectors yet — add one in the Tables → Connectors tab.</p>
            ) : null}
        </div>
    );
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function BindingField({
    label,
    value,
    onChange,
    definition,
    node = null,
    componentType = 'chart',
    hint,
    placeholder = 'A value, or JSON like ["a","b"]',
    singleValue = false,
    onBuild = null,
    disabled = false,
}) {
    const chrome = useEditorChrome();
    const appId = chrome?.appId ?? null;
    const [choosing, setChoosing] = useState(false);
    // "Type the values myself" commits an EMPTY literal, which still reads as
    // unset — without this the chooser would reopen over its own answer.
    const [chosen, setChosen] = useState(false);

    // ONE inspector panel instance serves every node of a type, so selecting
    // another table/chart/tile does NOT remount this field. A value that this
    // field did not emit therefore belongs to a different component, and both
    // latches above have to fall back to what that component's binding says.
    // `mine` is compared by identity on purpose: a commit the editor collapses
    // as a no-op leaves `value` untouched, which must not read as a switch.
    const [seen, setSeen] = useState(value);
    const [mine, setMine] = useState(null);
    if (value !== seen) {
        setSeen(value);
        if (value !== mine) { setChoosing(false); setChosen(false); }
    }
    const emit = (next) => { setMine(next); onChange(next); };

    const binding = value && typeof value === 'object' && value.kind
        ? value
        : { kind: 'static', value: value ?? null };
    const mode = modeOf(binding);
    const unset = isUnset(binding) && !chosen;

    const runActions = Object.entries(definition?.actions || {})
        .filter(([, action]) => action?.kind === 'run_automation');

    const pickSource = (next) => {
        setChoosing(false);
        setChosen(true);
        // Re-picking the card that is already active keeps what is configured.
        if (next === mode && !unset) return;
        const skeleton = skeletonFor(next, runActions);
        if (skeleton) emit(skeleton);
    };

    if (unset || choosing) {
        return (
            <FormField label={label} hint={hint}>
                <SourceChooser
                    onPick={pickSource}
                    onCancel={unset ? null : () => setChoosing(false)}
                    disabled={disabled}
                />
            </FormField>
        );
    }

    return (
        <FormField label={label} hint={hint}>
            <div className="flex flex-col gap-2">
                <SourceSummary
                    binding={binding}
                    appId={appId}
                    onChangeClick={() => setChoosing(true)}
                    disabled={disabled}
                />

                {mode === 'static' ? (
                    <input
                        type="text"
                        className={INPUT_CLS}
                        value={staticDisplay(binding.value)}
                        onChange={(e) => emit({ kind: 'static', value: parseStatic(e.target.value) })}
                        placeholder={placeholder}
                        disabled={disabled}
                        spellCheck={false}
                        aria-label="Typed-in value"
                    />
                ) : null}

                {mode === 'formula' ? (
                    <FormulaField
                        value={binding.expr || ''}
                        onChange={(expr) => emit({ kind: 'formula', expr })}
                        definition={definition}
                        node={node}
                        placeholder="e.g. currentUser.name"
                        disabled={disabled}
                    />
                ) : null}

                {mode === 'records' ? (
                    <TableBinding binding={binding} onChange={emit} appId={appId} disabled={disabled} definition={definition} node={node} singleValue={singleValue} />
                ) : null}

                {mode === 'aggregate' ? (
                    <AggregateBinding binding={binding} onChange={emit} appId={appId} disabled={disabled} definition={definition} node={node} singleValue={singleValue} />
                ) : null}

                {mode === 'dataset' ? (
                    <DatasetBinding
                        binding={binding}
                        onChange={emit}
                        onBuild={onBuild}
                        appId={appId}
                        componentType={componentType}
                        singleValue={singleValue}
                        disabled={disabled}
                    />
                ) : null}

                {mode === 'connector' ? (
                    <ConnectorBinding
                        binding={binding}
                        onChange={emit}
                        appId={appId}
                        definition={definition}
                        node={node}
                        disabled={disabled}
                    />
                ) : null}

                {mode === 'actionResult' ? (
                    <div className="flex flex-col gap-2">
                        <select
                            className={INPUT_CLS}
                            value={binding.actionId || ''}
                            onChange={(e) => emit({ ...binding, kind: 'actionResult', actionId: e.target.value || null })}
                            disabled={disabled}
                            aria-label="Source action"
                        >
                            <option value="">Pick an action…</option>
                            {runActions.map(([id]) => (
                                <option key={id} value={id}>Run routine — {id}</option>
                            ))}
                        </select>
                        {runActions.length === 0 && (
                            <p className="text-xs text-[var(--text-secondary)]">
                                No “Run routine” actions in this app yet — wire one to a button or form first.
                            </p>
                        )}
                        <input
                            type="text"
                            className={INPUT_CLS}
                            value={binding.path || ''}
                            onChange={(e) => emit({ ...binding, kind: 'actionResult', path: e.target.value })}
                            placeholder="e.g. rows or data.items"
                            disabled={disabled}
                            spellCheck={false}
                            aria-label="Result path"
                        />
                    </div>
                ) : null}
            </div>
        </FormField>
    );
}
