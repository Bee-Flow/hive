import { describe, it, expect } from 'vitest';
import {
    inferType,
    operatorsForType,
    isUnaryOp,
    serializeRows,
    serializeRow,
    parseExprToRows,
    emptyRow,
} from './conditionModel';

/**
 * The condition model powers the clickable Filter / Condition / Switch
 * builder. The critical invariant is that it serialises to — and parses
 * back from — the exact restricted-JS `expr` string the server evaluates.
 */
describe('inferType', () => {
    it('classifies primitives, arrays, objects and ISO dates', () => {
        expect(inferType(5)).toBe('number');
        expect(inferType('hi')).toBe('string');
        expect(inferType(true)).toBe('boolean');
        expect(inferType([1, 2])).toBe('array');
        expect(inferType({ a: 1 })).toBe('object');
        expect(inferType('2026-06-30T10:00')).toBe('date');
        expect(inferType('2026-06-30')).toBe('date');
        expect(inferType(null)).toBe('unknown');
        expect(inferType(undefined)).toBe('unknown');
    });
});

describe('operatorsForType', () => {
    it('offers text helpers for strings and numeric comparators for numbers', () => {
        const str = operatorsForType('string').map((o) => o.key);
        expect(str).toContain('contains');
        expect(str).toContain('startsWith');
        expect(str).not.toContain('gt');

        const num = operatorsForType('number').map((o) => o.key);
        expect(num).toContain('gt');
        expect(num).not.toContain('contains');
    });

    it('relabels comparators as before/after for dates', () => {
        const labels = Object.fromEntries(operatorsForType('date').map((o) => [o.key, o.label]));
        expect(labels.gt).toBe('is after');
        expect(labels.lt).toBe('is before');
    });

    it('always keeps the current operator selectable (round-trip safety)', () => {
        // === is hidden from the friendly menu but must stay if already used.
        const keys = operatorsForType('string', 'seq').map((o) => o.key);
        expect(keys).toContain('seq');
    });
});

describe('isUnaryOp', () => {
    it('marks isEmpty / isTrue as unary (no value input)', () => {
        expect(isUnaryOp('isEmpty')).toBe(true);
        expect(isUnaryOp('isNotEmpty')).toBe(true);
        expect(isUnaryOp('isTrue')).toBe(true);
        expect(isUnaryOp('eq')).toBe(false);
        expect(isUnaryOp('contains')).toBe(false);
    });
});

describe('serializeRow', () => {
    it('serialises comparators, helpers and unary ops', () => {
        const ref = (path) => ({ kind: 'ref', path });
        const lit = (value) => ({ kind: 'literal', value });
        expect(serializeRow({ field: ref('item.amount'), op: 'gt', value: lit(1000) })).toBe('item.amount > 1000');
        expect(serializeRow({ field: ref('item.name'), op: 'eq', value: lit('file') })).toBe('item.name == "file"');
        expect(serializeRow({ field: ref('item.name'), op: 'contains', value: lit('.pdf') })).toBe('contains(item.name, ".pdf")');
        expect(serializeRow({ field: ref('item.tags'), op: 'isEmpty' })).toBe('isEmpty(item.tags)');
        expect(serializeRow({ field: ref('item.tags'), op: 'isNotEmpty' })).toBe('!isEmpty(item.tags)');
        expect(serializeRow({ field: ref('item.done'), op: 'isTrue' })).toBe('item.done == true');
    });

    it('drops a row with no field', () => {
        expect(serializeRow({ field: { kind: 'ref', path: '' }, op: 'eq', value: { kind: 'literal', value: 'x' } })).toBe('');
    });
});

describe('serializeRows + parseExprToRows round-trip', () => {
    const exprs = [
        'steps.s1.output.amount == 1000',
        'steps.s1.output.amount > 1000',
        'contains(item.name, "file")',
        'startsWith(steps.s1.output.title, "Re:")',
        'isEmpty(item.tags)',
        '!isEmpty(item.name)',
        'item.done == true',
        'steps.a.output.x == 1 && contains(item.name, ".pdf")',
        'item.a == 1 || item.b == 2',
    ];
    for (const expr of exprs) {
        it(`round-trips: ${expr}`, () => {
            const parsed = parseExprToRows(expr);
            expect(parsed).not.toBeNull();
            expect(serializeRows(parsed.rows, parsed.join)).toBe(expr);
        });
    }

    it('bails (null) on mixed && / || so the caller keeps raw mode', () => {
        expect(parseExprToRows('a == 1 && b == 2 || c == 3')).toBeNull();
    });

    it('bails on a non-clean left (e.g. [*] wildcard) so it lands in raw mode', () => {
        expect(parseExprToRows('steps.s1.output.items[*].type == "file"')).toBeNull();
    });

    it('bails on grammar with no top-level comparator (e.g. a ternary)', () => {
        expect(parseExprToRows('steps.x.output.flag ? 1 : 2')).toBeNull();
    });

    it('preserves the AND/OR join', () => {
        expect(parseExprToRows('a == 1 && b == 2').join).toBe('&&');
        expect(parseExprToRows('a == 1 || b == 2').join).toBe('||');
    });
});

describe('truthy operator — "has a value" for a bare field with no comparison', () => {
    it('is offered in every TYPE_OPS list', () => {
        for (const type of ['string', 'number', 'boolean', 'date', 'array', 'object', 'unknown']) {
            expect(operatorsForType(type).map((o) => o.key)).toContain('truthy');
        }
    });

    it('is unary (no value input)', () => {
        expect(isUnaryOp('truthy')).toBe(true);
    });

    it('serializes to the bare left fragment verbatim', () => {
        const ref = (path) => ({ kind: 'ref', path });
        expect(serializeRow({ field: ref('steps.a.output.to'), op: 'truthy' })).toBe('steps.a.output.to');
    });

    it('parses a bare path with no operator at all as a truthy row', () => {
        const parsed = parseExprToRows('steps.a_af2f5b.output.results.to');
        expect(parsed).not.toBeNull();
        expect(parsed.rows).toHaveLength(1);
        expect(parsed.rows[0]).toEqual({ field: { kind: 'ref', path: 'steps.a_af2f5b.output.results.to' }, op: 'truthy', value: { kind: 'literal', value: '' } });
    });

    it('parses a bare path WITH a [*] wildcard as truthy (unlike comparator/fn left sides, which reject it)', () => {
        const expr = 'steps.a_af2f5b.output.results[*].to';
        const parsed = parseExprToRows(expr);
        expect(parsed).not.toBeNull();
        expect(parsed.rows[0].op).toBe('truthy');
        expect(serializeRows(parsed.rows, parsed.join)).toBe(expr);
    });

    it('does NOT treat a bare true/false/null literal as a truthy field reference', () => {
        expect(parseExprToRows('true')).toBeNull();
        expect(parseExprToRows('false')).toBeNull();
        expect(parseExprToRows('null')).toBeNull();
    });

    it('round-trips through serializeRows unchanged', () => {
        const expr = 'trigger.output.subject';
        const parsed = parseExprToRows(expr);
        expect(serializeRows(parsed.rows, parsed.join)).toBe(expr);
    });
});

describe('emptyRow', () => {
    it('is a blank equals row', () => {
        const r = emptyRow();
        expect(r.op).toBe('eq');
        expect(r.field.kind).toBe('ref');
        expect(serializeRow(r)).toBe('');
    });
});

describe('does not contain', () => {
    const ref = (path) => ({ kind: 'ref', path });
    const lit = (value) => ({ kind: 'literal', value });

    it('serialises as a negated contains call', () => {
        expect(serializeRow({ field: ref('item.name'), op: 'notContains', value: lit('.pdf') }))
            .toBe('!contains(item.name, ".pdf")');
    });

    it('parses back into the notContains row (round-trip)', () => {
        const expr = '!contains(item.name, ".pdf")';
        const parsed = parseExprToRows(expr);
        expect(parsed.rows).toEqual([
            { field: { kind: 'ref', path: 'item.name' }, op: 'notContains', value: { kind: 'literal', value: '.pdf' } },
        ]);
        expect(serializeRows(parsed.rows, parsed.join)).toBe(expr);
    });

    it('is offered for strings and arrays, right after contains', () => {
        for (const type of ['string', 'array', 'unknown']) {
            const keys = operatorsForType(type).map(o => o.key);
            expect(keys.indexOf('notContains')).toBe(keys.indexOf('contains') + 1);
        }
        expect(operatorsForType('number').map(o => o.key)).not.toContain('notContains');
    });
});
