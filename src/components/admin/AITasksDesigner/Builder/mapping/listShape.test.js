import { describe, it, expect } from 'vitest';
import {
    pathListShape, fieldListShape, splitColumnPath, forEachPickFor,
    bindingsForList, previewForEachPick, expectedShapeFor,
} from './listShape';
import { EXPR_FUNCTION_NAMES } from '@shared/expr/engine.mjs';
import { compile } from '@shared/expr/engine.mjs';

/**
 * The list vocabulary must agree with the RUNTIME, not with the pickers'
 * habits: counts come from walkPath (the bind.js mirror), and every emitted
 * binding uses only whitelisted engine functions — a chooser that writes an
 * expression the server rejects would recreate the exact silent failure it
 * exists to prevent.
 */
const ROOT = {
    steps: {
        g: {
            output: {
                results: [
                    { subject: 'A', attachments: [{ filename: 'a1.pdf' }, { filename: 'a2.pdf' }] },
                    { subject: 'B', attachments: [{ filename: 'b1.pdf' }] },
                ],
                total: 2,
                note: 'plain text',
            },
        },
    },
};

describe('pathListShape', () => {
    it('a path AT an array is a list, with the real count and kind', () => {
        const s = pathListShape('steps.g.output.results', ROOT);
        expect(s.kind).toBe('list');
        expect(s.count).toBe(2);
        expect(s.of).toBe('records');
        expect(s.rowScopedListTail).toBe(false);
    });

    it('a [*] path is a column, counting the FLATTENED total, not the first element', () => {
        const s = pathListShape('steps.g.output.results[*].subject', ROOT);
        expect(s.kind).toBe('column');
        expect(s.rows).toBe(2);
        expect(s.count).toBe(2);
        expect(s.rowScopedListTail).toBe(false);
    });

    it('a column whose per-row value is itself a list says so — repeating over it merges rows', () => {
        const s = pathListShape('steps.g.output.results[*].attachments', ROOT);
        expect(s.kind).toBe('column');
        expect(s.rows).toBe(2);
        // 2 + 1 attachments — the flatten the runtime performs.
        expect(s.count).toBe(3);
        expect(s.rowScopedListTail).toBe(true);
    });

    it('scalars and unresolvable paths are NOT lists', () => {
        expect(pathListShape('steps.g.output.note', ROOT)).toBeNull();
        expect(pathListShape('steps.g.output.total', ROOT)).toBeNull();
        expect(pathListShape('steps.missing.output', ROOT)).toBeNull();
        expect(pathListShape('', ROOT)).toBeNull();
        expect(pathListShape('steps.g.output.results', null)).toBeNull();
    });
});

describe('fieldListShape', () => {
    it('falls back to the design-time sample, without inventing a count', () => {
        const s = fieldListShape({ key: 'rows', path: 'steps.x.output.rows', sample: [{ a: 1 }] }, {});
        expect(s.kind).toBe('list');
        // A placeholder sample's length is not a fact about real data.
        expect(s.count).toBeNull();
    });

    it('stays null for scalar fields', () => {
        expect(fieldListShape({ key: 'note', path: 'steps.g.output.note', sample: 'x' }, ROOT)).toBeNull();
    });
});

describe('splitColumnPath', () => {
    it('splits on the FIRST [*] and keeps the tail verbatim', () => {
        expect(splitColumnPath('steps.g.output.results[*].subject'))
            .toEqual({ arrayPath: 'steps.g.output.results', tail: '.subject' });
        // Bracket-quoted keys survive re-assembly untouched.
        expect(splitColumnPath('steps.g.output.rows[*]["content-type"]'))
            .toEqual({ arrayPath: 'steps.g.output.rows', tail: '["content-type"]' });
        // Only the first wildcard splits — the rest belongs to the row scope.
        expect(splitColumnPath('steps.g.output.rows[*].files[*].name'))
            .toEqual({ arrayPath: 'steps.g.output.rows', tail: '.files[*].name' });
    });
});

describe('forEachPickFor', () => {
    it('a column becomes forEach over the base array + a row-scoped binding', () => {
        const pick = forEachPickFor('steps.g.output.results[*].subject', ROOT);
        expect(pick.forEach).toEqual({ overRef: 'steps.g.output.results', itemVar: 'result', maxIterations: 100 });
        expect(pick.binding).toEqual({ kind: 'ref', path: 'loop.result.subject' });
    });

    it('a plain list binds the whole current item', () => {
        const pick = forEachPickFor('steps.g.output.results', ROOT);
        expect(pick.forEach.overRef).toBe('steps.g.output.results');
        expect(pick.binding).toEqual({ kind: 'ref', path: `loop.${pick.itemVar}` });
    });
});

describe('bindingsForList', () => {
    const B = bindingsForList('steps.g.output.results[*].subject', { separator: ', ' });

    it('`each` is a bare ref — NEVER a template (bind.js would stringify the array)', () => {
        expect(B.each).toEqual({ kind: 'ref', path: 'steps.g.output.results[*].subject' });
    });

    it('every expression uses only whitelisted engine functions and compiles', () => {
        const names = new Set(EXPR_FUNCTION_NAMES);
        for (const key of ['first', 'last', 'join', 'count']) {
            const src = B[key].value;
            const fn = src.slice(0, src.indexOf('('));
            expect(names.has(fn), `${fn} must be whitelisted`).toBe(true);
            expect(() => compile(src)).not.toThrow();
        }
    });

    it('join separators round-trip through engine escaping — quotes, newlines, backslashes', () => {
        for (const sep of [', ', '\n', '\t', '"', "'", '\\', 'a"b\'c\\d']) {
            const { join } = bindingsForList('steps.g.output.results', { separator: sep });
            expect(() => compile(join.value)).not.toThrow();
        }
    });
});

describe('previewForEachPick', () => {
    it('answers what the FIRST iteration would see', () => {
        expect(previewForEachPick('steps.g.output.results[*].subject', ROOT)).toBe('A');
        expect(previewForEachPick('steps.g.output.results', ROOT)).toEqual(ROOT.steps.g.output.results[0]);
        expect(previewForEachPick('steps.missing[*].x', ROOT)).toBeUndefined();
    });
});

describe('expectedShapeFor', () => {
    it('maps JSON-schema types to the chooser vocabulary', () => {
        expect(expectedShapeFor({ type: 'string' })).toBe('scalar');
        expect(expectedShapeFor({ type: 'integer' })).toBe('scalar');
        expect(expectedShapeFor({ type: 'array' })).toBe('list');
        expect(expectedShapeFor({ type: ['null', 'number'] })).toBe('scalar');
        expect(expectedShapeFor({ type: 'object' })).toBe('unknown');
        // No schema (custom rows, App Studio) → 'unknown' → the chooser
        // never fires there. Load-bearing for backwards compatibility.
        expect(expectedShapeFor(undefined)).toBe('unknown');
        expect(expectedShapeFor(null)).toBe('unknown');
    });
});
