import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { List, Table2, Braces, ChevronRight } from 'lucide-react';
import JsonTree from './debug/JsonTree';
import { summariseData } from './flow/dataSummary';
import { listBadgeClass } from './flow/settings/formStyles';
import { walkRelativePath } from '../../../../utils/bindingHelpers';

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
/**
 * How wide one table column may get, in px.
 *
 * Without a cap, a single column of full email addresses ("Ewoud van de Kolk
 * <ewoud@…>, Tom Kooy <tomkooy@…>") pushed every other column off the right of
 * the panel — so the answer to "what came back?" needed a horizontal scroll to
 * even see the column names. Cells clamp to one line and the hover card below
 * shows whatever didn't fit.
 */
const COL_MAX_PX = 220;

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
        // Alt rides along so a list can be inserted as-is, bypassing the
        // downstream chooser — same convention as the variable tree/picker.
        onClick: map.onPick ? (e) => { e.stopPropagation(); map.onPick(path, { raw: e.altKey }); } : undefined,
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

/**
 * Is this the "run once per item" envelope the runner emits — one row per
 * iteration, shaped `{ index, item, output, status }` (see execForEachStep)?
 *
 * It matters because those rows carry two unrelated things side by side: the
 * upstream item the step LOOPED OVER, and what the step ITSELF returned. Read
 * as a flat grid they merge into one ambiguous blob and you cannot tell which
 * column came from where — BFSF-369, where a file's url/name/path sat next to
 * the rooms that step had fetched, under one undifferentiated header row.
 */
function isForEachEnvelope(rows, baseCols) {
    if (!baseCols.includes('item') || !baseCols.includes('output')) return false;
    if (!baseCols.includes('index') && !baseCols.includes('status')) return false;
    const objs = rows.filter(isPlainObject);
    return objs.length > 0 && objs.every(r => 'item' in r && 'output' in r);
}

/**
 * Contiguous header spans for the envelope's two halves, so the grid says
 * which side of the loop each column came from. Returns null when the columns
 * aren't the envelope's (nothing to group) — never a row of empty headers.
 */
function envelopeSpans(cols) {
    const labelFor = (c) => {
        if (c === 'item' || c.startsWith('item.') || c.startsWith('item[')) return 'Looped over';
        if (c === 'output' || c.startsWith('output.') || c.startsWith('output[')) return 'This step returned';
        return null;
    };
    const spans = [];
    for (const c of cols) {
        const label = labelFor(c);
        const last = spans[spans.length - 1];
        if (last && last.label === label) last.span += 1;
        else spans.push({ label, span: 1 });
    }
    return spans.some(s => s.label) ? spans : null;
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

    // Columns holding (mostly) ARRAYS OF OBJECTS — the user's literal
    // complaint: a table whose column contains a list used to be a dead grey
    // "2 items" with nothing to open. These expand into `parent[*].leaf`
    // children the same way object columns expand into `parent.leaf`.
    const arrayCols = useMemo(() => {
        const s = new Set();
        for (const c of baseCols) {
            let arrs = 0, total = 0;
            for (const r of rows) {
                const v = isPlainObject(r) ? r[c] : undefined;
                if (v !== undefined) {
                    total++;
                    if (Array.isArray(v) && v.some(el => isPlainObject(el))) arrs++;
                }
            }
            if (total && arrs >= total / 2) s.add(c);
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
    // expanded object column is spliced out for its `parent.leaf` children;
    // an expanded ARRAY column for `parent[*].leaf` — one value per element,
    // resolved with the same [*] flatten the runtime performs.
    const { cols, droppedCols } = useMemo(() => {
        const out = [];
        for (const c of baseCols) {
            if (map && expanded.has(c) && (objectCols.has(c) || arrayCols.has(c))) {
                const children = [];
                const pushKeys = (obj, prefix) => {
                    for (const k of Object.keys(obj)) {
                        const dotted = `${prefix}${k}`;
                        if (!children.includes(dotted)) children.push(dotted);
                    }
                };
                for (const r of rows) {
                    const v = isPlainObject(r) ? r[c] : undefined;
                    if (objectCols.has(c) && isPlainObject(v)) pushKeys(v, `${c}.`);
                    else if (arrayCols.has(c) && Array.isArray(v)) {
                        // Do NOT re-enter FriendlyArray with the same array —
                        // the [{}] render-loop guard below is load-bearing.
                        for (const el of v) if (isPlainObject(el)) pushKeys(el, `${c}[*].`);
                    }
                }
                if (children.length) { out.push(...children); continue; }
            }
            out.push(c);
        }
        // Say what the cap dropped instead of dropping it silently.
        return { cols: out.slice(0, MAX_COLS), droppedCols: Math.max(0, out.length - MAX_COLS) };
    }, [baseCols, objectCols, arrayCols, expanded, map, rows]);

    const shown = rows.slice(0, MAX_ROWS);
    const peek = useCellPeek();
    const groupSpans = useMemo(
        () => (isForEachEnvelope(rows, baseCols) ? envelopeSpans(cols) : null),
        [rows, baseCols, cols],
    );

    // Fallback: no columns discovered — e.g. an array of empty objects (`[{}]`)
    // or of non-objects that slipped through. Render the rows directly as a
    // list. Do NOT re-enter FriendlyArray with the same `rows`: for an array
    // whose items are all empty objects, FriendlyArray would classify them as
    // tabular and route straight back into RecordTable, which again finds zero
    // columns — an unbounded RecordTable↔FriendlyArray render loop that hangs
    // (or OOM-crashes) the panel on a single-element `[{}]`.
    if (baseCols.length === 0) {
        return (
            <ul className="list-disc pl-4 space-y-0.5">
                {shown.map((v, i) => (
                    <li key={i} {...mapAttrs(map, `[${i}]`)}><InlineValue value={v} /></li>
                ))}
                {rows.length > MAX_ROWS && <li className="list-none text-[var(--text-tertiary)]">+{rows.length - MAX_ROWS} more</li>}
            </ul>
        );
    }

    // `min-w-max` lets the table grow to its content width and overflow the
    // OutputView scroll container (height-constrained), so the HORIZONTAL
    // scrollbar sticks to the bottom of the visible panel.
    return (
        <div className="min-w-max">
            <table className="w-full border-collapse">
                {/* Sticky header: 201 rows of Gmail scroll the column names
                    off screen instantly, and a table whose columns you can't
                    name is unreadable. */}
                <thead className="sticky top-0 z-10 bg-[var(--bg-primary)]">
                    {/* Which side of the loop am I looking at (BFSF-369). Only
                        for the per-item envelope; every other table keeps its
                        single header row. */}
                    {groupSpans && (
                        <tr>
                            {groupSpans.map((g, i) => (
                                <th
                                    key={i}
                                    colSpan={g.span}
                                    className={`text-left text-[10px] uppercase tracking-wide font-semibold px-2 pt-1 pb-0.5 whitespace-nowrap ${
                                        g.label
                                            ? 'text-[var(--text-tertiary)] border-b border-[var(--border-default)]'
                                            : ''}`}
                                >
                                    {g.label || ''}
                                </th>
                            ))}
                            {droppedCols > 0 && <th />}
                        </tr>
                    )}
                    <tr>
                        {cols.map((c) => (
                            <ColHeader
                                key={c}
                                col={c}
                                map={map}
                                expandable={map && !c.includes('.') && !c.includes('[*]') && (objectCols.has(c) || arrayCols.has(c))}
                                isListCol={arrayCols.has(c)}
                                onToggle={toggle}
                            />
                        ))}
                        {droppedCols > 0 && (
                            <th className="text-left font-normal text-[var(--text-tertiary)] px-2 py-1 border-b border-[var(--border-default)] whitespace-nowrap">
                                +{droppedCols} more column{droppedCols === 1 ? '' : 's'}
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {shown.map((r, i) => (
                        <tr key={i} className="border-b border-[var(--border-default)]/60 last:border-b-0">
                            {cols.map((c) => {
                                const v = cellValue(r, c, baseCols.length);
                                return (
                                    <td
                                        key={c}
                                        {...mapAttrs(map, `[${i}].${c}`)}
                                        // Capped so one long column can't push
                                        // the rest off the panel; the peek card
                                        // carries whatever is clipped.
                                        style={{ maxWidth: COL_MAX_PX }}
                                        onMouseEnter={(e) => peek.open(e.currentTarget, v, humanize(c.split('.').pop()))}
                                        onMouseLeave={peek.close}
                                        className={`px-2 py-1 align-top text-[var(--text-primary)] ${map ? 'cursor-grab active:cursor-grabbing hover:bg-[var(--accent)]/10' : ''}`}
                                    >
                                        <div className="truncate"><InlineValue value={v} /></div>
                                    </td>
                                );
                            })}
                            {droppedCols > 0 && <td className="px-2 py-1 text-[var(--text-tertiary)]">…</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length > MAX_ROWS && (
                <div className="px-2 py-1 text-[var(--text-tertiary)]">+{rows.length - MAX_ROWS} more rows</div>
            )}
            {peek.card}
        </div>
    );
}

/**
 * Hover a cell, see what's in it.
 *
 * Columns are capped and cells clamp to one line, so the full value has to be
 * reachable without leaving the table — and a native `title` is the wrong tool:
 * it waits a second, collapses newlines, and renders JSON as one grey ribbon.
 * This is a real card, portalled to <body> so the panel's own `overflow: auto`
 * can't clip it, and delayed just long enough that sweeping the pointer across
 * a table doesn't strobe.
 *
 * Cells whose content already fits (short scalars) get no card — popping one
 * for "201" would be noise, not help.
 */
const PEEK_DELAY_MS = 260;
const PEEK_MIN_CHARS = 26;
const PEEK_MAX_CHARS = 1200;
const PEEK_W = 340;

function useCellPeek() {
    const [state, setState] = useState(null); // { top, left, label, text, mono }
    const timer = useRef(null);
    const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

    const close = useCallback(() => { clearTimer(); setState(null); }, []);

    const open = useCallback((el, value, label) => {
        clearTimer();
        if (value === null || value === undefined || value === '') return;
        const mono = typeof value === 'object';
        const full = mono ? prettyJson(value) : scalarText(value);
        if (!mono && full.length < PEEK_MIN_CHARS) return;
        const rect = el.getBoundingClientRect();
        timer.current = setTimeout(() => {
            // Flip above / left when the card would fall off the viewport.
            const vw = window.innerWidth || 0;
            const vh = window.innerHeight || 0;
            const left = Math.max(8, Math.min(rect.left, vw - PEEK_W - 8));
            const below = rect.bottom + 6;
            const top = below + 180 > vh ? Math.max(8, rect.top - 186) : below;
            setState({
                top, left, label, mono,
                text: full.length > PEEK_MAX_CHARS ? `${full.slice(0, PEEK_MAX_CHARS)}…` : full,
            });
        }, PEEK_DELAY_MS);
    }, []);

    useEffect(() => clearTimer, []);

    const card = state && typeof document !== 'undefined'
        ? createPortal(
            <div
                role="tooltip"
                style={{ position: 'fixed', top: state.top, left: state.left, width: PEEK_W, zIndex: 2000 }}
                className="pointer-events-none rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg p-2"
            >
                <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1">{state.label}</div>
                <div className={`max-h-40 overflow-hidden text-[11px] leading-snug text-[var(--text-primary)] whitespace-pre-wrap break-words ${state.mono ? 'font-mono' : ''}`}>
                    {state.text}
                </div>
            </div>,
            document.body,
        )
        : null;

    return { open, close, card };
}

function prettyJson(v) {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

// One table-header cell. `col` is a dotted path relative to the row
// (`output` or `output.content`). When `expandable`, a chevron drills the
// object column into its sub-fields; an expanded child shows a clickable
// parent prefix that collapses it again. The cell itself maps every row's
// value at that column (`map.path[*].col`).
function ColHeader({ col, map, expandable, isListCol = false, onToggle }) {
    const segs = col.split('.');
    const leaf = segs[segs.length - 1];
    const rawParent = segs.length > 1 ? segs.slice(0, -1).join('.') : null;
    // Expansion state is keyed by the BASE column name — strip the wildcard
    // an array column's children carry ('attachments[*]' → toggle 'attachments').
    const parentKey = rawParent ? rawParent.replace(/\[\*\]$/, '') : null;
    const parentLabel = rawParent ? humanize(parentKey) : null;
    return (
        <th
            {...mapAttrs(map, `[*].${col}`)}
            // These two CLOBBER mapAttrs' own title/className (explicit props
            // come after the spread) — so the Alt hint must live here.
            style={{ maxWidth: COL_MAX_PX }}
            className={`text-left font-semibold text-[var(--text-secondary)] px-2 py-1 border-b border-[var(--border-default)] whitespace-nowrap ${map ? 'cursor-grab active:cursor-grabbing hover:bg-[var(--accent)]/10' : ''}`}
            title={map ? `Drag or click to map every row's ${humanize(leaf)} (${map.path}[*].${col}). Hold Alt to insert the list as it is.` : undefined}
        >
            <span className="inline-flex items-center gap-1 max-w-full">
                {rawParent && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggle?.(parentKey); }}
                        className="font-normal text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        title={`Collapse ${parentLabel}`}
                    >
                        {parentLabel} ›
                    </button>
                )}
                <span className="truncate">{humanize(leaf)}</span>
                {expandable && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggle?.(col); }}
                        className="ml-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        title={isListCol
                            ? 'Open the list — one column per field of its items'
                            : 'Show fields — map a single one (e.g. just content)'}
                        aria-label={isListCol ? `Open the list in ${humanize(leaf)}` : 'Show fields'}
                    >
                        <ChevronRight size={11} />
                    </button>
                )}
                {map && !col.includes('.') && !col.includes('[*]') && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); map.onPick?.(`${map.path}[*].${col}`, { raw: false }); }}
                        // NOT the string "Show fields" — the expand chevron is
                        // located by that exact label.
                        aria-label={`Choose how to use every row's ${humanize(leaf)}`}
                        title="Pick one, join them, count them, or run this step once per row"
                        className="ml-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                        <List size={11} />
                    </button>
                )}
            </span>
        </th>
    );
}

// Resolve a cell's value for a (possibly dotted or wildcarded) column path.
function cellValue(row, col, baseColCount) {
    if (col.includes('.') || col.includes('[*]')) return getByDotted(row, col);
    return isPlainObject(row) ? row[col] : (baseColCount === 1 ? row : undefined);
}

// Wildcard-aware: a `[*]` segment maps + flattens one level — byte-for-byte
// the runtime's semantics (walkRelativePath mirrors server bind.js). A naive
// dotted walk would render an expanded array column as a column of `—` while
// the paths it maps resolved fine.
function getByDotted(obj, dotted) {
    const v = walkRelativePath(dotted, obj);
    if (v !== undefined) return v;
    // Fallback for keys the strict path grammar rejects ('content-type') —
    // the historical naive walk. No [*] support here, but wildcarded columns
    // only ever come from the splice above, which uses real object keys.
    let cur = obj;
    for (const k of dotted.split('.')) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[k];
    }
    return cur;
}

/**
 * Field names that describe the REQUEST rather than the result — the envelope
 * a search API wraps its rows in. A Gmail search returns
 * `{ query: 'isv', total: 201, results: [ … ] }`, and this panel used to lead
 * with "Query: isv / Total: 201 / Results": the search term the user had just
 * typed, a number the Output header already reports ("1 of 201 records"), and a
 * label for the only table on screen — three lines of chrome pushing the actual
 * data below the fold.
 *
 * A NAMED list, deliberately, not a shape rule: `{ urgency: 'Medium',
 * topSenders: [ … ] }` has exactly the same shape and every word of it is the
 * answer. Only names that can't be anything but envelope are listed here.
 */
const ENVELOPE_FIELDS = new Set([
    'query', 'q', 'searchquery',
    'total', 'totalresults', 'totalcount', 'count', 'resultcount', 'resultsizeestimate',
    'nextpagetoken', 'pagetoken', 'page', 'offset', 'limit', 'maxresults',
    'took', 'tookms', 'elapsedms', 'durationms', 'historyid',
]);

/**
 * The one list to draw on its own, or null. Requires an envelope: exactly one
 * non-empty list of records, every other field a scalar, and at least one of
 * those scalars a known envelope name. Without that last condition
 * `{ invoices: [ … ] }` would lose "Invoices" — the only word naming its table.
 */
function envelopedListKey(entries) {
    let key = null;
    let envelopeFields = 0;
    for (const [k, v] of entries) {
        if (Array.isArray(v)) {
            if (key) return null;                          // two lists: names tell them apart
            if (v.length === 0 || !v.some(isPlainObject)) return null;
            key = k;
        } else if (v !== null && typeof v === 'object') {
            return null;                                   // a nested object is content too
        } else if (ENVELOPE_FIELDS.has(String(k).toLowerCase().replace(/_/g, ''))) {
            envelopeFields++;
        } else {
            return null;                                   // an unrecognised scalar is content
        }
    }
    return (key && envelopeFields > 0) ? key : null;
}

function FriendlyObject({ obj, map = null }) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return <Empty>No fields</Empty>;
    const only = envelopedListKey(entries);
    if (only) return <FriendlyValue value={obj[only]} map={childMap(map, `.${only}`)} />;
    return (
        <div className="space-y-1.5">
            {entries.map(([k, v]) => {
                const scalar = v === null || typeof v !== 'object';
                const km = childMap(map, `.${k}`);
                // Spread FIRST, then a merged className — the spread used to
                // come last and clobber the label styling with mapAttrs' own
                // cursor classes.
                const attrs = mapAttrs(km, '');
                return (
                    <div key={k} className={scalar ? 'flex gap-1.5 items-baseline' : ''}>
                        <span {...attrs} className={`text-[var(--text-secondary)] font-semibold shrink-0 ${attrs.className || ''}`.trim()}>{humanize(k)}{scalar ? ':' : ''}</span>
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
        // An EMPTY list is a fact ("this email has no attachments"), not
        // missing data — it must never share the "—" no-data marker.
        if (value.length === 0) return <span className="text-[var(--text-tertiary)] italic">none</span>;
        if (value.every((v) => v === null || typeof v !== 'object')) {
            const joined = value.map(scalarText).join(', ');
            return <span title={joined}>{truncate(joined)}</span>;
        }
        // Real data in the same grey as the no-data marker read as absent —
        // the badge says "this is a list, and here is what it holds".
        return (
            <span className={listBadgeClass()} title={safeJson(value)}>
                {summariseData(value)?.label || `${value.length} item${value.length === 1 ? '' : 's'}`}
            </span>
        );
    }
    if (typeof value === 'object') {
        const parts = Object.entries(value).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? '…' : truncate(scalarText(v), 24)}`);
        const more = Object.keys(value).length > 3 ? ' …' : '';
        return <span className="text-[var(--text-secondary)]" title={safeJson(value)}>{truncate(parts.join(' · ') + more)}</span>;
    }
    const s = scalarText(value);
    return <span className="break-words" title={s.length > MAX_CELL ? s : undefined}>{truncate(s)}</span>;
}

/**
 * A scalar — usually text. Long text used to be cut off at 600 characters with
 * no way to see the rest, which made this panel useless for exactly the case
 * that needs it most (an AI answer, an email body, a fetched page).
 */
const SCALAR_CLAMP = 600;
function Scalar({ value, emptyMessage = '—', map = null }) {
    const [expanded, setExpanded] = useState(false);
    if (value === null || value === undefined) return <Empty>{emptyMessage}</Empty>;
    const s = scalarText(value);
    const long = s.length > SCALAR_CLAMP;
    const shown = long && !expanded ? `${s.slice(0, SCALAR_CLAMP - 1)}…` : s;
    // Spread first, merged className — see FriendlyObject.
    const attrs = mapAttrs(map, '');
    return (
        <span className="inline-block max-w-full">
            <span {...attrs} className={`break-words whitespace-pre-wrap text-[var(--text-primary)] ${attrs.className || ''}`.trim()}>{shown}</span>
            {long && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                    className="ml-1.5 text-[10px] text-[var(--accent)] hover:underline align-baseline"
                >
                    {expanded ? 'Show less' : `Show all ${s.length} characters`}
                </button>
            )}
        </span>
    );
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
