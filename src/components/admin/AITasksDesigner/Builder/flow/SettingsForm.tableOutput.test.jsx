import { describe, it, expect } from 'vitest';
import { fieldsToSchema, schemaToFields } from './SettingsForm';

/**
 * Table-format structured output: an `array` field with declared `columns`
 * serializes to a JSON schema (array of objects with typed properties) and
 * round-trips back to the same column list.
 */
describe('structured output — table columns', () => {
    it('serializes an array field with columns to array-of-objects schema', () => {
        const schema = fieldsToSchema([
            {
                key: 'Invoice Table', type: 'array', description: 'one row per invoice',
                columns: [
                    { key: 'Date', type: 'string' },
                    { key: 'Amount', type: 'number' },
                    { key: 'Paid', type: 'boolean' },
                ],
            },
        ]);
        expect(schema).toEqual({
            type: 'object',
            properties: {
                'Invoice Table': {
                    type: 'array',
                    description: 'one row per invoice',
                    items: {
                        type: 'object',
                        properties: {
                            Date: { type: 'string' },
                            Amount: { type: 'number' },
                            Paid: { type: 'boolean' },
                        },
                    },
                },
            },
        });
    });

    it('round-trips columns through schemaToFields', () => {
        const fields = [
            { key: 'rows', type: 'array', description: '', columns: [
                { key: 'name', type: 'string' },
                { key: 'qty', type: 'number' },
            ] },
        ];
        const back = schemaToFields(fieldsToSchema(fields));
        expect(back).toHaveLength(1);
        expect(back[0].type).toBe('array');
        expect(back[0].columns).toEqual([
            { key: 'name', type: 'string' },
            { key: 'qty', type: 'number' },
        ]);
    });

    it('an array with no usable columns stays untyped (model infers shape)', () => {
        const schema = fieldsToSchema([{ key: 'list', type: 'array', columns: [{ key: '', type: 'string' }] }]);
        expect(schema.properties.list).toEqual({ type: 'array' });
        expect(schema.properties.list.items).toBeUndefined();
    });

    it('non-array fields are unaffected by columns', () => {
        const schema = fieldsToSchema([{ key: 'summary', type: 'string', columns: [{ key: 'x', type: 'string' }] }]);
        expect(schema.properties.summary).toEqual({ type: 'string' });
    });

    it('datetime maps to a string/date-time schema and round-trips', () => {
        const schema = fieldsToSchema([
            { key: 'when', type: 'datetime' },
            { key: 'rows', type: 'array', columns: [{ key: 'paidAt', type: 'datetime' }, { key: 'amount', type: 'number' }] },
        ]);
        expect(schema.properties.when).toEqual({ type: 'string', format: 'date-time' });
        expect(schema.properties.rows.items.properties.paidAt).toEqual({ type: 'string', format: 'date-time' });
        const back = schemaToFields(schema);
        expect(back.find(f => f.key === 'when').type).toBe('datetime');
        expect(back.find(f => f.key === 'rows').columns).toEqual([
            { key: 'paidAt', type: 'datetime' },
            { key: 'amount', type: 'number' },
        ]);
    });

    it('preserves column order through the schema round-trip', () => {
        const cols = [
            { key: 'Supplier', type: 'string' },
            { key: 'Amount', type: 'number' },
            { key: 'Date', type: 'datetime' },
        ];
        const back = schemaToFields(fieldsToSchema([{ key: 'lines', type: 'array', columns: cols }]));
        expect(back[0].columns.map(c => c.key)).toEqual(['Supplier', 'Amount', 'Date']);
    });
});
