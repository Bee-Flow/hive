import { describe, it, expect } from 'vitest';
import {
    SET_OP_DEFS, columnsAfterOps, applyOpsToSampleRow, describeSetOperation, summariseSetStep,
} from './setOperations';

/**
 * The pure model behind "Edit data"'s table operations. The editor's column
 * pickers, the canvas summary and the upstream describer all fold through
 * here — these tests pin that the fold matches the runtime's semantics.
 */

describe('SET_OP_DEFS', () => {
    it('covers exactly the six runtime ops, each with a working default', () => {
        expect(SET_OP_DEFS.map(d => d.op)).toEqual(['rowId', 'groupId', 'rename', 'keep', 'remove', 'sort']);
        for (const d of SET_OP_DEFS) {
            expect(d.makeDefault().op).toBe(d.op);
            expect(d.title.length).toBeGreaterThan(0);
        }
    });
});

describe('columnsAfterOps', () => {
    const base = ['to', 'subject', 'body'];

    it('adds rowId/groupId targets and follows renames', () => {
        expect(columnsAfterOps(base, [
            { op: 'rowId', target: 'id' },
            { op: 'rename', from: 'subject', to: 'title' },
        ])).toEqual(['to', 'title', 'body', 'id']);
    });

    it('keep filters, remove drops, sort changes nothing', () => {
        expect(columnsAfterOps(base, [{ op: 'keep', keys: ['to', 'subject'] }])).toEqual(['to', 'subject']);
        expect(columnsAfterOps(base, [{ op: 'remove', keys: ['body'] }])).toEqual(['to', 'subject']);
        expect(columnsAfterOps(base, [{ op: 'sort', key: 'to' }])).toEqual(base);
    });

    it('an op only sees EARLIER ops via uptoIndex', () => {
        const ops = [{ op: 'rowId', target: 'id' }, { op: 'keep', keys: ['id'] }];
        expect(columnsAfterOps(base, ops, 0)).toEqual(base);
        expect(columnsAfterOps(base, ops, 1)).toEqual([...base, 'id']);
        expect(columnsAfterOps(base, ops, 2)).toEqual(['id']);
    });

    it('ignores half-configured rows instead of corrupting the list', () => {
        expect(columnsAfterOps(base, [
            { op: 'rowId', target: '' },
            { op: 'rename', from: 'subject', to: '' },
            { op: 'keep', keys: [] },
            null,
        ])).toEqual(base);
    });
});

describe('applyOpsToSampleRow', () => {
    it('mirrors the runtime fold on one sample row', () => {
        const row = { to: 'a@b.com', subject: 'Hi', body: 'x' };
        expect(applyOpsToSampleRow(row, [
            { op: 'rowId', target: 'id' },
            { op: 'groupId', target: 'thread', keys: ['to'] },
            { op: 'rename', from: 'subject', to: 'title' },
            { op: 'remove', keys: ['body'] },
        ])).toEqual({ to: 'a@b.com', title: 'Hi', id: 1, thread: 1 });
    });

    it('keep projects; a non-object sample yields the added columns only', () => {
        expect(applyOpsToSampleRow({ a: 1, b: 2 }, [{ op: 'keep', keys: ['a'] }])).toEqual({ a: 1 });
        expect(applyOpsToSampleRow('scalar', [{ op: 'rowId', target: 'id' }])).toEqual({ id: 1 });
    });

    it('never mutates the input row', () => {
        const row = { a: 1 };
        applyOpsToSampleRow(row, [{ op: 'remove', keys: ['a'] }]);
        expect(row).toEqual({ a: 1 });
    });
});

describe('describeSetOperation', () => {
    it('reads as plain English with humanised field names', () => {
        expect(describeSetOperation({ op: 'rowId', target: 'rowId' })).toBe('number rows → Row id');
        expect(describeSetOperation({ op: 'groupId', target: 't', keys: ['to', 'subject'] })).toBe('shared ID by To + Subject');
        expect(describeSetOperation({ op: 'rename', from: 'from_email', to: 'sender' })).toBe('rename From email → Sender');
        expect(describeSetOperation({ op: 'keep', keys: ['a', 'b'] })).toBe('keep 2 fields');
        expect(describeSetOperation({ op: 'remove', keys: ['a'] })).toBe('remove 1 field');
        expect(describeSetOperation({ op: 'sort', key: 'date', direction: 'desc' })).toBe('sort by Date (high → low)');
    });

    it('half-configured ops still name themselves', () => {
        expect(describeSetOperation({ op: 'groupId', target: '', keys: [] })).toBe('shared ID');
        expect(describeSetOperation({ op: 'sort' })).toBe('sort rows');
        expect(describeSetOperation({ op: 'unknown' })).toBe('');
    });
});

describe('summariseSetStep', () => {
    it('single mode keeps the classic fields line', () => {
        expect(summariseSetStep({ type: 'set' })).toBe('No fields yet');
        expect(summariseSetStep({ type: 'set', fields: { customer_name: { kind: 'literal', value: 'x' } } }))
            .toBe('1 field: Customer name');
    });

    it('list mode leads with the per-row work, capping at two op labels', () => {
        const step = {
            type: 'set', arrayRef: 'steps.g.output.items',
            fields: { a: {}, b: {} },
            operations: [
                { op: 'rowId', target: 'id' },
                { op: 'groupId', target: 'g', keys: ['to'] },
                { op: 'sort', key: 'id' },
            ],
        };
        expect(summariseSetStep(step)).toBe('Each row: +2 fields · number rows → Id · shared ID by To · +1 more');
        expect(summariseSetStep({ type: 'set', arrayRef: '' })).toBe('Nothing to do yet');
    });
});
