/**
 * "Edit data" (set) — whole-table operations, the pure model.
 *
 * One home for the logic the operations editor, the canvas node and the
 * upstream describer all need, so the three can never disagree about what an
 * operation does to the table:
 *
 *   - SET_OP_DEFS        — the six ops with their friendly titles + defaults
 *   - columnsAfterOps    — which columns exist after the first N ops ran
 *                          (powers each op row's column picker + warnings)
 *   - applyOpsToSampleRow— the same fold applied to a sample element
 *                          (powers describeSet's design-time output shape)
 *   - describeSetOperation / summariseSetStep — one-line human labels
 *
 * Semantics mirror the runtime exactly (server engine.js applySetOperations):
 * ops run in listed order, AFTER the per-row fields overlay; column names are
 * top-level keys. Sort changes order only, so it's a no-op for both folds.
 */
import { humanizeFieldKey } from './displayHelpers';

export const SET_OP_DEFS = [
    {
        op: 'rowId',
        title: 'Number the rows',
        hint: 'Every row gets a number: 1, 2, 3, …',
        makeDefault: () => ({ op: 'rowId', target: 'id' }),
    },
    {
        op: 'groupId',
        title: 'Give matching rows a shared ID',
        hint: 'Rows with the same value(s) get the same number, in order of first appearance.',
        makeDefault: () => ({ op: 'groupId', target: 'groupId', keys: [] }),
    },
    {
        op: 'rename',
        title: 'Rename a field',
        hint: 'Give a column a new name.',
        makeDefault: () => ({ op: 'rename', from: '', to: '' }),
    },
    {
        op: 'keep',
        title: 'Keep only some fields',
        hint: 'Everything not listed is dropped from every row.',
        makeDefault: () => ({ op: 'keep', keys: [] }),
    },
    {
        op: 'remove',
        title: 'Remove fields',
        hint: 'Drop the listed columns from every row.',
        makeDefault: () => ({ op: 'remove', keys: [] }),
    },
    {
        op: 'sort',
        title: 'Sort the rows',
        hint: 'Numbers sort as numbers, text A→Z (case doesn’t matter); missing values go last.',
        makeDefault: () => ({ op: 'sort', key: '', direction: 'asc' }),
    },
];

export const SET_OP_TITLES = Object.fromEntries(SET_OP_DEFS.map(d => [d.op, d.title]));

const col = (k) => typeof k === 'string' && k.trim().length > 0;

/**
 * Fold the first `uptoIndex` operations over a starting column list. Powers
 * the column options each op row offers (an op sees the columns created by
 * the Fields section AND by every EARLIER op) and the "column exists"
 * warnings. Order-preserving, deduped.
 */
export function columnsAfterOps(baseColumns, ops, uptoIndex = Infinity) {
    let cols = [...new Set((baseColumns || []).filter(col))];
    const list = Array.isArray(ops) ? ops.slice(0, uptoIndex) : [];
    for (const o of list) {
        if (!o || typeof o !== 'object') continue;
        if ((o.op === 'rowId' || o.op === 'groupId') && col(o.target)) {
            if (!cols.includes(o.target)) cols.push(o.target);
        } else if (o.op === 'rename' && col(o.from) && col(o.to)) {
            cols = cols.map(c => (c === o.from ? o.to : c));
            cols = [...new Set(cols)];
        } else if (o.op === 'keep') {
            const keys = (o.keys || []).filter(col);
            if (keys.length) cols = cols.filter(c => keys.includes(c));
        } else if (o.op === 'remove') {
            const keys = new Set((o.keys || []).filter(col));
            if (keys.size) cols = cols.filter(c => !keys.has(c));
        }
        // sort: order only — column set unchanged
    }
    return cols;
}

/**
 * The same fold applied to ONE sample row (a plain object), so the describer
 * can show downstream steps the post-operations shape. rowId/groupId targets
 * become `1` — a truthful "this will be a number" sample.
 */
export function applyOpsToSampleRow(row, ops) {
    let out = { ...(row && typeof row === 'object' && !Array.isArray(row) ? row : {}) };
    for (const o of (Array.isArray(ops) ? ops : [])) {
        if (!o || typeof o !== 'object') continue;
        if ((o.op === 'rowId' || o.op === 'groupId') && col(o.target)) {
            out[o.target] = 1;
        } else if (o.op === 'rename' && col(o.from) && col(o.to) && o.from !== o.to) {
            if (o.from in out) { out[o.to] = out[o.from]; delete out[o.from]; }
        } else if (o.op === 'keep') {
            const keys = (o.keys || []).filter(col);
            if (keys.length) {
                const next = {};
                for (const k of keys) if (k in out) next[k] = out[k];
                out = next;
            }
        } else if (o.op === 'remove') {
            for (const k of (o.keys || []).filter(col)) delete out[k];
        }
    }
    return out;
}

/** One friendly line per operation — for op cards and the canvas node body. */
export function describeSetOperation(o) {
    if (!o || typeof o !== 'object') return '';
    const name = (k) => humanizeFieldKey(k);
    switch (o.op) {
        case 'rowId':
            return col(o.target) ? `number rows → ${name(o.target)}` : 'number rows';
        case 'groupId': {
            const keys = (o.keys || []).filter(col).map(name);
            return keys.length ? `shared ID by ${keys.join(' + ')}` : 'shared ID';
        }
        case 'rename':
            return col(o.from) && col(o.to) ? `rename ${name(o.from)} → ${name(o.to)}` : 'rename a field';
        case 'keep': {
            const n = (o.keys || []).filter(col).length;
            return n ? `keep ${n} field${n === 1 ? '' : 's'}` : 'keep fields';
        }
        case 'remove': {
            const n = (o.keys || []).filter(col).length;
            return n ? `remove ${n} field${n === 1 ? '' : 's'}` : 'remove fields';
        }
        case 'sort':
            return col(o.key) ? `sort by ${name(o.key)}${o.direction === 'desc' ? ' (high → low)' : ''}` : 'sort rows';
        default:
            return '';
    }
}

/**
 * The canvas node's body line. Single mode mirrors the original SetNode body
 * ("N fields: a, b, …"); list mode leads with the per-row work then up to two
 * operation labels.
 */
export function summariseSetStep(step) {
    if (!step) return '';
    const fieldKeys = Object.keys(step.fields || {});
    if (typeof step.arrayRef !== 'string') {
        if (fieldKeys.length === 0) return 'No fields yet';
        const shown = fieldKeys.slice(0, 4).map(humanizeFieldKey).join(', ');
        return `${fieldKeys.length} field${fieldKeys.length === 1 ? '' : 's'}: ${shown}${fieldKeys.length > 4 ? '…' : ''}`;
    }
    const parts = [];
    if (fieldKeys.length) parts.push(`+${fieldKeys.length} field${fieldKeys.length === 1 ? '' : 's'}`);
    const ops = (Array.isArray(step.operations) ? step.operations : []).map(describeSetOperation).filter(Boolean);
    parts.push(...ops.slice(0, 2));
    if (ops.length > 2) parts.push(`+${ops.length - 2} more`);
    if (!parts.length) return 'Nothing to do yet';
    return `Each row: ${parts.join(' · ')}`;
}
