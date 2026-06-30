import React, { useMemo, useState } from 'react';
import { Table2, Braces, ChevronRight } from 'lucide-react';
import JsonTree from './debug/JsonTree';

/**
 * Friendly, non-technical view of a step's output for the dry-run preview.
 *
 * Default "Table" mode renders the data the way an average user expects:
 *   - arrays of objects  → a real HTML table (columns = the object fields)
 *   - arrays of scalars  → a simple bulleted list
 *   - objects            → labelled fields (nested arrays become tables)
 *   - scalars            → plain text (no quotes / braces)
 *
 * A per-step toggle flips to "JSON" — the existing collapsible JsonTree — so
 * power users keep the exact structure (no loss of detail). The toggle only
 * appears when there is structure worth simplifying.
 *
 * Mapping (opt-in): when `enableDrag` is set and `basePath` is provided, every
 * field / column / cell becomes draggable and click-to-insert, carrying its
 * binding path (e.g. `steps.x.output.results[*].content`). The Node Detail
 * View uses this to let the Input panel map straight into a parameter. The
 * Output column and dry-run preview leave it off, so they're unchanged.
 */

const MAX_ROWS = 50;
const MAX_COLS = 12;
const MAX_CELL = 80;

export default function OutputView({
    value, emptyMessage = 'No output.', basePath = '', onCopyPath = null,
    fill = false, enableDrag = false, onPickPath = null,
}) {
    const [mode, setMode] = useState('table');
    const structured = value !== null && typeof value === 'object';
    const map = enableDrag && basePath ? { path: basePath, onPick: onPickPath } : null;

    // `fill` grows the card to fill its parent (the Run tab) and scrolls
    // internally; the default sizing keeps it compact for the inline
    // dry-run preview cards.
    return (
        <div className={`rounded border border-[var(--border-default)] bg-[var(--bg-secondary)]/30 overflow-hidden ${fill ? 'flex flex-col flex-1 min-h-0' : 'mt-1'}`}>
            {structured && (
                <div className="flex items-center justify-end gap-1 px-1.5 py-1 border-b border-[var(--border-default)] shrink-0">
                    <ToggleBtn active={mode === 'table'} onClick={() => setMode('table')} Icon={Table2} label="Table" />
                    <ToggleBtn active={mode === 'json'} onClick={() => setMode('json')} Icon={Braces} label="JSON" />
                </div>
            )}
            <div className={`overflow-auto p-1.5 text-xs ${fill ? 'flex-1 min-h-0' : 'max-h-72'}`}>
                {!structured ? (
                    <Scalar value={value} emptyMessage={emptyMessage} map={map} />
                ) : mode === 'json' ? (
                    <JsonTree value={value} searchable={false} maxInitialDepth={1} basePath={basePath} onCopyPath={onCopyPath} emptyMessage={emptyMessage} />
                ) : (
                    <FriendlyValue value={value} emptyMessage={emptyMessage} map={map} />
                )}
            </div>
        </div>
    );
}

// Build draggable/clickable attrs for an element. `segment` is appended to the
// map's absolute base (`map.path`) so callers pass only the RELATIVE step from
// where they are (e.g. `[*].content`, `[2].subject`, or `''` for the base
// itself) and always get an ABSOLUTE binding path. Returns {} when mapping is
// disabled (map = null), so non-mapping callers render exactly as before.
function mapAttrs(map, segment = '') {
    if (!map) return {};
    const path = `${map.path}${segment}`;
    if (!path) return {};
    return {
        draggable: true,
        onDragStart: (e) => {
            e.stopPropagation();
            e.dataTransfer.setData('text/plain', path);
            e.dataTransfer.setData('application/x-binding-path', path);
            e.dataTransfer.effectAllowed = 'copy';
        },
        onClick: map.onPick ? (e) => { e.stopPropagation(); map.onPick(path); } : undefined,
        title: `Drag or click to map ${path}`,
        className: 'cursor-grab active:cursor-grabbing hover:bg-[var(--accent)]/10 rounded',
    };
}
// Descend the map context to a child path (object key / array index).
function childMap(map, segment) {
    if (!map) return null;
    return { ...map, path: `${map.path}${segment}` };
}

function ToggleBtn({ active, onClick, Icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition ${
                active
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
            aria-pressed={active}
        >
            <Icon size={11} /> {label}
        </button>
    );
}

function FriendlyValue({ value, emptyMessage, map = null }) {
    if (value === null || value === undefined) return <Empty>{emptyMessage}</Empty>;
    if (Array.isArray(value)) return <FriendlyArray arr={value} map={map} />;
    if (typeof value === 'object') return <FriendlyObject obj={value} map={map} />;
    return <Scalar value={value} map={map} />;
}

function FriendlyArray({ arr, map = null }) {
    if (arr.length === 0) return <Empty>Empty list</Empty>;
    const objects = arr.filter(isPlainObject);
    // Treat as tabular when at least half the items are objects.
    if (objects.length && objects.length >= arr.length / 2) return <RecordTable rows={arr} map={map} />;
    const shown = arr.slice(0, MAX_ROWS);
    return (
        <ul className="list-disc pl-4 space-y-0.5">
            {shown.map((v, i) => <li key={i} {...mapAttrs(map, `[${i}]`)}><InlineValue value={v} /></li>)}
            {arr.length > MAX_ROWS && <li className="list-none text-[var(--text-tertiary)]">+{arr.length - MAX_ROWS} more</li>}
        </ul>
    );
}

function RecordTable({ rows, map = null }) {
    // Top-level columns (the object keys), discovered in first-seen order.
    const baseCols = useMemo(() => {
        const seen = [];
        for (const r of rows) {
            if (isPlainObject(r)) {
                for (const k of Object.keys(r)) if (!seen.includes(k)) seen.push(k);
            }
        }
        return seen;
    }, [rows]);

    // Which base columns hold (mostly) plain objects — these can be drilled
    // into so the user maps ONE nested field (e.g. just `output.content`)
    // instead of the whole object. Only offered when dragging is enabled.
    const objectCols = useMemo(() => {
        const s = new Set();
        for (const c of baseCols) {
            let objs = 0, total = 0;
            for (const r of rows) {
                const v = isPlainObject(r) ? r[c] : undefined;
                if (v !== undefined) { total++; if (isPlainObject(v)) objs++; }
            }
            if (total && objs >= total / 2) s.add(c);
        }
        return s;
    }, [rows, baseCols]);

    // Per-column expand state (set of base-col keys). Expanding an object
    // column replaces it with its leaf sub-columns (one level deep).
    const [expanded, setExpanded] = useState(() => new Set());
    const toggle = (key) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    // The columns actually rendered: dotted paths relative to each row. An
    // expanded object column is spliced out for its `parent.leaf` children.
    const cols = useMemo(() => {
        const out = [];
        for (const c of baseCols) {
            if (map && objectCols.has(c) && expanded.has(c)) {
                const children = [];
                for (const r of rows) {
                    const v = isPlainObject(r) ? r[c] : undefined;
                    if (isPlainObject(v)) {
                        for (const k of Object.keys(v)) {
                            const dotted = `${c}.${k}`;
                            if (!children.includes(dotted)) children.push(dotted);
                        }
                    }
                }
                if (children.length) { out.push(...children); continue; }
            }
            out.push(c);
        }
        return out.slice(0, MAX_COLS);
    }, [baseCols, objectCols, expanded, map, rows]);

    const shown = rows.slice(0, MAX_ROWS);

    // Fallback: array of non-objects that slipped through — render as a list.
    if (baseCols.length === 0) return <FriendlyArray arr={rows} map={map} />;

    // `min-w-max` lets the table grow to its content width and overflow the
    // OutputView scroll container (height-constrained), so the HORIZONTAL
    // scrollbar sticks to the bottom of the visible panel.
    return (
        <div className="min-w-max">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        {cols.map((c) => (
                            <ColHeader
                                key={c}
                                col={c}
                                map={map}
                                expandable={map && !c.includes('.') && objectCols.has(c)}
                                onToggle={toggle}
                            />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {shown.map((r, i) => (
                        <tr key={i} className="border-b border-[var(--border-default)]/60 last:border-b-0">
                            {cols.map((c) => (
                                <td key={c} {...mapAttrs(map, `[${i}].${c}`)} className={`px-2 py-1 align-top text-[var(--text-primary)] ${map ? 'cursor-grab active:cursor-grabbing hover:bg-[var(--accent)]/10' : ''}`}>
                                    <InlineValue value={cellValue(r, c, baseCols.length)} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > MAX_ROWS && (
                <div className="px-2 py-1 text-[var(--text-tertiary)]">+{rows.length - MAX_ROWS} more rows</div>
            )}
        </div>
    );
}

// One table-header cell. `col` is a dotted path relative to the row
// (`output` or `output.content`). When `expandable`, a chevron drills the
// object column into its sub-fields; an expanded child shows a clickable
// parent prefix that collapses it again. The cell itself maps every row's
// value at that column (`map.path[*].col`).
function ColHeader({ col, map, expandable, onToggle }) {
    const segs = col.split('.');
    const leaf = segs[segs.length - 1];
    const parent = segs.length > 1 ? segs.slice(0, -1).join('.') : null;
    return (
        <th
            {...mapAttrs(map, `[*].${col}`)}
            className={`text-left font-semibold text-[var(--text-secondary)] px-2 py-1 border-b border-[var(--border-default)] whitespace-nowrap ${map ? 'cursor-grab active:cursor-grabbing hover:bg-[var(--accent)]/10' : ''}`}
            title={map ? `Drag or click to map every row's ${humanize(leaf)} (${map.path}[*].${col})` : undefined}
        >
            <span className="inline-flex items-center gap-1">
                {parent && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggle?.(parent); }}
                        className="font-normal text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        title={`Collapse ${humanize(parent)}`}
                    >
                        {humanize(parent)} ›
                    </button>
                )}
                {humanize(leaf)}
                {expandable && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggle?.(col); }}
                        className="ml-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        title="Show fields — map a single one (e.g. just content)"
                        aria-label="Show fields"
                    >
                        <ChevronRight size={11} />
                    </button>
                )}
            </span>
        </th>
    );
}

// Resolve a cell's value for a (possibly dotted) column path.
function cellValue(row, col, baseColCount) {
    if (col.includes('.')) return getByDotted(row, col);
    return isPlainObject(row) ? row[col] : (baseColCount === 1 ? row : undefined);
}

function getByDotted(obj, dotted) {
    let cur = obj;
    for (const k of dotted.split('.')) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[k];
    }
    return cur;
}

function FriendlyObject({ obj, map = null }) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return <Empty>No fields</Empty>;
    return (
        <div className="space-y-1.5">
            {entries.map(([k, v]) => {
                const scalar = v === null || typeof v !== 'object';
                const km = childMap(map, `.${k}`);
                return (
                    <div key={k} className={scalar ? 'flex gap-1.5 items-baseline' : ''}>
                        <span className="text-[var(--text-secondary)] font-semibold shrink-0" {...mapAttrs(km, '')}>{humanize(k)}{scalar ? ':' : ''}</span>
                        <div className={scalar ? 'min-w-0' : 'mt-0.5'}>
                            <FriendlyValue value={v} map={km} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Compact single-cell rendering used inside tables and lists.
function InlineValue({ value }) {
    if (value === null || value === undefined) return <span className="text-[var(--text-tertiary)]">—</span>;
    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-[var(--text-tertiary)]">—</span>;
        if (value.every((v) => v === null || typeof v !== 'object')) {
            const joined = value.map(scalarText).join(', ');
            return <span title={joined}>{truncate(joined)}</span>;
        }
        return <span className="text-[var(--text-tertiary)]">{value.length} item{value.length === 1 ? '' : 's'}</span>;
    }
    if (typeof value === 'object') {
        const parts = Object.entries(value).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? '…' : truncate(scalarText(v), 24)}`);
        const more = Object.keys(value).length > 3 ? ' …' : '';
        return <span className="text-[var(--text-secondary)]" title={safeJson(value)}>{truncate(parts.join(' · ') + more)}</span>;
    }
    const s = scalarText(value);
    return <span className="break-words" title={s.length > MAX_CELL ? s : undefined}>{truncate(s)}</span>;
}

function Scalar({ value, emptyMessage = '—', map = null }) {
    if (value === null || value === undefined) return <Empty>{emptyMessage}</Empty>;
    const s = scalarText(value);
    return <span className="break-words text-[var(--text-primary)] inline-block" {...mapAttrs(map, '')} title={s.length > 400 ? s : undefined}>{s.length > 600 ? s.slice(0, 599) + '…' : s}</span>;
}

function Empty({ children }) {
    return <span className="text-[var(--text-tertiary)] italic">{children}</span>;
}

// ── helpers ──────────────────────────────────────────────────────────────
function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function scalarText(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
}

function truncate(s, n = MAX_CELL) {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** camelCase / snake_case / kebab → "Title case" for readable headers/labels. */
function humanize(key) {
    return String(key)
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, (c) => c.toUpperCase());
}

function safeJson(v) {
    try { return JSON.stringify(v); } catch { return ''; }
}
