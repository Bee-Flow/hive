import { describe, it, expect } from 'vitest';
import { buildValue, describeDataPath, isDataPath, parseValue } from './valueParts';

/**
 * The visual value model is only trustworthy if it round-trips: whatever a
 * saved routine holds must come back out of the editor unchanged unless the
 * user actually changed it. Everything this module reports as `supported` is
 * therefore checked binding -> parts -> binding here.
 */

const roundTrip = (binding) => {
    const p = parseValue(binding);
    expect(p.supported).toBe(true);
    return buildValue(p.parts, p.transform);
};

describe('parseValue / buildValue', () => {
    it('an empty value is no parts at all', () => {
        for (const b of [null, undefined, { kind: 'literal', value: '' }, { kind: 'ref', path: '' }]) {
            expect(parseValue(b)).toMatchObject({ supported: true, parts: [] });
        }
        expect(buildValue([])).toEqual({ kind: 'literal', value: '' });
    });

    it('plain text round-trips as a literal, spaces intact', () => {
        const b = { kind: 'literal', value: 'Order  ' };
        expect(parseValue(b).parts).toEqual([{ type: 'text', text: 'Order  ' }]);
        expect(roundTrip(b)).toEqual(b);
    });

    it('a picked step value round-trips as a ref', () => {
        const b = { kind: 'ref', path: 'steps.g.output.total' };
        expect(parseValue(b).parts).toEqual([{ type: 'data', path: 'steps.g.output.total' }]);
        expect(roundTrip(b)).toEqual(b);
    });

    it('a row path round-trips as the expr the rest of the editor writes', () => {
        const b = { kind: 'expr', value: 'item.from_email' };
        expect(parseValue(b).parts).toEqual([{ type: 'data', path: 'item.from_email' }]);
        expect(roundTrip(b)).toEqual(b);
    });

    it('a one-call transform is a data part plus a transform, not a formula', () => {
        const b = { kind: 'expr', value: 'lower(item.email)' };
        const p = parseValue(b);
        expect(p).toMatchObject({ supported: true, transform: 'lower' });
        expect(p.parts).toEqual([{ type: 'data', path: 'item.email' }]);
        expect(roundTrip(b)).toEqual(b);
    });

    it('a template of text + data round-trips verbatim', () => {
        const b = { kind: 'template', value: 'Order {{item.id}} for {{trigger.name}}' };
        expect(parseValue(b).parts).toEqual([
            { type: 'text', text: 'Order ' },
            { type: 'data', path: 'item.id' },
            { type: 'text', text: ' for ' },
            { type: 'data', path: 'trigger.name' },
        ]);
        expect(roundTrip(b)).toEqual(b);
    });

    it('a "Pick fields from it" field is a chip, not an opaque formula', () => {
        const b = { kind: 'expr', value: 'parseJson(item.body, "order.total")' };
        expect(parseValue(b).parts).toEqual([{ type: 'json', path: 'item.body', jsonPath: 'order.total' }]);
        expect(roundTrip(b)).toEqual(b);
        // Whole-document parse, and a path holding a double quote flips the
        // quoting (the grammar has no escapes).
        expect(roundTrip({ kind: 'expr', value: 'parseJson(item.body)' })).toEqual({ kind: 'expr', value: 'parseJson(item.body)' });
        expect(buildValue([{ type: 'json', path: 'item.body', jsonPath: 'a"b' }]))
            .toEqual({ kind: 'expr', value: "parseJson(item.body, 'a\"b')" });
    });

    it('leaves hand-written work alone instead of rewriting it', () => {
        for (const b of [
            { kind: 'expr', value: 'concat(item.a, item.b)' },          // not a single call on a path
            { kind: 'expr', value: 'parseJson(item.body, lower(x))' },  // computed argument
            { kind: 'expr', value: 'item.a > 3' },
            { kind: 'template', value: 'Total: {{ lower(item.x) }}' },  // computed interpolation
            { kind: 'literal', value: { a: 1 } },                       // object literal
        ]) {
            expect(parseValue(b).supported).toBe(false);
        }
    });

    it('a transform only survives on a single picked value', () => {
        const parts = [{ type: 'text', text: 'a' }, { type: 'data', path: 'item.b' }];
        expect(buildValue(parts, 'lower')).toEqual({ kind: 'template', value: 'a{{item.b}}' });
    });

    it('drops empty parts so a half-built value never writes junk', () => {
        expect(buildValue([{ type: 'text', text: '' }, { type: 'data', path: 'item.a' }]))
            .toEqual({ kind: 'expr', value: 'item.a' });
        expect(buildValue([{ type: 'data', path: '' }])).toEqual({ kind: 'literal', value: '' });
    });

    it('only pickable roots count as data — secrets are never a chip', () => {
        expect(isDataPath('steps.a.output.x')).toBe(true);
        expect(isDataPath('item')).toBe(true);
        expect(isDataPath('_index')).toBe(true);
        expect(isDataPath('secrets.token')).toBe(false);
        expect(isDataPath('hello world')).toBe(false);
        expect(isDataPath('lower(item.x)')).toBe(false);
    });
});

describe('describeDataPath', () => {
    const labels = new Map([['act_4d4307a', 'gmail search']]);

    it('names the step and humanises the field — never the internal id', () => {
        const d = describeDataPath('steps.act_4d4307a.output.total', labels);
        expect(d).toMatchObject({ name: 'gmail search', suffix: 'Total', missing: false, source: 'steps' });
    });

    it('falls back to a neutral name when the step id is unknown', () => {
        const d = describeDataPath('steps.act_4d4307a.output.total', new Map());
        expect(d.name).toBe('Previous step');
        expect(d.name).not.toMatch(/act_/);
    });

    it('reads the row scope in the user’s words', () => {
        expect(describeDataPath('item.from_email')).toMatchObject({ name: 'Current row', suffix: 'From email' });
        expect(describeDataPath('item')).toMatchObject({ name: 'Current row', suffix: '' });
        expect(describeDataPath('_index')).toMatchObject({ name: 'Row number' });
    });

    it('drops indexes and wildcards from the shown field name', () => {
        expect(describeDataPath('trigger.results[*].from_email')).toMatchObject({
            name: 'Trigger', suffix: 'From email',
        });
    });

    it('names variables and the loop item', () => {
        expect(describeDataPath('vars.customer_id')).toMatchObject({ name: 'Variable', suffix: 'Customer id' });
        expect(describeDataPath('loop.row.subject')).toMatchObject({ name: 'Loop item · row', suffix: 'Subject' });
    });
});
