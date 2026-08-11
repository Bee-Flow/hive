/**
 * Datatype-aware condition model for the clickable Filter / Condition / Switch
 * builder.
 *
 * A condition is modelled as an array of `rows` joined by a single boolean
 * `join` ('&&' or '||'). Each row is `{ field, op, value }`:
 *   - field — a binding (ref/expr) pointing at the left-hand value
 *   - op    — an operator KEY (see OPERATORS)
 *   - value — a binding for the right-hand side (ignored for unary ops)
 *
 * This module is pure (no React) so it can be unit-tested and shared. It
 * serialises rows to the restricted-JS `expr` string the server engine
 * evaluates — comparators map to `==`,`>` … and the friendly text operators
 * map to the whitelisted helper functions added to server/automation/expr.js
 * (`contains`, `startsWith`, `endsWith`, `isEmpty`). It also parses an `expr`
 * back into rows so editing an existing step re-hydrates the clickable UI;
 * anything it can't recognise returns null and the caller falls back to the
 * raw-expression textarea.
 */
import { renderBindingValue, isCleanPath, bindingFromInput } from '../../../../../utils/bindingHelpers';

// ── Datatype inference ─────────────────────────────────
/**
 * Infer a coarse datatype from a sample value, used to pick which operators
 * to offer. ISO-8601-ish strings are surfaced as 'date' so the comparators
 * can be relabelled "is before/after".
 */
export function inferType(value) {
    if (value == null) return 'unknown';
    if (Array.isArray(value)) return 'array';
    const t = typeof value;
    if (t === 'number') return 'number';
    if (t === 'boolean') return 'boolean';
    if (t === 'object') return 'object';
    if (t === 'string') {
        if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/.test(value.trim())) return 'date';
        return 'string';
    }
    return 'unknown';
}

// ── Operator registry ──────────────────────────────────
// kind: 'cmp' (binary symbol) | 'fn' (helper call) | 'unary' (no value input)
const OPERATORS = [
    { key: 'eq',  kind: 'cmp', symbol: '==',  label: 'equals' },
    { key: 'neq', kind: 'cmp', symbol: '!=',  label: 'does not equal' },
    { key: 'gt',  kind: 'cmp', symbol: '>',   label: 'greater than' },
    { key: 'gte', kind: 'cmp', symbol: '>=',  label: 'greater than or equal' },
    { key: 'lt',  kind: 'cmp', symbol: '<',   label: 'less than' },
    { key: 'lte', kind: 'cmp', symbol: '<=',  label: 'less than or equal' },
    // Strict equality — hidden from the friendly menu but kept so an existing
    // expr that uses === / !== round-trips without being silently weakened.
    { key: 'seq',  kind: 'cmp', symbol: '===', label: 'strictly equals', hidden: true },
    { key: 'sneq', kind: 'cmp', symbol: '!==', label: 'strictly does not equal', hidden: true },
    // Text/array helpers → whitelisted server functions. `negate` wraps the
    // call in `!` (`!contains(l, r)`) — the same prefix isNotEmpty already
    // emits, so the server grammar is known to accept it.
    { key: 'contains',    kind: 'fn', fn: 'contains',   label: 'contains' },
    { key: 'notContains', kind: 'fn', fn: 'contains',   label: 'does not contain', negate: true },
    { key: 'startsWith',  kind: 'fn', fn: 'startsWith', label: 'starts with' },
    { key: 'endsWith',    kind: 'fn', fn: 'endsWith',   label: 'ends with' },
    // Unary — no right-hand value.
    { key: 'isEmpty',    kind: 'unary', label: 'is empty',     emit: (l) => `isEmpty(${l})` },
    { key: 'isNotEmpty', kind: 'unary', label: 'is not empty', emit: (l) => `!isEmpty(${l})` },
    { key: 'isTrue',     kind: 'unary', label: 'is true',      emit: (l) => `${l} == true` },
    { key: 'isFalse',    kind: 'unary', label: 'is false',     emit: (l) => `${l} == false` },
    // "has a value" — a bare field with NO comparison chosen yet (or an
    // intentional truthiness check). Emits the left fragment VERBATIM so a
    // bare-path expr (e.g. `steps.s1.output.results[*].to`, saved with no
    // operator) round-trips byte-identical instead of falling to raw mode.
    { key: 'truthy', kind: 'unary', label: 'has a value', emit: (l) => l },
];

const OP_BY_KEY = new Map(OPERATORS.map((o) => [o.key, o]));

export function getOperator(key) {
    return OP_BY_KEY.get(key) || null;
}

export function isUnaryOp(key) {
    return getOperator(key)?.kind === 'unary';
}

// Which operator keys to surface for each datatype.
const TYPE_OPS = {
    string:  ['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty', 'truthy'],
    number:  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'truthy'],
    boolean: ['isTrue', 'isFalse', 'eq', 'neq', 'truthy'],
    date:    ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'truthy'],
    array:   ['contains', 'notContains', 'isEmpty', 'isNotEmpty', 'truthy'],
    object:  ['eq', 'neq', 'isEmpty', 'isNotEmpty', 'truthy'],
    unknown: ['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'gt', 'lt', 'isEmpty', 'isNotEmpty', 'truthy'],
};

/**
 * Operator options for a datatype, as `{ key, label }`. `currentKey` is always
 * appended (even if hidden / off-type) so a parsed operator stays selectable
 * and round-trips. Comparator labels are date-aware (greater than → is after).
 */
export function operatorsForType(type, currentKey = null) {
    const keys = TYPE_OPS[type] || TYPE_OPS.unknown;
    const list = keys.slice();
    if (currentKey && !list.includes(currentKey)) list.push(currentKey);
    return list
        .map((k) => OP_BY_KEY.get(k))
        .filter(Boolean)
        .map((o) => ({ key: o.key, label: labelFor(o.key, type) }));
}

export function labelFor(key, type) {
    const o = OP_BY_KEY.get(key);
    if (!o) return key;
    if (type === 'date') {
        if (key === 'gt') return 'is after';
        if (key === 'gte') return 'is on or after';
        if (key === 'lt') return 'is before';
        if (key === 'lte') return 'is on or before';
        if (key === 'eq') return 'is on';
    }
    return o.label;
}

// ── Serialisation: rows → expr ─────────────────────────
function leftFragment(fieldBinding) {
    if (!fieldBinding || typeof fieldBinding !== 'object') return String(fieldBinding || '').trim();
    if (fieldBinding.kind === 'ref') return String(fieldBinding.path || '').trim();
    if (fieldBinding.kind === 'expr') return String(fieldBinding.value || '').trim();
    if (fieldBinding.kind === 'literal') return renderBindingValue(fieldBinding);
    return '';
}

/** Serialise a single row to an expression fragment, or '' if incomplete. */
export function serializeRow(row) {
    if (!row) return '';
    const op = getOperator(row.op) || OP_BY_KEY.get('eq');
    const left = leftFragment(row.field);
    if (!left) return '';
    if (op.kind === 'unary') return op.emit(left);
    const rhs = renderBindingValue(row.value);
    if (op.kind === 'fn') return `${op.negate ? '!' : ''}${op.fn}(${left}, ${rhs})`;
    return `${left} ${op.symbol} ${rhs}`;
}

/**
 * Serialise rows to a single expression. Rows are joined by `join`
 * ('&&'|'||'); incomplete rows are dropped. Empty when nothing serialises.
 */
export function serializeRows(rows, join = '&&') {
    const j = join === '||' ? '||' : '&&';
    const frags = (rows || []).map(serializeRow).filter(Boolean);
    return frags.join(` ${j} `);
}

// ── Parsing: expr → rows ───────────────────────────────
/**
 * Split an expression on top-level `&&` or `||` (outside strings/parens).
 * Returns `{ parts, join }`, or null if BOTH joiners appear at top level
 * (mixed precedence — too ambiguous for the clickable UI).
 */
function splitTopLevel(expr) {
    const parts = [];
    let depth = 0;
    let str = null;
    let buf = '';
    let join = null;
    for (let i = 0; i < expr.length; i++) {
        const c = expr[i];
        if (str) {
            buf += c;
            if (c === '\\' && i + 1 < expr.length) { buf += expr[i + 1]; i++; continue; }
            if (c === str) str = null;
            continue;
        }
        if (c === '"' || c === "'") { str = c; buf += c; continue; }
        if (c === '(' || c === '[') { depth++; buf += c; continue; }
        if (c === ')' || c === ']') { depth--; buf += c; continue; }
        const two = expr.slice(i, i + 2);
        if (depth === 0 && (two === '&&' || two === '||')) {
            if (join && join !== two) return null; // mixed && and || at top level
            join = two;
            parts.push(buf.trim());
            buf = '';
            i++; // skip 2nd char
            continue;
        }
        buf += c;
    }
    if (str || depth !== 0) return null; // unbalanced
    parts.push(buf.trim());
    return { parts: parts.filter((p) => p.length), join: join || '&&' };
}

const SYMBOL_TO_KEY = { '==': 'eq', '!=': 'neq', '===': 'seq', '!==': 'sneq', '>=': 'gte', '<=': 'lte', '>': 'gt', '<': 'lt' };

/** Convert a raw right-hand-side token (`"file"`, `1000`, `steps.x.y`) to a binding. */
function valueRawToBinding(rawText) {
    const trimmed = String(rawText ?? '').trim();
    if (/^(true|false|null)$/.test(trimmed)) return { kind: 'literal', value: trimmed === 'null' ? null : trimmed === 'true' };
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return { kind: 'literal', value: Number(trimmed) };
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        try { return { kind: 'literal', value: JSON.parse(trimmed.replace(/'/g, '"')) }; }
        catch { return { kind: 'literal', value: trimmed.slice(1, -1) }; }
    }
    return bindingFromInput(trimmed, 'expression');
}

// Only a clean dotted/bracketed path is accepted as a parsed field. A left
// side that's an expression (function calls, `[*]` wildcards, arithmetic)
// returns null so the whole expr falls back to the raw textarea — where the
// user sees the real grammar and any server parse error. Live editing can
// still hold an expr-kind field (see leftFragment); the PARSER stays strict.
function fieldFromLeft(left) {
    const t = String(left || '').trim();
    // A `[*]` wildcard projects an ARRAY; comparing that to a scalar in a
    // single condition row isn't representable in the clickable builder, so
    // reject it here (it lands in raw mode) even though isCleanPath now treats
    // `[*]` as a valid ref path for binding fields elsewhere.
    if (t.includes('[*]')) return null;
    return isCleanPath(t) ? { kind: 'ref', path: t } : null;
}

// fn(LEFT, RHS) — LEFT and RHS contain no top-level comma in generated exprs.
const FN_RE = /^(contains|startsWith|endsWith)\(\s*([^,]+?)\s*,\s*(.+?)\s*\)$/;

/** Parse one fragment into a row, or null if it isn't a recognised shape. */
function parseFragment(part) {
    const text = part.trim();
    if (!text) return null;
    // !isEmpty(LEFT)
    let m = /^!\s*isEmpty\(\s*(.+?)\s*\)$/.exec(text);
    if (m) { const f = fieldFromLeft(m[1]); return f && { field: f, op: 'isNotEmpty', value: { kind: 'literal', value: '' } }; }
    // isEmpty(LEFT)
    m = /^isEmpty\(\s*(.+?)\s*\)$/.exec(text);
    if (m) { const f = fieldFromLeft(m[1]); return f && { field: f, op: 'isEmpty', value: { kind: 'literal', value: '' } }; }
    // !contains(LEFT, RHS) — the "does not contain" operator's emitted form.
    m = /^!\s*contains\(\s*([^,]+?)\s*,\s*(.+?)\s*\)$/.exec(text);
    if (m) { const f = fieldFromLeft(m[1]); return f && { field: f, op: 'notContains', value: valueRawToBinding(m[2]) }; }
    // contains/startsWith/endsWith(LEFT, RHS)
    m = FN_RE.exec(text);
    if (m) { const f = fieldFromLeft(m[2]); return f && { field: f, op: m[1], value: valueRawToBinding(m[3]) }; }
    // comparator: LEFT <op> RHS — reuse the symbol scan via a small parse.
    const cmp = parseComparator(text);
    if (cmp) {
        const f = fieldFromLeft(cmp.left);
        if (!f) return null;
        // `x == true` / `x == false` are the unary boolean forms.
        if (cmp.op === 'eq' && /^(true|false)$/.test(cmp.right)) {
            return { field: f, op: cmp.right === 'true' ? 'isTrue' : 'isFalse', value: { kind: 'literal', value: '' } };
        }
        return { field: f, op: cmp.op, value: valueRawToBinding(cmp.right) };
    }
    // Bare field, no operator at all (e.g. `steps.s1.output.results[*].to`,
    // saved as a plain truthy check) — `[*]` IS allowed here (unlike
    // fieldFromLeft's comparator/fn use): "is this array truthy" is a
    // meaningful whole-value check, unlike comparing an array with `>`/`==`.
    // Reserved literal words are NOT a field reference (a bare `true`/`false`
    // is a trivial "not configured yet" placeholder — ConditionBuilder
    // handles that case separately, opening an empty row instead).
    if (!/^(true|false|null)$/.test(text) && isCleanPath(text)) {
        return { field: { kind: 'ref', path: text }, op: 'truthy', value: { kind: 'literal', value: '' } };
    }
    return null;
}

const CMP_SYMBOLS = ['===', '!==', '==', '!=', '>=', '<=', '>', '<'];
function parseComparator(text) {
    for (const sym of CMP_SYMBOLS) {
        const idx = findTopLevelSymbol(text, sym);
        if (idx === -1) continue;
        const before = idx > 0 ? text[idx - 1] : ' ';
        const after = idx + sym.length < text.length ? text[idx + sym.length] : ' ';
        const opChars = new Set(['=', '!', '<', '>']);
        if (opChars.has(before) || opChars.has(after)) continue;
        const left = text.slice(0, idx).trim();
        const right = text.slice(idx + sym.length).trim();
        if (!left || !right) return null;
        return { left, op: SYMBOL_TO_KEY[sym], right };
    }
    return null;
}

function findTopLevelSymbol(text, sym) {
    let depth = 0;
    let str = null;
    for (let i = 0; i <= text.length - sym.length; i++) {
        const c = text[i];
        if (str) { if (c === '\\') { i++; continue; } if (c === str) str = null; continue; }
        if (c === '"' || c === "'") { str = c; continue; }
        if (c === '(' || c === '[') { depth++; continue; }
        if (c === ')' || c === ']') { depth--; continue; }
        if (depth === 0 && text.slice(i, i + sym.length) === sym) return i;
    }
    return -1;
}

/**
 * Parse an expression into `{ rows, join }` for the clickable builder, or null
 * if it doesn't fit the model (mixed joiners, unrecognised fragment, …) — the
 * caller then keeps the raw-expression textarea.
 */
export function parseExprToRows(expr) {
    if (typeof expr !== 'string' || !expr.trim()) return null;
    const split = splitTopLevel(expr.trim());
    if (!split) return null;
    const rows = [];
    for (const part of split.parts) {
        const row = parseFragment(part);
        if (!row) return null;
        rows.push(row);
    }
    if (!rows.length) return null;
    return { rows, join: split.join };
}

/** A blank row for the "add condition" affordance. */
export function emptyRow() {
    return { field: { kind: 'ref', path: '' }, op: 'eq', value: { kind: 'literal', value: '' } };
}
