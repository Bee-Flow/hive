import { describe, it, expect } from 'vitest';
import { paramsToSchema, schemaToParams } from './triggerSchemaUtils';

describe('triggerSchemaUtils', () => {
    it('paramsToSchema builds a JSON Schema with required + descriptions', () => {
        const schema = paramsToSchema([
            { name: 'limit', type: 'number', required: true, description: 'how many' },
            { name: 'verbose', type: 'boolean', required: false },
        ]);
        expect(schema).toEqual({
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'how many' },
                verbose: { type: 'boolean' },
            },
            required: ['limit'],
            additionalProperties: false,
        });
    });

    it('paramsToSchema skips nameless rows and omits required when empty', () => {
        const schema = paramsToSchema([{ type: 'string' }, { name: '', required: true }]);
        expect(schema.properties).toEqual({});
        expect(schema.required).toBeUndefined();
    });

    it('schemaToParams is the inverse of paramsToSchema', () => {
        const rows = [
            { name: 'limit', type: 'number', required: true, description: 'how many' },
            { name: 'verbose', type: 'boolean', required: false, description: '' },
        ];
        expect(schemaToParams(paramsToSchema(rows))).toEqual(rows);
    });

    it('schemaToParams tolerates a missing/empty schema', () => {
        expect(schemaToParams(null)).toEqual([]);
        expect(schemaToParams({})).toEqual([]);
        expect(schemaToParams({ type: 'object' })).toEqual([]);
    });
});
