import { describe, it, expect } from 'vitest';
import { buildFormForTable, buildGridForTable } from './generators';
import { collectIds, ID_RE } from './definitionOps';
import { APP_COMPONENT_TYPES } from '../runtime/componentRegistry';

// A table exercising every writable field type + a computed (read-only) field.
const TABLE = {
    id: 'tbl_abc123',
    key: 'invoices',
    name: 'Invoices',
    fields: [
        { id: 'fld_001', key: 'title', name: 'Title', type: 'text', required: true },
        { id: 'fld_002', key: 'amount', name: 'Amount', type: 'number' },
        { id: 'fld_003', key: 'due', name: 'Due date', type: 'date' },
        { id: 'fld_004', key: 'when', name: 'When', type: 'datetime' },
        { id: 'fld_005', key: 'paid', name: 'Paid', type: 'bool' },
        { id: 'fld_006', key: 'status', name: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, 'closed'] },
        { id: 'fld_007', key: 'customer', name: 'Customer', type: 'relation', relation: { table: 'tbl_cust1' } },
        { id: 'fld_008', key: 'total', name: 'Total', type: 'computed', computed: { expr: 'amount' } },
    ],
};

const WRITABLE_COUNT = 7; // everything except the computed field

const DATA_GRID_FORMATS = new Set(['text', 'number', 'date', 'badge', 'link', 'boolean', 'relation']);

describe('buildFormForTable', () => {
    it('builds a valid form subtree with one input per writable field', () => {
        const { node, actions } = buildFormForTable(TABLE);

        expect(node.type).toBe('form');
        expect(Array.isArray(node.children)).toBe(true);
        expect(node.children).toHaveLength(WRITABLE_COUNT); // computed field is skipped
        expect(ID_RE.test(node.id)).toBe(true);

        // Every child is a known INPUT component from the catalog.
        const expected = {
            title: 'input_text',
            amount: 'input_number',
            due: 'input_date',
            when: 'input_datetime',
            paid: 'input_checkbox',
            status: 'input_select',
            customer: 'input_relation',
        };
        for (const child of node.children) {
            const entry = APP_COMPONENT_TYPES[child.type];
            expect(entry).toBeTruthy();
            expect(entry.isInput).toBe(true);
            expect(expected[child.props.name]).toBe(child.type);
            expect(ID_RE.test(child.id)).toBe(true);
        }

        // Field-specific prop wiring.
        const byName = Object.fromEntries(node.children.map((c) => [c.props.name, c]));
        expect(byName.title.props.label).toBe('Title');
        expect(byName.title.props.required).toBe(true);
        expect(byName.status.props.options).toEqual([
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'closed' },
        ]);
        expect(byName.customer.props.tableId).toBe('tbl_cust1');
    });

    it('wires onSubmit to a create_record sequence pulling each field from form values', () => {
        const { node, actions } = buildFormForTable(TABLE);

        const actionId = Object.keys(actions)[0];
        expect(ID_RE.test(actionId)).toBe(true);
        expect(node.onSubmit).toBe(actionId);

        const action = actions[actionId];
        expect(action.kind).toBe('sequence');
        const create = action.steps[0];
        expect(create.kind).toBe('create_record');
        expect(create.tableId).toBe('tbl_abc123');
        // One { kind:'field', name } binding per writable field.
        expect(create.values.title).toEqual({ kind: 'field', name: 'title' });
        expect(create.values.customer).toEqual({ kind: 'field', name: 'customer' });
        expect(Object.keys(create.values)).toHaveLength(WRITABLE_COUNT);
        expect(create.values.total).toBeUndefined(); // computed → not writable
    });

    it('mints collision-free ids against a shared taken set', () => {
        const taken = new Set();
        const a = buildFormForTable(TABLE, { taken });
        const b = buildGridForTable(TABLE, { taken });
        const ids = [
            a.node.id, ...a.node.children.map((c) => c.id), ...Object.keys(a.actions),
            b.node.id,
        ];
        expect(new Set(ids).size).toBe(ids.length); // all unique
    });
});

describe('buildGridForTable', () => {
    it('binds a data_grid to the table records with one column per field', () => {
        const { node } = buildGridForTable(TABLE);

        expect(node.type).toBe('data_grid');
        expect(node.props.source).toEqual({ kind: 'records', tableId: 'tbl_abc123' });
        expect(node.props.columns).toHaveLength(TABLE.fields.length);

        const byKey = Object.fromEntries(node.props.columns.map((c) => [c.key, c]));
        expect(byKey.amount.format).toBe('number');
        expect(byKey.due.format).toBe('date');
        expect(byKey.paid.format).toBe('boolean');
        expect(byKey.customer.format).toBe('relation');
        expect(byKey.status.format).toBe('badge');
        expect(byKey.title.format).toBe('text');
        // Every emitted format is one the data_grid spec accepts.
        for (const col of node.props.columns) expect(DATA_GRID_FORMATS.has(col.format)).toBe(true);
    });
});
