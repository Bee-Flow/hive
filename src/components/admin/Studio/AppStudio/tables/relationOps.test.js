import { describe, expect, it } from 'vitest';
import {
    addRelation, fillersOfRelation, layoutTables, relationKeyFor,
    relationsOf, removeRelation, renameRelation, retargetRelation,
} from './relationOps';

/**
 * The link between two tables is a `relation` FIELD, not an object of its own —
 * these are the transforms the Relationships canvas runs on model.tables, tested
 * without the canvas so a layout change can never quietly break the model edits.
 */

const messages = () => ({
    id: 'tbl_msg', key: 'messages', name: 'Messages',
    fields: [{ id: 'fld_a1b2c3', key: 'subject', name: 'subject', type: 'text' }],
});
const attachments = () => ({
    id: 'tbl_att', key: 'attachments', name: 'Attachments',
    fields: [{ id: 'fld_d4e5f6', key: 'filename', name: 'filename', type: 'text' }],
});

describe('addRelation', () => {
    it('adds the relation column to the table that HOLDS it — the many side', () => {
        const { tables, error } = addRelation([messages(), attachments()], {
            fromTableId: 'tbl_att', toTableId: 'tbl_msg',
        });
        expect(error).toBeUndefined();
        expect(tables[0].fields).toHaveLength(1);           // Messages untouched
        const added = tables[1].fields.at(-1);
        expect(added.type).toBe('relation');
        expect(added.relation).toEqual({ table: 'tbl_msg' });
        expect(added.key).toBe('messages_ref');
        expect(added.name).toBe('Messages record');
        expect(added.id).toMatch(/^fld_[0-9a-f]{4,}$/);
    });

    it('refuses a second link between the same two tables', () => {
        const first = addRelation([messages(), attachments()], { fromTableId: 'tbl_att', toTableId: 'tbl_msg' });
        const second = addRelation(first.tables, { fromTableId: 'tbl_att', toTableId: 'tbl_msg' });
        expect(second.error).toMatch(/already links/i);
        expect(second.tables).toBe(first.tables);
    });

    it('leaves the model alone when a table is gone', () => {
        const input = [messages()];
        const { tables, error } = addRelation(input, { fromTableId: 'tbl_att', toTableId: 'tbl_msg' });
        expect(error).toBeTruthy();
        expect(tables).toBe(input);
    });
});

describe('relationKeyFor', () => {
    it('steps around a column key the table already uses', () => {
        const t = { ...attachments(), fields: [{ id: 'f1', key: 'messages_ref', name: 'x', type: 'text' }] };
        expect(relationKeyFor(t, messages())).toBe('messages_ref_2');
    });

    it('never mints a server-managed column', () => {
        // A table keyed `org` would otherwise produce `org_ref`… but one keyed so
        // the ref lands on a system column must still be legal.
        const target = { id: 'tbl_x', key: 'id', name: 'Id' };
        expect(['id', 'created_at', 'updated_at', 'created_by', 'org_id'])
            .not.toContain(relationKeyFor(attachments(), target));
    });
});

describe('relationsOf', () => {
    it('reports each relation as an edge from holder to target', () => {
        const { tables } = addRelation([messages(), attachments()], { fromTableId: 'tbl_att', toTableId: 'tbl_msg' });
        const [edge] = relationsOf(tables);
        expect(edge.fromTableId).toBe('tbl_att');
        expect(edge.toTableId).toBe('tbl_msg');
        expect(edge.dangling).toBe(false);
    });

    it('still reports a relation whose target was deleted — that is when it matters', () => {
        const { tables } = addRelation([messages(), attachments()], { fromTableId: 'tbl_att', toTableId: 'tbl_msg' });
        const [edge] = relationsOf(tables.filter((t) => t.id !== 'tbl_msg'));
        expect(edge.dangling).toBe(true);
    });
});

describe('editing a relation', () => {
    const linked = () => addRelation([messages(), attachments()], {
        fromTableId: 'tbl_att', toTableId: 'tbl_msg',
    }).tables;

    it('retargets without touching the column key', () => {
        const tables = [...linked(), { id: 'tbl_thr', key: 'threads', name: 'Threads', fields: [] }];
        const edge = relationsOf(tables)[0];
        const next = retargetRelation(tables, { tableId: edge.fromTableId, fieldId: edge.fieldId, toTableId: 'tbl_thr' });
        const [after] = relationsOf(next);
        expect(after.toTableId).toBe('tbl_thr');
        expect(after.fieldKey).toBe('messages_ref');
    });

    it('renames the display name only', () => {
        const tables = linked();
        const edge = relationsOf(tables)[0];
        const next = renameRelation(tables, { tableId: edge.fromTableId, fieldId: edge.fieldId, name: 'Its message' });
        expect(relationsOf(next)[0].fieldName).toBe('Its message');
        expect(relationsOf(next)[0].fieldKey).toBe('messages_ref');
    });

    it('removes the column, and nothing else', () => {
        const tables = linked();
        const edge = relationsOf(tables)[0];
        const next = removeRelation(tables, { tableId: edge.fromTableId, fieldId: edge.fieldId });
        expect(relationsOf(next)).toHaveLength(0);
        expect(next.find((t) => t.id === 'tbl_att').fields.map((f) => f.key)).toEqual(['filename']);
    });
});

describe('fillersOfRelation', () => {
    // Deleting a link a connector writes on every refresh would fail the whole
    // save with a 422 — the caller names the connector instead.
    const connectors = [{
        id: 'conn_1', name: 'Gmail',
        sync: { tableId: 'tbl_msg', children: [{ tableId: 'tbl_att', relationField: 'messages_ref' }] },
    }];

    it('finds the connector that fills the link', () => {
        expect(fillersOfRelation(connectors, 'tbl_att', 'messages_ref').map((c) => c.name)).toEqual(['Gmail']);
    });

    it('says nothing about a link nobody fills', () => {
        expect(fillersOfRelation(connectors, 'tbl_att', 'threads_ref')).toEqual([]);
        expect(fillersOfRelation(undefined, 'tbl_att', 'messages_ref')).toEqual([]);
    });
});

describe('layoutTables', () => {
    it('puts a child below its parent', () => {
        const { tables } = addRelation([messages(), attachments()], { fromTableId: 'tbl_att', toTableId: 'tbl_msg' });
        const pos = layoutTables(tables);
        expect(pos.tbl_att.y).toBeGreaterThan(pos.tbl_msg.y);
    });

    it('uses the LONGEST path so a chain reads top to bottom', () => {
        // messages ← content ← attachments, where attachments also links straight
        // back to messages. Depth must follow the long way round.
        let tables = [messages(), { id: 'tbl_cnt', key: 'content', name: 'Content', fields: [] }, attachments()];
        tables = addRelation(tables, { fromTableId: 'tbl_cnt', toTableId: 'tbl_msg' }).tables;
        tables = addRelation(tables, { fromTableId: 'tbl_att', toTableId: 'tbl_cnt' }).tables;
        tables = addRelation(tables, { fromTableId: 'tbl_att', toTableId: 'tbl_msg' }).tables;
        const pos = layoutTables(tables);
        expect(pos.tbl_cnt.y).toBeGreaterThan(pos.tbl_msg.y);
        expect(pos.tbl_att.y).toBeGreaterThan(pos.tbl_cnt.y);
    });

    it('survives a cycle instead of recursing forever', () => {
        let tables = [messages(), attachments()];
        tables = addRelation(tables, { fromTableId: 'tbl_att', toTableId: 'tbl_msg' }).tables;
        tables = addRelation(tables, { fromTableId: 'tbl_msg', toTableId: 'tbl_att' }).tables;
        expect(Object.keys(layoutTables(tables))).toHaveLength(2);
    });
});
