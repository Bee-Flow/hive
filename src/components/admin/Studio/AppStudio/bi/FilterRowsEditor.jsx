import { FunctionSquare, Pencil, Type, Undo2 } from 'lucide-react';
import React, { useState } from 'react';
import SegmentedControl from '../../../../shared/SegmentedControl';
import Toggle from '../../../../shared/Toggle';
import { RepeatableList } from '../../../ProductWebsite/fields';
import ExpressionInput from '../inspector/logic/ExpressionInput';
import { INPUT_CLS } from '../inspector/panels/kit';

/**
 * App Studio — the shared filter-row editor.
 *
 * A repeatable list of structured `{ field, op, value?, required? }` rows over a
 * table's fields, using the closed FILTER_OPS vocabulary the server query
 * compiler consumes (server/appStudio/queryCompiler.js). Extracted from
 * QueryBuilder so both the BI dataset builder and the inspector's
 * record/records BindingField share ONE filter UI and one shape.
 *
 * The value control follows the chosen field's type (yes/no, date, number, one
 * of its choices, a list for `is one of`, a pair for `between`), with a per-row
 * "type any value" escape back to free text.
 *
 * ── WHY THE ESCAPE IS DERIVED, NOT REMEMBERED ───────────────────────
 * That escape used to be UI-only state keyed by row INDEX, which broke twice
 * over. Deleting or reordering a row left the marker pointing at a different
 * row; and because it did not survive a reload, a SAVED value the typed control
 * cannot represent — `value: 'maybe'` on a yes/no column, a select value no
 * longer among the options — rendered as an empty control with the real value
 * invisible, and the first click overwrote it. So representability is now read
 * off the data (isRepresentable) and the remembered set only records the
 * "I just clicked the pencil" case, keyed by the row OBJECT: RepeatableList
 * removes with filter() and reorders with a swap, so row objects keep their
 * identity across both.
 *
 * `allowFormula` (BindingField only) adds a per-row Literal↔Formula toggle: a
 * formula row emits `value: { kind:'formula', expr }`, resolved client-side
 * against the live scope before fetch (validate.js accepts both forms). It also
 * turns on the `required` toggle, because a formula is the only value that can
 * fail to resolve. The dataset builder leaves it off — aggregate filters are
 * always literals.
 */

export const FILTER_OPS = [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '≥' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '≤' },
    { value: 'contains', label: 'contains' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'in', label: 'is one of' },
    { value: 'between', label: 'is between' },
    { value: 'isNull', label: 'is empty' },
    { value: 'isNotNull', label: 'is not empty' },
];

export const NO_VALUE_OPS = new Set(['isNull', 'isNotNull']);

// Ops that match on text no matter what the column holds.
const TEXT_OPS = new Set(['contains', 'startsWith']);

// Ops whose value is a LIST, not a scalar (queryCompiler: `in` takes an array,
// `between` a [min, max] pair).
const LIST_OPS = new Set(['in', 'between']);

// Controls whose value is a SHAPE (an array, a pair) rather than a scalar, so
// the raw-text escape cannot represent them without corrupting the filter.
const SHAPE_CONTROLS = new Set(['list', 'range']);

/**
 * Which ops each column type can carry. A saved op outside its list is always
 * re-offered (see opsFor) so an existing filter round-trips untouched, but the
 * picker never SUGGESTS "contains" for a yes/no column — which used to leave
 * `contains` set after a field switch and silently render a free-text box for a
 * boolean.
 */
const OPS_BY_TYPE = {
    bool: ['eq', 'neq', 'isNull', 'isNotNull'],
    number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'isNull', 'isNotNull'],
    date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
    datetime: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
    select: ['eq', 'neq', 'in', 'contains', 'isNull', 'isNotNull'],
    multiselect: ['eq', 'neq', 'in', 'contains', 'isNull', 'isNotNull'],
};
const DEFAULT_OPS = ['eq', 'neq', 'contains', 'startsWith', 'in', 'isNull', 'isNotNull'];

function allowedOps(field) {
    return OPS_BY_TYPE[field?.type] || DEFAULT_OPS;
}

/** The op list to offer, with the current op appended so it always round-trips. */
function opsFor(field, current) {
    const allowed = allowedOps(field);
    const keys = allowed.includes(current) || !current ? allowed : [...allowed, current];
    return FILTER_OPS.filter((o) => keys.includes(o.value));
}

function isFormulaValue(v) {
    return !!v && typeof v === 'object' && v.kind === 'formula';
}

/** A select/multiselect field's choices, as { value, label } (server stores strings or {value,label}). */
function choicesOf(field) {
    return (Array.isArray(field?.options) ? field.options : []).map((o) => (
        o && typeof o === 'object'
            ? { value: String(o.value ?? o.key ?? ''), label: String(o.label ?? o.value ?? o.key ?? '') }
            : { value: String(o), label: String(o) }
    ));
}

/** Which value control a row deserves. */
function valueControlFor(field, op) {
    if (op === 'in') return 'list';
    if (op === 'between') return 'range';
    if (TEXT_OPS.has(op)) return 'text';
    const type = field?.type;
    if (type === 'bool') return 'bool';
    if (type === 'date' || type === 'datetime') return type;
    if (type === 'number') return 'number';
    if ((type === 'select' || type === 'multiselect') && choicesOf(field).length) return 'choice';
    return 'text';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function isNumeric(v) {
    return Number.isFinite(Number(String(v).replace(',', '.')));
}

/**
 * Can the typed control show `value` faithfully? A `false` here is what drops
 * the row to free text, so the user always SEES what is saved even when the
 * pretty control cannot express it.
 */
export function isRepresentable(value, control, field) {
    if (value === '' || value == null) return true;
    switch (control) {
        case 'bool': return value === true || value === false;
        case 'choice': return choicesOf(field).some((c) => c.value === String(value));
        case 'date': return DATE_RE.test(String(value));
        case 'datetime': return DATETIME_RE.test(String(value));
        case 'number': return isNumeric(value);
        case 'list': return Array.isArray(value);
        case 'range': return Array.isArray(value) && value.length === 2;
        default: return true;
    }
}

function boolSegment(value) {
    if (value === true || value === 'true') return 'true';
    if (value === false || value === 'false') return 'false';
    return '';
}

/** The typed literal control for one row (never rendered for a formula row). */
function ValueControl({ control, f, field, update }) {
    if (control === 'bool') {
        return (
            <SegmentedControl
                value={boolSegment(f.value)}
                onChange={(v) => update({ ...f, value: v === 'true' })}
                options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]}
                size="sm"
                ariaLabel="Filter value"
            />
        );
    }
    if (control === 'date' || control === 'datetime') {
        return (
            <input
                type={control === 'date' ? 'date' : 'datetime-local'}
                className={INPUT_CLS}
                value={typeof f.value === 'string' ? f.value : ''}
                onChange={(e) => update({ ...f, value: e.target.value })}
                aria-label="Filter value"
            />
        );
    }
    if (control === 'number') {
        // Not type="number": a typed decimal comma (1,5) must survive — the
        // query builder parses it locale-aware before it reaches the server.
        return (
            <input
                type="text"
                inputMode="decimal"
                className={INPUT_CLS}
                value={f.value ?? ''}
                onChange={(e) => update({ ...f, value: e.target.value })}
                placeholder="0"
                aria-label="Filter value"
            />
        );
    }
    if (control === 'choice') {
        const choices = choicesOf(field);
        const current = f.value == null ? '' : String(f.value);
        return (
            <select
                className={INPUT_CLS}
                value={choices.some((c) => c.value === current) ? current : ''}
                onChange={(e) => update({ ...f, value: e.target.value })}
                aria-label="Filter value"
            >
                <option value="">Pick one…</option>
                {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
        );
    }
    if (control === 'list') {
        // `in` takes an array (queryCompiler caps it at MAX_IN_VALUES). Comma
        // separated is the shape people already type into a filter box; blanks
        // are dropped so a trailing comma is harmless.
        // A saved value that is not an array (a legacy row, or one written by
        // the raw-text escape this control no longer offers) is SHOWN rather
        // than hidden behind an empty box, and normalised to an array by the
        // next edit — `in` takes a list, and a string there matches nothing.
        const list = Array.isArray(f.value)
            ? f.value
            : (typeof f.value === 'string' && f.value
                ? f.value.split(',').map((x) => x.trim()).filter((x) => x !== '')
                : []);
        return (
            <input
                type="text"
                className={INPUT_CLS}
                value={list.join(', ')}
                onChange={(e) => update({
                    ...f,
                    value: e.target.value.split(',').map((s) => s.trim()).filter((s) => s !== ''),
                })}
                placeholder="open, in progress, done"
                aria-label="Filter values"
            />
        );
    }
    if (control === 'range') {
        const pair = Array.isArray(f.value) && f.value.length === 2 ? f.value : ['', ''];
        const setAt = (i, v) => {
            const next = [pair[0], pair[1]];
            next[i] = v;
            update({ ...f, value: next });
        };
        const inputType = field?.type === 'date' ? 'date' : field?.type === 'datetime' ? 'datetime-local' : 'text';
        return (
            <div className="flex items-center gap-1.5 min-w-0">
                <input
                    type={inputType}
                    className={INPUT_CLS}
                    value={pair[0] ?? ''}
                    onChange={(e) => setAt(0, e.target.value)}
                    placeholder="From"
                    aria-label="Filter value from"
                />
                <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">and</span>
                <input
                    type={inputType}
                    className={INPUT_CLS}
                    value={pair[1] ?? ''}
                    onChange={(e) => setAt(1, e.target.value)}
                    placeholder="To"
                    aria-label="Filter value to"
                />
            </div>
        );
    }
    return (
        <input
            type="text"
            className={INPUT_CLS}
            value={f.value ?? ''}
            onChange={(e) => update({ ...f, value: e.target.value })}
            placeholder="Value"
            aria-label="Filter value"
        />
    );
}

/** The empty value a control starts from, so a switch never leaves a stale shape. */
function emptyValueFor(control) {
    if (control === 'list') return [];
    if (control === 'range') return ['', ''];
    return '';
}

/**
 * A literal, written as the expression that yields it — `open` → `"open"`.
 *
 * Switching Literal→Formula used to write an empty expression over whatever was
 * there. Carrying the value across means the toggle is a way to LOOK at the
 * value as a formula, which is how someone learns the syntax; it also means a
 * misclick costs nothing. Arrays are the one thing that cannot come along: the
 * expression grammar has no array literal (`[` is index access), so `in` and
 * `between` rows fall back to the remembered value instead.
 */
export function exprFromLiteral(value) {
    if (typeof value === 'string') return value === '' ? '' : JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return String(value);
    return '';
}

/** The inverse, for the expressions simple enough to be a literal again. */
export function literalFromExpr(expr, control) {
    const src = typeof expr === 'string' ? expr.trim() : '';
    if (!src) return emptyValueFor(control);
    if (src === 'true') return true;
    if (src === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(src)) return control === 'number' ? src : Number(src);
    if (/^"([^"\\]|\\.)*"$/.test(src) || /^'([^'\\]|\\.)*'$/.test(src)) {
        try { return JSON.parse(`"${src.slice(1, -1).replace(/"/g, '\\"')}"`); } catch { /* fall through */ }
    }
    return emptyValueFor(control);
}

export default function FilterRowsEditor({
    fields = [],
    filters,
    onChange,
    allowFormula = false,
    label = 'Filters',
    disabled = false,
    definition = null,
    node = null,
}) {
    const fieldName = (key) => (fields.find((f) => f.key === key) || {}).name || key || 'Filter';
    // Rows the user explicitly sent to free text, keyed by the row OBJECT.
    // Never by index: RepeatableList re-indexes on remove.
    const [escaped, setEscaped] = useState(() => new Set());
    // What the OTHER mode held, per row object. Literal↔Formula is a two-way
    // door: the value you came from is waiting when you go back, even for the
    // shapes (a list, a range) that cannot be written as an expression at all.
    const [stashed, setStashed] = useState(() => new Map());

    const rows = Array.isArray(filters) ? filters : [];

    /**
     * Move the marker from the row object being replaced onto its replacement,
     * and forget rows that no longer exist. A row that was NOT escaped must
     * stay unescaped — carrying the marker onto every edited row would send the
     * whole list to free text after one keystroke.
     */
    const reKey = (from, to) => {
        setEscaped((prev) => {
            if (!prev.has(from)) {
                const live = new Set(rows.filter((row) => prev.has(row)));
                return live.size === prev.size ? prev : live;   // same set → no re-render
            }
            const next = new Set();
            for (const row of rows) {
                if (row === from) next.add(to);
                else if (prev.has(row)) next.add(row);
            }
            return next;
        });
        setStashed((prev) => {
            if (prev.size === 0) return prev;
            const next = new Map();
            for (const row of rows) {
                if (row === from) { if (prev.has(from)) next.set(to, prev.get(from)); }
                else if (prev.has(row)) next.set(row, prev.get(row));
            }
            return next.size === prev.size && !prev.has(from) ? prev : next;
        });
    };

    return (
        <fieldset disabled={disabled} className="min-w-0">
            <RepeatableList
                label={label}
                items={rows}
                onChange={onChange}
                makeNew={() => ({ field: '', op: 'eq', value: '' })}
                addLabel="Add filter"
                itemLabel={(f) => fieldName(f.field)}
                renderItem={(f, rawUpdate, idx) => {
                    // Every write goes through here so the free-text marker
                    // follows the row object rather than its position.
                    const update = (next) => { reKey(f, next); rawUpdate(next); };

                    const usesFormula = isFormulaValue(f.value);
                    const needsValue = !NO_VALUE_OPS.has(f.op);
                    const field = fields.find((x) => x.key === f.field) || null;
                    const typedControl = valueControlFor(field, f.op);
                    // Derived first, remembered second: a saved value the typed
                    // control cannot show must never be hidden behind an empty
                    // widget the next click overwrites.
                    // The list control renders ANY saved value (it splits a
                    // string on commas), so it never needs the raw-text
                    // fallback — and taking it would write a string back into a
                    // field that must hold an array.
                    const unrepresentable = !usesFormula
                        && typedControl !== 'list'
                        && !isRepresentable(f.value, typedControl, field);
                    const isEscaped = escaped.has(f);
                    const control = (isEscaped || unrepresentable) ? 'text' : typedControl;
                    // The raw-text escape exists for controls that CONSTRAIN a
                    // value (a choice list, a date, yes/no). It cannot be
                    // offered for the ones that carry a SHAPE: "is one of" takes
                    // an array and "is between" a pair, and the text box wrote a
                    // plain string into both — which the compiler then matched
                    // zero rows against, in silence. Their own controls already
                    // accept free text anyway.
                    const canEscape = typedControl !== 'text' && !SHAPE_CONTROLS.has(typedControl);

                    const toggleEscape = () => {
                        if (isEscaped) {
                            // Back to the picker: clear only if what is there
                            // cannot be shown, so a valid value survives.
                            setEscaped((prev) => { const n = new Set(prev); n.delete(f); return n; });
                            if (!isRepresentable(f.value, typedControl, field)) {
                                rawUpdate({ ...f, value: emptyValueFor(typedControl) });
                            }
                            return;
                        }
                        setEscaped((prev) => new Set(prev).add(f));
                    };

                    /**
                     * Literal ↔ Formula, carrying the value across.
                     *
                     * This used to write '' over whatever was in the box, so one
                     * click on the wrong icon lost a hand-written expression and
                     * the only way back was the editor-wide undo, which is not
                     * anywhere near these buttons.
                     */
                    const toggleFormula = () => {
                        const remembered = stashed.get(f) || {};
                        const nextValue = usesFormula
                            ? (remembered.literal !== undefined
                                ? remembered.literal
                                : literalFromExpr(f.value?.expr, typedControl))
                            : { kind: 'formula', expr: remembered.formula || exprFromLiteral(f.value) };
                        const leaving = usesFormula
                            ? { formula: f.value?.expr ?? '' }
                            : { literal: f.value };
                        setStashed((prev) => new Map(prev).set(f, { ...remembered, ...leaving }));
                        update({ ...f, value: nextValue });
                    };

                    return (
                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    className={INPUT_CLS}
                                    value={f.field || ''}
                                    onChange={(e) => {
                                        const nextField = fields.find((x) => x.key === e.target.value) || null;
                                        // An op the new column cannot carry is
                                        // reset rather than left behind — a
                                        // stale `contains` on a yes/no column
                                        // rendered a free-text box.
                                        const op = allowedOps(nextField).includes(f.op) ? f.op : 'eq';
                                        const nextControl = valueControlFor(nextField, op);
                                        update({
                                            ...f,
                                            field: e.target.value,
                                            op,
                                            ...(usesFormula ? {} : { value: emptyValueFor(nextControl) }),
                                        });
                                    }}
                                    aria-label="Filter field"
                                >
                                    <option value="">Pick a field…</option>
                                    {fields.map((x) => <option key={x.key} value={x.key}>{x.name || x.key}</option>)}
                                </select>
                                <select
                                    className={INPUT_CLS}
                                    value={f.op || 'eq'}
                                    onChange={(e) => {
                                        const op = e.target.value;
                                        const nextControl = valueControlFor(field, op);
                                        // A scalar cannot stand in for the
                                        // [min,max] `between` wants, nor for
                                        // the array `in` wants.
                                        const shapeChanged = LIST_OPS.has(op) !== LIST_OPS.has(f.op)
                                            || (op === 'between') !== (f.op === 'between');
                                        update({
                                            ...f,
                                            op,
                                            ...(usesFormula || !shapeChanged ? {} : { value: emptyValueFor(nextControl) }),
                                        });
                                    }}
                                    aria-label="Filter operator"
                                >
                                    {opsFor(field, f.op).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            {needsValue ? (
                                <div className="flex items-stretch gap-1.5">
                                    {usesFormula ? (
                                        <div className="min-w-0 flex-1">
                                            <ExpressionInput
                                                variant="inline"
                                                value={f.value?.expr ?? ''}
                                                onChange={(expr) => update({ ...f, value: { kind: 'formula', expr } })}
                                                definition={definition}
                                                node={node}
                                                placeholder="e.g. currentUser.id"
                                                ariaLabel="Filter formula"
                                                showPicker={!!definition}
                                            />
                                        </div>
                                    ) : (
                                        <div className="min-w-0 flex-1">
                                            <ValueControl control={control} f={f} field={field} update={update} />
                                        </div>
                                    )}
                                    {!usesFormula && canEscape ? (
                                        <button
                                            type="button"
                                            onClick={toggleEscape}
                                            title={control === 'text' ? 'Back to the simple picker' : 'Type any value'}
                                            aria-label={control === 'text' ? 'Back to the simple picker' : 'Type any value'}
                                            className="shrink-0 px-2 rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                                        >
                                            {control === 'text' ? <Undo2 size={13} /> : <Pencil size={13} />}
                                        </button>
                                    ) : null}
                                    {allowFormula ? (
                                        <button
                                            type="button"
                                            onClick={toggleFormula}
                                            title={usesFormula ? 'Use a fixed value' : 'Use a formula'}
                                            aria-label={usesFormula ? 'Use a fixed value' : 'Use a formula'}
                                            className="shrink-0 px-2 rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                                        >
                                            {usesFormula ? <Type size={13} /> : <FunctionSquare size={13} />}
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}

                            {/*
                              * The server has honoured `required` all along and
                              * nothing wrote it. Without it, a scoping filter
                              * whose formula does not resolve is DROPPED and the
                              * component lists the whole table — the "quietly
                              * showing the wrong rows" failure. Offered only
                              * where a value can fail to resolve.
                              */}
                            {allowFormula && needsValue ? (
                                <Toggle
                                    size="sm"
                                    label="Show nothing until this has a value"
                                    description="Otherwise an unset value means “no filter”, and every row shows."
                                    checked={!!f.required}
                                    onChange={(v) => {
                                        const { required: _drop, ...rest } = f;
                                        update(v ? { ...rest, required: true } : rest);
                                    }}
                                    ariaLabel={`Filter ${idx + 1} required`}
                                />
                            ) : null}
                        </div>
                    );
                }}
            />
        </fieldset>
    );
}
